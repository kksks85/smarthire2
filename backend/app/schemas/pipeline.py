from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.core.enums import ApplicationStatus, StageOutcome, StageType


class ScreeningQuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    text: str
    category: Optional[str] = None
    order_index: int
    is_active: bool


class ScreeningQuestionCreate(BaseModel):
    text: str
    category: Optional[str] = None
    order_index: int = 0


class StageConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    stage_type: StageType
    order_index: int
    is_active: bool


class ApplicationCreate(BaseModel):
    candidate_id: int
    job_id: int
    assigned_recruiter_id: Optional[int] = None


class AssignRecruiter(BaseModel):
    assigned_recruiter_id: int


class ScreeningMatch(BaseModel):
    candidate_id: int
    full_name: str
    primary_trade: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    experience_years: Optional[int] = 0
    education_level: Optional[str] = None
    score: int
    reasons: list[str]


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    candidate_id: int
    job_id: int
    assigned_recruiter_id: Optional[int] = None
    status: ApplicationStatus
    current_stage_type: StageType
    contact_attempt_count: int = 0
    candidate_interest: Optional[bool] = None
    interest_recorded_at: Optional[datetime] = None
    blocked_for_position_at: Optional[datetime] = None
    qualified_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    release_reason: Optional[str] = None


class ContactAttemptCreate(BaseModel):
    outcome: str
    notes: Optional[str] = None


class ContactAttemptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    application_id: int
    recruiter_id: int
    outcome: str
    notes: Optional[str] = None
    attempted_at: datetime


class CandidateInterestRequest(BaseModel):
    interested: bool
    notes: Optional[str] = None


class ScreeningResponseInput(BaseModel):
    question_id: int
    answer: str


class ScreeningResponsesSave(BaseModel):
    responses: list[ScreeningResponseInput]


class ScreeningResponseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    application_id: int
    question_id: int
    answer: str
    answered_by_id: int
    answered_at: datetime


class EvaluationCreate(BaseModel):
    stage_type: StageType
    outcome: StageOutcome
    score: Optional[int] = None
    remarks: Optional[str] = None


class EvaluationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    application_id: int
    stage_type: StageType
    outcome: StageOutcome
    score: Optional[int] = None
    remarks: Optional[str] = None
    evaluated_by_id: Optional[int] = None
    evaluated_at: Optional[datetime] = None
