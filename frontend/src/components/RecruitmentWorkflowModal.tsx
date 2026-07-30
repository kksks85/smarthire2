import { useEffect, useState } from "react";
import api from "../api/client";
import { Modal } from "./ui";
import type { Application } from "../types";

interface ContactAttempt {
  id: number;
  outcome: string;
  notes?: string | null;
  attempted_at: string;
}

interface Question {
  id: number;
  text: string;
}

interface Props {
  application: Application;
  candidateName: string;
  onClose: () => void;
  onCompleted: () => void;
}

const CONTACT_STATUSES = new Set([
  "interested",
  "contact_attempted",
  "contact_successful",
  "unable_to_reach",
  "not_interested",
  "assigned",
  "contact_pending",
]);
const WORKFLOW_STEPS = [
  { key: "contact", label: "Contact" },
  { key: "screening", label: "Screening" },
  { key: "client_interview", label: "Employer interview" },
  { key: "document_verification", label: "Documents" },
  { key: "kyc", label: "KYC" },
  { key: "placement", label: "Placement" },
];

const CONTACT_OUTCOME_LABELS: Record<string, string> = {
  connected: "Connected successfully",
  no_answer: "No answer",
  wrong_number: "Wrong number",
  phone_switched_off: "Phone switched off",
  call_back_later: "Call back later",
  candidate_not_interested: "Candidate not interested",
  other: "Other",
};

export default function RecruitmentWorkflowModal({
  application,
  candidateName,
  onClose,
  onCompleted,
}: Props) {
  const [attempts, setAttempts] = useState<ContactAttempt[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [contact, setContact] = useState({ outcome: "no_answer", notes: "" });
  const [interest, setInterest] = useState({ interested: "true", notes: "" });
  const [evaluation, setEvaluation] = useState({ outcome: "passed", score: "", remarks: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isContact = CONTACT_STATUSES.has(application.status);
  const isScreening = application.status === "screening";
  const connected = attempts.some((attempt) => attempt.outcome === "connected");
  const currentStage = isContact ? "contact" : application.current_stage_type;
  const currentIndex = Math.max(0, WORKFLOW_STEPS.findIndex((step) => step.key === currentStage));
  const nextStep = WORKFLOW_STEPS[currentIndex + 1];

  useEffect(() => {
    if (isContact) {
      api.get<ContactAttempt[]>(`/applications/${application.id}/contact-attempts`)
        .then((response) => setAttempts(response.data));
    }
    if (isScreening) {
      Promise.all([
        api.get<Question[]>("/screening-questions"),
        api.get<Array<{ question_id: number; answer: string }>>(`/applications/${application.id}/screening-responses`),
      ]).then(([questionResponse, answerResponse]) => {
        setQuestions(questionResponse.data);
        setAnswers(Object.fromEntries(answerResponse.data.map((answer) => [answer.question_id, answer.answer])));
      });
    }
  }, [application.id, isContact, isScreening]);

  async function submitContact() {
    setError("");
    setBusy(true);
    try {
      await api.post(`/applications/${application.id}/contact-attempts`, contact);
      onCompleted();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail ?? "Could not save the contact attempt.");
    } finally {
      setBusy(false);
    }
  }

  async function submitInterest() {
    setError("");
    setBusy(true);
    try {
      await api.post(`/applications/${application.id}/interest`, {
        interested: interest.interested === "true",
        notes: interest.notes || null,
      });
      onCompleted();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail ?? "Could not save the interest decision.");
    } finally {
      setBusy(false);
    }
  }

  async function submitStage() {
    setError("");
    setBusy(true);
    try {
      if (isScreening) {
        await api.put(`/applications/${application.id}/screening-responses`, {
          responses: questions.map((question) => ({
            question_id: question.id,
            answer: answers[question.id] || "",
          })),
        });
      }
      await api.post(`/applications/${application.id}/evaluations`, {
        stage_type: application.current_stage_type,
        outcome: evaluation.outcome,
        score: evaluation.score ? Number(evaluation.score) : null,
        remarks: evaluation.remarks || null,
      });
      onCompleted();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail ?? "Could not save the stage decision.");
    } finally {
      setBusy(false);
    }
  }

  async function blockForPosition() {
    setError("");
    setBusy(true);
    try {
      await api.post(`/applications/${application.id}/qualify`);
      onCompleted();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail ?? "Could not block candidate for position.");
    } finally {
      setBusy(false);
    }
  }

  const title = isContact ? "Contact Candidate" : isScreening ? "Stage 1 Screening" : "Recruitment Stage";

  return (
    <Modal title={`${candidateName} - ${title}`} onClose={onClose}>
      {error && <div className="error-note">{error}</div>}
      <div style={{ marginBottom: 18, borderBottom: "1px solid #d9dee2", paddingBottom: 14 }}>
        <div className="muted" style={{ marginBottom: 8 }}>Recruitment progress</div>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
          {WORKFLOW_STEPS.map((step, index) => <div key={step.key} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ height: 7, borderRadius: 3, background: index <= currentIndex ? "#0b8f7a" : "#d9dee2" }} />
            <div style={{ fontSize: 11, marginTop: 4, fontWeight: index === currentIndex ? 700 : 400, overflowWrap: "anywhere" }}>{step.label}</div>
          </div>)}
        </div>
        <div className="inline-note" style={{ marginTop: 12 }}>
          <strong>Current:</strong> {WORKFLOW_STEPS[currentIndex].label}. {nextStep ? <><strong>Next after pass:</strong> {nextStep.label}.</> : "Passing completes placement."}
        </div>
      </div>
      {isContact ? (
        <>
          <div className="inline-note">
            Contact attempts: {application.contact_attempt_count} of 3. Three unsuccessful attempts return the candidate to the available pool.
          </div>
          {attempts.length > 0 && (
            <div className="muted" style={{ margin: "10px 0" }}>
              {attempts.map((attempt) => (
                <div key={attempt.id}>
                  {new Date(attempt.attempted_at).toLocaleString()}: {CONTACT_OUTCOME_LABELS[attempt.outcome] ?? attempt.outcome.replace(/_/g, " ")}{attempt.notes ? ` - ${attempt.notes}` : ""}
                </div>
              ))}
            </div>
          )}
          {!connected ? (
            <>
              <div className="field"><label>Contact outcome</label><select value={contact.outcome} onChange={(event) => setContact({ ...contact, outcome: event.target.value })}><option value="connected">Connected successfully</option><option value="no_answer">No answer</option><option value="wrong_number">Wrong number</option><option value="phone_switched_off">Phone switched off</option><option value="call_back_later">Call back later</option><option value="candidate_not_interested">Candidate not interested</option><option value="other">Other</option></select></div>
              <div className="field"><label>Notes {contact.outcome === "other" ? "(required)" : ""}</label><textarea rows={2} value={contact.notes} onChange={(event) => setContact({ ...contact, notes: event.target.value })} /></div>
              <div className="btn-row"><button className="btn primary" disabled={busy} onClick={submitContact}>Save Contact Attempt</button><button className="btn" onClick={onClose}>Cancel</button></div>
            </>
          ) : (
            <>
              <div className="field"><label>Candidate interested in this job?</label><select value={interest.interested} onChange={(event) => setInterest({ ...interest, interested: event.target.value })}><option value="true">Yes - start screening</option><option value="false">No - return to pool</option></select></div>
              <div className="field"><label>Notes</label><textarea rows={2} value={interest.notes} onChange={(event) => setInterest({ ...interest, notes: event.target.value })} /></div>
              <div className="btn-row"><button className="btn primary" disabled={busy} onClick={submitInterest}>Save Interest Decision</button><button className="btn" onClick={onClose}>Cancel</button></div>
            </>
          )}
        </>
      ) : (
        <>
          {isScreening && <>
            <div className="inline-note">Complete each configured question before passing this stage.</div>
            {questions.map((question, index) => <div className="field" key={question.id}><label>{index + 1}. {question.text}</label><textarea rows={2} value={answers[question.id] || ""} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} /></div>)}
          </>}
          {(application.status === "documents" || application.status === "kyc") && <div className="inline-note">Upload and verify the required files in KYC Verification before recording a pass decision.</div>}
          <div className="field"><label>Decision</label><select value={evaluation.outcome} onChange={(event) => setEvaluation({ ...evaluation, outcome: event.target.value })}><option value="passed">Pass and advance</option><option value="on_hold">Put on hold</option><option value="failed">Not selected - return to pool</option></select></div>
          <div className="field"><label>Score (0-100)</label><input type="number" value={evaluation.score} onChange={(event) => setEvaluation({ ...evaluation, score: event.target.value })} /></div>
          <div className="field"><label>Remarks / return reason</label><textarea rows={2} value={evaluation.remarks} onChange={(event) => setEvaluation({ ...evaluation, remarks: event.target.value })} /></div>
          <div className="btn-row">
            <button className="btn primary" disabled={busy} onClick={submitStage}>Save Decision</button>
            {application.status === "screening" && (
              <button className="btn" disabled={busy} onClick={blockForPosition}>Block for Position</button>
            )}
            <button className="btn" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}
    </Modal>
  );
}
