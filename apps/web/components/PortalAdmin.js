"use client";
import React, { useState, useEffect } from "react";

const BASE_URL = 'http://136.117.49.111:8000';

const TAB_TITLES = {
    DASHBOARD: "HQ Overview",
    PARTNERS: "Partner Management",
    AGENTS: "Sales Representatives (Commissions)",
    BILLING: "Billing & Commission Management",
    DOMAINS: "Custom Domain Assignments"
};

export default function PortalAdmin() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loginId, setLoginId] = useState("");
    const [loginPw, setLoginPw] = useState("");
    const [loginError, setLoginError] = useState("");
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    const [activeTab, setActiveTab] = useState("DASHBOARD");
    const [searchQuery, setSearchQuery] = useState("");
    const [partners, setPartners] = useState([]);
    const [agents, setAgents] = useState([]); // 💡 실제 DB 에이전트 상태
    const [isLoading, setIsLoading] = useState(true);

    const [toastMessage, setToastMessage] = useState("");

    // 💡 신규 에이전트 등록 모달 상태
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [newAgent, setNewAgent] = useState({ agent_id: "", name: "", tier: "3", parent_agent_id: "HQ", commission_rate: "" });

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(""), 3000);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError("");
        setIsAuthenticating(true);

        try {
            const res = await fetch(`${BASE_URL}/api/hq-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: loginId, password: loginPw })
            });
            const data = await res.json();

            if (data.success && data.role === 'SUPER_ADMIN') {
                setIsLoggedIn(true);
            } else {
                setLoginError("Invalid HQ credentials or insufficient permissions.");
            }
        } catch (err) {
            setLoginError("Failed to connect to the HQ server.");
        } finally {
            setIsAuthenticating(false);
        }
    };

    // 💡 [수정] 백엔드에서 진짜 파트너와 영업사원 목록을 각각 불러옵니다.
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [partnerRes, agentRes] = await Promise.all([
                fetch(`${BASE_URL}/api/admin/partners`),
                fetch(`${BASE_URL}/api/admin/agents`)
            ]);

            const pData = await partnerRes.json();
            const aData = await agentRes.json();

            if (Array.isArray(pData)) setPartners(pData);
            if (Array.isArray(aData)) setAgents(aData);
        } catch (error) {
            showToast("❌ Failed to load data from server.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isLoggedIn) fetchData();
    }, [isLoggedIn]);

    const handleLocalChange = (code, field, value) => {
        setPartners(prev => prev.map(p => p.code === code ? { ...p, [field]: value } : p));
    };

    // 💡 [수정] Billing 업데이트 시 agent_id 도 함께 전송
    const handleSaveBilling = async (partner) => {
        try {
            const res = await fetch(`${BASE_URL}/api/admin/billing/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    hotel_code: partner.code,
                    plan: "Enterprise Suite",
                    status: partner.status,
                    mrr: partner.mrr,
                    agent_id: partner.agent_id // 새로 추가된 부분
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✅ [${partner.code}] Billing & Agent updated!`);
                fetchData();
            } else showToast("❌ Failed to update.");
        } catch (e) {
            showToast("❌ Network Error.");
        }
    };

    const handleSaveDomain = async (partner) => {
        try {
            const res = await fetch(`${BASE_URL}/api/admin/domains/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    hotel_code: partner.code,
                    domain: partner.domain === "Pending" ? "" : partner.domain
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`🌐 [${partner.code}] Domain linked!`);
                fetchData();
            } else showToast("❌ Failed to link domain.");
        } catch (e) {
            showToast("❌ Network Error.");
        }
    };

    // 💡 [신규] 영업사원 등록 (Register Agent)
    const handleRegisterAgent = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${BASE_URL}/api/admin/agents/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newAgent)
            });
            const data = await res.json();
            if (data.success) {
                showToast("✅ New Agent registered successfully!");
                setIsAgentModalOpen(false);
                setNewAgent({ agent_id: "", name: "", tier: "3", parent_agent_id: "HQ", commission_rate: "" });
                fetchData(); // 등록 후 데이터 즉시 새로고침
            } else {
                showToast(`❌ Registration Failed: ${data.message}`);
            }
        } catch (error) {
            showToast("❌ Network Error.");
        }
    };

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans selection:bg-emerald-500 selection:text-white relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-emerald-500/20 blur-[120px] rounded-full pointer-events-none"></div>
                <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 relative z-10 animate-fade-in-up">
                    <div className="text-center mb-10">
                        <div className="text-4xl font-black text-white tracking-tight flex items-center justify-center gap-1 mb-2">
                            <span className="text-emerald-500">n+</span> Portal HQ
                        </div>
                        <p className="text-slate-400 text-sm font-bold tracking-widest uppercase">Master Administration</p>
                    </div>
                    {loginError && <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm font-bold text-center p-3 rounded-xl mb-6">{loginError}</div>}
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-[10px] uppercase tracking-widest font-black text-slate-500 mb-2">Master ID</label>
                            <input type="text" required value={loginId} onChange={(e) => setLoginId(e.target.value)} className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors" placeholder="Admin ID" />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase tracking-widest font-black text-slate-500 mb-2">Password</label>
                            <input type="password" required value={loginPw} onChange={(e) => setLoginPw(e.target.value)} className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors tracking-widest" placeholder="••••••••" />
                        </div>
                        <button type="submit" disabled={isAuthenticating} className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl hover:bg-emerald-500 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 disabled:opacity-50 mt-4">
                            {isAuthenticating ? "AUTHENTICATING..." : "ACCESS HQ PORTAL"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-50 font-bold text-slate-500">Loading HQ Dashboard...</div>;

    const totalPartners = partners.length;
    const activePartners = partners.filter(p => p.status === "Active").length;
    const totalMRR = partners.filter(p => p.status === "Active").reduce((sum, p) => sum + Number(p.mrr || 0), 0);
    const totalBookings = partners.reduce((sum, p) => sum + (p.bookings || 0), 0);

    const filteredPartners = partners.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const SIDEBAR_MENUS = [
        { id: "DASHBOARD", label: "HQ Overview", icon: "📊" },
        { id: "PARTNERS", label: "Partner Hotels", icon: "🏨" },
        { id: "AGENTS", label: "Sales Agents", icon: "🤝" },
        { id: "BILLING", label: "Billing & Plans", icon: "💳" },
        { id: "DOMAINS", label: "Domain Settings", icon: "🌐" }
    ];

    return (
        <div className="flex h-screen bg-slate-50 font-sans font-medium selection:bg-emerald-500 selection:text-white animate-fade-in relative">

            {/* 전역 토스트 알림창 */}
            {toastMessage && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-3 animate-fade-in-up border border-slate-700">
                    {toastMessage}
                </div>
            )}

            {/* 📌 에이전트 등록 모달 (팝업창) */}
            {isAgentModalOpen && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800">Register New Agent</h3>
                            <button onClick={() => setIsAgentModalOpen(false)} className="text-slate-400 hover:text-red-500 text-xl font-bold">&times;</button>
                        </div>
                        <form onSubmit={handleRegisterAgent} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Agent ID</label>
                                <input type="text" required value={newAgent.agent_id} onChange={e => setNewAgent({ ...newAgent, agent_id: e.target.value })} className="w-full border rounded-xl px-4 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="e.g. T2-MS-045" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company / Agent Name</label>
                                <input type="text" required value={newAgent.name} onChange={e => setNewAgent({ ...newAgent, name: e.target.value })} className="w-full border rounded-xl px-4 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="e.g. Metro Sales Inc." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tier Level</label>
                                    <select value={newAgent.tier} onChange={e => setNewAgent({ ...newAgent, tier: e.target.value })} className="w-full border rounded-xl px-4 py-2 outline-none focus:border-emerald-500">
                                        <option value="1">Tier 1 (Master)</option>
                                        <option value="2">Tier 2 (Branch)</option>
                                        <option value="3">Tier 3 (Rep)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Commission (%)</label>
                                    <input type="number" required value={newAgent.commission_rate} onChange={e => setNewAgent({ ...newAgent, commission_rate: e.target.value })} className="w-full border rounded-xl px-4 py-2 outline-none focus:border-emerald-500" placeholder="e.g. 20" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Parent Agency</label>
                                <select value={newAgent.parent_agent_id} onChange={e => setNewAgent({ ...newAgent, parent_agent_id: e.target.value })} className="w-full border rounded-xl px-4 py-2 outline-none focus:border-emerald-500">
                                    <option value="HQ">Directly Under HQ</option>
                                    {agents.map(ag => (
                                        <option key={`opt_${ag.agent_id}`} value={ag.agent_id}>[{ag.tier}] {ag.name} ({ag.agent_id})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsAgentModalOpen(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">Cancel</button>
                                <button type="submit" className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md">Register</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 📌 좌측 다크 사이드바 */}
            <aside className="w-64 bg-slate-950 text-slate-300 flex flex-col shadow-2xl z-20 shrink-0">
                <div className="h-20 flex items-center px-6 border-b border-slate-800 shrink-0 bg-slate-950">
                    <div className="text-2xl font-black text-white tracking-tight flex items-center gap-1">
                        <span className="text-emerald-500">n+</span> Portal HQ
                    </div>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-4">Main Menu</p>
                    <nav className="space-y-2">
                        {SIDEBAR_MENUS.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-left outline-none transition-colors duration-300 ease-in-out ${activeTab === item.id
                                        ? "bg-emerald-500/20 text-emerald-400"
                                        : "bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                                    }`}
                            >
                                <span className="text-lg w-6 text-center">{item.icon}</span>
                                <span className="flex-1 whitespace-nowrap">{item.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="mt-auto p-6 border-t border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center font-black text-white shadow-lg">HQ</div>
                            <div>
                                <p className="text-sm font-bold text-white truncate max-w-[100px]">{loginId}</p>
                                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Super User</p>
                            </div>
                        </div>
                        <button onClick={() => setIsLoggedIn(false)} className="text-slate-500 hover:text-red-400 transition-colors p-2 outline-none focus:outline-none" title="Logout">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        </button>
                    </div>
                </div>
            </aside>

            {/* 📌 메인 콘텐츠 영역 */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
                    <h1 className="text-xl font-black text-slate-800 transition-none">
                        {TAB_TITLES[activeTab]}
                    </h1>

                    {activeTab !== "DASHBOARD" && (
                        <div className="relative w-64">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm bg-slate-50"
                            />
                        </div>
                    )}
                </header>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">

                    {activeTab === "DASHBOARD" && (
                        <div className="animate-fade-in space-y-8 max-w-6xl mx-auto">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Active Partners</p>
                                        <h3 className="text-4xl font-black text-slate-800">{activePartners} <span className="text-lg text-slate-400 font-medium">/ {totalPartners}</span></h3>
                                    </div>
                                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl">🏨</div>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Monthly Recurring Revenue</p>
                                        <h3 className="text-3xl font-black text-emerald-600">₱{totalMRR.toLocaleString()}</h3>
                                    </div>
                                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl">📈</div>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Global Direct Bookings</p>
                                        <h3 className="text-4xl font-black text-slate-800">{totalBookings.toLocaleString()}</h3>
                                    </div>
                                    <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center text-2xl">⚡</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "PARTNERS" && (
                        <div className="animate-fade-in max-w-7xl mx-auto">
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h2 className="text-lg font-black text-slate-800">Partner Hotel Directory</h2>
                                    <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">Total {filteredPartners.length} Properties</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                                <th className="p-4 font-black">Property Details</th>
                                                <th className="p-4 font-black">Sales Agent</th>
                                                <th className="p-4 font-black text-center">Total Bookings</th>
                                                <th className="p-4 font-black text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm font-bold text-slate-800">
                                            {filteredPartners.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="p-8 text-center text-slate-400 font-bold">No partners found.</td>
                                                </tr>
                                            ) : (
                                                filteredPartners.map(p => (
                                                    <tr key={`partner_${p.code}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                        <td className="p-4">
                                                            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-mono text-xs shadow-inner">{p.code}</span>
                                                            <div className="text-[12px] font-black text-slate-800 mt-2">{p.name}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">{p.agent_id || 'HQ Direct'}</span>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs">{p.bookings || 0}</span>
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <span className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-black border ${p.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                                                    p.status === 'Overdue' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                                                                }`}>
                                                                {p.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "AGENTS" && (
                        <div className="animate-fade-in max-w-6xl mx-auto">
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <div>
                                        <h2 className="text-lg font-black text-slate-800">Sales Representatives Tree</h2>
                                        <p className="text-xs font-bold text-slate-500 mt-1">Manage 3-Tier Commission Structure</p>
                                    </div>
                                    <button onClick={() => setIsAgentModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md transition-all active:scale-95">
                                        + Register Agent
                                    </button>
                                </div>
                                <div className="overflow-x-auto p-4">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                                <th className="p-4 font-black">Agent / Rep Name</th>
                                                <th className="p-4 font-black">Tier Level</th>
                                                <th className="p-4 font-black">Parent Agency</th>
                                                <th className="p-4 font-black">Commission</th>
                                                <th className="p-4 font-black text-center">Active Hotels</th>
                                                <th className="p-4 font-black text-right">Join Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm font-bold text-slate-800">
                                            {agents.length === 0 ? (
                                                <tr><td colSpan="6" className="p-6 text-center text-slate-400">No agents registered.</td></tr>
                                            ) : (
                                                agents.map(ag => (
                                                    <tr key={`ag_${ag.agent_id}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                        <td className="p-4">
                                                            <div className="text-slate-900">{ag.name}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono mt-1">{ag.agent_id}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={`px-2 py-1 rounded text-xs border ${ag.tier === 1 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                    ag.tier === 2 ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                                        'bg-slate-100 text-slate-600 border-slate-200'
                                                                }`}>
                                                                Tier {ag.tier}
                                                            </span>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="text-xs text-slate-500 bg-slate-50 border px-2 py-1 rounded">{ag.parent_agent_id}</span>
                                                        </td>
                                                        <td className="p-4 text-emerald-600 font-black">
                                                            {ag.commission_rate}%
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full">{ag.activeHotels || 0}</span>
                                                        </td>
                                                        <td className="p-4 text-right text-xs text-slate-400">
                                                            {ag.join_date}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "BILLING" && (
                        <div className="animate-fade-in max-w-7xl mx-auto">
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <div>
                                        <h2 className="text-lg font-black text-slate-800">Billing & Commission Control</h2>
                                        <p className="text-xs font-bold text-slate-500 mt-1">All properties default to Enterprise Suite.</p>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                                <th className="p-4 font-black">Property Code</th>
                                                <th className="p-4 font-black">System Plan & Assign Agent</th>
                                                <th className="p-4 font-black">MRR (₱)</th>
                                                <th className="p-4 font-black">Account Status</th>
                                                <th className="p-4 font-black text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm font-bold text-slate-800">
                                            {filteredPartners.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="p-8 text-center text-slate-400 font-bold">No partners found.</td>
                                                </tr>
                                            ) : (
                                                filteredPartners.map(p => (
                                                    <tr key={`bill_${p.code}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                        <td className="p-4">
                                                            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-mono text-xs shadow-inner">{p.code}</span>
                                                            <div className="text-[10px] text-slate-400 mt-1">{p.name}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex flex-col gap-2">
                                                                <span className="text-emerald-700 font-black text-sm">Enterprise Suite</span>
                                                                {/* 💡 DB에서 불러온 에이전트 목록을 선택할 수 있는 드롭다운 추가 */}
                                                                <select
                                                                    value={p.agent_id || 'HQ Direct'}
                                                                    onChange={(e) => handleLocalChange(p.code, 'agent_id', e.target.value)}
                                                                    className="text-xs text-slate-600 bg-white border border-slate-300 rounded px-2 py-1 outline-none focus:border-emerald-500 cursor-pointer w-fit"
                                                                >
                                                                    <option value="HQ Direct">HQ Direct (No Commission)</option>
                                                                    {agents.map(ag => (
                                                                        <option key={`opt_${p.code}_${ag.agent_id}`} value={ag.agent_id}>[{ag.tier}] {ag.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <input
                                                                type="number"
                                                                value={p.mrr}
                                                                onChange={(e) => handleLocalChange(p.code, 'mrr', e.target.value)}
                                                                className="bg-white border border-slate-300 text-slate-700 rounded-lg px-3 py-2 w-28 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
                                                            />
                                                        </td>
                                                        <td className="p-4">
                                                            <select
                                                                value={p.status}
                                                                onChange={(e) => handleLocalChange(p.code, 'status', e.target.value)}
                                                                className={`border rounded-lg px-3 py-2 text-sm outline-none shadow-sm cursor-pointer font-black w-full max-w-[180px]
                                                                    ${p.status === 'Active' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                                                        p.status === 'Overdue' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-300 text-slate-600'}`}
                                                            >
                                                                <option value="Active">Active</option>
                                                                <option value="Onboarding">Onboarding</option>
                                                                <option value="Overdue">Overdue (Lock System)</option>
                                                                <option value="Cancelled">Cancelled</option>
                                                            </select>
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <button
                                                                onClick={() => handleSaveBilling(p)}
                                                                className="bg-slate-900 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs tracking-wider uppercase font-black transition-all shadow-md active:scale-95"
                                                            >
                                                                Save 💾
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "DOMAINS" && (
                        <div className="animate-fade-in max-w-5xl mx-auto">
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h2 className="text-lg font-black text-slate-800">Domain Assignments</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                                <th className="p-4 font-black w-1/4">Property Code</th>
                                                <th className="p-4 font-black w-2/4">Custom Domain (www.example.com)</th>
                                                <th className="p-4 font-black w-1/4 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm font-bold text-slate-800">
                                            {filteredPartners.length === 0 ? (
                                                <tr>
                                                    <td colSpan="3" className="p-8 text-center text-slate-400 font-bold">No partners found.</td>
                                                </tr>
                                            ) : (
                                                filteredPartners.map(p => (
                                                    <tr key={`dom_${p.code}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                        <td className="p-4">
                                                            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-mono text-xs shadow-inner">{p.code}</span>
                                                            <div className="text-[10px] text-slate-400 mt-1">{p.name}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="relative flex items-center">
                                                                <span className="absolute left-3 text-slate-400">🌐</span>
                                                                <input
                                                                    type="text"
                                                                    value={p.domain === "Pending" ? "" : p.domain}
                                                                    onChange={(e) => handleLocalChange(p.code, 'domain', e.target.value)}
                                                                    placeholder="e.g. www.hotelname.com"
                                                                    className="bg-white border border-slate-300 text-blue-600 font-mono tracking-tight rounded-lg pl-9 pr-3 py-2.5 w-full text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
                                                                />
                                                            </div>
                                                            {p.domain && p.domain !== "Pending" && (
                                                                <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span> Linked and Active
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <button
                                                                onClick={() => handleSaveDomain(p)}
                                                                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-xs tracking-wider uppercase font-black transition-all shadow-md active:scale-95"
                                                            >
                                                                Link Domain
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}