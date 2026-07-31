import type {
  CommodityMarketGroup,
  CommodityMarketPoint,
  CommodityMarketQuote,
  CommodityMarketRange,
  CommodityMarketSnapshot,
} from "../../src/types";

type QuoteDefinition = {
  group: CommodityMarketGroup;
  id: string;
  label: string;
  shortLabel: string;
  symbol: string;
};

type YahooChartResult = {
  indicators?: {
    quote?: Array<{
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
  };
  meta?: Record<string, unknown>;
  timestamp?: number[];
};

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const SOURCE_LABEL = "Yahoo Finance";
const SOURCE_URL = "https://finance.yahoo.com/markets/";
const FETCH_TIMEOUT_MS = 6500;
const CACHE_TTL_MS = 30 * 1000;
const STALE_CACHE_TTL_MS = 10 * 60 * 1000;

const RANGE_CONFIG: Record<CommodityMarketRange, { interval: string; label: string }> = {
  "1d": { interval: "5m", label: "Dnes" },
  "5d": { interval: "15m", label: "5 dní" },
  "1mo": { interval: "1d", label: "1 mesiac" },
  "6mo": { interval: "1d", label: "6 mesiacov" },
  "ytd": { interval: "1d", label: "od začiatku roka" },
  "1y": { interval: "1d", label: "1 rok" },
  "5y": { interval: "1wk", label: "5 rokov" },
  "max": { interval: "1mo", label: "celá história" },
};

const QUOTES: QuoteDefinition[] = [
  { group: "energy", id: "wti", label: "Ropa WTI", shortLabel: "WTI", symbol: "CL=F" },
  { group: "energy", id: "brent", label: "Ropa Brent", shortLabel: "Brent", symbol: "BZ=F" },
  { group: "energy", id: "natural-gas", label: "Zemný plyn", shortLabel: "Plyn", symbol: "NG=F" },
  { group: "metals", id: "gold", label: "Zlato", shortLabel: "Zlato", symbol: "GC=F" },
  { group: "metals", id: "silver", label: "Striebro", shortLabel: "Striebro", symbol: "SI=F" },
  { group: "food", id: "wheat", label: "Pšenica", shortLabel: "Pšenica", symbol: "ZW=F" },
  { group: "food", id: "corn", label: "Kukurica", shortLabel: "Kukurica", symbol: "ZC=F" },
  { group: "food", id: "soybeans", label: "Sójové bôby", shortLabel: "Sója", symbol: "ZS=F" },
  { group: "food", id: "sugar", label: "Cukor", shortLabel: "Cukor", symbol: "SB=F" },
];

const cache = new Map<
  CommodityMarketRange,
  { expiresAt: number; snapshot: CommodityMarketSnapshot; staleUntil: number }
>();

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toIsoTime(epochSeconds: unknown) {
  const value = finiteNumber(epochSeconds);
  return value === null ? new Date().toISOString() : new Date(value * 1000).toISOString();
}

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function getMarketOpen(meta: Record<string, unknown>) {
  const periods = meta.currentTradingPeriod as
    | { regular?: { end?: number; start?: number } }
    | undefined;
  const start = finiteNumber(periods?.regular?.start);
  const end = finiteNumber(periods?.regular?.end);
  const now = Date.now() / 1000;
  return start !== null && end !== null && now >= start && now <= end;
}

function buildHistory(result: YahooChartResult): CommodityMarketPoint[] {
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];

  return timestamps
    .map<CommodityMarketPoint | null>((timestamp, index) => {
      const value = finiteNumber(closes[index]);
      if (value === null) return null;
      return {
        period: new Date(timestamp * 1000).toISOString(),
        value: round(value),
        volume: finiteNumber(result.indicators?.quote?.[0]?.volume?.[index]),
      };
    })
    .filter((point): point is CommodityMarketPoint => point !== null);
}

async function fetchQuote(definition: QuoteDefinition, range: CommodityMarketRange) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const config = RANGE_CONFIG[range];
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(definition.symbol)}?range=${range}&interval=${config.interval}&includePrePost=false&events=div%2Csplits`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; BakyNews/1.0; +https://baky-news.vercel.app/)",
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Market request failed with ${response.status}`);

    const payload = (await response.json()) as {
      chart?: { error?: unknown; result?: YahooChartResult[] };
    };
    const result = payload.chart?.result?.[0];
    if (!result || payload.chart?.error) throw new Error(`No chart data for ${definition.symbol}`);

    const meta = result.meta ?? {};
    const history = buildHistory(result);
    const value = finiteNumber(meta.regularMarketPrice) ?? history.at(-1)?.value ?? null;
    if (value === null || history.length < 2) throw new Error(`Incomplete chart data for ${definition.symbol}`);

    const firstHistoryValue = history[0].value;
    const chartPreviousClose = finiteNumber(meta.chartPreviousClose) ?? finiteNumber(meta.previousClose);
    const previousValue = range === "1d" ? chartPreviousClose ?? firstHistoryValue : firstHistoryValue;
    const change = previousValue === null ? null : round(value - previousValue);
    const changePercent =
      previousValue === null || previousValue === 0
        ? null
        : round(((value - previousValue) / previousValue) * 100, 2);

    return {
      change,
      changePercent,
      currency: stringValue(meta.currency, "USD"),
      dayHigh: finiteNumber(meta.regularMarketDayHigh),
      dayLow: finiteNumber(meta.regularMarketDayLow),
      exchange: stringValue(meta.fullExchangeName, stringValue(meta.exchangeName, "Burza")),
      fiftyTwoWeekHigh: finiteNumber(meta.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: finiteNumber(meta.fiftyTwoWeekLow),
      group: definition.group,
      history,
      id: definition.id,
      label: stringValue(meta.longName, definition.label),
      marketOpen: getMarketOpen(meta),
      marketTime: toIsoTime(meta.regularMarketTime),
      previousValue,
      shortLabel: definition.shortLabel,
      symbol: definition.symbol,
      trend:
        changePercent === null || Math.abs(changePercent) < 0.005
          ? "flat"
          : changePercent > 0
            ? "up"
            : "down",
      unit: stringValue(meta.currency, "USD"),
      value: round(value),
      volume: finiteNumber(meta.regularMarketVolume),
    } satisfies CommodityMarketQuote;
  } finally {
    clearTimeout(timeout);
  }
}

async function readMarketSnapshot(range: CommodityMarketRange) {
  const settled = await Promise.allSettled(QUOTES.map((quote) => fetchQuote(quote, range)));
  const quotes = settled
    .filter((result): result is PromiseFulfilledResult<CommodityMarketQuote> => result.status === "fulfilled")
    .map((result) => result.value);

  if (quotes.length < 3) throw new Error("Market feed returned too few instruments.");

  const latestTimestamp = quotes.reduce(
    (latest, quote) => Math.max(latest, new Date(quote.marketTime).getTime()),
    0
  );
  const updatedAt = new Date(latestTimestamp || Date.now()).toISOString();

  return {
    frequencyLabel: RANGE_CONFIG[range].label,
    latestPeriod: updatedAt,
    quotes,
    range,
    sourceLabel: SOURCE_LABEL,
    sourceUrl: SOURCE_URL,
    updatedAt,
  } satisfies CommodityMarketSnapshot;
}

export function isCommodityMarketRange(value: string): value is CommodityMarketRange {
  return value in RANGE_CONFIG;
}

export async function getCommodityMarketSnapshot(range: CommodityMarketRange = "1d") {
  const now = Date.now();
  const cached = cache.get(range);
  if (cached && cached.expiresAt > now) return cached.snapshot;

  try {
    const snapshot = await readMarketSnapshot(range);
    cache.set(range, {
      expiresAt: now + CACHE_TTL_MS,
      snapshot,
      staleUntil: now + STALE_CACHE_TTL_MS,
    });
    return snapshot;
  } catch (error) {
    if (cached && cached.staleUntil > now) return cached.snapshot;
    throw error;
  }
}
