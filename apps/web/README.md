🏨 N+ Total Hotel Solution
이 프로젝트는 호텔 통합 예약 시스템(Guest App), 현장 운영 시스템(PMS), 그리고 본사 관리 포털(HQ)을 포함하는 Next.js 기반 통합 솔루션입니다.

🌐 서비스 도메인 구조 (Production)
현재 모든 인프라는 Vercel과 Squarespace DNS를 통해 연결되어 있습니다.

통합 웹 (B2C): https://www.hotelnplus.com

게스트 앱 (Membership): https://app.hotelnplus.com

호텔 PMS (B2B 운영): https://manage.hotelnplus.com

본사 포털 (Super Admin): https://hq.hotelnplus.com

백엔드 API 서버: https://api.hotelnplus.com

🛠️ 개발 환경 설정 (Getting Started)
1. 의존성 설치
Bash
npm install
2. 로컬 개발 서버 실행
Bash
npm run dev
통합웹: localhost:3000

HQ 포털: hq.localhost:3000 (미들웨어 설정 필요)

3. 환경 변수 (.env.local)
API 서버와 통신하기 위해 아래 변수가 설정되어 있어야 합니다.

코드 스니펫
NEXT_PUBLIC_API_URL=https://api.hotelnplus.com
VITE_API_URL=https://api.hotelnplus.com
🏗️ 주요 기술 스택
Frontend: Next.js (App Router), React, TailwindCSS

Backend Interface: Axios, Socket.io-client (실시간 통신)

Database/Auth: Firebase (Firestore, Auth)

Deployment: Vercel

📝 최근 인프라 업데이트 (2026-04-07)
모든 하드코딩된 IP 주소(136.117.49.111)를 정식 도메인(api.hotelnplus.com)으로 교체 완료.

next.config.js 및 vercel.json 내 리라이트(Rewrite) 경로 최적화.

SSL(HTTPS) 환경을 고려한 웹소켓 secure 옵션 적용.