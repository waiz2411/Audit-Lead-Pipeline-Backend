# Multi-stage Dockerfile for Audit Lead Pipeline (Playwright + FastAPI + React)

# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python FastAPI runtime with preinstalled Playwright Chromium dependencies
FROM mcr.microsoft.com/playwright/python:v1.44.0-jammy

ENV PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install Python requirements
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy Backend codebase
COPY backend /app/backend

# Copy Built Frontend dist assets
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 8000

# Start Uvicorn web server
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
