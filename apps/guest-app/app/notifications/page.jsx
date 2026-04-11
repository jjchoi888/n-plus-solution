"use client";
import React, { useState, useEffect } from 'react';
// 💡 [추가] 라우팅(페이지 이동)을 위해 useRouter 임포트!
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function NotificationsPage() {
    const router = useRouter(); // 💡 [추가] 버튼 클릭 시 이동을 위한 훅
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

    // 2. 이메일이 확인되면 백엔드에서 알림 목록 긁어오기
    useEffect(() => {
        if (!userEmail) return;

        const fetchNotifications = async () => {
            try {
                const res = await axios.get(`https://api.hotelnplus.com/api/members/notifications?email=${userEmail}`);

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

    const handleMarkAsRead = async (id, isRead) => {
        if (isRead) return;

        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));

        try {
            await axios.post('https://api.hotelnplus.com/api/members/notifications/read', { id });
        } catch (err) {
            console.error("Failed to mark as read", err);
        }
    };

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
                                <div className="text-4xl mt-1">{(notif.title.includes("Failed") || notif.title.includes("Action") || notif.title.includes("Reject")) ? "⚠️" : "🔔"}</div>
                                <div className="flex-1 w-full">
                                    {/* 💡 [수정] 텍스트 크기를 기존 text-sm/text-xs에서 크게 확대했습니다. */}
                                    <h4 className="text-[17px] font-black mb-2 leading-tight text-slate-800">{notif.title}</h4>
                                    <p className="text-[15px] text-slate-600 font-bold leading-relaxed">{notif.message}</p>

                                    {/* 💡 [스마트 버튼] ID 검증 실패 등 특정 단어가 포함된 알림일 때만 나타납니다. */}
                                    {(notif.title.includes("Failed") || notif.title.includes("Action") || notif.title.includes("Reject")) && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation(); // 💡 [중요] 버튼 클릭 시 알림 카드 자체가 눌리는 현상(이벤트 버블링) 방지!
                                                // 💡 [중요] 아래 경로('/join-rewards')가 실제 가입 페이지 주소와 일치해야 합니다! 
                                                // 만약 파일명이 다르면 (예: '/login') 거기에 맞게 바꿔주세요.
                                                router.push('/join-rewards?step=2');
                                            }}
                                            className="mt-4 w-full bg-red-50 hover:bg-red-100 text-red-600 font-black py-3 rounded-xl border border-red-200 transition-transform active:scale-95 flex items-center justify-center gap-2 text-[15px]"
                                        >
                                            <span>📸</span> Fix ID Document (Re-upload)
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}