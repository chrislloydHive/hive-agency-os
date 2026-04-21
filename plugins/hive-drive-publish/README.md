# Hive Drive Publish

Push documents created by Claude to Google Drive using Hive Agency's branded templates.

## What it does

After Claude creates a document (report, brief, SOW, strategy), say **"push to Drive"** and the plugin will:

1. Read the document content
2. Look up the appropriate branded template from Airtable
3. Clone the template into the correct Drive folder (with job subfolder routing if applicable)
4. Inject content and metadata into the template via Google Docs API
5. Create an artifact record in Airtable
6. Return the Google Drive link

## Setup

### Prerequisites

- A running Hive Agency OS instance (`localhost:3000`)
- Google OAuth connected with Drive and Docs scopes
- Google Drive integration enabled (`GOOGLE_DRIVE_PROVIDER_ENABLED=true`)
- Templates configured in Airtable's Templates table with:
  - `driveTemplateFileId` pointing to a branded Google Docs template
  - `documentType` set to one of: SOW, BRIEF, TIMELINE, MSA
  - `allowAIDrafting` set to true for AI-generated content

### Configuration

Templates and folder routing are managed entirely through Airtable and the OS Drive config — no separate config file needed.

## Supported document types

| Type       | Maps to       | Template use case                                    |
|------------|---------------|------------------------------------------------------|
| `brief`    | BRIEF         | Client briefs, advertising briefs, campaign briefs   |
| `sow`      | SOW           | Scope of work, proposals, contracts                  |
| `report`   | BRIEF         | Analytics reports, performance reports               |
| `strategy` | SOW           | Strategy documents, media plans                      |
| `timeline` | TIMELINE      | Project timelines, schedules                         |
| `msa`      | MSA           | Master services agreements                           |

## Usage

After Claude creates a document in a Cowork session:

> "Push that report to Drive"
> "Save this to Google Drive"
> "Publish to Drive as a brief for Car Toys"
> "Push this SOW to Drive for job HV-2024-042"
