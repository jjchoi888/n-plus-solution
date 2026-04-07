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
            // 💡 ESLint 빌드 에러를 막기 위해 console.log 삭제됨
            url.pathname = `/hq${url.pathname}`;
            return NextResponse.rewrite(url);
        }
    }

    return NextResponse.next();
}

// 💡 [가장 중요] 미들웨어가 무조건 실행되도록 강제
export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};