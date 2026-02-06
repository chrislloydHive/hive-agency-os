// lib/review/downloadSessionStore.ts
// Short-lived download session storage for signed download URLs.
// Production: Upstash Redis (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).
// Dev fallback: in-memory Map (single instance only; production must use shared storage).

export interface DownloadSessionValue {
  token: string;
  assetId: string;
  exp: number;
}

const KEY_PREFIX = 'review:dl:';

function isUpstashConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return !!(url && token);
}

async function upstashCommand(
  command: string,
  args: (string | number)[]
): Promise<{ result: string | null; error?: string }> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const auth = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !auth) {
    return { result: null, error: 'Upstash not configured' };
  }
  const body = JSON.stringify([command, ...args]);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth}`,
    },
    body,
  });
  const data = (await res.json()) as { result?: string; error?: string };
  if (!res.ok) {
    return { result: null, error: data.error ?? res.statusText };
  }
  if (data.error) {
    return { result: null, error: data.error };
  }
  return { result: data.result ?? null };
}

/** Set a download session with TTL (seconds). */
export async function setDownloadSession(
  dlId: string,
  value: DownloadSessionValue,
  ttlSec: number
): Promise<boolean> {
  if (isUpstashConfigured()) {
    const key = KEY_PREFIX + dlId;
    const payload = JSON.stringify(value);
    const { error } = await upstashCommand('SET', [key, payload, 'EX', ttlSec]);
    return !error;
  }
  return memoryStore.set(dlId, value, ttlSec);
}

/** Get and delete a download session (one-time use). Returns null if missing or expired. */
export async function getAndDeleteDownloadSession(
  dlId: string
): Promise<DownloadSessionValue | null> {
  if (isUpstashConfigured()) {
    const key = KEY_PREFIX + dlId;
    const { result, error } = await upstashCommand('GETDEL', [key]);
    if (error || result == null) return null;
    try {
      return JSON.parse(result) as DownloadSessionValue;
    } catch {
      return null;
    }
  }
  return memoryStore.getAndDelete(dlId);
}

// --- In-memory fallback (dev only; not shared across serverless instances) ---

interface MemoryEntry {
  value: DownloadSessionValue;
  expiresAt: number;
}

const memoryMap = new Map<string, MemoryEntry>();

const memoryStore = {
  set(dlId: string, value: DownloadSessionValue, ttlSec: number): boolean {
    memoryMap.set(dlId, {
      value,
      expiresAt: Date.now() + ttlSec * 1000,
    });
    return true;
  },
  getAndDelete(dlId: string): DownloadSessionValue | null {
    const entry = memoryMap.get(dlId);
    memoryMap.delete(dlId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) return null;
    return entry.value;
  },
};

export function isDownloadSessionStoreConfigured(): boolean {
  return isUpstashConfigured();
}
