// components/growth/LoadingSkeleton.tsx

import React from "react";

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Hero Skeleton */}
      <div className="rounded-2xl border-2 border-gray-700 bg-gray-800 p-8">
        <div className="grid gap-8 lg:grid-cols-[1fr,1.2fr]">
          <div className="space-y-4">
            <div className="h-8 w-48 rounded bg-gray-700" />
            <div className="h-4 w-64 rounded bg-gray-700" />
            <div className="h-24 w-24 rounded-full bg-gray-700" />
          </div>
          <div className="space-y-4">
            <div className="h-4 w-full rounded bg-gray-700" />
            <div className="h-4 w-5/6 rounded bg-gray-700" />
            <div className="h-4 w-4/6 rounded bg-gray-700" />
          </div>
        </div>
      </div>

      {/* Scorecard Skeleton */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-64 rounded-xl border border-gray-700 bg-gray-800" />
        <div className="h-64 rounded-xl border border-gray-700 bg-gray-800" />
      </div>

      {/* Quick Wins Skeleton */}
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 rounded-xl border border-gray-700 bg-gray-800" />
        ))}
      </div>
    </div>
  );
};

