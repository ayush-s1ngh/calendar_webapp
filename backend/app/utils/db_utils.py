from app import db
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Dict, Any, Optional, Type, TypeVar, Generic, Union

T = TypeVar('T')


class DatabaseManager(Generic[T]):
    """Generic database manager for SQLAlchemy models"""

    def __init__(self, model: Type[T]):
        self.model = model

    def get_by_id(self, id: int) -> Optional[T]:
        """Retrieve an entity by ID"""
        return self.model.query.get(id)

    def get_all(self) -> List[T]:
        """Retrieve all entities"""
        return self.model.query.all()

    def get_filtered(self, **filters) -> List[T]:
        """Retrieve entities based on filters"""
        return self.model.query.filter_by(**filters).all()

    def create(self, **data) -> Union[T, None]:
        """Create a new entity"""
        try:
            entity = self.model(**data)
            db.session.add(entity)
            db.session.commit()
            return entity
        except SQLAlchemyError as e:
            db.session.rollback()
            print(f"Error creating entity: {str(e)}")
            return None

    def update(self, entity: T, **data) -> bool:
        """Update an existing entity"""
        try:
            for key, value in data.items():
                setattr(entity, key, value)
            db.session.commit()
            return True
        except SQLAlchemyError as e:
            db.session.rollback()
            print(f"Error updating entity: {str(e)}")
            return False

    def delete(self, entity: T) -> bool:
        """Delete an entity"""
        try:
            db.session.delete(entity)
            db.session.commit()
            return True
        except SQLAlchemyError as e:
            db.session.rollback()
            print(f"Error deleting entity: {str(e)}")
            return False


# Initialize managers for each model
from app.models import User, Event, Reminder

user_manager = DatabaseManager(User)
event_manager = DatabaseManager(Event)
reminder_manager = DatabaseManager(Reminder)