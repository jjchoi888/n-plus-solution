/** @type {import('next').NextConfig} */
const apiProxyTarget =
  process.env.API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://api.hotelnplus.com';

const nextConfig = {
  reactStrictMode: true,
  // Route all web /api traffic through the configured backend target.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget.replace(/\/$/, '')}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
