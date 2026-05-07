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
  provider?: "google-news" | "yahoo-news";
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
const ARTICLE_IMAGE_ENRICHMENT_LIMIT = 12;
const ARTICLE_IMAGE_TIMEOUT_MS = 3000;
const articleImageCache = new Map<string, { expiresAt: number; imageUrl: string }>();

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

function buildGoogleNewsSearchUrl(query: string, language: LanguageCode, region: RegionCode) {
  const url = new URL("https://news.google.com/rss/search");
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
        ...(options.category === "general" ? [SLOVAK_FEEDS.business[0], SLOVAK_FEEDS.technology[0], SLOVAK_FEEDS.sports[0]] : []),
      ]
    : [];
  const globalCandidates = [...(BBC_FEEDS[options.category] ?? BBC_FEEDS.general), ...BBC_FEEDS.general];

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

function extractItemSourceName(item: string, title: string, fallback: string) {
  const sourceName = firstMatch(item, /<source\b[^>]*>([\s\S]*?)<\/source>/i);
  if (sourceName) {
    return sourceName;
  }

  const titleSource = title.match(/\s+-\s+([^-]+)$/)?.[1]?.trim();
  return titleSource || fallback;
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

async function enrichGeneralArticleImages(
  articles: NewsArticle[],
  category: Category,
  query: string
) {
  if (category !== "general" || query) {
    return articles;
  }

  const priorityArticles = articles.slice(0, ARTICLE_IMAGE_ENRICHMENT_LIMIT);
  const enrichedPriorityArticles = await Promise.all(
    priorityArticles.map(async (article) => {
      const articleImage = await extractPrimaryArticleImage(article.url);
      return articleImage ? { ...article, urlToImage: articleImage } : article;
    })
  );

  return [...enrichedPriorityArticles, ...articles.slice(ARTICLE_IMAGE_ENRICHMENT_LIMIT)];
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

      const sourceName = extractItemSourceName(item, title, candidate.sourceName);
      const description = stripTags(descriptionMarkup);
      return {
        title: cleanItemTitle(title, sourceName),
        description:
          description.length > 8
            ? `${description.slice(0, 240)}${description.length > 240 ? "..." : ""}`
            : "Kliknite pre zobrazenie celeho clanku a podrobnosti.",
        publishedAt: pubDate || new Date().toUTCString(),
        source: {
          name: sourceName,
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
        return {
          articles: rankArticles(articles, "all", query).slice(0, 36),
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
  category: Category
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

  const filtered = filterArticlesByQuery(dedupeArticles(fetchedArticles), query);
  const ranked = rankArticles(filtered, localEdition, query).slice(0, 36);
  const articles = await enrichGeneralArticleImages(ranked, category, query);
  return {
    articles,
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
    const refresh = searchParams.get("refresh") === "true";
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
      localEdition,
      category
    );

    const feed = {
      articles: result.articles,
      editorial: buildEditorial(result.articles, category, query, localEditionSummary),
      localEdition: localEditionSummary,
    } satisfies NewsFeedResponse;

    return sendJson(response, feed, 200, {
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
      "Cache-Control": "no-store",
      "X-Baky-Cache-State": "error-empty",
      "X-Baky-Feed-Updated-At": new Date().toISOString(),
      "X-Baky-Source-Mode": "error-empty",
    });
  }
}
