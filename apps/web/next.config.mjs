/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        // 1. 일반 데이터 API 통로
        // 프론트엔드에서 /api/hotels 로 요청을 보내면 
        // 실제로는 https://api.hotelnplus.com/api/hotels 로 전달됩니다.
        source: '/api/:path*',
        destination: 'https://api.hotelnplus.com/api/:path*',
      },
      {
        // 2. 실시간 소켓 통신 통로
        // 정식 도메인을 통해 암호화된(https) 소켓 연결을 제공합니다.
        source: '/socket.io/:path*',
        destination: 'https://api.hotelnplus.com/socket.io/:path*',
      },
    ];
  },
};

export default nextConfig;