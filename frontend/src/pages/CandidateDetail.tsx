import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";
import { Badge, Modal, PageHead } from "../components/ui";
import type { Application, Candidate, CandidatePii, Job } from "../types";

interface KycDocument {
  id: number;
  application_id?: number | null;
  document_type: string;
  original_filename?: string | null;
  status: string;
  rejection_reason?: string | null;
  download_url?: string | null;
}

export default function CandidateDetail() {
  const { id } = useParams();
  const [c, setC] = useState<Candidate | null>(null);
  const [pii, setPii] = useState<CandidatePii | null>(null);
  const [show, setShow] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [questions, setQuestions] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<Record<number, { contacts: Array<{ outcome: string; notes?: string | null; attempted_at: string }>; answers: Array<{ question_id: number; answer: string }>; evaluations: Array<{ stage_type: string; outcome: string; remarks?: string | null; evaluated_at?: string | null }> }>>({});
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [jobs, setJobs] = useState<Record<number, Job>>({});

  const load = useCallback(() => {
    api.get<Candidate>(`/candidates/${id}`).then((r) => setC(r.data));
  }, [id]);
  useEffect(load, [load]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<Application[]>("/applications", { params: { candidate_id: id } }),
      api.get<Array<{ id: number; text: string }>>("/screening-questions"),
      api.get<Job[]>("/jobs"),
    ]).then(async ([applicationResponse, questionResponse, jobResponse]) => {
      setApplications(applicationResponse.data);
      setQuestions(Object.fromEntries(questionResponse.data.map((question) => [question.id, question.text])));
      
      const jMap: Record<number, Job> = {};
      jobResponse.data.forEach((j) => (jMap[j.id] = j));
      setJobs(jMap);

      const entries = await Promise.all(applicationResponse.data.map(async (application) => {
        const [contacts, answers, evaluations] = await Promise.all([
          api.get(`/applications/${application.id}/contact-attempts`),
          api.get(`/applications/${application.id}/screening-responses`),
          api.get(`/applications/${application.id}/evaluations`),
        ]);
        return [application.id, { contacts: contacts.data, answers: answers.data, evaluations: evaluations.data }] as const;
      }));
      setHistory(Object.fromEntries(entries));
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api.get<KycDocument[]>(`/kyc/candidate/${id}`).then((response) => setDocuments(response.data));
  }, [id]);

  async function reveal() {
    const { data } = await api.post<CandidatePii>(`/candidates/${id}/reveal`);
    setPii(data);
    setShow(true);
  }

  if (!c) return <div className="muted">Loading…</div>;

  const isAadhaarVerified = 
    c.profile_data?.aadhaar_verified === true ||
    documents.some((doc) => doc.document_type === "Aadhaar Card" && doc.status === "verified");

  const isPanVerified = 
    c.profile_data?.pan_verified === true ||
    documents.some((doc) => doc.document_type === "PAN Card" && doc.status === "verified");

  const isBankVerified = 
    c.profile_data?.bank_verified === true ||
    documents.some((doc) => doc.document_type === "Bank Passbook / Cancelled Cheque" && doc.status === "verified");

  return (
    <div>
      <PageHead
        title={c.full_name}
        breadcrumb="Candidate Data Bank › Candidate"
        actions={
          <div className="btn-row" style={{ alignItems: "center" }}>
            {isAadhaarVerified && (
              <span className="badge" style={{ backgroundColor: "#e6f4ea", color: "#137333", border: "1px solid #137333", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <span>✅</span> Aadhaar Verified
              </span>
            )}
            {isPanVerified && (
              <span className="badge" style={{ backgroundColor: "#e6f4ea", color: "#137333", border: "1px solid #137333", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <span>✅</span> PAN Verified
              </span>
            )}
            {isBankVerified && (
              <span className="badge" style={{ backgroundColor: "#e6f4ea", color: "#137333", border: "1px solid #137333", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <span>✅</span> Bank Verified
              </span>
            )}
            <Badge value={c.status} />
            <Badge value={c.pool_status} />
            <button className="btn" onClick={reveal}>
              Reveal PII
            </button>
          </div>
        }
      />

      <div className="card">
        <div className="card-head">Profile</div>
        <div className="card-body">
          <div className="form-grid" style={{ border: "none", padding: 0 }}>
            <Item label="Primary Trade" value={c.primary_trade} />
            <Item label="Experience" value={`${c.experience_years ?? 0} yrs`} />
            <Item label="Education" value={c.education_level} />
            <Item label="Certification" value={c.certification} />
            <Item label="Languages" value={c.languages} />
            <Item
              label="Expected Salary"
              value={c.expected_salary ? `₹ ${c.expected_salary}/mo` : "—"}
            />
            <Item label="City / State" value={[c.city, c.state].filter(Boolean).join(", ")} />
            <Item
              label="Source"
              value={
                c.profile_data?.registration_channel
                  ? `${c.source.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} (${c.profile_data.registration_channel.charAt(0).toUpperCase() + c.profile_data.registration_channel.slice(1)})`
                  : c.source.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
              }
            />
            <Item label="Phone (masked)" value={c.phone} mono />
            <Item label="Driving License" value={c.has_driving_license ? "Yes" : "No"} />
            <Item label="Relocate" value={c.willing_to_relocate ? "Yes" : "No"} />
            <Item 
              label="Aadhaar Status" 
              value={
                isAadhaarVerified ? (
                  <span style={{ color: "#137333", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    ✅ Verified
                  </span>
                ) : (
                  <span className="muted">Not Verified</span>
                )
              } 
            />
            <Item 
              label="PAN Status" 
              value={
                isPanVerified ? (
                  <span style={{ color: "#137333", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    ✅ Verified
                  </span>
                ) : (
                  <span className="muted">Not Verified</span>
                )
              } 
            />
            <Item 
              label="Bank Details Status" 
              value={
                isBankVerified ? (
                  <span style={{ color: "#137333", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    ✅ Verified
                  </span>
                ) : (
                  <span className="muted">Not Verified</span>
                )
              } 
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">Custom Questions</div>
        <div className="card-body">
          {c.custom_question_responses?.length ? (
            <div className="form-grid" style={{ border: "none", padding: 0 }}>
              {c.custom_question_responses.map((response) => (
                <Item
                  key={response.question_number}
                  label={response.question || `Question ${response.question_number}`}
                  value={response.answer}
                />
              ))}
            </div>
          ) : <div className="muted">No campaign questions have been recorded.</div>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">Screening Questions</div>
        <div className="card-body">
          {applications.length === 0 ? <div className="muted">Available in the candidate pool. No recruitment applications yet.</div> : applications.map((application) => {
            const item = history[application.id];
            return <div key={application.id} style={{ borderBottom: "1px solid #d9dee2", padding: "10px 0" }}>
              <div className="btn-row" style={{ justifyContent: "space-between" }}>
                <strong>Application #{application.id}{jobs[application.job_id] ? ` - ${jobs[application.job_id].title} (Job ID: ${application.job_id})` : ""}</strong>
                <Badge value={application.status} />
              </div>
              <Progress application={application} />
              {application.release_reason && <div className="muted">Returned to pool: {application.release_reason}</div>}
              {item?.contacts.length ? <div className="muted" style={{ marginTop: 8 }}><strong>Contact attempts:</strong> {item.contacts.map((attempt) => `${attempt.outcome.replace(/_/g, " ")}${attempt.notes ? ` (${attempt.notes})` : ""}`).join(" | ")}</div> : null}
              {item?.answers.length ? <div style={{ marginTop: 8 }}><strong>Recruiter responses</strong>{item.answers.map((answer) => <div className="muted" key={answer.question_id}>{questions[answer.question_id] || `Question #${answer.question_id}`}: {answer.answer}</div>)}</div> : null}
              {item?.evaluations.length ? <div style={{ marginTop: 8 }}><strong>Stage history</strong>{item.evaluations.map((evaluation, index) => <div className="muted" key={`${evaluation.stage_type}-${index}`}>{evaluation.stage_type.replace(/_/g, " ")}: {evaluation.outcome}{evaluation.remarks ? ` - ${evaluation.remarks}` : ""}</div>)}</div> : null}
            </div>;
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">Documents and KYC</div>
        <div className="card-body">
          {documents.length === 0 ? <div className="muted">No documents have been uploaded.</div> : <table className="sn-table"><thead><tr><th>Document</th><th>File</th><th>Application</th><th>Status</th></tr></thead><tbody>{documents.map((document) => <tr key={document.id}><td>{document.document_type}</td><td>{document.download_url ? <a href={document.download_url} target="_blank" rel="noreferrer">{document.original_filename || "view"}</a> : document.original_filename || "-"}</td><td>{document.application_id ? `#${document.application_id}` : "Candidate record"}</td><td><Badge value={document.status} />{document.rejection_reason ? <span className="muted"> - {document.rejection_reason}</span> : null}</td></tr>)}</tbody></table>}
        </div>
      </div>

      {show && pii && (
        <Modal title={`PII — ${c.full_name}`} onClose={() => setShow(false)}>
          <div className="inline-note">This reveal has been logged to the audit trail.</div>
          <Item label="Phone" value={pii.phone} mono />
          <Item label="Email" value={pii.email} />
          <Item label="Address" value={pii.address} />
        </Modal>
      )}
    </div>
  );
}

function Progress({ application }: { application: Application }) {
  const steps = ["contact", "screening", "client_interview", "document_verification", "kyc", "placement"];
  const stage = application.status === "assigned" || application.status === "contact_pending" ? "contact" : application.current_stage_type;
  const index = Math.max(0, steps.indexOf(stage));
  const percent = application.status === "placed" ? 100 : application.status === "released" ? 0 : Math.round(((index + 1) / steps.length) * 100);
  return <div style={{ margin: "8px 0", maxWidth: 480 }}><div style={{ height: 8, overflow: "hidden", borderRadius: 4, background: "#d9dee2" }}><div style={{ width: `${percent}%`, height: "100%", background: application.status === "released" ? "#b9770e" : "#0b8f7a" }} /></div><span className="muted">{application.status === "released" ? "Available in pool" : `${percent}% complete`}</span></div>;
}

function Item({
  label,
  value,
  mono,
}: {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className={mono ? "pii" : undefined}>{value ?? "—"}</div>
    </div>
  );
}
