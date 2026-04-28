// Pure helpers for My Day task row: type + primary action. Shared by TasksClient
// and unit tests.

export type MyDayTaskRowType =
  | 'email'
  | 'email-draft'
  | 'doc'
  | 'sheet'
  | 'meeting'
  | 'generic';

export type MyDayTaskSource =
  | 'manual'
  | 'commitment'
  | 'meeting-follow-up'
  | 'email-triage'
  | 'website-submission'
  | 'voice-capture'
  | null
  | undefined;

/** Subset of client task state needed for type + CTA. */
export type MyDayTaskRow = {
  draftUrl: string | null;
  threadUrl: string | null;
  calendarEventUrl: string | null;
  attachUrl: string | null;
  task: string;
  /** Set when the task came from auto-sync (e.g. meeting-follow-up). */
  source?: MyDayTaskSource;
};

function isGoogleCalendarEventUrl(u: string | null | undefined): boolean {
  if (!u) return false;
  return /google\.com\/calendar|calendar\.google\.com/.test(u);
}

export function inferTaskRowType(t: MyDayTaskRow): MyDayTaskRowType {
  if (t.draftUrl) return 'email-draft';
  if (t.source === 'meeting-follow-up') return 'meeting';
  if (t.calendarEventUrl) return 'meeting';
  if (t.threadUrl && isGoogleCalendarEventUrl(t.threadUrl)) return 'meeting';
  if (t.threadUrl) return 'email';
  if (t.attachUrl?.includes('docs.google.com/spreadsheets')) return 'sheet';
  if (t.attachUrl?.includes('docs.google.com')) return 'doc';
  if (t.attachUrl) return 'doc';
  const lower = t.task.toLowerCase();
  if (/\b(meet|prep|agenda|sync|standup|kickoff)\b/.test(lower)) return 'meeting';
  return 'generic';
}

export type MyDayTaskPrimaryAction = {
  label: string;
  variant: 'primary' | 'success' | 'neutral';
  href?: string;
  trailing?: boolean;
  /** When true, render a disabled (greyed) control — no link, no panel-open side effect. */
  disabled?: boolean;
};

export function taskRowPrimaryAction(t: MyDayTaskRow): MyDayTaskPrimaryAction {
  const type = inferTaskRowType(t);
  if (type === 'email-draft') {
    return { label: 'Review in Gmail', variant: 'success', href: t.draftUrl!, trailing: true };
  }
  if (type === 'email') {
    return { label: 'Draft reply', variant: 'primary' };
  }
  if (type === 'doc') {
    if (t.attachUrl) return { label: 'Open in Drive', variant: 'neutral', href: t.attachUrl, trailing: true };
    return { label: 'Start draft', variant: 'primary' };
  }
  if (type === 'sheet') {
    return { label: 'Open workbook', variant: 'neutral', href: t.attachUrl!, trailing: true };
  }
  if (type === 'meeting') {
    const href = t.calendarEventUrl || t.threadUrl || '';
    if (!href) {
      return { label: 'Open event', variant: 'neutral', trailing: true, disabled: true };
    }
    return { label: 'Open event', variant: 'neutral', href, trailing: true };
  }
  if (t.threadUrl) return { label: 'Open thread', variant: 'neutral', href: t.threadUrl, trailing: true };
  return { label: 'Open', variant: 'neutral' };
}
