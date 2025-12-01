'use client';

// components/experiments/ExperimentsClient.tsx
// Shared experiments UI component used across:
// - /experiments (global)
// - /analytics/experiments
// - /c/[companyId]/experiments (company tab)

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type {
  ExperimentRecord,
  ExperimentStatus,
  ExperimentOutcome,
  ExperimentArea,
} from '@/lib/airtable/experiments';

interface ExperimentsClientProps {
  companyId?: string;
  companyName?: string;
  showCompanyColumn?: boolean;
  title?: string;
  description?: string;
}

type FilterStatus = ExperimentStatus | 'all';

const STATUS_COLORS: Record<ExperimentStatus, string> = {
  Idea: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  Planned: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Running: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Concluded: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Archived: 'bg-slate-600/20 text-slate-400 border-slate-600/30',
};

const OUTCOME_COLORS: Record<ExperimentOutcome, string> = {
  Win: 'bg-emerald-500/20 text-emerald-300',
  Loss: 'bg-red-500/20 text-red-300',
  Inconclusive: 'bg-slate-500/20 text-slate-300',
  'Not Run': 'bg-slate-600/20 text-slate-400',
};

const AREA_COLORS: Record<ExperimentArea, string> = {
  Funnel: 'bg-purple-500/20 text-purple-300',
  SEO: 'bg-green-500/20 text-green-300',
  Content: 'bg-blue-500/20 text-blue-300',
  Brand: 'bg-pink-500/20 text-pink-300',
  Demand: 'bg-orange-500/20 text-orange-300',
  Website: 'bg-cyan-500/20 text-cyan-300',
  Other: 'bg-slate-500/20 text-slate-300',
};

export function ExperimentsClient({
  companyId,
  companyName,
  showCompanyColumn = true,
  title = 'Experiments',
  description = 'Track A/B tests, hypotheses, and growth experiments',
}: ExperimentsClientProps) {
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedExperiment, setSelectedExperiment] = useState<ExperimentRecord | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Stats
  const [stats, setStats] = useState<{
    total: number;
    byStatus: Record<ExperimentStatus, number>;
    byOutcome: Record<ExperimentOutcome, number>;
    winRate: number;
  } | null>(null);

  // Fetch experiments
  const fetchExperiments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (companyId) params.set('companyId', companyId);
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const response = await fetch(`/api/experiments?${params.toString()}`);
      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to fetch experiments');
      }

      setExperiments(data.experiments);
    } catch (err) {
      console.error('Error fetching experiments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load experiments');
    } finally {
      setLoading(false);
    }
  }, [companyId, filterStatus]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (companyId) params.set('companyId', companyId);

      const response = await fetch(`/api/experiments/stats?${params.toString()}`);
      const data = await response.json();

      if (data.ok) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching experiment stats:', err);
    }
  }, [companyId]);

  useEffect(() => {
    fetchExperiments();
    fetchStats();
  }, [fetchExperiments, fetchStats]);

  // Update experiment status
  const updateExperimentStatus = async (experimentId: string, newStatus: ExperimentStatus) => {
    setIsUpdating(true);

    try {
      const updates: Record<string, unknown> = { status: newStatus };

      // Auto-set dates based on status
      if (newStatus === 'Running') {
        updates.startDate = new Date().toISOString().split('T')[0];
      } else if (newStatus === 'Concluded') {
        updates.endDate = new Date().toISOString().split('T')[0];
      }

      const response = await fetch(`/api/experiments/${experimentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to update experiment');
      }

      // Refresh list
      fetchExperiments();
      fetchStats();

      // Update selected if open
      if (selectedExperiment?.id === experimentId) {
        setSelectedExperiment(data.experiment);
      }
    } catch (err) {
      console.error('Error updating experiment:', err);
      alert('Failed to update experiment');
    } finally {
      setIsUpdating(false);
    }
  };

  // Update experiment outcome
  const updateExperimentOutcome = async (experimentId: string, outcome: ExperimentOutcome) => {
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/experiments/${experimentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          status: 'Concluded',
          endDate: new Date().toISOString().split('T')[0],
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to update experiment');
      }

      fetchExperiments();
      fetchStats();

      if (selectedExperiment?.id === experimentId) {
        setSelectedExperiment(data.experiment);
      }
    } catch (err) {
      console.error('Error updating experiment:', err);
      alert('Failed to update experiment');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
          {companyName && (
            <p className="text-sm text-amber-400 mt-1">{companyName}</p>
          )}
          <p className="text-sm text-slate-400 mt-1">{description}</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total</div>
            <div className="text-2xl font-bold text-slate-100">{stats.total}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Ideas</div>
            <div className="text-2xl font-bold text-slate-300">{stats.byStatus.Idea}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Running</div>
            <div className="text-2xl font-bold text-amber-400">{stats.byStatus.Running}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Concluded</div>
            <div className="text-2xl font-bold text-emerald-400">{stats.byStatus.Concluded}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Wins</div>
            <div className="text-2xl font-bold text-emerald-400">{stats.byOutcome.Win}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Win Rate</div>
            <div className="text-2xl font-bold text-amber-400">{stats.winRate.toFixed(0)}%</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-slate-400">Filter:</span>
        {(['all', 'Idea', 'Planned', 'Running', 'Concluded'] as FilterStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === status
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {status === 'all' ? 'All' : status}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
          <p className="text-slate-400 mt-4">Loading experiments...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchExperiments}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && experiments.length === 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">No Experiments Yet</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {filterStatus !== 'all'
              ? `No experiments with status "${filterStatus}". Try a different filter or create new experiments from the DMA Funnel insights.`
              : 'Create experiments from AI insights on the DMA Funnel page to start tracking your growth hypotheses.'}
          </p>
          <Link
            href="/analytics/dma"
            className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Go to DMA Funnel
          </Link>
        </div>
      )}

      {/* Experiments List */}
      {!loading && !error && experiments.length > 0 && (
        <div className="space-y-3">
          {experiments.map((experiment) => (
            <div
              key={experiment.id}
              className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors cursor-pointer"
              onClick={() => setSelectedExperiment(experiment)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h3 className="font-semibold text-slate-100">{experiment.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[experiment.status]}`}>
                      {experiment.status}
                    </span>
                    {experiment.outcome && (
                      <span className={`text-xs px-2 py-0.5 rounded ${OUTCOME_COLORS[experiment.outcome]}`}>
                        {experiment.outcome}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded ${AREA_COLORS[experiment.area]}`}>
                      {experiment.area}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-2">{experiment.hypothesis}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span>Metric: {experiment.successMetric}</span>
                    {experiment.expectedLift && (
                      <span className="text-emerald-400">+{experiment.expectedLift}% expected</span>
                    )}
                    {experiment.source && <span>Source: {experiment.source}</span>}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {experiment.status === 'Idea' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateExperimentStatus(experiment.id, 'Planned');
                      }}
                      disabled={isUpdating}
                      className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded transition-colors disabled:opacity-50"
                    >
                      Plan
                    </button>
                  )}
                  {experiment.status === 'Planned' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateExperimentStatus(experiment.id, 'Running');
                      }}
                      disabled={isUpdating}
                      className="text-xs px-2 py-1 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded transition-colors disabled:opacity-50"
                    >
                      Start
                    </button>
                  )}
                  {experiment.status === 'Running' && (
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateExperimentOutcome(experiment.id, 'Win');
                        }}
                        disabled={isUpdating}
                        className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 rounded transition-colors disabled:opacity-50"
                      >
                        Win
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateExperimentOutcome(experiment.id, 'Loss');
                        }}
                        disabled={isUpdating}
                        className="text-xs px-2 py-1 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded transition-colors disabled:opacity-50"
                      >
                        Loss
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateExperimentOutcome(experiment.id, 'Inconclusive');
                        }}
                        disabled={isUpdating}
                        className="text-xs px-2 py-1 bg-slate-500/20 text-slate-300 hover:bg-slate-500/30 rounded transition-colors disabled:opacity-50"
                      >
                        ?
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Experiment Detail Modal */}
      {selectedExperiment && (
        <ExperimentDetailModal
          experiment={selectedExperiment}
          onClose={() => setSelectedExperiment(null)}
          onUpdate={(updated) => {
            setSelectedExperiment(updated);
            fetchExperiments();
            fetchStats();
          }}
          isUpdating={isUpdating}
        />
      )}
    </div>
  );
}

// Detail Modal Component
function ExperimentDetailModal({
  experiment,
  onClose,
  onUpdate,
  isUpdating,
}: {
  experiment: ExperimentRecord;
  onClose: () => void;
  onUpdate: (experiment: ExperimentRecord) => void;
  isUpdating: boolean;
}) {
  const [results, setResults] = useState(experiment.results || '');
  const [learnings, setLearnings] = useState(experiment.learnings || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/experiments/${experiment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, learnings }),
      });

      const data = await response.json();

      if (data.ok) {
        onUpdate(data.experiment);
      }
    } catch (err) {
      console.error('Error saving experiment:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-100">{experiment.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[experiment.status]}`}>
              {experiment.status}
            </span>
            {experiment.outcome && (
              <span className={`text-xs px-2 py-0.5 rounded ${OUTCOME_COLORS[experiment.outcome]}`}>
                {experiment.outcome}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
          {/* Hypothesis */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Hypothesis</label>
            <div className="text-sm text-slate-200 bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              {experiment.hypothesis}
            </div>
          </div>

          {/* Success Metric */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Success Metric</label>
              <div className="text-sm text-slate-200 bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                {experiment.successMetric}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Expected Lift</label>
              <div className="text-sm text-emerald-400 bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                {experiment.expectedLift ? `+${experiment.expectedLift}%` : 'Not specified'}
              </div>
            </div>
          </div>

          {/* Dates */}
          {(experiment.startDate || experiment.endDate) && (
            <div className="grid grid-cols-2 gap-4">
              {experiment.startDate && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Start Date</label>
                  <div className="text-sm text-slate-200 bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                    {experiment.startDate}
                  </div>
                </div>
              )}
              {experiment.endDate && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">End Date</label>
                  <div className="text-sm text-slate-200 bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                    {experiment.endDate}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results (editable) */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Results</label>
            <textarea
              value={results}
              onChange={(e) => setResults(e.target.value)}
              placeholder="What actually happened? Enter results here..."
              className="w-full h-24 text-sm text-slate-200 bg-slate-800/50 border border-slate-700 rounded-lg p-3 focus:border-amber-500 focus:outline-none resize-none"
            />
          </div>

          {/* Learnings (editable) */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Learnings</label>
            <textarea
              value={learnings}
              onChange={(e) => setLearnings(e.target.value)}
              placeholder="Key takeaways from this experiment..."
              className="w-full h-24 text-sm text-slate-200 bg-slate-800/50 border border-slate-700 rounded-lg p-3 focus:border-amber-500 focus:outline-none resize-none"
            />
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Area</label>
              <span className={`inline-block text-xs px-2 py-1 rounded ${AREA_COLORS[experiment.area]}`}>
                {experiment.area}
              </span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Source</label>
              <span className="text-xs text-slate-300">{experiment.source}</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Created</label>
              <span className="text-xs text-slate-300">
                {experiment.createdAt ? new Date(experiment.createdAt).toLocaleDateString() : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-800 bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
