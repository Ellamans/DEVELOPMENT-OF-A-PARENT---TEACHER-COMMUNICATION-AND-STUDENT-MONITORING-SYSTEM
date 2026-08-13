"""
Creates the first super_admin user. Run this once, directly in the
deployed environment (e.g. Railway's Console tab), where DATABASE_URL_SYNC
is already set correctly.

Usage:
    python -m app.utils.create_first_admin <email> <password> <first_name> <last_name>

Example:
    python -m app.utils.create_first_admin admin@myschool.ng "StrongPass1!" Jane Doe

Safe to re-run: if a super_admin already exists, it refuses and exits
rather than creating a duplicate.
"""
import sys

from app.core.security import hash_password, validate_password_strength
from app.database.session import SessionLocal
from app.models.user import Role, User


def create_first_admin(email: str, password: str, first_name: str, last_name: str):
    db = SessionLocal()
    try:
        role = db.query(Role).filter(Role.name == "super_admin").first()
        if not role:
            print("ERROR: 'super_admin' role not found. Run `python -m app.utils.seed_rbac` first.")
            sys.exit(1)

        existing_admin = (
            db.query(User)
            .join(User.roles)
            .filter(Role.name == "super_admin", User.deleted_at.is_(None))
            .first()
        )
        if existing_admin:
            print(f"A super_admin already exists ({existing_admin.email}). Refusing to create another via this script.")
            print("To add more admins, log in as this account and use the Users API instead.")
            sys.exit(1)

        if db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first():
            print(f"ERROR: a user with email '{email}' already exists.")
            sys.exit(1)

        password_errors = validate_password_strength(password)
        if password_errors:
            print("ERROR: password does not meet the policy:")
            for e in password_errors:
                print(f"  - {e}")
            sys.exit(1)

        user = User(
            first_name=first_name, last_name=last_name, email=email,
            hashed_password=hash_password(password), status="active", is_email_verified=True,
        )
        user.roles.append(role)
        db.add(user)
        db.commit()
        print(f"✅ Super admin created: {email}")
        print("Log in at /login with this email and password.")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print(__doc__)
        sys.exit(1)
    create_first_admin(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
