# Stream Control

A local-first video streaming platform prototype with a Python backend, HLS encoding, signed playback URLs, and domain allow/block rules.

## Stack

- React + Vite English admin UI
- FastAPI backend
- PostgreSQL database
- Redis + Celery encoding worker
- FFmpeg HLS output
- Nginx reverse proxy
- Docker Compose for local and Linux VPS usage

## Run Locally

### With Docker

```bash
docker compose up --build
```

Open:

```text
http://localhost:8080
```

Default login:

```text
admin@example.com
admin12345
```

### Without Docker

Install these first:

- Python 3.11+
- Node.js 20+
- FFmpeg available in your terminal as `ffmpeg`

Create a Python environment and install the API:

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -e .
```

Use the native local env file:

```bash
copy .env.example .env
```

Start the API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In a second terminal, start the web UI:

```bash
cd apps/web
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## What Works

- Admin login
- Video upload
- Background FFmpeg encoding to HLS
- Video list and status tracking
- HLS preview with `hls.js`
- Signed playback URL generation
- Referrer/origin based domain allowlist and blocklist

## VPS Notes

Before deploying, change these values in `.env`:

```text
JWT_SECRET
ADMIN_EMAIL
ADMIN_PASSWORD
PUBLIC_BASE_URL
CORS_ORIGINS
```

On a Linux VPS, install Docker and Docker Compose, copy the project, update `.env`, then run:

```bash
docker compose up -d --build
```

For production, put TLS in front of Nginx with a real domain and certificates.
