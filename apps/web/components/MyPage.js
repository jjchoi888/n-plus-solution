"use client";
import { useState, useEffect } from "react";

export default function MyPage({ user, onBack }) {
    // 예약 내역 (현재는 Mock 데이터, 나중에 API 연결)
    const [bookings, setBookings] = useState([
        { id: 'BK-20260401', hotel: 'Sky City Hotel', room: 'Deluxe King', checkIn: '2026-05-10', status: 'Confirmed' },
        { id: 'BK-20260315', hotel: 'Ocean Resort', room: 'Suite Room', checkIn: '2026-03-20', status: 'Completed' },
    ]);

    return (
        <div className="w-full max-w-5xl mx-auto pt-24 pb-20 px-4 animate-fade-in">
            {/* 상단 헤더 & 뒤로가기 */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h1 className="text-3xl font-black text-slate-800">My Rewards Dashboard</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* 좌측: 프로필 & 멤버십 카드 */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-emerald-500/40 transition-all"></div>

                        <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">{user?.tierName || 'Basic'} Member</p>
                        <h2 className="text-2xl font-black mb-6">{user?.name || 'Guest User'}</h2>

                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Available Points</p>
                                <p className="text-3xl font-black text-emerald-400">{(user?.total_points || 0).toLocaleString()} <span className="text-sm text-slate-300 font-bold ml-1">pts</span></p>
                            </div>
                            <div className="pt-4 border-t border-slate-800">
                                <p className="text-xs text-slate-400 font-medium">Member ID: {user?.email}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4">Membership Benefits</h3>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                <span className="text-emerald-500">✓</span> 2% Point Accrual
                            </li>
                            <li className="flex items-center gap-2 text-sm text-slate-400 font-medium">
                                <span className="text-slate-300">✓</span> 1-Hour Late Checkout (Silver+)
                            </li>
                        </ul>
                    </div>
                </div>

                {/* 우측: 최근 예약 내역 */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-black text-slate-800">Recent Bookings</h3>
                            <button className="text-xs font-bold text-emerald-600 hover:underline">View All History</button>
                        </div>

                        <div className="divide-y divide-slate-50">
                            {bookings.map((bk) => (
                                <div key={bk.id} className="p-6 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 mb-1">{bk.id}</p>
                                        <h4 className="font-bold text-slate-800">{bk.hotel}</h4>
                                        <p className="text-sm text-slate-500">{bk.room} • {bk.checkIn}</p>
                                    </div>
                                    <div className="flex items-center justify-between md:justify-end gap-4">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${bk.status === 'Confirmed' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            {bk.status}
                                        </span>
                                        <button className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-emerald-600 transition-colors">
                                            Details
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {bookings.length === 0 && (
                            <div className="p-20 text-center">
                                <p className="text-slate-400 font-bold">No booking records found.</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-emerald-50 rounded-3xl p-6 border border-emerald-100 flex items-center justify-between">
                        <div>
                            <h4 className="font-black text-emerald-800">Explore more destinations</h4>
                            <p className="text-sm text-emerald-600">Book with n+ partners and save up to 10% in points.</p>
                        </div>
                        <button onClick={onBack} className="bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors shadow-md">
                            Search Hotels
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}