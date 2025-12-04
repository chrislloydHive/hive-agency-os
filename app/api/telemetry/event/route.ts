// app/api/telemetry/event/route.ts
// Simple endpoint for client-side telemetry events

import { NextRequest, NextResponse } from 'next/server';
import { logHiveEvent, HiveEventType } from '@/lib/telemetry/events';

interface EventBody {
  type: HiveEventType;
  companyId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body: EventBody = await request.json();

    if (!body.type) {
      return NextResponse.json(
        { error: 'Event type is required' },
        { status: 400 }
      );
    }

    // Fire and forget - log the event asynchronously
    logHiveEvent({
      type: body.type,
      companyId: body.companyId,
      userId: body.userId,
      metadata: body.metadata,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Don't fail requests due to telemetry errors
    console.error('[Telemetry API] Error logging event:', error);
    return NextResponse.json({ success: true });
  }
}
