# Trust Regression Audit Report

**Date:** 2025-12-12
**Auditor:** Claude Code
**Status:** PASSED

## Executive Summary

This audit verifies that AI and automated systems CANNOT overwrite user-confirmed data in the Context Graph or Strategy systems. All trust invariants are enforced at the code level.

## Audit Results

### Part A: Direct AI Write Analysis

**Status:** PASSED (1 violation found and fixed)

**Findings:**
| Location | Source | Classification | Action |
|----------|--------|----------------|--------|
| `app/api/os/context/ai-assist/route.ts:274` | `source: 'ai'` | ⚠️ AI write to canonical | **FIXED** |
| `app/api/os/context/import-from-gap/route.ts:65` | `source: 'diagnostic'` | ✅ User-initiated | OK |
| `app/api/os/context/update/route.ts:16` | `source || 'user'` | ✅ User-only | OK |
| `app/api/context-graph/[companyId]/edit/route.ts:141` | `source: 'manual'` | ✅ User-only | OK |
| `app/api/setup/[companyId]/finalize/route.ts:24` | Setup wizard | ✅ User-only | OK |

**Fix Applied:**
- Converted `ai-assist/route.ts` from direct write to proposal flow
- Now uses `computeProposalForAI()` and returns `requiresUserApproval: true`
- AI generates suggestions, user must explicitly accept

### Part B: Doctrine Injection Centralization

**Status:** PASSED

**Architecture:**
```
HIVE_DOCTRINE (lib/os/globalContext/hiveDoctrine.ts)
      ↓
getOSGlobalContext() (lib/os/globalContext/index.ts)
      ↓
buildOperatingPrinciplesPrompt() / buildFullDoctrinePrompt()
      ↓
formatForPrompt() (lib/contextGraph/forAi.ts)
      ↓
All AI context consumers
```

**Verified:**
- Single source of truth: `hiveDoctrine.ts`
- All AI context builders inject doctrine by default (`doctrineMode: 'operatingPrinciples'`)
- Strategy context uses FULL doctrine (`doctrineMode: 'full'`)
- No duplicate doctrine definitions found

### Part C: Strategy Regen Behavior

**Status:** PASSED

**Verified:**
- `ai-propose/route.ts` returns proposal, does NOT save directly
- `createDraftStrategy()` always creates NEW record with `status: 'draft'`
- `createStrategyV2FromProposal()` creates NEW record, never mutates existing
- Active strategy is immutable - only user-initiated updates via `updateStrategy()`

**Flow:**
```
AI → ai-propose/route.ts → returns proposal
                              ↓
              User reviews & accepts
                              ↓
createStrategyV2FromProposal() → NEW draft record
                              ↓
              User finalizes draft
```

### Part D: Competition Source Selection

**Status:** PASSED

**Priority Configuration (`sourcePriority.ts`):**
```typescript
competitive: {
  priority: [
    'competition_v4',   // PREFERRED
    'competition_lab',  // V3 fallback
    'gap_heavy',
    // ...
  ],
}
```

**Verified:**
- V4 has higher priority score than V3
- V4 CAN overwrite V3 data (higher priority)
- V3 CANNOT overwrite V4 data (lower priority)
- Human sources ALWAYS override both V4 and V3

### Part E: Simulated Overwrite Attempt

**Status:** PASSED (57 tests)

**Test File:** `tests/context/trustRegression.test.ts`

**Test Coverage:**
- Human Source Identification (4 sources: `user`, `manual`, `qbr`, `strategy`)
- AI Cannot Overwrite Human Data (all AI/lab combinations blocked)
- Human CAN Overwrite Anything (verified)
- Competition V4 > V3 Priority (verified)
- Empty Provenance Edge Cases (handled)
- Priority Score Invariants (human = MAX_SAFE_INTEGER)

**Critical Test:**
```typescript
it('should block all AI sources from overwriting human data', () => {
  const humanProvenance = [{ source: 'user', ... }];
  const automatedSources = ['brain', 'inferred', 'website_lab', ...];

  for (const source of automatedSources) {
    const result = canSourceOverwrite('brand', humanProvenance, source, 1.0);
    expect(result.canOverwrite).toBe(false);
  }
});
```

## Trust Invariants Verified

### 1. AI Proposes, Humans Decide
- All AI outputs go through proposal flow
- `requiresUserApproval: true` flag enforced
- No direct AI writes to canonical data

### 2. Human Sources Are Protected
```typescript
const HUMAN_SOURCES = new Set(['user', 'manual', 'qbr', 'strategy']);
```
- These sources have `MAX_SAFE_INTEGER` priority
- No automated source can overwrite them

### 3. Source Priority Enforcement
- `canSourceOverwrite()` is the single gatekeeper
- Human override check happens FIRST (lines 463-470)
- Lower priority sources blocked (lines 515-519)

### 4. Strategy Versioning
- Regeneration creates NEW drafts
- Active strategies are immutable to AI
- Version tracking with `contextVersionHash`

## Files Modified During Audit

1. **Fixed:** `app/api/os/context/ai-assist/route.ts`
   - Removed direct `updateCompanyContext()` call with `source: 'ai'`
   - Added `computeProposalForAI()` proposal flow
   - Returns `requiresUserApproval: true`

2. **Created:** `tests/context/trustRegression.test.ts`
   - 57 tests covering all trust invariants
   - Run with: `npx vitest run tests/context/trustRegression.test.ts`

## CI Integration

Add to CI pipeline:
```yaml
- name: Trust Regression Tests
  run: npx vitest run tests/context/trustRegression.test.ts
```

## Conclusion

All trust invariants are enforced. The system guarantees:

1. **Zero AI-to-canonical write paths** - All AI writes go through proposal flow
2. **Human data is sacred** - `HUMAN_SOURCES` can never be overwritten by automation
3. **Strategy regeneration is non-destructive** - Creates new drafts, never mutates active
4. **Competition V4 > V3** - Source priority properly configured
5. **Doctrine is centralized** - Single source of truth in `hiveDoctrine.ts`

**Run tests regularly:**
```bash
npx vitest run tests/context/trustRegression.test.ts
```
