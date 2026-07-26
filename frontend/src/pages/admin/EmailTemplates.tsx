import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/client";
import { Badge, Modal, PageHead } from "../../components/ui";
import type {
  EmailMergeContext,
  EmailTemplate,
  MergeContextFields,
} from "../../types";

interface FormState {
  id?: number;
  name: string;
  description: string;
  subject: string;
  body_html: string;
  body_text: string;
  merge_context: EmailMergeContext;
  category: string;
  is_active: boolean;
}

const EMPTY: FormState = {
  name: "",
  description: "",
  subject: "",
  body_html: "",
  body_text: "",
  merge_context: "none",
  category: "transactional",
  is_active: true,
};

const CONTEXT_OPTIONS: { value: EmailMergeContext; label: string }[] = [
  { value: "none", label: "None (static text only)" },
  { value: "candidate", label: "Candidate" },
  { value: "job", label: "Job Posting" },
  { value: "employer", label: "Employer / Client" },
  { value: "application", label: "Application" },
  { value: "user", label: "User" },
];

interface PreviewResult {
  subject: string;
  body_html?: string | null;
  body_text?: string | null;
}

export default function EmailTemplates() {
  const [rows, setRows] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [mergeFields, setMergeFields] = useState<MergeContextFields[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewMode, setPreviewMode] = useState<"html" | "text">("html");

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyHtmlRef = useRef<HTMLTextAreaElement>(null);
  const bodyTextRef = useRef<HTMLTextAreaElement>(null);
  const [focusTarget, setFocusTarget] = useState<"subject" | "html" | "text">(
    "html"
  );

  async function refresh() {
    try {
      const res = await api.get<EmailTemplate[]>("/email/templates", {
        params: { include_inactive: true },
      });
      setRows(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    api
      .get<MergeContextFields[]>("/email/templates/merge-fields")
      .then((r) => setMergeFields(r.data));
  }, []);

  function openNew() {
    setForm(EMPTY);
    setPreview(null);
    setShowForm(true);
    setErr("");
  }

  function openEdit(t: EmailTemplate) {
    setForm({
      id: t.id,
      name: t.name,
      description: t.description || "",
      subject: t.subject,
      body_html: t.body_html || "",
      body_text: t.body_text || "",
      merge_context: t.merge_context,
      category: t.category,
      is_active: t.is_active,
    });
    setPreview(null);
    setShowForm(true);
    setErr("");
  }

  function upd<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const availableContexts = useMemo(() => {
    const ctxKey = form.merge_context;
    if (ctxKey === "none")
      return mergeFields.filter((m) => m.context === "system");
    return mergeFields.filter(
      (m) => m.context === ctxKey || m.context === "system"
    );
  }, [mergeFields, form.merge_context]);

  function insertToken(token: string) {
    if (focusTarget === "subject") {
      insertAt(subjectRef.current, token, (v) => upd("subject", v));
    } else if (focusTarget === "text") {
      insertAt(bodyTextRef.current, token, (v) => upd("body_text", v));
    } else {
      insertAt(bodyHtmlRef.current, token, (v) => upd("body_html", v));
    }
  }

  function insertAt(
    el: HTMLInputElement | HTMLTextAreaElement | null,
    token: string,
    setter: (v: string) => void
  ) {
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    setter(next);
    setTimeout(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  }

  async function doPreview() {
    setErr("");
    try {
      const res = await api.post<PreviewResult>("/email/templates/preview", {
        subject: form.subject,
        body_html: form.body_html || null,
        body_text: form.body_text || null,
        merge_context: form.merge_context,
      });
      setPreview(res.data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Preview failed.");
    }
  }

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        subject: form.subject,
        body_html: form.body_html || null,
        body_text: form.body_text || null,
        merge_context: form.merge_context,
        category: form.category,
        is_active: form.is_active,
      };
      if (form.id) {
        await api.put(`/email/templates/${form.id}`, payload);
      } else {
        await api.post("/email/templates", payload);
      }
      setShowForm(false);
      await refresh();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: EmailTemplate) {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    await api.delete(`/email/templates/${t.id}`);
    await refresh();
  }

  return (
    <div>
      <PageHead
        title="Email Templates"
        breadcrumb="Administration › Email Templates"
        actions={
          <button className="btn primary" onClick={openNew}>
            + New Template
          </button>
        }
      />

      <div className="card">
        <div className="card-head">Reusable message templates</div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="sn-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Subject</th>
                <th>Merge context</th>
                <th>Category</th>
                <th>Status</th>
                <th style={{ width: 180 }}>Actions</th>
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
                rows.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      {t.description && (
                        <div className="muted" style={{ fontSize: 11 }}>
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td>{t.subject}</td>
                    <td>{t.merge_context}</td>
                    <td>{t.category}</td>
                    <td>
                      <Badge value={t.is_active ? "active" : "draft"} />
                    </td>
                    <td>
                      <button className="btn link" onClick={() => openEdit(t)}>
                        Edit
                      </button>
                      <button className="btn link" onClick={() => remove(t)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>
                    No templates yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal
          title={form.id ? "Edit Template" : "New Template"}
          onClose={() => setShowForm(false)}
        >
          {err && <div className="error-note">{err}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 12 }}>
            {/* Merge field picker sidebar */}
            <aside
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: 8,
                maxHeight: "60vh",
                overflowY: "auto",
                background: "#fafbfc",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Merge fields</div>
              <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>
                Click to insert at cursor. Change merge context above to see more.
              </div>
              {availableContexts.map((ctx) => (
                <div key={ctx.context} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      textTransform: "uppercase",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      marginBottom: 4,
                    }}
                  >
                    {ctx.label}
                  </div>
                  {ctx.fields.map((f) => (
                    <button
                      key={f.token}
                      className="btn link"
                      style={{
                        display: "block",
                        textAlign: "left",
                        padding: "2px 0",
                        fontSize: 12,
                      }}
                      onClick={() => insertToken(f.token)}
                      title={f.token}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              ))}
            </aside>

            <div className="form-grid" style={{ margin: 0 }}>
              <div className="field">
                <label>Name *</label>
                <input value={form.name} onChange={(e) => upd("name", e.target.value)} />
              </div>
              <div className="field">
                <label>Description</label>
                <input
                  value={form.description}
                  onChange={(e) => upd("description", e.target.value)}
                />
              </div>
              <div className="field">
                <label>Merge context</label>
                <select
                  value={form.merge_context}
                  onChange={(e) =>
                    upd("merge_context", e.target.value as EmailMergeContext)
                  }
                >
                  {CONTEXT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Category</label>
                <select
                  value={form.category}
                  onChange={(e) => upd("category", e.target.value)}
                >
                  <option value="transactional">Transactional</option>
                  <option value="marketing">Marketing</option>
                  <option value="alert">Alert</option>
                </select>
              </div>
              <div className="field">
                <label>Subject *</label>
                <input
                  ref={subjectRef}
                  value={form.subject}
                  onFocus={() => setFocusTarget("subject")}
                  onChange={(e) => upd("subject", e.target.value)}
                />
              </div>
              <div className="field">
                <label>Body (HTML)</label>
                <textarea
                  ref={bodyHtmlRef}
                  rows={8}
                  value={form.body_html}
                  onFocus={() => setFocusTarget("html")}
                  onChange={(e) => upd("body_html", e.target.value)}
                />
              </div>
              <div className="field">
                <label>Body (plain text fallback)</label>
                <textarea
                  ref={bodyTextRef}
                  rows={4}
                  value={form.body_text}
                  onFocus={() => setFocusTarget("text")}
                  onChange={(e) => upd("body_text", e.target.value)}
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
                  {saving ? "Saving…" : "Save"}
                </button>
                <button className="btn" onClick={doPreview}>
                  Preview
                </button>
                <button className="btn" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>

              {preview && (
                <div
                  className="card"
                  style={{ marginTop: 12, borderLeft: "4px solid var(--accent)" }}
                >
                  <div className="card-head">
                    Preview{" "}
                    <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>
                      (rendered with sample data)
                    </span>
                    <div className="spacer" />
                    <button
                      className="btn link"
                      onClick={() => setPreviewMode("html")}
                      style={{ fontWeight: previewMode === "html" ? 600 : 400 }}
                    >
                      HTML
                    </button>
                    <button
                      className="btn link"
                      onClick={() => setPreviewMode("text")}
                      style={{ fontWeight: previewMode === "text" ? 600 : 400 }}
                    >
                      Text
                    </button>
                  </div>
                  <div className="card-body">
                    <div style={{ marginBottom: 8 }}>
                      <strong>Subject:</strong> {preview.subject}
                    </div>
                    {previewMode === "html" && preview.body_html ? (
                      <div
                        style={{
                          border: "1px solid var(--border)",
                          padding: 8,
                          background: "#fff",
                        }}
                        // Preview only — admin-authored content
                        dangerouslySetInnerHTML={{ __html: preview.body_html }}
                      />
                    ) : (
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          background: "#fff",
                          border: "1px solid var(--border)",
                          padding: 8,
                          margin: 0,
                        }}
                      >
                        {previewMode === "text"
                          ? preview.body_text || "(no plain-text body)"
                          : "(no HTML body)"}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
