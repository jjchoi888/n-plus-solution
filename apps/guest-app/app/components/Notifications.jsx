"use client";
import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function Notifications() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState("");

    // 1. 기기에 저장된 유저 이메일 가져오기
    useEffect(() => {
        const savedUser = localStorage.getItem('nplus_guest_user');
        if (savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                setUserEmail(parsedUser.email);
            } catch (e) { console.error("User parse error", e); }
        } else {
            setLoading(false); // 비로그인 상태
        }
    }, []);

    // 2. 이메일이 확인되면 백엔드에서 알림 목록 긁어오기
    useEffect(() => {
        if (!userEmail) return;

        const fetchNotifications = async () => {
            try {
                // 💡 프록시를 타도록 상대 경로(/api/...) 사용
                const res = await axios.get(`/api/members/notifications?email=${userEmail}`);
                if (res.data && res.data.success) {
                    setNotifications(res.data.notifications);
                }
            } catch (err) {
                console.error("Failed to fetch notifications", err);
            } finally {
                setLoading(false);
            }
        };

        fetchNotifications();
    }, [userEmail]);

    // 3. 알림 클릭 시 '읽음(is_read = 1)' 처리하기
    const handleMarkAsRead = async (id, isRead) => {
        if (isRead) return; // 이미 읽은 알림은 패스

        // UI 즉시 업데이트 (반응성)
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));

        try {
            await axios.post('/api/members/notifications/read', { id });
        } catch (err) {
            console.error("Failed to mark as read", err);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex justify-center items-center h-full bg-slate-50">
                <div className="text-slate-400 font-bold animate-pulse">Loading notifications...</div>
            </div>
        );
    }

    if (!userEmail) {
        return (
            <div className="flex-1 flex flex-col justify-center items-center h-full bg-slate-50 p-6 text-center">
                <div className="text-5xl mb-4 opacity-50">🔒</div>
                <h3 className="text-lg font-black text-slate-800 mb-2">Please Log In</h3>
                <p className="text-sm text-slate-500 font-medium">Log in to view your notifications and updates.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 pb-24 animate-fade-in">
            {/* 상단 헤더 */}
            <div className="bg-white p-6 shadow-sm border-b border-slate-200 sticky top-0 z-10">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Notifications</h2>
                <p className="text-xs font-bold text-slate-500 mt-1">Updates about your membership & bookings</p>
            </div>

            {/* 알림 리스트 */}
            <div className="p-4 space-y-3 overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-20 text-slate-400">
                        <span className="text-6xl mb-4 opacity-30">📭</span>
                        <p className="font-bold text-lg text-slate-600">No Notifications Yet</p>
                        <p className="text-xs mt-1">When HQ reviews your ID, it will appear here.</p>
                    </div>
                ) : (
                    notifications.map((notif) => (
                        <div
                            key={notif.id}
                            onClick={() => handleMarkAsRead(notif.id, notif.is_read)}
                            className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-sm relative overflow-hidden
                                ${notif.is_read ? 'bg-white border-slate-200 opacity-70' : 'bg-white border-emerald-300 shadow-md transform hover:-translate-y-0.5'}`
                            }
                        >
                            {/* 안 읽은 알림 표시 (빨간 점) */}
                            {!notif.is_read && (
                                <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                            )}

                            <div className="flex items-start gap-4">
                                <div className="text-3xl shrink-0 mt-1">
                                    {notif.title.includes("Failed") || notif.title.includes("Reject") ? "⚠️" : "🔔"}
                                </div>
                                <div className="flex-1 pr-4">
                                    <h4 className={`text-sm font-black mb-1 ${notif.is_read ? 'text-slate-700' : 'text-slate-900'}`}>
                                        {notif.title}
                                    </h4>
                                    <p className={`text-xs leading-relaxed ${notif.is_read ? 'text-slate-500 font-medium' : 'text-slate-600 font-bold'}`}>
                                        {notif.message}
                                    </p>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-3 block">
                                        {new Date(notif.created_at).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}