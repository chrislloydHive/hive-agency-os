// components/growth/DebugPanel.tsx

"use client";

import React, { useState } from "react";

import type { GAPDebug } from "@/lib/growth-plan/types";

type Props = {
  debug?: GAPDebug;
};

export const DebugPanel: React.FC<Props> = ({ debug }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Only show if debug data is available
  // The API already handles dev mode / debug flag logic
  if (!debug) {
    return null;
  }

  return (
    <div className="mt-8 rounded-xl border border-gray-700 bg-gray-900">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 transition-colors hover:text-gray-300"
      >
        <span>Debug Payload</span>
        <svg
          className={`h-4 w-4 transform transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="border-t border-gray-700 p-4">
          <div className="space-y-6">
            {/* Features */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Raw Features
              </h3>
              <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                <pre className="max-h-96 overflow-auto text-[10px] leading-relaxed text-gray-300">
                  {JSON.stringify(debug.features, null, 2)}
                </pre>
              </div>
            </div>

            {/* Rubric Scores */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Rubric Scores (Before LLM)
              </h3>
              <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                <div className="mb-2 text-xs font-medium text-gray-300">
                  Overall Score: {debug.rubricScores.overallScore}/100
                </div>
                <div className="space-y-3">
                  {debug.rubricScores.dimensions.map((dim) => (
                    <div
                      key={dim.name}
                      className="rounded border border-gray-700 bg-gray-900 p-2"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-300">
                          {dim.name.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                        <span className="text-xs text-yellow-400">
                          {dim.score}/100 (weight: {Math.round(dim.weight * 100)}%)
                        </span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {dim.components.map((comp) => (
                          <div
                            key={comp.name}
                            className="flex items-center justify-between text-[10px] text-gray-400"
                          >
                            <span>{comp.name}</span>
                            <span>
                              {comp.score}/{comp.max}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Final Scores */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Final Scores (In Scorecard)
              </h3>
              <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                <pre className="max-h-48 overflow-auto text-[10px] leading-relaxed text-gray-300">
                  {JSON.stringify(debug.finalScores, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

