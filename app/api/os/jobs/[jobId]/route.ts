// app/api/os/jobs/[jobId]/route.ts
// Single Job API: Get and Update a job
//
// GET   - Get job details
// PATCH - Update job fields

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getJobById, updateJob } from '@/lib/airtable/jobs';
import { UpdateJobInputSchema } from '@/lib/types/job';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

// ============================================================================
// GET /api/os/jobs/[jobId] - Get job details
// ============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { jobId } = await params;

    const job = await getJobById(jobId);
    if (!job) {
      return NextResponse.json(
        { ok: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Enrich with company name
    let companyName: string | undefined;
    if (job.companyId) {
      const company = await getCompanyById(job.companyId);
      companyName = company?.name;
    }

    return NextResponse.json({
      ok: true,
      job: {
        ...job,
        companyName,
      },
    });
  } catch (error) {
    console.error('[Jobs API] Error getting job:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to get job' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/os/jobs/[jobId] - Update job fields
// ============================================================================

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { jobId } = await params;

    // Parse and validate input
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid or empty request body' },
        { status: 400 }
      );
    }

    const parsed = UpdateJobInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Validation failed',
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    // Check job exists
    const existing = await getJobById(jobId);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Update job
    const updated = await updateJob(jobId, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'Failed to update job' },
        { status: 500 }
      );
    }

    // Enrich with company name
    let companyName: string | undefined;
    if (updated.companyId) {
      const company = await getCompanyById(updated.companyId);
      companyName = company?.name;
    }

    return NextResponse.json({
      ok: true,
      job: {
        ...updated,
        companyName,
      },
    });
  } catch (error) {
    console.error('[Jobs API] Error updating job:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to update job' },
      { status: 500 }
    );
  }
}
