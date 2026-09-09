#!/usr/bin/env python3
"""
Punto de entrada principal para el Gestor de Suscripciones.
Inicia el servidor web en http://localhost:8000
"""
import sys
import os

# Asegurar que el directorio raíz esté en sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.server import run_server

if __name__ == '__main__':
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    elif 'PORT' in os.environ:
        try:
            port = int(os.environ['PORT'])
        except ValueError:
            pass

    run_server(host='0.0.0.0', port=port)
