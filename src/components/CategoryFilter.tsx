import { BarChart3, Beaker, Cpu, Newspaper, Trophy } from 'lucide-react';

import { Category } from '../types';
import { cn } from '../lib/utils';

interface CategoryFilterProps {
  activeCategory: Category;
  onCategoryChange: (category: Category) => void;
}

const categories: Array<{
  id: Category;
  label: string;
  mobileLabel: string;
  icon: typeof Newspaper;
}> = [
  { id: 'general', label: 'Hlavne spravy', mobileLabel: 'Hlavne', icon: Newspaper },
  { id: 'technology', label: 'Technologie', mobileLabel: 'Tech', icon: Cpu },
  { id: 'business', label: 'Biznis', mobileLabel: 'Biznis', icon: BarChart3 },
  { id: 'sports', label: 'Sport', mobileLabel: 'Sport', icon: Trophy },
  { id: 'science', label: 'Veda', mobileLabel: 'Veda', icon: Beaker },
];

export function CategoryFilter({
  activeCategory,
  onCategoryChange,
}: CategoryFilterProps) {
  return (
    <div className="news-soft-shadow grid min-w-0 flex-1 grid-cols-5 gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/90 p-1 sm:inline-flex sm:flex-none sm:items-center sm:gap-1 sm:overflow-x-auto sm:rounded-full">
      {categories.map((category) => {
        const Icon = category.icon;
        const isActive = activeCategory === category.id;

        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              'news-pressable inline-flex min-h-[3rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-[10px] font-medium leading-tight sm:h-10 sm:min-h-0 sm:shrink-0 sm:flex-row sm:gap-2 sm:rounded-full sm:px-4 sm:py-0 sm:text-sm',
              isActive
                ? 'bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_20px_-18px_rgba(15,23,42,0.28)]'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-950'
            )}
            aria-pressed={isActive}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="line-clamp-1 sm:hidden">{category.mobileLabel}</span>
            <span className="hidden sm:inline">{category.label}</span>
          </button>
        );
      })}
    </div>
  );
}
