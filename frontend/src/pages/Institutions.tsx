import { useEffect, useRef, useState } from "react";
import api from "../api/client";
import { useReference } from "../hooks/useReference";
import { Modal, PageHead } from "../components/ui";
import type { Institution } from "../types";

export default function Institutions() {
  const ref = useReference();
  const [items, setItems] = useState<Institution[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({ name: "" });
  const [uploadFor, setUploadFor] = useState<Institution | null>(null);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const load = () => api.get<Institution[]>("/institutions").then((r) => setItems(r.data));
  useEffect(() => {
    load();
  }, []);

  async function save() {
    await api.post("/institutions", form);
    setOpen(false);
    setForm({ name: "" });
    load();
  }

  async function upload() {
    if (!uploadFor || !fileRef.current?.files?.[0]) return;
    const fd = new FormData();
    fd.append("file", fileRef.current.files[0]);
    const { data } = await api.post(
      `/institutions/${uploadFor.id}/upload-candidates`,
      fd
    );
    setResult(data);
  }

  return (
    <div>
      <PageHead
        title="Institutions"
        breadcrumb="Partners › Institutions"
        actions={
          <button className="btn primary" onClick={() => setOpen(true)}>
            + New Institution
          </button>
        }
      />
      <div className="inline-note">
        Institutions can bulk-load candidates via Excel (.xlsx). Columns: Name, Phone,
        Email, Trade, City, State, Experience, Education, Certification.
      </div>
      <table className="sn-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>City / State</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>{i.name}</td>
              <td>{i.contact_person ?? "—"}</td>
              <td>{[i.city, i.state].filter(Boolean).join(", ") || "—"}</td>
              <td>
                <button
                  className="btn link"
                  onClick={() => {
                    setUploadFor(i);
                    setResult(null);
                  }}
                >
                  Upload Candidates
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={4} className="muted" style={{ textAlign: "center", padding: 20 }}>
                No institutions yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {open && (
        <Modal title="New Institution" onClose={() => setOpen(false)}>
          <div className="form-grid" style={{ border: "none", padding: 0 }}>
            <div className="field full">
              <label>Name<span className="req">*</span></label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="field">
              <label>Contact Person</label>
              <input value={form.contact_person ?? ""} onChange={(e) => set("contact_person", e.target.value)} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="field">
              <label>City</label>
              <input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="field">
              <label>State</label>
              <select value={form.state ?? ""} onChange={(e) => set("state", e.target.value)}>
                <option value="">Select…</option>
                {ref?.states.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={save} disabled={!form.name}>
              Save
            </button>
            <button className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {uploadFor && (
        <Modal
          title={`Upload Candidates — ${uploadFor.name}`}
          onClose={() => setUploadFor(null)}
        >
          <div className="field">
            <label>Excel file (.xlsx)</label>
            <input type="file" ref={fileRef} accept=".xlsx,.xlsm" />
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={upload}>
              Upload
            </button>
          </div>
          {result && (
            <div className="success-note" style={{ marginTop: 12 }}>
              Created {result.created}, skipped {result.skipped}.
              {result.errors?.length > 0 && (
                <ul>
                  {result.errors.slice(0, 5).map((e: string, i: number) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
