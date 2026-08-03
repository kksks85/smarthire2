import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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
  documents_required?: { documents?: string[] } | null;
  employer?: string | null;
}

export default function PublicApply() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({});
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

  const handleFileChange = (docType: string, file?: File) => {
    if (file) {
      setSelectedFiles((prev) => ({ ...prev, [docType]: file }));
    } else {
      setSelectedFiles((prev) => {
        const copy = { ...prev };
        delete copy[docType];
        return copy;
      });
    }
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    
    if (!form.full_name?.trim() || !form.phone?.trim() || !form.city?.trim()) {
      alert("mandatory fields should be filled");
      setErr("mandatory fields should be filled");
      return;
    }

    setBusy(true);
    try {
      const res = await axios.post("/api/v1/public/register", {
        ...form,
        experience_years: Number(form.experience_years) || 0,
        job_slug: slug,
        registration_channel: searchParams.get("source") || "website",
      });
      
      const candidateId = res.data.candidate_id;
      
      // Upload attached files if any
      const filesToUpload = Object.entries(selectedFiles);
      for (const [docType, file] of filesToUpload) {
        const formData = new FormData();
        formData.append("document_type", docType);
        formData.append("file", file);
        await axios.post(`/api/v1/public/register/${candidateId}/upload-document`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }
      
      setDone(true);
    } catch (error: any) {
      setErr(error?.response?.data?.detail ?? "Registration failed. Please verify your connection.");
    } finally {
      setBusy(false);
    }
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
              <strong>Employer:</strong> {job.employer || "LAYAM"}
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
              <label>Full Name *</label>
              <input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </div>
            <div className="field">
              <label>Phone *</label>
              <input required value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="field">
              <label>City *</label>
              <input required value={form.city} onChange={(e) => set("city", e.target.value)} />
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

            {/* Required Documents Section */}
            {job?.documents_required?.documents && job.documents_required.documents.length > 0 && (
              <div style={{ marginTop: 16, marginBottom: 16, borderTop: "1px solid #e0e0e0", paddingTop: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Required Documents</h3>
                <p className="muted" style={{ fontSize: 11, marginBottom: 12 }}>
                  Please attach files for the requested documents.
                </p>
                {job.documents_required.documents.map((doc) => {
                  return (
                    <div className="field" key={doc} style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 500 }}>
                        {doc}
                      </label>
                      <input
                        type="file"
                        onChange={(e) => handleFileChange(doc, e.target.files?.[0])}
                        style={{ marginTop: 4 }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <button className="btn primary" style={{ width: "100%", marginTop: 8 }} disabled={busy}>
              {busy ? "Registering..." : "Register"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
