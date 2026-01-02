// lib/os/programs/approvals.ts
// Approvals Inbox System for AI Actions
//
// When AI proposes actions that require human approval (see aiCapabilities.ts),
// those proposals are stored as ApprovalRequests. Users can review, approve,
// or reject these requests through the Approvals Inbox.
//
// Lifecycle:
// 1. AI proposes action -> ApprovalRequest created (pending)
// 2. User reviews in Approvals Inbox
// 3. User approves -> action executed, status = approved
// 4. User rejects -> action not executed, status = rejected
// 5. Optional: request expires after timeout

import { z } from 'zod';
import type { CapabilityDefinition } from './aiCapabilities';
import { getCapability } from './aiCapabilities';

// ============================================================================
// Types
// ============================================================================

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired']);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalRequestSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  programId: z.string().optional(),
  workItemId: z.string().optional(),
  artifactId: z.string().optional(),

  // What action is being proposed
  capabilityId: z.string(),
  capabilityName: z.string(),
  description: z.string(),

  // Payload for the action (varies by capability)
  payload: z.record(z.unknown()),

  // Context for the reviewer
  context: z.object({
    programTitle: z.string().optional(),
    workItemTitle: z.string().optional(),
    aiReasoning: z.string().optional(),
  }).optional(),

  // Status and timestamps
  status: ApprovalStatusSchema,
  createdAt: z.string(),
  expiresAt: z.string().optional(),
  reviewedAt: z.string().optional(),
  reviewedBy: z.string().optional(),
  rejectionReason: z.string().optional(),

  // Debugging
  debugId: z.string().optional(),
});

export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export interface CreateApprovalRequestInput {
  companyId: string;
  programId?: string;
  workItemId?: string;
  artifactId?: string;
  capabilityId: string;
  description: string;
  payload: Record<string, unknown>;
  context?: {
    programTitle?: string;
    workItemTitle?: string;
    aiReasoning?: string;
  };
  expiresInHours?: number;
  debugId?: string;
}

export interface ApprovalDecision {
  approved: boolean;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface ApprovalSummary {
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  total: number;
}

// ============================================================================
// ID Generation
// ============================================================================

export function generateApprovalId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `apr_${timestamp}_${random}`;
}

// ============================================================================
// In-Memory Store (for demo/testing)
// In production, this would be persisted to Airtable or a database
// ============================================================================

const approvalStore = new Map<string, ApprovalRequest>();
const approvalsByCompany = new Map<string, Set<string>>();

/**
 * Create a new approval request
 */
export function createApprovalRequest(
  input: CreateApprovalRequestInput
): ApprovalRequest {
  const capability = getCapability(input.capabilityId);
  const capabilityName = capability?.name || input.capabilityId;

  const now = new Date();
  const expiresAt = input.expiresInHours
    ? new Date(now.getTime() + input.expiresInHours * 60 * 60 * 1000).toISOString()
    : undefined;

  const request: ApprovalRequest = {
    id: generateApprovalId(),
    companyId: input.companyId,
    programId: input.programId,
    workItemId: input.workItemId,
    artifactId: input.artifactId,
    capabilityId: input.capabilityId,
    capabilityName,
    description: input.description,
    payload: input.payload,
    context: input.context,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt,
    debugId: input.debugId,
  };

  // Store it
  approvalStore.set(request.id, request);

  // Index by company
  if (!approvalsByCompany.has(input.companyId)) {
    approvalsByCompany.set(input.companyId, new Set());
  }
  approvalsByCompany.get(input.companyId)!.add(request.id);

  return request;
}

/**
 * Get an approval request by ID
 */
export function getApprovalRequest(id: string): ApprovalRequest | undefined {
  return approvalStore.get(id);
}

/**
 * Get all pending approvals for a company
 */
export function getPendingApprovals(companyId: string): ApprovalRequest[] {
  const ids = approvalsByCompany.get(companyId);
  if (!ids) return [];

  return Array.from(ids)
    .map((id) => approvalStore.get(id))
    .filter((r): r is ApprovalRequest => r !== undefined && r.status === 'pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Get all approvals for a company
 */
export function getApprovals(
  companyId: string,
  options: { status?: ApprovalStatus; limit?: number } = {}
): ApprovalRequest[] {
  const { status, limit = 50 } = options;
  const ids = approvalsByCompany.get(companyId);
  if (!ids) return [];

  let requests = Array.from(ids)
    .map((id) => approvalStore.get(id))
    .filter((r): r is ApprovalRequest => r !== undefined)
    .filter((r) => !status || r.status === status)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (limit > 0) {
    requests = requests.slice(0, limit);
  }

  return requests;
}

/**
 * Get approval summary for a company
 */
export function getApprovalSummary(companyId: string): ApprovalSummary {
  const ids = approvalsByCompany.get(companyId);
  if (!ids) {
    return { pending: 0, approved: 0, rejected: 0, expired: 0, total: 0 };
  }

  let pending = 0;
  let approved = 0;
  let rejected = 0;
  let expired = 0;

  for (const id of ids) {
    const request = approvalStore.get(id);
    if (!request) continue;

    switch (request.status) {
      case 'pending':
        pending++;
        break;
      case 'approved':
        approved++;
        break;
      case 'rejected':
        rejected++;
        break;
      case 'expired':
        expired++;
        break;
    }
  }

  return { pending, approved, rejected, expired, total: ids.size };
}

/**
 * Process a decision on an approval request
 */
export function processApprovalDecision(
  id: string,
  decision: ApprovalDecision
): ApprovalRequest | null {
  const request = approvalStore.get(id);
  if (!request) return null;
  if (request.status !== 'pending') return request;

  const updatedRequest: ApprovalRequest = {
    ...request,
    status: decision.approved ? 'approved' : 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewedBy: decision.reviewedBy,
    rejectionReason: decision.approved ? undefined : decision.rejectionReason,
  };

  approvalStore.set(id, updatedRequest);
  return updatedRequest;
}

/**
 * Expire old pending requests
 */
export function expireOldRequests(): number {
  const now = new Date();
  let expiredCount = 0;

  for (const [id, request] of approvalStore) {
    if (request.status !== 'pending') continue;
    if (!request.expiresAt) continue;

    if (new Date(request.expiresAt) < now) {
      approvalStore.set(id, { ...request, status: 'expired' });
      expiredCount++;
    }
  }

  return expiredCount;
}

/**
 * Clear all approvals (for testing)
 */
export function clearApprovals(): void {
  approvalStore.clear();
  approvalsByCompany.clear();
}

// ============================================================================
// Helpers for AI Integration
// ============================================================================

/**
 * Request approval for an AI action
 * This is the main entry point for AI-initiated approval requests
 */
export async function requestApproval(
  companyId: string,
  capabilityId: string,
  options: {
    programId?: string;
    workItemId?: string;
    artifactId?: string;
    description: string;
    payload: Record<string, unknown>;
    context?: {
      programTitle?: string;
      workItemTitle?: string;
      aiReasoning?: string;
    };
    debugId?: string;
  }
): Promise<ApprovalRequest> {
  return createApprovalRequest({
    companyId,
    capabilityId,
    programId: options.programId,
    workItemId: options.workItemId,
    artifactId: options.artifactId,
    description: options.description,
    payload: options.payload,
    context: options.context,
    expiresInHours: 72, // Default 72 hour expiry
    debugId: options.debugId,
  });
}

/**
 * Check if a request was approved
 */
export function wasApproved(requestId: string): boolean {
  const request = approvalStore.get(requestId);
  return request?.status === 'approved';
}

/**
 * Wait for approval (polling-based)
 * In production, this could use webhooks or SSE
 */
export async function waitForApproval(
  requestId: string,
  options: { pollIntervalMs?: number; timeoutMs?: number } = {}
): Promise<ApprovalRequest | null> {
  const { pollIntervalMs = 1000, timeoutMs = 30000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const request = approvalStore.get(requestId);
    if (!request) return null;
    if (request.status !== 'pending') return request;

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return approvalStore.get(requestId) || null;
}
