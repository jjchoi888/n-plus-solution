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

    // 💡 [신규] 2분(120초) 타임아웃 State
    const [timeLeft, setTimeLeft] = useState(120);

    useEffect(() => {
        const dataParam = searchParams.get('data');
        if (dataParam) {
            try {
                setCheckoutData(JSON.parse(atob(dataParam)));
            } catch (e) { }
        }
    }, [searchParams]);

    // 💡 [신규] 카운트다운 로직
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

    // 💡 [신규] 가예약(Hold) 취소 로직
    const handleCancelPayment = async (isAuto = false) => {
        if (!isAuto && !window.confirm("Are you sure you want to cancel this payment? Your room reservation will be released.")) return;

        setIsProcessing(true);
        try {
            // DB에서 가예약 건 삭제 처리
            await axios.post('https://api.hotelnplus.com/api/public/payment/cancel', {
                res_ids: checkoutData.res_ids
            });
            if (isAuto) alert("Payment session expired. Your reservation hold has been released.");
            window.location.href = "/"; // 홈으로 안전하게 돌려보냅니다.
        } catch (e) {
            window.location.href = "/";
        }
    };

    const handlePayNow = async (e) => {
        e.preventDefault();
        setIsProcessing(true);

        try {
            const response = await axios.post('https://api.hotelnplus.com/api/public/payment/process', {
                res_ids: checkoutData.res_ids,
                hotel_code: checkoutData.hotel_code,
                amount: checkoutData.amount,
                points_used: checkoutData.points_used,
                method: checkoutData.method,
                email: checkoutData.customer_email
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
            {/* 💡 [신규] 뒤로가기 버튼과 타이머가 적용된 헤더 */}
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <button onClick={() => handleCancelPayment(false)} className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-full hover:bg-slate-700 transition-colors text-xl pb-1">
                        ←
                    </button>
                    <div className="font-black text-lg tracking-widest flex items-center gap-2">
                        <span className="text-emerald-500">n+</span> SECURE PAY
                    </div>
                </div>
                <div className={`font-mono font-bold px-3 py-1 rounded-lg border ${timeLeft < 30 ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' : 'border-slate-700 text-slate-300'}`}>
                    ⏱ {minutes}:{seconds.toString().padStart(2, '0')}
                </div>
            </div>

            <div className="flex-1 p-4 md:p-8 flex items-center justify-center">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200 animate-fade-in-up">
                    <div className="p-6 bg-slate-50 border-b border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{checkoutData.hotel_name}</p>
                        <p className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded inline-block mb-2">{checkoutData.total_nights} Night(s)</p>
                        <h2 className="text-3xl font-black text-slate-800">₱ {Number(checkoutData.amount).toLocaleString()}</h2>
                        {checkoutData.points_used > 0 && (
                            <p className="text-[10px] font-bold text-emerald-600 mt-2 bg-emerald-50 w-fit mx-auto px-2 py-0.5 rounded-full">
                                {checkoutData.points_used.toLocaleString()} Points Applied
                            </p>
                        )}
                    </div>

                    <form onSubmit={handlePayNow} className="p-6 space-y-5">
                        <div className="flex items-center gap-3 mb-6 bg-blue-50 p-3 rounded-xl border border-blue-100">
                            <span className="text-2xl">{isCard ? '💳' : '📱'}</span>
                            <div>
                                <p className="text-xs font-black text-blue-900 uppercase">Payment Method</p>
                                <p className="text-sm font-bold text-blue-700">{checkoutData.method}</p>
                            </div>
                        </div>

                        {isCard ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Card Number</label>
                                    <input type="text" required maxLength="19" placeholder="0000 0000 0000 0000" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl font-mono outline-none focus:border-slate-800" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Expiry (MM/YY)</label>
                                        <input type="text" required placeholder="12/26" className="w-full p-3 border border-slate-300 rounded-xl font-mono outline-none focus:border-slate-800" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CVC</label>
                                        <input type="password" required maxLength="3" placeholder="•••" className="w-full p-3 border border-slate-300 rounded-xl font-mono outline-none focus:border-slate-800" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{checkoutData.method} Mobile Number</label>
                                <input type="tel" required placeholder="09XX XXX XXXX" value={phoneNum} onChange={(e) => setPhoneNum(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl font-bold outline-none focus:border-slate-800" />
                            </div>
                        )}

                        <div className="pt-4">
                            <button type="submit" disabled={isProcessing} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl hover:bg-slate-800 shadow-lg active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2 text-lg">
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