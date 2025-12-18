// components/os/strategy/views/index.ts
// Strategy Surface View Compositions
//
// 2-PAGE MODEL (December 2024):
// - Workspace: Single editing surface (StrategyWorkspace.tsx at parent level)
// - Blueprint: Read-only summary (accepted bets only)
//
// DEPRECATED views (kept for reference, not exported):
// - Builder, Command, Orchestration → replaced by Workspace

export { StrategySurfaceBlueprint } from './StrategySurfaceBlueprint';
export type { StrategySurfaceViewProps, PanelMode } from './types';

// NOTE: Legacy views still exist in this folder but are NOT exported:
// - StrategySurfaceBuilder.tsx (deprecated - use StrategyWorkspace)
// - StrategySurfaceCommand.tsx (deprecated - use StrategyWorkspace)
// - StrategySurfaceOrchestration.tsx (deprecated - use StrategyWorkspace)
