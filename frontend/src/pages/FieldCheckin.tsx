import { useEffect, useState } from "react";
import api from "../api/client";
import { PageHead } from "../components/ui";

interface LocationLog {
  id: number;
  field_agent_id: number;
  field_agent_name?: string | null;
  employee_id?: string | null;
  event_type: string;
  latitude: number;
  longitude: number;
  location_name?: string | null;
  city?: string | null;
  address_text?: string | null;
  created_at?: string | null;
}

const REFRESH_MS = 60 * 1000; // refresh every minute

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

export default function FieldCheckin() {
  const [logs, setLogs] = useState<LocationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function refresh() {
    try {
      const res = await api.get<LocationLog[]>("/field-agents/location", {
        params: { limit: 500 },
      });
      setLogs(res.data);
      setErr("");
    } catch {
      setErr("Unable to load GPS log.");
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
        title="Field Agent GPS Log"
        breadcrumb="Field Operations › Field Check-in"
      />

      <div className="card">
        <div
          className="card-head"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>Live GPS Log</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Auto-captured every 30 minutes from all active field agents signed
              into the portal.
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
                <th>Field Agent Name</th>
                <th>Employee ID</th>
                <th>GPS Location Name</th>
                <th>City</th>
                <th>Time Stamp</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>
                    Loading…
                  </td>
                </tr>
              )}
              {!loading &&
                logs.map((l) => (
                  <tr key={l.id}>
                    <td>{l.field_agent_name || `Agent #${l.field_agent_id}`}</td>
                    <td>{l.employee_id || `EMP-${String(l.field_agent_id).padStart(4, "0")}`}</td>
                    <td>
                      {l.location_name ||
                        l.address_text || (
                          <span className="muted">
                            {l.latitude.toFixed(5)}, {l.longitude.toFixed(5)}
                          </span>
                        )}
                    </td>
                    <td>{l.city || "—"}</td>
                    <td>{formatTime(l.created_at)}</td>
                    <td>{formatDate(l.created_at)}</td>
                  </tr>
                ))}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>
                    No GPS log entries yet.
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
