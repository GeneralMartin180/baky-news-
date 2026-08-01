import { Building2, Globe2, Landmark, MapPinned, Radio } from 'lucide-react';

import { articleMatchesWatchlist, DeskArticleInsight } from '../lib/news-intelligence';
import { EditorialBriefing, NewsArticle } from '../types';
import { SourceBadge } from './SourceBadge';

interface NationalOverviewPanelProps {
  articles: NewsArticle[];
  editorial: EditorialBriefing | null;
  insights: Record<string, DeskArticleInsight>;
  locationLabel?: string;
  onSelect: (article: NewsArticle) => void;
  updatedAt: Date;
}

interface OverviewLane {
  article: NewsArticle;
  icon: typeof Landmark;
  label: string;
}

function formatArticleTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  return isToday
    ? date.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('sk-SK', { day: 'numeric', month: 'short' });
}

function buildOverviewLanes(
  articles: NewsArticle[],
  insights: Record<string, DeskArticleInsight>,
  locationLabel?: string
) {
  const selected = new Set<string>();

  const take = (predicate: (article: NewsArticle) => boolean) => {
    const match = articles.find(
      (article) => !selected.has(article.url) && predicate(article)
    );
    const fallback = articles.find((article) => !selected.has(article.url));
    const article = match ?? fallback;

    if (article) {
      selected.add(article.url);
    }

    return article;
  };

  const candidates = [
    {
      article: take((article) => articleMatchesWatchlist(article, 'slovakia')),
      icon: Landmark,
      label: 'Slovensko',
    },
    {
      article: take((article) => insights[article.url]?.impact === 'local'),
      icon: MapPinned,
      label: locationLabel || 'Regióny',
    },
    {
      article: take((article) => articleMatchesWatchlist(article, 'markets')),
      icon: Building2,
      label: 'Ekonomika',
    },
    {
      article: take((article) => insights[article.url]?.impact === 'high'),
      icon: Globe2,
      label: 'Svet',
    },
  ];

  return candidates.filter(
    (candidate): candidate is OverviewLane => Boolean(candidate.article)
  );
}

export function NationalOverviewPanel({
  articles,
  editorial,
  insights,
  locationLabel,
  onSelect,
  updatedAt,
}: NationalOverviewPanelProps) {
  const lanes = buildOverviewLanes(articles, insights, locationLabel);

  if (lanes.length === 0) {
    return null;
  }

  return (
    <section className="news-card-shadow overflow-hidden rounded-lg border border-slate-200/80 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
            <Landmark className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-950 sm:text-base">Slovensko dnes</h3>
            <p className="truncate text-[10px] text-slate-500 sm:text-xs">
              Aktualizované {updatedAt.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold uppercase text-red-700 sm:px-2.5 sm:text-[11px]">
          <Radio className="h-3 w-3" />
          Naživo
        </span>
      </div>

      {editorial ? (
        <div className="border-b border-slate-200/80 bg-slate-50/75 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="text-[10px] font-medium uppercase text-sky-700">Hlavná línia dňa</div>
          <div className="mt-0.5 line-clamp-1 text-sm font-semibold text-slate-950 sm:text-base">
            {editorial.headline}
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-600 sm:text-sm">
            {editorial.summary}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-4">
        {lanes.map(({ article, icon: Icon, label }, index) => (
          <button
            key={`${label}-${article.url}`}
            type="button"
            onClick={() => onSelect(article)}
            className={`group news-pressable min-w-0 p-3 text-left hover:bg-slate-50 sm:p-4 ${
              index % 2 === 0 ? 'border-r border-slate-200/80' : ''
            } ${index < 2 ? 'border-b border-slate-200/80 sm:border-b-0' : ''} ${
              index > 0 ? 'sm:border-l sm:border-slate-200/80' : 'sm:border-r-0'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-slate-500 sm:text-[11px]">
              <Icon className="h-3.5 w-3.5 shrink-0 text-sky-700" />
              <span className="truncate">{label}</span>
            </div>
            <h4 className="mt-2 line-clamp-3 text-xs font-semibold leading-4 text-slate-950 group-hover:text-sky-800 sm:text-sm sm:leading-5">
              {article.title}
            </h4>
            <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
              <SourceBadge article={article} className="max-w-[72%]" />
              <span className="shrink-0 text-[9px] text-slate-400 sm:text-[10px]">
                {formatArticleTime(article.publishedAt)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
