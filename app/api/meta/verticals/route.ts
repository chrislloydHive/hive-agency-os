// app/api/meta/verticals/route.ts
// API route for vertical model operations

import { NextRequest, NextResponse } from 'next/server';
import {
  buildVerticalModel,
  listVerticalModels,
  getVerticalRecommendations,
  compareToVertical,
} from '@/lib/meta';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const vertical = searchParams.get('vertical');
    const companyId = searchParams.get('companyId');
    const action = searchParams.get('action');

    // Get recommendations for a company
    if (companyId && action === 'recommendations') {
      const recommendations = await getVerticalRecommendations(companyId);

      if (!recommendations) {
        return NextResponse.json(
          { success: false, error: 'Could not generate recommendations for company' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        companyId,
        recommendations,
      });
    }

    // Compare company to vertical
    if (companyId && action === 'compare') {
      const comparison = await compareToVertical(companyId);

      if (!comparison) {
        return NextResponse.json(
          { success: false, error: 'Could not compare company to vertical' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        companyId,
        comparison,
      });
    }

    // Get specific vertical model
    if (vertical) {
      const model = await buildVerticalModel(vertical);

      if (!model) {
        return NextResponse.json(
          { success: false, error: `Insufficient data for vertical: ${vertical}` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        model,
      });
    }

    // List all vertical models
    const models = await listVerticalModels();

    return NextResponse.json({
      success: true,
      models,
      count: models.length,
    });
  } catch (error) {
    console.error('Vertical model error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Vertical model operation failed',
      },
      { status: 500 }
    );
  }
}
