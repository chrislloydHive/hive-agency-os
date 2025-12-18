// app/api/os/companies/[companyId]/work/prescribe/ai-brief/route.ts
// AI Brief Generator for Prescribed Work Items
//
// Creates a canonical Brief record in the Brief system and links it to the work item.
// IMPORTANT: For SEO work, this does NOT write actual copy - only guidance.
//
// Context Boosters:
// Before generating the brief, we run scoped Labs to ground the brief in fresh
// diagnostic data. This ensures briefs reflect real issues (SEO gaps, website
// problems, content weaknesses) rather than being generic.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createBrief, updateBrief } from '@/lib/airtable/briefs';
import { updateWorkItemSourceWithBriefId } from '@/lib/airtable/workItems';
import { runContextBoosters } from '@/lib/labs/contextBoosters';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getProjectTypeConfig } from '@/lib/projects/projectTypeRegistry';
import type { BriefType, BriefCore, SeoExtension, WebsiteExtension, ContentExtension } from '@/lib/types/brief';
import type { RefinementLabId } from '@/lib/labs/refinementTypes';

// ============================================================================
// Types
// ============================================================================

type PrescribedWorkType = 'seo_copy' | 'landing_page_copy' | 'page_edits' | 'other';

interface AiBriefRequest {
  workItemId: string;
  projectContext: string;
  workType: PrescribedWorkType;
  scope: string;
  goal: string;
  notes?: string;
}

interface AiBriefResponse {
  briefId: string;
  workItemId: string;
  success: true;
  /** Human-readable label for UI: "Website + Brand" or null if no boosters ran */
  groundedIn?: string;
}

// ============================================================================
// Work Type to Brief Type Mapping
// ============================================================================

function mapWorkTypeToBriefType(workType: PrescribedWorkType): BriefType {
  switch (workType) {
    case 'seo_copy':
      return 'seo';
    case 'landing_page_copy':
      return 'website';
    case 'page_edits':
      return 'website';
    case 'other':
    default:
      return 'content';
  }
}

function getWorkTypeLabel(workType: PrescribedWorkType): string {
  switch (workType) {
    case 'seo_copy':
      return 'SEO Copy Updates';
    case 'landing_page_copy':
      return 'Landing Page Copy';
    case 'page_edits':
      return 'Page Edits';
    case 'other':
    default:
      return 'Other Work';
  }
}

/**
 * Map work type to project type key for booster lookup
 */
function mapWorkTypeToProjectType(workType: PrescribedWorkType): string {
  switch (workType) {
    case 'seo_copy':
      return 'seo_fix';
    case 'landing_page_copy':
    case 'page_edits':
      return 'website_optimization';
    case 'other':
    default:
      return 'content_strategy';
  }
}

/**
 * Get context boosters for a work type
 */
function getBoostersForWorkType(workType: PrescribedWorkType): RefinementLabId[] {
  const projectTypeKey = mapWorkTypeToProjectType(workType);
  const config = getProjectTypeConfig(projectTypeKey);
  return config?.contextBoosters ?? [];
}

// ============================================================================
// Context Formatting
// ============================================================================

/**
 * Format context graph data for inclusion in brief generation prompt
 */
function formatContextForBrief(graph: any, workType: PrescribedWorkType): string {
  const sections: string[] = [];

  // Identity context
  if (graph.identity) {
    const identity = [];
    if (graph.identity.companyName) identity.push(`Company: ${graph.identity.companyName}`);
    if (graph.identity.industry) identity.push(`Industry: ${graph.identity.industry}`);
    if (graph.identity.businessModel) identity.push(`Business Model: ${graph.identity.businessModel}`);
    if (identity.length > 0) {
      sections.push(`## Company Identity\n${identity.join('\n')}`);
    }
  }

  // Audience context
  if (graph.audience) {
    const audience = [];
    if (graph.audience.primaryAudience) audience.push(`Primary Audience: ${graph.audience.primaryAudience}`);
    if (graph.audience.icpDescription) audience.push(`ICP: ${graph.audience.icpDescription}`);
    if (graph.audience.painPoints?.length) {
      audience.push(`Pain Points:\n${graph.audience.painPoints.slice(0, 5).map((p: string) => `- ${p}`).join('\n')}`);
    }
    if (audience.length > 0) {
      sections.push(`## Target Audience\n${audience.join('\n\n')}`);
    }
  }

  // Work-type specific context
  if (workType === 'seo_copy' && graph.seo) {
    const seo = [];
    if (graph.seo.currentRankings) seo.push(`Current Rankings: ${graph.seo.currentRankings}`);
    if (graph.seo.keywordGaps?.length) {
      seo.push(`Keyword Gaps:\n${graph.seo.keywordGaps.slice(0, 5).map((k: string) => `- ${k}`).join('\n')}`);
    }
    if (graph.seo.technicalIssues?.length) {
      seo.push(`Technical Issues:\n${graph.seo.technicalIssues.slice(0, 5).map((i: string) => `- ${i}`).join('\n')}`);
    }
    if (seo.length > 0) {
      sections.push(`## SEO Context\n${seo.join('\n\n')}`);
    }
  }

  if ((workType === 'landing_page_copy' || workType === 'page_edits') && graph.website) {
    const website = [];
    if (graph.website.conversionIssues?.length) {
      website.push(`Conversion Issues:\n${graph.website.conversionIssues.slice(0, 5).map((i: string) => `- ${i}`).join('\n')}`);
    }
    if (graph.website.uxProblems?.length) {
      website.push(`UX Problems:\n${graph.website.uxProblems.slice(0, 5).map((p: string) => `- ${p}`).join('\n')}`);
    }
    if (website.length > 0) {
      sections.push(`## Website Context\n${website.join('\n\n')}`);
    }
  }

  // Brand context (useful for all types)
  if (graph.brand) {
    const brand = [];
    if (graph.brand.positioning) brand.push(`Positioning: ${graph.brand.positioning}`);
    if (graph.brand.toneOfVoice) brand.push(`Tone of Voice: ${graph.brand.toneOfVoice}`);
    if (graph.brand.valueProps?.length) {
      brand.push(`Value Props:\n${graph.brand.valueProps.slice(0, 3).map((v: string) => `- ${v}`).join('\n')}`);
    }
    if (brand.length > 0) {
      sections.push(`## Brand Context\n${brand.join('\n\n')}`);
    }
  }

  if (sections.length === 0) {
    return '';
  }

  return `\n\n--- COMPANY CONTEXT (from diagnostics) ---\n\n${sections.join('\n\n')}\n\n--- END CONTEXT ---`;
}

// ============================================================================
// Prompt Generation
// ============================================================================

function buildPrompt(request: AiBriefRequest, contextData?: string): string {
  const workTypeLabel = getWorkTypeLabel(request.workType);
  const briefType = mapWorkTypeToBriefType(request.workType);

  // Base context
  const context = `
Work Type: ${workTypeLabel}
Scope: ${request.scope}
Goal: ${request.goal}
${request.notes ? `Additional Notes: ${request.notes}` : ''}
`.trim();

  // Work-type specific instructions
  let specificInstructions = '';
  let extensionFields = '';

  if (request.workType === 'seo_copy') {
    specificInstructions = `
CRITICAL CONSTRAINT: You must NOT write actual copy, headlines, or body text.
Instead, provide:
- Recommended page targets and URLs to modify
- Topic/keyword/intent notes (what themes to cover, not the actual words)
- On-page elements to adjust (H1, H2, title tag, meta description, internal links, schema markup)
- Validation steps and acceptance criteria

DO NOT include:
- Rewritten paragraphs
- Draft headlines or titles
- Example copy or body text
- Word-for-word suggestions

Your output should be instructions for a copywriter, not the copy itself.
`;
    extensionFields = `
  "extension": {
    "searchIntent": "Primary search intent to target (e.g., informational, transactional)",
    "priorityTopics": ["Topic 1", "Topic 2", "..."],
    "keywordThemes": ["Theme 1", "Theme 2", "..."],
    "technicalConstraints": ["Constraint 1", "Constraint 2", "..."],
    "measurementWindow": "Timeframe for measuring results (e.g., 90 days)"
  }`;
  } else if (request.workType === 'landing_page_copy' || request.workType === 'page_edits') {
    specificInstructions = `
Provide structure guidance and messaging direction:
- Section recommendations (hero, benefits, social proof, CTA, etc.)
- Messaging points to cover per section
- Tone and voice guidelines
- Conversion optimization notes
- User flow improvements

Avoid writing polished final copy. Focus on structure and intent.
`;
    extensionFields = `
  "extension": {
    "primaryUserFlows": ["User flow 1", "User flow 2", "..."],
    "conversionGoals": ["Goal 1", "Goal 2", "..."],
    "informationArchitectureNotes": "Notes on page structure and hierarchy",
    "cmsConstraints": "Any CMS or technical constraints to consider"
  }`;
  } else {
    specificInstructions = `
Provide clear, actionable guidance:
- Break down the work into specific tasks
- Identify dependencies
- Define clear acceptance criteria
`;
    extensionFields = `
  "extension": {
    "contentPillars": ["Pillar 1", "Pillar 2", "..."],
    "journeyStage": "Customer journey stage (e.g., awareness, consideration, decision)",
    "cadence": "Delivery cadence (e.g., one-time, weekly)",
    "distributionChannels": ["Channel 1", "Channel 2", "..."]
  }`;
  }

  // Include company context if available
  const contextSection = contextData ? `
${contextData}

Use this context to make the brief specific and actionable. Reference actual issues, audiences, and brand guidelines where relevant.
` : '';

  return `You are helping create an execution brief for a website optimization task.

${context}
${contextSection}
${specificInstructions}

Generate a structured brief that follows the canonical Brief schema. Keep each section concise and actionable.
Be specific - reference actual issues from the context rather than generic placeholder text.

Return your response in this exact JSON format:
{
  "core": {
    "objective": "What this brief aims to achieve (2-3 sentences)",
    "targetAudience": "Who this work is for",
    "problemToSolve": "The key problem this work addresses",
    "singleMindedFocus": "The single most important focus/message",
    "constraints": ["Constraint 1", "Constraint 2", "..."],
    "successDefinition": "How we'll know this worked",
    "assumptions": ["Assumption 1", "Assumption 2", "..."]
  },${extensionFields}
}

Keep lists to 3-7 items each. Be specific and actionable.
Only return valid JSON, no other text.`;
}

// ============================================================================
// Brief Quality Guardrail
// ============================================================================

/**
 * Generic patterns that indicate a brief needs improvement.
 * These are vague phrases that suggest the brief isn't grounded in actual data.
 */
const GENERIC_PATTERNS = [
  /\bincrease\s+(website\s+)?traffic\b/i,
  /\bimprove\s+(overall\s+)?performance\b/i,
  /\benhance\s+user\s+experience\b/i,
  /\boptimize\s+for\s+seo\b/i,
  /\btarget\s+audience\s+will\b/i,
  /\brelevant\s+keywords?\b/i,
  /\bhigh-quality\s+content\b/i,
  /\bengaging\s+content\b/i,
  /\bvaluable\s+content\b/i,
  /\bbetter\s+rankings?\b/i,
  /\bmore\s+visibility\b/i,
  /\bkey\s+stakeholders?\b/i,
  /\bbest\s+practices?\b/i,
  /\bindustry\s+standards?\b/i,
];

/**
 * Minimum specificity score threshold (0-1).
 * Briefs below this threshold are considered too generic.
 */
const SPECIFICITY_THRESHOLD = 0.4;

/**
 * Check if a brief is too generic and needs improvement.
 * Returns a score from 0 (very generic) to 1 (very specific).
 */
function assessBriefSpecificity(brief: { core: BriefCore }): { score: number; genericMatches: string[] } {
  const textToCheck = [
    brief.core.objective,
    brief.core.targetAudience,
    brief.core.problemToSolve,
    brief.core.singleMindedFocus,
    brief.core.successDefinition,
    brief.core.constraints?.join(' '),
    brief.core.assumptions?.join(' '),
  ]
    .filter(Boolean)
    .join(' ');

  if (!textToCheck || textToCheck.length < 50) {
    return { score: 0, genericMatches: ['Brief too short'] };
  }

  // Check for generic patterns
  const genericMatches: string[] = [];
  for (const pattern of GENERIC_PATTERNS) {
    const match = textToCheck.match(pattern);
    if (match) {
      genericMatches.push(match[0]);
    }
  }

  // Count specific indicators (numbers, percentages, proper nouns, URLs)
  const specificIndicators = [
    /\d+%/g, // Percentages
    /\$[\d,]+/g, // Dollar amounts
    /\d+\s*(users?|visitors?|sessions?|conversions?)/gi, // Metrics with numbers
    /https?:\/\/[^\s]+/g, // URLs
    /\/[a-z0-9-]+\//gi, // URL paths
    /H[1-6]\s+tag/gi, // Specific HTML elements
    /title\s+tag/gi,
    /meta\s+description/gi,
  ];

  let specificCount = 0;
  for (const indicator of specificIndicators) {
    const matches = textToCheck.match(indicator);
    if (matches) {
      specificCount += matches.length;
    }
  }

  // Calculate score: penalize generic matches, reward specifics
  const genericPenalty = genericMatches.length * 0.15;
  const specificBonus = Math.min(specificCount * 0.1, 0.5);
  const baseScore = 0.5;

  const score = Math.max(0, Math.min(1, baseScore - genericPenalty + specificBonus));

  return { score, genericMatches };
}

/**
 * Build an improvement prompt to make a generic brief more specific.
 */
function buildImprovementPrompt(
  originalBrief: { core: BriefCore },
  contextData: string,
  genericMatches: string[]
): string {
  const briefJson = JSON.stringify(originalBrief, null, 2);

  return `You are improving a marketing brief that is too generic. The brief needs to be grounded in specific diagnostic data.

ORIGINAL BRIEF:
${briefJson}

PROBLEMS DETECTED:
The following generic phrases were found: ${genericMatches.join(', ')}

DIAGNOSTIC CONTEXT TO USE:
${contextData}

YOUR TASK:
Rewrite the brief to be more specific by:
1. Replacing generic phrases with specific data from the diagnostic context
2. Adding specific metrics, URLs, or page names where relevant
3. Referencing actual issues found in the diagnostics
4. Keeping the same overall structure (core fields, extension fields)

RULES:
- Keep the same JSON structure
- Make every statement reference specific data where possible
- If the context mentions specific pages, SEO issues, or audience data, use them
- Replace vague goals like "increase traffic" with specific targets like "improve organic traffic to /pricing page"
- Keep the same brief type and work type focus

Return ONLY the improved JSON, no other text.`;
}

/**
 * Attempt to improve a generic brief using additional Claude call.
 */
async function improveBrief(
  originalBrief: { core: BriefCore; extension: any },
  contextData: string,
  genericMatches: string[]
): Promise<{ core: BriefCore; extension: any } | null> {
  if (!contextData || contextData.length < 100) {
    // Not enough context to improve
    console.log('[AI Brief] Skipping improvement: insufficient context data');
    return null;
  }

  const prompt = buildImprovementPrompt(originalBrief, contextData, genericMatches);

  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  // Extract JSON
  let jsonText = responseText;
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  }

  try {
    const improved = JSON.parse(jsonText);
    if (improved.core?.objective) {
      return improved;
    }
  } catch {
    console.warn('[AI Brief] Failed to parse improved brief');
  }

  return null;
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await context.params;
    const body = await request.json() as AiBriefRequest;

    // Validate required fields
    if (!body.workItemId) {
      return NextResponse.json(
        { error: 'workItemId is required' },
        { status: 400 }
      );
    }

    if (!body.workType) {
      return NextResponse.json(
        { error: 'workType is required' },
        { status: 400 }
      );
    }

    if (!body.scope || !body.scope.trim()) {
      return NextResponse.json(
        { error: 'scope is required' },
        { status: 400 }
      );
    }

    if (!body.goal || !body.goal.trim()) {
      return NextResponse.json(
        { error: 'goal is required' },
        { status: 400 }
      );
    }

    console.log('[AI Brief] Creating canonical brief for work item:', {
      workItemId: body.workItemId,
      companyId,
      companyIdLength: companyId.length,
      companyIdPrefix: companyId.slice(0, 3),
      workType: body.workType,
    });

    // Step 1: Run context boosters to ground brief in fresh diagnostic data
    const boosters = getBoostersForWorkType(body.workType);
    let boosterAnnotation: string | undefined;

    if (boosters.length > 0) {
      console.log('[AI Brief] Running context boosters:', boosters);
      try {
        const boosterResult = await runContextBoosters({
          companyId,
          labs: boosters,
          runId: `brief-${body.workItemId}`,
        });

        console.log('[AI Brief] Boosters complete:', {
          success: boosterResult.success,
          totalFieldsUpdated: boosterResult.totalFieldsUpdated,
          totalDurationMs: boosterResult.totalDurationMs,
        });

        if (boosterResult.totalFieldsUpdated > 0) {
          // Capitalize lab names for display: "website" -> "Website"
          const labNames = boosters.map((l) => l.charAt(0).toUpperCase() + l.slice(1).replace('_', ' '));
          boosterAnnotation = labNames.join(' + '); // e.g., "Website + Brand"
        }
      } catch (boosterError) {
        console.warn('[AI Brief] Booster run failed, continuing without:', boosterError);
        // Don't fail the whole brief generation if boosters fail
      }
    }

    // Step 2: Load fresh context after boosters complete
    let contextData: string | undefined;
    try {
      const graph = await loadContextGraph(companyId);
      if (graph) {
        contextData = formatContextForBrief(graph, body.workType);
      }
    } catch (ctxError) {
      console.warn('[AI Brief] Failed to load context, continuing without:', ctxError);
    }

    // Step 3: Determine brief type from work type
    const briefType = mapWorkTypeToBriefType(body.workType);
    const workTypeLabel = getWorkTypeLabel(body.workType);

    // Step 4: Create the Brief record (work-centric, no engagement required)
    const briefTitle = `${workTypeLabel}: ${body.scope.slice(0, 50)}${body.scope.length > 50 ? '...' : ''}`;
    const createdBrief = await createBrief({
      companyId,
      workItemId: body.workItemId, // Link directly to work item
      title: briefTitle,
      type: briefType,
    });

    if (!createdBrief) {
      console.error('[AI Brief] Failed to create brief record');
      return NextResponse.json(
        { error: 'Failed to create brief record' },
        { status: 500 }
      );
    }

    console.log('[AI Brief] Created brief record:', {
      briefId: createdBrief.id,
      briefCompanyId: createdBrief.companyId,
      briefWorkItemId: createdBrief.workItemId,
      briefTitle: createdBrief.title,
      briefType: createdBrief.type,
      briefStatus: createdBrief.status,
    });

    // Step 5: Build prompt and call Claude (with context from boosters)
    const prompt = buildPrompt(body, contextData);

    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Parse response
    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    let aiGeneratedContent: { core: BriefCore; extension: SeoExtension | WebsiteExtension | ContentExtension };
    try {
      aiGeneratedContent = JSON.parse(jsonText);
    } catch {
      console.error('[AI Brief] Failed to parse AI response:', responseText);
      // Brief was created but AI content failed - user can still edit it manually
      return NextResponse.json({
        briefId: createdBrief.id,
        workItemId: body.workItemId,
        success: true,
        warning: 'Brief created but AI content generation failed. You can edit the brief manually.',
      });
    }

    // Validate the brief structure
    if (!aiGeneratedContent.core?.objective) {
      console.error('[AI Brief] Invalid brief structure:', aiGeneratedContent);
      return NextResponse.json({
        briefId: createdBrief.id,
        workItemId: body.workItemId,
        success: true,
        warning: 'Brief created but AI content was incomplete. You can edit the brief manually.',
      });
    }

    // Step 5b: Quality guardrail - check if brief is too generic
    let finalContent = aiGeneratedContent;
    const { score, genericMatches } = assessBriefSpecificity(aiGeneratedContent);

    console.log('[AI Brief] Specificity check:', {
      score,
      threshold: SPECIFICITY_THRESHOLD,
      genericMatches: genericMatches.slice(0, 5),
    });

    if (score < SPECIFICITY_THRESHOLD && contextData) {
      console.log('[AI Brief] Brief is too generic, attempting improvement...');
      try {
        const improvedContent = await improveBrief(aiGeneratedContent, contextData, genericMatches);
        if (improvedContent) {
          // Verify improvement actually helped
          const { score: improvedScore } = assessBriefSpecificity(improvedContent);
          if (improvedScore > score) {
            console.log('[AI Brief] Improvement successful:', { originalScore: score, improvedScore });
            finalContent = improvedContent;
          } else {
            console.log('[AI Brief] Improvement did not help, using original');
          }
        }
      } catch (improveError) {
        console.warn('[AI Brief] Improvement failed, using original:', improveError);
      }
    }

    // Step 6: Update the Brief with AI-generated content
    // Add booster annotation to assumptions if boosters ran
    const coreWithAnnotation = { ...finalContent.core };
    if (boosterAnnotation) {
      const existingAssumptions = coreWithAnnotation.assumptions || [];
      coreWithAnnotation.assumptions = [
        ...existingAssumptions,
        `Grounded in fresh ${boosterAnnotation} diagnostics`,
      ];
    }

    const updatedBrief = await updateBrief(createdBrief.id, {
      core: coreWithAnnotation,
      extension: finalContent.extension,
      traceability: {
        sourceStrategicBetIds: [],
      },
    });

    if (!updatedBrief) {
      console.error('[AI Brief] Failed to update brief with AI content');
      // Brief was created, just couldn't update - still usable
    }

    console.log('[AI Brief] Brief updated with AI content:', {
      briefId: createdBrief.id,
      objectiveLength: finalContent.core.objective?.length,
      wasImproved: finalContent !== aiGeneratedContent,
    });

    // Step 7: Update the work item source to link to this brief
    await updateWorkItemSourceWithBriefId(body.workItemId, createdBrief.id);

    console.log('[AI Brief] Work item linked to brief:', {
      workItemId: body.workItemId,
      briefId: createdBrief.id,
    });

    const response: AiBriefResponse = {
      briefId: createdBrief.id,
      workItemId: body.workItemId,
      success: true,
      groundedIn: boosterAnnotation || undefined, // e.g., "Website + Brand"
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[AI Brief] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
