from datetime import date as date_type
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_permission
from app.database.session import get_db
from app.models.security import AttendanceRecord
from app.models.user import User
from app.schemas.auth import ApiResponse

router = APIRouter(prefix="/attendance", tags=["Attendance"])

VALID_STATUSES = {"present", "absent", "late", "excused", "sick", "school_activity"}


class AttendanceEntry(BaseModel):
    student_id: UUID
    status: str
    remarks: Optional[str] = None


class TakeAttendanceIn(BaseModel):
    class_id: UUID
    academic_session_id: UUID
    academic_term_id: UUID
    date: date_type
    entries: list[AttendanceEntry]


@router.post("", response_model=ApiResponse, status_code=201)
def take_attendance(
    payload: TakeAttendanceIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("attendance.create")),
):
    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.class_id == payload.class_id, AttendanceRecord.date == payload.date
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Attendance for this class has already been submitted today.")

    for entry in payload.entries:
        if entry.status not in VALID_STATUSES:
            raise HTTPException(status_code=422, detail=f"Invalid status '{entry.status}'. Must be one of {VALID_STATUSES}")
        db.add(AttendanceRecord(
            student_id=entry.student_id, academic_session_id=payload.academic_session_id,
            academic_term_id=payload.academic_term_id, class_id=payload.class_id,
            date=payload.date, status=entry.status, remarks=entry.remarks, marked_by=user.id,
        ))
    db.commit()
    return ApiResponse(success=True, message=f"Attendance recorded for {len(payload.entries)} students.")


@router.get("")
def attendance_history(
    class_id: Optional[UUID] = None,
    student_id: Optional[UUID] = None,
    date_from: Optional[date_type] = None,
    date_to: Optional[date_type] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("attendance.view")),
):
    q = db.query(AttendanceRecord).filter(AttendanceRecord.deleted_at.is_(None))
    if class_id:
        q = q.filter(AttendanceRecord.class_id == class_id)
    if student_id:
        q = q.filter(AttendanceRecord.student_id == student_id)
    if date_from:
        q = q.filter(AttendanceRecord.date >= date_from)
    if date_to:
        q = q.filter(AttendanceRecord.date <= date_to)
    total = q.count()
    items = q.order_by(AttendanceRecord.date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"success": True, "data": items, "pagination": {"page": page, "page_size": page_size, "total": total}}


@router.patch("/{record_id}", response_model=ApiResponse)
def edit_attendance_entry(
    record_id: UUID,
    payload: AttendanceEntry,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("attendance.edit")),
):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found.")
    if record.is_locked:
        raise HTTPException(status_code=403, detail="This attendance window is locked. Ask an administrator to reopen it.")
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status. Must be one of {VALID_STATUSES}")
    record.status = payload.status
    record.remarks = payload.remarks
    db.commit()
    return ApiResponse(success=True, message="Attendance entry updated.")


@router.patch("/class/{class_id}/lock", response_model=ApiResponse)
def lock_attendance(
    class_id: UUID,
    date: date_type,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("attendance.approve")),
):
    db.query(AttendanceRecord).filter(
        AttendanceRecord.class_id == class_id, AttendanceRecord.date == date
    ).update({AttendanceRecord.is_locked: True})
    db.commit()
    return ApiResponse(success=True, message="Attendance window locked.")


@router.patch("/class/{class_id}/reopen", response_model=ApiResponse)
def reopen_attendance(
    class_id: UUID,
    date: date_type,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("attendance.approve")),
):
    db.query(AttendanceRecord).filter(
        AttendanceRecord.class_id == class_id, AttendanceRecord.date == date
    ).update({AttendanceRecord.is_locked: False})
    db.commit()
    return ApiResponse(success=True, message="Attendance window reopened for editing.")


@router.get("/analytics/summary")
def attendance_analytics(
    date: Optional[date_type] = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("attendance.view")),
):
    q = db.query(AttendanceRecord).filter(AttendanceRecord.deleted_at.is_(None))
    if date:
        q = q.filter(AttendanceRecord.date == date)
    total = q.count()
    present = q.filter(AttendanceRecord.status == "present").count()
    absent = q.filter(AttendanceRecord.status == "absent").count()
    late = q.filter(AttendanceRecord.status == "late").count()
    rate = round((present / total) * 100, 1) if total else 0.0
    return {"success": True, "data": {
        "total_records": total, "present": present, "absent": absent, "late": late, "attendance_rate": rate,
    }}
