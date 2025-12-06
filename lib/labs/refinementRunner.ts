// lib/labs/refinementRunner.ts
// Unified Lab Refinement Runner
//
// Runs Labs in refinement mode:
// 1. Loads Brain-first context
// 2. Builds refinement prompt
// 3. Calls AI with refinement instructions
// 4. Parses and validates response
// 5. Applies refinements to Context Graph

import { aiForCompany } from '@/lib/ai-gateway/aiClient';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getRefinementLabContext,
  buildRefinementPromptContext,
  buildRefinementResponseFormat,
  type RefinementLabContext,
} from './context';
import {
  applyLabRefinements,
  formatApplyResultSummary,
  createApplyDiagnostics,
} from './refinementWriter';
import {
  parseLabRefinementResponse,
  createEmptyRefinementResult,
  addDiagnostic,
  type LabRefinementResult,
  type LabRefinementRunResult,
  type RefinementLabId,
  type LabRefinementInput,
} from './refinementTypes';

// Re-export types for convenience
export type { LabRefinementResult, LabRefinementRunResult, RefinementLabId, LabRefinementInput };

// ============================================================================
// Lab-Specific Prompts
// ============================================================================

const LAB_SYSTEM_PROMPTS: Record<RefinementLabId, string> = {
  audience: `You are an expert audience strategist AI operating in REFINEMENT MODE.

Your expertise includes:
- B2B and B2C audience segmentation
- ICP (Ideal Customer Profile) development
- Buyer persona creation
- Jobs-to-be-done analysis
- Demand state mapping

When refining audience context:
- Preserve existing ICP definitions unless clearly incorrect
- Refine segments to be more specific and actionable
- Add missing pain points, motivations, or objections
- Ensure consistency between audience fields
- Never create audiences outside the established ICP`,

  brand: `You are an expert brand strategist AI operating in REFINEMENT MODE.

Your expertise includes:
- Brand positioning and differentiation
- Value proposition development
- Brand voice and tone definition
- Messaging architecture
- Competitive positioning and analysis

When refining brand context:
- Preserve strong existing positioning unless clearly incorrect
- Strengthen value propositions with specificity
- Ensure tone of voice is consistent and actionable
- Add missing differentiators or proof points
- Connect brand to audience pain points

When refining competitive context:
- Do NOT propose competitors - that is handled by Competitor Lab
- Propose primary and secondary positioning axes appropriate for the company's market
- Suggest initial axis positions (0-100) for the company (ownPositionPrimary, ownPositionSecondary)
- Provide a positioning summary that explains the company's differentiation`,

  creative: `You are an expert creative strategist AI operating in REFINEMENT MODE.

Your expertise includes:
- Messaging architecture development (core value prop, key pillars, supporting points)
- Proof point articulation and evidence hierarchy
- Feature-to-benefit mapping
- Tagline and headline development
- Segment-specific messaging adaptation
- Call-to-action optimization
- Channel-specific creative adaptation

When refining creative context:
- Preserve existing messaging that aligns with brand/audience
- Strengthen proof points with specificity
- Ensure messages address audience pain points
- Add missing CTAs or proof points
- Make messaging more actionable for creative execution

When refining messaging architecture (creative.messaging):
- Ensure coreValueProp is clear, compelling, and differentiated
- Add keyPillars (3-5) that support the core value prop
- Add supportingPoints that provide evidence for each pillar
- Add proofPoints with specific stats, testimonials, or evidence
- Create featureToBenefitMap entries linking features to customer benefits
- Suggest taglineVariants for different contexts and channels

When refining segment messages (creative.segmentMessages):
- For each audience segment, provide tailored messaging
- Include segment-specific value prop, pains addressed, and outcomes
- Add objection handling for common segment-specific objections
- Provide example headlines and CTAs optimized for each segment`,

  competitor: `You are an expert competitive intelligence AI operating in REFINEMENT MODE.

Your expertise includes:
- Competitive landscape analysis and competitor profiling
- Market positioning and differentiation strategy
- Feature matrix development and comparison
- Pricing landscape analysis and classification
- Messaging overlap analysis and differentiation
- Threat modeling and trajectory assessment
- Market cluster analysis
- Substitute/category-creep detection
- Whitespace opportunity identification

When refining competitive context:
- Identify and profile key competitors (direct, indirect, aspirational, emerging)
- Define positioning axes relevant to the market (use -100 to +100 scale)
- Map competitors and the company on the positioning map
- Build feature matrix comparing key capabilities
- Classify pricing tiers and value-for-money scores
- Analyze messaging overlap and suggest differentiation
- Model threats with trajectory (rising/falling/stagnant)
- Group competitors into strategic clusters
- Identify substitutes and category alternatives
- Identify whitespace opportunities with map positions
- Calculate data confidence scores

IMPORTANT RULES:
- Use -100 to +100 for x/y positions (NOT 0-100)
- Never overwrite human/manual/QBR fields
- Deduplicate competitors - same company shouldn't appear twice
- Assign threat levels (0-100) based on features + messaging + price + brand
- Populate at least 3 whitespace opportunities
- Every competitor needs trajectory and threat assessment`,

  website: `You are an expert website UX and conversion optimization AI operating in REFINEMENT MODE.

Your expertise includes:
- Website UX analysis and conversion optimization
- Landing page effectiveness assessment
- Funnel analysis and conversion path mapping
- Call-to-action optimization
- Value proposition clarity on web pages
- Mobile experience evaluation
- Form and contact experience assessment
- Trust signal identification and recommendations

When refining website context:
- Analyze website structure and conversion paths
- Identify specific conversion blockers and friction points
- Suggest concrete quick wins for immediate improvement
- Evaluate value proposition clarity as presented on the website
- Assess landing page quality and form experiences
- Document critical issues that impact conversion
- Provide actionable recommendations with priority

IMPORTANT RULES:
- Never overwrite human/manual/QBR/strategy/setup_wizard/gap_heavy sources
- Only refine fields in the "website" LAB_FIELD_SCOPES
- Focus on conversion effectiveness and user experience
- Prefer short, concrete descriptions over vague statements
- Do NOT invent numeric business goals or revenue targets
- Do NOT change company identity, offers, or pricing
- Only assess how the business is presented on the website`,
};

const LAB_TASK_PROMPTS: Record<RefinementLabId, string> = {
  audience: `Analyze the current audience context and refine it:

1. Review the existing ICP, segments, pain points, and motivations
2. Identify any gaps, inconsistencies, or areas for improvement
3. Propose refinements that make the audience context more actionable

Focus areas for audience refinement:
- audience.primaryAudience: Is it clear and specific?
- audience.coreSegments: Are they distinct and actionable?
- audience.segmentDetails: Detailed descriptions of each segment?
- audience.painPoints: Are they specific to this audience?
- audience.motivations: Do they connect to the product/service?
- audience.behavioralDrivers: What behaviors indicate readiness?
- audience.demandStates: Awareness, consideration, decision states?
- audience.primaryBuyerRoles: Key decision makers and influencers?`,

  brand: `Analyze the current brand context and refine it:

1. Review the existing positioning, value props, and tone
2. Identify any gaps, inconsistencies, or areas for improvement
3. Propose refinements that make the brand context more actionable
4. Review and refine competitive landscape if needed

Focus areas for brand refinement:
- brand.positioning: Is it clear and differentiated?
- brand.valueProps: Are they specific and provable?
- brand.differentiators: Are they truly unique?
- brand.toneOfVoice: Is it specific and actionable?
- brand.messagingPillars: Do they support the positioning?

Focus areas for competitive refinement (DO NOT propose competitors - use Competitor Lab for that):
- competitive.positioningAxes: Propose axes if missing:
  * primaryAxis: { label, lowLabel, highLabel, description }
  * secondaryAxis: { label, lowLabel, highLabel, description }
- competitive.ownPositionPrimary: Company's position on primary axis (0-100)
- competitive.ownPositionSecondary: Company's position on secondary axis (0-100)
- competitive.positioningSummary: 2-3 sentence summary of competitive positioning`,

  creative: `Analyze the current creative context and refine it:

1. Review the existing messaging architecture and refine it
2. Review segment-specific messaging and add/refine as needed
3. Identify any gaps, inconsistencies, or areas for improvement
4. Propose refinements that make the creative context more actionable

Focus areas for messaging architecture (creative.messaging):
- creative.messaging.coreValueProp: The single most compelling reason to choose
- creative.messaging.keyPillars: 3-5 key messaging pillars supporting the value prop
- creative.messaging.supportingPoints: Evidence points for each pillar
- creative.messaging.proofPoints: Specific stats, testimonials, case studies
- creative.messaging.differentiators: Key differentiators from competitors
- creative.messaging.taglineVariants: 3-5 tagline options for different contexts
- creative.messaging.featureToBenefitMap: Array of { feature, benefit, forSegment }

Focus areas for segment messaging (creative.segmentMessages):
For each audience segment, provide a SegmentMessage object:
- valueProp: Segment-specific value proposition
- painsAddressed: Array of pains this segment experiences
- outcomes: Array of desired outcomes for this segment
- objections: Record<objection, response> for common objections
- exampleHeadlines: 3-5 headlines that resonate with this segment
- ctas: 2-3 recommended CTAs for this segment

Focus areas for legacy creative refinement:
- creative.coreMessages: Key messages for general use
- creative.proofPoints: Evidence supporting claims
- creative.callToActions: Clear, actionable CTAs`,

  competitor: `Analyze the current competitive context and refine it comprehensively:

1. Review existing competitors, positioning, features, pricing, and threats
2. Identify gaps, inconsistencies, or areas for improvement
3. Propose refinements across ALL competitive dimensions

## Competitor Profiles (competitive.competitors)
For each competitor provide:
- name, domain, category (direct|indirect|aspirational|emerging)
- positioning: Their market positioning statement
- strengths: 2-5 key strengths (array)
- weaknesses: 2-5 key weaknesses (array)
- uniqueClaims: Claims they make (array)
- offers: Products/services (array)
- xPosition: Position on primary axis (-100 to +100)
- yPosition: Position on secondary axis (-100 to +100)
- confidence: Data confidence (0-1)
- trajectory: "rising" | "falling" | "stagnant"
- trajectoryReason: Why they have this trajectory
- threatLevel: 0-100
- threatDrivers: Array of specific threat drivers

## Positioning Map
- competitive.primaryAxis: "Label ↔ Opposite" format (e.g., "Premium ↔ Budget")
- competitive.secondaryAxis: "Label ↔ Opposite" format
- competitive.positionSummary: 2-3 sentences on company's position
- competitive.positioningAxes: Structured axis definitions with labels

## Feature Matrix (competitive.featuresMatrix)
Array of features with:
- featureName, description, companySupport (bool)
- competitors: [{ name, hasFeature, notes }]
- importance: 0-100

## Pricing Landscape (competitive.pricingModels)
Array of pricing models with:
- competitorName, priceTier (low|medium|high|premium|enterprise)
- pricingNotes, inferredPricePoint, valueForMoneyScore (0-100)
- modelType (subscription|one-time|freemium|usage-based)
Also set: competitive.ownPriceTier

## Messaging Overlap (competitive.messageOverlap)
Array of messaging themes with:
- theme, competitorsUsingIt (array), overlapScore (0-100)
- suggestion for differentiation, companyUsing (bool)
Also set: competitive.messagingDifferentiationScore (0-100)

## Market Clusters (competitive.marketClusters)
Array of clusters with:
- clusterName, description, competitors (array)
- clusterPosition: { x, y }, threatLevel (0-100)
- whitespaceOpportunity (string or null)

## Threat Modeling (competitive.threatScores)
Array of detailed threat scores with:
- competitorName, threatLevel (0-100)
- threatDrivers (array), timeHorizon (immediate|6-month|1-year|long-term)
- defensiveActions (array of recommended actions)
Also set: competitive.overallThreatLevel (0-100)

## Substitutes (competitive.substitutes)
Array of substitute solutions with:
- name, domain, reasonCustomersChooseThem
- category (DIY|Service|Status Quo|Adjacent Category)
- threatLevel (0-100), counterStrategy

## Whitespace Opportunities (competitive.whitespaceMap)
Array of structured opportunities with:
- name, description, position: { x, y }
- size (0-100), strategicFit (0-100)
- captureActions (array of actions to capture)

## Other Fields
- competitive.competitiveAdvantages: Array of advantages
- competitive.competitiveThreats: Array of threats (strings)
- competitive.competitiveOpportunities: Array of opportunities
- competitive.marketTrends: Array of relevant trends
- competitive.differentiationStrategy: Overall strategy statement
- competitive.dataConfidence: Overall data confidence (0-1)`,

  website: `Analyze the current website context and refine it comprehensively:

1. Review existing website analysis, conversion data, and UX insights
2. Identify gaps, inconsistencies, or areas for improvement
3. Propose refinements that make the website context more actionable

## Website Summary & Health (website.websiteSummary, website.executiveSummary)
- Provide a clear, concise summary of overall website health
- Executive summary should be 2-3 sentences for stakeholders
- Include key metrics interpretation (scores, vitals)

## Conversion Analysis
- website.conversionBlocks: Array of specific blockers preventing conversion
  * Be specific: "Contact form requires 8+ fields" not just "form friction"
  * Include the page/location where blocker exists
- website.conversionOpportunities: Array of opportunities to improve conversion
  * Actionable suggestions with expected impact
- website.funnelIssues: Array of funnel-specific issues
  * Include severity (critical/high/medium/low) and impact

## Critical Issues & Quick Wins
- website.criticalIssues: Array of urgent issues needing immediate attention
  * Focus on issues that significantly impact UX or conversion
- website.quickWins: Array of low-effort, high-impact improvements
  * Things that can be fixed quickly with meaningful results
- website.recommendations: Array of prioritized recommendations
  * More comprehensive than quick wins, can include larger initiatives

## Page-Level Analysis
- website.pageAssessments: Array of page assessments with:
  * url: The page URL
  * pageType: "homepage" | "landing" | "product" | "pricing" | "contact" | "other"
  * score: 0-100 assessment score
  * issues: Array of specific issues on this page
  * recommendations: Array of recommendations for this page

## UX Elements
- website.landingPageQuality: Assessment of landing page effectiveness
- website.formExperience: Assessment of form/contact experience
- website.hasContactForm: boolean - whether contact forms are present
- website.hasPhoneNumbers: boolean - whether phone numbers are visible
- website.hasLiveChat: boolean - whether live chat is available
- website.hasChatbot: boolean - whether chatbot is present
- website.mobileResponsive: boolean - whether site is mobile-responsive
- website.infraNotes: Array of infrastructure/technical observations`,
};

// ============================================================================
// Main Runner
// ============================================================================

/**
 * Run a Lab in refinement mode
 *
 * This is the main entry point for refinement-mode Lab runs.
 */
export async function runLabRefinement(
  input: LabRefinementInput
): Promise<LabRefinementRunResult> {
  const { companyId, labId, forceRun, dryRun, maxRefinements } = input;
  const startTime = Date.now();
  const runAt = new Date().toISOString();

  console.log(`[LabRefinement] Starting ${labId} refinement for ${companyId}`);

  try {
    // 1. Load company
    const company = await getCompanyById(companyId);
    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    // 2. Load Brain-first context
    const context = await getRefinementLabContext(companyId, labId);

    console.log(`[LabRefinement] Context loaded:`, {
      populatedFields: context.populatedFields.length,
      emptyFields: context.emptyFields.length,
      completeness: context.labHealth.completeness,
    });

    // 3. Check if refinement is needed
    if (!forceRun && context.labHealth.completeness > 90) {
      console.log(`[LabRefinement] Context already complete (${context.labHealth.completeness}%), skipping`);
      return {
        refinement: createEmptyRefinementResult(),
        applyResult: null,
        labId,
        companyId,
        runAt,
        durationMs: Date.now() - startTime,
      };
    }

    // 4. Build refinement prompt
    const refinementContext = buildRefinementPromptContext(context, labId);
    const responseFormat = buildRefinementResponseFormat();

    const systemPrompt = LAB_SYSTEM_PROMPTS[labId];
    const taskPrompt = `${LAB_TASK_PROMPTS[labId]}

${refinementContext}

${responseFormat}`;

    // 5. Call AI
    console.log(`[LabRefinement] Calling AI for ${labId} refinement...`);
    const aiResponse = await aiForCompany(companyId, {
      type: 'Strategy', // Use existing MemoryEntryType
      tags: [`${labId}-lab`, 'refinement'],
      systemPrompt,
      taskPrompt,
      model: 'gpt-4o',
      temperature: 0.3,
      jsonMode: true,
      maxTokens: 4000,
    });

    // 6. Parse response
    let refinement: LabRefinementResult;
    try {
      refinement = parseLabRefinementResponse(aiResponse.content);
    } catch (parseError) {
      console.error(`[LabRefinement] Failed to parse AI response:`, parseError);
      refinement = createEmptyRefinementResult();
      addDiagnostic(refinement, 'parse_error', 'Failed to parse AI response', 'error');
    }

    // 7. Limit refinements if requested
    if (maxRefinements && refinement.refinedContext.length > maxRefinements) {
      // Sort by confidence and take top N
      refinement.refinedContext = refinement.refinedContext
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxRefinements);
    }

    console.log(`[LabRefinement] AI proposed ${refinement.refinedContext.length} refinements`);

    // 8. Apply refinements
    const applyResult = await applyLabRefinements(companyId, labId, refinement, {
      runId: `${labId}-refinement-${Date.now()}`,
      dryRun,
      debug: true,
    });

    // 9. Add apply diagnostics to result
    refinement.diagnostics.push(...createApplyDiagnostics(applyResult));

    console.log(`[LabRefinement] ${labId} complete: ${formatApplyResultSummary(applyResult)}`);

    return {
      refinement,
      applyResult: dryRun ? null : applyResult,
      labId,
      companyId,
      runAt,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error(`[LabRefinement] ${labId} failed:`, error);

    const refinement = createEmptyRefinementResult();
    addDiagnostic(
      refinement,
      'run_error',
      error instanceof Error ? error.message : 'Unknown error',
      'error'
    );

    return {
      refinement,
      applyResult: null,
      labId,
      companyId,
      runAt,
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Run Audience Lab in refinement mode
 */
export async function runAudienceLabRefinement(
  companyId: string,
  options?: { forceRun?: boolean; dryRun?: boolean }
): Promise<LabRefinementRunResult> {
  return runLabRefinement({
    companyId,
    labId: 'audience',
    ...options,
  });
}

/**
 * Run Brand Lab in refinement mode
 */
export async function runBrandLabRefinement(
  companyId: string,
  options?: { forceRun?: boolean; dryRun?: boolean }
): Promise<LabRefinementRunResult> {
  return runLabRefinement({
    companyId,
    labId: 'brand',
    ...options,
  });
}

/**
 * Run Creative Lab in refinement mode
 */
export async function runCreativeLabRefinement(
  companyId: string,
  options?: { forceRun?: boolean; dryRun?: boolean }
): Promise<LabRefinementRunResult> {
  return runLabRefinement({
    companyId,
    labId: 'creative',
    ...options,
  });
}

/**
 * Run Competitor Lab in refinement mode
 */
export async function runCompetitorLabRefinementGeneric(
  companyId: string,
  options?: { forceRun?: boolean; dryRun?: boolean }
): Promise<LabRefinementRunResult> {
  return runLabRefinement({
    companyId,
    labId: 'competitor',
    ...options,
  });
}

/**
 * Run Website Lab in refinement mode
 */
export async function runWebsiteLabRefinementGeneric(
  companyId: string,
  options?: { forceRun?: boolean; dryRun?: boolean }
): Promise<LabRefinementRunResult> {
  return runLabRefinement({
    companyId,
    labId: 'website',
    ...options,
  });
}

/**
 * Run all refinement Labs in sequence
 */
export async function runAllLabRefinements(
  companyId: string,
  options?: { forceRun?: boolean; dryRun?: boolean }
): Promise<Record<RefinementLabId, LabRefinementRunResult>> {
  const results: Partial<Record<RefinementLabId, LabRefinementRunResult>> = {};

  // Run in recommended order: Audience → Brand → Creative → Competitor → Website
  // (Creative depends on Brand, Brand benefits from Audience, Competitor uses all, Website last)
  results.audience = await runAudienceLabRefinement(companyId, options);
  results.brand = await runBrandLabRefinement(companyId, options);
  results.creative = await runCreativeLabRefinement(companyId, options);
  results.competitor = await runCompetitorLabRefinementGeneric(companyId, options);
  results.website = await runWebsiteLabRefinementGeneric(companyId, options);

  return results as Record<RefinementLabId, LabRefinementRunResult>;
}
