import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHead } from "../components/ui";
import type { Job, User } from "../types";

interface ScreeningMatch {
  candidate_id: number;
  full_name: string;
  primary_trade?: string | null;
  city?: string | null;
  state?: string | null;
  experience_years?: number | null;
  education_level?: string | null;
  score: number;
  reasons: string[];
}

export default function ScreenResources() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [recruiters, setRecruiters] = useState<User[]>([]);
  const [jobId, setJobId] = useState("");
  const [recruiterId, setRecruiterId] = useState("");
  const [matches, setMatches] = useState<ScreeningMatch[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [selectionSize, setSelectionSize] = useState("10");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin" && user?.role !== "manager") return;
    Promise.all([
      api.get<Job[]>("/jobs", { params: { status: "approved" } }),
      api.get<Job[]>("/jobs", { params: { status: "published" } }),
      api.get<User[]>("/users", { params: { role: "recruiter" } }),
    ]).then(([approved, published, recruiterResponse]) => {
      setJobs([...approved.data, ...published.data]);
      setRecruiters(recruiterResponse.data);
    });
  }, [user]);

  if (user?.role !== "admin" && user?.role !== "manager") {
    return <div className="error-note">Only managers and administrators can screen resources.</div>;
  }

  async function screen() {
    if (!jobId) {
      setMessage("Select an approved job first.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { data } = await api.get<ScreeningMatch[]>(`/screening/jobs/${jobId}`);
      setMatches(data);
      setSelected(data.slice(0, Number(selectionSize)).map((match) => match.candidate_id));
      setMessage(data.length ? `${data.length} matching resources found.` : "No matching resources found.");
    } catch (error: any) {
      setMessage(error?.response?.data?.detail ?? "Screening failed.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(candidateId: number) {
    setSelected((current) =>
      current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : [...current, candidateId]
    );
  }

  function selectRanked(value: string) {
    setSelectionSize(value);
    const count = value === "all" ? matches.length : Number(value);
    setSelected(matches.slice(0, count).map((match) => match.candidate_id));
  }

  const selectedLimit = selectionSize === "all" ? matches.length : Number(selectionSize);
  const allRankedSelected = matches.length > 0 && selected.length === Math.min(selectedLimit, matches.length);

  async function assign() {
    if (!jobId || !recruiterId || !selected.length) {
      setMessage("Select a job, recruiter, and at least one screened resource.");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/jobs/${jobId}/assign-recruiter`, { assigned_recruiter_id: Number(recruiterId) });
      const results = await Promise.allSettled(
        selected.map((candidate_id) =>
          api.post("/applications", {
            candidate_id,
            job_id: Number(jobId),
            assigned_recruiter_id: Number(recruiterId),
          })
        )
      );
      const assigned = results.filter((result) => result.status === "fulfilled").length;
      setMessage(`${assigned} resource${assigned === 1 ? "" : "s"} assigned to the recruiter.`);
      setSelected([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHead title="Screen Resources" breadcrumb="Recruitment › Screen Resources" />
      {message && <div className="inline-note">{message}</div>}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="form-grid" style={{ border: "none", padding: 0 }}>
            <div className="field">
              <label>Approved Job</label>
              <select value={jobId} onChange={(event) => {
                setJobId(event.target.value);
                setMatches([]);
                setSelected([]);
              }}>
                <option value="">Select a job</option>
                {jobs.map((job) => <option key={job.id} value={job.id}>{job.title} - {job.work_city || job.work_state || "Any location"}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Assign Selected Resources To</label>
              <select value={recruiterId} onChange={(event) => setRecruiterId(event.target.value)}>
                <option value="">Select a recruiter</option>
                {recruiters.map((recruiter) => <option key={recruiter.id} value={recruiter.id}>{recruiter.full_name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Select Ranked Resources</label>
              <select value={selectionSize} onChange={(event) => selectRanked(event.target.value)} disabled={!matches.length}>
                <option value="10">Top 10 matches</option>
                <option value="20">Top 20 matches</option>
                <option value="50">Top 50 matches</option>
                <option value="100">Top 100 matches</option>
                <option value="all">All matching resources</option>
              </select>
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={screen} disabled={busy}>Screen Resources</button>
            <button className="btn" onClick={assign} disabled={busy || !recruiterId || !selected.length}>
              Assign {selected.length} Selected
            </button>
          </div>
        </div>
      </div>
      <table className="sn-table">
        <thead><tr><th><input type="checkbox" aria-label="Select ranked resources" checked={allRankedSelected} onChange={() => setSelected(allRankedSelected ? [] : matches.slice(0, selectedLimit).map((match) => match.candidate_id))} disabled={!matches.length} /></th><th>Candidate</th><th>Trade</th><th>Location</th><th>Experience</th><th>Education</th><th>Match</th></tr></thead>
        <tbody>
          {matches.map((match) => (
            <tr key={match.candidate_id}>
              <td><input type="checkbox" checked={selected.includes(match.candidate_id)} onChange={() => toggle(match.candidate_id)} /></td>
              <td>{match.full_name}</td>
              <td>{match.primary_trade || "-"}</td>
              <td>{[match.city, match.state].filter(Boolean).join(", ") || "-"}</td>
              <td>{match.experience_years ?? 0} yrs</td>
              <td>{match.education_level || "-"}</td>
              <td><strong>{match.score}%</strong><br /><span className="muted">{match.reasons.join(", ")}</span></td>
            </tr>
          ))}
          {!matches.length && <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 20 }}>Select an approved job and screen the resource bank.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
