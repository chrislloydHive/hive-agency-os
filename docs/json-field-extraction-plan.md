# JSON Field Extraction Plan

This document outlines the plan to extract high-value fields from JSON blobs stored in Airtable tables into first-class Airtable columns for easier querying, sorting, and UI display.

**Core Principle**: JSON remains the source of truth. Extracted fields are additive and optional.

---

## Table of Contents

1. [GAP-Full Report](#1-gap-full-report)
2. [Company Strategy Snapshots](#2-company-strategy-snapshots)
3. [ContextGraphs](#3-contextgraphs)
4. [Company AI Context](#4-company-ai-context)

---

## 1. GAP-Full Report

**Table Name**: `GAP-Full Report`
**Airtable File**: `lib/airtable/gapFullReports.ts`
**Types File**: `lib/diagnostics/types.ts`, `lib/gap/types.ts`

### Current JSON Fields

| Field Name | Structure Summary |
|------------|-------------------|
| `Scores JSON` | `{ overallScore: number, pillarScores: PillarScore[] }` |
| `Diagnostics JSON` | `{ issuesByPillar: Record<Pillar, Issue[]>, summary?: string, commentary?: string }` |
| `Priorities JSON` | `Priority[]` with `id, title, description, pillar, impact, effort, rationale` |
| `Plan JSON` | `{ phases?, initiatives?, overallTheme?, narrativeSummary? }` (PlanPayload) |
| `Evidence JSON` | `{ metrics?, insights?, lastUpdated? }` (EvidencePayload) |

### Existing Scalar Fields (Already Extracted)

The following fields are **already extracted** to Airtable columns:
- `Overall Score` (number)
- `Brand Score`, `Content Score`, `SEO Score`, `Website UX Score`, `Funnel Score` (numbers)
- `Status` (single select: Critical, Needs Attention, OK)
- `Top Priority Summary` (text)
- `Schema Version` (text)
- `Report Type` (single select)
- `Report Date` (date)

### JSON Keys Actually Used in Code

| Key Path | Used In | Description |
|----------|---------|-------------|
| `scoresJson.overallScore` | `parseGapFullReportToOsResult()` | Overall diagnostic score |
| `scoresJson.pillarScores` | `parseGapFullReportToOsResult()` | Per-pillar scores array |
| `diagnosticsJson.issuesByPillar` | `parseGapFullReportToOsResult()` | Issues grouped by pillar |
| `diagnosticsJson.summary` | `buildDiagnosticsJson()` | Short summary text |
| `priorities[].title` | `buildTopPrioritySummary()` | Priority titles for summary |
| `priorities[].impact` | `buildTopPrioritySummary()` | Impact level filtering |
| `plan.quickWins` | `parseGapFullReportToOsResult()` | Quick win initiatives |
| `plan.strategicInitiatives` | `parseGapFullReportToOsResult()` | Strategic initiatives |
| `evidence.*` | Various display components | Supporting metrics/insights |

### Proposed Extracted Fields

| Field Name | Type | Priority | Maps To | Notes |
|------------|------|----------|---------|-------|
| `Maturity Stage` | Single Select | **core** | `scoresJson.pillarScores` derived | Values: Basic, Developing, Good, Advanced, World-Class |
| `Primary Focus Area` | Single Select | **core** | `priorities[0].pillar` | Brand, Content, SEO, Website, Funnel |
| `Top Issue 1` | Text | **core** | `diagnosticsJson.issuesByPillar.*[0].title` | First critical/high issue |
| `Top Issue 2` | Text | **core** | `diagnosticsJson.issuesByPillar.*[1].title` | Second issue |
| `Top Issue 3` | Text | **core** | `diagnosticsJson.issuesByPillar.*[2].title` | Third issue |
| `Top Initiative 1` | Text | **core** | `priorities[0].title` | Top priority action |
| `Top Initiative 2` | Text | **core** | `priorities[1].title` | Second priority action |
| `Top Initiative 3` | Text | **core** | `priorities[2].title` | Third priority action |
| `Issue Count` | Number | optional | `count(diagnosticsJson.issuesByPillar.*)` | Total issues found |
| `Critical Issue Count` | Number | optional | Filtered count by severity | Issues with severity=high |

---

## 2. Company Strategy Snapshots

**Table Name**: `Company Strategy Snapshots`
**Airtable File**: `lib/airtable/companyStrategySnapshot.ts`
**Writer File**: `lib/os/companies/strategySnapshot.ts`

### Current JSON Fields

| Field Name | Structure Summary |
|------------|-------------------|
| `Key Strengths JSON` | `string[]` - array of strength descriptions |
| `Key Gaps JSON` | `string[]` - array of gap descriptions |
| `Focus Areas JSON` | `string[]` - array of focus area names |
| `Source Tool IDs JSON` | `string[]` - array of diagnostic tool IDs |

### Existing Scalar Fields (Already Extracted)

- `Overall Score` (number)
- `Maturity Stage` (text)
- `90 Day Narrative` (long text)
- `Headline Recommendation` (text)
- `Company ID` (text)
- `Last Diagnostic Run ID` (text)
- `Updated At` (date)

### JSON Keys Actually Used in Code

| Key Path | Used In | Description |
|----------|---------|-------------|
| `keyStrengths[]` | `mapRecordToSnapshot()`, `computeCompanyStrategicSnapshot()` | Top strengths identified |
| `keyGaps[]` | `mapRecordToSnapshot()`, `computeCompanyStrategicSnapshot()` | Top gaps identified |
| `focusAreas[]` | `mapRecordToSnapshot()`, `synthesizeWithAI()` | Priority focus areas |
| `sourceToolIds[]` | `mapRecordToSnapshot()` | Which tools contributed |

### Proposed Extracted Fields

| Field Name | Type | Priority | Maps To | Notes |
|------------|------|----------|---------|-------|
| `Top Strength 1` | Text | **core** | `keyStrengths[0]` | First key strength |
| `Top Strength 2` | Text | **core** | `keyStrengths[1]` | Second key strength |
| `Top Strength 3` | Text | optional | `keyStrengths[2]` | Third key strength |
| `Top Gap 1` | Text | **core** | `keyGaps[0]` | First key gap |
| `Top Gap 2` | Text | **core** | `keyGaps[1]` | Second key gap |
| `Top Gap 3` | Text | optional | `keyGaps[2]` | Third key gap |
| `Primary Focus Area` | Text | **core** | `focusAreas[0]` | Top focus area |
| `Secondary Focus Area` | Text | optional | `focusAreas[1]` | Second focus area |
| `Strength Count` | Number | optional | `keyStrengths.length` | Total strengths identified |
| `Gap Count` | Number | optional | `keyGaps.length` | Total gaps identified |
| `Has Active Plan` | Checkbox | **core** | `narrative90DayPlan.length > 0` | Whether 90-day plan exists |
| `Source Tool Count` | Number | optional | `sourceToolIds.length` | Number of contributing tools |

---

## 3. ContextGraphs

**Table Name**: `ContextGraphs`
**Airtable File**: `lib/contextGraph/storage.ts`
**Types File**: `lib/contextGraph/companyContextGraph.ts`

### Current JSON Fields

| Field Name | Structure Summary |
|------------|-------------------|
| `Graph JSON` | Full `CompanyContextGraph` with 19 domains: identity, brand, objectives, audience, productOffer, digitalInfra, website, content, seo, ops, performanceMedia, historical, creative, competitive, budgetOps, operationalConstraints, storeRisk, historyRefs, social |

### Existing Scalar Fields (Already Extracted)

- `Company ID` (text)
- `Company Name` (text)
- `Version` (text) - schema version
- `Completeness Score` (number) - 0-100
- `Last Updated By` (single select)
- `Created At` (date)
- `Updated At` (date)

### JSON Keys Actually Used in Code

| Key Path | Used In | Description |
|----------|---------|-------------|
| `meta.version` | `saveContextGraph()`, `mapAirtableRecord()` | Schema version |
| `meta.completenessScore` | `saveContextGraph()` | Overall graph completeness |
| `meta.domainCoverage` | `calculateDomainCoverage()` | Per-domain coverage % |
| `meta.lastFusionAt` | `getContextGraphStats()` | Last fusion timestamp |
| `meta.contextInitializedAt` | Various | When baseline was built |
| `identity.businessType` | Various AI prompts | Business type classification |
| `identity.industry` | Various AI prompts | Industry classification |
| `brand.positioning` | Brand Lab, prompts | Brand positioning statement |
| `audience.primarySegments` | Audience Lab | Primary audience segments |
| `competitive.topCompetitors` | Competition Lab | Competitor list |

### Proposed Extracted Fields

| Field Name | Type | Priority | Maps To | Notes |
|------------|------|----------|---------|-------|
| `Node Count` | Number | **core** | Calculated from graph | Total fields with values |
| `Domain Count` | Number | **core** | Count of domains with data | Domains with >0% coverage |
| `Graph Version` | Text | **core** | `meta.version` | Already exists, keep synced |
| `Last Fusion At` | DateTime | **core** | `meta.lastFusionAt` | When last fused |
| `Context Initialized` | Checkbox | **core** | `meta.contextInitializedAt != null` | Whether baseline built |
| `Business Type` | Single Select | **core** | `identity.businessType.value` | b2b_saas, ecommerce, etc. |
| `Industry` | Text | **core** | `identity.industry.value` | Industry classification |
| `Has Competitors` | Checkbox | optional | `competitive.topCompetitors.value.length > 0` | Has competitor data |
| `Competitor Count` | Number | optional | `competitive.topCompetitors.value.length` | Number of competitors |
| `Has Audience Data` | Checkbox | optional | `audience.primarySegments.value.length > 0` | Has audience segments |
| `Identity Coverage` | Number | optional | `meta.domainCoverage.identity` | % of identity domain |
| `Brand Coverage` | Number | optional | `meta.domainCoverage.brand` | % of brand domain |

---

## 4. Company AI Context

**Table Name**: `Company AI Context`
**Airtable File**: `lib/airtable/companyAiContext.ts`

### Current Schema

**Note**: This table does NOT use JSON blobs. It's already properly normalized with scalar fields:

| Field Name | Type | Description |
|------------|------|-------------|
| `Company` | Linked Record | Link to Companies table |
| `Type` | Single Select | GAP IA, GAP Full, Work Item, Analytics Insight, Manual Note, Strategy, Other |
| `Content` | Long Text | The actual content/insight |
| `Source` | Single Select | AI, User, System |
| `Tags` | Multi Select | SEO, Website, Content, Brand, Analytics, Authority, Conversion, Misc |
| `RelatedEntityId` | Text | ID of related entity |
| `CreatedBy` | Text | Who created it |
| `CreatedAt` | DateTime | When created |

### Proposed Extracted Fields

Since this table is already normalized, only minor enhancements are suggested:

| Field Name | Type | Priority | Notes |
|------------|------|----------|-------|
| `Content Preview` | Formula/Text | optional | First 100 chars of Content for list views |
| `Word Count` | Number | optional | Length of content for sorting |
| `Has Related Entity` | Checkbox | optional | `RelatedEntityId != null` |
| `Age Days` | Formula | optional | Days since CreatedAt |

---

## Implementation Priority

### Phase 1: Core Fields (High Value)

1. **GAP-Full Report**: `Maturity Stage`, `Primary Focus Area`, `Top Issue 1-3`, `Top Initiative 1-3`
2. **Strategy Snapshots**: `Top Strength 1-2`, `Top Gap 1-2`, `Primary Focus Area`, `Has Active Plan`
3. **ContextGraphs**: `Business Type`, `Industry`, `Context Initialized`, `Last Fusion At`, `Domain Count`

### Phase 2: Optional Fields (Nice to Have)

1. **GAP-Full Report**: `Issue Count`, `Critical Issue Count`
2. **Strategy Snapshots**: `Top Strength 3`, `Top Gap 3`, counts
3. **ContextGraphs**: Coverage percentages, competitor/audience flags

---

## Extraction Helpers

Each table should have a helper function that extracts fields from JSON:

```typescript
// Example: GAP-Full Report
function extractGapFullReportFields(json: {
  scoresJson?: ScoresJson;
  diagnosticsJson?: DiagnosticsJson;
  prioritiesJson?: Priority[];
}) {
  const issues = flattenIssues(json.diagnosticsJson?.issuesByPillar);
  const criticalIssues = issues.filter(i => i.severity === 'high');

  return {
    maturityStage: deriveMaturityStage(json.scoresJson?.overallScore),
    primaryFocusArea: json.prioritiesJson?.[0]?.pillar ?? undefined,
    topIssue1: criticalIssues[0]?.title ?? undefined,
    topIssue2: criticalIssues[1]?.title ?? undefined,
    topIssue3: criticalIssues[2]?.title ?? undefined,
    topInitiative1: json.prioritiesJson?.[0]?.title ?? undefined,
    topInitiative2: json.prioritiesJson?.[1]?.title ?? undefined,
    topInitiative3: json.prioritiesJson?.[2]?.title ?? undefined,
    issueCount: issues.length,
    criticalIssueCount: criticalIssues.length,
  };
}
```

---

## Migration Notes

- All new fields must be **optional** in TypeScript types
- Writers should populate extracted fields **alongside** JSON (not instead of)
- Readers should prefer extracted fields when present, fall back to JSON parsing
- No existing fields should be removed or renamed
- JSON remains the authoritative source for complex/nested data
