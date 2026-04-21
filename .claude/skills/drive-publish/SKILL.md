# Drive Publish — Push documents to Google Drive with Hive branding

## When to use
- User says "push to Drive", "publish to Drive", "send to Drive", or similar
- After creating any document (report, brief, SOW, strategy) that should live in Google Drive
- User asks to save a document with Hive branding

## How it works

This skill takes a document Claude has created and pushes it to Google Drive
via the Hive branded template system. The flow:

1. Read the file content from the workspace
2. Determine the document type (brief, sow, report, strategy, timeline, msa)
3. POST to the Hive OS API at `/api/os/drive/publish`
4. The API looks up the branded template from Airtable, clones it in Drive,
   injects content via Google Docs API, and creates an Airtable artifact record
5. Return the Google Drive link to the user

## API Endpoint

```
POST /api/os/drive/publish
Content-Type: application/json

{
  "type": "brief" | "sow" | "report" | "strategy" | "timeline" | "msa",
  "fileName": "Document Title",
  "content": "The full document content...",
  "project": "Client or project name",
  "client": "Client name (defaults to project)",
  "subject": "Subject line (defaults to fileName)",
  "date": "Date string (defaults to today's date)",
  "jobId": "Optional Airtable job record ID for subfolder routing",
  "jobCode": "Optional job code for naming"
}
```

**Note:** `companyId` defaults to `DMA_DEFAULT_COMPANY_ID`. Pass explicitly only for a different company.

You can also pass `templateId` (Airtable record ID) to use a specific template.

**Response:**
```json
{
  "ok": true,
  "docId": "1abc...",
  "docUrl": "https://docs.google.com/document/d/1abc.../edit",
  "type": "report",
  "fileName": "Document Title",
  "artifactId": "recXYZ...",
  "destinationFolder": { "id": "...", "name": "Client Brief/Comms" }
}
```

## Instructions for Claude

When the user asks to push a document to Drive:

1. **Identify the file.** Look for the most recently created file in the session,
   or ask the user which file to publish if ambiguous.

2. **Read the file content.** Use the Read tool to get the full content.

3. **Determine the type.** Map the document to one of:
   - `brief` — client briefs, advertising briefs, campaign briefs
   - `sow` — scope of work, proposals, contracts
   - `report` — analytics reports, performance reports, campaign analyses
   - `strategy` — strategy documents, media plans, marketing strategies
   - `timeline` — project timelines, schedules
   - `msa` — master services agreements

4. **Extract metadata.** From the file content or conversation context, identify:
   - `fileName` — the document title
   - `project` — the client/project name (e.g., "Car Toys", "Tint")
   - `client` — the client name if different from project
   - `jobId` / `jobCode` — if a specific job is being discussed

5. **Call the API.** Use `curl` via Bash to POST to the endpoint:
   ```bash
   curl -s -X POST http://localhost:3000/api/os/drive/publish \
     -H "Content-Type: application/json" \
     -d '{"type":"report","fileName":"...","content":"...","project":"..."}'
   ```

6. **Return the link.** Share the Google Drive URL with the user.

## Folder routing

When a `jobId` is provided, documents are routed to job subfolders:
- SOW → Estimate/Financials
- BRIEF → Client Brief/Comms
- TIMELINE → Timeline/Schedule
- MSA → MSA

Without a jobId, documents go to the company's artifacts folder.

## Template lookup

The `type` maps to Airtable's `DocumentType` to find the right template:
- `brief` → BRIEF, `sow` → SOW, `report` → BRIEF, `strategy` → SOW
- Templates with `allowAIDrafting = true` are preferred

## Error handling

- **DRIVE_NOT_AVAILABLE** — Drive integration not enabled. Check env vars.
- **TEMPLATE_NOT_FOUND** — Bad templateId. Check Airtable.
- **No template for type** — No template configured for that document type in Airtable.
- **COMPANY_NOT_FOUND** — Bad companyId. Check DMA_DEFAULT_COMPANY_ID.
- **JOB_NO_DRIVE_FOLDER** — Job needs Drive folders provisioned first.
- **Content injection warning** — Doc cloned but placeholders not replaced. User can edit manually.
