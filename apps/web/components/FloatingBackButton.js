'use client';

import { useRouter } from 'next/navigation';

export default function FloatingBackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      aria-label="Go Back"
      // [디자인 및 위치 전면 수정]
      // 1. md:hidden: 모바일에서만 노출
      // 2. fixed bottom-8 right-4: 헤더를 피해서 화면 우측 하단(엄지손가락 위치)으로 이동!
      // 3. z-[9999]: 어떤 메뉴나 이미지보다도 최상단에 뜨도록 보장
      // 4. w-12 h-12: 터치하기 쉽도록 크기를 살짝 키움
      // 5. bg-white/90 backdrop-blur: 배경이 비치는 고급스러운 흰색 바탕
      // 6. shadow-[0_4px_15px_rgba(0,0,0,0.15)]: 배경이 흰색이어도 구분되도록 뚜렷한 그림자 추가!
      // 7. text-slate-700: 화살표는 진한 회색으로 어떤 배경에서도 100% 가시성 확보
      className="md:hidden fixed bottom-8 right-4 z-[9999] w-12 h-12 flex items-center justify-center rounded-full bg-white/90 backdrop-blur text-slate-700 shadow-[0_4px_15px_rgba(0,0,0,0.15)] border border-gray-200 active:scale-90 transition-all"
    >
      <svg 
        className="w-6 h-6" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2.5} 
          d="M10 19l-7-7m0 0l7-7m-7 7h18" 
        />
      </svg>
    </button>
  );
}