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
    <div className="rounded-2xl border border-white/16 bg-white/12 px-3.5 py-3 text-white backdrop-blur-md">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-white/70">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1.5 text-lg font-semibold tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}

export function WeatherWidget({ isLoading, weather }: WeatherWidgetProps) {
  const presentation = weather
    ? getWeatherPresentation(weather.weatherCode, weather.isDay)
    : null;
  const Icon = presentation?.icon ?? CloudSun;

  return (
    <section
      className={`news-card-shadow overflow-hidden rounded-[20px] border border-white/20 bg-gradient-to-br ${
        presentation?.gradientClass ?? 'from-sky-500 via-sky-400 to-cyan-300'
      }`}
    >
      <div className="relative p-5 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.02)_40%,rgba(15,23,42,0.12)_100%)]" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/72">
                Miestne počasie
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">
                {weather?.locationLabel ?? 'Načítavam'}
              </h3>
              <p className="mt-1 text-sm text-white/74">
                {weather ? `Aktualizované ${formatTime(weather.updatedAt)}` : 'Krátky prehľad na dnes'}
              </p>
            </div>

            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/18 bg-white/14 backdrop-blur-md">
              <Icon className={`h-7 w-7 ${presentation?.accentClass ?? 'text-sky-100'}`} />
            </div>
          </div>

          {isLoading || !weather ? (
            <div className="mt-6 space-y-4">
              <div className="h-12 w-28 animate-pulse rounded-2xl bg-white/18" />
              <div className="h-5 w-44 animate-pulse rounded-full bg-white/16" />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-20 animate-pulse rounded-2xl bg-white/12" />
                <div className="h-20 animate-pulse rounded-2xl bg-white/12" />
                <div className="h-20 animate-pulse rounded-2xl bg-white/12" />
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 flex items-end justify-between gap-4">
                <div>
                  <div className="text-[56px] font-semibold leading-none tracking-[-0.03em] text-white">
                    {weather.temperatureC}°
                  </div>
                  <div className="mt-2 text-sm text-white/80">
                    {presentation?.label} · Pocitovo {weather.apparentTemperatureC}°
                  </div>
                </div>

                <div className="rounded-2xl border border-white/16 bg-white/12 px-3.5 py-3 text-right backdrop-blur-md">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/70">
                    Dnes
                  </div>
                  <div className="mt-1 text-base font-semibold text-white">
                    {weather.highC}° / {weather.lowC}°
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
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
