import { useEffect, useState } from "react";
import api from "../../api/client";
import { PageHead } from "../../components/ui";
import type { InstitutionUploadLog } from "../../types";

export default function InstitutionUploadLogs() {
  const [logs, setLogs] = useState<InstitutionUploadLog[]>([]);
  const [selected, setSelected] = useState<InstitutionUploadLog | null>(null);

  useEffect(() => {
    api.get<InstitutionUploadLog[]>("/institutions/me/upload-logs").then((r) => setLogs(r.data));
  }, []);

  return (
    <div>
      <PageHead title="Upload Logs" breadcrumb="Institution Portal › Upload Logs" />
      <table className="sn-table">
        <thead>
          <tr>
            <th>File</th>
            <th>Type</th>
            <th>Date</th>
            <th>Total</th>
            <th>Created</th>
            <th>Skipped</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.filename}</td>
              <td>{log.file_type.toUpperCase()}</td>
              <td>{new Date(log.created_at).toLocaleString()}</td>
              <td>{log.total_rows}</td>
              <td>{log.created_count}</td>
              <td>{log.skipped_count}</td>
              <td>
                <span className={`badge ${log.status === "success" ? "green" : log.status === "partial" ? "amber" : "red"}`}>
                  {log.status}
                </span>
              </td>
              <td>
                <button className="btn link" onClick={() => setSelected(log)}>
                  Details
                </button>
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={8} className="muted" style={{ textAlign: "center", padding: 20 }}>
                No upload logs yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span>{selected.filename}</span>
              <div className="spacer" />
              <button className="btn link" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid one-col" style={{ border: "none", padding: 0 }}>
                <div className="field"><label>Status</label><div>{selected.status}</div></div>
                <div className="field"><label>Created</label><div>{selected.created_count}</div></div>
                <div className="field"><label>Skipped</label><div>{selected.skipped_count}</div></div>
                {selected.errors?.row_errors && selected.errors.row_errors.length > 0 && (
                  <div className="field">
                    <label>Row Errors</label>
                    <ul>
                      {selected.errors.row_errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
