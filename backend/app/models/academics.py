from sqlalchemy import Column, String, Integer, Float, Boolean, Text, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class AssessmentConfiguration(BaseModel):
    __tablename__ = "assessment_configurations"

    academic_session_id = Column(UUID(as_uuid=True), ForeignKey("academic_sessions.id"), nullable=False)
    name = Column(String(100), nullable=False)  # e.g. "Model A"
    is_active = Column(Boolean, default=False, nullable=False)


class AssessmentComponent(BaseModel):
    __tablename__ = "assessment_components"

    configuration_id = Column(UUID(as_uuid=True), ForeignKey("assessment_configurations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)  # CA, Exam, Assignment, Test, Project, Practical
    max_score = Column(Float, nullable=False)
    component_type = Column(String(20), default="continuous_assessment", nullable=False)  # continuous_assessment, exam


class ContinuousAssessment(BaseModel):
    __tablename__ = "continuous_assessments"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    class_arm_id = Column(UUID(as_uuid=True), ForeignKey("class_arms.id"), nullable=False)
    academic_session_id = Column(UUID(as_uuid=True), ForeignKey("academic_sessions.id"), nullable=False)
    academic_term_id = Column(UUID(as_uuid=True), ForeignKey("academic_terms.id"), nullable=False)
    component_id = Column(UUID(as_uuid=True), ForeignKey("assessment_components.id"), nullable=False)
    score = Column(Float, nullable=False)
    remarks = Column(String(500), nullable=True)
    entered_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class ExamResult(BaseModel):
    __tablename__ = "exam_results"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    class_arm_id = Column(UUID(as_uuid=True), ForeignKey("class_arms.id"), nullable=False)
    academic_session_id = Column(UUID(as_uuid=True), ForeignKey("academic_sessions.id"), nullable=False)
    academic_term_id = Column(UUID(as_uuid=True), ForeignKey("academic_terms.id"), nullable=False)
    exam_score = Column(Float, nullable=True)
    status = Column(String(20), default="draft", nullable=False)  # draft, submitted, under_review, approved, published, rejected
    entered_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class SubjectResult(BaseModel):
    """Denormalized, computed final result per student/subject/term — feeds report cards."""
    __tablename__ = "subject_results"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    academic_session_id = Column(UUID(as_uuid=True), ForeignKey("academic_sessions.id"), nullable=False)
    academic_term_id = Column(UUID(as_uuid=True), ForeignKey("academic_terms.id"), nullable=False)
    ca_total = Column(Float, default=0, nullable=False)
    exam_score = Column(Float, default=0, nullable=False)
    overall_total = Column(Float, default=0, nullable=False)
    grade = Column(String(5), nullable=True)
    grade_point = Column(Float, nullable=True)
    subject_position = Column(Integer, nullable=True)
    teacher_remark = Column(Text, nullable=True)


class GradingSystem(BaseModel):
    __tablename__ = "grading_systems"

    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)


class GradeRange(BaseModel):
    __tablename__ = "grade_ranges"

    grading_system_id = Column(UUID(as_uuid=True), ForeignKey("grading_systems.id", ondelete="CASCADE"), nullable=False)
    grade = Column(String(5), nullable=False)  # A, B, C...
    min_score = Column(Float, nullable=False)
    max_score = Column(Float, nullable=False)
    remark = Column(String(100), nullable=True)  # Excellent, Good, Fail...
    grade_point = Column(Float, nullable=True)


class ReportCard(BaseModel):
    __tablename__ = "report_cards"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    academic_session_id = Column(UUID(as_uuid=True), ForeignKey("academic_sessions.id"), nullable=False)
    academic_term_id = Column(UUID(as_uuid=True), ForeignKey("academic_terms.id"), nullable=False)
    overall_average = Column(Float, nullable=True)
    overall_position = Column(Integer, nullable=True)
    promotion_status = Column(String(30), nullable=True)  # promoted, repeated, pending
    principal_remark = Column(Text, nullable=True)
    pdf_url = Column(String(500), nullable=True)
    published = Column(Boolean, default=False, nullable=False)


class BehaviourRecord(BaseModel):
    __tablename__ = "behaviour_records"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), nullable=False)  # excellent_conduct, bullying, fighting, late_coming, ...
    description = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False)  # low, medium, high
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    follow_up_action = Column(Text, nullable=True)
    parent_notified = Column(Boolean, default=False, nullable=False)
    status = Column(String(20), default="open", nullable=False)


class DisciplinaryAction(BaseModel):
    __tablename__ = "disciplinary_actions"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    behaviour_record_id = Column(UUID(as_uuid=True), ForeignKey("behaviour_records.id"), nullable=True)
    action_type = Column(String(50), nullable=False)  # warning, counselling, community_service, parent_meeting, suspension, expulsion
    reason = Column(Text, nullable=False)
    decision_date = Column(Date, nullable=False)
    responsible_officer = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    resolution_status = Column(String(20), default="pending", nullable=False)  # pending, resolved, appealed
    appeal_notes = Column(Text, nullable=True)
