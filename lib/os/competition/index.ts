// lib/os/competition/index.ts
// Competition Module - Source Selection & Utilities
//
// This module provides competition-specific utilities including:
// - V4 vs V3 source selection with mutual exclusivity
// - Source recommendation logic
// - Context integration helpers

export {
  selectCompetitionSource,
  shouldV4ReplaceV3,
  validateCompetitionDataConsistency,
  recommendCompetitionRun,
  getCompetitionSourceId,
  sourceIdToVersion,
  isCompetitionSource,
  type CompetitionVersion,
  type CompetitionSourceSelection,
  type CompetitionRunInfo,
} from './sourceSelection';
