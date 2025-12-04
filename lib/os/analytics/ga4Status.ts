// lib/os/analytics/ga4Status.ts
// Normalized GA4 status types and result wrappers

/**
 * GA4 fetch status codes
 */
export type Ga4Status = 'ok' | 'no_config' | 'no_data' | 'error';

/**
 * Normalized GA4 result wrapper
 */
export interface Ga4Result<T> {
  status: Ga4Status;
  data: T | null;
  errorMessage?: string;
}

/**
 * Create a successful GA4 result
 */
export function ga4Ok<T>(data: T): Ga4Result<T> {
  return {
    status: 'ok',
    data,
  };
}

/**
 * Create a no-config result (GA4 not set up)
 */
export function ga4NoConfig<T>(): Ga4Result<T> {
  return {
    status: 'no_config',
    data: null,
    errorMessage: 'GA4 is not configured for this company.',
  };
}

/**
 * Create a no-data result (GA4 configured but no data returned)
 */
export function ga4NoData<T>(): Ga4Result<T> {
  return {
    status: 'no_data',
    data: null,
    errorMessage: 'No data found for the selected period.',
  };
}

/**
 * Create an error result
 */
export function ga4Error<T>(message: string): Ga4Result<T> {
  return {
    status: 'error',
    data: null,
    errorMessage: message,
  };
}

/**
 * Helper to check if a GA4 result has usable data
 */
export function hasGa4Data<T>(result: Ga4Result<T>): result is Ga4Result<T> & { data: T } {
  return result.status === 'ok' && result.data !== null;
}

/**
 * Get user-friendly message for GA4 status
 */
export function getGa4StatusMessage(status: Ga4Status): string {
  switch (status) {
    case 'ok':
      return 'Analytics data loaded successfully.';
    case 'no_config':
      return 'GA4 is not configured for this company. Add a GA4 property in Company Settings to enable performance reporting.';
    case 'no_data':
      return 'No GA4 data found for the selected period.';
    case 'error':
      return "We couldn't load analytics data right now. Please try again later.";
  }
}

/**
 * Get status color classes for UI
 */
export function getGa4StatusColors(status: Ga4Status): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'ok':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
      };
    case 'no_config':
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
      };
    case 'no_data':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
      };
    case 'error':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
      };
  }
}

/**
 * Get status label for display
 */
export function getGa4StatusLabel(status: Ga4Status): string {
  switch (status) {
    case 'ok':
      return 'Connected';
    case 'no_config':
      return 'Not Configured';
    case 'no_data':
      return 'No Data';
    case 'error':
      return 'Error';
  }
}
