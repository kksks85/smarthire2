import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import FieldAgentGpsTile from "../components/FieldAgentGpsTile";
import FieldDriveBox from "../components/FieldDriveBox";
import { PageHead } from "../components/ui";
import type { Dashboard } from "../types";

const KPI_DETAILS: Record<string, { group: string; description: string; tone: string }> = {
  "Total Candidates": { group: "Talent pool", description: "People available across your data bank", tone: "teal" },
  Placed: { group: "Outcome", description: "Candidates successfully placed", tone: "green" },
  "Jobs Pending Approval": { group: "Attention", description: "Requisitions waiting for a decision", tone: "amber" },
  "Published Jobs": { group: "Hiring demand", description: "Roles currently visible to applicants", tone: "blue" },
  Admins: { group: "Team access", description: "System administrators", tone: "slate" },
  Managers: { group: "Team access", description: "Recruiting managers", tone: "blue" },
  Recruiters: { group: "Team access", description: "Active recruiting team", tone: "teal" },
  "Field Agents": { group: "Team access", description: "Field registration staff", tone: "amber" },
  Institutions: { group: "Partners", description: "Candidate source partners", tone: "purple" },
  Employers: { group: "Partners", description: "Hiring client organizations", tone: "rose" },
  "My Assignments": { group: "My work", description: "Candidates assigned to you", tone: "teal" },
  "In Interview": { group: "My work", description: "Candidates in an active interview", tone: "blue" },
  Selected: { group: "My work", description: "Candidates selected for the next step", tone: "green" },
  "KYC Pending": { group: "Attention", description: "Documents awaiting verification", tone: "amber" },
  "Candidates Registered": { group: "My activity", description: "Candidates registered by you", tone: "teal" },
  "Registered Today": { group: "Today", description: "New registrations since midnight", tone: "blue" },
  "Registered This Month": { group: "This month", description: "New registrations this month", tone: "purple" },
  "Location Check-ins": { group: "My activity", description: "Recorded field check-ins", tone: "amber" },
  "Candidates Uploaded": { group: "My activity", description: "Candidates uploaded by your institution", tone: "teal" },
  "Our Job Postings": { group: "Hiring demand", description: "Roles created by your organization", tone: "blue" },
  Published: { group: "Hiring demand", description: "Roles visible to applicants", tone: "green" },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    api.get<Dashboard>("/dashboard").then((r) => setData(r.data));
  }, []);

  return (
    <div>
      <PageHead
        title={`Welcome, ${user?.full_name.split(" ")[0]}`}
        breadcrumb="Overview"
        actions={
          user?.role === "admin" || user?.role === "manager" ? (
            <button className="btn primary" onClick={() => navigate("/screen-resources")}>
              Screen Resources
            </button>
          ) : undefined
        }
      />
      <div className="dashboard-top-row">
        <div className="kpi-grid">
          {data?.cards.map((c) => {
            const clickable = !!c.link;
            const detail = KPI_DETAILS[c.label] ?? {
              group: "Overview",
              description: c.hint ?? "Current total",
              tone: "teal",
            };
            const className = `kpi kpi-${detail.tone}${clickable ? " clickable" : ""}`;
            const onClick = clickable ? () => navigate(c.link as string) : undefined;
            return (
              <div
                className={className}
                key={c.label}
                onClick={onClick}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(c.link as string);
                        }
                      }
                    : undefined
                }
                title={clickable ? `Drill into ${c.label}` : undefined}
              >
                <div className="kpi-topline">
                  <span className="kpi-group">{detail.group}</span>
                  {clickable && <span className="kpi-arrow" aria-hidden="true">View</span>}
                </div>
                <div className="kpi-value-row">
                  <div className="value">{c.value.toLocaleString()}</div>
                  <span className="kpi-marker" aria-hidden="true" />
                </div>
                <div className="label">{c.label}</div>
                <div className="hint">{c.hint ?? detail.description}</div>
              </div>
            );
          })}
          {!data && <div className="muted">Loading KPIs…</div>}
          {data && data.cards.length === 0 && (
            <div className="muted">No KPIs available for your role.</div>
          )}
        </div>
        {user?.role === "field_agent" && <FieldAgentGpsTile />}
      </div>
      {user?.role === "field_agent" && <FieldDriveBox />}
    </div>
  );
}
