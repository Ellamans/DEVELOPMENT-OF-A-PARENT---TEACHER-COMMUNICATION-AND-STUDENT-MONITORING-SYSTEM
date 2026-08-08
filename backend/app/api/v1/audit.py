import os
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import require_permission, require_role
from app.database.session import get_db
from app.models.analytics import ActivityLog, AuditLog, ReportExport, SavedReport
from app.models.people import Parent, Student, Teacher
from app.models.school import SchoolProfile
from app.models.user import User
from app.schemas.auth import ApiResponse
from app.services.export_service import generate_export

router = APIRouter(tags=["Audit, Reports & Search"])


# ---------- Audit Center ----------

@router.get("/audit-logs")
def list_audit_logs(
    user_id: Optional[UUID] = None, action: Optional[str] = None,
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db), _user: User = Depends(require_role("super_admin", "school_administrator")),
):
    q = db.query(AuditLog).filter(AuditLog.deleted_at.is_(None))
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if action:
        q = q.filter(AuditLog.action == action)
    total = q.count()
    items = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"success": True, "data": items, "pagination": {"page": page, "page_size": page_size, "total": total}}


def write_audit_log(db: Session, user_id: Optional[UUID], action: str, module: str, details: str = "", ip_address: str = "", status: str = "success"):
    """Internal helper — call this from any endpoint that needs to be audited."""
    db.add(AuditLog(user_id=user_id, action=action, module=module, details=details, ip_address=ip_address, status=status))


# ---------- Activity Timeline ----------

@router.get("/activity-timeline")
def activity_timeline(
    page: int = Query(1, ge=1), page_size: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db), _user: User = Depends(require_permission("reports.view")),
):
    q = db.query(ActivityLog).filter(ActivityLog.deleted_at.is_(None)).order_by(ActivityLog.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {"success": True, "data": items, "pagination": {"page": page, "page_size": page_size, "total": total}}


# ---------- Saved Reports & Exports ----------

class SavedReportIn(BaseModel):
    name: str
    report_type: str
    filters: Optional[str] = None  # JSON-encoded filter payload


@router.get("/reports/saved")
def list_saved_reports(db: Session = Depends(get_db), user: User = Depends(require_permission("reports.view"))):
    return {"success": True, "data": db.query(SavedReport).filter(SavedReport.created_by == user.id).all()}


@router.post("/reports/saved", response_model=ApiResponse, status_code=201)
def save_report(
    payload: SavedReportIn, db: Session = Depends(get_db), user: User = Depends(require_permission("reports.view")),
):
    report = SavedReport(**payload.model_dump(), created_by=user.id)
    db.add(report)
    db.commit()
    return ApiResponse(success=True, message="Report configuration saved.")


class ExportRequestIn(BaseModel):
    report_type: str
    file_format: str  # pdf, excel, csv
    saved_report_id: Optional[UUID] = None


@router.post("/reports/export", response_model=ApiResponse, status_code=201)
def request_export(
    payload: ExportRequestIn, db: Session = Depends(get_db), user: User = Depends(require_permission("reports.export")),
):
    if payload.file_format not in {"pdf", "excel", "csv"}:
        raise HTTPException(status_code=422, detail="file_format must be pdf, excel, or csv.")

    export = ReportExport(
        saved_report_id=payload.saved_report_id, report_type=payload.report_type,
        file_format=payload.file_format, exported_by=user.id,
    )

    if payload.file_format in {"csv", "excel"}:
        try:
            school = db.query(SchoolProfile).filter(SchoolProfile.deleted_at.is_(None)).first()
            local_path = generate_export(
                db, payload.report_type, payload.file_format, filters={},
                school_name=school.name if school else "School",
            )
            export.file_url = local_path
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
    else:
        # PDF exports for non-report-card report types are not yet implemented —
        # report card PDFs specifically are handled by /report-cards/{id}/publish.
        raise HTTPException(status_code=501, detail="PDF export for this report type is not yet implemented.")

    db.add(export)
    db.commit()
    db.refresh(export)
    return ApiResponse(success=True, message="Export generated.", data={"export_id": str(export.id), "file_path": export.file_url})


@router.get("/reports/export-history")
def export_history(db: Session = Depends(get_db), user: User = Depends(require_permission("reports.export"))):
    return {"success": True, "data": db.query(ReportExport).filter(ReportExport.exported_by == user.id).order_by(ReportExport.created_at.desc()).all()}


@router.get("/reports/export/{export_id}/download")
def download_export(
    export_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_permission("reports.export")),
):
    export = db.query(ReportExport).filter(ReportExport.id == export_id, ReportExport.exported_by == user.id).first()
    if not export or not export.file_url:
        raise HTTPException(status_code=404, detail="Export not found.")
    if not os.path.exists(export.file_url):
        raise HTTPException(
            status_code=410,
            detail="This export file is no longer available on the server (it may have been cleared on restart). Please generate a new export.",
        )
    filename = f"{export.report_type}.{'csv' if export.file_format == 'csv' else 'xlsx'}"
    return FileResponse(export.file_url, filename=filename)


# ---------- Global Search ----------

@router.get("/search")
def global_search(
    q: str = Query(..., min_length=2), db: Session = Depends(get_db), _user: User = Depends(require_permission("reports.view")),
):
    like = f"%{q}%"
    students = db.query(Student).filter(
        (Student.first_name.ilike(like)) | (Student.last_name.ilike(like)) | (Student.admission_number.ilike(like)),
        Student.deleted_at.is_(None),
    ).limit(10).all()
    parents = db.query(Parent).filter(
        (Parent.full_name.ilike(like)) | (Parent.email.ilike(like)), Parent.deleted_at.is_(None)
    ).limit(10).all()
    teachers = db.query(Teacher).filter(Teacher.employee_id.ilike(like), Teacher.deleted_at.is_(None)).limit(10).all()

    return {"success": True, "data": {
        "students": [{"id": s.id, "label": f"{s.full_name} ({s.admission_number})"} for s in students],
        "parents": [{"id": p.id, "label": p.full_name} for p in parents],
        "teachers": [{"id": t.id, "label": t.employee_id} for t in teachers],
    }}
