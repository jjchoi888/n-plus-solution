import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 💡 [수정] 로컬 네트워크 기기 및 서브도메인 테스트를 위한 허용 목록 확대
  allowedDevOrigins: [
    '192.168.100.208',   // 대표님 로컬 PC의 네트워크 IP
    'localhost',         // 기본 로컬 접속
    '*.localhost',       // hq.localhost, app.localhost 등 서브도메인 테스트용
    'hotelnplus.com',    // 정식 도메인 (필요시)
    '*.hotelnplus.com'   // 모든 서브도메인
  ],

  // 💡 [참고] 만약 기존에 rewrites 설정이 있었다면 여기에 합쳐주시면 됩니다.
  /*
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://api.hotelnplus.com/api/:path*',
      },
    ];
  },
  */
};

export default nextConfig;