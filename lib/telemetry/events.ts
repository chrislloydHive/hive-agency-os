// lib/telemetry/events.ts
// Hive OS internal event logging for analytics and debugging

import { getBase } from '@/lib/airtable';

/**
 * Event types tracked in Hive OS
 */
export type HiveEventType =
  // Strategic Setup Mode events
  | 'ssm_started'
  | 'ssm_step_completed'
  | 'ssm_completed'
  // QBR events
  | 'qbr_started'
  | 'qbr_section_generated'
  | 'qbr_completed'
  | 'qbr_exported'
  // Persona events
  | 'persona_generated'
  | 'persona_saved'
  | 'persona_deleted'
  // Media events
  | 'media_scenario_created'
  | 'media_scenario_selected'
  | 'media_plan_activated'
  // Work item events
  | 'work_item_created'
  | 'work_item_updated'
  | 'work_item_completed'
  // Diagnostic events
  | 'diagnostic_started'
  | 'diagnostic_completed'
  | 'diagnostic_failed'
  // Error events
  | 'ga4_error'
  | 'ai_error'
  | 'context_graph_error'
  // Page views / navigation
  | 'page_view'
  | 'feature_used'
  // Flow system events (see lib/observability/flowEvents.ts)
  | 'flow_blocked_missing_domains'
  | 'flow_proceeded_missing_domains'
  | 'write_blocked_authority'
  | 'write_blocked_human_confirmed'
  | 'write_forced_override'
  | 'lab_import_completed'
  | 'lab_import_failed'
  // Pipeline events
  | 'lead_converted_to_opportunity'
  | 'company_created_from_lead'
  | 'opportunity_created_from_company';

/**
 * Hive event structure
 */
export interface HiveEvent {
  type: HiveEventType;
  companyId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Event storage record (for Airtable)
 */
interface EventRecord {
  id: string;
  type: HiveEventType;
  companyId: string | null;
  userId: string | null;
  metadata: string | null;
  createdAt: string;
}

// Table name for events (create this in Airtable)
const EVENTS_TABLE = 'Hive Events';

// In-memory buffer for batching events
let eventBuffer: HiveEvent[] = [];
let flushTimeout: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds
const MAX_BUFFER_SIZE = 20; // Flush after 20 events

/**
 * Log a Hive event
 *
 * Events are buffered and flushed periodically to reduce API calls.
 * For critical events, use logHiveEventImmediate.
 *
 * @param event - The event to log (without createdAt)
 */
export async function logHiveEvent(
  event: Omit<HiveEvent, 'createdAt'>
): Promise<void> {
  const fullEvent: HiveEvent = {
    ...event,
    createdAt: new Date().toISOString(),
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[HiveEvent]', fullEvent.type, {
      companyId: fullEvent.companyId,
      userId: fullEvent.userId,
      metadata: fullEvent.metadata,
    });
  }

  // Add to buffer
  eventBuffer.push(fullEvent);

  // Flush if buffer is full
  if (eventBuffer.length >= MAX_BUFFER_SIZE) {
    await flushEventBuffer();
  } else if (!flushTimeout) {
    // Schedule flush if not already scheduled
    flushTimeout = setTimeout(() => {
      flushEventBuffer().catch(console.error);
    }, FLUSH_INTERVAL_MS);
  }
}

/**
 * Log a Hive event immediately (bypass buffer)
 *
 * Use for critical events that must be recorded immediately.
 *
 * @param event - The event to log (without createdAt)
 */
export async function logHiveEventImmediate(
  event: Omit<HiveEvent, 'createdAt'>
): Promise<void> {
  const fullEvent: HiveEvent = {
    ...event,
    createdAt: new Date().toISOString(),
  };

  // Log to console
  console.log('[HiveEvent:Immediate]', fullEvent.type, {
    companyId: fullEvent.companyId,
    userId: fullEvent.userId,
    metadata: fullEvent.metadata,
  });

  try {
    await writeEventToStorage(fullEvent);
  } catch (error) {
    console.error('[HiveEvent] Failed to write event:', error);
  }
}

/**
 * Flush the event buffer to storage
 */
async function flushEventBuffer(): Promise<void> {
  // Clear the timeout
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  // Get events to flush
  const eventsToFlush = [...eventBuffer];
  eventBuffer = [];

  if (eventsToFlush.length === 0) {
    return;
  }

  console.log(`[HiveEvent] Flushing ${eventsToFlush.length} events`);

  try {
    await writeEventsToStorage(eventsToFlush);
  } catch (error) {
    console.error('[HiveEvent] Failed to flush events:', error);
    // Re-add failed events to buffer (limited to prevent infinite growth)
    if (eventBuffer.length < MAX_BUFFER_SIZE * 2) {
      eventBuffer.unshift(...eventsToFlush);
    }
  }
}

/**
 * Write a single event to storage
 */
async function writeEventToStorage(event: HiveEvent): Promise<void> {
  try {
    const base = getBase();
    await base(EVENTS_TABLE).create([
      {
        fields: {
          Type: event.type,
          'Company ID': event.companyId || '',
          'User ID': event.userId || '',
          Metadata: event.metadata ? JSON.stringify(event.metadata) : '',
          'Created At': event.createdAt,
        },
      },
    ] as any);
  } catch (error: unknown) {
    // Handle table not existing gracefully
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('404')) {
      console.warn(`[HiveEvent] Events table "${EVENTS_TABLE}" not found in Airtable. Events will only be logged to console.`);
      return;
    }
    throw error;
  }
}

/**
 * Write multiple events to storage (batch)
 */
async function writeEventsToStorage(events: HiveEvent[]): Promise<void> {
  try {
    const base = getBase();

    // Airtable batch create limit is 10 records per request
    const batches: HiveEvent[][] = [];
    for (let i = 0; i < events.length; i += 10) {
      batches.push(events.slice(i, i + 10));
    }

    for (const batch of batches) {
      const records = batch.map((event) => ({
        fields: {
          Type: event.type,
          'Company ID': event.companyId || '',
          'User ID': event.userId || '',
          Metadata: event.metadata ? JSON.stringify(event.metadata) : '',
          'Created At': event.createdAt,
        },
      }));

      await base(EVENTS_TABLE).create(records as any);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('404')) {
      console.warn(`[HiveEvent] Events table "${EVENTS_TABLE}" not found. Events logged to console only.`);
      return;
    }
    throw error;
  }
}

// ============================================================================
// Convenience Functions for Common Events
// ============================================================================

/**
 * Log SSM started event
 */
export function logSsmStarted(companyId: string, userId?: string) {
  return logHiveEvent({
    type: 'ssm_started',
    companyId,
    userId,
  });
}

/**
 * Log SSM step completed event
 */
export function logSsmStepCompleted(
  companyId: string,
  stepNumber: number,
  stepName: string,
  userId?: string
) {
  return logHiveEvent({
    type: 'ssm_step_completed',
    companyId,
    userId,
    metadata: { stepNumber, stepName },
  });
}

/**
 * Log SSM completed event
 */
export function logSsmCompleted(companyId: string, userId?: string) {
  return logHiveEventImmediate({
    type: 'ssm_completed',
    companyId,
    userId,
  });
}

/**
 * Log QBR started event
 */
export function logQbrStarted(companyId: string, quarter: string, userId?: string) {
  return logHiveEvent({
    type: 'qbr_started',
    companyId,
    userId,
    metadata: { quarter },
  });
}

/**
 * Log QBR section generated event
 */
export function logQbrSectionGenerated(
  companyId: string,
  section: string,
  userId?: string
) {
  return logHiveEvent({
    type: 'qbr_section_generated',
    companyId,
    userId,
    metadata: { section },
  });
}

/**
 * Log QBR completed event
 */
export function logQbrCompleted(companyId: string, quarter: string, userId?: string) {
  return logHiveEventImmediate({
    type: 'qbr_completed',
    companyId,
    userId,
    metadata: { quarter },
  });
}

/**
 * Log persona generated event
 */
export function logPersonaGenerated(companyId: string, personaCount: number, userId?: string) {
  return logHiveEvent({
    type: 'persona_generated',
    companyId,
    userId,
    metadata: { personaCount },
  });
}

/**
 * Log persona saved event
 */
export function logPersonaSaved(companyId: string, personaName: string, userId?: string) {
  return logHiveEvent({
    type: 'persona_saved',
    companyId,
    userId,
    metadata: { personaName },
  });
}

/**
 * Log work item created event
 */
export function logWorkItemCreated(
  companyId: string,
  workItemId: string,
  source: string,
  userId?: string
) {
  return logHiveEvent({
    type: 'work_item_created',
    companyId,
    userId,
    metadata: { workItemId, source },
  });
}

/**
 * Log work item completed event
 */
export function logWorkItemCompleted(
  companyId: string,
  workItemId: string,
  userId?: string
) {
  return logHiveEvent({
    type: 'work_item_completed',
    companyId,
    userId,
    metadata: { workItemId },
  });
}

/**
 * Log GA4 error event
 */
export function logGa4Error(
  companyId: string,
  errorMessage: string,
  context?: string
) {
  return logHiveEventImmediate({
    type: 'ga4_error',
    companyId,
    metadata: { errorMessage, context },
  });
}

/**
 * Log AI error event
 */
export function logAiError(
  companyId: string | undefined,
  errorMessage: string,
  context: string
) {
  return logHiveEventImmediate({
    type: 'ai_error',
    companyId,
    metadata: { errorMessage, context },
  });
}

/**
 * Log diagnostic completed event
 */
export function logDiagnosticCompleted(
  companyId: string,
  toolId: string,
  score: number | null,
  userId?: string
) {
  return logHiveEvent({
    type: 'diagnostic_completed',
    companyId,
    userId,
    metadata: { toolId, score },
  });
}

/**
 * Log diagnostic failed event
 */
export function logDiagnosticFailed(
  companyId: string,
  toolId: string,
  errorMessage: string,
  userId?: string
) {
  return logHiveEventImmediate({
    type: 'diagnostic_failed',
    companyId,
    userId,
    metadata: { toolId, errorMessage },
  });
}

// ============================================================================
// Pipeline Events
// ============================================================================

/**
 * Log lead converted to opportunity event
 */
export function logLeadConvertedToOpportunity(
  leadId: string,
  opportunityId: string,
  companyId?: string,
  companyName?: string
) {
  return logHiveEventImmediate({
    type: 'lead_converted_to_opportunity',
    companyId,
    metadata: { leadId, opportunityId, companyName },
  });
}

/**
 * Log company created from lead event
 */
export function logCompanyCreatedFromLead(
  companyId: string,
  leadId: string,
  companyName: string,
  domain?: string
) {
  return logHiveEventImmediate({
    type: 'company_created_from_lead',
    companyId,
    metadata: { leadId, companyName, domain },
  });
}

/**
 * Log opportunity created from company event
 */
export function logOpportunityCreatedFromCompany(
  opportunityId: string,
  companyId: string,
  companyName?: string,
  deliverableName?: string
) {
  return logHiveEventImmediate({
    type: 'opportunity_created_from_company',
    companyId,
    metadata: { opportunityId, companyName, deliverableName },
  });
}
