'use client';

// components/website/v5/V5ActionsBar.tsx
// Actions Bar - Turn insight → execution
//
// Buttons:
// - Create Work from Blocking Issue
// - Bundle Quick Wins
// - Propose Program from Structural Change
// - Send to Context Review Queue (selective)

import { useState } from 'react';
import {
  Plus,
  Layers,
  Building2,
  Send,
  ChevronDown,
  Loader2,
  Check,
} from 'lucide-react';
import type { V5BlockingIssue, V5QuickWin, V5StructuralChange } from '@/lib/gap-heavy/modules/websiteLabV5';

interface V5ActionsBarProps {
  blockingIssues: V5BlockingIssue[];
  quickWins: V5QuickWin[];
  structuralChanges: V5StructuralChange[];
  companyId: string;
  runId?: string;
}

export function V5ActionsBar({
  blockingIssues,
  quickWins,
  structuralChanges,
  companyId,
  runId,
}: V5ActionsBarProps) {
  const [isCreatingWork, setIsCreatingWork] = useState(false);
  const [isBundling, setIsBundling] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  const [isSendingContext, setIsSendingContext] = useState(false);
  const [showIssueDropdown, setShowIssueDropdown] = useState(false);
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());

  const handleCreateWork = async (issue: V5BlockingIssue) => {
    setIsCreatingWork(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/website-lab/v5/create-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue, runId }),
      });

      if (response.ok) {
        setCompletedActions((prev) => new Set(prev).add(`work-${issue.id}`));
      }
    } catch (error) {
      console.error('Failed to create work item:', error);
    } finally {
      setIsCreatingWork(false);
      setShowIssueDropdown(false);
    }
  };

  const handleBundleQuickWins = async () => {
    setIsBundling(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/website-lab/v5/bundle-quick-wins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quickWins, runId }),
      });

      if (response.ok) {
        setCompletedActions((prev) => new Set(prev).add('bundle'));
      }
    } catch (error) {
      console.error('Failed to bundle quick wins:', error);
    } finally {
      setIsBundling(false);
    }
  };

  const handleProposeProgram = async () => {
    if (structuralChanges.length === 0) return;

    setIsProposing(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/website-lab/v5/propose-program`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuralChanges, runId }),
      });

      if (response.ok) {
        setCompletedActions((prev) => new Set(prev).add('program'));
      }
    } catch (error) {
      console.error('Failed to propose program:', error);
    } finally {
      setIsProposing(false);
    }
  };

  const handleSendToContext = async () => {
    setIsSendingContext(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/website-lab/v5/propose-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockingIssues, runId }),
      });

      if (response.ok) {
        setCompletedActions((prev) => new Set(prev).add('context'));
      }
    } catch (error) {
      console.error('Failed to send to context:', error);
    } finally {
      setIsSendingContext(false);
    }
  };

  const hasEligibleBlockers = blockingIssues.some((i) => i.severity === 'high');

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
      {/* Create Work Dropdown */}
      {blockingIssues.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowIssueDropdown(!showIssueDropdown)}
            disabled={isCreatingWork}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-gray-900 font-medium text-sm rounded-lg transition-colors"
          >
            {isCreatingWork ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Create Work
            <ChevronDown className="w-4 h-4" />
          </button>

          {showIssueDropdown && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10">
              <div className="p-2 text-xs text-gray-400 border-b border-gray-700">
                Select a blocking issue
              </div>
              {blockingIssues.map((issue) => {
                const isDone = completedActions.has(`work-${issue.id}`);
                return (
                  <button
                    key={issue.id}
                    onClick={() => handleCreateWork(issue)}
                    disabled={isDone}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-700/50 disabled:opacity-50 transition-colors"
                  >
                    {isDone ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <span className="w-4 text-center text-gray-500">#{issue.id}</span>
                    )}
                    <span className="text-gray-300 truncate">{issue.whyItBlocks}</span>
                    <code className="text-xs text-amber-400 ml-auto">{issue.page}</code>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bundle Quick Wins */}
      {quickWins.length > 1 && (
        <button
          onClick={handleBundleQuickWins}
          disabled={isBundling || completedActions.has('bundle')}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 text-gray-200 font-medium text-sm rounded-lg transition-colors"
        >
          {isBundling ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : completedActions.has('bundle') ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Layers className="w-4 h-4" />
          )}
          Bundle Quick Wins ({quickWins.length})
        </button>
      )}

      {/* Propose Program */}
      {structuralChanges.length > 0 && (
        <button
          onClick={handleProposeProgram}
          disabled={isProposing || completedActions.has('program')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 disabled:opacity-50 text-purple-300 font-medium text-sm rounded-lg transition-colors"
        >
          {isProposing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : completedActions.has('program') ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Building2 className="w-4 h-4" />
          )}
          Propose Program
        </button>
      )}

      {/* Divider */}
      <div className="h-6 w-px bg-gray-700" />

      {/* Send to Context */}
      {hasEligibleBlockers && (
        <button
          onClick={handleSendToContext}
          disabled={isSendingContext || completedActions.has('context')}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 disabled:opacity-50 text-gray-300 font-medium text-sm rounded-lg transition-colors"
        >
          {isSendingContext ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : completedActions.has('context') ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Send to Context Queue
        </button>
      )}

      {/* Click outside handler */}
      {showIssueDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowIssueDropdown(false)}
        />
      )}
    </div>
  );
}
