'use client';

// components/settings/firm-brain/ListEditor.tsx
// Reusable list + editor layout for Firm Brain entities

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Loader2, Trash2, Save, ChevronRight } from 'lucide-react';

interface ListItem {
  id: string;
  title: string;
  subtitle?: string;
  status?: 'active' | 'inactive' | 'pending';
}

interface ListEditorProps<T extends ListItem> {
  title: string;
  icon: React.ReactNode;
  description: string;
  items: T[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: () => void;
  onDelete: (id: string) => Promise<void>;
  renderEditor: (item: T, onUpdate: (updates: Partial<T>) => void) => React.ReactNode;
  onSave: (item: T) => Promise<void>;
  saving: boolean;
  emptyMessage?: string;
}

export function ListEditor<T extends ListItem>({
  title,
  icon,
  description,
  items,
  loading,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  renderEditor,
  onSave,
  saving,
  emptyMessage = 'No items yet',
}: ListEditorProps<T>) {
  const [search, setSearch] = useState('');
  const [editedItem, setEditedItem] = useState<T | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const selectedItem = items.find(i => i.id === selectedId) || null;

  // Sync editedItem with selectedItem
  useEffect(() => {
    if (selectedItem) {
      setEditedItem({ ...selectedItem });
    } else {
      setEditedItem(null);
    }
  }, [selectedId, selectedItem]);

  const filteredItems = items.filter(item =>
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    item.subtitle?.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpdate = useCallback((updates: Partial<T>) => {
    if (editedItem) {
      setEditedItem(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [editedItem]);

  const handleSave = useCallback(async () => {
    if (editedItem) {
      await onSave(editedItem);
    }
  }, [editedItem, onSave]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    setDeleting(id);
    try {
      await onDelete(id);
      if (selectedId === id) {
        onSelect(null);
      }
    } finally {
      setDeleting(null);
    }
  }, [selectedId, onSelect, onDelete]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            {icon}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{title}</h1>
            <p className="text-sm text-slate-400">{description}</p>
          </div>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add New
        </button>
      </div>

      {/* Content */}
      <div className="flex gap-6">
        {/* List Panel */}
        <div className="w-80 flex-shrink-0 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* List */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-slate-500">{emptyMessage}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-800/50 transition-colors ${
                      selectedId === item.id ? 'bg-slate-800/70' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        selectedId === item.id ? 'text-white' : 'text-slate-300'
                      }`}>
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
                      )}
                    </div>
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 ${
                      selectedId === item.id ? 'text-purple-400' : 'text-slate-600'
                    }`} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Editor Panel */}
        <div className="flex-1 min-w-0">
          {editedItem ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-6">
              {renderEditor(editedItem, handleUpdate)}

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  onClick={() => handleDelete(editedItem.id)}
                  disabled={deleting === editedItem.id}
                  className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  {deleting === editedItem.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white font-medium rounded-lg transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
              <p className="text-slate-500">Select an item to edit or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ListEditor;
