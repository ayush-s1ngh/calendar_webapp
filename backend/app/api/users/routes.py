from flask import request
from flask_jwt_extended import jwt_required, current_user

from ... import db
from . import users_bp
from ...utils.responses import success_response, error_response
from ...utils.validators import validate_username, validate_email_address
from ...utils.logger import logger
from ...models import User

@users_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """
    Get current user details

    Returns:
    - Success response with user details
    """
    try:
        user_data = {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "theme_preference": current_user.theme_preference,
            "created_at": current_user.created_at,
            "updated_at": current_user.updated_at,
            "email_verified": current_user.email_verified
        }

        return success_response(data=user_data)

    except Exception as e:
        logger.error(f"Error retrieving user details: {str(e)}")
        return error_response("An error occurred while retrieving user details", 500)


@users_bp.route('/me', methods=['PUT'])
@jwt_required()
def update_user_details():
    """
    Update user details

    Request body:
    - username: (optional) New username
    - email: (optional) New email

    Returns:
    - Success response with updated user details
    """
    try:
        data = request.get_json()

        if not data:
            return error_response("Invalid request data", 400)

        # Check which fields to update
        updates = {}

        # Update username if provided
        if 'username' in data:
            username = data['username']

            # Validate username
            is_valid, error_msg = validate_username(username)
            if not is_valid:
                return error_response(error_msg, 400)

            # Check if username is taken (not by current user)
            existing_user = User.query.filter_by(username=username).first()
            if existing_user and existing_user.id != current_user.id:
                return error_response("Username is already taken", 409)

            updates['username'] = username

        # Update email if provided
        if 'email' in data:
            email = data['email']

            # Validate email
            is_valid, error_msg = validate_email_address(email)
            if not is_valid:
                return error_response(error_msg, 400)

            # Check if email is taken (not by current user)
            existing_user = User.query.filter_by(email=email).first()
            if existing_user and existing_user.id != current_user.id:
                return error_response("Email is already registered", 409)

            updates['email'] = email

        # No updates provided
        if not updates:
            return error_response("No updates provided", 400)

        # Update user
        for key, value in updates.items():
            setattr(current_user, key, value)

        db.session.commit()

        # Return updated user data
        user_data = {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "theme_preference": current_user.theme_preference,
            "created_at": current_user.created_at,
            "updated_at": current_user.updated_at
        }

        logger.info(f"User updated: {current_user.username}")
        return success_response(data=user_data, message="User details updated successfully")

    except Exception as e:
        logger.error(f"Error updating user details: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while updating user details", 500)


@users_bp.route('/me/theme', methods=['PUT'])
@jwt_required()
def update_theme_preference():
    """
    Update theme preference

    Request body:
    - theme: New theme preference ('light' or 'dark')

    Returns:
    - Success response with updated theme preference
    """
    try:
        data = request.get_json()

        if not data:
            return error_response("Invalid request data", 400)

        theme = data.get('theme')

        if not theme:
            return error_response("Theme preference is required", 400)

        # Validate theme
        if theme not in ['light', 'dark']:
            return error_response("Theme must be 'light' or 'dark'", 400)

        # Update theme
        current_user.theme_preference = theme
        db.session.commit()

        logger.info(f"User {current_user.username} updated theme to {theme}")
        return success_response(
            data={"theme_preference": theme},
            message="Theme preference updated successfully"
        )

    except Exception as e:
        logger.error(f"Error updating theme preference: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while updating theme preference", 500)