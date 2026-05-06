import {
  getArticleContent,
  getBackendHealth,
  getNewsWithMeta,
  HttpError,
} from "./news-service.ts";
import { getWeatherSnapshot } from "./weather-service.ts";
import type { LanguageCode, LocalEdition, NewsFeedResponse, RegionCode } from "../src/types";

type QueryValue = string | undefined;

export type ApiRequestLike = {
  query?: Record<string, unknown>;
};

export type ApiResponseLike = {
  json(payload: unknown): unknown;
  setHeader?(name: string, value: string): unknown;
  status(code: number): ApiResponseLike;
};

function readQueryValue(value: unknown): QueryValue {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
}

function setCacheControl(response: ApiResponseLike, value: string) {
  if (typeof response.setHeader === "function") {
    response.setHeader("Cache-Control", value);
  }
}

function setHeader(response: ApiResponseLike, name: string, value: string) {
  if (typeof response.setHeader === "function") {
    response.setHeader(name, value);
  }
}

export async function handleNewsRequest(request: ApiRequestLike, response: ApiResponseLike) {
  try {
    const category = readQueryValue(request.query?.category) ?? "general";
    const query = (readQueryValue(request.query?.q) ?? "").trim();
    const refresh = readQueryValue(request.query?.refresh) === "true";
    const language = (readQueryValue(request.query?.lang) ?? "sk") as LanguageCode;
    const region = (readQueryValue(request.query?.region) ?? "SK") as RegionCode;
    const localEdition = (readQueryValue(request.query?.localEdition) ?? "all") as LocalEdition;

    const result = await getNewsWithMeta({
      category,
      language,
      localEdition,
      query,
      refresh,
      region,
    });
    const isProduction = process.env.NODE_ENV === "production";
    setCacheControl(
      response,
      !isProduction
        ? "no-store"
        : refresh
        ? "no-store"
        : "public, max-age=60, s-maxage=120, stale-while-revalidate=300"
    );
    setHeader(response, "X-Baky-Cache-State", result.meta.cacheState);
    setHeader(response, "X-Baky-Feed-Updated-At", result.meta.updatedAt);
    setHeader(response, "X-Baky-Source-Mode", result.meta.sourceMode);
    response.status(200).json(result.feed);
  } catch (error) {
    console.error("Error fetching news:", error);
    if (process.env.NODE_ENV === "production") {
      const emptyFeed = {
        articles: [],
        editorial: null,
        localEdition: null,
      } satisfies NewsFeedResponse;
      setCacheControl(response, "no-store");
      setHeader(response, "X-Baky-Cache-State", "error-empty");
      setHeader(response, "X-Baky-Feed-Updated-At", new Date().toISOString());
      setHeader(response, "X-Baky-Source-Mode", "error-empty");
      response.status(200).json(emptyFeed);
      return;
    }

    response.status(500).json({ error: "Chyba pri stahovani sprav." });
  }
}

export async function handleHealthRequest(_request: ApiRequestLike, response: ApiResponseLike) {
  setCacheControl(response, "no-store");
  response.status(200).json(getBackendHealth());
}

export async function handleWeatherRequest(request: ApiRequestLike, response: ApiResponseLike) {
  try {
    const language = (readQueryValue(request.query?.lang) ?? "sk") as LanguageCode;
    const region = (readQueryValue(request.query?.region) ?? "SK") as RegionCode;
    const localEdition = (readQueryValue(request.query?.localEdition) ?? "all") as LocalEdition;

    const snapshot = await getWeatherSnapshot({
      language,
      localEdition,
      region,
    });
    setCacheControl(
      response,
      process.env.NODE_ENV === "production"
        ? "public, max-age=300, s-maxage=600, stale-while-revalidate=1800"
        : "no-store"
    );
    response.status(200).json(snapshot);
  } catch (error) {
    console.error("Error fetching weather:", error);
    response.status(500).json({ error: "Chyba pri nacitani pocasia." });
  }
}

export async function handleArticleContentRequest(request: ApiRequestLike, response: ApiResponseLike) {
  try {
    const url = readQueryValue(request.query?.url);
    if (!url) {
      response.status(400).json({ error: "URL is required" });
      return;
    }

    const result = await getArticleContent(url);
    const isProduction = process.env.NODE_ENV === "production";
    setCacheControl(
      response,
      !isProduction
        ? "no-store"
        : result.content
        ? "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
        : "no-store"
    );
    response.status(200).json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      response.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.warn("Error scraping article, returning empty content for fallback:", error);
    response.status(200).json({ content: "" });
  }
}
