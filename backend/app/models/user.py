from datetime import datetime
from .. import db
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=True)  # Nullable for OAuth users
    theme_preference = db.Column(db.String(20), default='light')
    
    # New fields for Phase 2
    email_verified = db.Column(db.Boolean, default=False)
    account_status = db.Column(db.String(20), default='active')  # active, locked, suspended
    failed_login_attempts = db.Column(db.Integer, default=0)
    last_login_attempt = db.Column(db.DateTime, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    events = db.relationship('Event', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    categories = db.relationship('Category', backref='user', lazy='dynamic', cascade='all, delete-orphan')

    def __init__(self, username, email, password=None, email_verified=False):
        self.username = username
        self.email = email
        self.email_verified = email_verified
        if password:
            self.set_password(password)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def is_account_locked(self):
        """Check if account is locked due to failed attempts"""
        if self.failed_login_attempts >= 5:
            # Lock for 30 minutes after 5 failed attempts
            if self.last_login_attempt:
                lock_duration = datetime.utcnow() - self.last_login_attempt
                return lock_duration.total_seconds() < 1800  # 30 minutes
        return False

    def reset_failed_attempts(self):
        """Reset failed login attempts counter"""
        self.failed_login_attempts = 0
        self.last_login_attempt = None

    def increment_failed_attempts(self):
        """Increment failed login attempts"""
        self.failed_login_attempts += 1
        self.last_login_attempt = datetime.utcnow()

    def can_login(self):
        """Check if user can login"""
        return (self.account_status == 'active' and 
                not self.is_account_locked())

    def __repr__(self):
        return f'<User {self.username}>'