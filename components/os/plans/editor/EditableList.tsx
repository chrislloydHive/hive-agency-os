'use client';

// components/os/plans/editor/EditableList.tsx
// An editable list of strings with add/remove functionality

import { useState, useCallback } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';

interface EditableListProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  readOnly?: boolean;
  helperText?: string;
  maxItems?: number;
}

export function EditableList({
  label,
  items,
  onChange,
  placeholder = 'Add item...',
  readOnly = false,
  helperText,
  maxItems = 20,
}: EditableListProps) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = useCallback(() => {
    if (!newItem.trim() || items.length >= maxItems) return;

    onChange([...items, newItem.trim()]);
    setNewItem('');
  }, [newItem, items, maxItems, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd]
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(items.filter((_, i) => i !== index));
    },
    [items, onChange]
  );

  const handleUpdate = useCallback(
    (index: number, value: string) => {
      const newItems = [...items];
      newItems[index] = value;
      onChange(newItems);
    },
    [items, onChange]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-300">{label}</label>
        <span className="text-xs text-slate-500">{items.length} / {maxItems}</span>
      </div>
      {helperText && (
        <p className="text-xs text-slate-500">{helperText}</p>
      )}

      {/* Items list */}
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-2 group"
          >
            <GripVertical className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <input
              type="text"
              value={item}
              onChange={(e) => handleUpdate(index, e.target.value)}
              readOnly={readOnly}
              className={`flex-1 px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-slate-200 ${
                readOnly
                  ? 'cursor-not-allowed opacity-75'
                  : 'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50'
              }`}
            />
            {!readOnly && (
              <button
                onClick={() => handleRemove(index)}
                className="p-1 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove item"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add new item */}
      {!readOnly && items.length < maxItems && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 px-3 py-1.5 bg-slate-900/30 border border-slate-700/50 border-dashed rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
          />
          <button
            onClick={handleAdd}
            disabled={!newItem.trim()}
            className="p-1.5 text-purple-400 hover:text-purple-300 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
            title="Add item"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && readOnly && (
        <p className="text-sm text-slate-500 italic">No items</p>
      )}
    </div>
  );
}

export default EditableList;
