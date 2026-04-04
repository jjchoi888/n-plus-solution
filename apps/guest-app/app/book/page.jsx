'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';

const TOP_COUNTRIES = ["Philippines", "South Korea", "China", "United States"];
const ALL_COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Argentina", "Australia", "Canada",
    "France", "Germany", "India", "Indonesia", "Japan", "Malaysia", "Singapore",
    "Taiwan", "Thailand", "United Kingdom", "Vietnam"
];

// 기본 날짜 계산 헬퍼 함수
const getDefaultDate = (offsetDays = 0) => {
    const now = new Date();
    now.setDate(now.getDate() + offsetDays);
    return now.toISOString().split('T')[0];
};

export default function BookRoomPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [roomTypes, setRoomTypes] = useState([{ id: 1, name: 'Standard' }, { id: 2, name: 'Deluxe' }, { id: 3, name: 'Suite' }]); // 임시 하드코딩 (추후 API 연동 가능)

    // 예약 및 고객 정보 State
    const [bookingData, setBookingData] = useState({
        check_in_date: getDefaultDate(0),
        check_out_date: getDefaultDate(1),
        room_type: 'Standard',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        nationality: ''
    });

    // 💡 [핵심] 페이지 로드 시 로컬 스토리지에서 유저 정보를 가져와 Autofill 실행!
    useEffect(() => {
        const savedUser = localStorage.getItem('nplus_guest_user');
        if (savedUser) {
            const user = JSON.parse(savedUser);
            setIsLoggedIn(true);
            setBookingData(prev => ({
                ...prev,
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                email: user.email || '',
                phone: user.phone || '',
                nationality: user.nationality || ''
            }));
        }

        // (선택) 백엔드에서 실제 룸타입 목록을 가져오는 로직
        // axios.get('http://localhost:8000/api/room-types').then(res => setRoomTypes(res.data)).catch(console.error);
    }, []);

    const handleChange = (e) => {
        setBookingData({ ...bookingData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 날짜 유효성 검사 (Check-out은 Check-in 이후여야 함)
        if (bookingData.check_in_date >= bookingData.check_out_date) {
            return alert("Check-out date must be after Check-in date.");
        }

        setIsLoading(true);

        try {
            // 백엔드의 예약 생성 API 호출 (Front.jsx의 handleCreateReservation과 동일한 페이로드)
            const payload = {
                hotel_code: 'NPLUS01',
                channel: 'Hotel Web', // B2C 앱을 통한 예약임을 명시
                room_type: bookingData.room_type,
                check_in_date: bookingData.check_in_date,
                check_out_date: bookingData.check_out_date,
                guest_name: `${bookingData.first_name} ${bookingData.last_name}`.trim(),
                email: bookingData.email,
                phone: bookingData.phone,
                nationality: bookingData.nationality
            };

            const response = await axios.post('https://api.hotelnplus.com/api/reservations/create', payload);

            if (response.data.success || response.status === 200 || response.status === 201) {
                alert("Booking confirmed successfully! We look forward to your stay.");
                // 예약 완료 후 메인 홈으로 이동
                window.location.href = '/';
            } else {
                alert("Failed to confirm booking. Please try again.");
            }
        } catch (error) {
            console.error("Booking Error:", error);
            alert("Network error occurred while processing your booking. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="pb-24 font-sans bg-slate-50 min-h-screen">
            {/* 상단 헤더 (뒤로가기 포함) */}
            <div className="bg-white px-4 py-4 flex items-center gap-3 sticky top-0 z-40 border-b border-slate-100 shadow-sm">
                <Link href="/" className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-600 font-bold hover:bg-slate-200">
                    ←
                </Link>
                <h1 className="text-lg font-black text-slate-800">Book Your Stay</h1>
            </div>

            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-6">

                {/* 1. Stay Details (숙박 일정 및 객실) */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                        <span className="text-lg">📅</span> Stay Details
                    </h2>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Check-in</label>
                            <input type="date" name="check_in_date" required value={bookingData.check_in_date} onChange={handleChange}
                                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:border-blue-500 outline-none bg-slate-50" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Check-out</label>
                            <input type="date" name="check_out_date" required value={bookingData.check_out_date} onChange={handleChange}
                                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:border-blue-500 outline-none bg-slate-50" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Room Type</label>
                        <select name="room_type" required value={bookingData.room_type} onChange={handleChange}
                            className="w-full p-3 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:border-blue-500 outline-none bg-white cursor-pointer shadow-sm">
                            {roomTypes.map(rt => (
                                <option key={rt.id} value={rt.name}>{rt.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 2. Guest Information (고객 정보 - Autofill 영역) */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                    {/* 로그인 시 자동 완성 뱃지 표시 */}
                    {isLoggedIn && (
                        <div className="absolute top-0 right-0 bg-blue-100 text-blue-700 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl border-l border-b border-blue-200">
                            ✨ Autofilled from profile
                        </div>
                    )}

                    <h2 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 mt-2">
                        <span className="text-lg">👤</span> Guest Information
                    </h2>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">First Name</label>
                                <input type="text" name="first_name" required value={bookingData.first_name} onChange={handleChange}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:border-blue-500 outline-none" placeholder="John" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Last Name</label>
                                <input type="text" name="last_name" required value={bookingData.last_name} onChange={handleChange}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:border-blue-500 outline-none" placeholder="Doe" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Email Address</label>
                            <input type="email" name="email" required value={bookingData.email} onChange={handleChange}
                                className={`w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none ${isLoggedIn ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'text-slate-800'}`}
                                placeholder="name@email.com" readOnly={isLoggedIn} />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Phone Number</label>
                            <input type="tel" name="phone" required value={bookingData.phone} onChange={handleChange}
                                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:border-blue-500 outline-none" placeholder="+63 917 123 4567" />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Nationality</label>
                            <select name="nationality" required value={bookingData.nationality} onChange={handleChange}
                                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:border-blue-500 outline-none bg-white cursor-pointer">
                                <option value="" disabled>Select Country...</option>
                                {TOP_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                <option disabled>──────────</option>
                                {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* 비로그인 유저 리워드 가입 유도 문구 */}
                {!isLoggedIn && (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
                        <div>
                            <p className="text-xs font-black text-blue-800 mb-0.5">Want to earn points?</p>
                            <p className="text-[10px] font-bold text-blue-600">Log in to autofill and earn rewards.</p>
                        </div>
                        <Link href="/login" className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black px-3 py-2 rounded-lg transition-colors">
                            Log In
                        </Link>
                    </div>
                )}

                {/* 3. 하단 고정 예약 확정 버튼 */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-50">
                    <div className="max-w-md mx-auto">
                        <button type="submit" disabled={isLoading} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black text-lg shadow-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2">
                            {isLoading ? (
                                <><span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full inline-block"></span> Processing...</>
                            ) : (
                                'Confirm Booking ➔'
                            )}
                        </button>
                    </div>
                </div>

            </form>
        </div>
    );
}