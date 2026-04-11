'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessContent() {
    const searchParams = useSearchParams();
    const [data, setData] = useState(null);
    const dataSaved = useRef(false); // 중복 저장 방지용

    useEffect(() => {
        const dataParam = searchParams.get('data');
        if (dataParam && !dataSaved.current) {
            try {
                const decoded = JSON.parse(atob(dataParam));
                setData(decoded);

                // 💡 1. [My Bookings 연동] 로컬 스토리지에 예약 내역 저장
                const newBooking = {
                    id: decoded.res_ids ? decoded.res_ids[0] : 'REQ-' + Date.now(),
                    hotelName: decoded.hotel_name,
                    checkIn: decoded.check_in_date,
                    checkOut: decoded.check_out_date,
                    rooms: decoded.rooms || { "Room": 1 },
                    totalAmount: decoded.amount,
                    status: 'Confirmed', // 결제 완료 상태
                    createdAt: new Date().toISOString()
                };

                const existingBookings = JSON.parse(localStorage.getItem('nplus_my_bookings') || '[]');
                if (!existingBookings.find(b => b.id === newBooking.id)) {
                    localStorage.setItem('nplus_my_bookings', JSON.stringify([newBooking, ...existingBookings]));
                }

                // 💡 2. [Notifications 연동] 앱 알림 탭에 새 알림 추가
                const newNoti = {
                    id: 'NOTI-' + Date.now(),
                    title: "Booking Confirmed! 🎉",
                    message: `Your payment of ₱${Number(decoded.amount).toLocaleString()} for ${decoded.hotel_name} was successful.`,
                    date: new Date().toISOString(),
                    read: false
                };

                const existingNotis = JSON.parse(localStorage.getItem('nplus_notifications') || '[]');
                if (!existingNotis.find(n => n.title === newNoti.title)) {
                    localStorage.setItem('nplus_notifications', JSON.stringify([newNoti, ...existingNotis]));
                }

                dataSaved.current = true;
            } catch (e) {
                console.error("Invalid success data");
            }
        }
    }, [searchParams]);

    if (!data) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400">Loading receipt...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans selection:bg-[#009900]/20">
            <div className="w-full max-w-md animate-fade-in-up">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-sm border-4 border-white">
                        ✓
                    </div>
                    <h1 className="text-2xl font-black text-slate-800">Booking Confirmed!</h1>
                    <p className="text-sm font-bold text-slate-400 mt-1">Your stay at {data.hotel_name} is secured.</p>
                </div>

                <div className="bg-white rounded-[32px] shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100 relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                    <div className="p-8">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction ID</span>
                            <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">{data.transaction_id || 'N/A'}</span>
                        </div>

                        <div className="space-y-4 border-b border-slate-100 pb-6 mb-6">
                            <div className="flex justify-between">
                                <span className="text-sm font-bold text-slate-400">Hotel</span>
                                <span className="text-sm font-black text-slate-800 truncate pl-4">{data.hotel_name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm font-bold text-slate-400">Reservation ID</span>
                                <span className="text-sm font-black text-emerald-600 uppercase">{data.res_ids ? data.res_ids[0] : 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm font-bold text-slate-400">Payment Method</span>
                                <span className="text-sm font-black text-slate-800">{data.method}</span>
                            </div>
                        </div>

                        <div className="space-y-3 mb-8">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-400">Amount Paid</span>
                                <span className="text-lg font-black text-slate-800">₱ {Number(data.amount).toLocaleString()}</span>
                            </div>
                            {data.points_used > 0 && (
                                <div className="flex justify-between items-center text-emerald-600">
                                    <span className="text-sm font-bold">Points Redeemed</span>
                                    <span className="text-sm font-black">- {data.points_used.toLocaleString()} pts</span>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Confirmation sent to</p>
                            <p className="text-sm font-bold text-slate-700">{data.customer_email}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-10 space-y-3">
                    <Link href="/profile" className="block w-full bg-slate-900 text-white text-center py-4 rounded-2xl font-black text-base shadow-xl hover:bg-slate-800 transition-all active:scale-95">
                        View My Bookings
                    </Link>
                    <Link href="/" className="block w-full bg-white text-slate-500 text-center py-4 rounded-2xl font-black text-base border border-slate-200 hover:bg-slate-50 transition-all active:scale-95">
                        Back to Home
                    </Link>
                </div>
                <p className="text-center text-[10px] text-slate-400 font-bold mt-8 px-10 leading-relaxed">
                    Please present your Digital ID and this receipt upon check-in at the hotel front desk.
                </p>
            </div>
        </div>
    );
}

export default function SuccessPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400">Finalizing your booking...</div>}>
            <SuccessContent />
        </Suspense>
    );
}