from sqlalchemy import Column, String, Boolean, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import ForeignKey

from app.models.base import BaseModel


class FeatureFlag(BaseModel):
    __tablename__ = "feature_flags"

    key = Column(String(100), unique=True, nullable=False)  # attendance, messaging, behaviour_monitoring, ...
    label = Column(String(150), nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)


class BrandingSettings(BaseModel):
    __tablename__ = "branding_settings"

    primary_colour = Column(String(10), default="#1E40AF", nullable=False)
    secondary_colour = Column(String(10), nullable=True)
    accent_colour = Column(String(10), nullable=True)
    favicon_url = Column(String(500), nullable=True)
    login_background_url = Column(String(500), nullable=True)
    welcome_message = Column(String(500), nullable=True)
    footer_text = Column(String(255), nullable=True)


class PasswordPolicy(BaseModel):
    __tablename__ = "password_policies"

    minimum_length = Column(Integer, default=8, nullable=False)
    require_uppercase = Column(Boolean, default=True, nullable=False)
    require_lowercase = Column(Boolean, default=True, nullable=False)
    require_numbers = Column(Boolean, default=True, nullable=False)
    require_special_chars = Column(Boolean, default=True, nullable=False)
    password_expiry_days = Column(Integer, nullable=True)
    max_failed_attempts = Column(Integer, default=5, nullable=False)
    account_lock_minutes = Column(Integer, default=15, nullable=False)
    session_timeout_minutes = Column(Integer, default=30, nullable=False)


class SecuritySettings(BaseModel):
    __tablename__ = "security_settings"

    rate_limit_per_minute = Column(Integer, default=60, nullable=False)
    cors_origins = Column(String(1000), nullable=True)
    jwt_expiry_minutes = Column(Integer, default=30, nullable=False)
    refresh_token_expiry_days = Column(Integer, default=7, nullable=False)


class NotificationSettings(BaseModel):
    __tablename__ = "notification_settings"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    frequency = Column(String(20), default="instant", nullable=False)  # instant, hourly_digest, daily_digest, disabled
    channels_enabled = Column(String(100), default="in_app", nullable=False)  # comma-separated


class StorageSettings(BaseModel):
    __tablename__ = "storage_settings"

    max_upload_size_mb = Column(Integer, default=5, nullable=False)
    allowed_file_types = Column(String(255), default="jpg,jpeg,png,pdf", nullable=False)
    max_image_resolution = Column(String(20), default="2000x2000", nullable=False)


class SMTPSettings(BaseModel):
    __tablename__ = "smtp_settings"

    host = Column(String(255), nullable=True)
    port = Column(Integer, default=587, nullable=False)
    username = Column(String(255), nullable=True)
    sender_name = Column(String(150), nullable=True)
    sender_email = Column(String(255), nullable=True)
    encryption = Column(String(10), default="tls", nullable=False)


class MaintenanceMode(BaseModel):
    __tablename__ = "maintenance_mode"

    is_enabled = Column(Boolean, default=False, nullable=False)
    custom_message = Column(String(500), nullable=True)
    scheduled_start = Column(String(50), nullable=True)
    scheduled_end = Column(String(50), nullable=True)


class BackupHistory(BaseModel):
    __tablename__ = "backup_history"

    backup_type = Column(String(30), nullable=False)  # database, configuration
    file_url = Column(String(500), nullable=True)
    status = Column(String(20), default="completed", nullable=False)
    triggered_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class SystemLog(BaseModel):
    __tablename__ = "system_logs"

    log_type = Column(String(30), nullable=False)  # application, authentication, error, security, api
    message = Column(Text, nullable=False)
    severity = Column(String(20), default="info", nullable=False)  # info, warning, error, critical
    module = Column(String(50), nullable=True)
