from flask import request, jsonify, redirect, url_for
from flask_jwt_extended import jwt_required, get_jwt, current_user
from datetime import datetime, timedelta
import os

from .. import db
from . import auth_bp
from .jwt_manager import generate_auth_tokens, jwt_blocklist
from ..models import User, EmailVerificationToken, PasswordResetToken, OAuthAccount
from ..utils.responses import success_response, error_response
from ..utils.validators import validate_username, validate_email_address, validate_password
from ..utils.email_service import email_service
from ..utils.rate_limiter import rate_limit
from ..utils.oauth_utils import google_oauth
from ..utils.logger import logger


@auth_bp.route('/register', methods=['POST'])
@rate_limit(limit=10, window=300)  # 10 registrations per 5 minutes
def register():
    """
    Register a new user with email verification
    """
    try:
        data = request.get_json()

        if not data:
            return error_response("Invalid request data", 400)

        # Extract and validate user data
        username = data.get('username', '')
        email = data.get('email', '')
        password = data.get('password', '')

        # Validate username
        is_valid, error_msg = validate_username(username)
        if not is_valid:
            return error_response(error_msg, 400)

        # Validate email
        is_valid, error_msg = validate_email_address(email)
        if not is_valid:
            return error_response(error_msg, 400)

        # Validate password
        is_valid, error_msg = validate_password(password)
        if not is_valid:
            return error_response(error_msg, 400)

        # Check if username exists
        if User.query.filter_by(username=username).first():
            return error_response("Username already exists", 409)

        # Check if email exists
        if User.query.filter_by(email=email).first():
            return error_response("Email already exists", 409)

        # Create new user (email_verified=False by default)
        new_user = User(
            username=username,
            email=email,
            password=password,
            email_verified=False
        )

        # Save to database
        db.session.add(new_user)
        db.session.flush()  # Get user ID

        # Create email verification token
        verification_token = EmailVerificationToken(user_id=new_user.id)
        db.session.add(verification_token)
        db.session.commit()

        # Send verification email
        email_sent = email_service.send_verification_email(
            new_user.email, 
            new_user.username, 
            verification_token.token
        )

        if not email_sent:
            logger.warning(f"Failed to send verification email to {new_user.email}")

        # Generate auth tokens (user can use app but with limited functionality)
        tokens = generate_auth_tokens(new_user)

        # Return success response
        logger.info(f"User registered successfully: {username}")
        return success_response(
            data={
                "user": {
                    "id": new_user.id, 
                    "username": new_user.username, 
                    "email": new_user.email,
                    "email_verified": new_user.email_verified
                },
                "tokens": tokens,
                "email_verification_sent": email_sent
            },
            message="User registered successfully. Please check your email to verify your account.",
            status_code=201
        )

    except Exception as e:
        logger.error(f"Error in user registration: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred during registration", 500)


@auth_bp.route('/login', methods=['POST'])
@rate_limit(limit=25, window=300)  # 25 login attempts per 5 minutes
def login():
    """
    Log in a user with enhanced security
    """
    try:
        data = request.get_json()

        if not data:
            return error_response("Invalid request data", 400)

        # Extract credentials
        username_or_email = data.get('username', '')
        password = data.get('password', '')

        if not username_or_email or not password:
            return error_response("Username/email and password are required", 400)

        # Find user by username or email
        if '@' in username_or_email:
            user = User.query.filter_by(email=username_or_email).first()
        else:
            user = User.query.filter_by(username=username_or_email).first()

        if not user:
            logger.warning(f"Login attempt with non-existent user: {username_or_email}")
            return error_response("Invalid credentials", 401)

        # Check if account is locked
        if user.is_account_locked():
            logger.warning(f"Login attempt on locked account: {user.username}")
            return error_response("Account temporarily locked due to multiple failed attempts. Please try again later.", 423)

        # Check if account is active
        if not user.can_login():
            logger.warning(f"Login attempt on inactive account: {user.username}")
            return error_response("Account is not active", 423)

        # Verify password
        if not user.check_password(password):
            user.increment_failed_attempts()
            db.session.commit()
            
            logger.warning(f"Failed login attempt for user: {user.username}")
            return error_response("Invalid credentials", 401)

        # Reset failed attempts on successful login
        user.reset_failed_attempts()
        db.session.commit()

        # Generate auth tokens
        tokens = generate_auth_tokens(user)

        # Return success response
        logger.info(f"User logged in: {user.username}")
        return success_response(
            data={
                "user": {
                    "id": user.id, 
                    "username": user.username, 
                    "email": user.email,
                    "email_verified": user.email_verified
                }, 
                "tokens": tokens
            },
            message="Login successful"
        )

    except Exception as e:
        logger.error(f"Error in user login: {str(e)}")
        return error_response("An error occurred during login", 500)


@auth_bp.route('/verify-email/<token>', methods=['POST'])
def verify_email(token):
    """
    Verify user email address using token
    """
    try:
        # Find verification token
        verification_token = EmailVerificationToken.query.filter_by(token=token).first()
        
        if not verification_token:
            return error_response("Invalid verification token", 400)
        
        if not verification_token.is_valid():
            return error_response("Verification token has expired or already been used", 400)
        
        # Get user
        user = verification_token.user
        if not user:
            return error_response("User not found", 404)
        
        # Mark email as verified
        user.email_verified = True
        verification_token.mark_as_used()
        
        db.session.commit()
        
        logger.info(f"Email verified for user: {user.username}")
        return success_response(
            data={"email_verified": True},
            message="Email successfully verified"
        )

    except Exception as e:
        logger.error(f"Error in email verification: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred during email verification", 500)


@auth_bp.route('/resend-verification', methods=['POST'])
@jwt_required()
@rate_limit(limit=10, window=300)  # 10 resend attempts per 5 minutes
def resend_verification():
    """
    Resend email verification
    """
    try:
        if current_user.email_verified:
            return error_response("Email is already verified", 400)

        # Invalidate old tokens
        old_tokens = EmailVerificationToken.query.filter_by(
            user_id=current_user.id, 
            used=False
        ).all()
        for token in old_tokens:
            token.mark_as_used()

        # Create new verification token
        verification_token = EmailVerificationToken(user_id=current_user.id)
        db.session.add(verification_token)
        db.session.commit()

        # Send verification email
        email_sent = email_service.send_verification_email(
            current_user.email, 
            current_user.username, 
            verification_token.token
        )

        if email_sent:
            logger.info(f"Verification email resent to: {current_user.email}")
            return success_response(message="Verification email sent successfully")
        else:
            return error_response("Failed to send verification email", 500)

    except Exception as e:
        logger.error(f"Error resending verification email: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while resending verification email", 500)


@auth_bp.route('/request-password-reset', methods=['POST'])
@rate_limit(limit=10, window=300)  # 10 password reset requests per 5 minutes
def request_password_reset():
    """
    Request password reset
    """
    try:
        data = request.get_json()
        
        if not data:
            return error_response("Invalid request data", 400)
        
        email = data.get('email', '').strip()
        
        if not email:
            return error_response("Email is required", 400)
        
        # Validate email format
        is_valid, error_msg = validate_email_address(email)
        if not is_valid:
            return error_response(error_msg, 400)
        
        # Find user by email
        user = User.query.filter_by(email=email).first()
        
        # Always return success to prevent email enumeration
        if not user:
            logger.warning(f"Password reset requested for non-existent email: {email}")
            return success_response(
                message="If an account with this email exists, a password reset link has been sent."
            )
        
        # Invalidate old password reset tokens
        old_tokens = PasswordResetToken.query.filter_by(
            user_id=user.id, 
            used=False
        ).all()
        for token in old_tokens:
            token.mark_as_used()
        
        # Create new password reset token
        reset_token = PasswordResetToken(user_id=user.id)
        db.session.add(reset_token)
        db.session.commit()
        
        # Send password reset email
        email_sent = email_service.send_password_reset_email(
            user.email, 
            user.username, 
            reset_token.token
        )
        
        if email_sent:
            logger.info(f"Password reset email sent to: {user.email}")
        else:
            logger.error(f"Failed to send password reset email to: {user.email}")
        
        # Always return success message
        return success_response(
            message="If an account with this email exists, a password reset link has been sent."
        )

    except Exception as e:
        logger.error(f"Error in password reset request: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while processing password reset request", 500)


@auth_bp.route('/reset-password/<token>', methods=['POST'])
@rate_limit(limit=10, window=300)  # 10 password reset attempts per 5 minutes
def reset_password(token):
    """
    Reset password using token
    """
    try:
        data = request.get_json()
        
        if not data:
            return error_response("Invalid request data", 400)
        
        new_password = data.get('password', '')
        
        if not new_password:
            return error_response("New password is required", 400)
        
        # Validate new password
        is_valid, error_msg = validate_password(new_password)
        if not is_valid:
            return error_response(error_msg, 400)
        
        # Find password reset token
        reset_token = PasswordResetToken.query.filter_by(token=token).first()
        
        if not reset_token:
            return error_response("Invalid password reset token", 400)
        
        if not reset_token.is_valid():
            return error_response("Password reset token has expired or already been used", 400)
        
        # Get user
        user = reset_token.user
        if not user:
            return error_response("User not found", 404)
        
        # Update password
        user.set_password(new_password)
        user.reset_failed_attempts()  # Reset any failed login attempts
        reset_token.mark_as_used()
        
        db.session.commit()
        
        logger.info(f"Password reset successfully for user: {user.username}")
        return success_response(message="Password reset successfully")

    except Exception as e:
        logger.error(f"Error in password reset: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred during password reset", 500)


@auth_bp.route('/google/login', methods=['GET'])
def google_login():
    """
    Initiate Google OAuth login
    """
    try:
        # Generate state parameter for CSRF protection
        import secrets
        state = secrets.token_urlsafe(32)
        
        # Store state in session or cache (simplified for this example)
        # In production, you'd want to store this securely
        
        authorization_url = google_oauth.get_authorization_url(state=state)
        
        return success_response(
            data={"authorization_url": authorization_url, "state": state},
            message="Google OAuth authorization URL generated"
        )

    except Exception as e:
        logger.error(f"Error initiating Google OAuth: {str(e)}")
        return error_response("An error occurred while initiating Google login", 500)


@auth_bp.route('/google/callback', methods=['GET'])
def google_callback():
    """
    Handle Google OAuth callback (with orphan auto-heal)
    """
    try:
        code = request.args.get('code')
        state = request.args.get('state')
        error = request.args.get('error')
        
        if error:
            logger.warning(f"Google OAuth error: {error}")
            return error_response(f"Google OAuth error: {error}", 400)
        
        if not code:
            return error_response("Authorization code not provided", 400)
        
        # Exchange code for tokens
        token_data = google_oauth.exchange_code_for_tokens(code)
        if not token_data:
            return error_response("Failed to exchange authorization code for tokens", 400)
        
        # Get user info from Google
        user_info = google_oauth.get_user_info(token_data['access_token'])
        if not user_info:
            return error_response("Failed to get user information from Google", 400)

        google_user_id = user_info.get('id') or user_info.get('sub')
        email = user_info.get('email')
        name = user_info.get('name', '')
        if not google_user_id or not email:
            logger.error(f"Incomplete user_info: {user_info}")
            return error_response("Google user information incomplete", 400)

        user = None

        # Look for existing OAuth account
        oauth_account = OAuthAccount.query.filter_by(
            provider='google',
            provider_user_id=google_user_id
        ).first()

        if oauth_account:
            # Heal orphan if needed
            if not oauth_account.user:
                logger.error(
                    f"Found orphan OAuthAccount {oauth_account.id} for provider_user_id={google_user_id}; deleting and re-linking")
                db.session.delete(oauth_account)
                db.session.flush()  # free up unique key before re-adding
                oauth_account = None

        if oauth_account:
            user = oauth_account.user
            # Update tokens
            oauth_account.access_token = token_data['access_token']
            oauth_account.refresh_token = token_data.get('refresh_token') or oauth_account.refresh_token
            if 'expires_in' in token_data:
                oauth_account.token_expires_at = datetime.utcnow() + timedelta(seconds=token_data['expires_in'])
            oauth_account.updated_at = datetime.utcnow()
        else:
            # Link to existing user by email, or create new
            user = User.query.filter_by(email=email).first()
            if user is None:
                # Create new user
                username = email.split('@')[0]
                base = username
                i = 1
                while User.query.filter_by(username=username).first():
                    username = f"{base}{i}"
                    i += 1
                user = User(username=username, email=email, email_verified=True)
                db.session.add(user)
                db.session.flush()

            # Create OAuth account
            oauth_account = OAuthAccount(
                user_id=user.id,
                provider='google',
                provider_user_id=google_user_id,
                access_token=token_data['access_token'],
                refresh_token=token_data.get('refresh_token'),
                token_expires_at=datetime.utcnow() + timedelta(seconds=token_data.get('expires_in', 3600))
            )
            db.session.add(oauth_account)

        db.session.commit()

        # Generate app tokens and redirect
        tokens = generate_auth_tokens(user)
        logger.info(f"Google OAuth login successful for user: {user.username}")

        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        redirect_url = f"{frontend_url}/oauth-success?token={tokens['access_token']}"
        return redirect(redirect_url)

    except Exception as e:
        logger.error(f"Error in Google OAuth callback: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred during Google OAuth callback", 500)


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    Log out a user (blacklist the current JWT token)
    """
    try:
        # Add token to blocklist
        jti = get_jwt()["jti"]
        jwt_blocklist.add(jti)

        logger.info(f"User logged out: {current_user.username if current_user else 'Unknown'}")
        return success_response(message="Logout successful")

    except Exception as e:
        logger.error(f"Error in user logout: {str(e)}")
        return error_response("An error occurred during logout", 500)