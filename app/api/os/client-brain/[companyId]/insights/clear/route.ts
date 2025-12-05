// app/api/os/client-brain/[companyId]/insights/clear/route.ts
// Clear all insights for a company (useful for re-extraction)

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyInsights, deleteInsight } from '@/lib/airtable/clientBrain';

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// DELETE - Clear all insights for a company
// ============================================================================

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;

    // Validate company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Optional: only clear insights matching a filter
    const { searchParams } = new URL(request.url);
    const onlyGeneric = searchParams.get('onlyGeneric') === 'true';

    console.log('[InsightsClear] Clearing insights for company:', companyId, { onlyGeneric });

    // Get all insights for the company
    const insights = await getCompanyInsights(companyId, { limit: 500 });

    if (insights.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No insights to clear',
        deleted: 0,
      });
    }

    // Filter to only generic titles if requested
    const toDelete = onlyGeneric
      ? insights.filter((i) => isGenericTitle(i.title))
      : insights;

    console.log('[InsightsClear] Found', toDelete.length, 'insights to delete');

    // Delete each insight
    let deleted = 0;
    for (const insight of toDelete) {
      try {
        await deleteInsight(insight.id);
        deleted++;
      } catch (error) {
        console.error('[InsightsClear] Failed to delete insight:', insight.id, error);
      }
    }

    console.log('[InsightsClear] Deleted', deleted, 'insights');

    return NextResponse.json({
      success: true,
      message: `Cleared ${deleted} insights`,
      deleted,
      total: insights.length,
    });
  } catch (error) {
    console.error('[InsightsClear] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear insights' },
      { status: 500 }
    );
  }
}

/**
 * Check if a title looks like a generic report summary
 */
function isGenericTitle(title: string): boolean {
  const genericPatterns = [
    /diagnostic summary/i,
    /lab report/i,
    /lab summary/i,
    /analysis overview/i,
    /report overview/i,
    /^\s*demand\s+lab\s*$/i,
    /^\s*website\s+lab\s*$/i,
    /^\s*brand\s+lab\s*$/i,
    /^\s*seo\s+lab\s*$/i,
    /^\s*content\s+lab\s*$/i,
    /^\s*ops\s+lab\s*$/i,
    /^\s*media\s+lab\s*$/i,
    /^\s*creative\s+lab\s*$/i,
    /^\s*audience\s+lab\s*$/i,
  ];

  return genericPatterns.some((pattern) => pattern.test(title));
}
