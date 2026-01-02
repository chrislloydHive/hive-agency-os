// tests/jobs/templates.test.ts
// Tests for template and document functionality

import { describe, it, expect } from 'vitest';
import {
  generateDocumentName,
  getDestinationForDocType,
  DOCUMENT_TYPES,
  TEMPLATE_SCOPES,
  DESTINATION_FOLDER_KEYS,
  DESTINATION_FOLDER_NAMES,
  DocumentTypeLabels,
  JobDocumentStatusLabels,
  JobDocumentStatusColors,
} from '@/lib/types/template';

describe('Document Name Generation', () => {
  describe('generateDocumentName', () => {
    it('generates correct SOW name', () => {
      expect(generateDocumentName('SOW', '117CAR', 'Car Toys')).toBe(
        '117CAR – Statement of Work'
      );
    });

    it('generates correct Brief name', () => {
      expect(generateDocumentName('BRIEF', '118ABC', 'Acme Corp')).toBe(
        '118ABC – Project Brief'
      );
    });

    it('generates correct Timeline name', () => {
      expect(generateDocumentName('TIMELINE', '119XYZ', 'XYZ Inc')).toBe(
        '119XYZ – Timeline'
      );
    });

    it('generates correct MSA name (uses client name, not job code)', () => {
      expect(generateDocumentName('MSA', '', 'Car Toys')).toBe(
        'Hive x Car Toys – Master Services Agreement'
      );
    });

    it('generates fallback name for unknown document type', () => {
      // @ts-expect-error - testing unknown type
      expect(generateDocumentName('UNKNOWN', '117CAR', 'Car Toys')).toBe(
        '117CAR – Document'
      );
    });
  });
});

describe('Destination Folder Mapping', () => {
  describe('getDestinationForDocType', () => {
    it('maps SOW to estimate folder', () => {
      expect(getDestinationForDocType('SOW')).toBe('estimate');
    });

    it('maps BRIEF to brief folder', () => {
      expect(getDestinationForDocType('BRIEF')).toBe('brief');
    });

    it('maps TIMELINE to timeline folder', () => {
      expect(getDestinationForDocType('TIMELINE')).toBe('timeline');
    });

    it('maps MSA to client MSA folder', () => {
      expect(getDestinationForDocType('MSA')).toBe('client_msa_folder');
    });

    it('defaults to estimate for unknown types', () => {
      // @ts-expect-error - testing unknown type
      expect(getDestinationForDocType('UNKNOWN')).toBe('estimate');
    });
  });

  describe('DESTINATION_FOLDER_NAMES', () => {
    it('has correct folder names', () => {
      expect(DESTINATION_FOLDER_NAMES.estimate).toBe('Estimate/Financials');
      expect(DESTINATION_FOLDER_NAMES.brief).toBe('Client Brief/Comms');
      expect(DESTINATION_FOLDER_NAMES.timeline).toBe('Timeline/Schedule');
      expect(DESTINATION_FOLDER_NAMES.client_msa_folder).toBe('MSA');
      expect(DESTINATION_FOLDER_NAMES.client_root).toBeNull();
    });
  });
});

describe('Type Constants', () => {
  describe('DOCUMENT_TYPES', () => {
    it('contains all expected document types', () => {
      expect(DOCUMENT_TYPES).toContain('SOW');
      expect(DOCUMENT_TYPES).toContain('BRIEF');
      expect(DOCUMENT_TYPES).toContain('TIMELINE');
      expect(DOCUMENT_TYPES).toContain('MSA');
      expect(DOCUMENT_TYPES).toHaveLength(4);
    });
  });

  describe('TEMPLATE_SCOPES', () => {
    it('contains job and client scopes', () => {
      expect(TEMPLATE_SCOPES).toContain('job');
      expect(TEMPLATE_SCOPES).toContain('client');
      expect(TEMPLATE_SCOPES).toHaveLength(2);
    });
  });

  describe('DESTINATION_FOLDER_KEYS', () => {
    it('contains all expected folder keys', () => {
      expect(DESTINATION_FOLDER_KEYS).toContain('estimate');
      expect(DESTINATION_FOLDER_KEYS).toContain('brief');
      expect(DESTINATION_FOLDER_KEYS).toContain('timeline');
      expect(DESTINATION_FOLDER_KEYS).toContain('client_root');
      expect(DESTINATION_FOLDER_KEYS).toContain('client_msa_folder');
      expect(DESTINATION_FOLDER_KEYS).toHaveLength(5);
    });
  });
});

describe('Labels and Colors', () => {
  describe('DocumentTypeLabels', () => {
    it('has labels for all document types', () => {
      for (const docType of DOCUMENT_TYPES) {
        expect(DocumentTypeLabels[docType]).toBeDefined();
        expect(typeof DocumentTypeLabels[docType]).toBe('string');
      }
    });

    it('has correct label text', () => {
      expect(DocumentTypeLabels.SOW).toBe('Statement of Work');
      expect(DocumentTypeLabels.BRIEF).toBe('Project Brief');
      expect(DocumentTypeLabels.TIMELINE).toBe('Timeline');
      expect(DocumentTypeLabels.MSA).toBe('Master Services Agreement');
    });
  });

  describe('JobDocumentStatusLabels', () => {
    it('has labels for all statuses', () => {
      expect(JobDocumentStatusLabels.draft).toBe('Draft');
      expect(JobDocumentStatusLabels.in_review).toBe('In Review');
      expect(JobDocumentStatusLabels.final).toBe('Final');
    });
  });

  describe('JobDocumentStatusColors', () => {
    it('has color definitions for all statuses', () => {
      const statuses = ['draft', 'in_review', 'final'] as const;
      for (const status of statuses) {
        expect(JobDocumentStatusColors[status]).toBeDefined();
        expect(JobDocumentStatusColors[status].bg).toBeDefined();
        expect(JobDocumentStatusColors[status].text).toBeDefined();
        expect(JobDocumentStatusColors[status].border).toBeDefined();
      }
    });
  });
});

describe('Document Name Patterns', () => {
  it('uses en-dash (–) not hyphen (-) in names', () => {
    const sowName = generateDocumentName('SOW', '117CAR', 'Test');
    expect(sowName).toContain('–'); // en-dash
    expect(sowName).not.toContain(' - '); // not hyphen with spaces
  });

  it('MSA name includes Hive branding', () => {
    const msaName = generateDocumentName('MSA', '', 'Acme Corp');
    expect(msaName).toMatch(/^Hive x/);
  });

  it('job-scoped documents include job code', () => {
    const sowName = generateDocumentName('SOW', '117CAR', 'Test');
    expect(sowName).toContain('117CAR');

    const briefName = generateDocumentName('BRIEF', '118ABC', 'Test');
    expect(briefName).toContain('118ABC');

    const timelineName = generateDocumentName('TIMELINE', '119XYZ', 'Test');
    expect(timelineName).toContain('119XYZ');
  });

  it('MSA does not include job code', () => {
    const msaName = generateDocumentName('MSA', '117CAR', 'Test Client');
    expect(msaName).not.toContain('117CAR');
    expect(msaName).toContain('Test Client');
  });
});
