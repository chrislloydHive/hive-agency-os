---
description: "Push a document to Google Drive with Hive branding. Use when the user says 'push to Drive', 'publish to Drive', 'send to Drive', 'save to Drive', or asks to export a document they've created to Google Drive with branded formatting. ALSO use proactively: whenever Claude creates a document file (.md, .docx, .html, .txt) that looks like a deliverable (report, brief, SOW, strategy, proposal, analysis), automatically ask the user if they want to push it to Drive."
---

# Push to Google Drive

Publish a document Claude created to Google Drive using Hive Agency's branded template system. The document is cloned from a branded Google Docs template managed in Airtable, content is injected via the Google Docs API, and the final doc lands in the correct Drive folder based on project and document type.

## Proactive prompt

**IMPORTANT:** Whenever Claude creates a document that could be a client deliverable, automatically ask the user if they want to publish it to Google Drive. Do this immediately after sharing the file link. Use AskUserQuestion with a question like:

> "Want me to push this to Google Drive with Hive branding?"

With options:
- **Yes, as a report** (or brief/sow/strategy — pick the best-fit type)
- **Yes, let me pick the type** — show all available types
- **No thanks** — skip publishing

Trigger this prompt when Claude creates any file that looks like:
- A report or analysis (campaign reports, performance summaries, audits)
- A client brief or advertising brief
- A scope of work or proposal
- A strategy document or media plan
- Any structured deliverable longer than ~200 words

Do NOT prompt for code files, config files, scratch notes, or internal working docs.

## Workflow

### 1. Identify the document

Find the most recently created file in the session. If multiple files exist or it's unclear which one, ask the user.

Supported file types: `.md`, `.txt`, `.html`, `.docx` (read content from any of these).

### 2. Classify the document type

Map the document to one of these types based on its content and context:

| Type       | Use for                                              |
|------------|------------------------------------------------------|
| `brief`    | Client briefs, advertising briefs, campaign briefs   |
| `sow`      | Scope of work, proposals, contracts                  |
| `report`   | Analytics reports, performance reports, campaign analyses |
| `strategy` | Strategy documents, media plans, marketing strategies |
| `timeline` | Project timelines, schedules                         |
| `msa`      | Master services agreements                           |

If the type is ambiguous, ask the user.

### 3. Extract metadata

From the document content or conversation context, determine:

- **fileName** — a clean document title (e.g., "Car Toys Q2 Campaign Report")
- **project** — the client or project name (e.g., "Car Toys", "Tint", "Atlas Copco")
- **client** — the client name if different from the project name

If a specific job is being discussed, also capture:
- **jobId** — the Airtable job record ID (routes the doc to the job's subfolder in Drive)
- **jobCode** — the job code for naming patterns

### 4. Read the file content

Use the Read tool to get the full document content. For `.md` files, the raw markdown is fine — the template system handles plain text injection into the `{{CONTENT}}` placeholder.

### 5. Call the publish API

POST to the Hive OS endpoint. The API handles template lookup from Airtable, template cloning via Google Drive, content injection via Google Docs API, and Airtable artifact record creation.

```bash
curl -s -X POST http://localhost:3000/api/os/drive/publish \
  -H "Content-Type: application/json" \
  -d '{
    "type": "<brief|sow|report|strategy|timeline|msa>",
    "fileName": "<Document Title>",
    "content": "<full document content>",
    "project": "<project name>",
    "client": "<client name>",
    "jobId": "<optional Airtable job record ID>",
    "jobCode": "<optional job code>"
  }'
```

**Note:** `companyId` defaults to the server's `DMA_DEFAULT_COMPANY_ID` env var. Only pass it explicitly if publishing for a different company.

You can also pass `templateId` (an Airtable template record ID) to use a specific template instead of looking one up by type.

The API returns:
```json
{
  "ok": true,
  "docId": "1abc...",
  "docUrl": "https://docs.google.com/document/d/1abc.../edit",
  "type": "report",
  "fileName": "Car Toys Q2 Campaign Report",
  "artifactId": "recXYZ...",
  "destinationFolder": {
    "id": "folder-id",
    "name": "Deliverables"
  }
}
```

### 6. Return the result

Share the Google Drive link with the user. Example response:

> Your document has been published to Google Drive with Hive branding:
> [Car Toys Q2 Campaign Report](https://docs.google.com/document/d/1abc.../edit)
>
> Filed in: Deliverables folder

## How it works under the hood

1. **Template lookup** — The `type` you pass is mapped to a `DocumentType` in Airtable's Templates table. Templates with `allowAIDrafting = true` are preferred.
2. **Template clone** — `instantiateFromTemplate()` copies the branded Google Docs template to the correct Drive folder. If a `jobId` is provided, it routes to the job's subfolder (e.g., Brief → Client Brief/Comms, SOW → Estimate/Financials).
3. **Content injection** — The Google Docs API replaces placeholders (`{{CONTENT}}`, `{{PROJECT}}`, `{{CLIENT}}`, etc.) with your content.
4. **Artifact record** — An artifact record is created in Airtable linking the new document to the company.

## Error handling

| Error | What to do |
|-------|------------|
| "DRIVE_NOT_AVAILABLE" | Google Drive integration isn't enabled — check env vars |
| "TEMPLATE_NOT_FOUND" | The templateId doesn't exist in Airtable |
| "No template found for document type" | No template configured for that type — create one in Airtable's Templates table |
| "COMPANY_NOT_FOUND" | Bad companyId — check the ID or DMA_DEFAULT_COMPANY_ID env var |
| "JOB_NO_DRIVE_FOLDER" | Job doesn't have Drive folders provisioned yet |
| Content injection warning | Doc was cloned but placeholder replacement failed — user can edit manually |

## Template placeholders

The branded Google Docs template supports these placeholders (replaced automatically):

| Placeholder        | Source field    | Description                    |
|-------------------|----------------|--------------------------------|
| `{{PROJECT}}`      | `project`      | Project or client name         |
| `{{CLIENT}}`       | `client`       | Client name                    |
| `{{GENERATED_AT}}` | auto-generated | Timestamp (M/d/yyyy h:mma PT) |
| `{{DOC_NAME}}`     | `fileName`     | Document title                 |
| `{{CONTENT}}`      | `content`      | Main body content              |
