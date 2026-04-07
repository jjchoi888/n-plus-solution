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

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await axios.get("/api/hq/members");
                setUsers(res.data.members);
            } catch (err) {
                // 테스트용 확장 데이터
                setUsers([
                    { id: 1, name: "Jongwon Choi", email: "jjchoi888@gmail.com", nationality: "South Korea", is_membership_active: true, total_points: 1000, tier: "Member", created_at: "2026-04-01" },
                    { id: 2, name: "Juan Dela Cruz", email: "juan@example.com", nationality: "Philippines", is_membership_active: false, total_points: 0, tier: "Basic", created_at: "2026-04-05" },
                    { id: 3, name: "Maria Santos", email: "maria@test.com", nationality: "Philippines", is_membership_active: true, total_points: 5000, tier: "VIP", created_at: "2026-03-20" },
                    { id: 4, name: "Kenji Sato", email: "kenji@nplus.jp", nationality: "Japan", is_membership_active: true, total_points: 2500, tier: "Silver", created_at: "2026-04-02" },
                ]);
            } finally { setLoading(false); }
        };
        fetchUsers();
    }, []);

    // 💡 1. 섹션 구분 로직 (Basic vs Member)
    const basicUsers = users.filter(u => !u.is_membership_active);
    const memberUsers = users.filter(u => u.is_membership_active);

    const displayUsers = (tab === "ALL_USERS" ? users : tab === "BASIC" ? basicUsers : memberUsers)
        .filter(u => {
            const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchTier = filterTier === "ALL" || u.tier === filterTier;
            const matchNation = filterNation === "ALL" || u.nationality === filterNation;
            return matchSearch && matchTier && matchNation;
        });

    // 💡 3. 이메일 발송 기능 (마케팅용)
    const handleSendEmail = (targetType) => {
        const count = targetType === 'FILTERED' ? displayUsers.length :
            targetType === 'ALL' ? users.length :
                targetType === 'MEMBERS' ? memberUsers.length : basicUsers.length;

        if (confirm(`Send group email to ${count} users?`)) {
            alert(`Marketing email campaign initiated for: ${targetType}`);
            // 실제 API 연결 시: axios.post('/api/hq/send-marketing-email', { target: targetType, users: displayUsers });
        }
    };

    const nations = ["ALL", ...new Set(users.map(u => u.nationality))];
    const tiers = ["ALL", "Basic", "Member", "Silver", "Gold", "VIP"];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* 상단 탭 구분 (User / Member) */}
            <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 w-fit shadow-sm">
                {[
                    { id: "ALL_USERS", label: `Total (${users.length})` },
                    { id: "BASIC", label: `Basic Users (${basicUsers.length})` },
                    { id: "MEMBERS", label: `Rewards Members (${memberUsers.length})` }
                ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${tab === t.id ? "bg-slate-900 text-white shadow-md" : "text-slate-400 hover:text-slate-600"}`}>
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
                        <input type="text" placeholder="Name or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>

                    {/* 💡 4. 등급/국적 필터링 */}
                    <select value={filterTier} onChange={e => setFilterTier(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-emerald-500">
                        {tiers.map(t => <option key={t} value={t}>Tier: {t}</option>)}
                    </select>
                    <select value={filterNation} onChange={e => setFilterNation(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-emerald-500">
                        {nations.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>

                    {/* 💡 3. 그룹 이메일 버튼 */}
                    <div className="flex gap-2">
                        <button onClick={() => handleSendEmail('FILTERED')} className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-black hover:bg-emerald-700 shadow-sm transition-all">
                            📧 Send to Filtered ({displayUsers.length})
                        </button>
                        <button onClick={() => handleSendEmail(tab)} className="bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-black hover:bg-slate-900 shadow-sm transition-all">
                            📢 Send to All in Tab
                        </button>
                    </div>
                </div>
            </div>

            {/* 회원 리스트 테이블 */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
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
                                    <div className="text-slate-800">{u.name}</div>
                                    <div className="text-[11px] text-slate-400 font-mono uppercase">{u.email}</div>
                                </td>
                                <td className="p-5 text-slate-600">{u.nationality}</td>
                                <td className="p-5">
                                    {/* 💡 2. 멤버 등급별 컬러 구분 */}
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${u.tier === 'VIP' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                            u.tier === 'Gold' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                u.tier === 'Silver' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                                                    u.tier === 'Member' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                        'bg-slate-50 text-slate-400 border-slate-100'
                                        }`}>
                                        {u.tier}
                                    </span>
                                </td>
                                <td className="p-5 text-slate-700">{u.total_points.toLocaleString()} <span className="text-[10px] text-slate-300">pts</span></td>
                                <td className="p-5 text-right">
                                    <button className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">Edit</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {displayUsers.length === 0 && <div className="p-20 text-center text-slate-400 font-bold">No users found.</div>}
            </div>
        </div>
    );
}