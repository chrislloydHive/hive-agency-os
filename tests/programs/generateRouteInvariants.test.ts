// tests/programs/generateRouteInvariants.test.ts
// Trust invariant tests for the AI program generation route
//
// Ensures the generate route:
// - Does NOT import Airtable table writers or program persistence helpers
// - Only returns proposal data (no side effects)

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const GENERATE_ROUTE_PATH = path.resolve(
  __dirname,
  '../../app/api/os/companies/[companyId]/programs/generate/route.ts'
);

describe('generateRouteInvariants', () => {
  const routeContent = fs.readFileSync(GENERATE_ROUTE_PATH, 'utf-8');

  describe('no persistence imports', () => {
    it('does not import createProgram', () => {
      expect(routeContent).not.toMatch(/import\s*{[^}]*createProgram[^}]*}\s*from/);
      expect(routeContent).not.toContain('createProgram(');
    });

    it('does not import updateProgram', () => {
      expect(routeContent).not.toMatch(/import\s*{[^}]*updateProgram[^}]*}\s*from/);
      expect(routeContent).not.toContain('updateProgram(');
    });

    it('does not import updateProgramPlan', () => {
      expect(routeContent).not.toMatch(/import\s*{[^}]*updateProgramPlan[^}]*}\s*from/);
      expect(routeContent).not.toContain('updateProgramPlan(');
    });

    it('does not import updateProgramStatus', () => {
      expect(routeContent).not.toMatch(/import\s*{[^}]*updateProgramStatus[^}]*}\s*from/);
      expect(routeContent).not.toContain('updateProgramStatus(');
    });

    it('does not import activateProgram', () => {
      expect(routeContent).not.toMatch(/import\s*{[^}]*activateProgram[^}]*}\s*from/);
      expect(routeContent).not.toContain('activateProgram(');
    });

    it('does not import any Airtable table writer modules', () => {
      // Should not import from domain-writers (except read functions)
      expect(routeContent).not.toMatch(/import\s*{[^}]*write[A-Z][^}]*}\s*from.*domain-writers/i);
    });

    it('only imports getProgramById (read-only) from programs', () => {
      // The only allowed import from programs.ts should be getProgramById
      const programImportMatch = routeContent.match(
        /import\s*{([^}]*)}\s*from\s*['"]@\/lib\/airtable\/programs['"]/
      );

      if (programImportMatch) {
        const imports = programImportMatch[1].split(',').map(s => s.trim());
        // All imports should be read-only functions
        const readOnlyFunctions = ['getProgramById', 'getProgramsForCompany', 'getActiveProgramForCompany'];
        for (const imp of imports) {
          expect(readOnlyFunctions).toContain(imp);
        }
      }
    });
  });

  describe('proposal-only response', () => {
    it('returns NextResponse.json with result data', () => {
      // Should have a return statement with NextResponse.json(result)
      expect(routeContent).toMatch(/return\s+NextResponse\.json\s*\(\s*result\s*\)/);
    });

    it('does not call any Airtable base operations', () => {
      // Should not have direct Airtable base calls
      // Note: .create( is allowed for Anthropic SDK (client.messages.create)
      expect(routeContent).not.toMatch(/base\s*\(\s*['"][^'"]+['"]\s*\)/); // base('TableName')
      expect(routeContent).not.toMatch(/\.update\s*\(\s*\[/); // .update([...])
      expect(routeContent).not.toMatch(/airtable.*\.create\s*\(/i); // airtable.create(
    });

    it('defines result as GenerateProgramResponse type', () => {
      // Result should be typed as GenerateProgramResponse (proposal only)
      expect(routeContent).toMatch(/const\s+result\s*:\s*GenerateProgramResponse/);
    });
  });

  describe('read-only data fetching', () => {
    it('uses loadContextGraph (read-only)', () => {
      expect(routeContent).toContain('loadContextGraph(');
    });

    it('uses readStrategyFromContextGraph (read-only)', () => {
      expect(routeContent).toContain('readStrategyFromContextGraph(');
    });

    it('only fetches data in parallel with Promise.all', () => {
      // All data fetching should be in a Promise.all block
      expect(routeContent).toMatch(/Promise\.all\s*\(\s*\[/);
    });
  });
});
