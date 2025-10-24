from datetime import datetime
from .. import db

class Reminder(db.Model):
    __tablename__ = 'reminders'

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=False)
    reminder_time = db.Column(db.DateTime, nullable=False)
    notification_sent = db.Column(db.Boolean, default=False)
    
    # New fields for Phase 2
    notification_type = db.Column(db.String(20), default='email')  # email, push, sms
    minutes_before = db.Column(db.Integer, nullable=True)  # For relative reminders
    is_relative = db.Column(db.Boolean, default=True)  # True for X minutes before, False for absolute time
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Reminder for Event {self.event_id} at {self.reminder_time}>'

    def to_dict(self):
        return {
            'id': self.id,
            'event_id': self.event_id,
            'reminder_time': self.reminder_time.isoformat() if self.reminder_time else None,
            'notification_sent': self.notification_sent,
            'notification_type': self.notification_type,
            'minutes_before': self.minutes_before,
            'is_relative': self.is_relative,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }