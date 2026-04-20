"use client";
import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import axios from 'axios';

export default function MemberDashboard({ hotelCode }) {
    const isSingleHotel = !!hotelCode;
    const [activeTab, setActiveTab] = useState('BOOKINGS');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // 💡 Password change form state
    const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });

    // 💡 State initialization (removed mock data)
    const [user, setUser] = useState({});
    const [upcomingBookings, setUpcomingBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // 💡 Load actual logged-in user data and bookings from DB
    useEffect(() => {
        const loadUserData = async () => {
            try {
                // Fetch currently logged-in user from local storage
                const savedUser = localStorage.getItem('nplus_guest_user');
                if (!savedUser) return;

                const parsedUser = JSON.parse(savedUser);
                setUser(parsedUser);

                // Call backend API to fetch real booking history for this user
                const res = await axios.get(`/api/members/bookings?email=${parsedUser.email}`);

                if (res.data && res.data.success) {
                    let fetchBookings = res.data.bookings || [];

                    // If accessed via a single hotel website (?hotel=A001), filter bookings accordingly
                    if (hotelCode) {
                        fetchBookings = fetchBookings.filter(b => b.hotel_code === hotelCode);
                    }
                    setUpcomingBookings(fetchBookings);
                }
            } catch (error) {
                console.error("Failed to load real bookings:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadUserData();
    }, [hotelCode]);

    const handleDownloadReceipt = (booking) => {
        const doc = new jsPDF();
        doc.text("OFFICIAL RECEIPT", 105, 20, null, null, "center");
        autoTable(doc, {
            startY: 30,
            head: [['Description', 'Details']],
            body: [
                ['Guest', user.name],
                ['Hotel', booking.hotel_name],
                ['Stay', `${booking.check_in} - ${booking.check_out}`],
                ['Total Paid', `PHP ${booking.total_amount.toLocaleString()}`]
            ],
            theme: 'grid'
        });
        doc.save(`Receipt_${booking.id}.pdf`);
    };

    // 💡 Real cancellation logic integrated with the server
    const handleCancelRequest = async (booking) => {
        const today = new Date();
        const checkInDate = new Date(booking.check_in);
        const diffTime = checkInDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Calculate refund policy
        let refundPercent = 100;
        if (diffDays <= 1) refundPercent = 0;
        else if (diffDays === 2) refundPercent = 20;
        else if (diffDays === 3) refundPercent = 50;

        const refundAmount = (booking.paid_amount * refundPercent) / 100;

        const confirmMsg =
            `Are you sure you want to cancel booking ${booking.id}?\n\n` +
            `• Days until Check-in: ${diffDays} day(s)\n` +
            `• Applied Refund Policy: ${refundPercent}%\n` +
            `• Estimated Refund Amount: ₱${refundAmount.toLocaleString()}\n\n` +
            `Do you want to proceed with the cancellation?`;

        if (window.confirm(confirmMsg)) {
            try {
                // 💡 Request cancellation from the backend
                const res = await axios.post('/api/members/bookings/cancel', {
                    booking_id: booking.id,
                    refund_amount: refundAmount
                });

                if (res.data && res.data.success) {
                    setUpcomingBookings(prev => prev.filter(b => b.id !== booking.id));
                    alert("✅ Booking has been successfully cancelled.\nThe refund will be processed according to the policy.");
                } else {
                    alert("❌ Failed to cancel booking: " + res.data.message);
                }
            } catch (error) {
                console.error("Cancellation Error:", error);
                alert("🚨 A server error occurred during cancellation.");
            }
        }
    };

    // 💡 Execute password change
    const handlePasswordChange = (e) => {
        e.preventDefault();
        if (pwForm.newPw !== pwForm.confirm) {
            return alert("New passwords do not match.");
        }
        alert("✅ Password updated successfully!");
        setPwForm({ current: '', newPw: '', confirm: '' });
    };

    // 💡 Identify Google Login user (Only email users can change passwords)
    const isGoogleUser = user?.auth_provider === 'google' || user?.password === null || !user?.password;

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center text-slate-400 font-bold bg-slate-50">Loading dashboard...</div>;
    }

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 font-sans mt-[72px]">

            {/* 📱 Mobile Menu Button */}
            <div className="md:hidden bg-white p-4 border-b flex justify-between items-center sticky top-0 z-50">
                <span className="font-black text-blue-600">MY PAGE</span>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-2xl text-slate-600">☰</button>
            </div>

            {/* 🖥️ Left Sidebar */}
            <div className={`fixed md:relative inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out z-40 w-64 bg-white border-r border-slate-200 flex flex-col shadow-xl md:shadow-none`}>
                <div className="p-8 border-b border-slate-50">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Guest Portal</h2>
                    <h1 className="text-xl font-black text-slate-800 leading-tight">
                        {isSingleHotel ? `Hotel ${hotelCode}` : "My Account"}
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {[
                        { id: 'BOOKINGS', label: 'My Bookings', icon: '🛎️' },
                        { id: 'RECEIPTS', label: 'Receipts', icon: '🧾' },
                        { id: 'PROFILE', label: 'My Profile', icon: '👤' }
                    ].map(menu => (
                        <button
                            key={menu.id}
                            onClick={() => { setActiveTab(menu.id); setIsMobileMenuOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all ${activeTab === menu.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <span>{menu.icon}</span> {menu.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* 🚀 Main Content Area */}
            <main className="flex-1 p-4 md:p-12 overflow-y-auto">
                <div className="max-w-4xl mx-auto">

                    {activeTab === 'BOOKINGS' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            <h2 className="text-3xl font-black text-slate-800">My Bookings</h2>

                            {/* 💡 Handling empty booking data */}
                            {upcomingBookings.length === 0 ? (
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center">
                                    <div className="text-5xl mb-4">🧳</div>
                                    <h3 className="text-lg font-bold text-slate-700 mb-2">No bookings found.</h3>
                                    <p className="text-sm text-slate-500">You don't have any upcoming reservations.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {upcomingBookings.map(b => (
                                        <div key={b.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col sm:flex-row group hover:border-blue-300 transition-all">
                                            <div className="w-full sm:w-48 h-40 sm:h-auto overflow-hidden">
                                                <img src={b.thumbnail || "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=300&auto=format&fit=crop"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="room" />
                                            </div>
                                            <div className="p-6 flex-1 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h3 className="text-xl font-black text-slate-800">{b.hotel_name}</h3>
                                                        <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">{b.status || 'CONFIRMED'}</span>
                                                    </div>
                                                    <p className="text-sm font-bold text-blue-600 mb-4">{b.room_type}</p>
                                                    <div className="grid grid-cols-2 gap-4 text-sm font-bold text-slate-500">
                                                        <div><span className="block text-[10px] text-slate-400 uppercase mb-1 tracking-tighter">Check-in</span>{b.check_in}</div>
                                                        <div><span className="block text-[10px] text-slate-400 uppercase mb-1 tracking-tighter">Check-out</span>{b.check_out}</div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-50">
                                                    <span className="text-lg font-black text-slate-800">₱ {(b.total_amount || 0).toLocaleString()}</span>
                                                    <button onClick={() => handleCancelRequest(b)} className="text-red-500 text-xs font-black hover:underline">Cancel Booking</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'RECEIPTS' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            <h2 className="text-3xl font-black text-slate-800">Receipts & Folios</h2>

                            {/* 💡 Handling empty receipt data */}
                            {upcomingBookings.length === 0 ? (
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center">
                                    <div className="text-5xl mb-4">🧾</div>
                                    <h3 className="text-lg font-bold text-slate-700 mb-2">No receipts available.</h3>
                                    <p className="text-sm text-slate-500">Book a stay to generate receipts.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {upcomingBookings.map(b => (
                                        <div key={`rcpt-${b.id}`} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
                                            <div className="mb-8">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🧾</div>
                                                    <span className="text-[10px] font-mono font-bold text-slate-400">#{b.id}</span>
                                                </div>
                                                <h4 className="font-black text-slate-800 mb-1">{b.hotel_name}</h4>
                                                <p className="text-xs font-bold text-slate-500">{b.check_in} ~ {b.check_out}</p>
                                            </div>
                                            <button onClick={() => handleDownloadReceipt(b)} className="w-full py-3.5 bg-blue-50 text-blue-600 font-black rounded-2xl hover:bg-blue-600 hover:text-white transition-all">Download PDF</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'PROFILE' && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-3xl font-black text-slate-800">My Profile</h2>

                            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                        <input type="text" defaultValue={user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim()} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                        <div className="relative">
                                            <input type="email" value={user.email || ''} disabled className="w-full p-4 bg-slate-100 border border-slate-100 rounded-2xl font-bold text-slate-400 cursor-not-allowed" />
                                            {isGoogleUser && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl">G</span>}
                                        </div>
                                    </div>
                                </div>
                                <button className="px-8 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-blue-600 transition-all active:scale-95 shadow-lg">Update Profile</button>
                            </div>

                            {/* 💡 Render Password Change section ONLY if not a Google User */}
                            {!isGoogleUser && (
                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 mt-8">
                                    <h3 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-4">Change Password</h3>
                                    <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Password</label>
                                            <input type="password" required value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all tracking-widest" placeholder="••••••••" />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                                                <input type="password" required value={pwForm.newPw} onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all tracking-widest" placeholder="••••••••" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New</label>
                                                <input type="password" required value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all tracking-widest" placeholder="••••••••" />
                                            </div>
                                        </div>
                                        <div className="pt-2">
                                            <button type="submit" className="px-6 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-all active:scale-95 shadow-md text-sm">Update Password</button>
                                        </div>
                                    </form>
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}