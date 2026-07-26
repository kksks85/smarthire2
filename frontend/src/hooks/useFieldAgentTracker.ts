import { useEffect, useRef } from "react";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext";

/**
 * useFieldAgentTracker
 * -------------------------------------------------------------
 * While a user with the `field_agent` role is logged in, this hook:
 *   1. Captures the browser's GPS coordinates.
 *   2. Reverse-geocodes them via OpenStreetMap Nominatim to obtain a
 *      human-readable location name + city.
 *   3. POSTs an "auto-track" entry to /field-agents/location.
 *
 * The first ping fires ~5 seconds after login (so we don't collide with
 * page-load work) and repeats every 30 minutes.
 *
 * The hook is a no-op for any other role or when geolocation permission
 * is denied.
 */

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const INITIAL_DELAY_MS = 5 * 1000;

interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
}

interface NominatimResponse {
  display_name?: string;
  address?: NominatimAddress;
}

export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<{ location_name: string; city: string; address_text: string }> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en" },
    });
    if (!res.ok) throw new Error("geocode failed");
    const data: NominatimResponse = await res.json();
    const addr = data.address || {};
    const city =
      addr.city || addr.town || addr.village || addr.county || addr.state || "";
    // Prefer a short "landmark, area" style name; fall back to display_name.
    const shortParts = [
      addr.road || addr.neighbourhood || addr.suburb,
      addr.suburb && addr.suburb !== addr.road ? addr.suburb : undefined,
      city,
    ].filter(Boolean);
    const location_name =
      (shortParts.length > 0 ? shortParts.join(", ") : data.display_name) || "";
    return {
      location_name: location_name.slice(0, 250),
      city: city.slice(0, 118),
      address_text: (data.display_name || "").slice(0, 500),
    };
  } catch {
    return { location_name: "", city: "", address_text: "" };
  }
}

export function capturePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60000,
    });
  });
}

async function pingLocation() {
  try {
    const pos = await capturePosition();
    const { latitude, longitude, accuracy } = pos.coords;
    const geo = await reverseGeocode(latitude, longitude);
    await api.post("/field-agents/location", {
      event_type: "check_in",
      latitude,
      longitude,
      accuracy_m: accuracy,
      address_text: geo.address_text || null,
      location_name: geo.location_name || null,
      city: geo.city || null,
    });
  } catch {
    // Silent failure — permissions denied, offline, etc.
  }
}

export function useFieldAgentTracker() {
  const { user } = useAuth();
  const timerRef = useRef<number | null>(null);
  const initialRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user || user.role !== "field_agent") return;

    initialRef.current = window.setTimeout(() => {
      pingLocation();
      timerRef.current = window.setInterval(pingLocation, THIRTY_MINUTES_MS);
    }, INITIAL_DELAY_MS);

    return () => {
      if (initialRef.current) window.clearTimeout(initialRef.current);
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [user]);
}
