'use client';

// app/c/[companyId]/brain/context/components/ContextNodeDetailPanel.tsx
// Context Node Detail Panel - Shows strategic context and actions for a selected node
//
// Features:
// - Node metadata (status, confidence, freshness, domain, importance)
// - Strategic explanation of why this field matters
// - Dependency visualization (what depends on this, what this depends on)
// - Change tracking (delta from snapshot)
// - Actions: Edit in Brain, Create Work Item, Explain Impact

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import type {
  ContextGraphV3Snapshot,
  ContextGraphNode,
  ContextNodeStatus,
} from '@/lib/contextGraph/contextGraphV3Types';

// ============================================================================
// Explanation Modal Types
// ============================================================================

interface FieldExplanation {
  explanation: string;
  importance: string;
  relatedFields: string[];
  sourceSuggestions: string[];
}

// ============================================================================
// Dependency Mapping (inlined to avoid server-side imports)
// ============================================================================

const FIELD_DEPENDENCIES: Record<string, Array<{ target: string; weight: number }>> = {
  'audience.icpDescription': [
    { target: 'audience.coreSegments', weight: 0.9 },
    { target: 'audience.primaryAudience', weight: 0.9 },
    { target: 'brand.positioning', weight: 0.8 },
    { target: 'creative.coreMessages', weight: 0.7 },
  ],
  'identity.industry': [
    { target: 'competitive.competitors', weight: 0.8 },
    { target: 'audience.coreSegments', weight: 0.6 },
  ],
  'identity.businessModel': [
    { target: 'objectives.primaryObjective', weight: 0.7 },
    { target: 'budgetOps.totalMarketingBudget', weight: 0.6 },
  ],
  'brand.positioning': [
    { target: 'creative.coreMessages', weight: 0.9 },
    { target: 'brand.valueProps', weight: 0.8 },
    { target: 'brand.differentiators', weight: 0.8 },
  ],
  'brand.valueProps': [
    { target: 'creative.coreMessages', weight: 0.8 },
    { target: 'creative.proofPoints', weight: 0.7 },
  ],
  'audience.coreSegments': [
    { target: 'audience.painPoints', weight: 0.9 },
    { target: 'audience.motivations', weight: 0.9 },
    { target: 'performanceMedia.activeChannels', weight: 0.7 },
  ],
  'audience.painPoints': [
    { target: 'brand.valueProps', weight: 0.8 },
    { target: 'creative.coreMessages', weight: 0.8 },
  ],
  'objectives.primaryObjective': [
    { target: 'objectives.targetCpa', weight: 0.8 },
    { target: 'objectives.targetRoas', weight: 0.8 },
    { target: 'budgetOps.mediaSpendBudget', weight: 0.7 },
  ],
  'competitive.competitors': [
    { target: 'competitive.competitorPositioning', weight: 0.9 },
    { target: 'brand.differentiators', weight: 0.7 },
  ],
  'competitive.primaryCompetitors': [
    { target: 'brand.positioning', weight: 0.7 },
    { target: 'competitive.competitorPositioning', weight: 0.9 },
  ],
  'performanceMedia.activeChannels': [
    { target: 'budgetOps.mediaSpendBudget', weight: 0.8 },
    { target: 'performanceMedia.topPerformingChannel', weight: 0.7 },
  ],
  'creative.coreMessages': [
    { target: 'creative.messagingFramework', weight: 0.8 },
  ],
};

function getFieldDependencies(fieldKey: string): string[] {
  const deps: string[] = [];
  for (const [source, targets] of Object.entries(FIELD_DEPENDENCIES)) {
    for (const { target } of targets) {
      if (target === fieldKey) {
        deps.push(source);
      }
    }
  }
  return deps;
}

function getFieldDependents(fieldKey: string): string[] {
  const dependents = FIELD_DEPENDENCIES[fieldKey];
  if (!dependents) return [];
  return dependents.map(d => d.target);
}

// ============================================================================
// Types
// ============================================================================

interface ContextNodeDetailPanelProps {
  node: ContextGraphNode | null;
  graph: ContextGraphV3Snapshot;
  companyId: string;
  onClose?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG: Record<ContextNodeStatus, {
  label: string;
  color: string;
  bg: string;
  description: string;
}> = {
  ok: {
    label: 'Healthy',
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/20',
    description: 'This field is fresh, confident, and has no conflicts.',
  },
  conflicted: {
    label: 'Conflicted',
    color: 'text-red-300',
    bg: 'bg-red-500/20',
    description: 'Multiple sources provide different values with high confidence. Review needed.',
  },
  low_confidence: {
    label: 'Low Confidence',
    color: 'text-orange-300',
    bg: 'bg-orange-500/20',
    description: 'The value confidence is below threshold. Consider validating or updating.',
  },
  stale: {
    label: 'Stale',
    color: 'text-yellow-300',
    bg: 'bg-yellow-500/20',
    description: 'This field hasn\'t been updated recently. May need refresh.',
  },
  missing: {
    label: 'Missing',
    color: 'text-slate-400',
    bg: 'bg-slate-500/20',
    description: 'No value set for this field. Required for full context.',
  },
};

const IMPORTANCE_LABELS: Record<number, { label: string; description: string }> = {
  5: { label: 'Critical', description: 'Foundational for strategy, GAP, and QBR.' },
  4: { label: 'High', description: 'Key input for multiple features and labs.' },
  3: { label: 'Medium', description: 'Used by several features and analyses.' },
  2: { label: 'Low', description: 'Supporting data for specific features.' },
  1: { label: 'Supplementary', description: 'Reference data, nice to have.' },
};

// ============================================================================
// Component
// ============================================================================

export function ContextNodeDetailPanel({
  node,
  graph,
  companyId,
  onClose,
}: ContextNodeDetailPanelProps) {
  // Action states
  const [creatingWorkItem, setCreatingWorkItem] = useState(false);
  const [workItemSuccess, setWorkItemSuccess] = useState(false);
  const [workItemError, setWorkItemError] = useState<string | null>(null);

  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [explanation, setExplanation] = useState<FieldExplanation | null>(null);
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  // Create work item handler
  const handleCreateWorkItem = useCallback(async () => {
    if (!node) return;

    setCreatingWorkItem(true);
    setWorkItemError(null);
    setWorkItemSuccess(false);

    try {
      const statusLabels: Record<ContextNodeStatus, string> = {
        ok: 'is healthy',
        conflicted: 'has conflicting values',
        low_confidence: 'has low confidence',
        stale: 'is stale',
        missing: 'is missing',
      };

      const title = node.status === 'ok'
        ? `Review ${node.label}`
        : `Fix: ${node.label} ${statusLabels[node.status]}`;

      const description = `**Context Field:** ${node.label}
**Path:** ${node.key}
**Domain:** ${node.domain}
**Status:** ${node.status}
**Confidence:** ${node.confidence}%
**Freshness:** ${node.freshness}%

${node.value ? `**Current Value:**\n${node.value.slice(0, 500)}${node.value.length > 500 ? '...' : ''}` : '**Current Value:** Not set'}

---
*Created from Context Graph Strategic View*`;

      const response = await fetch(`/api/os/companies/${companyId}/work-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          area: 'context',
          priority: node.importance >= 4 ? 'high' : node.importance >= 3 ? 'medium' : 'low',
          status: 'backlog',
          sourceType: 'context_graph',
          sourceId: node.key,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create work item');
      }

      setWorkItemSuccess(true);
      setTimeout(() => setWorkItemSuccess(false), 3000);
    } catch (err) {
      setWorkItemError(err instanceof Error ? err.message : 'Failed to create work item');
    } finally {
      setCreatingWorkItem(false);
    }
  }, [node, companyId]);

  // Explain strategic impact handler
  const handleExplainImpact = useCallback(async () => {
    if (!node) return;

    setLoadingExplanation(true);
    setExplanationError(null);
    setShowExplanationModal(true);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/context-explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldPath: node.key,
          fieldLabel: node.label,
          fieldValue: node.value,
          domainId: node.domain,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get explanation');
      }

      const data: FieldExplanation = await response.json();
      setExplanation(data);
    } catch (err) {
      setExplanationError(err instanceof Error ? err.message : 'Failed to load explanation');
    } finally {
      setLoadingExplanation(false);
    }
  }, [node, companyId]);

  // Close explanation modal
  const closeExplanationModal = useCallback(() => {
    setShowExplanationModal(false);
    setExplanation(null);
    setExplanationError(null);
  }, []);

  // Get dependency information
  const dependsOn = useMemo(() => {
    if (!node) return [];
    return getFieldDependencies(node.key);
  }, [node]);

  const feedsInto = useMemo(() => {
    if (!node) return [];
    return getFieldDependents(node.key);
  }, [node]);

  // Get related nodes from graph
  const dependsOnNodes = useMemo(() => {
    return dependsOn
      .map(key => graph.nodes.find(n => n.id === key))
      .filter(Boolean) as ContextGraphNode[];
  }, [dependsOn, graph.nodes]);

  const feedsIntoNodes = useMemo(() => {
    return feedsInto
      .map(key => graph.nodes.find(n => n.id === key))
      .filter(Boolean) as ContextGraphNode[];
  }, [feedsInto, graph.nodes]);

  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center border-l border-slate-800 bg-slate-950/80 p-6 text-center">
        <div className="mb-3 rounded-full bg-slate-800 p-4">
          <svg className="h-8 w-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm text-slate-400">Select a node to see details</p>
        <p className="mt-1 text-xs text-slate-500">
          View context, dependencies, and strategic impact
        </p>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[node.status];
  const importanceConfig = IMPORTANCE_LABELS[node.importance] || IMPORTANCE_LABELS[2];

  return (
    <div className="flex h-full flex-col border-l border-slate-800 bg-slate-950/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-100 truncate">
            {node.label}
          </h3>
          <p className="mt-0.5 text-[10px] text-slate-500 font-mono truncate">
            {node.key}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-2 p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Status & Metadata */}
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {/* Status badge */}
            <span className={`px-2 py-1 rounded text-[10px] font-medium ${statusConfig.bg} ${statusConfig.color}`}>
              {statusConfig.label}
            </span>

            {/* Domain badge */}
            <span className="px-2 py-1 rounded text-[10px] font-medium bg-slate-700 text-slate-300">
              {node.domain}
            </span>

            {/* Importance badge */}
            <span className="px-2 py-1 rounded text-[10px] font-medium bg-slate-700 text-slate-300">
              {importanceConfig.label} ({node.importance}/5)
            </span>

            {/* Human override */}
            {node.isHumanOverride && (
              <span className="px-2 py-1 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300">
                Human Override
              </span>
            )}

            {/* Changed badge */}
            {node.hasChangedSinceSnapshot && (
              <span className="px-2 py-1 rounded text-[10px] font-medium bg-cyan-500/20 text-cyan-300">
                {node.changeType === 'added' ? 'New' : node.changeType === 'removed' ? 'Removed' : 'Updated'}
              </span>
            )}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-2">
            <MetricBox
              label="Confidence"
              value={`${node.confidence}%`}
              color={node.confidence >= 70 ? 'emerald' : node.confidence >= 50 ? 'amber' : 'red'}
            />
            <MetricBox
              label="Freshness"
              value={`${node.freshness}%`}
              color={node.freshness >= 60 ? 'emerald' : node.freshness >= 30 ? 'amber' : 'red'}
            />
          </div>
        </div>

        {/* Current Value */}
        {node.value && (
          <div className="px-4 py-3 border-b border-slate-800">
            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Current Value
            </h4>
            <div className="bg-slate-800/50 rounded-lg p-2.5">
              <p className="text-xs text-slate-300 whitespace-pre-wrap break-words">
                {node.value.length > 300 ? `${node.value.slice(0, 297)}...` : node.value}
              </p>
            </div>
          </div>
        )}

        {/* Why This Matters */}
        <div className="px-4 py-3 border-b border-slate-800">
          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Why This Matters
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            {importanceConfig.description}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {statusConfig.description}
          </p>
        </div>

        {/* Dependencies */}
        <div className="px-4 py-3 border-b border-slate-800">
          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Depends On ({dependsOnNodes.length})
          </h4>
          {dependsOnNodes.length > 0 ? (
            <div className="space-y-1.5">
              {dependsOnNodes.map(dep => (
                <DependencyRow key={dep.id} node={dep} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No direct dependencies</p>
          )}
        </div>

        {/* Feeds Into */}
        <div className="px-4 py-3 border-b border-slate-800">
          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Feeds Into ({feedsIntoNodes.length})
          </h4>
          {feedsIntoNodes.length > 0 ? (
            <div className="space-y-1.5">
              {feedsIntoNodes.map(dep => (
                <DependencyRow key={dep.id} node={dep} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No downstream dependencies</p>
          )}
        </div>

        {/* Provenance */}
        {node.provenance && node.provenance.sources.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-800">
            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Data Sources ({node.provenance.sources.length})
            </h4>
            <div className="space-y-1.5">
              {node.provenance.sources.slice(0, 3).map((source, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs bg-slate-800/30 rounded px-2 py-1.5"
                >
                  <span className="text-slate-300">{formatSourceName(source.source)}</span>
                  <span className="text-slate-500">{Math.round(source.confidence * 100)}%</span>
                </div>
              ))}
              {node.provenance.sources.length > 3 && (
                <p className="text-[10px] text-slate-500 text-center">
                  +{node.provenance.sources.length - 3} more sources
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 border-t border-slate-800 p-3 space-y-2">
        <Link
          href={`/c/${companyId}/brain/context?field=${encodeURIComponent(node.key)}`}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit in Brain
        </Link>

        <button
          onClick={handleCreateWorkItem}
          disabled={creatingWorkItem}
          className={`flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border text-xs transition-colors ${
            workItemSuccess
              ? 'border-emerald-600 bg-emerald-500/20 text-emerald-300'
              : workItemError
              ? 'border-red-600 bg-red-500/20 text-red-300'
              : 'border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
          } ${creatingWorkItem ? 'opacity-60 cursor-wait' : ''}`}
        >
          {creatingWorkItem ? (
            <>
              <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-500 border-t-slate-300 animate-spin" />
              Creating...
            </>
          ) : workItemSuccess ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Work Item Created
            </>
          ) : workItemError ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Failed
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Create Work Item
            </>
          )}
        </button>

        <button
          onClick={handleExplainImpact}
          disabled={loadingExplanation}
          className={`flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors ${loadingExplanation ? 'opacity-60 cursor-wait' : ''}`}
        >
          {loadingExplanation ? (
            <>
              <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-500 border-t-amber-400 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Explain Strategic Impact
            </>
          )}
        </button>
      </div>

      {/* Explanation Modal */}
      {showExplanationModal && (
        <ExplanationModal
          node={node}
          explanation={explanation}
          loading={loadingExplanation}
          error={explanationError}
          onClose={closeExplanationModal}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function MetricBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'emerald' | 'amber' | 'red';
}) {
  const colorClasses = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
  };

  return (
    <div className="bg-slate-800/50 rounded-lg px-3 py-2">
      <div className="text-[9px] text-slate-500 uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-sm font-semibold ${colorClasses[color]}`}>
        {value}
      </div>
    </div>
  );
}

function DependencyRow({ node }: { node: ContextGraphNode }) {
  const statusColor =
    node.status === 'ok' ? 'bg-emerald-500' :
    node.status === 'conflicted' ? 'bg-red-500' :
    node.status === 'stale' ? 'bg-yellow-500' :
    node.status === 'low_confidence' ? 'bg-orange-500' :
    'bg-slate-500';

  return (
    <div className="flex items-center gap-2 text-xs bg-slate-800/30 rounded px-2 py-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
      <span className="text-slate-300 truncate flex-1">{node.label}</span>
      <span className="text-slate-500 text-[10px]">{node.domain}</span>
    </div>
  );
}

function formatSourceName(source: string): string {
  const names: Record<string, string> = {
    website_lab: 'Website Lab',
    media_lab: 'Media Lab',
    brand_lab: 'Brand Lab',
    seo_lab: 'SEO Lab',
    content_lab: 'Content Lab',
    demand_lab: 'Demand Lab',
    ops_lab: 'Ops Lab',
    audience_lab: 'Audience Lab',
    creative_lab: 'Creative Lab',
    gap_ia: 'GAP IA',
    gap_full: 'GAP Full',
    gap_heavy: 'GAP Heavy',
    brain: 'Client Brain',
    manual: 'Manual Entry',
    user: 'User Input',
    airtable: 'Airtable',
    inferred: 'AI Inferred',
    analytics_ga4: 'GA4',
    analytics_gsc: 'Search Console',
    analytics_gads: 'Google Ads',
    setup_wizard: 'Setup Wizard',
    fcb: 'FCB',
    qbr: 'QBR',
  };
  return names[source] || source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function ExplanationModal({
  node,
  explanation,
  loading,
  error,
  onClose,
}: {
  node: ContextGraphNode;
  explanation: FieldExplanation | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{ zIndex: 10000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-700 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Strategic Impact
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {node.label}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-amber-500 animate-spin" />
              <p className="mt-3 text-sm text-slate-400">Analyzing strategic impact...</p>
            </div>
          )}

          {error && (
            <div className="py-6 text-center">
              <div className="mb-3 p-3 rounded-full bg-red-500/20 inline-block">
                <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {explanation && !loading && (
            <div className="space-y-5">
              {/* Explanation */}
              <div>
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  What This Field Represents
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {explanation.explanation}
                </p>
              </div>

              {/* Importance */}
              <div>
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Why It Matters
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {explanation.importance}
                </p>
              </div>

              {/* Related Fields */}
              {explanation.relatedFields.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Related Fields
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {explanation.relatedFields.map((field, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Source Suggestions */}
              {explanation.sourceSuggestions.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    How to Improve This Data
                  </h4>
                  <ul className="space-y-1.5">
                    {explanation.sourceSuggestions.map((suggestion, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-xs text-slate-400"
                      >
                        <span className="text-amber-500 mt-0.5">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 px-5 py-3 bg-slate-900/50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
