// tests/os/artifactInstantiation.test.ts
// Tests for template instantiation and artifact creation

import { describe, it, expect } from 'vitest';
import {
  ArtifactSource,
  ArtifactProvenance,
  ArtifactStatus,
  ArtifactPhase,
  ArtifactStorage,
  ArtifactFileType,
  getSourceLabel,
  getProvenanceLabel,
} from '@/lib/types/artifactTaxonomy';

describe('ArtifactTaxonomy', () => {
  describe('ArtifactSource', () => {
    it('includes Template source', () => {
      expect(ArtifactSource.Template).toBe('template');
    });

    it('getSourceLabel returns correct label for Template', () => {
      expect(getSourceLabel(ArtifactSource.Template)).toBe('Template');
    });

    it('getSourceLabel returns correct labels for all sources', () => {
      // Verify all enum values have labels
      const sources = Object.values(ArtifactSource);
      for (const source of sources) {
        const label = getSourceLabel(source);
        expect(label).toBeDefined();
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      }
    });
  });

  describe('ArtifactProvenance', () => {
    it('includes AI, Human, and Mixed provenance types', () => {
      expect(ArtifactProvenance.AI).toBe('ai');
      expect(ArtifactProvenance.Human).toBe('human');
      expect(ArtifactProvenance.Mixed).toBe('mixed');
    });

    it('getProvenanceLabel returns correct labels', () => {
      expect(getProvenanceLabel(ArtifactProvenance.AI)).toBe('AI Generated');
      expect(getProvenanceLabel(ArtifactProvenance.Human)).toBe('Human');
      expect(getProvenanceLabel(ArtifactProvenance.Mixed)).toBe('AI + Human');
    });
  });

  describe('ArtifactStatus', () => {
    it('includes Superseded status', () => {
      expect(ArtifactStatus.Superseded).toBe('superseded');
    });

    it('includes all expected statuses', () => {
      expect(ArtifactStatus.Draft).toBe('draft');
      expect(ArtifactStatus.Final).toBe('final');
      expect(ArtifactStatus.Archived).toBe('archived');
      expect(ArtifactStatus.Stale).toBe('stale');
      expect(ArtifactStatus.Superseded).toBe('superseded');
    });
  });
});

describe('Template instantiation types', () => {
  it('can construct template artifact metadata', () => {
    const artifactData = {
      companyId: 'test-company-123',
      title: 'Test SOW - Statement of Work',
      artifactType: 'sow_doc',
      phase: ArtifactPhase.Deliver,
      status: ArtifactStatus.Draft,
      source: ArtifactSource.Template,
      storage: ArtifactStorage.GoogleDrive,
      fileType: ArtifactFileType.Doc,
      groupKey: 'template:sow',
      googleFileId: 'abc123',
      url: 'https://docs.google.com/document/d/abc123/edit',
    };

    // Verify all fields are correct types
    expect(artifactData.companyId).toBe('test-company-123');
    expect(artifactData.phase).toBe(ArtifactPhase.Deliver);
    expect(artifactData.source).toBe(ArtifactSource.Template);
    expect(artifactData.storage).toBe(ArtifactStorage.GoogleDrive);
    expect(artifactData.fileType).toBe(ArtifactFileType.Doc);
  });
});
