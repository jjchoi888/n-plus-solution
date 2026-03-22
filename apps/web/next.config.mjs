/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        // 1. 일반 데이터 API 통로
        source: '/api/:path*',
        destination: 'http://136.117.49.111:8000/api/:path*',
      },
      {
        // 2. 실시간 소켓 통신 통로 (이게 없으면 소켓 에러가 납니다)
        source: '/socket.io/:path*',
        destination: 'http://136.117.49.111:8000/socket.io/:path*',
      },
    ];
  },
};

export default nextConfig;