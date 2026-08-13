from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.communication import Conversation, Message, conversation_members
from app.models.people import Parent, Student, Teacher
from app.models.school import SchoolClass
from app.models.user import User
from app.schemas.auth import ApiResponse

router = APIRouter(tags=["Messaging"])


# ---------- Contacts (who am I allowed to message) ----------

@router.get("/messaging/contacts")
def list_my_contacts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Returns the people the logged-in user can message, based on class
    assignment rather than raw user IDs:
    - A parent sees the class teacher of each of their children.
    - A student sees their own class teacher.
    - A teacher who is a class teacher sees the students and parents of
      every class arm assigned to them.

    This is what powers the "Message" picker in the Messaging page, so
    parents/students never need to know anyone's user ID.
    """
    role_names = {r.name for r in user.roles}
    contacts: dict[UUID, dict] = {}

    def add_contact(target_user_id, name, role_label, context):
        if not target_user_id or target_user_id == user.id:
            return
        existing = contacts.get(target_user_id)
        if existing:
            if context not in existing["context"]:
                existing["context"].append(context)
        else:
            contacts[target_user_id] = {
                "user_id": target_user_id,
                "name": name,
                "role": role_label,
                "context": [context],
            }

    def class_label(school_class: SchoolClass) -> str:
        return school_class.name

    # Parent -> their children's class teachers
    if "parent" in role_names:
        parent = db.query(Parent).filter(Parent.user_id == user.id, Parent.deleted_at.is_(None)).first()
        if parent:
            for child in parent.students:
                if child.deleted_at is not None or not child.current_class_id:
                    continue
                school_class = db.query(SchoolClass).filter(SchoolClass.id == child.current_class_id).first()
                if school_class and school_class.class_teacher_id:
                    teacher_user = db.query(User).filter(User.id == school_class.class_teacher_id).first()
                    if teacher_user:
                        add_contact(
                            teacher_user.id, teacher_user.full_name, "Class Teacher",
                            f"{class_label(school_class)} — {child.full_name}'s class teacher",
                        )

    # Student -> their own class teacher
    if "student" in role_names:
        student = db.query(Student).filter(Student.user_id == user.id, Student.deleted_at.is_(None)).first()
        if student and student.current_class_id:
            school_class = db.query(SchoolClass).filter(SchoolClass.id == student.current_class_id).first()
            if school_class and school_class.class_teacher_id:
                teacher_user = db.query(User).filter(User.id == school_class.class_teacher_id).first()
                if teacher_user:
                    add_contact(
                        teacher_user.id, teacher_user.full_name, "Class Teacher",
                        f"{class_label(school_class)} — your class teacher",
                    )

    # Teacher -> students & parents of any class(es) they are class teacher for
    if {"teacher", "class_teacher"} & role_names:
        classes = db.query(SchoolClass).filter(
            SchoolClass.class_teacher_id == user.id, SchoolClass.deleted_at.is_(None)
        ).all()
        for school_class in classes:
            label = class_label(school_class)
            students = db.query(Student).filter(
                Student.current_class_id == school_class.id, Student.deleted_at.is_(None)
            ).all()
            for s in students:
                if s.user_id:
                    add_contact(s.user_id, s.full_name, "Student", f"{label} — your student")
                for p in s.parents:
                    if p.deleted_at is None and p.user_id:
                        add_contact(p.user_id, p.full_name, "Parent", f"{label} — {s.full_name}'s parent")

    return {"success": True, "data": list(contacts.values())}


class StartDirectIn(BaseModel):
    other_user_id: UUID


@router.post("/messaging/direct", response_model=ApiResponse, status_code=201)
def start_or_get_direct_conversation(
    payload: StartDirectIn, db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    """Starts a 1:1 conversation with someone (typically picked from
    /messaging/contacts), or returns the existing one if these two users
    already have a direct conversation — so contacting the same class
    teacher twice doesn't create duplicate threads."""
    other = db.query(User).filter(User.id == payload.other_user_id, User.deleted_at.is_(None)).first()
    if not other:
        raise HTTPException(status_code=404, detail="That user account was not found.")
    if other.id == user.id:
        raise HTTPException(status_code=422, detail="You can't start a conversation with yourself.")

    my_direct_conv_ids = [
        row[0]
        for row in (
            db.query(conversation_members.c.conversation_id)
            .join(Conversation, Conversation.id == conversation_members.c.conversation_id)
            .filter(
                conversation_members.c.user_id == user.id,
                Conversation.conversation_type == "direct",
                Conversation.deleted_at.is_(None),
            )
            .all()
        )
    ]
    for conv_id in my_direct_conv_ids:
        members = {
            row[0]
            for row in db.query(conversation_members.c.user_id)
            .filter(conversation_members.c.conversation_id == conv_id)
            .all()
        }
        if members == {user.id, other.id}:
            return ApiResponse(success=True, message="Conversation ready.", data={"id": str(conv_id)})

    conversation = Conversation(conversation_type="direct", title=None)
    db.add(conversation)
    db.flush()
    db.execute(conversation_members.insert().values(conversation_id=conversation.id, user_id=user.id))
    db.execute(conversation_members.insert().values(conversation_id=conversation.id, user_id=other.id))
    db.commit()
    return ApiResponse(success=True, message="Conversation started.", data={"id": str(conversation.id)})


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
    conversations = q.all()

    # For direct conversations (no title), the frontend needs to know who the
    # *other* participant is so it can show a name instead of "direct conversation".
    conv_ids = [c.id for c in conversations]
    members_by_conv: dict = {}
    if conv_ids:
        rows = db.query(conversation_members.c.conversation_id, conversation_members.c.user_id).filter(
            conversation_members.c.conversation_id.in_(conv_ids)
        ).all()
        other_user_ids = {uid for _, uid in rows if uid != user.id}
        users_by_id = {u.id: u for u in db.query(User).filter(User.id.in_(other_user_ids)).all()} if other_user_ids else {}
        for conv_id, uid in rows:
            if uid == user.id:
                continue
            members_by_conv.setdefault(conv_id, []).append({
                "user_id": uid,
                "full_name": users_by_id[uid].full_name if uid in users_by_id else None,
            })

    data = []
    for c in conversations:
        data.append({
            "id": c.id,
            "conversation_type": c.conversation_type,
            "title": c.title,
            "is_pinned": c.is_pinned,
            "is_archived": c.is_archived,
            "updated_at": c.updated_at,
            "other_participants": members_by_conv.get(c.id, []),
        })
    return {"success": True, "data": data}


@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    is_member = db.query(conversation_members).filter(
        conversation_members.c.conversation_id == conversation_id, conversation_members.c.user_id == user.id
    ).first()
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a participant in this conversation.")

    conv = db.query(Conversation).filter(Conversation.id == conversation_id, Conversation.deleted_at.is_(None)).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    member_ids = [
        row[0] for row in db.query(conversation_members.c.user_id)
        .filter(conversation_members.c.conversation_id == conversation_id, conversation_members.c.user_id != user.id)
        .all()
    ]
    other_users = db.query(User).filter(User.id.in_(member_ids)).all() if member_ids else []

    return {"success": True, "data": {
        "id": conv.id,
        "conversation_type": conv.conversation_type,
        "title": conv.title,
        "other_participants": [{"user_id": u.id, "full_name": u.full_name} for u in other_users],
    }}


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
