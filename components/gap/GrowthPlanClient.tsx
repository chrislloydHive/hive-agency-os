'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchGrowthPlan, fetchGrowthPlanByReportId, fetchGrowthPlanByGapId, type GrowthPlanApiResponse, type GrowthAccelerationPlan } from '@/lib/gap/client';
import { GrowthPlanView } from './GrowthPlanView';

interface GrowthPlanClientProps {
  initialUrl?: string;
  initialSnapshotId?: string;
  initialFullReportId?: string;
  initialGapPlanRunId?: string;
  initialGapId?: string;
}

type State = 'idle' | 'loading' | 'success' | 'error';

export default function GrowthPlanClient({
  initialUrl,
  initialSnapshotId,
  initialFullReportId,
  initialGapPlanRunId,
  initialGapId,
}: GrowthPlanClientProps) {
  const [state, setState] = useState<State>(
    initialUrl || initialFullReportId || initialGapPlanRunId || initialGapId ? 'loading' : 'idle'
  );
  const [plan, setPlan] = useState<GrowthAccelerationPlan | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [url, setUrl] = useState(initialUrl || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [reportScores, setReportScores] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // If gapId is provided, load from Airtable by gapId
    if (initialGapId) {
      setState('loading');
      setError(null);
      setWarnings([]);

      fetchGrowthPlanByGapId(initialGapId)
        .then((response: GrowthPlanApiResponse) => {
          if (response.ok) {
            setPlan(response.plan);
            if (response.warnings) {
              setWarnings(response.warnings);
            }
            // Extract diagnostics and scores from response if available
            if ('diagnostics' in response && response.diagnostics) {
              setDiagnostics(response.diagnostics);
            }
            if ('scores' in response && response.scores) {
              setReportScores(response.scores);
            }
            // Update URL to use clean gapId format if available
            if (response.plan?.gapId) {
              const gapId = response.plan.gapId;
              const currentPath = window.location.pathname;
              
              // If we're not already on the gapId route, navigate to it
              if (!currentPath.includes(`/growth-acceleration-plan/${gapId}`)) {
                router.replace(`/growth-acceleration-plan/${gapId}`);
              }
            }
            setState('success');
          } else {
            setState('error');
            setError({
              message: response.error || 'Failed to load report',
              code: response.code,
            });
          }
        })
        .catch((err) => {
          setState('error');
          setError({
            message: err instanceof Error ? err.message : 'Unknown error occurred',
            code: 'FETCH_ERROR',
          });
        });
      
      return;
    }

    // If fullReportId is provided, load from Airtable
    if (initialFullReportId) {
      setState('loading');
      setError(null);
      setWarnings([]);

      fetchGrowthPlanByReportId(initialFullReportId)
        .then((response: GrowthPlanApiResponse) => {
          if (response.ok) {
            setPlan(response.plan);
            if (response.warnings) {
              setWarnings(response.warnings);
            }
            // Extract diagnostics and scores from response if available
            if ('diagnostics' in response && response.diagnostics) {
              setDiagnostics(response.diagnostics);
            }
            if ('scores' in response && response.scores) {
              setReportScores(response.scores);
            }
            // Update URL to use clean gapId format if available
            if (response.plan?.gapId) {
              const gapId = response.plan.gapId;
              const currentPath = window.location.pathname;
              
              // If we're not already on the gapId route, navigate to it
              if (!currentPath.includes(`/growth-acceleration-plan/${gapId}`)) {
                router.replace(`/growth-acceleration-plan/${gapId}`);
              }
            }
            setState('success');
          } else {
            setState('error');
            setError({
              message: response.error || 'Failed to load report',
              code: response.code,
            });
          }
        })
        .catch((err) => {
          setState('error');
          setError({
            message: err instanceof Error ? err.message : 'Unknown error occurred',
            code: 'FETCH_ERROR',
          });
        });
      
      return;
    }

    // If gapPlanRunId is provided, load from GAP-Plan Run
    if (initialGapPlanRunId) {
      setState('error');
      setError({
        message: 'Loading from gapPlanRunId is not yet implemented',
        code: 'NOT_IMPLEMENTED',
      });
      return;
    }

    if (!initialUrl) {
      // No URL provided - stay in idle state to show form
      return;
    }

    setState('loading');
    setError(null);
    setWarnings([]);

    fetchGrowthPlan(initialUrl, initialSnapshotId)
      .then((response: GrowthPlanApiResponse) => {
        if (response.ok) {
          setPlan(response.plan);
          if (response.warnings) {
            setWarnings(response.warnings);
          }
          // Extract diagnostics and scores from response if available
          if ('diagnostics' in response && response.diagnostics) {
            setDiagnostics(response.diagnostics);
          }
          if ('scores' in response && response.scores) {
            setReportScores(response.scores);
          }
            // Update URL to use clean gapId format if available
            if (response.plan?.gapId) {
              const gapId = response.plan.gapId;
              const currentPath = window.location.pathname;
              const currentUrl = window.location.href;
              
              console.log('[GrowthPlanClient] 🔗 URL Update Check:', {
                gapId,
                currentPath,
                currentUrl,
                shouldUpdate: !currentPath.includes(`/growth-acceleration-plan/${gapId}`),
              });
              
              // If we're not already on the gapId route, navigate to it
              if (!currentPath.includes(`/growth-acceleration-plan/${gapId}`)) {
                const newUrl = `/growth-acceleration-plan/${gapId}`;
                console.log('[GrowthPlanClient] ✅ Updating URL to:', newUrl);
                router.replace(newUrl);
              } else {
                console.log('[GrowthPlanClient] ⏭️ URL already contains gapId, skipping update');
              }
            } else {
              console.warn('[GrowthPlanClient] ⚠️ Plan loaded but no gapId found:', response.plan);
            }
          setState('success');
        } else {
          setState('error');
          setError({
            message: response.error,
            code: response.code,
          });
        }
      })
      .catch((err) => {
        setState('error');
        setError({
          message: err instanceof Error ? err.message : 'Unknown error occurred',
          code: 'FETCH_ERROR',
        });
      });
  }, [initialUrl, initialSnapshotId, initialFullReportId, initialGapPlanRunId, initialGapId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    setIsSubmitting(true);
    setState('loading');
    setError(null);
    setWarnings([]);

    fetchGrowthPlan(url.trim(), initialSnapshotId)
      .then((response: GrowthPlanApiResponse) => {
        if (response.ok) {
          setPlan(response.plan);
          if (response.warnings) {
            setWarnings(response.warnings);
          }
          // Extract diagnostics and scores from response if available
          if ('diagnostics' in response && response.diagnostics) {
            setDiagnostics(response.diagnostics);
          }
          if ('scores' in response && response.scores) {
            setReportScores(response.scores);
          }
            // Update URL to use clean gapId format if available
            if (response.plan?.gapId) {
              const gapId = response.plan.gapId;
              const currentPath = window.location.pathname;
              const currentUrl = window.location.href;
              
              console.log('[GrowthPlanClient] 🔗 URL Update Check:', {
                gapId,
                currentPath,
                currentUrl,
                shouldUpdate: !currentPath.includes(`/growth-acceleration-plan/${gapId}`),
              });
              
              // If we're not already on the gapId route, navigate to it
              if (!currentPath.includes(`/growth-acceleration-plan/${gapId}`)) {
                const newUrl = `/growth-acceleration-plan/${gapId}`;
                console.log('[GrowthPlanClient] ✅ Updating URL to:', newUrl);
                router.replace(newUrl);
              } else {
                console.log('[GrowthPlanClient] ⏭️ URL already contains gapId, skipping update');
              }
            } else {
              console.warn('[GrowthPlanClient] ⚠️ Plan loaded but no gapId found:', response.plan);
            }
          setState('success');
        } else {
          setState('error');
          setError({
            message: response.error,
            code: response.code,
          });
        }
        setIsSubmitting(false);
      })
      .catch((err) => {
        setState('error');
        setError({
          message: err instanceof Error ? err.message : 'Unknown error occurred',
          code: 'FETCH_ERROR',
        });
        setIsSubmitting(false);
      });
  };

  const handleRetry = () => {
    setState('loading');
    setError(null);
    // Trigger re-fetch
    fetchGrowthPlan(initialUrl || url, initialSnapshotId)
      .then((response: GrowthPlanApiResponse) => {
        if (response.ok) {
          setPlan(response.plan);
          if (response.warnings) {
            setWarnings(response.warnings);
          }
          setState('success');
        } else {
          setState('error');
          setError({
            message: response.error,
            code: response.code,
          });
        }
      })
      .catch((err) => {
        setState('error');
        setError({
          message: err instanceof Error ? err.message : 'Unknown error occurred',
          code: 'FETCH_ERROR',
        });
      });
  };

  // Show form if no URL provided
  if (!initialUrl && state === 'idle') {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center px-4">
        <div className="max-w-2xl w-full">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
            <h1 className="text-3xl font-bold text-gray-100 mb-2">
              Growth Acceleration Plan
            </h1>
            <p className="text-gray-400 mb-8">
              Enter a website URL to generate a comprehensive Growth Acceleration Plan with quick wins, strategic initiatives, and a detailed roadmap.
            </p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-300 mb-2">
                  Website URL
                </label>
                <input
                  type="url"
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              
              <button
                type="submit"
                disabled={!url.trim() || isSubmitting}
                className="w-full px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Generating Plan...' : 'Generate Growth Plan'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'loading') {
    return <LoadingState />;
  }

  if (state === 'error') {
    return (
      <ErrorState
        message={error?.message || 'Unknown error'}
        code={error?.code}
        onRetry={handleRetry}
      />
    );
  }

  if (!plan) {
    return (
      <ErrorState
        message="No plan data received"
        code="NO_DATA"
        onRetry={handleRetry}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
            <h3 className="text-yellow-400 font-semibold mb-2">Warnings</h3>
            <ul className="list-disc list-inside text-yellow-300 text-sm space-y-1">
              {warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Use existing GrowthPlanView component */}
        <GrowthPlanView 
          plan={plan as any} 
          diagnostics={diagnostics}
          scores={reportScores}
        />
      </div>
    </div>
  );
}

function LoadingState() {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const steps = [
    { label: 'Fetching website data...', progress: 20 },
    { label: 'Analyzing content and structure...', progress: 40 },
    { label: 'Evaluating SEO performance...', progress: 60 },
    { label: 'Assessing brand positioning...', progress: 75 },
    { label: 'Identifying growth opportunities...', progress: 85 },
    { label: 'Generating strategic recommendations...', progress: 95 },
  ];

  useEffect(() => {
    // Simulate progress through steps
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        const next = prev + 1;
        if (next < steps.length) {
          setProgress(steps[next].progress);
          return next;
        }
        // Stay on last step but continue animating progress
        setProgress((prevProgress) => Math.min(prevProgress + 2, 99));
        return prev;
      });
    }, 800); // Faster step transitions (800ms instead of 2000ms)

    return () => clearInterval(interval);
  }, []);

  const currentStepData = steps[Math.min(currentStep, steps.length - 1)];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        {/* Spinning GAP V2 Badge */}
        <div className="mb-8 relative mx-auto w-24 h-24">
          <div className="absolute inset-0 animate-spin">
            <div className="w-full h-full border-4 border-gray-700 border-t-yellow-500 rounded-full"></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-yellow-500 font-bold text-xl">GAP</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden border border-gray-700">
            <div
              className="h-full bg-yellow-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">{progress}%</p>
        </div>

        {/* Current Step */}
        <div className="space-y-2">
          <p className="text-gray-300 text-sm font-medium">{currentStepData.label}</p>
          <div className="flex justify-center gap-1 mt-4">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                  idx <= currentStep
                    ? 'bg-yellow-500 w-4'
                    : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({
  message,
  code,
  onRetry,
}: {
  message: string;
  code?: string;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-red-900/20 border border-red-700/50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-red-400 mb-4">Error Loading Plan</h2>
        <p className="text-red-300 mb-2">{message}</p>
        {code && (
          <p className="text-sm text-red-400/70 mb-4">Error Code: {code}</p>
        )}
        <button
          onClick={onRetry}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

