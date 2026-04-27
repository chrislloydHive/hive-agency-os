// POST /api/os/voice-capture
// Dictated transcript → Claude-structured fields → createTask.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { createTask } from '@/lib/airtable/tasks';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MODEL = 'claude-sonnet-4-6';

function laYmdToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function buildSystemPrompt(): string {
  const todayLa = laYmdToday();
  return `You turn a voice memo into a structured task. Output:
{
  "task":        "<short imperative title, ≤80 chars>",
  "nextAction":  "<one concrete next step, optional>",
  "priority":    "P1" | "P2" | "P3" | null,
  "due":         "YYYY-MM-DD" | null,
  "project":     "<best-guess project name from context>" | null,
  "reasoning":   "<one sentence on the parse>"
}
Rules: Priority defaults to P2 unless the transcript signals urgency ("urgent", "asap", "P1") or low importance ("sometime", "someday", "low priority"). Resolve relative dates ("tomorrow", "next Monday", "end of week") against today's local date in America/Los_Angeles (today is ${todayLa}). Project is best-guess — if the transcript mentions Car Toys, Atlas, etc., set it; if unclear, null.
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

    const anthropic = new Anthropic({ apiKey, timeout: 28_000 });
    const ai = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: transcript.trim() }],
    });

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

    let due: string | null = parsed.due;
    if (due !== null && !isValidYmd(due)) {
      return NextResponse.json({ error: rawText }, { status: 502 });
    }

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
    if (msg.toLowerCase().includes('timeout') || msg.includes('ETIMEDOUT')) {
      return NextResponse.json({ error: msg }, { status: 504 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
