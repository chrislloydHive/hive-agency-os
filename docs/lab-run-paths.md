# Lab Run Code Paths

This document maps all Lab implementations and their current storage patterns.

## Summary

| Lab | API Endpoint | Tool ID | Writes to Diagnostic Runs | Writes to Diagnostic Details | Inngest |
|-----|--------------|---------|---------------------------|------------------------------|---------|
| Website Lab | `/api/os/diagnostics/run/website-lab` | `websiteLab` | ✅ Yes | ✅ Yes (via postRunHooks) | No |
| Brand Lab | `/api/os/diagnostics/run/brand-lab` | `brandLab` | ✅ Yes | ✅ Yes (via postRunHooks) | Yes |
| SEO Lab | `/api/os/diagnostics/run/seo-lab` | `seoLab` | ✅ Yes | ✅ Yes (via postRunHooks) | No |
| Content Lab | `/api/os/diagnostics/run/content-lab` | `contentLab` | ✅ Yes | ✅ Yes (via postRunHooks) | No |
| Demand Lab | `/api/os/diagnostics/run/demand-lab` | `demandLab` | ✅ Yes | ✅ Yes (via postRunHooks) | No |
| Ops Lab | `/api/os/diagnostics/run/ops-lab` | `opsLab` | ✅ Yes | ✅ Yes (via postRunHooks) | No |

---

## Detailed Lab Paths

### Website Lab

**API Route**: `app/api/os/diagnostics/run/website-lab/route.ts`
**Engine**: `lib/os/diagnostics/engines.ts` → `runWebsiteLabEngine()`
**Inngest**: No (synchronous)

**Current Storage**:
- ✅ Creates record in `Diagnostic Runs` via `createDiagnosticRun()`
- ✅ Updates with `rawJson` containing full JSON payload
- ✅ Calls `processDiagnosticRunCompletionAsync()` for post-hooks
- ✅ Extracts findings via `extractWebsiteLabFindings()` in postRunHooks
- ✅ Saves findings to `Diagnostic Details` via `saveDiagnosticFindings()`

**JSON Structure**:
```typescript
{
  siteAssessment: {
    overallScore: number,
    dimensions: [...],
    issues: [{ title, severity, dimension, location, ... }],
    quickWins: [...],
    criticalIssues: [...],
    pageAssessments: [...]
  }
}
```

---

### Brand Lab

**API Route**: `app/api/os/diagnostics/run/brand-lab/route.ts`
**Inngest Function**: `lib/inngest/functions/brand-diagnostic.ts`
**Engine**: `lib/gap-heavy/modules/brandLabImpl.ts` → `runBrandLab()`

**Current Storage**:
- ✅ Creates record in `Diagnostic Runs` via `createDiagnosticRun()`
- ✅ Updates with `rawJson` containing full JSON payload
- ✅ Calls `processDiagnosticRunCompletionAsync()` for post-hooks
- ✅ Also writes to Heavy GAP Run evidencePack (backward compat)
- ✅ Extracts findings via `extractBrandLabFindings()` in postRunHooks
- ✅ Saves findings to `Diagnostic Details` via `saveDiagnosticFindings()`

**JSON Structure**:
```typescript
{
  overallScore: number,
  maturityStage: string,
  dimensions: [...],
  diagnostic: {
    score: number,
    issues: [{ title, severity, dimension, ... }],
    gaps: [...]
  },
  quickWins: [...],
  projects: [...]
}
```

---

### SEO Lab

**API Route**: `app/api/os/diagnostics/run/seo-lab/route.ts`
**Engine**: `lib/os/diagnostics/engines.ts` → `runSeoLabEngine()`
**Inngest**: No (synchronous)

**Current Storage**:
- ✅ Creates record in `Diagnostic Runs` via `createDiagnosticRun()`
- ✅ Updates with `rawJson` containing full report
- ✅ Calls `processDiagnosticRunCompletionAsync()` for post-hooks
- ✅ Extracts findings via `extractSeoLabFindings()` in postRunHooks
- ✅ Saves findings to `Diagnostic Details` via `saveDiagnosticFindings()`

**JSON Structure**:
```typescript
{
  score: number,
  issues: [{ title, severity, type, url, ... }],
  quickWins: [...],
  technicalIssues: [...],
  contentIssues: [...]
}
```

---

### Content Lab

**API Route**: `app/api/os/diagnostics/run/content-lab/route.ts`
**Engine**: `lib/diagnostics/content-lab/index.ts` → `runContentLabEngine()`
**Inngest**: No (synchronous)

**Current Storage**:
- ✅ Creates record in `Diagnostic Runs` via `createDiagnosticRun()`
- ✅ Updates with `rawJson` containing full report
- ✅ Calls `processDiagnosticRunCompletionAsync()` for post-hooks
- ✅ Extracts findings via `extractContentLabFindings()` in postRunHooks
- ✅ Saves findings to `Diagnostic Details` via `saveDiagnosticFindings()`

**JSON Structure**:
```typescript
{
  score: number,
  issues: [{ title, severity, dimension, ... }],
  quickWins: [...],
  findings: {
    topics: [...],
    gaps: [...]
  }
}
```

---

### Demand Lab

**API Route**: `app/api/os/diagnostics/run/demand-lab/route.ts`
**Engine**: `lib/diagnostics/demand-lab/index.ts` → `runDemandLabEngine()`
**Inngest**: No (synchronous)

**Current Storage**:
- ✅ Creates record in `Diagnostic Runs` via `createDiagnosticRun()`
- ✅ Updates with `rawJson` containing full report
- ✅ Calls `processDiagnosticRunCompletionAsync()` for post-hooks
- ✅ Extracts findings via `extractDemandLabFindings()` in postRunHooks
- ✅ Saves findings to `Diagnostic Details` via `saveDiagnosticFindings()`

**JSON Structure** (DemandLabResult):
```typescript
{
  overallScore: number,
  maturityStage: 'unproven' | 'emerging' | 'scaling' | 'established',
  dataConfidence: { score, level, reason },
  narrativeSummary: string,
  dimensions: [{
    key: 'channelMix' | 'targeting' | 'creative' | 'funnel' | 'measurement',
    label: string, score: number, status, summary,
    issues: [{ id, category, severity, title, description }]
  }],
  issues: [{ id, category, severity, title, description }],
  quickWins: [...],
  projects: [...]
}
```

---

### Ops Lab

**API Route**: `app/api/os/diagnostics/run/ops-lab/route.ts`
**Engine**: `lib/diagnostics/ops-lab/index.ts` → `runOpsLabEngine()`
**Inngest**: No (synchronous)

**Current Storage**:
- ✅ Creates record in `Diagnostic Runs` via `createDiagnosticRun()`
- ✅ Updates with `rawJson` containing full report
- ✅ Calls `processDiagnosticRunCompletionAsync()` for post-hooks
- ✅ Extracts findings via `extractOpsLabFindings()` in postRunHooks
- ✅ Saves findings to `Diagnostic Details` via `saveDiagnosticFindings()`

**JSON Structure** (OpsLabResult):
```typescript
{
  overallScore: number,
  maturityStage: 'unproven' | 'emerging' | 'scaling' | 'established',
  dataConfidence: { score, level, reason },
  narrativeSummary: string,
  dimensions: [{
    key: 'tracking' | 'data' | 'crm' | 'automation' | 'experimentation',
    label: string, score: number, status, summary,
    issues: [{ id, category, severity, title, description }]
  }],
  issues: [{ id, category, severity, title, description }],
  quickWins: [...],
  projects: [...]
}
```

---

## Labs NOT Using Diagnostic Runs (Strategic Labs)

These Labs store durable objects, not diagnostic runs:

### Media Lab
- **Tables**: `MediaPlans`, `MediaPlanChannels`, `MediaPlanFlights`
- **Status**: Strategic planning tool, NOT a diagnostic
- **Action**: May optionally create summary Diagnostic Run when plan is finalized

### Audience Lab
- **Tables**: `AudienceModels`, `AudiencePersonas`
- **Status**: Strategic planning tool, NOT a diagnostic
- **Action**: May optionally create summary Diagnostic Run

### Analytics Lab
- **Tables**: None (live data only)
- **Status**: Route-based tool that opens Analytics page
- **Action**: No changes needed

---

## Implementation Status

### ✅ Completed Implementation

The findings extraction pipeline is now fully implemented:

1. **`lib/airtable/diagnosticDetails.ts`** - Full CRUD for Diagnostic Details table
   - `saveDiagnosticFindings()` - Batch saves findings to Airtable
   - `getDiagnosticFindingsByRunId()` - Query findings by run
   - `getDiagnosticFindingsForCompany()` - Query findings by company
   - `updateDiagnosticFinding()` - Update individual findings

2. **`lib/os/diagnostics/findingsExtractors.ts`** - Lab-specific extractors
   - `extractWebsiteLabFindings()` - Extract from Website Lab JSON
   - `extractBrandLabFindings()` - Extract from Brand Lab JSON
   - `extractSeoLabFindings()` - Extract from SEO Lab JSON
   - `extractContentLabFindings()` - Extract from Content Lab JSON
   - `extractDemandLabFindings()` - Extract from Demand Lab JSON
   - `extractOpsLabFindings()` - Extract from Ops Lab JSON
   - `extractFindingsForLab()` - Unified extractor dispatcher

3. **`lib/os/diagnostics/postRunHooks.ts`** - Centralized post-run processing
   - Step 6: `extractAndSaveFindings()` - Extracts and saves findings to Diagnostic Details
   - Automatically triggered after any Lab completes via `processDiagnosticRunCompletionAsync()`

### ✅ All Labs Now Have Extractors

All diagnostic Labs now extract findings to Diagnostic Details:
- Website Lab, Brand Lab, SEO Lab, Content Lab, Demand Lab, Ops Lab
