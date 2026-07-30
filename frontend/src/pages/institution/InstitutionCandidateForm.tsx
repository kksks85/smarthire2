import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { PageHead } from "../../components/ui";
import type { Candidate } from "../../types";

const GENDERS = ["Male", "Female", "Other"];
const STATUSES = ["Current Student", "Alumni"];
const LEVELS = ["Fresher", "Experienced"];

interface FormState {
  full_name: string;
  phone: string;
  gender: string;
  date_of_birth_or_age: string;
  education_level: string;
  primary_trade: string;
  passing_year: string;
  current_status: string;
  preferred_job_role: string;
  city: string;
  state: string;
  willing_to_relocate: boolean;
  experience_level: string;
  experience_years: string;
  remarks: string;
  email: string;
  pincode: string;
  expected_salary: string;
}

const INITIAL: FormState = {
  full_name: "",
  phone: "",
  gender: "",
  date_of_birth_or_age: "",
  education_level: "",
  primary_trade: "",
  passing_year: "",
  current_status: "",
  preferred_job_role: "",
  city: "",
  state: "",
  willing_to_relocate: false,
  experience_level: "",
  experience_years: "",
  remarks: "",
  email: "",
  pincode: "",
  expected_salary: "",
};

export default function InstitutionCandidateForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Candidate | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name || !form.phone || !form.primary_trade) {
      setError("Student Name, Mobile Number and Course / Trade / Specialization are required.");
      return;
    }
    setBusy(true);
    setError("");
    setSaved(null);

    const payload: any = {
      full_name: form.full_name.trim(),
      phone: form.phone.replace(/\D/g, ""),
      primary_trade: form.primary_trade.trim(),
      gender: form.gender || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      pincode: form.pincode.trim() || undefined,
      email: form.email.trim() || undefined,
      education_level: form.education_level.trim() || undefined,
      experience_years: form.experience_years ? parseInt(form.experience_years, 10) : undefined,
      expected_salary: form.expected_salary ? parseInt(form.expected_salary, 10) : undefined,
      willing_to_relocate: form.willing_to_relocate,
      profile_data: {},
    };

    if (form.date_of_birth_or_age.trim()) payload.profile_data.date_of_birth_or_age = form.date_of_birth_or_age.trim();
    if (form.passing_year.trim()) payload.profile_data.passing_year = form.passing_year.trim();
    if (form.current_status.trim()) payload.profile_data.current_status = form.current_status.trim();
    if (form.preferred_job_role.trim()) payload.profile_data.preferred_job_role = form.preferred_job_role.trim();
    if (form.experience_level.trim()) payload.profile_data.experience_level = form.experience_level.trim();
    if (form.remarks.trim()) payload.profile_data.remarks = form.remarks.trim();

    if (Object.keys(payload.profile_data).length === 0) delete payload.profile_data;

    try {
      const { data } = await api.post<Candidate>("/institutions/me/candidates", payload);
      setSaved(data);
      setForm(INITIAL);
    } catch (err: any) {
      setError(err.response?.data?.detail?.[0]?.msg ?? err.response?.data?.detail ?? "Failed to save candidate.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHead
        title="Add Candidate"
        breadcrumb="Institution Portal › Add Candidate"
      />
      <div className="card">
        <div className="card-head">Candidate Details</div>
        <form className="card-body" onSubmit={submit}>
          {error && <div className="error-note">{error}</div>}
          {saved && (
            <div className="success-note">
              Saved <strong>{saved.full_name}</strong> successfully.
            </div>
          )}
          <div className="form-grid">
            <div className="field required">
              <label>Student Name</label>
              <input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
            </div>
            <div className="field required">
              <label>Mobile Number</label>
              <input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div className="field required">
              <label>Course / Trade / Specialization</label>
              <input value={form.primary_trade} onChange={(e) => update("primary_trade", e.target.value)} />
            </div>
            <div className="field">
              <label>Gender</label>
              <select value={form.gender} onChange={(e) => update("gender", e.target.value)}>
                <option value="">Select</option>
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Date of Birth / Age</label>
              <input value={form.date_of_birth_or_age} onChange={(e) => update("date_of_birth_or_age", e.target.value)} />
            </div>
            <div className="field">
              <label>Qualification</label>
              <input value={form.education_level} onChange={(e) => update("education_level", e.target.value)} />
            </div>
            <div className="field">
              <label>Passing Year / Expected Passing Year</label>
              <input value={form.passing_year} onChange={(e) => update("passing_year", e.target.value)} />
            </div>
            <div className="field">
              <label>Current Status</label>
              <select value={form.current_status} onChange={(e) => update("current_status", e.target.value)}>
                <option value="">Select</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Preferred Job Role</label>
              <input value={form.preferred_job_role} onChange={(e) => update("preferred_job_role", e.target.value)} />
            </div>
            <div className="field">
              <label>District</label>
              <input value={form.city} onChange={(e) => update("city", e.target.value)} />
            </div>
            <div className="field">
              <label>State</label>
              <input value={form.state} onChange={(e) => update("state", e.target.value)} />
            </div>
            <div className="field">
              <label>Pincode</label>
              <input value={form.pincode} onChange={(e) => update("pincode", e.target.value)} />
            </div>
            <div className="field">
              <label>Fresher / Experienced</label>
              <select value={form.experience_level} onChange={(e) => update("experience_level", e.target.value)}>
                <option value="">Select</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Experience (Years)</label>
              <input type="number" value={form.experience_years} onChange={(e) => update("experience_years", e.target.value)} />
            </div>
            <div className="field">
              <label>Expected Salary (INR/month)</label>
              <input type="number" value={form.expected_salary} onChange={(e) => update("expected_salary", e.target.value)} />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div className="field span-2">
              <label>
                <input type="checkbox" checked={form.willing_to_relocate} onChange={(e) => update("willing_to_relocate", e.target.checked)} />
                Willing to Relocate
              </label>
            </div>
            <div className="field span-2">
              <label>Remarks / Special Skills</label>
              <textarea rows={3} value={form.remarks} onChange={(e) => update("remarks", e.target.value)} />
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save Candidate"}
            </button>
            <button className="btn" type="button" onClick={() => navigate("/institution/candidates")}>
              View My Candidates
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
