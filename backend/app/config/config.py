import os
from datetime import timedelta
from sqlalchemy.pool import QueuePool

basedir = os.path.abspath(os.path.dirname(__file__))


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'my_precious_secret_key')
    DEBUG = False
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt_secret_key')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    # SQLAlchemy connection pool settings
    SQLALCHEMY_POOL_SIZE = 10
    SQLALCHEMY_POOL_TIMEOUT = 30
    SQLALCHEMY_POOL_RECYCLE = 1800
    SQLALCHEMY_MAX_OVERFLOW = 20

    # CORS configuration - allow requests from frontend
    CORS_ORIGINS = os.getenv('FRONTEND_URL', '*').split(',')


class DevelopmentConfig(Config):
    DEBUG = True
    # Check if we should use PostgreSQL for development
    if os.getenv('USE_POSTGRES_DEV') == 'true':
        database_url = os.getenv('DATABASE_URL', 'postgresql://postgres:ayush@localhost:5432/calendar_app')
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        SQLALCHEMY_DATABASE_URI = database_url
    else:
        SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, '../../../development.db')

    SQLALCHEMY_TRACK_MODIFICATIONS = False


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, '../../../test.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    PRESERVE_CONTEXT_ON_EXCEPTION = False


class ProductionConfig(Config):
    DEBUG = False
    # Get database URL from environment variable
    database_url = os.getenv('DATABASE_URL', 'postgresql://user:password@localhost/calendar_app')

    # Format correction for older style URLs
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    # Add psycopg dialect if using psycopg3
    if not '+psycopg' in database_url and 'postgresql://' in database_url:
        parts = database_url.split('://', 1)
        database_url = f"{parts[0]}+psycopg://{parts[1]}"

    SQLALCHEMY_DATABASE_URI = database_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False


config_by_name = dict(
    development=DevelopmentConfig,
    testing=TestingConfig,
    production=ProductionConfig
)