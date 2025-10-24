"""Add categories and recurrence support

Revision ID: 0e92ff232598
Revises: ca91718c7d6f
Create Date: 2025-06-28 23:18:55.021094

"""
from alembic import op
import sqlalchemy as sa
from alembic import context


# revision identifiers, used by Alembic.
revision = '0e92ff232598'
down_revision = 'ca91718c7d6f'
branch_labels = None
depends_on = None


def upgrade():
    # Create categories table
    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=64), nullable=False),
        sa.Column('color', sa.String(length=20), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name', name='unique_user_category')
    )

    # Create recurrence_rules table
    op.create_table(
        'recurrence_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.Integer(), nullable=False),
        sa.Column('frequency', sa.String(length=20), nullable=False),
        sa.Column('interval', sa.Integer(), nullable=True),
        sa.Column('days_of_week', sa.String(length=20), nullable=True),
        sa.Column('day_of_month', sa.Integer(), nullable=True),
        sa.Column('week_of_month', sa.Integer(), nullable=True),
        sa.Column('day_of_week', sa.String(length=10), nullable=True),
        sa.Column('end_date', sa.DateTime(), nullable=True),
        sa.Column('occurrence_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create event_categories association table
    op.create_table(
        'event_categories',
        sa.Column('event_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ),
        sa.PrimaryKeyConstraint('event_id', 'category_id')
    )

    # Add new columns to events table
    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_recurring', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('recurrence_id', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('parent_event_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_events_parent', 'events', ['parent_event_id'], ['id'])

    # Database-specific default value setting
    if context.get_impl().dialect.name == 'postgresql':
        op.execute("UPDATE events SET is_recurring = false WHERE is_recurring IS NULL")
    else:
        op.execute("UPDATE events SET is_recurring = 0 WHERE is_recurring IS NULL")

def downgrade():
    # Remove new columns from events table
    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.drop_constraint('fk_events_parent', type_='foreignkey')
        batch_op.drop_column('parent_event_id')
        batch_op.drop_column('recurrence_id')
        batch_op.drop_column('is_recurring')

    # Drop tables in reverse order
    op.drop_table('event_categories')
    op.drop_table('recurrence_rules')
    op.drop_table('categories')
    ### end Alembic commands ###
