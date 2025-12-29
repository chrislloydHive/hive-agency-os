// app/api/audience/[companyId]/route.ts
// Audience Lab API Route
//
// Handles:
// - GET: Load current audience model and signals
// - POST: Save/update audience model
// - PUT: Set model as canonical and update Context Graph

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getCurrentAudienceModel,
  saveAudienceModel,
  setAudienceModelCanonical,
  listAudienceModels,
} from '@/lib/audience/storage';
import { validateAudienceModel } from '@/lib/audience/model';
import { loadAudienceSignalsForCompany, getSignalsSummary } from '@/lib/audience/signals';
import { seedAudienceModelFromSignals, expandSegmentFromSeed } from '@/lib/audience/aiSeed';
import { updateGraphFromAudienceModel } from '@/lib/contextGraph/updateFromAudience';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { buildMediaAudiencePack, buildCreativeAudiencePack } from '@/lib/audience/packs';

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

// ============================================================================
// GET - Load audience model and signals
// ============================================================================

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { companyId } = await context.params;

    // Get company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Check for action parameter
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Handle specific actions
    if (action === 'signals') {
      // Load signals only
      const signals = await loadAudienceSignalsForCompany(companyId);
      const summary = getSignalsSummary(signals);
      return NextResponse.json({ signals, summary });
    }

    if (action === 'history') {
      // Load model history
      const models = await listAudienceModels(companyId);
      return NextResponse.json({ models });
    }

    if (action === 'packs') {
      // Load audience packs
      const model = await getCurrentAudienceModel(companyId);
      if (!model) {
        return NextResponse.json(
          { error: 'No audience model found' },
          { status: 404 }
        );
      }
      const mediaPack = buildMediaAudiencePack(model);
      const creativePack = buildCreativeAudiencePack(model);
      return NextResponse.json({ mediaPack, creativePack });
    }

    // Default: Load everything for the page
    const [model, signals, contextGraph] = await Promise.all([
      getCurrentAudienceModel(companyId),
      loadAudienceSignalsForCompany(companyId),
      loadContextGraph(companyId),
    ]);

    const signalsSummary = getSignalsSummary(signals);

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        website: company.website,
      },
      model,
      signals,
      signalsSummary,
      hasContextGraph: !!contextGraph,
    });
  } catch (error) {
    console.error('[API:audience] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load audience data' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Save/update audience model or trigger AI seed
// ============================================================================

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { companyId } = await context.params;
    const body = await request.json();

    // Get company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Handle AI seeding action
    if (body.action === 'seed') {
      console.log('[API:audience] Triggering AI seed for:', companyId);

      const signals = await loadAudienceSignalsForCompany(companyId);
      const seedResult = await seedAudienceModelFromSignals(companyId, signals, {
        companyName: company.name,
        createdBy: body.createdBy,
      });

      if (!seedResult.success || !seedResult.model) {
        return NextResponse.json(
          { error: seedResult.error || 'AI seeding failed' },
          { status: 400 }
        );
      }

      // Save the seeded model
      const savedModel = await saveAudienceModel(seedResult.model, company.name);

      return NextResponse.json({
        success: true,
        model: savedModel,
        confidence: seedResult.confidence,
        signalsUsed: seedResult.signalsUsed,
      });
    }

    // Handle segment expansion from seed
    if (body.action === 'expandSegment') {
      console.log('[API:audience] Expanding segment from seed:', body.seed);

      if (!body.seed || typeof body.seed !== 'string') {
        return NextResponse.json(
          { error: 'Seed description is required' },
          { status: 400 }
        );
      }

      // Get existing segment names to avoid overlap
      const existingModel = await getCurrentAudienceModel(companyId);
      const existingSegmentNames = existingModel?.segments.map(s => s.name) || [];

      const result = await expandSegmentFromSeed(body.seed, {
        companyName: company.name,
        industry: company.industry,
        existingSegments: existingSegmentNames,
      });

      if (!result.success || !result.segment) {
        return NextResponse.json(
          { error: result.error || 'Failed to expand segment' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        segment: result.segment,
      });
    }

    // Handle regeneration action
    if (body.action === 'regenerate') {
      console.log('[API:audience] Regenerating model for:', companyId);

      const existingModel = await getCurrentAudienceModel(companyId);
      if (!existingModel) {
        return NextResponse.json(
          { error: 'No existing model to regenerate' },
          { status: 400 }
        );
      }

      const signals = await loadAudienceSignalsForCompany(companyId);
      const seedResult = await seedAudienceModelFromSignals(companyId, signals, {
        companyName: company.name,
        createdBy: body.createdBy,
      });

      if (!seedResult.success || !seedResult.model) {
        return NextResponse.json(
          { error: seedResult.error || 'Regeneration failed' },
          { status: 400 }
        );
      }

      // Increment version
      seedResult.model.version = existingModel.version + 1;
      seedResult.model.source = 'mixed';

      // Save the regenerated model
      const savedModel = await saveAudienceModel(seedResult.model, company.name);

      return NextResponse.json({
        success: true,
        model: savedModel,
        confidence: seedResult.confidence,
        signalsUsed: seedResult.signalsUsed,
      });
    }

    // Handle regular model save
    if (body.model) {
      const validation = validateAudienceModel(body.model);
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Invalid model', details: validation.errors },
          { status: 400 }
        );
      }

      const model = validation.model!;

      // Ensure company ID matches
      if (model.companyId !== companyId) {
        model.companyId = companyId;
      }

      // Mark as mixed source since it's being manually saved
      if (model.source === 'ai_seeded') {
        model.source = 'mixed';
      }

      const savedModel = await saveAudienceModel(model, company.name);

      return NextResponse.json({
        success: true,
        model: savedModel,
      });
    }

    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API:audience] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save audience model' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Set model as canonical and update Context Graph
// ============================================================================

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { companyId } = await context.params;
    const body = await request.json();

    // Get company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    const { modelId, updateContextGraph } = body;

    if (!modelId) {
      return NextResponse.json(
        { error: 'modelId is required' },
        { status: 400 }
      );
    }

    // Set the model as canonical
    const success = await setAudienceModelCanonical(companyId, modelId);
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to set model as canonical' },
        { status: 500 }
      );
    }

    // Update Context Graph if requested
    let graphUpdateResult = null;
    if (updateContextGraph !== false) {
      const model = await getCurrentAudienceModel(companyId);
      const graph = await loadContextGraph(companyId);

      if (model && graph) {
        graphUpdateResult = await updateGraphFromAudienceModel(graph, model, {
          notes: 'Set as canonical via Audience Lab',
        });
      }
    }

    return NextResponse.json({
      success: true,
      modelId,
      graphUpdated: graphUpdateResult?.success || false,
      fieldsUpdated: graphUpdateResult?.fieldsUpdated || [],
    });
  } catch (error) {
    console.error('[API:audience] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to set canonical model' },
      { status: 500 }
    );
  }
}
