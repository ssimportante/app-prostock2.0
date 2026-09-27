import type {NextConfig} from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  allowedDevOrigins: process.env.BASE44_PUBLIC_HOST_SUFFIX
    ? ['3000-' + process.env.BASE44_PUBLIC_HOST_SUFFIX]
    : [],
  webpack: (config) => {
    // Alias the entire firebase package to our local compat layer.
    // The firebase npm package uses an `exports` field that overrides
    // per-subpath aliases, so we redirect the whole package instead.
    config.resolve.alias['firebase'] = path.resolve('./src/lib/firebase-compat');
    return config;
  },
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
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'clipboard-write=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
