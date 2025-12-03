'use client';

// app/my-companies/MyCompaniesClient.tsx
// Client component for My Companies using the unified CompanySummary system

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CompanySummary, DimensionScoreWithChange, CompanyType } from '@/lib/os/companySummary';

// ============================================================================
// Local Storage for Pinned Companies
// ============================================================================

const PINNED_STORAGE_KEY = 'hive-os-pinned-companies';

function getPinnedCompanies(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(PINNED_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setPinnedCompanies(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Helper Components
// ============================================================================

function StageBadge({ stage }: { stage: string }) {
  const styles: Record<string, string> = {
    'Client': 'bg-blue-500/10 text-blue-400',
    'Prospect': 'bg-amber-500/10 text-amber-400',
    'Internal': 'bg-purple-500/10 text-purple-400',
    'Dormant': 'bg-slate-500/10 text-slate-400',
    'Lost': 'bg-slate-500/10 text-slate-500',
  };

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${styles[stage] || styles.Prospect}`}>
      {stage}
    </span>
  );
}

function ScoreRing({ score, size = 'md' }: { score: number | null | undefined; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  if (score === null || score === undefined) {
    return (
      <div className={`${sizeClasses} rounded-full bg-slate-800 flex items-center justify-center`}>
        <span className="text-xs text-slate-500">--</span>
      </div>
    );
  }

  const color = score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';
  const bgColor = score >= 70 ? 'bg-emerald-500/10' : score >= 40 ? 'bg-amber-500/10' : 'bg-red-500/10';

  return (
    <div className={`${sizeClasses} rounded-full ${bgColor} flex items-center justify-center`}>
      <span className={`${textSize} font-semibold ${color}`}>{score}</span>
    </div>
  );
}

// Map dimension key to diagnostic page path
const TOOL_PATHS: Record<string, string> = {
  website: 'website-lab',
  seo: 'seo-lab',
  content: 'content-lab',
  brand: 'brand-lab',
  ops: 'ops-lab',
  demand: 'demand-lab',
};

// Clickable dimension score pill with trend arrow
// Uses button + router.push to avoid nested <a> tags (hydration error)
function DimensionPill({ dim, companyId }: { dim: DimensionScoreWithChange; companyId: string }) {
  const router = useRouter();
  const toolPath = TOOL_PATHS[dim.key] || dim.key;
  const href = `/c/${companyId}/${toolPath}`;

  if (dim.score === null) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-500 cursor-default">
        {dim.label} --
      </span>
    );
  }

  const color = dim.score >= 70 ? 'text-emerald-400 bg-emerald-500/10' :
                dim.score >= 40 ? 'text-amber-400 bg-amber-500/10' :
                'text-red-400 bg-red-500/10';

  const changeIndicator = dim.change !== null && dim.change !== undefined ? (
    dim.change > 0 ? '↑' : dim.change < 0 ? '↓' : '↔'
  ) : '';

  const changeColor = dim.change !== null && dim.change !== undefined ? (
    dim.change > 0 ? 'text-emerald-400' : dim.change < 0 ? 'text-red-400' : 'text-slate-500'
  ) : '';

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(href);
      }}
      className={`text-[10px] px-1.5 py-0.5 rounded ${color} hover:opacity-80 transition-opacity inline-flex items-center gap-0.5 cursor-pointer`}
      title={`${dim.label}: ${dim.score}/100${dim.previousScore !== null && dim.previousScore !== undefined ? ` (was ${dim.previousScore})` : ''}`}
    >
      {dim.label} {dim.score}
      {changeIndicator && <span className={`ml-0.5 ${changeColor}`}>{changeIndicator}</span>}
    </button>
  );
}

function TrendRow({ label, value, change }: { label: string; value: number | null; change: number | null }) {
  const direction = change !== null ? (change > 2 ? 'up' : change < -2 ? 'down' : 'flat') : null;
  const directionIcon = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
  const directionColor = direction === 'up' ? 'text-emerald-400' :
                         direction === 'down' ? 'text-red-400' : 'text-slate-500';

  const formatValue = (val: number | null) => {
    if (val === null) return '--';
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val.toString();
  };

  const formatChange = (c: number | null) => {
    if (c === null) return '';
    const sign = c >= 0 ? '+' : '';
    return `${sign}${c.toFixed(0)}%`;
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-slate-500">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-300 font-medium">{formatValue(value)}</span>
        {change !== null && (
          <span className={`text-[10px] ${directionColor}`}>
            {directionIcon} {formatChange(change)}
          </span>
        )}
      </div>
    </div>
  );
}

function AttentionBadge({ item }: { item: NonNullable<CompanySummary['recentWork']['topAttentionItem']> }) {
  const severityStyles = {
    critical: 'bg-red-500/10 text-red-400 border-red-500/30',
    high: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    info: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };

  return (
    <div className={`px-2 py-1.5 rounded border ${severityStyles[item.severity]}`}>
      <div className="flex items-start gap-1.5">
        <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-[10px] leading-tight line-clamp-2">{item.title}</span>
      </div>
    </div>
  );
}

function ActionItem({ action }: { action: { title: string; area?: string } }) {
  return (
    <div className="flex items-start gap-1.5 text-[10px]">
      <span className="text-blue-400 mt-0.5">→</span>
      <span className="text-slate-400 line-clamp-1">{action.title}</span>
    </div>
  );
}

function MediaIndicator({ media }: { media: CompanySummary['media'] }) {
  if (!media.hasMediaProgram) {
    return null;
  }

  const formatBudget = (val: number | null | undefined) => {
    if (!val) return null;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
    return `$${val}`;
  };

  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="text-purple-400">◆</span>
      <span className="text-slate-400">Media</span>
      {media.monthlySpend && (
        <span className="text-purple-300">{formatBudget(media.monthlySpend)}/mo</span>
      )}
    </div>
  );
}

function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-slate-400';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '--';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function getFaviconUrl(domain: string | null | undefined): string | null {
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

// V3: Company-type-aware dimension filtering
// Shows relevant dimensions based on company type for more focused cards
function getRelevantDimensions(
  dimensionScores: DimensionScoreWithChange[],
  companyType: CompanyType | null | undefined,
  scores: { latestBrandScore?: number | null }
): DimensionScoreWithChange[] {
  const withScores = dimensionScores.filter(d => d.score !== null);

  // If no company type, show all with scores (up to 5)
  if (!companyType) return withScores.slice(0, 5);

  // Company-type prioritization
  const priorityMap: Record<CompanyType, string[]> = {
    Local: ['seo', 'demand', 'website', 'ops', 'content'],
    eCom: ['website', 'seo', 'content', 'demand', 'ops'],
    Marketplace: ['website', 'seo', 'demand', 'content', 'ops'],
    SaaS: ['demand', 'seo', 'content', 'website', 'brand'],
    Services: ['seo', 'brand', 'ops', 'content', 'demand'],
    Other: ['website', 'seo', 'content', 'brand', 'ops', 'demand'],
  };

  // Get priority order for this company type
  const priority = priorityMap[companyType] || priorityMap.Other;

  // For Local businesses, hide Brand if no brand lab run
  const shouldHideBrand = companyType === 'Local' && !scores.latestBrandScore;

  // Sort and filter
  return withScores
    .filter(d => !shouldHideBrand || d.key !== 'brand')
    .sort((a, b) => {
      const aIndex = priority.indexOf(a.key);
      const bIndex = priority.indexOf(b.key);
      // Unknown dimensions go to end
      const aPos = aIndex === -1 ? 999 : aIndex;
      const bPos = bIndex === -1 ? 999 : bIndex;
      return aPos - bPos;
    })
    .slice(0, 5);
}

// V3: Company-type-aware Risk Indicator - shows one prioritized risk
function RiskIndicator({ summary }: { summary: CompanySummary }) {
  const { dimensionScores, analytics, flags, meta } = summary;
  const companyType = meta.companyType;

  // Determine the primary risk to show (prioritized by company type)
  let riskTitle: string | null = null;
  let riskSeverity: 'critical' | 'high' | 'medium' = 'medium';

  const hasAnalytics = analytics.sessions !== null || analytics.conversions !== null;
  const seoScore = dimensionScores.find(d => d.key === 'seo')?.score;
  const opsScore = dimensionScores.find(d => d.key === 'ops')?.score;
  const websiteScore = dimensionScores.find(d => d.key === 'website')?.score;
  const demandScore = dimensionScores.find(d => d.key === 'demand')?.score;

  // Company-type specific risk prioritization
  if (companyType === 'Local') {
    // Local businesses: prioritize GBP/local visibility issues
    if (!hasAnalytics) {
      riskTitle = 'Google Business Profile Not Connected';
      riskSeverity = 'critical';
    } else if (seoScore !== null && seoScore !== undefined && seoScore < 40) {
      riskTitle = 'Low Local Search Visibility';
      riskSeverity = 'critical';
    } else if (demandScore !== null && demandScore !== undefined && demandScore < 40) {
      riskTitle = 'Limited Local Demand Capture';
      riskSeverity = 'high';
    }
  } else if (companyType === 'eCom' || companyType === 'Marketplace') {
    // eCommerce/Marketplace: prioritize conversion and UX
    if (websiteScore !== null && websiteScore !== undefined && websiteScore < 40) {
      riskTitle = 'Critical Storefront UX Issues';
      riskSeverity = 'critical';
    } else if (analytics.conversionsChange != null && analytics.conversionsChange < -15) {
      riskTitle = 'Conversion Rate Declining';
      riskSeverity = 'high';
    } else if (!hasAnalytics) {
      riskTitle = 'Analytics Not Connected';
      riskSeverity = 'high';
    }
  } else if (companyType === 'SaaS') {
    // SaaS: prioritize demand gen and content
    if (demandScore !== null && demandScore !== undefined && demandScore < 40) {
      riskTitle = 'Weak Demand Generation Pipeline';
      riskSeverity = 'critical';
    } else if (seoScore !== null && seoScore !== undefined && seoScore < 40) {
      riskTitle = 'Low Organic Discovery';
      riskSeverity = 'high';
    } else if (!hasAnalytics) {
      riskTitle = 'Analytics Not Connected';
      riskSeverity = 'high';
    }
  } else if (companyType === 'Services') {
    // Services: prioritize brand and lead gen
    if (!hasAnalytics) {
      riskTitle = 'Analytics Not Connected';
      riskSeverity = 'high';
    } else if (seoScore !== null && seoScore !== undefined && seoScore < 40) {
      riskTitle = 'Low Service Visibility';
      riskSeverity = 'critical';
    } else if (opsScore !== null && opsScore !== undefined && opsScore < 40) {
      riskTitle = 'Missing Lead Tracking Infrastructure';
      riskSeverity = 'high';
    }
  } else {
    // Default: generic risk prioritization
    if (!hasAnalytics) {
      riskTitle = 'Analytics Not Connected';
      riskSeverity = 'high';
    } else if (seoScore !== null && seoScore !== undefined && seoScore < 40) {
      riskTitle = 'Critical Organic Visibility Issues';
      riskSeverity = 'critical';
    } else if (opsScore !== null && opsScore !== undefined && opsScore < 40) {
      riskTitle = 'Missing Analytics Infrastructure';
      riskSeverity = 'high';
    } else if (websiteScore !== null && websiteScore !== undefined && websiteScore < 30) {
      riskTitle = 'Critical Website UX Issues';
      riskSeverity = 'critical';
    }
  }

  // Fallback: Use attention item if no company-type-specific risk found
  if (!riskTitle && summary.recentWork.topAttentionItem) {
    riskTitle = summary.recentWork.topAttentionItem.title;
    riskSeverity = summary.recentWork.topAttentionItem.severity === 'critical' ? 'critical' :
                   summary.recentWork.topAttentionItem.severity === 'high' ? 'high' : 'medium';
  }

  // If no risks found, show healthy status
  const isHealthy = !riskTitle;
  const displayTitle = riskTitle || 'All systems healthy';
  const displaySeverity = isHealthy ? 'healthy' : riskSeverity;

  const severityColors = {
    critical: 'text-red-400',
    high: 'text-amber-400',
    medium: 'text-yellow-400',
    healthy: 'text-emerald-400',
  };

  return (
    <div className="mt-3 flex items-center gap-1.5 text-[10px]">
      <span className={severityColors[displaySeverity]}>●</span>
      <span className="text-slate-400 truncate">{displayTitle}</span>
    </div>
  );
}

// Last Worked On section
function LastWorkedOnSection({ summary }: { summary: CompanySummary }) {
  const { lastDiagnosticLabel, lastDiagnosticDate } = summary.recentWork;

  if (!lastDiagnosticLabel) return null;

  // Format relative date
  let relativeDate = '';
  if (lastDiagnosticDate) {
    const date = new Date(lastDiagnosticDate);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) relativeDate = 'Today';
    else if (diffDays === 1) relativeDate = 'Yesterday';
    else if (diffDays < 7) relativeDate = `${diffDays}d ago`;
    else if (diffDays < 30) relativeDate = `${Math.floor(diffDays / 7)}w ago`;
    else relativeDate = `${Math.floor(diffDays / 30)}mo ago`;
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-700/30">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-500">Last</span>
        {relativeDate && <span className="text-slate-500">{relativeDate}</span>}
      </div>
      <div className="text-xs text-slate-300 truncate mt-0.5">{lastDiagnosticLabel}</div>
    </div>
  );
}

// ============================================================================
// Company Card
// ============================================================================

interface CompanyCardProps {
  summary: CompanySummary;
  onRemove: (id: string) => void;
}

function CompanyCard({ summary, onRemove }: CompanyCardProps) {
  const { meta, scores, dimensionScores, recentWork, media, analytics, flags } = summary;

  const hasDimensionScores = dimensionScores.some(d => d.score !== null);
  const hasAnalytics = analytics.sessions !== null || analytics.conversions !== null || analytics.clicks !== null;

  return (
    <div className="group relative rounded-lg bg-slate-800/50 border border-amber-500/30 hover:border-amber-500/50 transition-all overflow-hidden">
      {/* Remove Button (shown on hover) */}
      <button
        onClick={(e) => {
          e.preventDefault();
          onRemove(summary.companyId);
        }}
        className="absolute top-2 right-2 z-10 p-1 rounded opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-all"
        title="Remove from My Companies"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <Link href={`/c/${summary.companyId}/blueprint`} className="block p-3">
        {/* ===== HEADER SECTION ===== */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {/* Favicon */}
            <div className="flex-shrink-0 w-8 h-8 rounded-md bg-slate-700/50 flex items-center justify-center overflow-hidden">
              {meta.domain ? (
                <img
                  src={getFaviconUrl(meta.domain) || ''}
                  alt=""
                  className="w-4 h-4"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <span className="text-xs font-medium text-slate-500">
                  {meta.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-medium text-slate-200 truncate">{meta.name}</h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                {meta.stage && <StageBadge stage={meta.stage} />}
                <span className="text-[10px] text-slate-500">{meta.lastActivityLabel || 'No activity'}</span>
              </div>
            </div>
          </div>

          {/* Overall Score */}
          <span className={`text-lg font-bold tabular-nums ${getScoreColor(scores.latestBlueprintScore)}`}>
            {scores.latestBlueprintScore ?? '--'}
          </span>
        </div>

        {/* ===== DIMENSION SCORES ===== */}
        {hasDimensionScores && (
          <div className="flex flex-wrap gap-1 mt-3">
            {getRelevantDimensions(dimensionScores, meta.companyType, scores).map(dim => (
              <DimensionPill key={dim.key} dim={dim} companyId={summary.companyId} />
            ))}
          </div>
        )}

        {/* ===== ANALYTICS PULSE ===== */}
        {hasAnalytics && (
          <div className="mt-3 pt-3 border-t border-slate-700/30">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-slate-500">Sessions</div>
                <div className="text-sm font-medium text-slate-200">{formatNumber(analytics.sessions)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Conversions</div>
                <div className="text-sm font-medium text-slate-200">{formatNumber(analytics.conversions)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Clicks</div>
                <div className="text-sm font-medium text-slate-200">{formatNumber(analytics.clicks)}</div>
              </div>
            </div>
          </div>
        )}

        {/* ===== RISK INDICATOR ===== */}
        <RiskIndicator summary={summary} />

        {/* ===== LAST WORKED ON ===== */}
        <LastWorkedOnSection summary={summary} />

        {/* ===== NEXT ACTIONS ===== */}
        {recentWork.nextActions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700/30 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Next</span>
            {recentWork.nextActions.slice(0, 2).map((action, i) => (
              <ActionItem key={i} action={action} />
            ))}
            {recentWork.openTasksCount > 2 && (
              <div className="pt-1">
                <span className="text-[10px] text-blue-400">
                  View All ({recentWork.openTasksCount}) →
                </span>
              </div>
            )}
          </div>
        )}

        {/* ===== FOOTER ===== */}
        <div className="mt-3 pt-3 border-t border-slate-700/30 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-3 text-slate-500">
            {media.hasMediaProgram && (
              <span className="flex items-center gap-1">
                <span className="text-purple-400">◆</span> Media
              </span>
            )}
            {recentWork.openTasksCount > 0 && (
              <span>{recentWork.openTasksCount} tasks</span>
            )}
          </div>
          <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
        <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-slate-300 mb-2">No Pinned Companies</h3>
      <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
        Pin companies you work with frequently for quick access. Browse the company directory and click the bookmark icon on any company card.
      </p>
      <Link
        href="/companies"
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Browse Companies
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </Link>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

// Fetch company summaries from API
async function fetchCompanySummaries(companyIds: string[]): Promise<CompanySummary[]> {
  if (companyIds.length === 0) return [];

  try {
    const response = await fetch('/api/os/companies/summaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyIds }),
    });

    if (!response.ok) {
      console.error('Failed to fetch summaries:', response.status);
      return [];
    }

    const data = await response.json();
    return data.summaries || [];
  } catch (error) {
    console.error('Error fetching summaries:', error);
    return [];
  }
}

export function MyCompaniesClient() {
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'clients' | 'prospects'>('all');

  // Load pinned companies from localStorage and fetch their data
  useEffect(() => {
    const loadPinnedCompanies = async () => {
      setIsLoading(true);
      const stored = getPinnedCompanies();
      setPinnedIds(stored);

      if (stored.length > 0) {
        const summaries = await fetchCompanySummaries(stored);
        setCompanies(summaries);
      }
      setIsLoading(false);
    };

    loadPinnedCompanies();
  }, []);

  // Handle unpinning - remove from list
  const handleUnpin = useCallback(async (companyId: string) => {
    const newPinned = pinnedIds.filter(id => id !== companyId);
    setPinnedIds(newPinned);
    setPinnedCompanies(newPinned);
    setCompanies(prev => prev.filter(c => c.companyId !== companyId));
  }, [pinnedIds]);

  // Filter companies
  const filteredCompanies = companies.filter(c => {
    switch (filter) {
      case 'clients':
        return c.meta.stage === 'Client';
      case 'prospects':
        return c.meta.stage === 'Prospect';
      default:
        return true;
    }
  });

  // Sort by last activity date (most recent first), then by name
  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    if (a.meta.lastActivityAt && b.meta.lastActivityAt) {
      return new Date(b.meta.lastActivityAt).getTime() - new Date(a.meta.lastActivityAt).getTime();
    }
    if (a.meta.lastActivityAt && !b.meta.lastActivityAt) return -1;
    if (!a.meta.lastActivityAt && b.meta.lastActivityAt) return 1;
    return a.meta.name.localeCompare(b.meta.name);
  });

  const clientCount = companies.filter(c => c.meta.stage === 'Client').length;
  const prospectCount = companies.filter(c => c.meta.stage === 'Prospect').length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="h-8 w-48 bg-slate-800 rounded animate-pulse mb-2" />
            <div className="h-4 w-72 bg-slate-800/50 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-[#0B0F17] rounded-xl border border-white/5 p-5 h-64 animate-pulse">
                <div className="h-5 w-32 bg-slate-800 rounded mb-3" />
                <div className="h-4 w-24 bg-slate-800/50 rounded mb-4" />
                <div className="h-3 w-full bg-slate-800/30 rounded mb-2" />
                <div className="h-3 w-3/4 bg-slate-800/30 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-slate-100">My Companies</h1>
            <Link
              href="/companies"
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              Add companies
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Link>
          </div>
          <p className="text-sm text-slate-500">
            Companies you've pinned for quick access. Pin companies from the{' '}
            <Link href="/companies" className="text-blue-400 hover:text-blue-300">
              company directory
            </Link>.
          </p>
        </div>

        {/* Filter Tabs - only show if there are companies */}
        {companies.length > 0 && (clientCount > 0 || prospectCount > 0) && (
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              All ({companies.length})
            </button>
            {clientCount > 0 && (
              <button
                onClick={() => setFilter('clients')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filter === 'clients'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                Clients ({clientCount})
              </button>
            )}
            {prospectCount > 0 && (
              <button
                onClick={() => setFilter('prospects')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filter === 'prospects'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                Prospects ({prospectCount})
              </button>
            )}
          </div>
        )}

        {/* Company Cards Grid */}
        {sortedCompanies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedCompanies.map(summary => (
              <CompanyCard
                key={summary.companyId}
                summary={summary}
                onRemove={handleUnpin}
              />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
