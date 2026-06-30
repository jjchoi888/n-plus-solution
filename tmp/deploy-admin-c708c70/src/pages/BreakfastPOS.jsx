'use client';

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function BreakfastPOS() {
    // ====================================================
    // 🔒 1. 식음료(F&B) POS 전용 로그인 잠금장치
    // ====================================================
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return sessionStorage.getItem('bfPosAuthed') === 'true';
    });

    // 이전에 로그인했던 호텔 코드를 기억하도록 localStorage 활용
    const [loginHotelCode, setLoginHotelCode] = useState(localStorage.getItem('hotelCode') || '');
    const [loginId, setLoginId] = useState('');
    const [loginPwd, setLoginPwd] = useState('');
    const [currentHotelCode, setCurrentHotelCode] = useState(sessionStorage.getItem('hotelCode') || '');

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!loginHotelCode || !loginId || !loginPwd) {
            return alert("Please enter Hotel Code, Staff ID, and Password.");
        }

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hotel_code: loginHotelCode,
                    user_id: loginId,
                    username: loginId,
                    password: loginPwd
                })
            });
            const data = await res.json();

            if (data.success) {
                const role = (data.user?.role || data.role || data.employee?.role || '').toUpperCase();
                // 💡 프론트데스크, 관리자뿐만 아니라 식음료(RESTAURANT, F&B) 직급도 접근 가능하도록 허용
                const isAuthorized = role.includes('FRONT') || role.includes('RECEPTION') || role.includes('MANAGER') || role.includes('ADMIN') || role === 'SUPER_ADMIN' || role.includes('RESTAURANT') || role.includes('F&B') || role.includes('FOOD');

                if (isAuthorized) {
                    sessionStorage.setItem('bfPosAuthed', 'true');
                    sessionStorage.setItem('hotelCode', loginHotelCode);
                    localStorage.setItem('hotelCode', loginHotelCode); // 다음 로그인을 위해 저장

                    setCurrentHotelCode(loginHotelCode);
                    setIsAuthenticated(true);
                } else {
                    alert(`❌ Access Denied: You do not have permission to access Breakfast POS.\n(Current Role: ${role})`);
                }
            } else {
                alert("❌ Authentication Failed: Please check your Hotel Code, ID, or Password.");
            }
        } catch (e) {
            console.error("Login Error:", e);
            alert("❌ Server communication error occurred.");
        }
    };

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to log out?")) {
            sessionStorage.removeItem('bfPosAuthed');
            setIsAuthenticated(false);
            setLoginId('');
            setLoginPwd('');
            setRoomInput('');
            setGuestStatus(null);
        }
    };

    // ====================================================
    // 🍳 2. 기존 조식 POS 로직
    // ====================================================
    const [roomInput, setRoomInput] = useState('');
    const [guestStatus, setGuestStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    const handleNumpad = (num) => {
        if (roomInput.length < 5) {
            setRoomInput(prev => prev + num);
            setGuestStatus(null);
        }
    };

    const handleDelete = () => {
        setRoomInput(prev => prev.slice(0, -1));
        setGuestStatus(null);
    };

    const handleClear = () => {
        setRoomInput('');
        setGuestStatus(null);
    };

    const checkBreakfast = async () => {
        if (!roomInput || !currentHotelCode) return;
        setIsLoading(true);

        try {
            const response = await fetch(`/api/breakfast/check?hotel=${currentHotelCode}&room=${roomInput}`);
            if (!response.ok) throw new Error("Server error");

            const data = await response.json();
            setGuestStatus(data);
        } catch (error) {
            console.error("Breakfast check failed:", error);
            setGuestStatus({ status: 'ERROR' });
        } finally {
            setIsLoading(false);
        }
    };

    const consumeBreakfast = async () => {
        if (!guestStatus || guestStatus.status !== 'INCLUDED') return;

        const confirmConsume = window.confirm(`Mark breakfast as consumed for Room ${roomInput}?`);
        if (!confirmConsume) return;

        try {
            const response = await fetch('/api/breakfast/consume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room: roomInput, hotel: currentHotelCode })
            });
            const data = await response.json();

            if (data.success) {
                setGuestStatus(prev => ({
                    ...prev,
                    status: 'CONSUMED',
                    time: data.time
                }));
            } else {
                throw new Error("Update failed");
            }
        } catch (error) {
            alert("An error occurred during processing. Please try again.");
        }
    };

    const handlePayment = async (paymentType) => {
        if (!guestStatus || guestStatus.status !== 'NOT_INCLUDED') return;

        const confirmMsg = paymentType === 'ROOM_CHARGE'
            ? `Post breakfast charge to Room ${roomInput}?`
            : `Confirm cash/card payment for Room ${roomInput}?`;

        if (!window.confirm(confirmMsg)) return;

        setIsProcessingPayment(true);
        try {
            const response = await fetch('/api/breakfast/pay_and_consume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room: roomInput, type: paymentType, hotel: currentHotelCode })
            });
            const data = await response.json();

            if (data.success) {
                setGuestStatus(prev => ({
                    ...prev,
                    status: 'PAID_SUCCESS',
                    time: data.time,
                    paymentMethod: data.method
                }));
            } else {
                throw new Error("Payment failed");
            }
        } catch (error) {
            alert("Payment processing failed. Please try again.");
        } finally {
            setIsProcessingPayment(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter') checkBreakfast();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [roomInput]);

    // ====================================================
    // 🎨 3. 화면 렌더링
    // ====================================================

    // ⛔ 로그인 안 된 상태일 경우 뜨는 로그인 화면 (오렌지/앰버 톤)
    if (!isAuthenticated) {
        return (
            <div className="h-screen w-screen bg-slate-900 flex items-center justify-center font-sans select-none relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=2000')] bg-cover bg-center mix-blend-overlay"></div>
                <div className="bg-white/10 backdrop-blur-xl p-10 rounded-[2rem] shadow-2xl border border-white/20 w-full max-w-md relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 bg-amber-500 rounded-md flex items-center justify-center text-4xl mb-6 shadow-lg">🍳</div>
                    <h1 className="text-3xl font-black text-white tracking-widest mb-2 uppercase text-center">Breakfast<br />POS</h1>
                    <p className="text-amber-200 font-bold mb-8 tracking-widest text-sm">Restaurant Staff Authentication</p>

                    <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
                        <input
                            type="text"
                            placeholder="Hotel Code (ex: NPLUS01)"
                            value={loginHotelCode}
                            onChange={(e) => setLoginHotelCode(e.target.value)}
                            className="w-full bg-black/40 border border-amber-500/50 text-amber-100 placeholder:text-amber-200/50 p-4 rounded-md text-center font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <input
                            type="text"
                            placeholder="Staff ID"
                            value={loginId}
                            onChange={(e) => setLoginId(e.target.value)}
                            className="w-full bg-black/30 border border-white/10 text-white placeholder:text-slate-400 p-4 rounded-md text-center font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={loginPwd}
                            onChange={(e) => setLoginPwd(e.target.value)}
                            className="w-full bg-black/30 border border-white/10 text-white placeholder:text-slate-400 p-4 rounded-md text-center text-xl tracking-[0.5em] font-black focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black text-lg py-4 rounded-md mt-4 shadow-lg transition-colors tracking-widest uppercase">
                            Unlock POS
                        </button>
                    </form>

                    <div className="mt-6">
                        <Link to="/" className="text-slate-300 hover:text-white text-sm font-bold border-b border-transparent hover:border-white transition-all">
                            ← Back to Main Menu
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ✅ 로그인 성공 시 보여지는 메인 화면
    return (
        <div className="min-h-screen bg-slate-100 font-sans flex flex-col relative">
            {/* 상단 네비게이션 */}
            <div className="bg-amber-500 text-white p-4 md:p-6 shadow-md flex justify-between items-center z-10 shrink-0">
                <div>
                    <h1 className="text-xl md:text-3xl font-black flex items-center gap-2 md:gap-3">
                        🍳 Breakfast POS <span className="text-sm bg-amber-700 px-2 py-1 rounded ml-2">{currentHotelCode}</span>
                    </h1>
                </div>
                <div className="flex gap-2">
                    {/* 💡 로그아웃 기능 추가 */}
                    <button onClick={handleLogout} className="bg-amber-600 border border-amber-400 px-4 py-2 rounded-md font-bold hover:bg-amber-700 transition-colors text-sm md:text-base shrink-0">
                        🔒 Lock
                    </button>
                    <Link to="/" className="bg-amber-700 border border-amber-600 px-4 md:px-6 py-2.5 md:py-2 rounded-md font-bold hover:bg-amber-800 transition-colors text-sm md:text-base shrink-0">🏠 Exit</Link>
                </div>
            </div>

            {/* 메인 화면 (좌측: 넘패드, 우측: 검증 결과) */}
            <div className="flex-1 flex flex-col md:flex-row p-4 md:p-8 gap-6 md:gap-10 max-w-7xl mx-auto w-full">

                {/* 📱 좌측: 터치 넘패드 */}
                <div className="w-full md:w-1/2 flex flex-col bg-white p-6 md:p-10 rounded-2xl shadow-xl border border-slate-200 justify-center">
                    <div className="text-center mb-6">
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-sm mb-2">Enter Room Number</p>
                        <div className="text-5xl md:text-6xl font-black text-slate-800 bg-slate-50 border-b-4 border-slate-300 py-4 rounded-t-xl h-24 flex items-center justify-center tracking-widest">
                            {roomInput || <span className="text-slate-300 opacity-50">___</span>}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 md:gap-4 flex-1 max-h-[400px]">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button
                                key={num}
                                onClick={() => handleNumpad(num.toString())}
                                className="bg-slate-100 hover:bg-slate-200 active:bg-amber-100 text-slate-800 text-3xl font-black rounded-xl shadow-sm border border-slate-200 transition-all active:scale-95"
                            >
                                {num}
                            </button>
                        ))}
                        <button onClick={handleClear} className="bg-red-50 hover:bg-red-100 text-red-600 text-xl font-black rounded-xl shadow-sm border border-red-200 transition-all active:scale-95 uppercase">CLR</button>
                        <button onClick={() => handleNumpad('0')} className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-3xl font-black rounded-xl shadow-sm border border-slate-200 transition-all active:scale-95">0</button>
                        <button onClick={handleDelete} className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-2xl font-black rounded-xl shadow-sm border border-slate-200 transition-all active:scale-95">⌫</button>
                    </div>

                    <button
                        onClick={checkBreakfast}
                        disabled={!roomInput || isLoading}
                        className={`mt-4 w-full py-5 rounded-xl font-black text-2xl uppercase tracking-wider shadow-lg transition-all active:scale-95 ${roomInput ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                        {isLoading ? 'Checking...' : 'Check Status'}
                    </button>
                </div>

                {/* 🎯 우측: 검증 결과 화면 */}
                <div className="w-full md:w-1/2 flex flex-col justify-center">
                    {!guestStatus && !isLoading && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-40">
                            <div className="text-8xl mb-6 grayscale">🍽️</div>
                            <h2 className="text-2xl font-black text-slate-600">Awaiting Input</h2>
                            <p className="text-slate-500 mt-2 font-bold">Please enter a room number to verify breakfast eligibility.</p>
                        </div>
                    )}

                    {isLoading && (
                        <div className="h-full flex flex-col items-center justify-center">
                            <div className="animate-spin text-6xl mb-4">⏳</div>
                            <h2 className="text-xl font-bold text-slate-600">Verifying Database...</h2>
                        </div>
                    )}

                    {/* ✅ 조식 포함 (초록색) */}
                    {guestStatus?.status === 'INCLUDED' && (
                        <div className="bg-emerald-50 border-4 border-emerald-500 rounded-3xl p-8 md:p-12 shadow-2xl flex flex-col items-center text-center animate-fade-in relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-4 bg-emerald-500 animate-pulse"></div>
                            <div className="w-32 h-32 bg-emerald-100 rounded-full flex items-center justify-center text-6xl mb-6 shadow-inner">✅</div>
                            <h2 className="text-4xl md:text-5xl font-black text-emerald-600 mb-2">INCLUDED</h2>
                            <p className="text-emerald-800 font-bold text-lg mb-8 uppercase tracking-widest">Breakfast Approved</p>

                            <div className="w-full bg-white rounded-xl p-6 shadow-sm border border-emerald-200 mb-8 text-left">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-slate-500 font-bold uppercase text-xs">Room</span>
                                    <span className="text-2xl font-black text-slate-800">{roomInput}</span>
                                </div>
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-slate-500 font-bold uppercase text-xs">Guest</span>
                                    <span className="text-lg font-bold text-slate-800">{guestStatus.guestName}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-bold uppercase text-xs">Guests (Pax)</span>
                                    <span className="text-lg font-bold text-slate-800">{guestStatus.pax} Persons</span>
                                </div>
                            </div>

                            <button
                                onClick={consumeBreakfast}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-xl font-black text-2xl shadow-xl transition-transform active:scale-95 flex justify-center items-center gap-3"
                            >
                                🍽️ Mark as Consumed
                            </button>
                        </div>
                    )}

                    {/* ❌ 조식 불포함 (결제 모드 - 빨간색) */}
                    {guestStatus?.status === 'NOT_INCLUDED' && (
                        <div className="bg-red-50 border-4 border-red-500 rounded-3xl p-8 md:p-10 shadow-2xl flex flex-col items-center text-center animate-fade-in relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-4 bg-red-500"></div>
                            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center text-5xl mb-4 shadow-inner">❌</div>
                            <h2 className="text-3xl md:text-4xl font-black text-red-600 mb-2">NO BREAKFAST</h2>
                            <p className="text-red-800 font-bold text-sm md:text-base mb-6 uppercase tracking-widest">Not Included in Package</p>

                            <div className="w-full bg-white rounded-xl p-4 shadow-sm border border-red-200 mb-6 text-left">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-slate-500 font-bold uppercase text-xs">Room</span>
                                    <span className="text-xl font-black text-slate-800">{roomInput}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-bold uppercase text-xs">Guest</span>
                                    <span className="text-base font-bold text-slate-800">{guestStatus.guestName}</span>
                                </div>
                            </div>

                            <div className="w-full flex flex-col gap-3">
                                <button
                                    onClick={() => handlePayment('ROOM_CHARGE')}
                                    disabled={isProcessingPayment}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-black shadow-md active:scale-95 transition-all flex justify-center items-center gap-2"
                                >
                                    {isProcessingPayment ? 'Processing...' : '💳 Charge to Room'}
                                </button>
                                <button
                                    onClick={() => handlePayment('DIRECT_PAY')}
                                    disabled={isProcessingPayment}
                                    className="w-full bg-slate-800 hover:bg-slate-900 text-white py-4 rounded-xl font-black shadow-md active:scale-95 transition-all flex justify-center items-center gap-2"
                                >
                                    {isProcessingPayment ? 'Processing...' : '💵 Paid Cash / Card'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 🔵 결제 및 사용 승인 완료 (파란색) */}
                    {guestStatus?.status === 'PAID_SUCCESS' && (
                        <div className="bg-blue-50 border-4 border-blue-500 rounded-3xl p-8 md:p-12 shadow-2xl flex flex-col items-center text-center animate-fade-in relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-4 bg-blue-500"></div>
                            <div className="w-32 h-32 bg-blue-100 rounded-full flex items-center justify-center text-6xl mb-6 shadow-inner">💳</div>
                            <h2 className="text-3xl md:text-4xl font-black text-blue-600 mb-2">PAYMENT SUCCESS</h2>
                            <p className="text-blue-800 font-bold text-lg mb-8 uppercase tracking-widest">Guest May Enter</p>

                            <div className="w-full bg-white rounded-xl p-6 shadow-sm border border-blue-200 text-left">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-slate-500 font-bold uppercase text-xs">Room</span>
                                    <span className="text-2xl font-black text-slate-800">{roomInput}</span>
                                </div>
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-slate-500 font-bold uppercase text-xs">Method</span>
                                    <span className="text-lg font-black text-blue-600">{guestStatus.paymentMethod}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-blue-600 font-black uppercase text-xs">Time</span>
                                    <span className="text-xl font-black text-blue-600">{guestStatus.time}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ⚠️ 이미 사용함 (주황색) */}
                    {guestStatus?.status === 'CONSUMED' && (
                        <div className="bg-orange-50 border-4 border-orange-500 rounded-3xl p-8 md:p-12 shadow-2xl flex flex-col items-center text-center animate-fade-in relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-4 bg-orange-500"></div>
                            <div className="w-32 h-32 bg-orange-100 rounded-full flex items-center justify-center text-6xl mb-6 shadow-inner">⚠️</div>
                            <h2 className="text-3xl md:text-4xl font-black text-orange-600 mb-2">ALREADY CONSUMED</h2>
                            <p className="text-orange-800 font-bold text-lg mb-8 uppercase tracking-widest">Duplicate Entry Warning</p>

                            <div className="w-full bg-white rounded-xl p-6 shadow-sm border border-orange-200 text-left">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-slate-500 font-bold uppercase text-xs">Room</span>
                                    <span className="text-2xl font-black text-slate-800">{roomInput}</span>
                                </div>
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-slate-500 font-bold uppercase text-xs">Guest</span>
                                    <span className="text-lg font-bold text-slate-800">{guestStatus.guestName}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-orange-600 font-black uppercase text-xs">Consumed Time</span>
                                    <span className="text-xl font-black text-orange-600">{guestStatus.time}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ❓ 객실 없음 */}
                    {guestStatus?.status === 'NOT_FOUND' && (
                        <div className="bg-slate-200 border-4 border-slate-400 rounded-3xl p-8 md:p-12 shadow-2xl flex flex-col items-center text-center animate-fade-in">
                            <div className="text-6xl mb-4">❓</div>
                            <h2 className="text-3xl font-black text-slate-700 mb-2">ROOM NOT FOUND</h2>
                            <p className="text-slate-500 font-bold">Please check the room number and try again.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}