import { Target } from 'lucide-react';

import { DeskWatchlistOption } from '../lib/news-intelligence';
import { cn } from '../lib/utils';

interface DeskWatchlistPanelProps {
  activeIds: string[];
  counts: Record<string, number>;
  onToggle: (watchlistId: string) => void;
  watchlists: DeskWatchlistOption[];
}

export function DeskWatchlistPanel({
  activeIds,
  counts,
  onToggle,
  watchlists,
}: DeskWatchlistPanelProps) {
  return (
    <section className="news-card-shadow rounded-lg border border-slate-200/80 bg-white p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 sm:text-xs">
            Watchlist
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-950 sm:text-base">Tracking</h3>
        </div>
        <Target className="mt-1 h-4 w-4 text-sky-700" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {watchlists.map((watchlist) => {
          const isActive = activeIds.includes(watchlist.id);

          return (
            <button
              key={watchlist.id}
              type="button"
              onClick={() => onToggle(watchlist.id)}
              className={cn(
                'news-pressable inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-left text-sm font-medium',
                isActive
                  ? 'border-slate-950 bg-slate-950 text-white'
                  : 'border-slate-200/80 bg-slate-50/70 text-slate-800 hover:border-slate-300 hover:bg-white'
              )}
              aria-pressed={isActive}
            >
              <span className="truncate">{watchlist.label}</span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                  isActive ? 'bg-white/12 text-white' : 'bg-white text-slate-500'
                )}
              >
                {counts[watchlist.id] ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
