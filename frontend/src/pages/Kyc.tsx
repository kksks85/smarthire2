import { useEffect, useRef, useState } from "react";
import api from "../api/client";
import { useReference } from "../hooks/useReference";
import { Badge, PageHead } from "../components/ui";
import type { Candidate } from "../types";

interface KycDoc {
  id: number;
  candidate_id: number;
  document_type: string;
  original_filename?: string | null;
  status: string;
  rejection_reason?: string | null;
  download_url?: string | null;
}

export default function Kyc() {
  const ref = useReference();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<number | "">("");
  const [docs, setDocs] = useState<KycDoc[]>([]);
  const [docType, setDocType] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<{ items: Candidate[] }>("/candidates", {
        params: { status: "in_process", limit: 200 },
      })
      .then((r) => setCandidates(r.data.items));
  }, []);

  function loadDocs(id: number) {
    api.get<KycDoc[]>(`/kyc/candidate/${id}`).then((r) => setDocs(r.data));
  }

  useEffect(() => {
    if (selected) loadDocs(Number(selected));
  }, [selected]);

  async function upload() {
    if (!selected || !docType || !fileRef.current?.files?.[0]) {
      setMsg("Select candidate, document type, and file.");
      return;
    }
    const fd = new FormData();
    fd.append("document_type", docType);
    fd.append("file", fileRef.current.files[0]);
    await api.post(`/kyc/candidate/${selected}`, fd);
    setMsg("Document uploaded.");
    if (fileRef.current) fileRef.current.value = "";
    loadDocs(Number(selected));
  }

  async function verify(doc: KycDoc, status: string) {
    let reason: string | undefined;
    if (status === "rejected") {
      reason = window.prompt("Rejection reason?") ?? "";
    }
    await api.post(`/kyc/${doc.id}/verify`, { status, rejection_reason: reason });
    loadDocs(doc.candidate_id);
  }

  return (
    <div>
      <PageHead title="KYC Verification" breadcrumb="Recruitment › KYC Verification" />
      {msg && <div className="success-note">{msg}</div>}

      <div className="list-toolbar">
        <label className="muted">Candidate:</label>
        <select value={selected} onChange={(e) => setSelected(Number(e.target.value) || "")}>
          <option value="">Select candidate in process…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name} — {c.primary_trade ?? "—"}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">Upload Document</div>
            <div className="card-body">
              <div className="btn-row" style={{ alignItems: "center" }}>
                <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                  <option value="">Document type…</option>
                  {ref?.kyc_document_types.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <input type="file" ref={fileRef} />
                <button className="btn primary" onClick={upload}>
                  Upload
                </button>
              </div>
            </div>
          </div>

          <table className="sn-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>File</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>{d.document_type}</td>
                  <td>
                    {d.download_url ? (
                      <a href={d.download_url} target="_blank" rel="noreferrer">
                        {d.original_filename ?? "view"}
                      </a>
                    ) : (
                      d.original_filename ?? "—"
                    )}
                  </td>
                  <td>
                    <Badge value={d.status} />
                    {d.rejection_reason && (
                      <span className="muted"> — {d.rejection_reason}</span>
                    )}
                  </td>
                  <td>
                    {d.status === "submitted" && (
                      <div className="btn-row">
                        <button className="btn link" onClick={() => verify(d, "verified")}>
                          Verify
                        </button>
                        <button className="btn link" onClick={() => verify(d, "rejected")}>
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: "center", padding: 20 }}>
                    No documents uploaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
