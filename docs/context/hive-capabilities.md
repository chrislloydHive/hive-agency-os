# Hive Capabilities

The Hive Capabilities domain defines a structured taxonomy of services that Hive can deliver. This enables AI systems to make specific, actionable recommendations based on what Hive can actually execute.

## Overview

Capabilities are organized into **categories**, each containing multiple **capability keys**:

| Category | Description | Capability Keys |
|----------|-------------|-----------------|
| **Strategy** | Strategic planning services | `growthStrategy`, `measurementStrategy` |
| **Web** | Website and conversion services | `webDesignBuild`, `conversionOptimization`, `technicalSeoFixes` |
| **Content & Creative** | Content production and creative services | `seoContent`, `brandContent`, `socialContent`, `performanceCreative`, `creativeTesting` |
| **SEO** | Search engine optimization | `technicalSeo`, `onPageSeo`, `contentSeo`, `localSeo` |
| **Paid Media** | Paid advertising channels | `search`, `socialAds`, `pmaxShopping`, `retargeting`, `landingPageProgram` |
| **Analytics** | Measurement and analytics | `ga4GtmSetup`, `conversionTracking`, `reportingDashboards`, `experimentation` |

## Schema

Each capability follows this structure:

```typescript
interface Capability {
  enabled: boolean;           // Whether this capability is available
  strength: CapabilityStrength; // 'basic' | 'strong' | 'elite'
  deliverables: string[];     // What we can deliver
  constraints: string[];      // Limitations or requirements
}
```

### Strength Levels

| Level | Description |
|-------|-------------|
| `basic` | Foundational capability, standard delivery |
| `strong` | Advanced capability with proven track record |
| `elite` | Best-in-class, deep expertise and innovation |

## Administration

Capabilities are managed in **Hive Brain** (Settings → Hive Brain). This is a human-only edit zone - no AI auto-writes are allowed.

Access: `/settings/hive-brain`

## AI Context Injection

When building AI prompts, capabilities are automatically injected via `formatCapabilitiesForPrompt()`:

```typescript
import { formatCapabilitiesForPrompt } from '@/lib/contextGraph';

const capabilitiesSection = formatCapabilitiesForPrompt(graph.capabilities);
// Returns formatted markdown like:
// ## Hive Capabilities
// *Services available from Hive for this engagement:*
//
// ### Paid Media
// - **Search Ads** (strong): Campaign setup, optimization +2 more
// - **Retargeting** (basic)
```

Only **enabled** capabilities are included. The output is:
- Organized by category
- Shows strength level
- Includes deliverables (truncated to first 3)
- Shows constraints as warnings

## Visibility

Capabilities domain is `hidden` visibility - it does not appear in the Company Context page. It's edited only via Hive Brain.

## Related Files

- `lib/contextGraph/domains/capabilities.ts` - Schema and constants
- `lib/contextGraph/forAi.ts` - AI prompt formatting
- `lib/contextGraph/globalGraph.ts` - Hive Brain storage
- `app/settings/hive-brain/HiveBrainEditorClient.tsx` - Admin UI
