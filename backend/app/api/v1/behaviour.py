from datetime import date as date_type
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import require_permission, require_role
from app.database.session import get_db
from app.models.academics import BehaviourRecord, DisciplinaryAction
from app.models.user import User
from app.schemas.auth import ApiResponse

router = APIRouter(prefix="/behaviour", tags=["Behaviour Monitoring"])

VALID_CATEGORIES = {
    "excellent_conduct", "leadership", "respect", "teamwork", "homework_completion", "punctuality",
    "neatness", "discipline", "bullying", "fighting", "late_coming", "noise_making", "cheating",
    "absenteeism", "other",
}


class BehaviourIn(BaseModel):
    student_id: UUID
    category: str
    description: str
    severity: str
    follow_up_action: Optional[str] = None
    parent_notified: bool = False


@router.get("/records")
def list_behaviour_records(
    student_id: Optional[UUID] = None, category: Optional[str] = None,
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db), _user: User = Depends(require_permission("behaviour.view")),
):
    q = db.query(BehaviourRecord).filter(BehaviourRecord.deleted_at.is_(None))
    if student_id:
        q = q.filter(BehaviourRecord.student_id == student_id)
    if category:
        q = q.filter(BehaviourRecord.category == category)
    total = q.count()
    items = q.order_by(BehaviourRecord.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"success": True, "data": items, "pagination": {"page": page, "page_size": page_size, "total": total}}


@router.post("/records", response_model=ApiResponse, status_code=201)
def create_behaviour_record(
    payload: BehaviourIn, db: Session = Depends(get_db), user: User = Depends(require_permission("behaviour.create")),
):
    if payload.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"category must be one of {VALID_CATEGORIES}")
    if payload.severity not in {"low", "medium", "high"}:
        raise HTTPException(status_code=422, detail="severity must be low, medium, or high")

    record = BehaviourRecord(**payload.model_dump(), recorded_by=user.id, status="open")
    db.add(record)
    db.commit()
    db.refresh(record)
    return ApiResponse(success=True, message="Behaviour record created.", data={"id": str(record.id)})


class DisciplinaryActionIn(BaseModel):
    student_id: UUID
    behaviour_record_id: Optional[UUID] = None
    action_type: str
    reason: str
    decision_date: date_type


@router.post("/disciplinary-actions", response_model=ApiResponse, status_code=201)
def create_disciplinary_action(
    payload: DisciplinaryActionIn, db: Session = Depends(get_db),
    user: User = Depends(require_role("principal", "vice_principal", "school_administrator")),
):
    valid_actions = {"warning", "counselling", "community_service", "parent_meeting", "suspension", "expulsion", "administrative_note"}
    if payload.action_type not in valid_actions:
        raise HTTPException(status_code=422, detail=f"action_type must be one of {valid_actions}")

    action = DisciplinaryAction(**payload.model_dump(), responsible_officer=user.id, resolution_status="pending")
    db.add(action)
    db.commit()
    db.refresh(action)
    return ApiResponse(success=True, message="Disciplinary action recorded.", data={"id": str(action.id)})


@router.patch("/disciplinary-actions/{action_id}/resolve", response_model=ApiResponse)
def resolve_disciplinary_action(
    action_id: UUID, db: Session = Depends(get_db),
    _user: User = Depends(require_role("principal", "vice_principal", "school_administrator")),
):
    action = db.query(DisciplinaryAction).filter(DisciplinaryAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Disciplinary action not found.")
    action.resolution_status = "resolved"
    db.commit()
    return ApiResponse(success=True, message="Disciplinary action marked resolved.")
