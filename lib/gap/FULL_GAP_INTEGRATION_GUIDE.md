# Full GAP V3 Integration Guide

This guide shows how to integrate the new Full GAP prompt with the `FullGapOutput` template, building on the Initial Assessment.

## Files Overview

### New Files Created

1. **`lib/gap/prompts/fullGapOutputPromptV3.ts`** - New deep strategic prompt
2. **`lib/gap/parseFullGapOutput.ts`** - Parser and validation helpers

## Integration Steps

### Step 1: Update API Handler to Use New Prompt

In your Full GAP generation endpoint (e.g., `app/api/growth-plan/route.ts` or Inngest function), update to:

```typescript
// Import new prompt and parser
import { FULL_GAP_OUTPUT_PROMPT_V3 } from '@/lib/gap/prompts/fullGapOutputPromptV3';
import {
  parseAndMapFullGapOutput,
  generateFullGapPromptContext,
  type FullGapBusinessContext,
} from '@/lib/gap/parseFullGapOutput';
import type { InitialAssessmentOutput } from '@/lib/gap/outputTemplates';

// ... existing code to get or generate GAP-IA ...

// Assume you have the GAP-IA output (either from database or fresh generation)
const gapIaOutput: InitialAssessmentOutput = /* ... from IA generation or DB ... */;

// Generate Full GAP prompt context from IA
const iaContext = generateFullGapPromptContext(gapIaOutput, {
  businessType: companyType,  // from heuristics or IA
  brandTier,                  // from heuristics or IA
  companyName: businessName,
  url,
});

// Call LLM with new V3 prompt
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  temperature: 0.3,
  messages: [
    {
      role: 'system',
      content: GAP_SHARED_SYSTEM_PROMPT,  // Keep existing system prompt
    },
    {
      role: 'user',
      content: `
${GAP_SHARED_REASONING_PROMPT}

${FULL_GAP_OUTPUT_PROMPT_V3}

${iaContext}

Now generate the Full Growth Acceleration Plan JSON output.
      `.trim(),
    },
  ],
  response_format: { type: 'json_object' },
});

// Extract response
const rawOutput = completion.choices[0]?.message?.content;
if (!rawOutput) {
  throw new Error('No content in OpenAI response');
}

// Parse and map using new parser
const context: FullGapBusinessContext = {
  url,
  domain,
  businessName,
  gapId,
  companyType,
  brandTier,
};

const fullGapResponse = parseAndMapFullGapOutput(
  rawOutput,
  gapIaOutput,  // Pass IA for score validation
  context
);

// fullGapResponse is now mapped to simplified structure
// Save to Airtable or return via API...
```

### Step 2: Expected Output Structure

The LLM will return JSON matching `FullGapOutput`:

```json
{
  "executiveSummary": "The company's marketing foundation is in the Emerging stage with an overall score of 42/100. The site has strong visual design...",
  "overallScore": 42,
  "maturityStage": "Emerging",
  "dimensionAnalyses": [
    {
      "id": "brand",
      "score": 45,
      "summary": "Clean visual identity but unclear value proposition.",
      "detailedAnalysis": "The brand has consistent visual elements across the site including color palette, typography, and imagery. However, the core positioning is vague—the homepage headline doesn't communicate what makes the service different from competitors. The messaging reads generically and could apply to dozens of similar businesses in the category.",
      "keyFindings": [
        "Homepage headline 'We help businesses grow' is generic and doesn't differentiate from competitors",
        "No clear ICP definition—unclear who the ideal customer is or what specific pain points are addressed",
        "Testimonials exist but lack specificity about results or customer segments",
        "About page focuses on company history rather than customer outcomes and value drivers"
      ]
    },
    // ... 5 more dimensions
  ],
  "quickWins": [
    {
      "action": "Rewrite homepage H1 to clearly state what the service does and who it's for so visitors immediately understand the offer",
      "dimensionId": "brand",
      "impactLevel": "medium",
      "effortLevel": "low",
      "expectedOutcome": "Reduce homepage bounce rate and improve clarity for first-time visitors"
    },
    // ... 2-4 more
  ],
  "strategicPriorities": [
    {
      "title": "Establish Local Search Dominance",
      "description": "Claim and fully optimize Google Business Profile with complete business information, high-quality photos, service descriptions, and operating hours. Implement systematic review generation process by emailing satisfied customers post-service. Set up automated review monitoring to respond within 24 hours. For a local service business, GBP is THE primary discovery channel—without it, the business is invisible in Google Maps and local pack results. Success means appearing in local pack for key service searches and generating 20+ reviews within 90 days.",
      "relatedDimensions": ["digitalFootprint", "seo"],
      "timeframe": "medium"
    },
    // ... 2-6 more
  ],
  "roadmap90Days": {
    "phase0_30": {
      "whyItMatters": "Phase 1 focuses on fixing critical visibility gaps and establishing tracking foundations...",
      "actions": [
        "Claim and fully set up Google Business Profile with complete business info and photos",
        "Add Google Analytics and Search Console to establish baseline tracking",
        "Execute all 3 quick wins from Initial Assessment",
        // ... 1-4 more actions
      ]
    },
    "phase30_60": { /* ... */ },
    "phase60_90": { /* ... */ }
  },
  "kpis": [
    {
      "name": "Google Business Profile Views",
      "whatItMeasures": "Number of times the GBP listing appears in search and maps results",
      "whyItMatters": "With no GBP currently, the business is invisible in local search. This tracks progress in capturing local search demand.",
      "whatGoodLooksLike": "For local service businesses, 500-1,000 monthly views is baseline; 2,000+ indicates strong presence",
      "relatedDimensions": ["digitalFootprint", "seo"]
    },
    // ... 3-6 more
  ],
  "confidence": "high"
}
```

### Step 3: Key Differences from Old Prompt

| Aspect | Old Prompt | New V3 Prompt |
|--------|-----------|---------------|
| Length | 385 lines | 450 lines (more structured) |
| IA Relationship | Vague "don't contradict" | Explicit "IA as briefing" with example context |
| Business Type | Generic warnings | Explicit prioritization per business model |
| Non-Repetition | Basic instruction | Detailed examples of good vs bad |
| Output Structure | Complex nested format | Simplified FullGapOutput schema |
| Strategic vs Tactical | Mentioned | Clear distinction with examples |
| Validation | Zod only | Zod + repair + violation logging |

### Step 4: Parser Features

The `parseFullGapOutput()` function:

1. **Validates against FullGapOutput schema**
2. **Enforces score consistency** - Ensures Full GAP scores match IA (read-only)
3. **Normalizes arrays** - Trims/fills to required counts (3-5 quick wins, 3-7 priorities, etc.)
4. **Logs violations** - Warns when LLM breaks constraints

**Example violation logging:**

```
[full-gap/parse] ⚠️  Constraint violations detected:
  - quickWins: Expected 3-5, got 7 (trimmed to 5)
  - strategicPriorities: Expected 3-7, got 2 (filled to minimum)
  - roadmap90Days.phase0_30: Expected 4-7 actions, got 2 (filled to minimum)
  - overallScore: Changed from IA (42) to Full GAP (45). Scores are read-only! Reverted to IA score.
```

### Step 5: IA Context Generation

The `generateFullGapPromptContext()` helper creates a structured summary of the IA to pass to the Full GAP LLM:

```typescript
const iaContext = generateFullGapPromptContext(gapIaOutput, {
  businessType: 'local_business',
  brandTier: 'smb',
  companyName: 'Acme Fitness',
  url: 'https://acmefitness.com',
});

// This generates:
/*
════════════════════════════════════════════
INITIAL ASSESSMENT (GAP-IA) SUMMARY
════════════════════════════════════════════

**Company**: Acme Fitness
**Business Type**: local_business
**Brand Tier**: smb

**Overall Score**: 42/100
**Maturity Stage**: Emerging

**Executive Summary** (from IA):
[IA summary text...]

**Top Opportunities** (from IA):
1. Claim Google Business Profile to capture local search
2. Build bi-weekly blog for SEO authority
3. Add pricing transparency

**Quick Wins** (from IA):
1. Claim GBP with complete info (digitalFootprint)
2. Rewrite homepage H1 (brand)
3. Add pricing page (website)

**Dimension Scores** (from IA - READ-ONLY):
- brand: 45/100 - Clean identity but unclear value prop
- content: 30/100 - Minimal content beyond service pages
... etc
*/
```

This context ensures the Full GAP LLM:
- Knows exactly what the IA found
- Doesn't repeat IA verbatim
- Uses IA scores as fixed anchors
- Builds strategically on IA insights

### Step 6: Business-Type Adaptation

The prompt automatically adapts based on `businessType`:

**Local Business Example:**
```json
{
  "strategicPriorities": [
    {
      "title": "Establish Local Search Dominance",
      "description": "Claim and optimize Google Business Profile... For a local service business, GBP is THE primary discovery channel...",
      "relatedDimensions": ["digitalFootprint", "seo"],
      "timeframe": "medium"
    }
  ]
}
```

**B2B SaaS Example:**
```json
{
  "strategicPriorities": [
    {
      "title": "Build LinkedIn Thought Leadership Engine",
      "description": "Establish LinkedIn Company Page and begin consistent posting... For B2B SaaS, LinkedIn is the PRIMARY channel for building credibility...",
      "relatedDimensions": ["digitalFootprint", "content"],
      "timeframe": "medium"
    }
  ]
}
```

The prompt explicitly instructs:
> "Do NOT recommend LinkedIn as a strategic priority for local B2C businesses (gyms, restaurants, venues, events) unless there's a compelling B2B component"

### Step 7: Non-Repetition Examples

The prompt includes clear examples of bad vs good non-repetitive content:

**BAD (Repetitive):**
- Executive summary: "The brand lacks clear positioning"
- Dimension analysis: "Brand lacks clear positioning"
- Strategic priority: "Establish clear brand positioning"

**GOOD (Additive):**
- Executive summary: "The brand lacks clear positioning, making it difficult for prospects to understand the core value proposition"
- Dimension analysis: "Brand positioning is unclear—the homepage doesn't communicate who the service is for or what makes it different from competitors..."
- Strategic priority: "Develop comprehensive brand positioning framework defining ICP, unique value drivers, and competitive differentiation, then cascade this into all marketing materials..."

Each statement adds NEW depth and specificity.

## Migration Path

### Phase 1: Parallel Testing (Recommended)

Add a feature flag to test V3 alongside the old prompt:

```typescript
const useV3FullGapPrompt = process.env.FULL_GAP_USE_V3 === 'true';

if (useV3FullGapPrompt) {
  // Use new V3 prompt + parser
  const iaContext = generateFullGapPromptContext(gapIaOutput, { ... });
  const fullGapResponse = parseAndMapFullGapOutput(rawOutput, gapIaOutput, context);
} else {
  // Use old prompt + validation
  const fullGapResponse = validateOldFormat(rawOutput);
}
```

### Phase 2: Full Cutover

Once validated:
1. Remove old `FULL_GAP_OUTPUT_PROMPT`
2. Rename `FULL_GAP_OUTPUT_PROMPT_V3` → `FULL_GAP_OUTPUT_PROMPT`
3. Remove feature flag

## Key Benefits

1. **Explicit IA Relationship** - IA as "briefing", Full GAP as "deep strategic plan"
2. **Business-Type Aware** - Automatically prioritizes based on business model
3. **Non-Repetitive** - Forces each section to add new depth
4. **Score Consistency** - Enforces IA scores as read-only (no re-scoring)
5. **Strategic vs Tactical** - Clear distinction between quick wins and multi-step programs
6. **Validation & Repair** - Automatically fixes LLM constraint violations
7. **Logging** - Clear visibility into parsing and normalization

## Next Steps

1. **Test with real GAP-IA outputs** - Verify Full GAP builds correctly on IA
2. **Monitor violation logs** - Track where LLM breaks constraints
3. **A/B test** - Compare V3 vs old prompt on quality and actionability
4. **Iterate** - Refine prompt based on real-world outputs
