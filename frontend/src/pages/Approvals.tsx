import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { PageHead } from "../components/ui";
import type { Job } from "../types";

export default function Approvals() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    api
      .get<Job[]>("/jobs", { params: { status: "pending_approval" } })
      .then((r) => setJobs(r.data));
  }, []);

  return (
    <div>
      <PageHead title="Pending Approvals" breadcrumb="Jobs & Requisitions › Approvals" />
      <table className="sn-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Category</th>
            <th>Vacancies</th>
            <th>Location</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td className="row-link" onClick={() => navigate(`/jobs/${j.id}`)}>
                {j.title}
              </td>
              <td>{j.category}</td>
              <td>{j.vacancies}</td>
              <td>{[j.work_city, j.work_state].filter(Boolean).join(", ") || "—"}</td>
              <td>
                <button className="btn link" onClick={() => navigate(`/jobs/${j.id}`)}>
                  Review
                </button>
              </td>
            </tr>
          ))}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={5} className="muted" style={{ textAlign: "center", padding: 20 }}>
                No jobs awaiting approval.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
