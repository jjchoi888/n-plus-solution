'use client';

export default function FloatingBackButton() {

  // 💡 [Core] Bypasses Next.js routing and forces a hard browser redirect to the home page.
  const forceGoHome = (e) => {
    e.preventDefault(); // Prevent any potential interference from other click events
    window.location.href = '/'; // The most reliable, native way to navigate
  };

  return (
    <button
      onClick={forceGoHome} // Attach the redirect function
      aria-label="Go to Home"
      // md:hidden -> Only visible on mobile devices
      // z-[99999]: Extremely high z-index to ensure it's always on top
      className="md:hidden fixed z-[99999] bg-white/90 backdrop-blur text-slate-700 shadow-[0_4px_15px_rgba(0,0,0,0.15)] border border-gray-200 rounded-full flex items-center justify-center active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-slate-700/50"

      style={{
        width: '56px',
        height: '56px',
        bottom: '56px',
        right: '40px',
        pointerEvents: 'auto', // 💡 [Core] Ensure the button receives clicks even if covered by a transparent overlay!
        cursor: 'pointer'
      }}
    >
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    </button>
  );
}