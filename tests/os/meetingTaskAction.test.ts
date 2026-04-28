import { describe, it, expect } from 'vitest';
import { inferTaskRowType, taskRowPrimaryAction, type MyDayTaskRow } from '@/lib/os/myDayTaskRowAction';

function baseRow(over: Partial<MyDayTaskRow> = {}): MyDayTaskRow {
  return {
    draftUrl: null,
    threadUrl: null,
    calendarEventUrl: null,
    attachUrl: null,
    task: 'Team sync',
    source: 'manual',
    ...over,
  };
}

describe('meeting task row: Calendar URL vs Gmail', () => {
  it('meeting with calendarEventUrl and no threadUrl: Open event links to Calendar', () => {
    const cal =
      'https://www.google.com/calendar/event?eid=VGhpc0lzQVRlc3RFaWROb3REZWxpbWl0ZXI';
    const t = baseRow({
      task: 'Follow up on Acme',
      source: 'meeting-follow-up',
      calendarEventUrl: cal,
      threadUrl: null,
    });
    expect(inferTaskRowType(t)).toBe('meeting');
    const act = taskRowPrimaryAction(t);
    expect(act.label).toBe('Open event');
    expect(act.href).toBe(cal);
    expect(act.disabled).toBeUndefined();
  });

  it('meeting with no calendar or thread: primary action is disabled (no # link)', () => {
    const t = baseRow({
      task: 'Prep standup',
      source: 'manual',
      calendarEventUrl: null,
      threadUrl: null,
    });
    expect(inferTaskRowType(t)).toBe('meeting');
    const act = taskRowPrimaryAction(t);
    expect(act.label).toBe('Open event');
    expect(act.href).toBeUndefined();
    expect(act.disabled).toBe(true);
  });

  it('prefers calendarEventUrl over threadUrl for href when both are set', () => {
    const cal = 'https://www.google.com/calendar/event?eid=YWJj';
    const mail = 'https://mail.google.com/mail/u/0/#inbox/19deadbeefcafe';
    const t = baseRow({
      task: 'Client review',
      source: 'meeting-follow-up',
      calendarEventUrl: cal,
      threadUrl: mail,
    });
    const act = taskRowPrimaryAction(t);
    expect(act.href).toBe(cal);
  });
});
