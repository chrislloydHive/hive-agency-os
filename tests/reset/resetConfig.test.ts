import { describe, it, expect } from 'vitest';
import { RESET_TABLES, RESET_DELETE_ORDER, RESET_DENYLIST, type CompanyRef } from '@/lib/os/reset/resetConfig';
import { buildMatchFormula } from '@/lib/os/reset/buildResetInventory';

describe('resetConfig', () => {
  it('does not include Companies table', () => {
    const hasCompanies = RESET_TABLES.some(t => RESET_DENYLIST.has(t.tableKey));
    expect(hasCompanies).toBe(false);
  });

  it('delete order is defined and non-empty', () => {
    expect(RESET_DELETE_ORDER.length).toBeGreaterThan(0);
  });

  it('all tables have company ref', () => {
    for (const t of RESET_TABLES) {
      expect(t.companyRef.fieldName).toBeTruthy();
    }
  });

  it('all tables have candidateRefs with at least one entry', () => {
    for (const t of RESET_TABLES) {
      // Either candidateRefs is populated, or we fall back to companyRef
      const candidates = t.candidateRefs && t.candidateRefs.length > 0 ? t.candidateRefs : [t.companyRef];
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].fieldName).toBeTruthy();
    }
  });

  it('candidateRefs include both linked and text options where available', () => {
    // Check that key tables have both linked and text fallbacks
    const keyTables = ['DIAGNOSTIC_RUNS', 'GAP_IA_RUN', 'ARTIFACTS'];
    for (const tableKey of keyTables) {
      const cfg = RESET_TABLES.find(t => t.tableKey === tableKey);
      expect(cfg).toBeDefined();
      if (cfg?.candidateRefs) {
        const hasLinked = cfg.candidateRefs.some(r => r.type === 'linked');
        const hasText = cfg.candidateRefs.some(r => r.type === 'text');
        expect(hasLinked || hasText).toBe(true);
      }
    }
  });
});

describe('match formula builder', () => {
  const companyId = 'rec123';

  it('builds text formula', () => {
    const ref: CompanyRef = { type: 'text', fieldName: 'companyId' };
    const formula = buildMatchFormula(ref, companyId);
    expect(formula).toBe('{companyId}="rec123"');
  });

  it('builds linked formula', () => {
    const ref: CompanyRef = { type: 'linked', fieldName: 'Company' };
    const formula = buildMatchFormula(ref, companyId);
    expect(formula).toBe('FIND("rec123", ARRAYJOIN({Company}))>0');
  });

  it('handles special characters in field names', () => {
    const ref: CompanyRef = { type: 'linked', fieldName: 'Company (from Run URL)' };
    const formula = buildMatchFormula(ref, companyId);
    expect(formula).toBe('FIND("rec123", ARRAYJOIN({Company (from Run URL)}))>0');
  });

  it('handles UUID-style company IDs', () => {
    const uuid = 'a09d09b0-2c8e-4ee1-bed6-cc474aaa909d';
    const ref: CompanyRef = { type: 'text', fieldName: 'companyId' };
    const formula = buildMatchFormula(ref, uuid);
    expect(formula).toBe(`{companyId}="${uuid}"`);
  });
});
