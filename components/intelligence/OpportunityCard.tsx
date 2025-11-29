'use client';

// components/intelligence/OpportunityCard.tsx
// Card component for displaying opportunities

import Link from 'next/link';

interface OpportunityCardProps {
  id: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  companies: string[];
  companyNames: string[];
  category?: string;
  actionUrl?: string;
}

export function OpportunityCard({
  title,
  description,
  impact,
  companyNames,
  actionUrl,
}: OpportunityCardProps) {
  const impactStyles = {
    high: {
      bg: 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10',
      border: 'border-emerald-500/40',
      badge: 'bg-emerald-500 text-white',
      icon: 'text-emerald-400',
    },
    medium: {
      bg: 'bg-gradient-to-br from-blue-500/20 to-blue-600/10',
      border: 'border-blue-500/40',
      badge: 'bg-blue-500 text-white',
      icon: 'text-blue-400',
    },
    low: {
      bg: 'bg-gradient-to-br from-slate-500/20 to-slate-600/10',
      border: 'border-slate-500/40',
      badge: 'bg-slate-500 text-white',
      icon: 'text-slate-400',
    },
  };

  const styles = impactStyles[impact];

  return (
    <div className={`${styles.bg} ${styles.border} border rounded-xl p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className={`w-5 h-5 ${styles.icon}`} fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="font-semibold text-slate-100">{title}</h3>
        </div>
        <span className={`${styles.badge} text-xs font-semibold px-2 py-0.5 rounded-full uppercase`}>
          {impact} impact
        </span>
      </div>

      <p className="text-sm text-slate-300 mb-3">{description}</p>

      {companyNames.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {companyNames.slice(0, 4).map((name, idx) => (
            <span
              key={idx}
              className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded"
            >
              {name}
            </span>
          ))}
          {companyNames.length > 4 && (
            <span className="text-xs px-2 py-0.5 text-slate-500">
              +{companyNames.length - 4} more
            </span>
          )}
        </div>
      )}

      {actionUrl && (
        <Link
          href={actionUrl}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          Take action
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}

export default OpportunityCard;
