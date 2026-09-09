# SubTracker Pro - Gestor Inteligente de Suscripciones & Amigos

Aplicación web completa, moderna y ligera para la administración de suscripciones recurrentes, control de fechas de corte con alertas de cobros inminentes, seguimiento de pruebas gratuitas (*Free Trials*), gestión de cuentas compartidas (*Split Cost*), presupuestos mensuales, conversor multidivisa, historial de pagos reales, **sistema de login multiusuario con sesiones seguras** y **módulo de Lista de Amigos con control de cobros y recordatorios por WhatsApp**.

---

## 🚀 Inicio Rápido

### Opción 1: Ejecución directa con Python 3 (Sin dependencias externas)

```bash
cd /home/stemen/kalarm
python3 app.py
```

Abre en tu navegador:
👉 **[http://localhost:8000](http://localhost:8000)**

#### 🔑 Credenciales iniciales por defecto:
- **Usuario**: `admin`
- **Contraseña**: `admin123`
*(También puedes crear cualquier cantidad de cuentas nuevas desde el botón de "Registrarme")*.

---

### Opción 2: Despliegue con Docker y Docker Compose

```bash
docker compose up -d
```

---

## 🌟 Nuevas Funcionalidades: Login y Lista de Amigos

### 1. 🔐 Sistema de Login y Autenticación Segura
- **Registro e Inicio de Sesión**:
  - Hashing criptográfico de contraseñas con `pbkdf2_hmac` y `salt` aleatorio de 16 bytes.
  - Tokens de sesión seguros persistentes en el navegador (`localStorage`) y compatibles con la PWA en el celular.
  - Cuentas privadas: cada usuario tiene su propio panel de suscripciones, presupuesto y amigos.
  - Cierre de sesión seguro con un clic.

### 2. 👥 Lista de Amigos y Cobros de Suscripciones Compartidas
- **Directorio de Amigos / Contactos**:
  - Registra a tus amigos con nombre, teléfono (para WhatsApp), correo, color de avatar y notas.
- **Etiquetado en Suscripciones Compartidas**:
  - Al marcar una suscripción como compartida (ej. Netflix 4K, Spotify Familiar), puedes seleccionar con qué amigos específicos de tu lista la compartes mediante casillas de verificación.
  - El sistema divide automáticamente el costo total entre todos los integrantes y calcula tu cuota real y la de tus amigos.
- **Panel de Deudas y Saldos (*Who Owes What*)**:
  - Muestra exactamente cuánto debe cada amigo al mes por cada servicio compartido.
  - **Botón "Cobrar por WhatsApp"**: Abre un enlace directo a WhatsApp (`https://wa.me/`) con un mensaje cordial y personalizado ya escrito:
    *«Hola Carlos, te escribo para recordarte tu parte de Netflix Familiar de este mes por $5.75. ¡Gracias!»*.
  - **Botón "Saldado"**: Registra que el amigo ya te transfirió su cuota del mes.

---

## 🧪 Pruebas Automatizadas

```bash
python3 -m unittest test_app.py -v
```

---

## 📁 Estructura del Proyecto

```
kalarm/
├── app.py                  # Lanzador del servidor web
├── Dockerfile              # Contenedor Docker Alpine
├── docker-compose.yml      # Despliegue con volumen persistente
├── test_app.py             # Suite de pruebas unitarias
├── README.md               # Documentación en español
├── backend/
│   ├── __init__.py
│   ├── db.py               # SQLite, Auth, Amigos, Finanzas y .ics
│   └── server.py           # Servidor RESTful y enrutador PWA
└── public/
    ├── index.html          # Interfaz SPA con login y amigos
    ├── styles.css          # Estilos y animaciones
    ├── app.js              # Lógica de cliente, reactividad y auth
    ├── manifest.json       # Manifiesto PWA para celular
    ├── sw.js               # Service Worker offline
    └── icon.svg            # Icono vectorial oficial
```
