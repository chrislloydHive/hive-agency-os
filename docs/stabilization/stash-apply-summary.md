# Stash Apply Summary

**Branch:** `ui-polish-proposals` (off `trust-foundation`)
**Stash:** `WIP: strategy/labs/qbr/work expansion`
**Applied:** 2025-12-12
**Conflicts:** None

---

## File Counts

| Type | Count |
|------|-------|
| Modified files | 13 |
| Untracked files | 31 |
| **Total changes** | +3,075 / -717 lines |

---

## Top 10 Most-Changed Files (by diffstat)

| File | Changes |
|------|---------|
| `app/c/[companyId]/strategy/StrategyWorkspaceClient.tsx` | +2,411 |
| `components/os/CompanyOverviewPage.tsx` | +794 / -794 (refactor) |
| `lib/os/work.ts` | +137 |
| `app/c/[companyId]/reports/qbr/QBRReportClient.tsx` | +92 |
| `app/c/[companyId]/strategy/page.tsx` | +71 |
| `lib/types/workMvp.ts` | +56 |
| `lib/os/reports/qbrData.ts` | +54 |
| `app/c/[companyId]/work/WorkItemCardWithStatus.tsx` | +54 |
| `app/c/[companyId]/page.tsx` | +53 |
| `lib/types/work.ts` | +48 |

---

## Modified Files (13)

```
app/api/os/companies/[companyId]/qbr/route.ts
app/c/[companyId]/page.tsx
app/c/[companyId]/reports/qbr/QBRReportClient.tsx
app/c/[companyId]/strategy/StrategyWorkspaceClient.tsx
app/c/[companyId]/strategy/page.tsx
app/c/[companyId]/work/WorkItemCardWithStatus.tsx
components/os/CompanyOverviewPage.tsx
components/qbr/index.ts
lib/airtable/tables.ts
lib/os/reports/qbrData.ts
lib/os/work.ts
lib/types/work.ts
lib/types/workMvp.ts
```

---

## Untracked Directories/Files (31)

### API Routes
- `app/api/os/companies/[companyId]/strategy/generate-work/`
- `app/api/os/companies/[companyId]/strategy/ideas/`
- `app/api/os/context/v2/`
- `app/api/os/strategy/v2/`

### UI Components
- `app/c/[companyId]/labs/*/` (AudienceLabClient, CreativeStrategyLabClient, ExecutionLabClient, MediaLabClient)
- `app/c/[companyId]/qbr/strategy/page.tsx`
- `components/automation/index.ts`
- `components/qbr/QBRHighlights.tsx`
- `components/qbr/QBRNextActions.tsx`
- `components/qbr/QBRSection.tsx`
- `components/qbr/QBRStoryHeader.tsx`

### Libraries
- `lib/contextGraph/governance/governedLabWriter.ts`
- `lib/os/automation/`
- `lib/os/briefing/daily/`
- `lib/os/context/strategyImpact.ts`
- `lib/os/contextV2/`
- `lib/os/labs/`
- `lib/os/qbr/`
- `lib/os/strategy/`
- `lib/os/strategyV2/`
- `lib/os/work/`

### Types
- `lib/types/contextV2.ts`
- `lib/types/contextV3.ts`
- `lib/types/strategyV2.ts`

### Other
- `.github/`
- `docs/pr/`

---

## Notes

- Largest change is `StrategyWorkspaceClient.tsx` (+2,411 lines) - major expansion
- `CompanyOverviewPage.tsx` appears to be a refactor (equal adds/removes)
- Many untracked files are out-of-scope per `docs/stabilization/2025-12-12-scope.md`
- No merge conflicts on stash apply
