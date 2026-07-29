import {
  getArticleContent,
  getBackendHealth,
  getNewsWithMeta,
  HttpError,
} from "./news-service.ts";
import { getCommodityMarketSnapshot } from "../api/_lib/commodity-markets.ts";
import {
  enforceRequestPolicy,
  isBlockedRequestDecision,
  withArticleContentTokens,
  validateArticleContentToken,
} from "./request-security.ts";
import { getWeatherSnapshot } from "./weather-service.ts";
import type { LanguageCode, LocalEdition, NewsFeedResponse, RegionCode } from "../src/types";

type QueryValue = string | undefined;

export type ApiRequestLike = {
  headers?: Headers | Record<string, unknown>;
  ip?: string;
  method?: string;
  query?: Record<string, unknown>;
  socket?: {
    remoteAddress?: string | null;
  };
  url?: string;
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

function clampText(value: string | undefined, maxLength: number) {
  return (value ?? "").trim().slice(0, maxLength);
}

export async function handleNewsRequest(request: ApiRequestLike, response: ApiResponseLike) {
  try {
    const rawQuery = (readQueryValue(request.query?.q) ?? "").trim();
    const decision = enforceRequestPolicy(request, "news", { query: rawQuery });
    if (isBlockedRequestDecision(decision)) {
      response.status(decision.status).json(decision.payload);
      return;
    }

    const category = readQueryValue(request.query?.category) ?? "general";
    const query = rawQuery.slice(0, 120);
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
    response.status(200).json({
      ...result.feed,
      articles: withArticleContentTokens(result.feed.articles),
    });
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
  const decision = enforceRequestPolicy(_request, "health");
  if (isBlockedRequestDecision(decision)) {
    response.status(decision.status).json(decision.payload);
    return;
  }

  setCacheControl(response, "no-store");
  response.status(200).json(getBackendHealth());
}

export async function handleWeatherRequest(request: ApiRequestLike, response: ApiResponseLike) {
  try {
    const decision = enforceRequestPolicy(request, "weather");
    if (isBlockedRequestDecision(decision)) {
      response.status(decision.status).json(decision.payload);
      return;
    }

    const language = (readQueryValue(request.query?.lang) ?? "sk") as LanguageCode;
    const region = (readQueryValue(request.query?.region) ?? "SK") as RegionCode;
    const localEdition = (readQueryValue(request.query?.localEdition) ?? "all") as LocalEdition;
    const latitude = Number(readQueryValue(request.query?.latitude));
    const longitude = Number(readQueryValue(request.query?.longitude));
    const locationLabel = clampText(readQueryValue(request.query?.locationLabel), 100);

    const snapshot = await getWeatherSnapshot({
      language,
      latitude: Number.isFinite(latitude) ? latitude : undefined,
      localEdition,
      locationLabel,
      longitude: Number.isFinite(longitude) ? longitude : undefined,
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

export async function handleMarketsRequest(request: ApiRequestLike, response: ApiResponseLike) {
  try {
    const decision = enforceRequestPolicy(request, "markets");
    if (isBlockedRequestDecision(decision)) {
      response.status(decision.status).json(decision.payload);
      return;
    }

    const snapshot = await getCommodityMarketSnapshot();
    setCacheControl(
      response,
      process.env.NODE_ENV === "production"
        ? "public, max-age=1800, s-maxage=21600, stale-while-revalidate=86400"
        : "no-store"
    );
    setHeader(response, "X-Baky-Markets-Source", "world-bank-pink-sheet");
    response.status(200).json(snapshot);
  } catch (error) {
    console.error("Error fetching markets:", error);
    response.status(500).json({ error: "Chyba pri nacitani komoditnej burzy." });
  }
}

export async function handleArticleContentRequest(request: ApiRequestLike, response: ApiResponseLike) {
  try {
    const url = readQueryValue(request.query?.url);
    const token = readQueryValue(request.query?.token) ?? "";
    const decision = enforceRequestPolicy(request, "article", { articleUrl: url });
    if (isBlockedRequestDecision(decision)) {
      response.status(decision.status).json(decision.payload);
      return;
    }

    if (!url) {
      response.status(400).json({ error: "URL is required" });
      return;
    }

    if (!validateArticleContentToken(url, token)) {
      response.status(403).json({ error: "Access denied" });
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
