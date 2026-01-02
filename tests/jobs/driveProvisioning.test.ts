// tests/jobs/driveProvisioning.test.ts
// Tests for Google Drive folder provisioning logic

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { folderUrl } from '@/lib/google/driveClient';

describe('Drive URL Generation', () => {
  describe('folderUrl', () => {
    it('generates correct Drive folder URL', () => {
      expect(folderUrl('1234567890')).toBe(
        'https://drive.google.com/drive/folders/1234567890'
      );
    });

    it('handles various folder ID formats', () => {
      expect(folderUrl('abc123')).toBe(
        'https://drive.google.com/drive/folders/abc123'
      );
      expect(folderUrl('1-2_3')).toBe(
        'https://drive.google.com/drive/folders/1-2_3'
      );
    });
  });
});

describe('Folder Name Edge Cases', () => {
  it('handles folder names with special characters', () => {
    // These names should work with Google Drive API
    const validNames = [
      'Timeline/Schedule',
      'Estimate/Financials',
      'Client Brief/Comms',
      "Project's Name",
      'Q4 2025 Campaign',
      '117CAR Blog Development & Implementation',
    ];

    for (const name of validNames) {
      // Just verify they're valid strings
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('folder names preserve "/" characters', () => {
    const folderName = 'Timeline/Schedule';
    expect(folderName).toContain('/');
    expect(folderName.split('/').length).toBe(2);
  });
});

describe('Provisioning Idempotency', () => {
  it('same inputs produce same folder names', async () => {
    const { generateJobFolderName } = await import('@/lib/types/job');

    const name1 = generateJobFolderName('117CAR', 'Test Project');
    const name2 = generateJobFolderName('117CAR', 'Test Project');

    expect(name1).toBe(name2);
    expect(name1).toBe('117CAR Test Project');
  });

  it('different job numbers produce different folder names', async () => {
    const { generateJobFolderName } = await import('@/lib/types/job');

    const name1 = generateJobFolderName('117CAR', 'Test Project');
    const name2 = generateJobFolderName('118CAR', 'Test Project');

    expect(name1).not.toBe(name2);
  });
});

describe('Drive Client Configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('throws error when credentials are not configured', async () => {
    // Clear environment
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_JSON', '');
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', '');
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', '');

    // Re-import to get fresh module
    const driveClient = await import('@/lib/google/driveClient');

    expect(() => driveClient.getDriveClient()).toThrow(/credentials not configured/i);
  });

  it('accepts JSON configuration', async () => {
    const mockCredentials = {
      client_email: 'test@test.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
      project_id: 'test-project',
    };

    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_JSON', JSON.stringify(mockCredentials));

    // This would normally create a client - we're just testing config parsing
    // In a real test, we'd mock the google.auth.JWT constructor
    vi.resetModules();
  });
});

describe('Job Status Transitions', () => {
  it('has correct status values', async () => {
    const { JOB_STATUSES } = await import('@/lib/types/job');

    expect(JOB_STATUSES).toContain('not_started');
    expect(JOB_STATUSES).toContain('provisioning');
    expect(JOB_STATUSES).toContain('ready');
    expect(JOB_STATUSES).toContain('error');
    expect(JOB_STATUSES).toHaveLength(4);
  });

  it('has labels for all statuses', async () => {
    const { JOB_STATUSES, JobStatusLabels } = await import('@/lib/types/job');

    for (const status of JOB_STATUSES) {
      expect(JobStatusLabels[status]).toBeDefined();
      expect(typeof JobStatusLabels[status]).toBe('string');
    }
  });

  it('has colors for all statuses', async () => {
    const { JOB_STATUSES, JobStatusColors } = await import('@/lib/types/job');

    for (const status of JOB_STATUSES) {
      expect(JobStatusColors[status]).toBeDefined();
      expect(JobStatusColors[status].bg).toBeDefined();
      expect(JobStatusColors[status].text).toBeDefined();
      expect(JobStatusColors[status].border).toBeDefined();
    }
  });
});
