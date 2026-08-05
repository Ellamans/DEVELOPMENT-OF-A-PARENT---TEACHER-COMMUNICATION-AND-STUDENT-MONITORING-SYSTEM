from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import require_permission, require_role
from app.database.session import get_db
from app.models.academics import (
    AssessmentComponent, AssessmentConfiguration, ContinuousAssessment, ExamResult,
    GradeRange, GradingSystem, ReportCard, SubjectResult,
)
from app.models.people import Student
from app.models.school import AcademicSession, AcademicTerm, SchoolProfile, Subject
from app.models.user import User
from app.schemas.auth import ApiResponse
from app.services.report_card_service import generate_report_card_pdf, upload_report_card

router = APIRouter(tags=["Academic Results"])

APPROVAL_CHAIN = ["draft", "submitted", "under_review", "approved", "published"]


# ---------- Assessment Configuration ----------

class ComponentIn(BaseModel):
    name: str
    max_score: float
    component_type: str = "continuous_assessment"


class AssessmentConfigIn(BaseModel):
    academic_session_id: UUID
    name: str
    components: list[ComponentIn]


@router.post("/assessment-configurations", response_model=ApiResponse, status_code=201)
def create_assessment_config(
    payload: AssessmentConfigIn, db: Session = Depends(get_db),
    _user: User = Depends(require_role("super_admin", "school_administrator")),
):
    total = sum(c.max_score for c in payload.components)
    if total != 100:
        raise HTTPException(status_code=422, detail=f"Component max scores must total 100 (got {total}).")

    config = AssessmentConfiguration(academic_session_id=payload.academic_session_id, name=payload.name)
    db.add(config)
    db.flush()
    for c in payload.components:
        db.add(AssessmentComponent(configuration_id=config.id, **c.model_dump()))
    db.commit()
    return ApiResponse(success=True, message="Assessment configuration created.")


@router.patch("/assessment-configurations/{config_id}/activate", response_model=ApiResponse)
def activate_assessment_config(
    config_id: UUID, db: Session = Depends(get_db),
    _user: User = Depends(require_role("super_admin", "school_administrator")),
):
    target = db.query(AssessmentConfiguration).filter(AssessmentConfiguration.id == config_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Configuration not found.")
    db.query(AssessmentConfiguration).filter(
        AssessmentConfiguration.academic_session_id == target.academic_session_id
    ).update({AssessmentConfiguration.is_active: False})
    target.is_active = True
    db.commit()
    return ApiResponse(success=True, message="Assessment configuration activated.")


# ---------- Continuous Assessment Entry ----------

class CAEntryIn(BaseModel):
    student_id: UUID
    subject_id: UUID
    class_arm_id: UUID
    academic_session_id: UUID
    academic_term_id: UUID
    component_id: UUID
    score: float
    remarks: Optional[str] = None


@router.post("/continuous-assessments", response_model=ApiResponse, status_code=201)
def enter_ca_score(
    payload: CAEntryIn, db: Session = Depends(get_db), user: User = Depends(require_permission("results.create")),
):
    component = db.query(AssessmentComponent).filter(AssessmentComponent.id == payload.component_id).first()
    if not component:
        raise HTTPException(status_code=404, detail="Assessment component not found.")
    if payload.score > component.max_score:
        raise HTTPException(status_code=422, detail=f"Score cannot exceed {component.max_score} for {component.name}.")

    existing = db.query(ContinuousAssessment).filter(
        ContinuousAssessment.student_id == payload.student_id,
        ContinuousAssessment.subject_id == payload.subject_id,
        ContinuousAssessment.component_id == payload.component_id,
        ContinuousAssessment.academic_term_id == payload.academic_term_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="This component has already been scored for this student/subject/term.")

    db.add(ContinuousAssessment(**payload.model_dump(), entered_by=user.id))
    db.commit()
    return ApiResponse(success=True, message="CA score recorded.")


# ---------- Examination Management ----------

class ExamEntryIn(BaseModel):
    student_id: UUID
    subject_id: UUID
    class_arm_id: UUID
    academic_session_id: UUID
    academic_term_id: UUID
    exam_score: float


@router.post("/exam-results", response_model=ApiResponse, status_code=201)
def enter_exam_score(
    payload: ExamEntryIn, db: Session = Depends(get_db), user: User = Depends(require_permission("results.create")),
):
    existing = db.query(ExamResult).filter(
        ExamResult.student_id == payload.student_id, ExamResult.subject_id == payload.subject_id,
        ExamResult.academic_term_id == payload.academic_term_id,
    ).first()
    if existing:
        if existing.status in {"approved", "published"}:
            raise HTTPException(status_code=403, detail="Published results cannot be edited.")
        existing.exam_score = payload.exam_score
        db.commit()
        return ApiResponse(success=True, message="Exam score updated (draft).")

    result = ExamResult(**payload.model_dump(), status="draft", entered_by=user.id)
    db.add(result)
    db.commit()
    return ApiResponse(success=True, message="Exam score saved as draft.")


class ApprovalTransitionIn(BaseModel):
    new_status: str


@router.patch("/exam-results/{result_id}/transition", response_model=ApiResponse)
def transition_result_status(
    result_id: UUID, payload: ApprovalTransitionIn, db: Session = Depends(get_db),
    user: User = Depends(require_role("teacher", "class_teacher", "vice_principal", "principal", "school_administrator")),
):
    result = db.query(ExamResult).filter(ExamResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found.")
    if payload.new_status not in APPROVAL_CHAIN + ["rejected"]:
        raise HTTPException(status_code=422, detail=f"Invalid status. Must be one of {APPROVAL_CHAIN + ['rejected']}")

    current_idx = APPROVAL_CHAIN.index(result.status) if result.status in APPROVAL_CHAIN else -1
    new_idx = APPROVAL_CHAIN.index(payload.new_status) if payload.new_status in APPROVAL_CHAIN else -1
    if payload.new_status != "rejected" and new_idx != current_idx + 1:
        raise HTTPException(status_code=409, detail=f"Cannot move from '{result.status}' directly to '{payload.new_status}'.")

    result.status = payload.new_status
    db.commit()
    return ApiResponse(success=True, message=f"Result status updated to {payload.new_status}.")


# ---------- Grading Engine ----------

class GradeRangeIn(BaseModel):
    grade: str
    min_score: float
    max_score: float
    remark: Optional[str] = None
    grade_point: Optional[float] = None


class GradingSystemIn(BaseModel):
    name: str
    ranges: list[GradeRangeIn]


@router.post("/grading-systems", response_model=ApiResponse, status_code=201)
def create_grading_system(
    payload: GradingSystemIn, db: Session = Depends(get_db),
    _user: User = Depends(require_role("super_admin", "school_administrator")),
):
    system = GradingSystem(name=payload.name)
    db.add(system)
    db.flush()
    for r in payload.ranges:
        db.add(GradeRange(grading_system_id=system.id, **r.model_dump()))
    db.commit()
    return ApiResponse(success=True, message="Grading system created.")


def resolve_grade(db: Session, score: float) -> Optional[GradeRange]:
    active_system = db.query(GradingSystem).filter(GradingSystem.is_active.is_(True)).first()
    if not active_system:
        return None
    return db.query(GradeRange).filter(
        GradeRange.grading_system_id == active_system.id,
        GradeRange.min_score <= score, GradeRange.max_score >= score,
    ).first()


# ---------- Report Cards ----------

@router.get("/report-cards/{student_id}")
def get_report_card(
    student_id: UUID, academic_term_id: UUID, db: Session = Depends(get_db),
    _user: User = Depends(require_permission("reports.view")),
):
    card = db.query(ReportCard).filter(
        ReportCard.student_id == student_id, ReportCard.academic_term_id == academic_term_id
    ).first()
    if not card or not card.published:
        raise HTTPException(status_code=404, detail="Report card not yet published.")
    subjects = db.query(SubjectResult).filter(
        SubjectResult.student_id == student_id, SubjectResult.academic_term_id == academic_term_id
    ).all()
    return {"success": True, "data": {"report_card": card, "subjects": subjects}}


@router.patch("/report-cards/{card_id}/publish", response_model=ApiResponse)
def publish_report_card(
    card_id: UUID, db: Session = Depends(get_db),
    _user: User = Depends(require_role("principal", "school_administrator")),
):
    card = db.query(ReportCard).filter(ReportCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Report card not found.")

    student = db.query(Student).filter(Student.id == card.student_id).first()
    session = db.query(AcademicSession).filter(AcademicSession.id == card.academic_session_id).first()
    term = db.query(AcademicTerm).filter(AcademicTerm.id == card.academic_term_id).first()
    school = db.query(SchoolProfile).filter(SchoolProfile.deleted_at.is_(None)).first()
    subject_results = db.query(SubjectResult).filter(
        SubjectResult.student_id == card.student_id, SubjectResult.academic_term_id == card.academic_term_id
    ).all()

    subjects_payload = []
    for sr in subject_results:
        subject = db.query(Subject).filter(Subject.id == sr.subject_id).first()
        subjects_payload.append({
            "name": subject.name if subject else "Unknown Subject",
            "ca_total": sr.ca_total, "exam_score": sr.exam_score, "overall_total": sr.overall_total,
            "grade": sr.grade, "position": sr.subject_position,
        })

    local_path = generate_report_card_pdf(
        school_name=school.name if school else "School",
        school_motto=school.motto if school else None,
        student_name=student.full_name if student else "Unknown Student",
        admission_number=student.admission_number if student else "N/A",
        class_name=str(student.class_arm_id) if student and student.class_arm_id else "N/A",
        session_name=session.name if session else "N/A",
        term_name=term.name if term else "N/A",
        subjects=subjects_payload,
        overall_average=card.overall_average,
        overall_position=card.overall_position,
        promotion_status=card.promotion_status,
        principal_remark=card.principal_remark,
    )
    card.pdf_url = upload_report_card(local_path, public_id=f"report_card_{card.id}")
    card.published = True
    db.commit()
    return ApiResponse(success=True, message="Report card published — now visible to parents and students.", data={"pdf_url": card.pdf_url})
