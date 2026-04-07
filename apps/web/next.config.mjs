/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 💡 Vercel로 들어온 /api 요청을 구글 VM 서버(136.117.49.111:8000)로 자동 전달
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://136.117.49.111:8000/api/:path*',
      },
    ];
  },
};

export default nextConfig;