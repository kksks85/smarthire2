import { useEffect, useState } from "react";
import api from "../../api/client";
import { PageHead } from "../../components/ui";

interface Settings {
  is_enabled: boolean;
  phone_number_id?: string | null;
  graph_api_version: string;
  template_name?: string | null;
  template_language: string;
  has_access_token: boolean;
}

export default function WhatsAppSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Settings>("/admin/whatsapp-settings")
      .then(({ data }) => setSettings(data))
      .catch(() => setError("Unable to load WhatsApp settings."));
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => current ? { ...current, [key]: value } : current);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const { data } = await api.put<Settings>("/admin/whatsapp-settings", {
        ...settings,
        access_token: token || undefined,
      });
      setSettings(data);
      setToken("");
      setMessage("WhatsApp settings saved.");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Unable to save WhatsApp settings.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <div className="muted">Loading...</div>;

  return (
    <div>
      <PageHead title="WhatsApp Settings" breadcrumb="Administration › WhatsApp Settings" />
      {error && <div className="error-note">{error}</div>}
      {message && <div className="success-note">{message}</div>}
      <div className="card" style={{ maxWidth: 760 }}>
        <div className="card-head">Meta WhatsApp Cloud API</div>
        <div className="card-body">
          <div className="form-grid" style={{ border: "none", padding: 0 }}>
            <label className="field">
              <span>Enable WhatsApp campaigns</span>
              <input type="checkbox" checked={settings.is_enabled} onChange={(event) => update("is_enabled", event.target.checked)} />
            </label>
            <label className="field">
              <span>Phone Number ID</span>
              <input value={settings.phone_number_id || ""} onChange={(event) => update("phone_number_id", event.target.value)} />
            </label>
            <label className="field">
              <span>Graph API version</span>
              <input value={settings.graph_api_version} onChange={(event) => update("graph_api_version", event.target.value)} />
            </label>
            <label className="field">
              <span>Approved template name</span>
              <input value={settings.template_name || ""} onChange={(event) => update("template_name", event.target.value)} />
            </label>
            <label className="field">
              <span>Template language</span>
              <input value={settings.template_language} onChange={(event) => update("template_language", event.target.value)} />
            </label>
            <label className="field">
              <span>Access token</span>
              <input type="password" value={token} placeholder={settings.has_access_token ? "Stored securely; enter only to replace" : "Paste Meta access token"} onChange={(event) => setToken(event.target.value)} />
            </label>
          </div>
          <p className="muted">The approved Meta template must accept an image header and body values for the job title, location, and salary. Stored tokens are never shown again.</p>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save WhatsApp settings"}</button>
        </div>
      </div>
    </div>
  );
}