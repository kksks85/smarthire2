# SmartHire 2.0 — Blue-Collar Staffing Portal (India)

Single-tenant staffing portal for blue-collar recruitment. Multi-role enterprise
application with a ServiceNow-style UI.

- **Backend:** FastAPI · SQLAlchemy 2.0 · PostgreSQL · Celery/Redis · JWT
- **Frontend:** React (Vite + TypeScript) · React Router
- **Storage:** AWS S3 (KYC documents) with local-disk fallback for dev

## Roles
Admin · Recruiting Manager · Recruiter · Institution · Employer (client) · Field Agent.
Candidates do **not** log in — they are registered via website, QR self-registration,
field agents, institution Excel uploads, or a generic inbound lead webhook.

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

- API:      http://localhost:8000/api/v1
- API docs: http://localhost:8000/docs
- Web app:  http://localhost:5173

Seed admin credentials come from `.env` (`FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD`).

## Publishing Jobs to Facebook and LinkedIn

1. Deploy the frontend behind a publicly reachable HTTPS domain and ensure `/careers/:slug` and
	`/apply/:slug` resolve to the frontend application.
2. Sign in as an administrator and open **Administration > Public Sharing**.
3. Save the public domain, for example `https://careers.example.com`.
4. Publish a job, or use **Re-generate Share Kit** for an existing published job, then select the
	Facebook or LinkedIn share button.

The social-share dialogs use the platforms' public share endpoints; no social-platform API keys
are required. `PUBLIC_BASE_URL` is used only as the initial deployment default until an
administrator saves a value in Public Sharing.

## Local backend dev (without Docker)

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

## Local frontend dev

```bash
cd frontend
npm install
npm run dev
```
