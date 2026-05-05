import {
  BarChart3,
  Beaker,
  Cpu,
  HeartPulse,
  Newspaper,
  Trophy,
  Tv,
} from 'lucide-react';

import { Category } from '../types';
import { cn } from '../lib/utils';

interface CategoryFilterProps {
  activeCategory: Category;
  onCategoryChange: (category: Category) => void;
}

const categories: Array<{ id: Category; label: string; icon: typeof Newspaper }> = [
  { id: 'general', label: 'Hlavné správy', icon: Newspaper },
  { id: 'technology', label: 'Technológie', icon: Cpu },
  { id: 'business', label: 'Biznis', icon: BarChart3 },
  { id: 'sports', label: 'Šport', icon: Trophy },
  { id: 'science', label: 'Veda', icon: Beaker },
  { id: 'entertainment', label: 'Zábava', icon: Tv },
  { id: 'health', label: 'Zdravie', icon: HeartPulse },
];

export function CategoryFilter({
  activeCategory,
  onCategoryChange,
}: CategoryFilterProps) {
  return (
    <div className="news-soft-shadow inline-flex min-w-0 items-center gap-1 overflow-x-auto rounded-full border border-slate-200/80 bg-slate-100/90 p-1">
      {categories.map((category) => {
        const Icon = category.icon;
        const isActive = activeCategory === category.id;

        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              'news-pressable inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium',
              isActive
                ? 'bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_20px_-18px_rgba(15,23,42,0.28)]'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-950'
            )}
            aria-pressed={isActive}
          >
            <Icon className="h-4 w-4" />
            <span>{category.label}</span>
          </button>
        );
      })}
    </div>
  );
}
