import { motion } from 'motion/react';
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
  isLive?: boolean;
  isRefreshing?: boolean;
  lastRefreshedAt?: string | null;
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

function formatShortPeriod(value: string) {
  return new Intl.DateTimeFormat('sk-SK', {
    month: 'short',
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

function formatRefreshTime(value: string) {
  return new Intl.DateTimeFormat('sk-SK', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function formatValue(value: number) {
  const maximumFractionDigits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return new Intl.NumberFormat('sk-SK', {
    maximumFractionDigits,
    minimumFractionDigits: value < 10 ? 2 : 0,
  }).format(value);
}

function formatChange(changePercent: number | null) {
  if (changePercent === null) {
    return 'bez zmeny';
  }

  return `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%`;
}

function getTrendColor(quote: CommodityMarketQuote) {
  if (quote.trend === 'up') {
    return {
      accent: '#059669',
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      soft: 'from-emerald-50 to-white',
    };
  }

  if (quote.trend === 'down') {
    return {
      accent: '#dc2626',
      badge: 'border-rose-200 bg-rose-50 text-rose-700',
      soft: 'from-rose-50 to-white',
    };
  }

  return {
    accent: '#64748b',
    badge: 'border-slate-200 bg-slate-50 text-slate-600',
    soft: 'from-slate-50 to-white',
  };
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function buildAreaPath(points: Array<{ x: number; y: number }>, height: number) {
  const linePath = buildLinePath(points);
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  return `${linePath} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`;
}

function getChartGeometry(quote: CommodityMarketQuote, width: number, height: number) {
  const values = quote.history.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = quote.history.map((point, index) => ({
    x: (index / Math.max(quote.history.length - 1, 1)) * width,
    y: height - ((point.value - min) / range) * height,
  }));

  return {
    areaPath: buildAreaPath(points, height),
    high: max,
    linePath: buildLinePath(points),
    low: min,
    points,
  };
}

function Sparkline({ quote }: { quote: CommodityMarketQuote }) {
  if (quote.history.length < 2) {
    return (
      <div className="flex h-8 w-24 items-center justify-center rounded-md border border-slate-200/80 bg-slate-50 text-[10px] text-slate-400">
        trend
      </div>
    );
  }

  const width = 96;
  const height = 28;
  const chart = getChartGeometry(quote, width, height);
  const palette = getTrendColor(quote);

  return (
    <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-1.5 py-1">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-24" aria-hidden="true">
        <path d={chart.areaPath} fill={palette.accent} fillOpacity="0.08" />
        <path
          d={chart.linePath}
          fill="none"
          stroke={palette.accent}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
      </svg>
    </div>
  );
}

function FeaturedChart({ quote }: { quote: CommodityMarketQuote }) {
  if (quote.history.length < 2) {
    return null;
  }

  const width = 300;
  const height = 112;
  const chart = getChartGeometry(quote, width, height);
  const palette = getTrendColor(quote);
  const TrendIcon =
    quote.trend === 'up' ? ArrowUpRight : quote.trend === 'down' ? ArrowDownRight : Minus;
  const gradientId = `commodity-graph-${quote.id}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      viewport={{ amount: 0.35, once: true }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      className={`mt-3 overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br ${palette.soft} p-3`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
            Market graph
          </p>
          <h4 className="mt-1 truncate text-base font-semibold text-slate-950">{quote.label}</h4>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-xl font-semibold text-slate-950">${formatValue(quote.value)}</span>
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', palette.badge)}>
              <TrendIcon className="h-3 w-3" />
              {formatChange(quote.changePercent)}
            </span>
          </div>
        </div>

        <div className="rounded-full border border-white/70 bg-white/80 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          6M
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/70 bg-white/70 p-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-slate-400">
          <span>low ${formatValue(chart.low)}</span>
          <span>high ${formatValue(chart.high)}</span>
        </div>

        <svg viewBox={`0 0 ${width} ${height + 14}`} className="mt-2 h-32 w-full" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.accent} stopOpacity="0.28" />
              <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 0.5, 1].map((step) => (
            <line
              key={step}
              x1="0"
              x2={width}
              y1={step * height}
              y2={step * height}
              stroke="#cbd5e1"
              strokeDasharray="4 5"
              strokeOpacity="0.7"
            />
          ))}

          <motion.path
            d={chart.areaPath}
            fill={`url(#${gradientId})`}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
            viewport={{ amount: 0.35, once: true }}
            whileInView={{ opacity: 1 }}
          />
          <motion.path
            d={chart.linePath}
            fill="none"
            initial={{ pathLength: 0, opacity: 0.8 }}
            stroke={palette.accent}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
            transition={{ duration: 0.75, ease: 'easeOut', delay: 0.05 }}
            viewport={{ amount: 0.35, once: true }}
            whileInView={{ pathLength: 1, opacity: 1 }}
          />

          {chart.points.map((point, index) => (
            <circle
              key={`${quote.id}-${index}`}
              cx={point.x}
              cy={point.y}
              r={index === chart.points.length - 1 ? 4 : 2.5}
              fill={index === chart.points.length - 1 ? palette.accent : '#ffffff'}
              stroke={palette.accent}
              strokeWidth={index === chart.points.length - 1 ? 2.5 : 1.5}
            />
          ))}

          {quote.history.map((point, index) => (
            <text
              key={point.period}
              x={(index / Math.max(quote.history.length - 1, 1)) * width}
              y={height + 12}
              fill="#94a3b8"
              fontSize="10"
              textAnchor={index === 0 ? 'start' : index === quote.history.length - 1 ? 'end' : 'middle'}
            >
              {formatShortPeriod(point.period)}
            </text>
          ))}
        </svg>
      </div>
    </motion.div>
  );
}

function QuoteRow({ quote, delay = 0 }: { quote: CommodityMarketQuote; delay?: number }) {
  const TrendIcon =
    quote.trend === 'up' ? ArrowUpRight : quote.trend === 'down' ? ArrowDownRight : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay }}
      viewport={{ amount: 0.4, once: true }}
      whileInView={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-slate-200/70 bg-white px-3 py-2.5"
    >
      <div className="flex items-start justify-between gap-3">
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
            {formatChange(quote.changePercent)}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            {quote.previousValue === null
              ? 'predtym -'
              : `predtym $${formatValue(quote.previousValue)}`}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">6M trend</div>
        <Sparkline quote={quote} />
      </div>
    </motion.div>
  );
}

export function CommodityMarketWidget({
  isLoading,
  isLive = false,
  isRefreshing = false,
  lastRefreshedAt = null,
  market,
}: CommodityMarketWidgetProps) {
  const groupedQuotes = {
    energy: market?.quotes.filter((quote) => quote.group === 'energy') ?? [],
    oils: market?.quotes.filter((quote) => quote.group === 'oils') ?? [],
    food: market?.quotes.filter((quote) => quote.group === 'food') ?? [],
  };

  const totalUp = market?.quotes.filter((quote) => quote.trend === 'up').length ?? 0;
  const totalDown = market?.quotes.filter((quote) => quote.trend === 'down').length ?? 0;
  const featuredQuote =
    market?.quotes
      .slice()
      .sort((left, right) => Math.abs(right.changePercent ?? 0) - Math.abs(left.changePercent ?? 0))[0] ??
    null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 22 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      viewport={{ amount: 0.25, once: true }}
      whileInView={{ opacity: 1, y: 0 }}
      className="news-card-shadow rounded-[18px] border border-slate-200/80 bg-white p-3 sm:rounded-[20px] sm:p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 sm:text-xs">
            Biznis radar
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-950 sm:text-base">Komoditna burza</h3>
            {isLive ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {isRefreshing ? 'Live sync' : 'Live'}
              </span>
            ) : null}
          </div>
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

      {market ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            <ArrowUpRight className="h-3 w-3" />
            Hore {totalUp}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700">
            <ArrowDownRight className="h-3 w-3" />
            Dole {totalDown}
          </span>
        </div>
      ) : null}

      {featuredQuote ? <FeaturedChart quote={featuredQuote} /> : null}

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
                  <div key={row} className="h-16 animate-pulse rounded-lg bg-white" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : market ? (
        <div className="mt-3 space-y-3">
          {(['energy', 'oils', 'food'] as CommodityMarketGroup[]).map((group, groupIndex) => {
            const quotes = groupedQuotes[group];
            if (!quotes.length) {
              return null;
            }

            const Icon = SECTION_META[group].icon;

            return (
              <motion.div
                key={group}
                initial={{ opacity: 0, y: 14 }}
                transition={{ duration: 0.35, ease: 'easeOut', delay: groupIndex * 0.06 }}
                viewport={{ amount: 0.35, once: true }}
                whileInView={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5"
              >
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  <Icon className="h-3.5 w-3.5" />
                  {SECTION_META[group].label}
                </div>

                <div className="mt-2 space-y-2">
                  {quotes.map((quote, quoteIndex) => (
                    <div key={quote.id}>
                      <QuoteRow
                        quote={quote}
                        delay={groupIndex * 0.05 + quoteIndex * 0.04}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>{market.sourceLabel}</span>
            <span>
              {isLive && lastRefreshedAt
                ? `Live refresh ${formatRefreshTime(lastRefreshedAt)}`
                : `Publikovane ${formatTime(market.updatedAt)}`}
            </span>
          </div>
        </div>
      ) : null}
    </motion.section>
  );
}
