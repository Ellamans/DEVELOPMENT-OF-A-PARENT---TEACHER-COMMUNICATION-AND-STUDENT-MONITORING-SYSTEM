from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, EmailStr

from app.database.session import get_db
from app.models.people import Parent
from app.models.user import User
from app.core.security import get_password_hash

router = APIRouter()

class ParentCreateSchema(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    occupation: Optional[str] = None

@router.post("", status_code=status.HTTP_201_CREATED)
def create_parent(payload: ParentCreateSchema, db: Session = Depends(get_db)):
    # Prevent duplicate email creation
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="An account with this email address already exists."
        )

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        phone_number=payload.phone,
        hashed_password=get_password_hash("Parent123!"),
        role="parent",
        is_active=True
    )
    db.add(user)
    db.flush()

    parent = Parent(
        user_id=user.id,
        occupation=payload.occupation
    )
    db.add(parent)
    db.commit()
    db.refresh(parent)
    return {"id": str(parent.id), "full_name": user.full_name, "email": user.email}
