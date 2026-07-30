import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/client";
import { Badge, PageHead } from "../../components/ui";
import type { Candidate } from "../../types";

export default function InstitutionCandidates() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Candidate[]>([]);
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");

  function load() {
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (status) params.status = status;
    api.get<Candidate[]>("/institutions/me/candidates", { params }).then((r) => setItems(r.data));
  }

  useEffect(() => {
    const next: Record<string, string> = {};
    if (q) next.q = q;
    if (status) next.status = status;
    setSearchParams(next, { replace: true });
    load();
  }, [q, status]);

  return (
    <div>
      <PageHead
        title="My Candidates"
        breadcrumb="Institution Portal › My Candidates"
      />
      <div className="list-toolbar">
        <input placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {["new", "screened", "shortlisted", "in_process", "placed", "rejected"].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <div className="spacer" />
        <span className="muted">{items.length} candidates</span>
      </div>
      <table className="sn-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Trade</th>
            <th>Phone</th>
            <th>City / State</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>{c.full_name}</td>
              <td>{c.primary_trade ?? "—"}</td>
              <td className="pii">{c.phone ?? "—"}</td>
              <td>{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
              <td><Badge value={c.status} /></td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="muted" style={{ textAlign: "center", padding: 20 }}>
                No candidates found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
