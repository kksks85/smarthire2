/**
 * Coordinate lookup for major Indian cities used by the reporting engine's
 * map view when a report groups by ``city`` (rather than raw lat/lon).
 *
 * Coordinates from OpenStreetMap / Wikipedia (approximate city centres).
 * Keys are lowercased, whitespace-collapsed city names.
 */

export interface CityCoords {
  lat: number;
  lon: number;
}

const RAW: Record<string, [number, number]> = {
  // Major metros
  "mumbai": [19.076, 72.877],
  "delhi": [28.614, 77.209],
  "new delhi": [28.614, 77.209],
  "bengaluru": [12.972, 77.594],
  "bangalore": [12.972, 77.594],
  "hyderabad": [17.385, 78.487],
  "chennai": [13.083, 80.271],
  "kolkata": [22.573, 88.364],
  "ahmedabad": [23.023, 72.572],
  "pune": [18.520, 73.856],
  "surat": [21.170, 72.831],
  "jaipur": [26.912, 75.787],
  "lucknow": [26.847, 80.947],
  "kanpur": [26.450, 80.332],
  "nagpur": [21.146, 79.088],
  "indore": [22.720, 75.858],
  "bhopal": [23.259, 77.413],
  "visakhapatnam": [17.687, 83.219],
  "vizag": [17.687, 83.219],
  "patna": [25.594, 85.138],
  "vadodara": [22.307, 73.181],
  "ghaziabad": [28.669, 77.454],
  "ludhiana": [30.900, 75.857],
  "agra": [27.176, 78.008],
  "nashik": [20.011, 73.790],
  "faridabad": [28.408, 77.317],
  "meerut": [28.984, 77.706],
  "rajkot": [22.303, 70.803],
  "kalyan": [19.243, 73.130],
  "vasai": [19.391, 72.831],
  "varanasi": [25.317, 82.973],
  "srinagar": [34.084, 74.797],
  "aurangabad": [19.876, 75.343],
  "dhanbad": [23.795, 86.430],
  "amritsar": [31.634, 74.872],
  "navi mumbai": [19.033, 73.030],
  "allahabad": [25.436, 81.847],
  "prayagraj": [25.436, 81.847],
  "ranchi": [23.344, 85.310],
  "howrah": [22.588, 88.263],
  "coimbatore": [11.017, 76.955],
  "jabalpur": [23.181, 79.986],
  "gwalior": [26.218, 78.183],
  "vijayawada": [16.506, 80.648],
  "jodhpur": [26.238, 73.024],
  "madurai": [9.925, 78.119],
  "raipur": [21.251, 81.629],
  "kota": [25.213, 75.865],
  "chandigarh": [30.734, 76.779],
  "guwahati": [26.144, 91.736],
  "solapur": [17.660, 75.906],
  "hubli": [15.364, 75.124],
  "hubballi": [15.364, 75.124],
  "mysuru": [12.295, 76.639],
  "mysore": [12.295, 76.639],
  "tiruchirappalli": [10.790, 78.704],
  "trichy": [10.790, 78.704],
  "bareilly": [28.367, 79.430],
  "aligarh": [27.881, 78.077],
  "moradabad": [28.838, 78.773],
  "gurgaon": [28.458, 77.026],
  "gurugram": [28.458, 77.026],
  "jalandhar": [31.326, 75.576],
  "bhubaneswar": [20.296, 85.824],
  "salem": [11.664, 78.146],
  "warangal": [17.968, 79.594],
  "guntur": [16.306, 80.436],
  "bhiwandi": [19.297, 73.058],
  "saharanpur": [29.968, 77.545],
  "gorakhpur": [26.760, 83.373],
  "bikaner": [28.022, 73.312],
  "amravati": [20.933, 77.752],
  "noida": [28.535, 77.391],
  "jamshedpur": [22.804, 86.202],
  "cuttack": [20.463, 85.883],
  "firozabad": [27.150, 78.395],
  "kochi": [9.932, 76.267],
  "cochin": [9.932, 76.267],
  "nellore": [14.442, 79.986],
  "bhavnagar": [21.774, 72.152],
  "dehradun": [30.316, 78.032],
  "durgapur": [23.520, 87.311],
  "asansol": [23.685, 86.983],
  "rourkela": [22.260, 84.854],
  "nanded": [19.150, 77.320],
  "kolhapur": [16.705, 74.243],
  "ajmer": [26.449, 74.639],
  "gulbarga": [17.335, 76.836],
  "kalaburagi": [17.335, 76.836],
  "jamnagar": [22.472, 70.058],
  "ujjain": [23.179, 75.785],
  "loni": [28.752, 77.288],
  "siliguri": [26.727, 88.395],
  "jhansi": [25.449, 78.567],
  "ulhasnagar": [19.217, 73.150],
  "nellore ": [14.442, 79.986],
  "jammu": [32.727, 74.857],
  "sangli": [16.855, 74.564],
  "belgaum": [15.850, 74.498],
  "belagavi": [15.850, 74.498],
  "mangalore": [12.914, 74.856],
  "mangaluru": [12.914, 74.856],
  "ambattur": [13.099, 80.161],
  "tirunelveli": [8.727, 77.696],
  "malegaon": [20.554, 74.532],
  "gaya": [24.796, 85.010],
  "tirupur": [11.108, 77.341],
  "davanagere": [14.470, 75.921],
  "kozhikode": [11.259, 75.780],
  "calicut": [11.259, 75.780],
  "akola": [20.700, 77.007],
  "kurnool": [15.828, 78.037],
  "rajahmundry": [17.005, 81.804],
  "bokaro": [23.669, 86.151],
  "south dumdum": [22.612, 88.404],
  "bellary": [15.140, 76.921],
  "patiala": [30.339, 76.386],
  "gopalpur": [19.264, 84.899],
  "agartala": [23.831, 91.286],
  "bhagalpur": [25.245, 87.005],
  "muzaffarnagar": [29.472, 77.703],
  "bhatpara": [22.868, 88.407],
  "panihati": [22.694, 88.375],
  "latur": [18.408, 76.564],
  "dhule": [20.902, 74.777],
  "rohtak": [28.895, 76.606],
  "korba": [22.361, 82.681],
  "bhilwara": [25.347, 74.641],
  "berhampur": [19.315, 84.792],
  "muzaffarpur": [26.120, 85.365],
  "ahmednagar": [19.095, 74.748],
  "mathura": [27.492, 77.673],
  "kollam": [8.893, 76.614],
  "avadi": [13.115, 80.098],
  "kadapa": [14.475, 78.824],
  "kamarhati": [22.671, 88.376],
  "sambalpur": [21.470, 83.977],
  "bilaspur": [22.080, 82.155],
  "shahjahanpur": [27.883, 79.912],
  "satara": [17.687, 74.001],
  "bijapur": [16.826, 75.716],
  "vijayapura": [16.826, 75.716],
  "rampur": [28.812, 79.028],
  "shimla": [31.104, 77.173],
  "thiruvananthapuram": [8.524, 76.936],
  "trivandrum": [8.524, 76.936],
  "chandrapur": [19.973, 79.298],
  "khammam": [17.247, 80.150],
  "karimnagar": [18.438, 79.129],
  "thane": [19.218, 72.978],
  "tirupati": [13.629, 79.419],
  "hisar": [29.152, 75.722],
  "gandhinagar": [23.222, 72.685],
  "vellore": [12.917, 79.132],
};

// Freeze to a normalized map.
const CITY_COORDS: Record<string, CityCoords> = Object.fromEntries(
  Object.entries(RAW).map(([k, [lat, lon]]) => [
    k.trim().toLowerCase(),
    { lat, lon },
  ])
);

export function lookupCity(name: string | null | undefined): CityCoords | null {
  if (!name) return null;
  const key = String(name).trim().toLowerCase();
  return CITY_COORDS[key] || null;
}

/** Great-circle distance between two lat/lon points, in kilometres. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find the closest known Indian city (from the bundled lookup table) to a
 * given coordinate. Used to show a "closest proximity" distance on the
 * field-agent GPS widget when no exact city match is available.
 */
export function findNearestCity(
  lat: number,
  lon: number
): { name: string; distanceKm: number } | null {
  let best: { name: string; distanceKm: number } | null = null;
  const seen = new Set<string>();
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    const dupeKey = `${coords.lat.toFixed(3)},${coords.lon.toFixed(3)}`;
    if (seen.has(dupeKey)) continue;
    seen.add(dupeKey);
    const d = haversineKm(lat, lon, coords.lat, coords.lon);
    if (!best || d < best.distanceKm) {
      best = { name: key.replace(/\b\w/g, (c) => c.toUpperCase()), distanceKm: d };
    }
  }
  return best;
}


/** Approximate geographic centre of India. */
export const INDIA_CENTER: [number, number] = [22.9, 79.5];
export const INDIA_ZOOM = 5;
