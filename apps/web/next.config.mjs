/** @type {import('next').NextConfig} */
const nextConfig = {
  // 💡 [핵심 해결] Vercel(https)에서 IP(http)로 직접 요청 시 발생하는 Mixed Content 차단 에러를 우회(Proxy)합니다.
  async rewrites() {
    return [
      {
        // 프론트엔드에서 /api/ 로 시작하는 모든 요청을
        source: '/api/:path*',
        // 구글 클라우드 백엔드 주소로 몰래 전달합니다.
        destination: 'http://136.117.49.111:8000/api/:path*',
      },
    ];
  },
};

export default nextConfig;