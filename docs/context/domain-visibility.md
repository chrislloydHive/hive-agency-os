# Domain Visibility

The Domain Visibility system controls which Context Graph domains appear in different UI contexts. This prevents information overload while allowing power users access to advanced data.

## Visibility Levels

| Level | Description | UI Behavior |
|-------|-------------|-------------|
| `core` | Strategy-critical domains | Always visible in main Context UI |
| `advanced` | Power-user features | Visible in "Advanced" accordion |
| `hidden` | Lab/diagnostic data | Not visible in normal UI (admin only) |

## Current Configuration

### Core Domains (Always Visible)
- `identity` - Company Identity
- `audience` - Audience & ICP
- `productOffer` - Product & Offer
- `objectives` - Objectives & KPIs
- `brand` - Brand & Positioning
- `competitive` - Competitive Landscape
- `operationalConstraints` - Constraints & Compliance

### Advanced Domains (In Accordion)
- `budgetOps` - Budget & Unit Economics
- `performanceMedia` - Performance Media
- `website` - Website & UX
- `ops` - Operations

### Hidden Domains (Admin Only)
- `digitalInfra` - Digital Infrastructure
- `historical` - Historical Data
- `historyRefs` - History References
- `storeRisk` - Store Risk
- `social` - Social Media
- `content` - Content
- `seo` - SEO
- `creative` - Creative
- `capabilities` - Hive Capabilities (Hive Brain only)

## Usage

### Getting Domains by Visibility

```typescript
import {
  getCoreDomains,
  getAdvancedDomains,
  getHiddenDomains,
  isDomainVisible,
  getDomainVisibility,
} from '@/lib/contextGraph/visibility';

// Get arrays of domains at each level
const core = getCoreDomains();      // ['identity', 'audience', ...]
const advanced = getAdvancedDomains(); // ['budgetOps', 'performanceMedia', ...]
const hidden = getHiddenDomains();  // ['digitalInfra', 'historical', ...]

// Check if a domain is visible at a given level
isDomainVisible('audience', 'core');     // true
isDomainVisible('budgetOps', 'core');    // false
isDomainVisible('budgetOps', 'advanced'); // true

// Get the visibility level for a domain
getDomainVisibility('capabilities'); // 'hidden'
```

### Domain Metadata

```typescript
import {
  getDomainLabel,
  getDomainDescription,
} from '@/lib/contextGraph/visibility';

getDomainLabel('audience');       // 'Audience & ICP'
getDomainDescription('audience'); // 'Target audience segments and ICP'
```

## UI Implementation

The Context Explorer sidebar uses visibility to organize domains:

```tsx
// Core domains shown at top
{coreDomains.map(domain => <DomainButton domain={domain} />)}

// Advanced domains in accordion
<Accordion title="Advanced">
  {advancedDomains.map(domain => <DomainButton domain={domain} />)}
</Accordion>
```

## Related Files

- `lib/contextGraph/visibility.ts` - Configuration and helpers
- `app/c/[companyId]/context/ContextExplorerClient.tsx` - UI implementation
