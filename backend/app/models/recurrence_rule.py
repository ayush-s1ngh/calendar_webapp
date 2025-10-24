from datetime import datetime
from .. import db


class RecurrenceRule(db.Model):
    __tablename__ = 'recurrence_rules'

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=False)

    # Recurrence pattern
    frequency = db.Column(db.String(20), nullable=False)  # DAILY, WEEKLY, MONTHLY, YEARLY
    interval = db.Column(db.Integer, default=1)  # Every N days/weeks/months/years

    # Weekly recurrence options
    days_of_week = db.Column(db.String(20), nullable=True)  # Comma-separated: 'MON,WED,FRI'

    # Monthly recurrence options
    day_of_month = db.Column(db.Integer, nullable=True)  # 1-31
    week_of_month = db.Column(db.Integer, nullable=True)  # 1-5 (first, second, third, fourth, last)
    day_of_week = db.Column(db.String(10), nullable=True)  # MON, TUE, etc.

    # End conditions
    end_date = db.Column(db.DateTime, nullable=True)
    occurrence_count = db.Column(db.Integer, nullable=True)

    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<RecurrenceRule {self.frequency} every {self.interval}>'

    def to_dict(self):
        return {
            'id': self.id,
            'frequency': self.frequency,
            'interval': self.interval,
            'days_of_week': self.days_of_week.split(',') if self.days_of_week else None,
            'day_of_month': self.day_of_month,
            'week_of_month': self.week_of_month,
            'day_of_week': self.day_of_week,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'occurrence_count': self.occurrence_count,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }