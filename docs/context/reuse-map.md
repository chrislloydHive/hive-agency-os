# Context System Reuse Map

**Purpose**: This document maps existing Context V2 / Context Graph infrastructure for reuse in Context V3 and future OS Global Context work. It identifies what to reuse as-is, extend, replace, or deprecate.

**Last Updated**: December 2024
**Scope**: lib/contextGraph/*, lib/os/contextV2/*, lib/types/context*.ts

---

## Architecture Overview

The current system has a **three-layer architecture**:

1. **Context V1** (`lib/types/context.ts`) - Legacy flat structure, no provenance
2. **Context V2** (`lib/types/contextV2.ts`) - 4 sections with per-field `ContextField<T>` wrapper
3. **Context Graph** (`lib/contextGraph/`) - Master model with 19 domains, `WithMeta<T>` wrapper

**Trust Flow**: Human sources → Diagnostic sources → AI inference → External enrichment

---

## Reuse As-Is

### Core Provenance Types
| Symbol | File | Why Keep |
|--------|------|----------|
| `WithMeta<T>` | `lib/contextGraph/types.ts:92-99` | Core wrapper with `{ value: T \| null, provenance: ProvenanceTag[] }`. Battle-tested. |
| `WithMetaArray<T>` | `lib/contextGraph/types.ts:105-112` | Array variant. Well-designed. |
| `ProvenanceTag` | `lib/contextGraph/types.ts:56-73` | Complete provenance tracking: source, confidence, updatedAt, validForDays, sourceRunId |
| `ContextSource` | `lib/contextGraph/types.ts:16-48` | Comprehensive enum of 30+ sources. Zod-validated. |
| `emptyMeta<T>()` | `lib/contextGraph/types.ts:137-142` | Factory function for empty fields |
| `createProvenance()` | `lib/contextGraph/types.ts:161-180` | Factory for ProvenanceTag with defaults |
| `DEFAULT_VALIDITY_DAYS` | `lib/contextGraph/types.ts:186-218` | Per-source freshness decay config |

### Source Priority System
| Symbol | File | Why Keep |
|--------|------|----------|
| `HUMAN_SOURCES` | `lib/contextGraph/sourcePriority.ts:82-87` | Set of protected sources: `user`, `manual`, `qbr`, `strategy` |
| `isHumanSource()` | `lib/contextGraph/sourcePriority.ts:92-94` | Check if source is human-protected |
| `hasHumanOverride()` | `lib/contextGraph/sourcePriority.ts:100-102` | Check if field has human edit |
| `canSourceOverwrite()` | `lib/contextGraph/sourcePriority.ts:435-520` | **THE** priority decision function. Enforces human protection. |
| `DOMAIN_PRIORITY_CONFIG` | `lib/contextGraph/sourcePriority.ts:120-370` | Per-domain source priority ordering |
| `getSourcePriorityForDomain()` | `lib/contextGraph/sourcePriority.ts:381-405` | Numeric priority score lookup |

### Mutation Layer
| Symbol | File | Why Keep |
|--------|------|----------|
| `setField()` | `lib/contextGraph/mutate.ts:263-305` | Type-safe single field update with priority check |
| `setFieldUntyped()` | `lib/contextGraph/mutate.ts:117-181` | Dynamic field update with priority check |
| `setDomainFields()` | `lib/contextGraph/mutate.ts:390-453` | Batch field update per domain |
| `setDomainFieldsWithResult()` | `lib/contextGraph/mutate.ts:459-527` | Batch update with blocked path tracking |
| `createProvenance()` | `lib/contextGraph/mutate.ts:65-84` | ProvenanceTag factory |

### Write Contract System (Already Implemented)
| Symbol | File | Why Keep |
|--------|------|----------|
| `computeProposalForAI()` | `lib/os/writeContract/index.ts` | Generates proposal from AI output, separates applicable vs conflicts |
| `applyUserAcceptedProposal()` | `lib/os/writeContract/index.ts` | Applies with revision check and lock validation |
| `hasLockedFields()` | `lib/os/writeContract/index.ts` | Check if entity has protected fields |
| `Proposal` type | `lib/os/writeContract/index.ts` | Proposal structure with applicable/conflicting changes |

### Context V2 Write Contract Integration
| Symbol | File | Why Keep |
|--------|------|----------|
| `extractContextV2Locks()` | `lib/os/contextV2/writeContractIntegration.ts:66-120` | Extracts locked paths from V2 context |
| `extractContextV3Locks()` | `lib/os/contextV2/writeContractIntegration.ts:125-156` | Extracts locked paths from V3 context |
| `generateContextProposal()` | `lib/os/contextV2/writeContractIntegration.ts:175-247` | AI regen through proposal flow |
| `applyContextProposal()` | `lib/os/contextV2/writeContractIntegration.ts:260-314` | Apply user-approved proposals |
| `updateContextDirect()` | `lib/os/contextV2/writeContractIntegration.ts:329-365` | Bypass proposal for user edits |

### OS Global Context (Already Implemented)
| Symbol | File | Why Keep |
|--------|------|----------|
| `getOSGlobalContext()` | `lib/os/globalContext/index.ts` | Returns versioned Hive doctrine |
| `buildFullDoctrinePrompt()` | `lib/os/globalContext/prompts.ts` | Full doctrine for AI injection |
| `buildOperatingPrinciplesPrompt()` | `lib/os/globalContext/prompts.ts` | Operating principles only |
| `OSGlobalContext` type | `lib/os/globalContext/types.ts` | Code-defined, immutable doctrine |

### Competition Source Selection
| Symbol | File | Why Keep |
|--------|------|----------|
| `selectCompetitionSource()` | `lib/os/competition/sourceSelection.ts:60-107` | V4/V3 source selection with mutual exclusivity |
| `shouldV4ReplaceV3()` | `lib/os/competition/sourceSelection.ts:116-128` | V4 always preferred over V3 |
| `validateCompetitionDataConsistency()` | `lib/os/competition/sourceSelection.ts:135-149` | Prevents V3/V4 mixing |

---

## Extend

### AI Context Builders
| Symbol | File | Extension Needed |
|--------|------|------------------|
| `buildAiContextView()` | `lib/contextGraph/forAi.ts:185-270` | Add OS Global Doctrine injection point |
| `formatForPrompt()` | `lib/contextGraph/forAi.ts:328-361` | Add doctrine header/footer options |
| `buildStrategyContext()` | `lib/contextGraph/forAi.ts:472-482` | Inject operating principles from OS Global Context |
| `buildMediaPlanningContext()` | `lib/contextGraph/forAi.ts:444-453` | Inject media-specific Hive doctrine |
| `buildCreativeContext()` | `lib/contextGraph/forAi.ts:458-467` | Inject creative doctrine |

### Context V2 Types
| Symbol | File | Extension Needed |
|--------|------|------------------|
| `ContextField<T>` | `lib/types/contextV2.ts` | Consider aligning with `WithMeta<T>` |
| `CompanyContextV2` | `lib/types/contextV2.ts` | Add more domains to match Context Graph |

### Context V2 Completeness
| Symbol | File | Extension Needed |
|--------|------|------------------|
| `calculateCompletenessV2()` | `lib/os/contextV2/completeness.ts` | Add doctrine-aware readiness checks |
| `isReadyForStrategy()` | `lib/os/contextV2/completeness.ts` | Check OS Global Context requirements |
| `isReadyForLabs()` | `lib/os/contextV2/completeness.ts` | Check minimum context for lab runs |

### Context Change History
| Symbol | File | Extension Needed |
|--------|------|------------------|
| `logContextChange()` | `lib/os/contextV2/changeHistory.ts` | Add OS doctrine version tracking |
| `getQBRContextChanges()` | `lib/os/contextV2/changeHistory.ts` | Include doctrine changes in QBR |

---

## Replace Carefully

### Direct AI Writes to Context
| Pattern | Location | Replacement |
|---------|----------|-------------|
| Direct `setField()` from AI | Various lab writers | Use `computeProposalForAI()` → user approval → `applyUserAcceptedProposal()` |
| AI overwriting user edits | Lab post-run hooks | Always check `canSourceOverwrite()` or use proposal flow |

### Context V1 Usage
| Pattern | Location | Replacement |
|---------|----------|-------------|
| `CompanyContext` (V1) | Legacy code paths | Migrate to Context V2 or Context Graph |
| Flat context without provenance | Old lab outputs | Use `WithMeta<T>` wrapper |

---

## Deprecate

### Legacy Patterns
| Symbol/Pattern | File | Why Deprecate |
|----------------|------|---------------|
| Context V1 direct usage | `lib/types/context.ts` | No provenance tracking |
| `contextV1ToV2()` | `lib/types/contextV2.ts` | Migration helper, not needed long-term |
| `contextV2ToV1()` | `lib/types/contextV2.ts` | Migration helper, not needed long-term |
| Raw AI context injection without doctrine | Various | Must include OS Global Context |

### Superseded by V4
| Symbol | File | Why Deprecate |
|--------|------|---------------|
| `competition_lab` source (V3) | Various | Superseded by `competition_v4` |

---

## Non-Negotiable Foundations

These are **trust guarantees** that must NEVER be broken:

### 1. Human Override Protection
```typescript
// From lib/contextGraph/sourcePriority.ts
export const HUMAN_SOURCES: Set<SourceId> = new Set([
  'user',
  'manual',
  'qbr',
  'strategy',
]);
```
**Rule**: Human sources have `MAX_SAFE_INTEGER` priority. Automation can NEVER overwrite them.

### 2. Provenance-First Design
Every field write must include provenance:
```typescript
// From lib/contextGraph/types.ts
export type WithMetaType<T> = {
  value: T | null;
  provenance: ProvenanceTag[];
};
```
**Rule**: No field update without source, confidence, and timestamp.

### 3. Priority Check Before Write
```typescript
// From lib/contextGraph/mutate.ts:148-164
if (!options?.force) {
  const priorityCheck = canSourceOverwrite(
    domain,
    fieldData.provenance || [],
    provenance.source,
    provenance.confidence
  );
  if (!priorityCheck.canOverwrite) {
    return graph; // Silently skip
  }
}
```
**Rule**: Every write checks `canSourceOverwrite()` unless explicitly forced.

### 4. Proposal Flow for AI Updates
```typescript
// From lib/os/contextV2/writeContractIntegration.ts
const { proposal, hasConflicts } = computeProposalForAI({
  base: currentContext,
  candidate: aiGeneratedContext,
  meta: lockMeta,
  ...
});
```
**Rule**: AI-generated context updates go through proposal → user approval → apply.

### 5. Source Mutual Exclusivity (Competition)
```typescript
// From lib/os/competition/sourceSelection.ts
if (hasV4 && hasV3) {
  return {
    valid: false,
    error: 'Competition data mixes V4 and V3 sources...',
  };
}
```
**Rule**: Never mix V3 and V4 competition data.

---

## Good Starts to Build On

### 1. Context Graph 19-Domain Model
`lib/contextGraph/companyContextGraph.ts` defines a comprehensive domain structure:
- identity, brand, audience, website, content, seo
- performanceMedia, budgetOps, objectives, productOffer
- operationalConstraints, storeRisk, historical, historyRefs
- digitalInfra, ops, creative, competitive, social

**Opportunity**: Align Context V3 domains with this model.

### 2. Freshness Tracking
`lib/contextGraph/freshness.ts` with `getFieldFreshness()` and `DEFAULT_VALIDITY_DAYS`

**Opportunity**: Surface freshness warnings in AI prompts.

### 3. Field Schema Validation
`lib/contextGraph/schema.ts` with `isValidFieldPath()` and `CONTEXT_FIELDS`

**Opportunity**: Runtime validation of field writes, catch typos.

### 4. AI Context Formatters
`lib/contextGraph/forAi.ts` provides specialized builders:
- `buildMediaPlanningContext()`
- `buildCreativeContext()`
- `buildStrategyContext()`

**Opportunity**: Inject OS Global Doctrine into these builders.

### 5. Change History
`lib/os/contextV2/changeHistory.ts` tracks field changes over time

**Opportunity**: Use for QBR reports, audit trails, rollback.

---

## Summary Counts

| Category | Count |
|----------|-------|
| Reuse As-Is | 32 symbols |
| Extend | 12 symbols |
| Replace Carefully | 4 patterns |
| Deprecate | 5 patterns |
| Non-Negotiable Foundations | 5 rules |

---

## Next Steps (Do Not Implement Yet)

1. **Align Context V3 types** with Context Graph domain model
2. **Add OS Global Context injection** to AI context builders
3. **Ensure all lab writers** use proposal flow, not direct writes
4. **Deprecate V1 context** usage across codebase
5. **Add freshness warnings** to AI prompt injection
