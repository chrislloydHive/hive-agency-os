// TEMP DISABLED: depends on WIP lib/os/automation modules
// app/api/os/companies/[companyId]/automation/route.ts

import { NextRequest, NextResponse } from 'next/server';

const NOT_IMPLEMENTED = {
  error: 'Not Implemented',
  message: 'This endpoint is temporarily disabled pending completion of lib/os/automation modules',
};

export async function GET(
  _request: NextRequest,
  _context: { params: Promise<{ companyId: string }> }
) {
  return NextResponse.json(NOT_IMPLEMENTED, { status: 501 });
}

export async function POST(
  _request: NextRequest,
  _context: { params: Promise<{ companyId: string }> }
) {
  return NextResponse.json(NOT_IMPLEMENTED, { status: 501 });
}
