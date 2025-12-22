# Context V4 Convergence QA Checklist

This document provides verification steps for the Context V4 Convergence feature.

## Feature Flag

The V4 Convergence features are behind a feature flag:

```bash
CONTEXT_V4_CONVERGENCE_ENABLED=true
```

When disabled (default), all behavior matches current production.

## Core Features

### 1. Decision Impact Scoring

Proposals are now tagged with decision impact levels:

- **HIGH**: Positioning, value proposition, audience, ICP
- **MEDIUM**: Business model, channels, budget
- **LOW**: Executive summaries, website summaries, descriptions

#### Verification Steps

1. Run a Lab (Brand Lab or Website Lab) on a test company
2. Open the Review Queue
3. Verify proposals show impact badges (HIGH/MEDIUM/LOW)
4. Verify LOW impact proposals are hidden by default
5. Click "Show low-impact" to reveal hidden proposals

### 2. Specificity Scoring

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

### 3. Summary-Shaped Field Gating

Summary fields are automatically marked LOW impact and hidden:

- `website.executiveSummary`
- `website.websiteSummary`
- `identity.companyDescription`

#### Verification Steps

1. Run Website Lab on a company
2. Check that executive summary proposals are hidden by default
3. Enable "Show low-impact" filter
4. Verify summary fields appear with LOW impact badge

### 4. Confirm Best per Domain

One-click action to confirm highest-ranked proposal per domain.

#### Verification Steps

1. Create multiple proposals across different domains
2. Click "Confirm Best per Domain" button
3. Verify one proposal per domain is confirmed
4. Verify remaining proposals in same domain are rejected
5. Check ranking used: impact > confidence > specificity > recency

### 5. HubSpot/Mailchimp Differentiation

The main goal: similar companies should no longer have identical proposals.

#### Verification Steps

1. Run Brand Lab on HubSpot-like company
2. Run Brand Lab on Mailchimp-like company
3. Compare positioning/value prop proposals
4. Verify proposals are distinctive, not template-y
5. Check specificityScore - should trigger rewrite if <45

### 6. Evidence Grounding

Proposals are grounded in actual website content via evidence anchors.

#### Evidence Anchors

Each proposal can include `evidenceAnchors`: an array of quotes from the company's website.

```typescript
interface EvidenceAnchor {
  url?: string;      // Source page URL
  pageTitle?: string; // Page title
  quote: string;      // Exact quote (max 200 chars)
}
```

#### Specificity Bonuses/Penalties

- **-20 points**: No evidence anchors (ungrounded proposal)
- **+15 points**: Has 1+ evidence anchors
- **+5 points**: Has 2+ evidence anchors

#### Verification Steps

1. Run a Lab on a company with accessible website
2. Open Review Queue and check a proposal
3. Click "Evidence" expander to see grounding quotes
4. Verify quotes link back to source pages
5. Check proposals with no evidence show "Ungrounded proposal" warning

### 7. Error State Gating

Proposals are blocked when diagnostics fail to access the website.

#### Blocked States

- WebsiteLab status: `blocked` or `error`
- BrandLab status: `error`

#### Verification Steps

1. Run diagnostic on a site that returns 403/blocked
2. Verify no proposals are generated
3. Check batch reasoning mentions the error
4. Verify "Proposals blocked" message in Review Queue

### 8. Ungrounded Proposal Warning

Proposals without evidence show a warning in the Review Queue.

#### Verification Steps

1. Create a proposal with empty `evidenceAnchors: []`
2. Open Review Queue
3. Verify orange "Ungrounded proposal" banner appears
4. Verify specificity score is penalized (-20)

## API Endpoints

### POST `/api/os/context/proposals/confirm-best`

Confirms the best proposal per domain.

```json
// Request
{
  "companyId": "company-123",
  "domains": ["Brand", "Audience"],  // optional
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

## Regression Checklist

With flag OFF (`CONTEXT_V4_CONVERGENCE_ENABLED=false`):

- [ ] Review Queue works normally
- [ ] No impact/specificity badges shown
- [ ] No "Confirm Best per Domain" button
- [ ] No hidden proposals filter
- [ ] Existing proposal accept/reject works

With flag ON:

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

## Evidence Grounding Verification

### Overview

Evidence grounding ensures proposals are decision-grade by requiring concrete evidence from the company's website. This eliminates generic SaaS summaries like "innovative solutions" in favor of specific, verifiable statements.

### Evidence Anchor Structure

```typescript
interface EvidenceAnchor {
  url?: string;       // Source page URL (if available)
  pageTitle?: string; // Page title
  quote: string;      // Concrete quote (max 200 chars)
}
```

### Field Validation Requirements

The following fields have strict validation rules to ensure specificity:

| Field | Requirements |
|-------|--------------|
| `brand.positioning` | Must include product category (platform, software, tool) AND specific audience (not just "businesses") |
| `productOffer.valueProposition` | Must include concrete outcome (increase/reduce/save) AND mechanism (by/using/through) |
| `audience.primaryAudience` | Must include at least one concrete segment (B2B SaaS, SMB, enterprise, etc.) |
| `audience.icpDescription` | Must include firmographics (company size, stage) OR role/team + buying trigger |

### Verification Steps: Evidence Anchors in UI

1. Run BrandLab on a company with an accessible website
2. Open the Review Queue
3. For any proposal, click the "Evidence" expander
4. Verify that:
   - Each evidence anchor has a quote from the website
   - Quotes are <= 200 characters
   - Links point back to source pages (when available)
5. If no evidence found, verify the "Ungrounded proposal" warning appears

### Verification Steps: Validation Rules

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

### Verification Steps: Cliché Detection

Test the following phrases are detected as clichés:
- "innovative" / "seamless" / "future-ready"
- "adapt and grow" / "changing market" / "thrive"
- "streamline" / "empower" / "transform"
- "cutting-edge" / "best-in-class" / "world-class"

1. Create proposal with multiple clichés
2. Verify specificity score is penalized (-3 per cliché)
3. Verify genericnessReasons lists found clichés

### Verification Steps: Error State Blocking

1. Run a diagnostic on a website that returns 403/blocked
2. Verify no proposals are generated
3. Check that batch reasoning mentions the error:
   ```
   "Proposals blocked: Website returned 403"
   ```
4. Verify Review Queue shows "Proposals blocked" message

### Verification Steps: Site Snapshot

1. Check that homepage text is extracted from WebsiteLab/BrandLab results
2. Verify key pages are captured (/pricing, /customers, /solutions, /about)
3. Verify text truncation works (max 6k chars per page)
4. Test with:
   ```typescript
   import { _testing } from '@/lib/contextGraph/v4/siteSnapshot';
   const truncated = _testing.truncateText('x'.repeat(10000), 6000);
   console.assert(truncated.length === 6000);
   ```

### Scoring Impact

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

## Known Limitations

1. Convergence rewrite (LLM-based) not yet implemented
2. Specificity scoring is heuristic-based, not ML
3. Generic cliche list may need expansion
4. Source priority in ranking uses trigger, not actual source
5. Evidence extraction relies on keyword matching, not semantic similarity

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
- `tests/context/v4-convergence.test.ts` - Comprehensive test suite (75 tests)
