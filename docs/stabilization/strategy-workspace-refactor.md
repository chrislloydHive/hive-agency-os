# Strategy Workspace Refactor

Date: 2025-12-12

## Overview

Refactored `StrategyWorkspaceClient.tsx` to reduce risk without changing behavior. The file was reduced from ~2385 lines to ~743 lines by extracting state management and UI components.

## Extracted Modules

### View Model Hook

**`lib/os/strategyV2/strategyWorkspaceViewModel.ts`**

Custom hook that encapsulates all data fetching, state management, and API interactions:

```typescript
useStrategyWorkspaceViewModel({
  companyId,
  initialStrategy,
  contextMismatch,
  versions,
  currentVersionId,
})
```

**Returns:**
- `strategy` - Active strategy, drafts state
- `readinessStatus` - Readiness status with reasons
- `saveStatus`, `error`, `isDirty` - Save state
- Loading states: `aiLoading`, `regenerating`, `finalizing`, `loadingIdeas`, `generatingWork`
- Derived state: `isFinalized`, `isViewingNonActive`, `isViewingArchived`, `editingDisabled`
- Handlers: `handleSave`, `handleAiPropose`, `handleRegenerate`, `handleFinalize`, `handleMakeActive`
- Ideas handlers: `loadIdeas`, `applyPillarSuggestion`, `applyDifferentiationSuggestion`
- Work handlers: `openGenerateWorkModal`, `handleGenerateWork`, `closeGenerateWorkModal`

**Helper functions:**
- `createEmptyHydratedStrategy(companyId)` - Creates blank strategy

### Extracted Components

| Component | Path | Description |
|-----------|------|-------------|
| `StrategyHeader` | `components/strategy/StrategyHeader.tsx` | Header with title, version selector, action buttons |
| `StrategyReadinessBadge` | `components/strategy/StrategyReadinessBadge.tsx` | Context compliance indicator, needs review count |
| `StrategyVersionList` | `components/strategy/StrategyVersionList.tsx` | Version selector dropdown |
| `StrategyIdeasPanel` | `components/strategy/StrategyIdeasPanel.tsx` | Side panel for AI-generated ideas |

**Barrel export:** `components/strategy/index.ts`

## What Stayed in StrategyWorkspaceClient

The main component still contains:

1. **Form-specific helper components** (kept inline as they're tightly coupled to form rendering):
   - `SectionNeedsReviewBadge`
   - `SubtleReviewDot`
   - `FieldPlaceholder`
   - `MissingFieldsNote`
   - `InheritedFromContextLabel`

2. **Section components** (domain-specific form sections):
   - `StrategicChoicesSection`
   - `SuccessDefinitionSection`
   - `PillarCardV4`
   - `GenerateWorkModal`

3. **Main component JSX** - Layout and composition of all sections

## File Size Comparison

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| `StrategyWorkspaceClient.tsx` | ~2385 lines | ~743 lines | 69% |

New files created:
- `strategyWorkspaceViewModel.ts` - ~650 lines
- `StrategyHeader.tsx` - ~215 lines
- `StrategyReadinessBadge.tsx` - ~145 lines
- `StrategyVersionList.tsx` - ~115 lines
- `StrategyIdeasPanel.tsx` - ~155 lines
- `index.ts` - ~12 lines

## Behavior Preserved

- All current behavior identical
- No changes to API contracts
- Proposal flows unchanged
- Readiness signals as-is
- No changes to proposal logic

## Import Structure

```
StrategyWorkspaceClient
├── useStrategyWorkspaceViewModel (hook)
│   ├── fetch handlers → /api/os/strategy/v2
│   ├── ideas handlers → /api/os/companies/[id]/strategy/ideas
│   └── work handlers → /api/os/companies/[id]/strategy/generate-work
├── StrategyHeader (component)
│   ├── StrategyVersionList
│   └── StrategyReadinessBadge
└── StrategyIdeasPanel (component)
```

No circular dependencies.

## Follow-ups

1. **Potential further extraction** - Section components (`StrategicChoicesSection`, `PillarCardV4`) could be extracted if they're reused elsewhere.

2. **Test coverage** - Consider adding unit tests for the view model hook to verify state transitions.

3. **Form-specific helpers** - Could be moved to a shared `components/strategy/helpers.tsx` if needed by other strategy components.

## Verification

- [x] TypeScript compilation passes (no new errors)
- [x] Existing behavior preserved
- [x] No API contract changes
- [x] No circular dependencies
