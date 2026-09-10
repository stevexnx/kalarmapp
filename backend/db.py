"""
Módulo de base de datos SQLite, autenticación segura (login/registro),
lista de amigos, finanzas avanzadas, pagos y calendario para SubTracker Pro.
"""
import sqlite3
import os
import json
import hashlib
import secrets
import shutil
from datetime import datetime, date, timedelta, timezone

ORIG_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'subscriptions.db')

# En Vercel Serverless, el filesystem raíz es de solo lectura; usamos /tmp
if os.environ.get('VERCEL') or os.environ.get('AWS_LAMBDA_FUNCTION_NAME'):
    DB_PATH = '/tmp/subscriptions.db'
    if not os.path.exists(DB_PATH) and os.path.exists(ORIG_DB_PATH):
        try:
            shutil.copyfile(ORIG_DB_PATH, DB_PATH)
        except Exception as _e:
            pass
else:
    DB_PATH = ORIG_DB_PATH

DEFAULT_EXCHANGE_RATES = {
    'USD': 1.0,
    'DOP': 60.0,
    'EUR': 0.92,
    'MXN': 19.5,
    'ARS': 980.0,
    'CLP': 920.0,
    'COP': 4100.0,
    'GBP': 0.78
}


def get_database_url():
    """Detecta si hay una URL de conexión de PostgreSQL configurada en el entorno."""
    return os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL') or os.environ.get('POSTGRES_PRISMA_URL')

class PostgresCursorWrapper:
    """
    Wrapper para cursor de psycopg2 que:
    1. Traduce marcadores de parámetros '?' a '%s'.
    2. Convierte 'INSERT OR IGNORE' a 'INSERT ... ON CONFLICT DO NOTHING'.
    3. Convierte 'INSERT OR REPLACE INTO settings (user_id, key, value) ...' a 'ON CONFLICT (user_id, key) DO UPDATE ...'.
    4. Maneja cursor.lastrowid inspeccionando RETURNING id automáticamente para INSERTs.
    """
    def __init__(self, real_cursor):
        self._cur = real_cursor
        self._last_insert_id = None

    @property
    def rowcount(self):
        return self._cur.rowcount

    @property
    def lastrowid(self):
        return self._last_insert_id

    def _adapt_sql(self, sql):
        clean_sql = sql.strip()
        is_insert = clean_sql.upper().startswith('INSERT')

        if 'INSERT OR IGNORE INTO' in clean_sql:
            clean_sql = clean_sql.replace('INSERT OR IGNORE INTO', 'INSERT INTO')
            if 'ON CONFLICT' not in clean_sql:
                clean_sql += ' ON CONFLICT DO NOTHING'

        if 'INSERT OR REPLACE INTO settings' in clean_sql:
            clean_sql = clean_sql.replace('INSERT OR REPLACE INTO settings', 'INSERT INTO settings')
            clean_sql += ' ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value'

        should_add_returning = False
        if is_insert and 'RETURNING' not in clean_sql.upper():
            # Tablas que tienen columna 'id' autonumérica
            tbls_with_id = ['users', 'friends', 'friend_payments', 'subscriptions', 'payment_history', 'friend_requests', 'shared_pay_requests']
            for tbl in tbls_with_id:
                if f'INSERT INTO {tbl}' in clean_sql:
                    should_add_returning = True
                    break

        if should_add_returning:
            clean_sql = clean_sql.rstrip(';') + ' RETURNING id'

        clean_sql = clean_sql.replace('?', '%s')
        return clean_sql, should_add_returning

    def execute(self, sql, params=None):
        adapted_sql, has_returning = self._adapt_sql(sql)
        if params is not None:
            self._cur.execute(adapted_sql, tuple(params))
        else:
            self._cur.execute(adapted_sql)

        if has_returning:
            try:
                row = self._cur.fetchone()
                if row:
                    if isinstance(row, dict):
                        self._last_insert_id = row.get('id')
                    else:
                        self._last_insert_id = row[0]
            except Exception:
                pass
        return self

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    def close(self):
        return self._cur.close()

    def __iter__(self):
        return iter(self._cur)

class PostgresConnectionWrapper:
    """Wrapper para la conexión psycopg2 que expone la misma interfaz que sqlite3."""
    def __init__(self, real_conn):
        self._conn = real_conn

    def cursor(self):
        return PostgresCursorWrapper(self._conn.cursor())

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def close(self):
        return self._conn.close()

def get_connection(db_path=None):
    """
    Retorna una conexión a la base de datos:
    - Si existe DATABASE_URL / POSTGRES_URL y no se especificó un db_path local explícito: conecta a PostgreSQL.
    - De lo contrario: conecta a SQLite (modo local / pruebas unitarias).
    """
    pg_url = get_database_url()
    if pg_url and not db_path:
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            conn = psycopg2.connect(pg_url, cursor_factory=RealDictCursor)
            return PostgresConnectionWrapper(conn)
        except Exception as e:
            print(f'[DB] Error conectando a PostgreSQL ({e}), recurriendo a SQLite de respaldo.')

    path = db_path or DB_PATH
    conn = sqlite3.connect(path, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')
    return conn
# ================= CRIPTOGRAFÍA Y SEGURIDAD =================
def hash_password(password: str, salt: str = None):
    """Genera hash seguro PBKDF2-HMAC-SHA256 con salt."""
    if not salt:
        salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
    return pwd_hash, salt

def verify_password(password: str, pwd_hash: str, salt: str):
    """Verifica si la contraseña ingresada coincide con el hash almacenado."""
    check_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(check_hash, pwd_hash)

def calculate_costs(price: float, billing_cycle: str):
    """
    Calcula el costo mensual y anual equivalente según la periodicidad.
    """
    cycle = (billing_cycle or 'monthly').lower()
    price = float(price or 0.0)

    if cycle == 'weekly':
        annual = price * 52.0
        monthly = annual / 12.0
    elif cycle == 'monthly':
        annual = price * 12.0
        monthly = price
    elif cycle == 'quarterly':
        annual = price * 4.0
        monthly = annual / 12.0
    elif cycle == 'biannual':
        annual = price * 2.0
        monthly = annual / 12.0
    elif cycle == 'annual':
        annual = price
        monthly = annual / 12.0
    else:
        annual = price * 12.0
        monthly = price

    return round(monthly, 2), round(annual, 2)

def convert_currency(amount: float, from_curr: str, to_curr: str, rates: dict):
    """Convierte un monto entre divisas utilizando una tabla de tasas referenciada en USD."""
    if not from_curr or not to_curr or from_curr == to_curr:
        return round(amount, 2)
    
    r = rates or DEFAULT_EXCHANGE_RATES
    rate_from = r.get(from_curr) or DEFAULT_EXCHANGE_RATES.get(from_curr, 1.0)
    rate_to = r.get(to_curr) or DEFAULT_EXCHANGE_RATES.get(to_curr, 1.0)

    if rate_from <= 0:
        rate_from = 1.0
    amount_in_usd = amount / rate_from
    amount_converted = amount_in_usd * rate_to
    return round(amount_converted, 2)


def init_db(db_path=None):
    """Inicializa y migra las tablas en la base de datos (PostgreSQL o SQLite)."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    if isinstance(conn, PostgresConnectionWrapper):
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                display_name TEXT NOT NULL,
                avatar_color VARCHAR(50) DEFAULT '#4F46E5',
                created_at TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token VARCHAR(255) PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS friends (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
                linked_user_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                email TEXT DEFAULT '',
                phone TEXT DEFAULT '',
                avatar_color VARCHAR(50) DEFAULT '#10B981',
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS friend_requests (
                id SERIAL PRIMARY KEY,
                sender_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
                receiver_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS shared_pay_requests (
                id SERIAL PRIMARY KEY,
                subscription_id INTEGER REFERENCES subscriptions (id) ON DELETE SET NULL,
                creator_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
                friend_user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
                amount DOUBLE PRECISION NOT NULL,
                currency VARCHAR(10) NOT NULL DEFAULT 'USD',
                due_date TEXT,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS friend_payments (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
                friend_id INTEGER NOT NULL REFERENCES friends (id) ON DELETE CASCADE,
                subscription_id INTEGER,
                amount DOUBLE PRECISION NOT NULL,
                payment_date TEXT NOT NULL,
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER DEFAULT 1,
                name TEXT NOT NULL,
                price DOUBLE PRECISION NOT NULL,
                currency VARCHAR(10) NOT NULL DEFAULT 'USD',
                billing_cycle VARCHAR(50) NOT NULL DEFAULT 'monthly',
                next_billing_date TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'Otros',
                payment_method TEXT DEFAULT 'Tarjeta de Crédito',
                status VARCHAR(50) NOT NULL DEFAULT 'active',
                notes TEXT DEFAULT '',
                url TEXT DEFAULT '',
                icon TEXT DEFAULT '',
                color TEXT DEFAULT '',
                is_trial INTEGER DEFAULT 0,
                trial_end_date TEXT,
                is_shared INTEGER DEFAULT 0,
                shared_with_count INTEGER DEFAULT 1,
                my_share_price DOUBLE PRECISION,
                original_currency VARCHAR(10) DEFAULT 'USD',
                shared_friend_ids TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS payment_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER DEFAULT 1,
                subscription_id INTEGER NOT NULL REFERENCES subscriptions (id) ON DELETE CASCADE,
                subscription_name TEXT NOT NULL,
                amount DOUBLE PRECISION NOT NULL,
                currency VARCHAR(10) NOT NULL DEFAULT 'USD',
                payment_date TEXT NOT NULL,
                payment_method TEXT DEFAULT 'Tarjeta de Crédito',
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                user_id INTEGER DEFAULT 1,
                key VARCHAR(255) NOT NULL,
                value TEXT NOT NULL,
                PRIMARY KEY (user_id, key)
            )
        """)
        # Migraciones idempotentes para bases PostgreSQL existentes
        cursor.execute("ALTER TABLE friends ADD COLUMN IF NOT EXISTS linked_user_id INTEGER REFERENCES users (id) ON DELETE SET NULL")
        cursor.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id INTEGER DEFAULT 1")
        cursor.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_trial INTEGER DEFAULT 0")
        cursor.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_end_date TEXT")
        cursor.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_shared INTEGER DEFAULT 0")
        cursor.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS shared_with_count INTEGER DEFAULT 1")
        cursor.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS my_share_price DOUBLE PRECISION")
        cursor.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS original_currency VARCHAR(10) DEFAULT 'USD'")
        cursor.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS shared_friend_ids TEXT DEFAULT ''")
        cursor.execute("ALTER TABLE payment_history ADD COLUMN IF NOT EXISTS user_id INTEGER DEFAULT 1")
    else:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                display_name TEXT NOT NULL,
                avatar_color TEXT DEFAULT '#4F46E5',
                created_at TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS friends (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                linked_user_id INTEGER,
                name TEXT NOT NULL,
                email TEXT DEFAULT '',
                phone TEXT DEFAULT '',
                avatar_color TEXT DEFAULT '#10B981',
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (linked_user_id) REFERENCES users (id) ON DELETE SET NULL
            )
        """)
        cursor.execute("PRAGMA table_info(friends)")
        friend_cols = [row['name'] for row in cursor.fetchall()]
        if 'linked_user_id' not in friend_cols:
            cursor.execute("ALTER TABLE friends ADD COLUMN linked_user_id INTEGER")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS friend_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS shared_pay_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subscription_id INTEGER,
                creator_id INTEGER NOT NULL,
                friend_user_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                due_date TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE SET NULL,
                FOREIGN KEY (creator_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (friend_user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS friend_payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                friend_id INTEGER NOT NULL,
                subscription_id INTEGER,
                amount REAL NOT NULL,
                payment_date TEXT NOT NULL,
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (friend_id) REFERENCES friends (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER DEFAULT 1,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                billing_cycle TEXT NOT NULL DEFAULT 'monthly',
                next_billing_date TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'Otros',
                payment_method TEXT DEFAULT 'Tarjeta de Crédito',
                status TEXT NOT NULL DEFAULT 'active',
                notes TEXT DEFAULT '',
                url TEXT DEFAULT '',
                icon TEXT DEFAULT '',
                color TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        cursor.execute("PRAGMA table_info(subscriptions)")
        sub_columns = [row['name'] for row in cursor.fetchall()]
        new_sub_columns = [
            ('user_id', 'INTEGER DEFAULT 1'),
            ('is_trial', 'INTEGER DEFAULT 0'),
            ('trial_end_date', 'TEXT'),
            ('is_shared', 'INTEGER DEFAULT 0'),
            ('shared_with_count', 'INTEGER DEFAULT 1'),
            ('my_share_price', 'REAL'),
            ('original_currency', "TEXT DEFAULT 'USD'"),
            ('shared_friend_ids', "TEXT DEFAULT ''")
        ]
        for col_name, col_type in new_sub_columns:
            if col_name not in sub_columns:
                cursor.execute(f"ALTER TABLE subscriptions ADD COLUMN {col_name} {col_type}")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS payment_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER DEFAULT 1,
                subscription_id INTEGER NOT NULL,
                subscription_name TEXT NOT NULL,
                amount REAL NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                payment_date TEXT NOT NULL,
                payment_method TEXT DEFAULT 'Tarjeta de Crédito',
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("PRAGMA table_info(payment_history)")
        pay_columns = [row['name'] for row in cursor.fetchall()]
        if 'user_id' not in pay_columns:
            cursor.execute("ALTER TABLE payment_history ADD COLUMN user_id INTEGER DEFAULT 1")

        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='settings'")
        settings_sql_row = cursor.fetchone()
        settings_sql = settings_sql_row[0] if settings_sql_row else ''
        if not settings_sql:
            cursor.execute("""
                CREATE TABLE settings (
                    user_id INTEGER DEFAULT 1,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    PRIMARY KEY (user_id, key)
                )
            """)
        elif 'user_id, key' not in settings_sql and '(user_id,' not in settings_sql:
            cursor.execute("SELECT * FROM settings")
            old_rows = cursor.fetchall()
            cursor.execute("ALTER TABLE settings RENAME TO settings_old")
            cursor.execute("""
                CREATE TABLE settings (
                    user_id INTEGER DEFAULT 1,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    PRIMARY KEY (user_id, key)
                )
            """)
            for r in old_rows:
                uid = r['user_id'] if 'user_id' in r.keys() else 1
                cursor.execute(
                    "INSERT OR IGNORE INTO settings (user_id, key, value) VALUES (?, ?, ?)",
                    (uid or 1, r['key'], r['value'])
                )
            cursor.execute("DROP TABLE settings_old")
        else:
            cursor.execute("PRAGMA table_info(settings)")
            settings_cols = [row['name'] for row in cursor.fetchall()]
            if 'user_id' not in settings_cols:
                cursor.execute("ALTER TABLE settings ADD COLUMN user_id INTEGER DEFAULT 1")

    cursor.execute("SELECT COUNT(*) as count FROM users")
    count_row = cursor.fetchone()
    count_val = count_row['count'] if isinstance(count_row, dict) else count_row[0]
    if count_val == 0:
        pwd_hash, salt = hash_password('admin123')
        now_str = datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO users (id, username, email, password_hash, salt, display_name, avatar_color, created_at)
            VALUES (1, 'admin', 'admin@subtracker.local', ?, ?, 'Administrador', '#4F46E5', ?)
        """, (pwd_hash, salt, now_str))

        default_settings = {
            'monthly_budget': '150.00',
            'base_currency': 'USD',
            'exchange_rates': json.dumps(DEFAULT_EXCHANGE_RATES),
            'discord_webhook': '',
            'telegram_webhook': '',
            'notifications_enabled': '1'
        }
        for k, v in default_settings.items():
            cursor.execute("INSERT OR IGNORE INTO settings (user_id, key, value) VALUES (1, ?, ?)", (k, v))

        demo_friends = [
            (1, 'Carlos Gómez', 'carlos@ejemplo.com', '+52 55 1234 5678', '#3B82F6', 'Comparte Netflix Familiar'),
            (1, 'María Rodríguez', 'maria@ejemplo.com', '+34 600 123 456', '#EC4899', 'Comparte Spotify Dúo')
        ]
        for f in demo_friends:
            cursor.execute("""
                INSERT INTO friends (user_id, name, email, phone, avatar_color, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (*f, now_str))

    conn.commit()
    conn.close()
# ================= AUTENTICACIÓN Y USUARIOS =================
def register_user(username, password, email='', display_name='', db_path=None):
    """Registra un nuevo usuario en la base de datos."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    username = username.strip().lower()
    if not username:
        conn.close()
        raise ValueError('El nombre de usuario es obligatorio')
    if len(password) < 4:
        conn.close()
        raise ValueError('La contraseña debe tener al menos 4 caracteres')

    cursor.execute("SELECT id FROM users WHERE LOWER(username) = ?", (username,))
    if cursor.fetchone():
        conn.close()
        raise ValueError('Ese nombre de usuario ya está registrado')

    colors = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6']
    avatar_color = secrets.choice(colors)

    pwd_hash, salt = hash_password(password)
    now_str = datetime.now().isoformat()
    disp_name = display_name.strip() or username.capitalize()

    cursor.execute('''
        INSERT INTO users (username, email, password_hash, salt, display_name, avatar_color, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (username, email.strip().lower(), pwd_hash, salt, disp_name, avatar_color, now_str))
    
    new_user_id = cursor.lastrowid

    # Ajustes predeterminados para el nuevo usuario
    default_settings = {
        'monthly_budget': '150.00',
        'base_currency': 'USD',
        'exchange_rates': json.dumps(DEFAULT_EXCHANGE_RATES),
        'discord_webhook': '',
        'telegram_webhook': '',
        'notifications_enabled': '1'
    }
    for k, v in default_settings.items():
        cursor.execute("INSERT OR IGNORE INTO settings (user_id, key, value) VALUES (?, ?, ?)", (new_user_id, k, v))

    conn.commit()
    conn.close()

    return {
        'id': new_user_id,
        'username': username,
        'display_name': disp_name,
        'avatar_color': avatar_color
    }

def authenticate_user(username, password, db_path=None):
    """Verifica credenciales y retorna el usuario si son correctas."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    username = username.strip().lower()
    cursor.execute("SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?", (username, username))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    if verify_password(password, row['password_hash'], row['salt']):
        return {
            'id': row['id'],
            'username': row['username'],
            'email': row['email'],
            'display_name': row['display_name'],
            'avatar_color': row['avatar_color']
        }
    return None

def create_session(user_id: int, days=30, db_path=None):
    """Genera un token de sesión seguro para el usuario."""
    token = secrets.token_hex(32)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=days)

    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO sessions (token, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
    ''', (token, user_id, now.isoformat(), expires.isoformat()))
    conn.commit()
    conn.close()
    return token

def get_user_by_session(token: str, db_path=None):
    """Obtiene el usuario vinculado a un token de sesión válido."""
    if not token:
        return None
    conn = get_connection(db_path)
    cursor = conn.cursor()

    now_iso = datetime.now(timezone.utc).isoformat()
    cursor.execute('''
        SELECT u.id, u.username, u.email, u.display_name, u.avatar_color
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > ?
    ''', (token, now_iso))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def reset_password_with_recovery(identifier: str, new_password: str, db_path=None):
    """
    Restablece la contraseña de un usuario mediante su nombre de usuario o correo.
    Valida la existencia del usuario y actualiza hash y salt de forma segura.
    """
    ident = identifier.strip().lower()
    if not ident:
        raise ValueError('Debes ingresar tu nombre de usuario o correo')
    if len(new_password) < 4:
        raise ValueError('La nueva contraseña debe tener al menos 4 caracteres')

    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT id, username FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?", (ident, ident))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise ValueError('No se encontró ningún usuario con ese nombre o correo')

    pwd_hash, salt = hash_password(new_password)
    cursor.execute("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?", (pwd_hash, salt, user['id']))
    # Revocar sesiones anteriores para exigir login fresco
    cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user['id'],))
    conn.commit()
    conn.close()
    return {'id': user['id'], 'username': user['username']}

def change_user_password(user_id: int, current_password: str, new_password: str, db_path=None):
    """
    Permite a un usuario autenticado cambiar su contraseña validando la contraseña actual.
    """
    if len(new_password) < 4:
        raise ValueError('La nueva contraseña debe tener al menos 4 caracteres')

    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT id, password_hash, salt FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise ValueError('Usuario no encontrado')

    if not verify_password(current_password, user['password_hash'], user['salt']):
        conn.close()
        raise ValueError('La contraseña actual es incorrecta')

    pwd_hash, salt = hash_password(new_password)
    cursor.execute("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?", (pwd_hash, salt, user_id))
    conn.commit()
    conn.close()
    return True

def delete_session(token: str, db_path=None):
    """Cierra la sesión eliminando el token."""
    if not token:
        return
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()

# ================= GESTIÓN DE AMIGOS =================
def get_friends(user_id=1, db_path=None):
    """Obtiene la lista de amigos del usuario."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM friends WHERE user_id = ? ORDER BY name ASC", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_friend_by_id(friend_id: int, user_id=1, db_path=None):
    """Obtiene un amigo por ID."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM friends WHERE id = ? AND user_id = ?", (friend_id, user_id))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def create_friend(user_id: int, data: dict, db_path=None):
    """Agrega un nuevo amigo/contacto."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    name = data.get('name', '').strip()
    if not name:
        conn.close()
        raise ValueError('El nombre del amigo es obligatorio')

    colors = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4']
    avatar_color = data.get('avatar_color') or secrets.choice(colors)
    now_str = datetime.now().isoformat()
    linked_user_id = data.get('linked_user_id') or None

    cursor.execute('''
        INSERT INTO friends (user_id, linked_user_id, name, email, phone, avatar_color, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        user_id,
        linked_user_id,
        name,
        data.get('email', '').strip(),
        data.get('phone', '').strip(),
        avatar_color,
        data.get('notes', '').strip(),
        now_str
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return get_friend_by_id(new_id, user_id, db_path)

def update_friend(friend_id: int, user_id: int, data: dict, db_path=None):
    """Actualiza datos de un amigo."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    fields = []
    values = []
    for k in ['name', 'email', 'phone', 'avatar_color', 'notes', 'linked_user_id']:
        if k in data:
            fields.append(f"{k} = ?")
            val = data[k]
            if val is not None and k != 'linked_user_id':
                val = str(val).strip()
            values.append(val)

    if not fields:
        conn.close()
        return get_friend_by_id(friend_id, user_id, db_path)

    values.extend([friend_id, user_id])
    cursor.execute(f"UPDATE friends SET {', '.join(fields)} WHERE id = ? AND user_id = ?", values)
    conn.commit()
    conn.close()
    return get_friend_by_id(friend_id, user_id, db_path)

def delete_friend(friend_id: int, user_id: int, db_path=None):
    """Elimina un amigo."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM friends WHERE id = ? AND user_id = ?", (friend_id, user_id))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def record_friend_payment(user_id: int, friend_id: int, amount: float, subscription_id=None, payment_date=None, notes='', db_path=None):
    """Registra un reembolso o pago recibido de un amigo."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()
    p_date = payment_date or date.today().isoformat()

    cursor.execute('''
        INSERT INTO friend_payments (user_id, friend_id, subscription_id, amount, payment_date, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, friend_id, subscription_id, float(amount), p_date, notes.strip(), now_str))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {
        'id': new_id,
        'user_id': user_id,
        'friend_id': friend_id,
        'amount': float(amount),
        'payment_date': p_date,
        'notes': notes
    }

def get_friend_balances(user_id=1, db_path=None):
    """
    Calcula el balance y montos a cobrar por cada amigo según las suscripciones compartidas.
    Convierte todas las cuotas a la divisa base del usuario para un total homogéneo.
    """
    friends = get_friends(user_id, db_path)
    subs = get_all_subscriptions(user_id=user_id, db_path=db_path)
    settings = get_settings(user_id=user_id, db_path=db_path)
    base_currency = settings.get('base_currency', 'USD')
    rates = settings.get('exchange_rates', DEFAULT_EXCHANGE_RATES)

    balances = []
    for f in friends:
        fid = f['id']
        shared_subs = []
        monthly_total_owed = 0.0

        for s in subs:
            if not s.get('is_shared') or s.get('status') != 'active':
                continue

            # Verificar si este amigo está etiquetado
            friend_ids = [int(x) for x in str(s.get('shared_friend_ids') or '').split(',') if x.strip().isdigit()]
            if fid in friend_ids:
                total_count = max(1, s.get('shared_with_count', 2))
                # Monto por persona en divisa original y convertida a base_currency
                person_share_raw = round(s['monthly_cost'], 2)
                sub_curr = s.get('currency', 'USD')
                person_share_conv = convert_currency(person_share_raw, sub_curr, base_currency, rates)

                shared_subs.append({
                    'id': s['id'],
                    'name': s['name'],
                    'total_price': s['price'],
                    'currency': sub_curr,
                    'friend_share': person_share_raw,
                    'friend_share_converted': person_share_conv,
                    'next_billing_date': s['next_billing_date']
                })
                monthly_total_owed += person_share_conv

        balances.append({
            'friend': f,
            'shared_subscriptions': shared_subs,
            'monthly_total_owed': round(monthly_total_owed, 2),
            'currency': base_currency
        })

    return balances

# ================= RED SOCIAL: USUARIOS, SOLICITUDES Y PAGOS EN CONJUNTO =================
def search_users(query: str, current_user_id: int, db_path=None):
    """Busca usuarios registrados en la plataforma por username, display_name o email (excluye al usuario actual)."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    term = f"%{query.strip().lower()}%"
    cursor.execute('''
        SELECT id, username, display_name, email, avatar_color, created_at
        FROM users
        WHERE id != ? AND (LOWER(username) LIKE ? OR LOWER(display_name) LIKE ? OR LOWER(email) LIKE ?)
        LIMIT 20
    ''', (current_user_id, term, term, term))
    rows = cursor.fetchall()
    conn.close()

    # Obtener estado de solicitud y si ya es amigo
    friends = get_friends(current_user_id, db_path)
    linked_ids = {f.get('linked_user_id') for f in friends if f.get('linked_user_id')}

    res = []
    for r in rows:
        d = dict(r)
        d['is_friend'] = d['id'] in linked_ids
        res.append(d)
    return res

def send_friend_request(sender_id: int, receiver_username_or_id, db_path=None):
    """Envía una solicitud de amistad a otro usuario."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    # Resolver receiver_id
    if isinstance(receiver_username_or_id, int) or (isinstance(receiver_username_or_id, str) and receiver_username_or_id.isdigit()):
        receiver_id = int(receiver_username_or_id)
        cursor.execute("SELECT id, username, display_name FROM users WHERE id = ?", (receiver_id,))
    else:
        target_name = str(receiver_username_or_id).strip().lower()
        cursor.execute("SELECT id, username, display_name FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?", (target_name, target_name))

    target_user = cursor.fetchone()
    if not target_user:
        conn.close()
        raise ValueError("El usuario no existe")

    receiver_id = target_user['id'] if isinstance(target_user, dict) else target_user[0]
    if receiver_id == sender_id:
        conn.close()
        raise ValueError("No puedes enviarte una solicitud a ti mismo")

    # Verificar si ya existe solicitud pendiente o aceptada
    cursor.execute('''
        SELECT id, status FROM friend_requests
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    ''', (sender_id, receiver_id, receiver_id, sender_id))
    existing = cursor.fetchone()
    if existing:
        status = existing['status'] if isinstance(existing, dict) else existing[1]
        if status == 'accepted':
            conn.close()
            raise ValueError("Ya son amigos")
        elif status == 'pending':
            conn.close()
            raise ValueError("Ya hay una solicitud pendiente entre ambos")
        else:
            # Si estaba rechazada, la volvemos a poner en pending
            now_str = datetime.now().isoformat()
            req_id = existing['id'] if isinstance(existing, dict) else existing[0]
            cursor.execute("UPDATE friend_requests SET status = 'pending', sender_id = ?, receiver_id = ?, updated_at = ? WHERE id = ?", (sender_id, receiver_id, now_str, req_id))
            conn.commit()
            conn.close()
            return {'id': req_id, 'sender_id': sender_id, 'receiver_id': receiver_id, 'status': 'pending'}

    now_str = datetime.now().isoformat()
    cursor.execute('''
        INSERT INTO friend_requests (sender_id, receiver_id, status, created_at, updated_at)
        VALUES (?, ?, 'pending', ?, ?)
    ''', (sender_id, receiver_id, now_str, now_str))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {'id': new_id, 'sender_id': sender_id, 'receiver_id': receiver_id, 'status': 'pending'}

def get_friend_requests(user_id: int, db_path=None):
    """Obtiene las solicitudes de amistad recibidas y enviadas."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    # Recibidas
    cursor.execute('''
        SELECT fr.id, fr.sender_id, fr.receiver_id, fr.status, fr.created_at,
               u.username as sender_username, u.display_name as sender_display_name,
               u.avatar_color as sender_avatar_color, u.email as sender_email
        FROM friend_requests fr
        JOIN users u ON fr.sender_id = u.id
        WHERE fr.receiver_id = ? AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
    ''', (user_id,))
    received = [dict(r) for r in cursor.fetchall()]

    # Enviadas
    cursor.execute('''
        SELECT fr.id, fr.sender_id, fr.receiver_id, fr.status, fr.created_at,
               u.username as receiver_username, u.display_name as receiver_display_name,
               u.avatar_color as receiver_avatar_color
        FROM friend_requests fr
        JOIN users u ON fr.receiver_id = u.id
        WHERE fr.sender_id = ? AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
    ''', (user_id,))
    sent = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {'received': received, 'sent': sent}

def respond_friend_request(request_id: int, user_id: int, action: str, db_path=None):
    """Acepta o rechaza una solicitud de amistad recibida."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ?", (request_id, user_id))
    req = cursor.fetchone()
    if not req:
        conn.close()
        raise ValueError("Solicitud no encontrada")

    req_dict = dict(req)
    if req_dict['status'] != 'pending':
        conn.close()
        raise ValueError(f"La solicitud ya fue {req_dict['status']}")

    new_status = 'accepted' if action == 'accept' else 'rejected'
    now_str = datetime.now().isoformat()
    cursor.execute("UPDATE friend_requests SET status = ?, updated_at = ? WHERE id = ?", (new_status, now_str, request_id))

    if action == 'accept':
        sender_id = req_dict['sender_id']

        # Obtener datos de ambos usuarios
        cursor.execute("SELECT id, username, display_name, email, avatar_color FROM users WHERE id = ?", (sender_id,))
        sender_row = cursor.fetchone()
        sender = dict(sender_row) if sender_row else {'display_name': 'Amigo', 'email': '', 'avatar_color': '#10B981'}

        cursor.execute("SELECT id, username, display_name, email, avatar_color FROM users WHERE id = ?", (user_id,))
        receiver_row = cursor.fetchone()
        receiver = dict(receiver_row) if receiver_row else {'display_name': 'Amigo', 'email': '', 'avatar_color': '#10B981'}

        # 1. Agregar sender como amigo de user_id si no existe
        cursor.execute("SELECT id FROM friends WHERE user_id = ? AND linked_user_id = ?", (user_id, sender_id))
        if not cursor.fetchone():
            cursor.execute('''
                INSERT INTO friends (user_id, linked_user_id, name, email, phone, avatar_color, notes, created_at)
                VALUES (?, ?, ?, ?, '', ?, 'Usuario conectado de SubTracker', ?)
            ''', (user_id, sender_id, sender['display_name'], sender.get('email', ''), sender.get('avatar_color', '#10B981'), now_str))

        # 2. Agregar user_id como amigo de sender si no existe
        cursor.execute("SELECT id FROM friends WHERE user_id = ? AND linked_user_id = ?", (sender_id, user_id))
        if not cursor.fetchone():
            cursor.execute('''
                INSERT INTO friends (user_id, linked_user_id, name, email, phone, avatar_color, notes, created_at)
                VALUES (?, ?, ?, ?, '', ?, 'Usuario conectado de SubTracker', ?)
            ''', (sender_id, user_id, receiver['display_name'], receiver.get('email', ''), receiver.get('avatar_color', '#10B981'), now_str))

    conn.commit()
    conn.close()
    return {'id': request_id, 'status': new_status}

def create_split_pay_request(creator_id: int, data: dict, db_path=None):
    """Crea una solicitud de pago en conjunto (Split Request) a un amigo con cuenta vinculada."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    friend_user_id = data.get('friend_user_id')
    friend_id = data.get('friend_id')

    # Si friend_user_id no viene especificado directamente pero sí friend_id, buscar en friends
    if not friend_user_id and friend_id:
        try:
            cursor.execute("SELECT linked_user_id FROM friends WHERE id = ? AND user_id = ?", (int(friend_id), creator_id))
            row = cursor.fetchone()
            if row:
                friend_user_id = row['linked_user_id'] if isinstance(row, dict) else row[0]
        except Exception:
            pass

    amount = float(data.get('amount', 0))
    if not friend_user_id:
        conn.close()
        raise ValueError("Para enviar una solicitud de pago en conjunto, el amigo debe tener una cuenta vinculada en SubTracker.")
    if amount <= 0:
        conn.close()
        raise ValueError("El monto a solicitar debe ser mayor a 0.")

    sub_id = data.get('subscription_id') or None
    currency = data.get('currency', 'USD')
    due_date = data.get('due_date') or date.today().isoformat()
    notes = data.get('notes', '').strip()
    now_str = datetime.now().isoformat()

    cursor.execute('''
        INSERT INTO shared_pay_requests (subscription_id, creator_id, friend_user_id, amount, currency, due_date, status, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    ''', (sub_id, creator_id, int(friend_user_id), amount, currency, due_date, notes, now_str))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {
        'id': new_id,
        'creator_id': creator_id,
        'friend_user_id': int(friend_user_id),
        'amount': amount,
        'currency': currency,
        'due_date': due_date,
        'status': 'pending',
        'notes': notes,
        'created_at': now_str
    }

def get_split_pay_requests(user_id: int, db_path=None):
    """Obtiene las solicitudes de pago conjunto recibidas y creadas por el usuario."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    # Recibidas (me solicitan pagar)
    cursor.execute('''
        SELECT sp.*,
               u.username as creator_username,
               u.display_name as creator_display_name,
               u.display_name as creator_name,
               u.avatar_color as creator_avatar_color,
               s.name as subscription_name,
               s.name as sub_name,
               s.category as subscription_category,
               s.billing_cycle as subscription_billing_cycle,
               s.color as subscription_color,
               s.icon as subscription_icon,
               s.url as subscription_url,
               s.price as subscription_price,
               s.next_billing_date as subscription_next_billing_date,
               s.payment_method as subscription_payment_method
        FROM shared_pay_requests sp
        LEFT JOIN users u ON sp.creator_id = u.id
        LEFT JOIN subscriptions s ON sp.subscription_id = s.id
        WHERE sp.friend_user_id = ?
        ORDER BY sp.created_at DESC
    ''', (user_id,))
    received = [dict(r) for r in cursor.fetchall()]

    # Creadas por mí (yo solicité a amigos)
    cursor.execute('''
        SELECT sp.*,
               u.username as friend_username,
               u.display_name as friend_display_name,
               u.display_name as friend_name,
               u.avatar_color as friend_avatar_color,
               s.name as subscription_name,
               s.name as sub_name,
               s.category as subscription_category,
               s.billing_cycle as subscription_billing_cycle,
               s.color as subscription_color,
               s.icon as subscription_icon,
               s.url as subscription_url,
               s.price as subscription_price,
               s.next_billing_date as subscription_next_billing_date,
               s.payment_method as subscription_payment_method
        FROM shared_pay_requests sp
        LEFT JOIN users u ON sp.friend_user_id = u.id
        LEFT JOIN subscriptions s ON sp.subscription_id = s.id
        WHERE sp.creator_id = ?
        ORDER BY sp.created_at DESC
    ''', (user_id,))
    sent = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {'received': received, 'sent': sent}

def respond_split_pay_request(request_id: int, user_id: int, action: str, db_path=None):
    """Responde a una solicitud de pago conjunto (marcar 'paid' o 'declined')."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    # El usuario puede responder si es el friend_user_id (pagador) o el creator_id (creador confirmando pago)
    cursor.execute("SELECT * FROM shared_pay_requests WHERE id = ? AND (friend_user_id = ? OR creator_id = ?)", (request_id, user_id, user_id))
    req = cursor.fetchone()
    if not req:
        conn.close()
        raise ValueError("Solicitud de pago no encontrada o sin permisos")

    req_dict = dict(req)
    new_status = 'paid' if action in ('paid', 'pay', 'accept') else 'declined'
    cursor.execute("UPDATE shared_pay_requests SET status = ? WHERE id = ?", (new_status, request_id))

    # Si se marcó como pagada, registrar automáticamente en friend_payments del creador
    if new_status == 'paid':
        creator_id = req_dict['creator_id']
        friend_user_id = req_dict['friend_user_id']

        # Localizar el friend_id en la agenda del creador
        cursor.execute("SELECT id FROM friends WHERE user_id = ? AND linked_user_id = ?", (creator_id, friend_user_id))
        f_row = cursor.fetchone()
        friend_id = f_row['id'] if isinstance(f_row, dict) else (f_row[0] if f_row else None)
        if friend_id:
            now_str = datetime.now().isoformat()
            p_date = date.today().isoformat()
            cursor.execute('''
                INSERT INTO friend_payments (user_id, friend_id, subscription_id, amount, payment_date, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (creator_id, friend_id, req_dict.get('subscription_id'), req_dict['amount'], p_date, 'Saldado vía solicitud de pago conjunto', now_str))

    conn.commit()
    conn.close()
    return {'id': request_id, 'status': new_status}

def get_shared_subscriptions_with_friend(user_id: int, friend_id: int, db_path=None):
    """Devuelve las suscripciones individuales de ambos y compartidas entre el usuario y su amigo."""
    friend = get_friend_by_id(friend_id, user_id=user_id, db_path=db_path)
    if not friend:
        return {
            'friend': None,
            'is_linked': False,
            'my_subscriptions': [],
            'friend_subscriptions': [],
            'common_subs': []
        }

    # 1. Suscripciones del usuario actual
    my_all_subs = get_all_subscriptions(user_id=user_id, db_path=db_path)
    my_active_subs = [s for s in my_all_subs if s.get('status') == 'active']

    # Suscripciones ya marcadas como compartidas con este amigo
    common_subs = []
    for s in my_active_subs:
        if s.get('is_shared'):
            ids = [int(x) for x in str(s.get('shared_friend_ids') or '').split(',') if x.strip().isdigit()]
            if friend_id in ids:
                common_subs.append(s)

    # 2. Suscripciones del amigo (si es usuario registrado en SubTracker)
    friend_subs = []
    is_linked = bool(friend.get('linked_user_id'))
    if is_linked:
        f_user_id = friend['linked_user_id']
        f_all_subs = get_all_subscriptions(user_id=f_user_id, db_path=db_path)
        friend_subs = [s for s in f_all_subs if s.get('status') == 'active']

    return {
        'friend': friend,
        'is_linked': is_linked,
        'my_subscriptions': my_active_subs,
        'friend_subscriptions': friend_subs,
        'common_subs': common_subs
    }

# ================= CRUD DE SUSCRIPCIONES =================
def dict_from_row(row):
    """Convierte una fila de sqlite3.Row en dict e inyecta costos calculados."""
    if not row:
        return None
    data = dict(row)

    effective_price = data['price']
    is_shared = bool(data.get('is_shared', 0))
    shared_count = int(data.get('shared_with_count', 1) or 1)
    
    if is_shared and data.get('my_share_price') is not None and float(data['my_share_price']) > 0:
        effective_price = float(data['my_share_price'])
    elif is_shared and shared_count > 1:
        effective_price = round(data['price'] / shared_count, 2)

    monthly_cost, annual_cost = calculate_costs(effective_price, data['billing_cycle'])
    data['monthly_cost'] = monthly_cost
    data['annual_cost'] = annual_cost
    data['total_annual_raw'] = calculate_costs(data['price'], data['billing_cycle'])[1]
    
    # Días restantes para el corte
    try:
        today = date.today()
        billing_date = datetime.strptime(data['next_billing_date'], '%Y-%m-%d').date()
        delta_days = (billing_date - today).days
        data['days_until_billing'] = delta_days
    except (ValueError, TypeError):
        data['days_until_billing'] = None

    # Días restantes si es prueba gratuita
    data['is_trial'] = bool(data.get('is_trial', 0))
    data['days_until_trial_end'] = None
    if data['is_trial'] and data.get('trial_end_date'):
        try:
            today = date.today()
            t_date = datetime.strptime(data['trial_end_date'], '%Y-%m-%d').date()
            data['days_until_trial_end'] = (t_date - today).days
        except (ValueError, TypeError):
            pass

    return data

def get_all_subscriptions(user_id=1, db_path=None, search=None, category=None, status=None, sort_by=None):
    """Obtiene todas las suscripciones del usuario con filtros opcionales."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    query = "SELECT * FROM subscriptions WHERE (user_id = ? OR user_id IS NULL)"
    params = [user_id]

    if search:
        query += " AND (LOWER(name) LIKE ? OR LOWER(notes) LIKE ?)"
        term = f"%{search.lower().strip()}%"
        params.extend([term, term])
    
    if category and category != 'all':
        query += " AND category = ?"
        params.append(category)

    if status and status != 'all':
        query += " AND status = ?"
        params.append(status)

    if sort_by == 'cost_desc':
        query += " ORDER BY price DESC"
    elif sort_by == 'cost_asc':
        query += " ORDER BY price ASC"
    elif sort_by == 'name_asc':
        query += " ORDER BY name ASC"
    elif sort_by == 'date_asc':
        query += " ORDER BY next_billing_date ASC"
    else:
        query += " ORDER BY next_billing_date ASC, name ASC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    settings = get_settings(user_id=user_id, db_path=db_path)
    base_currency = settings.get('base_currency', 'USD')
    rates = settings.get('exchange_rates', DEFAULT_EXCHANGE_RATES)

    results = []
    for row in rows:
        d = dict_from_row(row)
        curr = d.get('currency', 'USD')
        d['converted_price'] = convert_currency(d['price'], curr, base_currency, rates)
        d['converted_monthly_cost'] = convert_currency(d['monthly_cost'], curr, base_currency, rates)
        d['converted_annual_cost'] = convert_currency(d['annual_cost'], curr, base_currency, rates)
        d['base_currency'] = base_currency
        results.append(d)

    if sort_by == 'cost_desc':
        results.sort(key=lambda x: x['converted_annual_cost'], reverse=True)
    elif sort_by == 'cost_asc':
        results.sort(key=lambda x: x['converted_annual_cost'])

    return results

def get_subscription_by_id(sub_id: int, user_id=None, db_path=None):
    """Obtiene una suscripción por su ID."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    if user_id:
        cursor.execute("SELECT * FROM subscriptions WHERE id = ? AND (user_id = ? OR user_id IS NULL)", (sub_id, user_id))
    else:
        cursor.execute("SELECT * FROM subscriptions WHERE id = ?", (sub_id,))
    row = cursor.fetchone()
    conn.close()
    d = dict_from_row(row)
    if d:
        target_uid = user_id or d.get('user_id') or 1
        settings = get_settings(user_id=target_uid, db_path=db_path)
        base_currency = settings.get('base_currency', 'USD')
        rates = settings.get('exchange_rates', DEFAULT_EXCHANGE_RATES)
        curr = d.get('currency', 'USD')
        d['converted_price'] = convert_currency(d['price'], curr, base_currency, rates)
        d['converted_monthly_cost'] = convert_currency(d['monthly_cost'], curr, base_currency, rates)
        d['converted_annual_cost'] = convert_currency(d['annual_cost'], curr, base_currency, rates)
        d['base_currency'] = base_currency
    return d

def create_subscription(data: dict, user_id=1, db_path=None):
    """Crea una nueva suscripción en la base de datos vinculada al usuario."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()

    is_trial = 1 if data.get('is_trial') in (True, 1, '1', 'true') else 0
    trial_end_date = data.get('trial_end_date') or None
    is_shared = 1 if data.get('is_shared') in (True, 1, '1', 'true') else 0
    shared_count = int(data.get('shared_with_count', 1) or 1)
    
    my_share = data.get('my_share_price')
    if my_share is not None and str(my_share).strip():
        my_share = float(my_share)
    elif is_shared and shared_count > 1:
        my_share = round(float(data.get('price', 0.0)) / shared_count, 2)
    else:
        my_share = None

    shared_friend_ids = str(data.get('shared_friend_ids', '')).strip()

    cursor.execute('''
        INSERT INTO subscriptions (
            user_id, name, price, currency, billing_cycle, next_billing_date,
            category, payment_method, status, notes, url, icon, color,
            is_trial, trial_end_date, is_shared, shared_with_count, my_share_price,
            original_currency, shared_friend_ids, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        user_id,
        data.get('name', '').strip(),
        float(data.get('price', 0.0)),
        data.get('currency', 'USD'),
        data.get('billing_cycle', 'monthly'),
        data.get('next_billing_date', date.today().isoformat()),
        data.get('category', 'Otros'),
        data.get('payment_method', 'Tarjeta de Crédito'),
        data.get('status', 'active'),
        data.get('notes', '').strip(),
        data.get('url', '').strip(),
        data.get('icon', ''),
        data.get('color', '#3B82F6'),
        is_trial,
        trial_end_date,
        is_shared,
        shared_count,
        my_share,
        data.get('currency', 'USD'),
        shared_friend_ids,
        now_str,
        now_str
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return get_subscription_by_id(new_id, user_id=user_id, db_path=db_path)

def update_subscription(sub_id: int, data: dict, user_id=None, db_path=None):
    """Actualiza una suscripción existente."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()

    fields = []
    values = []

    allowed_fields = [
        'name', 'price', 'currency', 'billing_cycle', 'next_billing_date',
        'category', 'payment_method', 'status', 'notes', 'url', 'icon', 'color',
        'is_trial', 'trial_end_date', 'is_shared', 'shared_with_count', 'my_share_price',
        'original_currency', 'shared_friend_ids'
    ]

    for key in allowed_fields:
        if key in data:
            val = data[key]
            if key in ('price', 'my_share_price') and val is not None:
                val = float(val) if str(val).strip() != '' else None
            elif key in ('is_trial', 'is_shared'):
                val = 1 if val in (True, 1, '1', 'true') else 0
            elif key == 'shared_with_count':
                val = int(val or 1)
            elif isinstance(val, str):
                val = val.strip()
            fields.append(f"{key} = ?")
            values.append(val)

    if not fields:
        conn.close()
        return get_subscription_by_id(sub_id, user_id=user_id, db_path=db_path)

    fields.append("updated_at = ?")
    values.append(now_str)
    values.append(sub_id)

    query = f"UPDATE subscriptions SET {', '.join(fields)} WHERE id = ?"
    if user_id:
        query += " AND (user_id = ? OR user_id IS NULL)"
        values.append(user_id)

    cursor.execute(query, values)
    conn.commit()
    conn.close()
    return get_subscription_by_id(sub_id, user_id=user_id, db_path=db_path)

def delete_subscription(sub_id: int, user_id=None, db_path=None):
    """Elimina una suscripción por ID."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    if user_id:
        cursor.execute("DELETE FROM subscriptions WHERE id = ? AND (user_id = ? OR user_id IS NULL)", (sub_id, user_id))
    else:
        cursor.execute("DELETE FROM subscriptions WHERE id = ?", (sub_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

# ================= HISTORIAL DE PAGOS =================
def record_payment(sub_id: int, amount: float, currency='USD', payment_date=None, payment_method='Tarjeta', notes='', user_id=1, db_path=None):
    """Registra un pago en el historial."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    sub = get_subscription_by_id(sub_id, user_id=user_id, db_path=db_path)
    sub_name = sub['name'] if sub else 'Suscripción'

    now_str = datetime.now().isoformat()
    pay_date = payment_date or date.today().isoformat()

    cursor.execute('''
        INSERT INTO payment_history (
            user_id, subscription_id, subscription_name, amount, currency,
            payment_date, payment_method, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        user_id,
        sub_id,
        sub_name,
        float(amount),
        currency,
        pay_date,
        payment_method,
        notes.strip(),
        now_str
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        'id': new_id,
        'user_id': user_id,
        'subscription_id': sub_id,
        'subscription_name': sub_name,
        'amount': float(amount),
        'currency': currency,
        'payment_date': pay_date,
        'payment_method': payment_method,
        'notes': notes.strip(),
        'created_at': now_str
    }

def get_payment_history(user_id=1, sub_id=None, limit=100, db_path=None):
    """Obtiene el historial de pagos del usuario."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    if sub_id:
        cursor.execute("SELECT * FROM payment_history WHERE (user_id = ? OR user_id IS NULL) AND subscription_id = ? ORDER BY payment_date DESC, id DESC LIMIT ?", (user_id, sub_id, limit))
    else:
        cursor.execute("SELECT * FROM payment_history WHERE (user_id = ? OR user_id IS NULL) ORDER BY payment_date DESC, id DESC LIMIT ?", (user_id, limit))

    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ================= CONFIGURACIONES =================
def get_settings(user_id=1, db_path=None):
    """Obtiene todos los ajustes del usuario."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM settings WHERE user_id = ? OR user_id = 1", (user_id,))
    rows = cursor.fetchall()
    conn.close()

    result = {}
    for r in rows:
        key = r['key']
        val = r['value']
        if key == 'exchange_rates':
            try:
                rates = json.loads(val)
                for curr, rate in DEFAULT_EXCHANGE_RATES.items():
                    if curr not in rates:
                        rates[curr] = rate
                result[key] = rates
            except Exception:
                result[key] = dict(DEFAULT_EXCHANGE_RATES)
        elif key == 'monthly_budget':
            try:
                result[key] = float(val)
            except Exception:
                result[key] = 150.0
        else:
            result[key] = val
    return result

def update_settings(data: dict, user_id=1, db_path=None):
    """Actualiza uno o varios ajustes del usuario."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    for k, v in data.items():
        if k == 'exchange_rates' and isinstance(v, dict):
            val_str = json.dumps(v)
        else:
            val_str = str(v)
        cursor.execute("INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, ?, ?)", (user_id, k, val_str))

    conn.commit()
    conn.close()
    return get_settings(user_id=user_id, db_path=db_path)

# ================= ESTADÍSTICAS ANALÍTICAS =================
def get_stats(user_id=1, db_path=None):
    """
    Calcula estadísticas analíticas del usuario:
    - Costos mensual y anual
    - Estado de presupuesto mensual
    - Desglose por categoría
    - Alertas de pruebas gratuitas próximas a vencer
    - Próximos cobros en 7 y 30 días
    - Sugerencia de ahorro anual por pago adelantado
    - Resumen de suscripciones compartidas
    """
    subs = get_all_subscriptions(user_id=user_id, db_path=db_path)
    settings = get_settings(user_id=user_id, db_path=db_path)
    rates = settings.get('exchange_rates', DEFAULT_EXCHANGE_RATES)
    base_currency = settings.get('base_currency', 'USD')
    monthly_budget = float(settings.get('monthly_budget', 150.0))

    active_subs = [s for s in subs if s['status'] == 'active']
    paused_subs = [s for s in subs if s['status'] == 'paused']
    canceled_subs = [s for s in subs if s['status'] == 'canceled']

    total_monthly = 0.0
    total_annual = 0.0
    potential_annual_savings = 0.0
    total_shared_savings = 0.0

    category_data = {}
    upcoming_7_days = []
    upcoming_30_days = []
    trials_expiring_soon = []

    for s in active_subs:
        m_cost_converted = convert_currency(s['monthly_cost'], s.get('currency', 'USD'), base_currency, rates)
        a_cost_converted = convert_currency(s['annual_cost'], s.get('currency', 'USD'), base_currency, rates)

        total_monthly += m_cost_converted
        total_annual += a_cost_converted

        if s['billing_cycle'] == 'monthly':
            potential_annual_savings += a_cost_converted * 0.15

        if s.get('is_shared'):
            raw_annual_converted = convert_currency(s.get('total_annual_raw', s['annual_cost']), s.get('currency', 'USD'), base_currency, rates)
            total_shared_savings += max(0.0, raw_annual_converted - a_cost_converted)

        cat = s['category'] or 'Otros'
        if cat not in category_data:
            category_data[cat] = {
                'category': cat,
                'monthly_cost': 0.0,
                'annual_cost': 0.0,
                'count': 0
            }
        category_data[cat]['monthly_cost'] += m_cost_converted
        category_data[cat]['annual_cost'] += a_cost_converted
        category_data[cat]['count'] += 1

        days = s.get('days_until_billing')
        if days is not None and days >= 0:
            if days <= 7:
                upcoming_7_days.append(s)
            if days <= 30:
                upcoming_30_days.append(s)

        if s.get('is_trial'):
            t_days = s.get('days_until_trial_end')
            if t_days is not None and t_days <= 7:
                trials_expiring_soon.append(s)

    for cat_item in category_data.values():
        cat_item['monthly_cost'] = round(cat_item['monthly_cost'], 2)
        cat_item['annual_cost'] = round(cat_item['annual_cost'], 2)
        cat_item['percentage'] = round((cat_item['annual_cost'] / total_annual * 100) if total_annual > 0 else 0, 1)

    categories_list = sorted(list(category_data.values()), key=lambda x: x['annual_cost'], reverse=True)
    upcoming_7_days.sort(key=lambda x: x['days_until_billing'])
    upcoming_30_days.sort(key=lambda x: x['days_until_billing'])
    trials_expiring_soon.sort(key=lambda x: (x['days_until_trial_end'] if x['days_until_trial_end'] is not None else 999))

    budget_used_percentage = round((total_monthly / monthly_budget * 100) if monthly_budget > 0 else 0, 1)
    budget_remaining = round(monthly_budget - total_monthly, 2)
    budget_status = 'ok'
    if budget_used_percentage >= 100:
        budget_status = 'danger'
    elif budget_used_percentage >= 80:
        budget_status = 'warning'

    top_expensive = sorted(active_subs, key=lambda x: x.get('converted_annual_cost', x['annual_cost']), reverse=True)[:5]
    most_expensive = top_expensive[0] if top_expensive else None
    recent_payments = get_payment_history(user_id=user_id, limit=5, db_path=db_path)

    return {
        'total_subscriptions': len(subs),
        'active_count': len(active_subs),
        'paused_count': len(paused_subs),
        'canceled_count': len(canceled_subs),
        'base_currency': base_currency,
        'total_monthly_cost': round(total_monthly, 2),
        'total_annual_cost': round(total_annual, 2),
        'monthly_budget': monthly_budget,
        'budget_used_percentage': budget_used_percentage,
        'budget_remaining': budget_remaining,
        'budget_status': budget_status,
        'potential_annual_savings': round(potential_annual_savings, 2),
        'total_shared_savings': round(total_shared_savings, 2),
        'categories': categories_list,
        'upcoming_7_days': upcoming_7_days,
        'upcoming_30_days': upcoming_30_days,
        'trials_expiring_soon': trials_expiring_soon,
        'most_expensive': most_expensive,
        'top_expensive': top_expensive,
        'recent_payments': recent_payments
    }

# ================= GENERADOR ICALENDAR =================
def generate_ics_calendar(user_id=1, db_path=None):
    """Genera el contenido RFC 5545 para exportar a calendarios."""
    subs = get_all_subscriptions(user_id=user_id, db_path=db_path)
    now_stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//SubTracker//Gestor de Suscripciones//ES",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Suscripciones SubTracker",
        "X-WR-TIMEZONE:UTC",
        "X-WR-CALDESC:Fechas de corte y cobro de suscripciones recurrentes"
    ]

    freq_map = {
        'weekly': 'WEEKLY',
        'monthly': 'MONTHLY',
        'quarterly': 'MONTHLY;INTERVAL=3',
        'biannual': 'MONTHLY;INTERVAL=6',
        'annual': 'YEARLY'
    }

    for sub in subs:
        if sub['status'] == 'canceled':
            continue

        try:
            b_date = datetime.strptime(sub['next_billing_date'], '%Y-%m-%d').date()
            dtstart = b_date.strftime('%Y%m%d')
        except Exception:
            continue

        uid = f"sub-{sub['id']}-billing@subtracker.local"
        rrule_freq = freq_map.get(sub.get('billing_cycle', 'monthly'), 'MONTHLY')
        summary = f"Cobro: {sub['name']} ({sub['currency']} {sub['price']:.2f})"
        description = f"Suscripción recurrente a {sub['name']}.\\nPrecio: {sub['currency']} {sub['price']}\\nCiclo: {sub['billing_cycle']}"

        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{now_stamp}",
            f"DTSTART;VALUE=DATE:{dtstart}",
            f"SUMMARY:{summary}",
            f"DESCRIPTION:{description}",
            f"RRULE:FREQ={rrule_freq}",
            "STATUS:CONFIRMED",
            "TRANSP:TRANSPARENT",
            "END:VEVENT"
        ])

        if sub.get('is_trial') and sub.get('trial_end_date'):
            try:
                t_date = datetime.strptime(sub['trial_end_date'], '%Y-%m-%d').date()
                t_dtstart = t_date.strftime('%Y%m%d')
                trial_uid = f"sub-{sub['id']}-trial-alert@subtracker.local"
                lines.extend([
                    "BEGIN:VEVENT",
                    f"UID:{trial_uid}",
                    f"DTSTAMP:{now_stamp}",
                    f"DTSTART;VALUE=DATE:{t_dtstart}",
                    f"SUMMARY:⚠️ CANCELAR PRUEBA: {sub['name']}",
                    f"DESCRIPTION:Último día para cancelar la prueba gratuita de {sub['name']}.",
                    "PRIORITY:1",
                    "STATUS:CONFIRMED",
                    "TRANSP:OPAQUE",
                    "END:VEVENT"
                ])
            except Exception:
                pass

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)

# ================= DATOS DE DEMOSTRACIÓN =================
def seed_demo_data(user_id=1, db_path=None):
    """Siembra datos iniciales vinculados al usuario."""
    init_db(db_path)
    current = get_all_subscriptions(user_id=user_id, db_path=db_path)
    if current:
        return

    today = date.today()
    demo_subs = [
        {
            'name': 'Netflix Familiar',
            'price': 22.99,
            'currency': 'USD',
            'billing_cycle': 'monthly',
            'next_billing_date': (today + timedelta(days=2)).isoformat(),
            'category': 'Streaming',
            'payment_method': 'Tarjeta de Crédito',
            'status': 'active',
            'notes': 'Plan 4K compartido con familia (4 personas)',
            'url': 'https://netflix.com/account',
            'icon': 'tv',
            'color': '#E50914',
            'is_shared': 1,
            'shared_with_count': 4,
            'my_share_price': 5.75,
            'shared_friend_ids': '1'
        },
        {
            'name': 'Spotify Dúo',
            'price': 14.99,
            'currency': 'USD',
            'billing_cycle': 'monthly',
            'next_billing_date': (today + timedelta(days=5)).isoformat(),
            'category': 'Streaming',
            'payment_method': 'PayPal',
            'status': 'active',
            'notes': 'Plan para 2 cuentas premium',
            'url': 'https://spotify.com/account',
            'icon': 'music',
            'color': '#1DB954',
            'is_shared': 1,
            'shared_with_count': 2,
            'my_share_price': 7.50,
            'shared_friend_ids': '2'
        },
        {
            'name': 'Amazon Prime',
            'price': 139.00,
            'currency': 'USD',
            'billing_cycle': 'annual',
            'next_billing_date': (today + timedelta(days=45)).isoformat(),
            'category': 'Servicios',
            'payment_method': 'Tarjeta de Crédito',
            'status': 'active',
            'notes': 'Envíos gratis y Prime Video anual',
            'url': 'https://amazon.com',
            'icon': 'shopping-bag',
            'color': '#FF9900'
        },
        {
            'name': 'ChatGPT Plus',
            'price': 20.00,
            'currency': 'USD',
            'billing_cycle': 'monthly',
            'next_billing_date': (today + timedelta(days=12)).isoformat(),
            'category': 'Software',
            'payment_method': 'Tarjeta de Crédito',
            'status': 'active',
            'notes': 'Acceso a GPT-4o y herramientas de IA',
            'url': 'https://chatgpt.com',
            'icon': 'bot',
            'color': '#10A37F'
        },
        {
            'name': 'YouTube Premium Trial',
            'price': 13.99,
            'currency': 'USD',
            'billing_cycle': 'monthly',
            'next_billing_date': (today + timedelta(days=4)).isoformat(),
            'category': 'Streaming',
            'payment_method': 'Tarjeta de Crédito',
            'status': 'active',
            'notes': 'Prueba gratuita (¡Cancelar antes de fecha límite!)',
            'url': 'https://youtube.com/paid_memberships',
            'icon': 'play-circle',
            'color': '#FF0000',
            'is_trial': 1,
            'trial_end_date': (today + timedelta(days=3)).isoformat()
        },
        {
            'name': 'Gimnasio Smart Fit',
            'price': 34.90,
            'currency': 'USD',
            'billing_cycle': 'monthly',
            'next_billing_date': (today + timedelta(days=1)).isoformat(),
            'category': 'Salud & Fitness',
            'payment_method': 'Tarjeta de Débito',
            'status': 'active',
            'notes': 'Plan Black con acceso a todas las sedes',
            'url': '',
            'icon': 'activity',
            'color': '#EAB308'
        }
    ]

    for sub in demo_subs:
        created = create_subscription(sub, user_id=user_id, db_path=db_path)
        record_payment(
            sub_id=created['id'],
            amount=created['price'],
            currency=created['currency'],
            payment_date=(today - timedelta(days=28)).isoformat(),
            payment_method=created.get('payment_method', 'Tarjeta'),
            notes='Pago anterior registrado',
            user_id=user_id,
            db_path=db_path
        )
