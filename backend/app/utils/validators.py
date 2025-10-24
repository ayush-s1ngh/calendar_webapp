import re
from datetime import datetime
from email_validator import validate_email, EmailNotValidError


def validate_username(username):
    """
    Validate username format

    Parameters:
    - username: String to validate

    Returns:
    - (True, None) if valid, (False, error_message) if invalid
    """
    if not username or not isinstance(username, str):
        return False, "Username is required"

    if len(username) < 3 or len(username) > 30:
        return False, "Username must be between 3 and 30 characters"

    if not re.match(r'^[a-zA-Z0-9_-]+$', username):
        return False, "Username can only contain letters, numbers, underscores, and hyphens"

    return True, None


def validate_password(password):
    """
    Validate password strength

    Parameters:
    - password: String to validate

    Returns:
    - (True, None) if valid, (False, error_message) if invalid
    """
    if not password or not isinstance(password, str):
        return False, "Password is required"

    if len(password) < 8:
        return False, "Password must be at least 8 characters long"

    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"

    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"

    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one number"

    return True, None


def validate_email_address(email):
    """
    Validate email format

    Parameters:
    - email: String to validate

    Returns:
    - (True, None) if valid, (False, error_message) if invalid
    """
    if not email or not isinstance(email, str):
        return False, "Email is required"

    try:
        # Validate and normalize the email
        valid = validate_email(email)
        return True, None
    except EmailNotValidError as e:
        return False, str(e)


def validate_datetime_string(date_str):
    """
    Validate datetime string format (ISO format: YYYY-MM-DD HH:MM:SS)

    Parameters:
    - date_str: String to validate

    Returns:
    - (True, datetime_obj) if valid, (False, error_message) if invalid
    """
    if not date_str or not isinstance(date_str, str):
        return False, "Datetime is required"

    try:
        # Attempt to parse the datetime string
        dt_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return True, dt_obj
    except ValueError:
        return False, "Invalid datetime format. Use ISO format (YYYY-MM-DD HH:MM:SS)"