import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  BookOpen,
  Bookmark,
  Clock3,
  Home,
  MapPinned,
  Navigation,
  Newspaper,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';

import {
  Category,
  CommodityMarketSnapshot,
  EditorialBriefing,
  FeedSettings,
  LocalEditionSummary,
  NewsArticle,
  WeatherSnapshot,
  WikiSummary,
} from './types';
import { fetchCommodityMarkets, fetchNews, fetchWeather, fetchWikiSummary } from './services/api';
import { ArticleModal, type ArticleReaction } from './components/ArticleModal';
import { CategoryFilter } from './components/CategoryFilter';
import { FeedSettingsModal } from './components/FeedSettingsModal';
import { LoadingIndicator } from './components/LoadingIndicator';
import { Logo } from './components/Logo';
import { NewsCard } from './components/NewsCard';
import { SearchBar } from './components/SearchBar';
import { WeatherWidget } from './components/WeatherWidget';
import { WikiCard } from './components/WikiCard';
import { CommodityMarketWidget } from './components/CommodityMarketWidget';
import {
  resolveCurrentLocationPreference,
  supportsGeolocation,
  withDetectedLocation,
} from './lib/location';
import {
  articleMatchesTopic,
  articleMatchesWatchlist,
  buildArticleInsight,
  buildExecutiveBrief,
  buildRadarSnapshot,
  DESK_WATCHLISTS,
  DeskDigestMode,
  DeskReadTimeFilter,
  DeskSourceFilter,
  matchesReadTimeFilter,
  matchesSourceFilter,
  prioritizeWatchlists,
} from './lib/news-intelligence';
import { cn } from './lib/utils';
import { ArticleInsightChips } from './components/ArticleInsightChips';
import { DeskRadarPanel } from './components/DeskRadarPanel';
import { DeskSavedSearchesPanel } from './components/DeskSavedSearchesPanel';
import { DeskWatchlistPanel } from './components/DeskWatchlistPanel';
import { ExecutiveBriefingPanel } from './components/ExecutiveBriefingPanel';
import { NationalOverviewPanel } from './components/NationalOverviewPanel';
import { SourceBadge } from './components/SourceBadge';

const FEED_SETTINGS_STORAGE_KEY = 'baky-news-feed-settings';
const ENGAGEMENT_STORAGE_KEY = 'baky-news-engagement-v1';
const SAVED_SEARCHES_STORAGE_KEY = 'baky-news-saved-searches-v1';
const WATCHLIST_STORAGE_KEY = 'baky-news-watchlists-v1';

const DEFAULT_FEED_SETTINGS: FeedSettings = {
  language: 'sk',
  region: 'SK',
  autoRefreshMinutes: 1,
  localEdition: 'all',
  useLocation: false,
};

const BREAKING_NEWS_OVERRIDES: Array<{
  article: NewsArticle;
  category: Category;
  expiresAt: string;
}> = [
  {
    category: 'general',
    expiresAt: '2026-07-29T15:29:10+02:00',
    article: {
      title: 'V okrese Rimavská Sobota pátrajú po 16-ročnej Chiare',
      description:
        'Polícia vyhlásila pátranie po 16-ročnej Chiare Fekiačovej z okresu Rimavská Sobota a žiada verejnosť o pomoc pri jej vypátraní.',
      contentOverride: `Polícia vyhlásila pátranie po 16-ročnej Chiare Fekiačovej z okresu Rimavská Sobota. Obracia sa preto na verejnosť so žiadosťou o pomoc pri jej vypátraní.

Nezvestnou je Chiara Fekiačová, narodená 16. februára 2010, ktorá má trvalý pobyt v okrese Rimavská Sobota. Pátranie po nej bolo vyhlásené v utorok 28. júla. Polícia zatiaľ nezverejnila bližší opis nezvestnej osoby ani informácie o oblečení, ktoré mala na sebe v čase zmiznutia.

Ak ste Chiaru videli alebo máte akékoľvek informácie, ktoré by mohli pomôcť pri jej nájdení, okamžite kontaktujte políciu na tiesňovej linke 158. Informácie je možné oznámiť aj Záchrannému Systému Slovensko - Pátranie po osobách na telefónnom čísle +421 948 112 233.

Polícia zdôrazňuje, že aj zdanlivo nepodstatná informácia môže byť pri pátraní rozhodujúca a pomôcť k čo najskoršiemu nájdeniu nezvestného dievčaťa.`,
      publishedAt: '2026-07-28T12:55:00+02:00',
      source: {
        name: 'Bystricak.sk',
      },
      url: 'https://www.bystricak.sk/clanky/12462/chiara-z-okresu-rimavska-sobota-sa-nevratila-domov-policia-prosi-o-pomoc-pri-patrani-po-16-rocnom-dievcati',
      urlToImage:
        'https://www.bystricak.sk/assets/images/bb/articles/img-1/1785234515-chiara-z-okresu-rimavska-sobota-sa-nevratila-domov-policia-prosi-o-pomoc-pri-patrani-po-16rocnom-dievcati.webp',
    },
  },
];

type FeedView = 'top' | 'for-you' | 'saved';

interface OpenedArticleState {
  count: number;
  lastOpenedAt: string;
}

interface EngagementState {
  opened: Record<string, OpenedArticleState>;
  reactions: Record<string, ArticleReaction>;
  savedArticles: Record<string, NewsArticle>;
  sourceScores: Record<string, number>;
  topicScores: Record<string, number>;
}

type TopicFocus = string | null;

function createEmptyEngagementState(): EngagementState {
  return {
    opened: {},
    reactions: {},
    savedArticles: {},
    sourceScores: {},
    topicScores: {},
  };
}

const SUPPORTED_LANGUAGES = ['sk', 'en', 'cs', 'de'] as const;
const SUPPORTED_REGIONS = ['SK', 'US', 'GB', 'CZ', 'DE', 'AT'] as const;
const SUPPORTED_REFRESH_INTERVALS = [1, 5, 15] as const;
const SUPPORTED_LOCAL_EDITIONS = [
  'all',
  'bratislava',
  'kosice',
  'presov',
  'rimavska-sobota',
  'vychod',
] as const;

const TOPIC_STOP_WORDS = new Set([
  'ako',
  'ale',
  'and',
  'are',
  'bez',
  'bol',
  'bola',
  'boli',
  'bude',
  'byť',
  'byt',
  'can',
  'for',
  'from',
  'his',
  'ich',
  'jeho',
  'jej',
  'ked',
  'ktora',
  'ktore',
  'ktory',
  'maju',
  'nad',
  'news',
  'not',
  'podla',
  'počas',
  'pocas',
  'pre',
  'pred',
  'pri',
  'proti',
  'sa',
  'she',
  'sme',
  'som',
  'spravy',
  'the',
  'that',
  'this',
  'with',
  'you',
  'zo',
]);

const feedViewOptions: Array<{
  icon: typeof Newspaper;
  id: FeedView;
  label: string;
}> = [
  { icon: Newspaper, id: 'top', label: 'Hlavné správy' },
  { icon: Sparkles, id: 'for-you', label: 'Pre teba' },
  { icon: Bookmark, id: 'saved', label: 'Uložené' },
];

const categoryMeta: Record<
  Category,
  { description: string; kicker: string; title: string }
> = {
  general: {
    kicker: 'Domáce a zahraničné správy',
    title: 'Prehľad dňa',
    description:
      'Najdôležitejšie udalosti zoradené do pokojného produktového feedu bez zbytočného balastu.',
  },
  technology: {
    kicker: 'Technológie',
    title: 'Digitálny prehľad',
    description:
      'Produkty, platformy, bezpečnosť a internetové služby so zameraním na praktický dopad.',
  },
  business: {
    kicker: 'Biznis a ekonomika',
    title: 'Trhy a firmy',
    description:
      'Makroekonomika, firmy, peniaze a rozhodnutia, ktoré menia podnikateľské prostredie.',
  },
  sports: {
    kicker: 'Šport',
    title: 'Aktuálne výsledky',
    description:
      'Kľúčové zápasy, prestupy a výkonnostné príbehy zo Slovenska aj zo sveta.',
  },
  science: {
    kicker: 'Veda',
    title: 'Objavy a výskum',
    description:
      'Výber vedeckých tém, výskumu a poznatkov usporiadaný čitateľne a bez clickbaitu.',
  },
};

function readStoredFeedSettings(): FeedSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_FEED_SETTINGS;
  }

  try {
    const rawValue = window.localStorage.getItem(FEED_SETTINGS_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_FEED_SETTINGS;
    }

    const parsed = JSON.parse(rawValue) as Partial<FeedSettings>;
    const language = SUPPORTED_LANGUAGES.includes(
      parsed.language as (typeof SUPPORTED_LANGUAGES)[number]
    )
      ? parsed.language!
      : DEFAULT_FEED_SETTINGS.language;
    const region = SUPPORTED_REGIONS.includes(
      parsed.region as (typeof SUPPORTED_REGIONS)[number]
    )
      ? parsed.region!
      : DEFAULT_FEED_SETTINGS.region;
    const autoRefreshMinutes = SUPPORTED_REFRESH_INTERVALS.includes(
      parsed.autoRefreshMinutes as (typeof SUPPORTED_REFRESH_INTERVALS)[number]
    )
      ? parsed.autoRefreshMinutes!
      : DEFAULT_FEED_SETTINGS.autoRefreshMinutes;
    const localEdition = SUPPORTED_LOCAL_EDITIONS.includes(
      parsed.localEdition as (typeof SUPPORTED_LOCAL_EDITIONS)[number]
    )
      ? parsed.localEdition!
      : DEFAULT_FEED_SETTINGS.localEdition;

    const hasStoredLocation =
      parsed.useLocation &&
      typeof parsed.location?.latitude === 'number' &&
      typeof parsed.location?.longitude === 'number';

    return {
      language,
      region,
      autoRefreshMinutes,
      localEdition,
      useLocation: Boolean(hasStoredLocation),
      location: hasStoredLocation ? parsed.location : undefined,
    };
  } catch {
    return DEFAULT_FEED_SETTINGS;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readStoredStringList(storageKey: string) {
  if (typeof window === 'undefined') {
    return [] as string[];
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return Array.from(
      new Set(
        parsed
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );
  } catch {
    return [];
  }
}

function readStoredEngagementState(): EngagementState {
  if (typeof window === 'undefined') {
    return createEmptyEngagementState();
  }

  try {
    const rawValue = window.localStorage.getItem(ENGAGEMENT_STORAGE_KEY);
    if (!rawValue) {
      return createEmptyEngagementState();
    }

    const parsed = JSON.parse(rawValue) as Partial<EngagementState>;

    return {
      opened: isRecord(parsed.opened) ? (parsed.opened as EngagementState['opened']) : {},
      reactions: isRecord(parsed.reactions)
        ? (parsed.reactions as EngagementState['reactions'])
        : {},
      savedArticles: isRecord(parsed.savedArticles)
        ? (parsed.savedArticles as EngagementState['savedArticles'])
        : {},
      sourceScores: isRecord(parsed.sourceScores)
        ? (parsed.sourceScores as EngagementState['sourceScores'])
        : {},
      topicScores: isRecord(parsed.topicScores)
        ? (parsed.topicScores as EngagementState['topicScores'])
        : {},
    };
  } catch {
    return createEmptyEngagementState();
  }
}

function normalizeSignalText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ');
}

function getArticleKeywords(article: NewsArticle) {
  const rawText = `${article.title} ${article.description} ${article.source.name}`;
  const keywords = normalizeSignalText(rawText)
    .split(/\s+/)
    .filter((word) => word.length > 3 && !TOPIC_STOP_WORDS.has(word));

  return Array.from(new Set(keywords)).slice(0, 10);
}

function getLocationKeywords(feedSettings: FeedSettings) {
  if (!feedSettings.location?.label) {
    return [];
  }

  return normalizeSignalText(feedSettings.location.label)
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function scoreArticle(
  article: NewsArticle,
  engagement: EngagementState,
  feedSettings: FeedSettings
) {
  const keywords = getArticleKeywords(article);
  const locationKeywords = getLocationKeywords(feedSettings);
  const sourceName = article.source.name;
  let score = 0;

  score += engagement.sourceScores[sourceName] ?? 0;

  for (const keyword of keywords) {
    score += engagement.topicScores[keyword] ?? 0;
  }

  if (engagement.savedArticles[article.url]) {
    score += 4;
  }

  const reaction = engagement.reactions[article.url];
  if (reaction === 'important') {
    score += 5;
  } else if (reaction === 'track') {
    score += 3;
  } else if (reaction === 'less') {
    score -= 18;
  }

  if (
    locationKeywords.length > 0 &&
    locationKeywords.some((keyword) => keywords.includes(keyword))
  ) {
    score += 4;
  }

  const ageMs = Date.now() - Date.parse(article.publishedAt);
  if (Number.isFinite(ageMs)) {
    const ageHours = Math.max(0, ageMs / 3_600_000);
    score += Math.max(0, 8 - ageHours / 4);
  }

  return score;
}

function rankForYouArticles(
  articles: NewsArticle[],
  engagement: EngagementState,
  feedSettings: FeedSettings
) {
  return [...articles]
    .map((article, index) => ({
      article,
      index,
      score: scoreArticle(article, engagement, feedSettings),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.article);
}

function getRelatedArticles(article: NewsArticle, articles: NewsArticle[]) {
  const currentKeywords = new Set(getArticleKeywords(article));

  return articles
    .filter((candidate) => candidate.url !== article.url)
    .map((candidate) => {
      const candidateKeywords = getArticleKeywords(candidate);
      const overlap = candidateKeywords.filter((keyword) =>
        currentKeywords.has(keyword)
      ).length;
      const sourceBoost = candidate.source.name === article.source.name ? 2 : 0;

      return {
        article: candidate,
        score: overlap + sourceBoost,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Date.parse(b.article.publishedAt) - Date.parse(a.article.publishedAt)
    )
    .slice(0, 4)
    .map((candidate) => candidate.article);
}

function getTodayOpenedCount(engagement: EngagementState) {
  const today = new Date().toDateString();

  return Object.values(engagement.opened).reduce((total, opened) => {
    if (new Date(opened.lastOpenedAt).toDateString() !== today) {
      return total;
    }

    return total + opened.count;
  }, 0);
}

function prependUniqueArticle(articles: NewsArticle[], article: NewsArticle) {
  return [article, ...articles.filter((candidate) => candidate.url !== article.url)];
}

function getActiveBreakingNewsOverrides(category: Category, query: string) {
  if (category !== 'general' || query.trim()) {
    return [] as NewsArticle[];
  }

  return BREAKING_NEWS_OVERRIDES.filter(
    (override) =>
      override.category === category && Date.now() < Date.parse(override.expiresAt)
  ).map((override) => override.article);
}

function applyBreakingNewsOverrides(
  articles: NewsArticle[],
  category: Category,
  query: string
) {
  return getActiveBreakingNewsOverrides(category, query).reduceRight(
    (result, article) => prependUniqueArticle(result, article),
    articles
  );
}

function getTopScoreLabel(scores: Record<string, number>, fallback: string) {
  const [topEntry] = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return topEntry?.[0]?.replace(/-/g, ' ') ?? fallback;
}

function matchesDeskFilters(
  article: NewsArticle,
  focusedTopic: TopicFocus,
  readTimeFilter: DeskReadTimeFilter,
  sourceFilter: DeskSourceFilter,
  insight: ReturnType<typeof buildArticleInsight>
) {
  if (!matchesSourceFilter(insight.trust, sourceFilter)) {
    return false;
  }

  if (!matchesReadTimeFilter(insight.readTimeMinutes, readTimeFilter)) {
    return false;
  }

  if (!focusedTopic) {
    return true;
  }

  const normalizedFocus = normalizeSignalText(focusedTopic);

  return (
    articleMatchesTopic(article, focusedTopic) ||
    insight.entities.some((entity) => normalizeSignalText(entity).includes(normalizedFocus)) ||
    normalizeSignalText(insight.impactLabel).includes(normalizedFocus) ||
    normalizeSignalText(article.source.name).includes(normalizedFocus)
  );
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('sk-SK', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatLongDate(value: string) {
  return new Date(value).toLocaleDateString('sk-SK', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function shortenLocationLabel(value?: string | null) {
  if (!value) {
    return '';
  }

  const [primaryPart] = value.split(',');
  const normalized = primaryPart
    .replace(/^okres\s+/i, '')
    .replace(/^mesto\s+/i, '')
    .replace(/^obec\s+/i, '')
    .trim();

  return normalized || primaryPart.trim() || value.trim();
}

function toCompactLocalEditionSummary(summary: LocalEditionSummary | null) {
  if (!summary) {
    return null;
  }

  return {
    ...summary,
    label: shortenLocationLabel(summary.label),
  };
}

interface FeedLeadStoryProps {
  article: NewsArticle;
  insight?: ReturnType<typeof buildArticleInsight>;
  onSelect: (article: NewsArticle) => void;
}

function FeedLeadStory({ article, insight, onSelect }: FeedLeadStoryProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(article.urlToImage) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [article.urlToImage]);

  return (
    <button
      type="button"
      onClick={() => onSelect(article)}
      className="group news-card-shadow news-pressable grid w-full overflow-hidden rounded-[14px] border border-slate-200/80 bg-white text-left sm:rounded-lg lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.95fr)]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 sm:min-h-[280px] lg:aspect-auto lg:min-h-[440px]">
        {showImage ? (
          <img
            src={article.urlToImage}
            alt={article.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025]"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-400">
            <Newspaper className="h-10 w-10" strokeWidth={1.5} />
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-center justify-start px-2.5 py-2.5 sm:px-5 sm:py-5">
          <span className="rounded-full bg-red-600 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_8px_18px_-12px_rgba(220,38,38,0.9)] sm:px-3 sm:py-1 sm:text-[11px]">
            BREAKING NEWS
          </span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-slate-950/4 to-transparent" />
      </div>

      <div className="flex flex-col justify-between p-3 sm:p-8">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 sm:mb-4 sm:gap-3 sm:text-xs">
            <span className="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 sm:px-3 sm:py-1.5">
              {formatLongDate(article.publishedAt)}
            </span>
            <SourceBadge article={article} className="max-w-[60%]" />
          </div>

          {insight ? (
            <div className="mb-2.5">
              <ArticleInsightChips compact insight={insight} />
            </div>
          ) : null}

          <h3 className="max-w-3xl font-display text-[18px] leading-tight text-slate-950 sm:text-[42px]">
            {article.title}
          </h3>
          <p className="mt-2 line-clamp-2 max-w-2xl text-[13px] leading-5 text-slate-600 sm:mt-5 sm:line-clamp-none sm:text-base sm:leading-7">
            {article.description}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 sm:mt-8 sm:pt-5">
          <span className="text-xs font-medium text-slate-900 sm:text-sm">Otvoriť článok</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 sm:text-xs sm:tracking-[0.18em]">
            Hlavný výber
          </span>
        </div>
      </div>
    </button>
  );
}

interface BriefingItemProps {
  article: NewsArticle;
  onSelect: (article: NewsArticle) => void;
}

function BriefingItem({ article, onSelect }: BriefingItemProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(article.urlToImage) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [article.urlToImage]);

  return (
    <button
      type="button"
      onClick={() => onSelect(article)}
      className="group news-pressable news-soft-shadow grid w-full grid-cols-[64px_minmax(0,1fr)] gap-2 rounded-lg border border-slate-200/70 bg-slate-50/65 p-1 text-left hover:border-slate-300 hover:bg-white sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-4 sm:p-2"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-slate-100">
        {showImage ? (
          <img
            src={article.urlToImage}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Newspaper className="h-5 w-5" strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="min-w-0 py-0.5 sm:py-1">
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:gap-2 sm:text-[11px] sm:tracking-[0.14em]">
          <span>{formatShortDate(article.publishedAt)}</span>
          <SourceBadge article={article} className="max-w-[70%]" />
        </div>
        <h4 className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-slate-950 sm:mt-2 sm:line-clamp-3 sm:text-[15px] sm:leading-6">
          {article.title}
        </h4>
      </div>
    </button>
  );
}

interface EditorialPanelProps {
  briefing: EditorialBriefing;
  localEdition: LocalEditionSummary | null;
}

interface LocationSetupCardProps {
  error: string | null;
  isLoading: boolean;
  onEnable: () => void;
  onOpenSettings: () => void;
}

function LocationSetupCard({
  error,
  isLoading,
  onEnable,
  onOpenSettings,
}: LocationSetupCardProps) {
  return (
    <section className="news-card-shadow overflow-hidden rounded-[20px] border border-sky-200/80 bg-[linear-gradient(135deg,rgba(240,249,255,0.96)_0%,rgba(236,253,245,0.88)_100%)] p-4 sm:rounded-[24px] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-sky-700">
            <Navigation className="h-3.5 w-3.5" />
            Presná poloha
          </span>
          <h3 className="mt-3 text-lg font-semibold leading-tight text-slate-950 sm:mt-4 sm:text-2xl">
            Počasie a lokálne správy podľa miesta
          </h3>
          <p className="mt-2 text-[13px] leading-5 text-slate-600 sm:text-[15px] sm:leading-6">
            Jedným klikom nastavíme polohu, počasie aj lokálny feed bez ručného
            vyberania regiónu.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[220px]">
          <button
            type="button"
            onClick={onEnable}
            disabled={isLoading}
            className="news-pressable inline-flex h-10 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.9)] hover:bg-slate-800 disabled:cursor-wait disabled:scale-100 disabled:bg-slate-400 sm:h-11"
          >
            {isLoading ? 'Načítavam polohu' : 'Použiť moju polohu'}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="news-pressable inline-flex h-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 px-4 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-white"
          >
            Otvoriť nastavenia
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
    </section>
  );
}

function EditorialPanel({ briefing, localEdition }: EditorialPanelProps) {
  return (
    <section className="news-card-shadow rounded-lg border border-slate-200/80 bg-white p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:gap-2.5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-sky-700 sm:text-xs sm:tracking-[0.18em]">
            {briefing.kicker}
          </p>
          <h3 className="mt-1 text-base font-semibold leading-tight text-slate-950 sm:text-xl">
            {briefing.headline}
          </h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-600 sm:text-sm sm:leading-5">
            {briefing.summary}
          </p>
        </div>

        {localEdition ? (
          <div className="news-soft-shadow min-w-0 rounded-md border border-sky-100 bg-sky-50/70 px-3 py-2 sm:rounded-lg lg:min-w-[200px]">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-sky-700 sm:text-[11px] sm:tracking-[0.16em]">
              {localEdition.badge}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-slate-950">
              {localEdition.label}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-600">
              {localEdition.description}
            </p>
          </div>
        ) : null}
      </div>

      <div className="hidden">
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-4 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
            Prečo to riešiť
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {briefing.whyItMatters}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Hlavné témy
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {briefing.topTopics.length > 0 ? (
                briefing.topTopics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[13px] text-slate-700"
                  >
                    {topic}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">
                  Témy sa doplnia podľa aktuálneho mixu.
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Sledované
            </p>
            <div className="mt-2.5 space-y-1.5">
              {briefing.watchlist.map((item) => (
                <div key={item} className="line-clamp-2 text-sm leading-5 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function buildFeedMeta(category: Category, searchQuery: string) {
  if (searchQuery) {
    return {
      kicker: 'Vyhľadávanie',
      title: `Výsledky pre „${searchQuery}“`,
      description:
        'Prehľad článkov z viacerých zdrojov doplnený o základný kontext a čitateľný brífing.',
    };
  }

  return categoryMeta[category];
}

function buildActiveFeedMeta(category: Category, searchQuery: string, feedView: FeedView) {
  if (feedView === 'for-you' && !searchQuery) {
    return {
      kicker: 'Personalizovaný výber',
      title: 'Pre teba',
      description:
        'Články zoradené podľa toho, čo otváraš, ukladáš a označuješ ako dôležité.',
    };
  }

  if (feedView === 'saved') {
    return {
      kicker: 'Uložené články',
      title: 'Čítaj neskôr',
      description:
        'Tvoj súkromný zoznam článkov v tomto prehliadači bez účtu a bez predplatného.',
    };
  }

  return buildFeedMeta(category, searchQuery);
}

interface FeedViewTabsProps {
  activeView: FeedView;
  onViewChange: (view: FeedView) => void;
  savedCount: number;
}

function FeedViewTabs({ activeView, onViewChange, savedCount }: FeedViewTabsProps) {
  return (
    <div
      className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg border border-slate-200/80 bg-white/80 p-1 sm:gap-2"
      role="tablist"
      aria-label="Výber feedu"
    >
      {feedViewOptions.map((option) => {
        const Icon = option.icon;
        const isActive = activeView === option.id;

        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onViewChange(option.id)}
            className={cn(
              'news-pressable inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium sm:h-10 sm:gap-2 sm:px-3.5 sm:text-sm',
              isActive
                ? 'bg-slate-950 text-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.9)]'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
            )}
          >
            <Icon className="h-4 w-4" />
            {option.label}
            {option.id === 'saved' && savedCount > 0 ? (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px]',
                  isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                )}
              >
                {savedCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

interface HabitPanelProps {
  activeView: FeedView;
  openedToday: number;
  onViewChange: (view: FeedView) => void;
  savedCount: number;
  topSource: string;
  topTopic: string;
}

function HabitPanel({
  activeView,
  openedToday,
  onViewChange,
  savedCount,
  topSource,
  topTopic,
}: HabitPanelProps) {
  const hour = new Date().getHours();
  const title =
    hour < 11
      ? 'Ranný briefing'
      : hour < 17
        ? 'Denný update'
        : 'Večerný súhrn';

  return (
    <section className="news-card-shadow rounded-lg border border-slate-200/80 bg-white p-3 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500 sm:text-xs sm:tracking-[0.16em]">
            Baky loop
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">
            {title}
          </h3>
          <p className="mt-2 hidden text-sm leading-6 text-slate-500 sm:block">
            Otvor pár správ a feed sa začne skladať podľa tvojho rytmu.
          </p>
        </div>
        <Sparkles className="h-4 w-4 text-sky-700" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-2.5">
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 sm:px-3 sm:py-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-[11px] sm:tracking-[0.14em]">
            Dnes otvorené
          </div>
          <div className="mt-0.5 text-lg font-semibold text-slate-950 sm:mt-1 sm:text-xl">
            {openedToday}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 sm:px-3 sm:py-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-[11px] sm:tracking-[0.14em]">
            Uložené
          </div>
          <div className="mt-0.5 text-lg font-semibold text-slate-950 sm:mt-1 sm:text-xl">
            {savedCount}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-xs leading-5 text-slate-600 sm:mt-4 sm:space-y-2 sm:text-sm sm:leading-6">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-slate-400" />
          <span className="line-clamp-1">Téma: {topTopic}</span>
        </div>
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-slate-400" />
          <span className="line-clamp-1">Zdroj: {topSource}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4">
        <button
          type="button"
          onClick={() => onViewChange('for-you')}
          className={cn(
            'news-pressable inline-flex h-9 items-center justify-center rounded-full border px-3 text-sm font-medium sm:h-10',
            activeView === 'for-you'
              ? 'border-slate-950 bg-slate-950 text-white'
              : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300'
          )}
        >
          Pre teba
        </button>
        <button
          type="button"
          onClick={() => onViewChange('saved')}
          className={cn(
            'news-pressable inline-flex h-9 items-center justify-center rounded-full border px-3 text-sm font-medium sm:h-10',
            activeView === 'saved'
              ? 'border-slate-950 bg-slate-950 text-white'
              : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300'
          )}
        >
          Uložené
        </button>
      </div>
    </section>
  );
}

export default function App() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [editorial, setEditorial] = useState<EditorialBriefing | null>(null);
  const [localEditionSummary, setLocalEditionSummary] =
    useState<LocalEditionSummary | null>(null);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [commodityMarket, setCommodityMarket] = useState<CommodityMarketSnapshot | null>(null);
  const [isCommodityMarketLoading, setIsCommodityMarketLoading] = useState(false);
  const [isCommodityMarketRefreshing, setIsCommodityMarketRefreshing] = useState(false);
  const [commodityMarketRefreshedAt, setCommodityMarketRefreshedAt] = useState<string | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(() => !document.hidden);
  const [wikiSummary, setWikiSummary] = useState<WikiSummary | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [category, setCategory] = useState<Category>('general');
  const [feedSettings, setFeedSettings] = useState<FeedSettings>(readStoredFeedSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [locationActionError, setLocationActionError] = useState<string | null>(null);
  const [visibleArticlesCount, setVisibleArticlesCount] = useState(12);
  const [signalMode, setSignalMode] = useState(false);
  const [feedView, setFeedView] = useState<FeedView>('top');
  const [digestMode, setDigestMode] = useState<DeskDigestMode>('feed');
  const [sourceFilter, setSourceFilter] = useState<DeskSourceFilter>('all');
  const [readTimeFilter, setReadTimeFilter] = useState<DeskReadTimeFilter>('all');
  const [focusedTopic, setFocusedTopic] = useState<TopicFocus>(null);
  const [savedSearches, setSavedSearches] = useState<string[]>(() =>
    readStoredStringList(SAVED_SEARCHES_STORAGE_KEY)
  );
  const [activeWatchlistIds, setActiveWatchlistIds] = useState<string[]>(() =>
    readStoredStringList(WATCHLIST_STORAGE_KEY).filter((watchlistId) =>
      DESK_WATCHLISTS.some((watchlist) => watchlist.id === watchlistId)
    )
  );
  const [engagement, setEngagement] = useState<EngagementState>(
    readStoredEngagementState
  );
  const controllerRef = useRef<AbortController | null>(null);
  const weatherControllerRef = useRef<AbortController | null>(null);
  const commodityMarketControllerRef = useRef<AbortController | null>(null);
  const commodityMarketRef = useRef<CommodityMarketSnapshot | null>(commodityMarket);
  const isLoadingRef = useRef(isLoading);
  const selectedArticleRef = useRef<NewsArticle | null>(selectedArticle);

  const filteredArticles = useMemo(() => {
    if (!signalMode) {
      return articles;
    }

    return articles.filter((article) => {
      const tabloidKeywords = ['šok', 'neuveríte', 'brutálne', 'odpadnete', 'video:', 'foto:'];
      const title = article.title.toLowerCase();
      const hasTabloidKeyword = tabloidKeywords.some((word) => title.includes(word));

      const lowTierSources = ['bulvar', 'topky'];
      const isLowTier = lowTierSources.some((source) =>
        article.source.name.toLowerCase().includes(source)
      );

      return !hasTabloidKeyword && !isLowTier;
    });
  }, [articles, signalMode]);

  const articleInsights = useMemo(
    () =>
      Object.fromEntries(
        articles.map((article) => [
          article.url,
          buildArticleInsight(article, feedSettings, activeWatchlistIds),
        ])
      ) as Record<string, ReturnType<typeof buildArticleInsight>>,
    [activeWatchlistIds, articles, feedSettings]
  );

  const deskFilteredArticles = useMemo(
    () =>
      filteredArticles.filter((article) =>
        matchesDeskFilters(
          article,
          focusedTopic,
          readTimeFilter,
          sourceFilter,
          articleInsights[article.url]
        )
      ),
    [articleInsights, filteredArticles, focusedTopic, readTimeFilter, sourceFilter]
  );

  const watchlistCounts = useMemo(
    () =>
      Object.fromEntries(
        DESK_WATCHLISTS.map((watchlist) => [
          watchlist.id,
          filteredArticles.filter((article) => articleMatchesWatchlist(article, watchlist.id))
            .length,
        ])
      ) as Record<string, number>,
    [filteredArticles]
  );

  const rankedTopArticles = useMemo(
    () => prioritizeWatchlists(deskFilteredArticles, activeWatchlistIds),
    [activeWatchlistIds, deskFilteredArticles]
  );

  const forYouArticles = useMemo(
    () => rankForYouArticles(rankedTopArticles, engagement, feedSettings),
    [engagement, feedSettings, rankedTopArticles]
  );

  const savedArticles = useMemo(
    () =>
      Object.keys(engagement.savedArticles)
        .map((url) => engagement.savedArticles[url])
        .filter((article) =>
          matchesDeskFilters(
            article,
            focusedTopic,
            readTimeFilter,
            sourceFilter,
            buildArticleInsight(article, feedSettings, activeWatchlistIds)
          )
        )
        .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)),
    [
      activeWatchlistIds,
      engagement.savedArticles,
      feedSettings,
      focusedTopic,
      readTimeFilter,
      sourceFilter,
    ]
  );

  const activeArticles = useMemo(() => {
    if (feedView === 'for-you') {
      return forYouArticles;
    }

    if (feedView === 'saved') {
      return savedArticles;
    }

    return rankedTopArticles;
  }, [feedView, forYouArticles, rankedTopArticles, savedArticles]);

  const savedArticleCount = savedArticles.length;
  const openedTodayCount = getTodayOpenedCount(engagement);
  const topSourceLabel = getTopScoreLabel(engagement.sourceScores, 'mix zdrojov');
  const topTopicLabel = getTopScoreLabel(engagement.topicScores, 'aktuálne správy');
  const executiveBrief = useMemo(
    () =>
      buildExecutiveBrief(
        activeArticles.length > 0 ? activeArticles : rankedTopArticles,
        feedSettings,
        editorial,
        activeWatchlistIds
      ),
    [activeArticles, activeWatchlistIds, editorial, feedSettings, rankedTopArticles]
  );
  const radarSnapshot = useMemo(
    () => buildRadarSnapshot(deskFilteredArticles, feedSettings, activeWatchlistIds),
    [activeWatchlistIds, deskFilteredArticles, feedSettings]
  );

  useEffect(() => {
    window.localStorage.setItem(FEED_SETTINGS_STORAGE_KEY, JSON.stringify(feedSettings));
  }, [feedSettings]);

  useEffect(() => {
    window.localStorage.setItem(ENGAGEMENT_STORAGE_KEY, JSON.stringify(engagement));
  }, [engagement]);

  useEffect(() => {
    window.localStorage.setItem(
      SAVED_SEARCHES_STORAGE_KEY,
      JSON.stringify(savedSearches)
    );
  }, [savedSearches]);

  useEffect(() => {
    window.localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify(activeWatchlistIds)
    );
  }, [activeWatchlistIds]);

  useEffect(() => {
    if (feedSettings.useLocation) {
      setLocationActionError(null);
    }
  }, [feedSettings.useLocation]);

  useEffect(() => {
    setFocusedTopic(null);
  }, [category, searchQuery]);

  useEffect(() => {
    commodityMarketRef.current = commodityMarket;
  }, [commodityMarket]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };

    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const loadData = useCallback(
    async (nextCategory: Category, query: string = '', refresh: boolean = false) => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }

      const controller = new AbortController();
      controllerRef.current = controller;

      if (!refresh) {
        setIsLoading(true);
        setArticles([]);
        setEditorial(null);
        setLocalEditionSummary(null);
        setVisibleArticlesCount(12);
        setWikiSummary(null);
      }

      setError(null);

      try {
        const newsPromise = fetchNews(
          nextCategory,
          query,
          feedSettings,
          refresh,
          controller.signal
        );
        const wikiPromise = query
          ? fetchWikiSummary(query, feedSettings.language, controller.signal).catch(() => null)
          : Promise.resolve(null);

        const newsData = await newsPromise;
        if (controller.signal.aborted) {
          return;
        }

        setArticles(applyBreakingNewsOverrides(newsData.articles, nextCategory, query));
        setEditorial(newsData.editorial);
        setLocalEditionSummary(toCompactLocalEditionSummary(newsData.localEdition));
        setLastUpdated(new Date());
        setIsLoading(false);

        const wikiData = await wikiPromise;
        if (!controller.signal.aborted) {
          setWikiSummary(wikiData);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError' && !refresh) {
          setError('Nepodarilo sa načítať správy. Skúste to znova o chvíľu.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [feedSettings]
  );

  useEffect(() => {
    loadData(category, searchQuery);
  }, [category, searchQuery, loadData]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    if (weatherControllerRef.current) {
      weatherControllerRef.current.abort();
    }

    const controller = new AbortController();
    weatherControllerRef.current = controller;
    setIsWeatherLoading(true);

    void fetchWeather(feedSettings, controller.signal)
      .then((nextWeather) => {
        if (!controller.signal.aborted) {
          setWeather(nextWeather);
        }
      })
      .catch((error: any) => {
        if (error?.name !== 'AbortError') {
          setWeather(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsWeatherLoading(false);
        }
      });
  }, [feedSettings]);

  const loadCommodityMarkets = useCallback(async (refresh: boolean = false) => {
    if (commodityMarketControllerRef.current) {
      commodityMarketControllerRef.current.abort();
    }

    const controller = new AbortController();
    commodityMarketControllerRef.current = controller;
    const hasExistingMarket = Boolean(commodityMarketRef.current);

    if (!refresh || !hasExistingMarket) {
      setIsCommodityMarketLoading(true);
    } else {
      setIsCommodityMarketRefreshing(true);
    }

    try {
      const nextMarket = await fetchCommodityMarkets(controller.signal);
      if (!controller.signal.aborted) {
        setCommodityMarket(nextMarket);
        setCommodityMarketRefreshedAt(new Date().toISOString());
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError' && !controller.signal.aborted && !refresh) {
        setCommodityMarket(null);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsCommodityMarketLoading(false);
        setIsCommodityMarketRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (category !== 'business') {
      if (commodityMarketControllerRef.current) {
        commodityMarketControllerRef.current.abort();
      }
      setIsCommodityMarketLoading(false);
      setIsCommodityMarketRefreshing(false);
      return;
    }

    void loadCommodityMarkets(false);
  }, [category, loadCommodityMarkets]);

  useEffect(() => {
    if (category !== 'business' || !isPageVisible) {
      return;
    }

    if (commodityMarketRef.current) {
      void loadCommodityMarkets(true);
    }

    const interval = setInterval(() => {
      if (!selectedArticleRef.current) {
        void loadCommodityMarkets(true);
      }
    }, 60_000);

    return () => {
      clearInterval(interval);
    };
  }, [category, isPageVisible, loadCommodityMarkets]);

  useEffect(() => {
    selectedArticleRef.current = selectedArticle;
  }, [selectedArticle]);

  useEffect(() => {
    setVisibleArticlesCount(12);
  }, [category, feedView, searchQuery, signalMode]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden && !isLoadingRef.current && !selectedArticleRef.current) {
        loadData(category, searchQuery, true);
      }
    }, feedSettings.autoRefreshMinutes * 60_000);

    return () => {
      clearInterval(interval);
    };
  }, [category, searchQuery, feedSettings.autoRefreshMinutes, loadData]);

  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      if (weatherControllerRef.current) {
        weatherControllerRef.current.abort();
      }
      if (commodityMarketControllerRef.current) {
        commodityMarketControllerRef.current.abort();
      }
    };
  }, []);

  const resetSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setFocusedTopic(null);
  };

  const runSearchQuery = (query: string) => {
    const nextQuery = query.trim();
    setCategory('general');
    setFeedView('top');
    setDigestMode('briefing');
    setFocusedTopic(null);
    setSearchQuery(nextQuery);
  };

  const handleSearch = () => {
    runSearchQuery(searchInput);
  };

  const handleRefresh = () => {
    loadData(category, searchQuery, true);
  };

  const handleEnableLocation = async () => {
    setLocationActionError(null);

    if (!supportsGeolocation()) {
      setLocationActionError('Tento prehliadač nepodporuje polohu.');
      return;
    }

    setIsResolvingLocation(true);
    try {
      const location = await resolveCurrentLocationPreference();
      setFeedSettings((current) => withDetectedLocation(current, location));
    } catch {
      setLocationActionError('Poloha nebola povolená alebo sa ju nepodarilo načítať.');
    } finally {
      setIsResolvingLocation(false);
    }
  };

  const handleSaveCurrentSearch = () => {
    const nextQuery = (searchQuery || searchInput).trim();
    if (!nextQuery) {
      return;
    }

    setSavedSearches((current) =>
      [nextQuery, ...current.filter((query) => query !== nextQuery)].slice(0, 8)
    );
  };

  const handleRunSavedSearch = (query: string) => {
    setSearchInput(query);
    runSearchQuery(query);
  };

  const handleRemoveSavedSearch = (query: string) => {
    setSavedSearches((current) => current.filter((item) => item !== query));
  };

  const handleToggleWatchlist = (watchlistId: string) => {
    setActiveWatchlistIds((current) =>
      current.includes(watchlistId)
        ? current.filter((item) => item !== watchlistId)
        : [...current, watchlistId]
    );
    setFeedView('top');
    setDigestMode('radar');
  };

  const handleFocusTopic = (topic: string) => {
    setFocusedTopic((current) => (current === topic ? null : topic));
    setFeedView('top');
    setDigestMode('radar');
  };

  const handleSelectArticle = useCallback((article: NewsArticle) => {
    setSelectedArticle(article);
    setEngagement((current) => {
      const keywords = getArticleKeywords(article);
      const sourceScores = { ...current.sourceScores };
      const topicScores = { ...current.topicScores };
      const openedArticle = current.opened[article.url];

      sourceScores[article.source.name] = (sourceScores[article.source.name] ?? 0) + 2;
      for (const keyword of keywords) {
        topicScores[keyword] = (topicScores[keyword] ?? 0) + 1;
      }

      return {
        ...current,
        opened: {
          ...current.opened,
          [article.url]: {
            count: (openedArticle?.count ?? 0) + 1,
            lastOpenedAt: new Date().toISOString(),
          },
        },
        sourceScores,
        topicScores,
      };
    });
  }, []);

  const handleToggleSaveArticle = useCallback((article: NewsArticle) => {
    setEngagement((current) => {
      const savedArticles = { ...current.savedArticles };
      const sourceScores = { ...current.sourceScores };
      const topicScores = { ...current.topicScores };

      if (savedArticles[article.url]) {
        delete savedArticles[article.url];
      } else {
        savedArticles[article.url] = article;
        sourceScores[article.source.name] = (sourceScores[article.source.name] ?? 0) + 1.5;
        for (const keyword of getArticleKeywords(article)) {
          topicScores[keyword] = (topicScores[keyword] ?? 0) + 0.75;
        }
      }

      return {
        ...current,
        savedArticles,
        sourceScores,
        topicScores,
      };
    });
  }, []);

  const handleReactArticle = useCallback(
    (article: NewsArticle, nextReaction: ArticleReaction) => {
      setEngagement((current) => {
        const reactions = { ...current.reactions };
        const sourceScores = { ...current.sourceScores };
        const topicScores = { ...current.topicScores };
        const isRemovingReaction = reactions[article.url] === nextReaction;

        if (isRemovingReaction) {
          delete reactions[article.url];
        } else {
          reactions[article.url] = nextReaction;
        }

        const weight = isRemovingReaction
          ? 0
          : nextReaction === 'important'
            ? 2
            : nextReaction === 'track'
              ? 1.25
              : -2;

        sourceScores[article.source.name] = (sourceScores[article.source.name] ?? 0) + weight;
        for (const keyword of getArticleKeywords(article)) {
          topicScores[keyword] = (topicScores[keyword] ?? 0) + weight;
        }

        return {
          ...current,
          reactions,
          sourceScores,
          topicScores,
        };
      });
    },
    []
  );

  const visibleArticles = activeArticles.slice(0, visibleArticlesCount);
  const leadArticle = digestMode === 'briefing' ? null : visibleArticles[0] ?? null;
  const briefingArticles =
    digestMode === 'briefing' ? visibleArticles.slice(0, 5) : visibleArticles.slice(1, 5);
  const gridArticles = visibleArticles.slice(5);
  const mobileGridArticles =
    digestMode === 'briefing' ? gridArticles : visibleArticles.slice(1);
  const remainingArticles = Math.max(activeArticles.length - visibleArticlesCount, 0);
  const relatedArticlePool =
    activeArticles.length > 1 ? activeArticles : deskFilteredArticles;
  const selectedRelatedArticles = useMemo(
    () =>
      selectedArticle ? getRelatedArticles(selectedArticle, relatedArticlePool) : [],
    [relatedArticlePool, selectedArticle]
  );
  const getInsightForArticle = (article: NewsArticle) =>
    articleInsights[article.url] ?? buildArticleInsight(article, feedSettings, activeWatchlistIds);
  const selectedArticleInsight = selectedArticle
    ? getInsightForArticle(selectedArticle)
    : null;
  const feedMeta = buildActiveFeedMeta(category, searchQuery, feedView);
  const compactLocationLabel = shortenLocationLabel(feedSettings.location?.label);
  const displayWeather = useMemo(
    () =>
      weather
        ? {
            ...weather,
            locationLabel: shortenLocationLabel(weather.locationLabel),
          }
        : null,
    [weather]
  );
  const settingsLabel = feedSettings.useLocation && feedSettings.location?.label
    ? `${feedSettings.language.toUpperCase()} / ${compactLocationLabel}`
    : `${feedSettings.language.toUpperCase()} / ${feedSettings.region}`;
  const shouldShowLocationSetup =
    !feedSettings.useLocation && !searchQuery && category === 'general';
  const shouldShowExecutiveBrief =
    digestMode !== 'feed' || activeWatchlistIds.length > 0 || searchQuery.length > 0;
  const shouldShowNationalOverview =
    category === 'general' && feedView === 'top' && !searchQuery;

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f4f5f7] text-slate-950">
      <header className="news-glass z-50 border-b border-slate-200/75 pt-[env(safe-area-inset-top)] sm:sticky sm:top-0">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-2.5 px-3 py-2.5 sm:flex-nowrap sm:gap-4 sm:px-6 sm:py-3.5 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:flex-none sm:gap-4">
            <Logo className="h-9 w-9 shrink-0 sm:h-14 sm:w-14" />
            <div className="min-w-0">
              <img
                src="/baky-news-wordmark.svg"
                alt="Baky News"
                className="h-7 w-auto max-w-[165px] shrink-0 object-contain sm:h-[2.85rem] sm:max-w-[248px] lg:h-[3rem] lg:max-w-[270px]"
              />
            </div>
          </div>

          <div className="order-3 min-w-0 basis-full sm:order-none sm:basis-auto sm:flex-1">
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              onSearch={handleSearch}
              onClear={resetSearch}
              isLoading={isLoading}
            />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Nastavenia feedu"
              className="news-card-shadow news-pressable inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 sm:h-11 sm:w-11"
              title={`Nastavenia feedu (${settingsLabel})`}
            >
              <Settings2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setSignalMode((value) => !value)}
              className={cn(
                'news-card-shadow news-pressable hidden items-center gap-2 rounded-full border px-4 py-2.5 text-sm md:inline-flex',
                signalMode
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
              )}
              title={
                signalMode
                  ? 'Vypnúť signálový režim a zobraziť všetky články'
                  : 'Zapnúť signálový režim a filtrovať clickbait'
              }
            >
              <ShieldCheck className="h-4 w-4" />
              Signál
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="news-card-shadow news-pressable inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-50 sm:h-11 sm:w-11"
              title="Obnoviť feed"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {feedSettings.useLocation && feedSettings.location?.label ? (
            <div className="order-4 basis-full sm:hidden">
              <div className="news-soft-shadow inline-flex max-w-full items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50/90 px-2.5 py-1.5 text-xs text-sky-800">
                <MapPinned className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{compactLocationLabel}</span>
                {category === 'general' && displayWeather ? (
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
                    {displayWeather.temperatureC}°
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-200/75 bg-white/72">
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-2 px-3 py-2.5 sm:no-scrollbar sm:gap-3 sm:overflow-x-auto sm:px-6 sm:py-3 lg:px-8">
            <button
              type="button"
              onClick={() => {
                setCategory('general');
                resetSearch();
              }}
              className="news-card-shadow news-pressable inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900 sm:h-10 sm:w-10"
              title="Domov"
            >
              <Home className="h-4 w-4" />
            </button>
            <CategoryFilter
              activeCategory={category}
              onCategoryChange={(nextCategory) => {
                setCategory(nextCategory);
                resetSearch();
              }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-3 py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:gap-10 sm:px-6 sm:py-8 sm:pb-8 lg:px-8">
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </motion.div>
        ) : null}

        {shouldShowLocationSetup && !isLoading ? (
          <LocationSetupCard
            error={locationActionError}
            isLoading={isResolvingLocation}
            onEnable={handleEnableLocation}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        ) : null}

        {isLoading ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
            <LoadingIndicator ariaLabel="Načítavam správy" />
            <div className="text-center">
              <p className="text-base font-medium text-slate-900">Načítavam správy</p>
              <p className="mt-1 text-sm text-slate-500">
                Zoraďujem správy a pripravujem brífing.
              </p>
            </div>
          </div>
        ) : activeArticles.length > 0 || feedView === 'saved' ? (
          <>
            <section className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6 2xl:grid-cols-[minmax(0,1fr)_340px] 2xl:gap-8">
              <div className="min-w-0 space-y-3 sm:space-y-6">
                <div className="flex flex-col gap-2 border-b border-slate-200/80 pb-3 sm:gap-3 sm:pb-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-3xl">
                    <h2 className="max-w-4xl font-display text-[22px] leading-tight text-slate-950 sm:text-4xl lg:text-[2.65rem]">
                      {feedMeta.title}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:gap-2 sm:text-xs">
                    <span className="hidden">
                      <Clock3 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      Aktualizované{' '}
                      {lastUpdated.toLocaleTimeString('sk-SK', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="hidden">
                      <Settings2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      {settingsLabel}
                    </span>
                  </div>
                </div>

                {shouldShowNationalOverview ? (
                  <NationalOverviewPanel
                    articles={activeArticles}
                    editorial={editorial}
                    insights={articleInsights}
                    locationLabel={compactLocationLabel}
                    onSelect={handleSelectArticle}
                    updatedAt={lastUpdated}
                  />
                ) : null}

                <div className="hidden sm:block">
                  <DeskSavedSearchesPanel
                    currentValue={searchInput || searchQuery}
                    onRemoveSearch={handleRemoveSavedSearch}
                    onRunSearch={handleRunSavedSearch}
                    onSaveCurrent={handleSaveCurrentSearch}
                    savedSearches={savedSearches}
                  />
                </div>

                {shouldShowExecutiveBrief ? (
                  <div className="hidden sm:block">
                    <ExecutiveBriefingPanel
                      brief={executiveBrief}
                      digestMode={digestMode}
                    />
                  </div>
                ) : null}

                <div className="hidden sm:block">
                  <DeskWatchlistPanel
                    activeIds={activeWatchlistIds}
                    counts={watchlistCounts}
                    onToggle={handleToggleWatchlist}
                    watchlists={DESK_WATCHLISTS}
                  />
                </div>

                <div className="flex items-start gap-2 sm:block">
                  <div className="min-w-0 flex-1">
                    <FeedViewTabs
                      activeView={feedView}
                      onViewChange={setFeedView}
                      savedCount={savedArticleCount}
                    />
                  </div>

                  <details className="group relative shrink-0 sm:hidden">
                    <summary className="news-card-shadow flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-700 [&::-webkit-details-marker]:hidden">
                      <SlidersHorizontal className="h-4 w-4" />
                    </summary>

                    <div className="news-card-shadow absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-1.5rem))] space-y-2 rounded-lg border border-slate-200/80 bg-slate-50/95 p-2 backdrop-blur">
                    <div className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-800">
                        <ShieldCheck className="h-4 w-4 text-sky-700" />
                        Signál
                      </span>
                      <button
                        type="button"
                        onClick={() => setSignalMode((value) => !value)}
                        className={cn(
                          'news-pressable inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors',
                          signalMode
                            ? 'border-slate-900 bg-slate-900'
                            : 'border-slate-300 bg-slate-200'
                        )}
                        aria-pressed={signalMode}
                        aria-label="Signálový režim"
                      >
                        <span
                          className={cn(
                            'mx-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                            signalMode && 'translate-x-4'
                          )}
                        />
                      </button>
                    </div>

                    <DeskRadarPanel
                      digestMode={digestMode}
                      focusedTopic={focusedTopic}
                      onClearTopic={() => setFocusedTopic(null)}
                      onDigestModeChange={setDigestMode}
                      onReadTimeFilterChange={setReadTimeFilter}
                      onSourceFilterChange={setSourceFilter}
                      onTopicSelect={handleFocusTopic}
                      radar={radarSnapshot}
                      readTimeFilter={readTimeFilter}
                      sourceFilter={sourceFilter}
                    />

                    <DeskWatchlistPanel
                      activeIds={activeWatchlistIds}
                      counts={watchlistCounts}
                      onToggle={handleToggleWatchlist}
                      watchlists={DESK_WATCHLISTS}
                    />

                    <DeskSavedSearchesPanel
                      currentValue={searchInput || searchQuery}
                      onRemoveSearch={handleRemoveSavedSearch}
                      onRunSearch={handleRunSavedSearch}
                      onSaveCurrent={handleSaveCurrentSearch}
                      savedSearches={savedSearches}
                    />
                    </div>
                  </details>
                </div>

                {category === 'general' ? (
                  <div className="lg:hidden">
                    <WeatherWidget
                      compact
                      isLoading={isWeatherLoading}
                      weather={displayWeather}
                    />
                  </div>
                ) : null}

                {category === 'business' ? (
                  <div className="lg:hidden">
                    <CommodityMarketWidget
                      isLoading={isCommodityMarketLoading}
                      isLive={category === 'business' && isPageVisible}
                      isRefreshing={isCommodityMarketRefreshing}
                      lastRefreshedAt={commodityMarketRefreshedAt}
                      market={commodityMarket}
                    />
                  </div>
                ) : null}

                {feedView !== 'saved' && editorial && !shouldShowNationalOverview ? (
                  <div className="hidden sm:block">
                    <EditorialPanel
                      briefing={editorial}
                      localEdition={localEditionSummary}
                    />
                  </div>
                ) : null}

                {digestMode === 'briefing' && briefingArticles.length > 0 ? (
                  <section className="news-card-shadow rounded-lg border border-slate-200/80 bg-white p-3 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500 sm:text-xs sm:tracking-[0.16em]">
                          Executive queue
                        </p>
                        <h3 className="mt-1 text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">
                          Briefing articles
                        </h3>
                      </div>
                      <Sparkles className="h-4 w-4 text-sky-700" />
                    </div>

                    <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                      {briefingArticles.map((article) => (
                        <div key={article.url}>
                          <BriefingItem
                            article={article}
                            onSelect={handleSelectArticle}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                ) : leadArticle ? (
                  <FeedLeadStory
                    article={leadArticle}
                    insight={getInsightForArticle(leadArticle)}
                    onSelect={handleSelectArticle}
                  />
                ) : null}

                <div className="hidden lg:block">
                  <section className="space-y-5">
                    <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                          Pokračovanie feedu
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-950">
                          Ďalšie správy
                        </h3>
                      </div>
                      <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        Overené zdroje a pokojný produktový prehľad
                      </span>
                    </div>

                    {feedView === 'saved' && activeArticles.length === 0 ? (
                      <div className="news-soft-shadow rounded-lg border border-slate-200/80 bg-white px-6 py-10 text-sm leading-6 text-slate-500">
                        Zatiaľ tu nie sú uložené články. Otvor článok a použi tlačidlo Uložiť,
                        potom sa ti tu zobrazí súkromný zoznam na čítanie neskôr.
                      </div>
                    ) : gridArticles.length > 0 ? (
                      <div className="grid gap-3.5 sm:gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {gridArticles.map((article, index) => (
                          <div key={article.url}>
                            <NewsCard
                              article={article}
                              index={index}
                              insight={getInsightForArticle(article)}
                              onSelect={handleSelectArticle}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-200/80 bg-white px-6 py-8 text-sm text-slate-500 shadow-sm">
                        Zatiaľ nie sú dostupné ďalšie články pre túto sekciu.
                      </div>
                    )}
                  </section>

                  {remainingArticles > 0 ? (
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={() => setVisibleArticlesCount((current) => current + 12)}
                        className="news-card-shadow news-pressable inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-5 py-3 text-sm font-medium text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                      >
                        Načítať ďalšie správy
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          +{Math.min(12, remainingArticles)}
                        </span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <aside className="hidden space-y-3 sm:space-y-5 lg:block">
                <DeskRadarPanel
                  digestMode={digestMode}
                  focusedTopic={focusedTopic}
                  onClearTopic={() => setFocusedTopic(null)}
                  onDigestModeChange={setDigestMode}
                  onReadTimeFilterChange={setReadTimeFilter}
                  onSourceFilterChange={setSourceFilter}
                  onTopicSelect={handleFocusTopic}
                  radar={radarSnapshot}
                  readTimeFilter={readTimeFilter}
                  sourceFilter={sourceFilter}
                />

                {category === 'business' ? (
                  <CommodityMarketWidget
                    isLoading={isCommodityMarketLoading}
                    isLive={category === 'business' && isPageVisible}
                    isRefreshing={isCommodityMarketRefreshing}
                    lastRefreshedAt={commodityMarketRefreshedAt}
                    market={commodityMarket}
                  />
                ) : null}

                {category === 'general' ? (
                  <WeatherWidget
                    isLoading={isWeatherLoading}
                    weather={displayWeather}
                  />
                ) : null}

                <HabitPanel
                  activeView={feedView}
                  openedToday={openedTodayCount}
                  onViewChange={setFeedView}
                  savedCount={savedArticleCount}
                  topSource={topSourceLabel}
                  topTopic={topTopicLabel}
                />

                {digestMode !== 'briefing' ? (
                <section className="news-card-shadow rounded-lg border border-slate-200/80 bg-white p-3 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500 sm:text-xs sm:tracking-[0.16em]">
                        Rýchly briefing
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">
                        Hlavné správy
                      </h3>
                    </div>
                    <Zap className="h-4 w-4 text-sky-700" />
                  </div>

                  <div className="mt-3 space-y-2 sm:mt-5 sm:space-y-4">
                    {briefingArticles.length > 0 ? (
                      briefingArticles.map((article) => (
                        <div key={article.url}>
                          <BriefingItem article={article} onSelect={handleSelectArticle} />
                        </div>
                      ))
                    ) : (
                      <p className="text-sm leading-6 text-slate-500">
                        Na tejto karte sa zobrazia ďalšie hlavné články z aktuálneho feedu.
                      </p>
                    )}
                  </div>
                </section>
                ) : null}

                <section className="news-soft-shadow rounded-lg border border-slate-200/80 bg-white/85 p-3 sm:p-5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500 sm:text-xs sm:tracking-[0.16em]">
                    Ovládanie feedu
                  </p>

                  <div className="mt-2.5 space-y-2.5 sm:mt-4 sm:space-y-4">
                    <div className="flex items-center justify-between gap-2.5 rounded-md border border-slate-200/70 bg-slate-50/70 px-2.5 py-2 sm:items-start sm:gap-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                      <div>
                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-950 sm:text-sm sm:normal-case sm:tracking-normal">
                          Signál<span className="hidden sm:inline">ový režim</span>
                        </h3>
                        <p className="mt-1 hidden text-sm leading-6 text-slate-500 sm:block">
                          Filtrovanie titulkov s bulvárnym tónom a slabších zdrojov.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSignalMode((value) => !value)}
                        className={cn(
                          'news-pressable inline-flex h-5 w-8 shrink-0 items-center rounded-full border transition-colors sm:h-7 sm:w-12',
                          signalMode
                            ? 'border-slate-900 bg-slate-900'
                            : 'border-slate-300 bg-slate-200'
                        )}
                        aria-pressed={signalMode}
                      >
                        <span
                          className={cn(
                            'mx-1 h-3 w-3 rounded-full bg-white shadow-sm transition-transform sm:h-5 sm:w-5',
                            signalMode && 'translate-x-3 sm:translate-x-5'
                          )}
                        />
                      </button>
                    </div>

                    {localEditionSummary ? (
                      <div className="rounded-lg border border-sky-100 bg-sky-50/80 px-4 py-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-sky-700">
                          {localEditionSummary.badge}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-950">
                          {localEditionSummary.label}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {localEditionSummary.description}
                        </p>
                      </div>
                    ) : null}

                    <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-1">
                      <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 sm:px-4 sm:py-3">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 sm:text-[11px] sm:tracking-[0.16em]">
                          Zobrazené
                        </div>
                        <div className="mt-0.5 text-base font-semibold text-slate-950 sm:mt-1 sm:text-lg">
                          {visibleArticles.length}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 sm:px-4 sm:py-3">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 sm:text-[11px] sm:tracking-[0.16em]">
                          Auto refresh
                        </div>
                        <div className="mt-0.5 text-base font-semibold text-slate-950 sm:mt-1 sm:text-lg">
                          {feedSettings.autoRefreshMinutes} min
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </aside>
            </section>

            <AnimatePresence mode="wait">
              {wikiSummary ? <WikiCard summary={wikiSummary} /> : null}
            </AnimatePresence>

            <section className="min-w-0 space-y-3 lg:hidden">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                <div>
                  <p className="hidden text-xs font-medium uppercase tracking-[0.16em] text-slate-500 sm:block">
                    Pokračovanie feedu
                  </p>
                  <h3 className="text-lg font-semibold text-slate-950 sm:mt-2 sm:text-2xl">
                    Ďalšie správy
                  </h3>
                </div>
                <span className="inline-flex items-center gap-2 text-xs text-slate-500 sm:text-sm">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="hidden sm:inline">Overené zdroje a pokojný produktový prehľad</span>
                  <span className="sm:hidden">Overené zdroje</span>
                </span>
              </div>

              {feedView === 'saved' && activeArticles.length === 0 ? (
                <div className="news-soft-shadow rounded-lg border border-slate-200/80 bg-white px-6 py-10 text-sm leading-6 text-slate-500">
                  Zatiaľ tu nie sú uložené články. Otvor článok a použi tlačidlo Uložiť,
                  potom sa ti tu zobrazí súkromný zoznam na čítanie neskôr.
                </div>
              ) : mobileGridArticles.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3">
                  {mobileGridArticles.map((article, index) => (
                    <div key={article.url}>
                      <NewsCard
                        article={article}
                        index={index}
                        insight={getInsightForArticle(article)}
                        onSelect={handleSelectArticle}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200/80 bg-white px-6 py-8 text-sm text-slate-500 shadow-sm">
                  Zatiaľ nie sú dostupné ďalšie články pre túto sekciu.
                </div>
              )}
            </section>

            {remainingArticles > 0 ? (
              <div className="flex justify-center pt-2 lg:hidden">
                <button
                  type="button"
                  id="load-more-btn"
                  onClick={() => setVisibleArticlesCount((current) => current + 12)}
                  className="news-card-shadow news-pressable inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-5 py-3 text-sm font-medium text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                >
                  Načítať ďalšie správy
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    +{Math.min(12, remainingArticles)}
                  </span>
                </button>
              </div>
            ) : null}
          </>
        ) : !error ? (
          <div className="news-card-shadow flex min-h-[55vh] flex-col items-center justify-center rounded-lg border border-slate-200/80 bg-white px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="mt-6 text-2xl font-semibold text-slate-950">
              Žiadne výsledky
            </h3>
            <p className="mt-3 max-w-md text-sm leading-7 text-slate-500">
              Skúste širší pojem, inú kategóriu alebo sa vráťte na hlavný feed.
            </p>
          </div>
        ) : null}
      </main>

      <ArticleModal
        article={selectedArticle}
        insight={selectedArticleInsight}
        isSaved={
          selectedArticle ? Boolean(engagement.savedArticles[selectedArticle.url]) : false
        }
        onClose={() => setSelectedArticle(null)}
        onReact={handleReactArticle}
        onSelectRelated={handleSelectArticle}
        onToggleSave={handleToggleSaveArticle}
        reaction={
          selectedArticle ? engagement.reactions[selectedArticle.url] ?? null : null
        }
        relatedArticles={selectedRelatedArticles}
      />
      <FeedSettingsModal
        isOpen={isSettingsOpen}
        settings={feedSettings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={setFeedSettings}
      />

      <footer className="border-t border-slate-200/80 bg-white/72 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-6 text-sm text-slate-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live feed aktívny
            </span>
            <span>Wikipedia kontext sa zobrazuje len pri vyhľadávaní.</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Editoriálny briefing + lokálna edícia</span>
            <span>© 2024 Baky News</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
