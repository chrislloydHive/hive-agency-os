// lib/contextGraph/intent/classifier.ts
// Intent classification engine
//
// Phase 4: Classifies user requests into actionable intents

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import type { CompanyContextGraph, DomainName } from '../companyContextGraph';
import type {
  ClassifiedIntent,
  IntentCategory,
  IntentType,
} from './types';

// ============================================================================
// Intent Classification
// ============================================================================

/**
 * Classify a user request into an intent
 */
export async function classifyIntent(
  request: string,
  context?: {
    currentDomain?: DomainName;
    currentPath?: string;
    recentIntents?: ClassifiedIntent[];
    graph?: CompanyContextGraph;
  }
): Promise<ClassifiedIntent> {
  const startTime = Date.now();

  // Try rule-based classification first (faster)
  const ruleBasedIntent = classifyWithRules(request, context);
  if (ruleBasedIntent.confidence >= 0.9) {
    return {
      ...ruleBasedIntent,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Fall back to AI classification for ambiguous cases
  try {
    const aiIntent = await classifyWithAI(request, context);
    return {
      ...aiIntent,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[intent] AI classification failed:', error);
    return {
      ...ruleBasedIntent,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Rule-Based Classification
// ============================================================================

interface RuleMatch {
  pattern: RegExp;
  category: IntentCategory;
  type: IntentType;
  domains: DomainName[];
  confidence: number;
}

const INTENT_RULES: RuleMatch[] = [
  // Media intents
  {
    pattern: /optimi[sz]e\s+(the\s+)?media\s+plan/i,
    category: 'optimize',
    type: 'optimize_media_plan',
    domains: ['performanceMedia'],
    confidence: 0.95,
  },
  {
    pattern: /create\s+(a\s+)?media\s+plan/i,
    category: 'create',
    type: 'create_media_plan',
    domains: ['performanceMedia'],
    confidence: 0.95,
  },
  {
    pattern: /(diagnose|analyze)\s+(media|channel)\s+performance/i,
    category: 'diagnose',
    type: 'diagnose_media_performance',
    domains: ['performanceMedia'],
    confidence: 0.9,
  },
  {
    pattern: /forecast\s+(media\s+)?spend/i,
    category: 'forecast',
    type: 'forecast_media_spend',
    domains: ['performanceMedia', 'budgetOps'],
    confidence: 0.9,
  },

  // Creative intents
  {
    pattern: /(rewrite|create|generate)\s+(a\s+)?creative\s+brief/i,
    category: 'create',
    type: 'create_creative_brief',
    domains: ['creative'],
    confidence: 0.95,
  },
  {
    pattern: /optimi[sz]e\s+creative\s+(angles?|messaging)/i,
    category: 'optimize',
    type: 'optimize_creative_angles',
    domains: ['creative'],
    confidence: 0.9,
  },
  {
    pattern: /creative\s+fatigue/i,
    category: 'diagnose',
    type: 'diagnose_creative_fatigue',
    domains: ['creative'],
    confidence: 0.9,
  },

  // Audience intents
  {
    pattern: /update\s+(the\s+)?audience/i,
    category: 'update',
    type: 'update_audience_segments',
    domains: ['audience'],
    confidence: 0.85,
  },
  {
    pattern: /create\s+personas?/i,
    category: 'create',
    type: 'create_personas',
    domains: ['audience'],
    confidence: 0.95,
  },
  {
    pattern: /(diagnose|analyze)\s+audience\s+(fit|behavior)/i,
    category: 'diagnose',
    type: 'diagnose_audience_fit',
    domains: ['audience'],
    confidence: 0.9,
  },

  // SEO intents
  {
    pattern: /(diagnose|analyze|fix)\s+seo\s+(issues?|problems?)/i,
    category: 'diagnose',
    type: 'diagnose_seo_issues',
    domains: ['seo'],
    confidence: 0.95,
  },
  {
    pattern: /optimi[sz]e\s+keyword/i,
    category: 'optimize',
    type: 'optimize_keyword_strategy',
    domains: ['seo'],
    confidence: 0.9,
  },
  {
    pattern: /search\s+visibility/i,
    category: 'analyze',
    type: 'analyze_search_visibility',
    domains: ['seo'],
    confidence: 0.85,
  },

  // Brand intents
  {
    pattern: /update\s+(brand\s+)?positioning/i,
    category: 'update',
    type: 'update_brand_positioning',
    domains: ['brand'],
    confidence: 0.9,
  },
  {
    pattern: /brand\s+consistenc/i,
    category: 'diagnose',
    type: 'diagnose_brand_consistency',
    domains: ['brand'],
    confidence: 0.9,
  },

  // Strategy intents
  {
    pattern: /(executive|strategy)\s+summary/i,
    category: 'create',
    type: 'create_executive_summary',
    domains: ['objectives', 'performanceMedia', 'brand'],
    confidence: 0.9,
  },
  {
    pattern: /forecast\s+seasonality/i,
    category: 'forecast',
    type: 'forecast_seasonality',
    domains: ['performanceMedia', 'historical'],
    confidence: 0.9,
  },
  {
    pattern: /competitive\s+(analysis|landscape)/i,
    category: 'analyze',
    type: 'analyze_competitive_landscape',
    domains: ['competitive'],
    confidence: 0.9,
  },

  // Context graph intents
  {
    pattern: /fix\s+(inconsistent|conflicting)\s+(data|fields?)/i,
    category: 'fix',
    type: 'fix_inconsistent_data',
    domains: [],
    confidence: 0.9,
  },
  {
    pattern: /(update|refresh)\s+stale\s+(data|fields?)/i,
    category: 'update',
    type: 'update_stale_fields',
    domains: [],
    confidence: 0.9,
  },
  {
    pattern: /explain\s+(this\s+)?field/i,
    category: 'explain',
    type: 'explain_field_value',
    domains: [],
    confidence: 0.85,
  },
  {
    pattern: /compare\s+snapshots?/i,
    category: 'compare',
    type: 'compare_snapshots',
    domains: [],
    confidence: 0.9,
  },
];

function classifyWithRules(
  request: string,
  context?: { currentDomain?: DomainName }
): Omit<ClassifiedIntent, 'processingTimeMs'> {
  const now = new Date().toISOString();

  // Check each rule
  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(request)) {
      return {
        id: `intent_${randomUUID()}`,
        rawRequest: request,
        category: rule.category,
        type: rule.type,
        confidence: rule.confidence,
        targetDomains: rule.domains.length > 0 ? rule.domains : (context?.currentDomain ? [context.currentDomain] : []),
        entities: {},
        parameters: extractParameters(request),
        classifiedAt: now,
      };
    }
  }

  // No rule matched
  return {
    id: `intent_${randomUUID()}`,
    rawRequest: request,
    category: 'analyze',
    type: 'unknown',
    confidence: 0.3,
    targetDomains: context?.currentDomain ? [context.currentDomain] : [],
    entities: {},
    parameters: extractParameters(request),
    classifiedAt: now,
  };
}

function extractParameters(request: string): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  // Extract time periods
  const periodMatch = request.match(/last\s+(\d+)\s+(day|week|month|quarter|year)s?/i);
  if (periodMatch) {
    params.period = {
      value: parseInt(periodMatch[1]),
      unit: periodMatch[2].toLowerCase(),
    };
  }

  // Extract percentages
  const percentMatch = request.match(/(\d+)\s*%/);
  if (percentMatch) {
    params.percentage = parseInt(percentMatch[1]);
  }

  // Extract budget amounts
  const budgetMatch = request.match(/\$?([\d,]+)k?/i);
  if (budgetMatch) {
    let amount = parseFloat(budgetMatch[1].replace(/,/g, ''));
    if (budgetMatch[0].toLowerCase().includes('k')) {
      amount *= 1000;
    }
    params.budget = amount;
  }

  return params;
}

// ============================================================================
// AI Classification
// ============================================================================

async function classifyWithAI(
  request: string,
  context?: {
    currentDomain?: DomainName;
    recentIntents?: ClassifiedIntent[];
    graph?: CompanyContextGraph;
  }
): Promise<Omit<ClassifiedIntent, 'processingTimeMs'>> {
  const client = new Anthropic();

  const recentContext = context?.recentIntents
    ?.slice(0, 3)
    .map(i => `- ${i.rawRequest} -> ${i.type}`)
    .join('\n');

  const prompt = `Classify this user request into a structured intent.

## Request
"${request}"

${context?.currentDomain ? `## Current Context\nUser is viewing the ${context.currentDomain} domain.` : ''}

${recentContext ? `## Recent Intents\n${recentContext}` : ''}

## Intent Categories
- optimize: Improve performance of something
- diagnose: Analyze and find issues
- create: Generate new content/plans
- update: Modify existing data
- analyze: Deep analysis or research
- forecast: Predict future trends
- fix: Resolve a specific problem
- compare: Compare options or periods
- explain: Get understanding or insights
- automate: Set up automated processes

## Intent Types
- optimize_media_plan, diagnose_media_performance, create_media_plan, forecast_media_spend
- create_creative_brief, optimize_creative_angles, diagnose_creative_fatigue
- update_audience_segments, create_personas, diagnose_audience_fit
- diagnose_seo_issues, optimize_keyword_strategy, analyze_search_visibility
- update_brand_positioning, diagnose_brand_consistency
- create_executive_summary, forecast_seasonality, analyze_competitive_landscape
- fix_inconsistent_data, update_stale_fields, explain_field_value
- unknown (if none fit)

## Domains
identity, brand, objectives, audience, productOffer, digitalInfra, website, content, seo, ops, performanceMedia, historical, creative, competitive, budgetOps, operationalConstraints

Respond with JSON:
{
  "category": "category_name",
  "type": "intent_type",
  "confidence": 0.85,
  "targetDomains": ["domain1", "domain2"],
  "entities": {},
  "parameters": {}
}

Respond ONLY with JSON, no markdown.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response');
    }

    const parsed = JSON.parse(textContent.text.trim());

    return {
      id: `intent_${randomUUID()}`,
      rawRequest: request,
      category: parsed.category as IntentCategory,
      type: parsed.type as IntentType,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      targetDomains: (parsed.targetDomains || []) as DomainName[],
      entities: parsed.entities || {},
      parameters: parsed.parameters || {},
      classifiedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[intent] AI classification error:', error);
    throw error;
  }
}

// ============================================================================
// Batch Classification
// ============================================================================

/**
 * Classify multiple requests at once
 */
export async function classifyIntents(
  requests: string[],
  context?: { graph?: CompanyContextGraph }
): Promise<ClassifiedIntent[]> {
  const results: ClassifiedIntent[] = [];

  for (const request of requests) {
    const intent = await classifyIntent(request, context);
    results.push(intent);
  }

  return results;
}

// ============================================================================
// Intent Validation
// ============================================================================

/**
 * Check if an intent can be executed given the current context
 */
export function validateIntentContext(
  intent: ClassifiedIntent,
  graph: CompanyContextGraph
): {
  isValid: boolean;
  missingContext: string[];
  warnings: string[];
} {
  const missingContext: string[] = [];
  const warnings: string[] = [];

  // Check domain-specific requirements
  for (const domain of intent.targetDomains) {
    const domainData = graph[domain];
    if (!domainData) {
      missingContext.push(`Domain ${domain} not found`);
      continue;
    }

    // Check if domain has any populated fields
    const hasData = Object.values(domainData).some((field: any) =>
      field?.value !== null && field?.value !== undefined
    );

    if (!hasData) {
      warnings.push(`Domain ${domain} has no data - results may be limited`);
    }
  }

  return {
    isValid: missingContext.length === 0,
    missingContext,
    warnings,
  };
}
