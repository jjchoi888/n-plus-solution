'use client';

import { useRouter } from 'next/navigation';

export default function FloatingBackButton() {
  const router = useRouter();

  return (
    <button
      // 💡 [핵심] router.back() 대신 router.push('/')를 써서 무조건 홈 화면으로 보냅니다!
      onClick={() => router.push('/')}
      aria-label="Go to Home"
      // 💡 디자인: 기존에 잘 적용되었던 우측 하단(bottom-8 right-4) 세련된 디자인 유지
      className="md:hidden fixed bottom-8 right-4 z-[9999] w-12 h-12 flex items-center justify-center rounded-full bg-white/90 backdrop-blur text-slate-700 shadow-[0_4px_15px_rgba(0,0,0,0.15)] border border-gray-200 active:scale-90 transition-all"
    >
      {/* 💡 누구나 '홈으로 간다'고 직관적으로 알 수 있는 집(Home) 모양 아이콘! */}
      <svg 
        className="w-6 h-6" 
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
    </button>
  );
}