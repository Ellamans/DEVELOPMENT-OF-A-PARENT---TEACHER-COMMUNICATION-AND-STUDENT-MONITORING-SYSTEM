from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.communication import Conversation, Message, conversation_members
from app.models.user import User
from app.schemas.auth import ApiResponse

router = APIRouter(tags=["Messaging"])


class StartConversationIn(BaseModel):
    participant_ids: list[UUID]
    conversation_type: str = "direct"
    title: Optional[str] = None


@router.post("/conversations", response_model=ApiResponse, status_code=201)
def start_conversation(
    payload: StartConversationIn, db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    conversation = Conversation(conversation_type=payload.conversation_type, title=payload.title)
    db.add(conversation)
    db.flush()

    member_ids = set(payload.participant_ids) | {user.id}
    for uid in member_ids:
        db.execute(conversation_members.insert().values(conversation_id=conversation.id, user_id=uid))
    db.commit()
    return ApiResponse(success=True, message="Conversation started.", data={"id": str(conversation.id)})


@router.get("/conversations")
def list_conversations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = (
        db.query(Conversation)
        .join(conversation_members, conversation_members.c.conversation_id == Conversation.id)
        .filter(conversation_members.c.user_id == user.id, Conversation.deleted_at.is_(None))
        .order_by(Conversation.is_pinned.desc(), Conversation.updated_at.desc())
    )
    return {"success": True, "data": q.all()}


@router.patch("/conversations/{conversation_id}/archive", response_model=ApiResponse)
def archive_conversation(
    conversation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    conv.is_archived = True
    db.commit()
    return ApiResponse(success=True, message="Conversation archived.")


class SendMessageIn(BaseModel):
    content: str


@router.get("/conversations/{conversation_id}/messages")
def list_messages(
    conversation_id: UUID, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    is_member = db.query(conversation_members).filter(
        conversation_members.c.conversation_id == conversation_id, conversation_members.c.user_id == user.id
    ).first()
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a participant in this conversation.")

    q = db.query(Message).filter(
        Message.conversation_id == conversation_id, Message.deleted_for_sender.is_(False)
    ).order_by(Message.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {"success": True, "data": list(reversed(items)), "pagination": {"page": page, "page_size": page_size, "total": total}}


@router.post("/conversations/{conversation_id}/messages", response_model=ApiResponse, status_code=201)
def send_message(
    conversation_id: UUID, payload: SendMessageIn, db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    is_member = db.query(conversation_members).filter(
        conversation_members.c.conversation_id == conversation_id, conversation_members.c.user_id == user.id
    ).first()
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a participant in this conversation.")

    message = Message(conversation_id=conversation_id, sender_id=user.id, content=payload.content)
    db.add(message)
    db.commit()
    return ApiResponse(success=True, message="Message sent.")


@router.get("/messages/search")
def search_messages(
    q_text: str = Query(..., alias="q"), db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    my_conversation_ids = db.query(conversation_members.c.conversation_id).filter(
        conversation_members.c.user_id == user.id
    )
    results = db.query(Message).filter(
        Message.conversation_id.in_(my_conversation_ids), Message.content.ilike(f"%{q_text}%"),
        Message.deleted_for_sender.is_(False),
    ).limit(50).all()
    return {"success": True, "data": results}
