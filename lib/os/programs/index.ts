// lib/os/programs/index.ts
// Programs module exports

// Website Program
export {
  createWebsiteProgramSkeleton,
  type WebsiteProgramSkeletonInput,
  type StrategyExcerpt,
  type WebsiteLabSummary,
} from './website/createWebsiteProgramSkeleton';

// Airtable operations
export {
  getProgramsForCompany,
  getProgramById,
  createProgram,
  updateProgramPlan,
  updateProgramStatus,
  activateProgram,
  getActiveProgramForCompany,
} from '@/lib/airtable/programs';

// Types
export type {
  ProgramType,
  ProgramStatus,
  ProgramRecord,
  WebsiteProgramPlan,
  WebsiteProgramPlanUpdate,
  ProgramPriority,
  ProgramPhase,
  ProgramReadinessGate,
  ProgramInputsSnapshot,
  ListProgramsResponse,
  CreateProgramRequest,
  UpdateProgramRequest,
  ProgramOperationResponse,
} from '@/lib/types/program';
