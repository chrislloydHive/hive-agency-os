# Drive Publish — Push documents to Google Drive with Hive branding

## When to use
- User says "push to Drive", "publish to Drive", "send to Drive", or similar
- After creating any document (report, brief, SOW, strategy) that should live in Google Drive
- User asks to save a document with Hive branding

## How it works

This skill takes a document Claude has created and pushes it to Google Drive
via the Hive branded template system. The flow:

1. Read the file content from the workspace
2. Determine the document type (brief, sow, report, strategy)
3. POST to the Hive OS API at `/api/os/drive/publish`
4. Return the Google Drive link to the user

## API Endpoint

```
POST /api/os/drive/publish
Content-Type: application/json

{
  "type": "brief" | "sow" | "report" | "strategy",
  "fileName": "Document Title",
  "content": "The full document content...",
  "project": "Client or project name",
  "client": "Client name (defaults to project)",
  "docName": "Display title in the doc header",
  "inlineTable": "Optional table content",
  "destinationFolderId": "Optional Drive folder override"
}
```

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

When the user asks to push a document to Drive:

1. **Identify the file.** Look for the most recently created file in the session,
   or ask the user which file to publish if ambiguous.

2. **Read the file content.** Use the Read tool to get the full content.

3. **Determine the type.** Map the document to one of:
   - `brief` — client briefs, advertising briefs, campaign briefs
   - `sow` — scope of work, proposals, contracts
   - `report` — analytics reports, performance reports, campaign analyses
   - `strategy` — strategy documents, media plans, marketing strategies

4. **Extract metadata.** From the file content or conversation context, identify:
   - `fileName` — the document title
   - `project` — the client/project name (e.g., "Car Toys", "Tint")
   - `client` — the client name if different from project

5. **Call the API.** Use `fetch` via Bash to POST to the endpoint:
   ```bash
   curl -s -X POST http://localhost:3000/api/os/drive/publish \
     -H "Content-Type: application/json" \
     -d '{"type":"report","fileName":"...","content":"...","project":"..."}'
   ```

6. **Return the link.** Share the Google Drive URL with the user.

## Template placeholders

The branded template supports these placeholders (auto-filled):
- `{{PROJECT}}` — project/client name
- `{{CLIENT}}` — client name
- `{{GENERATED_AT}}` — auto-filled with current timestamp
- `{{DOC_NAME}}` — document title
- `{{CONTENT}}` — the main document body
- `{{INLINE_TABLE}}` — optional structured table data

## Configuration

Config lives in `context/personal/drive.md` (frontmatter):
- `apps_script_url` — the deployed Google Apps Script endpoint
- `default_folder_id` — default Google Drive output folder
- `template_<type>` — Google Docs template ID per document type
- `doc_types` — list of valid document types

## Error handling

- If the API returns an error about the Apps Script URL, the user needs to
  update `context/personal/drive.md` with their deployed exec URL.
- If the template is missing, suggest the user add a `template_<type>` entry.
- If the folder is missing, ask the user for a Drive folder ID or have them
  set `default_folder_id` in the config.
