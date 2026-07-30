import { Filter, Radar, RotateCcw, ShieldCheck, Target } from 'lucide-react';

import {
  DeskDigestMode,
  DeskRadarSnapshot,
  DeskReadTimeFilter,
  DeskSourceFilter,
} from '../lib/news-intelligence';
import { cn } from '../lib/utils';

interface DeskRadarPanelProps {
  digestMode: DeskDigestMode;
  focusedTopic: string | null;
  onClearTopic: () => void;
  onDigestModeChange: (mode: DeskDigestMode) => void;
  onReadTimeFilterChange: (filter: DeskReadTimeFilter) => void;
  onSourceFilterChange: (filter: DeskSourceFilter) => void;
  onTopicSelect: (topic: string) => void;
  radar: DeskRadarSnapshot;
  readTimeFilter: DeskReadTimeFilter;
  sourceFilter: DeskSourceFilter;
}

const digestModes: DeskDigestMode[] = ['feed', 'briefing', 'radar'];
const sourceFilters: DeskSourceFilter[] = ['all', 'trusted', 'regional', 'mixed'];
const readTimeFilters: DeskReadTimeFilter[] = ['all', 'quick', 'standard', 'deep'];

export function DeskRadarPanel({
  digestMode,
  focusedTopic,
  onClearTopic,
  onDigestModeChange,
  onReadTimeFilterChange,
  onSourceFilterChange,
  onTopicSelect,
  radar,
  readTimeFilter,
  sourceFilter,
}: DeskRadarPanelProps) {
  return (
    <section className="news-card-shadow min-w-0 rounded-lg border border-slate-200/80 bg-white p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 sm:text-xs">
            Desk radar
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-950 sm:text-base">Radar</h3>
        </div>
        <Radar className="mt-1 h-4 w-4 text-sky-700" />
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap gap-2">
        {digestModes.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onDigestModeChange(mode)}
            className={cn(
              'news-pressable inline-flex h-8 items-center rounded-full border px-2.5 text-xs font-medium capitalize sm:text-sm',
              digestMode === mode
                ? 'border-slate-950 bg-slate-950 text-white'
                : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300'
            )}
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2.5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Source layer
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap gap-2">
            {sourceFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => onSourceFilterChange(filter)}
                className={cn(
                  'news-pressable inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium sm:h-8 sm:text-sm',
                  sourceFilter === filter
                    ? 'border-sky-700 bg-sky-700 text-white'
                    : 'border-slate-200/80 bg-slate-50 text-slate-700 hover:border-slate-300'
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            Read depth
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap gap-2">
            {readTimeFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => onReadTimeFilterChange(filter)}
                className={cn(
                  'news-pressable inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium sm:h-8 sm:text-sm',
                  readTimeFilter === filter
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : 'border-slate-200/80 bg-slate-50 text-slate-700 hover:border-slate-300'
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {focusedTopic ? (
        <div className="mt-3 flex min-w-0 items-center justify-between gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700">
              Topic focus
            </div>
            <div className="truncate text-sm font-semibold text-slate-950">{focusedTopic}</div>
          </div>
          <button
            type="button"
            onClick={onClearTopic}
            className="news-pressable inline-flex h-8 items-center gap-2 rounded-full border border-sky-200 bg-white px-3 text-sm font-medium text-sky-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      ) : null}

      {digestMode === 'radar' ? (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
            Impact mix
          </div>
          <div className="mt-2 space-y-1.5">
            {radar.impact.slice(0, 3).map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onTopicSelect(item.label)}
                className="flex w-full items-center justify-between text-left text-sm text-slate-700"
              >
                <span>{item.label}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
            Entities
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {radar.entities.slice(0, 4).map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onTopicSelect(item.label)}
                className="news-pressable inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-300"
              >
                <Target className="h-3 w-3 text-slate-400" />
                {item.label}
                <span className="text-slate-400">{item.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
            Watch hits
          </div>
          <div className="mt-2 space-y-1.5">
            {radar.watchlists.slice(0, 3).map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm text-slate-700">
                <span>{item.label}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
            Sources
          </div>
          <div className="mt-2 space-y-1.5">
            {radar.sources.slice(0, 4).map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onTopicSelect(item.label)}
                className="flex w-full items-center justify-between text-left text-sm text-slate-700"
              >
                <span className="truncate pr-2">{item.label}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </div>
        </div>
      ) : null}
    </section>
  );
}
