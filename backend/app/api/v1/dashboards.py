from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.communication import Assignment, Meeting, Notification
from app.models.people import Parent, Student, Teacher, student_parents
from app.models.security import SecurityIncident, VisitorLog
from app.models.academics import BehaviourRecord
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["Dashboards"])


@router.get("")
def get_dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Returns role-appropriate widgets. Each role only sees data it's authorized for."""
    role_names = {r.name for r in user.roles}

    if "super_admin" in role_names or "school_administrator" in role_names:
        data = {
            "students": db.query(Student).filter(Student.deleted_at.is_(None)).count(),
            "teachers": db.query(Teacher).filter(Teacher.deleted_at.is_(None)).count(),
            "parents": db.query(Parent).filter(Parent.deleted_at.is_(None)).count(),
            "visitors_today": db.query(VisitorLog).filter(
                VisitorLog.check_in_time >= datetime.now(timezone.utc).date()
            ).count(),
            "open_incidents": db.query(SecurityIncident).filter(SecurityIncident.status == "open").count(),
            "pending_meetings": db.query(Meeting).filter(Meeting.status == "requested").count(),
        }
        return {"success": True, "role": "administrator", "data": data}

    if "teacher" in role_names or "class_teacher" in role_names:
        teacher = db.query(Teacher).filter(Teacher.user_id == user.id).first()
        data = {
            "assigned_classes": len(teacher.classes) if teacher else 0,
            "assigned_subjects": len(teacher.subjects) if teacher else 0,
            "unread_notifications": db.query(Notification).filter(
                Notification.user_id == user.id, Notification.is_read.is_(False)
            ).count(),
        }
        return {"success": True, "role": "teacher", "data": data}

    if "security_officer" in role_names:
        data = {
            "visitors_on_campus": db.query(VisitorLog).filter(VisitorLog.status == "checked_in").count(),
            "open_incidents": db.query(SecurityIncident).filter(SecurityIncident.status == "open").count(),
        }
        return {"success": True, "role": "security_officer", "data": data}

    if "parent" in role_names:
        parent = db.query(Parent).filter(Parent.user_id == user.id).first()
        children = parent.students if parent else []
        data = {
            "children": [{"id": c.id, "name": c.full_name} for c in children],
            "unread_notifications": db.query(Notification).filter(
                Notification.user_id == user.id, Notification.is_read.is_(False)
            ).count(),
        }
        return {"success": True, "role": "parent", "data": data}

    # student / default
    data = {
        "unread_notifications": db.query(Notification).filter(
            Notification.user_id == user.id, Notification.is_read.is_(False)
        ).count(),
    }
    return {"success": True, "role": "student", "data": data}


@router.get("/analytics/behaviour-trends")
def behaviour_trends(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    categories = db.query(BehaviourRecord.category, BehaviourRecord.id).filter(
        BehaviourRecord.deleted_at.is_(None)
    ).all()
    counts: dict[str, int] = {}
    for category, _id in categories:
        counts[category] = counts.get(category, 0) + 1
    return {"success": True, "data": counts}
