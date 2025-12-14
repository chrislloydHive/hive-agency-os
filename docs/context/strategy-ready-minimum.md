# Strategy-Ready Minimum (SRM)

The Strategy-Ready Minimum defines the minimum context fields required to generate quality strategy output. This is not about completeness—it's about having enough context for strategy generation to be meaningful.

## Philosophy

SRM is:
- **Explicit**: Hardcoded field requirements, no dynamic or vertical-specific logic
- **Minimum**: Only what's truly required, not "nice to have"
- **Decisive**: Clear yes/no on readiness, no fuzzy middle ground
- **Non-blocking**: Shows status but never prevents editing

## Required Fields

| Domain | Field | Reason |
|--------|-------|--------|
| identity | businessModel | Strategy must understand how the business makes money |
| productOffer | primaryProducts | Strategy needs to know what is being sold (OR heroProducts, productLines) |
| audience | primaryAudience | Strategy must target a defined audience (OR coreSegments) |
| identity | icpDescription | Strategy needs audience context beyond just a name |
| productOffer | valueProposition | Strategy must articulate why customers choose you |
| objectives | primaryObjective | Strategy must be goal-oriented (OR primaryBusinessGoal) |
| operationalConstraints | budgetCapsFloors | Strategy must operate within budget realities (OR minBudget, maxBudget) |
| competitive | competitors | Strategy needs competitive context |
| brand | positioning | Strategy must align with brand positioning (OR valueProps) |

## Usage

### Checking Readiness

```typescript
import { isStrategyReady } from '@/lib/contextGraph/readiness';

const result = isStrategyReady(graph);

if (result.ready) {
  console.log('Strategy-Ready!');
} else {
  console.log('Missing:', result.missing.map(m => m.label).join(', '));
}
```

### In UI

The `StrategyReadinessBanner` component shows readiness status in the Context Workspace:

```tsx
import { StrategyReadinessBanner } from '@/components/context';

// With full Context Graph
<StrategyReadinessBanner graph={contextGraph} />

// With CompanyContext (flat structure)
<StrategyReadinessBanner context={companyContext} />
```

### In AI Prompts

The `buildEnhancedStrategyContext` function includes SRM field annotations:

```typescript
import { buildEnhancedStrategyContext } from '@/lib/contextGraph';

const prompt = buildEnhancedStrategyContext(graph);
// Includes:
// - Strategy readiness status
// - SRM fields with source annotations [user-confirmed] or [AI-inferred]
// - Stale field warnings [stale]
// - Truncated values for prompt safety
```

## Freshness

SRM fields have freshness tracking:
- **Fresh**: Score >= 0.5 (within validity period)
- **Stale**: Score < 0.5 (needs review, not missing)

Stale fields are flagged as "needs review" but still count as present for readiness.

## Regen Recommendation

When SRM fields are modified, a strategy regeneration may be recommended. Use `checkRegenRecommendation` to detect changes:

```typescript
import { checkRegenRecommendation } from '@/lib/contextGraph/readiness';

const recommendation = checkRegenRecommendation(oldContext, newContext);
if (recommendation.recommended) {
  console.log(recommendation.message);
  // "Business Model changed — strategy regen recommended"
}
```

## Field Sources

SRM fields track their source:
- **user-confirmed**: Set by user, manual entry, brain, or setup wizard
- **AI-inferred**: Set by AI, FCB, GAP, or lab diagnostics
- **unknown**: No provenance data

This distinction is surfaced in the AI context builder to help downstream prompts weight information appropriately.

## Integration Points

1. **Context Workspace**: Shows readiness banner with missing/stale fields
2. **Strategy Generation**: Uses `buildEnhancedStrategyContext` for annotated prompts
3. **QBR Reports**: Can check readiness before generating reports
4. **Labs**: Can verify SRM before running heavy analysis

## Design Decisions

1. **No auto-generation**: SRM shows what's missing but never auto-fills
2. **No blocking**: UI never prevents editing, only informs
3. **Alternatives support**: Some fields have OR alternatives (e.g., positioning OR valueProps)
4. **Freshness as review flag**: Stale != missing; it means "review this"
5. **Value truncation**: Long values are safely truncated in AI prompts (500 char limit)
