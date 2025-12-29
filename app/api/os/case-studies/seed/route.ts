// app/api/os/case-studies/seed/route.ts
// Case Studies Seed API - Idempotent bulk import

import { NextResponse } from 'next/server';
import { upsertCaseStudy } from '@/lib/airtable/firmBrain';
import { SEED_CASE_STUDIES } from '@/lib/os/caseStudies/seed';

export const dynamic = 'force-dynamic';

/**
 * POST /api/os/case-studies/seed
 * Seed/upsert all case studies from seed data
 *
 * This is idempotent - running twice will update existing records
 * rather than creating duplicates (matches by title + client)
 */
export async function POST() {
  try {
    const results: Array<{
      title: string;
      client: string;
      status: 'created' | 'updated' | 'error';
      id?: string;
      error?: string;
    }> = [];

    for (const seedData of SEED_CASE_STUDIES) {
      try {
        const caseStudy = await upsertCaseStudy(seedData);
        results.push({
          title: seedData.title,
          client: seedData.client,
          status: 'created', // upsert returns same shape for create/update
          id: caseStudy.id,
        });
      } catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null
            ? JSON.stringify(error)
            : 'Unknown error';
        console.error(`[seed] Failed to upsert ${seedData.client}:`, error);
        results.push({
          title: seedData.title,
          client: seedData.client,
          status: 'error',
          error: errorMessage,
        });
      }
    }

    const successCount = results.filter(r => r.status !== 'error').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      status: 'ok',
      message: `Seeded ${successCount} case studies${errorCount > 0 ? `, ${errorCount} errors` : ''}`,
      data: {
        total: SEED_CASE_STUDIES.length,
        success: successCount,
        errors: errorCount,
        results,
      },
    });
  } catch (error) {
    console.error('[os/case-studies/seed] POST error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to seed case studies' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/os/case-studies/seed
 * Get info about seed data (without executing)
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    data: {
      count: SEED_CASE_STUDIES.length,
      caseStudies: SEED_CASE_STUDIES.map(cs => ({
        title: cs.title,
        client: cs.client,
        permissionLevel: cs.permissionLevel,
      })),
    },
    message: 'POST to this endpoint to seed case studies',
  });
}
