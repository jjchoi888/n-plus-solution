'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import axios from 'axios';

export default function BottomNav() {
    const pathname = usePathname();
    const [hasUnread, setHasUnread] = useState(false);

    // 💡 특정 경로(결제창 등)에서는 탭바 숨기기
    if (pathname?.includes('/payment') || pathname?.includes('/login')) {
        return null;
    }

    // 💡 백엔드에서 안 읽은 알림이 있는지 확인하는 함수 (기존 로직 100% 유지)
    useEffect(() => {
        const checkUnreadNotifications = async () => {
            try {
                const savedUser = localStorage.getItem('nplus_guest_user');
                if (!savedUser) return;

                const parsedUser = JSON.parse(savedUser);
                if (!parsedUser.email) return;

                const res = await axios.get(`https://api.hotelnplus.com/api/members/notifications?email=${parsedUser.email}`);

                if (res.data && res.data.success) {
                    const unreadExists = res.data.notifications.some(n => n.is_read === 0 || n.is_read === false);
                    setHasUnread(unreadExists);
                }
            } catch (error) {
                console.error("Failed to check unread notifications", error);
            }
        };

        checkUnreadNotifications();
        const interval = setInterval(checkUnreadNotifications, 15000);
        return () => clearInterval(interval);
    }, []);

    return (
        <nav className="fixed bottom-0 w-full z-50 pointer-events-none pb-safe">
            <div className="max-w-md mx-auto bg-white border-t border-slate-200 pointer-events-auto flex justify-between items-end px-2 pb-5 pt-3 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] relative">

                {/* Home */}
                <Link href="/" className={`flex flex-col items-center gap-1 flex-1 transition-colors ${pathname === '/' ? 'text-[#009900]' : 'text-slate-400 hover:text-slate-600'}`}>
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                    <span className="text-[9px] font-bold">Home</span>
                </Link>

                {/* Events */}
                <Link href="/events" className={`flex flex-col items-center gap-1 flex-1 transition-colors ${pathname === '/events' ? 'text-[#009900]' : 'text-slate-400 hover:text-slate-600'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    <span className="text-[9px] font-bold">Events</span>
                </Link>

                {/* 💡 [핵심 수정] Discover -> /book 으로 경로 변경 및 현재 경로에 따른 색상 변화 추가 */}
                <div className="flex flex-col items-center justify-end flex-1 relative h-full">
                    <Link href="/book" className={`absolute -top-10 w-14 h-14 rounded-full flex items-center justify-center border-4 border-slate-50 shadow-md text-white hover:scale-105 transition-transform z-50 ${pathname === '/book' ? 'bg-[#008000]' : 'bg-[#009900]'}`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
                        </svg>
                    </Link>
                    <span className={`text-[9px] font-bold mt-6 ${pathname === '/book' ? 'text-[#009900]' : 'text-slate-400'}`}>Discover</span>
                </div>

                {/* Notifications (알림 배지 완벽 보존) */}
                <Link href="/notifications" className={`flex flex-col items-center gap-1 flex-1 transition-colors ${pathname === '/notifications' ? 'text-[#009900]' : 'text-slate-400 hover:text-slate-600'}`}>
                    <div className="relative">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                        </svg>
                        {hasUnread && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
                        )}
                    </div>
                    <span className="text-[9px] font-bold">Notifications</span>
                </Link>

                {/* Profile */}
                <Link href="/profile" className={`flex flex-col items-center gap-1 flex-1 transition-colors ${pathname === '/profile' ? 'text-[#009900]' : 'text-slate-400 hover:text-slate-600'}`}>
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    <span className="text-[9px] font-bold">Profile</span>
                </Link>

            </div>
        </nav>
    );
}