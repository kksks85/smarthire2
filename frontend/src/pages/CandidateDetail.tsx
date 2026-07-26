import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";
import { Badge, Modal, PageHead } from "../components/ui";
import type { Candidate, CandidatePii } from "../types";

export default function CandidateDetail() {
  const { id } = useParams();
  const [c, setC] = useState<Candidate | null>(null);
  const [pii, setPii] = useState<CandidatePii | null>(null);
  const [show, setShow] = useState(false);

  const load = useCallback(() => {
    api.get<Candidate>(`/candidates/${id}`).then((r) => setC(r.data));
  }, [id]);
  useEffect(load, [load]);

  async function reveal() {
    const { data } = await api.post<CandidatePii>(`/candidates/${id}/reveal`);
    setPii(data);
    setShow(true);
  }

  if (!c) return <div className="muted">Loading…</div>;

  return (
    <div>
      <PageHead
        title={c.full_name}
        breadcrumb="Candidate Data Bank › Candidate"
        actions={
          <div className="btn-row">
            <Badge value={c.status} />
            <button className="btn" onClick={reveal}>
              Reveal PII
            </button>
          </div>
        }
      />

      <div className="card">
        <div className="card-head">Profile</div>
        <div className="card-body">
          <div className="form-grid" style={{ border: "none", padding: 0 }}>
            <Item label="Primary Trade" value={c.primary_trade} />
            <Item label="Experience" value={`${c.experience_years ?? 0} yrs`} />
            <Item label="Education" value={c.education_level} />
            <Item label="Certification" value={c.certification} />
            <Item label="Languages" value={c.languages} />
            <Item
              label="Expected Salary"
              value={c.expected_salary ? `₹ ${c.expected_salary}/mo` : "—"}
            />
            <Item label="City / State" value={[c.city, c.state].filter(Boolean).join(", ")} />
            <Item label="Source" value={c.source} />
            <Item label="Phone (masked)" value={c.phone} mono />
            <Item label="Driving License" value={c.has_driving_license ? "Yes" : "No"} />
            <Item label="Relocate" value={c.willing_to_relocate ? "Yes" : "No"} />
          </div>
        </div>
      </div>

      {show && pii && (
        <Modal title={`PII — ${c.full_name}`} onClose={() => setShow(false)}>
          <div className="inline-note">This reveal has been logged to the audit trail.</div>
          <Item label="Phone" value={pii.phone} mono />
          <Item label="Email" value={pii.email} />
          <Item label="Address" value={pii.address} />
        </Modal>
      )}
    </div>
  );
}

function Item({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className={mono ? "pii" : undefined}>{value || "—"}</div>
    </div>
  );
}
