import os
from app import create_app, db

def main():
    env = os.getenv('FLASK_ENV', 'production')
    app = create_app(env)

    reset = os.getenv('DB_RESET', 'false').lower() == 'true'

    with app.app_context():
        if reset:
            print("[init_db] DB_RESET=true -> dropping all tables...")
            db.drop_all()
        print("[init_db] Creating all tables from models...")
        db.create_all()
        print("[init_db] Done.")

if __name__ == "__main__":
    main()