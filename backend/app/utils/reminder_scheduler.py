from datetime import datetime, timezone, timedelta
from .. import scheduler, db, create_app
from ..models import Reminder, Event, User
from ..utils.email_service import email_service
from .logger import logger
import os


def _to_aware_utc(dt: datetime) -> datetime | None:
    """Normalize a datetime to timezone-aware UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def check_reminders():
    """
    Check for upcoming reminders and send notifications
    This function will be called periodically by the scheduler
    """
    try:
        # Get environment from FLASK_ENV or default to development
        env = os.getenv('FLASK_ENV', 'development')

        # Create app with the same configuration as main app
        app = create_app(env)

        # Create and activate an application context
        with app.app_context():
            # Use timezone-aware UTC for "now"
            current_time_utc = datetime.now(timezone.utc)
            one_minute_later = current_time_utc + timedelta(minutes=1)

            # Find reminders that are due within the next minute and not yet sent
            upcoming_reminders = Reminder.query.filter(
                Reminder.reminder_time <= one_minute_later,
                Reminder.notification_sent == False
            ).all()

            # Process each reminder
            for reminder in upcoming_reminders:
                try:
                    # Normalize reminder time to aware UTC before Python-side comparisons
                    reminder_time_utc = _to_aware_utc(reminder.reminder_time)
                    if not reminder_time_utc:
                        logger.warning(f"Reminder {reminder.id} has no reminder_time; skipping")
                        continue

                    # Only send if the reminder time is due (<= now)
                    if reminder_time_utc > current_time_utc:
                        continue  # not due yet; will be picked up in a subsequent run

                    # Get associated event
                    event = Event.query.get(reminder.event_id)
                    if not event:
                        logger.warning(f"Reminder {reminder.id} references non-existent event {reminder.event_id}")
                        continue

                    # Get user
                    user = User.query.get(event.user_id)
                    if not user:
                        logger.warning(f"Event {event.id} references non-existent user {event.user_id}")
                        continue

                    # Send notification based on type
                    notification_sent = False

                    if reminder.notification_type == 'email':
                        # Send email notification with UTC ISO timestamp
                        event_time_utc = _to_aware_utc(event.start_datetime)
                        event_time_str = event_time_utc.isoformat().replace('+00:00', 'Z') if event_time_utc else ''
                        notification_sent = email_service.send_reminder_notification(
                            user.email,
                            user.username,
                            event.title,
                            event_time_str
                        )
                    elif reminder.notification_type == 'push':
                        # TODO: Implement push notification
                        logger.info(f"Push notification not implemented yet for reminder {reminder.id}")
                        notification_sent = True  # Mark as sent for now
                    elif reminder.notification_type == 'sms':
                        # TODO: Implement SMS notification
                        logger.info(f"SMS notification not implemented yet for reminder {reminder.id}")
                        notification_sent = True  # Mark as sent for now
                    else:
                        logger.warning(f"Unknown notification type '{reminder.notification_type}' for reminder {reminder.id}")
                        notification_sent = True  # Avoid retry loop for unknown types

                    if notification_sent:
                        # Mark reminder as sent
                        reminder.notification_sent = True
                        db.session.commit()

                        logger.info(
                            f"Reminder notification sent for user {user.username}: Event '{event.title}' "
                            f"starts at {event.start_datetime}"
                        )
                    else:
                        logger.error(f"Failed to send reminder notification for reminder {reminder.id}")

                except Exception as inner_e:
                    logger.error(f"Error processing reminder {reminder.id}: {str(inner_e)}")
                    db.session.rollback()

    except Exception as e:
        logger.error(f"Error checking reminders: {str(e)}")


def cleanup_old_tokens():
    """
    Clean up expired tokens from the database
    """
    try:
        env = os.getenv('FLASK_ENV', 'development')
        app = create_app(env)

        with app.app_context():
            from ..models import EmailVerificationToken, PasswordResetToken

            current_time_utc = datetime.now(timezone.utc)

            # Clean up expired email verification tokens
            expired_email_tokens = EmailVerificationToken.query.filter(
                EmailVerificationToken.expires_at < current_time_utc
            ).all()

            for token in expired_email_tokens:
                db.session.delete(token)

            # Clean up expired password reset tokens
            expired_reset_tokens = PasswordResetToken.query.filter(
                PasswordResetToken.expires_at < current_time_utc
            ).all()

            for token in expired_reset_tokens:
                db.session.delete(token)

            db.session.commit()

            if expired_email_tokens or expired_reset_tokens:
                logger.info(
                    f"Cleaned up {len(expired_email_tokens)} expired email verification tokens "
                    f"and {len(expired_reset_tokens)} expired password reset tokens"
                )

    except Exception as e:
        logger.error(f"Error cleaning up expired tokens: {str(e)}")


def init_reminder_scheduler():
    """Initialize the reminder scheduler with enhanced functionality"""
    # Check reminders every minute
    scheduler.add_job(
        func=check_reminders,
        trigger="interval",
        minutes=1,
        id="check_reminders",
        replace_existing=True
    )

    # Clean up expired tokens every hour
    scheduler.add_job(
        func=cleanup_old_tokens,
        trigger="interval",
        hours=1,
        id="cleanup_tokens",
        replace_existing=True
    )

    logger.info("Enhanced reminder scheduler initialized")