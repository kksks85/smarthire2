import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { PageHead } from "../../components/ui";
import type { InstitutionUploadSummary } from "../../types";

const TEMPLATE_COLUMNS = [
  "Student Name",
  "Mobile Number",
  "Gender",
  "Date of Birth / Age",
  "Qualification",
  "Course / Trade / Specialization",
  "Passing Year / Expected Passing Year",
  "Current Status (Current Student / Alumni)",
  "Preferred Job Role",
  "District",
  "State",
  "Willing to Relocate (Yes/No)",
  "Fresher / Experienced",
  "Experience (Months/Years)",
  "Remarks / Special Skills",
];

export default function InstitutionUpload() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<InstitutionUploadSummary | null>(null);

  function downloadCsvTemplate() {
    const header = TEMPLATE_COLUMNS.join(",");
    const example = [
      "Ravi Kumar",
      "9876543210",
      "Male",
      "21",
      "ITI",
      "Electrician",
      "2024",
      "Current Student",
      "Electrician",
      "Pune",
      "Maharashtra",
      "Yes",
      "Fresher",
      "0",
      "Good communication, punctual",
    ].join(",");
    const blob = new Blob([header + "\n" + example + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "smarthire-institution-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Select an Excel or CSV file to upload.");
      return;
    }
    setBusy(true);
    setError("");
    setSummary(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post<InstitutionUploadSummary>("/institutions/me/upload-candidates", formData);
      setSummary(data);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Upload failed. Please check the file and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHead
        title="Upload Candidates"
        breadcrumb="Institution Portal › Upload Candidates"
      />
      <div className="card">
        <div className="card-head">Upload File</div>
        <div className="card-body">
          <div className="inline-note">
            Upload an Excel (.xlsx) or CSV file using the institution template.
            <strong> Student Name, Mobile Number and Course / Trade / Specialization </strong> are mandatory for every row.
          </div>
          <div className="btn-row" style={{ margin: "14px 0" }}>
            <button className="btn" onClick={downloadCsvTemplate}>Download CSV Template</button>
            <span className="muted">Excel template: same headers as the CSV.</span>
          </div>
          <div className="field">
            <label>File (.xlsx or .csv)</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.csv" />
          </div>
          {error && <div className="error-note" style={{ marginTop: 12 }}>{error}</div>}
          {summary && (
            <div className="success-note" style={{ marginTop: 12 }}>
              Uploaded <strong>{summary.created}</strong> candidates.
              {summary.skipped > 0 && <> Skipped <strong>{summary.skipped}</strong> rows.</>}
              {summary.errors && summary.errors.length > 0 && (
                <ul style={{ marginTop: 8 }}>
                  {summary.errors.slice(0, 10).map((err: string, idx: number) => <li key={idx}>{err}</li>)}
                </ul>
              )}
            </div>
          )}
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={upload} disabled={busy}>
              {busy ? "Uploading…" : "Upload Candidates"}
            </button>
            <button className="btn" onClick={() => navigate("/institution/uploads")}>
              View Upload Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
