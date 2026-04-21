# Drive Publish — Create branded documents in Google Drive

## When to use
- User says "push to Drive", "push document to Drive", "publish to Drive",
  "send to Drive", "save to Drive", "create Drive document", or similar
- After creating any document (report, brief, SOW, strategy) that should live in Google Drive
- User asks to get a document into the Hive branded template

## How it works

This skill takes a document Claude has created and pushes the **body content**
into a Hive branded Google Docs template. The flow:

1. Read the file content from the workspace
2. Determine the document type (brief, sow, report, strategy, timeline, msa)
3. POST to the Hive OS API at `/api/os/drive/publish`
4. The API clones the branded template from Google Drive, injects the body
   content into the "Content goes here…" placeholder via Google Docs API
5. Return the Google Drive link to the user
6. **User opens the doc** and uses the Apps Script sidebar to set Doc Title,
   select Project, Subject, choose the Drive folder, then hits "Create"
7. The sidebar handles all metadata (title, project, client, date, subject)
   and files the document into the correct Drive folder

**Important:** The API only injects body content. Template header fields
({{Doc_Title}}, {{PROJECT}}, etc.) are left for the sidebar to populate.

## API Endpoint

```
POST /api/os/drive/publish
Content-Type: application/json

{
  "type": "brief" | "sow" | "report" | "strategy" | "timeline" | "msa",
  "fileName": "Document Title",
  "content": "The full document content (body only — no metadata)"
}
```

**Note:** `companyId` defaults to `DMA_DEFAULT_COMPANY_ID`. Pass explicitly only for a different company.

You can also pass `templateId` (Airtable record ID) to use a specific template.

**Do NOT pass** `project`, `client`, `subject`, or `date` — the sidebar handles those.
Only pass `populateFields: true` if you specifically need the API to fill header fields
(rare — the normal workflow uses the sidebar).

**Response:**
```json
{
  "ok": true,
  "docId": "1abc...",
  "docUrl": "https://docs.google.com/document/d/1abc.../edit",
  "type": "report",
  "fileName": "Document Title"
}
```

## Instructions for Claude

When the user asks to push/create a document in Drive:

1. **Identify the file.** Look for the most recently created file in the session,
   or ask the user which file to publish if ambiguous.

2. **Read the file content.** Use the Read tool to get the full content.
   Only include the document body — skip any front-matter or metadata headers.

3. **Determine the type.** Map the document to one of:
   - `brief` — client briefs, advertising briefs, campaign briefs
   - `sow` — scope of work, proposals, contracts
   - `report` — analytics reports, performance reports, campaign analyses
   - `strategy` — strategy documents, media plans, marketing strategies
   - `timeline` — project timelines, schedules
   - `msa` — master services agreements

4. **Pick a fileName.** Use the document title or a descriptive name.
   Do NOT pass project, client, subject, or date — the sidebar handles those.

5. **Call the API.** Use `curl` via Bash to POST to the endpoint:
   ```bash
   curl -s -X POST http://localhost:3000/api/os/drive/publish \
     -H "Content-Type: application/json" \
     -d '{"type":"brief","fileName":"Document Title","content":"..."}'
   ```

6. **Return the link.** Share the Google Drive URL with the user and let them
   know they can open it, use the sidebar to set Doc Title, Project, Subject,
   choose a folder, and hit "Create" to finalize.

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
