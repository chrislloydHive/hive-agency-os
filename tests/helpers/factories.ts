// tests/helpers/factories.ts
// Reusable test factories for creating properly-typed mock objects
//
// Usage: Import factories and create test objects with sensible defaults,
// then override specific fields as needed for your test case.

import type {
  Artifact,
  ArtifactType,
  ArtifactStatus,
  ArtifactSource,
  ArtifactUsage,
  GoogleFileType,
} from '@/lib/types/artifact';
import type {
  RfpSection,
  RfpSectionKey,
  RfpSectionStatus,
  RfpSectionSourceType,
  GeneratedUsing,
} from '@/lib/types/rfp';
import type {
  RfpWinStrategy,
  RfpEvaluationCriterion,
  RfpWinTheme,
  RfpProofItem,
  RfpLandmine,
  StrategyHealth,
} from '@/lib/types/rfpWinStrategy';
import type { BidRisk } from '@/lib/os/rfp/computeBidReadiness';
import type { FirmBrainReadiness, ComponentScore } from '@/lib/os/ai/firmBrainReadiness';
import type { CompanyRecord } from '@/lib/airtable/companies';

// ============================================================================
// Utility Types
// ============================================================================

/**
 * DeepPartial allows nested partial overrides
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ============================================================================
// Counter for unique IDs
// ============================================================================

let idCounter = 0;
function uniqueId(prefix: string): string {
  return `${prefix}-${++idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// Artifact Factory
// ============================================================================

/**
 * Create a valid Artifact with sensible defaults
 */
export function createArtifact(overrides: DeepPartial<Artifact> = {}): Artifact {
  const now = new Date().toISOString();

  const defaultUsage: ArtifactUsage = {
    attachedWorkCount: 0,
    firstAttachedAt: null,
    lastAttachedAt: null,
    completedWorkCount: 0,
  };

  return {
    id: uniqueId('artifact'),
    companyId: 'test-company',
    title: 'Test Artifact',
    type: 'strategy_doc' as ArtifactType,
    status: 'draft' as ArtifactStatus,
    source: 'manual' as ArtifactSource,
    googleFileId: null,
    googleFileType: null,
    googleFileUrl: null,
    googleFolderId: null,
    googleModifiedAt: null,
    sourceStrategyId: null,
    sourceQbrStoryId: null,
    sourceBriefId: null,
    sourceMediaPlanId: null,
    sourceContentPlanId: null,
    engagementId: null,
    projectId: null,
    contextVersionAtCreation: null,
    strategyVersionAtCreation: null,
    snapshotId: null,
    isStale: false,
    stalenessReason: null,
    stalenessCheckedAt: null,
    lastSyncedAt: null,
    generatedContent: null,
    generatedMarkdown: null,
    generatedFormat: null,
    inputsUsedHash: null,
    includedTacticIds: null,
    finalizedAt: null,
    finalizedBy: null,
    archivedAt: null,
    archivedBy: null,
    archivedReason: null,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    updatedBy: null,
    lastEditedAt: null,
    lastEditedBy: null,
    description: null,
    tags: [],
    lastViewedAt: null,
    lastReferencedBy: null,
    feedback: [],
    ...overrides,
    // Ensure usage is properly merged (must come after spread to override)
    usage: { ...defaultUsage, ...(overrides.usage || {}) },
  } as Artifact;
}

// ============================================================================
// RfpSection Factory
// ============================================================================

/**
 * Create a valid RfpSection with sensible defaults
 */
export function createRfpSection(overrides: DeepPartial<RfpSection> = {}): RfpSection {
  const now = new Date().toISOString();
  const sectionKey = (overrides.sectionKey ?? 'approach') as RfpSectionKey;

  const defaultGeneratedUsing: GeneratedUsing = {
    hasWinStrategy: false,
    winThemesApplied: [],
    proofItemsApplied: [],
  };

  return {
    id: uniqueId('section'),
    rfpId: overrides.rfpId ?? uniqueId('rfp'),
    sectionKey,
    title: overrides.title ?? getSectionDefaultTitle(sectionKey),
    status: (overrides.status ?? 'draft') as RfpSectionStatus,
    contentWorking: overrides.contentWorking ?? null,
    contentApproved: overrides.contentApproved ?? null,
    previousContent: overrides.previousContent ?? null,
    sourceType: (overrides.sourceType ?? null) as RfpSectionSourceType | null,
    generatedUsing: overrides.generatedUsing
      ? { ...defaultGeneratedUsing, ...overrides.generatedUsing }
      : null,
    needsReview: overrides.needsReview ?? false,
    lastGeneratedAt: overrides.lastGeneratedAt ?? null,
    isStale: overrides.isStale ?? false,
    staleReason: overrides.staleReason ?? null,
    reviewNotes: overrides.reviewNotes ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  } as RfpSection;
}

function getSectionDefaultTitle(sectionKey: RfpSectionKey): string {
  const titles: Record<RfpSectionKey, string> = {
    agency_overview: 'Agency Overview',
    approach: 'Our Approach',
    team: 'Proposed Team',
    work_samples: 'Work Samples',
    plan_timeline: 'Plan & Timeline',
    pricing: 'Investment',
    references: 'References',
  };
  return titles[sectionKey] ?? 'Section';
}

// ============================================================================
// RfpWinStrategy Factory
// ============================================================================

/**
 * Create a valid RfpWinStrategy with sensible defaults
 */
export function createRfpWinStrategy(overrides: DeepPartial<RfpWinStrategy> = {}): RfpWinStrategy {
  return {
    evaluationCriteria: overrides.evaluationCriteria ?? [],
    winThemes: overrides.winThemes ?? [],
    proofPlan: overrides.proofPlan ?? [],
    competitiveAssumptions: overrides.competitiveAssumptions ?? [],
    landmines: overrides.landmines ?? [],
    locked: overrides.locked ?? false,
    lockedBy: overrides.lockedBy,
    lockedAt: overrides.lockedAt,
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt,
  } as RfpWinStrategy;
}

/**
 * Create a valid RfpEvaluationCriterion
 */
export function createEvaluationCriterion(
  overrides: Partial<RfpEvaluationCriterion> = {}
): RfpEvaluationCriterion {
  return {
    label: overrides.label ?? 'Evaluation Criterion',
    weight: overrides.weight,
    guidance: overrides.guidance,
    primarySections: overrides.primarySections,
    alignmentScore: overrides.alignmentScore,
    alignmentRationale: overrides.alignmentRationale,
  };
}

// ============================================================================
// StrategyHealth Factory
// ============================================================================

/**
 * Create a valid StrategyHealth with sensible defaults
 */
export function createStrategyHealth(overrides: Partial<StrategyHealth> = {}): StrategyHealth {
  return {
    isDefined: overrides.isDefined ?? true,
    isLocked: overrides.isLocked ?? false,
    completenessScore: overrides.completenessScore ?? 50,
    issues: overrides.issues ?? [],
    suggestions: overrides.suggestions ?? [],
  };
}

// ============================================================================
// BidRisk Factory
// ============================================================================

/** Valid BidRisk category values */
export type BidRiskCategory = 'strategy' | 'firm_brain' | 'coverage' | 'proof' | 'persona';

/** Valid BidRisk severity values */
export type BidRiskSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Create a valid BidRisk with sensible defaults
 */
export function createBidRisk(overrides: Partial<BidRisk> = {}): BidRisk {
  return {
    category: overrides.category ?? 'coverage',
    severity: overrides.severity ?? 'medium',
    description: overrides.description ?? 'Test risk description',
    mitigation: overrides.mitigation,
  };
}

// ============================================================================
// FirmBrainReadiness Factory
// ============================================================================

function createComponentScore(overrides: Partial<ComponentScore> = {}): ComponentScore {
  return {
    score: overrides.score ?? 50,
    weight: overrides.weight ?? 0.15,
    status: overrides.status ?? 'good',
    issues: overrides.issues ?? [],
    count: overrides.count,
    sufficient: overrides.sufficient ?? true,
  };
}

/**
 * Override type for FirmBrainReadiness (avoids DeepPartial issues with arrays)
 */
type FirmBrainReadinessOverrides = {
  score?: number;
  missing?: string[];
  weak?: string[];
  summary?: string;
  components?: {
    agencyProfile?: Partial<ComponentScore>;
    teamMembers?: Partial<ComponentScore>;
    caseStudies?: Partial<ComponentScore>;
    references?: Partial<ComponentScore>;
    pricingTemplates?: Partial<ComponentScore>;
    planTemplates?: Partial<ComponentScore>;
  };
  recommendGeneration?: boolean;
  qualityWarnings?: string[];
};

/**
 * Create a valid FirmBrainReadiness with sensible defaults
 */
export function createFirmBrainReadiness(
  overrides: FirmBrainReadinessOverrides = {}
): FirmBrainReadiness {
  const score = overrides.score ?? 70;

  return {
    score,
    missing: overrides.missing ?? [],
    weak: overrides.weak ?? [],
    summary: overrides.summary ?? `Test summary with score ${score}`,
    components: {
      agencyProfile: createComponentScore({ weight: 0.25, ...overrides.components?.agencyProfile }),
      teamMembers: createComponentScore({ weight: 0.20, ...overrides.components?.teamMembers }),
      caseStudies: createComponentScore({ weight: 0.20, ...overrides.components?.caseStudies }),
      references: createComponentScore({ weight: 0.15, ...overrides.components?.references }),
      pricingTemplates: createComponentScore({ weight: 0.10, ...overrides.components?.pricingTemplates }),
      planTemplates: createComponentScore({ weight: 0.10, ...overrides.components?.planTemplates }),
    },
    recommendGeneration: overrides.recommendGeneration ?? (score >= 40),
    qualityWarnings: overrides.qualityWarnings ?? [],
  };
}

// ============================================================================
// CompanyRecord Factory
// ============================================================================

/**
 * Create a valid CompanyRecord with sensible defaults
 */
export function makeCompanyRecord(overrides: Partial<CompanyRecord> = {}): CompanyRecord {
  const id = overrides.id ?? uniqueId('rec');
  const domain = overrides.domain ?? 'example.com';
  const mediaProgramStatus = overrides.mediaProgramStatus ?? 'none';

  return {
    id,
    companyId: overrides.companyId ?? id,
    name: overrides.name ?? 'Test Company',
    domain,
    website: overrides.website ?? `https://${domain}`,
    industry: overrides.industry,
    companyType: overrides.companyType,
    stage: overrides.stage ?? 'Prospect',
    tier: overrides.tier,
    sizeBand: overrides.sizeBand,
    region: overrides.region,
    owner: overrides.owner,
    tags: overrides.tags ?? [],
    source: overrides.source,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
    mediaProgramStatus,
    hasMediaProgram: overrides.hasMediaProgram ?? (mediaProgramStatus === 'active'),
  };
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
  Artifact,
  ArtifactType,
  ArtifactStatus,
  ArtifactSource,
  ArtifactUsage,
  RfpSection,
  RfpSectionKey,
  RfpSectionStatus,
  RfpWinStrategy,
  StrategyHealth,
  BidRisk,
  FirmBrainReadiness,
  CompanyRecord,
};
