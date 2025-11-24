// Contextual Heuristics System
# Business Context Inference for GAP

## Overview

The contextual heuristics module (`contextualHeuristics.ts`) automatically infers **businessType** and **brandTier** from URL, HTML content, and detected signals. This ensures GAP-IA and Full GAP provide recommendations tailored to the actual business model.

## Problem It Solves

**Before heuristics:**
- GAP recommended LinkedIn for a local farmers market ❌
- Generic advice that didn't match the business model
- No awareness of whether business is B2B, B2C, local, or e-commerce

**After heuristics:**
- Local businesses get GBP, Maps, Instagram/Facebook recommendations ✅
- B2B SaaS gets LinkedIn, content depth, pricing transparency ✅
- E-commerce gets product UX, reviews, checkout flow ✅
- Recommendations match the actual customer acquisition channels

## Business Types Detected

| Business Type | Description | Key Signals | Priority Channels |
|---------------|-------------|-------------|-------------------|
| `local-consumer` | Gyms, restaurants, farmers markets, venues | Physical address + hours + events | GBP, Maps, Instagram, Facebook |
| `b2b-saas` | B2B software products | SaaS terms + B2B focus + demo/trial | LinkedIn, content, pricing, demos |
| `b2c-saas` | Consumer software products | SaaS terms + consumer focus + app store | App stores, trials, mobile |
| `ecommerce` | Online retail | Shopify + cart + products | Product UX, reviews, checkout |
| `b2b-services` | Consulting, agencies | Consulting + services + case studies | LinkedIn, case studies, expertise |
| `b2c-services` | Coaching, training | Coaching + booking + personal | Booking, testimonials, social |
| `nonprofit` | Non-profit organizations | Donate + 501(c)(3) + mission | Mission, donations, community |
| `portfolio` | Personal portfolios | Portfolio + projects + personal | Work samples, about me |
| `media` | Publishers, blogs | Articles + news + subscribe | Content, subscriptions, ads |
| `unknown` | Unable to determine | Low confidence | Generic best practices |

## Brand Tiers Detected

| Brand Tier | Description | Examples |
|------------|-------------|----------|
| `global_category_leader` | Everyone knows them | Apple, HubSpot, Salesforce, Starbucks |
| `enterprise` | Large established companies | Major corporations |
| `mid_market` | Well-established mid-sized | Growing companies with professional marketing |
| `smb` | Small-to-medium businesses | Most businesses |
| `startup` | Early-stage companies | SaaS startups, new ventures |
| `local_business` | Single/few locations | Local service businesses |
| `nonprofit` | Non-profit organizations | Charities, foundations |

## How It Works

### Detection Logic

The heuristics use **deterministic rules** (not ML) with signal scoring:

```typescript
// Example: Local-consumer detection
const localSignals = {
  hasAddress: html.includes('address'),
  hasHours: html.includes('hours'),
  hasEvents: html.includes('event'),
  hasSchedule: html.includes('schedule'),
  hasMap: html.includes('google.com/maps'),
  hasFarmersMarket: html.includes('farmers market'),
  // ... etc
};

const localScore = Object.values(localSignals).filter(Boolean).length;

if (localScore >= 3 || hasFarmersMarket || (hasAddress && hasHours)) {
  businessType = 'local-consumer';
  confidence = 'high';
}
```

### Priority Order

Detection runs in **priority order** (most specific first):

1. **Local-consumer** (highest priority for local businesses)
2. **E-commerce** (Shopify, cart signals)
3. **B2B SaaS** (SaaS + B2B + demo/trial)
4. **B2C SaaS** (SaaS + consumer focus)
5. **B2B Services** (consulting, agency)
6. **B2C Services** (coaching, personal)
7. **Nonprofit** (donation language)
8. **Portfolio** (personal work)
9. **Media** (articles, publishers)
10. **Unknown** (fallback)

This ensures a farmers market is detected as `local-consumer` before checking for e-commerce or other types.

## Usage

### Basic Usage

```typescript
import { getBusinessContext, logBusinessContext } from '@/lib/gap/contextualHeuristics';

const context = getBusinessContext({
  url: 'https://queenannefarmersmarket.org',
  htmlSnippet: '<html>...farmers market...schedule...location...</html>',
  detectedSignals: {
    hasPhysicalAddress: true,
    hasOpeningHours: true,
    hasEventDates: true,
    hasGoogleBusinessProfile: false,
  },
});

// Result:
// {
//   businessType: 'local-consumer',
//   brandTier: 'local_business',
//   confidence: 'high',
//   notes: [
//     'Detected local-consumer business (5 local signals)',
//     'Detected farmers market terminology',
//     'Detected physical address',
//     'Detected opening hours',
//     'Detected event dates/calendar'
//   ],
//   signals: {
//     isLocal: true,
//     isB2B: false,
//     isB2C: true,
//     isSaaS: false,
//     isEcommerce: false,
//     hasPhysicalLocation: true
//   }
// }
```

### Integration into GAP-IA

```typescript
// In app/api/gap-ia/run/route.ts

// 1. Collect signals
const businessContextInput = {
  url,
  domain,
  htmlSnippet,
  detectedSignals: {
    hasPhysicalAddress: htmlSnippet.includes('address'),
    hasOpeningHours: htmlSnippet.includes('hours'),
    // ... extract other signals
    platformHints: detectPlatformHints(htmlSnippet),
  },
};

// 2. Get business context
const businessContext = getBusinessContext(businessContextInput);

// 3. Log in development
if (process.env.NODE_ENV === 'development') {
  logBusinessContext(businessContext, url);
}

// 4. Generate business-type aware prompt context
const businessTypeContext = generateBusinessTypeContext(
  businessContext.businessType,
  businessContext.brandTier
);

// 5. Include in LLM prompt
const messages = [{
  role: 'user',
  content: `
${GAP_IA_OUTPUT_PROMPT_V3}

BUSINESS CONTEXT:
- Type: ${businessContext.businessType}
- Tier: ${businessContext.brandTier}
- Notes: ${businessContext.notes.join(', ')}

${businessTypeContext}

[... HTML, signals, etc ...]
  `
}];
```

## Example Outputs

### Example 1: Farmers Market

**Input:**
- URL: `https://queenannefarmersmarket.org`
- HTML: Contains "farmers market", "schedule", "vendors", "location"

**Output:**
```
Business Type: local-consumer
Brand Tier: local_business
Confidence: high
Notes:
  - Detected local-consumer business (5 local signals)
  - Detected farmers market terminology
  - Detected physical address
  - Detected event dates/calendar
Signals:
  - isLocal: true
  - isB2B: false
  - isB2C: true
  - hasPhysicalLocation: true
```

**Result in GAP:**
- ✅ Recommends Google Business Profile (top priority)
- ✅ Recommends Instagram/Facebook
- ✅ Recommends event schedule clarity
- ❌ Does NOT recommend LinkedIn

### Example 2: B2B SaaS

**Input:**
- URL: `https://hubspot.com`
- HTML: Contains "B2B", "SaaS", "demo", "free trial", "pricing"

**Output:**
```
Business Type: b2b-saas
Brand Tier: global_category_leader
Confidence: high
Notes:
  - Recognized as global category leader: hubspot.com
  - Detected B2B SaaS (6 signals)
  - Detected SaaS terminology
  - Detected B2B focus
  - Detected demo request flow
Signals:
  - isLocal: false
  - isB2B: true
  - isSaaS: true
```

**Result in GAP:**
- ✅ Recommends LinkedIn thought leadership
- ✅ Recommends content depth
- ✅ Recommends pricing transparency
- ❌ Does NOT recommend Google Business Profile

### Example 3: E-commerce

**Input:**
- URL: `https://shop.example.com`
- HTML: Contains "add to cart", "products", Shopify platform

**Output:**
```
Business Type: ecommerce
Brand Tier: smb
Confidence: high
Notes:
  - Detected e-commerce (3 signals)
  - Detected Shopify platform
  - Detected shopping cart functionality
Signals:
  - isEcommerce: true
  - isB2C: true
```

**Result in GAP:**
- ✅ Recommends product page UX
- ✅ Recommends reviews and social proof
- ✅ Recommends checkout friction reduction
- ❌ Does NOT recommend LinkedIn or thought leadership

## Signal Extraction

The heuristics rely on **detected signals**. Here's how to extract them:

```typescript
const detectedSignals = {
  // Location-based
  hasPhysicalAddress: htmlSnippet.toLowerCase().includes('address'),
  hasOpeningHours: htmlSnippet.includes('hours') || htmlSnippet.includes('open'),
  hasEventDates: htmlSnippet.includes('event') || htmlSnippet.includes('calendar'),
  hasMapEmbed: htmlSnippet.includes('google.com/maps'),

  // Commerce
  hasShoppingCart: htmlSnippet.includes('cart') || htmlSnippet.includes('checkout'),
  hasProductCatalog: htmlSnippet.includes('product') || htmlSnippet.includes('shop'),

  // SaaS
  hasSaaSTerms: htmlSnippet.toLowerCase().includes('saas'),
  hasFreeTrial: htmlSnippet.includes('free trial'),
  hasDemoRequest: htmlSnippet.includes('demo'),

  // Platform
  platformHints: [
    htmlSnippet.includes('shopify') ? 'shopify' : null,
    htmlSnippet.includes('wordpress') ? 'wordpress' : null,
  ].filter(Boolean),

  // Digital footprint
  hasGoogleBusinessProfile: digitalFootprint.gbp.found,
  hasLinkedInCompanyPage: digitalFootprint.linkedin.found,
};
```

## Confidence Levels

The system returns confidence based on signal strength:

- **`high`**: Strong signals (5+ matching signals, or definitive markers like "farmers market")
- **`medium`**: Moderate signals (2-4 matching signals)
- **`low`**: Weak or conflicting signals, defaults to `unknown` businessType

## Development Logging

Enable detailed logging in development:

```typescript
if (process.env.NODE_ENV === 'development') {
  logBusinessContext(businessContext, url);
}
```

Output:
```
[business-context] ═══════════════════════════════════
[business-context] URL: https://queenannefarmersmarket.org
[business-context] Business Type: local-consumer
[business-context] Brand Tier: local_business
[business-context] Confidence: high
[business-context] Signals:
  - isLocal: true
  - isB2B: false
  - isB2C: true
  - isSaaS: false
  - isEcommerce: false
  - hasPhysicalLocation: true
[business-context] Notes:
  - Detected local-consumer business (5 local signals)
  - Detected farmers market terminology
  - Detected physical address
  - Detected opening hours
  - Detected event dates/calendar
[business-context] ═══════════════════════════════════
```

## Tuning and Iteration

The heuristics are **deterministic and tunable**. To improve detection:

1. **Monitor logs** in production to see businessType assignments
2. **Collect edge cases** where detection fails or is incorrect
3. **Adjust thresholds** in `contextualHeuristics.ts` (e.g., change `localScore >= 3` to `>= 2`)
4. **Add new signals** as you discover patterns
5. **Refine keyword matching** for better accuracy

Example refinement:
```typescript
// Before: Too strict
if (localScore >= 5) {
  businessType = 'local-consumer';
}

// After: More lenient
if (localScore >= 3 || localSignals.hasFarmersMarket) {
  businessType = 'local-consumer';
}
```

## Future Enhancements

Potential improvements:

1. **ML-based classification** - Train a model on labeled examples
2. **Industry detection** - Infer specific industry (fitness, food, tech, etc.)
3. **ICP inference** - Detect target customer segment
4. **Competitive set** - Identify similar businesses for benchmarking
5. **Geography detection** - Local, regional, national, international

For now, the deterministic heuristics provide **good enough** accuracy with **full transparency** and **easy tuning**.
