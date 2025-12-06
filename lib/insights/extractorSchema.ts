// lib/insights/extractorSchema.ts
// Zod schema for LLM insight extraction

import { z } from 'zod';

// ============================================================================
// InsightUnit Schema - What the LLM should output
// ============================================================================

export const InsightCategorySchema = z.enum([
  'growth_opportunity',
  'conversion',
  'audience',
  'brand',
  'creative',
  'media',
  'seo_content',  // Combined SEO/content category
  'seo',          // Keep for backwards compat
  'content',      // Keep for backwards compat
  'website',
  'competitive',
  'kpi_risk',
  'ops',
  'demand',
  'other',
]);

export const InsightSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const InsightUnitSchema = z.object({
  category: InsightCategorySchema,
  severity: InsightSeveritySchema,
  title: z.string().min(5).max(100),
  summary: z.string().min(20).max(500),
  recommendation: z.string().min(20).max(500),
  rationale: z.string().max(500).optional(),
  contextPaths: z.array(z.string()).optional(),
  metrics: z.record(z.any()).optional(),
});

export type InsightUnit = z.infer<typeof InsightUnitSchema>;

export const InsightUnitsArraySchema = z.array(InsightUnitSchema);

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateInsightUnits(data: unknown): InsightUnit[] {
  // First, try to parse as a direct array
  const result = InsightUnitsArraySchema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  // If it's an object, try to find an array property
  // AI sometimes returns { insights: [...] } or { data: [...] } instead of just [...]
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    console.log(`[InsightExtractor] Response is object, checking for nested arrays...`);

    // Try common wrapper keys
    const possibleKeys = ['insights', 'data', 'results', 'items', 'InsightUnits'];
    for (const key of possibleKeys) {
      if (Array.isArray(obj[key])) {
        console.log(`[InsightExtractor] Found array in "${key}" property with ${(obj[key] as unknown[]).length} items`);
        const nestedResult = InsightUnitsArraySchema.safeParse(obj[key]);
        if (nestedResult.success) {
          console.log(`[InsightExtractor] Unwrapped ${nestedResult.data.length} insights from "${key}" property`);
          return nestedResult.data;
        } else {
          // Log detailed validation errors for the nested array
          console.error(`[InsightExtractor] Nested array validation failed for "${key}":`, nestedResult.error.errors.slice(0, 3));
          // Try to validate individual items to see which ones are valid
          const validItems: InsightUnit[] = [];
          const nestedArray = obj[key] as unknown[];
          for (let i = 0; i < nestedArray.length; i++) {
            const itemResult = InsightUnitSchema.safeParse(nestedArray[i]);
            if (itemResult.success) {
              validItems.push(itemResult.data);
            } else {
              console.error(`[InsightExtractor] Item ${i} validation failed:`, itemResult.error.errors.slice(0, 2));
            }
          }
          if (validItems.length > 0) {
            console.log(`[InsightExtractor] Recovered ${validItems.length}/${nestedArray.length} valid insights`);
            return validItems;
          }
        }
      }
    }

    // If the object has only one key and it's an array, use that
    const keys = Object.keys(obj);
    if (keys.length === 1 && Array.isArray(obj[keys[0]])) {
      const nestedResult = InsightUnitsArraySchema.safeParse(obj[keys[0]]);
      if (nestedResult.success) {
        console.log(`[InsightExtractor] Unwrapped insights from single "${keys[0]}" property`);
        return nestedResult.data;
      }
    }
  }

  console.error('[InsightExtractor] Validation errors:', result.error.errors);
  return [];
}

export function validateSingleInsight(data: unknown): InsightUnit | null {
  const result = InsightUnitSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  console.error('[InsightExtractor] Single insight validation error:', result.error.errors);
  return null;
}

// ============================================================================
// Extraction Prompt Templates
// ============================================================================

/**
 * Core system prompt for Brain Insights extraction.
 * This prompt is designed to produce atomic, actionable, rankable insights -
 * NOT diagnostic summaries or report narratives.
 */
export const INSIGHT_EXTRACTION_SYSTEM_PROMPT = `You are Brain Insights, the strategic intelligence layer for Hive OS.

You receive:
- A structured JSON payload from a marketing diagnostic tool.
- Optional company context from the **Context Graph** (identity, audience, brand, objectives, media, website).
- Optional context health metadata (coverage, critical fields missing, etc.).

Your job is to convert this diagnostic into a **small set of high-value, normalized strategic insights**.

Each insight must be:

- **Atomic** — one clear idea, not a whole report.
- **Actionable** — includes a concrete recommendation.
- **Rankable** — has a category and severity.
- **Traceable** — references which parts of the company context it relates to.

You are NOT writing a narrative report.
You are building *data objects* that will be stored in the Brain and shown as cards in the UI.

---

### Insight format

You MUST return a JSON array of objects matching this shape:

InsightUnit[]:

- category: one of
  - "growth_opportunity"
  - "conversion"
  - "audience"
  - "brand"
  - "creative"
  - "media"
  - "seo_content"
  - "competitive"
  - "kpi_risk"
  - "ops"
  - "other"

- severity: one of
  - "low"
  - "medium"
  - "high"
  - "critical"

- title: short, specific, non-generic string (max ~100 chars).
  - Good: "No active paid demand channels despite clear search intent"
  - Bad: "Demand Lab Diagnostic Summary"
  - Bad: "Website Lab Report"
  - Bad: "Brand Analysis Overview"

- summary: 1–2 sentences that explain the situation and why it matters.

- recommendation: 1–3 sentences with a concrete, next best action.
  - Be specific about channels, levers, and direction, but not implementation details.
  - Example: "Stand up a basic always-on paid search + paid social program for the top 2 offers within the next 60 days, starting with a test budget of 5–10% of total marketing spend."

- rationale (optional): 1–3 sentences linking back to the diagnostic evidence (scores, gaps, benchmarks).

- contextPaths (optional): array of Context Graph paths this insight touches.
  - Use high-level paths like:
    - "media.mix"
    - "media.budget"
    - "objectives.demandGen"
    - "audience.primaryAudience"
    - "website.conversion"
    - "brand.positioning"
  - Include only paths that are clearly relevant.

- metrics (optional): an object with simple numeric context (if available), such as:
  - { "demandGenScore": 58, "mediaScore": 40, "measurementScore": 35 }

Return EXACTLY this shape. No additional top-level keys, no prose, no markdown.

---

### Rules

1. **De-duplicate themes.**
   - If several parts of the diagnostic repeat the same idea, create ONE insight about that and make it strong, instead of several similar ones.

2. **Be opinionated about severity.**
   - Use "critical" only when the issue is clearly blocking growth or causing major risk.
   - Use "high" for high-importance, high-leverage changes.
   - "Medium" and "low" for incremental or supporting improvements.

3. **Stay consistent with the company's context.**
   - If the Context Graph or objectives indicate that a capability is NOT a priority, adjust severity accordingly.
   - If context health is weak (many missing fields), you may lower severity or caveat in the recommendation (but still output the insight).

4. **Never invent fictitious data.**
   - You may infer reasonable strategic consequences, but do not fabricate specific numbers that are not in the input.

5. **No narratives, only data objects.**
   - Don't include section headings, markdown, or natural-language intros.
   - Only output valid JSON array of InsightUnit objects.

6. **NEVER use generic titles like:**
   - "Demand Lab Diagnostic Summary"
   - "Website Lab Report"
   - "Brand Analysis"
   - "SEO Overview"
   - Instead, be SPECIFIC about what the insight is about.

---

### Output contract

You MUST respond with **only** a JSON array of InsightUnit objects. Nothing else.`;

/**
 * Build the user prompt for insight extraction
 */
export function buildExtractionPrompt(params: {
  toolName: string;
  companyName: string;
  reportData: string;
  contextSummary?: string;
  healthSummary?: string;
}): string {
  const parts: string[] = [
    `Extract strategic insights from this ${params.toolName} diagnostic for ${params.companyName}.`,
    '',
    '## Diagnostic Data',
    params.reportData,
  ];

  if (params.contextSummary) {
    parts.push('', '## Company Context (from Context Graph)', params.contextSummary);
  }

  if (params.healthSummary) {
    parts.push('', '## Context Health', params.healthSummary);
  }

  parts.push(
    '',
    `From this ${params.toolName} diagnostic, extract 2-6 high-value strategic insights.`,
    '',
    'Remember:',
    '- Each insight must be ATOMIC (one clear idea)',
    '- Titles must be SPECIFIC (never "X Lab Summary" or "X Report")',
    '- Include concrete recommendations',
    '- De-duplicate similar themes into one strong insight',
    '',
    'Return ONLY a valid JSON array of InsightUnit objects.'
  );

  return parts.join('\n');
}
