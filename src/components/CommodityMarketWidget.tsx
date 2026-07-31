import { PointerEvent, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartColumnBig,
  Clock3,
  ExternalLink,
  Flame,
  Gem,
  Info,
  LoaderCircle,
  Maximize2,
  Minus,
  RefreshCw,
  Wheat,
  X,
} from 'lucide-react';

import {
  CommodityMarketGroup,
  CommodityMarketQuote,
  CommodityMarketRange,
  CommodityMarketSnapshot,
} from '../types';
import { fetchCommodityMarkets } from '../services/api';
import { cn } from '../lib/utils';

interface CommodityMarketWidgetProps {
  isLoading: boolean;
  isLive?: boolean;
  isRefreshing?: boolean;
  lastRefreshedAt?: string | null;
  market: CommodityMarketSnapshot | null;
}

const GROUPS: Array<{
  icon: typeof ChartColumnBig;
  id: CommodityMarketGroup | 'all';
  label: string;
}> = [
  { icon: ChartColumnBig, id: 'all', label: 'Všetko' },
  { icon: Flame, id: 'energy', label: 'Energia' },
  { icon: Gem, id: 'metals', label: 'Kovy' },
  { icon: Wheat, id: 'food', label: 'Potraviny' },
];

const RANGES: Array<{ id: CommodityMarketRange; label: string }> = [
  { id: '1d', label: '1D' },
  { id: '5d', label: '5D' },
  { id: '1mo', label: '1M' },
  { id: '6mo', label: '6M' },
  { id: 'ytd', label: 'YTD' },
  { id: '1y', label: '1R' },
  { id: '5y', label: '5R' },
  { id: 'max', label: 'MAX' },
];

function formatPrice(value: number) {
  const maximumFractionDigits = value >= 1000 ? 2 : value >= 100 ? 2 : value >= 10 ? 3 : 4;
  return new Intl.NumberFormat('sk-SK', { maximumFractionDigits }).format(value);
}

function formatSigned(value: number | null) {
  if (value === null) return '—';
  return `${value > 0 ? '+' : ''}${formatPrice(value)}`;
}

function formatPercent(value: number | null) {
  if (value === null) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)} %`;
}

function formatCompact(value: number | null) {
  if (value === null) return '—';
  return new Intl.NumberFormat('sk-SK', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}

function formatMarketTime(value: string) {
  return new Intl.DateTimeFormat('sk-SK', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

function formatChartTime(value: string, range: CommodityMarketRange) {
  const date = new Date(value);
  if (range === '1d' || range === '5d') {
    return new Intl.DateTimeFormat('sk-SK', {
      day: range === '5d' ? '2-digit' : undefined,
      hour: '2-digit',
      minute: '2-digit',
      month: range === '5d' ? '2-digit' : undefined,
    }).format(date);
  }

  return new Intl.DateTimeFormat('sk-SK', {
    month: 'short',
    year: range === 'ytd' || range === '1y' || range === '5y' || range === 'max' ? '2-digit' : undefined,
  }).format(date);
}

function getTrendClasses(quote: CommodityMarketQuote) {
  if (quote.trend === 'up') {
    return { fill: '#059669', soft: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-600' };
  }
  if (quote.trend === 'down') {
    return { fill: '#dc2626', soft: 'bg-rose-50 text-rose-700', text: 'text-rose-600' };
  }
  return { fill: '#64748b', soft: 'bg-slate-100 text-slate-600', text: 'text-slate-500' };
}

function TrendIcon({ quote, className = 'h-3.5 w-3.5' }: { quote: CommodityMarketQuote; className?: string }) {
  const Icon = quote.trend === 'up' ? ArrowUpRight : quote.trend === 'down' ? ArrowDownRight : Minus;
  return <Icon className={className} />;
}

function getChartData(quote: CommodityMarketQuote, width: number, height: number, compact: boolean) {
  const values = quote.history.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max((rawMax - rawMin) * 0.12, rawMax * 0.002, 0.01);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const range = max - min || 1;
  const priceHeight = compact ? height : height * 0.76;
  const points = quote.history.map((point, index) => ({
    period: point.period,
    value: point.value,
    volume: point.volume ?? null,
    x: (index / Math.max(quote.history.length - 1, 1)) * width,
    y: priceHeight - ((point.value - min) / range) * priceHeight,
  }));
  const linePath = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${width} ${priceHeight} L 0 ${priceHeight} Z`;
  const averagePoints = points
    .map((point, index) => {
      if (index < 19) return null;
      const average = values.slice(index - 19, index + 1).reduce((sum, value) => sum + value, 0) / 20;
      return { x: point.x, y: priceHeight - ((average - min) / range) * priceHeight };
    })
    .filter((point): point is { x: number; y: number } => point !== null);
  const averagePath = averagePoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const maxVolume = Math.max(...points.map((point) => point.volume ?? 0), 1);
  return { areaPath, averagePath, linePath, max, maxVolume, min, points, priceHeight };
}

function MarketChart({
  compact = false,
  quote,
  range,
  showAverage = false,
}: {
  compact?: boolean;
  quote: CommodityMarketQuote;
  range: CommodityMarketRange;
  showAverage?: boolean;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const width = compact ? 420 : 840;
  const height = compact ? 120 : 310;
  const chart = useMemo(() => getChartData(quote, width, height, compact), [compact, height, quote, width]);
  const colors = getTrendClasses(quote);
  const chartColor = compact ? colors.fill : '#0088cc';
  const hoveredPoint = hoveredIndex === null ? null : chart.points[hoveredIndex];
  const gradientId = `market-area-${quote.id}-${range}-${compact ? 'small' : 'large'}`;

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (compact) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    setHoveredIndex(Math.round(ratio * Math.max(chart.points.length - 1, 0)));
  };

  return (
    <div className={cn('relative w-full', compact ? 'h-28' : 'h-[290px] sm:h-[360px]')}>
      <svg
        aria-label={`Vývoj ceny ${quote.label}`}
        className="h-full w-full touch-pan-y overflow-visible"
        onPointerLeave={() => setHoveredIndex(null)}
        onPointerMove={handlePointerMove}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {!compact
          ? [0, 0.25, 0.5, 0.75, 1].map((step) => (
              <g key={step}>
                <line
                  stroke="#e2e8f0"
                  strokeDasharray="3 5"
                  x1="0"
                  x2={width}
                  y1={step * chart.priceHeight}
                  y2={step * chart.priceHeight}
                />
                <text fill="#94a3b8" fontSize="11" textAnchor="end" x={width - 4} y={step * chart.priceHeight - 6}>
                  {formatPrice(chart.max - step * (chart.max - chart.min))}
                </text>
              </g>
            ))
          : null}

        {!compact
          ? chart.points.map((point, index) => {
              const volumeHeight = ((point.volume ?? 0) / chart.maxVolume) * (height - chart.priceHeight - 12);
              const barWidth = Math.max(1, width / Math.max(chart.points.length, 1) - 1);
              return (
                <rect
                  fill={index && point.value < chart.points[index - 1].value ? '#ef4444' : '#10b981'}
                  height={volumeHeight}
                  key={`volume-${point.period}`}
                  opacity="0.42"
                  width={barWidth}
                  x={point.x - barWidth / 2}
                  y={height - volumeHeight}
                />
              );
            })
          : null}

        <motion.path
          animate={{ opacity: 1 }}
          d={chart.areaPath}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
        />
        <motion.path
          animate={{ opacity: 1, pathLength: 1 }}
          d={chart.linePath}
          fill="none"
          initial={{ opacity: 0.6, pathLength: 0 }}
          key={`${quote.id}-${range}`}
          stroke={chartColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={compact ? 3 : 2.5}
          transition={{ duration: compact ? 0.55 : 0.8, ease: 'easeOut' }}
        />

        {!compact && showAverage && chart.averagePath ? (
          <motion.path
            animate={{ opacity: 1, pathLength: 1 }}
            d={chart.averagePath}
            fill="none"
            initial={{ opacity: 0, pathLength: 0 }}
            stroke="#f59e0b"
            strokeDasharray="6 4"
            strokeWidth="2"
            transition={{ duration: 0.55 }}
          />
        ) : null}

        {hoveredPoint ? (
          <g>
            <line stroke={chartColor} strokeDasharray="4 4" x1={hoveredPoint.x} x2={hoveredPoint.x} y1="0" y2={height} />
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} fill="white" r="5" stroke={chartColor} strokeWidth="3" />
            <g transform={`translate(${Math.min(Math.max(hoveredPoint.x - 62, 4), width - 128)} ${Math.max(hoveredPoint.y - 58, 4)})`}>
              <rect fill="#0f172a" height="46" rx="6" width="124" />
              <text fill="white" fontSize="13" fontWeight="600" x="10" y="19">
                {formatPrice(hoveredPoint.value)}
              </text>
              <text fill="#cbd5e1" fontSize="10" x="10" y="35">
                {formatChartTime(hoveredPoint.period, range)}
              </text>
            </g>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function QuoteButton({ active, dark = false, onClick, quote }: { active?: boolean; dark?: boolean; onClick: () => void; quote: CommodityMarketQuote }) {
  const colors = getTrendClasses(quote);
  return (
    <button
      className={cn(
        'news-pressable min-w-0 border p-3 text-left transition-colors',
        dark
          ? 'border-slate-700 bg-[#101827] hover:bg-[#17233a]'
          : active
            ? 'border-sky-400 border-l-4 bg-sky-50/70'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('truncate text-xs font-semibold', dark ? 'text-white' : 'text-slate-950')}>{quote.shortLabel}</span>
        <span className="text-[10px] text-slate-400">{quote.symbol}</span>
      </div>
      <div className={cn('mt-2 text-base font-semibold tabular-nums', dark ? 'text-white' : 'text-slate-950')}>{formatPrice(quote.value)}</div>
      <div className={cn('mt-0.5 flex items-center gap-1 text-xs font-semibold tabular-nums', colors.text)}>
        <TrendIcon quote={quote} />
        {formatPercent(quote.changePercent)}
      </div>
    </button>
  );
}

function MarketStatus({ quote }: { quote: CommodityMarketQuote }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', quote.marketOpen ? 'text-emerald-700' : 'text-slate-500')}>
      <span className={cn('h-2 w-2 rounded-full', quote.marketOpen ? 'animate-pulse bg-emerald-500' : 'bg-slate-400')} />
      {quote.marketOpen ? 'Trh otvorený' : 'Trh zatvorený'}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 py-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-950">{value}</dd>
    </div>
  );
}

function MarketModal({ market, onClose, open }: { market: CommodityMarketSnapshot; onClose: () => void; open: boolean }) {
  const [activeGroup, setActiveGroup] = useState<CommodityMarketGroup | 'all'>('all');
  const [activeMarket, setActiveMarket] = useState(market);
  const [range, setRange] = useState<CommodityMarketRange>('1d');
  const [selectedId, setSelectedId] = useState(market.quotes[0]?.id ?? '');
  const [isRangeLoading, setIsRangeLoading] = useState(false);
  const [showAverage, setShowAverage] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open || range !== '1d') return;
    setActiveMarket(market);
  }, [market, open, range]);

  useEffect(() => {
    if (!open || activeMarket.range === range) return;
    const controller = new AbortController();
    setIsRangeLoading(true);
    fetchCommodityMarkets(controller.signal, range)
      .then((nextMarket) => setActiveMarket(nextMarket))
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name !== 'AbortError') console.error('Market range failed:', error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsRangeLoading(false);
      });
    return () => controller.abort();
  }, [activeMarket.range, open, range]);

  const selectedQuote = activeMarket.quotes.find((quote) => quote.id === selectedId) ?? activeMarket.quotes[0];
  const filteredQuotes = activeMarket.quotes.filter((quote) => activeGroup === 'all' || quote.group === activeGroup);
  const colors = selectedQuote ? getTrendClasses(selectedQuote) : null;

  useEffect(() => {
    if (selectedQuote && activeGroup !== 'all' && selectedQuote.group !== activeGroup) {
      setSelectedId(filteredQuotes[0]?.id ?? selectedQuote.id);
    }
  }, [activeGroup, filteredQuotes, selectedQuote]);

  if (!selectedQuote || !colors) return null;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-sm sm:p-4"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="mx-auto flex h-[100dvh] w-full max-w-[1500px] flex-col overflow-hidden bg-[#f4f6f8] sm:h-[calc(100dvh-2rem)] sm:rounded-lg"
            exit={{ opacity: 0, scale: 0.99, y: 12 }}
            initial={{ opacity: 0, scale: 0.99, y: 12 }}
            onClick={(event) => event.stopPropagation()}
            transition={{ duration: 0.2 }}
          >
            <header className="flex shrink-0 items-center justify-between border-t-4 border-sky-500 bg-[#0b1628] px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ChartColumnBig className="h-5 w-5 text-sky-400" />
                  <h2 className="truncate text-base font-semibold text-white sm:text-lg">Baky Markets</h2>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                  <Clock3 className="h-3 w-3" />
                  Aktualizované {formatMarketTime(activeMarket.updatedAt)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  aria-label="Otvoriť zdroj trhových dát"
                  className="news-pressable hidden h-9 items-center gap-2 border border-slate-600 px-3 text-xs font-medium text-slate-200 hover:bg-white/10 sm:flex"
                  href={`https://finance.yahoo.com/quote/${encodeURIComponent(selectedQuote.symbol)}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Zdroj
                </a>
                <button
                  aria-label="Zavrieť burzu"
                  className="news-pressable flex h-9 w-9 items-center justify-center border border-slate-600 text-slate-200 hover:bg-white/10"
                  onClick={onClose}
                  title="Zavrieť"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 sm:px-6">
              {GROUPS.map(({ icon: Icon, id, label }) => (
                <button
                  className={cn(
                    'news-pressable flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs font-medium',
                    activeGroup === id ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  )}
                  key={id}
                  onClick={() => setActiveGroup(id)}
                  type="button"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[270px_minmax(0,1fr)]">
              <aside className="border-b border-slate-200 bg-white lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
                <div className="flex gap-2 overflow-x-auto p-3 lg:grid lg:gap-1 lg:p-2">
                  {filteredQuotes.map((quote) => (
                    <div className="w-[152px] shrink-0 lg:w-auto" key={quote.id}>
                      <QuoteButton active={quote.id === selectedQuote.id} onClick={() => setSelectedId(quote.id)} quote={quote} />
                    </div>
                  ))}
                </div>
              </aside>

              <main className="min-h-0 overflow-y-auto bg-white">
                <div className="mx-auto max-w-6xl px-4 py-5 sm:px-7 sm:py-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{selectedQuote.symbol}</span>
                        <span>·</span>
                        <span>{selectedQuote.exchange}</span>
                        <span>·</span>
                        <MarketStatus quote={selectedQuote} />
                      </div>
                      <h3 className="mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">{selectedQuote.label}</h3>
                      <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
                        <span className="text-3xl font-semibold tabular-nums text-slate-950 sm:text-5xl">
                          {formatPrice(selectedQuote.value)}
                        </span>
                        <span className="pb-1 text-sm font-medium text-slate-500">{selectedQuote.currency}</span>
                      </div>
                      <div className={cn('mt-2 flex items-center gap-2 text-sm font-semibold tabular-nums', colors.text)}>
                        <TrendIcon className="h-4 w-4" quote={selectedQuote} />
                        {formatSigned(selectedQuote.change)} ({formatPercent(selectedQuote.changePercent)})
                        <span className="font-normal text-slate-400">{activeMarket.frequencyLabel}</span>
                      </div>
                    </div>
                    <div className="flex max-w-full items-center gap-1 overflow-x-auto border-b border-slate-200">
                      {RANGES.map((item) => (
                        <button
                          className={cn(
                            'news-pressable min-w-9 shrink-0 border-b-2 px-2.5 py-2 text-xs font-semibold',
                            range === item.id ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-950'
                          )}
                          key={item.id}
                          onClick={() => setRange(item.id)}
                          type="button"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500">
                      <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-sky-600" /> CENA</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-emerald-500/40" /> OBJEM</span>
                    </div>
                    <button
                      className={cn(
                        'news-pressable border px-2.5 py-1.5 text-[11px] font-semibold',
                        showAverage ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      )}
                      onClick={() => setShowAverage((value) => !value)}
                      type="button"
                    >
                      MA20
                    </button>
                  </div>

                  <div className="relative border-b border-slate-200 py-4">
                    {isRangeLoading ? (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75 backdrop-blur-[1px]">
                        <LoaderCircle className="h-6 w-6 animate-spin text-sky-600" />
                      </div>
                    ) : null}
                    <MarketChart quote={selectedQuote} range={range} showAverage={showAverage} />
                  </div>

                  <div className="mt-6 grid gap-x-8 md:grid-cols-[minmax(0,1fr)_280px]">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-950">Vývoj trhu</h4>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        Za obdobie {activeMarket.frequencyLabel.toLowerCase()} sa {selectedQuote.shortLabel}{' '}
                        {selectedQuote.trend === 'up' ? 'posunul vyššie' : selectedQuote.trend === 'down' ? 'oslabil' : 'výrazne nezmenil'} o{' '}
                        {formatPercent(selectedQuote.changePercent)}. Graf zobrazuje obchodné ceny, nie investičné odporúčanie.
                      </p>
                      <div className="mt-5 flex items-start gap-2 border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                        <Info className="mt-0.5 h-4 w-4 shrink-0" />
                        Trhové údaje môžu byť oneskorené. Futures ceny sa môžu líšiť od spotových cien komodít.
                      </div>
                    </div>
                    <div className="mt-6 md:mt-0">
                      <h4 className="border-b-2 border-sky-600 pb-2 text-sm font-semibold uppercase text-slate-950">Kľúčové dáta</h4>
                      <dl className="grid grid-cols-2 gap-x-4 md:block">
                      <Stat label="Predchádzajúca hodnota" value={selectedQuote.previousValue === null ? '—' : formatPrice(selectedQuote.previousValue)} />
                      <Stat label="Denné rozpätie" value={selectedQuote.dayLow === null || selectedQuote.dayHigh === null ? '—' : `${formatPrice(selectedQuote.dayLow)} – ${formatPrice(selectedQuote.dayHigh)}`} />
                      <Stat label="52-týždňové rozpätie" value={selectedQuote.fiftyTwoWeekLow === null || selectedQuote.fiftyTwoWeekHigh === null ? '—' : `${formatPrice(selectedQuote.fiftyTwoWeekLow)} – ${formatPrice(selectedQuote.fiftyTwoWeekHigh)}`} />
                      <Stat label="Objem" value={formatCompact(selectedQuote.volume)} />
                      </dl>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function CommodityMarketWidget({
  isLoading,
  isLive = false,
  isRefreshing = false,
  lastRefreshedAt = null,
  market,
}: CommodityMarketWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const featuredQuote = market?.quotes.find((quote) => quote.id === 'wti') ?? market?.quotes[0] ?? null;
  const highlights = market?.quotes.filter((quote) => ['wti', 'brent', 'gold', 'wheat'].includes(quote.id)) ?? [];

  useEffect(() => {
    if (!market) setIsOpen(false);
  }, [market]);

  if (isLoading && !market) {
    return (
      <section className="news-card-shadow border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <LoaderCircle className="h-4 w-4 animate-spin text-sky-600" />
          Načítavam trhy
        </div>
        <div className="mt-4 h-40 animate-pulse bg-slate-100" />
      </section>
    );
  }

  if (!market || !featuredQuote) return null;

  const colors = getTrendClasses(featuredQuote);

  return (
    <>
      <motion.section
        className="news-card-shadow overflow-hidden border border-slate-200 bg-white"
        initial={{ opacity: 0, y: 18 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        viewport={{ once: true }}
        whileInView={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between border-t-4 border-sky-500 bg-[#0b1628] px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <ChartColumnBig className="h-4 w-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-white">Komoditné trhy</h3>
              {isLive ? (
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  AKTUÁLNE
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">Energia, kovy a potraviny</p>
          </div>
          <button
            aria-label="Otvoriť detail burzy"
            className="news-pressable flex h-9 w-9 items-center justify-center border border-slate-600 text-slate-200 hover:bg-white/10"
            onClick={() => setIsOpen(true)}
            title="Otvoriť detail"
            type="button"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 border-b border-slate-700 bg-[#101827] lg:grid-cols-4">
          {highlights.map((quote) => (
            <div className="border-b border-r border-slate-200 last:border-r-0 lg:border-b-0" key={quote.id}>
              <QuoteButton dark onClick={() => setIsOpen(true)} quote={quote} />
            </div>
          ))}
        </div>

        <button className="block w-full p-4 text-left" onClick={() => setIsOpen(true)} type="button">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500">{featuredQuote.symbol} · {featuredQuote.exchange}</div>
              <div className="mt-1 text-lg font-semibold text-slate-950">{featuredQuote.label}</div>
            </div>
            <MarketStatus quote={featuredQuote} />
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-2xl font-semibold tabular-nums text-slate-950">{formatPrice(featuredQuote.value)}</span>
            <span className="pb-1 text-xs text-slate-500">{featuredQuote.currency}</span>
            <span className={cn('flex items-center gap-1 pb-1 text-xs font-semibold', colors.text)}>
              <TrendIcon quote={featuredQuote} />
              {formatPercent(featuredQuote.changePercent)}
            </span>
          </div>
          <div className="mt-2">
            <MarketChart compact quote={featuredQuote} range={market.range} />
          </div>
        </button>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5 text-[10px] text-slate-500">
          <span>{market.sourceLabel} · údaje môžu meškať</span>
          <span className="flex items-center gap-1 tabular-nums">
            {isRefreshing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Clock3 className="h-3 w-3" />}
            {lastRefreshedAt ? formatMarketTime(lastRefreshedAt) : formatMarketTime(market.updatedAt)}
          </span>
        </div>
      </motion.section>

      <MarketModal market={market} onClose={() => setIsOpen(false)} open={isOpen} />
    </>
  );
}
