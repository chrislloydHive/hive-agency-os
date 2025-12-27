'use client';

// components/os/plans/editor/ContentCalendarEditor.tsx
// Editor for content calendar items in a content plan

import { useCallback, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import type { ContentCalendarItem } from '@/lib/types/plan';

interface ContentCalendarEditorProps {
  items: ContentCalendarItem[];
  onChange: (items: ContentCalendarItem[]) => void;
  pillars?: string[]; // Available pillar names for dropdown
  readOnly?: boolean;
}

function generateId(): string {
  return `cal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const STATUS_OPTIONS: { value: ContentCalendarItem['status']; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const FORMAT_SUGGESTIONS = [
  'Blog Post',
  'Video',
  'Podcast',
  'Infographic',
  'Case Study',
  'Whitepaper',
  'Social Post',
  'Newsletter',
  'Webinar',
];

export function ContentCalendarEditor({
  items,
  onChange,
  pillars = [],
  readOnly = false,
}: ContentCalendarEditorProps) {
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

  const addItem = useCallback(() => {
    const newItem: ContentCalendarItem = {
      id: generateId(),
      title: '',
      channel: '',
      format: '',
      pillar: '',
      objective: '',
      status: 'planned',
    };
    onChange([...items, newItem]);
    setExpandedIds((prev) => new Set(prev).add(newItem.id));
  }, [items, onChange]);

  const removeItem = useCallback(
    (id: string) => {
      onChange(items.filter((item) => item.id !== id));
    },
    [items, onChange]
  );

  const updateItem = useCallback(
    (id: string, updates: Partial<ContentCalendarItem>) => {
      onChange(
        items.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        )
      );
    },
    [items, onChange]
  );

  const getStatusColor = (status: ContentCalendarItem['status']) => {
    switch (status) {
      case 'planned':
        return 'bg-slate-600/50 text-slate-300';
      case 'in_progress':
        return 'bg-amber-600/50 text-amber-300';
      case 'published':
        return 'bg-emerald-600/50 text-emerald-300';
      case 'archived':
        return 'bg-slate-700/50 text-slate-400';
      default:
        return 'bg-slate-600/50 text-slate-300';
    }
  };

  if (items.length === 0 && readOnly) {
    return <p className="text-sm text-slate-500 italic">No calendar items defined</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isExpanded = expandedIds.has(item.id);

        return (
          <div
            key={item.id}
            className="border border-slate-700/30 rounded-lg overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-slate-900/30">
              <button
                onClick={() => toggleExpanded(item.id)}
                className="flex items-center gap-2 text-left flex-1 min-w-0"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-slate-200 truncate">
                  {item.title || 'Untitled Content'}
                </span>
                {item.format && (
                  <span className="text-xs text-slate-500 flex-shrink-0">
                    ({item.format})
                  </span>
                )}
              </button>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-1.5 py-0.5 text-[10px] rounded ${getStatusColor(item.status)}`}>
                  {STATUS_OPTIONS.find(s => s.value === item.status)?.label || item.status}
                </span>
                {!readOnly && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            {isExpanded && (
              <div className="p-4 space-y-4 border-t border-slate-700/30">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Title</label>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateItem(item.id, { title: e.target.value })}
                      placeholder="Content title"
                      readOnly={readOnly}
                      className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                        readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Status</label>
                    <select
                      value={item.status}
                      onChange={(e) => updateItem(item.id, { status: e.target.value as ContentCalendarItem['status'] })}
                      disabled={readOnly}
                      className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 ${
                        readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                      }`}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Format</label>
                    <input
                      type="text"
                      list="format-suggestions"
                      value={item.format}
                      onChange={(e) => updateItem(item.id, { format: e.target.value })}
                      placeholder="e.g., Blog Post"
                      readOnly={readOnly}
                      className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                        readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                      }`}
                    />
                    <datalist id="format-suggestions">
                      {FORMAT_SUGGESTIONS.map((fmt) => (
                        <option key={fmt} value={fmt} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Channel</label>
                    <input
                      type="text"
                      value={item.channel}
                      onChange={(e) => updateItem(item.id, { channel: e.target.value })}
                      placeholder="e.g., Blog, YouTube"
                      readOnly={readOnly}
                      className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                        readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Pillar</label>
                    {pillars.length > 0 ? (
                      <select
                        value={item.pillar}
                        onChange={(e) => updateItem(item.id, { pillar: e.target.value })}
                        disabled={readOnly}
                        className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 ${
                          readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                        }`}
                      >
                        <option value="">Select pillar...</option>
                        {pillars.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={item.pillar}
                        onChange={(e) => updateItem(item.id, { pillar: e.target.value })}
                        placeholder="Content pillar"
                        readOnly={readOnly}
                        className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                          readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                        }`}
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      Date
                    </label>
                    <input
                      type="date"
                      value={item.date || ''}
                      onChange={(e) => updateItem(item.id, { date: e.target.value })}
                      readOnly={readOnly}
                      className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 ${
                        readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Week Of</label>
                    <input
                      type="text"
                      value={item.weekOf || ''}
                      onChange={(e) => updateItem(item.id, { weekOf: e.target.value })}
                      placeholder="e.g., Jan 15"
                      readOnly={readOnly}
                      className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                        readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Owner</label>
                    <input
                      type="text"
                      value={item.owner || ''}
                      onChange={(e) => updateItem(item.id, { owner: e.target.value })}
                      placeholder="Responsible person"
                      readOnly={readOnly}
                      className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                        readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Objective</label>
                  <input
                    type="text"
                    value={item.objective}
                    onChange={(e) => updateItem(item.id, { objective: e.target.value })}
                    placeholder="What this content should achieve"
                    readOnly={readOnly}
                    className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                      readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Brief</label>
                  <textarea
                    value={item.brief || ''}
                    onChange={(e) => updateItem(item.id, { brief: e.target.value })}
                    placeholder="Content brief or notes..."
                    readOnly={readOnly}
                    rows={3}
                    className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 resize-none ${
                      readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {!readOnly && (
        <button
          onClick={addItem}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-600/50 rounded-lg text-sm text-slate-400 hover:text-slate-300 hover:border-slate-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Calendar Item
        </button>
      )}
    </div>
  );
}

export default ContentCalendarEditor;
