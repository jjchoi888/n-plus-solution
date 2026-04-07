import { NextResponse } from 'next/server';

export function middleware(req) {
    const url = req.nextUrl.clone();
    const hostname = req.headers.get('host') || '';

    // 1. Next.js 내부 정적 파일 패스
    if (
        url.pathname.startsWith('/_next') ||
        url.pathname.startsWith('/api') ||
        url.pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // 💡 2. 본사 포털 (HQ) 라우팅
    if (hostname === 'hq.hotelnplus.com' || hostname.startsWith('hq.localhost')) {
        // 이미 /hq 경로로 들어온 경우는 무한 루프 방지
        if (!url.pathname.startsWith('/hq')) {
            console.log("🚀 [Middleware] HQ 도메인 감지 -> /hq 로 리라이트 합니다.");
            url.pathname = `/hq${url.pathname}`;
            return NextResponse.rewrite(url);
        }
    }

    return NextResponse.next();
}

// 💡 [가장 중요] 미들웨어가 루트(/)를 포함한 모든 일반 경로에서 무조건 실행되도록 강제
export const config = {
    matcher: [
        /*
         * 다음으로 시작하는 경로를 제외한 모든 요청과 일치:
         * - api (API 경로)
         * - _next/static (정적 파일)
         * - _next/image (이미지 최적화 파일)
         * - favicon.ico (파비콘 파일)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};