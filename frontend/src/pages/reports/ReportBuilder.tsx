import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import { ChartRenderer } from "../../components/ChartRenderer";
import { PageHead } from "../../components/ui";
import type {
  ColumnMeta,
  DataSourceMeta,
  FilterGroup,
  FilterLeaf,
  Report,
  ReportColumnRef,
  ReportDisplayType,
  ReportRunResult,
} from "../../types";

const DISPLAY_OPTIONS: { value: ReportDisplayType; label: string }[] = [
  { value: "table", label: "Table" },
  { value: "bar", label: "Bar chart" },
  { value: "line", label: "Line chart" },
  { value: "pie", label: "Pie chart" },
  { value: "kpi", label: "KPI card" },
  { value: "funnel", label: "Funnel" },
  { value: "map", label: "Map" },
];

const AGGREGATES = [
  { value: "", label: "— none —" },
  { value: "count", label: "count" },
  { value: "count_distinct", label: "count distinct" },
  { value: "sum", label: "sum" },
  { value: "avg", label: "avg" },
  { value: "min", label: "min" },
  { value: "max", label: "max" },
];

const STEPS = [
  "Data Source",
  "Filters",
  "Columns & Grouping",
  "Display",
  "Save",
];

interface Form {
  name: string;
  description: string;
  data_source: string;
  filters: FilterGroup;
  columns: ReportColumnRef[];
  group_by: string[];
  display_type: ReportDisplayType;
  display_options: Record<string, any>;
  row_limit: number;
  is_public: boolean;
}

const BLANK_FORM: Form = {
  name: "",
  description: "",
  data_source: "",
  filters: { join: "and", children: [] },
  columns: [],
  group_by: [],
  display_type: "table",
  display_options: {},
  row_limit: 1000,
  is_public: false,
};

export default function ReportBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = !!id;

  const [step, setStep] = useState(0);
  const [dataSources, setDataSources] = useState<DataSourceMeta[]>([]);
  const [form, setForm] = useState<Form>(BLANK_FORM);
  const [preview, setPreview] = useState<ReportRunResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErr, setPreviewErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState("");

  // Load data-source registry
  useEffect(() => {
    api
      .get<DataSourceMeta[]>("/reports/data-sources")
      .then((r) => setDataSources(r.data));
  }, []);

  // Load existing report for edit
  useEffect(() => {
    if (!editing) return;
    api
      .get<Report>(`/reports/${id}`)
      .then((r) => {
        const d = r.data;
        setForm({
          name: d.name,
          description: d.description || "",
          data_source: d.data_source,
          filters: (d.filters as FilterGroup) || { join: "and", children: [] },
          columns: d.columns || [],
          group_by: d.group_by || [],
          display_type: d.display_type,
          display_options: d.display_options || {},
          row_limit: d.row_limit,
          is_public: d.is_public,
        });
      })
      .catch(() => setLoadErr("Report not found or you don't have access."));
  }, [id, editing]);

  const currentSource = useMemo(
    () => dataSources.find((d) => d.key === form.data_source) || null,
    [dataSources, form.data_source]
  );

  const columnByName = useMemo(() => {
    const map: Record<string, ColumnMeta> = {};
    if (currentSource) {
      for (const c of currentSource.columns) map[c.name] = c;
    }
    return map;
  }, [currentSource]);

  function updForm<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // --------- Filter builder helpers ---------

  function addFilter() {
    if (!currentSource) return;
    const first = currentSource.columns.find((c) => c.filterable);
    if (!first) return;
    const leaf: FilterLeaf = {
      field: first.name,
      op: first.operators[0]?.key || "equals",
      value: "",
    };
    updForm("filters", {
      ...form.filters,
      children: [...(form.filters.children || []), leaf],
    });
  }

  function updateFilter(index: number, patch: Partial<FilterLeaf>) {
    const children = [...(form.filters.children || [])];
    children[index] = { ...(children[index] as FilterLeaf), ...patch };
    updForm("filters", { ...form.filters, children });
  }

  function removeFilter(index: number) {
    const children = [...(form.filters.children || [])];
    children.splice(index, 1);
    updForm("filters", { ...form.filters, children });
  }

  // --------- Columns helpers ---------

  function toggleColumn(name: string) {
    const exists = form.columns.some((c) => c.field === name);
    if (exists) {
      updForm(
        "columns",
        form.columns.filter((c) => c.field !== name)
      );
    } else {
      updForm("columns", [...form.columns, { field: name }]);
    }
  }

  function setAggregate(name: string, aggregate: string) {
    updForm(
      "columns",
      form.columns.map((c) =>
        c.field === name ? { ...c, aggregate: aggregate || undefined } : c
      )
    );
  }

  function toggleGroupBy(name: string) {
    if (form.group_by.includes(name)) {
      updForm(
        "group_by",
        form.group_by.filter((g) => g !== name)
      );
    } else {
      updForm("group_by", [...form.group_by, name]);
    }
  }

  // --------- Preview ---------

  async function runPreview() {
    if (!form.data_source) return;
    setPreviewLoading(true);
    setPreviewErr("");
    try {
      const res = await api.post<ReportRunResult>("/reports/preview", {
        data_source: form.data_source,
        filters: form.filters,
        columns: form.columns,
        group_by: form.group_by,
        row_limit: Math.min(form.row_limit, 500),
        display_type: form.display_type,
        display_options: form.display_options,
      });
      setPreview(res.data);
    } catch (e: any) {
      setPreviewErr(e?.response?.data?.detail || "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }

  // Auto-preview when key inputs change (debounced-ish via effect deps).
  useEffect(() => {
    if (!form.data_source) return;
    const t = window.setTimeout(runPreview, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.data_source,
    JSON.stringify(form.filters),
    JSON.stringify(form.columns),
    JSON.stringify(form.group_by),
    form.display_type,
    JSON.stringify(form.display_options),
  ]);

  // --------- Save ---------

  async function save() {
    if (!form.name || !form.data_source) {
      alert("Name and data source are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        data_source: form.data_source,
        filters: form.filters,
        columns: form.columns,
        group_by: form.group_by,
        display_type: form.display_type,
        display_options: form.display_options,
        row_limit: form.row_limit,
        is_public: form.is_public,
      };
      if (editing) {
        await api.put(`/reports/${id}`, payload);
        navigate(`/reports/${id}`);
      } else {
        const res = await api.post<Report>("/reports", payload);
        navigate(`/reports/${res.data.id}`);
      }
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHead
        title={editing ? "Edit Report" : "New Report"}
        breadcrumb="Reports › Builder"
        actions={
          <button className="btn" onClick={() => navigate("/reports")}>
            ← Back to list
          </button>
        }
      />

      {loadErr && <div className="error-note">{loadErr}</div>}

      {/* Step tabs */}
      <div className="form-tabs">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={"form-tab" + (step === i ? " active" : "")}
            onClick={() => setStep(i)}
          >
            {i + 1}. {s}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Left: step content */}
        <div>
          {step === 0 && (
            <div className="card">
              <div className="card-head">Select data source</div>
              <div className="card-body">
                <div className="field">
                  <label>Data source *</label>
                  <select
                    value={form.data_source}
                    onChange={(e) => {
                      updForm("data_source", e.target.value);
                      updForm("filters", { join: "and", children: [] });
                      updForm("columns", []);
                      updForm("group_by", []);
                    }}
                  >
                    <option value="">— choose —</option>
                    {dataSources.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                {currentSource && (
                  <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                    {currentSource.description}
                  </div>
                )}
                {currentSource && (
                  <details style={{ marginTop: 12 }}>
                    <summary>Available columns ({currentSource.columns.length})</summary>
                    <ul style={{ marginTop: 6, fontSize: 12 }}>
                      {currentSource.columns.map((c) => (
                        <li key={c.name}>
                          <code>{c.name}</code> · {c.label} ({c.type}
                          {c.is_pii && ", PII"})
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="card">
              <div className="card-head">
                Filters
                <div className="spacer" />
                <button
                  className="btn"
                  onClick={addFilter}
                  disabled={!currentSource}
                >
                  + Add filter
                </button>
              </div>
              <div className="card-body">
                {!currentSource && (
                  <div className="muted">Select a data source first.</div>
                )}
                {currentSource &&
                  (form.filters.children || []).length === 0 && (
                    <div className="muted">
                      No filters. Report will return all rows (up to row limit).
                    </div>
                  )}
                {(form.filters.children || []).map((child, idx) => {
                  const leaf = child as FilterLeaf;
                  const col = columnByName[leaf.field];
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 2fr 3fr auto",
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      <select
                        value={leaf.field}
                        onChange={(e) =>
                          updateFilter(idx, { field: e.target.value, op: "equals" })
                        }
                      >
                        {currentSource!.columns
                          .filter((c) => c.filterable)
                          .map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.label}
                            </option>
                          ))}
                      </select>
                      <select
                        value={leaf.op}
                        onChange={(e) => updateFilter(idx, { op: e.target.value })}
                      >
                        {(col?.operators || []).map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {(() => {
                        const op = (col?.operators || []).find(
                          (o) => o.key === leaf.op
                        );
                        if (!op || op.unary)
                          return <span className="muted">—</span>;
                        if (op.multi) {
                          return (
                            <input
                              placeholder="Comma-separated"
                              value={
                                Array.isArray(leaf.value)
                                  ? leaf.value.join(", ")
                                  : leaf.value || ""
                              }
                              onChange={(e) =>
                                updateFilter(idx, {
                                  value: e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                            />
                          );
                        }
                        const isDate =
                          col?.type === "date" || col?.type === "datetime";
                        return (
                          <input
                            type={isDate ? "date" : "text"}
                            value={leaf.value ?? ""}
                            onChange={(e) =>
                              updateFilter(idx, { value: e.target.value })
                            }
                          />
                        );
                      })()}
                      <button
                        className="btn link"
                        onClick={() => removeFilter(idx)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && currentSource && (
            <div className="card">
              <div className="card-head">Choose columns and grouping</div>
              <div className="card-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 4 }}>
                  {currentSource.columns.map((c) => {
                    const selected = form.columns.find((s) => s.field === c.name);
                    return (
                      <div
                        key={c.name}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "auto 1fr auto auto",
                          gap: 8,
                          alignItems: "center",
                          borderBottom: "1px dashed var(--border)",
                          padding: "4px 0",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!selected}
                          onChange={() => toggleColumn(c.name)}
                        />
                        <div>
                          {c.label}{" "}
                          <span className="muted" style={{ fontSize: 11 }}>
                            ({c.type}
                            {c.is_pii && ", PII"})
                          </span>
                        </div>
                        {selected && (
                          <select
                            value={selected.aggregate || ""}
                            onChange={(e) => setAggregate(c.name, e.target.value)}
                            disabled={!c.aggregate_ok && !["count", "count_distinct"].includes(selected.aggregate || "")}
                          >
                            {AGGREGATES.filter(
                              (a) =>
                                a.value === "" ||
                                a.value === "count" ||
                                a.value === "count_distinct" ||
                                c.aggregate_ok
                            ).map((a) => (
                              <option key={a.value} value={a.value}>
                                {a.label}
                              </option>
                            ))}
                          </select>
                        )}
                        <label style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                          <input
                            type="checkbox"
                            disabled={!c.group_by_ok}
                            checked={form.group_by.includes(c.name)}
                            onChange={() => toggleGroupBy(c.name)}
                          />{" "}
                          group by
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="card">
              <div className="card-head">Display</div>
              <div className="card-body">
                <div className="field">
                  <label>Display type</label>
                  <select
                    value={form.display_type}
                    onChange={(e) =>
                      updForm("display_type", e.target.value as ReportDisplayType)
                    }
                  >
                    {DISPLAY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {(form.display_type === "bar" || form.display_type === "line") && (
                  <>
                    <div className="field">
                      <label>X axis field</label>
                      <select
                        value={form.display_options.x_axis || ""}
                        onChange={(e) =>
                          updForm("display_options", {
                            ...form.display_options,
                            x_axis: e.target.value,
                          })
                        }
                      >
                        <option value="">— first column —</option>
                        {form.columns.map((c) => (
                          <option key={c.field} value={displayKey(c)}>
                            {c.field}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Y axis field (numeric)</label>
                      <select
                        value={form.display_options.y_axis || ""}
                        onChange={(e) =>
                          updForm("display_options", {
                            ...form.display_options,
                            y_axis: e.target.value,
                          })
                        }
                      >
                        <option value="">— second column —</option>
                        {form.columns.map((c) => (
                          <option key={c.field} value={displayKey(c)}>
                            {c.field}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {form.display_type === "pie" && (
                  <>
                    <div className="field">
                      <label>Slice label field</label>
                      <select
                        value={form.display_options.slice_label || ""}
                        onChange={(e) =>
                          updForm("display_options", {
                            ...form.display_options,
                            slice_label: e.target.value,
                          })
                        }
                      >
                        <option value="">— first column —</option>
                        {form.columns.map((c) => (
                          <option key={c.field} value={displayKey(c)}>
                            {c.field}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Slice value field (numeric)</label>
                      <select
                        value={form.display_options.slice_value || ""}
                        onChange={(e) =>
                          updForm("display_options", {
                            ...form.display_options,
                            slice_value: e.target.value,
                          })
                        }
                      >
                        <option value="">— second column —</option>
                        {form.columns.map((c) => (
                          <option key={c.field} value={displayKey(c)}>
                            {c.field}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {form.display_type === "funnel" && (
                  <>
                    <div className="field">
                      <label>Stage label field</label>
                      <select
                        value={form.display_options.funnel_stage || ""}
                        onChange={(e) =>
                          updForm("display_options", {
                            ...form.display_options,
                            funnel_stage: e.target.value,
                          })
                        }
                      >
                        <option value="">— first column —</option>
                        {form.columns.map((c) => (
                          <option key={c.field} value={displayKey(c)}>
                            {c.field}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Value field (numeric)</label>
                      <select
                        value={form.display_options.funnel_value || ""}
                        onChange={(e) =>
                          updForm("display_options", {
                            ...form.display_options,
                            funnel_value: e.target.value,
                          })
                        }
                      >
                        <option value="">— second column —</option>
                        {form.columns.map((c) => (
                          <option key={c.field} value={displayKey(c)}>
                            {c.field}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {form.display_type === "kpi" && (
                  <>
                    <div className="field">
                      <label>Metric field</label>
                      <select
                        value={form.display_options.kpi_metric || ""}
                        onChange={(e) =>
                          updForm("display_options", {
                            ...form.display_options,
                            kpi_metric: e.target.value,
                          })
                        }
                      >
                        <option value="">— first column of first row —</option>
                        {form.columns.map((c) => (
                          <option key={c.field} value={displayKey(c)}>
                            {c.field}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>KPI label</label>
                      <input
                        value={form.display_options.kpi_label || ""}
                        onChange={(e) =>
                          updForm("display_options", {
                            ...form.display_options,
                            kpi_label: e.target.value,
                          })
                        }
                      />
                    </div>
                  </>
                )}

                {form.display_type === "map" && (
                  <>
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginBottom: 6 }}
                    >
                      Pick <strong>City name mode</strong> to plot Indian cities as
                      proportional bubbles (uses a bundled coordinate lookup), or use{" "}
                      <strong>Lat/Lon mode</strong> when your data already has
                      coordinates.
                    </div>
                    <div className="field">
                      <label>City column (name-based, India-only)</label>
                      <select
                        value={form.display_options.map_city || ""}
                        onChange={(e) =>
                          updForm("display_options", {
                            ...form.display_options,
                            map_city: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">— (use Lat/Lon below instead) —</option>
                        {form.columns.map((c) => (
                          <option key={c.field} value={displayKey(c)}>
                            {c.field}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Value column (numeric — bubble size, optional)</label>
                      <select
                        value={form.display_options.map_value || ""}
                        onChange={(e) =>
                          updForm("display_options", {
                            ...form.display_options,
                            map_value: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">— (count rows per city) —</option>
                        {form.columns.map((c) => (
                          <option key={c.field} value={displayKey(c)}>
                            {c.field}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Latitude column (only when city column is empty)</label>
                      <input
                        value={form.display_options.map_lat || "latitude"}
                        onChange={(e) =>
                          updForm("display_options", {
                            ...form.display_options,
                            map_lat: e.target.value,
                          })
                        }
                        placeholder="latitude"
                      />
                    </div>
                    <div className="field">
                      <label>Longitude column (only when city column is empty)</label>
                      <input
                        value={form.display_options.map_lon || "longitude"}
                        onChange={(e) =>
                          updForm("display_options", {
                            ...form.display_options,
                            map_lon: e.target.value,
                          })
                        }
                        placeholder="longitude"
                      />
                    </div>
                    <div className="field">
                      <label>Marker label column (lat/lon mode only)</label>
                      <input
                        value={form.display_options.map_label || ""}
                        onChange={(e) =>
                          updForm("display_options", {
                            ...form.display_options,
                            map_label: e.target.value,
                          })
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="card">
              <div className="card-head">Save</div>
              <div className="card-body">
                <div className="field">
                  <label>Report name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => updForm("name", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Description</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => updForm("description", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Row limit</label>
                  <input
                    type="number"
                    value={form.row_limit}
                    onChange={(e) =>
                      updForm("row_limit", Number(e.target.value) || 1000)
                    }
                  />
                </div>
                <div className="field">
                  <label>
                    <input
                      type="checkbox"
                      checked={form.is_public}
                      onChange={(e) => updForm("is_public", e.target.checked)}
                    />{" "}
                    Public (visible to all users, without explicit share)
                  </label>
                </div>
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <button className="btn primary" onClick={save} disabled={saving}>
                    {saving ? "Saving…" : editing ? "Save changes" : "Create report"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="btn-row" style={{ marginTop: 12 }}>
            {step > 0 && (
              <button className="btn" onClick={() => setStep((s) => s - 1)}>
                ← Previous
              </button>
            )}
            {step < STEPS.length - 1 && (
              <button
                className="btn primary"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 && !form.data_source}
              >
                Next →
              </button>
            )}
          </div>
        </div>

        {/* Right: live preview */}
        <div>
          <div
            className="card"
            style={{ position: "sticky", top: 12, minHeight: 400 }}
          >
            <div className="card-head">
              Live preview
              <div className="spacer" />
              <button className="btn" onClick={runPreview} disabled={!form.data_source}>
                ↻ Refresh
              </button>
            </div>
            <div className="card-body">
              {!form.data_source && (
                <div className="muted">Select a data source to see a preview.</div>
              )}
              {previewLoading && <div className="muted">Loading…</div>}
              {previewErr && (
                <div className="error-note">{previewErr}</div>
              )}
              {preview && !previewLoading && !previewErr && (
                <>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                    {preview.row_count} row{preview.row_count === 1 ? "" : "s"}
                    {preview.truncated && " (truncated)"}
                  </div>
                  <ChartRenderer result={preview} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Aggregate columns become a synthetic key server-side; mirror that here. */
function displayKey(c: ReportColumnRef): string {
  if (!c.aggregate) return c.field;
  return `${c.aggregate}_${c.field.replace(/\./g, "_")}`;
}
