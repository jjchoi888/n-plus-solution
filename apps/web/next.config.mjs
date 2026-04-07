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

  // 1. 본사 포털 (HQ)
  if (hostname === 'hq.hotelnplus.com' || hostname.startsWith('hq.localhost')) {
    url.pathname = `/hq${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // 💡 2. 게스트 앱 (n+ Rewards) - 수정 완료!
  if (hostname === 'app.hotelnplus.com' || hostname.startsWith('app.localhost')) {
    // 대표님께서 알려주신 실제 폴더 경로 반영
    // (주의: 만약 프로젝트의 기본 `app` 폴더 바로 아래에 `guest-app`이 있다면 `/guest-app${url.pathname}`으로 하셔야 합니다.)
    url.pathname = `/apps/guest-app${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // 3. 호텔 PMS (Manage)
  if (hostname === 'manage.hotelnplus.com' || hostname.startsWith('manage.localhost')) {
    url.pathname = `/manage${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}