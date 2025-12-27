// lib/os/ai/competitiveGuidance.ts
// Generates competitive positioning guidance for RFP sections
// Important: Never fabricates claims - only provides strategic direction

export interface CompetitorInfo {
  name: string;
  /** Known strengths (optional - from user input) */
  strengths?: string[];
  /** Known weaknesses (optional - from user input) */
  weaknesses?: string[];
}

export interface CompetitiveContext {
  /** List of competitors mentioned in RFP or by user */
  competitors: CompetitorInfo[];
  /** Our agency's key differentiators from Firm Brain */
  ourDifferentiators?: string[];
}

/**
 * Generate competitive positioning guidance for AI prompts
 *
 * IMPORTANT: This guidance helps shape tone and emphasis.
 * It does NOT make claims about competitors that we cannot verify.
 */
export function getCompetitiveGuidance(context: CompetitiveContext): string {
  if (!context.competitors?.length) {
    return '';
  }

  const lines: string[] = [];

  lines.push('## Competitive Context');
  lines.push('');
  lines.push('This proposal may be compared against the following competitors:');

  for (const competitor of context.competitors) {
    lines.push(`- ${competitor.name}`);
    if (competitor.strengths?.length) {
      lines.push(`  - Known for: ${competitor.strengths.join(', ')}`);
    }
  }

  lines.push('');
  lines.push('### Positioning Guidelines');
  lines.push('');
  lines.push('When writing this content:');
  lines.push('- Emphasize our unique value propositions and differentiators');
  lines.push('- Focus on concrete proof points and case studies');
  lines.push('- Highlight areas where we have demonstrated expertise');
  lines.push('- Show (don\'t tell) what makes us different through examples');
  lines.push('');
  lines.push('IMPORTANT: Do NOT:');
  lines.push('- Make negative statements about competitors');
  lines.push('- Fabricate claims or comparisons');
  lines.push('- Reference specific competitor pricing or capabilities');
  lines.push('- Use aggressive or defensive language');

  if (context.ourDifferentiators?.length) {
    lines.push('');
    lines.push('### Our Key Differentiators');
    lines.push('');
    lines.push('Emphasize these strengths naturally in the content:');
    for (const diff of context.ourDifferentiators) {
      lines.push(`- ${diff}`);
    }
  }

  return lines.join('\n');
}

/**
 * Parse competitor names from a comma-separated string
 */
export function parseCompetitorList(input: string): CompetitorInfo[] {
  if (!input?.trim()) return [];

  return input
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .map(name => ({ name }));
}

/**
 * Get section-specific competitive emphasis
 */
export function getSectionCompetitiveEmphasis(
  sectionKey: string,
  competitors: string[]
): string {
  if (!competitors?.length) return '';

  const emphasisBySection: Record<string, string> = {
    agency_overview: 'Emphasize unique agency culture, philosophy, and approach that sets us apart.',
    approach: 'Focus on our proven methodology and what makes our process distinctive.',
    team: 'Highlight team expertise, certifications, and unique backgrounds.',
    work_samples: 'Showcase case studies that demonstrate results in similar contexts.',
    plan_timeline: 'Emphasize our structured approach and realistic planning capabilities.',
    pricing: 'Focus on value delivered, not just cost. Show ROI thinking.',
    references: 'Highlight client relationships and long-term partnerships.',
  };

  return emphasisBySection[sectionKey] || '';
}

/**
 * Merge competitive guidance into existing prompt instructions
 */
export function injectCompetitiveGuidance(
  basePrompt: string,
  competitors: string[]
): string {
  if (!competitors?.length) return basePrompt;

  const context: CompetitiveContext = {
    competitors: competitors.map(name => ({ name })),
  };

  const guidance = getCompetitiveGuidance(context);
  if (!guidance) return basePrompt;

  // Insert competitive guidance before the main content generation instructions
  return `${guidance}\n\n---\n\n${basePrompt}`;
}
