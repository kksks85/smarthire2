import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useReference } from "../hooks/useReference";
import { Badge, Modal, PageHead } from "../components/ui";
import type { CampaignImportResult, Candidate, CandidatePii } from "../types";

export default function Candidates() {
  const ref = useReference();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [trade, setTrade] = useState(searchParams.get("trade") || "");
  const [state, setState] = useState(searchParams.get("state") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [offset, setOffset] = useState(parseInt(searchParams.get("offset") || "0", 10));
  const [reveal, setReveal] = useState<{ c: Candidate; pii: CandidatePii } | null>(
    null
  );
  const [showCampaignImport, setShowCampaignImport] = useState(false);
  const limit = 50;
  const [campaignResult, setCampaignResult] = useState<CampaignImportResult | null>(null);
  const [campaignError, setCampaignError] = useState("");
  const [campaignBusy, setCampaignBusy] = useState(false);
  const campaignFileRef = useRef<HTMLInputElement>(null);

  function load() {
    const params: Record<string, string> = { limit: String(limit), offset: String(offset) };
    if (q) params.q = q;
    if (trade) params.trade = trade;
    if (state) params.state = state;
    if (status) params.status = status;
    api
      .get<{ total: number; items: Candidate[] }>("/candidates", { params })
      .then((r) => {
        setItems(r.data.items);
        setTotal(r.data.total);
      });
  }

  // Keep URL in sync so the filter state is shareable / bookmarkable.
  useEffect(() => {
    const next: Record<string, string> = {};
    if (q) next.q = q;
    if (trade) next.trade = trade;
    if (state) next.state = state;
    if (status) next.status = status;
    if (offset > 0) next.offset = String(offset);
    setSearchParams(next, { replace: true });
  }, [q, trade, state, status, offset]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, trade, state, status, offset]);

  // Reset to first page when filters change.
  useEffect(() => {
    setOffset(0);
  }, [q, trade, state, status]);

  async function doReveal(c: Candidate) {
    const { data } = await api.post<CandidatePii>(`/candidates/${c.id}/reveal`);
    setReveal({ c, pii: data });
  }

  async function importCampaign() {
    const file = campaignFileRef.current?.files?.[0];
    if (!file) {
      setCampaignError("Select an Excel workbook to import.");
      return;
    }
    setCampaignBusy(true);
    setCampaignError("");
    setCampaignResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post<CampaignImportResult>(
        "/candidates/import-facebook-campaign",
        formData
      );
      setCampaignResult(data);
      load();
    } catch (error: any) {
      setCampaignError(error.response?.data?.detail ?? "Campaign import failed.");
    } finally {
      setCampaignBusy(false);
    }
  }

  async function downloadTemplate() {
    try {
      const response = await api.get("/candidates/facebook-campaign-template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "facebook_campaign_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert("Failed to download template.");
    }
  }

  return (
    <div>
      <PageHead
        title="Candidate Data Bank"
        breadcrumb="Candidate Data Bank › All Candidates"
        actions={
          <div className="btn-row">
            <button
              className="btn"
              onClick={() => {
                setCampaignError("");
                setCampaignResult(null);
                setShowCampaignImport(true);
              }}
            >
              Import Facebook Campaign
            </button>
            <button className="btn primary" onClick={() => navigate("/candidates/new")}>
              + Register Candidate
            </button>
          </div>
        }
      />

      <div className="inline-note">
        Phone numbers and personal details are masked by default. Selecting
        <strong> Reveal </strong> is recorded in the PII access audit log against your user.
      </div>

      <div className="list-toolbar">
        <input
          placeholder="Search name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={trade} onChange={(e) => setTrade(e.target.value)}>
          <option value="">All Trades</option>
          {ref?.job_categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">All States</option>
          {ref?.states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {["new", "screened", "shortlisted", "in_process", "placed", "rejected"].map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            )
          )}
        </select>
        <div className="spacer" />
        <span className="muted">{Math.min(total, offset + items.length)} of {total} records</span>
      </div>

      <table className="sn-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Trade</th>
            <th>Exp (yrs)</th>
            <th>City / State</th>
            <th>Phone</th>
            <th>Source</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td
                className="row-link"
                onClick={() => navigate(`/candidates/${c.id}`)}
              >
                {c.full_name}
              </td>
              <td>{c.primary_trade ?? "—"}</td>
              <td>{c.experience_years ?? 0}</td>
              <td>
                {[c.city, c.state].filter(Boolean).join(", ") || "—"}
              </td>
              <td className="pii">{c.phone}</td>
              <td>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <Badge value={c.source} />
                  {c.profile_data?.registration_channel && (
                    <span style={{ fontSize: "11px", color: "#5c6b73", fontWeight: 500 }}>
                      ({c.profile_data.registration_channel.charAt(0).toUpperCase() + c.profile_data.registration_channel.slice(1)})
                    </span>
                  )}
                </div>
              </td>
              <td>
                <Badge value={c.status} />
              </td>
              <td>
                <button className="btn link" onClick={() => doReveal(c)}>
                  Reveal
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={8} className="muted" style={{ textAlign: "center", padding: 20 }}>
                No candidates found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn"
          onClick={() => setOffset((o) => Math.max(0, o - limit))}
          disabled={offset === 0}
        >
          Previous
        </button>
        <span className="muted">Page {Math.floor(offset / limit) + 1}</span>
        <button
          className="btn"
          onClick={() => setOffset((o) => o + limit)}
          disabled={offset + limit >= total}
        >
          Next
        </button>
      </div>

      {reveal && (
        <Modal title={`PII — ${reveal.c.full_name}`} onClose={() => setReveal(null)}>
          <div className="inline-note">
            This reveal has been logged to the audit trail.
          </div>
          <div className="form-grid one-col" style={{ border: "none", padding: 0 }}>
            <div className="field">
              <label>Phone</label>
              <input readOnly value={reveal.pii.phone} />
            </div>
            <div className="field">
              <label>Email</label>
              <input readOnly value={reveal.pii.email ?? "—"} />
            </div>
            <div className="field">
              <label>Address</label>
              <textarea readOnly value={reveal.pii.address ?? "—"} rows={2} />
            </div>
          </div>
        </Modal>
      )}

      {showCampaignImport && (
        <Modal title="Import Facebook Campaign Candidates" onClose={() => setShowCampaignImport(false)}>
          <div className="inline-note">
            Upload an .xlsx file with Name, Phone, and Question 1 / Answer 1 through
            Question 5 / Answer 5. Existing phone numbers update only their Custom Questions.
          </div>
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn" onClick={downloadTemplate}>
              📥 Download Excel Template
            </button>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Excel workbook (.xlsx)</label>
            <input ref={campaignFileRef} type="file" accept=".xlsx,.xlsm" />
          </div>
          {campaignError && <div className="error-note" style={{ marginTop: 12 }}>{campaignError}</div>}
          {campaignResult && (
            <div className="success-note" style={{ marginTop: 12 }}>
              Created {campaignResult.created}, updated {campaignResult.updated}, skipped {campaignResult.skipped}.
              {campaignResult.errors.length > 0 && (
                <ul>
                  {campaignResult.errors.slice(0, 5).map((error, index) => <li key={index}>{error}</li>)}
                </ul>
              )}
            </div>
          )}
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={importCampaign} disabled={campaignBusy}>
              {campaignBusy ? "Importing..." : "Import"}
            </button>
            <button className="btn" onClick={() => setShowCampaignImport(false)} disabled={campaignBusy}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
