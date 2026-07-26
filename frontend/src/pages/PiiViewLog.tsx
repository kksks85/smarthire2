import { useEffect, useState } from "react";
import api from "../api/client";
import { PageHead } from "../components/ui";

interface PiiViewRow {
  id: number;
  user_id: number;
  user_name?: string | null;
  user_email?: string | null;
  user_role?: string | null;
  candidate_id: number;
  candidate_name?: string | null;
  candidate_code?: string | null;
  fields_revealed: string;
  ip_address?: string | null;
  created_at: string;
}

const REFRESH_MS = 60 * 1000;

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

function roleLabel(r?: string | null): string {
  if (!r) return "—";
  const map: Record<string, string> = {
    admin: "Administrator",
    manager: "Recruiting Manager",
    recruiter: "Recruiter",
    institution: "Institution",
    employer: "Employer",
    field_agent: "Field Agent",
  };
  return map[r] || r;
}

export default function PiiViewLog() {
  const [rows, setRows] = useState<PiiViewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function refresh() {
    try {
      const res = await api.get<PiiViewRow[]>("/admin/pii-view-log", {
        params: { limit: 500 },
      });
      setRows(res.data);
      setErr("");
    } catch {
      setErr("Unable to load PII view log.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div>
      <PageHead
        title="PII View Log"
        breadcrumb="Field Operations › PII View Log"
      />

      <div className="card">
        <div
          className="card-head"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>Candidate PII Reveal Audit</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Every time a user reveals a candidate's phone number (or other PII),
              the action is captured here with the user, candidate, and exact
              timestamp — to keep candidate data safe and accountable.
            </div>
          </div>
          <button className="btn" onClick={refresh}>
            ↻ Refresh
          </button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {err && (
            <div className="error-note" style={{ margin: 12 }}>
              {err}
            </div>
          )}
          <table className="sn-table">
            <thead>
              <tr>
                <th>User Name</th>
                <th>Role</th>
                <th>Candidate</th>
                <th>Candidate ID</th>
                <th>Fields Revealed</th>
                <th>IP Address</th>
                <th>Time</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="muted" style={{ textAlign: "center", padding: 20 }}>
                    Loading…
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div>{r.user_name || `User #${r.user_id}`}</div>
                      {r.user_email && (
                        <div className="muted" style={{ fontSize: 11 }}>
                          {r.user_email}
                        </div>
                      )}
                    </td>
                    <td>{roleLabel(r.user_role)}</td>
                    <td>{r.candidate_name || "—"}</td>
                    <td>{r.candidate_code || `#${r.candidate_id}`}</td>
                    <td>{r.fields_revealed.replace(/,/g, ", ")}</td>
                    <td>{r.ip_address || "—"}</td>
                    <td>{fmtTime(r.created_at)}</td>
                    <td>{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted" style={{ textAlign: "center", padding: 20 }}>
                    No PII reveals have been logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
