'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { app } from '../../lib/firebase';

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
                window.location.href = '/';
            }
        } catch (error) {
            console.error(error);
            alert("Error connecting to server.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        const auth = getAuth(app);
        const provider = new GoogleAuthProvider();

        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            const response = await axios.post('https://api.hotelnplus.com/api/members/auth', {
                hotel_code: 'NPLUS01',
                email: user.email,
                first_name: user.displayName ? user.displayName.split(' ')[0] : 'Guest',
                last_name: user.displayName ? user.displayName.split(' ')[1] || '' : '',
                phone: user.phoneNumber || '',
                nationality: 'Unknown'
            });

            if (response.data.success) {
                localStorage.setItem('nplus_guest_user', JSON.stringify(response.data.member));

                if (response.data.isNew) {
                    alert('Welcome! Your N+ Rewards account has been created.');
                } else {
                    alert('Welcome back!');
                }

                window.location.href = '/';
            }
        } catch (error) {
            console.error("Google Login Error:", error);
            alert("Google sign-in failed. Please try again.");
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
                        {isLoginMode ? 'Enter your email to continue.' : 'Sign up to earn points and enjoy exclusive perks.'}
                    </p>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 p-3.5 rounded-none shadow-sm hover:bg-slate-50 transition-colors mb-6"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    <span className="font-bold text-slate-700">Continue with Google</span>
                </button>

                <div className="relative flex items-center justify-center mb-6">
                    <div className="border-t border-slate-200 w-full absolute"></div>
                    <span className="bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest relative z-10">OR</span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Email Address</label>
                        <input type="email" name="email" required value={formData.email} onChange={handleChange}
                            className="w-full p-3.5 border border-slate-300 rounded-none text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm"
                            placeholder="name@email.com" />
                    </div>

                    {!isLoginMode && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">First Name</label>
                                    <input type="text" name="first_name" required value={formData.first_name} onChange={handleChange}
                                        className="w-full p-3.5 border border-slate-300 rounded-none text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm" placeholder="John" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Last Name</label>
                                    <input type="text" name="last_name" required value={formData.last_name} onChange={handleChange}
                                        className="w-full p-3.5 border border-slate-300 rounded-none text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm" placeholder="Doe" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Phone Number</label>
                                <input type="tel" name="phone" required value={formData.phone} onChange={handleChange}
                                    className="w-full p-3.5 border border-slate-300 rounded-none text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm" placeholder="09" />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Nationality</label>
                                <select name="nationality" required value={formData.nationality} onChange={handleChange}
                                    className="w-full p-3.5 border border-slate-300 rounded-none text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm cursor-pointer bg-white">
                                    <option value="" disabled>Select Country...</option>
                                    {TOP_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    <option disabled>──────────</option>
                                    {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 pb-2">
                        <button type="submit" disabled={isLoading}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-none font-bold text-lg shadow-md transition-colors active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2">
                            {isLoading ? 'Processing...' : (isLoginMode ? 'Log In with Email' : 'Sign Up with Email')}
                        </button>
                    </div>
                </form>

                <div className="mt-8 text-center border-t border-slate-100 pt-6">
                    <p className="text-sm font-bold text-slate-500">
                        {isLoginMode ? "Don't have an account? " : "Already a member? "}
                        <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-blue-600 hover:underline font-bold cursor-pointer">
                            {isLoginMode ? 'Sign up' : 'Log in'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}