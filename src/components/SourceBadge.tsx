import { useEffect, useMemo, useState } from 'react';
import { Building2, Flame, Gem, Wheat } from 'lucide-react';

import { NewsArticle } from '../types';
import { cn } from '../lib/utils';

interface SourceBadgeProps {
  article: NewsArticle;
  className?: string;
}

function getFallbackIcon(article: NewsArticle) {
  const text = `${article.title} ${article.source.name}`.toLowerCase();
  if (text.includes('oil') || text.includes('ropa') || text.includes('olej') || text.includes('wti') || text.includes('brent')) {
    return Flame;
  }
  if (text.includes('gold') || text.includes('zlato') || text.includes('silver') || text.includes('metal') || text.includes('copper')) {
    return Gem;
  }
  if (text.includes('wheat') || text.includes('grain') || text.includes('corn') || text.includes('food') || text.includes('potrav')) {
    return Wheat;
  }
  return Building2;
}

function getSourceLogoUrl(articleUrl: string) {
  try {
    const url = new URL(articleUrl);
    return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url.origin)}`;
  } catch {
    return '';
  }
}

export function SourceBadge({ article, className }: SourceBadgeProps) {
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [article.url]);

  const FallbackIcon = useMemo(() => getFallbackIcon(article), [article]);
  const logoUrl = useMemo(() => getSourceLogoUrl(article.url), [article.url]);
  const showLogo = Boolean(logoUrl) && !logoFailed;

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600',
        className
      )}
      title={article.source.name}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-500">
        {showLogo ? (
          <img
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            src={logoUrl}
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <FallbackIcon className="h-2.5 w-2.5" strokeWidth={1.8} />
        )}
      </span>
      <span className="truncate">{article.source.name}</span>
    </span>
  );
}
