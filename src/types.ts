export interface NewsArticle {
  contentToken?: string;
  contentOverride?: string;
  title: string;
  description: string;
  url: string;
  urlToImage: string;
  publishedAt: string;
  source: {
    name: string;
  };
}

export interface WikiSummary {
  title: string;
  extract: string;
  thumbnail?: {
    source: string;
  };
  content_urls: {
    desktop: {
      page: string;
    };
  };
}

export type Category = 'general' | 'technology' | 'sports' | 'business' | 'science';
export type LanguageCode = 'sk' | 'en' | 'cs' | 'de';
export type RegionCode = 'SK' | 'US' | 'GB' | 'CZ' | 'DE' | 'AT';
export type AutoRefreshMinutes = 1 | 5 | 15;
export type LocalEdition =
  | 'all'
  | 'bratislava'
  | 'kosice'
  | 'presov'
  | 'rimavska-sobota'
  | 'vychod';

export interface EditorialBriefing {
  headline: string;
  kicker: string;
  summary: string;
  topTopics: string[];
  watchlist: string[];
  whyItMatters: string;
}

export interface LocalEditionSummary {
  badge: string;
  description: string;
  id: LocalEdition;
  label: string;
}

export interface NewsFeedResponse {
  articles: NewsArticle[];
  editorial: EditorialBriefing | null;
  localEdition: LocalEditionSummary | null;
}

export interface WeatherSnapshot {
  apparentTemperatureC: number;
  highC: number;
  isDay: boolean;
  locationLabel: string;
  lowC: number;
  precipitationProbabilityMax: number;
  temperatureC: number;
  updatedAt: string;
  weatherCode: number;
  windSpeedKmh: number;
}

export type CommodityMarketGroup = 'energy' | 'oils' | 'food';
export type CommodityMarketTrend = 'up' | 'down' | 'flat';

export interface CommodityMarketPoint {
  period: string;
  value: number;
}

export interface CommodityMarketQuote {
  changePercent: number | null;
  group: CommodityMarketGroup;
  history: CommodityMarketPoint[];
  id: string;
  label: string;
  previousValue: number | null;
  shortLabel: string;
  trend: CommodityMarketTrend;
  unit: string;
  value: number;
}

export interface CommodityMarketSnapshot {
  frequencyLabel: string;
  latestPeriod: string;
  quotes: CommodityMarketQuote[];
  sourceLabel: string;
  sourceUrl: string;
  updatedAt: string;
}

export interface LocationPreference {
  countryCode?: string;
  enabled: boolean;
  label?: string;
  latitude?: number;
  longitude?: number;
  query?: string;
  updatedAt?: string;
}

export interface FeedSettings {
  language: LanguageCode;
  region: RegionCode;
  autoRefreshMinutes: AutoRefreshMinutes;
  localEdition: LocalEdition;
  useLocation: boolean;
  location?: LocationPreference;
}
