// app/api/os/companies/[companyId]/artifacts/generate/route.ts
// AI-powered artifact generation from strategy, plans, or work
//
// POST - Generate a new artifact using the artifact registry system

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCompanyById } from '@/lib/airtable/companies';
import { generateArtifact, type GenerateArtifactInput } from '@/lib/os/artifacts/generator';
import { getArtifactType, isValidArtifactType, type ArtifactSourceType } from '@/lib/os/artifacts/registry';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';

// AI generation can take up to 2 minutes
export const maxDuration = 120;

type Params = { params: Promise<{ companyId: string }> };

// ============================================================================
// Request Validation
// ============================================================================

const ArtifactSourceSchema = z.object({
  sourceType: z.enum(['strategy', 'plan:media', 'plan:content', 'work']),
  sourceId: z.string().min(1),
  includedTacticIds: z.array(z.string()).optional(),
});

const GenerateArtifactRequestSchema = z.object({
  artifactTypeId: z.string().min(1),
  source: ArtifactSourceSchema,
  mode: z.enum(['create', 'refresh']).default('create'),
  promptHint: z.string().optional(),
});

// ============================================================================
// POST Handler
// ============================================================================

/**
 * POST /api/os/companies/[companyId]/artifacts/generate
 * Generate a new artifact using AI
 *
 * Body:
 * - artifactTypeId: string (required) - ID of artifact type from registry
 * - source: { sourceType, sourceId, includedTacticIds? } (required)
 * - mode: 'create' | 'refresh' (optional, defaults to 'create')
 * - promptHint: string (optional) - Additional context for generation
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId } = await params;

    // Validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validation = GenerateArtifactRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { artifactTypeId, source, mode, promptHint } = validation.data;

    // Validate artifact type exists
    if (!isValidArtifactType(artifactTypeId)) {
      return NextResponse.json(
        { error: `Unknown artifact type: ${artifactTypeId}` },
        { status: 400 }
      );
    }

    // Validate source type is supported for this artifact type
    const artifactType = getArtifactType(artifactTypeId)!;
    if (!artifactType.supportedSources.includes(source.sourceType as ArtifactSourceType)) {
      return NextResponse.json(
        {
          error: `Artifact type '${artifactTypeId}' does not support source '${source.sourceType}'`,
          supportedSources: artifactType.supportedSources,
        },
        { status: 400 }
      );
    }

    // Get company for name
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    console.log(`[API Artifacts] Generating ${artifactTypeId} for company ${companyId}`);

    // Build generation input
    const generationInput: GenerateArtifactInput = {
      companyId,
      companyName: company.name,
      artifactTypeId,
      source: {
        sourceType: source.sourceType as ArtifactSourceType,
        sourceId: source.sourceId,
        includedTacticIds: source.includedTacticIds,
      },
      promptHint,
      mode,
    };

    // Generate the artifact
    const result = await generateArtifact(generationInput);

    console.log(`[API Artifacts] Generated artifact ${result.artifact.id} with ${result.warnings.length} warnings`);

    return NextResponse.json({
      artifact: result.artifact,
      warnings: result.warnings,
      inputsUsedHash: result.inputsUsedHash,
    }, { status: 201 });

  } catch (error) {
    console.error('[API Artifacts] Generation failed:', error);

    // Handle specific error types
    if (error instanceof Error) {
      // Don't expose internal error messages in production
      const message = process.env.NODE_ENV === 'development'
        ? error.message
        : 'Failed to generate artifact';

      return NextResponse.json(
        { error: message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate artifact' },
      { status: 500 }
    );
  }
}
