from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database.session import get_db
from app.models.communication import Announcement, Notification
from app.models.user import User
from app.schemas.auth import ApiResponse

router = APIRouter(tags=["Announcements & Notifications"])


class AnnouncementIn(BaseModel):
    title: str
    body: str
    audience: str  # all, teachers, parents, students, class, department
    class_arm_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    publish_at: Optional[datetime] = None


@router.get("/announcements")
def list_announcements(
    audience: Optional[str] = None, db: Session = Depends(get_db), _user: User = Depends(get_current_user),
):
    q = db.query(Announcement).filter(Announcement.deleted_at.is_(None), Announcement.published.is_(True))
    if audience:
        q = q.filter(Announcement.audience == audience)
    return {"success": True, "data": q.order_by(Announcement.created_at.desc()).all()}


@router.post("/announcements", response_model=ApiResponse, status_code=201)
def create_announcement(
    payload: AnnouncementIn, db: Session = Depends(get_db),
    user: User = Depends(require_role("super_admin", "school_administrator", "principal")),
):
    valid_audiences = {"all", "teachers", "parents", "students", "class", "department"}
    if payload.audience not in valid_audiences:
        raise HTTPException(status_code=422, detail=f"audience must be one of {valid_audiences}")

    now = datetime.now(timezone.utc)
    publish_now = not payload.publish_at or payload.publish_at <= now
    announcement = Announcement(**payload.model_dump(), published=publish_now, created_by=user.id)
    db.add(announcement)
    db.commit()
    return ApiResponse(success=True, message="Announcement created." if publish_now else "Announcement scheduled.")


@router.get("/notifications")
def list_notifications(
    unread_only: bool = False, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    q = db.query(Notification).filter(Notification.user_id == user.id, Notification.deleted_at.is_(None))
    if unread_only:
        q = q.filter(Notification.is_read.is_(False))
    total = q.count()
    items = q.order_by(Notification.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"success": True, "data": items, "pagination": {"page": page, "page_size": page_size, "total": total}}


@router.patch("/notifications/{notification_id}/read", response_model=ApiResponse)
def mark_notification_read(
    notification_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")
    notif.is_read = True
    db.commit()
    return ApiResponse(success=True, message="Notification marked as read.")


@router.patch("/notifications/mark-all-read", response_model=ApiResponse)
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read.is_(False)).update(
        {Notification.is_read: True}
    )
    db.commit()
    return ApiResponse(success=True, message="All notifications marked as read.")


def create_notification(db: Session, user_id: UUID, notification_type: str, title: str, message: str, source_module: str):
    """Internal helper other modules call to raise a notification without hardcoding sources."""
    db.add(Notification(
        user_id=user_id, notification_type=notification_type, title=title, message=message, source_module=source_module,
    ))
