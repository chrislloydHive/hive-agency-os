// lib/diagnostics/contracts/labOutput.ts
// Universal output contract for all Labs and GAP tools
//
// RULE: Context importers MUST read from findings only.
// dimensions/summaries are UI-only and never imported to context.

// ============================================================================
// Lab Keys
// ============================================================================

export type LabKey =
  | 'brand_lab'
  | 'website_lab'
  | 'seo_lab'
  | 'content_lab'
  | 'demand_lab'
  | 'ops_lab'
  | 'audience_lab'
  | 'media_lab'
  | 'competition_lab'
  | 'gap_ia'
  | 'gap_full'
  | 'gap_heavy';

// ============================================================================
// Issue Severity
// ============================================================================

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// Lab Issue
// ============================================================================

export interface LabIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  description: string;
  evidence?: string[];
  domain?: string;
  recommendedAction?: string;
}

// ============================================================================
// Lab Output Meta
// ============================================================================

export interface LabOutputMeta {
  labKey: LabKey;
  runId: string;
  createdAt: string;
  model?: string;
  version: string;
  inputsUsed: string[]; // snapshot, gsc, ga4, etc.
  companyId?: string;
  durationMs?: number;
}

// ============================================================================
// Universal Lab Output Contract
// ============================================================================

export interface LabOutput<TFindings = Record<string, unknown>> {
  meta: LabOutputMeta;
  findings: TFindings; // CANONICAL - imported to Context Graph
  scores?: Record<string, number>;
  issues?: LabIssue[];
  evidence?: Record<string, unknown>; // raw detections
  dimensions?: unknown[]; // UI-only, never imported to context
}

// ============================================================================
// Type Guards
// ============================================================================

export function isLabOutput(value: unknown): value is LabOutput {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.meta === 'object' &&
    obj.meta !== null &&
    typeof (obj.meta as Record<string, unknown>).labKey === 'string' &&
    typeof (obj.meta as Record<string, unknown>).runId === 'string' &&
    typeof obj.findings === 'object'
  );
}

export function hasFindings<T>(output: LabOutput<T>): boolean {
  if (!output.findings) return false;
  if (typeof output.findings !== 'object') return false;
  return Object.keys(output.findings).length > 0;
}

// ============================================================================
// Lab-Specific Findings Types
// ============================================================================

// Brand Lab Findings
export interface BrandLabFindings {
  brandScore?: number;
  brandSummary?: string;
  brandIdentity?: {
    mission?: string;
    vision?: string;
    values?: string[];
    personality?: string;
    voiceTone?: string;
  };
  brandPositioning?: {
    targetAudience?: string;
    uniqueValueProp?: string;
    competitiveAdvantage?: string;
    marketPosition?: string;
  };
  brandAssets?: {
    logoAssessment?: string;
    colorPalette?: string[];
    typographyNotes?: string;
  };
  brandGaps?: string[];
  brandStrengths?: string[];
}

// Website Lab Findings
export interface WebsiteLabFindings {
  websiteScore?: number;
  websiteSummary?: string;
  criticalIssues?: string[];
  quickWins?: string[];
  uxAssessment?: {
    navigation?: string;
    pageSpeed?: string;
    mobileExperience?: string;
    accessibility?: string;
  };
  conversionPaths?: {
    primaryCta?: string;
    funnelStages?: string[];
    frictionPoints?: string[];
  };
  trackingStack?: {
    analytics?: string[];
    tagManager?: string;
    pixels?: string[];
    summary?: string;
  };
  technicalHealth?: {
    sslStatus?: string;
    coreWebVitals?: Record<string, number>;
    crawlability?: string;
  };
}

// SEO Lab Findings
export interface SeoLabFindings {
  seoScore?: number;
  seoSummary?: string;
  technicalIssues?: string[];
  keywordOpportunities?: Array<{
    keyword: string;
    volume?: number;
    difficulty?: number;
    intent?: string;
  }>;
  onPageAssessment?: {
    titleTagQuality?: string;
    metaDescriptions?: string;
    headingStructure?: string;
    internalLinking?: string;
  };
  contentGaps?: string[];
  backlinks?: {
    domainAuthority?: number;
    totalBacklinks?: number;
    topReferrers?: string[];
  };
  localSeo?: {
    gmbStatus?: string;
    localCitations?: string;
    reviewProfile?: string;
  };
}

// Content Lab Findings
export interface ContentLabFindings {
  contentScore?: number;
  contentSummary?: string;
  contentPillars?: string[];
  contentGaps?: string[];
  contentStrengths?: string[];
  contentCalendar?: {
    frequency?: string;
    channels?: string[];
    themes?: string[];
  };
  topPerformingContent?: Array<{
    title: string;
    url?: string;
    metrics?: Record<string, number>;
  }>;
  contentRecommendations?: string[];
}

// Demand Lab Findings
export interface DemandLabFindings {
  demandScore?: number;
  demandSummary?: string;
  audienceDemandStates?: string[];
  buyerJourney?: {
    awareness?: string;
    consideration?: string;
    decision?: string;
    retention?: string;
  };
  channelPerformance?: Record<string, {
    score?: number;
    summary?: string;
    recommendations?: string[];
  }>;
  conversionMetrics?: {
    overallRate?: number;
    byChannel?: Record<string, number>;
    bottlenecks?: string[];
  };
}

// Ops Lab Findings
export interface OpsLabFindings {
  opsScore?: number;
  opsSummary?: string;
  teamStructure?: {
    size?: number;
    roles?: string[];
    gaps?: string[];
  };
  processMaturity?: {
    level?: string;
    strengths?: string[];
    weaknesses?: string[];
  };
  toolStack?: {
    marketing?: string[];
    sales?: string[];
    analytics?: string[];
    gaps?: string[];
  };
  operationalConstraints?: string[];
  capacityAssessment?: string;
}

// Audience Lab Findings
export interface AudienceLabFindings {
  audienceScore?: number;
  audienceSummary?: string;
  primaryAudience?: {
    description?: string;
    demographics?: Record<string, string>;
    psychographics?: string[];
    painPoints?: string[];
    goals?: string[];
  };
  secondaryAudiences?: Array<{
    name: string;
    description?: string;
    size?: string;
  }>;
  buyerPersonas?: Array<{
    name: string;
    role?: string;
    goals?: string[];
    challenges?: string[];
    decisionFactors?: string[];
  }>;
  audienceInsights?: string[];
}

// Media Lab Findings
export interface MediaLabFindings {
  mediaScore?: number;
  mediaSummary?: string;
  channelMix?: Record<string, {
    spend?: number;
    performance?: string;
    recommendations?: string[];
  }>;
  creativeAssessment?: {
    formats?: string[];
    messaging?: string;
    recommendations?: string[];
  };
  mediaEfficiency?: {
    cpa?: number;
    roas?: number;
    recommendations?: string[];
  };
}

// Competition Lab Findings
export interface CompetitionLabFindings {
  competitiveScore?: number;
  competitiveSummary?: string;
  competitors?: Array<{
    name: string;
    website?: string;
    strengths?: string[];
    weaknesses?: string[];
    marketPosition?: string;
  }>;
  competitiveLandscape?: string;
  differentiators?: string[];
  threats?: string[];
  opportunities?: string[];
}

// GAP Findings (orchestration artifacts only)
export interface GapFindings {
  executiveSummary?: string;
  blockers?: Array<{
    id: string;
    domain: string;
    description: string;
    severity: IssueSeverity;
  }>;
  unknowns?: Array<{
    id: string;
    domain: string;
    question: string;
  }>;
  strategicPriorities?: string[];
  recommendedLabs?: LabKey[];
}

// ============================================================================
// Typed Lab Outputs
// ============================================================================

export type BrandLabOutput = LabOutput<BrandLabFindings>;
export type WebsiteLabOutput = LabOutput<WebsiteLabFindings>;
export type SeoLabOutput = LabOutput<SeoLabFindings>;
export type ContentLabOutput = LabOutput<ContentLabFindings>;
export type DemandLabOutput = LabOutput<DemandLabFindings>;
export type OpsLabOutput = LabOutput<OpsLabFindings>;
export type AudienceLabOutput = LabOutput<AudienceLabFindings>;
export type MediaLabOutput = LabOutput<MediaLabFindings>;
export type CompetitionLabOutput = LabOutput<CompetitionLabFindings>;
export type GapOutput = LabOutput<GapFindings>;

// ============================================================================
// Factory Functions
// ============================================================================

export function createLabOutput<T>(
  labKey: LabKey,
  runId: string,
  findings: T,
  options?: {
    model?: string;
    version?: string;
    inputsUsed?: string[];
    scores?: Record<string, number>;
    issues?: LabIssue[];
    evidence?: Record<string, unknown>;
    companyId?: string;
    durationMs?: number;
  }
): LabOutput<T> {
  return {
    meta: {
      labKey,
      runId,
      createdAt: new Date().toISOString(),
      model: options?.model,
      version: options?.version || '1.0.0',
      inputsUsed: options?.inputsUsed || [],
      companyId: options?.companyId,
      durationMs: options?.durationMs,
    },
    findings,
    scores: options?.scores,
    issues: options?.issues,
  };
}

export function createEmptyLabOutput(labKey: LabKey, runId: string): LabOutput {
  return createLabOutput(labKey, runId, {});
}
