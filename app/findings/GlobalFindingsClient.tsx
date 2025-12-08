'use client';

// app/findings/GlobalFindingsClient.tsx
// Global Findings Dashboard Client Component
//
// Client-side component for the global findings dashboard with:
// - Summary strip showing counts by severity
// - Filters for time range, labs, severities, categories, companies, converted
// - Top Companies leaderboard
// - Table of findings
// - Detail drawer for individual findings

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ChevronDown, X, Check, Search, Loader2, AlertTriangle } from 'lucide-react';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';
import type { GlobalFindingsSummary, CompanyFindingCount, DiagnosticDetailFindingWithCompany } from '@/lib/os/findings/globalFindings';

// ============================================================================
// Types
// ============================================================================

interface FilterOption {
  value: string;
  label: string;
  color?: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface FilterOptions {
  companies: CompanyOption[];
  labs: FilterOption[];
  severities: FilterOption[];
  categories: FilterOption[];
  timeRanges: { value: string; label: string; days: number | null }[];
}

// ============================================================================
// Severity Colors
// ============================================================================

const severityColors: Record<string, { bg: string; text: string; ring: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', ring: 'ring-red-500/30' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', ring: 'ring-orange-500/30' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', ring: 'ring-yellow-500/30' },
  low: { bg: 'bg-slate-500/20', text: 'text-slate-400', ring: 'ring-slate-500/30' },
};

// ============================================================================
// Multi-Select Dropdown Component
// ============================================================================

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  loading,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        disabled={loading}
        onClick={() => setOpen(!open)}
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
          ${selected.length > 0
            ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30'
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }
          ${loading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {label}
        {selected.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-cyan-500/30">
            {selected.length}
          </span>
        )}
        <ChevronDown className="w-4 h-4 opacity-50" />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-48 origin-top-left rounded-lg bg-slate-800 border border-slate-700 shadow-lg z-20 max-h-64 overflow-y-auto">
          <div className="p-2 space-y-1">
            {options.map(option => (
              <button
                key={option.value}
                onClick={() => toggleOption(option.value)}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-slate-700
                  ${selected.includes(option.value) ? 'text-cyan-400' : 'text-slate-300'}
                `}
              >
                <span
                  className={`
                    w-4 h-4 rounded border flex items-center justify-center
                    ${selected.includes(option.value)
                      ? 'border-cyan-500 bg-cyan-500'
                      : 'border-slate-600'
                    }
                  `}
                >
                  {selected.includes(option.value) && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="capitalize">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Company Search Dropdown
// ============================================================================

function CompanySearchDropdown({
  companies,
  selected,
  onChange,
  loading,
}: {
  companies: CompanyOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCompanies = search
    ? companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : companies;

  const toggleCompany = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(c => c !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        disabled={loading}
        onClick={() => setOpen(!open)}
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
          ${selected.length > 0
            ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30'
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }
          ${loading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        Company
        {selected.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-cyan-500/30">
            {selected.length}
          </span>
        )}
        <ChevronDown className="w-4 h-4 opacity-50" />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-64 origin-top-left rounded-lg bg-slate-800 border border-slate-700 shadow-lg z-20">
          <div className="p-2 border-b border-slate-700">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search companies..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-md text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>
          <div className="p-2 max-h-64 overflow-y-auto space-y-1">
            {filteredCompanies.slice(0, 50).map(company => (
              <button
                key={company.id}
                onClick={() => toggleCompany(company.id)}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-slate-700
                  ${selected.includes(company.id) ? 'text-cyan-400' : 'text-slate-300'}
                `}
              >
                <span
                  className={`
                    w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                    ${selected.includes(company.id)
                      ? 'border-cyan-500 bg-cyan-500'
                      : 'border-slate-600'
                    }
                  `}
                >
                  {selected.includes(company.id) && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="truncate">{company.name}</span>
              </button>
            ))}
            {filteredCompanies.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-2">No companies found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Summary Strip Component
// ============================================================================

function SummaryStrip({ summary, loading }: { summary: GlobalFindingsSummary | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center gap-6 animate-pulse">
          <div className="h-12 w-24 bg-slate-800 rounded" />
          <div className="h-8 w-px bg-slate-800" />
          <div className="flex gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-8 w-16 bg-slate-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const severityOrder = ['critical', 'high', 'medium', 'low'];
  const orderedSeverities = severityOrder
    .filter(s => summary.bySeverity[s] > 0)
    .map(s => ({ severity: s, count: summary.bySeverity[s] }));

  const topLabs = Object.entries(summary.byLab)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lab, count]) => ({ lab, count }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-6">
        {/* Total Findings */}
        <div className="flex flex-col">
          <span className="text-3xl font-semibold text-white">{summary.total}</span>
          <span className="text-xs text-slate-400 uppercase tracking-wide">
            Findings across {summary.companyCount} companies
          </span>
        </div>

        <div className="h-12 w-px bg-slate-800" />

        {/* Severity Badges */}
        <div className="flex flex-wrap gap-2">
          {orderedSeverities.map(({ severity, count }) => {
            const colors = severityColors[severity] || severityColors.low;
            return (
              <span
                key={severity}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text} ring-1 ${colors.ring}`}
              >
                <span className="capitalize">{severity}</span>
                <span className="opacity-80">({count})</span>
              </span>
            );
          })}
        </div>

        {topLabs.length > 0 && <div className="h-12 w-px bg-slate-800" />}

        {/* Lab Badges */}
        {topLabs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {topLabs.map(({ lab, count }) => (
              <span
                key={lab}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20"
              >
                <span className="capitalize">{lab}</span>
                <span className="opacity-80">({count})</span>
              </span>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* Conversion Status */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-400">{summary.converted} converted</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-slate-400">{summary.unconverted} pending</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Top Companies Leaderboard
// ============================================================================

function TopCompaniesLeaderboard({ companies }: { companies: CompanyFindingCount[] }) {
  if (companies.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Companies Needing Attention
        </h3>
      </div>
      <div className="divide-y divide-slate-800/50">
        {companies.slice(0, 5).map((company, index) => (
          <Link
            key={company.companyId}
            href={`/c/${company.companyId}/findings`}
            className="flex items-center gap-4 px-4 py-3 hover:bg-slate-800/50 transition-colors"
          >
            <span className="text-lg font-semibold text-slate-500 w-6">{index + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{company.companyName}</p>
              <p className="text-xs text-slate-500">{company.totalFindings} total findings</p>
            </div>
            <div className="flex items-center gap-2">
              {company.critical > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-500/20 text-red-400">
                  {company.critical} critical
                </span>
              )}
              {company.high > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-500/20 text-orange-400">
                  {company.high} high
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Findings Table
// ============================================================================

function SeverityBadge({ severity }: { severity?: string }) {
  const config: Record<string, { bg: string; text: string; icon: string }> = {
    critical: { bg: 'bg-red-500/20', text: 'text-red-400', icon: '!' },
    high: { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: '!' },
    medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: '~' },
    low: { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: '-' },
  };
  const c = config[severity || 'medium'] || config.medium;
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${c.bg} ${c.text}`} title={severity || 'Medium'}>
      {c.icon}
    </span>
  );
}

function FindingsTable({
  findings,
  loading,
  onSelectFinding,
  selectedFindingId,
}: {
  findings: DiagnosticDetailFindingWithCompany[];
  loading: boolean;
  onSelectFinding: (finding: DiagnosticDetailFindingWithCompany | null) => void;
  selectedFindingId?: string;
}) {
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="animate-pulse">
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-800/50 border-b border-slate-800">
            {[1, 2, 2, 2, 3, 2].map((w, i) => (
              <div key={i} className={`col-span-${w} h-4 bg-slate-700 rounded`} />
            ))}
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="grid grid-cols-12 gap-4 px-4 py-4 border-b border-slate-800/50">
              {[1, 2, 2, 2, 3, 2].map((w, j) => (
                <div key={j} className={`col-span-${w} h-4 bg-slate-800 rounded`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-white mb-2">No findings found</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          Try adjusting your filters or run diagnostic Labs on companies to populate findings.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-800/50 border-b border-slate-800 text-xs font-medium text-slate-400 uppercase tracking-wide">
        <div className="col-span-1">Sev</div>
        <div className="col-span-1">Lab</div>
        <div className="col-span-2">Company</div>
        <div className="col-span-2">Category</div>
        <div className="col-span-4">Description</div>
        <div className="col-span-2">Status</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-800/50 max-h-[500px] overflow-y-auto">
        {findings.map(finding => (
          <button
            key={finding.id}
            onClick={() => onSelectFinding(finding)}
            className={`w-full grid grid-cols-12 gap-4 px-4 py-3 text-left transition-colors ${
              selectedFindingId === finding.id ? 'bg-cyan-500/10' : 'hover:bg-slate-800/50'
            }`}
          >
            <div className="col-span-1 flex items-center">
              <SeverityBadge severity={finding.severity} />
            </div>
            <div className="col-span-1 flex items-center">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400 capitalize truncate">
                {finding.labSlug || '-'}
              </span>
            </div>
            <div className="col-span-2 flex items-center min-w-0">
              <Link
                href={`/c/${finding.companyId}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm text-slate-300 hover:text-white truncate"
              >
                {finding.companyName || 'Unknown'}
              </Link>
            </div>
            <div className="col-span-2 flex flex-col justify-center min-w-0">
              <span className="text-sm text-white truncate">{finding.category || '-'}</span>
              {finding.dimension && finding.dimension !== finding.category && (
                <span className="text-xs text-slate-500 truncate">{finding.dimension}</span>
              )}
            </div>
            <div className="col-span-4 flex items-center min-w-0">
              <span className="text-sm text-slate-300 truncate" title={finding.description}>
                {finding.description || '-'}
              </span>
            </div>
            <div className="col-span-2 flex items-center">
              {finding.isConvertedToWorkItem ? (
                <span className="text-emerald-400 text-sm">Work Item</span>
              ) : (
                <span className="text-slate-500 text-sm">Not converted</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Finding Detail Drawer
// ============================================================================

function FindingDetailDrawer({
  finding,
  onClose,
  onConvert,
}: {
  finding: DiagnosticDetailFindingWithCompany | null;
  onClose: () => void;
  onConvert: (finding: DiagnosticDetailFindingWithCompany) => Promise<void>;
}) {
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState(false);

  useEffect(() => {
    setConverting(false);
    setConvertError(null);
    setConvertSuccess(false);
  }, [finding?.id]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleConvert = async () => {
    if (!finding) return;
    setConverting(true);
    setConvertError(null);
    try {
      await onConvert(finding);
      setConvertSuccess(true);
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : 'Failed to convert');
    } finally {
      setConverting(false);
    }
  };

  if (!finding) return null;

  const colors = severityColors[finding.severity || 'medium'] || severityColors.medium;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md">
        <div className="flex h-full flex-col bg-slate-900 border-l border-slate-800 shadow-xl">
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-medium text-white">Finding Details</h2>
              <div className="mt-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text} ring-1 ${colors.ring} capitalize`}>
                  {finding.severity || 'Medium'} Severity
                </span>
              </div>
            </div>
            <button type="button" className="text-slate-400 hover:text-slate-300 p-1" onClick={onClose}>
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <dl className="space-y-6">
              {/* Company */}
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Company</dt>
                <dd className="mt-1">
                  <Link
                    href={`/c/${finding.companyId}/findings`}
                    className="text-sm text-cyan-400 hover:text-cyan-300"
                  >
                    {finding.companyName || 'Unknown Company'}
                  </Link>
                </dd>
              </div>

              {/* Lab & Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Lab</dt>
                  <dd className="mt-1 text-sm text-slate-300 capitalize">{finding.labSlug || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Category</dt>
                  <dd className="mt-1 text-sm text-slate-300">{finding.category || '-'}</dd>
                </div>
              </div>

              {/* Dimension */}
              {finding.dimension && (
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Dimension</dt>
                  <dd className="mt-1 text-sm text-slate-300">{finding.dimension}</dd>
                </div>
              )}

              {/* Location */}
              {finding.location && (
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Location</dt>
                  <dd className="mt-1 text-sm font-mono text-cyan-400">{finding.location}</dd>
                </div>
              )}

              {/* Description */}
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Description</dt>
                <dd className="mt-2 text-sm text-slate-300 leading-relaxed">
                  {finding.description || 'No description available.'}
                </dd>
              </div>

              {/* Recommendation */}
              {finding.recommendation && (
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Recommendation</dt>
                  <dd className="mt-2 text-sm text-slate-300 leading-relaxed bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    {finding.recommendation}
                  </dd>
                </div>
              )}

              {/* Impact */}
              {finding.estimatedImpact && (
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Estimated Impact</dt>
                  <dd className="mt-1 text-sm text-slate-300">{finding.estimatedImpact}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Footer / Actions */}
          <div className="border-t border-slate-800 px-6 py-4">
            {finding.isConvertedToWorkItem ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm text-emerald-400">Converted to Work Item</span>
                </div>
                <Link
                  href={`/c/${finding.companyId}/work`}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  View Work
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {convertError && (
                  <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{convertError}</div>
                )}
                {convertSuccess && (
                  <div className="text-sm text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">
                    Successfully converted to work item!
                  </div>
                )}
                <button
                  onClick={handleConvert}
                  disabled={converting || convertSuccess}
                  className={`w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    converting || convertSuccess
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                  }`}
                >
                  {converting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin w-4 h-4" />
                      Converting...
                    </span>
                  ) : convertSuccess ? 'Converted!' : 'Convert to Work Item'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GlobalFindingsClient() {
  // Data state
  const [findings, setFindings] = useState<DiagnosticDetailFindingWithCompany[]>([]);
  const [summary, setSummary] = useState<GlobalFindingsSummary | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [selectedLabs, setSelectedLabs] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [convertedFilter, setConvertedFilter] = useState<'all' | 'converted' | 'not_converted'>('all');

  // Selected finding for drawer
  const [selectedFinding, setSelectedFinding] = useState<DiagnosticDetailFindingWithCompany | null>(null);

  // Fetch data
  const fetchFindings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (timeRange && timeRange !== 'all') {
        params.set('timeRange', timeRange);
      }
      if (selectedLabs.length > 0) {
        params.set('labs', selectedLabs.join(','));
      }
      if (selectedSeverities.length > 0) {
        params.set('severities', selectedSeverities.join(','));
      }
      if (selectedCategories.length > 0) {
        params.set('categories', selectedCategories.join(','));
      }
      if (selectedCompanies.length > 0) {
        params.set('companyIds', selectedCompanies.join(','));
      }
      if (convertedFilter !== 'all') {
        params.set('converted', convertedFilter);
      }

      const url = `/api/os/findings/global?${params.toString()}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch findings');
      }

      setFindings(data.findings || []);
      setSummary(data.summary || null);
      setFilterOptions(data.filterOptions || null);
    } catch (err) {
      console.error('[GlobalFindingsClient] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch findings');
    } finally {
      setLoading(false);
    }
  }, [timeRange, selectedLabs, selectedSeverities, selectedCategories, selectedCompanies, convertedFilter]);

  useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  // Handle convert to work item
  const handleConvertToWorkItem = async (finding: DiagnosticDetailFindingWithCompany) => {
    if (!finding.id) return;

    const response = await fetch(`/api/os/findings/${finding.id}/convert-to-work-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finding }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to convert to work item');
    }

    // Update finding in state
    setFindings(prev =>
      prev.map(f =>
        f.id === finding.id ? { ...f, isConvertedToWorkItem: true, workItemId: data.workItem.id } : f
      )
    );

    if (selectedFinding?.id === finding.id) {
      setSelectedFinding({ ...selectedFinding, isConvertedToWorkItem: true, workItemId: data.workItem.id });
    }

    // Refresh to update summary
    fetchFindings();
  };

  // Clear all filters
  const clearFilters = () => {
    setTimeRange('30d');
    setSelectedLabs([]);
    setSelectedSeverities([]);
    setSelectedCategories([]);
    setSelectedCompanies([]);
    setConvertedFilter('all');
  };

  const hasActiveFilters =
    timeRange !== '30d' ||
    selectedLabs.length > 0 ||
    selectedSeverities.length > 0 ||
    selectedCategories.length > 0 ||
    selectedCompanies.length > 0 ||
    convertedFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Global Findings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Issues and opportunities across all companies
        </p>
      </div>

      {/* Summary Strip */}
      <SummaryStrip summary={summary} loading={loading} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Time Range */}
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          {filterOptions?.timeRanges?.map(tr => (
            <option key={tr.value} value={tr.value}>{tr.label}</option>
          )) || (
            <>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </>
          )}
        </select>

        {/* Lab Filter */}
        <MultiSelectDropdown
          label="Lab"
          options={filterOptions?.labs || []}
          selected={selectedLabs}
          onChange={setSelectedLabs}
          loading={loading}
        />

        {/* Severity Filter */}
        <MultiSelectDropdown
          label="Severity"
          options={filterOptions?.severities || []}
          selected={selectedSeverities}
          onChange={setSelectedSeverities}
          loading={loading}
        />

        {/* Category Filter */}
        <MultiSelectDropdown
          label="Category"
          options={filterOptions?.categories || []}
          selected={selectedCategories}
          onChange={setSelectedCategories}
          loading={loading}
        />

        {/* Company Search */}
        <CompanySearchDropdown
          companies={filterOptions?.companies || []}
          selected={selectedCompanies}
          onChange={setSelectedCompanies}
          loading={loading}
        />

        <div className="h-6 w-px bg-slate-700" />

        {/* Converted Toggle */}
        <div className="flex items-center rounded-lg bg-slate-800 p-0.5">
          {(['all', 'not_converted', 'converted'] as const).map(value => (
            <button
              key={value}
              disabled={loading}
              onClick={() => setConvertedFilter(value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                convertedFilter === value
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-300'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {value === 'all' ? 'All' : value === 'not_converted' ? 'Pending' : 'Converted'}
            </button>
          ))}
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
            Clear filters
          </button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <button onClick={fetchFindings} className="mt-2 text-sm text-red-300 hover:text-red-200 underline">
            Try again
          </button>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Top Companies (sidebar) */}
        <div className="lg:col-span-1">
          <TopCompaniesLeaderboard companies={summary?.topCompanies || []} />
        </div>

        {/* Findings Table */}
        <div className="lg:col-span-3">
          <FindingsTable
            findings={findings}
            loading={loading}
            onSelectFinding={setSelectedFinding}
            selectedFindingId={selectedFinding?.id}
          />
        </div>
      </div>

      {/* Finding Detail Drawer */}
      <FindingDetailDrawer
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
        onConvert={handleConvertToWorkItem}
      />
    </div>
  );
}
