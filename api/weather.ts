import type { LanguageCode, LocalEdition, RegionCode, WeatherSnapshot } from "../src/types";

type WeatherLocation = {
  label: string;
  latitude: number;
  longitude: number;
};

const DEFAULT_REGION_LOCATIONS: Record<RegionCode, WeatherLocation> = {
  AT: { label: "Vieden", latitude: 48.20849, longitude: 16.37208 },
  CZ: { label: "Praha", latitude: 50.08804, longitude: 14.42076 },
  DE: { label: "Berlin", latitude: 52.52437, longitude: 13.41053 },
  GB: { label: "Londyn", latitude: 51.50853, longitude: -0.12574 },
  SK: { label: "Rimavska Sobota", latitude: 48.38284, longitude: 20.02239 },
  US: { label: "New York", latitude: 40.71427, longitude: -74.00597 },
};

const LOCAL_EDITION_LOCATIONS: Record<Exclude<LocalEdition, "all">, WeatherLocation> = {
  bratislava: { label: "Bratislava", latitude: 48.14816, longitude: 17.10674 },
  kosice: { label: "Kosice", latitude: 48.71395, longitude: 21.25808 },
  presov: { label: "Presov", latitude: 48.99839, longitude: 21.23393 },
  "rimavska-sobota": { label: "Rimavska Sobota", latitude: 48.38284, longitude: 20.02239 },
  vychod: { label: "Kosice", latitude: 48.71395, longitude: 21.25808 },
};

const LANGUAGES = new Set<LanguageCode>(["sk", "en", "cs", "de"]);
const LOCAL_EDITIONS = new Set<LocalEdition>([
  "all",
  "bratislava",
  "kosice",
  "presov",
  "rimavska-sobota",
  "vychod",
]);
const REGIONS = new Set<RegionCode>(["SK", "US", "GB", "CZ", "DE", "AT"]);

function buildJsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

function sendJson(response: any, payload: unknown, status = 200, headers: Record<string, string> = {}) {
  if (response?.setHeader) {
    for (const [name, value] of Object.entries({
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    })) {
      response.setHeader(name, value);
    }
  }

  if (response?.status && response?.json) {
    return response.status(status).json(payload);
  }

  return buildJsonResponse(payload, { status, headers });
}

function readSearchParams(request: any) {
  if (request?.query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(request.query as Record<string, unknown>)) {
      if (typeof value === "string") {
        params.set(key, value);
      } else if (Array.isArray(value) && typeof value[0] === "string") {
        params.set(key, value[0]);
      }
    }
    return params;
  }

  return new URL(request.url).searchParams;
}

function normalizeLanguage(value: string | null): LanguageCode {
  return LANGUAGES.has(value as LanguageCode) ? (value as LanguageCode) : "sk";
}

function normalizeLocalEdition(value: string | null): LocalEdition {
  return LOCAL_EDITIONS.has(value as LocalEdition) ? (value as LocalEdition) : "all";
}

function normalizeRegion(value: string | null): RegionCode {
  return REGIONS.has(value as RegionCode) ? (value as RegionCode) : "SK";
}

function normalizeCoordinate(value: string | null) {
  if (!value) return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function resolveLocation(region: RegionCode, localEdition: LocalEdition) {
  if (localEdition !== "all" && LOCAL_EDITION_LOCATIONS[localEdition]) {
    return LOCAL_EDITION_LOCATIONS[localEdition];
  }

  return DEFAULT_REGION_LOCATIONS[region] ?? DEFAULT_REGION_LOCATIONS.SK;
}

function fallbackSnapshot(location: WeatherLocation): WeatherSnapshot {
  return {
    apparentTemperatureC: 0,
    highC: 0,
    isDay: true,
    locationLabel: location.label,
    lowC: 0,
    precipitationProbabilityMax: 0,
    temperatureC: 0,
    updatedAt: new Date().toISOString(),
    weatherCode: 3,
    windSpeedKmh: 0,
  };
}

async function fetchWeatherSnapshot(location: WeatherLocation): Promise<WeatherSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set(
      "current",
      "temperature_2m,apparent_temperature,is_day,weather_code,wind_speed_10m"
    );
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,precipitation_probability_max"
    );
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("timezone", "auto");

    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Weather failed with ${response.status}`);
    }

    const data = await response.json();
    const current = data?.current;
    const daily = data?.daily;
    if (!current || !daily) {
      throw new Error("Weather API returned incomplete data.");
    }

    return {
      apparentTemperatureC: Math.round(Number(current.apparent_temperature ?? current.temperature_2m)),
      highC: Math.round(Number(daily.temperature_2m_max?.[0] ?? current.temperature_2m)),
      isDay: Boolean(current.is_day),
      locationLabel: location.label,
      lowC: Math.round(Number(daily.temperature_2m_min?.[0] ?? current.temperature_2m)),
      precipitationProbabilityMax: Math.round(Number(daily.precipitation_probability_max?.[0] ?? 0)),
      temperatureC: Math.round(Number(current.temperature_2m)),
      updatedAt: current.time ? new Date(current.time).toISOString() : new Date().toISOString(),
      weatherCode: Number(current.weather_code ?? 0),
      windSpeedKmh: Math.round(Number(current.wind_speed_10m ?? 0)),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(request: any, response?: any) {
  const searchParams = readSearchParams(request);
  normalizeLanguage(searchParams.get("lang"));
  const region = normalizeRegion(searchParams.get("region"));
  const localEdition = normalizeLocalEdition(searchParams.get("localEdition"));
  const latitude = normalizeCoordinate(searchParams.get("latitude"));
  const longitude = normalizeCoordinate(searchParams.get("longitude"));
  const locationLabel = (searchParams.get("locationLabel") ?? "").trim();
  const hasPreciseLocation = latitude !== null && longitude !== null;
  const location = hasPreciseLocation
    ? {
        label: locationLabel || "Aktualna poloha",
        latitude: latitude!,
        longitude: longitude!,
      }
    : resolveLocation(region, localEdition);

  try {
    const snapshot = await fetchWeatherSnapshot(location);
    return sendJson(response, snapshot, 200, {
      "Cache-Control": hasPreciseLocation
        ? "no-store"
        : "public, max-age=300, s-maxage=600, stale-while-revalidate=1800",
    });
  } catch (error) {
    console.error("Vercel weather handler failed:", error);
    return sendJson(response, fallbackSnapshot(location), 200, {
      "Cache-Control": "no-store",
      "X-Baky-Weather-State": "fallback",
    });
  }
}
