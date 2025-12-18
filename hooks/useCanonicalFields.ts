// hooks/useCanonicalFields.ts
// Hook for loading and managing canonical context fields

import { useState, useEffect, useCallback } from 'react';
import type { ContextFieldRecord } from '@/lib/os/context/schema';

export interface UseCanonicalFieldsResult {
  fields: ContextFieldRecord[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCanonicalFields(companyId: string): UseCanonicalFieldsResult {
  const [fields, setFields] = useState<ContextFieldRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFields = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/context/fields`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load fields');
      }

      const data = await response.json();
      setFields(data.fields || []);
    } catch (err) {
      console.error('[useCanonicalFields] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // Load on mount and when companyId changes
  useEffect(() => {
    loadFields();
  }, [loadFields]);

  return {
    fields,
    isLoading,
    error,
    refresh: loadFields,
  };
}

export default useCanonicalFields;
