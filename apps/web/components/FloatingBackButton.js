'use client'; // Next.js Client Component

import { useRouter } from 'next/navigation';

export default function FloatingBackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      aria-label="Go Back"
      // [디자인 업데이트 완료]
      // 1. md:hidden: PC화면에서는 숨깁니다.
      // 2. fixed z-[999]: 화면에 고정하되 최상단에 띄웁니다.
      // 3. top-24 right-4: [위치 수정] 헤더(보통 top-16) 아래, 글자 근처로 내렸습니다.
      // 4. w-10 h-10 rounded-full: 동그란 모양을 만듭니다.
      // 5. border border-white: [스타일 수정] 흰색의 아주 얇은 테두리선을 만듭니다.
      // 6. bg-transparent: [스타일 수정] 배경을 완전히 투명하게 설정합니다.
      // 7. active:scale-95 transition-all: 클릭 시 살짝 작아지는 효과를 줍니다.
      className="md:hidden fixed top-24 right-4 z-[999] w-10 h-10 flex items-center justify-center rounded-full border border-white bg-transparent active:scale-95 transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50"
    >
      {/* 뒤로 가기 화살표 아이콘 */}
      <svg 
        className="w-5 h-5 text-white" // 화살표 색상을 흰색으로 설정
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          // [스타일 수정] 테두리보다 살짝 두꺼운 선(2)으로 화살표를 그립니다.
          strokeWidth={2} 
          d="M10 19l-7-7m0 0l7-7m-7 7h18" 
        />
      </svg>
    </button>
  );
}