from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database.session import get_db
from app.models.school import Class
from app.models.people import Teacher
from app.models.user import User
from app.auth.dependencies import get_current_user

router = APIRouter()

class AssignTeacherSchema(BaseModel):
    teacher_id: Optional[str] = None

@router.get("/classes", response_model=List[dict])
def get_classes(db: Session = Depends(get_db)):
    classes = db.query(Class).all()
    result = []
    for c in classes:
        teacher_name = None
        if c.class_teacher_id:
            teacher = db.query(Teacher).filter(Teacher.id == c.class_teacher_id).first()
            if teacher and teacher.user:
                teacher_name = teacher.user.full_name
        result.append({
            "id": str(c.id),
            "name": c.name,
            "grade_level": c.grade_level,
            "capacity": c.capacity,
            "class_teacher_id": str(c.class_teacher_id) if c.class_teacher_id else None,
            "class_teacher_name": teacher_name
        })
    return result

@router.post("/classes/{class_id}/assign-teacher")
@router.patch("/classes/{class_id}/assign-teacher")
def assign_class_teacher(
    class_id: str,
    payload: AssignTeacherSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    if not payload.teacher_id:
        class_obj.class_teacher_id = None
        db.commit()
        return {"message": "Teacher unassigned successfully"}

    # Attempt lookup by Teacher profile ID first, fallback to User ID
    teacher = db.query(Teacher).filter(Teacher.id == payload.teacher_id).first()
    if not teacher:
        teacher = db.query(Teacher).filter(Teacher.user_id == payload.teacher_id).first()

    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")

    class_obj.class_teacher_id = teacher.id
    db.commit()
    return {"message": "Teacher assigned successfully", "class_id": str(class_obj.id), "teacher_id": str(teacher.id)}
