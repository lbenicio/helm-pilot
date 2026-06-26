import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      { source: '/health', destination: '/api/health' },
      { source: '/healthz', destination: '/api/healthz' },
      { source: '/live', destination: '/api/live' },
      { source: '/liveness', destination: '/api/live' },
      { source: '/ready', destination: '/api/ready' },
      { source: '/readiness', destination: '/api/ready' },
    ];
  },
};

export default nextConfig;
