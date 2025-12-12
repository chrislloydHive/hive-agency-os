// lib/competition-v4/prompts.ts
// Competition V4 - Sequential Prompt Set
//
// These prompts are sequential. Each step feeds the next.
// No competitors are generated until the category is locked.

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
  "primary_vertical": "Fitness | Financial Services | Healthcare | Education | Retail | Marketing Services | Other | Unknown",
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

RULES
- The category must be specific enough to exclude unrelated businesses.
- Avoid marketing language.
- This category will be used as a hard constraint for competitor discovery.

Example output (for TrainrHub-like companies):

{
  "category_slug": "fitness_service_marketplace",
  "category_name": "Fitness Services Marketplace",
  "category_description": "A B2C marketplace platform that connects consumers with personal trainers or fitness professionals for booking, payments, and ongoing services.",
  "qualification_rules": [
    "Connects multiple fitness professionals to consumers",
    "Facilitates booking, payment, or subscriptions"
  ],
  "exclusion_rules": [
    "Marketing agencies",
    "Single-gym operators",
    "Pure SaaS tools without a marketplace"
  ]
}`;

// ============================================================================
// Prompt 3: Competitor Discovery (Category-Constrained)
// ============================================================================

export const PROMPT_3_COMPETITOR_DISCOVERY = `You are identifying competitors for a business.

You MUST strictly follow the provided category definition.
Only include companies that clearly meet the qualification rules and do not violate exclusion rules.

INPUTS
- Canonical Category Definition
- Company name (for reference only)

OUTPUT FORMAT (JSON ONLY)

{
  "competitors": [
    {
      "name": "",
      "domain": "",
      "type": "Direct | Indirect | Adjacent",
      "reason": "One-sentence explanation of why this company fits the category",
      "confidence": 0.0
    }
  ]
}

RULES
- Do NOT include companies that violate exclusion rules.
- Do NOT include marketing agencies unless category explicitly allows agencies.
- If no competitors can be confidently identified, return an empty array.
- Confidence should reflect certainty of category match, not market strength.`;

// ============================================================================
// Prompt 4: Competitor Validation & Pruning
// ============================================================================

export const PROMPT_4_COMPETITOR_VALIDATION = `You are validating a proposed competitor list against a strict category definition.

INPUTS
- Canonical Category Definition
- Proposed Competitor List

OUTPUT FORMAT (JSON ONLY)

{
  "validated_competitors": [],
  "removed_competitors": [
    {
      "name": "",
      "domain": "",
      "reason": "Why this competitor was removed"
    }
  ],
  "notes": "Any ambiguity or edge cases worth noting"
}

RULES
- Remove any competitor that only partially fits.
- Be conservative. It is better to return fewer competitors than incorrect ones.`;

// ============================================================================
// Prompt 5: Competitive Summary (Optional)
// ============================================================================

export const PROMPT_5_COMPETITIVE_SUMMARY = `You are summarizing the competitive landscape for internal strategy use.

INPUTS
- Canonical Category Definition
- Validated Competitor List

OUTPUT FORMAT (JSON ONLY)

{
  "competitive_positioning": "2-3 sentence neutral summary",
  "key_differentiation_axes": [
    "Axis such as price, coverage, platform depth, specialization"
  ],
  "competitive_risks": [
    "Primary risks based on category structure"
  ]
}

RULES
- Do NOT add competitors.
- Do NOT exaggerate advantages.
- This is analytical, not marketing.`;

// ============================================================================
// Helper Functions to Build Prompts with Context
// ============================================================================

export interface DecompositionInput {
  companyName: string;
  domain?: string;
  websiteText?: string;
  diagnosticsSummary?: string;
}

export function buildDecompositionPrompt(input: DecompositionInput): string {
  const parts: string[] = [
    `Company Name: ${input.companyName}`,
  ];

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

  return parts.join('\n');
}

export function buildCategoryPrompt(decomposition: object): string {
  return `Business Decomposition Result:\n${JSON.stringify(decomposition, null, 2)}`;
}

export function buildDiscoveryPrompt(
  category: object,
  companyName: string
): string {
  return `Category Definition:\n${JSON.stringify(category, null, 2)}\n\nCompany Name (for reference): ${companyName}`;
}

export function buildValidationPrompt(
  category: object,
  competitors: object[]
): string {
  return `Category Definition:\n${JSON.stringify(category, null, 2)}\n\nProposed Competitors:\n${JSON.stringify(competitors, null, 2)}`;
}

export function buildSummaryPrompt(
  category: object,
  validatedCompetitors: object[]
): string {
  return `Category Definition:\n${JSON.stringify(category, null, 2)}\n\nValidated Competitors:\n${JSON.stringify(validatedCompetitors, null, 2)}`;
}
