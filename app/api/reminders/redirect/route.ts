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
    const wantDownload = url.searchParams.get("download") === "1";

    if (!raw) {
      return new Response("Missing tasks param", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    }

    let tasks: TaskInput[];
    try {
      // searchParams.get already URL-decodes once. Some callers pass a
      // double-encoded value, so try a second decode if the first parse fails.
      let candidate = raw;
      try {
        tasks = JSON.parse(candidate) as TaskInput[];
      } catch {
        candidate = decodeURIComponent(raw);
        tasks = JSON.parse(candidate) as TaskInput[];
      }
      if (!Array.isArray(tasks)) {
        return new Response("tasks must be a JSON array", {
          status: 400,
          headers: { "Content-Type": "text/plain" },
        });
      }
    } catch {
      return new Response("Invalid tasks payload (not JSON)", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // ?download=1 → serve raw .ics as a forced download. This is what the
    // landing-page button hits; double-clicking the downloaded file on macOS
    // opens Reminders (because each component is a VTODO).
    if (wantDownload) {
      const ics = buildIcs(tasks);
      return new Response(ics, {
        status: 200,
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": 'attachment; filename="tasks.ics"',
          "Cache-Control": "no-store",
        },
      });
    }

    // Default: HTML landing page with a Download button + plain task list.
    // Browsers don't auto-route inline text/calendar to Reminders, so we need
    // an explicit user action.
    const html = renderLandingHtml(tasks, url);
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
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

/* ----------------------------- HTML landing ----------------------------- */

function renderLandingHtml(tasks: TaskInput[], requestUrl: URL): string {
  const downloadHref =
    requestUrl.pathname +
    "?" +
    new URLSearchParams({
      tasks: requestUrl.searchParams.get("tasks") ?? "",
      download: "1",
    }).toString();

  const items = tasks
    .map((t) => {
      const title = typeof t.title === "string" ? escapeHtml(t.title) : "(untitled)";
      const due = typeof t.due === "string" && t.due ? escapeHtml(t.due) : "";
      const ctx = typeof t.context === "string" && t.context ? escapeHtml(t.context) : "";
      return `
        <li>
          <div class="title">${title}</div>
          ${due ? `<div class="meta">Due: ${due}</div>` : ""}
          ${ctx ? `<div class="ctx">${ctx}</div>` : ""}
        </li>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Send to Reminders — Hive OS</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.4rem; margin: 0 0 1rem; }
  .btn { display: inline-block; background: #0a84ff; color: #fff; text-decoration: none; padding: .8rem 1.2rem; border-radius: .6rem; font-weight: 600; }
  .btn:active { opacity: .85; }
  .note { font-size: .9rem; opacity: .7; margin-top: 1rem; }
  ul { list-style: none; padding: 0; margin: 1.5rem 0; }
  li { padding: .8rem 0; border-bottom: 1px solid rgba(127,127,127,.25); }
  .title { font-weight: 600; }
  .meta { font-size: .85rem; opacity: .7; margin-top: .15rem; }
  .ctx { font-size: .9rem; opacity: .85; margin-top: .25rem; }
</style>
</head>
<body>
  <h1>Send to Apple Reminders</h1>
  <p>${tasks.length} task${tasks.length === 1 ? "" : "s"} ready to import.</p>
  <p><a class="btn" href="${escapeHtml(downloadHref)}" download="tasks.ics">Download tasks.ics</a></p>
  <p class="note">
    <strong>Mac:</strong> open the downloaded file — Reminders will import the VTODOs automatically.<br/>
    <strong>iPhone:</strong> Safari can't hand .ics files off to Reminders directly. Email <code>tasks.ics</code> to yourself; tapping the attachment in Mail will open the Reminders import sheet.
  </p>
  <ul>${items}</ul>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
