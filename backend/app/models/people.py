from sqlalchemy import Column, String, Date, Text, ForeignKey, Table, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

student_parents = Table(
    "student_parents",
    BaseModel.metadata,
    Column("student_id", UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), primary_key=True),
    Column("parent_id", UUID(as_uuid=True), ForeignKey("parents.id", ondelete="CASCADE"), primary_key=True),
    Column("relationship_type", String(20), nullable=False),  # father, mother, guardian
)

teacher_subjects = Table(
    "teacher_subjects",
    BaseModel.metadata,
    Column("teacher_id", UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"), primary_key=True),
    Column("subject_id", UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), primary_key=True),
)

teacher_classes = Table(
    "teacher_classes",
    BaseModel.metadata,
    Column("teacher_id", UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"), primary_key=True),
    Column("class_arm_id", UUID(as_uuid=True), ForeignKey("class_arms.id", ondelete="CASCADE"), primary_key=True),
)


class Student(BaseModel):
    __tablename__ = "students"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # optional login account
    admission_number = Column(String(30), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    middle_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=False)
    gender = Column(String(20), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    state_of_origin = Column(String(100), nullable=True)
    local_government = Column(String(100), nullable=True)
    nationality = Column(String(100), default="Nigerian", nullable=True)
    religion = Column(String(50), nullable=True)
    blood_group = Column(String(10), nullable=True)
    genotype = Column(String(10), nullable=True)
    passport_photo_url = Column(String(500), nullable=True)
    home_address = Column(String(500), nullable=True)

    academic_session_id = Column(UUID(as_uuid=True), ForeignKey("academic_sessions.id"), nullable=True)
    current_class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=True)
    class_arm_id = Column(UUID(as_uuid=True), ForeignKey("class_arms.id"), nullable=True)
    status = Column(String(20), default="active", nullable=False)  # active, graduated, transferred, suspended, expelled, withdrawn
    admission_date = Column(Date, nullable=True)

    allergies = Column(Text, nullable=True)
    medical_conditions = Column(Text, nullable=True)
    emergency_notes = Column(Text, nullable=True)

    parents = relationship("Parent", secondary=student_parents, back_populates="students")
    documents = relationship("StudentDocument", back_populates="student", cascade="all, delete-orphan")
    emergency_contacts = relationship("EmergencyContact", back_populates="student", cascade="all, delete-orphan")

    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join(p for p in parts if p)


class Parent(BaseModel):
    __tablename__ = "parents"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True, index=True)
    phone_number = Column(String(20), nullable=True, index=True)
    occupation = Column(String(150), nullable=True)
    residential_address = Column(String(500), nullable=True)
    passport_photo_url = Column(String(500), nullable=True)
    preferred_contact_method = Column(String(20), default="phone", nullable=False)  # phone, email, sms

    students = relationship("Student", secondary=student_parents, back_populates="parents")


class Teacher(BaseModel):
    __tablename__ = "teachers"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    employee_id = Column(String(30), unique=True, nullable=False, index=True)
    qualification = Column(String(255), nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    employment_date = Column(Date, nullable=True)
    employment_status = Column(String(20), default="active", nullable=False)

    subjects = relationship("Subject", secondary=teacher_subjects)
    classes = relationship("ClassArm", secondary=teacher_classes)


class SecurityOfficer(BaseModel):
    __tablename__ = "security_officers"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    staff_id = Column(String(30), unique=True, nullable=False, index=True)
    employment_date = Column(Date, nullable=True)
    shift = Column(String(20), nullable=True)  # morning, afternoon, night


class Staff(BaseModel):
    __tablename__ = "staff"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    staff_id = Column(String(30), unique=True, nullable=False, index=True)
    designation = Column(String(100), nullable=False)  # secretary, bursar, librarian, ict_officer, guidance_counsellor
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    employment_date = Column(Date, nullable=True)


class StudentDocument(BaseModel):
    __tablename__ = "student_documents"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    document_type = Column(String(50), nullable=False)  # birth_certificate, admission_letter, medical_report, transfer_letter, passport, parent_id
    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)

    student = relationship("Student", back_populates="documents")


class EmergencyContact(BaseModel):
    __tablename__ = "emergency_contacts"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    contact_person = Column(String(255), nullable=False)
    relationship_type = Column(String(50), nullable=False)
    phone_number = Column(String(20), nullable=False)

    student = relationship("Student", back_populates="emergency_contacts")


class BulkImportLog(BaseModel):
    __tablename__ = "bulk_import_logs"

    entity_type = Column(String(30), nullable=False)  # students, parents, teachers
    file_name = Column(String(255), nullable=False)
    total_rows = Column(Integer, default=0, nullable=False)
    successful_rows = Column(Integer, default=0, nullable=False)
    failed_rows = Column(Integer, default=0, nullable=False)
    error_report = Column(Text, nullable=True)
    imported_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
