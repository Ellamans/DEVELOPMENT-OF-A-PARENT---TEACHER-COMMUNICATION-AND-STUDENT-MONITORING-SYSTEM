from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import require_permission
from app.database.session import get_db
from app.models.people import Teacher, teacher_classes, teacher_subjects
from app.models.school import SchoolClass, Subject
from app.models.user import User
from app.schemas.auth import ApiResponse

router = APIRouter(prefix="/teachers", tags=["Teacher Management"])


class TeacherIn(BaseModel):
    user_id: UUID
    employee_id: Optional[str] = None
    qualification: Optional[str] = None
    department_id: Optional[UUID] = None
    employment_date: Optional[str] = None


class AssignSubjectIn(BaseModel):
    subject_id: UUID


class AssignClassIn(BaseModel):
    class_id: UUID


def _generate_employee_id(db: Session) -> str:
    count = db.query(Teacher).count() + 1
    return f"EMP{count:05d}"


@router.get("")
def list_teachers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    department_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("teachers.view")),
):
    q = db.query(Teacher).filter(Teacher.deleted_at.is_(None))
    if department_id:
        q = q.filter(Teacher.department_id == department_id)
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    user_ids = [t.user_id for t in items]
    users_by_id = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    data = []
    for t in items:
        u = users_by_id.get(t.user_id)
        data.append({
            "id": t.id, "employee_id": t.employee_id, "qualification": t.qualification,
            "employment_status": t.employment_status, "department_id": t.department_id,
            "user_id": t.user_id,
            "full_name": f"{u.first_name} {u.last_name}" if u else None,
            "email": u.email if u else None,
        })
    return {"success": True, "data": data, "pagination": {"page": page, "page_size": page_size, "total": total}}


@router.post("", response_model=ApiResponse, status_code=201)
def create_teacher(
    payload: TeacherIn,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("teachers.create")),
):
    target_user = db.query(User).filter(User.id == payload.user_id, User.deleted_at.is_(None)).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="That user account was not found.")
    if not any(r.name == "teacher" for r in target_user.roles):
        raise HTTPException(status_code=422, detail="That user account does not have the teacher role.")
    if db.query(Teacher).filter(Teacher.user_id == payload.user_id, Teacher.deleted_at.is_(None)).first():
        raise HTTPException(status_code=409, detail="That account is already linked to a teacher profile.")

    employee_id = payload.employee_id or _generate_employee_id(db)
    if db.query(Teacher).filter(Teacher.employee_id == employee_id, Teacher.deleted_at.is_(None)).first():
        raise HTTPException(status_code=409, detail="Employee ID already exists.")
    teacher = Teacher(
        user_id=payload.user_id, employee_id=employee_id, qualification=payload.qualification,
        department_id=payload.department_id, employment_date=payload.employment_date, employment_status="active",
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return ApiResponse(success=True, message="Teacher profile created.", data={"id": str(teacher.id)})


@router.get("/{teacher_id}")
def get_teacher(
    teacher_id: UUID, db: Session = Depends(get_db), _user: User = Depends(require_permission("teachers.view"))
):
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id, Teacher.deleted_at.is_(None)).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found.")
    homeroom_classes = db.query(SchoolClass).filter(
        SchoolClass.class_teacher_id == teacher.user_id, SchoolClass.deleted_at.is_(None)
    ).all()
    teacher_user = db.query(User).filter(User.id == teacher.user_id, User.deleted_at.is_(None)).first()
    full_name = teacher_user.full_name if teacher_user else None
    email = teacher_user.email if teacher_user else None
    return {"success": True, "data": {
        "id": teacher.id, "employee_id": teacher.employee_id, "qualification": teacher.qualification,
        "employment_status": teacher.employment_status,
        "user_id": teacher.user_id,
        "full_name": full_name,
        "email": email,
        "subjects": [{"id": s.id, "name": s.name} for s in teacher.subjects],
        "classes": [{"id": c.id, "name": c.name} for c in teacher.classes],
        "class_teacher_of": [{"id": c.id, "name": c.name} for c in homeroom_classes],
    }}


@router.post("/{teacher_id}/subjects", response_model=ApiResponse)
def assign_subject(
    teacher_id: UUID, payload: AssignSubjectIn, db: Session = Depends(get_db),
    _user: User = Depends(require_permission("teachers.edit")),
):
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id, Teacher.deleted_at.is_(None)).first()
    subject = db.query(Subject).filter(Subject.id == payload.subject_id, Subject.deleted_at.is_(None)).first()
    if not teacher or not subject:
        raise HTTPException(status_code=404, detail="Teacher or subject not found.")
    if subject not in teacher.subjects:
        teacher.subjects.append(subject)
        db.commit()
    return ApiResponse(success=True, message="Subject assigned.")


@router.post("/{teacher_id}/classes", response_model=ApiResponse)
def assign_class(
    teacher_id: UUID, payload: AssignClassIn, db: Session = Depends(get_db),
    _user: User = Depends(require_permission("teachers.edit")),
):
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id, Teacher.deleted_at.is_(None)).first()
    school_class = db.query(SchoolClass).filter(
        SchoolClass.id == payload.class_id, SchoolClass.deleted_at.is_(None)
    ).first()
    if not teacher or not school_class:
        raise HTTPException(status_code=404, detail="Teacher or class not found.")
    if school_class not in teacher.classes:
        teacher.classes.append(school_class)
        db.commit()
    return ApiResponse(success=True, message="Class assigned.")


@router.delete("/{teacher_id}", response_model=ApiResponse)
def delete_teacher(
    teacher_id: UUID, db: Session = Depends(get_db), _user: User = Depends(require_permission("teachers.delete"))
):
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id, Teacher.deleted_at.is_(None)).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found.")
    teacher.soft_delete()
    db.commit()
    return ApiResponse(success=True, message="Teacher soft-deleted.")
