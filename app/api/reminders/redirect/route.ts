import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tasks = searchParams.get("tasks");

  console.log("[reminders/redirect] Tasks param:", tasks);

  if (!tasks) {
    return NextResponse.json({ error: "No tasks provided" }, { status: 400 });
  }

  // Validate that the payload is parseable JSON
  try {
    JSON.parse(decodeURIComponent(tasks));
  } catch {
    return NextResponse.json({ error: "Invalid tasks payload" }, { status: 400 });
  }

  // tasks is already URI-encoded JSON from the create endpoint;
  // pass it through to the hive:// URL as-is
  const hiveUrl = `hive://create-reminders?tasks=${tasks}`;
  console.log("[reminders/redirect] Redirecting to:", hiveUrl);

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="refresh" content="0;url=${hiveUrl}" />
  </head>
  <body>
    Redirecting to Reminders...
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}
