// Shared Google OAuth access for OS routes (draft-reply pattern: default company → any token).

import { getCompanyIntegrations, getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken } from '@/lib/google/oauth';

export async function getOsGoogleAccessToken(): Promise<
  { ok: true; accessToken: string } | { ok: false; error: string; status: number }
> {
  let refreshToken: string | undefined;
  const defaultCompanyId = process.env.DMA_DEFAULT_COMPANY_ID;
  if (defaultCompanyId) {
    const integrations = await getCompanyIntegrations(defaultCompanyId);
    refreshToken = integrations?.google?.refreshToken;
  }
  if (!refreshToken) refreshToken = (await getAnyGoogleRefreshToken()) || undefined;
  if (!refreshToken) {
    return { ok: false, error: 'No Google refresh token available', status: 500 };
  }
  try {
    const accessToken = await refreshAccessToken(refreshToken);
    return { ok: true, accessToken };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Token refresh failed';
    return { ok: false, error: msg, status: 401 };
  }
}
