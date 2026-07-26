import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useFieldAgentTracker } from "../hooks/useFieldAgentTracker";
import { NAV_GROUPS } from "./nav";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  manager: "Recruiting Manager",
  recruiter: "Recruiter",
  institution: "Institution",
  employer: "Employer",
  field_agent: "Field Agent",
};

export default function Layout() {
  const { user, logout } = useAuth();
  const [filter, setFilter] = useState("");
  const location = useLocation();

  // Background GPS auto-tracker for field agents (no-op for other roles).
  useFieldAgentTracker();

  const groups = useMemo(() => {
    if (!user) return [];
    const term = filter.trim().toLowerCase();
    return NAV_GROUPS.map((g) => ({
      ...g,
      modules: g.modules.filter(
        (m) =>
          m.roles.includes(user.role) &&
          (!term || m.label.toLowerCase().includes(term))
      ),
    })).filter((g) => g.modules.length > 0);
  }, [user, filter]);

  if (!user) return null;

  const initials = user.full_name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <header className="sn-banner">
        <div className="brand">
          <img src="/logo.png" alt="SmartHire" className="banner-logo" />
          <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.7 }}>
            SMART Hire by Layam Group
          </span>
        </div>
        <div className="spacer" />
        <div className="user-chip">
          <span className="avatar">{initials}</span>
          <div style={{ lineHeight: 1.2 }}>
            <div>{user.full_name}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>
              {ROLE_LABELS[user.role]}
            </div>
          </div>
          <button className="logout" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <div className="sn-shell">
        <nav className="sn-nav">
          <div className="filter">
            <input
              placeholder="Filter navigator"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          {groups.map((g) => (
            <div key={g.title}>
              <div className="nav-group-title">{g.title}</div>
              {g.modules.map((m) => (
                <NavLink
                  key={m.path}
                  to={m.path}
                  end={m.path === "/"}
                  className={({ isActive }) =>
                    "nav-item" + (isActive ? " active" : "")
                  }
                >
                  {m.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <main className="sn-content" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </>
  );
}
