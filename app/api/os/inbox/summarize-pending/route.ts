import { NextResponse } from "next/server";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || "";
const AIRTABLE_OS_BASE_ID = process.env.AIRTABLE_OS_BASE_ID || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// Make model configurable so you never get blocked by "model not found"
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const INBOX_TABLE = "Inbox";

// Behavior knobs
const MAX_RECORDS = Number(process.env.INBOX_SUMMARY_MAX_RECORDS || "5"); // keep small by default
const SET_STATUS_TO = process.env.INBOX_SUMMARY_SET_STATUS || "Reviewed";
const SET_DISPOSITION_TO = process.env.INBOX_SUMMARY_SET_DISPOSITION || "Logged";

function asStr(v: any) {
  return v === undefined || v === null ? "" : String(v);
}
function truncate(s: string, n: number) {
  s = asStr(s);
  return s.length > n ? s.slice(0, n) + "…" : s;
}
function safeJson(obj: any) {
  try {
    return JSON.stringify(obj, (_k, val) =>
      typeof val === "string" && val.length > 800 ? val.slice() + "…" : val
    );
  } catch {
    return String(obj);
  }
}

async function airtableGetInboxCandidates(debugId: string) {
  const filterByFormula = encodeURIComponent(`{Disposition}="New"`);
  const url =
    `https://api.airtable.com/v0/${AIRTABLE_OS_BASE_ID}/${encodeURIComponent(INBOX_TABLE)}` +
    `?pageSize=${Math.min(MAX_RECORDS, 25)}` +
    `&maxRecords=${Math.min(MAX_RECORDS, 25)}` +
    `&filterByFormula=${filterByFormula}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    console.log("[INBOX_SUMMARY_AIRTABLE_FETCH_ERROR]", safeJson({ debugId, url, status: res.status, body: text }));
    throw new Error(json?.error?.message || text || `Airtable fetch error (${res.status})`);
  }

  return json?.records || [];
}

async function airtableUpdateInboxRecord(recordId: string, fields: Record<string, any>, debugId: string) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_OS_BASE_ID}/${encodeURIComponent(INBOX_TABLE)}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ records: [{ id: recordId, fields }] }),
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    console.log("[INBOX_SUMMARY_AIRTABLE_UPDATE_ERROR]", safeJson({ debugId, url, recordId, status: res.status, body: text }));
    throw new Error(json?.error?.message || text || `Airtable update error (${res.status})`);
  }

  return json;
}

async function openaiSummarizeEmail(input: {
  subject: string;
  fromEmail: string;
  fromName: string;
  receivedAt: string;
  gmailUrl: string;
  snippet: string;
  bodyText: string;
  debugId: string;
}) {
  const { subject, fromEmail, fromName, receivedAt, gmailUrl, snippet, bodyText, debugId } = input;

  const prompt = `
You are "Inbox GPT" for Hive OS. Summarize an inbound email for an operator.

Return a concise summary in this exact markdown structure:

## Summary
- <1-3 bullets>

## What they want
- <bullets>

## Suggested next step
- <1-3 bullets>

## Entities
- People: <comma-separated or "—">
- Company: <best guess or "—">

Email context:
- Subject: ${subject || "—"}
- From: ${fromName ? `${fromName} <${fromEmail}>` : fromEmail || "—"}
- Received At: ${receivedAt || "—"}
- Gmail URL: ${gmailUrl || "—"}

Snippet:
${truncate(snippet, 800) || "—"}

Body:
${truncate(bodyText, 8000) || "—"}
`.trim();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You write crisp, operator-friendly summaries. No fluff." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    console.log("[INBOX_SUMMARY_OPENAI_ERROR]", safeJson({ debugId, status: res.status, body: text }));
    const msg =
      json?.error?.message ||
      json?.error ||
      text ||
      `OpenAI error (${res.status})`;
    throw new Error(msg);
  }

  const content = json?.choices?.[0]?.message?.content;
  return asStr(content).trim();
}

export async function POST() {
  const debugId = `inboxsum_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    if (!AIRTABLE_API_KEY) throw new Error("Missing AIRTABLE_API_KEY");
    if (!AIRTABLE_OS_BASE_ID) throw new Error("Missing AIRTABLE_OS_BASE_ID");
    if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

    const records = await airtableGetInboxCandidates(debugId);

    console.log("[INBOX_SUMMARY] candidates", safeJson({ debugId, count: records.length }));

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];

    for (const r of records) {
      const id = r?.id;
      const f = r?.fields || {};

      // Pull from your known Inbox schema
      const subject = asStr(f["Subject"] || f["Title"] || "");
      const fromEmail = asStr(f["From Email"] || "");
      const fromName = asStr(f["From Name"] || "");
      const receivedAt = asStr(f["Received At"] || "");
      const gmailUrl = asStr(f["Gmail URL"] || "");
      const snippet = asStr(f["Snippet"] || "");
      const bodyText = asStr(f["Body Text"] || "");

      try {
        const summary = await openaiSummarizeEmail({
          subject,
          fromEmail,
          fromName,
          receivedAt,
          gmailUrl,
          snippet,
          bodyText,
          debugId,
        });

        // Write summary back to Description (safe text field)
        // Also flip Disposition + Status using existing options (per your screenshots)
        const updateFields: Record<string, any> = {
          "Description": summary,
          "Disposition": SET_DISPOSITION_TO, // "Logged"
          "Status": SET_STATUS_TO,           // "Reviewed"
        };

        await airtableUpdateInboxRecord(id, updateFields, debugId);
        results.push({ id, ok: true });

        console.log("[INBOX_SUMMARY] updated", safeJson({ debugId, id }));
      } catch (err: any) {
        results.push({ id, ok: false, error: err?.message || String(err) });
        console.log("[INBOX_SUMMARY] failed", safeJson({ debugId, id, error: err?.message || String(err) }));
      }
    }

    const okCount = results.filter((x) => x.ok).length;
    return NextResponse.json({
      ok: true,
      debugId,
      processed: records.length,
      succeeded: okCount,
      failed: results.length - okCount,
      results,
      model: OPENAI_MODEL,
    });
  } catch (e: any) {
    console.log("[INBOX_SUMMARY_FATAL]", safeJson({ debugId, error: e?.message || String(e) }));
    return NextResponse.json(
      { ok: false, debugId, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
