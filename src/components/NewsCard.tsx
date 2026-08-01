import { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  Globe,
  Info,
  Newspaper,
  Share2,
  TrendingUp,
  Tv,
} from 'lucide-react';

import { ArticleInsightChips } from './ArticleInsightChips';
import { SourceBadge } from './SourceBadge';
import { DeskArticleInsight } from '../lib/news-intelligence';
import { NewsArticle } from '../types';

interface NewsCardProps {
  article: NewsArticle;
  index: number;
  insight?: DeskArticleInsight;
  onSelect?: (article: NewsArticle) => void;
}

const placeholderIcons = [Newspaper, Globe, Info, TrendingUp, Tv, Share2];

function getPlaceholderIcon(title: string) {
  const iconIndex = title.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return placeholderIcons[iconIndex % placeholderIcons.length];
}

export function NewsCard({ article, index, insight, onSelect }: NewsCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const dateLabel = useMemo(
    () =>
      new Date(article.publishedAt).toLocaleDateString('sk-SK', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [article.publishedAt]
  );

  const PlaceholderIcon = getPlaceholderIcon(article.title);
  const showImage = Boolean(article.urlToImage) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [article.urlToImage]);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(article)}
      style={{ transitionDelay: `${Math.min(index, 5) * 14}ms` }}
      className="group news-card-shadow news-pressable flex h-full w-full flex-col overflow-hidden rounded-lg border border-slate-200/80 bg-white text-left"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {showImage ? (
          <img
            src={article.urlToImage}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
            <PlaceholderIcon className="h-8 w-8 md:h-10 md:w-10" strokeWidth={1.5} />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/22 via-slate-950/6 to-transparent" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-2 sm:p-3 lg:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-slate-500 md:text-[11px] md:tracking-[0.14em]">
            {dateLabel}
          </span>
          <SourceBadge article={article} className="max-w-[58%]" />
        </div>

        {insight ? (
          <div className="mt-1 hidden md:block">
            <ArticleInsightChips compact insight={insight} />
          </div>
        ) : null}

        <h3 className="mt-1 line-clamp-3 text-[12px] font-semibold leading-[1.35] text-slate-950 sm:text-[15px] sm:leading-5 lg:mt-2 lg:text-[18px] lg:leading-6">
          {article.title}
        </h3>

        <p className="mt-2 hidden flex-1 text-[13px] leading-5 text-slate-600 md:line-clamp-3">
          {article.description}
        </p>

        <div className="mt-4 hidden items-center justify-between border-t border-slate-100 pt-3 text-sm lg:flex">
          <span className="font-medium text-slate-900">Čítať viac</span>
          <ExternalLink className="h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </button>
  );
}
