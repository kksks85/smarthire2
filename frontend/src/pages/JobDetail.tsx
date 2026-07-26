import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Badge, Modal, PageHead } from "../components/ui";
import type { Job, PublishInfo } from "../types";

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [publish, setPublish] = useState<PublishInfo | null>(null);
  const [showJobPreview, setShowJobPreview] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<"facebook" | "linkedin" | null>(null);
  const [comments, setComments] = useState("");
  const [msg, setMsg] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  const load = useCallback(() => {
    api.get<Job>(`/jobs/${id}`).then((r) => setJob(r.data));
  }, [id]);
  useEffect(load, [load]);

  const isApprover = user?.role === "manager" || user?.role === "admin";

  async function act(path: string, body?: any) {
    setMsg("");
    try {
      await api.post(`/jobs/${id}/${path}`, body);
      load();
    } catch (e: any) {
      setMsg(e?.response?.data?.detail ?? "Action failed");
    }
  }

  async function doPublish() {
    const { data } = await api.post<PublishInfo>(`/jobs/${id}/publish`);
    setPublish(data);
    load();
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setMsg("Link copied to clipboard.");
  }

  async function postToLinkedIn() {
    if (!id) return;
    setIsPosting(true);
    setMsg("");
    try {
      const response = await api.post(`/jobs/${id}/post-linkedin`);
      setMsg(`✅ Job posted to LinkedIn successfully! Check your company page.`);
      setShowJobPreview(false);
    } catch (error: any) {
      setMsg(error?.response?.data?.detail ?? "Failed to post to LinkedIn. Please check your LinkedIn API configuration.");
    } finally {
      setIsPosting(false);
    }
  }

  if (!job) return <div className="muted">Loading…</div>;

  return (
    <div>
      <PageHead
        title={job.title}
        breadcrumb="Jobs & Requisitions › Job Postings › Detail"
        actions={<Badge value={job.status} />}
      />
      {msg && <div className="success-note">{msg}</div>}

      <div className="btn-row" style={{ marginBottom: 14 }}>
        {job.status === "draft" && (
          <button className="btn primary" onClick={() => act("submit")}>
            Submit for Approval
          </button>
        )}
        {job.status === "pending_approval" && isApprover && (
          <>
            <button
              className="btn primary"
              onClick={() => act("approve", { decision: "approved", comments })}
            >
              Approve
            </button>
            <button
              className="btn danger"
              onClick={() => act("approve", { decision: "rejected", comments })}
            >
              Reject
            </button>
          </>
        )}
        {(job.status === "approved" || job.status === "published") && isApprover && (
          <button className="btn primary" onClick={doPublish}>
            {job.status === "published" ? "Re-generate Share Kit" : "Publish"}
          </button>
        )}
        <button
          className="btn"
          onClick={() => navigate(`/candidates/new?jobId=${id}`)}
        >
          + Register Candidate for this Job
        </button>
      </div>

      {job.status === "pending_approval" && isApprover && (
        <div className="field" style={{ maxWidth: 480, marginBottom: 14 }}>
          <label>Approval Comments</label>
          <textarea rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
        </div>
      )}

      <div className="card">
        <div className="card-head">Requisition Details</div>
        <div className="card-body">
          <div className="form-grid" style={{ border: "none", padding: 0 }}>
            <Detail label="Category" value={job.category} />
            <Detail label="Employment Type" value={job.employment_type} />
            <Detail label="Vacancies" value={String(job.vacancies)} />
            <Detail label="Shift" value={job.shift_type} />
            <Detail
              label="Salary (₹/mo)"
              value={
                job.salary_min || job.salary_max
                  ? `${job.salary_min ?? "?"} – ${job.salary_max ?? "?"}`
                  : "—"
              }
            />
            <Detail label="Min Experience" value={`${job.min_experience_years} yrs`} />
            <Detail label="Location" value={[job.work_city, job.work_state].filter(Boolean).join(", ")} />
            <Detail label="Certification" value={job.required_certification} />
            <div className="field full">
              <label>Description</label>
              <div>{job.description || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {job.required_candidate_fields &&
        ((job.required_candidate_fields.fields ?? []).length > 0 ||
          (job.required_candidate_fields.documents ?? []).length > 0) && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-head">Client-Specific Mandatory Requirements</div>
            <div className="card-body" style={{ fontSize: 12 }}>
              <p style={{ marginTop: 0, color: "#666" }}>
                Inherited from the client. Candidates applying for this job must provide the
                following:
              </p>
              {(job.required_candidate_fields.fields ?? []).length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <strong>Required Information: </strong>
                  {(job.required_candidate_fields.fields ?? []).join(", ")}
                </div>
              )}
              {(job.required_candidate_fields.documents ?? []).length > 0 && (
                <div>
                  <strong>Required Documents: </strong>
                  {(job.required_candidate_fields.documents ?? []).join(", ")}
                </div>
              )}
            </div>
          </div>
        )}

      {publish && (
        <Modal title="Publish & Share Kit" onClose={() => setPublish(null)}>
          <div className="success-note">
            Job is now published. Share the link or QR code below.
          </div>
          <div className="qr-box">
            <img src={publish.qr_data_uri} alt="QR code for self-registration" />
            <p className="muted">Candidates scan to self-register</p>
          </div>
          <label className="muted">Public job link</label>
          <div className="copy-field">
            <input readOnly value={publish.public_url} />
            <button className="btn" onClick={() => copy(publish.public_url)}>
              Copy
            </button>
          </div>
          <label className="muted">Direct apply / QR link</label>
          <div className="copy-field">
            <input readOnly value={publish.apply_url} />
            <button className="btn" onClick={() => copy(publish.apply_url)}>
              Copy
            </button>
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button
              className="btn primary"
              onClick={() => {
                setPreviewPlatform("facebook");
                setShowJobPreview(true);
              }}
            >
              Share on Facebook
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setPreviewPlatform("linkedin");
                setShowJobPreview(true);
              }}
            >
              Share on LinkedIn
            </button>
          </div>
        </Modal>
      )}

      {showJobPreview && publish && job && (
        <Modal title="Job Posting Preview" onClose={() => setShowJobPreview(false)}>
          <div style={{ marginBottom: 20 }}>
            <p className="muted">Preview how your job will appear when shared:</p>
            <div
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                padding: 16,
                backgroundColor: "#f9f9f9",
                fontFamily: '"Segoe UI", Arial, sans-serif',
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: "#000", marginBottom: 4 }}>
                  {job.title}
                </div>
                <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
                  {[job.work_city, job.work_state].filter(Boolean).join(", ")} • {job.category}
                </div>
              </div>

              <div style={{ marginBottom: 12, lineHeight: 1.5, color: "#333", fontSize: 13 }}>
                <div style={{ marginBottom: 8 }}>
                  <strong>Vacancies:</strong> {job.vacancies}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Salary:</strong> ₹{job.salary_min} – ₹{job.salary_max} per month
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Experience:</strong> {job.min_experience_years} years
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Employment Type:</strong> {job.employment_type}
                </div>
              </div>

              <div style={{ marginBottom: 12, lineHeight: 1.6, color: "#333", fontSize: 13 }}>
                <strong>About the role:</strong>
                <div style={{ marginTop: 6, whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
                  {job.description
                    ?.split("\n")
                    .slice(0, 3)
                    .join("\n")}
                  {(job.description?.split("\n").length ?? 0) > 3 && "..."}
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  backgroundColor: "#0a66c2",
                  color: "#fff",
                  borderRadius: 4,
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Apply Now
              </div>
            </div>
          </div>

          <div className="btn-row">
            <button className="btn" onClick={() => setShowJobPreview(false)}>
              Back
            </button>
            {previewPlatform === "linkedin" ? (
              <button 
                className="btn primary" 
                onClick={postToLinkedIn}
                disabled={isPosting}
              >
                {isPosting ? "Posting..." : "Post to LinkedIn"}
              </button>
            ) : (
              <a
                className="btn primary"
                href={publish.share_facebook_url}
                target="_blank"
                rel="noreferrer"
              >
                Post to Facebook
              </a>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div>{value || "—"}</div>
    </div>
  );
}
