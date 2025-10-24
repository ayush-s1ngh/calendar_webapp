from datetime import datetime, timedelta
from .. import scheduler, db, create_app
from ..models import Reminder, Event, User
from ..utils.email_service import email_service
from .logger import logger
import os


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
            # Get current time
            current_time = datetime.utcnow()

            # Find reminders that are due within the next minute and not yet sent
            upcoming_reminders = Reminder.query.filter(
                Reminder.reminder_time <= current_time + timedelta(minutes=1),
                Reminder.notification_sent == False
            ).all()

            # Process each reminder
            for reminder in upcoming_reminders:
                try:
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
                        # Send email notification
                        event_time = event.start_datetime.strftime('%Y-%m-%d %H:%M UTC')
                        notification_sent = email_service.send_reminder_notification(
                            user.email,
                            user.username,
                            event.title,
                            event_time
                        )
                    elif reminder.notification_type == 'push':
                        # TODO: Implement push notification
                        logger.info(f"Push notification not implemented yet for reminder {reminder.id}")
                        notification_sent = True  # Mark as sent for now
                    elif reminder.notification_type == 'sms':
                        # TODO: Implement SMS notification
                        logger.info(f"SMS notification not implemented yet for reminder {reminder.id}")
                        notification_sent = True  # Mark as sent for now

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

            # Clean up expired email verification tokens
            expired_email_tokens = EmailVerificationToken.query.filter(
                EmailVerificationToken.expires_at < datetime.utcnow()
            ).all()

            for token in expired_email_tokens:
                db.session.delete(token)

            # Clean up expired password reset tokens
            expired_reset_tokens = PasswordResetToken.query.filter(
                PasswordResetToken.expires_at < datetime.utcnow()
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