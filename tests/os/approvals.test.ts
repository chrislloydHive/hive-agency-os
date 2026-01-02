// tests/os/approvals.test.ts
// Tests for the Approvals Inbox System

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createApprovalRequest,
  getApprovalRequest,
  getPendingApprovals,
  getApprovals,
  getApprovalSummary,
  processApprovalDecision,
  expireOldRequests,
  clearApprovals,
  generateApprovalId,
  requestApproval,
  wasApproved,
} from '@/lib/os/programs/approvals';

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  clearApprovals();
});

// ============================================================================
// ID Generation Tests
// ============================================================================

describe('generateApprovalId', () => {
  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateApprovalId());
    }
    expect(ids.size).toBe(100);
  });

  it('generates IDs with apr_ prefix', () => {
    const id = generateApprovalId();
    expect(id).toMatch(/^apr_/);
  });
});

// ============================================================================
// Create Approval Request Tests
// ============================================================================

describe('createApprovalRequest', () => {
  it('creates a request with required fields', () => {
    const request = createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'Create a new SEO work item',
      payload: { title: 'SEO Task', workstream: 'seo' },
    });

    expect(request.id).toMatch(/^apr_/);
    expect(request.companyId).toBe('company-1');
    expect(request.capabilityId).toBe('create_work_item');
    expect(request.status).toBe('pending');
    expect(request.createdAt).toBeTruthy();
  });

  it('includes optional fields', () => {
    const request = createApprovalRequest({
      companyId: 'company-1',
      programId: 'prog-1',
      workItemId: 'work-1',
      capabilityId: 'modify_scope',
      description: 'Add new deliverable',
      payload: { deliverable: { title: 'New deliverable' } },
      context: {
        programTitle: 'Strategy Program',
        aiReasoning: 'Based on user request to expand scope',
      },
      debugId: 'EVT-123',
    });

    expect(request.programId).toBe('prog-1');
    expect(request.workItemId).toBe('work-1');
    expect(request.context?.programTitle).toBe('Strategy Program');
    expect(request.debugId).toBe('EVT-123');
  });

  it('sets expiration when specified', () => {
    const request = createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'Test',
      payload: {},
      expiresInHours: 24,
    });

    expect(request.expiresAt).toBeTruthy();
    const expiresAt = new Date(request.expiresAt!);
    const createdAt = new Date(request.createdAt);
    const diffHours = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(24, 0);
  });

  it('looks up capability name', () => {
    const request = createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'Test',
      payload: {},
    });

    expect(request.capabilityName).toBe('Create Work Item');
  });
});

// ============================================================================
// Get Approval Request Tests
// ============================================================================

describe('getApprovalRequest', () => {
  it('retrieves a created request', () => {
    const created = createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'Test',
      payload: {},
    });

    const retrieved = getApprovalRequest(created.id);
    expect(retrieved).toEqual(created);
  });

  it('returns undefined for non-existent ID', () => {
    const retrieved = getApprovalRequest('apr_nonexistent');
    expect(retrieved).toBeUndefined();
  });
});

// ============================================================================
// Get Pending Approvals Tests
// ============================================================================

describe('getPendingApprovals', () => {
  it('returns only pending requests', () => {
    // Create multiple requests
    const req1 = createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'Request 1',
      payload: {},
    });
    const req2 = createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'modify_scope',
      description: 'Request 2',
      payload: {},
    });

    // Approve one
    processApprovalDecision(req1.id, { approved: true });

    const pending = getPendingApprovals('company-1');
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(req2.id);
  });

  it('returns empty array for company with no requests', () => {
    const pending = getPendingApprovals('company-nonexistent');
    expect(pending).toEqual([]);
  });

  it('filters by company', () => {
    createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'Company 1',
      payload: {},
    });
    createApprovalRequest({
      companyId: 'company-2',
      capabilityId: 'create_work_item',
      description: 'Company 2',
      payload: {},
    });

    const pending1 = getPendingApprovals('company-1');
    const pending2 = getPendingApprovals('company-2');

    expect(pending1).toHaveLength(1);
    expect(pending2).toHaveLength(1);
    expect(pending1[0].description).toBe('Company 1');
    expect(pending2[0].description).toBe('Company 2');
  });
});

// ============================================================================
// Get Approvals Tests
// ============================================================================

describe('getApprovals', () => {
  it('returns all approvals for a company', () => {
    createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'Request 1',
      payload: {},
    });
    createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'modify_scope',
      description: 'Request 2',
      payload: {},
    });

    const all = getApprovals('company-1');
    expect(all).toHaveLength(2);
  });

  it('filters by status', () => {
    const req1 = createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'Approved',
      payload: {},
    });
    createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'modify_scope',
      description: 'Pending',
      payload: {},
    });

    processApprovalDecision(req1.id, { approved: true });

    const approved = getApprovals('company-1', { status: 'approved' });
    expect(approved).toHaveLength(1);
    expect(approved[0].description).toBe('Approved');
  });

  it('respects limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      createApprovalRequest({
        companyId: 'company-1',
        capabilityId: 'create_work_item',
        description: `Request ${i}`,
        payload: {},
      });
    }

    const limited = getApprovals('company-1', { limit: 3 });
    expect(limited).toHaveLength(3);
  });
});

// ============================================================================
// Get Approval Summary Tests
// ============================================================================

describe('getApprovalSummary', () => {
  it('counts approvals by status', () => {
    const req1 = createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'To be approved',
      payload: {},
    });
    const req2 = createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'modify_scope',
      description: 'To be rejected',
      payload: {},
    });
    createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'update_status',
      description: 'Stays pending',
      payload: {},
    });

    processApprovalDecision(req1.id, { approved: true });
    processApprovalDecision(req2.id, { approved: false });

    const summary = getApprovalSummary('company-1');
    expect(summary.pending).toBe(1);
    expect(summary.approved).toBe(1);
    expect(summary.rejected).toBe(1);
    expect(summary.total).toBe(3);
  });

  it('returns zeros for empty company', () => {
    const summary = getApprovalSummary('company-empty');
    expect(summary.pending).toBe(0);
    expect(summary.approved).toBe(0);
    expect(summary.rejected).toBe(0);
    expect(summary.total).toBe(0);
  });
});

// ============================================================================
// Process Approval Decision Tests
// ============================================================================

describe('processApprovalDecision', () => {
  it('approves a pending request', () => {
    const request = createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'Test',
      payload: {},
    });

    const result = processApprovalDecision(request.id, {
      approved: true,
      reviewedBy: 'user-1',
    });

    expect(result?.status).toBe('approved');
    expect(result?.reviewedAt).toBeTruthy();
    expect(result?.reviewedBy).toBe('user-1');
  });

  it('rejects a pending request with reason', () => {
    const request = createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'Test',
      payload: {},
    });

    const result = processApprovalDecision(request.id, {
      approved: false,
      reviewedBy: 'user-1',
      rejectionReason: 'Out of scope',
    });

    expect(result?.status).toBe('rejected');
    expect(result?.rejectionReason).toBe('Out of scope');
  });

  it('returns null for non-existent request', () => {
    const result = processApprovalDecision('apr_nonexistent', { approved: true });
    expect(result).toBeNull();
  });

  it('does not change already processed request', () => {
    const request = createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'Test',
      payload: {},
    });

    processApprovalDecision(request.id, { approved: true });
    const secondResult = processApprovalDecision(request.id, { approved: false });

    expect(secondResult?.status).toBe('approved'); // Still approved, not changed to rejected
  });
});

// ============================================================================
// Expire Old Requests Tests
// ============================================================================

describe('expireOldRequests', () => {
  it('expires requests past their expiration time', () => {
    // Create a request with past expiration
    const request = createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'Test',
      payload: {},
      expiresInHours: 0, // Expires immediately
    });

    // Manually set expiration to past
    const stored = getApprovalRequest(request.id);
    if (stored) {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      (stored as any).expiresAt = pastDate;
    }

    const expiredCount = expireOldRequests();

    const updated = getApprovalRequest(request.id);
    expect(updated?.status).toBe('expired');
    expect(expiredCount).toBeGreaterThan(0);
  });

  it('does not expire requests without expiration', () => {
    createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'Test',
      payload: {},
      // No expiresInHours
    });

    const expiredCount = expireOldRequests();
    expect(expiredCount).toBe(0);
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('requestApproval', () => {
  it('creates approval request with default 72h expiry', async () => {
    const request = await requestApproval('company-1', 'create_work_item', {
      description: 'Create SEO task',
      payload: { title: 'SEO Task' },
    });

    expect(request.status).toBe('pending');
    expect(request.expiresAt).toBeTruthy();
  });
});

describe('wasApproved', () => {
  it('returns true for approved request', () => {
    const request = createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'Test',
      payload: {},
    });
    processApprovalDecision(request.id, { approved: true });

    expect(wasApproved(request.id)).toBe(true);
  });

  it('returns false for pending request', () => {
    const request = createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'Test',
      payload: {},
    });

    expect(wasApproved(request.id)).toBe(false);
  });

  it('returns false for rejected request', () => {
    const request = createApprovalRequest({
      companyId: 'company-1',
      capabilityId: 'create_work_item',
      description: 'Test',
      payload: {},
    });
    processApprovalDecision(request.id, { approved: false });

    expect(wasApproved(request.id)).toBe(false);
  });
});
