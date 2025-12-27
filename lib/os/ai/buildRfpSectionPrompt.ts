// lib/os/ai/buildRfpSectionPrompt.ts
// RFP Section Prompt Builder
//
// Assembles Firm Brain data, company context, and section contracts into AI prompts
// for generating RFP section content.
//
// Pattern: Similar to buildStrategyFieldPrompt but for RFP sections.

import type { RfpSectionKey, ParsedRfpRequirements } from '@/lib/types/rfp';
import type { RfpWinStrategy } from '@/lib/types/rfpWinStrategy';
import {
  type EvaluatorPersonaType,
  type RfpPersonaSettings,
  EVALUATOR_PERSONAS,
  getPersonaForSection,
} from '@/lib/types/rfpEvaluatorPersona';
import type {
  FirmBrainSnapshot,
  AgencyProfile,
  TeamMember,
  CaseStudy,
  Reference,
  PricingTemplate,
  PlanTemplate,
} from '@/lib/types/firmBrain';
import {
  RFP_SECTION_CONTRACTS,
  validateSectionInputs,
  type RfpSectionContract,
  type PrimaryInputType,
  type SecondaryInputType,
} from './rfpSectionContracts';

// ============================================================================
// Types
// ============================================================================

/**
 * Company context for RFP generation (from Context V4 + Strategy)
 */
export interface CompanyContext {
  companyName: string;
  industry?: string;
  businessModel?: string;
  icpDescription?: string;
  valueProposition?: string;
  positioning?: string;
  goalStatement?: string;
}

/**
 * RFP-specific context for section generation
 */
export interface RfpContext {
  title: string;
  scopeSummary?: string;
  requirementsChecklist?: Array<{ requirement: string; category?: string }>;
  dueDate?: string;
  selectedPath?: 'strategy' | 'project' | 'custom';
  /** V2.5: Parsed requirements from RFP source text */
  parsedRequirements?: ParsedRfpRequirements | null;
  /** V3: Win strategy for alignment-driven generation */
  winStrategy?: RfpWinStrategy | null;
  /** V4: Persona settings for evaluator-aware framing */
  personaSettings?: RfpPersonaSettings | null;
}

/**
 * Bound Firm Brain resources for this RFP
 */
export interface BoundResources {
  teamMembers: TeamMember[];
  caseStudies: CaseStudy[];
  references: Reference[];
  pricingTemplate?: PricingTemplate;
  planTemplate?: PlanTemplate;
}

/**
 * Full input for prompt building
 */
export interface BuildRfpPromptArgs {
  sectionKey: RfpSectionKey;
  firmBrain: FirmBrainSnapshot;
  boundResources: BoundResources;
  companyContext: CompanyContext;
  rfpContext: RfpContext;
  /** Current section content (for improvement) */
  currentContent?: string;
}

/**
 * Metadata about what inputs were used
 */
export interface RfpPromptGeneratedUsing {
  primaryInputsUsed: PrimaryInputType[];
  primaryInputsMissing: PrimaryInputType[];
  secondaryInputsUsed: SecondaryInputType[];
  teamMemberIds: string[];
  caseStudyIds: string[];
  referenceIds: string[];
  pricingTemplateId?: string;
  planTemplateId?: string;
  hasAgencyProfile: boolean;
  hasScopeSummary: boolean;
  hasCompanyContext: boolean;
  hasStrategyFrame: boolean;
  /** V3: Win strategy usage */
  hasWinStrategy: boolean;
  winThemesApplied: string[];
  proofItemsApplied: string[];
  /** V4: Persona settings usage */
  hasPersonaSettings: boolean;
  primaryPersona?: EvaluatorPersonaType;
  secondaryPersonas?: EvaluatorPersonaType[];
  canGenerate: boolean;
  blockingReason?: string;
}

/**
 * Result of prompt building
 */
export interface BuildRfpPromptResult {
  systemPrompt: string;
  userPrompt: string;
  generatedUsing: RfpPromptGeneratedUsing;
  contract: RfpSectionContract;
  validationWarnings: string[];
}

// ============================================================================
// Core Rules
// ============================================================================

/**
 * NO NEW CLAIMS rule for RFP sections
 */
export const RFP_NO_NEW_CLAIMS_RULE = `CRITICAL - GROUNDING RULE:
- You may ONLY reference information explicitly provided in the inputs below
- Do NOT invent clients, metrics, team members, or capabilities not listed
- Do NOT claim awards, certifications, or partnerships not in the agency profile
- If information is missing, acknowledge gaps honestly or use placeholders
- Never hallucinate specific numbers, percentages, or statistics`;

/**
 * RFP tone guidance
 */
export const RFP_TONE_GUIDANCE = `TONE & STYLE:
- Professional yet personable - not stiff corporate speak
- Confident but not boastful
- Specific and concrete - avoid vague marketing language
- Client-focused - emphasize understanding of their needs
- Honest about what's included and excluded`;

/**
 * V2: Fallback content rules for missing data
 * These ensure AI output degrades gracefully instead of hallucinating
 */
export const RFP_FALLBACK_RULES = `FALLBACK RULES - WHEN DATA IS MISSING:
If no case studies provided:
- Describe your general approach and methodology instead
- Use phrases like "In similar engagements..." without naming specific clients
- Focus on the process and principles you would apply
- Do NOT fabricate client names, project details, or metrics

If no references provided:
- Omit testimonial-style language entirely
- Focus on your capabilities and approach
- Indicate references are available upon request
- Do NOT invent quotes or endorsements

If no pricing template provided:
- Use qualitative language about investment approach
- Describe value-based or scope-based pricing philosophy
- Avoid specific numbers or ranges unless provided
- Indicate detailed pricing will be tailored to scope

If no plan template provided:
- Describe your general project methodology
- Use phase-based language without specific durations
- Focus on key milestones and deliverables
- Indicate timeline will be customized to project needs

CRITICAL - NEVER FABRICATE:
- Specific client names
- Exact metrics or percentages
- Industry awards or certifications
- Team member credentials not listed
- Partnership claims not documented
- Testimonial quotes`;

/**
 * V2: Get fallback guidance based on what's missing
 */
export function getFallbackGuidance(
  hasCaseStudies: boolean,
  hasReferences: boolean,
  hasPricing: boolean,
  hasPlans: boolean
): string[] {
  const guidance: string[] = [];

  if (!hasCaseStudies) {
    guidance.push('No case studies: Focus on methodology and approach without naming specific past clients');
  }
  if (!hasReferences) {
    guidance.push('No references: Omit testimonials, indicate references available upon request');
  }
  if (!hasPricing) {
    guidance.push('No pricing template: Use qualitative investment language, avoid specific numbers');
  }
  if (!hasPlans) {
    guidance.push('No plan template: Describe general phases without specific timelines');
  }

  return guidance;
}

// ============================================================================
// V2.5: Requirements Integration
// ============================================================================

/**
 * Section-specific requirements that should influence generation
 */
const SECTION_REQUIREMENTS_MAP: Record<RfpSectionKey, {
  relevantCriteria: string[];
  relevantQuestionKeywords: string[];
}> = {
  agency_overview: {
    relevantCriteria: ['experience', 'qualifications', 'capability', 'background', 'history', 'size', 'stability'],
    relevantQuestionKeywords: ['company', 'agency', 'firm', 'organization', 'background', 'history'],
  },
  approach: {
    relevantCriteria: ['methodology', 'approach', 'process', 'strategy', 'innovation', 'quality'],
    relevantQuestionKeywords: ['approach', 'methodology', 'how will', 'process', 'strategy'],
  },
  team: {
    relevantCriteria: ['team', 'personnel', 'staff', 'expertise', 'qualifications', 'experience'],
    relevantQuestionKeywords: ['team', 'staff', 'personnel', 'who will', 'roles', 'qualifications'],
  },
  work_samples: {
    relevantCriteria: ['experience', 'past performance', 'track record', 'similar projects', 'portfolio'],
    relevantQuestionKeywords: ['experience', 'previous', 'similar', 'examples', 'case study'],
  },
  plan_timeline: {
    relevantCriteria: ['timeline', 'schedule', 'milestones', 'deliverables', 'project management'],
    relevantQuestionKeywords: ['timeline', 'schedule', 'when', 'milestones', 'deliverables', 'phases'],
  },
  pricing: {
    relevantCriteria: ['cost', 'price', 'value', 'budget', 'investment', 'fees'],
    relevantQuestionKeywords: ['cost', 'price', 'budget', 'fees', 'investment', 'payment'],
  },
  references: {
    relevantCriteria: ['references', 'reputation', 'client satisfaction'],
    relevantQuestionKeywords: ['references', 'clients', 'testimonials'],
  },
};

/**
 * Get requirements guidance specific to a section
 */
function getSectionRequirementsGuidance(
  sectionKey: RfpSectionKey,
  requirements: ParsedRfpRequirements
): string | null {
  const mapping = SECTION_REQUIREMENTS_MAP[sectionKey];
  if (!mapping) return null;

  const lines: string[] = [];

  // Find relevant evaluation criteria
  const relevantCriteria = requirements.evaluationCriteria.filter((criterion) => {
    const lowerCriterion = criterion.toLowerCase();
    return mapping.relevantCriteria.some((keyword) => lowerCriterion.includes(keyword));
  });

  if (relevantCriteria.length > 0) {
    lines.push('## EVALUATION CRITERIA TO ADDRESS');
    lines.push('The proposal will be evaluated on these criteria relevant to this section:');
    for (const criterion of relevantCriteria) {
      lines.push(`- ${criterion}`);
    }
    lines.push('');
    lines.push('IMPORTANT: Ensure your content directly addresses these evaluation points.');
  }

  // Find relevant must-answer questions
  const relevantQuestions = requirements.mustAnswerQuestions.filter((question) => {
    const lowerQuestion = question.toLowerCase();
    return mapping.relevantQuestionKeywords.some((keyword) => lowerQuestion.includes(keyword));
  });

  if (relevantQuestions.length > 0) {
    lines.push('');
    lines.push('## QUESTIONS TO ANSWER');
    lines.push('This section should address these specific questions from the RFP:');
    for (const question of relevantQuestions) {
      lines.push(`- ${question}`);
    }
  }

  // Include relevant compliance items
  const relevantCompliance = requirements.complianceChecklist.filter((item) => {
    const lowerItem = item.toLowerCase();
    return mapping.relevantCriteria.some((keyword) => lowerItem.includes(keyword));
  });

  if (relevantCompliance.length > 0) {
    lines.push('');
    lines.push('## COMPLIANCE REQUIREMENTS');
    lines.push('Ensure compliance with these requirements:');
    for (const item of relevantCompliance) {
      lines.push(`- ${item}`);
    }
  }

  if (lines.length === 0) {
    return null;
  }

  return lines.join('\n');
}

// ============================================================================
// V3: Win Strategy Integration
// ============================================================================

/**
 * Get win strategy guidance specific to a section
 */
function getSectionWinStrategyGuidance(
  sectionKey: RfpSectionKey,
  strategy: RfpWinStrategy
): { guidance: string | null; themesApplied: string[]; proofApplied: string[] } {
  const lines: string[] = [];
  const themesApplied: string[] = [];
  const proofApplied: string[] = [];

  // Get applicable win themes for this section
  const applicableThemes = strategy.winThemes.filter(
    t => !t.applicableSections || t.applicableSections.length === 0 || t.applicableSections.includes(sectionKey)
  );

  if (applicableThemes.length > 0) {
    lines.push('## WIN THEMES TO EMPHASIZE');
    lines.push('Weave these key messages throughout this section:');
    lines.push('');
    for (const theme of applicableThemes) {
      lines.push(`### ${theme.label}`);
      lines.push(theme.description);
      lines.push('');
      themesApplied.push(theme.id);
    }
    lines.push('IMPORTANT: Make these themes evident without being heavy-handed. Show, don\'t just tell.');
  }

  // Get applicable evaluation criteria for this section
  const applicableCriteria = strategy.evaluationCriteria.filter(
    c => !c.primarySections || c.primarySections.length === 0 || c.primarySections.includes(sectionKey)
  );

  if (applicableCriteria.length > 0) {
    lines.push('');
    lines.push('## EVALUATION CRITERIA ALIGNMENT');
    lines.push('This section is evaluated on:');
    lines.push('');
    for (const criterion of applicableCriteria) {
      const weight = criterion.weight ? ` (${Math.round(criterion.weight * 100)}% weight)` : '';
      lines.push(`### ${criterion.label}${weight}`);
      if (criterion.guidance) {
        lines.push(criterion.guidance);
      }
      if (criterion.alignmentRationale) {
        lines.push(`Our strength: ${criterion.alignmentRationale}`);
      }
      lines.push('');
    }
  }

  // Get applicable proof items for this section
  const applicableProof = strategy.proofPlan.filter(
    p => !p.targetSections || p.targetSections.length === 0 || p.targetSections.includes(sectionKey)
  ).sort((a, b) => (b.priority || 3) - (a.priority || 3));

  if (applicableProof.length > 0) {
    lines.push('');
    lines.push('## PROOF POINTS TO INCLUDE');
    lines.push('Incorporate these specific evidence points:');
    lines.push('');
    for (const proof of applicableProof) {
      const priority = proof.priority === 5 ? '[MUST INCLUDE] ' : proof.priority === 4 ? '[HIGH PRIORITY] ' : '';
      lines.push(`- ${priority}${proof.type === 'case_study' ? 'Case Study' : 'Reference'} (ID: ${proof.id})`);
      if (proof.usageGuidance) {
        lines.push(`  Usage: ${proof.usageGuidance}`);
      }
      proofApplied.push(proof.id);
    }
  }

  // Get applicable landmines for this section
  const applicableLandmines = strategy.landmines.filter(
    l => !l.affectedSections || l.affectedSections.length === 0 || l.affectedSections.includes(sectionKey)
  );

  if (applicableLandmines.length > 0) {
    lines.push('');
    lines.push('## RISK AREAS - TREAD CAREFULLY');
    for (const landmine of applicableLandmines) {
      const severity = landmine.severity === 'critical' ? '🔴 CRITICAL' :
                       landmine.severity === 'high' ? '🟠 HIGH' :
                       landmine.severity === 'medium' ? '🟡 MEDIUM' : '🟢 LOW';
      lines.push(`- ${severity}: ${landmine.description}`);
      if (landmine.mitigation) {
        lines.push(`  Mitigation: ${landmine.mitigation}`);
      }
    }
  }

  // Add competitive positioning if relevant
  if (strategy.competitiveAssumptions && strategy.competitiveAssumptions.length > 0) {
    // Only include for sections where differentiation matters most
    if (['approach', 'team', 'work_samples'].includes(sectionKey)) {
      lines.push('');
      lines.push('## COMPETITIVE POSITIONING');
      lines.push('Consider these differentiators (do not make false claims about competitors):');
      for (const assumption of strategy.competitiveAssumptions) {
        lines.push(`- ${assumption}`);
      }
    }
  }

  if (lines.length === 0) {
    return { guidance: null, themesApplied, proofApplied };
  }

  return {
    guidance: lines.join('\n'),
    themesApplied,
    proofApplied,
  };
}

// ============================================================================
// V4: Evaluator Persona Integration
// ============================================================================

/**
 * Get persona-specific guidance for a section
 */
function getSectionPersonaGuidance(
  sectionKey: RfpSectionKey,
  personaSettings: RfpPersonaSettings | null | undefined
): { guidance: string | null; primaryPersona: EvaluatorPersonaType; secondaryPersonas: EvaluatorPersonaType[] } {
  const { primary, secondary } = getPersonaForSection(sectionKey, personaSettings);
  const primaryPersona = EVALUATOR_PERSONAS[primary];

  const lines: string[] = [];

  lines.push('## EVALUATOR PERSONA FRAMING');
  lines.push(`This section is primarily reviewed by: **${primaryPersona.label}** evaluator(s)`);
  lines.push('');
  lines.push(`> ${primaryPersona.description}`);
  lines.push('');

  // Primary persona priorities
  lines.push('### What This Evaluator Prioritizes');
  for (const priority of primaryPersona.priorities) {
    lines.push(`- ${priority}`);
  }
  lines.push('');

  // Primary persona sensitivities
  lines.push('### What To Avoid (Triggers Negative Reactions)');
  for (const sensitivity of primaryPersona.sensitivities) {
    lines.push(`- ⚠️ ${sensitivity}`);
  }
  lines.push('');

  // Tone guidance
  lines.push('### Tone & Style for This Evaluator');
  for (const tone of primaryPersona.tonePreferences) {
    lines.push(`- ${tone}`);
  }
  lines.push('');

  // Language guidance
  lines.push('### Language That Resonates');
  lines.push(`Use phrases like: ${primaryPersona.resonantPhrases.slice(0, 4).map(p => `"${p}"`).join(', ')}`);
  lines.push('');
  lines.push(`Avoid phrases like: ${primaryPersona.avoidPhrases.slice(0, 4).map(p => `"${p}"`).join(', ')}`);

  // Secondary personas
  if (secondary.length > 0) {
    lines.push('');
    lines.push('### Secondary Reviewers');
    lines.push(`This section may also be reviewed by: ${secondary.map(p => EVALUATOR_PERSONAS[p].label).join(', ')}`);
    lines.push('');
    lines.push('Keep their perspectives in mind, but prioritize the primary evaluator framing.');
    lines.push('');

    // Add key priorities from secondary personas
    for (const secondaryType of secondary.slice(0, 1)) {
      const secondaryPersona = EVALUATOR_PERSONAS[secondaryType];
      lines.push(`**${secondaryPersona.label}** also values: ${secondaryPersona.priorities.slice(0, 2).join(', ')}`);
    }
  }

  // Critical reminder
  lines.push('');
  lines.push('### CRITICAL - FACTUAL CONSISTENCY');
  lines.push('While adjusting framing and tone for the evaluator:');
  lines.push('- Do NOT change facts or claims between sections');
  lines.push('- Do NOT make promises in one section that contradict another');
  lines.push('- Do NOT use different numbers or metrics');
  lines.push('- Only adjust emphasis, language, and presentation style');

  return {
    guidance: lines.join('\n'),
    primaryPersona: primary,
    secondaryPersonas: secondary,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format agency profile for prompt
 */
function formatAgencyProfile(profile: AgencyProfile): string {
  const lines: string[] = [
    `Agency Name: ${profile.name}`,
  ];

  if (profile.oneLiner) {
    lines.push(`One-liner: ${profile.oneLiner}`);
  }
  if (profile.overviewLong) {
    lines.push(`Overview: ${profile.overviewLong}`);
  }
  if (profile.differentiators.length > 0) {
    lines.push(`Differentiators: ${profile.differentiators.join('; ')}`);
  }
  if (profile.services.length > 0) {
    lines.push(`Services: ${profile.services.join(', ')}`);
  }
  if (profile.industries.length > 0) {
    lines.push(`Industries: ${profile.industries.join(', ')}`);
  }
  if (profile.approachSummary) {
    lines.push(`Approach: ${profile.approachSummary}`);
  }
  if (profile.collaborationModel) {
    lines.push(`Collaboration Model: ${profile.collaborationModel}`);
  }

  return lines.join('\n');
}

/**
 * Format team member for prompt
 */
function formatTeamMember(member: TeamMember, index: number): string {
  const lines: string[] = [
    `${index + 1}. ${member.name} - ${member.role}`,
  ];

  if (member.bio) {
    lines.push(`   Bio: ${member.bio}`);
  }
  if (member.strengths.length > 0) {
    lines.push(`   Strengths: ${member.strengths.join(', ')}`);
  }
  if (member.functions.length > 0) {
    lines.push(`   Functions: ${member.functions.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Format case study for prompt
 */
function formatCaseStudy(study: CaseStudy, index: number): string {
  const lines: string[] = [
    `${index + 1}. "${study.title}" - ${study.client}`,
  ];

  if (study.industry) {
    lines.push(`   Industry: ${study.industry}`);
  }
  if (study.services.length > 0) {
    lines.push(`   Services: ${study.services.join(', ')}`);
  }
  if (study.summary) {
    lines.push(`   Summary: ${study.summary}`);
  }
  if (study.problem) {
    lines.push(`   Problem: ${study.problem}`);
  }
  if (study.approach) {
    lines.push(`   Approach: ${study.approach}`);
  }
  if (study.outcome) {
    lines.push(`   Outcome: ${study.outcome}`);
  }
  if (study.metrics.length > 0) {
    const metricsStr = study.metrics.map(m => `${m.label}: ${m.value}`).join('; ');
    lines.push(`   Metrics: ${metricsStr}`);
  }
  if (study.permissionLevel !== 'public') {
    lines.push(`   [Permission: ${study.permissionLevel}]`);
  }

  return lines.join('\n');
}

/**
 * Format reference for prompt
 */
function formatReference(ref: Reference, index: number): string {
  const lines: string[] = [
    `${index + 1}. ${ref.client} - ${ref.contactName}`,
  ];

  if (ref.engagementType) {
    lines.push(`   Engagement: ${ref.engagementType}`);
  }
  if (ref.industries.length > 0) {
    lines.push(`   Industries: ${ref.industries.join(', ')}`);
  }
  if (ref.notes) {
    lines.push(`   Notes: ${ref.notes}`);
  }

  // Only include contact info for confirmed references
  if (ref.permissionStatus === 'confirmed') {
    if (ref.email) {
      lines.push(`   Email: ${ref.email}`);
    }
    if (ref.phone) {
      lines.push(`   Phone: ${ref.phone}`);
    }
  } else {
    lines.push(`   [Permission Status: ${ref.permissionStatus} - Contact info withheld]`);
  }

  return lines.join('\n');
}

/**
 * Format pricing template for prompt
 */
function formatPricingTemplate(template: PricingTemplate): string {
  const lines: string[] = [
    `Template: ${template.templateName}`,
  ];

  if (template.useCase) {
    lines.push(`Use Case: ${template.useCase}`);
  }

  if (template.lineItems.length > 0) {
    lines.push('\nLine Items:');
    for (const item of template.lineItems) {
      const optionalTag = item.optional ? ' (optional)' : '';
      const rateStr = item.rate ? ` - ${item.rate}/${item.unit}` : '';
      lines.push(`  - ${item.category}: ${item.description}${rateStr}${optionalTag}`);
    }
  }

  if (template.assumptions.length > 0) {
    lines.push(`\nAssumptions: ${template.assumptions.join('; ')}`);
  }

  if (template.exclusions.length > 0) {
    lines.push(`\nExclusions: ${template.exclusions.join('; ')}`);
  }

  if (template.optionSets.length > 0) {
    lines.push('\nOption Sets:');
    for (const opt of template.optionSets) {
      lines.push(`  - ${opt.name}: ${opt.description || 'No description'}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format plan template for prompt
 */
function formatPlanTemplate(template: PlanTemplate): string {
  const lines: string[] = [
    `Template: ${template.templateName}`,
  ];

  if (template.useCase) {
    lines.push(`Use Case: ${template.useCase}`);
  }

  if (template.typicalTimeline) {
    lines.push(`Typical Timeline: ${template.typicalTimeline}`);
  }

  if (template.phases.length > 0) {
    lines.push('\nPhases:');
    const sortedPhases = [...template.phases].sort((a, b) => a.order - b.order);
    for (const phase of sortedPhases) {
      lines.push(`  ${phase.order}. ${phase.name}`);
      if (phase.description) {
        lines.push(`     Description: ${phase.description}`);
      }
      if (phase.duration) {
        lines.push(`     Duration: ${phase.duration}`);
      }
      if (phase.deliverables.length > 0) {
        lines.push(`     Deliverables: ${phase.deliverables.join(', ')}`);
      }
      if (phase.milestones.length > 0) {
        lines.push(`     Milestones: ${phase.milestones.join(', ')}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Format company context for prompt
 */
function formatCompanyContext(ctx: CompanyContext): string {
  const lines: string[] = [
    `Company: ${ctx.companyName}`,
  ];

  if (ctx.industry) {
    lines.push(`Industry: ${ctx.industry}`);
  }
  if (ctx.businessModel) {
    lines.push(`Business Model: ${ctx.businessModel}`);
  }
  if (ctx.icpDescription) {
    lines.push(`ICP: ${ctx.icpDescription}`);
  }
  if (ctx.valueProposition) {
    lines.push(`Value Proposition: ${ctx.valueProposition}`);
  }
  if (ctx.positioning) {
    lines.push(`Positioning: ${ctx.positioning}`);
  }
  if (ctx.goalStatement) {
    lines.push(`Goal: ${ctx.goalStatement}`);
  }

  return lines.join('\n');
}

/**
 * Format RFP context for prompt
 */
function formatRfpContext(ctx: RfpContext): string {
  const lines: string[] = [
    `RFP Title: ${ctx.title}`,
  ];

  if (ctx.selectedPath) {
    lines.push(`Engagement Type: ${ctx.selectedPath}`);
  }
  if (ctx.dueDate) {
    lines.push(`Due Date: ${ctx.dueDate}`);
  }
  if (ctx.scopeSummary) {
    lines.push(`\nScope Summary:\n${ctx.scopeSummary}`);
  }
  if (ctx.requirementsChecklist && ctx.requirementsChecklist.length > 0) {
    lines.push('\nRequirements:');
    for (const req of ctx.requirementsChecklist) {
      const category = req.category ? `[${req.category}] ` : '';
      lines.push(`  - ${category}${req.requirement}`);
    }
  }

  return lines.join('\n');
}

/**
 * Check what inputs are available
 */
function checkAvailableInputs(
  firmBrain: FirmBrainSnapshot,
  boundResources: BoundResources,
  rfpContext: RfpContext
): {
  hasAgencyProfile: boolean;
  teamMemberCount: number;
  caseStudyCount: number;
  referenceCount: number;
  hasPricingTemplate: boolean;
  hasPlanTemplate: boolean;
  hasScopeSummary: boolean;
} {
  return {
    hasAgencyProfile: !!firmBrain.agencyProfile?.name,
    teamMemberCount: boundResources.teamMembers.length,
    caseStudyCount: boundResources.caseStudies.length,
    referenceCount: boundResources.references.filter(r => r.permissionStatus === 'confirmed').length,
    hasPricingTemplate: !!boundResources.pricingTemplate,
    hasPlanTemplate: !!boundResources.planTemplate,
    hasScopeSummary: !!rfpContext.scopeSummary,
  };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Build a prompt for AI generation of an RFP section
 *
 * Uses contracts to determine what inputs are required and how to structure
 * the prompt for each section type.
 */
export function buildRfpSectionPrompt(args: BuildRfpPromptArgs): BuildRfpPromptResult {
  const {
    sectionKey,
    firmBrain,
    boundResources,
    companyContext,
    rfpContext,
    currentContent,
  } = args;

  const contract = RFP_SECTION_CONTRACTS[sectionKey];
  const validationWarnings: string[] = [];

  // Check input availability
  const availableInputs = checkAvailableInputs(firmBrain, boundResources, rfpContext);
  const validation = validateSectionInputs(sectionKey, availableInputs);

  // Build generated using metadata
  const generatedUsing: RfpPromptGeneratedUsing = {
    primaryInputsUsed: [],
    primaryInputsMissing: validation.missing.map(m => {
      if (m === 'Agency Profile') return 'agency_profile';
      if (m === 'Team Members') return 'team_members';
      if (m === 'Case Studies') return 'case_studies';
      if (m === 'References') return 'references';
      if (m === 'Pricing Template') return 'pricing_template';
      if (m === 'Plan Template') return 'plan_template';
      return m as PrimaryInputType;
    }),
    secondaryInputsUsed: [],
    teamMemberIds: boundResources.teamMembers.map(t => t.id),
    caseStudyIds: boundResources.caseStudies.map(c => c.id),
    referenceIds: boundResources.references.filter(r => r.permissionStatus === 'confirmed').map(r => r.id),
    pricingTemplateId: boundResources.pricingTemplate?.id,
    planTemplateId: boundResources.planTemplate?.id,
    hasAgencyProfile: availableInputs.hasAgencyProfile,
    hasScopeSummary: availableInputs.hasScopeSummary,
    hasCompanyContext: !!companyContext.companyName,
    hasStrategyFrame: !!(companyContext.valueProposition || companyContext.positioning),
    // V3: Win strategy tracking
    hasWinStrategy: !!rfpContext.winStrategy,
    winThemesApplied: [],
    proofItemsApplied: [],
    // V4: Persona tracking
    hasPersonaSettings: !!rfpContext.personaSettings?.enabled,
    primaryPersona: undefined,
    secondaryPersonas: undefined,
    canGenerate: validation.valid,
    blockingReason: validation.valid ? undefined : `Missing: ${validation.missing.join(', ')}`,
  };

  // V3: Get win strategy guidance and track what's applied
  let winStrategyResult: { guidance: string | null; themesApplied: string[]; proofApplied: string[] } | null = null;
  if (rfpContext.winStrategy) {
    winStrategyResult = getSectionWinStrategyGuidance(sectionKey, rfpContext.winStrategy);
    generatedUsing.winThemesApplied = winStrategyResult.themesApplied;
    generatedUsing.proofItemsApplied = winStrategyResult.proofApplied;
  }

  // V4: Get persona guidance and track what's applied
  let personaResult: { guidance: string | null; primaryPersona: EvaluatorPersonaType; secondaryPersonas: EvaluatorPersonaType[] } | null = null;
  if (rfpContext.personaSettings?.enabled !== false) {
    personaResult = getSectionPersonaGuidance(sectionKey, rfpContext.personaSettings);
    generatedUsing.primaryPersona = personaResult.primaryPersona;
    generatedUsing.secondaryPersonas = personaResult.secondaryPersonas;
  }

  // Track which primary inputs are used
  for (const input of contract.primaryInputs) {
    switch (input) {
      case 'agency_profile':
        if (availableInputs.hasAgencyProfile) generatedUsing.primaryInputsUsed.push(input);
        break;
      case 'team_members':
        if (availableInputs.teamMemberCount > 0) generatedUsing.primaryInputsUsed.push(input);
        break;
      case 'case_studies':
        if (availableInputs.caseStudyCount > 0) generatedUsing.primaryInputsUsed.push(input);
        break;
      case 'references':
        if (availableInputs.referenceCount > 0) generatedUsing.primaryInputsUsed.push(input);
        break;
      case 'pricing_template':
        if (availableInputs.hasPricingTemplate) generatedUsing.primaryInputsUsed.push(input);
        break;
      case 'plan_template':
        if (availableInputs.hasPlanTemplate) generatedUsing.primaryInputsUsed.push(input);
        break;
    }
  }

  // Track secondary inputs
  for (const input of contract.secondaryInputs) {
    switch (input) {
      case 'scope_summary':
        if (availableInputs.hasScopeSummary) generatedUsing.secondaryInputsUsed.push(input);
        break;
      case 'company_context':
        if (companyContext.companyName) generatedUsing.secondaryInputsUsed.push(input);
        break;
      case 'strategy_frame':
        if (companyContext.valueProposition || companyContext.positioning) {
          generatedUsing.secondaryInputsUsed.push(input);
        }
        break;
      case 'requirements_checklist':
        if (rfpContext.requirementsChecklist?.length) generatedUsing.secondaryInputsUsed.push(input);
        break;
    }
  }

  // Add validation warnings for missing inputs
  if (!validation.valid) {
    validationWarnings.push(`Missing required inputs: ${validation.missing.join(', ')}`);
  }

  // Build prompts
  const systemPrompt = buildSystemPrompt(contract);
  const userPrompt = buildUserPrompt({
    contract,
    firmBrain,
    boundResources,
    companyContext,
    rfpContext,
    currentContent,
    validationWarnings,
    // V3: Win strategy guidance
    winStrategyGuidance: winStrategyResult?.guidance || null,
    // V4: Persona guidance
    personaGuidance: personaResult?.guidance || null,
  });

  return {
    systemPrompt,
    userPrompt,
    generatedUsing,
    contract,
    validationWarnings,
  };
}

/**
 * Build the system prompt
 */
function buildSystemPrompt(contract: RfpSectionContract): string {
  return `You are an expert RFP writer helping a marketing agency create compelling proposal sections.

You are generating the "${contract.title}" section of an RFP response.

${contract.description}

${RFP_NO_NEW_CLAIMS_RULE}

${RFP_TONE_GUIDANCE}

${RFP_FALLBACK_RULES}

OUTPUT FORMAT:
Return your response as a JSON object with this structure:
{
  "content": "The section content in markdown format",
  "confidence": "high" | "medium" | "low",
  "warnings": ["Array of any issues or gaps noted"]
}

Do not include any text outside the JSON object.`;
}

/**
 * Build the user prompt with all context
 */
function buildUserPrompt(args: {
  contract: RfpSectionContract;
  firmBrain: FirmBrainSnapshot;
  boundResources: BoundResources;
  companyContext: CompanyContext;
  rfpContext: RfpContext;
  currentContent?: string;
  validationWarnings: string[];
  /** V3: Win strategy guidance to inject */
  winStrategyGuidance?: string | null;
  /** V4: Persona guidance to inject */
  personaGuidance?: string | null;
}): string {
  const {
    contract,
    firmBrain,
    boundResources,
    companyContext,
    rfpContext,
    currentContent,
    validationWarnings,
    winStrategyGuidance,
    personaGuidance,
  } = args;

  const sections: string[] = [];

  // Header
  sections.push(`## Task\nGenerate the "${contract.title}" section for this RFP response.`);

  // Validation warnings (if any)
  if (validationWarnings.length > 0) {
    sections.push(`## WARNINGS\n${validationWarnings.map(w => `⚠️ ${w}`).join('\n')}\n\nProceed with available information, but note limitations.`);
  }

  // V2: Dynamic fallback guidance based on missing data
  const fallbackGuidance = getFallbackGuidance(
    boundResources.caseStudies.length > 0,
    boundResources.references.filter(r => r.permissionStatus === 'confirmed').length > 0,
    !!boundResources.pricingTemplate,
    !!boundResources.planTemplate
  );
  if (fallbackGuidance.length > 0) {
    sections.push(`## FALLBACK GUIDANCE (Apply These Rules)\n${fallbackGuidance.map(g => `- ${g}`).join('\n')}`);
  }

  // Hard constraints (MUST follow)
  sections.push(`## HARD CONSTRAINTS (MUST follow)\n${contract.hardConstraints.map(c => `- ${c}`).join('\n')}`);

  // Style guidance
  sections.push(`## STYLE GUIDANCE\n${contract.styleGuidance.map(g => `- ${g}`).join('\n')}`);

  // V3: Win strategy guidance (CRITICAL for alignment)
  if (winStrategyGuidance) {
    sections.push(`
# 🎯 WIN STRATEGY ALIGNMENT
This is critical - ensure your content explicitly aligns with these strategic elements:

${winStrategyGuidance}
`);
  }

  // V4: Persona guidance (adjusts framing without changing facts)
  if (personaGuidance) {
    sections.push(`
# 👤 EVALUATOR PERSPECTIVE
Frame your content for the specific evaluator reviewing this section:

${personaGuidance}
`);
  }

  // V2.5: Requirements-based guidance (if parsed requirements available)
  if (rfpContext.parsedRequirements) {
    const requirementsGuidance = getSectionRequirementsGuidance(
      contract.key as RfpSectionKey,
      rfpContext.parsedRequirements
    );
    if (requirementsGuidance) {
      sections.push(requirementsGuidance);
    }
  }

  // === PRIMARY INPUTS ===
  sections.push('## PRIMARY INPUTS (MUST Honor)');

  // Agency Profile
  if (contract.primaryInputs.includes('agency_profile') && firmBrain.agencyProfile) {
    sections.push(`### Agency Profile\n${formatAgencyProfile(firmBrain.agencyProfile)}`);
  }

  // Team Members
  if (contract.primaryInputs.includes('team_members') && boundResources.teamMembers.length > 0) {
    const formatted = boundResources.teamMembers.map((m, i) => formatTeamMember(m, i)).join('\n\n');
    sections.push(`### Selected Team Members\n${formatted}`);
  }

  // Case Studies
  if (contract.primaryInputs.includes('case_studies') && boundResources.caseStudies.length > 0) {
    const formatted = boundResources.caseStudies.map((c, i) => formatCaseStudy(c, i)).join('\n\n');
    sections.push(`### Selected Case Studies\n${formatted}`);
  }

  // References
  if (contract.primaryInputs.includes('references') && boundResources.references.length > 0) {
    const confirmed = boundResources.references.filter(r => r.permissionStatus === 'confirmed');
    if (confirmed.length > 0) {
      const formatted = confirmed.map((r, i) => formatReference(r, i)).join('\n\n');
      sections.push(`### Confirmed References\n${formatted}`);
    } else {
      sections.push('### References\n[No confirmed references available]');
    }
  }

  // Pricing Template
  if (contract.primaryInputs.includes('pricing_template') && boundResources.pricingTemplate) {
    sections.push(`### Pricing Template\n${formatPricingTemplate(boundResources.pricingTemplate)}`);
  }

  // Plan Template
  if (contract.primaryInputs.includes('plan_template') && boundResources.planTemplate) {
    sections.push(`### Plan Template\n${formatPlanTemplate(boundResources.planTemplate)}`);
  }

  // === SECONDARY INPUTS ===
  const hasSecondaryInputs = contract.secondaryInputs.length > 0;
  if (hasSecondaryInputs) {
    sections.push('## SECONDARY INPUTS (MAY Influence)');

    // Scope Summary
    if (contract.secondaryInputs.includes('scope_summary') && rfpContext.scopeSummary) {
      sections.push(`### Scope Summary\n${rfpContext.scopeSummary}`);
    }

    // Company Context
    if (contract.secondaryInputs.includes('company_context')) {
      sections.push(`### Company Context\n${formatCompanyContext(companyContext)}`);
    }

    // Strategy Frame
    if (contract.secondaryInputs.includes('strategy_frame')) {
      const strategyLines: string[] = [];
      if (companyContext.valueProposition) {
        strategyLines.push(`Value Proposition: ${companyContext.valueProposition}`);
      }
      if (companyContext.positioning) {
        strategyLines.push(`Positioning: ${companyContext.positioning}`);
      }
      if (companyContext.goalStatement) {
        strategyLines.push(`Goal: ${companyContext.goalStatement}`);
      }
      if (strategyLines.length > 0) {
        sections.push(`### Strategy Frame\n${strategyLines.join('\n')}`);
      }
    }

    // Requirements Checklist
    if (contract.secondaryInputs.includes('requirements_checklist') && rfpContext.requirementsChecklist?.length) {
      const formatted = rfpContext.requirementsChecklist
        .map(r => `- ${r.category ? `[${r.category}] ` : ''}${r.requirement}`)
        .join('\n');
      sections.push(`### Requirements to Address\n${formatted}`);
    }
  }

  // RFP Context (always include)
  sections.push(`## RFP CONTEXT\n${formatRfpContext(rfpContext)}`);

  // Current content (if improving)
  if (currentContent) {
    sections.push(`## CURRENT CONTENT (Improve, Don't Replace Blindly)\nThe current section content is:\n\n${currentContent}\n\nMaintain the core approach but improve clarity, completeness, or alignment with the inputs above.`);
  }

  // Output specification
  const outputSpec = contract.outputSpec;
  sections.push(`## OUTPUT SPECIFICATION
- Format: ${outputSpec.format === 'markdown' ? 'Markdown' : 'Structured'}
- Length: ${outputSpec.minWords || 0}-${outputSpec.maxWords || 1000} words
${outputSpec.requiredSections ? `- Required Sections: ${outputSpec.requiredSections.join(', ')}` : ''}

Return a JSON object with:
{
  "content": "Your markdown content here",
  "confidence": "high" | "medium" | "low",
  "warnings": ["Any issues or gaps noted"]
}`);

  return sections.join('\n\n');
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Get a summary of what inputs were used for UI display
 */
export function getGeneratedUsingSummary(meta: RfpPromptGeneratedUsing): string {
  const parts: string[] = [];

  if (meta.hasAgencyProfile) {
    parts.push('Agency Profile');
  }
  if (meta.teamMemberIds.length > 0) {
    parts.push(`${meta.teamMemberIds.length} Team Members`);
  }
  if (meta.caseStudyIds.length > 0) {
    parts.push(`${meta.caseStudyIds.length} Case Studies`);
  }
  if (meta.referenceIds.length > 0) {
    parts.push(`${meta.referenceIds.length} References`);
  }
  if (meta.pricingTemplateId) {
    parts.push('Pricing Template');
  }
  if (meta.planTemplateId) {
    parts.push('Plan Template');
  }

  if (parts.length === 0) {
    return 'No inputs used';
  }

  return `Generated using: ${parts.join(' + ')}`;
}

/**
 * Check if a section can be generated with available inputs
 */
export function canGenerateSection(
  sectionKey: RfpSectionKey,
  firmBrain: FirmBrainSnapshot,
  boundResources: BoundResources,
  rfpContext: RfpContext
): { canGenerate: boolean; missing: string[] } {
  const availableInputs = checkAvailableInputs(firmBrain, boundResources, rfpContext);
  const validation = validateSectionInputs(sectionKey, availableInputs);
  return {
    canGenerate: validation.valid,
    missing: validation.missing,
  };
}
