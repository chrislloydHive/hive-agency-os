'use client';

// components/os/briefs/BriefWorkspace.tsx
// Main brief view and editing workspace

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Lock,
  Sparkles,
  RefreshCw,
  Briefcase,
  FileCheck,
  AlertCircle,
  Database,
  BarChart2,
  Layers,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Hash,
} from 'lucide-react';
import { BriefField } from './BriefField';
import { BriefQualityBadge } from './BriefQualityBadge';
import type {
  Brief,
  BriefType,
  BriefCore,
  BriefFieldAction,
} from '@/lib/types/brief';
import {
  BRIEF_STATUS_LABELS,
  BRIEF_STATUS_COLORS,
  BRIEF_TYPE_LABELS,
  BRIEF_CORE_FIELDS,
  getExtensionFieldsForType,
  canEditBrief,
  canApproveBrief,
  canGenerateWork,
} from '@/lib/types/brief';

// ============================================================================
// Traceability Strip Component
// ============================================================================

interface TraceabilityStripProps {
  companyId: string;
  brief: Brief;
}

function TraceabilityStrip({ companyId, brief }: TraceabilityStripProps) {
  const [showDetails, setShowDetails] = useState(false);

  const hasContext = !!brief.traceability.sourceContextSnapshotId;
  const hasGap = !!brief.traceability.sourceGapRunId;
  const betCount = brief.traceability.sourceStrategicBetIds.length;
  const hasBets = betCount > 0;

  // Summary of inputs
  const inputsSummary: string[] = [];
  if (hasContext) inputsSummary.push('Context');
  if (hasGap) inputsSummary.push('GAP');
  if (hasBets) inputsSummary.push(`${betCount} bet${betCount > 1 ? 's' : ''}`);

  return (
    <div className="bg-slate-800/30 rounded-lg border border-slate-700/30">
      {/* Summary bar */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full p-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded bg-slate-700/50">
            <Database className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-left">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Inputs Used
            </p>
            <p className="text-sm text-slate-300">
              {inputsSummary.length > 0 ? inputsSummary.join(' + ') : 'No inputs tracked'}
            </p>
          </div>
        </div>
        {showDetails ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {/* Expanded details */}
      {showDetails && (
        <div className="px-3 pb-3 border-t border-slate-700/30 pt-3 space-y-3">
          {/* Context Snapshot */}
          <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
            <div className="flex items-center gap-2">
              <Database className={`w-4 h-4 ${hasContext ? 'text-emerald-400' : 'text-slate-500'}`} />
              <div>
                <p className="text-sm text-slate-300">Context Snapshot</p>
                <p className="text-xs text-slate-500">
                  {hasContext ? 'Company context loaded' : 'Not loaded'}
                </p>
              </div>
            </div>
            {hasContext && (
              <div className="flex items-center gap-2">
                {brief.traceability.inputHashes?.contextHash && (
                  <span
                    className="text-[10px] text-slate-500 font-mono flex items-center gap-1"
                    title="Content hash for change detection"
                  >
                    <Hash className="w-3 h-3" />
                    {brief.traceability.inputHashes.contextHash.slice(0, 8)}
                  </span>
                )}
                <Link
                  href={`/c/${companyId}/context`}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                  title="View context"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* GAP Run */}
          <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
            <div className="flex items-center gap-2">
              <BarChart2 className={`w-4 h-4 ${hasGap ? 'text-emerald-400' : 'text-slate-500'}`} />
              <div>
                <p className="text-sm text-slate-300">GAP Analysis</p>
                <p className="text-xs text-slate-500">
                  {hasGap ? 'GAP insights loaded' : 'Not loaded'}
                </p>
              </div>
            </div>
            {hasGap && (
              <div className="flex items-center gap-2">
                {brief.traceability.inputHashes?.gapHash && (
                  <span
                    className="text-[10px] text-slate-500 font-mono flex items-center gap-1"
                    title="Content hash for change detection"
                  >
                    <Hash className="w-3 h-3" />
                    {brief.traceability.inputHashes.gapHash.slice(0, 8)}
                  </span>
                )}
                <Link
                  href={`/c/${companyId}/gap`}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                  title="View GAP analysis"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Strategic Bets */}
          <div className="p-2 bg-slate-800/50 rounded">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className={`w-4 h-4 ${hasBets ? 'text-emerald-400' : 'text-slate-500'}`} />
                <div>
                  <p className="text-sm text-slate-300">Strategic Bets</p>
                  <p className="text-xs text-slate-500">
                    {hasBets ? `${betCount} accepted bet${betCount > 1 ? 's' : ''} loaded` : 'No accepted bets'}
                  </p>
                </div>
              </div>
              {hasBets && (
                <div className="flex items-center gap-2">
                  {brief.traceability.inputHashes?.betsHash && (
                    <span
                      className="text-[10px] text-slate-500 font-mono flex items-center gap-1"
                      title="Content hash for change detection"
                    >
                      <Hash className="w-3 h-3" />
                      {brief.traceability.inputHashes.betsHash.slice(0, 8)}
                    </span>
                  )}
                  <Link
                    href={`/c/${companyId}/strategy`}
                    className="p-1 text-slate-400 hover:text-white transition-colors"
                    title="View strategy"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>

            {/* List of bet IDs */}
            {hasBets && brief.traceability.sourceStrategicBetIds.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700/50">
                <p className="text-xs text-slate-500 mb-1">Bet IDs:</p>
                <div className="flex flex-wrap gap-1">
                  {brief.traceability.sourceStrategicBetIds.map((betId) => (
                    <span
                      key={betId}
                      className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-700/50 text-slate-400 rounded"
                    >
                      {betId.slice(0, 12)}...
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="text-xs text-slate-500 flex items-center justify-between px-1">
            <span>Created: {new Date(brief.createdAt).toLocaleDateString()}</span>
            <span>Updated: {new Date(brief.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// BriefWorkspace Component
// ============================================================================

interface BriefWorkspaceProps {
  companyId: string;
  brief: Brief;
  onRefresh: () => void;
}

export function BriefWorkspace({ companyId, brief, onRefresh }: BriefWorkspaceProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isGeneratingWork, setIsGeneratingWork] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const editable = canEditBrief(brief);
  const extensionFields = getExtensionFieldsForType(brief.type);

  // Update a field via API
  const updateField = async (fieldPath: string, value: string | string[]) => {
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/briefs/${brief.id}/field`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldPath, value }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update field');
      }

      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update field');
      throw err;
    }
  };

  // Get AI suggestion for a field
  const getAISuggestion = async (
    fieldPath: string,
    action: BriefFieldAction,
    currentValue: string
  ): Promise<{ value?: string; variants?: string[] }> => {
    const response = await fetch(
      `/api/os/companies/${companyId}/briefs/${brief.id}/field`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldPath, action, currentValue }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get AI suggestion');
    }

    const data = await response.json();
    return data.suggestion || {};
  };

  // Regenerate brief
  const handleRegenerate = async (mode: 'replace' | 'improve') => {
    setIsRegenerating(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/briefs/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            engagementId: brief.engagementId,
            projectId: brief.projectId,
            type: brief.type,
            mode,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to regenerate brief');
      }

      setSuccessMessage(`Brief ${mode === 'improve' ? 'improved' : 'regenerated'} successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate brief');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Approve brief
  const handleApprove = async () => {
    setIsApproving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/briefs/${brief.id}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lockStrategy: true }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve brief');
      }

      setSuccessMessage('Brief approved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve brief');
    } finally {
      setIsApproving(false);
    }
  };

  // Generate work from brief
  const handleGenerateWork = async () => {
    setIsGeneratingWork(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/briefs/${brief.id}/work`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate work');
      }

      const data = await response.json();
      setSuccessMessage(`Created ${data.workItemsCreated} work items`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate work');
    } finally {
      setIsGeneratingWork(false);
    }
  };

  // Get field value from core or extension
  const getFieldValue = (fieldPath: string): string | string[] => {
    const [section, fieldName] = fieldPath.split('.') as ['core' | 'extension', string];
    if (section === 'core') {
      return (brief.core as unknown as Record<string, string | string[]>)[fieldName] || '';
    }
    return (brief.extension as unknown as Record<string, string | string[]>)[fieldName] || '';
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          {/* Title row */}
          <div className="flex items-center gap-4 mb-3">
            <Link
              href={brief.projectId ? `/c/${companyId}/projects/${brief.projectId}` : `/c/${companyId}`}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-white">{brief.title}</h1>
                <span className={`px-2 py-0.5 text-xs rounded ${BRIEF_STATUS_COLORS[brief.status]}`}>
                  {BRIEF_STATUS_LABELS[brief.status]}
                </span>
                {brief.isLocked && <Lock className="w-3.5 h-3.5 text-slate-500" />}
                <BriefQualityBadge
                  brief={brief}
                  onImprove={() => handleRegenerate('improve')}
                  showImproveCta={editable}
                />
              </div>
              <p className="text-sm text-slate-400">
                {BRIEF_TYPE_LABELS[brief.type]} Brief
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {editable && (
              <>
                <button
                  onClick={() => handleRegenerate('improve')}
                  disabled={isRegenerating}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 disabled:opacity-50"
                >
                  {isRegenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Improve
                </button>
                <button
                  onClick={() => handleRegenerate('replace')}
                  disabled={isRegenerating}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  Regenerate
                </button>
              </>
            )}

            {canApproveBrief(brief) && (
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 disabled:opacity-50"
              >
                {isApproving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileCheck className="w-4 h-4" />
                )}
                Approve Brief
              </button>
            )}

            {canGenerateWork(brief) && (
              <button
                onClick={handleGenerateWork}
                disabled={isGeneratingWork}
                className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50"
              >
                {isGeneratingWork ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Briefcase className="w-4 h-4" />
                )}
                Generate Work
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-400">{successMessage}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Core Fields */}
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <h2 className="text-sm font-medium text-slate-300 mb-4 pb-2 border-b border-slate-700/50">
              Core Brief
            </h2>
            <div className="space-y-4">
              {BRIEF_CORE_FIELDS.map((field) => (
                <BriefField
                  key={field.key}
                  fieldPath={`core.${field.key}`}
                  label={field.label}
                  description={field.description}
                  value={getFieldValue(`core.${field.key}`)}
                  type={field.type as 'text' | 'textarea' | 'list'}
                  editable={editable}
                  onUpdate={(value) => updateField(`core.${field.key}`, value)}
                  onAIHelper={(action) =>
                    getAISuggestion(
                      `core.${field.key}`,
                      action,
                      String(getFieldValue(`core.${field.key}`))
                    )
                  }
                />
              ))}
            </div>
          </div>

          {/* Extension Fields */}
          {extensionFields.length > 0 && (
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <h2 className="text-sm font-medium text-slate-300 mb-4 pb-2 border-b border-slate-700/50">
                {BRIEF_TYPE_LABELS[brief.type]} Details
              </h2>
              <div className="space-y-4">
                {extensionFields.map((field) => (
                  <BriefField
                    key={field.key}
                    fieldPath={`extension.${field.key}`}
                    label={field.label}
                    description={field.description}
                    value={getFieldValue(`extension.${field.key}`)}
                    type={field.type as 'text' | 'textarea' | 'list'}
                    editable={editable}
                    onUpdate={(value) => updateField(`extension.${field.key}`, value)}
                    onAIHelper={(action) =>
                      getAISuggestion(
                        `extension.${field.key}`,
                        action,
                        String(getFieldValue(`extension.${field.key}`))
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Traceability / Inputs Used Strip */}
          <TraceabilityStrip companyId={companyId} brief={brief} />
        </div>
      </div>
    </div>
  );
}

export default BriefWorkspace;
