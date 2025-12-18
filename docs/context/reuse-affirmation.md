# Context/Strategy Component Reuse Affirmation

## Purpose

This document maps new UI components to existing Context Workspace patterns and Context Graph domains to ensure no parallel data models are created.

---

## Components That Must Be Reused

### Context Workspace Entrypoint

**File:** `app/c/[companyId]/context/ContextWorkspaceClient.tsx`

### Reusable Section/Field Components (defined in ContextWorkspaceClient.tsx)

| Component | Location | Purpose |
|-----------|----------|---------|
| `ContextSection` | Lines 511-531 | Renders a collapsible section with icon, title, and children |
| `ContextField` | Lines 623-673 | Renders a labeled input (text or textarea) with confidence tooltip |
| `ConfidenceTooltip` | Lines 577-620 | Shows high-confidence / needs-review status on hover |
| `getFieldConfidence()` | Lines 544-572 | Extracts confidence note for a field from `confidenceNotes` |

### Additional Context Components

| Component | File | Purpose |
|-----------|------|---------|
| `CompetitorEditor` | `components/context/CompetitorEditor.tsx` | Edits competitor array |
| `DiagnosticsDebugDrawer` | `components/context/DiagnosticsDebugDrawer.tsx` | Debug info panel |

---

## Context Graph Domain Mapping

### UI Section -> Context Graph Domain + Field Paths

| UI Section | Context Graph Domain | Field Paths |
|------------|---------------------|-------------|
| **Business Fundamentals** | `identity` | `identity.businessModel`, `identity.primaryOffering`, `identity.revenueModel`, `identity.companySize` |
| **Audience & ICP** | `audience` | `audience.primaryAudience`, `audience.audienceDescription`, `audience.coreSegments`, `audience.demographics` |
| **Objectives & Goals** | `objectives` | `objectives.primaryObjective`, `objectives.secondaryObjectives`, `objectives.kpiLabels`, `objectives.targetCpa`, `objectives.targetRoas` |
| **Constraints & Considerations** | `operationalConstraints` | `operationalConstraints.budgetCapsFloors`, `operationalConstraints.minBudget`, `operationalConstraints.maxBudget`, `operationalConstraints.pacingRequirements` |
| **Competitive Landscape** | `competitive` | `competitive.competitors`, `competitive.primaryAxis`, `competitive.secondaryAxis`, `competitive.positionSummary` |
| **Brand & Messaging** | `brand` | `brand.positioning`, `brand.valueProps`, `brand.differentiators`, `brand.toneOfVoice` |
| **Product/Offer** | `productOffer` | `productOffer.primaryProducts`, `productOffer.valueProposition`, `productOffer.productLines` |

### Operational Constraints Domain Fields (lib/contextGraph/domains/operationalConstraints.ts)

| Field Path | Type | Description |
|------------|------|-------------|
| `operationalConstraints.budgetCapsFloors` | `BudgetCapFloor[]` | Budget caps/floors with scope, amount, period |
| `operationalConstraints.minBudget` | `number` | Minimum budget constraint |
| `operationalConstraints.maxBudget` | `number` | Maximum budget constraint |
| `operationalConstraints.brandVsPerformanceRules` | `string` | Brand vs performance allocation rules |
| `operationalConstraints.pacingRequirements` | `string` | Spend pacing requirements |
| `operationalConstraints.launchDeadlines` | `string[]` | Key launch deadlines |
| `operationalConstraints.blackoutPeriods` | `string[]` | Periods when ads cannot run |
| `operationalConstraints.channelRestrictions` | `ChannelRestriction[]` | Channel-specific restrictions |
| `operationalConstraints.complianceRequirements` | `string[]` | Compliance requirements |
| `operationalConstraints.legalRestrictions` | `string` | Legal restrictions |

---

## Proposal Type Rendering

### Proposal Interface (lib/os/writeContract/types.ts)

```typescript
interface Proposal {
  id: string;
  companyId: string;
  entityType: 'context' | 'strategy' | 'competition' | 'lab_result';
  entityId: string;

  // Patch content
  patch: PatchOperation[];           // Operations that CAN be applied
  conflicts: ProposalConflict[];     // Operations that conflict with locked fields

  // Summary for UI
  summary: ProposalSummary;

  // Revision tracking
  baseRevisionId: string;

  // Lifecycle
  status: 'pending' | 'accepted' | 'partially_accepted' | 'rejected' | 'expired' | 'superseded';
  createdAt: string;
  createdBy: string;
  expiresAt: string;

  // Review tracking
  reviewedAt?: string;
  reviewedBy?: string;
  acceptedPaths?: JsonPointer[];
  rejectedPaths?: JsonPointer[];
}
```

### Key Fields UI Must Render

| Field | Type | UI Rendering |
|-------|------|--------------|
| `patch` | `PatchOperation[]` | List of applicable changes (add/remove/replace) |
| `conflicts` | `ProposalConflict[]` | Locked field conflicts that cannot be applied |
| `summary.totalChanges` | `number` | Total proposed changes count |
| `summary.applicableChanges` | `number` | Changes that can be applied |
| `summary.conflicts` | `number` | Blocked changes count |
| `summary.sectionBreakdown` | `Record<string, {...}>` | Per-section add/remove/replace/conflict counts |

### PatchOperation Structure

```typescript
interface PatchOperation {
  op: 'add' | 'remove' | 'replace';
  path: JsonPointer;  // e.g., "/identity/businessModel/value"
  value?: unknown;
  oldValue?: unknown;  // For 'remove' operations
}
```

### ProposalConflict Structure

```typescript
interface ProposalConflict {
  path: JsonPointer;
  operation: PatchOperation;
  lockStatus: LockStatus;
  message: string;  // Human-readable explanation
}
```

---

## Apply Endpoints

### Context Update (User Saves)
- **Endpoint:** `POST /api/os/context/update`
- **File:** `app/api/os/context/update/route.ts`
- **Purpose:** Direct user save (source: 'user')

### AI Assist (Generates Proposal)
- **Endpoint:** `POST /api/os/context/ai-assist`
- **File:** `app/api/os/context/ai-assist/route.ts`
- **Purpose:** Returns proposal via `computeProposalForAI()`, requires user approval
- **Key Functions:**
  - `computeProposalForAI()` - Computes diff between base and AI candidate
  - `formatProposalForResponse()` - Formats proposal for API response

### Write Contract Apply
- **Module:** `lib/os/writeContract/apply.ts`
- **Functions:**
  - `applyProposal()` - Applies accepted proposal to base state
  - `applyPatch()` - Applies individual patch operations

---

## Anti-Patterns to Avoid

1. **Creating parallel context types** (e.g., `ContextV2`, `ContextV3`) instead of extending Context Graph domains
2. **Direct AI writes** - AI must always return proposals, never write directly to canonical state
3. **Custom diff formats** - Use `PatchOperation` (RFC 6902) instead of custom diff structures
4. **Bypassing lock checks** - Always use `computeProposalForAI()` which enforces lock evaluation
5. **Duplicating section components** - Reuse `ContextSection` and `ContextField` from ContextWorkspaceClient

---

## Audit Checklist

- [ ] New UI sections map to existing Context Graph domains
- [ ] Field paths use canonical format: `domain.field` (e.g., `identity.businessModel`)
- [ ] AI outputs use `computeProposalForAI()` not direct writes
- [ ] Proposal UI renders `patch`, `conflicts`, `summary` fields
- [ ] Lock conflicts are displayed with `message` explanation
- [ ] Section components reuse `ContextSection` pattern
- [ ] Field components reuse `ContextField` pattern

