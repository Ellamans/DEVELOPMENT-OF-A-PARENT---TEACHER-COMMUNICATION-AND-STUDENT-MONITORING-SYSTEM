from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import require_permission
from app.database.session import get_db
from app.models.people import EmergencyContact, Parent, Student, StudentDocument, student_parents
from app.models.user import User
from app.schemas.auth import ApiResponse
from app.schemas.student import ParentLinkIn, StudentIn, StudentStatusUpdate

router = APIRouter(prefix="/students", tags=["Student Management"])


def _generate_admission_number(db: Session) -> str:
    count = db.query(Student).count() + 1
    return f"ADM{count:05d}"


@router.get("")
def list_students(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    class_id: Optional[UUID] = None,
    class_arm_id: Optional[UUID] = None,
    gender: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    academic_session_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("students.view")),
):
    q = db.query(Student).filter(Student.deleted_at.is_(None))
    if search:
        like = f"%{search}%"
        q = q.filter(
            (Student.first_name.ilike(like))
            | (Student.last_name.ilike(like))
            | (Student.admission_number.ilike(like))
        )
    if class_id:
        q = q.filter(Student.current_class_id == class_id)
    if class_arm_id:
        q = q.filter(Student.class_arm_id == class_arm_id)
    if gender:
        q = q.filter(Student.gender == gender)
    if status_filter:
        q = q.filter(Student.status == status_filter)
    if academic_session_id:
        q = q.filter(Student.academic_session_id == academic_session_id)

    total = q.count()
    items = q.order_by(Student.last_name).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "success": True,
        "data": items,
        "pagination": {"page": page, "page_size": page_size, "total": total},
    }


def _validate_linkable_user(db: Session, user_id: UUID, role_name: str, existing_check) -> None:
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="That user account was not found.")
    if not any(r.name == role_name for r in user.roles):
        raise HTTPException(status_code=422, detail=f"That user account does not have the {role_name} role.")
    if existing_check(user_id):
        raise HTTPException(status_code=409, detail="That account is already linked to a profile.")


@router.post("", response_model=ApiResponse, status_code=201)
def create_student(
    payload: StudentIn,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("students.create")),
):
    admission_number = payload.admission_number or _generate_admission_number(db)
    if db.query(Student).filter(Student.admission_number == admission_number, Student.deleted_at.is_(None)).first():
        raise HTTPException(status_code=409, detail="Admission number already exists.")

    if payload.user_id:
        _validate_linkable_user(
            db, payload.user_id, "student",
            lambda uid: db.query(Student).filter(Student.user_id == uid, Student.deleted_at.is_(None)).first() is not None,
        )

    data = payload.model_dump(exclude={"admission_number"})
    student = Student(admission_number=admission_number, status="active", **data)
    db.add(student)
    db.commit()
    db.refresh(student)
    return ApiResponse(success=True, message="Student created.", data={"id": str(student.id)})


@router.get("/{student_id}")
def get_student(
    student_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("students.view")),
):
    student = db.query(Student).filter(Student.id == student_id, Student.deleted_at.is_(None)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    return {"success": True, "data": student}


@router.patch("/{student_id}", response_model=ApiResponse)
def update_student(
    student_id: UUID,
    payload: StudentIn,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("students.edit")),
):
    student = db.query(Student).filter(Student.id == student_id, Student.deleted_at.is_(None)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    for field, value in payload.model_dump(exclude_unset=True, exclude={"admission_number"}).items():
        setattr(student, field, value)
    db.commit()
    return ApiResponse(success=True, message="Student updated.")


@router.patch("/{student_id}/status", response_model=ApiResponse)
def update_student_status(
    student_id: UUID,
    payload: StudentStatusUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("students.edit")),
):
    student = db.query(Student).filter(Student.id == student_id, Student.deleted_at.is_(None)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    valid_statuses = {"active", "graduated", "transferred", "suspended", "expelled", "withdrawn"}
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"Status must be one of {valid_statuses}")
    student.status = payload.status
    db.commit()
    return ApiResponse(success=True, message=f"Student status updated to {payload.status}.")


@router.delete("/{student_id}", response_model=ApiResponse)
def delete_student(
    student_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("students.delete")),
):
    student = db.query(Student).filter(Student.id == student_id, Student.deleted_at.is_(None)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    student.soft_delete()
    db.commit()
    return ApiResponse(success=True, message="Student soft-deleted.")


@router.post("/{student_id}/restore", response_model=ApiResponse)
def restore_student(
    student_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("students.edit")),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student or not student.deleted_at:
        raise HTTPException(status_code=404, detail="Deleted student not found.")
    student.deleted_at = None
    db.commit()
    return ApiResponse(success=True, message="Student restored.")


# ---------- Parent linking ----------

@router.post("/{student_id}/parents", response_model=ApiResponse)
def link_parent(
    student_id: UUID,
    payload: ParentLinkIn,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("students.edit")),
):
    student = db.query(Student).filter(Student.id == student_id, Student.deleted_at.is_(None)).first()
    parent = db.query(Parent).filter(Parent.id == payload.parent_id, Parent.deleted_at.is_(None)).first()
    if not student or not parent:
        raise HTTPException(status_code=404, detail="Student or parent not found.")
    if payload.relationship_type not in {"father", "mother", "guardian"}:
        raise HTTPException(status_code=422, detail="relationship_type must be father, mother, or guardian.")

    exists = db.query(student_parents).filter(
        student_parents.c.student_id == student_id, student_parents.c.parent_id == payload.parent_id
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="This parent is already linked to this student.")

    db.execute(
        student_parents.insert().values(
            student_id=student_id, parent_id=payload.parent_id, relationship_type=payload.relationship_type
        )
    )
    db.commit()
    return ApiResponse(success=True, message="Parent linked to student.")


@router.delete("/{student_id}/parents/{parent_id}", response_model=ApiResponse)
def unlink_parent(
    student_id: UUID,
    parent_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("students.edit")),
):
    result = db.execute(
        student_parents.delete().where(
            student_parents.c.student_id == student_id, student_parents.c.parent_id == parent_id
        )
    )
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Relationship not found.")
    return ApiResponse(success=True, message="Parent unlinked from student.")


# ---------- Documents ----------

@router.get("/{student_id}/documents")
def list_documents(
    student_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("students.view")),
):
    docs = db.query(StudentDocument).filter(
        StudentDocument.student_id == student_id, StudentDocument.deleted_at.is_(None)
    ).all()
    return {"success": True, "data": docs}


# ---------- Emergency contacts ----------

@router.get("/{student_id}/emergency-contacts")
def list_emergency_contacts(
    student_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("students.view")),
):
    contacts = db.query(EmergencyContact).filter(
        EmergencyContact.student_id == student_id, EmergencyContact.deleted_at.is_(None)
    ).all()
    return {"success": True, "data": contacts}
