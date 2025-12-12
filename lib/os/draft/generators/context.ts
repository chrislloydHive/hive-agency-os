// lib/os/draft/generators/context.ts
// Context Draft Generator
//
// Generates CompanyContext drafts from SignalsBundle using OpenAI.
// Extracted from run-diagnostics endpoint for reuse across the draft system.

import { getOpenAI } from '@/lib/openai';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyContext, saveContextDraft } from '@/lib/os/context';
import { parseCompetitors } from '@/lib/types/context';
import type { CompanyContext, ContextDraft, ContextAiInput, Competitor } from '@/lib/types/context';
import type { SignalsBundle, DraftResult, ContextDraftData } from '../types';

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `
You are the Context Modeling Engine for Hive OS.

Your job is to create accurate, grounded, STRATEGY-READY company context based on diagnostic signals.
This context is foundational and will be used downstream by Strategy generation, Creative Strategy, and Work planning.

Write for operators, not marketing. Be specific, grounded, and useful.
Avoid labels, fragments, and generic summaries.

================================
CRITICAL - PRIMARY ANCHOR
================================
The company name and domain are your PRIMARY source of truth. Everything else is secondary.
- First, understand what the company ACTUALLY does based on their name and domain.
- Then validate other signals against this understanding.
- REJECT any competitor data or signals that don't match the company's actual business.
- NEVER assume the company is a marketing agency unless the inputs explicitly say so.

================================
FIELD REQUIREMENTS
================================

businessModel (REQUIRED - 1-2 sentences)
Explain:
- Who pays
- How the company makes money
- Core revenue mechanics (fees, subscriptions, lending, commissions, etc.)
This should clearly explain the business, not just name it.
BAD: "E-commerce business"
GOOD: "Sells fitness equipment direct-to-consumer through their website, with revenue from product margins and a subscription-based equipment maintenance program."

valueProposition (REQUIRED - 2-3 sentences)
Explain:
- The primary problem solved
- Who it is solved for
- What meaningfully differentiates this company from alternatives
Avoid marketing language. Be concrete about the differentiation.

companyCategory (REQUIRED - 1 sentence)
Describe the category in plain language.
Do not return a label alone (e.g., not just "banking" or "SaaS").
This should immediately clarify what kind of company this is.
BAD: "Fintech"
GOOD: "A digital bank offering checking accounts, savings, and lending products primarily to small business owners."

primaryAudience (REQUIRED - 1 sentence)
Name the audience and qualify them.
Include who they are and why this product or service matters to them.
BAD: "Small businesses"
GOOD: "Small business owners (1-50 employees) who need fast access to working capital without the paperwork of traditional bank loans."

secondaryAudience (1 sentence if applicable)
Explain who they are and why they are relevant but not primary.
If no clear secondary audience exists, return: "No clear secondary audience identified."

icpDescription (REQUIRED - 3-4 sentences)
Describe:
- Typical customer profile
- Key needs or pain points
- Decision drivers or motivations
This should be concrete enough to guide targeting and messaging.

objectives (REQUIRED - 3-5 items)
Each objective should be OUTCOME-ORIENTED and MEASURABLE.
Format each as: "[Action verb] [specific outcome] [via mechanism/channel]"
Examples:
- "Increase qualified lead volume by 30% through organic search optimization"
- "Improve trial-to-paid conversion rate from 5% to 12% via onboarding optimization"
- "Reduce customer acquisition cost by expanding referral and word-of-mouth channels"
- "Grow monthly recurring revenue by 25% through upsell of existing customer base"
BAD objectives (too vague):
- "Improve marketing" (no outcome)
- "Get more customers" (no mechanism)
- "Increase brand awareness" (not measurable)

constraints (REQUIRED - 2-4 sentences)
Include CONCRETE constraints from these categories:
- Budget: Estimated monthly/annual marketing budget, or "Budget unknown - assume moderate SMB constraints"
- Regulatory: Industry-specific compliance (HIPAA, FINRA, etc.) or "No apparent regulatory constraints"
- Resources: Team size, in-house vs. agency reliance, technical capabilities
- Timeline: Launch windows, seasonal considerations, urgency factors
CRITICAL: If a constraint category is unknown, explicitly state it as unknown rather than omitting.
Example: "Budget is unknown. No apparent regulatory constraints. Team appears small (likely <5 marketing FTEs). Timeline urgency is unclear."

marketSignals (3-5 items)
Short bullet-style signals about the market landscape.
Examples:
- "High competition in local SEO for this category"
- "Seasonal demand peaks in Q4"
- "Market consolidation with larger players acquiring smaller ones"

competitorsNotes (2-3 sentences)
High-level summary of the competitive landscape.
Who are the main threats? What patterns exist?

================================
STRICT RULES
================================
1. Use ONLY information provided in the input. Do not invent details.
2. If you cannot confidently determine a value, return null for that field.
3. VALIDATE competitor data: If competitors are from a different industry than the company, return competitors: [].
4. Pay attention to "detectedIndustry", "detectedAudienceHints", and "detectedBusinessModelHints" fields.
5. Do NOT use marketing fluff. Write for operators who need to take action.
6. Avoid one-word or short-phrase answers. Each field should be substantive.
7. Do not repeat the same phrasing across fields.

================================
OUTPUT FORMAT
================================
Return a JSON object with ONLY these keys:
{
  "businessModel": string | null,
  "primaryAudience": string | null,
  "secondaryAudience": string | null,
  "valueProposition": string | null,
  "icpDescription": string | null,
  "objectives": string[] | null,
  "constraints": string | null,
  "competitorsNotes": string | null,
  "marketSignals": string[] | null,
  "companyCategory": string | null,
  "competitors": [
    {
      "domain": string (required, lowercase),
      "name": string | null,
      "offerOverlap": number (0-100, how much their offering overlaps),
      "jtbdMatch": boolean (do they solve the same jobs-to-be-done),
      "geoRelevance": number (0-100, geographic market overlap),
      "type": "direct" | "indirect" | "adjacent",
      "confidence": number (0-100, how confident you are in this assessment)
    }
  ],
  "confidenceNotes": {
    "highConfidence": ["field names where inference is strong"],
    "needsReview": ["field name: reason for uncertainty"]
  },
  "summary": string (1-2 sentences summarizing what was generated)
}

CONFIDENCE NOTES REQUIREMENTS:
- List fields in "highConfidence" when signals are clear and unambiguous
- List fields in "needsReview" with specific reasons when:
  - Signals are conflicting or sparse
  - Industry-specific nuance may be missed
  - Multiple interpretations are possible
  - Data is inferred rather than explicit
Example:
{
  "highConfidence": ["businessModel", "primaryAudience", "companyCategory"],
  "needsReview": [
    "valueProposition: differentiation unclear from available signals",
    "constraints: no budget or regulatory information provided",
    "icpDescription: audience segment may be broader than inferred"
  ]
}

COMPETITOR TYPE DEFINITIONS:
- "direct": Same target audience, same core offering, head-to-head competition
- "indirect": Different approach to solving the same problem, or adjacent offering
- "adjacent": Related market/category but different core business model

Include up to 10 competitors if available. Prioritize direct competitors first.
NEVER include fields not shown above.
`.trim();

// ============================================================================
// Generate Context Draft
// ============================================================================

/**
 * Generate a Context draft from SignalsBundle using OpenAI.
 * This is the main entry point for context draft generation.
 */
export async function generateContextDraft(
  companyId: string,
  signals: SignalsBundle
): Promise<DraftResult<ContextDraftData>> {
  console.log('[generateContextDraft] Starting for:', companyId);

  try {
    // Get company info
    const company = await getCompanyById(companyId);
    if (!company) {
      return {
        success: false,
        draft: null,
        summary: 'Company not found',
        error: 'COMPANY_NOT_FOUND',
      };
    }

    // Get existing context (for context in the AI prompt)
    const existingContext = await getCompanyContext(companyId);

    // Build AI input
    // If V4 is used, include the V4 category instead of V3 competition summary
    const v4Category = signals.competitionV4Snapshot ? {
      categoryName: signals.competitionV4Snapshot.categoryName,
      categoryDescription: signals.competitionV4Snapshot.categoryDescription,
    } : null;

    console.log('[generateContextDraft] Competition source:', signals.competitorSource, {
      v4Category: v4Category?.categoryName,
      competitorCount: signals.competitors.length,
      topDomains: signals.competitors.slice(0, 3).map(c => c.domain),
    });

    const aiInput: ContextAiInput = {
      companyName: company.name ?? '',
      domain: company.domain ?? company.website ?? '',
      currentContext: existingContext,
      diagnosticsSummary: signals.diagnosticsSummary,
      detectedIndustry: signals.inferredIndustry ?? undefined,
      detectedAudienceHints: signals.inferredAudienceHints,
      detectedBusinessModelHints: signals.inferredBusinessModelHints,
      // Only pass V3 competition summary if NOT using V4
      competitionSummary: signals.competitorSource === 'v4' ? null : signals.competitionSummary,
    };

    // If V4 is used, add V4 category and validated competitors to input
    // Using object spread to add extra fields without modifying the type
    const extendedInput = signals.competitorSource === 'v4' && v4Category
      ? {
          ...aiInput,
          v4Category,
          validatedCompetitors: signals.competitors.map(c => ({
            domain: c.domain,
            name: c.name,
            type: c.type,
            confidence: c.confidence,
          })),
        }
      : aiInput;

    // Call OpenAI
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Here is the company context input as JSON. Generate the context.\n\n${JSON.stringify(extendedInput, null, 2)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content || '{}';
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error('[generateContextDraft] Failed to parse AI response:', raw);
      parsed = {};
    }

    // Parse AI-generated competitors
    const aiCompetitors = parseCompetitors(parsed.competitors, 'ai');

    // Merge with baseline competitors (baseline takes precedence for domains we already have)
    const mergedCompetitors = mergeCompetitors(signals.competitors, aiCompetitors);

    // Parse confidence notes from AI response
    const rawConfidence = parsed.confidenceNotes as {
      highConfidence?: string[];
      needsReview?: string[];
    } | undefined;
    const confidenceNotes = rawConfidence ? {
      highConfidence: Array.isArray(rawConfidence.highConfidence) ? rawConfidence.highConfidence : undefined,
      needsReview: Array.isArray(rawConfidence.needsReview) ? rawConfidence.needsReview : undefined,
    } : undefined;

    // Build context from AI output
    const generatedContext: CompanyContext = {
      companyId,
      businessModel: (parsed.businessModel as string) || undefined,
      primaryAudience: (parsed.primaryAudience as string) || undefined,
      secondaryAudience: (parsed.secondaryAudience as string) || undefined,
      valueProposition: (parsed.valueProposition as string) || undefined,
      icpDescription: (parsed.icpDescription as string) || undefined,
      objectives: Array.isArray(parsed.objectives) ? (parsed.objectives as string[]) : undefined,
      constraints: (parsed.constraints as string) || undefined,
      competitorsNotes: (parsed.competitorsNotes as string) || undefined,
      competitors: mergedCompetitors.length > 0 ? mergedCompetitors : undefined,
      marketSignals: Array.isArray(parsed.marketSignals) ? (parsed.marketSignals as string[]) : undefined,
      companyCategory: (parsed.companyCategory as string) || signals.inferredCategory || undefined,
      confidenceNotes,
      isAiGenerated: true,
    };

    // Create draft data
    const draftData: ContextDraftData = {
      context: generatedContext,
      source: 'ai/baseline-v1',
      createdAt: new Date().toISOString(),
      summary: (parsed.summary as string) || 'Context drafted from baseline diagnostics',
    };

    // Save draft to Airtable
    try {
      const contextDraft: ContextDraft = {
        companyId,
        context: generatedContext,
        source: draftData.source,
        createdAt: draftData.createdAt,
        summary: draftData.summary,
      };
      await saveContextDraft(contextDraft);
      console.log('[generateContextDraft] Saved draft for:', companyId);
    } catch (saveError) {
      console.error('[generateContextDraft] Failed to save draft:', saveError);
      // Don't fail the whole operation - we can still return the draft
    }

    console.log('[generateContextDraft] Generated draft with:', {
      hasBusinessModel: !!generatedContext.businessModel,
      competitorCount: mergedCompetitors.length,
      hasObjectives: !!generatedContext.objectives?.length,
    });

    return {
      success: true,
      draft: draftData,
      summary: draftData.summary ?? 'Context draft generated',
    };
  } catch (error) {
    console.error('[generateContextDraft] Error:', error);
    return {
      success: false,
      draft: null,
      summary: 'Failed to generate context draft',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Merge baseline competitors with AI-generated competitors.
 * Baseline competitors take precedence for matching domains.
 * AI competitors fill in gaps and provide additional insights.
 */
function mergeCompetitors(
  baselineCompetitors: Competitor[],
  aiCompetitors: Competitor[]
): Competitor[] {
  const seen = new Set<string>();
  const merged: Competitor[] = [];

  // Add baseline competitors first (they have priority)
  for (const competitor of baselineCompetitors) {
    const domain = competitor.domain.toLowerCase();
    if (!seen.has(domain)) {
      seen.add(domain);
      merged.push(competitor);
    }
  }

  // Add AI competitors that aren't already present
  for (const competitor of aiCompetitors) {
    const domain = competitor.domain.toLowerCase();
    if (!seen.has(domain)) {
      seen.add(domain);
      merged.push(competitor);
    }
  }

  // Limit to 10 competitors, prioritizing direct competitors
  return merged
    .sort((a, b) => {
      // Sort by type: direct > indirect > adjacent
      const typeOrder = { direct: 0, indirect: 1, adjacent: 2 };
      return (typeOrder[a.type] ?? 2) - (typeOrder[b.type] ?? 2);
    })
    .slice(0, 10);
}
