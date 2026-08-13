"""add unique constraint on user_id for teachers/parents/students

Revision ID: f2b7a4c91d33
Revises: a1c9f3d8e421
Create Date: 2026-08-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f2b7a4c91d33'
down_revision = 'a1c9f3d8e421'
branch_labels = None
depends_on = None


# If a user_id was linked to more than one profile row (possible via a race
# condition on the old "create profile" flow — two rapid taps could both
# pass the app-level "not already linked" check before either committed),
# keep only the oldest row per user_id and soft-delete the rest, so the new
# unique constraint below has clean data to apply against.
_DEDUPE_SQL = """
UPDATE {table}
SET deleted_at = now()
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY user_id ORDER BY created_at ASC
        ) AS rn
        FROM {table}
        WHERE user_id IS NOT NULL AND deleted_at IS NULL
    ) ranked
    WHERE rn > 1
);
"""


def upgrade() -> None:
    op.execute(_DEDUPE_SQL.format(table="teachers"))
    op.execute(_DEDUPE_SQL.format(table="parents"))
    op.execute(_DEDUPE_SQL.format(table="students"))

    # Partial unique indexes (not table-wide constraints) so soft-deleted
    # duplicates — which we intentionally keep for audit history — don't
    # block a real, currently-active profile from existing.
    op.create_index(
        'uq_teachers_user_id_active', 'teachers', ['user_id'],
        unique=True, postgresql_where=sa.text('deleted_at IS NULL'),
    )
    op.create_index(
        'uq_parents_user_id_active', 'parents', ['user_id'],
        unique=True, postgresql_where=sa.text('deleted_at IS NULL AND user_id IS NOT NULL'),
    )
    op.create_index(
        'uq_students_user_id_active', 'students', ['user_id'],
        unique=True, postgresql_where=sa.text('deleted_at IS NULL AND user_id IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('uq_students_user_id_active', table_name='students')
    op.drop_index('uq_parents_user_id_active', table_name='parents')
    op.drop_index('uq_teachers_user_id_active', table_name='teachers')
