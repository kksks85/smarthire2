import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import { Badge, Modal, PageHead } from "../../components/ui";
import type { Candidate, CandidatePii } from "../../types";

interface StudentCentralCandidate extends Candidate {
  institution_name?: string | null;
}

type ColumnKey = string;

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "institution_name", label: "Institution" },
  { key: "full_name", label: "Name" },
  { key: "primary_trade", label: "Trade" },
  { key: "phone", label: "Phone" },
  { key: "gender", label: "Gender" },
  { key: "date_of_birth", label: "Date of Birth" },
  { key: "education_level", label: "Qualification" },
  { key: "experience_years", label: "Experience (Years)" },
  { key: "expected_salary", label: "Expected Salary" },
  { key: "email", label: "Email" },
  { key: "city", label: "District" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode" },
  { key: "willing_to_relocate", label: "Willing to Relocate" },
  { key: "certification", label: "Certification" },
  { key: "languages", label: "Languages" },
  { key: "status", label: "Status" },
  { key: "date_of_birth_or_age", label: "Age / DOB" },
  { key: "passing_year", label: "Passing Year" },
  { key: "current_status", label: "Current Status" },
  { key: "preferred_job_role", label: "Preferred Job Role" },
  { key: "experience_level", label: "Fresher / Experienced" },
  { key: "remarks", label: "Remarks / Special Skills" },
  { key: "actions", label: "Actions" },
];

const DEFAULT_COLUMNS: ColumnKey[] = [
  "institution_name",
  "full_name",
  "primary_trade",
  "phone",
  "city",
  "state",
  "status",
  "actions",
];

function getCellValue(candidate: StudentCentralCandidate, key: ColumnKey): string {
  if (key === "institution_name") return candidate.institution_name ?? "—";
  if (key === "city") return candidate.city ?? "—";
  if (key === "state") return candidate.state ?? "—";
  if (key === "status") return candidate.status;
  if (key === "willing_to_relocate") return candidate.willing_to_relocate ? "Yes" : "No";
  if ((candidate as any)[key] !== undefined && (candidate as any)[key] !== null) {
    return String((candidate as any)[key]);
  }
  const profile = candidate.profile_data || {};
  if (profile[key] !== undefined && profile[key] !== null) {
    return String(profile[key]);
  }
  return "—";
}

export default function StudentCentral() {
  const [items, setItems] = useState<StudentCentralCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [trade, setTrade] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [offset, setOffset] = useState(0);
  const [showColumns, setShowColumns] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(() => {
    const saved = localStorage.getItem("sh_student_central_columns_v2");
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
  });
  const [reveal, setReveal] = useState<{ c: StudentCentralCandidate; pii: CandidatePii } | null>(null);
  const limit = 50;

  useEffect(() => {
    localStorage.setItem("sh_student_central_columns_v2", JSON.stringify(selectedColumns));
  }, [selectedColumns]);

  async function doReveal(c: StudentCentralCandidate) {
    const { data } = await api.post<CandidatePii>(`/candidates/${c.id}/reveal`);
    setReveal({ c, pii: data });
  }

  function load() {
    const params: Record<string, string> = { limit: String(limit), offset: String(offset) };
    if (q) params.q = q;
    if (status) params.status = status;
    if (trade) params.trade = trade;
    api.get<{ total: number; items: StudentCentralCandidate[] }>("/candidates/student-central", { params }).then((r) => {
      setItems(r.data.items);
      setTotal(r.data.total);
    });
  }

  useEffect(() => {
    setOffset(0);
  }, [q, status, trade, institutionName]);

  useEffect(() => {
    load();
  }, [q, status, trade, offset]);

  const filteredItems = useMemo(() => {
    if (!institutionName.trim()) return items;
    return items.filter((c) =>
      (c.institution_name ?? "").toLowerCase().includes(institutionName.toLowerCase())
    );
  }, [items, institutionName]);

  const visibleColumns = useMemo(
    () => ALL_COLUMNS.filter((c) => selectedColumns.includes(c.key)),
    [selectedColumns]
  );

  function toggleColumn(key: ColumnKey) {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  return (
    <div>
      <PageHead title="Student Central" breadcrumb="Administration › Student Central" />
      <div className="inline-note">
        Phone numbers and personal details are masked by default. Selecting
        <strong> Reveal </strong> is recorded in the PII access audit log against your user.
      </div>

      <div className="list-toolbar">
        <input placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <input placeholder="Trade…" value={trade} onChange={(e) => setTrade(e.target.value)} />
        <input placeholder="Institution…" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {["new", "screened", "shortlisted", "in_process", "placed", "rejected"].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <div className="spacer" />
        <button className="btn" onClick={() => setShowColumns((v) => !v)}>Columns</button>
        <span className="muted">{filteredItems.length} of {total}</span>
      </div>

      {showColumns && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-head">Choose columns to display</div>
          <div className="card-body" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {ALL_COLUMNS.map((col) => (
              <label key={col.key} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 180 }}>
                <input
                  type="checkbox"
                  checked={selectedColumns.includes(col.key)}
                  onChange={() => toggleColumn(col.key)}
                />
                {col.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="table-wrapper">
        <table className="sn-table">
          <thead>
            <tr>
              {visibleColumns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((c) => (
              <tr key={c.id}>
                {visibleColumns.map((col) => (
                  <td key={col.key} className={col.key === "phone" ? "pii" : ""}>
                    {col.key === "status" ? (
                      <Badge value={c.status} />
                    ) : col.key === "actions" ? (
                      <button className="btn link" onClick={() => doReveal(c)}>
                        Reveal
                      </button>
                    ) : (
                      getCellValue(c, col.key)
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length} className="muted" style={{ textAlign: "center", padding: 20 }}>
                  No institution-uploaded candidates found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => setOffset((o) => Math.max(0, o - limit))} disabled={offset === 0}>
          Previous
        </button>
        <span className="muted">Page {Math.floor(offset / limit) + 1}</span>
        <button className="btn" onClick={() => setOffset((o) => o + limit)} disabled={offset + limit >= total}>
          Next
        </button>
      </div>

      {reveal && (
        <Modal title={`PII — ${reveal.c.full_name}`} onClose={() => setReveal(null)}>
          <div className="inline-note">
            This reveal has been logged to the audit trail.
          </div>
          <div className="form-grid one-col" style={{ border: "none", padding: 0 }}>
            <div className="field">
              <label>Phone</label>
              <input readOnly value={reveal.pii.phone} />
            </div>
            <div className="field">
              <label>Email</label>
              <input readOnly value={reveal.pii.email ?? "—"} />
            </div>
            <div className="field">
              <label>Address</label>
              <textarea readOnly value={reveal.pii.address ?? "—"} rows={2} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
