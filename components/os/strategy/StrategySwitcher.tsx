'use client';

// components/os/strategy/StrategySwitcher.tsx
// Multi-strategy selector dropdown for Strategy Command Center V5
//
// Features:
// - Shows active strategy in header
// - Dropdown with all strategies (Active, Draft, Archived)
// - Actions: Create new, Duplicate, Set Active, Archive
// - Status badges with colors

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronDown,
  Check,
  Plus,
  Copy,
  Archive,
  Layers,
  Loader2,
  MoreVertical,
} from 'lucide-react';
import type { StrategyListItem, StrategyStatus } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

export interface StrategySwitcherProps {
  companyId: string;
  activeStrategyId?: string;
  onStrategyChange: (strategyId: string) => void;
  onCreateNew?: () => void;
  className?: string;
}

// ============================================================================
// Status Badge
// ============================================================================

const STATUS_COLORS: Record<StrategyStatus, string> = {
  draft: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  finalized: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  archived: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

const STATUS_LABELS: Record<StrategyStatus, string> = {
  draft: 'Draft',
  finalized: 'Active',
  archived: 'Archived',
};

function StatusBadge({ status, isActive }: { status: StrategyStatus; isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border bg-purple-500/10 text-purple-400 border-purple-500/30">
        <Check className="w-3 h-3" />
        Active
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ============================================================================
// Strategy List Item
// ============================================================================

interface StrategyListItemRowProps {
  strategy: StrategyListItem;
  isSelected: boolean;
  onSelect: () => void;
  onSetActive: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  isLoading: boolean;
}

function StrategyListItemRow({
  strategy,
  isSelected,
  onSelect,
  onSetActive,
  onDuplicate,
  onArchive,
  isLoading,
}: StrategyListItemRowProps) {
  const [showActions, setShowActions] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Close actions menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setShowActions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      className={`
        flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors
        ${isSelected ? 'bg-purple-500/10' : 'hover:bg-slate-700/50'}
      `}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">
            {strategy.title}
          </span>
          <StatusBadge status={strategy.status} isActive={strategy.isActive} />
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500">
            {strategy.pillarCount} priorities
          </span>
          <span className="text-xs text-slate-600">|</span>
          <span className="text-xs text-slate-500">
            Updated {new Date(strategy.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Actions Menu */}
      <div className="relative" ref={actionsRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowActions(!showActions);
          }}
          className="p-1 rounded hover:bg-slate-600/50 text-slate-400"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MoreVertical className="w-4 h-4" />
          )}
        </button>

        {showActions && !isLoading && (
          <div className="absolute right-0 top-full mt-1 w-36 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-50">
            {!strategy.isActive && strategy.status !== 'archived' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSetActive();
                  setShowActions(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-300 hover:bg-slate-700/50"
              >
                <Check className="w-3.5 h-3.5" />
                Set as Active
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
                setShowActions(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-300 hover:bg-slate-700/50"
            >
              <Copy className="w-3.5 h-3.5" />
              Duplicate
            </button>
            {strategy.status !== 'archived' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive();
                  setShowActions(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-red-400 hover:bg-slate-700/50"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategySwitcher({
  companyId,
  activeStrategyId,
  onStrategyChange,
  onCreateNew,
  className = '',
}: StrategySwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [strategies, setStrategies] = useState<StrategyListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch strategies
  const fetchStrategies = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/strategy/list`);
      const data = await response.json();
      if (data.strategies) {
        setStrategies(data.strategies);
      }
    } catch (error) {
      console.error('Failed to fetch strategies:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Load strategies on mount and when dropdown opens
  useEffect(() => {
    if (isOpen && strategies.length === 0) {
      fetchStrategies();
    }
  }, [isOpen, strategies.length, fetchStrategies]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get active strategy
  const activeStrategy = strategies.find(s => s.id === activeStrategyId) || strategies.find(s => s.isActive);

  // Handlers
  const handleSetActive = async (strategyId: string) => {
    setActionLoading(strategyId);
    try {
      await fetch(`/api/os/companies/${companyId}/strategy/set-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId }),
      });
      await fetchStrategies();
      onStrategyChange(strategyId);
    } catch (error) {
      console.error('Failed to set active strategy:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDuplicate = async (strategyId: string) => {
    setActionLoading(strategyId);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/strategy/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId }),
      });
      const data = await response.json();
      await fetchStrategies();
      if (data.strategy?.id) {
        onStrategyChange(data.strategy.id);
      }
    } catch (error) {
      console.error('Failed to duplicate strategy:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async (strategyId: string) => {
    setActionLoading(strategyId);
    try {
      await fetch(`/api/os/companies/${companyId}/strategy/${strategyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      await fetchStrategies();
      // If we archived the active strategy, switch to another
      if (strategyId === activeStrategyId) {
        const nextStrategy = strategies.find(s => s.id !== strategyId && s.status !== 'archived');
        if (nextStrategy) {
          onStrategyChange(nextStrategy.id);
        }
      }
    } catch (error) {
      console.error('Failed to archive strategy:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateNew = async () => {
    if (onCreateNew) {
      onCreateNew();
      return;
    }

    setActionLoading('new');
    try {
      const response = await fetch(`/api/os/companies/${companyId}/strategy/create-new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setAsActive: true }),
      });
      const data = await response.json();
      await fetchStrategies();
      if (data.strategy?.id) {
        onStrategyChange(data.strategy.id);
      }
    } catch (error) {
      console.error('Failed to create strategy:', error);
    } finally {
      setActionLoading(null);
      setIsOpen(false);
    }
  };

  // Separate active, draft, and archived strategies
  const activeStrategies = strategies.filter(s => s.isActive);
  const draftStrategies = strategies.filter(s => !s.isActive && s.status === 'draft');
  const archivedStrategies = strategies.filter(s => s.status === 'archived');

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
      >
        <Layers className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-medium text-white">
          {activeStrategy?.title || 'Select Strategy'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-slate-700">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Strategies
            </span>
            <button
              onClick={handleCreateNew}
              disabled={actionLoading === 'new'}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-400 hover:bg-purple-500/10 rounded transition-colors"
            >
              {actionLoading === 'new' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              New Strategy
            </button>
          </div>

          {/* Strategy List */}
          <div className="max-h-80 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
              </div>
            ) : strategies.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400">No strategies yet</p>
                <button
                  onClick={handleCreateNew}
                  className="mt-2 text-sm text-purple-400 hover:text-purple-300"
                >
                  Create your first strategy
                </button>
              </div>
            ) : (
              <>
                {/* Active Strategies */}
                {activeStrategies.length > 0 && (
                  <div className="mb-3">
                    <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase">
                      Active
                    </div>
                    {activeStrategies.map(strategy => (
                      <StrategyListItemRow
                        key={strategy.id}
                        strategy={strategy}
                        isSelected={strategy.id === activeStrategyId}
                        onSelect={() => {
                          onStrategyChange(strategy.id);
                          setIsOpen(false);
                        }}
                        onSetActive={() => handleSetActive(strategy.id)}
                        onDuplicate={() => handleDuplicate(strategy.id)}
                        onArchive={() => handleArchive(strategy.id)}
                        isLoading={actionLoading === strategy.id}
                      />
                    ))}
                  </div>
                )}

                {/* Draft Strategies */}
                {draftStrategies.length > 0 && (
                  <div className="mb-3">
                    <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase">
                      Drafts
                    </div>
                    {draftStrategies.map(strategy => (
                      <StrategyListItemRow
                        key={strategy.id}
                        strategy={strategy}
                        isSelected={strategy.id === activeStrategyId}
                        onSelect={() => {
                          onStrategyChange(strategy.id);
                          setIsOpen(false);
                        }}
                        onSetActive={() => handleSetActive(strategy.id)}
                        onDuplicate={() => handleDuplicate(strategy.id)}
                        onArchive={() => handleArchive(strategy.id)}
                        isLoading={actionLoading === strategy.id}
                      />
                    ))}
                  </div>
                )}

                {/* Archived Strategies */}
                {archivedStrategies.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase">
                      Archived
                    </div>
                    {archivedStrategies.map(strategy => (
                      <StrategyListItemRow
                        key={strategy.id}
                        strategy={strategy}
                        isSelected={strategy.id === activeStrategyId}
                        onSelect={() => {
                          onStrategyChange(strategy.id);
                          setIsOpen(false);
                        }}
                        onSetActive={() => handleSetActive(strategy.id)}
                        onDuplicate={() => handleDuplicate(strategy.id)}
                        onArchive={() => handleArchive(strategy.id)}
                        isLoading={actionLoading === strategy.id}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default StrategySwitcher;
