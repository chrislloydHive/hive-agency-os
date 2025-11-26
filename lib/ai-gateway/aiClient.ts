/**
 * AI Gateway - aiForCompany
 *
 * The central AI gateway for company-aware AI interactions.
 * This function:
 * - Loads prior company memory
 * - Injects memory into prompts
 * - Calls OpenAI
 * - Logs full responses to Company AI Context
 *
 * All AI interactions that should be memory-aware should go through this gateway.
 */

import { getOpenAI } from '@/lib/openai';
import {
  getCompanyMemoryForPrompt,
  addCompanyMemoryEntry,
} from './companyMemory';
import type {
  AiForCompanyOptions,
  AiForCompanyResult,
  GapModelCaller,
} from './types';

/**
 * AI Gateway for company-aware interactions
 *
 * Provides a unified interface for AI calls that:
 * 1. Load prior memory for the company
 * 2. Inject memory into the prompt
 * 3. Call OpenAI with the enriched prompt
 * 4. Log the full response to Company AI Context
 *
 * @param companyId - The canonical company ID (UUID)
 * @param options - Configuration for the AI call
 * @returns The AI response and metadata
 */
export async function aiForCompany(
  companyId: string,
  options: AiForCompanyOptions
): Promise<AiForCompanyResult> {
  const {
    type,
    tags = [],
    relatedEntityId,
    systemPrompt,
    taskPrompt,
    model = 'gpt-4o',
    temperature = 0.3,
    memoryOptions = {},
    jsonMode = false,
    maxTokens = 4000,
  } = options;

  console.log(`[aiForCompany] Starting ${type} call for company ${companyId}`);

  // 1. Load prior memory
  const memoryContext = await getCompanyMemoryForPrompt(companyId, {
    limit: memoryOptions.limit ?? 20,
    types: memoryOptions.types,
    ...memoryOptions,
  });

  const loadedMemoryCount = memoryContext.includes('No prior context')
    ? 0
    : (memoryContext.match(/---/g)?.length ?? 0) / 2;

  console.log(
    `[aiForCompany] Loaded ${loadedMemoryCount} memory entries for context`
  );

  // 2. Build enriched prompt with memory injection
  const enrichedSystemPrompt = `${systemPrompt}

${memoryContext}

IMPORTANT: Use the prior context above to inform your analysis. Reference relevant prior findings where applicable.`;

  // 3. Call OpenAI
  console.log(`[aiForCompany] Calling OpenAI (${model})...`);

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: enrichedSystemPrompt },
      { role: 'user', content: taskPrompt },
    ],
    temperature,
    max_tokens: maxTokens,
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  });

  const content = completion.choices[0]?.message?.content || '';

  console.log(
    `[aiForCompany] Received response (${content.length} chars)`
  );

  // 4. Log full response to Company AI Context
  const memoryEntryId = await addCompanyMemoryEntry({
    companyId,
    type,
    source: 'AI',
    content,
    tags,
    relatedEntityId,
    metadata: {
      model,
      temperature,
      promptLength: taskPrompt.length,
      responseLength: content.length,
      memoryEntriesLoaded: loadedMemoryCount,
    },
  });

  console.log(
    `[aiForCompany] Logged response to memory: ${memoryEntryId}`
  );

  return {
    content,
    memoryEntryId,
    loadedMemoryCount,
  };
}

/**
 * Create a GapModelCaller bound to a specific company
 *
 * This factory function creates a model caller that routes through aiForCompany,
 * ensuring all GAP calls are memory-aware.
 *
 * @param companyId - The canonical company ID
 * @param config - Configuration for the GAP model caller
 * @returns A GapModelCaller function
 */
export function createGapModelCaller(
  companyId: string,
  config: {
    type: 'GAP IA' | 'GAP Full';
    tags?: string[];
    relatedEntityId?: string | null;
    model?: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo';
    temperature?: number;
    memoryTypes?: Array<
      'GAP IA' | 'GAP Full' | 'Analytics Insight' | 'Work Item' | 'Strategy'
    >;
  }
): GapModelCaller {
  const {
    type,
    tags = [],
    relatedEntityId,
    model = 'gpt-4o',
    temperature = 0.3,
    memoryTypes = ['GAP IA', 'GAP Full', 'Analytics Insight', 'Work Item', 'Strategy'],
  } = config;

  // Build appropriate system prompt based on type
  const systemPrompt =
    type === 'GAP IA'
      ? `You are the GAP IA engine inside Hive OS.

You perform a fast, URL-based marketing assessment across:
- Brand clarity
- Website UX & conversion
- Content strength
- SEO fundamentals
- Authority & trust
- Digital footprint

You must always output valid JSON matching the GAP IA schema.`
      : `You are the Full Growth Acceleration Plan (GAP) engine inside Hive OS.

You generate a detailed, consultant-grade marketing plan across:
- Brand
- Website
- Content
- SEO
- Analytics & optimization
- Authority building

You must always output valid JSON matching the Full GAP schema.`;

  // Return the model caller function
  return async (prompt: string): Promise<string> => {
    const result = await aiForCompany(companyId, {
      type,
      tags: type === 'GAP IA' ? ['GAP', 'Snapshot', 'Marketing', ...tags] : ['GAP', 'Growth Plan', 'Strategy', ...tags],
      relatedEntityId,
      systemPrompt,
      taskPrompt: prompt,
      model,
      temperature,
      jsonMode: true,
      maxTokens: 6000,
      memoryOptions: {
        limit: 20,
        types: memoryTypes,
      },
    });

    return result.content;
  };
}
