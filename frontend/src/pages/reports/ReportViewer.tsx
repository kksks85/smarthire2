import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import cronstrue from "cronstrue";
import api from "../../api/client";
import { ChartRenderer } from "../../components/ChartRenderer";
import { Modal, PageHead } from "../../components/ui";
import type {
  Report,
  ReportRunResult,
  ReportSchedule,
  ReportShare,
  Role,
  User,
} from "../../types";

const ROLE_OPTIONS: Role[] = [
  "admin",
  "manager",
  "recruiter",
  "institution",
  "employer",
  "field_agent",
];

export default function ReportViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [result, setResult] = useState<ReportRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  async function refresh() {
    setLoading(true);
    setErr("");
    try {
      const [r, run] = await Promise.all([
        api.get<Report>(`/reports/${id}`),
        api.post<ReportRunResult>(`/reports/${id}/run`),
      ]);
      setReport(r.data);
      setResult(run.data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function exportCsv() {
    window.open(`/api/v1/reports/${id}/export?fmt=csv`, "_blank");
  }
  function exportXlsx() {
    window.open(`/api/v1/reports/${id}/export?fmt=xlsx`, "_blank");
  }

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (err) return <div className="error-note">{err}</div>;
  if (!report || !result) return null;

  return (
    <div>
      <PageHead
        title={report.name}
        breadcrumb={`Reports › ${report.name}`}
        actions={
          <div className="btn-row">
            <button className="btn" onClick={refresh}>
              ↻ Refresh
            </button>
            <button className="btn" onClick={exportCsv}>
              Export CSV
            </button>
            <button className="btn" onClick={exportXlsx}>
              Export XLSX
            </button>
            {report.can_edit && (
              <>
                <button className="btn" onClick={() => setShowShare(true)}>
                  Share
                </button>
                <button className="btn" onClick={() => setShowSchedule(true)}>
                  Schedule
                </button>
                <button
                  className="btn primary"
                  onClick={() => navigate(`/reports/${id}/edit`)}
                >
                  Edit
                </button>
              </>
            )}
            <button className="btn" onClick={() => navigate("/reports")}>
              ← Back
            </button>
          </div>
        }
      />

      {report.description && (
        <div className="muted" style={{ marginBottom: 8 }}>
          {report.description}
        </div>
      )}
      <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        Data source: <strong>{report.data_source}</strong> · Display:{" "}
        <strong>{report.display_type}</strong> · {result.row_count} rows
        {result.truncated && " (truncated)"} · Owner:{" "}
        {report.owner_name || `#${report.owner_id}`}
      </div>

      <div className="card">
        <div className="card-body">
          <ChartRenderer result={result} />
        </div>
      </div>

      {showShare && (
        <ShareModal
          reportId={report.id}
          onClose={() => setShowShare(false)}
        />
      )}
      {showSchedule && (
        <ScheduleModal
          reportId={report.id}
          onClose={() => setShowSchedule(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Share modal
// ---------------------------------------------------------------------------

function ShareModal({
  reportId,
  onClose,
}: {
  reportId: number;
  onClose: () => void;
}) {
  const [shares, setShares] = useState<ReportShare[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [type, setType] = useState<"user" | "role">("role");
  const [principal, setPrincipal] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [err, setErr] = useState("");

  async function refresh() {
    const [s, u, r] = await Promise.all([
      api.get<ReportShare[]>(`/reports/${reportId}/shares`),
      api.get<User[]>(`/users`).catch(() => ({ data: [] as User[] })),
      api
        .get<{ id: number; name: string }[]>(`/reference/roles`)
        .catch(() => ({ data: [] as { id: number; name: string }[] })),
    ]);
    setShares(s.data);
    setUsers(u.data || []);
    setRoles(r.data || []);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  async function add() {
    setErr("");
    if (!principal) {
      setErr("Select a principal.");
      return;
    }
    try {
      let principal_id: number;
      if (type === "role") {
        const found = roles.find((r) => r.name === principal);
        if (!found) {
          setErr(`Role "${principal}" not found.`);
          return;
        }
        principal_id = found.id;
      } else {
        principal_id = Number(principal);
      }
      await api.post(`/reports/${reportId}/shares`, {
        principal_type: type,
        principal_id,
        permission,
      });
      setPrincipal("");
      await refresh();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Add failed.");
    }
  }

  async function remove(s: ReportShare) {
    await api.delete(`/reports/${reportId}/shares/${s.id}`);
    await refresh();
  }

  return (
    <Modal title="Share Report" onClose={onClose}>
      <div className="form-grid">
        {err && <div className="error-note">{err}</div>}

        <div className="section-head">Existing shares</div>
        <table className="sn-table">
          <thead>
            <tr>
              <th>Principal</th>
              <th>Type</th>
              <th>Permission</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {shares.map((s) => (
              <tr key={s.id}>
                <td>{s.principal_label || `#${s.principal_id}`}</td>
                <td>{s.principal_type}</td>
                <td>{s.permission}</td>
                <td>
                  <button className="btn link" onClick={() => remove(s)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {shares.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: "center", padding: 12 }}>
                  Not shared with anyone yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="section-head">Add share</div>
        <div className="field">
          <label>Type</label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as "user" | "role");
              setPrincipal("");
            }}
          >
            <option value="role">Role</option>
            <option value="user">User</option>
          </select>
        </div>
        <div className="field">
          <label>{type === "role" ? "Role" : "User"}</label>
          {type === "role" ? (
            <select value={principal} onChange={(e) => setPrincipal(e.target.value)}>
              <option value="">— choose —</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          ) : (
            <select value={principal} onChange={(e) => setPrincipal(e.target.value)}>
              <option value="">— choose —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.email})
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="field">
          <label>Permission</label>
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value as "view" | "edit")}
          >
            <option value="view">View only</option>
            <option value="edit">Edit</option>
          </select>
        </div>
        <div className="btn-row">
          <button className="btn primary" onClick={add}>
            Add
          </button>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Schedule modal
// ---------------------------------------------------------------------------

interface ScheduleForm {
  id?: number;
  cron_expr: string;
  timezone: string;
  format: "csv" | "xlsx" | "inline_html";
  recipients_users: string;
  recipients_roles: string[];
  recipients_emails: string;
  is_active: boolean;
}

const EMPTY_SCHED: ScheduleForm = {
  cron_expr: "0 8 * * MON",
  timezone: "UTC",
  format: "csv",
  recipients_users: "",
  recipients_roles: [],
  recipients_emails: "",
  is_active: true,
};

function ScheduleModal({
  reportId,
  onClose,
}: {
  reportId: number;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ReportSchedule[]>([]);
  const [form, setForm] = useState<ScheduleForm>(EMPTY_SCHED);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const cronDescription = useMemo(() => {
    try {
      return cronstrue.toString(form.cron_expr);
    } catch {
      return "Invalid cron expression";
    }
  }, [form.cron_expr]);

  async function refresh() {
    const res = await api.get<ReportSchedule[]>(
      `/reports/${reportId}/schedules`
    );
    setRows(res.data);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  function upd<K extends keyof ScheduleForm>(k: K, v: ScheduleForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleRole(role: string) {
    if (form.recipients_roles.includes(role)) {
      upd("recipients_roles", form.recipients_roles.filter((r) => r !== role));
    } else {
      upd("recipients_roles", [...form.recipients_roles, role]);
    }
  }

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const payload = {
        cron_expr: form.cron_expr,
        timezone: form.timezone,
        format: form.format,
        recipients_users: form.recipients_users
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map(Number)
          .filter((n) => !isNaN(n)),
        recipients_roles: form.recipients_roles,
        recipients_emails: form.recipients_emails
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        is_active: form.is_active,
      };
      if (form.id) {
        await api.put(`/reports/${reportId}/schedules/${form.id}`, payload);
      } else {
        await api.post(`/reports/${reportId}/schedules`, payload);
      }
      setForm(EMPTY_SCHED);
      await refresh();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: ReportSchedule) {
    if (!confirm("Delete schedule?")) return;
    await api.delete(`/reports/${reportId}/schedules/${s.id}`);
    await refresh();
  }

  async function runNow(s: ReportSchedule) {
    await api.post(`/reports/${reportId}/schedules/${s.id}/run-now`);
    await refresh();
  }

  function editRow(s: ReportSchedule) {
    setForm({
      id: s.id,
      cron_expr: s.cron_expr,
      timezone: s.timezone,
      format: s.format,
      recipients_users: (s.recipients_users || []).join(", "),
      recipients_roles: s.recipients_roles || [],
      recipients_emails: (s.recipients_emails || []).join(", "),
      is_active: s.is_active,
    });
  }

  return (
    <Modal title="Schedule Report" onClose={onClose}>
      <div className="form-grid">
        {err && <div className="error-note">{err}</div>}

        <div className="section-head">Existing schedules</div>
        <table className="sn-table">
          <thead>
            <tr>
              <th>Cron</th>
              <th>Format</th>
              <th>Recipients</th>
              <th>Next run</th>
              <th>Last</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td title={s.cron_expr}>
                  {(() => {
                    try {
                      return cronstrue.toString(s.cron_expr);
                    } catch {
                      return s.cron_expr;
                    }
                  })()}
                </td>
                <td>{s.format}</td>
                <td style={{ fontSize: 11 }}>
                  {(s.recipients_users?.length || 0) > 0 &&
                    `${s.recipients_users?.length} users`}
                  {(s.recipients_roles?.length || 0) > 0 &&
                    ` · roles: ${(s.recipients_roles || []).join(", ")}`}
                  {(s.recipients_emails?.length || 0) > 0 &&
                    ` · ${s.recipients_emails?.length} emails`}
                </td>
                <td>
                  {s.next_run_at
                    ? new Date(s.next_run_at).toLocaleString()
                    : "—"}
                </td>
                <td style={{ fontSize: 11 }}>
                  {s.last_run_status || "—"}
                  {s.last_run_at && ` @ ${new Date(s.last_run_at).toLocaleTimeString()}`}
                  {s.last_run_error && (
                    <div style={{ color: "var(--danger)" }}>{s.last_run_error}</div>
                  )}
                </td>
                <td>
                  <button className="btn link" onClick={() => editRow(s)}>
                    Edit
                  </button>
                  <button className="btn link" onClick={() => runNow(s)}>
                    Run now
                  </button>
                  <button className="btn link" onClick={() => remove(s)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 12 }}>
                  No schedules yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="section-head">
          {form.id ? "Edit schedule" : "Add schedule"}
        </div>
        <div className="field">
          <label>Cron expression (UTC by default)</label>
          <input
            value={form.cron_expr}
            onChange={(e) => upd("cron_expr", e.target.value)}
            placeholder="0 8 * * MON"
          />
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
            {cronDescription}
          </div>
        </div>
        <div className="field">
          <label>Format</label>
          <select
            value={form.format}
            onChange={(e) => upd("format", e.target.value as any)}
          >
            <option value="csv">CSV attachment</option>
            <option value="xlsx">XLSX attachment</option>
            <option value="inline_html">Inline HTML in email body</option>
          </select>
        </div>
        <div className="field">
          <label>Recipient users (comma-separated IDs)</label>
          <input
            value={form.recipients_users}
            onChange={(e) => upd("recipients_users", e.target.value)}
            placeholder="1, 4, 12"
          />
        </div>
        <div className="field">
          <label>Recipient roles</label>
          <div>
            {ROLE_OPTIONS.map((r) => (
              <label key={r} style={{ marginRight: 12, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={form.recipients_roles.includes(r)}
                  onChange={() => toggleRole(r)}
                />{" "}
                {r}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Additional emails (comma-separated)</label>
          <input
            value={form.recipients_emails}
            onChange={(e) => upd("recipients_emails", e.target.value)}
            placeholder="ops@example.com, cto@example.com"
          />
        </div>
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => upd("is_active", e.target.checked)}
            />{" "}
            Active
          </label>
        </div>
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : form.id ? "Save changes" : "Add schedule"}
          </button>
          {form.id && (
            <button className="btn" onClick={() => setForm(EMPTY_SCHED)}>
              Cancel edit
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
