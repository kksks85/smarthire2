import { useEffect, useState } from "react";
import api from "../../api/client";
import { PageHead } from "../../components/ui";

interface PublicSiteSettings {
  public_base_url: string;
  using_environment_default: boolean;
}

export default function PublicSharing() {
  const [settings, setSettings] = useState<PublicSiteSettings | null>(null);
  const [publicBaseUrl, setPublicBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<PublicSiteSettings>("/admin/public-site")
      .then(({ data }) => {
        setSettings(data);
        setPublicBaseUrl(data.public_base_url);
      })
      .catch(() => setError("Unable to load public sharing settings."));
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const { data } = await api.put<PublicSiteSettings>("/admin/public-site", {
        public_base_url: publicBaseUrl,
      });
      setSettings(data);
      setPublicBaseUrl(data.public_base_url);
      setMessage("Public sharing URL saved. New share kits will use this address.");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Unable to save public sharing settings.");
    } finally {
      setSaving(false);
    }
  }

  const baseUrl = publicBaseUrl.trim().replace(/\/$/, "") || "https://careers.example.com";

  return (
    <div>
      <PageHead
        title="Public Sharing"
        breadcrumb="Administration › Public Sharing"
      />

      {error && <div className="error-note">{error}</div>}
      {message && <div className="success-note">{message}</div>}

      <div className="card" style={{ maxWidth: 760 }}>
        <div className="card-head">Public careers site</div>
        <div className="card-body">
          <p className="muted" style={{ marginTop: 0 }}>
            Set the public HTTPS address where candidates can open job listings and application
            forms. Facebook and LinkedIn use this address when a job is published.
          </p>
          <div className="field">
            <label htmlFor="public-base-url">Public site URL</label>
            <input
              id="public-base-url"
              type="url"
              placeholder="https://careers.yourcompany.com"
              value={publicBaseUrl}
              onChange={(event) => setPublicBaseUrl(event.target.value)}
              required
            />
            <small className="muted">
              Use a publicly reachable HTTPS domain. Do not use localhost or an internal network
              address.
            </small>
          </div>

          {settings?.using_environment_default && (
            <div className="success-note" style={{ marginBottom: 12 }}>
              Using the deployment default until this setting is saved.
            </div>
          )}

          <div className="field">
            <label>Generated link preview</label>
            <input readOnly value={`${baseUrl}/careers/job-public-slug`} />
          </div>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save public URL"}
          </button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 760, marginTop: 14 }}>
        <div className="card-head">Social sharing readiness</div>
        <div className="card-body">
          <div className="form-grid" style={{ border: "none", padding: 0 }}>
            <div className="field">
              <label>Facebook</label>
              <div>Uses Facebook&apos;s official sharing dialog. No app ID or secret is required.</div>
            </div>
            <div className="field">
              <label>LinkedIn</label>
              <div>Uses LinkedIn&apos;s official share dialog. No app ID or secret is required.</div>
            </div>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            After saving, select “Re-generate Share Kit” from a published job to get links with
            the new public address. The public domain must route /careers/:slug and /apply/:slug
            to this application.
          </p>
        </div>
      </div>
    </div>
  );
}