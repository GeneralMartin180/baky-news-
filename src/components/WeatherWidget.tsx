import type { ComponentType } from 'react';

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  MoonStar,
  Sun,
  Wind,
} from 'lucide-react';

import { WeatherSnapshot } from '../types';

interface WeatherWidgetProps {
  compact?: boolean;
  isLoading: boolean;
  weather: WeatherSnapshot | null;
}

function getWeatherPresentation(weatherCode: number, isDay: boolean) {
  if (weatherCode === 0) {
    return {
      accentClass: isDay ? 'text-amber-100' : 'text-indigo-100',
      gradientClass: isDay
        ? 'from-sky-500 via-sky-400 to-cyan-300'
        : 'from-slate-950 via-indigo-900 to-slate-700',
      icon: isDay ? Sun : MoonStar,
      label: isDay ? 'Jasno' : 'Jasná noc',
    };
  }

  if ([1, 2].includes(weatherCode)) {
    return {
      accentClass: 'text-sky-100',
      gradientClass: isDay
        ? 'from-sky-600 via-sky-500 to-cyan-400'
        : 'from-slate-900 via-slate-800 to-indigo-800',
      icon: isDay ? CloudSun : CloudMoon,
      label: 'Polooblačno',
    };
  }

  if (weatherCode === 3) {
    return {
      accentClass: 'text-slate-100',
      gradientClass: 'from-slate-700 via-slate-600 to-slate-500',
      icon: Cloud,
      label: 'Oblačno',
    };
  }

  if ([45, 48].includes(weatherCode)) {
    return {
      accentClass: 'text-slate-100',
      gradientClass: 'from-slate-600 via-slate-500 to-slate-400',
      icon: CloudFog,
      label: 'Hmla',
    };
  }

  if ([51, 53, 55, 56, 57].includes(weatherCode)) {
    return {
      accentClass: 'text-cyan-100',
      gradientClass: 'from-sky-800 via-sky-700 to-cyan-600',
      icon: CloudDrizzle,
      label: 'Mrholenie',
    };
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    return {
      accentClass: 'text-cyan-100',
      gradientClass: 'from-slate-800 via-sky-800 to-cyan-700',
      icon: CloudRain,
      label: 'Dážď',
    };
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return {
      accentClass: 'text-sky-50',
      gradientClass: 'from-slate-700 via-sky-500 to-cyan-300',
      icon: CloudSnow,
      label: 'Sneženie',
    };
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return {
      accentClass: 'text-amber-100',
      gradientClass: 'from-slate-950 via-slate-900 to-indigo-950',
      icon: CloudLightning,
      label: 'Búrky',
    };
  }

  return {
    accentClass: 'text-sky-100',
    gradientClass: 'from-sky-700 via-sky-600 to-cyan-500',
    icon: Cloud,
    label: 'Počasie',
  };
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('sk-SK', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function WeatherMetric({
  icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  const Icon = icon;

  return (
    <div className="rounded-lg border border-white/16 bg-white/12 px-2 py-1.5 text-white backdrop-blur-md sm:rounded-2xl sm:px-3.5 sm:py-3">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.1em] text-white/70 sm:gap-1.5 sm:text-[11px] sm:tracking-[0.16em]">
        <Icon className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
        {label}
      </div>
      <div className="mt-0.5 text-xs font-semibold text-white sm:mt-1.5 sm:text-lg">
        {value}
      </div>
    </div>
  );
}

export function WeatherWidget({ compact = false, isLoading, weather }: WeatherWidgetProps) {
  const presentation = weather
    ? getWeatherPresentation(weather.weatherCode, weather.isDay)
    : null;
  const Icon = presentation?.icon ?? CloudSun;

  if (compact) {
    return (
      <section
        className={`news-card-shadow overflow-hidden rounded-lg border border-white/20 bg-gradient-to-br ${
          presentation?.gradientClass ?? 'from-sky-500 via-sky-400 to-cyan-300'
        }`}
      >
        <div className="relative flex min-h-[68px] items-center gap-3 px-3 py-2.5 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.02)_55%,rgba(15,23,42,0.12)_100%)]" />
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/14 backdrop-blur-md">
            <Icon className={`h-5 w-5 ${presentation?.accentClass ?? 'text-sky-100'}`} />
          </div>

          <div className="relative min-w-0 flex-1">
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-white/72">
              {weather?.locationLabel ?? 'Miestne počasie'}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-white">
              {isLoading || !weather
                ? 'Načítavam počasie'
                : `${presentation?.label} · Pocitovo ${weather.apparentTemperatureC}°`}
            </p>
          </div>

          <div className="relative shrink-0 text-right">
            <div className="text-[28px] font-semibold leading-none">
              {weather ? `${weather.temperatureC}°` : '--°'}
            </div>
            <div className="mt-1 text-[10px] text-white/72">
              {weather ? `${weather.highC}° / ${weather.lowC}°` : 'dnes'}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`news-card-shadow overflow-hidden rounded-[18px] border border-white/20 bg-gradient-to-br sm:rounded-[20px] ${
        presentation?.gradientClass ?? 'from-sky-500 via-sky-400 to-cyan-300'
      }`}
    >
      <div className="relative p-3 text-white sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.02)_40%,rgba(15,23,42,0.12)_100%)]" />

        <div className="relative">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/72 sm:text-[11px] sm:tracking-[0.18em]">
                Miestne počasie
              </p>
              <h3 className="mt-1 text-sm font-semibold text-white sm:mt-2 sm:text-xl">
                {weather?.locationLabel ?? 'Načítavam'}
              </h3>
              <p className="mt-0.5 text-[11px] text-white/74 sm:mt-1 sm:text-sm">
                {weather ? `Aktualizované ${formatTime(weather.updatedAt)}` : 'Krátky prehľad na dnes'}
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/18 bg-white/14 backdrop-blur-md sm:h-14 sm:w-14">
              <Icon className={`h-4 w-4 sm:h-7 sm:w-7 ${presentation?.accentClass ?? 'text-sky-100'}`} />
            </div>
          </div>

          {isLoading || !weather ? (
            <div className="mt-3 space-y-2.5 sm:mt-6 sm:space-y-4">
              <div className="h-8 w-20 animate-pulse rounded-xl bg-white/18 sm:h-12 sm:w-28 sm:rounded-2xl" />
              <div className="h-3 w-32 animate-pulse rounded-full bg-white/16 sm:h-5 sm:w-44" />
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="h-12 animate-pulse rounded-xl bg-white/12 sm:h-20 sm:rounded-2xl" />
                <div className="h-12 animate-pulse rounded-xl bg-white/12 sm:h-20 sm:rounded-2xl" />
                <div className="h-12 animate-pulse rounded-xl bg-white/12 sm:h-20 sm:rounded-2xl" />
              </div>
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-end justify-between gap-3 sm:mt-6 sm:gap-4 sm:justify-between">
                <div>
                  <div className="text-[32px] font-semibold leading-none text-white sm:text-[56px]">
                    {weather.temperatureC}°
                  </div>
                  <div className="mt-1 text-[11px] text-white/80 sm:mt-2 sm:text-sm">
                    {presentation?.label} · Pocitovo {weather.apparentTemperatureC}°
                  </div>
                </div>

                <div className="rounded-lg border border-white/16 bg-white/12 px-2.5 py-2 text-left backdrop-blur-md sm:rounded-2xl sm:px-3.5 sm:py-3 sm:text-right">
                  <div className="text-[9px] uppercase tracking-[0.1em] text-white/70 sm:text-[11px] sm:tracking-[0.16em]">
                    Dnes
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-white sm:mt-1 sm:text-base">
                    {weather.highC}° / {weather.lowC}°
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-3">
                <WeatherMetric
                  icon={Droplets}
                  label="Zrážky"
                  value={`${weather.precipitationProbabilityMax}%`}
                />
                <WeatherMetric
                  icon={Wind}
                  label="Vietor"
                  value={`${weather.windSpeedKmh} km/h`}
                />
                <WeatherMetric
                  icon={Sun}
                  label="Rozsah"
                  value={`${weather.lowC}°–${weather.highC}°`}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
