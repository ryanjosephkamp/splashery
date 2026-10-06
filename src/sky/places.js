// Lane Night sky: the built-in places and the clock helpers. A place the person types or the
// browser gives ("Use my location") lives only in memory (src/packs/night-sky.js): never in a
// link, a saved scene or a request.

// Latitude and longitude (degrees, east positive) of each city's center, and its time zone.
export const CITIES = [
  { id: "new-york", name: "New York", lat: 40.7128, lon: -74.006, tz: "America/New_York" },
  { id: "los-angeles", name: "Los Angeles", lat: 34.0522, lon: -118.2437, tz: "America/Los_Angeles" },
  { id: "chicago", name: "Chicago", lat: 41.8781, lon: -87.6298, tz: "America/Chicago" },
  { id: "anchorage", name: "Anchorage", lat: 61.2181, lon: -149.9003, tz: "America/Anchorage" },
  { id: "honolulu", name: "Honolulu", lat: 21.3069, lon: -157.8583, tz: "Pacific/Honolulu" },
  { id: "mexico-city", name: "Mexico City", lat: 19.4326, lon: -99.1332, tz: "America/Mexico_City" },
  { id: "sao-paulo", name: "São Paulo", lat: -23.5505, lon: -46.6333, tz: "America/Sao_Paulo" },
  { id: "reykjavik", name: "Reykjavík", lat: 64.1466, lon: -21.9426, tz: "Atlantic/Reykjavik" },
  { id: "london", name: "London", lat: 51.5072, lon: -0.1276, tz: "Europe/London" },
  { id: "paris", name: "Paris", lat: 48.8566, lon: 2.3522, tz: "Europe/Paris" },
  { id: "cairo", name: "Cairo", lat: 30.0444, lon: 31.2357, tz: "Africa/Cairo" },
  { id: "nairobi", name: "Nairobi", lat: -1.2921, lon: 36.8219, tz: "Africa/Nairobi" },
  { id: "cape-town", name: "Cape Town", lat: -33.9249, lon: 18.4241, tz: "Africa/Johannesburg" },
  { id: "mumbai", name: "Mumbai", lat: 19.076, lon: 72.8777, tz: "Asia/Kolkata" },
  { id: "singapore", name: "Singapore", lat: 1.3521, lon: 103.8198, tz: "Asia/Singapore" },
  { id: "beijing", name: "Beijing", lat: 39.9042, lon: 116.4074, tz: "Asia/Shanghai" },
  { id: "tokyo", name: "Tokyo", lat: 35.6762, lon: 139.6503, tz: "Asia/Tokyo" },
  { id: "sydney", name: "Sydney", lat: -33.8688, lon: 151.2093, tz: "Australia/Sydney" },
]; // prettier-ignore

export const DEFAULT_CITY = "new-york";

export const cityById = (id) => CITIES.find((c) => c.id === id) || CITIES[0];

// The person's own time zone (for a typed place or "my location").
export function deviceZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// The wall-clock parts of a moment in a time zone.
function partsIn(ms, tz) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}

// "2026-10-05T21:30" for a datetime-local input, in the place's time zone.
export function toLocalInput(ms, tz) {
  const p = partsIn(ms, tz);
  const z = (n, w = 2) => String(n).padStart(w, "0");
  return `${z(p.y, 4)}-${z(p.mo)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}`;
}

// The moment a datetime-local value names in a time zone (two passes settle daylight time).
export function fromLocalInput(value, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || "");
  if (!m) return NaN;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let ms = wall;
  for (let k = 0; k < 2; k++) {
    const p = partsIn(ms, tz);
    const seen = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
    ms += wall - seen;
  }
  return ms;
}

// "Mon, Oct 5, 2026, 9:30 PM EDT".
export function formatWhen(ms, tz) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toUTCString();
  }
}

// "40.7° N, 74.0° W".
export function formatLatLon(lat, lon) {
  const f = (v, p, n) => `${Math.abs(v).toFixed(1)}° ${v >= 0 ? p : n}`;
  return `${f(lat, "N", "S")}, ${f(lon, "E", "W")}`;
}

// Compass words for an azimuth (from north, through east).
const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]; // prettier-ignore
export const compass = (az) => POINTS[Math.round((((az % 360) + 360) % 360) / 22.5) % 16];
