// components/os/strategy/views/types.ts
// Shared types for Strategy Surface views
//
// All view compositions receive the same props from StrategySurface.
// This ensures consistency and prevents prop drilling mismatches.

import type { StrategyDraft } from '@/lib/os/strategy/drafts';
import type {
  UnifiedStrategyViewModelData,
  UnifiedStrategyHelpers,
} from '@/hooks/useUnifiedStrategyViewModel';

/**
 * Props passed to all view compositions from StrategySurface
 */
export interface StrategySurfaceViewProps {
  companyId: string;
  companyName: string;

  // Data from unified view model
  data: UnifiedStrategyViewModelData;
  helpers: UnifiedStrategyHelpers;

  // Actions
  refresh: () => Promise<void>;
  applyDraft: (draft: StrategyDraft) => Promise<boolean>;
  discardDraft: (draftId: string) => Promise<boolean>;
  proposeObjectives: () => Promise<void>;
  proposeStrategy: () => Promise<void>;
  proposeTactics: () => Promise<void>;
  improveField: (fieldPath: string, currentValue: string) => Promise<void>;

  // Loading states
  isProposing: boolean;
  isApplying: boolean;
}

/**
 * Mode for shared panels
 * - edit: Full editing with inline fields
 * - read: Read-only display with edit links
 * - ai: AI-first with prominent generate buttons
 */
export type PanelMode = 'edit' | 'read' | 'ai';
