from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_permission
from app.database.session import get_db
from app.models.academics import BehaviourRecord
from app.models.people import Parent, Student
from app.models.security import AttendanceRecord
from app.models.user import User
from app.schemas.auth import ApiResponse
from app.schemas.student import ParentIn

router = APIRouter(prefix="/parents", tags=["Parent Management"])


@router.get("/me/children")
def list_my_children(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """A parent's view of their own linked children. Scoped by ownership
    (Parent.user_id == the logged-in user), not by a broad students.view
    permission — a parent should never be able to browse other students."""
    parent = db.query(Parent).filter(Parent.user_id == user.id, Parent.deleted_at.is_(None)).first()
    if not parent:
        return {"success": True, "data": [], "message": "No parent profile linked to this account yet."}

    children = [
        {
            "id": s.id, "full_name": s.full_name, "admission_number": s.admission_number,
            "status": s.status, "current_class_id": s.current_class_id,
        }
        for s in parent.students if s.deleted_at is None
    ]
    return {"success": True, "data": children}


@router.get("/me/children/{student_id}/activity")
def get_my_child_activity(
    student_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    """One child's recent activity for their parent — attendance and
    behaviour records. Ownership is verified before returning anything:
    the student must actually be linked to this logged-in parent."""
    parent = db.query(Parent).filter(Parent.user_id == user.id, Parent.deleted_at.is_(None)).first()
    if not parent or student_id not in {s.id for s in parent.students}:
        raise HTTPException(status_code=403, detail="This student is not linked to your account.")

    student = db.query(Student).filter(Student.id == student_id, Student.deleted_at.is_(None)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    attendance = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.student_id == student_id, AttendanceRecord.deleted_at.is_(None))
        .order_by(AttendanceRecord.date.desc())
        .limit(30)
        .all()
    )
    behaviour = (
        db.query(BehaviourRecord)
        .filter(BehaviourRecord.student_id == student_id, BehaviourRecord.deleted_at.is_(None))
        .order_by(BehaviourRecord.created_at.desc())
        .limit(20)
        .all()
    )

    present_count = sum(1 for a in attendance if a.status == "present")
    attendance_rate = round((present_count / len(attendance)) * 100, 1) if attendance else None

    return {"success": True, "data": {
        "student": {
            "id": student.id, "full_name": student.full_name,
            "admission_number": student.admission_number, "status": student.status,
        },
        "attendance_rate_last_30_records": attendance_rate,
        "attendance": [{"date": a.date, "status": a.status, "remarks": a.remarks} for a in attendance],
        "behaviour": [
            {"category": b.category, "description": b.description, "severity": b.severity,
             "recorded_at": b.created_at, "status": b.status}
            for b in behaviour
        ],
    }}


@router.get("")
def list_parents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("parents.view")),
):
    q = db.query(Parent).filter(Parent.deleted_at.is_(None))
    if search:
        like = f"%{search}%"
        q = q.filter((Parent.full_name.ilike(like)) | (Parent.email.ilike(like)) | (Parent.phone_number.ilike(like)))
    total = q.count()
    items = q.order_by(Parent.full_name).offset((page - 1) * page_size).limit(page_size).all()
    return {"success": True, "data": items, "pagination": {"page": page, "page_size": page_size, "total": total}}


@router.post("", response_model=ApiResponse, status_code=201)
def create_parent(
    payload: ParentIn,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("parents.create")),
):
    # Compare case-insensitively — "Jane@x.com" and "jane@x.com" are the same
    # address, and an exact-match check lets a second, duplicate record through.
    normalized_email = payload.email.strip().lower() if payload.email else None
    if normalized_email and db.query(Parent).filter(
        func.lower(Parent.email) == normalized_email, Parent.deleted_at.is_(None)
    ).first():
        raise HTTPException(status_code=409, detail="A parent with this email already exists — link the existing record instead.")

    if payload.user_id:
        target_user = db.query(User).filter(User.id == payload.user_id, User.deleted_at.is_(None)).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="That user account was not found.")
        if not any(r.name == "parent" for r in target_user.roles):
            raise HTTPException(status_code=422, detail="That user account does not have the parent role.")
        if db.query(Parent).filter(Parent.user_id == payload.user_id, Parent.deleted_at.is_(None)).first():
            raise HTTPException(status_code=409, detail="That account is already linked to a parent profile.")

    parent_data = payload.model_dump()
    parent_data["email"] = normalized_email
    parent = Parent(**parent_data)
    db.add(parent)
    db.commit()
    db.refresh(parent)
    return ApiResponse(success=True, message="Parent created.", data={"id": str(parent.id)})


@router.get("/{parent_id}")
def get_parent(
    parent_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("parents.view")),
):
    parent = db.query(Parent).filter(Parent.id == parent_id, Parent.deleted_at.is_(None)).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found.")
    return {"success": True, "data": {
        "id": parent.id, "full_name": parent.full_name, "email": parent.email,
        "phone_number": parent.phone_number, "occupation": parent.occupation,
        "residential_address": parent.residential_address,
        "preferred_contact_method": parent.preferred_contact_method,
        "children": [{"id": s.id, "full_name": s.full_name, "admission_number": s.admission_number} for s in parent.students],
    }}


@router.patch("/{parent_id}", response_model=ApiResponse)
def update_parent(
    parent_id: UUID,
    payload: ParentIn,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("parents.edit")),
):
    parent = db.query(Parent).filter(Parent.id == parent_id, Parent.deleted_at.is_(None)).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(parent, field, value)
    db.commit()
    return ApiResponse(success=True, message="Parent updated.")


@router.delete("/{parent_id}", response_model=ApiResponse)
def delete_parent(
    parent_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("parents.delete")),
):
    parent = db.query(Parent).filter(Parent.id == parent_id, Parent.deleted_at.is_(None)).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found.")
    parent.soft_delete()
    db.commit()
    return ApiResponse(success=True, message="Parent soft-deleted.")
