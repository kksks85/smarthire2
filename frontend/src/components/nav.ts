import type { Role } from "../types";

export interface NavModule {
  label: string;
  path: string;
  roles: Role[];
}

export interface NavGroup {
  title: string;
  modules: NavModule[];
}

const ALL: Role[] = [
  "admin",
  "manager",
  "recruiter",
  "institution",
  "employer",
  "field_agent",
];

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    modules: [{ label: "Dashboard", path: "/", roles: ["admin", "manager", "recruiter", "employer", "field_agent"] }],
  },
  {
    title: "Candidate Data Bank",
    modules: [
      { label: "All Candidates", path: "/candidates", roles: ["admin", "manager", "recruiter", "field_agent"] },
      { label: "Register Candidate", path: "/candidates/new", roles: ["admin", "manager", "recruiter"] },
      { label: "Quick Register", path: "/candidates/new?quick=1", roles: ["field_agent"] },
      { label: "Inbound Leads", path: "/leads", roles: ["admin", "manager", "recruiter"] },
    ],
  },
  {
    title: "Jobs & Requisitions",
    modules: [
      { label: "Job Postings", path: "/jobs", roles: ["admin", "manager", "recruiter", "employer"] },
      { label: "Create Job", path: "/jobs/new", roles: ["admin", "manager", "recruiter", "employer"] },
      { label: "Approvals", path: "/approvals", roles: ["admin", "manager"] },
    ],
  },
  {
    title: "Recruitment",
    modules: [
      { label: "My Assignments", path: "/assignments", roles: ["recruiter", "manager", "admin"] },
      { label: "Interview Pipeline", path: "/pipeline", roles: ["admin", "manager", "recruiter"] },
      { label: "Screen Resources", path: "/screen-resources", roles: ["admin", "manager"] },
      { label: "KYC Verification", path: "/kyc", roles: ["admin", "manager", "recruiter"] },
    ],
  },
  {
    title: "Field Operations",
    modules: [
      { label: "Field Check-in (GPS)", path: "/field/checkin", roles: ["field_agent", "admin", "manager"] },
      { label: "Registration Drives", path: "/field/drives", roles: ["admin", "manager"] },
      { label: "PII View Log", path: "/pii-log", roles: ["admin", "manager"] },
      { label: "Mailbox", path: "/mailbox", roles: ["admin", "manager", "recruiter", "field_agent"] },
    ],
  },
  {
    title: "Partners",
    modules: [
      { label: "Institutions", path: "/institutions", roles: ["admin", "manager"] },
      { label: "Employers (Clients)", path: "/employers", roles: ["admin", "manager", "employer"] },
    ],
  },
  {
    title: "Institution Portal",
    modules: [
      { label: "Dashboard", path: "/institution", roles: ["institution"] },
      { label: "Upload Candidates", path: "/institution/upload", roles: ["institution"] },
      { label: "Add Candidate", path: "/institution/candidates/new", roles: ["institution"] },
      { label: "My Candidates", path: "/institution/candidates", roles: ["institution"] },
      { label: "Upload Logs", path: "/institution/uploads", roles: ["institution"] },
    ],
  },
  {
    title: "Administration",
    modules: [
      { label: "Users & Roles", path: "/admin/users", roles: ["admin"] },
      { label: "Student Central", path: "/admin/student-central", roles: ["admin", "manager"] },
      { label: "Screening Questions", path: "/admin/screening", roles: ["admin"] },
      { label: "Interview Stages", path: "/admin/stages", roles: ["admin"] },
      { label: "Email Accounts", path: "/admin/email/accounts", roles: ["admin"] },
      { label: "Email Templates", path: "/admin/email/templates", roles: ["admin", "manager"] },
      { label: "Email Rules", path: "/admin/email/rules", roles: ["admin", "manager"] },
      { label: "Public Sharing", path: "/admin/public-sharing", roles: ["admin", "manager", "recruiter", "employer", "field_agent"] },
      { label: "WhatsApp Settings", path: "/admin/whatsapp-settings", roles: ["admin"] },
      { label: "Reports", path: "/reports", roles: ["admin", "manager", "recruiter"] },
      { label: "Audit / PII Access", path: "/admin/audit", roles: ["admin"] },
    ],
  },
];
