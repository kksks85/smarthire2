from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict

from app.core.enums import ApprovalDecision, JobStatus


class JobBase(BaseModel):
    # Job Details
    title: str
    category: str
    industry: Optional[str] = None
    description: Optional[str] = None
    employment_type: Optional[str] = None
    vacancies: int = 1
    
    # Work Location
    work_state: Optional[str] = None
    work_city: Optional[str] = None
    work_address: Optional[str] = None
    
    # Candidate Requirements
    min_qualification: Optional[str] = None
    min_experience_years: int = 0
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    gender_preference: Optional[str] = None
    required_certification: Optional[str] = None
    required_skills: Optional[dict[str, Any]] = None
    languages_required: Optional[dict[str, Any]] = None
    
    # Salary & Benefits
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    shift_type: Optional[str] = None
    weekly_off: Optional[str] = None
    benefits: Optional[dict[str, Any]] = None
    accommodation_provided: bool = False
    
    # Hiring Details
    joining_timeline: Optional[str] = None
    interview_mode: Optional[str] = None
    documents_required: Optional[dict[str, Any]] = None
    assigned_recruiter_id: Optional[int] = None
    hiring_priority: Optional[str] = None
    
    # Inherited from employer: mandatory candidate fields/documents
    required_candidate_fields: Optional[dict[str, Any]] = None


class JobCreate(JobBase):
    employer_id: int


class JobUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    employment_type: Optional[str] = None
    vacancies: Optional[int] = None
    
    work_state: Optional[str] = None
    work_city: Optional[str] = None
    work_address: Optional[str] = None
    
    min_qualification: Optional[str] = None
    min_experience_years: Optional[int] = None
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    gender_preference: Optional[str] = None
    required_certification: Optional[str] = None
    required_skills: Optional[dict[str, Any]] = None
    languages_required: Optional[dict[str, Any]] = None
    
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    shift_type: Optional[str] = None
    weekly_off: Optional[str] = None
    benefits: Optional[dict[str, Any]] = None
    accommodation_provided: Optional[bool] = None
    
    joining_timeline: Optional[str] = None
    interview_mode: Optional[str] = None
    documents_required: Optional[dict[str, Any]] = None
    assigned_recruiter_id: Optional[int] = None
    hiring_priority: Optional[str] = None


class JobStats(BaseModel):
    interested: int = 0
    contact_successful: int = 0
    blocked_for_position: int = 0


class JobOut(JobBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employer_id: int
    status: JobStatus
    public_slug: Optional[str] = None
    published_at: Optional[datetime] = None
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    stats: Optional[JobStats] = None


class ApprovalRequest(BaseModel):
    decision: ApprovalDecision
    comments: Optional[str] = None


class ApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    job_id: int
    approver_id: Optional[int] = None
    decision: ApprovalDecision
    comments: Optional[str] = None
    decided_at: Optional[datetime] = None


class PublishOut(BaseModel):
    id: int
    status: JobStatus
    public_slug: str
    public_url: str
    apply_url: str
    qr_data_uri: str
    share_facebook_url: str
    share_linkedin_url: str
