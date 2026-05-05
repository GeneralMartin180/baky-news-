import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Clock3,
  Home,
  LayoutGrid,
  Loader2,
  MapPinned,
  Newspaper,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Zap,
} from 'lucide-react';

import {
  Category,
  EditorialBriefing,
  FeedSettings,
  LocalEditionSummary,
  NewsArticle,
  WeatherSnapshot,
  WikiSummary,
} from './types';
import { fetchNews, fetchWeather, fetchWikiSummary } from './services/api';
import { ArticleModal } from './components/ArticleModal';
import { CategoryFilter } from './components/CategoryFilter';
import { FeedSettingsModal } from './components/FeedSettingsModal';
import { Logo } from './components/Logo';
import { NewsCard } from './components/NewsCard';
import { SearchBar } from './components/SearchBar';
import { WeatherWidget } from './components/WeatherWidget';
import { WikiCard } from './components/WikiCard';
import { cn } from './lib/utils';

const FEED_SETTINGS_STORAGE_KEY = 'baky-news-feed-settings';
const DEFAULT_FEED_SETTINGS: FeedSettings = {
  language: 'sk',
  region: 'SK',
  autoRefreshMinutes: 1,
  localEdition: 'all',
};

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
  entertainment: {
    kicker: 'Kultúra a zábava',
    title: 'Popkultúrny výber',
    description:
      'Filmy, hudba, streamovanie a spoločenské dianie v čistej editoriálnej podobe.',
  },
  health: {
    kicker: 'Zdravie',
    title: 'Medicína a prevencia',
    description:
      'Zdravotné témy, prevencia a medicínske správy s dôrazom na použiteľný kontext.',
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

    return {
      language,
      region,
      autoRefreshMinutes,
      localEdition,
    };
  } catch {
    return DEFAULT_FEED_SETTINGS;
  }
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

interface FeedLeadStoryProps {
  article: NewsArticle;
  onSelect: (article: NewsArticle) => void;
}

function FeedLeadStory({ article, onSelect }: FeedLeadStoryProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(article)}
      className="group news-card-shadow news-pressable grid w-full overflow-hidden rounded-lg border border-slate-200/80 bg-white text-left lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.95fr)]"
    >
      <div className="relative min-h-[280px] overflow-hidden bg-slate-100 lg:min-h-[440px]">
        {article.urlToImage ? (
          <img
            src={article.urlToImage}
            alt={article.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-400">
            <Newspaper className="h-10 w-10" strokeWidth={1.5} />
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 py-5">
          <span className="rounded-full bg-slate-950/78 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white backdrop-blur-sm">
            Top story
          </span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-slate-950/4 to-transparent" />
      </div>

      <div className="flex flex-col justify-between p-6 sm:p-8">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1.5">
              {formatLongDate(article.publishedAt)}
            </span>
          </div>

          <h3 className="max-w-3xl font-display text-3xl leading-tight text-slate-950 sm:text-[42px]">
            {article.title}
          </h3>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            {article.description}
          </p>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
          <span className="text-sm font-medium text-slate-900">Otvoriť článok</span>
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
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
  return (
    <button
      type="button"
      onClick={() => onSelect(article)}
      className="group news-pressable news-soft-shadow grid w-full grid-cols-[112px_minmax(0,1fr)] gap-4 rounded-lg border border-slate-200/70 bg-slate-50/65 p-2 text-left hover:border-slate-300 hover:bg-white"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-slate-100">
        {article.urlToImage ? (
          <img
            src={article.urlToImage}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Newspaper className="h-5 w-5" strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="min-w-0 py-1">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
          <span>{formatShortDate(article.publishedAt)}</span>
        </div>
        <h4 className="mt-2 line-clamp-3 text-[15px] font-semibold leading-6 text-slate-950">
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

function EditorialPanel({ briefing, localEdition }: EditorialPanelProps) {
  return (
    <section className="news-card-shadow rounded-lg border border-slate-200/80 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-700">
            {briefing.kicker}
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
            {briefing.headline}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {briefing.summary}
          </p>
        </div>

        {localEdition ? (
          <div className="news-soft-shadow min-w-[220px] rounded-lg border border-sky-100 bg-sky-50/70 px-3.5 py-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-sky-700">
              {localEdition.badge}
            </div>
            <div className="mt-1 text-base font-semibold text-slate-950">
              {localEdition.label}
            </div>
            <p className="mt-1.5 text-sm leading-5 text-slate-600">
              {localEdition.description}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)]">
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
              Watchlist
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
        'Prehľad článkov z viacerých zdrojov doplnený o základný kontext a čitateľný briefing.',
    };
  }

  return categoryMeta[category];
}

export default function App() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [editorial, setEditorial] = useState<EditorialBriefing | null>(null);
  const [localEditionSummary, setLocalEditionSummary] =
    useState<LocalEditionSummary | null>(null);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [wikiSummary, setWikiSummary] = useState<WikiSummary | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [category, setCategory] = useState<Category>('general');
  const [feedSettings, setFeedSettings] = useState<FeedSettings>(readStoredFeedSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [visibleArticlesCount, setVisibleArticlesCount] = useState(12);
  const [signalMode, setSignalMode] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const weatherControllerRef = useRef<AbortController | null>(null);
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

  useEffect(() => {
    window.localStorage.setItem(FEED_SETTINGS_STORAGE_KEY, JSON.stringify(feedSettings));
  }, [feedSettings]);

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

        setArticles(newsData.articles);
        setEditorial(newsData.editorial);
        setLocalEditionSummary(newsData.localEdition);
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

  useEffect(() => {
    selectedArticleRef.current = selectedArticle;
  }, [selectedArticle]);

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
    };
  }, []);

  const resetSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  const handleSearch = () => {
    const nextQuery = searchInput.trim();
    setCategory('general');
    setSearchQuery(nextQuery);
  };

  const handleRefresh = () => {
    loadData(category, searchQuery, true);
  };

  const visibleArticles = filteredArticles.slice(0, visibleArticlesCount);
  const leadArticle = visibleArticles[0] ?? null;
  const briefingArticles = visibleArticles.slice(1, 5);
  const gridArticles = visibleArticles.slice(5);
  const remainingArticles = Math.max(filteredArticles.length - visibleArticlesCount, 0);
  const feedMeta = buildFeedMeta(category, searchQuery);
  const settingsLabel = `${feedSettings.language.toUpperCase()} / ${feedSettings.region}`;

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-slate-950">
      <header className="news-glass sticky top-0 z-50 border-b border-slate-200/75">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-4 px-4 py-4 sm:flex-nowrap sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-4 sm:flex-none">
            <Logo className="h-12 w-12 shrink-0 sm:h-14 sm:w-14" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">
                  Baky News
                </h1>
                <span className="news-soft-shadow hidden rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 sm:inline-flex">
                  Live
                </span>
              </div>
              <p className="hidden text-xs text-slate-500 sm:block">
                Rýchly, čistý a čitateľný prehľad správ.
              </p>
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

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Nastavenia feedu"
              className="news-card-shadow news-pressable inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
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
                  ? 'Vypnúť Signal Mode a zobraziť všetky články'
                  : 'Zapnúť Signal Mode a filtrovať clickbait'
              }
            >
              <ShieldCheck className="h-4 w-4" />
              Signal
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="news-card-shadow news-pressable inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-50"
              title="Obnoviť feed"
            >
              <RotateCcw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="border-t border-slate-200/75 bg-white/72">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => {
                setCategory('general');
                resetSearch();
              }}
              className="news-card-shadow news-pressable inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900"
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

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
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

        {isLoading ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-slate-700" />
            <div className="text-center">
              <p className="text-base font-medium text-slate-900">Načítavam správy</p>
              <p className="mt-1 text-sm text-slate-500">
                Zoraďujem feed a pripravujem briefing.
              </p>
            </div>
          </div>
        ) : filteredArticles.length > 0 ? (
          <>
            <section className="grid gap-8 xl:grid-cols-[minmax(0,1.52fr)_360px]">
              <div className="space-y-6">
                <div className="flex flex-col gap-5 border-b border-slate-200/80 pb-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-700">
                      {feedMeta.kicker}
                    </p>
                    <h2 className="mt-3 max-w-4xl font-display text-4xl leading-tight text-slate-950 sm:text-5xl">
                      {feedMeta.title}
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-[15px]">
                      {feedMeta.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="news-soft-shadow inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-slate-600">
                      <Clock3 className="h-3.5 w-3.5" />
                      Aktualizované{' '}
                      {lastUpdated.toLocaleTimeString('sk-SK', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="news-soft-shadow inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-slate-600">
                      <Settings2 className="h-3.5 w-3.5" />
                      {settingsLabel}
                    </span>
                    {localEditionSummary ? (
                      <span className="news-soft-shadow inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-sky-700">
                        <MapPinned className="h-3.5 w-3.5" />
                        {localEditionSummary.label}
                      </span>
                    ) : null}
                    <span className="news-soft-shadow inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-slate-600">
                      <LayoutGrid className="h-3.5 w-3.5" />
                      {filteredArticles.length} článkov
                    </span>
                  </div>
                </div>

                {editorial ? (
                  <EditorialPanel
                    briefing={editorial}
                    localEdition={localEditionSummary}
                  />
                ) : null}

                {leadArticle ? (
                  <FeedLeadStory article={leadArticle} onSelect={setSelectedArticle} />
                ) : null}
              </div>

              <aside className="space-y-5">
                <WeatherWidget
                  isLoading={isWeatherLoading}
                  weather={weather}
                />

                <section className="news-card-shadow rounded-lg border border-slate-200/80 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                        Rýchly briefing
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-950">
                        Top stories
                      </h3>
                    </div>
                    <Zap className="h-4 w-4 text-sky-700" />
                  </div>

                  <div className="mt-5 space-y-4">
                    {briefingArticles.length > 0 ? (
                      briefingArticles.map((article) => (
                        <div key={article.url}>
                          <BriefingItem article={article} onSelect={setSelectedArticle} />
                        </div>
                      ))
                    ) : (
                      <p className="text-sm leading-6 text-slate-500">
                        Na tejto karte sa zobrazia ďalšie hlavné články z aktuálneho feedu.
                      </p>
                    )}
                  </div>
                </section>

                <section className="news-soft-shadow rounded-lg border border-slate-200/80 bg-white/85 p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    Feed controls
                  </p>

                  <div className="mt-4 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950">Signal Mode</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          Filtrovanie titulkov s bulvárnym tónom a slabších zdrojov.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSignalMode((value) => !value)}
                        className={cn(
                          'news-pressable inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors',
                          signalMode
                            ? 'border-slate-900 bg-slate-900'
                            : 'border-slate-300 bg-slate-200'
                        )}
                        aria-pressed={signalMode}
                      >
                        <span
                          className={cn(
                            'mx-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                            signalMode && 'translate-x-5'
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

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          Zobrazené
                        </div>
                        <div className="mt-1 text-lg font-semibold text-slate-950">
                          {visibleArticles.length}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          Auto refresh
                        </div>
                        <div className="mt-1 text-lg font-semibold text-slate-950">
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

            <section className="space-y-5">
              <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    Pokračovanie feedu
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    Ďalšie správy
                  </h3>
                </div>
                <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Overené zdroje a pokojný produktový prehľad
                </span>
              </div>

              {gridArticles.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {gridArticles.map((article, index) => (
                    <div key={article.url}>
                      <NewsCard article={article} index={index} onSelect={setSelectedArticle} />
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
            <h3 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950">
              Žiadne výsledky
            </h3>
            <p className="mt-3 max-w-md text-sm leading-7 text-slate-500">
              Skúste širší pojem, inú kategóriu alebo sa vráťte na hlavný feed.
            </p>
          </div>
        ) : null}
      </main>

      <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      <FeedSettingsModal
        isOpen={isSettingsOpen}
        settings={feedSettings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={setFeedSettings}
      />

      <footer className="border-t border-slate-200/80 bg-white/72">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 text-sm text-slate-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live feed aktívny
            </span>
            <span>Wikipedia kontext sa zobrazuje len pri vyhľadávaní.</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Editoriálny briefing + lokálna edícia</span>
            <span>© 2024 Baky News</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
