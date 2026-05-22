FROM python:3.12-slim

WORKDIR /app

# System deps for Pillow + cryptography. asyncpg ships a pre-built wheel for
# python:3.12-slim so no libpq-dev is required at build time.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (layer cached unless requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app source
COPY app/ ./app/

# Non-root user for security
RUN useradd -m appuser && chown -R appuser /app
USER appuser

# Runtime archive dir (only used when RETENTION_ENABLED=true and the host
# has persistent storage mounted at /app/archives — Render free-tier
# deployments set RETENTION_ENABLED=false instead).
RUN mkdir -p archives

EXPOSE 8010

# Honour $PORT when set (Render / Heroku / Fly), default 8010 for local Compose.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8010}"]
