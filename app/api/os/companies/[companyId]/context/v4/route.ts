// app/api/os/companies/[companyId]/context/v4/route.ts
// Context V4 API: Fact Sheet endpoint
//
// Returns the fact sheet view model grouped by domain.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  loadContextFieldsV4,
} from '@/lib/contextGraph/fieldStoreV4';
import {
  isContextV4Enabled,
  DOMAIN_LABELS_V4,
  type FactSheetResponseV4,
  type FactSheetDomainV4,
  type MissingFieldInfoV4,
  type MissingFieldReason,
  type MissingFieldAvailableSource,
  type ContextFieldV4,
} from '@/lib/types/contextField';
import { CONTEXT_FIELDS, type ContextFieldDef } from '@/lib/contextGraph/schema';
import {
  V4_REQUIRED_STRATEGY_FIELDS,
  getRequiredFieldStats,
  getMissingRequiredV4,
  type V4RequiredField,
} from '@/lib/contextGraph/v4/requiredStrategyFields';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// Source Availability by Domain
// ============================================================================

/**
 * Maps domains to available lab/gap sources that can provide data
 */
const DOMAIN_SOURCES: Record<string, MissingFieldAvailableSource[]> = {
  website: [
    { sourceId: 'websiteLab', label: 'Website Lab', hasSignal: false },
  ],
  digitalInfra: [
    { sourceId: 'websiteLab', label: 'Website Lab', hasSignal: false },
  ],
  brand: [
    { sourceId: 'brandLab', label: 'Brand Lab', hasSignal: false },
    { sourceId: 'gapPlan', label: 'GAP Analysis', hasSignal: false },
  ],
  identity: [
    { sourceId: 'gapPlan', label: 'GAP Analysis', hasSignal: false },
  ],
  audience: [
    { sourceId: 'gapPlan', label: 'GAP Analysis', hasSignal: false },
  ],
  competitive: [
    { sourceId: 'gapPlan', label: 'GAP Analysis', hasSignal: false },
  ],
  productOffer: [
    { sourceId: 'gapPlan', label: 'GAP Analysis', hasSignal: false },
  ],
};

/**
 * Human-readable explanations for missing field reasons
 */
const REASON_EXPLANATIONS: Record<MissingFieldReason, string> = {
  NO_PROPOSAL_ATTEMPTED: 'No proposals have been generated for this field yet.',
  PROPOSAL_REJECTED: 'A proposal was rejected.',
  PROPOSAL_LOW_CONFIDENCE: 'A low-confidence proposal exists and requires review.',
  NO_LAB_SIGNAL_FOUND: 'Labs ran but found no signal for this field.',
  REQUIRES_USER_INPUT: 'This field requires manual entry.',
};

/**
 * Determine why a field is missing and what can be done about it
 */
function getMissingFieldInfo(
  fieldKey: string,
  fieldDef: ContextFieldDef,
  store: { fields: Record<string, ContextFieldV4> } | null,
  proposedKeys: Set<string>
): MissingFieldInfoV4 {
  const domain = fieldDef.domain;
  const rejectedField = store?.fields[fieldKey];
  const isRejected = rejectedField?.status === 'rejected';
  const isProposedLowConfidence = proposedKeys.has(fieldKey);

  // Determine reason
  let reason: MissingFieldReason;
  let explanation: string;

  if (isRejected) {
    reason = 'PROPOSAL_REJECTED';
    explanation = rejectedField?.rejectedReason
      ? `Rejected: ${rejectedField.rejectedReason}`
      : REASON_EXPLANATIONS.PROPOSAL_REJECTED;
  } else if (isProposedLowConfidence) {
    reason = 'PROPOSAL_LOW_CONFIDENCE';
    explanation = REASON_EXPLANATIONS.PROPOSAL_LOW_CONFIDENCE;
  } else {
    // Default: no proposal attempted
    reason = 'NO_PROPOSAL_ATTEMPTED';
    explanation = REASON_EXPLANATIONS.NO_PROPOSAL_ATTEMPTED;
  }

  // Get available sources for this domain
  const availableSources = DOMAIN_SOURCES[domain] || [];

  // Determine if targeted propose is available
  // Only for domains that have lab sources configured
  const canPropose = availableSources.length > 0 && !isRejected;

  return {
    key: fieldKey,
    label: fieldDef.label,
    reason,
    explanation,
    availableSources: availableSources.map((s) => ({ ...s })),
    canPropose,
    rejection: isRejected
      ? {
          rejectedAt: rejectedField?.rejectedAt || '',
          reason: rejectedField?.rejectedReason,
        }
      : undefined,
  };
}

/**
 * GET /api/os/companies/[companyId]/context/v4
 * Returns the fact sheet view model
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Check feature flag
  if (!isContextV4Enabled()) {
    return NextResponse.json(
      { ok: false, error: 'Context V4 is not enabled' },
      { status: 404 }
    );
  }

  try {
    const { companyId } = await params;

    // Load company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Load V4 store
    const store = await loadContextFieldsV4(companyId);

    // Get confirmed and proposed fields
    const confirmedFields = store
      ? Object.values(store.fields).filter((f) => f.status === 'confirmed')
      : [];
    const proposedFields = store
      ? Object.values(store.fields).filter((f) => f.status === 'proposed')
      : [];

    // Group by domain
    const domainMap = new Map<string, FactSheetDomainV4>();

    // Initialize all domains from schema
    const allDomains = new Set<string>();
    for (const fieldDef of CONTEXT_FIELDS) {
      allDomains.add(fieldDef.domain);
    }

    // Build a map of field definitions by path for quick lookup
    const fieldDefByPath = new Map<string, ContextFieldDef>();
    for (const fieldDef of CONTEXT_FIELDS) {
      fieldDefByPath.set(fieldDef.path, fieldDef);
    }

    // Track all confirmed and proposed keys for strategy readiness
    const allConfirmedKeys = new Set(confirmedFields.map((f) => f.key));
    const allProposedKeys = new Set(proposedFields.map((f) => f.key));

    for (const domain of allDomains) {
      const domainConfirmed = confirmedFields.filter((f) => f.domain === domain);
      const domainProposed = proposedFields.filter((f) => f.domain === domain);

      // Get schema fields for this domain
      const schemaFieldDefs = CONTEXT_FIELDS.filter((f) => f.domain === domain);
      const schemaFieldPaths = schemaFieldDefs.map((f) => f.path);
      const confirmedKeys = new Set(domainConfirmed.map((f) => f.key));
      const proposedKeys = new Set(domainProposed.map((f) => f.key));
      const missingKeys = schemaFieldPaths.filter(
        (path) => !confirmedKeys.has(path) && !proposedKeys.has(path)
      );

      // Build detailed missing field info
      const missingFields: MissingFieldInfoV4[] = missingKeys.map((key) => {
        const fieldDef = fieldDefByPath.get(key);
        if (!fieldDef) {
          return {
            key,
            label: key.split('.').pop() || key,
            reason: 'NO_PROPOSAL_ATTEMPTED' as MissingFieldReason,
            explanation: REASON_EXPLANATIONS.NO_PROPOSAL_ATTEMPTED,
            availableSources: [],
            canPropose: false,
          };
        }
        return getMissingFieldInfo(key, fieldDef, store, allProposedKeys);
      });

      // Calculate completeness (confirmed / total schema fields)
      const totalFields = schemaFieldPaths.length;
      const completeness = totalFields > 0
        ? Math.round((domainConfirmed.length / totalFields) * 100)
        : 0;

      domainMap.set(domain, {
        domain,
        label: DOMAIN_LABELS_V4[domain] || domain,
        confirmed: domainConfirmed,
        proposedCount: domainProposed.length,
        missingKeys,
        missingFields, // Extended field info
        completeness,
      });
    }

    // Sort domains by label
    const domains = Array.from(domainMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );

    // Calculate strategy readiness stats
    const strategyReadiness = getRequiredFieldStats(allConfirmedKeys, allProposedKeys);
    const missingRequiredFields = getMissingRequiredV4(allConfirmedKeys, allProposedKeys);

    // Build response with extended data
    const response = {
      companyId,
      companyName: company.name,
      domains,
      totalConfirmed: confirmedFields.length,
      totalProposed: proposedFields.length,
      totalMissing: domains.reduce((sum, d) => sum + d.missingKeys.length, 0),
      lastUpdated: store?.meta.lastUpdated || new Date().toISOString(),
      // Strategy readiness extension
      strategyReadiness: {
        ready: strategyReadiness.ready,
        total: strategyReadiness.total,
        confirmed: strategyReadiness.confirmed,
        proposed: strategyReadiness.proposed,
        missing: strategyReadiness.missing,
        missingFields: missingRequiredFields.map((f) => ({
          path: f.path,
          label: f.label,
          reason: f.reason,
        })),
      },
    };

    return NextResponse.json({ ok: true, ...response });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[ContextV4 API] Error getting fact sheet:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
