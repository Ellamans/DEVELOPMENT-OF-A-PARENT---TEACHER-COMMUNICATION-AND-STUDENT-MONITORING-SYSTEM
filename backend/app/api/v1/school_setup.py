from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database.session import get_db
from app.models.school import SchoolClass
from app.models.people import Teacher
from app.models.user import User
from app.auth.dependencies import get_current_user

router = APIRouter()

class AssignTeacherSchema(BaseModel):
    teacher_id: Optional[str] = None

@router.post("/classes/{class_id}/assign-teacher")
@router.patch("/classes/{class_id}/assign-teacher")
def assign_class_teacher(
    class_id: str,
    payload: AssignTeacherSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Fetch class
    class_obj = db.query(SchoolClass).filter(SchoolClass.id == class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    # 2. Handle unassignment
    if not payload.teacher_id:
        class_obj.class_teacher_id = None
        db.commit()
        return {"message": "Teacher unassigned successfully"}

    # 3. Lookup Teacher by Teacher Profile ID first, fallback to User ID
    teacher = db.query(Teacher).filter(Teacher.id == payload.teacher_id).first()
    if not teacher:
        teacher = db.query(Teacher).filter(Teacher.user_id == payload.teacher_id).first()

    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")

    # 4. Assign and save
    class_obj.class_teacher_id = teacher.user_id
    db.commit()
    return {
        "message": "Teacher assigned successfully",
        "class_id": str(class_obj.id),
        "teacher_id": str(teacher.id)
    }
