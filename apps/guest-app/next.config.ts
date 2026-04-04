import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 모바일/로컬 네트워크 기기 접속 허용 (에러 메시지에 나온 IP 입력)
  allowedDevOrigins: ['192.168.100.208', 'localhost'],

  // 기존에 다른 설정이 있었다면 아래에 유지해 주세요
};

export default nextConfig;