'use client';

// components/os/overview/RfpDeliverablesCard.tsx
// RFP Response Deliverables Card for Company Overview
//
// Shows the RFP Response bundle:
// - RFP Response Doc (Google Doc)
// - Proposal Slides (Google Slides)
// - Pricing Sheet (Google Sheet)
//
// Each item can be:
// - Not created: show "Create" button
// - Created (up to date): show "Open" button
// - Out of date (stale): show "Insert Updates" for Doc, "Open" for others

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Presentation,
  Table,
  ExternalLink,
  RefreshCw,
  Plus,
  AlertCircle,
  Loader2,
  FileWarning,
  Package,
} from 'lucide-react';
import type { Artifact, ArtifactType } from '@/lib/types/artifact';
import { InlineReadinessWarning } from './InlineReadinessWarning';

// ============================================================================
// Types
// ============================================================================

interface RfpDeliverablesCardProps {
  companyId: string;
}

interface RfpDeliverableState {
  type: ArtifactType;
  label: string;
  icon: React.ReactNode;
  artifact: Artifact | null;
  status: 'not_created' | 'up_to_date' | 'out_of_date';
  canUpdate: boolean;
}

interface ContextFieldStatus {
  field: string;
  label: string;
  confirmed: boolean;
}

// ============================================================================
// Component
// ============================================================================

// Required context fields for RFP deliverables
const REQUIRED_CONTEXT_FIELDS = [
  { field: 'brand.positioning', label: 'Brand Positioning' },
  { field: 'audience.icpDescription', label: 'ICP Description' },
  { field: 'productOffer.valueProposition', label: 'Value Proposition' },
] as const;

export function RfpDeliverablesCard({ companyId }: RfpDeliverablesCardProps) {
  const router = useRouter();
  const [deliverables, setDeliverables] = useState<RfpDeliverableState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextReady, setContextReady] = useState(false);
  const [contextFields, setContextFields] = useState<ContextFieldStatus[]>([]);
  const [creating, setCreating] = useState<ArtifactType | null>(null);
  const [updating, setUpdating] = useState(false);

  // Fetch RFP artifacts
  const fetchArtifacts = useCallback(async () => {
    try {
      // Fetch all artifacts for the company
      const response = await fetch(`/api/os/companies/${companyId}/artifacts`).catch(() => null);

      if (!response) {
        // Network error - show empty state
        setLoading(false);
        return;
      }

      if (!response.ok) {
        if (response.status === 403) {
          // Artifacts feature not enabled
          setLoading(false);
          return;
        }
        throw new Error('Failed to fetch artifacts');
      }

      const data = await response.json();
      const artifacts: Artifact[] = data.artifacts || [];

      // Find RFP-related artifacts
      const rfpDoc = findActiveArtifact(artifacts, 'rfp_response_doc');
      const proposalSlides = findActiveArtifact(artifacts, 'proposal_slides');
      const pricingSheet = findActiveArtifact(artifacts, 'pricing_sheet');

      // Build deliverables state
      setDeliverables([
        {
          type: 'rfp_response_doc',
          label: 'RFP Response',
          icon: <FileText className="w-4 h-4" />,
          artifact: rfpDoc,
          status: getStatus(rfpDoc),
          canUpdate: true, // RFP doc supports Insert Updates
        },
        {
          type: 'proposal_slides',
          label: 'Proposal Slides',
          icon: <Presentation className="w-4 h-4" />,
          artifact: proposalSlides,
          status: getStatus(proposalSlides),
          canUpdate: false,
        },
        {
          type: 'pricing_sheet',
          label: 'Pricing Sheet',
          icon: <Table className="w-4 h-4" />,
          artifact: pricingSheet,
          status: getStatus(pricingSheet),
          canUpdate: false,
        },
      ]);

      // Fetch context readiness and field status
      const [contextResponse, healthResponse] = await Promise.all([
        fetch(`/api/os/companies/${companyId}/documents/strategy/status`).catch(() => null),
        fetch(`/api/os/companies/${companyId}/context/v4/health`, { cache: 'no-store' }).catch(() => null),
      ]);

      if (contextResponse?.ok) {
        const contextData = await contextResponse.json();
        setContextReady(contextData.contextReady || false);
      }

      // Parse field confirmation status from health response
      if (healthResponse?.ok) {
        const healthData = await healthResponse.json();
        const confirmedFields = healthData.confirmedFields || [];

        // Map required fields to their confirmation status
        const fieldStatus: ContextFieldStatus[] = REQUIRED_CONTEXT_FIELDS.map(({ field, label }) => ({
          field,
          label,
          confirmed: confirmedFields.includes(field),
        }));
        setContextFields(fieldStatus);
      } else {
        // Default to empty if health check fails
        setContextFields(REQUIRED_CONTEXT_FIELDS.map(({ field, label }) => ({
          field,
          label,
          confirmed: false,
        })));
      }

      setError(null);
    } catch (err) {
      console.error('[RfpDeliverablesCard] Error fetching artifacts:', err);
      setError('Failed to load RFP deliverables');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  // Create an RFP artifact
  const handleCreate = useCallback(async (type: ArtifactType) => {
    setCreating(type);
    setError(null);

    try {
      const endpoint = getCreateEndpoint(type);
      const response = await fetch(
        `/api/os/companies/${companyId}/artifacts/${endpoint}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || `Failed to create ${type}`);
      }

      // Refresh the page
      router.refresh();
      await fetchArtifacts();
    } catch (err) {
      console.error(`[RfpDeliverablesCard] Error creating ${type}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(null);
    }
  }, [companyId, router, fetchArtifacts]);

  // Update RFP doc (append updates)
  const handleUpdate = useCallback(async () => {
    setUpdating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/artifacts/update-rfp-doc`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to update RFP document');
      }

      // Refresh the page
      router.refresh();
      await fetchArtifacts();
    } catch (err) {
      console.error('[RfpDeliverablesCard] Error updating RFP doc:', err);
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setUpdating(false);
    }
  }, [companyId, router, fetchArtifacts]);

  // Loading state
  if (loading) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-lg">
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-300">RFP Response</p>
            <p className="text-xs text-slate-500">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Not showing if no deliverables (feature disabled)
  if (deliverables.length === 0) {
    return null;
  }

  // Count states
  const createdCount = deliverables.filter(d => d.artifact !== null).length;
  const staleCount = deliverables.filter(d => d.status === 'out_of_date').length;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${createdCount === 3 ? 'bg-emerald-500/10' : 'bg-slate-800'}`}>
              <Package className={`w-4 h-4 ${createdCount === 3 ? 'text-emerald-400' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">RFP Response</p>
              <p className="text-xs text-slate-500">
                {createdCount === 0
                  ? 'Not started'
                  : createdCount === 3
                    ? staleCount > 0
                      ? `${staleCount} update${staleCount > 1 ? 's' : ''} available`
                      : 'Complete'
                    : `${createdCount}/3 created`}
              </p>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <span className="text-xs text-red-400">{error}</span>
          )}
        </div>
      </div>

      {/* Deliverables list */}
      <div className="divide-y divide-slate-800/50">
        {deliverables.map((deliverable) => (
          <DeliverableRow
            key={deliverable.type}
            deliverable={deliverable}
            contextReady={contextReady}
            creating={creating === deliverable.type}
            updating={updating && deliverable.type === 'rfp_response_doc'}
            onCreate={() => handleCreate(deliverable.type)}
            onUpdate={handleUpdate}
          />
        ))}
      </div>

      {/* Context field checklist - shows when deliverables not yet created */}
      {!contextReady && createdCount === 0 && contextFields.length > 0 && (
        <div className="p-3 bg-slate-800/30 border-t border-slate-700/50">
          <p className="text-xs text-slate-400 mb-2">
            Confirm these fields to unlock deliverables:
          </p>
          <div className="space-y-1">
            {contextFields.map((field) => (
              <div
                key={field.field}
                className="flex items-center gap-2 text-xs"
              >
                {field.confirmed ? (
                  <span className="text-emerald-400">✓</span>
                ) : (
                  <span className="text-slate-500">○</span>
                )}
                <span className={field.confirmed ? 'text-slate-300' : 'text-slate-500'}>
                  {field.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Readiness warnings */}
      {contextReady && createdCount === 0 && (
        <div className="px-4 pb-3">
          <InlineReadinessWarning companyId={companyId} context="deliverable" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

interface DeliverableRowProps {
  deliverable: RfpDeliverableState;
  contextReady: boolean;
  creating: boolean;
  updating: boolean;
  onCreate: () => void;
  onUpdate: () => void;
}

function DeliverableRow({
  deliverable,
  contextReady,
  creating,
  updating,
  onCreate,
  onUpdate,
}: DeliverableRowProps) {
  const { type, label, icon, artifact, status, canUpdate } = deliverable;

  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded ${getIconStyle(status)}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-slate-300">{label}</p>
          <p className="text-xs text-slate-500">{getSubtitle(status, artifact)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Not created - show Create button */}
        {status === 'not_created' && (
          <button
            onClick={onCreate}
            disabled={creating || !contextReady}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={!contextReady ? 'Context V4 data required' : `Create ${label}`}
          >
            {creating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Create
          </button>
        )}

        {/* Up to date - show Open button */}
        {status === 'up_to_date' && artifact?.googleFileUrl && (
          <a
            href={artifact.googleFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open
          </a>
        )}

        {/* Out of date - show Open + Update (if supported) */}
        {status === 'out_of_date' && (
          <div className="flex items-center gap-2">
            {artifact?.googleFileUrl && (
              <a
                href={artifact.googleFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/30 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </a>
            )}
            {canUpdate && (
              <button
                onClick={onUpdate}
                disabled={updating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
              >
                {updating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Insert Updates
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Find active (non-archived) artifact of a specific type
 */
function findActiveArtifact(artifacts: Artifact[], type: ArtifactType): Artifact | null {
  const matching = artifacts.filter(a => a.type === type && a.status !== 'archived');

  // Prefer final, then draft
  const final = matching.find(a => a.status === 'final');
  if (final) return final;

  const draft = matching.find(a => a.status === 'draft');
  if (draft) return draft;

  return null;
}

/**
 * Get status from artifact
 */
function getStatus(artifact: Artifact | null): 'not_created' | 'up_to_date' | 'out_of_date' {
  if (!artifact) return 'not_created';
  if (artifact.isStale) return 'out_of_date';
  return 'up_to_date';
}

/**
 * Get create endpoint for artifact type
 */
function getCreateEndpoint(type: ArtifactType): string {
  switch (type) {
    case 'rfp_response_doc':
      return 'create-rfp-doc';
    case 'proposal_slides':
      return 'create-proposal-slides';
    case 'pricing_sheet':
      return 'create-pricing-sheet';
    default:
      throw new Error(`Unknown artifact type: ${type}`);
  }
}

/**
 * Get icon style based on status
 */
function getIconStyle(status: 'not_created' | 'up_to_date' | 'out_of_date'): string {
  switch (status) {
    case 'up_to_date':
      return 'bg-emerald-500/10 text-emerald-400';
    case 'out_of_date':
      return 'bg-amber-500/10 text-amber-400';
    default:
      return 'bg-slate-800 text-slate-400';
  }
}

/**
 * Get subtitle based on status
 */
function getSubtitle(status: 'not_created' | 'up_to_date' | 'out_of_date', artifact: Artifact | null): string {
  switch (status) {
    case 'not_created':
      return 'Ready to create';
    case 'up_to_date':
      if (artifact?.lastSyncedAt) {
        return `Synced ${formatRelativeTime(artifact.lastSyncedAt)}`;
      }
      return 'Up to date';
    case 'out_of_date':
      return 'Updates available';
    default:
      return '';
  }
}

/**
 * Format relative time
 */
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export default RfpDeliverablesCard;
