import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { Badge, PageHead } from "../components/ui";
import type { Job } from "../types";

export default function Jobs() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState(searchParams.get("status") || "");

  function load() {
    const params = status ? { status } : {};
    api.get<Job[]>("/jobs", { params }).then((r) => setJobs(r.data));
  }
  useEffect(() => {
    setSearchParams(status ? { status } : {}, { replace: true });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div>
      <PageHead
        title="Job Postings"
        breadcrumb="Jobs & Requisitions › Job Postings"
        actions={
          <button className="btn primary" onClick={() => navigate("/jobs/new")}>
            + Create Job
          </button>
        }
      />
      <div className="list-toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {["draft", "pending_approval", "approved", "published", "closed", "rejected"].map(
            (s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            )
          )}
        </select>
        <div className="spacer" />
        <span className="muted">{jobs.length} postings</span>
      </div>
      <table className="sn-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Category</th>
            <th>Location</th>
            <th>Vacancies</th>
            <th>Salary (₹/mo)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td className="row-link" onClick={() => navigate(`/jobs/${j.id}`)}>
                {j.title}
              </td>
              <td>{j.category}</td>
              <td>{[j.work_city, j.work_state].filter(Boolean).join(", ") || "—"}</td>
              <td>{j.vacancies}</td>
              <td>
                {j.salary_min || j.salary_max
                  ? `${j.salary_min ?? "?"} – ${j.salary_max ?? "?"}`
                  : "—"}
              </td>
              <td>
                <Badge value={j.status} />
              </td>
            </tr>
          ))}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>
                No job postings.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
