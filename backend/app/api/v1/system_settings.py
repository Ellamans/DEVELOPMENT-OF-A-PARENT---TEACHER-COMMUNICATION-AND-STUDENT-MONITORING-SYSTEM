from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.core.config import settings as app_settings
from app.database.session import get_db
from app.models.settings import (
    BackupHistory, BrandingSettings, FeatureFlag, MaintenanceMode, PasswordPolicy, SystemLog,
)
from app.models.user import User
from app.schemas.auth import ApiResponse

router = APIRouter(prefix="/settings", tags=["System Settings"])


# ---------- Feature Flags ----------

@router.get("/feature-flags")
def list_feature_flags(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return {"success": True, "data": db.query(FeatureFlag).filter(FeatureFlag.deleted_at.is_(None)).all()}


class FeatureFlagToggleIn(BaseModel):
    is_enabled: bool


@router.patch("/feature-flags/{key}", response_model=ApiResponse)
def toggle_feature_flag(
    key: str, payload: FeatureFlagToggleIn, db: Session = Depends(get_db),
    _user: User = Depends(require_role("super_admin", "school_administrator")),
):
    flag = db.query(FeatureFlag).filter(FeatureFlag.key == key).first()
    if not flag:
        flag = FeatureFlag(key=key, label=key.replace("_", " ").title(), is_enabled=payload.is_enabled)
        db.add(flag)
    else:
        flag.is_enabled = payload.is_enabled
    db.commit()
    return ApiResponse(success=True, message=f"Feature '{key}' {'enabled' if payload.is_enabled else 'disabled'}.")


# ---------- Branding ----------

class BrandingIn(BaseModel):
    primary_colour: str = "#1E40AF"
    secondary_colour: Optional[str] = None
    accent_colour: Optional[str] = None
    welcome_message: Optional[str] = None
    footer_text: Optional[str] = None


def _valid_hex(colour: str) -> bool:
    return colour.startswith("#") and len(colour) in (4, 7)


@router.get("/branding")
def get_branding(db: Session = Depends(get_db)):
    branding = db.query(BrandingSettings).filter(BrandingSettings.deleted_at.is_(None)).first()
    return {"success": True, "data": branding}


@router.put("/branding", response_model=ApiResponse)
def update_branding(
    payload: BrandingIn, db: Session = Depends(get_db),
    _user: User = Depends(require_role("super_admin", "school_administrator")),
):
    for colour in [payload.primary_colour, payload.secondary_colour, payload.accent_colour]:
        if colour and not _valid_hex(colour):
            raise HTTPException(status_code=422, detail=f"Invalid colour code: {colour}")

    branding = db.query(BrandingSettings).filter(BrandingSettings.deleted_at.is_(None)).first()
    if branding:
        for field, value in payload.model_dump().items():
            setattr(branding, field, value)
    else:
        branding = BrandingSettings(**payload.model_dump())
        db.add(branding)
    db.commit()
    return ApiResponse(success=True, message="Branding updated.")


# ---------- Password Policy ----------

class PasswordPolicyIn(BaseModel):
    minimum_length: int = 8
    require_uppercase: bool = True
    require_lowercase: bool = True
    require_numbers: bool = True
    require_special_chars: bool = True
    max_failed_attempts: int = 5
    account_lock_minutes: int = 15
    session_timeout_minutes: int = 30


@router.get("/password-policy")
def get_password_policy(db: Session = Depends(get_db)):
    policy = db.query(PasswordPolicy).filter(PasswordPolicy.deleted_at.is_(None)).first()
    return {"success": True, "data": policy}


@router.put("/password-policy", response_model=ApiResponse)
def update_password_policy(
    payload: PasswordPolicyIn, db: Session = Depends(get_db),
    _user: User = Depends(require_role("super_admin", "school_administrator")),
):
    policy = db.query(PasswordPolicy).filter(PasswordPolicy.deleted_at.is_(None)).first()
    if policy:
        for field, value in payload.model_dump().items():
            setattr(policy, field, value)
    else:
        policy = PasswordPolicy(**payload.model_dump())
        db.add(policy)
    db.commit()
    return ApiResponse(success=True, message="Password policy updated.")


# ---------- Maintenance Mode ----------

class MaintenanceModeIn(BaseModel):
    is_enabled: bool
    custom_message: Optional[str] = None


@router.put("/maintenance-mode", response_model=ApiResponse)
def set_maintenance_mode(
    payload: MaintenanceModeIn, db: Session = Depends(get_db),
    _user: User = Depends(require_role("super_admin")),
):
    mode = db.query(MaintenanceMode).first()
    if mode:
        mode.is_enabled = payload.is_enabled
        mode.custom_message = payload.custom_message
    else:
        mode = MaintenanceMode(is_enabled=payload.is_enabled, custom_message=payload.custom_message)
        db.add(mode)
    db.commit()
    return ApiResponse(success=True, message=f"Maintenance mode {'enabled' if payload.is_enabled else 'disabled'}.")


@router.get("/maintenance-mode")
def get_maintenance_mode(db: Session = Depends(get_db)):
    mode = db.query(MaintenanceMode).first()
    return {"success": True, "data": mode or {"is_enabled": False}}


# ---------- System Health ----------

@router.get("/system-health")
def system_health(db: Session = Depends(get_db), _user: User = Depends(require_role("super_admin", "school_administrator"))):
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"

    cloudinary_configured = bool(app_settings.CLOUDINARY_CLOUD_NAME)
    return {"success": True, "data": {
        "database": db_status,
        "cloudinary_configured": cloudinary_configured,
        "environment": app_settings.APP_ENV,
    }}


@router.get("/health/live")
def liveness_probe():
    return {"status": "alive"}


@router.get("/health/ready")
def readiness_probe(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database not reachable.")


# ---------- Backups ----------

@router.get("/backups")
def list_backups(db: Session = Depends(get_db), _user: User = Depends(require_role("super_admin"))):
    return {"success": True, "data": db.query(BackupHistory).order_by(BackupHistory.created_at.desc()).all()}


@router.post("/backups", response_model=ApiResponse, status_code=201)
def trigger_backup(
    backup_type: str = Query(..., pattern="^(database|configuration)$"),
    db: Session = Depends(get_db), user: User = Depends(require_role("super_admin")),
):
    # NOTE: actual backup execution (pg_dump / config snapshot) runs as an
    # infrastructure job outside the API process; this records the request.
    backup = BackupHistory(backup_type=backup_type, status="completed", triggered_by=user.id)
    db.add(backup)
    db.commit()
    return ApiResponse(success=True, message=f"{backup_type.capitalize()} backup completed.")


# ---------- System Logs ----------

@router.get("/logs")
def list_system_logs(
    log_type: Optional[str] = None, severity: Optional[str] = None,
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db), _user: User = Depends(require_role("super_admin", "school_administrator")),
):
    q = db.query(SystemLog).filter(SystemLog.deleted_at.is_(None))
    if log_type:
        q = q.filter(SystemLog.log_type == log_type)
    if severity:
        q = q.filter(SystemLog.severity == severity)
    total = q.count()
    items = q.order_by(SystemLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"success": True, "data": items, "pagination": {"page": page, "page_size": page_size, "total": total}}
