// app/api/os/jobs/route.ts
// Jobs API: List and Create jobs
//
// GET  - List all jobs (optionally filtered by companyId)
// POST - Create a new job with auto-generated job number

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { createJob, listJobs } from '@/lib/airtable/jobs';
import { reserveNextJobNumber } from '@/lib/airtable/counters';
import { CreateJobInputSchema, isValidClientCode } from '@/lib/types/job';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ============================================================================
// GET /api/os/jobs - List jobs
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    console.log('[Jobs API] Listing jobs', { companyId, limit });

    const jobs = await listJobs({ companyId, limit });

    // Enrich with company names
    const companyIds = [...new Set(jobs.map((j) => j.companyId).filter(Boolean))];
    const companyMap = new Map<string, string>();

    await Promise.all(
      companyIds.map(async (id) => {
        const company = await getCompanyById(id);
        if (company) {
          companyMap.set(id, company.name);
        }
      })
    );

    const enrichedJobs = jobs.map((job) => ({
      ...job,
      companyName: companyMap.get(job.companyId) || undefined,
    }));

    return NextResponse.json({
      ok: true,
      jobs: enrichedJobs,
      total: enrichedJobs.length,
    });
  } catch (error) {
    console.error('[Jobs API] Error listing jobs:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to list jobs' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/os/jobs - Create a new job
// ============================================================================

export async function POST(request: NextRequest) {
  try {
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

    const parsed = CreateJobInputSchema.safeParse(body);
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

    const input = parsed.data;
    console.log('[Jobs API] Creating job:', { companyId: input.companyId, projectName: input.projectName });

    // Load company to get clientCode
    const company = await getCompanyById(input.companyId);
    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Validate client code
    if (!company.clientCode) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Company does not have a client code configured. Please set up the 3-letter client code in Airtable first.',
        },
        { status: 400 }
      );
    }

    if (!isValidClientCode(company.clientCode)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid client code "${company.clientCode}". Must be exactly 3 uppercase letters.`,
        },
        { status: 400 }
      );
    }

    // Validate Drive folder is configured
    if (!company.driveClientFolderId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Company does not have a Google Drive folder configured. Please set up the Drive Client Folder ID in Airtable first.',
        },
        { status: 400 }
      );
    }

    // Reserve next job number (atomic)
    const jobNumber = await reserveNextJobNumber();
    if (jobNumber === null) {
      return NextResponse.json(
        { ok: false, error: 'Failed to reserve job number. Please try again.' },
        { status: 500 }
      );
    }

    console.log('[Jobs API] Reserved job number:', jobNumber);

    // Create the job record
    const job = await createJob({
      jobNumber,
      clientCode: company.clientCode,
      projectName: input.projectName,
      companyId: input.companyId,
      projectType: input.projectType,
      startDate: input.startDate,
      dueDate: input.dueDate,
      assignment: input.assignment,
      owner: input.owner,
    });

    if (!job) {
      return NextResponse.json(
        { ok: false, error: 'Failed to create job record' },
        { status: 500 }
      );
    }

    console.log('[Jobs API] Created job:', { jobCode: job.jobCode, jobId: job.id });

    // Return success with job data
    // Note: Provisioning is triggered separately via /api/os/jobs/[jobId]/provision-drive
    return NextResponse.json({
      ok: true,
      job: {
        ...job,
        companyName: company.name,
      },
    });
  } catch (error) {
    console.error('[Jobs API] Error creating job:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to create job' },
      { status: 500 }
    );
  }
}
