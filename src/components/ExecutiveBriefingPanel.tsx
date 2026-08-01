import { useEffect, useState } from 'react';
import { Check, Copy, FileText, Sparkles } from 'lucide-react';

import { DeskExecutiveBrief } from '../lib/news-intelligence';
import { cn } from '../lib/utils';

interface ExecutiveBriefingPanelProps {
  brief: DeskExecutiveBrief;
  digestMode: 'feed' | 'briefing' | 'radar';
}

export function ExecutiveBriefingPanel({
  brief,
  digestMode,
}: ExecutiveBriefingPanelProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(brief.clipboardText);
      setCopied(true);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <section className="news-card-shadow overflow-hidden rounded-lg border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(241,245,249,0.9)_100%)]">
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-sky-700">
              {brief.title}
            </p>
            <h3 className="mt-1 text-base font-semibold text-slate-950 sm:text-xl">
              {brief.headline}
            </h3>
            <p className="mt-1 max-w-3xl line-clamp-2 text-sm leading-5 text-slate-600">
              {brief.subheadline}
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'news-pressable inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium sm:text-sm',
              copied
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300'
            )}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="hidden sm:inline">{copied ? 'Skopírované' : 'Exportovať prehľad'}</span>
          </button>
        </div>

        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.3fr)_220px]">
          <div className="rounded-lg border border-slate-200/80 bg-white/85 p-3">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              <FileText className="h-3.5 w-3.5" />
              Kľúčové body
            </div>
            <div className="mt-2.5 space-y-2">
              {brief.points.slice(0, 2).map((point) => (
                <div
                  key={`${point.label}-${point.text}`}
                  className="rounded-lg border border-slate-200/70 bg-slate-50/80 px-3 py-2"
                >
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700">
                    {point.label}
                  </div>
                  <div className="mt-1 text-sm leading-5 text-slate-700">{point.text}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200/80 bg-slate-950 p-3 text-white">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/70">
              <Sparkles className="h-3.5 w-3.5" />
              Režim prehľadu
            </div>
            <div className="mt-2 text-lg font-semibold">
              {digestMode === 'briefing'
                ? 'Brífing'
                : digestMode === 'radar'
                  ? 'Radar'
                  : 'Prehľad'}
            </div>
            <p className="mt-1.5 text-sm leading-5 text-white/72">
              Kópia do e-mailu alebo internej správy.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
