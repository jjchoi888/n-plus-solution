import { NextResponse } from 'next/server';

export function middleware(req) {
    const url = req.nextUrl.clone();
    const hostname = req.headers.get('host') || '';

    // Next.js 내부 정적 파일 패스
    if (
        url.pathname.startsWith('/_next') ||
        url.pathname.startsWith('/api') ||
        url.pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // 💡 본사 포털 (HQ) 라우팅
    if (hostname === 'hq.hotelnplus.com' || hostname.startsWith('hq.localhost')) {
        url.pathname = `/hq${url.pathname}`;
        return NextResponse.rewrite(url);
    }

    return NextResponse.next();
}