'use client'; // Next.js Client Component

import Link from 'next/link'; // 💡 [FIX: 기능 수정] router 대신 Link 컴포넌트를 사용합니다.

export default function FloatingBackButton() {
  return (
    // 💡 [FIX: 기능 수정] <button> 대신 <Link href="/">를 사용합니다.
    // 이것은 HTML 표준 링크(<a>)를 생성하므로, 눈에 보이고 클릭만 된다면 무조건 홈으로 이동합니다!
    <Link
      href="/"
      aria-label="Go to Home"
      // md:hidden -> 모바일에서만 노출
      // fixed z-[9999]: 어떤 메뉴나 이미지보다도 최상단에 뜨도록 보장 (클릭 방해 요소 원천 차단)
      // active:scale-95 transition-all: 클릭 시 살짝 작아지는 효과를 줍니다.
      // shadow-[0_4px_15px_rgba(0,0,0,0.15)]: 그림자를 통해 배경과 확실히 구분 (가시성 확보)
      className="md:hidden fixed z-[9999] bg-white/90 backdrop-blur text-slate-700 shadow-[0_4px_15px_rgba(0,0,0,0.15)] border border-gray-200 rounded-full flex items-center justify-center active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-slate-700/50"
      
      // [FIX: 크기 및 위치 수정]
      // 1. 크기 10% 키우기: w-12/h-12 (48px) -> w-14/h-14 (56px) [약 16% 증대]
      // 2. 위치 이동: 크기의 절반(28px)만큼 위/좌측으로 이동
      //    기존: bottom-8(32px) right-4(16px)
      //    수정: bottom-14(56px = 32+24+α) right-10(40px = 16+24)
      style={{
        width: '56px',  // w-14
        height: '56px', // h-14
        bottom: '56px', // bottom-14
        right: '40px',  // right-10
      }}
    >
      {/* 💡 누구나 '홈으로 간다'고 직관적으로 알 수 있는 집(Home) 모양 아이콘! */}
      <svg 
        className="w-7 h-7" // 버튼 크기에 맞춰 아이콘 크기도 살짝 키웠습니다.
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
        />
      </svg>
    </Link>
  );
}