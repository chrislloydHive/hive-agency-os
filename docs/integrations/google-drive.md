# Google Drive Integration

This document describes how to configure and use Google Drive integration in Hive OS for template creation and artifact storage.

## Overview

Hive OS uses Google Drive to:
- Store document templates (Google Docs, Sheets, Slides)
- Create new artifacts by copying templates
- Organize company documents in structured folders

**Key Features:**
- Uses Application Default Credentials (ADC) - no JSON key files required
- Works with Shared Drives (supportsAllDrives enabled)
- Service account based - no per-user OAuth needed

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Hive OS                                 │
├─────────────────────────────────────────────────────────────┤
│  lib/integrations/google/                                    │
│  ├── driveClient.ts    # ADC-based Drive client             │
│  ├── driveConfig.ts    # Configuration from env vars        │
│  └── (index.ts)                                              │
│                                                              │
│  lib/os/artifacts/                                           │
│  └── instantiateFromTemplate.ts  # Template -> Artifact     │
│                                                              │
│  app/api/os/integrations/google-drive/                      │
│  └── status/route.ts   # Health check endpoint              │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ googleapis (ADC)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Google Drive API                           │
├─────────────────────────────────────────────────────────────┤
│  Template Folder        │  Artifacts Folder                 │
│  ├── SOW Template       │  ├── Company A/                   │
│  ├── Brief Template     │  │   └── Artifacts/               │
│  └── Timeline Template  │  │       ├── Doc 1                │
│                         │  │       └── Doc 2                │
│                         │  └── Company B/                   │
│                         │      └── Artifacts/               │
└─────────────────────────────────────────────────────────────┘
```

## Environment Variables

### Required

```bash
# Enable the integration
GOOGLE_DRIVE_PROVIDER_ENABLED=true

# Drive folder ID containing your templates
GOOGLE_DRIVE_TEMPLATE_ROOT_FOLDER_ID=1ABCdef123...

# Drive folder ID where new documents will be created (legacy mode)
GOOGLE_DRIVE_ARTIFACTS_ROOT_FOLDER_ID=1XYZabc789...
```

### For Job-Based Folder Provisioning

```bash
# WORK folder ID - root folder for all client folders
# Structure: WORK/{ClientName}/*Projects/{JobCode} {ProjectName}/...
GOOGLE_DRIVE_WORK_ROOT_FOLDER_ID=0AEKTS5pZ_Il4Uk9PVA
```

### Optional

```bash
# Service account email (displayed to users for sharing instructions)
GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=hive-os@your-project.iam.gserviceaccount.com

# Shared Drive ID (if using Shared Drives)
GOOGLE_DRIVE_SHARED_DRIVE_ID=0ABCdef123...

# Test template file ID for health check verification
GOOGLE_DRIVE_TEST_TEMPLATE_FILE_ID=1TESTfile...

# Company folder strategy: 'create_company_folders' or 'flat'
GOOGLE_DRIVE_COMPANY_FOLDER_STRATEGY=create_company_folders
```

## Authentication Setup

This integration uses **Application Default Credentials (ADC)**. No JSON key files are needed.

### Local Development

Run this command to authenticate:

```bash
gcloud auth application-default login
```

This opens a browser for you to authenticate with your Google account. The credentials are stored locally at `~/.config/gcloud/application_default_credentials.json`.

**Note:** Your Google account must have access to the Drive folders you've configured.

### Production on GCP (Compute Engine, Cloud Run, GKE)

Attach a service account to your runtime:

1. Create a service account in GCP Console
2. Grant it the necessary IAM roles (no special Drive roles needed)
3. Attach it to your Compute Engine VM, Cloud Run service, or GKE workload
4. The ADC will automatically use the attached service account

### Production on Vercel

Use Workload Identity Federation:

1. Create a Workload Identity Pool in GCP
2. Add Vercel as an identity provider (OIDC)
3. Configure the service account to trust the Vercel provider
4. Set the following environment variables in Vercel:

```bash
GOOGLE_CLOUD_PROJECT=your-gcp-project
GOOGLE_APPLICATION_CREDENTIALS_JSON=<workload identity config>
```

For detailed WIF setup, see: https://cloud.google.com/iam/docs/workload-identity-federation

## Drive Permissions

### Sharing with Service Account

The service account needs access to your Drive folders. **Do NOT add it as a Google Workspace user** - instead, share folders directly with the service account email.

#### For Shared Drives:
1. Open the Shared Drive in Google Drive
2. Click the gear icon → "Manage members"
3. Add the service account email
4. Set role to **Content Manager**

#### For Regular Folders:
1. Right-click the folder → "Share"
2. Add the service account email
3. Set permission to **Editor**

### Required Permissions

The service account needs:
- **Read** access to the template folder
- **Write** access to the artifacts folder (to create/copy files)

## API Endpoints

### GET /api/os/integrations/google-drive/status

Returns the current status of the Google Drive integration.

**Response:**
```json
{
  "enabled": true,
  "mode": "adc",
  "serviceAccountEmail": "sa@project.iam.gserviceaccount.com",
  "configValid": true,
  "checks": {
    "auth": "ok",
    "folderAccess": "ok",
    "templateCopy": "ok"
  },
  "errors": []
}
```

**Error Response:**
```json
{
  "enabled": false,
  "mode": "adc",
  "serviceAccountEmail": null,
  "configValid": false,
  "checks": {
    "auth": "fail",
    "folderAccess": "skipped",
    "templateCopy": "skipped"
  },
  "errors": [
    {
      "code": "AUTH_FAILED",
      "message": "Google Drive authentication failed.",
      "howToFix": "For local development, run: gcloud auth application-default login..."
    }
  ],
  "setupInstructions": { ... }
}
```

## Template Instantiation

### How It Works

1. User selects a template from the UI
2. System calls `instantiateFromTemplate()`
3. Template is copied to the company's artifacts folder
4. Artifact record is created in Airtable
5. User gets a link to the new document

### Folder Structure

**Job-based structure (recommended):**

Set `GOOGLE_DRIVE_WORK_ROOT_FOLDER_ID` to your WORK folder:

```
WORK/
├── Acme Corp/
│   └── *Projects/
│       └── 117ACM Website Redesign/
│           ├── Client Brief-Comms/
│           ├── Estimate-Financials/
│           ├── Timeline-Schedule/
│           └── Creative/
│               ├── Assets/
│               ├── Working Files/
│               └── Final Files/
└── Widget Inc/
    └── *Projects/
        └── 118WID Brand Campaign/
            └── ...
```

**Legacy structure (artifacts folder):**

When `GOOGLE_DRIVE_COMPANY_FOLDER_STRATEGY=create_company_folders`:

```
Artifacts Root/
├── Acme Corp/
│   └── Artifacts/
│       ├── Acme Corp - SOW - 2024-01-15
│       └── Acme Corp - Brief - 2024-01-16
└── Widget Inc/
    └── Artifacts/
        └── Widget Inc - SOW - 2024-01-17
```

### Naming Patterns

Templates can define naming patterns with placeholders:

- `{companyName}` - Company name
- `{jobCode}` - Job code (if provided)
- `{date}` - Current date (YYYY-MM-DD)
- `{documentType}` - Template document type

Example: `{companyName} - SOW - {date}` → `Acme Corp - SOW - 2024-01-15`

## Troubleshooting

### "Authentication failed"

**Cause:** ADC not configured or expired.

**Fix (Local):**
```bash
gcloud auth application-default login
```

**Fix (Production):** Verify service account is attached to your runtime.

### "Folder not found"

**Cause:** Folder ID is incorrect or not shared with the service account.

**Fix:**
1. Verify the folder ID in the Drive URL
2. Share the folder with the service account email
3. For Shared Drives, ensure the service account is a member

### "Insufficient permissions"

**Cause:** Service account doesn't have write access.

**Fix:**
1. For Shared Drives: Grant "Content Manager" role
2. For regular folders: Grant "Editor" permission

### "Template copy failed"

**Cause:** Can't copy the template file.

**Fix:**
1. Verify the template file ID is correct
2. Ensure the template is shared with the service account
3. Check if the template is in a Shared Drive (needs Content Manager access)

## Settings UI

Access the Drive integration settings at: `/settings/integrations/google-drive`

This page shows:
- Current integration status
- Health check results
- Setup instructions
- Environment variable reference

## Security Considerations

1. **No JSON Keys:** This integration uses ADC, not JSON key files. This is more secure as there are no credentials to leak.

2. **Minimal Permissions:** The service account only needs Drive file access, not admin permissions.

3. **Folder Isolation:** Each company's documents are in separate folders.

4. **No User OAuth:** Users don't need to authenticate with their Google accounts. The service account handles all Drive operations.

## Migration from OAuth-based Integration

If you previously used the OAuth-based integration (`lib/integrations/googleDrive.ts`):

1. The OAuth integration is still available for per-company authentication
2. The new ADC integration is for service-account based operations
3. Both can coexist - use the appropriate one for your use case

## Files Reference

| File | Purpose |
|------|---------|
| `lib/integrations/google/driveClient.ts` | ADC-based Drive client |
| `lib/integrations/google/driveConfig.ts` | Configuration management |
| `lib/os/artifacts/instantiateFromTemplate.ts` | Template instantiation |
| `app/api/os/integrations/google-drive/status/route.ts` | Health check API |
| `components/os/documents/DriveIntegrationStatus.tsx` | Status badge component |
| `app/settings/integrations/google-drive/` | Settings UI |
