// components/strategy/HandoffButton.tsx
// Strategy → Programs & Work Handoff Button
//
// Primary CTA for generating executable Programs and Work from a Strategy.
// Shows a preview modal where users can review and apply the handoff.

'use client';

import React, { useState, useCallback } from 'react';
import {
  Rocket,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Check,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import type {
  StrategyProgramProposal,
  ProposedProgram,
  ProposedInitiative,
  ExtendedProgramType,
  HandoffApplyResult,
} from '@/lib/os/strategy/strategyToPrograms';

// ============================================================================
// Types
// ============================================================================

interface HandoffButtonProps {
  companyId: string;
  strategyId: string;
  strategyTitle: string;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function HandoffButton({
  companyId,
  strategyId,
  strategyTitle,
  disabled = false,
  className = '',
}: HandoffButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [proposal, setProposal] = useState<StrategyProgramProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<HandoffApplyResult | null>(null);
  const [staleWarning, setStaleWarning] = useState<{ staleScopes: string[]; message: string } | null>(null);

  // Exclusions state
  const [excludedPrograms, setExcludedPrograms] = useState<Set<ExtendedProgramType>>(new Set());
  const [excludedInitiatives, setExcludedInitiatives] = useState<Set<string>>(new Set());

  // Generate programs proposal
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setApplyResult(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/${strategyId}/handoff/programs`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate programs');
      }

      const data = await response.json();
      setProposal(data.proposal);
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate programs');
    } finally {
      setGenerating(false);
    }
  }, [companyId, strategyId]);

  // Apply the proposal
  const handleApply = useCallback(async (forceApply = false) => {
    if (!proposal) return;

    setApplying(true);
    setError(null);
    if (forceApply) setStaleWarning(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/${strategyId}/handoff/apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proposal,
            excludeProgramTypes: Array.from(excludedPrograms),
            excludeInitiativeKeys: Array.from(excludedInitiatives),
            forceApply,
          }),
        }
      );

      const data = await response.json();

      // Handle stale response (409 Conflict)
      if (response.status === 409 && data.status === 'stale') {
        setStaleWarning({
          staleScopes: data.staleScopes,
          message: data.message,
        });
        return;
      }

      const result = data as HandoffApplyResult;
      setApplyResult(result);

      if (result.success) {
        // Keep modal open to show success and links
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply handoff');
    } finally {
      setApplying(false);
    }
  }, [companyId, strategyId, proposal, excludedPrograms, excludedInitiatives]);

  // Toggle program exclusion
  const toggleProgramExclusion = useCallback((programType: ExtendedProgramType) => {
    setExcludedPrograms(prev => {
      const next = new Set(prev);
      if (next.has(programType)) {
        next.delete(programType);
      } else {
        next.add(programType);
      }
      return next;
    });
  }, []);

  // Toggle initiative exclusion
  const toggleInitiativeExclusion = useCallback((initiativeKey: string) => {
    setExcludedInitiatives(prev => {
      const next = new Set(prev);
      if (next.has(initiativeKey)) {
        next.delete(initiativeKey);
      } else {
        next.add(initiativeKey);
      }
      return next;
    });
  }, []);

  // Close and reset
  const handleClose = useCallback(() => {
    setShowPreview(false);
    setProposal(null);
    setApplyResult(null);
    setStaleWarning(null);
    setExcludedPrograms(new Set());
    setExcludedInitiatives(new Set());
  }, []);

  return (
    <>
      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={disabled || generating}
        className={`
          flex items-center gap-2 px-4 py-2 text-sm font-medium
          bg-gradient-to-r from-purple-600 to-indigo-600
          hover:from-purple-500 hover:to-indigo-500
          text-white rounded-lg shadow-lg
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all
          ${className}
        `}
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Rocket className="w-4 h-4" />
            Generate Programs & Work
          </>
        )}
      </button>

      {/* Error Toast */}
      {error && !showPreview && (
        <div className="fixed bottom-4 right-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && proposal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Programs & Work Preview
                </h2>
                <p className="text-sm text-slate-400">
                  Review generated programs and work items before applying
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Success Result */}
              {applyResult?.success && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">Handoff Applied Successfully</span>
                  </div>
                  <div className="text-sm text-emerald-300/80 space-y-1">
                    <p>Programs created: {applyResult.programs.created.length}</p>
                    <p>Work items created: {applyResult.workItems.created.length}</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <a
                      href={`/c/${companyId}/programs`}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                    >
                      View Programs
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={`/c/${companyId}/work?strategyId=${strategyId}`}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                    >
                      View Work
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Stale Warning */}
              {staleWarning && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-amber-400 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">Strategy Changed Since Proposal</span>
                  </div>
                  <p className="text-sm text-amber-300/80 mb-3">
                    {staleWarning.message}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-amber-400 mb-3">
                    Changed: {staleWarning.staleScopes.join(', ')}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerate}
                      className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
                    >
                      Regenerate Proposal
                    </button>
                    <button
                      onClick={() => handleApply(true)}
                      disabled={applying}
                      className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                    >
                      Apply Anyway
                    </button>
                  </div>
                </div>
              )}

              {/* Errors */}
              {applyResult?.errors && applyResult.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-400 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">Some items failed</span>
                  </div>
                  <ul className="text-sm text-red-300/80 list-disc list-inside">
                    {applyResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {proposal.warnings.length > 0 && !applyResult && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{proposal.warnings.join('. ')}</span>
                  </div>
                </div>
              )}

              {/* Programs List */}
              {!applyResult?.success && proposal.programs.map(program => (
                <ProgramPreviewCard
                  key={program.programKey}
                  program={program}
                  excluded={excludedPrograms.has(program.programType)}
                  onToggleExclude={() => toggleProgramExclusion(program.programType)}
                  excludedInitiatives={excludedInitiatives}
                  onToggleInitiativeExclude={toggleInitiativeExclusion}
                />
              ))}

              {/* Reasoning */}
              {proposal.reasoning && !applyResult && (
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-slate-400 mb-1">AI Reasoning</h4>
                  <p className="text-sm text-slate-300">{proposal.reasoning}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            {!applyResult?.success && (
              <div className="flex items-center justify-between p-4 border-t border-slate-700">
                <div className="text-sm text-slate-400">
                  {proposal.programs.length - excludedPrograms.size} program(s),{' '}
                  {proposal.programs.reduce((sum, p) => sum + p.initiatives.length, 0) - excludedInitiatives.size} initiative(s)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleApply(false)}
                    disabled={applying || excludedPrograms.size === proposal.programs.length}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-50"
                  >
                    {applying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Apply Handoff
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// Program Preview Card
// ============================================================================

interface ProgramPreviewCardProps {
  program: ProposedProgram;
  excluded: boolean;
  onToggleExclude: () => void;
  excludedInitiatives: Set<string>;
  onToggleInitiativeExclude: (key: string) => void;
}

function ProgramPreviewCard({
  program,
  excluded,
  onToggleExclude,
  excludedInitiatives,
  onToggleInitiativeExclude,
}: ProgramPreviewCardProps) {
  const [expanded, setExpanded] = useState(true);

  const workItemCount = program.initiatives.reduce(
    (sum, init) => sum + init.workItems.length,
    0
  );

  return (
    <div
      className={`
        border rounded-lg overflow-hidden transition-opacity
        ${excluded
          ? 'border-slate-700/50 bg-slate-800/30 opacity-50'
          : 'border-slate-700 bg-slate-800/50'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{program.title}</span>
              <span className="text-xs px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded">
                {program.programType}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{program.summary}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-xs text-slate-400">
            <div>{program.initiatives.length} initiatives</div>
            <div>{workItemCount} work items</div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!excluded}
              onChange={onToggleExclude}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500/50"
            />
            <span className="text-xs text-slate-400">Include</span>
          </label>
        </div>
      </div>

      {/* Initiatives */}
      {expanded && !excluded && (
        <div className="divide-y divide-slate-700/50">
          {program.initiatives.map(initiative => (
            <InitiativePreviewRow
              key={initiative.initiativeKey}
              initiative={initiative}
              excluded={excludedInitiatives.has(initiative.initiativeKey)}
              onToggleExclude={() => onToggleInitiativeExclude(initiative.initiativeKey)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Initiative Preview Row
// ============================================================================

interface InitiativePreviewRowProps {
  initiative: ProposedInitiative;
  excluded: boolean;
  onToggleExclude: () => void;
}

function InitiativePreviewRow({
  initiative,
  excluded,
  onToggleExclude,
}: InitiativePreviewRowProps) {
  const [showWorkItems, setShowWorkItems] = useState(false);

  const sequenceColors = {
    now: 'bg-red-500/10 text-red-400',
    next: 'bg-amber-500/10 text-amber-400',
    later: 'bg-slate-500/10 text-slate-400',
  };

  return (
    <div className={`p-3 ${excluded ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white">{initiative.title}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${sequenceColors[initiative.sequence]}`}>
              {initiative.sequence.toUpperCase()}
            </span>
            <span className="text-xs text-slate-500">
              {initiative.effort}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
            {initiative.description}
          </p>

          {/* Work Items Toggle */}
          <button
            onClick={() => setShowWorkItems(!showWorkItems)}
            className="flex items-center gap-1 mt-2 text-xs text-slate-500 hover:text-slate-300"
          >
            {showWorkItems ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {initiative.workItems.length} work items
          </button>

          {/* Work Items List */}
          {showWorkItems && (
            <div className="mt-2 pl-3 border-l border-slate-700 space-y-1">
              {initiative.workItems.map(work => (
                <div key={work.workKey} className="text-xs text-slate-400">
                  <span className="text-slate-300">{work.title}</span>
                  <span className="ml-2 text-slate-500">
                    {work.effort} / {work.impact}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={!excluded}
            onChange={onToggleExclude}
            className="w-3 h-3 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500/50"
          />
        </label>
      </div>
    </div>
  );
}

export default HandoffButton;
