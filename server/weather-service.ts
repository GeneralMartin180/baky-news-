import axios from "axios";
import NodeCache from "node-cache";

import type {
  LanguageCode,
  LocalEdition,
  RegionCode,
  WeatherSnapshot,
} from "../src/types";

type WeatherLocation = {
  countryCode?: string;
  label: string;
  latitude?: number;
  longitude?: number;
  query: string;
};

const weatherCache = new NodeCache({ stdTTL: 600 });
const WEATHER_REQUEST_TIMEOUT_MS = 3000;

const DEFAULT_REGION_LOCATIONS: Record<RegionCode, WeatherLocation> = {
  AT: {
    countryCode: "AT",
    label: "Viedeň",
    latitude: 48.20849,
    longitude: 16.37208,
    query: "Vienna",
  },
  CZ: {
    countryCode: "CZ",
    label: "Praha",
    latitude: 50.08804,
    longitude: 14.42076,
    query: "Prague",
  },
  DE: {
    countryCode: "DE",
    label: "Berlín",
    latitude: 52.52437,
    longitude: 13.41053,
    query: "Berlin",
  },
  GB: {
    countryCode: "GB",
    label: "Londýn",
    latitude: 51.50853,
    longitude: -0.12574,
    query: "London",
  },
  SK: {
    countryCode: "SK",
    label: "Rimavská Sobota",
    latitude: 48.38284,
    longitude: 20.02239,
    query: "Rimavska Sobota",
  },
  US: {
    countryCode: "US",
    label: "New York",
    latitude: 40.71427,
    longitude: -74.00597,
    query: "New York",
  },
};

const LOCAL_EDITION_LOCATIONS: Record<Exclude<LocalEdition, "all">, WeatherLocation> = {
  bratislava: {
    countryCode: "SK",
    label: "Bratislava",
    latitude: 48.14816,
    longitude: 17.10674,
    query: "Bratislava",
  },
  kosice: {
    countryCode: "SK",
    label: "Košice",
    latitude: 48.71395,
    longitude: 21.25808,
    query: "Kosice",
  },
  presov: {
    countryCode: "SK",
    label: "Prešov",
    latitude: 48.99839,
    longitude: 21.23393,
    query: "Presov",
  },
  "rimavska-sobota": {
    countryCode: "SK",
    label: "Rimavská Sobota",
    latitude: 48.38284,
    longitude: 20.02239,
    query: "Rimavska Sobota",
  },
  vychod: {
    countryCode: "SK",
    label: "Košice",
    latitude: 48.71395,
    longitude: 21.25808,
    query: "Kosice",
  },
};

function normalizeQuery(value: string) {
  return value.toLowerCase().trim();
}

async function safeFetch<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }

    return safeFetch(fn, retries - 1);
  }
}

function resolveWeatherLocation(region: RegionCode, localEdition: LocalEdition): WeatherLocation {
  if (localEdition !== "all" && LOCAL_EDITION_LOCATIONS[localEdition]) {
    return LOCAL_EDITION_LOCATIONS[localEdition];
  }

  return DEFAULT_REGION_LOCATIONS[region] ?? DEFAULT_REGION_LOCATIONS.SK;
}

async function geocodeLocation(
  location: WeatherLocation,
  language: LanguageCode
): Promise<{ latitude: number; longitude: number }> {
  if (typeof location.latitude === "number" && typeof location.longitude === "number") {
    return {
      latitude: location.latitude,
      longitude: location.longitude,
    };
  }

  const normalizedQuery = normalizeQuery(location.query);
  const cacheKey = `weather-geocode-${normalizedQuery}-${location.countryCode ?? "any"}-${language}`;
  const cached = weatherCache.get<{ latitude: number; longitude: number }>(cacheKey);
  if (cached) {
    return cached;
  }

  const fetchGeocode = async (countryCode?: string) => {
    const response = await safeFetch(
      () =>
        axios.get("https://geocoding-api.open-meteo.com/v1/search", {
          params: {
            count: 1,
            countryCode,
            format: "json",
            language,
            name: location.query,
          },
          timeout: WEATHER_REQUEST_TIMEOUT_MS,
        }),
      2
    );

    return response.data?.results?.[0];
  };

  const result =
    (await fetchGeocode(location.countryCode)) ??
    (location.countryCode ? await fetchGeocode(undefined) : null);

  if (!result?.latitude || !result?.longitude) {
    throw new Error(`Geocode failed for ${location.query}`);
  }

  const coordinates = {
    latitude: Number(result.latitude),
    longitude: Number(result.longitude),
  };

  weatherCache.set(cacheKey, coordinates, 24 * 60 * 60);
  return coordinates;
}

export async function getWeatherSnapshot(options: {
  language?: LanguageCode;
  latitude?: number;
  localEdition?: LocalEdition;
  locationLabel?: string;
  longitude?: number;
  region?: RegionCode;
} = {}): Promise<WeatherSnapshot> {
  const language = options.language ?? "sk";
  const localEdition = options.localEdition ?? "all";
  const region = options.region ?? "SK";
  const hasPreciseLocation =
    typeof options.latitude === "number" &&
    Number.isFinite(options.latitude) &&
    typeof options.longitude === "number" &&
    Number.isFinite(options.longitude);
  const location = hasPreciseLocation
    ? {
        label: options.locationLabel || "Aktualna poloha",
        latitude: options.latitude!,
        longitude: options.longitude!,
        query: options.locationLabel || "Aktualna poloha",
      }
    : resolveWeatherLocation(region, localEdition);
  const cacheKey = hasPreciseLocation
    ? `weather-location-${options.latitude?.toFixed(3)}-${options.longitude?.toFixed(3)}-${language}`
    : `weather-${region}-${localEdition}-${language}`;
  const cached = weatherCache.get<WeatherSnapshot>(cacheKey);
  if (cached) {
    return cached;
  }

  const coordinates = await geocodeLocation(location, language);
  const response = await safeFetch(
    () =>
      axios.get("https://api.open-meteo.com/v1/forecast", {
        params: {
          current: [
            "temperature_2m",
            "apparent_temperature",
            "is_day",
            "weather_code",
            "wind_speed_10m",
          ].join(","),
          daily: [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_probability_max",
          ].join(","),
          forecast_days: 1,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          timezone: "auto",
        },
        timeout: WEATHER_REQUEST_TIMEOUT_MS,
      }),
    2
  );

  const current = response.data?.current;
  const daily = response.data?.daily;
  if (!current || !daily) {
    throw new Error("Weather API returned incomplete data.");
  }

  const snapshot = {
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
  } satisfies WeatherSnapshot;

  weatherCache.set(cacheKey, snapshot, 5 * 60);
  return snapshot;
}
