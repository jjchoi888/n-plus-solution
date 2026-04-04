import './globals.css';
import Link from 'next/link';

export const metadata = {
    title: 'N+ Rewards & Booking',
    description: 'Book your stay and earn rewards.',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            {/* 💡 배경을 회색으로 깔고, 가운데 정렬된 모바일 사이즈(max-w-md)로 앱처럼 보이게 합니다 */}
            <body className="bg-slate-100 text-slate-800 font-sans pb-16">

                {/* 상단 헤더 */}
                <header className="bg-white shadow-sm sticky top-0 z-50 border-b border-slate-100">
                    <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
                        {/* 💡 [수정] 텍스트 로고를 이미지 로고로 교체했습니다. */}
                        <Link href="/" className="flex items-center gap-2.5">
                            <img src="/logo192.png" alt="N+ Logo" className="h-8 w-auto object-contain" />
                            <span className="text-lg font-black text-slate-800 tracking-tight">Rewards</span>
                        </Link>
                    </div>
                </header>

                {/* 메인 콘텐츠 영역 */}
                <main className="max-w-md mx-auto min-h-screen shadow-2xl bg-white relative">
                    {children}
                </main>

                {/* 하단 모바일 네비게이션 바 */}
                <nav className="fixed bottom-0 w-full z-50 pointer-events-none">
                    {/* max-w-md를 주어 가운데 정렬된 화면 폭에 딱 맞춥니다 */}
                    <div className="max-w-md mx-auto bg-white border-t border-slate-200 pointer-events-auto flex justify-between items-center p-2 pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                        <Link href="/" className="flex flex-col items-center gap-1 hover:text-blue-600 flex-1 text-center text-slate-400">
                            <span className="text-xl">🏠</span>
                            <span className="text-[10px] font-bold">Home</span>
                        </Link>
                        <Link href="/book" className="flex flex-col items-center gap-1 hover:text-blue-600 flex-1 text-center text-slate-400">
                            <span className="text-xl">🛏️</span>
                            <span className="text-[10px] font-bold">Book</span>
                        </Link>
                        <Link href="/profile" className="flex flex-col items-center gap-1 hover:text-blue-600 flex-1 text-center text-slate-400">
                            <span className="text-xl">👤</span>
                            <span className="text-[10px] font-bold">Profile</span>
                        </Link>
                    </div>
                </nav>
            </body>
        </html>
    );
}