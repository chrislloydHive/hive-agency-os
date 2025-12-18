'use client';

// ============================================================================
// @DEPRECATED - December 2024
// This component is DEPRECATED. Use StrategyWorkspace.tsx instead.
// Kept for reference only - NOT exported from index.ts
// ============================================================================

// components/os/strategy/views/StrategySurfaceCommand.tsx
// Command View - Strategic Deliberation Workspace
//
// SCREEN RESPONSIBILITY (NON-NEGOTIABLE):
// - Objectives: Read-only reference (metrics defined in Builder)
// - Strategic Bets: Full editing with pros/cons/tradeoffs, accept/reject actions
//
// EXPLICITLY EXCLUDED:
// - Tactics (ONLY in Orchestration)
// - Metrics editing (ONLY in Builder)
//
// AI can propose Strategic Bets but NEVER auto-accept or create tactics.
// Human deliberation is the core purpose of this screen.

import React, { useState, useCallback } from 'react';
import {
  Target,
  Layers,
  Plus,
  Sparkles,
  Loader2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Link2,
} from 'lucide-react';
import type { StrategySurfaceViewProps } from './types';
import { StrategyFrameDisplay } from '../StrategyFrameDisplay';
import type { StrategicBetStatus } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

interface StrategicBetData {
  id: string;
  title: string;
  intent: string;
  linkedObjectives: string[];
  pros: string[];
  cons: string[];
  tradeoffs: string[];
  confidence?: 'high' | 'medium' | 'low';
  status: StrategicBetStatus;
}

// ============================================================================
// Strategic Bet Card (Full Editing)
// ============================================================================

interface StrategicBetCardProps {
  bet: StrategicBetData;
  objectives: Array<{ id: string; text: string }>;
  isExpanded: boolean;
  isEditing: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onSave: (updates: Partial<StrategicBetData>) => void;
  onCancel: () => void;
  onAccept: () => void;
  onReject: () => void;
}

function StrategicBetCard({
  bet,
  objectives,
  isExpanded,
  isEditing,
  onToggleExpand,
  onEdit,
  onSave,
  onCancel,
  onAccept,
  onReject,
}: StrategicBetCardProps) {
  const [editData, setEditData] = useState<StrategicBetData>(bet);
  const [newPro, setNewPro] = useState('');
  const [newCon, setNewCon] = useState('');
  const [newTradeoff, setNewTradeoff] = useState('');

  const statusColors = {
    draft: 'border-amber-500/30 bg-amber-500/5',
    accepted: 'border-emerald-500/30 bg-emerald-500/5',
    rejected: 'border-red-500/30 bg-red-500/5',
  };

  const statusBadgeColors = {
    draft: 'bg-amber-500/20 text-amber-400',
    accepted: 'bg-emerald-500/20 text-emerald-400',
    rejected: 'bg-red-500/20 text-red-400',
  };

  const handleAddPro = () => {
    if (newPro.trim()) {
      setEditData(prev => ({ ...prev, pros: [...prev.pros, newPro.trim()] }));
      setNewPro('');
    }
  };

  const handleAddCon = () => {
    if (newCon.trim()) {
      setEditData(prev => ({ ...prev, cons: [...prev.cons, newCon.trim()] }));
      setNewCon('');
    }
  };

  const handleAddTradeoff = () => {
    if (newTradeoff.trim()) {
      setEditData(prev => ({ ...prev, tradeoffs: [...prev.tradeoffs, newTradeoff.trim()] }));
      setNewTradeoff('');
    }
  };

  const handleRemovePro = (index: number) => {
    setEditData(prev => ({ ...prev, pros: prev.pros.filter((_, i) => i !== index) }));
  };

  const handleRemoveCon = (index: number) => {
    setEditData(prev => ({ ...prev, cons: prev.cons.filter((_, i) => i !== index) }));
  };

  const handleRemoveTradeoff = (index: number) => {
    setEditData(prev => ({ ...prev, tradeoffs: prev.tradeoffs.filter((_, i) => i !== index) }));
  };

  const handleToggleObjective = (objId: string) => {
    setEditData(prev => ({
      ...prev,
      linkedObjectives: prev.linkedObjectives.includes(objId)
        ? prev.linkedObjectives.filter(id => id !== objId)
        : [...prev.linkedObjectives, objId],
    }));
  };

  // Editing mode
  if (isEditing) {
    return (
      <div className="p-4 rounded-lg border-2 border-purple-500/50 bg-purple-500/5 space-y-4">
        {/* Title & Intent */}
        <div className="space-y-2">
          <input
            type="text"
            value={editData.title}
            onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:border-purple-500 focus:outline-none"
            placeholder="Bet title"
          />
          <textarea
            value={editData.intent}
            onChange={(e) => setEditData(prev => ({ ...prev, intent: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:border-purple-500 focus:outline-none resize-none"
            rows={2}
            placeholder="What are we betting on? What's the strategic intent?"
          />
        </div>

        {/* Linked Objectives */}
        <div>
          <label className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1">
            <Link2 className="w-3 h-3" /> Linked Objectives
          </label>
          <div className="flex flex-wrap gap-2 mt-1">
            {objectives.map(obj => (
              <button
                key={obj.id}
                onClick={() => handleToggleObjective(obj.id)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  editData.linkedObjectives.includes(obj.id)
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                {obj.text.slice(0, 40)}{obj.text.length > 40 ? '...' : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Pros */}
        <div>
          <label className="text-xs font-medium text-emerald-400 mb-2 flex items-center gap-1">
            <ThumbsUp className="w-3 h-3" /> Pros
          </label>
          <div className="space-y-1 mt-1">
            {editData.pros.map((pro, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="flex-1 text-slate-300 bg-emerald-500/10 px-2 py-1 rounded">{pro}</span>
                <button onClick={() => handleRemovePro(idx)} className="text-slate-500 hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newPro}
                onChange={(e) => setNewPro(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPro()}
                className="flex-1 px-2 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:border-emerald-500 focus:outline-none"
                placeholder="Add pro..."
              />
              <button onClick={handleAddPro} className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded">
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Cons */}
        <div>
          <label className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1">
            <ThumbsDown className="w-3 h-3" /> Cons
          </label>
          <div className="space-y-1 mt-1">
            {editData.cons.map((con, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="flex-1 text-slate-300 bg-red-500/10 px-2 py-1 rounded">{con}</span>
                <button onClick={() => handleRemoveCon(idx)} className="text-slate-500 hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newCon}
                onChange={(e) => setNewCon(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCon()}
                className="flex-1 px-2 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:border-red-500 focus:outline-none"
                placeholder="Add con..."
              />
              <button onClick={handleAddCon} className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded">
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Tradeoffs */}
        <div>
          <label className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Tradeoffs
          </label>
          <div className="space-y-1 mt-1">
            {editData.tradeoffs.map((tradeoff, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="flex-1 text-slate-300 bg-amber-500/10 px-2 py-1 rounded">{tradeoff}</span>
                <button onClick={() => handleRemoveTradeoff(idx)} className="text-slate-500 hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTradeoff}
                onChange={(e) => setNewTradeoff(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTradeoff()}
                className="flex-1 px-2 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:border-amber-500 focus:outline-none"
                placeholder="Add tradeoff..."
              />
              <button onClick={handleAddTradeoff} className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded">
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Confidence */}
        <div>
          <label className="text-xs font-medium text-slate-400 mb-2">Confidence</label>
          <div className="flex gap-2 mt-1">
            {(['high', 'medium', 'low'] as const).map(level => (
              <button
                key={level}
                onClick={() => setEditData(prev => ({ ...prev, confidence: level }))}
                className={`px-3 py-1 text-xs rounded border transition-colors ${
                  editData.confidence === level
                    ? level === 'high' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : level === 'medium' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'bg-red-500/20 border-red-500/50 text-red-400'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={() => onSave(editData)}
            className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded"
          >
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  // Display mode
  return (
    <div className={`rounded-lg border transition-colors ${statusColors[bet.status]}`}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-slate-200">{bet.title}</h4>
              <span className={`text-[10px] px-2 py-0.5 rounded ${statusBadgeColors[bet.status]}`}>
                {bet.status}
              </span>
              {bet.confidence && (
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  bet.confidence === 'high' ? 'bg-emerald-500/10 text-emerald-400' :
                  bet.confidence === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-red-500/10 text-red-400'
                }`}>
                  {bet.confidence} conf
                </span>
              )}
            </div>
            {bet.intent && (
              <p className="text-xs text-slate-400 mt-1">{bet.intent}</p>
            )}
          </div>
          <button className="text-slate-500 hover:text-slate-300 p-1">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
          {bet.linkedObjectives.length > 0 && (
            <span className="flex items-center gap-1">
              <Link2 className="w-3 h-3" /> {bet.linkedObjectives.length} linked
            </span>
          )}
          {bet.pros.length > 0 && (
            <span className="flex items-center gap-1 text-emerald-500">
              <ThumbsUp className="w-3 h-3" /> {bet.pros.length}
            </span>
          )}
          {bet.cons.length > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <ThumbsDown className="w-3 h-3" /> {bet.cons.length}
            </span>
          )}
          {bet.tradeoffs.length > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="w-3 h-3" /> {bet.tradeoffs.length}
            </span>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50">
          {/* Linked Objectives */}
          {bet.linkedObjectives.length > 0 && (
            <div className="pt-3">
              <h5 className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Link2 className="w-3 h-3" /> Linked Objectives
              </h5>
              <div className="flex flex-wrap gap-1">
                {bet.linkedObjectives.map(objId => {
                  const obj = objectives.find(o => o.id === objId);
                  return obj ? (
                    <span key={objId} className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded">
                      {obj.text.slice(0, 30)}{obj.text.length > 30 ? '...' : ''}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Pros */}
          {bet.pros.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-emerald-400 mb-1 flex items-center gap-1">
                <ThumbsUp className="w-3 h-3" /> Pros
              </h5>
              <ul className="space-y-1">
                {bet.pros.map((pro, idx) => (
                  <li key={idx} className="text-xs text-slate-300 pl-2 border-l-2 border-emerald-500/30">
                    {pro}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cons */}
          {bet.cons.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-red-400 mb-1 flex items-center gap-1">
                <ThumbsDown className="w-3 h-3" /> Cons
              </h5>
              <ul className="space-y-1">
                {bet.cons.map((con, idx) => (
                  <li key={idx} className="text-xs text-slate-300 pl-2 border-l-2 border-red-500/30">
                    {con}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tradeoffs */}
          {bet.tradeoffs.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-amber-400 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Tradeoffs
              </h5>
              <ul className="space-y-1">
                {bet.tradeoffs.map((tradeoff, idx) => (
                  <li key={idx} className="text-xs text-slate-300 pl-2 border-l-2 border-amber-500/30">
                    {tradeoff}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
            <button
              onClick={onEdit}
              className="flex-1 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
            >
              Edit
            </button>
            {bet.status === 'draft' && (
              <>
                <button
                  onClick={onAccept}
                  className="flex-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center justify-center gap-1 transition-colors"
                >
                  <Check className="w-3 h-3" /> Accept
                </button>
                <button
                  onClick={onReject}
                  className="flex-1 px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded flex items-center justify-center gap-1 transition-colors"
                >
                  <X className="w-3 h-3" /> Reject
                </button>
              </>
            )}
            {bet.status === 'accepted' && (
              <button
                onClick={onReject}
                className="flex-1 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded flex items-center justify-center gap-1 transition-colors"
              >
                <X className="w-3 h-3" /> Reject
              </button>
            )}
            {bet.status === 'rejected' && (
              <button
                onClick={onAccept}
                className="flex-1 px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded flex items-center justify-center gap-1 transition-colors"
              >
                <Check className="w-3 h-3" /> Reconsider
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Column Header
// ============================================================================

interface ColumnHeaderProps {
  icon: React.ElementType;
  title: string;
  count: number;
  colorClass: string;
  onAdd?: () => void;
  onAI?: () => void;
  aiLoading?: boolean;
}

function ColumnHeader({ icon: Icon, title, count, colorClass, onAdd, onAI, aiLoading }: ColumnHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-medium text-slate-200">
          {title}
          <span className="ml-2 text-xs font-normal text-slate-500">({count})</span>
        </h3>
      </div>
      <div className="flex items-center gap-1">
        {onAI && (
          <button
            onClick={onAI}
            disabled={aiLoading}
            className="p-1.5 text-purple-400 hover:bg-purple-500/10 rounded transition-colors disabled:opacity-50"
            title="AI Improve"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          </button>
        )}
        {onAdd && (
          <button
            onClick={onAdd}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
            title="Add"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategySurfaceCommand({
  companyId,
  companyName,
  data,
  helpers,
  proposeStrategy,
  // NOTE: proposeObjectives and proposeTactics not used in Command
  // Objectives → Builder, Tactics → Orchestration
  isProposing,
}: StrategySurfaceViewProps) {
  const { objectives, priorities } = helpers;
  const strategy = data.strategy;

  // Track which bets are expanded and which are being edited
  const [expandedBets, setExpandedBets] = useState<Record<string, boolean>>({});
  const [editingBets, setEditingBets] = useState<Record<string, boolean>>({});

  // Convert legacy priorities to strategic bet format
  const strategicBets: StrategicBetData[] = priorities
    .filter(p => p.title && p.title.trim().length > 0)
    .map(p => ({
      id: p.id,
      title: p.title,
      intent: p.description || p.rationale || '',
      linkedObjectives: [],
      pros: (p as unknown as { pros?: string[] }).pros || [],
      cons: (p as unknown as { cons?: string[] }).cons || [],
      tradeoffs: (p as unknown as { tradeoffs?: string[] }).tradeoffs || [],
      confidence: p.priority === 'high' ? 'high' : p.priority === 'low' ? 'low' : 'medium',
      status: ((p as unknown as { status?: StrategicBetStatus }).status) || 'draft',
    }));

  // Handlers
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedBets(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleEdit = useCallback((id: string) => {
    setEditingBets(prev => ({ ...prev, [id]: true }));
    setExpandedBets(prev => ({ ...prev, [id]: true }));
  }, []);

  const handleSaveBet = useCallback((id: string, updates: Partial<StrategicBetData>) => {
    console.log('Save strategic bet:', id, updates);
    // TODO: Wire up actual save to API
    setEditingBets(prev => ({ ...prev, [id]: false }));
  }, []);

  const handleCancel = useCallback((id: string) => {
    setEditingBets(prev => ({ ...prev, [id]: false }));
  }, []);

  const handleAccept = useCallback((id: string) => {
    console.log('Accept bet:', id);
    // TODO: Wire up status update to API
  }, []);

  const handleReject = useCallback((id: string) => {
    console.log('Reject bet:', id);
    // TODO: Wire up status update to API
  }, []);

  const handleAddBet = useCallback(() => {
    console.log('Add new strategic bet');
    // TODO: Wire up creation flow
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            Strategic Deliberation
          </h1>
          <p className="text-sm text-slate-400 mt-1">{companyName}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="text-emerald-400">{strategicBets.filter(b => b.status === 'accepted').length} accepted</span>
            <span>•</span>
            <span className="text-amber-400">{strategicBets.filter(b => b.status === 'draft').length} pending</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Frame+Objectives | Strategic Bets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Frame + Objectives (read-only) */}
        <div className="space-y-4">
          {/* Strategic Frame */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <h3 className="text-sm font-medium text-slate-200 mb-4">Strategic Frame</h3>
            <StrategyFrameDisplay
              companyId={companyId}
              strategyId={strategy.id || ''}
              hydratedFrame={data.hydratedFrame}
              frameSummary={data.frameSummary}
            />
          </div>

          {/* Objectives (Read-only) */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <ColumnHeader
              icon={Target}
              title="Objectives"
              count={objectives.length}
              colorClass="bg-blue-500/10 text-blue-400"
            />
            <div className="space-y-2">
              {objectives
                .filter(obj => obj.text && obj.text.trim().length > 0)
                .map((obj, idx) => (
                  <div
                    key={obj.id || `obj-${idx}`}
                    className="p-3 rounded-lg border border-slate-700 bg-slate-800/50"
                  >
                    <p className="text-sm text-slate-200">{obj.text}</p>
                    {(obj.metric || obj.target) && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                        {obj.metric && <span className="text-blue-400">{obj.metric}</span>}
                        {obj.target && <span>→ {obj.target}</span>}
                      </div>
                    )}
                  </div>
                ))}
              {objectives.filter(obj => obj.text && obj.text.trim().length > 0).length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">
                  Define objectives in Builder first
                </p>
              )}
            </div>
          </div>

          {/* Navigation hint */}
          <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
            <p className="text-xs text-slate-400">
              Once bets are accepted, switch to <strong className="text-slate-200">Orchestration</strong> to generate tactics and programs.
            </p>
          </div>
        </div>

        {/* RIGHT: Strategic Bets */}
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 h-fit">
          <ColumnHeader
            icon={Layers}
            title="Strategic Bets"
            count={strategicBets.length}
            colorClass="bg-purple-500/10 text-purple-400"
            onAI={proposeStrategy}
            aiLoading={isProposing}
            onAdd={handleAddBet}
          />
          <div className="space-y-3">
            {strategicBets.map((bet) => (
              <StrategicBetCard
                key={bet.id}
                bet={bet}
                objectives={objectives}
                isExpanded={expandedBets[bet.id] || false}
                isEditing={editingBets[bet.id] || false}
                onToggleExpand={() => handleToggleExpand(bet.id)}
                onEdit={() => handleEdit(bet.id)}
                onSave={(updates) => handleSaveBet(bet.id, updates)}
                onCancel={() => handleCancel(bet.id)}
                onAccept={() => handleAccept(bet.id)}
                onReject={() => handleReject(bet.id)}
              />
            ))}
            {strategicBets.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">
                <Layers className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                <p>No strategic bets defined yet.</p>
                <p className="text-xs mt-1">Use AI to generate bets from your objectives.</p>
                <button
                  onClick={proposeStrategy}
                  disabled={isProposing || objectives.length === 0}
                  className="mt-4 px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors disabled:opacity-50"
                >
                  {isProposing ? 'Generating...' : 'Generate Strategic Bets'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StrategySurfaceCommand;
