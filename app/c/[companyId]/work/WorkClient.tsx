'use client';

// app/c/[companyId]/work/WorkClient.tsx
// Work Hub - Tasks, Experiments, and Backlog
//
// This component manages the Work section with sub-tabs:
// - Tasks: Active work items (In Progress, Planned, Done)
// - Experiments: A/B tests and growth experiments
// - Backlog: Suggested work from diagnostics

import { useState, useCallback } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import type {
  WorkItemRecord,
  WorkItemStatus,
} from '@/lib/airtable/workItems';
import type { PriorityItem, PrioritiesPayload } from '@/lib/airtable/fullReports';
import type { EvidencePayload } from '@/lib/gap/types';
import type { CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import PriorityCardWithAction from './PriorityCardWithAction';
import WorkItemCardWithStatus from './WorkItemCardWithStatus';
import { ExperimentsClient } from '@/components/experiments/ExperimentsClient';

// ============================================================================
// Types
// ============================================================================

interface CompanyData {
  id: string;
  name: string;
  website?: string | null;
}

export interface WorkClientProps {
  company: CompanyData;
  workItems: WorkItemRecord[];
  priorities: PriorityItem[];
  evidence?: EvidencePayload;
  strategicSnapshot?: CompanyStrategicSnapshot | null;
  fullReportId?: string;
  workItemsByPriorityId: Record<string, WorkItemRecord>;
}

type ActiveTab = 'tasks' | 'experiments' | 'backlog';

// ============================================================================
// Main Component
// ============================================================================

export function WorkClient({
  company,
  workItems,
  priorities,
  evidence,
  strategicSnapshot,
  fullReportId,
  workItemsByPriorityId,
}: WorkClientProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('tasks');
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItemRecord | null>(null);
  const [aiAdditionalInfo, setAiAdditionalInfo] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Group work items by status
  const grouped = {
    'In Progress': workItems.filter((item) => item.status === 'In Progress'),
    'Planned': workItems.filter((item) => item.status === 'Planned'),
    'Backlog': workItems.filter((item) => item.status === 'Backlog'),
    'Done': workItems.filter((item) => item.status === 'Done'),
  };

  const activeItems = workItems.filter((w) => w.status !== 'Done');
  const doneItems = workItems.filter((w) => w.status === 'Done');

  // Handle selecting a work item
  const handleSelectWorkItem = useCallback((item: WorkItemRecord | null) => {
    if (item && selectedWorkItem?.id === item.id) {
      setSelectedWorkItem(null);
      setAiAdditionalInfo(null);
      setAiError(null);
    } else if (item) {
      setSelectedWorkItem(item);
      setAiAdditionalInfo(item.aiAdditionalInfo || null);
      setAiError(null);
    } else {
      setSelectedWorkItem(null);
      setAiAdditionalInfo(null);
      setAiError(null);
    }
  }, [selectedWorkItem?.id]);

  // Fetch AI additional info
  const handleAdditionalInfo = useCallback(async () => {
    if (!selectedWorkItem) return;

    setLoadingAI(true);
    setAiError(null);

    try {
      const response = await fetch('/api/work/additional-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workItemId: selectedWorkItem.id }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to generate additional info');
      }

      setAiAdditionalInfo(data.markdown);
      setSelectedWorkItem((prev) => prev ? { ...prev, aiAdditionalInfo: data.markdown } : null);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoadingAI(false);
    }
  }, [selectedWorkItem]);

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="border-b border-slate-800">
        <nav className="flex gap-4">
          <TabButton
            active={activeTab === 'tasks'}
            onClick={() => setActiveTab('tasks')}
            count={activeItems.length}
          >
            Tasks
          </TabButton>
          <TabButton
            active={activeTab === 'experiments'}
            onClick={() => setActiveTab('experiments')}
          >
            Experiments
          </TabButton>
          <TabButton
            active={activeTab === 'backlog'}
            onClick={() => setActiveTab('backlog')}
            count={priorities.length}
          >
            Opportunities
          </TabButton>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'tasks' && (
        <TasksSection
          grouped={grouped}
          activeItems={activeItems}
          doneItems={doneItems}
          selectedWorkItem={selectedWorkItem}
          onSelectWorkItem={handleSelectWorkItem}
          aiAdditionalInfo={aiAdditionalInfo}
          loadingAI={loadingAI}
          aiError={aiError}
          onAdditionalInfo={handleAdditionalInfo}
          companyId={company.id}
        />
      )}

      {activeTab === 'experiments' && (
        <ExperimentsClient
          companyId={company.id}
          companyName={company.name}
          showCompanyColumn={false}
          title=""
          description=""
        />
      )}

      {activeTab === 'backlog' && (
        <BacklogSection
          priorities={priorities}
          evidence={evidence}
          strategicSnapshot={strategicSnapshot}
          fullReportId={fullReportId}
          companyId={company.id}
          workItemsByPriorityId={workItemsByPriorityId}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function TabButton({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
        active
          ? 'border-amber-500 text-amber-400'
          : 'border-transparent text-slate-400 hover:text-slate-300'
      }`}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={`px-1.5 py-0.5 text-xs rounded ${
          active ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-400'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function TasksSection({
  grouped,
  activeItems,
  doneItems,
  selectedWorkItem,
  onSelectWorkItem,
  aiAdditionalInfo,
  loadingAI,
  aiError,
  onAdditionalInfo,
  companyId,
}: {
  grouped: Record<WorkItemStatus, WorkItemRecord[]>;
  activeItems: WorkItemRecord[];
  doneItems: WorkItemRecord[];
  selectedWorkItem: WorkItemRecord | null;
  onSelectWorkItem: (item: WorkItemRecord | null) => void;
  aiAdditionalInfo: string | null;
  loadingAI: boolean;
  aiError: string | null;
  onAdditionalInfo: () => void;
  companyId: string;
}) {
  const hasWorkItems = activeItems.length > 0 || doneItems.length > 0;

  return (
    <div className="space-y-6">
      {/* Active Work */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Active Tasks ({activeItems.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Click a row to see implementation details</p>
          </div>
          <button className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors text-xs">
            Add Task
          </button>
        </div>

        {!hasWorkItems ? (
          <EmptyState
            title="No Tasks Yet"
            description="Tasks represent committed initiatives. Suggested work from diagnostics appears in the Opportunities tab."
          />
        ) : (
          <div className="space-y-6">
            {(Object.keys(grouped) as WorkItemStatus[])
              .filter(status => status !== 'Done')
              .map((status) => {
                const items = grouped[status];
                if (items.length === 0) return null;

                return (
                  <div key={status}>
                    <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
                      {status} ({items.length})
                    </h4>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <WorkItemCardWithStatus
                          key={item.id}
                          item={item}
                          isSelected={selectedWorkItem?.id === item.id}
                          onClick={() => onSelectWorkItem(item)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Work Item Detail Panel */}
      {selectedWorkItem && (
        <WorkItemDetailPanel
          item={selectedWorkItem}
          aiAdditionalInfo={aiAdditionalInfo}
          loadingAI={loadingAI}
          aiError={aiError}
          onAdditionalInfo={onAdditionalInfo}
          onClose={() => onSelectWorkItem(null)}
        />
      )}

      {/* Completed Work */}
      {doneItems.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Completed ({doneItems.length})
          </h3>
          <div className="space-y-2">
            {doneItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg opacity-70 cursor-pointer hover:opacity-100"
                onClick={() => onSelectWorkItem(item)}
              >
                <span className="text-sm text-slate-400 line-through">{item.title}</span>
                <span className="text-xs text-emerald-500">Done</span>
              </div>
            ))}
            {doneItems.length > 5 && (
              <p className="text-xs text-slate-500 text-center pt-2">
                + {doneItems.length - 5} more completed
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkItemDetailPanel({
  item,
  aiAdditionalInfo,
  loadingAI,
  aiError,
  onAdditionalInfo,
  onClose,
}: {
  item: WorkItemRecord;
  aiAdditionalInfo: string | null;
  loadingAI: boolean;
  aiError: string | null;
  onAdditionalInfo: () => void;
  onClose: () => void;
}) {
  const formatDate = (dateStr?: string | null) => {
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
  };

  return (
    <>
      <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100">{item.title}</h3>
            <p className="mt-1 text-xs text-slate-500">
              Source: {item.notes?.includes('Analytics AI') ? 'Analytics AI' : 'Manual'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4 text-[11px]">
          {item.area && (
            <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300">
              {item.area}
            </span>
          )}
          {item.status && (
            <span className={`px-2 py-0.5 rounded ${
              item.status === 'In Progress'
                ? 'bg-blue-500/20 text-blue-300'
                : item.status === 'Planned'
                ? 'bg-purple-500/20 text-purple-300'
                : item.status === 'Done'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-slate-500/20 text-slate-300'
            }`}>
              {item.status}
            </span>
          )}
          {item.severity && (
            <span className={`px-2 py-0.5 rounded ${
              item.severity === 'High'
                ? 'bg-red-500/20 text-red-300'
                : item.severity === 'Medium'
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-slate-500/20 text-slate-300'
            }`}>
              {item.severity} priority
            </span>
          )}
        </div>

        <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed prose prose-invert prose-sm max-w-none">
          {item.notes || 'No additional details provided.'}
        </div>

        {item.dueDate && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-xs text-slate-400">Due: {formatDate(item.dueDate)}</p>
          </div>
        )}

        {/* Additional Information Button */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <button
            onClick={onAdditionalInfo}
            disabled={loadingAI}
            className="inline-flex items-center rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-60"
          >
            {loadingAI ? 'Generating...' : aiAdditionalInfo ? 'Regenerate Info' : 'Additional Information'}
          </button>
          {aiError && <p className="mt-2 text-xs text-red-400">{aiError}</p>}
        </div>
      </div>

      {/* AI Additional Information Card */}
      {aiAdditionalInfo && (
        <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              AI Implementation Guide
            </h4>
            <span className="text-xs text-slate-500">Generated by AI</span>
          </div>
          <div className="prose prose-invert prose-sm max-w-none text-slate-200">
            <ReactMarkdown>{aiAdditionalInfo}</ReactMarkdown>
          </div>
        </div>
      )}
    </>
  );
}

function BacklogSection({
  priorities,
  evidence,
  strategicSnapshot,
  fullReportId,
  companyId,
  workItemsByPriorityId,
}: {
  priorities: PriorityItem[];
  evidence?: EvidencePayload;
  strategicSnapshot?: CompanyStrategicSnapshot | null;
  fullReportId?: string;
  companyId: string;
  workItemsByPriorityId: Record<string, WorkItemRecord>;
}) {
  const hasPriorities = priorities.length > 0;
  const hasFocusAreas = strategicSnapshot?.focusAreas && strategicSnapshot.focusAreas.length > 0;

  return (
    <div className="space-y-6">
      {/* Strategic Focus Areas */}
      {hasFocusAreas && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Strategic Focus Areas
            </h3>
            <p className="text-xs text-slate-500 mt-1">From Brain synthesis</p>
          </div>
          <ol className="space-y-2">
            {strategicSnapshot!.focusAreas.slice(0, 5).map((area, index) => (
              <li key={index} className="flex items-start gap-3 group">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium flex items-center justify-center border border-blue-500/30">
                  {index + 1}
                </span>
                <span className="flex-1 text-sm text-slate-300 pt-0.5">{area}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Telemetry Highlights */}
      {evidence && (evidence.metrics?.length || evidence.insights?.length) && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Telemetry Highlights
          </h3>

          {evidence.insights && evidence.insights.length > 0 && (
            <div className="space-y-2.5 mb-4">
              {evidence.insights
                .filter((insight) =>
                  !insight.area ||
                  insight.area === 'SEO' ||
                  insight.area === 'Content' ||
                  insight.area === 'Website UX'
                )
                .slice(0, 3)
                .map((insight) => {
                  const headline = insight.headline || insight.title || 'Untitled';
                  const detail = insight.detail || insight.description;

                  return (
                    <div
                      key={insight.id}
                      className="rounded-lg border border-slate-700/50 bg-[#050509]/50 px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2">
                        {insight.severity && (
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                            insight.severity.toLowerCase() === 'critical' ? 'bg-red-500' :
                            insight.severity.toLowerCase() === 'high' ? 'bg-orange-500' :
                            insight.severity.toLowerCase() === 'medium' ? 'bg-amber-500' :
                            insight.severity.toLowerCase() === 'low' ? 'bg-sky-500' :
                            'bg-blue-500'
                          }`} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-200 leading-snug">{headline}</p>
                          {detail && (
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{detail}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Suggested Work from Full Report */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Suggested Work from OS
          </h3>
          <p className="text-xs text-slate-500 mt-1">From latest Full Report</p>
        </div>

        {!hasPriorities ? (
          <EmptyState
            title="No Priorities Found"
            description="No structured priorities were found. Run diagnostics to generate opportunities."
          />
        ) : (
          <div className="space-y-3">
            {priorities.slice(0, 10).map((priority, idx) => {
              const hasWorkItem = priority.id ? !!workItemsByPriorityId[priority.id] : false;
              const matchingInsight =
                (priority.area === 'SEO' || priority.area === 'Content' || priority.area === 'Website UX') &&
                evidence?.insights
                  ? evidence.insights.find((insight) => insight.area === priority.area)
                  : undefined;

              return (
                <PriorityCardWithAction
                  key={priority.id || idx}
                  priority={priority}
                  companyId={companyId}
                  fullReportId={fullReportId || ''}
                  hasWorkItem={hasWorkItem}
                  evidenceInsight={matchingInsight}
                />
              );
            })}

            {priorities.length > 10 && (
              <p className="text-xs text-slate-500 text-center pt-2">
                + {priorities.length - 10} more priorities
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-8">
      <div className="mb-4">
        <svg
          className="mx-auto h-12 w-12 text-slate-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-slate-200 mb-2">{title}</h3>
      <p className="text-xs text-slate-400 max-w-md mx-auto">{description}</p>
    </div>
  );
}
