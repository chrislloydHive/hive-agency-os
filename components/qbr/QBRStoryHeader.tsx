// components/qbr/QBRStoryHeader.tsx
// QBR Story View - Header Component
//
// Shows company name, date, and data freshness indicator.

import type { DataFreshness } from '@/lib/os/qbr';

interface QBRStoryHeaderProps {
  companyName: string;
  generatedAt: string;
  dataFreshness: DataFreshness;
  dataSources: string[];
}

export function QBRStoryHeader({
  companyName,
  generatedAt,
  dataFreshness,
  dataSources,
}: QBRStoryHeaderProps) {
  const formattedDate = new Date(generatedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Calculate oldest data age
  const getDataAge = (dateStr?: string): string | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const freshnessDates = [
    dataFreshness.contextUpdatedAt,
    dataFreshness.strategyUpdatedAt,
    dataFreshness.competitionUpdatedAt,
    dataFreshness.labsUpdatedAt,
  ].filter(Boolean) as string[];

  const oldestDate = freshnessDates.length > 0
    ? freshnessDates.reduce((oldest, current) =>
        new Date(current) < new Date(oldest) ? current : oldest
      )
    : null;

  const oldestAge = oldestDate ? getDataAge(oldestDate) : 'Unknown';

  return (
    <header className="mb-12 pb-8 border-b border-slate-200 print:border-slate-300">
      {/* Company Name */}
      <div className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">
        Quarterly Business Review
      </div>
      <h1 className="text-4xl font-bold text-slate-900 mb-4">
        {companyName}
      </h1>

      {/* Date and Freshness */}
      <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{formattedDate}</span>
        </div>

        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Data as of: {oldestAge}</span>
        </div>

        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>{dataSources.length} sources</span>
        </div>
      </div>

      {/* Data Sources Pills - Hidden in print */}
      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        {dataSources.map((source) => (
          <span
            key={source}
            className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-600"
          >
            {source}
          </span>
        ))}
      </div>
    </header>
  );
}
