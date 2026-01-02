// tests/jobs/jobCode.test.ts
// Tests for job code generation and validation

import { describe, it, expect } from 'vitest';
import {
  generateJobCode,
  parseJobCode,
  generateJobFolderName,
  isValidClientCode,
  normalizeClientCode,
} from '@/lib/types/job';

describe('Job Code Generation', () => {
  describe('generateJobCode', () => {
    it('generates correct job code from number and client code', () => {
      expect(generateJobCode(117, 'CAR')).toBe('117CAR');
      expect(generateJobCode(1, 'ABC')).toBe('1ABC');
      expect(generateJobCode(999, 'XYZ')).toBe('999XYZ');
    });

    it('uppercases client code', () => {
      expect(generateJobCode(117, 'car')).toBe('117CAR');
      expect(generateJobCode(117, 'Car')).toBe('117CAR');
    });

    it('handles large job numbers', () => {
      expect(generateJobCode(10000, 'ABC')).toBe('10000ABC');
    });
  });

  describe('parseJobCode', () => {
    it('parses valid job codes', () => {
      expect(parseJobCode('117CAR')).toEqual({ jobNumber: 117, clientCode: 'CAR' });
      expect(parseJobCode('1ABC')).toEqual({ jobNumber: 1, clientCode: 'ABC' });
      expect(parseJobCode('999XYZ')).toEqual({ jobNumber: 999, clientCode: 'XYZ' });
    });

    it('returns null for invalid job codes', () => {
      expect(parseJobCode('')).toBeNull();
      expect(parseJobCode('CAR117')).toBeNull(); // wrong order
      expect(parseJobCode('117CA')).toBeNull(); // only 2 letters
      expect(parseJobCode('117CARS')).toBeNull(); // 4 letters
      expect(parseJobCode('ABC')).toBeNull(); // no number
      expect(parseJobCode('117')).toBeNull(); // no letters
    });

    it('handles edge cases', () => {
      expect(parseJobCode('0ABC')).toEqual({ jobNumber: 0, clientCode: 'ABC' });
      expect(parseJobCode('10000XYZ')).toEqual({ jobNumber: 10000, clientCode: 'XYZ' });
    });
  });
});

describe('Client Code Validation', () => {
  describe('isValidClientCode', () => {
    it('accepts valid 3-letter uppercase codes', () => {
      expect(isValidClientCode('CAR')).toBe(true);
      expect(isValidClientCode('ABC')).toBe(true);
      expect(isValidClientCode('XYZ')).toBe(true);
    });

    it('rejects lowercase codes', () => {
      expect(isValidClientCode('car')).toBe(false);
      expect(isValidClientCode('Car')).toBe(false);
    });

    it('rejects codes with wrong length', () => {
      expect(isValidClientCode('CA')).toBe(false);
      expect(isValidClientCode('CARS')).toBe(false);
      expect(isValidClientCode('')).toBe(false);
    });

    it('rejects codes with numbers or special characters', () => {
      expect(isValidClientCode('CA1')).toBe(false);
      expect(isValidClientCode('C-R')).toBe(false);
      expect(isValidClientCode('C R')).toBe(false);
    });
  });

  describe('normalizeClientCode', () => {
    it('uppercases and trims codes', () => {
      expect(normalizeClientCode('car')).toBe('CAR');
      expect(normalizeClientCode(' CAR ')).toBe('CAR');
      expect(normalizeClientCode('Car')).toBe('CAR');
    });
  });
});

describe('Job Folder Name', () => {
  describe('generateJobFolderName', () => {
    it('generates correct folder name', () => {
      expect(generateJobFolderName('117CAR', 'Blog Development & Implementation')).toBe(
        '117CAR Blog Development & Implementation'
      );
    });

    it('handles special characters in project name', () => {
      expect(generateJobFolderName('118SIL', 'Q4 2025 Campaign')).toBe(
        '118SIL Q4 2025 Campaign'
      );
      expect(generateJobFolderName('119ABC', "Project with 'quotes'")).toBe(
        "119ABC Project with 'quotes'"
      );
    });

    it('preserves exact spacing', () => {
      expect(generateJobFolderName('120XYZ', 'Multi  Space  Name')).toBe(
        '120XYZ Multi  Space  Name'
      );
    });
  });
});

describe('Job Subfolder Structure', () => {
  it('has correct canonical subfolders', async () => {
    const { JOB_SUBFOLDERS, CREATIVE_SUBFOLDERS } = await import('@/lib/types/job');

    // Top-level subfolders
    expect(JOB_SUBFOLDERS).toContain('Timeline/Schedule');
    expect(JOB_SUBFOLDERS).toContain('Estimate/Financials');
    expect(JOB_SUBFOLDERS).toContain('Creative');
    expect(JOB_SUBFOLDERS).toContain('Client Brief/Comms');
    expect(JOB_SUBFOLDERS).toHaveLength(4);

    // Creative subfolders
    expect(CREATIVE_SUBFOLDERS).toContain('Working Files');
    expect(CREATIVE_SUBFOLDERS).toContain('Final Files');
    expect(CREATIVE_SUBFOLDERS).toContain('Assets');
    expect(CREATIVE_SUBFOLDERS).toHaveLength(3);
  });

  it('subfolders contain "/" characters as expected', async () => {
    const { JOB_SUBFOLDERS } = await import('@/lib/types/job');

    const foldersWithSlash = JOB_SUBFOLDERS.filter((name) => name.includes('/'));
    expect(foldersWithSlash.length).toBeGreaterThan(0);
    expect(foldersWithSlash).toContain('Timeline/Schedule');
    expect(foldersWithSlash).toContain('Estimate/Financials');
    expect(foldersWithSlash).toContain('Client Brief/Comms');
  });
});
