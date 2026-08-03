import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

interface PublicDrive {
  title: string;
  venue_name: string;
  setup_type: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  field_agent_name?: string | null;
  slug: string;
}

const SETUP_LABELS: Record<string, string> = {
  canopy: "Canopy",
  moving_van: "Moving Van",
  table_desk: "Table / Desk",
  tent: "Tent",
  kiosk: "Kiosk",
  other: "Registration Point",
};

export default function PublicDriveApply() {
  const { slug } = useParams();
  const [drive, setDrive] = useState<PublicDrive | null>(null);
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
      .get<PublicDrive>(`/api/v1/public/drives/${slug}`)
      .then((r) => {
        setDrive(r.data);
        set("city", r.data.city || "");
        set("state", r.data.state || "");
      })
      .catch(() => setErr("This registration drive is not available or has closed."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name?.trim() || !form.phone?.trim() || !form.city?.trim()) {
      alert("mandatory fields should be filled");
      setErr("mandatory fields should be filled");
      return;
    }
    await axios.post("/api/v1/public/register", {
      ...form,
      experience_years: Number(form.experience_years) || 0,
      drive_slug: slug,
    });
    setDone(true);
  }

  return (
    <div className="login-wrap" style={{ alignItems: "flex-start", padding: "40px 16px" }}>
      <div className="login-card" style={{ width: 460 }}>
        <h1>SmartHire Careers</h1>
        {err && <div className="error-note">{err}</div>}
        {drive && (
          <p className="sub">
            Registering at <strong>{drive.venue_name}</strong>
            <br />
            {SETUP_LABELS[drive.setup_type] || drive.setup_type}
            {(drive.city || drive.state) && (
              <> · {[drive.city, drive.state].filter(Boolean).join(", ")}</>
            )}
            {drive.field_agent_name && (
              <>
                <br />
                Hosted by {drive.field_agent_name}
              </>
            )}
          </p>
        )}

        {done ? (
          <div className="success-note">
            Thank you! Your registration has been received. Our team will contact you shortly.
          </div>
        ) : (
          drive && (
            <form onSubmit={submit}>
              <div className="field">
                <label>Full Name *</label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                />
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
                <input
                  value={form.primary_trade}
                  onChange={(e) => set("primary_trade", e.target.value)}
                />
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
          )
        )}
      </div>
    </div>
  );
}
