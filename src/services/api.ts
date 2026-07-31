import {
  Category,
  CommodityMarketSnapshot,
  FeedSettings,
  NewsFeedResponse,
  WeatherSnapshot,
  WikiSummary,
} from '../types';

function hasCoordinates(settings?: Pick<FeedSettings, 'location' | 'useLocation'>) {
  return (
    Boolean(settings?.useLocation) &&
    typeof settings?.location?.latitude === 'number' &&
    typeof settings?.location?.longitude === 'number'
  );
}

export async function fetchNews(
  category: Category | string = 'general',
  query?: string,
  settings?: Pick<FeedSettings, 'language' | 'localEdition' | 'location' | 'region' | 'useLocation'>,
  refresh: boolean = false,
  signal?: AbortSignal
): Promise<NewsFeedResponse> {
  try {
    const url = new URL('/api/news', window.location.origin);
    if (query) {
      url.searchParams.append('q', query);
    }

    url.searchParams.append('category', category);
    url.searchParams.append('imageQuality', 'article-og-v2');
    if (settings?.language) {
      url.searchParams.append('lang', settings.language);
    }
    if (settings?.region) {
      url.searchParams.append('region', settings.region);
    }
    if (settings?.localEdition) {
      url.searchParams.append('localEdition', settings.localEdition);
    }
    if (hasCoordinates(settings)) {
      const location = settings!.location!;
      url.searchParams.append('latitude', String(location.latitude));
      url.searchParams.append('longitude', String(location.longitude));
      if (location.label) {
        url.searchParams.append('locationLabel', location.label);
      }
      if (location.query) {
        url.searchParams.append('locationQuery', location.query);
      }
    }

    if (refresh) {
      url.searchParams.append('refresh', 'true');
    }

    const response = await fetch(url.toString(), { signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch from local API (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      throw error;
    }
    console.error('Error fetching news:', error);
    throw error;
  }
}

export async function fetchWikiSummary(
  query: string,
  language: FeedSettings['language'] = 'en',
  signal?: AbortSignal
): Promise<WikiSummary | null> {
  if (!query) return null;
  try {
    const formattedQuery = encodeURIComponent(query.trim().replace(/\s+/g, '_'));
    const response = await fetch(
      `https://${language}.wikipedia.org/api/rest_v1/page/summary/${formattedQuery}`,
      { signal }
    );
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    if ((error as any).name === 'AbortError') throw error;
    console.error('Error fetching Wikipedia summary:', error);
    return null;
  }
}

export async function fetchWeather(
  settings: Pick<FeedSettings, 'language' | 'localEdition' | 'location' | 'region' | 'useLocation'>,
  signal?: AbortSignal
): Promise<WeatherSnapshot> {
  const url = new URL('/api/weather', window.location.origin);
  url.searchParams.append('lang', settings.language);
  url.searchParams.append('region', settings.region);
  url.searchParams.append('localEdition', settings.localEdition);
  if (hasCoordinates(settings)) {
    const location = settings.location!;
    url.searchParams.append('latitude', String(location.latitude));
    url.searchParams.append('longitude', String(location.longitude));
    if (location.label) {
      url.searchParams.append('locationLabel', location.label);
    }
  }

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch weather from local API (${response.status})`);
  }

  return await response.json();
}

export async function fetchCommodityMarkets(
  signal?: AbortSignal,
  range: CommodityMarketSnapshot['range'] = '1d'
): Promise<CommodityMarketSnapshot> {
  const url = new URL('/api/markets', window.location.origin);
  url.searchParams.set('range', range);
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch markets from local API (${response.status})`);
  }

  return await response.json();
}
