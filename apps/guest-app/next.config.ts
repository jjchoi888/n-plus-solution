import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

// 💡 PWA 설정 초기화
const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // 💡 swcMinify: true,  <-- 이 줄을 삭제하세요. (Next.js 최신 버전은 기본으로 적용됨)
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

// 💡 기존 Next.js 설정
// (참고: allowedDevOrigins 속성에서 TypeScript 타입 에러가 발생한다면 `const nextConfig = { ... } as any;` 형태로 수정해서 사용하세요.)
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

// 기존 nextConfig를 PWA 모듈로 감싸서 export 합니다.
export default withPWA(nextConfig);