from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_permission
from app.database.session import get_db
from app.models.user import Role, User, UserPreference
from app.schemas.auth import ApiResponse, UserOut

router = APIRouter(prefix="/users", tags=["User Management"])


class UserUpdateIn(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    local_government: Optional[str] = None
    nationality: Optional[str] = None


class PreferenceIn(BaseModel):
    theme: Optional[str] = None
    language: Optional[str] = None
    time_zone: Optional[str] = None
    date_format: Optional[str] = None


def _to_user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id, first_name=user.first_name, middle_name=user.middle_name,
        last_name=user.last_name, email=user.email, phone_number=user.phone_number,
        gender=user.gender, date_of_birth=user.date_of_birth, profile_photo_url=user.profile_photo_url,
        status=user.status, is_email_verified=user.is_email_verified,
        roles=[r.name for r in user.roles], last_login=user.last_login, created_at=user.created_at,
    )


@router.get("")
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("users.manage")),
):
    q = db.query(User).filter(User.deleted_at.is_(None))
    if search:
        like = f"%{search}%"
        q = q.filter(
            (User.first_name.ilike(like)) | (User.last_name.ilike(like)) | (User.email.ilike(like))
        )
    if role:
        q = q.join(User.roles).filter(Role.name == role)
    if status_filter:
        q = q.filter(User.status == status_filter)

    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "success": True,
        "data": [_to_user_out(u) for u in items],
        "pagination": {"page": page, "page_size": page_size, "total": total},
    }


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: UUID, db: Session = Depends(get_db), _user: User = Depends(require_permission("users.manage"))):
    target = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    return _to_user_out(target)


@router.patch("/{user_id}", response_model=ApiResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    is_self = target.id == current_user.id
    role_names = {r.name for r in current_user.roles}
    if not is_self and not role_names.intersection({"super_admin", "school_administrator"}):
        raise HTTPException(status_code=403, detail="You may only edit your own profile.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(target, field, value)
    db.commit()
    return ApiResponse(success=True, message="Profile updated.")


@router.delete("/{user_id}", response_model=ApiResponse)
def deactivate_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("users.manage")),
):
    target = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    target.soft_delete()
    target.status = "inactive"
    db.commit()
    return ApiResponse(success=True, message="User deactivated.")


@router.put("/me/preferences", response_model=ApiResponse)
def update_my_preferences(
    payload: PreferenceIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefs = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreference(user_id=current_user.id)
        db.add(prefs)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(prefs, field, value)
    db.commit()
    return ApiResponse(success=True, message="Preferences saved.")
