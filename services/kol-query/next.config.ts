import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.easykol.com' },
      { protocol: 'https', hostname: '*.easykol.com' },
    ],
  },
}

export default nextConfig
