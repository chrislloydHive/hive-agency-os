---
# Google Drive Document Publishing Config
# Used by /api/os/drive/publish and the drive-publish Cowork skill.

apps_script_url: "https://script.google.com/macros/s/AKfycbxWCw3VzWARhNJINvL7D_7BnLfnkP1l0KLznyfh73RutkoUgCiCQUee7I8y-mYXu5Eh/exec"
default_folder_id: "1vnPWSaKyPaYFVzCikf66igoxJEvGLc-E"

# Template IDs — flat keys: template_<type>
# All currently point to the same master template. Add new types as needed.
template_brief: "1OHmvJcl5ZOAzxSx1O0tQBhUs_-GFg81uTfY7UPDjo9c"
template_sow: "1OHmvJcl5ZOAzxSx1O0tQBhUs_-GFg81uTfY7UPDjo9c"
template_report: "1OHmvJcl5ZOAzxSx1O0tQBhUs_-GFg81uTfY7UPDjo9c"
template_strategy: "1OHmvJcl5ZOAzxSx1O0tQBhUs_-GFg81uTfY7UPDjo9c"

# Valid document types (used for validation)
doc_types:
  - brief
  - sow
  - report
  - strategy
---

Configuration for publishing Claude-generated documents to Google Drive
via the Hive branded template system.

## How it works

1. Claude creates a document (report, brief, strategy, SOW) in a session.
2. The user says "push to Drive" or the skill auto-suggests after file creation.
3. The Cowork skill reads the file, picks the template type, and calls
   `/api/os/drive/publish` with the content and metadata.
4. The API endpoint POSTs to the Apps Script web app, which clones the
   branded template, injects the content, and saves to the target folder.
5. The Google Drive URL is returned to the user.

## Template placeholders

The Apps Script replaces these tokens in the template:
- `{{PROJECT}}` — project/client name
- `{{CLIENT}}` — client name
- `{{PROJECT_NUMBER}}` — project number
- `{{GENERATED_AT}}` — timestamp
- `{{DOC_NAME}}` — document title
- `{{CONTENT}}` — main body content
- `{{INLINE_TABLE}}` — optional table content

## Adding new templates

1. Create a new Google Doc template with Hive branding and placeholders.
2. Copy the doc ID from the URL.
3. Add `template_<type>: "<doc-id>"` to the frontmatter above.
4. Add the type name to the `doc_types` list.
5. The type becomes the `type` parameter in the API call.
