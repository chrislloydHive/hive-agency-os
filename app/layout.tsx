// app/layout.tsx
// Root layout for Hive OS

import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { OSLayout } from './OSLayout';

export const metadata: Metadata = {
  title: 'Hive OS - Growth Operating System',
  description: 'The operating system for growth agencies. Manage clients, track work, and monitor analytics.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <OSLayout>{children}</OSLayout>
        </Providers>
      </body>
    </html>
  );
}
