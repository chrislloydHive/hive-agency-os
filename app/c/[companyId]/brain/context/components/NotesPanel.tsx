'use client';

// app/c/[companyId]/context/components/NotesPanel.tsx
// Analyst Notes Panel Component
//
// CRUD interface for analyst notes on context fields:
// - Add/edit/delete notes
// - Notes persisted via API
// - Linked to specific fields or general domain notes

import { useState, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface Note {
  id: string;
  fieldPath?: string;
  content: string;
  authorEmail?: string;
  createdAt: string;
  updatedAt: string;
}

interface NotesPanelProps {
  companyId: string;
  domainId: string;
  fieldPath?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function NotesPanel({
  companyId,
  domainId,
  fieldPath,
}: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch notes
  useEffect(() => {
    async function fetchNotes() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({ domain: domainId });
        if (fieldPath) params.set('field', fieldPath);

        const response = await fetch(`/api/os/companies/${companyId}/context-notes?${params}`);
        if (response.ok) {
          const data = await response.json();
          setNotes(data.notes ?? []);
        }
      } catch (error) {
        console.error('Failed to fetch notes:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchNotes();
  }, [companyId, domainId, fieldPath]);

  // Add note
  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/context-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domainId,
          fieldPath,
          content: newNoteContent.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNotes([data.note, ...notes]);
        setNewNoteContent('');
        setIsAdding(false);
      }
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Update note
  const handleUpdateNote = async (noteId: string) => {
    if (!editContent.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/context-notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setNotes(notes.map(n => n.id === noteId ? data.note : n));
        setEditingNoteId(null);
        setEditContent('');
      }
    } catch (error) {
      console.error('Failed to update note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;

    try {
      const response = await fetch(`/api/os/companies/${companyId}/context-notes/${noteId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotes(notes.filter(n => n.id !== noteId));
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <div className="w-3 h-3 rounded-full border-2 border-slate-600 border-t-slate-400 animate-spin" />
        Loading notes...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wide text-slate-500">
          Analyst Notes {notes.length > 0 && `(${notes.length})`}
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-[10px] text-amber-400 hover:text-amber-300"
          >
            + Add Note
          </button>
        )}
      </div>

      {/* Add Note Form */}
      {isAdding && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <textarea
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder="Write your note..."
            className="w-full h-20 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/60 resize-none"
          />
          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              onClick={() => {
                setIsAdding(false);
                setNewNoteContent('');
              }}
              className="px-3 py-1.5 rounded-md text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleAddNote}
              disabled={!newNoteContent.trim() || isSaving}
              className="px-3 py-1.5 rounded-md text-xs bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>
      )}

      {/* Notes List */}
      {notes.length === 0 && !isAdding ? (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 p-4 text-center">
          <p className="text-[11px] text-slate-500">No notes yet. Add one to track observations.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-lg border border-slate-800 bg-slate-900/50 p-3"
            >
              {editingNoteId === note.id ? (
                // Edit mode
                <>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-20 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400/60 resize-none"
                  />
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button
                      onClick={() => {
                        setEditingNoteId(null);
                        setEditContent('');
                      }}
                      className="px-2 py-1 rounded text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleUpdateNote(note.id)}
                      disabled={!editContent.trim() || isSaving}
                      className="px-2 py-1 rounded text-[11px] bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Update'}
                    </button>
                  </div>
                </>
              ) : (
                // View mode
                <>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-slate-500">
                      {formatDate(note.updatedAt)}
                      {note.authorEmail && ` · ${note.authorEmail}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setEditContent(note.content);
                        }}
                        className="text-[10px] text-slate-500 hover:text-slate-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotesPanel;
