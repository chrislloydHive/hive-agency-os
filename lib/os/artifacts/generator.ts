// lib/os/artifacts/generator.ts
// AI-powered artifact generation
//
// Generates artifacts from strategy, plans, or other sources using the
// artifact registry and prompt templates.

import { aiForCompany } from '@/lib/ai-gateway/aiClient';
import { getArtifactType, GeneratedArtifactOutputSchema } from './registry';
import { getPromptTemplate, type ArtifactGenerationContext } from './prompts';
import { buildArtifactInputs, hashInputs, type ArtifactSourceInput } from './buildInputs';
import { createArtifact } from '@/lib/airtable/artifacts';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getActiveStrategy } from '@/lib/os/strategy';
import { getMediaPlanById, getContentPlanById } from '@/lib/airtable/heavyPlans';
import type { Artifact, ArtifactType } from '@/lib/types/artifact';

// ============================================================================
// Types
// ============================================================================

export interface GenerateArtifactInput {
  companyId: string;
  companyName: string;
  artifactTypeId: string;
  source: ArtifactSourceInput;
  promptHint?: string;
  mode?: 'create' | 'refresh';
}

export interface GenerateArtifactResult {
  artifact: Artifact;
  warnings: string[];
  inputsUsedHash: string;
}

// ============================================================================
// Generator
// ============================================================================

/**
 * Generate an artifact from source context
 */
export async function generateArtifact(
  input: GenerateArtifactInput
): Promise<GenerateArtifactResult> {
  const { companyId, companyName, artifactTypeId, source, promptHint, mode = 'create' } = input;

  console.log(`[generateArtifact] Starting ${mode} for ${artifactTypeId}, company ${companyId}`);

  // 1. Validate artifact type
  const artifactType = getArtifactType(artifactTypeId);
  if (!artifactType) {
    throw new Error(`Unknown artifact type: ${artifactTypeId}`);
  }

  // Validate source is supported
  if (!artifactType.supportedSources.includes(source.sourceType)) {
    throw new Error(
      `Artifact type ${artifactTypeId} does not support source ${source.sourceType}. ` +
      `Supported: ${artifactType.supportedSources.join(', ')}`
    );
  }

  // 2. Get prompt template
  const promptTemplate = getPromptTemplate(artifactTypeId);
  if (!promptTemplate) {
    throw new Error(`No prompt template found for artifact type: ${artifactTypeId}`);
  }

  // 3. Load source data
  const context = await loadContextGraph(companyId);
  const strategy = await getActiveStrategy(companyId);

  let mediaPlan = null;
  let contentPlan = null;

  if (source.sourceType === 'plan:media') {
    mediaPlan = await getMediaPlanById(source.sourceId);
  } else if (source.sourceType === 'plan:content') {
    contentPlan = await getContentPlanById(source.sourceId);
  }

  // 4. Build generation inputs
  const generationContext = buildArtifactInputs({
    source,
    companyName,
    context,
    strategy,
    mediaPlan,
    contentPlan,
    promptHint,
  });

  // 5. Validate minimum inputs
  const warnings: string[] = [];
  if (!generationContext.goalStatement) {
    warnings.push('No goal statement found in strategy');
  }
  if (generationContext.tactics.length === 0) {
    warnings.push('No active tactics found');
  }
  if (generationContext.objectives.length === 0) {
    warnings.push('No active objectives found');
  }

  // 6. Call AI to generate artifact
  console.log(`[generateArtifact] Calling AI to generate ${artifactTypeId}...`);

  const taskPrompt = promptTemplate.buildTaskPrompt(
    generationContext,
    artifactType.defaultSections
  );

  let retries = 0;
  let generatedOutput = null;
  let parseError = null;

  while (retries < 2) {
    try {
      const result = await aiForCompany(companyId, {
        type: 'Artifact Generation',
        tags: ['Artifact', artifactType.category, artifactTypeId],
        systemPrompt: promptTemplate.systemPrompt,
        taskPrompt: retries > 0
          ? `${taskPrompt}\n\nPREVIOUS ATTEMPT FAILED TO PARSE. Please ensure valid JSON output.`
          : taskPrompt,
        model: 'gpt-4o',
        temperature: 0.4,
        maxTokens: 6000,
        jsonMode: true,
        memoryOptions: {
          limit: 15,
          types: ['Strategy', 'GAP Full'],
        },
      });

      // Parse and validate output
      const parsed = JSON.parse(result.content);

      // Add generated timestamp if not present
      if (!parsed.generatedAt) {
        parsed.generatedAt = new Date().toISOString();
      }

      const validated = GeneratedArtifactOutputSchema.safeParse(parsed);
      if (!validated.success) {
        parseError = validated.error;
        retries++;
        console.warn(`[generateArtifact] Validation failed, retry ${retries}:`, validated.error.message);
        continue;
      }

      generatedOutput = validated.data;
      break;
    } catch (error) {
      parseError = error;
      retries++;
      console.warn(`[generateArtifact] Parse failed, retry ${retries}:`, error);
    }
  }

  if (!generatedOutput) {
    throw new Error(`Failed to generate valid artifact after ${retries} retries: ${parseError}`);
  }

  // 7. Compute inputs hash for staleness tracking
  const inputsUsedHash = hashInputs(generationContext);

  // 8. Persist artifact
  const createInput = {
    companyId,
    title: generatedOutput.title,
    type: artifactTypeId as ArtifactType,
    source: 'ai_generated' as const,
    sourceStrategyId: source.sourceType === 'strategy' ? source.sourceId : strategy?.id,
    sourceMediaPlanId: source.sourceType === 'plan:media' ? source.sourceId : undefined,
    sourceContentPlanId: source.sourceType === 'plan:content' ? source.sourceId : undefined,
    description: generatedOutput.summary || undefined,
    tags: artifactType.tags,
    generatedContent: generatedOutput.format === 'structured' ? generatedOutput : undefined,
    generatedMarkdown: generatedOutput.format === 'markdown' ? generatedOutput.content : undefined,
    generatedFormat: generatedOutput.format,
    inputsUsedHash,
    includedTacticIds: source.includedTacticIds,
  };

  console.log(`[generateArtifact] Persisting artifact:`, {
    companyId: createInput.companyId,
    title: createInput.title,
    type: createInput.type,
    sourceStrategyId: createInput.sourceStrategyId,
  });

  const artifact = await createArtifact(createInput);

  if (!artifact) {
    throw new Error('Failed to persist artifact - check Airtable logs above for details');
  }

  console.log(`[generateArtifact] Created artifact ${artifact.id}`);

  return {
    artifact,
    warnings,
    inputsUsedHash,
  };
}

/**
 * Regenerate an existing artifact (refresh mode)
 */
export async function regenerateArtifact(
  artifactId: string,
  companyId: string,
  companyName: string,
  promptHint?: string
): Promise<GenerateArtifactResult> {
  // TODO: Load existing artifact, extract source info, regenerate
  // For now, this is a placeholder that would need the source info
  throw new Error('Not implemented - use generateArtifact with mode="refresh" instead');
}
