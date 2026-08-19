// Automated weather for daily reports.
//
// On report creation we geocode the project's site address once (cached on the
// project row) and pull the weather for the report's date and location. The
// point is documentation: if a job got rained out, it's recorded automatically
// with no manual entry and no disputes later.
//
// Sources:
//   - Open-Meteo is the numeric source of truth. It needs no API key and, for
//     the same lat/lon, cleanly returns hourly temps, daily high/low,
//     precipitation in inches, humidity, wind speed and wind gusts for past
//     dates (archive API), today, and the near future (forecast API) — which
//     NWS does not do cleanly (no historical, no gust/inches in hourly).
//   - NWS (api.weather.gov, US, free, no key) is consulted first for same-day
//     and forecast reports to honor "NWS primary" and to attach a human-readable
//     conditions summary (e.g. "Rain likely"). If NWS is unavailable the report
//     still gets complete numbers from Open-Meteo.
//
// The spec named OpenWeather as the historical fallback; Open-Meteo is used
// instead because it provides the same historical/hourly granularity with no
// API key to provision. Swap in OpenWeather here if a key is ever added.

export type WeatherHour = {
  label: string; // "6 AM", "12 PM", ...
  hour: number; // 0-23, local to the site
  tempF: number | null;
};

export type WeatherData = {
  source: string;
  fetchedAt: string;
  date: string; // YYYY-MM-DD
  latitude: number;
  longitude: number;
  highF: number | null;
  lowF: number | null;
  precipInches: number | null;
  humidityPct: number | null;
  windMph: number | null;
  windGustMph: number | null;
  summary: string | null;
  hourly: WeatherHour[];
};

export type GeoPoint = { latitude: number; longitude: number };

const SAMPLE_HOURS = [6, 9, 12, 15, 18, 21];

function hourLabel(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${period}`;
}

function round(n: number | null | undefined, digits = 0): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

// US Census geocoder — free, no key, accurate on US street addresses. Falls
// back to OpenStreetMap Nominatim for anything Census can't match.
export async function geocodeAddress(
  address: string,
): Promise<GeoPoint | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(
      "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress",
    );
    url.searchParams.set("address", trimmed);
    url.searchParams.set("benchmark", "Public_AR_Current");
    url.searchParams.set("format", "json");
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = (await res.json()) as {
        result?: {
          addressMatches?: { coordinates?: { x: number; y: number } }[];
        };
      };
      const match = data.result?.addressMatches?.[0]?.coordinates;
      if (match && typeof match.x === "number" && typeof match.y === "number") {
        return { latitude: match.y, longitude: match.x };
      }
    }
  } catch (err) {
    console.error("[weather] Census geocode failed:", err);
  }

  // Fallback: Nominatim (global). Requires a descriptive User-Agent.
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", trimmed);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    const res = await fetch(url, {
      headers: { "User-Agent": "JobWalker/1.0 (https://aitechhelper.com)" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = (await res.json()) as { lat: string; lon: string }[];
      const hit = data[0];
      if (hit) {
        const lat = Number(hit.lat);
        const lon = Number(hit.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          return { latitude: lat, longitude: lon };
        }
      }
    }
  } catch (err) {
    console.error("[weather] Nominatim geocode failed:", err);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Open-Meteo (numeric source of truth)
// ---------------------------------------------------------------------------

type OpenMeteoResponse = {
  hourly?: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    precipitation: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
  };
};

function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  return Math.round((da - db) / 86_400_000);
}

async function fetchOpenMeteo(
  lat: number,
  lon: number,
  date: string,
  today: string,
): Promise<Partial<WeatherData>> {
  // The archive API lags real time by a few days, so only reach for it on
  // genuinely older dates; recent past, today, and the future all come from
  // the forecast API (which accepts explicit start/end dates in both directions).
  const useArchive = daysBetween(date, today) < -5;
  const base = useArchive
    ? "https://archive-api.open-meteo.com/v1/archive"
    : "https://api.open-meteo.com/v1/forecast";

  const url = new URL(base);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("start_date", date);
  url.searchParams.set("end_date", date);
  url.searchParams.set(
    "hourly",
    "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_gusts_10m",
  );
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum",
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = (await res.json()) as OpenMeteoResponse;

  const hourly: WeatherHour[] = [];
  let humidityAtNoon: number | null = null;
  let windAtNoon: number | null = null;
  let gustMax: number | null = null;

  if (data.hourly) {
    const { time, temperature_2m, relative_humidity_2m, wind_gusts_10m } =
      data.hourly;
    for (let i = 0; i < time.length; i++) {
      const t = time[i]; // "YYYY-MM-DDTHH:mm"
      if (!t.startsWith(date)) continue;
      const hour = Number(t.slice(11, 13));
      if (typeof wind_gusts_10m?.[i] === "number") {
        gustMax = Math.max(gustMax ?? 0, wind_gusts_10m[i]);
      }
      if (hour === 12) {
        humidityAtNoon = relative_humidity_2m?.[i] ?? null;
        windAtNoon = data.hourly.wind_speed_10m?.[i] ?? null;
      }
      if (SAMPLE_HOURS.includes(hour)) {
        hourly.push({
          label: hourLabel(hour),
          hour,
          tempF: round(temperature_2m?.[i]),
        });
      }
    }
  }

  return {
    highF: round(data.daily?.temperature_2m_max?.[0]),
    lowF: round(data.daily?.temperature_2m_min?.[0]),
    precipInches: round(data.daily?.precipitation_sum?.[0], 2),
    humidityPct: round(humidityAtNoon),
    windMph: round(windAtNoon),
    windGustMph: round(gustMax),
    hourly,
    source: useArchive ? "Open-Meteo (archive)" : "Open-Meteo",
  };
}

// ---------------------------------------------------------------------------
// NWS (primary source for same-day / forecast conditions summary)
// ---------------------------------------------------------------------------

const NWS_HEADERS = {
  "User-Agent": "JobWalker/1.0 (https://aitechhelper.com)",
  Accept: "application/geo+json",
};

async function fetchNwsSummary(
  lat: number,
  lon: number,
  date: string,
): Promise<string | null> {
  try {
    const pointsRes = await fetch(
      `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
      { headers: NWS_HEADERS, signal: AbortSignal.timeout(8000) },
    );
    if (!pointsRes.ok) return null;
    const points = (await pointsRes.json()) as {
      properties?: { forecastHourly?: string };
    };
    const hourlyUrl = points.properties?.forecastHourly;
    if (!hourlyUrl) return null;

    const fcRes = await fetch(hourlyUrl, {
      headers: NWS_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!fcRes.ok) return null;
    const fc = (await fcRes.json()) as {
      properties?: {
        periods?: { startTime: string; shortForecast: string }[];
      };
    };
    const periods = fc.properties?.periods ?? [];
    // The period closest to midday on the report date is the headline condition.
    const noon = periods.find(
      (p) => p.startTime.startsWith(date) && p.startTime.slice(11, 13) === "12",
    );
    const onDate = periods.find((p) => p.startTime.startsWith(date));
    return (noon ?? onDate)?.shortForecast ?? null;
  } catch (err) {
    console.error("[weather] NWS summary failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Fetch and assemble a WeatherData record for a location + date. Returns null
// only if the numeric source is completely unreachable — report creation never
// blocks on weather, it just stores what it could get (or null).
export async function fetchWeather(
  point: GeoPoint,
  date: string,
): Promise<WeatherData | null> {
  const today = todayIso();
  const { latitude, longitude } = point;

  let numbers: Partial<WeatherData>;
  try {
    numbers = await fetchOpenMeteo(latitude, longitude, date, today);
  } catch (err) {
    console.error("[weather] Open-Meteo failed:", err);
    return null;
  }

  let source = numbers.source ?? "Open-Meteo";
  let summary: string | null = null;

  // Honor "NWS primary" for same-day and forecast reports: consult NWS first
  // for the human-readable conditions. Historical dates skip it (NWS has no
  // clean historical endpoint).
  if (date >= today) {
    summary = await fetchNwsSummary(latitude, longitude, date);
    if (summary) source = `NWS + ${source}`;
  }

  return {
    source,
    fetchedAt: new Date().toISOString(),
    date,
    latitude,
    longitude,
    highF: numbers.highF ?? null,
    lowF: numbers.lowF ?? null,
    precipInches: numbers.precipInches ?? null,
    humidityPct: numbers.humidityPct ?? null,
    windMph: numbers.windMph ?? null,
    windGustMph: numbers.windGustMph ?? null,
    summary,
    hourly: numbers.hourly ?? [],
  };
}
