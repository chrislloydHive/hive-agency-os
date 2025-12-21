'use client';

// components/providers/StrategicMapCacheProvider.tsx
// Provider for Strategic Map cache
//
// Wraps the application to provide in-memory cache that persists
// across page navigations within the same session.

import {
  createContext,
  useContext,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { StrategicMapGraph } from '@/lib/contextGraph/strategicMap';
import type { ContextHealthScore } from '@/lib/contextGraph/health';
import type { ClientInsight } from '@/lib/types/clientBrain';

// ============================================================================
// Types
// ============================================================================

export interface MapCacheEntry {
  mapGraph: StrategicMapGraph;
  healthScore: ContextHealthScore;
  globalInsights: ClientInsight[];
  companyName: string;
  cachedAt: number;
}

interface StrategicMapCacheContextValue {
  getCache: (companyId: string) => MapCacheEntry | null;
  setCache: (companyId: string, entry: Omit<MapCacheEntry, 'cachedAt'>) => void;
  invalidate: (companyId: string) => void;
}

// ============================================================================
// Context
// ============================================================================

const StrategicMapCacheContext = createContext<StrategicMapCacheContextValue | null>(null);

// ============================================================================
// Constants
// ============================================================================

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes for in-memory cache

// ============================================================================
// Provider
// ============================================================================

interface StrategicMapCacheProviderProps {
  children: ReactNode;
}

export function StrategicMapCacheProvider({ children }: StrategicMapCacheProviderProps) {
  // Use ref for cache to persist across re-renders without causing re-renders
  const cacheRef = useRef<Map<string, MapCacheEntry>>(new Map());

  const getCache = useCallback((companyId: string): MapCacheEntry | null => {
    const entry = cacheRef.current.get(companyId);
    if (!entry) {
      return null;
    }

    // Check if cache is still valid
    const age = Date.now() - entry.cachedAt;
    if (age > CACHE_TTL_MS) {
      cacheRef.current.delete(companyId);
      return null;
    }

    return entry;
  }, []);

  const setCache = useCallback((companyId: string, entry: Omit<MapCacheEntry, 'cachedAt'>) => {
    cacheRef.current.set(companyId, {
      ...entry,
      cachedAt: Date.now(),
    });
  }, []);

  const invalidate = useCallback((companyId: string) => {
    cacheRef.current.delete(companyId);
  }, []);

  return (
    <StrategicMapCacheContext.Provider value={{ getCache, setCache, invalidate }}>
      {children}
    </StrategicMapCacheContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useStrategicMapCache() {
  const context = useContext(StrategicMapCacheContext);
  if (!context) {
    // Return a no-op implementation if used outside provider
    return {
      getCache: () => null,
      setCache: () => {},
      invalidate: () => {},
    };
  }
  return context;
}
