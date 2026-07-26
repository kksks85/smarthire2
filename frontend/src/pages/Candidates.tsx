import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useReference } from "../hooks/useReference";
import { Badge, Modal, PageHead } from "../components/ui";
import type { Candidate, CandidatePii } from "../types";

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
  const [reveal, setReveal] = useState<{ c: Candidate; pii: CandidatePii } | null>(
    null
  );

  function load() {
    const params: Record<string, string> = {};
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
    setSearchParams(next, { replace: true });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, trade, state, status]);

  async function doReveal(c: Candidate) {
    const { data } = await api.post<CandidatePii>(`/candidates/${c.id}/reveal`);
    setReveal({ c, pii: data });
  }

  return (
    <div>
      <PageHead
        title="Candidate Data Bank"
        breadcrumb="Candidate Data Bank › All Candidates"
        actions={
          <button className="btn primary" onClick={() => navigate("/candidates/new")}>
            + Register Candidate
          </button>
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
        <span className="muted">{total} records</span>
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
                <Badge value={c.source} />
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
    </div>
  );
}
