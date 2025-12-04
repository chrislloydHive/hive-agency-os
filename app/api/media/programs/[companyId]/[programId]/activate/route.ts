// app/api/media/programs/[companyId]/[programId]/activate/route.ts
// API route to activate a media program

import { NextResponse } from 'next/server';
import { setMediaProgramStatus } from '@/lib/media/programs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyId: string; programId: string }> }
) {
  try {
    const { companyId, programId } = await params;

    const program = await setMediaProgramStatus(companyId, programId, 'active');

    return NextResponse.json({
      success: true,
      program,
    });
  } catch (error) {
    console.error('[API] Failed to activate program:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to activate program',
      },
      { status: 500 }
    );
  }
}
