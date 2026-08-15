"""
Resets a user's password by email. Intended for recovering access to your
own admin account when ADMIN_PASSWORD was changed after create_first_admin
already ran once (that script only ever creates the account once, so later
env var changes don't retroactively update it).

Usage:
    python -m app.utils.reset_password <email> <new_password>

Example:
    python -m app.utils.reset_password your@email.com "NewStrongPass1!"

Safe to run anytime: it only ever updates the password of the account
matching the given email. It does not create accounts and does not touch
any other field.
"""
import sys

from app.core.security import hash_password, validate_password_strength
from app.database.session import SessionLocal
from app.models.user import User


def reset_password(email: str, new_password: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first()
        if not user:
            print(f"ERROR: no user found with email '{email}'.")
            sys.exit(1)

        password_errors = validate_password_strength(new_password)
        if password_errors:
            print("ERROR: password does not meet the policy:")
            for e in password_errors:
                print(f"  - {e}")
            sys.exit(1)

        user.hashed_password = hash_password(new_password)
        user.failed_login_attempts = "0"
        user.locked_until = None
        db.commit()
        print(f"✅ Password reset for {email}.")
        print("Log in at /login with this email and the new password.")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    reset_password(sys.argv[1], sys.argv[2])
