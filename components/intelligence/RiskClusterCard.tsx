'use client';

// components/intelligence/RiskClusterCard.tsx
// Card component for displaying risk clusters

import Link from 'next/link';

interface RiskClusterCardProps {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  companies: string[];
  companyNames: string[];
  category?: string;
}

export function RiskClusterCard({
  title,
  description,
  severity,
  count,
  companyNames,
}: RiskClusterCardProps) {
  const severityStyles = {
    critical: {
      bg: 'bg-gradient-to-br from-red-500/20 to-red-600/10',
      border: 'border-red-500/40',
      badge: 'bg-red-500 text-white',
      icon: 'text-red-400',
    },
    high: {
      bg: 'bg-gradient-to-br from-orange-500/20 to-orange-600/10',
      border: 'border-orange-500/40',
      badge: 'bg-orange-500 text-white',
      icon: 'text-orange-400',
    },
    medium: {
      bg: 'bg-gradient-to-br from-amber-500/20 to-amber-600/10',
      border: 'border-amber-500/40',
      badge: 'bg-amber-500 text-slate-900',
      icon: 'text-amber-400',
    },
    low: {
      bg: 'bg-gradient-to-br from-slate-500/20 to-slate-600/10',
      border: 'border-slate-500/40',
      badge: 'bg-slate-500 text-white',
      icon: 'text-slate-400',
    },
  };

  const styles = severityStyles[severity];

  return (
    <div className={`${styles.bg} ${styles.border} border rounded-xl p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className={`w-5 h-5 ${styles.icon}`} fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="font-semibold text-slate-100">{title}</h3>
        </div>
        <span className={`${styles.badge} text-xs font-semibold px-2 py-0.5 rounded-full uppercase`}>
          {severity}
        </span>
      </div>

      <p className="text-sm text-slate-300 mb-3">{description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-slate-100">{count}</span>
          <span className="text-sm text-slate-400">companies</span>
        </div>
        <Link
          href={`/companies?risk=true`}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          View all
        </Link>
      </div>

      {companyNames.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <div className="flex flex-wrap gap-1">
            {companyNames.slice(0, 5).map((name, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded"
              >
                {name}
              </span>
            ))}
            {companyNames.length > 5 && (
              <span className="text-xs px-2 py-0.5 text-slate-500">
                +{companyNames.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default RiskClusterCard;
