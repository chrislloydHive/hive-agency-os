'use client';

// components/os/programs/AICoPlannerPanel.tsx
// AI Co-planner Panel for Program Planning
//
// Provides AI assistance for drafting program content:
// - Scoped drafts (deliverables, milestones, KPIs, risks, dependencies)
// - Full program drafts
// - Proposal review with Apply/Discard actions
//
// AI cannot set status to ready/committed or create Work items.
// All drafts are proposals that require explicit user approval.

import React, { useState, useCallback, useEffect } from 'react';
import {
  Sparkles,
  Loader2,
  FileText,
  Calendar,
  Target,
  AlertTriangle,
  Link2,
  Lightbulb,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Wand2,
} from 'lucide-react';
import type {
  PlanningProgram,
  ProposalType,
  ProgramDraftProposal,
  FullProgramDraftPayload,
  ProposedDeliverable,
  ProposedMilestone,
  ProposedKPI,
  ProposedRisk,
  ProposedDependency,
} from '@/lib/types/program';

// ============================================================================
// Types
// ============================================================================

interface AICoPlannerPanelProps {
  program: PlanningProgram;
  companyId: string;
  onApply: (updatedProgram: PlanningProgram) => void;
  disabled?: boolean;
}

interface ProposalWithStats {
  proposal: ProgramDraftProposal;
  stats?: {
    deliverables?: number;
    milestones?: number;
    kpis?: number;
    risks?: number;
    dependencies?: number;
  };
}

// ============================================================================
// Draft Type Config
// ============================================================================

const DRAFT_TYPES: {
  type: ProposalType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    type: 'deliverables',
    label: 'Draft deliverables',
    description: 'Generate specific outputs for this program',
    icon: <FileText className="w-4 h-4" />,
  },
  {
    type: 'milestones',
    label: 'Draft milestones',
    description: 'Create checkpoints to track progress',
    icon: <Calendar className="w-4 h-4" />,
  },
  {
    type: 'kpis',
    label: 'Draft KPIs',
    description: 'Define success metrics',
    icon: <Target className="w-4 h-4" />,
  },
  {
    type: 'risks',
    label: 'Draft risks',
    description: 'Identify potential issues and mitigations',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  {
    type: 'dependencies',
    label: 'Draft dependencies',
    description: 'List external requirements',
    icon: <Link2 className="w-4 h-4" />,
  },
];

// ============================================================================
// Main Component
// ============================================================================

export function AICoPlannerPanel({
  program,
  companyId,
  onApply,
  disabled = false,
}: AICoPlannerPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState<ProposalType | 'full' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ProposalWithStats[]>([]);
  const [instructions, setInstructions] = useState('');
  const [isApplying, setIsApplying] = useState<string | null>(null);

  // Fetch pending proposals on mount/program change
  useEffect(() => {
    fetchProposals();
  }, [program.id]);

  const fetchProposals = async () => {
    try {
      const res = await fetch(`/api/os/programs/${program.id}/ai/proposals?status=pending`);
      if (res.ok) {
        const data = await res.json();
        setProposals(data.proposals.map((p: ProgramDraftProposal) => ({ proposal: p })));
      }
    } catch (err) {
      console.error('Failed to fetch proposals:', err);
    }
  };

  // Generate scoped draft
  const handleGenerateDraft = useCallback(async (type: ProposalType) => {
    setIsGenerating(true);
    setGeneratingType(type);
    setError(null);

    try {
      const res = await fetch(`/api/os/programs/${program.id}/ai/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          instructions: instructions.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate draft');
      }

      // Add to proposals list
      setProposals(prev => [...prev, { proposal: data.proposal }]);
      setInstructions('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  }, [program.id, instructions]);

  // Generate full program draft
  const handleGenerateFullDraft = useCallback(async () => {
    setIsGenerating(true);
    setGeneratingType('full');
    setError(null);

    try {
      const res = await fetch(`/api/os/programs/${program.id}/ai/draft-full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructions: instructions.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate full draft');
      }

      setProposals(prev => [...prev, { proposal: data.proposal, stats: data.stats }]);
      setInstructions('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  }, [program.id, instructions]);

  // Apply proposal
  const handleApply = useCallback(async (proposalId: string, sections?: ProposalType[]) => {
    setIsApplying(proposalId);
    setError(null);

    try {
      const res = await fetch(`/api/os/programs/${program.id}/ai/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply',
          proposalId,
          options: sections ? { sections } : {},
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply');
      }

      // Call parent onApply to sync state
      if (data.program) {
        onApply(data.program);
      }

      // Remove from proposals list
      setProposals(prev => prev.filter(p => p.proposal.id !== proposalId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply');
    } finally {
      setIsApplying(null);
    }
  }, [program.id, onApply]);

  // Reject proposal
  const handleReject = useCallback(async (proposalId: string) => {
    try {
      const res = await fetch(`/api/os/programs/${program.id}/ai/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          proposalId,
        }),
      });

      if (res.ok) {
        setProposals(prev => prev.filter(p => p.proposal.id !== proposalId));
      }
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  }, [program.id]);

  return (
    <div className="border border-purple-500/30 rounded-lg bg-purple-500/5 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-purple-500/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-300">AI Co-planner</span>
          {proposals.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/30 text-purple-300 rounded">
              {proposals.length} pending
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-purple-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-purple-400" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Instructions Input */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Instructions (optional)
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="E.g., 90 days, lean team, focus on email..."
              className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
              rows={2}
              disabled={disabled || isGenerating}
            />
          </div>

          {/* Full Program Draft Button */}
          <button
            onClick={handleGenerateFullDraft}
            disabled={disabled || isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 rounded-lg transition-colors disabled:opacity-50"
          >
            {generatingType === 'full' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating full draft...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Draft full program
              </>
            )}
          </button>

          {/* Scoped Draft Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {DRAFT_TYPES.map(({ type, label, icon }) => (
              <button
                key={type}
                onClick={() => handleGenerateDraft(type)}
                disabled={disabled || isGenerating}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg transition-colors disabled:opacity-50"
              >
                {generatingType === type ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  icon
                )}
                {label}
              </button>
            ))}
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Pending Proposals */}
          {proposals.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Pending Drafts
              </h4>
              {proposals.map(({ proposal, stats }) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  stats={stats}
                  isApplying={isApplying === proposal.id}
                  onApply={(sections) => handleApply(proposal.id, sections)}
                  onReject={() => handleReject(proposal.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Proposal Card Component
// ============================================================================

interface ProposalCardProps {
  proposal: ProgramDraftProposal;
  stats?: ProposalWithStats['stats'];
  isApplying: boolean;
  onApply: (sections?: ProposalType[]) => void;
  onReject: () => void;
}

function ProposalCard({ proposal, stats, isApplying, onApply, onReject }: ProposalCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getTypeLabel = (type: ProposalType): string => {
    const labels: Record<ProposalType, string> = {
      deliverables: 'Deliverables',
      milestones: 'Milestones',
      kpis: 'KPIs',
      risks: 'Risks',
      dependencies: 'Dependencies',
      summary: 'Summary',
      full_program: 'Full Program',
    };
    return labels[type] || type;
  };

  const getItemCount = (): number => {
    const payload = proposal.payload;
    if (Array.isArray(payload)) return payload.length;
    if (proposal.type === 'full_program' && stats) {
      return (stats.deliverables || 0) + (stats.milestones || 0) + (stats.kpis || 0);
    }
    return 0;
  };

  return (
    <div className="bg-slate-800/30 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-400 rounded">
            AI Draft
          </span>
          <span className="text-sm text-white">{getTypeLabel(proposal.type)}</span>
          {getItemCount() > 0 && (
            <span className="text-xs text-slate-500">({getItemCount()} items)</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Preview */}
      {isExpanded && (
        <div className="px-3 py-2 border-t border-slate-700 max-h-60 overflow-y-auto">
          <ProposalPreview proposal={proposal} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-700 bg-slate-800/50">
        <button
          onClick={() => onApply()}
          disabled={isApplying}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded transition-colors disabled:opacity-50"
        >
          {isApplying ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          Apply
        </button>
        <button
          onClick={onReject}
          disabled={isApplying}
          className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Proposal Preview Component
// ============================================================================

function ProposalPreview({ proposal }: { proposal: ProgramDraftProposal }) {
  const payload = proposal.payload;

  if (proposal.type === 'deliverables' && Array.isArray(payload)) {
    return (
      <ul className="space-y-1.5">
        {(payload as ProposedDeliverable[]).map((d, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <span className="text-slate-500">{i + 1}.</span>
            <div>
              <span className="text-white font-medium">{d.title}</span>
              <span className="text-slate-400 ml-1">({d.effort})</span>
              {d.description && (
                <p className="text-slate-500 mt-0.5 line-clamp-2">{d.description}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (proposal.type === 'milestones' && Array.isArray(payload)) {
    return (
      <ul className="space-y-1.5">
        {(payload as ProposedMilestone[]).map((m, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <span className="text-slate-500">{i + 1}.</span>
            <div>
              <span className="text-white font-medium">{m.title}</span>
              {m.targetWeek && (
                <span className="text-slate-400 ml-1">(Week {m.targetWeek})</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (proposal.type === 'kpis' && Array.isArray(payload)) {
    return (
      <ul className="space-y-1.5">
        {(payload as ProposedKPI[]).map((k, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <Target className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-white font-medium">{k.name}</span>
              <span className="text-slate-400 ml-1">→ {k.target}</span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (proposal.type === 'risks' && Array.isArray(payload)) {
    return (
      <ul className="space-y-1.5">
        {(payload as ProposedRisk[]).map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <AlertTriangle className={`w-3 h-3 mt-0.5 shrink-0 ${
              r.impact === 'high' ? 'text-red-400' :
              r.impact === 'med' ? 'text-amber-400' : 'text-slate-400'
            }`} />
            <div>
              <span className="text-white">{r.risk}</span>
              <p className="text-slate-500 mt-0.5">{r.mitigation}</p>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (proposal.type === 'dependencies' && Array.isArray(payload)) {
    return (
      <ul className="space-y-1.5">
        {(payload as ProposedDependency[]).map((d, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <Link2 className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-white">{d.dependency}</span>
              <p className="text-slate-500 mt-0.5">{d.whyNeeded}</p>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (proposal.type === 'full_program') {
    const full = payload as FullProgramDraftPayload;
    return (
      <div className="space-y-3">
        {full.summary && (
          <div>
            <h5 className="text-xs font-medium text-slate-400 mb-1">Summary</h5>
            <p className="text-xs text-white">{full.summary.oneLiner}</p>
          </div>
        )}
        {full.deliverables.length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-slate-400 mb-1">
              Deliverables ({full.deliverables.length})
            </h5>
            <ul className="space-y-0.5">
              {full.deliverables.slice(0, 4).map((d, i) => (
                <li key={i} className="text-xs text-slate-300">• {d.title}</li>
              ))}
              {full.deliverables.length > 4 && (
                <li className="text-xs text-slate-500">
                  +{full.deliverables.length - 4} more
                </li>
              )}
            </ul>
          </div>
        )}
        {full.milestones.length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-slate-400 mb-1">
              Milestones ({full.milestones.length})
            </h5>
            <ul className="space-y-0.5">
              {full.milestones.slice(0, 3).map((m, i) => (
                <li key={i} className="text-xs text-slate-300">• {m.title}</li>
              ))}
            </ul>
          </div>
        )}
        {full.kpis.length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-slate-400 mb-1">
              KPIs ({full.kpis.length})
            </h5>
            <ul className="space-y-0.5">
              {full.kpis.map((k, i) => (
                <li key={i} className="text-xs text-slate-300">• {k.name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Fallback: JSON preview
  return (
    <pre className="text-xs text-slate-400 overflow-x-auto">
      {JSON.stringify(payload, null, 2).slice(0, 500)}
    </pre>
  );
}

export default AICoPlannerPanel;
