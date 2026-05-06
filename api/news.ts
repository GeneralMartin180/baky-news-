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

type FeedCandidate = {
  label: string;
  sourceName: string;
  url: string;
};

type FeedOptions = {
  category: Category;
  language: LanguageCode;
  localEdition: LocalEdition;
  query: string;
  region: RegionCode;
};

const CATEGORIES = new Set<Category>([
  "business",
  "entertainment",
  "general",
  "health",
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
    badge: "Lokalna edicia",
    description: "Doprava, mesto, skoly, nemocnice a lokalne dianie v Bratislave.",
    label: "Bratislava",
    query: "Bratislava magistrat doprava policia skoly nemocnica mesto",
  },
  kosice: {
    badge: "Lokalna edicia",
    description: "Mesto, bezpecnost, verejny priestor a sluzby v Kosiciach.",
    label: "Kosice",
    query: "Kosice magistrat doprava policia skoly nemocnica mesto",
  },
  presov: {
    badge: "Lokalna edicia",
    description: "Presovsky vyber pre dopravu, kraj, mesto a sluzby.",
    label: "Presov",
    query: "Presov doprava policia kraj mesto skoly nemocnica",
  },
  "rimavska-sobota": {
    badge: "Lokalna edicia",
    description: "Mesto, okres, sluzby a dianie v Rimavskej Sobote.",
    label: "Rimavska Sobota",
    query: "Rimavska Sobota Gemer Malohont okres doprava policia mesto",
  },
  vychod: {
    badge: "Regionalny fokus",
    description: "Kosice, Presov a temy s dopadom na vychod Slovenska.",
    label: "Vychod",
    query: "Kosice Presov vychod Slovenska kraj doprava policia mesto",
  },
};

const BBC_FEEDS: Record<Category, FeedCandidate[]> = {
  business: [
    { label: "bbc-business", sourceName: "BBC News", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
    { label: "bbc-news", sourceName: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  entertainment: [
    { label: "bbc-entertainment", sourceName: "BBC News", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml" },
    { label: "bbc-news", sourceName: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  general: [
    { label: "bbc-news", sourceName: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
    { label: "bbc-world", sourceName: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  ],
  health: [
    { label: "bbc-health", sourceName: "BBC News", url: "https://feeds.bbci.co.uk/news/health/rss.xml" },
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
  ],
  entertainment: [
    { label: "aktuality-koktejl", sourceName: "Aktuality.sk", url: "https://www.aktuality.sk/rss/koktejl/" },
  ],
  general: [
    { label: "aktuality-general", sourceName: "Aktuality.sk", url: "https://www.aktuality.sk/rss/" },
  ],
  health: [
    { label: "aktuality-health", sourceName: "Aktuality.sk", url: "https://www.aktuality.sk/zdravie/" },
  ],
  science: [
    { label: "aktuality-science", sourceName: "Aktuality.sk", url: "https://www.aktuality.sk/spravy/veda/23/" },
  ],
  sports: [
    { label: "sport-aktuality", sourceName: "Sport.sk", url: "https://sport.aktuality.sk/rss/" },
  ],
  technology: [
    { label: "zive", sourceName: "Zive.sk", url: "https://zive.aktuality.sk/rss/najnovsie/" },
  ],
};

const CATEGORY_LABELS: Record<Category, string> = {
  business: "Biznis",
  entertainment: "Zabava",
  general: "Hlavne spravy",
  health: "Zdravie",
  science: "Veda",
  sports: "Sport",
  technology: "Technologie",
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

function isSlovakEdition(language: LanguageCode, region: RegionCode) {
  return language === "sk" && region === "SK";
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
  const slovakCandidates = isSlovakEdition(options.language, options.region)
    ? [
        ...(SLOVAK_FEEDS[options.category] ?? []),
        ...(options.category === "general" ? [SLOVAK_FEEDS.business[0], SLOVAK_FEEDS.technology[0], SLOVAK_FEEDS.sports[0]] : []),
      ]
    : [];

  return dedupeCandidates([
    ...slovakCandidates,
    ...(BBC_FEEDS[options.category] ?? BBC_FEEDS.general),
    ...BBC_FEEDS.general,
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

function normalizeImageUrl(value: string, baseUrl = "") {
  let imageUrl = decodeHtml(value);
  if (!imageUrl) return "";

  try {
    imageUrl = new URL(imageUrl, baseUrl).toString();
  } catch {
    return "";
  }

  if (imageUrl.startsWith("http://")) imageUrl = imageUrl.replace("http://", "https://");
  if (imageUrl.includes("ichef.bbci.co.uk")) {
    imageUrl = imageUrl.replace(/\/ace\/standard\/\d+\//, "/ace/standard/1024/");
  }

  const lowerImageUrl = imageUrl.toLowerCase();
  if (
    lowerImageUrl.includes("favicon") ||
    lowerImageUrl.includes("logo") ||
    lowerImageUrl.includes("sprite") ||
    lowerImageUrl.includes("placeholder") ||
    lowerImageUrl.includes("gstatic.com")
  ) {
    return "";
  }

  return imageUrl;
}

function extractImageFromItem(item: string, baseUrl: string) {
  const image =
    item.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i)?.[1] ??
    item.match(/<media:content[^>]*url=["']([^"']+)["']/i)?.[1] ??
    item.match(/<enclosure[^>]*url=["']([^"']+)["']/i)?.[1] ??
    item.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ??
    "";

  return normalizeImageUrl(image, baseUrl);
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

      const description = stripTags(descriptionMarkup);
      return {
        title,
        description:
          description.length > 8
            ? `${description.slice(0, 240)}${description.length > 240 ? "..." : ""}`
            : "Kliknite pre zobrazenie celeho clanku a podrobnosti.",
        publishedAt: pubDate || new Date().toUTCString(),
        source: {
          name: candidate.sourceName,
        },
        url: link,
        urlToImage: extractImageFromItem(item, link || candidate.url),
      } satisfies NewsArticle;
    })
    .filter((article): article is NewsArticle => Boolean(article));
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

function rankArticles(articles: NewsArticle[], localEdition: LocalEdition, query: string) {
  const localQuery = localEdition !== "all" && !query ? LOCAL_EDITIONS[localEdition]?.query ?? "" : query;
  const tokens = normalizeText(localQuery)
    .split(" ")
    .filter((token) => token.length > 2);

  if (!tokens.length) {
    return articles;
  }

  return [...articles].sort((left, right) => scoreArticle(right, tokens) - scoreArticle(left, tokens));
}

function scoreArticle(article: NewsArticle, tokens: string[]) {
  const haystack = normalizeText(`${article.title} ${article.description} ${article.source.name}`);
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
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

async function fetchArticles(candidates: FeedCandidate[], query: string, localEdition: LocalEdition) {
  const fetchedArticles: NewsArticle[] = [];
  let sourceMode = "rss";

  for (const candidate of candidates) {
    try {
      const articles = await fetchCandidate(candidate);
      fetchedArticles.push(...articles);
      if (!candidate.label.startsWith("bbc")) {
        sourceMode = sourceMode === "rss" ? "slovak-rss" : sourceMode;
      }

      if (!query && fetchedArticles.length >= 36) {
        break;
      }
    } catch (error) {
      console.warn(`Feed candidate failed (${candidate.label})`, error);
    }
  }

  const ranked = rankArticles(dedupeArticles(fetchedArticles), localEdition, query);
  return {
    articles: ranked.slice(0, 36),
    sourceMode,
  };
}

function buildLocalEditionSummary(
  language: LanguageCode,
  region: RegionCode,
  localEdition: LocalEdition
): LocalEditionSummary | null {
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
      : "Feed uprednostnuje slovenske zdroje pre slovensku ediciu a pouziva BBC ako zalozny globalny kontext.",
  };
}

export default async function handler(request: any, response?: any) {
  try {
    const searchParams = readSearchParams(request);
    const category = normalizeCategory(searchParams.get("category"));
    const query = (searchParams.get("q") ?? "").trim();
    const language = normalizeLanguage(searchParams.get("lang"));
    const region = normalizeRegion(searchParams.get("region"));
    const localEdition = normalizeLocalEdition(searchParams.get("localEdition"));
    const localEditionSummary = buildLocalEditionSummary(language, region, localEdition);

    const result = await fetchArticles(
      buildCandidates({
        category,
        language,
        localEdition,
        query,
        region,
      }),
      query,
      localEdition
    );

    const feed = {
      articles: result.articles,
      editorial: buildEditorial(result.articles, category, query, localEditionSummary),
      localEdition: localEditionSummary,
    } satisfies NewsFeedResponse;

    return sendJson(response, feed, 200, {
      "Cache-Control": "public, max-age=60, s-maxage=180, stale-while-revalidate=600",
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
      "Cache-Control": "no-store",
      "X-Baky-Cache-State": "error-empty",
      "X-Baky-Feed-Updated-At": new Date().toISOString(),
      "X-Baky-Source-Mode": "error-empty",
    });
  }
}
