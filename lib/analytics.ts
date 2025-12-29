/**
 * Analytics helper for pushing events to Google Tag Manager dataLayer
 */

export function trackEvent(eventName: string, params: Record<string, any> = {}) {
  // No-op on server
  if (typeof window === "undefined") return;

  // Ensure dataLayer exists
  (window as any).dataLayer = (window as any).dataLayer || [];

  // Push event to dataLayer
  (window as any).dataLayer.push({
    event: eventName,
    ...params,
  });

  // Debug logging in development only
  if (process.env.NODE_ENV !== "production") {
     
    console.debug("[analytics]", eventName, params);
  }
}
