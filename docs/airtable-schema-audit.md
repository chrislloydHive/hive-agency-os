# Airtable Schema Audit

Generated: 2025-12-07

This document provides a comprehensive audit of Airtable table usage in the Hive OS codebase. Table usage is determined **exclusively by code references**, not by record counts.

---

## Table of Contents
1. [Table Usage Summary](#table-usage-summary)
2. [Detailed Table Analysis](#detailed-table-analysis)
3. [DMA → Inbound Leads → Companies Flow](#dma--inbound-leads--companies-flow)
4. [Lead Importer Process Sketch](#lead-importer-process-sketch)
5. [Legacy Table Candidates](#legacy-table-candidates)

---

## Table Usage Summary

| Table Name | Status | Usage Level | Primary Files |
|------------|--------|-------------|---------------|
| `GAP-IA Run` | **System Critical** | Heavily used | `lib/airtable/gapIaRuns.ts`, `lib/airtable/linkGapRuns.ts`, `lib/inngest/functions/generate-full-gap.ts` |
| `Inbound Leads` | **Used** | Limited but functional | `lib/airtable/inboundLeads.ts`, `app/api/inbound/ingest/route.ts` |
| `WorkspaceSettings` | **System Critical** | Heavily used | `lib/os/workspaceSettings.ts`, OAuth integration clients |
| `A-Lead Tracker` (Opportunities) | **Used** | Limited (pipeline) | `lib/airtable/opportunities.ts` |
| `CRM` (as table name) | **Candidate Legacy** | No direct table references | N/A |
| `Companies` | **System Critical** | Heavily used | `lib/airtable/companies.ts` |

---

## Detailed Table Analysis

### 1. GAP-IA Run

**Table Name:** `GAP-IA Run`
**Status:** System Critical
**Defined in:** `lib/airtable/tables.ts` line 9

#### Code References:
- **`lib/airtable/gapIaRuns.ts`** - Full CRUD operations (create, get, update, list)
  - `createGapIaRun()` - Creates new GAP-IA runs
  - `getGapIaRunById()` - Fetches by Airtable record ID
  - `updateGapIaRun()` - Updates run data including core marketing context
  - `listRecentGapIaRuns()` - Lists recent runs for dashboard
  - `getGapIaRunByUrl()` - Finds runs by normalized URL (caching)
  - `getGapIaRunsForCompany()` - Fetches runs linked to a company
  - `getGapIaRunsForCompanyOrDomain()` - Fetches by company ID or domain matching

- **`lib/airtable/linkGapRuns.ts`** - Links GAP runs to companies
  - `linkGapIaRuns()` - Links GAP-IA runs by domain matching

- **`lib/airtable/inboundLeads.ts`** - References GAP-IA Run as linked record
  - Maps `GAP-IA Run` linked record field to `gapIaRunId`

- **`lib/inngest/functions/generate-full-gap.ts`** - Background job integration
  - References GAP-IA Run in job metadata
  - Loads and updates GAP-IA runs during full GAP generation

- **`lib/os/diagnostics/runs.ts`** - Legacy GAP-IA run fetching
  - Fetches GAP-IA runs for backwards compatibility with gapSnapshot

- **`app/api/gap/lookup/route.ts`** - API route
  - Falls back to GAP-IA Run table for lookups

- **`components/os/CompanyBrainPage.tsx`** - UI component
  - Displays GAP IA Runs in company brain view

**Verdict:** This table is actively used throughout the system for lead magnet assessments, company diagnostics, and the GAP pipeline. **Do NOT deprecate.**

---

### 2. Inbound Leads

**Table Name:** `Inbound Leads`
**Status:** Used but Limited
**Defined in:** `lib/airtable/inboundLeads.ts` line 7 (via env var or default)

#### Code References:
- **`lib/airtable/inboundLeads.ts`** - Full CRUD operations
  - `getAllInboundLeads()` - Fetches all leads
  - `getInboundLeadById()` - Fetches single lead
  - `updateLeadAssignee()` - Updates lead assignee
  - `updateLeadStatus()` - Updates lead status
  - `createInboundLead()` - Creates new lead
  - `linkLeadToCompany()` - Links lead to company record

- **`app/api/inbound/ingest/route.ts`** - Lead ingestion API
  - Creates leads, matches/creates companies, routes leads, triggers GAP IA

- **`lib/os/analytics/dmaIntegration.ts`** - DMA funnel integration
  - Counts DMA leads within a period

- **`lib/pipeline/createOrMatchCompany.ts`** - Company matching
  - Uses `InboundLeadItem` type for lead processing

- **`lib/pipeline/kpis.ts`** - Pipeline KPIs
  - Likely aggregates lead data

- **`app/pipeline/leads/`** - Pipeline leads UI
  - `page.tsx`, `LeadsClient.tsx` - Display leads

- **`lib/types/pipeline.ts`** - Type definitions
  - `InboundLeadItem` interface
  - `LEAD_SOURCES` includes 'DMA'

**Verdict:** This table is used for the lead pipeline but could benefit from enhanced fields for DMA integration. **Do NOT deprecate.**

---

### 3. WorkspaceSettings

**Table Name:** `WorkspaceSettings`
**Status:** System Critical
**Defined in:** `lib/airtable/tables.ts` line 26

#### Code References:
- **`lib/os/workspaceSettings.ts`** - Primary module
  - `getWorkspaceSettings()` - Fetches workspace settings with caching
  - `updateWorkspaceSettings()` - Updates OAuth tokens and config
  - `isGa4Connected()` - Checks GA4 integration status
  - `isGscConnected()` - Checks GSC integration status
  - `disconnectGa4()` - Disconnects GA4
  - `disconnectGsc()` - Disconnects GSC

- **`lib/os/integrations/gscClient.ts`** - GSC OAuth client
  - Uses `getWorkspaceSettings()` for OAuth tokens

- **`lib/os/integrations/ga4Client.ts`** - GA4 OAuth client
  - Uses `getWorkspaceSettings()` for OAuth tokens

- **`lib/os/analytics/gsc.ts`** - GSC analytics
  - References WorkspaceSettings for OAuth

- **`lib/os/analytics/ga4.ts`** - GA4 analytics
  - References WorkspaceSettings for OAuth

- **`app/api/integrations/gsc/oauth/callback/route.ts`** - OAuth callback
  - Calls `updateWorkspaceSettings()` to store tokens

- **`lib/integrations/*.ts`** - Integration status checks
  - Multiple files reference WorkspaceSettings in TODO comments

**Verdict:** This table stores OAuth credentials and workspace configuration. **Do NOT deprecate.**

---

### 4. A-Lead Tracker (Opportunities)

**Table Name:** `A-Lead Tracker`
**Status:** Used (Limited)
**Defined in:** `lib/airtable/opportunities.ts` line 8 (via env var or default)

#### Code References:
- **`lib/airtable/opportunities.ts`** - Full CRUD operations
  - `getAllOpportunities()` - Fetches all opportunities
  - `getOpportunityById()` - Fetches single opportunity
  - `updateOpportunityStage()` - Updates pipeline stage
  - `updateOpportunityScore()` - Updates AI-derived score
  - `createOpportunity()` - Creates new opportunity

- **`app/pipeline/opportunities/[id]/page.tsx`** - Opportunity detail page
  - Uses `base('Opportunities').find(id)` - Note: Uses 'Opportunities' alias

**Notes:**
- The table is referenced as `A-Lead Tracker` in the code but conceptually maps to "Opportunities"
- Used for sales pipeline tracking with stages: Discovery, Qualification, Proposal, Negotiation, Won, Lost
- Includes CRM-style fields (industry, companyType, sizeBand, icpFitScore, leadScore)

**Verdict:** This table is used for pipeline/opportunity tracking. **Do NOT deprecate.**

---

### 5. CRM (as Table Name)

**Table Name:** `CRM`
**Status:** Candidate Legacy
**No direct table definition found**

#### Code References Analysis:

The string "CRM" appears in the codebase but **NOT as an Airtable table name**:

1. **Comment/Documentation references:**
   - `lib/airtable/companies.ts:4` - "Companies is a lean identity + CRM table"
   - `app/companies/page.tsx:2` - "Companies Directory Page - OS CRM Index"
   - `lib/os/types.ts:20` - "Companies is a lean identity + CRM table"

2. **Field/concept references (not table):**
   - `lib/types/pipeline.ts:26` - "// From CRM, if available:"
   - `lib/airtable/opportunities.ts:44` - "// CRM fields if available via lookup"
   - `lib/media/diagnosticsInputs.ts:253` - "CRM integration notes" (field)
   - `lib/media/planningInput.ts:758` - `crmAndLeadFlow: 'CRM & Lead Flow'` (label)

3. **Diagnostic dimension references:**
   - `lib/diagnostics/ops-lab/index.ts:227` - `'CRM'` in diagnostics dimensions
   - `app/c/[companyId]/diagnostics/ops/page.tsx:524` - `crm: 'CRM'` label mapping

4. **Context graph source labels:**
   - `lib/media/buildMediaInputsFromContextGraph.ts:433` - `airtable: 'CRM Data'`
   - `lib/contextGraph/prefill.ts:220` - `airtable: 'CRM Data'`

**No references found to:**
- `base('CRM')`
- `getTable('CRM')`
- `AIRTABLE_TABLES.CRM`
- Any direct Airtable table operations on "CRM"

**Verdict:** "CRM" is used as a **concept label** and in documentation, but there is no Airtable table named "CRM" being accessed by the code. If such a table exists in Airtable, it is **Candidate Legacy**. Recommend renaming to "(LEGACY - not used in code)" in Airtable and hiding from views.

---

### 6. Companies

**Table Name:** `Companies`
**Status:** System Critical
**Defined in:** `lib/airtable/tables.ts` line 15

#### Code References:
- **`lib/airtable/companies.ts`** - Full CRUD operations
  - `getCompanyById()` - Fetches by Airtable record ID
  - `getAllCompanies()` - Fetches all companies
  - `listCompaniesForOs()` - Lists for dashboard
  - `updateCompanyMeta()` - Updates metadata fields
  - `updateCompanyAnalyticsBlueprint()` - Updates analytics config
  - `findOrCreateCompanyByDomain()` - Master deduplication function
  - `findCompanyByDomain()` - Domain lookup
  - `findCompanyByName()` - Name lookup (exact/fuzzy)
  - `createCompany()` - Creates new company
  - `updateCompany()` - Updates company fields
  - `getCompanyByCanonicalId()` - Fetches by UUID

- Extensively used throughout the OS for company identity and CRM data.

**Verdict:** Core table for the entire system. **Do NOT deprecate.**

---

## DMA → Inbound Leads → Companies Flow

### Current State Analysis

#### DMA Lead Capture
The codebase has infrastructure for DMA integration but the flow is not fully connected:

1. **DMA Analytics Integration (`lib/os/analytics/dmaIntegration.ts`)**
   - Fetches DMA funnel metrics from GA4 (`getAuditFunnelSnapshot`)
   - Counts DMA-sourced leads from Inbound Leads table
   - Computes risks and opportunities from funnel data
   - **Note:** This reads analytics data but does NOT write leads

2. **Lead Source Support (`lib/types/pipeline.ts`)**
   - `LEAD_SOURCES` includes `'DMA'`
   - Type system supports DMA as a lead source

3. **Lead Ingestion API (`app/api/inbound/ingest/route.ts`)**
   - Generic lead ingestion endpoint
   - Accepts: name, email, website, companyName, source, notes
   - Creates `Inbound Leads` record
   - Matches or creates `Companies` record
   - Routes lead to owner
   - Optionally triggers GAP IA snapshot
   - **This is the integration point for DMA leads**

4. **Company Creation from Leads (`lib/pipeline/createOrMatchCompany.ts`)**
   - `createOrMatchCompanyFromInboundLead()` - Smart company matching
   - `mapLeadSourceToCompanySource()` - Maps DMA source to 'Inbound'

#### Missing Pieces for Full DMA Integration

1. **No direct webhook/API from DMA app to OS**
   - The DMA app (digitalmarketingaudit.ai) needs to POST to `/api/inbound/ingest`
   - Or a webhook receiver needs to be created

2. **Field Gaps in Inbound Leads**
   - Current: name, email, website, companyName, leadSource, status, assignee, notes, companyId, gapIaRunId
   - Missing for DMA: `dmaAuditId`, `normalizedDomain`, UTM fields, `importStatus`, `importedAt`, `analysisStatus`

3. **Field Gaps in Companies**
   - Current: has `stage`, `source`, `domain`
   - Could add: `isFromDMA`, `firstLeadSource`, `firstLeadAt`

---

## Lead Importer Process Sketch

### Proposed DMA → Inbound Leads → Companies Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DMA (digitalmarketingaudit.ai)                  │
│                                                                      │
│  User submits audit → Audit completes → Webhook fires               │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    POST /api/inbound/ingest                          │
│                    (or new /api/dma/webhook)                         │
│                                                                      │
│  Payload:                                                            │
│  {                                                                   │
│    name: "John Doe",                                                 │
│    email: "john@example.com",                                        │
│    website: "https://example.com",                                   │
│    companyName: "Example Inc",                                       │
│    source: "DMA",                                                    │
│    dmaAuditId: "dma_abc123",  // NEW                                 │
│    utm_source: "google",      // NEW                                 │
│    utm_medium: "cpc",         // NEW                                 │
│    utm_campaign: "audit"      // NEW                                 │
│  }                                                                   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Step 1: Create Inbound Lead                       │
│                                                                      │
│  Record in `Inbound Leads`:                                          │
│  - Name, Email, Website, Company Name                                │
│  - Lead Source = "DMA"                                               │
│  - Status = "New"                                                    │
│  - Normalized Domain = "example.com"                                 │
│  - DMA Audit ID = "dma_abc123" (linked record or text)               │
│  - Import Status = "Not imported"                                    │
│  - UTM Source, UTM Medium, UTM Campaign                              │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Step 2: Match or Create Company                   │
│                                                                      │
│  1. Normalize domain from website                                    │
│  2. Search Companies by primaryDomain                                │
│  3. If found → link lead to existing company                         │
│  4. If not found → create new Company:                               │
│     - Stage = "Prospect"                                             │
│     - Source = "Inbound" (or new "DMA" option)                       │
│     - Primary Domain = normalized domain                             │
│     - Is From DMA = true  // NEW field                               │
│     - First Lead Source = "DMA"                                      │
│     - First Lead At = now()                                          │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Step 3: Link Lead to Company                      │
│                                                                      │
│  Update Inbound Lead:                                                │
│  - Company = [company.id] (linked record)                            │
│  - Import Status = "Imported"                                        │
│  - Imported At = now()                                               │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Step 4: Link to Analysis (Optional)               │
│                                                                      │
│  If GAP-IA Run exists for domain:                                    │
│  - Find GAP-IA Run by domain matching                                │
│  - Link to Inbound Lead (gapIaRunId)                                 │
│  - Update Analysis Status = "Has Analysis"                           │
│                                                                      │
│  Or trigger new GAP IA Snapshot:                                     │
│  - POST /api/os/diagnostics/run/gap-snapshot                         │
│  - Link resulting run to lead and company                            │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Step 5: Route Lead                                │
│                                                                      │
│  Apply routing rules from lib/pipeline/routingConfig.ts              │
│  - Match by industry, company type, size band, lead source           │
│  - Assign to owner                                                   │
│  - Update Lead Status                                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Existing Code That Supports This Flow

| Step | Existing Code | Status |
|------|---------------|--------|
| Ingest endpoint | `app/api/inbound/ingest/route.ts` | ✅ Exists |
| Create lead | `lib/airtable/inboundLeads.ts` → `createInboundLead()` | ✅ Exists |
| Match/create company | `lib/pipeline/createOrMatchCompany.ts` → `createOrMatchCompanyFromInboundLead()` | ✅ Exists |
| Link lead to company | `lib/airtable/inboundLeads.ts` → `linkLeadToCompany()` | ✅ Exists |
| Trigger GAP IA | `POST /api/os/diagnostics/run/gap-snapshot` | ✅ Exists |
| Route lead | `lib/pipeline/routingConfig.ts` → `matchLeadToRule()` | ✅ Exists |

### What Needs to Be Added

1. **DMA-specific fields in `InboundLeadItem` type** (see Phase 3)
2. **DMA-specific fields in `CompanyRecord` type** (see Phase 3)
3. **Optional: Dedicated DMA webhook endpoint** (`/api/dma/webhook`)
4. **Optional: Batch lead importer** for processing `importStatus = "Not imported"` leads

---

## Legacy Table Candidates

Based on **code reference analysis only** (not record counts):

### Confirmed Legacy (No Code References)

| Table Name | Evidence | Recommendation |
|------------|----------|----------------|
| `CRM` | No `base('CRM')` calls, no table constant defined | Rename to "(LEGACY - CRM - not used in code)" and hide from views |

### Potentially Unused (Needs Verification)

These tables may exist in Airtable but have no obvious code references. Verify before marking as legacy:

- Any table not listed in `lib/airtable/tables.ts`
- Tables that only appear in old migration scripts

### NOT Legacy (Confirmed Used)

| Table Name | Reason |
|------------|--------|
| `GAP-IA Run` | Heavily used for lead magnet assessments |
| `Inbound Leads` | Used for lead pipeline |
| `WorkspaceSettings` | Used for OAuth credentials |
| `A-Lead Tracker` | Used for opportunity pipeline |
| `Companies` | Core identity table |
| All tables in `lib/airtable/tables.ts` | Defined and actively used |

---

## Appendix: Tables Defined in Code

From `lib/airtable/tables.ts`:

```typescript
export const AIRTABLE_TABLES = {
  // GAP System Tables
  GAP_IA_RUN: 'GAP-IA Run',
  GAP_PLAN_RUN: 'GAP-Plan Run',
  GAP_FULL_REPORT: 'GAP-Full Report',
  GAP_HEAVY_RUN: 'GAP-Heavy Run',

  // OS System Tables
  COMPANIES: 'Companies',
  WORK_ITEMS: 'Work Items',
  COMPANY_AI_CONTEXT: 'Company AI Context',
  DIAGNOSTIC_RUNS: 'Diagnostic Runs',

  // Client Brain Tables
  CLIENT_INSIGHTS: 'Client Insights',
  CLIENT_DOCUMENTS: 'Client Documents',
  COMPANY_STRATEGY_SNAPSHOTS: 'Company Strategy Snapshots',

  // Workspace Settings
  WORKSPACE_SETTINGS: 'WorkspaceSettings',

  // Media System Tables
  MEDIA_PROGRAMS: 'Media Programs',
  MEDIA_CAMPAIGNS: 'Media Campaigns',
  MEDIA_MARKETS: 'Media Markets',
  MEDIA_STORES: 'Media Stores',
  MEDIA_PERFORMANCE: 'Media Performance',

  // Media Lab Tables
  MEDIA_PLANS: 'MediaPlans',
  MEDIA_PLAN_CHANNELS: 'MediaPlanChannels',
  MEDIA_PLAN_FLIGHTS: 'MediaPlanFlights',
  MEDIA_SCENARIOS: 'MediaScenarios',
  MEDIA_PROFILES: 'MediaProfiles',

  // Context Graph
  CONTEXT_GRAPHS: 'ContextGraphs',
  CONTEXT_GRAPH_VERSIONS: 'ContextGraphVersions',

  // QBR Stories
  QBR_STORIES: 'QBR Stories',

  // Audience Lab
  AUDIENCE_MODELS: 'AudienceModels',
  AUDIENCE_PERSONAS: 'AudiencePersonas',

  // Competition Lab
  COMPETITION_RUNS: 'Competition Runs',
};
```

Additional tables defined separately:
- `Inbound Leads` (via env var in `lib/airtable/inboundLeads.ts`)
- `A-Lead Tracker` / `Opportunities` (via env var in `lib/airtable/opportunities.ts`)
- `Full Reports` (via env var in `lib/airtable/companies.ts`)
