import React from 'react';
import { cn } from '../lib/utils';

export const Logo: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => {
  return (
    <img 
      src="/baky_news-removebg-preview.png" 
      alt="Baky News Logo" 
      className={cn(className, "object-contain")}
      draggable={false}
      referrerPolicy="no-referrer"
    />
  );
};
