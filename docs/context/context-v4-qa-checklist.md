# Context V4 QA Checklist

Comprehensive QA checklist for verifying Context V4 features including the core proposal workflow, convergence, and evidence grounding.

## Prerequisites

- [ ] Environment variables set:
  - `CONTEXT_V4_ENABLED=true`
  - `CONTEXT_V4_INGEST_WEBSITELAB=true`
  - `CONTEXT_V4_CONVERGENCE_ENABLED=true` (for convergence features)
- [ ] Test company with completed WebsiteLab run

---

## Part 1: Core V4 Proposal System

### 1. Proposal Cooldown

**Test: Verify 45-second cooldown after generating proposals**

1. Navigate to `/context-v4/[companyId]`
2. Click "Generate Proposals" button
3. Wait for proposals to complete
4. Attempt to click "Generate Proposals" again immediately
5. **Expected**: Button shows "Recently generated (Xs)" countdown
6. Wait 45 seconds
7. **Expected**: Button becomes active again

**API Test:**
```bash
# First call should succeed
curl -X POST /api/os/companies/[companyId]/context/v4/propose-baseline

# Second call within 45s should return 429
curl -X POST /api/os/companies/[companyId]/context/v4/propose-baseline
# Expected: 429 Too Many Requests with Retry-After header
```

---

### 2. Alternatives Cap

**Test: Verify max 5 alternatives per field**

1. Run multiple proposal sources for the same field
2. Check the review queue
3. **Expected**: Each field shows max 5 alternatives ("+N alt" badge)
4. Alternatives should be ordered by: priority > confidence > recency

---

### 3. Confirmed Snapshot

**Test: Verify snapshot endpoint returns confirmed-only fields**

1. Confirm at least 3 fields in the review queue
2. Call the snapshot endpoint:
```bash
curl /api/os/companies/[companyId]/context/v4/snapshot
```
3. **Expected Response**:
   - `snapshotId` starts with "snap_"
   - `fieldCount` matches confirmed count
   - `confirmedFieldsOnly` array contains only confirmed fields
   - No proposed fields included

---

### 4. Readiness Gate

**Test: Verify Strategy is blocked when readiness < 60%**

1. Clear/reset V4 store for test company
2. Navigate to Strategy generation page
3. **Expected**: "Context Not Ready" warning with missing fields list
4. Click on a missing field link
5. **Expected**: Navigates to Review Queue with domain filter
6. Confirm enough fields to reach 60% readiness
7. **Expected**: Generate button becomes active

**Override Test:**
1. With readiness < 60%, click locked generate button
2. Click "Generate Anyway" in confirmation dialog
3. **Expected**: Generation proceeds with warning

**API Test:**
```bash
curl /api/os/companies/[companyId]/context/v4/readiness?threshold=60
```
**Expected fields:**
- `readinessScore`: 0-100
- `ready`: boolean
- `requiredKeysMissing`: array of field keys
- `requiredKeysProposed`: array of field keys awaiting review

---

### 5. Navigation Consistency

**Test: Verify sub-nav appears on all Context V4 pages**

1. Navigate to `/context-v4/[companyId]` (Fact Sheet)
   - [ ] Sub-nav visible with tabs: Fact Sheet | Review | Fields
   - [ ] Badge counts display correctly

2. Navigate to `/context-v4/[companyId]/review` (Review Queue)
   - [ ] Same sub-nav visible
   - [ ] Active tab highlighted

3. Test breadcrumb "Back to Context"
   - [ ] Returns to last-used view

**Filter Persistence Test:**
1. In Review Queue, filter by domain (e.g., "website")
2. Navigate away and back
3. **Expected**: Filter maintained via URL params

---

### 6. End-to-End Flow

**Full integration test:**

1. Start with empty V4 store
2. Complete WebsiteLab run for test company
3. Navigate to `/context-v4/[companyId]`
4. Check nextAction banner shows "Ready to Generate"
5. Click "Generate Proposals"
6. Verify cooldown activates
7. Navigate to Review Queue
8. Verify proposals appear with trust badges
9. Confirm 3-5 key fields
10. Check readiness score increases
11. Generate snapshot via API
12. Verify snapshot contains confirmed fields only

---

## Part 2: Convergence Features

Requires `CONTEXT_V4_CONVERGENCE_ENABLED=true`

### 7. Decision Impact Scoring

Proposals are tagged with decision impact levels:

- **HIGH**: Positioning, value proposition, audience, ICP
- **MEDIUM**: Business model, channels, budget
- **LOW**: Executive summaries, website summaries, descriptions

#### Verification Steps

1. Run a Lab (Brand Lab or Website Lab) on a test company
2. Open the Review Queue
3. Verify proposals show impact badges (HIGH/MEDIUM/LOW)
4. Verify LOW impact proposals are hidden by default
5. Click "Show low-impact" to reveal hidden proposals

---

### 8. Specificity Scoring

Proposals are scored 0-100 for specificity:

- **70+**: Good - concrete, specific content
- **45-69**: Moderate - some generic elements
- **<45**: Low - generic, cliche-heavy content

#### Verification Steps

1. Create proposals with generic text ("innovative solutions for businesses")
2. Verify low specificity score (<50)
3. Create proposals with specific text ("B2B SaaS for marketing teams at 50-200 employee companies")
4. Verify high specificity score (>70)
5. Hover over specificity badge to see genericness reasons

---

### 9. Summary-Shaped Field Gating

Summary fields are automatically marked LOW impact and hidden:

- `website.executiveSummary`
- `website.websiteSummary`
- `identity.companyDescription`

#### Verification Steps

1. Run Website Lab on a company
2. Check that executive summary proposals are hidden by default
3. Enable "Show low-impact" filter
4. Verify summary fields appear with LOW impact badge

---

### 10. Confirm Best per Domain

One-click action to confirm highest-ranked proposal per domain.

#### Verification Steps

1. Create multiple proposals across different domains
2. Click "Confirm Best per Domain" button
3. Verify one proposal per domain is confirmed
4. Verify remaining proposals in same domain are rejected
5. Check ranking used: impact > confidence > specificity > recency

**API Endpoint:**

```bash
POST /api/os/context/proposals/confirm-best
```

```json
// Request
{
  "companyId": "company-123",
  "domains": ["Brand", "Audience"],
  "userId": "user-123"
}

// Response
{
  "success": true,
  "confirmedCount": 3,
  "rejectedCount": 7,
  "domainsProcessed": ["Brand", "Audience", "ProductOffer"],
  "confirmed": [...],
  "rejected": [...]
}
```

---

### 11. HubSpot/Mailchimp Differentiation

The main goal: similar companies should no longer have identical proposals.

#### Verification Steps

1. Run Brand Lab on HubSpot-like company
2. Run Brand Lab on Mailchimp-like company
3. Compare positioning/value prop proposals
4. Verify proposals are distinctive, not template-y
5. Check specificityScore - should trigger rewrite if <45

---

## Part 3: Evidence Grounding

### 12. Evidence Anchors

Each proposal can include `evidenceAnchors`: an array of quotes from the company's website.

```typescript
interface EvidenceAnchor {
  url?: string;       // Source page URL (if available)
  pageTitle?: string; // Page title
  quote: string;      // Concrete quote (max 200 chars)
}
```

#### Specificity Bonuses/Penalties

| Condition | Specificity Impact |
|-----------|-------------------|
| No evidence anchors | -20 points |
| 1+ evidence anchors | +15 points |
| 2+ evidence anchors | +5 additional points |
| Each cliché found | -3 points (max -30) |
| Generic audience term | -5 points (max -20) |
| Company name mentioned | +10 points |
| Category terms present | +10 points |
| Segment terms present | +10 points |

#### Verification Steps: Evidence Anchors in UI

1. Run BrandLab on a company with an accessible website
2. Open the Review Queue
3. For any proposal, click the "Evidence" expander
4. Verify that:
   - Each evidence anchor has a quote from the website
   - Quotes are <= 200 characters
   - Links point back to source pages (when available)
5. If no evidence found, verify the "Ungrounded proposal" warning appears

---

### 13. Field Validation Requirements

The following fields have strict validation rules to ensure specificity:

| Field | Requirements |
|-------|--------------|
| `brand.positioning` | Must include product category (platform, software, tool) AND specific audience (not just "businesses") |
| `productOffer.valueProposition` | Must include concrete outcome (increase/reduce/save) AND mechanism (by/using/through) |
| `audience.primaryAudience` | Must include at least one concrete segment (B2B SaaS, SMB, enterprise, etc.) |
| `audience.icpDescription` | Must include firmographics (company size, stage) OR role/team + buying trigger |

#### Verification Steps

1. Create a test proposal with generic positioning:
   ```
   "We help businesses grow with innovative solutions"
   ```
2. Verify the proposal shows validation errors:
   - Missing product category
   - Generic audience term ("businesses")
3. Create a specific positioning:
   ```
   "Marketing automation platform for B2B SaaS companies with 50-200 employees"
   ```
4. Verify validation passes (no errors)

---

### 14. Cliché Detection

Test the following phrases are detected as clichés:
- "innovative" / "seamless" / "future-ready"
- "adapt and grow" / "changing market" / "thrive"
- "streamline" / "empower" / "transform"
- "cutting-edge" / "best-in-class" / "world-class"

#### Verification Steps

1. Create proposal with multiple clichés
2. Verify specificity score is penalized (-3 per cliché)
3. Verify genericnessReasons lists found clichés

---

### 15. Error State Gating

Proposals are blocked when diagnostics fail to access the website.

**Blocked States:**
- WebsiteLab status: `blocked` or `error`
- BrandLab status: `error`

#### Verification Steps

1. Run diagnostic on a site that returns 403/blocked
2. Verify no proposals are generated
3. Check batch reasoning mentions the error:
   ```
   "Proposals blocked: Website returned 403"
   ```
4. Verify Review Queue shows "Proposals blocked" message

---

### 16. Site Snapshot

#### Verification Steps

1. Check that homepage text is extracted from WebsiteLab/BrandLab results
2. Verify key pages are captured (/pricing, /customers, /solutions, /about)
3. Verify text truncation works (max 6k chars per page)
4. Test with:
   ```typescript
   import { _testing } from '@/lib/contextGraph/v4/siteSnapshot';
   const truncated = _testing.truncateText('x'.repeat(10000), 6000);
   console.assert(truncated.length === 6000);
   ```

---

## Regression Checklist

### With Convergence Flag OFF (`CONTEXT_V4_CONVERGENCE_ENABLED=false`):

- [ ] Review Queue works normally
- [ ] No impact/specificity badges shown
- [ ] No "Confirm Best per Domain" button
- [ ] No hidden proposals filter
- [ ] Existing proposal accept/reject works

### With Convergence Flag ON:

- [ ] All existing functionality still works
- [ ] Impact badges appear on proposals
- [ ] Specificity scores computed correctly
- [ ] Low-impact proposals hidden by default
- [ ] "Show low-impact" toggle works
- [ ] "Confirm Best per Domain" accepts best, rejects rest
- [ ] Summary fields marked appropriately
- [ ] API endpoint returns correct counts
- [ ] Evidence anchors shown in expander
- [ ] Ungrounded proposals show warning
- [ ] Proposals blocked for error state diagnostics

---

## Testing

Run the test suite:

```bash
npm test -- tests/context/v4-convergence.test.ts
```

Expected coverage:
- Specificity scoring heuristics
- Decision impact inference
- Summary-shaped detection
- Candidate enhancement
- Proposal ranking
- Domain grouping
- Evidence anchor validation
- Site snapshot extraction
- Evidence extraction
- Evidence-based specificity scoring
- Proposal batch error gating

---

## Smoke Test Commands

```bash
# Check V4 is enabled
curl /api/os/companies/[companyId]/context/v4/inspect

# Check readiness
curl /api/os/companies/[companyId]/context/v4/readiness

# Get snapshot
curl /api/os/companies/[companyId]/context/v4/snapshot

# Get review queue
curl /api/os/companies/[companyId]/context/v4/review
```

---

## Known Limitations

1. Cooldown is in-memory (resets on server restart in dev)
2. Snapshot does not persist (generated on-demand)
3. Alternatives eviction happens silently (no user notification)
4. Convergence rewrite (LLM-based) not yet implemented
5. Specificity scoring is heuristic-based, not ML
6. Generic cliché list may need expansion
7. Source priority in ranking uses trigger, not actual source
8. Evidence extraction relies on keyword matching, not semantic similarity

---

## Files Modified

### Types
- `lib/types/contextField.ts` - DecisionImpact, DecisionGradeMetadata, EvidenceAnchor
- `lib/contextGraph/nodes/types.ts` - Extended ContextProposal with evidence fields
- `lib/contextGraph/nodes/hydration.ts` - Extended HydratedContextNode with evidence propagation

### Core Logic
- `lib/contextGraph/v4/convergence.ts` - Main convergence module with evidence-based scoring
- `lib/contextGraph/v4/siteSnapshot.ts` - Website text extraction for evidence grounding
- `lib/contextGraph/v4/evidenceGrounding.ts` - Field validation rules and evidence grounding
- `lib/contextGraph/v4/labProposals.ts` - Lab-to-proposal conversion with evidence
- `lib/contextGraph/v4/index.ts` - V4 module exports
- `lib/contextGraph/nodes/proposalStorage.ts` - Proposal enhancement with error state gating

### API
- `app/api/os/context/proposals/confirm-best/route.ts` - New endpoint

### UI
- `components/context-map/ProposalReviewPanel.tsx` - Badges, filtering, button, evidence expander, ungrounded warning

### Config
- `lib/config/featureFlags.ts` - CONTEXT_V4_CONVERGENCE_ENABLED

### Tests
- `tests/context/v4-convergence.test.ts` - Comprehensive test suite

---

**Last Updated**: December 2024
**Owner**: Platform Team
