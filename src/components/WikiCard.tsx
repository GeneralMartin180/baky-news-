import { motion } from 'motion/react';
import { BookOpenText, ExternalLink } from 'lucide-react';

import { WikiSummary } from '../types';

interface WikiCardProps {
  summary: WikiSummary;
}

export function WikiCard({ summary }: WikiCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="news-card-shadow grid gap-0 overflow-hidden rounded-lg border border-slate-200/80 bg-white lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]"
    >
      {summary.thumbnail ? (
        <div className="h-52 overflow-hidden bg-slate-100 lg:h-full">
          <img
            src={summary.thumbnail.source}
            alt={summary.title}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : null}

      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 font-medium text-sky-800">
            <BookOpenText className="h-3.5 w-3.5" />
            Wikipedia kontext
          </span>
          <span>Dopĺňajúci prehľad k vyhľadávaniu</span>
        </div>

        <h2 className="mt-5 font-display text-3xl leading-tight text-slate-950">
          {summary.title}
        </h2>

        <p className="mt-4 max-w-4xl text-[15px] leading-7 text-slate-600">
          {summary.extract}
        </p>

        <div className="mt-6">
          <a
            href={summary.content_urls.desktop.page}
            target="_blank"
            rel="noopener noreferrer"
            className="news-pressable inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:border-slate-300 hover:bg-slate-50"
          >
            Otvoriť zdroj na Wikipédii
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </motion.section>
  );
}
