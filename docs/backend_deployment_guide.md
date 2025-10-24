# Calendar App Backend – DevOps Deployment Guide

This document is the operational guide for deploying and running the Calendar App backend service in development, staging, and production environments.

The backend is a Flask application with SQLAlchemy, JWT authentication, Alembic migrations, and a background scheduler for reminders and token cleanup.

Repository layout (backend):
- Application code: backend/app
- Alembic migrations: backend/migrations
- Entry points: backend/run.py, backend/start.sh
- Requirements: backend/requirements.txt
- API docs: backend/api_documentation.md


## 1. Architecture Overview

- Framework: Flask (app factory pattern at app.create_app)
- Persistence: SQLAlchemy ORM; migrations via Flask-Migrate/Alembic
- Auth: JWT (flask-jwt-extended)
  - Access/Refresh tokens with custom claims (iat, username)
  - Logout uses in-memory JWT blocklist (non-shared across instances)
- Scheduling: APScheduler (background)
  - Reminders processing every minute
  - Cleanup of expired tokens hourly
- Email: SMTP-based via EmailService (TLS supported)
- OAuth: Google OAuth 2.0 (authorization code flow)
- CORS: Enabled for /api/* endpoints
- Logging: Console + Rotating file logs at logs/app.log
- Rate limiting: In-memory, per-IP or per-user enforcement
- API surface:
  - /api/auth/*: register, login, logout, email verification, password reset, Google OAuth flow
  - /api/users/*: profile and preferences (theme)
  - /api/events/*: event CRUD, bulk operations, recurrence expansion
  - /api/categories/*: category CRUD and category events
  - /api/reminders/*: reminder CRUD and bulk operations
- Timezone handling: All date/times processed/sent as UTC. API formats timestamps as ISO 8601 with trailing Z.


## 2. Runtime Environments

- FLASK_ENV determines config profile used by create_app(...):
  - development: SQLite (unless USE_POSTGRES_DEV=true), CORS origins localhost:5173
  - testing: SQLite test DB, testing flags enabled
  - production: PostgreSQL via DATABASE_URL, production-safe defaults

Configuration classes are in app/config/config.py (Config, DevelopmentConfig, TestingConfig, ProductionConfig).


## 3. Configuration (Environment Variables)

Core app:
- FLASK_ENV: development | testing | production
- SECRET_KEY: Flask app secret key (required for production)
- FRONTEND_URL: Comma-separated origins for CORS and for links in outgoing emails (default http://localhost:3000)

JWT:
- JWT_SECRET_KEY: Secret for JWT signing (required for production)
- JWT_ACCESS_TOKEN_EXPIRES: Defaults to 1 hour (configured in code)
- JWT_REFRESH_TOKEN_EXPIRES: Defaults to 30 days (configured in code)

Database:
- DATABASE_URL: PostgreSQL URL (e.g., postgresql+psycopg://user:pass@host:5432/dbname)
  - If using older style postgres://, code converts to postgresql://, and adds +psycopg
- USE_POSTGRES_DEV: "true" to use DATABASE_URL in development; otherwise uses SQLite

CORS:
- FRONTEND_URL as above; Note: app/__init__.py currently hardcodes allowed origins to:
  - http://localhost:5173, http://127.0.0.1:5173
  - For non-localfrontends, code change may be required to extend origins list.

Email (SMTP):
- MAIL_SERVER: SMTP host (default smtp.gmail.com)
- MAIL_PORT: SMTP port (default 587)
- MAIL_USE_TLS: true|false (default true)
- MAIL_USERNAME: SMTP username (required for email)
- MAIL_PASSWORD: SMTP password (required for email)
- MAIL_DEFAULT_SENDER: default From email (defaults to MAIL_USERNAME if not set)

Google OAuth:
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REDIRECT_URI: default http://localhost:5000/api/auth/google/callback

Web server / process:
- PORT: Port for gunicorn in start.sh (platforms like Heroku, Fly.io, etc.)

Logging:
- Ensure process has write permission to logs/ (RotatingFileHandler writes logs/app.log)


## 4. Deployment Topologies and Caveats

Background scheduler (APScheduler):
- The scheduler is started inside create_app() if not already running:
  - check_reminders runs every minute
  - cleanup_old_tokens runs hourly
- Important: The scheduler state is per-process. If you run multiple processes (e.g., Gunicorn with workers > 1 or multiple pods/instances), each process will start its own scheduler, causing duplicate reminder notifications and duplicate cleanup.
- Recommended patterns:
  - Web-only: Run a single process (workers=1) for the instance that executes the scheduler; horizontally scale only if you can ensure only one instance enables the scheduler.
  - Split roles: Run one dedicated “worker” instance (single process) for scheduler tasks and modify the application to not start the scheduler in web instances. As-is, the code does not provide an env toggle; if you need multi-process web, consider patching app/__init__.py to guard scheduler startup via an env var (e.g., SCHEDULER_ENABLED=true).

In-memory state:
- JWT blocklist (logout) and rate limiter state are in-process memory:
  - They do not sync across instances and reset on process restart.
  - In multi-instance deployments, logout invalidation and rate limits apply per instance only.
  - For production-grade setups, consider replacing these with a shared store (e.g., Redis).

CORS:
- Current implementation explicitly allows only http://localhost:5173 and http://127.0.0.1:5173 in app/__init__.py.
  - To deploy a different frontend origin, update the origins list in create_app() or refactor to read from env (e.g., Config.CORS_ORIGINS).

Logging:
- Logs write to ./logs/app.log. In containers, mount a volume or redirect logs to stdout/stderr and rely on the platform’s logging.

Health checks:
- There is no explicit health endpoint. Use a TCP check on the listening port. If you need HTTP health/readiness, consider adding a simple GET /health that returns 200.


## 5. Database Setup and Migrations

Alembic migrations are in backend/migrations.

- Initialize/upgrade DB schema:
  - Ensure FLASK_ENV and DATABASE_URL (if using Postgres) are set.
  - Run:
    - flask db upgrade --directory migrations
- start.sh (production helper) does:
  - export FLASK_ENV=production
  - export FLASK_APP="run.py:create_app('production')"
  - flask db upgrade --directory migrations
  - gunicorn --bind 0.0.0.0:$PORT "app:create_app('production')"

SQLite (development default unless USE_POSTGRES_DEV=true):
- DevelopmentConfig uses a local SQLite database (development.db).

PostgreSQL (recommended for production):
- Provide DATABASE_URL in the form:
  - postgresql+psycopg://user:password@host:5432/calendar_app
  - Legacy postgres:// URLs are normalized by the code.


## 6. Running Locally (Development)

Prerequisites:
- Python 3.11.x (runtime.txt uses 3.11.8)
- Virtualenv recommended

Steps:
1) cd backend
2) python -m venv .venv && source .venv/bin/activate
3) pip install -r requirements.txt
4) Create a .env file (example below) or export env vars in your shell
5) Initialize DB:
   - flask db upgrade --directory migrations
   - Alternatively: python migrations_setup.py (creates tables without applying migrations)
6) Start the server:
   - python run.py
   - The app defaults to development config; server listens on http://127.0.0.1:5000

Note: In development, the scheduler will start automatically when the app starts.

Example .env (development):
```
FLASK_ENV=development
SECRET_KEY=dev-secret
JWT_SECRET_KEY=dev-jwt-secret
# Optional: use Postgres locally instead of SQLite
USE_POSTGRES_DEV=false
DATABASE_URL=postgresql+psycopg://postgres:password@localhost:5432/calendar_app

# Email (set to enable outbound emails)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-email@example.com
MAIL_PASSWORD=app-password
MAIL_DEFAULT_SENDER=your-email@example.com

# Frontend URL (used in email links)
FRONTEND_URL=http://localhost:3000

# Google OAuth (optional for testing OAuth)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```


## 7. Production Runbook

Build:
- Use a Python 3.11 base image. Ensure build installs backend/requirements.txt.
- Set working directory to backend to run commands relative to this folder.

Migrate:
- Set FLASK_ENV=production and FLASK_APP to run.py:create_app('production')
- Run flask db upgrade --directory migrations

Start:
- Recommended: gunicorn with a single worker, unless you isolate the scheduler to a separate worker instance.
- Example:
  - gunicorn --bind 0.0.0.0:${PORT:-8000} "app:create_app('production')" --workers 1 --threads 2 --timeout 60
  - Or use backend/start.sh (expects $PORT)

Environment:
- Set SECRET_KEY and JWT_SECRET_KEY to strong random values.
- Set DATABASE_URL to production Postgres.
- Configure email and OAuth variables as required.
- Set FRONTEND_URL to your deployed frontend origin (used in outbound links).

Health/Readiness:
- Use TCP or a simple HTTP GET to an unprotected route (none provided by default). Consider adding a /health endpoint for readiness checks.

Logs:
- Ensure logs directory is writable if you keep file logging enabled. In containerized environments, prefer stdout logging and disable file handler if desired.

Backups:
- Set up regular backups of the Postgres database.

Scaling:
- If scaling horizontally or using multiple Gunicorn workers, address:
  - APScheduler duplication: run scheduler in exactly one process
  - In-memory JWT blocklist and rate limiter: not shared across instances (consider moving to Redis)


## 8. Email Delivery

- SMTP credentials are required to send email verification, password reset, and reminder notifications.
- Email templates are simple HTML/text bodies defined in app/utils/email_service.py
- If emails fail to send, the app logs errors; verification/reset endpoints return success messages that do not reveal existence of accounts (anti-enumeration).


## 9. Google OAuth

- Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.
- Redirect URI must be registered in Google Cloud Console.
- Login flow:
  - GET /api/auth/google/login returns an authorization_url and state
  - Google redirects to /api/auth/google/callback
  - On success, user is created/linked and redirected to FRONTEND_URL/oauth-success?token=<access_token>


## 10. Rate Limiting

- Implemented in app/utils/rate_limiter.py
- Decorator @rate_limit(...) for endpoints (e.g., register, login, bulk ops)
- State is in-memory per process; scaling horizontally creates independent buckets per instance and resets on restart.


## 11. Time & Timezone

- Datetimes are validated as ISO 8601 strings; server treats times in UTC.
- Responses normalize to ISO 8601 with trailing Z (UTC).
- Background reminders compare against datetime.utcnow().


## 12. Seeding Test Data (Development only)

- backend/seed_data.py clears DB and inserts:
  - Users, categories, events (including recurring), reminders, tokens, and a sample OAuth account
- Usage:
  - Ensure development environment
  - python seed_data.py


## 13. API Documentation

See backend/api_documentation.md for endpoint-level request/response details, including examples and object shapes.


## 14. Security Considerations

- Always set strong SECRET_KEY and JWT_SECRET_KEY in production.
- Run behind TLS termination (ingress/proxy).
- CORS: Restrict allowed origins to your frontend(s).
- JWT blocklist and rate limiter are not durable/shared; for high security, replace with Redis-backed implementations.
- Passwords hashed with Werkzeug’s generate_password_hash; minimum complexity enforced on registration/reset.
- Account lockout after repeated failed login attempts (temporary lock, enforced per user).
- Email verification required for full functionality.


## 15. Common Issues & Troubleshooting

- Duplicate reminder notifications:
  - Cause: Multiple scheduler instances (multi-worker/multi-instance)
  - Fix: Ensure exactly one scheduler is running (single worker or dedicated worker instance)

- Logout not effective across nodes:
  - Cause: In-memory JWT blocklist
  - Fix: Use a shared store (e.g., Redis) if running multiple instances

- CORS blocked:
  - Cause: Allowed origins hardcoded in create_app()
  - Fix: Update origins list in app/__init__.py or refactor to read from env

- Email not sending:
  - Cause: Missing or incorrect MAIL_* env vars; port/STARTTLS mismatch
  - Fix: Verify credentials, host, port, TLS setting; check logs

- Postgres connection string errors:
  - Use postgresql+psycopg://... (code normalizes some variants)
  - Ensure psycopg (v3) is installed per requirements.txt

- Permissions on logs:
  - Ensure process user can create/write logs/ directory; or redirect logs to stdout


## 16. Example Commands

Development:
- pip install -r requirements.txt
- FLASK_ENV=development flask db upgrade --directory migrations
- python run.py

Production (single process):
- FLASK_ENV=production FLASK_APP="run.py:create_app('production')" flask db upgrade --directory migrations
- gunicorn --bind 0.0.0.0:${PORT:-8000} "app:create_app('production')" --workers 1 --threads 2 --timeout 60

Heroku-style (uses provided script):
- ./start.sh