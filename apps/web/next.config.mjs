/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // 💡 목적지를 5000번으로 수정!
        destination: 'http://136.117.49.111:5000/api/:path*',
      },
    ];
  },
};

export default nextConfig;