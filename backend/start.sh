#!/bin/bash
set -euo pipefail

# Ensure we're in the backend directory (works even if Render root dir isn't set)
cd "$(dirname "$0")"

export FLASK_ENV=production

# Initialize database schema directly from models (no Alembic)
python -m scripts.init_db

# Start the server
exec gunicorn --bind 0.0.0.0:$PORT "app:create_app('production')"