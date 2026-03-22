/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // 💡 목적지를 열려있는 8000번으로!
        destination: 'http://136.117.49.111:8000/api/:path*',
      },
    ];
  },
};
export default nextConfig;