import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bookmark,
  BookmarkCheck,
  Calendar,
  ExternalLink,
  Globe,
  Newspaper,
  Target,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';

import { ArticleInsightChips } from './ArticleInsightChips';
import { LoadingIndicator } from './LoadingIndicator';
import { DeskArticleInsight } from '../lib/news-intelligence';
import { NewsArticle } from '../types';
import { cn } from '../lib/utils';

export type ArticleReaction = 'important' | 'track' | 'less';

const reactionOptions: Array<{
  icon: typeof ThumbsUp;
  id: ArticleReaction;
  label: string;
}> = [
  { icon: ThumbsUp, id: 'important', label: 'Dôležité' },
  { icon: Target, id: 'track', label: 'Sledovať' },
  { icon: ThumbsDown, id: 'less', label: 'Menej' },
];

interface ArticleModalProps {
  article: NewsArticle | null;
  insight?: DeskArticleInsight | null;
  isSaved?: boolean;
  onClose: () => void;
  onReact?: (article: NewsArticle, reaction: ArticleReaction) => void;
  onSelectRelated?: (article: NewsArticle) => void;
  onToggleSave?: (article: NewsArticle) => void;
  reaction?: ArticleReaction | null;
  relatedArticles?: NewsArticle[];
}

export function ArticleModal({
  article,
  insight = null,
  isSaved = false,
  onClose,
  onReact,
  onSelectRelated,
  onToggleSave,
  reaction = null,
  relatedArticles = [],
}: ArticleModalProps) {
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!article) {
      setFullContent(null);
      setError(null);
      setImageFailed(false);
      return;
    }

    setImageFailed(false);
    void fetchFullContent(article.url, article.contentToken);
  }, [article]);

  const fetchFullContent = async (url: string, contentToken?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const requestUrl = new URL('/api/article-content', window.location.origin);
      requestUrl.searchParams.set('url', url);
      if (contentToken) {
        requestUrl.searchParams.set('token', contentToken);
      }

      const response = await fetch(requestUrl.toString());
      if (!response.ok) {
        throw new Error('Nepodarilo sa načítať obsah');
      }

      const data = await response.json();
      setFullContent(data.content || null);
    } catch (fetchError) {
      console.error(fetchError);
      setError(
        'Nepodarilo sa načítať plný text článku. Článok si však môžete otvoriť na pôvodnom zdroji.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!article) {
    return null;
  }

  const dateLabel = new Date(article.publishedAt).toLocaleDateString('sk-SK', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.985, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.985, y: 18 }}
          transition={{ duration: 0.2 }}
          className="news-card-shadow relative flex h-[100dvh] max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-none border border-slate-200/80 bg-white sm:h-auto sm:max-h-[92vh] sm:rounded-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="news-glass flex items-center justify-between border-b border-slate-200/80 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6 sm:py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 py-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {dateLabel}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onToggleSave ? (
                <button
                  type="button"
                  onClick={() => onToggleSave(article)}
                  className="news-pressable inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-2 sm:text-sm sm:font-medium"
                  aria-pressed={isSaved}
                  aria-label={isSaved ? 'Odobrať z uložených' : 'Uložiť článok'}
                  title={isSaved ? 'Odobrať z uložených' : 'Uložiť článok'}
                >
                  {isSaved ? (
                    <BookmarkCheck className="h-4 w-4" />
                  ) : (
                    <Bookmark className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{isSaved ? 'Uložené' : 'Uložiť'}</span>
                </button>
              ) : null}
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="news-pressable hidden items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:border-slate-300 hover:bg-slate-50 sm:inline-flex"
              >
                <ExternalLink className="h-4 w-4" />
                Pôvodný zdroj
              </a>
              <button
                type="button"
                onClick={onClose}
                className="news-pressable inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                aria-label="Zavrieť"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto">
            {article.urlToImage && !imageFailed ? (
              <div className="aspect-[16/10] w-full overflow-hidden bg-slate-100 sm:aspect-[21/9]">
                <img
                  src={article.urlToImage}
                  alt={article.title}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setImageFailed(true)}
                />
              </div>
            ) : null}

            <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
              <h2 className="font-display text-2xl leading-tight text-slate-950 sm:text-4xl">
                {article.title}
              </h2>

              <p className="mt-5 border-l-2 border-slate-200 pl-4 text-base leading-7 text-slate-600 sm:mt-6 sm:pl-5 sm:text-lg sm:leading-8">
                {article.description}
              </p>

              {insight ? (
                <div className="mt-5 space-y-3">
                  <ArticleInsightChips insight={insight} />
                  {insight.entities.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {insight.entities.map((entity) => (
                        <span
                          key={entity}
                          className="inline-flex rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                        >
                          {entity}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {onReact ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {reactionOptions.map((option) => {
                    const Icon = option.icon;
                    const isActive = reaction === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => onReact(article, option.id)}
                        className={cn(
                          'news-pressable inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium',
                          isActive
                            ? 'border-slate-950 bg-slate-950 text-white'
                            : 'border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950'
                        )}
                        aria-pressed={isActive}
                      >
                        <Icon className="h-4 w-4" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-8">
                {isLoading ? (
                  <div className="news-soft-shadow flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-lg border border-slate-200/80 bg-slate-50">
                    <LoadingIndicator ariaLabel="Nacitavam plny text clanku" />
                    <p className="text-sm text-slate-500">Načítavam plný text článku</p>
                  </div>
                ) : error ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-6 text-rose-700">
                    {error}
                  </div>
                ) : fullContent ? (
                  <div className="space-y-6">
                    {fullContent.split('\n\n').map((paragraph, index) => (
                      <p key={index} className="text-[17px] leading-8 text-slate-700">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-[17px] leading-8 text-slate-700">
                      {article.description}
                    </p>
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50 px-5 py-4 text-[15px] leading-7 text-slate-600">
                      Podrobnejší obsah nie je k dispozícii. Otvorte originálny článok pre plnú verziu.
                    </div>
                  </div>
                )}
              </div>

              {relatedArticles.length > 0 ? (
                <section className="mt-10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                        Ďalej čítať
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-950">
                        Súvisiace správy
                      </h3>
                    </div>
                    <Newspaper className="h-4 w-4 text-sky-700" />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {relatedArticles.map((relatedArticle) => (
                      <button
                        key={relatedArticle.url}
                        type="button"
                        onClick={() => onSelectRelated?.(relatedArticle)}
                        className="news-pressable rounded-lg border border-slate-200/80 bg-white px-4 py-3 text-left hover:border-slate-300 hover:bg-slate-50"
                      >
                        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                          {relatedArticle.source.name}
                        </div>
                        <div className="mt-2 line-clamp-3 text-sm font-semibold leading-5 text-slate-950">
                          {relatedArticle.title}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="news-soft-shadow mt-10 rounded-lg border border-slate-200/80 bg-slate-50/80 px-5 py-5">
                <div className="flex items-start gap-3">
                  <Globe className="mt-0.5 h-5 w-5 text-slate-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">Pôvodný zdroj</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Obrázky, video a kompletný kontext nájdete na pôvodnej stránke článku.
                    </p>
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="news-pressable mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.9)] hover:bg-slate-800"
                    >
                      Otvoriť článok
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
