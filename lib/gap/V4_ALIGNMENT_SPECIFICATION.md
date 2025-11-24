# GAP V4 ALIGNMENT SPECIFICATION

**Status**: Ready for Implementation
**Created**: 2025-11-23
**Objective**: Unify GAP-IA and Full GAP into a cohesive two-phase diagnostic system

---

## EXECUTIVE SUMMARY

The GAP-IA and Full GAP systems currently have good foundations but suffer from 5 critical alignment issues:

1. **Mismatched Language**: IA uses "Foundational/Emerging/Established/Advanced/CategoryLeader" while Full GAP frontend adds "WEAK/STRONG/EXCELLENT" labels
2. **Orphaned Issues**: IA identifies issues that don't clearly surface in Full GAP Strategic Priorities
3. **Inconsistent Tone**: Language feels like two different products despite same canonical taxonomy
4. **Hidden Business Context**: Business context & signals visible in IA but buried in Full GAP
5. **Generic Dimensions**: Some dimension summaries use template language instead of heuristic-grounded specifics

**V4 Solution**: Create tightly-coupled V4 prompts with explicit mapping contracts, unified taxonomy enforcement, and business context surfacing.

---

## CHANGES REQUIRED

### 1. UNIFY SCORING & MATURITY TAXONOMY

#### 1.1 Canonical Maturity Taxonomy (Already correct in prompts, needs frontend enforcement)

```typescript
// UNIFIED TAXONOMY (V4)
type MaturityStage =
  | 'Foundational'    // 0-39:  Foundation nascent, fundamental gaps
  | 'Emerging'        // 40-54: Core elements exist, inconsistent execution
  | 'Established'     // 55-69: Solid presence, optimization opportunities
  | 'Advanced'        // 70-84: Sophisticated operation, minor refinements
  | 'CategoryLeader'; // 85-100: Market-leading, best-in-class

// ❌ DEPRECATED (Remove from frontend):
type OldGradeLabels = 'WEAK' | 'AVERAGE' | 'STRONG' | 'ELITE';
```

#### 1.2 Files to Update

**File**: `components/gap/GrowthPlanNarrativeReport.tsx`
**Change**: Remove `getGradeLabel()` function completely
**Before**:
```typescript
const getGradeLabel = (score: number): string => {
  if (score >= 90) return 'ELITE';
  if (score >= 80) return 'STRONG';
  if (score >= 60) return 'AVERAGE';
  return 'WEAK';
};
const gradeLabel = getGradeLabel(overallScore);
// Display: "WEAK - Overall Growth Score: 40/100"
```

**After**:
```typescript
// Remove getGradeLabel entirely
// Display maturity stage from plan data directly
const maturityStage = plan.executiveSummary?.maturityStage || 'Foundational';
// Display: "Overall Growth Score: 40/100 (Foundational)"
```

**File**: `components/gap-ia/GapIaNarrativeReport.tsx`
**Check**: Verify it does NOT have getGradeLabel() (should already be correct)
**Expected**: Should display "Marketing Readiness: 40/100 (Foundational)" format

---

### 2. MAKE IA A PROPER "FRONT DOOR" INTO FULL GAP

#### 2.1 Problem

Currently, IA identifies:
- 3 top opportunities
- 3 quick wins
- 6 dimension key issues

But there's no guarantee these appear in Full GAP Strategic Priorities or dimension analyses.

#### 2.2 Solution: Explicit Mapping Contract in Full GAP Prompt

**File**: `lib/gap/prompts/fullGapOutputPromptV4.ts`
**Add Section**:

```markdown
═══════════════════════════════════════
CRITICAL: IA → FULL GAP MAPPING CONTRACT
═══════════════════════════════════════

You MUST carry forward ALL high-impact IA findings into this Full GAP plan.

### REQUIRED MAPPINGS

1. **IA Top Opportunities (3 items)**
   → MUST appear in Strategic Priorities (can be expanded/combined)

2. **IA Quick Wins (3 items)**
   → MUST appear in either:
     - Quick Wins section (possibly expanded), OR
     - As sub-actions within Strategic Priorities

3. **IA High-Impact Key Issues**
   → MUST be explicitly addressed in:
     - Dimension Analyses (detailedAnalysis or keyFindings), AND
     - Referenced in Strategic Priorities where relevant

### EXPANSION RULES

✅ **ALLOWED**:
- Expanding IA quick win from 1 sentence to 2-3 sentences with implementation details
- Combining 2 related IA opportunities into 1 comprehensive strategic priority
- Adding NEW strategic priorities beyond IA opportunities (if clearly valuable)
- Providing concrete examples and "how-to" details IA didn't have space for

❌ **NOT ALLOWED**:
- Ignoring or dropping IA top opportunities
- Contradicting IA findings (e.g., IA says "no blog", Full GAP says "blog needs work")
- Creating strategic priorities that ignore IA's identified gaps
- Re-scoring dimensions (scores are read-only from IA)

### VALIDATION

Before finalizing your output, verify:
✅ Every IA top opportunity is reflected in at least 1 strategic priority
✅ Every IA quick win appears in Quick Wins or Strategic Priorities
✅ Every IA dimension key issue is addressed in corresponding dimension analysis
✅ No contradictions between IA findings and Full GAP recommendations
```

#### 2.3 Updated Full GAP Input Format

**File**: `app/api/gap-plan/from-ia/route.ts`
**Change**: Pass complete IA data structure to Full GAP prompt

**Before** (partial IA data):
```typescript
const iaContext = `Initial Assessment Score: ${ia.overallScore}`;
```

**After** (complete structured input):
```typescript
const iaContext = `
INITIAL ASSESSMENT (COMPLETE BRIEFING)
════════════════════════════════════════

Executive Summary: ${ia.executiveSummary}
Overall Score: ${ia.overallScore}/100
Maturity Stage: ${ia.maturityStage}

TOP OPPORTUNITIES (3):
${ia.topOpportunities.map((opp, i) => `${i+1}. ${opp}`).join('\n')}

QUICK WINS (3):
${ia.quickWins.map((qw, i) => `${i+1}. ${qw.action} [${qw.dimensionId}, impact: ${qw.impactLevel}]`).join('\n')}

DIMENSION SUMMARIES (6):
${ia.dimensionSummaries.map(dim => `
- ${dim.id}: ${dim.score}/100
  Summary: ${dim.summary}
  Key Issue: ${dim.keyIssue}
`).join('\n')}
`;
```

---

### 3. ALIGN LANGUAGE AND TONE

#### 3.1 Executive Summary Format (Both IA and Full GAP)

**Standard Format**:
```
"[Report Type]: [Score]/100 ([MaturityStage]). [What's working]. [What's not working and why it matters for THIS business type]."
```

**IA Example**:
```
"Marketing Readiness: 34/100 (Foundational). The site has strong visual branding and clear event photography. However, for a local farmers market, the absence of a Google Business Profile means zero visibility in Google Maps and local search, and missing event schedules prevent visitors from planning attendance."
```

**Full GAP Example** (2-3 paragraphs, but first sentence must follow format):
```
"Overall Growth Score: 34/100 (Foundational). This farmers market faces critical foundational gaps in digital discoverability despite strong brand visuals. The strategic theme for the next 90 days is establishing basic digital presence infrastructure.

[Paragraph 2: Strategic theme expansion...]

[Paragraph 3: Expected outcomes...]"
```

#### 3.2 Prohibited Language (Enforce in both prompts)

**Never use in headings or summaries**:
- ❌ "WEAK - Overall Score"
- ❌ "POOR performance"
- ❌ "FAILING in SEO"
- ❌ "EXCELLENT brand work"
- ❌ "STRONG authority signals"

**Use instead**:
- ✅ "Overall Score: 30/100 (Foundational)"
- ✅ "SEO: 25/100 (critical gaps in metadata and structured data)"
- ✅ "Brand: 75/100 (well-executed positioning with minor refinements needed)"

---

### 4. SURFACE BUSINESS CONTEXT & SIGNALS IN FULL GAP

#### 4.1 Problem

Business context (business type, brand tier, digital footprint signals) is visible in IA but not prominently displayed in Full GAP reports.

#### 4.2 Solution: Add "Context Snapshot" Block to Full GAP Component

**File**: `components/gap/GrowthPlanNarrativeReport.tsx`
**Location**: Add near the top, after the title and before Executive Summary

**New Component Section**:
```tsx
{/* Business Context Snapshot */}
<section className="mb-8 rounded-lg border border-amber-700/50 bg-amber-900/10 p-6">
  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-amber-400">
    Business Context Snapshot
  </h3>

  <div className="grid grid-cols-2 gap-4 text-sm">
    <div>
      <div className="text-xs text-slate-400 mb-1">Business Type</div>
      <div className="font-medium text-slate-200">
        {formatBusinessType(plan.businessContext?.businessType || 'unknown')}
      </div>
    </div>

    <div>
      <div className="text-xs text-slate-400 mb-1">Brand Tier</div>
      <div className="font-medium text-slate-200">
        {formatBrandTier(plan.businessContext?.brandTier || 'other')}
      </div>
    </div>

    <div>
      <div className="text-xs text-slate-400 mb-1">Maturity Stage</div>
      <div className="font-medium text-slate-200">
        {plan.executiveSummary?.maturityStage || 'Foundational'}
      </div>
    </div>

    <div>
      <div className="text-xs text-slate-400 mb-1">Overall Score</div>
      <div className="text-xl font-bold text-amber-400">
        {plan.executiveSummary?.overallScore || 0}/100
      </div>
    </div>
  </div>

  {/* Digital Footprint Summary */}
  <div className="mt-4 border-t border-amber-800/30 pt-4">
    <div className="text-xs text-slate-400 mb-2">Digital Footprint Signals</div>
    <div className="flex flex-wrap gap-2 text-xs">
      <SignalBadge
        label="Google Business Profile"
        status={plan.digitalFootprint?.googleBusinessProfile?.found}
      />
      <SignalBadge
        label="LinkedIn"
        status={plan.digitalFootprint?.linkedin?.found}
      />
      <SignalBadge
        label="Instagram"
        status={plan.digitalFootprint?.instagram}
      />
      <SignalBadge
        label="Facebook"
        status={plan.digitalFootprint?.facebook}
      />
      {plan.digitalFootprint?.reviews && (
        <SignalBadge
          label={`Reviews (${plan.digitalFootprint.reviews.count})`}
          status={plan.digitalFootprint.reviews.count > 0}
        />
      )}
    </div>
  </div>
</section>

// Helper component
function SignalBadge({ label, status }: { label: string; status: boolean | undefined }) {
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${
      status
        ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/50'
        : 'bg-slate-800/50 text-slate-400 border border-slate-700/50'
    }`}>
      {status ? '✓' : '✗'} {label}
    </span>
  );
}
```

#### 4.3 Data Flow for Business Context

**Ensure this data flows through the entire pipeline**:

1. **IA Generation** → Populates `businessType`, `brandTier`, `businessName` in output
2. **IA Storage** → Saved to Airtable `dataJson.businessContext`
3. **Full GAP Generation** → Receives complete business context from IA
4. **Full GAP Storage** → Stores business context in its own data structure
5. **Full GAP Display** → Shows in Context Snapshot block

**File**: `app/api/gap-plan/from-ia/route.ts`
**Check**: Verify business context is passed to Full GAP prompt and saved to output

---

### 5. TIGHTEN DIMENSION SPECIFICITY & HEURISTIC GROUNDING

#### 5.1 Problem

Dimensions sometimes use generic language ("SEO needs work") instead of concrete, heuristic-grounded issues.

#### 5.2 Solution: Structured Input Signals Block in Both Prompts

**Add to both IA V4 and Full GAP V4 prompts**:

```markdown
════════════════════════════════════════
STRUCTURED INPUT SIGNALS
════════════════════════════════════════

You will receive context data in this format. **Ground ALL dimension assessments in these signals:**

{
  "digitalFootprint": {
    "googleBusinessProfile": { "found": false, "hasReviews": false },
    "linkedin": { "found": true, "followerBucket": "100-1k", "postingCadence": "rare" },
    "instagram": true,
    "facebook": true,
    "youtube": false
  },
  "contentSignals": {
    "blogFound": false,
    "blogPostCount": 0,
    "resourcePagesFound": 0,
    "caseStudyPagesFound": 0,
    "contentDepthRating": "thin"
  },
  "technicalSignals": {
    "hasMetaDescriptions": false,
    "hasStructuredData": false,
    "pageSpeedScore": 42,
    "mobileResponsive": true
  },
  "websiteSignals": {
    "hasPricing": false,
    "hasSchedule": false,
    "hasClearCTAs": false,
    "navigationClarity": "moderate"
  }
}

**CRITICAL ANTI-DUPLICATION RULES:**

If `googleBusinessProfile.found === false`:
→ Mention ONLY in "digitalFootprint" dimension
→ DO NOT mention in "seo" or "authority" dimensions

If `blogFound === false`:
→ Mention ONLY in "content" dimension
→ DO NOT mention in "seo" or "website" dimensions

If `hasMetaDescriptions === false`:
→ Mention ONLY in "seo" dimension
→ DO NOT mention in other dimensions

If `hasSchedule === false` (for local business):
→ Mention ONLY in "website" dimension (user experience issue)
→ DO NOT mention in other dimensions
```

#### 5.3 Dimension-Specific Heuristic Requirements

**Each dimension must cite actual detected signals, not invented issues.**

**Examples of Good vs Bad**:

❌ **BAD (Generic)**:
```json
{
  "id": "seo",
  "score": 30,
  "keyIssue": "SEO needs significant work across multiple areas"
}
```

✅ **GOOD (Heuristic-Grounded)**:
```json
{
  "id": "seo",
  "score": 30,
  "keyIssue": "Missing meta descriptions on 3 of 5 pages; no structured data (schema markup) detected; page speed score of 42/100"
}
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Prompt Updates
- [ ] Create `gapIaOutputPromptV4.ts` with V4 enhancements (DONE)
- [ ] Create `fullGapOutputPromptV4.ts` with mapping contract
- [ ] Update `sharedPrompts.ts` with canonical maturity taxonomy reference
- [ ] Test prompts with sandbox URLs

### Phase 2: Frontend Updates
- [ ] Update `components/gap/GrowthPlanNarrativeReport.tsx`:
  - [ ] Remove `getGradeLabel()` function
  - [ ] Display maturity stage instead of WEAK/STRONG labels
  - [ ] Add Business Context Snapshot section
  - [ ] Format header as "Overall Growth Score: X/100 (MaturityStage)"
- [ ] Verify `components/gap-ia/GapIaNarrativeReport.tsx` uses correct format (should already be good)
- [ ] Test all report pages render correctly

### Phase 3: API Route Updates
- [ ] Update `app/api/gap-ia/run/route.ts`:
  - [ ] Switch to `GAP_IA_OUTPUT_PROMPT_V4`
  - [ ] Ensure business context is always populated
  - [ ] Pass structured input signals format
- [ ] Update `app/api/gap-plan/from-ia/route.ts`:
  - [ ] Switch to `FULL_GAP_OUTPUT_PROMPT_V4`
  - [ ] Pass complete IA structured data (opportunities, quick wins, dimension issues)
  - [ ] Ensure business context flows through
- [ ] Test end-to-end IA → Full GAP flow

### Phase 4: Validation
- [ ] Run test URLs through sandbox:
  - [ ] https://www.qafm.org (local-consumer)
  - [ ] https://www.pikeplacemarket.org (local-consumer, more mature)
  - [ ] https://tim.blog (media/personal brand)
  - [ ] https://www.hubspot.com (B2B SaaS, category leader)
  - [ ] DTC ecommerce site
  - [ ] B2B services/consulting site
- [ ] Verify for each test:
  - [ ] IA and Full GAP use same maturity labels
  - [ ] No "WEAK/STRONG" labels in Full GAP display
  - [ ] IA top issues appear in Full GAP Strategic Priorities
  - [ ] Business Context Snapshot appears in Full GAP
  - [ ] Dimensions are heuristic-grounded (no generic language)
  - [ ] No duplicate issues across dimensions

### Phase 5: Cleanup
- [ ] Deprecate V3 prompts (rename to `.deprecated.ts` or move to archive folder)
- [ ] Update documentation
- [ ] Create regression test suite with canonical examples

---

## EXPECTED OUTCOMES

### Before V4:
```
IA Report:
  Marketing Readiness: 40/100 (Foundational)
  Dimensions: Specific, heuristic-grounded
  Top opportunities: Clear
  Quick wins: Clear

Full GAP Report:
  ❌ Header: "WEAK - Overall Growth Score: 40/100"
  ❌ Some IA opportunities not in Strategic Priorities
  ❌ Business context hidden
  ❌ Some generic dimension language
```

### After V4:
```
IA Report:
  Marketing Readiness: 40/100 (Foundational)
  Dimensions: Specific, heuristic-grounded
  Top opportunities: Clear
  Quick wins: Clear

Full GAP Report:
  ✅ Header: "Overall Growth Score: 40/100 (Foundational)"
  ✅ Business Context Snapshot visible at top
  ✅ All IA opportunities mapped to Strategic Priorities
  ✅ All dimensions heuristic-grounded
  ✅ Tone consistent with IA (consultative, specific)
  ✅ No contradictions with IA findings
```

---

## SUCCESS METRICS

1. **Taxonomy Consistency**: 100% of reports use Foundational/Emerging/Established/Advanced/CategoryLeader (no WEAK/STRONG)
2. **Issue Mapping**: 100% of IA top opportunities appear in Full GAP Strategic Priorities
3. **Business Context Visibility**: 100% of Full GAP reports show Business Context Snapshot
4. **Heuristic Grounding**: 0% generic dimension summaries ("SEO needs work" → "Missing meta descriptions on 3/5 pages")
5. **No Contradictions**: 0% conflicts between IA and Full GAP findings

---

## ROLLOUT PLAN

### Option A: Big Bang (Recommended)
1. Deploy all V4 changes together
2. Test thoroughly in sandbox first
3. Switch production to V4 prompts simultaneously
4. Monitor first 50 reports for quality

### Option B: Gradual
1. Deploy IA V4 prompt first (1 week testing)
2. Deploy Full GAP V4 prompt (1 week testing)
3. Deploy frontend changes (Business Context Snapshot)
4. Deploy label removal (WEAK → Foundational)

**Recommendation**: Option A (Big Bang) because changes are tightly coupled.

---

## FILES MODIFIED SUMMARY

### New Files
- `lib/gap/prompts/gapIaOutputPromptV4.ts` (CREATED)
- `lib/gap/prompts/fullGapOutputPromptV4.ts` (TO CREATE)
- `lib/gap/V4_ALIGNMENT_SPECIFICATION.md` (this file)

### Modified Files
- `components/gap/GrowthPlanNarrativeReport.tsx` (remove getGradeLabel, add Context Snapshot)
- `app/api/gap-ia/run/route.ts` (switch to V4 prompt, pass structured signals)
- `app/api/gap-plan/from-ia/route.ts` (switch to V4 prompt, pass complete IA data)

### Deprecated Files
- `lib/gap/prompts/gapIaOutputPromptV3.ts` → `.deprecated.ts`
- `lib/gap/prompts/fullGapOutputPromptV3.ts` → `.deprecated.ts`

---

**END OF SPECIFICATION**
