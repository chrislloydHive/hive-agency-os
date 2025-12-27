// app/api/settings/firm-brain/references/route.ts
// References API - List and Create

import { NextResponse } from 'next/server';
import { getReferences, createReference } from '@/lib/airtable/firmBrain';
import { ReferenceInputSchema } from '@/lib/types/firmBrain';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const references = await getReferences();
    return NextResponse.json({ references });
  } catch (error) {
    console.error('[firm-brain/references] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch references' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ReferenceInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const reference = await createReference(parsed.data);
    return NextResponse.json({ reference }, { status: 201 });
  } catch (error) {
    console.error('[firm-brain/references] POST error:', error);
    return NextResponse.json({ error: 'Failed to create reference' }, { status: 500 });
  }
}
