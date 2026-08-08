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
    ClassArm,
    Department,
    SchoolClass,
    SchoolProfile,
    Subject,
)
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
    name: str
    level: str


class ClassArmIn(BaseModel):
    class_id: UUID
    name: str
    class_teacher_id: Optional[UUID] = None
    capacity: int = 40


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


# ---------- Classes & Arms ----------

@router.get("/classes")
def list_classes(db: Session = Depends(get_db)):
    return {"success": True, "data": db.query(SchoolClass).filter(SchoolClass.deleted_at.is_(None)).all()}


@router.post("/classes", response_model=ApiResponse, status_code=201)
def create_class(
    payload: SchoolClassIn,
    db: Session = Depends(get_db),
    _user=Depends(require_permission("classes.create")),
):
    if db.query(SchoolClass).filter(SchoolClass.name == payload.name, SchoolClass.deleted_at.is_(None)).first():
        raise HTTPException(status_code=409, detail="Class already exists.")
    db.add(SchoolClass(**payload.model_dump()))
    db.commit()
    return ApiResponse(success=True, message="Class created.")


@router.get("/class-arms")
def list_class_arms(class_id: Optional[UUID] = Query(None), db: Session = Depends(get_db)):
    q = db.query(ClassArm).filter(ClassArm.deleted_at.is_(None))
    if class_id:
        q = q.filter(ClassArm.class_id == class_id)
    return {"success": True, "data": q.all()}


@router.post("/class-arms", response_model=ApiResponse, status_code=201)
def create_class_arm(
    payload: ClassArmIn,
    db: Session = Depends(get_db),
    _user=Depends(require_permission("classes.create")),
):
    db.add(ClassArm(**payload.model_dump()))
    db.commit()
    return ApiResponse(success=True, message="Class arm created.")


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
