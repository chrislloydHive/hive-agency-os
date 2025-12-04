'use client';

// app/c/[companyId]/context-graph/components/DomainNav.tsx
// Domain navigation sidebar for context graph viewer

/**
 * Domain configuration mapping graph keys to display labels
 */
export const DOMAIN_CONFIG = [
  { id: 'identity', label: 'Identity', icon: 'building' },
  { id: 'brand', label: 'Brand', icon: 'sparkles' },
  { id: 'objectives', label: 'Objectives', icon: 'target' },
  { id: 'audience', label: 'Audience', icon: 'users' },
  { id: 'productOffer', label: 'Product & Offer', icon: 'cube' },
  { id: 'digitalInfra', label: 'Digital Infra', icon: 'server' },
  { id: 'website', label: 'Website', icon: 'globe' },
  { id: 'content', label: 'Content', icon: 'document-text' },
  { id: 'seo', label: 'SEO', icon: 'search' },
  { id: 'ops', label: 'Operations', icon: 'cog' },
  { id: 'performanceMedia', label: 'Media', icon: 'chart-bar' },
  { id: 'historical', label: 'Historical', icon: 'clock' },
  { id: 'creative', label: 'Creative', icon: 'color-swatch' },
  { id: 'competitive', label: 'Competitive', icon: 'shield-check' },
  { id: 'budgetOps', label: 'Budget', icon: 'currency-dollar' },
  { id: 'operationalConstraints', label: 'Constraints', icon: 'exclamation' },
  { id: 'storeRisk', label: 'Store Risk', icon: 'location-marker' },
  { id: 'historyRefs', label: 'History Refs', icon: 'archive' },
] as const;

interface DomainStat {
  id: string;
  label: string;
  icon?: string;
  coverage: number;
  staleCount: number;
  missingCount: number;
}

interface DomainNavProps {
  domains: DomainStat[];
  selectedDomainId: string;
  onSelect: (id: string) => void;
}

export function DomainNav({ domains, selectedDomainId, onSelect }: DomainNavProps) {
  return (
    <nav className="flex-1 overflow-y-auto p-2">
      <div className="space-y-0.5">
        {domains.map((domain) => {
          const isActive = selectedDomainId === domain.id;
          const hasIssues = domain.staleCount > 0 || domain.missingCount > 0;

          return (
            <button
              key={domain.id}
              onClick={() => onSelect(domain.id)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between group ${
                isActive
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <DomainIcon name={domain.icon || 'folder'} className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm truncate">{domain.label}</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Coverage indicator */}
                <span className={`text-xs tabular-nums ${
                  domain.coverage >= 70 ? 'text-emerald-400' :
                  domain.coverage >= 30 ? 'text-amber-400' :
                  domain.coverage > 0 ? 'text-red-400' :
                  'text-slate-600'
                }`}>
                  {domain.coverage}%
                </span>

                {/* Issue badges */}
                {hasIssues && (
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    domain.staleCount > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {domain.staleCount || domain.missingCount}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Simple icon component for domain navigation
 */
function DomainIcon({ name, className }: { name: string; className?: string }) {
  // Simplified icon rendering - using basic SVG paths
  const icons: Record<string, React.ReactNode> = {
    building: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    ),
    sparkles: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    ),
    target: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    ),
    users: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    ),
    cube: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    ),
    server: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    ),
    globe: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    'document-text': (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    ),
    search: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    ),
    cog: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    ),
    'chart-bar': (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    ),
    clock: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    'color-swatch': (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    ),
    'shield-check': (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    ),
    'currency-dollar': (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    exclamation: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    ),
    'location-marker': (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    ),
    archive: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    ),
    folder: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    ),
  };

  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {icons[name] || icons.folder}
    </svg>
  );
}
