export type Role =
  | "admin"
  | "manager"
  | "recruiter"
  | "institution"
  | "employer"
  | "field_agent";

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string | null;
  is_active: boolean;
  role: Role;
  institution_id?: number | null;
  employer_id?: number | null;
  recruiter_details?: Record<string, any> | null;
}

export interface KpiCard {
  label: string;
  value: number;
  hint?: string | null;
  link?: string | null;
}

export interface Dashboard {
  role: string;
  cards: KpiCard[];
}

export interface Candidate {
  id: number;
  full_name: string;
  gender?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  primary_trade?: string | null;
  experience_years?: number | null;
  education_level?: string | null;
  certification?: string | null;
  languages?: string | null;
  expected_salary?: number | null;
  has_driving_license: boolean;
  willing_to_relocate: boolean;
  notes?: string | null;
  source: string;
  status: string;
  pool_status: "available" | "reserved" | "in_process" | "placed";
  institution_id?: number | null;
  custom_question_responses?: CustomQuestionResponse[];
  pii_masked: boolean;
  profile_data?: Record<string, any> | null;
}

export interface CustomQuestionResponse {
  question_number: number;
  question?: string | null;
  answer?: string | null;
}

export interface CampaignImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface InstitutionUploadLog {
  id: number;
  institution_id: number;
  registered_by_id: number;
  filename: string;
  file_type: "xlsx" | "csv";
  total_rows: number;
  created_count: number;
  skipped_count: number;
  status: "success" | "partial" | "failed";
  errors?: { row_errors?: string[] } | null;
  created_at: string;
}

export interface InstitutionUploadSummary {
  created: number;
  skipped: number;
  errors: string[];
}

export interface CandidatePii {
  id: number;
  phone: string;
  email?: string | null;
  address?: string | null;
}

export interface Job {
  id: number;
  title: string;
  category: string;
  description?: string | null;
  employer_id: number;
  employment_type?: string | null;
  shift_type?: string | null;
  vacancies: number;
  salary_min?: number | null;
  salary_max?: number | null;
  min_experience_years: number;
  required_certification?: string | null;
  work_city?: string | null;
  work_state?: string | null;
  accommodation_provided: boolean;
  status: string;
  public_slug?: string | null;
  published_at?: string | null;
  created_by_id: number;
  required_candidate_fields?: { fields?: string[]; documents?: string[] } | null;
  stats?: {
    interested: number;
    contact_successful: number;
    blocked_for_position: number;
  };
}

export interface PublishInfo {
  id: number;
  status: string;
  public_slug: string;
  public_url: string;
  apply_url: string;
  qr_data_uri: string;
  share_facebook_url: string;
  share_linkedin_url: string;
}

export interface Employer {
  id: number;
  company_name: string;
  industry?: string | null;
  company_type?: string | null;
  website?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  gst_number?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  locations?: { items?: any[] } | any;
  contacts?: { items?: any[] } | any;
  required_candidate_fields?: { fields?: string[]; documents?: string[] } | any;
  is_active: boolean;
}

export interface Institution {
  id: number;
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  is_active: boolean;
}

export interface ReferenceData {
  states: string[];
  job_categories: string[];
  certifications: string[];
  kyc_document_types: string[];
  employment_types: string[];
  shift_types: string[];
  education_levels: string[];
  languages: string[];
}

export interface Application {
  id: number;
  candidate_id: number;
  job_id: number;
  assigned_recruiter_id?: number | null;
  status: string;
  current_stage_type: string;
  contact_attempt_count: number;
  candidate_interest?: boolean | null;
  released_at?: string | null;
  release_reason?: string | null;
}

// ---------- Field agent registration drives ----------

export type DriveSetupType =
  | "canopy"
  | "moving_van"
  | "table_desk"
  | "tent"
  | "kiosk"
  | "other";

export type DriveStatus = "active" | "closed";

export interface FieldDrive {
  id: number;
  field_agent_id: number;
  field_agent_name?: string | null;
  title: string;
  venue_name: string;
  setup_type: DriveSetupType;
  setup_type_other?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: DriveStatus;
  public_slug?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  candidate_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FieldDriveShareKit {
  id: number;
  public_slug: string;
  registration_url: string;
  qr_data_uri: string;
  whatsapp_share_url: string;
}

export interface PublicDriveInfo {
  title: string;
  venue_name: string;
  setup_type: DriveSetupType;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  field_agent_name?: string | null;
  slug: string;
}

// ---------- Email subsystem ----------

export interface EmailAccount {
  id: number;
  name: string;
  from_address: string;
  from_display_name?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_username?: string | null;
  smtp_use_tls: boolean;
  smtp_use_ssl: boolean;
  imap_host?: string | null;
  imap_port?: number | null;
  imap_username?: string | null;
  imap_use_ssl: boolean;
  imap_folder: string;
  is_default_outbound: boolean;
  is_active: boolean;
  has_smtp_password: boolean;
  has_imap_password: boolean;
  last_polled_at?: string | null;
  last_poll_error?: string | null;
  created_at?: string | null;
}

export interface EmailAccountTestResult {
  smtp_ok: boolean;
  smtp_error?: string | null;
  imap_ok: boolean;
  imap_error?: string | null;
}

export type EmailMergeContext =
  | "none"
  | "candidate"
  | "job"
  | "employer"
  | "application"
  | "user";

export interface EmailTemplate {
  id: number;
  name: string;
  description?: string | null;
  subject: string;
  body_html?: string | null;
  body_text?: string | null;
  merge_context: EmailMergeContext;
  category: string;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MergeField {
  token: string;
  label: string;
}

export interface MergeContextFields {
  context: string;
  label: string;
  fields: MergeField[];
}

export type EmailDirection = "inbound" | "outbound";

export interface EmailRule {
  id: number;
  name: string;
  direction: EmailDirection;
  is_active: boolean;
  priority: number;
  trigger_event?: string | null;
  match_conditions?: Record<string, any> | null;
  action_type: string;
  action_params?: Record<string, any> | null;
  template_id?: number | null;
  account_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface EmailMessage {
  id: number;
  direction: EmailDirection;
  account_id?: number | null;
  template_id?: number | null;
  rule_id?: number | null;
  message_id?: string | null;
  thread_id?: string | null;
  from_address?: string | null;
  from_name?: string | null;
  to_addresses?: string[] | null;
  cc_addresses?: string[] | null;
  bcc_addresses?: string[] | null;
  subject?: string | null;
  snippet?: string | null;
  status: string;
  error_detail?: string | null;
  related_candidate_id?: number | null;
  related_application_id?: number | null;
  related_job_id?: number | null;
  sent_at?: string | null;
  received_at?: string | null;
  created_at?: string | null;
  attachment_count: number;
}

export interface EmailAttachment {
  id: number;
  original_filename: string;
  content_type?: string | null;
  size_bytes?: number | null;
}

export interface EmailMessageDetail extends EmailMessage {
  body_html?: string | null;
  body_text?: string | null;
  attachments: EmailAttachment[];
}

// ---------- Reporting engine ----------

export type ReportDisplayType =
  | "table"
  | "bar"
  | "line"
  | "pie"
  | "kpi"
  | "map"
  | "funnel";

export interface OperatorMeta {
  key: string;
  label: string;
  unary: boolean;
  multi: boolean;
}

export interface ColumnMeta {
  name: string;
  label: string;
  type: string;
  filterable: boolean;
  group_by_ok: boolean;
  aggregate_ok: boolean;
  is_pii: boolean;
  operators: OperatorMeta[];
}

export interface DataSourceMeta {
  key: string;
  label: string;
  description?: string;
  columns: ColumnMeta[];
}

export interface FilterLeaf {
  field: string;
  op: string;
  value?: any;
}

export interface FilterGroup {
  join?: "and" | "or";
  children: (FilterLeaf | FilterGroup)[];
}

export type FilterNode = FilterLeaf | FilterGroup | null;

export interface ReportColumnRef {
  field: string;
  label?: string;
  aggregate?: string;
}

export interface Report {
  id: number;
  name: string;
  description?: string | null;
  data_source: string;
  filters?: FilterGroup | null;
  columns?: ReportColumnRef[] | null;
  group_by?: string[] | null;
  order_by?: { field: string; direction: string }[] | null;
  display_type: ReportDisplayType;
  display_options?: Record<string, any> | null;
  row_limit: number;
  is_public: boolean;
  owner_id: number;
  owner_name?: string | null;
  can_edit: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ReportRunResult {
  columns: {
    key: string;
    label: string;
    type: string;
    is_pii: boolean;
    aggregate?: string | null;
  }[];
  rows: Record<string, any>[];
  row_count: number;
  truncated: boolean;
  display_type: ReportDisplayType;
  display_options: Record<string, any>;
}

export interface ReportShare {
  id: number;
  report_id: number;
  principal_type: "user" | "role";
  principal_id: number;
  principal_label?: string | null;
  permission: "view" | "edit";
  created_at?: string | null;
}

export interface ReportSchedule {
  id: number;
  report_id: number;
  cron_expr: string;
  timezone: string;
  format: "csv" | "xlsx" | "inline_html";
  email_template_id?: number | null;
  recipients_users: number[];
  recipients_roles: string[];
  recipients_emails: string[];
  is_active: boolean;
  last_run_at?: string | null;
  next_run_at?: string | null;
  last_run_status?: string | null;
  last_run_error?: string | null;
  created_at?: string | null;
}
