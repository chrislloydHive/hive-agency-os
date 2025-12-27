'use client';

// components/os/library/SaveToLibraryModal.tsx
// Modal to save a section to the company library

import { useState } from 'react';
import { X, Loader2, Library, Tag, Plus } from 'lucide-react';
import { COMMON_SECTION_TAGS } from '@/lib/types/sectionLibrary';

interface SaveToLibraryModalProps {
  companyId: string;
  initialTitle?: string;
  initialContent: string;
  source: 'rfp' | 'proposal';
  sourceId?: string;
  sourceSectionKey?: string;
  onClose: () => void;
  onSaved?: (sectionId: string) => void;
}

export function SaveToLibraryModal({
  companyId,
  initialTitle = '',
  initialContent,
  source,
  sourceId,
  sourceSectionKey,
  onClose,
  onSaved,
}: SaveToLibraryModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleAddCustomTag = () => {
    const tag = customTag.trim().toLowerCase().replace(/\s+/g, '-');
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags(prev => [...prev, tag]);
      setCustomTag('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!initialContent.trim()) {
      setError('Content is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/section-library`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: initialContent,
          tags: selectedTags,
          source,
          sourceId,
          sourceSectionKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save to library');
      }

      onSaved?.(data.section.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save to library');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Library className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Save to Library</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Scope indicator */}
          <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-slate-300">Company Library</span>
              <span className="text-slate-500">(private to your company)</span>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Section Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Standard Approach - Web Projects"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              <Tag className="w-4 h-4 inline mr-1" />
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {COMMON_SECTION_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            {/* Custom tags */}
            {selectedTags.filter(t => !COMMON_SECTION_TAGS.includes(t)).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedTags.filter(t => !COMMON_SECTION_TAGS.includes(t)).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagToggle(tag)}
                    className="px-2.5 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  >
                    {tag} ×
                  </button>
                ))}
              </div>
            )}
            {/* Add custom tag */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomTag())}
                placeholder="Add custom tag..."
                className="flex-1 px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={handleAddCustomTag}
                disabled={!customTag.trim()}
                className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content preview */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Content Preview
            </label>
            <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg max-h-32 overflow-y-auto">
              <p className="text-sm text-slate-400 whitespace-pre-wrap line-clamp-5">
                {initialContent.slice(0, 500)}{initialContent.length > 500 ? '...' : ''}
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Save to Library
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SaveToLibraryModal;
