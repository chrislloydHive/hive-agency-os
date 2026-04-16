// app/api/os/activity/log/route.ts
// Client-driven Activity Log endpoint.
//
// The UI calls this to record events the server isn't directly handling —
// e.g., "Chris clicked through to a triage item", "task edit panel opened",
// "inbox card dismissed without action". These signals feed the prioritization
// brain later (what's Chris actually engaging with?).
//
// POST /api/os/activity/log
// Body:
//   {
//     actorType?: 'user' | 'system' | 'ai',   // defaults to 'user'
//     actor?: string,                          // e.g. 'Chris' — defaults to 'user'
//     action: string,                          // e.g. 'task.opened-in-ui'
//     entityType?: string,                     // 'task' | 'email' | 'meeting' | ...
//     entityId?: string,
//     entityTitle?: string,
//     summary?: string,                        // optional; we synthesize if absent
//     metadata?: Record<string, unknown>,
//     source?: string,                         // 'components/TaskEditPanel', etc.
//   }
//
// Returns: { logged: true } (204-ish semantics — we never want this endpoint to
// break the UI). Validation failures return { logged: false, reason } with 400.

import { NextRequest, NextResponse } from 'next/server';
import {
  logEvent,
  type ActivityActorType,
  type ActivityEntityType,
  type ActivityEvent,
} from '@/lib/airtable/activityLog';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const VALID_ACTOR_TYPES: ActivityActorType[] = ['user', 'system', 'ai'];
const VALID_ENTITY_TYPES: ActivityEntityType[] = [
  'task',
  'email',
  'meeting',
  'doc',
  'triage-run',
  'other',
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ logged: false, reason: 'invalid body' }, { status: 400 });
    }

    const actorType: ActivityActorType = VALID_ACTOR_TYPES.includes(body.actorType)
      ? body.actorType
      : 'user';
    const actor = typeof body.actor === 'string' && body.actor.trim() ? body.actor.trim() : 'user';
    const action = typeof body.action === 'string' ? body.action.trim() : '';
    if (!action) {
      return NextResponse.json(
        { logged: false, reason: 'action is required' },
        { status: 400 },
      );
    }

    const entityType: ActivityEntityType = VALID_ENTITY_TYPES.includes(body.entityType)
      ? body.entityType
      : 'other';

    // Synthesize a summary if the client didn't provide one.
    const fallbackTitle = typeof body.entityTitle === 'string' ? body.entityTitle : '';
    const fallbackId = typeof body.entityId === 'string' ? body.entityId : '';
    const synthesized =
      `${action}` +
      (fallbackTitle ? ` — "${fallbackTitle}"` : fallbackId ? ` — ${fallbackId}` : '');
    const summary =
      typeof body.summary === 'string' && body.summary.trim() ? body.summary.trim() : synthesized;

    const event: ActivityEvent = {
      actorType,
      actor,
      action,
      entityType,
      entityId: typeof body.entityId === 'string' ? body.entityId : undefined,
      entityTitle: typeof body.entityTitle === 'string' ? body.entityTitle : undefined,
      summary,
      metadata:
        body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
          ? (body.metadata as Record<string, unknown>)
          : undefined,
      source: typeof body.source === 'string' ? body.source : 'api/os/activity/log',
    };

    // Await so the client knows the write was attempted; logEvent itself never throws.
    await logEvent(event);

    return NextResponse.json({ logged: true });
  } catch (err) {
    // Final safety net — this endpoint should never break the UI.
    console.warn('[api/os/activity/log] unexpected failure:', err);
    return NextResponse.json({ logged: false, reason: 'internal error' }, { status: 500 });
  }
}
