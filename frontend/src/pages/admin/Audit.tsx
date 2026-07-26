import { useEffect, useState } from "react";
import api from "../../api/client";
import { PageHead } from "../../components/ui";

interface AuditRow {
  id: number;
  user_id?: number | null;
  action: string;
  entity_type?: string | null;
  entity_id?: number | null;
  detail?: string | null;
  ip_address?: string | null;
  created_at: string;
}

interface PiiRow {
  id: number;
  user_id: number;
  candidate_id: number;
  fields_revealed: string;
  ip_address?: string | null;
  created_at: string;
}

export default function Audit() {
  const [tab, setTab] = useState(0);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [pii, setPii] = useState<PiiRow[]>([]);

  useEffect(() => {
    api.get<AuditRow[]>("/admin/audit-logs").then((r) => setAudit(r.data));
    api.get<PiiRow[]>("/admin/pii-access-logs").then((r) => setPii(r.data));
  }, []);

  return (
    <div>
      <PageHead title="Audit & PII Access" breadcrumb="Administration › Audit / PII Access" />
      <div className="form-tabs">
        <div className={"form-tab" + (tab === 0 ? " active" : "")} onClick={() => setTab(0)}>
          PII Access Log
        </div>
        <div className={"form-tab" + (tab === 1 ? " active" : "")} onClick={() => setTab(1)}>
          System Audit
        </div>
      </div>

      {tab === 0 && (
        <table className="sn-table">
          <thead>
            <tr>
              <th>When</th>
              <th>User ID</th>
              <th>Candidate ID</th>
              <th>Fields Revealed</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {pii.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>#{r.user_id}</td>
                <td>#{r.candidate_id}</td>
                <td>{r.fields_revealed}</td>
                <td>{r.ip_address ?? "—"}</td>
              </tr>
            ))}
            {pii.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: "center", padding: 20 }}>
                  No PII access recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {tab === 1 && (
        <table className="sn-table">
          <thead>
            <tr>
              <th>When</th>
              <th>User ID</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Detail</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.user_id ? `#${r.user_id}` : "—"}</td>
                <td>{r.action}</td>
                <td>
                  {r.entity_type ? `${r.entity_type} #${r.entity_id ?? ""}` : "—"}
                </td>
                <td>{r.detail ?? "—"}</td>
                <td>{r.ip_address ?? "—"}</td>
              </tr>
            ))}
            {audit.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>
                  No audit entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
