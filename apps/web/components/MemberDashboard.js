import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../App.css';

export default function Member() {
    const location = useLocation();

    // 💡 URL 파라미터 파싱 (?hotel=A001 형태로 들어오면 개별웹, 없으면 통합웹)
    const queryParams = new URLSearchParams(location.search);
    const hotelCode = queryParams.get('hotel');
    const isSingleHotel = !!hotelCode;

    // UI 상태 관리
    const [activeTab, setActiveTab] = useState('BOOKINGS');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // =====================================================================
    // 🗄️ 더미 데이터 (추후 백엔드 API 연동 시 교체될 부분)
    // =====================================================================
    const currentUser = {
        name: "Juan Dela Cruz",
        email: "juan.delacruz@example.com",
        phone: "0912 345 6789",
        member_since: "2025-10-12"
    };

    const [upcomingBookings, setUpcomingBookings] = useState([
        {
            id: "RES-88291A",
            hotel_name: "Bayfront Hotel Subic",
            room_type: "Deluxe Ocean View",
            check_in: "2026-05-20",
            check_out: "2026-05-22",
            status: "CONFIRMED",
            total_amount: 12500,
            paid_amount: 12500,
            thumbnail: "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=300&auto=format&fit=crop"
        }
    ]);

    const pastBookings = [
        {
            id: "RES-77102B",
            hotel_name: "N+ Integrated Resort",
            room_type: "Standard Double",
            check_in: "2025-12-24",
            check_out: "2025-12-26",
            status: "CHECKED_OUT",
            total_amount: 8000
        }
    ];

    // Admin에서 설정한 환불 규정 (예시)
    const refundPolicies = {
        1: 0,   // 1일 전 0% 환불
        2: 20,  // 2일 전 20% 환불
        3: 50,  // 3일 전 50% 환불
        4: 100  // 4일 이상 남았으면 100% 환불
    };

    // =====================================================================
    // ⚙️ 주요 기능 (핸들러)
    // =====================================================================

    // 예약 취소 및 환불금 계산 로직
    const handleCancelBooking = (booking) => {
        const today = new Date();
        const checkInDate = new Date(booking.check_in);
        const diffTime = checkInDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // 남은 날짜 계산

        // 환불 정책 적용 (남은 날짜가 4일 이상이면 100% 적용)
        const policyDays = diffDays >= 4 ? 4 : (diffDays <= 1 ? 1 : diffDays);
        const refundPercent = refundPolicies[policyDays] || 0;
        const refundAmount = (booking.paid_amount * refundPercent) / 100;

        const confirmMsg = `Are you sure you want to cancel this booking?\n\n` +
            `Booking ID: ${booking.id}\n` +
            `Days until Check-in: ${diffDays} day(s)\n` +
            `Refund Policy: ${refundPercent}% Refund\n` +
            `Estimated Refund: ₱${refundAmount.toLocaleString()}`;

        if (window.confirm(confirmMsg)) {
            // 실제 구현 시 백엔드에 취소 API 요청을 보냅니다.
            setUpcomingBookings(prev => prev.filter(b => b.id !== booking.id));
            alert("✅ Booking has been successfully cancelled. Refund will be processed shortly.");
        }
    };

    // 영수증 PDF 다운로드 로직
    const handleDownloadReceipt = (booking) => {
        const doc = new jsPDF();
        doc.setFontSize(22);
        doc.text("OFFICIAL RECEIPT", 105, 20, null, null, "center");

        doc.setFontSize(10);
        doc.text(`Guest Name: ${currentUser.name}`, 14, 40);
        doc.text(`Booking ID: ${booking.id}`, 14, 46);
        doc.text(`Hotel: ${booking.hotel_name}`, 14, 52);
        doc.text(`Check-in: ${booking.check_in} | Check-out: ${booking.check_out}`, 14, 58);

        autoTable(doc, {
            startY: 70,
            head: [['Description', 'Amount (PHP)']],
            body: [
                [`Room Accommodation (${booking.room_type})`, booking.total_amount.toLocaleString()],
                ['VAT (12%)', (booking.total_amount * 0.12).toLocaleString()],
                ['Service Charge', (booking.total_amount * 0.10).toLocaleString()],
            ],
            foot: [['TOTAL PAID', `PHP ${booking.total_amount.toLocaleString()}`]],
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59] },
            footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' }
        });

        doc.save(`Receipt_${booking.id}.pdf`);
    };

    // =====================================================================
    // 🎨 UI 렌더링
    // =====================================================================
    return (
        <div className="flex flex-col md:flex-row h-screen bg-slate-50 font-sans text-slate-800">

            {/* 📱 모바일 헤더 */}
            <div className="md:hidden flex justify-between items-center bg-white p-4 shadow-sm z-20">
                <h1 className="text-xl font-black text-blue-600">
                    {isSingleHotel ? "Hotel Portal" : "n+ Rewards"}
                </h1>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-2xl">☰</button>
            </div>

            {/* 🖥️ 좌측 사이드바 (Navigation) */}
            <div className={`fixed md:relative inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out z-30 w-64 bg-white border-r border-slate-200 flex flex-col shadow-lg md:shadow-none`}>
                <div className="p-6 border-b border-slate-100 hidden md:block">
                    {/* 테마 분기: 개별웹 vs 통합웹 */}
                    {isSingleHotel ? (
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Guest Portal</span>
                            <h1 className="text-2xl font-black text-slate-800 leading-tight">My Hotel<br />Stay</h1>
                        </div>
                    ) : (
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Integrated Portal</span>
                            <h1 className="text-2xl font-black text-blue-600 leading-tight">n+ Rewards<br />Club</h1>
                        </div>
                    )}
                </div>

                <div className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <button onClick={() => { setActiveTab('PROFILE'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md font-bold transition-colors ${activeTab === 'PROFILE' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <span className="text-lg">👤</span> My Profile
                    </button>
                    <button onClick={() => { setActiveTab('BOOKINGS'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md font-bold transition-colors ${activeTab === 'BOOKINGS' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <span className="text-lg">🛎️</span> My Bookings
                    </button>
                    <button onClick={() => { setActiveTab('RECEIPTS'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md font-bold transition-colors ${activeTab === 'RECEIPTS' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <span className="text-lg">🧾</span> Receipts & Folios
                    </button>
                </div>

                <div className="p-4 border-t border-slate-100">
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-600 rounded-md font-bold hover:bg-slate-200 transition-colors">
                        <span>🚪</span> Logout
                    </button>
                </div>
            </div>

            {/* 🚀 우측 메인 콘텐츠 영역 */}
            <div className="flex-1 p-4 md:p-10 overflow-y-auto w-full">
                <div className="max-w-4xl mx-auto">

                    {/* 👤 My Profile 탭 */}
                    {activeTab === 'PROFILE' && (
                        <div className="animate-fade-in">
                            <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-6">My Profile</h2>
                            <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-slate-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Full Name</label><input type="text" defaultValue={currentUser.name} className="w-full p-3 border border-slate-200 rounded-md bg-slate-50 font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                    <div><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Email Address</label><input type="email" defaultValue={currentUser.email} disabled className="w-full p-3 border border-slate-200 rounded-md bg-slate-100 text-slate-500 font-bold cursor-not-allowed" /></div>
                                    <div><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Phone Number</label><input type="tel" defaultValue={currentUser.phone} className="w-full p-3 border border-slate-200 rounded-md bg-slate-50 font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                    <div><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Member Since</label><input type="text" defaultValue={currentUser.member_since} disabled className="w-full p-3 border border-transparent font-bold text-slate-800 bg-transparent" /></div>
                                </div>
                                <button className="bg-slate-900 text-white px-6 py-3 rounded-md font-bold hover:bg-slate-800 transition-colors">Update Profile</button>
                            </div>
                        </div>
                    )}

                    {/* 🛎️ My Bookings 탭 */}
                    {activeTab === 'BOOKINGS' && (
                        <div className="animate-fade-in">
                            <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-6">My Bookings</h2>

                            {/* Upcoming Bookings */}
                            <h3 className="text-lg font-bold text-slate-700 mb-4 border-b pb-2">Upcoming Stays</h3>
                            <div className="space-y-4 mb-10">
                                {upcomingBookings.length === 0 ? (
                                    <div className="bg-white p-10 text-center rounded-xl border border-dashed border-slate-300 text-slate-400 font-bold">No upcoming bookings found.</div>
                                ) : (
                                    upcomingBookings.map(booking => (
                                        <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row group">
                                            <div className="w-full md:w-48 h-40 md:h-auto bg-slate-200 shrink-0 relative">
                                                <img src={booking.thumbnail} alt="room" className="w-full h-full object-cover" />
                                                <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-md uppercase">Confirmed</div>
                                            </div>
                                            <div className="p-5 flex-1 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h4 className="text-xl font-black text-slate-800">{booking.hotel_name}</h4>
                                                        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">ID: {booking.id}</span>
                                                    </div>
                                                    <p className="text-sm font-bold text-blue-600 mb-3">{booking.room_type}</p>
                                                    <div className="flex gap-4 text-sm font-medium text-slate-600 mb-4">
                                                        <div><span className="block text-[10px] uppercase text-slate-400 font-bold">Check-in</span> {booking.check_in}</div>
                                                        <div><span className="block text-[10px] uppercase text-slate-400 font-bold">Check-out</span> {booking.check_out}</div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-100">
                                                    <span className="font-black text-lg">₱ {booking.total_amount.toLocaleString()}</span>
                                                    <button
                                                        onClick={() => handleCancelBooking(booking)}
                                                        className="text-red-500 hover:text-white border border-red-500 hover:bg-red-500 px-4 py-2 rounded-md text-xs font-bold transition-colors"
                                                    >
                                                        Cancel Booking
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Past Stays */}
                            <h3 className="text-lg font-bold text-slate-700 mb-4 border-b pb-2">Past Stays</h3>
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="p-4 font-bold text-slate-500">Booking ID</th>
                                            <th className="p-4 font-bold text-slate-500">Hotel & Room</th>
                                            <th className="p-4 font-bold text-slate-500">Stay Dates</th>
                                            <th className="p-4 font-bold text-slate-500">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {pastBookings.map(b => (
                                            <tr key={b.id} className="hover:bg-slate-50">
                                                <td className="p-4 font-mono text-xs">{b.id}</td>
                                                <td className="p-4"><div className="font-bold text-slate-800">{b.hotel_name}</div><div className="text-[10px] text-slate-500">{b.room_type}</div></td>
                                                <td className="p-4 text-xs">{b.check_in} ~ {b.check_out}</td>
                                                <td className="p-4"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold uppercase">{b.status.replace('_', ' ')}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 🧾 Receipts 탭 */}
                    {activeTab === 'RECEIPTS' && (
                        <div className="animate-fade-in">
                            <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-6">Receipts & Folios</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pastBookings.map(b => (
                                    <div key={`rcpt_${b.id}`} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
                                        <div>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="text-3xl">🧾</div>
                                                <span className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">{b.id}</span>
                                            </div>
                                            <h4 className="font-black text-slate-800">{b.hotel_name}</h4>
                                            <p className="text-xs text-slate-500 mb-4">{b.check_in} to {b.check_out}</p>
                                            <p className="font-black text-lg text-emerald-600 mb-4">₱ {b.total_amount.toLocaleString()}</p>
                                        </div>
                                        <button
                                            onClick={() => handleDownloadReceipt(b)}
                                            className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 py-2.5 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <span>⬇️</span> Download PDF Receipt
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}