// app/(public)/layout.tsx
// Bare layout for public pages (no sidebar, no auth).
// Pages inside the (public) route group bypass the root layout entirely.

import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Client Review Portal',
  description: 'Review creative assets for your project.',
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
