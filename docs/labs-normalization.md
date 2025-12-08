# Labs Normalization Plan

This document describes the unified model for diagnostic Labs using the existing `Diagnostic Runs` and `Diagnostic Details` tables.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Target Model](#target-model)
3. [Type Definitions](#type-definitions)
4. [Implementation Plan](#implementation-plan)
5. [UI Filtering Guide](#ui-filtering-guide)

---

## Current State Analysis

### Diagnostic Runs Table

**Table Name**: `Diagnostic Runs`
**Status**: Already in use as unified Lab Runs table

| Current Field | Type | Description |
|---------------|------|-------------|
| `Company copy` | Linked Record | Link to Companies |
| `Tool ID` | Single Select | Lab identifier (gapSnapshot, websiteLab, brandLab, etc.) |
| `Status` | Single Select | pending, running, complete, failed |
| `Score` | Number | Overall score (0-100) |
| `Summary` | Long Text | Human-readable summary |
| `Metadata JSON` | Long Text | Additional metadata |
| `Raw JSON` | Long Text | Full JSON diagnostic payload |
| `Created At` | Date/Time | Auto-set |
| `Updated At` | Date/Time | Auto-computed |

### Diagnostic Details Table

**Table Name**: `Diagnostic Details`
**Status**: Currently used only for JSON overflow storage (chunking large payloads)

| Current Field | Type | Description |
|---------------|------|-------------|
| `Run ID` | Text | ID of parent Heavy GAP Run |
| `Data Type` | Text | modules, websiteLabV4, brandLab, etc. |
| `JSON Data` | Long Text | Full JSON chunk |
| `Size KB` | Number | Size in KB |
| `Created` | Date/Time | Auto-set |

### Lab-by-Lab Current Implementation

#### Website Lab (`websiteLab`)
- **API Endpoint**: `/api/os/diagnostics/run/website-lab`
- **Writes to**: `Diagnostic Runs` table via `createDiagnosticRun()` / `updateDiagnosticRun()`
- **Run metadata**: Tool ID = `websiteLab`, Score, Summary, Raw JSON
- **Findings storage**: Embedded in `Raw JSON` as `siteAssessment.issues[]`
- **Findings NOT written to**: `Diagnostic Details` as individual rows

#### Brand Lab (`brandLab`)
- **API Endpoint**: `/api/os/diagnostics/run/brand-lab`
- **Writes to**: `Diagnostic Runs` table (async via Inngest)
- **Run metadata**: Tool ID = `brandLab`, Score, Summary, Raw JSON
- **Findings storage**: Embedded in `Raw JSON` as `diagnostic.issues[]`
- **Findings NOT written to**: `Diagnostic Details` as individual rows

#### SEO Lab (`seoLab`)
- **API Endpoint**: `/api/os/diagnostics/run/seo-lab`
- **Writes to**: `Diagnostic Runs` table
- **Findings storage**: Embedded in `Raw JSON`

#### Content Lab (`contentLab`)
- **API Endpoint**: `/api/os/diagnostics/run/content-lab`
- **Writes to**: `Diagnostic Runs` table
- **Findings storage**: Embedded in `Raw JSON`

#### Demand Lab (`demandLab`)
- **API Endpoint**: `/api/os/diagnostics/run/demand-lab`
- **Writes to**: `Diagnostic Runs` table
- **Findings storage**: Embedded in `Raw JSON`

#### Ops Lab (`opsLab`)
- **API Endpoint**: `/api/os/diagnostics/run/ops-lab`
- **Writes to**: `Diagnostic Runs` table
- **Findings storage**: Embedded in `Raw JSON`

#### Media Lab (`mediaLab`)
- **API Endpoint**: `/api/media/planning/*` (strategic tool, not diagnostic)
- **Writes to**: `MediaPlans`, `MediaPlanChannels`, `MediaPlanFlights` (separate tables)
- **NOT using**: `Diagnostic Runs` for media planning
- **Status**: Strategic/durable object storage, not diagnostic runs

#### Audience Lab (`audienceLab`)
- **API Endpoint**: `/api/audience/*`
- **Writes to**: `AudienceModels`, `AudiencePersonas` (separate tables)
- **NOT using**: `Diagnostic Runs` for audience models
- **Status**: Strategic/durable object storage, not diagnostic runs

#### Analytics Lab (analyticsScan)
- **No API endpoint**: Opens Analytics page directly
- **NOT using**: `Diagnostic Runs` - live data only
- **Status**: Route-based tool, no persistent storage

---

## Target Model

### Unified Tables

1. **Diagnostic Runs** (already in use)
   - Each Lab run = 1 row
   - `labSlug` field identifies which Lab
   - `runType` field identifies run type (quick, full, followup, monitoring)
   - JSON payload preserved as source of truth

2. **Diagnostic Details** (to be repurposed)
   - Each finding/issue from a Lab run = 1 row
   - Links to parent run and company
   - Structured fields for filtering, sorting, querying
   - Enables "convert to Work Item" workflow

3. **Specialized Tables** (remain separate)
   - `MediaPlans`, `MediaPlanChannels`, `MediaPlanFlights` - Media Lab strategic plans
   - `AudienceModels`, `AudiencePersonas` - Audience Lab durable objects
   - These are IN ADDITION TO Diagnostic Runs, not instead of

### Proposed Airtable Fields

#### Diagnostic Runs - New Fields to Add

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `Lab Slug` | Single Select | Optional | website, brand, ux, analytics, media, seo, content, demand, ops |
| `Run Type` | Single Select | Optional | quick, full, followup, monitoring |
| `Severity Level` | Single Select | Optional | low, medium, high, critical |

Note: `Tool ID` already serves as `labSlug` equivalent. We may use that directly.

#### Diagnostic Details - New Fields to Add

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `Lab Run` | Linked Record | Required | Link to Diagnostic Runs |
| `Company` | Linked Record | Required | Link to Companies |
| `Lab Slug` | Single Select | Optional | website, brand, seo, content, etc. |
| `Category` | Single Select | Optional | Technical, UX, Brand, Content, SEO, Analytics, Media |
| `Dimension` | Text | Optional | Page speed, Navigation, Positioning, Channel mix, etc. |
| `Severity` | Single Select | Optional | low, medium, high, critical |
| `Location` | Text | Optional | URL, channel, asset identifier |
| `Issue Key` | Text | Optional | Unique identifier for deduplication |
| `Description` | Long Text | Optional | The issue description |
| `Recommendation` | Long Text | Optional | Suggested fix |
| `Estimated Impact` | Text | Optional | Impact assessment |
| `Is Converted to Work Item` | Checkbox | Optional | Whether converted to task |
| `Work Item` | Linked Record | Optional | Link to Work Items |

---

## Type Definitions

### DiagnosticRun (Extended)

```typescript
// lib/os/diagnostics/runs.ts - Extended interface

export interface DiagnosticRun {
  // Existing fields
  id: string;
  companyId: string;
  toolId: DiagnosticToolId;
  status: DiagnosticRunStatus;
  summary: string | null;
  score: number | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown> | null;
  rawJson?: unknown;

  // New optional fields for unified model
  labSlug?: 'website' | 'brand' | 'ux' | 'analytics' | 'media' | 'seo' | 'content' | 'demand' | 'ops' | string;
  runType?: 'quick' | 'full' | 'followup' | 'monitoring' | string;
  severityLevel?: 'low' | 'medium' | 'high' | 'critical' | string;
}
```

### DiagnosticDetail (New Unified)

```typescript
// lib/airtable/diagnosticDetails.ts - New interface

export interface DiagnosticDetailFinding {
  id?: string;

  // Links
  labRunId: string;          // Link to Diagnostic Runs record
  companyId: string;         // Link to Companies record

  // Classification
  labSlug?: string;          // website, brand, seo, content, etc.
  category?: string;         // Technical, UX, Brand, Content, SEO, Analytics, Media
  dimension?: string;        // Page speed, Navigation, Positioning, etc.
  severity?: 'low' | 'medium' | 'high' | 'critical' | string;

  // Location & Identity
  location?: string;         // URL, channel, asset identifier
  issueKey?: string;         // Unique key for deduplication

  // Content
  description?: string;      // Issue description
  recommendation?: string;   // Suggested fix
  estimatedImpact?: string | number;

  // Work Item conversion
  isConvertedToWorkItem?: boolean;
  workItemId?: string;

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}
```

### Lab Slug Mapping

```typescript
// Tool ID to Lab Slug mapping
const TOOL_TO_LAB_SLUG: Record<DiagnosticToolId, string> = {
  gapSnapshot: 'gap',
  gapPlan: 'gap',
  gapHeavy: 'gap',
  websiteLab: 'website',
  brandLab: 'brand',
  audienceLab: 'audience',
  mediaLab: 'media',
  contentLab: 'content',
  seoLab: 'seo',
  demandLab: 'demand',
  opsLab: 'ops',
  creativeLab: 'creative',
  competitorLab: 'competitor',
  competitionLab: 'competitor',
};
```

---

## Implementation Plan

### Phase 1: Update Types (Additive Only)

1. Extend `DiagnosticRun` interface with optional unified fields
2. Create `DiagnosticDetailFinding` interface for findings

### Phase 2: Add Findings Extraction

For each Lab, create a helper function to extract findings from JSON:

```typescript
// Example: Website Lab finding extraction
function extractWebsiteLabFindings(
  runId: string,
  companyId: string,
  rawJson: any
): DiagnosticDetailFinding[] {
  const findings: DiagnosticDetailFinding[] = [];

  const issues = rawJson?.siteAssessment?.issues || [];
  for (const issue of issues) {
    findings.push({
      labRunId: runId,
      companyId,
      labSlug: 'website',
      category: issue.category || 'UX',
      dimension: issue.dimension,
      severity: mapSeverity(issue.severity),
      location: issue.url || issue.location,
      issueKey: issue.id || `${issue.dimension}-${issue.title}`,
      description: issue.title || issue.description,
      recommendation: issue.recommendation,
      estimatedImpact: issue.impact,
    });
  }

  return findings;
}
```

### Phase 3: Wire Labs to Write Findings

Update each Lab's completion handler to:
1. Continue writing to `Diagnostic Runs` (no change)
2. Extract findings from JSON result
3. Write findings to `Diagnostic Details`

```typescript
// Example in website-lab/route.ts POST handler
if (result.success) {
  // Extract and save findings
  const findings = extractWebsiteLabFindings(
    updatedRun.id,
    companyId,
    result.data
  );
  await saveDiagnosticFindings(findings);

  // Continue with existing post-run hooks
  processDiagnosticRunCompletionAsync(companyId, updatedRun);
}
```

### Phase 4: Migrate Strategic Labs (Optional)

For Media Lab and Audience Lab, optionally create summary diagnostic runs:

```typescript
// When a Media Plan is created/updated
async function createMediaLabDiagnosticRun(plan: MediaPlan) {
  await createDiagnosticRun({
    companyId: plan.companyId,
    toolId: 'mediaLab',
    status: 'complete',
    summary: `Media Plan: ${plan.name}`,
    score: null, // No score for strategic plans
    metadata: {
      planId: plan.id,
      status: plan.status,
      objective: plan.objective,
    },
  });
}
```

---

## UI Filtering Guide

### Runs List View (per Lab)

```typescript
// Get runs for a specific Lab tab
async function getLabRuns(companyId: string, labSlug: string) {
  // Map lab slug to tool IDs
  const toolIds = getToolIdsForLabSlug(labSlug);

  return listDiagnosticRunsForCompany(companyId, {
    // Filter by matching tool IDs
  });
}

// Helper: Map lab slug to tool IDs
function getToolIdsForLabSlug(labSlug: string): DiagnosticToolId[] {
  switch (labSlug) {
    case 'website': return ['websiteLab'];
    case 'brand': return ['brandLab'];
    case 'seo': return ['seoLab'];
    case 'content': return ['contentLab'];
    case 'demand': return ['demandLab'];
    case 'ops': return ['opsLab'];
    case 'media': return ['mediaLab'];
    case 'gap': return ['gapSnapshot', 'gapPlan', 'gapHeavy'];
    default: return [];
  }
}
```

### Run Detail View (findings for a run)

```typescript
// Get findings for a specific run
async function getRunFindings(runId: string) {
  return getDiagnosticFindingsByRunId(runId);
}
```

### Work Tab (all findings)

```typescript
// Get all findings for a company, optionally filtered by lab
async function getCompanyFindings(
  companyId: string,
  options?: { labSlug?: string; severity?: string }
) {
  return getDiagnosticFindingsForCompany(companyId, options);
}
```

### Filtering by Severity

```typescript
// Get critical issues across all Labs
async function getCriticalIssues(companyId: string) {
  return getDiagnosticFindingsForCompany(companyId, {
    severity: 'critical',
  });
}
```

### Converting to Work Items

```typescript
// Convert a finding to a Work Item
async function convertFindingToWorkItem(findingId: string) {
  const finding = await getDiagnosticFindingById(findingId);
  if (!finding) throw new Error('Finding not found');

  // Create work item
  const workItem = await createWorkItem({
    companyId: finding.companyId,
    title: finding.description,
    description: finding.recommendation,
    source: `${finding.labSlug} Lab`,
    sourceId: finding.labRunId,
    priority: severityToPriority(finding.severity),
  });

  // Update finding
  await updateDiagnosticFinding(findingId, {
    isConvertedToWorkItem: true,
    workItemId: workItem.id,
  });

  return workItem;
}
```

---

## Migration Notes

### Backward Compatibility

1. All existing code continues to work - new fields are optional
2. JSON payloads remain the source of truth
3. Findings in `Diagnostic Details` are derived/extracted data
4. Legacy runs without findings remain valid

### Gradual Rollout

1. Phase 1: Add types and fields (no behavior change)
2. Phase 2: New runs populate findings
3. Phase 3: Backfill existing runs (optional)
4. Phase 4: UI updates to use findings

### Airtable Setup Required

1. Add new fields to `Diagnostic Details` table
2. Create linked record relationship to `Diagnostic Runs`
3. Create linked record relationship to `Companies`
4. Add Single Select options for Category, Severity, Lab Slug
