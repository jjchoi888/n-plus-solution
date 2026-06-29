"use client";
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import dynamic from 'next/dynamic';

// 💡 Rich text editor for email campaigns (Dynamic import to avoid SSR issues)
const ReactQuill = dynamic(() => import('react-quill-new'), {
    ssr: false,
    loading: () => <div className="h-[350px] bg-slate-50 animate-pulse rounded-2xl flex items-center justify-center font-bold text-slate-400">Loading Editor...</div>
});
import 'react-quill-new/dist/quill.snow.css';

export default function MemberManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Search and filter state
    const [searchTerm, setSearchTerm] = useState("");
    const [filterNation, setFilterNation] = useState("ALL");

    // Email campaign state
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailForm, setEmailForm] = useState({ subject: "", content: "" });
    const [isSending, setIsSending] = useState(false);

    // Member detail view/edit state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);

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

    // 💡 Fetch general member list from the database
    const fetchUsers = async () => {
        try {
            const res = await axios.get(`/api/hq/general-members?t=${Date.now()}`, {
                headers: { 'Cache-Control': 'no-cache' }
            });

            if (res.data && res.data.members) {
                const cleanUsers = res.data.members.map(u => ({
                    ...u,
                    name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unknown Guest',
                    nationality: u.nationality || 'Unknown',
                    email: u.email || 'No Email',
                    phone: u.phone || 'N/A',
                    dob: u.dob || 'N/A'
                }));
                setUsers(cleanUsers);
            }
        } catch (err) {
            console.error("Data load failure:", err);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Apply search and filtering
    const displayUsers = users.filter(u => {
        const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchNation = filterNation === "ALL" || u.nationality === filterNation;
        return matchSearch && matchNation;
    });

    const nations = ["ALL", ...new Set(users.map(u => u.nationality))];

    // 📧 Execute email campaign dispatch
    const submitEmailCampaign = async (e) => {
        e.preventDefault();
        if (!window.confirm(`Are you sure you want to send this email to ${displayUsers.length} members?`)) return;

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
            alert("✅ Email campaign sending has started!");
            setIsEmailModalOpen(false);
            setEmailForm({ subject: "", content: "" });
        } catch (err) {
            alert("❌ Error occurred during dispatch.");
        } finally { setIsSending(false); }
    };

    // 👤 Update member information
    const handleUpdateUser = async (e) => {
        e.preventDefault();
        setIsUpdating(true);
        try {
            const res = await axios.post("/api/hq/general-members/update", editingUser);
            if (res.data && res.data.success) {
                fetchUsers();
                alert(`✅ Successfully updated information for ${editingUser.name}.`);
                setIsEditModalOpen(false);
            } else {
                alert("❌ Update failed: " + res.data.message);
            }
        } catch (err) {
            alert("🚨 A network error occurred during the update.");
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) return <div className="p-20 text-center font-bold text-slate-400">Loading General Members...</div>;

    return (
        <div className="space-y-6 animate-fade-in pb-20 font-sans p-6 md:p-10 max-w-7xl mx-auto">
            {/* Top Title Section */}
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">General Members</h1>
                    <p className="text-slate-500 font-bold mt-1">Manage standard registered users and send marketing campaigns.</p>
                </div>
                <button onClick={fetchUsers} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors border border-slate-200">
                    ↻ Refresh List
                </button>
            </div>

            {/* Filters and Search Bar */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-[200px]">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2">🔍</span>
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        />
                    </div>
                    <select value={filterNation} onChange={e => setFilterNation(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-blue-500 cursor-pointer">
                        {nations.map(n => <option key={n} value={n}>{n === "ALL" ? "All Nationalities" : n}</option>)}
                    </select>
                    <button onClick={() => setIsEmailModalOpen(true)} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-black hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2">
                        <span>📧</span> Compose Campaign ({displayUsers.length})
                    </button>
                </div>
            </div>

            {/* General Members Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total Members: {displayUsers.length}</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm font-bold">
                        <thead className="bg-white border-b border-slate-100 font-black text-slate-400 uppercase text-[11px] tracking-widest">
                            <tr>
                                <th className="p-5">User Info</th>
                                <th className="p-5">Nationality</th>
                                <th className="p-5">Contact / DOB</th>
                                <th className="p-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {displayUsers.map(u => (
                                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-5">
                                        <div className="text-slate-800 text-base">{u.name}</div>
                                        <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                                    </td>
                                    <td className="p-5 text-slate-600 font-medium">
                                        {u.nationality}
                                    </td>
                                    <td className="p-5 text-slate-500">
                                        <div>{u.phone}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">DOB: {u.dob}</div>
                                    </td>
                                    <td className="p-5 text-right">
                                        <button onClick={() => { setEditingUser(u); setIsEditModalOpen(true); }} className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors font-black text-xs">
                                            View / Manage
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {displayUsers.length === 0 && <div className="p-20 text-center"><p className="text-slate-400 font-black text-lg">No general members found.</p></div>}
            </div>

            {/* Member Details Modal */}
            {isEditModalOpen && editingUser && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsEditModalOpen(false)}>
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-white/20" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><span>👤</span> Member Details</h3>
                                <p className="text-xs font-bold text-slate-500 mt-1">{editingUser.email}</p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-3xl font-light">&times;</button>
                        </div>
                        <form onSubmit={handleUpdateUser} className="p-8 space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                                <input type="text" value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Phone Number</label>
                                <input type="text" value={editingUser.phone} onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 font-black rounded-2xl hover:bg-slate-50 transition-colors">Close</button>
                                <button type="submit" disabled={isUpdating} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-blue-600 shadow-xl transition-all active:scale-95 disabled:opacity-50">
                                    {isUpdating ? "Saving..." : "Save Updates"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Email Marketing Modal */}
            {isEmailModalOpen && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] border border-white/20">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><span>🎨</span> Email Campaign Designer</h3>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">Sending to: {displayUsers.length} General Members</p>
                            </div>
                            <button onClick={() => setIsEmailModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-3xl font-light">&times;</button>
                        </div>
                        <form onSubmit={submitEmailCampaign} className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-8 space-y-6 overflow-y-auto">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Campaign Subject</label>
                                    <input type="text" required value={emailForm.subject} onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg text-slate-800 placeholder:text-slate-300" placeholder="Enter email subject line..." />
                                </div>
                                <div className="flex flex-col min-h-[450px]">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Message Content (Rich Text)</label>
                                    <div className="flex-1 border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col bg-white">
                                        <ReactQuill theme="snow" value={emailForm.content} onChange={(content) => setEmailForm({ ...emailForm, content })} modules={modules} placeholder="Write your marketing message here..." className="h-[380px] flex-1" />
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0">
                                <button type="button" onClick={() => setIsEmailModalOpen(false)} className="px-8 py-4 bg-white border border-slate-200 text-slate-500 font-black rounded-2xl hover:bg-slate-100 transition-colors">Discard Draft</button>
                                <button type="submit" disabled={isSending || displayUsers.length === 0} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-blue-600 shadow-xl transition-all active:scale-95 disabled:opacity-50">
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