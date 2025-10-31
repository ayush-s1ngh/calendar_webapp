#!/bin/bash
set -euo pipefail

# Explicitly set environment to production for both app and bootstrap
export FLASK_ENV=production
export FLASK_APP="run.py:create_app('production')"

# Initialize database schema directly from models (no Alembic)
python scripts/init_db.py

# Start the server
gunicorn --bind 0.0.0.0:$PORT "app:create_app('production')"