// lib/gap-heavy/modules/brandActionPlanBuilder.ts
// Brand Action Plan Builder
//
// Synthesizes BrandDiagnosticResult into a structured, prioritized action plan

import type {
  BrandDiagnosticResult,
  BrandActionPlan,
  BrandWorkItem,
  BrandActionTheme,
  BrandStrategyChange,
  BrandDimension,
  BrandServiceArea,
} from './brandLab';
import { dimensionToServiceArea } from './brandLab';

/**
 * Build a BrandActionPlan from a BrandDiagnosticResult
 *
 * This is the synthesis layer that converts brand diagnostic data
 * into a prioritized set of actions for strategists.
 */
export function buildBrandActionPlan(diagnostic: BrandDiagnosticResult): BrandActionPlan {
  console.log('[Brand Action Plan] Building plan from diagnostic...');

  const { score, benchmarkLabel } = diagnostic;

  // 1. Generate summary
  const summary = generateBrandSummary(diagnostic);

  // 2. Identify key themes
  const keyThemes = identifyBrandThemes(diagnostic);

  // 3. Synthesize work items
  const allWorkItems = synthesizeBrandWorkItems(diagnostic);

  // 4. Assign to priority buckets
  const now = allWorkItems.filter(item => item.priority === 'now');
  const next = allWorkItems.filter(item => item.priority === 'next');
  const later = allWorkItems.filter(item => item.priority === 'later');

  // Sort by impact score descending
  const sortByImpact = (a: BrandWorkItem, b: BrandWorkItem) => b.impactScore - a.impactScore;
  now.sort(sortByImpact);
  next.sort(sortByImpact);
  later.sort(sortByImpact);

  // 5. Generate strategic changes
  const strategicChanges = generateBrandStrategyChanges(diagnostic);

  console.log('[Brand Action Plan] ✓ Plan built:');
  console.log(`  - ${now.length} items in NOW bucket`);
  console.log(`  - ${next.length} items in NEXT bucket`);
  console.log(`  - ${later.length} items in LATER bucket`);
  console.log(`  - ${keyThemes.length} themes identified`);

  return {
    summary,
    overallScore: score,
    benchmarkLabel,
    keyThemes,
    now,
    next,
    later,
    strategicChanges,
    experiments: [], // Optional for later
  };
}

// ============================================================================
// SUMMARY GENERATION
// ============================================================================

function generateBrandSummary(diagnostic: BrandDiagnosticResult): string {
  const { score, benchmarkLabel, inconsistencies, opportunities } = diagnostic;

  let summary = `**${benchmarkLabel.toUpperCase()} (${score}/100)** - `;

  if (score < 50) {
    summary += `Brand identity is unclear and positioning is weak. ${inconsistencies.length} major inconsistencies detected. `;
  } else if (score < 70) {
    summary += `Brand has a foundation but lacks clarity and differentiation. ${inconsistencies.length} inconsistencies found. `;
  } else if (score < 85) {
    summary += `Solid brand identity with room to strengthen differentiation and trust signals. ${inconsistencies.length} areas for improvement. `;
  } else {
    summary += `Strong, coherent brand with clear positioning. ${opportunities.length} opportunities for optimization. `;
  }

  summary += `${opportunities.length} opportunities identified.`;

  return summary;
}

// ============================================================================
// THEME IDENTIFICATION
// ============================================================================

function identifyBrandThemes(diagnostic: BrandDiagnosticResult): BrandActionTheme[] {
  const themes: BrandActionTheme[] = [];

  // Theme 1: Brand Identity & Promise
  if (diagnostic.identitySystem.corePromiseClarityScore < 70 || diagnostic.identitySystem.identityGaps.length > 0) {
    themes.push({
      id: 'theme-identity',
      label: 'Clarify Core Brand Promise',
      description:
        'The core brand promise is unclear or missing. Visitors should immediately understand what you do and why it matters.',
      priority: diagnostic.identitySystem.corePromiseClarityScore < 50 ? 'critical' : 'important',
      linkedDimensions: ['identity', 'messaging'],
      expectedImpactSummary: 'Reduce confusion and improve conversion by 15-30%',
    });
  }

  // Theme 2: Positioning & Differentiation
  if (diagnostic.positioning.positioningClarityScore < 70 || !diagnostic.positioning.isClearWhoThisIsFor) {
    themes.push({
      id: 'theme-positioning',
      label: 'Sharpen Positioning & Differentiation',
      description:
        'Positioning is generic or unclear. Strengthen competitive angle and clarify who this is for.',
      priority: diagnostic.positioning.positioningClarityScore < 50 ? 'critical' : 'important',
      linkedDimensions: ['positioning', 'messaging'],
      expectedImpactSummary: 'Stand out from competitors and attract ideal customers',
    });
  }

  // Theme 3: Messaging Clarity
  if (diagnostic.messagingSystem.messagingFocusScore < 70 || diagnostic.messagingSystem.clarityIssues.length > 2) {
    themes.push({
      id: 'theme-messaging',
      label: 'Tighten Messaging & Value Props',
      description:
        'Messaging is scattered or unclear. Focus on specific, benefit-driven value propositions.',
      priority: 'important',
      linkedDimensions: ['messaging'],
      expectedImpactSummary: 'Improve message clarity and reduce bounce rate',
    });
  }

  // Theme 4: Trust & Human Presence
  if (diagnostic.trustAndProof.trustSignalsScore < 70 || diagnostic.trustAndProof.humanPresenceScore < 60) {
    themes.push({
      id: 'theme-trust',
      label: 'Elevate Trust & Human Presence',
      description:
        'Trust signals are weak and the brand feels impersonal. Add human elements, proof points, and credibility markers.',
      priority: diagnostic.trustAndProof.trustSignalsScore < 50 ? 'critical' : 'important',
      linkedDimensions: ['trust'],
      expectedImpactSummary: 'Build credibility and reduce hesitation',
    });
  }

  // Theme 5: Visual System
  if (diagnostic.visualSystem.visualConsistencyScore < 70 || diagnostic.visualSystem.brandRecognitionScore < 60) {
    themes.push({
      id: 'theme-visual',
      label: 'Strengthen Visual Brand System',
      description:
        'Visual brand is inconsistent or unmemorable. Tighten color usage, typography, and visual patterns.',
      priority: 'nice_to_have',
      linkedDimensions: ['visual'],
      expectedImpactSummary: 'Improve brand recognition and professional perception',
    });
  }

  // Theme 6: Audience Fit
  if (diagnostic.audienceFit.alignmentScore < 70) {
    themes.push({
      id: 'theme-audience',
      label: 'Align Brand to Target Audience',
      description:
        'Brand messaging doesn\'t clearly speak to the target ICP. Adjust tone, language, and examples.',
      priority: 'important',
      linkedDimensions: ['audience_fit', 'messaging'],
      expectedImpactSummary: 'Better resonate with ideal customers',
    });
  }

  return themes;
}

// ============================================================================
// WORK ITEM SYNTHESIS
// ============================================================================

function synthesizeBrandWorkItems(diagnostic: BrandDiagnosticResult): BrandWorkItem[] {
  const items: BrandWorkItem[] = [];

  // Pull from opportunities
  items.push(...synthesizeFromOpportunities(diagnostic));

  // Pull from risks
  items.push(...synthesizeFromRisks(diagnostic));

  // Pull from inconsistencies
  items.push(...synthesizeFromInconsistencies(diagnostic));

  // Pull from identity gaps
  items.push(...synthesizeFromIdentityGaps(diagnostic));

  // Pull from messaging issues
  items.push(...synthesizeFromMessagingIssues(diagnostic));

  // Pull from visual gaps
  items.push(...synthesizeFromVisualGaps(diagnostic));

  // Pull from trust gaps
  items.push(...synthesizeFromTrustGaps(diagnostic));

  // Add standard brand deliverables
  items.push(...addStandardBrandDeliverables(diagnostic));

  // Deduplicate by title
  const seen = new Set<string>();
  const unique = items.filter(item => {
    const key = item.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique;
}

function synthesizeFromOpportunities(diagnostic: BrandDiagnosticResult): BrandWorkItem[] {
  return diagnostic.opportunities.map(opp => {
    const dimension = themeToDimension(opp.theme);
    const priority = opp.estimatedImpactScore >= 4 ? 'now' : opp.estimatedImpactScore >= 3 ? 'next' : 'later';

    return {
      id: opp.id,
      title: opp.title,
      description: opp.description,
      rationale: `${opp.theme} opportunity with ${opp.estimatedImpactScore}/5 impact. This addresses a key brand gap.`,
      evidenceRefs: [opp.id],
      dimension,
      serviceArea: opp.area as BrandServiceArea,
      impactScore: opp.estimatedImpactScore,
      effortScore: 3, // Default medium
      priority,
      recommendedAssigneeRole: dimension === 'visual' ? 'Designer' : 'Brand Strategist',
      recommendedTimebox: priority === 'now' ? '1 week' : '2-3 weeks',
      status: 'backlog',
      tags: [opp.theme, 'opportunity'],
    };
  });
}

function synthesizeFromRisks(diagnostic: BrandDiagnosticResult): BrandWorkItem[] {
  return diagnostic.risks.map(risk => {
    const dimension = riskTypeToDimension(risk.riskType);
    const priority = risk.severity >= 4 ? 'now' : risk.severity >= 3 ? 'next' : 'later';

    return {
      id: risk.id,
      title: `Mitigate: ${risk.riskType.replace(/_/g, ' ')}`,
      description: risk.description,
      rationale: `${risk.severity}/5 severity risk. ${risk.description} Addressing this prevents confusion and builds trust.`,
      evidenceRefs: [risk.id],
      dimension,
      serviceArea: 'brand',
      impactScore: risk.severity,
      effortScore: risk.severity >= 4 ? 2 : 3,
      priority,
      recommendedAssigneeRole: 'Brand Strategist',
      recommendedTimebox: priority === 'now' ? '3-5 days' : '1-2 weeks',
      status: 'backlog',
      tags: [risk.riskType, 'risk'],
    };
  });
}

function synthesizeFromInconsistencies(diagnostic: BrandDiagnosticResult): BrandWorkItem[] {
  const highPriority = diagnostic.inconsistencies.filter(i => i.severity === 'high');

  return highPriority.map(inconsistency => {
    const dimension = inconsistencyTypeToDimension(inconsistency.type);

    return {
      id: inconsistency.id,
      title: `Fix ${inconsistency.type} inconsistency: ${inconsistency.location}`,
      description: inconsistency.description,
      rationale: `High-severity ${inconsistency.type} inconsistency found on ${inconsistency.location}. Inconsistencies confuse visitors and weaken brand perception.`,
      evidenceRefs: [inconsistency.id],
      dimension,
      serviceArea: 'brand',
      impactScore: 4,
      effortScore: 2,
      priority: 'now',
      recommendedAssigneeRole: inconsistency.type === 'visual' ? 'Designer' : 'Copywriter',
      recommendedTimebox: '1-2 days',
      status: 'backlog',
      tags: [inconsistency.type, 'consistency'],
    };
  });
}

function synthesizeFromIdentityGaps(diagnostic: BrandDiagnosticResult): BrandWorkItem[] {
  const gaps = diagnostic.identitySystem.identityGaps;
  if (gaps.length === 0) return [];

  return [{
    id: 'identity-gaps',
    title: 'Address brand identity gaps',
    description: gaps.join('; '),
    rationale: `${gaps.length} identity gaps detected. Clear brand identity is foundation for all marketing and positioning.`,
    evidenceRefs: ['identity-system'],
    dimension: 'identity',
    serviceArea: 'brand',
    impactScore: 5,
    effortScore: 4,
    priority: diagnostic.identitySystem.corePromiseClarityScore < 50 ? 'now' : 'next',
    recommendedAssigneeRole: 'Brand Strategist',
    recommendedTimebox: '2-4 weeks',
    status: 'backlog',
    tags: ['identity', 'foundation'],
  }];
}

function synthesizeFromMessagingIssues(diagnostic: BrandDiagnosticResult): BrandWorkItem[] {
  const issues = diagnostic.messagingSystem.clarityIssues;
  if (issues.length === 0) return [];

  return [{
    id: 'messaging-clarity',
    title: 'Improve messaging clarity',
    description: `Address ${issues.length} messaging clarity issues`,
    rationale: `${issues.join('; ')}. Clear messaging reduces bounce and improves conversion.`,
    evidenceRefs: ['messaging-system'],
    dimension: 'messaging',
    serviceArea: 'content',
    impactScore: 4,
    effortScore: 3,
    priority: diagnostic.messagingSystem.messagingFocusScore < 50 ? 'now' : 'next',
    recommendedAssigneeRole: 'Copywriter',
    recommendedTimebox: '1-2 weeks',
    status: 'backlog',
    tags: ['messaging', 'clarity'],
  }];
}

function synthesizeFromVisualGaps(diagnostic: BrandDiagnosticResult): BrandWorkItem[] {
  const gaps = diagnostic.visualSystem.visualGaps;
  if (gaps.length === 0) return [];

  return [{
    id: 'visual-system',
    title: 'Strengthen visual brand system',
    description: gaps.join('; '),
    rationale: `${gaps.length} visual gaps identified. Consistent visual brand improves recognition and professionalism.`,
    evidenceRefs: ['visual-system'],
    dimension: 'visual',
    serviceArea: 'brand',
    impactScore: 3,
    effortScore: 4,
    priority: 'next',
    recommendedAssigneeRole: 'Designer',
    recommendedTimebox: '3-4 weeks',
    status: 'backlog',
    tags: ['visual', 'design'],
  }];
}

function synthesizeFromTrustGaps(diagnostic: BrandDiagnosticResult): BrandWorkItem[] {
  const gaps = diagnostic.trustAndProof.credibilityGaps;
  if (gaps.length === 0) return [];

  return [{
    id: 'trust-credibility',
    title: 'Build trust and credibility',
    description: gaps.join('; '),
    rationale: `${gaps.length} credibility gaps found. Trust signals are critical for B2B and high-consideration purchases.`,
    evidenceRefs: ['trust-and-proof'],
    dimension: 'trust',
    serviceArea: 'content',
    impactScore: 4,
    effortScore: 2,
    priority: diagnostic.trustAndProof.trustSignalsScore < 60 ? 'now' : 'next',
    recommendedAssigneeRole: 'Copywriter',
    recommendedTimebox: '1 week',
    status: 'backlog',
    tags: ['trust', 'proof'],
  }];
}

function addStandardBrandDeliverables(diagnostic: BrandDiagnosticResult): BrandWorkItem[] {
  const items: BrandWorkItem[] = [];

  // Brand guidelines
  if (!diagnostic.brandAssets.hasBrandGuidelines) {
    items.push({
      id: 'brand-guidelines',
      title: 'Create brand guidelines document',
      description: 'Document brand identity, voice, visual system, and usage rules',
      rationale: 'Brand guidelines ensure consistency across all touchpoints and team members.',
      evidenceRefs: ['brand-assets'],
      dimension: 'assets',
      serviceArea: 'brand',
      impactScore: 3,
      effortScore: 4,
      priority: 'later',
      recommendedAssigneeRole: 'Brand Strategist',
      recommendedTimebox: '2-3 weeks',
      status: 'backlog',
      tags: ['guidelines', 'documentation'],
    });
  }

  // Tagline if missing or unclear
  if (!diagnostic.identitySystem.tagline || diagnostic.identitySystem.taglineClarityScore < 60) {
    items.push({
      id: 'tagline-development',
      title: 'Develop clear, memorable tagline',
      description: 'Create a concise tagline that captures core promise and differentiation',
      rationale: 'Strong tagline reinforces positioning and improves brand recall.',
      evidenceRefs: ['identity-system'],
      dimension: 'identity',
      serviceArea: 'brand',
      impactScore: 4,
      effortScore: 3,
      priority: 'now',
      recommendedAssigneeRole: 'Copywriter',
      recommendedTimebox: '1 week',
      status: 'backlog',
      tags: ['tagline', 'messaging'],
    });
  }

  return items;
}

// ============================================================================
// STRATEGIC CHANGES
// ============================================================================

function generateBrandStrategyChanges(diagnostic: BrandDiagnosticResult): BrandStrategyChange[] {
  const changes: BrandStrategyChange[] = [];

  // Positioning shift if needed
  if (diagnostic.positioning.positioningClarityScore < 50 || diagnostic.positioning.positioningRisks.length > 1) {
    changes.push({
      id: 'positioning-shift',
      title: 'Refine brand positioning strategy',
      description: 'Sharpen positioning to be more specific and differentiated',
      reasoning: `Current positioning is ${diagnostic.positioning.positioningTheme}. ${diagnostic.positioning.positioningRisks.join('; ')}`,
      linkedFindings: ['positioning'],
    });
  }

  // ICP alignment
  if (diagnostic.audienceFit.alignmentScore < 60) {
    changes.push({
      id: 'icp-alignment',
      title: 'Realign brand to target ICP',
      description: 'Adjust messaging, tone, and examples to better resonate with ideal customer profile',
      reasoning: `Audience alignment score is ${diagnostic.audienceFit.alignmentScore}/100. ${diagnostic.audienceFit.misalignmentNotes.join('; ')}`,
      linkedFindings: ['audience-fit'],
    });
  }

  return changes;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function themeToDimension(theme: string): BrandDimension {
  const mapping: Record<string, BrandDimension> = {
    clarity: 'messaging',
    differentiation: 'positioning',
    trust: 'trust',
    coherence: 'identity',
    visual: 'visual',
    story: 'messaging',
  };
  return mapping[theme] || 'identity';
}

function riskTypeToDimension(riskType: string): BrandDimension {
  const mapping: Record<string, BrandDimension> = {
    confusion: 'messaging',
    misalignment: 'audience_fit',
    generic_positioning: 'positioning',
    trust: 'trust',
    inconsistency: 'identity',
  };
  return mapping[riskType] || 'identity';
}

function inconsistencyTypeToDimension(type: string): BrandDimension {
  const mapping: Record<string, BrandDimension> = {
    tone: 'messaging',
    visual: 'visual',
    promise: 'identity',
    audience: 'audience_fit',
    offer: 'positioning',
  };
  return mapping[type] || 'identity';
}
