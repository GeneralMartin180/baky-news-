import ExcelJS from "exceljs";

import type { CommodityMarketQuote, CommodityMarketSnapshot } from "../../src/types";

type QuoteDefinition = {
  group: CommodityMarketQuote["group"];
  header: string;
  id: string;
  label: string;
  shortLabel: string;
};

const WORLD_BANK_COMMODITY_PAGE_URL = "https://www.worldbank.org/en/research/commodity-markets";
const SOURCE_LABEL = "World Bank Pink Sheet";
const FETCH_TIMEOUT_MS = 7000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const STALE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const QUOTES: QuoteDefinition[] = [
  {
    group: "energy",
    header: "Crude oil, Brent",
    id: "crude-oil-brent",
    label: "Ropa Brent",
    shortLabel: "Brent",
  },
  {
    group: "energy",
    header: "Crude oil, WTI",
    id: "crude-oil-wti",
    label: "Ropa WTI",
    shortLabel: "WTI",
  },
  {
    group: "oils",
    header: "Palm oil",
    id: "palm-oil",
    label: "Palmový olej",
    shortLabel: "Palmový",
  },
  {
    group: "oils",
    header: "Soybean oil",
    id: "soybean-oil",
    label: "Sójový olej",
    shortLabel: "Sójový",
  },
  {
    group: "oils",
    header: "Sunflower oil",
    id: "sunflower-oil",
    label: "Slnečnicový olej",
    shortLabel: "Slnečnicový",
  },
  {
    group: "food",
    header: "Maize",
    id: "maize",
    label: "Kukurica",
    shortLabel: "Kukurica",
  },
  {
    group: "food",
    header: "Wheat, US SRW",
    id: "wheat-srw",
    label: "Pšenica",
    shortLabel: "Pšenica",
  },
  {
    group: "food",
    header: "Rice, Thai 5%",
    id: "rice-thai-5",
    label: "Ryža",
    shortLabel: "Ryža",
  },
  {
    group: "food",
    header: "Sugar, world",
    id: "sugar-world",
    label: "Cukor",
    shortLabel: "Cukor",
  },
];

let cache:
  | {
      expiresAt: number;
      snapshot: CommodityMarketSnapshot;
      staleUntil: number;
    }
  | null = null;

function normalizeHeader(value: string) {
  return value.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
}

function normalizeUnit(value: string) {
  return value.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
}

function isPeriodCell(value: string) {
  return /^\d{4}M\d{2}$/.test(value);
}

function parseWorkbookUpdatedAt(rawValue: string) {
  const match = rawValue.match(/Updated on\s+(.+)/i);
  if (!match) {
    return new Date().toISOString();
  }

  const parsed = new Date(match[1]);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function parsePeriod(period: string) {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  return new Date(Date.UTC(year, month - 1, 1)).toISOString();
}

function readCellNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(/,/g, "");
    if (!normalized || normalized === "…" || normalized === "...") {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value && typeof value === "object") {
    if ("result" in value) {
      return readCellNumber((value as { result?: unknown }).result);
    }

    if ("text" in value) {
      return readCellNumber((value as { text?: unknown }).text);
    }
  }

  return null;
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
        "User-Agent": "Mozilla/5.0 BakyNews/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Commodity request failed with ${response.status}`);
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveLatestWorkbookUrl() {
  const response = await fetchWithTimeout(WORLD_BANK_COMMODITY_PAGE_URL);
  const html = await response.text();
  const match = html.match(
    /<a href="([^"]+CMO-Historical-Data-Monthly\.xlsx)">Monthly prices<\/a>/i
  );

  if (!match?.[1]) {
    throw new Error("Monthly commodity workbook URL was not found.");
  }

  return match[1];
}

function resolveQuoteTrend(changePercent: number | null): CommodityMarketQuote["trend"] {
  if (changePercent === null || Math.abs(changePercent) < 0.05) {
    return "flat";
  }

  return changePercent > 0 ? "up" : "down";
}

function findPeriodRowIndexes(sheet: ExcelJS.Worksheet) {
  const indexes: number[] = [];

  for (let rowIndex = 7; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const period = String(sheet.getRow(rowIndex).getCell(1).text || "").trim();
    if (isPeriodCell(period)) {
      indexes.push(rowIndex);
    }
  }

  return indexes;
}

function buildColumnMap(sheet: ExcelJS.Worksheet) {
  const headers = sheet.getRow(5);
  const units = sheet.getRow(6);
  const columns = new Map<string, { index: number; unit: string }>();

  for (let columnIndex = 2; columnIndex <= headers.cellCount; columnIndex += 1) {
    const header = normalizeHeader(headers.getCell(columnIndex).text || "");
    if (!header) {
      continue;
    }

    columns.set(header, {
      index: columnIndex,
      unit: normalizeUnit(units.getCell(columnIndex).text || "USD"),
    });
  }

  return columns;
}

function buildQuote(
  currentRow: ExcelJS.Row,
  previousRow: ExcelJS.Row,
  columns: Map<string, { index: number; unit: string }>,
  definition: QuoteDefinition
): CommodityMarketQuote | null {
  const column = columns.get(normalizeHeader(definition.header));
  if (!column) {
    return null;
  }

  const value = readCellNumber(currentRow.getCell(column.index).value);
  if (value === null) {
    return null;
  }

  const previousValue = readCellNumber(previousRow.getCell(column.index).value);
  const changePercent =
    previousValue && previousValue !== 0
      ? Number((((value - previousValue) / previousValue) * 100).toFixed(1))
      : null;

  return {
    changePercent,
    group: definition.group,
    id: definition.id,
    label: definition.label,
    previousValue,
    shortLabel: definition.shortLabel,
    trend: resolveQuoteTrend(changePercent),
    unit: column.unit,
    value: Number(value.toFixed(2)),
  };
}

async function readWorkbookSnapshot() {
  const workbookUrl = await resolveLatestWorkbookUrl();
  const workbookResponse = await fetchWithTimeout(workbookUrl);
  const workbookBuffer = Buffer.from(await workbookResponse.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(workbookBuffer);

  const sheet = workbook.getWorksheet("Monthly Prices");
  if (!sheet) {
    throw new Error("Monthly Prices sheet is missing.");
  }

  const periodRows = findPeriodRowIndexes(sheet);
  if (periodRows.length < 2) {
    throw new Error("Commodity workbook does not contain enough monthly rows.");
  }

  const currentRow = sheet.getRow(periodRows[periodRows.length - 1]);
  const previousRow = sheet.getRow(periodRows[periodRows.length - 2]);
  const latestPeriod = String(currentRow.getCell(1).text || "").trim();
  const columns = buildColumnMap(sheet);
  const quotes = QUOTES.map((definition) =>
    buildQuote(currentRow, previousRow, columns, definition)
  ).filter((quote): quote is CommodityMarketQuote => Boolean(quote));

  if (!quotes.length) {
    throw new Error("Commodity workbook did not produce any quotes.");
  }

  return {
    frequencyLabel: "Mesačný priemer",
    latestPeriod: parsePeriod(latestPeriod),
    quotes,
    sourceLabel: SOURCE_LABEL,
    sourceUrl: WORLD_BANK_COMMODITY_PAGE_URL,
    updatedAt: parseWorkbookUpdatedAt(String(sheet.getCell("A4").text || "")),
  } satisfies CommodityMarketSnapshot;
}

export async function getCommodityMarketSnapshot() {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.snapshot;
  }

  try {
    const snapshot = await readWorkbookSnapshot();
    cache = {
      expiresAt: now + CACHE_TTL_MS,
      snapshot,
      staleUntil: now + STALE_CACHE_TTL_MS,
    };
    return snapshot;
  } catch (error) {
    if (cache && cache.staleUntil > now) {
      return cache.snapshot;
    }

    throw error;
  }
}
