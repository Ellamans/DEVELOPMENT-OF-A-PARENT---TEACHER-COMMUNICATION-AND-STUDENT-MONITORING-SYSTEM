from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.database.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise credentials_error

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_error

    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise credentials_error
    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")
    return user


def require_permission(permission_code: str):
    """Dependency factory: enforces the current user holds a specific RBAC permission."""

    def checker(user: User = Depends(get_current_user)) -> User:
        user_permission_codes = {
            perm.code for role in user.roles for perm in role.permissions
        }
        # Super Admin bypasses granular checks
        role_names = {role.name for role in user.roles}
        if "super_admin" in role_names:
            return user
        if permission_code not in user_permission_codes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission_code}",
            )
        return user

    return checker


def require_role(*allowed_roles: str):
    """Dependency factory: enforces the current user has one of the given roles."""

    def checker(user: User = Depends(get_current_user)) -> User:
        role_names = {role.name for role in user.roles}
        if not role_names.intersection(allowed_roles) and "super_admin" not in role_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {', '.join(allowed_roles)}",
            )
        return user

    return checker
