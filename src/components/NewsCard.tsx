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
      className="group news-card-shadow news-pressable grid h-full w-full grid-cols-[92px_minmax(0,1fr)] overflow-hidden rounded-lg border border-slate-200/80 bg-white text-left sm:flex sm:flex-col"
    >
      <div className="relative h-full min-h-[92px] overflow-hidden bg-slate-100 sm:min-h-0 sm:aspect-[4/3]">
        {showImage ? (
          <img
            src={article.urlToImage}
            alt={article.title}
            className="h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.03] sm:object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
            <PlaceholderIcon className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={1.5} />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/22 via-slate-950/6 to-transparent" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-[11px] sm:tracking-[0.14em]">
            {dateLabel}
          </span>
        </div>

        {insight ? (
          <div className="mt-1.5">
            <ArticleInsightChips compact insight={insight} />
          </div>
        ) : null}

        <h3 className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-5 text-slate-950 sm:mt-3 sm:line-clamp-3 sm:text-[21px] sm:leading-8">
          {article.title}
        </h3>

        <p className="mt-1 line-clamp-1 flex-1 text-xs leading-4 text-slate-600 sm:mt-3 sm:line-clamp-4 sm:text-sm sm:leading-7">
          {article.description}
        </p>

        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs sm:mt-5 sm:pt-4 sm:text-sm">
          <span className="font-medium text-slate-900">Čítať viac</span>
          <ExternalLink className="h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </button>
  );
}
