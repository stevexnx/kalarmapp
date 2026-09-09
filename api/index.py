import os
import sys
from http.server import BaseHTTPRequestHandler

# Asegurar que el directorio raíz del proyecto esté en sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend import db
from backend.server import SubscriptionAPIHandler

# Inicializar DB en /tmp si no está inicializada
try:
    db.init_db()
    db.seed_demo_data()
except Exception as e:
    pass

# handler es la clase que Vercel Serverless Function utiliza
handler = SubscriptionAPIHandler

