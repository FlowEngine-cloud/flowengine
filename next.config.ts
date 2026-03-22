import type { NextConfig } from 'next';

// Internal Kong URL — only used server-side for proxying Supabase calls.
// In Docker this is http://kong:8000; locally it falls back to the public URL.
const supabaseInternalUrl = process.env.SUPABASE_URL || 'http://kong:8000';

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
      '@radix-ui/react-slot',
      '@radix-ui/react-tooltip',
      '@supabase/supabase-js',
    ],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
  productionBrowserSourceMaps: false,
  output: 'standalone',
  ...(process.env.NODE_ENV === 'production' && {
    compiler: {
      removeConsole: {
        exclude: ['error'],
      },
    },
  }),
  async rewrites() {
    return [
      { source: '/auth/v1/:path*',    destination: `${supabaseInternalUrl}/auth/v1/:path*` },
      { source: '/rest/v1/:path*',    destination: `${supabaseInternalUrl}/rest/v1/:path*` },
      { source: '/storage/v1/:path*', destination: `${supabaseInternalUrl}/storage/v1/:path*` },
      { source: '/realtime/v1/:path*',destination: `${supabaseInternalUrl}/realtime/v1/:path*` },
    ];
  },
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
    ];

    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Allow widget pages to be iframed
        source: '/w/:path*',
        headers: [
          ...securityHeaders.filter(h => h.key !== 'X-Frame-Options'),
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
