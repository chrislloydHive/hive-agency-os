'use client';

// components/os/plans/editor/RisksEditor.tsx
// Editor for risks section (shared by both plan types)

import { useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { PlanRiskItem } from '@/lib/types/plan';

interface RisksEditorProps {
  risks: PlanRiskItem[];
  onChange: (risks: PlanRiskItem[]) => void;
  readOnly?: boolean;
}

function generateId(): string {
  return `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function RisksEditor({
  risks,
  onChange,
  readOnly = false,
}: RisksEditorProps) {
  const addRisk = useCallback(() => {
    const newRisk: PlanRiskItem = {
      id: generateId(),
      description: '',
      likelihood: 'medium',
      impact: 'medium',
      mitigation: '',
    };
    onChange([...risks, newRisk]);
  }, [risks, onChange]);

  const removeRisk = useCallback(
    (id: string) => {
      onChange(risks.filter((r) => r.id !== id));
    },
    [risks, onChange]
  );

  const updateRisk = useCallback(
    (id: string, updates: Partial<PlanRiskItem>) => {
      onChange(
        risks.map((r) =>
          r.id === id ? { ...r, ...updates } : r
        )
      );
    },
    [risks, onChange]
  );

  if (risks.length === 0 && readOnly) {
    return <p className="text-sm text-slate-500 italic">No risks identified</p>;
  }

  return (
    <div className="space-y-3">
      {risks.map((risk) => (
        <div
          key={risk.id}
          className="p-4 bg-slate-900/30 border border-slate-700/30 rounded-lg space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Risk Description</label>
              <textarea
                value={risk.description}
                onChange={(e) => updateRisk(risk.id, { description: e.target.value })}
                placeholder="Describe the risk..."
                readOnly={readOnly}
                rows={2}
                className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 resize-none ${
                  readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                }`}
              />
            </div>
            {!readOnly && (
              <button
                onClick={() => removeRisk(risk.id)}
                className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                title="Remove risk"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Likelihood</label>
              <select
                value={risk.likelihood || 'medium'}
                onChange={(e) => updateRisk(risk.id, { likelihood: e.target.value as PlanRiskItem['likelihood'] })}
                disabled={readOnly}
                className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 ${
                  readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                }`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Impact</label>
              <select
                value={risk.impact || 'medium'}
                onChange={(e) => updateRisk(risk.id, { impact: e.target.value as PlanRiskItem['impact'] })}
                disabled={readOnly}
                className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 ${
                  readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                }`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Mitigation Strategy</label>
            <textarea
              value={risk.mitigation || ''}
              onChange={(e) => updateRisk(risk.id, { mitigation: e.target.value })}
              placeholder="How will this risk be mitigated?"
              readOnly={readOnly}
              rows={2}
              className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 resize-none ${
                readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
              }`}
            />
          </div>
        </div>
      ))}

      {!readOnly && (
        <button
          onClick={addRisk}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-600/50 rounded-lg text-sm text-slate-400 hover:text-slate-300 hover:border-slate-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Risk
        </button>
      )}
    </div>
  );
}

export default RisksEditor;
