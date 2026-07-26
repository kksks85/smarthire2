import { useEffect, useState } from "react";
import api from "../api/client";
import { PageHead } from "../components/ui";

interface LocationLog {
  id: number;
  field_agent_id: number;
  candidate_id?: number | null;
  event_type: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  address_text?: string | null;
}

export default function Locations() {
  const [logs, setLogs] = useState<LocationLog[]>([]);

  useEffect(() => {
    api.get<LocationLog[]>("/field-agents/location").then((r) => setLogs(r.data));
  }, []);

  return (
    <div>
      <PageHead
        title="Agent Location Log"
        breadcrumb="Field Operations › Agent Location Log"
      />
      <table className="sn-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Event</th>
            <th>Candidate</th>
            <th>Coordinates</th>
            <th>Accuracy</th>
            <th>Notes</th>
            <th>Map</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>#{l.field_agent_id}</td>
              <td>{l.event_type.replace(/_/g, " ")}</td>
              <td>{l.candidate_id ? `#${l.candidate_id}` : "—"}</td>
              <td className="pii">
                {l.latitude.toFixed(5)}, {l.longitude.toFixed(5)}
              </td>
              <td>{l.accuracy_m ? `±${Math.round(l.accuracy_m)}m` : "—"}</td>
              <td>{l.address_text ?? "—"}</td>
              <td>
                <a
                  href={`https://www.google.com/maps?q=${l.latitude},${l.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View
                </a>
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 20 }}>
                No location logs.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
