'use client';

// components/strategy-orchestration/DraftPreviewPanel.tsx
// Draft Preview Panel - Shows AI proposals with apply/dismiss actions
//
// KEY PRINCIPLE: AI writes DRAFTS only until user applies

import { useState } from 'react';
import { Check, X, Sparkles, AlertTriangle } from 'lucide-react';
import type {
  ObjectiveDraft,
  StrategyDraft,
  TacticDraft,
} from '@/lib/types/strategyOrchestration';
import type { ConfidenceLevel } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

interface DraftPreviewPanelProps {
  type: 'objectives' | 'strategy' | 'tactics' | 'field';
  draft: ObjectiveDraft[] | StrategyDraft | TacticDraft[] | FieldDraft;
  onApply: () => Promise<void>;
  onDismiss: () => void;
  isApplying?: boolean;
  confidence?: ConfidenceLevel;
}

interface FieldDraft {
  fieldPath: string;
  originalValue: unknown;
  improvedValue: unknown;
  rationale: string;
}

// ============================================================================
// Confidence Badge
// ============================================================================

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const colors = {
    high: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${colors[level]}`}>
      {level} confidence
    </span>
  );
}

// ============================================================================
// Objective Draft Preview
// ============================================================================

function ObjectiveDraftPreview({ drafts }: { drafts: ObjectiveDraft[] }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700">Proposed Objectives</h4>
      {drafts.map((draft, i) => (
        <div key={i} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-gray-900">{draft.text}</p>
            <ConfidenceBadge level={draft.confidence} />
          </div>
          {draft.metric && (
            <p className="mt-1 text-xs text-gray-600">
              <span className="font-medium">Metric:</span> {draft.metric}
              {draft.target && ` → ${draft.target}`}
            </p>
          )}
          {draft.timeframe && (
            <p className="text-xs text-gray-600">
              <span className="font-medium">Timeframe:</span> {draft.timeframe}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500 italic">{draft.rationale}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Strategy Draft Preview
// ============================================================================

function StrategyDraftPreview({ draft }: { draft: StrategyDraft }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-700">Proposed Strategy</h4>
        <h3 className="text-lg font-semibold text-gray-900 mt-1">{draft.title}</h3>
        <p className="text-sm text-gray-600 mt-1">{draft.summary}</p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Strategic Bets</h4>
        <div className="space-y-2">
          {draft.priorities.map((priority, i) => (
            <div key={i} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-gray-900">{priority.title}</p>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  priority.priority === 'high' ? 'bg-red-100 text-red-800' :
                  priority.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {priority.priority}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1">{priority.description}</p>
              <p className="text-xs text-gray-500 mt-1 italic">
                <span className="font-medium">Tradeoff:</span> {priority.tradeoff}
              </p>
            </div>
          ))}
        </div>
      </div>

      {draft.tradeoffs && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <h4 className="text-sm font-medium text-amber-800 mb-2">Strategic Tradeoffs</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="font-medium text-green-700">Optimizes For</p>
              <ul className="mt-1 text-gray-600">
                {draft.tradeoffs.optimizesFor.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-red-700">Sacrifices</p>
              <ul className="mt-1 text-gray-600">
                {draft.tradeoffs.sacrifices.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-yellow-700">Risks</p>
              <ul className="mt-1 text-gray-600">
                {draft.tradeoffs.risks.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 italic">{draft.rationale}</p>
    </div>
  );
}

// ============================================================================
// Tactic Draft Preview
// ============================================================================

function TacticDraftPreview({ drafts }: { drafts: TacticDraft[] }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700">Proposed Tactics</h4>
      {drafts.map((draft, i) => (
        <div key={i} className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-gray-900">{draft.title}</p>
            <div className="flex gap-1">
              <span className={`px-1.5 py-0.5 text-xs rounded ${
                draft.impact === 'high' ? 'bg-green-200 text-green-800' :
                draft.impact === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                'bg-gray-200 text-gray-800'
              }`}>
                {draft.impact} impact
              </span>
              <span className={`px-1.5 py-0.5 text-xs rounded ${
                draft.effort === 'low' ? 'bg-green-200 text-green-800' :
                draft.effort === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                'bg-red-200 text-red-800'
              }`}>
                {draft.effort} effort
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-1">{draft.description}</p>
          {draft.channels.length > 0 && (
            <div className="flex gap-1 mt-2">
              {draft.channels.map((channel, j) => (
                <span key={j} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                  {channel}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2 italic">{draft.alignmentNote}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Field Draft Preview
// ============================================================================

function FieldDraftPreview({ draft }: { draft: FieldDraft }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700">Field Improvement</h4>
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-xs text-gray-500 mb-2">Field: {draft.fieldPath}</p>

        <div className="space-y-2">
          <div>
            <p className="text-xs font-medium text-red-600">Original:</p>
            <p className="text-sm text-gray-600 line-through">
              {String(draft.originalValue || '(empty)')}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-green-600">Improved:</p>
            <p className="text-sm text-gray-900">
              {String(draft.improvedValue)}
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-3 italic">{draft.rationale}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DraftPreviewPanel({
  type,
  draft,
  onApply,
  onDismiss,
  isApplying = false,
  confidence = 'medium',
}: DraftPreviewPanelProps) {
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    setError(null);
    try {
      await onApply();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply draft');
    }
  };

  return (
    <div className="border border-blue-300 bg-blue-50 rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-blue-100 border-b border-blue-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">AI Proposal</span>
          <ConfidenceBadge level={confidence} />
        </div>
        <span className="text-xs text-blue-600">Review before applying</span>
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {type === 'objectives' && Array.isArray(draft) && (
          <ObjectiveDraftPreview drafts={draft as ObjectiveDraft[]} />
        )}
        {type === 'strategy' && !Array.isArray(draft) && 'title' in draft && (
          <StrategyDraftPreview draft={draft as StrategyDraft} />
        )}
        {type === 'tactics' && Array.isArray(draft) && (
          <TacticDraftPreview drafts={draft as TacticDraft[]} />
        )}
        {type === 'field' && !Array.isArray(draft) && 'fieldPath' in draft && (
          <FieldDraftPreview draft={draft as FieldDraft} />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 bg-white border-t border-blue-200 flex justify-end gap-2">
        <button
          onClick={onDismiss}
          disabled={isApplying}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
        >
          <X className="w-4 h-4 inline mr-1" />
          Dismiss
        </button>
        <button
          onClick={handleApply}
          disabled={isApplying}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
        >
          {isApplying ? (
            <>
              <span className="animate-spin">⏳</span>
              Applying...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Apply
            </>
          )}
        </button>
      </div>
    </div>
  );
}
