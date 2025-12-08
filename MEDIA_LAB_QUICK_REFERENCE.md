# Media Lab V1 - Quick Reference Card

## 🚀 Quick Start

### View Media Lab
```
URL: /media-lab/[companyId]
Example: /media-lab/rec123ABC
```

### Fetch Data (Server-Side)
```typescript
import { getMediaLabForCompany, getMediaLabSummary } from '@/lib/media-lab';

// Full data
const data = await getMediaLabForCompany('rec123ABC');

// Summary only (faster)
const summary = await getMediaLabSummary('rec123ABC');
```

### Add to Blueprint
```typescript
import { MediaProgramSection } from '@/components/media-lab/MediaProgramSection';

<MediaProgramSection companyId={companyId} summary={summary} />
```

### Add to Dashboard
```typescript
import { MediaDashboardSection } from '@/components/media-lab/MediaDashboardSection';

<MediaDashboardSection companyId={companyId} data={data} />
```

## 📊 Key Types

### MediaLabData
```typescript
{
  summary: MediaLabSummary;
  plans: Array<{
    plan: MediaPlan;
    channels: MediaPlanChannel[];
    flights: MediaPlanFlight[];
  }>;
}
```

### MediaLabSummary
```typescript
{
  hasMediaProgram: boolean;
  mediaStatus: 'none' | 'planning' | 'running' | 'paused';
  primaryObjective?: 'installs' | 'leads' | 'store_visits' | 'calls' | 'awareness';
  primaryMarkets?: string;
  totalActiveBudget?: number;
  activePlanCount: number;
}
```

## 🗄️ Airtable Tables

1. **Media Plans** - Top-level plans
2. **Media Plan Channels** - Budget allocation by channel
3. **Media Plan Flights** - Seasonal campaigns
4. **Companies** - Added media fields

## 📁 File Locations

```
Types:          lib/media-lab/types.ts
Server Logic:   lib/media-lab/server.ts
Airtable:       lib/airtable/mediaLab.ts
Main UI:        components/media-lab/MediaLabView.tsx
Page:           app/media-lab/[companyId]/page.tsx
API:            app/api/os/companies/[companyId]/media-lab/route.ts
Blueprint:      components/media-lab/MediaProgramSection.tsx
Dashboard:      components/media-lab/MediaDashboardSection.tsx
```

## 🎨 Common Patterns

### Check if Company Has Media
```typescript
const summary = await getMediaLabSummary(companyId);
const hasMedia = summary.hasMediaProgram || summary.activePlanCount > 0;

if (hasMedia) {
  // Show media section
}
```

### Get Active Plan
```typescript
const data = await getMediaLabForCompany(companyId);
const activePlan = data.plans.find(p => p.plan.status === 'active');
```

### Display Channel Labels
```typescript
import { MEDIA_CHANNEL_LABELS } from '@/lib/media-lab';

// Convert 'google_search' → 'Google Search'
const label = MEDIA_CHANNEL_LABELS[channel.channel];
```

### Format Budget
```typescript
// Show as K
${(budget / 1000).toFixed(0)}K

// Show full
${budget.toLocaleString()}
```

## 🎯 Conditional Rendering

```typescript
// Blueprint - hide if no media
{(summary.hasMediaProgram || summary.activePlanCount > 0) && (
  <MediaProgramSection companyId={companyId} summary={summary} />
)}

// Dashboard - show notice if no media
{summary.activePlanCount > 0 ? (
  <MediaDashboardSection companyId={companyId} data={data} />
) : (
  <NoMediaProgramNotice companyId={companyId} />
)}
```

## 🔍 Debug Tips

### Check if Data Loads
```typescript
const data = await getMediaLabForCompany(companyId);
console.log('Plans:', data.plans.length);
console.log('Summary:', data.summary);
```

### Verify Airtable Links
- Media Plan → Company link must be set
- Channel → Media Plan link must be set
- Flight → Media Plan link must be set

### Common Issues
- **No plans showing:** Check Company link in Media Plans table
- **Channels missing:** Verify Media Plan link in Channels table
- **Empty budget:** Check Total Budget field in Media Plan

## 📚 Documentation

- **Full Docs:** `MEDIA_LAB_V1_README.md`
- **Airtable Setup:** `MEDIA_LAB_AIRTABLE_SETUP.md`
- **Code Examples:** `MEDIA_LAB_INTEGRATION_EXAMPLES.md`
- **Implementation:** `MEDIA_LAB_IMPLEMENTATION_SUMMARY.md`

## ⚡ Performance Tips

```typescript
// Use summary for lightweight checks
const summary = await getMediaLabSummary(companyId); // Fast

// Only fetch full data when needed
const fullData = summary.activePlanCount > 0
  ? await getMediaLabForCompany(companyId)
  : null;

// Parallel fetching
const [company, media] = await Promise.all([
  getCompanyById(companyId),
  getMediaLabSummary(companyId)
]);
```

## 🎨 Styling Reference

```typescript
// Card
"rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"

// Status badge - running
"bg-green-600/20 text-green-400"

// Status badge - planning
"bg-yellow-600/20 text-yellow-400"

// Status badge - paused
"bg-orange-600/20 text-orange-400"

// Primary button
"rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"

// Secondary button
"rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
```

## 🧪 Test Checklist

- [ ] Create test company with media program
- [ ] Create media plan linked to company
- [ ] Add 2-3 channels to plan
- [ ] Add 1-2 flights to plan
- [ ] Visit `/media-lab/[companyId]`
- [ ] Verify data displays correctly
- [ ] Test plan selector (if multiple plans)
- [ ] Test integration in Blueprint
- [ ] Test integration in Dashboard
- [ ] Test empty state (company with no plans)

## 🚨 Troubleshooting

### Build Errors
```bash
# Clean and rebuild
rm -rf .next
npm run build
```

### TypeScript Errors
```bash
# Check types
npx tsc --noEmit
```

### Runtime Errors
- Check Airtable API credentials
- Verify table names match constants
- Check linked records are set up
- Review server logs for errors

## 📞 Quick Commands

```bash
# Build
npm run build

# Dev server
npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

## 🎯 V1 Scope

**✅ Included:**
- View media plans
- See budget allocation
- View seasonal flights
- Blueprint integration
- Dashboard integration

**❌ Not in V1:**
- In-app CRUD (use Airtable)
- Work item generation (stubbed)
- Analytics integration (stubbed)
- Performance tracking (V2)

## 💡 Pro Tips

1. **Performance:** Use `getMediaLabSummary()` for conditional rendering, `getMediaLabForCompany()` only when showing full data
2. **Testing:** Create test data in Airtable first, then verify UI
3. **Integration:** Components auto-hide when no media program exists
4. **Styling:** All components match dark Hive OS theme automatically
5. **Extensibility:** V2 features can be added without breaking changes

---

**Need Help?** Check the full README or integration examples!
