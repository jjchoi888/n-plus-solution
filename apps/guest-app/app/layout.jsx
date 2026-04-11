import './globals.css';
import Link from 'next/link';
import BottomNav from './components/BottomNav';

// 💡 1. PWA를 위한 모바일 뷰포트 및 테마 컬러 설정 추가
export const viewport = {
    themeColor: '#ffffff', // 앱 상단 상태바 색상 (현재 헤더가 bg-white이므로 흰색으로 맞춤)
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false, // 터치 시 화면이 확대되는 것을 방지하여 네이티브 앱 같은 경험 제공
};

// 💡 2. 기존 메타데이터에 PWA manifest 및 iOS(Apple) 지원 속성 추가
export const metadata = {
    title: 'N+ Rewards & Booking',
    description: 'Book your stay and earn rewards.',
    manifest: '/manifest.webmanifest', // Next.js App Router가 manifest.js를 빌드하여 제공하는 기본 경로
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'N+ Rewards',
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className="bg-slate-100 text-slate-800 font-sans pb-24">

                <header className="bg-white shadow-sm sticky top-0 z-50 border-b border-slate-100">
                    <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
                        <Link href="/" className="flex items-center gap-2.5">
                            {/* 💡 요청하신 대로 "n+" 부분이 텍스트가 아닌 로고 이미지로 처리되어 있습니다 */}
                            <img src="/logo192.png" alt="N+ Logo" className="h-8 w-auto object-contain" />
                            <span className="text-lg font-bold text-slate-800 tracking-tight">Rewards</span>
                        </Link>
                    </div>
                </header>

                <main className="max-w-md mx-auto min-h-screen shadow-2xl bg-white relative">
                    {children}
                </main>

                <BottomNav />

            </body>
        </html>
    );
}