import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { Badge, PageHead } from "../../components/ui";
import type { Report } from "../../types";

const DISPLAY_LABELS: Record<string, string> = {
  table: "Table",
  bar: "Bar chart",
  line: "Line chart",
  pie: "Pie chart",
  kpi: "KPI card",
  map: "Map",
  funnel: "Funnel",
};

export default function ReportsList() {
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function refresh() {
    try {
      const res = await api.get<Report[]>("/reports");
      setRows(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function remove(r: Report) {
    if (!confirm(`Delete report "${r.name}"?`)) return;
    await api.delete(`/reports/${r.id}`);
    await refresh();
  }

  return (
    <div>
      <PageHead
        title="Reports"
        breadcrumb="Administration › Reports"
        actions={
          <button
            className="btn primary"
            onClick={() => navigate("/reports/new")}
          >
            + New Report
          </button>
        }
      />

      <div className="card">
        <div className="card-head">
          Saved reports{" "}
          <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
            (owned by you or shared with you / your role)
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="sn-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Data source</th>
                <th>Display</th>
                <th>Owner</th>
                <th>Updated</th>
                <th style={{ width: 260 }}>Actions</th>
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
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      {r.description && (
                        <div className="muted" style={{ fontSize: 11 }}>
                          {r.description}
                        </div>
                      )}
                    </td>
                    <td>{r.data_source}</td>
                    <td>
                      <Badge value={DISPLAY_LABELS[r.display_type] || r.display_type} />
                    </td>
                    <td>{r.owner_name || `User #${r.owner_id}`}</td>
                    <td>
                      {r.updated_at
                        ? new Date(r.updated_at).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      <button
                        className="btn link"
                        onClick={() => navigate(`/reports/${r.id}`)}
                      >
                        Run
                      </button>
                      {r.can_edit && (
                        <>
                          <button
                            className="btn link"
                            onClick={() => navigate(`/reports/${r.id}/edit`)}
                          >
                            Edit
                          </button>
                          <button className="btn link" onClick={() => remove(r)}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>
                    No reports yet. Click <strong>+ New Report</strong> to create one.
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
