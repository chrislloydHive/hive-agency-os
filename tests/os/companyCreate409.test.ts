// tests/os/companyCreate409.test.ts
// Company Create 409 Conflict Tests
//
// These tests verify that the company creation API correctly handles
// domain conflicts and returns structured error responses.

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { extractDomain } from '@/lib/utils/extractDomain';
import { normalizeDomain } from '@/lib/airtable/companies';

const BASE_PATH = '/Users/chrislloyd/Hey, Dropbox/Chris Lloyd/Website Projects/hive-os';

// TODO: Re-enable when 409 conflict feature is implemented
describe.skip('Company Create 409 Conflict', () => {
  describe('API Route Response Structure', () => {
    it('should return DOMAIN_CONFLICT error code on 409', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/os/companies/create/route.ts'),
        'utf-8'
      );

      // Should return structured error with DOMAIN_CONFLICT code
      expect(fileContent).toContain("error: 'DOMAIN_CONFLICT'");
    });

    it('should return message field on 409', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/os/companies/create/route.ts'),
        'utf-8'
      );

      expect(fileContent).toContain("message: 'A company with this website already exists.'");
    });

    it('should return existingCompany object with id', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/os/companies/create/route.ts'),
        'utf-8'
      );

      expect(fileContent).toContain('existingCompany: {');
      expect(fileContent).toContain('id: existing.id');
    });

    it('should return existingCompany object with name', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/os/companies/create/route.ts'),
        'utf-8'
      );

      expect(fileContent).toContain('name: existing.name');
    });

    it('should return existingCompany object with website', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/os/companies/create/route.ts'),
        'utf-8'
      );

      expect(fileContent).toContain('website: existing.website');
    });

    it('should return Location header pointing to company page', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/os/companies/create/route.ts'),
        'utf-8'
      );

      expect(fileContent).toContain("'Location': `/c/${existing.id}`");
    });
  });

  describe('forceCreate Admin Override', () => {
    it('should support forceCreate request parameter', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/os/companies/create/route.ts'),
        'utf-8'
      );

      // Type should include forceCreate
      expect(fileContent).toContain('forceCreate?: boolean');
    });

    it('should only allow forceCreate when feature flag is enabled', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/os/companies/create/route.ts'),
        'utf-8'
      );

      // Should check feature flag
      expect(fileContent).toContain('FEATURE_FLAGS.ALLOW_DUPLICATE_COMPANIES');
      expect(fileContent).toContain('body.forceCreate && FEATURE_FLAGS.ALLOW_DUPLICATE_COMPANIES');
    });

    it('should log telemetry when force creating', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/os/companies/create/route.ts'),
        'utf-8'
      );

      expect(fileContent).toContain('logCompanyCreateForceCreate');
    });
  });

  describe('Telemetry Events', () => {
    it('should log conflict detected event', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/os/companies/create/route.ts'),
        'utf-8'
      );

      expect(fileContent).toContain('logCompanyCreateConflictDetected');
    });

    it('should have conflict event types defined', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'lib/telemetry/events.ts'),
        'utf-8'
      );

      expect(fileContent).toContain("'company_create_conflict_detected'");
      expect(fileContent).toContain("'company_create_conflict_open_existing'");
      expect(fileContent).toContain("'company_create_force_create'");
    });
  });

  describe('Feature Flag', () => {
    it('should have ALLOW_DUPLICATE_COMPANIES flag defined', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'lib/config/featureFlags.ts'),
        'utf-8'
      );

      expect(fileContent).toContain('ALLOW_DUPLICATE_COMPANIES');
    });

    it('should default to false (env var based)', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'lib/config/featureFlags.ts'),
        'utf-8'
      );

      expect(fileContent).toContain(
        "ALLOW_DUPLICATE_COMPANIES: process.env.NEXT_PUBLIC_ALLOW_DUPLICATE_COMPANIES === 'true'"
      );
    });
  });
});

describe('Domain Normalization', () => {
  describe('extractDomain utility', () => {
    it('should extract domain from full URL with https', () => {
      expect(extractDomain('https://example.com')).toBe('example.com');
    });

    it('should extract domain from URL with http', () => {
      expect(extractDomain('http://example.com')).toBe('example.com');
    });

    it('should strip www prefix', () => {
      expect(extractDomain('https://www.example.com')).toBe('example.com');
    });

    it('should strip trailing slash', () => {
      expect(extractDomain('https://example.com/')).toBe('example.com');
    });

    it('should strip path', () => {
      expect(extractDomain('https://example.com/page/about')).toBe('example.com');
    });

    it('should strip query params', () => {
      expect(extractDomain('https://example.com?foo=bar')).toBe('example.com');
    });

    it('should handle bare domain input', () => {
      expect(extractDomain('example.com')).toBe('example.com');
    });

    it('should normalize https://www.example.com/ to match example.com', () => {
      const variant1 = extractDomain('https://www.example.com/');
      const variant2 = extractDomain('example.com');
      expect(variant1).toBe(variant2);
    });
  });

  describe('normalizeDomain utility', () => {
    it('should normalize to lowercase', () => {
      expect(normalizeDomain('EXAMPLE.COM')).toBe('example.com');
    });

    it('should strip protocol', () => {
      expect(normalizeDomain('https://example.com')).toBe('example.com');
    });

    it('should strip www prefix', () => {
      expect(normalizeDomain('www.example.com')).toBe('example.com');
    });

    it('should strip trailing slash', () => {
      expect(normalizeDomain('example.com/')).toBe('example.com');
    });

    it('should strip port', () => {
      expect(normalizeDomain('example.com:8080')).toBe('example.com');
    });

    it('should handle complex URL with all components', () => {
      const result = normalizeDomain('https://www.example.com:8080/page?q=test');
      expect(result).toBe('example.com');
    });

    it('should match variants of the same domain', () => {
      const variants = [
        'https://www.example.com/',
        'http://example.com',
        'www.example.com',
        'example.com/',
        'EXAMPLE.COM',
      ];

      const normalized = variants.map(normalizeDomain);
      const allSame = normalized.every((n) => n === 'example.com');
      expect(allSame).toBe(true);
    });
  });
});

// TODO: Re-enable when 409 conflict feature is implemented
describe.skip('ProspectWizard Conflict UI', () => {
  it('should handle DOMAIN_CONFLICT error type', () => {
    const fileContent = fs.readFileSync(
      path.join(BASE_PATH, 'app/companies/new/ProspectWizard.tsx'),
      'utf-8'
    );

    expect(fileContent).toContain("data.error === 'DOMAIN_CONFLICT'");
  });

  it('should store existingCompany object from response', () => {
    const fileContent = fs.readFileSync(
      path.join(BASE_PATH, 'app/companies/new/ProspectWizard.tsx'),
      'utf-8'
    );

    expect(fileContent).toContain('setConflictCompany(data.existingCompany)');
  });

  it('should clear conflict state when website URL changes', () => {
    const fileContent = fs.readFileSync(
      path.join(BASE_PATH, 'app/companies/new/ProspectWizard.tsx'),
      'utf-8'
    );

    // Should have useEffect that clears conflict on websiteUrl change
    expect(fileContent).toContain('useEffect');
    expect(fileContent).toContain('setConflictCompany(null)');
    expect(fileContent).toContain('[websiteUrl]');
  });

  it('should display company website in conflict card', () => {
    const fileContent = fs.readFileSync(
      path.join(BASE_PATH, 'app/companies/new/ProspectWizard.tsx'),
      'utf-8'
    );

    expect(fileContent).toContain('conflictCompany.website');
  });

  it('should have Open Existing Company button', () => {
    const fileContent = fs.readFileSync(
      path.join(BASE_PATH, 'app/companies/new/ProspectWizard.tsx'),
      'utf-8'
    );

    expect(fileContent).toContain('Open Existing Company');
    expect(fileContent).toContain('href={`/c/${conflictCompany.id}`}');
  });

  it('should have Use Different Website button', () => {
    const fileContent = fs.readFileSync(
      path.join(BASE_PATH, 'app/companies/new/ProspectWizard.tsx'),
      'utf-8'
    );

    expect(fileContent).toContain('Use Different Website');
  });

  it('should conditionally show Create Anyway button based on feature flag', () => {
    const fileContent = fs.readFileSync(
      path.join(BASE_PATH, 'app/companies/new/ProspectWizard.tsx'),
      'utf-8'
    );

    expect(fileContent).toContain('FEATURE_FLAGS.ALLOW_DUPLICATE_COMPANIES');
    expect(fileContent).toContain('Create Anyway');
    expect(fileContent).toContain('forceCreate: true');
  });

  it('should log telemetry via beacon when opening existing company', () => {
    const fileContent = fs.readFileSync(
      path.join(BASE_PATH, 'app/companies/new/ProspectWizard.tsx'),
      'utf-8'
    );

    // Should use sendBeacon for client-side telemetry (avoids Airtable import)
    expect(fileContent).toContain('navigator.sendBeacon');
    expect(fileContent).toContain('/api/telemetry/event');
    expect(fileContent).toContain("type: 'company_create_conflict_open_existing'");
  });
});
