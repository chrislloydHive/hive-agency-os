// app/api/os/programs/[programId]/ai/fill-missing/route.ts
// AI: Fill Missing Pieces
//
// Generates ONLY the missing sections of a program plan.
// Does NOT overwrite existing content - only fills gaps.
//
// Input: { missing: string[] }
// - 'deliverables' - generate 3-5 deliverables
// - 'milestones' - generate 2-3 milestones
// - 'kpis' - generate 2-3 KPIs
// - 'constraints' - generate 2-3 constraints
// - 'assumptions' - generate 2-3 assumptions
// - 'dependencies' - generate 2-3 dependencies

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { getPlanningProgram, updatePlanningProgram } from '@/lib/airtable/planningPrograms';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getActiveStrategy } from '@/lib/os/strategy';
import { getStrategyInputs } from '@/lib/os/strategy/strategyInputs';
import {
  generatePlanningDeliverableId,
  generatePlanningMilestoneId,
  type PlanningProgram,
  type PlanningDeliverable,
  type PlanningMilestone,
  type PlanningProgramKPI,
} from '@/lib/types/program';

export const maxDuration = 60;

// ============================================================================
// Types
// ============================================================================

type RouteParams = {
  params: Promise<{ programId: string }>;
};

const FillMissingRequestSchema = z.object({
  missing: z.array(z.enum([
    'deliverables',
    'milestones',
    'kpis',
    'constraints',
    'assumptions',
    'dependencies',
  ])),
});

// Response schemas for each section type
const GeneratedDeliverablesSchema = z.array(z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(['document', 'asset', 'campaign', 'integration', 'process', 'other']).default('other'),
}));

const GeneratedMilestonesSchema = z.array(z.object({
  title: z.string(),
  description: z.string().optional(),
}));

const GeneratedKPIsSchema = z.array(z.object({
  name: z.string(),
  target: z.string(),
}));

const GeneratedStringsSchema = z.array(z.string());

const GeneratedDependenciesSchema = z.array(z.object({
  dependency: z.string(),
  whyNeeded: z.string(),
}));

// ============================================================================
// System Prompt
// ============================================================================

function getSystemPrompt(missing: string[], hasServices: boolean): string {
  const sections = missing.map(m => {
    switch (m) {
      case 'deliverables':
        return `- deliverables: Array of 3-5 objects with { title, description, type }
  type must be one of: document, asset, campaign, integration, process, other`;
      case 'milestones':
        return `- milestones: Array of 2-3 objects with { title, description }`;
      case 'kpis':
        return `- kpis: Array of 2-3 objects with { name, target }`;
      case 'constraints':
        return `- constraints: Array of 2-3 strings`;
      case 'assumptions':
        return `- assumptions: Array of 2-3 strings`;
      case 'dependencies':
        return `- dependencies: Array of 2-3 objects with { dependency, whyNeeded }`;
      default:
        return '';
    }
  }).filter(Boolean).join('\n');

  const servicesRule = hasServices ? `
- SERVICES-AWARE: Only generate deliverables that can be executed using the Hive Services listed
- Prefer using "elite" or "strong" tier services when available
- If needed capabilities aren't available, note it in assumptions or constraints` : '';

  return `You are a senior program manager filling in missing sections of a program plan.

Generate ONLY the requested sections. Be specific to the program context provided.

OUTPUT FORMAT (strict JSON):
{
${sections}
}

RULES:
- Be specific to the program's goal and context
- Don't be generic - tailor everything to this specific program
- Keep deliverables actionable and clear
- Milestones should be meaningful checkpoints
- KPIs should be measurable with specific targets${servicesRule}
- Return valid JSON only, no markdown code blocks`;
}

// ============================================================================
// Handler
// ============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { programId } = await params;
    const body = await request.json();

    // Validate request
    const parseResult = FillMissingRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { missing } = parseResult.data;

    if (missing.length === 0) {
      return NextResponse.json(
        { error: 'No missing sections specified' },
        { status: 400 }
      );
    }

    // Load program
    const program = await getPlanningProgram(programId);
    if (!program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    // Load context in parallel (including strategy inputs for services)
    const [contextGraph, strategy, strategyInputs] = await Promise.all([
      loadContextGraph(program.companyId).catch(() => null),
      getActiveStrategy(program.companyId).catch(() => null),
      getStrategyInputs(program.companyId).catch(() => null),
    ]);

    // Extract available services from strategy inputs
    const availableServices = strategyInputs?.executionCapabilities?.serviceTaxonomy ?? [];

    // Build prompt (services section added FIRST)
    const prompt = buildPrompt(program, contextGraph, strategy, availableServices, missing);

    // Call Anthropic
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
      system: getSystemPrompt(missing, availableServices.length > 0),
    });

    // Extract content
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    // Parse JSON
    const rawPayload = parseJsonResponse(textContent.text);

    // Apply generated content to program (merge, don't overwrite)
    const updates = applyGeneratedContent(program, rawPayload, missing);

    // Save to Airtable
    const updatedProgram = await updatePlanningProgram(programId, updates);

    return NextResponse.json({
      success: true,
      program: updatedProgram,
      filled: missing,
      message: `Filled ${missing.length} section(s): ${missing.join(', ')}`,
    });
  } catch (error) {
    console.error('[ai/fill-missing] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fill missing pieces' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

function buildPrompt(
  program: PlanningProgram,
  context: unknown,
  strategy: unknown,
  availableServices: string[],
  missing: string[]
): string {
  const parts: string[] = [];

  // ========== HIVE SERVICES (FIRST - Most Important) ==========
  if (availableServices.length > 0) {
    parts.push('HIVE SERVICES (What We Can Deliver)');
    parts.push('='.repeat(40));
    parts.push('The following services are enabled and available for this client:');
    for (const service of availableServices) {
      parts.push(`• ${service}`);
    }
    parts.push('');
    parts.push('IMPORTANT: Only generate deliverables that leverage these services.');
    parts.push('');
  }

  parts.push('PROGRAM TO COMPLETE');
  parts.push('='.repeat(40));
  parts.push(`Title: ${program.title}`);

  if (program.scope.summary) {
    parts.push(`Goal: ${program.scope.summary}`);
  }

  if (program.origin.tacticTitle) {
    parts.push(`Source Tactic: ${program.origin.tacticTitle}`);
  }

  if (program.scope.workstreams.length > 0) {
    parts.push(`Workstreams: ${program.scope.workstreams.join(', ')}`);
  }

  // Show existing content for context
  if (program.scope.deliverables.length > 0 && !missing.includes('deliverables')) {
    parts.push(`\nExisting Deliverables: ${program.scope.deliverables.map(d => d.title).join(', ')}`);
  }

  if (program.planDetails.milestones.length > 0 && !missing.includes('milestones')) {
    parts.push(`Existing Milestones: ${program.planDetails.milestones.map(m => m.title).join(', ')}`);
  }

  if (program.success.kpis.length > 0 && !missing.includes('kpis')) {
    parts.push(`Existing KPIs: ${program.success.kpis.map(k => k.label).join(', ')}`);
  }

  // Add context if available
  if (context && typeof context === 'object') {
    const ctx = context as Record<string, unknown>;
    if (ctx.identity && typeof ctx.identity === 'object') {
      const identity = ctx.identity as Record<string, { value?: string }>;
      if (identity.businessName?.value) {
        parts.push(`\nCompany: ${identity.businessName.value}`);
      }
    }
  }

  parts.push('\n' + '='.repeat(40));
  parts.push(`GENERATE ONLY: ${missing.join(', ')}`);
  parts.push('Return valid JSON matching the specified structure.');

  return parts.join('\n');
}

function parseJsonResponse(text: string): Record<string, unknown> {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Failed to parse AI response as JSON');
  }
}

function applyGeneratedContent(
  program: PlanningProgram,
  generated: Record<string, unknown>,
  missing: string[]
): Partial<PlanningProgram> {
  const updates: Partial<PlanningProgram> = {};
  const scopeUpdates: Partial<typeof program.scope> = {};
  const planUpdates: Partial<typeof program.planDetails> = {};
  const successUpdates: Partial<typeof program.success> = {};

  for (const section of missing) {
    const data = generated[section];
    if (!data) continue;

    switch (section) {
      case 'deliverables': {
        const parsed = GeneratedDeliverablesSchema.safeParse(data);
        if (parsed.success) {
          const newDeliverables: PlanningDeliverable[] = parsed.data.map(d => ({
            id: generatePlanningDeliverableId(),
            title: d.title,
            description: d.description,
            type: d.type,
            status: 'planned' as const,
          }));
          // Append to existing
          scopeUpdates.deliverables = [
            ...program.scope.deliverables,
            ...newDeliverables,
          ];
        }
        break;
      }

      case 'milestones': {
        const parsed = GeneratedMilestonesSchema.safeParse(data);
        if (parsed.success) {
          const newMilestones: PlanningMilestone[] = parsed.data.map(m => ({
            id: generatePlanningMilestoneId(),
            title: m.title,
            status: 'pending' as const,
          }));
          planUpdates.milestones = [
            ...program.planDetails.milestones,
            ...newMilestones,
          ];
        }
        break;
      }

      case 'kpis': {
        const parsed = GeneratedKPIsSchema.safeParse(data);
        if (parsed.success) {
          const newKpis: PlanningProgramKPI[] = parsed.data.map(k => ({
            key: `kpi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            label: k.name,
            target: k.target,
          }));
          successUpdates.kpis = [
            ...program.success.kpis,
            ...newKpis,
          ];
        }
        break;
      }

      case 'constraints': {
        const parsed = GeneratedStringsSchema.safeParse(data);
        if (parsed.success) {
          scopeUpdates.constraints = [
            ...program.scope.constraints,
            ...parsed.data,
          ];
        }
        break;
      }

      case 'assumptions': {
        const parsed = GeneratedStringsSchema.safeParse(data);
        if (parsed.success) {
          scopeUpdates.assumptions = [
            ...program.scope.assumptions,
            ...parsed.data,
          ];
        }
        break;
      }

      case 'dependencies': {
        const parsed = GeneratedDependenciesSchema.safeParse(data);
        if (parsed.success) {
          // Convert to string format
          const newDeps = parsed.data.map(d => `${d.dependency}: ${d.whyNeeded}`);
          scopeUpdates.dependencies = [
            ...program.scope.dependencies,
            ...newDeps,
          ];
        }
        break;
      }
    }
  }

  // Apply updates
  if (Object.keys(scopeUpdates).length > 0) {
    updates.scope = { ...program.scope, ...scopeUpdates };
  }
  if (Object.keys(planUpdates).length > 0) {
    updates.planDetails = { ...program.planDetails, ...planUpdates };
  }
  if (Object.keys(successUpdates).length > 0) {
    updates.success = { ...program.success, ...successUpdates };
  }

  return updates;
}
