# Stage 1: Build the React frontend
FROM node:20-slim AS frontend-build
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

# Railway sets PORT dynamically — default to 8080
ENV PORT=8080
EXPOSE ${PORT}

CMD uvicorn main:app --host 0.0.0.0 --port $PORT
