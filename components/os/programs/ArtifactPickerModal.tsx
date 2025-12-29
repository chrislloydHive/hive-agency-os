'use client';

// components/os/programs/ArtifactPickerModal.tsx
// Modal for selecting and linking artifacts to a program
//
// Features:
// - Search/filter artifacts
// - Shows artifact type and status
// - Prevents linking already-linked artifacts
// - Create new artifact inline with minimal form

import React, { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import {
  X,
  Search,
  Loader2,
  FileText,
  CheckCircle2,
  Edit3,
  Archive,
  AlertCircle,
  Link as LinkIcon,
  Plus,
  ArrowLeft,
} from 'lucide-react';
import type { Artifact, ArtifactType } from '@/lib/types/artifact';
import type { ProgramArtifactLinkType } from '@/lib/types/program';

// ============================================================================
// Types
// ============================================================================

interface ArtifactPickerModalProps {
  programId: string;
  companyId: string;
  linkedArtifactIds: string[];
  onSelect: (artifact: Artifact, linkType: ProgramArtifactLinkType) => Promise<void>;
  onClose: () => void;
}

interface ArtifactsResponse {
  artifacts: Artifact[];
}

interface CreateArtifactResponse {
  artifact: Artifact;
  error?: string;
}

// Common artifact types for quick creation
const QUICK_ARTIFACT_TYPES: Array<{ value: ArtifactType; label: string }> = [
  { value: 'brief_doc', label: 'Brief' },
  { value: 'strategy_doc', label: 'Strategy Doc' },
  { value: 'creative_brief', label: 'Creative Brief' },
  { value: 'media_brief', label: 'Media Brief' },
  { value: 'content_brief', label: 'Content Brief' },
  { value: 'custom', label: 'Custom' },
];

// ============================================================================
// Fetcher
// ============================================================================

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ============================================================================
// Status Icon Helper
// ============================================================================

function ArtifactStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'final':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case 'draft':
      return <Edit3 className="w-4 h-4 text-amber-400" />;
    case 'archived':
      return <Archive className="w-4 h-4 text-slate-500" />;
    default:
      return <FileText className="w-4 h-4 text-slate-400" />;
  }
}

// ============================================================================
// Component
// ============================================================================

export function ArtifactPickerModal({
  programId,
  companyId,
  linkedArtifactIds,
  onSelect,
  onClose,
}: ArtifactPickerModalProps) {
  const [search, setSearch] = useState('');
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<ProgramArtifactLinkType>('output');

  // Create mode state
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<ArtifactType>('brief_doc');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR<ArtifactsResponse>(
    `/api/os/companies/${companyId}/artifacts`,
    fetcher
  );

  // Filter artifacts based on search and exclude already linked
  const filteredArtifacts = useMemo(() => {
    if (!data?.artifacts) return [];

    return data.artifacts
      .filter((artifact) => {
        // Exclude archived
        if (artifact.status === 'archived') return false;

        // Exclude already linked
        if (linkedArtifactIds.includes(artifact.id)) return false;

        // Search filter
        if (search.trim()) {
          const searchLower = search.toLowerCase();
          return (
            artifact.title.toLowerCase().includes(searchLower) ||
            artifact.type.toLowerCase().includes(searchLower)
          );
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by status (final first, then draft)
        if (a.status !== b.status) {
          return a.status === 'final' ? -1 : 1;
        }
        // Then by title
        return a.title.localeCompare(b.title);
      });
  }, [data?.artifacts, linkedArtifactIds, search]);

  const handleSelect = useCallback(
    async (artifact: Artifact) => {
      setLinkingId(artifact.id);
      try {
        await onSelect(artifact, linkType);
        onClose();
      } catch (err) {
        console.error('[ArtifactPicker] Error linking artifact:', err);
      } finally {
        setLinkingId(null);
      }
    },
    [onSelect, onClose, linkType]
  );

  // Handle create new artifact
  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) {
      setCreateError('Title is required');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      // Create the artifact
      const createResponse = await fetch(`/api/os/companies/${companyId}/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          type: newType,
          source: 'manual',
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || 'Failed to create artifact');
      }

      const { artifact } = (await createResponse.json()) as CreateArtifactResponse;

      // Refresh the artifacts list
      await mutate();

      // Link the artifact to the program (default to 'output' for new artifacts)
      await onSelect(artifact, 'output');
      onClose();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create artifact');
    } finally {
      setIsCreating(false);
    }
  }, [companyId, newTitle, newType, mutate, onSelect, onClose]);

  // Reset create mode state
  const handleBackToList = useCallback(() => {
    setIsCreateMode(false);
    setNewTitle('');
    setNewType('brief_doc');
    setCreateError(null);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          {isCreateMode ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleBackToList}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-medium text-white">Create Artifact</h3>
            </div>
          ) : (
            <h3 className="text-lg font-medium text-white">Link Artifact</h3>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isCreateMode ? (
          // ============================================================
          // Create Mode
          // ============================================================
          <div className="flex-1 p-4 space-y-4">
            {createError && (
              <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-sm text-red-400">{createError}</span>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Title <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter artifact title..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                autoFocus
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {QUICK_ARTIFACT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setNewType(type.value)}
                    className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                      newType === type.value
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              The artifact will be created as a draft and linked to this program as an output.
              No Google Doc will be created—just a database record.
            </p>

            {/* Create Button */}
            <button
              onClick={handleCreate}
              disabled={isCreating || !newTitle.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create & Link Artifact
                </>
              )}
            </button>
          </div>
        ) : (
          // ============================================================
          // List Mode
          // ============================================================
          <>
            {/* Link Type Selector */}
            <div className="px-4 py-2 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Link as:</span>
                <div className="flex gap-1">
                  {(['output', 'input', 'reference'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setLinkType(type)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        linkType === type
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-slate-700/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search artifacts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {/* Create New Button */}
              <button
                onClick={() => setIsCreateMode(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 mb-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-dashed border-slate-700 hover:border-purple-500/50 transition-colors group text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-purple-400 font-medium">Create New Artifact</p>
                  <p className="text-xs text-slate-500">Create a new artifact and link it</p>
                </div>
              </button>

              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-400 py-4">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Failed to load artifacts</span>
                </div>
              )}

              {!isLoading && !error && filteredArtifacts.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">
                    {search ? 'No artifacts match your search' : 'No artifacts available to link'}
                  </p>
                </div>
              )}

              {!isLoading && !error && filteredArtifacts.length > 0 && (
                <ul className="space-y-1">
                  {filteredArtifacts.map((artifact) => (
                    <li key={artifact.id}>
                      <button
                        onClick={() => handleSelect(artifact)}
                        disabled={linkingId !== null}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors group text-left disabled:opacity-50"
                      >
                        {linkingId === artifact.id ? (
                          <Loader2 className="w-4 h-4 text-purple-400 animate-spin shrink-0" />
                        ) : (
                          <ArtifactStatusIcon status={artifact.status} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{artifact.title}</p>
                          <p className="text-xs text-slate-500">
                            {artifact.type.replace(/_/g, ' ')} &bull;{' '}
                            <span className={artifact.status === 'final' ? 'text-emerald-400' : ''}>
                              {artifact.status}
                            </span>
                          </p>
                        </div>
                        <LinkIcon className="w-4 h-4 text-slate-600 group-hover:text-purple-400 transition-colors shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-slate-700 text-center">
              <p className="text-xs text-slate-500">
                {linkedArtifactIds.length > 0
                  ? `${linkedArtifactIds.length} artifact${linkedArtifactIds.length !== 1 ? 's' : ''} already linked`
                  : 'Select an artifact to link to this program'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
