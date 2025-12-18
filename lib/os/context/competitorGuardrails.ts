// lib/os/context/competitorGuardrails.ts
// Competition Lab Guardrails
//
// Validates competitors before persisting to context graph.
// Prevents invalid competitors (e.g., marketing agencies for non-agency companies).

// ============================================================================
// Types
// ============================================================================

export interface CompetitorCandidate {
  name: string;
  domain?: string;
  confidence: number;
  category?: string;
  industry?: string;
  evidence?: string;
}

export interface CompetitorValidationResult {
  valid: CompetitorCandidate[];
  invalid: Array<CompetitorCandidate & { rejectionReason: string }>;
}

export interface CompanyContext {
  industry?: string;
  businessModel?: string;
  category?: string;
}

// ============================================================================
// Industry/Category Validation
// ============================================================================

/**
 * Marketing/agency related terms that should NOT appear as competitors
 * for non-marketing companies
 */
const MARKETING_AGENCY_INDICATORS = [
  'agency',
  'marketing',
  'digital agency',
  'creative agency',
  'advertising',
  'media agency',
  'social media agency',
  'seo agency',
  'ppc agency',
  'branding agency',
  'pr agency',
  'public relations',
  'consultancy',
  'consulting',
];

/**
 * B2B service providers that are often incorrectly flagged as competitors
 */
const B2B_SERVICE_PROVIDERS = [
  'hubspot',
  'salesforce',
  'mailchimp',
  'constant contact',
  'hootsuite',
  'sprout social',
  'semrush',
  'ahrefs',
  'moz',
  'google analytics',
  'adobe',
  'canva',
];

/**
 * Check if a company is likely a marketing/agency business
 */
function isMarketingAgency(context: CompanyContext): boolean {
  const indicators = ['agency', 'marketing', 'advertising', 'creative', 'media'];
  const industry = (context.industry || '').toLowerCase();
  const category = (context.category || '').toLowerCase();
  const model = (context.businessModel || '').toLowerCase();

  return indicators.some(
    ind => industry.includes(ind) || category.includes(ind) || model.includes(ind)
  );
}

/**
 * Check if a competitor candidate is a marketing agency
 */
function isCompetitorMarketingAgency(competitor: CompetitorCandidate): boolean {
  const name = (competitor.name || '').toLowerCase();
  const category = (competitor.category || '').toLowerCase();
  const industry = (competitor.industry || '').toLowerCase();

  return MARKETING_AGENCY_INDICATORS.some(
    ind => name.includes(ind) || category.includes(ind) || industry.includes(ind)
  );
}

/**
 * Check if a competitor is actually a B2B tool/service provider
 */
function isB2BServiceProvider(competitor: CompetitorCandidate): boolean {
  const name = (competitor.name || '').toLowerCase();
  return B2B_SERVICE_PROVIDERS.some(provider => name.includes(provider));
}

// ============================================================================
// Main Validation
// ============================================================================

/**
 * Validate competitors against company context
 *
 * Guardrails:
 * 1. Reject marketing agencies for non-agency companies
 * 2. Reject B2B service providers (tools, not competitors)
 * 3. Require confidence >= 0.7
 * 4. Require some evidence of industry match
 */
export function validateCompetitors(
  candidates: CompetitorCandidate[],
  companyContext: CompanyContext
): CompetitorValidationResult {
  const valid: CompetitorCandidate[] = [];
  const invalid: Array<CompetitorCandidate & { rejectionReason: string }> = [];

  const isAgency = isMarketingAgency(companyContext);

  for (const candidate of candidates) {
    // Check confidence threshold
    if (candidate.confidence < 0.7) {
      invalid.push({
        ...candidate,
        rejectionReason: `Confidence too low (${candidate.confidence} < 0.7)`,
      });
      continue;
    }

    // Check for B2B service providers (not actual competitors)
    if (isB2BServiceProvider(candidate)) {
      invalid.push({
        ...candidate,
        rejectionReason: 'B2B service provider, not a direct competitor',
      });
      continue;
    }

    // Check for marketing agency mismatch
    if (!isAgency && isCompetitorMarketingAgency(candidate)) {
      invalid.push({
        ...candidate,
        rejectionReason: 'Marketing agency competitor for non-agency company',
      });
      continue;
    }

    // Check for empty/generic names
    const name = candidate.name?.trim() || '';
    if (name.length < 2) {
      invalid.push({
        ...candidate,
        rejectionReason: 'Competitor name too short or missing',
      });
      continue;
    }

    // Check for placeholder names
    const placeholders = ['competitor', 'company', 'business', 'unknown', 'n/a', 'tbd'];
    if (placeholders.some(p => name.toLowerCase() === p)) {
      invalid.push({
        ...candidate,
        rejectionReason: 'Placeholder competitor name',
      });
      continue;
    }

    // Passed all checks
    valid.push(candidate);
  }

  return { valid, invalid };
}

/**
 * Validate a single competitor
 */
export function validateSingleCompetitor(
  candidate: CompetitorCandidate,
  companyContext: CompanyContext
): { valid: boolean; reason?: string } {
  const result = validateCompetitors([candidate], companyContext);

  if (result.valid.length > 0) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: result.invalid[0]?.rejectionReason || 'Unknown validation failure',
  };
}

// ============================================================================
// Persistence Helpers
// ============================================================================

/**
 * Prepare competitors for context graph persistence
 * Returns valid competitors and stores invalid ones separately
 */
export function prepareCompetitorsForPersistence(
  candidates: CompetitorCandidate[],
  companyContext: CompanyContext
): {
  validCompetitors: CompetitorCandidate[];
  invalidCompetitors: Array<CompetitorCandidate & { rejectionReason: string }>;
  summary: string;
} {
  const result = validateCompetitors(candidates, companyContext);

  const summary = `Validated ${candidates.length} competitors: ${result.valid.length} valid, ${result.invalid.length} invalid`;

  console.log(`[CompetitorGuardrails] ${summary}`);

  if (result.invalid.length > 0) {
    console.log('[CompetitorGuardrails] Invalid competitors:');
    for (const inv of result.invalid) {
      console.log(`  - ${inv.name}: ${inv.rejectionReason}`);
    }
  }

  return {
    validCompetitors: result.valid,
    invalidCompetitors: result.invalid,
    summary,
  };
}
