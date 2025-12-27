// lib/os/artifacts/convert/artifactToWorkItems.ts
// Artifact → Work Items conversion mapper
//
// Converts artifacts into executable work items with:
// - Structured section extraction when available
// - AI-powered extraction for freeform content
// - Idempotency via work keys
// - Tactic filtering support

import { z } from 'zod';
import type { Artifact } from '@/lib/types/artifact';
import type { WorkItemArea, WorkItemSeverity, WorkSourceArtifact } from '@/lib/types/work';
import { aiForCompany } from '@/lib/ai-gateway/aiClient';
import { parseJsonFromAi } from '@/lib/ai/safeCall';
import {
  generateArtifactWorkKey,
  generateFreeformWorkKey,
  generateArtifactVersionHash,
} from './workKeyGenerator';

// ============================================================================
// Types
// ============================================================================

/**
 * A proposed work item derived from an artifact
 */
export interface ProposedWorkItem {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  area: WorkItemArea;
  severity: WorkItemSeverity;
  sectionId?: string;
  sectionName?: string;
  tacticIds?: string[];
  source: WorkSourceArtifact;
}

/**
 * Result from artifact to work conversion
 */
export interface ArtifactConversionResult {
  artifactId: string;
  artifactType: string;
  artifactVersion: string;
  companyId: string;
  /** Work items to create */
  proposedWorkItems: ProposedWorkItem[];
  /** Summary stats */
  stats: {
    total: number;
    fromSections: number;
    fromAi: number;
  };
}

/**
 * Input for artifact conversion
 */
export interface ArtifactConversionInput {
  companyId: string;
  artifact: Artifact;
  /** Optional tactic IDs to filter by */
  selectedTacticIds?: string[];
}

// ============================================================================
// AI Schema for work item extraction
// ============================================================================

const AiWorkItemSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(10).max(500),
  priority: z.enum(['low', 'medium', 'high']),
  sectionName: z.string().optional(),
});

const AiWorkItemsResponseSchema = z.object({
  workItems: z.array(AiWorkItemSchema).max(15),
});

type AiWorkItem = z.infer<typeof AiWorkItemSchema>;

// ============================================================================
// Artifact Type Mapping
// ============================================================================

/**
 * Map artifact type to default work item area
 */
function getDefaultAreaForArtifactType(artifactType: string): WorkItemArea {
  const mapping: Record<string, WorkItemArea> = {
    'media_brief': 'Funnel',
    'media_plan': 'Funnel',
    'content_brief': 'Content',
    'creative_brief': 'Brand',
    'strategy_doc': 'Strategy',
    'strategy_summary': 'Strategy',
    'seo_brief': 'SEO',
    'website_brief': 'Website UX',
    'brand_guide': 'Brand',
    'qbr_slides': 'Analytics',
  };
  return mapping[artifactType] || 'Other';
}

/**
 * Map priority to severity
 */
function priorityToSeverity(priority: 'low' | 'medium' | 'high'): WorkItemSeverity {
  switch (priority) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    default:
      return 'Medium';
  }
}

// ============================================================================
// Structured Section Extraction
// ============================================================================

interface StructuredSection {
  id: string;
  title: string;
  content: string;
  items?: string[];
}

/**
 * Extract sections from structured artifact content
 */
function extractSectionsFromContent(generatedContent: unknown): StructuredSection[] | null {
  if (!generatedContent || typeof generatedContent !== 'object') return null;

  const content = generatedContent as Record<string, unknown>;

  // Check for sections array
  if ('sections' in content && Array.isArray(content.sections)) {
    return content.sections.map((section: unknown, index: number) => {
      const s = section as Record<string, unknown>;
      return {
        id: (s.id as string) || `section_${index}`,
        title: (s.title as string) || `Section ${index + 1}`,
        content: (s.content as string) || '',
        items: Array.isArray(s.items) ? s.items as string[] : undefined,
      };
    });
  }

  return null;
}

/**
 * Convert structured sections to work items
 */
function sectionsToWorkItems(
  sections: StructuredSection[],
  input: ArtifactConversionInput,
  artifactVersion: string
): ProposedWorkItem[] {
  const { companyId, artifact } = input;
  const area = getDefaultAreaForArtifactType(artifact.type);
  const convertedAt = new Date().toISOString();

  const workItems: ProposedWorkItem[] = [];

  for (const section of sections) {
    // Create a work item for each section
    const workKey = generateArtifactWorkKey(
      companyId,
      artifact.id,
      section.id,
      section.title
    );

    workItems.push({
      title: `Execute: ${section.title}`,
      description: section.content.slice(0, 500),
      priority: 'medium',
      area,
      severity: 'Medium',
      sectionId: section.id,
      sectionName: section.title,
      source: {
        sourceType: 'artifact',
        artifactId: artifact.id,
        artifactType: artifact.type,
        artifactVersion,
        sectionId: section.id,
        sectionName: section.title,
        workKey,
        convertedAt,
      },
    });

    // Also create work items for individual bullet items if present
    if (section.items && section.items.length > 0) {
      section.items.forEach((item, index) => {
        const itemWorkKey = generateArtifactWorkKey(
          companyId,
          artifact.id,
          section.id,
          `${section.title}_item_${index}`
        );

        workItems.push({
          title: item.length > 80 ? item.slice(0, 77) + '...' : item,
          description: `From "${section.title}" section`,
          priority: 'medium',
          area,
          severity: 'Medium',
          sectionId: section.id,
          sectionName: section.title,
          source: {
            sourceType: 'artifact',
            artifactId: artifact.id,
            artifactType: artifact.type,
            artifactVersion,
            sectionId: section.id,
            sectionName: section.title,
            workKey: itemWorkKey,
            convertedAt,
          },
        });
      });
    }
  }

  return workItems;
}

// ============================================================================
// AI-Powered Extraction
// ============================================================================

/**
 * Extract work items from freeform content using AI
 */
async function extractWorkItemsWithAi(
  input: ArtifactConversionInput,
  artifactVersion: string
): Promise<ProposedWorkItem[]> {
  const { companyId, artifact, selectedTacticIds } = input;

  // Build content string from artifact
  const contentParts: string[] = [];

  if (artifact.title) {
    contentParts.push(`Artifact Title: ${artifact.title}`);
  }

  if (artifact.description) {
    contentParts.push(`Description: ${artifact.description}`);
  }

  if (artifact.generatedMarkdown) {
    contentParts.push(`Content:\n${artifact.generatedMarkdown}`);
  } else if (artifact.generatedContent) {
    const content = typeof artifact.generatedContent === 'string'
      ? artifact.generatedContent
      : JSON.stringify(artifact.generatedContent, null, 2);
    contentParts.push(`Content:\n${content}`);
  }

  // Add tactic context if available
  if (artifact.includedTacticIds && artifact.includedTacticIds.length > 0) {
    const relevantTactics = selectedTacticIds
      ? artifact.includedTacticIds.filter(id => selectedTacticIds.includes(id))
      : artifact.includedTacticIds;
    if (relevantTactics.length > 0) {
      contentParts.push(`\nIncluded Tactics: ${relevantTactics.join(', ')}`);
    }
  }

  const artifactContent = contentParts.join('\n\n');

  // Limit content length for AI
  const truncatedContent = artifactContent.slice(0, 8000);

  const systemPrompt = `You are a project manager converting marketing artifacts into executable work items.

Given an artifact (brief, plan, or strategy document), extract actionable work items.

RULES:
1. Each work item should be a concrete, actionable task
2. Title should be 5-15 words, action-oriented (e.g., "Create landing page copy for...")
3. Description should explain what needs to be done and why
4. Priority: high (urgent/critical), medium (normal), low (nice-to-have)
5. Return AT MOST 15 work items - focus on the most important ones
6. If the artifact mentions specific tactics or channels, create work items for each
7. Group related work into single items when appropriate

Output STRICT JSON only.`;

  const taskPrompt = `Extract executable work items from this artifact:

${truncatedContent}

Return JSON in this exact format:
{
  "workItems": [
    {
      "title": "Action-oriented task title",
      "description": "What needs to be done and why",
      "priority": "high|medium|low",
      "sectionName": "Optional section this came from"
    }
  ]
}`;

  try {
    const result = await aiForCompany(companyId, {
      type: 'Work Item',
      tags: ['Work Items', 'Artifact', artifact.type],
      relatedEntityId: artifact.id,
      systemPrompt,
      taskPrompt,
      model: 'gpt-4o-mini',
      temperature: 0.3,
      jsonMode: true,
      maxTokens: 2000,
    });

    // Parse and validate response
    const parseResult = parseJsonFromAi(result.content, { workItems: [] });
    if (!parseResult.ok) {
      console.warn('[artifactToWorkItems] Failed to parse AI response');
      return [];
    }

    const validated = AiWorkItemsResponseSchema.safeParse(parseResult.value);
    if (!validated.success) {
      console.warn('[artifactToWorkItems] AI response validation failed:', validated.error);
      return [];
    }

    // Convert AI items to ProposedWorkItems
    const area = getDefaultAreaForArtifactType(artifact.type);
    const convertedAt = new Date().toISOString();

    return validated.data.workItems.map((item: AiWorkItem, index: number) => {
      const workKey = generateFreeformWorkKey(
        companyId,
        artifact.id,
        item.title,
        index
      );

      return {
        title: item.title,
        description: item.description,
        priority: item.priority,
        area,
        severity: priorityToSeverity(item.priority),
        sectionName: item.sectionName,
        source: {
          sourceType: 'artifact' as const,
          artifactId: artifact.id,
          artifactType: artifact.type,
          artifactVersion,
          sectionName: item.sectionName,
          workKey,
          convertedAt,
        },
      };
    });
  } catch (error) {
    console.error('[artifactToWorkItems] AI extraction failed:', error);
    return [];
  }
}

// ============================================================================
// Main Conversion Function
// ============================================================================

/**
 * Convert an artifact to proposed work items
 */
export async function convertArtifactToWorkItems(
  input: ArtifactConversionInput
): Promise<ArtifactConversionResult> {
  const { companyId, artifact, selectedTacticIds } = input;

  // Generate version hash for traceability
  const artifactVersion = generateArtifactVersionHash(
    artifact.id,
    artifact.generatedContent,
    artifact.updatedAt
  );

  // Try structured extraction first
  const sections = extractSectionsFromContent(artifact.generatedContent);
  let workItemsFromSections: ProposedWorkItem[] = [];
  let workItemsFromAi: ProposedWorkItem[] = [];

  if (sections && sections.length > 0) {
    // Use structured sections
    workItemsFromSections = sectionsToWorkItems(sections, input, artifactVersion);
  } else {
    // Fall back to AI extraction
    workItemsFromAi = await extractWorkItemsWithAi(input, artifactVersion);
  }

  // Combine and filter by tactics if requested
  let allWorkItems = [...workItemsFromSections, ...workItemsFromAi];

  if (selectedTacticIds && selectedTacticIds.length > 0) {
    // Filter work items that mention selected tactics
    // For now, we include all items since tactic filtering happens at creation time
    // Work items don't inherently have tactic IDs - they're derived from the artifact
  }

  return {
    artifactId: artifact.id,
    artifactType: artifact.type,
    artifactVersion,
    companyId,
    proposedWorkItems: allWorkItems,
    stats: {
      total: allWorkItems.length,
      fromSections: workItemsFromSections.length,
      fromAi: workItemsFromAi.length,
    },
  };
}

/**
 * Validate that an artifact can be converted to work
 */
export function validateArtifactForConversion(artifact: Artifact): {
  valid: boolean;
  error?: string;
  warning?: string;
} {
  // Archived artifacts cannot be converted
  if (artifact.status === 'archived') {
    return {
      valid: false,
      error: 'Archived artifacts cannot be converted to work items.',
    };
  }

  // Draft artifacts can be converted with a warning
  if (artifact.status === 'draft') {
    return {
      valid: true,
      warning: 'This artifact is still a draft. Content may change before it becomes final.',
    };
  }

  // Check if artifact has any content
  const hasContent = artifact.generatedContent || artifact.generatedMarkdown;
  if (!hasContent) {
    return {
      valid: false,
      error: 'Artifact has no generated content to convert.',
    };
  }

  return { valid: true };
}

/**
 * Extract work keys from a conversion result
 */
export function extractWorkKeys(result: ArtifactConversionResult): string[] {
  return result.proposedWorkItems.map(item => item.source.workKey);
}
