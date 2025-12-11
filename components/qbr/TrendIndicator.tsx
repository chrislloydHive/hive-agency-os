'use client';

// components/qbr/TrendIndicator.tsx
// Trend direction indicator with arrow and delta value

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendIndicatorProps {
  trend: 'up' | 'down' | 'flat' | 'new';
  delta: number | null;
  showDelta?: boolean;
  size?: 'sm' | 'md';
}

export function TrendIndicator({ trend, delta, showDelta = true, size = 'sm' }: TrendIndicatorProps) {
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  if (trend === 'new') {
    return (
      <span className={`${textSize} text-slate-400 px-1.5 py-0.5 rounded bg-slate-800`}>
        New
      </span>
    );
  }

  if (trend === 'up') {
    return (
      <span className={`flex items-center gap-0.5 ${textSize} text-emerald-400`}>
        <TrendingUp className={iconSize} />
        {showDelta && delta !== null && `+${delta}`}
      </span>
    );
  }

  if (trend === 'down') {
    return (
      <span className={`flex items-center gap-0.5 ${textSize} text-red-400`}>
        <TrendingDown className={iconSize} />
        {showDelta && delta !== null && delta}
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-0.5 ${textSize} text-slate-400`}>
      <Minus className={iconSize} />
    </span>
  );
}
