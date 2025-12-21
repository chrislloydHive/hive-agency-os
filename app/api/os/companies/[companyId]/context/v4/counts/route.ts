// app/api/os/companies/[companyId]/context/v4/counts/route.ts
// Context V4 API: Counts endpoint
//
// Returns lightweight counts for navigation badges.

import { NextRequest, NextResponse } from 'next/server';
import { loadContextFieldsV4 } from '@/lib/contextGraph/fieldStoreV4';
import { isContextV4Enabled } from '@/lib/types/contextField';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/context/v4/counts
 * Returns lightweight counts for navigation badges
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Check feature flag
  if (!isContextV4Enabled()) {
    return NextResponse.json({ proposed: 0, confirmed: 0 });
  }

  try {
    const { companyId } = await params;

    // Load V4 store
    const store = await loadContextFieldsV4(companyId);

    if (!store) {
      return NextResponse.json({ proposed: 0, confirmed: 0 });
    }

    // Count by status
    let proposed = 0;
    let confirmed = 0;

    for (const field of Object.values(store.fields)) {
      if (field.status === 'proposed') {
        proposed++;
      } else if (field.status === 'confirmed') {
        confirmed++;
      }
    }

    return NextResponse.json({ proposed, confirmed });
  } catch (error) {
    console.error('[ContextV4 Counts] Error:', error);
    return NextResponse.json({ proposed: 0, confirmed: 0 });
  }
}
