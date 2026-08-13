#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Seeding RBAC roles and permissions (safe to re-run — idempotent)..."
python -m app.utils.seed_rbac

# Optional one-time admin bootstrap: only runs if these env vars are set.
# Safe to leave set permanently — the script refuses to create a second
# super_admin once one exists, so this won't do anything on later boots.
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "ADMIN_EMAIL is set — attempting to bootstrap first admin..."
  python -m app.utils.create_first_admin \
    "$ADMIN_EMAIL" "$ADMIN_PASSWORD" \
    "${ADMIN_FIRST_NAME:-Admin}" "${ADMIN_LAST_NAME:-User}" \
    || echo "Admin bootstrap skipped (likely already exists) — continuing startup."
fi

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
