'use client';

// components/os/strategy/StrategyFrameDisplay.tsx
// Displays Strategic Frame fields with inline editing and AI Improve buttons
//
// Features:
// - Inline editing per field (expands in place)
// - Direct API updates (canonical strategy update endpoint)
// - AI draft support via FieldAIActions
// - Provenance badges (User override, Context, Missing)
// - "Use this" to adopt context suggestions
// - Completion progress bar

import React, { useCallback } from 'react';
import {
  Users,
  Package,
  Sparkles,
  Target,
  Shield,
  Info,
} from 'lucide-react';
import type { HydratedStrategyFrame, HydratedFrameField } from '@/lib/os/strategy/strategyHydration';
import { type FieldDraft } from '@/components/os/ai/FieldAIActions';
import {
  InlineEditableField,
  type StrategyFrameKey,
  type FieldProvenance,
} from './InlineEditableField';

// ============================================================================
// Types
// ============================================================================

interface StrategyFrameDisplayProps {
  companyId: string;
  strategyId: string;
  hydratedFrame: HydratedStrategyFrame;
  frameSummary: {
    fromUser: string[];
    fromContext: string[];
    missing: string[];
  };
  // AI Draft support
  fieldDrafts?: Record<string, FieldDraft>;
  onDraftReceived?: (draft: FieldDraft) => void;
  onApplyDraft?: (fieldKey: string, value: string) => void;
  onDiscardDraft?: (fieldKey: string) => void;
  contextPayload?: {
    objectives?: unknown[];
    priorities?: unknown[];
    tactics?: unknown[];
    frame?: unknown;
  };
  // Optional callback when a field is saved (for parent refresh)
  onFieldSaved?: (fieldKey: string, value: string) => void;
  // Read-only mode (disables editing)
  readOnly?: boolean;
  className?: string;
}

// ============================================================================
// Field Configuration
// ============================================================================

interface FrameFieldConfig {
  key: StrategyFrameKey;
  fullKey: string; // With 'frame.' prefix for drafts
  label: string;
  icon: React.ReactNode;
  hydratedKey: keyof HydratedStrategyFrame;
}

const FRAME_FIELDS: FrameFieldConfig[] = [
  {
    key: 'audience',
    fullKey: 'frame.audience',
    label: 'Target Audience',
    icon: <Users className="w-4 h-4" />,
    hydratedKey: 'audience',
  },
  {
    key: 'offering',
    fullKey: 'frame.offering',
    label: 'Primary Offering',
    icon: <Package className="w-4 h-4" />,
    hydratedKey: 'offering',
  },
  {
    key: 'valueProp',
    fullKey: 'frame.valueProp',
    label: 'Value Proposition',
    icon: <Sparkles className="w-4 h-4" />,
    hydratedKey: 'valueProp',
  },
  {
    key: 'positioning',
    fullKey: 'frame.positioning',
    label: 'Market Positioning',
    icon: <Target className="w-4 h-4" />,
    hydratedKey: 'positioning',
  },
  {
    key: 'constraints',
    fullKey: 'frame.constraints',
    label: 'Constraints',
    icon: <Shield className="w-4 h-4" />,
    hydratedKey: 'constraints',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/** Convert HydratedFrameField to FieldProvenance */
function toProvenance(field: HydratedFrameField): FieldProvenance {
  return {
    source: field.source === 'derived' ? 'context' : field.source,
    sourceLabel: field.sourceLabel,
    contextPath: field.contextPath,
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategyFrameDisplay({
  companyId,
  strategyId,
  hydratedFrame,
  frameSummary,
  fieldDrafts = {},
  onDraftReceived,
  onApplyDraft,
  onDiscardDraft,
  contextPayload,
  onFieldSaved,
  readOnly = false,
  className = '',
}: StrategyFrameDisplayProps) {
  // Calculate completion stats
  const totalFields = frameSummary.fromUser.length + frameSummary.fromContext.length + frameSummary.missing.length;
  const filledFields = frameSummary.fromUser.length + frameSummary.fromContext.length;
  const completionPercent = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  // Handle field save success (notify parent)
  const handleFieldSaved = useCallback((fieldKey: StrategyFrameKey, newValue: string) => {
    console.log(`[StrategyFrameDisplay] Field saved: ${fieldKey} = "${newValue}"`);
    console.log(`[StrategyFrameDisplay] Calling onFieldSaved...`);
    onFieldSaved?.(`frame.${fieldKey}`, newValue);
  }, [onFieldSaved]);

  // Create AI handlers for a field
  const getAIHandlers = useCallback((fullKey: string) => {
    if (!onDraftReceived || !onApplyDraft || !onDiscardDraft) {
      return {};
    }
    return {
      draft: fieldDrafts[fullKey],
      onDraftReceived: (draft: FieldDraft) => onDraftReceived(draft),
      onApplyDraft: (value: string) => onApplyDraft(fullKey, value),
      onDiscardDraft: () => onDiscardDraft(fullKey),
      contextPayload,
    };
  }, [fieldDrafts, onDraftReceived, onApplyDraft, onDiscardDraft, contextPayload]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Strategic Frame</h3>
          <div className="relative group">
            <Info className="w-3.5 h-3.5 text-slate-500 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10">
              <div className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 whitespace-nowrap shadow-lg">
                Strategic Frame = your strategy&apos;s decisions. Context = facts.
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                completionPercent >= 80
                  ? 'bg-emerald-500'
                  : completionPercent >= 50
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">
            {filledFields}/{totalFields}
          </span>
        </div>
      </div>

      {/* Summary Badges */}
      <div className="flex flex-wrap gap-2">
        {frameSummary.fromUser.length > 0 && (
          <span className="text-xs text-purple-400">
            {frameSummary.fromUser.length} user override{frameSummary.fromUser.length > 1 ? 's' : ''}
          </span>
        )}
        {frameSummary.fromContext.length > 0 && (
          <span className="text-xs text-emerald-400">
            {frameSummary.fromContext.length} context fact{frameSummary.fromContext.length > 1 ? 's' : ''}
          </span>
        )}
        {frameSummary.missing.length > 0 && (
          <span className="text-xs text-amber-400">
            {frameSummary.missing.length} missing
          </span>
        )}
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {FRAME_FIELDS.map((config) => {
          const hydratedField = hydratedFrame[config.hydratedKey];

          // Handle non-field values (like arrays for successMetrics, nonGoals)
          if (typeof hydratedField !== 'object' || !('source' in hydratedField)) {
            return null;
          }

          const field = hydratedField as HydratedFrameField;

          return (
            <InlineEditableField
              key={config.key}
              label={config.label}
              value={field.value}
              placeholder="Not defined"
              provenance={toProvenance(field)}
              icon={config.icon}
              companyId={companyId}
              strategyId={strategyId}
              fieldKey={config.key}
              readOnly={readOnly}
              onSaveSuccess={handleFieldSaved}
              {...getAIHandlers(config.fullKey)}
            />
          );
        })}
      </div>
    </div>
  );
}

export default StrategyFrameDisplay;
