// components/competition/LeftContextPanel.tsx
// Competition Lab v2 - Left Column
//
// Displays:
// - Company context snapshot
// - Competition scope filters
// - Run settings (advanced)

'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CompetitorRole } from '@/lib/competition/types';

// ============================================================================
// Types
// ============================================================================

export interface CompanyContext {
  businessName: string | null;
  domain: string | null;
  industry: string | null;
  icpDescription: string | null;
  geographicFootprint: string | null;
  marketMaturity: string | null;
  revenueModel: string | null;
  primaryOffers: string[];
}

export interface CompetitionFilters {
  roles: CompetitorRole[];
  sources: ('ai' | 'human')[];
  geoScope: 'local' | 'regional' | 'national' | 'global' | 'all';
  includeMarketplaces: boolean;
  includeInternational: boolean;
}

interface Props {
  companyId: string;
  companyContext: CompanyContext;
  filters: CompetitionFilters;
  onFiltersChange: (filters: CompetitionFilters) => void;
}

// ============================================================================
// Component
// ============================================================================

export function LeftContextPanel({
  companyId,
  companyContext,
  filters,
  onFiltersChange,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleRole = (role: CompetitorRole) => {
    const newRoles = filters.roles.includes(role)
      ? filters.roles.filter((r) => r !== role)
      : [...filters.roles, role];
    onFiltersChange({ ...filters, roles: newRoles });
  };

  const toggleSource = (source: 'ai' | 'human') => {
    const newSources = filters.sources.includes(source)
      ? filters.sources.filter((s) => s !== source)
      : [...filters.sources, source];
    onFiltersChange({ ...filters, sources: newSources });
  };

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-2">
      {/* Company Snapshot Card */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200">Company Snapshot</h3>
          <Link
            href={`/c/${companyId}/brain/context`}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Edit in Brain
          </Link>
        </div>

        <div className="space-y-3">
          {/* Business Name */}
          <div>
            <p className="text-xs text-slate-500">Business</p>
            <p className="text-sm text-slate-200">{companyContext.businessName || 'Not set'}</p>
          </div>

          {/* Domain */}
          {companyContext.domain && (
            <div>
              <p className="text-xs text-slate-500">Domain</p>
              <p className="text-sm text-slate-300">{companyContext.domain}</p>
            </div>
          )}

          {/* Industry */}
          <div>
            <p className="text-xs text-slate-500">Industry</p>
            <p className="text-sm text-slate-300">{companyContext.industry || 'Not set'}</p>
          </div>

          {/* ICP */}
          {companyContext.icpDescription && (
            <div>
              <p className="text-xs text-slate-500">ICP</p>
              <p className="text-sm text-slate-400 line-clamp-2">
                {companyContext.icpDescription}
              </p>
            </div>
          )}

          {/* Geographic Footprint */}
          <div>
            <p className="text-xs text-slate-500">Geographic Footprint</p>
            <span
              className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                companyContext.geographicFootprint
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {companyContext.geographicFootprint || 'Not set'}
            </span>
          </div>

          {/* Market Maturity */}
          {companyContext.marketMaturity && (
            <div>
              <p className="text-xs text-slate-500">Market Maturity</p>
              <p className="text-sm text-slate-300">{companyContext.marketMaturity}</p>
            </div>
          )}

          {/* Primary Offers */}
          {companyContext.primaryOffers.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Primary Offers</p>
              <div className="flex flex-wrap gap-1">
                {companyContext.primaryOffers.slice(0, 3).map((offer, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-400"
                  >
                    {offer}
                  </span>
                ))}
                {companyContext.primaryOffers.length > 3 && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-500">
                    +{companyContext.primaryOffers.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Competition Scope Card */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Competition Scope</h3>

        {/* Geo Scope */}
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-2">Geographic Scope</p>
          <div className="flex flex-wrap gap-1">
            {(['local', 'regional', 'national', 'global'] as const).map((geo) => (
              <button
                key={geo}
                onClick={() => onFiltersChange({ ...filters, geoScope: geo })}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  filters.geoScope === geo
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                }`}
              >
                {geo.charAt(0).toUpperCase() + geo.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Role Filter */}
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-2">Competitor Role</p>
          <div className="flex flex-wrap gap-1">
            {(['core', 'secondary', 'alternative'] as const).map((role) => {
              const isSelected = filters.roles.includes(role);
              const colors = {
                core: isSelected
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600',
                secondary: isSelected
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600',
                alternative: isSelected
                  ? 'bg-slate-600/20 text-slate-300 border-slate-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600',
              };
              return (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${colors[role]}`}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Source Filter */}
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-2">Source</p>
          <div className="flex gap-1">
            <button
              onClick={() => toggleSource('ai')}
              className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                filters.sources.includes('ai')
                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
              }`}
            >
              AI Discovered
            </button>
            <button
              onClick={() => toggleSource('human')}
              className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                filters.sources.includes('human')
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
              }`}
            >
              Human Provided
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Settings (Collapsible) */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-sm text-slate-400 hover:text-slate-300 transition-colors"
        >
          <span className="font-medium">Run Settings</span>
          <svg
            className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.includeMarketplaces}
                onChange={(e) =>
                  onFiltersChange({ ...filters, includeMarketplaces: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/50"
              />
              Include marketplaces & directories
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.includeInternational}
                onChange={(e) =>
                  onFiltersChange({ ...filters, includeInternational: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/50"
              />
              Include international competitors
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
