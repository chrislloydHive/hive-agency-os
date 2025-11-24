// components/website/WebsiteActionPlanView.tsx
// Website Diagnostic Action Plan - Action-First UI
//
// This is the PRIMARY view for Website diagnostics.
// Shows: What to do now, next, later.
// NOT: A report. This is a work planning tool.

'use client';

import { useState } from 'react';
import type {
  WebsiteActionPlan,
  WebsiteWorkItem,
  ServiceArea,
} from '@/lib/gap-heavy/modules/websiteActionPlan';
import {
  getServiceAreaLabel,
  getDimensionLabel,
  filterWorkItems,
  groupByServiceArea,
} from '@/lib/gap-heavy/modules/websiteActionPlan';

type Props = {
  actionPlan: WebsiteActionPlan;
  companyName?: string;
  companyUrl?: string;
  companyId?: string;
  onSendToWork?: (item: WebsiteWorkItem) => void;
};

export function WebsiteActionPlanView({
  actionPlan,
  companyName,
  companyUrl,
  companyId,
  onSendToWork,
}: Props) {
  const [serviceAreaFilter, setServiceAreaFilter] = useState<ServiceArea | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Filter work items
  const filterItems = (items: WebsiteWorkItem[]) => {
    if (serviceAreaFilter === 'all') return items;
    return filterWorkItems(items, { serviceArea: serviceAreaFilter });
  };

  const filteredNow = filterItems(actionPlan.now);
  const filteredNext = filterItems(actionPlan.next);
  const filteredLater = filterItems(actionPlan.later);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-slate-100">{companyName || 'Website Diagnostics'}</h1>
            {companyUrl && <p className="mt-1 text-sm text-slate-400">{companyUrl}</p>}
          </div>

          {/* Grade & Summary */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-slate-100">
                  {actionPlan.benchmarkLabel?.toUpperCase() || 'AVERAGE'}
                </span>
                <span className="text-lg text-slate-400">({actionPlan.overallScore}/100)</span>
              </div>
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {actionPlan.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="space-y-8">
          {/* Filter Bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-slate-400 hover:text-slate-300"
            >
              {showFilters ? '✕ Hide Filters' : '☰ Show Filters'}
            </button>
          </div>

          {showFilters && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setServiceAreaFilter('all')}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                    serviceAreaFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  All
                </button>
                {(['brand', 'content', 'website', 'seo', 'authority', 'analytics'] as ServiceArea[]).map(
                  (area) => (
                    <button
                      key={area}
                      onClick={() => setServiceAreaFilter(area)}
                      className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                        serviceAreaFilter === area
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {getServiceAreaLabel(area)}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Key Themes Overview */}
          {actionPlan.keyThemes && actionPlan.keyThemes.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl font-bold text-slate-100">Key Themes</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {actionPlan.keyThemes.slice(0, 6).map((theme) => (
                  <div
                    key={theme.id}
                    className="rounded-lg border border-slate-700 bg-slate-900/50 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-100">{theme.label}</h3>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          theme.priority === 'critical'
                            ? 'bg-red-600/20 text-red-400'
                            : theme.priority === 'important'
                            ? 'bg-yellow-600/20 text-yellow-400'
                            : 'bg-slate-600/20 text-slate-400'
                        }`}
                      >
                        {theme.priority}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-400">{theme.description}</p>
                    {theme.expectedImpactSummary && (
                      <p className="mt-2 text-xs font-medium text-slate-500">
                        💡 {theme.expectedImpactSummary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* NOW Bucket */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-100">
                What to Do Now
                <span className="ml-2 text-lg font-normal text-slate-400">
                  ({filteredNow.length} items)
                </span>
              </h2>
            </div>
            <p className="mb-4 text-sm text-slate-400">
              High-priority actions for immediate impact (0-30 days)
            </p>
            <div className="space-y-3">
              {filteredNow.length === 0 ? (
                <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 text-center text-sm text-slate-400">
                  No items match the current filters
                </div>
              ) : (
                filteredNow.map((item) => (
                  <WorkItemCard
                    key={item.id}
                    item={item}
                    companyId={companyId}
                    onSendToWork={onSendToWork}
                  />
                ))
              )}
            </div>
          </section>

          {/* NEXT Bucket */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-100">
                Next
                <span className="ml-2 text-lg font-normal text-slate-400">
                  ({filteredNext.length} items)
                </span>
              </h2>
            </div>
            <p className="mb-4 text-sm text-slate-400">
              Medium-priority actions for sustained improvement (30-90 days)
            </p>
            <details open className="group">
              <summary className="mb-3 cursor-pointer text-sm text-slate-400 hover:text-slate-300">
                {filteredNext.length > 0 ? '▼ Show items' : 'No items'}
              </summary>
              <div className="space-y-3">
                {filteredNext.map((item) => (
                  <WorkItemCard
                    key={item.id}
                    item={item}
                    companyId={companyId}
                    onSendToWork={onSendToWork}
                  />
                ))}
              </div>
            </details>
          </section>

          {/* LATER Bucket */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-100">
                Later
                <span className="ml-2 text-lg font-normal text-slate-400">
                  ({filteredLater.length} items)
                </span>
              </h2>
            </div>
            <p className="mb-4 text-sm text-slate-400">
              Lower-priority improvements for ongoing optimization (90+ days)
            </p>
            <details className="group">
              <summary className="mb-3 cursor-pointer text-sm text-slate-400 hover:text-slate-300">
                {filteredLater.length > 0 ? '▶ Show items' : 'No items'}
              </summary>
              <div className="space-y-3">
                {filteredLater.map((item) => (
                  <WorkItemCard
                    key={item.id}
                    item={item}
                    companyId={companyId}
                    onSendToWork={onSendToWork}
                  />
                ))}
              </div>
            </details>
          </section>

          {/* Experiments */}
          {actionPlan.experiments && actionPlan.experiments.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl font-bold text-slate-100">
                Suggested Experiments
                <span className="ml-2 text-lg font-normal text-slate-400">
                  ({actionPlan.experiments.length})
                </span>
              </h2>
              <p className="mb-4 text-sm text-slate-400">
                A/B tests to validate hypotheses and measure impact
              </p>
              <details className="group">
                <summary className="mb-3 cursor-pointer text-sm text-slate-400 hover:text-slate-300">
                  ▶ Show experiments
                </summary>
                <div className="space-y-3">
                  {actionPlan.experiments.map((exp) => (
                    <div
                      key={exp.id}
                      className="rounded-lg border border-slate-700 bg-slate-900/50 p-4"
                    >
                      <h3 className="mb-2 text-sm font-semibold text-slate-100">{exp.hypothesis}</h3>
                      <p className="mb-2 text-xs leading-relaxed text-slate-300">{exp.description}</p>
                      <div className="flex gap-4 text-xs text-slate-400">
                        <span>Metric: <span className="font-medium text-slate-300">{exp.metric}</span></span>
                        {exp.expectedLift && (
                          <>
                            <span>•</span>
                            <span>Expected: <span className="font-medium text-green-400">+{exp.expectedLift}%</span></span>
                          </>
                        )}
                        <span>•</span>
                        <span>Effort: <span className="font-medium text-slate-300">{exp.effortScore}/5</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </section>
          )}

          {/* Strategic Changes */}
          {actionPlan.strategicChanges && actionPlan.strategicChanges.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl font-bold text-slate-100">
                Strategic Changes
                <span className="ml-2 text-lg font-normal text-slate-400">
                  ({actionPlan.strategicChanges.length})
                </span>
              </h2>
              <p className="mb-4 text-sm text-slate-400">
                Broader strategic recommendations beyond tactical fixes
              </p>
              <div className="space-y-3">
                {actionPlan.strategicChanges.map((change) => (
                  <div
                    key={change.id}
                    className="rounded-lg border border-slate-700 bg-slate-900/50 p-4"
                  >
                    <h3 className="mb-2 text-sm font-semibold text-slate-100">{change.title}</h3>
                    <p className="mb-2 text-xs leading-relaxed text-slate-300">{change.description}</p>
                    <p className="text-xs text-slate-500">
                      <strong>Why:</strong> {change.reasoning}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// WORK ITEM CARD COMPONENT
// ============================================================================

type WorkItemCardProps = {
  item: WebsiteWorkItem;
  companyId?: string;
  onSendToWork?: (item: WebsiteWorkItem) => void;
};

function WorkItemCard({ item, companyId, onSendToWork }: WorkItemCardProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendToWork = async () => {
    if (!companyId) {
      alert('Company ID not available');
      return;
    }

    setSending(true);
    try {
      // Call API to create work item
      const response = await fetch('/api/work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          workItem: item,
          source: 'website_lab',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send to work queue');
      }

      setSent(true);
      if (onSendToWork) {
        onSendToWork(item);
      }
    } catch (error) {
      console.error('Error sending to work:', error);
      alert('Failed to send to work queue. See console for details.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 transition-all hover:border-slate-600">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="mb-1 text-sm font-semibold text-slate-100">{item.title}</h3>
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
              {getServiceAreaLabel(item.serviceArea)}
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
              {getDimensionLabel(item.dimension)}
            </span>
            {item.estimatedLift && (
              <span className="rounded bg-green-600/20 px-2 py-0.5 text-xs font-semibold text-green-400">
                +{item.estimatedLift}% lift
              </span>
            )}
          </div>
        </div>
        {companyId && (
          <button
            onClick={handleSendToWork}
            disabled={sending || sent}
            className={`flex-shrink-0 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              sent
                ? 'bg-green-600/20 text-green-400 cursor-not-allowed'
                : sending
                ? 'bg-slate-700 text-slate-400 cursor-wait'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {sent ? '✓ Sent' : sending ? 'Sending...' : 'Send to Work'}
          </button>
        )}
      </div>

      <p className="mb-2 text-xs leading-relaxed text-slate-300">{item.description}</p>

      <div className="mb-2 rounded bg-slate-800/50 p-2">
        <p className="text-xs text-slate-400">
          <strong className="text-slate-300">Why:</strong> {item.rationale}
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-400">
        <span>
          Impact: <span className="font-medium text-slate-300">{item.impactScore}/5</span>
        </span>
        <span>•</span>
        <span>
          Effort: <span className="font-medium text-slate-300">{item.effortScore}/5</span>
        </span>
        {item.recommendedTimebox && (
          <>
            <span>•</span>
            <span>
              Time: <span className="font-medium text-slate-300">{item.recommendedTimebox}</span>
            </span>
          </>
        )}
        {item.recommendedAssigneeRole && (
          <>
            <span>•</span>
            <span>
              Role: <span className="font-medium text-slate-300">{item.recommendedAssigneeRole}</span>
            </span>
          </>
        )}
      </div>

      {item.tags && item.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded bg-slate-800/50 px-1.5 py-0.5 text-xs text-slate-500">
              {tag}
            </span>
          ))}
        </div>
      )}

      {item.evidenceRefs && item.evidenceRefs.length > 0 && (
        <div className="mt-2 text-xs text-slate-500">
          Evidence: {item.evidenceRefs.length} source{item.evidenceRefs.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
