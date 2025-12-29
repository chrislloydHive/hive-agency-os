// app/api/dev/seed-context/route.ts
// Development endpoint to seed context graph data for testing
// Usage: POST /api/dev/seed-context?companyId=xxx

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import { createEmptyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { setDomainFields, createProvenance } from '@/lib/contextGraph/mutate';

// Sample Identity data for seeding
const SAMPLE_IDENTITY_DATA = {
  businessName: 'Car Toys',
  industry: 'Retail: Car Audio & Mobile Electronics',
  businessModel: 'retail' as const,
  revenueModel: 'Product sales + installation services',
  marketMaturity: 'plateau' as const,
  geographicFootprint: 'Regional (US Multi-State)',
  serviceArea: 'Washington and Colorado',
  competitiveLandscape: 'Competitive market with Best Buy, local specialists, and online retailers',
  marketPosition: 'Leading regional specialist with installation expertise',
  primaryCompetitors: ['Best Buy', 'Crutchfield', 'Local auto shops', 'Amazon'],
  seasonalityNotes: 'Peak demand during holiday season and tax refund period (Q1)',
  peakSeasons: ['November-December', 'January-February'],
  lowSeasons: ['August-September'],
  profitCenters: ['Car audio installations', 'Remote start systems', 'Dash cameras'],
  revenueStreams: ['Product sales', 'Installation services', 'Extended warranties'],
};

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');

  if (!companyId) {
    return NextResponse.json(
      { error: 'companyId query parameter is required' },
      { status: 400 }
    );
  }

  try {
    // Verify company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Load or create context graph
    let graph = await loadContextGraph(companyId);
    if (!graph) {
      graph = createEmptyContextGraph(companyId, company.name);
    }

    // Create provenance for seed data
    const provenance = createProvenance('airtable', {
      confidence: 0.8,
      notes: 'Seeded via development API',
      validForDays: 90,
    });

    // Seed Identity domain
    graph = setDomainFields(graph, 'identity', SAMPLE_IDENTITY_DATA, provenance);

    // Save the graph
    const saved = await saveContextGraph(graph);
    if (!saved) {
      return NextResponse.json(
        { error: 'Failed to save context graph' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Seeded Identity data for ${company.name}`,
      companyId,
      fieldsSeeded: Object.keys(SAMPLE_IDENTITY_DATA).length,
    });
  } catch (error) {
    console.error('[Seed Context] Error:', error);
    return NextResponse.json(
      { error: 'Failed to seed context graph' },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    usage: 'POST /api/dev/seed-context?companyId=xxx',
    description: 'Seeds sample Identity data into a company context graph',
    sampleData: SAMPLE_IDENTITY_DATA,
  });
}
