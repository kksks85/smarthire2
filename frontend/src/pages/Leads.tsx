import { useEffect, useState } from "react";
import api from "../api/client";
import { Badge, PageHead } from "../components/ui";

interface Lead {
  id: number;
  source: string;
  full_name?: string | null;
  phone?: string | null;
  trade?: string | null;
  city?: string | null;
  state?: string | null;
  status: string;
  candidate_id?: number | null;
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);

  const load = () => api.get<Lead[]>("/leads").then((r) => setLeads(r.data));
  useEffect(() => {
    load();
  }, []);

  async function promote(id: number) {
    await api.post(`/leads/${id}/promote`);
    load();
  }

  return (
    <div>
      <PageHead title="Inbound Leads" breadcrumb="Candidate Data Bank › Inbound Leads" />
      <div className="inline-note">
        Leads captured via the generic inbound webhook and website. Promote a lead to add
        it to the Candidate Data Bank.
      </div>
      <table className="sn-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Trade</th>
            <th>Location</th>
            <th>Source</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id}>
              <td>{l.full_name ?? "—"}</td>
              <td className="pii">{l.phone ?? "—"}</td>
              <td>{l.trade ?? "—"}</td>
              <td>{[l.city, l.state].filter(Boolean).join(", ") || "—"}</td>
              <td>{l.source}</td>
              <td>
                <Badge value={l.status} />
              </td>
              <td>
                {l.status === "new" && (
                  <button className="btn link" onClick={() => promote(l.id)}>
                    Promote
                  </button>
                )}
              </td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 20 }}>
                No inbound leads.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
