import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, ExternalLink, Globe, Loader2, X } from 'lucide-react';

import { NewsArticle } from '../types';

interface ArticleModalProps {
  article: NewsArticle | null;
  onClose: () => void;
}

export function ArticleModal({ article, onClose }: ArticleModalProps) {
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!article) {
      setFullContent(null);
      setError(null);
      return;
    }

    void fetchFullContent(article.url);
  }, [article]);

  const fetchFullContent = async (url: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/article-content?url=${encodeURIComponent(url)}`);
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
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.985, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.985, y: 18 }}
          transition={{ duration: 0.2 }}
          className="news-card-shadow relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200/80 bg-white"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="news-glass flex items-center justify-between border-b border-slate-200/80 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 py-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {dateLabel}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
            {article.urlToImage ? (
              <div className="aspect-[21/9] w-full overflow-hidden bg-slate-100">
                <img
                  src={article.urlToImage}
                  alt={article.title}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : null}

            <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
              <h2 className="font-display text-3xl leading-tight text-slate-950 sm:text-4xl">
                {article.title}
              </h2>

              <p className="mt-6 border-l-2 border-slate-200 pl-5 text-lg leading-8 text-slate-600">
                {article.description}
              </p>

              <div className="mt-8">
                {isLoading ? (
                  <div className="news-soft-shadow flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-lg border border-slate-200/80 bg-slate-50">
                    <Loader2 className="h-7 w-7 animate-spin text-slate-700" />
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
