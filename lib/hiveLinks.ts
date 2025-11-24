// Helper functions and constants for Hive referral links with UTM tracking

const HIVE_BASE_URL = 'https://hiveadagency.com';

const DMA_UTM_PARAMS = {
  utm_source: 'dma',
  utm_medium: 'referral',
  utm_campaign: 'dma_hive_cta',
};

/**
 * Static Hive contact URL with DMA UTM parameters
 * Use this constant for server components and static pages
 */
export const HIVE_CONTACT_URL = `${HIVE_BASE_URL}/contact?utm_source=dma&utm_medium=referral&utm_campaign=dma_hive_cta`;

/**
 * Get Hive contact URL with DMA UTM parameters
 * Use this function for client components
 */
export const getHiveContactUrl = (): string => {
  const params = new URLSearchParams(DMA_UTM_PARAMS);
  return `${HIVE_BASE_URL}/contact?${params.toString()}`;
};

/**
 * Get any Hive URL with DMA UTM parameters
 */
export const getHiveUrl = (path: string = ''): string => {
  const params = new URLSearchParams(DMA_UTM_PARAMS);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${HIVE_BASE_URL}${cleanPath}?${params.toString()}`;
};
