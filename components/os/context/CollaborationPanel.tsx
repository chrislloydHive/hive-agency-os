'use client';

// components/os/context/CollaborationPanel.tsx
// Real-time collaboration presence panel
//
// Phase 4: Multi-user presence and conflict resolution UI

import { useEffect, useState, useCallback } from 'react';

interface UserPresence {
  userId: string;
  userName: string;
  userColor: string;
  status: 'active' | 'idle' | 'away';
  selectedDomain?: string;
  selectedPath?: string;
  isEditing: boolean;
  editingPath?: string;
  lastActivityAt: string;
}

interface EditConflict {
  id: string;
  path: string;
  domain: string;
  users: Array<{
    userId: string;
    userName: string;
    proposedValue: unknown;
  }>;
  originalValue: unknown;
  status: string;
}

interface CollaborationPanelProps {
  companyId: string;
  currentUserId?: string;
  currentUserName?: string;
  sessionId?: string;
}

export function CollaborationPanel({
  companyId,
  currentUserId,
  currentUserName,
  sessionId,
}: CollaborationPanelProps) {
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [conflicts, setConflicts] = useState<EditConflict[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCollaborationState = useCallback(async () => {
    try {
      const [usersRes, conflictsRes] = await Promise.all([
        fetch(`/api/context/collaboration?companyId=${companyId}&mode=users`),
        fetch(`/api/context/collaboration?companyId=${companyId}&mode=conflicts`),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }

      if (conflictsRes.ok) {
        const data = await conflictsRes.json();
        setConflicts(data.conflicts || []);
      }
    } catch (err) {
      console.error('Failed to load collaboration state:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchCollaborationState();
    const interval = setInterval(fetchCollaborationState, 5000);
    return () => clearInterval(interval);
  }, [fetchCollaborationState]);

  const otherUsers = users.filter(u => u.userId !== currentUserId);
  const activeEditors = users.filter(u => u.isEditing);

  const handleResolveConflict = async (conflictId: string, winningValue: unknown) => {
    try {
      const response = await fetch('/api/context/collaboration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve_conflict',
          conflictId,
          userId: currentUserId,
          winningValue,
        }),
      });

      if (response.ok) {
        fetchCollaborationState();
      }
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-sm text-slate-400">
        Loading collaboration state...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Collaborators
        </h3>
        {otherUsers.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
            {otherUsers.length} online
          </span>
        )}
      </div>

      {/* Active Users */}
      {otherUsers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {otherUsers.map((user) => (
            <div
              key={user.userId}
              className="relative group"
              title={`${user.userName} - ${user.isEditing ? `Editing ${user.editingPath}` : user.status}`}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2"
                style={{
                  backgroundColor: user.userColor + '20',
                  borderColor: user.userColor,
                  color: user.userColor,
                }}
              >
                {user.userName.slice(0, 2).toUpperCase()}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 ${
                  user.status === 'active'
                    ? 'bg-green-500'
                    : user.status === 'idle'
                    ? 'bg-yellow-500'
                    : 'bg-gray-400'
                }`}
              />
              {user.isEditing && (
                <svg
                  className="absolute -top-1 -right-1 h-3 w-3"
                  fill="none"
                  stroke={user.userColor}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No other users online</p>
      )}

      {/* Active Editors */}
      {activeEditors.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Currently Editing
          </p>
          {activeEditors.map((editor) => (
            <div
              key={editor.userId}
              className="flex items-center gap-2 text-sm p-2 rounded-md"
              style={{ backgroundColor: editor.userColor + '10' }}
            >
              <svg className="h-3 w-3" fill="none" stroke={editor.userColor} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span style={{ color: editor.userColor }}>{editor.userName}</span>
              <span className="text-slate-500">→</span>
              <span className="font-mono text-xs text-slate-400">{editor.editingPath}</span>
            </div>
          ))}
        </div>
      )}

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wide flex items-center gap-1">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Conflicts ({conflicts.length})
          </p>
          {conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className="border border-red-500/30 rounded-md p-3 space-y-2 bg-red-500/5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-300">{conflict.path}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                  {conflict.users.length} edits
                </span>
              </div>

              <div className="space-y-1">
                {conflict.users.map((user) => (
                  <div key={user.userId} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{user.userName}:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400 truncate max-w-[150px]">
                        {String(user.proposedValue)}
                      </span>
                      <button
                        className="p-1 hover:bg-slate-700 rounded"
                        onClick={() => handleResolveConflict(conflict.id, user.proposedValue)}
                      >
                        <svg className="h-3 w-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CollaborationPanel;
