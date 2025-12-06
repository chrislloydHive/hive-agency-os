// lib/gap/orchestrator/index.ts
// Full GAP Dual-Mode Entry Point
//
// IMPORTANT: This module provides two completely isolated execution paths:
//
// 1. Lead Magnet Mode (DEFAULT): The original, proven public lead magnet.
//    - NO database writes
//    - NO context graph interactions
//    - NO insights extraction
//    - NO provenance tracking
//    - Produces narrative PDF-style report ONLY
//
// 2. OS Orchestrator Mode: Context-first mode for Hive OS.
//    - Runs Labs to fill context gaps
//    - Merges context with governance
//    - Extracts normalized insights
//    - Creates snapshots for QBR
//    - Returns structured data, NOT narrative

export { type FullGAPMode } from './types';
export type {
  OrchestratorInput,
  OrchestratorOutput,
  GAPStructuredOutput,
  LabRefinementOutput,
  LabRunPlan,
  GAPSnapshot,
} from './types';

// Re-export the orchestrator
export { runFullGAPOrchestrator } from './runFullGAPOrchestrator';

// Re-export lab plan utilities
export {
  determineLabsNeededForMissingFields,
  getAllAvailableLabs,
  getFieldsForLab,
  getLabForField,
} from './labPlan';

// Re-export context health utilities
export { assessContextHealth, getQuickHealthScore } from './contextHealth';
