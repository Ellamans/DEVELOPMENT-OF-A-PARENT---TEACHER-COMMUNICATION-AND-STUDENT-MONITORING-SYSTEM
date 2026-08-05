from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.school_setup import router as school_setup_router
from app.api.v1.users import router as users_router
from app.api.v1.students import router as students_router
from app.api.v1.parents import router as parents_router
from app.api.v1.teachers import router as teachers_router
from app.api.v1.attendance import router as attendance_router
from app.api.v1.security_ops import router as security_ops_router
from app.api.v1.academics import router as academics_router
from app.api.v1.behaviour import router as behaviour_router
from app.api.v1.messaging import router as messaging_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.assignments import router as assignments_router
from app.api.v1.meetings import router as meetings_router
from app.api.v1.dashboards import router as dashboards_router
from app.api.v1.audit import router as audit_router
from app.api.v1.system_settings import router as system_settings_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(school_setup_router)
api_router.include_router(students_router)
api_router.include_router(parents_router)
api_router.include_router(teachers_router)
api_router.include_router(attendance_router)
api_router.include_router(security_ops_router)
api_router.include_router(academics_router)
api_router.include_router(behaviour_router)
api_router.include_router(messaging_router)
api_router.include_router(notifications_router)
api_router.include_router(assignments_router)
api_router.include_router(meetings_router)
api_router.include_router(dashboards_router)
api_router.include_router(audit_router)
api_router.include_router(system_settings_router)
