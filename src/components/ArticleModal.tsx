import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bookmark,
  BookmarkCheck,
  Calendar,
  Download,
  ExternalLink,
  Globe,
  Newspaper,
  Pause,
  Play,
  Square,
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

type ArticleFontSize = 'sm' | 'md' | 'lg';
type SpeechState = 'idle' | 'playing' | 'paused';

const reactionOptions: Array<{
  icon: typeof ThumbsUp;
  id: ArticleReaction;
  label: string;
}> = [
  { icon: ThumbsUp, id: 'important', label: 'Dolezite' },
  { icon: Target, id: 'track', label: 'Sledovat' },
  { icon: ThumbsDown, id: 'less', label: 'Menej' },
];

const fontSizeOptions: Array<{
  id: ArticleFontSize;
  label: string;
}> = [
  { id: 'sm', label: 'A-' },
  { id: 'md', label: 'A' },
  { id: 'lg', label: 'A+' },
];

const summaryClassNames: Record<ArticleFontSize, string> = {
  sm: 'mt-5 border-l-2 border-slate-200 pl-4 text-[15px] leading-7 text-slate-600 sm:mt-6 sm:pl-5 sm:text-base sm:leading-8',
  md: 'mt-5 border-l-2 border-slate-200 pl-4 text-base leading-7 text-slate-600 sm:mt-6 sm:pl-5 sm:text-lg sm:leading-8',
  lg: 'mt-5 border-l-2 border-slate-200 pl-4 text-[17px] leading-8 text-slate-600 sm:mt-6 sm:pl-5 sm:text-xl sm:leading-9',
};

const bodyClassNames: Record<ArticleFontSize, string> = {
  sm: 'text-[15px] leading-7 text-slate-700',
  md: 'text-[17px] leading-8 text-slate-700',
  lg: 'text-[19px] leading-9 text-slate-700',
};

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

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function splitTextIntoChunks(value: string, maxLength = 900) {
  const normalized = value.replace(/\r/g, '').trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (!currentChunk) {
      currentChunk = paragraph;
      continue;
    }

    const nextChunk = `${currentChunk}\n\n${paragraph}`;
    if (nextChunk.length <= maxLength) {
      currentChunk = nextChunk;
      continue;
    }

    chunks.push(currentChunk);
    if (paragraph.length <= maxLength) {
      currentChunk = paragraph;
      continue;
    }

    let startIndex = 0;
    while (startIndex < paragraph.length) {
      const slice = paragraph.slice(startIndex, startIndex + maxLength);
      if (slice.length === maxLength) {
        chunks.push(slice);
      } else {
        currentChunk = slice;
      }
      startIndex += maxLength;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
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
  const [fontSize, setFontSize] = useState<ArticleFontSize>('md');
  const [speechState, setSpeechState] = useState<SpeechState>('idle');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const speechUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);

  const stopSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    speechUtterancesRef.current = [];
    setSpeechState('idle');
  };

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
        throw new Error('Nepodarilo sa nacitat obsah');
      }

      const data = await response.json();
      setFullContent(data.content || null);
    } catch (fetchError) {
      console.error(fetchError);
      setError('Nepodarilo sa nacitat plny text clanku. Clanok si vsak mozete otvorit na povodnom zdroji.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!article) {
      stopSpeech();
      setFullContent(null);
      setError(null);
      setIsLoading(false);
      setImageFailed(false);
      setSpeechError(null);
      return;
    }

    stopSpeech();
    setSpeechError(null);
    setImageFailed(false);
    setError(null);
    setFullContent(article.contentOverride ?? null);

    if (article.contentOverride) {
      setIsLoading(false);
      return;
    }

    void fetchFullContent(article.url, article.contentToken);
  }, [article]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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

  const supportsSpeech =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  const articleBody = fullContent?.trim() || article.description;
  const readerText = [article.title, article.description, fullContent?.trim()]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join('\n\n');

  const handleClose = () => {
    stopSpeech();
    onClose();
  };

  const handleToggleSpeech = () => {
    if (!supportsSpeech) {
      setSpeechError('Tento prehliadac nepodporuje hlasove citanie.');
      return;
    }

    if (speechState === 'playing') {
      window.speechSynthesis.pause();
      setSpeechState('paused');
      return;
    }

    if (speechState === 'paused') {
      window.speechSynthesis.resume();
      setSpeechState('playing');
      return;
    }

    const chunks = splitTextIntoChunks(readerText);
    if (!chunks.length) {
      setSpeechError('Text clanku este nie je pripraveny.');
      return;
    }

    setSpeechError(null);
    window.speechSynthesis.cancel();

    const utterances = chunks.map((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = 'sk-SK';
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onend = () => {
        if (index === chunks.length - 1) {
          speechUtterancesRef.current = [];
          setSpeechState('idle');
        }
      };
      utterance.onerror = () => {
        speechUtterancesRef.current = [];
        setSpeechState('idle');
        setSpeechError('Hlasove citanie sa nepodarilo spustit.');
      };
      return utterance;
    });

    speechUtterancesRef.current = utterances;
    setSpeechState('playing');
    utterances.forEach((utterance) => window.speechSynthesis.speak(utterance));
  };

  const handleStopSpeech = () => {
    stopSpeech();
    setSpeechError(null);
  };

  const handleDownloadPdf = async () => {
    if (isExportingPdf) {
      return;
    }

    setIsExportingPdf(true);

    try {
      const { jsPDF } = await import('jspdf');
      const documentPdf = new jsPDF({
        format: 'a4',
        unit: 'pt',
      });
      const pageWidth = documentPdf.internal.pageSize.getWidth();
      const pageHeight = documentPdf.internal.pageSize.getHeight();
      const margin = 48;
      const contentWidth = pageWidth - margin * 2;
      let cursorY = margin;

      const writeBlock = (
        text: string,
        options: {
          fontSize: number;
          fontStyle?: 'bold' | 'normal';
          gapAfter?: number;
          lineHeight?: number;
        }
      ) => {
        const safeText = text.trim();
        if (!safeText) {
          return;
        }

        documentPdf.setFont('helvetica', options.fontStyle ?? 'normal');
        documentPdf.setFontSize(options.fontSize);
        const lines = documentPdf.splitTextToSize(safeText, contentWidth) as string[];
        const lineHeight = options.lineHeight ?? Math.round(options.fontSize * 1.6);

        for (const line of lines) {
          if (cursorY + lineHeight > pageHeight - margin) {
            documentPdf.addPage();
            cursorY = margin;
          }

          documentPdf.text(line, margin, cursorY);
          cursorY += lineHeight;
        }

        cursorY += options.gapAfter ?? 0;
      };

      writeBlock(article.title, {
        fontSize: 22,
        fontStyle: 'bold',
        gapAfter: 18,
        lineHeight: 30,
      });
      writeBlock(`${article.source.name} | ${dateLabel}`, {
        fontSize: 11,
        gapAfter: 10,
        lineHeight: 17,
      });
      writeBlock(article.description, {
        fontSize: 13,
        gapAfter: 16,
        lineHeight: 21,
      });
      writeBlock(articleBody, {
        fontSize: 12,
        gapAfter: 16,
        lineHeight: 19,
      });
      writeBlock(`Zdroj: ${article.url}`, {
        fontSize: 10,
        gapAfter: 0,
        lineHeight: 16,
      });

      const fileName = `${sanitizeFileName(article.title) || 'clanok'}.pdf`;
      documentPdf.save(fileName);
    } catch (pdfError) {
      console.error(pdfError);
      setSpeechError('PDF sa nepodarilo vytvorit.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6"
        onClick={handleClose}
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
                  aria-label={isSaved ? 'Odobrat z ulozenych' : 'Ulozit clanok'}
                  title={isSaved ? 'Odobrat z ulozenych' : 'Ulozit clanok'}
                >
                  {isSaved ? (
                    <BookmarkCheck className="h-4 w-4" />
                  ) : (
                    <Bookmark className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{isSaved ? 'Ulozene' : 'Ulozit'}</span>
                </button>
              ) : null}
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="news-pressable hidden items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:border-slate-300 hover:bg-slate-50 sm:inline-flex"
              >
                <ExternalLink className="h-4 w-4" />
                Povodny zdroj
              </a>
              <button
                type="button"
                onClick={handleClose}
                className="news-pressable inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                aria-label="Zavriet"
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
                  className="h-full w-full object-contain sm:object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setImageFailed(true)}
                />
              </div>
            ) : null}

            <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
              <h2 className="font-display text-2xl leading-tight text-slate-950 sm:text-4xl">
                {article.title}
              </h2>

              <p className={summaryClassNames[fontSize]}>{article.description}</p>

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

              <div className="news-soft-shadow mt-6 rounded-lg border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={isExportingPdf}
                      className={cn(
                        'news-pressable inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium',
                        isExportingPdf
                          ? 'cursor-wait border-slate-200 bg-slate-100 text-slate-400'
                          : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950'
                      )}
                    >
                      <Download className="h-4 w-4" />
                      {isExportingPdf ? 'Pripravujem PDF' : 'Stiahnut PDF'}
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleSpeech}
                      className={cn(
                        'news-pressable inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium',
                        speechState === 'playing'
                          ? 'border-slate-950 bg-slate-950 text-white'
                          : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950'
                      )}
                      aria-pressed={speechState !== 'idle'}
                    >
                      {speechState === 'playing' ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      {speechState === 'playing'
                        ? 'Pauza'
                        : speechState === 'paused'
                          ? 'Pokracovat'
                          : 'Pocuvat'}
                    </button>

                    <button
                      type="button"
                      onClick={handleStopSpeech}
                      disabled={speechState === 'idle'}
                      className={cn(
                        'news-pressable inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium',
                        speechState === 'idle'
                          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                          : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950'
                      )}
                    >
                      <Square className="h-4 w-4" />
                      Stop
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                      Velkost pisma
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {fontSizeOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setFontSize(option.id)}
                          className={cn(
                            'news-pressable inline-flex h-9 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-medium',
                            fontSize === option.id
                              ? 'border-slate-950 bg-slate-950 text-white'
                              : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950'
                          )}
                          aria-pressed={fontSize === option.id}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {speechError ? (
                    <p className="text-sm leading-6 text-rose-700">{speechError}</p>
                  ) : (
                    <p className="text-sm leading-6 text-slate-500">
                      PDF funguje priamo z modalu. Hlas precita titulok, zhrnutie a plny text, ak je dostupny.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-8">
                {isLoading ? (
                  <div className="news-soft-shadow flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-lg border border-slate-200/80 bg-slate-50">
                    <LoadingIndicator ariaLabel="Nacitavam plny text clanku" />
                    <p className="text-sm text-slate-500">Nacitavam plny text clanku</p>
                  </div>
                ) : error ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-6 text-rose-700">
                    {error}
                  </div>
                ) : fullContent ? (
                  <div className="space-y-6">
                    {fullContent
                      .split('\n\n')
                      .map((paragraph) => paragraph.trim())
                      .filter(Boolean)
                      .map((paragraph, index) => (
                        <p key={index} className={bodyClassNames[fontSize]}>
                          {paragraph}
                        </p>
                      ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className={bodyClassNames[fontSize]}>{article.description}</p>
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50 px-5 py-4 text-[15px] leading-7 text-slate-600">
                      Podrobnejsi obsah nie je k dispozicii. Otvorte originalny clanok pre plnu verziu.
                    </div>
                  </div>
                )}
              </div>

              {relatedArticles.length > 0 ? (
                <section className="mt-10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                        Dalej citat
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-950">
                        Suvisiace spravy
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
                    <h3 className="text-sm font-semibold text-slate-950">Povodny zdroj</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Obrazky, video a kompletny kontext najdete na povodnej stranke clanku.
                    </p>
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="news-pressable mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.9)] hover:bg-slate-800"
                    >
                      Otvorit clanok
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
