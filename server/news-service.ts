import axios from "axios";
import * as cheerio from "cheerio";
import NodeCache from "node-cache";
import Parser from "rss-parser";

import type {
  Category,
  EditorialBriefing,
  LanguageCode,
  LocalEdition,
  LocalEditionSummary,
  NewsArticle,
  NewsFeedResponse,
  RegionCode,
} from "../src/types";

const cache = new NodeCache({ stdTTL: 600 });
const parser = new Parser<any, any>({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
    ],
  },
});

type PreparedFeedEntry = {
  expiresAtMs: number;
  feed: NewsFeedResponse;
  lastRefreshDurationMs: number;
  sourceMode: string;
  staleAtMs: number;
  updatedAtMs: number;
};

type SourceRuntimeState = {
  avgDurationMs: number;
  consecutiveFailures: number;
  failures: number;
  key: string;
  label: string;
  lastDurationMs: number;
  lastError?: string;
  lastFailureAt?: string;
  lastSuccessAt?: string;
  successes: number;
  url: string;
};

type NormalizedGetNewsOptions = {
  activeLocalEdition: LocalEditionSummary | null;
  cacheKey: string;
  normalizedLanguage: LanguageCode;
  normalizedLocalEdition: LocalEdition;
  normalizedRegion: RegionCode;
  requestedCategory: Category;
  searchQuery: string;
  useLocalEdition: boolean;
};

type NewsRequestMeta = {
  backgroundRefresh: boolean;
  cacheState: "fresh" | "miss" | "refreshed" | "stale";
  sourceMode: string;
  updatedAt: string;
};

type NewsServiceResult = {
  feed: NewsFeedResponse;
  meta: NewsRequestMeta;
};

type PipelineMetrics = {
  articleContentCacheHits: number;
  articleContentCacheMisses: number;
  articleContentRequests: number;
  articleImageCacheHits: number;
  articleImageCacheMisses: number;
  backgroundRefreshes: number;
  cacheHits: number;
  cacheMisses: number;
  feedRequests: number;
  forcedRefreshes: number;
  lastPrewarmAt: string | null;
  prewarmRuns: number;
  refreshFailures: number;
  refreshSuccesses: number;
  sourceFailures: number;
  sourceSuccesses: number;
  staleServed: number;
};

type FeedCandidate = {
  label: string;
  url: string;
};

type CategoryPageConfig = {
  sourceName: string;
  url: string;
};

type ArticleContentResult = {
  content: string;
};

type GetNewsOptions = {
  category?: string;
  language?: LanguageCode;
  localEdition?: LocalEdition;
  query?: string;
  refresh?: boolean;
  region?: RegionCode;
};

const DEFAULT_LANGUAGE: LanguageCode = "sk";
const DEFAULT_LOCAL_EDITION: LocalEdition = "all";
const DEFAULT_REGION: RegionCode = "SK";
const IS_VERCEL_RUNTIME = Boolean(process.env.VERCEL);
const SUPPORTED_LANGUAGES: LanguageCode[] = ["sk", "en", "cs", "de"];
const SUPPORTED_LOCAL_EDITIONS: LocalEdition[] = [
  "all",
  "bratislava",
  "kosice",
  "presov",
  "rimavska-sobota",
  "vychod",
];
const SUPPORTED_REGIONS: RegionCode[] = ["SK", "US", "GB", "CZ", "DE", "AT"];

const BBC_FEEDS: Record<Category, FeedCandidate[]> = {
  business: [
    { label: "bbc-business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
    { label: "bbc-news", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  entertainment: [
    { label: "bbc-entertainment", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml" },
    { label: "bbc-news", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  general: [
    { label: "bbc-news", url: "https://feeds.bbci.co.uk/news/rss.xml" },
    { label: "bbc-world", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  ],
  health: [
    { label: "bbc-health", url: "https://feeds.bbci.co.uk/news/health/rss.xml" },
    { label: "bbc-news", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  science: [
    { label: "bbc-science", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" },
    { label: "bbc-technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
    { label: "bbc-news", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  sports: [
    { label: "bbc-sport", url: "https://feeds.bbci.co.uk/sport/rss.xml" },
    { label: "bbc-news", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  technology: [
    { label: "bbc-technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
    { label: "bbc-science", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" },
    { label: "bbc-news", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
};
const BBC_SEARCH_FEEDS: FeedCandidate[] = [
  ...BBC_FEEDS.general,
  ...BBC_FEEDS.business,
  ...BBC_FEEDS.technology,
  ...BBC_FEEDS.science,
  ...BBC_FEEDS.health,
  ...BBC_FEEDS.sports,
  ...BBC_FEEDS.entertainment,
];

const CATEGORY_PAGE_CONFIG: Record<string, CategoryPageConfig> = {
  science: {
    sourceName: "Aktuality.sk",
    url: "https://www.aktuality.sk/spravy/veda/23/"
  },
  health: {
    sourceName: "Aktuality.sk",
    url: "https://www.aktuality.sk/zdravie/"
  },
  entertainment: {
    sourceName: "Aktuality.sk",
    url: "https://www.aktuality.sk/kultura/koktejl/"
  }
};
const CATEGORY_LABELS: Record<Category, string> = {
  business: "Biznis",
  entertainment: "Kultúra a zábava",
  general: "Hlavné správy",
  health: "Zdravie",
  science: "Veda",
  sports: "Šport",
  technology: "Technológie",
};
const LOCAL_EDITIONS: Record<
  Exclude<LocalEdition, "all">,
  Omit<LocalEditionSummary, "id"> & { query: string }
> = {
  bratislava: {
    badge: "Lokálna edícia",
    description: "Dôraz na dopravu, magistrát, školy, zdravotníctvo a mestské dianie v Bratislave.",
    label: "Bratislava",
    query: "Bratislava doprava policia magistrat skoly nemocnica kultura",
  },
  kosice: {
    badge: "Lokálna edícia",
    description: "Košický mix správ so zameraním na mesto, služby, bezpečnosť a verejný priestor.",
    label: "Košice",
    query: "Kosice doprava policia magistrat skoly nemocnica kultura",
  },
  presov: {
    badge: "Lokálna edícia",
    description: "Prešovský výber pre dopravu, samosprávu, krajské témy a dostupnosť služieb.",
    label: "Prešov",
    query: "Presov doprava policia nemocnica kraj mesto skoly kultura",
  },
  "rimavska-sobota": {
    badge: "Lokálna edícia",
    description: "Dôraz na mesto, okres, služby a regionálne dianie v Rimavskej Sobote.",
    label: "Rimavská Sobota",
    query: "Rimavska Sobota doprava policia mesto okres skoly nemocnica kultura",
  },
  vychod: {
    badge: "Regionálny fokus",
    description: "Východné Slovensko cez Košice, Prešov a témy s priamym dopadom na región.",
    label: "Východ",
    query: "Kosice Presov vychod Slovenska doprava policia kraj nemocnica mesto",
  },
};
const TOPIC_KEYWORDS: Array<{ keywords: string[]; label: string }> = [
  { label: "Doprava", keywords: ["doprava", "cesta", "vlak", "autobus", "diaľnic", "nehod", "most", "tunel"] },
  { label: "Bezpečnosť", keywords: ["policia", "policaj", "bezpec", "hasi", "sud", "vysetr", "nehod", "krimi"] },
  { label: "Politika", keywords: ["vlada", "parlament", "minister", "volby", "koalicia", "opozicia", "magistrat"] },
  { label: "Zdravie", keywords: ["zdrav", "nemocnic", "lekar", "medicin", "chorob", "prevenc"] },
  { label: "Vzdelávanie", keywords: ["skol", "univerzit", "student", "vyuc", "maturit"] },
  { label: "Ekonomika", keywords: ["ekonom", "trh", "invest", "firma", "biznis", "inflaci", "mzda"] },
  { label: "Technológie", keywords: ["technolog", "ai", "umela inteligencia", "startup", "aplikac", "softver", "internet"] },
  { label: "Kultúra", keywords: ["film", "hudb", "serial", "festival", "divadl", "kultur", "stream"] },
  { label: "Šport", keywords: ["sport", "futbal", "hokej", "tenis", "liga", "zapas", "trener"] },
];
const DEFAULT_IMAGE_ENRICHMENT_LIMIT = IS_VERCEL_RUNTIME ? 8 : 24;
const FEED_FRESH_TTL_MS = 2 * 60 * 1000;
const FEED_STALE_TTL_MS = 12 * 60 * 1000;
const PREWARM_INTERVAL_MS = 3 * 60 * 1000;
const SEARCH_IMAGE_ENRICHMENT_LIMIT = IS_VERCEL_RUNTIME ? 4 : 8;
const ARTICLE_ENRICHMENT_CONCURRENCY = IS_VERCEL_RUNTIME ? 3 : 8;
const ARTICLE_IMAGE_TIMEOUT_MS = IS_VERCEL_RUNTIME ? 4000 : 7000;
const preparedFeeds = new Map<string, PreparedFeedEntry>();
const inflightFeedRefreshes = new Map<string, Promise<PreparedFeedEntry>>();
const sourceRuntime = new Map<string, SourceRuntimeState>();
const pipelineMetrics: PipelineMetrics = {
  articleContentCacheHits: 0,
  articleContentCacheMisses: 0,
  articleContentRequests: 0,
  articleImageCacheHits: 0,
  articleImageCacheMisses: 0,
  backgroundRefreshes: 0,
  cacheHits: 0,
  cacheMisses: 0,
  feedRequests: 0,
  forcedRefreshes: 0,
  lastPrewarmAt: null,
  prewarmRuns: 0,
  refreshFailures: 0,
  refreshSuccesses: 0,
  sourceFailures: 0,
  sourceSuccesses: 0,
  staleServed: 0,
};
let pipelineStarted = false;
let prewarmTimer: NodeJS.Timeout | null = null;

export class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
}

function nowIso() {
  return new Date().toISOString();
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function recordSourceSuccess(key: string, label: string, url: string, durationMs: number) {
  pipelineMetrics.sourceSuccesses += 1;
  const previous = sourceRuntime.get(key);
  const successes = (previous?.successes ?? 0) + 1;
  const avgDurationMs = previous
    ? Math.round(((previous.avgDurationMs * previous.successes) + durationMs) / successes)
    : durationMs;

  sourceRuntime.set(key, {
    avgDurationMs,
    consecutiveFailures: 0,
    failures: previous?.failures ?? 0,
    key,
    label,
    lastDurationMs: durationMs,
    lastError: previous?.lastError,
    lastFailureAt: previous?.lastFailureAt,
    lastSuccessAt: nowIso(),
    successes,
    url,
  });
}

function recordSourceFailure(
  key: string,
  label: string,
  url: string,
  durationMs: number,
  error: unknown
) {
  pipelineMetrics.sourceFailures += 1;
  const previous = sourceRuntime.get(key);

  sourceRuntime.set(key, {
    avgDurationMs: previous?.avgDurationMs ?? durationMs,
    consecutiveFailures: (previous?.consecutiveFailures ?? 0) + 1,
    failures: (previous?.failures ?? 0) + 1,
    key,
    label,
    lastDurationMs: durationMs,
    lastError: errorMessage(error),
    lastFailureAt: nowIso(),
    lastSuccessAt: previous?.lastSuccessAt,
    successes: previous?.successes ?? 0,
    url,
  });
}

function normalizeNewsRequest({
  category = "general",
  language = DEFAULT_LANGUAGE,
  localEdition = DEFAULT_LOCAL_EDITION,
  query = "",
  region = DEFAULT_REGION,
}: GetNewsOptions = {}): NormalizedGetNewsOptions {
  const normalizedLanguage = normalizeLanguage(language);
  const normalizedLocalEdition = normalizeLocalEdition(localEdition);
  const normalizedRegion = normalizeRegion(region);
  const requestedCategory = (category !== "undefined" ? category : "general") as Category;
  const searchQuery = query.trim();
  const useLocalEdition = shouldUseLocalEdition(
    normalizedLocalEdition,
    requestedCategory,
    searchQuery,
    normalizedLanguage,
    normalizedRegion
  );
  const activeLocalEdition = useLocalEdition
    ? getLocalEditionSummary(
        normalizedLocalEdition,
        normalizedLanguage,
        normalizedRegion
      )
    : null;

  return {
    activeLocalEdition,
    cacheKey: `news-${requestedCategory}-${searchQuery}-${normalizedLanguage}-${normalizedRegion}-${normalizedLocalEdition}`,
    normalizedLanguage,
    normalizedLocalEdition,
    normalizedRegion,
    requestedCategory,
    searchQuery,
    useLocalEdition,
  };
}

function getPrewarmRequests(): GetNewsOptions[] {
  return [
    { category: "general", language: "sk", region: "SK", localEdition: "all" },
    { category: "technology", language: "sk", region: "SK", localEdition: "all" },
    { category: "business", language: "sk", region: "SK", localEdition: "all" },
    { category: "sports", language: "sk", region: "SK", localEdition: "all" },
    { category: "science", language: "sk", region: "SK", localEdition: "all" },
    { category: "entertainment", language: "sk", region: "SK", localEdition: "all" },
    { category: "health", language: "sk", region: "SK", localEdition: "all" },
    { category: "general", language: "sk", region: "SK", localEdition: "bratislava" },
    { category: "general", language: "sk", region: "SK", localEdition: "kosice" },
    { category: "general", language: "sk", region: "SK", localEdition: "presov" },
    { category: "general", language: "sk", region: "SK", localEdition: "rimavska-sobota" },
    { category: "general", language: "sk", region: "SK", localEdition: "vychod" },
  ];
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanVisibleText(value: string): string {
  return cleanText(
    value
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
  );
}

function normalizeTitleKey(value: string): string {
  return cleanVisibleText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

function decodeBase64Segment(value: string): string {
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function normalizeLanguage(value?: string): LanguageCode {
  return SUPPORTED_LANGUAGES.includes(value as LanguageCode)
    ? (value as LanguageCode)
    : DEFAULT_LANGUAGE;
}

function normalizeRegion(value?: string): RegionCode {
  return SUPPORTED_REGIONS.includes(value as RegionCode)
    ? (value as RegionCode)
    : DEFAULT_REGION;
}

function normalizeLocalEdition(value?: string): LocalEdition {
  return SUPPORTED_LOCAL_EDITIONS.includes(value as LocalEdition)
    ? (value as LocalEdition)
    : DEFAULT_LOCAL_EDITION;
}

function isSlovakEdition(language: LanguageCode, region: RegionCode) {
  return language === "sk" && region === "SK";
}

function shouldUseLocalEdition(
  localEdition: LocalEdition,
  category: Category,
  query: string,
  language: LanguageCode,
  region: RegionCode
) {
  return localEdition !== "all" && !query && category === "general" && isSlovakEdition(language, region);
}

function getLocalEditionSummary(
  localEdition: LocalEdition,
  language: LanguageCode,
  region: RegionCode
): LocalEditionSummary | null {
  if (!isSlovakEdition(language, region) || localEdition === "all") {
    return null;
  }

  const config = LOCAL_EDITIONS[localEdition];
  if (!config) {
    return null;
  }

  return {
    badge: config.badge,
    description: config.description,
    id: localEdition,
    label: config.label,
  };
}

function dedupeFeedCandidates(candidates: FeedCandidate[]): FeedCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) {
      return false;
    }

    seen.add(candidate.url);
    return true;
  });
}

function buildLocalEditionCandidates(
  localEdition: LocalEdition,
  language: LanguageCode = DEFAULT_LANGUAGE,
  region: RegionCode = DEFAULT_REGION
): FeedCandidate[] {
  if (!isSlovakEdition(language, region) || localEdition === "all") {
    return [];
  }

  const config = LOCAL_EDITIONS[localEdition];
  if (!config) {
    return [];
  }

  return dedupeFeedCandidates([
    ...buildFeedCandidates("general", "", language, region),
    { label: "aktuality-business", url: "https://www.aktuality.sk/rss/ekonomika/" },
    { label: "startitup-business", url: "https://www.startitup.sk/feed/" },
    ...BBC_FEEDS.business,
  ]);
}

function buildFeedCandidates(
  category: Category = "general",
  query?: string,
  language: LanguageCode = DEFAULT_LANGUAGE,
  region: RegionCode = DEFAULT_REGION
): FeedCandidate[] {
  if (query) {
    return dedupeFeedCandidates(BBC_SEARCH_FEEDS);
  }

  if (!isSlovakEdition(language, region)) {
    return dedupeFeedCandidates([...(BBC_FEEDS[category] ?? BBC_FEEDS.general), ...BBC_FEEDS.general]);
  }

  switch (category) {
    case "technology":
      return [
        { label: "zive", url: "https://zive.aktuality.sk/rss/najnovsie/" },
        ...BBC_FEEDS.technology,
      ];
    case "business":
      return [
        { label: "aktuality-business", url: "https://www.aktuality.sk/rss/ekonomika/" },
        { label: "startitup-business", url: "https://www.startitup.sk/feed/" },
        ...BBC_FEEDS.business,
      ];
    case "sports":
      return [
        { label: "sport", url: "https://sport.aktuality.sk/rss/" },
        ...BBC_FEEDS.sports,
      ];
    case "science":
      return BBC_FEEDS.science;
    case "entertainment":
      return [
        { label: "aktuality-koktejl", url: "https://www.aktuality.sk/rss/koktejl/" },
        ...BBC_FEEDS.entertainment,
      ];
    case "health":
      return BBC_FEEDS.health;
    case "general":
    default:
      return [
        { label: "aktuality-general", url: "https://www.aktuality.sk/rss/" },
        { label: "startitup-general", url: "https://www.startitup.sk/feed/" },
        { label: "eu-featured-news", url: "https://european-union.europa.eu/node/309/rss_en" },
        ...BBC_FEEDS.general,
      ];
  }
}

function buildEmergencyFeedCandidates(
  category: Category = "general",
  language: LanguageCode = DEFAULT_LANGUAGE,
  region: RegionCode = DEFAULT_REGION
): FeedCandidate[] {
  return dedupeFeedCandidates([...(BBC_FEEDS[category] ?? BBC_FEEDS.general), ...BBC_FEEDS.general]);
}

function getCategoryPageConfig(
  category: Category | undefined,
  query: string | undefined,
  language: LanguageCode,
  region: RegionCode
): CategoryPageConfig | null {
  if (query || !category || !isSlovakEdition(language, region)) {
    return null;
  }

  return CATEGORY_PAGE_CONFIG[category] ?? null;
}

function extractPulseCmsImage(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const assetId = parsedUrl.pathname.split("/").filter(Boolean).pop();
    if (!assetId || assetId.length < 20 || !/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(assetId)) {
      return null;
    }

    if (
      parsedUrl.hostname.includes("ocdn.eu") ||
      parsedUrl.hostname.includes("img.aktuality.sk") ||
      parsedUrl.hostname.includes("zive.aktuality.sk")
    ) {
      return `https://ocdn.eu/pulscms-transforms/1/${assetId}`;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeImageUrl(rawUrl: string): string {
  if (!rawUrl) {
    return "";
  }

  let imageUrl = rawUrl.trim();

  if (imageUrl.startsWith("//")) {
    imageUrl = `https:${imageUrl}`;
  } else if (imageUrl.startsWith("http://")) {
    imageUrl = imageUrl.replace("http://", "https://");
  }

  const pulseCmsImage = extractPulseCmsImage(imageUrl);
  if (pulseCmsImage) {
    imageUrl = pulseCmsImage;
  }

  if (imageUrl.includes("ichef.bbci.co.uk")) {
    imageUrl = imageUrl.replace(/\/ace\/standard\/\d+\//, "/ace/standard/1024/");
  }

  if (imageUrl.includes("cmestatic.com")) {
    imageUrl = imageUrl.replace(/\/size\/[0-9x]+\//, "/size/orig/");
  }

  if (imageUrl.includes("ta3.com")) {
    imageUrl = imageUrl.replace("/thumbs/", "/").replace("/t_", "/");
  }

  if (imageUrl.includes("pravda.sk")) {
    imageUrl = imageUrl.replace(/\/w[0-9]+\//, "/");
  }

  if (
    imageUrl.includes("i0.wp.com") ||
    imageUrl.includes("i1.wp.com") ||
    imageUrl.includes("i2.wp.com")
  ) {
    imageUrl = imageUrl.replace(/\?(fit|w|h|resize|zoom)=[^&]+(&[^&]+)*/i, "");
  }

  imageUrl = imageUrl.replace(/-[0-9]+x[0-9]+\.(jpg|jpeg|png|webp)$/i, ".$1");

  if (imageUrl.includes("wp-content") || imageUrl.includes("pravda.sk")) {
    imageUrl = imageUrl.split("?")[0];
  }

  return imageUrl;
}

function resolveUrl(rawUrl: string, baseUrl: string): string {
  if (!rawUrl) {
    return "";
  }

  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return rawUrl;
  }
}

function isJunkImage(imageUrl: string): boolean {
  if (!imageUrl) {
    return false;
  }

  let hostname = "";
  try {
    hostname = new URL(imageUrl).hostname.toLowerCase();
  } catch {
    hostname = "";
  }

  return (
    imageUrl.includes("favicon") ||
    imageUrl.includes("/logo-fixed") ||
    imageUrl.includes("/mobile-logo") ||
    imageUrl.includes("/logo/") ||
    imageUrl.includes("tracking") ||
    imageUrl.includes("pixel") ||
    imageUrl.includes("placeholder") ||
    (imageUrl.length < 85 && (imageUrl.includes("avatar") || imageUrl.includes("user") || imageUrl.includes("author")))
  );
}

function getFallbackSourceName(label: string): string {
  if (label.includes("bbc")) return label.includes("sport") ? "BBC Sport" : "BBC News";
  if (label.includes("eu-featured")) return "European Union";
  if (label.includes("startitup")) return "Startitup";
  if (label.includes("zive")) return "Zive.sk";
  if (label.includes("sport")) return "Sport.sk";
  if (label.includes("aktuality")) return "Aktuality.sk";
  return "Spravodajstvo";
}

function extractSourceName(itemContent: string, itemDescription: string, fallback: string): string {
  const markup = `${itemDescription} ${itemContent}`.trim();
  if (markup) {
    const $ = cheerio.load(markup);
    const sourceText = $("font").last().text().trim();
    if (sourceText) {
      return sourceText;
    }
  }

  return fallback;
}

function sanitizeDescription(itemDescription: string, itemContent: string, contentSnippet: string): string {
  let cleanDescription = contentSnippet || "";
  const rawContent = `${itemDescription} ${itemContent}`.trim();

  if (
    !cleanDescription ||
    cleanDescription.length < 40 ||
    cleanDescription.includes("Obsah nie je k dispozicii") ||
    cleanDescription.includes("Zobrazit cely clanok")
  ) {
    if (rawContent) {
      const $ = cheerio.load(rawContent);
      $("table, img, script, style, .ads, .sidebar, .related, .thumb, .media").remove();
      const rawText = $.text().trim();
      if (rawText.length > 20) {
        cleanDescription = rawText;
      }
    }
  }

  cleanDescription = cleanDescription
    .replace(/<[^>]*>?/gm, "")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

  if (!cleanDescription || cleanDescription.length < 5) {
    return "Kliknite pre zobrazenie celeho clanku a podrobnosti.";
  }

  return cleanDescription;
}

function extractBestSrcsetUrl(rawSrcset: string): string {
  if (!rawSrcset) {
    return "";
  }

  const candidates = rawSrcset
    .split(",")
    .map((part) => cleanText(part).split(" ")[0])
    .filter(Boolean);

  return candidates[candidates.length - 1] || candidates[0] || "";
}

function extractCategoryCardImage(
  $: cheerio.CheerioAPI,
  article: cheerio.Cheerio<any>
): string {
  const sourceCandidates = article
    .find("source[data-srcset], source[srcset]")
    .map((_, el) => extractBestSrcsetUrl($(el).attr("data-srcset") || $(el).attr("srcset") || ""))
    .get()
    .filter(Boolean);

  const directCandidates = [
    article.find("img[data-src]").first().attr("data-src") || "",
    article.find("img[data-lazy-src]").first().attr("data-lazy-src") || "",
    article.find("noscript img").first().attr("src") || "",
    article.find("img").first().attr("src") || ""
  ].filter(Boolean);

  const candidates = [...sourceCandidates.reverse(), ...directCandidates];

  for (const candidate of candidates) {
    if (!candidate || candidate.startsWith("data:image")) {
      continue;
    }

    const normalized = normalizeImageUrl(candidate);
    if (normalized && !isJunkImage(normalized)) {
      return normalized;
    }
  }

  return "";
}

function sanitizeCategoryDescription(value: string): string {
  const description = cleanText(value)
    .replace(/^\s*PR\b\s*/i, "")
    .trim();

  if (!description || description.length < 10) {
    return "Kliknite pre zobrazenie celeho clanku a podrobnosti.";
  }

  return description.slice(0, 200) + (description.length > 200 ? "..." : "");
}

function parseCategoryPublishedAt(value: string): string {
  const rawValue = cleanText(value);
  const now = new Date();

  const relativeMatch = rawValue.match(/^(dnes|včera|vcera)\s+(\d{1,2}):(\d{2})/iu);
  if (relativeMatch) {
    const parsedDate = new Date(now);
    if (/včera|vcera/iu.test(relativeMatch[1])) {
      parsedDate.setDate(parsedDate.getDate() - 1);
    }
    parsedDate.setHours(Number(relativeMatch[2]), Number(relativeMatch[3]), 0, 0);
    return parsedDate.toUTCString();
  }

  const absoluteMatch = rawValue.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (absoluteMatch) {
    const [, day, month, year, hour = "0", minute = "0"] = absoluteMatch;
    const parsedDate = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0
    );
    return parsedDate.toUTCString();
  }

  return now.toUTCString();
}

function extractAktualityTransformSize(imageUrl: string): { height: number; width: number } | null {
  if (!imageUrl.includes("img.aktuality.sk")) {
    return null;
  }

  try {
    const parsedUrl = new URL(imageUrl);
    const transformSegment = parsedUrl.pathname.split("/").filter(Boolean)[2] || "";
    const decodedTransform = decodeBase64Segment(transformSegment);
    const match = decodedTransform.match(/^(\d+)x(\d+)\//);

    if (!match) {
      return null;
    }

    return {
      width: Number(match[1]),
      height: Number(match[2])
    };
  } catch {
    return null;
  }
}

function shouldEnhanceArticleImage(articleUrl: string, imageUrl: string): boolean {
  try {
    const articleHost = new URL(articleUrl).hostname.toLowerCase();
    const supportsArticleImageEnhancement =
      articleHost === "www.aktuality.sk" ||
      articleHost.endsWith(".aktuality.sk");

    if (!supportsArticleImageEnhancement) {
      return false;
    }

    if (!imageUrl || imageUrl.includes("blank.png")) {
      return true;
    }

    const imageSize = extractAktualityTransformSize(imageUrl);
    return Boolean(imageSize && (imageSize.width < 500 || imageSize.height < 280));
  } catch {
    return false;
  }
}

export function isUrlSafe(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (!["http:", "https:"].includes(url.protocol)) return false;

    const hostname = url.hostname.toLowerCase();
    const blockedHostnames = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "internal-server"];
    if (blockedHostnames.includes(hostname)) return false;

    if (hostname.split(".").length === 4) {
      const parts = hostname.split(".").map(Number);
      if (
        parts[0] === 10 ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

async function fetchWithRetry(
  url: string,
  config: Record<string, unknown> = {},
  retries = 3,
  timeouts: number[] = [8000, 15000, 15000]
) {
  for (let index = 0; index < retries; index += 1) {
    try {
      const timeout = timeouts[index] ?? timeouts[timeouts.length - 1] ?? 8000;
      return await axios.get(url, { ...config, timeout });
    } catch (error) {
      if (index === retries - 1) {
        throw error;
      }

      console.warn(`Retry ${index + 1} for ${url}...`);
      await new Promise((resolve) => setTimeout(resolve, 500 * (index + 1)));
    }
  }

  throw new Error(`Unable to fetch ${url}`);
}

async function extractPrimaryArticleImage(articleUrl: string): Promise<string> {
  const cacheKey = `article-image-${articleUrl}`;
  const cachedImage = cache.get<string>(cacheKey);
  if (typeof cachedImage === "string") {
    pipelineMetrics.articleImageCacheHits += 1;
    return cachedImage;
  }

  pipelineMetrics.articleImageCacheMisses += 1;

  try {
    const response = await fetchWithRetry(
      articleUrl,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept-Language": "sk-SK,sk;q=0.9,en;q=0.8"
        }
      },
      1,
      [ARTICLE_IMAGE_TIMEOUT_MS]
    );

    const $ = cheerio.load(response.data);
    const candidates = [
      $('meta[property="og:image"]').attr("content") || "",
      $('meta[property="og:image:secure_url"]').attr("content") || "",
      $('meta[name="twitter:image"]').attr("content") || "",
      $('meta[itemprop="image"]').attr("content") || "",
      $('link[rel="image_src"]').attr("href") || "",
      extractBestSrcsetUrl(
        $("article source[data-srcset], main source[data-srcset], source[data-srcset]").first().attr("data-srcset") ||
          ""
      ),
      $('article img[data-src], main img[data-src], img[data-src]').first().attr("data-src") || "",
      $('article noscript img, main noscript img, noscript img').first().attr("src") || ""
    ];

    for (const candidate of candidates) {
      const normalized = normalizeImageUrl(resolveUrl(candidate, articleUrl));
      if (normalized && !isJunkImage(normalized) && !normalized.includes("blank.png")) {
        cache.set(cacheKey, normalized, 3600);
        return normalized;
      }
    }
  } catch (error) {
    console.warn(`Nepodarilo sa obohatit obrazok z clanku: ${articleUrl}`, error);
  }

  cache.set(cacheKey, "", 600);
  return "";
}

async function fetchCategoryPageArticles(config: CategoryPageConfig): Promise<NewsArticle[]> {
  console.log(`Scrapujem kategoriu: ${config.url}`);
  const sourceKey = `category:${config.sourceName}:${config.url}`;
  const startedAt = Date.now();

  try {
    const response = await fetchWithRetry(
      config.url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept-Language": "sk-SK,sk;q=0.9,en;q=0.8"
        }
      },
      1,
      [7000]
    );

    const $ = cheerio.load(response.data);
    const seen = new Set<string>();

    const articles = $("article.article-item")
      .map((_, element) => {
        const article = $(element);
        const rawUrl =
          article.find(".item-link[href*='/clanok/']").last().attr("href") ||
          article.find("a.article-image[href*='/clanok/']").first().attr("href") ||
          article.find("a[href*='/clanok/']").last().attr("href") ||
          "";

        if (!rawUrl) {
          return null;
        }

        const articleUrl = new URL(rawUrl, config.url).toString();
        if (seen.has(articleUrl)) {
          return null;
        }

        const title = cleanText(
          article.find(".item-link").last().text() ||
            article.find("a[title]").last().attr("title") ||
            ""
        );

        if (!title) {
          return null;
        }

        seen.add(articleUrl);

        return {
          title,
          description: sanitizeCategoryDescription(
            article.find(".item-perex, .article-perex, p").first().text()
          ),
          url: articleUrl,
          urlToImage: extractCategoryCardImage($, article),
          publishedAt: parseCategoryPublishedAt(article.find(".item-time, time").first().text()),
          source: {
            name: config.sourceName
          }
        } satisfies NewsArticle;
      })
      .get()
      .filter((article): article is NewsArticle => Boolean(article));

    if (!articles.length) {
      throw new Error(`No articles parsed from category page: ${config.url}`);
    }

    recordSourceSuccess(
      sourceKey,
      `${config.sourceName} category`,
      config.url,
      Date.now() - startedAt
    );
    return articles.slice(0, 24);
  } catch (error) {
    recordSourceFailure(
      sourceKey,
      `${config.sourceName} category`,
      config.url,
      Date.now() - startedAt,
      error
    );
    throw error;
  }
}

async function fetchFeed(candidates: FeedCandidate[]) {
  let lastError: unknown;

  for (const candidate of candidates) {
    const sourceKey = `feed:${candidate.label}`;
    const startedAt = Date.now();

    try {
      console.log(`Ziskavam RSS (${candidate.label}): ${candidate.url}`);
      const response = await fetchWithRetry(
        candidate.url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Accept: "application/rss+xml, application/xml, text/xml, */*"
          }
        },
        1,
        [6000]
      );
      const feed = await parser.parseString(response.data);
      if (!feed.items?.length) {
        throw new Error("RSS feed is empty");
      }

      recordSourceSuccess(sourceKey, candidate.label, candidate.url, Date.now() - startedAt);
      return { candidate, feed };
    } catch (error) {
      lastError = error;
      recordSourceFailure(sourceKey, candidate.label, candidate.url, Date.now() - startedAt, error);
      console.warn(`RSS kandidat zlyhal (${candidate.label}).`);
    }
  }

  throw lastError ?? new Error("No feed candidate succeeded");
}

function mapFeedItems(candidate: FeedCandidate, feed: any): NewsArticle[] {
  return feed.items
    .filter((item: any) => item.link)
    .map((item: any) => {
      const itemDescription = item.description || "";
      const itemContent = item.content || item["content:encoded"] || "";
      let imageUrl = item.enclosure?.url || "";

      if (!imageUrl && (item.mediaContent || item["media:content"])) {
        const mediaContent = item.mediaContent || item["media:content"];
        imageUrl =
          (Array.isArray(mediaContent)
            ? mediaContent[mediaContent.length - 1]?.$?.url
            : mediaContent.$?.url || mediaContent.url) || "";
      }

      if (!imageUrl && (item.mediaThumbnail || item["media:thumbnail"])) {
        const mediaThumbnail = item.mediaThumbnail || item["media:thumbnail"];
        imageUrl =
          (Array.isArray(mediaThumbnail)
            ? mediaThumbnail[mediaThumbnail.length - 1]?.$?.url
            : mediaThumbnail.$?.url || mediaThumbnail.url) || "";
      }

      if (!imageUrl) {
        const imageMarkup = `${itemDescription} ${itemContent}`;
        const imageMatch = imageMarkup.match(/<img[^>]+src="([^">]+)"/i);
        if (imageMatch) {
          imageUrl = imageMatch[1];
        }
      }

      imageUrl = normalizeImageUrl(imageUrl);
      if (isJunkImage(imageUrl)) {
        imageUrl = "";
      }

      const cleanDescription = sanitizeDescription(
        itemDescription,
        itemContent,
        item.contentSnippet || ""
      );

      return {
        title: cleanVisibleText((item.title || "Bez nazvu").split(" - ")[0].trim()),
        description:
          cleanDescription.slice(0, 200) + (cleanDescription.length > 200 ? "..." : ""),
        url: item.link || "",
        urlToImage: imageUrl,
        publishedAt: item.pubDate || new Date().toUTCString(),
        source: {
          name: extractSourceName(
            itemContent,
            itemDescription,
            getFallbackSourceName(candidate.label)
          ),
        },
      } satisfies NewsArticle;
    });
}

function filterCandidateArticlesByQuery(articles: NewsArticle[], query: string): NewsArticle[] {
  const tokens = normalizeTitleKey(query)
    .split(" ")
    .filter((token) => token.length > 2);

  if (!tokens.length) {
    return articles;
  }

  const matches = articles.filter((article) => {
    const haystack = normalizeTitleKey(`${article.title} ${article.description} ${article.source.name}`);
    return tokens.some((token) => haystack.includes(token));
  });

  return matches.length ? matches : articles;
}

async function fetchCandidateArticles(candidates: FeedCandidate[], query = "") {
  if (query) {
    const articles: NewsArticle[] = [];
    let lastError: unknown;

    for (const candidate of candidates) {
      try {
        const result = await fetchFeed([candidate]);
        articles.push(...mapFeedItems(result.candidate, result.feed));
        if (articles.length >= 60) {
          break;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (!articles.length) {
      throw lastError ?? new Error("No feed candidate succeeded");
    }

    return filterCandidateArticlesByQuery(articles, query);
  }

  const { candidate, feed } = await fetchFeed(candidates);
  return mapFeedItems(candidate, feed);
}

function dedupeArticles(articles: NewsArticle[]) {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  return articles.filter((article) => {
    let urlKey = article.url.toLowerCase();

    try {
      const parsedUrl = new URL(article.url);
      urlKey = `${parsedUrl.hostname}${parsedUrl.pathname}`.toLowerCase();
    } catch {
      urlKey = article.url.toLowerCase();
    }

    const titleKey = normalizeTitleKey(article.title);
    if (seenUrls.has(urlKey) || (titleKey.length > 24 && seenTitles.has(titleKey))) {
      return false;
    }

    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    return true;
  });
}

function getTopTopics(articles: NewsArticle[]) {
  const scores = new Map<string, number>();
  const haystack = articles
    .slice(0, 8)
    .map((article) => `${article.title} ${article.description}`.toLowerCase());

  for (const topic of TOPIC_KEYWORDS) {
    let score = 0;

    for (const text of haystack) {
      if (topic.keywords.some((keyword) => text.includes(keyword))) {
        score += 1;
      }
    }

    if (score > 0) {
      scores.set(topic.label, score);
    }
  }

  return Array.from(scores.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([label]) => label)
    .slice(0, 3);
}

function getBriefingKicker() {
  const hour = new Date().getHours();

  if (hour < 10) return "Ranný briefing";
  if (hour < 16) return "Denný update";
  if (hour < 21) return "Večerný sumár";
  return "Nočný prehľad";
}

function buildSummaryText(articles: NewsArticle[], localEdition: LocalEditionSummary | null) {
  const fragments = articles
    .slice(0, 3)
    .map((article) => cleanVisibleText(article.description))
    .filter((description) => description.length > 20);

  const combined = cleanVisibleText(fragments.join(" "));
  const trimmed = combined.slice(0, 280).trim();
  if (trimmed) {
    return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
  }

  if (localEdition) {
    return `${localEdition.label} je v tejto edícii namixovaná s dôrazom na praktický dopad tém na mesto, dopravu a verejné služby.`;
  }

  return "Feed je zoradený tak, aby hore boli udalosti s najväčším dopadom na verejnú debatu, služby a každodenné fungovanie.";
}

function buildWhyItMatters(
  topTopics: string[],
  query: string,
  localEdition: LocalEditionSummary | null
) {
  if (query) {
    return "Výsledky sú zoradené do jedného prehľadu, aby bolo hneď vidieť, ktoré línie sa opakujú naprieč zdrojmi a čo je iba okrajový šum.";
  }

  if (localEdition && topTopics.length > 0) {
    return `${localEdition.label} dnes najviac rezonuje v témach ${topTopics.join(", ")}. Feed preto uprednostňuje mestský a regionálny dopad pred všeobecným šumom.`;
  }

  if (topTopics.length > 0) {
    return `Briefing uprednostňuje témy ${topTopics.join(", ")}, lebo najčastejšie zasahujú peniaze, služby, bezpečnosť alebo verejnú debatu.`;
  }

  return "Briefing uprednostňuje titulky, ktoré majú najväčší praktický dopad, nie iba vysokú hlučnosť v titulku.";
}

function buildEditorialBriefing(
  articles: NewsArticle[],
  category: Category,
  query: string,
  localEdition: LocalEditionSummary | null
): EditorialBriefing | null {
  if (!articles.length) {
    return null;
  }

  const topTopics = getTopTopics(articles);
  const watchlist = articles.slice(0, 3).map((article) => article.title);
  const headline = query
    ? `Téma "${query}" naprieč zdrojmi`
    : localEdition
    ? `${localEdition.label}: čo dnes hýbe lokálnym feedom`
    : `${CATEGORY_LABELS[category]} v jednom prehľade`;

  return {
    headline,
    kicker: getBriefingKicker(),
    summary: buildSummaryText(articles, localEdition),
    topTopics,
    watchlist,
    whyItMatters: buildWhyItMatters(topTopics, query, localEdition),
  };
}

async function buildNewsFeedResponse(
  options: NormalizedGetNewsOptions
): Promise<{ feed: NewsFeedResponse; sourceMode: string }> {
  let articles: NewsArticle[] = [];
  let sourceMode = "rss";

  const categoryPageConfig = getCategoryPageConfig(
    options.requestedCategory,
    options.searchQuery,
    options.normalizedLanguage,
    options.normalizedRegion
  );

  if (categoryPageConfig) {
    try {
      articles = await fetchCategoryPageArticles(categoryPageConfig);
      sourceMode = "category-page";
    } catch (error) {
      console.warn(`Scraping kategorie zlyhal (${options.requestedCategory}), padam naspat na RSS.`, error);
    }
  }

  if (!articles.length) {
    const primaryCandidates = buildFeedCandidates(
      options.requestedCategory,
      options.searchQuery,
      options.normalizedLanguage,
      options.normalizedRegion
    );
    let primaryArticles: NewsArticle[] = [];

    try {
      primaryArticles = await fetchCandidateArticles(primaryCandidates, options.searchQuery);
    } catch (primaryError) {
      console.warn(
        `Primary feed candidates failed for ${options.requestedCategory}, trying emergency fallback.`,
        primaryError
      );

      primaryArticles = await fetchCandidateArticles(
        buildEmergencyFeedCandidates(
          options.requestedCategory,
          options.normalizedLanguage,
          options.normalizedRegion
        ),
        options.searchQuery
      );
      sourceMode = "rss-fallback";
    }

    if (options.useLocalEdition) {
      try {
        const localArticles = await fetchCandidateArticles(
          buildLocalEditionCandidates(
            options.normalizedLocalEdition,
            options.normalizedLanguage,
            options.normalizedRegion
          ),
          LOCAL_EDITIONS[options.normalizedLocalEdition]?.query ?? ""
        );
        articles = [...localArticles, ...primaryArticles];
        sourceMode = "rss+local";
      } catch (error) {
        console.warn(`Lokalna edicia zlyhala (${options.normalizedLocalEdition}), ostavam na hlavnom mixe.`, error);
        articles = primaryArticles;
        sourceMode = "rss";
      }
    } else {
      articles = primaryArticles;
      sourceMode = "rss";
    }
  }

  const enrichedArticles = dedupeArticles(await enrichArticles(articles, options.searchQuery));
  const feed = {
    articles: enrichedArticles,
    editorial: buildEditorialBriefing(
      enrichedArticles,
      options.requestedCategory,
      options.searchQuery,
      options.activeLocalEdition
    ),
    localEdition: options.activeLocalEdition,
  } satisfies NewsFeedResponse;

  return { feed, sourceMode };
}

function rememberPreparedFeed(
  cacheKey: string,
  feed: NewsFeedResponse,
  sourceMode: string,
  durationMs: number
) {
  const updatedAtMs = Date.now();
  const entry = {
    expiresAtMs: updatedAtMs + FEED_STALE_TTL_MS,
    feed,
    lastRefreshDurationMs: durationMs,
    sourceMode,
    staleAtMs: updatedAtMs + FEED_FRESH_TTL_MS,
    updatedAtMs,
  } satisfies PreparedFeedEntry;

  preparedFeeds.set(cacheKey, entry);
  cache.set(cacheKey, feed, Math.ceil(FEED_STALE_TTL_MS / 1000));
  return entry;
}

async function refreshPreparedFeed(
  options: NormalizedGetNewsOptions,
  context: { background: boolean; forced: boolean; reason: string }
) {
  const existingRefresh = inflightFeedRefreshes.get(options.cacheKey);
  if (existingRefresh) {
    return existingRefresh;
  }

  if (context.background) {
    pipelineMetrics.backgroundRefreshes += 1;
  }

  if (context.forced) {
    pipelineMetrics.forcedRefreshes += 1;
  }

  const refreshPromise = (async () => {
    const startedAt = Date.now();

    try {
      const result = await buildNewsFeedResponse(options);
      const durationMs = Date.now() - startedAt;
      pipelineMetrics.refreshSuccesses += 1;
      return rememberPreparedFeed(
        options.cacheKey,
        result.feed,
        result.sourceMode,
        durationMs
      );
    } catch (error) {
      pipelineMetrics.refreshFailures += 1;
      console.warn(`Feed refresh failed (${context.reason}) for ${options.cacheKey}`, error);
      throw error;
    } finally {
      inflightFeedRefreshes.delete(options.cacheKey);
    }
  })();

  inflightFeedRefreshes.set(options.cacheKey, refreshPromise);
  return refreshPromise;
}

async function warmPipeline(reason: string) {
  pipelineMetrics.prewarmRuns += 1;
  pipelineMetrics.lastPrewarmAt = nowIso();

  for (const request of getPrewarmRequests()) {
    try {
      await refreshPreparedFeed(normalizeNewsRequest(request), {
        background: true,
        forced: false,
        reason: `prewarm:${reason}`,
      });
    } catch {
      continue;
    }
  }
}

export function startFeedPipeline() {
  if (pipelineStarted) {
    return;
  }

  pipelineStarted = true;
  void warmPipeline("startup");
  prewarmTimer = setInterval(() => {
    void warmPipeline("interval");
  }, PREWARM_INTERVAL_MS);
  prewarmTimer.unref?.();
}

export function getBackendHealth() {
  return {
    feeds: Array.from(preparedFeeds.entries()).map(([cacheKey, entry]) => ({
      articleCount: entry.feed.articles.length,
      cacheKey,
      expiresAt: new Date(entry.expiresAtMs).toISOString(),
      lastRefreshDurationMs: entry.lastRefreshDurationMs,
      sourceMode: entry.sourceMode,
      staleAt: new Date(entry.staleAtMs).toISOString(),
      updatedAt: new Date(entry.updatedAtMs).toISOString(),
    })),
    metrics: {
      ...pipelineMetrics,
      inflightRefreshes: inflightFeedRefreshes.size,
      preparedFeeds: preparedFeeds.size,
      uptimeSeconds: Math.round(process.uptime()),
    },
    sources: Array.from(sourceRuntime.values()).sort((left, right) =>
      left.label.localeCompare(right.label)
    ),
  };
}

async function enrichArticles(
  articles: NewsArticle[],
  searchQuery: string
): Promise<NewsArticle[]> {
  const isSearchResult = Boolean(searchQuery);
  const enrichmentLimit = isSearchResult
    ? SEARCH_IMAGE_ENRICHMENT_LIMIT
    : DEFAULT_IMAGE_ENRICHMENT_LIMIT;
  const articleUrlsToEnrich = new Set(
    articles
      .filter(
        (article) =>
          !article.urlToImage ||
          shouldEnhanceArticleImage(article.url, article.urlToImage)
      )
      .slice(0, enrichmentLimit)
      .map((article) => article.url)
  );

  const result = [...articles];
  const indexesToEnrich = articles
    .map((article, index) => ({ article, index }))
    .filter(({ article }) => articleUrlsToEnrich.has(article.url));

  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(ARTICLE_ENRICHMENT_CONCURRENCY, indexesToEnrich.length) },
    async () => {
      while (cursor < indexesToEnrich.length) {
        const current = indexesToEnrich[cursor];
        cursor += 1;

        try {
          const article = current.article;
          const resolvedUrl = article.url;

          const currentImageUrl = article.urlToImage;
          const needsImageBackfill =
            !currentImageUrl || shouldEnhanceArticleImage(resolvedUrl, currentImageUrl);
          const nextImageUrl = needsImageBackfill
            ? (await extractPrimaryArticleImage(resolvedUrl)) || currentImageUrl
            : currentImageUrl;

          result[current.index] =
            resolvedUrl === article.url && nextImageUrl === article.urlToImage
              ? article
              : {
                  ...article,
                  url: resolvedUrl,
                  urlToImage: nextImageUrl,
                };
        } catch (error) {
          console.warn(`Article enrichment failed for ${current.article.url}`, error);
          result[current.index] = current.article;
        }
      }
    }
  );

  await Promise.all(workers);
  return result;
}

export async function getArticleContent(url: string): Promise<ArticleContentResult> {
  pipelineMetrics.articleContentRequests += 1;

  if (!isUrlSafe(url)) {
    throw new HttpError(403, "Unauthorized URL access attempt.");
  }

  const cacheKey = `article-${url}`;
  const cached = cache.get<ArticleContentResult>(cacheKey);
  if (cached) {
    pipelineMetrics.articleContentCacheHits += 1;
    return cached;
  }

  pipelineMetrics.articleContentCacheMisses += 1;

  try {
    console.log(`Scraping content from: ${url}`);

    const response = await fetchWithRetry(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        }
      }
    );

    const $ = cheerio.load(response.data);
    $("script, style, nav, footer, header, aside, .ads, .comments, .sidebar, iframe, .social-share").remove();

    let content = "";
    const selectors = [
      "article",
      ".article-content",
      ".article-body",
      ".post-content",
      ".entry-content",
      ".main-content",
      ".content",
      ".text",
      "main",
      "#main-content",
      ".story-body",
      ".article__body",
      ".post-body"
    ];

    for (const selector of selectors) {
      const found = $(selector);
      if (found.length === 0) {
        continue;
      }

      const paragraphs = found
        .find("p, div.text, div.body")
        .map((_, element) => $(element).text().trim())
        .get();
      const longParagraphs = paragraphs.filter((paragraph: string) => paragraph.length > 40);

      if (longParagraphs.length > 2) {
        content = longParagraphs.join("\n\n");
        break;
      }
    }

    if (!content) {
      const paragraphs = $("p")
        .map((_, element) => $(element).text().trim())
        .get();
      content = paragraphs.filter((paragraph: string) => paragraph.length > 50).join("\n\n");
    }

    const result = {
      content: content
        .replace(/<[^>]*>?/gm, "")
        .replace(/\s+/g, " ")
        .split("\n\n")
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph.length > 20)
        .join("\n\n")
    };

    cache.set(cacheKey, result, 3600);
    return result;
  } catch (error) {
    console.warn("Error scraping article, returning empty content for fallback:", error);
    return { content: "" };
  }
}

export async function getNewsWithMeta(
  options: GetNewsOptions = {}
): Promise<NewsServiceResult> {
  pipelineMetrics.feedRequests += 1;

  const normalized = normalizeNewsRequest(options);
  const cachedPrepared = preparedFeeds.get(normalized.cacheKey);
  const nowMs = Date.now();

  if (!options.refresh && cachedPrepared && cachedPrepared.staleAtMs > nowMs) {
    pipelineMetrics.cacheHits += 1;
    return {
      feed: cachedPrepared.feed,
      meta: {
        backgroundRefresh: false,
        cacheState: "fresh",
        sourceMode: cachedPrepared.sourceMode,
        updatedAt: new Date(cachedPrepared.updatedAtMs).toISOString(),
      },
    };
  }

  if (!options.refresh && cachedPrepared && cachedPrepared.expiresAtMs > nowMs) {
    pipelineMetrics.staleServed += 1;
    void refreshPreparedFeed(normalized, {
      background: true,
      forced: false,
      reason: "stale-revalidate",
    }).catch(() => undefined);

    return {
      feed: cachedPrepared.feed,
      meta: {
        backgroundRefresh: true,
        cacheState: "stale",
        sourceMode: cachedPrepared.sourceMode,
        updatedAt: new Date(cachedPrepared.updatedAtMs).toISOString(),
      },
    };
  }

  pipelineMetrics.cacheMisses += 1;

  try {
    const refreshed = await refreshPreparedFeed(normalized, {
      background: false,
      forced: Boolean(options.refresh),
      reason: options.refresh ? "forced-request" : "cache-miss",
    });

    return {
      feed: refreshed.feed,
      meta: {
        backgroundRefresh: false,
        cacheState: options.refresh ? "refreshed" : "miss",
        sourceMode: refreshed.sourceMode,
        updatedAt: new Date(refreshed.updatedAtMs).toISOString(),
      },
    };
  } catch (error) {
    if (cachedPrepared) {
      pipelineMetrics.staleServed += 1;
      return {
        feed: cachedPrepared.feed,
        meta: {
          backgroundRefresh: false,
          cacheState: "stale",
          sourceMode: cachedPrepared.sourceMode,
          updatedAt: new Date(cachedPrepared.updatedAtMs).toISOString(),
        },
      };
    }

    const fallbackCache = cache.get<NewsFeedResponse>(normalized.cacheKey);
    if (fallbackCache) {
      pipelineMetrics.staleServed += 1;
      return {
        feed: fallbackCache,
        meta: {
          backgroundRefresh: false,
          cacheState: "stale",
          sourceMode: "fallback-cache",
          updatedAt: nowIso(),
        },
      };
    }

    throw error;
  }
}

export async function getNews(options: GetNewsOptions = {}): Promise<NewsFeedResponse> {
  const result = await getNewsWithMeta(options);
  return result.feed;
}
