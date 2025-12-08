# Global Findings Dashboard

Cross-company view of diagnostic findings in Hive OS.

## Overview

The Global Findings Dashboard answers questions like:
- Where are the biggest problems right now?
- Which companies have the highest number of critical/high issues?
- Which Labs are producing the most severe findings?
- Which issues still haven't been converted to Work Items?

## Access

Navigate to **Findings** in the main sidebar, or go directly to `/findings`.

## Architecture

### Backend

**Service: `lib/os/findings/globalFindings.ts`**

| Function | Description |
|----------|-------------|
| `getGlobalFindings(filters)` | Fetch findings across all companies with optional filtering |
| `getGlobalFindingsSummary(filters)` | Get aggregate counts by severity, lab, category + top companies |
| `getGlobalFindingsWithSummary(filters)` | Combined call for both findings and summary |
| `getCompaniesForFilter()` | Get all companies for filter dropdown |

**Filter Options:**
```typescript
interface GlobalFindingsFilter {
  companyIds?: string[];      // Filter by specific companies
  labs?: string[];            // Filter by lab slug (website, brand, seo, etc.)
  severities?: string[];      // Filter by severity (critical, high, medium, low)
  categories?: string[];      // Filter by category (Technical, UX, Brand, etc.)
  converted?: 'all' | 'converted' | 'not_converted';
  since?: Date;               // Filter by created date
  limit?: number;             // Max results (default 200)
}
```

**API: `GET /api/os/findings/global`**

Query parameters:
- `companyIds` or `company`: Comma-separated company IDs
- `labs` or `lab`: Comma-separated lab slugs
- `severities` or `severity`: Comma-separated severities
- `categories` or `category`: Comma-separated categories
- `converted`: `all` | `converted` | `not_converted`
- `timeRange`: `7d` | `30d` | `90d` | `all`
- `since`: ISO date string
- `limit`: Max findings to return (default 200, max 500)

Response:
```json
{
  "success": true,
  "findings": [...],
  "summary": {
    "total": 150,
    "bySeverity": { "critical": 5, "high": 20, "medium": 80, "low": 45 },
    "byLab": { "website": 50, "seo": 40, "brand": 30, ... },
    "byCategory": { "Technical": 60, "UX": 40, ... },
    "converted": 30,
    "unconverted": 120,
    "topCompanies": [
      { "companyId": "...", "companyName": "Acme Corp", "critical": 3, "high": 10, ... }
    ],
    "companyCount": 25
  },
  "filterOptions": { ... },
  "count": 150
}
```

### Frontend

**Route: `/findings` → `app/findings/page.tsx`**

**Client Component: `GlobalFindingsClient.tsx`**

Components:
1. **SummaryStrip** - Total count, severity badges, lab badges, conversion status
2. **Filters** - Time range, lab, severity, category, company search, converted toggle
3. **TopCompaniesLeaderboard** - Companies with most critical/high findings
4. **FindingsTable** - Sortable table with severity, lab, company, description
5. **FindingDetailDrawer** - Full details with convert-to-work-item action

## Data Flow

```
Labs Run → postRunHooks.ts (extractAndSaveFindings)
              ↓
    Diagnostic Details (Airtable)
              ↓
    globalFindings.ts (queries all findings)
              ↓
    /api/os/findings/global
              ↓
    GlobalFindingsClient (React)
```

## Supported Labs

The system extracts findings from all diagnostic Labs:

| Lab | labSlug | Extractor | Categories |
|-----|---------|-----------|------------|
| Website Lab | `website` | `extractWebsiteLabFindings()` | Technical, UX, SEO, Content, Brand |
| Brand Lab | `brand` | `extractBrandLabFindings()` | Brand |
| SEO Lab | `seo` | `extractSeoLabFindings()` | SEO |
| Content Lab | `content` | `extractContentLabFindings()` | Content |
| Demand Lab | `demand` | `extractDemandLabFindings()` | Demand |
| Ops Lab | `ops` | `extractOpsLabFindings()` | Ops |
| GAP-IA | `gap` | `extractGapIaFindings()` | Brand, Content, SEO, UX |
| GAP Plan | `gap-plan` | `extractGapPlanFindings()` | Brand, Content, SEO, UX |

## Time-Series Fields

Findings track timestamps for analytics:

| Field | Description |
|-------|-------------|
| `createdAt` | Auto-set by Airtable when finding is created |
| `updatedAt` | Auto-set by Airtable on any update |
| `resolvedAt` | Set when finding is converted to work item or marked resolved |

## Converting Findings to Work Items

Users can convert any finding to a Work Item directly from the dashboard:

1. Click a finding row to open the detail drawer
2. Click "Convert to Work Item"
3. The system creates a Work Item with:
   - Title: `[Category/Dimension] Description...`
   - Description: Issue description + recommendation + metadata
   - Area: Mapped from finding category
   - Priority: Mapped from severity (critical/high → high, etc.)
   - Status: Backlog
   - Source: Diagnostic Finding (lab slug)

The finding is then marked as converted, `resolvedAt` is set, and linked to the work item.

## QBR Integration

The findings system integrates with QBR (Quarterly Business Review) reports.

**Service: `lib/os/qbr/qbrFindings.ts`**

| Function | Description |
|----------|-------------|
| `getTopFindingsForQBR(companyId)` | Get top critical/high findings for QBR |
| `getQbrFindingsSummary(companyId)` | Get summary stats for QBR dashboard |
| `getQbrFocusAreas(companyId)` | Get focus areas derived from findings |
| `getQbrFindingsData(companyId)` | Get complete QBR data with narrative blocks |

**QBR Narrative Blocks:**
- `keyIssues` - "Top Issues" section highlighting critical problems
- `whereToFocus` - "Recommended Focus Areas" by category
- `progressSummary` - Conversion rate and progress metrics

## GAP Integration

GAP-IA and GAP-Plan runs automatically extract findings:

**GAP-IA Sources:**
- `dimensions.*.issues` - Issues from each dimension (brand, content, seo, website)
- `breakdown.bullets` - Diagnostic breakdown items
- `quickWins.bullets` - Quick win opportunities (lower severity)

**GAP-Plan Sources:**
- `priorities.items` - Strategic priorities
- `plan.initiatives` - Planned initiatives

## Performance

- Default limit: 200 findings
- Summary caps at 1000 findings for aggregation
- Company name map cached for 1 minute
- Filters applied at Airtable query level when possible

## Related Files

| Path | Purpose |
|------|---------|
| `lib/os/findings/globalFindings.ts` | Global findings service |
| `lib/os/findings/companyFindings.ts` | Per-company findings service |
| `lib/os/qbr/qbrFindings.ts` | QBR integration helpers |
| `lib/airtable/diagnosticDetails.ts` | Airtable CRUD for findings |
| `lib/os/diagnostics/findingsExtractors.ts` | Extract findings from lab results |
| `lib/os/diagnostics/postRunHooks.ts` | Save findings after lab completion |
| `app/api/os/findings/global/route.ts` | Global API endpoint |
| `app/api/os/findings/[findingId]/convert-to-work-item/route.ts` | Convert API |
| `app/findings/page.tsx` | Global dashboard page |
| `app/findings/GlobalFindingsClient.tsx` | Global dashboard client component |
| `app/c/[companyId]/findings/` | Per-company findings view |

---

## QA Checklist

After implementing, verify the following:

### Per-Lab Testing
Run each lab and confirm:
- [ ] Website Lab → Diagnostic Runs row + Diagnostic Details rows
- [ ] Brand Lab → severity mapped, recommendations preserved
- [ ] SEO Lab → findings appear in Findings tab
- [ ] Content Lab → category correctly assigned
- [ ] Demand Lab → dimension mapped (Channel Mix, Targeting, etc.)
- [ ] Ops Lab → dimension mapped (Tracking, Data, CRM, etc.)
- [ ] GAP-IA → extracts from dimensions.issues + breakdown + quickWins
- [ ] GAP Plan → extracts from priorities + initiatives

### Global Dashboard Testing
- [ ] Summary strip shows correct counts by severity
- [ ] Lab badges show correct counts
- [ ] Top Companies leaderboard links work
- [ ] Filters interact correctly (AND logic)
- [ ] Detail drawer opens with full info
- [ ] Convert to Work Item works and updates UI
- [ ] Time range filter works (7d, 30d, 90d, all)
- [ ] Company search/filter works

### QBR Testing
- [ ] `getTopFindingsForQBR()` returns critical/high first
- [ ] `getQbrFocusAreas()` groups by category correctly
- [ ] Narrative blocks generate sensible text
- [ ] QBR Story View shows findings section (when integrated)

### GAP Testing
- [ ] GAP-IA run populates findings in Diagnostic Details
- [ ] GAP-Plan run populates findings
- [ ] Findings appear in company Findings tab
- [ ] Findings appear in global dashboard with `gap` / `gap-plan` lab filter
