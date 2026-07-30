"""Seed roles, an admin user, starter reference data, and 500+ candidate profiles (idempotent)."""

import logging
import random
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.enums import CandidateSource, CandidateStatus, RoleName, StageType
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.candidate import Candidate
from app.models.org import Employer, Institution
from app.models.pipeline import InterviewStageConfig, ScreeningQuestion
from app.models.user import Role, User

logger = logging.getLogger("smarthire.seed")

# Demo password shared by all seeded demo accounts (development only).
DEMO_PASSWORD = "Demo@12345"

# Non-admin demo users, one per role, shown as quick-login tiles.
DEMO_USERS = [
    (RoleName.MANAGER, "manager@smarthire.io", "Priya Sharma"),
    (RoleName.RECRUITER, "recruiter@smarthire.io", "Amit Verma"),
    (RoleName.INSTITUTION, "institution@smarthire.io", "Skill India ITI"),
    (RoleName.EMPLOYER, "employer@smarthire.io", "Tata Logistics HR"),
    (RoleName.FIELD_AGENT, "agent@smarthire.io", "Ravi Patil"),
]

ROLE_DESCRIPTIONS = {
    RoleName.ADMIN: "Full system administration and configuration",
    RoleName.MANAGER: "Recruiting manager: approvals, assignments, oversight",
    RoleName.RECRUITER: "Works assigned jobs and candidate pipeline",
    RoleName.INSTITUTION: "Bulk-uploads candidates",
    RoleName.EMPLOYER: "Client company posting job requirements",
    RoleName.FIELD_AGENT: "Registers candidates in the field with GPS logging",
}

DEFAULT_STAGES = [
    ("Screening", StageType.SCREENING, 1),
    ("Client Interview", StageType.CLIENT_INTERVIEW, 2),
    ("Document Submission & Verification", StageType.DOCUMENT_VERIFICATION, 3),
    ("KYC Validation", StageType.KYC, 4),
    ("Placement on Client Premises", StageType.PLACEMENT, 5),
]

DEFAULT_SCREENING_QUESTIONS = [
    "What is your primary trade / skill?",
    "How many years of hands-on experience do you have?",
    "Do you possess an ITI / NSDC or other trade certificate?",
    "Are you willing to work in rotational or night shifts?",
    "Do you hold a valid driving license (LMV/HMV)?",
    "What is your expected monthly salary (INR)?",
    "Which languages can you speak/read?",
    "Are you willing to relocate for work?",
    "What is your current city and state?",
    "Can you provide Aadhaar and PAN for KYC verification?",
    "Do you have any prior factory/site safety training?",
    "When can you join if selected?",
]

# Extended candidate seed data (names, trades, skills)
FIRST_NAMES = [
    "Rajesh", "Amit", "Suresh", "Ravi", "Arjun", "Vikram", "Pradeep", "Sandeep",
    "Mohan", "Kiran", "Deepak", "Anil", "Hari", "Ashok", "Nitin", "Sanjay",
    "Anita", "Priya", "Meera", "Savitri", "Pooja", "Divya", "Sheila", "Hemlata",
    "Ramesh", "Naresh", "Mahesh", "Dinesh", "Jayesh", "Haresh", "Girish", "Satish",
    "Rohit", "Sameer", "Imran", "Hassan", "Khan", "Patel", "Gupta", "Reddy",
]

LAST_NAMES = [
    "Sharma", "Singh", "Patel", "Kumar", "Verma", "Gupta", "Reddy", "Menon",
    "Nair", "Rao", "Desai", "Shah", "Iyer", "Krishnan", "Bansal", "Pandey",
    "Joshi", "Mishra", "Chatterjee", "Dey", "Bhattacharya", "Mukherjee", "Roy", "Das",
]

TRADES = [
    "Driver (LMV)", "Driver (HMV)", "Delivery Executive", "Electrician", "Plumber",
    "Welder", "Fitter", "Mason", "Carpenter", "Painter", "AC Technician",
    "Mobile Repair", "Security Guard", "Housekeeping", "Cook", "Waiter",
    "Warehouse Associate", "Loader", "Forklift Operator", "Machine Operator",
    "CNC Operator", "Factory Worker", "Tailor", "Gardener", "Bar Bender",
    "Data Entry Operator", "Field Sales", "Beautician", "Nursing Attendant",
]

TECHNICAL_SKILLS = [
    # Manufacturing & Technical Blue-Collar Skills
    "Electrician", "Plumber", "Welder", "Machine Operator", "CNC Operator",
    "Forklift Operator", "Assembly Work", "Quality Control", "Maintenance",
    "Equipment Operation", "Material Handling", "Industrial Safety",
    "Pressure Testing", "Hydraulics", "Pneumatics", "PLC Programming",
    "HVAC", "Electrical Wiring", "Circuit Board Assembly", "Soldering",
    "Precision Tooling", "Lathe Operation", "Milling", "Grinding",
    "Sheet Metal Work", "Fabrication", "Fitter", "Mason", "Carpenter",
    "Painter", "AC Technician", "Bar Bender",
]

STATES = [
    "Maharashtra", "Karnataka", "Tamil Nadu", "Telangana", "Andhra Pradesh",
    "Uttar Pradesh", "Delhi", "Punjab", "Haryana", "Gujarat",
    "Rajasthan", "Madhya Pradesh", "Bihar", "West Bengal", "Kerala",
]

CITIES_BY_STATE = {
    "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Aurangabad", "Nashik"],
    "Karnataka": ["Bangalore", "Mysore", "Mangalore", "Hubli", "Belgaum"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Salem", "Trichy"],
    "Telangana": ["Hyderabad", "Warangal", "Khammam", "Karimnagar"],
    "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Tirupati", "Rajahmundry"],
    "Uttar Pradesh": ["Noida", "Ghaziabad", "Lucknow", "Kanpur", "Varanasi"],
    "Delhi": ["Delhi", "New Delhi"],
    "Punjab": ["Chandigarh", "Amritsar", "Ludhiana", "Jalandhar"],
    "Haryana": ["Gurgaon", "Faridabad", "Hisar", "Rohtak"],
    "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar"],
}

EDUCATION_LEVELS = ["10th Pass", "12th Pass", "ITI", "Diploma", "Graduate"]
EXPERIENCE_BUCKETS = ["Fresher", "Less than 1 Year", "1–3 Years", "3–5 Years", "5+ Years"]
LANGUAGES = ["Hindi", "English", "Marathi", "Gujarati", "Tamil", "Telugu", "Kannada", "Malayalam"]


def generate_candidates(db: Session, institution_id: int, count: int = 500) -> None:
    """Generate rich candidate profiles with detailed skills & preferences."""
    existing = db.scalar(select(Candidate).limit(1))
    if existing:
        logger.info(f"Candidates already seeded ({count}+ expected). Skipping.")
        return

    statuses = [CandidateStatus.NEW, CandidateStatus.IN_PROCESS, CandidateStatus.PLACED]
    candidates_to_add = []

    for i in range(count):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        full_name = f"{first_name} {last_name}"

        state = random.choice(STATES)
        cities = CITIES_BY_STATE.get(state, ["City"])
        city = random.choice(cities)

        trade = random.choice(TRADES)
        exp_bucket = random.choice(EXPERIENCE_BUCKETS)
        exp_years = {"Fresher": 0, "Less than 1 Year": 0, "1–3 Years": 2, "3–5 Years": 4, "5+ Years": 7}.get(exp_bucket, 0)

        # Phone: realistic 10-digit Indian mobile
        phone = f"9{random.randint(100000000, 999999999)}"

        # DOB: candidates aged 18–55
        days_back = random.randint(18 * 365, 55 * 365)
        dob = (datetime.now() - timedelta(days=days_back)).date()

        # Random skills from extended list
        skills = random.sample(TECHNICAL_SKILLS, k=random.randint(2, 6))

        # Salary range by experience
        exp_salary_map = {
            0: random.randint(8000, 15000),
            2: random.randint(12000, 25000),
            4: random.randint(20000, 40000),
            7: random.randint(30000, 60000),
        }
        expected_salary = exp_salary_map.get(exp_years, random.randint(15000, 35000))

        # Languages
        langs = random.sample(LANGUAGES, k=random.randint(1, 3))
        languages_known = {
            lang: {
                "read": random.choice([True, True, False]),
                "write": random.choice([True, False, False]),
                "speak": True,
            }
            for lang in langs
        }

        # Additional preferences & info
        profile_data = {
            "marital_status": random.choice(["Single", "Married"]),
            "phone_otp_verified": random.choice([True, True, True, False]),
            "job_preferences": {
                "preferred_industry": random.choice(["Manufacturing", "Logistics", "Retail", "IT", "Healthcare"]),
                "employment_type": random.choice(["Full Time", "Contract", "Temporary"]),
                "preferred_location": random.choice(["Current City", "Anywhere in State", "Anywhere in India"]),
                "availability": random.choice(["Immediately", "Within 7 Days", "Within 15 Days"]),
            },
            "education": {
                "course_trade": random.choice(["ITI Electrician", "ITI Welder", "ITI Fitter", "Diploma"]),
                "year_of_passing": str(random.randint(2010, 2023)),
            },
            "work_experience": {
                "total_experience": exp_bucket,
                "current_company": random.choice(["Self-employed", "ABC Corp", "XYZ Industries", "Startup"]) if exp_years > 0 else None,
                "current_role": trade if exp_years > 0 else None,
                "current_salary": expected_salary * 0.9 if exp_years > 0 else None,
                "reason_for_leaving": random.choice(["Better opportunity", "Relocation", "Higher salary"]) if exp_years > 0 else None,
            },
            "skills": skills,
            "documents": {
                "aadhaar_number": str(random.randint(100000000000, 999999999999)),
                "pan_number": f"{'ABCDE'[random.randint(0, 4)]}{random.randint(100000, 999999)}{'ABCDE'[random.randint(0, 4)]}",
                "passport_available": random.choice(["Yes", "No"]),
                "has_photo": random.choice([True, True, False]),
            },
            "languages_known": languages_known,
            "additional_info": {
                "willing_to_shifts": random.choice([True, True, False]),
                "willing_overtime": random.choice([True, True, False]),
                "own_two_wheeler": random.choice([True, True, False]),
                "own_four_wheeler": random.choice([True, False, False]),
                "physically_fit": random.choice([True, True, True, False]),
                "medical_condition": random.choice(["None", "Asthma", "Diabetes"]) if random.random() > 0.8 else None,
            },
            "emergency_contact": {
                "name": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
                "relationship": random.choice(["Parent", "Spouse", "Sibling"]),
                "phone": f"9{random.randint(100000000, 999999999)}",
            },
            "declaration_accepted": True,
            "declaration_at": datetime.now().isoformat(),
        }

        candidate = Candidate(
            full_name=full_name,
            gender=random.choice(["Male", "Female"]),
            date_of_birth=dob,
            phone=phone,
            email=f"{full_name.lower().replace(' ', '.')}.{i}@example.com",
            address=f"{random.randint(1, 500)} {random.choice(['Street', 'Lane', 'Road', 'Avenue'])}, {city}",
            city=city,
            state=state,
            pincode=str(random.randint(100000, 999999)),
            primary_trade=trade,
            experience_years=exp_years,
            education_level=random.choice(EDUCATION_LEVELS),
            certification=random.choice(["ITI Certificate", "NSDC Training", "Fire Safety", "None"]),
            languages=", ".join(langs),
            expected_salary=expected_salary,
            has_driving_license=random.choice([True, True, False]),
            willing_to_relocate=random.choice([True, True, False]),
            notes=None,
            source=CandidateSource.MANUAL,
            status=random.choice(statuses),
            institution_id=institution_id,
            profile_data=profile_data,
        )
        candidates_to_add.append(candidate)

        if len(candidates_to_add) % 100 == 0:
            logger.info(f"Prepared {len(candidates_to_add)} candidates...")

    # Batch insert
    db.add_all(candidates_to_add)
    db.commit()
    logger.info(f"Seeded {len(candidates_to_add)} candidates with rich profiles.")


def seed() -> None:
    db = SessionLocal()
    try:
        # Roles
        role_map: dict[RoleName, Role] = {}
        for role_name, desc in ROLE_DESCRIPTIONS.items():
            role = db.scalar(select(Role).where(Role.name == role_name.value))
            if not role:
                role = Role(name=role_name.value, description=desc)
                db.add(role)
                db.flush()
            role_map[role_name] = role

        # Admin user
        admin = db.scalar(select(User).where(User.email == settings.FIRST_ADMIN_EMAIL))
        if not admin:
            db.add(
                User(
                    email=settings.FIRST_ADMIN_EMAIL,
                    full_name=settings.FIRST_ADMIN_NAME,
                    hashed_password=hash_password(settings.FIRST_ADMIN_PASSWORD),
                    role_id=role_map[RoleName.ADMIN].id,
                )
            )
            logger.info("Seeded admin user %s", settings.FIRST_ADMIN_EMAIL)

        # Demo institution & employer to link partner-role users to.
        institution = db.scalar(select(Institution).limit(1))
        if not institution:
            institution = Institution(
                name="Skill India ITI, Pune",
                contact_person="Skill India ITI",
                city="Pune",
                state="Maharashtra",
            )
            db.add(institution)
            db.flush()

        employer = db.scalar(select(Employer).limit(1))
        if not employer:
            employer = Employer(
                company_name="Tata Logistics Pvt Ltd",
                industry="Warehousing & Logistics",
                contact_person="Tata Logistics HR",
                city="Bhiwandi",
                state="Maharashtra",
            )
            db.add(employer)
            db.flush()

        # One demo user per non-admin role (for quick-login tiles).
        for role_name, email, full_name in DEMO_USERS:
            if db.scalar(select(User).where(User.email == email)):
                continue
            db.add(
                User(
                    email=email,
                    full_name=full_name,
                    hashed_password=hash_password(DEMO_PASSWORD),
                    role_id=role_map[role_name].id,
                    institution_id=institution.id
                    if role_name == RoleName.INSTITUTION
                    else None,
                    employer_id=employer.id
                    if role_name == RoleName.EMPLOYER
                    else None,
                )
            )
            logger.info("Seeded demo user %s (%s)", email, role_name.value)

        # Interview stages
        if not db.scalar(select(InterviewStageConfig).limit(1)):
            for name, stype, order in DEFAULT_STAGES:
                db.add(InterviewStageConfig(name=name, stage_type=stype, order_index=order))

        # Screening questions
        if not db.scalar(select(ScreeningQuestion).limit(1)):
            for i, text in enumerate(DEFAULT_SCREENING_QUESTIONS, start=1):
                db.add(ScreeningQuestion(text=text, category="General", order_index=i))

        # Seed 500+ rich candidate profiles
        generate_candidates(db, institution.id, count=520)

        db.commit()
        logger.info("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed()
