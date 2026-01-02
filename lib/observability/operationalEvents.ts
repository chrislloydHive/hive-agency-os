// lib/observability/operationalEvents.ts
// Operational event logging for Program Template System
//
// Provides structured event logging for:
// - Bundle instantiation
// - Work creation (from deliverables or manual)
// - Scope violations
//
// Events are stored in Airtable for audit trail and analytics.
// Each event has a debugId for end-to-end tracing.

import { logHiveEvent, logHiveEventImmediate } from '@/lib/telemetry/events';
import {
  OPERATIONAL_EVENT_TYPES,
  generateDebugId,
  type OperationalEvent,
  type OperationalEventType,
  type BundleInstantiationEventPayload,
  type WorkCreationEventPayload,
  type ScopeViolationEventPayload,
  type OperationalEventQuery,
  type ScopeViolationAggregate,
} from '@/lib/types/operationalEvent';
import type { ScopeViolationCode } from '@/lib/os/programs/scopeGuard';

// ============================================================================
// Event Logging Functions
// ============================================================================

/**
 * Log a bundle instantiation event
 * Returns the debugId for UI display
 */
export async function logBundleInstantiation(
  companyId: string,
  payload: BundleInstantiationEventPayload,
  actorId?: string
): Promise<string> {
  const debugId = generateDebugId();

  await logHiveEventImmediate({
    type: 'bundle_instantiated' as any,
    companyId,
    userId: actorId,
    metadata: {
      debugId,
      eventType: OPERATIONAL_EVENT_TYPES.BUNDLE_INSTANTIATED,
      ...payload,
    },
  });

  return debugId;
}

/**
 * Log a work creation event
 * Returns the debugId for UI display
 */
export async function logWorkCreation(
  companyId: string,
  payload: WorkCreationEventPayload,
  actorId?: string
): Promise<string> {
  const debugId = generateDebugId();

  await logHiveEventImmediate({
    type: 'work_item_created' as any,
    companyId,
    userId: actorId,
    metadata: {
      debugId,
      eventType: OPERATIONAL_EVENT_TYPES.WORK_CREATED,
      ...payload,
    },
  });

  return debugId;
}

/**
 * Log a work creation skip (existing work found)
 */
export async function logWorkCreationSkipped(
  companyId: string,
  payload: WorkCreationEventPayload,
  actorId?: string
): Promise<string> {
  const debugId = generateDebugId();

  logHiveEvent({
    type: 'work_item_created' as any,
    companyId,
    userId: actorId,
    metadata: {
      debugId,
      eventType: OPERATIONAL_EVENT_TYPES.WORK_CREATION_SKIPPED,
      ...payload,
    },
  });

  return debugId;
}

/**
 * Log a scope violation event
 * Returns the debugId for UI display
 */
export async function logScopeViolation(
  companyId: string,
  payload: ScopeViolationEventPayload,
  actorId?: string
): Promise<string> {
  const debugId = generateDebugId();

  await logHiveEventImmediate({
    type: 'scope_violation' as any,
    companyId,
    userId: actorId,
    metadata: {
      debugId,
      eventType: OPERATIONAL_EVENT_TYPES.SCOPE_VIOLATION,
      ...payload,
    },
  });

  return debugId;
}

// ============================================================================
// Event Querying (for panels and analytics)
// ============================================================================

/**
 * Query operational events from Airtable
 *
 * Note: This reads from the Hive Events table.
 * For production scale, consider moving to a dedicated analytics service.
 */
export async function queryOperationalEvents(
  query: OperationalEventQuery
): Promise<OperationalEvent[]> {
  try {
    const { getBase } = await import('@/lib/airtable');
    const base = getBase();

    // Build filter formula
    const conditions: string[] = [`{Company ID} = '${query.companyId}'`];

    if (query.types && query.types.length > 0) {
      const typeConditions = query.types.map(
        (t) => `FIND('${t}', {Metadata}) > 0`
      );
      conditions.push(`OR(${typeConditions.join(', ')})`);
    }

    if (query.since) {
      conditions.push(`{Created At} >= '${query.since}'`);
    }

    if (query.until) {
      conditions.push(`{Created At} <= '${query.until}'`);
    }

    const filterFormula =
      conditions.length > 1
        ? `AND(${conditions.join(', ')})`
        : conditions[0];

    const records = await base('Hive Events')
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'Created At', direction: 'desc' }],
        maxRecords: query.limit || 100,
      })
      .all();

    return records.map((record): OperationalEvent => {
      const metadata = parseJson(record.get('Metadata') as string);
      const debugId = (metadata?.debugId as string) || '';
      const eventType = (metadata?.eventType as OperationalEventType) ||
        (record.get('Type') as OperationalEventType);
      return {
        id: record.id,
        debugId,
        type: eventType,
        companyId: (record.get('Company ID') as string) || '',
        actorId: record.get('User ID') as string | undefined,
        timestamp: (record.get('Created At') as string) || '',
        payload: metadata || {},
      };
    });
  } catch (error) {
    console.error('[operationalEvents] Failed to query events:', error);
    return [];
  }
}

/**
 * Get recent bundle instantiation events for a company
 */
export async function getRecentBundleInstantiations(
  companyId: string,
  limit: number = 10
): Promise<OperationalEvent<BundleInstantiationEventPayload>[]> {
  const events = await queryOperationalEvents({
    companyId,
    types: [OPERATIONAL_EVENT_TYPES.BUNDLE_INSTANTIATED],
    limit,
  });

  return events as OperationalEvent<BundleInstantiationEventPayload>[];
}

/**
 * Get scope violation aggregates for Drift Detector
 */
export async function getScopeViolationAggregates(
  companyId: string,
  sinceDaysAgo: number = 30
): Promise<ScopeViolationAggregate[]> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDaysAgo);

  const events = await queryOperationalEvents({
    companyId,
    types: [OPERATIONAL_EVENT_TYPES.SCOPE_VIOLATION],
    since: since.toISOString(),
    limit: 500,
  });

  // Aggregate by code
  const aggregateMap = new Map<ScopeViolationCode, ScopeViolationAggregate>();

  for (const event of events) {
    const payload = event.payload as ScopeViolationEventPayload;
    const code = payload.code;

    if (!aggregateMap.has(code)) {
      aggregateMap.set(code, {
        code,
        count: 0,
        programIds: [],
        domains: [],
        topRecommendedActions: [],
      });
    }

    const agg = aggregateMap.get(code)!;
    agg.count++;

    if (!agg.programIds.includes(payload.programId)) {
      agg.programIds.push(payload.programId);
    }

    if (payload.domain && !agg.domains.includes(payload.domain)) {
      agg.domains.push(payload.domain);
    }

    // Count recommended actions
    for (const action of payload.recommendedActions || []) {
      const existing = agg.topRecommendedActions.find((a) => a.id === action.id);
      if (existing) {
        existing.count++;
      } else {
        agg.topRecommendedActions.push({ id: action.id, count: 1 });
      }
    }
  }

  // Sort actions by count
  for (const agg of aggregateMap.values()) {
    agg.topRecommendedActions.sort((a, b) => b.count - a.count);
    agg.topRecommendedActions = agg.topRecommendedActions.slice(0, 5);
  }

  return Array.from(aggregateMap.values()).sort((a, b) => b.count - a.count);
}

/**
 * Get work creation events for a program
 */
export async function getWorkCreationEventsForProgram(
  companyId: string,
  programId: string,
  limit: number = 50
): Promise<OperationalEvent<WorkCreationEventPayload>[]> {
  const events = await queryOperationalEvents({
    companyId,
    types: [OPERATIONAL_EVENT_TYPES.WORK_CREATED, OPERATIONAL_EVENT_TYPES.WORK_CREATION_SKIPPED],
    limit,
  });

  // Filter by programId
  return events.filter(
    (e) => (e.payload as WorkCreationEventPayload).programId === programId
  ) as OperationalEvent<WorkCreationEventPayload>[];
}

// ============================================================================
// Convenience Functions for UI
// ============================================================================

/**
 * Format event for display
 */
export function formatEventForDisplay(event: OperationalEvent): {
  title: string;
  subtitle: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error' | 'info';
} {
  const timestamp = new Date(event.timestamp).toLocaleString();

  switch (event.type) {
    case OPERATIONAL_EVENT_TYPES.BUNDLE_INSTANTIATED: {
      const payload = event.payload as BundleInstantiationEventPayload;
      return {
        title: `Bundle: ${payload.presetName}`,
        subtitle: `${payload.summary.created} programs created, ${payload.createdDeliverables} deliverables`,
        timestamp,
        status: payload.summary.failed > 0 ? 'warning' : 'success',
      };
    }

    case OPERATIONAL_EVENT_TYPES.WORK_CREATED: {
      const payload = event.payload as WorkCreationEventPayload;
      return {
        title: `Work Created: ${payload.title}`,
        subtitle: payload.programTitle
          ? `From ${payload.programTitle}`
          : 'Ad-hoc work',
        timestamp,
        status: 'success',
      };
    }

    case OPERATIONAL_EVENT_TYPES.WORK_CREATION_SKIPPED: {
      const payload = event.payload as WorkCreationEventPayload;
      return {
        title: `Work Exists: ${payload.title}`,
        subtitle: 'Work item already exists',
        timestamp,
        status: 'info',
      };
    }

    case OPERATIONAL_EVENT_TYPES.SCOPE_VIOLATION: {
      const payload = event.payload as ScopeViolationEventPayload;
      return {
        title: `Scope Violation: ${payload.code}`,
        subtitle: payload.blockedAction.description,
        timestamp,
        status: 'warning',
      };
    }

    default:
      return {
        title: 'Unknown Event',
        subtitle: event.type,
        timestamp,
        status: 'info',
      };
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

function parseJson(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// Re-export for convenience
export { OPERATIONAL_EVENT_TYPES, generateDebugId };
