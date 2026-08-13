from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class StudentIn(BaseModel):
    admission_number: Optional[str] = None  # auto-generated if not supplied
    user_id: Optional[UUID] = None  # optional: link to an existing self-registered login account
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    state_of_origin: Optional[str] = None
    local_government: Optional[str] = None
    nationality: Optional[str] = "Nigerian"
    religion: Optional[str] = None
    blood_group: Optional[str] = None
    genotype: Optional[str] = None
    home_address: Optional[str] = None
    academic_session_id: Optional[UUID] = None
    current_class_id: Optional[UUID] = None
    admission_date: Optional[date] = None
    allergies: Optional[str] = None
    medical_conditions: Optional[str] = None
    emergency_notes: Optional[str] = None


class StudentStatusUpdate(BaseModel):
    status: str  # active, graduated, transferred, suspended, expelled, withdrawn


class ParentLinkIn(BaseModel):
    parent_id: UUID
    relationship_type: str  # father, mother, guardian


class ParentIn(BaseModel):
    user_id: Optional[UUID] = None  # optional: link to an existing self-registered login account
    full_name: str
    email: Optional[str] = None
    phone_number: Optional[str] = None
    occupation: Optional[str] = None
    residential_address: Optional[str] = None
    preferred_contact_method: str = "phone"
