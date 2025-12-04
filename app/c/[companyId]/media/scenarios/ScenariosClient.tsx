'use client';

// app/c/[companyId]/media/scenarios/ScenariosClient.tsx
// Client component for scenario planning page
//
// Handles:
// - Scenario state management
// - CRUD operations via API
// - Forecast running

import { useState, useCallback, useEffect } from 'react';
import {
  MediaScenarioList,
  MediaScenarioEditor,
  MediaScenarioForecastPanel,
} from '@/components/media/scenarios';
import type { MediaScenario } from '@/lib/media/types';
import type { MediaForecastResult } from '@/lib/media/forecastEngine';

interface ScenariosClientProps {
  companyId: string;
  companyName: string;
  initialScenarios: MediaScenario[];
  hasActivePlan: boolean;
  activePlanId?: string;
}

export function ScenariosClient({
  companyId,
  companyName,
  initialScenarios,
  hasActivePlan,
  activePlanId,
}: ScenariosClientProps) {
  // State
  const [scenarios, setScenarios] = useState<MediaScenario[]>(initialScenarios);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(
    initialScenarios[0]?.id || null
  );
  const [editedScenario, setEditedScenario] = useState<MediaScenario | null>(null);
  const [forecast, setForecast] = useState<MediaForecastResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isForecasting, setIsForecasting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Set active scenario when selection changes
  useEffect(() => {
    if (activeScenarioId) {
      const scenario = scenarios.find(s => s.id === activeScenarioId);
      if (scenario) {
        setEditedScenario({ ...scenario });
        setForecast(null); // Clear forecast when switching scenarios
      }
    } else {
      setEditedScenario(null);
      setForecast(null);
    }
  }, [activeScenarioId, scenarios]);

  // Refresh scenarios from API
  const refreshScenarios = useCallback(async () => {
    try {
      const res = await fetch(`/api/media/scenarios/${companyId}`);
      if (res.ok) {
        const data = await res.json();
        setScenarios(data.scenarios);
      }
    } catch (err) {
      console.error('Failed to refresh scenarios:', err);
    }
  }, [companyId]);

  // Create new scenario
  const handleCreate = useCallback(async (fromPlan: boolean = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const body: any = {
        name: `New Scenario ${new Date().toLocaleDateString()}`,
        timeHorizon: 'month',
        totalBudget: 0,
      };

      if (fromPlan && activePlanId) {
        body.fromMediaPlanId = activePlanId;
        body.name = `From Current Plan`;
      }

      const res = await fetch(`/api/media/scenarios/${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to create scenario');

      const data = await res.json();
      setScenarios(prev => [data.scenario, ...prev]);
      setActiveScenarioId(data.scenario.id);
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scenario');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, activePlanId]);

  // Save scenario
  const handleSave = useCallback(async () => {
    if (!editedScenario) return;

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/media/scenarios/${companyId}/${editedScenario.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editedScenario.name,
          description: editedScenario.description,
          timeHorizon: editedScenario.timeHorizon,
          periodLabel: editedScenario.periodLabel,
          totalBudget: editedScenario.totalBudget,
          allocations: editedScenario.allocations,
          goal: editedScenario.goal,
        }),
      });

      if (!res.ok) throw new Error('Failed to save scenario');

      const data = await res.json();
      setScenarios(prev =>
        prev.map(s => (s.id === data.scenario.id ? data.scenario : s))
      );
      setEditedScenario(data.scenario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save scenario');
    } finally {
      setIsSaving(false);
    }
  }, [companyId, editedScenario]);

  // Run forecast
  const handleRunForecast = useCallback(async () => {
    if (!editedScenario) return;

    // Save first, then run forecast
    await handleSave();

    setIsForecasting(true);
    setError(null);
    setForecast(null);

    try {
      const res = await fetch(
        `/api/media/scenarios/${companyId}/${editedScenario.id}/forecast`,
        { method: 'POST' }
      );

      if (!res.ok) throw new Error('Failed to run forecast');

      const data = await res.json();
      setForecast(data.forecast);

      // Refresh to get updated forecast summary
      await refreshScenarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run forecast');
    } finally {
      setIsForecasting(false);
    }
  }, [companyId, editedScenario, handleSave, refreshScenarios]);

  // Duplicate scenario
  const handleDuplicate = useCallback(async (scenarioId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/media/scenarios/${companyId}/${scenarioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate' }),
      });

      if (!res.ok) throw new Error('Failed to duplicate scenario');

      const data = await res.json();
      setScenarios(prev => [data.scenario, ...prev]);
      setActiveScenarioId(data.scenario.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate scenario');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // Set recommended
  const handleSetRecommended = useCallback(async (scenarioId: string, recommended: boolean) => {
    try {
      const res = await fetch(`/api/media/scenarios/${companyId}/${scenarioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setRecommended', recommended }),
      });

      if (!res.ok) throw new Error('Failed to update recommendation');

      await refreshScenarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update recommendation');
    }
  }, [companyId, refreshScenarios]);

  // Delete scenario
  const handleDelete = useCallback(async (scenarioId: string) => {
    try {
      const res = await fetch(`/api/media/scenarios/${companyId}/${scenarioId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete scenario');

      setScenarios(prev => prev.filter(s => s.id !== scenarioId));

      if (activeScenarioId === scenarioId) {
        setActiveScenarioId(scenarios.find(s => s.id !== scenarioId)?.id || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete scenario');
    }
  }, [companyId, activeScenarioId, scenarios]);

  return (
    <div className="flex gap-6 min-h-[600px]">
      {/* Left rail - Scenario list */}
      <div className="w-72 flex-shrink-0">
        <MediaScenarioList
          scenarios={scenarios}
          activeScenarioId={activeScenarioId}
          onSelect={setActiveScenarioId}
          onCreate={() => setShowCreateModal(true)}
          onDuplicate={handleDuplicate}
          onSetRecommended={handleSetRecommended}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      </div>

      {/* Right side - Editor and Forecast */}
      <div className="flex-1 min-w-0">
        {editedScenario ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor column */}
            <div>
              <MediaScenarioEditor
                scenario={editedScenario}
                onChange={setEditedScenario}
                onSave={handleSave}
                onRunForecast={handleRunForecast}
                isSaving={isSaving}
                isForecasting={isForecasting}
              />
            </div>

            {/* Forecast column */}
            <div>
              <MediaScenarioForecastPanel
                scenario={editedScenario}
                forecast={forecast}
                isLoading={isForecasting}
                error={error || undefined}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-200 mb-2">Scenario Planning</h3>
              <p className="text-sm text-slate-400 mb-6">
                Create scenarios to explore different budget and channel mix strategies for {companyName}.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Your First Scenario
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create scenario modal */}
      {showCreateModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="fixed inset-x-4 top-1/4 z-50 max-w-sm mx-auto bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Create New Scenario</h3>

            <div className="space-y-3">
              <button
                onClick={() => handleCreate(false)}
                disabled={isLoading}
                className="w-full px-4 py-3 text-left bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-700/50 transition-colors disabled:opacity-50"
              >
                <div className="text-sm font-medium text-slate-200">Start from scratch</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Create an empty scenario with default channels
                </div>
              </button>

              {hasActivePlan && (
                <button
                  onClick={() => handleCreate(true)}
                  disabled={isLoading}
                  className="w-full px-4 py-3 text-left bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-700/50 transition-colors disabled:opacity-50"
                >
                  <div className="text-sm font-medium text-slate-200">
                    Start from current plan
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Initialize with your active media plan's budget and channels
                  </div>
                </button>
              )}
            </div>

            <button
              onClick={() => setShowCreateModal(false)}
              className="w-full mt-4 px-4 py-2 text-xs text-slate-400 hover:text-slate-300 border border-slate-700 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Global error toast */}
      {error && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-500/10 border border-red-500/30 rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-red-400">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-400/70 hover:text-red-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
