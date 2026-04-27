// POST /api/os/voice-capture
// Dictated transcript → Claude-structured fields → createTask.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { createTask } from '@/lib/airtable/tasks';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MODEL = 'claude-haiku-4-5';
/** Hard cap on the Claude round-trip so the serverless function cannot hang indefinitely. */
const ANTHROPIC_CALL_MS = 30_000;

const LA_TZ = 'America/Los_Angeles';

/** Wall-clock calendar date + weekday name in Los Angeles (for model anchoring). */
function laDateContext(ref = new Date()): { ymd: string; weekday: string } {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: LA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ref);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: LA_TZ,
    weekday: 'long',
  }).format(ref);
  return { ymd, weekday };
}

/** Prepended to the transcript so relative dates anchor to LA local "today". Exported for tests. */
export function buildVoiceCaptureUserContent(transcript: string, ref = new Date()): string {
  const { ymd, weekday } = laDateContext(ref);
  return `Today is ${ymd} (${LA_TZ}, ${weekday}).\n\n${transcript.trim()}`;
}

function buildSystemPrompt(): string {
  return `You turn a voice memo into a structured task. Output:
{
  "task":        "<short imperative title, ≤80 chars>",
  "nextAction":  "<one concrete next step, optional>",
  "priority":    "P1" | "P2" | "P3" | null,
  "due":         "YYYY-MM-DD" | null,
  "project":     "<best-guess project name from context>" | null,
  "reasoning":   "<one sentence on the parse>"
}

Date extraction rules (due field):
- The user message begins with today's date in ${LA_TZ} — anchor ALL relative dates to that calendar date (not UTC).
- If no date or deadline is mentioned anywhere in the transcript, set due to null. Do not guess.
- Output due as YYYY-MM-DD with leading zeros, or null.

Map natural language to YYYY-MM-DD using the provided "today":
- "today" → today
- "tomorrow" → today + 1 day
- "tonight", "this evening" → today
- "Monday" / "Tuesday" / … / "Sunday" with no "this"/"next" → the next occurrence of that weekday strictly AFTER today (never today; if today is already that weekday, use that weekday 7 days later)
- "next Monday" / … / "next Sunday" → first compute the date for bare "[Weekday]" as above, then add 7 calendar days (the following week's same weekday)
- "this Monday" / … / "this Sunday" → that weekday within the current Sunday–Saturday week that contains today; if that calendar date is before today in ${LA_TZ}, use the same weekday in the following week (+7 days)
- "this weekend" → the upcoming Saturday (from today)
- "next week" → today + 7 days
- "in N days" / "N days from now" (N a positive integer) → today + N days
- "in a week" → today + 7 days
- "in two weeks" → today + 14 days
- "May 3rd", "May 3", "5/3" (month/day) → that month and day in the current calendar year; if that date is already before today in ${LA_TZ}, use next year instead
- "end of the month" → last calendar day of the current month in ${LA_TZ}
- "end of the week" → the upcoming Sunday (from today) in ${LA_TZ}

Other rules: Priority defaults to P2 unless the transcript signals urgency ("urgent", "asap", "P1") or low importance ("sometime", "someday", "low priority"). Project is best-guess — if the transcript mentions Car Toys, Atlas, etc., set it; if unclear, null.

Output strict JSON only, no prose outside the JSON.`;
}

const voiceParseSchema = z
  .object({
    task: z.string().min(1).max(80),
    nextAction: z.union([z.string(), z.null()]).optional(),
    priority: z.union([z.enum(['P1', 'P2', 'P3']), z.null()]),
    due: z.union([z.string(), z.null()]),
    project: z.union([z.string(), z.null()]),
    reasoning: z.string().min(1),
  })
  .strict();

function isValidYmd(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/** If the model returned a non-ISO or impossible date, treat as missing. Exported for tests. */
export function coerceVoiceCaptureDue(due: string | null): string | null {
  if (due === null) return null;
  const s = due.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !isValidYmd(s)) return null;
  return s;
}

function extractJsonObject(raw: string): string {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model output');
  }
  return stripped.slice(start, end + 1);
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const transcript =
      typeof body === 'object' && body !== null && 'transcript' in body
        ? (body as { transcript: unknown }).transcript
        : undefined;
    if (typeof transcript !== 'string' || !transcript.trim()) {
      return NextResponse.json({ error: 'transcript is required (non-empty string)' }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey, maxRetries: 0 });
    const ai = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: 400,
        system: buildSystemPrompt(),
        messages: [{ role: 'user', content: buildVoiceCaptureUserContent(transcript) }],
      },
      {
        timeout: ANTHROPIC_CALL_MS,
        signal: AbortSignal.timeout(ANTHROPIC_CALL_MS),
      },
    );

    const block = ai.content[0];
    if (!block || block.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected Claude response shape (no text block)' }, { status: 502 });
    }

    const rawText = block.text.trim();
    let jsonStr: string;
    try {
      jsonStr = extractJsonObject(rawText);
    } catch {
      return NextResponse.json({ error: rawText }, { status: 502 });
    }

    let parsed: z.infer<typeof voiceParseSchema>;
    try {
      parsed = voiceParseSchema.parse(JSON.parse(jsonStr) as unknown);
    } catch {
      return NextResponse.json({ error: rawText }, { status: 502 });
    }

    const due = coerceVoiceCaptureDue(parsed.due);

    const nextAction =
      typeof parsed.nextAction === 'string' ? parsed.nextAction.trim() : parsed.nextAction === null ? '' : '';

    const project =
      parsed.project === null || (typeof parsed.project === 'string' && parsed.project.trim() === '')
        ? undefined
        : parsed.project.trim();

    const sourceRef = new Date().toISOString();

    const priority = parsed.priority === null ? 'P2' : parsed.priority;

    const task = await createTask({
      task: parsed.task.trim(),
      nextAction: nextAction || '',
      priority,
      due: due === null ? undefined : due,
      project,
      from: 'Chris Lloyd (voice)',
      assignedTo: 'Chris',
      source: 'voice-capture',
      sourceRef,
      autoCreated: true,
      status: 'Inbox',
      view: 'inbox',
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    console.error('[voice-capture] error:', err);
    const msg = err instanceof Error ? err.message : 'Voice capture failed';
    if (
      msg.toLowerCase().includes('timeout') ||
      msg.includes('ETIMEDOUT') ||
      (err instanceof Error && err.name === 'AbortError')
    ) {
      return NextResponse.json({ error: msg }, { status: 504 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
