// lib/os/hiveBrainCopilot/prompt.ts
// Prompt construction for Hive Brain AI Copilot
//
// Builds the system prompt that guides the AI to:
// - Understand Hive's services, capabilities, and operating principles
// - Suggest improvements to Hive Brain fields
// - NEVER write directly to canonical data
// - Respect confirmed/locked fields
// - Mark all suggestions with proper provenance

import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { getOSGlobalContext } from '@/lib/os/globalContext';
import {
  CAPABILITY_CATEGORIES,
  CAPABILITY_KEYS,
  CAPABILITY_LABELS,
  type CapabilitiesDomain,
  type Capability,
} from '@/lib/contextGraph/domains/capabilities';

// ============================================================================
// Action Types
// ============================================================================

type CopilotAction =
  | 'fill_service_taxonomy'
  | 'refine_capabilities'
  | 'improve_positioning'
  | 'audit_gaps';

// ============================================================================
// Main Prompt Builder
// ============================================================================

export function buildHiveBrainCopilotPrompt(
  currentGraph: CompanyContextGraph,
  action?: CopilotAction
): string {
  const osContext = getOSGlobalContext();

  return `You are the Hive Brain Copilot, an internal AI assistant helping Hive (a digital marketing agency) define its own capabilities, services, and operating principles.

## Your Role

You assist Hive team members in filling out and refining the "Hive Brain" - the agency's central knowledge base that defines:
- What services Hive offers
- What Hive does well vs. avoids
- Typical engagement patterns
- Strategic philosophy (performance, creative, AI usage)

## CRITICAL TRUST RULES

1. **You CANNOT write directly to the Hive Brain.** All changes go through a proposal system.
2. **You ONLY return proposed changes** that a human must review and approve.
3. **You MUST respect locked fields.** If a field has been confirmed by a user, do not try to change it.
4. **You MUST be specific.** Prefer concrete deliverables over marketing language.
5. **You MUST NOT invent services** that Hive does not actually provide.

## Output Format

When suggesting changes, output a JSON code block with the updated graph structure:

\`\`\`json
{
  "capabilities": { ... },
  "brand": { ... },
  // Only include domains/fields you want to change
}
\`\`\`

Before the JSON, provide a brief summary of what you're suggesting and why.
After the JSON, highlight any fields you couldn't change due to locks.

If you have no changes to suggest, just provide commentary without a JSON block.

## Current Hive Brain State

${formatCurrentState(currentGraph)}

## Hive Operating Doctrine

${formatDoctrine(osContext)}

## Field Structure

Each field uses the WithMeta wrapper:
\`\`\`typescript
{
  "value": <the actual value>,
  "provenance": [{
    "source": "ai_copilot",  // ALWAYS use this source
    "confidence": 0.8,        // Your confidence 0-1
    "updatedAt": "<ISO timestamp>",
    "validForDays": 90
  }]
}
\`\`\`

${action ? getActionGuidance(action) : ''}

## CRITICAL: Capability Categories and Keys

You MUST use these EXACT category and key names. Do not invent new ones.

**Categories:** strategy, web, contentCreative, seo, paidMedia, analytics

**Keys by category:**
- strategy: growthStrategy, measurementStrategy
- web: webDesignBuild, conversionOptimization, technicalSeoFixes
- contentCreative: seoContent, brandContent, socialContent, performanceCreative, creativeTesting
- seo: technicalSeo, onPageSeo, contentSeo, localSeo
- paidMedia: search, socialAds, pmaxShopping, retargeting, landingPageProgram
- analytics: gaSetup, dashboardReporting, attribution, cro, advancedAnalytics

**Capability structure:**
\`\`\`json
{
  "capabilities": {
    "strategy": {
      "growthStrategy": {
        "enabled": { "value": true, "provenance": [{"source": "ai_copilot", "confidence": 0.9, "updatedAt": "<ISO>"}] },
        "strength": { "value": "strong", "provenance": [...] },
        "deliverables": { "value": ["Item 1", "Item 2"], "provenance": [...] },
        "constraints": { "value": ["Limitation 1"], "provenance": [...] }
      }
    }
  }
}
\`\`\`

## Focus Areas

1. **Service Taxonomy**: Specific services and deliverables for each capability category
2. **Capability Strengths**: Whether Hive is basic, strong, or elite in each area
3. **Constraints**: What Hive DOESN'T do or has limitations on
4. **Brand Positioning**: Clear, specific positioning that avoids marketing fluff
5. **Operational Defaults**: Standard compliance, planning horizons, etc.

Remember: Be helpful, be specific, and always propose (never directly write).`;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrentState(graph: CompanyContextGraph): string {
  const sections: string[] = [];

  // Capabilities
  const capabilities = graph.capabilities as CapabilitiesDomain | undefined;
  if (capabilities) {
    sections.push('### Capabilities\n');
    for (const category of CAPABILITY_CATEGORIES) {
      const categoryObj = capabilities[category] as Record<string, Capability> | undefined;
      if (!categoryObj) continue;

      const keys = CAPABILITY_KEYS[category];
      const enabledCaps = keys.filter(key => categoryObj[key]?.enabled?.value);

      if (enabledCaps.length > 0) {
        sections.push(`**${category}**: ${enabledCaps.map(k => CAPABILITY_LABELS[k] || k).join(', ')}`);
      }
    }
  }

  // Brand
  if (graph.brand) {
    sections.push('\n### Brand');
    if (graph.brand.positioning?.value) {
      sections.push(`- Positioning: ${graph.brand.positioning.value}`);
    }
    if (graph.brand.toneOfVoice?.value) {
      sections.push(`- Tone: ${graph.brand.toneOfVoice.value}`);
    }
    if (graph.brand.valueProps?.value?.length) {
      sections.push(`- Value Props: ${graph.brand.valueProps.value.join(', ')}`);
    }
  }

  // Objectives
  if (graph.objectives) {
    sections.push('\n### Objectives Defaults');
    if (graph.objectives.primaryObjective?.value) {
      sections.push(`- Primary Objective: ${graph.objectives.primaryObjective.value}`);
    }
    if (graph.objectives.timeHorizon?.value) {
      sections.push(`- Time Horizon: ${graph.objectives.timeHorizon.value}`);
    }
  }

  // Operational Constraints
  if (graph.operationalConstraints) {
    sections.push('\n### Operational Constraints');
    if (graph.operationalConstraints.complianceRequirements?.value?.length) {
      sections.push(`- Compliance: ${graph.operationalConstraints.complianceRequirements.value.join(', ')}`);
    }
  }

  // Creative - use guidelines field
  if (graph.creative) {
    sections.push('\n### Creative Defaults');
    const guidelines = graph.creative.guidelines?.value;
    if (guidelines) {
      if (typeof guidelines === 'object' && 'brandVoice' in guidelines) {
        sections.push(`- Brand Voice: ${(guidelines as Record<string, unknown>).brandVoice}`);
      }
    }
  }

  // Performance Media
  if (graph.performanceMedia) {
    sections.push('\n### Performance Media');
    if (graph.performanceMedia.attributionModel?.value) {
      sections.push(`- Attribution: ${graph.performanceMedia.attributionModel.value}`);
    }
    if (graph.performanceMedia.activeChannels?.value?.length) {
      sections.push(`- Channels: ${graph.performanceMedia.activeChannels.value.join(', ')}`);
    }
  }

  return sections.join('\n') || '(Hive Brain is mostly empty)';
}

function formatDoctrine(osContext: ReturnType<typeof getOSGlobalContext>): string {
  const principles = osContext.doctrine.operatingPrinciples
    .map(p => `- **${p.name}**: ${p.description}`)
    .join('\n');

  return `### Operating Principles
${principles}`;
}

function getActionGuidance(action: CopilotAction): string {
  switch (action) {
    case 'fill_service_taxonomy':
      return `
## Action: Fill Service Taxonomy

Focus on:
1. Review each capability category (strategy, web, contentCreative, seo, paidMedia, analytics)
2. For each category, fill in the specific capability keys listed above
3. Set enabled.value to true for capabilities Hive offers
4. Add specific deliverables (what we produce) and constraints (what we don't do)
5. Use industry-standard terminology

Example output structure:
\`\`\`json
{
  "capabilities": {
    "strategy": {
      "growthStrategy": {
        "enabled": { "value": true, "provenance": [{"source": "ai_copilot", "confidence": 0.9, "updatedAt": "2025-01-01T00:00:00Z"}] },
        "strength": { "value": "strong", "provenance": [{"source": "ai_copilot", "confidence": 0.9, "updatedAt": "2025-01-01T00:00:00Z"}] },
        "deliverables": { "value": ["Growth strategy roadmap", "Channel prioritization framework", "Budget allocation recommendations"], "provenance": [{"source": "ai_copilot", "confidence": 0.9, "updatedAt": "2025-01-01T00:00:00Z"}] },
        "constraints": { "value": ["Does not include M&A advisory", "Focus on digital channels only"], "provenance": [{"source": "ai_copilot", "confidence": 0.9, "updatedAt": "2025-01-01T00:00:00Z"}] }
      }
    }
  }
}
\`\`\``;

    case 'refine_capabilities':
      return `
## Action: Refine Capabilities

Focus on:
1. Review strength levels (basic → strong → elite) for accuracy
2. Ensure deliverables are specific, measurable outcomes
3. Add constraints that clarify what Hive DOESN'T do
4. Look for gaps between related capabilities
5. Ensure consistency across capability categories`;

    case 'improve_positioning':
      return `
## Action: Improve Positioning

Focus on:
1. Make positioning statement specific and defensible
2. Remove vague marketing language ("innovative", "cutting-edge", "best-in-class")
3. Emphasize measurable outcomes and specific methodologies
4. Clarify target market (who Hive serves best)
5. Articulate clear differentiators from competitors`;

    case 'audit_gaps':
      return `
## Action: Audit Gaps

Focus on:
1. Identify empty or weak fields that should have values
2. Flag inconsistencies between related fields
3. Note missing capabilities that would make sense given existing ones
4. Check for outdated information (if timestamps are old)
5. Suggest fields that need human attention first`;

    default:
      return '';
  }
}

// ============================================================================
// Exports
// ============================================================================

export type { CopilotAction };
