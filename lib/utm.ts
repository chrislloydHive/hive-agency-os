// UTM parameter capture and storage utilities

const UTM_STORAGE_KEY = 'dma_utm';

export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

/**
 * Parse UTM parameters from a query string
 */
export const parseUTMFromQuery = (queryString: string): UTMParams => {
  const params = new URLSearchParams(queryString);
  const utmParams: UTMParams = {};

  const utmKeys: (keyof UTMParams)[] = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
  ];

  utmKeys.forEach((key) => {
    const value = params.get(key);
    if (value) {
      utmParams[key] = value;
    }
  });

  return utmParams;
};

/**
 * Save UTM parameters from current URL query string to sessionStorage
 * Only updates if new UTM params are present; preserves existing if not
 */
export const saveUTM = (queryString?: string): void => {
  if (typeof window === 'undefined') return;

  const query = queryString || window.location.search;
  const newUTMs = parseUTMFromQuery(query);

  // Only save if we found UTM parameters
  if (Object.keys(newUTMs).length > 0) {
    try {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(newUTMs));

      // Console log for testing (remove after validation)
      if (process.env.NODE_ENV === 'development') {
        console.log('[UTM Saved]', newUTMs);
      }
    } catch (e) {
      // Silently fail if sessionStorage is not available
      console.warn('Could not save UTM parameters:', e);
    }
  }
};

/**
 * Retrieve stored UTM parameters from sessionStorage
 */
export const getUTM = (): UTMParams => {
  if (typeof window === 'undefined') return {};

  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);

      // Console log for testing (remove after validation)
      if (process.env.NODE_ENV === 'development') {
        console.log('[UTM Retrieved]', parsed);
      }

      return parsed;
    }
  } catch (e) {
    console.warn('Could not retrieve UTM parameters:', e);
  }

  return {};
};

/**
 * Clear stored UTM parameters
 */
export const clearUTM = (): void => {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(UTM_STORAGE_KEY);
  } catch (e) {
    console.warn('Could not clear UTM parameters:', e);
  }
};

/**
 * Initialize UTM tracking on page load
 * Call this once when the app loads
 */
export const initUTMTracking = (): void => {
  if (typeof window === 'undefined') return;

  // Save UTMs from current URL if present
  saveUTM(window.location.search);
};
