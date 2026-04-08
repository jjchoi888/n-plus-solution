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

    // 필터 상태 관리
    const [tab, setTab] = useState("ALL_USERS");
    const [searchTerm, setSearchTerm] = useState("");
    const [filterTier, setFilterTier] = useState("ALL");
    const [filterNation, setFilterNation] = useState("ALL");

    // 이메일 모달 상태
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailForm, setEmailForm] = useState({ subject: "", content: "", imageUrl: "" });
    const [isSending, setIsSending] = useState(false);

    // 💡 [NEW] 유저 관리(Manage) 모달 상태
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);

    // 에디터 툴바 구성
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

    // 유저 데이터 로드
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                // 실제 DB에서 데이터 가져오기
                const res = await axios.get("https://api.hotelnplus.com/api/hq/members");
                if (res.data && res.data.members) {
                    setUsers(res.data.members);
                }
            } catch (err) {
                console.error("Data load failure:", err);
                setUsers([]);
            } finally { setLoading(false); }
        };
        fetchUsers();
    }, []);

    const basicUsers = users.filter(u => !u.is_membership_active);
    const memberUsers = users.filter(u => u.is_membership_active);

    const displayUsers = (tab === "ALL_USERS" ? users : tab === "BASIC" ? basicUsers : memberUsers)
        .filter(u => {
            const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchTier = filterTier === "ALL" || u.tier === filterTier;
            const matchNation = filterNation === "ALL" || u.nationality === filterNation;
            return matchSearch && matchTier && matchNation;
        });

    const nations = ["ALL", ...new Set(users.map(u => u.nationality))];
    const tiers = ["ALL", "Basic", "Member", "Silver", "Gold", "VIP"];

    // 이메일 발송 로직
    const submitEmailCampaign = async (e) => {
        e.preventDefault();
        if (!confirm(`${displayUsers.length}명의 유저에게 이메일을 발송하시겠습니까?`)) return;

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
            alert("error occurred during dispatch.");
        } finally { setIsSending(false); }
    };

    // 💡 [NEW] 유저 수정(Manage) 실제 DB 저장 로직 (영어 알림 적용)
    const handleUpdateUser = async (e) => {
        e.preventDefault();
        setIsUpdating(true);

        try {
            // 1. 진짜 백엔드 서버로 변경된 데이터를 쏩니다.
            const res = await axios.post("https://api.hotelnplus.com/api/hq/members/update", editingUser);

            if (res.data && res.data.success) {
                // 2. DB 업데이트가 성공하면 화면의 리스트도 갈아끼웁니다.
                setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
                alert(`✅ Successfully updated information for ${editingUser.name}.`);
                setIsEditModalOpen(false);
            } else {
                alert("❌ Update failed: " + res.data.message);
            }
        } catch (err) {
            console.error("Update Error:", err);
            alert("🚨 A network error occurred during the update. Please try again.");
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) return <div className="p-20 text-center font-bold text-slate-400">Loading User Data...</div>;

    return (
        <div className="space-y-6 animate-fade-in pb-20 font-sans">
            {/* 상단 탭 */}
            <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 w-fit shadow-sm">
                {[
                    { id: "ALL_USERS", label: `Total (${users.length})` },
                    { id: "BASIC", label: `Basic Users (${basicUsers.length})` },
                    { id: "MEMBERS", label: `Rewards Members (${memberUsers.length})` }
                ].map(t => (
                    <button key={t.id} onClick={() => { setTab(t.id); setFilterTier("ALL"); }} className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${tab === t.id ? "bg-slate-900 text-white shadow-md" : "text-slate-400 hover:text-slate-600"}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* 필터 및 검색 */}
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

                    <button
                        onClick={() => setIsEmailModalOpen(true)}
                        className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-black hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <span>📧</span> Write Campaign Email ({displayUsers.length})
                    </button>
                </div>
            </div>

            {/* 유저 테이블 */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm font-bold">
                    <thead className="bg-slate-50 border-b border-slate-100 font-black text-slate-500 uppercase text-[11px] tracking-widest">
                        <tr><th className="p-5">User Info</th><th className="p-5">Nationality</th><th className="p-5">Tier Status</th><th className="p-5">Points</th><th className="p-5 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {displayUsers.map(u => {
                            // 스크린샷에 "1"로 나오는 티어를 보기 좋게 처리
                            const displayTier = u.tier === '1' || !u.tier ? 'Basic' : String(u.tier).toUpperCase();

                            return (
                                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-5">
                                        <div className="text-slate-800 text-base">{u.name}</div>
                                        <div className="text-[11px] text-slate-400 font-mono uppercase">{u.email}</div>
                                    </td>
                                    <td className="p-5 text-slate-600 font-medium">{u.nationality}</td>
                                    <td className="p-5">
                                        <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter border ${displayTier === 'VIP' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                                displayTier === 'GOLD' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                    displayTier === 'SILVER' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        displayTier === 'MEMBER' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                            'bg-slate-100 text-slate-500 border-slate-200'
                                            }`}>
                                            {displayTier}
                                        </span>
                                    </td>
                                    <td className="p-5 text-slate-700">
                                        <span className="text-base">{Number(u.total_points).toLocaleString()}</span>
                                        <span className="text-[10px] text-slate-300 ml-1">pts</span>
                                    </td>
                                    <td className="p-5 text-right">
                                        {/* 💡 [NEW] Manage 버튼에 onClick 이벤트 연결 */}
                                        <button
                                            onClick={() => {
                                                setEditingUser({ ...u, tier: displayTier }); // 수정용 객체 복사
                                                setIsEditModalOpen(true);
                                            }}
                                            className="text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors font-black"
                                        >
                                            Manage
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {displayUsers.length === 0 && (
                    <div className="p-24 text-center">
                        <p className="text-slate-400 font-black text-lg">No users found.</p>
                    </div>
                )}
            </div>

            {/* ========================================== */}
            {/* 📌 [NEW] 유저 정보 수정(Manage) 모달창 */}
            {/* ========================================== */}
            {isEditModalOpen && editingUser && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsEditModalOpen(false)}>
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-white/20" onClick={e => e.stopPropagation()}>

                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <span>⚙️</span> Manage User
                                </h3>
                                <p className="text-xs font-bold text-slate-500 mt-1">
                                    {editingUser.email}
                                </p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-3xl font-light">&times;</button>
                        </div>

                        <form onSubmit={handleUpdateUser} className="p-8 space-y-5">
                            {/* 이름 (읽기 전용) */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                                <input type="text" readOnly value={editingUser.name} className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-500 cursor-not-allowed" />
                            </div>

                            {/* 등급(Tier) 수정 */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Membership Tier</label>
                                <select
                                    value={editingUser.tier}
                                    onChange={e => setEditingUser({ ...editingUser, tier: e.target.value })}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="Basic">Basic</option>
                                    <option value="Member">Member</option>
                                    <option value="Silver">Silver</option>
                                    <option value="Gold">Gold</option>
                                    <option value="VIP">VIP</option>
                                </select>
                            </div>

                            {/* 포인트 수정 */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Reward Points</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={editingUser.total_points}
                                        onChange={e => setEditingUser({ ...editingUser, total_points: Number(e.target.value) })}
                                        className="w-full p-4 pl-6 pr-12 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">pts</span>
                                </div>
                            </div>

                            {/* 멤버십 상태 활성화 토글 */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                <div>
                                    <label className="block text-sm font-black text-slate-800">Active Member</label>
                                    <span className="text-[10px] font-bold text-slate-400">Can access rewards and bookings</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={editingUser.is_membership_active}
                                        onChange={e => setEditingUser({ ...editingUser, is_membership_active: e.target.checked })}
                                    />
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

            {/* 📌 이메일 캠페인 에디터 모달 (기존 유지) */}
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