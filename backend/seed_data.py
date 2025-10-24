import sys
import datetime
from app import create_app, db
from app.models import User, Event, Reminder, Category, RecurrenceRule, EmailVerificationToken, PasswordResetToken, \
    OAuthAccount


def seed_database():
    """Seed the database with Phase 2 test data"""
    # Create the Flask app context
    app = create_app('development')

    with app.app_context():
        # Clear the database
        db.drop_all()
        db.create_all()

        print("Creating test users...")

        # Create verified user
        user1 = User(
            username="test_user",
            email="test@example.com",
            password="TestPass123",
            email_verified=True
        )

        # Create unverified user
        user2 = User(
            username="demo_user",
            email="demo@example.com",
            password="DemoPass123",
            email_verified=False
        )

        # Create OAuth user (Google)
        user3 = User(
            username="google_user",
            email="google@example.com",
            email_verified=True
        )

        db.session.add(user1)
        db.session.add(user2)
        db.session.add(user3)
        db.session.commit()

        print("Creating categories...")

        # Categories for user1
        work_category = Category(
            user_id=user1.id,
            name="Work",
            color="blue",
            description="Work-related events and meetings"
        )

        personal_category = Category(
            user_id=user1.id,
            name="Personal",
            color="green",
            description="Personal activities and appointments"
        )

        health_category = Category(
            user_id=user1.id,
            name="Health",
            color="red",
            description="Medical appointments and health activities"
        )

        # Categories for user2
        study_category = Category(
            user_id=user2.id,
            name="Study",
            color="purple",
            description="Study sessions and academic activities"
        )

        fitness_category = Category(
            user_id=user2.id,
            name="Fitness",
            color="orange",
            description="Exercise and fitness activities"
        )

        db.session.add_all([work_category, personal_category, health_category, study_category, fitness_category])
        db.session.commit()

        print("Creating events...")

        # Current date for reference
        now = datetime.datetime.utcnow()

        # Create events for user1 with categories
        events_user1 = [
            # Simple event with reminders
            Event(
                user_id=user1.id,
                title="Team Meeting",
                description="Weekly team sync meeting",
                start_datetime=now + datetime.timedelta(days=1, hours=10),
                end_datetime=now + datetime.timedelta(days=1, hours=11),
                color="blue",
                categories=[work_category]
            ),

            # All-day event
            Event(
                user_id=user1.id,
                title="Company Retreat",
                description="Annual company retreat",
                start_datetime=now + datetime.timedelta(days=7),
                end_datetime=now + datetime.timedelta(days=9),
                is_all_day=True,
                color="blue",
                categories=[work_category]
            ),

            # Event with multiple categories
            Event(
                user_id=user1.id,
                title="Doctor Appointment",
                description="Annual check-up",
                start_datetime=now + datetime.timedelta(days=3, hours=14),
                end_datetime=now + datetime.timedelta(days=3, hours=15),
                color="red",
                categories=[health_category, personal_category]
            ),

            # Recurring daily event
            Event(
                user_id=user1.id,
                title="Morning Standup",
                description="Daily team standup meeting",
                start_datetime=now + datetime.timedelta(days=1, hours=9),
                end_datetime=now + datetime.timedelta(days=1, hours=9, minutes=30),
                color="blue",
                is_recurring=True,
                recurrence_id="daily-standup-001",
                categories=[work_category]
            ),

            # Recurring weekly event
            Event(
                user_id=user1.id,
                title="Weekly Planning",
                description="Weekly planning session",
                start_datetime=now + datetime.timedelta(days=2, hours=14),
                end_datetime=now + datetime.timedelta(days=2, hours=15),
                color="purple",
                is_recurring=True,
                recurrence_id="weekly-planning-001",
                categories=[work_category]
            )
        ]

        # Create events for user2
        events_user2 = [
            Event(
                user_id=user2.id,
                title="Study Session",
                description="Prepare for final exams",
                start_datetime=now + datetime.timedelta(days=1, hours=16),
                end_datetime=now + datetime.timedelta(days=1, hours=18),
                color="purple",
                categories=[study_category]
            ),

            Event(
                user_id=user2.id,
                title="Gym Workout",
                description="Upper body workout",
                start_datetime=now + datetime.timedelta(days=2, hours=7),
                end_datetime=now + datetime.timedelta(days=2, hours=8, minutes=30),
                color="orange",
                categories=[fitness_category]
            )
        ]

        # Add all events to session
        for event in events_user1 + events_user2:
            db.session.add(event)

        db.session.commit()

        print("Creating recurrence rules...")

        # Create recurrence rules for recurring events
        daily_standup_rule = RecurrenceRule(
            event_id=events_user1[3].id,  # Morning Standup
            frequency="DAILY",
            interval=1,
            end_date=now + datetime.timedelta(days=90)  # 3 months
        )

        weekly_planning_rule = RecurrenceRule(
            event_id=events_user1[4].id,  # Weekly Planning
            frequency="WEEKLY",
            interval=1,
            days_of_week="MON",
            occurrence_count=12  # 12 weeks
        )

        db.session.add(daily_standup_rule)
        db.session.add(weekly_planning_rule)
        db.session.commit()

        print("Creating reminders...")

        # Add various types of reminders
        reminders = [
            # Relative reminders (minutes before)
            Reminder(
                event_id=events_user1[0].id,  # Team Meeting
                reminder_time=events_user1[0].start_datetime - datetime.timedelta(minutes=15),
                notification_type='email',
                minutes_before=15,
                is_relative=True
            ),

            Reminder(
                event_id=events_user1[0].id,  # Team Meeting
                reminder_time=events_user1[0].start_datetime - datetime.timedelta(hours=1),
                notification_type='email',
                minutes_before=60,
                is_relative=True
            ),

            # Absolute reminder
            Reminder(
                event_id=events_user1[2].id,  # Doctor Appointment
                reminder_time=events_user1[2].start_datetime - datetime.timedelta(days=1),
                notification_type='email',
                is_relative=False
            ),

            # Push notification reminder
            Reminder(
                event_id=events_user1[3].id,  # Morning Standup
                reminder_time=events_user1[3].start_datetime - datetime.timedelta(minutes=5),
                notification_type='push',
                minutes_before=5,
                is_relative=True
            ),

            # Reminder for user2
            Reminder(
                event_id=events_user2[0].id,  # Study Session
                reminder_time=events_user2[0].start_datetime - datetime.timedelta(minutes=30),
                notification_type='email',
                minutes_before=30,
                is_relative=True
            )
        ]

        for reminder in reminders:
            db.session.add(reminder)

        db.session.commit()

        print("Creating email verification tokens...")

        # Create email verification token for unverified user
        verification_token = EmailVerificationToken(
            user_id=user2.id,
            expires_in_hours=24
        )

        db.session.add(verification_token)
        db.session.commit()

        print("Creating OAuth account...")

        # Create OAuth account for Google user
        oauth_account = OAuthAccount(
            user_id=user3.id,
            provider='google',
            provider_user_id='google_123456789',
            access_token='mock_access_token',
            refresh_token='mock_refresh_token',
            token_expires_at=now + datetime.timedelta(hours=1)
        )

        db.session.add(oauth_account)
        db.session.commit()

        print("\n" + "=" * 60)
        print("DATABASE SEEDED SUCCESSFULLY!")
        print("=" * 60)

        print("\nTest Users Created:")
        print(f"1. Verified User:")
        print(f"   Username: {user1.username}")
        print(f"   Email: {user1.email}")
        print(f"   Password: TestPass123")
        print(f"   Email Verified: {user1.email_verified}")

        print(f"\n2. Unverified User:")
        print(f"   Username: {user2.username}")
        print(f"   Email: {user2.email}")
        print(f"   Password: DemoPass123")
        print(f"   Email Verified: {user2.email_verified}")
        print(f"   Verification Token: {verification_token.token}")

        print(f"\n3. OAuth User:")
        print(f"   Username: {user3.username}")
        print(f"   Email: {user3.email}")
        print(f"   OAuth Provider: Google")

        print(f"\nCategories Created:")
        print(f"- Work, Personal, Health (for {user1.username})")
        print(f"- Study, Fitness (for {user2.username})")

        print(f"\nEvents Created:")
        print(f"- {len(events_user1)} events for {user1.username} (including 2 recurring)")
        print(f"- {len(events_user2)} events for {user2.username}")

        print(f"\nReminders Created:")
        print(f"- {len(reminders)} reminders with various types")

        print("\n" + "=" * 60)


if __name__ == "__main__":
    seed_database()