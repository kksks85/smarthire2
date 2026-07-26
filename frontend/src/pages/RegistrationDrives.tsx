import { useEffect, useState } from "react";
import api from "../api/client";
import { Badge, PageHead } from "../components/ui";
import type { FieldDrive } from "../types";

const SETUP_LABELS: Record<string, string> = {
  canopy: "Canopy",
  moving_van: "Moving Van",
  table_desk: "Table / Desk",
  tent: "Tent",
  kiosk: "Kiosk",
  other: "Other",
};

/**
 * Admin/manager oversight view of every field agent's registration drives
 * (read-only). Field agents manage their own drives from the homepage box.
 */
export default function RegistrationDrives() {
  const [drives, setDrives] = useState<FieldDrive[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get<FieldDrive[]>("/field-drives", { params: status ? { status } : {} })
      .then((r) => setDrives(r.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [status]);

  return (
    <div>
      <PageHead title="Registration Drives" breadcrumb="Field Operations › Registration Drives" />
      <div className="list-toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
        <div className="spacer" />
        <span className="muted">{drives.length} drive{drives.length === 1 ? "" : "s"}</span>
      </div>
      <table className="sn-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Venue</th>
            <th>Setup</th>
            <th>Location</th>
            <th>Field Agent</th>
            <th>Candidates</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 20 }}>
                Loading…
              </td>
            </tr>
          )}
          {!loading &&
            drives.map((d) => (
              <tr key={d.id}>
                <td>{d.title}</td>
                <td>{d.venue_name}</td>
                <td>
                  {d.setup_type === "other" && d.setup_type_other
                    ? d.setup_type_other
                    : SETUP_LABELS[d.setup_type] || d.setup_type}
                </td>
                <td>{[d.city, d.state].filter(Boolean).join(", ") || "—"}</td>
                <td>{d.field_agent_name || `#${d.field_agent_id}`}</td>
                <td>{d.candidate_count}</td>
                <td>
                  <Badge value={d.status} />
                </td>
              </tr>
            ))}
          {!loading && drives.length === 0 && (
            <tr>
              <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 20 }}>
                No registration drives recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
