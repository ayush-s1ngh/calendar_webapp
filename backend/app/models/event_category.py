from .. import db

# Association table for many-to-many relationship between events and categories
event_categories = db.Table(
    'event_categories',
    db.Column('event_id', db.Integer, db.ForeignKey('events.id'), primary_key=True),
    db.Column('category_id', db.Integer, db.ForeignKey('categories.id'), primary_key=True),
    db.Column('created_at', db.DateTime, default=db.func.current_timestamp())
)