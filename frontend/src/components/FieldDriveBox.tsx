import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { capturePosition } from "../hooks/useFieldAgentTracker";
import { Badge, Modal } from "./ui";
import type { DriveSetupType, FieldDrive, FieldDriveShareKit } from "../types";

const SETUP_OPTIONS: { value: DriveSetupType; label: string }[] = [
  { value: "canopy", label: "Canopy" },
  { value: "moving_van", label: "Moving Van" },
  { value: "table_desk", label: "Table / Desk" },
  { value: "tent", label: "Tent" },
  { value: "kiosk", label: "Kiosk" },
  { value: "other", label: "Other" },
];

interface FormState {
  title: string;
  venue_name: string;
  setup_type: DriveSetupType;
  setup_type_other: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: string;
  longitude: string;
  start_date: string;
  end_date: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  venue_name: "",
  setup_type: "canopy",
  setup_type_other: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  latitude: "",
  longitude: "",
  start_date: "",
  end_date: "",
  notes: "",
};

function setupLabel(d: FieldDrive): string {
  if (d.setup_type === "other" && d.setup_type_other) return d.setup_type_other;
  return SETUP_OPTIONS.find((o) => o.value === d.setup_type)?.label || d.setup_type;
}

/**
 * Professional "Registration Drives" box for the field agent homepage.
 *
 * Lets a field agent record the physical camp/drive they've set up (college,
 * residential complex, industrial park, ...), the kind of temporary setup
 * (canopy, moving van, tent, ...), and then generate a shareable QR code /
 * link so candidates can self-register on the spot — automatically tagged
 * with source = field_agent and linked back to this drive.
 */
export default function FieldDriveBox() {
  const navigate = useNavigate();
  const [drives, setDrives] = useState<FieldDrive[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState("");
  const [shareKit, setShareKit] = useState<FieldDriveShareKit | null>(null);
  const [shareDriveName, setShareDriveName] = useState("");
  const [copied, setCopied] = useState(false);

  async function refresh() {
    try {
      const res = await api.get<FieldDrive[]>("/field-drives");
      setDrives(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function upd<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function openNew() {
    setForm(EMPTY_FORM);
    setErr("");
    setShowForm(true);
  }

  async function captureGps() {
    setLocating(true);
    setErr("");
    try {
      const pos = await capturePosition();
      upd("latitude", pos.coords.latitude.toFixed(6));
      upd("longitude", pos.coords.longitude.toFixed(6));
    } catch {
      setErr("Unable to capture GPS location. Please allow location access.");
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    if (!form.title || !form.venue_name) {
      setErr("Title and venue/building name are required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await api.post("/field-drives", {
        title: form.title,
        venue_name: form.venue_name,
        setup_type: form.setup_type,
        setup_type_other: form.setup_type === "other" ? form.setup_type_other || null : null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        pincode: form.pincode || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
      });
      setShowForm(false);
      await refresh();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Could not create drive.");
    } finally {
      setSaving(false);
    }
  }

  async function generateLink(d: FieldDrive) {
    const res = await api.post<FieldDriveShareKit>(`/field-drives/${d.id}/generate-link`);
    setShareKit(res.data);
    setShareDriveName(d.venue_name);
    setCopied(false);
    await refresh();
  }

  async function closeDrive(d: FieldDrive) {
    if (!confirm(`Close registration drive "${d.title}"? The QR/link will stop accepting new registrations.`))
      return;
    await api.put(`/field-drives/${d.id}`, { status: "closed" });
    await refresh();
  }

  async function removeDrive(d: FieldDrive) {
    if (!confirm(`Delete drive "${d.title}"? This cannot be undone.`)) return;
    await api.delete(`/field-drives/${d.id}`);
    await refresh();
  }

  function copyLink() {
    if (!shareKit) return;
    navigator.clipboard.writeText(shareKit.registration_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="drive-box">
      <div className="drive-box-head">
        <div>
          <div className="drive-box-title">📍 Registration Drives</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Set up a camp at a college, residential complex, industrial park, etc.
            and generate a QR code / link for on-the-spot candidate registration.
          </div>
        </div>
        <button className="btn primary" onClick={openNew}>
          + New Drive
        </button>
      </div>

      <div className="drive-box-body">
        {loading && <div className="muted">Loading…</div>}
        {!loading && drives.length === 0 && (
          <div className="muted">
            No registration drives yet. Click <strong>+ New Drive</strong> to set one up.
          </div>
        )}
        {!loading &&
          drives.map((d) => (
            <div className="drive-card" key={d.id}>
              <div className="drive-card-top">
                <div>
                  <div className="drive-card-title">{d.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {d.venue_name}
                    {(d.city || d.state) && (
                      <> · {[d.city, d.state].filter(Boolean).join(", ")}</>
                    )}
                  </div>
                </div>
                <Badge value={d.status} />
              </div>
              <div className="drive-card-meta">
                <span>🏕 {setupLabel(d)}</span>
                <span>👥 {d.candidate_count} registered</span>
              </div>
              {d.address && (
                <div className="muted" style={{ fontSize: 11 }}>
                  {d.address}
                </div>
              )}
              <div className="btn-row" style={{ marginTop: 8 }}>
                {d.status === "active" && (
                  <button
                    className="btn primary"
                    onClick={() => navigate(`/candidates/new?driveId=${d.id}`)}
                  >
                    + Register Candidate
                  </button>
                )}
                <button className="btn" onClick={() => generateLink(d)}>
                  {d.public_slug ? "View QR & Link" : "Generate QR & Link"}
                </button>
                {d.status === "active" && (
                  <button className="btn" onClick={() => closeDrive(d)}>
                    Close Drive
                  </button>
                )}
                <button className="btn link" onClick={() => removeDrive(d)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
      </div>

      {showForm && (
        <Modal title="New Registration Drive" onClose={() => setShowForm(false)}>
          <div className="form-grid">
            {err && <div className="error-note">{err}</div>}
            <div className="field">
              <label>Drive Title *</label>
              <input
                value={form.title}
                onChange={(e) => upd("title", e.target.value)}
                placeholder="e.g. ABC Engineering College Drive"
              />
            </div>
            <div className="field">
              <label>Building / Venue Name *</label>
              <input
                value={form.venue_name}
                onChange={(e) => upd("venue_name", e.target.value)}
                placeholder="e.g. ABC Engineering College, Main Gate"
              />
            </div>
            <div className="field">
              <label>Setup Type</label>
              <select
                value={form.setup_type}
                onChange={(e) => upd("setup_type", e.target.value as DriveSetupType)}
              >
                {SETUP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {form.setup_type === "other" && (
              <div className="field">
                <label>Describe setup</label>
                <input
                  value={form.setup_type_other}
                  onChange={(e) => upd("setup_type_other", e.target.value)}
                  placeholder="e.g. Pop-up desk in cafeteria"
                />
              </div>
            )}
            <div className="field">
              <label>Address</label>
              <textarea
                rows={2}
                value={form.address}
                onChange={(e) => upd("address", e.target.value)}
              />
            </div>
            <div className="field">
              <label>City</label>
              <input value={form.city} onChange={(e) => upd("city", e.target.value)} />
            </div>
            <div className="field">
              <label>State</label>
              <input value={form.state} onChange={(e) => upd("state", e.target.value)} />
            </div>
            <div className="field">
              <label>Pincode</label>
              <input value={form.pincode} onChange={(e) => upd("pincode", e.target.value)} />
            </div>
            <div className="field">
              <label>GPS Coordinates</label>
              <div className="btn-row">
                <input value={form.latitude} placeholder="Latitude" readOnly style={{ flex: 1 }} />
                <input value={form.longitude} placeholder="Longitude" readOnly style={{ flex: 1 }} />
                <button className="btn" type="button" onClick={captureGps} disabled={locating}>
                  {locating ? "Locating…" : "📍 Capture"}
                </button>
              </div>
            </div>
            <div className="field">
              <label>Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => upd("start_date", e.target.value)}
              />
            </div>
            <div className="field">
              <label>End Date (optional)</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => upd("end_date", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => upd("notes", e.target.value)}
              />
            </div>
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button className="btn primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Create Drive"}
              </button>
              <button className="btn" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {shareKit && (
        <Modal title="Share Registration Kit" onClose={() => setShareKit(null)}>
          <div className="success-note">
            Share this QR code or link with candidates at <strong>{shareDriveName}</strong>.
            Anyone who registers through it is automatically recorded with source
            "Field Agent" and linked to this drive.
          </div>
          <div className="qr-box">
            <img src={shareKit.qr_data_uri} alt="Registration QR code" />
            <p className="muted">Candidates scan to self-register</p>
          </div>
          <label className="muted">Registration link</label>
          <div className="copy-field">
            <input readOnly value={shareKit.registration_url} />
            <button className="btn" onClick={copyLink}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <a
              className="btn primary"
              href={shareKit.whatsapp_share_url}
              target="_blank"
              rel="noreferrer"
            >
              💬 Share on WhatsApp
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}
