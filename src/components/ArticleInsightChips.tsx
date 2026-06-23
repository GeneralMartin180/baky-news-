import { Clock3, ShieldCheck, Target } from 'lucide-react';

import { cn } from '../lib/utils';
import { DeskArticleInsight } from '../lib/news-intelligence';

interface ArticleInsightChipsProps {
  compact?: boolean;
  insight: DeskArticleInsight;
}

const toneClasses: Record<DeskArticleInsight['impact'], string> = {
  high: 'border-rose-200 bg-rose-50 text-rose-700',
  local: 'border-sky-200 bg-sky-50 text-sky-700',
  market: 'border-amber-200 bg-amber-50 text-amber-700',
  watch: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const trustClasses: Record<DeskArticleInsight['trust'], string> = {
  trusted: 'border-slate-200 bg-slate-50 text-slate-700',
  regional: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  mixed: 'border-zinc-200 bg-zinc-50 text-zinc-700',
  'low-signal': 'border-orange-200 bg-orange-50 text-orange-700',
};

export function ArticleInsightChips({
  compact = false,
  insight,
}: ArticleInsightChipsProps) {
  const baseClass = compact
    ? 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium'
    : 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium';

  const iconClass = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn(baseClass, toneClasses[insight.impact])}>
        <Target className={iconClass} />
        {insight.impactLabel}
      </span>
      <span className={cn(baseClass, trustClasses[insight.trust])}>
        <ShieldCheck className={iconClass} />
        {insight.sourceLabel}
      </span>
      <span className={cn(baseClass, 'border-slate-200 bg-white text-slate-600')}>
        <Clock3 className={iconClass} />
        {insight.readTimeMinutes} min
      </span>
    </div>
  );
}
