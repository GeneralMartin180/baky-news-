import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Clock3,
  Globe2,
  Languages,
  MapPinned,
  Settings2,
  X,
} from 'lucide-react';

import {
  AutoRefreshMinutes,
  FeedSettings,
  LanguageCode,
  LocationPreference,
  LocalEdition,
  RegionCode,
} from '../types';
import { cn } from '../lib/utils';

interface FeedSettingsModalProps {
  isOpen: boolean;
  settings: FeedSettings;
  onClose: () => void;
  onSave: (settings: FeedSettings) => void;
}

const languageOptions: Array<{ label: string; value: LanguageCode }> = [
  { label: 'Slovenčina', value: 'sk' },
  { label: 'English', value: 'en' },
  { label: 'Čeština', value: 'cs' },
  { label: 'Deutsch', value: 'de' },
];

const supportedRegionCodes: RegionCode[] = ['SK', 'US', 'GB', 'CZ', 'DE', 'AT'];

const localEditionOptions: Array<{
  description: string;
  label: string;
  value: LocalEdition;
}> = [
  {
    label: 'Celé Slovensko',
    value: 'all',
    description: 'Vyvážený celoštátny mix hlavných správ.',
  },
  {
    label: 'Bratislava',
    value: 'bratislava',
    description: 'Doprava, magistrát, školy a mestské služby.',
  },
  {
    label: 'Košice',
    value: 'kosice',
    description: 'Mesto, bezpečnosť, verejný priestor a služby.',
  },
  {
    label: 'Prešov',
    value: 'presov',
    description: 'Krajské témy, doprava a lokálna infraštruktúra.',
  },
  {
    label: 'Rimavská Sobota',
    value: 'rimavska-sobota',
    description: 'Mesto, okres, služby a dianie v regióne južného stredného Slovenska.',
  },
  {
    label: 'Východ',
    value: 'vychod',
    description: 'Košice, Prešov a širší regionálny mix.',
  },
];

const refreshOptions: Array<{
  description: string;
  label: string;
  value: AutoRefreshMinutes;
}> = [
  { label: '1 min', value: 1, description: 'Najrýchlejší live refresh.' },
  { label: '5 min', value: 5, description: 'Rozumný produktový default.' },
  { label: '15 min', value: 15, description: 'Menej requestov, pokojnejší feed.' },
];

const DEFAULT_SETTINGS: FeedSettings = {
  language: 'sk',
  region: 'SK',
  autoRefreshMinutes: 1,
  localEdition: 'all',
  useLocation: false,
};

function resolveRegionFromLocation(countryCode: string | undefined, fallback: RegionCode): RegionCode {
  return supportedRegionCodes.includes(countryCode as RegionCode)
    ? (countryCode as RegionCode)
    : fallback;
}

function hasCoordinates(location: LocationPreference | undefined) {
  return typeof location?.latitude === 'number' && typeof location?.longitude === 'number';
}

function getCurrentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 10 * 60 * 1000,
      timeout: 10000,
    });
  });
}

async function reverseGeocodeLocation(
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
    const subdivision = data.principalSubdivision || data.localityInfo?.administrative?.[2]?.name;
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

export function FeedSettingsModal({
  isOpen,
  settings,
  onClose,
  onSave,
}: FeedSettingsModalProps) {
  const [draft, setDraft] = useState<FeedSettings>(settings);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(settings);
      setLocationError(null);
    }
  }, [isOpen, settings]);

  const isLocalEditionEnabled = useMemo(
    () => !draft.useLocation && draft.language === 'sk' && draft.region === 'SK',
    [draft.language, draft.region, draft.useLocation]
  );

  const normalizeSettings = (nextSettings: FeedSettings): FeedSettings => {
    if (nextSettings.useLocation && hasCoordinates(nextSettings.location)) {
      return {
        ...nextSettings,
        localEdition: 'all',
        region: resolveRegionFromLocation(nextSettings.location.countryCode, nextSettings.region),
      };
    }

    return {
      ...nextSettings,
      location: undefined,
      useLocation: false,
      localEdition:
        nextSettings.language === 'sk' && nextSettings.region === 'SK'
          ? nextSettings.localEdition
          : 'all',
    };
  };

  const commitSettings = (nextSettings: FeedSettings) => {
    const normalized = normalizeSettings(nextSettings);
    setDraft(normalized);
    onSave(normalized);
  };

  const handleSave = () => {
    onClose();
  };

  const handleLocationToggle = async () => {
    setLocationError(null);

    if (draft.useLocation) {
      commitSettings({
        ...draft,
        location: undefined,
        useLocation: false,
      });
      return;
    }

    if (!navigator.geolocation) {
      setLocationError('Prehliadač nepodporuje zisťovanie polohy.');
      return;
    }

    setIsResolvingLocation(true);
    try {
      const position = await getCurrentPosition();
      const location = await reverseGeocodeLocation(
        position.coords.latitude,
        position.coords.longitude
      );

      commitSettings({
        ...draft,
        localEdition: 'all',
        location,
        region: resolveRegionFromLocation(location.countryCode, draft.region),
        useLocation: true,
      });
    } catch {
      setLocationError('Poloha nebola povolená alebo sa ju nepodarilo načítať.');
    } finally {
      setIsResolvingLocation(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.985 }}
            transition={{ duration: 0.2 }}
            className="news-card-shadow flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200/80 bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="news-glass flex shrink-0 items-center justify-between border-b border-slate-200/80 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Nastavenia feedu
                  </h2>
                  <p className="text-sm text-slate-500">
                    Jazyk, poloha, lokálna edícia a tempo automatického obnovovania.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="news-pressable inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                aria-label="Zavrieť nastavenia"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Languages className="h-4 w-4 text-sky-700" />
                    Jazyk
                  </span>
                  <select
                    value={draft.language}
                    onChange={(event) =>
                      commitSettings({
                        ...draft,
                        language: event.target.value as LanguageCode,
                        localEdition:
                          event.target.value === 'sk' && draft.region === 'SK'
                            ? draft.localEdition
                            : 'all',
                      })
                    }
                    className="h-11 w-full rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition-colors focus:border-slate-500"
                  >
                    {languageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
                        <MapPinned className="h-4 w-4 text-sky-700" />
                        Povoliť polohu
                      </span>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Podľa polohy sa nastaví počasie, feed aj lokálne zoradenie správ.
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.useLocation}
                      aria-label={draft.useLocation ? 'Vypnúť polohu' : 'Povoliť polohu'}
                      onClick={handleLocationToggle}
                      disabled={isResolvingLocation}
                      className={cn(
                        'news-pressable relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors disabled:cursor-wait disabled:scale-100',
                        draft.useLocation
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-slate-300 bg-slate-200 hover:border-slate-400'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200',
                          draft.useLocation ? 'translate-x-7' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>

                  <div className="mt-3 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span
                      className={cn(
                        'font-semibold',
                        draft.useLocation ? 'text-emerald-700' : 'text-slate-500'
                      )}
                    >
                      {isResolvingLocation ? 'Načítavam polohu' : draft.useLocation ? 'Zapnuté' : 'Vypnuté'}
                    </span>
                    {draft.useLocation && draft.location?.label ? (
                      <span className="text-slate-500">Aktívne: {draft.location.label}</span>
                    ) : null}
                  </div>

                  {locationError ? (
                    <p className="mt-2 text-xs leading-5 text-rose-600">{locationError}</p>
                  ) : null}
                </div>
              </div>

              <div className="news-soft-shadow rounded-lg border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                <div className="flex items-start gap-3">
                  <Globe2 className="mt-0.5 h-5 w-5 text-slate-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">
                      Ako to funguje
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Keď povolíte polohu, počasie používa presné súradnice a správy sa zoradia podľa mesta alebo regiónu.
                      Bez povolenej polohy ostáva dostupná ručná lokálna edícia.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <MapPinned className="h-4 w-4 text-sky-700" />
                  Lokálna edícia
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {localEditionOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        isLocalEditionEnabled &&
                        commitSettings({
                          ...draft,
                          localEdition: option.value,
                        })
                      }
                      disabled={!isLocalEditionEnabled}
                      className={cn(
                        'news-pressable rounded-lg border px-4 py-4 text-left disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-60',
                        draft.localEdition === option.value
                          ? 'border-slate-900 bg-slate-900 text-white shadow-[0_18px_30px_-24px_rgba(15,23,42,0.85)]'
                          : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <div className="text-sm font-semibold">{option.label}</div>
                      <div
                        className={cn(
                          'mt-2 text-xs leading-5',
                          draft.localEdition === option.value
                            ? 'text-slate-300'
                            : 'text-slate-500'
                        )}
                      >
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>

                {!isLocalEditionEnabled ? (
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Lokálna edícia je dostupná pri ručnom nastavení pre jazyk <strong>Slovenčina</strong>. Pri povolenej polohe sa feed riadi aktuálnou polohou.
                  </p>
                ) : null}
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Clock3 className="h-4 w-4 text-sky-700" />
                  Automatické obnovovanie
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {refreshOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        commitSettings({
                          ...draft,
                          autoRefreshMinutes: option.value,
                        })
                      }
                      className={cn(
                        'news-pressable rounded-lg border px-4 py-4 text-left',
                        draft.autoRefreshMinutes === option.value
                          ? 'border-slate-900 bg-slate-900 text-white shadow-[0_18px_30px_-24px_rgba(15,23,42,0.85)]'
                          : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <div className="text-sm font-semibold">{option.label}</div>
                      <div
                        className={cn(
                          'mt-2 text-xs leading-5',
                          draft.autoRefreshMinutes === option.value
                            ? 'text-slate-300'
                            : 'text-slate-500'
                        )}
                      >
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between border-t border-slate-200/80 px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => commitSettings(DEFAULT_SETTINGS)}
                className="news-pressable text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                Reset na default
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="news-pressable inline-flex h-10 items-center rounded-full border border-slate-200/80 bg-white px-4 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                >
                  Zrušiť
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="news-pressable inline-flex h-10 items-center rounded-full bg-slate-950 px-4 text-sm font-medium text-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.9)] hover:bg-slate-800"
                >
                  Uložiť nastavenia
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
