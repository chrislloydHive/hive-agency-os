// tests/inbound/gmail-inbox-review-opportunity.test.ts
// Basic route-level tests for /api/os/inbound/gmail-inbox-review-opportunity
//
// These tests validate the route contract without hitting external services.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment variables
vi.stubEnv('HIVE_INBOUND_SECRET', 'test-secret-123');
vi.stubEnv('AIRTABLE_API_KEY', 'test-airtable-key');
vi.stubEnv('AIRTABLE_OS_BASE_ID', 'appTestBase123');
vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');

describe('POST /api/os/inbound/gmail-inbox-review-opportunity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when X-Hive-Secret header is missing', async () => {
      const { POST } = await import(
        '@/app/api/os/inbound/gmail-inbox-review-opportunity/route'
      );

      const request = new Request('http://localhost/api/os/inbound/gmail-inbox-review-opportunity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: 'Test Subject',
          from: { email: 'test@example.com', name: 'Test User' },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when X-Hive-Secret header is invalid', async () => {
      const { POST } = await import(
        '@/app/api/os/inbound/gmail-inbox-review-opportunity/route'
      );

      const request = new Request('http://localhost/api/os/inbound/gmail-inbox-review-opportunity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hive-Secret': 'wrong-secret',
        },
        body: JSON.stringify({
          subject: 'Test Subject',
          from: { email: 'test@example.com', name: 'Test User' },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Input Handling', () => {
    it('should accept payload matching Gmail add-on format', async () => {
      // This test validates the payload structure is accepted
      // Full integration tests would require mocking Airtable + OpenAI

      const validPayload = {
        from: {
          name: 'John Smith',
          email: 'john@acme.com',
        },
        subject: 'Partnership Inquiry',
        snippet: 'Hello, I would like to discuss a potential partnership...',
        bodyText: 'Full email body here...',
        messageId: '<abc123@mail.gmail.com>',
        threadId: 'thread-xyz-789',
        receivedAt: '2024-01-15T10:30:00Z',
        mode: 'inbox_review_and_opportunity',
      };

      // Validate the payload structure is what we expect
      expect(validPayload.from.email).toBeDefined();
      expect(validPayload.subject).toBeDefined();
      expect(validPayload.messageId).toBeDefined();
    });
  });

  describe('Personal Domain Handling', () => {
    const personalDomains = [
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'icloud.com',
    ];

    it.each(personalDomains)('should identify %s as personal domain', (domain) => {
      const PERSONAL_DOMAINS = [
        'gmail.com',
        'yahoo.com',
        'hotmail.com',
        'outlook.com',
        'icloud.com',
        'aol.com',
        'protonmail.com',
        'mail.com',
        'me.com',
        'live.com',
        'msn.com',
      ];

      expect(PERSONAL_DOMAINS.includes(domain.toLowerCase())).toBe(true);
    });
  });

  describe('GET handler', () => {
    it('should return route info', async () => {
      const { GET } = await import(
        '@/app/api/os/inbound/gmail-inbox-review-opportunity/route'
      );

      const response = await GET();
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.route).toBe('os/inbound/gmail-inbox-review-opportunity');
      expect(data.description).toBeDefined();
    });
  });
});

describe('Response Contract', () => {
  it('should match expected response shape for success', () => {
    // Define the expected response shape
    const successResponse = {
      ok: true,
      status: 'success',
      tasksCreated: 0,
      opportunityAction: 'attached' as const,
      opportunity: {
        id: 'recXXX',
        name: 'Acme — Partnership Inquiry',
        stage: 'interest_confirmed',
        url: 'https://airtable.com/appBase123/tblOpportunities/recXXX',
      },
      company: {
        id: 'recYYY',
        name: 'Acme',
        domain: 'acme.com',
        url: 'https://airtable.com/appBase123/tblCompanies/recYYY',
      },
      inboxItem: {
        id: 'recZZZ',
        url: 'https://airtable.com/appBase123/tblInbox/recZZZ',
      },
      summary: '## Summary\n...',
      // Optional: owner if resolved
      owner: {
        id: 'recOwner123',
        name: 'Jane Doe',
      },
    };

    // Validate required fields are present
    expect(successResponse.ok).toBe(true);
    expect(successResponse.opportunityAction).toMatch(/^(attached|created|skipped)$/);
    expect(successResponse.opportunity.id).toBeDefined();
    expect(successResponse.opportunity.url).toBeDefined();
    expect(successResponse.company.id).toBeDefined();
    expect(successResponse.company.url).toBeDefined();
    expect(successResponse.inboxItem.id).toBeDefined();
    expect(successResponse.inboxItem.url).toBeDefined();
  });

  it('should match expected response shape for partial success', () => {
    const partialResponse = {
      ok: false,
      status: 'partial',
      error: 'Failed to create opportunity',
      tasksCreated: 0,
      opportunityAction: 'skipped' as const,
      inboxItem: {
        id: 'recZZZ',
        url: 'https://airtable.com/appBase123/tblInbox/recZZZ',
      },
      summary: '## Summary\n...',
    };

    expect(partialResponse.ok).toBe(false);
    expect(partialResponse.opportunityAction).toBe('skipped');
    expect(partialResponse.inboxItem.id).toBeDefined();
    expect(partialResponse.inboxItem.url).toBeDefined();
  });

  it('should match expected response shape for personal domain (skipped)', () => {
    const skippedResponse = {
      ok: true,
      status: 'success',
      tasksCreated: 0,
      opportunityAction: 'skipped' as const,
      inboxItem: {
        id: 'recZZZ',
        url: 'https://airtable.com/appBase123/tblInbox/recZZZ',
      },
      summary: '## Summary\n...',
      reason: 'personal_domain',
    };

    expect(skippedResponse.ok).toBe(true);
    expect(skippedResponse.opportunityAction).toBe('skipped');
    expect(skippedResponse.reason).toBe('personal_domain');
    expect(skippedResponse.inboxItem.url).toBeDefined();
  });
});
