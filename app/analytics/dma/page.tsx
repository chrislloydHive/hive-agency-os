// app/analytics/dma/page.tsx
// DMA Funnel Analytics page for Hive OS
// Performance analytics for the DigitalMarketingAudit.ai acquisition funnel

import { getAuditFunnelSnapshot } from '@/lib/ga4Client';
import DmaFunnelClient from './DmaFunnelClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DMA Funnel',
  description: 'Analytics for the DMA audit funnel performance.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DmaFunnelPage() {
  try {
    // Default to last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 29);

    const endDate = today.toISOString().split('T')[0];
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];

    const snapshot = await getAuditFunnelSnapshot(startDate, endDate);

    return (
      <DmaFunnelClient
        initialSnapshot={snapshot}
        initialRange={{ startDate, endDate }}
      />
    );
  } catch (error) {
    console.error('Error loading DMA Funnel:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-100">DMA Funnel</h1>
          <p className="text-slate-400 mt-1">
            Performance of the DigitalMarketingAudit.ai acquisition funnel.
          </p>
        </div>

        <div className="bg-red-900/20 border border-red-700 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-red-400 mb-2">
            Error Loading Analytics
          </h2>
          <p className="text-slate-300 mb-4">{errorMessage}</p>
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-2">
              <strong>Required environment variables:</strong>
            </p>
            <ul className="text-sm text-slate-500 space-y-1 list-disc list-inside">
              <li>GA4_PROPERTY_ID</li>
              <li>GOOGLE_CLIENT_ID</li>
              <li>GOOGLE_CLIENT_SECRET</li>
              <li>GOOGLE_REFRESH_TOKEN</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }
}
