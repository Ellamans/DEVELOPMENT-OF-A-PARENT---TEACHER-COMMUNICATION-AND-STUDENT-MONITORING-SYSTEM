from sqlalchemy import Column, String, Date, DateTime, Text, ForeignKey, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class AttendanceRecord(BaseModel):
    __tablename__ = "attendance_records"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    academic_session_id = Column(UUID(as_uuid=True), ForeignKey("academic_sessions.id"), nullable=False)
    academic_term_id = Column(UUID(as_uuid=True), ForeignKey("academic_terms.id"), nullable=False)
    class_arm_id = Column(UUID(as_uuid=True), ForeignKey("class_arms.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    status = Column(String(20), nullable=False)  # present, absent, late, excused, sick, school_activity
    remarks = Column(String(500), nullable=True)
    marked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)


class StudentCheckin(BaseModel):
    __tablename__ = "student_checkins"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    arrival_time = Column(DateTime(timezone=True), nullable=False)
    entry_gate = Column(String(100), nullable=True)
    method = Column(String(20), default="manual", nullable=False)  # manual, qr_code, rfid
    arrival_status = Column(String(20), nullable=False)  # on_time, late
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    ip_address = Column(String(50), nullable=True)


class StudentCheckout(BaseModel):
    __tablename__ = "student_checkouts"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    departure_time = Column(DateTime(timezone=True), nullable=False)
    exit_gate = Column(String(100), nullable=True)
    authorized_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    pickup_status = Column(String(20), nullable=False)  # school_bus, parent_pickup, guardian_pickup, self_departure, other


class PickupAuthorization(BaseModel):
    __tablename__ = "pickup_authorizations"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("parents.id"), nullable=True)
    authorized_name = Column(String(255), nullable=False)
    relationship_type = Column(String(50), nullable=False)
    one_time_pin = Column(String(10), nullable=True)
    pin_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class PickupLog(BaseModel):
    __tablename__ = "pickup_logs"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    pickup_person_name = Column(String(255), nullable=False)
    relationship_type = Column(String(50), nullable=False)
    verification_method = Column(String(30), nullable=False)  # authorized_list, otp_pin, qr_code
    verification_result = Column(String(20), nullable=False)  # approved, rejected
    security_officer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class VisitorLog(BaseModel):
    __tablename__ = "visitor_logs"

    full_name = Column(String(255), nullable=False)
    phone_number = Column(String(20), nullable=False)
    email = Column(String(255), nullable=True)
    organization = Column(String(255), nullable=True)
    purpose_of_visit = Column(String(500), nullable=False)
    person_to_visit = Column(String(255), nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    id_type = Column(String(50), nullable=True)
    id_number = Column(String(100), nullable=True)
    photo_url = Column(String(500), nullable=True)
    vehicle_plate_number = Column(String(30), nullable=True)
    check_in_time = Column(DateTime(timezone=True), nullable=True)
    check_out_time = Column(DateTime(timezone=True), nullable=True)
    badge_number = Column(String(30), nullable=True)
    status = Column(String(20), default="expected", nullable=False)  # expected, checked_in, checked_out, cancelled
    registered_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class SecurityIncident(BaseModel):
    __tablename__ = "security_incidents"

    incident_type = Column(String(50), nullable=False)
    incident_date = Column(Date, nullable=False)
    incident_time = Column(String(10), nullable=True)
    location = Column(String(255), nullable=True)
    description = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False)  # low, medium, high, critical
    action_taken = Column(Text, nullable=True)
    follow_up_required = Column(Boolean, default=False, nullable=False)
    reported_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="open", nullable=False)  # open, under_review, resolved, closed


class IncidentAttachment(BaseModel):
    __tablename__ = "incident_attachments"

    incident_id = Column(UUID(as_uuid=True), ForeignKey("security_incidents.id", ondelete="CASCADE"), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)


class StudentMovement(BaseModel):
    __tablename__ = "student_movements"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    reason = Column(String(100), nullable=False)  # sick_bay, principals_office, library, laboratory, guidance_office, sports, other
    destination = Column(String(255), nullable=True)
    departure_time = Column(DateTime(timezone=True), nullable=False)
    return_time = Column(DateTime(timezone=True), nullable=True)
    authorized_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class EmergencyAlert(BaseModel):
    __tablename__ = "emergency_alerts"

    alert_type = Column(String(50), nullable=False)  # school_closure, medical_emergency, security_threat, weather_alert, fire_drill
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    recipients = Column(String(100), nullable=False)  # parents, teachers, staff, all (comma-separated)
    sent_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)


class NotificationEvent(BaseModel):
    __tablename__ = "notification_events"

    event_type = Column(String(50), nullable=False)  # absent, late, checkin, checkout, unauthorized_pickup, incident
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=True)
    payload = Column(Text, nullable=True)  # JSON-encoded event data
    processed = Column(Boolean, default=False, nullable=False)
