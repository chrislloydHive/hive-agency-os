// lib/os/documents.ts
// Document and Brief management for MVP
//
// Provides CRUD operations for briefs and document generation from strategies.

import { getBase } from '@/lib/airtable';
import { getOpenAI } from '@/lib/openai';
import type {
  Brief,
  BriefType,
  BriefSummary,
  GenerateBriefRequest,
  GenerateBriefResponse,
} from '@/lib/types/documents';
import {
  createBriefSummary,
  BRIEF_TYPE_LABELS,
} from '@/lib/types/documents';
import type { CompanyStrategy } from '@/lib/types/strategy';
import { getActiveStrategy } from './strategy';
import { getCompanyContext } from './context';

// ============================================================================
// Configuration
// ============================================================================

const BRIEFS_TABLE = 'Briefs';

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get all briefs for a company
 */
export async function getBriefsForCompany(companyId: string): Promise<Brief[]> {
  try {
    const base = getBase();
    const records = await base(BRIEFS_TABLE)
      .select({
        filterByFormula: `{companyId} = '${companyId}'`,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .all();

    return records.map(mapRecordToBrief);
  } catch (error) {
    console.error('[getBriefsForCompany] Error:', error);
    return [];
  }
}

/**
 * Get brief summaries for list display
 */
export async function getBriefSummariesForCompany(companyId: string): Promise<BriefSummary[]> {
  const briefs = await getBriefsForCompany(companyId);
  return briefs.map(createBriefSummary);
}

/**
 * Get brief by ID
 */
export async function getBriefById(briefId: string): Promise<Brief | null> {
  try {
    const base = getBase();
    const record = await base(BRIEFS_TABLE).find(briefId);
    return mapRecordToBrief(record);
  } catch (error) {
    console.error('[getBriefById] Error:', error);
    return null;
  }
}

/**
 * Get briefs by type for a company
 */
export async function getBriefsByType(companyId: string, type: BriefType): Promise<Brief[]> {
  try {
    const base = getBase();
    const records = await base(BRIEFS_TABLE)
      .select({
        filterByFormula: `AND({companyId} = '${companyId}', {type} = '${type}')`,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .all();

    return records.map(mapRecordToBrief);
  } catch (error) {
    console.error('[getBriefsByType] Error:', error);
    return [];
  }
}

// ============================================================================
// Write Operations
// ============================================================================

/**
 * Create a brief
 */
export async function createBrief(brief: Omit<Brief, 'id' | 'createdAt' | 'updatedAt'>): Promise<Brief> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    // JSON stringify array fields for Airtable storage
    const record = await base(BRIEFS_TABLE).create({
      ...brief,
      relatedPillarIds: brief.relatedPillarIds ? JSON.stringify(brief.relatedPillarIds) : undefined,
      createdAt: now,
      updatedAt: now,
    });

    return mapRecordToBrief(record);
  } catch (error) {
    console.error('[createBrief] Error:', error);
    // Extract message from Airtable error format
    const errorMessage = error instanceof Error
      ? error.message
      : (typeof error === 'object' && error !== null && 'message' in error)
        ? String((error as { message: unknown }).message)
        : 'Unknown error';
    throw new Error(`Failed to create brief: ${errorMessage}`);
  }
}

/**
 * Update a brief
 */
export async function updateBrief(
  briefId: string,
  updates: Partial<Omit<Brief, 'id' | 'companyId' | 'createdAt'>>
): Promise<Brief> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    const record = await base(BRIEFS_TABLE).update(briefId, {
      ...updates,
      updatedAt: now,
    });

    return mapRecordToBrief(record);
  } catch (error) {
    console.error('[updateBrief] Error:', error);
    throw new Error(`Failed to update brief: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a brief
 */
export async function deleteBrief(briefId: string): Promise<void> {
  try {
    const base = getBase();
    await base(BRIEFS_TABLE).destroy(briefId);
  } catch (error) {
    console.error('[deleteBrief] Error:', error);
    throw new Error(`Failed to delete brief: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Brief Generation
// ============================================================================

/**
 * Generate a brief from strategy using AI
 */
export async function generateBriefFromStrategy(
  request: GenerateBriefRequest
): Promise<GenerateBriefResponse> {
  const { companyId, type, strategyId, pillarIds } = request;

  try {
    // Get strategy (use provided or active)
    let strategy: CompanyStrategy | null;
    if (strategyId) {
      const { getStrategyById } = await import('./strategy');
      strategy = await getStrategyById(strategyId);
    } else {
      strategy = await getActiveStrategy(companyId);
    }

    if (!strategy) {
      throw new Error('No strategy found. Please create a strategy first.');
    }

    // Get company context
    const context = await getCompanyContext(companyId);

    // Filter pillars if specified
    const relevantPillars = pillarIds
      ? strategy.pillars.filter(p => pillarIds.includes(p.id))
      : strategy.pillars;

    // Generate brief content using AI
    const briefContent = await generateBriefContent(type, {
      strategy,
      context,
      relevantPillars,
    });

    return {
      brief: {
        companyId,
        type,
        title: briefContent.title,
        summary: briefContent.summary,
        body: briefContent.body,
        relatedStrategyId: strategy.id,
        relatedPillarIds: relevantPillars.map(p => p.id),
        status: 'draft',
      },
      confidence: briefContent.confidence,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[generateBriefFromStrategy] Error:', error);
    throw new Error(`Failed to generate brief: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

interface BriefGenerationInput {
  strategy: CompanyStrategy;
  context: Awaited<ReturnType<typeof getCompanyContext>>;
  relevantPillars: CompanyStrategy['pillars'];
}

interface BriefContentResult {
  title: string;
  summary: string;
  body: string;
  confidence: number;
}

/**
 * Generate brief content using AI
 */
async function generateBriefContent(
  type: BriefType,
  input: BriefGenerationInput
): Promise<BriefContentResult> {
  const { strategy, context, relevantPillars } = input;

  try {
    const openai = getOpenAI();
    const prompt = buildBriefPrompt(type, input);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: getBriefSystemPrompt(type),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      title: parsed.title || `${BRIEF_TYPE_LABELS[type]} - ${strategy.title}`,
      summary: parsed.summary || 'Brief summary pending.',
      body: parsed.body || 'Brief content pending.',
      confidence: parsed.confidence || 0.7,
    };
  } catch (error) {
    console.error('[generateBriefContent] Error:', error);

    // Return fallback content
    return {
      title: `${BRIEF_TYPE_LABELS[type]} - ${strategy.title}`,
      summary: 'Auto-generated brief based on company strategy.',
      body: generateFallbackBriefBody(type, input),
      confidence: 0.3,
    };
  }
}

function getBriefSystemPrompt(type: BriefType): string {
  const prompts: Record<BriefType, string> = {
    creative: `You are a creative strategist writing a creative brief.
Focus on: objective, target audience, key message, tone, deliverables, and success metrics.
Write in a clear, inspiring style that guides creative development.`,

    media: `You are a media strategist writing a media activation brief.
Focus on: campaign objectives, target audience, channel mix, budget considerations, KPIs.
Write in a structured, strategic style suitable for media planning.`,

    content: `You are a content strategist writing a content brief.
Focus on: content goals, target keywords, content types, editorial guidelines, distribution.
Write in a practical style that guides content creation.`,

    seo: `You are an SEO strategist writing an SEO brief.
Focus on: keyword targets, technical requirements, on-page optimization, link strategy.
Write in a technical yet actionable style.`,
  };

  return prompts[type] + `

Return a JSON object with:
{
  "title": "Brief title",
  "summary": "2-3 sentence executive summary",
  "body": "Full brief content in markdown format",
  "confidence": 0.8
}`;
}

function buildBriefPrompt(type: BriefType, input: BriefGenerationInput): string {
  const { strategy, context, relevantPillars } = input;

  return `
Generate a ${BRIEF_TYPE_LABELS[type]} based on:

Strategy: ${strategy.title}
${strategy.summary}

Relevant Pillars:
${relevantPillars.map(p => `- ${p.title}: ${p.description} (Services: ${p.services?.join(', ') || 'General'})`).join('\n')}

Company Context:
- Business: ${context?.businessModel || 'Not specified'}
- Primary Audience: ${context?.primaryAudience || 'Not specified'}
- Secondary Audience: ${context?.secondaryAudience || 'Not specified'}
- Value Proposition: ${context?.valueProposition || 'Not specified'}
- Objectives: ${context?.objectives?.join(', ') || 'Not specified'}
- Constraints: ${context?.constraints || 'None specified'}
- Differentiators: ${context?.differentiators?.join(', ') || 'Not specified'}

Generate a comprehensive ${type} brief that aligns with this strategy.
`.trim();
}

function generateFallbackBriefBody(type: BriefType, input: BriefGenerationInput): string {
  const { strategy, relevantPillars } = input;

  return `
# ${BRIEF_TYPE_LABELS[type]}

## Overview
Based on strategy: **${strategy.title}**

## Strategic Context
${strategy.summary || 'See strategy document for details.'}

## Focus Areas
${relevantPillars.map(p => `### ${p.title}\n${p.description}`).join('\n\n')}

## Next Steps
1. Review and refine this brief
2. Align with team on objectives
3. Begin execution planning

---
*Auto-generated brief. Please review and customize.*
`.trim();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map Airtable record to Brief
 */
function mapRecordToBrief(record: {
  id: string;
  fields: Record<string, unknown>;
}): Brief {
  const fields = record.fields;

  return {
    id: record.id,
    companyId: fields.companyId as string,
    type: (fields.type as BriefType) || 'creative',
    title: (fields.title as string) || 'Untitled Brief',
    summary: (fields.summary as string) || '',
    body: (fields.body as string) || '',
    relatedStrategyId: fields.relatedStrategyId as string | undefined,
    relatedPillarIds: parseJsonArray(fields.relatedPillarIds),
    status: (fields.status as Brief['status']) || 'draft',
    version: (fields.version as number) || 1,
    createdAt: (fields.createdAt as string) || new Date().toISOString(),
    updatedAt: (fields.updatedAt as string) || new Date().toISOString(),
    createdBy: fields.createdBy as string | undefined,
    approvedAt: fields.approvedAt as string | undefined,
    approvedBy: fields.approvedBy as string | undefined,
  };
}

/**
 * Parse JSON array from Airtable field
 */
function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
