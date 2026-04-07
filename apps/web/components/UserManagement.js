"use client";
import { useState, useEffect } from "react";
import axios from "axios";

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // 필터 상태 관리
    const [tab, setTab] = useState("ALL_USERS"); // ALL_USERS, BASIC, MEMBERS
    const [searchTerm, setSearchTerm] = useState("");
    const [filterTier, setFilterTier] = useState("ALL");
    const [filterNation, setFilterNation] = useState("ALL");

    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailForm, setEmailForm] = useState({ subject: "", content: "", imageUrl: "" });
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await axios.get("/api/hq/members");
                setUsers(res.data.members);
            } catch (err) {
                // 테스트용 확장 데이터 (기존 유지)
                setUsers([
                    { id: 1, name: "Jongwon Choi", email: "jjchoi888@gmail.com", nationality: "South Korea", is_membership_active: true, total_points: 1000, tier: "Member", created_at: "2026-04-01" },
                    { id: 2, name: "Juan Dela Cruz", email: "juan@example.com", nationality: "Philippines", is_membership_active: false, total_points: 0, tier: "Basic", created_at: "2026-04-05" },
                    { id: 3, name: "Maria Santos", email: "maria@test.com", nationality: "Philippines", is_membership_active: true, total_points: 5000, tier: "VIP", created_at: "2026-03-20" },
                    { id: 4, name: "Kenji Sato", email: "kenji@nplus.jp", nationality: "Japan", is_membership_active: true, total_points: 2500, tier: "Silver", created_at: "2026-04-02" },
                    { id: 5, name: "HQ Admin", email: "admin@hotelnplus.com", nationality: "South Korea", is_membership_active: true, total_points: 9999, tier: "Gold", created_at: "2026-01-01" },
                ]);
            } finally { setLoading(false); }
        };
        fetchUsers();
    }, []);

    // 💡 1. 섹션 구분 로직 (Basic vs Member)
    const basicUsers = users.filter(u => !u.is_membership_active);
    const memberUsers = users.filter(u => u.is_membership_active);

    // 💡 4. 필터링 로직 강화 (탭 + 검색 + 등급 + 국적 조합)
    const displayUsers = (tab === "ALL_USERS" ? users : tab === "BASIC" ? basicUsers : memberUsers)
        .filter(u => {
            const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchTier = filterTier === "ALL" || u.tier === filterTier;
            const matchNation = filterNation === "ALL" || u.nationality === filterNation;
            return matchSearch && matchTier && matchNation;
        });

    const nations = ["ALL", ...new Set(users.map(u => u.nationality))];
    const tiers = ["ALL", "Basic", "Member", "Silver", "Gold", "VIP"];

    // 이메일 발송 처리 함수 (Resend API 연동용)
    const submitEmailCampaign = async (e) => {
        e.preventDefault();
        if (!confirm(`${displayUsers.length}명의 유저에게 이메일을 발송하시겠습니까?`)) return;

        setIsSending(true);
        try {
            const response = await axios.post("/api/hq/send-marketing-email", {
                emails: displayUsers.map(u => u.email),
                subject: emailForm.subject,
                content: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    ${emailForm.imageUrl ? `<img src="${emailForm.imageUrl}" style="width: 100%; border-radius: 12px; margin-bottom: 20px;" />` : ""}
                    <h1 style="color: #1e293b;">${emailForm.subject}</h1>
                    <div style="font-size: 16px; line-height: 1.6; color: #475569; white-space: pre-wrap;">${emailForm.content}</div>
                    <hr style="margin: 30px 0; border: 0; border-top: 1px solid #e2e8f0;" />
                    <p style="font-size: 12px; color: #94a3b8;">© 2026 n+ Solutions. All rights reserved.</p>
                </div>
            `
            });

            if (response.data.success) {
                alert("이메일 발송이 성공적으로 시작되었습니다!");
                setIsEmailModalOpen(false);
                setEmailForm({ subject: "", content: "", imageUrl: "" });
            }
        } catch (err) {
            alert("발송 중 에러가 발생했습니다.");
        } finally {
            setIsSending(false);
        }
    };

    if (loading) return <div className="p-20 text-center font-bold text-slate-400">Loading User Data...</div>;

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* 💡 1. 상단 탭 구분 (User / Member) */}
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

            {/* 필터 및 이메일 도구함 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                    {/* 검색 */}
                    <div className="relative flex-1 min-w-[200px]">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2">🔍</span>
                        <input type="text" placeholder="Search name or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold" />
                    </div>

                    {/* 💡 4. 등급/국적 필터링 */}
                    <select value={filterTier} onChange={e => setFilterTier(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-emerald-500 cursor-pointer">
                        {tiers.map(t => <option key={t} value={t}>Tier: {t}</option>)}
                    </select>
                    <select value={filterNation} onChange={e => setFilterNation(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-emerald-500 cursor-pointer">
                        {nations.map(n => <option key={n} value={n}>{n === "ALL" ? "All Nationalities" : n}</option>)}
                    </select>

                    {/* 💡 3. 그룹 이메일 발송 버튼 */}
                    <button
                        onClick={() => setIsEmailModalOpen(true)}
                        className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-black hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <span>📧</span> Send Marketing Email ({displayUsers.length})
                    </button>
                </div>
            </div>

            {/* 회원 리스트 테이블 */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden font-sans">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                            <th className="p-5">User Info</th>
                            <th className="p-5">Nationality</th>
                            <th className="p-5">Tier Status</th>
                            <th className="p-5">Points</th>
                            <th className="p-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold">
                        {displayUsers.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-5">
                                    <div className="text-slate-800 text-base">{u.name}</div>
                                    <div className="text-[11px] text-slate-400 font-mono uppercase">{u.email}</div>
                                </td>
                                <td className="p-5 text-slate-600">{u.nationality}</td>
                                <td className="p-5">
                                    {/* 💡 2. 멤버 등급별 컬러 구분 배지 */}
                                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter border ${u.tier === 'VIP' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                            u.tier === 'Gold' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                u.tier === 'Silver' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    u.tier === 'Member' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                        'bg-slate-100 text-slate-500 border-slate-200'
                                        }`}>
                                        {u.tier}
                                    </span>
                                </td>
                                <td className="p-5 text-slate-700">
                                    <span className="text-base">{u.total_points.toLocaleString()}</span>
                                    <span className="text-[10px] text-slate-300 ml-1">pts</span>
                                </td>
                                <td className="p-5 text-right">
                                    <button className="text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors font-black">Manage</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {displayUsers.length === 0 && (
                    <div className="p-24 text-center">
                        <p className="text-slate-400 font-black text-lg">No users found matching your criteria.</p>
                        <button onClick={() => { setSearchTerm(""); setFilterTier("ALL"); setFilterNation("ALL"); }} className="text-emerald-600 hover:underline mt-2 font-bold">Reset all filters</button>
                    </div>
                )}
            </div>

            {/* 📌 이메일 작성 모달 UI (기존 기능 유지 및 보강) */}
            {isEmailModalOpen && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <span>📧</span> Email Campaign Room
                            </h3>
                            <button onClick={() => setIsEmailModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-light">&times;</button>
                        </div>

                        <form onSubmit={submitEmailCampaign} className="p-8 overflow-y-auto space-y-6">
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between">
                                <span className="text-sm font-bold text-emerald-800">Target Recipients:</span>
                                <span className="bg-emerald-600 text-white px-4 py-1 rounded-full text-xs font-black shadow-sm">
                                    {tab === "ALL_USERS" ? "All Users" : tab === "BASIC" ? "Basic Only" : "Members Only"} ({displayUsers.length})
                                </span>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Campaign Subject</label>
                                <input
                                    type="text" required
                                    value={emailForm.subject}
                                    onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
                                    placeholder="Enter email subject line..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Cover Image URL (Optional)</label>
                                <input
                                    type="text"
                                    value={emailForm.imageUrl}
                                    onChange={e => setEmailForm({ ...emailForm, imageUrl: e.target.value })}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono"
                                    placeholder="https://example.com/promo-banner.jpg"
                                />
                                {emailForm.imageUrl && (
                                    <div className="mt-3 relative w-full h-40 rounded-xl overflow-hidden border border-slate-100 shadow-inner">
                                        <img src={emailForm.imageUrl} className="w-full h-full object-cover" alt="Preview" onError={(e) => e.target.src = "https://placehold.co/600x400?text=Invalid+Image+URL"} />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Message Content</label>
                                <textarea
                                    required rows="8"
                                    value={emailForm.content}
                                    onChange={e => setEmailForm({ ...emailForm, content: e.target.value })}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
                                    placeholder="Write your marketing message here. HTML is supported."
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsEmailModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-colors">Cancel</button>
                                <button
                                    type="submit"
                                    disabled={isSending || displayUsers.length === 0}
                                    className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                                >
                                    {isSending ? "🚀 Sending..." : `📧 Blast to ${displayUsers.length} Users`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}