"use client";
import React, { useState, useEffect } from "react";

export default function PortalAdmin() {
    const [activeTab, setActiveTab] = useState("DASHBOARD");
    const [searchQuery, setSearchQuery] = useState("");
    const [partners, setPartners] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // 💡 [API 연동] 백엔드에서 실제 파트너 호텔 현황 데이터를 불러옵니다.
    useEffect(() => {
        const fetchPartners = async () => {
            try {
                const res = await fetch('/api/admin/partners');
                const data = await res.json();
                if (Array.isArray(data)) {
                    setPartners(data);
                }
            } catch (error) {
                console.error("Failed to fetch partners:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPartners();
    }, []);

    // 상단 요약 통계 계산
    const totalPartners = partners.length;
    const activePartners = partners.filter(p => p.status === "Active").length;
    const totalMRR = partners.filter(p => p.status === "Active").reduce((sum, p) => sum + p.mrr, 0);
    const totalBookings = partners.reduce((sum, p) => sum + (p.bookings || 0), 0); // 실제 예약 건수 합산

    const filteredPartners = partners.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return <div className="h-screen flex items-center justify-center bg-slate-50 font-bold text-slate-500">Loading HQ Dashboard...</div>;
    }

    return (
        <div className="flex h-screen bg-slate-50 font-sans font-medium selection:bg-emerald-500 selection:text-white">

            {/* 📌 좌측 다크 사이드바 (마스터 관리자용) */}
            <aside className="w-64 bg-slate-950 text-slate-300 flex flex-col shadow-2xl z-20 shrink-0">
                <div className="h-20 flex items-center px-6 border-b border-slate-800 shrink-0 bg-slate-950">
                    <div className="text-2xl font-black text-white tracking-tight flex items-center gap-1">
                        <span className="text-emerald-500">n+</span> Portal HQ
                    </div>
                </div>

                <div className="p-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-4">Main Menu</p>
                    <nav className="space-y-2">
                        <button onClick={() => setActiveTab("DASHBOARD")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "DASHBOARD" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "hover:bg-slate-900 hover:text-white"}`}>
                            <span className="text-lg">📊</span> Dashboard
                        </button>
                        <button onClick={() => setActiveTab("PARTNERS")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "PARTNERS" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "hover:bg-slate-900 hover:text-white"}`}>
                            <span className="text-lg">🏨</span> Partner Hotels
                        </button>
                        <button onClick={() => setActiveTab("BILLING")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "BILLING" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "hover:bg-slate-900 hover:text-white"}`}>
                            <span className="text-lg">💳</span> Billing & Invoices
                        </button>
                        <button onClick={() => setActiveTab("DOMAINS")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "DOMAINS" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "hover:bg-slate-900 hover:text-white"}`}>
                            <span className="text-lg">🌐</span> Domain Approvals
                        </button>
                    </nav>
                </div>

                <div className="mt-auto p-6 border-t border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-black text-white">HQ</div>
                        <div>
                            <p className="text-sm font-bold text-white">System Admin</p>
                            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Super User</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* 📌 메인 콘텐츠 영역 */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">

                <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
                    <h1 className="text-xl font-black text-slate-800">
                        {activeTab === "DASHBOARD" && "HQ Overview"}
                        {activeTab === "PARTNERS" && "Partner Management"}
                        {activeTab === "BILLING" && "Subscription Billing"}
                        {activeTab === "DOMAINS" && "Custom Domain Requests"}
                    </h1>
                    <div className="flex items-center gap-4">
                        <button className="relative w-10 h-10 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors">
                            🔔
                            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></span>
                        </button>
                    </div>
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
                                        {/* 💡 [수정] 가짜 데이터 대신 DB에서 불러온 진짜 예약 건수 총합을 보여줍니다 */}
                                        <h3 className="text-4xl font-black text-slate-800">{totalBookings.toLocaleString()}</h3>
                                    </div>
                                    <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center text-2xl">⚡</div>
                                </div>
                            </div>

                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h2 className="text-lg font-black text-slate-800">Recently Joined Partners</h2>
                                    <button onClick={() => setActiveTab("PARTNERS")} className="text-sm font-bold text-emerald-600 hover:text-emerald-700">View All →</button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-200">
                                                <th className="p-4 font-bold">Hotel Name</th>
                                                <th className="p-4 font-bold">Code</th>
                                                <th className="p-4 font-bold">Plan</th>
                                                <th className="p-4 font-bold">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm text-slate-700 font-bold">
                                            {partners.slice(0, 3).map(p => (
                                                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 text-slate-900">{p.name}</td>
                                                    <td className="p-4"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono text-xs">{p.code}</span></td>
                                                    <td className="p-4">{p.plan}</td>
                                                    <td className="p-4">
                                                        <span className={`px-3 py-1 rounded-full text-[10px] tracking-widest uppercase ${p.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : p.status === 'Onboarding' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                                            {p.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "PARTNERS" && (
                        <div className="animate-fade-in max-w-6xl mx-auto">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                <div className="relative w-full sm:w-80">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                                    <input
                                        type="text"
                                        placeholder="Search by hotel name or code..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm bg-white shadow-sm"
                                    />
                                </div>
                                <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 rounded-xl shadow-md transition-all active:scale-95 text-sm whitespace-nowrap">
                                    + Register New Partner
                                </button>
                            </div>

                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                                <th className="p-5 font-black">Hotel / Property</th>
                                                <th className="p-5 font-black">Code</th>
                                                <th className="p-5 font-black">Sub Domain</th>
                                                <th className="p-5 font-black text-center">Bookings</th>
                                                <th className="p-5 font-black text-center">Status</th>
                                                <th className="p-5 font-black text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm text-slate-700 font-bold">
                                            {filteredPartners.map(p => (
                                                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                                                    <td className="p-5">
                                                        <div className="text-slate-900 text-base">{p.name}</div>
                                                        <div className="text-xs text-slate-400 font-medium mt-1">Joined {p.joinDate}</div>
                                                    </td>
                                                    <td className="p-5">
                                                        <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded font-mono text-xs shadow-inner">{p.code}</span>
                                                    </td>
                                                    <td className="p-5">
                                                        {p.domain === 'Pending' ? (
                                                            <span className="text-orange-500 bg-orange-50 px-2 py-1 rounded text-xs">Pending Review</span>
                                                        ) : (
                                                            <a href={`https://${p.domain}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{p.domain}</a>
                                                        )}
                                                    </td>
                                                    <td className="p-5 text-center">
                                                        {/* 💡 [신규] DB에서 불러온 실제 예약 건수 표시 */}
                                                        <div className="text-slate-800">{p.bookings}</div>
                                                    </td>
                                                    <td className="p-5 text-center">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] tracking-widest uppercase font-black ${p.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : p.status === 'Overdue' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                                                            {p.status === 'Active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                                                            {p.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-5 text-right space-x-2">
                                                        <button className="text-slate-400 hover:text-emerald-600 p-2 transition-colors tooltip" title="Edit Settings">⚙️</button>
                                                        <button className="text-slate-400 hover:text-blue-600 p-2 transition-colors tooltip" title="View PMS Data">🖥️</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredPartners.length === 0 && (
                                                <tr>
                                                    <td colSpan="6" className="p-10 text-center text-slate-400 font-bold">No partners found matching "{searchQuery}"</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {(activeTab === "BILLING" || activeTab === "DOMAINS") && (
                        <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in pb-20">
                            <div className="text-6xl mb-6">🚧</div>
                            <h2 className="text-2xl font-black text-slate-800 mb-2">Module Under Construction</h2>
                            <p className="text-slate-500 font-medium">The {activeTab.toLowerCase()} management module will be available in the next update.</p>
                        </div>
                    )}

                </div>
            </main>

        </div>
    );
}