import { useEffect, useState } from "react";
import api from "../../api/client";
import { PageHead } from "../../components/ui";

interface Stage {
  id: number;
  name: string;
  stage_type: string;
  order_index: number;
  is_active: boolean;
}

export default function Stages() {
  const [stages, setStages] = useState<Stage[]>([]);

  useEffect(() => {
    api.get<Stage[]>("/interview-stages").then((r) => setStages(r.data));
  }, []);

  return (
    <div>
      <PageHead title="Interview Stages" breadcrumb="Administration › Interview Stages" />
      <div className="inline-note">
        The ordered stages every application flows through: Screening → Client Interview →
        Document Verification → Placement.
      </div>
      <table className="sn-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Name</th>
            <th>Type</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s) => (
            <tr key={s.id}>
              <td>{s.order_index}</td>
              <td>{s.name}</td>
              <td>{s.stage_type.replace(/_/g, " ")}</td>
              <td>{s.is_active ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
