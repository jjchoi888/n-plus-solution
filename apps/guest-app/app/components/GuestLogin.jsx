'use client';

import React, { useState } from 'react';
import axios from 'axios';
// 💡 Firebase 인증 라이브러리 추가
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { app } from '../../lib/firebase'; // (주의: Firebase 초기화 파일 위치 - 하단 설명 참고)

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
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // 🚀 1. 이메일 직접 가입/로그인 핸들러
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await axios.post('https://api.hotelnplus.com/api/members/auth', {
                hotel_code: 'NPLUS01',
                email: formData.email,
                first_name: formData.first_name,
                last_name: formData.last_name,
                phone: formData.phone,
                nationality: formData.nationality
            });

            if (response.data.success) {
                const memberData = response.data.member;
                alert(response.data.isNew ? "Membership registration successful!" : "Welcome back!");
                localStorage.setItem('nplus_guest_user', JSON.stringify(memberData));
                // window.location.href = '/'; 
            }
        } catch (error) {
            console.error(error);
            alert("Error connecting to server.");
        } finally {
            setIsLoading(false);
        }
    };

    // 🚀 2. 구글 소셜 로그인 핸들러 (아까 그 코드 적용!)
    const handleGoogleLogin = async () => {
        const auth = getAuth(app);
        const provider = new GoogleAuthProvider();

        try {
            // 1. 구글 팝업 띄우기
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // 2. 구글에서 받은 정보로 우리 백엔드에 회원가입/로그인 처리
            const response = await axios.post('https://api.hotelnplus.com/api/members/auth', {
                hotel_code: 'NPLUS01',
                email: user.email,
                first_name: user.displayName ? user.displayName.split(' ')[0] : 'Guest',
                last_name: user.displayName ? user.displayName.split(' ')[1] || '' : '',
                phone: user.phoneNumber || '',
                nationality: 'Unknown' // 구글에서는 국적을 주지 않으므로 기본값 처리
            });

            if (response.data.success) {
                const memberData = response.data.member;
                alert(response.data.isNew ? "Google Sign-Up Successful!" : "Welcome back!");

                // 고객 기기에 정보 저장 (나중에 예약 시 Autofill 됨)
                localStorage.setItem('nplus_guest_user', JSON.stringify(memberData));
                // window.location.href = '/'; 
            }
        } catch (error) {
            console.error("Google Login Error:", error);
            alert("Google sign-in failed. Please try again.");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
            <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100">
                {/* 💡 [수정] 타이틀 부분을 브랜드 로고 이미지 조합으로 훨씬 전문적으로 변경했습니다. */}
                <div className="text-center mb-8 flex flex-col items-center">
                    {isLoginMode ? (
                        // 로그인 모드일 때 (단순 환영 인사)
                        <h2 className="text-3xl font-black text-slate-800">Welcome Back</h2>
                    ) : (
                        // 💡 회원가입 모드일 때 (브랜드 로고 타이틀)
                        // 이미지 로고(logo192.png)와 Rewards 텍스트를 나란히 중앙 배치합니다.
                        <div className="flex items-center gap-2.5 mb-1 justify-center">
                            <img src="/logo192.png" alt="N+ Logo" className="h-9 w-auto object-contain" />
                            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Rewards</h2>
                        </div>
                    )}
                    <p className="text-slate-500 font-bold mt-2 text-sm">
                        {isLoginMode ? 'Enter your email to continue.' : 'Sign up to earn points and enjoy exclusive perks.'}
                    </p>
                </div>

                {/* 💡 구글 로그인 버튼 추가 */}
                <button
                    onClick={handleGoogleLogin}
                    className="w-full bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 py-3.5 rounded-xl font-black text-base shadow-sm transition-all flex justify-center items-center gap-3 mb-6"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                </button>

                <div className="flex items-center gap-4 mb-6 opacity-60">
                    <div className="flex-1 border-t-2 border-slate-200"></div>
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">OR</span>
                    <div className="flex-1 border-t-2 border-slate-200"></div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Email Address</label>
                        <input type="email" name="email" required value={formData.email} onChange={handleChange}
                            className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:border-blue-500 outline-none transition-colors"
                            placeholder="name@email.com" />
                    </div>

                    {!isLoginMode && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">First Name</label>
                                    <input type="text" name="first_name" required value={formData.first_name} onChange={handleChange}
                                        className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:border-blue-500 outline-none" placeholder="John" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Last Name</label>
                                    <input type="text" name="last_name" required value={formData.last_name} onChange={handleChange}
                                        className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:border-blue-500 outline-none" placeholder="Doe" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Phone Number</label>
                                <input type="tel" name="phone" required value={formData.phone} onChange={handleChange}
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:border-blue-500 outline-none" placeholder="+63 917 123 4567" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Nationality</label>
                                <select name="nationality" required value={formData.nationality} onChange={handleChange}
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:border-blue-500 outline-none cursor-pointer bg-white">
                                    <option value="" disabled>Select Country...</option>
                                    {TOP_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    <option disabled>──────────</option>
                                    {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    <button type="submit" disabled={isLoading}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-black text-lg shadow-lg transition-all mt-6 disabled:opacity-50 flex justify-center items-center gap-2">
                        {isLoading ? 'Processing...' : (isLoginMode ? 'Log In with Email' : 'Sign Up with Email')}
                    </button>
                </form>

                <div className="mt-8 text-center border-t border-slate-100 pt-6">
                    <p className="text-sm font-bold text-slate-500">
                        {isLoginMode ? "Don't have an account? " : "Already a member? "}
                        <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-blue-600 hover:underline font-black cursor-pointer">
                            {isLoginMode ? 'Sign up' : 'Log in'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}