"use client";
import React, { useState, useEffect } from "react";
import UserManagement from "./UserManagement";

const BASE_URL = '';

const TAB_TITLES = {
    DASHBOARD: "HQ Overview",
    PARTNERS: "Partner Management",
    AGENTS: "Sales Representatives (Commissions)",
    SETTLEMENT: "Commission Settlement", // 💡 신규 추가
    BILLING: "Billing & Commission Management",
    DOMAINS: "Custom Domain Assignments",
    USERs: "User & Membership Management"
};

const SIDEBAR_MENUS = [
    { id: "DASHBOARD", label: "HQ Overview", icon: "📊" },
    { id: "PARTNERS", label: "Partner Hotels", icon: "🏨" },
    { id: "USERS", label: "Registered Users", icon: "👤" },
    { id: "AGENTS", label: "Sales Agents", icon: "🤝" },
    { id: "SETTLEMENT", label: "Commissions", icon: "💰" }, // 💡 신규 추가
    { id: "BILLING", label: "Billing & Plans", icon: "💳" },
    { id: "DOMAINS", label: "Domain Settings", icon: "🌐" }
];

// 💡 [신규 추가 1] 재귀적으로 트리를 그려주는 컴포넌트 (파일 탐색기 스타일)
const AgentTreeNode = ({ node, level = 0, selectedId, onSelect }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className="select-none">
            <div
                className={`flex items-center py-2 px-3 rounded-xl cursor-pointer transition-all border border-transparent ${selectedId === node.agent_id
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm'
                    : 'hover:bg-slate-100 text-slate-700'
                    }`}
                style={{ marginLeft: `${level * 16}px` }}
                onClick={() => onSelect(node)}
            >
                <div
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                    className="w-5 h-5 flex items-center justify-center mr-2 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200 transition-colors"
                >
                    {hasChildren ? (isExpanded ? '▾' : '▸') : '•'}
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                    <span className="text-sm font-bold truncate leading-tight">{node.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[9px] px-1.5 rounded-sm font-black uppercase tracking-wider ${node.tier === 'Master' ? 'bg-blue-100 text-blue-700' :
                            node.tier === 'Branch' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-600'
                            }`}>{node.tier}</span>
                        <span className="text-[10px] font-mono text-slate-400 truncate">{node.agent_id}</span>
                    </div>
                </div>
            </div>
            {hasChildren && isExpanded && (
                <div className="mt-1 border-l-2 border-slate-100 ml-4 pl-2 space-y-1">
                    {node.children.map(child => (
                        <AgentTreeNode key={child.agent_id} node={child} level={0} selectedId={selectedId} onSelect={onSelect} />
                    ))}
                </div>
            )}
        </div>
    );
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
    const [agents, setAgents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [toastMessage, setToastMessage] = useState("");

    // 💡 신규 에이전트 등록 모달 상태 (비밀번호 및 Tier 초기값 Rep으로 변경)
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [newAgent, setNewAgent] = useState({ agent_id: "", password: "", name: "", tier: "Rep", parent_agent_id: "HQ", commission_rate: "" });
    const [isIdAvailable, setIsIdAvailable] = useState(null); // 중복 확인 상태

    const [selectedAgent, setSelectedAgent] = useState(null);
    const [isEditingAgent, setIsEditingAgent] = useState(false);
    const [editAgentData, setEditAgentData] = useState(null);

    // 💡 [신규 추가 2-2] 에이전트 정보 업데이트 (수정) 핸들러
    const handleUpdateAgent = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${BASE_URL}/api/admin/agents/update`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editAgentData)
            });
            const data = await res.json();
            if (data.success) {
                showToast("✅ Agent info updated successfully!");
                setIsEditingAgent(false);
                fetchData(); // DB 저장 후 전체 데이터 새로고침
            } else showToast(`❌ Update Failed.`);
        } catch (error) { showToast("❌ Network Error."); }
    };

    // 💡 [신규] 에이전트 삭제 핸들러
    const handleDeleteAgent = async (agentId) => {
        if (!window.confirm(`Are you sure you want to delete Agent [${agentId}]?\n\n* Agents with sub-agents or active hotels cannot be deleted.`)) return;
        try {
            const res = await fetch(`${BASE_URL}/api/admin/agents/${agentId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) { showToast("✅ Agent deleted successfully!"); setSelectedAgent(null); fetchData(); }
            else { showToast(`❌ Delete Failed: ${data.message}`); }
        } catch (e) { showToast("❌ Network Error."); }
    };

    // 💡 [신규 추가] 파트너 관리용 모달 상태
    const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
    const [isEditingPartner, setIsEditingPartner] = useState(false);
    const [partnerForm, setPartnerForm] = useState({
        code: "", name: "", master_id: "", master_pw: "", status: "Active", agent_id: "HQ Direct"
    });

    // 💡 파트너 폼 전송 핸들러 (등록 & 수정 공통)
    const handlePartnerSubmit = async (e) => {
        e.preventDefault();
        const url = isEditingPartner ? `${BASE_URL}/api/admin/partners/${partnerForm.code}` : `${BASE_URL}/api/admin/partners/register`;
        const method = isEditingPartner ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(partnerForm)
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✅ Partner successfully ${isEditingPartner ? 'updated' : 'registered'}!`);
                setIsPartnerModalOpen(false);
                fetchData(); // 표 새로고침
            } else {
                showToast(`❌ Error: ${data.message}`);
            }
        } catch (error) { showToast("❌ Network error."); }
    };

    // 💡 파트너 삭제 핸들러
    const handleDeletePartner = async (code, name) => {
        if (!window.confirm(`⚠️ [WARNING]\nAre you sure you want to completely delete '${name}'?\nThis will erase the hotel and ALL associated user accounts!`)) return;
        try {
            const res = await fetch(`${BASE_URL}/api/admin/partners/${code}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showToast("✅ Partner deleted successfully!");
                fetchData();
            } else { showToast(`❌ Delete Failed: ${data.message}`); }
        } catch (error) { showToast("❌ Network error."); }
    };

    // 💡 [신규] 롤업(차등) 커미션 정산 알고리즘 로직
    const calculateSettlement = (targetAgentId) => {
        const agentMap = {};
        agents.forEach(a => agentMap[a.agent_id] = a);

        let totalGross = 0; let totalNet = 0; let myCommission = 0; let hotelDetails = [];

        partners.filter(p => p.status === 'Active' && Number(p.mrr) > 0).forEach(hotel => {
            if (!hotel.agent_id || hotel.agent_id === 'HQ Direct') return;

            let currentAgentId = hotel.agent_id;
            let currentRate = 0;
            let pathPayouts = {};

            // 호텔부터 상위 본사(HQ)까지 올라가며 각 계층이 먹을 커미션 차액(%)을 계산
            while (currentAgentId && agentMap[currentAgentId]) {
                const agent = agentMap[currentAgentId];
                let payoutRate = agent.commission_rate - currentRate;
                if (payoutRate < 0) payoutRate = 0; // 역마진 방지

                pathPayouts[agent.agent_id] = payoutRate;
                currentRate = agent.commission_rate;
                currentAgentId = agent.parent_agent_id;
            }

            // 만약 내가 선택한 에이전트가 이 호텔의 커미션 라인에 포함되어 있다면?
            if (pathPayouts[targetAgentId] !== undefined) {
                const gross = Number(hotel.mrr);
                const net = gross * 0.88; // 💡 12% E.VAT 공제 (정산 원금)
                const targetPayoutRate = pathPayouts[targetAgentId]; // 내가 먹을 차액 %
                const targetEarned = net * (targetPayoutRate / 100);

                totalGross += gross; totalNet += net; myCommission += targetEarned;
                hotelDetails.push({ hotelCode: hotel.code, hotelName: hotel.name, directAgent: hotel.agent_id, gross, net, myRate: targetPayoutRate, earned: targetEarned });
            }
        });
        return { totalGross, totalNet, myCommission, hotelDetails };
    };

    // 💡 [신규 추가 2-3] 트리 구조 빌드 함수 (return문 바로 위쯤에 추가)
    const buildAgentTree = () => {
        const agentMap = {};
        const roots = [];
        agents.forEach(ag => { agentMap[ag.agent_id] = { ...ag, children: [] }; });
        agents.forEach(ag => {
            if (ag.parent_agent_id === 'HQ' || !agentMap[ag.parent_agent_id]) roots.push(agentMap[ag.agent_id]);
            else agentMap[ag.parent_agent_id].children.push(agentMap[ag.agent_id]);
        });
        return roots;
    };
    const agentTree = buildAgentTree();

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
                // 💡 로그인 성공 시 브라우저 세션에 저장 (창을 닫기 전까지 유지)
                sessionStorage.setItem("hq_logged_in", "true");
                setIsLoggedIn(true);
            } else {
                setLoginError("Invalid HQ credentials.");
            }
        } catch (err) {
            setLoginError("Failed to connect to the HQ server.");
        } finally {
            setIsAuthenticating(false);
        }
    };

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

    // 💡 로그인이 되면 데이터를 불러옴
    useEffect(() => {
        if (isLoggedIn) fetchData();
    }, [isLoggedIn]);

    // 💡 새로고침 시 로그인 상태 복구
    useEffect(() => {
        const isAuth = sessionStorage.getItem("hq_logged_in");
        if (isAuth === "true") {
            setIsLoggedIn(true);
        }
    }, []);

    const handleLocalChange = (code, field, value) => {
        setPartners(prev => prev.map(p => p.code === code ? { ...p, [field]: value } : p));
    };

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
                    agent_id: partner.agent_id
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

    // 💡 [신규] ID 중복 확인 핸들러
    const handleCheckAgentId = async () => {
        if (!newAgent.agent_id.trim()) {
            return showToast("Please enter an Agent ID first.");
        }
        try {
            const res = await fetch(`${BASE_URL}/api/admin/agents/check-id`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agent_id: newAgent.agent_id })
            });
            const data = await res.json();
            if (data.success && data.available) {
                setIsIdAvailable(true);
                showToast("✅ Agent ID is available!");
            } else {
                setIsIdAvailable(false);
                showToast("❌ Agent ID already exists.");
            }
        } catch (error) {
            showToast("❌ Network error during ID check.");
        }
    };

    // 💡 에이전트 등록 핸들러
    const handleRegisterAgent = async (e) => {
        e.preventDefault();

        // ID 중복 확인 필수 체크
        if (isIdAvailable !== true) {
            return showToast("⚠️ Please check Agent ID availability first.");
        }

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
                setNewAgent({ agent_id: "", password: "", name: "", tier: "Rep", parent_agent_id: "HQ", commission_rate: "" });
                setIsIdAvailable(null);
                fetchData();
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

    const totalPortalBookings = partners.reduce((sum, p) => sum + (p.portalBookings || 0), 0);
    const totalWebBookings = partners.reduce((sum, p) => sum + (p.webBookings || 0), 0);

    const filteredPartners = partners.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-screen bg-slate-50 font-sans font-medium selection:bg-emerald-500 selection:text-white animate-fade-in relative">

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
                            <button onClick={() => { setIsAgentModalOpen(false); setIsIdAvailable(null); }} className="text-slate-400 hover:text-red-500 text-xl font-bold">&times;</button>
                        </div>
                        <form onSubmit={handleRegisterAgent} className="space-y-4">
                            {/* 💡 [수정] Agent ID 중복확인 기능 추가 */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Agent ID</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        required
                                        value={newAgent.agent_id}
                                        onChange={e => { setNewAgent({ ...newAgent, agent_id: e.target.value }); setIsIdAvailable(null); }}
                                        className={`w-full border rounded-xl px-4 py-2 outline-none focus:ring-1 transition-colors ${isIdAvailable === true ? "border-emerald-500 focus:ring-emerald-500" :
                                            isIdAvailable === false ? "border-red-500 focus:ring-red-500" : "focus:border-blue-500 focus:ring-blue-500"
                                            }`}
                                        placeholder="e.g. MS-045"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCheckAgentId}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors whitespace-nowrap"
                                    >
                                        Check ID
                                    </button>
                                </div>
                                {isIdAvailable === true && <p className="text-[10px] text-emerald-600 mt-1 font-bold">✅ Available ID</p>}
                                {isIdAvailable === false && <p className="text-[10px] text-red-600 mt-1 font-bold">❌ Already in use</p>}
                            </div>

                            {/* 💡 [수정] 비밀번호 입력란 추가 */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                                <input type="password" required value={newAgent.password} onChange={e => setNewAgent({ ...newAgent, password: e.target.value })} className="w-full border rounded-xl px-4 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="••••••••" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company / Agent Name</label>
                                <input type="text" required value={newAgent.name} onChange={e => setNewAgent({ ...newAgent, name: e.target.value })} className="w-full border rounded-xl px-4 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="e.g. Metro Sales Inc." />
                            </div>

                            {/* 💡 [수정] Tier 구조 명칭 변경 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tier Level</label>
                                    <select value={newAgent.tier} onChange={e => setNewAgent({ ...newAgent, tier: e.target.value })} className="w-full border rounded-xl px-4 py-2 outline-none focus:border-blue-500 cursor-pointer bg-white">
                                        <option value="Master">Master</option>
                                        <option value="Branch">Branch</option>
                                        <option value="Rep">Rep</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Commission (%)</label>
                                    <input type="number" required value={newAgent.commission_rate} onChange={e => setNewAgent({ ...newAgent, commission_rate: e.target.value })} className="w-full border rounded-xl px-4 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="e.g. 20" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Parent Agency</label>
                                <select value={newAgent.parent_agent_id} onChange={e => setNewAgent({ ...newAgent, parent_agent_id: e.target.value })} className="w-full border rounded-xl px-4 py-2 outline-none focus:border-blue-500 cursor-pointer bg-white">
                                    <option value="HQ">Directly Under HQ</option>
                                    {agents.map(ag => (
                                        <option key={`opt_${ag.agent_id}`} value={ag.agent_id}>[{ag.tier}] {ag.name} ({ag.agent_id})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => { setIsAgentModalOpen(false); setIsIdAvailable(null); }} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md transition-colors disabled:opacity-50" disabled={isIdAvailable !== true}>Register</button>
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
                        <button onClick={() => {
                            sessionStorage.removeItem("hq_logged_in");
                            setIsLoggedIn(false);
                        }} className="text-slate-500 hover:text-red-400 transition-colors p-2 outline-none focus:outline-none" title="Logout">
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
                                {/* 💡 [교체] 채널별 예약 세부 통계 표시 */}
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Global Direct Bookings</p>
                                        <h3 className="text-4xl font-black text-slate-800">{totalBookings.toLocaleString()}</h3>
                                        <div className="mt-2 text-[10px] font-bold text-slate-500 flex gap-3 bg-slate-50 px-2 py-1 rounded w-fit">
                                            <span className="text-blue-600">Portal: {totalPortalBookings.toLocaleString()}</span>
                                            <span className="text-slate-300">|</span>
                                            <span className="text-emerald-600">Hotel Web: {totalWebBookings.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center text-2xl">⚡</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* 💡 [업그레이드] PARTNERS 탭 (등록/수정/삭제 기능 추가) */}
                    {/* ========================================================= */}
                    {activeTab === "PARTNERS" && (
                        <div className="animate-fade-in max-w-7xl mx-auto h-[calc(100vh-140px)] flex flex-col">

                            <div className="flex justify-between items-end mb-6 shrink-0">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800">Partner Hotel Directory</h2>
                                    <p className="text-sm font-bold text-slate-500 mt-1">Manage Properties & Master Accounts</p>
                                </div>
                                <button onClick={() => {
                                    // 💡 p.master_id가 백엔드에서 정상적으로 내려오는지 확인이 핵심입니다.
                                    setPartnerForm({
                                        code: p.code,
                                        name: p.name,
                                        master_id: p.master_id || "", // 백엔드에서 가져온 진짜 아이디 매핑
                                        master_pw: "", // 비밀번호는 보안상 수동 입력 전까지 빈칸
                                        status: p.status,
                                        agent_id: p.agent_id || "HQ Direct"
                                    });
                                    setIsEditingPartner(true);
                                    setIsPartnerModalOpen(true);
                                }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl text-sm font-black shadow-md transition-all active:scale-95 flex items-center gap-2">
                                    <span>+</span> Register New Partner
                                </button>
                            </div>

                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
                                    <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">Total {filteredPartners.length} Properties</span>
                                </div>
                                <div className="overflow-y-auto flex-1">
                                    <table className="w-full text-left border-collapse relative">
                                        <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                                            <tr className="text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                                <th className="p-4 font-black">Property Details</th>
                                                <th className="p-4 font-black">Sales Agent</th>
                                                <th className="p-4 font-black text-center">Status</th>
                                                <th className="p-4 font-black text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm font-bold text-slate-800">
                                            {filteredPartners.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="p-10 text-center text-slate-400 font-bold">No partners found.</td>
                                                </tr>
                                            ) : (
                                                filteredPartners.map(p => (
                                                    <tr key={`partner_${p.code}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-3">
                                                                <span className="bg-slate-800 text-emerald-400 px-3 py-1.5 rounded-lg font-mono text-xs shadow-inner uppercase tracking-wider">{p.code}</span>
                                                                <div className="text-[13px] font-black text-slate-800">{p.name}</div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 font-medium">{p.agent_id || 'HQ Direct'}</span>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-black border ${p.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                                                p.status === 'Overdue' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                                                                }`}>
                                                                {p.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => {
                                                                    // 💡 수정(Edit) 버튼을 누를 때 DB에서 가져온 마스터 아이디(p.master_id)를 넣어줍니다!
                                                                    setPartnerForm({
                                                                        code: p.code,
                                                                        name: p.name,
                                                                        master_id: p.master_id || "",
                                                                        master_pw: "",
                                                                        status: p.status,
                                                                        agent_id: p.agent_id || "HQ Direct"
                                                                    });
                                                                    setIsEditingPartner(true);
                                                                    setIsPartnerModalOpen(true);
                                                                }} className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm">
                                                                    Edit ⚙️
                                                                </button>
                                                                <button onClick={() => handleDeletePartner(p.code, p.name)} className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm">
                                                                    Delete 🗑️
                                                                </button>
                                                            </div>
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

                    {activeTab === "USERS" && (
                        <div className="animate-fade-in max-w-7xl mx-auto">
                            <UserManagement />
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* 💡 [업그레이드] AGENTS 탭 - 트리 분할 레이아웃 적용 */}
                    {/* ========================================================= */}
                    {activeTab === "AGENTS" && (
                        <div className="animate-fade-in max-w-7xl mx-auto h-[calc(100vh-140px)] flex flex-col">
                            <div className="flex justify-between items-end mb-6 shrink-0">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800">Sales Representatives</h2>
                                    <p className="text-sm font-bold text-slate-500 mt-1">Manage Agency Hierarchy & Commissions</p>
                                </div>
                                <button onClick={() => setIsAgentModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl text-sm font-black shadow-md transition-all active:scale-95 flex items-center gap-2">
                                    <span>+</span> Register New Agent
                                </button>
                            </div>

                            <div className="flex-1 flex gap-6 min-h-0 pb-6">
                                {/* 📌 좌측: 폴더 구조형 에이전트 트리 */}
                                <div className="w-1/3 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0">
                                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Agency Tree</h3>
                                    </div>
                                    <div className="p-4 overflow-y-auto flex-1 space-y-1">
                                        {agents.length === 0 ? (
                                            <p className="text-center text-sm text-slate-400 mt-10">No agents found.</p>
                                        ) : (
                                            agentTree.map(rootNode => (
                                                <AgentTreeNode
                                                    key={rootNode.agent_id}
                                                    node={rootNode}
                                                    selectedId={selectedAgent?.agent_id}
                                                    onSelect={(node) => {
                                                        setSelectedAgent(node);
                                                        setIsEditingAgent(false);
                                                    }}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* 📌 우측: 상세 정보 및 편집 패널 */}
                                <div className="w-2/3 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0">
                                    {!selectedAgent ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-10">
                                            <div className="text-6xl mb-4 opacity-20">📁</div>
                                            <p className="font-bold">Select an agent from the tree to view or edit details.</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col h-full">
                                            <div className="p-6 border-b border-slate-100 bg-slate-50/50 shrink-0 flex justify-between items-center">
                                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                                                    {isEditingAgent ? "Edit Agent Profile" : "Agent Details"}
                                                </h3>
                                                {!isEditingAgent && (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => { setEditAgentData({ ...selectedAgent }); setIsEditingAgent(true); }} className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-sm">
                                                            Edit ⚙️
                                                        </button>
                                                        {/* 💡 삭제 버튼 추가 */}
                                                        <button onClick={() => handleDeleteAgent(selectedAgent.agent_id)} className="px-4 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-600 hover:bg-red-100 shadow-sm transition-colors">
                                                            Delete 🗑️
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-8 overflow-y-auto flex-1">
                                                {!isEditingAgent ? (
                                                    // 📖 보기 모드
                                                    <div className="space-y-6">
                                                        <div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Company / Agent Name</div>
                                                            <div className="text-2xl font-black text-slate-800">{selectedAgent.name}</div>
                                                            <div className="text-sm font-mono text-emerald-600 font-bold mt-1">ID: {selectedAgent.agent_id}</div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                                            <div>
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tier Level</div>
                                                                <div className="font-bold text-slate-700">{selectedAgent.tier}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Commission Rate</div>
                                                                <div className="font-black text-emerald-600 text-lg">{selectedAgent.commission_rate}%</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Parent Agency</div>
                                                                <div className="font-bold text-slate-700">{selectedAgent.parent_agent_id}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Hotels Managed</div>
                                                                <div className="font-black text-purple-600 text-lg">{selectedAgent.activeHotels || 0}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // ✏️ 수정 모드 폼
                                                    <form onSubmit={handleUpdateAgent} className="space-y-5">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company / Agent Name</label>
                                                            <input type="text" required value={editAgentData.name} onChange={e => setEditAgentData({ ...editAgentData, name: e.target.value })} className="w-full border rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-5">
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tier Level</label>
                                                                <select value={editAgentData.tier} onChange={e => setEditAgentData({ ...editAgentData, tier: e.target.value })} className="w-full border rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 bg-white">
                                                                    <option value="Master">Master</option>
                                                                    <option value="Branch">Branch</option>
                                                                    <option value="Rep">Rep</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Commission (%)</label>
                                                                <input type="number" required value={editAgentData.commission_rate} onChange={e => setEditAgentData({ ...editAgentData, commission_rate: e.target.value })} className="w-full border rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Parent Agency</label>
                                                            <select value={editAgentData.parent_agent_id} onChange={e => setEditAgentData({ ...editAgentData, parent_agent_id: e.target.value })} className="w-full border rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 bg-white">
                                                                <option value="HQ">Directly Under HQ</option>
                                                                {agents.filter(a => a.agent_id !== editAgentData.agent_id).map(ag => (
                                                                    <option key={`edit_opt_${ag.agent_id}`} value={ag.agent_id}>[{ag.tier}] {ag.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="pt-6 flex gap-3">
                                                            <button type="button" onClick={() => setIsEditingAgent(false)} className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
                                                            <button type="submit" className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md transition-colors">Save Changes</button>
                                                        </div>
                                                    </form>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* 💡 [신규] SETTLEMENT 탭 - 12% E.VAT 공제 및 롤업 커미션 정산 */}
                    {/* ========================================================= */}
                    {activeTab === "SETTLEMENT" && (
                        <div className="animate-fade-in max-w-7xl mx-auto h-[calc(100vh-140px)] flex flex-col">
                            <div className="flex justify-between items-end mb-6 shrink-0">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800">Commission Settlement</h2>
                                    <p className="text-sm font-bold text-slate-500 mt-1">Net Revenue = Gross - 12% E.VAT (Differential Roll-up Payout)</p>
                                </div>
                            </div>

                            <div className="flex-1 flex gap-6 min-h-0 pb-6">
                                {/* 📌 좌측: 에이전트 트리 (AGENTS 탭과 동일한 컴포넌트 재사용) */}
                                <div className="w-1/3 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0">
                                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Select Agency</h3>
                                    </div>
                                    <div className="p-4 overflow-y-auto flex-1 space-y-1">
                                        {agents.length === 0 ? <p className="text-center text-sm text-slate-400 mt-10">No agents found.</p> :
                                            agentTree.map(rootNode => (
                                                <AgentTreeNode key={`stl_${rootNode.agent_id}`} node={rootNode} selectedId={selectedAgent?.agent_id} onSelect={setSelectedAgent} />
                                            ))
                                        }
                                    </div>
                                </div>

                                {/* 📌 우측: 정산 데이터 대시보드 */}
                                <div className="w-2/3 bg-slate-50 rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0">
                                    {!selectedAgent ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-10 bg-white">
                                            <div className="text-6xl mb-4 opacity-20">💰</div>
                                            <p className="font-bold">Select an agent from the tree to view their settlement report.</p>
                                        </div>
                                    ) : (() => {
                                        // 💡 정산 로직 실행
                                        const settlement = calculateSettlement(selectedAgent.agent_id);

                                        return (
                                            <div className="flex flex-col h-full">
                                                <div className="p-6 border-b border-slate-200 bg-white shrink-0">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <h3 className="text-xl font-black text-slate-800">{selectedAgent.name}</h3>
                                                        <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-black border border-emerald-200">
                                                            Tier: {selectedAgent.tier} (Set Rate: {selectedAgent.commission_rate}%)
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 font-mono">Agent ID: {selectedAgent.agent_id}</p>
                                                </div>

                                                {/* 요약 지표 */}
                                                <div className="p-6 shrink-0 grid grid-cols-3 gap-4">
                                                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Gross Vol.</p>
                                                        <p className="text-xl font-black text-slate-800">₱{settlement.totalGross.toLocaleString()}</p>
                                                    </div>
                                                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 bg-red-50 text-red-500 text-[9px] font-black px-2 py-0.5 rounded-bl-lg border-b border-l border-red-100">-12% E.VAT</div>
                                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Net Revenue (Base)</p>
                                                        <p className="text-xl font-black text-slate-700">₱{settlement.totalNet.toLocaleString()}</p>
                                                    </div>
                                                    <div className="bg-emerald-600 p-4 rounded-2xl shadow-md text-white relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 bg-emerald-700 text-emerald-100 text-[9px] font-black px-2 py-0.5 rounded-bl-lg">Roll-up Applied</div>
                                                        <p className="text-[9px] text-emerald-200 font-black uppercase tracking-widest mb-1">Total Payout</p>
                                                        <p className="text-2xl font-black">₱{settlement.myCommission.toLocaleString()}</p>
                                                    </div>
                                                </div>

                                                {/* 파생 매출 출처 리스트 */}
                                                <div className="flex-1 overflow-y-auto px-6 pb-6">
                                                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Revenue Sources (Hotel Breakdown)</h4>
                                                    {settlement.hotelDetails.length === 0 ? (
                                                        <p className="text-sm text-slate-400 text-center py-10 bg-white rounded-xl border border-slate-200 border-dashed">No active revenue sources found for this agent.</p>
                                                    ) : (
                                                        <div className="space-y-3">
                                                            {settlement.hotelDetails.map((h, i) => (
                                                                <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-emerald-300 transition-colors">
                                                                    <div>
                                                                        <p className="font-bold text-slate-800 text-sm">{h.hotelName} <span className="text-xs text-slate-400 font-normal">({h.hotelCode})</span></p>
                                                                        <p className="text-[10px] text-slate-500 mt-1">Direct Agent: <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{h.directAgent}</span></p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-[10px] text-slate-400 mb-0.5">
                                                                            Net ₱{h.net.toLocaleString()} × <span className="text-emerald-500 font-black">{h.myRate}%</span> <span className="text-slate-300">(Diff)</span>
                                                                        </p>
                                                                        <p className="font-black text-emerald-600 text-base">₱{h.earned.toLocaleString()}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* BILLING */}
                    {/* ========================================================= */}
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
                                                                <select
                                                                    value={p.agent_id || 'HQ Direct'}
                                                                    onChange={(e) => handleLocalChange(p.code, 'agent_id', e.target.value)}
                                                                    className="text-xs text-slate-600 bg-white border border-slate-300 rounded px-2 py-1 outline-none focus:border-emerald-500 cursor-pointer w-fit max-w-[200px] truncate"
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

                    {/* ========================================================= */}
                    {/* DOMAINS */}
                    {/* ========================================================= */}
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

                {/* 💡 [신규] 파트너 등록/수정 모달창 */}
                {isPartnerModalOpen && (
                    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-4">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-8 border border-slate-200 flex flex-col max-h-full">
                            <div className="flex justify-between items-center mb-6 shrink-0">
                                <h3 className="text-xl font-black text-slate-800">
                                    {isEditingPartner ? "⚙️ Edit Partner & Master Account" : "🏨 Register New Partner"}
                                </h3>
                                <button onClick={() => setIsPartnerModalOpen(false)} className="text-slate-400 hover:text-red-500 text-xl font-bold">&times;</button>
                            </div>

                            <form onSubmit={handlePartnerSubmit} className="space-y-6 overflow-y-auto pr-2">
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">1. Hotel Information</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hotel Code (PMS ID)</label>
                                            <input type="text" required disabled={isEditingPartner} value={partnerForm.code} onChange={e => setPartnerForm({ ...partnerForm, code: e.target.value.toUpperCase() })} className="w-full border rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 disabled:bg-slate-200 disabled:text-slate-500 font-mono tracking-wider uppercase" placeholder="e.g. SKY001" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assigned Agent</label>
                                            <select value={partnerForm.agent_id} onChange={e => setPartnerForm({ ...partnerForm, agent_id: e.target.value })} className="w-full border rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 bg-white text-sm">
                                                <option value="HQ Direct">HQ Direct (No Commission)</option>
                                                {agents.map(ag => (
                                                    <option key={`mod_opt_${ag.agent_id}`} value={ag.agent_id}>[{ag.tier}] {ag.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Account Status</label>
                                            <select value={partnerForm.status} onChange={e => setPartnerForm({ ...partnerForm, status: e.target.value })} className="w-full border rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 bg-white text-sm font-bold">
                                                <option value="Active">Active</option>
                                                <option value="Onboarding">Onboarding</option>
                                                <option value="Overdue">Overdue (Lock System)</option>
                                            </select>
                                        </div>
                                        {/* 등록 시에만 임시 호텔명 입력 (이후엔 웹빌더에서 관리) */}
                                        {!isEditingPartner && (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hotel Name</label>
                                                <input type="text" required value={partnerForm.name} onChange={e => setPartnerForm({ ...partnerForm, name: e.target.value })} className="w-full border rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 font-bold" placeholder="e.g. Sky Grand Hotel" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 space-y-4">
                                    <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest border-b border-blue-100 pb-2">2. Master Account Details</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Master User ID</label>
                                            <input type="text" required value={partnerForm.master_id} onChange={e => setPartnerForm({ ...partnerForm, master_id: e.target.value })} className="w-full border rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 font-mono" placeholder="e.g. Sky_Admin" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isEditingPartner ? "New Password (Optional)" : "Password"}</label>
                                            <input type="text" required={!isEditingPartner} value={partnerForm.master_pw} onChange={e => setPartnerForm({ ...partnerForm, master_pw: e.target.value })} className="w-full border rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 font-mono tracking-widest" placeholder="••••••••" />
                                        </div>
                                    </div>
                                    {isEditingPartner && <p className="text-[10px] text-red-500 font-bold mt-1">* Note: Entering a password will overwrite current credentials.</p>}
                                </div>

                                <div className="pt-4 flex gap-3 shrink-0">
                                    <button type="button" onClick={() => setIsPartnerModalOpen(false)} className="flex-1 px-4 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                                    <button type="submit" className="flex-1 px-4 py-3.5 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 shadow-md transition-colors">
                                        {isEditingPartner ? "Save Changes" : "Create Partner & Account"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}