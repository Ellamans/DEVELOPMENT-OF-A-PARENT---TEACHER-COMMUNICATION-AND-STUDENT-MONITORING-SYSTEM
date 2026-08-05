from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import require_permission
from app.database.session import get_db
from app.models.people import Parent
from app.models.user import User
from app.schemas.auth import ApiResponse
from app.schemas.student import ParentIn

router = APIRouter(prefix="/parents", tags=["Parent Management"])


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
    if payload.email and db.query(Parent).filter(Parent.email == payload.email, Parent.deleted_at.is_(None)).first():
        raise HTTPException(status_code=409, detail="A parent with this email already exists — link the existing record instead.")
    parent = Parent(**payload.model_dump())
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
