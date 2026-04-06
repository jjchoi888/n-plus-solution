import './globals.css';
import Link from 'next/link';

export const metadata = {
    title: 'N+ Rewards & Booking',
    description: 'Book your stay and earn rewards.',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className="bg-slate-100 text-slate-800 font-sans pb-24">

                <header className="bg-white shadow-sm sticky top-0 z-50 border-b border-slate-100">
                    <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
                        <Link href="/" className="flex items-center gap-2.5">
                            <img src="/logo192.png" alt="N+ Logo" className="h-8 w-auto object-contain" />
                            <span className="text-lg font-bold text-slate-800 tracking-tight">Rewards</span>
                        </Link>
                    </div>
                </header>

                <main className="max-w-md mx-auto min-h-screen shadow-2xl bg-white relative">
                    {children}
                </main>

                <nav className="fixed bottom-0 w-full z-50 pointer-events-none">
                    <div className="max-w-md mx-auto bg-white border-t border-slate-200 pointer-events-auto flex justify-between items-end px-2 pb-5 pt-3 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] relative">

                        <Link href="/" className="flex flex-col items-center gap-1 flex-1 text-[#009900]">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                            </svg>
                            <span className="text-[9px] font-bold">Home</span>
                        </Link>

                        <Link href="/events" className="flex flex-col items-center gap-1 flex-1 text-slate-400 hover:text-slate-600 transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            <span className="text-[9px] font-bold">Events</span>
                        </Link>

                        <div className="flex flex-col items-center justify-end flex-1 relative h-full">
                            <Link href="/discover" className="absolute -top-10 bg-[#009900] w-14 h-14 rounded-full flex items-center justify-center border-4 border-slate-50 shadow-md text-white hover:scale-105 transition-transform z-50">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
                                </svg>
                            </Link>
                            <span className="text-[9px] font-bold text-slate-400 mt-6">Discover</span>
                        </div>

                        <Link href="/notifications" className="flex flex-col items-center gap-1 flex-1 text-slate-400 hover:text-slate-600 transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                            </svg>
                            <span className="text-[9px] font-bold">Notificies</span>
                        </Link>

                        <Link href="/profile" className="flex flex-col items-center gap-1 flex-1 text-slate-400 hover:text-slate-600 transition-colors">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                            <span className="text-[9px] font-bold">Profile</span>
                        </Link>

                    </div>
                </nav>
            </body>
        </html>
    );
}