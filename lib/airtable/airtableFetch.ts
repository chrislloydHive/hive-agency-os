/**
 * All REST calls to api.airtable.com must use this helper so Authorization is always set.
 */

function headersObject(init: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!init) return out;
  if (init instanceof Headers) {
    init.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  if (Array.isArray(init)) {
    for (const [k, v] of init) out[k] = v;
    return out;
  }
  return { ...init };
}

export function airtableFetch(url: string | URL, options: RequestInit = {}): Promise<Response> {
  const u = typeof url === 'string' ? url : url.toString();
  const merged = headersObject(options.headers);
  return fetch(u, {
    ...options,
    headers: {
      ...merged,
      Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
      'Content-Type': merged['Content-Type'] || merged['content-type'] || 'application/json',
    },
  });
}
