// app/meta/page.tsx
// Meta Intelligence Dashboard - Cross-company pattern analysis

import { Metadata } from 'next';
import { MetaIntelligenceClient } from './MetaIntelligenceClient';

export const metadata: Metadata = {
  title: 'Meta Intelligence | Hive OS',
  description: 'Cross-company pattern analysis and emergent intelligence',
};

export default function MetaIntelligencePage() {
  return <MetaIntelligenceClient />;
}
