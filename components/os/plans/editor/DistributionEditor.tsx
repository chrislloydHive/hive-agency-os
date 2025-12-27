'use client';

// components/os/plans/editor/DistributionEditor.tsx
// Editor for distribution channels in a content plan

import { useCallback } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { DistributionChannel } from '@/lib/types/plan';

interface DistributionEditorProps {
  channels: DistributionChannel[];
  onChange: (channels: DistributionChannel[]) => void;
  readOnly?: boolean;
}

function generateId(): string {
  return `dist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const CHANNEL_SUGGESTIONS = [
  'Blog',
  'LinkedIn',
  'Twitter/X',
  'YouTube',
  'Email Newsletter',
  'Podcast',
  'Medium',
  'Reddit',
  'Slack Communities',
  'Industry Forums',
];

const FREQUENCY_OPTIONS = [
  'Daily',
  'Multiple times/week',
  '2-3x/week',
  'Weekly',
  'Bi-weekly',
  'Monthly',
  'As needed',
];

export function DistributionEditor({
  channels,
  onChange,
  readOnly = false,
}: DistributionEditorProps) {
  const addChannel = useCallback(() => {
    const newChannel: DistributionChannel = {
      id: generateId(),
      channel: '',
      frequency: '',
      audience: '',
      goals: [],
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
    (id: string, updates: Partial<DistributionChannel>) => {
      onChange(
        channels.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        )
      );
    },
    [channels, onChange]
  );

  const addGoal = useCallback(
    (channelId: string) => {
      onChange(
        channels.map((c) =>
          c.id === channelId ? { ...c, goals: [...c.goals, ''] } : c
        )
      );
    },
    [channels, onChange]
  );

  const updateGoal = useCallback(
    (channelId: string, index: number, value: string) => {
      onChange(
        channels.map((c) => {
          if (c.id !== channelId) return c;
          const newGoals = [...c.goals];
          newGoals[index] = value;
          return { ...c, goals: newGoals };
        })
      );
    },
    [channels, onChange]
  );

  const removeGoal = useCallback(
    (channelId: string, index: number) => {
      onChange(
        channels.map((c) => {
          if (c.id !== channelId) return c;
          return { ...c, goals: c.goals.filter((_, i) => i !== index) };
        })
      );
    },
    [channels, onChange]
  );

  if (channels.length === 0 && readOnly) {
    return <p className="text-sm text-slate-500 italic">No distribution channels defined</p>;
  }

  return (
    <div className="space-y-4">
      {channels.map((channel) => (
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
                  list="channel-suggestions"
                  value={channel.channel}
                  onChange={(e) => updateChannel(channel.id, { channel: e.target.value })}
                  placeholder="e.g., LinkedIn, Blog"
                  readOnly={readOnly}
                  className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                    readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                  }`}
                />
                <datalist id="channel-suggestions">
                  {CHANNEL_SUGGESTIONS.map((ch) => (
                    <option key={ch} value={ch} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Frequency</label>
                <select
                  value={channel.frequency}
                  onChange={(e) => updateChannel(channel.id, { frequency: e.target.value })}
                  disabled={readOnly}
                  className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 ${
                    readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                  }`}
                >
                  <option value="">Select frequency...</option>
                  {FREQUENCY_OPTIONS.map((freq) => (
                    <option key={freq} value={freq}>{freq}</option>
                  ))}
                </select>
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

          <div>
            <label className="block text-xs text-slate-400 mb-1">Target Audience</label>
            <input
              type="text"
              value={channel.audience}
              onChange={(e) => updateChannel(channel.id, { audience: e.target.value })}
              placeholder="Who do we reach on this channel?"
              readOnly={readOnly}
              className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Goals</label>
            <div className="space-y-2">
              {channel.goals.map((goal, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={goal}
                    onChange={(e) => updateGoal(channel.id, index, e.target.value)}
                    placeholder="Goal for this channel..."
                    readOnly={readOnly}
                    className={`flex-1 px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                      readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                    }`}
                  />
                  {!readOnly && (
                    <button
                      onClick={() => removeGoal(channel.id, index)}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <button
                  onClick={() => addGoal(channel.id)}
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  + Add goal
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {!readOnly && (
        <button
          onClick={addChannel}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-600/50 rounded-lg text-sm text-slate-400 hover:text-slate-300 hover:border-slate-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Distribution Channel
        </button>
      )}
    </div>
  );
}

export default DistributionEditor;
