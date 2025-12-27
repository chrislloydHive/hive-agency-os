'use client';

// components/os/plans/editor/ChannelMixEditor.tsx
// Editor for channel allocations in a media plan

import { useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ChannelAllocation } from '@/lib/types/plan';

interface ChannelMixEditorProps {
  channels: ChannelAllocation[];
  onChange: (channels: ChannelAllocation[]) => void;
  readOnly?: boolean;
}

function generateId(): string {
  return `ch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function ChannelMixEditor({
  channels,
  onChange,
  readOnly = false,
}: ChannelMixEditorProps) {
  const addChannel = useCallback(() => {
    const newChannel: ChannelAllocation = {
      id: generateId(),
      channel: '',
      objective: '',
      audience: '',
      monthlyBudget: 0,
      kpiTargets: {},
      rationale: '',
    };
    onChange([...channels, newChannel]);
  }, [channels, onChange]);

  const removeChannel = useCallback(
    (id: string) => {
      onChange(channels.filter((c) => c.id !== id));
    },
    [channels, onChange]
  );

  const updateChannel = useCallback(
    (id: string, updates: Partial<ChannelAllocation>) => {
      onChange(
        channels.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        )
      );
    },
    [channels, onChange]
  );

  if (channels.length === 0 && readOnly) {
    return <p className="text-sm text-slate-500 italic">No channels defined</p>;
  }

  return (
    <div className="space-y-4">
      {channels.map((channel, index) => (
        <div
          key={channel.id}
          className="p-4 bg-slate-900/30 border border-slate-700/30 rounded-lg space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Channel</label>
                <input
                  type="text"
                  value={channel.channel}
                  onChange={(e) => updateChannel(channel.id, { channel: e.target.value })}
                  placeholder="e.g., Google Ads, Meta, LinkedIn"
                  readOnly={readOnly}
                  className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                    readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Monthly Budget</label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-slate-400">$</span>
                  <input
                    type="number"
                    value={channel.monthlyBudget || ''}
                    onChange={(e) => updateChannel(channel.id, { monthlyBudget: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    readOnly={readOnly}
                    className={`flex-1 px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                      readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                    }`}
                  />
                </div>
              </div>
            </div>
            {!readOnly && (
              <button
                onClick={() => removeChannel(channel.id)}
                className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                title="Remove channel"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Objective</label>
              <input
                type="text"
                value={channel.objective}
                onChange={(e) => updateChannel(channel.id, { objective: e.target.value })}
                placeholder="e.g., Conversions, Awareness"
                readOnly={readOnly}
                className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                  readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target Audience</label>
              <input
                type="text"
                value={channel.audience}
                onChange={(e) => updateChannel(channel.id, { audience: e.target.value })}
                placeholder="e.g., B2B decision makers"
                readOnly={readOnly}
                className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                  readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Rationale</label>
            <textarea
              value={channel.rationale}
              onChange={(e) => updateChannel(channel.id, { rationale: e.target.value })}
              placeholder="Why this channel for this audience?"
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
          onClick={addChannel}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-600/50 rounded-lg text-sm text-slate-400 hover:text-slate-300 hover:border-slate-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Channel
        </button>
      )}
    </div>
  );
}

export default ChannelMixEditor;
