'use client';

// components/os/artifacts/CreateWorkFromArtifactModal.tsx
// Modal for converting artifacts to work items
//
// Two-step flow:
// 1. Preview: Shows proposed work items with deduplication info
// 2. Confirm: Creates work items and shows success state

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Briefcase,
  AlertCircle,
  CheckSquare,
  Square,
} from 'lucide-react';
import type { Artifact } from '@/lib/types/artifact';

// ============================================================================
// Types
// ============================================================================

interface CreateWorkFromArtifactModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  artifact: Artifact;
}

interface ProposedWorkItem {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  area: string;
  sectionName?: string;
  workKey: string;
  alreadyExists: boolean;
}

interface PreviewResponse {
  artifactId: string;
  artifactType: string;
  artifactStatus: string;
  artifactTitle: string;
  proposedWorkItems: ProposedWorkItem[];
  stats: {
    total: number;
    fromSections: number;
    fromAi: number;
    alreadyExisting: number;
    willBeCreated: number;
  };
  warning?: string;
}

interface ConvertResponse {
  success: boolean;
  createdCount: number;
  skippedCount: number;
  workItems: Array<{
    id: string;
    title: string;
    status: string;
    area: string;
  }>;
  message: string;
}

type Step = 'preview' | 'confirm' | 'success';

// ============================================================================
// Component
// ============================================================================

export function CreateWorkFromArtifactModal({
  isOpen,
  onClose,
  companyId,
  artifact,
}: CreateWorkFromArtifactModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('preview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [convertResult, setConvertResult] = useState<ConvertResponse | null>(null);
  const [draftConfirmed, setDraftConfirmed] = useState(false);

  const isDraft = artifact.status === 'draft';

  // Fetch preview on mount
  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/artifacts/${artifact.id}/convert-to-work`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load preview');
      }

      const data: PreviewResponse = await response.json();
      setPreviewData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, [companyId, artifact.id]);

  useEffect(() => {
    if (isOpen) {
      setStep('preview');
      setError(null);
      setDraftConfirmed(false);
      setConvertResult(null);
      fetchPreview();
    }
  }, [isOpen, fetchPreview]);

  // Execute conversion
  const handleConvert = async () => {
    if (isDraft && !draftConfirmed) {
      setError('Please confirm you want to convert this draft artifact');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/artifacts/${artifact.id}/convert-to-work`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            includeDraft: isDraft,
            attachArtifactToCreatedWorkItems: true,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Conversion failed');
      }

      const data: ConvertResponse = await response.json();
      setConvertResult(data);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setLoading(false);
    }
  };

  // Navigate to Work page
  const handleViewWork = () => {
    router.push(`/c/${companyId}/work?artifactId=${artifact.id}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {step === 'success' ? 'Work Items Created' : 'Create Work from Artifact'}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {artifact.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && step !== 'success' && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <span className="ml-3 text-slate-400">
                {step === 'preview' ? 'Loading preview...' : 'Creating work items...'}
              </span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && previewData && !loading && (
            <div className="space-y-6">
              {/* Draft Warning */}
              {isDraft && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-400">
                        Draft Artifact
                      </p>
                      <p className="text-sm text-amber-400/80 mt-1">
                        This artifact is still a draft. Content may change before it becomes final.
                      </p>
                      <p className="text-xs text-amber-400/60 mt-1">
                        Draft artifacts can still change. You may want to finalize this artifact before executing.
                      </p>
                      <label className="flex items-center gap-2 mt-3 cursor-pointer">
                        <button
                          onClick={() => setDraftConfirmed(!draftConfirmed)}
                          className="text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          {draftConfirmed ? (
                            <CheckSquare className="w-5 h-5" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                        <span className="text-sm text-amber-400">
                          I understand and want to proceed
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Linking explanation */}
              <div className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-300">
                  These work items will be created and automatically linked back to this artifact.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Existing items will not be duplicated.
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-2xl font-bold text-white">
                    {previewData.stats.willBeCreated}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Will be created</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-2xl font-bold text-slate-500">
                    {previewData.stats.alreadyExisting}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Already exist</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-2xl font-bold text-white">
                    {previewData.stats.total}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Total items</p>
                </div>
              </div>

              {/* Work Items List */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3">
                  Proposed Work Items
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {previewData.proposedWorkItems.map((item, index) => (
                    <div
                      key={item.workKey}
                      className={`p-3 rounded-lg border ${
                        item.alreadyExists
                          ? 'bg-slate-800/30 border-slate-700/50 opacity-60'
                          : 'bg-slate-800/50 border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-200 truncate">
                              {item.title}
                            </p>
                            {item.alreadyExists && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-600/50 text-slate-400 rounded">
                                Exists
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                            {item.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <PriorityBadge priority={item.priority} />
                          {item.sectionName && (
                            <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-700 text-slate-400 rounded">
                              {item.sectionName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {previewData.stats.willBeCreated === 0 && (
                <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-300">
                    All work items already exist
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    No new items will be created
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && convertResult && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Work created and linked
              </h3>
              <p className="text-sm text-slate-400 mb-2">
                {convertResult.createdCount > 0
                  ? `${convertResult.createdCount} work item${convertResult.createdCount > 1 ? 's were' : ' was'} created and linked to this artifact.`
                  : 'All work items already existed.'}
              </p>
              <p className="text-xs text-slate-500 mb-6">
                You can track progress and outcomes from the Work page.
                {convertResult.skippedCount > 0 && (
                  <span className="block mt-1">
                    {convertResult.skippedCount} duplicate{convertResult.skippedCount > 1 ? 's were' : ' was'} skipped.
                  </span>
                )}
              </p>

              {convertResult.workItems.length > 0 && (
                <div className="text-left bg-slate-800/50 rounded-lg p-4 mb-6">
                  <p className="text-xs text-slate-500 mb-2">Created items:</p>
                  <ul className="space-y-1">
                    {convertResult.workItems.slice(0, 5).map((item) => (
                      <li key={item.id} className="text-sm text-slate-300 flex items-center gap-2">
                        <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                        {item.title}
                      </li>
                    ))}
                    {convertResult.workItems.length > 5 && (
                      <li className="text-xs text-slate-500">
                        +{convertResult.workItems.length - 5} more...
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <button
                onClick={handleViewWork}
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-colors"
              >
                <Briefcase className="w-4 h-4" />
                View in Work
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && previewData && !loading && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConvert}
              disabled={previewData.stats.willBeCreated === 0 || (isDraft && !draftConfirmed)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-colors"
            >
              <Briefcase className="w-4 h-4" />
              Create {previewData.stats.willBeCreated} Work Item{previewData.stats.willBeCreated !== 1 ? 's' : ''}
            </button>
          </div>
        )}

        {step === 'success' && (
          <div className="flex items-center justify-center px-6 py-4 border-t border-slate-800 bg-slate-900/50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function PriorityBadge({ priority }: { priority: 'low' | 'medium' | 'high' }) {
  const config = {
    high: { label: 'High', className: 'bg-red-500/10 text-red-400 border-red-500/30' },
    medium: { label: 'Med', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
    low: { label: 'Low', className: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
  };

  const { label, className } = config[priority];

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium border rounded ${className}`}>
      {label}
    </span>
  );
}

export default CreateWorkFromArtifactModal;
