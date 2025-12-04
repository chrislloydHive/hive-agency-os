// app/api/audience/[companyId]/personas/route.ts
// Personas API Route
//
// Handles:
// - GET: Load current persona set
// - POST: Save/update persona set or trigger AI generation
// - PUT: Update Context Graph from personas

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCurrentAudienceModel } from '@/lib/audience/storage';
import {
  getPersonaSet,
  savePersonaSet,
  getOrCreatePersonaSet,
  listPersonaSets,
  deletePersonaSet,
} from '@/lib/audience/personaStorage';
import {
  PersonaSet,
  Persona,
  validatePersonaSet,
  addPersonaToSet,
  updatePersonaInSet,
  removePersonaFromSet,
  createEmptyPersona,
} from '@/lib/audience/personas';
import {
  generatePersonasFromAudienceModel,
  generatePersonaForSegment,
  regeneratePersonas,
} from '@/lib/audience/aiPersonas';
import { buildMediaPersonaPack, buildCreativePersonaPack } from '@/lib/audience/personaPacks';
import { updateGraphFromPersonaSet } from '@/lib/contextGraph/updateFromPersonas';
import { loadContextGraph } from '@/lib/contextGraph/storage';

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

// ============================================================================
// GET - Load persona set
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
    if (action === 'history') {
      // Load persona set history
      const sets = await listPersonaSets(companyId);
      return NextResponse.json({ sets });
    }

    if (action === 'packs') {
      // Load persona packs
      const personaSet = await getPersonaSet(companyId);
      if (!personaSet) {
        return NextResponse.json(
          { error: 'No persona set found' },
          { status: 404 }
        );
      }
      const mediaPack = buildMediaPersonaPack(personaSet);
      const creativePack = buildCreativePersonaPack(personaSet);
      return NextResponse.json({ mediaPack, creativePack });
    }

    // Default: Load the persona set
    const [personaSet, audienceModel] = await Promise.all([
      getPersonaSet(companyId),
      getCurrentAudienceModel(companyId),
    ]);

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
      },
      personaSet,
      hasAudienceModel: !!audienceModel,
      audienceModelId: audienceModel?.id,
      segmentCount: audienceModel?.segments.length || 0,
    });
  } catch (error) {
    console.error('[API:personas] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load persona data' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Save/update persona set or trigger AI generation
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

    // Handle AI generation action
    if (body.action === 'generate') {
      console.log('[API:personas] Triggering AI generation for:', companyId);

      const audienceModel = await getCurrentAudienceModel(companyId);
      if (!audienceModel) {
        return NextResponse.json(
          { error: 'No audience model found. Create an audience model first.' },
          { status: 400 }
        );
      }

      const result = await generatePersonasFromAudienceModel(audienceModel, {
        companyContext: body.companyContext,
      });

      if (!result.success || !result.personaSet) {
        return NextResponse.json(
          { error: result.error || 'Persona generation failed' },
          { status: 400 }
        );
      }

      // Save the generated persona set
      const savedSet = await savePersonaSet(result.personaSet, company.name);

      return NextResponse.json({
        success: true,
        personaSet: savedSet,
        confidence: result.confidence,
        segmentsUsed: result.segmentsUsed,
      });
    }

    // Handle regeneration action
    if (body.action === 'regenerate') {
      console.log('[API:personas] Regenerating personas for:', companyId);

      const [existingSet, audienceModel] = await Promise.all([
        getPersonaSet(companyId),
        getCurrentAudienceModel(companyId),
      ]);

      if (!existingSet) {
        return NextResponse.json(
          { error: 'No existing persona set to regenerate' },
          { status: 400 }
        );
      }

      if (!audienceModel) {
        return NextResponse.json(
          { error: 'No audience model found' },
          { status: 400 }
        );
      }

      const result = await regeneratePersonas(existingSet, audienceModel, {
        companyContext: body.companyContext,
      });

      if (!result.success || !result.personaSet) {
        return NextResponse.json(
          { error: result.error || 'Regeneration failed' },
          { status: 400 }
        );
      }

      // Save the regenerated set
      const savedSet = await savePersonaSet(result.personaSet, company.name);

      return NextResponse.json({
        success: true,
        personaSet: savedSet,
        confidence: result.confidence,
        segmentsUsed: result.segmentsUsed,
      });
    }

    // Handle single persona generation for a segment
    if (body.action === 'generateForSegment') {
      const { segmentId } = body;

      if (!segmentId) {
        return NextResponse.json(
          { error: 'segmentId is required' },
          { status: 400 }
        );
      }

      const audienceModel = await getCurrentAudienceModel(companyId);
      if (!audienceModel) {
        return NextResponse.json(
          { error: 'No audience model found' },
          { status: 400 }
        );
      }

      const segment = audienceModel.segments.find(s => s.id === segmentId);
      if (!segment) {
        return NextResponse.json(
          { error: 'Segment not found' },
          { status: 404 }
        );
      }

      // Get existing personas to avoid name collisions
      const existingSet = await getPersonaSet(companyId);
      const existingNames = existingSet?.personas.map(p => p.name) || [];

      const result = await generatePersonaForSegment(segment, companyId, {
        companyContext: body.companyContext,
        existingPersonaNames: existingNames,
      });

      if (!result.success || !result.persona) {
        return NextResponse.json(
          { error: result.error || 'Persona generation failed' },
          { status: 400 }
        );
      }

      // Add to existing set or create new one
      let personaSet = existingSet;
      if (!personaSet) {
        personaSet = {
          id: `pset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          companyId,
          audienceModelId: audienceModel.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          personas: [],
          version: 1,
          source: 'ai_seeded',
        };
      }

      personaSet = addPersonaToSet(personaSet, result.persona);
      const savedSet = await savePersonaSet(personaSet, company.name);

      return NextResponse.json({
        success: true,
        persona: result.persona,
        personaSet: savedSet,
      });
    }

    // Handle add persona action
    if (body.action === 'addPersona') {
      const personaSet = await getPersonaSet(companyId);
      const audienceModel = await getCurrentAudienceModel(companyId);

      let set = personaSet;
      if (!set) {
        set = {
          id: `pset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          companyId,
          audienceModelId: audienceModel?.id || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          personas: [],
          version: 1,
          source: 'manual',
        };
      }

      const newPersona = body.persona
        ? { ...createEmptyPersona(), ...body.persona }
        : createEmptyPersona(body.name || 'New Persona');

      set = addPersonaToSet(set, newPersona);
      set.source = 'mixed';
      const savedSet = await savePersonaSet(set, company.name);

      return NextResponse.json({
        success: true,
        persona: newPersona,
        personaSet: savedSet,
      });
    }

    // Handle update persona action
    if (body.action === 'updatePersona') {
      const { personaId, updates } = body;

      if (!personaId || !updates) {
        return NextResponse.json(
          { error: 'personaId and updates are required' },
          { status: 400 }
        );
      }

      const personaSet = await getPersonaSet(companyId);
      if (!personaSet) {
        return NextResponse.json(
          { error: 'No persona set found' },
          { status: 404 }
        );
      }

      const updatedSet = updatePersonaInSet(personaSet, personaId, updates);
      const savedSet = await savePersonaSet(updatedSet, company.name);

      return NextResponse.json({
        success: true,
        personaSet: savedSet,
      });
    }

    // Handle delete persona action
    if (body.action === 'deletePersona') {
      const { personaId } = body;

      if (!personaId) {
        return NextResponse.json(
          { error: 'personaId is required' },
          { status: 400 }
        );
      }

      const personaSet = await getPersonaSet(companyId);
      if (!personaSet) {
        return NextResponse.json(
          { error: 'No persona set found' },
          { status: 404 }
        );
      }

      const updatedSet = removePersonaFromSet(personaSet, personaId);
      const savedSet = await savePersonaSet(updatedSet, company.name);

      return NextResponse.json({
        success: true,
        personaSet: savedSet,
      });
    }

    // Handle regular set save
    if (body.personaSet) {
      const validation = validatePersonaSet(body.personaSet);
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Invalid persona set', details: validation.errors },
          { status: 400 }
        );
      }

      const set = validation.personaSet!;

      // Ensure company ID matches
      if (set.companyId !== companyId) {
        set.companyId = companyId;
      }

      // Mark as mixed source since it's being manually saved
      if (set.source === 'ai_seeded') {
        set.source = 'mixed';
      }

      const savedSet = await savePersonaSet(set, company.name);

      return NextResponse.json({
        success: true,
        personaSet: savedSet,
      });
    }

    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API:personas] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save personas' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update Context Graph from personas
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

    const { updateContextGraph } = body;

    // Load persona set and context graph
    const [personaSet, graph] = await Promise.all([
      getPersonaSet(companyId),
      loadContextGraph(companyId),
    ]);

    if (!personaSet) {
      return NextResponse.json(
        { error: 'No persona set found' },
        { status: 404 }
      );
    }

    // Update Context Graph if requested and available
    let graphUpdateResult = null;
    if (updateContextGraph !== false && graph) {
      graphUpdateResult = await updateGraphFromPersonaSet(graph, personaSet, {
        notes: 'Updated from Personas via API',
      });
    }

    return NextResponse.json({
      success: true,
      personaSetId: personaSet.id,
      graphUpdated: graphUpdateResult?.success || false,
      fieldsUpdated: graphUpdateResult?.fieldsUpdated || [],
    });
  } catch (error) {
    console.error('[API:personas] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update context graph' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete a persona set
// ============================================================================

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { companyId } = await context.params;
    const { searchParams } = new URL(request.url);
    const setId = searchParams.get('setId');

    if (!setId) {
      return NextResponse.json(
        { error: 'setId query parameter is required' },
        { status: 400 }
      );
    }

    const success = await deletePersonaSet(setId);

    return NextResponse.json({
      success,
      deletedSetId: success ? setId : null,
    });
  } catch (error) {
    console.error('[API:personas] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete persona set' },
      { status: 500 }
    );
  }
}
