'use client';

// components/intelligence/ScoreGauge.tsx
// Circular gauge component for displaying health scores

import { useMemo } from 'react';

interface ScoreGaugeProps {
  score: number; // 0-100
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ScoreGauge({
  score,
  label = 'Health Score',
  size = 'md',
  showLabel = true,
}: ScoreGaugeProps) {
  const normalizedScore = Math.max(0, Math.min(100, score));

  const { color, bgColor, textColor, status } = useMemo(() => {
    if (normalizedScore >= 70) {
      return {
        color: '#10b981', // emerald-500
        bgColor: 'bg-emerald-500/10',
        textColor: 'text-emerald-400',
        status: 'Healthy',
      };
    } else if (normalizedScore >= 50) {
      return {
        color: '#f59e0b', // amber-500
        bgColor: 'bg-amber-500/10',
        textColor: 'text-amber-400',
        status: 'Watching',
      };
    } else {
      return {
        color: '#ef4444', // red-500
        bgColor: 'bg-red-500/10',
        textColor: 'text-red-400',
        status: 'At Risk',
      };
    }
  }, [normalizedScore]);

  const dimensions = useMemo(() => {
    switch (size) {
      case 'sm':
        return { size: 80, strokeWidth: 6, fontSize: 'text-lg', labelSize: 'text-xs' };
      case 'lg':
        return { size: 160, strokeWidth: 12, fontSize: 'text-4xl', labelSize: 'text-sm' };
      default:
        return { size: 120, strokeWidth: 8, fontSize: 'text-2xl', labelSize: 'text-xs' };
    }
  }, [size]);

  const radius = (dimensions.size - dimensions.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${bgColor} rounded-full p-2`}>
        <svg
          width={dimensions.size}
          height={dimensions.size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={dimensions.size / 2}
            cy={dimensions.size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={dimensions.strokeWidth}
            className="text-slate-700"
          />
          {/* Progress circle */}
          <circle
            cx={dimensions.size / 2}
            cy={dimensions.size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={dimensions.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${dimensions.fontSize} ${textColor}`}>
            {normalizedScore}
          </span>
          {size !== 'sm' && (
            <span className={`${dimensions.labelSize} text-slate-400`}>{status}</span>
          )}
        </div>
      </div>
      {showLabel && (
        <span className="mt-2 text-sm text-slate-400">{label}</span>
      )}
    </div>
  );
}

export default ScoreGauge;
