"use client";
import { useState, useEffect } from "react";
import axios from "axios";

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // 1. 회원 데이터 불러오기 (임시 mock 데이터 포함)
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                // 실제 API 경로에 맞춰 수정 필요
                const res = await axios.get("/api/hq/members");
                setUsers(res.data.members);
            } catch (err) {
                // API 미연결 시 테스트용 가상 데이터
                setUsers([
                    { id: 1, name: "Jongwon Choi", email: "jjchoi888@gmail.com", nationality: "South Korea", is_membership_active: true, total_points: 1000, tier: "Member", created_at: "2026-04-01" },
                    { id: 2, name: "Juan Dela Cruz", email: "juan@example.com", nationality: "Philippines", is_membership_active: false, total_points: 0, tier: "Basic", created_at: "2026-04-05" },
                ]);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    // 검색 필터
    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">User Management</h2>
                    <p className="text-sm text-slate-500 font-medium">Total {users.length} registered users</p>
                </div>

                <div className="relative w-full md:w-80">
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm"
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden text-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="p-4 font-bold text-slate-600">User Info</th>
                                <th className="p-4 font-bold text-slate-600">Nationality</th>
                                <th className="p-4 font-bold text-slate-600">Status</th>
                                <th className="p-4 font-bold text-slate-600">Points</th>
                                <th className="p-4 font-bold text-slate-600">Joined Date</th>
                                <th className="p-4 font-bold text-slate-600 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredUsers.map((u) => (
                                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800">{u.name}</div>
                                        <div className="text-xs text-slate-400 font-medium">{u.email}</div>
                                    </td>
                                    <td className="p-4 text-slate-600 font-medium">{u.nationality}</td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${u.is_membership_active
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            {u.is_membership_active ? 'Member' : 'Basic'}
                                        </span>
                                    </td>
                                    <td className="p-4 font-black text-slate-700">
                                        {u.total_points.toLocaleString()} <span className="text-[10px] text-slate-400">pts</span>
                                    </td>
                                    <td className="p-4 text-slate-500 font-medium">{u.created_at}</td>
                                    <td className="p-4 text-center">
                                        <button className="text-blue-600 font-bold hover:underline">Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredUsers.length === 0 && (
                    <div className="p-20 text-center text-slate-400 font-bold">
                        No users found matching your search.
                    </div>
                )}
            </div>
        </div>
    );
}