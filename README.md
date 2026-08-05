# Parent–Teacher Communication and Student Monitoring System

Production system for Nigerian secondary schools. Built incrementally across PPS-001 → PPS-009.

## Architecture

- **Frontend**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + Shadcn-style components — `/frontend`
- **Backend**: FastAPI (Python) + SQLAlchemy + Alembic — `/backend`
- **Database**: PostgreSQL (Supabase in production)
- **File storage**: Cloudinary
- **Auth**: JWT (access + refresh), RBAC with granular permission codes (`module.action`)

## Local Development

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET_KEY, Cloudinary keys
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
python -m app.utils.seed_rbac   # seeds the 9 roles + permissions
uvicorn app.main:app --reload
```
API docs: http://localhost:8000/api/docs

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL
npm run dev
```

### Or with Docker Compose (Postgres + backend only)
```bash
docker compose up --build
```

## Running Tests
```bash
cd backend
pytest -v   # requires DATABASE_URL_SYNC pointed at a real/test Postgres instance
```

## Deployment

### Supabase (Database)
1. Create a new Supabase project.
2. Copy the connection string (use the "Session pooler" URI for `DATABASE_URL_SYNC`, and the pooled/async-friendly one for `DATABASE_URL`).
3. Run `alembic upgrade head` against it once (from your machine or a one-off Railway job) before first deploy.

### Railway (Backend)
1. Create a new Railway project, link this repo, set the root directory to `/backend`.
2. Add environment variables from `backend/.env.example` (real values — Supabase URL, JWT secret, Cloudinary keys).
3. Railway will build from `backend/Dockerfile` automatically. The container runs `alembic upgrade head` on boot before starting Uvicorn.
4. Note the generated public URL — you'll need it for the frontend's `NEXT_PUBLIC_API_URL`.

### Vercel (Frontend)
1. Import this repo into Vercel, set the root directory to `/frontend`.
2. Add environment variable `NEXT_PUBLIC_API_URL` = your Railway backend URL + `/api/v1`.
3. Deploy. Vercel auto-detects Next.js — no extra build config needed.

### Cloudinary
1. Create a free account, grab cloud name / API key / API secret from the dashboard.
2. Add them to the backend's environment variables (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`).

## Environment Variables Reference
See `backend/.env.example` and `frontend/.env.example` for the full list.

## Project Structure
```
backend/
  app/
    api/v1/       # route handlers, one file per module
    models/       # SQLAlchemy models, one file per module
    schemas/      # Pydantic request/response schemas
    core/         # config, security, exception handlers
    auth/         # RBAC dependencies
    services/     # Cloudinary upload, etc.
    utils/        # RBAC seed script
  alembic/        # migrations
  tests/          # pytest suite
frontend/
  src/
    app/          # Next.js App Router pages
    components/   # layout + shared UI components
    context/      # auth + theme React context
    lib/          # API client, query provider
```

## Known Limitations (as of PPS-009)
- Email/SMS/WhatsApp notification delivery is architected (via `notification_events` / `NotificationSettings`) but not wired to a live provider — only in-app delivery is live.
- Report card PDFs and CSV/Excel exports are now **actually generated** (reportlab / pandas+openpyxl, verified against real data) rather than stubbed. Files upload to Cloudinary when credentials are configured; otherwise they're written to local disk and the path is returned — swap in an S3/Cloudinary-backed temp directory for production if you need the files served over HTTP.
- QR code / RFID check-in are schema-ready (`method` field on `student_checkins`) but only manual check-in has a working endpoint.
- Multi-school support: `school_id` foreign keys were not added to every table in this pass — the system currently assumes a single school per deployment. Adding tenant isolation is a schema migration + query-scoping pass across every module.
- Load/performance testing beyond the pytest suite was not run — recommend k6 or Locust against a staging deployment before go-live.
