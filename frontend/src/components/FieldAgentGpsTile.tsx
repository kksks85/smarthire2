import { useEffect, useState } from "react";
import { capturePosition, reverseGeocode } from "../hooks/useFieldAgentTracker";
import { findNearestCity } from "../lib/indianCities";

const REFRESH_MS = 2 * 60 * 1000; // refresh every 2 minutes

interface GpsSnapshot {
  timestamp: Date;
  locationName: string;
  city: string;
  nearestCity: string | null;
  distanceKm: number | null;
}

/**
 * Small top-right tile shown on the field agent's home page. Captures the
 * browser's current GPS position, reverse-geocodes it, and reports the
 * closest known city + distance so the agent (and their manager glancing at
 * the same screen) can see at a glance where they currently are.
 */
export default function FieldAgentGpsTile() {
  const [snapshot, setSnapshot] = useState<GpsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const pos = await capturePosition();
      const { latitude, longitude } = pos.coords;
      const geo = await reverseGeocode(latitude, longitude);
      const nearest = findNearestCity(latitude, longitude);
      setSnapshot({
        timestamp: new Date(),
        locationName: geo.location_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        city: geo.city || "—",
        nearestCity: nearest?.name ?? null,
        distanceKm: nearest?.distanceKm ?? null,
      });
    } catch {
      setError("Location unavailable — allow GPS access to see your position.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="gps-tile">
      <div className="gps-tile-head">
        <span>📍 My Current Location</span>
        <button className="btn link" onClick={refresh} title="Refresh">
          ↻
        </button>
      </div>
      {loading && !snapshot && <div className="muted gps-tile-msg">Locating…</div>}
      {error && <div className="error-note gps-tile-msg">{error}</div>}
      {snapshot && (
        <div className="gps-tile-body">
          <div className="gps-row">
            <span className="gps-label">Date</span>
            <span>{snapshot.timestamp.toLocaleDateString()}</span>
          </div>
          <div className="gps-row">
            <span className="gps-label">Time</span>
            <span>{snapshot.timestamp.toLocaleTimeString()}</span>
          </div>
          <div className="gps-row">
            <span className="gps-label">Location</span>
            <span title={snapshot.locationName}>{snapshot.locationName}</span>
          </div>
          <div className="gps-row">
            <span className="gps-label">City</span>
            <span>{snapshot.city}</span>
          </div>
          <div className="gps-row">
            <span className="gps-label">Nearest known city</span>
            <span>
              {snapshot.nearestCity
                ? `${snapshot.nearestCity} (${snapshot.distanceKm!.toFixed(1)} km)`
                : "—"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
