'use client';

// components/context-v4/FactSheetClient.tsx
// Fact Sheet Client Component
//
// Displays confirmed facts grouped by domain with tabs.
// Includes field-level explainability for missing fields.
// Shows strategy readiness panel with batch proposal action.
// Uses nextAction to guide user to next step.

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  FactSheetResponseV4,
  FactSheetDomainV4,
  ContextFieldV4,
  MissingFieldInfoV4,
} from '@/lib/types/contextField';

// Extended domain type with missingFields
interface FactSheetDomainExtended extends FactSheetDomainV4 {
  missingFields?: MissingFieldInfoV4[];
}

// Strategy readiness info from API
interface StrategyReadinessInfo {
  ready: boolean;
  total: number;
  confirmed: number;
  proposed: number;
  missing: number;
  missingFields: Array<{
    path: string;
    label: string;
    reason: string;
  }>;
}

// Propose baseline result
interface ProposeBaselineResult {
  ok: boolean;
  attempted: number;
  created: number;
  skipped: number;
  failed: number;
  reviewUrl?: string;
  error?: string;
  cooldown?: {
    active: boolean;
    remainingSeconds: number | null;
    generatedAt: string | null;
    expiresAt: string | null;
  };
}

// Cooldown state for UI
interface CooldownState {
  active: boolean;
  remainingSeconds: number;
  expiresAt: Date | null;
}

interface FactSheetClientProps {
  companyId: string;
  companyName: string;
}

// Next action from inspect endpoint
interface NextAction {
  type: 'GENERATE_PROPOSALS' | 'REVIEW_PROPOSALS' | 'FIX_STORE_ACCESS';
  message: string;
  endpoint: string | null;
}

// Extended response type with missingFields and strategyReadiness
interface FactSheetResponseExtended extends Omit<FactSheetResponseV4, 'domains'> {
  domains: FactSheetDomainExtended[];
  strategyReadiness?: StrategyReadinessInfo;
}

export function FactSheetClient({ companyId, companyName }: FactSheetClientProps) {
  const router = useRouter();
  const [data, setData] = useState<FactSheetResponseExtended | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [proposingField, setProposingField] = useState<string | null>(null);

  // Baseline proposal state
  const [proposingBaseline, setProposingBaseline] = useState(false);
  const [baselineResult, setBaselineResult] = useState<ProposeBaselineResult | null>(null);

  // Cooldown state
  const [cooldown, setCooldown] = useState<CooldownState>({
    active: false,
    remainingSeconds: 0,
    expiresAt: null,
  });

  // Cooldown countdown effect
  useEffect(() => {
    if (!cooldown.active || !cooldown.expiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((cooldown.expiresAt!.getTime() - Date.now()) / 1000));
      if (remaining <= 0) {
        setCooldown({ active: false, remainingSeconds: 0, expiresAt: null });
      } else {
        setCooldown(prev => ({ ...prev, remainingSeconds: remaining }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldown.active, cooldown.expiresAt]);

  // nextAction state for UX guidance
  const [nextAction, setNextAction] = useState<NextAction | null>(null);
  const generateCTARef = useRef<HTMLButtonElement>(null);

  // Fetch nextAction from inspect endpoint
  useEffect(() => {
    async function fetchNextAction() {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/context/v4/inspect`,
          { cache: 'no-store' }
        );
        const json = await response.json();
        if (json.ok && json.nextAction) {
          setNextAction(json.nextAction);

          // Auto-redirect to Review if nextAction says REVIEW_PROPOSALS
          // and we have proposals but nothing to generate
          if (json.nextAction.type === 'REVIEW_PROPOSALS' && json.nextAction.endpoint) {
            // Small delay to let user see the fact sheet first
            // Only redirect if there are actually proposals
            if (json.v4StoreCounts?.proposed > 0) {
              // Don't auto-redirect - just highlight the CTA
              // router.push(json.nextAction.endpoint);
            }
          }
        }
      } catch (err) {
        // Silently fail - nextAction is optional guidance
        console.warn('Failed to fetch nextAction:', err);
      }
    }
    fetchNextAction();
  }, [companyId, router]);

  // Auto-focus CTA when nextAction is GENERATE_PROPOSALS
  useEffect(() => {
    if (nextAction?.type === 'GENERATE_PROPOSALS' && generateCTARef.current) {
      // Scroll CTA into view with a subtle highlight
      generateCTARef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [nextAction]);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/context/v4`,
          { cache: 'no-store' }
        );
        const json = await response.json();

        if (!json.ok) {
          throw new Error(json.error || 'Failed to load fact sheet');
        }

        setData(json);
        // Select first domain with confirmed facts
        const firstWithFacts = json.domains.find(
          (d: FactSheetDomainV4) => d.confirmed.length > 0
        );
        setSelectedDomain(firstWithFacts?.domain || json.domains[0]?.domain);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [companyId]);

  // Targeted propose handler
  const handleProposeField = useCallback(async (fieldKey: string, sources: string[]) => {
    setProposingField(fieldKey);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/context/v4/propose-field`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldKey, sources }),
        }
      );
      const result = await response.json();

      if (result.ok && result.proposedCount > 0) {
        // Refresh data to show updated state
        const refreshResponse = await fetch(
          `/api/os/companies/${companyId}/context/v4`,
          { cache: 'no-store' }
        );
        const refreshJson = await refreshResponse.json();
        if (refreshJson.ok) {
          setData(refreshJson);
        }
      }
    } catch (err) {
      console.error('Failed to propose field:', err);
    } finally {
      setProposingField(null);
    }
  }, [companyId]);

  // Batch baseline proposal handler
  const handleProposeBaseline = useCallback(async () => {
    // Don't allow if in cooldown
    if (cooldown.active) return;

    setProposingBaseline(true);
    setBaselineResult(null);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/context/v4/propose-baseline`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'required-only' }),
        }
      );
      const result: ProposeBaselineResult = await response.json();
      setBaselineResult(result);

      // Handle cooldown from response (both 429 and successful responses)
      if (result.cooldown?.active && result.cooldown.expiresAt) {
        setCooldown({
          active: true,
          remainingSeconds: result.cooldown.remainingSeconds ?? 45,
          expiresAt: new Date(result.cooldown.expiresAt),
        });
      }

      // Handle 429 rate limit
      if (response.status === 429) {
        // Cooldown already set above, just return
        return;
      }

      if (result.ok && result.created > 0) {
        // Refresh data to show updated state
        const refreshResponse = await fetch(
          `/api/os/companies/${companyId}/context/v4`,
          { cache: 'no-store' }
        );
        const refreshJson = await refreshResponse.json();
        if (refreshJson.ok) {
          setData(refreshJson);
        }
      }
    } catch (err) {
      console.error('Failed to propose baseline:', err);
      setBaselineResult({
        ok: false,
        attempted: 0,
        created: 0,
        skipped: 0,
        failed: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setProposingBaseline(false);
    }
  }, [companyId, cooldown.active]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-400">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const currentDomain = data.domains.find((d) => d.domain === selectedDomain);

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">

      {/* Strategy Blocked Panel */}
      {data.strategyReadiness && !data.strategyReadiness.ready && (
        <div className="mb-8 bg-red-500/10 border border-red-500/30 rounded-xl p-5">
          <div className="flex items-start gap-4">
            {/* Warning Icon */}
            <div className="flex-shrink-0 p-2 bg-red-500/20 rounded-lg">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            {/* Content */}
            <div className="flex-1">
              <h3 className="text-base font-semibold text-red-300">
                Strategy Blocked — Missing Required Context
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                {data.strategyReadiness.missing} of {data.strategyReadiness.total} required fields are missing.
                Generate proposals from Labs to populate baseline data.
              </p>

              {/* Missing fields list */}
              {data.strategyReadiness.missingFields.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {data.strategyReadiness.missingFields.slice(0, 5).map((field) => (
                    <li key={field.path} className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="w-1 h-1 rounded-full bg-red-400/60" />
                      <span className="text-slate-400">{field.label}</span>
                      <span className="text-slate-600">— {field.reason}</span>
                    </li>
                  ))}
                  {data.strategyReadiness.missingFields.length > 5 && (
                    <li className="text-xs text-slate-600">
                      +{data.strategyReadiness.missingFields.length - 5} more
                    </li>
                  )}
                </ul>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleProposeBaseline}
                  disabled={proposingBaseline || cooldown.active}
                  className="px-4 py-2 text-sm font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {proposingBaseline ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Proposing {data.strategyReadiness.missing} fields...
                    </span>
                  ) : cooldown.active ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Recently generated ({cooldown.remainingSeconds}s)
                    </span>
                  ) : (
                    'Generate Baseline Proposals (from Labs)'
                  )}
                </button>

                {/* Result summary */}
                {baselineResult && !cooldown.active && (
                  <span className="text-xs text-slate-500">
                    Created: {baselineResult.created} • Skipped: {baselineResult.skipped}
                    {baselineResult.failed > 0 && ` • Failed: ${baselineResult.failed}`}
                  </span>
                )}
              </div>

              {/* Error message */}
              {baselineResult?.error && (
                <p className="mt-2 text-xs text-red-400">{baselineResult.error}</p>
              )}

              {/* Review link after successful proposal */}
              {baselineResult?.ok && baselineResult.created > 0 && (
                <div className="mt-3 pt-3 border-t border-red-500/20">
                  <Link
                    href={`/context-v4/${companyId}/review`}
                    className="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300"
                  >
                    Review & Confirm Proposals
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Required Baseline Progress */}
      {data.strategyReadiness && (
        <RequiredBaselineProgress
          companyId={companyId}
          readiness={data.strategyReadiness}
          totalProposed={data.totalProposed}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Confirmed</p>
          <p className="text-2xl font-semibold text-green-400">
            {data.totalConfirmed}
          </p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Proposed</p>
          <p className="text-2xl font-semibold text-amber-400">
            {data.totalProposed}
          </p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Missing</p>
          <p className="text-2xl font-semibold text-slate-500">
            {data.totalMissing}
          </p>
        </div>
      </div>

      {/* Next Action Banner */}
      {nextAction && (
        <div className={`mb-8 p-4 rounded-lg border flex items-center justify-between ${
          nextAction.type === 'GENERATE_PROPOSALS'
            ? 'bg-blue-500/10 border-blue-500/30'
            : nextAction.type === 'REVIEW_PROPOSALS'
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div>
            <p className={`text-sm font-medium ${
              nextAction.type === 'GENERATE_PROPOSALS'
                ? 'text-blue-300'
                : nextAction.type === 'REVIEW_PROPOSALS'
                ? 'text-amber-300'
                : 'text-red-300'
            }`}>
              {nextAction.type === 'GENERATE_PROPOSALS' && 'Ready to Generate Proposals'}
              {nextAction.type === 'REVIEW_PROPOSALS' && 'Proposals Ready for Review'}
              {nextAction.type === 'FIX_STORE_ACCESS' && 'Store Access Issue'}
            </p>
            <p className="text-xs text-slate-400 mt-1">{nextAction.message}</p>
          </div>
          {nextAction.type === 'GENERATE_PROPOSALS' && (
            <button
              ref={generateCTARef}
              onClick={handleProposeBaseline}
              disabled={proposingBaseline || cooldown.active}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ring-2 ring-blue-400/50 ring-offset-2 ring-offset-slate-900"
            >
              {proposingBaseline
                ? 'Generating...'
                : cooldown.active
                ? `Recently generated (${cooldown.remainingSeconds}s)`
                : 'Generate Proposals'}
            </button>
          )}
          {nextAction.type === 'REVIEW_PROPOSALS' && nextAction.endpoint && (
            <Link
              href={nextAction.endpoint}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium ring-2 ring-amber-400/50 ring-offset-2 ring-offset-slate-900"
            >
              Review Proposals
            </Link>
          )}
        </div>
      )}

      {/* Domain Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {data.domains.map((domain) => (
          <button
            key={domain.domain}
            onClick={() => setSelectedDomain(domain.domain)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedDomain === domain.domain
                ? 'bg-slate-800 text-white'
                : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800/50'
            }`}
          >
            {domain.label}
            {domain.confirmed.length > 0 && (
              <span className="ml-2 text-xs text-green-400">
                {domain.confirmed.length}
              </span>
            )}
            {domain.proposedCount > 0 && (
              <span className="ml-1 text-xs text-amber-400">
                +{domain.proposedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Domain Content */}
      {currentDomain && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg">
          {/* Domain Header */}
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-medium text-white">
              {currentDomain.label}
            </h2>
            <p className="text-sm text-slate-400">
              {currentDomain.completeness}% complete
            </p>
          </div>

          {/* Fields List */}
          <div className="divide-y divide-slate-800">
            {currentDomain.confirmed.length === 0 &&
            currentDomain.proposedCount === 0 ? (
              <div className="px-6 py-8 text-center text-slate-500">
                No facts in this domain yet
              </div>
            ) : (
              currentDomain.confirmed.map((field) => (
                <FieldRow key={field.key} field={field} />
              ))
            )}

            {/* Proposed indicator */}
            {currentDomain.proposedCount > 0 && (
              <div className="px-6 py-4 bg-amber-500/5">
                <Link
                  href={`/context-v4/${companyId}/review?domain=${currentDomain.domain}`}
                  className="text-amber-400 hover:text-amber-300 text-sm"
                >
                  {currentDomain.proposedCount} proposed facts awaiting review →
                </Link>
              </div>
            )}

            {/* Missing fields with explainability */}
            {currentDomain.missingFields && currentDomain.missingFields.length > 0 && (
              <div className="px-6 py-4 border-t border-slate-800/50">
                <p className="text-sm font-medium text-slate-400 mb-3">
                  Missing fields ({currentDomain.missingFields.length})
                </p>
                <div className="space-y-3">
                  {currentDomain.missingFields.slice(0, 8).map((field) => (
                    <MissingFieldRow
                      key={field.key}
                      field={field}
                      isProposing={proposingField === field.key}
                      onPropose={handleProposeField}
                    />
                  ))}
                  {currentDomain.missingFields.length > 8 && (
                    <p className="text-xs text-slate-600">
                      +{currentDomain.missingFields.length - 8} more fields
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ field }: { field: ContextFieldV4 }) {
  const fieldName = field.key.split('.').slice(1).join('.');

  return (
    <div className="px-6 py-4 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-300">{fieldName}</p>
        <p className="text-sm text-white mt-1 truncate">
          {formatValue(field.value)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-green-400 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          confirmed
        </span>
        {field.lockedAt && (
          <span className="text-xs text-slate-500">
            {new Date(field.lockedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Missing field row with explanation and targeted propose action
 */
function MissingFieldRow({
  field,
  isProposing,
  onPropose,
}: {
  field: MissingFieldInfoV4;
  isProposing: boolean;
  onPropose: (fieldKey: string, sources: string[]) => void;
}) {
  const sourceIds = field.availableSources
    .filter((s) => s.hasSignal || field.canPropose)
    .map((s) => s.sourceId);

  // Build propose button label from sources
  const proposeLabel = field.availableSources.length > 0
    ? `Propose from ${field.availableSources.map((s) => s.label).join(' + ')}`
    : 'Propose';

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-400">{field.label}</p>
        {/* Explanation helper text */}
        <p className="text-xs text-slate-600 mt-0.5">{field.explanation}</p>
      </div>
      {/* Targeted propose button */}
      {field.canPropose && (
        <button
          onClick={() => onPropose(field.key, sourceIds)}
          disabled={isProposing}
          className="shrink-0 px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {isProposing ? (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Proposing...
            </span>
          ) : (
            proposeLabel
          )}
        </button>
      )}
      {/* Show rejection indicator if rejected */}
      {field.reason === 'PROPOSAL_REJECTED' && (
        <span className="shrink-0 text-xs text-red-400/70">Rejected</span>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : '—';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Required Baseline Progress Component
 * Compact progress bar showing strategy readiness status
 */
function RequiredBaselineProgress({
  companyId,
  readiness,
  totalProposed,
}: {
  companyId: string;
  readiness: StrategyReadinessInfo;
  totalProposed: number;
}) {
  const { total, confirmed, proposed, missing, ready } = readiness;
  const satisfiedCount = confirmed + proposed;
  const progressPercent = total > 0 ? Math.round((confirmed / total) * 100) : 0;

  // Color based on readiness
  const progressColor = ready
    ? 'bg-green-500'
    : confirmed > 0
    ? 'bg-amber-500'
    : 'bg-red-500';

  const borderColor = ready
    ? 'border-green-500/30'
    : confirmed > 0
    ? 'border-amber-500/30'
    : 'border-red-500/30';

  const bgColor = ready
    ? 'bg-green-500/5'
    : confirmed > 0
    ? 'bg-amber-500/5'
    : 'bg-red-500/5';

  return (
    <div className={`mb-6 rounded-lg border ${borderColor} ${bgColor} p-4`}>
      <div className="flex items-center justify-between gap-4">
        {/* Left side: Progress info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-medium text-white">
              Required Baseline Progress
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                ready
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {ready ? 'Ready' : `${confirmed}/${total}`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full ${progressColor} transition-all duration-300`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs">
            <span className="text-green-400">
              <span className="font-medium">{confirmed}</span>
              <span className="text-slate-500 ml-1">confirmed</span>
            </span>
            <span className="text-amber-400">
              <span className="font-medium">{proposed}</span>
              <span className="text-slate-500 ml-1">proposed</span>
            </span>
            <span className="text-slate-500">
              <span className="font-medium">{missing}</span>
              <span className="ml-1">missing</span>
            </span>
          </div>
        </div>

        {/* Right side: CTA */}
        {totalProposed > 0 && (
          <Link
            href={`/context-v4/${companyId}/review`}
            className="shrink-0 flex items-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm font-medium rounded-lg border border-amber-500/20 transition-colors"
          >
            Review {totalProposed} proposed
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}
