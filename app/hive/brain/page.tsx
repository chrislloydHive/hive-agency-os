// app/hive/brain/page.tsx
// Hive Brain Dashboard - Central Intelligence Interface

import { Suspense } from 'react';
import { HiveBrainClient } from './HiveBrainClient';

export const metadata = {
  title: 'Hive Brain | Meta-Intelligence Dashboard',
  description: 'Cross-company reasoning, causal modeling, and strategic simulation',
};

export default function HiveBrainPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<LoadingSkeleton />}>
        <HiveBrainClient />
      </Suspense>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-8 animate-pulse">
      <div className="h-10 bg-gray-200 rounded w-64 mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
