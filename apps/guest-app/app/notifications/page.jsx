"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function NotificationsPage() {
    const router = useRouter();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState("");

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

    useEffect(() => {
        if (!userEmail) return;

        const fetchNotifications = async () => {
            try {
                const res = await axios.get(`https://api.hotelnplus.com/api/members/notifications?email=${userEmail}`);
                if (res.data && res.data.success) {
                    const sortedNotifs = res.data.notifications.sort((a, b) => {
                        return new Date(b.created_at) - new Date(a.created_at);
                    });
                    setNotifications(sortedNotifs);
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
        } catch (err) { }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    };

    // 💡 [핵심 수정] 하드코딩 제거! 메시지 내용을 분석해서 동적으로 버튼 UI와 이동할 단계를 결정합니다.
    const getDynamicButtonConfig = (message) => {
        const msg = (message || "").toLowerCase();

        if (msg.includes("payment")) {
            return { step: 3, text: "Fix Payment Details", icon: "💳" };
        } else if (msg.includes("id document") || msg.includes("photo")) {
            return { step: 2, text: "Fix ID Document", icon: "📸" };
        } else if (msg.includes("personal info") || msg.includes("name") || msg.includes("birth")) {
            return { step: 1, text: "Fix Personal Info", icon: "👤" };
        }

        // 어떤 것도 명확히 체크 안 되고 Custom Message만 왔을 경우의 기본값
        return { step: 1, text: "Review Application", icon: "📝" };
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
                    notifications.map((notif) => {
                        // 알림이 수정 요청인지 확인
                        const isActionRequired = notif.title.includes("Failed") || notif.title.includes("Action") || notif.title.includes("Reject");
                        // 동적 버튼 설정 가져오기
                        const btnConfig = getDynamicButtonConfig(notif.message);

                        return (
                            <div key={notif.id} onClick={() => handleMarkAsRead(notif.id, notif.is_read)}
                                className={`p-5 rounded-2xl border cursor-pointer relative ${notif.is_read ? 'bg-white border-slate-200 opacity-70' : 'bg-white border-emerald-300 shadow-md'}`}>
                                {!notif.is_read && <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>}

                                <div className="flex items-start gap-4">
                                    <div className="text-4xl mt-1">{isActionRequired ? "⚠️" : "🔔"}</div>
                                    <div className="flex-1 w-full">
                                        <h4 className="text-[17px] font-black mb-1 leading-tight text-slate-800">{notif.title}</h4>
                                        <p className="text-[11px] text-slate-400 font-semibold mb-2 tracking-wide uppercase">
                                            {formatDate(notif.created_at)}
                                        </p>
                                        <p className="text-[15px] text-slate-600 font-bold leading-relaxed">{notif.message}</p>

                                        {/* 💡 하드코딩 제거: btnConfig 객체에서 동적으로 텍스트와 스텝 번호를 뽑아옵니다 */}
                                        {isActionRequired && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/login?step=${btnConfig.step}`);
                                                }}
                                                className="mt-4 w-full bg-red-50 hover:bg-red-100 text-red-600 font-black py-3 rounded-xl border border-red-200 transition-transform active:scale-95 flex items-center justify-center gap-2 text-[15px]"
                                            >
                                                <span>{btnConfig.icon}</span> {btnConfig.text}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}