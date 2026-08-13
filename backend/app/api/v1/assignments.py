from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_permission
from app.database.session import get_db
from app.models.communication import Assignment, AssignmentFeedback, AssignmentSubmission
from app.models.user import User
from app.schemas.auth import ApiResponse

router = APIRouter(prefix="/assignments", tags=["Assignments"])


class AssignmentIn(BaseModel):
    title: str
    instructions: Optional[str] = None
    subject_id: UUID
    class_id: UUID
    teacher_id: UUID
    due_date: datetime
    max_score: str = "100"
    submission_type: str = "file_upload"


@router.get("")
def list_assignments(
    class_id: Optional[UUID] = None, subject_id: Optional[UUID] = None,
    db: Session = Depends(get_db), _user: User = Depends(get_current_user),
):
    q = db.query(Assignment).filter(Assignment.deleted_at.is_(None))
    if class_id:
        q = q.filter(Assignment.class_id == class_id)
    if subject_id:
        q = q.filter(Assignment.subject_id == subject_id)
    return {"success": True, "data": q.order_by(Assignment.due_date).all()}


@router.post("", response_model=ApiResponse, status_code=201)
def create_assignment(
    payload: AssignmentIn, db: Session = Depends(get_db),
    _user: User = Depends(require_permission("results.create")),  # teacher-level permission reused
):
    if payload.due_date <= datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="Due date must be in the future.")
    assignment = Assignment(**payload.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return ApiResponse(success=True, message="Assignment created.", data={"id": str(assignment.id)})


@router.patch("/{assignment_id}", response_model=ApiResponse)
def update_assignment(
    assignment_id: UUID, payload: AssignmentIn, db: Session = Depends(get_db),
    _user: User = Depends(require_permission("results.create")),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id, Assignment.deleted_at.is_(None)).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(assignment, field, value)
    db.commit()
    return ApiResponse(success=True, message="Assignment updated.")


@router.delete("/{assignment_id}", response_model=ApiResponse)
def delete_assignment(
    assignment_id: UUID, db: Session = Depends(get_db), _user: User = Depends(require_permission("results.create")),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id, Assignment.deleted_at.is_(None)).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    assignment.soft_delete()
    db.commit()
    return ApiResponse(success=True, message="Assignment deleted.")


# ---------- Submission ----------

class SubmissionIn(BaseModel):
    student_id: UUID
    file_url: Optional[str] = None
    text_content: Optional[str] = None


@router.post("/{assignment_id}/submissions", response_model=ApiResponse, status_code=201)
def submit_assignment(
    assignment_id: UUID, payload: SubmissionIn, db: Session = Depends(get_db), _user: User = Depends(get_current_user),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id, Assignment.deleted_at.is_(None)).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    now = datetime.now(timezone.utc)
    is_late = now > assignment.due_date

    existing = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.assignment_id == assignment_id, AssignmentSubmission.student_id == payload.student_id
    ).first()
    if existing:
        existing.file_url = payload.file_url
        existing.text_content = payload.text_content
        existing.submitted_at = now
        existing.status = "late" if is_late else "submitted"
        db.commit()
        return ApiResponse(success=True, message="Submission replaced.")

    submission = AssignmentSubmission(
        assignment_id=assignment_id, student_id=payload.student_id, file_url=payload.file_url,
        text_content=payload.text_content, submitted_at=now, status="late" if is_late else "submitted",
    )
    db.add(submission)
    db.commit()
    return ApiResponse(success=True, message="Assignment submitted.")


class ReviewSubmissionIn(BaseModel):
    score: str
    feedback: Optional[str] = None


@router.patch("/submissions/{submission_id}/review", response_model=ApiResponse)
def review_submission(
    submission_id: UUID, payload: ReviewSubmissionIn, db: Session = Depends(get_db),
    user: User = Depends(require_permission("results.create")),
):
    submission = db.query(AssignmentSubmission).filter(AssignmentSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")
    submission.score = payload.score
    submission.status = "reviewed"
    if payload.feedback:
        db.add(AssignmentFeedback(submission_id=submission_id, feedback=payload.feedback, given_by=user.id))
    db.commit()
    return ApiResponse(success=True, message="Submission reviewed.")


@router.get("/{assignment_id}/submissions")
def list_submissions(
    assignment_id: UUID, db: Session = Depends(get_db), _user: User = Depends(require_permission("results.create")),
):
    items = db.query(AssignmentSubmission).filter(AssignmentSubmission.assignment_id == assignment_id).all()
    return {"success": True, "data": items}
