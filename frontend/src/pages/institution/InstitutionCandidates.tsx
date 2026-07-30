import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/client";
import { Badge, PageHead } from "../../components/ui";
import type { Candidate } from "../../types";

type ColumnKey = string;

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
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
];

const DEFAULT_COLUMNS: ColumnKey[] = [
  "full_name",
  "primary_trade",
  "phone",
  "city",
  "state",
  "status",
];

function getCellValue(candidate: Candidate, key: ColumnKey): string {
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

export default function InstitutionCandidates() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Candidate[]>([]);
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(() => {
    const saved = localStorage.getItem("sh_institution_columns");
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
  });

  function load() {
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (status) params.status = status;
    api.get<Candidate[]>("/institutions/me/candidates", { params }).then((r) => setItems(r.data));
  }

  useEffect(() => {
    const next: Record<string, string> = {};
    if (q) next.q = q;
    if (status) next.status = status;
    setSearchParams(next, { replace: true });
    load();
  }, [q, status]);

  useEffect(() => {
    localStorage.setItem("sh_institution_columns", JSON.stringify(selectedColumns));
  }, [selectedColumns]);

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
      <PageHead
        title="My Candidates"
        breadcrumb="Institution Portal › My Candidates"
      />
      <div className="list-toolbar">
        <input placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {["new", "screened", "shortlisted", "in_process", "placed", "rejected"].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <div className="spacer" />
        <button className="btn" onClick={() => setShowColumnPicker((v) => !v)}>
          Columns
        </button>
        <span className="muted">{items.length} candidates</span>
      </div>

      {showColumnPicker && (
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
            {items.map((c) => (
              <tr key={c.id}>
                {visibleColumns.map((col) => (
                  <td key={col.key} className={col.key === "phone" ? "pii" : ""}>
                    {col.key === "status" ? <Badge value={c.status} /> : getCellValue(c, col.key)}
                  </td>
                ))}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length} className="muted" style={{ textAlign: "center", padding: 20 }}>
                  No candidates found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
