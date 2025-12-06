// lib/qbr/qbrNarrativeAi.ts
// QBR Story AI Narrative Generator
//
// Generates QBR story narratives using Claude AI.
// Aligned with existing Anthropic usage patterns in the codebase.

import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import {
  QbrStory,
  QbrDomain,
  QbrStoryMeta,
  QbrStoryChapter,
  StoryBlock,
  SectionIntroBlock,
  AiParagraphBlock,
  InsightClusterBlock,
  RecommendationsBlock,
  MetaCalloutBlock,
  NodeDeltasBlock,
  ContextIntegrityBlock,
  GlobalContextHealthBlock,
  DomainBundleRoot,
  DomainBundle,
  domainToTitle,
  QBR_DOMAINS,
  RegenerationMode,
} from './qbrTypes';
import { getFieldLabel } from './contextDeltas';

// ============================================================================
// Types
// ============================================================================

interface NarrativeAiArgs {
  companyId: string;
  quarter: string;
  domainBundle: DomainBundleRoot;
  dataConfidenceScore: number;
  existingStory?: QbrStory;
  regenerationMode?: RegenerationMode;
  targetDomain?: QbrDomain | 'all';
}

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate QBR narrative using AI
 */
export async function generateNarrativeWithAi(args: NarrativeAiArgs): Promise<QbrStory> {
  const {
    companyId,
    quarter,
    domainBundle,
    dataConfidenceScore,
    existingStory,
    regenerationMode,
    targetDomain,
  } = args;

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[QbrNarrativeAi] No ANTHROPIC_API_KEY, using fallback skeleton');
    return existingStory ?? fallbackSkeletonStory(companyId, quarter, domainBundle, dataConfidenceScore);
  }

  try {
    const anthropic = new Anthropic();

    // Build the system prompt and context
    const systemPrompt = buildSystemPrompt(regenerationMode);
    const userContent = buildUserContent(
      companyId,
      quarter,
      domainBundle,
      dataConfidenceScore,
      existingStory,
      regenerationMode,
      targetDomain
    );

    console.log(`[QbrNarrativeAi] Generating narrative for ${companyId}/${quarter}`);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: userContent,
        },
      ],
      system: systemPrompt,
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse the AI response into story blocks
    const parsedStory = parseAiResponseToStory({
      companyId,
      quarter,
      dataConfidenceScore,
      responseText,
      domainBundle,
      existingStory,
      regenerationMode,
      targetDomain,
    });

    console.log(`[QbrNarrativeAi] Successfully generated story with ${parsedStory.chapters.length} chapters`);

    return parsedStory;
  } catch (error) {
    console.error('[QbrNarrativeAi] Error generating narrative:', error);
    // Return fallback on error
    return existingStory ?? fallbackSkeletonStory(companyId, quarter, domainBundle, dataConfidenceScore);
  }
}

// ============================================================================
// Prompt Building
// ============================================================================

function buildSystemPrompt(regenerationMode?: RegenerationMode): string {
  let modeInstructions = '';

  if (regenerationMode) {
    switch (regenerationMode) {
      case 'full_rewrite':
        modeInstructions = '\n\nYou are doing a FULL REWRITE. Generate completely fresh content based on the latest data.';
        break;
      case 'clarity':
        modeInstructions = '\n\nYou are IMPROVING CLARITY. Keep the same structure and key points, but make the language clearer and more concise.';
        break;
      case 'shorter':
        modeInstructions = '\n\nYou are making the content SHORTER. Condense the narrative while keeping key insights. Reduce bullet points and paragraph length.';
        break;
      case 'longer':
        modeInstructions = '\n\nYou are making the content LONGER. Expand on insights with more detail, add more context, and provide deeper analysis.';
        break;
    }
  }

  return `You are a senior marketing strategist writing a Quarterly Business Review (QBR) narrative.

Your task is to generate a structured QBR story that:
1. Summarizes key wins, challenges, and changes from the quarter
2. Analyzes each marketing domain (strategy, website, SEO, content, brand, audience, media, analytics)
3. Provides actionable insights and recommendations
4. Maintains a professional but engaging tone suitable for executive stakeholders

IMPORTANT - Context Graph Integrity:
Use Context Graph integrity as a narrative driver. For each domain:
- Call out conflicted fields explicitly when present
- When a Human Override exists, explain the implication (human judgment was applied)
- When context freshness is low, warn that guidance may be based on stale data
- When domain context is clean and fresh, mention stability and clarity of direction
- Connect conflicts to strategic risks automatically
- Use contextIntegrity data to shape the tone: stable, ambiguous, conflicted, or uncertain

Your narrative MUST reference fields the system flagged as problematic.

Output Format:
Structure your response using clear section headers in this format:

## GLOBAL SUMMARY
[Overall quarter summary - 2-3 paragraphs about company-wide performance]
[If there are context conflicts, mention them: "Note: X fields have conflicting data that may affect this analysis."]

## DOMAIN: [DOMAIN_NAME]
### Summary
[2-3 sentences summarizing this domain's quarter]
[If domain has conflicted/stale fields, note: "Context Quality: [stable/mixed/uncertain]"]

### Key Points
- [Bullet point 1]
- [Bullet point 2]
- [Bullet point 3]

### Insights
[1 paragraph of analysis and insights]
[Reference any problematic context fields and their implications]

### Recommendations
- [Recommendation 1]
- [Recommendation 2]

(Repeat for each domain with data)

## KEY WINS
- [Win 1]
- [Win 2]

## KEY RISKS
- [Risk 1]
- [Risk 2]
[Include context-related risks like "Conflicted positioning data may lead to inconsistent messaging"]

## RECOMMENDATIONS
- [Overall recommendation 1]
- [Overall recommendation 2]${modeInstructions}`;
}

function buildUserContent(
  companyId: string,
  quarter: string,
  domainBundle: DomainBundleRoot,
  dataConfidenceScore: number,
  existingStory?: QbrStory,
  regenerationMode?: RegenerationMode,
  targetDomain?: QbrDomain | 'all'
): string {
  const parts: string[] = [];

  parts.push(`Generate a QBR Story for company ${companyId} for ${quarter}.`);
  parts.push(`Data confidence score: ${dataConfidenceScore}%`);
  parts.push('');

  // Global context
  parts.push('=== GLOBAL CONTEXT ===');
  if (domainBundle.global.topWins.length > 0) {
    parts.push(`Top Wins: ${domainBundle.global.topWins.join(', ')}`);
  }
  if (domainBundle.global.topRisks.length > 0) {
    parts.push(`Top Risks: ${domainBundle.global.topRisks.join(', ')}`);
  }

  // Global context integrity summary
  if (domainBundle.global.globalContextSummary) {
    const gcs = domainBundle.global.globalContextSummary;
    parts.push('');
    parts.push('=== GLOBAL CONTEXT INTEGRITY ===');
    parts.push(`Total Conflicted Fields: ${gcs.totalConflicted}`);
    parts.push(`Total Human Overrides: ${gcs.totalOverrides}`);
    parts.push(`Total Stale Fields: ${gcs.totalStale}`);
    parts.push(`Total Low Confidence Fields: ${gcs.totalLowConfidence}`);

    if (gcs.totalConflicted > 0 || gcs.totalStale > 3) {
      parts.push('');
      parts.push('WARNING: Significant context quality issues detected. Address these in the narrative.');
    }
  }
  parts.push('');

  // Per-domain data
  const domainsToProcess = targetDomain && targetDomain !== 'all'
    ? domainBundle.domains.filter(d => d.domain === targetDomain)
    : domainBundle.domains;

  for (const domain of domainsToProcess) {
    parts.push(`=== DOMAIN: ${domainToTitle(domain.domain).toUpperCase()} ===`);
    parts.push(`Strategic Role: ${domain.strategicRole}`);

    // Context integrity for this domain
    if (domain.contextIntegrity) {
      const ci = domain.contextIntegrity;
      parts.push('');
      parts.push('Context Integrity:');
      parts.push(`  Conflicted: ${ci.conflicted}, Overrides: ${ci.overrides}, Stale: ${ci.stale}, Low Confidence: ${ci.lowConfidence}`);

      if (ci.problematicFields.length > 0) {
        parts.push('  Problematic Fields:');
        for (const field of ci.problematicFields.slice(0, 5)) {
          parts.push(`    - ${field.label} (${field.key}): ${field.status}, conf ${field.confidence}%, fresh ${field.freshness}%${field.isHumanOverride ? ' [OVERRIDE]' : ''}`);
        }
      }
    }

    if (domain.contextDeltas.length > 0) {
      parts.push('Context Changes:');
      for (const delta of domain.contextDeltas.slice(0, 5)) {
        parts.push(`  - ${delta.label}: ${delta.changeType}${delta.comment ? ` (${delta.comment})` : ''}`);
      }
    }

    if (domain.topInsights.length > 0) {
      parts.push('Top Insights:');
      for (const insight of domain.topInsights.slice(0, 4)) {
        parts.push(`  - ${insight.title}: ${insight.summary.slice(0, 100)}...`);
      }
    }

    if (domain.workSummary.keyWorkItems.length > 0) {
      parts.push(`Work Items: ${domain.workSummary.completed} completed, ${domain.workSummary.created} total`);
      for (const item of domain.workSummary.keyWorkItems.slice(0, 3)) {
        parts.push(`  - ${item.title} (${item.status})`);
      }
    }

    if (domain.gapAndLabsSummary.runs.length > 0) {
      parts.push('Diagnostic Runs:');
      for (const run of domain.gapAndLabsSummary.runs.slice(0, 3)) {
        parts.push(`  - ${run.toolSlug}: ${run.summary || 'Completed'}`);
      }
    }

    parts.push('');
  }

  // If regenerating, include existing content for context
  if (existingStory && regenerationMode && regenerationMode !== 'full_rewrite') {
    parts.push('=== EXISTING CONTENT (for reference) ===');
    for (const chapter of existingStory.chapters) {
      if (targetDomain && targetDomain !== 'all' && chapter.domain !== targetDomain) {
        continue;
      }
      parts.push(`Domain: ${chapter.title}`);
      for (const block of chapter.blocks) {
        if (block.kind === 'ai_paragraph') {
          parts.push(`Content: ${(block as AiParagraphBlock).body.slice(0, 200)}...`);
        }
      }
    }
  }

  return parts.join('\n');
}

// ============================================================================
// Response Parsing
// ============================================================================

interface ParseArgs {
  companyId: string;
  quarter: string;
  dataConfidenceScore: number;
  responseText: string;
  domainBundle: DomainBundleRoot;
  existingStory?: QbrStory;
  regenerationMode?: RegenerationMode;
  targetDomain?: QbrDomain | 'all';
}

function parseAiResponseToStory(args: ParseArgs): QbrStory {
  const {
    companyId,
    quarter,
    dataConfidenceScore,
    responseText,
    domainBundle,
    existingStory,
    regenerationMode,
    targetDomain,
  } = args;

  const meta: QbrStoryMeta = {
    companyId,
    quarter,
    generatedAt: new Date().toISOString(),
    generatedBy: 'ai',
    modelVersion: 'qbr-claude-sonnet-v1',
    dataConfidenceScore,
    status: 'draft',
    regenerationHistory: existingStory?.meta.regenerationHistory || [],
  };

  // Parse the structured response
  const sections = parseResponseSections(responseText);

  // Build global blocks
  const globalBlocks: StoryBlock[] = [];
  let globalOrder = 0;

  // Global summary
  if (sections.globalSummary) {
    globalBlocks.push({
      id: randomUUID(),
      kind: 'section_intro',
      domain: 'global',
      order: globalOrder++,
      title: `${quarter} Quarterly Business Review`,
      subtitle: 'Executive Summary',
      summaryBullets: extractBullets(sections.globalSummary).slice(0, 5),
      provenance: { source: 'ai' },
    } as SectionIntroBlock);

    // Global Context Health Block (right after section intro)
    if (domainBundle.global.globalContextSummary) {
      const gcs = domainBundle.global.globalContextSummary;
      globalBlocks.push({
        id: randomUUID(),
        kind: 'global_context_health',
        domain: 'global',
        order: globalOrder++,
        totals: {
          conflicted: gcs.totalConflicted,
          overrides: gcs.totalOverrides,
          stale: gcs.totalStale,
          lowConfidence: gcs.totalLowConfidence,
        },
        provenance: { source: 'system' },
      } as GlobalContextHealthBlock);
    }

    globalBlocks.push({
      id: randomUUID(),
      kind: 'ai_paragraph',
      domain: 'global',
      order: globalOrder++,
      title: 'Quarter Overview',
      body: sections.globalSummary,
      provenance: { source: 'ai' },
    } as AiParagraphBlock);
  }

  // Key wins callout
  if (sections.keyWins.length > 0) {
    globalBlocks.push({
      id: randomUUID(),
      kind: 'meta_callout',
      domain: 'global',
      order: globalOrder++,
      title: 'Key Wins',
      body: sections.keyWins.map(w => `• ${w}`).join('\n'),
      tone: 'success',
      provenance: { source: 'ai' },
    } as MetaCalloutBlock);
  }

  // Key risks callout
  if (sections.keyRisks.length > 0) {
    globalBlocks.push({
      id: randomUUID(),
      kind: 'meta_callout',
      domain: 'global',
      order: globalOrder++,
      title: 'Key Risks',
      body: sections.keyRisks.map(r => `• ${r}`).join('\n'),
      tone: 'warning',
      provenance: { source: 'ai' },
    } as MetaCalloutBlock);
  }

  // Global recommendations
  if (sections.recommendations.length > 0) {
    globalBlocks.push({
      id: randomUUID(),
      kind: 'recommendations',
      domain: 'global',
      order: globalOrder++,
      headline: 'Strategic Recommendations',
      priority: 'now',
      items: sections.recommendations.map((r, i) => ({
        id: randomUUID(),
        title: r.split(':')[0] || r.slice(0, 50),
        description: r,
        estimatedImpact: i < 2 ? 'high' : 'medium',
      })),
      provenance: { source: 'ai' },
    } as RecommendationsBlock);
  }

  // Build chapters from domain sections
  const chapters: QbrStoryChapter[] = [];

  for (const domain of QBR_DOMAINS) {
    // Skip domains not in target if regenerating specific domain
    if (targetDomain && targetDomain !== 'all' && domain !== targetDomain) {
      // Use existing chapter if available
      const existingChapter = existingStory?.chapters.find(c => c.domain === domain);
      if (existingChapter) {
        chapters.push(existingChapter);
      }
      continue;
    }

    const domainSection = sections.domains.get(domain);
    const domainData = domainBundle.domains.find(d => d.domain === domain);

    const blocks: StoryBlock[] = [];
    let order = 0;

    // Section intro
    blocks.push({
      id: randomUUID(),
      kind: 'section_intro',
      domain,
      order: order++,
      title: domainToTitle(domain),
      subtitle: domainData?.strategicRole || '',
      summaryBullets: domainSection?.keyPoints || [],
      provenance: { source: 'ai' },
    } as SectionIntroBlock);

    // Main content
    if (domainSection?.summary) {
      blocks.push({
        id: randomUUID(),
        kind: 'ai_paragraph',
        domain,
        order: order++,
        title: 'Summary',
        body: domainSection.summary,
        provenance: { source: 'ai' },
      } as AiParagraphBlock);
    }

    // Insights
    if (domainSection?.insights) {
      blocks.push({
        id: randomUUID(),
        kind: 'ai_paragraph',
        domain,
        order: order++,
        title: 'Analysis & Insights',
        body: domainSection.insights,
        provenance: { source: 'ai' },
      } as AiParagraphBlock);
    }

    // Context deltas if available
    if (domainData?.contextDeltas && domainData.contextDeltas.length > 0) {
      blocks.push({
        id: randomUUID(),
        kind: 'node_deltas',
        domain,
        order: order++,
        graphDeltas: domainData.contextDeltas,
        provenance: { source: 'system' },
      } as NodeDeltasBlock);
    }

    // Domain recommendations
    if (domainSection?.recommendations && domainSection.recommendations.length > 0) {
      blocks.push({
        id: randomUUID(),
        kind: 'recommendations',
        domain,
        order: order++,
        headline: 'Recommendations',
        priority: 'next',
        items: domainSection.recommendations.map((r) => ({
          id: randomUUID(),
          title: r.split(':')[0] || r.slice(0, 50),
          description: r,
        })),
        provenance: { source: 'ai' },
      } as RecommendationsBlock);
    }

    // Insights cluster if we have domain insights
    if (domainData?.topInsights && domainData.topInsights.length > 0) {
      blocks.push({
        id: randomUUID(),
        kind: 'insight_cluster',
        domain,
        order: order++,
        clusterLabel: 'Key Insights',
        clusterType: 'opportunity',
        insights: domainData.topInsights,
        provenance: { source: 'system' },
      } as InsightClusterBlock);
    }

    // Context Integrity Block for this domain
    if (domainData?.contextIntegrity) {
      const ci = domainData.contextIntegrity;
      const hasIssues = ci.conflicted > 0 || ci.stale > 0 || ci.lowConfidence > 0 || ci.overrides > 0;

      if (hasIssues) {
        blocks.push({
          id: randomUUID(),
          kind: 'context_integrity',
          domain,
          order: order++,
          conflicted: ci.conflicted,
          overrides: ci.overrides,
          stale: ci.stale,
          lowConfidence: ci.lowConfidence,
          items: ci.problematicFields.slice(0, 10).map(field => ({
            key: field.key,
            label: getFieldLabel(field.key),
            status: field.status,
            confidence: field.confidence,
            freshness: field.freshness,
            isHumanOverride: field.isHumanOverride,
          })),
          provenance: { source: 'system' },
        } as ContextIntegrityBlock);
      }
    }

    // Detect chapter state (win/regression/mixed)
    // Factor in context integrity: conflicts suggest uncertainty, stale suggests regression risk
    const hasWins = domainSection?.keyPoints?.some(p =>
      p.toLowerCase().includes('improve') ||
      p.toLowerCase().includes('success') ||
      p.toLowerCase().includes('growth')
    );
    const hasRegressions = domainSection?.keyPoints?.some(p =>
      p.toLowerCase().includes('decline') ||
      p.toLowerCase().includes('issue') ||
      p.toLowerCase().includes('challenge')
    );

    // Context integrity can indicate mixed state when conflicts present
    const hasContextIssues = domainData?.contextIntegrity &&
      (domainData.contextIntegrity.conflicted > 0 || domainData.contextIntegrity.stale > 2);

    chapters.push({
      id: `${companyId}-${quarter}-${domain}`,
      domain,
      title: domainToTitle(domain),
      scoreDelta: domainData?.scoreBefore !== undefined && domainData?.scoreAfter !== undefined
        ? {
            before: domainData.scoreBefore,
            after: domainData.scoreAfter,
            change: domainData.scoreAfter - domainData.scoreBefore,
          }
        : undefined,
      autoDetectedState: {
        win: hasWins && !hasRegressions && !hasContextIssues,
        regression: hasRegressions && !hasWins,
        mixed: (hasWins && hasRegressions) || (hasWins && hasContextIssues),
      },
      blocks,
    });
  }

  return {
    meta,
    globalBlocks,
    chapters,
  };
}

// ============================================================================
// Response Section Parsing
// ============================================================================

interface DomainSection {
  summary?: string;
  keyPoints: string[];
  insights?: string;
  recommendations: string[];
}

interface ParsedSections {
  globalSummary?: string;
  domains: Map<QbrDomain, DomainSection>;
  keyWins: string[];
  keyRisks: string[];
  recommendations: string[];
}

function parseResponseSections(responseText: string): ParsedSections {
  const sections: ParsedSections = {
    domains: new Map(),
    keyWins: [],
    keyRisks: [],
    recommendations: [],
  };

  // Split by major headers
  const lines = responseText.split('\n');
  let currentSection = '';
  let currentDomain: QbrDomain | null = null;
  let currentDomainPart = '';
  let buffer: string[] = [];

  for (const line of lines) {
    // Check for section headers
    if (line.startsWith('## GLOBAL SUMMARY')) {
      saveBuffer();
      currentSection = 'global';
      currentDomain = null;
      continue;
    }

    if (line.startsWith('## DOMAIN:')) {
      saveBuffer();
      currentSection = 'domain';
      const domainName = line.replace('## DOMAIN:', '').trim().toLowerCase();
      currentDomain = matchDomainName(domainName);
      currentDomainPart = 'summary';
      continue;
    }

    if (line.startsWith('## KEY WINS')) {
      saveBuffer();
      currentSection = 'wins';
      currentDomain = null;
      continue;
    }

    if (line.startsWith('## KEY RISKS')) {
      saveBuffer();
      currentSection = 'risks';
      currentDomain = null;
      continue;
    }

    if (line.startsWith('## RECOMMENDATIONS')) {
      saveBuffer();
      currentSection = 'recommendations';
      currentDomain = null;
      continue;
    }

    // Check for domain sub-sections
    if (currentSection === 'domain') {
      if (line.startsWith('### Summary')) {
        saveBuffer();
        currentDomainPart = 'summary';
        continue;
      }
      if (line.startsWith('### Key Points')) {
        saveBuffer();
        currentDomainPart = 'keyPoints';
        continue;
      }
      if (line.startsWith('### Insights')) {
        saveBuffer();
        currentDomainPart = 'insights';
        continue;
      }
      if (line.startsWith('### Recommendations')) {
        saveBuffer();
        currentDomainPart = 'domainRecs';
        continue;
      }
    }

    // Accumulate content
    buffer.push(line);
  }

  // Save final buffer
  saveBuffer();

  return sections;

  function saveBuffer() {
    const content = buffer.join('\n').trim();
    buffer = [];

    if (!content) return;

    if (currentSection === 'global') {
      sections.globalSummary = content;
    } else if (currentSection === 'wins') {
      sections.keyWins = extractBullets(content);
    } else if (currentSection === 'risks') {
      sections.keyRisks = extractBullets(content);
    } else if (currentSection === 'recommendations') {
      sections.recommendations = extractBullets(content);
    } else if (currentSection === 'domain' && currentDomain) {
      let domainData = sections.domains.get(currentDomain);
      if (!domainData) {
        domainData = { keyPoints: [], recommendations: [] };
        sections.domains.set(currentDomain, domainData);
      }

      switch (currentDomainPart) {
        case 'summary':
          domainData.summary = content;
          break;
        case 'keyPoints':
          domainData.keyPoints = extractBullets(content);
          break;
        case 'insights':
          domainData.insights = content;
          break;
        case 'domainRecs':
          domainData.recommendations = extractBullets(content);
          break;
      }
    }
  }
}

function matchDomainName(name: string): QbrDomain | null {
  const normalized = name.toLowerCase().replace(/[^a-z]/g, '');

  if (normalized.includes('strategy') || normalized.includes('direction')) return 'strategy';
  if (normalized.includes('website') || normalized.includes('conversion')) return 'website';
  if (normalized.includes('seo') || normalized.includes('visibility')) return 'seo';
  if (normalized.includes('content') || normalized.includes('messaging')) return 'content';
  if (normalized.includes('brand') || normalized.includes('identity')) return 'brand';
  if (normalized.includes('audience') || normalized.includes('segment')) return 'audience';
  if (normalized.includes('media') || normalized.includes('demand')) return 'media';
  if (normalized.includes('analytics') || normalized.includes('measurement')) return 'analytics';

  return null;
}

function extractBullets(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- ') || line.startsWith('• ') || line.match(/^\d+\./))
    .map(line => line.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter(line => line.length > 0);
}

// ============================================================================
// Fallback Skeleton
// ============================================================================

function fallbackSkeletonStory(
  companyId: string,
  quarter: string,
  bundle: DomainBundleRoot,
  dataConfidenceScore: number
): QbrStory {
  const meta: QbrStoryMeta = {
    companyId,
    quarter,
    generatedAt: new Date().toISOString(),
    generatedBy: 'ai',
    modelVersion: 'qbr-fallback-v0',
    dataConfidenceScore,
    status: 'draft',
    regenerationHistory: [],
  };

  const globalBlocks: StoryBlock[] = [
    {
      id: randomUUID(),
      kind: 'section_intro',
      domain: 'global',
      order: 0,
      title: `${quarter} Quarterly Business Review`,
      subtitle: 'AI narrative generation pending',
      summaryBullets: [
        'This is a placeholder QBR story.',
        'Configure ANTHROPIC_API_KEY to enable AI-powered narrative generation.',
        'Data has been gathered from context graph, insights, and work items.',
      ],
      provenance: { source: 'system' },
    } as SectionIntroBlock,
  ];

  // Add global context health block if we have context summary
  if (bundle.global.globalContextSummary) {
    const gcs = bundle.global.globalContextSummary;
    globalBlocks.push({
      id: randomUUID(),
      kind: 'global_context_health',
      domain: 'global',
      order: 1,
      totals: {
        conflicted: gcs.totalConflicted,
        overrides: gcs.totalOverrides,
        stale: gcs.totalStale,
        lowConfidence: gcs.totalLowConfidence,
      },
      provenance: { source: 'system' },
    } as GlobalContextHealthBlock);
  }

  globalBlocks.push({
    id: randomUUID(),
    kind: 'meta_callout',
    domain: 'global',
    order: globalBlocks.length,
    title: 'AI Configuration Required',
    body: 'Set ANTHROPIC_API_KEY environment variable to generate AI-powered QBR narratives.',
    tone: 'info',
    provenance: { source: 'system' },
  } as MetaCalloutBlock);

  const chapters: QbrStoryChapter[] = bundle.domains.map((d) => {
    const blocks: StoryBlock[] = [
      {
        id: randomUUID(),
        kind: 'section_intro',
        domain: d.domain,
        order: 0,
        title: domainToTitle(d.domain),
        subtitle: d.strategicRole,
        summaryBullets: [
          'Placeholder content for this domain.',
          `${d.topInsights.length} insights gathered.`,
          `${d.workSummary.keyWorkItems.length} work items tracked.`,
        ],
        provenance: { source: 'system' },
      } as SectionIntroBlock,
    ];

    // Add context integrity block if domain has issues
    if (d.contextIntegrity) {
      const ci = d.contextIntegrity;
      const hasIssues = ci.conflicted > 0 || ci.stale > 0 || ci.lowConfidence > 0 || ci.overrides > 0;

      if (hasIssues) {
        blocks.push({
          id: randomUUID(),
          kind: 'context_integrity',
          domain: d.domain,
          order: 1,
          conflicted: ci.conflicted,
          overrides: ci.overrides,
          stale: ci.stale,
          lowConfidence: ci.lowConfidence,
          items: ci.problematicFields.slice(0, 10).map(field => ({
            key: field.key,
            label: getFieldLabel(field.key),
            status: field.status,
            confidence: field.confidence,
            freshness: field.freshness,
            isHumanOverride: field.isHumanOverride,
          })),
          provenance: { source: 'system' },
        } as ContextIntegrityBlock);
      }
    }

    return {
      id: `${companyId}-${quarter}-${d.domain}`,
      domain: d.domain,
      title: domainToTitle(d.domain),
      blocks,
    };
  });

  return {
    meta,
    globalBlocks,
    chapters,
  };
}
