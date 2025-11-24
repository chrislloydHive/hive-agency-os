// components/gap/FullGapLoadingState.tsx
// Loading state for Full GAP generation (4+ minute process)

"use client";

import React from "react";

export function FullGapLoadingState() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-purple-700/50 bg-purple-900/10 p-12">
      {/* Animated spinner */}
      <div className="relative mb-6">
        <div className="h-24 w-24 rounded-full border-4 border-slate-700">
          <div className="absolute inset-0 h-24 w-24 animate-spin rounded-full border-4 border-transparent border-t-purple-500"></div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-purple-400">FULL</span>
        </div>
      </div>

      {/* Main heading */}
      <h2 className="mb-4 text-center text-2xl font-bold text-slate-100">
        Generating your Full Growth Acceleration Plan...
      </h2>

      {/* Description */}
      <p className="mb-6 max-w-lg text-center text-base leading-relaxed text-slate-400">
        We're creating a comprehensive strategic plan with deep analysis, custom
        roadmap, and prioritized initiatives. This can take 5 minutes or more.
      </p>

      {/* What's happening */}
      <div className="mb-8 w-full max-w-md space-y-3 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-purple-500"></div>
          <p className="text-sm text-slate-300">
            Analyzing your GAP-IA results and market context
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-1 h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-purple-500" style={{ animationDelay: "0.5s" }}></div>
          <p className="text-sm text-slate-300">
            Building custom strategic initiatives for your business
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-1 h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-purple-500" style={{ animationDelay: "1s" }}></div>
          <p className="text-sm text-slate-300">
            Creating prioritized 90-day roadmap with quick wins
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-1 h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-purple-500" style={{ animationDelay: "1.5s" }}></div>
          <p className="text-sm text-slate-300">
            Generating detailed implementation guidance
          </p>
        </div>
      </div>

      {/* Helpful tip */}
      <div className="max-w-md rounded-lg border border-blue-700/50 bg-blue-900/20 p-4 text-center">
        <p className="text-sm text-blue-300">
          💡 <strong>Tip:</strong> You can leave this window open and come back
          later. Your report will be ready when you return.
        </p>
      </div>
    </div>
  );
}
