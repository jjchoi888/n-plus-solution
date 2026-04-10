"use client";
import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState("");

    // 1. 로그인된 유저 이메일 가져오기
    useEffect(() => {
        const savedUser = localStorage.getItem('nplus_guest_user');
        if (savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                setUserEmail(parsedUser.email);
            } catch (e) { console.error("User parse error", e); }
        } else {
            setLoading(false);
        }
    }, []);

    // 2. 백엔드에서 알림 가져오기
    useEffect(() => {
        if (!userEmail) return;
        const fetchNotifications = async () => {
            try {
                const res = await axios.get(`/api/members/notifications?email=${userEmail}`);
                if (res.data && res.data.success) {
                    setNotifications(res.data.notifications);
                }
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        fetchNotifications();
    }, [userEmail]);

    const handleMarkAsRead = async (id, isRead) => {
        if (isRead) return;
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
        try { await axios.post('/api/members/notifications/read', { id }); }
        catch (err) { console.error(err); }
    };

    if (loading) return <div className="flex-1 flex items-center justify-center h-screen bg-slate-50 font-bold text-slate-400">Loading...</div>;

    if (!userEmail) {
        return (
            <div className="flex-1 flex flex-col justify-center items-center h-screen bg-slate-50 p-6 text-center">
                <div className="text-5xl mb-4 opacity-50">🔒</div>
                <h3 className="text-lg font-black text-slate-800 mb-2">Please Log In</h3>
                <p className="text-sm text-slate-500 font-medium">Log in to view your notifications.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 pb-24 animate-fade-in">
            <div className="bg-white p-6 shadow-sm border-b border-slate-200 sticky top-0 z-10">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Notifications</h2>
            </div>
            <div className="p-4 space-y-3">
                {notifications.length === 0 ? (
                    <div className="text-center mt-20 text-slate-400 font-bold">No Notifications Yet</div>
                ) : (
                    notifications.map((notif) => (
                        <div key={notif.id} onClick={() => handleMarkAsRead(notif.id, notif.is_read)}
                            className={`p-5 rounded-2xl border cursor-pointer relative ${notif.is_read ? 'bg-white border-slate-200 opacity-70' : 'bg-white border-emerald-300 shadow-md'}`}>
                            {!notif.is_read && <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>}
                            <div className="flex items-start gap-4">
                                <div className="text-3xl">{(notif.title.includes("Failed") || notif.title.includes("Action") || notif.title.includes("Reject")) ? "⚠️" : "🔔"}</div>
                                <div>
                                    <h4 className="text-sm font-black mb-1">{notif.title}</h4>
                                    <p className="text-xs text-slate-600 font-bold">{notif.message}</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}