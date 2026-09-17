# Stage 1: Build the React frontend (Vite 8 and the test tooling need Node 22.12+)
FROM node:24-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Python backend + frontend static files
FROM python:3.12-slim
WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Copy frontend build output into static/
COPY --from=frontend-build /frontend/dist ./static

# Railway injects PORT at runtime — shell form expands $PORT
# --proxy-headers: behind Railway's proxy, take the client address (used by rate limits) and the
# https scheme (used for HSTS) from the X-Forwarded-* headers. Railway only reaches the container
# through its proxy, so any forwarding address is trusted.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --forwarded-allow-ips "*"
