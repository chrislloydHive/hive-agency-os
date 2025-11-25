'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, { title: string; description: string }> = {
    Configuration: {
      title: 'Server Configuration Error',
      description: 'There is a problem with the server configuration. Please contact the administrator.',
    },
    AccessDenied: {
      title: 'Access Denied',
      description: 'You do not have permission to access this application. Only authorized team members can sign in.',
    },
    Verification: {
      title: 'Verification Error',
      description: 'The verification link may have expired or already been used.',
    },
    Default: {
      title: 'Authentication Error',
      description: 'An error occurred during authentication. Please try again.',
    },
  };

  const { title, description } = errorMessages[error || 'Default'] || errorMessages.Default;

  return (
    <div className="min-h-screen bg-[#050509] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Error Icon */}
        <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30">
          <svg
            className="w-8 h-8 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error Message */}
        <h1 className="text-2xl font-bold text-slate-100 mb-2">{title}</h1>
        <p className="text-slate-400 mb-8">{description}</p>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/auth/signin"
            className="block w-full px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="block w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg border border-slate-700 transition-colors"
          >
            Go Home
          </Link>
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-slate-600">
          If this problem persists, please contact support.
        </p>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050509] flex items-center justify-center">
          <div className="text-slate-400">Loading...</div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
