/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@deriv/core'],
  devIndicators: false,
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: '^frostydbot\\.site$' }],
        destination: 'https://www.frostydbot.site/:path*',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
