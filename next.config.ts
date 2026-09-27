import type {NextConfig} from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  allowedDevOrigins: process.env.BASE44_PUBLIC_HOST_SUFFIX
    ? ['3000-' + process.env.BASE44_PUBLIC_HOST_SUFFIX]
    : [],
  webpack: (config) => {
    config.resolve.alias['firebase/firestore'] = path.resolve('./src/lib/firestore-shim.ts');
    config.resolve.alias['firebase/auth'] = path.resolve('./src/lib/auth-shim.ts');
    config.resolve.alias['firebase/storage'] = path.resolve('./src/lib/storage-shim.ts');
    config.resolve.alias['firebase/app'] = path.resolve('./src/lib/app-shim.ts');
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
