'use client';

import { SessionProvider } from 'next-auth/react';
import { StrategicMapCacheProvider } from '@/components/providers/StrategicMapCacheProvider';
import type { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <StrategicMapCacheProvider>
        {children}
      </StrategicMapCacheProvider>
    </SessionProvider>
  );
}
