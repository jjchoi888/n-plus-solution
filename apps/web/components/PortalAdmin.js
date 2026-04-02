"use client";
import React, { useState, useEffect } from "react";

// 💡 백엔드 포트 직접 지정 (클라우드 환경 대응)
const BASE_URL = 'http://136.117.49.111:8000';

export default function PortalAdmin() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loginId, setLoginId] = useState("");
    const [loginPw, setLoginPw] = useState("");
    const [loginError, setLoginError] = useState("");
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    const [activeTab, setActiveTab] = useState("DASHBOARD");
    const [searchQuery, setSearchQuery] = useState("");
    const [partners, setPartners] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // 성공/에러 알림 토스트 메시지 상태
    const [toastMessage, setToastMessage] = useState("");

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(""), 3000);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError("");
        setIsAuthenticating(true);

        try {
            console.log(`[HQ Auth] Attempting login...`);
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

    const fetchPartners = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/api/admin/partners`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setPartners(data);
            } else {
                console.error("Data received is not an array:", data);
            }
        } catch (error) {
            console.error("Failed to fetch partners:", error);
            showToast("❌ Failed to load partner data from server.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isLoggedIn) fetchPartners();
    }, [isLoggedIn]);

    // 💡 인라인 수정 핸들러 (입력 시 로컬 상태만 우선 변경)
    const handleLocalChange = (code, field, value) => {
        setPartners(prev => prev.map(p => p.code === code ? { ...p, [field]: value } : p));
    };

    // 💡 [기능 1] 과금/구독 정보 DB 저장 (Save Billing)
    const handleSaveBilling = async (partner) => {
        try {
            const res = await fetch(`${BASE_URL}/api/admin/billing/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    hotel_code: partner.code,
                    plan: partner.plan,
                    status: partner.status,
                    mrr: partner.mrr
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✅ [${partner.code}] Billing updated successfully!`);
                fetchPartners(); // 새로고침
            } else showToast("❌ Failed to update billing.");
        } catch (e) {
            showToast("❌ Network Error while saving billing.");
        }
    };

    // 💡 [기능 2] 도메인 정보 DB 저장 (Save Domain)
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
                showToast(`🌐 [${partner.code}] Domain linked successfully!`);
                fetchPartners(); // 새로고침
            } else showToast("❌ Failed to link domain.");
        } catch (e) {
            showToast("❌ Network Error while linking domain.");
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

    // 검색 필터링 적용
    const filteredPartners = partners.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-screen bg-slate-50 font-sans font-medium selection:bg-emerald-500 selection:text-white animate-fade-in relative">

            {/* 💡 전역 토스트 알림창 */}
            {toastMessage && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-3 animate-fade-in-up border border-slate-700">
                    {toastMessage}
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
                        {["DASHBOARD", "PARTNERS", "BILLING", "DOMAINS"].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "hover:bg-slate-900 hover:text-white"}`}>
                                <span className="text-lg">{tab === "DASHBOARD" ? "📊" : tab === "PARTNERS" ? "🏨" : tab === "BILLING" ? "💳" : "🌐"}</span>
                                {tab === "DASHBOARD" ? "Dashboard" : tab === "PARTNERS" ? "Partner Hotels" : tab === "BILLING" ? "Billing & Plans" : "Domain Settings"}
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
                        <button onClick={() => setIsLoggedIn(false)} className="text-slate-500 hover:text-red-400 transition-colors p-2" title="Logout">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        </button>
                    </div>
                </div>
            </aside>

            {/* 📌 메인 콘텐츠 영역 */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
                    <h1 className="text-xl font-black text-slate-800">
                        {activeTab === "DASHBOARD" && "HQ Overview"}
                        {activeTab === "PARTNERS" && "Partner Management"}
                        {activeTab === "BILLING" && "Subscription Billing Management"}
                        {activeTab === "DOMAINS" && "Custom Domain Assignments"}
                    </h1>

                    {/* 💡 검색창 (모든 탭에서 사용 가능하도록 헤더 우측에 배치) */}
                    {activeTab !== "DASHBOARD" && (
                        <div className="relative w-64">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                            <input
                                type="text"
                                placeholder="Search property..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm bg-slate-50"
                            />
                        </div>
                    )}
                </header>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">

                    {/* ========================================================= */}
                    {/* DASHBOARD */}
                    {/* ========================================================= */}
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

                    {/* ========================================================= */}
                    {/* PARTNERS */}
                    {/* ========================================================= */}
                    {activeTab === "PARTNERS" && (
                        <div className="animate-fade-in max-w-6xl mx-auto">
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8 text-center text-slate-500 font-bold">
                                View partner general info here. (Use Search bar above). <br /> Please navigate to 'Billing' or 'Domains' to edit specific settings.
                            </div>
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* 💡 과금 및 플랜 관리 (BILLING) */}
                    {/* ========================================================= */}
                    {activeTab === "BILLING" && (
                        <div className="animate-fade-in max-w-7xl mx-auto">
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h2 className="text-lg font-black text-slate-800">Subscription Control Panel</h2>
                                    <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">Changes apply immediately to partner systems.</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                                <th className="p-4 font-black">Property Code</th>
                                                <th className="p-4 font-black">Subscription Plan</th>
                                                <th className="p-4 font-black">MRR (₱)</th>
                                                <th className="p-4 font-black">Account Status</th>
                                                <th className="p-4 font-black text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm font-bold text-slate-800">
                                            {filteredPartners.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="p-8 text-center text-slate-400 font-bold">No partners found. Register a hotel first or clear your search.</td>
                                                </tr>
                                            ) : (
                                                filteredPartners.map(p => (
                                                    <tr key={`bill_${p.code}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                        <td className="p-4">
                                                            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-mono text-xs shadow-inner">{p.code}</span>
                                                            <div className="text-[10px] text-slate-400 mt-1">{p.name}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <select
                                                                value={p.plan}
                                                                onChange={(e) => handleLocalChange(p.code, 'plan', e.target.value)}
                                                                className="bg-white border border-slate-300 text-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm cursor-pointer w-full max-w-[200px]"
                                                            >
                                                                <option value="Basic PMS">Basic PMS</option>
                                                                <option value="Pro Cloud">Pro Cloud</option>
                                                                <option value="Enterprise Suite">Enterprise Suite</option>
                                                            </select>
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

                    {/* ========================================================= */}
                    {/* 💡 도메인 연결 관리 (DOMAINS) */}
                    {/* ========================================================= */}
                    {activeTab === "DOMAINS" && (
                        <div className="animate-fade-in max-w-5xl mx-auto">
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h2 className="text-lg font-black text-slate-800">Domain Assignments</h2>
                                    <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">Assign custom URLs to partners</span>
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