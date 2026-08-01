import { EditorialBriefing, FeedSettings, NewsArticle } from '../types';

export type DeskDigestMode = 'feed' | 'briefing' | 'radar';
export type DeskImpactLevel = 'high' | 'local' | 'market' | 'watch';
export type DeskTrustLevel = 'trusted' | 'regional' | 'mixed' | 'low-signal';
export type DeskReadTimeFilter = 'all' | 'quick' | 'standard' | 'deep';
export type DeskSourceFilter = 'all' | DeskTrustLevel;

export interface DeskWatchlistOption {
  description: string;
  id: string;
  keywords: string[];
  label: string;
}

export interface DeskArticleInsight {
  entities: string[];
  impact: DeskImpactLevel;
  impactLabel: string;
  keywords: string[];
  readTimeMinutes: number;
  sourceLabel: string;
  trust: DeskTrustLevel;
}

export interface DeskBriefingPoint {
  label: string;
  text: string;
}

export interface DeskExecutiveBrief {
  clipboardText: string;
  headline: string;
  points: DeskBriefingPoint[];
  subheadline: string;
  title: string;
}

export interface DeskRadarItem {
  count: number;
  label: string;
}

export interface DeskRadarSnapshot {
  entities: DeskRadarItem[];
  impact: DeskRadarItem[];
  sources: DeskRadarItem[];
  watchlists: DeskRadarItem[];
}

const STOP_WORDS = new Set([
  'about',
  'after',
  'ako',
  'ale',
  'also',
  'and',
  'are',
  'back',
  'before',
  'bez',
  'bola',
  'boli',
  'business',
  'city',
  'dalsie',
  'dnes',
  'event',
  'from',
  'have',
  'into',
  'jeho',
  'jej',
  'ked',
  'ktora',
  'ktore',
  'ktory',
  'last',
  'live',
  'maju',
  'more',
  'musi',
  'news',
  'only',
  'pocas',
  'podla',
  'politics',
  'pred',
  'preto',
  'region',
  'report',
  'sa',
  'says',
  'spravy',
  'story',
  'that',
  'their',
  'this',
  'today',
  'under',
  'update',
  'watch',
  'with',
  'without',
  'world',
  'zatial',
  'zdroje',
]);

const TRUSTED_SOURCES = [
  'aktuality',
  'ap',
  'associated press',
  'bbc',
  'bloomberg',
  'cnn',
  'dennik n',
  'guardian',
  'npr',
  'politico',
  'reuters',
  'sme',
  'techcrunch',
  'the verge',
  'verge',
  'wall street journal',
  'washington post',
  'wsj',
];

const REGIONAL_SOURCES = [
  'bratislava',
  'kosice',
  'korzar',
  'my ',
  'presov',
  'region',
  'regional',
  'rimava',
  'rimavska',
  'sobota',
  'vychod',
  'zilina',
];

const LOW_SIGNAL_SOURCES = ['pluska', 'topky', 'novy cas', 'cas.sk', 'super'];

const HIGH_IMPACT_TERMS = [
  'attack',
  'budget',
  'ceasefire',
  'election',
  'government',
  'law',
  'minister',
  'policy',
  'president',
  'rates',
  'tariff',
  'ukraine',
  'war',
];

const MARKET_TERMS = [
  'bank',
  'bitcoin',
  'business',
  'earnings',
  'economy',
  'euro',
  'fund',
  'inflation',
  'investor',
  'market',
  'merger',
  'nasdaq',
  'stocks',
  'tesla',
  'trade',
];

const WATCH_TERMS = [
  'ai',
  'chip',
  'cyber',
  'hack',
  'launch',
  'model',
  'openai',
  'security',
  'startup',
  'surveillance',
];

export const DESK_WATCHLISTS: DeskWatchlistOption[] = [
  {
    id: 'slovakia',
    label: 'Slovensko',
    description: 'Vláda, politici, mestá a lokálny dopad.',
    keywords: ['bratislava', 'fico', 'kosice', 'presov', 'rimavska', 'slovak', 'slovensko'],
  },
  {
    id: 'markets',
    label: 'Trhy',
    description: 'Trhy, firmy, inflácia, sadzby a veľké výsledky.',
    keywords: ['bank', 'business', 'earnings', 'inflation', 'market', 'rates', 'stocks'],
  },
  {
    id: 'ai',
    label: 'AI',
    description: 'Modely, čipy, platformy a AI firmy.',
    keywords: ['ai', 'chip', 'model', 'nvidia', 'openai', 'robot', 'startup'],
  },
  {
    id: 'security',
    label: 'Bezpečnosť',
    description: 'Kyber, konflikty, útoky a obrana.',
    keywords: ['attack', 'cyber', 'defense', 'hack', 'security', 'ukraine', 'war'],
  },
  {
    id: 'energy',
    label: 'Energia',
    description: 'Ropa, plyn, elektrina a energetické firmy.',
    keywords: ['electricity', 'energy', 'gas', 'nuclear', 'oil', 'power', 'ropa'],
  },
  {
    id: 'regions',
    label: 'Regióny',
    description: 'Regióny, samospráva a lokálne služby.',
    keywords: ['lokal', 'regional', 'rimavska', 'sobota', 'vychod', 'mesto', 'obec'],
  },
];

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ');
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function getDeskKeywords(article: NewsArticle) {
  const rawText = `${article.title} ${article.description} ${article.source.name}`;

  return unique(
    normalizeText(rawText)
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
  ).slice(0, 18);
}

export function getDeskEntities(article: NewsArticle) {
  const rawText = `${article.title}. ${article.description}`;
  const matches =
    rawText.match(/\b\p{Lu}[\p{L}\d.-]{2,}(?:\s+\p{Lu}[\p{L}\d.-]{2,})*/gu) ?? [];

  return unique(
    matches
      .map((entity) => entity.trim())
      .filter((entity) => entity.length > 2 && !/^(Monday|Tuesday|Wednesday|Thursday|Friday)$/u.test(entity))
  ).slice(0, 6);
}

export function estimateReadTime(article: NewsArticle) {
  const words = `${article.title} ${article.description}`.trim().split(/\s+/).length;
  return Math.min(12, Math.max(2, Math.ceil(words / 32)));
}

export function getSourceTrust(sourceName: string): DeskTrustLevel {
  const normalizedSource = normalizeText(sourceName);

  if (LOW_SIGNAL_SOURCES.some((candidate) => normalizedSource.includes(candidate))) {
    return 'low-signal';
  }

  if (REGIONAL_SOURCES.some((candidate) => normalizedSource.includes(candidate))) {
    return 'regional';
  }

  if (TRUSTED_SOURCES.some((candidate) => normalizedSource.includes(candidate))) {
    return 'trusted';
  }

  return 'mixed';
}

export function getSourceTrustLabel(trust: DeskTrustLevel) {
  switch (trust) {
    case 'trusted':
      return 'Dôveryhodný';
    case 'regional':
      return 'Regionálny';
    case 'low-signal':
      return 'Slabý signál';
    default:
      return 'Zmiešaný';
  }
}

export function getImpactLevel(
  article: NewsArticle,
  feedSettings: FeedSettings,
  activeWatchlistIds: string[] = []
) {
  const keywords = getDeskKeywords(article);
  const text = new Set(keywords);
  const locationLabel = normalizeText(feedSettings.location?.label ?? '');
  const matchesWatchlist = DESK_WATCHLISTS.some(
    (watchlist) =>
      activeWatchlistIds.includes(watchlist.id) &&
      watchlist.keywords.some((keyword) => text.has(keyword))
  );

  if (
    HIGH_IMPACT_TERMS.some((keyword) => text.has(keyword)) ||
    article.source.name.toLowerCase().includes('reuters')
  ) {
    return 'high';
  }

  if (MARKET_TERMS.some((keyword) => text.has(keyword))) {
    return 'market';
  }

  if (
    WATCH_TERMS.some((keyword) => text.has(keyword)) ||
    matchesWatchlist
  ) {
    return 'watch';
  }

  if (
    locationLabel &&
    locationLabel
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .some((word) => text.has(word))
  ) {
    return 'local';
  }

  if (getSourceTrust(article.source.name) === 'regional') {
    return 'local';
  }

  return 'high';
}

export function getImpactLabel(impact: DeskImpactLevel) {
  switch (impact) {
    case 'local':
      return 'Lokálne';
    case 'market':
      return 'Trhy';
    case 'watch':
      return 'Sledovanie';
    default:
      return 'Vysoký dopad';
  }
}

export function buildArticleInsight(
  article: NewsArticle,
  feedSettings: FeedSettings,
  activeWatchlistIds: string[] = []
): DeskArticleInsight {
  const trust = getSourceTrust(article.source.name);
  const impact = getImpactLevel(article, feedSettings, activeWatchlistIds);

  return {
    entities: getDeskEntities(article),
    impact,
    impactLabel: getImpactLabel(impact),
    keywords: getDeskKeywords(article),
    readTimeMinutes: estimateReadTime(article),
    sourceLabel: getSourceTrustLabel(trust),
    trust,
  };
}

export function articleMatchesWatchlist(article: NewsArticle, watchlistId: string) {
  const watchlist = DESK_WATCHLISTS.find((item) => item.id === watchlistId);
  if (!watchlist) {
    return false;
  }

  const keywords = new Set(getDeskKeywords(article));
  return watchlist.keywords.some((keyword) => keywords.has(keyword));
}

export function articleMatchesTopic(article: NewsArticle, topic: string) {
  const normalizedTopic = normalizeText(topic);
  const normalizedText = normalizeText(
    `${article.title} ${article.description} ${article.source.name}`
  );

  return normalizedText.includes(normalizedTopic);
}

export function buildExecutiveBrief(
  articles: NewsArticle[],
  feedSettings: FeedSettings,
  editorial: EditorialBriefing | null,
  activeWatchlistIds: string[] = []
): DeskExecutiveBrief {
  const nowHour = new Date().getHours();
  const phase =
    nowHour < 11 ? 'Ranný brief' : nowHour < 17 ? 'Denná aktualizácia' : 'Večerný súhrn';
  const sample = articles.slice(0, 5);
  const topEntities = unique(sample.flatMap((article) => getDeskEntities(article))).slice(0, 4);
  const impactHeavy = sample.filter((article) =>
    buildArticleInsight(article, feedSettings, activeWatchlistIds).impact === 'high'
  ).length;
  const watchHits = activeWatchlistIds.length
    ? sample.filter((article) =>
        activeWatchlistIds.some((watchlistId) => articleMatchesWatchlist(article, watchlistId))
      ).length
    : 0;

  const points = sample.map((article) => {
    const insight = buildArticleInsight(article, feedSettings, activeWatchlistIds);

    return {
      label: insight.impactLabel,
      text: `${article.title} (${article.source.name}, ${insight.readTimeMinutes} min)`,
    };
  });

  const topicsLine =
    editorial?.topTopics?.slice(0, 3).join(', ') ||
    topEntities.join(', ') ||
    'bez dominantnej témy';
  const summary = `${impactHeavy} signálov s vysokým dopadom, ${watchHits} hitov sledovania, fokus na ${topicsLine}.`;
  const clipboardText = [
    phase,
    summary,
    ...points.map((point, index) => `${index + 1}. [${point.label}] ${point.text}`),
  ].join('\n');

  return {
    clipboardText,
    headline: phase,
    points,
    subheadline: summary,
    title: activeWatchlistIds.length > 0 ? 'Manažérsky sledovací prehľad' : 'Manažérsky prehľad',
  };
}

function buildCountItems(values: string[], limit: number) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export function buildRadarSnapshot(
  articles: NewsArticle[],
  feedSettings: FeedSettings,
  activeWatchlistIds: string[] = []
): DeskRadarSnapshot {
  const insights = articles.map((article) =>
    buildArticleInsight(article, feedSettings, activeWatchlistIds)
  );

  return {
    entities: buildCountItems(insights.flatMap((insight) => insight.entities), 6),
    impact: buildCountItems(insights.map((insight) => insight.impactLabel), 4),
    sources: buildCountItems(articles.map((article) => article.source.name), 5),
    watchlists: DESK_WATCHLISTS.map((watchlist) => ({
      label: watchlist.label,
      count: articles.filter((article) => articleMatchesWatchlist(article, watchlist.id)).length,
    })).filter((item) => item.count > 0),
  };
}

export function matchesSourceFilter(trust: DeskTrustLevel, filter: DeskSourceFilter) {
  return filter === 'all' ? true : trust === filter;
}

export function matchesReadTimeFilter(
  readTimeMinutes: number,
  filter: DeskReadTimeFilter
) {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'quick') {
    return readTimeMinutes <= 3;
  }

  if (filter === 'standard') {
    return readTimeMinutes >= 4 && readTimeMinutes <= 6;
  }

  return readTimeMinutes >= 7;
}

export function prioritizeWatchlists(
  articles: NewsArticle[],
  activeWatchlistIds: string[]
) {
  if (activeWatchlistIds.length === 0) {
    return articles;
  }

  return [...articles].sort((left, right) => {
    const leftScore = activeWatchlistIds.reduce(
      (total, watchlistId) => total + (articleMatchesWatchlist(left, watchlistId) ? 1 : 0),
      0
    );
    const rightScore = activeWatchlistIds.reduce(
      (total, watchlistId) => total + (articleMatchesWatchlist(right, watchlistId) ? 1 : 0),
      0
    );

    return rightScore - leftScore;
  });
}
