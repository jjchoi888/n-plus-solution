import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    APPROVAL_REQUEST_STATUS_META,
    canUserApproveRequest,
    getCompanyApprovalNotificationsStorageKey,
    getCompanyApprovalRequestsStorageKey,
    loadCompanyApprovalNotifications,
    loadCompanyApprovalRequests,
    markApprovalNotificationsRead,
    saveCompanyApprovalNotifications
} from './utils/companyApprovals';

export default function FloatingApprovalInbox() {
    const location = useLocation();
    const navigate = useNavigate();
    const currentUserId = sessionStorage.getItem('userId') || localStorage.getItem('userId') || '';
    const currentHotelCode = sessionStorage.getItem('hotelCode') || localStorage.getItem('hotelCode') || '';
    const currentUserName = sessionStorage.getItem('userName') || localStorage.getItem('userName') || currentUserId;
    const excludedPaths = ['/tv', '/self-checkin', '/kiosk', '/guest', '/mobile-checkin', '/m'];
    const isExcluded = excludedPaths.some((path) => (
        location.pathname.toLowerCase() === path || location.pathname.toLowerCase().startsWith(path + '/')
    ));

    const [isOpen, setIsOpen] = useState(false);
    const [requests, setRequests] = useState(() => loadCompanyApprovalRequests(currentHotelCode));
    const [notifications, setNotifications] = useState(() => loadCompanyApprovalNotifications(currentHotelCode));
    const lastAlertRef = useRef('');

    useEffect(() => {
        setRequests(loadCompanyApprovalRequests(currentHotelCode));
        setNotifications(loadCompanyApprovalNotifications(currentHotelCode));
    }, [currentHotelCode]);

    useEffect(() => {
        const handleStorage = (event) => {
            const requestKey = getCompanyApprovalRequestsStorageKey(currentHotelCode);
            const notificationKey = getCompanyApprovalNotificationsStorageKey(currentHotelCode);

            if (!event.key || event.key === requestKey) {
                setRequests(loadCompanyApprovalRequests(currentHotelCode));
            }
            if (!event.key || event.key === notificationKey) {
                setNotifications(loadCompanyApprovalNotifications(currentHotelCode));
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [currentHotelCode]);

    const userNotifications = useMemo(() => (
        notifications.filter((notification) => String(notification.user_id || '').toLowerCase() === currentUserId.toLowerCase())
    ), [currentUserId, notifications]);

    const unreadNotifications = useMemo(() => (
        userNotifications.filter((notification) => !notification.read_at)
    ), [userNotifications]);

    const pendingApprovals = useMemo(() => (
        requests.filter((request) => canUserApproveRequest({ request, userId: currentUserId }))
    ), [currentUserId, requests]);

    const submittedByMe = useMemo(() => (
        requests.filter((request) => String(request.requested_by?.user_id || '').toLowerCase() === currentUserId.toLowerCase())
    ), [currentUserId, requests]);

    const referencedForMe = useMemo(() => (
        requests.filter((request) => request.watchers.some((watcher) => (
            String(watcher.user_id || '').toLowerCase() === currentUserId.toLowerCase()
        )))
    ), [currentUserId, requests]);

    const latestUpdates = useMemo(() => (
        [...userNotifications]
            .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
            .slice(0, 4)
    ), [userNotifications]);

    const handleOpenNotifyCcRequests = () => {
        const latestReferencedRequest = referencedForMe[0];
        if (!latestReferencedRequest) {
            navigate('/approvals?scope=all');
            return;
        }

        navigate(`/approvals?scope=all&requestId=${latestReferencedRequest.id}`);
    };

    useEffect(() => {
        if (!currentUserId || unreadNotifications.length === 0) return;
        const latestUnread = unreadNotifications[0];
        if (!latestUnread?.id || lastAlertRef.current === latestUnread.id) return;
        lastAlertRef.current = latestUnread.id;

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const browserNotice = new Notification('Approval Update', {
                body: latestUnread.message || `${currentUserName}, you have a new approval update.`
            });
            browserNotice.onclick = () => {
                window.focus();
                browserNotice.close();
                navigate(latestUnread.source_path || `/approvals?requestId=${latestUnread.request_id}`);
            };
        }
    }, [currentUserId, currentUserName, navigate, unreadNotifications]);

    useEffect(() => {
        if (!isOpen || unreadNotifications.length === 0) return;

        const nextNotifications = markApprovalNotificationsRead({
            notifications,
            userId: currentUserId,
            notificationIds: unreadNotifications.map((notification) => notification.id)
        });
        setNotifications(nextNotifications);
        saveCompanyApprovalNotifications(currentHotelCode, nextNotifications);
    }, [currentHotelCode, currentUserId, isOpen, notifications, unreadNotifications]);

    if (!currentUserId || !currentHotelCode || isExcluded) return null;

    const totalAttentionCount = pendingApprovals.length + unreadNotifications.length;

    return (
        <div className="fixed bottom-24 right-6 z-[9998] flex flex-col items-end gap-3 animate-fade-in">
            {isOpen && (
                <div className="w-[340px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
                    <div className="border-b border-slate-100 bg-slate-900 px-5 py-4 text-white">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">Approval Box</div>
                                <div className="mt-2 text-lg font-black">Company Workflow</div>
                                <div className="mt-1 text-xs font-bold text-slate-300">Requests, approvals, and archived payment updates for {currentUserName}.</div>
                            </div>
                            <button type="button" onClick={() => setIsOpen(false)} className="rounded-2xl border border-slate-700 px-3 py-2 text-sm font-black text-slate-200 hover:bg-slate-800 transition-colors">
                                Close
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50 px-4 py-4">
                        <button
                            type="button"
                            onClick={() => navigate('/approvals')}
                            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-left"
                        >
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Needs My Approval</div>
                            <div className="mt-2 text-2xl font-black text-amber-700">{pendingApprovals.length}</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/approvals?scope=requested')}
                            className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-left"
                        >
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-700">Submitted By Me</div>
                            <div className="mt-2 text-2xl font-black text-sky-700">{submittedByMe.length}</div>
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenNotifyCcRequests}
                            className="col-span-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 text-left transition-colors hover:bg-violet-100/70"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-700">Notify / CC</div>
                                    <div className="mt-2 text-sm font-black text-violet-900">Open referenced reservation details</div>
                                    <div className="mt-1 text-xs font-medium text-violet-700">View requests shared with you for reference, then open the source reservation from Approval Center.</div>
                                </div>
                                <div className="text-2xl font-black text-violet-700">{referencedForMe.length}</div>
                            </div>
                        </button>
                    </div>

                    <div className="max-h-[420px] overflow-y-auto px-4 py-4">
                        <div>
                            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Pending Queue</div>
                            <div className="space-y-3">
                                {pendingApprovals.slice(0, 3).map((request) => {
                                    const statusMeta = APPROVAL_REQUEST_STATUS_META[request.status] || APPROVAL_REQUEST_STATUS_META.PENDING;
                                    return (
                                        <button
                                            key={request.id}
                                            type="button"
                                            onClick={() => navigate(`/approvals?requestId=${request.id}`)}
                                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm hover:border-amber-300 hover:bg-amber-50/40 transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-black text-slate-900">{request.subject || request.title || 'Approval Request'}</div>
                                                    <div className="mt-1 truncate text-xs font-bold text-slate-500">{request.requested_by.user_name || request.requested_by.user_id} · {request.source_label || request.source_module}</div>
                                                </div>
                                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${statusMeta.className}`}>
                                                    {statusMeta.label}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                                {pendingApprovals.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs font-bold text-slate-400">
                                        No approvals are waiting on you right now.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-5">
                            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Recent Updates</div>
                            <div className="space-y-3">
                                {latestUpdates.map((notification) => (
                                    <button
                                        key={notification.id}
                                        type="button"
                                        onClick={() => navigate(notification.source_path || `/approvals?requestId=${notification.request_id}`)}
                                        className={`w-full rounded-2xl border px-4 py-4 text-left shadow-sm transition-colors ${
                                            notification.read_at
                                                ? 'border-slate-200 bg-white hover:bg-slate-50'
                                                : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/60'
                                        }`}
                                    >
                                        <div className="text-sm font-black text-slate-900">{notification.title || 'Approval Update'}</div>
                                        <div className="mt-1 text-xs font-medium text-slate-500">{notification.message}</div>
                                    </button>
                                ))}
                                {latestUpdates.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs font-bold text-slate-400">
                                        Approval updates will appear here after requests are sent.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
                        <button
                            type="button"
                            onClick={() => navigate('/approvals')}
                            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 transition-colors"
                        >
                            Open Approval Center
                        </button>
                    </div>
                </div>
            )}

            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-label={isOpen ? 'Close company workflow approvals' : 'Open company workflow approvals'}
                className={`relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-2xl transition-transform hover:scale-105 active:scale-95 ${isOpen ? 'bg-slate-800' : 'bg-slate-900'}`}
            >
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h6.379a1.5 1.5 0 011.06.44l2.871 2.87a1.5 1.5 0 01.44 1.061V19.5A1.5 1.5 0 0116.75 21h-9A1.5 1.5 0 016.25 19.5v-14A1.75 1.75 0 017.5 3.75z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 3.75V7.5h3.75" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 10.25h6M9 13.25h6M9 16.25h4.5" />
                </svg>
                <span className="sr-only">Company workflow approvals</span>
                {!isOpen && totalAttentionCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-6 min-w-[24px] items-center justify-center rounded-full border-2 border-white bg-red-600 px-1.5 text-[11px] font-black text-white shadow-md animate-bounce">
                        {totalAttentionCount > 99 ? '99+' : totalAttentionCount}
                    </span>
                )}
            </button>
        </div>
    );
}
