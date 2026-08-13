from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class SchoolProfile(BaseModel):
    __tablename__ = "school_profiles"

    name = Column(String(255), nullable=False)
    motto = Column(String(255), nullable=True)
    logo_url = Column(String(500), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    website = Column(String(255), nullable=True)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), default="Nigeria", nullable=False)
    postal_code = Column(String(20), nullable=True)
    school_type = Column(String(20), nullable=True)  # public, private
    school_level = Column(String(30), nullable=True)  # junior, senior, combined
    principal_name = Column(String(255), nullable=True)
    established_year = Column(Integer, nullable=True)


class AcademicSession(BaseModel):
    __tablename__ = "academic_sessions"

    name = Column(String(20), unique=True, nullable=False)  # e.g. "2026/2027"
    is_active = Column(Boolean, default=False, nullable=False)

    terms = relationship("AcademicTerm", back_populates="session", cascade="all, delete-orphan")


class AcademicTerm(BaseModel):
    __tablename__ = "academic_terms"

    session_id = Column(UUID(as_uuid=True), ForeignKey("academic_sessions.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(20), nullable=False)  # first, second, third
    is_active = Column(Boolean, default=False, nullable=False)
    start_date = Column(String(20), nullable=True)
    end_date = Column(String(20), nullable=True)

    session = relationship("AcademicSession", back_populates="terms")


class Department(BaseModel):
    __tablename__ = "departments"

    name = Column(String(150), unique=True, nullable=False)
    description = Column(Text, nullable=True)


class SchoolClass(BaseModel):
    __tablename__ = "classes"

    name = Column(String(50), nullable=False)  # e.g. JSS 1, JSS 2, SS 3
    level = Column(String(20), nullable=False)  # junior, senior
    class_teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    capacity = Column(Integer, default=40, nullable=False)
    status = Column(String(20), default="active", nullable=False)


class Subject(BaseModel):
    __tablename__ = "subjects"

    name = Column(String(150), unique=True, nullable=False)
    code = Column(String(20), nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
