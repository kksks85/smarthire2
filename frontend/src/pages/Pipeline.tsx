import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Badge, Modal, PageHead } from "../components/ui";
import type { Application, Candidate, Job, User } from "../types";

const STAGES = [
  { key: "screening", label: "Screening" },
  { key: "client_interview", label: "Client Interview" },
  { key: "document_verification", label: "Document Verification" },
  { key: "placement", label: "Placement" },
];

const APP_STATUSES = [
  "assigned",
  "in_process",
  "in_interview",
  "shortlisted",
  "selected",
  "rejected",
  "placed",
  "closed",
];

export default function Pipeline({ mineOnly = false }: { mineOnly?: boolean }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [apps, setApps] = useState<Application[]>([]);
  const [candidates, setCandidates] = useState<Record<number, Candidate>>({});
  const [jobs, setJobs] = useState<Record<number, Job>>({});
  const [recruiters, setRecruiters] = useState<User[]>([]);
  const [active, setActive] = useState<Application | null>(null);
  const [evalForm, setEvalForm] = useState({ outcome: "passed", score: "", remarks: "" });
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "");

  const canAssign = user?.role === "manager" || user?.role === "admin";

  async function load() {
    const params: Record<string, any> = {};
    if (mineOnly && user) params.recruiter_id = user.id;
    if (statusFilter) params.status = statusFilter;
    const { data } = await api.get<Application[]>("/applications", { params });
    setApps(data);

    const cRes = await api.get<{ items: Candidate[] }>("/candidates", {
      params: { limit: 200 },
    });
    const cMap: Record<number, Candidate> = {};
    cRes.data.items.forEach((c) => (cMap[c.id] = c));
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
    setSearchParams(statusFilter ? { status: statusFilter } : {}, { replace: true });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mineOnly, statusFilter]);

  async function assign(appId: number, recruiterId: number) {
    await api.post(`/applications/${appId}/assign`, {
      assigned_recruiter_id: recruiterId,
    });
    load();
  }

  async function recordEval() {
    if (!active) return;
    await api.post(`/applications/${active.id}/evaluations`, {
      stage_type: active.current_stage_type,
      outcome: evalForm.outcome,
      score: evalForm.score ? Number(evalForm.score) : null,
      remarks: evalForm.remarks,
    });
    setActive(null);
    setEvalForm({ outcome: "passed", score: "", remarks: "" });
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
        <div className="spacer" />
        <span className="muted">
          {apps.length} application{apps.length === 1 ? "" : "s"}
        </span>
      </div>
      <table className="sn-table">
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Job</th>
            <th>Current Stage</th>
            <th>Status</th>
            <th>Recruiter</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id}>
              <td>{candidates[a.candidate_id]?.full_name ?? `#${a.candidate_id}`}</td>
              <td>{jobs[a.job_id]?.title ?? `#${a.job_id}`}</td>
              <td>
                {STAGES.find((s) => s.key === a.current_stage_type)?.label ??
                  a.current_stage_type}
              </td>
              <td>
                <Badge value={a.status} />
              </td>
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
                  a.assigned_recruiter_id ?? "—"
                )}
              </td>
              <td>
                <button className="btn link" onClick={() => setActive(a)}>
                  Record Stage
                </button>
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

      {active && (
        <Modal
          title={`Record — ${
            STAGES.find((s) => s.key === active.current_stage_type)?.label
          }`}
          onClose={() => setActive(null)}
        >
          <div className="field">
            <label>Outcome</label>
            <select
              value={evalForm.outcome}
              onChange={(e) => setEvalForm({ ...evalForm, outcome: e.target.value })}
            >
              <option value="passed">Passed → advance</option>
              <option value="failed">Failed → reject</option>
              <option value="on_hold">On hold</option>
            </select>
          </div>
          <div className="field">
            <label>Score (0–100)</label>
            <input
              type="number"
              value={evalForm.score}
              onChange={(e) => setEvalForm({ ...evalForm, score: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Remarks</label>
            <textarea
              rows={2}
              value={evalForm.remarks}
              onChange={(e) => setEvalForm({ ...evalForm, remarks: e.target.value })}
            />
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={recordEval}>
              Save Evaluation
            </button>
            <button className="btn" onClick={() => setActive(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
