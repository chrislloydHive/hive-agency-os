// lib/contextGraph/temporal/strategicNarratives.ts
// Strategic Memory Engine for Context Graph
//
// Phase 4: AI-generated narrative summaries of graph evolution

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import type { DomainName, CompanyContextGraph } from '../companyContextGraph';
import type { StrategicNarrative, NarrativePeriod, FieldHistoryEntry } from './types';
import { queryHistory, getCompanyChangeSummary } from './engine';

// ============================================================================
// Narrative Generation
// ============================================================================

/**
 * Generate a strategic narrative for a time period
 */
export async function generateStrategicNarrative(
  companyId: string,
  companyName: string,
  period: NarrativePeriod,
  graph: CompanyContextGraph
): Promise<StrategicNarrative> {
  const now = new Date();
  const endDate = now.toISOString();
  let startDate: string;

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'quarter':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'year':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
      break;
  }

  // Get change data
  const changeSummary = await getCompanyChangeSummary(companyId, startDate, endDate);
  const historyResult = await queryHistory({
    companyId,
    startDate,
    endDate,
    limit: 100,
    orderBy: 'timestamp_desc',
  });

  // Group changes by domain
  const changesByDomain = groupChangesByDomain(historyResult.entries);

  // Generate narrative with AI
  const narrative = await generateNarrativeWithAI(
    companyName,
    period,
    startDate,
    endDate,
    changeSummary,
    changesByDomain,
    graph
  );

  return {
    id: `narrative_${randomUUID()}`,
    companyId,
    period,
    startDate,
    endDate,
    generatedAt: now.toISOString(),
    ...narrative,
  };
}

/**
 * Group changes by domain for analysis
 */
function groupChangesByDomain(
  entries: FieldHistoryEntry[]
): Record<DomainName, FieldHistoryEntry[]> {
  const grouped: Record<string, FieldHistoryEntry[]> = {};

  for (const entry of entries) {
    if (!grouped[entry.domain]) {
      grouped[entry.domain] = [];
    }
    grouped[entry.domain].push(entry);
  }

  return grouped as Record<DomainName, FieldHistoryEntry[]>;
}

/**
 * Use AI to generate the narrative content
 */
async function generateNarrativeWithAI(
  companyName: string,
  period: NarrativePeriod,
  startDate: string,
  endDate: string,
  changeSummary: {
    totalChanges: number;
    changesByDomain: Record<DomainName, number>;
    changesByUpdater: { human: number; ai: number; system: number };
    topChangedFields: Array<{ path: string; count: number }>;
  },
  changesByDomain: Record<DomainName, FieldHistoryEntry[]>,
  graph: CompanyContextGraph
): Promise<Omit<StrategicNarrative, 'id' | 'companyId' | 'period' | 'startDate' | 'endDate' | 'generatedAt'>> {
  const client = new Anthropic();

  // Build context for AI
  const changesContext = Object.entries(changesByDomain)
    .filter(([_, entries]) => entries.length > 0)
    .map(([domain, entries]) => {
      const recentChanges = entries.slice(0, 5).map(e => ({
        field: e.path.split('.').slice(1).join('.'),
        oldValue: summarizeValue(e.previousValue),
        newValue: summarizeValue(e.value),
        updatedBy: e.updatedBy,
        date: new Date(e.timestamp).toLocaleDateString(),
      }));
      return { domain, changeCount: entries.length, recentChanges };
    });

  const prompt = `You are a strategic analyst generating an executive narrative about how a company's marketing context has evolved.

Company: ${companyName}
Time Period: ${period} (${formatDate(startDate)} to ${formatDate(endDate)})

## Change Summary
- Total changes: ${changeSummary.totalChanges}
- Human updates: ${changeSummary.changesByUpdater.human}
- AI updates: ${changeSummary.changesByUpdater.ai}
- System updates: ${changeSummary.changesByUpdater.system}

## Changes by Domain
${JSON.stringify(changesContext, null, 2)}

## Top Changed Fields
${changeSummary.topChangedFields.map(f => `- ${f.path}: ${f.count} changes`).join('\n')}

Generate a strategic narrative that:
1. Summarizes what changed and why it matters
2. Identifies key changes with their business impact
3. Extracts learnings from the evolution
4. Provides forward-looking recommendations
5. Tells an evolution story for executives

Respond with a JSON object:
{
  "summary": "2-3 sentence executive summary",
  "keyChanges": [
    {
      "domain": "domain_name",
      "description": "What changed and why it matters",
      "impact": "high|medium|low",
      "fields": ["field1", "field2"]
    }
  ],
  "learnings": ["Learning 1", "Learning 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "evolutionStory": "A paragraph telling the story of how this company's strategy evolved"
}

Respond ONLY with the JSON, no markdown formatting.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return getDefaultNarrative(changeSummary);
    }

    const parsed = JSON.parse(textContent.text.trim());

    return {
      summary: parsed.summary || 'No significant changes during this period.',
      keyChanges: parsed.keyChanges || [],
      learnings: parsed.learnings || [],
      recommendations: parsed.recommendations || [],
      evolutionStory: parsed.evolutionStory || 'The company maintained a stable strategic position.',
    };
  } catch (error) {
    console.error('[strategicNarratives] AI generation error:', error);
    return getDefaultNarrative(changeSummary);
  }
}

function getDefaultNarrative(changeSummary: {
  totalChanges: number;
  changesByDomain: Record<DomainName, number>;
}): Omit<StrategicNarrative, 'id' | 'companyId' | 'period' | 'startDate' | 'endDate' | 'generatedAt'> {
  const topDomains = Object.entries(changeSummary.changesByDomain)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return {
    summary: `${changeSummary.totalChanges} changes were made during this period, primarily in ${topDomains.map(([d]) => d).join(', ')}.`,
    keyChanges: topDomains.map(([domain, count]) => ({
      domain: domain as DomainName,
      description: `${count} updates to ${domain} context`,
      impact: 'medium' as const,
      fields: [],
    })),
    learnings: ['The context graph is actively maintained and evolving.'],
    recommendations: ['Continue regular updates to maintain data freshness.'],
    evolutionStory: 'The company continued to refine its strategic context during this period.',
  };
}

function summarizeValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'string') {
    return value.length > 50 ? value.slice(0, 50) + '...' : value;
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value).slice(0, 50) + '...';
  }
  return String(value);
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================================================
// Narrative Templates
// ============================================================================

/**
 * Generate a quick insight without AI (for low-latency use cases)
 */
export function generateQuickInsight(
  changeSummary: {
    totalChanges: number;
    changesByDomain: Record<DomainName, number>;
    changesByUpdater: { human: number; ai: number; system: number };
  },
  period: NarrativePeriod
): string {
  const { totalChanges, changesByDomain, changesByUpdater } = changeSummary;

  if (totalChanges === 0) {
    return `No changes to the context graph in the last ${period}.`;
  }

  const topDomain = Object.entries(changesByDomain)
    .sort(([, a], [, b]) => b - a)[0];

  const updateSource = changesByUpdater.human > changesByUpdater.ai
    ? 'primarily by team members'
    : 'primarily by AI systems';

  return `${totalChanges} updates in the last ${period}, ${updateSource}. Most activity in ${topDomain?.[0] || 'various domains'}.`;
}

// ============================================================================
// Narrative Storage
// ============================================================================

/** Cache of generated narratives */
const narrativeCache = new Map<string, StrategicNarrative>();

/**
 * Get or generate a narrative for a period
 */
export async function getOrGenerateNarrative(
  companyId: string,
  companyName: string,
  period: NarrativePeriod,
  graph: CompanyContextGraph,
  forceRefresh = false
): Promise<StrategicNarrative> {
  const cacheKey = `${companyId}:${period}`;
  const cached = narrativeCache.get(cacheKey);

  // Check if cached narrative is still fresh (within 1 hour)
  if (cached && !forceRefresh) {
    const cacheAge = Date.now() - new Date(cached.generatedAt).getTime();
    if (cacheAge < 60 * 60 * 1000) {
      return cached;
    }
  }

  // Generate new narrative
  const narrative = await generateStrategicNarrative(companyId, companyName, period, graph);
  narrativeCache.set(cacheKey, narrative);

  return narrative;
}

/**
 * Get all cached narratives for a company
 */
export function getCachedNarratives(companyId: string): StrategicNarrative[] {
  const narratives: StrategicNarrative[] = [];

  for (const [key, narrative] of narrativeCache) {
    if (key.startsWith(`${companyId}:`)) {
      narratives.push(narrative);
    }
  }

  return narratives.sort((a, b) =>
    new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  );
}
