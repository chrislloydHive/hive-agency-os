---
# Google Drive Document Publishing Config
# NOTE: The /api/os/drive/publish endpoint now uses Airtable templates
# and the OS instantiateFromTemplate() pipeline instead of Apps Script.
# This file is kept for reference only.

# Legacy Apps Script URL (no longer used by the publish endpoint)
apps_script_url: "https://script.google.com/macros/s/AKfycbxWCw3VzWARhNJINvL7D_7BnLfnkP1l0KLznyfh73RutkoUgCiCQUee7I8y-mYXu5Eh/exec"

# Legacy default folder (folder routing now handled by instantiateFromTemplate)
default_folder_id: "1vnPWSaKyPaYFVzCikf66igoxJEvGLc-E"
---

Configuration for publishing Claude-generated documents to Google Drive
via the Hive branded template system.

## Current Architecture (v2)

The drive-publish endpoint now uses the OS's built-in template instantiation pipeline:

1. Claude creates a document (report, brief, strategy, SOW) in a Cowork session.
2. The user says "push to Drive" or the skill auto-suggests after file creation.
3. The Cowork skill reads the file, picks the document type, and calls
   `/api/os/drive/publish` with the content and metadata.
4. The endpoint looks up the branded template from **Airtable's Templates table**.
5. `instantiateFromTemplate()` clones the template into the correct Drive folder
   (with job subfolder routing if a jobId is provided).
6. The Google Docs API injects content into template placeholders.
7. An artifact record is created in Airtable.
8. The Google Drive URL is returned to the user.

## Template Management

Templates are managed in Airtable's Templates table, not in this config file.

Each template needs:
- `driveTemplateFileId` — the Google Docs template ID
- `documentType` — SOW, BRIEF, TIMELINE, or MSA
- `allowAIDrafting` — set to true for AI-generated content
- `destinationFolderKey` — determines where the doc is filed
- `namingPattern` — pattern for the document name

## Template Placeholders

The Google Docs template supports these tokens (replaced by the Docs API):
- `{{PROJECT}}` — project/client name
- `{{CLIENT}}` — client name
- `{{GENERATED_AT}}` — timestamp
- `{{DOC_NAME}}` — document title
- `{{CONTENT}}` — main body content
