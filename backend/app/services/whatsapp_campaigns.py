from __future__ import annotations

from app.core.enums import CandidatePoolStatus, CandidateStatus
from app.models.candidate import Candidate
from app.models.job import JobPosting


def _values(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item).lower() for item in value]
    if isinstance(value, dict):
        for key in ("items", "skills", "values", "required"):
            nested = value.get(key)
            if isinstance(nested, list):
                return [str(item).lower() for item in nested]
    return []


def match_score(job: JobPosting, candidate: Candidate) -> int:
    score = 0
    trade = (candidate.primary_trade or "").lower()
    job_terms = f"{job.title} {job.category}".lower()
    if trade and (trade in job_terms or any(word in trade for word in job_terms.split())):
        score += 35
    if job.work_state and candidate.state and candidate.state.lower() == job.work_state.lower():
        score += 15
    if job.work_city and candidate.city and candidate.city.lower() == job.work_city.lower():
        score += 15
    if (candidate.experience_years or 0) >= job.min_experience_years:
        score += 15
    if job.min_qualification and candidate.education_level:
        score += 5
    skills = _values((candidate.profile_data or {}).get("skills"))
    score += min(15, len([skill for skill in _values(job.required_skills) if skill in skills]) * 5)
    return score


def is_available_for_campaign(candidate: Candidate) -> bool:
    return candidate.pool_status == CandidatePoolStatus.AVAILABLE and candidate.status not in {
        CandidateStatus.PLACED,
        CandidateStatus.REJECTED,
        CandidateStatus.BLACKLISTED,
    }