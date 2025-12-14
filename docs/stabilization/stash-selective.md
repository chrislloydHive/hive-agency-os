# Stash Selective Apply

Date: 2025-12-12

## Overview

Applied stash `stash@{0}` (WIP: strategy/labs/qbr/work expansion) to branch `ui-polish-proposals` (based on `trust-foundation`), then selectively removed Labs/Automation/Daily Briefing features to keep the branch focused on UI polish and proposals.

## Stash Contents

The stash contained:
- 13 modified files (staged changes)
- 67+ untracked files (new features)

## What Was Discarded

### Labs UI & Lib (removed)

| Path | Type | Reason |
|------|------|--------|
| `app/c/[companyId]/labs/audience/AudienceLabClient.tsx` | Untracked | Labs feature |
| `app/c/[companyId]/labs/creative-strategy/CreativeStrategyLabClient.tsx` | Untracked | Labs feature |
| `app/c/[companyId]/labs/execution/ExecutionLabClient.tsx` | Untracked | Labs feature |
| `app/c/[companyId]/labs/media/MediaLabClient.tsx` | Untracked | Labs feature |
| `lib/os/labs/` | Untracked dir | Labs engine (5 subdirs: audience, creativeStrategy, execution, media, mediaScenarios) |
| `lib/contextGraph/governance/governedLabWriter.ts` | Untracked | Labs governance integration |

### Labs API Routes (restored to HEAD)

| Path | Action |
|------|--------|
| `app/api/os/companies/[companyId]/labs/execution/route.ts` | Restored |
| `app/api/os/companies/[companyId]/labs/media-scenarios/route.ts` | Restored |
| `app/api/os/companies/[companyId]/labs/media/route.ts` | Restored |
| `app/c/[companyId]/labs/audience/page.tsx` | Restored |
| `app/c/[companyId]/labs/creative-strategy/page.tsx` | Restored |

### Automation (removed)

| Path | Type | Reason |
|------|------|--------|
| `lib/os/automation/` | Untracked dir | Automation engine (index.ts, rules.ts, runAutomation.ts, triggers.ts, types.ts) |
| `components/automation/index.ts` | Untracked | Automation components |

### Daily Briefing (removed)

| Path | Type | Reason |
|------|------|--------|
| `lib/os/briefing/daily/` | Untracked dir | Daily briefing engine (index.ts, prompts.ts, runDailyBrief.ts, types.ts) |

## What Was Kept

### Strategy (UI polish focus)

| Path | Type | Description |
|------|------|-------------|
| `app/c/[companyId]/strategy/StrategyWorkspaceClient.tsx` | Modified | Main strategy UI (refactored) |
| `app/c/[companyId]/strategy/page.tsx` | Modified | Strategy page wrapper |
| `components/strategy/` | Untracked dir | Extracted strategy components (StrategyHeader, StrategyVersionList, StrategyReadinessBadge, StrategyIdeasPanel) |
| `lib/os/strategyV2/` | Untracked dir | Strategy view model hook |
| `lib/os/strategy/` | Untracked dir | Strategy hydration |
| `app/api/os/strategy/v2/` | Untracked dir | Strategy V2 API route |
| `app/api/os/companies/[companyId]/strategy/generate-work/` | Untracked dir | Work generation API |
| `app/api/os/companies/[companyId]/strategy/ideas/` | Untracked dir | Strategy ideas API |
| `lib/types/strategyV2.ts` | Untracked | Strategy V2 types |

### QBR (kept)

| Path | Type | Description |
|------|------|-------------|
| `app/api/os/companies/[companyId]/qbr/route.ts` | Modified | QBR API |
| `app/c/[companyId]/reports/qbr/QBRReportClient.tsx` | Modified | QBR report UI |
| `app/c/[companyId]/qbr/strategy/page.tsx` | Untracked | QBR strategy page |
| `components/qbr/` | Mixed | QBR components (index.ts modified, 4 new: QBRHighlights, QBRNextActions, QBRSection, QBRStoryHeader) |
| `lib/os/qbr/` | Untracked dir | QBR data loading |
| `lib/os/reports/qbrData.ts` | Modified | QBR data helpers |

### Context V2 (kept)

| Path | Type | Description |
|------|------|-------------|
| `app/api/os/context/v2/` | Untracked dir | Context V2 API |
| `lib/os/contextV2/` | Untracked dir | Context V2 engine |
| `lib/os/context/strategyImpact.ts` | Untracked | Strategy impact analysis |
| `lib/types/contextV2.ts` | Untracked | Context V2 types |
| `lib/types/contextV3.ts` | Untracked | Context V3 types |
| `lib/contextGraph/paths/` | Untracked dir | Context graph paths |

### Work Expansion (kept)

| Path | Type | Description |
|------|------|-------------|
| `app/c/[companyId]/work/WorkItemCardWithStatus.tsx` | Modified | Work item UI |
| `lib/os/work.ts` | Modified | Work helpers |
| `lib/os/work/` | Untracked dir | Work generation |
| `lib/types/work.ts` | Modified | Work types |
| `lib/types/workMvp.ts` | Modified | Work MVP types |

### Proposals (kept)

| Path | Type | Description |
|------|------|-------------|
| `components/proposal/` | Untracked dir | Proposal UI components |

### Company Overview (kept)

| Path | Type | Description |
|------|------|-------------|
| `app/c/[companyId]/page.tsx` | Modified | Company page |
| `components/os/CompanyOverviewPage.tsx` | Modified | Overview component |

### Other (kept)

| Path | Type | Description |
|------|------|-------------|
| `.github/` | Untracked dir | GitHub config (CODEOWNERS) |
| `docs/` | Untracked dir | Documentation |
| `tests/ui/` | Untracked dir | UI tests |
| `lib/airtable/tables.ts` | Modified | Airtable config |
| `vitest.config.ts` | Modified | Test config |

## Summary

**Discarded:** 9 files/directories (Labs clients, Labs lib, Automation lib, Daily Briefing lib, Labs API modifications)

**Kept:** 38+ files/directories (Strategy workspace refactor, QBR components, Context V2, Work expansion, Proposals, Company Overview updates)

## Next Steps

1. Labs/Automation/Briefing can be restored from the stash on a separate branch if needed
2. Verify build passes with `npm run build`
3. Run tests with `npm run test`
