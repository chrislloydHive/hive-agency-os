// app/api/os/companies/[companyId]/qbr/story/route.ts
// QBR Story API Route
//
// GET: Retrieve an existing QBR story for a company/quarter
// POST: Generate a new QBR story
// PATCH: Regenerate parts of an existing story

import { NextRequest, NextResponse } from 'next/server';
import {
  getQbrStory,
  generateQbrStory,
  regenerateQbrStory,
} from '@/lib/qbr/qbrOrchestrator';
import type { QbrDomain, RegenerationMode } from '@/lib/qbr/qbrTypes';

// ============================================================================
// GET - Retrieve Story
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  const quarter = request.nextUrl.searchParams.get('quarter');

  if (!quarter) {
    return NextResponse.json(
      { error: 'quarter parameter is required' },
      { status: 400 }
    );
  }

  try {
    const story = await getQbrStory({ companyId, quarter });

    // Return null if no story exists (client will show generate prompt)
    return NextResponse.json(story);
  } catch (error) {
    console.error('[QBR Story API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve QBR story' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Generate Story
// ============================================================================

interface PostBody {
  quarter: string;
  userId?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { quarter, userId } = body;

  if (!quarter) {
    return NextResponse.json(
      { error: 'quarter is required' },
      { status: 400 }
    );
  }

  try {
    console.log(`[QBR Story API] Generating story for ${companyId}/${quarter}`);

    const story = await generateQbrStory({
      companyId,
      quarter,
      userId: userId ?? 'system',
    });

    return NextResponse.json(story);
  } catch (error) {
    console.error('[QBR Story API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to generate QBR story' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Regenerate Story
// ============================================================================

interface PatchBody {
  quarter: string;
  mode: RegenerationMode;
  domain?: QbrDomain | 'all';
  userId?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { quarter, mode, domain, userId } = body;

  if (!quarter) {
    return NextResponse.json(
      { error: 'quarter is required' },
      { status: 400 }
    );
  }

  if (!mode) {
    return NextResponse.json(
      { error: 'mode is required (full_rewrite, clarity, shorter, longer)' },
      { status: 400 }
    );
  }

  const validModes: RegenerationMode[] = ['full_rewrite', 'clarity', 'shorter', 'longer'];
  if (!validModes.includes(mode)) {
    return NextResponse.json(
      { error: `Invalid mode. Must be one of: ${validModes.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    console.log(`[QBR Story API] Regenerating story for ${companyId}/${quarter} (mode: ${mode}, domain: ${domain || 'all'})`);

    const story = await regenerateQbrStory({
      companyId,
      quarter,
      mode,
      domain,
      userId: userId ?? 'system',
    });

    return NextResponse.json(story);
  } catch (error) {
    console.error('[QBR Story API] PATCH error:', error);

    // Check for specific error types
    if (error instanceof Error && error.message.includes('No QBR story exists')) {
      return NextResponse.json(
        { error: 'No QBR story exists yet. Generate one first.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to regenerate QBR story' },
      { status: 500 }
    );
  }
}
