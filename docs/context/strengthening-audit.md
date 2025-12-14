# Context Strengthening Audit

Date: 2025-12-12

## Purpose

Audit the Context system to identify gaps that block Strategy/Labs quality. This is company-agnostic - no client-specific logic.

---

## 1. Current Context Sections (UI → Graph Mapping)

### ContextWorkspaceClient UI Sections

| UI Section | UI Fields | Context Graph Domain/Path |
|------------|-----------|---------------------------|
| **Business Fundamentals** | businessModel, valueProposition, companyCategory | `identity.businessModel`, `productOffer.valueProposition`, `identity.industry` |
| **Audience & ICP** | primaryAudience, secondaryAudience, icpDescription | `audience.coreSegments`, `audience.secondarySegments`, `identity.icpDescription` |
| **Objectives & Goals** | objectives[] | `objectives.primaryObjective`, `objectives.kpiLabels` |
| **Constraints** | constraints, budget, timeline | `operationalConstraints.*`, `budgetOps.mediaSpendBudget`, `objectives.timeHorizon` |
| **Competitive Landscape** | competitors[], competitorsNotes | `competitive.*`, `storeRisk.primaryCompetitors` |
| **Additional Notes** | notes | (not mapped to graph) |

### Context Graph Domains (All Available)

```
identity          → Business identity, ICP, geography, seasonality
brand             → Positioning, voice, differentiators
objectives        → Goals, KPIs, targets
audience          → Segments, demographics, behaviors
productOffer      → Products, pricing, margins, promotions
digitalInfra      → Tracking, GA4, attribution
website           → Site structure, pages, performance
content           → Topics, formats, pillars
seo               → Keywords, rankings, strategy
ops               → Locations, capacity, partners
performanceMedia  → Channels, spend, performance metrics
budgetOps         → Budget, targets, unit economics
storeRisk         → Competitors, market position
historical        → Past performance, trends
creative          → Assets, messaging, campaigns
competitive       → Competitor analysis
operationalConstraints → Legal, compliance, blackouts
social            → Social presence, local listings
```

---

## 2. Missing High-Signal Domains/Fields for Strategy

### MUST (Blocks Strategy Quality)

These fields are critical for any meaningful strategy output. Without them, AI produces generic/unsafe recommendations.

| Field | Domain.Path | Why Critical |
|-------|-------------|--------------|
| **Sales Cycle Type** | `identity.businessModel` + new | Strategy differs wildly for impulse vs. considered purchases |
| **Primary Conversion Action** | `objectives.primaryConversionAction` | Defines what success means (lead, purchase, booking) |
| **Geographic Scope** | `identity.geographicFootprint` | Local vs. national vs. global changes everything |
| **Service Area** | `identity.serviceArea` | Critical for local service businesses |
| **Average Order/Ticket Value** | `budgetOps.avgOrderValue` or `productOffer.avgTicketValue` | Unit economics drive viable channels |
| **Customer LTV** | `budgetOps.customerLTV` | Determines allowable CAC, channel mix |
| **Budget Range** | `budgetOps.mediaSpendBudget` | Constrains channel selection |

### SHOULD (Materially Improves Strategy)

These fields significantly improve strategy quality but aren't strict blockers.

| Field | Domain.Path | Why Important |
|-------|-------------|---------------|
| **Sales Channels** | `identity.revenueStreams` or new `salesChannels` | Online vs. in-store vs. hybrid affects media mix |
| **Price Range** | `productOffer.priceRange` | Affects positioning, audience targeting |
| **Gross Margin** | `budgetOps.grossMargin` | Determines budget efficiency requirements |
| **Seasonality Peaks** | `identity.peakSeasons` | Timing of spend, campaign planning |
| **Compliance Requirements** | `operationalConstraints.complianceRequirements` | Legal constraints on messaging/channels |
| **Blackout Periods** | `operationalConstraints.blackoutPeriods` | Timing constraints |
| **Lead Value / CPA Target** | `budgetOps.cpaTarget` | Performance thresholds |

### NICE (Later)

| Field | Domain.Path | Why Useful |
|-------|-------------|------------|
| Funnel Stage Focus | new | Awareness vs. consideration vs. conversion |
| Platform Restrictions | `operationalConstraints.platformLimitations` | Channel limitations |
| Competitor Spend Estimate | `competitive.*` | Competitive context |
| Historical CAC | `budgetOps.*` | Benchmark for targets |

---

## 3. Existing Utilities Audit

### Completeness / Readiness

| Utility | Location | Status |
|---------|----------|--------|
| `calculateSectionSummary()` | `lib/contextGraph/sectionSummary.ts` | ✅ Exists - calculates coverage per domain |
| `calculateGraphSummary()` | `lib/contextGraph/sectionSummary.ts` | ✅ Exists - overall completeness |
| `computeContextHealthScoreFromCompleteness()` | `lib/contextGraph/contextHealth.ts` | ✅ Exists - score from completeness % |
| `getHealthStatus()` | `lib/contextGraph/contextHealth.ts` | ✅ Exists - healthy/fair/needs_attention/critical |

### Freshness

| Utility | Location | Status |
|---------|----------|--------|
| `calculateFreshness()` | `lib/contextGraph/freshness.ts` | ✅ Exists - field-level freshness score |
| `getFieldFreshness()` | `lib/contextGraph/freshness.ts` | ✅ Exists - WithMeta field freshness |
| `getDomainFreshness()` | `lib/contextGraph/freshness.ts` | ✅ Exists - aggregate per domain |
| `getGraphFreshnessReport()` | `lib/contextGraph/freshness.ts` | ✅ Exists - full graph report |
| `isStale()` / `isFresh()` | `lib/contextGraph/freshness.ts` | ✅ Exists - boolean checks |
| `getStaleFields()` | `lib/contextGraph/freshness.ts` | ✅ Exists - list stale fields |
| `getNeedsRefreshReport()` | `lib/contextGraph/needsRefresh.ts` | ✅ Exists - priority refresh list |

### Doctrine Injection

| Utility | Location | Status |
|---------|----------|--------|
| `buildOperatingPrinciplesPrompt()` | `lib/os/globalContext/index.ts` | ✅ Exists - core principles |
| `buildFullDoctrinePrompt()` | `lib/os/globalContext/index.ts` | ✅ Exists - complete doctrine |
| `buildStrategyDoctrinePrompt()` | `lib/os/globalContext/index.ts` | ✅ Exists - strategy-specific |
| `buildToneRulesPrompt()` | `lib/os/globalContext/index.ts` | ✅ Exists - tone rules |
| `getDoctrineVersion()` | `lib/os/globalContext/index.ts` | ✅ Exists - version tracking |

### Change History / Strategy Impact

| Utility | Location | Status |
|---------|----------|--------|
| `STRATEGY_IMPACTING_FIELDS` | `lib/os/context/strategyImpact.ts` | ✅ Exists - defines critical fields |
| `doesContextChangeAffectStrategy()` | `lib/os/context/strategyImpact.ts` | ✅ Exists - diff detection |
| `shouldRecommendStrategyReview()` | `lib/os/context/strategyImpact.ts` | ✅ Exists - timestamp-based check |
| `detectContextStrategyMismatch()` | `lib/os/context/strategyImpact.ts` | ✅ Exists - hash-based check |
| `createContextVersionRef()` | `lib/os/context/strategyImpact.ts` | ✅ Exists - version snapshot |

### AI Context View

| Utility | Location | Status |
|---------|----------|--------|
| `buildAiContextView()` | `lib/contextGraph/forAi.ts` | ✅ Exists - flattened view |
| `formatForPrompt()` | `lib/contextGraph/forAi.ts` | ✅ Exists - markdown formatting |
| `buildStrategyContext()` | `lib/contextGraph/forAi.ts` | ✅ Exists - strategy-optimized + full doctrine |
| `DoctrineMode` | `lib/contextGraph/forAi.ts` | ✅ Exists - none/operatingPrinciples/full |

---

## 4. Strategy-Ready Minimum Rubric

### Required Fields (MUST be populated for strategy generation)

```typescript
const STRATEGY_READY_MINIMUM = {
  // From strategyImpact.ts STRATEGY_IMPACTING_FIELDS
  required: [
    'identity.businessModel',       // How the business works
    'objectives.primaryObjective',  // What they want to achieve
    'audience.coreSegments',        // Who they're targeting
    'budgetOps.mediaSpendBudget',   // What they can spend
  ],

  // Highly recommended (warn if missing)
  recommended: [
    'identity.geographicFootprint', // Where they operate
    'objectives.timeHorizon',       // When they need results
    'budgetOps.cpaTarget',          // Performance threshold
    'productOffer.avgOrderValue',   // Unit economics
    'operationalConstraints.complianceRequirements', // Legal constraints
  ],

  // Nice to have (no warning)
  optional: [
    'identity.peakSeasons',
    'identity.serviceArea',
    'productOffer.priceRange',
    'budgetOps.customerLTV',
  ],
};
```

### Readiness Status Logic

```typescript
type StrategyReadiness = 'ready' | 'needs_info' | 'blocked';

function computeStrategyReadiness(context): StrategyReadiness {
  const requiredMissing = STRATEGY_READY_MINIMUM.required.filter(
    field => !hasValue(context, field)
  );

  if (requiredMissing.length > 0) return 'blocked';

  const recommendedMissing = STRATEGY_READY_MINIMUM.recommended.filter(
    field => !hasValue(context, field)
  );

  if (recommendedMissing.length >= 3) return 'needs_info';

  return 'ready';
}
```

### Missing Field Reasons (for UI)

| Missing Field | User-Facing Message |
|---------------|---------------------|
| businessModel | "How does the business make money?" |
| primaryObjective | "What's the primary marketing goal?" |
| coreSegments | "Who is the target audience?" |
| mediaSpendBudget | "What's the monthly marketing budget?" |
| geographicFootprint | "Where does the business operate?" |
| timeHorizon | "What's the planning timeframe?" |
| avgOrderValue | "What's the average order value?" |

---

## 5. Gaps Summary

### What's Missing in UI

1. **Go-to-Market & Sales Motion Section** - No UI for sales cycle, channels, primary CTA
2. **Pricing & Unit Economics Section** - No UI for AOV, LTV, margins (exists in graph, not in UI)
3. **Geography & Seasonality Section** - No UI for service area, markets, seasonal peaks
4. **Compliance/Constraints Section** - Limited UI for blackouts, legal, platform restrictions

### What's Missing in AI Context View

1. **User-confirmed notes** - forAi.ts doesn't indicate which fields are user-confirmed vs AI-generated
2. **Freshness per field** - forAi.ts calculates overall freshness but doesn't annotate individual MUST fields
3. **Strategy impact flags** - No indication of which fields drive strategy decisions

### What's Missing in Quality Signals

1. **Visible completeness banner** - No UI showing "Strategy-ready / Needs info" status
2. **Freshness warnings** - No UI showing stale critical fields
3. **Missing field explainer** - No "Why?" drawer listing what's missing

### What's Missing in Regen Triggers

1. **MUST field change tracking** - strategyImpact.ts exists but isn't connected to UI signals
2. **Regen recommended flag** - No derived status for Strategy workspace to consume

---

## 6. Implementation Plan

### Step 2A: Add Missing UI Sections (map to existing graph domains)

1. **Go-to-Market & Sales Motion**
   - Map: `identity.businessModel`, `identity.revenueModel`, `objectives.primaryConversionAction`

2. **Pricing & Unit Economics**
   - Map: `productOffer.priceRange`, `budgetOps.avgOrderValue`, `budgetOps.customerLTV`, `budgetOps.grossMargin`

3. **Geography & Seasonality**
   - Map: `identity.geographicFootprint`, `identity.serviceArea`, `identity.peakSeasons`, `identity.lowSeasons`

4. **Compliance/Constraints**
   - Map: `operationalConstraints.complianceRequirements`, `operationalConstraints.legalRestrictions`, `operationalConstraints.blackoutPeriods`

### Step 2B: Add Quality Banner

1. Compute `strategyReadiness` from STRATEGY_READY_MINIMUM
2. Show banner: "Strategy-ready" (green) / "Needs info" (amber) / "Blocked" (red)
3. Show freshness warnings for stale MUST fields
4. Add "Why?" drawer listing missing/stale fields

### Step 2C: Add Regen Recommended Signal

1. Store `contextVersionRef` when strategy is generated
2. On context save, compare with stored ref using `detectContextStrategyMismatch()`
3. Set `regenRecommended: boolean` flag
4. Strategy workspace reads flag and shows "Context changed - consider regenerating"

### Step 3: AI Context View Improvements

1. Add `userConfirmed: boolean` annotation to MUST fields
2. Add `freshness: 'fresh' | 'stale'` annotation to MUST fields
3. Add `strategyImpact: 'critical' | 'important' | 'minor'` classification
4. Keep prompt length bounded (truncate long blobs, skip empty optional fields)

---

## 7. Non-Goals (Explicitly Out of Scope)

- Company-specific logic or customization
- New parallel context models
- Auto-regeneration (only recommend)
- Changes to write behavior (trust foundation unchanged)
- New data storage (use existing graph domains)
