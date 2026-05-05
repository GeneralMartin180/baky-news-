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

const regionOptions: Array<{ label: string; value: RegionCode }> = [
  { label: 'Slovensko', value: 'SK' },
  { label: 'United States', value: 'US' },
  { label: 'United Kingdom', value: 'GB' },
  { label: 'Česko', value: 'CZ' },
  { label: 'Deutschland', value: 'DE' },
  { label: 'Österreich', value: 'AT' },
];

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
};

export function FeedSettingsModal({
  isOpen,
  settings,
  onClose,
  onSave,
}: FeedSettingsModalProps) {
  const [draft, setDraft] = useState<FeedSettings>(settings);

  useEffect(() => {
    if (isOpen) {
      setDraft(settings);
    }
  }, [isOpen, settings]);

  const isLocalEditionEnabled = useMemo(
    () => draft.language === 'sk' && draft.region === 'SK',
    [draft.language, draft.region]
  );

  const normalizeSettings = (nextSettings: FeedSettings): FeedSettings => ({
    ...nextSettings,
    localEdition:
      nextSettings.language === 'sk' && nextSettings.region === 'SK'
        ? nextSettings.localEdition
        : 'all',
  });

  const commitSettings = (nextSettings: FeedSettings) => {
    const normalized = normalizeSettings(nextSettings);
    setDraft(normalized);
    onSave(normalized);
  };

  const handleSave = () => {
    onClose();
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
                    Jazyk, región, lokálna edícia a tempo automatického obnovovania.
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

                <label className="space-y-2">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                    <MapPinned className="h-4 w-4 text-sky-700" />
                    Región vydania
                  </span>
                  <select
                    value={draft.region}
                    onChange={(event) =>
                      commitSettings({
                        ...draft,
                        region: event.target.value as RegionCode,
                        localEdition:
                          draft.language === 'sk' && event.target.value === 'SK'
                            ? draft.localEdition
                            : 'all',
                      })
                    }
                    className="h-11 w-full rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition-colors focus:border-slate-500"
                  >
                    {regionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="news-soft-shadow rounded-lg border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                <div className="flex items-start gap-3">
                  <Globe2 className="mt-0.5 h-5 w-5 text-slate-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">
                      Ako to funguje
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Slovenská edícia vie miešať aj lokálne témy podľa mesta alebo regiónu.
                      Pri iných regiónoch ostáva feed globálny a lokálna edícia sa vypne.
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
                    Lokálna edícia je dostupná pre jazyk <strong>Slovenčina</strong> a región <strong>Slovensko</strong>.
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
