'use client'; 

export default function FloatingBackButton() {
  
  // 💡 [핵심] Next.js 기능 다 무시하고, 브라우저 자체를 홈으로 강제 새로고침하며 꽂아버리는 함수
  const forceGoHome = (e) => {
    e.preventDefault(); // 혹시 모를 다른 클릭 이벤트 방해 공작 차단
    window.location.href = '/'; // 가장 강력한 원초적 이동 방법
  };

  return (
    <button
      onClick={forceGoHome} // 무적의 함수 연결
      aria-label="Go to Home"
      // md:hidden -> 모바일에서만 노출
      // z-[99999]: z-index를 극한으로 올려서 무조건 제일 위에 오게 함
      className="md:hidden fixed z-[99999] bg-white/90 backdrop-blur text-slate-700 shadow-[0_4px_15px_rgba(0,0,0,0.15)] border border-gray-200 rounded-full flex items-center justify-center active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-slate-700/50"
      
      style={{
        width: '56px',  
        height: '56px', 
        bottom: '56px', 
        right: '40px',  
        pointerEvents: 'auto', // 💡 [핵심] 투명한 막이 덮고 있어도 이 버튼은 무조건 클릭을 인식해라!
        cursor: 'pointer'
      }}
    >
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    </button>
  );
}