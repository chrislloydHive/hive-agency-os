# Media Lab V1 - Integration Examples

## Quick Start

The Media Lab is ready to integrate into your Blueprint and Dashboard views. Below are complete examples showing how to add media program sections to these views.

## Example 1: Blueprint Integration

When you create your Blueprint view, add the Media Program section like this:

```typescript
// app/blueprint/[companyId]/page.tsx (or wherever Blueprint lives)

import { getCompanyById } from '@/lib/airtable/companies';
import { getMediaLabSummary } from '@/lib/media-lab/server';
import { MediaProgramSection } from '@/components/media-lab/MediaProgramSection';

type Props = {
  params: Promise<{ companyId: string }>;
};

export default async function BlueprintPage({ params }: Props) {
  const { companyId } = await params;

  // Fetch company data and media summary in parallel
  const [company, mediaSummary] = await Promise.all([
    getCompanyById(companyId),
    getMediaLabSummary(companyId),
  ]);

  if (!company) {
    return <div>Company not found</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Your existing blueprint sections */}
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-semibold">{company.name} Blueprint</h1>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left column - existing sections */}
          <div className="space-y-6">
            {/* Company Overview, Goals, etc. */}
          </div>

          {/* Right column - programs & implementation */}
          <div className="space-y-6">
            {/* Marketing Strategy, Brand Lab, etc. */}

            {/* Media Program - conditionally rendered */}
            <MediaProgramSection
              companyId={companyId}
              summary={mediaSummary}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

The `MediaProgramSection` component automatically:
- Hides itself if no media program exists
- Shows status badge (Planning, Running, Paused)
- Displays objective, markets, and budget
- Provides link to full Media Lab view

## Example 2: Dashboard Integration (Full Media Section)

For a comprehensive dashboard with media metrics:

```typescript
// app/dashboard/[companyId]/page.tsx (or wherever Dashboard lives)

import { getCompanyById } from '@/lib/airtable/companies';
import { getMediaLabForCompany } from '@/lib/media-lab/server';
import {
  MediaDashboardSection,
  NoMediaProgramNotice,
} from '@/components/media-lab/MediaDashboardSection';

type Props = {
  params: Promise<{ companyId: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { companyId } = await params;

  // Fetch company data and full media lab data in parallel
  const [company, mediaData] = await Promise.all([
    getCompanyById(companyId),
    getMediaLabForCompany(companyId),
  ]);

  if (!company) {
    return <div>Company not found</div>;
  }

  const hasMedia =
    mediaData.summary.hasMediaProgram || mediaData.summary.activePlanCount > 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-semibold">{company.name} Dashboard</h1>

        <div className="space-y-6">
          {/* Your existing dashboard sections */}
          {/* Analytics, Performance, etc. */}

          {/* Media Section - conditionally rendered */}
          <div>
            <h2 className="mb-4 text-xl font-semibold">Performance Media</h2>
            {hasMedia ? (
              <MediaDashboardSection companyId={companyId} data={mediaData} />
            ) : (
              <NoMediaProgramNotice companyId={companyId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

This shows:
- Media Overview card with budget and status
- Channels Overview with top 4 channels
- Or a "No media program" notice if not applicable

## Example 3: Dashboard Integration (Minimal)

If you prefer to hide media entirely when not relevant:

```typescript
import { getMediaLabSummary } from '@/lib/media-lab/server';
import { MediaProgramSection } from '@/components/media-lab/MediaProgramSection';

export default async function DashboardPage({ params }: Props) {
  const { companyId } = await params;
  const mediaSummary = await getMediaLabSummary(companyId);

  // Only show if media program exists
  const hasMedia =
    mediaSummary.hasMediaProgram || mediaSummary.activePlanCount > 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ... other dashboard content ... */}

      {hasMedia && (
        <div className="mt-6">
          <h2 className="mb-4 text-xl font-semibold">Media Program</h2>
          <MediaProgramSection
            companyId={companyId}
            summary={mediaSummary}
          />
        </div>
      )}
    </div>
  );
}
```

## Example 4: Using Media Data in Custom Components

If you want to build custom media sections:

```typescript
import { getMediaLabForCompany } from '@/lib/media-lab/server';
import {
  MEDIA_STATUS_LABELS,
  MEDIA_CHANNEL_LABELS,
} from '@/lib/media-lab/types';

export default async function CustomMediaView({ params }: Props) {
  const { companyId } = await params;
  const data = await getMediaLabForCompany(companyId);

  const { summary, plans } = data;

  // Get the active plan
  const activePlan = plans.find((p) => p.plan.status === 'active');

  if (!activePlan) {
    return <div>No active media plan</div>;
  }

  return (
    <div>
      <h2>Media Status: {MEDIA_STATUS_LABELS[summary.mediaStatus]}</h2>

      <h3>{activePlan.plan.name}</h3>
      <p>Budget: ${activePlan.plan.totalBudget?.toLocaleString()}</p>

      <h4>Channels:</h4>
      <ul>
        {activePlan.channels.map((ch) => (
          <li key={ch.id}>
            {MEDIA_CHANNEL_LABELS[ch.channel]} - {ch.budgetSharePct}%
            {ch.expectedVolume && (
              <span> ({ch.expectedVolume} expected)</span>
            )}
          </li>
        ))}
      </ul>

      {activePlan.flights.length > 0 && (
        <>
          <h4>Seasonal Flights:</h4>
          <ul>
            {activePlan.flights.map((flight) => (
              <li key={flight.id}>
                {flight.name} - ${flight.budget?.toLocaleString()}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

## Example 5: API Route Usage

If you need to fetch media data client-side:

```typescript
// Client component
'use client';

import { useEffect, useState } from 'react';
import type { MediaLabData } from '@/lib/media-lab/types';

export function ClientMediaView({ companyId }: { companyId: string }) {
  const [data, setData] = useState<MediaLabData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMediaData() {
      try {
        const res = await fetch(`/api/os/companies/${companyId}/media-lab`);
        const json = await res.json();

        if (json.ok) {
          setData(json.data);
        }
      } catch (error) {
        console.error('Failed to fetch media data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMediaData();
  }, [companyId]);

  if (loading) {
    return <div>Loading media data...</div>;
  }

  if (!data) {
    return <div>Failed to load media data</div>;
  }

  return (
    <div>
      <h2>Media Program</h2>
      <p>Active Plans: {data.summary.activePlanCount}</p>
      {/* Render your custom UI */}
    </div>
  );
}
```

## Example 6: Conditional Navigation/Tabs

Adding Media Lab to a tabbed navigation:

```typescript
import { getMediaLabSummary } from '@/lib/media-lab/server';

export default async function CompanyLayout({ params, children }) {
  const { companyId } = await params;
  const mediaSummary = await getMediaLabSummary(companyId);

  const hasMedia =
    mediaSummary.hasMediaProgram || mediaSummary.activePlanCount > 0;

  const tabs = [
    { name: 'Overview', href: `/company/${companyId}` },
    { name: 'Blueprint', href: `/blueprint/${companyId}` },
    { name: 'Analytics', href: `/analytics/${companyId}` },
  ];

  // Only add Media Lab tab if company has media
  if (hasMedia) {
    tabs.push({ name: 'Media Lab', href: `/media-lab/${companyId}` });
  }

  return (
    <div>
      <nav className="flex gap-4 border-b border-zinc-800 px-6">
        {tabs.map((tab) => (
          <a
            key={tab.href}
            href={tab.href}
            className="border-b-2 border-transparent px-4 py-3 text-sm font-medium hover:border-blue-600"
          >
            {tab.name}
          </a>
        ))}
      </nav>
      <main>{children}</main>
    </div>
  );
}
```

## Styling Notes

All components use the dark Hive OS theme:

```typescript
// Card container
<div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">

// Status badges
<span className="inline-flex items-center rounded-full bg-green-600/20 px-3 py-1 text-xs font-medium text-green-400">
  Running
</span>

// Primary button
<button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
  View Details
</button>

// Secondary button
<button className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
  Secondary Action
</button>
```

## Performance Optimization

For large dashboards, fetch only what you need:

```typescript
// Use summary for lightweight checks
const summary = await getMediaLabSummary(companyId); // Fast

// Only fetch full data when actually displaying media section
const fullData = summary.activePlanCount > 0
  ? await getMediaLabForCompany(companyId)
  : null;
```

## Testing Your Integration

1. Create a test company in Airtable
2. Set `Has Media Program` to true
3. Create a Media Plan linked to that company
4. Add some channels and flights
5. Visit `/media-lab/[companyId]` to verify data loads
6. Add MediaProgramSection to your Blueprint
7. Verify it shows up with correct data
8. Test with a company that has NO media (should hide)

## Troubleshooting

**Component doesn't show up:**
- Check `hasMediaProgram` flag on company
- Check `activePlanCount > 0` in summary
- MediaProgramSection auto-hides if both are false

**Data not loading:**
- Verify Airtable table names match constants
- Check Airtable API credentials
- Inspect server logs for errors
- Verify linked records are properly set up

**Styling issues:**
- Ensure Tailwind is configured correctly
- Check that zinc color palette is available
- Verify dark mode classes are working

## Next Steps

1. Integrate into Blueprint view (Example 1)
2. Integrate into Dashboard view (Example 2 or 3)
3. Add navigation/tabs if needed (Example 6)
4. Test with real company data
5. Iterate based on user feedback

All components are production-ready and follow your existing design patterns!
