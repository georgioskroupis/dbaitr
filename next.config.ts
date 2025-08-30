import type {NextConfig} from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  /* config options here */
  // Avoid bundling optional server-only deps used by Genkit/OpenTelemetry during Next build
  serverExternalPackages: [
    '@opentelemetry/api',
    '@opentelemetry/instrumentation',
    '@opentelemetry/sdk-node',
    '@opentelemetry/exporter-jaeger',
    'handlebars',
    'dotprompt',
    '@genkit-ai/core',
    'genkit'
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  // Optional CSP for self-hosted on-device IDV assets (Human models, Tesseract worker/wasm)
  // Enable by setting NEXT_ENABLE_IDV_CSP=true
  async headers() {
    if (process.env.NEXT_ENABLE_IDV_CSP !== 'true') return [] as any;
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "script-src 'self'",
      "worker-src 'self' blob:",
      "connect-src 'self' https:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "media-src 'self' blob: data:",
      "frame-src 'none'",
    ].join('; ');
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
  // Dev-only rewrite to silence extension-initiated CSS reload 404 spam
  async rewrites() {
    if (process.env.NODE_ENV === 'production') return [] as any;
    return [
      {
        source: '/_next/static/css/app/layout.css',
        destination: '/dev-noop.css',
      },
      // Serve SVG favicon in dev to avoid flaky app/favicon.ico route
      {
        source: '/favicon.ico',
        destination: '/dbaitr-favicon.svg',
      },
      // Guard: vendor-chunks probes to noop (silences dev spam)
      {
        source: '/_next/server/vendor-chunks/:path*',
        destination: '/dev-noop.css',
      },
    ];
  },
};
export default nextConfig;
