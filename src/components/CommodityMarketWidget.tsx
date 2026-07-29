import {
  ArrowDownRight,
  ArrowUpRight,
  ChartColumnBig,
  Droplets,
  Flame,
  Minus,
  Wheat,
} from 'lucide-react';

import { CommodityMarketGroup, CommodityMarketQuote, CommodityMarketSnapshot } from '../types';
import { cn } from '../lib/utils';

interface CommodityMarketWidgetProps {
  isLoading: boolean;
  market: CommodityMarketSnapshot | null;
}

const SECTION_META: Record<
  CommodityMarketGroup,
  {
    icon: typeof Flame;
    label: string;
  }
> = {
  energy: {
    icon: Flame,
    label: 'Ropa',
  },
  food: {
    icon: Wheat,
    label: 'Potraviny',
  },
  oils: {
    icon: Droplets,
    label: 'Oleje',
  },
};

function formatPeriod(value: string) {
  return new Intl.DateTimeFormat('sk-SK', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('sk-SK', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatValue(value: number) {
  const maximumFractionDigits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return new Intl.NumberFormat('sk-SK', {
    maximumFractionDigits,
    minimumFractionDigits: value < 10 ? 2 : 0,
  }).format(value);
}

function QuoteRow({ quote }: { quote: CommodityMarketQuote }) {
  const TrendIcon =
    quote.trend === 'up' ? ArrowUpRight : quote.trend === 'down' ? ArrowDownRight : Minus;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/70 bg-white px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-950">{quote.shortLabel}</div>
        <div className="truncate text-[11px] text-slate-500">
          {quote.label} · {quote.unit}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold text-slate-950">${formatValue(quote.value)}</div>
        <div
          className={cn(
            'mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium',
            quote.trend === 'up'
              ? 'text-emerald-600'
              : quote.trend === 'down'
                ? 'text-rose-600'
                : 'text-slate-500'
          )}
        >
          <TrendIcon className="h-3 w-3" />
          {quote.changePercent === null
            ? 'bez zmeny'
            : `${quote.changePercent > 0 ? '+' : ''}${quote.changePercent.toFixed(1)}%`}
        </div>
      </div>
    </div>
  );
}

export function CommodityMarketWidget({ isLoading, market }: CommodityMarketWidgetProps) {
  const groupedQuotes = {
    energy: market?.quotes.filter((quote) => quote.group === 'energy') ?? [],
    oils: market?.quotes.filter((quote) => quote.group === 'oils') ?? [],
    food: market?.quotes.filter((quote) => quote.group === 'food') ?? [],
  };

  return (
    <section className="news-card-shadow rounded-[18px] border border-slate-200/80 bg-white p-3 sm:rounded-[20px] sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 sm:text-xs">
            Biznis radar
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-950 sm:text-base">
            Komoditná burza
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
            {market
              ? `${formatPeriod(market.latestPeriod)} · ${market.frequencyLabel}`
              : 'Ropa, oleje a potraviny'}
          </p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50 text-slate-700 sm:h-10 sm:w-10">
          <ChartColumnBig className="h-4 w-4" />
        </div>
      </div>

      {isLoading && !market ? (
        <div className="mt-3 space-y-2.5">
          {[0, 1, 2].map((section) => (
            <div
              key={section}
              className="rounded-lg border border-slate-200/70 bg-slate-50/70 px-3 py-3"
            >
              <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200/80" />
              <div className="mt-3 space-y-2">
                {[0, 1].map((row) => (
                  <div key={row} className="h-12 animate-pulse rounded-lg bg-white" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : market ? (
        <div className="mt-3 space-y-3">
          {(['energy', 'oils', 'food'] as CommodityMarketGroup[]).map((group) => {
            const quotes = groupedQuotes[group];
            if (!quotes.length) {
              return null;
            }

            const Icon = SECTION_META[group].icon;

            return (
              <div
                key={group}
                className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5"
              >
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  <Icon className="h-3.5 w-3.5" />
                  {SECTION_META[group].label}
                </div>

                <div className="mt-2 space-y-2">
                  {quotes.map((quote) => (
                    <div key={quote.id}>
                      <QuoteRow quote={quote} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>{market.sourceLabel}</span>
            <span>Publikované {formatTime(market.updatedAt)}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
