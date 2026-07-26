/**
 * Chart renderers for the reporting engine.
 *
 * Each renderer accepts a ReportRunResult and picks fields out of
 * ``display_options`` to know which columns to use for axes, values, etc.
 */

import { useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
} from "react-leaflet";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { INDIA_CENTER, INDIA_ZOOM, lookupCity } from "../lib/indianCities";
import type { ReportRunResult } from "../types";

// Fix leaflet's default marker icon paths when bundled by Vite.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const COLORS = [
  "#0b8f7a",
  "#1f7bb6",
  "#b9770e",
  "#8e44ad",
  "#c0392b",
  "#16a085",
  "#2c3e50",
  "#e67e22",
  "#7f8c8d",
];

function fmtCell(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (v instanceof Date) return v.toLocaleString();
  return String(v);
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function TableView({ result }: { result: ReportRunResult }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="sn-table">
        <thead>
          <tr>
            {result.columns.map((c) => (
              <th key={c.key}>
                {c.label}
                {c.aggregate && (
                  <span className="muted" style={{ fontSize: 10, marginLeft: 4 }}>
                    ({c.aggregate})
                  </span>
                )}
                {c.is_pii && (
                  <span
                    title="PII column — may be masked"
                    style={{ marginLeft: 4, color: "var(--warn)" }}
                  >
                    🔒
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r, i) => (
            <tr key={i}>
              {result.columns.map((c) => (
                <td key={c.key}>{fmtCell(r[c.key])}</td>
              ))}
            </tr>
          ))}
          {result.rows.length === 0 && (
            <tr>
              <td
                colSpan={result.columns.length || 1}
                className="muted"
                style={{ textAlign: "center", padding: 20 }}
              >
                No rows.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bar / Line
// ---------------------------------------------------------------------------

interface XYProps {
  result: ReportRunResult;
}

function pickXY(result: ReportRunResult) {
  const opts = result.display_options || {};
  const x = opts.x_axis || result.columns[0]?.key;
  const y = opts.y_axis || result.columns[1]?.key;
  return { x, y };
}

export function BarView({ result }: XYProps) {
  const { x, y } = pickXY(result);
  if (!x || !y) return <em className="muted">Configure X and Y axes in display options.</em>;
  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={result.rows} margin={{ top: 20, right: 20, left: 10, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={x} angle={-25} textAnchor="end" height={60} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey={y} fill={COLORS[0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineView({ result }: XYProps) {
  const { x, y } = pickXY(result);
  if (!x || !y) return <em className="muted">Configure X and Y axes in display options.</em>;
  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={result.rows} margin={{ top: 20, right: 20, left: 10, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={x} angle={-25} textAnchor="end" height={60} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey={y} stroke={COLORS[1]} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Pie / Funnel
// ---------------------------------------------------------------------------

export function PieView({ result }: { result: ReportRunResult }) {
  const opts = result.display_options || {};
  const label = opts.slice_label || result.columns[0]?.key;
  const value = opts.slice_value || result.columns[1]?.key;
  if (!label || !value)
    return <em className="muted">Configure slice label and value.</em>;

  const data = useMemo(
    () =>
      result.rows.map((r) => ({
        name: fmtCell(r[label]),
        value: Number(r[value]) || 0,
      })),
    [result, label, value]
  );

  return (
    <ResponsiveContainer width="100%" height={360}>
      <PieChart>
        <Tooltip />
        <Legend />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          outerRadius={130}
          label
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

export function FunnelView({ result }: { result: ReportRunResult }) {
  const opts = result.display_options || {};
  const stage = opts.funnel_stage || result.columns[0]?.key;
  const value = opts.funnel_value || result.columns[1]?.key;
  if (!stage || !value)
    return <em className="muted">Configure stage and value fields.</em>;

  const data = result.rows.map((r) => ({
    name: fmtCell(r[stage]),
    value: Number(r[value]) || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={360}>
      <FunnelChart>
        <Tooltip />
        <Funnel dataKey="value" data={data} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
          <LabelList dataKey="name" position="right" fill="#000" />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// KPI single-value card
// ---------------------------------------------------------------------------

export function KpiView({ result }: { result: ReportRunResult }) {
  const opts = result.display_options || {};
  const metricKey = opts.kpi_metric || result.columns[0]?.key;
  const value =
    metricKey && result.rows.length > 0
      ? result.rows[0][metricKey]
      : result.row_count;
  const label = opts.kpi_label || result.columns[0]?.label || "Value";
  return (
    <div
      style={{
        padding: 40,
        textAlign: "center",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
      }}
    >
      <div className="muted" style={{ fontSize: 12, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 56, fontWeight: 700, color: "var(--accent)" }}>
        {fmtCell(value)}
      </div>
      {opts.kpi_hint && (
        <div className="muted" style={{ fontSize: 12 }}>
          {opts.kpi_hint}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Map (react-leaflet + OSM)
// ---------------------------------------------------------------------------

export function MapView({ result }: { result: ReportRunResult }) {
  const opts = result.display_options || {};

  // Mode 1: aggregate by Indian city name (uses a bundled lookup table).
  const cityKey: string | undefined = opts.map_city;
  const valueKey: string | undefined = opts.map_value;

  // Mode 2: raw lat/lon columns.
  const latKey = opts.map_lat || "latitude";
  const lonKey = opts.map_lon || "longitude";
  const labelKey = opts.map_label;

  if (cityKey) {
    return (
      <CityBubbleMap
        result={result}
        cityKey={cityKey}
        valueKey={valueKey}
      />
    );
  }

  return (
    <LatLonMap
      result={result}
      latKey={latKey}
      lonKey={lonKey}
      labelKey={labelKey}
    />
  );
}

function LatLonMap({
  result,
  latKey,
  lonKey,
  labelKey,
}: {
  result: ReportRunResult;
  latKey: string;
  lonKey: string;
  labelKey?: string;
}) {
  const markers = useMemo(
    () =>
      result.rows
        .map((r) => ({
          lat: Number(r[latKey]),
          lon: Number(r[lonKey]),
          label: labelKey ? fmtCell(r[labelKey]) : "",
        }))
        .filter((m) => !isNaN(m.lat) && !isNaN(m.lon)),
    [result, latKey, lonKey, labelKey]
  );

  if (markers.length === 0) {
    return (
      <em className="muted">
        No rows with valid <code>{latKey}</code> / <code>{lonKey}</code> coordinates.
      </em>
    );
  }

  const center: [number, number] = [
    markers.reduce((a, m) => a + m.lat, 0) / markers.length,
    markers.reduce((a, m) => a + m.lon, 0) / markers.length,
  ];

  return (
    <div style={{ height: 420, width: "100%" }}>
      <MapContainer center={center} zoom={5} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="© OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m, i) => (
          <Marker key={i} position={[m.lat, m.lon]}>
            {m.label && <Popup>{m.label}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

/**
 * City-aggregation map: rows have a ``city`` column (name) and an optional
 * ``value`` column (usually a count). Cities are looked up in a bundled
 * India-only coordinate table, aggregated, and rendered as circle markers
 * whose radius scales with the value.
 */
function CityBubbleMap({
  result,
  cityKey,
  valueKey,
}: {
  result: ReportRunResult;
  cityKey: string;
  valueKey?: string;
}) {
  const aggregated = useMemo(() => {
    const buckets = new Map<string, { name: string; lat: number; lon: number; value: number }>();
    const missing: string[] = [];

    for (const r of result.rows) {
      const name = r[cityKey];
      if (name === null || name === undefined || name === "") continue;
      const coords = lookupCity(String(name));
      if (!coords) {
        if (!missing.includes(String(name))) missing.push(String(name));
        continue;
      }
      const key = String(name).trim().toLowerCase();
      const val = valueKey ? Number(r[valueKey]) || 0 : 1;
      const existing = buckets.get(key);
      if (existing) {
        existing.value += val;
      } else {
        buckets.set(key, {
          name: String(name),
          lat: coords.lat,
          lon: coords.lon,
          value: val,
        });
      }
    }
    return { points: Array.from(buckets.values()), missing };
  }, [result, cityKey, valueKey]);

  if (aggregated.points.length === 0) {
    return (
      <em className="muted">
        No rows with a recognised Indian city in column <code>{cityKey}</code>.
        {aggregated.missing.length > 0 && (
          <>
            {" "}
            Unmapped values: {aggregated.missing.slice(0, 6).join(", ")}
            {aggregated.missing.length > 6 && "…"}
          </>
        )}
      </em>
    );
  }

  const maxVal = Math.max(...aggregated.points.map((p) => p.value), 1);
  const scale = (v: number) => {
    // Radius between 6 and 32 px, square-root scaled so area conveys value.
    const t = Math.sqrt(v) / Math.sqrt(maxVal);
    return 6 + t * 26;
  };

  return (
    <div style={{ height: 480, width: "100%" }}>
      <MapContainer
        center={INDIA_CENTER}
        zoom={INDIA_ZOOM}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="© OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {aggregated.points.map((p) => (
          <CircleMarker
            key={p.name}
            center={[p.lat, p.lon]}
            radius={scale(p.value)}
            pathOptions={{
              color: "#0b8f7a",
              fillColor: "#0b8f7a",
              fillOpacity: 0.55,
              weight: 1,
            }}
          >
            <Popup>
              <strong>{p.name}</strong>
              <br />
              {valueKey ? `Value: ${p.value}` : `${p.value} row${p.value === 1 ? "" : "s"}`}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {aggregated.missing.length > 0 && (
        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
          Skipped {aggregated.missing.length} unmapped location
          {aggregated.missing.length === 1 ? "" : "s"}:{" "}
          {aggregated.missing.slice(0, 8).join(", ")}
          {aggregated.missing.length > 8 && "…"}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart renderer selector
// ---------------------------------------------------------------------------

export function ChartRenderer({ result }: { result: ReportRunResult }) {
  switch (result.display_type) {
    case "bar":
      return <BarView result={result} />;
    case "line":
      return <LineView result={result} />;
    case "pie":
      return <PieView result={result} />;
    case "kpi":
      return <KpiView result={result} />;
    case "funnel":
      return <FunnelView result={result} />;
    case "map":
      return <MapView result={result} />;
    case "table":
    default:
      return <TableView result={result} />;
  }
}
