import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Badge, PageHead } from "../components/ui";
import RecruitmentWorkflowModal from "../components/RecruitmentWorkflowModal";
import type { Application, Candidate, Job, User } from "../types";

const STAGES = [
  { key: "contact", label: "Contact" },
  { key: "screening", label: "Screening" },
  { key: "client_interview", label: "Employer Interview" },
  { key: "document_verification", label: "Documents" },
  { key: "kyc", label: "KYC" },
  { key: "validated", label: "Validated" },
  { key: "placement", label: "Placement" },
];

const APP_STATUSES = [
  "interested",
  "contact_attempted",
  "contact_successful",
  "unable_to_reach",
  "not_interested",
  "assigned",
  "contact_pending",
  "screening",
  "in_process",
  "in_interview",
  "documents",
  "kyc",
  "validated",
  "shortlisted",
  "selected",
  "blocked_for_position",
  "qualified",
  "on_hold",
  "rejected",
  "placed",
  "closed",
  "released",
];

export default function Pipeline({ mineOnly = false }: { mineOnly?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [apps, setApps] = useState<Application[]>([]);
  const [candidates, setCandidates] = useState<Record<number, Candidate>>({});
  const [jobs, setJobs] = useState<Record<number, Job>>({});
  const [recruiters, setRecruiters] = useState<User[]>([]);
  const [active, setActive] = useState<Application | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "");
  const [jobFilter, setJobFilter] = useState<string>(searchParams.get("job_id") || "");

  const canAssign = user?.role === "manager" || user?.role === "admin";

  async function load() {
    const params: Record<string, any> = {};
    if (mineOnly && user) params.recruiter_id = user.id;
    if (statusFilter) params.status = statusFilter;
    if (jobFilter) params.job_id = jobFilter;
    const { data } = await api.get<Application[]>("/applications", { params });
    setApps(data);

    const cRes = await api.get<{ items: Candidate[] }>("/candidates", {
      params: { limit: 200 },
    });
    const cMap: Record<number, Candidate> = {};
    cRes.data.items.forEach((c) => (cMap[c.id] = c));
    await Promise.all(data.filter((application) => !cMap[application.candidate_id]).map(async (application) => {
      const response = await api.get<Candidate>(`/candidates/${application.candidate_id}`);
      cMap[response.data.id] = response.data;
    }));
    setCandidates(cMap);

    const jRes = await api.get<Job[]>("/jobs");
    const jMap: Record<number, Job> = {};
    jRes.data.forEach((j) => (jMap[j.id] = j));
    setJobs(jMap);

    if (canAssign) {
      const rRes = await api.get<User[]>("/users", { params: { role: "recruiter" } });
      setRecruiters(rRes.data);
    }
  }
  useEffect(() => {
    const next: Record<string, string> = {};
    if (statusFilter) next.status = statusFilter;
    if (jobFilter) next.job_id = jobFilter;
    setSearchParams(next, { replace: true });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mineOnly, statusFilter, jobFilter]);

  async function assign(appId: number, recruiterId: number) {
    await api.post(`/applications/${appId}/assign`, {
      assigned_recruiter_id: recruiterId,
    });
    load();
  }

  return (
    <div>
      <PageHead
        title={mineOnly ? "My Assignments" : "Interview Pipeline"}
        breadcrumb={`Recruitment › ${mineOnly ? "My Assignments" : "Interview Pipeline"}`}
      />
      <div className="list-toolbar">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {APP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
        >
          <option value="">All jobs</option>
          {Object.values(jobs).map((j) => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </select>
        <div className="spacer" />
        <span className="muted">
          {apps.length} application{apps.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="pipeline-table-wrap">
      <table className="sn-table pipeline-table">
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Requisition</th>
            <th>Stage</th>
            <th>Progress</th>
            <th>Owner</th>
            <th>Next action</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id}>
              <td>
                <button className="btn link candidate-link" onClick={() => navigate(`/candidates/${a.candidate_id}`)}>{candidates[a.candidate_id]?.full_name ?? `Candidate #${a.candidate_id}`}</button>
                <span className="pipeline-id">#{a.candidate_id}</span>
              </td>
              <td>
                <span className="pipeline-job" title={jobs[a.job_id]?.title}>{jobs[a.job_id]?.title ?? `Job #${a.job_id}`}</span>
              </td>
              <td>
                <div className="pipeline-stage"><strong title={stageLabel(a)}>{stageLabel(a)}</strong><Badge value={a.status} /></div>
              </td>
              <td><Workflow application={a} /></td>
              <td>
                {canAssign ? (
                  <select
                    value={a.assigned_recruiter_id ?? ""}
                    onChange={(e) => assign(a.id, Number(e.target.value))}
                  >
                    <option value="">— unassigned —</option>
                    {recruiters.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  recruiterName(a, recruiters, user)
                )}
              </td>
              <td className="pipeline-actions">
                {nextAction(a, () => setActive(a), () => navigate(`/kyc?candidate_id=${a.candidate_id}&application_id=${a.id}`))}
              </td>
            </tr>
          ))}
          {apps.length === 0 && (
            <tr>
              <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>
                No applications in the pipeline.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      {active && (
        <RecruitmentWorkflowModal
          application={active}
          candidateName={candidates[active.candidate_id]?.full_name ?? `Candidate #${active.candidate_id}`}
          onClose={() => setActive(null)}
          onCompleted={() => { setActive(null); load(); }}
        />
      )}
    </div>
  );
}

function stageLabel(application: Application) {
  if (["interested", "assigned", "contact_pending", "contact_attempted", "contact_successful", "unable_to_reach", "not_interested"].includes(application.status)) return "Contact";
  if (application.status === "documents") return "Documents";
  if (application.status === "validated") return "Validated / Placement";
  if (application.status === "on_hold") return "On hold";
  if (application.status === "released") return "Returned to pool";
  if (application.status === "blocked_for_position") return "Blocked for position";
  if (application.status === "qualified") return "Qualified";
  if (application.status === "not_interested") return "Not interested";
  if (application.status === "unable_to_reach") return "Unable to reach";
  return STAGES.find((stage) => stage.key === application.current_stage_type)?.label ?? application.current_stage_type;
}

function isTerminal(status: string) {
  return ["released", "placed", "rejected", "withdrawn", "closed", "not_interested", "unable_to_reach"].includes(status);
}

function Workflow({ application }: { application: Application }) {
  const steps = ["contact", "screening", "client_interview", "document_verification", "kyc", "placement"];
  const stage = ["interested", "assigned", "contact_pending", "contact_attempted", "contact_successful", "unable_to_reach", "not_interested"].includes(application.status) ? "contact" : application.current_stage_type;
  const step = Math.max(0, steps.indexOf(stage));
  const released = application.status === "released";
  return (
    <div className="pipeline-workflow" title={released ? application.release_reason || "Returned to the pool" : `${stageLabel(application)}: step ${step + 1} of ${steps.length}`}>
      <div className="workflow-track" aria-label={released ? "Returned to pool" : `Step ${step + 1} of ${steps.length}`}>
        {steps.map((item, index) => <span key={item} className={released ? "released" : index < step ? "complete" : index === step ? "current" : ""} />)}
      </div>
      <span>{released ? "Released" : `${step + 1} of ${steps.length}`}</span>
    </div>
  );
}

function nextAction(application: Application, openWorkflow: () => void, manageDocuments: () => void) {
  if (isTerminal(application.status)) return <span className="muted">No action required</span>;
  if (application.status === "documents" || application.status === "kyc") {
    return <><button className="btn primary" onClick={manageDocuments}>Files</button><button className="btn link" onClick={openWorkflow}>Decision</button></>;
  }
  const contactStatuses = new Set(["interested", "contact_pending", "assigned", "contact_attempted", "contact_successful", "unable_to_reach"]);
  const label = contactStatuses.has(application.status) ? "Record contact" : "Open workflow";
  return <button className="btn primary" onClick={openWorkflow}>{label}</button>;
}

function recruiterName(application: Application, recruiters: User[], currentUser: User | null) {
  if (!application.assigned_recruiter_id) return "Unassigned";
  if (application.assigned_recruiter_id === currentUser?.id) return currentUser.full_name;
  return recruiters.find((recruiter) => recruiter.id === application.assigned_recruiter_id)?.full_name ?? `Recruiter #${application.assigned_recruiter_id}`;
}
