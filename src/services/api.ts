import {
  Category,
  FeedSettings,
  NewsFeedResponse,
  WeatherSnapshot,
  WikiSummary,
} from '../types';

export async function fetchNews(
  category: Category | string = 'general',
  query?: string,
  settings?: Pick<FeedSettings, 'language' | 'localEdition' | 'region'>,
  refresh: boolean = false,
  signal?: AbortSignal
): Promise<NewsFeedResponse> {
  try {
    const url = new URL('/api/news', window.location.origin);
    if (query) {
      url.searchParams.append('q', query);
    }

    url.searchParams.append('category', category);
    if (settings?.language) {
      url.searchParams.append('lang', settings.language);
    }
    if (settings?.region) {
      url.searchParams.append('region', settings.region);
    }
    if (settings?.localEdition) {
      url.searchParams.append('localEdition', settings.localEdition);
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
  settings: Pick<FeedSettings, 'language' | 'localEdition' | 'region'>,
  signal?: AbortSignal
): Promise<WeatherSnapshot> {
  const url = new URL('/api/weather', window.location.origin);
  url.searchParams.append('lang', settings.language);
  url.searchParams.append('region', settings.region);
  url.searchParams.append('localEdition', settings.localEdition);

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch weather from local API (${response.status})`);
  }

  return await response.json();
}
