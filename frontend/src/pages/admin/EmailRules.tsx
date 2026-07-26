import { useEffect, useState } from "react";
import api from "../../api/client";
import { Modal, PageHead } from "../../components/ui";
import type {
  EmailAccount,
  EmailDirection,
  EmailRule,
  EmailTemplate,
} from "../../types";

interface FormState {
  id?: number;
  name: string;
  direction: EmailDirection;
  is_active: boolean;
  priority: number;
  trigger_event: string;
  match_from_contains: string;
  match_subject_contains: string;
  match_to_contains: string;
  action_type: string;
  action_forward_to: string;
  template_id: string;
  account_id: string;
}

const EMPTY: FormState = {
  name: "",
  direction: "outbound",
  is_active: true,
  priority: 100,
  trigger_event: "candidate_registered",
  match_from_contains: "",
  match_subject_contains: "",
  match_to_contains: "",
  action_type: "send_template",
  action_forward_to: "",
  template_id: "",
  account_id: "",
};

const TRIGGER_EVENTS = [
  { value: "candidate_registered", label: "Candidate registered" },
  { value: "job_posted", label: "Job posted" },
  { value: "application_stage_changed", label: "Application stage changed" },
  { value: "kyc_approved", label: "KYC approved" },
  { value: "kyc_rejected", label: "KYC rejected" },
  { value: "manual", label: "Manual trigger only" },
];

const OUTBOUND_ACTIONS = [{ value: "send_template", label: "Send template" }];

const INBOUND_ACTIONS = [
  { value: "auto_reply", label: "Auto-reply with template" },
  { value: "forward_to", label: "Forward to address(es)" },
  { value: "tag_as", label: "Tag as (v2)" },
  { value: "create_lead", label: "Create lead (v2)" },
];

export default function EmailRules() {
  const [rows, setRows] = useState<EmailRule[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<EmailDirection>("outbound");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function refresh() {
    try {
      const [rules, tpls, accs] = await Promise.all([
        api.get<EmailRule[]>("/email/rules"),
        api.get<EmailTemplate[]>("/email/templates", {
          params: { include_inactive: true },
        }),
        api
          .get<EmailAccount[]>("/email/accounts")
          .catch(() => ({ data: [] as EmailAccount[] })),
      ]);
      setRows(rules.data);
      setTemplates(tpls.data);
      setAccounts(accs.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function openNew(direction: EmailDirection) {
    setForm({
      ...EMPTY,
      direction,
      action_type: direction === "outbound" ? "send_template" : "auto_reply",
    });
    setShowForm(true);
    setErr("");
  }

  function openEdit(r: EmailRule) {
    setForm({
      id: r.id,
      name: r.name,
      direction: r.direction,
      is_active: r.is_active,
      priority: r.priority,
      trigger_event: r.trigger_event || "candidate_registered",
      match_from_contains: (r.match_conditions?.from_contains as string) || "",
      match_subject_contains: (r.match_conditions?.subject_contains as string) || "",
      match_to_contains: (r.match_conditions?.to_contains as string) || "",
      action_type: r.action_type,
      action_forward_to: Array.isArray(r.action_params?.to)
        ? r.action_params!.to.join(", ")
        : (r.action_params?.to as string) || "",
      template_id: r.template_id ? String(r.template_id) : "",
      account_id: r.account_id ? String(r.account_id) : "",
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
      const match_conditions: Record<string, unknown> = {};
      if (form.direction === "inbound") {
        if (form.match_from_contains)
          match_conditions.from_contains = form.match_from_contains;
        if (form.match_subject_contains)
          match_conditions.subject_contains = form.match_subject_contains;
        if (form.match_to_contains)
          match_conditions.to_contains = form.match_to_contains;
      }
      const action_params: Record<string, unknown> = {};
      if (form.action_type === "forward_to" && form.action_forward_to) {
        action_params.to = form.action_forward_to
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const payload = {
        name: form.name,
        direction: form.direction,
        is_active: form.is_active,
        priority: form.priority,
        trigger_event: form.direction === "outbound" ? form.trigger_event : null,
        match_conditions,
        action_type: form.action_type,
        action_params,
        template_id: form.template_id ? Number(form.template_id) : null,
        account_id: form.account_id ? Number(form.account_id) : null,
      };

      if (form.id) {
        await api.put(`/email/rules/${form.id}`, payload);
      } else {
        await api.post("/email/rules", payload);
      }
      setShowForm(false);
      await refresh();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: EmailRule) {
    if (!confirm(`Delete rule "${r.name}"?`)) return;
    await api.delete(`/email/rules/${r.id}`);
    await refresh();
  }

  const filtered = rows.filter((r) => r.direction === tab);
  const templateName = (id?: number | null) =>
    templates.find((t) => t.id === id)?.name || (id ? `#${id}` : "—");

  return (
    <div>
      <PageHead
        title="Email Rules"
        breadcrumb="Administration › Email Rules"
        actions={
          <button className="btn primary" onClick={() => openNew(tab)}>
            + New {tab === "outbound" ? "Outbound" : "Inbound"} Rule
          </button>
        }
      />

      <div className="form-tabs">
        <div
          className={"form-tab" + (tab === "outbound" ? " active" : "")}
          onClick={() => setTab("outbound")}
        >
          Outbound (triggers)
        </div>
        <div
          className={"form-tab" + (tab === "inbound" ? " active" : "")}
          onClick={() => setTab("inbound")}
        >
          Inbound (routing)
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <table className="sn-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Name</th>
                <th>{tab === "outbound" ? "Trigger event" : "Match conditions"}</th>
                <th>Action</th>
                <th>Template</th>
                <th>Active</th>
                <th style={{ width: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 20 }}>
                    Loading…
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.priority}</td>
                    <td>{r.name}</td>
                    <td>
                      {tab === "outbound" ? (
                        r.trigger_event
                      ) : (
                        <div style={{ fontSize: 12 }}>
                          {Object.entries(r.match_conditions || {}).map(
                            ([k, v]) => (
                              <div key={k}>
                                <strong>{k}</strong>: {String(v)}
                              </div>
                            )
                          )}
                          {Object.keys(r.match_conditions || {}).length === 0 &&
                            "(match all)"}
                        </div>
                      )}
                    </td>
                    <td>{r.action_type}</td>
                    <td>{templateName(r.template_id)}</td>
                    <td>{r.is_active ? "✓" : "—"}</td>
                    <td>
                      <button className="btn link" onClick={() => openEdit(r)}>
                        Edit
                      </button>
                      <button className="btn link" onClick={() => remove(r)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 20 }}>
                    No {tab} rules yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal
          title={form.id ? "Edit Rule" : "New Rule"}
          onClose={() => setShowForm(false)}
        >
          <div className="form-grid">
            {err && <div className="error-note">{err}</div>}
            <div className="field">
              <label>Name *</label>
              <input value={form.name} onChange={(e) => upd("name", e.target.value)} />
            </div>
            <div className="field">
              <label>Direction</label>
              <select
                value={form.direction}
                onChange={(e) => upd("direction", e.target.value as EmailDirection)}
              >
                <option value="outbound">Outbound (trigger)</option>
                <option value="inbound">Inbound (routing)</option>
              </select>
            </div>
            <div className="field">
              <label>Priority (lower runs first)</label>
              <input
                type="number"
                value={form.priority}
                onChange={(e) => upd("priority", Number(e.target.value))}
              />
            </div>

            {form.direction === "outbound" && (
              <div className="field">
                <label>Trigger event</label>
                <select
                  value={form.trigger_event}
                  onChange={(e) => upd("trigger_event", e.target.value)}
                >
                  {TRIGGER_EVENTS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.direction === "inbound" && (
              <>
                <div className="section-head">Match conditions (all must match; leave blank to ignore)</div>
                <div className="field">
                  <label>From contains</label>
                  <input
                    value={form.match_from_contains}
                    onChange={(e) => upd("match_from_contains", e.target.value)}
                    placeholder="e.g. hr@acme.com"
                  />
                </div>
                <div className="field">
                  <label>Subject contains</label>
                  <input
                    value={form.match_subject_contains}
                    onChange={(e) => upd("match_subject_contains", e.target.value)}
                    placeholder="e.g. apply"
                  />
                </div>
                <div className="field">
                  <label>To contains</label>
                  <input
                    value={form.match_to_contains}
                    onChange={(e) => upd("match_to_contains", e.target.value)}
                    placeholder="e.g. jobs@"
                  />
                </div>
              </>
            )}

            <div className="section-head">Action</div>
            <div className="field">
              <label>Action type</label>
              <select
                value={form.action_type}
                onChange={(e) => upd("action_type", e.target.value)}
              >
                {(form.direction === "outbound" ? OUTBOUND_ACTIONS : INBOUND_ACTIONS).map(
                  (a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  )
                )}
              </select>
            </div>

            {(form.action_type === "send_template" ||
              form.action_type === "auto_reply") && (
              <div className="field">
                <label>Template</label>
                <select
                  value={form.template_id}
                  onChange={(e) => upd("template_id", e.target.value)}
                >
                  <option value="">— select —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.merge_context})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.action_type === "forward_to" && (
              <div className="field">
                <label>Forward to (comma-separated)</label>
                <input
                  value={form.action_forward_to}
                  onChange={(e) => upd("action_forward_to", e.target.value)}
                  placeholder="team@example.com, ops@example.com"
                />
              </div>
            )}

            <div className="field">
              <label>Send via account (optional)</label>
              <select
                value={form.account_id}
                onChange={(e) => upd("account_id", e.target.value)}
              >
                <option value="">— default outbound —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.from_address})
                  </option>
                ))}
              </select>
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
