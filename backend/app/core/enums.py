import enum


class RoleName(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    RECRUITER = "recruiter"
    INSTITUTION = "institution"
    EMPLOYER = "employer"
    FIELD_AGENT = "field_agent"


class CandidateSource(str, enum.Enum):
    WEBSITE = "website"
    SOCIAL_MEDIA = "social_media"
    FIELD_AGENT = "field_agent"
    QR_SELF_REGISTRATION = "qr_self_registration"
    INSTITUTION_UPLOAD = "institution_upload"
    INBOUND_WEBHOOK = "inbound_webhook"
    MANUAL = "manual"


class CandidateStatus(str, enum.Enum):
    NEW = "new"
    SCREENED = "screened"
    SHORTLISTED = "shortlisted"
    IN_PROCESS = "in_process"
    PLACED = "placed"
    REJECTED = "rejected"
    BLACKLISTED = "blacklisted"


class CandidatePoolStatus(str, enum.Enum):
    AVAILABLE = "available"
    RESERVED = "reserved"
    IN_PROCESS = "in_process"
    PLACED = "placed"


class JobStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    PUBLISHED = "published"
    ON_HOLD = "on_hold"
    CLOSED = "closed"
    REJECTED = "rejected"


class ApprovalDecision(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ApplicationStatus(str, enum.Enum):
    ASSIGNED = "assigned"
    CONTACT_PENDING = "contact_pending"
    SCREENING = "screening"
    IN_INTERVIEW = "in_interview"
    DOCUMENTS = "documents"
    KYC = "kyc"
    VALIDATED = "validated"
    SELECTED = "selected"
    ON_HOLD = "on_hold"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    RELEASED = "released"
    PLACED = "placed"


class StageType(str, enum.Enum):
    SCREENING = "screening"
    CLIENT_INTERVIEW = "client_interview"
    DOCUMENT_VERIFICATION = "document_verification"
    KYC = "kyc"
    PLACEMENT = "placement"


class StageOutcome(str, enum.Enum):
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"
    ON_HOLD = "on_hold"


class KycStatus(str, enum.Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    VERIFIED = "verified"
    REJECTED = "rejected"


class LeadStatus(str, enum.Enum):
    NEW = "new"
    PROMOTED = "promoted"
    DISCARDED = "discarded"


class LocationEvent(str, enum.Enum):
    REGISTRATION = "registration"
    CHECK_IN = "check_in"
    FIELD_VISIT = "field_visit"


class DriveSetupType(str, enum.Enum):
    CANOPY = "canopy"
    MOVING_VAN = "moving_van"
    TABLE_DESK = "table_desk"
    TENT = "tent"
    KIOSK = "kiosk"
    OTHER = "other"


class DriveStatus(str, enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"
