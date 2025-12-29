'use client';

// components/os/strategy/GenerateArtifactCTA.tsx
// Generate Artifact CTA - Replaces the Generate Brief CTA
//
// Shows a call-to-action for generating artifacts from strategy.
// Opens the GenerateArtifactModal when clicked.

import { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { GenerateArtifactModal } from './GenerateArtifactModal';
import type { StrategyFrame, Tactic } from '@/lib/types/strategy';
import type { FrameCompleteness } from '@/lib/os/strategy/frameValidation';
import type { ArtifactTypeDefinition } from '@/lib/os/artifacts/registry';
import { FEATURE_FLAGS } from '@/lib/config/featureFlags';

// ============================================================================
// Types
// ============================================================================

interface GenerateArtifactCTAProps {
  companyId: string;
  strategyId: string;
  frame: StrategyFrame;
  tactics: Tactic[];
  frameCompleteness: FrameCompleteness;
}

// ============================================================================
// Main Component
// ============================================================================

export function GenerateArtifactCTA({
  companyId,
  strategyId,
  frame,
  tactics,
  frameCompleteness,
}: GenerateArtifactCTAProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recommendedTypes, setRecommendedTypes] = useState<ArtifactTypeDefinition[]>([]);

  // Compute readiness
  const canGenerate = frameCompleteness.isComplete;
  const activeTactics = tactics.filter(t => t.status === 'active' || t.status === 'proposed');
  const hasActiveTactics = activeTactics.length > 0;

  // Check if artifacts feature is enabled
  const isEnabled = FEATURE_FLAGS.ARTIFACTS_ENABLED;

  // Load recommended artifact types based on tactics
  // Hook must be called unconditionally, before any early returns
  useEffect(() => {
    // Skip if feature is disabled
    if (!isEnabled) return;

    async function loadRecommendations() {
      try {
        const { detectTacticChannels } = await import('@/lib/os/artifacts/buildInputs');
        const { getRecommendedArtifactTypes } = await import('@/lib/os/artifacts/registry');

        // Build a mock strategy to detect channels
        const mockStrategy = {
          plays: tactics.map(t => ({
            id: t.id,
            title: t.title,
            channels: t.channels || [],
            status: t.status,
          })),
        };

        const channelContext = detectTacticChannels(mockStrategy as any);
        const recommended = getRecommendedArtifactTypes(channelContext);
        setRecommendedTypes(recommended);
      } catch (err) {
        console.error('[GenerateArtifactCTA] Failed to load recommendations:', err);
      }
    }

    if (canGenerate && hasActiveTactics) {
      loadRecommendations();
    }
  }, [isEnabled, canGenerate, hasActiveTactics, tactics]);

  // Disabled reason
  const disabledReason = useMemo(() => {
    if (!frameCompleteness.isComplete) {
      const missing = frameCompleteness.missingFields.slice(0, 3).join(', ');
      return `Missing strategy frame fields: ${missing}`;
    }
    if (!hasActiveTactics) {
      return 'No active tactics defined';
    }
    return null;
  }, [frameCompleteness, hasActiveTactics]);

  // Don't render if artifacts feature is disabled
  if (!isEnabled) {
    return null;
  }

  return (
    <>
      <div
        className={`rounded-xl p-4 ${
          canGenerate
            ? 'bg-purple-500/10 border border-purple-500/30'
            : 'bg-slate-800/50 border border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${canGenerate ? 'bg-purple-500/20' : 'bg-slate-700'}`}>
              <FileText className={`w-5 h-5 ${canGenerate ? 'text-purple-400' : 'text-slate-500'}`} />
            </div>
            <div>
              <h3 className={`text-sm font-medium ${canGenerate ? 'text-purple-300' : 'text-slate-400'}`}>
                Generate Artifacts
              </h3>
              {canGenerate ? (
                <p className="text-xs text-purple-400/70">
                  Create briefs, summaries, and playbooks from your strategy
                </p>
              ) : (
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {disabledReason}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            disabled={!canGenerate}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              canGenerate
                ? 'bg-purple-600 hover:bg-purple-500 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Generate
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Quick stats */}
        {canGenerate && (
          <div className="mt-3 pt-3 border-t border-purple-500/20 flex items-center gap-4 text-xs text-purple-400/70">
            <span>{activeTactics.length} active tactics</span>
            <span>{recommendedTypes.length} recommended types</span>
          </div>
        )}
      </div>

      {/* Modal */}
      <GenerateArtifactModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        companyId={companyId}
        strategyId={strategyId}
        tactics={activeTactics}
        recommendedTypes={recommendedTypes}
      />
    </>
  );
}

export default GenerateArtifactCTA;
