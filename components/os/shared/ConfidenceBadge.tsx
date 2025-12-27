'use client';

// components/os/shared/ConfidenceBadge.tsx
// Displays section confidence level with tooltip

import { useState } from 'react';
import { CheckCircle2, Minus, AlertTriangle } from 'lucide-react';
import type { SectionConfidence, ConfidenceResult } from '@/lib/os/ai/sectionConfidence';
import { getConfidenceDisplay } from '@/lib/os/ai/sectionConfidence';

interface ConfidenceBadgeProps {
  confidence: SectionConfidence;
  result?: ConfidenceResult;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function ConfidenceBadge({
  confidence,
  result,
  size = 'sm',
  showLabel = false,
}: ConfidenceBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const display = getConfidenceDisplay(confidence);

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  const Icon = display.icon === 'check' ? CheckCircle2 :
               display.icon === 'minus' ? Minus :
               AlertTriangle;

  return (
    <div className="relative inline-flex items-center">
      <div
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full cursor-help transition-colors ${display.bgColor} border ${display.borderColor}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Icon className={`${iconSize} ${display.color}`} />
        {showLabel && (
          <span className={`${textSize} ${display.color}`}>{display.label}</span>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && result && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-48">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
            <div className={`font-medium ${textSize} ${display.color} mb-2`}>
              {display.label}
            </div>
            <div className="space-y-1">
              {result.reasons.map((reason, i) => (
                <div key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                  <span className="text-slate-500">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-700">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Score</span>
                <span className="text-slate-300">{result.score}/100</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ConfidenceIndicatorProps {
  confidence: SectionConfidence;
}

/**
 * Minimal confidence indicator (just a colored dot)
 */
export function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const display = getConfidenceDisplay(confidence);

  const dotColor = confidence === 'high' ? 'bg-emerald-400' :
                   confidence === 'medium' ? 'bg-amber-400' :
                   'bg-red-400';

  return (
    <div
      className={`w-2 h-2 rounded-full ${dotColor}`}
      title={display.label}
    />
  );
}

export default ConfidenceBadge;
