// app/api/os/jobs/[jobId]/provision-drive/route.ts
// Provision Google Drive folder structure for a job
//
// POST - Trigger Drive provisioning
//
// This uses ADC-based Drive client (no JSON keys required).
// Idempotent: if job already has driveJobFolderId and status=ready, returns success

import { NextRequest, NextResponse } from 'next/server';
import { getJobById } from '@/lib/airtable/jobs';
import { provisionDriveForExistingJob } from '@/lib/os/jobs/provisionJob';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for Drive operations

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

// ============================================================================
// POST /api/os/jobs/[jobId]/provision-drive - Provision Drive folders
// ============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params;

  try {
    console.log(`[Jobs Provision API] Starting provisioning for job: ${jobId}`);

    // 1. Load job for idempotency check
    const job = await getJobById(jobId);
    if (!job) {
      return NextResponse.json(
        { ok: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // 2. Idempotency check: if already provisioned, return success
    if (job.driveJobFolderId && job.status === 'ready') {
      console.log(`[Jobs Provision API] Job ${job.jobCode} already provisioned`);
      return NextResponse.json({
        ok: true,
        job,
        folderId: job.driveJobFolderId,
        folderUrl: job.driveJobFolderUrl,
        message: 'Already provisioned',
      });
    }

    // 3. Provision Drive folders using ADC-based service
    const result = await provisionDriveForExistingJob(jobId);

    if (!result.ok) {
      console.error(`[Jobs Provision API] Provisioning failed:`, result.error);
      return NextResponse.json(
        {
          ok: false,
          error: result.error?.message || 'Failed to provision Drive folders',
          code: result.error?.code,
          howToFix: result.error?.howToFix,
        },
        { status: 500 }
      );
    }

    console.log(`[Jobs Provision API] Successfully provisioned ${job.jobCode}`);

    return NextResponse.json({
      ok: true,
      job: result.job,
      folderId: result.job?.driveJobFolderId,
      folderUrl: result.job?.driveJobFolderUrl,
      subfolders: result.subfolders ? Object.keys(result.subfolders) : [],
    });
  } catch (error: any) {
    console.error(`[Jobs Provision API] Unexpected error for job ${jobId}:`, error);
    return NextResponse.json(
      { ok: false, error: 'Failed to provision Drive folders' },
      { status: 500 }
    );
  }
}
