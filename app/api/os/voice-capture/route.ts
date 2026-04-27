// POST /api/os/voice-capture
// Dictated transcript → Claude-structured fields → createTask.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { createTask } from '@/lib/airtable/tasks';
import {
  VOICE_CAPTURE_LA_TZ,
  buildVoiceCaptureUserContent,
  coerceVoiceCaptureDue,
} from '@/lib/os/voiceCaptureTaskParse';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MODEL = 'claude-haiku-4-5';
/** Hard cap on the Claude round-trip so the serverless function cannot hang indefinitely. */
const ANTHROPIC_CALL_MS = 30_000;

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
- The user message begins with today's date in ${VOICE_CAPTURE_LA_TZ} — anchor ALL relative dates to that calendar date (not UTC).
- If no date or deadline is mentioned anywhere in the transcript, set due to null. Do not guess.
- Output due as YYYY-MM-DD with leading zeros, or null.

Map natural language to YYYY-MM-DD using the provided "today":
- "today" → today
- "tomorrow" → today + 1 day
- "tonight", "this evening" → today
- "Monday" / "Tuesday" / … / "Sunday" with no "this"/"next" → the next occurrence of that weekday strictly AFTER today (never today; if today is already that weekday, use that weekday 7 days later)
- "next Monday" / … / "next Sunday" → first compute the date for bare "[Weekday]" as above, then add 7 calendar days (the following week's same weekday)
- "this Monday" / … / "this Sunday" → that weekday within the current Sunday–Saturday week that contains today; if that calendar date is before today in ${VOICE_CAPTURE_LA_TZ}, use the same weekday in the following week (+7 days)
- "this weekend" → the upcoming Saturday (from today)
- "next week" → today + 7 days
- "in N days" / "N days from now" (N a positive integer) → today + N days
- "in a week" → today + 7 days
- "in two weeks" → today + 14 days
- "May 3rd", "May 3", "5/3" (month/day) → that month and day in the current calendar year; if that date is already before today in ${VOICE_CAPTURE_LA_TZ}, use next year instead
- "end of the month" → last calendar day of the current month in ${VOICE_CAPTURE_LA_TZ}
- "end of the week" → the upcoming Sunday (from today) in ${VOICE_CAPTURE_LA_TZ}

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
