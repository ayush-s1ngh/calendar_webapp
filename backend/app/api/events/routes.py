from flask import request
from flask_jwt_extended import jwt_required, current_user
from datetime import datetime, timezone, timedelta

from ... import db
from . import events_bp
from ...models import Event, Category, RecurrenceRule, Reminder
from ...utils.responses import success_response, error_response
from ...utils.validators import validate_datetime_string
from ...utils.pagination import paginate_query
from ...utils.recurrence import RecurrenceGenerator
from ...utils.rate_limiter import rate_limit
from ...utils.error_handler import handle_validation_errors, handle_database_errors, log_request_info
from ...utils.logger import logger


@events_bp.route('', methods=['GET'])
@jwt_required()
@log_request_info
def get_all_events():
    """
    Get all events for the logged-in user with filtering and pagination

    Query Parameters:
    - page: Page number (default: 1)
    - per_page: Items per page (default: 50, max: 100)
    - category_id: Filter by category ID
    - start_date: Filter events starting from this date (ISO format)
    - end_date: Filter events up to this date (ISO format)
    - include_recurring: Include recurring event instances (default: true)
    - search: Search in title and description

    Returns:
    - Success response with list of events and pagination info
    """
    try:
        # Build base query
        query = Event.query.filter_by(user_id=current_user.id)

        # Apply filters
        category_id = request.args.get('category_id', type=int)
        if category_id:
            query = query.join(Event.categories).filter(Category.id == category_id)

        start_date = request.args.get('start_date')
        if start_date:
            is_valid, start_dt = validate_datetime_string(start_date)
            if is_valid:
                query = query.filter(Event.start_datetime >= start_dt)

        end_date = request.args.get('end_date')
        if end_date:
            is_valid, end_dt = validate_datetime_string(end_date)
            if is_valid:
                query = query.filter(Event.start_datetime <= end_dt)

        search = request.args.get('search', '').strip()
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                db.or_(
                    Event.title.ilike(search_filter),
                    Event.description.ilike(search_filter)
                )
            )

        # Order by start datetime
        query = query.order_by(Event.start_datetime.desc())

        # Handle pagination
        page = request.args.get('page', type=int)
        per_page = request.args.get('per_page', type=int)
        include_recurring = request.args.get('include_recurring', 'true').lower() == 'true'

        if page or per_page:
            result = paginate_query(query, page, per_page, max_per_page=100)
            events = result['items']
            pagination_info = result['pagination']
        else:
            events = query.all()
            pagination_info = None

        # Process events and expand recurring ones if requested
        events_data = []

        for event in events:
            if event.is_recurring and include_recurring and event.recurrence_rule:
                # Generate recurring instances
                start_range = datetime.utcnow()
                end_range = start_range.replace(year=start_range.year + 1)  # Next year

                occurrences = RecurrenceGenerator.generate_occurrences(
                    event, event.recurrence_rule, start_range, end_range
                )

                for occurrence in occurrences:
                    occurrence_data = occurrence.copy()
                    # Format datetime fields
                    if isinstance(occurrence_data['start_datetime'], datetime):
                        occurrence_data['start_datetime'] = occurrence_data['start_datetime'].replace(
                            tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
                    if occurrence_data['end_datetime'] and isinstance(occurrence_data['end_datetime'], datetime):
                        occurrence_data['end_datetime'] = occurrence_data['end_datetime'].replace(
                            tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
                    if isinstance(occurrence_data['created_at'], datetime):
                        occurrence_data['created_at'] = occurrence_data['created_at'].replace(
                            tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
                    if isinstance(occurrence_data['updated_at'], datetime):
                        occurrence_data['updated_at'] = occurrence_data['updated_at'].replace(
                            tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')

                    events_data.append(occurrence_data)
            else:
                # Regular event or recurring event master
                event_data = {
                    "id": event.id,
                    "title": event.title,
                    "description": event.description,
                    "start_datetime": event.start_datetime.replace(tzinfo=timezone.utc).isoformat().replace('+00:00',
                                                                                                            'Z'),
                    "end_datetime": event.end_datetime.replace(tzinfo=timezone.utc).isoformat().replace('+00:00',
                                                                                                        'Z') if event.end_datetime else None,
                    "is_all_day": event.is_all_day,
                    "color": event.color,
                    "is_recurring": event.is_recurring,
                    "recurrence_id": event.recurrence_id,
                    "created_at": event.created_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
                    "updated_at": event.updated_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
                    "categories": [cat.to_dict() for cat in event.categories]
                }

                if event.recurrence_rule:
                    event_data["recurrence_rule"] = event.recurrence_rule.to_dict()

                events_data.append(event_data)

        # Prepare response
        response_data = {"events": events_data}
        if pagination_info:
            response_data["pagination"] = pagination_info

        return success_response(data=response_data)

    except Exception as e:
        logger.error(f"Error retrieving events: {str(e)}")
        return error_response("An error occurred while retrieving events", 500)


@events_bp.route('/<int:event_id>', methods=['GET'])
@jwt_required()
@log_request_info
def get_event(event_id):
    """
    Get a specific event with full details

    Parameters:
    - event_id: ID of the event

    Returns:
    - Success response with event details
    """
    try:
        event = Event.query.filter_by(id=event_id, user_id=current_user.id).first()

        if not event:
            return error_response("Event not found", 404)

        event_data = {
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "start_datetime": event.start_datetime.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
            "end_datetime": event.end_datetime.replace(tzinfo=timezone.utc).isoformat().replace('+00:00',
                                                                                                'Z') if event.end_datetime else None,
            "is_all_day": event.is_all_day,
            "color": event.color,
            "is_recurring": event.is_recurring,
            "recurrence_id": event.recurrence_id,
            "created_at": event.created_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
            "updated_at": event.updated_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
            "categories": [cat.to_dict() for cat in event.categories]
        }

        if event.recurrence_rule:
            event_data["recurrence_rule"] = event.recurrence_rule.to_dict()

        return success_response(data=event_data)

    except Exception as e:
        logger.error(f"Error retrieving event {event_id}: {str(e)}")
        return error_response("An error occurred while retrieving the event", 500)


@events_bp.route('', methods=['POST'])
@jwt_required()
@rate_limit(limit=30, window=300)  # 30 event creations per 5 minutes
@handle_validation_errors
@handle_database_errors
@log_request_info
def create_event():
    """
    Create a new event with optional reminders

    Request body:
    - title: Event title
    - description: (optional) Event description
    - start_datetime: Event start datetime (ISO format)
    - end_datetime: (optional) Event end datetime (ISO format)
    - is_all_day: (optional) Boolean indicating all-day event
    - color: (optional) Event color
    - category_ids: (optional) List of category IDs to assign
    - recurrence_rule: (optional) Recurrence rule object
    - reminders: (optional) List of reminder objects

    Returns:
    - Success response with created event details
    """
    try:
        data = request.get_json()

        if not data:
            return error_response("Invalid request data", 400)

        # Required fields
        title = data.get('title')
        start_datetime_str = data.get('start_datetime')

        # Optional fields
        description = data.get('description')
        end_datetime_str = data.get('end_datetime')
        is_all_day = data.get('is_all_day', False)
        color = data.get('color', 'blue')
        category_ids = data.get('category_ids', [])
        recurrence_rule_data = data.get('recurrence_rule')
        reminders_data = data.get('reminders', [])

        # Validate required fields
        if not title:
            return error_response("Title is required", 400)

        # Validate start_datetime
        is_valid, start_dt_obj = validate_datetime_string(start_datetime_str)
        if not is_valid:
            return error_response(start_dt_obj, 400)

        # Ensure start_dt_obj is timezone-aware
        if start_dt_obj.tzinfo is None:
            start_dt_obj = start_dt_obj.replace(tzinfo=timezone.utc)

        # Validate end_datetime if provided
        end_dt_obj = None
        if end_datetime_str:
            is_valid, end_dt_obj = validate_datetime_string(end_datetime_str)
            if not is_valid:
                return error_response(end_dt_obj, 400)

            # Ensure end_dt_obj is timezone-aware
            if end_dt_obj.tzinfo is None:
                end_dt_obj = end_dt_obj.replace(tzinfo=timezone.utc)

            if end_dt_obj <= start_dt_obj:
                return error_response("End datetime must be after start datetime", 400)

        # Validate categories
        categories = []
        if category_ids:
            categories = Category.query.filter(
                Category.id.in_(category_ids),
                Category.user_id == current_user.id
            ).all()

            if len(categories) != len(category_ids):
                return error_response("One or more categories not found", 400)

        # Validate recurrence rule if provided
        recurrence_rule = None
        is_recurring = False
        recurrence_id = None

        if recurrence_rule_data:
            validation_errors = RecurrenceGenerator.validate_recurrence_rule(recurrence_rule_data)
            if validation_errors:
                return error_response("Invalid recurrence rule", 400, errors=validation_errors)

            is_recurring = True
            recurrence_id = RecurrenceGenerator.generate_recurrence_id()

        # Validate reminders if provided
        validated_reminders = []
        if reminders_data:
            if not isinstance(reminders_data, list):
                return error_response("Reminders must be a list", 400)

            if len(reminders_data) > 10:  # Limit reminders per event
                return error_response("Cannot create more than 10 reminders per event", 400)

            for idx, reminder_data in enumerate(reminders_data):
                try:
                    reminder_time_str = reminder_data.get('reminder_time')
                    minutes_before = reminder_data.get('minutes_before')
                    notification_type = reminder_data.get('notification_type', 'email')

                    if not reminder_time_str and minutes_before is None:
                        return error_response(
                            f"Reminder {idx + 1}: Either reminder_time or minutes_before must be provided", 400)

                    if reminder_time_str and minutes_before is not None:
                        return error_response(
                            f"Reminder {idx + 1}: Cannot specify both reminder_time and minutes_before", 400)

                    # Calculate reminder time
                    if minutes_before is not None:
                        if not isinstance(minutes_before, int) or minutes_before < 0:
                            return error_response(f"Reminder {idx + 1}: minutes_before must be a non-negative integer",
                                                  400)

                        reminder_time_obj = start_dt_obj - timedelta(minutes=minutes_before)

                        # Convert current time to timezone-aware for comparison
                        current_time_utc = datetime.now(timezone.utc)
                        if reminder_time_obj <= current_time_utc:
                            return error_response(f"Reminder {idx + 1}: Calculated reminder time cannot be in the past",
                                                  400)

                        is_relative = True
                    else:
                        is_valid, reminder_time_obj = validate_datetime_string(reminder_time_str)
                        if not is_valid:
                            return error_response(f"Reminder {idx + 1}: {reminder_time_obj}", 400)

                        # Ensure reminder_time_obj is timezone-aware
                        if reminder_time_obj.tzinfo is None:
                            reminder_time_obj = reminder_time_obj.replace(tzinfo=timezone.utc)

                        # Convert current time to timezone-aware for comparison
                        current_time_utc = datetime.now(timezone.utc)
                        if reminder_time_obj <= current_time_utc:
                            return error_response(f"Reminder {idx + 1}: Reminder time cannot be in the past", 400)

                        if reminder_time_obj >= start_dt_obj:
                            return error_response(f"Reminder {idx + 1}: Reminder time must be before event start time",
                                                  400)

                        is_relative = False
                        minutes_before = None

                    validated_reminders.append({
                        'reminder_time': reminder_time_obj,
                        'notification_type': notification_type,
                        'minutes_before': minutes_before,
                        'is_relative': is_relative
                    })

                except Exception as e:
                    return error_response(f"Reminder {idx + 1}: {str(e)}", 400)

        # Create new event
        new_event = Event(
            user_id=current_user.id,
            title=title,
            description=description,
            start_datetime=start_dt_obj,
            end_datetime=end_dt_obj,
            is_all_day=is_all_day,
            color=color,
            is_recurring=is_recurring,
            recurrence_id=recurrence_id
        )

        # Add categories
        new_event.categories = categories

        # Save event first to get ID
        db.session.add(new_event)
        db.session.flush()  # Get the ID without committing

        # Create recurrence rule if provided
        if recurrence_rule_data:
            recurrence_rule = RecurrenceRule(
                event_id=new_event.id,
                frequency=recurrence_rule_data['frequency'],
                interval=recurrence_rule_data.get('interval', 1),
                days_of_week=','.join(recurrence_rule_data['days_of_week']) if recurrence_rule_data.get(
                    'days_of_week') else None,
                day_of_month=recurrence_rule_data.get('day_of_month'),
                week_of_month=recurrence_rule_data.get('week_of_month'),
                day_of_week=recurrence_rule_data.get('day_of_week'),
                end_date=validate_datetime_string(recurrence_rule_data['end_date'])[1] if recurrence_rule_data.get(
                    'end_date') else None,
                occurrence_count=recurrence_rule_data.get('occurrence_count')
            )
            db.session.add(recurrence_rule)

        # Create reminders if provided
        created_reminders = []
        for reminder_data in validated_reminders:
            reminder = Reminder(
                event_id=new_event.id,
                reminder_time=reminder_data['reminder_time'],
                notification_sent=False,
                notification_type=reminder_data['notification_type'],
                minutes_before=reminder_data['minutes_before'],
                is_relative=reminder_data['is_relative']
            )
            db.session.add(reminder)
            created_reminders.append(reminder)

        # Commit all changes
        db.session.commit()

        # Return created event with reminders
        event_data = {
            "id": new_event.id,
            "title": new_event.title,
            "description": new_event.description,
            "start_datetime": new_event.start_datetime.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
            "end_datetime": new_event.end_datetime.replace(tzinfo=timezone.utc).isoformat().replace('+00:00',
                                                                                                    'Z') if new_event.end_datetime else None,
            "is_all_day": new_event.is_all_day,
            "color": new_event.color,
            "is_recurring": new_event.is_recurring,
            "recurrence_id": new_event.recurrence_id,
            "created_at": new_event.created_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
            "updated_at": new_event.updated_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
            "categories": [cat.to_dict() for cat in new_event.categories],
            "reminders": [
                {
                    "id": reminder.id,
                    "reminder_time": reminder.reminder_time.replace(tzinfo=timezone.utc).isoformat().replace('+00:00',
                                                                                                             'Z'),
                    "notification_type": reminder.notification_type,
                    "minutes_before": reminder.minutes_before,
                    "is_relative": reminder.is_relative
                }
                for reminder in created_reminders
            ]
        }

        if recurrence_rule:
            event_data["recurrence_rule"] = recurrence_rule.to_dict()

        logger.info(
            f"Event created with {len(created_reminders)} reminders: {new_event.id} by user {current_user.username}")
        return success_response(data=event_data, message="Event created successfully", status_code=201)

    except Exception as e:
        logger.error(f"Error creating event: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while creating the event", 500)


@events_bp.route('/<int:event_id>', methods=['PUT'])
@jwt_required()
@handle_validation_errors
@handle_database_errors
@log_request_info
def update_event(event_id):
    """
    Update an event

    Parameters:
    - event_id: ID of the event

    Request body:
    - title: (optional) Event title
    - description: (optional) Event description
    - start_datetime: (optional) Event start datetime (ISO format)
    - end_datetime: (optional) Event end datetime (ISO format)
    - is_all_day: (optional) Boolean indicating all-day event
    - color: (optional) Event color
    - category_ids: (optional) List of category IDs to assign
    - recurrence_rule: (optional) Recurrence rule object

    Returns:
    - Success response with updated event details
    """
    try:
        event = Event.query.filter_by(id=event_id, user_id=current_user.id).first()

        if not event:
            return error_response("Event not found", 404)

        data = request.get_json()

        if not data:
            return error_response("Invalid request data", 400)

        # Process updates
        updates = {}

        # Update title if provided
        if 'title' in data:
            title = data['title']
            if not title:
                return error_response("Title cannot be empty", 400)
            updates['title'] = title

        # Update description if provided
        if 'description' in data:
            updates['description'] = data['description']

        # Update start_datetime if provided
        if 'start_datetime' in data:
            start_datetime_str = data['start_datetime']
            is_valid, start_dt_obj = validate_datetime_string(start_datetime_str)
            if not is_valid:
                return error_response(start_dt_obj, 400)
            updates['start_datetime'] = start_dt_obj

        # Update end_datetime if provided
        if 'end_datetime' in data:
            if data['end_datetime'] is None:
                updates['end_datetime'] = None
            else:
                end_datetime_str = data['end_datetime']
                is_valid, end_dt_obj = validate_datetime_string(end_datetime_str)
                if not is_valid:
                    return error_response(end_dt_obj, 400)
                updates['end_datetime'] = end_dt_obj

        # Check if end is after start
        start_time = updates.get('start_datetime', event.start_datetime)
        end_time = updates.get('end_datetime', event.end_datetime)

        if end_time and start_time and end_time <= start_time:
            return error_response("End datetime must be after start datetime", 400)

        # Update is_all_day if provided
        if 'is_all_day' in data:
            updates['is_all_day'] = bool(data['is_all_day'])

        # Update color if provided
        if 'color' in data:
            updates['color'] = data['color']

        # Update categories if provided
        if 'category_ids' in data:
            category_ids = data['category_ids']
            if category_ids:
                categories = Category.query.filter(
                    Category.id.in_(category_ids),
                    Category.user_id == current_user.id
                ).all()

                if len(categories) != len(category_ids):
                    return error_response("One or more categories not found", 400)

                event.categories = categories
            else:
                event.categories = []

        # Handle recurrence rule updates
        if 'recurrence_rule' in data:
            recurrence_rule_data = data['recurrence_rule']

            if recurrence_rule_data:
                # Validate new recurrence rule
                validation_errors = RecurrenceGenerator.validate_recurrence_rule(recurrence_rule_data)
                if validation_errors:
                    return error_response("Invalid recurrence rule", 400, errors=validation_errors)

                # Update or create recurrence rule
                if event.recurrence_rule:
                    # Update existing rule
                    rule = event.recurrence_rule
                    rule.frequency = recurrence_rule_data['frequency']
                    rule.interval = recurrence_rule_data.get('interval', 1)
                    rule.days_of_week = ','.join(recurrence_rule_data['days_of_week']) if recurrence_rule_data.get(
                        'days_of_week') else None
                    rule.day_of_month = recurrence_rule_data.get('day_of_month')
                    rule.week_of_month = recurrence_rule_data.get('week_of_month')
                    rule.day_of_week = recurrence_rule_data.get('day_of_week')
                    rule.end_date = validate_datetime_string(recurrence_rule_data['end_date'])[
                        1] if recurrence_rule_data.get('end_date') else None
                    rule.occurrence_count = recurrence_rule_data.get('occurrence_count')
                    rule.updated_at = datetime.utcnow()
                else:
                    # Create new rule
                    new_rule = RecurrenceRule(
                        event_id=event.id,
                        frequency=recurrence_rule_data['frequency'],
                        interval=recurrence_rule_data.get('interval', 1),
                        days_of_week=','.join(recurrence_rule_data['days_of_week']) if recurrence_rule_data.get(
                            'days_of_week') else None,
                        day_of_month=recurrence_rule_data.get('day_of_month'),
                        week_of_month=recurrence_rule_data.get('week_of_month'),
                        day_of_week=recurrence_rule_data.get('day_of_week'),
                        end_date=validate_datetime_string(recurrence_rule_data['end_date'])[
                            1] if recurrence_rule_data.get('end_date') else None,
                        occurrence_count=recurrence_rule_data.get('occurrence_count')
                    )
                    db.session.add(new_rule)

                    # Generate recurrence ID if not exists
                    if not event.recurrence_id:
                        updates['recurrence_id'] = RecurrenceGenerator.generate_recurrence_id()

                updates['is_recurring'] = True
            else:
                # Remove recurrence rule
                if event.recurrence_rule:
                    db.session.delete(event.recurrence_rule)
                updates['is_recurring'] = False
                updates['recurrence_id'] = None

        # Apply updates
        for key, value in updates.items():
            setattr(event, key, value)

        event.updated_at = datetime.utcnow()

        # Update relative reminders if start_datetime changed
        if 'start_datetime' in updates:
            relative_reminders = Reminder.query.filter_by(event_id=event.id, is_relative=True).all()
            for reminder in relative_reminders:
                if reminder.minutes_before is not None:
                    new_reminder_time = updates['start_datetime'] - timedelta(minutes=reminder.minutes_before)
                    current_time_utc = datetime.now(timezone.utc)
                    if new_reminder_time > current_time_utc:  # Only update if not in the past
                        reminder.reminder_time = new_reminder_time
                        reminder.updated_at = datetime.utcnow()

        db.session.commit()

        # Return updated event
        event_data = {
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "start_datetime": event.start_datetime.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
            "end_datetime": event.end_datetime.replace(tzinfo=timezone.utc).isoformat().replace('+00:00',
                                                                                                'Z') if event.end_datetime else None,
            "is_all_day": event.is_all_day,
            "color": event.color,
            "is_recurring": event.is_recurring,
            "recurrence_id": event.recurrence_id,
            "created_at": event.created_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
            "updated_at": event.updated_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
            "categories": [cat.to_dict() for cat in event.categories]
        }

        if event.recurrence_rule:
            event_data["recurrence_rule"] = event.recurrence_rule.to_dict()

        logger.info(f"Event {event_id} updated by user {current_user.username}")
        return success_response(data=event_data, message="Event updated successfully")

    except Exception as e:
        logger.error(f"Error updating event {event_id}: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while updating the event", 500)


@events_bp.route('/<int:event_id>', methods=['DELETE'])
@jwt_required()
@handle_database_errors
@log_request_info
def delete_event(event_id):
    """
    Delete an event

    Parameters:
    - event_id: ID of the event

    Returns:
    - Success response
    """
    try:
        event = Event.query.filter_by(id=event_id, user_id=current_user.id).first()

        if not event:
            return error_response("Event not found", 404)

        event_title = event.title
        db.session.delete(event)
        db.session.commit()

        logger.info(f"Event {event_id} ({event_title}) deleted by user {current_user.username}")
        return success_response(message="Event deleted successfully")

    except Exception as e:
        logger.error(f"Error deleting event {event_id}: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while deleting the event", 500)


@events_bp.route('/<int:event_id>/move', methods=['PUT'])
@jwt_required()
@handle_validation_errors
@handle_database_errors
@log_request_info
def move_event(event_id):
    """
    Update event dates (for drag and drop functionality)

    Parameters:
    - event_id: ID of the event

    Request body:
    - start_datetime: New start datetime
    - end_datetime: (optional) New end datetime

    Returns:
    - Success response with updated event details
    """
    try:
        event = Event.query.filter_by(id=event_id, user_id=current_user.id).first()

        if not event:
            return error_response("Event not found", 404)

        data = request.get_json()

        if not data:
            return error_response("Invalid request data", 400)

        # Required field
        start_datetime_str = data.get('start_datetime')

        if not start_datetime_str:
            return error_response("Start datetime is required", 400)

        # Validate start_datetime
        is_valid, start_dt_obj = validate_datetime_string(start_datetime_str)
        if not is_valid:
            return error_response(start_dt_obj, 400)

        # Update start datetime
        old_start = event.start_datetime
        event.start_datetime = start_dt_obj

        # Update end datetime if provided
        if 'end_datetime' in data:
            if data['end_datetime'] is None:
                event.end_datetime = None
            else:
                end_datetime_str = data['end_datetime']
                is_valid, end_dt_obj = validate_datetime_string(end_datetime_str)
                if not is_valid:
                    return error_response(end_dt_obj, 400)

                # Ensure end datetime is after start datetime
                if end_dt_obj <= start_dt_obj:
                    return error_response("End datetime must be after start datetime", 400)

                event.end_datetime = end_dt_obj
        elif event.end_datetime:
            # If end datetime not provided but exists, adjust it to maintain the same duration
            duration = event.end_datetime - old_start
            event.end_datetime = start_dt_obj + duration

        # Update relative reminders
        relative_reminders = Reminder.query.filter_by(event_id=event.id, is_relative=True).all()
        for reminder in relative_reminders:
            if reminder.minutes_before is not None:
                new_reminder_time = start_dt_obj - timedelta(minutes=reminder.minutes_before)
                current_time_utc = datetime.now(timezone.utc)
                if new_reminder_time > current_time_utc:  # Only update if not in the past
                    reminder.reminder_time = new_reminder_time
                    reminder.updated_at = datetime.utcnow()

        event.updated_at = datetime.utcnow()
        db.session.commit()

        # Return updated event
        event_data = {
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "start_datetime": event.start_datetime.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
            "end_datetime": event.end_datetime.replace(tzinfo=timezone.utc).isoformat().replace('+00:00',
                                                                                                'Z') if event.end_datetime else None,
            "is_all_day": event.is_all_day,
            "color": event.color,
            "is_recurring": event.is_recurring,
            "recurrence_id": event.recurrence_id,
            "created_at": event.created_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
            "updated_at": event.updated_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
            "categories": [cat.to_dict() for cat in event.categories]
        }

        if event.recurrence_rule:
            event_data["recurrence_rule"] = event.recurrence_rule.to_dict()

        logger.info(f"Event {event_id} moved by user {current_user.username}")
        return success_response(data=event_data, message="Event moved successfully")

    except Exception as e:
        logger.error(f"Error moving event {event_id}: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while moving the event", 500)


@events_bp.route('/bulk-delete', methods=['DELETE'])
@jwt_required()
@rate_limit(limit=10, window=300)  # 10 bulk operations per 5 minutes
@handle_database_errors
@log_request_info
def bulk_delete_events():
    """
    Delete multiple events at once

    Request body:
    - event_ids: List of event IDs to delete

    Returns:
    - Success response with deletion summary
    """
    try:
        data = request.get_json()

        if not data or 'event_ids' not in data:
            return error_response("Event IDs are required", 400)

        event_ids = data['event_ids']

        if not isinstance(event_ids, list) or not event_ids:
            return error_response("Event IDs must be a non-empty list", 400)

        # Find events that belong to the current user
        events = Event.query.filter(
            Event.id.in_(event_ids),
            Event.user_id == current_user.id
        ).all()

        if not events:
            return error_response("No events found to delete", 404)

        # Check if all requested events were found
        found_ids = [event.id for event in events]
        not_found_ids = [id for id in event_ids if id not in found_ids]

        # Delete found events
        deleted_count = len(events)
        for event in events:
            db.session.delete(event)

        db.session.commit()

        response_data = {
            "deleted_count": deleted_count,
            "deleted_ids": found_ids
        }

        if not_found_ids:
            response_data["not_found_ids"] = not_found_ids

        logger.info(f"Bulk deleted {deleted_count} events by user {current_user.username}")
        return success_response(
            data=response_data,
            message=f"Successfully deleted {deleted_count} event(s)"
        )

    except Exception as e:
        logger.error(f"Error in bulk delete events: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while deleting events", 500)


@events_bp.route('/bulk/move', methods=['PUT'])
@jwt_required()
@rate_limit(limit=10, window=300)  # 10 bulk operations per 5 minutes
@handle_validation_errors
@handle_database_errors
@log_request_info
def bulk_move_events():
    """
    Move multiple events by a time offset

    Request body:
    - event_ids: List of event IDs to move
    - time_offset_minutes: Number of minutes to move events (can be negative)

    Returns:
    - Success response with updated events
    """
    try:
        data = request.get_json()

        if not data or 'event_ids' not in data or 'time_offset_minutes' not in data:
            return error_response("Event IDs and time_offset_minutes are required", 400)

        event_ids = data['event_ids']
        time_offset_minutes = data['time_offset_minutes']

        if not isinstance(event_ids, list) or not event_ids:
            return error_response("Event IDs must be a non-empty list", 400)

        if not isinstance(time_offset_minutes, int):
            return error_response("time_offset_minutes must be an integer", 400)

        # Find events that belong to the current user
        events = Event.query.filter(
            Event.id.in_(event_ids),
            Event.user_id == current_user.id
        ).all()

        if not events:
            return error_response("No events found to move", 404)

        time_offset = timedelta(minutes=time_offset_minutes)
        updated_events = []
        errors = []

        for event in events:
            try:
                # Calculate new times
                new_start = event.start_datetime + time_offset
                new_end = event.end_datetime + time_offset if event.end_datetime else None

                # Update event times
                event.start_datetime = new_start
                if new_end:
                    event.end_datetime = new_end

                # Update relative reminders
                relative_reminders = Reminder.query.filter_by(event_id=event.id, is_relative=True).all()
                for reminder in relative_reminders:
                    if reminder.minutes_before is not None:
                        new_reminder_time = new_start - timedelta(minutes=reminder.minutes_before)
                        current_time_utc = datetime.now(timezone.utc)
                        if new_reminder_time > current_time_utc:  # Only update if not in the past
                            reminder.reminder_time = new_reminder_time
                            reminder.updated_at = datetime.utcnow()

                event.updated_at = datetime.utcnow()
                updated_events.append(event)

            except Exception as e:
                errors.append(f"Event {event.id}: {str(e)}")

        db.session.commit()

        # Prepare response data
        events_data = []
        for event in updated_events:
            events_data.append({
                "id": event.id,
                "title": event.title,
                "start_datetime": event.start_datetime.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
                "end_datetime": event.end_datetime.replace(tzinfo=timezone.utc).isoformat().replace('+00:00',
                                                                                                    'Z') if event.end_datetime else None,
            })

        response_data = {
            "updated_count": len(updated_events),
            "events": events_data
        }

        if errors:
            response_data["errors"] = errors

        message = f"Successfully moved {len(updated_events)} event(s)"
        if errors:
            message += f" with {len(errors)} error(s)"

        logger.info(f"Bulk moved {len(updated_events)} events by user {current_user.username}")
        return success_response(data=response_data, message=message)

    except Exception as e:
        logger.error(f"Error in bulk move events: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while moving events", 500)


@events_bp.route('/bulk/copy', methods=['POST'])
@jwt_required()
@rate_limit(limit=5, window=300)  # 5 bulk copy operations per 5 minutes
@handle_validation_errors
@handle_database_errors
@log_request_info
def bulk_copy_events():
    """
    Copy multiple events

    Request body:
    - event_ids: List of event IDs to copy
    - time_offset_minutes: (optional) Number of minutes to offset copied events
    - copy_reminders: (optional) Whether to copy reminders (default: false)

    Returns:
    - Success response with copied events
    """
    try:
        data = request.get_json()

        if not data or 'event_ids' not in data:
            return error_response("Event IDs are required", 400)

        event_ids = data['event_ids']
        time_offset_minutes = data.get('time_offset_minutes', 0)
        copy_reminders = data.get('copy_reminders', False)

        if not isinstance(event_ids, list) or not event_ids:
            return error_response("Event IDs must be a non-empty list", 400)

        if len(event_ids) > 20:  # Limit bulk copy operations
            return error_response("Cannot copy more than 20 events at once", 400)

        # Find events that belong to the current user
        events = Event.query.filter(
            Event.id.in_(event_ids),
            Event.user_id == current_user.id
        ).all()

        if not events:
            return error_response("No events found to copy", 404)

        time_offset = timedelta(minutes=time_offset_minutes)
        copied_events = []
        errors = []

        for event in events:
            try:
                # Calculate new times
                new_start = event.start_datetime + time_offset
                new_end = event.end_datetime + time_offset if event.end_datetime else None

                # Create new event
                new_event = Event(
                    user_id=current_user.id,
                    title=f"Copy of {event.title}",
                    description=event.description,
                    start_datetime=new_start,
                    end_datetime=new_end,
                    is_all_day=event.is_all_day,
                    color=event.color,
                    is_recurring=False,  # Don't copy recurrence rules
                    recurrence_id=None
                )

                # Copy categories
                new_event.categories = event.categories

                db.session.add(new_event)
                db.session.flush()  # Get the ID

                # Copy reminders if requested
                if copy_reminders:
                    for reminder in event.reminders:
                        if reminder.is_relative and reminder.minutes_before is not None:
                            # Relative reminder
                            new_reminder_time = new_start - timedelta(minutes=reminder.minutes_before)
                        else:
                            # Absolute reminder - offset by the same amount
                            new_reminder_time = reminder.reminder_time + time_offset

                        # Only create reminder if it's in the future
                        current_time_utc = datetime.now(timezone.utc)
                        if new_reminder_time > current_time_utc:
                            new_reminder = Reminder(
                                event_id=new_event.id,
                                reminder_time=new_reminder_time,
                                notification_sent=False,
                                notification_type=reminder.notification_type,
                                minutes_before=reminder.minutes_before,
                                is_relative=reminder.is_relative
                            )
                            db.session.add(new_reminder)

                copied_events.append(new_event)

            except Exception as e:
                errors.append(f"Event {event.id}: {str(e)}")

        db.session.commit()

        # Prepare response data
        events_data = []
        for event in copied_events:
            events_data.append({
                "id": event.id,
                "title": event.title,
                "start_datetime": event.start_datetime.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
                "end_datetime": event.end_datetime.replace(tzinfo=timezone.utc).isoformat().replace('+00:00',
                                                                                                    'Z') if event.end_datetime else None,
                "categories": [cat.to_dict() for cat in event.categories]
            })

        response_data = {
            "copied_count": len(copied_events),
            "events": events_data
        }

        if errors:
            response_data["errors"] = errors

        message = f"Successfully copied {len(copied_events)} event(s)"
        if errors:
            message += f" with {len(errors)} error(s)"

        logger.info(f"Bulk copied {len(copied_events)} events by user {current_user.username}")
        return success_response(data=response_data, message=message, status_code=201)

    except Exception as e:
        logger.error(f"Error in bulk copy events: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while copying events", 500)