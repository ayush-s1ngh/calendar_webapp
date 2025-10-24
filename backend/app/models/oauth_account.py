from datetime import datetime
from .. import db

class OAuthAccount(db.Model):
    __tablename__ = 'oauth_accounts'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    provider = db.Column(db.String(50), nullable=False)  # 'google', 'facebook', etc.
    provider_user_id = db.Column(db.String(255), nullable=False)
    access_token = db.Column(db.Text, nullable=True)
    refresh_token = db.Column(db.Text, nullable=True)
    token_expires_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    user = db.relationship('User', backref='oauth_accounts')

    # Constraints
    __table_args__ = (
        db.UniqueConstraint('provider', 'provider_user_id', name='unique_provider_user'),
    )

    def is_token_expired(self):
        """Check if the access token has expired"""
        if not self.token_expires_at:
            return False
        return datetime.utcnow() > self.token_expires_at

    def __repr__(self):
        return f'<OAuthAccount {self.provider}:{self.provider_user_id}>'