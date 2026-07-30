import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import FieldAgentGpsTile from "../components/FieldAgentGpsTile";
import FieldDriveBox from "../components/FieldDriveBox";
import { PageHead } from "../components/ui";
import type { Dashboard } from "../types";

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
            const className = "kpi" + (clickable ? " clickable" : "");
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
                <div className="value">{c.value}</div>
                <div className="label">{c.label}</div>
                {c.hint && <div className="hint">{c.hint}</div>}
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
