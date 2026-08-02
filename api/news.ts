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
import {
  enforceRequestPolicy,
  getDefaultSecurityHeaders,
  isBlockedRequestDecision,
  withArticleContentTokens,
} from "./_lib/request-security.js";

type FeedCandidate = {
  label: string;
  provider?: "google-news" | "yahoo-news";
  sourceName: string;
  url: string;
};

type FeedOptions = {
  category: Category;
  language: LanguageCode;
  locationLabel: string;
  locationQuery: string;
  localEdition: LocalEdition;
  query: string;
  region: RegionCode;
};

type ImageCandidate = {
  height: number;
  priority: number;
  url: string;
  width: number;
};

type NormalizeImageOptions = {
  preservePulseTransform?: boolean;
};

const ARTICLE_IMAGE_CACHE_MS = 60 * 60 * 1000;
const ARTICLE_IMAGE_ENRICHMENT_LIMIT = 24;
const ARTICLE_IMAGE_TIMEOUT_MS = 3000;
const GOOGLE_NEWS_DECODE_CACHE_MS = 60 * 60 * 1000;
const GOOGLE_NEWS_PREVIEW_CACHE_MS = 60 * 60 * 1000;
const GOOGLE_NEWS_SEARCH_HTML_CACHE_MS = 30 * 60 * 1000;
const articleImageCache = new Map<string, { expiresAt: number; imageUrl: string }>();
const googleNewsUrlCache = new Map<string, { expiresAt: number; url: string }>();
const googleNewsPreviewImageCache = new Map<string, { expiresAt: number; imageUrl: string }>();
const googleNewsSearchHtmlCache = new Map<string, { expiresAt: number; html: string }>();

const CATEGORIES = new Set<Category>([
  "business",
  "general",
  "science",
  "sports",
  "technology",
]);
const LANGUAGES = new Set<LanguageCode>(["sk", "en", "cs", "de"]);
const LOCAL_EDITION_IDS = new Set<LocalEdition>([
  "all",
  "bratislava",
  "kosice",
  "presov",
  "rimavska-sobota",
  "vychod",
]);
const REGIONS = new Set<RegionCode>(["SK", "US", "GB", "CZ", "DE", "AT"]);

const LOCAL_EDITIONS: Record<
  Exclude<LocalEdition, "all">,
  Omit<LocalEditionSummary, "id"> & { query: string }
> = {
  bratislava: {
    badge: "Lokálna edícia",
    description: "Doprava, mesto, školy, nemocnice a lokálne dianie v Bratislave.",
    label: "Bratislava",
    query: "Bratislava magistrat doprava policia skoly nemocnica mesto",
  },
  kosice: {
    badge: "Lokálna edícia",
    description: "Mesto, bezpečnosť, verejný priestor a služby v Košiciach.",
    label: "Košice",
    query: "Kosice magistrat doprava policia skoly nemocnica mesto",
  },
  presov: {
    badge: "Lokálna edícia",
    description: "Prešovský výber pre dopravu, kraj, mesto a služby.",
    label: "Prešov",
    query: "Presov doprava policia kraj mesto skoly nemocnica",
  },
  "rimavska-sobota": {
    badge: "Lokálna edícia",
    description: "Mesto, okres, služby a dianie v Rimavskej Sobote.",
    label: "Rimavská Sobota",
    query: "Rimavska Sobota Gemer Malohont okres doprava policia mesto",
  },
  vychod: {
    badge: "Regionálny fokus",
    description: "Košice, Prešov a témy s dopadom na východ Slovenska.",
    label: "Východ",
    query: "Kosice Presov vychod Slovenska kraj doprava policia mesto",
  },
};

const GLOBAL_CATEGORY_FEEDS: Record<Exclude<Category, "general">, FeedCandidate[]> = {
  business: [
    { label: "bbc-business", sourceName: "BBC News", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
    { label: "bbc-news", sourceName: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  science: [
    { label: "bbc-science", sourceName: "BBC News", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" },
    { label: "bbc-technology", sourceName: "BBC News", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
    { label: "bbc-news", sourceName: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  sports: [
    { label: "bbc-sport", sourceName: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml" },
    { label: "bbc-news", sourceName: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  technology: [
    { label: "bbc-technology", sourceName: "BBC News", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
    { label: "bbc-science", sourceName: "BBC News", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" },
    { label: "bbc-news", sourceName: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
};

const SLOVAK_FEEDS: Record<Category, FeedCandidate[]> = {
  business: [
    { label: "aktuality-business", sourceName: "Aktuality.sk", url: "https://www.aktuality.sk/rss/ekonomika/" },
    { label: "pravda-business", sourceName: "Pravda", url: "https://www.pravda.sk/ekonomika/rss/xml" },
    {
      label: "sme-business",
      provider: "google-news",
      sourceName: "SME",
      url: buildGoogleNewsSearchUrl("site:sme.sk/c/ ekonomika", "sk", "SK"),
    },
    { label: "startitup-business", sourceName: "Startitup", url: "https://www.startitup.sk/feed/" },
  ],
  general: [
    { label: "aktuality-general", sourceName: "Aktuality.sk", url: "https://www.aktuality.sk/rss/" },
    { label: "pravda-general", sourceName: "Pravda", url: "https://www.pravda.sk/spravy/rss/xml" },
    { label: "pravda-regions", sourceName: "Pravda", url: "https://www.pravda.sk/spravy/regiony/rss/xml" },
    {
      label: "sme-general",
      provider: "google-news",
      sourceName: "SME",
      url: buildGoogleNewsSearchUrl("site:sme.sk/c/", "sk", "SK"),
    },
    { label: "startitup-general", sourceName: "Startitup", url: "https://www.startitup.sk/feed/" },
  ],
  science: [
    { label: "pravda-science", sourceName: "Pravda", url: "https://www.pravda.sk/vat/rss/xml" },
    {
      label: "sme-science",
      provider: "google-news",
      sourceName: "SME",
      url: buildGoogleNewsSearchUrl("site:sme.sk/c/ veda", "sk", "SK"),
    },
  ],
  sports: [
    { label: "sport-aktuality", sourceName: "Sport.sk", url: "https://sport.aktuality.sk/rss/" },
    { label: "pravda-sports", sourceName: "Pravda", url: "https://www.pravda.sk/sportweb/rss/xml" },
    {
      label: "sme-sports",
      provider: "google-news",
      sourceName: "SME",
      url: buildGoogleNewsSearchUrl("site:sme.sk/c/ sport", "sk", "SK"),
    },
  ],
  technology: [
    { label: "zive", sourceName: "Zive.sk", url: "https://zive.aktuality.sk/rss/najnovsie/" },
    {
      label: "sme-technology",
      provider: "google-news",
      sourceName: "SME",
      url: buildGoogleNewsSearchUrl("site:sme.sk/c/ technológie", "sk", "SK"),
    },
    { label: "pravda-technology", sourceName: "Pravda", url: "https://www.pravda.sk/vat/rss/xml" },
  ],
};

const CATEGORY_LABELS: Record<Category, string> = {
  business: "Biznis",
  general: "Hlavné správy",
  science: "Veda",
  sports: "Šport",
  technology: "Technológie",
};

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

  return buildJsonResponse(payload, { headers, status });
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

function normalizeCategory(value: string | null): Category {
  return CATEGORIES.has(value as Category) ? (value as Category) : "general";
}

function normalizeLanguage(value: string | null): LanguageCode {
  return LANGUAGES.has(value as LanguageCode) ? (value as LanguageCode) : "sk";
}

function normalizeLocalEdition(value: string | null): LocalEdition {
  return LOCAL_EDITION_IDS.has(value as LocalEdition) ? (value as LocalEdition) : "all";
}

function normalizeRegion(value: string | null): RegionCode {
  return REGIONS.has(value as RegionCode) ? (value as RegionCode) : "SK";
}

function clampText(value: string | null, maxLength: number) {
  return (value ?? "").trim().slice(0, maxLength);
}

function isSlovakEdition(language: LanguageCode, region: RegionCode) {
  return language === "sk" && region === "SK";
}

function buildGoogleNewsSearchUrl(query: string, language: LanguageCode, region: RegionCode) {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", language);
  url.searchParams.set("gl", region);
  url.searchParams.set("ceid", `${region}:${language}`);
  return url.toString();
}

function buildGoogleNewsSearchPageUrl(query: string, language: LanguageCode, region: RegionCode) {
  const url = new URL("https://news.google.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", language);
  url.searchParams.set("gl", region);
  url.searchParams.set("ceid", `${region}:${language}`);
  return url.toString();
}

function buildYahooNewsSearchUrl(query: string) {
  const url = new URL("https://news.yahoo.com/rss/search");
  url.searchParams.set("p", query);
  return url.toString();
}

function buildSearchCandidates(options: FeedOptions): FeedCandidate[] {
  return [
    {
      label: "google-news-search",
      provider: "google-news",
      sourceName: "Google News",
      url: buildGoogleNewsSearchUrl(options.query, options.language, options.region),
    },
    {
      label: "yahoo-news-search",
      provider: "yahoo-news",
      sourceName: "Yahoo News",
      url: buildYahooNewsSearchUrl(options.query),
    },
  ];
}

function dedupeCandidates(candidates: FeedCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

function buildCandidates(options: FeedOptions): FeedCandidate[] {
  if (options.query) {
    return buildSearchCandidates(options);
  }

  const slovakCandidates = isSlovakEdition(options.language, options.region)
    ? [
        ...(SLOVAK_FEEDS[options.category] ?? []),
        ...(options.category === "general"
          ? [SLOVAK_FEEDS.business[0], SLOVAK_FEEDS.technology[0], SLOVAK_FEEDS.sports[0]]
          : []),
      ]
    : [];

  const globalCandidates = options.category === "general"
    ? []
    : GLOBAL_CATEGORY_FEEDS[options.category];

  return dedupeCandidates([
    ...slovakCandidates,
    ...globalCandidates,
  ]);
}

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function firstMatch(value: string, pattern: RegExp) {
  return decodeHtml(value.match(pattern)?.[1] ?? "");
}

function extractAttribute(tag: string, name: string) {
  return decodeHtml(tag.match(new RegExp(`${name}=["']([^"']+)["']`, "i"))?.[1] ?? "");
}

function extractItemSourceName(item: string, title: string, candidate: FeedCandidate) {
  const sourceName = firstMatch(item, /<source\b[^>]*>([\s\S]*?)<\/source>/i);
  if (sourceName) {
    return sourceName;
  }

  if (candidate.provider) {
    const titleSource = title.match(/\s+-\s+([^-]+)$/)?.[1]?.trim();
    if (titleSource) {
      return titleSource;
    }
  }

  return candidate.sourceName;
}

function cleanItemTitle(title: string, sourceName: string) {
  const suffix = ` - ${sourceName}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}

function extractPulseCmsImage(value: string) {
  try {
    const parsedUrl = new URL(value);
    const assetId = parsedUrl.pathname.split("/").filter(Boolean).pop() ?? "";

    if (
      assetId.length >= 20 &&
      /^[A-Za-z0-9_.-]+$/.test(assetId) &&
      (parsedUrl.hostname.includes("img.aktuality.sk") ||
        parsedUrl.hostname.includes("zive.aktuality.sk") ||
        parsedUrl.hostname.includes("ocdn.eu"))
    ) {
      return `https://ocdn.eu/pulscms-transforms/1/${assetId}`;
    }
  } catch {
    return "";
  }

  return "";
}

function normalizeImageUrl(value: string, baseUrl = "", options: NormalizeImageOptions = {}) {
  let imageUrl = decodeHtml(value);
  if (!imageUrl) return "";

  try {
    imageUrl = new URL(imageUrl, baseUrl).toString();
  } catch {
    return "";
  }

  if (imageUrl.startsWith("http://")) imageUrl = imageUrl.replace("http://", "https://");

  if (!options.preservePulseTransform) {
    const pulseCmsImage = extractPulseCmsImage(imageUrl);
    if (pulseCmsImage) {
      imageUrl = pulseCmsImage;
    }
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

  const lowerImageUrl = imageUrl.toLowerCase();
  if (
    lowerImageUrl.includes("favicon") ||
    lowerImageUrl.includes("/logo-fixed") ||
    lowerImageUrl.includes("/mobile-logo") ||
    lowerImageUrl.includes("/logo/") ||
    lowerImageUrl.includes("logo") ||
    lowerImageUrl.includes("sprite") ||
    lowerImageUrl.includes("tracking") ||
    lowerImageUrl.includes("pixel") ||
    lowerImageUrl.includes("placeholder") ||
    lowerImageUrl.includes("gstatic.com")
  ) {
    return "";
  }

  return imageUrl;
}

function extractImageDimensionHints(imageUrl: string) {
  try {
    const parsedUrl = new URL(imageUrl);
    const queryWidth = Number(
      parsedUrl.searchParams.get("w") ||
        parsedUrl.searchParams.get("width") ||
        parsedUrl.searchParams.get("maxwidth") ||
        0
    );
    const queryHeight = Number(
      parsedUrl.searchParams.get("h") ||
        parsedUrl.searchParams.get("height") ||
        parsedUrl.searchParams.get("maxheight") ||
        0
    );

    if (queryWidth > 0 || queryHeight > 0) {
      return {
        width: queryWidth,
        height: queryHeight,
      };
    }

    const resizeHint =
      parsedUrl.searchParams.get("resize") ||
      parsedUrl.searchParams.get("fit") ||
      parsedUrl.searchParams.get("crop");
    const resizeMatch = resizeHint?.match(/(\d{2,4})[x,](\d{2,4})/i);
    if (resizeMatch) {
      return {
        width: Number(resizeMatch[1]),
        height: Number(resizeMatch[2]),
      };
    }

    const pathMatch = parsedUrl.pathname.match(/[-_/](\d{2,4})x(\d{2,4})(?=[-_/\.]|$)/i);
    if (pathMatch) {
      return {
        width: Number(pathMatch[1]),
        height: Number(pathMatch[2]),
      };
    }
  } catch {
    return null;
  }

  return null;
}

function shouldEnhanceArticleImage(articleUrl: string, imageUrl: string) {
  if (!imageUrl) {
    return true;
  }

  const lowerImageUrl = imageUrl.toLowerCase();
  if (
    lowerImageUrl.includes("blank.png") ||
    lowerImageUrl.includes("/thumb") ||
    lowerImageUrl.includes("/thumbnail") ||
    lowerImageUrl.includes("/preview") ||
    lowerImageUrl.includes("/small")
  ) {
    return true;
  }

  const imageDimensions = extractImageDimensionHints(imageUrl);
  if (imageDimensions && (imageDimensions.width < 640 || imageDimensions.height < 360)) {
    return true;
  }

  try {
    const articleHost = new URL(articleUrl).hostname.toLowerCase();
    if (
      (articleHost === "www.aktuality.sk" || articleHost.endsWith(".aktuality.sk")) &&
      imageDimensions &&
      (imageDimensions.width < 720 || imageDimensions.height < 400)
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function extractBestSrcsetUrl(rawSrcset: string) {
  const candidates = rawSrcset
    .split(",")
    .map((part) => {
      const [url, descriptor] = part.trim().split(/\s+/, 2);
      const width = Number(descriptor?.replace("w", "")) || 0;
      return { url, width };
    })
    .filter((candidate) => Boolean(candidate.url));

  candidates.sort((left, right) => right.width - left.width);
  return candidates[0]?.url ?? "";
}

function extractArticleImageCandidates(html: string) {
  const candidates: string[] = [];
  const metaNames = new Set(["og:image", "og:image:secure_url", "twitter:image", "image"]);

  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (
      extractAttribute(tag, "property") ||
      extractAttribute(tag, "name") ||
      extractAttribute(tag, "itemprop")
    ).toLowerCase();

    if (metaNames.has(key)) {
      candidates.push(extractAttribute(tag, "content"));
    }
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (extractAttribute(tag, "rel").toLowerCase() === "image_src") {
      candidates.push(extractAttribute(tag, "href"));
    }
  }

  for (const tag of html.match(/<source\b[^>]*>/gi) ?? []) {
    candidates.push(
      extractBestSrcsetUrl(extractAttribute(tag, "srcset") || extractAttribute(tag, "data-srcset"))
    );
  }

  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    candidates.push(
      extractAttribute(tag, "data-src") ||
        extractAttribute(tag, "data-lazy-src") ||
        extractBestSrcsetUrl(extractAttribute(tag, "srcset")) ||
        extractAttribute(tag, "src")
    );
  }

  return candidates.filter(Boolean);
}

async function extractPrimaryArticleImage(articleUrl: string) {
  const now = Date.now();
  const cached = articleImageCache.get(articleUrl);
  if (cached && cached.expiresAt > now) {
    return cached.imageUrl;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARTICLE_IMAGE_TIMEOUT_MS);

  try {
    const response = await fetch(articleUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "sk-SK,sk;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 BakyNews/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Article image failed with ${response.status}`);
    }

    const html = await response.text();
    for (const candidate of extractArticleImageCandidates(html)) {
      const normalized = normalizeImageUrl(candidate, articleUrl, { preservePulseTransform: true });
      if (normalized) {
        articleImageCache.set(articleUrl, {
          expiresAt: now + ARTICLE_IMAGE_CACHE_MS,
          imageUrl: normalized,
        });
        return normalized;
      }
    }
  } catch (error) {
    console.warn(`Article image enrichment failed (${articleUrl})`, error);
  } finally {
    clearTimeout(timeout);
  }

  articleImageCache.set(articleUrl, {
    expiresAt: now + 10 * 60 * 1000,
    imageUrl: "",
  });
  return "";
}

function isGoogleNewsArticleUrl(value: string) {
  try {
    const url = new URL(value);
    const pathParts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "news.google.com" && pathParts[pathParts.length - 2] === "articles";
  } catch {
    return false;
  }
}

function readGoogleNewsDecodeParams(html: string) {
  const tag = html.match(/<div\b[^>]*data-n-a-id=["'][^"']+["'][^>]*>/i)?.[0] ?? "";
  const id = extractAttribute(tag, "data-n-a-id");
  const timestamp = Number(extractAttribute(tag, "data-n-a-ts"));
  const signature = extractAttribute(tag, "data-n-a-sg");

  if (!id || !timestamp || !signature) {
    return null;
  }

  return { id, signature, timestamp };
}

function extractDecodedGoogleNewsUrl(responseText: string) {
  const marker = '[\\"garturlres\\",\\"';
  const startIndex = responseText.indexOf(marker);
  if (startIndex === -1) {
    return "";
  }

  const start = responseText.slice(startIndex + marker.length);
  const endIndex = start.indexOf('\\",');
  if (endIndex === -1) {
    return "";
  }

  try {
    return JSON.parse(`"${start.slice(0, endIndex)}"`) as string;
  } catch {
    return start.slice(0, endIndex).replace(/\\\//g, "/");
  }
}

function extractGoogleNewsPreviewImageUrl(html: string) {
  const previewImage =
    extractAttribute(
      html.match(/<meta\b[^>]*property=["']og:image["'][^>]*>/i)?.[0] ?? "",
      "content"
    ) ||
    extractAttribute(
      html.match(/<meta\b[^>]*name=["']twitter:image["'][^>]*>/i)?.[0] ?? "",
      "content"
    );

  if (!previewImage) {
    return "";
  }

  return previewImage.replace(/=s0-w\d+(?:-h\d+)?/i, "=s0-w1200");
}

function extractSearchHtmlImageCandidate(windowHtml: string) {
  const candidates = [
    /https:\/\/image\.smedata\.sk\/image\/w\d+-h\d+\/[^"'\s>]+/i,
    /https:\/\/m\.smedata\.sk\/api-media\/media\/image\/[^"'\s>]+/i,
    /https:\/\/image\.smedata\.sk\/[^"'\s>]+/i,
    /https:\/\/m\.smedata\.sk\/[^"'\s>]+/i,
  ];

  for (const pattern of candidates) {
    const match = windowHtml.match(pattern)?.[0] ?? "";
    if (match) {
      return decodeHtml(match)
        .replace(/\\u003d/g, "=")
        .replace(/\\u0026/g, "&")
        .replace(/\\u002f/g, "/");
    }
  }

  return "";
}

async function fetchGoogleNewsSearchPageHtml(query: string, language: LanguageCode, region: RegionCode) {
  const searchUrl = buildGoogleNewsSearchPageUrl(query, language, region);
  const now = Date.now();
  const cached = googleNewsSearchHtmlCache.get(searchUrl);
  if (cached && cached.expiresAt > now) {
    return cached.html;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARTICLE_IMAGE_TIMEOUT_MS);

  try {
    const response = await fetch(searchUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "sk-SK,sk;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 BakyNews/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Google News search page failed with ${response.status}`);
    }

    const html = await response.text();
    googleNewsSearchHtmlCache.set(searchUrl, {
      expiresAt: now + GOOGLE_NEWS_SEARCH_HTML_CACHE_MS,
      html,
    });
    return html;
  } catch (error) {
    console.warn(`Google News search page fetch failed (${searchUrl})`, error);
    googleNewsSearchHtmlCache.set(searchUrl, {
      expiresAt: now + 5 * 60 * 1000,
      html: "",
    });
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function extractGoogleNewsSearchPreviewImage(
  articleUrl: string,
  query = "site:sme.sk/c/"
) {
  const searchHtml = await fetchGoogleNewsSearchPageHtml(query, "sk", "SK");
  if (!searchHtml) {
    return "";
  }

  const normalizedUrl = articleUrl.replace(/&amp;/g, "&");
  const articleIndex = searchHtml.indexOf(normalizedUrl);
  const windowHtml =
    articleIndex >= 0
      ? searchHtml.slice(Math.max(0, articleIndex - 6000), articleIndex + 4000)
      : searchHtml;
  const imageUrl = extractSearchHtmlImageCandidate(windowHtml);
  if (imageUrl) {
    return imageUrl;
  }

  return "";
}

async function extractGoogleNewsPreviewImage(articleUrl: string) {
  const now = Date.now();
  const cached = googleNewsPreviewImageCache.get(articleUrl);
  if (cached && cached.expiresAt > now) {
    return cached.imageUrl;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARTICLE_IMAGE_TIMEOUT_MS);

  try {
    const pageResponse = await fetch(articleUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "sk-SK,sk;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 BakyNews/1.0",
      },
      signal: controller.signal,
    });

    if (!pageResponse.ok) {
      throw new Error(`Google News preview page failed with ${pageResponse.status}`);
    }

    const imageUrl = extractGoogleNewsPreviewImageUrl(await pageResponse.text());
    googleNewsPreviewImageCache.set(articleUrl, {
      expiresAt: now + GOOGLE_NEWS_PREVIEW_CACHE_MS,
      imageUrl,
    });
    return imageUrl;
  } catch (error) {
    console.warn(`Google News preview image failed (${articleUrl})`, error);
    googleNewsPreviewImageCache.set(articleUrl, {
      expiresAt: now + 10 * 60 * 1000,
      imageUrl: "",
    });
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function decodeGoogleNewsArticleUrl(articleUrl: string) {
  if (!isGoogleNewsArticleUrl(articleUrl)) {
    return articleUrl;
  }

  const now = Date.now();
  const cached = googleNewsUrlCache.get(articleUrl);
  if (cached && cached.expiresAt > now) {
    return cached.url || articleUrl;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARTICLE_IMAGE_TIMEOUT_MS);

  try {
    const pageResponse = await fetch(articleUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "sk-SK,sk;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 BakyNews/1.0",
      },
      signal: controller.signal,
    });

    if (!pageResponse.ok) {
      throw new Error(`Google News page failed with ${pageResponse.status}`);
    }

    const params = readGoogleNewsDecodeParams(await pageResponse.text());
    if (!params) {
      throw new Error("Google News decode params missing");
    }

    const requestPayload = [
      "garturlreq",
      [["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
      params.id,
      params.timestamp,
      params.signature,
    ];
    const batchPayload = [[["Fbv4je", JSON.stringify(requestPayload), null]]];
    const decodeResponse = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      body: new URLSearchParams({ "f.req": JSON.stringify(batchPayload) }).toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "Mozilla/5.0 BakyNews/1.0",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!decodeResponse.ok) {
      throw new Error(`Google News decode failed with ${decodeResponse.status}`);
    }

    const decodedUrl = extractDecodedGoogleNewsUrl(await decodeResponse.text());
    if (!decodedUrl) {
      throw new Error("Google News decoded URL missing");
    }

    googleNewsUrlCache.set(articleUrl, {
      expiresAt: now + GOOGLE_NEWS_DECODE_CACHE_MS,
      url: decodedUrl,
    });
    return decodedUrl;
  } catch (error) {
    console.warn(`Google News URL decode failed (${articleUrl})`, error);
    googleNewsUrlCache.set(articleUrl, {
      expiresAt: now + 10 * 60 * 1000,
      url: "",
    });
    return articleUrl;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveArticleUrl(articleUrl: string, provider?: FeedCandidate["provider"]) {
  if (provider === "google-news") {
    return decodeGoogleNewsArticleUrl(articleUrl);
  }

  return articleUrl;
}

async function enrichArticleImages(
  articles: NewsArticle[],
  provider?: FeedCandidate["provider"]
) {
  const result = [...articles];
  const priorityArticles = articles
    .map((article, index) => ({ article, index }))
    .filter(
      ({ article }) =>
        article.feedProvider === "google-news" ||
        provider === "google-news" ||
        !article.urlToImage ||
        shouldEnhanceArticleImage(article.url, article.urlToImage)
    )
    .slice(0, ARTICLE_IMAGE_ENRICHMENT_LIMIT);

  await Promise.all(
    priorityArticles.map(async ({ article, index }) => {
      const articleProvider = article.feedProvider ?? provider;
      const resolvedUrl = await resolveArticleUrl(article.url, articleProvider);
      const isSmeProxyArticle = (() => {
        if (articleProvider !== "google-news") {
          return false;
        }

        try {
          return new URL(resolvedUrl).hostname.toLowerCase().endsWith("sme.sk");
        } catch {
          return false;
        }
      })();

      let articleImage = "";
      if (isSmeProxyArticle) {
        articleImage = await extractGoogleNewsSearchPreviewImage(resolvedUrl);
      } else if (!article.urlToImage || shouldEnhanceArticleImage(resolvedUrl, article.urlToImage)) {
        articleImage = await extractPrimaryArticleImage(resolvedUrl);
      }

      result[index] =
        resolvedUrl === article.url && (!articleImage || articleImage === article.urlToImage)
          ? article
          : {
              ...article,
              url: resolvedUrl,
              urlToImage: articleImage || article.urlToImage,
            };
    })
  );

  return result;
}

function addImageCandidate(
  candidates: ImageCandidate[],
  rawUrl: string,
  baseUrl: string,
  priority: number,
  width = 0,
  height = 0
) {
  const normalized = normalizeImageUrl(rawUrl, baseUrl);
  if (!normalized) {
    return;
  }

  candidates.push({
    height,
    priority,
    url: normalized,
    width,
  });
}

function extractImageFromItem(item: string, baseUrl: string) {
  const candidates: ImageCandidate[] = [];

  for (const tag of item.match(/<media:content\b[^>]*>/gi) ?? []) {
    addImageCandidate(
      candidates,
      extractAttribute(tag, "url"),
      baseUrl,
      40,
      Number(extractAttribute(tag, "width")) || 0,
      Number(extractAttribute(tag, "height")) || 0
    );
  }

  for (const tag of item.match(/<enclosure\b[^>]*>/gi) ?? []) {
    addImageCandidate(candidates, extractAttribute(tag, "url"), baseUrl, 35);
  }

  for (const tag of item.match(/<media:thumbnail\b[^>]*>/gi) ?? []) {
    addImageCandidate(
      candidates,
      extractAttribute(tag, "url"),
      baseUrl,
      20,
      Number(extractAttribute(tag, "width")) || 0,
      Number(extractAttribute(tag, "height")) || 0
    );
  }

  for (const tag of item.match(/<source\b[^>]*>/gi) ?? []) {
    addImageCandidate(
      candidates,
      extractBestSrcsetUrl(extractAttribute(tag, "srcset") || extractAttribute(tag, "data-srcset")),
      baseUrl,
      30
    );
  }

  for (const tag of item.match(/<img\b[^>]*>/gi) ?? []) {
    addImageCandidate(
      candidates,
      extractAttribute(tag, "data-src") ||
        extractAttribute(tag, "data-lazy-src") ||
        extractBestSrcsetUrl(extractAttribute(tag, "srcset")) ||
        extractAttribute(tag, "src"),
      baseUrl,
      10,
      Number(extractAttribute(tag, "width")) || 0,
      Number(extractAttribute(tag, "height")) || 0
    );
  }

  candidates.sort((left, right) => {
    const leftArea = left.width * left.height;
    const rightArea = right.width * right.height;
    return rightArea + right.priority * 1_000_000 - (leftArea + left.priority * 1_000_000);
  });

  return candidates[0]?.url ?? "";
}

function parseItems(xml: string, candidate: FeedCandidate): NewsArticle[] {
  const items = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).map((match) => match[0]);

  return items
    .map((item) => {
      const title = firstMatch(item, /<title[^>]*>([\s\S]*?)<\/title>/i).trim();
      const link = firstMatch(item, /<link[^>]*>([\s\S]*?)<\/link>/i);
      const pubDate = firstMatch(item, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
      const descriptionMarkup = firstMatch(item, /<description[^>]*>([\s\S]*?)<\/description>/i);

      if (!title || !link) {
        return null;
      }

      const sourceName = extractItemSourceName(item, title, candidate);
      const description = stripTags(descriptionMarkup);
      return {
        title: cleanItemTitle(title, sourceName),
        description:
          description.length > 8
            ? `${description.slice(0, 240)}${description.length > 240 ? "..." : ""}`
            : "Kliknite pre zobrazenie celeho clanku a podrobnosti.",
        feedProvider: candidate.provider,
        publishedAt: pubDate || new Date().toUTCString(),
        source: {
          name: sourceName,
        },
        url: link,
        urlToImage: extractImageFromItem(item, link || candidate.url),
      } satisfies NewsArticle;
    })
    .filter(Boolean) as NewsArticle[];
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchTokens(query: string) {
  return normalizeText(query)
    .split(" ")
    .filter((token) => token.length > 1);
}

function articleMatchesQuery(article: NewsArticle, tokens: string[]) {
  if (!tokens.length) {
    return true;
  }

  const haystack = normalizeText(`${article.title} ${article.description} ${article.source.name}`);
  return tokens.every((token) => haystack.includes(token));
}

function filterArticlesByQuery(articles: NewsArticle[], query: string) {
  const tokens = getSearchTokens(query);
  if (!query.trim()) {
    return articles;
  }

  if (!tokens.length) {
    return [];
  }

  return articles.filter((article) => articleMatchesQuery(article, tokens));
}

function filterWeatherOnlyArticles(articles: NewsArticle[]) {
  return articles.filter((article) => {
    const source = normalizeText(article.source.name);
    const title = normalizeText(article.title);
    return !(
      source.includes("accuweather") ||
      source.includes("weather") ||
      title.includes("pocasie") ||
      title.includes("predpoved pocasia") ||
      title.includes("minutecast")
    );
  });
}

function isSmeNewsUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    const host = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();
    return (
      (host === "www.sme.sk" || host === "korzar.sme.sk") &&
      pathname.includes("/c/")
    );
  } catch {
    return false;
  }
}

function filterSmeProxyArticles(articles: NewsArticle[]) {
  return articles.filter((article) => {
    if (article.feedProvider !== "google-news") {
      return true;
    }

    if (!normalizeText(article.source.name).includes("sme")) {
      return true;
    }

    return isSmeNewsUrl(article.url);
  });
}

function dedupeArticles(articles: NewsArticle[]) {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  return articles.filter((article) => {
    let urlKey = article.url.toLowerCase();
    try {
      const parsed = new URL(article.url);
      urlKey = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
    } catch {
      urlKey = article.url.toLowerCase();
    }

    const titleKey = normalizeText(article.title);
    if (seenUrls.has(urlKey) || (titleKey.length > 24 && seenTitles.has(titleKey))) {
      return false;
    }

    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    return true;
  });
}

function rankArticles(
  articles: NewsArticle[],
  localEdition: LocalEdition,
  query: string,
  locationQuery = ""
) {
  const localQuery =
    query ||
    locationQuery ||
    (localEdition !== "all" ? LOCAL_EDITIONS[localEdition]?.query ?? "" : "");
  const tokens = getSearchTokens(localQuery);

  if (!tokens.length) {
    return articles;
  }

  return [...articles].sort((left, right) => scoreArticle(right, tokens) - scoreArticle(left, tokens));
}

function scoreArticle(article: NewsArticle, tokens: string[]) {
  const haystack = normalizeText(`${article.title} ${article.description} ${article.source.name}`);
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

function prioritizeArticlesWithImages(articles: NewsArticle[]) {
  return [...articles].sort((left, right) => Number(Boolean(right.urlToImage)) - Number(Boolean(left.urlToImage)));
}

function sortArticlesNewestFirst(articles: NewsArticle[]) {
  return [...articles].sort((left, right) => {
    const leftTime = Date.parse(left.publishedAt) || 0;
    const rightTime = Date.parse(right.publishedAt) || 0;
    return rightTime - leftTime;
  });
}

function balanceArticlesBySource(articles: NewsArticle[], limit: number) {
  const groups = new Map<string, NewsArticle[]>();

  for (const article of articles) {
    const sourceKey = normalizeText(article.source.name) || "neznamy-zdroj";
    const group = groups.get(sourceKey) ?? [];
    group.push(article);
    groups.set(sourceKey, group);
  }

  const balanced: NewsArticle[] = [];
  let round = 0;
  let addedInRound = true;

  while (balanced.length < limit && addedInRound) {
    addedInRound = false;

    for (const group of groups.values()) {
      const article = group[round];
      if (!article) {
        continue;
      }

      balanced.push(article);
      addedInRound = true;
      if (balanced.length === limit) {
        break;
      }
    }

    round += 1;
  }

  return balanced;
}

function prioritizeSourceArticle(
  articles: NewsArticle[],
  sourceName: string,
  fallbackMatches: string[] = []
) {
  const normalizedTarget = normalizeText(sourceName);
  const normalizedFallbackMatches = fallbackMatches.map((value) => normalizeText(value));

  const preferredIndex = articles.findIndex((article) => {
    const normalizedSource = normalizeText(article.source.name);
    return (
      normalizedSource === normalizedTarget ||
      normalizedFallbackMatches.some((fallback) => fallback && normalizedSource === fallback)
    );
  });

  if (preferredIndex <= 0) {
    return articles;
  }

  const prioritized = [...articles];
  const [preferredArticle] = prioritized.splice(preferredIndex, 1);
  return [preferredArticle, ...prioritized];
}

async function fetchCandidate(candidate: FeedCandidate) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(candidate.url, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": "Mozilla/5.0 BakyNews/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Feed failed with ${response.status}`);
    }

    return parseItems(await response.text(), candidate);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSearchArticles(candidates: FeedCandidate[], query: string) {
  for (const candidate of candidates) {
    try {
      const articles = filterArticlesByQuery(dedupeArticles(await fetchCandidate(candidate)), query);
      if (articles.length) {
        const rankedArticles = rankArticles(articles, "all", query).slice(0, 36);
        const enrichedArticles = await enrichArticleImages(rankedArticles, candidate.provider);
        const imageFirstArticles = prioritizeArticlesWithImages(enrichedArticles);
        if (candidate.provider === "google-news" && !imageFirstArticles.slice(0, ARTICLE_IMAGE_ENRICHMENT_LIMIT).some((article) => article.urlToImage)) {
          continue;
        }

        return {
          articles: imageFirstArticles,
          sourceMode: candidate.provider ?? "search-rss",
        };
      }
    } catch (error) {
      console.warn(`Search candidate failed (${candidate.label})`, error);
    }
  }

  return {
    articles: [],
    sourceMode: "search-empty",
  };
}

async function fetchArticles(
  candidates: FeedCandidate[],
  query: string,
  localEdition: LocalEdition,
  category: Category,
  locationQuery: string,
  locationSearchCandidates: FeedCandidate[] = [],
  locationSearchQuery = locationQuery
) {
  if (query) {
    const searchResult = await fetchSearchArticles(candidates, query);
    return {
      articles: searchResult.articles,
      sourceMode: searchResult.sourceMode,
    };
  }

  const fetchedArticles: NewsArticle[] = [];
  let sourceMode = "rss";
  let locationArticles: NewsArticle[] = [];

  if (locationQuery && locationSearchCandidates.length) {
    const locationResult = await fetchSearchArticles(locationSearchCandidates, locationSearchQuery);
    locationArticles = filterWeatherOnlyArticles(locationResult.articles).slice(0, 12);
    if (locationArticles.length) {
      sourceMode = `location-${locationResult.sourceMode}`;
    }
  }

  const candidateResults = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        return {
          articles: await fetchCandidate(candidate),
          candidate,
        };
      } catch (error) {
        console.warn(`Feed candidate failed (${candidate.label})`, error);
        return null;
      }
    })
  );

  for (const result of candidateResults) {
    if (!result) {
      continue;
    }

    fetchedArticles.push(...result.articles);
  }

  if (
    sourceMode === "rss" &&
    candidateResults.some((result) => result && !result.candidate.label.startsWith("bbc"))
  ) {
    sourceMode = "mixed-slovak-rss";
  }

  const filtered = filterArticlesByQuery(dedupeArticles(fetchedArticles), query);
  const ranked = rankArticles(
    sortArticlesNewestFirst(filtered),
    localEdition,
    query,
    locationQuery
  );
  const merged = balanceArticlesBySource(
    dedupeArticles([...locationArticles, ...ranked]),
    36
  );
  const articles = !query ? await enrichArticleImages(merged) : merged;
  const normalizedArticles = !query ? filterSmeProxyArticles(articles) : articles;
  const prioritizedArticles =
    !query && category === "general"
      ? prioritizeSourceArticle(normalizedArticles, "Aktuality.sk", ["Aktuality", "Aktuality.sk"])
      : normalizedArticles;
  return {
    articles: prioritizedArticles,
    sourceMode,
  };
}

function buildLocalEditionSummary(
  language: LanguageCode,
  region: RegionCode,
  localEdition: LocalEdition,
  locationLabel: string
): LocalEditionSummary | null {
  if (locationLabel) {
    return {
      badge: "Poloha",
      description: "Spravy, pocasie a lokalny kontext su prisposobene povolenej polohe.",
      id: "all",
      label: locationLabel,
    };
  }

  if (!isSlovakEdition(language, region) || localEdition === "all") {
    return null;
  }

  const local = LOCAL_EDITIONS[localEdition];
  if (!local) {
    return null;
  }

  return {
    badge: local.badge,
    description: local.description,
    id: localEdition,
    label: local.label,
  };
}

function buildEditorial(
  articles: NewsArticle[],
  category: Category,
  query: string,
  localEdition: LocalEditionSummary | null
): EditorialBriefing | null {
  if (!articles.length) {
    return null;
  }

  const headline = query
    ? `Tema "${query}" napriec zdrojmi`
    : localEdition
    ? `${localEdition.label}: lokalny vyber sprav`
    : `${CATEGORY_LABELS[category]} v jednom prehlade`;

  return {
    headline,
    kicker: "Aktualny briefing",
    summary: articles
      .slice(0, 3)
      .map((article) => article.description)
      .join(" ")
      .slice(0, 280),
    topTopics: [],
    watchlist: articles.slice(0, 3).map((article) => article.title),
    whyItMatters: localEdition
      ? "Feed uprednostnuje clanky, ktore sa najlepsie zhoduju s lokalnou ediciou, a doplna ich slovenskym hlavnym mixom."
      : category === "general"
      ? "Hlavny feed uprednostnuje slovenske spravodajske zdroje."
      : "Tematicky feed kombinuje slovenske zdroje s povodnym globalnym kontextom.",
  };
}

export default async function handler(request: any, response?: any) {
  try {
    const searchParams = readSearchParams(request);
    const category = normalizeCategory(searchParams.get("category"));
    const rawQuery = (searchParams.get("q") ?? "").trim();
    const decision = enforceRequestPolicy(request, "news", { query: rawQuery });
    if (isBlockedRequestDecision(decision)) {
      return sendJson(response, decision.payload, decision.status, decision.headers);
    }

    const query = rawQuery.slice(0, 120);
    const language = normalizeLanguage(searchParams.get("lang"));
    const region = normalizeRegion(searchParams.get("region"));
    const localEdition = normalizeLocalEdition(searchParams.get("localEdition"));
    const locationLabel = clampText(searchParams.get("locationLabel"), 100);
    const locationQuery = clampText(searchParams.get("locationQuery"), 140);
    const refresh = searchParams.get("refresh") === "true";
    const localEditionSummary = buildLocalEditionSummary(language, region, localEdition, locationLabel);
    const locationSearchQuery = `${locationLabel || locationQuery} spravy`.trim();
    const options = {
      category,
      language,
      locationLabel,
      locationQuery,
      localEdition,
      query,
      region,
    };

    const result = await fetchArticles(
      buildCandidates(options),
      query,
      localEdition,
      category,
      locationQuery,
      locationQuery && !query
        ? buildSearchCandidates({ ...options, query: locationSearchQuery })
        : [],
      locationSearchQuery
    );

    const feed = {
      articles: withArticleContentTokens(result.articles),
      editorial: buildEditorial(result.articles, category, query, localEditionSummary),
      localEdition: localEditionSummary,
    } satisfies NewsFeedResponse;

    return sendJson(response, feed, 200, {
      ...decision.headers,
      "Cache-Control": refresh || category === "general"
        ? "no-store"
        : "public, max-age=60, s-maxage=180, stale-while-revalidate=600",
      "X-Baky-Cache-State": "standalone",
      "X-Baky-Feed-Updated-At": new Date().toISOString(),
      "X-Baky-Source-Mode": result.sourceMode,
    });
  } catch (error) {
    console.error("News handler failed:", error);

    const emptyFeed = {
      articles: [],
      editorial: null,
      localEdition: null,
    } satisfies NewsFeedResponse;

    return sendJson(response, emptyFeed, 200, {
      ...getDefaultSecurityHeaders(),
      "Cache-Control": "no-store",
      "X-Baky-Cache-State": "error-empty",
      "X-Baky-Feed-Updated-At": new Date().toISOString(),
      "X-Baky-Source-Mode": "error-empty",
    });
  }
}
