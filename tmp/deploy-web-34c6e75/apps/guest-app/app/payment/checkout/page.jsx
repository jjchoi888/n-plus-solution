'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';

function CheckoutContent() {
    const searchParams = useSearchParams();
    const [checkoutData, setCheckoutData] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [cardNumber, setCardNumber] = useState('');
    const [phoneNum, setPhoneNum] = useState('');

    // 💡 [대리 예약 기능] 체크인 주체 선택 상태 (본인 / 지인)
    const [checkinType, setCheckinType] = useState('self'); // 'self' or 'guest'
    const [guestInfo, setGuestInfo] = useState({
        guestFirstName: '',
        guestLastName: '',
        guestEmail: '',
        guestPhone: ''
    });

    // 2분(120초) 타임아웃 State
    const [timeLeft, setTimeLeft] = useState(120);

    useEffect(() => {
        const dataParam = searchParams.get('data');
        if (dataParam) {
            try {
                setCheckoutData(JSON.parse(atob(dataParam)));
            } catch (e) { }
        }
    }, [searchParams]);

    // 카운트다운 로직
    useEffect(() => {
        if (!checkoutData || timeLeft <= 0) return;

        const timerId = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerId);
                    handleCancelPayment(true); // 0초가 되면 강제 취소!
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timerId);
    }, [checkoutData, timeLeft]);

    // 가예약(Hold) 취소 로직
    const handleCancelPayment = async (isAuto = false) => {
        if (!isAuto && !window.confirm("Are you sure you want to cancel this payment? Your room hold will be released.")) return;

        setIsProcessing(true);
        try {
            await axios.post('https://api.hotelnplus.com/api/public/payment/cancel', {
                res_ids: checkoutData.res_ids
            });
            if (isAuto) alert("Payment session expired. Your reservation hold has been released.");
            window.location.href = "/";
        } catch (e) {
            window.location.href = "/";
        }
    };

    const handlePayNow = async (e) => {
        e.preventDefault();

        // 💡 [대리 예약] 지인 예약일 경우 이름 필수 검사
        if (checkinType === 'guest' && (!guestInfo.guestFirstName || !guestInfo.guestLastName)) {
            return alert("Please enter the guest's First and Last Name.");
        }

        setIsProcessing(true);

        try {
            // 💡 [핵심] 백엔드로 쏠 때 checkin_type과 guest 정보를 몽땅 보냅니다!
            const response = await axios.post('https://api.hotelnplus.com/api/public/payment/process', {
                res_ids: checkoutData.res_ids,
                hotel_code: checkoutData.hotel_code,
                amount: checkoutData.amount,
                points_used: checkoutData.points_used,
                method: checkoutData.method,
                email: checkoutData.customer_email,
                checkin_type: checkinType,
                guest_first_name: guestInfo.guestFirstName,
                guest_last_name: guestInfo.guestLastName,
                guest_email: guestInfo.guestEmail,
                guest_phone: guestInfo.guestPhone
            });

            if (response.data && response.data.success) {
                const successData = btoa(JSON.stringify({
                    ...checkoutData, transaction_id: response.data.transaction_id
                }));
                window.location.href = `/payment/success?data=${successData}`;
            } else {
                alert("Payment processing failed: " + response.data.message);
                setIsProcessing(false);
            }
        } catch (error) {
            alert("Network error during payment. Please try again.");
            setIsProcessing(false);
        }
    };

    if (!checkoutData) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400">Loading Secure Checkout...</div>;

    const isCard = checkoutData.method === 'Credit / Debit Card';
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <button onClick={() => handleCancelPayment(false)} className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-full hover:bg-slate-700 transition-colors text-xl pb-1">
                        ←
                    </button>
                    <div className="font-black text-lg tracking-widest flex items-center gap-2">
                        <span className="text-[#009900]">n+</span> SECURE PAY
                    </div>
                </div>
                <div className={`font-mono font-bold px-3 py-1 rounded-lg border ${timeLeft < 30 ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' : 'border-slate-700 text-slate-300'}`}>
                    ⏱ {minutes}:{seconds.toString().padStart(2, '0')}
                </div>
            </div>

            <div className="flex-1 p-4 md:p-8 flex items-center justify-center pb-24">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200 animate-fade-in-up">
                    <div className="p-6 bg-slate-50 border-b border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{checkoutData.hotel_name}</p>
                        <p className="text-[10px] font-black text-[#009900] bg-green-100 px-2 py-0.5 rounded inline-block mb-2">{checkoutData.total_nights} Night(s)</p>
                        <h2 className="text-3xl font-black text-slate-800">₱ {Number(checkoutData.amount).toLocaleString()}</h2>
                        {checkoutData.points_used > 0 && (
                            <p className="text-[10px] font-bold text-[#009900] mt-2 bg-green-50 w-fit mx-auto px-2 py-0.5 rounded-full border border-green-200">
                                {checkoutData.points_used.toLocaleString()} Points Applied
                            </p>
                        )}
                    </div>

                    <form onSubmit={handlePayNow} className="p-6 space-y-6">

                        {/* 💡 [대리 예약 기능] 체크인 주체 선택 (본인/지인) */}
                        <div className="space-y-4 border-b border-slate-100 pb-6">
                            <h3 className="text-sm font-bold text-slate-800">Who is checking in?</h3>
                            <div className="flex flex-col gap-3">
                                <label className={`border-2 p-3.5 rounded-xl cursor-pointer transition-all flex items-center gap-3 ${checkinType === 'self' ? 'border-[#009900] bg-green-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                                    <input type="radio" name="checkin_type" value="self" checked={checkinType === 'self'} onChange={() => setCheckinType('self')} className="w-5 h-5 accent-[#009900]" />
                                    <div>
                                        <span className="font-black text-sm text-slate-800 block">I am checking in</span>
                                        <span className="text-xs font-bold text-slate-500">Book for myself</span>
                                    </div>
                                </label>
                                <label className={`border-2 p-3.5 rounded-xl cursor-pointer transition-all flex items-center gap-3 ${checkinType === 'guest' ? 'border-[#009900] bg-green-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                                    <input type="radio" name="checkin_type" value="guest" checked={checkinType === 'guest'} onChange={() => setCheckinType('guest')} className="w-5 h-5 accent-[#009900]" />
                                    <div>
                                        <span className="font-black text-sm text-slate-800 block">Booking for someone else</span>
                                        <span className="text-xs font-bold text-slate-500">I am paying for a guest</span>
                                    </div>
                                </label>
                            </div>

                            {/* 💡 지인 정보 폼 (guest 선택 시에만 스르륵 열림) */}
                            {checkinType === 'guest' && (
                                <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 animate-fade-in">
                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-3">Guest Details (Checking-in)</p>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div><input type="text" required value={guestInfo.guestFirstName} onChange={e => setGuestInfo({ ...guestInfo, guestFirstName: e.target.value.toUpperCase() })} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-bold focus:border-[#009900] outline-none uppercase" placeholder="First Name" /></div>
                                        <div><input type="text" required value={guestInfo.guestLastName} onChange={e => setGuestInfo({ ...guestInfo, guestLastName: e.target.value.toUpperCase() })} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-bold focus:border-[#009900] outline-none uppercase" placeholder="Last Name" /></div>
                                    </div>
                                    <div className="mb-3"><input type="email" value={guestInfo.guestEmail} onChange={e => setGuestInfo({ ...guestInfo, guestEmail: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-bold focus:border-[#009900] outline-none" placeholder="Guest Email (Optional)" /></div>
                                    <div><input type="tel" value={guestInfo.guestPhone} onChange={e => setGuestInfo({ ...guestInfo, guestPhone: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-bold focus:border-[#009900] outline-none" placeholder="Guest Phone (Optional)" /></div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="text-2xl">{isCard ? '💳' : '📱'}</span>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase">Payment Method</p>
                                <p className="text-sm font-bold text-slate-800">{checkoutData.method}</p>
                            </div>
                        </div>

                        {/* 결제 수단 폼 */}
                        {isCard ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Card Number</label>
                                    <input
                                        type="text" required maxLength="19" placeholder="0000 0000 0000 0000"
                                        value={cardNumber} onChange={(e) => setCardNumber(e.target.value)}
                                        autoComplete="new-password" name="random_card_field_987"
                                        className="w-full p-3.5 border border-slate-300 rounded-xl font-mono outline-none focus:border-[#009900] text-slate-700 font-black shadow-inner"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Expiry (MM/YY)</label>
                                        <input
                                            type="text" required placeholder="MM/YY"
                                            autoComplete="new-password" name="random_exp_field_456"
                                            className="w-full p-3.5 border border-slate-300 rounded-xl font-mono outline-none focus:border-[#009900] text-slate-700 font-black text-center shadow-inner"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CVC</label>
                                        <input
                                            type="password" required maxLength="4" placeholder="•••"
                                            autoComplete="new-password" name="random_cvc_field_123"
                                            className="w-full p-3.5 border border-slate-300 rounded-xl font-mono outline-none focus:border-[#009900] text-slate-700 font-black tracking-widest text-center shadow-inner"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{checkoutData.method} Mobile Number</label>
                                <input
                                    type="tel" required placeholder="09XX XXX XXXX"
                                    value={phoneNum} onChange={(e) => setPhoneNum(e.target.value)}
                                    autoComplete="new-password" name="random_phone_field_321"
                                    className="w-full p-3.5 border border-slate-300 rounded-xl font-bold outline-none focus:border-[#009900] text-slate-700 font-black shadow-inner"
                                />
                            </div>
                        )}

                        <div className="pt-4">
                            <button type="submit" disabled={isProcessing} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl hover:bg-slate-800 shadow-xl active:scale-95 transition-transform disabled:opacity-50 flex justify-center items-center gap-2 text-lg">
                                {isProcessing ? (
                                    <><span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></span> Processing...</>
                                ) : (
                                    `Pay ₱ ${Number(checkoutData.amount).toLocaleString()}`
                                )}
                            </button>
                        </div>
                        <p className="text-[9px] text-center font-bold text-slate-400 mt-4">
                            🔒 256-bit Encrypted Secure Transaction
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400">Loading Secure Environment...</div>}>
            <CheckoutContent />
        </Suspense>
    );
}