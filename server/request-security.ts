import crypto from "node:crypto";

import type { NewsArticle } from "../src/types";

export type RequestLike = {
  headers?: Headers | Record<string, unknown>;
  ip?: string;
  method?: string;
  query?: Record<string, unknown>;
  socket?: {
    remoteAddress?: string | null;
  };
  url?: string;
};

export type RequestPolicy =
  | "article"
  | "health"
  | "news"
  | "weather";

type PolicyConfig = {
  cooldownMs?: number;
  cooldownScope?: string;
  max: number;
  suspiciousAgentBlocked?: boolean;
  windowMs: number;
};

type PolicyOptions = {
  articleUrl?: string;
  query?: string;
};

type DecisionAllowed = {
  allowed: true;
  headers: Record<string, string>;
};

type DecisionBlocked = {
  allowed: false;
  headers: Record<string, string>;
  payload: { error: string };
  status: number;
};

export type RequestDecision = DecisionAllowed | DecisionBlocked;

const DEFAULT_HEADERS: Record<string, string> = {
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

const POLICY_CONFIG: Record<RequestPolicy, PolicyConfig> = {
  article: {
    cooldownMs: 4000,
    max: 24,
    suspiciousAgentBlocked: true,
    windowMs: 15 * 60 * 1000,
  },
  health: {
    max: 60,
    windowMs: 15 * 60 * 1000,
  },
  news: {
    max: 90,
    windowMs: 15 * 60 * 1000,
  },
  weather: {
    cooldownMs: 1500,
    max: 120,
    windowMs: 15 * 60 * 1000,
  },
};

const SUSPICIOUS_USER_AGENT_PATTERN =
  /(axios|bot|crawl|curl|go-http-client|headless|httpclient|insomnia|java\/|node-fetch|okhttp|phantom|playwright|postman|powershell|python|scrapy|selenium|wget)/i;
const SEARCH_WINDOW_MS = 60 * 1000;
const SEARCH_MAX_REQUESTS = 8;
const SEARCH_COOLDOWN_MS = 2500;
const ARTICLE_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const cooldownBuckets = new Map<string, number>();
let cleanupTick = 0;
let warnedAboutSecret = false;

function cleanupExpiredEntries(now: number) {
  cleanupTick += 1;
  if (cleanupTick % 250 !== 0) {
    return;
  }

  for (const [key, value] of rateBuckets.entries()) {
    if (value.resetAt <= now) {
      rateBuckets.delete(key);
    }
  }

  for (const [key, value] of cooldownBuckets.entries()) {
    if (value <= now) {
      cooldownBuckets.delete(key);
    }
  }
}

function getHeader(request: RequestLike, name: string) {
  const lowerName = name.toLowerCase();
  const headers = request.headers;

  if (!headers) {
    return "";
  }

  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name) ?? "";
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lowerName) {
      continue;
    }

    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value) && typeof value[0] === "string") {
      return value[0];
    }
  }

  return "";
}

function getClientIp(request: RequestLike) {
  const forwardedFor = getHeader(request, "x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.ip || getHeader(request, "x-real-ip") || request.socket?.remoteAddress || "unknown";
}

function isLoopbackIp(ip: string) {
  return ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1";
}

function shouldSkipProtection(request: RequestLike) {
  return process.env.NODE_ENV !== "production" && isLoopbackIp(getClientIp(request));
}

function normalizeTextForKeys(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s:/.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function incrementRate(key: string, max: number, windowMs: number, now: number) {
  const current = rateBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  current.count += 1;
  return current.count > max;
}

function violatesCooldown(key: string, cooldownMs: number, now: number) {
  const expiresAt = cooldownBuckets.get(key);
  if (expiresAt && expiresAt > now) {
    return true;
  }

  cooldownBuckets.set(key, now + cooldownMs);
  return false;
}

function isSuspiciousAgent(request: RequestLike) {
  return SUSPICIOUS_USER_AGENT_PATTERN.test(getHeader(request, "user-agent"));
}

function isBrowserLikeFetch(request: RequestLike) {
  const secFetchSite = getHeader(request, "sec-fetch-site").toLowerCase();
  return secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none";
}

function block(status: number, error: string): DecisionBlocked {
  return {
    allowed: false,
    headers: DEFAULT_HEADERS,
    payload: { error },
    status,
  };
}

function getSigningSecret() {
  const explicitSecret =
    process.env.BAKY_API_SIGNING_SECRET || process.env.BAKY_NEWS_SIGNING_SECRET;

  if (explicitSecret) {
    return explicitSecret;
  }

  if (process.env.NODE_ENV === "production" && !warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn(
      "BAKY_API_SIGNING_SECRET is not set. Falling back to an internal default secret."
    );
  }

  return `baky-news:${process.cwd()}:${process.env.NODE_ENV ?? "development"}`;
}

function signArticleUrl(url: string, expiresAt: number) {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(`${url}|${expiresAt}`)
    .digest("hex");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function getDefaultSecurityHeaders() {
  return { ...DEFAULT_HEADERS };
}

export function isBlockedRequestDecision(
  decision: RequestDecision
): decision is DecisionBlocked {
  return !decision.allowed;
}

export function validateArticleContentToken(url: string, token: string) {
  if (!token) {
    return false;
  }

  const [expiresAtRaw, signature] = token.split(".", 2);
  const expiresAt = Number(expiresAtRaw);
  if (!signature || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  return safeCompare(signArticleUrl(url, expiresAt), signature);
}

export function withArticleContentTokens(articles: NewsArticle[]): NewsArticle[] {
  return articles.map((article) => {
    const expiresAt = Date.now() + ARTICLE_TOKEN_TTL_MS;
    return {
      ...article,
      contentToken: `${expiresAt}.${signArticleUrl(article.url, expiresAt)}`,
    };
  });
}

export function enforceRequestPolicy(
  request: RequestLike,
  policy: RequestPolicy,
  options: PolicyOptions = {}
): RequestDecision {
  if (shouldSkipProtection(request)) {
    return { allowed: true, headers: DEFAULT_HEADERS };
  }

  const now = Date.now();
  cleanupExpiredEntries(now);

  const clientIp = getClientIp(request);
  const config = POLICY_CONFIG[policy];
  const baseKey = `${policy}:${clientIp}`;

  if (incrementRate(baseKey, config.max, config.windowMs, now)) {
    return block(429, "Prilis vela poziadaviek. Skuste to neskor.");
  }

  if (config.cooldownMs) {
    const cooldownScope =
      config.cooldownScope ||
      normalizeTextForKeys(options.articleUrl || options.query || request.url || baseKey);
    const cooldownKey = `${policy}:cooldown:${clientIp}:${cooldownScope}`;
    if (violatesCooldown(cooldownKey, config.cooldownMs, now)) {
      return block(429, "Poziadavka bola odoslana prilis rychlo. Skuste to znovu o chvilu.");
    }
  }

  if (policy === "news" && options.query) {
    const normalizedQuery = normalizeTextForKeys(options.query);
    if (!normalizedQuery || normalizedQuery.length > 120) {
      return block(400, "Neplatny vyhladavaci dotaz.");
    }

    const searchKey = `news-search:${clientIp}:${normalizedQuery}`;
    if (incrementRate(searchKey, SEARCH_MAX_REQUESTS, SEARCH_WINDOW_MS, now)) {
      return block(429, "Vyhladavanie je docasne obmedzene. Skuste to neskor.");
    }

    if (violatesCooldown(`${searchKey}:cooldown`, SEARCH_COOLDOWN_MS, now)) {
      return block(429, "Vyhladavanie opakujete prilis rychlo.");
    }
  }

  if (policy === "article" && config.suspiciousAgentBlocked) {
    if (isSuspiciousAgent(request) && !isBrowserLikeFetch(request)) {
      return block(403, "Pristup bol zablokovany.");
    }
  }

  return {
    allowed: true,
    headers: DEFAULT_HEADERS,
  };
}
