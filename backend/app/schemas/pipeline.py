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


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    candidate_id: int
    job_id: int
    assigned_recruiter_id: Optional[int] = None
    status: ApplicationStatus
    current_stage_type: StageType


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
