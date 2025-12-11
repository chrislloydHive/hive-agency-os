import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // ESLint: Don't fail on warnings during builds
  eslint: {
    ignoreDuringBuilds: true, // Run lint separately via `npm run lint`
  },

  // Redirects for SEO Heavy -> SEO Lab rename
  async redirects() {
    return [
      // Redirect old SEO Heavy routes to SEO Lab
      {
        source: '/c/:companyId/diagnostics/seo-heavy',
        destination: '/c/:companyId/diagnostics/seo-lab',
        permanent: true,
      },
      {
        source: '/c/:companyId/diagnostics/seo-heavy/:runId',
        destination: '/c/:companyId/diagnostics/seo-lab/:runId',
        permanent: true,
      },
      // API route redirect (temporary to allow old clients to still work)
      {
        source: '/api/os/diagnostics/run/seo-heavy',
        destination: '/api/os/diagnostics/run/seo-lab',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
