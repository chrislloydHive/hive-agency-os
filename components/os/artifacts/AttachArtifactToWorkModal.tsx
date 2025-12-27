'use client';

// components/os/artifacts/AttachArtifactToWorkModal.tsx
// Modal for attaching an artifact to a work item
//
// Features:
// - Search/filter work items
// - Shows work item status, area, due date
// - Attach action with draft artifact warning
// - Already attached indicator

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Briefcase,
  Calendar,
  Tag,
  LinkIcon,
} from 'lucide-react';
import type { Artifact } from '@/lib/types/artifact';

// ============================================================================
// Types
// ============================================================================

interface AttachArtifactToWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  artifact: Artifact;
  onAttached?: () => void;
}

interface WorkItemOption {
  id: string;
  title: string;
  status: string;
  area?: string;
  dueDate?: string;
  isAttached: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function AttachArtifactToWorkModal({
  isOpen,
  onClose,
  companyId,
  artifact,
  onAttached,
}: AttachArtifactToWorkModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [workItems, setWorkItems] = useState<WorkItemOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch work items
  useEffect(() => {
    if (!isOpen) return;

    const fetchWorkItems = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/os/companies/${companyId}/work-items`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch work items');
        }

        // Map work items and check if artifact is already attached
        const items: WorkItemOption[] = (data.workItems || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          area: item.area,
          dueDate: item.dueDate,
          isAttached: (item.artifacts || []).some(
            (a: any) => a.artifactId === artifact.id
          ),
        }));

        setWorkItems(items);
      } catch (err) {
        console.error('[AttachArtifactToWorkModal] Error fetching work items:', err);
        setError(err instanceof Error ? err.message : 'Failed to load work items');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkItems();
  }, [isOpen, companyId, artifact.id]);

  // Filter work items by search query
  const filteredWorkItems = useMemo(() => {
    if (!searchQuery.trim()) return workItems;

    const query = searchQuery.toLowerCase();
    return workItems.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.area?.toLowerCase().includes(query) ||
        item.status.toLowerCase().includes(query)
    );
  }, [workItems, searchQuery]);

  // Handle attach
  const handleAttach = useCallback(async (workItemId: string) => {
    if (attaching) return;

    setAttaching(workItemId);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/work-items/${workItemId}/artifacts/attach`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artifactId: artifact.id }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to attach artifact');
      }

      // Update local state
      setWorkItems((prev) =>
        prev.map((item) =>
          item.id === workItemId ? { ...item, isAttached: true } : item
        )
      );

      setSuccessMessage('Artifact attached successfully');
      onAttached?.();

      // Close after short delay
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error('[AttachArtifactToWorkModal] Attach error:', err);
      setError(err instanceof Error ? err.message : 'Failed to attach');
    } finally {
      setAttaching(null);
    }
  }, [companyId, artifact.id, attaching, onAttached, onClose]);

  // Handle detach
  const handleDetach = useCallback(async (workItemId: string) => {
    if (attaching) return;

    setAttaching(workItemId);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/work-items/${workItemId}/artifacts/detach`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artifactId: artifact.id }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to detach artifact');
      }

      // Update local state
      setWorkItems((prev) =>
        prev.map((item) =>
          item.id === workItemId ? { ...item, isAttached: false } : item
        )
      );

      setSuccessMessage('Artifact detached');
    } catch (err) {
      console.error('[AttachArtifactToWorkModal] Detach error:', err);
      setError(err instanceof Error ? err.message : 'Failed to detach');
    } finally {
      setAttaching(null);
    }
  }, [companyId, artifact.id, attaching]);

  if (!isOpen) return null;

  const isDraft = artifact.status === 'draft';
  const isArchived = artifact.status === 'archived';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Attach to Work Item</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {artifact.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Draft Warning */}
        {isDraft && (
          <div className="mx-4 mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-400">
              <p className="font-medium">Draft artifact</p>
              <p className="mt-0.5 text-amber-400/80">
                Content may change. Finalize for stability.
              </p>
            </div>
          </div>
        )}

        {/* Archived Warning */}
        {isArchived && (
          <div className="mx-4 mt-4 p-3 bg-slate-700/50 border border-slate-600 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-400">
              <p className="font-medium">Archived artifact</p>
              <p className="mt-0.5">
                This artifact is archived. Consider using an active version.
              </p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="p-4 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search work items..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
            />
          </div>
        </div>

        {/* Work Items List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          ) : filteredWorkItems.length === 0 ? (
            <div className="text-center py-8">
              <Briefcase className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">
                {searchQuery ? 'No matching work items' : 'No work items found'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredWorkItems.map((item) => (
                <WorkItemRow
                  key={item.id}
                  item={item}
                  isAttaching={attaching === item.id}
                  onAttach={() => handleAttach(item.id)}
                  onDetach={() => handleDetach(item.id)}
                  disabled={isArchived}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {successMessage && (
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              {successMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Work Item Row
// ============================================================================

interface WorkItemRowProps {
  item: WorkItemOption;
  isAttaching: boolean;
  onAttach: () => void;
  onDetach: () => void;
  disabled: boolean;
}

function WorkItemRow({
  item,
  isAttaching,
  onAttach,
  onDetach,
  disabled,
}: WorkItemRowProps) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
      item.isAttached
        ? 'bg-purple-500/5 border-purple-500/30'
        : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
    }`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-200 truncate">{item.title}</p>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
          <span className={`px-1.5 py-0.5 rounded ${getStatusStyle(item.status)}`}>
            {item.status}
          </span>
          {item.area && (
            <span className="flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {item.area}
            </span>
          )}
          {item.dueDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(item.dueDate)}
            </span>
          )}
        </div>
      </div>

      <div className="ml-3 flex-shrink-0">
        {item.isAttached ? (
          <button
            onClick={onDetach}
            disabled={isAttaching || disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAttaching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LinkIcon className="w-3.5 h-3.5" />
            )}
            Attached
          </button>
        ) : (
          <button
            onClick={onAttach}
            disabled={isAttaching || disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAttaching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LinkIcon className="w-3.5 h-3.5" />
            )}
            Attach
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getStatusStyle(status: string): string {
  switch (status) {
    case 'In Progress':
      return 'bg-blue-500/20 text-blue-300';
    case 'Planned':
      return 'bg-purple-500/20 text-purple-300';
    case 'Done':
      return 'bg-emerald-500/20 text-emerald-300';
    case 'Backlog':
      return 'bg-slate-500/20 text-slate-300';
    default:
      return 'bg-slate-500/20 text-slate-300';
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default AttachArtifactToWorkModal;
