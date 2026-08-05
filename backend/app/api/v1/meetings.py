from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database.session import get_db
from app.models.communication import Meeting, PTAMeeting, PTAMinutes, meeting_participants
from app.models.user import User
from app.schemas.auth import ApiResponse

router = APIRouter(tags=["Meetings & PTA"])


class MeetingRequestIn(BaseModel):
    title: str
    meeting_type: str
    scheduled_at: datetime
    venue: Optional[str] = None
    virtual_link: Optional[str] = None
    agenda: Optional[str] = None
    participant_ids: list[UUID] = []


@router.get("/meetings")
def list_meetings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = (
        db.query(Meeting)
        .join(meeting_participants, meeting_participants.c.meeting_id == Meeting.id)
        .filter(meeting_participants.c.user_id == user.id, Meeting.deleted_at.is_(None))
        .order_by(Meeting.scheduled_at)
    )
    return {"success": True, "data": q.all()}


@router.post("/meetings", response_model=ApiResponse, status_code=201)
def request_meeting(
    payload: MeetingRequestIn, db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    valid_types = {"parent_teacher", "disciplinary", "academic_review", "pta", "emergency", "staff"}
    if payload.meeting_type not in valid_types:
        raise HTTPException(status_code=422, detail=f"meeting_type must be one of {valid_types}")
    if payload.scheduled_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="Meeting must be scheduled in the future.")

    meeting = Meeting(
        title=payload.title, meeting_type=payload.meeting_type, scheduled_at=payload.scheduled_at,
        venue=payload.venue, virtual_link=payload.virtual_link, agenda=payload.agenda,
        status="requested", requested_by=user.id,
    )
    db.add(meeting)
    db.flush()
    for uid in set(payload.participant_ids) | {user.id}:
        db.execute(meeting_participants.insert().values(meeting_id=meeting.id, user_id=uid))
    db.commit()
    return ApiResponse(success=True, message="Meeting requested.", data={"id": str(meeting.id)})


class MeetingStatusIn(BaseModel):
    status: str  # approved, rejected, rescheduled, completed


@router.patch("/meetings/{meeting_id}/status", response_model=ApiResponse)
def update_meeting_status(
    meeting_id: UUID, payload: MeetingStatusIn, db: Session = Depends(get_db),
    _user: User = Depends(require_role("teacher", "class_teacher", "principal", "school_administrator")),
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    valid = {"approved", "rejected", "rescheduled", "completed"}
    if payload.status not in valid:
        raise HTTPException(status_code=422, detail=f"status must be one of {valid}")
    meeting.status = payload.status
    db.commit()
    return ApiResponse(success=True, message=f"Meeting {payload.status}.")


# ---------- PTA ----------

class PTAMeetingIn(BaseModel):
    title: str
    scheduled_at: datetime
    venue: Optional[str] = None
    agenda: Optional[str] = None


@router.get("/pta/meetings")
def list_pta_meetings(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return {"success": True, "data": db.query(PTAMeeting).filter(PTAMeeting.deleted_at.is_(None)).order_by(PTAMeeting.scheduled_at).all()}


@router.post("/pta/meetings", response_model=ApiResponse, status_code=201)
def create_pta_meeting(
    payload: PTAMeetingIn, db: Session = Depends(get_db),
    _user: User = Depends(require_role("school_administrator", "principal")),
):
    db.add(PTAMeeting(**payload.model_dump()))
    db.commit()
    return ApiResponse(success=True, message="PTA meeting scheduled.")


class PTAMinutesIn(BaseModel):
    content: str
    action_items: Optional[str] = None


@router.post("/pta/meetings/{pta_meeting_id}/minutes", response_model=ApiResponse, status_code=201)
def record_pta_minutes(
    pta_meeting_id: UUID, payload: PTAMinutesIn, db: Session = Depends(get_db),
    user: User = Depends(require_role("school_administrator", "principal")),
):
    db.add(PTAMinutes(pta_meeting_id=pta_meeting_id, recorded_by=user.id, **payload.model_dump()))
    db.commit()
    return ApiResponse(success=True, message="PTA minutes recorded.")
