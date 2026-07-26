from fastapi import APIRouter

from app.api.v1 import (
    admin,
    auth,
    candidates,
    dashboard,
    email,
    employers,
    field_agents,
    field_drives,
    institutions,
    jobs,
    kyc,
    leads,
    pipeline,
    public,
    reference,
    reports,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(admin.router)
api_router.include_router(reference.router)
api_router.include_router(candidates.router)
api_router.include_router(jobs.router)
api_router.include_router(pipeline.router)
api_router.include_router(kyc.router)
api_router.include_router(leads.router)
api_router.include_router(institutions.router)
api_router.include_router(employers.router)
api_router.include_router(field_agents.router)
api_router.include_router(field_drives.router)
api_router.include_router(dashboard.router)
api_router.include_router(public.router)
api_router.include_router(email.router)
api_router.include_router(reports.router)
