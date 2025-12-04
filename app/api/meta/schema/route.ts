// app/api/meta/schema/route.ts
// API route for schema evolution operations

import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeSchemaUsage,
  generateEvolutionProposals,
  createMigrationPlan,
  applyProposal,
  validateProposal,
  storeSchemaMemory,
} from '@/lib/meta';
import type { SchemaEvolutionProposal } from '@/lib/meta/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'analyze';
    const maxProposals = parseInt(searchParams.get('maxProposals') || '10', 10);

    if (action === 'analyze') {
      const usage = await analyzeSchemaUsage();

      return NextResponse.json({
        success: true,
        usage: {
          fieldCount: usage.fieldStats.length,
          unusedFieldCount: usage.unusedFields.length,
          namingIssueCount: usage.inconsistentNaming.length,
          missingPatternCount: usage.missingFieldPatterns.length,
        },
        unusedFields: usage.unusedFields,
        inconsistentNaming: usage.inconsistentNaming,
        missingPatterns: usage.missingFieldPatterns,
      });
    }

    if (action === 'proposals') {
      const proposals = await generateEvolutionProposals({
        maxProposals,
        includeDeprecations: true,
        includeAdditions: true,
        includeRenames: true,
      });

      return NextResponse.json({
        success: true,
        proposals,
        count: proposals.length,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Schema analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Schema analysis failed',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, proposal } = body;

    if (!proposal) {
      return NextResponse.json(
        { success: false, error: 'Proposal required' },
        { status: 400 }
      );
    }

    const typedProposal = proposal as SchemaEvolutionProposal;

    if (action === 'validate') {
      const validation = validateProposal(typedProposal);

      return NextResponse.json({
        success: true,
        validation,
      });
    }

    if (action === 'plan') {
      const plan = createMigrationPlan(typedProposal);

      return NextResponse.json({
        success: true,
        proposal: typedProposal,
        plan,
      });
    }

    if (action === 'apply') {
      // First validate
      const validation = validateProposal(typedProposal);
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: 'Proposal validation failed',
            errors: validation.errors,
          },
          { status: 400 }
        );
      }

      const result = await applyProposal(typedProposal);

      if (result.success) {
        // Store in memory
        await storeSchemaMemory(typedProposal);
      }

      return NextResponse.json({
        success: result.success,
        error: result.error,
      });
    }

    if (action === 'store') {
      const memory = await storeSchemaMemory(typedProposal);

      return NextResponse.json({
        success: true,
        memory,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Schema operation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Operation failed',
      },
      { status: 500 }
    );
  }
}
