'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ProfilePage() {
    const [user, setUser] = useState(null);
    const [myBookings, setMyBookings] = useState([]);

    useEffect(() => {
        // 1. 유저 정보 불러오기 (로컬 스토리지 캐시)
        const savedUser = localStorage.getItem('nplus_guest_user');
        if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);

            // 2. 백엔드에서 최신 데이터를 가져와서 모바일 화면 즉시 갱신 (HQ 실시간 동기화)
            fetch(`https://api.hotelnplus.com/api/members/profile?email=${parsedUser.email}&t=${Date.now()}`, { cache: 'no-store' })
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.member) {
                        const freshUser = {
                            ...data.member,
                            // 이름 조합 로직 통일
                            name: `${data.member.first_name || ''} ${data.member.last_name || ''}`.trim() || 'Guest User'
                        };
                        localStorage.setItem('nplus_guest_user', JSON.stringify(freshUser));
                        setUser(freshUser); // 화면 새로고침
                    }
                })
                .catch(err => console.error("Profile sync error:", err));
        }

        // 예약 내역 불러오기
        const savedBookings = localStorage.getItem('nplus_my_bookings');
        if (savedBookings) {
            setMyBookings(JSON.parse(savedBookings));
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('nplus_guest_user');
        setUser(null);
        window.location.href = '/';
    };

    return (
        <div className="pb-24 font-sans bg-slate-50 min-h-screen selection:bg-[#009900]/20">
            <div className="bg-white px-4 py-4 flex items-center justify-between sticky top-0 z-40 border-b border-slate-100 shadow-sm">
                <h1 className="text-lg font-black text-slate-800 ml-2">My Profile</h1>
            </div>

            <div className="p-4 md:p-6 space-y-6">

                {/* 1. 내 정보 섹션 */}
                {user ? (
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-none p-6 text-white shadow-lg relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 text-8xl opacity-10">👑</div>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Membership</p>
                                {/* 💡 [핵심 수정 구간] 하드코딩 완전 제거! DB에서 온 tier_id를 무조건 대문자로 출력 */}
                                <p className="text-[#009900] font-black text-sm uppercase tracking-widest">
                                    {user.tier_id ? `${user.tier_id} TIER` : 'Member'}
                                </p>
                            </div>
                            <div className="text-right">
                                <h2 className="text-xl font-black">
                                    {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.name}
                                </h2>
                                <p className="text-xs text-slate-400 font-medium mt-1">{user.email}</p>
                            </div>
                        </div>

                        <div className="bg-white/10 rounded-none p-4 backdrop-blur-md border border-white/10">
                            <p className="text-[10px] text-slate-300 mb-1 uppercase font-bold tracking-wider">Available Reward Points</p>
                            <p className="text-3xl font-black tracking-wider text-white">₱ {(user.total_points || 0).toLocaleString()}</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-100 rounded-none p-6 text-center shadow-inner border border-slate-200">
                        <h2 className="text-xl font-black text-slate-800 mb-2">Guest User</h2>
                        <p className="text-sm font-bold text-slate-500 mb-6 px-4">Log in to view your reward points and faster booking checkout.</p>
                        <Link href="/login" className="inline-block bg-[#009900] text-white font-black px-10 py-3.5 rounded-none shadow-lg hover:bg-[#008000] transition-colors text-sm w-full">
                            Log In
                        </Link>
                    </div>
                )}

                {/* 2. 나의 예약 내역 섹션 (My Bookings) */}
                <div>
                    <h3 className="font-black text-slate-800 text-lg mb-4 pl-1 flex items-center gap-2">
                        <span className="text-xl">🧳</span> My Bookings
                    </h3>

                    {myBookings.length > 0 ? (
                        <div className="space-y-4">
                            {myBookings.map((booking, idx) => (
                                <div key={idx} className="bg-white border-2 border-slate-200 rounded-none shadow-sm p-5 relative">
                                    <div className="absolute top-4 right-4">
                                        {booking.status === 'Pending' ? (
                                            <span className="bg-yellow-100 text-yellow-800 border border-yellow-300 px-3 py-1 rounded-none text-[9px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1">
                                                ⏳ Pending
                                            </span>
                                        ) : (
                                            <span className="bg-green-100 text-green-800 border border-green-300 px-3 py-1 rounded-none text-[9px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1">
                                                ✅ Confirmed
                                            </span>
                                        )}
                                    </div>

                                    <h4 className="font-black text-slate-800 text-lg mb-1">{booking.hotelName}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 mb-4 tracking-wider uppercase">Req ID: {booking.id}</p>

                                    <div className="bg-slate-50 p-3 border border-slate-100 rounded-none mb-4">
                                        <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
                                            <div className="flex-1">
                                                <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">Check-in</p>
                                                <p>{booking.checkIn}</p>
                                            </div>
                                            <span className="text-slate-300">➔</span>
                                            <div className="flex-1 text-right">
                                                <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">Check-out</p>
                                                <p>{booking.checkOut}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 border-t border-slate-100 pt-4">
                                        {Object.entries(booking.rooms).map(([roomName, qty]) => (
                                            <div key={roomName} className="flex justify-between items-center text-xs font-bold text-slate-600">
                                                <span>🛏️ {roomName}</span>
                                                <span className="bg-slate-200 px-2 py-0.5 rounded-none text-slate-700">x {qty}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-end">
                                        <p className="text-[10px] font-bold text-slate-500">{booking.guests}</p>
                                        <p className="font-black text-lg text-[#009900]">₱{(booking.totalAmount || 0).toLocaleString()}</p>
                                    </div>

                                    {booking.status === 'Pending' && (
                                        <div className="mt-4 bg-orange-50 border border-orange-200 text-orange-800 text-[10px] p-2.5 rounded-none font-bold text-center leading-relaxed">
                                            Your request has been sent to the hotel front desk.<br />
                                            Please wait for their final confirmation.
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-none p-10 text-center shadow-sm">
                            <div className="text-4xl mb-3 opacity-50">📭</div>
                            <p className="text-sm font-bold text-slate-500">You have no upcoming bookings.</p>
                            <Link href="/book" className="inline-block mt-4 bg-slate-900 text-white font-black px-6 py-2.5 rounded-none shadow-md hover:bg-slate-800 text-xs">
                                Book a Room
                            </Link>
                        </div>
                    )}
                </div>

                {user && (
                    <div className="mt-10 pt-6 border-t border-slate-200 text-center">
                        <button onClick={handleLogout} className="text-xs font-bold text-slate-400 hover:text-red-500 underline py-2">
                            Sign Out securely
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}