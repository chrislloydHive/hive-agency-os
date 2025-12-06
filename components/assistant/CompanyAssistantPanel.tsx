'use client';

// components/assistant/CompanyAssistantPanel.tsx
// Slide-out panel for the Company Context Assistant
// Supports page-awareness for contextual quick actions

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import type {
  AssistantMessage,
  AssistantResponse,
  ProposedChanges,
  ContextUpdate,
  ProposedWorkItem,
  ProposedAction,
  ApplyResult,
  PageContextId,
} from '@/lib/assistant/types';
import { PAGE_CONTEXT_LABELS } from '@/lib/assistant/types';
import { getQuickActionsForPage, type QuickAction } from '@/lib/assistant/prompts';

interface AssistantContextSummary {
  company: { id: string; name: string };
  contextHealth: {
    score: number;
    status: string;
    missingCritical: string[];
    weakSections: string[];
  };
  quickActions: QuickAction[];
  recentInsightsCount: number;
  openWorkItemsCount: number;
}

interface CompanyAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onContextRefresh?: () => void;
  /** Current page context for page-aware quick actions */
  pageContext?: PageContextId;
}

export function CompanyAssistantPanel({
  isOpen,
  onClose,
  onContextRefresh,
  pageContext = 'unknown',
}: CompanyAssistantPanelProps) {
  const params = useParams();
  const companyId = params?.companyId as string;

  // State
  const [contextSummary, setContextSummary] = useState<AssistantContextSummary | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Proposed changes state
  const [proposedChanges, setProposedChanges] = useState<ProposedChanges | null>(null);
  const [changeToken, setChangeToken] = useState<string | null>(null);
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set());
  const [selectedWorkItems, setSelectedWorkItems] = useState<Set<number>>(new Set());
  const [selectedActions, setSelectedActions] = useState<Set<number>>(new Set());
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load context summary on open
  useEffect(() => {
    if (isOpen && companyId) {
      loadContextSummary();
    }
  }, [isOpen, companyId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const loadContextSummary = async () => {
    try {
      const response = await fetch(`/api/os/companies/${companyId}/assistant`);
      if (response.ok) {
        const data = await response.json();
        setContextSummary(data);
      }
    } catch (err) {
      console.error('Failed to load context summary:', err);
    }
  };

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    setError(null);
    setApplyResult(null);

    // Add user message to chat
    const userMessage: AssistantMessage = {
      type: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Clear previous proposals
    setProposedChanges(null);
    setChangeToken(null);
    setSelectedUpdates(new Set());
    setSelectedWorkItems(new Set());
    setSelectedActions(new Set());

    try {
      const response = await fetch(`/api/os/companies/${companyId}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationHistory: messages.slice(-6),
          pageContext, // Pass page context for AI awareness
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data: AssistantResponse = await response.json();

      // Add assistant messages
      setMessages((prev) => [...prev, ...data.messages]);

      // Handle proposed changes
      if (data.proposedChanges && data.changeToken) {
        setProposedChanges(data.proposedChanges);
        setChangeToken(data.changeToken);

        // Pre-select all updates
        if (data.proposedChanges.contextUpdates) {
          setSelectedUpdates(new Set(data.proposedChanges.contextUpdates.map((u) => u.path)));
        }
        if (data.proposedChanges.workItems) {
          setSelectedWorkItems(new Set(data.proposedChanges.workItems.map((_, i) => i)));
        }
        if (data.proposedChanges.actions) {
          setSelectedActions(new Set(data.proposedChanges.actions.map((_, i) => i)));
        }
      }

      // Update context health if returned
      if (data.contextHealth && contextSummary) {
        setContextSummary((prev) =>
          prev ? { ...prev, contextHealth: { ...prev.contextHealth, ...data.contextHealth } } : prev
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyChanges = async () => {
    if (!changeToken || isApplying) return;

    setIsApplying(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/assistant/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeToken,
          selectedUpdates: Array.from(selectedUpdates),
          selectedWorkItems: Array.from(selectedWorkItems),
          selectedActions: Array.from(selectedActions),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to apply changes');
      }

      const result: ApplyResult = data;
      setApplyResult(result);

      // Clear proposals
      setProposedChanges(null);
      setChangeToken(null);

      // Refresh context if any changes were applied
      if (result.updatedFields.length > 0 && onContextRefresh) {
        onContextRefresh();
      }

      // Reload context summary
      loadContextSummary();

      // Add confirmation message to chat
      const appliedCount = result.updatedFields.length + result.createdWorkItems.length + result.triggeredActions.length;
      if (appliedCount > 0) {
        const confirmMsg: AssistantMessage = {
          type: 'assistant',
          content: buildApplyConfirmation(result),
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, confirmMsg]);
      }
    } catch (err) {
      console.error('[Assistant] Apply error:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply changes');
    } finally {
      setIsApplying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.prompt);
  };

  // Compute page-aware quick actions
  const pageQuickActions = useMemo(() => {
    return getQuickActionsForPage(pageContext, {
      contextHealth: contextSummary?.contextHealth.score,
      weakSections: contextSummary?.contextHealth.weakSections,
      missingCritical: contextSummary?.contextHealth.missingCritical,
      hasDiagnostics: (contextSummary?.recentInsightsCount ?? 0) > 0,
      hasInsights: (contextSummary?.recentInsightsCount ?? 0) > 0,
    });
  }, [pageContext, contextSummary]);

  // Get the page label for display
  const pageLabel = PAGE_CONTEXT_LABELS[pageContext] || 'Company';

  if (!isOpen) return null;

  const healthColor =
    contextSummary?.contextHealth.score && contextSummary.contextHealth.score >= 70
      ? 'text-emerald-400'
      : contextSummary?.contextHealth.score && contextSummary.contextHealth.score >= 50
      ? 'text-amber-400'
      : 'text-red-400';

  const healthBgColor =
    contextSummary?.contextHealth.score && contextSummary.contextHealth.score >= 70
      ? 'bg-emerald-500/10'
      : contextSummary?.contextHealth.score && contextSummary.contextHealth.score >= 50
      ? 'bg-amber-500/10'
      : 'bg-red-500/10';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Helper
              </h2>
              <p className="text-xs text-slate-500">
                {pageContext !== 'unknown' ? (
                  <>Helping with <span className="text-slate-400">{pageLabel}</span></>
                ) : (
                  'Company-aware assistant'
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Context Health Chip + Page Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            {contextSummary && (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${healthBgColor} ${healthColor}`}>
                <span>{contextSummary.contextHealth.score}%</span>
                <span className="text-slate-500">·</span>
                <span className="capitalize">{contextSummary.contextHealth.status.replace('_', ' ')}</span>
              </div>
            )}
            {pageContext !== 'unknown' && (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-slate-800 text-slate-400 border border-slate-700">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {pageLabel}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions - Page-Aware */}
        {messages.length === 0 && pageQuickActions.length > 0 && (
          <div className="flex-shrink-0 p-4 border-b border-slate-800/50">
            <p className="text-xs text-slate-500 mb-2">
              {pageContext !== 'unknown' ? `Quick actions for ${pageLabel}` : 'Quick actions'}
            </p>
            <div className="flex flex-wrap gap-2">
              {pageQuickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action)}
                  className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-slate-500 py-8">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">Ask me anything about your company context</p>
              <p className="text-xs mt-1">Try a quick action above or type your question</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-lg px-4 py-2.5 ${
                  msg.type === 'user'
                    ? 'bg-amber-500/10 text-amber-100'
                    : 'bg-slate-800 text-slate-200'
                }`}
              >
                {msg.type === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse delay-100" />
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse delay-200" />
                </div>
              </div>
            </div>
          )}

          {/* Apply Result */}
          {applyResult && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <h4 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Changes Applied
              </h4>
              <ul className="text-xs text-slate-400 space-y-1">
                {applyResult.updatedFields.length > 0 && (
                  <li>Updated {applyResult.updatedFields.length} field(s)</li>
                )}
                {applyResult.createdWorkItems.length > 0 && (
                  <li>Created {applyResult.createdWorkItems.length} work item(s)</li>
                )}
                {applyResult.triggeredActions.length > 0 && (
                  <li>Triggered {applyResult.triggeredActions.length} action(s)</li>
                )}
                {applyResult.skippedFields.length > 0 && (
                  <li className="text-amber-400/70">
                    Skipped {applyResult.skippedFields.length} field(s) (protected)
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Proposed Changes */}
          {proposedChanges && changeToken && (
            <ProposedChangesSection
              proposedChanges={proposedChanges}
              selectedUpdates={selectedUpdates}
              setSelectedUpdates={setSelectedUpdates}
              selectedWorkItems={selectedWorkItems}
              setSelectedWorkItems={setSelectedWorkItems}
              selectedActions={selectedActions}
              setSelectedActions={setSelectedActions}
              onApply={handleApplyChanges}
              isApplying={isApplying}
            />
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex-shrink-0 p-4 border-t border-slate-800">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your company context..."
              disabled={isLoading}
              rows={2}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 resize-none text-sm disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || isLoading}
              className="px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Proposed Changes Section Component
function ProposedChangesSection({
  proposedChanges,
  selectedUpdates,
  setSelectedUpdates,
  selectedWorkItems,
  setSelectedWorkItems,
  selectedActions,
  setSelectedActions,
  onApply,
  isApplying,
}: {
  proposedChanges: ProposedChanges;
  selectedUpdates: Set<string>;
  setSelectedUpdates: (s: Set<string>) => void;
  selectedWorkItems: Set<number>;
  setSelectedWorkItems: (s: Set<number>) => void;
  selectedActions: Set<number>;
  setSelectedActions: (s: Set<number>) => void;
  onApply: () => void;
  isApplying: boolean;
}) {
  const hasContextUpdates = proposedChanges.contextUpdates && proposedChanges.contextUpdates.length > 0;
  const hasWorkItems = proposedChanges.workItems && proposedChanges.workItems.length > 0;
  const hasActions = proposedChanges.actions && proposedChanges.actions.length > 0;

  const totalSelected = selectedUpdates.size + selectedWorkItems.size + selectedActions.size;

  const toggleUpdate = (path: string) => {
    const newSet = new Set(selectedUpdates);
    if (newSet.has(path)) {
      newSet.delete(path);
    } else {
      newSet.add(path);
    }
    setSelectedUpdates(newSet);
  };

  const toggleWorkItem = (index: number) => {
    const newSet = new Set(selectedWorkItems);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedWorkItems(newSet);
  };

  const toggleAction = (index: number) => {
    const newSet = new Set(selectedActions);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedActions(newSet);
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700 bg-slate-800/50">
        <h4 className="text-sm font-medium text-slate-200">Proposed Changes</h4>
      </div>

      <div className="p-3 space-y-3 max-h-[300px] overflow-y-auto">
        {/* Context Updates */}
        {hasContextUpdates && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Field Updates</p>
            <div className="space-y-2">
              {proposedChanges.contextUpdates!.map((update) => (
                <label
                  key={update.path}
                  className="flex items-start gap-2 p-2 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={selectedUpdates.has(update.path)}
                    onChange={() => toggleUpdate(update.path)}
                    className="mt-0.5 rounded border-slate-600 text-amber-500 focus:ring-amber-500/50"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-amber-400">{update.path}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500 line-through truncate max-w-[120px]">
                        {formatValue(update.oldValue)}
                      </span>
                      <span className="text-slate-600">→</span>
                      <span className="text-xs text-emerald-400 truncate max-w-[120px]">
                        {formatValue(update.newValue)}
                      </span>
                    </div>
                    {update.reason && (
                      <p className="text-xs text-slate-500 mt-1">{update.reason}</p>
                    )}
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      Confidence: {Math.round(update.confidence * 100)}%
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Work Items */}
        {hasWorkItems && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Work Items to Create</p>
            <div className="space-y-2">
              {proposedChanges.workItems!.map((item, i) => (
                <label
                  key={i}
                  className="flex items-start gap-2 p-2 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={selectedWorkItems.has(i)}
                    onChange={() => toggleWorkItem(i)}
                    className="mt-0.5 rounded border-slate-600 text-amber-500 focus:ring-amber-500/50"
                  />
                  <div className="flex-1">
                    <p className="text-xs text-slate-200">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {item.area && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                          {item.area}
                        </span>
                      )}
                      {item.priority && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          item.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                          item.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {item.priority}
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {hasActions && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Actions to Trigger</p>
            <div className="space-y-2">
              {proposedChanges.actions!.map((action, i) => (
                <label
                  key={i}
                  className="flex items-start gap-2 p-2 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={selectedActions.has(i)}
                    onChange={() => toggleAction(i)}
                    className="mt-0.5 rounded border-slate-600 text-amber-500 focus:ring-amber-500/50"
                  />
                  <div className="flex-1">
                    <p className="text-xs text-slate-200">
                      {action.type === 'run_lab' && action.labId
                        ? `Run ${action.labId.charAt(0).toUpperCase() + action.labId.slice(1)} Lab`
                        : action.type === 'run_gap'
                        ? 'Run Full GAP Orchestrator'
                        : action.type === 'run_fcb'
                        ? 'Run FCB (Context Builder)'
                        : action.type}
                    </p>
                    {action.justification && (
                      <p className="text-xs text-slate-500 mt-0.5">{action.justification}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Apply Button */}
      <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/30">
        <button
          onClick={onApply}
          disabled={totalSelected === 0 || isApplying}
          className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-medium rounded-lg transition-colors disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
        >
          {isApplying ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Applying...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {getApplyButtonText(selectedUpdates.size, selectedWorkItems.size, selectedActions.size)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty)';
    return `[${value.slice(0, 2).join(', ')}${value.length > 2 ? '...' : ''}]`;
  }
  if (typeof value === 'object') return '{...}';
  const str = String(value);
  return str.length > 30 ? str.substring(0, 30) + '...' : str;
}

function buildApplyConfirmation(result: ApplyResult): string {
  const parts: string[] = ['**Done!**'];

  if (result.updatedFields.length > 0) {
    parts.push(`- Updated ${result.updatedFields.length} context field${result.updatedFields.length > 1 ? 's' : ''}`);
  }
  if (result.createdWorkItems.length > 0) {
    parts.push(`- Created ${result.createdWorkItems.length} work item${result.createdWorkItems.length > 1 ? 's' : ''}:`);
    result.createdWorkItems.forEach(item => {
      parts.push(`  - ${item.title}`);
    });
  }
  if (result.triggeredActions.length > 0) {
    parts.push(`- Triggered ${result.triggeredActions.length} action${result.triggeredActions.length > 1 ? 's' : ''}`);
  }
  if (result.skippedFields.length > 0) {
    parts.push(`\n_Skipped ${result.skippedFields.length} protected field${result.skippedFields.length > 1 ? 's' : ''}_`);
  }

  return parts.join('\n');
}

function getApplyButtonText(updates: number, workItems: number, actions: number): string {
  const parts: string[] = [];

  if (updates > 0) {
    parts.push(`${updates} field${updates > 1 ? 's' : ''}`);
  }
  if (workItems > 0) {
    parts.push(`${workItems} work item${workItems > 1 ? 's' : ''}`);
  }
  if (actions > 0) {
    parts.push(`${actions} action${actions > 1 ? 's' : ''}`);
  }

  if (parts.length === 0) return 'Nothing selected';

  // Determine the right verb
  if (updates > 0 && workItems === 0 && actions === 0) {
    return `Update ${parts[0]}`;
  }
  if (workItems > 0 && updates === 0 && actions === 0) {
    return `Create ${parts[0]}`;
  }
  if (actions > 0 && updates === 0 && workItems === 0) {
    return `Run ${parts[0]}`;
  }

  // Mixed: use generic "Apply"
  return `Apply: ${parts.join(', ')}`;
}

export default CompanyAssistantPanel;
