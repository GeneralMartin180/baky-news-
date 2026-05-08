import { FeedSettings, LocationPreference, RegionCode } from '../types';

const SUPPORTED_REGION_CODES: RegionCode[] = ['SK', 'US', 'GB', 'CZ', 'DE', 'AT'];

export function resolveRegionFromLocation(
  countryCode: string | undefined,
  fallback: RegionCode
): RegionCode {
  return SUPPORTED_REGION_CODES.includes(countryCode as RegionCode)
    ? (countryCode as RegionCode)
    : fallback;
}

export function hasCoordinates(location: LocationPreference | undefined) {
  return typeof location?.latitude === 'number' && typeof location?.longitude === 'number';
}

export function supportsGeolocation() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export function getCurrentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 10 * 60 * 1000,
      timeout: 10000,
    });
  });
}

export async function reverseGeocodeLocation(
  latitude: number,
  longitude: number
): Promise<LocationPreference> {
  try {
    const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('localityLanguage', 'sk');

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Reverse geocode failed with ${response.status}`);
    }

    const data = await response.json();
    const city = data.city || data.locality || data.localityInfo?.administrative?.[3]?.name;
    const subdivision =
      data.principalSubdivision || data.localityInfo?.administrative?.[2]?.name;
    const countryName = data.countryName;
    const labelParts = [city, subdivision].filter(Boolean);
    const queryParts = [city, data.locality, subdivision, countryName].filter(Boolean);

    return {
      countryCode: data.countryCode,
      enabled: true,
      label: labelParts.length ? Array.from(new Set(labelParts)).join(', ') : 'Aktuálna poloha',
      latitude,
      longitude,
      query: Array.from(new Set(queryParts)).join(' '),
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      enabled: true,
      label: 'Aktuálna poloha',
      latitude,
      longitude,
      query: '',
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function resolveCurrentLocationPreference() {
  const position = await getCurrentPosition();
  return reverseGeocodeLocation(position.coords.latitude, position.coords.longitude);
}

export function withDetectedLocation(
  settings: FeedSettings,
  location: LocationPreference
): FeedSettings {
  return {
    ...settings,
    localEdition: 'all',
    location,
    region: resolveRegionFromLocation(location.countryCode, settings.region),
    useLocation: true,
  };
}
