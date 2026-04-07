"use client";
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
// 💡 Next.js 환경에서 리치 텍스트 에디터(React-Quill)를 안전하게 불러오기 위한 설정
import dynamic from 'next/dynamic';
const ReactQuill = dynamic(() => import('react-quill'), {
    ssr: false,
    loading: () => <div className="h-[350px] bg-slate-50 animate-pulse rounded-2xl flex items-center justify-center font-bold text-slate-400">Loading Editor...</div>
});
import 'react-quill/dist/quill.snow.css';

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // 필터 상태 관리 (기존 유지)
    const [tab, setTab] = useState("ALL_USERS");
    const [searchTerm, setSearchTerm] = useState("");
    const [filterTier, setFilterTier] = useState("ALL");
    const [filterNation, setFilterNation] = useState("ALL");

    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailForm, setEmailForm] = useState({ subject: "", content: "" }); // content에 HTML 데이터 저장
    const [isSending, setIsSending] = useState(false);

    // 💡 에디터 툴바 구성 (글씨크기, 폰트, 정렬, 이미지, 링크 등)
    const modules = useMemo(() => ({
        toolbar: [
            [{ 'font': [] }, { 'size': ['small', false, 'large', 'huge'] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'align': [] }],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['link', 'image'], // 이미지 삽입 기능 활성화
            ['clean']
        ],
    }), []);

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

    // 💡 1. 섹션 구분 로직 (기존 유지)
    const basicUsers = users.filter(u => !u.is_membership_active);
    const memberUsers = users.filter(u => u.is_membership_active);

    // 💡 4. 필터링 로직 강화 (기존 유지)
    const displayUsers = (tab === "ALL_USERS" ? users : tab === "BASIC" ? basicUsers : memberUsers)
        .filter(u => {
            const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchTier = filterTier === "ALL" || u.tier === filterTier;
            const matchNation = filterNation === "ALL" || u.nationality === filterNation;
            return matchSearch && matchTier && matchNation;
        });

    const nations = ["ALL", ...new Set(users.map(u => u.nationality))];
    const tiers = ["ALL", "Basic", "Member", "Silver", "Gold", "VIP"];

    // 이메일 발송 처리 함수 (Resend API 연동 + 리치 텍스트 적용)
    const submitEmailCampaign = async (e) => {
        e.preventDefault();
        if (!confirm(`${displayUsers.length}명의 유저에게 이메일을 발송하시겠습니까?`)) return;

        setIsSending(true);
        try {
            await axios.post("/api/hq/send-marketing-email", {
                emails: displayUsers.map(u => u.email),
                subject: emailForm.subject,
                // 💡 에디터에서 작성된 HTML 내용을 그대로 전송합니다.
                content: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
                    ${emailForm.content}
                    <hr style="margin: 30px 0; border: 0; border-top: 1px solid #e2e8f0;" />
                    <p style="font-size: 12px; color: #94a3b8;">© 2026 n+ Solutions. All rights reserved.</p>
                </div>
                `
            });

            alert("이메일 발송이 성공적으로 시작되었습니다!");
            setIsEmailModalOpen(false);
            setEmailForm({ subject: "", content: "" });
        } catch (err) {
            alert("발송 중 에러가 발생했습니다.");
        } finally {
            setIsSending(false);
        }
    };

    if (loading) return <div className="p-20 text-center font-bold text-slate-400">Loading User Data...</div>;

    return (
        <div className="space-y-6 animate-fade-in pb-20 font-sans">
            {/* 상단 탭 구분 (기존 유지) */}
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

            {/* 필터 및 이메일 도구함 (기존 유지) */}
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

                    {/* 💡 작성 모달 열기 버튼 */}
                    <button
                        onClick={() => setIsEmailModalOpen(true)}
                        className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-black hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <span>📧</span> Write Campaign Email ({displayUsers.length})
                    </button>
                </div>
            </div>

            {/* 회원 리스트 테이블 (기존 유지) */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm font-bold">
                    <thead className="bg-slate-50 border-b border-slate-100 font-black text-slate-500 uppercase text-[11px] tracking-widest">
                        <tr><th className="p-5">User Info</th><th className="p-5">Nationality</th><th className="p-5">Tier Status</th><th className="p-5">Points</th><th className="p-5 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {displayUsers.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-5">
                                    <div className="text-slate-800 text-base">{u.name}</div>
                                    <div className="text-[11px] text-slate-400 font-mono uppercase">{u.email}</div>
                                </td>
                                <td className="p-5 text-slate-600 font-medium">{u.nationality}</td>
                                <td className="p-5">
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
                                    <button className="text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl font-black">Manage</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 📌 [업그레이드] 복합기능 리치 텍스트 에디터 모달 */}
            {isEmailModalOpen && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] border border-white/20">
                        {/* 헤더 */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <span>🎨</span> Email Campaign Designer
                                </h3>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                    Sending to: {displayUsers.length} Recipients
                                </p>
                            </div>
                            <button onClick={() => setIsEmailModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-3xl font-light">&times;</button>
                        </div>

                        <form onSubmit={submitEmailCampaign} className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-8 space-y-6 overflow-y-auto">
                                {/* 제목 입력 */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Campaign Subject</label>
                                    <input
                                        type="text" required
                                        value={emailForm.subject}
                                        onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })}
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg text-slate-800 placeholder:text-slate-300"
                                        placeholder="Enter a compelling subject line..."
                                    />
                                </div>

                                {/* 리치 텍스트 에디터 (글씨체, 정렬, 이미지 등) */}
                                <div className="flex flex-col min-h-[450px]">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Message Content (Rich Text)</label>
                                    <div className="flex-1 border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                                        <ReactQuill
                                            theme="snow"
                                            value={emailForm.content}
                                            onChange={(content) => setEmailForm({ ...emailForm, content })}
                                            modules={modules}
                                            placeholder="Start designing your email... You can copy & paste images directly here!"
                                            className="h-[380px] flex-1"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 하단 버튼 */}
                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0">
                                <button type="button" onClick={() => setIsEmailModalOpen(false)} className="px-8 py-4 bg-white border border-slate-200 text-slate-500 font-black rounded-2xl hover:bg-slate-100 transition-colors">Discard Draft</button>
                                <button
                                    type="submit"
                                    disabled={isSending || displayUsers.length === 0}
                                    className="flex-1 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-emerald-600 shadow-xl transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isSending ? "🚀 BLASTING EMAILS..." : `📧 SEND CAMPAIGN TO ${displayUsers.length} USERS`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 💡 에디터 스타일 커스텀 (Tailwind와 조화) */}
            <style jsx global>{`
                .ql-container { font-family: inherit; font-size: 16px; border: none !important; }
                .ql-toolbar { border: none !important; border-bottom: 1px solid #f1f5f9 !important; background: #f8fafc; padding: 12px !important; }
                .ql-editor { min-height: 380px; padding: 20px; line-height: 1.6; }
                .ql-editor.ql-blank::before { color: #cbd5e1; font-style: normal; }
                .ql-snow .ql-picker.ql-size .ql-picker-label::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item::before { content: 'Size'; }
            `}</style>
        </div>
    );
}