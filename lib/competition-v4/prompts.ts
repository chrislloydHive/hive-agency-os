// lib/competition-v4/prompts.ts
// Competition V4 - Sequential Prompt Set
//
// These prompts use TRAIT-BASED discovery (no hardcoded brand names).
// Each step feeds the next in sequence.

// ============================================================================
// Prompt 1: Business Decomposition (Classification Tree)
// ============================================================================

export const PROMPT_1_BUSINESS_DECOMPOSITION = `You are analyzing a company to determine its fundamental business classification.
This is NOT competitive analysis yet.

Your job is to decompose the business step-by-step into a structured taxonomy.
Be precise. Do not guess if signals are weak.

INPUTS YOU MAY RECEIVE
- Company name
- Website/domain
- On-page text or summaries
- Diagnostics signals (if available)

OUTPUT FORMAT (JSON ONLY)

{
  "market_orientation": "B2C | B2B | B2B2C | Mixed | Unknown",
  "economic_model": "Product | Service | Software | Platform | Marketplace | Financial | Media | Agency | Unknown",
  "offering_type": "Physical Goods | Digital Product | Software | Financial Product | Labor-Based Service | Hybrid | Unknown",
  "buyer_user_relationship": "Same | Different | Mixed | Unknown",
  "transaction_model": "One-time | Subscription | Usage-based | Commission | Interest-based | Advertising | Mixed | Unknown",
  "primary_vertical": "Fitness | Financial Services | Healthcare | Education | Retail | Marketing Services | Automotive | Home Services | Other | Unknown",
  "secondary_verticals": [],
  "geographic_scope": "Local | Regional | National | Global | Unknown",
  "confidence_notes": "Brief explanation of any uncertainty"
}

RULES
- Do NOT mention competitors.
- Do NOT write prose outside JSON.
- If unsure, return "Unknown" and explain why in confidence_notes.`;

// ============================================================================
// Prompt 2: Canonical Category Definition
// ============================================================================

export const PROMPT_2_CATEGORY_DEFINITION = `You are defining the canonical category for a business based on its classification.

INPUT
- Business Decomposition JSON from the previous step

OUTPUT FORMAT (JSON ONLY)

{
  "category_slug": "lowercase_snake_case",
  "category_name": "Human-readable category name",
  "category_description": "1-2 sentence clear description of what this business is",
  "qualification_rules": [
    "Rule describing what qualifies a company to be in this category"
  ],
  "exclusion_rules": [
    "Rule describing what disqualifies a company from this category"
  ]
}

CRITICAL CLASSIFICATION RULES

1. MARKETPLACE vs SUBSCRIPTION:
   - If the business connects MULTIPLE independent providers to customers, the category MUST be "Marketplace" or "Platform".
   - "Subscription" describes a PRICING MODEL, not a business category.
   - NEVER use "Subscription" as the primary category when multiple providers are involved.
   - Example: A platform where customers subscribe to access multiple trainers = "Fitness Services Marketplace" (NOT "Fitness Subscription")

2. When economic_model = "Marketplace" or "Platform":
   - Always include "Marketplace" or "Platform" in category_name
   - category_description MUST mention connecting providers with customers

3. When buyer_user_relationship = "Different":
   - This usually indicates a platform/marketplace model
   - The category should reflect the two-sided nature

GENERAL RULES
- The category must be specific enough to exclude unrelated businesses.
- Avoid marketing language.
- This category will be used as a hard constraint for competitor discovery.`;

// ============================================================================
// Prompt 3: Competitor Discovery (Trait-Based)
// ============================================================================

export const PROMPT_3_COMPETITOR_DISCOVERY = `You are identifying competitors for a business using TRAIT-BASED matching.

CORE PRINCIPLE: Identify competitors based on WHO CUSTOMERS ACTUALLY COMPARE, not category purity.

TRAIT-BASED COMPETITOR TYPES TO CONSIDER:

1. SERVICE-CAPABLE COMPETITORS (if subject offers services/installation):
   - National retailers that offer service/installation in subject's categories
   - Regional chains with service capability
   - Local service providers/installers in subject's area
   - Any competitor with verified installation/repair/setup services

2. PRODUCT COMPETITORS (if subject sells products):
   - Direct category competitors (same products)
   - Adjacent category retailers with overlapping products
   - Online marketplaces selling similar products
   - Big-box retailers with overlapping inventory

3. GEOGRAPHIC COMPETITORS:
   - National-reach competitors (always relevant)
   - Regional competitors (if subject is regional/local)
   - Local specialists (if subject serves specific areas)

4. CUSTOMER JOURNEY ALTERNATIVES:
   - DIY alternatives (e-commerce, tutorials)
   - Different service models (subscription vs one-time)
   - Price tier alternatives (budget/premium)

INPUTS
- Canonical Category Definition
- Company name (for reference only)
- Subject traits (modality, services, geography)

OUTPUT FORMAT (JSON ONLY)

{
  "competitors": [
    {
      "name": "Competitor name",
      "domain": "competitor.com",
      "type": "Direct | Indirect | Adjacent",
      "reason": "Trait-based explanation of competitive overlap",
      "confidence": 0-100,
      "hasServiceCapability": true/false,
      "serviceCapabilityEvidence": "How we know they offer services",
      "geographicReach": "local | regional | national | unknown",
      "serviceAreas": ["city1", "region1"],
      "isRetailer": true/false,
      "isServiceProvider": true/false,
      "productCategories": ["category1", "category2"],
      "serviceCategories": ["service1", "service2"],
      "brandRecognition": 0-100,
      "pricePositioning": "budget | mid | premium | unknown"
    }
  ]
}

DISCOVERY RULES
1. For HYBRID businesses (product + service):
   - MUST include service-capable national retailers
   - MUST include local/regional service providers
   - MUST include product-focused competitors
   - Aim for 8-15 diverse competitors

2. For SERVICE-ONLY businesses:
   - Prioritize local/regional service providers
   - Include national service franchises if they exist
   - Include DIY/online alternatives
   - Aim for 6-12 competitors

3. For PRODUCT-ONLY businesses:
   - Focus on product category overlap
   - Include marketplaces and e-commerce
   - Include price-tier alternatives
   - Aim for 8-15 competitors

4. ALWAYS include competitors across multiple reach levels:
   - At least 1-2 national-reach (if they exist in this space)
   - At least 2-3 regional (if applicable)
   - At least 2-3 local (if subject is local/regional)

5. For EACH competitor, provide trait evidence:
   - hasServiceCapability: ONLY true if you have evidence
   - serviceCapabilityEvidence: Required if hasServiceCapability=true
   - brandRecognition: Estimate 0-100 based on market awareness`;

// ============================================================================
// Prompt 4: Competitor Validation (Intent-Based)
// ============================================================================

export const PROMPT_4_COMPETITOR_VALIDATION = `You are validating competitors using INTENT-BASED INCLUSION rules.

CORE PRINCIPLE: Keep competitors if CUSTOMERS COMPARE, even with weak category match.

INTENT MATCHING RULES (keep if ANY match):

1. SERVICE-INTENT MATCH:
   - Subject has service capability AND competitor has service capability
   - NEVER remove service-capable national retailers for service businesses
   - Local service providers for local/regional subjects = ALWAYS KEEP

2. PRODUCT-INTENT MATCH:
   - Overlapping product categories (>20% overlap)
   - Similar price positioning to subject
   - Competing for same customer purchase decision

3. GEOGRAPHIC-INTENT MATCH:
   - National competitors for any subject = KEEP (they compete everywhere)
   - Local/regional in subject's service area = KEEP
   - Service providers in overlapping geography = KEEP

4. BRAND THREAT MATCH:
   - High brand recognition (>60) in subject's market = KEEP
   - Known alternative customers mention = KEEP

ONLY REMOVE IF ALL ARE TRUE:
- Zero service/product overlap
- Different customer segment entirely
- No geographic overlap
- Competitor is defunct or invalid

INPUTS
- Canonical Category Definition
- Proposed Competitor List (with trait data)
- Subject's traits (modality, services, geography)

OUTPUT FORMAT (JSON ONLY)

{
  "validated_competitors": [
    // Keep all trait fields from input
    // Add "validationNotes" explaining why kept
  ],
  "removed_competitors": [
    {
      "name": "",
      "domain": "",
      "reason": "Must cite MULTIPLE failed intent matches"
    }
  ],
  "notes": "Summary of validation decisions"
}

VALIDATION REQUIREMENTS:
1. PRESERVE all trait fields from input
2. Remove ONLY clear non-competitors
3. When in doubt, KEEP (prefer false positives over false negatives)
4. Log reasoning for edge cases`;

// ============================================================================
// Prompt 5: Competitive Summary
// ============================================================================

export const PROMPT_5_COMPETITIVE_SUMMARY = `You are summarizing the competitive landscape for internal strategy use.

INPUTS
- Canonical Category Definition
- Validated Competitor List

OUTPUT FORMAT (JSON ONLY)

{
  "competitive_positioning": "2-3 sentence neutral summary of competitive landscape",
  "key_differentiation_axes": [
    "service_capability",
    "geographic_coverage",
    "price_positioning",
    "brand_trust",
    "product_breadth"
  ],
  "competitive_risks": [
    "Risk 1 based on competitor traits",
    "Risk 2 based on market structure"
  ],
  "market_structure_summary": "Brief description of how competitors are distributed"
}

RULES
- Do NOT add competitors.
- Do NOT exaggerate advantages.
- Focus on TRAIT-BASED differentiation (service, geography, price, etc.)
- This is analytical, not marketing.`;

// ============================================================================
// Helper Functions to Build Prompts with Context
// ============================================================================

export interface DecompositionInput {
  companyName: string;
  domain?: string;
  websiteText?: string;
  diagnosticsSummary?: string;
  approvedContext?: string;
}

export function buildDecompositionPrompt(input: DecompositionInput): string {
  const parts: string[] = [`Company Name: ${input.companyName}`];

  if (input.domain) {
    parts.push(`Domain: ${input.domain}`);
  }

  if (input.websiteText) {
    // Truncate to avoid token overflow
    const truncated = input.websiteText.slice(0, 8000);
    parts.push(`\nWebsite Content:\n${truncated}`);
  }

  if (input.diagnosticsSummary) {
    const truncated = input.diagnosticsSummary.slice(0, 4000);
    parts.push(`\nDiagnostics Summary:\n${truncated}`);
  }

  if (input.approvedContext) {
    const truncated = input.approvedContext.slice(0, 4000);
    parts.push(`\nApproved Context (confirmed facts):\n${truncated}`);
  }

  return parts.join('\n');
}

export function buildCategoryPrompt(decomposition: object, approvedContext?: string): string {
  const parts = [`Business Decomposition Result:\n${JSON.stringify(decomposition, null, 2)}`];
  if (approvedContext) {
    parts.push(`Approved Context (confirmed facts):\n${approvedContext.slice(0, 2000)}`);
  }
  return parts.join('\n\n');
}

export interface DiscoveryPromptInput {
  category: object;
  companyName: string;
  approvedContext?: string;
  competitiveModality?: string;
  customerComparisonModes?: string[];
  hasInstallation?: boolean;
  geographicScope?: string;
  serviceEmphasis?: number;
  productEmphasis?: number;
  serviceCategories?: string[];
  productCategories?: string[];
  serviceAreas?: string[];
}

export function buildDiscoveryPrompt(
  input: DiscoveryPromptInput | object,
  companyName?: string,
  approvedContext?: string
): string {
  // Handle both old and new call signatures
  let category: object;
  let name: string;
  let context: string | undefined;
  let modality: string | undefined;
  let comparisonModes: string[] | undefined;
  let hasInstall: boolean | undefined;
  let geoScope: string | undefined;
  let serviceEmphasis: number | undefined;
  let productEmphasis: number | undefined;
  let serviceCategories: string[] | undefined;
  let productCategories: string[] | undefined;
  let serviceAreas: string[] | undefined;

  if ('category' in input && typeof input.category === 'object') {
    // New signature
    const typed = input as DiscoveryPromptInput;
    category = typed.category;
    name = typed.companyName;
    context = typed.approvedContext;
    modality = typed.competitiveModality;
    comparisonModes = typed.customerComparisonModes;
    hasInstall = typed.hasInstallation;
    geoScope = typed.geographicScope;
    serviceEmphasis = typed.serviceEmphasis;
    productEmphasis = typed.productEmphasis;
    serviceCategories = typed.serviceCategories;
    productCategories = typed.productCategories;
    serviceAreas = typed.serviceAreas;
  } else {
    // Old signature (category, companyName, approvedContext)
    category = input;
    name = companyName || 'Unknown';
    context = approvedContext;
  }

  const parts = [
    `Category Definition:\n${JSON.stringify(category, null, 2)}`,
    `Company Name (for reference): ${name}`,
  ];

  // Add subject traits section
  parts.push('\n=== SUBJECT TRAITS (use these for trait-based matching) ===');

  if (modality) {
    parts.push(`Competitive Modality: ${modality}`);
  }

  if (hasInstall !== undefined) {
    parts.push(`Has Service Capability: ${hasInstall ? 'YES - include service-capable competitors' : 'NO'}`);
  }

  if (serviceEmphasis !== undefined) {
    parts.push(`Service Emphasis: ${Math.round(serviceEmphasis * 100)}%`);
  }

  if (productEmphasis !== undefined) {
    parts.push(`Product Emphasis: ${Math.round(productEmphasis * 100)}%`);
  }

  if (geoScope) {
    parts.push(`Geographic Scope: ${geoScope}`);
  }

  if (serviceAreas && serviceAreas.length > 0) {
    parts.push(`Service Areas: ${serviceAreas.join(', ')}`);
  }

  if (serviceCategories && serviceCategories.length > 0) {
    parts.push(`Service Categories: ${serviceCategories.join(', ')}`);
  }

  if (productCategories && productCategories.length > 0) {
    parts.push(`Product Categories: ${productCategories.join(', ')}`);
  }

  if (comparisonModes && comparisonModes.length > 0) {
    parts.push(`Customer Comparison Modes: ${comparisonModes.join(', ')}`);
  }

  parts.push('=== END SUBJECT TRAITS ===\n');

  // Add trait-based discovery guidance based on modality
  if (modality === 'Retail+Installation' || modality === 'InstallationOnly') {
    parts.push(`CRITICAL: Subject has service capability.
- MUST include national retailers with service/installation in subject's categories
- MUST include local service providers
- MUST include regional service chains
- Include at least 3+ service-capable competitors`);
  } else if (modality === 'ProductOnly') {
    parts.push(`Subject is product-focused.
- Prioritize product category competitors
- Include marketplaces and e-commerce
- Include price-tier alternatives`);
  }

  if (context) {
    parts.push(`\nApproved Context (confirmed facts):\n${context.slice(0, 2000)}`);
  }

  return parts.join('\n');
}

export interface ValidationPromptInput {
  category: object;
  competitors: object[];
  approvedContext?: string;
  competitiveModality?: string;
  hasInstallation?: boolean;
  serviceEmphasis?: number;
  geographicScope?: string;
}

export function buildValidationPrompt(
  categoryOrInput: object | ValidationPromptInput,
  competitors?: object[],
  approvedContext?: string
): string {
  let category: object;
  let comps: object[];
  let context: string | undefined;
  let modality: string | undefined;
  let hasInstall: boolean | undefined;
  let serviceEmphasis: number | undefined;
  let geoScope: string | undefined;

  if ('category' in categoryOrInput && 'competitors' in categoryOrInput) {
    // New signature
    const typed = categoryOrInput as ValidationPromptInput;
    category = typed.category;
    comps = typed.competitors;
    context = typed.approvedContext;
    modality = typed.competitiveModality;
    hasInstall = typed.hasInstallation;
    serviceEmphasis = typed.serviceEmphasis;
    geoScope = typed.geographicScope;
  } else {
    // Old signature
    category = categoryOrInput;
    comps = competitors || [];
    context = approvedContext;
  }

  const parts = [
    `Category Definition:\n${JSON.stringify(category, null, 2)}`,
    `Proposed Competitors:\n${JSON.stringify(comps, null, 2)}`,
  ];

  // Add subject traits for validation context
  parts.push('\n=== SUBJECT TRAITS FOR INTENT MATCHING ===');

  if (modality) {
    parts.push(`Competitive Modality: ${modality}`);
  }

  if (hasInstall !== undefined) {
    parts.push(`Subject Has Service Capability: ${hasInstall ? 'YES' : 'NO'}`);
    if (hasInstall) {
      parts.push(`*** SERVICE INTENT RULE ACTIVE ***
NEVER remove competitors with service capability for this subject.
National retailers with service = KEEP
Local service providers = KEEP
Regional service chains = KEEP`);
    }
  }

  if (serviceEmphasis !== undefined && serviceEmphasis > 0.5) {
    parts.push(`High Service Emphasis (${Math.round(serviceEmphasis * 100)}%) - service-capable competitors are direct threats`);
  }

  if (geoScope) {
    parts.push(`Geographic Scope: ${geoScope}`);
    if (geoScope === 'local' || geoScope === 'regional') {
      parts.push(`*** GEOGRAPHIC INTENT RULE ***
Keep ALL national-reach competitors (they compete everywhere)
Keep ALL local/regional competitors in service area`);
    }
  }

  parts.push('=== END SUBJECT TRAITS ===\n');

  if (context) {
    parts.push(`Approved Context (confirmed facts):\n${context.slice(0, 2000)}`);
  }

  return parts.join('\n\n');
}

export function buildSummaryPrompt(
  category: object,
  validatedCompetitors: object[],
  approvedContext?: string
): string {
  const parts = [
    `Category Definition:\n${JSON.stringify(category, null, 2)}`,
    `Validated Competitors:\n${JSON.stringify(validatedCompetitors, null, 2)}`,
  ];
  if (approvedContext) {
    parts.push(`Approved Context (confirmed facts):\n${approvedContext.slice(0, 2000)}`);
  }
  return parts.join('\n\n');
}
