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
from app.models.school import AcademicSession, AcademicTerm, SchoolClass, SchoolProfile, Subject
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


@router.get("/grading-systems")
def list_grading_systems(db: Session = Depends(get_db), _user: User = Depends(require_permission("reports.view"))):
    systems = db.query(GradingSystem).filter(GradingSystem.deleted_at.is_(None)).all()
    result = []
    for s in systems:
        ranges = db.query(GradeRange).filter(GradeRange.grading_system_id == s.id).order_by(GradeRange.min_score.desc()).all()
        result.append({"id": s.id, "name": s.name, "is_active": s.is_active, "ranges": ranges})
    return {"success": True, "data": result}


@router.get("/assessment-configurations")
def list_assessment_configurations(
    academic_session_id: Optional[UUID] = Query(None), db: Session = Depends(get_db),
    _user: User = Depends(require_permission("reports.view")),
):
    q = db.query(AssessmentConfiguration).filter(AssessmentConfiguration.deleted_at.is_(None))
    if academic_session_id:
        q = q.filter(AssessmentConfiguration.academic_session_id == academic_session_id)
    configs = q.all()
    result = []
    for c in configs:
        components = db.query(AssessmentComponent).filter(AssessmentComponent.configuration_id == c.id).all()
        result.append({"id": c.id, "academic_session_id": c.academic_session_id, "name": c.name, "is_active": c.is_active, "components": components})
    return {"success": True, "data": result}


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
    class_id: UUID
    academic_session_id: UUID
    academic_term_id: UUID
    component_id: UUID
    score: float
    remarks: Optional[str] = None


@router.get("/continuous-assessments")
def list_continuous_assessments(
    class_id: Optional[UUID] = None, subject_id: Optional[UUID] = None, academic_term_id: Optional[UUID] = None,
    student_id: Optional[UUID] = None,
    db: Session = Depends(get_db), _user: User = Depends(require_permission("results.create")),
):
    q = db.query(ContinuousAssessment).filter(ContinuousAssessment.deleted_at.is_(None))
    if class_id:
        q = q.filter(ContinuousAssessment.class_id == class_id)
    if subject_id:
        q = q.filter(ContinuousAssessment.subject_id == subject_id)
    if academic_term_id:
        q = q.filter(ContinuousAssessment.academic_term_id == academic_term_id)
    if student_id:
        q = q.filter(ContinuousAssessment.student_id == student_id)
    return {"success": True, "data": q.all()}


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
    class_id: UUID
    academic_session_id: UUID
    academic_term_id: UUID
    exam_score: float


@router.get("/exam-results")
def list_exam_results(
    class_id: Optional[UUID] = None, subject_id: Optional[UUID] = None, academic_term_id: Optional[UUID] = None,
    student_id: Optional[UUID] = None, status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db), _user: User = Depends(require_permission("results.create")),
):
    q = db.query(ExamResult).filter(ExamResult.deleted_at.is_(None))
    if class_id:
        q = q.filter(ExamResult.class_id == class_id)
    if subject_id:
        q = q.filter(ExamResult.subject_id == subject_id)
    if academic_term_id:
        q = q.filter(ExamResult.academic_term_id == academic_term_id)
    if student_id:
        q = q.filter(ExamResult.student_id == student_id)
    if status_filter:
        q = q.filter(ExamResult.status == status_filter)
    return {"success": True, "data": q.all()}


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


@router.patch("/grading-systems/{system_id}/activate", response_model=ApiResponse)
def activate_grading_system(
    system_id: UUID, db: Session = Depends(get_db),
    _user: User = Depends(require_role("super_admin", "school_administrator")),
):
    target = db.query(GradingSystem).filter(GradingSystem.id == system_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Grading system not found.")
    db.query(GradingSystem).update({GradingSystem.is_active: False})
    target.is_active = True
    db.commit()
    return ApiResponse(success=True, message=f"Grading system '{target.name}' is now active.")


def resolve_grade(db: Session, score: float) -> Optional[GradeRange]:
    active_system = db.query(GradingSystem).filter(GradingSystem.is_active.is_(True)).first()
    if not active_system:
        return None
    return db.query(GradeRange).filter(
        GradeRange.grading_system_id == active_system.id,
        GradeRange.min_score <= score, GradeRange.max_score >= score,
    ).first()


# ---------- Report Cards ----------

@router.get("/report-cards")
def list_report_cards_for_class(
    class_id: UUID, academic_term_id: UUID, db: Session = Depends(get_db),
    _user: User = Depends(require_permission("reports.view")),
):
    """List (computed and/or published) report cards for every student in a class, for a given term."""
    student_ids = [s.id for s in db.query(Student.id).filter(Student.current_class_id == class_id, Student.deleted_at.is_(None)).all()]
    cards = db.query(ReportCard).filter(
        ReportCard.student_id.in_(student_ids), ReportCard.academic_term_id == academic_term_id
    ).order_by(ReportCard.overall_position).all()

    students_by_id = {s.id: s for s in db.query(Student).filter(Student.id.in_(student_ids)).all()}
    result = []
    for c in cards:
        student = students_by_id.get(c.student_id)
        result.append({
            "id": c.id, "student_id": c.student_id,
            "student_name": student.full_name if student else "Unknown",
            "admission_number": student.admission_number if student else None,
            "overall_average": c.overall_average, "overall_position": c.overall_position,
            "promotion_status": c.promotion_status, "published": c.published, "pdf_url": c.pdf_url,
        })
    return {"success": True, "data": result}


class ComputeClassResultsIn(BaseModel):
    class_id: UUID
    academic_session_id: UUID
    academic_term_id: UUID


@router.post("/report-cards/compute-class", response_model=ApiResponse)
def compute_class_results(
    payload: ComputeClassResultsIn, db: Session = Depends(get_db),
    _user: User = Depends(require_role("teacher", "class_teacher", "vice_principal", "principal", "school_administrator")),
):
    """
    Aggregates every student's CA + exam scores into SubjectResult rows, ranks students within
    each subject and overall, then upserts a (draft, unpublished) ReportCard per student.
    Only exam results that are 'approved' or 'published' are counted — anything still in the
    draft/review chain is treated as not yet entered for computation purposes.
    """
    students = db.query(Student).filter(
        Student.current_class_id == payload.class_id, Student.deleted_at.is_(None)
    ).all()
    if not students:
        raise HTTPException(status_code=404, detail="No students found in this class.")
    student_ids = [s.id for s in students]

    ca_rows = db.query(ContinuousAssessment).filter(
        ContinuousAssessment.class_id == payload.class_id,
        ContinuousAssessment.academic_term_id == payload.academic_term_id,
    ).all()
    exam_rows = db.query(ExamResult).filter(
        ExamResult.class_id == payload.class_id,
        ExamResult.academic_term_id == payload.academic_term_id,
        ExamResult.status.in_(["approved", "published"]),
    ).all()

    subject_ids = {r.subject_id for r in ca_rows} | {r.subject_id for r in exam_rows}
    if not subject_ids:
        raise HTTPException(status_code=422, detail="No CA or approved exam scores found for this class/term yet.")

    # student_id -> subject_id -> total CA score
    ca_totals: dict = {}
    for r in ca_rows:
        ca_totals.setdefault(r.student_id, {}).setdefault(r.subject_id, 0.0)
        ca_totals[r.student_id][r.subject_id] += r.score

    # student_id -> subject_id -> exam score
    exam_totals: dict = {}
    for r in exam_rows:
        exam_totals.setdefault(r.student_id, {})[r.subject_id] = r.exam_score or 0.0

    # Build overall_total per student per subject, upsert SubjectResult, collect for ranking
    per_subject_totals: dict = {sid: [] for sid in subject_ids}  # subject_id -> [(student_id, overall_total)]
    for student in students:
        for subject_id in subject_ids:
            ca_total = ca_totals.get(student.id, {}).get(subject_id, 0.0)
            exam_score = exam_totals.get(student.id, {}).get(subject_id, 0.0)
            if ca_total == 0.0 and exam_score == 0.0:
                continue  # student not offering this subject / no scores yet
            overall_total = ca_total + exam_score
            grade_range = resolve_grade(db, overall_total)

            existing = db.query(SubjectResult).filter(
                SubjectResult.student_id == student.id, SubjectResult.subject_id == subject_id,
                SubjectResult.academic_term_id == payload.academic_term_id,
            ).first()
            if existing:
                existing.ca_total, existing.exam_score, existing.overall_total = ca_total, exam_score, overall_total
                existing.grade = grade_range.grade if grade_range else None
                existing.grade_point = grade_range.grade_point if grade_range else None
            else:
                db.add(SubjectResult(
                    student_id=student.id, subject_id=subject_id, academic_session_id=payload.academic_session_id,
                    academic_term_id=payload.academic_term_id, ca_total=ca_total, exam_score=exam_score,
                    overall_total=overall_total, grade=grade_range.grade if grade_range else None,
                    grade_point=grade_range.grade_point if grade_range else None,
                ))
            per_subject_totals[subject_id].append((student.id, overall_total))
    db.flush()

    # Rank subject_position within each subject (1 = highest total)
    for subject_id, entries in per_subject_totals.items():
        ranked = sorted(entries, key=lambda e: e[1], reverse=True)
        for position, (student_id, _) in enumerate(ranked, start=1):
            db.query(SubjectResult).filter(
                SubjectResult.student_id == student_id, SubjectResult.subject_id == subject_id,
                SubjectResult.academic_term_id == payload.academic_term_id,
            ).update({SubjectResult.subject_position: position})

    # Compute each student's overall average and upsert ReportCard, then rank overall_position
    averages = []
    for student in students:
        results = db.query(SubjectResult).filter(
            SubjectResult.student_id == student.id, SubjectResult.academic_term_id == payload.academic_term_id,
        ).all()
        if not results:
            continue
        avg = sum(r.overall_total for r in results) / len(results)

        card = db.query(ReportCard).filter(
            ReportCard.student_id == student.id, ReportCard.academic_term_id == payload.academic_term_id,
        ).first()
        if card:
            card.overall_average = avg
        else:
            card = ReportCard(
                student_id=student.id, academic_session_id=payload.academic_session_id,
                academic_term_id=payload.academic_term_id, overall_average=avg, published=False,
            )
            db.add(card)
        averages.append((student.id, avg))
    db.flush()

    ranked_students = sorted(averages, key=lambda e: e[1], reverse=True)
    for position, (student_id, _) in enumerate(ranked_students, start=1):
        db.query(ReportCard).filter(
            ReportCard.student_id == student_id, ReportCard.academic_term_id == payload.academic_term_id,
        ).update({ReportCard.overall_position: position})

    db.commit()
    return ApiResponse(success=True, message=f"Results computed for {len(ranked_students)} students across {len(subject_ids)} subjects.")


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
    student_class = (
        db.query(SchoolClass).filter(SchoolClass.id == student.current_class_id).first()
        if student and student.current_class_id else None
    )
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
        class_name=student_class.name if student_class else "N/A",
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
