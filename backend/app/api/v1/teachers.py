from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, EmailStr

from app.database.session import get_db
from app.models.people import Teacher
from app.models.user import User
from app.core.security import get_password_hash
from app.auth.dependencies import get_current_user

router = APIRouter()

class TeacherCreateSchema(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    employee_id: Optional[str] = None
    qualification: Optional[str] = None
    specialization: Optional[str] = None

class TeacherUpdateSchema(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    qualification: Optional[str] = None
    specialization: Optional[str] = None
    status: Optional[str] = None

def serialize_teacher(teacher: Teacher):
    user = teacher.user
    return {
        "id": str(teacher.id),
        "user_id": str(teacher.user_id),
        "employee_id": teacher.employee_id or f"EMP{teacher.id[:6]}",
        "full_name": user.full_name if user else "Unknown Teacher",
        "email": user.email if user else "",
        "phone": user.phone_number if user else "",
        "qualification": teacher.qualification or "",
        "specialization": teacher.specialization or "",
        "status": user.status if user else "active",
        "assigned_class": teacher.assigned_class.name if getattr(teacher, "assigned_class", None) else None
    }

@router.get("")
def list_teachers(page: int = 1, page_size: int = 50, db: Session = Depends(get_db)):
    teachers = db.query(Teacher).options(joinedload(Teacher.user)).offset((page - 1) * page_size).limit(page_size).all()
    return [serialize_teacher(t) for t in teachers]

@router.post("", status_code=status.HTTP_201_CREATED)
def create_teacher(payload: TeacherCreateSchema, db: Session = Depends(get_db)):
    # 1. Prevent duplicate email creation across all profiles
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400, 
            detail="An account with this email address already exists."
        )

    # 2. Create User account
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        phone_number=payload.phone,
        hashed_password=get_password_hash("Teacher123!"),
        role="teacher",
        is_active=True
    )
    db.add(user)
    db.flush()

    # 3. Create Teacher profile
    teacher = Teacher(
        user_id=user.id,
        employee_id=payload.employee_id or f"EMP{str(user.id)[:6].upper()}",
        qualification=payload.qualification,
        specialization=payload.specialization
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    
    return serialize_teacher(teacher)

@router.put("/{teacher_id}")
@router.patch("/{teacher_id}")
def update_teacher(teacher_id: str, payload: TeacherUpdateSchema, db: Session = Depends(get_db)):
    teacher = db.query(Teacher).options(joinedload(Teacher.user)).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    if payload.qualification is not None:
        teacher.qualification = payload.qualification
    if payload.specialization is not None:
        teacher.specialization = payload.specialization

    if teacher.user:
        if payload.full_name is not None:
            teacher.user.full_name = payload.full_name
        if payload.phone is not None:
            teacher.user.phone_number = payload.phone
        if payload.status is not None:
            teacher.user.status = payload.status

    db.commit()
    db.refresh(teacher)
    return serialize_teacher(teacher)

@router.delete("/{teacher_id}")
def delete_teacher(teacher_id: str, db: Session = Depends(get_db)):
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    
    user = db.query(User).filter(User.id == teacher.user_id).first()
    db.delete(teacher)
    if user:
        db.delete(user)
    db.commit()
    return {"message": "Teacher deleted successfully"}
