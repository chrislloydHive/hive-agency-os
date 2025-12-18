# Website/UX Diagnostics Module

**First OS Diagnostic Pillar** - Evaluates website UX quality using deterministic evidence + AI interpretation.

## Overview

This module:
1. **Collects Evidence**: HTML structure (Cheerio) + PageSpeed metrics (Google API)
2. **AI Analysis**: OpenAI interprets evidence and returns structured diagnostics
3. **Scores 1-10**: Strict UX-only scoring (not brand, SEO, or content)

## Type Structure

```typescript
// Core diagnostic result
type WebsiteUxDiagnostic = {
  score: number;              // 1-10 integer
  justification: string;
  issues: WebsiteUxIssue[];
  priorities: WebsiteUxPriority[];
};

// Issue with severity
type WebsiteUxIssue = {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
};

// Priority with impact/effort
type WebsiteUxPriority = {
  id: string;
  title: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  rationale: string;
};

// Evidence collected
type WebsiteUxEvidence = {
  url: string;
  structure: WebsiteUxStructureSnapshot;
  speed: WebsiteUxSpeedSnapshot;
};

// HTML structure evidence
type WebsiteUxStructureSnapshot = {
  title?: string;
  metaDescription?: string;
  h1?: string;
  heroText?: string;           // H1 + first <p> after it
  primaryCtaAboveFold: boolean; // Detects common CTA patterns
  hasContactForm: boolean;
};

// PageSpeed evidence
type WebsiteUxSpeedSnapshot = {
  performanceScore?: number;    // 0-100
  lcp?: number;                 // Largest Contentful Paint (ms)
  cls?: number;                 // Cumulative Layout Shift
  inp?: number;                 // Interaction to Next Paint (ms)
};
```

## Setup

Required environment variables:

```bash
OPENAI_API_KEY=sk-...           # Required
PAGESPEED_API_KEY=AIza...       # Optional (recommended)
```

## Usage

### Run Full Diagnostics

```typescript
import { runWebsiteUxDiagnostics } from '@/lib/diagnostics/websiteUx';

const diagnostic = await runWebsiteUxDiagnostics({
  id: 'company-123',
  name: 'Example Company',
  websiteUrl: 'https://example.com',
  industry: 'SaaS',
  stage: 'Series A',
});

console.log(`UX Score: ${diagnostic.score}/10`);
console.log(`Justification: ${diagnostic.justification}`);
console.log(`Issues: ${diagnostic.issues.length}`);
console.log(`Priorities: ${diagnostic.priorities.length}`);
```

### Collect Evidence Only

```typescript
import { collectWebsiteUxEvidence } from '@/lib/diagnostics/websiteUx';

const evidence = await collectWebsiteUxEvidence('https://example.com');

console.log(evidence.structure.title);
console.log(evidence.structure.primaryCtaAboveFold);
console.log(evidence.speed.performanceScore);
```

## Test API

Test the diagnostics via API endpoint:

```bash
# Test with URL only
curl "http://localhost:3000/api/test-website-ux?url=https://apple.com"

# Test with URL and company name
curl "http://localhost:3000/api/test-website-ux?url=https://stripe.com&name=Stripe"
```

**Response Format:**

```json
{
  "score": 8,
  "justification": "Strong UX with clear hierarchy and fast performance. Well-designed conversion paths with obvious CTAs.",
  "issues": [
    {
      "id": "issue-1",
      "title": "Hero text could be more specific",
      "description": "The hero section is generic. Consider making the value prop more concrete and benefit-focused.",
      "severity": "medium"
    },
    {
      "id": "issue-2",
      "title": "LCP slightly high",
      "description": "Largest Contentful Paint at 2800ms. Target is <2500ms for optimal performance.",
      "severity": "low"
    }
  ],
  "priorities": [
    {
      "id": "priority-1",
      "title": "Optimize hero messaging",
      "impact": "high",
      "effort": "low",
      "rationale": "Quick win: clearer value prop will improve conversion with minimal development time"
    },
    {
      "id": "priority-2",
      "title": "Reduce LCP",
      "impact": "medium",
      "effort": "medium",
      "rationale": "Optimize images and lazy-load below-fold content to improve Core Web Vital"
    }
  ]
}
```

## Scoring Guide

The AI uses a **strict 1-10 scale** for UX only (not brand/SEO/content):

- **1-2**: Very poor UX. Confusing, slow, unclear CTAs, untrustworthy feel
- **3-4**: Weak UX. Basic structure but many issues and friction
- **5-6**: Average UX. Functional but generic, clear improvement areas
- **7-8**: Strong UX. Clear hierarchy, obvious CTAs, decent performance
- **9-10**: Excellent UX. Polished, fast, clear value prop, intentional conversion paths

## Evidence Collection Details

### HTML Structure (Cheerio)

Extracts from raw HTML:
- `<title>` - Page title
- `<meta name="description">` - Meta description
- First `<h1>` - Primary heading
- Hero text: H1 + first `<p>` after it
- **Primary CTA detection**: Searches first 40 `<a>` or `<button>` elements for patterns:
  - "get started", "book a demo", "schedule", "contact", "talk to us"
  - "request a quote", "get a quote", "start now"
- **Form detection**: Checks if page has any `<form>` elements

### PageSpeed (Google API)

Fetches from PageSpeed Insights API:
- Performance score (0-100)
- LCP (Largest Contentful Paint in ms)
- CLS (Cumulative Layout Shift score)
- INP (Interaction to Next Paint in ms)

**Note**: If `PAGESPEED_API_KEY` is not set, speed diagnostics are skipped (structure-only analysis).

## OpenAI Integration

- **Model**: `gpt-4o-mini` (cost-effective, fast)
- **Temperature**: 0.3 (consistent, focused outputs)
- **Response format**: JSON object mode
- **System prompt**: Strict UX-only evaluation guidelines
- **Normalization**: All responses sanitized and validated

### Normalization Rules

- **Score**: Clamped to 1-10 integer
- **Severity**: Maps to `low`, `medium`, or `high`
- **Impact/Effort**: Maps to `low`, `medium`, or `high`
- **IDs**: Auto-generated if not provided (`issue-1`, `priority-1`, etc.)

## Performance

- **HTML fetch**: 10s timeout
- **PageSpeed API**: 30s timeout
- **Total duration**: ~40-60s with PageSpeed, ~15-20s without
- **API route**: 60s max duration (configured)

## Error Handling

- HTML fetch fails → throws error
- PageSpeed unavailable → continues with structure-only
- OpenAI fails → throws error (no fallback diagnostic)
- API endpoint → returns `{ error: "..." }` with proper status code

## Architecture Notes

### Current: Simple fetch for HTML
```typescript
async function fetchRenderedHtml(url: string): Promise<string> {
  // Basic fetch with 10s timeout
}
```

### Future: Swap for existing GAP render service
When integrating with GAP, replace `fetchRenderedHtml()` with the existing snapshot/render service used by the Growth Acceleration Plan engine.

## Next Steps

This is a **vertical slice** for validation:

1. ✅ **Module implemented**: Evidence collection + AI diagnostics
2. ✅ **Test API working**: `/api/test-website-ux`
3. ⏳ **Not yet done** (future work):
   - Wire into `/api/growth-plan`
   - Save to Airtable Full Reports
   - Display in `/os` diagnostics UI
   - Replace `fetchRenderedHtml()` with GAP's render service

## Example Output

Testing with `https://stripe.com`:

```json
{
  "score": 9,
  "justification": "Excellent UX. Clear value proposition, fast load times, obvious conversion paths. Professional polish throughout.",
  "issues": [
    {
      "id": "issue-1",
      "title": "CLS slightly elevated",
      "description": "Cumulative Layout Shift at 0.15. Consider reserving space for dynamic content.",
      "severity": "low"
    }
  ],
  "priorities": [
    {
      "id": "priority-1",
      "title": "Reduce CLS with reserved space",
      "impact": "low",
      "effort": "low",
      "rationale": "Small improvement to Core Web Vitals with minimal effort"
    }
  ]
}
```

---

## Canonical Contract System

All diagnostic Labs must follow the **Canonical Contract** - a set of rules that guarantee consistent, predictable outputs for downstream consumers (Strategy Frame, Context Graph, GAP).

### Core Guarantees

Each Lab must guarantee:

1. **Required fields are present**: Either populated with meaningful content OR explicitly `null`
2. **No empty pollution**: No `{}`, `[]`, or `{ value: null }` artifacts
3. **Domain write gating**: Labs only write to their authorized domains

### Using the Canonical Helper

Every Lab builder should call `ensureCanonical()` before returning results:

```typescript
import { ensureCanonical } from '@/lib/diagnostics/shared';

export async function runBrandLab(params: BrandLabParams): Promise<BrandLabResult> {
  // ... collect signals, run LLM analysis ...

  // CANONICAL CONTRACT: Ensure all required fields are present
  const canonicalResult = ensureCanonical({
    labType: 'brand',
    canonical: findings,
    v1Result: diagnostic, // For fallback synthesis
  });

  if (canonicalResult.synthesizedFields.length > 0) {
    console.log('[BrandLab] Synthesized fields:', canonicalResult.synthesizedFields);
  }

  return {
    ...result,
    findings: canonicalResult.canonical as BrandLabFindings,
  };
}
```

### Canonical Registry

Each Lab has a spec defining required fields in `lib/diagnostics/shared/canonicalRegistry.ts`:

| Lab | Required Fields |
|-----|-----------------|
| **Brand** | `positioning.statement`, `valueProp.headline`, `differentiators.bullets`, `icp.primaryAudience` |
| **Website** | `uxMaturity`, `primaryCta`, `topIssues` |
| **SEO** | `maturityStage`, `technicalHealth`, `topIssues` |
| **Content** | `maturityStage`, `contentTypes`, `topIssues` |
| **Competition** | `competitors`, `positionSummary` |
| **Audience** | `primaryAudience` |

### Field Types

```typescript
type CanonicalFieldType = 'string' | 'array' | 'object' | 'number';

interface CanonicalFieldSpec {
  path: string;           // Dot-path (e.g., 'positioning.statement')
  type: CanonicalFieldType;
  required: boolean;      // Must have value or explicit null
  minLength?: number;     // For strings
  minItems?: number;      // For arrays
}
```

### Domain Authority

Each domain has a canonical authority - only allowed sources may write:

| Domain | Canonical Source | Also Allowed |
|--------|-----------------|--------------|
| `brand` | `brand_lab` | `user`, `import` |
| `competitive` | `competition_lab` | `user`, `import` |
| `website` | `website_lab` | `user`, `import` |
| `seo` | `seo_lab` | `user`, `import` |
| `content` | `content_lab` | `user`, `import` |
| `audience` | `audience_lab` | `brand_lab`, `user`, `import` |

Write gating is enforced in `lib/contextGraph/mutate.ts`:

```typescript
// Blocked automatically - GAP cannot overwrite competition_lab data
setFieldUntyped(graph, 'competitive', 'competitors', gapCompetitors, gapProvenance);
// Returns unchanged graph, logs warning
```

### Synthesis

When LLM output is incomplete, `ensureCanonical()` synthesizes missing fields from v1 data:

```typescript
const result = ensureCanonical({
  labType: 'brand',
  canonical: {},  // Empty LLM output
  v1Result: { diagnostic: { positioning: { positioningTheme: '...' } } },
});

// result.synthesizedFields = ['positioning.statement', ...]
// result.canonical.positioning.statement = '...' (from v1)
```

### Validation

Validate canonical objects without modification:

```typescript
import { validateCanonical } from '@/lib/diagnostics/shared';

const validation = validateCanonical('brand', findings);
if (!validation.valid) {
  console.error('Invalid canonical:', validation.errors);
  // Don't write to Context Graph
}
```

### Empty Field Rules

| Value | Behavior |
|-------|----------|
| `{}` | **Stripped** - never written |
| `[]` | **Stripped** if required field has `minItems > 0` |
| `''` | **Stripped** - treated as missing |
| `null` | **Preserved** - explicit "not available" |
| `undefined` | **Stripped** - treated as missing |

### Testing

Contract tests ensure each Lab meets its canonical guarantees:

```bash
npx vitest run tests/diagnostics/canonicalContract.test.ts
```

Tests verify:
- All required fields exist or are explicitly null
- No empty `{}` or `[]` in output
- Synthesis produces valid fallbacks
- Field types match spec

### Adding a New Lab

1. Add spec to `lib/diagnostics/shared/canonicalRegistry.ts`
2. Add synthesis function to `lib/diagnostics/shared/ensureCanonical.ts`
3. Call `ensureCanonical()` in Lab builder
4. Add tests to `tests/diagnostics/canonicalContract.test.ts`
5. Add domain authority to `lib/os/context/domainAuthority.ts`

---

**Status**: ✅ Ready for testing and validation
**Branch**: `feature/hive-os-v1`
**Not breaking**: Existing GAP engine at `/api/growth-plan` untouched
