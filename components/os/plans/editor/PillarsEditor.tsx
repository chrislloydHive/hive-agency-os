'use client';

// components/os/plans/editor/PillarsEditor.tsx
// Editor for content pillars/themes in a content plan

import { useCallback, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, X } from 'lucide-react';
import type { ContentPillar } from '@/lib/types/plan';

interface PillarsEditorProps {
  pillars: ContentPillar[];
  onChange: (pillars: ContentPillar[]) => void;
  readOnly?: boolean;
}

function generateId(): string {
  return `pillar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function PillarsEditor({
  pillars,
  onChange,
  readOnly = false,
}: PillarsEditorProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const addPillar = useCallback(() => {
    const newPillar: ContentPillar = {
      id: generateId(),
      pillar: '',
      why: '',
      targetIntents: [],
      proofPoints: [],
    };
    onChange([...pillars, newPillar]);
    setExpandedIds((prev) => new Set(prev).add(newPillar.id));
  }, [pillars, onChange]);

  const removePillar = useCallback(
    (id: string) => {
      onChange(pillars.filter((p) => p.id !== id));
    },
    [pillars, onChange]
  );

  const updatePillar = useCallback(
    (id: string, updates: Partial<ContentPillar>) => {
      onChange(
        pillars.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        )
      );
    },
    [pillars, onChange]
  );

  const addListItem = useCallback(
    (pillarId: string, field: 'targetIntents' | 'proofPoints') => {
      onChange(
        pillars.map((p) =>
          p.id === pillarId ? { ...p, [field]: [...p[field], ''] } : p
        )
      );
    },
    [pillars, onChange]
  );

  const updateListItem = useCallback(
    (pillarId: string, field: 'targetIntents' | 'proofPoints', index: number, value: string) => {
      onChange(
        pillars.map((p) => {
          if (p.id !== pillarId) return p;
          const newList = [...p[field]];
          newList[index] = value;
          return { ...p, [field]: newList };
        })
      );
    },
    [pillars, onChange]
  );

  const removeListItem = useCallback(
    (pillarId: string, field: 'targetIntents' | 'proofPoints', index: number) => {
      onChange(
        pillars.map((p) => {
          if (p.id !== pillarId) return p;
          const newList = p[field].filter((_, i) => i !== index);
          return { ...p, [field]: newList };
        })
      );
    },
    [pillars, onChange]
  );

  if (pillars.length === 0 && readOnly) {
    return <p className="text-sm text-slate-500 italic">No pillars defined</p>;
  }

  return (
    <div className="space-y-3">
      {pillars.map((pillar) => {
        const isExpanded = expandedIds.has(pillar.id);

        return (
          <div
            key={pillar.id}
            className="border border-slate-700/30 rounded-lg overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-slate-900/30">
              <button
                onClick={() => toggleExpanded(pillar.id)}
                className="flex items-center gap-2 text-left flex-1"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-sm font-medium text-slate-200">
                  {pillar.pillar || 'Untitled Pillar'}
                </span>
              </button>
              {!readOnly && (
                <button
                  onClick={() => removePillar(pillar.id)}
                  className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                  title="Remove pillar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Content */}
            {isExpanded && (
              <div className="p-4 space-y-4 border-t border-slate-700/30">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Pillar Name</label>
                  <input
                    type="text"
                    value={pillar.pillar}
                    onChange={(e) => updatePillar(pillar.id, { pillar: e.target.value })}
                    placeholder="e.g., Thought Leadership"
                    readOnly={readOnly}
                    className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                      readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Why This Pillar?</label>
                  <textarea
                    value={pillar.why}
                    onChange={(e) => updatePillar(pillar.id, { why: e.target.value })}
                    placeholder="Strategic rationale for this content pillar..."
                    readOnly={readOnly}
                    rows={2}
                    className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 resize-none ${
                      readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                    }`}
                  />
                </div>

                {/* Target Intents */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Target Intents</label>
                  <div className="space-y-2">
                    {pillar.targetIntents.map((intent, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={intent}
                          onChange={(e) => updateListItem(pillar.id, 'targetIntents', index, e.target.value)}
                          placeholder="Intent this pillar addresses..."
                          readOnly={readOnly}
                          className={`flex-1 px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                            readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                          }`}
                        />
                        {!readOnly && (
                          <button
                            onClick={() => removeListItem(pillar.id, 'targetIntents', index)}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {!readOnly && (
                      <button
                        onClick={() => addListItem(pillar.id, 'targetIntents')}
                        className="text-xs text-purple-400 hover:text-purple-300"
                      >
                        + Add intent
                      </button>
                    )}
                  </div>
                </div>

                {/* Proof Points */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Proof Points</label>
                  <div className="space-y-2">
                    {pillar.proofPoints.map((proof, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={proof}
                          onChange={(e) => updateListItem(pillar.id, 'proofPoints', index, e.target.value)}
                          placeholder="Evidence or example..."
                          readOnly={readOnly}
                          className={`flex-1 px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                            readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                          }`}
                        />
                        {!readOnly && (
                          <button
                            onClick={() => removeListItem(pillar.id, 'proofPoints', index)}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {!readOnly && (
                      <button
                        onClick={() => addListItem(pillar.id, 'proofPoints')}
                        className="text-xs text-purple-400 hover:text-purple-300"
                      >
                        + Add proof point
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {!readOnly && (
        <button
          onClick={addPillar}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-600/50 rounded-lg text-sm text-slate-400 hover:text-slate-300 hover:border-slate-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Pillar
        </button>
      )}
    </div>
  );
}

export default PillarsEditor;
