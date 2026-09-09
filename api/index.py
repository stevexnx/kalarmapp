import os
import sys

# Asegurar que la raíz del proyecto esté en sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend import db
from backend.server import SubscriptionAPIHandler

# Inicializar DB
try:
    db.init_db()
    db.seed_demo_data()
except Exception:
    pass

# Clase handler requerida por Vercel Serverless Functions
class handler(SubscriptionAPIHandler):
    pass
