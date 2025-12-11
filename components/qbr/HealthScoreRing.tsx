'use client';

// components/qbr/HealthScoreRing.tsx
// Circular health score indicator with animated ring

interface HealthScoreRingProps {
  score: number;
  size?: 'xl' | 'large' | 'small' | 'tiny';
  showLabel?: boolean;
}

export function HealthScoreRing({ score, size = 'large', showLabel = false }: HealthScoreRingProps) {
  const dimensions = {
    xl: { radius: 70, strokeWidth: 12, fontSize: 'text-5xl' },
    large: { radius: 50, strokeWidth: 10, fontSize: 'text-3xl' },
    small: { radius: 35, strokeWidth: 6, fontSize: 'text-xl' },
    tiny: { radius: 20, strokeWidth: 4, fontSize: 'text-sm' },
  };

  const { radius, strokeWidth, fontSize } = dimensions[size];
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80 ? 'text-emerald-400' :
    score >= 60 ? 'text-blue-400' :
    score >= 40 ? 'text-amber-400' : 'text-red-400';

  const bgColor =
    score >= 80 ? 'stroke-emerald-400/20' :
    score >= 60 ? 'stroke-blue-400/20' :
    score >= 40 ? 'stroke-amber-400/20' : 'stroke-red-400/20';

  const svgSize = (radius + strokeWidth) * 2;

  return (
    <div className="relative inline-flex flex-col items-center justify-center">
      <svg width={svgSize} height={svgSize} className="transform -rotate-90">
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={bgColor}
        />
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${color.replace('text-', 'stroke-')} transition-all duration-500`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${fontSize} font-bold ${color}`}>
          {score}
        </span>
      </div>
      {showLabel && (
        <span className="text-[10px] text-slate-500 mt-1">Health Score</span>
      )}
    </div>
  );
}
