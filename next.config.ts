import type { NextConfig } from "next";

const BACKEND_PORT = process.env.SERVER_PORT || 4010;

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: '/app.css',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/workspace/:workspaceId/remote-session',
        destination: '/workspace/:workspaceId/inbox?channel=zalo',
        permanent: false,
      },
      {
        source: '/workspace/:workspaceId/email',
        destination: '/workspace/:workspaceId/settings?tab=email',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    if (process.env.NODE_ENV === 'production') return [];
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${BACKEND_PORT}/api/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `http://localhost:${BACKEND_PORT}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
