// app/api/hive-brain/simulate/route.ts
// Hive Brain Simulation API
//
// Endpoints:
// POST /api/hive-brain/simulate - Simulate a strategy change

import { NextRequest, NextResponse } from 'next/server';
import { simulateStrategy } from '@/lib/hiveBrain';
import type { SimulationInput } from '@/lib/hiveBrain';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getAllCompanies } from '@/lib/airtable/companies';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input } = body as { input: SimulationInput };

    if (!input) {
      return NextResponse.json(
        { error: 'Simulation input is required' },
        { status: 400 }
      );
    }

    // Validate input
    if (!input.target) {
      return NextResponse.json(
        { error: 'Simulation target is required' },
        { status: 400 }
      );
    }

    if (!input.changes || Object.keys(input.changes).length === 0) {
      return NextResponse.json(
        { error: 'At least one change is required for simulation' },
        { status: 400 }
      );
    }

    // Load company graphs for simulation
    const companies = await getAllCompanies();
    const companyGraphs = await Promise.all(
      companies.slice(0, 20).map(async (c) => {
        const graph = await loadContextGraph(c.id);
        return graph;
      })
    );
    const validGraphs = companyGraphs.filter((g): g is NonNullable<typeof g> => g !== null);

    // Run simulation
    const result = await simulateStrategy(input, validGraphs);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Hive Brain simulation error:', error);
    return NextResponse.json(
      { error: 'Failed to run simulation' },
      { status: 500 }
    );
  }
}
