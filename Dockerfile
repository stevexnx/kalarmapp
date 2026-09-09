# Dockerfile ligero y optimizado para SubTracker
FROM python:3.11-alpine

LABEL maintainer="SubTracker"
LABEL description="Gestor inteligente de suscripciones y control de costos"

WORKDIR /app

# Crear usuario sin privilegios por seguridad
RUN adduser -D -u 1000 appuser

# Copiar archivos del proyecto
COPY --chown=appuser:appuser . /app/

# Exponer el puerto del servidor HTTP
EXPOSE 8000

USER appuser

# Variables de entorno por defecto
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

CMD ["python3", "app.py"]

