import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { Badge, PageHead } from "../components/ui";
import type { Job } from "../types";

interface Lead {
  id: number;
  source: string;
  source_detail?: string | null;
  full_name?: string | null;
  phone?: string | null;
  trade?: string | null;
  city?: string | null;
  state?: string | null;
  status: string;
  candidate_id?: number | null;
  created_at: string;
}

export default function Leads() {
  const navigate = useNavigate();
  const [view, setView] = useState<"jobs" | "leads">("jobs");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");

  const loadLeads = () => api.get<Lead[]>("/leads").then((r) => setLeads(r.data));
  const loadJobs = () => api.get<Job[]>("/jobs?status=published&with_stats=true").then((r) => setJobs(r.data));

  useEffect(() => {
    loadLeads();
    loadJobs();
  }, []);

  async function promote(id: number) {
    await api.post(`/leads/${id}/promote`);
    loadLeads();
  }

  const sources = [...new Set(leads.map((lead) => lead.source))].sort();
  const visibleLeads = leads.filter((lead) => {
    const text = [lead.full_name, lead.phone, lead.trade, lead.city, lead.state, lead.source, lead.source_detail]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!source || lead.source === source);
  });

  const visibleJobs = jobs.filter((j) => {
    const text = [j.title, j.category, j.work_city, j.work_state].filter(Boolean).join(" ").toLowerCase();
    return !query || text.includes(query.toLowerCase());
  });

  return (
    <div>
      <PageHead title="Inbound Leads" breadcrumb="Candidate Data Bank › Registered Candidates" />
      <div className="form-tabs">
        <div className={"form-tab" + (view === "jobs" ? " active" : "")} onClick={() => setView("jobs")}>
          Job Funnel
        </div>
        <div className={"form-tab" + (view === "leads" ? " active" : "")} onClick={() => setView("leads")}>
          All Registrations
        </div>
      </div>

      {view === "jobs" && (
        <>
          <div className="inline-note">
            Live recruitment funnel for every published job opening. Counts are calculated from candidate application statuses.
          </div>
          <div className="list-toolbar">
            <input
              placeholder="Search job title, category, or location..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="spacer" />
            <span className="muted">{visibleJobs.length} job{visibleJobs.length === 1 ? "" : "s"}</span>
          </div>
          <div className="job-card-grid">
            {visibleJobs.map((job) => (
              <div className="job-card" key={job.id}>
                <div className="job-card-head">
                  <div className="job-card-title">{job.title}</div>
                  <div className="job-card-meta">{[job.category, job.work_city, job.work_state].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="job-card-stats">
                  <div className="job-card-stat">
                    <div className="job-card-stat-value">{job.stats?.interested ?? 0}</div>
                    <div className="job-card-stat-label">Interested</div>
                  </div>
                  <div className="job-card-stat">
                    <div className="job-card-stat-value">{job.stats?.contact_successful ?? 0}</div>
                    <div className="job-card-stat-label">Contacted</div>
                  </div>
                  <div className="job-card-stat">
                    <div className="job-card-stat-value">{job.stats?.blocked_for_position ?? 0}</div>
                    <div className="job-card-stat-label">Blocked</div>
                  </div>
                </div>
                <div className="job-card-actions">
                  <button className="btn link" onClick={() => navigate(`/pipeline?job_id=${job.id}`)}>
                    View Pipeline
                  </button>
                </div>
              </div>
            ))}
            {visibleJobs.length === 0 && (
              <div className="muted" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40 }}>
                No published job openings found.
              </div>
            )}
          </div>
        </>
      )}

      {view === "leads" && (
        <>
          <div className="inline-note">
            All candidate registrations are listed here, including the registration source and its detail.
          </div>
          <div className="list-toolbar">
            <input
              placeholder="Search name, phone, trade, or location..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="">All sources</option>
              {sources.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <div className="spacer" />
            <span className="muted">{visibleLeads.length} of {leads.length} registrations</span>
          </div>
          <table className="sn-table">
            <thead>
              <tr>
                <th>Candidate ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Trade</th>
                <th>Location</th>
                <th>Source</th>
                <th>Detail</th>
                <th>Registered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleLeads.map((l) => (
                <tr key={l.id}>
                  <td>{l.candidate_id ? `#${l.candidate_id}` : "—"}</td>
                  <td
                    className={l.candidate_id ? "row-link" : undefined}
                    onClick={() => l.candidate_id && navigate(`/candidates/${l.candidate_id}`)}
                  >
                    {l.full_name ?? "—"}
                  </td>
                  <td className="pii">{l.phone ?? "—"}</td>
                  <td>{l.trade ?? "—"}</td>
                  <td>{[l.city, l.state].filter(Boolean).join(", ") || "—"}</td>
                  <td>{l.source}</td>
                  <td>{l.source_detail ?? "—"}</td>
                  <td>{new Date(l.created_at).toLocaleString()}</td>
                  <td>
                    {l.candidate_id ? (
                      <button className="btn link" onClick={() => navigate(`/candidates/${l.candidate_id}`)}>
                        View Candidate
                      </button>
                    ) : l.status === "new" ? (
                      <button className="btn link" onClick={() => promote(l.id)}>
                        Promote
                      </button>
                    ) : <Badge value={l.status} />}
                  </td>
                </tr>
              ))}
              {visibleLeads.length === 0 && (
                <tr>
                  <td colSpan={9} className="muted" style={{ textAlign: "center", padding: 20 }}>
                    No registered candidates match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
