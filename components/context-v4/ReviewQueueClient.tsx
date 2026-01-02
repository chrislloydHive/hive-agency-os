'use client';

// components/context-v4/ReviewQueueClient.tsx
// Review Queue Client Component
//
// Shows proposed facts with confirm/reject actions.
// Now includes:
// - Lab Coverage Summary panel (shows which labs ran and findings)
// - Lab Findings Viewer (drawer to view and promote findings)
// - Improved triage UX (Accept/Needs Rewrite/Ignore)
// - Dedupe grouping (shows "Used by X fields" for duplicate findings)

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Beaker, Sparkles, FileText, Database, User, AlertTriangle, Bug, CheckCircle, ChevronDown, ChevronRight, LayoutList, LayoutGrid, Eye, EyeOff, XCircle, Pencil, Moon, ArrowUpRight, Copy, ShieldAlert } from 'lucide-react';
import type {
  ReviewQueueResponseV4,
  ContextFieldV4,
  ContextFieldSourceV4,
  DOMAIN_LABELS_V4,
} from '@/lib/types/contextField';
import type {
  ProposalReason,
  ProposeWebsiteLabResponse,
  InspectV4Response,
} from '@/lib/types/contextV4Debug';
import type { LabQualityResponse, QualityBand } from '@/lib/types/labQualityScore';
import { PROPOSAL_REASON_LABELS } from '@/lib/types/contextV4Debug';
import { useContextV4Health } from '@/hooks/useContextV4Health';
import { FlowReadinessBanner } from './FlowReadinessBanner';
import { LabCoverageSummary } from './LabCoverageSummary';
import { LabFindingsDrawer } from './LabFindingsDrawer';
import type { LabKey } from '@/lib/types/labSummary';

interface ReviewQueueClientProps {
  companyId: string;
  companyName: string;
  initialDomain?: string;
  initialSource?: string;
}

// Simplified type for inspect data we use
interface InspectData {
  inspectVersion?: number;
  latestWebsiteLab?: {
    runId: string | null;
    createdAt: string | null;
    status: string | null;
    hasRawJson: boolean;
    extractionPathOk: boolean;
    candidatesCount: number | null;
    errorState?: {
      isError: boolean;
      errorType?: 'HTTP_ERROR' | 'DIAGNOSTIC_FAILED' | 'FORBIDDEN' | 'RATE_LIMITED' | 'UNKNOWN_ERROR';
      errorMessage?: string;
      httpStatus?: number;
    };
  };
  latestBrandLab?: {
    runId: string | null;
    candidatesCount: number | null;
  };
  v4StoreCounts?: {
    proposed: number;
    confirmed: number;
    loadErrorCode?: 'UNAUTHORIZED' | 'NOT_FOUND' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'UNKNOWN' | null;
    loadErrorMessage?: string | null;
  };
  flags?: {
    CONTEXT_V4_ENABLED: boolean;
    CONTEXT_V4_INGEST_WEBSITELAB: boolean;
    CONTEXT_V4_INGEST_BRANDLAB?: boolean;
  };
  proposeSummary?: {
    wouldPropose: number;
    reason: ProposalReason;
  };
  proposeSummaryWebsiteLab?: {
    wouldPropose: number;
    reason: ProposalReason;
  };
  proposeSummaryBrandLab?: {
    wouldPropose: number;
    reason: ProposalReason;
  };
}

// Response from combined propose endpoint
interface ProposeAllResponse {
  ok: boolean;
  writtenCount: number;
  blockedCount: number;
  dedupedCount: number;
  conflictedCount: number;
  totalCandidates: number;
  sources: {
    websiteLab: { proposedCount: number; blockedCount: number; dedupedCount: number; conflictedCount: number };
    brandLab: { proposedCount: number; blockedCount: number; dedupedCount: number; conflictedCount: number };
    gapPlan: { proposedCount: number; blockedCount: number; dedupedCount: number; conflictedCount: number };
  };
  error?: string;
}

export function ReviewQueueClient({
  companyId,
  companyName,
  initialDomain,
  initialSource,
}: ReviewQueueClientProps) {
  const router = useRouter();
  const [data, setData] = useState<ReviewQueueResponseV4 | null>(null);
  const [inspectData, setInspectData] = useState<InspectData | null>(null);
  const [lastProposalResult, setLastProposalResult] = useState<ProposeAllResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [domain, setDomain] = useState(initialDomain || '');
  const [source, setSource] = useState(initialSource || '');
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('grouped');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showLowConfidence, setShowLowConfidence] = useState(false);
  const [labDrawerKey, setLabDrawerKey] = useState<LabKey | null>(null);
  const [labFilter, setLabFilter] = useState<string | null>(null);
  const [qualityData, setQualityData] = useState<LabQualityResponse | null>(null);

  // Confidence floor: hide proposals with confidence < 30% by default
  const CONFIDENCE_FLOOR = 0.3;

  // Use unified V4 health hook
  const {
    health: healthData,
    refresh: refreshHealth,
  } = useContextV4Health(companyId);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (domain) params.set('domain', domain);
      if (source) params.set('source', source);

      // Fetch review queue, inspect data, and quality data in parallel
      // Health data is fetched separately via useContextV4Health hook
      const [reviewResponse, inspectResponse, qualityResponse] = await Promise.all([
        fetch(`/api/os/companies/${companyId}/context/v4/review?${params}`, {
          cache: 'no-store',
        }),
        fetch(`/api/os/companies/${companyId}/context/v4/inspect`, {
          cache: 'no-store',
        }),
        fetch(`/api/os/companies/${companyId}/labs/quality`, {
          cache: 'no-store',
        }),
      ]);

      const reviewJson = await reviewResponse.json();
      const inspectJson = await inspectResponse.json();
      const qualityJson = await qualityResponse.json();

      if (!reviewJson.ok) {
        throw new Error(reviewJson.error || 'Failed to load review queue');
      }

      setData(reviewJson);
      if (inspectJson.ok) {
        setInspectData(inspectJson);
      }
      if (qualityJson.ok) {
        setQualityData(qualityJson);
      }
      setSelectedKeys(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [companyId, domain, source]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter proposals by confidence floor
  const { filteredProposals, lowConfidenceCount, hiddenProposals } = useMemo(() => {
    if (!data?.proposed) {
      return { filteredProposals: [], lowConfidenceCount: 0, hiddenProposals: [] };
    }

    const hidden: ContextFieldV4[] = [];
    const visible: ContextFieldV4[] = [];

    for (const field of data.proposed) {
      if (field.confidence < CONFIDENCE_FLOOR) {
        hidden.push(field);
      } else {
        visible.push(field);
      }
    }

    // If showLowConfidence is on, show all; otherwise show only visible
    return {
      filteredProposals: showLowConfidence ? data.proposed : visible,
      lowConfidenceCount: hidden.length,
      hiddenProposals: hidden,
    };
  }, [data?.proposed, showLowConfidence, CONFIDENCE_FLOOR]);

  // Filter proposals by lab if labFilter is set
  const labFilteredProposals = useMemo(() => {
    if (!labFilter) return filteredProposals;
    return filteredProposals.filter(
      f => f.importerId === labFilter || f.evidence?.importerId === labFilter
    );
  }, [filteredProposals, labFilter]);

  // Use lab-filtered proposals for display when filter is active
  const displayProposals = labFilter ? labFilteredProposals : filteredProposals;

  // Group proposals by domain for grouped view
  // Uses displayProposals which respects lab filter
  const groupedProposals = useMemo(() => {
    if (displayProposals.length === 0) return new Map<string, ContextFieldV4[]>();

    const groups = new Map<string, ContextFieldV4[]>();
    for (const field of displayProposals) {
      const groupKey = field.domain;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(field);
    }

    // Sort groups by count (descending)
    return new Map(
      [...groups.entries()].sort((a, b) => b[1].length - a[1].length)
    );
  }, [displayProposals]);

  // Initialize expanded groups when data loads
  useEffect(() => {
    if (data?.proposed && expandedGroups.size === 0) {
      // Expand all groups by default
      const allDomains = new Set<string>(data.proposed.map(f => f.domain));
      setExpandedGroups(allDomains);
    }
  }, [data?.proposed, expandedGroups.size]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (filteredProposals.length === 0) return;
    const allKeys = filteredProposals.map((f) => f.key);
    setSelectedKeys(new Set(allKeys));
  };

  const deselectAll = () => {
    setSelectedKeys(new Set());
  };

  // Select all in a specific group
  const selectGroup = (groupKey: string) => {
    const groupFields = groupedProposals.get(groupKey) || [];
    setSelectedKeys(prev => {
      const next = new Set(prev);
      for (const field of groupFields) {
        next.add(field.key);
      }
      return next;
    });
  };

  // Deselect all in a specific group
  const deselectGroup = (groupKey: string) => {
    const groupFields = groupedProposals.get(groupKey) || [];
    const groupKeys = new Set(groupFields.map(f => f.key));
    setSelectedKeys(prev => {
      const next = new Set(prev);
      for (const key of groupKeys) {
        next.delete(key);
      }
      return next;
    });
  };

  // Check if all items in a group are selected
  const isGroupFullySelected = (groupKey: string): boolean => {
    const groupFields = groupedProposals.get(groupKey) || [];
    if (groupFields.length === 0) return false;
    return groupFields.every(f => selectedKeys.has(f.key));
  };

  // Check if some (but not all) items in a group are selected
  const isGroupPartiallySelected = (groupKey: string): boolean => {
    const groupFields = groupedProposals.get(groupKey) || [];
    if (groupFields.length === 0) return false;
    const selectedCount = groupFields.filter(f => selectedKeys.has(f.key)).length;
    return selectedCount > 0 && selectedCount < groupFields.length;
  };

  // Get selected count for a group
  const getGroupSelectedCount = (groupKey: string): number => {
    const groupFields = groupedProposals.get(groupKey) || [];
    return groupFields.filter(f => selectedKeys.has(f.key)).length;
  };

  const handleConfirm = async (keys: string[]) => {
    setProcessing(true);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/context/v4/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys }),
        }
      );
      const json = await response.json();

      if (!json.ok) {
        throw new Error(json.error || 'Failed to confirm');
      }

      // Refresh data and router to update any cached page content
      await fetchData();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (keys: string[], reason?: string) => {
    setProcessing(true);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/context/v4/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys, reason }),
        }
      );
      const json = await response.json();

      if (!json.ok) {
        throw new Error(json.error || 'Failed to reject');
      }

      // Refresh data and router to update any cached page content
      await fetchData();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setProcessing(false);
    }
  };

  const handleTriggerProposal = async () => {
    setProposing(true);
    setLastProposalResult(null);
    try {
      // Call combined propose endpoint (WebsiteLab + BrandLab + GAP Plan)
      const response = await fetch(
        `/api/os/companies/${companyId}/context/v4/propose`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const json: ProposeAllResponse = await response.json();

      // Save the result regardless of ok status
      setLastProposalResult(json);

      // Refresh data and health to show new proposals (if any)
      await Promise.all([fetchData(), refreshHealth()]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setProposing(false);
    }
  };

  // Calculate total wouldPropose from all sources
  const totalWouldPropose =
    (inspectData?.proposeSummaryWebsiteLab?.wouldPropose || 0) +
    (inspectData?.proposeSummaryBrandLab?.wouldPropose || 0);

  // Show CTA when: store has 0 proposals but wouldPropose > 0 (labs have extractable data)
  const showGenerateProposalsCTA =
    data?.proposed.length === 0 &&
    totalWouldPropose > 0 &&
    !lastProposalResult;

  // Check if we should show "why nothing changed" banner
  // Show when no proposals exist but there's a WebsiteLab run that ran
  const showDebugBanner =
    data?.proposed.length === 0 &&
    inspectData?.latestWebsiteLab?.runId &&
    inspectData?.latestWebsiteLab?.status === 'complete' &&
    !showGenerateProposalsCTA; // Don't show debug if CTA is showing

  // Get the current reason (from last proposal or inspect summary - for backwards compat)
  const currentReason: ProposalReason | null =
    inspectData?.proposeSummary?.reason ||
    null;

  // Check if store is unauthorized (disables mutations)
  const isStoreUnauthorized = inspectData?.v4StoreCounts?.loadErrorCode === 'UNAUTHORIZED';

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

  // Handler for lab filter from LabCoverageSummary
  const handleFilterByLab = (labKey: LabKey) => {
    // Map labKey to importerId
    const importerMap: Record<LabKey, string> = {
      websiteLab: 'websiteLab',
      competitionLab: 'competitionLab',
      brandLab: 'brandLab',
      gapPlan: 'gapPlan',
      audienceLab: 'audienceLab',
    };
    setLabFilter(importerMap[labKey]);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      {/* Lab Coverage Summary Panel */}
      <LabCoverageSummary
        companyId={companyId}
        onViewFindings={(labKey) => setLabDrawerKey(labKey)}
        onFilterByLab={handleFilterByLab}
        onRefresh={fetchData}
      />

      {/* Quality Guardrail Banner - shows if any lab has Poor quality */}
      {qualityData && (() => {
        const poorQualityLabs = Object.entries(qualityData.current)
          .filter(([_, score]) => score?.qualityBand === 'Poor')
          .map(([labKey]) => labKey);

        if (poorQualityLabs.length === 0) return null;

        return (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-medium">
                  Low Lab Quality Detected
                </p>
                <p className="text-red-400/80 text-sm mt-1">
                  {poorQualityLabs.length === 1
                    ? `${poorQualityLabs[0]} output quality is low.`
                    : `${poorQualityLabs.join(', ')} outputs have low quality.`}
                  {' '}Findings may be generic or under-evidenced. Review carefully before confirming.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lab Filter Badge */}
      {labFilter && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-slate-400">Filtered by:</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">
            {labFilter}
            <button
              onClick={() => setLabFilter(null)}
              className="ml-1 hover:text-white"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </span>
        </div>
      )}

      {/* Header Stats Row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Health Status Pill (using FlowReadinessBanner compact variant) */}
          {healthData && (
            <FlowReadinessBanner
              health={healthData}
              variant="compact"
              onRetriggerProposal={handleTriggerProposal}
              retriggerLoading={proposing}
            />
          )}
        </div>

        <div className="text-right">
          <p className="text-2xl font-semibold text-amber-400">
            {data.totalCount}
          </p>
          <p className="text-slate-400 text-sm">facts to review</p>
        </div>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex gap-4">
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">All Domains</option>
            {Object.entries(data.byDomain).map(([d, count]) => (
              <option key={d} value={d}>
                {d} ({count})
              </option>
            ))}
          </select>

          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">All Sources</option>
            {Object.entries(data.bySource).map(([s, count]) => (
              <option key={s} value={s}>
                {s} ({count})
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grouped')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm ${
              viewMode === 'grouped'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Group by domain"
          >
            <LayoutGrid className="w-4 h-4" />
            Grouped
          </button>
          <button
            onClick={() => setViewMode('flat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm ${
              viewMode === 'flat'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Flat list"
          >
            <LayoutList className="w-4 h-4" />
            Flat
          </button>
        </div>
      </div>

      {/* Authorization Error Banner */}
      {inspectData?.v4StoreCounts?.loadErrorCode === 'UNAUTHORIZED' && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-200 font-medium">
                Airtable Authorization Error
              </p>
              <p className="text-red-300/70 text-sm mt-1">
                Your Airtable Personal Access Token lacks permission to access the V4 store.
                Check that your token has "data.records:read" and "data.records:write" scopes
                for the ContextFieldsV4 table.
              </p>
              {inspectData?.v4StoreCounts?.loadErrorMessage && (
                <p className="text-red-400/60 text-xs mt-2 font-mono">
                  {inspectData.v4StoreCounts.loadErrorMessage}
                </p>
              )}
              <a
                href={`/api/os/companies/${companyId}/context/v4/inspect`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 mt-3 text-red-400 hover:text-red-300 text-sm bg-red-500/10 rounded"
              >
                <Bug className="w-4 h-4" />
                Open V4 Inspector →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Store Not Found Banner */}
      {inspectData?.v4StoreCounts?.loadErrorCode === 'NOT_FOUND' && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-amber-200 font-medium">
                V4 Store Table Not Found
              </p>
              <p className="text-amber-300/70 text-sm mt-1">
                The ContextFieldsV4 table does not exist in Airtable.
                Create the table to enable Context V4 features.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* WebsiteLab Error State Banner - Non-confirmable warning */}
      {inspectData?.latestWebsiteLab?.errorState?.isError && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-200 font-medium">
                WebsiteLab Diagnostic Failed
              </p>
              <p className="text-red-300/70 text-sm mt-1">
                The latest WebsiteLab run encountered an error. No proposals were generated from this run.
                {inspectData.latestWebsiteLab.errorState.httpStatus && (
                  <span className="ml-1">
                    (HTTP {inspectData.latestWebsiteLab.errorState.httpStatus})
                  </span>
                )}
              </p>
              {inspectData.latestWebsiteLab.errorState.errorMessage && (
                <p className="text-red-400/60 text-xs mt-2 font-mono bg-red-500/10 p-2 rounded max-h-24 overflow-auto">
                  {inspectData.latestWebsiteLab.errorState.errorMessage.slice(0, 300)}
                  {inspectData.latestWebsiteLab.errorState.errorMessage.length > 300 && '...'}
                </p>
              )}
              <p className="text-red-300/50 text-xs mt-2">
                Re-run the WebsiteLab diagnostic to generate valid proposals.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Generate Proposals CTA - shown when labs have data but store is empty */}
      {showGenerateProposalsCTA && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-green-200 font-medium">
                Lab data ready for review
              </p>
              <p className="text-green-300/70 text-sm mt-1">
                {totalWouldPropose} facts extracted from diagnostics are waiting to be proposed.
                {inspectData?.proposeSummaryWebsiteLab?.wouldPropose ? (
                  <span> · WebsiteLab: {inspectData.proposeSummaryWebsiteLab.wouldPropose}</span>
                ) : null}
                {inspectData?.proposeSummaryBrandLab?.wouldPropose ? (
                  <span> · BrandLab: {inspectData.proposeSummaryBrandLab.wouldPropose}</span>
                ) : null}
              </p>
              <button
                onClick={handleTriggerProposal}
                disabled={proposing || isStoreUnauthorized}
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                <Beaker className="w-4 h-4" />
                {proposing ? 'Generating...' : 'Generate Proposals from Labs'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Result Banner */}
      {lastProposalResult && (
        <div className={`mb-6 p-4 border rounded-lg ${
          lastProposalResult.writtenCount > 0
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <div className="flex items-start gap-3">
            {lastProposalResult.writtenCount > 0 ? (
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`font-medium ${lastProposalResult.writtenCount > 0 ? 'text-green-200' : 'text-amber-200'}`}>
                {lastProposalResult.writtenCount > 0
                  ? `${lastProposalResult.writtenCount} proposals created`
                  : 'No new proposals generated'}
              </p>
              <div className="text-sm mt-1 space-y-0.5">
                {lastProposalResult.sources.websiteLab.proposedCount > 0 && (
                  <p className="text-slate-400">
                    WebsiteLab: +{lastProposalResult.sources.websiteLab.proposedCount}
                  </p>
                )}
                {lastProposalResult.sources.brandLab.proposedCount > 0 && (
                  <p className="text-slate-400">
                    BrandLab: +{lastProposalResult.sources.brandLab.proposedCount}
                  </p>
                )}
                {lastProposalResult.sources.gapPlan.proposedCount > 0 && (
                  <p className="text-slate-400">
                    GAP Plan: +{lastProposalResult.sources.gapPlan.proposedCount}
                  </p>
                )}
                {lastProposalResult.dedupedCount > 0 && (
                  <p className="text-slate-500 text-xs">
                    {lastProposalResult.dedupedCount} skipped (already proposed)
                  </p>
                )}
                {lastProposalResult.conflictedCount > 0 && (
                  <p className="text-amber-500 text-xs">
                    {lastProposalResult.conflictedCount} blocked by confirmed facts
                  </p>
                )}
              </div>
              {lastProposalResult.error && (
                <p className="text-red-400 text-xs mt-2">{lastProposalResult.error}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Batch Actions */}
      {data.proposed.length > 0 && (
        <div className="flex items-center justify-between mb-4 p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedKeys.size === filteredProposals.length && filteredProposals.length > 0}
                onChange={() =>
                  selectedKeys.size === filteredProposals.length
                    ? deselectAll()
                    : selectAll()
                }
                className="rounded bg-slate-800 border-slate-600 text-amber-500"
              />
              <span className="text-sm text-slate-300">
                {selectedKeys.size > 0
                  ? `${selectedKeys.size} selected`
                  : 'Select all'}
              </span>
            </label>

            {/* Low confidence toggle */}
            {lowConfidenceCount > 0 && (
              <button
                onClick={() => setShowLowConfidence(!showLowConfidence)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                  showLowConfidence
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title={showLowConfidence ? 'Hide low-confidence proposals' : 'Show low-confidence proposals'}
              >
                {showLowConfidence ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                {lowConfidenceCount} low confidence
              </button>
            )}
          </div>

          {selectedKeys.size > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative group">
                <button
                  onClick={() => handleConfirm(Array.from(selectedKeys))}
                  disabled={processing || isStoreUnauthorized}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm ({selectedKeys.size})
                </button>
                {isStoreUnauthorized && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-red-400 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    Cannot persist changes (Airtable unauthorized)
                  </div>
                )}
              </div>
              <div className="relative group">
                <button
                  onClick={() => handleReject(Array.from(selectedKeys))}
                  disabled={processing || isStoreUnauthorized}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reject ({selectedKeys.size})
                </button>
                {isStoreUnauthorized && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-red-400 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    Cannot persist changes (Airtable unauthorized)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Debug Banner: Labs ran but no proposals and no extractable data */}
      {showDebugBanner && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-amber-200 font-medium">
                Labs ran but produced 0 reviewable facts
              </p>

              {/* Show reason label */}
              {currentReason && currentReason !== 'SUCCESS' && (
                <p className="text-amber-300 text-sm mt-1 font-medium">
                  Reason: {PROPOSAL_REASON_LABELS[currentReason]}
                </p>
              )}

              <p className="text-amber-300/70 text-sm mt-1">
                WebsiteLab: {inspectData?.latestWebsiteLab?.runId?.slice(0, 8)}...
                {inspectData?.latestWebsiteLab?.candidatesCount !== null && (
                  <> · {inspectData?.latestWebsiteLab?.candidatesCount} candidates</>
                )}
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  onClick={handleTriggerProposal}
                  disabled={proposing}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-sm font-medium disabled:opacity-50"
                >
                  <Bug className="w-4 h-4" />
                  {proposing ? 'Proposing...' : 'Re-trigger Proposal'}
                </button>
                <a
                  href={`/api/os/companies/${companyId}/context/v4/inspect`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-amber-400 hover:text-amber-300 text-sm"
                >
                  Open V4 Inspector →
                </a>
              </div>

              {inspectData?.flags && !inspectData.flags.CONTEXT_V4_INGEST_WEBSITELAB && (
                <p className="text-red-400 text-xs mt-2">
                  ⚠️ CONTEXT_V4_INGEST_WEBSITELAB is disabled
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Queue */}
      {filteredProposals.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          {data.proposed.length === 0 ? (
            <>
              <p className="text-lg">All caught up!</p>
              <p className="text-sm mt-2">No facts awaiting review.</p>
            </>
          ) : (
            <>
              <p className="text-lg">All proposals hidden</p>
              <p className="text-sm mt-2">
                {lowConfidenceCount} low-confidence proposals are hidden.
              </p>
              <button
                onClick={() => setShowLowConfidence(true)}
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
              >
                <Eye className="w-4 h-4" />
                Show Low-Confidence Proposals
              </button>
            </>
          )}
        </div>
      ) : viewMode === 'grouped' ? (
        /* Grouped View */
        <div className="space-y-4">
          {Array.from(groupedProposals.entries()).map(([groupKey, fields]) => {
            const isExpanded = expandedGroups.has(groupKey);
            const isFullySelected = isGroupFullySelected(groupKey);
            const isPartiallySelected = isGroupPartiallySelected(groupKey);
            const selectedCount = getGroupSelectedCount(groupKey);

            return (
              <div
                key={groupKey}
                className="bg-slate-900/30 border border-slate-800 rounded-lg overflow-hidden"
              >
                {/* Group Header */}
                <div className="flex items-center justify-between p-3 bg-slate-900/50 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleGroup(groupKey)}
                      className="flex items-center gap-2 text-white hover:text-amber-400"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span className="font-medium capitalize">{groupKey}</span>
                    </button>
                    <span className="text-slate-500 text-sm">
                      {fields.length} {fields.length === 1 ? 'fact' : 'facts'}
                    </span>
                    {selectedCount > 0 && (
                      <span className="text-amber-400 text-xs bg-amber-500/10 px-2 py-0.5 rounded">
                        {selectedCount} selected
                      </span>
                    )}
                  </div>

                  {/* Group Actions */}
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer mr-2">
                      <input
                        type="checkbox"
                        checked={isFullySelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isPartiallySelected;
                        }}
                        onChange={() =>
                          isFullySelected
                            ? deselectGroup(groupKey)
                            : selectGroup(groupKey)
                        }
                        className="rounded bg-slate-800 border-slate-600 text-amber-500"
                      />
                      <span className="text-xs text-slate-400">Select all</span>
                    </label>
                    <button
                      onClick={() => {
                        const keys = fields.map(f => f.key);
                        handleConfirm(keys);
                      }}
                      disabled={processing || isStoreUnauthorized}
                      className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-medium disabled:opacity-50"
                      title={`Confirm all ${fields.length} facts in ${groupKey}`}
                    >
                      Confirm All
                    </button>
                    <button
                      onClick={() => {
                        const keys = fields.map(f => f.key);
                        handleReject(keys);
                      }}
                      disabled={processing || isStoreUnauthorized}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs font-medium disabled:opacity-50"
                      title={`Reject all ${fields.length} facts in ${groupKey}`}
                    >
                      Reject All
                    </button>
                  </div>
                </div>

                {/* Group Items */}
                {isExpanded && (
                  <div className="divide-y divide-slate-800/50">
                    {fields.map((field) => (
                      <ReviewItem
                        key={field.key}
                        field={field}
                        selected={selectedKeys.has(field.key)}
                        onToggle={() => toggleSelect(field.key)}
                        onConfirm={() => handleConfirm([field.key])}
                        onReject={() => handleReject([field.key])}
                        processing={processing}
                        disabled={isStoreUnauthorized}
                        compact
                        isLowConfidence={field.confidence < CONFIDENCE_FLOOR}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Flat View */
        <div className="space-y-3">
          {displayProposals.map((field) => (
            <ReviewItem
              key={field.key}
              field={field}
              selected={selectedKeys.has(field.key)}
              onToggle={() => toggleSelect(field.key)}
              onConfirm={() => handleConfirm([field.key])}
              onReject={() => handleReject([field.key])}
              processing={processing}
              disabled={isStoreUnauthorized}
              isLowConfidence={field.confidence < CONFIDENCE_FLOOR}
            />
          ))}
        </div>
      )}

      {/* Lab Findings Drawer */}
      {labDrawerKey && (
        <LabFindingsDrawer
          companyId={companyId}
          labKey={labDrawerKey}
          onClose={() => setLabDrawerKey(null)}
          onPromoted={() => {
            // Refresh data when a finding is promoted
            fetchData();
          }}
        />
      )}
    </div>
  );
}

interface ReviewItemProps {
  field: ContextFieldV4;
  selected: boolean;
  onToggle: () => void;
  onConfirm: () => void;
  onReject: () => void;
  processing: boolean;
  disabled?: boolean;
  /** Compact mode for grouped view (less padding, no rounded corners) */
  compact?: boolean;
  /** Show visual indicator for low-confidence proposals (< 30%) */
  isLowConfidence?: boolean;
  /** Confirmed value for this field (if exists) for decision surface */
  confirmedField?: ContextFieldV4;
  /** Handler for "Replace Confirmed" action */
  onReplaceConfirmed?: () => void;
}

function ReviewItem({
  field,
  selected,
  onToggle,
  onConfirm,
  onReject,
  processing,
  disabled,
  compact = false,
  isLowConfidence = false,
  confirmedField,
  onReplaceConfirmed,
}: ReviewItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const hasAlternatives = field.alternatives && field.alternatives.length > 0;
  const conflictsWithConfirmed = field.conflictsWithConfirmed || !!confirmedField;

  // Format date nicely
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch {
      return null;
    }
  };

  return (
    <div
      className={`${compact ? 'bg-transparent' : 'bg-slate-900/50 border rounded-lg overflow-hidden'} ${
        selected ? (compact ? 'bg-amber-500/5' : 'border-amber-500/50') : (compact ? '' : 'border-slate-800')
      } ${isLowConfidence ? 'opacity-60' : ''} ${conflictsWithConfirmed ? 'border-l-2 border-l-orange-500' : ''}`}
    >
      {/* Conflict Banner */}
      {conflictsWithConfirmed && (
        <div className="px-4 py-2 bg-orange-500/10 border-b border-orange-500/20 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-xs text-orange-400 font-medium">Conflicts with confirmed value</span>
          {field.confirmedValuePreview && (
            <span className="text-xs text-orange-300/70 truncate max-w-[200px]">
              "{field.confirmedValuePreview.slice(0, 50)}..."
            </span>
          )}
        </div>
      )}

      {/* Main Row */}
      <div className={`${compact ? 'p-3' : 'p-4'} flex items-start gap-4`}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 rounded bg-slate-800 border-slate-600 text-amber-500"
        />

        <div className="flex-1 min-w-0">
          {/* Field Key with Trust Badge */}
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-300">
              {compact ? field.key.split('.').slice(1).join('.') : field.key}
            </p>
            {/* Trust Badge */}
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400">
              <Sparkles className="w-2.5 h-2.5" />
              Proposed
            </span>
            {hasAlternatives && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400">
                +{field.alternatives!.length} alt
              </span>
            )}
          </div>

          <p className={`text-white ${compact ? 'text-sm' : ''} mt-1`}>{formatValue(field.value, field.key)}</p>

          {/* Lineage Row */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-xs">
            <SourceBadge source={field.source} importerId={field.importerId || field.evidence?.importerId} />
            <span className={`${isLowConfidence ? 'text-amber-500' : 'text-slate-500'}`}>
              Confidence:{' '}
              <span className={isLowConfidence ? 'text-amber-400' : 'text-slate-400'}>
                {Math.round(field.confidence * 100)}%
              </span>
              {isLowConfidence && (
                <span className="ml-1 text-amber-500/70">(low)</span>
              )}
            </span>
            {/* Lineage: Run date */}
            {(field.runCreatedAt || field.evidence?.runId) && (
              <span className="text-slate-500">
                {formatDate(field.runCreatedAt) || field.evidence?.runId?.slice(0, 8)}
              </span>
            )}
            {hasEvidence(field.evidence) && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-amber-400 hover:text-amber-300"
              >
                <FileText className="w-3 h-3" />
                {expanded ? 'Hide' : 'Evidence'}
              </button>
            )}
            {hasAlternatives && (
              <button
                onClick={() => setShowAlternatives(!showAlternatives)}
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
              >
                {showAlternatives ? 'Hide alternatives' : `${field.alternatives!.length} alternatives`}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Replace Confirmed button (when conflicts) */}
          {conflictsWithConfirmed && onReplaceConfirmed && (
            <div className="relative group">
              <button
                onClick={onReplaceConfirmed}
                disabled={processing || disabled}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Replace
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-orange-300 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Replace confirmed value with this proposal
              </div>
            </div>
          )}
          <div className="relative group">
            <button
              onClick={onConfirm}
              disabled={processing || disabled}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm
            </button>
            {disabled && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-red-400 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Cannot persist changes (Airtable unauthorized)
              </div>
            )}
          </div>
          <div className="relative group">
            <button
              onClick={onReject}
              disabled={processing || disabled}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reject
            </button>
            {disabled && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-red-400 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Cannot persist changes (Airtable unauthorized)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Evidence Drawer */}
      {expanded && field.evidence && (
        <div className="px-4 pb-4 pt-0 ml-8 border-t border-slate-800 mt-2 pt-3">
          <p className="text-xs text-slate-500 mb-2">Evidence & Lineage</p>
          {field.evidence.snippet && (
            <p className="text-sm text-slate-300 bg-slate-800/50 p-3 rounded mb-2">
              "{field.evidence.snippet}"
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
            {field.evidence.runId && (
              <p>Run ID: <span className="text-slate-400">{field.evidence.runId}</span></p>
            )}
            {field.runCreatedAt && (
              <p>Run Date: <span className="text-slate-400">{formatDate(field.runCreatedAt)}</span></p>
            )}
            {field.importerId && (
              <p>Importer: <span className="text-slate-400">{field.importerId}</span></p>
            )}
            {field.schemaVariant && (
              <p>Schema: <span className="text-slate-400">{field.schemaVariant}</span></p>
            )}
            {field.evidence.rawPath && (
              <p className="col-span-2">Path: <span className="text-slate-400">{field.evidence.rawPath}</span></p>
            )}
          </div>
        </div>
      )}

      {/* Alternatives Drawer */}
      {showAlternatives && hasAlternatives && (
        <div className="px-4 pb-4 pt-0 ml-8 border-t border-slate-800 mt-2 pt-3">
          <p className="text-xs text-slate-500 mb-2">Alternative Proposals</p>
          <div className="space-y-2">
            {field.alternatives!.map((alt, idx) => (
              <div key={alt.dedupeKey || idx} className="p-2 bg-slate-800/50 rounded text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white">{formatValue(alt.value, field.key)}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <SourceBadge source={alt.source} importerId={alt.importerId} />
                    <span className="text-slate-500">{Math.round(alt.confidence * 100)}%</span>
                  </div>
                </div>
                {alt.runCreatedAt && (
                  <p className="text-xs text-slate-500 mt-1">{formatDate(alt.runCreatedAt)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatValue(value: unknown, fieldKey?: string): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (Array.isArray(value)) {
    // Special handling for audience.segments - show summary
    if (fieldKey === 'audience.segments' && value.length > 0) {
      const segments = value as Array<{ label?: string; buyerMode?: string; confidence?: number }>;
      return segments
        .map(s => `${s.label || 'Unnamed'} (${s.buyerMode || 'Unknown'}, ${Math.round(s.confidence || 0)}%)`)
        .join(' | ');
    }
    // For arrays of simple values
    if (value.length > 0 && typeof value[0] === 'string') {
      return value.join(', ');
    }
    // For arrays of objects, show count
    if (value.length > 0 && typeof value[0] === 'object') {
      return `${value.length} items`;
    }
    return value.length > 0 ? value.join(', ') : '—';
  }
  if (typeof value === 'object') {
    // Special handling for decision drivers
    if ('trust' in value && 'proximity' in value) {
      const drivers = value as Record<string, string>;
      return Object.entries(drivers)
        .filter(([, v]) => v !== 'UNCLEAR')
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ') || 'No clear drivers';
    }
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Check if evidence has meaningful content
 */
function hasEvidence(evidence?: ContextFieldV4['evidence']): boolean {
  if (!evidence) return false;
  return !!(evidence.runId || evidence.snippet || evidence.rawPath || evidence.url);
}

/**
 * Source badge with icon and color based on source type
 */
interface SourceBadgeProps {
  source: ContextFieldSourceV4;
  importerId?: string;
}

function SourceBadge({ source, importerId }: SourceBadgeProps) {
  // Get display label (use importerId if available for more specificity)
  const getLabel = (): string => {
    if (importerId) {
      // Convert camelCase to readable: "websiteLab" -> "Website Lab"
      return importerId
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
    }

    switch (source) {
      case 'lab': return 'Lab';
      case 'gap': return 'GAP';
      case 'user': return 'User';
      case 'ai': return 'AI';
      case 'import': return 'Import';
      case 'crm': return 'CRM';
      default: return source;
    }
  };

  // Get icon and colors based on source
  const getStyle = (): { icon: React.ReactNode; bgColor: string; textColor: string } => {
    switch (source) {
      case 'lab':
        return {
          icon: <Beaker className="w-3 h-3" />,
          bgColor: 'bg-purple-500/20',
          textColor: 'text-purple-400',
        };
      case 'gap':
        return {
          icon: <Globe className="w-3 h-3" />,
          bgColor: 'bg-blue-500/20',
          textColor: 'text-blue-400',
        };
      case 'user':
        return {
          icon: <User className="w-3 h-3" />,
          bgColor: 'bg-green-500/20',
          textColor: 'text-green-400',
        };
      case 'ai':
        return {
          icon: <Sparkles className="w-3 h-3" />,
          bgColor: 'bg-amber-500/20',
          textColor: 'text-amber-400',
        };
      case 'crm':
        return {
          icon: <Database className="w-3 h-3" />,
          bgColor: 'bg-cyan-500/20',
          textColor: 'text-cyan-400',
        };
      case 'import':
      default:
        return {
          icon: <FileText className="w-3 h-3" />,
          bgColor: 'bg-slate-500/20',
          textColor: 'text-slate-400',
        };
    }
  };

  const label = getLabel();
  const { icon, bgColor, textColor } = getStyle();

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${bgColor} ${textColor}`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </span>
  );
}

