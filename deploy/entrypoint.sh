#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
cd /app
alembic upgrade head

echo "[entrypoint] Starting services (nginx + uvicorn)..."
exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/supervisord.conf
