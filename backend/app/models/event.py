from datetime import datetime
from .. import db

class Event(db.Model):
    __tablename__ = 'events'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text, nullable=True)
    start_datetime = db.Column(db.DateTime, nullable=False)
    end_datetime = db.Column(db.DateTime, nullable=True)
    is_all_day = db.Column(db.Boolean, default=False)
    color = db.Column(db.String(20), default='blue')

    # New fields for recurrence
    is_recurring = db.Column(db.Boolean, default=False)
    recurrence_id = db.Column(db.String(36), nullable=True)  # UUID for grouping recurring events
    parent_event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=True)  # For exception handling

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    reminders = db.relationship('Reminder', backref='event', lazy='dynamic', cascade='all, delete-orphan')
    recurrence_rule = db.relationship('RecurrenceRule', backref='event', uselist=False, cascade='all, delete-orphan')
    categories = db.relationship('Category', secondary='event_categories', back_populates='events')

    # Self-referential relationship for recurring events
    child_events = db.relationship('Event', backref=db.backref('parent_event', remote_side=[id]))

    def __repr__(self):
        return f'<Event {self.title}>'

    def to_dict(self, include_categories=True):
        result = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'start_datetime': self.start_datetime,
            'end_datetime': self.end_datetime,
            'is_all_day': self.is_all_day,
            'color': self.color,
            'is_recurring': self.is_recurring,
            'recurrence_id': self.recurrence_id,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

        if include_categories:
            result['categories'] = [cat.to_dict() for cat in self.categories]

        if self.recurrence_rule:
            result['recurrence_rule'] = self.recurrence_rule.to_dict()

        return result