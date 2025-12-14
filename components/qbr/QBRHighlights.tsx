// components/qbr/QBRHighlights.tsx
// QBR Story View - Executive Highlights Component
//
// Displays executive summary bullets with category indicators.

import type { ExecutiveBullet } from '@/lib/os/qbr';

interface QBRHighlightsProps {
  bullets: ExecutiveBullet[];
}

export function QBRHighlights({ bullets }: QBRHighlightsProps) {
  if (bullets.length === 0) {
    return (
      <div className="py-6 text-center text-slate-500 italic">
        No highlights available
      </div>
    );
  }

  const getCategoryStyle = (category: ExecutiveBullet['category']) => {
    switch (category) {
      case 'opportunity':
        return {
          bg: 'bg-emerald-50 print:bg-emerald-100',
          border: 'border-emerald-200',
          text: 'text-emerald-800',
          label: 'Opportunity',
        };
      case 'risk':
        return {
          bg: 'bg-amber-50 print:bg-amber-100',
          border: 'border-amber-200',
          text: 'text-amber-800',
          label: 'Risk',
        };
      case 'decision':
        return {
          bg: 'bg-blue-50 print:bg-blue-100',
          border: 'border-blue-200',
          text: 'text-blue-800',
          label: 'Decision',
        };
      case 'insight':
      default:
        return {
          bg: 'bg-slate-50 print:bg-slate-100',
          border: 'border-slate-200',
          text: 'text-slate-800',
          label: 'Insight',
        };
    }
  };

  return (
    <div className="space-y-4">
      {bullets.map((bullet, i) => {
        const style = getCategoryStyle(bullet.category);
        return (
          <div
            key={i}
            className={`p-4 rounded-lg border ${style.bg} ${style.border}`}
          >
            <div className="flex items-start gap-4">
              <span className={`text-xs font-medium uppercase tracking-wide ${style.text} opacity-70 mt-0.5 min-w-[80px]`}>
                {style.label}
              </span>
              <p className={`text-lg ${style.text} leading-relaxed`}>
                {bullet.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
