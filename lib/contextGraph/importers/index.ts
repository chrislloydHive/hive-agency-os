// lib/contextGraph/importers/index.ts
// Context Graph Importers - Public API
//
// DOMAIN AUTHORITY: Each importer maps to specific domains
// RULE: Importers only read from findings.* - never dimensions/summaries

export type {
  DomainImporter,
  ImporterRegistryEntry,
  ImportResult,
  HydrationResult,
  HydrationTelemetry,
  DomainTelemetry,
} from './types';

export {
  hydrateContextFromHistory,
  runSingleImporter,
  getEnabledImporters,
  getImporterById,
  checkAvailableImporters,
} from './registry';

// Legacy importers
export { gapImporter } from './gapImporter';
export { gapPlanImporter } from './gapPlanImporter';
export { websiteLabImporter, importWebsiteLabFromContract } from './websiteLabImporter';
export { brandLabImporter } from './brandLabImporter';
export { seoLabImporter, importSeoLabFromContract } from './seoLabImporter';
export { contentLabImporter, importContentLabFromContract } from './contentLabImporter';
export { opsLabImporter, importOpsLabFromContract } from './opsLabImporter';
export { demandLabImporter, importDemandLabFromContract } from './demandLabImporter';

// Re-export lab output contract types
export type {
  LabOutput,
  LabKey,
  LabOutputMeta,
  LabIssue,
  IssueSeverity,
  WebsiteLabOutput,
  WebsiteLabFindings,
  SeoLabOutput,
  SeoLabFindings,
  ContentLabOutput,
  ContentLabFindings,
  OpsLabOutput,
  OpsLabFindings,
  DemandLabOutput,
  DemandLabFindings,
  BrandLabOutput,
  BrandLabFindings,
  AudienceLabOutput,
  AudienceLabFindings,
  MediaLabOutput,
  MediaLabFindings,
  CompetitionLabOutput,
  CompetitionLabFindings,
  GapOutput,
  GapFindings,
} from '@/lib/diagnostics/contracts/labOutput';

export { createLabOutput, isLabOutput, hasFindings } from '@/lib/diagnostics/contracts/labOutput';
