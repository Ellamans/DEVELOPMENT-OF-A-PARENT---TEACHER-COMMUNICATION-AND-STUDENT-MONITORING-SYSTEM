"""add class_teacher_id to classes

Revision ID: a1c9f3d8e421
Revises: bb15150360f3
Create Date: 2026-08-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1c9f3d8e421'
down_revision = 'bb15150360f3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('classes', sa.Column('class_teacher_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_classes_class_teacher_id_users', 'classes', 'users', ['class_teacher_id'], ['id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_classes_class_teacher_id_users', 'classes', type_='foreignkey')
    op.drop_column('classes', 'class_teacher_id')
