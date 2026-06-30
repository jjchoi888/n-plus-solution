import './globals.css';
import Link from 'next/link';
import BottomNav from './components/BottomNav';

// 💡 1. Add mobile viewport and theme color settings for PWA
export const viewport = {
    themeColor: '#ffffff', // App top status bar color (matched to white since header is bg-white)
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false, // Prevent zoom on touch to provide a native app-like experience
};

// 💡 2. Add PWA manifest and iOS (Apple) support properties to existing metadata
export const metadata = {
    title: 'N+ Rewards & Booking',
    description: 'Book your stay and earn rewards.',
    manifest: '/manifest.webmanifest', // Default path where Next.js App Router serves the built manifest
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
                            {/* 💡 As requested, the "n+" part is rendered as a logo image instead of text */}
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