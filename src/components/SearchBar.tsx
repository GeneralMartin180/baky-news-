import { FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
  isLoading?: boolean;
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  onClear,
  isLoading,
}: SearchBarProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim()) {
      onSearch();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="news-card-shadow flex h-12 items-center rounded-full border border-slate-200/80 bg-white px-2 pl-3 transition-[border-color,box-shadow] duration-200 focus-within:border-slate-300 focus-within:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_36px_-28px_rgba(15,23,42,0.22)] sm:h-[52px] sm:pl-4">
        <div className="text-slate-400">
          <Search className="h-4 w-4" />
        </div>

        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Hľadať správy, témy alebo osoby"
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-950 outline-none placeholder:text-slate-400 sm:px-3 sm:text-[15px]"
        />

        <div className="flex items-center gap-1">
          <AnimatePresence>
            {value ? (
              <motion.button
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                type="button"
                onClick={onClear}
                className="news-pressable inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:h-9 sm:w-9"
                aria-label="Vymazať vyhľadávanie"
              >
                <X className="h-4 w-4" />
              </motion.button>
            ) : null}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isLoading || !value.trim()}
            className="news-pressable group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white shadow-[0_10px_22px_-18px_rgba(15,23,42,0.9)] hover:bg-slate-800 disabled:cursor-not-allowed disabled:scale-100 disabled:bg-slate-300 disabled:shadow-none sm:h-10 sm:w-10"
            aria-label="Hľadať"
            title="Hľadať"
          >
            <Search className="h-4 w-4 transition-transform duration-200 ease-out group-hover:scale-110" />
          </button>
        </div>
      </div>
    </form>
  );
}
