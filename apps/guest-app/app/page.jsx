'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function HomePage() {
    const [user, setUser] = useState(null);
    const [isMembershipActive, setIsMembershipActive] = useState(false);

    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardStep, setOnboardStep] = useState(1);

    const [phone, setPhone] = useState('');
    const [idUploaded, setIdUploaded] = useState(false);
    const [cardNum, setCardNum] = useState('');
    const [cardExp, setCardExp] = useState('');
    const [cardCvv, setCardCvv] = useState('');

    useEffect(() => {
        const savedUser = localStorage.getItem('nplus_guest_user');
        if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);
            if (parsedUser.is_membership_active) {
                setIsMembershipActive(true);
            }
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('nplus_guest_user');
        setUser(null);
        setIsMembershipActive(false);
        window.location.reload();
    };

    const startOnboarding = () => {
        setShowOnboarding(true);
        setOnboardStep(1);
    };

    const nextStep = () => {
        if (onboardStep === 1 && !phone) return alert('Please enter your phone number.');
        if (onboardStep === 2 && !idUploaded) return alert('Please upload your ID card for verification.');
        if (onboardStep === 3 && (!cardNum || !cardExp || !cardCvv)) return alert('Please enter your card details.');

        if (onboardStep < 3) {
            setOnboardStep(onboardStep + 1);
        } else {
            completeOnboarding();
        }
    };

    const completeOnboarding = () => {
        const updatedUser = {
            ...user,
            phone: phone,
            is_membership_active: true,
            tier_id: 2,
            total_points: 1000
        };
        localStorage.setItem('nplus_guest_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setIsMembershipActive(true);
        setShowOnboarding(false);
        alert('Welcome to N+ Rewards! 1,000 Bonus Points have been added to your account.');
    };

    if (showOnboarding) {
        return (
            <div className="fixed inset-0 bg-slate-50 z-50 overflow-y-auto flex flex-col font-sans">
                <div className="bg-white p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                    <button onClick={() => setShowOnboarding(false)} className="text-slate-400 font-black text-xl px-2">✕</button>
                    <h2 className="font-black text-slate-800 text-lg">Join Membership</h2>
                    <span className="text-[#009900] font-black text-xs">Step {onboardStep} / 3</span>
                </div>

                <div className="p-6 flex-1 flex flex-col max-w-md mx-auto w-full">

                    <div className="flex gap-2 mb-8">
                        <div className={`h-1.5 flex-1 ${onboardStep >= 1 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
                        <div className={`h-1.5 flex-1 ${onboardStep >= 2 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
                        <div className={`h-1.5 flex-1 ${onboardStep >= 3 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
                    </div>

                    {onboardStep === 1 && (
                        <div className="animate-fade-in-up flex-1">
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Exclusive Benefits</h3>
                            <p className="text-slate-500 text-sm font-bold mb-6">Complete your profile to unlock these rewards.</p>

                            <div className="bg-white border border-slate-200 p-5 shadow-sm mb-8 space-y-4">
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">🎁</span>
                                    <div>
                                        <p className="font-black text-slate-800 text-sm">Earn Reward Points</p>
                                        <p className="text-xs text-slate-500 font-bold">Get 10% back in points on every booking.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">🛏️</span>
                                    <div>
                                        <p className="font-black text-slate-800 text-sm">Free Room Upgrades</p>
                                        <p className="text-xs text-slate-500 font-bold">Subject to availability upon check-in.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">🕒</span>
                                    <div>
                                        <p className="font-black text-slate-800 text-sm">Late Check-out</p>
                                        <p className="text-xs text-slate-500 font-bold">Enjoy your stay longer, up to 2:00 PM.</p>
                                    </div>
                                </div>
                            </div>

                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Phone Number</label>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+63 917 123 4567" className="w-full p-4 border border-slate-300 text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm rounded-none" />
                        </div>
                    )}

                    {onboardStep === 2 && (
                        <div className="animate-fade-in-up flex-1">
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Identity Verification</h3>
                            <p className="text-slate-500 text-sm font-bold mb-6">Please upload a valid ID for security and age verification.</p>

                            <div className="border-2 border-dashed border-slate-300 bg-white p-8 text-center relative hover:border-[#009900] transition-colors cursor-pointer">
                                <input type="file" accept="image/*" onChange={(e) => { if (e.target.files.length > 0) setIdUploaded(true) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <div className="text-5xl mb-3">🪪</div>
                                {idUploaded ? (
                                    <p className="text-[#009900] font-black text-lg">ID Uploaded Successfully ✓</p>
                                ) : (
                                    <>
                                        <p className="font-black text-slate-800 text-lg mb-1">Tap to Upload ID</p>
                                        <p className="text-xs font-bold text-slate-400">Passport, Driver's License, or National ID</p>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {onboardStep === 3 && (
                        <div className="animate-fade-in-up flex-1">
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Guarantee Reservation</h3>
                            <p className="text-slate-500 text-sm font-bold mb-6">Register a credit card to secure future bookings and prevent no-shows. No charges will be made now.</p>

                            <div className="bg-white p-5 border border-slate-200 shadow-sm space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Card Number</label>
                                    <input type="text" value={cardNum} onChange={e => setCardNum(e.target.value)} placeholder="0000 0000 0000 0000" className="w-full p-4 border border-slate-300 text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm rounded-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Expiry Date</label>
                                        <input type="text" value={cardExp} onChange={e => setCardExp(e.target.value)} placeholder="MM/YY" className="w-full p-4 border border-slate-300 text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm rounded-none text-center" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">CVV</label>
                                        <input type="password" maxLength="4" value={cardCvv} onChange={e => setCardCvv(e.target.value)} placeholder="•••" className="w-full p-4 border border-slate-300 text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-sm rounded-none text-center" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 pt-4">
                        <button onClick={nextStep} className="w-full bg-[#009900] hover:bg-[#008000] text-white py-4 font-black text-lg shadow-lg transition-transform active:scale-95 rounded-none">
                            {onboardStep === 3 ? 'Complete Registration ✓' : 'Next Step ➔'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-5 md:p-6 pb-28 font-sans selection:bg-[#009900]/20 min-h-screen relative">
            {user ? (
                isMembershipActive ? (
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-2xl mb-8 relative overflow-hidden transform hover:scale-[1.02] transition-transform rounded-none">
                        <div className="absolute -right-4 -top-4 text-8xl opacity-10">👑</div>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Membership</p>
                                <p className="text-[#009900] font-black text-sm uppercase tracking-widest">PREMIUM MEMBER</p>
                            </div>
                            <div className="text-right">
                                <h2 className="text-xl font-black">{user.first_name} {user.last_name}</h2>
                            </div>
                        </div>

                        <div className="bg-white/10 p-4 backdrop-blur-md border border-white/10 rounded-none">
                            <p className="text-[10px] text-slate-300 mb-1 uppercase font-bold tracking-wider">Available Reward Points</p>
                            <p className="text-3xl font-black tracking-wider text-white">₱ {user.total_points ? user.total_points.toLocaleString() : 0}</p>
                        </div>
                    </div>
                ) : (
                    <div
                        className="w-full min-h-[220px] shadow-xl mb-8 relative rounded-none p-5 bg-cover bg-center bg-no-repeat border border-slate-200 overflow-hidden"
                        style={{ backgroundImage: "url('/rewards.webp')" }}
                    >
                        <div className="absolute inset-0 bg-black/10"></div>
                        <button
                            onClick={startOnboarding}
                            className="bg-[#009900] text-white font-bold px-4 py-2 shadow-lg hover:bg-[#008000] transition-colors rounded-none absolute bottom-3 right-3 z-10 text-[11px]"
                        >
                            Join Now ➔
                        </button>
                    </div>
                )
            ) : (
                <div className="bg-slate-100 p-6 text-center shadow-inner mb-8 border border-slate-200 rounded-none">
                    <div className="text-5xl mb-4">🎁</div>
                    <h2 className="text-xl font-black text-slate-800 mb-2">Join N+ Rewards</h2>
                    <p className="text-sm font-bold text-slate-500 mb-6 px-4">Sign up to earn points on every stay and unlock exclusive perks.</p>
                    <Link href="/login" className="inline-block bg-[#009900] text-white font-black px-10 py-3.5 shadow-lg hover:bg-[#008000] transition-colors text-sm w-full sm:w-auto rounded-none">
                        Log In / Sign Up
                    </Link>
                </div>
            )}

            <h3 className="font-black text-slate-800 text-lg mb-4 pl-1">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4 mb-8">
                <Link href="/book" className="bg-white border border-slate-200 p-4 flex flex-col justify-center gap-1.5 hover:border-[#009900] transition-all rounded-none shadow-sm h-24">
                    <svg className="w-6 h-6 text-[#009900]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>
                    <span className="font-bold text-slate-800 text-sm">Book Room</span>
                </Link>
                <Link href="/promos" className="bg-white border border-slate-200 p-4 flex flex-col justify-center gap-1.5 hover:border-[#009900] transition-all rounded-none shadow-sm h-24">
                    <svg className="w-6 h-6 text-[#009900]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
                    <span className="font-bold text-slate-800 text-sm">Offers</span>
                </Link>
            </div>

            <h3 className="font-black text-slate-800 text-lg mb-4 pl-1 mt-6">Discover</h3>
            <div className="overflow-hidden relative shadow-md h-28 flex items-start p-4 group cursor-pointer rounded-none mb-10">
                <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800" alt="Hotel Pool" className="absolute inset-0 w-full h-full object-cover z-0 group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 to-transparent z-10"></div>
                <div className="relative z-20 text-white w-full">
                    <p className="text-[10px] font-bold text-slate-300 mb-0.5">Hotel Pool</p>
                    <h3 className="text-xl font-black leading-tight drop-shadow-md">Hotel Pool</h3>
                </div>
            </div>

            {/* 고정 하단 메뉴바 (Bottom Navigation Bar) */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-end pb-5 pt-3 z-50 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                <Link href="/" className="flex flex-col items-center gap-1 text-[#009900]">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                    <span className="text-[9px] font-bold">Home</span>
                </Link>
                <Link href="/events" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <span className="text-[9px] font-bold">Events</span>
                </Link>

                {/* 중앙 플로팅 버튼 */}
                <div className="relative flex flex-col items-center justify-end h-full px-2">
                    <Link href="/discover" className="absolute -top-7 bg-[#009900] w-14 h-14 rounded-full flex items-center justify-center border-4 border-slate-50 shadow-md text-white hover:scale-105 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                    </Link>
                    <span className="text-[9px] font-bold text-slate-400 mt-7">Discover</span>
                </div>

                <Link href="/notifications" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                    <span className="text-[9px] font-bold">Notificies</span>
                </Link>
                <Link href="/profile" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                    <span className="text-[9px] font-bold">Profile</span>
                </Link>
            </div>
        </div>
    );
}