// app/api/reminders/redirect/route.ts
// GET ?tasks=<URL-encoded JSON array>
// Returns a downloadable .ics file (iCalendar VTODO list) which Apple Reminders
// imports automatically on Mac and iPhone. Replaces the previous reminders://
// URL-scheme redirect that browsers were silently blocking.

interface TaskInput {
  title?: unknown;
  list?: unknown;
  priority?: unknown;
  due?: unknown;
  person?: unknown;
  context?: unknown;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get("tasks");

    if (!raw) {
      return new Response("Missing tasks param", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    }

    let tasks: TaskInput[];
    try {
      try {
        tasks = JSON.parse(raw) as TaskInput[];
      } catch {
        tasks = JSON.parse(decodeURIComponent(raw)) as TaskInput[];
      }
      if (!Array.isArray(tasks)) throw new Error("not an array");
    } catch {
      return new Response("Invalid tasks payload", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const ics = buildIcs(tasks);
    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="tasks.ics"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[reminders/redirect] error:", msg);
    return new Response("Internal server error", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

/* ----------------------------- iCal builders ----------------------------- */

function buildIcs(tasks: TaskInput[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hive OS//Task Extractor//EN",
    "X-WR-CALNAME:Hive OS Tasks",
  ];

  const dtstamp = formatIcsDateTimeUtc(new Date());
  const stamp = Date.now();

  tasks.forEach((t, i) => {
    const title = typeof t.title === "string" ? t.title.trim() : "";
    if (!title) return;

    lines.push("BEGIN:VTODO");
    lines.push(`UID:task-${stamp}-${i}@hiveagencyos.com`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`CREATED:${dtstamp}`);
    lines.push(`LAST-MODIFIED:${dtstamp}`);
    lines.push(`SUMMARY:${escapeIcsText(title)}`);
    lines.push("STATUS:NEEDS-ACTION");
    lines.push(`PRIORITY:${mapPriority(t.priority)}`);
    lines.push(`CATEGORIES:${mapCategory(t.list)}`);

    if (typeof t.context === "string" && t.context.trim()) {
      lines.push(`DESCRIPTION:${escapeIcsText(t.context.trim())}`);
    }

    if (typeof t.due === "string" && t.due.trim()) {
      const due = parseDueToIcsDate(t.due.trim());
      if (due) lines.push(`DUE;VALUE=DATE:${due}`);
    }

    lines.push("END:VTODO");
  });

  lines.push("END:VCALENDAR");

  // RFC 5545 requires CRLF line endings.
  return lines.join("\r\n") + "\r\n";
}

/** Escape commas, semicolons, backslashes, and newlines per RFC 5545. */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** iCal standard: 1=high, 5=medium, 9=low. */
function mapPriority(p: unknown): number {
  if (typeof p !== "string") return 5;
  switch (p.toLowerCase()) {
    case "high":
      return 1;
    case "low":
      return 9;
    case "medium":
    default:
      return 5;
  }
}

function mapCategory(list: unknown): string {
  if (typeof list !== "string") return "Inbox";
  switch (list) {
    case "my_tasks":
      return "Personal";
    case "waiting_on":
      return "Waiting On";
    case "someday":
      return "Someday";
    case "inbox":
    default:
      return "Inbox";
  }
}

/** Format a Date as YYYYMMDDTHHMMSSZ (UTC). */
function formatIcsDateTimeUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/**
 * Best-effort parse of a natural-language due string to YYYYMMDD.
 * Returns null on failure (caller skips the DUE field rather than erroring).
 */
function parseDueToIcsDate(s: string): string | null {
  // Try Date.parse on the raw string and a few common cleanups.
  const candidates = [
    s,
    s.replace(/\s+at\s+.*/i, ""), // "May 12 at midnight" → "May 12"
    s.replace(/\s+by\s+.*/i, ""),
  ];
  for (const c of candidates) {
    const ms = Date.parse(c);
    if (!Number.isNaN(ms)) {
      const d = new Date(ms);
      const pad = (n: number) => String(n).padStart(2, "0");
      return (
        d.getFullYear().toString() +
        pad(d.getMonth() + 1) +
        pad(d.getDate())
      );
    }
  }
  return null;
}
