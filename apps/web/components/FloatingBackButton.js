'use client'; // 💡 Next.js에서는 버튼 기능(클릭)을 쓰려면 이 줄이 무조건 맨 위에 있어야 합니다!

import { useRouter } from 'next/navigation';

export default function FloatingBackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      // md:hidden -> 모바일에서만 보임
      // fixed top-4 right-4 -> 우측 상단 고정
      className="md:hidden fixed top-4 right-4 z-[9999] w-10 h-10 flex items-center justify-center rounded-full bg-slate-900/40 backdrop-blur-md text-white shadow-lg active:scale-95 hover:bg-slate-900/60 transition-all border border-white/20"
      aria-label="Go Back"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
    </button>
  );
}