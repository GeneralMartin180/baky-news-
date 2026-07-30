import { BookmarkPlus, History, Search, X } from 'lucide-react';

import { cn } from '../lib/utils';

interface DeskSavedSearchesPanelProps {
  currentValue: string;
  onRemoveSearch: (query: string) => void;
  onRunSearch: (query: string) => void;
  onSaveCurrent: () => void;
  savedSearches: string[];
}

export function DeskSavedSearchesPanel({
  currentValue,
  onRemoveSearch,
  onRunSearch,
  onSaveCurrent,
  savedSearches,
}: DeskSavedSearchesPanelProps) {
  const canSave = currentValue.trim().length > 0;

  return (
    <section className="news-soft-shadow min-w-0 rounded-lg border border-slate-200/80 bg-white/85 p-3 sm:p-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <History className="h-4 w-4 text-slate-400" />
          <span className="truncate text-sm font-medium text-slate-700">Saved searches</span>
        </div>

        <button
          type="button"
          onClick={onSaveCurrent}
          disabled={!canSave}
          className={cn(
            'news-pressable inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium',
            canSave
              ? 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300'
              : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
          )}
        >
          <BookmarkPlus className="h-4 w-4" />
          Save current
        </button>
      </div>

      {savedSearches.length > 0 ? (
        <div className="mt-3 flex min-w-0 flex-wrap gap-2">
          {savedSearches.map((query) => (
            <div
              key={query}
              className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50 py-1 pl-2.5 pr-1"
            >
              <button
                type="button"
                onClick={() => onRunSearch(query)}
                className="inline-flex min-w-0 items-center gap-1 text-sm font-medium text-slate-700"
              >
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <span className="truncate">{query}</span>
              </button>
              <button
                type="button"
                onClick={() => onRemoveSearch(query)}
                className="news-pressable inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-white hover:text-slate-700"
                aria-label={`Remove ${query}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Uloz si dotazy ako Slovensko, AI, Tesla alebo Rimavska Sobota.
        </p>
      )}
    </section>
  );
}
