// app/c/[companyId]/brain/context/ContextHealthHeader.tsx
// Context Health Header for Brain → Context page
//
// Two-band hierarchical layout:
// 1. Primary Actions: Autocomplete, Context Actions dropdown
// 2. Health Summary: Score, metrics, collapsible issues drawer
//
// NOTE: Secondary actions (domain filters, Edit/Explorer/Strategic toggles)
// have been removed. Inline editing is always enabled. Explorer mode is now
// accessible via the top-level /brain/explorer tab.

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ContextHealthScore, ContextSeverity } from '@/lib/contextGraph/health';
import type { ReadinessCheckResult } from '@/lib/contextGraph/readiness';
import { AutoFillReadinessModal } from '@/components/os/AutoFillReadinessModal';

// ============================================================================
// Types
// ============================================================================

interface OnboardingStep {
  step: 'initialize' | 'fcb' | 'audience_lab' | 'brand_lab' | 'creative_lab' | 'competitor_lab' | 'website_lab' | 'gap_ia' | 'competition_discovery' | 'competition_import' | 'snapshot';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  durationMs?: number;
  message?: string;
  error?: string;
}

interface OnboardingResult {
  success: boolean;
  companyName: string;
  runId: string;
  durationMs: number;
  steps: OnboardingStep[];
  summary: {
    fieldsPopulated: number;
    fieldsRefined: number;
    insightsGenerated: number;
    healthImprovement: number;
  };
  contextHealthBefore: { score: number; severity: string };
  contextHealthAfter: { score: number; severity: string };
  error?: string;
}

interface ContextHealthHeaderProps {
  healthScore: ContextHealthScore;
  companyId: string;
  /** When baseline context was initialized (from graph.meta.contextInitializedAt) */
  baselineInitializedAt?: string | null;
  /** Auto-fill readiness check result */
  autoFillReadiness?: ReadinessCheckResult;
}

// ============================================================================
// Baseline Build Result Type (from API)
// ============================================================================

interface BaselineBuildApiResult {
  success: boolean;
  companyId: string;
  companyName: string;
  runId: string;
  wasNoOp: boolean;
  contextBefore: { overallScore: number; severity: string };
  contextAfter: { overallScore: number; severity: string };
  summary: {
    fieldsPopulated: number;
    fieldsRefined: number;
    healthImprovement: number;
  };
  snapshotId: string | null;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSeverityConfig(severity: ContextSeverity): {
  color: string;
  bg: string;
  border: string;
  label: string;
} {
  switch (severity) {
    case 'healthy':
      return {
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        label: 'Healthy',
      };
    case 'degraded':
      return {
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        label: 'Needs Improvement',
      };
    case 'unhealthy':
    default:
      return {
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        label: 'Needs Attention',
      };
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

/**
 * Check if a field path is manual-only (cannot be auto-filled)
 */
function isManualOnlyField(path: string): boolean {
  // Objectives and Budget fields require human input
  const manualOnlyDomains = ['objectives', 'budgetOps'];
  return manualOnlyDomains.some(domain => path.startsWith(`${domain}.`));
}

/**
 * Format baseline initialization date for display
 */
function formatBaselineDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ============================================================================
// Primary Actions Component (Row 1)
// ============================================================================

interface PrimaryActionsProps {
  companyId: string;
  isAutoFilling: boolean;
  autoFillStep: string;
  isOnboarding: boolean;
  isRunningFCB: boolean;
  isRunningBaseline: boolean;
  baselineStep: string;
  isInitialized: boolean;
  healthScore: number;
  onAutoFill: () => void;
  onDeepBuild: () => void;
  onRecrawl: () => void;
  onFillAutomatically: () => void;
}

function ContextPrimaryActions({
  isAutoFilling,
  autoFillStep,
  isOnboarding,
  isRunningFCB,
  isRunningBaseline,
  baselineStep,
  isInitialized,
  healthScore,
  onAutoFill,
  onDeepBuild,
  onRecrawl,
  onFillAutomatically,
}: PrimaryActionsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAnyRunning = isAutoFilling || isOnboarding || isRunningFCB || isRunningBaseline;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showAdvanced) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAdvanced(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAdvanced]);

  // Show Autocomplete as primary action when:
  // 1. Not initialized yet, OR
  // 2. Health score is below 80% (still room for improvement)
  const showAutocompleteAsPrimary = !isInitialized || healthScore < 80;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* PRIMARY: Autocomplete - shown when not initialized OR health < 80% */}
      {showAutocompleteAsPrimary && (
        <div className="group relative">
          <button
            onClick={onFillAutomatically}
            disabled={isAnyRunning}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isRunningBaseline ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="min-w-[140px] text-left">{baselineStep}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Autocomplete
              </>
            )}
          </button>
          {/* Tooltip */}
          <div className="absolute left-0 top-full mt-2 w-80 p-3 rounded-lg bg-slate-800 border border-slate-700 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-xs pointer-events-none">
            <div className="font-medium text-slate-200 mb-1.5">One-click context initialization</div>
            <div className="text-slate-400 space-y-1.5">
              <p>Runs the full baseline build pipeline:</p>
              <ul className="list-disc list-inside pl-1 space-y-0.5">
                <li>Website crawler (FCB)</li>
                <li>All 5 refinement Labs</li>
                <li>Competitor auto-seeding</li>
                <li>GAP insights</li>
                <li>Baseline snapshot</li>
              </ul>
              <p className="text-amber-400/80 flex items-center gap-1 mt-2">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Objectives, KPIs & Budget require human input.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Show dropdown with advanced actions when initialized */}
      {isInitialized && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            disabled={isAnyRunning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnyRunning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="min-w-[140px] text-left">
                  {isAutoFilling ? autoFillStep : isRunningBaseline ? baselineStep : 'Running...'}
                </span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Context Actions
                <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>

          {/* Dropdown menu */}
          {showAdvanced && !isAnyRunning && (
            <div className="absolute left-0 top-full mt-1 w-64 rounded-lg bg-slate-800 border border-slate-700 shadow-xl z-50 overflow-hidden">
              {/* Rebuild Baseline */}
              <button
                onClick={() => { setShowAdvanced(false); onFillAutomatically(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-700/50 transition-colors"
              >
                <div className="p-1.5 rounded-md bg-emerald-500/20">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-slate-200">Rebuild Baseline</div>
                  <div className="text-xs text-slate-500">Force re-run full pipeline</div>
                </div>
              </button>

              <div className="h-px bg-slate-700/50" />

              {/* Smart Auto-Fill */}
              <button
                onClick={() => { setShowAdvanced(false); onAutoFill(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-700/50 transition-colors"
              >
                <div className="p-1.5 rounded-md bg-violet-500/20">
                  <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-slate-200">Smart Auto-Fill</div>
                  <div className="text-xs text-slate-500">Quick fill from existing data</div>
                </div>
              </button>

              {/* Deep Context Build */}
              <button
                onClick={() => { setShowAdvanced(false); onDeepBuild(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-700/50 transition-colors"
              >
                <div className="p-1.5 rounded-md bg-cyan-500/20">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-slate-200">Deep Context Build</div>
                  <div className="text-xs text-slate-500">FCB + Labs with streaming</div>
                </div>
              </button>

              {/* Re-crawl Website */}
              <button
                onClick={() => { setShowAdvanced(false); onRecrawl(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-700/50 transition-colors"
              >
                <div className="p-1.5 rounded-md bg-amber-500/20">
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-slate-200">Re-crawl Website</div>
                  <div className="text-xs text-slate-500">Refresh website data only</div>
                </div>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Health Summary Component (Row 2)
// ============================================================================

interface HealthSummaryProps {
  healthScore: ContextHealthScore;
  companyId: string;
}

function ContextHealthSummary({ healthScore, companyId }: HealthSummaryProps) {
  const [isIssuesOpen, setIsIssuesOpen] = useState(false);
  const severityConfig = getSeverityConfig(healthScore.severity);

  // Get weak sections (< 60% critical coverage)
  const weakSections = healthScore.sectionScores
    .filter(s => s.criticalFields > 0 && s.criticalCoverage < 60)
    .sort((a, b) => a.criticalCoverage - b.criticalCoverage);

  const totalIssues = weakSections.length + healthScore.missingCriticalFields.length;
  const hasIssues = totalIssues > 0;

  return (
    <div className={`rounded-lg border ${severityConfig.border} ${severityConfig.bg} p-4`}>
      {/* Score + Metrics Row */}
      <div className="flex flex-wrap items-center gap-6">
        {/* Overall Score + Status */}
        <div className="flex items-center gap-3">
          <div className={`text-3xl font-bold tabular-nums ${severityConfig.color}`}>
            {healthScore.overallScore}
          </div>
          <div className={`text-sm font-medium ${severityConfig.color}`}>
            {severityConfig.label}
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-slate-700/50 hidden sm:block" />

        {/* Metrics */}
        <div className="flex items-center gap-4 text-sm">
          <span className={getScoreColor(healthScore.completenessScore)}>
            <span className="font-semibold tabular-nums">{healthScore.completenessScore}%</span>
            <span className="text-slate-500 ml-1">Complete</span>
          </span>
          <span className="text-slate-600">·</span>
          <span className={getScoreColor(healthScore.criticalCoverageScore)}>
            <span className="font-semibold tabular-nums">{healthScore.criticalCoverageScore}%</span>
            <span className="text-slate-500 ml-1">Critical</span>
          </span>
          <span className="text-slate-600">·</span>
          <span className={getScoreColor(healthScore.freshnessScore)}>
            <span className="font-semibold tabular-nums">{healthScore.freshnessScore}%</span>
            <span className="text-slate-500 ml-1">Fresh</span>
          </span>
        </div>
      </div>

      {/* Issues Drawer Toggle */}
      <div className="mt-3 pt-3 border-t border-slate-700/30">
        {hasIssues ? (
          <>
            <button
              onClick={() => setIsIssuesOpen(!isIssuesOpen)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300 transition-colors"
            >
              <svg
                className={`w-3 h-3 transition-transform ${isIssuesOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {isIssuesOpen ? 'Hide' : 'Show'} issues ({totalIssues})
            </button>

            {/* Expanded Issues */}
            {isIssuesOpen && (
              <div className="mt-3 space-y-3">
                {/* Weak Sections */}
                {weakSections.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                      Weak Sections
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {weakSections.map((section) => (
                        <span
                          key={section.section}
                          className={`text-xs px-2 py-0.5 rounded ${
                            section.criticalCoverage < 30
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {section.label}: {section.criticalCoverage}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Critical Fields */}
                {healthScore.missingCriticalFields.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                      Missing Critical Fields
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {healthScore.missingCriticalFields.map((field) => {
                        const isManual = isManualOnlyField(field.path);
                        return (
                          <div
                            key={field.path}
                            className="flex items-center gap-1.5 text-xs bg-slate-800/50 rounded px-2 py-1"
                          >
                            <span className="text-slate-300">{field.label}</span>
                            {isManual ? (
                              // Manual-only fields link to the field in Context editor
                              <Link
                                href={`/c/${companyId}/brain/context?nodeId=${encodeURIComponent(field.path)}`}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors flex items-center gap-0.5"
                                title="This field requires human input - click to edit"
                              >
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                Edit
                              </Link>
                            ) : (
                              // All other fields also link to Context editor for inline editing
                              <Link
                                href={`/c/${companyId}/brain/context?nodeId=${encodeURIComponent(field.path)}`}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors flex items-center gap-0.5"
                                title="Click to edit this field"
                              >
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                Edit
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Microcopy for manual fields with AI Helper hint */}
                    {healthScore.missingCriticalFields.some(f => isManualOnlyField(f.path)) && (
                      <p className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                        <svg className="w-3 h-3 text-amber-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                          Objectives require human input.{' '}
                          <span className="text-violet-400">Use AI Helper</span> to define them step-by-step.
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-emerald-400/70">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            All critical fields populated
          </div>
        )}
      </div>
    </div>
  );
}

// NOTE: ContextSecondaryActions component removed.
// Domain filters are now in the left sidebar (ContextGraphViewer).
// Edit mode is always enabled (no toggle needed).
// Explorer/Strategic modes moved to /brain/explorer tab.

// ============================================================================
// Main Component
// ============================================================================

export function ContextHealthHeader({ healthScore, companyId, baselineInitializedAt, autoFillReadiness }: ContextHealthHeaderProps) {
  const router = useRouter();

  // Onboarding state
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardingSteps, setOnboardingSteps] = useState<OnboardingStep[]>([]);
  const [onboardingResult, setOnboardingResult] = useState<OnboardingResult | null>(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  // Smart Auto-Fill state
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [autoFillStep, setAutoFillStep] = useState<string>('Starting...');
  const [autoFillResult, setAutoFillResult] = useState<{
    success: boolean;
    message: string;
    fieldsUpdated?: number;
    healthBefore?: number;
    healthAfter?: number;
  } | null>(null);

  // FCB-only (Re-crawl Website) state
  const [isRunningFCB, setIsRunningFCB] = useState(false);
  const [fcbResult, setFcbResult] = useState<{
    success: boolean;
    message: string;
    fieldsUpdated?: number;
    fieldsSkipped?: number;
  } | null>(null);

  // Baseline Build state (Fill My Company Automatically)
  const [isRunningBaseline, setIsRunningBaseline] = useState(false);
  const [baselineResult, setBaselineResult] = useState<BaselineBuildApiResult | null>(null);
  const [baselineStep, setBaselineStep] = useState<string>('Starting...');

  // Readiness modal state
  const [showReadinessModal, setShowReadinessModal] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);

  // Run full onboarding ("Deep Context Build") with SSE streaming
  async function runOnboarding() {
    setIsOnboarding(true);
    setOnboardingResult(null);
    setShowOnboardingModal(true);
    setOnboardingSteps([
      { step: 'initialize', status: 'pending' },
      { step: 'fcb', status: 'pending' },
      { step: 'audience_lab', status: 'pending' },
      { step: 'brand_lab', status: 'pending' },
      { step: 'creative_lab', status: 'pending' },
      { step: 'competitor_lab', status: 'pending' },
      { step: 'website_lab', status: 'pending' },
      { step: 'gap_ia', status: 'pending' },
      { step: 'competition_discovery', status: 'pending' },
      { step: 'competition_import', status: 'pending' },
      { step: 'snapshot', status: 'pending' },
    ]);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/onboarding/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setOnboardingResult({
          success: false,
          companyName: '',
          runId: '',
          durationMs: 0,
          steps: [],
          summary: { fieldsPopulated: 0, fieldsRefined: 0, insightsGenerated: 0, healthImprovement: 0 },
          contextHealthBefore: { score: 0, severity: 'unhealthy' },
          contextHealthAfter: { score: 0, severity: 'unhealthy' },
          error: errorData.error || 'Failed to start onboarding',
        });
        setIsOnboarding(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'step_started' || data.type === 'step_completed' ||
                  data.type === 'step_failed' || data.type === 'step_skipped') {
                setOnboardingSteps(data.steps);
              } else if (data.type === 'complete' || data.type === 'done') {
                const result = data.result || data;
                setOnboardingSteps(result.steps || data.steps || []);
                setOnboardingResult({
                  success: result.success,
                  companyName: result.companyName || '',
                  runId: result.runId || '',
                  durationMs: result.durationMs || 0,
                  steps: result.steps || [],
                  summary: result.summary || { fieldsPopulated: 0, fieldsRefined: 0, insightsGenerated: 0, healthImprovement: 0 },
                  contextHealthBefore: result.contextHealthBefore || { score: 0, severity: 'unhealthy' },
                  contextHealthAfter: result.contextHealthAfter || { score: 0, severity: 'unhealthy' },
                  error: result.error,
                });
                router.refresh();
              } else if (data.type === 'error') {
                setOnboardingResult({
                  success: false,
                  companyName: '',
                  runId: '',
                  durationMs: 0,
                  steps: data.steps || [],
                  summary: { fieldsPopulated: 0, fieldsRefined: 0, insightsGenerated: 0, healthImprovement: 0 },
                  contextHealthBefore: { score: 0, severity: 'unhealthy' },
                  contextHealthAfter: { score: 0, severity: 'unhealthy' },
                  error: data.error || 'Onboarding failed',
                });
              }
            } catch (parseError) {
              console.error('[Onboarding] Failed to parse SSE data:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('[Onboarding] Stream error:', error);
      setOnboardingResult({
        success: false,
        companyName: '',
        runId: '',
        durationMs: 0,
        steps: [],
        summary: { fieldsPopulated: 0, fieldsRefined: 0, insightsGenerated: 0, healthImprovement: 0 },
        contextHealthBefore: { score: 0, severity: 'unhealthy' },
        contextHealthAfter: { score: 0, severity: 'unhealthy' },
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsOnboarding(false);
    }
  }

  // Run Smart Auto-Fill
  async function runSmartAutoFill() {
    setIsAutoFilling(true);
    setAutoFillResult(null);
    setAutoFillStep('Starting...');

    // Simulate progress steps since the API doesn't stream
    const steps = [
      { delay: 500, message: 'Checking existing data...' },
      { delay: 2000, message: 'Running FCB extraction...' },
      { delay: 5000, message: 'Running Audience Lab...' },
      { delay: 8000, message: 'Running Brand Lab...' },
      { delay: 11000, message: 'Running Creative Lab...' },
      { delay: 14000, message: 'Running Competitor Lab...' },
      { delay: 17000, message: 'Running Website Lab...' },
      { delay: 20000, message: 'Running GAP IA analysis...' },
      { delay: 24000, message: 'Merging results...' },
      { delay: 27000, message: 'Updating context graph...' },
    ];

    // Set up timers for each step
    const timers: NodeJS.Timeout[] = [];
    for (const step of steps) {
      const timer = setTimeout(() => {
        setAutoFillStep(step.message);
      }, step.delay);
      timers.push(timer);
    }

    try {
      const response = await fetch(`/api/os/companies/${companyId}/context/auto-fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Clear all timers once API returns
      timers.forEach(t => clearTimeout(t));

      const data = await response.json();

      if (!response.ok || data.status === 'error') {
        setAutoFillResult({
          success: false,
          message: data.error || 'Smart Auto-Fill failed',
        });
        return;
      }

      const result = data.result;
      const healthBefore = result.contextHealthBefore?.overallScore ?? 0;
      const healthAfter = result.contextHealthAfter?.overallScore ?? 0;
      const improvement = healthAfter - healthBefore;

      setAutoFillResult({
        success: true,
        message: `${result.fieldsUpdated} field${result.fieldsUpdated !== 1 ? 's' : ''} updated${result.fieldsSkippedHumanOverride > 0 ? `, ${result.fieldsSkippedHumanOverride} skipped (human)` : ''}. Health: ${healthBefore}% → ${healthAfter}%${improvement > 0 ? ` (+${improvement})` : ''}`,
        fieldsUpdated: result.fieldsUpdated,
        healthBefore,
        healthAfter,
      });

      router.refresh();
    } catch (error) {
      // Clear all timers on error
      timers.forEach(t => clearTimeout(t));

      setAutoFillResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsAutoFilling(false);
    }
  }

  // Run FCB only (Re-crawl Website)
  async function runFCBOnly() {
    setIsRunningFCB(true);
    setFcbResult(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/fcb/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });

      const data = await response.json();

      if (!response.ok || data.status === 'error') {
        setFcbResult({
          success: false,
          message: data.error || 'Could not re-crawl website.',
        });
        return;
      }

      setFcbResult({
        success: true,
        message: `${data.updatedFields || 0} field${(data.updatedFields || 0) !== 1 ? 's' : ''} updated${data.skippedHumanOverrides > 0 ? `, ${data.skippedHumanOverrides} skipped (human)` : ''}.`,
        fieldsUpdated: data.updatedFields,
        fieldsSkipped: data.skippedHumanOverrides,
      });

      router.refresh();
    } catch (error) {
      setFcbResult({
        success: false,
        message: error instanceof Error ? error.message : 'Could not re-crawl website.',
      });
    } finally {
      setIsRunningFCB(false);
    }
  }

  // Handle Autocomplete button click - check readiness first
  function handleAutocompleteClick() {
    // Clear any previous error
    setReadinessError(null);

    // If no readiness data, just run directly
    if (!autoFillReadiness) {
      runBaselineBuildDirectly();
      return;
    }

    // Check if domain is missing (blocking error)
    if (!autoFillReadiness.canProceed) {
      setReadinessError('Add a website domain before running Autocomplete.');
      return;
    }

    // If fully ready, run directly
    if (autoFillReadiness.isFullyReady) {
      runBaselineBuildDirectly();
      return;
    }

    // Show readiness modal for missing recommended fields
    setShowReadinessModal(true);
  }

  // Run Baseline Build directly (without readiness check)
  async function runBaselineBuildDirectly() {
    setIsRunningBaseline(true);
    setBaselineResult(null);
    setBaselineStep('Starting...');

    // Simulate progress steps since the API doesn't stream
    const steps = [
      { delay: 500, message: 'Crawling website...' },
      { delay: 3000, message: 'Extracting brand signals...' },
      { delay: 6000, message: 'Running Audience Lab...' },
      { delay: 9000, message: 'Running Brand Lab...' },
      { delay: 12000, message: 'Running Creative Lab...' },
      { delay: 15000, message: 'Running Competitor Lab...' },
      { delay: 18000, message: 'Running Website Lab...' },
      { delay: 21000, message: 'Running GAP IA analysis...' },
      { delay: 25000, message: 'Discovering competitors...' },
      { delay: 28000, message: 'Importing competitor data...' },
      { delay: 31000, message: 'Creating baseline snapshot...' },
      { delay: 35000, message: 'Finalizing context...' },
    ];

    // Set up timers for each step
    const timers: NodeJS.Timeout[] = [];
    for (const step of steps) {
      const timer = setTimeout(() => {
        setBaselineStep(step.message);
      }, step.delay);
      timers.push(timer);
    }

    try {
      const response = await fetch(`/api/os/companies/${companyId}/context/baseline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: !!baselineInitializedAt }), // Force if already initialized
      });

      // Clear all timers once API returns
      timers.forEach(t => clearTimeout(t));

      const data: BaselineBuildApiResult = await response.json();

      if (!response.ok || !data.success) {
        setBaselineResult({
          ...data,
          success: false,
        });
        return;
      }

      setBaselineResult(data);
      router.refresh();
    } catch (error) {
      // Clear all timers on error
      timers.forEach(t => clearTimeout(t));

      setBaselineResult({
        success: false,
        companyId,
        companyName: '',
        runId: '',
        wasNoOp: false,
        contextBefore: { overallScore: 0, severity: 'unhealthy' },
        contextAfter: { overallScore: 0, severity: 'unhealthy' },
        summary: { fieldsPopulated: 0, fieldsRefined: 0, healthImprovement: 0 },
        snapshotId: null,
        error: error instanceof Error ? error.message : 'Baseline build failed',
      });
    } finally {
      setIsRunningBaseline(false);
    }
  }

  const isAnyRunning = isAutoFilling || isOnboarding || isRunningFCB || isRunningBaseline;

  return (
    <div className="space-y-4">
      {/* Row 1: Primary Actions */}
      <ContextPrimaryActions
        companyId={companyId}
        isAutoFilling={isAutoFilling}
        autoFillStep={autoFillStep}
        isOnboarding={isOnboarding}
        isRunningFCB={isRunningFCB}
        isRunningBaseline={isRunningBaseline}
        baselineStep={baselineStep}
        isInitialized={!!baselineInitializedAt}
        healthScore={healthScore.overallScore}
        onAutoFill={runSmartAutoFill}
        onDeepBuild={runOnboarding}
        onRecrawl={runFCBOnly}
        onFillAutomatically={handleAutocompleteClick}
      />

      {/* Row 2: Health Summary */}
      <ContextHealthSummary healthScore={healthScore} companyId={companyId} />

      {/* Baseline Status Line */}
      {baselineInitializedAt && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <svg className="w-3.5 h-3.5 text-emerald-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Baseline context created on{' '}
            <span className="text-slate-400">
              {formatBaselineDate(baselineInitializedAt)}
            </span>
            {' · '}
            <span className={`font-medium ${
              healthScore.overallScore >= 70 ? 'text-emerald-400' :
              healthScore.overallScore >= 40 ? 'text-amber-400' :
              'text-red-400'
            }`}>
              {healthScore.overallScore}% complete
            </span>
            {' · '}
            <span className={`${
              healthScore.freshnessScore >= 80 ? 'text-emerald-400/70' :
              healthScore.freshnessScore >= 50 ? 'text-amber-400/70' :
              'text-red-400/70'
            }`}>
              {healthScore.freshnessScore}% fresh
            </span>
          </span>
        </div>
      )}

      {/* Result Toasts */}
      {autoFillResult && (
        <Toast
          type={autoFillResult.success ? 'violet' : 'red'}
          message={autoFillResult.message}
          onClose={() => setAutoFillResult(null)}
        />
      )}

      {fcbResult && (
        <Toast
          type={fcbResult.success ? 'amber' : 'red'}
          message={fcbResult.message}
          onClose={() => setFcbResult(null)}
        />
      )}

      {/* Baseline Build Result Toast */}
      {baselineResult && (
        <Toast
          type={baselineResult.success ? (baselineResult.summary.healthImprovement > 0 ? 'emerald' : 'amber') : 'red'}
          message={
            baselineResult.success
              ? baselineResult.wasNoOp
                ? `Context already initialized. No changes needed.`
                : baselineResult.summary.healthImprovement > 0
                  ? `Context improved! ${baselineResult.contextBefore.overallScore}% → ${baselineResult.contextAfter.overallScore}% (+${baselineResult.summary.healthImprovement}).`
                  : `Autocomplete finished at ${baselineResult.contextAfter.overallScore}%. Run diagnostics or add data manually to improve.`
              : baselineResult.error || 'Baseline build failed'
          }
          onClose={() => setBaselineResult(null)}
        />
      )}

      {/* Onboarding Modal */}
      {showOnboardingModal && (
        <OnboardingModal
          isRunning={isOnboarding}
          steps={onboardingSteps}
          result={onboardingResult}
          onClose={() => setShowOnboardingModal(false)}
        />
      )}

      {/* Readiness Error Toast (blocking - no domain) */}
      {readinessError && (
        <Toast
          type="red"
          message={readinessError}
          onClose={() => setReadinessError(null)}
        />
      )}

      {/* Readiness Modal (advisory - missing recommended fields) */}
      {showReadinessModal && autoFillReadiness && (
        <AutoFillReadinessModal
          result={autoFillReadiness}
          companyId={companyId}
          onRunAnyway={runBaselineBuildDirectly}
          onClose={() => setShowReadinessModal(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Toast Component
// ============================================================================

function Toast({
  type,
  message,
  onClose,
}: {
  type: 'violet' | 'amber' | 'red' | 'emerald';
  message: string;
  onClose: () => void;
}) {
  const colors = {
    violet: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    red: 'bg-red-500/20 text-red-300 border-red-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };

  return (
    <div className={`p-3 rounded-lg text-xs border ${colors[type]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex-1">{message}</span>
        <button
          onClick={onClose}
          className="text-current opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Onboarding Modal Component
// ============================================================================

const STEP_LABELS: Record<OnboardingStep['step'], string> = {
  initialize: 'Initialize Context',
  fcb: 'Auto-fill from Website',
  audience_lab: 'Audience Lab',
  brand_lab: 'Brand Lab',
  creative_lab: 'Creative Lab',
  competitor_lab: 'Competitor Lab',
  website_lab: 'Website Lab',
  gap_ia: 'Marketing Assessment',
  competition_discovery: 'Discover Competitors',
  competition_import: 'Import Competitors',
  snapshot: 'Create Baseline Snapshot',
};

function OnboardingModal({
  isRunning,
  steps,
  result,
  onClose,
}: {
  isRunning: boolean;
  steps: OnboardingStep[];
  result: OnboardingResult | null;
  onClose: () => void;
}) {
  const getStatusIcon = (status: OnboardingStep['status']) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'running':
        return (
          <svg className="w-4 h-4 text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'skipped':
        return (
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        );
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-slate-600" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Deep Context Build</h3>
              <p className="text-xs text-slate-400">FCB + Labs + GAP + Snapshot</p>
            </div>
          </div>
          {!isRunning && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Steps */}
        <div className="p-4 space-y-2">
          {steps.map((step, idx) => (
            <div
              key={step.step}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                step.status === 'running'
                  ? 'bg-blue-500/10 border border-blue-500/30'
                  : step.status === 'completed'
                  ? 'bg-emerald-500/5'
                  : step.status === 'failed'
                  ? 'bg-red-500/5'
                  : 'bg-slate-800/30'
              }`}
            >
              <div className="flex-shrink-0">{getStatusIcon(step.status)}</div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${
                  step.status === 'running' ? 'text-blue-300' :
                  step.status === 'completed' ? 'text-emerald-300' :
                  step.status === 'failed' ? 'text-red-300' :
                  'text-slate-400'
                }`}>
                  {STEP_LABELS[step.step]}
                </div>
                {step.error && (
                  <div className="text-xs text-red-400 mt-0.5 truncate">{step.error}</div>
                )}
                {step.durationMs && step.status !== 'running' && (
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {(step.durationMs / 1000).toFixed(1)}s
                  </div>
                )}
              </div>
              <div className="text-xs text-slate-500 tabular-nums">
                {idx + 1}/{steps.length}
              </div>
            </div>
          ))}
        </div>

        {/* Result Summary */}
        {result && !isRunning && (
          <div className={`mx-4 mb-4 p-4 rounded-lg ${
            result.success
              ? 'bg-emerald-500/10 border border-emerald-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            {result.success ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Build Complete!</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-800/50 rounded p-2">
                    <div className="text-slate-400">Fields Populated</div>
                    <div className="text-lg font-semibold text-slate-200">{result.summary.fieldsPopulated}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded p-2">
                    <div className="text-slate-400">Fields Refined</div>
                    <div className="text-lg font-semibold text-slate-200">{result.summary.fieldsRefined}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded p-2">
                    <div className="text-slate-400">Insights</div>
                    <div className="text-lg font-semibold text-slate-200">{result.summary.insightsGenerated}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded p-2">
                    <div className="text-slate-400">Health Change</div>
                    <div className={`text-lg font-semibold ${
                      result.summary.healthImprovement > 0 ? 'text-emerald-400' :
                      result.summary.healthImprovement < 0 ? 'text-red-400' : 'text-slate-400'
                    }`}>
                      {result.summary.healthImprovement > 0 ? '+' : ''}{result.summary.healthImprovement}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-700/50">
                  <span>
                    Health: {result.contextHealthBefore.score} → {result.contextHealthAfter.score}
                  </span>
                  <span>
                    Duration: {(result.durationMs / 1000).toFixed(1)}s
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Build Failed</span>
                </div>
                {result.error && (
                  <p className="text-sm text-red-300">{result.error}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-700">
          {isRunning ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Running... please wait
            </div>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
