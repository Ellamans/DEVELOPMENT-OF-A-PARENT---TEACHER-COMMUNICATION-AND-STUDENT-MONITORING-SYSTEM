from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel

conversation_members = Table(
    "conversation_members",
    BaseModel.metadata,
    Column("conversation_id", UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)

meeting_participants = Table(
    "meeting_participants",
    BaseModel.metadata,
    Column("meeting_id", UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Conversation(BaseModel):
    __tablename__ = "conversations"

    conversation_type = Column(String(20), default="direct", nullable=False)  # direct, group, class, department, broadcast
    title = Column(String(255), nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)


class Message(BaseModel):
    __tablename__ = "messages"

    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    deleted_for_sender = Column(Boolean, default=False, nullable=False)


class MessageAttachment(BaseModel):
    __tablename__ = "message_attachments"

    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=True)


class Announcement(BaseModel):
    __tablename__ = "announcements"

    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    audience = Column(String(50), nullable=False)  # all, teachers, parents, students, class, department
    class_arm_id = Column(UUID(as_uuid=True), ForeignKey("class_arms.id"), nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    publish_at = Column(DateTime(timezone=True), nullable=True)
    published = Column(Boolean, default=False, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class Notification(BaseModel):
    __tablename__ = "notifications"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    notification_type = Column(String(20), nullable=False)  # info, success, warning, error, critical
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    source_module = Column(String(50), nullable=True)  # attendance, security, behaviour, results, assignments...
    is_read = Column(Boolean, default=False, nullable=False)


class Assignment(BaseModel):
    __tablename__ = "assignments"

    title = Column(String(255), nullable=False)
    instructions = Column(Text, nullable=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    class_arm_id = Column(UUID(as_uuid=True), ForeignKey("class_arms.id"), nullable=False)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)
    max_score = Column(String(10), default="100", nullable=False)
    submission_type = Column(String(30), default="file_upload", nullable=False)  # file_upload, text, in_person


class AssignmentAttachment(BaseModel):
    __tablename__ = "assignment_attachments"

    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)


class AssignmentSubmission(BaseModel):
    __tablename__ = "assignment_submissions"

    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    file_url = Column(String(500), nullable=True)
    text_content = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="missing", nullable=False)  # submitted, late, missing, reviewed
    score = Column(String(10), nullable=True)


class AssignmentFeedback(BaseModel):
    __tablename__ = "assignment_feedback"

    submission_id = Column(UUID(as_uuid=True), ForeignKey("assignment_submissions.id", ondelete="CASCADE"), nullable=False)
    feedback = Column(Text, nullable=False)
    given_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class Meeting(BaseModel):
    __tablename__ = "meetings"

    title = Column(String(255), nullable=False)
    meeting_type = Column(String(30), nullable=False)  # parent_teacher, disciplinary, academic_review, pta, emergency, staff
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    venue = Column(String(255), nullable=True)
    virtual_link = Column(String(500), nullable=True)
    agenda = Column(Text, nullable=True)
    status = Column(String(20), default="requested", nullable=False)  # requested, approved, rejected, rescheduled, completed
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class PTAMeeting(BaseModel):
    __tablename__ = "pta_meetings"

    title = Column(String(255), nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    venue = Column(String(255), nullable=True)
    agenda = Column(Text, nullable=True)


class PTAMinutes(BaseModel):
    __tablename__ = "pta_minutes"

    pta_meeting_id = Column(UUID(as_uuid=True), ForeignKey("pta_meetings.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    action_items = Column(Text, nullable=True)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class SharedDocument(BaseModel):
    __tablename__ = "shared_documents"

    title = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=True)
    audience = Column(String(50), default="all", nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
