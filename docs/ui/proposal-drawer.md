# Proposal Review Drawer

UX rules and mapping behavior for the `ProposalReviewDrawer` component.

## Purpose

The Proposal Review Drawer presents AI-proposed changes to Context data for user review before application. Users can selectively approve changes while locked fields are clearly marked as non-editable.

## Components

- **`ProposalReviewDrawer`** - Main drawer component (`components/proposal/ProposalReviewDrawer.tsx`)
- **`labelForJsonPointer`** - JSON Pointer to friendly label mapper (`lib/contextGraph/paths/labelForJsonPointer.ts`)

## UX Rules

### 1. Selection Behavior

- All applicable changes are **selected by default**
- Users can toggle individual changes on/off
- "Select all" / "Deselect all" bulk actions available
- Apply button shows count: "Apply N Changes"
- Apply disabled when 0 changes selected

### 2. Operation Display

| Operation | Badge | Color | Display |
|-----------|-------|-------|---------|
| `replace` | Changed | Amber | `oldValue` → `newValue` |
| `add` | Added | Green | New value only |
| `remove` | Removed | Red | Strikethrough old value |

### 3. Domain Grouping

Changes are grouped by top-level Context Graph domain:
- Identity, Audience, Brand, Website, Media, Creative, etc.
- Each group shows selection count: "2/3 selected"
- Groups are collapsible

### 4. Conflicts Section

Conflicts represent changes that cannot be applied due to field locks:
- Displayed in a separate red-tinted section
- Shows lock icon (not checkbox)
- Displays lock reason from `conflict.message`
- **Non-selectable** - users cannot override locks
- Shows what the AI attempted: "Attempted: changed → [value]"

### 5. Actions

- **Copy diff** - Copies `{ patch, conflicts }` as JSON to clipboard
- **Cancel** - Closes drawer without applying
- **Apply** - Calls `onApply(selectedPaths)` with array of selected JSON Pointers

## JSON Pointer Label Mapping

The `labelForJsonPointer` function converts RFC 6901 JSON Pointers to human-readable labels.

### Mapping Logic

1. Parse pointer into segments: `/identity/businessModel/value` → `["identity", "businessModel", "value"]`
2. Get domain from first segment
3. Get field by finding first non-metadata, non-index segment from the end
4. Look up labels in `CONTEXT_FIELDS` registry, fallback to title case

### Examples

| JSON Pointer | Full Label |
|--------------|------------|
| `/identity/businessModel/value` | Identity → Business Model |
| `/audience/primaryAudience/value` | Audience → Primary Audience |
| `/brand/positioning/value` | Brand → Brand Positioning |
| `/productOffer/primaryProducts` | Product/Offer → Primary Products |
| `/competitive/competitors` | Competitive → Competitors |
| `/strategyPillars/0/decision` | Strategy Pillars → Decision |

### Metadata Segments

These segments are skipped when determining the field:
- `value`
- `provenance`
- `updatedAt`
- `confidence`

## Integration

```tsx
import { ProposalReviewDrawer } from '@/components/proposal';

<ProposalReviewDrawer
  proposal={proposal}
  isOpen={isDrawerOpen}
  onClose={() => setDrawerOpen(false)}
  onApply={async (selectedPaths) => {
    // Call apply endpoint with selected paths
    await applyProposal(proposal.id, selectedPaths);
  }}
  isApplying={isApplying}
/>
```

## Testing

Tests located in `tests/ui/`:
- `labelForJsonPointer.test.ts` - Label mapping for 12+ common pointers
- `proposalReviewDrawer.test.tsx` - Component rendering, selection, conflicts, apply behavior

## Related

- `lib/os/writeContract/types.ts` - Proposal, PatchOperation, ProposalConflict types
- `lib/contextGraph/schema.ts` - CONTEXT_FIELDS registry with field labels
- `docs/context/reuse-affirmation.md` - Context workspace component mapping
