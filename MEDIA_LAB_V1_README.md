# Media Lab V1 - Implementation Guide

## Overview

Media Lab V1 is a performance media planning and channel strategy tool integrated into the Hive OS. It allows you to manage media plans, budgets, channel mix, seasonal flights, and market coverage for each company.

## Architecture

### Data Layer (Airtable)

**New Tables Created:**

1. **Media Plans** - Top-level media programs
   - Company (linked record → Companies)
   - Name, Status, Objective
   - Timeframe Start/End, Total Budget
   - Primary Markets, Notes
   - Has Seasonal Flights (checkbox)

2. **Media Plan Channels** - Channel-specific budgets and targeting
   - Media Plan (linked record → Media Plans)
   - Channel (single select: google_search, google_lsas, google_maps_gbp, paid_social_meta, display_retarg, radio, other)
   - % of Budget, $ Budget
   - Expected Installs/Leads, Expected CPL/CPI
   - Priority (core, supporting, experimental)

3. **Media Plan Flights** - Seasonal campaigns
   - Media Plan (linked record → Media Plans)
   - Name, Season (remote_start, holiday, carplay_season, summer_audio, other)
   - Start/End Date, Budget
   - Primary Channels (multi-select)
   - Markets/Stores, Notes

**Companies Table Updates:**

New fields added to Companies table:
- Has Media Program (checkbox)
- Media Status (single select: none, planning, running, paused)
- Media Primary Objective (single select: installs, leads, store_visits, calls, awareness)
- Media Notes (long text)

### Application Layer

**Type Definitions:**
- `lib/media-lab/types.ts` - All TypeScript types and display helpers

**Airtable Helpers:**
- `lib/airtable/mediaLab.ts` - CRUD operations with Zod validation
  - `getMediaPlansForCompany(companyId)`
  - `getMediaPlanById(planId)`
  - `getChannelsForMediaPlan(planId)`
  - `getFlightsForMediaPlan(planId)`
  - `getCompanyMediaFields(companyId)`

**Server Functions:**
- `lib/media-lab/server.ts` - Server-side data fetching
  - `getMediaLabForCompany(companyId)` - Returns complete MediaLabData
  - `getMediaLabSummary(companyId)` - Lightweight summary for blueprint/dashboard

**API Routes:**
- `app/api/os/companies/[companyId]/media-lab/route.ts` - REST API endpoint

### UI Layer

**Main View:**
- `app/media-lab/[companyId]/page.tsx` - Next.js page (server component)
- `components/media-lab/MediaLabView.tsx` - Client component with full UI

**Integration Components:**
- `components/media-lab/MediaProgramSection.tsx` - For Blueprint integration
- `components/media-lab/MediaDashboardSection.tsx` - For Dashboard integration

## Usage

### Viewing Media Lab

Navigate to: `/media-lab/[companyId]`

Example: `/media-lab/rec123ABC`

### Fetching Data in Code

```typescript
import { getMediaLabForCompany, getMediaLabSummary } from '@/lib/media-lab/server';

// Get complete data (plans + channels + flights)
const data = await getMediaLabForCompany(companyId);

// Get summary only (lighter weight)
const summary = await getMediaLabSummary(companyId);
```

### Integrating into Blueprint

```typescript
import { getMediaLabSummary } from '@/lib/media-lab/server';
import { MediaProgramSection } from '@/components/media-lab/MediaProgramSection';

export default async function BlueprintPage({ params }) {
  const { companyId } = await params;
  const summary = await getMediaLabSummary(companyId);

  return (
    <div>
      {/* Your existing blueprint sections */}

      {/* Media Program Section - only shows if relevant */}
      <MediaProgramSection companyId={companyId} summary={summary} />
    </div>
  );
}
```

### Integrating into Dashboard

```typescript
import { getMediaLabForCompany } from '@/lib/media-lab/server';
import { MediaDashboardSection, NoMediaProgramNotice } from '@/components/media-lab/MediaDashboardSection';

export default async function DashboardPage({ params }) {
  const { companyId } = await params;
  const data = await getMediaLabForCompany(companyId);

  return (
    <div>
      {/* Your existing dashboard sections */}

      {/* Conditional Media Section */}
      {data.summary.hasMediaProgram || data.summary.activePlanCount > 0 ? (
        <MediaDashboardSection companyId={companyId} data={data} />
      ) : (
        <NoMediaProgramNotice companyId={companyId} />
      )}
    </div>
  );
}
```

## UI Features

### Media Lab Page

**Left Column (Strategy):**
- Plan Selector (if multiple plans)
- Plan Overview Card
  - Status pills (Draft, Active, Proposed, Paused, Archived)
  - Objective chips (Installs, Leads, Store Visits, Calls, Awareness)
  - Budget and timeframe
  - Strategy notes
- Channel Mix & Budget Card
  - Visual budget bar chart
  - Channel breakdown table with expected metrics

**Right Column (Implementation):**
- Seasonal Flights Card
  - Flight name, season, dates, budget
  - Primary channels for each flight
  - Markets/stores coverage
- Markets Summary Card
- Actions Card
  - "Send to Ops Lab" button (stubbed)
  - "Open Media Analytics" button (stubbed)

**Empty State:**
- Shown when no media plans exist
- Centered empty state with icon
- "Define Media Program" CTA (stubbed for V1)

### Blueprint Integration

Shows a "Media Program" section only if:
- `hasMediaProgram === true` OR
- `activePlanCount > 0`

Displays:
- Media Status badge
- Objective
- Primary markets
- Total active budget
- Link to Media Lab

### Dashboard Integration

Shows Media section only for companies with active media programs.

Displays:
- Media Overview card (status, budget, plan count)
- Channels Overview card (top 4 channels with budget allocation)
- Link to Media Lab

## Styling

All components follow dark Hive OS theme:
- Background: `bg-zinc-950`, `bg-zinc-900/50`
- Borders: `border-zinc-800`, `border-zinc-700`
- Text: `text-white`, `text-zinc-400`, `text-zinc-500`
- Cards: `rounded-xl border`
- Pills/Badges: `rounded-full` with semantic colors
- Buttons: `rounded-lg` with hover states

Color scheme:
- Blue: Primary actions (`bg-blue-600`)
- Purple: Secondary emphasis (`bg-purple-600/20`)
- Green: Running status (`bg-green-600/20`)
- Yellow: Planning status (`bg-yellow-600/20`)
- Orange: Paused/Seasonal (`bg-orange-600/20`)

## Data Flow

```
Airtable (Media Plans, Channels, Flights, Companies)
    ↓
lib/airtable/mediaLab.ts (Helpers with Zod validation)
    ↓
lib/media-lab/server.ts (getMediaLabForCompany)
    ↓
API Route OR Server Component
    ↓
React Components (MediaLabView, MediaProgramSection, MediaDashboardSection)
```

## V1 Limitations

**Read-Only:**
- All editing must be done in Airtable
- No create/update/delete operations in UI

**Stubbed Features:**
- "Send to Ops Lab" - Shows toast message only
- "Open Media Analytics" - Shows toast message only
- "Define Media Program" button - Shows message to use Airtable

**Planned for V2:**
- In-app plan creation and editing
- Work item generation from media plans
- Analytics integration
- Budget pacing and performance tracking
- Store-level metrics for multi-location clients

## Type Reference

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
  primaryObjective?: MediaObjective | null;
  primaryMarkets?: string | null;
  totalActiveBudget?: number | null;
  activePlanCount: number;
}
```

## Testing Checklist

- [ ] Create Media Plans table in Airtable
- [ ] Create Media Plan Channels table in Airtable
- [ ] Create Media Plan Flights table in Airtable
- [ ] Add media fields to Companies table
- [ ] Create test company with media program
- [ ] Create test media plan with channels and flights
- [ ] Verify `/media-lab/[companyId]` page loads
- [ ] Verify empty state shows for company with no plans
- [ ] Verify plan selector works with multiple plans
- [ ] Verify channel mix displays correctly
- [ ] Verify seasonal flights display correctly
- [ ] Verify stubbed action buttons show toast messages
- [ ] Verify MediaProgramSection renders in Blueprint
- [ ] Verify MediaDashboardSection renders in Dashboard
- [ ] Verify conditional rendering based on hasMediaProgram

## Deployment Notes

1. **Airtable Setup:**
   - Create the three new tables with exact field names as specified
   - Add media fields to Companies table
   - Set up appropriate views and permissions

2. **Environment Variables:**
   - No new env vars required (uses existing Airtable credentials)

3. **Build & Deploy:**
   - Run `npm run build` to verify no TypeScript errors
   - Deploy to your hosting platform

4. **Data Migration:**
   - If you have existing media data, map it to new tables
   - Update Company records with `hasMediaProgram` flags

## Support

For questions or issues:
1. Check type definitions in `lib/media-lab/types.ts`
2. Review Airtable helpers in `lib/airtable/mediaLab.ts`
3. Inspect server function logic in `lib/media-lab/server.ts`
4. Examine UI components for styling patterns

## Future Enhancements (V2+)

- [ ] In-app CRUD operations (create/edit/delete plans)
- [ ] Work item generation integration
- [ ] Analytics dashboard integration
- [ ] Budget pacing alerts
- [ ] Performance metrics (CPL, ROAS, etc.)
- [ ] Store-level attribution for multi-location
- [ ] Automated reporting
- [ ] Media buying platform integrations (Google Ads, Meta, etc.)
- [ ] Budget optimization recommendations
