# GAP-IA V3 Integration Guide

This guide shows how to integrate the new tightly-scoped GAP-IA prompt with the `InitialAssessmentOutput` template.

## Files Overview

### New Files Created

1. **`lib/gap/outputTemplates.ts`** - Strongly-typed Zod schemas for GAP outputs
2. **`lib/gap/outputMappers.ts`** - Backward compatibility mappers
3. **`lib/gap/prompts/gapIaOutputPromptV3.ts`** - New concise GAP-IA prompt
4. **`lib/gap/parseGapIaOutput.ts`** - Parser and validation helpers

### Integration Steps

## Step 1: Update API Handler to Use New Prompt

In `app/api/gap-ia/run/route.ts`, update the LLM call section:

```typescript
// Import new prompt and parser
import { GAP_IA_OUTPUT_PROMPT_V3 } from '@/lib/gap/prompts/gapIaOutputPromptV3';
import {
  parseAndMapGapIaOutput,
  generateBusinessTypeContext,
  type GapIaBusinessContext
} from '@/lib/gap/parseGapIaOutput';

// ... existing code ...

// Build business context for the LLM
const businessContext = generateBusinessTypeContext(
  companyType,  // from heuristics or user input
  brandTier     // from heuristics or user input
);

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

${GAP_IA_OUTPUT_PROMPT_V3}

════════════════════════════════════════════
BUSINESS CONTEXT
════════════════════════════════════════════

${businessContext}

════════════════════════════════════════════
ANALYSIS INPUTS
════════════════════════════════════════════

URL: ${url}
Domain: ${domain}

Homepage HTML (truncated):
\`\`\`html
${homepageHtml}
\`\`\`

Digital Footprint Signals:
\`\`\`json
${JSON.stringify(digitalFootprintData, null, 2)}
\`\`\`

Multi-Page Snapshot:
\`\`\`json
${JSON.stringify(multiPageSnapshot, null, 2)}
\`\`\`

Now generate the Initial Assessment JSON output.
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
const context: GapIaBusinessContext = {
  url,
  domain,
  businessName,  // from heuristics or LLM output
  companyType,
  brandTier,
  htmlSignals: { /* ... */ },
  digitalFootprint: digitalFootprintData,
  multiPageSnapshot,
};

const gapIaOutput = parseAndMapGapIaOutput(rawOutput, context);

// gapIaOutput is now GapIaV2AiOutput, fully backward compatible
// Continue with existing Airtable save logic...
```

## Step 2: Expected Output Structure

The LLM will now return a **concise** JSON matching `InitialAssessmentOutput`:

```json
{
  "executiveSummary": "Marketing Readiness Score: 42/100 (Emerging stage). Strong visual design. Critical gaps: no GBP, weak content.",
  "marketingReadinessScore": 42,
  "maturityStage": "Emerging",
  "topOpportunities": [
    "Claim Google Business Profile to capture local search",
    "Build bi-weekly blog for SEO authority",
    "Add pricing transparency to reduce friction"
  ],
  "quickWins": [
    {
      "action": "Claim GBP with complete info so local searches discover the business",
      "dimensionId": "digitalFootprint",
      "impactLevel": "high",
      "effortLevel": "low"
    },
    // ... 2 more
  ],
  "dimensionSummaries": [
    {
      "id": "brand",
      "score": 45,
      "summary": "Clean identity but unclear value prop.",
      "keyIssue": "Homepage doesn't explain what the service does"
    },
    // ... 5 more (all 6 required)
  ],
  "confidence": "high"
}
```

## Step 3: Backward Compatibility

The `parseAndMapGapIaOutput()` function automatically maps this to the existing `GapIaV2AiOutput` format:

```typescript
{
  summary: { overallScore, maturityStage, headlineDiagnosis, narrative, topOpportunities },
  dimensions: { brand, content, seo, website, digitalFootprint, authority },
  breakdown: { bullets: [...] },
  quickWins: { bullets: [...] },
  core: { /* full CoreMarketingContext */ },
  insights: { /* full GapIaInsights */ }
}
```

This ensures **zero breaking changes** to:
- Airtable writes
- API responses
- Frontend consumers

## Step 4: Testing

### Test the Parser

```typescript
import { parseGapIaOutput } from '@/lib/gap/parseGapIaOutput';

const testOutput = {
  executiveSummary: "Test summary...",
  marketingReadinessScore: 50,
  maturityStage: "Emerging",
  topOpportunities: ["A", "B", "C"],
  quickWins: [/* 3 items */],
  dimensionSummaries: [/* 6 items */],
};

const validated = parseGapIaOutput(testOutput, { strict: false });
console.log('Validated:', validated);
```

### Test Business Type Context

```typescript
import { generateBusinessTypeContext } from '@/lib/gap/parseGapIaOutput';

const context = generateBusinessTypeContext('b2b_saas', 'startup');
console.log(context);
// Output: Instructions to prioritize LinkedIn, content, pricing, etc.
```

## Step 5: Monitoring

The parser logs constraint violations:

```
[gap-ia/parse] ⚠️  Constraint violations detected:
  - topOpportunities: Expected 3, got 5 (normalized to 3)
  - quickWins: Expected 3, got 4 (normalized to 3)
  - executiveSummary: Too long (600 chars). Should be 3-4 sentences (~200-400 chars)
```

These warnings help identify when the LLM isn't following the tight constraints.

## Key Benefits

1. **Concise Prompt** - 220 lines (vs 529 lines in old prompt)
2. **Hard Constraints** - Exactly 3 opportunities, 3 quick wins, 6 dimensions
3. **Business-Type Aware** - Automatically prioritizes based on business model
4. **Non-Repetition** - Forces distinct key issues across dimensions
5. **Backward Compatible** - Zero breaking changes to API/Airtable
6. **Validation & Repair** - Automatically fixes LLM constraint violations
7. **Logging** - Clear visibility into parsing and normalization

## Comparison: Old vs New

| Aspect | Old Prompt | New V3 Prompt |
|--------|-----------|---------------|
| Length | 529 lines | 220 lines |
| Output Schema | Complex nested structure | Simple flat structure |
| Opportunities Count | "3-5" (variable) | Exactly 3 |
| Quick Wins Count | "5-8" (variable) | Exactly 3 |
| Business Type Awareness | Generic warnings | Explicit prioritization |
| Validation | Zod only | Zod + repair + logging |
| Tone | Verbose, repetitive | Concise, scannable |

## Migration Path

### Phase 1: Opt-In (Recommended)
Add a feature flag to test V3 alongside the old prompt:

```typescript
const useV3Prompt = process.env.GAP_IA_USE_V3 === 'true';

const prompt = useV3Prompt
  ? GAP_IA_OUTPUT_PROMPT_V3
  : GAP_IA_OUTPUT_PROMPT;

const parser = useV3Prompt
  ? parseAndMapGapIaOutput
  : (raw) => GapIaV2AiOutputSchema.parse(JSON.parse(raw));
```

### Phase 2: Full Cutover
Once validated in production:
1. Remove old `GAP_IA_OUTPUT_PROMPT`
2. Rename `GAP_IA_OUTPUT_PROMPT_V3` → `GAP_IA_OUTPUT_PROMPT`
3. Remove feature flag

## Next Steps

After GAP-IA V3 is live:
1. Apply same approach to **Full GAP prompt** (even more verbose currently)
2. Add **benchmark comparison** to show V3 produces tighter, more actionable output
3. Implement **A/B testing** to measure which version drives more Full GAP conversions
