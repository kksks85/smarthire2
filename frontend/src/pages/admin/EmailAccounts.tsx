import { useEffect, useState } from "react";
import api from "../../api/client";
import { Modal, PageHead } from "../../components/ui";
import type { EmailAccount, EmailAccountTestResult } from "../../types";

interface FormState {
  id?: number;
  name: string;
  from_address: string;
  from_display_name: string;
  smtp_host: string;
  smtp_port: string;
  smtp_username: string;
  smtp_password: string;
  smtp_use_tls: boolean;
  smtp_use_ssl: boolean;
  imap_host: string;
  imap_port: string;
  imap_username: string;
  imap_password: string;
  imap_use_ssl: boolean;
  imap_folder: string;
  is_default_outbound: boolean;
  is_active: boolean;
}

const EMPTY: FormState = {
  name: "",
  from_address: "",
  from_display_name: "",
  smtp_host: "",
  smtp_port: "587",
  smtp_username: "",
  smtp_password: "",
  smtp_use_tls: true,
  smtp_use_ssl: false,
  imap_host: "",
  imap_port: "993",
  imap_username: "",
  imap_password: "",
  imap_use_ssl: true,
  imap_folder: "INBOX",
  is_default_outbound: false,
  is_active: true,
};

export default function EmailAccounts() {
  const [rows, setRows] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [testing, setTesting] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<
    { id: number; result: EmailAccountTestResult } | null
  >(null);

  async function refresh() {
    try {
      const res = await api.get<EmailAccount[]>("/email/accounts");
      setRows(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function openNew() {
    setForm(EMPTY);
    setShowForm(true);
    setErr("");
  }

  function openEdit(a: EmailAccount) {
    setForm({
      id: a.id,
      name: a.name,
      from_address: a.from_address,
      from_display_name: a.from_display_name || "",
      smtp_host: a.smtp_host || "",
      smtp_port: a.smtp_port?.toString() || "587",
      smtp_username: a.smtp_username || "",
      smtp_password: "",
      smtp_use_tls: a.smtp_use_tls,
      smtp_use_ssl: a.smtp_use_ssl,
      imap_host: a.imap_host || "",
      imap_port: a.imap_port?.toString() || "993",
      imap_username: a.imap_username || "",
      imap_password: "",
      imap_use_ssl: a.imap_use_ssl,
      imap_folder: a.imap_folder,
      is_default_outbound: a.is_default_outbound,
      is_active: a.is_active,
    });
    setShowForm(true);
    setErr("");
  }

  function upd<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        from_address: form.from_address,
        from_display_name: form.from_display_name || null,
        smtp_host: form.smtp_host || null,
        smtp_port: form.smtp_port ? Number(form.smtp_port) : null,
        smtp_username: form.smtp_username || null,
        smtp_use_tls: form.smtp_use_tls,
        smtp_use_ssl: form.smtp_use_ssl,
        imap_host: form.imap_host || null,
        imap_port: form.imap_port ? Number(form.imap_port) : null,
        imap_username: form.imap_username || null,
        imap_use_ssl: form.imap_use_ssl,
        imap_folder: form.imap_folder || "INBOX",
        is_default_outbound: form.is_default_outbound,
        is_active: form.is_active,
      };
      if (form.smtp_password) payload.smtp_password = form.smtp_password;
      if (form.imap_password) payload.imap_password = form.imap_password;

      if (form.id) {
        await api.put(`/email/accounts/${form.id}`, payload);
      } else {
        await api.post("/email/accounts", payload);
      }
      setShowForm(false);
      await refresh();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: EmailAccount) {
    if (!confirm(`Delete account "${a.name}"?`)) return;
    await api.delete(`/email/accounts/${a.id}`);
    await refresh();
  }

  async function test(a: EmailAccount) {
    setTesting(a.id);
    setTestResult(null);
    try {
      const res = await api.post<EmailAccountTestResult>(
        `/email/accounts/${a.id}/test`
      );
      setTestResult({ id: a.id, result: res.data });
    } finally {
      setTesting(null);
    }
  }

  return (
    <div>
      <PageHead
        title="Email Accounts"
        breadcrumb="Administration › Email Accounts"
        actions={
          <button className="btn primary" onClick={openNew}>
            + New Account
          </button>
        }
      />

      <div className="card">
        <div className="card-head">Configured mailboxes</div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="sn-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>From address</th>
                <th>SMTP</th>
                <th>IMAP</th>
                <th>Default outbound</th>
                <th>Active</th>
                <th>Last polled</th>
                <th style={{ width: 240 }}>Actions</th>
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
                rows.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td>{a.from_address}</td>
                    <td>
                      {a.smtp_host ? `${a.smtp_host}:${a.smtp_port}` : "—"}
                      {a.smtp_use_ssl && " (SSL)"}
                      {a.smtp_use_tls && !a.smtp_use_ssl && " (TLS)"}
                    </td>
                    <td>
                      {a.imap_host ? `${a.imap_host}:${a.imap_port}` : "—"}
                      {a.imap_use_ssl && " (SSL)"}
                    </td>
                    <td>{a.is_default_outbound ? "✓" : "—"}</td>
                    <td>{a.is_active ? "Active" : "Disabled"}</td>
                    <td>
                      {a.last_polled_at
                        ? new Date(a.last_polled_at).toLocaleString()
                        : "—"}
                      {a.last_poll_error && (
                        <div style={{ fontSize: 11, color: "var(--danger)" }}>
                          {a.last_poll_error}
                        </div>
                      )}
                    </td>
                    <td>
                      <button className="btn link" onClick={() => openEdit(a)}>
                        Edit
                      </button>
                      <button
                        className="btn link"
                        onClick={() => test(a)}
                        disabled={testing === a.id}
                      >
                        {testing === a.id ? "Testing…" : "Test"}
                      </button>
                      <button className="btn link" onClick={() => remove(a)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted" style={{ textAlign: "center", padding: 20 }}>
                    No email accounts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {testResult && (
        <div
          className="card"
          style={{ marginTop: 12, borderLeft: `4px solid var(--accent)` }}
        >
          <div className="card-head">Test result for account #{testResult.id}</div>
          <div className="card-body">
            <div>
              <strong>SMTP:</strong>{" "}
              {testResult.result.smtp_ok ? (
                <span style={{ color: "var(--success)" }}>OK</span>
              ) : (
                <span style={{ color: "var(--danger)" }}>
                  Failed — {testResult.result.smtp_error}
                </span>
              )}
            </div>
            <div style={{ marginTop: 6 }}>
              <strong>IMAP:</strong>{" "}
              {testResult.result.imap_ok ? (
                <span style={{ color: "var(--success)" }}>OK</span>
              ) : (
                <span style={{ color: "var(--danger)" }}>
                  Failed — {testResult.result.imap_error}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <Modal
          title={form.id ? "Edit Email Account" : "New Email Account"}
          onClose={() => setShowForm(false)}
        >
          <div className="form-grid">
            {err && <div className="error-note">{err}</div>}
            <div className="field">
              <label>Name *</label>
              <input value={form.name} onChange={(e) => upd("name", e.target.value)} />
            </div>
            <div className="field">
              <label>From address *</label>
              <input
                value={form.from_address}
                onChange={(e) => upd("from_address", e.target.value)}
              />
            </div>
            <div className="field">
              <label>From display name</label>
              <input
                value={form.from_display_name}
                onChange={(e) => upd("from_display_name", e.target.value)}
              />
            </div>

            <div className="section-head">SMTP (outbound)</div>
            <div className="field">
              <label>SMTP host</label>
              <input
                value={form.smtp_host}
                onChange={(e) => upd("smtp_host", e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="field">
              <label>SMTP port</label>
              <input
                value={form.smtp_port}
                onChange={(e) => upd("smtp_port", e.target.value)}
              />
            </div>
            <div className="field">
              <label>SMTP username</label>
              <input
                value={form.smtp_username}
                onChange={(e) => upd("smtp_username", e.target.value)}
              />
            </div>
            <div className="field">
              <label>
                SMTP password{" "}
                {form.id && (
                  <span className="muted" style={{ fontSize: 11 }}>
                    (leave blank to keep current)
                  </span>
                )}
              </label>
              <input
                type="password"
                value={form.smtp_password}
                onChange={(e) => upd("smtp_password", e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.smtp_use_tls}
                  onChange={(e) => upd("smtp_use_tls", e.target.checked)}
                />{" "}
                Use STARTTLS
              </label>
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.smtp_use_ssl}
                  onChange={(e) => upd("smtp_use_ssl", e.target.checked)}
                />{" "}
                Use SSL (implicit)
              </label>
            </div>

            <div className="section-head">IMAP (inbound)</div>
            <div className="field">
              <label>IMAP host</label>
              <input
                value={form.imap_host}
                onChange={(e) => upd("imap_host", e.target.value)}
                placeholder="imap.gmail.com"
              />
            </div>
            <div className="field">
              <label>IMAP port</label>
              <input
                value={form.imap_port}
                onChange={(e) => upd("imap_port", e.target.value)}
              />
            </div>
            <div className="field">
              <label>IMAP username</label>
              <input
                value={form.imap_username}
                onChange={(e) => upd("imap_username", e.target.value)}
              />
            </div>
            <div className="field">
              <label>
                IMAP password{" "}
                {form.id && (
                  <span className="muted" style={{ fontSize: 11 }}>
                    (leave blank to keep current)
                  </span>
                )}
              </label>
              <input
                type="password"
                value={form.imap_password}
                onChange={(e) => upd("imap_password", e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label>IMAP folder</label>
              <input
                value={form.imap_folder}
                onChange={(e) => upd("imap_folder", e.target.value)}
              />
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.imap_use_ssl}
                  onChange={(e) => upd("imap_use_ssl", e.target.checked)}
                />{" "}
                Use SSL
              </label>
            </div>

            <div className="section-head">Settings</div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.is_default_outbound}
                  onChange={(e) => upd("is_default_outbound", e.target.checked)}
                />{" "}
                Default outbound account
              </label>
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

            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button className="btn" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
