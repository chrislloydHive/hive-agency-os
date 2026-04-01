import { NextResponse } from "next/server";

function normalizeTasks(input: string): string[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tasks } = body;

    console.log("API HIT", tasks);

    if (!tasks || typeof tasks !== "string" || tasks.trim().length === 0) {
      return NextResponse.json({ error: "No tasks provided" }, { status: 400 });
    }

    const processed = normalizeTasks(tasks);
    console.log("[reminders/create] Processed tasks:", processed);

    const encoded = encodeURIComponent(processed.join("\n"));

    return NextResponse.json({
      success: true,
      triggerUrl: `hive://create-reminders?tasks=${encoded}`,
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
