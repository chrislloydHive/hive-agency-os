'use client';

// components/os/programs/ProgramsSection.tsx
// Programs Section for Deliver Page
//
// Shows Planning Programs for a strategy with status management and commit actions.

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  CheckCircle2,
  Play,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Circle,
  FileText,
  Target,
  Calendar,
  Pencil,
  Eye,
  Trash2,
  Plus,
} from 'lucide-react';
import type { PlanningProgram, PlanningProgramStatus } from '@/lib/types/program';
import { PLANNING_PROGRAM_STATUS_LABELS, PLANNING_PROGRAM_STATUS_COLORS } from '@/lib/types/program';
import { ProgramPlanner } from './ProgramPlanner';

// ============================================================================
// Readiness Checklist
// ============================================================================

interface ReadinessCheckItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  check: (program: PlanningProgram) => boolean;
  required: boolean;
}

const READINESS_CHECKS: ReadinessCheckItem[] = [
  {
    id: 'summary',
    label: 'Program intent defined',
    description: 'A clear summary of what this program will deliver',
    icon: <FileText className="w-3 h-3" />,
    check: (p) => !!(p.scope.summary && p.scope.summary.trim().length > 10),
    required: true,
  },
  {
    id: 'deliverables',
    label: 'At least one deliverable',
    description: 'Define what outputs this program will produce',
    icon: <Target className="w-3 h-3" />,
    check: (p) => p.scope.deliverables.length > 0,
    required: true,
  },
  {
    id: 'milestones',
    label: 'At least one milestone',
    description: 'Break the program into trackable checkpoints',
    icon: <Calendar className="w-3 h-3" />,
    check: (p) => p.planDetails.milestones.length > 0,
    required: true,
  },
  {
    id: 'owner',
    label: 'Owner assigned',
    description: 'Someone responsible for the program',
    icon: <CheckCircle2 className="w-3 h-3" />,
    check: (p) => !!(p.planDetails.owner && p.planDetails.owner.trim().length > 0),
    required: true,
  },
];

function computeReadiness(program: PlanningProgram): {
  items: Array<ReadinessCheckItem & { passed: boolean }>;
  score: number;
  requiredPassed: boolean;
} {
  const items = READINESS_CHECKS.map((check) => ({
    ...check,
    passed: check.check(program),
  }));

  const passedCount = items.filter((i) => i.passed).length;
  const score = Math.round((passedCount / items.length) * 100);
  const requiredPassed = items.filter((i) => i.required).every((i) => i.passed);

  return { items, score, requiredPassed };
}

function ReadinessChecklist({ program }: { program: PlanningProgram }) {
  const [expanded, setExpanded] = useState(false);
  const { items, score, requiredPassed } = computeReadiness(program);

  // Only show for draft programs
  if (program.status !== 'draft') return null;

  return (
    <div className="mt-3 border-t border-slate-700/50 pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-300 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">Readiness</span>
          <div className="flex items-center gap-1">
            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  requiredPassed ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="text-[10px]">{score}%</span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-2 text-xs p-1.5 rounded ${
                item.passed
                  ? 'text-slate-400'
                  : item.required
                  ? 'text-amber-400 bg-amber-500/5'
                  : 'text-slate-500'
              }`}
            >
              <div className="mt-0.5">
                {item.passed ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Circle className="w-3 h-3" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  {item.icon}
                  <span className={item.passed ? 'line-through opacity-60' : ''}>
                    {item.label}
                  </span>
                  {item.required && !item.passed && (
                    <span className="text-[9px] px-1 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                      Required
                    </span>
                  )}
                </div>
                {!item.passed && (
                  <p className="text-[10px] text-slate-600 mt-0.5">{item.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Types
// ============================================================================

interface ProgramsSectionProps {
  companyId: string;
  strategyId: string | null;
  focusedProgramId?: string | null;
  onProgramCommitted?: (programId: string, workItemIds: string[]) => void;
  onProgramsChange?: (programs: PlanningProgram[]) => void;
}

interface ProgramCardProps {
  program: PlanningProgram;
  companyId: string;
  isFocused?: boolean;
  isExpanded?: boolean;
  onExpand?: () => void;
  onStatusChange?: (program: PlanningProgram) => void;
  onCommit?: (programId: string, workItemIds: string[]) => void;
  onUpdate?: (programId: string, updates: Partial<PlanningProgram>) => Promise<void>;
  onDelete?: (programId: string) => void;
  onWorkCreated?: (programId: string, workItemIds: string[]) => void;
}

// ============================================================================
// Program Card Component
// ============================================================================

function ProgramCard({ program, companyId, isFocused, isExpanded, onExpand, onStatusChange, onCommit, onUpdate, onDelete, onWorkCreated }: ProgramCardProps) {
  const router = useRouter();
  const [isCommitting, setIsCommitting] = useState(false);
  const [isCreatingWork, setIsCreatingWork] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Scroll into view when focused
  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isFocused]);

  const { requiredPassed } = computeReadiness(program);
  const statusColor = PLANNING_PROGRAM_STATUS_COLORS[program.status] || 'slate';
  const statusLabel = PLANNING_PROGRAM_STATUS_LABELS[program.status] || program.status;

  const handleMarkReady = async () => {
    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/programs/${program.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update status');
      }

      const data = await response.json();
      onStatusChange?.(data.program);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCommit = async () => {
    setIsCommitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/programs/${program.id}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to commit program');
      }

      const data = await response.json();
      onCommit?.(program.id, data.workItemIds || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit failed');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${program.title}"? This will archive the program.`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/programs/${program.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete program');
      }

      onDelete?.(program.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Create Work from a committed program that has no work items yet.
   * Calls the commit API with resync: true to materialize work items,
   * then navigates to the Work page.
   */
  const handleCreateWork = async () => {
    setIsCreatingWork(true);
    setError(null);

    try {
      console.log('[ProgramCard] Creating work for program:', program.id);

      const response = await fetch(`/api/os/programs/${program.id}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resync: true }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create work');
      }

      const data = await response.json();
      const workItemIds = data.workItemIds || [];

      console.log('[ProgramCard] Work created:', {
        programId: program.id,
        workItemCount: workItemIds.length,
        counts: data.counts,
      });

      // Notify parent of work creation
      onWorkCreated?.(program.id, workItemIds);

      // Update local program state
      onStatusChange?.({
        ...program,
        commitment: { ...program.commitment, workItemIds },
      });

      // Navigate to Work page filtered by this program
      router.push(`/c/${companyId}/work?programId=${program.id}`);
    } catch (err) {
      console.error('[ProgramCard] Create work failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to create work');
    } finally {
      setIsCreatingWork(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`bg-slate-900/50 border rounded-lg p-4 transition-all ${
        isFocused
          ? 'border-purple-500 ring-2 ring-purple-500/30'
          : 'border-slate-800/50'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white truncate">{program.title}</h3>
          {program.origin.tacticTitle && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              From: {program.origin.tacticTitle}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
            {program.scope.summary || 'No description'}
          </p>
        </div>

        {/* Status Badge */}
        <span
          className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-${statusColor}-500/20 text-${statusColor}-400 border border-${statusColor}-500/30`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Deliverables Count */}
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span>{program.scope.deliverables.length} deliverables</span>
        <span>{program.planDetails.milestones.length} milestones</span>
        {program.scope.workstreams.length > 0 && (
          <span>{program.scope.workstreams.join(', ')}</span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {/* Draft: Open Planner or Mark Ready */}
        {program.status === 'draft' && (
          <>
            <button
              onClick={onExpand}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-md transition-colors"
            >
              <Pencil className="w-3 h-3" />
              {isExpanded ? 'Close Planner' : 'Open Planner'}
            </button>
            {requiredPassed && !isExpanded && (
              <button
                onClick={handleMarkReady}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-md transition-colors disabled:opacity-50"
              >
                {isUpdating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3 h-3" />
                )}
                Mark Ready
              </button>
            )}
          </>
        )}

        {/* Ready: Start execution or Edit */}
        {program.status === 'ready' && (
          <>
            <button
              onClick={handleCommit}
              disabled={isCommitting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-md transition-colors disabled:opacity-50"
            >
              {isCommitting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Start execution
            </button>
            <button
              onClick={onExpand}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md transition-colors"
            >
              <Pencil className="w-3 h-3" />
              {isExpanded ? 'Close' : 'Edit'}
            </button>
          </>
        )}

        {/* Committed: View Work or Create Work */}
        {program.status === 'committed' && (
          <>
            {(program.commitment.workItemIds?.length || 0) > 0 ? (
              <a
                href={`/c/${companyId}/work?programId=${program.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-md transition-colors"
              >
                <Eye className="w-3 h-3" />
                View Work ({program.commitment.workItemIds?.length})
              </a>
            ) : (
              <button
                onClick={handleCreateWork}
                disabled={isCreatingWork}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-md transition-colors disabled:opacity-50"
              >
                {isCreatingWork ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                {isCreatingWork ? 'Creating...' : 'Create Work'}
              </button>
            )}
            <button
              onClick={onExpand}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md transition-colors"
            >
              <ChevronRight className="w-3 h-3" />
              {isExpanded ? 'Hide Details' : 'View Details'}
            </button>
          </>
        )}

        {/* Delete button - available for all statuses */}
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50 ml-auto"
          title="Delete program"
        >
          {isDeleting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Trash2 className="w-3 h-3" />
          )}
        </button>
      </div>

      {/* Readiness Checklist (for draft programs, when not expanded) */}
      {!isExpanded && <ReadinessChecklist program={program} />}

      {/* Zero work items helper (for committed programs) */}
      {program.status === 'committed' && (program.commitment.workItemIds?.length || 0) === 0 && !isExpanded && (
        <p className="mt-3 text-xs text-slate-500 italic">
          No work created yet. Next step: create your first work item.
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md p-2">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Expanded Planner (inline below card content) */}
      {isExpanded && onUpdate && (
        <div className="mt-4 border-t border-slate-700 pt-4">
          <ProgramPlanner
            program={program}
            companyId={companyId}
            onUpdate={async (updates) => {
              await onUpdate(program.id, updates);
            }}
            onClose={() => onExpand?.()}
            onStatusChange={(updated) => onStatusChange?.(updated)}
            onCommit={(programId, workItemIds) => onCommit?.(programId, workItemIds)}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Programs Section Component
// ============================================================================

export function ProgramsSection({ companyId, strategyId, focusedProgramId, onProgramCommitted, onProgramsChange }: ProgramsSectionProps) {
  const [programs, setPrograms] = useState<PlanningProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
  const [archivedExpanded, setArchivedExpanded] = useState(false);

  // Use ref to avoid re-render loops with callback
  const onProgramsChangeRef = useRef(onProgramsChange);
  onProgramsChangeRef.current = onProgramsChange;

  const fetchPrograms = useCallback(async () => {
    if (!strategyId) {
      setPrograms([]);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/${strategyId}/programs`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error('Failed to load programs');
      }

      const data = await response.json();
      const fetchedPrograms = data.programs || [];
      setPrograms(fetchedPrograms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load programs');
    } finally {
      setLoading(false);
    }
  }, [companyId, strategyId]);

  // Notify parent when programs change (separate effect to avoid render-during-render)
  useEffect(() => {
    onProgramsChangeRef.current?.(programs);
  }, [programs]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  const handleStatusChange = (updatedProgram: PlanningProgram) => {
    setPrograms((prev) =>
      prev.map((p) => (p.id === updatedProgram.id ? updatedProgram : p))
    );
  };

  const handleCommit = (programId: string, workItemIds: string[]) => {
    // Update local state (parent notified via useEffect on programs change)
    setPrograms((prev) =>
      prev.map((p) =>
        p.id === programId
          ? {
              ...p,
              status: 'committed' as PlanningProgramStatus,
              commitment: { ...p.commitment, workItemIds },
            }
          : p
      )
    );
    // Notify parent
    onProgramCommitted?.(programId, workItemIds);
    // Close the expanded planner
    setExpandedProgramId(null);
  };

  const handleToggleExpand = (programId: string) => {
    setExpandedProgramId(prev => prev === programId ? null : programId);
  };

  const handleUpdate = async (programId: string, updates: Partial<PlanningProgram>) => {
    try {
      const response = await fetch(`/api/os/programs/${programId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update program');
      }

      const data = await response.json();
      handleStatusChange(data.program);
    } catch (err) {
      console.error('Failed to update program:', err);
      throw err;
    }
  };

  const handleDelete = (programId: string) => {
    // Remove program from local state
    setPrograms((prev) => prev.filter((p) => p.id !== programId));
  };

  if (!strategyId) {
    return (
      <div className="bg-slate-900/30 border border-slate-800/50 rounded-lg p-6">
        <p className="text-sm text-slate-500 text-center">
          Create a strategy first to manage programs.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={fetchPrograms}
              className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state: render nothing (parent owns the CTA affordance)
  // The #programs anchor is provided by the parent wrapper
  if (programs.length === 0) {
    return null;
  }

  // Group programs by status
  const draftPrograms = programs.filter((p) => p.status === 'draft');
  const readyPrograms = programs.filter((p) => p.status === 'ready');
  const committedPrograms = programs.filter((p) => p.status === 'committed');
  const archivedPrograms = programs.filter((p) => p.status === 'archived');
  const otherPrograms = programs.filter(
    (p) => !['draft', 'ready', 'committed', 'archived'].includes(p.status)
  );

  return (
    <div className="space-y-6">
      {/* Active Programs - PRIMARY, shown first */}
      {committedPrograms.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            Active Programs ({committedPrograms.length})
          </h3>
          {committedPrograms.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              companyId={companyId}
              isFocused={focusedProgramId === program.id}
              isExpanded={expandedProgramId === program.id}
              onExpand={() => handleToggleExpand(program.id)}
              onStatusChange={handleStatusChange}
              onCommit={handleCommit}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Ready Programs - ready to start execution */}
      {readyPrograms.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            Ready to Start ({readyPrograms.length})
          </h3>
          {readyPrograms.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              companyId={companyId}
              isFocused={focusedProgramId === program.id}
              isExpanded={expandedProgramId === program.id}
              onExpand={() => handleToggleExpand(program.id)}
              onStatusChange={handleStatusChange}
              onCommit={handleCommit}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Draft Programs - still being planned */}
      {draftPrograms.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Planning ({draftPrograms.length})
          </h3>
          {draftPrograms.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              companyId={companyId}
              isFocused={focusedProgramId === program.id}
              isExpanded={expandedProgramId === program.id}
              onExpand={() => handleToggleExpand(program.id)}
              onStatusChange={handleStatusChange}
              onCommit={handleCommit}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Other Programs (paused, etc) */}
      {otherPrograms.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Other ({otherPrograms.length})
          </h3>
          {otherPrograms.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              companyId={companyId}
              isFocused={focusedProgramId === program.id}
              isExpanded={expandedProgramId === program.id}
              onExpand={() => handleToggleExpand(program.id)}
              onStatusChange={handleStatusChange}
              onCommit={handleCommit}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Archived Programs - collapsed by default */}
      {archivedPrograms.length > 0 && (
        <div className="border-t border-slate-800/50 pt-4">
          <button
            onClick={() => setArchivedExpanded(!archivedExpanded)}
            className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-500 transition-colors"
          >
            {archivedExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <span className="uppercase tracking-wider">
              Archived ({archivedPrograms.length})
            </span>
          </button>
          {archivedExpanded && (
            <div className="mt-3 space-y-3 opacity-60">
              {archivedPrograms.map((program) => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  companyId={companyId}
                  isFocused={focusedProgramId === program.id}
                  isExpanded={expandedProgramId === program.id}
                  onExpand={() => handleToggleExpand(program.id)}
                  onStatusChange={handleStatusChange}
                  onCommit={handleCommit}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
