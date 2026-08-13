from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    email: EmailStr
    phone_number: Optional[str] = None
    password: str
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    role: str  # role name to assign, validated server-side against allowed roles


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class VerifyEmailRequest(BaseModel):
    token: str


class UserOut(BaseModel):
    id: UUID
    first_name: str
    middle_name: Optional[str]
    last_name: str
    email: EmailStr
    phone_number: Optional[str]
    gender: Optional[str]
    date_of_birth: Optional[date]
    profile_photo_url: Optional[str]
    status: str
    is_email_verified: bool
    roles: list[str]
    last_login: Optional[datetime]
    created_at: datetime
    has_profile: Optional[bool] = None  # populated only where relevant (teacher/parent/student roles)

    model_config = {"from_attributes": True}


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
