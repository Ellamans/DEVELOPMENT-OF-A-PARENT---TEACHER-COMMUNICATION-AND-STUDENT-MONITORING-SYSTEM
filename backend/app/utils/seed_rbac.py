"""
Run once against a fresh database to seed default roles and permissions.

Usage:
    python -m app.utils.seed_rbac
"""
from app.database.session import SessionLocal
from app.models.user import Permission, Role

ROLES = [
    ("super_admin", "Super Admin", True),
    ("school_administrator", "School Administrator", True),
    ("principal", "Principal", True),
    ("vice_principal", "Vice Principal", True),
    ("teacher", "Teacher", True),
    ("class_teacher", "Class Teacher", True),
    ("security_officer", "Security Officer", True),
    ("parent", "Parent", True),
    ("student", "Student", True),
]

MODULES_ACTIONS = {
    "users": ["manage", "view"],
    "roles": ["manage"],
    "school_profile": ["manage"],
    "academic_sessions": ["manage"],
    "departments": ["create", "edit", "delete"],
    "classes": ["create", "edit", "delete"],
    "subjects": ["create", "edit", "delete"],
    "students": ["create", "edit", "delete", "view"],
    "parents": ["create", "edit", "delete", "view"],
    "teachers": ["create", "edit", "delete", "view"],
    "attendance": ["create", "edit", "approve", "view"],
    "results": ["create", "edit", "publish", "view"],
    "behaviour": ["create", "edit", "view"],
    "reports": ["export", "view"],
    "settings": ["update"],
}

# Default mapping of role -> permission codes. super_admin bypasses checks entirely in code.
ROLE_PERMISSION_MAP = {
    "school_administrator": [
        "users.manage", "users.view", "school_profile.manage", "academic_sessions.manage",
        "departments.create", "departments.edit", "departments.delete",
        "classes.create", "classes.edit", "classes.delete",
        "subjects.create", "subjects.edit", "subjects.delete",
        "students.create", "students.edit", "students.delete", "students.view",
        "parents.create", "parents.edit", "parents.delete", "parents.view",
        "teachers.create", "teachers.edit", "teachers.delete", "teachers.view",
        "reports.export", "reports.view", "settings.update",
    ],
    "principal": ["students.view", "teachers.view", "reports.view", "results.publish", "behaviour.view"],
    "vice_principal": ["students.view", "teachers.view", "results.publish", "attendance.approve"],
    "teacher": ["attendance.create", "attendance.edit", "results.create", "results.edit", "behaviour.create"],
    "class_teacher": [
        "attendance.create", "attendance.edit", "attendance.approve",
        "results.create", "results.edit", "behaviour.create", "behaviour.edit",
    ],
    "security_officer": [],  # security module permissions seeded in that module's migration
    "parent": [],
    "student": [],
}


def seed():
    db = SessionLocal()
    try:
        role_objs = {}
        for name, display_name, is_system in ROLES:
            role = db.query(Role).filter(Role.name == name).first()
            if not role:
                role = Role(name=name, display_name=display_name, is_system_role=is_system)
                db.add(role)
            role_objs[name] = role
        db.commit()

        perm_objs = {}
        for module, actions in MODULES_ACTIONS.items():
            for action in actions:
                code = f"{module}.{action}"
                perm = db.query(Permission).filter(Permission.code == code).first()
                if not perm:
                    perm = Permission(code=code, module=module, action=action)
                    db.add(perm)
                perm_objs[code] = perm
        db.commit()

        for role_name, perm_codes in ROLE_PERMISSION_MAP.items():
            role = role_objs[role_name]
            for code in perm_codes:
                perm = perm_objs.get(code)
                if perm and perm not in role.permissions:
                    role.permissions.append(perm)
        db.commit()
        print(f"Seeded {len(ROLES)} roles and {len(perm_objs)} permissions.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
