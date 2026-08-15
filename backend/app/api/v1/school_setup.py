from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import require_permission, require_role
from app.database.session import get_db
from app.models.people import Teacher, teacher_classes
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


@router.get("/classes/public")
def list_classes_public(db: Session = Depends(get_db)):
    """Unauthenticated, minimal class list for the registration page — a
    prospective teacher needs to pick a class before they have an account to
    log in with. Deliberately returns only id/name/level (no capacity,
    status, or current class teacher) since this is public.
    """
    classes = db.query(SchoolClass).filter(
        SchoolClass.deleted_at.is_(None), SchoolClass.status == "active"
    ).order_by(SchoolClass.name).all()
    return {"success": True, "data": [{"id": c.id, "name": c.name, "level": c.level} for c in classes]}


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


def _next_employee_id(db: Session) -> str:
    count = db.query(Teacher).count() + 1
    candidate = f"EMP{count:05d}"
    # Guard against a gap left by soft-deleted rows colliding with the next
    # sequential number.
    while db.query(Teacher).filter(Teacher.employee_id == candidate).first():
        count += 1
        candidate = f"EMP{count:05d}"
    return candidate


@router.post("/classes/{class_id}/assign-teacher", response_model=ApiResponse)
def assign_class_teacher(
    class_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    _user=Depends(require_permission("classes.edit")),
):
    """Assign a teacher profile as the class teacher.

    The UI has historically had two different teacher identifiers available:
    the Teacher profile id and the linked User id. Accept either one, resolve
    it to the Teacher profile, then persist the User id in classes.class_teacher_id
    (the database FK points to users.id) and the Teacher<->Class association.
    """
    school_class = db.query(SchoolClass).filter(
        SchoolClass.id == class_id,
        SchoolClass.deleted_at.is_(None),
    ).first()
    if not school_class:
        # Distinguish "doesn't exist at all" from "exists but soft-deleted"
        # so the error is actually diagnostic instead of a generic 404 —
        # both in the API response and in the server logs.
        any_match = db.query(SchoolClass).filter(SchoolClass.id == class_id).first()
        total_active = db.query(SchoolClass).filter(SchoolClass.deleted_at.is_(None)).count()
        if any_match is not None:
            reason = "that class was deleted"
        else:
            reason = "no class with that id exists in this database"
        print(
            f"[assign-teacher] 404: class_id={class_id} not resolvable "
            f"({reason}); {total_active} active class(es) currently exist."
        )
        raise HTTPException(
            status_code=404,
            detail=(
                f"Class not found ({reason}). There are currently {total_active} "
                "class(es) in the system — refresh the Classes/Teachers page to "
                "reload the list, then try again."
            ),
        )

    raw_teacher_id = payload.get("teacher_id") or payload.get("teacher_user_id")
    if not raw_teacher_id:
        raise HTTPException(status_code=422, detail="A teacher id is required.")

    try:
        teacher_id = UUID(str(raw_teacher_id))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Invalid teacher id.")

    teacher = db.query(Teacher).filter(
        Teacher.deleted_at.is_(None),
        (Teacher.id == teacher_id) | (Teacher.user_id == teacher_id),
    ).first()

    if not teacher:
        # The id the frontend sent didn't match a Teacher profile. This is
        # expected when the Classes tab's dropdown (which lists every User
        # with the "teacher" role, not just the ones with a Teacher profile
        # already created) is used to pick someone who was never explicitly
        # turned into a Teacher profile via Users -> "Create Teacher Profile"
        # or the Teachers page. Rather than dead-ending the admin with a 404,
        # auto-provision the missing profile here — the same auto-provisioning
        # this codebase already does for self-registered accounts (see
        # auth.register) — as long as the id resolves to a real user with the
        # teacher role.
        candidate_user = db.query(User).filter(
            User.id == teacher_id, User.deleted_at.is_(None)
        ).first()
        if not candidate_user:
            print(f"[assign-teacher] 404: teacher_id={teacher_id} matches no Teacher profile or User account.")
            raise HTTPException(status_code=404, detail="Teacher not found. Their user account may have been deleted.")
        if not any(r.name == "teacher" for r in candidate_user.roles):
            print(f"[assign-teacher] 422: user {candidate_user.id} ({candidate_user.email}) lacks the teacher role.")
            raise HTTPException(status_code=422, detail="That user account does not have the teacher role.")

        teacher = db.query(Teacher).filter(
            Teacher.user_id == candidate_user.id, Teacher.deleted_at.is_(None)
        ).first()
        if not teacher:
            teacher = Teacher(
                user_id=candidate_user.id,
                employee_id=_next_employee_id(db),
                employment_status="active",
            )
            db.add(teacher)
            db.flush()  # get teacher.id without a separate round trip

    teacher_user = db.query(User).filter(
        User.id == teacher.user_id,
        User.deleted_at.is_(None),
    ).first()
    if not teacher_user:
        raise HTTPException(status_code=404, detail="The teacher's user account was not found.")

    # Remove the class from the previous teacher's many-to-many assignment
    # when changing the class teacher, while preserving the new assignment.
    previous_teacher = None
    if school_class.class_teacher_id and school_class.class_teacher_id != teacher.user_id:
        previous_teacher = db.query(Teacher).filter(
            Teacher.user_id == school_class.class_teacher_id,
            Teacher.deleted_at.is_(None),
        ).first()
        if previous_teacher and school_class in previous_teacher.classes:
            previous_teacher.classes.remove(school_class)

    school_class.class_teacher_id = teacher.user_id
    if school_class not in teacher.classes:
        teacher.classes.append(school_class)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unable to assign the class teacher.")

    return ApiResponse(
        success=True,
        message=f"{teacher_user.full_name} is now the class teacher for {school_class.name}.",
        data={"class_id": str(school_class.id), "teacher_id": str(teacher.id), "teacher_user_id": str(teacher.user_id)},
    )


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
        if not any(r.name in {"teacher", "class_teacher"} for r in teacher_user.roles):
            raise HTTPException(status_code=422, detail="That user account does not have the teacher role.")

    for field, value in data.items():
        setattr(school_class, field, value)
    db.commit()
    return ApiResponse(success=True, message="Class updated.")


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
