import uuid

from sqlalchemy import Column, String, Boolean, Date, DateTime, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

# --- Association tables ---

user_roles = Table(
    "user_roles",
    BaseModel.metadata,
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)

role_permissions = Table(
    "role_permissions",
    BaseModel.metadata,
    Column("role_id", UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)


class User(BaseModel):
    __tablename__ = "users"

    first_name = Column(String(100), nullable=False)
    middle_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone_number = Column(String(20), unique=True, nullable=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    gender = Column(String(20), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    address = Column(String(500), nullable=True)
    state = Column(String(100), nullable=True)
    local_government = Column(String(100), nullable=True)
    nationality = Column(String(100), nullable=True)
    profile_photo_url = Column(String(500), nullable=True)

    status = Column(String(20), nullable=False, default="active")  # active, suspended, inactive
    is_email_verified = Column(Boolean, default=False, nullable=False)

    failed_login_attempts = Column(String(10), default="0", nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)

    email_verification_token = Column(String(255), nullable=True)
    password_reset_token = Column(String(255), nullable=True)
    password_reset_expires = Column(DateTime(timezone=True), nullable=True)

    roles = relationship("Role", secondary=user_roles, back_populates="users")
    preferences = relationship("UserPreference", back_populates="user", uselist=False)

    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join(p for p in parts if p)


class Role(BaseModel):
    __tablename__ = "roles"

    name = Column(String(100), unique=True, nullable=False)  # e.g. super_admin, teacher
    display_name = Column(String(150), nullable=False)
    description = Column(String(500), nullable=True)
    is_system_role = Column(Boolean, default=False, nullable=False)  # protects seeded roles from deletion

    users = relationship("User", secondary=user_roles, back_populates="roles")
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")


class Permission(BaseModel):
    __tablename__ = "permissions"

    code = Column(String(150), unique=True, nullable=False)  # e.g. "attendance.create"
    module = Column(String(100), nullable=False)  # e.g. "attendance"
    action = Column(String(50), nullable=False)  # e.g. "create"
    description = Column(String(500), nullable=True)

    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")


class UserPreference(BaseModel):
    __tablename__ = "user_preferences"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    theme = Column(String(20), default="system", nullable=False)  # light, dark, system
    language = Column(String(10), default="en", nullable=False)
    time_zone = Column(String(50), default="Africa/Lagos", nullable=False)
    date_format = Column(String(20), default="DD/MM/YYYY", nullable=False)
    notification_preferences = Column(String(1000), nullable=True)  # JSON-encoded

    user = relationship("User", back_populates="preferences")
