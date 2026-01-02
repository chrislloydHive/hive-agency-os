'use client';

// components/os/programs/ProgramPlanner.tsx
// Program Planner - Full planning surface for designing Programs
//
// Turns Programs into concrete, confidence-building plans with:
// - Program Intent (goal, success metrics, owner)
// - Deliverables (what outputs will be produced)
// - Milestones (checkpoints for progress)
// - Constraints & Assumptions (context and risks)
// - Readiness Gate (enforces completion before execution)
//
// Strategy → Tactic → Program → Work traceability preserved

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  Circle,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Target,
  Lightbulb,
  User,
  FileText,
  Calendar,
  Flag,
  Play,
  ExternalLink,
  Sparkles,
  DollarSign,
  Radio,
  Eye,
  RefreshCw,
} from 'lucide-react';
import type {
  PlanningProgram,
  PlanningProgramStatus,
  PlanningDeliverable,
  PlanningMilestone,
  PlanningProgramKPI,
} from '@/lib/types/program';
import {
  generatePlanningDeliverableId,
  generatePlanningMilestoneId,
  WORKSTREAM_LABELS,
} from '@/lib/types/program';
import {
  computeProgramReadiness,
  getReadinessStatusLabel,
  getMissingItemLabel,
  getAIFillableMissing,
  canCommitFromReadiness,
  type ProgramReadiness,
} from '@/lib/os/programs/programReadiness';
import { AICoPlannerPanel } from './AICoPlannerPanel';
import { ExecutionStatusPanel } from './ExecutionStatusPanel';
import { ProgramOutputsPanel } from './ProgramOutputsPanel';
import { ProgramLearningsPanel } from './ProgramLearningsPanel';
import { ServiceCoveragePanel } from './ServiceCoveragePanel';
import { ArtifactPickerModal } from './ArtifactPickerModal';
import { IntensitySelector } from './IntensitySelector';
import type { Artifact } from '@/lib/types/artifact';
import type { ProgramArtifactLinkType } from '@/lib/types/program';
import { createProgramArtifactLink } from '@/lib/types/program';
import type { IntensityLevel } from '@/lib/types/programTemplate';

// ============================================================================
// Types
// ============================================================================

interface ProgramPlannerProps {
  program: PlanningProgram;
  companyId: string;
  onUpdate: (updates: Partial<PlanningProgram>) => Promise<void>;
  onClose: () => void;
  onStatusChange: (program: PlanningProgram) => void;
  onCommit: (programId: string, workItemIds: string[]) => void;
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: PlanningProgramStatus }) {
  const config: Record<PlanningProgramStatus, { bg: string; text: string; border: string }> = {
    draft: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' },
    ready: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
    committed: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    paused: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
    archived: { bg: 'bg-slate-500/20', text: 'text-slate-500', border: 'border-slate-500/30' },
  };

  const statusLabel: Record<PlanningProgramStatus, string> = {
    draft: 'Draft',
    ready: 'Ready',
    committed: 'In execution',
    paused: 'Paused',
    archived: 'Archived',
  };

  const { bg, text, border } = config[status] || config.draft;

  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${bg} ${text} border ${border}`}>
      {statusLabel[status]}
    </span>
  );
}

// ============================================================================
// Section Header Component
// ============================================================================

interface SectionHeaderProps {
  title: string;
  icon: React.ReactNode;
  required?: boolean;
  completed?: boolean;
  count?: number;
  children?: React.ReactNode;
}

function SectionHeader({ title, icon, required, completed, count, children }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${completed ? 'bg-emerald-500/10' : 'bg-slate-800'}`}>
          {icon}
        </div>
        <h3 className="text-sm font-medium text-white">{title}</h3>
        {count !== undefined && (
          <span className="text-xs text-slate-500">({count})</span>
        )}
        {required && !completed && (
          <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">
            Required
          </span>
        )}
        {completed && (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        )}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// Collapsible Section Component
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-slate-800">
            {icon}
          </div>
          <span className="text-sm font-medium text-slate-300">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-800">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Execution Confirmation Modal
// ============================================================================

interface ExecutionModalProps {
  program: PlanningProgram;
  isOpen: boolean;
  isCommitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function ExecutionModal({ program, isOpen, isCommitting, onClose, onConfirm }: ExecutionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-500/20 rounded-lg">
            <Play className="w-6 h-6 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">
              Start Execution
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Starting execution will create trackable work items from this Program.
              You can pause or adjust later.
            </p>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-4">
              <p className="text-xs text-slate-500 mb-1">Program</p>
              <p className="text-sm font-medium text-white">{program.title}</p>
              <p className="text-xs text-slate-500 mt-2">Will create</p>
              <p className="text-sm text-slate-300">
                {program.scope.deliverables.length} deliverable{program.scope.deliverables.length !== 1 ? 's' : ''} as work items
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-2">
          <button
            onClick={onClose}
            disabled={isCommitting}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isCommitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50"
          >
            {isCommitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start execution
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Resync Modal Component
// ============================================================================

type SyncMode = 'additive' | 'update' | 'full';

interface ResyncModalProps {
  isOpen: boolean;
  isResyncing: boolean;
  selectedMode: SyncMode;
  onModeChange: (mode: SyncMode) => void;
  onClose: () => void;
  onConfirm: () => void;
}

function ResyncModal({
  isOpen,
  isResyncing,
  selectedMode,
  onModeChange,
  onClose,
  onConfirm,
}: ResyncModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-purple-500/20 rounded-lg">
            <RefreshCw className="w-6 h-6 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-1">
              Re-sync Work Items
            </h3>
            <p className="text-sm text-slate-400">
              Choose how to synchronize program changes with existing work items.
            </p>
          </div>
        </div>

        {/* Sync Mode Options */}
        <div className="space-y-2 mb-6">
          {/* Additive Option */}
          <button
            onClick={() => onModeChange('additive')}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              selectedMode === 'additive'
                ? 'bg-emerald-500/10 border-emerald-500/50'
                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  selectedMode === 'additive' ? 'border-emerald-400' : 'border-slate-600'
                }`}
              >
                {selectedMode === 'additive' && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${selectedMode === 'additive' ? 'text-white' : 'text-slate-300'}`}>
                    Add New Only
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Creates new work items for new deliverables. Never modifies or removes existing items. Safe for preserving manual edits.
                </p>
              </div>
            </div>
          </button>

          {/* Update Option */}
          <button
            onClick={() => onModeChange('update')}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              selectedMode === 'update'
                ? 'bg-amber-500/10 border-amber-500/50'
                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  selectedMode === 'update' ? 'border-amber-400' : 'border-slate-600'
                }`}
              >
                {selectedMode === 'update' && <div className="w-2 h-2 rounded-full bg-amber-400" />}
              </div>
              <div className="flex-1">
                <span className={`text-sm font-medium ${selectedMode === 'update' ? 'text-white' : 'text-slate-300'}`}>
                  Add & Update
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Creates new items and updates existing ones to match program changes. Never removes items.
                </p>
              </div>
            </div>
          </button>

          {/* Full Option */}
          <button
            onClick={() => onModeChange('full')}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              selectedMode === 'full'
                ? 'bg-red-500/10 border-red-500/50'
                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  selectedMode === 'full' ? 'border-red-400' : 'border-slate-600'
                }`}
              >
                {selectedMode === 'full' && <div className="w-2 h-2 rounded-full bg-red-400" />}
              </div>
              <div className="flex-1">
                <span className={`text-sm font-medium ${selectedMode === 'full' ? 'text-white' : 'text-slate-300'}`}>
                  Full Sync
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete synchronization. Creates, updates, and marks removed items. May override manual changes.
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isResyncing}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isResyncing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50"
          >
            {isResyncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Re-sync Work
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Readiness Gate Component
// ============================================================================

interface ReadinessGateProps {
  readiness: ProgramReadiness;
  onAIFill?: () => void;
  isFillingMissing?: boolean;
}

function ReadinessGate({ readiness, onAIFill, isFillingMissing }: ReadinessGateProps) {
  const { score, status, reasons, missing } = readiness;
  const aiFillable = getAIFillableMissing(missing);
  const hasAIFillable = aiFillable.length > 0 && onAIFill;

  // Status-based styling
  const statusStyles: Record<typeof status, { border: string; bg: string; icon: string }> = {
    ready: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', icon: 'text-emerald-400' },
    needs_structure: { border: 'border-amber-500/30', bg: 'bg-amber-500/5', icon: 'text-amber-400' },
    not_ready: { border: 'border-slate-700', bg: 'bg-slate-900/50', icon: 'text-slate-400' },
  };

  const style = statusStyles[status];

  return (
    <div className={`border rounded-xl p-4 ${style.border} ${style.bg}`}>
      {/* Header with score */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${status === 'ready' ? 'bg-emerald-500/20' : status === 'needs_structure' ? 'bg-amber-500/20' : 'bg-slate-800'}`}>
            <Flag className={`w-4 h-4 ${style.icon}`} />
          </div>
          <h3 className="text-sm font-medium text-white">Readiness Gate</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            status === 'ready'
              ? 'bg-emerald-500/20 text-emerald-400'
              : status === 'needs_structure'
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-slate-700 text-slate-400'
          }`}>
            {getReadinessStatusLabel(status)}
          </span>
        </div>

        {/* Score indicator */}
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500">Score</div>
          <div className={`text-sm font-mono font-medium ${
            score >= 65 ? 'text-emerald-400' : score >= 30 ? 'text-amber-400' : 'text-slate-400'
          }`}>
            {score}%
          </div>
        </div>
      </div>

      {/* Score progress bar */}
      <div className="h-1.5 bg-slate-800 rounded-full mb-4 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            score >= 65 ? 'bg-emerald-500' : score >= 30 ? 'bg-amber-500' : 'bg-slate-600'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* What's missing section */}
      {missing.length > 0 && status !== 'ready' && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-400 mb-2">What&apos;s missing:</p>
          <div className="space-y-1.5">
            {missing.map(item => (
              <div key={item} className="flex items-center gap-2">
                <Circle className="w-3 h-3 text-slate-600" />
                <span className="text-sm text-slate-300">{getMissingItemLabel(item)}</span>
                {aiFillable.includes(item) && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                    AI can fill
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reasons (informational) */}
      {reasons.length > 0 && (
        <div className="space-y-1 mb-4">
          {reasons.map((reason, i) => (
            <p key={i} className="text-xs text-slate-500">{reason}</p>
          ))}
        </div>
      )}

      {/* AI Fill Missing button */}
      {hasAIFillable && status === 'needs_structure' && (
        <button
          onClick={onAIFill}
          disabled={isFillingMissing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-colors disabled:opacity-50"
        >
          {isFillingMissing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Filling missing pieces...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              AI: Fill Missing Pieces
            </>
          )}
        </button>
      )}

      {/* Ready state encouragement */}
      {status === 'ready' && (
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm">Ready to commit to work</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Media Plan Scaffold (for paid_media workstream)
// ============================================================================

interface MediaPlanScaffoldProps {
  program: PlanningProgram;
}

function MediaPlanScaffold({ program }: MediaPlanScaffoldProps) {
  // Only show for paid_media workstream
  const hasPaidMedia = program.scope.workstreams.includes('paid_media');
  if (!hasPaidMedia) return null;

  return (
    <CollapsibleSection
      title="Media Plan"
      icon={<Radio className="w-4 h-4 text-purple-400" />}
    >
      <div className="space-y-4">
        {/* Channel Mix */}
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Channel Mix</p>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <p className="text-sm text-slate-500 italic">
              Channel allocation will be defined during execution
            </p>
          </div>
        </div>

        {/* Budget */}
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Budget</p>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-500">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm">Budget to be determined</span>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Media KPIs</p>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Target className="w-3.5 h-3.5" />
              <span>Impressions</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Target className="w-3.5 h-3.5" />
              <span>Click-through rate</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Target className="w-3.5 h-3.5" />
              <span>Cost per acquisition</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600">
          This is a planning scaffold. Media execution details will be added when the program starts.
        </p>
      </div>
    </CollapsibleSection>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProgramPlanner({
  program,
  companyId,
  onUpdate,
  onClose,
  onStatusChange,
  onCommit,
}: ProgramPlannerProps) {
  // Local state for editing
  const [localProgram, setLocalProgram] = useState<PlanningProgram>(program);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [isFillingMissing, setIsFillingMissing] = useState(false);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [showResyncModal, setShowResyncModal] = useState(false);
  const [selectedSyncMode, setSelectedSyncMode] = useState<'additive' | 'update' | 'full'>('additive');
  const [showArtifactPicker, setShowArtifactPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce ref for auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local state with prop
  useEffect(() => {
    setLocalProgram(program);
  }, [program]);

  // Is program read-only (committed)?
  const isReadOnly = program.status === 'committed';

  // Compute readiness using the scoring function
  const readiness = useMemo(() => computeProgramReadiness(localProgram), [localProgram]);
  const canMarkReady = canCommitFromReadiness(readiness);

  // Auto-save with debounce
  const debouncedSave = useCallback(async (updates: Partial<PlanningProgram>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      setError(null);
      try {
        await onUpdate(updates);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setIsSaving(false);
      }
    }, 500);
  }, [onUpdate]);

  // Update local state and trigger auto-save
  const handleUpdate = useCallback((updates: Partial<PlanningProgram>) => {
    setLocalProgram(prev => {
      const updated = { ...prev, ...updates };
      debouncedSave(updates);
      return updated;
    });
  }, [debouncedSave]);

  // Update scope
  const handleScopeUpdate = useCallback((scopeUpdates: Partial<typeof localProgram.scope>) => {
    handleUpdate({
      scope: { ...localProgram.scope, ...scopeUpdates }
    });
  }, [localProgram.scope, handleUpdate]);

  // Update plan details
  const handlePlanUpdate = useCallback((planUpdates: Partial<typeof localProgram.planDetails>) => {
    handleUpdate({
      planDetails: { ...localProgram.planDetails, ...planUpdates }
    });
  }, [localProgram.planDetails, handleUpdate]);

  // Update success metrics
  const handleSuccessUpdate = useCallback((successUpdates: Partial<typeof localProgram.success>) => {
    handleUpdate({
      success: { ...localProgram.success, ...successUpdates }
    });
  }, [localProgram.success, handleUpdate]);

  // Add deliverable
  const handleAddDeliverable = useCallback(() => {
    const newDeliverable: PlanningDeliverable = {
      id: generatePlanningDeliverableId(),
      title: '',
      type: 'other',
      status: 'planned',
    };
    handleScopeUpdate({
      deliverables: [...localProgram.scope.deliverables, newDeliverable]
    });
  }, [localProgram.scope.deliverables, handleScopeUpdate]);

  // Update deliverable
  const handleUpdateDeliverable = useCallback((id: string, updates: Partial<PlanningDeliverable>) => {
    const updated = localProgram.scope.deliverables.map(d =>
      d.id === id ? { ...d, ...updates } : d
    );
    handleScopeUpdate({ deliverables: updated });
  }, [localProgram.scope.deliverables, handleScopeUpdate]);

  // Remove deliverable
  const handleRemoveDeliverable = useCallback((id: string) => {
    const filtered = localProgram.scope.deliverables.filter(d => d.id !== id);
    handleScopeUpdate({ deliverables: filtered });
  }, [localProgram.scope.deliverables, handleScopeUpdate]);

  // Add milestone
  const handleAddMilestone = useCallback(() => {
    const newMilestone: PlanningMilestone = {
      id: generatePlanningMilestoneId(),
      title: '',
      status: 'pending',
    };
    handlePlanUpdate({
      milestones: [...localProgram.planDetails.milestones, newMilestone]
    });
  }, [localProgram.planDetails.milestones, handlePlanUpdate]);

  // Update milestone
  const handleUpdateMilestone = useCallback((id: string, updates: Partial<PlanningMilestone>) => {
    const updated = localProgram.planDetails.milestones.map(m =>
      m.id === id ? { ...m, ...updates } : m
    );
    handlePlanUpdate({ milestones: updated });
  }, [localProgram.planDetails.milestones, handlePlanUpdate]);

  // Remove milestone
  const handleRemoveMilestone = useCallback((id: string) => {
    const filtered = localProgram.planDetails.milestones.filter(m => m.id !== id);
    handlePlanUpdate({ milestones: filtered });
  }, [localProgram.planDetails.milestones, handlePlanUpdate]);

  // Toggle milestone completion
  const handleToggleMilestone = useCallback((id: string) => {
    const milestone = localProgram.planDetails.milestones.find(m => m.id === id);
    if (milestone) {
      const newStatus = milestone.status === 'completed' ? 'pending' : 'completed';
      handleUpdateMilestone(id, { status: newStatus });
    }
  }, [localProgram.planDetails.milestones, handleUpdateMilestone]);

  // Add KPI
  const handleAddKPI = useCallback(() => {
    const newKPI: PlanningProgramKPI = {
      key: `kpi_${Date.now()}`,
      label: '',
    };
    handleSuccessUpdate({
      kpis: [...localProgram.success.kpis, newKPI]
    });
  }, [localProgram.success.kpis, handleSuccessUpdate]);

  // Update KPI
  const handleUpdateKPI = useCallback((key: string, updates: Partial<PlanningProgramKPI>) => {
    const updated = localProgram.success.kpis.map(k =>
      k.key === key ? { ...k, ...updates } : k
    );
    handleSuccessUpdate({ kpis: updated });
  }, [localProgram.success.kpis, handleSuccessUpdate]);

  // Remove KPI
  const handleRemoveKPI = useCallback((key: string) => {
    const filtered = localProgram.success.kpis.filter(k => k.key !== key);
    handleSuccessUpdate({ kpis: filtered });
  }, [localProgram.success.kpis, handleSuccessUpdate]);

  // Mark Ready
  const handleMarkReady = useCallback(async () => {
    if (!canMarkReady) return;

    setIsUpdatingStatus(true);
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
      onStatusChange(data.program);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [canMarkReady, program.id, onStatusChange]);

  // Start Execution (commit)
  const handleCommit = useCallback(async () => {
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
      setShowExecutionModal(false);
      onCommit(program.id, data.workItemIds || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit failed');
    } finally {
      setIsCommitting(false);
    }
  }, [program.id, onCommit]);

  // Re-sync work items (for committed programs)
  const handleResync = useCallback(async (syncMode: 'additive' | 'update' | 'full') => {
    setIsResyncing(true);
    setError(null);
    setShowResyncModal(false);

    try {
      const response = await fetch(`/api/os/programs/${program.id}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resync: true, syncMode }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to resync');
      }

      const data = await response.json();
      // Refresh the program data
      onStatusChange(data.program);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resync failed');
    } finally {
      setIsResyncing(false);
    }
  }, [program.id, onStatusChange]);

  // AI Fill Missing - generate only missing sections
  const handleAIFillMissing = useCallback(async () => {
    const aiFillable = getAIFillableMissing(readiness.missing);
    if (aiFillable.length === 0) return;

    setIsFillingMissing(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/programs/${program.id}/ai/fill-missing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missing: aiFillable }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fill missing pieces');
      }

      const data = await response.json();
      // Update local program with the filled data
      if (data.program) {
        setLocalProgram(data.program);
        onStatusChange(data.program);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI fill failed');
    } finally {
      setIsFillingMissing(false);
    }
  }, [program.id, readiness.missing, onStatusChange]);

  // Handle linking an artifact to the program
  const handleLinkArtifact = useCallback(async (artifact: Artifact, linkType: ProgramArtifactLinkType) => {
    try {
      const response = await fetch(`/api/os/programs/${program.id}/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifactId: artifact.id,
          artifactTitle: artifact.title,
          artifactType: artifact.type,
          artifactStatus: artifact.status,
          linkType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to link artifact');
      }

      // Refresh program data via onUpdate
      const newLink = createProgramArtifactLink(
        artifact.id,
        artifact.title,
        artifact.type,
        artifact.status,
        linkType
      );
      const updatedArtifacts = [...(localProgram.linkedArtifacts || []), newLink];
      setLocalProgram(prev => ({ ...prev, linkedArtifacts: updatedArtifacts }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link artifact');
      throw err;
    }
  }, [program.id, localProgram.linkedArtifacts]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* ================================================================== */}
      {/* Header */}
      {/* ================================================================== */}
      <div className="bg-slate-800/50 border-b border-slate-700 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Title */}
            <div className="flex items-center gap-3 mb-2">
              <input
                type="text"
                value={localProgram.title}
                onChange={(e) => handleUpdate({ title: e.target.value })}
                disabled={isReadOnly}
                className="text-lg font-semibold text-white bg-transparent border-0 border-b border-transparent hover:border-slate-600 focus:border-purple-500 focus:outline-none transition-colors px-0 py-1 w-full disabled:opacity-70"
                placeholder="Program name..."
              />
              <StatusBadge status={localProgram.status} />
            </div>

            {/* Source Tactic */}
            {localProgram.origin.tacticTitle && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>From tactic:</span>
                <Link
                  href={`/c/${companyId}/strategy?focus=tactics`}
                  className="text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                >
                  {localProgram.origin.tacticTitle}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}

            {/* Workstreams and Intensity */}
            <div className="flex items-center gap-3 mt-2">
              {localProgram.scope.workstreams.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {localProgram.scope.workstreams.map(ws => (
                    <span
                      key={ws}
                      className="px-2 py-0.5 text-[10px] font-medium bg-slate-700/50 text-slate-400 rounded"
                    >
                      {WORKSTREAM_LABELS[ws] || ws}
                    </span>
                  ))}
                </div>
              )}

              {/* Intensity Selector */}
              {localProgram.intensity && (
                <IntensitySelector
                  programId={program.id}
                  programTitle={program.title}
                  currentIntensity={localProgram.intensity as IntensityLevel}
                  isDisabled={localProgram.status === 'archived'}
                  onIntensityChange={(newIntensity) => {
                    // Update local state and trigger refresh
                    setLocalProgram(prev => ({ ...prev, intensity: newIntensity }));
                  }}
                />
              )}
            </div>
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Save indicator */}
            {isSaving && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </span>
            )}

            {/* Draft → Mark Ready */}
            {localProgram.status === 'draft' && (
              <button
                onClick={handleMarkReady}
                disabled={!canMarkReady || isUpdatingStatus}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={!canMarkReady ? 'Complete all required fields first' : undefined}
              >
                {isUpdatingStatus ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Mark Ready
              </button>
            )}

            {/* Ready → Commit to Work */}
            {localProgram.status === 'ready' && (
              <button
                onClick={() => setShowExecutionModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
              >
                <Play className="w-4 h-4" />
                Commit to Work
              </button>
            )}

            {/* Committed → Re-sync Work and View Work */}
            {localProgram.status === 'committed' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowResyncModal(true)}
                  disabled={isResyncing}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isResyncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Re-sync Work
                </button>
                <Link
                  href={`/c/${companyId}/work?programId=${program.id}`}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View Work
                  <span className="text-xs opacity-70">
                    ({program.commitment.workItemIds?.length || 0})
                  </span>
                </Link>
              </div>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* Body */}
      {/* ================================================================== */}
      <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* ============================================================== */}
        {/* Service Coverage (Show when AI planning has been done) */}
        {/* ============================================================== */}
        {localProgram.serviceCoverage && (
          localProgram.serviceCoverage.servicesUsed.length > 0 ||
          localProgram.serviceCoverage.gaps.length > 0
        ) && (
          <ServiceCoveragePanel serviceCoverage={localProgram.serviceCoverage} />
        )}

        {/* ============================================================== */}
        {/* Execution Status (Committed Programs Only) */}
        {/* ============================================================== */}
        {localProgram.status === 'committed' && (
          <ExecutionStatusPanel programId={program.id} companyId={companyId} />
        )}

        {/* ============================================================== */}
        {/* Program Outputs (Committed Programs Only) */}
        {/* ============================================================== */}
        {localProgram.status === 'committed' && (
          <ProgramOutputsPanel
            programId={program.id}
            companyId={companyId}
            onLinkArtifact={() => setShowArtifactPicker(true)}
          />
        )}

        {/* ============================================================== */}
        {/* Program Learnings (Committed Programs Only) */}
        {/* ============================================================== */}
        {localProgram.status === 'committed' && (
          <ProgramLearningsPanel
            programId={program.id}
            companyId={companyId}
          />
        )}

        {/* ============================================================== */}
        {/* Program Intent Section (Required) */}
        {/* ============================================================== */}
        <div className="space-y-4">
          <SectionHeader
            title="Program Intent"
            icon={<Target className={`w-4 h-4 ${localProgram.scope.summary ? 'text-emerald-400' : 'text-slate-400'}`} />}
            required
            completed={!!(localProgram.scope.summary && localProgram.scope.summary.trim().length > 10 && localProgram.planDetails.owner)}
          />

          {/* Empty state helper */}
          {!localProgram.scope.summary && !localProgram.planDetails.owner && !isReadOnly && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-amber-400 shrink-0" />
                <p className="text-sm text-slate-400">
                  Define why this Program exists and how success will be measured.
                  This helps ensure alignment before execution begins.
                </p>
              </div>
            </div>
          )}

          {/* Program Goal */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Program Goal <span className="text-amber-400">*</span>
            </label>
            <textarea
              value={localProgram.scope.summary}
              onChange={(e) => handleScopeUpdate({ summary: e.target.value })}
              disabled={isReadOnly}
              className="w-full px-3 py-2.5 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none disabled:opacity-70"
              placeholder="What is this program trying to achieve?"
              rows={3}
            />
          </div>

          {/* Success Metrics */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-400">Success Metrics</label>
              {!isReadOnly && (
                <button
                  onClick={handleAddKPI}
                  className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add metric
                </button>
              )}
            </div>
            {localProgram.success.kpis.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No success metrics defined yet</p>
            ) : (
              <div className="space-y-2">
                {localProgram.success.kpis.map(kpi => (
                  <div key={kpi.key} className="flex items-center gap-2">
                    <span className="text-slate-500">•</span>
                    <input
                      type="text"
                      value={kpi.label}
                      onChange={(e) => handleUpdateKPI(kpi.key, { label: e.target.value })}
                      disabled={isReadOnly}
                      className="flex-1 px-2 py-1 text-sm bg-slate-800/50 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-70"
                      placeholder="e.g., Increase conversion by 15%"
                    />
                    {!isReadOnly && (
                      <button
                        onClick={() => handleRemoveKPI(kpi.key)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Owner */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Owner <span className="text-amber-400">*</span>
            </label>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={localProgram.planDetails.owner || ''}
                onChange={(e) => handlePlanUpdate({ owner: e.target.value })}
                disabled={isReadOnly}
                className="flex-1 px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-70"
                placeholder="Who is responsible for this program?"
              />
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Deliverables Section */}
        {/* ============================================================== */}
        <div className="space-y-4">
          <SectionHeader
            title="Deliverables"
            icon={<FileText className={`w-4 h-4 ${localProgram.scope.deliverables.length > 0 ? 'text-emerald-400' : 'text-slate-400'}`} />}
            required
            completed={localProgram.scope.deliverables.length > 0}
            count={localProgram.scope.deliverables.length}
          >
            {!isReadOnly && (
              <button
                onClick={handleAddDeliverable}
                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add deliverable
              </button>
            )}
          </SectionHeader>

          {localProgram.scope.deliverables.length === 0 ? (
            <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-lg p-6 text-center">
              <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No deliverables yet</p>
              <p className="text-xs text-slate-600 mt-1">
                Deliverables are the outputs this program will produce.
                They will become work items when execution starts.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {localProgram.scope.deliverables.map((deliverable, index) => (
                <DeliverableCard
                  key={deliverable.id}
                  deliverable={deliverable}
                  index={index}
                  isReadOnly={isReadOnly}
                  onUpdate={(updates) => handleUpdateDeliverable(deliverable.id, updates)}
                  onRemove={() => handleRemoveDeliverable(deliverable.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* Milestones Section */}
        {/* ============================================================== */}
        <div className="space-y-4">
          <SectionHeader
            title="Milestones"
            icon={<Calendar className={`w-4 h-4 ${localProgram.planDetails.milestones.length > 0 ? 'text-emerald-400' : 'text-slate-400'}`} />}
            required
            completed={localProgram.planDetails.milestones.length > 0}
            count={localProgram.planDetails.milestones.length}
          >
            {!isReadOnly && (
              <button
                onClick={handleAddMilestone}
                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add milestone
              </button>
            )}
          </SectionHeader>

          {localProgram.planDetails.milestones.length === 0 ? (
            <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-lg p-6 text-center">
              <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No milestones yet</p>
              <p className="text-xs text-slate-600 mt-1">
                Milestones are checkpoints to track progress.
                No dates required—just define what needs to happen.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {localProgram.planDetails.milestones.map((milestone) => (
                <MilestoneItem
                  key={milestone.id}
                  milestone={milestone}
                  isReadOnly={isReadOnly}
                  onToggle={() => handleToggleMilestone(milestone.id)}
                  onUpdate={(updates) => handleUpdateMilestone(milestone.id, updates)}
                  onRemove={() => handleRemoveMilestone(milestone.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* Media Plan Scaffold (for paid_media) */}
        {/* ============================================================== */}
        <MediaPlanScaffold program={localProgram} />

        {/* ============================================================== */}
        {/* Constraints & Assumptions (Collapsed) */}
        {/* ============================================================== */}
        <CollapsibleSection
          title="Constraints & Assumptions"
          icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
        >
          <div className="space-y-4">
            {/* Budget Assumptions */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Budget Assumptions
              </label>
              <textarea
                value={localProgram.scope.constraints.join('\n')}
                onChange={(e) => handleScopeUpdate({
                  constraints: e.target.value.split('\n').filter(Boolean)
                })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none disabled:opacity-70"
                placeholder="Any budget constraints or expectations..."
                rows={2}
              />
            </div>

            {/* Channel Assumptions */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Channel Assumptions
              </label>
              <textarea
                value={localProgram.scope.assumptions.join('\n')}
                onChange={(e) => handleScopeUpdate({
                  assumptions: e.target.value.split('\n').filter(Boolean)
                })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none disabled:opacity-70"
                placeholder="Channel or platform assumptions..."
                rows={2}
              />
            </div>

            {/* Dependencies / Risks */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Dependencies & Risks
              </label>
              <textarea
                value={localProgram.scope.dependencies.join('\n')}
                onChange={(e) => handleScopeUpdate({
                  dependencies: e.target.value.split('\n').filter(Boolean)
                })}
                disabled={isReadOnly}
                className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none disabled:opacity-70"
                placeholder="External dependencies or potential risks..."
                rows={2}
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* ============================================================== */}
        {/* AI Co-planner */}
        {/* ============================================================== */}
        {localProgram.status !== 'committed' && (
          <AICoPlannerPanel
            program={localProgram}
            companyId={companyId}
            onApply={(updatedProgram) => {
              // Update local state with the new program data from the API
              setLocalProgram(updatedProgram);
            }}
            disabled={isReadOnly}
          />
        )}

        {/* ============================================================== */}
        {/* Readiness Gate */}
        {/* ============================================================== */}
        {localProgram.status === 'draft' && (
          <ReadinessGate
            readiness={readiness}
            onAIFill={handleAIFillMissing}
            isFillingMissing={isFillingMissing}
          />
        )}
      </div>

      {/* Execution Modal */}
      <ExecutionModal
        program={localProgram}
        isOpen={showExecutionModal}
        isCommitting={isCommitting}
        onClose={() => setShowExecutionModal(false)}
        onConfirm={handleCommit}
      />

      {/* Resync Modal */}
      <ResyncModal
        isOpen={showResyncModal}
        isResyncing={isResyncing}
        selectedMode={selectedSyncMode}
        onModeChange={setSelectedSyncMode}
        onClose={() => setShowResyncModal(false)}
        onConfirm={() => handleResync(selectedSyncMode)}
      />

      {/* Artifact Picker Modal */}
      {showArtifactPicker && (
        <ArtifactPickerModal
          programId={program.id}
          companyId={companyId}
          linkedArtifactIds={(localProgram.linkedArtifacts || []).map(a => a.artifactId)}
          onSelect={handleLinkArtifact}
          onClose={() => setShowArtifactPicker(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Deliverable Card Component
// ============================================================================

interface DeliverableCardProps {
  deliverable: PlanningDeliverable;
  index: number;
  isReadOnly: boolean;
  onUpdate: (updates: Partial<PlanningDeliverable>) => void;
  onRemove: () => void;
}

function DeliverableCard({ deliverable, index, isReadOnly, onUpdate, onRemove }: DeliverableCardProps) {
  const [isExpanded, setIsExpanded] = useState(!deliverable.title);

  return (
    <div className="bg-slate-800/30 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-xs text-slate-500 font-mono">{index + 1}</span>
        <div className="flex-1 min-w-0">
          {deliverable.title ? (
            <p className="text-sm font-medium text-white truncate">{deliverable.title}</p>
          ) : (
            <p className="text-sm text-slate-500 italic">New deliverable</p>
          )}
        </div>
        {!isReadOnly && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-700 space-y-3">
          {/* Title */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Title</label>
            <input
              type="text"
              value={deliverable.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              disabled={isReadOnly}
              className="w-full px-2.5 py-1.5 text-sm bg-slate-800/50 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-70"
              placeholder="Deliverable title..."
              autoFocus={!deliverable.title}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Description</label>
            <textarea
              value={deliverable.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              disabled={isReadOnly}
              className="w-full px-2.5 py-1.5 text-sm bg-slate-800/50 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none disabled:opacity-70"
              placeholder="What does this deliverable include?"
              rows={2}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Type</label>
            <select
              value={deliverable.type}
              onChange={(e) => onUpdate({ type: e.target.value as PlanningDeliverable['type'] })}
              disabled={isReadOnly}
              className="w-full px-2.5 py-1.5 text-sm bg-slate-800/50 border border-slate-600 rounded text-white focus:outline-none focus:border-purple-500 disabled:opacity-70"
            >
              <option value="document">Document</option>
              <option value="asset">Asset</option>
              <option value="campaign">Campaign</option>
              <option value="integration">Integration</option>
              <option value="process">Process</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Milestone Item Component
// ============================================================================

interface MilestoneItemProps {
  milestone: PlanningMilestone;
  isReadOnly: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<PlanningMilestone>) => void;
  onRemove: () => void;
}

function MilestoneItem({ milestone, isReadOnly, onToggle, onUpdate, onRemove }: MilestoneItemProps) {
  const isCompleted = milestone.status === 'completed';

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
      isCompleted
        ? 'bg-emerald-500/5 border-emerald-500/20'
        : 'bg-slate-800/30 border-slate-700'
    }`}>
      {/* Checkbox */}
      <button
        onClick={onToggle}
        disabled={isReadOnly && !isCompleted}
        className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          isCompleted
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-slate-600 hover:border-slate-500'
        } ${isReadOnly && !isCompleted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {isCompleted && <Check className="w-3 h-3 text-white" />}
      </button>

      {/* Title */}
      <input
        type="text"
        value={milestone.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        disabled={isReadOnly}
        className={`flex-1 bg-transparent text-sm focus:outline-none disabled:opacity-70 ${
          isCompleted ? 'text-slate-500 line-through' : 'text-white'
        }`}
        placeholder="Milestone..."
      />

      {/* Remove */}
      {!isReadOnly && (
        <button
          onClick={onRemove}
          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default ProgramPlanner;
