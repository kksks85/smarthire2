import { useEffect, useState } from "react";
import api from "../api/client";
import { Badge, Modal, PageHead } from "../components/ui";
import type {
  EmailAccount,
  EmailDirection,
  EmailMessage,
  EmailMessageDetail,
  EmailTemplate,
} from "../types";

interface ComposeState {
  account_id: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body_html: string;
  body_text: string;
  template_id: string;
  entity_id: string;
}

const EMPTY_COMPOSE: ComposeState = {
  account_id: "",
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  body_html: "",
  body_text: "",
  template_id: "",
  entity_id: "",
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function Mailbox() {
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selected, setSelected] = useState<EmailMessageDetail | null>(null);
  const [direction, setDirection] = useState<"" | EmailDirection>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [compose, setCompose] = useState<ComposeState>(EMPTY_COMPOSE);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get<EmailMessage[]>("/email/messages", {
        params: {
          direction: direction || undefined,
          q: search || undefined,
          limit: 200,
        },
      });
      setMessages(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    api
      .get<EmailTemplate[]>("/email/templates")
      .then((r) => setTemplates(r.data))
      .catch(() => setTemplates([]));
    api
      .get<EmailAccount[]>("/email/accounts")
      .then((r) => setAccounts(r.data))
      .catch(() => setAccounts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openMessage(m: EmailMessage) {
    const res = await api.get<EmailMessageDetail>(`/email/messages/${m.id}`);
    setSelected(res.data);
  }

  function updCompose<K extends keyof ComposeState>(k: K, v: ComposeState[K]) {
    setCompose((c) => ({ ...c, [k]: v }));
  }

  async function send() {
    setSending(true);
    setErr("");
    try {
      const toList = compose.to
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const ccList = compose.cc
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const bccList = compose.bcc
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (toList.length === 0) {
        setErr("At least one recipient is required.");
        return;
      }

      if (compose.template_id) {
        await api.post("/email/messages/from-template", {
          template_id: Number(compose.template_id),
          account_id: compose.account_id ? Number(compose.account_id) : null,
          to_addresses: toList,
          cc_addresses: ccList,
          bcc_addresses: bccList,
          entity_id: compose.entity_id ? Number(compose.entity_id) : null,
        });
      } else {
        await api.post("/email/messages", {
          account_id: compose.account_id ? Number(compose.account_id) : null,
          to_addresses: toList,
          cc_addresses: ccList,
          bcc_addresses: bccList,
          subject: compose.subject,
          body_html: compose.body_html || null,
          body_text: compose.body_text || null,
        });
      }
      setShowCompose(false);
      setCompose(EMPTY_COMPOSE);
      await refresh();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Send failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHead
        title="Mailbox"
        breadcrumb="Field Operations › Mailbox"
        actions={
          <button className="btn primary" onClick={() => setShowCompose(true)}>
            + Compose
          </button>
        }
      />

      <div className="card">
        <div
          className="card-head"
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as any)}
          >
            <option value="">All directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          <input
            placeholder="Search subject / from / snippet"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refresh()}
            style={{ flex: 1 }}
          />
          <button className="btn" onClick={refresh}>
            ↻ Refresh
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 1fr) 2fr",
            minHeight: 400,
          }}
        >
          {/* List */}
          <div style={{ borderRight: "1px solid var(--border)", overflowY: "auto" }}>
            {loading && (
              <div className="muted" style={{ textAlign: "center", padding: 20 }}>
                Loading…
              </div>
            )}
            {!loading && messages.length === 0 && (
              <div className="muted" style={{ textAlign: "center", padding: 20 }}>
                No messages.
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                onClick={() => openMessage(m)}
                style={{
                  padding: 10,
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  background: selected?.id === m.id ? "#eef4f6" : "transparent",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {m.direction === "inbound" ? "⬇ " : "⬆ "}
                    {m.direction === "inbound"
                      ? m.from_address || "(unknown)"
                      : (m.to_addresses || []).join(", ") || "(no recipient)"}
                  </span>
                  <Badge value={m.status} />
                </div>
                <div style={{ fontWeight: 500, marginTop: 4 }}>
                  {m.subject || "(no subject)"}
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                  {m.snippet}
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  {fmt(m.created_at)}
                  {m.attachment_count > 0 && ` · 📎 ${m.attachment_count}`}
                </div>
              </div>
            ))}
          </div>

          {/* Detail */}
          <div style={{ padding: 16, overflowY: "auto" }}>
            {!selected && (
              <div className="muted" style={{ textAlign: "center", padding: 40 }}>
                Select a message to view.
              </div>
            )}
            {selected && (
              <div>
                <h3 style={{ marginTop: 0 }}>{selected.subject || "(no subject)"}</h3>
                <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
                  <div>
                    <strong>From:</strong> {selected.from_address || "—"}
                  </div>
                  <div>
                    <strong>To:</strong> {(selected.to_addresses || []).join(", ")}
                  </div>
                  {(selected.cc_addresses?.length || 0) > 0 && (
                    <div>
                      <strong>CC:</strong> {(selected.cc_addresses || []).join(", ")}
                    </div>
                  )}
                  <div>
                    <strong>Status:</strong>{" "}
                    <Badge value={selected.status} />{" "}
                    <span style={{ marginLeft: 8 }}>{fmt(selected.created_at)}</span>
                  </div>
                  {selected.error_detail && (
                    <div style={{ color: "var(--danger)" }}>
                      <strong>Error:</strong> {selected.error_detail}
                    </div>
                  )}
                </div>
                {selected.body_html ? (
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      padding: 12,
                      background: "#fff",
                    }}
                    dangerouslySetInnerHTML={{ __html: selected.body_html }}
                  />
                ) : (
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      background: "#fff",
                      border: "1px solid var(--border)",
                      padding: 12,
                      margin: 0,
                    }}
                  >
                    {selected.body_text || "(no body)"}
                  </pre>
                )}
                {selected.attachments?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <strong>Attachments:</strong>
                    <ul style={{ marginTop: 4 }}>
                      {selected.attachments.map((a) => (
                        <li key={a.id}>
                          {a.original_filename}{" "}
                          <span className="muted" style={{ fontSize: 11 }}>
                            ({a.content_type})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCompose && (
        <Modal title="Compose Email" onClose={() => setShowCompose(false)}>
          <div className="form-grid">
            {err && <div className="error-note">{err}</div>}
            <div className="field">
              <label>From account (optional)</label>
              <select
                value={compose.account_id}
                onChange={(e) => updCompose("account_id", e.target.value)}
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
              <label>Use template (optional)</label>
              <select
                value={compose.template_id}
                onChange={(e) => {
                  const id = e.target.value;
                  updCompose("template_id", id);
                  if (id) {
                    const t = templates.find((x) => String(x.id) === id);
                    if (t) {
                      updCompose("subject", t.subject);
                      updCompose("body_html", t.body_html || "");
                      updCompose("body_text", t.body_text || "");
                    }
                  }
                }}
              >
                <option value="">— none (write below) —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.merge_context})
                  </option>
                ))}
              </select>
            </div>
            {compose.template_id && (
              <div className="field">
                <label>Entity ID for merge (optional)</label>
                <input
                  value={compose.entity_id}
                  onChange={(e) => updCompose("entity_id", e.target.value)}
                  placeholder="Candidate/Job/etc. ID"
                />
              </div>
            )}
            <div className="field">
              <label>To (comma-separated) *</label>
              <input
                value={compose.to}
                onChange={(e) => updCompose("to", e.target.value)}
              />
            </div>
            <div className="field">
              <label>CC</label>
              <input
                value={compose.cc}
                onChange={(e) => updCompose("cc", e.target.value)}
              />
            </div>
            <div className="field">
              <label>BCC</label>
              <input
                value={compose.bcc}
                onChange={(e) => updCompose("bcc", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Subject</label>
              <input
                value={compose.subject}
                onChange={(e) => updCompose("subject", e.target.value)}
                disabled={!!compose.template_id}
              />
            </div>
            <div className="field">
              <label>Body (HTML)</label>
              <textarea
                rows={8}
                value={compose.body_html}
                onChange={(e) => updCompose("body_html", e.target.value)}
                disabled={!!compose.template_id}
              />
            </div>
            <div className="field">
              <label>Body (plain text)</label>
              <textarea
                rows={3}
                value={compose.body_text}
                onChange={(e) => updCompose("body_text", e.target.value)}
                disabled={!!compose.template_id}
              />
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={send} disabled={sending}>
                {sending ? "Sending…" : "Send"}
              </button>
              <button className="btn" onClick={() => setShowCompose(false)}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
