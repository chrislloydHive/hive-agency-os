import { describe, it, expect } from 'vitest';
import {
  CLIENT_FOLDER_STRUCTURE,
  PROGRAM_FOLDER_STRUCTURE,
  FOLDER_STRUCTURE_VERSION,
  flattenStructure,
} from '@/lib/os/folders/structure';

describe('Drive folder structure v1', () => {
  it('has stable version', () => {
    expect(FOLDER_STRUCTURE_VERSION).toBe('v1');
  });

  it('client structure order is deterministic', () => {
    const keys = CLIENT_FOLDER_STRUCTURE.map(f => f.key);
    const names = CLIENT_FOLDER_STRUCTURE.map(f => f.name);
    expect(keys).toEqual([
      '00_admin',
      '01_contracts',
      '02_strategy',
      '03_programs',
      '04_creative',
      '05_media',
      '06_analytics',
      '07_deliverables',
      '08_archive',
    ]);
    expect(names[0]).toBe('00_Admin');
    expect(names[names.length - 1]).toBe('08_Archive');
  });

  it('program structure has 8 subfolders', () => {
    expect(PROGRAM_FOLDER_STRUCTURE).toHaveLength(8);
    expect(PROGRAM_FOLDER_STRUCTURE[0].name).toBe('00_Admin');
    expect(PROGRAM_FOLDER_STRUCTURE[PROGRAM_FOLDER_STRUCTURE.length - 1].name).toBe('07_Archive');
  });

  it('flattenStructure returns all nodes including children', () => {
    const flattened = flattenStructure(CLIENT_FOLDER_STRUCTURE);
    const keys = flattened.map(f => f.key);
    expect(keys).toContain('00_admin_contacts');
    expect(keys).toContain('01_contracts_msa');
    expect(keys).toContain('08_archive_deprecated');
    expect(keys).toContain('03_programs');
    expect(flattened.length).toBeGreaterThan(CLIENT_FOLDER_STRUCTURE.length);
  });
});

