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

const TOPICS: Record<LanguageCode, Record<Category, string>> = {
  sk: {
    business: "ekonomika biznis firmy trhy",
    entertainment: "kultura film hudba celebrity",
    general: "slovensko svet spravy",
    health: "zdravie medicina prevencia",
    science: "veda vesmir vyskum",
    sports: "sport futbal hokej tenis",
    technology: "technologie AI internet software",
  },
  en: {
    business: "business economy markets",
    entertainment: "entertainment movies music",
    general: "world news politics",
    health: "health medicine wellness",
    science: "science research space",
    sports: "sports football tennis hockey",
    technology: "technology AI software internet",
  },
  cs: {
    business: "ekonomika byznys firmy",
    entertainment: "kultura zabava filmy",
    general: "cesko svet zpravy",
    health: "zdravi medicina prevence",
    science: "veda vyzkum vesmir",
    sports: "sport fotbal hokej tenis",
    technology: "technologie AI software internet",
  },
  de: {
    business: "wirtschaft unternehmen maerkte",
    entertainment: "unterhaltung kultur filme",
    general: "deutschland welt nachrichten",
    health: "gesundheit medizin",
    science: "wissenschaft forschung weltraum",
    sports: "sport fussball tennis hockey",
    technology: "technologie KI software internet",
  },
};

const LOCAL_EDITIONS: Record<
  Exclude<LocalEdition, "all">,
  Omit<LocalEditionSummary, "id"> & { query: string }
> = {
  bratislava: {
    badge: "Lokalna edicia",
    description: "Doprava, mesto, skoly, nemocnice a lokalne dianie v Bratislave.",
    label: "Bratislava",
    query: "Bratislava doprava policia mesto skoly nemocnica kultura",
  },
  kosice: {
    badge: "Lokalna edicia",
    description: "Mesto, bezpecnost, verejny priestor a sluzby v Kosiciach.",
    label: "Kosice",
    query: "Kosice doprava policia mesto skoly nemocnica kultura",
  },
  presov: {
    badge: "Lokalna edicia",
    description: "Presovsky vyber pre dopravu, kraj, mesto a sluzby.",
    label: "Presov",
    query: "Presov doprava policia mesto kraj nemocnica kultura",
  },
  "rimavska-sobota": {
    badge: "Lokalna edicia",
    description: "Mesto, okres, sluzby a dianie v Rimavskej Sobote.",
    label: "Rimavska Sobota",
    query: "Rimavska Sobota doprava policia mesto okres nemocnica kultura",
  },
  vychod: {
    badge: "Regionalny fokus",
    description: "Kosice, Presov a temy s dopadom na vychod Slovenska.",
    label: "Vychod",
    query: "Kosice Presov vychod Slovenska doprava policia kraj nemocnica",
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

function googleSearchUrl(query: string, language: LanguageCode, region: RegionCode) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${language}&gl=${region}&ceid=${region}:${language}`;
}

function googleTopUrl(language: LanguageCode, region: RegionCode) {
  return `https://news.google.com/rss?hl=${language}&gl=${region}&ceid=${region}:${language}`;
}

function buildCandidates(options: {
  category: Category;
  language: LanguageCode;
  localEdition: LocalEdition;
  query: string;
  region: RegionCode;
}): FeedCandidate[] {
  if (options.query) {
    return [
      {
        label: "google-search",
        url: googleSearchUrl(options.query, options.language, options.region),
      },
      {
        label: "google-search-en",
        url: googleSearchUrl(options.query, "en", "US"),
      },
    ];
  }

  if (
    options.language === "sk" &&
    options.region === "SK" &&
    options.category === "general" &&
    options.localEdition !== "all"
  ) {
    const local = LOCAL_EDITIONS[options.localEdition];
    return [
      {
        label: `google-local-${options.localEdition}`,
        url: googleSearchUrl(local.query, "sk", "SK"),
      },
      {
        label: "google-top-sk",
        url: googleTopUrl("sk", "SK"),
      },
      {
        label: "google-general-sk",
        url: googleSearchUrl(TOPICS.sk.general, "sk", "SK"),
      },
    ];
  }

  return [
    {
      label: `google-top-${options.language}-${options.region}`,
      url: options.category === "general"
        ? googleTopUrl(options.language, options.region)
        : googleSearchUrl(TOPICS[options.language][options.category], options.language, options.region),
    },
    {
      label: "google-top-sk",
      url: googleTopUrl("sk", "SK"),
    },
    {
      label: "google-top-en",
      url: googleTopUrl("en", "US"),
    },
  ];
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

function normalizeImageUrl(value: string) {
  let imageUrl = decodeHtml(value);
  if (!imageUrl) return "";
  if (imageUrl.startsWith("//")) imageUrl = `https:${imageUrl}`;
  if (imageUrl.startsWith("http://")) imageUrl = imageUrl.replace("http://", "https://");
  if (imageUrl.includes("googleusercontent.com")) {
    imageUrl = `${imageUrl.split("=")[0]}=w1200-h675-p-k-no-nu`;
  }
  if (
    imageUrl.includes("favicon") ||
    imageUrl.includes("logo") ||
    imageUrl.includes("gstatic.com") ||
    imageUrl.includes("news.google.com")
  ) {
    return "";
  }
  return imageUrl;
}

function getGoogleNewsArticleId(articleUrl: string) {
  try {
    const url = new URL(articleUrl);
    if (url.hostname !== "news.google.com") return "";
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "";
  } catch {
    return "";
  }
}

function parseGoogleDecodeResponse(value: string) {
  const line = value
    .split("\n")
    .find((part) => part.includes("wrb.fr") && part.includes("garturlres"));

  if (!line) return "";

  try {
    const parsedLine = JSON.parse(line) as Array<[string, string, string]>;
    const rawPayload = parsedLine[0]?.[2];
    if (!rawPayload) return "";
    const decodedPayload = JSON.parse(rawPayload) as [string, string];
    return decodedPayload[1] ?? "";
  } catch {
    return "";
  }
}

async function fetchGoogleDecodeParams(articleId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`https://news.google.com/rss/articles/${articleId}`, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 BakyNews/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const html = await response.text();
    const signature = html.match(/data-n-a-sg=["']([^"']+)["']/i)?.[1] ?? "";
    const timestamp = html.match(/data-n-a-ts=["']([^"']+)["']/i)?.[1] ?? "";
    if (!signature || !timestamp) return null;
    return { signature, timestamp };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveGoogleNewsUrl(articleUrl: string) {
  const articleId = getGoogleNewsArticleId(articleUrl);
  if (!articleId) return articleUrl;

  try {
    const params = await fetchGoogleDecodeParams(articleId);
    if (!params) return articleUrl;

    const payload = [
      "Fbv4je",
      `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${articleId}",${params.timestamp},"${params.signature}"]`,
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
        body: `f.req=${encodeURIComponent(JSON.stringify([[payload]]))}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "Mozilla/5.0 BakyNews/1.0",
        },
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok) return articleUrl;
      const decodedUrl = parseGoogleDecodeResponse(await response.text());
      return decodedUrl && decodedUrl.startsWith("http") ? decodedUrl : articleUrl;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return articleUrl;
  }
}

function resolveUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
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

    return normalizeImageUrl(resolveUrl(image, articleUrl));
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function parseItems(xml: string, sourceLabel: string): NewsArticle[] {
  const items = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/g)).map((match) => match[0]);

  return items
    .map((item) => {
      const rawTitle = firstMatch(item, /<title[^>]*>([\s\S]*?)<\/title>/i);
      const link = firstMatch(item, /<link[^>]*>([\s\S]*?)<\/link>/i);
      const pubDate = firstMatch(item, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
      const descriptionMarkup = firstMatch(item, /<description[^>]*>([\s\S]*?)<\/description>/i);
      const mediaImage =
        item.match(/<media:content[^>]*url=["']([^"']+)["']/i)?.[1] ??
        item.match(/<enclosure[^>]*url=["']([^"']+)["']/i)?.[1] ??
        "";
      const descriptionImage = descriptionMarkup.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? "";
      const title = rawTitle.split(" - ")[0]?.trim() || rawTitle.trim();

      if (!title || !link) {
        return null;
      }

      const description = stripTags(descriptionMarkup);
      return {
        title,
        description:
          description.length > 8
            ? `${description.slice(0, 220)}${description.length > 220 ? "..." : ""}`
            : "Kliknite pre zobrazenie celeho clanku a podrobnosti.",
        url: link,
        urlToImage: normalizeImageUrl(mediaImage || descriptionImage),
        publishedAt: pubDate || new Date().toUTCString(),
        source: {
          name: sourceLabel,
        },
      } satisfies NewsArticle;
    })
    .filter((article): article is NewsArticle => Boolean(article));
}

function dedupeArticles(articles: NewsArticle[]) {
  const seen = new Set<string>();
  return articles.filter((article) => {
    const key = article.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
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

    return parseItems(await response.text(), candidate.label);
  } finally {
    clearTimeout(timeout);
  }
}

async function backfillImages(articles: NewsArticle[]) {
  const result = [...articles];
  const indexes = articles
    .map((article, index) => ({ article, index }))
    .slice(0, 8);

  let cursor = 0;
  const workers = Array.from({ length: Math.min(3, indexes.length) }, async () => {
    while (cursor < indexes.length) {
      const current = indexes[cursor];
      cursor += 1;

      const resolvedUrl = await resolveGoogleNewsUrl(current.article.url);
      const image = current.article.urlToImage || (await extractArticleImage(resolvedUrl));
      result[current.index] = {
        ...current.article,
        url: resolvedUrl,
        urlToImage: image,
      };
    }
  });

  await Promise.all(workers);
  return result;
}

async function fetchArticles(candidates: FeedCandidate[]) {
  for (const candidate of candidates) {
    try {
      const articles = await fetchCandidate(candidate);
      if (articles.length) {
        return backfillImages(dedupeArticles(articles).slice(0, 24));
      }
    } catch (error) {
      console.warn(`Vercel feed candidate failed (${candidate.label})`, error);
    }
  }

  return [];
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
    ? `Tema "${query}" napriec zdrojmi`
    : localEdition
    ? `${localEdition.label}: lokalny prehlad`
    : category === "general"
    ? "Hlavne spravy v jednom prehlade"
    : "Vyber sprav v jednom prehlade";

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
      ? "Feed uprednostnuje lokalne temy a ich prakticky dopad."
      : "Feed zdruzuje hlavne linky z aktualnych zdrojov do jedneho prehladu.",
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
        language,
        localEdition,
        query,
        region,
      })
    );

    const feed = {
      articles,
      editorial: buildEditorial(articles, category, query, localEditionSummary),
      localEdition: localEditionSummary,
    } satisfies NewsFeedResponse;

    return sendJson(response, feed, 200, {
      "Cache-Control": "public, max-age=60, s-maxage=180, stale-while-revalidate=600",
      "X-Baky-Cache-State": "vercel-light",
      "X-Baky-Feed-Updated-At": new Date().toISOString(),
      "X-Baky-Source-Mode": "vercel-light-rss",
    });
  } catch (error) {
    console.error("Vercel lightweight news handler failed:", error);
    const emptyFeed = {
      articles: [],
      editorial: null,
      localEdition: null,
    } satisfies NewsFeedResponse;

    return sendJson(response, emptyFeed, 200, {
      "Cache-Control": "no-store",
      "X-Baky-Cache-State": "vercel-error-empty",
      "X-Baky-Feed-Updated-At": new Date().toISOString(),
      "X-Baky-Source-Mode": "vercel-error-empty",
    });
  }
}
