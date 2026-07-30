import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { PageHead } from "../../components/ui";
import type { Dashboard, InstitutionUploadLog } from "../../types";

const KPI_DETAILS: Record<string, { group: string; description: string; tone: string }> = {
  "Total Candidates Uploaded": { group: "Talent shared", description: "Students uploaded to Layam Group", tone: "teal" },
  "Placed from Institute": { group: "Outcome", description: "Candidates successfully placed", tone: "green" },
  "In Process / Shortlisted": { group: "Pipeline", description: "Active in recruitment", tone: "blue" },
  "Awaiting Screening": { group: "Attention", description: "Yet to be contacted", tone: "amber" },
  "Recent Uploads": { group: "Activity", description: "Uploads this month", tone: "purple" },
  "Last Upload Status": { group: "Status", description: "Most recent upload outcome", tone: "slate" },
};

export default function InstitutionDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Dashboard | null>(null);
  const [logs, setLogs] = useState<InstitutionUploadLog[]>([]);

  useEffect(() => {
    api.get<Dashboard>("/dashboard").then((r) => setData(r.data));
    api.get<InstitutionUploadLog[]>("/institutions/me/upload-logs?limit=5").then((r) =>
      setLogs(r.data)
    );
  }, []);

  return (
    <div>
      <PageHead
        title={`Welcome, ${user?.full_name.split(" ")[0]}`}
        breadcrumb="Institution Portal › Dashboard"
        actions={
          <button className="btn primary" onClick={() => navigate("/institution/upload")}>
            + Upload Candidates
          </button>
        }
      />

      <div className="institution-welcome">
        <div>
          <h2>{user?.full_name}</h2>
          <p>Share your trained candidates with Layam Group and track their recruitment journey.</p>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginTop: 16 }}>
        {data?.cards.map((c) => {
          const clickable = !!c.link;
          const detail = KPI_DETAILS[c.label] ?? {
            group: "Overview",
            description: c.hint ?? "Current total",
            tone: "teal",
          };
          const className = `kpi kpi-${detail.tone}${clickable ? " clickable" : ""}`;
          return (
            <div
              className={className}
              key={c.label}
              onClick={clickable ? () => navigate(c.link as string) : undefined}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(c.link as string);
                      }
                    }
                  : undefined
              }
            >
              <div className="kpi-topline">
                <span className="kpi-group">{detail.group}</span>
                {clickable && <span className="kpi-arrow">View</span>}
              </div>
              <div className="kpi-value-row">
                <div className="value">{c.value.toLocaleString()}</div>
                <span className="kpi-marker" aria-hidden="true" />
              </div>
              <div className="label">{c.label}</div>
              <div className="hint">{c.hint ?? detail.description}</div>
            </div>
          );
        })}
        {!data && <div className="muted">Loading KPIs…</div>}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-head">Recent Uploads</div>
        <div className="card-body">
          {logs.length === 0 ? (
            <div className="muted">No uploads yet. Start by uploading your first batch of candidates.</div>
          ) : (
            <table className="sn-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Date</th>
                  <th>Created</th>
                  <th>Skipped</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.filename}</td>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.created_count}</td>
                    <td>{log.skipped_count}</td>
                    <td>
                      <span className={`badge ${log.status === "success" ? "green" : log.status === "partial" ? "amber" : "red"}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
