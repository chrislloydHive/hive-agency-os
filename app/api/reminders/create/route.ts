import { NextResponse } from "next/server";

// --- Types ---

interface ParsedTask {
  title: string;
  dueDate: string | null;
  priority: "high" | "medium" | "low";
  list: "Work" | "Personal";
}

// --- Parsing helpers ---

function normalizeTasks(input: string): string[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseDueDate(text: string): string | null {
  const lower = text.toLowerCase();
  const today = new Date();

  if (/\btoday\b/.test(lower)) {
    return formatDate(today);
  }

  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return formatDate(d);
  }

  if (/\bnext week\b/.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return formatDate(d);
  }

  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  for (let i = 0; i < dayNames.length; i++) {
    if (new RegExp(`\\b${dayNames[i]}\\b`).test(lower)) {
      const currentDay = today.getDay();
      let daysUntil = i - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      const d = new Date(today);
      d.setDate(d.getDate() + daysUntil);
      return formatDate(d);
    }
  }

  return null;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parsePriority(text: string): "high" | "medium" | "low" {
  const lower = text.toLowerCase();
  if (/\burgent\b/.test(lower) || /\basap\b/.test(lower)) return "high";
  if (/\blow priority\b/.test(lower)) return "low";
  return "medium";
}

function parseList(text: string): "Work" | "Personal" {
  const lower = text.toLowerCase();
  if (/\bclient\b/.test(lower)) return "Work";
  if (/\bproject\b/.test(lower)) return "Work";
  if (/\bcampaign\b/.test(lower)) return "Work";
  return "Personal";
}

function parseTask(raw: string): ParsedTask {
  return {
    title: raw,
    dueDate: parseDueDate(raw),
    priority: parsePriority(raw),
    list: parseList(raw),
  };
}

// --- Route handler ---

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tasks } = body;

    console.log("[reminders/create] Raw tasks:", tasks);

    if (!tasks || typeof tasks !== "string" || tasks.trim().length === 0) {
      return NextResponse.json({ error: "No tasks provided" }, { status: 400 });
    }

    const lines = normalizeTasks(tasks);
    const parsed: ParsedTask[] = lines.map(parseTask);
    console.log("[reminders/create] Parsed tasks:", parsed);

    const encoded = encodeURIComponent(JSON.stringify(parsed));
    console.log("[reminders/create] Encoded payload length:", encoded.length);

    const { protocol, host } = new URL(request.url);
    const redirectUrl = `${protocol}//${host}/api/reminders/redirect?tasks=${encoded}`;
    console.log("[reminders/create] Redirect URL:", redirectUrl);

    return NextResponse.json({
      success: true,
      redirectUrl,
    });
  } catch (error) {
    console.error("[reminders/create] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 }
  );
}
