// app/api/os/people/route.ts
// Returns active team members from the PM OS People table.
// Used by the Command Center delegate picker.
//
// GET /api/os/people
// Returns: { people: [{ id, name, email, role }] }

import { NextResponse } from 'next/server';
import { getAllActivePeople } from '@/lib/airtable/people';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const people = await getAllActivePeople();
    return NextResponse.json({
      people: people.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email || '',
        role: p.role || '',
      })),
    });
  } catch (err) {
    console.error('[api/os/people] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch people' },
      { status: 500 },
    );
  }
}
