"""
Generates CSV/Excel export files for the reporting module.
Each report_type maps to a query builder that returns a list of dict rows;
the file is written locally (and to Cloudinary if configured) with a
consistent header/footer convention (school name, generated date, filters).
"""
import os
import tempfile
from datetime import datetime, timezone
from typing import Callable

import pandas as pd
from sqlalchemy.orm import Session

from app.models.people import Student, Teacher, Parent
from app.models.security import AttendanceRecord, SecurityIncident, VisitorLog


def _students_rows(db: Session, filters: dict) -> list[dict]:
    q = db.query(Student).filter(Student.deleted_at.is_(None))
    if filters.get("status"):
        q = q.filter(Student.status == filters["status"])
    if filters.get("class_id"):
        q = q.filter(Student.current_class_id == filters["class_id"])
    return [
        {
            "Admission No.": s.admission_number, "Name": s.full_name, "Gender": s.gender,
            "Status": s.status, "Admission Date": s.admission_date,
        }
        for s in q.all()
    ]


def _attendance_rows(db: Session, filters: dict) -> list[dict]:
    q = db.query(AttendanceRecord).filter(AttendanceRecord.deleted_at.is_(None))
    if filters.get("date_from"):
        q = q.filter(AttendanceRecord.date >= filters["date_from"])
    if filters.get("date_to"):
        q = q.filter(AttendanceRecord.date <= filters["date_to"])
    return [
        {"Date": r.date, "Student ID": str(r.student_id), "Status": r.status, "Remarks": r.remarks}
        for r in q.all()
    ]


def _security_incidents_rows(db: Session, filters: dict) -> list[dict]:
    q = db.query(SecurityIncident).filter(SecurityIncident.deleted_at.is_(None))
    return [
        {
            "Date": i.incident_date, "Type": i.incident_type, "Severity": i.severity,
            "Location": i.location, "Status": i.status,
        }
        for i in q.all()
    ]


def _visitors_rows(db: Session, filters: dict) -> list[dict]:
    q = db.query(VisitorLog).filter(VisitorLog.deleted_at.is_(None))
    return [
        {
            "Name": v.full_name, "Organization": v.organization, "Purpose": v.purpose_of_visit,
            "Check-in": v.check_in_time, "Check-out": v.check_out_time, "Status": v.status,
        }
        for v in q.all()
    ]


def _teachers_rows(db: Session, filters: dict) -> list[dict]:
    q = db.query(Teacher).filter(Teacher.deleted_at.is_(None))
    return [
        {"Employee ID": t.employee_id, "Qualification": t.qualification, "Status": t.employment_status}
        for t in q.all()
    ]


REPORT_BUILDERS: dict[str, Callable[[Session, dict], list[dict]]] = {
    "students": _students_rows,
    "attendance": _attendance_rows,
    "security": _security_incidents_rows,
    "visitors": _visitors_rows,
    "teachers": _teachers_rows,
}


def generate_export(
    db: Session, report_type: str, file_format: str, filters: dict, school_name: str = "School",
) -> str:
    """Builds the export file and returns the local path it was written to."""
    builder = REPORT_BUILDERS.get(report_type)
    if not builder:
        raise ValueError(f"No export builder registered for report_type '{report_type}'.")

    rows = builder(db, filters or {})
    df = pd.DataFrame(rows)

    suffix = ".csv" if file_format == "csv" else ".xlsx"
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    if file_format == "csv":
        with open(path, "w") as f:
            f.write(f"# {school_name} — {report_type.title()} Report\n")
            f.write(f"# Generated: {generated_at}\n")
        df.to_csv(path, mode="a", index=False)
    else:
        with pd.ExcelWriter(path, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name=report_type.title()[:31], startrow=2)
            worksheet = writer.sheets[report_type.title()[:31]]
            worksheet["A1"] = f"{school_name} — {report_type.title()} Report"
            worksheet["A2"] = f"Generated: {generated_at}"

    return path
