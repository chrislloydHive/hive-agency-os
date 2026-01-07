'use client';

// components/os/DiagnosticsControlCenter.tsx
// Diagnostics Control Center - Clean dashboard for running labs
//
// Structure:
// 1. Top Status Strip - Last full diagnostic status + Run buttons
// 2. Lab Grid - Cards for each diagnostic lab
// 3. Findings Teaser - Link to Plan page
// 4. Recent Diagnostics - Compact history list

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  BarChart3,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { DataConfidenceBadge, type DataSource } from '@/components/diagnostics/DataConfidenceBadge';
import { CompanyDMATimeline } from '@/components/os/CompanyDMATimeline';
import { ContextReadinessPanel } from '@/components/os/context/ContextReadinessPanel';
import type { DiagnosticRunStatus, DiagnosticToolId } from '@/lib/os/diagnostics/runs';
import type { CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import {
  getDiscoverUIState,
  isVisible,
  type DiscoverDataInput,
  type PathKey,
} from '@/lib/os/ui/discoverUiState';

// ============================================================================
// Types
// ============================================================================

type StartingPath = 'baseline' | 'project' | 'rfp' | 'custom' | null;

interface PathDefinition {
  id: StartingPath;
  name: string;
  description: string;
  primaryLab: string;
  recommendedLabs: string[];
  ctaLabel: string;
  icon: keyof typeof iconMap;
  color: string;
}

interface CompanyData {
  id: string;
  name: string;
  website?: string | null;
  domain?: string;
}

interface RecentDiagnostic {
  id: string;
  toolId: DiagnosticToolId;
  toolLabel: string;
  status: DiagnosticRunStatus;
  score: number | null;
  completedAt?: string | null;
  reportPath?: string | null;
  createdAt: string;
  /** Error message if the run failed */
  error?: string | null;
}

interface LabDefinition {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof iconMap;
  color: string;
  runApiPath?: string;
  viewPath?: string;
  category: 'core' | 'specialized';
  /** If true, this lab feeds into Context V4 and shows Review Queue link */
  feedsContext?: boolean;
}

export interface DiagnosticsControlCenterProps {
  company: CompanyData;
  strategySnapshot: CompanyStrategicSnapshot | null;
  recentDiagnostics: RecentDiagnostic[];
  openFindingsCount?: number;
}

// ============================================================================
// Lab Definitions
// ============================================================================

const iconMap = {
  zap: Zap,
  globe: Globe,
  sparkles: Sparkles,
  search: Search,
  fileText: FileText,
  trendingUp: TrendingUp,
  settings: Settings,
  barChart: BarChart3,
  users: Users,
  target: Target,
  activity: Activity,
};

const LABS: LabDefinition[] = [
  // Core Labs
  {
    id: 'gapSnapshot',
    name: 'GAP IA',
    description: 'Quick marketing health check',
    icon: 'zap',
    color: 'amber',
    runApiPath: '/api/os/diagnostics/run/gap-snapshot',
    category: 'core',
  },
  {
    id: 'gapPlan',
    name: 'Full GAP',
    description: 'Comprehensive diagnostic',
    icon: 'barChart',
    color: 'purple',
    runApiPath: '/api/os/diagnostics/run/gap-plan',
    category: 'core',
  },
  {
    id: 'websiteLab',
    name: 'Website Lab',
    description: 'UX, conversion, technical audit',
    icon: 'globe',
    color: 'blue',
    runApiPath: '/api/os/diagnostics/run/website-lab',
    category: 'core',
    feedsContext: true,
  },
  {
    id: 'brandLab',
    name: 'Brand Lab',
    description: 'Positioning & differentiation',
    icon: 'sparkles',
    color: 'pink',
    runApiPath: '/api/os/diagnostics/run/brand-lab',
    category: 'core',
    feedsContext: true,
  },
  {
    id: 'seoLab',
    name: 'SEO Lab',
    description: 'Search visibility & rankings',
    icon: 'search',
    color: 'cyan',
    runApiPath: '/api/os/diagnostics/run/seo-lab',
    category: 'core',
  },
  {
    id: 'contentLab',
    name: 'Content Lab',
    description: 'Content strategy & quality',
    icon: 'fileText',
    color: 'emerald',
    runApiPath: '/api/os/diagnostics/run/content-lab',
    category: 'core',
  },
  // Specialized Labs
  {
    id: 'demandLab',
    name: 'Demand Lab',
    description: 'Lead gen & funnel analysis',
    icon: 'trendingUp',
    color: 'orange',
    runApiPath: '/api/os/diagnostics/run/demand-lab',
    category: 'specialized',
  },
  {
    id: 'opsLab',
    name: 'Ops Lab',
    description: 'Marketing operations',
    icon: 'settings',
    color: 'slate',
    runApiPath: '/api/os/diagnostics/run/ops-lab',
    category: 'specialized',
  },
  {
    id: 'competitionLab',
    name: 'Competition Lab',
    description: 'Competitive landscape',
    icon: 'target',
    color: 'red',
    runApiPath: '/api/os/diagnostics/run/competition-lab',
    viewPath: '/diagnostics/competition',
    category: 'specialized',
    feedsContext: true,
  },
  {
    id: 'analyticsLab',
    name: 'Analytics Lab',
    description: 'GA4, Search Console & Media',
    icon: 'activity',
    color: 'indigo',
    viewPath: '/labs/analytics',
    category: 'specialized',
  },
];

// ============================================================================
// Starting Paths
// ============================================================================

const STARTING_PATHS: PathDefinition[] = [
  {
    id: 'baseline',
    name: 'Full Strategy Baseline',
    description: 'Best for new clients or when you need a comprehensive baseline.',
    primaryLab: 'gapPlan',
    recommendedLabs: ['websiteLab', 'brandLab', 'seoLab', 'contentLab', 'competitionLab'],
    ctaLabel: 'Start Full Diagnostic',
    icon: 'barChart',
    color: 'purple',
  },
  {
    id: 'project',
    name: 'Project Kickoff',
    description: 'Best for website redesigns, rebrands, or a specific initiative.',
    primaryLab: 'websiteLab',
    recommendedLabs: ['brandLab', 'contentLab', 'competitionLab'],
    ctaLabel: 'Start Project Discovery',
    icon: 'globe',
    color: 'blue',
  },
  {
    id: 'rfp',
    name: 'RFP Response',
    description: 'Best for responding to an RFP on a tight timeline.',
    primaryLab: 'brandLab',
    recommendedLabs: ['competitionLab', 'websiteLab'],
    ctaLabel: 'Start RFP Discovery',
    icon: 'zap',
    color: 'amber',
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Pick labs manually based on your needs.',
    primaryLab: '',
    recommendedLabs: [],
    ctaLabel: 'Choose Labs',
    icon: 'settings',
    color: 'slate',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
}

function getColorClasses(color: string) {
  const colors: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', iconBg: 'bg-amber-500/20' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', iconBg: 'bg-purple-500/20' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', iconBg: 'bg-blue-500/20' },
    pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400', iconBg: 'bg-pink-500/20' },
    cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', iconBg: 'bg-cyan-500/20' },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', iconBg: 'bg-emerald-500/20' },
    orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', iconBg: 'bg-orange-500/20' },
    slate: { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400', iconBg: 'bg-slate-500/20' },
    violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-400', iconBg: 'bg-violet-500/20' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', iconBg: 'bg-red-500/20' },
  };
  return colors[color] || colors.slate;
}

// ============================================================================
// Lab Card Component
// ============================================================================

function LabCard({
  lab,
  lastRun,
  isRunning,
  onRun,
  companyId,
  qualityLabel,
  qualityScore,
  qualityReason,
}: {
  lab: LabDefinition;
  lastRun: RecentDiagnostic | null;
  isRunning: boolean;
  onRun: () => void;
  companyId: string;
  qualityLabel?: string | null;
  qualityScore?: number | null;
  qualityReason?: string;
}) {
  const colors = getColorClasses(lab.color);
  const Icon = iconMap[lab.icon];
  const hasReport = lastRun?.status === 'complete' && lastRun.reportPath;

  return (
    <div className={`rounded-xl border p-4 ${colors.bg} ${colors.border} hover:border-opacity-60 transition-all`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg ${colors.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white">{lab.name}</h3>
          <p className="text-xs text-slate-400 line-clamp-1">{lab.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {lastRun?.score != null && (
            <span className={`text-lg font-bold tabular-nums ${getScoreColor(lastRun.score)}`}>
              {lastRun.score}
            </span>
          )}
          {qualityLabel && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 text-right">
              Quality: {qualityLabel}{qualityScore != null ? ` (${qualityScore})` : ''}
              {qualityReason ? ` · ${qualityReason}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Last run status */}
      <div className="text-xs mb-3">
        {lastRun ? (
          lastRun.status === 'running' ? (
            <span className="flex items-center gap-1 text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Running...
            </span>
          ) : lastRun.status === 'complete' ? (
            <span className="text-slate-500" suppressHydrationWarning>
              Last run {formatRelativeTime(lastRun.completedAt)}
            </span>
          ) : lastRun.status === 'failed' ? (
            <div className="space-y-1">
              <span className="text-red-400 font-medium">Failed</span>
              {lastRun.error && (
                <p className="text-red-400/80 line-clamp-2" title={lastRun.error}>
                  {lastRun.error}
                </p>
              )}
            </div>
          ) : (
            <span className="text-slate-500">Not run yet</span>
          )
        ) : (
          <span className="text-slate-500">Not run yet</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {lab.runApiPath ? (
          <button
            onClick={onRun}
            disabled={isRunning}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              isRunning
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : `bg-slate-800 hover:bg-slate-700 text-white`
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Running
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Run Lab
              </>
            )}
          </button>
        ) : lab.viewPath ? (
          <Link
            href={`/c/${companyId}${lab.viewPath}`}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Open Lab
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        ) : null}

        {/* Review Queue link for labs that feed context */}
        {lab.feedsContext && hasReport && (
          <Link
            href={`/c/${companyId}/context?view=review`}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors"
          >
            Review
          </Link>
        )}

        {hasReport && (
          <Link
            href={lastRun!.reportPath!}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800/50 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            View
          </Link>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DiagnosticsControlCenter({
  company,
  strategySnapshot,
  recentDiagnostics,
  openFindingsCount = 0,
}: DiagnosticsControlCenterProps) {
  const router = useRouter();
  const [runningLabs, setRunningLabs] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedPath, setSelectedPath] = useState<StartingPath>(null);
  const [packStarted, setPackStarted] = useState(false);
  const [labQuality, setLabQuality] = useState<Record<string, { label: string; score: number | null; reason?: string }>>({});
  const [resetBusy, setResetBusy] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);

  // Compute selector inputs
  const hasAnyRuns = recentDiagnostics.length > 0;
  const hasRunning = runningLabs.size > 0 || recentDiagnostics.some(r => r.status === 'running');
  const hasCompleted = recentDiagnostics.some(r => r.status === 'complete');
  // Check if Website Lab completed (for Decide eligibility)
  const decideEligible = recentDiagnostics.some(
    r => r.toolId === 'websiteLab' && r.status === 'complete'
  );

  // Derive UI state from selector
  const dataInput: DiscoverDataInput = {
    hasAnyRuns,
    hasRunning,
    hasCompleted,
    selectedPath: selectedPath as PathKey | null,
    packStarted,
    decideEligible,
  };
  const uiState = getDiscoverUIState(dataInput, company.id);

  // Legacy alias for backward compat
  const hasRunAnyLabs = hasAnyRuns;

  // Get last run for each lab
  const getLastRunForLab = (labId: string): RecentDiagnostic | null => {
    return recentDiagnostics.find(r => r.toolId === labId) || null;
  };

  // Find the most recent full diagnostic (gapPlan or gapHeavy)
  const lastFullDiagnostic = recentDiagnostics.find(
    r => (r.toolId === 'gapPlan' || r.toolId === 'gapHeavy') && r.status === 'complete'
  );

  // Compute data sources for confidence badge
  const dataSources: DataSource[] = [
    {
      id: 'brain',
      name: 'Brain Context',
      type: 'brain',
      lastUpdated: strategySnapshot?.updatedAt || null,
      status: strategySnapshot ? 'fresh' : 'missing',
      refreshHref: `/c/${company.id}/brain`,
    },
    {
      id: 'diagnostics',
      name: 'Diagnostics',
      type: 'diagnostic',
      lastUpdated: lastFullDiagnostic?.completedAt || null,
      status: lastFullDiagnostic ? 'fresh' : 'missing',
    },
  ];

  // Handle running a lab
  const handleRunLab = useCallback(
    async (lab: LabDefinition) => {
      if (!lab.runApiPath) return;

      setRunningLabs(prev => new Set(prev).add(lab.id));

      try {
        const response = await fetch(lab.runApiPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
            url: company.website || company.domain,
          }),
        });

        const data = await response.json();

        if (response.ok && (data.run || data.runId || data.success)) {
          // For competition lab, cache the result for immediate display on the competition page
          // This avoids Airtable eventual consistency issues
          if (lab.id === 'competitionLab' && data.run) {
            try {
              sessionStorage.setItem(
                `competition-run-${company.id}`,
                JSON.stringify({ run: data.run, timestamp: Date.now() })
              );
            } catch {
              // Ignore sessionStorage errors
            }
          }
          setToast({ message: `${lab.name} completed`, type: 'success' });
          // Poll for completion or let user see running state
          setTimeout(() => {
            setToast(null);
            router.refresh();
          }, 3000);
        } else {
          const errorMsg = data.error || data.message || `Failed to run ${lab.name}`;
          setToast({ message: errorMsg, type: 'error' });
          if (process.env.NODE_ENV === 'development') {
            console.error(`[DiagnosticsCC] ${lab.name} error:`, errorMsg);
          }
          setRunningLabs(prev => {
            const next = new Set(prev);
            next.delete(lab.id);
            return next;
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : `Failed to run ${lab.name}`;
        if (process.env.NODE_ENV === 'development') {
          console.error(`[DiagnosticsCC] ${lab.name} exception:`, error);
        }
        setToast({ message: errorMsg, type: 'error' });
        setRunningLabs(prev => {
          const next = new Set(prev);
          next.delete(lab.id);
          return next;
        });
      }

      setTimeout(() => setToast(null), 5000);
    },
    [company.id, company.website, company.domain, router]
  );

  // Handle running full diagnostic
  const handleRunFullDiagnostic = useCallback(async () => {
    const gapPlanLab = LABS.find(l => l.id === 'gapPlan');
    if (gapPlanLab) {
      handleRunLab(gapPlanLab);
    }
  }, [handleRunLab]);

  // Handle selecting a starting path
  const handleSelectPath = useCallback((path: PathDefinition) => {
    setSelectedPath(path.id);

    // For custom path, just scroll to labs
    if (path.id === 'custom') {
      document.getElementById('core-labs')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // Run the primary lab for this path
    const primaryLab = LABS.find(l => l.id === path.primaryLab);
    if (primaryLab && primaryLab.runApiPath) {
      setPackStarted(true);
      handleRunLab(primaryLab);
    }
  }, [handleRunLab]);

  // Get recommended labs for selected path
  const getRecommendedLabs = useCallback(() => {
    if (!selectedPath || selectedPath === 'custom') return [];
    const path = STARTING_PATHS.find(p => p.id === selectedPath);
    if (!path) return [];
    return path.recommendedLabs
      .map(labId => LABS.find(l => l.id === labId))
      .filter((lab): lab is LabDefinition => !!lab);
  }, [selectedPath]);

  const recommendedLabs = getRecommendedLabs();

  const coreLabs = LABS.filter(l => l.category === 'core');
  const specializedLabs = LABS.filter(l => l.category === 'specialized');

  // Recent runs for history section (limit to 5)
  const recentRuns = recentDiagnostics.slice(0, 5);

  // Fetch lab quality
  useEffect(() => {
    const loadQuality = async () => {
      try {
        const res = await fetch(`/api/os/companies/${company.id}/labs/quality`, { cache: 'no-store' });
        const json = await res.json();
        if (json?.ok && json.current) {
          const map: Record<string, { label: string; score: number | null; reason?: string }> = {};
          for (const [lab, q] of Object.entries(json.current)) {
            if (q) {
              const entry: any = q;
              const reason = Array.isArray(entry.reasons) && entry.reasons.length > 0 ? entry.reasons[0].label : undefined;
              map[lab] = { label: entry.label, score: entry.score ?? null, reason };
            }
          }
          setLabQuality(map);
        }
      } catch (err) {
        console.error('[DiagnosticsCC] Failed to load lab quality', err);
      }
    };
    loadQuality();
  }, [company.id]);

  const isResetVisible =
    typeof window !== 'undefined'
      ? process.env.NODE_ENV !== 'production' || window.location.search.includes('admin=1')
      : process.env.NODE_ENV !== 'production';

  return (
    <div className="space-y-6">
      {/* ================================================================== */}
      {/* HEADER */}
      {/* ================================================================== */}
      <div>
        <h1 className="text-2xl font-bold text-white">Discover</h1>
        <p className="text-xs text-purple-400/80 mt-0.5">Phase 1</p>
        <p className="text-sm text-slate-400 mt-1">
          Gather business context through Labs.
        </p>
      </div>

      {/* Context intro */}
      <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
        <p className="text-sm text-purple-300/90">
          Discover is where you gather facts before making decisions—whether you&apos;re building strategy from scratch or responding to an RFP.
        </p>
      </div>

      {/* Context Readiness Panel */}
      <ContextReadinessPanel
        companyId={company.id}
        requiredFor="labs"
        compact={false}
      />

      {/* Admin-only Reset Panel (dev or ?admin=1) */}
      {isResetVisible && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-white">Company Reset (Admin)</p>
              <p className="text-xs text-slate-500">Scoped to this company only. Default is soft reset.</p>
            </div>
            {resetBusy && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={resetBusy}
              onClick={async () => {
                setResetBusy(true);
                setResetResult(null);
                try {
                  const res = await fetch(`/api/os/companies/${company.id}/reset`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'dryRun', resetKind: 'soft' }),
                  });
                  const json = await res.json();
                  setResetResult(JSON.stringify(json, null, 2));
                } finally {
                  setResetBusy(false);
                }
              }}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
            >
              Dry Run (Soft)
            </button>
            <button
              disabled={resetBusy}
              onClick={async () => {
                if (!window.confirm('Apply soft reset for this company?')) return;
                setResetBusy(true);
                setResetResult(null);
                try {
                  const res = await fetch(`/api/os/companies/${company.id}/reset`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'apply', resetKind: 'soft' }),
                  });
                  const json = await res.json();
                  setResetResult(JSON.stringify(json, null, 2));
                } finally {
                  setResetBusy(false);
                }
              }}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40"
            >
              Apply Soft Reset
            </button>
            <button
              disabled={resetBusy}
              onClick={async () => {
                if (!window.confirm('Hard delete is irreversible. Continue?')) return;
                setResetBusy(true);
                setResetResult(null);
                try {
                  const res = await fetch(`/api/os/companies/${company.id}/reset`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'apply', resetKind: 'hard', confirmHardDelete: true }),
                  });
                  const json = await res.json();
                  setResetResult(JSON.stringify(json, null, 2));
                } finally {
                  setResetBusy(false);
                }
              }}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40"
            >
              Apply Hard Delete
            </button>
          </div>
          {resetResult && (
            <pre className="mt-3 text-[11px] text-slate-300 bg-slate-950/70 border border-slate-800 rounded p-2 max-h-64 overflow-auto">
              {resetResult}
            </pre>
          )}
        </div>
      )}

      {/* Dev-only UI state debug indicator */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="text-[10px] font-mono text-slate-500 bg-slate-900/50 border border-slate-800/50 rounded px-2 py-1">
          <span className="text-cyan-400">{uiState.state}</span>
          <span className="mx-2">|</span>
          paths: {uiState.showStartingPaths}
          <span className="mx-2">|</span>
          pack: {uiState.showPackRunner}
          <span className="mx-2">|</span>
          labs: {uiState.showLabsGrid}
          <span className="mx-2">|</span>
          runs: {uiState.showRecentRuns}
          <span className="mx-2">|</span>
          nextStep: {uiState.showNextStepPanel ? 'yes' : 'no'}
          <span className="mx-2">|</span>
          CTA: &quot;{uiState.primaryCTA.label}&quot;
        </div>
      )}

      {/* ================================================================== */}
      {/* STARTING PATHS - visibility controlled by selector */}
      {/* ================================================================== */}
      {isVisible(uiState.showStartingPaths) && !selectedPath && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-white">How are you starting?</h2>
            <p className="text-sm text-slate-400 mt-1">
              Choose a path to gather the right context. You can always adjust later.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {STARTING_PATHS.map(path => {
              const colors = getColorClasses(path.color);
              const Icon = iconMap[path.icon];
              return (
                <button
                  key={path.id}
                  onClick={() => handleSelectPath(path)}
                  className={`text-left rounded-xl border p-4 ${colors.bg} ${colors.border} hover:border-opacity-60 transition-all`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-lg ${colors.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${colors.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white">{path.name}</h3>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-3 line-clamp-2">{path.description}</p>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                    <Play className="w-3 h-3" />
                    {path.ctaLabel}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* PACK RUNNER - Show after a path is selected */}
      {/* ================================================================== */}
      {isVisible(uiState.showPackRunner) && selectedPath && selectedPath !== 'custom' && recommendedLabs.length > 0 && (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-300">
                {STARTING_PATHS.find(p => p.id === selectedPath)?.name} started
              </span>
            </div>
            <button
              onClick={() => setSelectedPath(null)}
              className="text-xs text-slate-500 hover:text-slate-400"
            >
              Change path
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400">Recommended next:</span>
            {recommendedLabs.map(lab => {
              const isRunning = runningLabs.has(lab.id);
              const lastRun = getLastRunForLab(lab.id);
              const isComplete = lastRun?.status === 'complete';
              return (
                <button
                  key={lab.id}
                  onClick={() => handleRunLab(lab)}
                  disabled={isRunning || isComplete || !lab.runApiPath}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isComplete
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : isRunning
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : lab.runApiPath
                      ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : isRunning ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  {lab.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Activity className="w-4 h-4" />
          )}
          <span className="text-sm">{toast.message}</span>
        </div>
      )}

      {/* ================================================================== */}
      {/* 1. TOP STATUS STRIP */}
      {/* ================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Last diagnostic status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {lastFullDiagnostic ? (
                <>
                  <div className="text-center">
                    <div className={`text-2xl font-bold tabular-nums ${getScoreColor(lastFullDiagnostic.score)}`}>
                      {lastFullDiagnostic.score ?? '—'}
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Score</p>
                  </div>
                  <div className="h-8 w-px bg-slate-700" />
                  <div>
                    <p className="text-sm text-slate-300">
                      Last full diagnostic
                    </p>
                    <p className="text-xs text-slate-500" suppressHydrationWarning>
                      {formatRelativeTime(lastFullDiagnostic.completedAt)}
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-sm text-slate-300">No full diagnostic yet</p>
                  <p className="text-xs text-slate-500">Run a Full GAP to get started</p>
                </div>
              )}
            </div>

            {/* Data Confidence */}
            <div className="hidden sm:block">
              <DataConfidenceBadge companyId={company.id} sources={dataSources} />
            </div>
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleRunFullDiagnostic}
              disabled={runningLabs.has('gapPlan')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {runningLabs.has('gapPlan') ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Run Full Diagnostic
                </>
              )}
            </button>
            <Link
              href={`/c/${company.id}/reports/diagnostics`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition-colors border border-slate-700"
            >
              <Clock className="w-4 h-4" />
              View History
            </Link>
          </div>
        </div>

        {/* Mobile: Data Confidence */}
        <div className="sm:hidden mt-3 pt-3 border-t border-slate-800">
          <DataConfidenceBadge companyId={company.id} sources={dataSources} />
        </div>
      </div>

      {/* ================================================================== */}
      {/* 2. CORE LABS GRID */}
      {/* ================================================================== */}
      <div id="core-labs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Core Labs</h2>
          <p className="text-xs text-slate-500">Essential diagnostics for marketing health</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {coreLabs.map(lab => (
            <LabCard
              key={lab.id}
              lab={lab}
              lastRun={getLastRunForLab(lab.id)}
              isRunning={runningLabs.has(lab.id)}
              onRun={() => handleRunLab(lab)}
              companyId={company.id}
              qualityLabel={labQuality[lab.id]?.label}
              qualityScore={labQuality[lab.id]?.score ?? null}
              qualityReason={labQuality[lab.id]?.reason}
            />
          ))}
        </div>
      </div>

      {/* ================================================================== */}
      {/* 3. SPECIALIZED LABS GRID */}
      {/* ================================================================== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Specialized Labs</h2>
          <p className="text-xs text-slate-500">Deep-dive into specific areas</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {specializedLabs.map(lab => (
            <LabCard
              key={lab.id}
              lab={lab}
              lastRun={getLastRunForLab(lab.id)}
              isRunning={runningLabs.has(lab.id)}
              onRun={() => handleRunLab(lab)}
              companyId={company.id}
              qualityLabel={labQuality[lab.id]?.label}
              qualityScore={labQuality[lab.id]?.score ?? null}
              qualityReason={labQuality[lab.id]?.reason}
            />
          ))}
        </div>
      </div>

      {/* ================================================================== */}
      {/* 4. FINDINGS / PLAN TEASER */}
      {/* ================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Plan & Findings</h3>
              <p className="text-xs text-slate-400">
                {openFindingsCount > 0
                  ? `You have ${openFindingsCount} open finding${openFindingsCount !== 1 ? 's' : ''} from recent diagnostics`
                  : 'Run diagnostics to discover findings'}
              </p>
            </div>
          </div>
          <Link
            href={`/c/${company.id}/findings`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-medium text-sm transition-colors border border-blue-500/30"
          >
            Open Plan
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ================================================================== */}
      {/* 5. RECENT DIAGNOSTICS - visibility controlled by selector */}
      {/* ================================================================== */}
      {isVisible(uiState.showRecentRuns) && (
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-white">Recent Diagnostics</h3>
          </div>
          <Link
            href={`/c/${company.id}/reports/diagnostics`}
            className="text-xs text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-1"
          >
            View all history
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentRuns.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-500">No diagnostics run yet</p>
            <p className="text-xs text-slate-600 mt-1">Run a lab above to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {recentRuns.map(run => (
              <div
                key={run.id}
                className="px-4 py-3 hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        run.status === 'complete'
                          ? 'bg-emerald-400'
                          : run.status === 'running'
                          ? 'bg-blue-400 animate-pulse'
                          : run.status === 'failed'
                          ? 'bg-red-400'
                          : 'bg-slate-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 truncate">{run.toolLabel}</p>
                      <p className="text-xs text-slate-500" suppressHydrationWarning>
                        {formatRelativeTime(run.completedAt || run.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {run.score != null && (
                      <span className={`text-sm font-semibold tabular-nums ${getScoreColor(run.score)}`}>
                        {run.score}
                      </span>
                    )}
                    {run.status === 'complete' && run.reportPath && (
                      <Link
                        href={run.reportPath}
                        className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                      >
                        View
                      </Link>
                    )}
                  </div>
                </div>
                {/* Show error message for failed runs */}
                {run.status === 'failed' && run.error && (
                  <p className="text-xs text-red-400/80 mt-1 pl-5 line-clamp-1" title={run.error}>
                    {run.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* ================================================================== */}
      {/* 6. NEXT STEP PANEL - Show when eligible to proceed to Decide */}
      {/* ================================================================== */}
      {uiState.showNextStepPanel && uiState.nextStepCTA && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-400/80 uppercase tracking-wider mb-1">Next Step</p>
              <p className="text-base font-medium text-emerald-300">
                Context is ready for review
              </p>
              <p className="text-sm text-emerald-400/70 mt-1">
                Labs have extracted proposals. Review and confirm them in Decide.
              </p>
            </div>
            <Link
              href={uiState.nextStepCTA.href}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm transition-colors"
            >
              {uiState.nextStepCTA.label}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* 7. DMA ACTIVITY TIMELINE */}
      {/* ================================================================== */}
      <CompanyDMATimeline companyId={company.id} />
    </div>
  );
}

export default DiagnosticsControlCenter;
