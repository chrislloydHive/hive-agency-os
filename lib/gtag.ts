// Google Analytics 4 tracking utilities

export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID || '';

// https://developers.google.com/analytics/devguides/collection/gtagjs/pages
export const pageview = (url: string) => {
  if (!GA_TRACKING_ID || typeof window === 'undefined' || !window.gtag) return;

  window.gtag('config', GA_TRACKING_ID, {
    page_path: url,
  });
};

// https://developers.google.com/analytics/devguides/collection/gtagjs/events
export const event = (action: string, params?: Record<string, any>) => {
  if (!GA_TRACKING_ID || typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', action, params);

  // Console log for testing (remove after validation)
  if (process.env.NODE_ENV === 'development') {
    console.log('[GA4 Event]', action, params);
  }
};

// Type declaration for gtag
export {}; // Make this a module

declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event',
      targetId: string,
      config?: Record<string, any>
    ) => void;
    dataLayer?: any[];
  }
}
