// app/api/hive-brain/playbook/route.ts
// Hive Brain Playbook API
//
// Endpoints:
// GET /api/hive-brain/playbook - List verticals or get playbook
// POST /api/hive-brain/playbook - Generate a playbook

import { NextRequest, NextResponse } from 'next/server';
import {
  generatePlaybook,
  listVerticals,
  detectVertical,
  getSeasonalInsights,
  getPlaybookRecommendationsForCompany,
} from '@/lib/hiveBrain';
import { getAllCompanies } from '@/lib/airtable/companies';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const verticalId = searchParams.get('verticalId');
    const industry = searchParams.get('industry');
    const companyName = searchParams.get('companyName');

    switch (action) {
      case 'list': {
        const verticals = listVerticals();
        return NextResponse.json({ verticals });
      }

      case 'detect': {
        const detected = detectVertical(industry, companyName ?? undefined);
        return NextResponse.json({ verticalId: detected });
      }

      case 'seasonal': {
        if (!verticalId) {
          return NextResponse.json(
            { error: 'verticalId required for seasonal insights' },
            { status: 400 }
          );
        }
        const insights = getSeasonalInsights(verticalId);
        return NextResponse.json(insights);
      }

      default: {
        // List all verticals by default
        const verticals = listVerticals();
        return NextResponse.json({ verticals });
      }
    }
  } catch (error) {
    console.error('Hive Brain playbook GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get playbook data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, verticalId, companyMetrics } = body as {
      action?: 'generate' | 'recommendations';
      verticalId: string;
      companyMetrics?: {
        cpa?: number;
        roas?: number;
        topChannel?: string;
      };
    };

    if (!verticalId) {
      return NextResponse.json(
        { error: 'verticalId is required' },
        { status: 400 }
      );
    }

    // Get all company IDs for playbook generation
    const companies = await getAllCompanies();
    const companyIds = companies.map((c) => c.id);

    switch (action) {
      case 'recommendations': {
        if (!companyMetrics) {
          return NextResponse.json(
            { error: 'companyMetrics required for recommendations' },
            { status: 400 }
          );
        }

        // Generate playbook first, then get recommendations
        const playbook = await generatePlaybook(verticalId, companyIds);
        const recommendations = getPlaybookRecommendationsForCompany(
          playbook,
          companyMetrics
        );

        return NextResponse.json({
          playbook,
          recommendations,
        });
      }

      case 'generate':
      default: {
        const playbook = await generatePlaybook(verticalId, companyIds);
        return NextResponse.json(playbook);
      }
    }
  } catch (error) {
    console.error('Hive Brain playbook POST error:', error);
    return NextResponse.json(
      { error: 'Failed to generate playbook' },
      { status: 500 }
    );
  }
}

