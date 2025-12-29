// lib/os/ai/firmBrainReadiness.ts
// Firm Brain Readiness Scoring
//
// Calculates a detailed readiness score for RFP generation based on
// the completeness and quality of Firm Brain data.
//
// This is used to:
// 1. Surface warnings (non-blocking) in the RFP Create modal
// 2. Show readiness indicators in the RFP Builder
// 3. Provide context for AI generation quality expectations

import type {
  FirmBrainSnapshot,
  AgencyProfile,
  TeamMember,
  CaseStudy,
  Reference,
  PricingTemplate,
  PlanTemplate,
} from '@/lib/types/firmBrain';

// ============================================================================
// Types
// ============================================================================

/**
 * Detailed readiness assessment for Firm Brain
 */
export interface FirmBrainReadiness {
  /** Overall readiness score 0-100 */
  score: number;
  /** Components completely missing */
  missing: string[];
  /** Components present but weak/incomplete */
  weak: string[];
  /** Human-readable quality summary */
  summary: string;
  /** Per-component breakdown */
  components: FirmBrainComponentReadiness;
  /** Whether RFP generation is advisable */
  recommendGeneration: boolean;
  /** Specific warnings for AI generation quality */
  qualityWarnings: string[];
}

/**
 * Per-component readiness details
 */
export interface FirmBrainComponentReadiness {
  agencyProfile: ComponentScore;
  teamMembers: ComponentScore;
  caseStudies: ComponentScore;
  references: ComponentScore;
  pricingTemplates: ComponentScore;
  planTemplates: ComponentScore;
}

/**
 * Score for a single component
 */
export interface ComponentScore {
  /** Score 0-100 for this component */
  score: number;
  /** Weight in overall score (0-1) */
  weight: number;
  /** Status: missing | weak | good | excellent */
  status: 'missing' | 'weak' | 'good' | 'excellent';
  /** Specific issues with this component */
  issues: string[];
  /** Count of items (for list-based components) */
  count?: number;
  /** Whether this component has enough data for quality output */
  sufficient: boolean;
}

// ============================================================================
// Weights and Thresholds
// ============================================================================

/**
 * Weight of each component in the overall score
 */
const COMPONENT_WEIGHTS = {
  agencyProfile: 0.25,  // Core identity - most important
  teamMembers: 0.20,    // Who's on the team
  caseStudies: 0.20,    // Proof of work
  references: 0.15,     // Social proof
  pricingTemplates: 0.10, // Pricing structure
  planTemplates: 0.10,  // Project planning
};

/**
 * Thresholds for component status
 */
const THRESHOLDS = {
  agencyProfile: {
    // Fields that should be filled for good profile
    requiredFields: ['name', 'oneLiner', 'overviewLong'] as const,
    optionalFields: ['differentiators', 'services', 'industries', 'approachSummary'] as const,
    goodFieldCount: 5,
    excellentFieldCount: 7,
  },
  teamMembers: {
    weak: 1,
    good: 3,
    excellent: 5,
    // A good team member has bio and strengths
    qualityFields: ['bio', 'strengths', 'functions'] as const,
  },
  caseStudies: {
    weak: 1,
    good: 3,
    excellent: 5,
    // A good case study has problem, approach, outcome
    qualityFields: ['problem', 'approach', 'outcome', 'metrics'] as const,
  },
  references: {
    weak: 1,
    good: 2,
    excellent: 4,
    // Must be confirmed to count
    requireConfirmed: true,
  },
  pricingTemplates: {
    weak: 1,
    good: 1,
    excellent: 2,
    // Good template has a detailed description with key sections
    minDescriptionLength: 100, // At least 100 chars for quality
  },
  planTemplates: {
    weak: 1,
    good: 1,
    excellent: 2,
    // Good template has phases
    qualityFields: ['phases'] as const,
  },
};

// ============================================================================
// Component Scoring Functions
// ============================================================================

/**
 * Score the agency profile
 */
function scoreAgencyProfile(profile: AgencyProfile | null): ComponentScore {
  if (!profile || !profile.name) {
    return {
      score: 0,
      weight: COMPONENT_WEIGHTS.agencyProfile,
      status: 'missing',
      issues: ['No agency profile configured'],
      sufficient: false,
    };
  }

  const issues: string[] = [];
  let filledFields = 0;

  // Check required fields
  if (profile.name) filledFields++;
  else issues.push('Missing agency name');

  if (profile.oneLiner) filledFields++;
  else issues.push('Missing one-liner tagline');

  if (profile.overviewLong) filledFields++;
  else issues.push('Missing detailed overview');

  // Check optional fields
  if (profile.differentiators.length > 0) filledFields++;
  else issues.push('No differentiators listed');

  if (profile.services.length > 0) filledFields++;
  else issues.push('No services listed');

  if (profile.industries.length > 0) filledFields++;
  else issues.push('No industries listed');

  if (profile.approachSummary) filledFields++;
  else issues.push('No approach summary');

  if (profile.collaborationModel) filledFields++;

  // Calculate score
  const totalPossible = 8;
  const score = Math.round((filledFields / totalPossible) * 100);

  // Determine status
  let status: ComponentScore['status'];
  if (filledFields === 0) status = 'missing';
  else if (filledFields < THRESHOLDS.agencyProfile.goodFieldCount) status = 'weak';
  else if (filledFields < THRESHOLDS.agencyProfile.excellentFieldCount) status = 'good';
  else status = 'excellent';

  return {
    score,
    weight: COMPONENT_WEIGHTS.agencyProfile,
    status,
    issues: status === 'excellent' ? [] : issues,
    sufficient: filledFields >= 3, // Name + one-liner + overview minimum
  };
}

/**
 * Score team members
 */
function scoreTeamMembers(members: TeamMember[]): ComponentScore {
  if (members.length === 0) {
    return {
      score: 0,
      weight: COMPONENT_WEIGHTS.teamMembers,
      status: 'missing',
      issues: ['No team members added'],
      count: 0,
      sufficient: false,
    };
  }

  const issues: string[] = [];
  const thresholds = THRESHOLDS.teamMembers;

  // Count quality members (have bio and strengths)
  const qualityMembers = members.filter(m =>
    m.bio && m.bio.length > 10 && m.strengths.length > 0
  );

  // Check availability
  const availableMembers = members.filter(m =>
    m.availabilityStatus === 'available' || m.availabilityStatus === 'limited'
  );

  if (availableMembers.length === 0) {
    issues.push('No available team members');
  }

  if (qualityMembers.length < members.length) {
    issues.push(`${members.length - qualityMembers.length} team member(s) missing bio or strengths`);
  }

  // Calculate score based on quantity and quality
  let score = 0;
  if (members.length >= thresholds.excellent) score = 80;
  else if (members.length >= thresholds.good) score = 60;
  else if (members.length >= thresholds.weak) score = 40;

  // Bonus for quality
  const qualityRatio = qualityMembers.length / members.length;
  score += Math.round(qualityRatio * 20);

  // Determine status
  let status: ComponentScore['status'];
  if (members.length === 0) status = 'missing';
  else if (members.length < thresholds.good || qualityRatio < 0.5) status = 'weak';
  else if (members.length >= thresholds.excellent && qualityRatio >= 0.8) status = 'excellent';
  else status = 'good';

  return {
    score: Math.min(score, 100),
    weight: COMPONENT_WEIGHTS.teamMembers,
    status,
    issues: status === 'excellent' ? [] : issues,
    count: members.length,
    sufficient: members.length >= 1 && qualityMembers.length >= 1,
  };
}

/**
 * Score case studies
 */
function scoreCaseStudies(studies: CaseStudy[]): ComponentScore {
  if (studies.length === 0) {
    return {
      score: 0,
      weight: COMPONENT_WEIGHTS.caseStudies,
      status: 'missing',
      issues: ['No case studies added - responses may be generic'],
      count: 0,
      sufficient: false,
    };
  }

  const issues: string[] = [];
  const thresholds = THRESHOLDS.caseStudies;

  // Count quality case studies (have problem, approach, outcome)
  const qualityStudies = studies.filter(s =>
    s.problem && s.approach && s.outcome
  );

  // Count case studies with metrics (handle both array and object formats)
  const studiesWithMetrics = studies.filter(s => {
    if (!s.metrics) return false;
    if (Array.isArray(s.metrics)) return s.metrics.length > 0;
    return Object.keys(s.metrics).length > 0;
  });

  // Check permission levels
  const publicStudies = studies.filter(s => s.permissionLevel === 'public');

  if (qualityStudies.length < studies.length) {
    issues.push(`${studies.length - qualityStudies.length} case study(s) missing problem/approach/outcome`);
  }

  if (studiesWithMetrics.length === 0) {
    issues.push('No case studies have metrics - outcomes may lack specificity');
  }

  if (publicStudies.length === 0) {
    issues.push('No public case studies - may limit what can be shared');
  }

  // Calculate score
  let score = 0;
  if (studies.length >= thresholds.excellent) score = 80;
  else if (studies.length >= thresholds.good) score = 60;
  else if (studies.length >= thresholds.weak) score = 40;

  // Bonus for quality
  const qualityRatio = qualityStudies.length / studies.length;
  score += Math.round(qualityRatio * 20);

  // Determine status
  let status: ComponentScore['status'];
  if (studies.length === 0) status = 'missing';
  else if (studies.length < thresholds.good || qualityRatio < 0.5) status = 'weak';
  else if (studies.length >= thresholds.excellent && qualityRatio >= 0.8) status = 'excellent';
  else status = 'good';

  return {
    score: Math.min(score, 100),
    weight: COMPONENT_WEIGHTS.caseStudies,
    status,
    issues: status === 'excellent' ? [] : issues,
    count: studies.length,
    sufficient: studies.length >= 1,
  };
}

/**
 * Score references
 */
function scoreReferences(refs: Reference[]): ComponentScore {
  // Only count confirmed references
  const confirmedRefs = refs.filter(r => r.permissionStatus === 'confirmed');

  if (confirmedRefs.length === 0) {
    const issues = refs.length === 0
      ? ['No references added - credibility sections may be weaker']
      : [`${refs.length} reference(s) pending confirmation`];

    return {
      score: 0,
      weight: COMPONENT_WEIGHTS.references,
      status: 'missing',
      issues,
      count: 0,
      sufficient: false,
    };
  }

  const issues: string[] = [];
  const thresholds = THRESHOLDS.references;

  // Check for contact info completeness
  const completeRefs = confirmedRefs.filter(r => r.email || r.phone);
  if (completeRefs.length < confirmedRefs.length) {
    issues.push(`${confirmedRefs.length - completeRefs.length} reference(s) missing contact info`);
  }

  // Pending refs that could be upgraded
  const pendingRefs = refs.filter(r => r.permissionStatus === 'pending');
  if (pendingRefs.length > 0) {
    issues.push(`${pendingRefs.length} additional reference(s) pending confirmation`);
  }

  // Calculate score
  let score = 0;
  if (confirmedRefs.length >= thresholds.excellent) score = 100;
  else if (confirmedRefs.length >= thresholds.good) score = 75;
  else if (confirmedRefs.length >= thresholds.weak) score = 50;

  // Determine status
  let status: ComponentScore['status'];
  if (confirmedRefs.length === 0) status = 'missing';
  else if (confirmedRefs.length < thresholds.good) status = 'weak';
  else if (confirmedRefs.length >= thresholds.excellent) status = 'excellent';
  else status = 'good';

  return {
    score,
    weight: COMPONENT_WEIGHTS.references,
    status,
    issues: status === 'excellent' ? [] : issues,
    count: confirmedRefs.length,
    sufficient: confirmedRefs.length >= 1,
  };
}

/**
 * Score pricing templates
 */
function scorePricingTemplates(templates: PricingTemplate[]): ComponentScore {
  if (templates.length === 0) {
    return {
      score: 0,
      weight: COMPONENT_WEIGHTS.pricingTemplates,
      status: 'missing',
      issues: ['No pricing templates - pricing sections will use qualitative language'],
      count: 0,
      sufficient: false,
    };
  }

  const issues: string[] = [];
  const thresholds = THRESHOLDS.pricingTemplates;

  // Check quality of templates (good templates have detailed descriptions)
  const minDescLength = thresholds.minDescriptionLength ?? 100;
  const qualityTemplates = templates.filter(t =>
    t.description && t.description.length >= minDescLength
  );

  if (qualityTemplates.length < templates.length) {
    issues.push(`${templates.length - qualityTemplates.length} template(s) have minimal descriptions`);
  }

  // Calculate score
  let score = 0;
  if (templates.length >= thresholds.excellent) score = 80;
  else if (templates.length >= thresholds.good) score = 60;

  // Bonus for quality
  if (qualityTemplates.length > 0) {
    score += 20;
  }

  // Determine status
  let status: ComponentScore['status'];
  if (templates.length === 0) status = 'missing';
  else if (qualityTemplates.length === 0) status = 'weak';
  else if (templates.length >= thresholds.excellent && qualityTemplates.length > 0) status = 'excellent';
  else status = 'good';

  return {
    score: Math.min(score, 100),
    weight: COMPONENT_WEIGHTS.pricingTemplates,
    status,
    issues: status === 'excellent' ? [] : issues,
    count: templates.length,
    sufficient: templates.length >= 1,
  };
}

/**
 * Score plan templates
 */
function scorePlanTemplates(templates: PlanTemplate[]): ComponentScore {
  if (templates.length === 0) {
    return {
      score: 0,
      weight: COMPONENT_WEIGHTS.planTemplates,
      status: 'missing',
      issues: ['No plan templates - timeline sections will be generic'],
      count: 0,
      sufficient: false,
    };
  }

  const issues: string[] = [];
  const thresholds = THRESHOLDS.planTemplates;

  // Check quality of templates
  const qualityTemplates = templates.filter(t =>
    t.phases.length >= 2
  );

  if (qualityTemplates.length < templates.length) {
    issues.push(`${templates.length - qualityTemplates.length} template(s) need more phases`);
  }

  // Calculate score
  let score = 0;
  if (templates.length >= thresholds.excellent) score = 80;
  else if (templates.length >= thresholds.good) score = 60;

  // Bonus for quality
  if (qualityTemplates.length > 0) {
    score += 20;
  }

  // Determine status
  let status: ComponentScore['status'];
  if (templates.length === 0) status = 'missing';
  else if (qualityTemplates.length === 0) status = 'weak';
  else if (templates.length >= thresholds.excellent && qualityTemplates.length > 0) status = 'excellent';
  else status = 'good';

  return {
    score: Math.min(score, 100),
    weight: COMPONENT_WEIGHTS.planTemplates,
    status,
    issues: status === 'excellent' ? [] : issues,
    count: templates.length,
    sufficient: templates.length >= 1,
  };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Calculate comprehensive Firm Brain readiness for RFP generation
 *
 * @param snapshot - Current Firm Brain data snapshot
 * @returns Detailed readiness assessment
 */
export function calculateFirmBrainReadiness(snapshot: FirmBrainSnapshot): FirmBrainReadiness {
  // Score each component
  const components: FirmBrainComponentReadiness = {
    agencyProfile: scoreAgencyProfile(snapshot.agencyProfile),
    teamMembers: scoreTeamMembers(snapshot.teamMembers),
    caseStudies: scoreCaseStudies(snapshot.caseStudies),
    references: scoreReferences(snapshot.references),
    pricingTemplates: scorePricingTemplates(snapshot.pricingTemplates),
    planTemplates: scorePlanTemplates(snapshot.planTemplates),
  };

  // Calculate overall weighted score
  let weightedScore = 0;
  for (const [key, component] of Object.entries(components)) {
    weightedScore += component.score * component.weight;
  }
  const score = Math.round(weightedScore);

  // Collect missing and weak components
  const missing: string[] = [];
  const weak: string[] = [];

  if (components.agencyProfile.status === 'missing') missing.push('Agency Profile');
  else if (components.agencyProfile.status === 'weak') weak.push('Agency Profile');

  if (components.teamMembers.status === 'missing') missing.push('Team Members');
  else if (components.teamMembers.status === 'weak') weak.push('Team Members');

  if (components.caseStudies.status === 'missing') missing.push('Case Studies');
  else if (components.caseStudies.status === 'weak') weak.push('Case Studies');

  if (components.references.status === 'missing') missing.push('Confirmed References');
  else if (components.references.status === 'weak') weak.push('References');

  if (components.pricingTemplates.status === 'missing') missing.push('Pricing Templates');
  else if (components.pricingTemplates.status === 'weak') weak.push('Pricing Templates');

  if (components.planTemplates.status === 'missing') missing.push('Plan Templates');
  else if (components.planTemplates.status === 'weak') weak.push('Plan Templates');

  // Generate quality warnings based on what's missing/weak
  const qualityWarnings: string[] = [];

  if (!components.agencyProfile.sufficient) {
    qualityWarnings.push('Agency overview sections may lack specificity');
  }
  if (!components.teamMembers.sufficient) {
    qualityWarnings.push('Team sections will be generic without member profiles');
  }
  if (!components.caseStudies.sufficient) {
    qualityWarnings.push('Work samples section may lack concrete examples');
  }
  if (!components.references.sufficient) {
    qualityWarnings.push('References section will be minimal');
  }
  if (!components.pricingTemplates.sufficient) {
    qualityWarnings.push('Pricing will use qualitative language only');
  }
  if (!components.planTemplates.sufficient) {
    qualityWarnings.push('Timeline sections will be generic');
  }

  // Collect all issues
  const allIssues = [
    ...components.agencyProfile.issues,
    ...components.teamMembers.issues,
    ...components.caseStudies.issues,
    ...components.references.issues,
    ...components.pricingTemplates.issues,
    ...components.planTemplates.issues,
  ];

  // Generate summary
  let summary: string;
  if (score >= 80) {
    summary = 'Firm Brain is well-configured for high-quality RFP generation.';
  } else if (score >= 60) {
    summary = 'Firm Brain has good coverage. Some sections may be generic.';
  } else if (score >= 40) {
    summary = 'Firm Brain is partially configured. Consider adding more data for better results.';
  } else {
    summary = 'Firm Brain needs more data. AI responses will be limited.';
  }

  // Recommend generation if we have minimum requirements
  const recommendGeneration = components.agencyProfile.sufficient &&
    components.teamMembers.sufficient;

  return {
    score,
    missing,
    weak,
    summary,
    components,
    recommendGeneration,
    qualityWarnings,
  };
}

/**
 * Get a simple readiness label for UI display
 */
export function getReadinessLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Limited';
  return 'Not Ready';
}

/**
 * Get color class for readiness score
 */
export function getReadinessColorClass(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

/**
 * Get background color class for readiness score
 */
export function getReadinessBgClass(score: number): string {
  if (score >= 80) return 'bg-emerald-500/10';
  if (score >= 60) return 'bg-blue-500/10';
  if (score >= 40) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}
