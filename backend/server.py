"""
Servidor HTTP RESTful, autenticación, amigos, soporte PWA y calendario para SubTracker Pro.
"""
import http.server
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, date

from . import db

PUBLIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public')

class SubscriptionAPIHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        if 'directory' not in kwargs:
            kwargs['directory'] = PUBLIC_DIR
        super().__init__(*args, **kwargs)

    def guess_type(self, path):
        if path.endswith('.json') or path.endswith('.webmanifest'):
            return 'application/manifest+json'
        elif path.endswith('.js'):
            return 'application/javascript'
        elif path.endswith('.css'):
            return 'text/css'
        elif path.endswith('.svg'):
            return 'image/svg+xml'
        return super().guess_type(path)

    def _set_headers(self, status=200, content_type='application/json'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
        self.end_headers()

    def do_OPTIONS(self):
        """Manejo de preflight CORS."""
        self._set_headers(204)

    def _send_json(self, data, status=200):
        self._set_headers(status, 'application/json')
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def _send_error(self, message, status=400):
        self._send_json({'error': message, 'success': False}, status=status)

    def _read_json_body(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                return {}
            raw_body = self.rfile.read(content_length).decode('utf-8')
            return json.loads(raw_body)
        except Exception:
            return None

    def _get_auth_token(self):
        auth_header = self.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            return auth_header[7:].strip()
        token = self.headers.get('X-Auth-Token')
        if token:
            return token.strip()
        # Cookie fallback
        cookie_header = self.headers.get('Cookie', '')
        for c in cookie_header.split(';'):
            if '=' in c:
                k, v = c.strip().split('=', 1)
                if k == 'session':
                    return v.strip()
        return None

    def _get_current_user(self, required=False):
        token = self._get_auth_token()
        user = db.get_user_by_session(token) if token else None
        return user

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        # Verificación global de autenticación para endpoints protegidos
        if path.startswith('/api/') and path not in ['/api/auth/me']:
            if not self._get_current_user():
                self._send_error('No autorizado', status=401)
                return

        # 1. API: Usuario Actual (Auth Me)
        if path == '/api/auth/me':
            token = self._get_auth_token()
            user = db.get_user_by_session(token) if token else None
            if user:
                self._send_json({'success': True, 'authenticated': True, 'user': user})
            else:
                self._send_json({'success': False, 'authenticated': False, 'user': None}, status=401)
            return

        # 2. API: Lista de Amigos
        elif path == '/api/friends':
            user = self._get_current_user()
            friends = db.get_friends(user_id=user['id'])
            self._send_json({'success': True, 'data': friends})
            return

        # 2.1 API: Buscar usuarios en la red
        elif path == '/api/users/search':
            user = self._get_current_user()
            q = query_params.get('q', [''])[0]
            users = db.search_users(query=q, current_user_id=user['id']) if q else []
            self._send_json({'success': True, 'data': users})
            return

        # 2.2 API: Solicitudes de amistad recibidas y enviadas
        elif path == '/api/friends/requests':
            user = self._get_current_user()
            reqs = db.get_friend_requests(user_id=user['id'])
            self._send_json({'success': True, 'data': reqs})
            return

        # 2.3 API: Solicitudes de pago en conjunto
        elif path == '/api/friends/split-requests':
            user = self._get_current_user()
            split_reqs = db.get_split_pay_requests(user_id=user['id'])
            self._send_json({'success': True, 'data': split_reqs})
            return

        # 2.4 API: Suscripciones en común con un amigo
        elif path == '/api/friends/shared-subs':
            user = self._get_current_user()
            friend_id = query_params.get('friend_id', [None])[0]
            if not friend_id:
                self._send_error('friend_id requerido')
                return
            shared_subs = db.get_shared_subscriptions_with_friend(user_id=user['id'], friend_id=int(friend_id))
            self._send_json({'success': True, 'data': shared_subs})
            return

        # 3. API: Saldos y Deudas de Amigos
        elif path == '/api/friends/balances':
            user = self._get_current_user()
            balances = db.get_friend_balances(user_id=user['id'])
            self._send_json({'success': True, 'data': balances})
            return

        # 4. API: Suscripciones
        elif path == '/api/subscriptions':
            user = self._get_current_user()
            search = query_params.get('search', [None])[0]
            category = query_params.get('category', [None])[0]
            status = query_params.get('status', [None])[0]
            sort_by = query_params.get('sort_by', [None])[0]
            subs = db.get_all_subscriptions(user_id=user['id'], search=search, category=category, status=status, sort_by=sort_by)
            self._send_json({'success': True, 'data': subs})
            return

        elif path.startswith('/api/subscriptions/'):
            user = self._get_current_user()
            sub_id_str = path.split('/')[-1]
            try:
                sub_id = int(sub_id_str)
                sub = db.get_subscription_by_id(sub_id, user_id=user['id'])
                if not sub:
                    self._send_error('Suscripción no encontrada', 404)
                else:
                    self._send_json({'success': True, 'data': sub})
            except ValueError:
                self._send_error('ID de suscripción inválido', 400)
            return

        # 5. API: Estadísticas y KPIs
        elif path == '/api/stats':
            user = self._get_current_user()
            stats = db.get_stats(user_id=user['id'])
            self._send_json({'success': True, 'data': stats})
            return

        # 6. API: Historial de pagos
        elif path == '/api/payments':
            user = self._get_current_user()
            sub_id = query_params.get('sub_id', [None])[0]
            limit = int(query_params.get('limit', [100])[0])
            payments = db.get_payment_history(user_id=user['id'], sub_id=int(sub_id) if sub_id else None, limit=limit)
            self._send_json({'success': True, 'data': payments})
            return

        # 7. API: Ajustes y configuraciones
        elif path == '/api/settings':
            user = self._get_current_user()
            settings = db.get_settings(user_id=user['id'])
            self._send_json({'success': True, 'data': settings})
            return

        # 8. API: Exportar calendario iCalendar (.ics)
        elif path == '/api/calendar.ics':
            user = self._get_current_user()
            ics_content = db.generate_ics_calendar(user_id=user['id'])
            self.send_response(200)
            self.send_header('Content-Type', 'text/calendar; charset=utf-8')
            self.send_header('Content-Disposition', 'attachment; filename="suscripciones.ics"')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(ics_content.encode('utf-8'))
            return

        # 9. API: Exportar JSON
        elif path == '/api/export':
            user = self._get_current_user()
            subs = db.get_all_subscriptions(user_id=user['id'])
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Disposition', 'attachment; filename="subscriptions_backup.json"')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(subs, indent=2, ensure_ascii=False).encode('utf-8'))
            return

        # Archivos estáticos
        if path == '/' or path == '':
            self.path = '/index.html'
        return super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        # Verificación global de autenticación para endpoints protegidos
        if path.startswith('/api/') and path not in ['/api/auth/register', '/api/auth/login']:
            if not self._get_current_user():
                self._send_error('No autorizado', status=401)
                return

        # 1. Registro de Usuario
        if path == '/api/auth/register':
            data = self._read_json_body() or {}
            username = data.get('username', '').strip()
            password = data.get('password', '')
            email = data.get('email', '').strip()
            display_name = data.get('display_name', '').strip()

            try:
                user = db.register_user(username, password, email=email, display_name=display_name)
                token = db.create_session(user['id'])
                self._send_json({
                    'success': True,
                    'token': token,
                    'user': user,
                    'message': 'Registro exitoso'
                }, 201)
            except ValueError as e:
                self._send_error(str(e), 400)
            return

        # 2. Inicio de Sesión (Login)
        elif path == '/api/auth/login':
            try:
                data = self._read_json_body() or {}
                username = data.get('username', '').strip()
                password = data.get('password', '')

                user = db.authenticate_user(username, password)
                if not user:
                    self._send_error('Usuario o contraseña incorrectos', 401)
                    return

                token = db.create_session(user['id'])
                self._send_json({
                    'success': True,
                    'token': token,
                    'user': user,
                    'message': 'Inicio de sesión correcto'
                })
            except Exception as e:
                self._send_error(f'Error interno del servidor: {str(e)}', 500)
            return

        # 3. Cierre de Sesión (Logout)
        elif path == '/api/auth/logout':
            token = self._get_auth_token()
            if token:
                db.delete_session(token)
            self._send_json({'success': True, 'message': 'Sesión cerrada'})
            return

        # 4. Crear Amigo
        elif path == '/api/friends':
            user = self._get_current_user()
            data = self._read_json_body() or {}
            try:
                friend = db.create_friend(user['id'], data)
                self._send_json({'success': True, 'data': friend, 'message': 'Amigo agregado'}, 201)
            except ValueError as e:
                self._send_error(str(e), 400)
            return

        # 4.1 Enviar Solicitud de Amistad
        elif path == '/api/friends/request':
            user = self._get_current_user()
            data = self._read_json_body() or {}
            target = data.get('receiver') or data.get('username') or data.get('user_id')
            if not target:
                self._send_error('El usuario o ID es obligatorio')
                return
            try:
                req = db.send_friend_request(sender_id=user['id'], receiver_username_or_id=target)
                self._send_json({'success': True, 'data': req, 'message': 'Solicitud enviada con éxito'}, 201)
            except ValueError as e:
                self._send_error(str(e), 400)
            return

        # 4.2 Responder Solicitud de Amistad (Aceptar / Rechazar)
        elif path == '/api/friends/respond-request':
            user = self._get_current_user()
            data = self._read_json_body() or {}
            request_id = data.get('request_id')
            action = data.get('action', 'accept')
            if not request_id:
                self._send_error('request_id es obligatorio')
                return
            try:
                res = db.respond_friend_request(request_id=int(request_id), user_id=user['id'], action=action)
                msg = 'Solicitud aceptada' if action == 'accept' else 'Solicitud rechazada'
                self._send_json({'success': True, 'data': res, 'message': msg})
            except ValueError as e:
                self._send_error(str(e), 400)
            return

        # 4.3 Solicitar Pagar en Conjunto (Split Pay Request)
        elif path == '/api/friends/split-request':
            user = self._get_current_user()
            data = self._read_json_body() or {}
            try:
                split_req = db.create_split_pay_request(creator_id=user['id'], data=data)
                self._send_json({'success': True, 'data': split_req, 'message': 'Solicitud de pago enviada a tu amigo'}, 201)
            except ValueError as e:
                self._send_error(str(e), 400)
            return

        # 4.4 Responder Solicitud de Pago Conjunto (Marcar como Pagada / Rechazar)
        elif path == '/api/friends/split-requests/respond':
            user = self._get_current_user()
            data = self._read_json_body() or {}
            request_id = data.get('request_id')
            action = data.get('action', 'paid')
            if not request_id:
                self._send_error('request_id es obligatorio')
                return
            try:
                res = db.respond_split_pay_request(request_id=int(request_id), user_id=user['id'], action=action)
                msg = 'Pago confirmado' if action in ('paid', 'pay', 'accept') else 'Solicitud declinada'
                self._send_json({'success': True, 'data': res, 'message': msg})
            except ValueError as e:
                self._send_error(str(e), 400)
            return

        # 5. Registrar Reembolso de Amigo
        elif path == '/api/friends/record-payment':
            user = self._get_current_user()
            data = self._read_json_body() or {}
            friend_id = data.get('friend_id')
            amount = data.get('amount')
            if not friend_id or amount is None:
                self._send_error('friend_id y amount son obligatorios')
                return

            res = db.record_friend_payment(
                user_id=user['id'],
                friend_id=int(friend_id),
                amount=float(amount),
                subscription_id=data.get('subscription_id'),
                payment_date=data.get('payment_date'),
                notes=data.get('notes', '')
            )
            self._send_json({'success': True, 'data': res, 'message': 'Pago de amigo registrado'})
            return

        # 6. Crear Suscripción
        elif path == '/api/subscriptions':
            user = self._get_current_user()
            data = self._read_json_body()
            if data is None:
                self._send_error('JSON inválido en la solicitud')
                return
            
            name = data.get('name', '').strip()
            if not name:
                self._send_error('El nombre de la suscripción es obligatorio')
                return
            
            try:
                price = float(data.get('price', 0))
                if price < 0:
                    self._send_error('El precio no puede ser negativo')
                    return
            except (ValueError, TypeError):
                self._send_error('El precio debe ser un número válido')
                return

            sub = db.create_subscription(data, user_id=user['id'])
            self._send_json({'success': True, 'data': sub, 'message': 'Suscripción creada exitosamente'}, 201)
            return

        # 7. Registrar Pago en el Historial
        elif path == '/api/payments':
            user = self._get_current_user()
            data = self._read_json_body()
            if not data or not data.get('subscription_id'):
                self._send_error('El subscription_id es obligatorio')
                return

            sub_id = int(data['subscription_id'])
            sub = db.get_subscription_by_id(sub_id, user_id=user['id'])
            if not sub:
                self._send_error('Suscripción no encontrada', 404)
                return

            amount = float(data.get('amount', sub['price']))
            currency = data.get('currency', sub['currency'])
            pay_date = data.get('payment_date') or date.today().isoformat()
            pay_method = data.get('payment_method', sub.get('payment_method', 'Tarjeta'))
            notes = data.get('notes', '')

            payment = db.record_payment(
                sub_id=sub_id,
                amount=amount,
                currency=currency,
                payment_date=pay_date,
                payment_method=pay_method,
                notes=notes,
                user_id=user['id']
            )

            if data.get('advance_date'):
                current = datetime.strptime(sub['next_billing_date'], '%Y-%m-%d').date()
                cycle = sub['billing_cycle']
                if cycle == 'weekly':
                    next_d = date.fromordinal(current.toordinal() + 7)
                elif cycle == 'monthly':
                    year = current.year + (current.month // 12)
                    month = (current.month % 12) + 1
                    day = min(current.day, 28)
                    next_d = date(year, month, day)
                elif cycle == 'quarterly':
                    year = current.year + ((current.month + 2) // 12)
                    month = ((current.month + 2) % 12) + 1
                    day = min(current.day, 28)
                    next_d = date(year, month, day)
                elif cycle == 'biannual':
                    year = current.year + ((current.month + 5) // 12)
                    month = ((current.month + 5) % 12) + 1
                    day = min(current.day, 28)
                    next_d = date(year, month, day)
                elif cycle == 'annual':
                    next_d = date(current.year + 1, current.month, current.day)
                else:
                    year = current.year + (current.month // 12)
                    month = (current.month % 12) + 1
                    next_d = date(year, month, min(current.day, 28))

                db.update_subscription(sub_id, {'next_billing_date': next_d.isoformat()}, user_id=user['id'])

            self._send_json({'success': True, 'data': payment, 'message': 'Pago registrado exitosamente'}, 201)
            return

        # 8. Webhook Test
        elif path == '/api/notifications/test':
            data = self._read_json_body() or {}
            webhook_url = data.get('webhook_url', '').strip()
            if not webhook_url:
                self._send_error('Debes proporcionar una URL de Webhook')
                return

            payload = {
                "content": "🔔 **SubTracker Pro**: ¡Prueba de notificación exitosa! Tu sistema de alertas de suscripciones está activo."
            }
            try:
                req = urllib.request.Request(
                    webhook_url,
                    data=json.dumps(payload).encode('utf-8'),
                    headers={'Content-Type': 'application/json', 'User-Agent': 'SubTracker/2.0'},
                    method='POST'
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    status_code = resp.status
                self._send_json({'success': True, 'message': f'Notificación enviada (código {status_code})'})
            except Exception as e:
                self._send_error(f'Error enviando notificación: {str(e)}')
            return

        # 9. Importar suscripciones JSON
        elif path == '/api/import':
            user = self._get_current_user()
            data = self._read_json_body()
            if not isinstance(data, list):
                self._send_error('El archivo debe ser una lista de suscripciones')
                return

            imported_count = 0
            for item in data:
                if isinstance(item, dict) and item.get('name'):
                    db.create_subscription(item, user_id=user['id'])
                    imported_count += 1

            self._send_json({'success': True, 'imported_count': imported_count, 'message': f'{imported_count} suscripciones importadas'})
            return

        # 10. Restablecer datos demo
        elif path == '/api/reset':
            user = self._get_current_user()
            conn = db.get_connection()
            conn.cursor().execute("DELETE FROM payment_history WHERE user_id = ?", (user['id'],))
            conn.cursor().execute("DELETE FROM subscriptions WHERE user_id = ?", (user['id'],))
            conn.commit()
            conn.close()
            db.seed_demo_data(user_id=user['id'])
            self._send_json({'success': True, 'message': 'Datos restablecidos a la versión de demostración'})
            return

        self._send_error('Ruta no encontrada', 404)

    def do_PUT(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        # Verificación global de autenticación para endpoints protegidos
        if path.startswith('/api/'):
            if not self._get_current_user():
                self._send_error('No autorizado', status=401)
                return

        # 1. Actualizar Ajustes
        if path == '/api/settings':
            user = self._get_current_user()
            data = self._read_json_body()
            if not isinstance(data, dict):
                self._send_error('Datos de configuración inválidos')
                return
            updated = db.update_settings(data, user_id=user['id'])
            self._send_json({'success': True, 'data': updated, 'message': 'Configuración guardada'})
            return

        # 2. Actualizar Amigo
        elif path.startswith('/api/friends/'):
            user = self._get_current_user()
            friend_id_str = path.split('/')[-1]
            try:
                friend_id = int(friend_id_str)
                data = self._read_json_body() or {}
                updated = db.update_friend(friend_id, user['id'], data)
                self._send_json({'success': True, 'data': updated, 'message': 'Amigo actualizado'})
            except ValueError:
                self._send_error('ID de amigo inválido', 400)
            return

        # 3. Actualizar Suscripción
        elif path.startswith('/api/subscriptions/'):
            user = self._get_current_user()
            sub_id_str = path.split('/')[-1]
            try:
                sub_id = int(sub_id_str)
                data = self._read_json_body()
                if data is None:
                    self._send_error('JSON inválido')
                    return

                existing = db.get_subscription_by_id(sub_id, user_id=user['id'])
                if not existing:
                    self._send_error('Suscripción no encontrada', 404)
                    return

                if 'price' in data and data['price'] is not None:
                    try:
                        price = float(data['price'])
                        if price < 0:
                            self._send_error('El precio no puede ser negativo')
                            return
                    except (ValueError, TypeError):
                        self._send_error('El precio debe ser un número válido')
                        return

                updated = db.update_subscription(sub_id, data, user_id=user['id'])
                self._send_json({'success': True, 'data': updated, 'message': 'Suscripción actualizada'})
            except ValueError:
                self._send_error('ID de suscripción inválido', 400)
            return

        self._send_error('Ruta no encontrada', 404)

    def do_DELETE(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        # Verificación global de autenticación para endpoints protegidos
        if path.startswith('/api/'):
            if not self._get_current_user():
                self._send_error('No autorizado', status=401)
                return

        # 1. Eliminar Amigo
        if path.startswith('/api/friends/'):
            user = self._get_current_user()
            friend_id_str = path.split('/')[-1]
            try:
                friend_id = int(friend_id_str)
                deleted = db.delete_friend(friend_id, user['id'])
                if deleted:
                    self._send_json({'success': True, 'message': 'Amigo eliminado'})
                else:
                    self._send_error('Amigo no encontrado', 404)
            except ValueError:
                self._send_error('ID de amigo inválido', 400)
            return

        # 2. Eliminar Suscripción
        elif path.startswith('/api/subscriptions/'):
            user = self._get_current_user()
            sub_id_str = path.split('/')[-1]
            try:
                sub_id = int(sub_id_str)
                deleted = db.delete_subscription(sub_id, user_id=user['id'])
                if deleted:
                    self._send_json({'success': True, 'message': 'Suscripción eliminada'})
                else:
                    self._send_error('Suscripción no encontrada', 404)
            except ValueError:
                self._send_error('ID de suscripción inválido', 400)
            return

        self._send_error('Ruta no encontrada', 404)

def run_server(host='0.0.0.0', port=8000):
    db.init_db()
    db.seed_demo_data()
    server_address = (host, port)
    httpd = http.server.ThreadingHTTPServer(server_address, SubscriptionAPIHandler)
    print(f"🚀 Servidor SubTracker Pro iniciado en http://{host}:{port}")
    print(f"👉 Acceso local: http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        httpd.server_close()
