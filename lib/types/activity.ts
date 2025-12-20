/**
 * Activity types for client-side display
 *
 * Lightweight DTOs for the Opportunity workspace timeline.
 */

/**
 * Activity type (from Airtable)
 */
export type ActivityType = 'email' | 'call' | 'meeting' | 'note' | 'task' | 'other';

/**
 * Activity direction (inbound/outbound)
 */
export type ActivityDirection = 'inbound' | 'outbound';

/**
 * Lightweight Activity DTO for client display
 *
 * Stripped-down version of the full ActivityRecord for timeline display.
 */
export interface ActivityDTO {
  id: string;
  receivedAt: string; // ISO datetime (required for sorting)
  type: ActivityType;
  direction: ActivityDirection;
  subject: string | null;
  fromName: string | null;
  fromEmail: string | null;
  snippet: string | null;
  /** External URL to the activity (e.g., Notion link) */
  externalUrl: string | null;
  /** Gmail thread ID for constructing Gmail URL */
  threadId: string | null;
}

/**
 * Get Gmail URL from thread ID
 */
export function getGmailUrl(threadId: string | null): string | null {
  if (!threadId) return null;
  return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
}

/**
 * Get the best URL for opening an activity
 * Priority: externalUrl > gmailUrl
 */
export function getActivityOpenUrl(activity: ActivityDTO): string | null {
  if (activity.externalUrl) return activity.externalUrl;
  return getGmailUrl(activity.threadId);
}

/**
 * Get display label for activity type
 */
export function getActivityTypeLabel(type: ActivityType): string {
  const labels: Record<ActivityType, string> = {
    email: 'Email',
    call: 'Call',
    meeting: 'Meeting',
    note: 'Note',
    task: 'Task',
    other: 'Activity',
  };
  return labels[type] || 'Activity';
}

/**
 * Get color classes for activity direction
 */
export function getActivityDirectionColorClasses(direction: ActivityDirection): string {
  if (direction === 'inbound') {
    return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  }
  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
}
