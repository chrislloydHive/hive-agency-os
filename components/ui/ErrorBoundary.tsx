'use client';

// components/ui/ErrorBoundary.tsx
// Generic error boundary for graceful error handling

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Title shown in error state */
  title?: string;
  /** Description shown in error state */
  description?: string;
  /** Whether to show retry button */
  showRetry?: boolean;
  /** Custom CSS class */
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component for catching and handling React errors
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary
 *   title="Media Dashboard"
 *   description="There was an error loading the media dashboard."
 *   showRetry
 * >
 *   <MediaDashboard />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback takes precedence
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      const {
        title = 'Something went wrong',
        description = 'An unexpected error occurred. Please try again.',
        showRetry = true,
        className = '',
      } = this.props;

      return (
        <div className={`bg-slate-900 border border-red-500/30 rounded-xl p-6 ${className}`}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-red-300">{title}</h3>
              <p className="text-xs text-slate-400 mt-1">{description}</p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <pre className="mt-3 p-2 bg-slate-950 rounded text-xs text-red-400/80 overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              )}

              {showRetry && (
                <button
                  onClick={this.handleRetry}
                  className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
