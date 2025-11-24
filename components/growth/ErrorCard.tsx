// components/growth/ErrorCard.tsx

import React from "react";

type Props = {
  message: string;
  onRetry?: () => void;
};

export const ErrorCard: React.FC<Props> = ({ message, onRetry }) => {
  return (
    <div className="rounded-xl border border-red-700 bg-red-900/50 p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <svg
            className="h-6 w-6 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="mb-2 text-sm font-semibold text-red-200">
            Unable to generate Growth Acceleration Plan (GAP)
          </h3>
          <p className="mb-4 text-sm text-red-300">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

