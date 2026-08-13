import random
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import require_permission, require_role
from app.database.session import get_db
from app.models.security import (
    EmergencyAlert, PickupAuthorization, PickupLog, SecurityIncident, StudentCheckin,
    StudentCheckout, StudentMovement, VisitorLog,
)
from app.models.user import User
from app.schemas.auth import ApiResponse

router = APIRouter(tags=["Security & Visitor Management"])

SCHOOL_START_TIME = "08:00"  # used to determine on_time vs late arrivals


# ---------- Check-in / Check-out ----------

class CheckinIn(BaseModel):
    student_id: UUID
    entry_gate: Optional[str] = None
    method: str = "manual"


@router.post("/student-checkins", response_model=ApiResponse, status_code=201)
def check_in_student(
    payload: CheckinIn, request: Request, db: Session = Depends(get_db),
    user: User = Depends(require_role("security_officer", "school_administrator")),
):
    now = datetime.now(timezone.utc)
    arrival_status = "late" if now.strftime("%H:%M") > SCHOOL_START_TIME else "on_time"
    record = StudentCheckin(
        student_id=payload.student_id, arrival_time=now, entry_gate=payload.entry_gate,
        method=payload.method, arrival_status=arrival_status, recorded_by=user.id,
        ip_address=request.client.host if request.client else None,
    )
    db.add(record)
    db.commit()
    return ApiResponse(success=True, message=f"Student checked in ({arrival_status}).")


class CheckoutIn(BaseModel):
    student_id: UUID
    exit_gate: Optional[str] = None
    pickup_status: str


@router.post("/student-checkouts", response_model=ApiResponse, status_code=201)
def check_out_student(
    payload: CheckoutIn, db: Session = Depends(get_db),
    user: User = Depends(require_role("security_officer", "school_administrator")),
):
    valid = {"school_bus", "parent_pickup", "guardian_pickup", "self_departure", "other"}
    if payload.pickup_status not in valid:
        raise HTTPException(status_code=422, detail=f"pickup_status must be one of {valid}")
    record = StudentCheckout(
        student_id=payload.student_id, departure_time=datetime.now(timezone.utc),
        exit_gate=payload.exit_gate, authorized_by=user.id, pickup_status=payload.pickup_status,
    )
    db.add(record)
    db.commit()
    return ApiResponse(success=True, message="Student checked out.")


# ---------- Pickup Authorization & Verification ----------

class PickupAuthIn(BaseModel):
    student_id: UUID
    authorized_name: str
    relationship_type: str
    parent_id: Optional[UUID] = None


@router.post("/pickup-authorizations", response_model=ApiResponse, status_code=201)
def create_pickup_authorization(
    payload: PickupAuthIn, db: Session = Depends(get_db),
    _user: User = Depends(require_permission("students.edit")),
):
    db.add(PickupAuthorization(**payload.model_dump()))
    db.commit()
    return ApiResponse(success=True, message="Pickup authorization added.")


@router.post("/pickup-authorizations/{auth_id}/generate-pin", response_model=ApiResponse)
def generate_pickup_pin(
    auth_id: UUID, db: Session = Depends(get_db), _user: User = Depends(require_permission("students.edit")),
):
    auth = db.query(PickupAuthorization).filter(PickupAuthorization.id == auth_id, PickupAuthorization.is_active).first()
    if not auth:
        raise HTTPException(status_code=404, detail="Pickup authorization not found.")
    pin = f"{random.randint(0, 999999):06d}"
    auth.one_time_pin = pin
    auth.pin_expires_at = datetime.now(timezone.utc) + timedelta(hours=6)
    db.commit()
    return ApiResponse(success=True, message="One-time PIN generated.", data={"pin": pin})


class PickupVerifyIn(BaseModel):
    student_id: UUID
    pickup_person_name: str
    relationship_type: str
    verification_method: str  # authorized_list, otp_pin
    pin: Optional[str] = None


@router.post("/pickup-verification", response_model=ApiResponse)
def verify_pickup(
    payload: PickupVerifyIn, db: Session = Depends(get_db),
    user: User = Depends(require_role("security_officer", "school_administrator")),
):
    approved = False
    if payload.verification_method == "authorized_list":
        approved = db.query(PickupAuthorization).filter(
            PickupAuthorization.student_id == payload.student_id,
            PickupAuthorization.authorized_name.ilike(payload.pickup_person_name),
            PickupAuthorization.is_active.is_(True),
        ).first() is not None
    elif payload.verification_method == "otp_pin" and payload.pin:
        auth = db.query(PickupAuthorization).filter(
            PickupAuthorization.student_id == payload.student_id,
            PickupAuthorization.one_time_pin == payload.pin,
        ).first()
        approved = bool(auth and auth.pin_expires_at and auth.pin_expires_at > datetime.now(timezone.utc))

    log = PickupLog(
        student_id=payload.student_id, pickup_person_name=payload.pickup_person_name,
        relationship_type=payload.relationship_type, verification_method=payload.verification_method,
        verification_result="approved" if approved else "rejected", security_officer_id=user.id,
    )
    db.add(log)
    db.commit()

    if not approved:
        raise HTTPException(status_code=403, detail="Pickup could not be verified. This attempt has been logged.")
    return ApiResponse(success=True, message="Pickup verified and approved.")


# ---------- Visitor Management ----------

class VisitorIn(BaseModel):
    full_name: str
    phone_number: str
    email: Optional[str] = None
    organization: Optional[str] = None
    purpose_of_visit: str
    person_to_visit: Optional[str] = None
    department_id: Optional[UUID] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    vehicle_plate_number: Optional[str] = None


@router.get("/visitors")
def list_visitors(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db), _user: User = Depends(require_role("security_officer", "school_administrator")),
):
    q = db.query(VisitorLog).filter(VisitorLog.deleted_at.is_(None))
    if status_filter:
        q = q.filter(VisitorLog.status == status_filter)
    total = q.count()
    items = q.order_by(VisitorLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"success": True, "data": items, "pagination": {"page": page, "page_size": page_size, "total": total}}


@router.post("/visitors", response_model=ApiResponse, status_code=201)
def register_visitor(
    payload: VisitorIn, db: Session = Depends(get_db),
    user: User = Depends(require_role("security_officer", "school_administrator")),
):
    badge_number = f"VIS{random.randint(1000, 9999)}"
    visitor = VisitorLog(
        **payload.model_dump(), status="checked_in",
        check_in_time=datetime.now(timezone.utc), badge_number=badge_number, registered_by=user.id,
    )
    db.add(visitor)
    db.commit()
    db.refresh(visitor)
    return ApiResponse(success=True, message="Visitor registered.", data={"id": str(visitor.id), "badge_number": badge_number})


@router.patch("/visitors/{visitor_id}/checkout", response_model=ApiResponse)
def checkout_visitor(
    visitor_id: UUID, db: Session = Depends(get_db),
    _user: User = Depends(require_role("security_officer", "school_administrator")),
):
    visitor = db.query(VisitorLog).filter(VisitorLog.id == visitor_id).first()
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found.")
    visitor.status = "checked_out"
    visitor.check_out_time = datetime.now(timezone.utc)
    db.commit()
    return ApiResponse(success=True, message="Visitor checked out.")


# ---------- Security Incidents ----------

class IncidentIn(BaseModel):
    incident_type: str
    incident_date: str
    incident_time: Optional[str] = None
    location: Optional[str] = None
    description: str
    severity: str
    follow_up_required: bool = False


@router.get("/incidents")
def list_incidents(
    severity: Optional[str] = None, status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db), _user: User = Depends(require_permission("behaviour.view")),
):
    q = db.query(SecurityIncident).filter(SecurityIncident.deleted_at.is_(None))
    if severity:
        q = q.filter(SecurityIncident.severity == severity)
    if status_filter:
        q = q.filter(SecurityIncident.status == status_filter)
    return {"success": True, "data": q.order_by(SecurityIncident.created_at.desc()).all()}


@router.post("/incidents", response_model=ApiResponse, status_code=201)
def report_incident(
    payload: IncidentIn, db: Session = Depends(get_db),
    user: User = Depends(require_role("security_officer", "school_administrator", "principal")),
):
    valid_severity = {"low", "medium", "high", "critical"}
    if payload.severity not in valid_severity:
        raise HTTPException(status_code=422, detail=f"severity must be one of {valid_severity}")
    incident = SecurityIncident(**payload.model_dump(), reported_by=user.id, status="open")
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return ApiResponse(success=True, message="Incident reported.", data={"id": str(incident.id)})


# ---------- Student Movement ----------

class MovementIn(BaseModel):
    student_id: UUID
    reason: str
    destination: Optional[str] = None


@router.post("/student-movements", response_model=ApiResponse, status_code=201)
def log_movement(
    payload: MovementIn, db: Session = Depends(get_db), user: User = Depends(require_permission("attendance.create")),
):
    movement = StudentMovement(**payload.model_dump(), departure_time=datetime.now(timezone.utc), authorized_by=user.id)
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return ApiResponse(success=True, message="Movement logged.", data={"id": str(movement.id)})


@router.patch("/student-movements/{movement_id}/return", response_model=ApiResponse)
def log_return(
    movement_id: UUID, db: Session = Depends(get_db), _user: User = Depends(require_permission("attendance.create")),
):
    movement = db.query(StudentMovement).filter(StudentMovement.id == movement_id).first()
    if not movement:
        raise HTTPException(status_code=404, detail="Movement record not found.")
    movement.return_time = datetime.now(timezone.utc)
    db.commit()
    return ApiResponse(success=True, message="Return time recorded.")


# ---------- Emergency Alerts ----------

class AlertIn(BaseModel):
    alert_type: str
    title: str
    message: str
    recipients: str  # comma-separated: parents,teachers,staff


@router.post("/emergency-alerts", response_model=ApiResponse, status_code=201)
def send_emergency_alert(
    payload: AlertIn, db: Session = Depends(get_db),
    user: User = Depends(require_role("super_admin", "school_administrator", "principal")),
):
    alert = EmergencyAlert(**payload.model_dump(), sent_by=user.id, sent_at=datetime.now(timezone.utc))
    db.add(alert)
    db.commit()
    # In-app delivery only for now; architecture leaves room for SMS/email/push
    # via the notification_events table without any schema changes.
    return ApiResponse(success=True, message="Emergency alert sent.")


# ---------- Security Dashboard ----------

@router.get("/security-dashboard")
def security_dashboard(
    db: Session = Depends(get_db), _user: User = Depends(require_role("security_officer", "school_administrator")),
):
    today = datetime.now(timezone.utc).date()
    checkins_today = db.query(StudentCheckin).filter(StudentCheckin.arrival_time >= today).count()
    checkouts_today = db.query(StudentCheckout).filter(StudentCheckout.departure_time >= today).count()
    visitors_on_campus = db.query(VisitorLog).filter(VisitorLog.status == "checked_in").count()
    open_incidents = db.query(SecurityIncident).filter(SecurityIncident.status == "open").count()
    return {"success": True, "data": {
        "students_checked_in_today": checkins_today,
        "students_checked_out_today": checkouts_today,
        "visitors_on_campus": visitors_on_campus,
        "open_incidents": open_incidents,
    }}
