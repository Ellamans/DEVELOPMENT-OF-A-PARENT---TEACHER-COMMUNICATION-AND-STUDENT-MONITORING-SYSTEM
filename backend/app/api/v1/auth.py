import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.database.session import get_db
from app.models.people import Parent, Student, Teacher
from app.models.user import Role, User
from app.schemas.auth import (
    ApiResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserOut,
    VerifyEmailRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_remote_address)

ALLOWED_SELF_REGISTER_ROLES = {"parent", "teacher", "student"}


def _generate_admission_number(db: Session) -> str:
    count = db.query(Student).count() + 1
    return f"ADM{count:05d}"


def _generate_employee_id(db: Session) -> str:
    count = db.query(Teacher).count() + 1
    return f"EMP{count:05d}"


@router.post("/register", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if payload.role not in ALLOWED_SELF_REGISTER_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role for self-registration.")

    normalized_email = payload.email.strip().lower()
    # Compare case-insensitively so "Jane@x.com" and "jane@x.com" are the same.
    if db.query(User).filter(func.lower(User.email) == normalized_email, User.deleted_at.is_(None)).first():
        raise HTTPException(status_code=409, detail="A user with this email already exists.")

    if payload.phone_number and db.query(User).filter(
        User.phone_number == payload.phone_number, User.deleted_at.is_(None)
    ).first():
        raise HTTPException(status_code=409, detail="A user with this phone number already exists.")

    password_errors = validate_password_strength(payload.password)
    if password_errors:
        raise HTTPException(status_code=422, detail={"password_errors": password_errors})

    role = db.query(Role).filter(Role.name == payload.role).first()
    if not role:
        raise HTTPException(status_code=500, detail=f"Role '{payload.role}' is not seeded in the system.")

    user = User(
        first_name=payload.first_name,
        middle_name=payload.middle_name,
        last_name=payload.last_name,
        email=normalized_email,
        phone_number=payload.phone_number,
        hashed_password=hash_password(payload.password),
        gender=payload.gender,
        date_of_birth=payload.date_of_birth,
        status="active",
        email_verification_token=secrets.token_urlsafe(32),
    )
    user.roles.append(role)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Two near-simultaneous submits (e.g. a double-click) can both pass the
        # check above before either has committed. The DB's unique constraint
        # is the final backstop — surface it as a normal duplicate-email error
        # instead of a raw 500.
        db.rollback()
        raise HTTPException(status_code=409, detail="A user with this email already exists.")
    db.refresh(user)

    # A User account is a login credential; Student/Parent rows are the
    # school-record profiles that the Students/Parents pages actually query.
    # Without this, a self-registered account has nowhere to show up. We
    # auto-provision a bare-bones profile here, linked via user_id, so the
    # account is immediately visible — administrators can complete the rest
    # of the profile (class assignment, admission date, etc.) afterward.
    if payload.role == "student":
        db.add(Student(
            user_id=user.id,
            admission_number=_generate_admission_number(db),
            first_name=payload.first_name,
            middle_name=payload.middle_name,
            last_name=payload.last_name,
            gender=payload.gender,
            date_of_birth=payload.date_of_birth,
            status="active",
        ))
        db.commit()
    elif payload.role == "parent":
        db.add(Parent(
            user_id=user.id,
            full_name=user.full_name,
            email=normalized_email,
            phone_number=payload.phone_number,
        ))
        db.commit()
    elif payload.role == "teacher":
        db.add(Teacher(
            user_id=user.id,
            employee_id=_generate_employee_id(db),
            employment_status="active",
        ))
        db.commit()

    # NOTE: email dispatch is out of scope for this module; token is generated
    # and ready for a future SMTP integration to send a verification link.
    return ApiResponse(success=True, message="Registration successful. Please verify your email.")


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email) == payload.email.strip().lower(), User.deleted_at.is_(None)).first()

    if user and user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(status_code=423, detail="Account temporarily locked due to failed login attempts.")

    if not user or not verify_password(payload.password, user.hashed_password):
        if user:
            attempts = int(user.failed_login_attempts or "0") + 1
            user.failed_login_attempts = str(attempts)
            if attempts >= settings.MAX_FAILED_LOGIN_ATTEMPTS:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCOUNT_LOCK_MINUTES)
            db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if user.status != "active":
        raise HTTPException(status_code=403, detail=f"Account is {user.status}.")

    user.failed_login_attempts = "0"
    user.locked_until = None
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    role_names = [r.name for r in user.roles]
    access_token = create_access_token(str(user.id), {"roles": role_names})
    refresh_token = create_refresh_token(str(user.id))
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    decoded = decode_token(payload.refresh_token)
    if not decoded or decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")

    user = db.query(User).filter(User.id == decoded["sub"], User.deleted_at.is_(None)).first()
    if not user or user.status != "active":
        raise HTTPException(status_code=401, detail="User is not active.")

    role_names = [r.name for r in user.roles]
    access_token = create_access_token(str(user.id), {"roles": role_names})
    new_refresh_token = create_refresh_token(str(user.id))
    return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)


@router.post("/logout", response_model=ApiResponse)
def logout(user: User = Depends(get_current_user)):
    # Stateless JWT: client discards tokens. Server-side denylist can be added
    # later (e.g. Redis) without changing this contract.
    return ApiResponse(success=True, message="Logged out successfully.")


@router.post("/forgot-password", response_model=ApiResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email) == payload.email.strip().lower(), User.deleted_at.is_(None)).first()
    if user:
        user.password_reset_token = secrets.token_urlsafe(32)
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        db.commit()
        # NOTE: SMTP dispatch wired up in a later module; token is ready now.
    # Always return success to avoid leaking which emails are registered.
    return ApiResponse(success=True, message="If that email exists, a reset link has been sent.")


@router.post("/reset-password", response_model=ApiResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.password_reset_token == payload.token, User.deleted_at.is_(None)).first()
    if not user or not user.password_reset_expires or user.password_reset_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    password_errors = validate_password_strength(payload.new_password)
    if password_errors:
        raise HTTPException(status_code=422, detail={"password_errors": password_errors})

    user.hashed_password = hash_password(payload.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    db.commit()
    return ApiResponse(success=True, message="Password reset successful.")


@router.post("/change-password", response_model=ApiResponse)
def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    password_errors = validate_password_strength(payload.new_password)
    if password_errors:
        raise HTTPException(status_code=422, detail={"password_errors": password_errors})

    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return ApiResponse(success=True, message="Password changed successfully.")


@router.post("/verify-email", response_model=ApiResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email_verification_token == payload.token, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification token.")
    user.is_email_verified = True
    user.email_verification_token = None
    db.commit()
    return ApiResponse(success=True, message="Email verified successfully.")


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return UserOut(
        id=user.id,
        first_name=user.first_name,
        middle_name=user.middle_name,
        last_name=user.last_name,
        email=user.email,
        phone_number=user.phone_number,
        gender=user.gender,
        date_of_birth=user.date_of_birth,
        profile_photo_url=user.profile_photo_url,
        status=user.status,
        is_email_verified=user.is_email_verified,
        roles=[r.name for r in user.roles],
        last_login=user.last_login,
        created_at=user.created_at,
    )
