'use client';

// components/os/work/WorkDetailsPanel.tsx
// Detail panel for work items with tabs and AI Guide progressive disclosure

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  FileText,
  Clock,
  History,
  Calendar,
  User,
  Target,
  Layers,
  Activity,
  CheckCircle2,
  Square,
  AlertCircle,
  Play,
  CheckCircle,
  ArrowRight,
  Info,
} from 'lucide-react';
import type { WorkItemRecord, WorkItemStatus } from '@/lib/airtable/workItems';
import type { WorkItemArtifact } from '@/lib/types/work';
import { WorkItemArtifactsSection } from './WorkItemArtifactsSection';

// ============================================================================
// Types
// ============================================================================

export interface WorkDetailsPanelProps {
  workItem: WorkItemRecord | null;
  companyId: string;
  aiAdditionalInfo: string | null;
  loadingAI: boolean;
  aiError: string | null;
  onGenerateAI: () => void;
  onClose: () => void;
  onStatusChange?: (item: WorkItemRecord, status: WorkItemStatus) => void;
}

type DetailTab = 'overview' | 'ai-guide' | 'notes' | 'history';

const STATUS_OPTIONS: WorkItemStatus[] = ['Backlog', 'Planned', 'In Progress', 'Done'];

// ============================================================================
// Primary Action Logic
// ============================================================================

type WorkItemType = 'milestone' | 'deliverable' | 'task';

interface PrimaryAction {
  label: string;
  action: WorkItemStatus;
  imperative: string; // "Next step: {imperative}"
}

/**
 * Infer work item type from title prefixes
 */
function inferWorkItemType(title: string): WorkItemType {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.startsWith('[milestone]')) return 'milestone';
  if (lowerTitle.startsWith('[setup]') || lowerTitle.startsWith('[deliverable]')) return 'deliverable';
  return 'task';
}

/**
 * Get the primary action for a work item based on its status.
 *
 * Rules (in priority order):
 * 1. Done → no primary action (optional "Reopen" secondary)
 * 2. Backlog or Planned → "Start" (set to In Progress)
 * 3. In Progress → "Mark done" (set to Done)
 */
function getPrimaryAction(workItem: WorkItemRecord): PrimaryAction | null {
  const status = workItem.status;
  const type = inferWorkItemType(workItem.title);

  // 1. Done → no primary CTA
  if (status === 'Done') {
    return null;
  }

  // 2. Backlog or Planned → Start
  if (status === 'Backlog' || status === 'Planned') {
    const labels: Record<WorkItemType, { label: string; imperative: string }> = {
      milestone: { label: 'Start milestone', imperative: 'Begin working on this milestone' },
      deliverable: { label: 'Start deliverable', imperative: 'Begin working on this deliverable' },
      task: { label: 'Start task', imperative: 'Start working on this task' },
    };
    return {
      ...labels[type],
      action: 'In Progress',
    };
  }

  // 3. In Progress → Complete
  if (status === 'In Progress') {
    const labels: Record<WorkItemType, { label: string; imperative: string }> = {
      milestone: { label: 'Complete milestone', imperative: 'Mark this milestone as complete' },
      deliverable: { label: 'Complete deliverable', imperative: 'Mark this deliverable as complete' },
      task: { label: 'Complete task', imperative: 'Mark this task as complete' },
    };
    return {
      ...labels[type],
      action: 'Done',
    };
  }

  return null;
}

/**
 * Get the secondary action (Reopen) for done items
 */
function getSecondaryAction(workItem: WorkItemRecord): PrimaryAction | null {
  if (workItem.status !== 'Done') return null;

  return {
    label: 'Reopen',
    action: 'In Progress',
    imperative: 'Reopen this item to continue work',
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse AI guide into sections for progressive disclosure
 */
function parseAIGuide(markdown: string): {
  nextActions: string[];
  sections: { heading: string; content: string }[];
  fullText: string;
} {
  const lines = markdown.split('\n');
  const sections: { heading: string; content: string }[] = [];
  const nextActions: string[] = [];
  let currentSection: { heading: string; content: string } | null = null;

  for (const line of lines) {
    // Check for heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = { heading: headingMatch[2], content: '' };
    } else if (currentSection) {
      currentSection.content += line + '\n';
    }

    // Extract action items (lines starting with - or * or numbered)
    const actionMatch = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (actionMatch && nextActions.length < 7) {
      const action = actionMatch[1].trim();
      // Skip very short items or headings
      if (action.length > 10 && !action.startsWith('#')) {
        nextActions.push(action);
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  // If no actions found, extract first sentence from each section
  if (nextActions.length === 0 && sections.length > 0) {
    for (const section of sections.slice(0, 5)) {
      const firstLine = section.content.split('\n').find(l => l.trim().length > 20);
      if (firstLine) {
        nextActions.push(firstLine.trim().slice(0, 100) + (firstLine.length > 100 ? '...' : ''));
      }
    }
  }

  return {
    nextActions: nextActions.slice(0, 7),
    sections,
    fullText: markdown,
  };
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format date for display
 */
function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkDetailsPanel({
  workItem,
  companyId,
  aiAdditionalInfo,
  loadingAI,
  aiError,
  onGenerateAI,
  onClose,
  onStatusChange,
}: WorkDetailsPanelProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [checkedActions, setCheckedActions] = useState<Set<number>>(new Set());
  const [showFullGuide, setShowFullGuide] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Parse AI guide for progressive disclosure
  const parsedGuide = useMemo(() => {
    if (!aiAdditionalInfo) return null;
    return parseAIGuide(aiAdditionalInfo);
  }, [aiAdditionalInfo]);

  // Compute primary and secondary actions
  const primaryAction = useMemo(() => {
    if (!workItem) return null;
    return getPrimaryAction(workItem);
  }, [workItem]);

  const secondaryAction = useMemo(() => {
    if (!workItem) return null;
    return getSecondaryAction(workItem);
  }, [workItem]);

  // Copy handler
  const handleCopy = useCallback(async (text: string, actionId: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedAction(actionId);
      setTimeout(() => setCopiedAction(null), 2000);
    }
  }, []);

  // Copy link to work item
  const handleCopyLink = useCallback(() => {
    if (!workItem) return;
    const url = `${window.location.origin}/c/${companyId}/work?workItemId=${workItem.id}`;
    handleCopy(url, 'link');
  }, [workItem, companyId, handleCopy]);

  // Toggle action checkbox
  const toggleAction = useCallback((index: number) => {
    setCheckedActions(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Handle status change
  const handleStatusChange = useCallback(async (newStatus: WorkItemStatus) => {
    if (!workItem || newStatus === workItem.status || isUpdatingStatus) return;

    setIsUpdatingStatus(true);
    try {
      const response = await fetch('/api/work-items/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workItemId: workItem.id,
          status: newStatus,
        }),
      });

      if (response.ok) {
        onStatusChange?.(workItem, newStatus);
        router.refresh();
      }
    } catch (err) {
      console.error('[WorkDetailsPanel] Status update failed:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [workItem, isUpdatingStatus, onStatusChange, router]);

  // Empty state
  if (!workItem) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-900/30 text-center p-8">
        <div className="w-14 h-14 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
          <Target className="w-7 h-7 text-slate-600" />
        </div>
        <h3 className="text-sm font-medium text-slate-300 mb-1">Select a task from the list to begin execution.</h3>
        <p className="text-xs text-slate-500 mt-2">
          Tip: use <kbd className="px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-400 font-mono text-[10px]">↑</kbd> <kbd className="px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-400 font-mono text-[10px]">↓</kbd> to move quickly
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900/50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 p-4">
        {/* Title Row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold text-white leading-snug flex-1">
            {workItem.title}
          </h2>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleCopyLink}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded transition-colors"
              title="Copy link"
            >
              {copiedAction === 'link' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Context Row - simplified from multiple badges */}
        {(workItem.programId || workItem.strategyLink) && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
            <span>Context:</span>
            {workItem.programId && (
              <Link
                href={`/c/${companyId}/deliver?programId=${workItem.programId}`}
                className="text-slate-400 hover:text-cyan-400 transition-colors"
              >
                Program
              </Link>
            )}
            {workItem.programId && workItem.strategyLink && (
              <ArrowRight className="w-3 h-3 text-slate-600" />
            )}
            {workItem.strategyLink && (
              <Link
                href={`/c/${companyId}/strategy?id=${workItem.strategyLink.strategyId}`}
                className="text-slate-400 hover:text-blue-400 transition-colors"
              >
                Strategy
              </Link>
            )}
          </div>
        )}

        {/* Primary Action CTA */}
        {primaryAction && (
          <div className="flex items-center justify-between gap-3 mb-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <span>
                <span className="text-slate-500">Next step:</span>{' '}
                {primaryAction.imperative}
              </span>
            </div>
            <button
              onClick={() => handleStatusChange(primaryAction.action)}
              disabled={isUpdatingStatus}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdatingStatus ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : primaryAction.action === 'Done' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {primaryAction.label}
            </button>
          </div>
        )}

        {/* Completed Status Banner for Done items */}
        {secondaryAction && !primaryAction && (
          <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-emerald-300/80">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Complete</span>
            </div>
            <button
              onClick={() => handleStatusChange(secondaryAction.action)}
              disabled={isUpdatingStatus}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
            >
              {isUpdatingStatus && <Loader2 className="w-3 h-3 animate-spin inline mr-1" />}
              {secondaryAction.label}
            </button>
          </div>
        )}

        {/* Status Buttons */}
        <div className="flex items-center gap-1.5 mb-3">
          {STATUS_OPTIONS.map(status => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              disabled={isUpdatingStatus}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                workItem.status === status
                  ? status === 'In Progress'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
                    : status === 'Done'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                    : status === 'Planned'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
                    : 'bg-slate-600/30 text-slate-200 border border-slate-500/50'
                  : 'bg-transparent text-slate-500 border border-slate-700 hover:bg-slate-800 hover:text-slate-300'
              } disabled:opacity-50`}
            >
              {status}
            </button>
          ))}
          {isUpdatingStatus && <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin ml-2" />}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {(['overview', 'ai-guide', 'notes', 'history'] as DetailTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'ai-guide' && (
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Guide
                </span>
              )}
              {tab === 'notes' && 'Notes'}
              {tab === 'history' && 'History'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {workItem.area && (
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-400">Area:</span>
                  <span className="text-slate-200">{workItem.area}</span>
                </div>
              )}
              {workItem.severity && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-400">Priority:</span>
                  <span className={`${
                    workItem.severity === 'Critical' ? 'text-red-300' :
                    workItem.severity === 'High' ? 'text-orange-300' :
                    workItem.severity === 'Medium' ? 'text-amber-300' :
                    'text-slate-300'
                  }`}>
                    {workItem.severity}
                  </span>
                </div>
              )}
              {workItem.dueDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-400">Due:</span>
                  <span className="text-slate-200">{formatDate(workItem.dueDate)}</span>
                </div>
              )}
              {workItem.ownerName && (
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-400">Owner:</span>
                  <span className="text-slate-200">{workItem.ownerName}</span>
                </div>
              )}
              {workItem.createdAt && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-400">Created:</span>
                  <span className="text-slate-200">{formatDate(workItem.createdAt)}</span>
                </div>
              )}
            </div>

            {/* Links */}
            <div className="flex flex-wrap gap-2">
              {workItem.strategyLink && (
                <Link
                  href={`/c/${companyId}/strategy?id=${workItem.strategyLink.strategyId}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded-md hover:bg-blue-500/20 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" />
                  View Strategy
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
              {workItem.programId && (
                <Link
                  href={`/c/${companyId}/deliver?programId=${workItem.programId}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded-md hover:bg-cyan-500/20 transition-colors"
                >
                  <Activity className="w-3.5 h-3.5" />
                  View Program
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>

            {/* Notes/Description */}
            {workItem.notes && (
              <div className="mt-4">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Description</h3>
                <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed">
                  <ReactMarkdown>{workItem.notes}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Artifacts */}
            <WorkItemArtifactsSection
              companyId={companyId}
              workItemId={workItem.id}
              artifacts={(workItem.artifacts as WorkItemArtifact[]) ?? []}
            />
          </div>
        )}

        {/* AI Guide Tab */}
        {activeTab === 'ai-guide' && (
          <div className="space-y-4">
            {/* Generate Button */}
            {!aiAdditionalInfo && !loadingAI && (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-sm font-medium text-slate-300 mb-1">AI Implementation Guide</h3>
                <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto">
                  Generate a step-by-step guide for implementing this work item
                </p>
                <button
                  onClick={onGenerateAI}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Guide
                </button>
              </div>
            )}

            {/* Loading State */}
            {loadingAI && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                <span className="ml-3 text-sm text-slate-400">Generating guide...</span>
              </div>
            )}

            {/* Error State */}
            {aiError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-sm text-red-400">{aiError}</p>
                <button
                  onClick={onGenerateAI}
                  className="mt-2 text-xs text-red-300 hover:text-red-200 underline"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Parsed Guide with Progressive Disclosure */}
            {parsedGuide && !loadingAI && (
              <div className="space-y-4">
                {/* Next Actions Checklist */}
                {parsedGuide.nextActions.length > 0 && (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-slate-200">Next Actions</h3>
                      <button
                        onClick={() => handleCopy(parsedGuide.nextActions.join('\n'), 'actions')}
                        className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                      >
                        {copiedAction === 'actions' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">Focus here — everything else is reference.</p>
                    <div className="space-y-3">
                      {parsedGuide.nextActions.map((action, idx) => (
                        <label
                          key={idx}
                          className={`flex items-start gap-3 text-sm cursor-pointer group ${
                            checkedActions.has(idx) ? 'text-slate-500' : 'text-slate-300'
                          }`}
                        >
                          <button
                            onClick={() => toggleAction(idx)}
                            className="mt-0.5 shrink-0 transition-transform duration-150"
                          >
                            {checkedActions.has(idx) ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500 group-hover:text-slate-400" />
                            )}
                          </button>
                          <span className={checkedActions.has(idx) ? 'line-through' : ''}>
                            {action}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 text-xs text-slate-500">
                      {checkedActions.size} of {parsedGuide.nextActions.length} completed
                    </div>
                  </div>
                )}

                {/* Full Guide Collapsible */}
                <div className="border border-slate-700/50 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/20 border-b border-slate-700/30">
                    <Info className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs text-slate-500">Reference — not required to start</span>
                  </div>
                  <button
                    onClick={() => setShowFullGuide(!showFullGuide)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                  >
                    <span className="text-sm font-medium text-slate-400">Full Implementation Guide</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(parsedGuide.fullText, 'full');
                        }}
                        className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                      >
                        {copiedAction === 'full' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy
                          </>
                        )}
                      </button>
                      {showFullGuide ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>
                  {showFullGuide && (
                    <div className="p-4 prose prose-invert prose-sm max-w-none text-slate-300">
                      <ReactMarkdown>{parsedGuide.fullText}</ReactMarkdown>
                    </div>
                  )}
                </div>

                {/* Regenerate Button */}
                <div className="text-center pt-2">
                  <button
                    onClick={onGenerateAI}
                    disabled={loadingAI}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 mx-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Regenerate guide
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6 text-slate-600" />
            </div>
            <p className="text-sm text-slate-500">Notes coming soon</p>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-3">
              <History className="w-6 h-6 text-slate-600" />
            </div>
            <p className="text-sm text-slate-500">Activity history coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkDetailsPanel;
