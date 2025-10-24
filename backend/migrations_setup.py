from flask_migrate import Migrate
from app import create_app, db
from app.models import User, Event, Reminder

app = create_app('development')

# Create tables if they don't exist
with app.app_context():
    db.create_all()

print("Database tables created successfully!")