// app/api/settings/firm-brain/references/[id]/route.ts
// Individual Reference API - Get, Update, Delete

import { NextResponse } from 'next/server';
import { getReferenceById, updateReference, deleteReference } from '@/lib/airtable/firmBrain';
import { ReferenceInputSchema } from '@/lib/types/firmBrain';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const reference = await getReferenceById(id);
    if (!reference) {
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
    }
    return NextResponse.json({ reference });
  } catch (error) {
    console.error('[firm-brain/references/[id]] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch reference' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = ReferenceInputSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const reference = await updateReference(id, parsed.data);
    if (!reference) {
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
    }
    return NextResponse.json({ reference });
  } catch (error) {
    console.error('[firm-brain/references/[id]] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update reference' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const deleted = await deleteReference(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete reference' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[firm-brain/references/[id]] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete reference' }, { status: 500 });
  }
}
