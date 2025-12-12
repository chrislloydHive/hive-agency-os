'use client';

// app/c/[companyId]/strategy/StrategyWorkspaceClient.tsx
// Strategy Workspace Client Component
//
// Provides UI for creating, editing, and finalizing marketing strategies
// with AI-assisted pillar generation.

import { useState, useCallback } from 'react';
import {
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Target,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Zap,
} from 'lucide-react';
import type {
  CompanyStrategy,
  StrategyPillar,
  StrategyService,
  SERVICE_LABELS,
  PRIORITY_COLORS,
} from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

interface StrategyWorkspaceClientProps {
  companyId: string;
  companyName: string;
  initialStrategy: CompanyStrategy | null;
  contextObjectives: string[];
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ============================================================================
// Main Component
// ============================================================================

export function StrategyWorkspaceClient({
  companyId,
  companyName,
  initialStrategy,
  contextObjectives,
}: StrategyWorkspaceClientProps) {
  const [strategy, setStrategy] = useState<Partial<CompanyStrategy>>(
    initialStrategy || {
      companyId,
      title: '',
      summary: '',
      objectives: contextObjectives,
      pillars: [],
      status: 'draft',
    }
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const isFinalized = strategy.status === 'finalized';

  // Update strategy field
  const updateField = useCallback(
    <K extends keyof CompanyStrategy>(field: K, value: CompanyStrategy[K]) => {
      setStrategy(prev => ({ ...prev, [field]: value }));
      setSaveStatus('idle');
    },
    []
  );

  // Pillar operations
  const addPillar = useCallback(() => {
    const newPillar: StrategyPillar = {
      id: `pillar_${Date.now()}`,
      title: '',
      description: '',
      priority: 'medium',
      services: [],
      kpis: [],
    };
    setStrategy(prev => ({
      ...prev,
      pillars: [...(prev.pillars || []), newPillar],
    }));
    setSaveStatus('idle');
  }, []);

  const updatePillar = useCallback((index: number, updates: Partial<StrategyPillar>) => {
    setStrategy(prev => {
      const pillars = [...(prev.pillars || [])];
      pillars[index] = { ...pillars[index], ...updates };
      return { ...prev, pillars };
    });
    setSaveStatus('idle');
  }, []);

  const removePillar = useCallback((index: number) => {
    setStrategy(prev => ({
      ...prev,
      pillars: (prev.pillars || []).filter((_, i) => i !== index),
    }));
    setSaveStatus('idle');
  }, []);

  // Save strategy
  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    setError(null);

    try {
      const endpoint = strategy.id
        ? '/api/os/strategy/update'
        : '/api/os/strategy/create';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          strategy.id
            ? { strategyId: strategy.id, updates: strategy }
            : { companyId, ...strategy }
        ),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to save strategy');
      }

      if (data.strategy) {
        setStrategy(data.strategy);
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('[StrategyWorkspaceClient] Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaveStatus('error');
    }
  }, [companyId, strategy]);

  // AI propose strategy
  const handleAiPropose = useCallback(async () => {
    setAiLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/os/strategy/ai-propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'AI propose failed');
      }

      if (data.proposal) {
        setStrategy(prev => ({
          ...prev,
          title: data.proposal.title || prev.title,
          summary: data.proposal.summary || prev.summary,
          objectives: data.proposal.objectives || prev.objectives,
          pillars: data.proposal.pillars?.map((p: Omit<StrategyPillar, 'id'>, i: number) => ({
            ...p,
            id: `pillar_${Date.now()}_${i}`,
          })) || prev.pillars,
        }));
        setSaveStatus('idle');
      }
    } catch (err) {
      console.error('[StrategyWorkspaceClient] AI propose error:', err);
      setError(err instanceof Error ? err.message : 'AI propose failed');
    } finally {
      setAiLoading(false);
    }
  }, [companyId]);

  // Finalize strategy
  const handleFinalize = useCallback(async () => {
    if (!strategy.id) {
      setError('Please save the strategy first');
      return;
    }

    setFinalizing(true);
    setError(null);

    try {
      const response = await fetch('/api/os/strategy/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: strategy.id,
          generateWork: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Finalize failed');
      }

      if (data.strategy) {
        setStrategy(data.strategy);
      }
    } catch (err) {
      console.error('[StrategyWorkspaceClient] Finalize error:', err);
      setError(err instanceof Error ? err.message : 'Finalize failed');
    } finally {
      setFinalizing(false);
    }
  }, [strategy.id]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            Strategy Workspace
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Define the marketing strategy for {companyName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
              isFinalized
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isFinalized ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            {isFinalized ? 'Finalized' : 'Draft'}
          </span>

          {/* AI Propose */}
          {!isFinalized && (
            <button
              onClick={handleAiPropose}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-wait"
            >
              {aiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              AI Propose
            </button>
          )}

          {/* Save */}
          {!isFinalized && (
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                saveStatus === 'saved'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'
              }`}
            >
              {saveStatus === 'saving' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saveStatus === 'saved' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
            </button>
          )}

          {/* Finalize */}
          {!isFinalized && strategy.id && (
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-wait"
            >
              {finalizing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Finalize & Generate Work
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Strategy Form */}
      <div className="space-y-6">
        {/* Title & Summary */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Strategy Title
            </label>
            <input
              type="text"
              value={strategy.title || ''}
              onChange={e => updateField('title', e.target.value)}
              disabled={isFinalized}
              placeholder="e.g., Q1 2026 Growth Strategy"
              className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Strategy Summary
            </label>
            <textarea
              value={strategy.summary || ''}
              onChange={e => updateField('summary', e.target.value)}
              disabled={isFinalized}
              placeholder="Brief overview of the strategic approach..."
              rows={3}
              className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none disabled:opacity-60"
            />
          </div>
        </div>

        {/* Pillars */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-200">Strategic Pillars</h2>
            {!isFinalized && (
              <button
                onClick={addPillar}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300"
              >
                <Plus className="w-4 h-4" />
                Add Pillar
              </button>
            )}
          </div>

          {(strategy.pillars || []).length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-8 text-center">
              <p className="text-sm text-slate-500 mb-3">No pillars defined yet</p>
              {!isFinalized && (
                <button
                  onClick={handleAiPropose}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20"
                >
                  <Sparkles className="w-4 h-4" />
                  Let AI propose pillars
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {(strategy.pillars || []).map((pillar, index) => (
                <PillarCard
                  key={pillar.id}
                  pillar={pillar}
                  index={index}
                  disabled={isFinalized}
                  onUpdate={updates => updatePillar(index, updates)}
                  onRemove={() => removePillar(index)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Pillar Card Component
// ============================================================================

function PillarCard({
  pillar,
  index,
  disabled,
  onUpdate,
  onRemove,
}: {
  pillar: StrategyPillar;
  index: number;
  disabled: boolean;
  onUpdate: (updates: Partial<StrategyPillar>) => void;
  onRemove: () => void;
}) {
  const priorityColors: Record<string, string> = {
    high: 'bg-red-500/10 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    low: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 space-y-3">
          <input
            type="text"
            value={pillar.title}
            onChange={e => onUpdate({ title: e.target.value })}
            disabled={disabled}
            placeholder={`Pillar ${index + 1} Title`}
            className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-medium disabled:opacity-60"
          />
          <textarea
            value={pillar.description}
            onChange={e => onUpdate({ description: e.target.value })}
            disabled={disabled}
            placeholder="Description of this pillar..."
            rows={2}
            className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none disabled:opacity-60"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={pillar.priority}
            onChange={e => onUpdate({ priority: e.target.value as StrategyPillar['priority'] })}
            disabled={disabled}
            className={`px-2 py-1 text-xs font-medium rounded-lg border ${priorityColors[pillar.priority]} bg-transparent focus:outline-none disabled:opacity-60`}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {!disabled && (
            <button
              onClick={onRemove}
              className="p-1.5 text-slate-500 hover:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Services */}
      <div className="flex flex-wrap gap-2">
        {['website', 'seo', 'content', 'media', 'brand', 'social'].map(service => {
          const isSelected = pillar.services?.includes(service as StrategyService);
          return (
            <button
              key={service}
              onClick={() => {
                if (disabled) return;
                const services = pillar.services || [];
                onUpdate({
                  services: isSelected
                    ? services.filter(s => s !== service)
                    : [...services, service as StrategyService],
                });
              }}
              disabled={disabled}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                isSelected
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-slate-800/50 text-slate-500 border border-slate-700 hover:text-slate-400'
              } disabled:opacity-60`}
            >
              {service.charAt(0).toUpperCase() + service.slice(1)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
