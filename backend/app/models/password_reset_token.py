from datetime import datetime, timedelta
from .. import db
import secrets
import string

class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(255), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship
    user = db.relationship('User', backref='password_reset_tokens')

    def __init__(self, user_id, expires_in_hours=1):
        self.user_id = user_id
        self.token = self.generate_token()
        self.expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)

    @staticmethod
    def generate_token(length=32):
        """Generate a secure random token"""
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))

    def is_expired(self):
        """Check if the token has expired"""
        return datetime.utcnow() > self.expires_at

    def is_valid(self):
        """Check if the token is valid (not used and not expired)"""
        return not self.used and not self.is_expired()

    def mark_as_used(self):
        """Mark the token as used"""
        self.used = True

    def __repr__(self):
        return f'<PasswordResetToken {self.token[:8]}...>'