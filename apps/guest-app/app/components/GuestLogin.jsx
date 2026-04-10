'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const TOP_COUNTRIES = ["Philippines", "South Korea", "China", "United States"];
const ALL_COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Argentina", "Australia", "Canada",
    "France", "Germany", "India", "Indonesia", "Japan", "Malaysia", "Singapore",
    "Taiwan", "Thailand", "United Kingdom", "Vietnam"
];

export default function GuestLogin() {
    const router = useRouter();

    const [formData, setFormData] = useState({
        email: '', first_name: '', last_name: '', phone: '', nationality: ''
    });

    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingDevice, setIsCheckingDevice] = useState(true);

    // 💡 기기 상태 확인: 기기에 '출입증(이메일 식별자)'이 있는지 확인
    useEffect(() => {
        // 기존의 무거운 전체 데이터 저장이 아닌, 가벼운 세션 식별자만 확인
        const sessionKey = localStorage.getItem('nplus_session_key');

        if (sessionKey) {
            // 기기에 인증 키가 있으면, 검증은 서버에 맡기고 메인 화면(PIN 락스크린)으로 넘깁니다.
            router.replace('/');
        } else {
            setIsCheckingDevice(false);
        }
    }, [router]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'first_name' || name === 'last_name') {
            setFormData({ ...formData, [name]: value.toUpperCase() });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (pin.length !== 4) {
            return alert("Please enter a 4-digit PIN.");
        }
        if (pin !== confirmPin) {
            return alert("The PIN numbers do not match.");
        }

        setIsLoading(true);

        try {
            const payload = {
                email: formData.email,
                pin: pin,
                first_name: formData.first_name,
                last_name: formData.last_name,
                phone: formData.phone,
                nationality: formData.nationality
            };

            // 💡 데이터는 모두 대표님의 구글 클라우드 서버(hotelnplus.com API)로 전송되어 영구 저장됩니다.
            const response = await axios.post('https://api.hotelnplus.com/api/members/auth', payload);

            if (response.data.success) {
                // 💡 [핵심 변경] 개인정보를 로컬에 저장하지 않습니다. 
                // 대신, 다음 접속 시 기기를 알아볼 수 있도록 '이메일 식별자'만 세션 키로 보관합니다.
                localStorage.setItem('nplus_session_key', JSON.stringify({ email: formData.email }));

                alert("Membership registration submitted successfully! After review by n+ Rewards, your account will be activated.");

                // 가입 완료 후 메인화면으로 이동
                window.location.href = '/';
            } else {
                alert(response.data.message || "Registration failed. Please try again.");
            }
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || "Error connecting to server. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isCheckingDevice) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <style dangerouslySetInnerHTML={{ __html: `nav, header { display: none !important; } body { padding-bottom: 0 !important; }` }} />
                <div className="text-slate-500 font-bold">Connecting to secure server...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col justify-center selection:bg-[#009900]/20 font-sans bg-slate-50 p-4 md:p-6">

            <style dangerouslySetInnerHTML={{ __html: `nav, header { display: none !important; } body { padding-bottom: 0 !important; }` }} />

            <div className="bg-white p-6 shadow-xl border border-slate-100 rounded-2xl w-full max-w-md mx-auto animate-fade-in-up">
                <div className="text-center mb-8 flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-3 justify-center">
                        <img src="/logo192.png" alt="N+ Logo" className="h-8 w-auto object-contain" />
                        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Rewards</h2>
                    </div>
                    <p className="text-sm font-bold text-slate-500 mt-2 leading-relaxed px-4">
                        Exclusive VIP Membership.<br />
                        Sign up to earn points and auto-fill your bookings.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Email Address</label>
                        <input type="email" name="email" required value={formData.email} onChange={handleChange}
                            className="w-full p-3.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-inner bg-slate-50"
                            placeholder="name@email.com" />
                    </div>

                    <div className="space-y-4 animate-fade-in">
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">First Name</label>
                                <input type="text" name="first_name" required value={formData.first_name} onChange={handleChange}
                                    className="w-full p-3.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-inner bg-slate-50 uppercase" placeholder="JOHN" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Last Name</label>
                                <input type="text" name="last_name" required value={formData.last_name} onChange={handleChange}
                                    className="w-full p-3.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-inner bg-slate-50 uppercase" placeholder="DOE" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Phone Number</label>
                            <input type="tel" name="phone" required value={formData.phone} onChange={handleChange}
                                className="w-full p-3.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-inner bg-slate-50" placeholder="+63 9XX XXX XXXX" />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Nationality</label>
                            <select name="nationality" required value={formData.nationality} onChange={handleChange}
                                className="w-full p-3.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-inner cursor-pointer bg-slate-50">
                                <option value="" disabled>Select Country...</option>
                                <optgroup label="Top Nationalities">
                                    {TOP_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </optgroup>
                                <optgroup label="Other Nationalities">
                                    {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </optgroup>
                            </select>
                        </div>

                        <div className="flex gap-3 pt-3 border-t border-slate-100">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Create PIN</label>
                                <input type="password" required value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))} maxLength="4" inputMode="numeric"
                                    className="w-full p-3.5 border border-slate-200 rounded-xl text-xl tracking-[0.5em] text-center font-bold text-slate-800 focus:border-[#009900] outline-none shadow-inner bg-slate-50" placeholder="••••" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Confirm PIN</label>
                                <input type="password" required value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))} maxLength="4" inputMode="numeric"
                                    className="w-full p-3.5 border border-slate-200 rounded-xl text-xl tracking-[0.5em] text-center font-bold text-slate-800 focus:border-[#009900] outline-none shadow-inner bg-slate-50" placeholder="••••" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-5 pb-2">
                        <button type="submit" disabled={isLoading}
                            className="w-full bg-[#009900] hover:bg-[#008000] text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-green-900/10 transition-colors active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2">
                            {isLoading ? 'Processing...' : 'Apply for VIP Membership'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}