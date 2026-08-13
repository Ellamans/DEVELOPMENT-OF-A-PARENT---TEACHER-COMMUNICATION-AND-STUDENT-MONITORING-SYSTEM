"""
Generates a professional report card PDF for a single student/term.
Called from the report-cards publish endpoint; output is uploaded to
Cloudinary when credentials are configured, otherwise saved locally
and the local path is returned (useful for local dev / testing).
"""
import os
import tempfile
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

from app.core.config import settings


def generate_report_card_pdf(
    *,
    school_name: str,
    school_motto: Optional[str],
    student_name: str,
    admission_number: str,
    class_name: str,
    session_name: str,
    term_name: str,
    subjects: list[dict],  # [{name, ca_total, exam_score, overall_total, grade, position}]
    overall_average: Optional[float],
    overall_position: Optional[int],
    promotion_status: Optional[str],
    principal_remark: Optional[str],
    output_path: Optional[str] = None,
) -> str:
    """Builds the PDF and returns the local file path it was written to."""
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".pdf")
        os.close(fd)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("SchoolTitle", parent=styles["Title"], fontSize=18, spaceAfter=2)
    subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"], alignment=1, textColor=colors.HexColor("#475569"))
    section_style = ParagraphStyle("Section", parent=styles["Heading2"], spaceBefore=10, spaceAfter=4)

    doc = SimpleDocTemplate(output_path, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    story = []

    story.append(Paragraph(school_name, title_style))
    if school_motto:
        story.append(Paragraph(school_motto, subtitle_style))
    story.append(Paragraph(f"Student Report Card — {term_name}, {session_name}", subtitle_style))
    story.append(Spacer(1, 12))

    info_table = Table([
        ["Student Name:", student_name, "Admission No.:", admission_number],
        ["Class:", class_name, "Session/Term:", f"{session_name} / {term_name}"],
    ], colWidths=[90, 160, 90, 160])
    info_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 10))

    story.append(Paragraph("Academic Performance", section_style))
    header = ["Subject", "CA Total", "Exam Score", "Overall", "Grade", "Position"]
    rows = [header]
    for s in subjects:
        rows.append([
            s.get("name", ""), str(s.get("ca_total", "")), str(s.get("exam_score", "")),
            str(s.get("overall_total", "")), s.get("grade", "") or "-", str(s.get("position", "") or "-"),
        ])
    result_table = Table(rows, colWidths=[150, 70, 70, 70, 50, 60])
    result_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E40AF")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
    ]))
    story.append(result_table)
    story.append(Spacer(1, 12))

    summary_lines = []
    if overall_average is not None:
        summary_lines.append(f"<b>Overall Average:</b> {overall_average:.1f}%")
    if overall_position is not None:
        summary_lines.append(f"<b>Overall Position:</b> {overall_position}")
    if promotion_status:
        summary_lines.append(f"<b>Promotion Status:</b> {promotion_status.title()}")
    if summary_lines:
        story.append(Paragraph(" &nbsp;&nbsp;|&nbsp;&nbsp; ".join(summary_lines), styles["Normal"]))
        story.append(Spacer(1, 10))

    if principal_remark:
        story.append(Paragraph("Principal's Remark", section_style))
        story.append(Paragraph(principal_remark, styles["Normal"]))
        story.append(Spacer(1, 20))

    story.append(Paragraph("_______________________", styles["Normal"]))
    story.append(Paragraph("Principal's Signature", styles["Normal"]))

    doc.build(story)
    return output_path


def upload_report_card(local_path: str, public_id: str) -> str:
    """Uploads the generated PDF to Cloudinary if configured; else returns the local path."""
    if not settings.CLOUDINARY_CLOUD_NAME:
        return local_path
    import cloudinary
    import cloudinary.uploader

    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )
    result = cloudinary.uploader.upload(local_path, folder="report_cards", public_id=public_id, resource_type="raw")
    return result["secure_url"]
