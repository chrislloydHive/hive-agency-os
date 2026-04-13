// Shared helpers for deciding when to retry Google Drive calls with a service account
// (OAuth 403/404 on files the SA can still read, token errors, etc.).

/** Collect message + nested gaxios/Google OAuth fields (invalid_grant is often in response.data). */
export function flattenGoogleDriveError(err: unknown): string {
  const chunks: string[] = [];
  const walk = (x: unknown, depth: number): void => {
    if (depth > 5 || x == null) return;
    if (typeof x === 'string') {
      chunks.push(x);
      return;
    }
    if (x instanceof Error) {
      chunks.push(x.message);
      if ('cause' in x && (x as { cause?: unknown }).cause != null) {
        walk((x as { cause?: unknown }).cause, depth + 1);
      }
      return;
    }
    if (typeof x === 'object') {
      const o = x as {
        message?: unknown;
        code?: unknown;
        response?: { status?: number; data?: unknown };
      };
      if (o.message != null) chunks.push(String(o.message));
      if (o.code != null) chunks.push(String(o.code));
      if (o.response?.data != null) {
        const d = o.response.data;
        chunks.push(typeof d === 'string' ? d : JSON.stringify(d));
      }
    } else {
      chunks.push(String(x));
    }
  };
  walk(err, 0);
  return chunks.join(' ');
}

/** True when a Drive request should be retried with the service account. */
export function driveErrorsSuggestServiceAccountFallback(err: unknown): boolean {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? (err as { code?: number }).code
      : (err as { response?: { status?: number } })?.response?.status;
  if (code === 404 || code === 403) return true;
  const blob = flattenGoogleDriveError(err);
  if (
    /invalid_grant|invalid_client|unauthorized_client|Token has been expired or revoked|invalid_rapt/i.test(
      blob,
    )
  ) {
    return true;
  }
  if (code === 400 && /oauth|token|refresh|grant|credential|invalid/i.test(blob)) return true;
  return false;
}
