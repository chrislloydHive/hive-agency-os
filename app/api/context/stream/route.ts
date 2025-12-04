// app/api/context/stream/route.ts
// Real-time SSE streaming endpoint for context graph updates
//
// Phase 4: Real-time graph streaming

import { NextRequest } from 'next/server';
import {
  createSubscription,
  removeSubscription,
  registerEventHandler,
  updateUserCursor,
  startUserEditing,
  stopUserEditing,
  touchSubscription,
  type SubscriptionOptions,
} from '@/lib/contextGraph/realtime';
import type { DomainName } from '@/lib/contextGraph/companyContextGraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/context/stream
 *
 * Server-Sent Events endpoint for real-time context graph updates.
 *
 * Query params:
 * - companyId: Required company ID to subscribe to
 * - userId: User ID for presence tracking
 * - userName: User display name
 * - domains: Comma-separated list of domains to subscribe to (optional)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const companyId = searchParams.get('companyId');
  const userId = searchParams.get('userId') || 'anonymous';
  const userName = searchParams.get('userName') || 'Anonymous User';
  const domainsParam = searchParams.get('domains');

  if (!companyId) {
    return new Response(JSON.stringify({ error: 'companyId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const domains = domainsParam?.split(',').filter(Boolean) as DomainName[] | undefined;

  // Create SSE response
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Create subscription (synchronous)
  const subscriptionOptions: SubscriptionOptions = {
    companyId,
    userId,
    userName,
    domains: domains || [],
  };

  const subscription = createSubscription(subscriptionOptions);
  const { subscriptionId } = subscription;

  // Register event handler for this subscription
  registerEventHandler(subscriptionId, (event) => {
    try {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      writer.write(encoder.encode(data)).catch(() => {
        // Client disconnected
        console.log('[stream] Client disconnected:', subscriptionId);
      });
    } catch (error) {
      console.error('[stream] Error writing event:', error);
    }
  });

  // Send initial connection event
  const connectionEvent = `data: ${JSON.stringify({
    type: 'connected',
    subscriptionId,
    companyId,
    timestamp: new Date().toISOString(),
  })}\n\n`;
  await writer.write(encoder.encode(connectionEvent));

  // Handle client disconnect
  request.signal.addEventListener('abort', () => {
    removeSubscription(subscriptionId);
    writer.close().catch(() => {});
  });

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * POST /api/context/stream
 *
 * Send a message from the client (cursor move, editing status, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscriptionId, type, data } = body;

    if (!subscriptionId || !type) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update activity timestamp
    touchSubscription(subscriptionId);

    // Handle different message types
    let result: unknown = { acknowledged: true };

    switch (type) {
      case 'cursor_move':
        if (data?.companyId && data?.userId) {
          updateUserCursor(data.companyId, data.userId, data.domain, data.path);
        }
        break;

      case 'start_editing':
        if (data?.companyId && data?.userId && data?.path) {
          startUserEditing(data.companyId, data.userId, data.path);
        }
        break;

      case 'stop_editing':
        if (data?.companyId && data?.userId && data?.path) {
          stopUserEditing(data.companyId, data.userId, data.path);
        }
        break;

      case 'ping':
        result = { pong: true, timestamp: new Date().toISOString() };
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown message type: ${type}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[stream] POST error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
