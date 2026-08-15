"""add teacher approval workflow columns

Revision ID: c3a7f0e9d1b2
Revises: bb15150360f3
Create Date: 2026-08-14 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3a7f0e9d1b2'
down_revision = 'bb15150360f3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Self-registered teachers pick a class at registration time; an admin
    # must approve before that pick actually takes effect (they become the
    # class teacher). Admin-created teacher profiles default to "approved"
    # since there's nothing to approve in that flow.
    op.add_column(
        'teachers',
        sa.Column('approval_status', sa.String(length=20), nullable=False, server_default='approved'),
    )
    op.add_column(
        'teachers',
        sa.Column('requested_class_id', sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        'fk_teachers_requested_class_id_classes',
        'teachers', 'classes',
        ['requested_class_id'], ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_teachers_requested_class_id_classes', 'teachers', type_='foreignkey')
    op.drop_column('teachers', 'requested_class_id')
    op.drop_column('teachers', 'approval_status')
