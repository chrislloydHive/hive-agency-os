// lib/os/context/extractors/index.ts
// Canonical Context Field Extractors
//
// These extractors pull canonical context TEXT fields from lab outputs.
// The orchestrator uses these to populate predetermined fields for Strategy Frame.
//
// Key principles:
// - Extract facts with provenance, not scores or recommendations
// - Include evidence strings for audit trail
// - Quality validation happens in upsert (min length, placeholder rejection)
// - Only extract if we have meaningful, specific content

import type { CanonicalFieldKey, ContextFieldCandidate, ContextFieldSource } from '../schema';
import type { BrandLabResult } from '@/lib/diagnostics/brand-lab/types';
import type { LabId } from '@/lib/contextGraph/labContext';

// ============================================================================
// Extraction Context - Controls filter strictness
// ============================================================================

/**
 * Context for extraction that controls how strict quality filters are.
 *
 * During baseline context formation (new companies, first GAP run), we allow
 * broader, descriptive content. During refinement, we enforce strict uniqueness.
 */
export type ExtractionContext = {
  /** Whether company has prior confirmed context */
  companyStage: 'new' | 'existing';
  /** Business model affects what "generic" means */
  businessModel?: 'b2b' | 'b2c' | 'local';
  /** Purpose of this extraction run */
  runPurpose: 'baseline' | 'refinement';
};

/**
 * Default extraction context (strict mode for backwards compatibility)
 */
const DEFAULT_EXTRACTION_CONTEXT: ExtractionContext = {
  companyStage: 'existing',
  runPurpose: 'refinement',
};

/**
 * Check if we're in baseline mode (more lenient filtering)
 */
function isBaselineMode(ctx: ExtractionContext): boolean {
  return ctx.runPurpose === 'baseline' && ctx.companyStage === 'new';
}

/**
 * Check if we should use lenient B2C/local filtering
 * Note: Named without "use" prefix to avoid React hook naming convention
 */
function isLenientFilteringMode(ctx: ExtractionContext): boolean {
  return isBaselineMode(ctx) && ctx.businessModel !== 'b2b';
}

/**
 * Create evidence string with baseline provenance marker if applicable.
 * This allows tracking of which fields were accepted with relaxed criteria
 * for later review/refinement.
 */
function withBaselineProvenance(
  evidence: string,
  ctx: ExtractionContext
): string {
  if (isLenientFilteringMode(ctx)) {
    return `${evidence} [baseline-lenient: ${ctx.businessModel || 'unknown'}]`;
  }
  return evidence;
}

/**
 * EVALUATION PATTERNS - Text that describes quality/state rather than actual content
 * These are meta-comments from labs about what they found, NOT actual business facts
 */
const EVALUATION_PATTERNS = [
  // Quality assessments
  /is present but/i,
  /could be (sharper|clearer|stronger|better|more)/i,
  /is (partially|somewhat|fairly|moderately) (defined|clear|developed)/i,
  /is not (immediately |clearly )?(clear|defined|obvious)/i,
  /has gaps in/i,
  /could better align/i,
  /needs? (more|to be|improvement)/i,
  /should (be|have|include)/i,
  // Meta-commentary
  /differentiation is not/i,
  /messaging (is|could|should)/i,
  /positioning (is|could|should)/i,
  /audience (is|could|should)/i,
  /brand (is|could|should)/i,
  // Score/status indicators
  /\(score:/i,
  /status:/i,
  /serviceable but/i,
  // Generic dimension summaries
  /^(some|partial|moderate|weak|strong)\s+(brand|messaging|positioning|audience)/i,
];

/**
 * GENERIC CONTENT PATTERNS - Content that's too vague to be useful
 */
const GENERIC_PATTERNS = [
  // Generic adjectives without specifics
  /^(professional|friendly|warm|approachable)\s+(and|yet)\s+\w+$/i,
  /^focus on (innovation|quality|customer)/i,
  /^(customer|client)-centric approach$/i,
  /^(innovative|cutting-edge|industry-leading)/i,
  // Placeholder-style content
  /^differentiators?:/i,
  /^(primary|core|key)\s+(focus|value|offering)/i,
];

/**
 * BUZZWORD PATTERNS - Pure buzzword combinations that aren't real positioning
 * These are combinations of vague terms without specifics
 */
const BUZZWORD_ONLY_PATTERNS = [
  // "X and Y" buzzword combos
  /^(innovation|quality|excellence|trust|integrity|customer)[- ]?(and|&)[- ]?(innovation|quality|excellence|customer|centricity|focus|service)$/i,
  // Single buzzwords or short buzzword phrases
  /^(innovation|quality|excellence|customer.?centric|customer.?first|people.?first|results.?driven)$/i,
  // "Noun-Noun" buzzword combos (e.g. "Innovation and Customer-Centricity")
  /^[A-Z][a-z]+\s+(and|&)\s+[A-Z][a-z]+(-[A-Z][a-z]+)?$/,
];

/**
 * GENERIC POSITIONING PATTERNS - Longer generic statements that sound like positioning but aren't
 * Real positioning: "The go-to CRM for B2B SaaS startups who need pipeline visibility"
 * Generic positioning: "Solutions provider with a focus on innovation and customer needs"
 */
const GENERIC_POSITIONING_PATTERNS = [
  // "X provider" without specifics
  /^(solutions?|services?|products?)\s+provider/i,
  // "focus on X and Y" generic
  /focus on\s+(innovation|quality|customer|excellence|service)/i,
  // "customer needs" without specifics
  /customer (needs|satisfaction|success|experience)$/i,
  // "delivering/providing X solutions"
  /(delivering|providing)\s+(innovative|quality|best|excellent)?\s*(solutions?|services?|products?)/i,
  // "committed to X"
  /committed to\s+(excellence|quality|innovation|customer)/i,
  // "leading/premier X"
  /^(a |the )?(leading|premier|top)\s+(provider|company|firm|agency)/i,
];

/**
 * PLACEHOLDER PATTERNS - LLM-generated placeholder text that shouldn't be stored
 */
const PLACEHOLDER_TEXT_PATTERNS = [
  /^website does not specify/i,
  /^not specified/i,
  /^unable to determine/i,
  /^no (clear|specific|explicit)/i,
  /^cannot (determine|identify|find)/i,
  /^information not (available|found|provided)/i,
];

/**
 * GENERIC ICP PATTERNS - Vague audience descriptions without specifics
 * Real ICPs need: industry, company size, job title/role, or specific pain
 */
const GENERIC_ICP_PATTERNS = [
  // "Organizations/businesses/companies seeking/looking for X"
  /^(organizations?|businesses?|companies?|clients?|customers?)\s+(seeking|looking for|wanting|needing)/i,
  // "Tech-savvy X" or "forward-thinking X" without specifics
  /^(tech-savvy|forward-thinking|growth-minded|innovative)\s+(organizations?|businesses?|companies?|teams?)/i,
  // "X who want/need Y" without role/industry specifics
  /^(people|professionals?|leaders?|teams?)\s+(who|that)\s+(want|need|seek|are looking)/i,
  // Generic industry terms without specifics
  /^(small|medium|large|enterprise)\s+(businesses?|companies?|organizations?)$/i,
];

/**
 * Helper to check if a value is meaningful (not just a generic placeholder or evaluation)
 *
 * @param value - The value to check
 * @param minLength - Minimum length requirement
 * @param ctx - Extraction context for controlling strictness
 */
function isQualityValue(
  value: unknown,
  minLength = 15,
  ctx: ExtractionContext = DEFAULT_EXTRACTION_CONTEXT
): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < minLength) return false;

  const lenient = isLenientFilteringMode(ctx);

  // ALWAYS reject placeholder patterns (even in baseline mode)
  const placeholderPatterns = [
    /^(N\/A|TBD|TODO|Unknown|None|Missing)/i,
    /^(strong|clear|good)\s+/i,
    /^AI\s+(can|will)/i,
  ];
  if (placeholderPatterns.some(p => p.test(trimmed))) return false;

  // ALWAYS reject LLM-generated placeholder text
  if (PLACEHOLDER_TEXT_PATTERNS.some(p => p.test(trimmed))) {
    console.log(`[Extractor] Rejected placeholder text: "${trimmed.slice(0, 60)}..."`);
    return false;
  }

  // ALWAYS reject evaluation-style content (meta-commentary about quality)
  if (EVALUATION_PATTERNS.some(p => p.test(trimmed))) {
    console.log(`[Extractor] Rejected evaluation text: "${trimmed.slice(0, 60)}..."`);
    return false;
  }

  // In baseline B2C mode, allow broader descriptive content
  if (!lenient) {
    // Reject generic content (strict mode only)
    if (GENERIC_PATTERNS.some(p => p.test(trimmed))) {
      console.log(`[Extractor] Rejected generic text: "${trimmed.slice(0, 60)}..."`);
      return false;
    }
  }

  // ALWAYS reject pure buzzword combinations (e.g. "Innovation and Customer-Centricity")
  if (BUZZWORD_ONLY_PATTERNS.some(p => p.test(trimmed))) {
    console.log(`[Extractor] Rejected buzzword-only text: "${trimmed}"`);
    return false;
  }

  return true;
}

/**
 * Specialized check for ICP/audience values - requires specificity
 * Good: "B2B SaaS companies with 50-500 employees in fintech"
 * Bad: "Tech-savvy organizations seeking innovative solutions"
 *
 * In baseline B2C/local mode, accepts broader audience descriptions:
 * - Category-level descriptions ("pet owners", "homeowners")
 * - Regional focus ("local families", "San Diego residents")
 * - Product-based audiences ("dog food buyers")
 */
function isQualityICP(
  value: unknown,
  ctx: ExtractionContext = DEFAULT_EXTRACTION_CONTEXT
): value is string {
  if (!isQualityValue(value, 20, ctx)) return false;
  const trimmed = (value as string).trim();

  const lenient = isLenientFilteringMode(ctx);

  // In strict mode, reject generic ICP patterns
  if (!lenient) {
    if (GENERIC_ICP_PATTERNS.some(p => p.test(trimmed))) {
      console.log(`[Extractor] Rejected generic ICP: "${trimmed}"`);
      return false;
    }

    // Require at least ONE specificity indicator in strict mode:
    // - Numbers (50-500, $1M+, etc.)
    // - Industry terms (SaaS, fintech, healthcare, retail, etc.)
    // - Role/title terms (CEO, CMO, founder, marketing director, etc.)
    // - Company stage/size (startup, enterprise, Series A, etc.)
    const specificityIndicators = [
      /\d+/,  // Has numbers
      /\b(saas|b2b|b2c|fintech|healthcare|retail|ecommerce|e-commerce|manufacturing|logistics|tech|software)\b/i,
      /\b(ceo|cmo|cfo|cto|founder|director|manager|vp|head of|chief)\b/i,
      /\b(startup|enterprise|smb|mid-market|series [a-d]|seed|growth stage|early stage)\b/i,
    ];

    const hasSpecificity = specificityIndicators.some(p => p.test(trimmed));
    if (!hasSpecificity) {
      console.log(`[Extractor] Rejected ICP without specificity indicators: "${trimmed.slice(0, 60)}..."`);
      return false;
    }
  } else {
    // In baseline B2C/local mode, accept if it has ANY meaningful descriptor
    // Allow: "pet owners in San Diego", "families with dogs", "local homeowners"
    const minimalQuality = [
      /\b(owner|buyer|customer|consumer|family|families|resident|local)\b/i,
      /\b(who|that|with|seeking|looking|need)\b/i,
      /\b(pet|dog|cat|home|car|food|health|fitness|beauty)\b/i,
    ];

    const hasMinimalDescriptor = minimalQuality.some(p => p.test(trimmed));
    if (!hasMinimalDescriptor) {
      console.log(`[Extractor] Rejected ICP in lenient mode (no descriptors): "${trimmed.slice(0, 60)}..."`);
      return false;
    }
  }

  return true;
}

/**
 * Specialized check for positioning values - requires who/what/why structure
 * Good: "The go-to CRM for B2B SaaS startups who need pipeline visibility"
 * Bad: "Innovation and Customer-Centricity"
 * Bad: "Solutions provider with a focus on innovation and customer needs"
 *
 * In baseline B2C/local mode, accepts broader positioning:
 * - Category leadership ("San Diego's premier pet food store")
 * - Product-based ("Premium dog food delivered to your door")
 * - Local focus ("Family-owned since 1985, serving the Bay Area")
 */
function isQualityPositioning(
  value: unknown,
  ctx: ExtractionContext = DEFAULT_EXTRACTION_CONTEXT
): value is string {
  if (!isQualityValue(value, 25, ctx)) return false;
  const trimmed = (value as string).trim();

  const lenient = isLenientFilteringMode(ctx);

  // ALWAYS reject pure buzzword combinations (e.g. "Innovation and Customer-Centricity")
  if (BUZZWORD_ONLY_PATTERNS.some(p => p.test(trimmed))) {
    console.log(`[Extractor] Rejected buzzword positioning: "${trimmed}"`);
    return false;
  }

  // In strict mode, reject generic positioning patterns
  if (!lenient) {
    if (GENERIC_POSITIONING_PATTERNS.some(p => p.test(trimmed))) {
      console.log(`[Extractor] Rejected generic positioning: "${trimmed}"`);
      return false;
    }

    // Positioning should be a phrase/sentence, not just 2-3 words
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < 5) {
      console.log(`[Extractor] Rejected positioning (too short, ${wordCount} words): "${trimmed}"`);
      return false;
    }
  } else {
    // In baseline B2C/local mode, allow shorter positioning but require SOME substance
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < 3) {
      console.log(`[Extractor] Rejected positioning in lenient mode (too short, ${wordCount} words): "${trimmed}"`);
      return false;
    }

    // Allow category-level positioning for B2C/local
    // Accept: "Premium pet food store", "Your local dog food experts"
    // Still reject completely generic: "Solutions provider"
    const categoryIndicators = [
      /\b(store|shop|service|provider|expert|specialist|company)\b/i,
      /\b(premium|quality|local|family|trusted|professional)\b/i,
      /\b(pet|dog|cat|food|health|home|auto|beauty|fitness)\b/i,
    ];

    const hasCategoryContext = categoryIndicators.some(p => p.test(trimmed));
    if (!hasCategoryContext) {
      console.log(`[Extractor] Rejected positioning in lenient mode (no category context): "${trimmed}"`);
      return false;
    }
  }

  return true;
}

// ============================================================================
// Extractor Results
// ============================================================================

export interface ExtractionResult {
  fields: ContextFieldCandidate[];
  labId: LabId;
  runId: string;
}

// ============================================================================
// Brand Lab Extractor
// ============================================================================

/**
 * Extract canonical fields from Brand Lab output.
 *
 * NEW CANONICAL FINDINGS PATHS (preferred):
 * - findings.positioning.statement - customer-facing positioning
 * - findings.valueProp.headline + description - value proposition
 * - findings.differentiators.bullets - array of differentiators
 * - findings.icp.primaryAudience - target audience
 * - findings.toneOfVoice.descriptor - brand tone
 *
 * FALLBACK PATHS (legacy diagnostic structure):
 * - diagnostic.positioning.positioningTheme
 * - diagnostic.audienceFit.primaryICPDescription
 * - diagnostic.messagingSystem.valueProps[]
 * - diagnostic.messagingSystem.differentiators[]
 * - diagnostic.identitySystem.toneOfVoice
 *
 * Brand Lab populates:
 * - positioning (required for strategy)
 * - value_prop (required for strategy)
 * - differentiators (required for strategy)
 * - audience_icp_primary (required for strategy)
 * - brand_tone (optional)
 */
export function extractFromBrandLab(
  data: BrandLabResult,
  runId: string,
  ctx: ExtractionContext = DEFAULT_EXTRACTION_CONTEXT
): ExtractionResult {
  const fields: ContextFieldCandidate[] = [];

  // Access canonical findings (new structure) or diagnosticV1 (legacy fallback)
  const findings = data.findings;
  const diagnostic = data.findings?.diagnosticV1 || data;

  // ========== POSITIONING ==========
  // Prefer: findings.positioning.statement
  // Fallback: diagnostic.positioning.positioningTheme
  const positioningStatement = findings?.positioning?.statement;
  const positioningConfidence = findings?.positioning?.confidence || 0.7;

  if (isQualityPositioning(positioningStatement, ctx)) {
    fields.push({
      key: 'positioning',
      value: positioningStatement,
      confidence: positioningConfidence,
      sources: [{
        type: 'lab',
        lab: 'brand',
        runId,
        evidence: withBaselineProvenance('Extracted from findings.positioning.statement', ctx),
      }],
    });
  } else if (positioningStatement) {
    console.log(`[BrandLabExtractor] Rejected positioning as low quality: "${positioningStatement}"`);
    // Try fallback from diagnostic
    const fallbackPositioning = (diagnostic as any)?.positioning?.positioningTheme;
    if (isQualityPositioning(fallbackPositioning, ctx)) {
      fields.push({
        key: 'positioning',
        value: fallbackPositioning,
        confidence: 0.6,
        sources: [{
          type: 'lab',
          lab: 'brand',
          runId,
          evidence: withBaselineProvenance('Fallback from diagnostic.positioning.positioningTheme', ctx),
        }],
      });
    }
  }

  // ========== VALUE PROPOSITION ==========
  // Prefer: findings.valueProp.headline + description
  // Fallback: diagnostic.messagingSystem.valueProps[0].claim
  const valuePropHeadline = findings?.valueProp?.headline;
  const valuePropDesc = findings?.valueProp?.description;
  const valuePropConfidence = findings?.valueProp?.confidence || 0.7;

  if (valuePropHeadline && isQualityValue(valuePropHeadline, 15, ctx)) {
    const fullValueProp = valuePropDesc
      ? `${valuePropHeadline} — ${valuePropDesc}`
      : valuePropHeadline;
    fields.push({
      key: 'value_prop',
      value: fullValueProp,
      confidence: valuePropConfidence,
      sources: [{
        type: 'lab',
        lab: 'brand',
        runId,
        evidence: withBaselineProvenance('Extracted from findings.valueProp', ctx),
      }],
    });
  } else {
    // Fallback to legacy path
    const legacyValueProps = (diagnostic as any)?.messagingSystem?.valueProps;
    if (legacyValueProps && Array.isArray(legacyValueProps) && legacyValueProps.length > 0) {
      const primaryClaim = legacyValueProps[0]?.claim || legacyValueProps[0]?.statement;
      if (isQualityValue(primaryClaim, 20, ctx)) {
        fields.push({
          key: 'value_prop',
          value: primaryClaim,
          confidence: 0.6,
          sources: [{
            type: 'lab',
            lab: 'brand',
            runId,
            evidence: withBaselineProvenance('Fallback from diagnostic.messagingSystem.valueProps[0]', ctx),
          }],
        });
      }
    }
  }

  // ========== DIFFERENTIATORS ==========
  // Prefer: findings.differentiators.bullets
  // Fallback: diagnostic.messagingSystem.differentiators
  const diffBullets = findings?.differentiators?.bullets;
  const diffConfidence = findings?.differentiators?.confidence || 0.7;

  if (diffBullets && Array.isArray(diffBullets) && diffBullets.length > 0) {
    // Filter out generic differentiators
    const specificDiffs = diffBullets.filter((d: unknown) => {
      if (typeof d !== 'string' || d.length < 10) return false;
      const genericPhrases = [
        /^focus on/i,
        /^customer.?centric/i,
        /^innovation$/i,
        /^quality$/i,
        /^best.?in.?class/i,
      ];
      return !genericPhrases.some(p => p.test(d.trim()));
    });

    if (specificDiffs.length > 0) {
      const diffText = specificDiffs.join('; ');
      fields.push({
        key: 'differentiators',
        value: diffText,
        confidence: diffConfidence,
        sources: [{
          type: 'lab',
          lab: 'brand',
          runId,
          evidence: withBaselineProvenance(`Extracted ${specificDiffs.length} differentiators from findings`, ctx),
        }],
      });
    }
  } else {
    // Fallback to legacy path
    const legacyDiffs = (diagnostic as any)?.messagingSystem?.differentiators;
    if (legacyDiffs && Array.isArray(legacyDiffs) && legacyDiffs.length > 0) {
      const specificDiffs = legacyDiffs.filter((d: unknown) => {
        if (typeof d !== 'string' || d.length < 10) return false;
        const genericPhrases = [/^focus on/i, /^customer.?centric/i, /^innovation$/i];
        return !genericPhrases.some(p => p.test(d.trim()));
      });
      if (specificDiffs.length > 0) {
        fields.push({
          key: 'differentiators',
          value: specificDiffs.join('; '),
          confidence: 0.6,
          sources: [{
            type: 'lab',
            lab: 'brand',
            runId,
            evidence: withBaselineProvenance('Fallback from diagnostic.messagingSystem.differentiators', ctx),
          }],
        });
      }
    }
  }

  // ========== PRIMARY AUDIENCE / ICP ==========
  // Prefer: findings.icp.primaryAudience
  // Fallback: diagnostic.audienceFit.primaryICPDescription
  const primaryAudience = findings?.icp?.primaryAudience;
  const icpConfidence = findings?.icp?.confidence || 0.7;

  if (isQualityICP(primaryAudience, ctx)) {
    fields.push({
      key: 'audience_icp_primary',
      value: primaryAudience,
      confidence: icpConfidence,
      sources: [{
        type: 'lab',
        lab: 'brand',
        runId,
        evidence: withBaselineProvenance('Extracted from findings.icp.primaryAudience', ctx),
      }],
    });
  } else if (primaryAudience) {
    console.log(`[BrandLabExtractor] Rejected ICP as low quality: "${primaryAudience}"`);
    // Try fallback from diagnostic
    const fallbackICP = (diagnostic as any)?.audienceFit?.primaryICPDescription;
    if (isQualityICP(fallbackICP, ctx)) {
      fields.push({
        key: 'audience_icp_primary',
        value: fallbackICP,
        confidence: 0.6,
        sources: [{
          type: 'lab',
          lab: 'brand',
          runId,
          evidence: withBaselineProvenance('Fallback from diagnostic.audienceFit.primaryICPDescription', ctx),
        }],
      });
    }
  } else {
    // No findings ICP, try legacy path directly
    const fallbackICP = (diagnostic as any)?.audienceFit?.primaryICPDescription;
    if (isQualityICP(fallbackICP, ctx)) {
      fields.push({
        key: 'audience_icp_primary',
        value: fallbackICP,
        confidence: 0.6,
        sources: [{
          type: 'lab',
          lab: 'brand',
          runId,
          evidence: withBaselineProvenance('Fallback from diagnostic.audienceFit.primaryICPDescription', ctx),
        }],
      });
    }
  }

  // ========== TONE OF VOICE ==========
  // Prefer: findings.toneOfVoice.descriptor
  // Fallback: diagnostic.identitySystem.toneOfVoice
  const toneDescriptor = findings?.toneOfVoice?.descriptor;
  const toneConfidence = findings?.toneOfVoice?.confidence || 0.7;

  if (toneDescriptor && isQualityValue(toneDescriptor, 10, ctx)) {
    fields.push({
      key: 'brand_tone',
      value: toneDescriptor,
      confidence: toneConfidence,
      sources: [{
        type: 'lab',
        lab: 'brand',
        runId,
        evidence: withBaselineProvenance('Extracted from findings.toneOfVoice.descriptor', ctx),
      }],
    });
  } else {
    // Fallback to legacy path
    const legacyTone = (diagnostic as any)?.identitySystem?.toneOfVoice;
    if (legacyTone && isQualityValue(legacyTone, 10, ctx)) {
      fields.push({
        key: 'brand_tone',
        value: legacyTone,
        confidence: 0.6,
        sources: [{
          type: 'lab',
          lab: 'brand',
          runId,
          evidence: withBaselineProvenance('Fallback from diagnostic.identitySystem.toneOfVoice', ctx),
        }],
      });
    }
  }

  // Extract business model and industry from identity findings
  const businessModel = (data.findings?.identitySystem as any)?.businessModel
    || (data.findings as any)?.identity?.businessModel;

  if (isQualityValue(businessModel, 5, ctx)) {
    fields.push({
      key: 'business_model',
      value: businessModel,
      confidence: 0.7,
      sources: [{
        type: 'lab',
        lab: 'brand',
        runId,
        evidence: withBaselineProvenance('Extracted from identity system', ctx),
      }],
    });
  }

  const industry = (data.findings?.identitySystem as any)?.industry
    || (data.findings as any)?.identity?.industry;

  if (isQualityValue(industry, 3, ctx)) {
    fields.push({
      key: 'industry',
      value: industry,
      confidence: 0.75,
      sources: [{
        type: 'lab',
        lab: 'brand',
        runId,
        evidence: withBaselineProvenance('Extracted from identity system', ctx),
      }],
    });
  }

  console.log(`[BrandLabExtractor] Extracted ${fields.length} canonical fields from Brand Lab`);

  return {
    fields,
    labId: 'brand',
    runId,
  };
}

// ============================================================================
// Audience Lab Extractor
// ============================================================================

/**
 * Extract canonical fields from Audience Lab output.
 *
 * Audience Lab populates:
 * - audience_icp_primary (required for strategy)
 * - audience_icp_secondary
 */
export function extractFromAudienceLab(
  data: any, // AudienceLabRefinementResult
  runId: string,
  ctx: ExtractionContext = DEFAULT_EXTRACTION_CONTEXT
): ExtractionResult {
  const fields: ContextFieldCandidate[] = [];

  // Extract from refinedContext array
  const refinedContext = data?.refinement?.refinedContext || data?.refinedContext || [];

  for (const item of refinedContext) {
    // Look for primary audience - needs to be specific and actionable
    if (item.field === 'primaryAudience' || item.field === 'primaryIcp') {
      if (isQualityICP(item.value, ctx)) {
        fields.push({
          key: 'audience_icp_primary',
          value: item.value,
          confidence: Math.min(item.confidence || 0.8, 0.9),
          sources: [{
            type: 'lab',
            lab: 'audience',
            runId,
            evidence: withBaselineProvenance(`Extracted from ${item.field} field (confidence: ${item.confidence || 'N/A'})`, ctx),
          }],
        });
      }
    }

    // Look for secondary audiences
    if (item.field === 'coreSegments' || item.field === 'secondaryAudiences') {
      const segments = Array.isArray(item.value) ? item.value : [item.value];
      const segmentText = segments
        .filter((s: any) => typeof s === 'string' && s.length > 5)
        .join('; ');

      if (isQualityValue(segmentText, 15, ctx)) {
        fields.push({
          key: 'audience_icp_secondary',
          value: segmentText,
          confidence: Math.min(item.confidence || 0.75, 0.85),
          sources: [{
            type: 'lab',
            lab: 'audience',
            runId,
            evidence: withBaselineProvenance(`Extracted ${segments.length} segments from audience analysis`, ctx),
          }],
        });
      }
    }
  }

  console.log(`[AudienceLabExtractor] Extracted ${fields.length} canonical fields from Audience Lab`);

  return {
    fields,
    labId: 'audience',
    runId,
  };
}

// ============================================================================
// Competitor Lab Extractor
// ============================================================================

/**
 * Extract canonical fields from Competitor Lab output.
 *
 * Competitor Lab populates:
 * - competitors_primary (required for strategy)
 * - competitors_notes
 */
export function extractFromCompetitorLab(
  data: any, // CompetitorLabResult
  runId: string,
  ctx: ExtractionContext = DEFAULT_EXTRACTION_CONTEXT
): ExtractionResult {
  const fields: ContextFieldCandidate[] = [];

  // Extract competitor names
  const refinedContext = data?.refinedContext || [];
  const competitors = data?.diagnostics?.competitors
    || refinedContext.find((r: any) => r.field === 'topCompetitors')?.value
    || data?.competitors
    || [];

  if (Array.isArray(competitors) && competitors.length > 0) {
    const competitorNames = competitors
      .map((c: any) => typeof c === 'string' ? c : c?.name || c?.company || c?.domain)
      .filter((n: any) => n && typeof n === 'string' && n.length > 2)
      .slice(0, 10);

    if (competitorNames.length > 0) {
      const competitorList = competitorNames.join(', ');
      fields.push({
        key: 'competitors_primary',
        value: competitorList,
        confidence: 0.8,
        sources: [{
          type: 'lab',
          lab: 'competitor',
          runId,
          evidence: withBaselineProvenance(`Identified ${competitorNames.length} competitors from competitive analysis`, ctx),
        }],
      });
    }
  }

  // Extract competitive notes/summary - needs to be actionable
  const competitiveNotes = data?.diagnostics?.summary
    || data?.summary
    || refinedContext.find((r: any) => r.field === 'competitiveNotes')?.value;

  if (isQualityValue(competitiveNotes, 30, ctx)) {
    fields.push({
      key: 'competitors_notes',
      value: competitiveNotes,
      confidence: 0.75,
      sources: [{
        type: 'lab',
        lab: 'competitor',
        runId,
        evidence: withBaselineProvenance('Competitive landscape summary from analysis', ctx),
      }],
    });
  }

  console.log(`[CompetitorLabExtractor] Extracted ${fields.length} canonical fields from Competitor Lab`);

  return {
    fields,
    labId: 'competitor',
    runId,
  };
}

// ============================================================================
// Full GAP Extractor
// ============================================================================

/**
 * Extract canonical fields from Full GAP output.
 *
 * IMPORTANT: GAP output has LIMITED fields for context extraction!
 * The actual GAP V4 output structure is:
 * - executiveSummary: string (narrative, NOT an object)
 * - businessContext: { businessType, businessName, brandTier, maturityStage }
 *
 * GAP does NOT output: industry, valueProposition, positioning, targetAudience, icp
 * Those fields must come from Labs (Brand Lab, Audience Lab).
 *
 * Full GAP can only reliably extract:
 * - business_stage (from maturityStage)
 * - business_model (from businessType)
 */
export function extractFromFullGap(
  data: any, // GAPStructuredOutput or growthPlan
  runId: string,
  ctx: ExtractionContext = DEFAULT_EXTRACTION_CONTEXT
): ExtractionResult {
  const fields: ContextFieldCandidate[] = [];

  const growthPlan = data?.growthPlan || data?.plan || data;
  const businessContext = data?.initialAssessment?.businessContext || {};

  // Extract business stage from maturity assessment
  // This is the ONLY reliable field from GAP output
  const maturityStage = businessContext.maturityStage
    || growthPlan?.maturityStage
    || data?.initialAssessment?.initialAssessment?.summary?.maturityStage;

  if (isQualityValue(maturityStage, 5, ctx)) {
    fields.push({
      key: 'business_stage',
      value: maturityStage,
      confidence: 0.75,
      sources: [{
        type: 'gap',
        runId,
        evidence: withBaselineProvenance('Derived from marketing maturity assessment', ctx),
      }],
    });
  }

  // Extract business model from businessType
  const businessType = businessContext.businessType;
  if (isQualityValue(businessType, 3, ctx)) {
    fields.push({
      key: 'business_model',
      value: businessType,
      confidence: 0.7,
      sources: [{
        type: 'gap',
        runId,
        evidence: withBaselineProvenance('Identified from business type classification', ctx),
      }],
    });
  }

  // NOTE: GAP does NOT extract these fields - they must come from Labs:
  // - industry (from Brand Lab)
  // - value_prop (from Brand Lab)
  // - positioning (from Brand Lab)
  // - audience_icp_primary (from Audience Lab or Brand Lab)
  // - differentiators (from Brand Lab)

  console.log(`[FullGapExtractor] Extracted ${fields.length} canonical fields from Full GAP (limited scope - Labs provide core strategy fields)`);

  return {
    fields,
    labId: 'brand', // Use brand as fallback since Full GAP is cross-cutting
    runId,
  };
}

// ============================================================================
// Products/Services Extractor (from Website Lab)
// ============================================================================

/**
 * Extract canonical fields from Website Lab output.
 *
 * Website Lab can populate:
 * - offer_products_services
 */
export function extractFromWebsiteLab(
  data: any, // WebsiteLabResult
  runId: string,
  ctx: ExtractionContext = DEFAULT_EXTRACTION_CONTEXT
): ExtractionResult {
  const fields: ContextFieldCandidate[] = [];

  // Extract products/services from page analysis
  const products = data?.products
    || data?.data?.products
    || data?.refinement?.refinedContext?.find((r: any) => r.field === 'primaryProducts')?.value;

  if (products && Array.isArray(products) && products.length > 0) {
    const productNames = products
      .map((p: any) => typeof p === 'string' ? p : p?.name || p?.title)
      .filter((n: any) => n && typeof n === 'string' && n.length > 2)
      .slice(0, 10);

    if (productNames.length > 0) {
      const productList = productNames.join(', ');
      if (isQualityValue(productList, 10, ctx)) {
        fields.push({
          key: 'offer_products_services',
          value: productList,
          confidence: 0.75,
          sources: [{
            type: 'lab',
            lab: 'website',
            runId,
            evidence: withBaselineProvenance(`Identified ${productNames.length} products/services from website analysis`, ctx),
          }],
        });
      }
    }
  } else if (isQualityValue(products, 10, ctx)) {
    fields.push({
      key: 'offer_products_services',
      value: products,
      confidence: 0.75,
      sources: [{
        type: 'lab',
        lab: 'website',
        runId,
        evidence: withBaselineProvenance('Extracted from website content', ctx),
      }],
    });
  }

  console.log(`[WebsiteLabExtractor] Extracted ${fields.length} canonical fields from Website Lab`);

  return {
    fields,
    labId: 'website',
    runId,
  };
}

// ============================================================================
// Router Function
// ============================================================================

/**
 * Extract canonical fields from any lab output.
 * Routes to the appropriate extractor based on labId.
 *
 * @param labId - The lab that produced the data
 * @param data - The lab output data
 * @param runId - The run ID for provenance
 * @param ctx - Extraction context controlling filter strictness
 */
export function extractCanonicalFields(
  labId: LabId,
  data: any,
  runId: string,
  ctx: ExtractionContext = DEFAULT_EXTRACTION_CONTEXT
): ExtractionResult {
  switch (labId) {
    case 'brand':
      return extractFromBrandLab(data, runId, ctx);
    case 'audience':
      return extractFromAudienceLab(data, runId, ctx);
    case 'competitor':
      return extractFromCompetitorLab(data, runId, ctx);
    case 'website':
      return extractFromWebsiteLab(data, runId, ctx);
    default:
      // Other labs don't populate canonical fields yet
      return {
        fields: [],
        labId,
        runId,
      };
  }
}

/**
 * Merge extraction results from multiple labs.
 * Uses confidence arbitration: higher confidence wins.
 */
export function mergeExtractionResults(
  results: ExtractionResult[]
): ContextFieldCandidate[] {
  const fieldMap = new Map<CanonicalFieldKey, ContextFieldCandidate>();

  for (const result of results) {
    for (const field of result.fields) {
      const existing = fieldMap.get(field.key);

      // Keep the field with higher confidence
      if (!existing || field.confidence > existing.confidence) {
        fieldMap.set(field.key, field);
      } else if (field.confidence === existing.confidence) {
        // Same confidence: merge sources
        existing.sources = [...existing.sources, ...field.sources];
      }
    }
  }

  return Array.from(fieldMap.values());
}

// ============================================================================
// Conversion to ContextFinding (for Canonicalizer)
// ============================================================================

import type { ContextFinding, ContextSourceType } from '@/lib/types/contextField';

/**
 * Get runId from a ContextFieldSource (handles union type)
 */
function getRunIdFromSource(source: ContextFieldSource | undefined): string | undefined {
  if (!source) return undefined;
  // Only 'lab' and 'gap' sources have runId
  if (source.type === 'lab' || source.type === 'gap') {
    return source.runId;
  }
  return undefined;
}

/**
 * Convert ContextFieldCandidate[] to ContextFinding[] for the canonicalizer.
 * This bridges the extractor output format to the canonicalizer input format.
 */
export function toContextFindings(
  results: ExtractionResult[],
): ContextFinding[] {
  const candidates = mergeExtractionResults(results);

  return candidates.map(candidate => {
    const primarySource = candidate.sources[0];

    // Map lab source type to ContextSourceType
    let sourceType: ContextSourceType = 'lab';
    if (primarySource?.type === 'gap') {
      sourceType = 'gap_full';
    } else if (primarySource?.type === 'user') {
      sourceType = 'user';
    }

    return {
      fieldKey: candidate.key,
      value: candidate.value,
      confidence: candidate.confidence,
      source: sourceType,
      sourceRunId: getRunIdFromSource(primarySource) || 'unknown',
      evidence: primarySource?.evidence,
    };
  });
}

/**
 * Convert a single ExtractionResult to ContextFinding[]
 */
export function extractionResultToFindings(result: ExtractionResult): ContextFinding[] {
  return result.fields.map(candidate => {
    const primarySource = candidate.sources[0];

    let sourceType: ContextSourceType = 'lab';
    if (primarySource?.type === 'gap') {
      sourceType = 'gap_full';
    } else if (primarySource?.type === 'user') {
      sourceType = 'user';
    }

    return {
      fieldKey: candidate.key,
      value: candidate.value,
      confidence: candidate.confidence,
      source: sourceType,
      sourceRunId: getRunIdFromSource(primarySource) || result.runId,
      evidence: primarySource?.evidence,
    };
  });
}
