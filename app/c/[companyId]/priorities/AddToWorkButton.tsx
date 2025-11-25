'use client';

import { useState } from 'react';
import Link from 'next/link';

interface AddToWorkButtonProps {
  companyId: string;
  fullReportId: string | undefined;
  priority: {
    id: string;
    title: string;
    [key: string]: any;
  };
}

export function AddToWorkButton({
  companyId,
  fullReportId,
  priority,
}: AddToWorkButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workItemId, setWorkItemId] = useState<string | null>(null);

  const handleAddToWork = async () => {
    if (!fullReportId) {
      setError('No OS Report available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/os/create-work-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId,
          fullReportId,
          priorityId: priority.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create work item');
      }

      setWorkItemId(data.workItemId);
      setIsSuccess(true);

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setIsSuccess(false);
        setWorkItemId(null);
      }, 5000);
    } catch (err: any) {
      console.error('Error creating work item:', err);
      setError(err.message || 'Failed to create work item');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-xs text-green-400 font-medium">
          ✓ Added to Work
        </div>
        <Link
          href={`/c/${companyId}/work`}
          className="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          View
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleAddToWork}
        disabled={isLoading || !fullReportId}
        className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm transition-colors ${
          isLoading || !fullReportId
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500'
        }`}
        title={!fullReportId ? 'No OS Report available for this priority' : 'Add to Work Items'}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-0.5 mr-1.5 h-3 w-3"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Adding...
          </>
        ) : (
          <>
            <svg
              className="-ml-0.5 mr-1.5 h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add to Work
          </>
        )}
      </button>

      {error && (
        <div className="text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
