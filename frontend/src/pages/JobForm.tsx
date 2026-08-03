import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { INDIAN_STATES, BLUE_COLLAR_CATEGORIES, EMPLOYMENT_TYPES, SHIFT_TYPES, EDUCATION_LEVELS, LANGUAGES, KYC_DOCUMENT_TYPES } from "../lib/reference";

interface JobFormState {
  // Job Details
  employer_id: number | null;
  title: string;
  category: string;
  industry: string;
  description: string;
  employment_type: string;
  vacancies: number;

  // Work Location
  work_state: string;
  work_city: string;
  work_address: string;

  // Candidate Requirements
  min_qualification: string;
  min_experience_years: number;
  min_age: number | null;
  max_age: number | null;
  gender_preference: string;
  required_certification: string;
  required_skills: string[];
  languages_required: string[];

  // Salary & Benefits
  salary_min: number | null;
  salary_max: number | null;
  shift_type: string;
  weekly_off: string;
  benefits: string[];
  accommodation_provided: boolean;

  // Hiring Details
  joining_timeline: string;
  interview_mode: string;
  documents_required: string[];
  assigned_recruiter_id: number | null;
  hiring_priority: string;
}

const DEFAULT_FORM_STATE: JobFormState = {
  employer_id: null,
  title: "",
  category: "",
  industry: "",
  description: "",
  employment_type: "",
  vacancies: 1,
  work_state: "",
  work_city: "",
  work_address: "",
  min_qualification: "",
  min_experience_years: 0,
  min_age: null,
  max_age: null,
  gender_preference: "",
  required_certification: "",
  required_skills: [],
  languages_required: [],
  salary_min: null,
  salary_max: null,
  shift_type: "",
  weekly_off: "",
  benefits: [],
  accommodation_provided: false,
  joining_timeline: "",
  interview_mode: "",
  documents_required: [],
  assigned_recruiter_id: null,
  hiring_priority: "",
};

const BENEFIT_OPTIONS = ["PF", "ESI", "Food", "Accommodation", "Transport", "Incentives"];
const HIRING_PRIORITY_OPTIONS = ["High", "Medium", "Low"];
const INTERVIEW_MODE_OPTIONS = ["In-Person", "Video Call", "Phone", "Both"];
const JOINING_TIMELINE_OPTIONS = ["Immediately", "Within 7 Days", "Within 15 Days", "Within 30 Days"];
const GENDER_OPTIONS = ["Any", "Male", "Female"];
const WEEKLY_OFF_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const FORM_SECTIONS = [
  { id: "job-details", label: "Job Details", icon: "📋" },
  { id: "location", label: "Work Location", icon: "📍" },
  { id: "requirements", label: "Candidate Requirements", icon: "👤" },
  { id: "compensation", label: "Salary & Benefits", icon: "💰" },
  { id: "hiring", label: "Hiring Details", icon: "📞" },
  { id: "review", label: "Review & Submit", icon: "✓" },
];

interface Employer {
  id: number;
  company_name: string;
}

export default function JobForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState<JobFormState>(DEFAULT_FORM_STATE);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedJobs, setSavedJobs] = useState(0);
  const [employers, setEmployers] = useState<Employer[]>([]);

  // Fetch employers
  useEffect(() => {
    api.get<Employer[]>("/employers").then((r) => setEmployers(r.data)).catch(() => setEmployers([]));
  }, []);

  // Fetch existing data if needed
  useEffect(() => {
    const saved = localStorage.getItem("smarthire.job.draft");
    if (saved) {
      try {
        setForm(JSON.parse(saved));
        setInfo("Loaded saved job draft.");
        setTimeout(() => setInfo(""), 3000);
      } catch {}
    }
  }, []);

  // Auto-save on changes
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem("smarthire.job.draft", JSON.stringify(form));
      setSavedJobs((prev) => prev + 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [form]);

  const updateForm = (field: keyof JobFormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleMultiSelect = (field: keyof JobFormState, item: string) => {
    const arr = form[field] as string[];
    setForm((prev) => ({
      ...prev,
      [field]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item],
    }));
  };

  const resetForm = () => {
    setForm(DEFAULT_FORM_STATE);
    setCurrentStep(0);
    setError("");
    setInfo("Form reset. Starting fresh.");
    setSavedJobs(0);
    localStorage.removeItem("smarthire.job.draft");
    setTimeout(() => setInfo(""), 2000);
  };

  const validate = (): boolean => {
    if (!form.employer_id) return setError("Employer / Client is required."), false;
    if (!form.title.trim()) return setError("Job title is required."), false;
    if (!form.category) return setError("Job category is required."), false;
    if (!form.employment_type) return setError("Employment type is required."), false;
    if (!form.vacancies || form.vacancies < 1) return setError("Number of openings must be at least 1."), false;
    if (!form.description.trim()) return setError("Job description is required."), false;
    if (!form.work_state) return setError("Work state is required."), false;
    if (!form.work_city) return setError("Work city is required."), false;
    if (!form.work_address.trim()) return setError("Work address is required."), false;
    if (!form.salary_min || !form.salary_max) return setError("Salary range is required."), false;
    if (form.salary_min >= form.salary_max) return setError("Min salary must be less than max."), false;
    setError("");
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setBusy(true);
    try {
      const payload = {
        ...form,
        employer_id: form.employer_id,
        required_skills: form.required_skills.length > 0 ? { skills: form.required_skills } : {},
        languages_required: form.languages_required.length > 0 ? { languages: form.languages_required } : {},
        benefits: form.benefits.length > 0 ? { items: form.benefits } : {},
        documents_required: form.documents_required.length > 0 ? { documents: form.documents_required } : {},
      };

      const res = await api.post("/jobs", payload);
      setInfo(`Job posting created (ID: ${res.data.id}). Submitting for approval...`);
      localStorage.removeItem("smarthire.job.draft");
      setTimeout(() => navigate(`/jobs/${res.data.id}`), 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create job posting");
    } finally {
      setBusy(false);
    }
  };

  const currentSection = FORM_SECTIONS[currentStep].id;
  const progress = ((currentStep + 1) / FORM_SECTIONS.length) * 100;

  return (
    <div className="form-wrapper" style={{ maxWidth: "900px", margin: "20px auto", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ margin: 0 }}>Create Job Posting</h1>
        <button
          className="btn"
          onClick={resetForm}
          style={{ background: "var(--text-muted)", color: "#fff" }}
          title="Clear form and start over"
        >
          Clear Form
        </button>
      </div>

        {/* Progress */}
        <div className="wizard-progress" style={{ marginBottom: "30px" }}>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", marginTop: "8px" }}>
            Step {currentStep + 1} of {FORM_SECTIONS.length}
          </div>
        </div>

        {/* Messages */}
        {error && <div className="alert alert-error">{error}</div>}
        {info && <div className="alert alert-success">{info}</div>}

        {/* Step Indicators */}
        <div className="wizard-steps" style={{ marginBottom: "30px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {FORM_SECTIONS.map((section, idx) => (
            <button
              key={section.id}
              type="button"
              className={`wizard-step ${idx === currentStep ? "active" : ""} ${idx < currentStep ? "done" : ""}`}
              onClick={() => setCurrentStep(idx)}
              style={{ flex: "1 1 auto" }}
            >
              {section.icon} <span>{section.label}</span>
            </button>
          ))}
        </div>

        {/* Form Sections */}
        <div className="wizard-body">
          {/* Job Details */}
          {currentSection === "job-details" && (
            <div className="wizard-panel">
              <h2>Job Details</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>Employer / Client *</label>
                  <select value={form.employer_id || ""} onChange={(e) => updateForm("employer_id", e.target.value ? parseInt(e.target.value) : null)}>
                    <option value="">Select employer</option>
                    {employers.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.company_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Job Title *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => updateForm("title", e.target.value)}
                    placeholder="e.g., CNC Operator, Senior Electrician"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Job Category *</label>
                  <select value={form.category} onChange={(e) => updateForm("category", e.target.value)}>
                    <option value="">Select category</option>
                    {BLUE_COLLAR_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Industry</label>
                  <input
                    type="text"
                    value={form.industry}
                    onChange={(e) => updateForm("industry", e.target.value)}
                    placeholder="e.g., Manufacturing, Logistics"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Employment Type *</label>
                  <select value={form.employment_type} onChange={(e) => updateForm("employment_type", e.target.value)}>
                    <option value="">Select type</option>
                    {EMPLOYMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Number of Openings *</label>
                  <input
                    type="number"
                    value={form.vacancies}
                    onChange={(e) => updateForm("vacancies", parseInt(e.target.value) || 1)}
                    min="1"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Job Description *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  placeholder="Describe the role, responsibilities, and key tasks..."
                  rows={6}
                />
              </div>
            </div>
          )}

          {/* Work Location */}
          {currentSection === "location" && (
            <div className="wizard-panel">
              <h2>Work Location</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>State *</label>
                  <select value={form.work_state} onChange={(e) => updateForm("work_state", e.target.value)}>
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>City *</label>
                  <input
                    type="text"
                    value={form.work_city}
                    onChange={(e) => updateForm("work_city", e.target.value)}
                    placeholder="City name"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Work Location / Address *</label>
                <input
                  type="text"
                  value={form.work_address}
                  onChange={(e) => updateForm("work_address", e.target.value)}
                  placeholder="Full address of the work location"
                />
              </div>
            </div>
          )}

          {/* Candidate Requirements */}
          {currentSection === "requirements" && (
            <div className="wizard-panel">
              <h2>Candidate Requirements</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>Minimum Qualification</label>
                  <select value={form.min_qualification} onChange={(e) => updateForm("min_qualification", e.target.value)}>
                    <option value="">Any</option>
                    {EDUCATION_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Experience Required (Years)</label>
                  <input
                    type="number"
                    value={form.min_experience_years}
                    onChange={(e) => updateForm("min_experience_years", parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Min Age</label>
                  <input
                    type="number"
                    value={form.min_age || ""}
                    onChange={(e) => updateForm("min_age", e.target.value ? parseInt(e.target.value) : null)}
                    min="18"
                    max="70"
                  />
                </div>
                <div className="form-group">
                  <label>Max Age</label>
                  <input
                    type="number"
                    value={form.max_age || ""}
                    onChange={(e) => updateForm("max_age", e.target.value ? parseInt(e.target.value) : null)}
                    min="18"
                    max="70"
                  />
                </div>
                <div className="form-group">
                  <label>Gender Preference</label>
                  <select value={form.gender_preference} onChange={(e) => updateForm("gender_preference", e.target.value)}>
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Required Skills (Multi-select)</label>
                <div className="chip-grid">
                  {BLUE_COLLAR_CATEGORIES.slice(0, 15).map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      className={`chip ${form.required_skills.includes(skill) ? "active" : ""}`}
                      onClick={() => toggleMultiSelect("required_skills", skill)}
                    >
                      {form.required_skills.includes(skill) ? "✓ " : ""}
                      {skill}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Languages Required (Multi-select)</label>
                <div className="chip-grid">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      className={`chip ${form.languages_required.includes(lang) ? "active" : ""}`}
                      onClick={() => toggleMultiSelect("languages_required", lang)}
                    >
                      {form.languages_required.includes(lang) ? "✓ " : ""}
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Compensation */}
          {currentSection === "compensation" && (
            <div className="wizard-panel">
              <h2>Salary & Benefits</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>Salary Min (₹) *</label>
                  <input
                    type="number"
                    value={form.salary_min || ""}
                    onChange={(e) => updateForm("salary_min", e.target.value ? parseInt(e.target.value) : null)}
                    min="1000"
                    placeholder="Min monthly salary"
                  />
                </div>
                <div className="form-group">
                  <label>Salary Max (₹) *</label>
                  <input
                    type="number"
                    value={form.salary_max || ""}
                    onChange={(e) => updateForm("salary_max", e.target.value ? parseInt(e.target.value) : null)}
                    min="1000"
                    placeholder="Max monthly salary"
                  />
                </div>
              </div>
              {form.salary_min && form.salary_max && (
                <div style={{ padding: "12px", background: "#e6f4ea", borderRadius: "4px", marginBottom: "16px", fontSize: "14px" }}>
                  💰 Salary Range: ₹{form.salary_min.toLocaleString()} - ₹{form.salary_max.toLocaleString()} per month
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Shift Type</label>
                  <select value={form.shift_type} onChange={(e) => updateForm("shift_type", e.target.value)}>
                    <option value="">Any</option>
                    {SHIFT_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Weekly Off</label>
                  <select value={form.weekly_off} onChange={(e) => updateForm("weekly_off", e.target.value)}>
                    <option value="">Not specified</option>
                    {WEEKLY_OFF_OPTIONS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Benefits (Multi-select)</label>
                <div className="chip-grid">
                  {BENEFIT_OPTIONS.map((benefit) => (
                    <button
                      key={benefit}
                      type="button"
                      className={`chip ${form.benefits.includes(benefit) ? "active" : ""}`}
                      onClick={() => toggleMultiSelect("benefits", benefit)}
                    >
                      {form.benefits.includes(benefit) ? "✓ " : ""}
                      {benefit}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: "20px" }}>
                <label style={{ display: "flex", gap: "10px", alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.accommodation_provided}
                    onChange={(e) => updateForm("accommodation_provided", e.target.checked)}
                  />
                  <span>Accommodation Provided</span>
                </label>
              </div>
            </div>
          )}

          {/* Hiring Details */}
          {currentSection === "hiring" && (
            <div className="wizard-panel">
              <h2>Hiring Details</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>Joining Timeline</label>
                  <select value={form.joining_timeline} onChange={(e) => updateForm("joining_timeline", e.target.value)}>
                    <option value="">Select</option>
                    {JOINING_TIMELINE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Interview Mode</label>
                  <select value={form.interview_mode} onChange={(e) => updateForm("interview_mode", e.target.value)}>
                    <option value="">Select</option>
                    {INTERVIEW_MODE_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Hiring Priority</label>
                  <select value={form.hiring_priority} onChange={(e) => updateForm("hiring_priority", e.target.value)}>
                    <option value="">Select</option>
                    {HIRING_PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Documents Required</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px", marginTop: "8px" }}>
                  {KYC_DOCUMENT_TYPES.map((doc) => (
                    <label key={doc} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: "normal" }}>
                      <input
                        type="checkbox"
                        checked={form.documents_required.includes(doc)}
                        onChange={() => toggleMultiSelect("documents_required", doc)}
                      />
                      {doc}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Review & Submit */}
          {currentSection === "review" && (
            <div className="wizard-panel">
              <h2>Review Job Posting</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" }}>
                <div>
                  <h3>Job Details</h3>
                  <p><strong>Title:</strong> {form.title}</p>
                  <p><strong>Category:</strong> {form.category}</p>
                  <p><strong>Type:</strong> {form.employment_type}</p>
                  <p><strong>Openings:</strong> {form.vacancies}</p>
                </div>
                <div>
                  <h3>Location</h3>
                  <p><strong>State:</strong> {form.work_state}</p>
                  <p><strong>City:</strong> {form.work_city}</p>
                  <p><strong>Address:</strong> {form.work_address}</p>
                </div>
                <div>
                  <h3>Requirements</h3>
                  <p><strong>Min Experience:</strong> {form.min_experience_years} years</p>
                  <p><strong>Qualification:</strong> {form.min_qualification || "Any"}</p>
                  <p><strong>Skills Required:</strong> {form.required_skills.length > 0 ? form.required_skills.join(", ") : "Not specified"}</p>
                </div>
                <div>
                  <h3>Compensation</h3>
                  <p><strong>Salary:</strong> ₹{form.salary_min?.toLocaleString()} - ₹{form.salary_max?.toLocaleString()}</p>
                  <p><strong>Shift:</strong> {form.shift_type || "Not specified"}</p>
                  <p><strong>Benefits:</strong> {form.benefits.length > 0 ? form.benefits.join(", ") : "None"}</p>
                </div>
              </div>

              <div style={{ marginTop: "30px", padding: "16px", background: "#fdf6e3", borderRadius: "4px" }}>
                <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
                  ✓ All required fields are filled. The job posting will be submitted for approval upon creation.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="wizard-nav" style={{ marginTop: "30px", display: "flex", gap: "10px", justifyContent: "space-between" }}>
          <button
            className="btn secondary"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            Previous
          </button>

          <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
            Auto-saved {savedJobs} times
          </div>

          {currentStep === FORM_SECTIONS.length - 1 ? (
            <button
              className="btn primary"
              onClick={handleSubmit}
              disabled={busy}
            >
              {busy ? "Creating..." : "Create & Submit for Approval"}
            </button>
          ) : (
            <button
              className="btn primary"
              onClick={() => setCurrentStep(Math.min(FORM_SECTIONS.length - 1, currentStep + 1))}
            >
              Next
            </button>
          )}
        </div>
      </div>
  );
}
