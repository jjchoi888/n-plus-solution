'use client';

import React, { useState } from 'react';
import axios from 'axios';

const TOP_COUNTRIES = ["Philippines", "South Korea", "China", "United States"];
const ALL_COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Argentina", "Australia", "Canada",
    "France", "Germany", "India", "Indonesia", "Japan", "Malaysia", "Singapore",
    "Taiwan", "Thailand", "United Kingdom", "Vietnam"
];

export default function GuestLogin() {
    const [isLoginMode, setIsLoginMode] = useState(false);
    const [formData, setFormData] = useState({
        email: '', first_name: '', last_name: '', phone: '', nationality: ''
    });

    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'first_name' || name === 'last_name') {
            setFormData({ ...formData, [name]: value.toUpperCase() });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleForgotPin = async () => {
        if (!formData.email) {
            return alert("Please enter your registered email address first to reset your PIN.");
        }

        setIsLoading(true);
        try {
            // 실제 API 엔드포인트 연동 시 주석 해제 (백엔드에 이메일 발송 로직 필요)
            // await axios.post('https://api.hotelnplus.com/api/members/forgot-pin', { email: formData.email });

            // UI 시뮬레이션 용 지연
            await new Promise(resolve => setTimeout(resolve, 800));

            alert(`A PIN reset link has been sent to ${formData.email}. Please check your inbox.`);
        } catch (error) {
            console.error("Forgot PIN Error:", error);
            alert("Failed to send reset link. Please try again or contact support.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (pin.length !== 4) {
            return alert("Please enter a 4-digit PIN.");
        }
        if (!isLoginMode && pin !== confirmPin) {
            return alert("The PIN numbers do not match.");
        }

        setIsLoading(true);

        try {
            const payload = {
                email: formData.email,
                pin: pin,
                ...(isLoginMode ? {} : {
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    phone: formData.phone,
                    nationality: formData.nationality
                })
            };

            const response = await axios.post('https://api.hotelnplus.com/api/members/auth', payload);

            if (response.data.success) {
                const memberData = response.data.member;
                // 예약 시 자동 입력을 위해 회원 정보를 로컬에 저장
                localStorage.setItem('nplus_guest_user', JSON.stringify({
                    ...memberData,
                    pin: pin
                }));

                alert(response.data.isNew ? "Membership registration successful!" : "Welcome back!");
                window.location.href = '/';
            } else {
                alert(response.data.message || "Authentication failed. Please check your Email and PIN.");
            }
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || "Error connecting to server. Invalid PIN or Email.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-80px)] flex flex-col justify-center selection:bg-[#009900]/20 font-sans bg-slate-50 p-4 md:p-6">
            <div className="bg-white p-6 shadow-sm border border-slate-200 rounded-none w-full max-w-md mx-auto">
                <div className="text-center mb-8 flex flex-col items-center">
                    {isLoginMode ? (
                        <h2 className="text-2xl font-bold text-slate-800">Welcome Back</h2>
                    ) : (
                        <div className="flex items-center gap-2 mb-3 justify-center">
                            <img src="/logo192.png" alt="N+ Logo" className="h-8 w-auto object-contain" />
                            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Rewards</h2>
                        </div>
                    )}
                    <p className="text-sm font-bold text-slate-500 mt-2">
                        {isLoginMode ? 'Enter your Email and PIN to log in.' : 'Sign up to earn points and auto-fill your bookings.'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Email Address</label>
                        <input type="email" name="email" required value={formData.email} onChange={handleChange}
                            className="w-full p-3.5 border border-slate-300 rounded-none text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm"
                            placeholder="name@email.com" />
                    </div>

                    {isLoginMode && (
                        <div className="animate-fade-in">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">4-Digit PIN</label>
                            <input type="password" required value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))} maxLength="4" inputMode="numeric"
                                className="w-full p-3.5 border border-slate-300 rounded-none text-2xl tracking-[1em] text-center font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm"
                                placeholder="••••" />
                            <div className="text-right mt-2">
                                <button type="button" onClick={handleForgotPin} disabled={isLoading} className="text-xs text-[#009900] font-bold hover:underline">
                                    Forgot PIN?
                                </button>
                            </div>
                        </div>
                    )}

                    {!isLoginMode && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">First Name</label>
                                    <input type="text" name="first_name" required value={formData.first_name} onChange={handleChange}
                                        className="w-full p-3.5 border border-slate-300 rounded-none text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm uppercase" placeholder="JOHN" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Last Name</label>
                                    <input type="text" name="last_name" required value={formData.last_name} onChange={handleChange}
                                        className="w-full p-3.5 border border-slate-300 rounded-none text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm uppercase" placeholder="DOE" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Phone Number</label>
                                <input type="tel" name="phone" required value={formData.phone} onChange={handleChange}
                                    className="w-full p-3.5 border border-slate-300 rounded-none text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm" placeholder="09XX XXX XXXX" />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Nationality</label>
                                <select name="nationality" required value={formData.nationality} onChange={handleChange}
                                    className="w-full p-3.5 border border-slate-300 rounded-none text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm cursor-pointer bg-white">
                                    <option value="" disabled>Select Country...</option>
                                    <optgroup label="Top Nationalities">
                                        {TOP_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </optgroup>
                                    <optgroup label="Other Nationalities">
                                        {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </optgroup>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-2 border-t border-slate-100">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Create PIN</label>
                                    <input type="password" required value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))} maxLength="4" inputMode="numeric"
                                        className="w-full p-3.5 border border-slate-300 rounded-none text-xl tracking-[0.5em] text-center font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm" placeholder="••••" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Confirm PIN</label>
                                    <input type="password" required value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))} maxLength="4" inputMode="numeric"
                                        className="w-full p-3.5 border border-slate-300 rounded-none text-xl tracking-[0.5em] text-center font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm" placeholder="••••" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 pb-2">
                        <button type="submit" disabled={isLoading}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-none font-bold text-lg shadow-md transition-colors active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2">
                            {isLoading ? 'Processing...' : (isLoginMode ? 'Secure Log In' : 'Sign Up & Save Data')}
                        </button>
                    </div>
                </form>

                <div className="mt-8 text-center border-t border-slate-100 pt-6">
                    <p className="text-sm font-bold text-slate-500">
                        {isLoginMode ? "Don't have an account? " : "Already a member? "}
                        <button onClick={() => {
                            setIsLoginMode(!isLoginMode);
                            setPin('');
                            setConfirmPin('');
                        }} className="text-blue-600 hover:underline font-bold cursor-pointer">
                            {isLoginMode ? 'Sign up' : 'Log in'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}