from functools import wraps
from flask import request, jsonify
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from .logger import logger
from .responses import error_response

def handle_validation_errors(f):
    """Decorator to handle validation errors consistently"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValidationError as e:
            logger.warning(f"Validation error in {f.__name__}: {e.messages}")
            return error_response("Validation failed", 400, errors=e.messages)
        except ValueError as e:
            logger.warning(f"Value error in {f.__name__}: {str(e)}")
            return error_response(str(e), 400)
    return decorated_function

def handle_database_errors(f):
    """Decorator to handle database errors consistently"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except IntegrityError as e:
            logger.error(f"Database integrity error in {f.__name__}: {str(e)}")
            # Check for specific constraint violations
            if 'unique' in str(e).lower():
                return error_response("A record with this information already exists", 409)
            elif 'foreign key' in str(e).lower():
                return error_response("Referenced record does not exist", 400)
            else:
                return error_response("Database constraint violation", 400)
        except SQLAlchemyError as e:
            logger.error(f"Database error in {f.__name__}: {str(e)}")
            return error_response("Database operation failed", 500)
    return decorated_function

def handle_not_found(resource_name="Resource"):
    """Decorator to handle not found errors"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            result = f(*args, **kwargs)
            if result is None:
                return error_response(f"{resource_name} not found", 404)
            return result
        return decorated_function
    return decorator

def log_request_info(f):
    """Decorator to log request information for debugging"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        logger.info(f"API call: {request.method} {request.path} from {request.remote_addr}")
        # Use silent=True to prevent an error if the request has no JSON body (e.g., GET requests)
        json_data = request.get_json(silent=True)
        if json_data:
            logger.debug(f"Request data: {json_data}")
        return f(*args, **kwargs)
    return decorated_function

# Global error handlers
def register_error_handlers(app):
    """Register global error handlers"""
    
    @app.errorhandler(ValidationError)
    def handle_validation_error(e):
        logger.warning(f"Unhandled validation error: {e.messages}")
        return error_response("Validation failed", 400, errors=e.messages)
    
    @app.errorhandler(IntegrityError)
    def handle_integrity_error(e):
        logger.error(f"Unhandled integrity error: {str(e)}")
        return error_response("Data integrity violation", 400)
    
    @app.errorhandler(SQLAlchemyError)
    def handle_sqlalchemy_error(e):
        logger.error(f"Unhandled SQLAlchemy error: {str(e)}")
        return error_response("Database error occurred", 500)
    
    @app.errorhandler(Exception)
    def handle_generic_error(e):
        logger.error(f"Unhandled exception: {str(e)}", exc_info=True)
        return error_response("An unexpected error occurred", 500)