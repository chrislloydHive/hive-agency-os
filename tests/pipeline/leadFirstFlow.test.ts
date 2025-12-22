// tests/pipeline/leadFirstFlow.test.ts
// Lead-First Flow Tests
//
// These tests verify that the lead-first design is correctly implemented:
// - Inbound leads create Lead records, NOT Company records
// - Company creation only happens via explicit conversion
// - DMA contact creates leads without requiring a company

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Use process.cwd() to resolve the repo root dynamically
const BASE_PATH = process.cwd();

describe('Lead-First Flow', () => {
  describe('matchCompanyForLead Function Design', () => {
    it('should exist and be exported', async () => {
      const { matchCompanyForLead } = await import('@/lib/pipeline/createOrMatchCompany');
      expect(typeof matchCompanyForLead).toBe('function');
    });

    it('should return MatchResult type with nullable company', async () => {
      // Type verification - the function signature should return MatchResult
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'lib/pipeline/createOrMatchCompany.ts'),
        'utf-8'
      );

      // Verify the return type is MatchResult
      expect(fileContent).toContain('export interface MatchResult');
      expect(fileContent).toContain('company: CompanyRecord | null');
      expect(fileContent).toContain("matchedBy: 'domain' | 'name' | null");
    });

    it('should NOT call createCompany (match-only design)', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'lib/pipeline/createOrMatchCompany.ts'),
        'utf-8'
      );

      // Get just the matchCompanyForLead function body
      const funcStart = fileContent.indexOf('export async function matchCompanyForLead');
      const funcEnd = fileContent.indexOf('export async function createOrMatchCompanyFromInboundLead');

      const matchCompanyFunc = fileContent.slice(funcStart, funcEnd);

      // The matchCompanyForLead function should NOT contain createCompany call
      expect(matchCompanyFunc).not.toContain('await createCompany(');
      expect(matchCompanyFunc).toContain('return {');
      expect(matchCompanyFunc).toContain('company: null');
    });
  });

  describe('Inbound Ingest Endpoint', () => {
    it('should use matchCompanyForLead (not createOrMatchCompanyFromInboundLead)', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/inbound/ingest/route.ts'),
        'utf-8'
      );

      // Should import matchCompanyForLead
      expect(fileContent).toContain("import { matchCompanyForLead }");

      // Should NOT import createOrMatchCompanyFromInboundLead
      expect(fileContent).not.toContain("import { createOrMatchCompanyFromInboundLead }");
    });

    it('should have telemetry.company_created always false in type', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/inbound/ingest/route.ts'),
        'utf-8'
      );

      // The IngestResult type should have company_created: false (literal type)
      expect(fileContent).toContain('company_created: false');
    });

    it('should log company_created=false in telemetry', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/inbound/ingest/route.ts'),
        'utf-8'
      );

      // Should log that company was not created
      expect(fileContent).toContain('companyCreated: result.telemetry.company_created');
    });
  });

  describe('DMA Contact V2 Endpoint', () => {
    it('should use createOrUpdatePipelineLeadFromDmaV2 (not V1)', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/pipeline/dma-contact/route.ts'),
        'utf-8'
      );

      // Should import V2 function (may be alongside other imports)
      expect(fileContent).toContain('createOrUpdatePipelineLeadFromDmaV2');
      // Should NOT use V1 function (without V2 suffix)
      expect(fileContent).not.toMatch(/createOrUpdatePipelineLeadFromDma[^V]/)
    });

    it('should NOT require companyId', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/pipeline/dma-contact/route.ts'),
        'utf-8'
      );

      // Should NOT have a check that returns error for missing companyId
      expect(fileContent).not.toContain("if (!companyId)");
      expect(fileContent).not.toContain("error: 'companyId is required'");
    });

    it('should have company_created: false in telemetry', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/pipeline/dma-contact/route.ts'),
        'utf-8'
      );

      // Should have company_created always false
      expect(fileContent).toContain('company_created: false');
    });
  });

  describe('DMA Lead Creation V2', () => {
    it('should have linkedCompanyId as optional parameter', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'lib/airtable/inboundLeads.ts'),
        'utf-8'
      );

      // linkedCompanyId should be optional (nullable)
      expect(fileContent).toContain('linkedCompanyId?: string | null');
    });

    it('should use email + domain + source for deduplication', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'lib/airtable/inboundLeads.ts'),
        'utf-8'
      );

      // V2 function should build filter without requiring companyId
      expect(fileContent).toContain("filterParts.push(`{Normalized Domain} = '${domain}'`)");
    });
  });

  describe('Conversion Endpoints', () => {
    it('Lead → Company conversion should be idempotent', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/pipeline/convert-lead-to-company/route.ts'),
        'utf-8'
      );

      // Should check if lead already linked and return existing
      expect(fileContent).toContain('if (lead.companyId)');
      expect(fileContent).toContain('alreadyConverted: true');
    });

    it('Lead → Opportunity conversion should be idempotent', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/pipeline/convert-lead-to-opportunity/route.ts'),
        'utf-8'
      );

      // Should check if lead already has opportunity and return existing
      expect(fileContent).toContain('if (lead.linkedOpportunityId)');
      expect(fileContent).toContain('alreadyConverted: true');
    });

    it('Lead → Opportunity should require company link first', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/pipeline/convert-lead-to-opportunity/route.ts'),
        'utf-8'
      );

      // Should check for companyId before creating opportunity
      expect(fileContent).toContain('if (!lead.companyId)');
      expect(fileContent).toContain('Lead must be linked to a company first');
    });
  });

  describe('Schema Alignment', () => {
    it('InboundLeadItem type should have conversion fields', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'lib/types/pipeline.ts'),
        'utf-8'
      );

      // Should have linkedOpportunityId and convertedAt fields
      expect(fileContent).toContain('linkedOpportunityId?: string | null');
      expect(fileContent).toContain('convertedAt?: string | null');
    });

    it('Airtable mapping should read conversion fields', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'lib/airtable/inboundLeads.ts'),
        'utf-8'
      );

      // Should map Linked Opportunity and Converted At fields
      expect(fileContent).toContain("fields['Linked Opportunity']");
      expect(fileContent).toContain("fields['Converted At']");
    });

    it('should have updateLeadConvertedAt function', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'lib/airtable/inboundLeads.ts'),
        'utf-8'
      );

      expect(fileContent).toContain('export async function updateLeadConvertedAt');
    });

    it('should have updateLeadLinkedOpportunity function', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'lib/airtable/inboundLeads.ts'),
        'utf-8'
      );

      expect(fileContent).toContain('export async function updateLeadLinkedOpportunity');
    });
  });

  describe('Guardrails', () => {
    it('createOrMatchCompanyFromInboundLead should be marked deprecated', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'lib/pipeline/createOrMatchCompany.ts'),
        'utf-8'
      );

      expect(fileContent).toContain('@deprecated');
      expect(fileContent).toContain('Use matchCompanyForLead() for lead-first flows');
    });

    it('inbound ingest should have LEAD-FIRST DESIGN comment', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/inbound/ingest/route.ts'),
        'utf-8'
      );

      expect(fileContent).toContain('LEAD-FIRST DESIGN');
    });

    it('DMA contact should have LEAD-FIRST DESIGN comment', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/pipeline/dma-contact/route.ts'),
        'utf-8'
      );

      expect(fileContent).toContain('LEAD-FIRST DESIGN');
    });

    it('convert-lead-to-company should have LEAD-FIRST DESIGN comment', () => {
      const fileContent = fs.readFileSync(
        path.join(BASE_PATH, 'app/api/pipeline/convert-lead-to-company/route.ts'),
        'utf-8'
      );

      expect(fileContent).toContain('LEAD-FIRST DESIGN');
    });
  });
});
