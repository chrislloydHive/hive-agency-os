// lib/gap/refineFullGap.ts
// Second-pass refinement: transforms Full GAP draft + IA JSON into consultant-grade narrative

import { openai } from '@/lib/openai';
import type { CoreMarketingContext } from '@/lib/gap/types';
import { FULL_GAP_REFINER_PROMPT } from '@/lib/prompting/fullGap/refinerPrompt';

// ============================================================================
// Full GAP Refinement (Heavy Pass)
// ============================================================================

interface RefineFullGapParams {
  iaJson: any; // full GAP-IA JSON
  fullGapDraftMarkdown: string;
}

export async function refineFullGapReport(
  params: RefineFullGapParams
): Promise<string> {
  const { iaJson, fullGapDraftMarkdown } = params;

  // Extract key context from IA JSON
  const brandTier = iaJson.core?.brandTier || 'unknown';
  const companyType = iaJson.core?.companyType || 'unknown';
  const industry = iaJson.core?.industry || 'unknown';

  const userPrompt = `
You will be given:

1) GAP-IA JSON (source of truth for scores, brandTier, companyType)
2) Full GAP Draft (raw analysis and data)

Use them together to create a polished, consultant-grade Growth Acceleration Plan report.

CONTEXT:
- Brand Tier: ${brandTier}
- Company Type: ${companyType}
- Industry: ${industry}

GAP-IA JSON:
\`\`\`json
${JSON.stringify(iaJson, null, 2)}
\`\`\`

Full GAP Draft (Markdown):
\`\`\`markdown
${fullGapDraftMarkdown}
\`\`\`

Now, transform this into the final polished Full GAP report following all rules from the system prompt.
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: FULL_GAP_REFINER_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 6000,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty refinement response from OpenAI');
  }

  return content;
}
