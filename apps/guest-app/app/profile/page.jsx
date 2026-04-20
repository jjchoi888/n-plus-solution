'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ProfilePage() {
    const [user, setUser] = useState(null);
    const [myBookings, setMyBookings] = useState([]);

    // 💡 정보 수정용 State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState({});
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        const savedUser = localStorage.getItem('nplus_guest_user');
        if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);
            setEditData(parsedUser); // 수정 폼에 원본 데이터 채워넣기

            fetch(`https://api.hotelnplus.com/api/members/profile?email=${parsedUser.email}&t=${Date.now()}`, { cache: 'no-store' })
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.member) {
                        const freshUser = {
                            ...data.member,
                            name: `${data.member.first_name || ''} ${data.member.last_name || ''}`.trim() || 'Guest User'
                        };
                        localStorage.setItem('nplus_guest_user', JSON.stringify(freshUser));
                        setUser(freshUser);
                        setEditData(freshUser); // 동기화 완료 시 데이터 갱신
                    }
                })
                .catch(err => console.error("Profile sync error:", err));
        }

        const savedBookings = localStorage.getItem('nplus_my_bookings');
        if (savedBookings) {
            setMyBookings(JSON.parse(savedBookings));
        }
    }, []);

    const handleLogout = () => {
        sessionStorage.removeItem('is_unlocked_this_session');
        window.location.href = '/'; // 홈 화면으로 쫓아내면 홈 화면이 알아서 PIN 입력창을 띄웁니다.
    };

    // 💡 정보 수정 제출 함수
    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setIsUpdating(true);

        try {
            // 백엔드의 auth 라우트가 프로필 업데이트 기능도 겸합니다.
            const payload = {
                email: user.email, // 이메일은 변경 불가 (기준값)
                pin: user.pin,     // 인증용 PIN
                first_name: editData.first_name,
                last_name: editData.last_name,
                phone: editData.phone,
                nationality: editData.nationality,
                dob: editData.dob,
                document_url: editData.document_url, // 신분증 재업로드 대비
                payment_method: editData.payment_method,
                payment_acc_name: editData.payment_acc_name,
                payment_acc_num: editData.payment_acc_num
            };

            const res = await fetch('https://api.hotelnplus.com/api/members/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok && data.success) {
                const updatedUser = { ...data.member, name: `${data.member.first_name} ${data.member.last_name}`, pin: user.pin };
                localStorage.setItem('nplus_guest_user', JSON.stringify(updatedUser));
                setUser(updatedUser);
                setShowEditModal(false);
                alert("Your profile has been successfully updated.");
            } else {
                alert(data.message || "Failed to update profile. Please try again.");
            }
        } catch (error) {
            alert("A network error occurred. Please check your connection and try again.");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="pb-24 font-sans bg-slate-50 min-h-screen selection:bg-[#009900]/20">
            <div className="bg-white px-4 py-4 flex items-center justify-between sticky top-0 z-40 border-b border-slate-100 shadow-sm">
                <h1 className="text-lg font-black text-slate-800 ml-2">My Profile</h1>

                {/* 💡 상단 정보 수정 버튼 추가 */}
                {user && (
                    <button onClick={() => setShowEditModal(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1 border border-slate-200">
                        ✏️ Edit Profile
                    </button>
                )}
            </div>

            <div className="p-4 md:p-6 space-y-6">

                {user ? (
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-none p-6 text-white shadow-lg relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 text-8xl opacity-10">👑</div>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Membership</p>
                                <p className="text-[#009900] font-black text-sm uppercase tracking-widest">
                                    {user.tier_id ? `${user.tier_id} TIER` : 'Member'}
                                </p>
                            </div>
                            <div className="text-right">
                                <h2 className="text-xl font-black">
                                    {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.name}
                                </h2>
                                <p className="text-xs text-slate-400 font-medium mt-1">{user.email}</p>
                            </div>
                        </div>

                        <div className="bg-white/10 rounded-none p-4 backdrop-blur-md border border-white/10">
                            <p className="text-[10px] text-slate-300 mb-1 uppercase font-bold tracking-wider">Available Reward Points</p>
                            <p className="text-3xl font-black tracking-wider text-white flex items-baseline gap-1.5">
                                {(user.total_points || 0).toLocaleString()}
                                <span className="text-sm font-bold text-slate-300">points</span>
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-100 rounded-none p-6 text-center shadow-inner border border-slate-200">
                        <h2 className="text-xl font-black text-slate-800 mb-2">Guest User</h2>
                        <p className="text-sm font-bold text-slate-500 mb-6 px-4">Log in to view your reward points and faster booking checkout.</p>
                        <Link href="/login" className="inline-block bg-[#009900] text-white font-black px-10 py-3.5 rounded-none shadow-lg hover:bg-[#008000] transition-colors text-sm w-full">
                            Log In
                        </Link>
                    </div>
                )}

                <div>
                    <h3 className="font-black text-slate-800 text-lg mb-4 pl-1 flex items-center gap-2">
                        <span className="text-xl">🧳</span> My Bookings
                    </h3>

                    {myBookings.length > 0 ? (
                        <div className="space-y-4">
                            {myBookings.map((booking, idx) => (
                                <div key={idx} className="bg-white border-2 border-slate-200 rounded-none shadow-sm p-5 relative">
                                    <div className="absolute top-4 right-4">
                                        {booking.status === 'Pending' ? (
                                            <span className="bg-yellow-100 text-yellow-800 border border-yellow-300 px-3 py-1 rounded-none text-[9px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1">⏳ Pending</span>
                                        ) : (
                                            <span className="bg-green-100 text-green-800 border border-green-300 px-3 py-1 rounded-none text-[9px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1">✅ Confirmed</span>
                                        )}
                                    </div>
                                    <h4 className="font-black text-slate-800 text-lg mb-1">{booking.hotelName}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 mb-4 tracking-wider uppercase">Req ID: {booking.id}</p>

                                    <div className="bg-slate-50 p-3 border border-slate-100 rounded-none mb-4">
                                        <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
                                            <div className="flex-1"><p className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">Check-in</p><p>{booking.checkIn}</p></div>
                                            <span className="text-slate-300">➔</span>
                                            <div className="flex-1 text-right"><p className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">Check-out</p><p>{booking.checkOut}</p></div>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 border-t border-slate-100 pt-4">
                                        {Object.entries(booking.rooms).map(([roomName, qty]) => (
                                            <div key={roomName} className="flex justify-between items-center text-xs font-bold text-slate-600">
                                                <span>🛏️ {roomName}</span>
                                                <span className="bg-slate-200 px-2 py-0.5 rounded-none text-slate-700">x {qty}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-end">
                                        <p className="text-[10px] font-bold text-slate-500">{booking.guests}</p>
                                        <p className="font-black text-lg text-[#009900]">₱{(booking.totalAmount || 0).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-none p-10 text-center shadow-sm">
                            <div className="text-4xl mb-3 opacity-50">📭</div>
                            <p className="text-sm font-bold text-slate-500">You have no upcoming bookings.</p>
                            <Link href="/book" className="inline-block mt-4 bg-slate-900 text-white font-black px-6 py-2.5 rounded-none shadow-md hover:bg-slate-800 text-xs">
                                Book a Room
                            </Link>
                        </div>
                    )}
                </div>

                {user && (
                    <div className="mt-10 pt-6 border-t border-slate-200 text-center">
                        <button onClick={handleLogout} className="text-xs font-bold text-slate-400 hover:text-red-500 underline py-2">
                            Sign Out securely
                        </button>
                    </div>
                )}
            </div>

            {/* 💡 [신규] 정보 수정 모달창 */}
            {showEditModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowEditModal(false)}>
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-800 text-white">
                            <h3 className="font-black text-lg">✏️ Edit Profile</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-xl font-bold text-slate-400 hover:text-white">✕</button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Email Address (Login ID)</label>
                                <input type="text" readOnly value={editData.email} className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-400 bg-slate-200 cursor-not-allowed" />
                                <p className="text-[9px] font-bold text-slate-400 mt-1.5">* Email cannot be changed as it is your unique identifier.</p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Phone Number</label>
                                <input type="tel" value={editData.phone || ''} onChange={e => setEditData({ ...editData, phone: e.target.value })} className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold focus:border-[#009900] outline-none" />
                            </div>

                            <div className="border-t border-slate-200 pt-5 mt-2">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Payment Method</label>
                                <select value={editData.payment_method || ''} onChange={e => setEditData({ ...editData, payment_method: e.target.value })} className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold focus:border-[#009900] outline-none mb-4 bg-white cursor-pointer">
                                    <option value="">-- Select Method --</option>
                                    <option value="card">💳 Card</option>
                                    <option value="gcash">📱 GCash</option>
                                    <option value="maya">💵 Maya</option>
                                </select>

                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Payment Account Name</label>
                                <input type="text" value={editData.payment_acc_name || ''} onChange={e => setEditData({ ...editData, payment_acc_name: e.target.value.toUpperCase() })} className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold focus:border-[#009900] outline-none mb-4 uppercase" placeholder="e.g. JOHN DOE" />

                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Payment Account Number</label>
                                <input type="text" value={editData.payment_acc_num || ''} onChange={e => setEditData({ ...editData, payment_acc_num: e.target.value })} className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold focus:border-[#009900] outline-none" placeholder="e.g. 09XX XXX XXXX" />
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-white flex gap-3 shrink-0">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={handleUpdateProfile} disabled={isUpdating} className="flex-[2] py-3 bg-[#009900] text-white font-black rounded-xl hover:bg-[#008000] shadow-md disabled:opacity-50 transition-colors">
                                {isUpdating ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}