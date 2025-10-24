from flask import request
from flask_jwt_extended import jwt_required, current_user
from datetime import datetime, timezone, timedelta

from ... import db
from . import reminders_bp
from ...models import Reminder, Event
from ...utils.responses import success_response, error_response
from ...utils.validators import validate_datetime_string
from ...utils.rate_limiter import rate_limit
from ...utils.error_handler import handle_validation_errors, handle_database_errors, log_request_info
from ...utils.logger import logger


@reminders_bp.route('/event/<int:event_id>/reminders', methods=['GET'])
@jwt_required()
@log_request_info
def get_event_reminders(event_id):
    """
    Get reminders for an event

    Parameters:
    - event_id: ID of the event

    Returns:
    - Success response with list of reminders
    """
    try:
        # Check if event exists and belongs to the current user
        event = Event.query.filter_by(id=event_id, user_id=current_user.id).first()

        if not event:
            return error_response("Event not found", 404)

        # Get reminders for the event
        reminders = Reminder.query.filter_by(event_id=event_id).order_by(Reminder.reminder_time).all()

        reminders_data = []
        for reminder in reminders:
            reminders_data.append({
                "id": reminder.id,
                "event_id": reminder.event_id,
                "reminder_time": reminder.reminder_time.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
                "notification_sent": reminder.notification_sent,
                "notification_type": reminder.notification_type,
                "minutes_before": reminder.minutes_before,
                "is_relative": reminder.is_relative,
                "created_at": reminder.created_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
                "updated_at": reminder.updated_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
            })

        return success_response(data={"reminders": reminders_data})

    except Exception as e:
        logger.error(f"Error retrieving reminders for event {event_id}: {str(e)}")
        return error_response("An error occurred while retrieving reminders", 500)


@reminders_bp.route('/event/<int:event_id>/reminders', methods=['POST'])
@jwt_required()
@rate_limit(limit=50, window=300)  # 50 reminders per 5 minutes
@handle_validation_errors
@handle_database_errors
@log_request_info
def create_reminder(event_id):
    """
    Create a reminder for an event

    Parameters:
    - event_id: ID of the event

    Request body:
    - reminder_time: (optional) Reminder time (ISO format) for absolute reminders
    - minutes_before: (optional) Minutes before event for relative reminders
    - notification_type: (optional) Type of notification ('email', 'push', 'sms')

    Returns:
    - Success response with created reminder details
    """
    try:
        # Check if event exists and belongs to the current user
        event = Event.query.filter_by(id=event_id, user_id=current_user.id).first()

        if not event:
            return error_response("Event not found", 404)

        data = request.get_json()

        if not data:
            return error_response("Invalid request data", 400)

        # Optional fields
        reminder_time_str = data.get('reminder_time')
        minutes_before = data.get('minutes_before')
        notification_type = data.get('notification_type', 'email')

        # Validate that either reminder_time or minutes_before is provided
        if not reminder_time_str and minutes_before is None:
            return error_response("Either reminder_time or minutes_before must be provided", 400)

        if reminder_time_str and minutes_before is not None:
            return error_response("Cannot specify both reminder_time and minutes_before", 400)

        # Validate notification type
        valid_types = ['email', 'push', 'sms']
        if notification_type not in valid_types:
            return error_response(f"Invalid notification type. Must be one of: {', '.join(valid_types)}", 400)

        # Calculate reminder time and determine if it's relative
        if minutes_before is not None:
            # Relative reminder
            if not isinstance(minutes_before, int) or minutes_before < 0:
                return error_response("minutes_before must be a non-negative integer", 400)

            # Prevent past reminders
            reminder_time_obj = event.start_datetime - timedelta(minutes=minutes_before)
            if reminder_time_obj <= datetime.utcnow():
                return error_response("Calculated reminder time cannot be in the past", 400)

            is_relative = True
        else:
            # Absolute reminder
            is_valid, reminder_time_obj = validate_datetime_string(reminder_time_str)
            if not is_valid:
                return error_response(reminder_time_obj, 400)

            # Prevent past reminders
            if reminder_time_obj <= datetime.utcnow():
                return error_response("Reminder time cannot be in the past", 400)

            # Ensure reminder is before event start time
            event_start = event.start_datetime
            if event_start.tzinfo is None:
                event_start = event_start.replace(tzinfo=timezone.utc)

            if reminder_time_obj >= event_start:
                return error_response("Reminder time must be before event start time", 400)

            is_relative = False
            minutes_before = None

        # Check for duplicate reminders
        existing_reminder = Reminder.query.filter_by(
            event_id=event_id,
            reminder_time=reminder_time_obj
        ).first()

        if existing_reminder:
            return error_response("A reminder for this time already exists", 409)

        # Create new reminder
        new_reminder = Reminder(
            event_id=event_id,
            reminder_time=reminder_time_obj,
            notification_sent=False,
            notification_type=notification_type,
            minutes_before=minutes_before,
            is_relative=is_relative
        )

        # Save to database
        db.session.add(new_reminder)
        db.session.commit()

        # Return created reminder
        reminder_data = {
            "id": new_reminder.id,
            "event_id": new_reminder.event_id,
            "reminder_time": new_reminder.reminder_time.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
            "notification_sent": new_reminder.notification_sent,
            "notification_type": new_reminder.notification_type,
            "minutes_before": new_reminder.minutes_before,
            "is_relative": new_reminder.is_relative,
            "created_at": new_reminder.created_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
            "updated_at": new_reminder.updated_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
        }

        logger.info(f"Reminder created for event {event_id} by user {current_user.username}")
        return success_response(data={"reminder": reminder_data}, message="Reminder created successfully", status_code=201)

    except Exception as e:
        logger.error(f"Error creating reminder for event {event_id}: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while creating the reminder", 500)


@reminders_bp.route('/<int:reminder_id>', methods=['PUT'])
@jwt_required()
@handle_validation_errors
@handle_database_errors
@log_request_info
def update_reminder(reminder_id):
    """
    Update a reminder

    Parameters:
    - reminder_id: ID of the reminder

    Request body:
    - reminder_time: (optional) New reminder time (ISO format)
    - minutes_before: (optional) New minutes before event
    - notification_type: (optional) New notification type

    Returns:
    - Success response with updated reminder details
    """
    try:
        # Find reminder
        reminder = Reminder.query.filter_by(id=reminder_id).first()

        if not reminder:
            return error_response("Reminder not found", 404)

        # Verify that the event associated with the reminder belongs to the current user
        event = Event.query.filter_by(id=reminder.event_id, user_id=current_user.id).first()

        if not event:
            return error_response("Unauthorized access to this reminder", 403)

        data = request.get_json()

        if not data:
            return error_response("Invalid request data", 400)

        # Process updates
        updates = {}

        # Update notification type if provided
        if 'notification_type' in data:
            notification_type = data['notification_type']
            valid_types = ['email', 'push', 'sms']
            if notification_type not in valid_types:
                return error_response(f"Invalid notification type. Must be one of: {', '.join(valid_types)}", 400)
            updates['notification_type'] = notification_type

        # Update reminder time/minutes_before if provided
        if 'reminder_time' in data or 'minutes_before' in data:
            reminder_time_str = data.get('reminder_time')
            minutes_before = data.get('minutes_before')

            if reminder_time_str and minutes_before is not None:
                return error_response("Cannot specify both reminder_time and minutes_before", 400)

            if minutes_before is not None:
                # Relative reminder
                if not isinstance(minutes_before, int) or minutes_before < 0:
                    return error_response("minutes_before must be a non-negative integer", 400)

                reminder_time_obj = event.start_datetime - timedelta(minutes=minutes_before)
                if reminder_time_obj <= datetime.utcnow():
                    return error_response("Calculated reminder time cannot be in the past", 400)

                updates['reminder_time'] = reminder_time_obj
                updates['minutes_before'] = minutes_before
                updates['is_relative'] = True

            elif reminder_time_str:
                # Absolute reminder
                is_valid, reminder_time_obj = validate_datetime_string(reminder_time_str)
                if not is_valid:
                    return error_response(reminder_time_obj, 400)

                if reminder_time_obj <= datetime.utcnow():
                    return error_response("Reminder time cannot be in the past", 400)

                event_start = event.start_datetime
                if event_start.tzinfo is None:
                    event_start = event_start.replace(tzinfo=timezone.utc)

                if reminder_time_obj >= event_start:
                    return error_response("Reminder time must be before event start time", 400)

                updates['reminder_time'] = reminder_time_obj
                updates['minutes_before'] = None
                updates['is_relative'] = False

        # Apply updates
        for key, value in updates.items():
            setattr(reminder, key, value)

        reminder.updated_at = datetime.utcnow()
        db.session.commit()

        # Return updated reminder
        reminder_data = {
            "id": reminder.id,
            "event_id": reminder.event_id,
            "reminder_time": reminder.reminder_time.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
            "notification_sent": reminder.notification_sent,
            "notification_type": reminder.notification_type,
            "minutes_before": reminder.minutes_before,
            "is_relative": reminder.is_relative,
            "created_at": reminder.created_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
            "updated_at": reminder.updated_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
        }

        logger.info(f"Reminder {reminder_id} updated by user {current_user.username}")
        return success_response(data={"reminder": reminder_data}, message="Reminder updated successfully")

    except Exception as e:
        logger.error(f"Error updating reminder {reminder_id}: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while updating the reminder", 500)


@reminders_bp.route('/<int:reminder_id>', methods=['DELETE'])
@jwt_required()
@handle_database_errors
@log_request_info
def delete_reminder(reminder_id):
    """
    Delete a reminder

    Parameters:
    - reminder_id: ID of the reminder

    Returns:
    - Success response
    """
    try:
        # Find reminder
        reminder = Reminder.query.filter_by(id=reminder_id).first()

        if not reminder:
            return error_response("Reminder not found", 404)

        # Verify that the event associated with the reminder belongs to the current user
        event = Event.query.filter_by(id=reminder.event_id, user_id=current_user.id).first()

        if not event:
            return error_response("Unauthorized access to this reminder", 403)

        # Delete reminder
        db.session.delete(reminder)
        db.session.commit()

        logger.info(f"Reminder {reminder_id} deleted by user {current_user.username}")
        return success_response(message="Reminder deleted successfully")

    except Exception as e:
        logger.error(f"Error deleting reminder {reminder_id}: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while deleting the reminder", 500)


@reminders_bp.route('/bulk', methods=['POST'])
@jwt_required()
@rate_limit(limit=10, window=300)  # 10 bulk operations per 5 minutes
@handle_validation_errors
@handle_database_errors
@log_request_info
def create_bulk_reminders():
    """
    Create multiple reminders at once

    Request body:
    - reminders: List of reminder objects with event_id and reminder details

    Returns:
    - Success response with created reminders
    """
    try:
        data = request.get_json()

        if not data or 'reminders' not in data:
            return error_response("Reminders list is required", 400)

        reminders_data = data['reminders']

        if not isinstance(reminders_data, list) or not reminders_data:
            return error_response("Reminders must be a non-empty list", 400)

        if len(reminders_data) > 50:  # Limit bulk operations
            return error_response("Cannot create more than 50 reminders at once", 400)

        created_reminders = []
        errors = []

        # Validate all events belong to current user first
        event_ids = [r.get('event_id') for r in reminders_data if r.get('event_id')]
        events = Event.query.filter(
            Event.id.in_(event_ids),
            Event.user_id == current_user.id
        ).all()

        valid_event_ids = {event.id: event for event in events}

        for idx, reminder_data in enumerate(reminders_data):
            try:
                event_id = reminder_data.get('event_id')
                if not event_id or event_id not in valid_event_ids:
                    errors.append(f"Reminder {idx + 1}: Invalid or unauthorized event")
                    continue

                event = valid_event_ids[event_id]

                # Validate reminder data (similar to single create)
                reminder_time_str = reminder_data.get('reminder_time')
                minutes_before = reminder_data.get('minutes_before')
                notification_type = reminder_data.get('notification_type', 'email')

                if not reminder_time_str and minutes_before is None:
                    errors.append(f"Reminder {idx + 1}: Either reminder_time or minutes_before must be provided")
                    continue

                if reminder_time_str and minutes_before is not None:
                    errors.append(f"Reminder {idx + 1}: Cannot specify both reminder_time and minutes_before")
                    continue

                # Calculate reminder time
                if minutes_before is not None:
                    if not isinstance(minutes_before, int) or minutes_before < 0:
                        errors.append(f"Reminder {idx + 1}: minutes_before must be a non-negative integer")
                        continue

                    reminder_time_obj = event.start_datetime - timedelta(minutes=minutes_before)
                    if reminder_time_obj <= datetime.utcnow():
                        errors.append(f"Reminder {idx + 1}: Calculated reminder time cannot be in the past")
                        continue

                    is_relative = True
                else:
                    is_valid, reminder_time_obj = validate_datetime_string(reminder_time_str)
                    if not is_valid:
                        errors.append(f"Reminder {idx + 1}: {reminder_time_obj}")
                        continue

                    if reminder_time_obj <= datetime.utcnow():
                        errors.append(f"Reminder {idx + 1}: Reminder time cannot be in the past")
                        continue

                    event_start = event.start_datetime
                    if event_start.tzinfo is None:
                        event_start = event_start.replace(tzinfo=timezone.utc)

                    if reminder_time_obj >= event_start:
                        errors.append(f"Reminder {idx + 1}: Reminder time must be before event start time")
                        continue

                    is_relative = False
                    minutes_before = None

                # Create reminder
                new_reminder = Reminder(
                    event_id=event_id,
                    reminder_time=reminder_time_obj,
                    notification_sent=False,
                    notification_type=notification_type,
                    minutes_before=minutes_before,
                    is_relative=is_relative
                )

                db.session.add(new_reminder)
                created_reminders.append(new_reminder)

            except Exception as e:
                errors.append(f"Reminder {idx + 1}: {str(e)}")

        # Commit all valid reminders
        if created_reminders:
            db.session.commit()

        # Prepare response data
        created_data = []
        for reminder in created_reminders:
            created_data.append({
                "id": reminder.id,
                "event_id": reminder.event_id,
                "reminder_time": reminder.reminder_time.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z'),
                "notification_type": reminder.notification_type,
                "minutes_before": reminder.minutes_before,
                "is_relative": reminder.is_relative
            })

        response_data = {
            "created_count": len(created_reminders),
            "reminders": created_data
        }

        if errors:
            response_data["errors"] = errors

        message = f"Successfully created {len(created_reminders)} reminder(s)"
        if errors:
            message += f" with {len(errors)} error(s)"

        logger.info(f"Bulk created {len(created_reminders)} reminders by user {current_user.username}")
        return success_response(data=response_data, message=message, status_code=201)

    except Exception as e:
        logger.error(f"Error in bulk create reminders: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while creating reminders", 500)


@reminders_bp.route('/bulk', methods=['DELETE'])
@jwt_required()
@rate_limit(limit=10, window=300)  # 10 bulk operations per 5 minutes
@handle_database_errors
@log_request_info
def delete_bulk_reminders():
    """
    Delete multiple reminders at once

    Request body:
    - reminder_ids: List of reminder IDs to delete

    Returns:
    - Success response with deletion summary
    """
    try:
        data = request.get_json()

        if not data or 'reminder_ids' not in data:
            return error_response("Reminder IDs are required", 400)

        reminder_ids = data['reminder_ids']

        if not isinstance(reminder_ids, list) or not reminder_ids:
            return error_response("Reminder IDs must be a non-empty list", 400)

        if len(reminder_ids) > 100:  # Limit bulk operations
            return error_response("Cannot delete more than 100 reminders at once", 400)

        # Find reminders belonging to the current user's events
        reminders = db.session.query(Reminder).join(Event).filter(
            Reminder.id.in_(reminder_ids),
            Event.user_id == current_user.id
        ).all()

        if not reminders:
            return error_response("No reminders found to delete", 404)

        # Check if all requested reminders were found
        found_ids = [reminder.id for reminder in reminders]
        not_found_ids = [id for id in reminder_ids if id not in found_ids]

        # Delete found reminders
        deleted_count = len(reminders)
        for reminder in reminders:
            db.session.delete(reminder)

        db.session.commit()

        response_data = {
            "deleted_count": deleted_count,
            "deleted_ids": found_ids
        }

        if not_found_ids:
            response_data["not_found_ids"] = not_found_ids

        logger.info(f"Bulk deleted {deleted_count} reminders by user {current_user.username}")
        return success_response(
            data=response_data,
            message=f"Successfully deleted {deleted_count} reminder(s)"
        )

    except Exception as e:
        logger.error(f"Error in bulk delete reminders: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while deleting reminders", 500)