from sqlalchemy import Column, String, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class AuditLog(BaseModel):
    __tablename__ = "audit_logs"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)  # login, logout, result_upload, role_change, etc.
    module = Column(String(50), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    device = Column(String(255), nullable=True)
    status = Column(String(20), default="success", nullable=False)  # success, failed


class ActivityLog(BaseModel):
    __tablename__ = "activity_logs"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    activity_type = Column(String(50), nullable=False)  # attendance_submitted, assignment_created, result_published...
    description = Column(String(500), nullable=False)


class SavedReport(BaseModel):
    __tablename__ = "saved_reports"

    name = Column(String(255), nullable=False)
    report_type = Column(String(50), nullable=False)  # attendance, academic, behaviour, security, ...
    filters = Column(Text, nullable=True)  # JSON-encoded
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class ReportExport(BaseModel):
    __tablename__ = "report_exports"

    saved_report_id = Column(UUID(as_uuid=True), ForeignKey("saved_reports.id"), nullable=True)
    report_type = Column(String(50), nullable=False)
    file_format = Column(String(10), nullable=False)  # pdf, excel, csv
    file_url = Column(String(500), nullable=True)
    exported_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class DashboardWidget(BaseModel):
    __tablename__ = "dashboard_widgets"

    widget_key = Column(String(100), unique=True, nullable=False)  # stat_card, line_chart, activity_feed...
    label = Column(String(150), nullable=False)
    applicable_roles = Column(String(255), nullable=False)  # comma-separated role names


class DashboardLayout(BaseModel):
    __tablename__ = "dashboard_layouts"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    layout_config = Column(Text, nullable=True)  # JSON-encoded widget positions
