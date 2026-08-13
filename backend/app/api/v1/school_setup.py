from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import require_permission, require_role
from app.database.session import get_db
from app.models.school import (
    AcademicSession,
    AcademicTerm,
    Department,
    SchoolClass,
    SchoolProfile,
    Subject,
)
from app.models.user import User
from app.schemas.auth import ApiResponse

router = APIRouter(prefix="/school-setup", tags=["School Setup"])


# ---------- Schemas ----------

class SchoolProfileIn(BaseModel):
    name: str
    motto: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "Nigeria"
    postal_code: Optional[str] = None
    school_type: Optional[str] = None
    school_level: Optional[str] = None
    principal_name: Optional[str] = None
    established_year: Optional[int] = None


class AcademicSessionIn(BaseModel):
    name: str


class AcademicTermIn(BaseModel):
    session_id: UUID
    name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class DepartmentIn(BaseModel):
    name: str
    description: Optional[str] = None


class SchoolClassIn(BaseModel):
    name: str  # e.g. "JSS 1", "JSS 2", "SS 3"
    level: str
    class_teacher_id: Optional[UUID] = None
    capacity: int = 40


class SchoolClassUpdateIn(BaseModel):
    name: Optional[str] = None
    level: Optional[str] = None
    class_teacher_id: Optional[UUID] = None
    capacity: Optional[int] = None
    status: Optional[str] = None


class SubjectIn(BaseModel):
    name: str
    code: Optional[str] = None
    department_id: Optional[UUID] = None


# ---------- School Profile ----------

@router.get("/school-profile")
def get_school_profile(db: Session = Depends(get_db)):
    profile = db.query(SchoolProfile).filter(SchoolProfile.deleted_at.is_(None)).first()
    if not profile:
        return {"success": True, "data": None, "message": "School profile not yet configured."}
    return {"success": True, "data": profile}


@router.put("/school-profile", response_model=ApiResponse)
def upsert_school_profile(
    payload: SchoolProfileIn,
    db: Session = Depends(get_db),
    _user=Depends(require_role("super_admin", "school_administrator")),
):
    profile = db.query(SchoolProfile).filter(SchoolProfile.deleted_at.is_(None)).first()
    if profile:
        for field, value in payload.model_dump().items():
            setattr(profile, field, value)
    else:
        profile = SchoolProfile(**payload.model_dump())
        db.add(profile)
    db.commit()
    return ApiResponse(success=True, message="School profile saved.")


# ---------- Academic Sessions ----------

@router.get("/academic-sessions")
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.query(AcademicSession).filter(AcademicSession.deleted_at.is_(None)).all()
    return {"success": True, "data": sessions}


@router.post("/academic-sessions", response_model=ApiResponse, status_code=201)
def create_session(
    payload: AcademicSessionIn,
    db: Session = Depends(get_db),
    _user=Depends(require_role("super_admin", "school_administrator")),
):
    if db.query(AcademicSession).filter(
        AcademicSession.name == payload.name, AcademicSession.deleted_at.is_(None)
    ).first():
        raise HTTPException(status_code=409, detail="Academic session already exists.")
    db.add(AcademicSession(name=payload.name))
    db.commit()
    return ApiResponse(success=True, message="Academic session created.")


@router.patch("/academic-sessions/{session_id}/activate", response_model=ApiResponse)
def activate_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    _user=Depends(require_role("super_admin", "school_administrator")),
):
    target = db.query(AcademicSession).filter(AcademicSession.id == session_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Session not found.")
    db.query(AcademicSession).update({AcademicSession.is_active: False})
    target.is_active = True
    db.commit()
    return ApiResponse(success=True, message=f"Session {target.name} is now active.")


# ---------- Academic Terms ----------

@router.get("/academic-terms")
def list_terms(session_id: Optional[UUID] = Query(None), db: Session = Depends(get_db)):
    q = db.query(AcademicTerm).filter(AcademicTerm.deleted_at.is_(None))
    if session_id:
        q = q.filter(AcademicTerm.session_id == session_id)
    return {"success": True, "data": q.all()}


@router.post("/academic-terms", response_model=ApiResponse, status_code=201)
def create_term(
    payload: AcademicTermIn,
    db: Session = Depends(get_db),
    _user=Depends(require_role("super_admin", "school_administrator")),
):
    db.add(AcademicTerm(**payload.model_dump()))
    db.commit()
    return ApiResponse(success=True, message="Academic term created.")


@router.patch("/academic-terms/{term_id}/activate", response_model=ApiResponse)
def activate_term(
    term_id: UUID,
    db: Session = Depends(get_db),
    _user=Depends(require_role("super_admin", "school_administrator")),
):
    target = db.query(AcademicTerm).filter(AcademicTerm.id == term_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Term not found.")
    db.query(AcademicTerm).filter(AcademicTerm.session_id == target.session_id).update({AcademicTerm.is_active: False})
    target.is_active = True
    db.commit()
    return ApiResponse(success=True, message=f"Term {target.name} is now active.")


# ---------- Departments ----------

@router.get("/departments")
def list_departments(db: Session = Depends(get_db)):
    return {"success": True, "data": db.query(Department).filter(Department.deleted_at.is_(None)).all()}


@router.post("/departments", response_model=ApiResponse, status_code=201)
def create_department(
    payload: DepartmentIn,
    db: Session = Depends(get_db),
    _user=Depends(require_permission("departments.create")),
):
    if db.query(Department).filter(Department.name == payload.name, Department.deleted_at.is_(None)).first():
        raise HTTPException(status_code=409, detail="Department already exists.")
    db.add(Department(**payload.model_dump()))
    db.commit()
    return ApiResponse(success=True, message="Department created.")


# ---------- Classes ----------

def _serialize_class(db: Session, school_class: SchoolClass) -> dict:
    teacher_user = (
        db.query(User).filter(User.id == school_class.class_teacher_id).first()
        if school_class.class_teacher_id else None
    )
    return {
        "id": school_class.id,
        "name": school_class.name,
        "level": school_class.level,
        "capacity": school_class.capacity,
        "status": school_class.status,
        "class_teacher_id": school_class.class_teacher_id,
        "class_teacher_name": teacher_user.full_name if teacher_user else None,
    }


@router.get("/classes")
def list_classes(db: Session = Depends(get_db)):
    classes = db.query(SchoolClass).filter(SchoolClass.deleted_at.is_(None)).order_by(SchoolClass.name).all()
    return {"success": True, "data": [_serialize_class(db, c) for c in classes]}


@router.post("/classes", response_model=ApiResponse, status_code=201)
def create_class(
    payload: SchoolClassIn,
    db: Session = Depends(get_db),
    _user=Depends(require_permission("classes.create")),
):
    if db.query(SchoolClass).filter(SchoolClass.name == payload.name, SchoolClass.deleted_at.is_(None)).first():
        raise HTTPException(status_code=409, detail="Class already exists.")
    if payload.class_teacher_id and not db.query(User).filter(
        User.id == payload.class_teacher_id, User.deleted_at.is_(None)
    ).first():
        raise HTTPException(status_code=404, detail="That teacher's user account was not found.")
    school_class = SchoolClass(**payload.model_dump())
    db.add(school_class)
    db.commit()
    db.refresh(school_class)
    return ApiResponse(success=True, message="Class created.", data={"id": str(school_class.id)})


@router.patch("/classes/{class_id}", response_model=ApiResponse)
def update_class(
    class_id: UUID,
    payload: SchoolClassUpdateIn,
    db: Session = Depends(get_db),
    _user=Depends(require_permission("classes.edit")),
):
    """Mainly used to assign (or change) the class teacher for a class,
    e.g. making Teacher 1 the class teacher for JSS 1. Once assigned, that
    teacher becomes the contact parents and students of that class see in
    Messaging."""
    school_class = db.query(SchoolClass).filter(
        SchoolClass.id == class_id, SchoolClass.deleted_at.is_(None)
    ).first()
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found.")

    data = payload.model_dump(exclude_unset=True)
    if data.get("class_teacher_id") is not None:
        teacher_user = db.query(User).filter(
            User.id == data["class_teacher_id"], User.deleted_at.is_(None)
        ).first()
        if not teacher_user:
            raise HTTPException(status_code=404, detail="That teacher's user account was not found.")
        if not any(r.name == "teacher" for r in teacher_user.roles):
            raise HTTPException(status_code=422, detail="That user account does not have the teacher role.")

        # The class-teacher field must point to a real active Teacher profile,
        # not merely a user account carrying the teacher role.
        from app.models.people import Teacher
        teacher_profile = db.query(Teacher).filter(
            Teacher.user_id == teacher_user.id,
            Teacher.deleted_at.is_(None),
        ).first()
        if not teacher_profile:
            raise HTTPException(
                status_code=409,
                detail="This teacher account does not have an active teacher profile.",
            )

    for field, value in data.items():
        setattr(school_class, field, value)
    db.commit()
    return ApiResponse(
        success=True,
        message="Class teacher assigned." if data.get("class_teacher_id") else "Class updated.",
    )


@router.delete("/classes/{class_id}", response_model=ApiResponse)
def delete_class(
    class_id: UUID,
    db: Session = Depends(get_db),
    _user=Depends(require_permission("classes.delete")),
):
    school_class = db.query(SchoolClass).filter(
        SchoolClass.id == class_id, SchoolClass.deleted_at.is_(None)
    ).first()
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found.")
    school_class.soft_delete()
    db.commit()
    return ApiResponse(success=True, message="Class soft-deleted.")


# ---------- Subjects ----------

@router.get("/subjects")
def list_subjects(db: Session = Depends(get_db)):
    return {"success": True, "data": db.query(Subject).filter(Subject.deleted_at.is_(None)).all()}


@router.post("/subjects", response_model=ApiResponse, status_code=201)
def create_subject(
    payload: SubjectIn,
    db: Session = Depends(get_db),
    _user=Depends(require_permission("subjects.create")),
):
    if db.query(Subject).filter(Subject.name == payload.name, Subject.deleted_at.is_(None)).first():
        raise HTTPException(status_code=409, detail="Subject already exists.")
    db.add(Subject(**payload.model_dump()))
    db.commit()
    return ApiResponse(success=True, message="Subject created.")
