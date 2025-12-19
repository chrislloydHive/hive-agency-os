// lib/utils/emailDomains.ts
// Utilities for detecting personal vs business email domains

/**
 * Common personal email domains
 *
 * These domains are used by consumers, not businesses.
 * When an inbound email comes from one of these domains,
 * we create a company using the sender's name instead of the domain.
 */
export const PERSONAL_EMAIL_DOMAINS = [
  // Google
  'gmail.com',
  'googlemail.com',
  // Yahoo
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.ca',
  'yahoo.com.au',
  'ymail.com',
  'rocketmail.com',
  // Microsoft
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'live.com',
  'msn.com',
  // Apple
  'icloud.com',
  'me.com',
  'mac.com',
  // AOL
  'aol.com',
  'aim.com',
  // ProtonMail
  'protonmail.com',
  'proton.me',
  'pm.me',
  // Other popular providers
  'zoho.com',
  'mail.com',
  'fastmail.com',
  'hey.com',
  'tutanota.com',
  'gmx.com',
  'gmx.net',
  'yandex.com',
  'inbox.com',
  'mailinator.com',
] as const;

/**
 * Check if a domain is a personal email domain
 *
 * @param domain - Domain to check (e.g., "gmail.com")
 * @returns true if the domain is a personal email provider
 */
export function isPersonalEmailDomain(domain: string): boolean {
  if (!domain) return false;

  const normalized = domain.toLowerCase().trim();
  return PERSONAL_EMAIL_DOMAINS.includes(normalized as typeof PERSONAL_EMAIL_DOMAINS[number]);
}

/**
 * Extract domain from an email address
 *
 * @param email - Email address (e.g., "john@example.com")
 * @returns Domain part of the email (e.g., "example.com") or null if invalid
 */
export function extractDomainFromEmail(email: string): string | null {
  if (!email || typeof email !== 'string') return null;

  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return null;

  const domain = parts[1];
  if (!domain || !domain.includes('.')) return null;

  return domain;
}

/**
 * Check if an email is from a personal domain
 *
 * @param email - Email address to check
 * @returns true if the email is from a personal provider
 */
export function isPersonalEmail(email: string): boolean {
  const domain = extractDomainFromEmail(email);
  if (!domain) return false;
  return isPersonalEmailDomain(domain);
}
