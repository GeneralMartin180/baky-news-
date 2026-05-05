import { useMemo, useState } from 'react';
import {
  ExternalLink,
  Globe,
  Info,
  Newspaper,
  Share2,
  TrendingUp,
  Tv,
} from 'lucide-react';

import { NewsArticle } from '../types';

interface NewsCardProps {
  article: NewsArticle;
  index: number;
  onSelect?: (article: NewsArticle) => void;
}

const placeholderIcons = [Newspaper, Globe, Info, TrendingUp, Tv, Share2];

function getPlaceholderIcon(title: string) {
  const iconIndex = title.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return placeholderIcons[iconIndex % placeholderIcons.length];
}

export function NewsCard({ article, index, onSelect }: NewsCardProps) {
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

  return (
    <button
      type="button"
      onClick={() => onSelect?.(article)}
      style={{ transitionDelay: `${Math.min(index, 5) * 14}ms` }}
      className="group news-card-shadow news-pressable flex h-full w-full flex-col overflow-hidden rounded-lg border border-slate-200/80 bg-white text-left"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
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
            <PlaceholderIcon className="h-10 w-10" strokeWidth={1.5} />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/22 via-slate-950/6 to-transparent" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
            {dateLabel}
          </span>
        </div>

        <h3 className="mt-3 line-clamp-3 text-[21px] font-semibold leading-8 tracking-tight text-slate-950">
          {article.title}
        </h3>

        <p className="mt-3 line-clamp-4 flex-1 text-sm leading-7 text-slate-600">
          {article.description}
        </p>

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
          <span className="font-medium text-slate-900">Čítať viac</span>
          <ExternalLink className="h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </button>
  );
}
