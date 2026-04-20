// lib/os/autoTriageTask.ts
// Auto-creates an Airtable task from a Gmail message.
// Used by the Command Center sync to ensure every triage-worthy email
// immediately shows up in My Day as an Inbox task.

import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { createTask, type TaskPriority, type CreateTaskInput } from '@/lib/airtable/tasks';
import { getIdentityPreamble, getProjectCategoriesList } from '@/lib/personalContext';

const anthropic = new Anthropic();

// ── Helpers ──────────────────────────────────────────────────────────────

function defaultDueForPriority(priority: TaskPriority): string {
  const offsetDays = priority === 'P0' ? 0 : priority === 'P1' ? 3 : priority === 'P2' ? 7 : 14;
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

type MsgPart = { mimeType?: string | null; body?: { data?: string | null } | null; parts?: MsgPart[] | null };
function extractPlainText(payload: MsgPart | undefined | null): string {
  let body = '';
  const walk = (part: MsgPart | undefined | null) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body += Buffer.from(part.body.data, 'base64').toString('utf-8') + '\n';
    }
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  return body;
}

// ── Core: parse one Gmail message into a task and write to Airtable ─────

export interface AutoTriageInput {
  messageId: string;
  threadId: string;
}

export interface AutoTriageResult {
  ok: boolean;
  taskId?: string;
  task?: string;
  error?: string;
}

/**
 * Fetch a Gmail message, AI-parse it into a task, and create it in Airtable.
 * Returns the created task's Airtable record ID.
 */
export async function autoCreateTaskFromEmail(
  accessToken: string,
  input: AutoTriageInput,
): Promise<AutoTriageResult> {
  const { messageId, threadId } = input;

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    const msg = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    const headers = msg.data.payload?.headers || [];
    const get = (n: string) => headers.find(h => h.name?.toLowerCase() === n.toLowerCase())?.value || '';
    const subject = get('Subject');
    const from = get('From');
    const dateHdr = get('Date');
    const body = extractPlainText(msg.data.payload as MsgPart) || msg.data.snippet || '';
    const trimmed = body.slice(0, 6000);
    const gmailLink = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
    const today = new Date().toISOString().slice(0, 10);

    const [identityPreamble, projectCategories] = await Promise.all([
      getIdentityPreamble(),
      getProjectCategoriesList(),
    ]);

    const ai = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: `${identityPreamble}

You are a task parser. An email has arrived that the user needs to act on. Parse it into a structured task.

Today's date: ${today}

Email:
From: ${from}
Subject: ${subject}
Date: ${dateHdr}

"""
${trimmed}
"""

Return a JSON object with these fields (ONLY JSON, no markdown):
- "task": concise task title (max 60 chars) describing what needs to be DONE (not the email subject). Examples: "Review A/R Aging, follow up on Acme past due", "Upload tax docs to TaxCaddy", "Reply to Jim re: geofence data".
- "from": the sender's name (or first name if available).
- "project": best-guess project category. Choose the closest match from: ${projectCategories}. Empty string if unsure.
- "nextAction": 1-2 sentences describing the specific next step.
- "priority": "P0" (blocking today), "P1" (this week, important), "P2" (normal), "P3" (backlog).
- "due": ALWAYS write a due date in YYYY-MM-DD format. Never leave blank. Rules in order:
  1. If the email mentions an explicit deadline (a date, "by Friday", "EOD", "next week", etc.), use it — resolve relative phrases against today's date above.
  2. Otherwise fall back to a priority-based default: P0 → today (${today}), P1 → +3 days from today, P2 → +7 days from today, P3 → +14 days from today.
  3. If the email signals urgency (client awaiting reply, approval/answer needed, invoice past due, time-sensitive contract) but gives no explicit date, pick the tighter of rule 2 or +2 days from today.
- "status": "Inbox"
- "notes": any key facts or context worth preserving (numbers, names, amounts). Keep under 300 chars. Empty string if nothing notable.`,
        },
      ],
    });

    const content = ai.content[0];
    if (content.type !== 'text') throw new Error('Unexpected AI response type');
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(jsonText);

    const priority: TaskPriority = (['P0', 'P1', 'P2', 'P3'].includes(parsed.priority) ? parsed.priority : 'P2') as TaskPriority;
    const isValidDate = typeof parsed.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.due);
    const due = isValidDate ? parsed.due : defaultDueForPriority(priority);

    const taskInput: CreateTaskInput = {
      task: parsed.task || subject || '(untitled)',
      from: parsed.from || from,
      project: parsed.project || '',
      nextAction: parsed.nextAction || '',
      priority,
      due,
      status: 'Inbox',
      view: 'inbox',
      threadUrl: gmailLink,
      notes: parsed.notes || '',
    };

    const created = await createTask(taskInput);
    return { ok: true, taskId: created.id, task: created.task };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[autoTriage] Failed for message ${messageId}:`, msg);
    return { ok: false, error: msg };
  }
}

/**
 * Batch auto-create tasks for multiple triage items.
 * Processes up to `concurrency` items in parallel. Returns results for each.
 */
export async function batchAutoCreateTasks(
  accessToken: string,
  items: AutoTriageInput[],
  concurrency = 3,
): Promise<AutoTriageResult[]> {
  const results: AutoTriageResult[] = [];

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(item => autoCreateTaskFromEmail(accessToken, item)),
    );
    results.push(...batchResults);
  }

  return results;
}
