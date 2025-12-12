# Context Infrastructure Audit

> Generated as part of OS Global Context + Context V3 implementation

## Summary

This audit identifies existing infrastructure to reuse for the OS Global Context and Context V3 expansion.

---

## 1. Context Types & Schemas

### Context V1 (Legacy) - `lib/types/context.ts`
- Flat structure with business fundamentals, audience, objectives, constraints, competitive
- `Competitor` type with domain, offerOverlap, jtbdMatch, source
- Confidence tracking via `confidenceNotes`

### Context V2 (Current) - `lib/types/contextV2.ts`
**REUSE:** This is our foundation for V3.

- `ContextField<T>` wrapper with provenance metadata:
  ```typescript
  { value: T, meta: { source, lastUpdated, confidence, needsReview } }
  ```
- Four structured sections: CompanyReality, MarketReality, Constraints, StrategicIntent
- Source types: `'AI' | 'User' | 'Lab' | 'Imported'`
- Helper functions: `isUserConfirmed()`, `updateField()`, `confirmField()`, `getContextCompleteness()`

---

## 2. Storage Layer

### Airtable Tables - `lib/airtable/tables.ts`
- `COMPANY_CONTEXT` - V1 flat context
- `COMPANY_CONTEXT_V2_META` - V2 provenance metadata (separate table)
- `CONTEXT_CHANGE_LOG` - Change history
- `CONTEXT_GRAPHS` - Full context graph JSON blobs

### Storage Functions - `lib/os/contextV2/storage.ts`
**REUSE:** Backward-compatible V1+V2 merge pattern.

- `getCompanyContextV2(companyId)` - Reads V1 + V2 meta, merges to V2
- `updateCompanyContextV2(companyId, updates, source)` - Saves V1 + V2 meta separately
- 60-second metadata cache

---

## 3. AI Prompt Assembly Locations

### Strategy Generation - `lib/os/strategyV2/aiGeneration.ts`
**INJECT OS CONTEXT HERE**

Key patterns:
- `STRATEGY_V2_SYSTEM_PROMPT` - Rules about choices, tradeoffs, forbidden moves
- `buildPromptInputs()` - Assembles context for AI
- `extractConfirmedContext()` - Gets user-confirmed fields as invariants
- Output includes `contextCompliance` for tracking

### Labs Prompts
- Audience Lab: `lib/os/labs/audience/prompts.ts`
- Media Lab: `lib/os/labs/media/prompts.ts`
- Execution Lab: `lib/os/labs/execution/prompts.ts`
- Creative Strategy: `lib/os/labs/creativeStrategy/prompts.ts`

**Pattern:** System prompt + `buildXxxUserPrompt(input)` function

### Context V2 AI Generation - `lib/os/contextV2/aiGeneration.ts`
- `SYSTEM_PROMPT_V2` - Context structuring rules
- `respectUserConfirmed` option for protection

---

## 4. Existing Doctrine (Embedded, Not Centralized)

### Strategy Rules (in aiGeneration.ts)
```
STRATEGY = CHOICES, NOT ACTIVITIES
- Who we choose to win with
- Where we focus first
- How we differentiate vs alternatives
- What we explicitly deprioritize
```

### Forbidden Patterns
- Vague verbs: "Optimize", "Improve", "Enhance"
- Generic audiences: "small businesses"
- Channel names in strategy
- Marketing language in audience

### Source Priority - `lib/contextGraph/sourcePriority.ts`
**REUSE:** Defines what sources can overwrite what.

```typescript
competitive: {
  priority: ['competition_lab', 'gap_heavy', 'gap_full', ...]
}
```

---

## 5. Context UI Components

### Main Components - `app/c/[companyId]/brain/context/`
- `ContextPageClient.tsx` - Main orchestrator (3 tabs)
- `ContextHealthHeader.tsx` - Completeness score display
- `ContextNodeInspector.tsx` - Field detail/editing
- `components/ContextFormView.tsx` - Editable form
- `components/ContextCoverageView.tsx` - Field coverage viz

**REUSE:** These components work with ContextField structure.

---

## 6. Competition V3 vs V4

### V3 (Active) - `lib/competition-v3/`
- 10-step orchestrator with context graph integration
- `getLatestCompetitionRunV3()` used in prompts
- Writes to CompetitiveDomain in context graph

### V4 (Newer) - `lib/competition-v4/`
- 5-step sequential pipeline
- Classification tree approach
- More rigid, simpler

**Current State:** Strategy generation uses V3 results.
**Target:** V4 when available, else V3, never both.

---

## 7. Write Contract (Just Implemented)

### Location - `lib/os/writeContract/`
**REUSE:** This is the enforcement layer.

- `computeProposalForAI()` - Generate proposal from AI output
- `applyUserAcceptedProposal()` - Apply with revision check
- `buildLockMeta()` - Extract locked paths from provenance
- `isContextFieldLocked()` - Check if field protected

---

## What We're Reusing

| Component | Location | Purpose |
|-----------|----------|---------|
| ContextField<T> type | lib/types/contextV2.ts | Provenance wrapper |
| isUserConfirmed() | lib/types/contextV2.ts | Protection check |
| Storage layer | lib/os/contextV2/storage.ts | V1+V2 backward compat |
| Source priority | lib/contextGraph/sourcePriority.ts | Override rules |
| Write contract | lib/os/writeContract/ | Proposal enforcement |
| UI components | app/c/.../brain/context/ | Field editing UI |

## What We're Adding

| Component | Location | Purpose |
|-----------|----------|---------|
| OS Global Context | lib/os/globalContext/ | Hive doctrine (immutable) |
| Context V3 types | lib/types/contextV3.ts | Extended domains |
| Central prompt builder | lib/os/prompts/ | Single injection point |
| Completeness signals | lib/os/contextV2/ | Regen recommendations |
| V4 preference logic | lib/os/competition/ | Source selection |
