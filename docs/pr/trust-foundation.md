# PR: Trust Foundation

**Branch:** `trust-foundation`
**Base:** `main`
**Commits:** 4
**Files Changed:** 52 (+9,401 / -107)

---

## Summary

- **Write Contract System**: AI outputs become proposals (RFC 6902 patches) that require user approval before applying to canonical state
- **Doctrine Injection**: Centralized HIVE_DOCTRINE with single-source operating principles injected into all AI context builders
- **Feature Flags**: Labs, Daily Briefing, and Automation gated OFF by default; core features (Context, Strategy, QBR) always ON
- **Trust Regression Tests**: Automated test suite scanning for direct AI writes, verifying proposal flow, and doctrine centralization
- **Context UI Extraction**: Reusable `ContextSection`, `ContextField`, `ConfidenceTooltip` components for consistent UI patterns

---

## Why

### The Trust Bug
AI-generated content was being written directly to canonical Context Graph fields, potentially overwriting user-confirmed data without approval. This violated the core trust invariant:

> **AI cannot overwrite user-confirmed data.**

### Prevention Measures
1. All AI writes now go through `computeProposalForAI()` which returns a proposal with:
   - `patch[]` - applicable changes
   - `conflicts[]` - locked field violations (cannot be applied)
2. User must explicitly accept proposals before changes are persisted
3. Fields with `source: 'user'` or `source: 'manual'` are automatically locked
4. Test suite prevents regression by scanning codebase for direct write patterns

---

## What Changed

### Key Modules

| Module | Purpose |
|--------|---------|
| `lib/os/writeContract/` | Proposal computation, lock evaluation, patch application (RFC 6902) |
| `lib/os/globalContext/` | HIVE_DOCTRINE, operating principles, doctrine injection |
| `lib/config/featureFlags.ts` | Feature flag configuration (Labs/Briefing/Automation OFF) |
| `lib/contextGraph/forAi.ts` | Enhanced `formatForPrompt()` with doctrine injection |
| `lib/contextGraph/governance/` | Lock rules, source priority enforcement |
| `lib/os/competition/` | Competition source selection with mutual exclusivity |

### Key Endpoints

| Endpoint | Change |
|----------|--------|
| `POST /api/os/context/ai-assist` | Now returns proposal via `computeProposalForAI()`, sets `requiresUserApproval: true` |
| `POST /api/os/context/update` | User-only writes (source: 'user'), unchanged |
| Labs routes (`/api/os/companies/[companyId]/labs/*`) | Feature-gated, return 403 when disabled |
| Brief route (`/api/os/companies/[companyId]/brief`) | Feature-gated, return 403 when disabled |
| Automation route (`/api/os/companies/[companyId]/automation`) | Feature-gated, return 403 when disabled |

### Documentation

| Doc | Purpose |
|-----|---------|
| `docs/context/trust-regression.md` | Trust audit report with findings and fixes |
| `docs/context/reuse-affirmation.md` | UI component → Context Graph domain mapping |
| `docs/context/reuse-map.md` | Full reuse map for Context UI primitives |
| `docs/stabilization/2025-12-12-scope.md` | Merge contract: in-scope vs out-of-scope features |

---

## Tests to Run

```bash
# Trust regression suite (REQUIRED)
pnpm test:trust

# Or run individual test files:
npx vitest run tests/context/trustRegression.test.ts
npx vitest run tests/context/trustRepoScan.test.ts
npx vitest run tests/context/aiRouteInvariants.test.ts
npx vitest run tests/competition/competitionMutualExclusivity.test.ts

# Type check
npx tsc --noEmit

# Lint
pnpm lint

# Build verification
pnpm build
```

### What Tests Verify

| Test | Checks |
|------|--------|
| `trustRegression.test.ts` | Write contract locks user-confirmed fields, proposals separate applicable vs conflicts |
| `trustRepoScan.test.ts` | No direct AI writes in codebase, all AI routes return proposals |
| `aiRouteInvariants.test.ts` | AI-assist route uses `computeProposalForAI()`, returns `requiresUserApproval` |
| `competitionMutualExclusivity.test.ts` | Competition sources are mutually exclusive, no parallel data |

---

## Risk / Rollback Notes

### Risk: Low-Medium

| Risk | Mitigation |
|------|------------|
| Feature flags misconfigured | Defaults are OFF for experimental features; core features hardcoded ON |
| Proposal flow breaks existing saves | User saves bypass proposal flow (direct write with `source: 'user'`) |
| Doctrine injection bloats prompts | Configurable via `doctrineMode: 'none' | 'operatingPrinciples' | 'full'` |
| Lock false positives | Only locks `user` and `manual` sources; AI/lab sources remain unlocked |

### Rollback

1. **Feature flags**: Set `NEXT_PUBLIC_FEATURE_*=false` (already default)
2. **AI-assist route**: Revert `app/api/os/context/ai-assist/route.ts` to direct write pattern
3. **Doctrine injection**: Set `doctrineMode: 'none'` in `formatForPrompt()` calls

### Breaking Changes

- None for end users
- AI-assist now returns `{ proposal, requiresUserApproval: true }` instead of `{ context }` - UI must handle proposal acceptance flow

---

## Screenshots Checklist

If applicable, capture screenshots for:

- [ ] Context Workspace: AI suggestions show as proposal (not auto-applied)
- [ ] Proposal UI: Shows applicable changes vs locked conflicts
- [ ] Labs page: Shows "Labs not enabled" message when flag OFF
- [ ] Daily Brief panel: Not rendered when flag OFF
- [ ] Automation panel: Not rendered when flag OFF

---

## Reviewer Notes

1. **Start with tests**: Run `pnpm test:trust` first to verify invariants
2. **Check docs**: Review `docs/context/trust-regression.md` for audit findings
3. **Verify flags**: Confirm `lib/config/featureFlags.ts` defaults are OFF for experimental features
4. **Smoke test**: Manually verify AI suggestions require approval in Context Workspace
