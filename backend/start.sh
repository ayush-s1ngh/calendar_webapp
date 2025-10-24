#!/bin/bash

# Explicitly set environment to production for both app and migrations
export FLASK_ENV=production
export FLASK_APP="run.py:create_app('production')"

# Apply migrations with production config
flask db upgrade --directory migrations

# Start the server
gunicorn --bind 0.0.0.0:$PORT "app:create_app('production')"