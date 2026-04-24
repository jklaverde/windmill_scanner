# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
# Empty base URL → frontend uses same origin; nginx proxies API calls to uvicorn
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ── Stage 2: Runtime image ───────────────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# nginx + supervisor (multi-process manager)
RUN apt-get update \
 && apt-get install -y --no-install-recommends nginx supervisor \
 && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Backend source
COPY backend/ .

# Frontend static files (served by nginx)
COPY --from=frontend-builder /frontend/dist /app/static

# Web server + process manager configuration
COPY deploy/nginx.conf        /etc/nginx/conf.d/default.conf
COPY deploy/supervisord.conf  /etc/supervisor/conf.d/supervisord.conf

# Remove the default nginx site that would conflict on port 80
RUN rm -f /etc/nginx/sites-enabled/default

# Startup script (runs migrations, then launches supervisor)
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Ensure the data directory exists (volume is mounted here at runtime)
RUN mkdir -p /app/data/parquet

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
