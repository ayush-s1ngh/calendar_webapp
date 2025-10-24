from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from apscheduler.schedulers.background import BackgroundScheduler

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
scheduler = BackgroundScheduler()


def create_app(config_name='development'):
    app = Flask(__name__)

    # Import and apply configuration
    from .config.config import config_by_name
    app.config.from_object(config_by_name[config_name])

    # Initialize extensions with app
    origins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
    CORS(app, resources={r"/api/*": {"origins": origins}}, supports_credentials=False, methods=["GET","POST","PUT","PATCH","DELETE","OPTIONS"], allow_headers=["Content-Type","Authorization"], max_age=86400)
    # CORS(app)
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # Register error handlers
    from .utils.error_handler import register_error_handlers
    register_error_handlers(app)

    # Register blueprints
    from .api.events import events_bp
    from .api.reminders import reminders_bp
    from .api.users import users_bp
    from .api.categories import categories_bp
    from .auth import auth_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(events_bp, url_prefix='/api/events')
    app.register_blueprint(reminders_bp, url_prefix='/api/reminders')
    app.register_blueprint(categories_bp, url_prefix='/api/categories')

    # Initialize scheduler
    if not scheduler.running:
        scheduler.start()
        # Initialize reminder scheduler
        from .utils.reminder_scheduler import init_reminder_scheduler
        init_reminder_scheduler()

    # Shell context for flask cli
    @app.shell_context_processor
    def ctx():
        return {'app': app, 'db': db}

    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        from .utils.responses import error_response
        return error_response("Not found", 404)

    @app.errorhandler(500)
    def server_error(error):
        from .utils.responses import error_response
        return error_response("Internal server error", 500)

    return app