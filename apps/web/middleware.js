import { NextResponse } from 'next/server';

export function middleware(req) {
    // 💡 이제 도메인 분기 처리는 프론트엔드의 DomainRouter.js가 100% 전담합니다.
    // 미들웨어는 아무런 간섭 없이 요청을 그대로 통과시킵니다.
    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};