"""Phase 2: Enhanced security and reminders

Revision ID: phase2_enhanced_security_reminders
Revises: 0e92ff232598
Create Date: 2025-06-29 15:33:54.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'phase2_enhanced_security_reminders'
down_revision = '0e92ff232598'
branch_labels = None
depends_on = None

def upgrade():
    # Create email_verification_tokens table
    op.create_table(
        'email_verification_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token')
    )

    # Create password_reset_tokens table
    op.create_table(
        'password_reset_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token')
    )

    # Create oauth_accounts table
    op.create_table(
        'oauth_accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('provider_user_id', sa.String(length=255), nullable=False),
        sa.Column('access_token', sa.Text(), nullable=True),
        sa.Column('refresh_token', sa.Text(), nullable=True),
        sa.Column('token_expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('provider', 'provider_user_id', name='unique_provider_user')
    )

    # Add new columns to users table
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('email_verified', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('account_status', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('failed_login_attempts', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('last_login_attempt', sa.DateTime(), nullable=True))

    # Add new columns to reminders table
    with op.batch_alter_table('reminders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('notification_type', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('minutes_before', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('is_relative', sa.Boolean(), nullable=True))

    # Set default values for existing records
    op.execute("UPDATE users SET email_verified = 0 WHERE email_verified IS NULL")
    op.execute("UPDATE users SET account_status = 'active' WHERE account_status IS NULL")
    op.execute("UPDATE users SET failed_login_attempts = 0 WHERE failed_login_attempts IS NULL")
    op.execute("UPDATE reminders SET notification_type = 'email' WHERE notification_type IS NULL")
    op.execute("UPDATE reminders SET is_relative = 1 WHERE is_relative IS NULL")

def downgrade():
    # Remove new columns from reminders table
    with op.batch_alter_table('reminders', schema=None) as batch_op:
        batch_op.drop_column('is_relative')
        batch_op.drop_column('minutes_before')
        batch_op.drop_column('notification_type')

    # Remove new columns from users table
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('last_login_attempt')
        batch_op.drop_column('failed_login_attempts')
        batch_op.drop_column('account_status')
        batch_op.drop_column('email_verified')

    # Drop new tables
    op.drop_table('oauth_accounts')
    op.drop_table('password_reset_tokens')
    op.drop_table('email_verification_tokens')