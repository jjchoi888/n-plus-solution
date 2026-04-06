'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function HomePage() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const savedUser = localStorage.getItem('nplus_guest_user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('nplus_guest_user');
        setUser(null);
        window.location.reload();
    };

    return (
        <div className="p-5 md:p-6 pb-20">
            {user ? (
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-none p-6 text-white shadow-2xl mb-8 relative overflow-hidden transform hover:scale-[1.02] transition-transform">
                    <div className="absolute -right-4 -top-4 text-8xl opacity-10">👑</div>
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Membership</p>
                            <p className="text-green-400 font-black text-sm uppercase tracking-widest">{user.tier_id === 1 ? 'MEMBER' : 'PREMIUM'}</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-black">{user.first_name} {user.last_name}</h2>
                        </div>
                    </div>

                    <div className="bg-white/10 rounded-none p-4 backdrop-blur-md border border-white/10">
                        <p className="text-[10px] text-slate-300 mb-1 uppercase font-bold tracking-wider">Available Reward Points</p>
                        <p className="text-3xl font-black tracking-wider text-white">₱ {user.total_points || 0}</p>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-100 rounded-none p-6 text-center shadow-inner mb-8 border border-slate-200">
                    <div className="text-5xl mb-4">🎁</div>
                    <h2 className="text-xl font-black text-slate-800 mb-2">Join N+ Rewards</h2>
                    <p className="text-sm font-bold text-slate-500 mb-6 px-4">Sign up to earn points on every stay and unlock exclusive perks.</p>
                    <Link href="/login" className="inline-block bg-[#009900] text-white font-black px-10 py-3.5 rounded-none shadow-lg hover:bg-[#008000] transition-colors text-sm w-full sm:w-auto">
                        Log In / Sign Up
                    </Link>
                </div>
            )}

            <h3 className="font-black text-slate-800 text-lg mb-4 pl-1">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4 mb-8">
                <Link href="/book" className="bg-green-50 border-2 border-green-100 p-6 rounded-none flex flex-col items-center justify-center gap-3 hover:bg-green-100 hover:border-green-300 transition-all group shadow-sm">
                    <span className="text-4xl group-hover:scale-110 transition-transform">🛏️</span>
                    <span className="font-black text-green-800 text-sm tracking-wide">Book Room</span>
                </Link>
                <Link href="/promos" className="bg-orange-50 border-2 border-orange-100 p-6 rounded-none flex flex-col items-center justify-center gap-3 hover:bg-orange-100 hover:border-orange-300 transition-all group shadow-sm">
                    <span className="text-4xl group-hover:scale-110 transition-transform">🎉</span>
                    <span className="font-black text-orange-800 text-sm tracking-wide">Offers</span>
                </Link>
            </div>

            <div className="rounded-none overflow-hidden relative shadow-lg h-56 flex items-end p-6 group cursor-pointer">
                <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800" alt="Hotel Pool" className="absolute inset-0 w-full h-full object-cover z-0 group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent z-10"></div>
                <div className="relative z-20 text-white w-full">
                    <p className="text-[10px] font-black text-green-300 uppercase tracking-widest mb-1.5 drop-shadow-md">Discover</p>
                    <h3 className="text-xl font-black leading-tight drop-shadow-lg w-2/3">Experience true relaxation with us</h3>
                    <div className="mt-3 flex justify-between items-center w-full">
                        <span className="text-xs font-bold text-white/80">Explore More</span>
                        <span className="text-white">➔</span>
                    </div>
                </div>
            </div>

            {user && (
                <div className="mt-10 text-center">
                    <button onClick={handleLogout} className="text-xs font-bold text-slate-400 hover:text-red-500 underline py-2">Sign Out securely</button>
                </div>
            )}
        </div>
    );
}