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
  url: string;
};

const LOCAL_EDITIONS: Record<
  Exclude<LocalEdition, "all">,
  Omit<LocalEditionSummary, "id"> & { query: string }
> = {
  bratislava: {
    badge: "Lokalna edicia",
    description: "Doprava, mesto, skoly, nemocnice a lokalne dianie v Bratislave.",
    label: "Bratislava",
    query: "Bratislava Slovakia",
  },
  kosice: {
    badge: "Lokalna edicia",
    description: "Mesto, bezpecnost, verejny priestor a sluzby v Kosiciach.",
    label: "Kosice",
    query: "Kosice Slovakia",
  },
  presov: {
    badge: "Lokalna edicia",
    description: "Presovsky vyber pre dopravu, kraj, mesto a sluzby.",
    label: "Presov",
    query: "Presov Slovakia",
  },
  "rimavska-sobota": {
    badge: "Lokalna edicia",
    description: "Mesto, okres, sluzby a dianie v Rimavskej Sobote.",
    label: "Rimavska Sobota",
    query: "Rimavska Sobota Slovakia",
  },
  vychod: {
    badge: "Regionalny fokus",
    description: "Kosice, Presov a temy s dopadom na vychod Slovenska.",
    label: "Vychod",
    query: "eastern Slovakia Kosice Presov",
  },
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

const BBC_FEEDS: Record<Category, FeedCandidate[]> = {
  business: [
    { label: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
    { label: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  entertainment: [
    {
      label: "BBC Entertainment",
      url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
    },
    { label: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  general: [
    { label: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
    { label: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  ],
  health: [
    { label: "BBC Health", url: "https://feeds.bbci.co.uk/news/health/rss.xml" },
    { label: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  science: [
    {
      label: "BBC Science",
      url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    },
    { label: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
    { label: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  sports: [
    { label: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml" },
    { label: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  technology: [
    { label: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
    { label: "BBC Science", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" },
    { label: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
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

function dedupeCandidates(candidates: FeedCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

function buildCandidates(options: {
  category: Category;
  localEdition: LocalEdition;
  query: string;
}): FeedCandidate[] {
  if (options.query) {
    return dedupeCandidates(BBC_SEARCH_FEEDS);
  }

  if (options.localEdition !== "all" && options.category === "general") {
    return dedupeCandidates([...BBC_FEEDS.general, ...BBC_FEEDS.business]);
  }

  return dedupeCandidates([...(BBC_FEEDS[options.category] ?? BBC_FEEDS.general), ...BBC_FEEDS.general]);
}

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
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

function resolveUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

function normalizeImageUrl(value: string, baseUrl = "") {
  let imageUrl = decodeHtml(value);
  if (!imageUrl) return "";

  if (baseUrl) {
    imageUrl = resolveUrl(imageUrl, baseUrl);
  }

  if (imageUrl.startsWith("//")) imageUrl = `https:${imageUrl}`;
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

async function extractArticleImage(articleUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(articleUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 BakyNews/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return "";
    }

    const html = await response.text();
    const image =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)?.[1] ??
      "";

    return normalizeImageUrl(image, articleUrl);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function parseItems(xml: string, candidate: FeedCandidate): NewsArticle[] {
  const items = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/g)).map((match) => match[0]);

  return items
    .map((item) => {
      const rawTitle = firstMatch(item, /<title[^>]*>([\s\S]*?)<\/title>/i);
      const link = firstMatch(item, /<link[^>]*>([\s\S]*?)<\/link>/i);
      const pubDate = firstMatch(item, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
      const descriptionMarkup = firstMatch(item, /<description[^>]*>([\s\S]*?)<\/description>/i);
      const title = rawTitle.trim();

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
        url: link,
        urlToImage: extractImageFromItem(item, link || candidate.url),
        publishedAt: pubDate || new Date().toUTCString(),
        source: {
          name: candidate.label,
        },
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

function filterArticlesByQuery(articles: NewsArticle[], query: string, localEdition: LocalEdition) {
  const activeQuery = localEdition !== "all" && !query ? LOCAL_EDITIONS[localEdition]?.query ?? "" : query;
  const tokens = normalizeText(activeQuery)
    .split(" ")
    .filter((token) => token.length > 2);

  if (!tokens.length) {
    return articles;
  }

  const matches = articles.filter((article) => {
    const haystack = normalizeText(`${article.title} ${article.description} ${article.source.name}`);
    return tokens.some((token) => haystack.includes(token));
  });

  return matches.length ? matches : articles;
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

async function backfillImages(articles: NewsArticle[]) {
  const result = [...articles];
  const indexes = articles
    .map((article, index) => ({ article, index }))
    .filter(({ article }) => !article.urlToImage)
    .slice(0, 8);

  let cursor = 0;
  const workers = Array.from({ length: Math.min(3, indexes.length) }, async () => {
    while (cursor < indexes.length) {
      const current = indexes[cursor];
      cursor += 1;

      const image = await extractArticleImage(current.article.url);
      result[current.index] = {
        ...current.article,
        urlToImage: image,
      };
    }
  });

  await Promise.all(workers);
  return result;
}

async function fetchArticles(candidates: FeedCandidate[], query: string, localEdition: LocalEdition) {
  const fetchedArticles: NewsArticle[] = [];

  for (const candidate of candidates) {
    try {
      const articles = await fetchCandidate(candidate);
      fetchedArticles.push(...articles);

      if (!query && fetchedArticles.length >= 28) {
        break;
      }
    } catch (error) {
      console.warn(`Vercel BBC feed candidate failed (${candidate.label})`, error);
    }
  }

  const filtered = filterArticlesByQuery(dedupeArticles(fetchedArticles), query, localEdition);
  return backfillImages(filtered.slice(0, 24));
}

function buildLocalEditionSummary(
  language: LanguageCode,
  region: RegionCode,
  localEdition: LocalEdition
): LocalEditionSummary | null {
  if (language !== "sk" || region !== "SK" || localEdition === "all") {
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
    ? `Tema "${query}" cez BBC News`
    : localEdition
    ? `${localEdition.label}: BBC globalny kontext`
    : category === "general"
    ? "Hlavne spravy cez BBC News"
    : "Vyber sprav cez BBC News";

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
      ? "BBC nema lokalny slovensky feed, preto lokalna edicia iba filtruje globalny BBC mix podla mesta alebo regionu."
      : "Feed ide priamo z BBC RSS.",
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

    const articles = await fetchArticles(
      buildCandidates({
        category,
        localEdition,
        query,
      }),
      query,
      localEdition
    );

    const feed = {
      articles,
      editorial: buildEditorial(articles, category, query, localEditionSummary),
      localEdition: localEditionSummary,
    } satisfies NewsFeedResponse;

    return sendJson(response, feed, 200, {
      "Cache-Control": "public, max-age=60, s-maxage=180, stale-while-revalidate=600",
      "X-Baky-Cache-State": "vercel-bbc",
      "X-Baky-Feed-Updated-At": new Date().toISOString(),
      "X-Baky-Source-Mode": "bbc-rss",
    });
  } catch (error) {
    console.error("Vercel BBC news handler failed:", error);
    const emptyFeed = {
      articles: [],
      editorial: null,
      localEdition: null,
    } satisfies NewsFeedResponse;

    return sendJson(response, emptyFeed, 200, {
      "Cache-Control": "no-store",
      "X-Baky-Cache-State": "vercel-error-empty",
      "X-Baky-Feed-Updated-At": new Date().toISOString(),
      "X-Baky-Source-Mode": "bbc-error-empty",
    });
  }
}
