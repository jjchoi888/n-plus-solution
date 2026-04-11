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

    useEffect(() => {
        const dataParam = searchParams.get('data');
        if (dataParam) {
            try {
                const decoded = JSON.parse(atob(dataParam));
                setCheckoutData(decoded);
            } catch (e) {
                console.error("Invalid checkout data");
            }
        }
    }, [searchParams]);

    const handlePayNow = async (e) => {
        e.preventDefault();
        setIsProcessing(true);

        try {
            // 💡 [핵심] 백엔드로 결제 확정 및 포인트 차감 요청을 보냅니다!
            const response = await axios.post('https://api.hotelnplus.com/api/public/payment/process', {
                res_ids: checkoutData.res_ids,
                hotel_code: checkoutData.hotel_code,
                amount: checkoutData.amount,
                points_used: checkoutData.points_used,
                method: checkoutData.method,
                email: checkoutData.customer_email
            });

            if (response.data && response.data.success) {
                // 결제가 성공하면 영수증(Success) 페이지로 이동합니다.
                const successData = btoa(JSON.stringify({
                    ...checkoutData,
                    transaction_id: response.data.transaction_id
                }));
                // 다음 스텝에서 만들 성공 페이지 URL입니다.
                window.location.href = `/payment/success?data=${successData}`;
            } else {
                alert("Payment processing failed: " + response.data.message);
                setIsProcessing(false);
            }
        } catch (error) {
            console.error("Payment Error:", error);
            alert("Network error during payment. Please try again.");
            setIsProcessing(false);
        }
    };

    if (!checkoutData) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400">Loading Secure Checkout...</div>;
    }

    const isCard = checkoutData.method === 'Credit / Debit Card';

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
            {/* 가상 PG 헤더 */}
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
                <div className="font-black text-lg tracking-widest flex items-center gap-2">
                    <span className="text-emerald-500">n+</span> SECURE PAY
                </div>
                <div className="text-[10px] font-bold text-slate-400 border border-slate-700 px-2 py-1 rounded">TEST MODE</div>
            </div>

            <div className="flex-1 p-4 md:p-8 flex items-center justify-center">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200 animate-fade-in-up">
                    <div className="p-6 bg-slate-50 border-b border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{checkoutData.hotel_name}</p>
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

                        {/* 결제 수단에 따른 가짜 입력 폼 */}
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