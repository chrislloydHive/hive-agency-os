// TEMP DISABLED: depends on WIP lib/os/briefing/engine module
// app/api/os/briefing/route.ts

import { NextRequest, NextResponse } from 'next/server';

const NOT_IMPLEMENTED = {
  error: 'Not Implemented',
  message: 'This endpoint is temporarily disabled pending completion of lib/os/briefing modules',
};

export async function GET(_request: NextRequest) {
  return NextResponse.json(NOT_IMPLEMENTED, { status: 501 });
}

export async function POST(_request: NextRequest) {
  return NextResponse.json(NOT_IMPLEMENTED, { status: 501 });
}
