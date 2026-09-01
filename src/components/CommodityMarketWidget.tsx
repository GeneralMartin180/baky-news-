import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartCandlestick,
  ChartColumnBig,
  ChartSpline,
  Clock3,
  ChevronDown,
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

const BAKY_MARKETS_LOGO_SRC = '/baky-markets-logo.png';

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

type CommodityChartMode = 'line' | 'candles';

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

function FufuArrow({ quote, className = 'h-4 w-4' }: { quote: CommodityMarketQuote; className?: string }) {
  const Icon = quote.trend === 'up' ? ArrowUpRight : quote.trend === 'down' ? ArrowDownRight : Minus;
  const magnitude = Math.min(Math.abs(quote.changePercent ?? 0), 6);
  const motionState =
    quote.trend === 'up'
      ? { rotate: -10 - magnitude * 3, y: -Math.min(1.5, magnitude * 0.25) }
      : quote.trend === 'down'
        ? { rotate: 10 + magnitude * 3, y: Math.min(1.5, magnitude * 0.25) }
        : { rotate: 0, y: 0 };
  const colorClass = quote.trend === 'up'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : quote.trend === 'down'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-slate-200 bg-slate-50 text-slate-500';

  return (
    <motion.span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full border shadow-sm', colorClass)}
      animate={motionState}
      transition={{ duration: 0.14, ease: 'easeOut' }}
    >
      <Icon className={className} />
    </motion.span>
  );
}

function BakyMarketsLogo({ className = '' }: { className?: string }) {
  return (
    <img
      alt="Baky Markets"
      className={cn('block h-8 w-auto shrink-0 object-contain sm:h-9', className)}
      src={BAKY_MARKETS_LOGO_SRC}
    />
  );
}

function aggregateCandles(quote: CommodityMarketQuote, maximumPoints: number) {
  const bucketSize = Math.max(1, Math.ceil(quote.history.length / maximumPoints));

  return Array.from({ length: Math.ceil(quote.history.length / bucketSize) }, (_, bucketIndex) => {
    const bucket = quote.history.slice(bucketIndex * bucketSize, (bucketIndex + 1) * bucketSize);
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    const open = first.open ?? first.value;
    const close = last.close ?? last.value;
    const volumes = bucket.map((point) => point.volume).filter((value): value is number => value !== null && value !== undefined);

    return {
      close,
      high: Math.max(...bucket.map((point) => point.high ?? point.value), open, close),
      low: Math.min(...bucket.map((point) => point.low ?? point.value), open, close),
      open,
      period: last.period,
      value: close,
      volume: volumes.length ? volumes.reduce((sum, value) => sum + value, 0) : null,
    };
  });
}

function getNormalizedHistory(quote: CommodityMarketQuote, mode: CommodityChartMode, maximumPoints: number) {
  if (!quote.history.length) {
    return [
      {
        close: quote.value,
        high: quote.dayHigh ?? quote.value,
        low: quote.dayLow ?? quote.value,
        open: quote.previousValue ?? quote.value,
        period: quote.marketTime,
        value: quote.value,
        volume: quote.volume ?? null,
      },
    ];
  }

  return mode === 'candles' ? aggregateCandles(quote, maximumPoints) : quote.history;
}

function getChartData(
  quote: CommodityMarketQuote,
  width: number,
  height: number,
  compact: boolean,
  mode: CommodityChartMode
) {
  const maximumCandles = Math.max(18, Math.min(compact ? 48 : 90, Math.floor(width / (compact ? 7 : 9))));
  const history = getNormalizedHistory(quote, mode, maximumCandles);
  const lows = history.map((point) => mode === 'candles' ? point.low ?? point.value : point.value);
  const highs = history.map((point) => mode === 'candles' ? point.high ?? point.value : point.value);
  const values = history.map((point) => point.close ?? point.value);
  const rawMin = Math.min(...lows);
  const rawMax = Math.max(...highs);
  const padding = Math.max((rawMax - rawMin) * 0.12, rawMax * 0.002, 0.01);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const valueRange = max - min || 1;
  const priceHeight = compact ? height : height * 0.76;
  const plotWidth = compact ? width : Math.max(width - 54, 1);
  const points = history.map((point, index) => ({
    close: point.close ?? point.value,
    closeY: priceHeight - (((point.close ?? point.value) - min) / valueRange) * priceHeight,
    high: point.high ?? point.value,
    highY: priceHeight - (((point.high ?? point.value) - min) / valueRange) * priceHeight,
    low: point.low ?? point.value,
    lowY: priceHeight - (((point.low ?? point.value) - min) / valueRange) * priceHeight,
    open: point.open ?? point.value,
    openY: priceHeight - (((point.open ?? point.value) - min) / valueRange) * priceHeight,
    period: point.period,
    value: point.close ?? point.value,
    volume: point.volume ?? null,
    x: mode === 'candles'
      ? ((index + 0.5) / Math.max(history.length, 1)) * plotWidth
      : (index / Math.max(history.length - 1, 1)) * plotWidth,
    y: priceHeight - (((point.close ?? point.value) - min) / valueRange) * priceHeight,
  }));
  const linePath = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${plotWidth} ${priceHeight} L 0 ${priceHeight} Z`;
  const averagePoints = points
    .map((point, index) => {
      if (index < 19) return null;
      const average = values.slice(index - 19, index + 1).reduce((sum, value) => sum + value, 0) / 20;
      return { x: point.x, y: priceHeight - ((average - min) / valueRange) * priceHeight };
    })
    .filter((point): point is { x: number; y: number } => point !== null);
  const averagePath = averagePoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const maxVolume = Math.max(...points.map((point) => point.volume ?? 0), 1);
  const candleWidth = Math.max(2, Math.min(compact ? 7 : 10, (plotWidth / Math.max(points.length, 1)) * 0.64));
  return { areaPath, averagePath, candleWidth, linePath, max, maxVolume, min, plotWidth, points, priceHeight };
}

function MarketChart({
  compact = false,
  mode,
  quote,
  range,
  showAverage = false,
}: {
  compact?: boolean;
  mode: CommodityChartMode;
  quote: CommodityMarketQuote;
  range: CommodityMarketRange;
  showAverage?: boolean;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ height: compact ? 128 : 310, width: compact ? 420 : 840 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const nextWidth = Math.max(Math.round(container.clientWidth), 1);
      const nextHeight = Math.max(Math.round(container.clientHeight), 1);
      setDimensions((current) => current.width === nextWidth && current.height === nextHeight
        ? current
        : { height: nextHeight, width: nextWidth });
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);
    return () => observer.disconnect();
  }, [compact]);

  const { height, width } = dimensions;
  const chart = useMemo(() => getChartData(quote, width, height, compact, mode), [compact, height, mode, quote, width]);
  const colors = getTrendClasses(quote);
  const chartColor = compact ? colors.fill : '#0088cc';
  const hoveredPoint = hoveredIndex === null ? null : chart.points[hoveredIndex];
  const gradientId = `market-area-${quote.id}-${range}-${mode}-${compact ? 'small' : 'large'}`;
  const hoveredPointY = hoveredPoint
    ? mode === 'candles'
      ? Math.max(12, Math.min(height - 12, (hoveredPoint.highY + hoveredPoint.lowY) / 2))
      : hoveredPoint.y
    : null;

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (compact) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const nextIndex = mode === 'candles'
      ? Math.floor(ratio * Math.max(chart.points.length, 1))
      : Math.round(ratio * Math.max(chart.points.length - 1, 0));
    setHoveredIndex(Math.min(Math.max(nextIndex, 0), Math.max(chart.points.length - 1, 0)));
  };

  return (
    <div ref={containerRef} className={cn('relative w-full overflow-hidden', compact ? 'h-32 sm:h-28' : 'h-[200px] sm:h-[360px]')}>
      <svg
        aria-label={`Vývoj ceny ${quote.label}`}
        className="h-full w-full touch-pan-y"
        onPointerLeave={() => setHoveredIndex(null)}
        onPointerMove={handlePointerMove}
        preserveAspectRatio="none"
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
                  x2={chart.plotWidth}
                  y1={step * chart.priceHeight}
                  y2={step * chart.priceHeight}
                />
                <text fill="#94a3b8" fontSize="11" x={chart.plotWidth + 7} y={Math.max(11, step * chart.priceHeight + 4)}>
                  {formatPrice(chart.max - step * (chart.max - chart.min))}
                </text>
              </g>
            ))
          : null}

        {!compact
          ? chart.points.map((point, index) => {
              const volumeHeight = ((point.volume ?? 0) / chart.maxVolume) * (height - chart.priceHeight - 12);
              const barWidth = Math.max(1, chart.plotWidth / Math.max(chart.points.length, 1) - 1);
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

        {mode === 'line' ? (
          <>
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
              key={`${quote.id}-${range}-${mode}`}
              stroke={chartColor}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={compact ? 3 : 2.5}
              transition={{ duration: compact ? 0.55 : 0.8, ease: 'easeOut' }}
            />
          </>
        ) : (
          <motion.g
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
            key={`${quote.id}-${range}-${mode}`}
            transition={{ duration: 0.35 }}
          >
            {chart.points.map((point) => {
              const rising = point.close >= point.open;
              const color = rising ? '#059669' : '#dc2626';
              const bodyTop = Math.min(point.openY, point.closeY);
              const bodyHeight = Math.max(Math.abs(point.openY - point.closeY), 1.5);
              return (
                <g key={`candle-${point.period}`}>
                  <line stroke={color} strokeWidth={compact ? 1.2 : 1.5} x1={point.x} x2={point.x} y1={point.highY} y2={point.lowY} />
                  <rect
                    fill={rising ? '#10b981' : '#ef4444'}
                    height={bodyHeight}
                    stroke={color}
                    strokeWidth="1"
                    width={chart.candleWidth}
                    x={point.x - chart.candleWidth / 2}
                    y={bodyTop}
                  />
                </g>
              );
            })}
          </motion.g>
        )}

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
            {mode === 'line' ? <circle cx={hoveredPoint.x} cy={hoveredPoint.y} fill="white" r="5" stroke={chartColor} strokeWidth="3" /> : null}
            {mode === 'candles' ? (
              <rect
                fill={hoveredPoint.close >= hoveredPoint.open ? '#10b981' : '#ef4444'}
                fillOpacity="0.12"
                height={Math.max(hoveredPoint.lowY - hoveredPoint.highY + 8, 14)}
                rx="4"
                width={Math.max(chart.candleWidth + 8, 12)}
                x={hoveredPoint.x - Math.max(chart.candleWidth + 8, 12) / 2}
                y={Math.max(hoveredPoint.highY - 4, 0)}
              />
            ) : null}
            <g transform={`translate(${Math.min(Math.max(hoveredPoint.x - (mode === 'candles' ? 82 : 62), 4), Math.max(chart.plotWidth - (mode === 'candles' ? 168 : 128), 4))} ${Math.max((hoveredPointY ?? 0) - (mode === 'candles' ? 84 : 58), 4)})`}>
              <rect fill="white" height={mode === 'candles' ? 72 : 46} rx="6" stroke="#cbd5e1" width={mode === 'candles' ? 164 : 124} />
              {mode === 'candles' ? (
                <>
                  <text fill="#0f172a" fontSize="12" fontWeight="700" x="10" y="17">
                    {formatChartTime(hoveredPoint.period, range)}
                  </text>
                  <text fill="#475569" fontSize="11" x="10" y="34">
                    O {formatPrice(hoveredPoint.open)}  H {formatPrice(hoveredPoint.high)}
                  </text>
                  <text fill="#475569" fontSize="11" x="10" y="50">
                    L {formatPrice(hoveredPoint.low)}  C {formatPrice(hoveredPoint.close)}
                  </text>
                </>
              ) : (
                <>
                  <text fill="#0f172a" fontSize="13" fontWeight="600" x="10" y="19">
                    {formatPrice(hoveredPoint.value)}
                  </text>
                  <text fill="#64748b" fontSize="10" x="10" y="35">
                    {formatChartTime(hoveredPoint.period, range)}
                  </text>
                </>
              )}
            </g>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function ChartModeToggle({
  compact = false,
  mode,
  onChange,
}: {
  compact?: boolean;
  mode: CommodityChartMode;
  onChange: (mode: CommodityChartMode) => void;
}) {
  const modes: Array<{ icon: typeof ChartSpline; id: CommodityChartMode; label: string }> = [
    { icon: ChartSpline, id: 'line', label: 'Čiara' },
    { icon: ChartCandlestick, id: 'candles', label: 'Sviečky' },
  ];

  return (
    <div aria-label="Typ grafu" className="flex shrink-0 border border-slate-200 bg-slate-50 p-0.5" role="group">
      {modes.map(({ icon: Icon, id, label }) => (
        <button
          aria-label={label}
          aria-pressed={mode === id}
          className={cn(
            'news-pressable flex h-7 items-center justify-center gap-1.5 px-2 text-[11px] font-semibold transition-colors',
            mode === id ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
          )}
          key={id}
          onClick={() => onChange(id)}
          title={label}
          type="button"
        >
          <Icon className="h-3.5 w-3.5" />
          <span className={compact ? 'sr-only' : ''}>{label}</span>
        </button>
      ))}
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
          ? 'border-sky-100 bg-sky-50/80 hover:border-sky-200 hover:bg-sky-100'
          : active
            ? 'border-sky-400 border-l-4 bg-sky-50/70'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-slate-950">{quote.shortLabel}</span>
        <span className="text-[10px] text-slate-400">{quote.symbol}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-base font-semibold tabular-nums text-slate-950">
        <span>{formatPrice(quote.value)}</span>
        <FufuArrow className="h-4 w-4" quote={quote} />
      </div>
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
    <div className="min-w-0 border-b border-slate-200 py-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold tabular-nums text-slate-950">{value}</dd>
    </div>
  );
}

function MarketModal({
  chartMode,
  market,
  onChartModeChange,
  onClose,
  open,
}: {
  chartMode: CommodityChartMode;
  market: CommodityMarketSnapshot;
  onChartModeChange: (mode: CommodityChartMode) => void;
  onClose: () => void;
  open: boolean;
}) {
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
    if (!open) return;

    if (range === '1d') {
      setActiveMarket(market);
      setIsRangeLoading(false);
      return;
    }

    if (activeMarket.range === range) {
      setIsRangeLoading(false);
      return;
    }

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
  }, [activeMarket.range, market, open, range]);

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
          className="fixed inset-0 z-[120] w-full max-w-full overflow-hidden bg-slate-950/55 backdrop-blur-sm sm:p-4"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="mx-auto flex h-[100dvh] min-w-0 w-full max-w-[1500px] flex-col overflow-hidden bg-[#f4f6f8] sm:h-[calc(100dvh-2rem)] sm:rounded-lg"
            exit={{ opacity: 0, scale: 0.99, y: 12 }}
            initial={{ opacity: 0, scale: 0.99, y: 12 }}
            onClick={(event) => event.stopPropagation()}
            transition={{ duration: 0.2 }}
          >
            <header className="flex min-w-0 shrink-0 items-center justify-between gap-3 border-t-4 border-sky-500 bg-gradient-to-r from-sky-50 via-white to-slate-50 px-3 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <BakyMarketsLogo className="h-9 sm:h-10" />
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                  <Clock3 className="h-3 w-3" />
                  Aktualizované {formatMarketTime(activeMarket.updatedAt)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  aria-label="Otvoriť zdroj trhových dát"
                  className="news-pressable hidden h-9 items-center gap-2 border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:flex"
                  href={`https://finance.yahoo.com/quote/${encodeURIComponent(selectedQuote.symbol)}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Zdroj
                </a>
                <button
                  aria-label="Zavrieť burzu"
                  className="news-pressable flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={onClose}
                  title="Zavrieť"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="grid w-full shrink-0 grid-cols-4 gap-1 border-b border-slate-200 bg-white px-2 py-2 sm:flex sm:overflow-x-auto sm:px-6">
              {GROUPS.map(({ icon: Icon, id, label }) => (
                <button
                  className={cn(
                    'news-pressable flex min-w-0 items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium sm:shrink-0 sm:gap-1.5 sm:px-3 sm:text-xs',
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

            <div className="grid min-h-0 min-w-0 w-full flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden lg:grid-cols-[270px_minmax(0,1fr)]">
              <aside className="min-w-0 w-full border-b border-slate-200 bg-white lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
                <div className="p-3 lg:hidden">
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase text-slate-500" htmlFor="mobile-market-select">
                    Komodita
                  </label>
                  <select
                    className="h-11 w-full min-w-0 border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-sky-500"
                    id="mobile-market-select"
                    onChange={(event) => setSelectedId(event.target.value)}
                    value={selectedQuote.id}
                  >
                    {filteredQuotes.map((quote) => (
                      <option key={quote.id} value={quote.id}>
                        {quote.shortLabel} · {formatPrice(quote.value)} {quote.currency}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="hidden gap-1 p-2 lg:grid">
                  {filteredQuotes.map((quote) => (
                    <div className="min-w-0" key={quote.id}>
                      <QuoteButton active={quote.id === selectedQuote.id} onClick={() => setSelectedId(quote.id)} quote={quote} />
                    </div>
                  ))}
                </div>
              </aside>

              <main className="min-h-0 min-w-0 w-full max-w-full overflow-x-hidden overflow-y-auto bg-white">
                <div className="mx-auto min-w-0 w-full max-w-6xl px-3 py-4 sm:px-7 sm:py-7">
                  <div className="flex min-w-0 flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                    <div className="min-w-0 max-w-full">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{selectedQuote.symbol}</span>
                        <span>·</span>
                        <span>{selectedQuote.exchange}</span>
                        <span>·</span>
                        <MarketStatus quote={selectedQuote} />
                      </div>
                  <h3 className="mt-2 text-lg font-semibold text-slate-950 sm:text-2xl">{selectedQuote.label}</h3>
                  <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-2 text-2xl font-semibold tabular-nums text-slate-950 sm:text-5xl">
                          <span>{formatPrice(selectedQuote.value)}</span>
                          <FufuArrow className="h-5 w-5 sm:h-8 sm:w-8" quote={selectedQuote} />
                        </span>
                        <span className="pb-1 text-sm font-medium text-slate-500">{selectedQuote.currency}</span>
                      </div>
                      <div className={cn('mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold tabular-nums sm:text-sm', colors.text)}>
                        <TrendIcon className="h-4 w-4" quote={selectedQuote} />
                        {formatSigned(selectedQuote.change)} ({formatPercent(selectedQuote.changePercent)})
                        <span className="font-normal text-slate-400">{activeMarket.frequencyLabel}</span>
                      </div>
                    </div>
                    <div className="grid w-full min-w-0 grid-cols-4 border-b border-slate-200 sm:flex sm:w-auto sm:max-w-full sm:items-center sm:gap-1 sm:overflow-x-auto">
                      {RANGES.map((item) => (
                        <button
                          className={cn(
                            'news-pressable min-w-0 border-b-2 px-1.5 py-2 text-xs font-semibold sm:min-w-9 sm:shrink-0 sm:px-2.5',
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

                  <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 sm:mt-6">
                    <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-slate-500 sm:gap-3">
                      <ChartModeToggle mode={chartMode} onChange={onChartModeChange} />
                      <span className="hidden items-center gap-1.5 sm:flex"><span className="h-0.5 w-5 bg-sky-600" /> CENA</span>
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

                  <div className="relative min-w-0 w-full max-w-full overflow-hidden border-b border-slate-200 py-3 sm:py-4">
                    {isRangeLoading ? (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75 backdrop-blur-[1px]">
                        <LoaderCircle className="h-6 w-6 animate-spin text-sky-600" />
                      </div>
                    ) : null}
                    <MarketChart mode={chartMode} quote={selectedQuote} range={range} showAverage={showAverage} />
                  </div>

                  <div className="mt-5 grid gap-x-8 md:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="hidden sm:block">
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
                    <div className="mt-0">
                      <h4 className="border-b-2 border-sky-600 pb-2 text-sm font-semibold uppercase text-slate-950">Kľúčové dáta</h4>
                      <dl className="grid min-w-0 grid-cols-1 gap-x-4 min-[380px]:grid-cols-2 md:block">
                      <Stat label="Predchádzajúca hodnota" value={selectedQuote.previousValue === null ? '—' : formatPrice(selectedQuote.previousValue)} />
                      <Stat label="Denné rozpätie" value={selectedQuote.dayLow === null || selectedQuote.dayHigh === null ? '—' : `${formatPrice(selectedQuote.dayLow)} – ${formatPrice(selectedQuote.dayHigh)}`} />
                      <Stat label="52-týždňové rozpätie" value={selectedQuote.fiftyTwoWeekLow === null || selectedQuote.fiftyTwoWeekHigh === null ? '—' : `${formatPrice(selectedQuote.fiftyTwoWeekLow)} – ${formatPrice(selectedQuote.fiftyTwoWeekHigh)}`} />
                      <Stat label="Objem" value={formatCompact(selectedQuote.volume)} />
                      </dl>
                    </div>
                  </div>

                  <details className="group mt-4 border border-slate-200 bg-slate-50 p-3 sm:hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-950 [&::-webkit-details-marker]:hidden">
                      <span>Vývoj trhu</span>
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="mt-3 space-y-3">
                      <p className="text-sm leading-6 text-slate-600">
                        Za obdobie {activeMarket.frequencyLabel.toLowerCase()} sa {selectedQuote.shortLabel}{' '}
                        {selectedQuote.trend === 'up' ? 'posunul vyššie' : selectedQuote.trend === 'down' ? 'oslabil' : 'výrazne nezmenil'} o{' '}
                        {formatPercent(selectedQuote.changePercent)}. Graf zobrazuje obchodné ceny, nie investičné odporúčanie.
                      </p>
                      <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                        <Info className="mt-0.5 h-4 w-4 shrink-0" />
                        Trhové údaje môžu byť oneskorené. Futures ceny sa môžu líšiť od spotových cien komodít.
                      </div>
                    </div>
                  </details>
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
  const [chartMode, setChartMode] = useState<CommodityChartMode>('line');
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
        className="news-card-shadow min-w-0 w-full max-w-full overflow-hidden border border-slate-200 bg-white"
        initial={{ opacity: 0, y: 18 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        viewport={{ once: true }}
        whileInView={{ opacity: 1, y: 0 }}
      >
        <div className="flex min-w-0 items-center justify-between gap-2 border-t-4 border-sky-500 bg-gradient-to-r from-sky-50 via-white to-slate-50 px-3 py-3 sm:px-4">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <BakyMarketsLogo className="h-7 sm:h-8" />
              {isLive ? (
                <span className="hidden shrink-0 items-center gap-1 text-[10px] font-medium text-emerald-700 min-[390px]:flex">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  AKTUÁLNE
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:text-[11px]">Energia, kovy a potraviny</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ChartModeToggle compact mode={chartMode} onChange={setChartMode} />
            <button
              aria-label="Otvoriť detail burzy"
              className="news-pressable flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              onClick={() => setIsOpen(true)}
              title="Otvoriť detail"
              type="button"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-slate-200 bg-white lg:grid-cols-4">
          {highlights.map((quote) => (
            <div className="border-b border-r border-slate-200 last:border-r-0 lg:border-b-0" key={quote.id}>
              <QuoteButton dark onClick={() => setIsOpen(true)} quote={quote} />
            </div>
          ))}
        </div>

        <button className="block min-w-0 w-full max-w-full overflow-hidden p-3 text-left sm:p-4" onClick={() => setIsOpen(true)} type="button">
          <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <div className="truncate text-xs text-slate-500">{featuredQuote.symbol} · {featuredQuote.exchange}</div>
              <div className="mt-1 truncate text-base font-semibold text-slate-950 sm:text-lg">{featuredQuote.label}</div>
            </div>
            <span className="shrink-0"><MarketStatus quote={featuredQuote} /></span>
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-2 text-2xl font-semibold tabular-nums text-slate-950">
              <span>{formatPrice(featuredQuote.value)}</span>
              <FufuArrow className="h-4 w-4 sm:h-5 sm:w-5" quote={featuredQuote} />
            </span>
            <span className="pb-1 text-xs text-slate-500">{featuredQuote.currency}</span>
            <span className={cn('flex items-center gap-1 pb-1 text-xs font-semibold', colors.text)}>
              <TrendIcon quote={featuredQuote} />
              {formatPercent(featuredQuote.changePercent)}
            </span>
          </div>
          <div className="mt-2 min-w-0 w-full max-w-full overflow-hidden">
            <MarketChart compact mode={chartMode} quote={featuredQuote} range={market.range} />
          </div>
        </button>

        <div className="flex min-w-0 items-center justify-between gap-2 border-t border-slate-200 px-3 py-2.5 text-[10px] text-slate-500 sm:px-4">
          <span className="min-w-0 truncate">{market.sourceLabel} · údaje môžu meškať</span>
          <span className="flex shrink-0 items-center gap-1 tabular-nums">
            {isRefreshing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Clock3 className="h-3 w-3" />}
            {lastRefreshedAt ? formatMarketTime(lastRefreshedAt) : formatMarketTime(market.updatedAt)}
          </span>
        </div>
      </motion.section>

      <MarketModal
        chartMode={chartMode}
        market={market}
        onChartModeChange={setChartMode}
        onClose={() => setIsOpen(false)}
        open={isOpen}
      />
    </>
  );
}
