'use client';

// components/strategy-orchestration/ObjectiveEditor.tsx
// Inline Objective Editor with AI-assist

import { useState } from 'react';
import { Plus, Trash2, GripVertical, Check, X } from 'lucide-react';
import { FieldImproveButton } from './AIProposalButton';
import type { OrchestrationObjective } from '@/lib/types/strategyOrchestration';

// ============================================================================
// Types
// ============================================================================

interface ObjectiveEditorProps {
  objectives: OrchestrationObjective[];
  onUpdate: (objectives: OrchestrationObjective[]) => void;
  companyId: string;
  strategyId?: string;
  readOnly?: boolean;
}

interface EditingState {
  id: string;
  text: string;
  metric?: string;
  target?: string;
}

// ============================================================================
// Single Objective Row
// ============================================================================

function ObjectiveRow({
  objective,
  onUpdate,
  onDelete,
  companyId,
  strategyId,
  readOnly,
}: {
  objective: OrchestrationObjective;
  onUpdate: (updated: OrchestrationObjective) => void;
  onDelete: () => void;
  companyId: string;
  strategyId?: string;
  readOnly?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<EditingState>({
    id: objective.id,
    text: objective.text,
    metric: objective.metric,
    target: objective.target,
  });

  const handleSave = () => {
    onUpdate({
      ...objective,
      text: editState.text,
      metric: editState.metric,
      target: editState.target,
      updatedAt: new Date().toISOString(),
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditState({
      id: objective.id,
      text: objective.text,
      metric: objective.metric,
      target: objective.target,
    });
    setIsEditing(false);
  };

  const handleImproved = (improvedValue: unknown, rationale: string) => {
    if (typeof improvedValue === 'string') {
      setEditState(prev => ({ ...prev, text: improvedValue }));
      setIsEditing(true);
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    active: 'bg-green-100 text-green-700',
    achieved: 'bg-blue-100 text-blue-700',
    deferred: 'bg-yellow-100 text-yellow-700',
    abandoned: 'bg-red-100 text-red-700',
  };

  if (isEditing) {
    return (
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Objective
          </label>
          <textarea
            value={editState.text}
            onChange={(e) => setEditState(prev => ({ ...prev, text: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={2}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Metric (optional)
            </label>
            <input
              type="text"
              value={editState.metric || ''}
              onChange={(e) => setEditState(prev => ({ ...prev, metric: e.target.value }))}
              placeholder="e.g., Lead conversion rate"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Target (optional)
            </label>
            <input
              type="text"
              value={editState.target || ''}
              onChange={(e) => setEditState(prev => ({ ...prev, target: e.target.value }))}
              placeholder="e.g., +25%"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={handleCancel}
            className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1"
          >
            <Check className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
      {!readOnly && (
        <GripVertical className="w-4 h-4 text-gray-300 mt-1 cursor-grab opacity-0 group-hover:opacity-100" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <p
            className={`text-sm text-gray-900 ${!readOnly ? 'cursor-pointer hover:text-blue-600' : ''}`}
            onClick={() => !readOnly && setIsEditing(true)}
          >
            {objective.text}
          </p>
          <span className={`px-2 py-0.5 text-xs rounded-full ml-2 ${statusColors[objective.status]}`}>
            {objective.status}
          </span>
        </div>
        {(objective.metric || objective.target) && (
          <p className="text-xs text-gray-500 mt-0.5">
            {objective.metric && <span>{objective.metric}</span>}
            {objective.metric && objective.target && <span> → </span>}
            {objective.target && <span className="font-medium">{objective.target}</span>}
          </p>
        )}
      </div>
      {!readOnly && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <FieldImproveButton
            companyId={companyId}
            strategyId={strategyId}
            fieldPath={`objectives.${objective.id}.text`}
            currentValue={objective.text}
            onImproved={handleImproved}
          />
          <button
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-600"
            title="Delete objective"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ObjectiveEditor({
  objectives,
  onUpdate,
  companyId,
  strategyId,
  readOnly = false,
}: ObjectiveEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newObjective, setNewObjective] = useState('');

  const handleAdd = () => {
    if (!newObjective.trim()) return;

    const newObj: OrchestrationObjective = {
      id: `obj-${Date.now()}`,
      text: newObjective.trim(),
      status: 'draft',
      updatedAt: new Date().toISOString(),
    };

    onUpdate([...objectives, newObj]);
    setNewObjective('');
    setIsAdding(false);
  };

  const handleUpdateObjective = (updated: OrchestrationObjective) => {
    onUpdate(objectives.map((o) => (o.id === updated.id ? updated : o)));
  };

  const handleDeleteObjective = (id: string) => {
    onUpdate(objectives.filter((o) => o.id !== id));
  };

  return (
    <div className="space-y-2">
      {/* Objective List */}
      <div className="space-y-1">
        {objectives.length === 0 ? (
          <p className="text-sm text-gray-500 italic py-2">No objectives defined yet.</p>
        ) : (
          objectives.map((objective) => (
            <ObjectiveRow
              key={objective.id}
              objective={objective}
              onUpdate={handleUpdateObjective}
              onDelete={() => handleDeleteObjective(objective.id)}
              companyId={companyId}
              strategyId={strategyId}
              readOnly={readOnly}
            />
          ))
        )}
      </div>

      {/* Add New */}
      {!readOnly && (
        <>
          {isAdding ? (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <textarea
                value={newObjective}
                onChange={(e) => setNewObjective(e.target.value)}
                placeholder="Enter a new objective..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                rows={2}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewObjective('');
                  }}
                  className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!newObjective.trim()}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Add Objective
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-2 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-gray-300 hover:border-blue-300 flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Objective
            </button>
          )}
        </>
      )}
    </div>
  );
}
