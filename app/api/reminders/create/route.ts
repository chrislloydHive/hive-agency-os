// app/api/reminders/create/route.ts
// POST { tasks: Task[] } → { redirectUrl }
// The redirectUrl points at /api/reminders/redirect, which serves a .ics file
// that Apple Reminders imports automatically.

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tasks } = body ?? {};

    console.log("[reminders/create] Raw tasks:", tasks);

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { error: "tasks must be a non-empty JSON array" },
        { status: 400 }
      );
    }

    const encoded = encodeURIComponent(JSON.stringify(tasks));
    const { protocol, host } = new URL(request.url);
    const redirectUrl = `${protocol}//${host}/api/reminders/redirect?tasks=${encoded}`;

    console.log("[reminders/create] Redirect URL:", redirectUrl);

    return NextResponse.json({ success: true, redirectUrl });
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
