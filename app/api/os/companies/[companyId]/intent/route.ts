// app/api/os/companies/[companyId]/intent/route.ts
// Company Intent API
//
// Lightweight storage for company primary intent
// Used by the decision entry point on the Overview page

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// ============================================================================
// Types
// ============================================================================

export type PrimaryIntent =
  | 'website_underperforming'
  | 'leads_are_low'
  | 'not_sure'
  | 'planning_roadmap';

interface CompanyIntent {
  intent: PrimaryIntent;
  setAt: string;
  setBy?: string;
}

// ============================================================================
// Storage Helpers
// ============================================================================

const DATA_DIR = process.env.CONTEXT_GRAPH_DATA_DIR || './data/context-graphs';

function getIntentFilePath(companyId: string): string {
  return path.join(DATA_DIR, companyId, 'intent.json');
}

async function ensureDirectoryExists(companyId: string): Promise<void> {
  const dir = path.join(DATA_DIR, companyId);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

async function loadIntent(companyId: string): Promise<CompanyIntent | null> {
  try {
    const filePath = getIntentFilePath(companyId);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as CompanyIntent;
  } catch {
    return null;
  }
}

async function saveIntent(companyId: string, data: CompanyIntent): Promise<void> {
  await ensureDirectoryExists(companyId);
  const filePath = getIntentFilePath(companyId);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ============================================================================
// Validation
// ============================================================================

const VALID_INTENTS: PrimaryIntent[] = [
  'website_underperforming',
  'leads_are_low',
  'not_sure',
  'planning_roadmap',
];

function isValidIntent(value: unknown): value is PrimaryIntent {
  return typeof value === 'string' && VALID_INTENTS.includes(value as PrimaryIntent);
}

// ============================================================================
// GET - Retrieve current intent
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const intent = await loadIntent(companyId);

    return NextResponse.json({
      companyId,
      intent: intent?.intent || null,
      setAt: intent?.setAt || null,
    });
  } catch (error) {
    console.error('[Intent API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load intent' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Set/update intent
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { intent } = body;

    if (!isValidIntent(intent)) {
      return NextResponse.json(
        { error: `Invalid intent. Must be one of: ${VALID_INTENTS.join(', ')}` },
        { status: 400 }
      );
    }

    const data: CompanyIntent = {
      intent,
      setAt: new Date().toISOString(),
    };

    await saveIntent(companyId, data);

    return NextResponse.json({
      success: true,
      companyId,
      intent: data.intent,
      setAt: data.setAt,
    });
  } catch (error) {
    console.error('[Intent API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save intent' },
      { status: 500 }
    );
  }
}
