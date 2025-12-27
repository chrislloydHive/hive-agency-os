// tests/os/artifactNavigation.test.ts
// Tests for canonical artifact navigation helpers

import { describe, it, expect } from 'vitest';
import {
  getArtifactViewerHref,
  getArtifactsListHref,
} from '@/lib/os/artifacts/navigation';

describe('getArtifactViewerHref', () => {
  it('returns correct viewer URL for artifact', () => {
    const companyId = 'company-123';
    const artifactId = 'artifact-456';

    const result = getArtifactViewerHref(companyId, artifactId);

    expect(result).toBe('/c/company-123/artifacts/artifact-456');
  });

  it('handles special characters in IDs', () => {
    const companyId = 'rec_ABC123';
    const artifactId = 'recXYZ_789';

    const result = getArtifactViewerHref(companyId, artifactId);

    expect(result).toBe('/c/rec_ABC123/artifacts/recXYZ_789');
  });
});

describe('getArtifactsListHref', () => {
  it('returns correct artifacts list URL in Deliver', () => {
    const companyId = 'company-123';

    const result = getArtifactsListHref(companyId);

    expect(result).toBe('/c/company-123/deliver/artifacts');
  });
});

describe('Navigation URL consistency', () => {
  it('artifacts list is under Deliver (not Documents)', () => {
    const href = getArtifactsListHref('test');

    // Artifacts list should be in Deliver, not Documents
    expect(href).toContain('/deliver/');
    expect(href).not.toContain('/documents/');
  });

  it('artifact viewer is a dedicated route', () => {
    const href = getArtifactViewerHref('test', 'art123');

    // Viewer should be /c/{company}/artifacts/{id}
    expect(href).toMatch(/^\/c\/[^/]+\/artifacts\/[^/]+$/);
  });
});
