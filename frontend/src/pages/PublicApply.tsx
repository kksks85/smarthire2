import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

interface PublicJob {
  title: string;
  category: string;
  description?: string | null;
  employment_type?: string | null;
  shift_type?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  work_city?: string | null;
  work_state?: string | null;
  accommodation_provided: boolean;
  slug: string;
}

export default function PublicApply() {
  const { slug } = useParams();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState<Record<string, any>>({
    full_name: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    primary_trade: "",
    experience_years: 0,
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    axios
      .get<PublicJob>(`/api/v1/public/jobs/${slug}`)
      .then((r) => setJob(r.data))
      .catch(() => setErr("This job posting is not available."));
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await axios.post("/api/v1/public/register", {
      ...form,
      experience_years: Number(form.experience_years) || 0,
      job_slug: slug,
    });
    setDone(true);
  }

  return (
    <div className="login-wrap" style={{ alignItems: "flex-start", padding: "40px 16px" }}>
      <div className="login-card" style={{ width: 460 }}>
        <h1>SmartHire Careers</h1>
        {err && <div className="error-note">{err}</div>}
        {job && (
          <>
            <p className="sub">
              <strong>{job.title}</strong> — {job.category}
              <br />
              {[job.work_city, job.work_state].filter(Boolean).join(", ")}
              {job.salary_min || job.salary_max
                ? ` · ₹${job.salary_min ?? "?"}–${job.salary_max ?? "?"}/mo`
                : ""}
            </p>
            {job.description && (
              <p style={{ fontSize: 12, color: "#5c6b73" }}>{job.description}</p>
            )}
          </>
        )}

        {done ? (
          <div className="success-note">
            Thank you! Your registration has been received. Our team will contact you shortly.
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>Full Name</label>
              <input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input required value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="field">
              <label>City</label>
              <input value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="field">
              <label>Trade / Skill</label>
              <input value={form.primary_trade} onChange={(e) => set("primary_trade", e.target.value)} />
            </div>
            <div className="field">
              <label>Experience (years)</label>
              <input
                type="number"
                min={0}
                value={form.experience_years}
                onChange={(e) => set("experience_years", e.target.value)}
              />
            </div>
            <button className="btn primary" style={{ width: "100%", marginTop: 8 }}>
              Register
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
