# Drive Publish API Reference

## Related: binary file upload

```
POST /api/os/drive/upload-file
Content-Type: multipart/form-data
```

Uploads or replaces-by-name an arbitrary file in a folder using the same company Google OAuth as publish. Fields: `file` (required), `folderId` (required), `fileName` (optional), `companyId` (optional, defaults to `DMA_DEFAULT_COMPANY_ID`). Response: `{ ok, fileId, fileUrl, action: "Uploaded" | "Updated" }`.

## Endpoint

```
POST /api/os/drive/publish
Content-Type: application/json
```

## Request Body

| Field               | Type   | Required | Description                                        |
|---------------------|--------|----------|----------------------------------------------------|
| `type`              | string | Yes*     | Document type: `brief`, `sow`, `report`, `strategy`, `timeline`, `msa` |
| `templateId`        | string | Yes*     | Airtable template record ID (overrides type lookup) |
| `fileName`          | string | Yes      | Document title for the Google Doc                  |
| `content`           | string | Yes      | Main body content (injected into `{{CONTENT}}`)    |
| `companyId`         | string | No       | Company ID (defaults to DMA_DEFAULT_COMPANY_ID)    |
| `project`           | string | No       | Project/client name (injected into `{{PROJECT}}`)  |
| `client`            | string | No       | Client name (defaults to project)                  |
| `jobId`             | string | No       | Airtable job record ID for subfolder routing       |
| `jobCode`           | string | No       | Job code for naming patterns                       |

*Either `type` or `templateId` is required. If both are provided, `templateId` takes precedence.

### Type → Template Mapping

The `type` field is mapped to Airtable's `DocumentType` to find the right template:

| Type       | DocumentType | Fallback notes                           |
|------------|-------------|------------------------------------------|
| `brief`    | `BRIEF`     | Direct match                             |
| `sow`      | `SOW`       | Direct match                             |
| `report`   | `BRIEF`     | Uses Brief template (general purpose)    |
| `strategy` | `SOW`       | Uses SOW template (structured)           |
| `timeline` | `TIMELINE`  | Direct match                             |
| `msa`      | `MSA`       | Direct match                             |

Templates with `allowAIDrafting = true` are preferred when multiple templates match.

## Response

### Success (200)

```json
{
  "ok": true,
  "docId": "1f8Zn0Bd62c1RuvUN1k6YKfrrVkYhH6ugXbW9geh29vo",
  "docUrl": "https://docs.google.com/document/d/1f8Zn.../edit",
  "type": "report",
  "fileName": "Car Toys Q2 Campaign Report",
  "artifactId": "recXYZ123",
  "destinationFolder": {
    "id": "1abc...",
    "name": "Client Brief/Comms"
  }
}
```

### Success with Warning (200)

If the template was cloned but content injection failed:

```json
{
  "ok": true,
  "docId": "...",
  "docUrl": "...",
  "warning": "Document created but content injection failed — placeholders may still be present."
}
```

### Error (4xx/5xx)

```json
{
  "ok": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "howToFix": "Optional guidance on how to resolve"
}
```

### Error Codes

| Code                    | Description                                          |
|-------------------------|------------------------------------------------------|
| `DRIVE_NOT_AVAILABLE`   | Google Drive integration not enabled/configured      |
| `TEMPLATE_NOT_FOUND`    | Template record not found in Airtable                |
| `TEMPLATE_NO_DRIVE_FILE`| Template has no Drive file ID configured             |
| `COMPANY_NOT_FOUND`     | Company record not found in Airtable                 |
| `JOB_NOT_FOUND`         | Job record not found in Airtable                     |
| `JOB_NO_DRIVE_FOLDER`   | Job doesn't have Drive folders provisioned           |
| `AIRTABLE_CREATE_FAILED`| Drive file created but Airtable artifact record failed |

## Template Placeholders

The Google Docs template supports these placeholders (double-brace):

| Placeholder        | Source field    | Description                    |
|-------------------|----------------|--------------------------------|
| `{{PROJECT}}`      | `project`      | Project or client name         |
| `{{CLIENT}}`       | `client`       | Client name                    |
| `{{GENERATED_AT}}` | auto-generated | Timestamp (M/d/yyyy h:mma PT) |
| `{{DOC_NAME}}`     | `fileName`     | Document title                 |
| `{{CONTENT}}`      | `content`      | Main body content              |

## Folder Routing

When `jobId` is provided, the document is placed in the job's subfolder based on document type:

| Document Type | Destination Subfolder    |
|--------------|--------------------------|
| `SOW`        | Estimate/Financials      |
| `BRIEF`      | Client Brief/Comms       |
| `TIMELINE`   | Timeline/Schedule        |
| `MSA`        | MSA                      |

Without `jobId`, the document goes to the company's artifacts folder.
