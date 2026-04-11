"use client";
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import dynamic from 'next/dynamic';

const ReactQuill = dynamic(() => import('react-quill-new'), {
    ssr: false,
    loading: () => <div className="h-[350px] bg-slate-50 animate-pulse rounded-2xl flex items-center justify-center font-bold text-slate-400">Loading Editor...</div>
});
import 'react-quill-new/dist/quill.snow.css';

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [tab, setTab] = useState("ALL_USERS");
    const [searchTerm, setSearchTerm] = useState("");
    const [filterTier, setFilterTier] = useState("ALL");
    const [filterNation, setFilterNation] = useState("ALL");

    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailForm, setEmailForm] = useState({ subject: "", content: "", imageUrl: "" });
    const [isSending, setIsSending] = useState(false);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);

    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewingUser, setReviewingUser] = useState(null);

    // 💡 [추가] 스마트 반려(Reject) 모달용 State
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReasons, setRejectReasons] = useState({
        step1_info: false,
        step2_id: false,
        step3_pay: false,
    });
    const [customRejectMessage, setCustomRejectMessage] = useState("");

    const [pointsLogs, setPointsLogs] = useState([]);
    const [logSearch, setLogSearch] = useState("");
    const [logFilterTier, setLogFilterTier] = useState("ALL");

    const modules = useMemo(() => ({
        toolbar: [
            [{ 'font': [] }],
            [{ 'size': ['small', false, 'large', 'huge'] }],
            [{ 'align': [] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            ['image', 'link'],
            ['clean']
        ],
    }), []);

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`/api/hq/members?t=${Date.now()}`, {
                headers: { 'Cache-Control': 'no-cache' }
            });

            if (res.data && res.data.members) {
                const cleanUsers = res.data.members.map(u => ({
                    ...u,
                    name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unknown Guest',
                    nationality: u.nationality || 'Unknown',
                    email: u.email || 'No Email',
                    phone: u.phone || '',
                    dob: u.dob || '',
                    citizen_type: u.citizen_type || '',
                    id_type: u.id_type || '',
                    document_url: u.document_url || '',
                    payment_method: u.payment_method || '',
                    payment_acc_name: u.payment_acc_name || '',
                    payment_acc_num: u.payment_acc_num || '',
                    tier: u.tier_id || u.tier || 'MEMBER',
                    total_points: u.total_points || 0,
                    membership_status: u.membership_status || (u.is_membership_active ? 'active' : 'pending')
                }));
                setUsers(cleanUsers);
            }

            const logRes = await axios.get(`/api/hq/points-log?t=${Date.now()}`, {
                headers: { 'Cache-Control': 'no-cache' }
            }).catch(() => ({ data: { logs: [] } }));

            if (logRes.data && logRes.data.logs) setPointsLogs(logRes.data.logs);

        } catch (err) {
            console.error("Data load failure:", err);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        const interval = setInterval(fetchUsers, 10000);
        return () => clearInterval(interval);
    }, []);

    const basicUsers = users.filter(u => !u.is_membership_active);
    const memberUsers = users.filter(u => u.is_membership_active);

    const displayUsers = (tab === "ALL_USERS" ? users : tab === "BASIC" ? basicUsers : memberUsers)
        .filter(u => {
            const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
            const displayTier = u.tier === '1' || !u.tier ? 'MEMBER' : String(u.tier).toUpperCase();
            const matchTier = filterTier === "ALL" || displayTier === filterTier.toUpperCase();
            const matchNation = filterNation === "ALL" || u.nationality === filterNation;
            return matchSearch && matchTier && matchNation;
        });

    const nations = ["ALL", ...new Set(users.map(u => u.nationality))];
    const tiers = ["ALL", "MEMBER", "SILVER", "GOLD", "VIP"];

    const submitEmailCampaign = async (e) => {
        e.preventDefault();
        if (!window.confirm(`Are you sure you want to send this email to ${displayUsers.length} users?`)) return;

        setIsSending(true);
        try {
            await axios.post("/api/hq/send-marketing-email", {
                emails: displayUsers.map(u => u.email),
                subject: emailForm.subject,
                content: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
                    ${emailForm.content}
                    <hr style="margin: 30px 0; border: 0; border-top: 1px solid #e2e8f0;" />
                    <p style="font-size: 12px; color: #94a3b8;">© 2026 n+ Solutions. All rights reserved.</p>
                </div>
                `
            });
            alert("Email sending has started successfully!");
            setIsEmailModalOpen(false);
            setEmailForm({ subject: "", content: "", imageUrl: "" });
        } catch (err) {
            alert("Error occurred during dispatch.");
        } finally { setIsSending(false); }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        setIsUpdating(true);
        try {
            const res = await axios.post("/api/hq/members/update", editingUser);
            if (res.data && res.data.success) {
                fetchUsers();
                alert(`✅ Successfully updated information for ${editingUser.name}.`);
                setIsEditModalOpen(false);
            } else {
                alert("❌ Update failed: " + res.data.message);
            }
        } catch (err) {
            alert("🚨 A network error occurred during the update. Please try again.");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleActivateUser = async (userEmail) => {
        if (!window.confirm(`Are you sure you want to approve and activate membership for ${userEmail}?`)) return;
        try {
            const res = await axios.put("/api/members/activate", { email: userEmail });
            if (res.data && res.data.success) {
                alert(`✅ Successfully activated membership for ${userEmail}.`);
                setIsReviewModalOpen(false);
                fetchUsers();
            } else {
                alert("❌ Activation failed: " + res.data.message);
            }
        } catch (err) {
            alert("🚨 A network error occurred during activation.");
        }
    };

    // 💡 [수정] 반려 최종 실행 함수 (모달에서 호출됨)
    const executeReject = async (userEmail, reasonMessage, targetStep) => {
        try {
            // 💡 백엔드에 target_step 데이터도 같이 넘겨서 앱으로 전달되게 합니다!
            const res = await axios.post("/api/members/reject", {
                email: userEmail,
                reason: reasonMessage,
                target_step: targetStep
            });
            if (res.data && res.data.success) {
                alert(`✅ Application marked as 'Need More Info'. An in-app notification was sent to the user's Guest App.`);
                setShowRejectModal(false);
                setIsReviewModalOpen(false);
                fetchUsers();
            } else {
                alert("❌ Rejection failed.");
            }
        } catch (err) {
            alert("🚨 Network error.");
        }
    };

    if (loading) return <div className="p-20 text-center font-bold text-slate-400">Loading User Data...</div>;

    return (
        <div className="space-y-6 animate-fade-in pb-20 font-sans">
            <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 w-fit shadow-sm overflow-x-auto">
                {[
                    { id: "ALL_USERS", label: `Total (${users.length})` },
                    { id: "BASIC", label: `Pending Users (${basicUsers.length})` },
                    { id: "MEMBERS", label: `Rewards Members (${memberUsers.length})` },
                    { id: "POINTS_LOG", label: `Points Audit Log 📊` }
                ].map(t => (
                    <button key={t.id} onClick={() => { setTab(t.id); setFilterTier("ALL"); }} className={`px-5 md:px-6 py-2 rounded-xl text-sm font-black transition-all whitespace-nowrap ${tab === t.id ? "bg-slate-900 text-white shadow-md" : "text-slate-400 hover:text-slate-600"}`}>
                        {t.label}
                    </button>
                ))}
                <button onClick={fetchUsers} className="ml-2 px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-xl font-bold text-xs transition-colors border border-emerald-200">
                    ↻ Refresh
                </button>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-[200px]">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2">🔍</span>
                        <input type="text" placeholder="Search name or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold" />
                    </div>
                    <select value={filterTier} onChange={e => setFilterTier(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-emerald-500 cursor-pointer">
                        {tiers.map(t => <option key={t} value={t}>Tier: {t}</option>)}
                    </select>
                    <select value={filterNation} onChange={e => setFilterNation(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-emerald-500 cursor-pointer">
                        {nations.map(n => <option key={n} value={n}>{n === "ALL" ? "All Nationalities" : n}</option>)}
                    </select>
                    <button onClick={() => setIsEmailModalOpen(true)} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-black hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95 flex items-center gap-2">
                        <span>📧</span> Write Campaign Email ({displayUsers.length})
                    </button>
                </div>
            </div>

            {tab === "POINTS_LOG" && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
                        <input type="text" placeholder="Search Email or Description..." value={logSearch} onChange={e => setLogSearch(e.target.value)} className="flex-1 p-2.5 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
                        <select value={logFilterTier} onChange={e => setLogFilterTier(e.target.value)} className="p-2.5 rounded-xl border border-slate-200 text-sm font-bold outline-none cursor-pointer">
                            {tiers.map(t => <option key={`log_${t}`} value={t}>Tier: {t}</option>)}
                        </select>
                    </div>
                    <table className="w-full text-left text-sm font-bold">
                        <thead className="bg-slate-100 border-b border-slate-200 text-slate-500 uppercase text-[11px] tracking-widest">
                            <tr><th className="p-4">Date & Time</th><th className="p-4">Member Info</th><th className="p-4">Description</th><th className="p-4 text-right">Points Added</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {pointsLogs
                                .filter(l => (logFilterTier === "ALL" || l.tier_id === logFilterTier) && ((l.member_email || '').toLowerCase().includes(logSearch.toLowerCase()) || (l.description || '').toLowerCase().includes(logSearch.toLowerCase())))
                                .map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-slate-500 font-mono text-xs">{new Date(log.created_at).toLocaleString()}</td>
                                        <td className="p-4">
                                            <div className="text-slate-800">{log.first_name} {log.last_name}</div>
                                            <div className="text-[10px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md inline-block mt-1">{log.member_email}</div>
                                        </td>
                                        <td className="p-4 text-slate-600">{log.description}</td>
                                        <td className="p-4 text-right font-black text-emerald-500 text-lg">+{log.points_added.toLocaleString()}</td>
                                    </tr>
                                ))}
                            {pointsLogs.length === 0 && <tr><td colSpan="4" className="p-10 text-center text-slate-400">No point logs available.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {tab !== "POINTS_LOG" && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm font-bold">
                        <thead className="bg-slate-50 border-b border-slate-100 font-black text-slate-500 uppercase text-[11px] tracking-widest">
                            <tr><th className="p-5">User Info</th><th className="p-5">Nationality</th><th className="p-5">Tier Status</th><th className="p-5">Points</th><th className="p-5 text-right">Actions</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {displayUsers.map(u => {
                                const displayTier = u.tier === '1' || !u.tier ? 'MEMBER' : String(u.tier).toUpperCase();
                                return (
                                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-5">
                                            <div className="text-slate-800 text-base">{u.name}</div>
                                            <div className="text-[11px] text-slate-400 font-mono uppercase">{u.email}</div>
                                        </td>
                                        <td className="p-5 text-slate-600 font-medium">{u.nationality}</td>
                                        <td className="p-5">
                                            <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter border ${displayTier === 'VIP' ? 'bg-purple-100 text-purple-700 border-purple-200' : displayTier === 'GOLD' ? 'bg-amber-100 text-amber-700 border-amber-200' : displayTier === 'SILVER' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                                                {displayTier}
                                            </span>
                                            {u.membership_status === 'pending' && <span className="ml-2 text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase font-black">Pending Review</span>}
                                        </td>
                                        <td className="p-5 text-slate-700">
                                            <span className="text-base">{Number(u.total_points).toLocaleString()}</span>
                                            <span className="text-[10px] text-slate-300 ml-1">pts</span>
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                {(!u.is_membership_active || String(u.membership_status).toLowerCase() === 'pending') && (
                                                    <button
                                                        onClick={() => {
                                                            setReviewingUser(u);
                                                            setIsReviewModalOpen(true);
                                                        }}
                                                        className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-xl transition-colors font-black text-xs shadow-md active:scale-95"
                                                    >
                                                        Review 👀
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setEditingUser({ ...u, tier: displayTier });
                                                        setIsEditModalOpen(true);
                                                    }}
                                                    className="text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors font-black"
                                                >
                                                    Manage
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {displayUsers.length === 0 && <div className="p-24 text-center"><p className="text-slate-400 font-black text-lg">No users found.</p></div>}
                </div>
            )}

            {/* 메인 리뷰 모달창 */}
            {isReviewModalOpen && reviewingUser && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[90] flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsReviewModalOpen(false)}>
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-white/20" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><span>🔍</span> Review Application</h3>
                                <p className="text-xs font-bold text-slate-500 mt-1">Please verify the submitted details against the ID document.</p>
                            </div>
                            <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-3xl font-light">&times;</button>
                        </div>
                        <div className="p-8 space-y-8 overflow-y-auto max-h-[60vh] custom-scrollbar">
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 grid grid-cols-2 gap-6">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Full Name</label>
                                    <div className="text-sm font-bold text-slate-800">{reviewingUser.name}</div>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date of Birth</label>
                                    <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><span>🎂</span> {reviewingUser.dob || 'Not Provided'}</div>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nationality</label>
                                    <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><span className="text-lg">🌍</span> {reviewingUser.nationality || 'Unknown'}</div>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone Number</label>
                                    <div className="text-sm font-bold text-slate-800">{reviewingUser.phone || 'N/A'}</div>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Address</label>
                                    <div className="text-sm font-bold text-slate-800">{reviewingUser.email}</div>
                                </div>
                                <div className="col-span-2 border-t border-slate-200 pt-4 mt-2">
                                    <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Registered Payment Details (For Front Desk)</label>
                                    <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-slate-100">
                                        <span className="text-2xl">{reviewingUser.payment_method === 'card' ? '💳' : reviewingUser.payment_method === 'gcash' ? '📱' : reviewingUser.payment_method === 'maya' ? '💵' : '❓'}</span>
                                        <div>
                                            <p className="text-xs font-bold text-slate-800 uppercase">{reviewingUser.payment_method || 'N/A'} - {reviewingUser.payment_acc_name || 'No Name'}</p>
                                            <p className="text-xs text-slate-500 font-mono">{reviewingUser.payment_acc_num ? `**** **** **** ${reviewingUser.payment_acc_num.slice(-4)}` : 'No Account Number'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex justify-between items-center">
                                    <span>Submitted ID Document ({reviewingUser.citizen_type === 'filipino' ? 'Local' : reviewingUser.citizen_type === 'foreigner' ? 'Foreigner' : 'Unknown'} - {reviewingUser.id_type || 'N/A'})</span>
                                    {reviewingUser.document_url ? <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded text-[9px] font-black">Verified Upload</span> : <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[9px] font-black">Missing</span>}
                                </label>
                                <div className="w-full h-56 bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-400 relative overflow-hidden group">
                                    {reviewingUser.document_url ? (
                                        <img src={reviewingUser.document_url} className="w-full h-full object-contain bg-black" alt="Uploaded Real ID Document" />
                                    ) : (
                                        <><span className="text-4xl mb-2 group-hover:scale-110 transition-transform">🪪</span><span className="text-xs font-bold text-slate-500">No ID Uploaded</span></>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-white flex gap-3">
                            <button
                                onClick={() => setShowRejectModal(true)} // 💡 모달 오픈 트리거
                                className="flex-1 py-3.5 bg-white border border-slate-200 text-red-500 font-black rounded-xl hover:bg-red-50 transition-colors shadow-sm"
                            >
                                Reject / Request Info
                            </button>
                            <button onClick={() => handleActivateUser(reviewingUser.email)} className="flex-1 py-3.5 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 shadow-md transition-all active:scale-95 flex justify-center items-center gap-2">
                                Approve & Activate ✓
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 💡 [새로 추가된 스마트 반려(Reject) 모달창] */}
            {showRejectModal && reviewingUser && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowRejectModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Request Information</h3>
                        <p className="text-sm text-slate-500 mb-6">Select the items that the user needs to fix and re-submit.</p>

                        <div className="space-y-4 mb-6">
                            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 accent-red-500 rounded cursor-pointer"
                                    checked={rejectReasons.step1_info}
                                    onChange={(e) => setRejectReasons({ ...rejectReasons, step1_info: e.target.checked })}
                                />
                                <div>
                                    <p className="font-bold text-slate-700 text-sm">Personal Info (Step 1)</p>
                                    <p className="text-xs text-slate-500">Name, Date of Birth, or Nationality issues.</p>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 accent-red-500 rounded cursor-pointer"
                                    checked={rejectReasons.step2_id}
                                    onChange={(e) => setRejectReasons({ ...rejectReasons, step2_id: e.target.checked })}
                                />
                                <div>
                                    <p className="font-bold text-slate-700 text-sm">ID Document (Step 2)</p>
                                    <p className="text-xs text-slate-500">ID photo is blurry, expired, or missing.</p>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 accent-red-500 rounded cursor-pointer"
                                    checked={rejectReasons.step3_pay}
                                    onChange={(e) => setRejectReasons({ ...rejectReasons, step3_pay: e.target.checked })}
                                />
                                <div>
                                    <p className="font-bold text-slate-700 text-sm">Payment Details (Step 3)</p>
                                    <p className="text-xs text-slate-500">Invalid account name or number.</p>
                                </div>
                            </label>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Additional Message (Optional)</label>
                                <textarea
                                    value={customRejectMessage}
                                    onChange={(e) => setCustomRejectMessage(e.target.value)}
                                    placeholder="e.g., Please make sure the entire ID is visible in the photo."
                                    className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500 h-20 resize-none font-medium"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectReasons({ step1_info: false, step2_id: false, step3_pay: false });
                                    setCustomRejectMessage("");
                                }}
                                className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    // 💡 체크된 단계 중 가장 낮은(빠른) 단계를 찾습니다.
                                    let targetStep = 0;
                                    if (rejectReasons.step1_info) targetStep = 1;
                                    else if (rejectReasons.step2_id) targetStep = 2;
                                    else if (rejectReasons.step3_pay) targetStep = 3;

                                    if (targetStep === 0 && !customRejectMessage) {
                                        return alert("Please select at least one reason or provide a message.");
                                    }

                                    // 백엔드로 보낼 최종 메시지 조합
                                    let finalMessage = "Action Required: Please re-submit your application.";
                                    const reasons = [];
                                    if (rejectReasons.step1_info) reasons.push("Personal Info");
                                    if (rejectReasons.step2_id) reasons.push("ID Document");
                                    if (rejectReasons.step3_pay) reasons.push("Payment Details");

                                    if (reasons.length > 0) {
                                        finalMessage = `Action Required for: ${reasons.join(', ')}. ` + (customRejectMessage ? `\nNote: ${customRejectMessage}` : "");
                                    } else if (customRejectMessage) {
                                        finalMessage = customRejectMessage;
                                    }

                                    // 백엔드로 전송
                                    executeReject(reviewingUser.email, finalMessage, targetStep);
                                }}
                                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md"
                            >
                                Send Request
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 정보 수정 모달창 */}
            {isEditModalOpen && editingUser && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsEditModalOpen(false)}>
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-white/20" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><span>⚙️</span> Manage User</h3>
                                <p className="text-xs font-bold text-slate-500 mt-1">{editingUser.email}</p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-3xl font-light">&times;</button>
                        </div>
                        <form onSubmit={handleUpdateUser} className="p-8 space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                                <input type="text" readOnly value={editingUser.name} className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-500 cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Membership Tier</label>
                                <select value={editingUser.tier} onChange={e => setEditingUser({ ...editingUser, tier: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500">
                                    <option value="MEMBER">Member</option>
                                    <option value="SILVER">Silver</option>
                                    <option value="GOLD">Gold</option>
                                    <option value="VIP">VIP</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Reward Points</label>
                                <div className="relative">
                                    <input type="number" value={editingUser.total_points} onChange={e => setEditingUser({ ...editingUser, total_points: Number(e.target.value) })} className="w-full p-4 pl-6 pr-12 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500" />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">pts</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                <div>
                                    <label className="block text-sm font-black text-slate-800">Active Member</label>
                                    <span className="text-[10px] font-bold text-slate-400 block">Can access rewards and bookings</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={editingUser.is_membership_active} onChange={e => setEditingUser({ ...editingUser, is_membership_active: e.target.checked })} />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 font-black rounded-2xl hover:bg-slate-50 transition-colors">Cancel</button>
                                <button type="submit" disabled={isUpdating} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-blue-600 shadow-xl transition-all active:scale-95 disabled:opacity-50">
                                    {isUpdating ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 이메일 마케팅 모달창 */}
            {isEmailModalOpen && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] border border-white/20">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><span>🎨</span> Email Campaign Designer</h3>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">Sending to: {displayUsers.length} Recipients</p>
                            </div>
                            <button onClick={() => setIsEmailModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-3xl font-light">&times;</button>
                        </div>
                        <form onSubmit={submitEmailCampaign} className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-8 space-y-6 overflow-y-auto">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Campaign Subject</label>
                                    <input type="text" required value={emailForm.subject} onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg text-slate-800 placeholder:text-slate-300" placeholder="Enter email subject line..." />
                                </div>
                                <div className="flex flex-col min-h-[450px]">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Message Content (Rich Text)</label>
                                    <div className="flex-1 border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col bg-white">
                                        <ReactQuill theme="snow" value={emailForm.content} onChange={(content) => setEmailForm({ ...emailForm, content })} modules={modules} placeholder="Write your marketing message here. Click the image icon to upload from your computer." className="h-[380px] flex-1" />
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0">
                                <button type="button" onClick={() => setIsEmailModalOpen(false)} className="px-8 py-4 bg-white border border-slate-200 text-slate-500 font-black rounded-2xl hover:bg-slate-100 transition-colors">Discard Draft</button>
                                <button type="submit" disabled={isSending || displayUsers.length === 0} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-emerald-600 shadow-xl transition-all active:scale-95 disabled:opacity-50">
                                    {isSending ? "🚀 BLASTING EMAILS..." : `📧 SEND CAMPAIGN TO ${displayUsers.length} USERS`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .ql-container { font-family: inherit; font-size: 16px; border: none !important; }
                .ql-toolbar { border: none !important; border-bottom: 1px solid #f1f5f9 !important; background: #f8fafc; padding: 12px 20px !important; }
                .ql-editor { min-height: 380px; padding: 20px; line-height: 1.6; }
                .ql-editor.ql-blank::before { color: #cbd5e1; font-style: normal; }
                .ql-snow .ql-picker.ql-size .ql-picker-label::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item::before { content: 'Size'; }
                .ql-snow .ql-picker.ql-font .ql-picker-label::before,
                .ql-snow .ql-picker.ql-font .ql-picker-item::before { content: 'Font'; }
            `}</style>
        </div>
    );
}