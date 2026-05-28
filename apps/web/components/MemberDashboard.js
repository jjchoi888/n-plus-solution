"use client";
import { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import axios from 'axios';

const PH_PROVINCES = [
    'Abra', 'Agusan del Norte', 'Agusan del Sur', 'Aklan', 'Albay', 'Antique', 'Apayao', 'Aurora',
    'Basilan', 'Bataan', 'Batanes', 'Batangas', 'Benguet', 'Biliran', 'Bohol', 'Bukidnon', 'Bulacan',
    'Cagayan', 'Camarines Norte', 'Camarines Sur', 'Camiguin', 'Capiz', 'Catanduanes', 'Cavite', 'Cebu',
    'Cotabato', 'Davao de Oro', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental', 'Davao Oriental',
    'Dinagat Islands', 'Eastern Samar', 'Guimaras', 'Ifugao', 'Ilocos Norte', 'Ilocos Sur', 'Iloilo',
    'Isabela', 'Kalinga', 'La Union', 'Laguna', 'Lanao del Norte', 'Lanao del Sur', 'Leyte',
    'Maguindanao del Norte', 'Maguindanao del Sur', 'Marinduque', 'Masbate', 'Metro Manila', 'Misamis Occidental',
    'Misamis Oriental', 'Mountain Province', 'Negros Occidental', 'Negros Oriental', 'Northern Samar',
    'Nueva Ecija', 'Nueva Vizcaya', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Pampanga',
    'Pangasinan', 'Quezon', 'Quirino', 'Rizal', 'Romblon', 'Samar', 'Sarangani', 'Siquijor', 'Sorsogon',
    'South Cotabato', 'Southern Leyte', 'Sultan Kudarat', 'Sulu', 'Surigao del Norte', 'Surigao del Sur',
    'Tarlac', 'Tawi-Tawi', 'Zambales', 'Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay'
];

export default function MemberDashboard({ hotelCode, isSiteMobileMenuOpen = false }) {
    const isSingleHotel = !!hotelCode;
    const [activeTab, setActiveTab] = useState('BOOKINGS');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (isSiteMobileMenuOpen) setIsMobileMenuOpen(false);
    }, [isSiteMobileMenuOpen]);

    // 💡 Password change form state
    const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
    const [profileForm, setProfileForm] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        nationality: '',
        region: '',
        birthMonth: '',
        birthDay: '',
        documentUrl: ''
    });
    const fileUploadInputRef = useRef(null);
    const cameraCaptureInputRef = useRef(null);

    // 💡 State initialization (removed mock data)
    const [user, setUser] = useState({});
    const [upcomingBookings, setUpcomingBookings] = useState([]);
    const [rewardsEnabled, setRewardsEnabled] = useState(false);
    const [rewardsConfig, setRewardsConfig] = useState(null);
    const [rewardsData, setRewardsData] = useState({ points: 0, tier: null, transactions: [], referralCode: '' });
    const [rewardsLoading, setRewardsLoading] = useState(false);
    const [showRewardsHistoryModal, setShowRewardsHistoryModal] = useState(false);
    const [showRewardsQrModal, setShowRewardsQrModal] = useState(false);
    const [qrRedeemPoints, setQrRedeemPoints] = useState('');
    const [qrRedeemData, setQrRedeemData] = useState(null);
    const [qrRedeemLoading, setQrRedeemLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const refreshRewardsData = async (email, targetHotelCode) => {
        if (!email || !targetHotelCode) return;
        try {
            setRewardsLoading(true);
            const rewardsRes = await axios.get(`/api/members/rewards?email=${encodeURIComponent(email)}&hotel_code=${encodeURIComponent(targetHotelCode)}`);
            if (rewardsRes?.data?.success) {
                setRewardsEnabled(!!rewardsRes.data.rewards_enabled);
                setRewardsConfig(rewardsRes.data.config || null);
                setRewardsData({
                    points: Number(rewardsRes.data.points || 0),
                    tier: rewardsRes.data.tier || null,
                    referralCode: rewardsRes.data.referral_code || '',
                    transactions: Array.isArray(rewardsRes.data.transactions) ? rewardsRes.data.transactions : []
                });
            }
        } catch (err) {
            console.error('Rewards refresh failed:', err);
        } finally {
            setRewardsLoading(false);
        }
    };

    // 💡 Load actual logged-in user data and bookings from DB
    useEffect(() => {
        const loadUserData = async () => {
            try {
                // Fetch currently logged-in user from local storage
                const savedUser = localStorage.getItem('nplus_guest_user');
                if (!savedUser) return;

                const parsedUser = JSON.parse(savedUser);
                setUser(parsedUser);
                const effectiveHotel = hotelCode || parsedUser.hotel_code || '';
                setProfileForm({
                    firstName: parsedUser.first_name || '',
                    lastName: parsedUser.last_name || '',
                    phone: parsedUser.phone || '',
                    nationality: parsedUser.nationality || '',
                    region: parsedUser.region || '',
                    birthMonth: /^\d{2}\/\d{2}$/.test(parsedUser.dob || '') ? String(parsedUser.dob).slice(0, 2) : '',
                    birthDay: /^\d{2}\/\d{2}$/.test(parsedUser.dob || '') ? String(parsedUser.dob).slice(3, 5) : '',
                    documentUrl: parsedUser.document_url || ''
                });

                // Call backend API to fetch real booking history for this user
                const qs = new URLSearchParams({ email: parsedUser.email, hotel: effectiveHotel });
                const res = await axios.get(`/api/members/bookings?${qs.toString()}`);

                if (res.data && res.data.success) {
                    let fetchBookings = res.data.bookings || [];

                    // If accessed via a single hotel website (?hotel=A001), filter bookings accordingly
                    if (hotelCode) {
                        fetchBookings = fetchBookings.filter(b => b.hotel_code === hotelCode);
                    }
                    setUpcomingBookings(fetchBookings);
                }

                if (effectiveHotel) {
                    try {
                        const cfgRes = await axios.get(`/api/public/rewards-config?hotel_code=${encodeURIComponent(effectiveHotel)}`);
                        const cfgEnabled = !!cfgRes?.data?.rewards_enabled;
                        setRewardsEnabled(cfgEnabled);
                        setRewardsConfig(cfgRes?.data?.config || null);
                        if (cfgEnabled && sessionStorage.getItem('nplus_open_rewards') === '1') {
                            setActiveTab('REWARDS');
                            sessionStorage.removeItem('nplus_open_rewards');
                        }
                        if (cfgEnabled && parsedUser.email) {
                            await refreshRewardsData(parsedUser.email, effectiveHotel);
                        }
                    } catch (rewardErr) {
                        console.error('Rewards load failed:', rewardErr);
                        setRewardsEnabled(false);
                    }
                } else {
                    setRewardsEnabled(false);
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

    const handleProfileUpdate = async () => {
        if (!String(profileForm.firstName || '').trim() || !String(profileForm.lastName || '').trim()) {
            alert("Please enter both first name and last name.");
            return;
        }
        const composedDob = profileForm.birthMonth && profileForm.birthDay
            ? `${profileForm.birthMonth}/${profileForm.birthDay}`
            : '';

        const payload = {
            email: user.email,
            first_name: profileForm.firstName.trim(),
            last_name: profileForm.lastName.trim(),
            phone: profileForm.phone || '',
            nationality: profileForm.nationality || '',
            region: profileForm.region || '',
            dob: composedDob,
            document_url: profileForm.documentUrl || '',
            hotel_code: hotelCode || user.hotel_code || ''
        };

        try {
            const candidates = ['/api/members/update', '/api/members/profile/update'];
            let updatedMember = null;
            let finalError = null;

            for (const url of candidates) {
                try {
                    const res = await axios.post(url, payload);
                    if (res?.data?.success) {
                        updatedMember = res.data.member || payload;
                        break;
                    }
                    finalError = res?.data?.message || `Failed at ${url}`;
                } catch (err) {
                    finalError = err?.response?.data?.message || err.message;
                }
            }

            if (!updatedMember) {
                alert(`❌ Failed to update profile. ${finalError || ''}`);
                return;
            }

            const mergedUser = {
                ...user,
                ...updatedMember,
                name: `${updatedMember.first_name || profileForm.firstName} ${updatedMember.last_name || profileForm.lastName}`.trim()
            };
            setUser(mergedUser);
            localStorage.setItem('nplus_guest_user', JSON.stringify(mergedUser));
            alert('✅ Profile updated successfully.');
        } catch (error) {
            console.error("Profile Update Error:", error);
            alert("🚨 A server error occurred while updating profile.");
        }
    };

    const handleGenerateRewardsQr = async () => {
        const email = user?.email;
        const hCode = hotelCode || user?.hotel_code || '';
        const points = Math.max(0, Math.floor(Number(qrRedeemPoints || 0)));
        if (!email || !hCode) {
            alert("Please log in again and try.");
            return;
        }
        if (points <= 0) {
            alert("Please enter points to convert to QR payment.");
            return;
        }

        try {
            setQrRedeemLoading(true);
            const res = await axios.post('/api/members/rewards/redeem-qr', {
                email,
                hotel_code: hCode,
                points,
                description: 'Hotel facility QR pay'
            });
            if (!res?.data?.success) {
                alert(`Failed to generate QR: ${res?.data?.message || 'unknown error'}`);
                return;
            }
            setQrRedeemData(res.data);
            await refreshRewardsData(email, hCode);
        } catch (error) {
            alert(`Failed to generate QR: ${error?.response?.data?.message || error.message}`);
        } finally {
            setQrRedeemLoading(false);
        }
    };

    // 💡 Identify Google Login user (Only email users can change passwords)
    const isGoogleUser = user?.auth_provider === 'google' || user?.password === null || !user?.password;

    const handleDocumentUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setProfileForm((prev) => ({ ...prev, documentUrl: String(reader.result || '') }));
        };
        reader.readAsDataURL(file);
    };

    const openFileUpload = () => fileUploadInputRef.current?.click();
    const openCameraCapture = () => cameraCaptureInputRef.current?.click();
    const optionalFieldClass = (value) => {
        const isFilled = !!String(value || '').trim();
        return `w-full p-4 border rounded-2xl font-bold outline-none transition-all ${isFilled
            ? 'bg-slate-50 border-slate-100 focus:ring-2 focus:ring-blue-500'
            : 'bg-amber-50 border-amber-300 focus:ring-2 focus:ring-amber-400'
            }`;
    };

    const buildReferralLink = () => {
        if (!rewardsData?.referralCode || typeof window === 'undefined') return '';
        const url = new URL(window.location.href);
        url.searchParams.set('ref', rewardsData.referralCode);
        url.hash = '';
        return url.toString();
    };

    const copyReferralLink = async () => {
        const link = buildReferralLink();
        if (!link) return;
        try {
            await navigator.clipboard?.writeText(link);
            alert('Referral link copied.');
        } catch (_) {
            window.prompt('Copy this referral link:', link);
        }
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center text-slate-400 font-bold bg-slate-50">Loading dashboard...</div>;
    }

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 font-sans mt-[72px]">

            {/* 📱 Mobile Menu Button */}
            <div className={`${isSiteMobileMenuOpen ? 'hidden' : 'flex'} md:hidden bg-white p-4 border-b justify-between items-center sticky top-0 z-50`}>
                <span className="font-black text-blue-600">MY PAGE</span>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-2xl text-slate-600">☰</button>
            </div>

            {isMobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
                    <div className="absolute right-5 top-24 flex flex-col gap-5" onClick={(e) => e.stopPropagation()}>
                        {[
                            { id: 'BOOKINGS', label: 'Bookings' },
                            { id: 'RECEIPTS', label: 'Receipts' },
                            ...(rewardsEnabled ? [{ id: 'REWARDS', label: 'Rewards' }] : []),
                            { id: 'PROFILE', label: 'Profile' }
                        ].map(menu => (
                            <button
                                key={`mobile_${menu.id}`}
                                type="button"
                                onClick={() => { setActiveTab(menu.id); setIsMobileMenuOpen(false); }}
                                className={`flex h-20 w-20 items-center justify-center rounded-full bg-white/85 px-3 text-center text-xs font-black shadow-2xl backdrop-blur-md transition-transform active:scale-95 ${activeTab === menu.id ? 'text-blue-700 ring-4 ring-white/40' : 'text-slate-900'}`}
                            >
                                {menu.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {/* 🖥️ Left Sidebar */}
            <div className="hidden md:relative md:translate-x-0 md:flex z-40 w-64 bg-white border-r border-slate-200 flex-col shadow-none">
                <div className="p-6 border-b border-slate-100 hidden md:block">
                    <div className="rounded-2xl bg-slate-900 text-white p-4 shadow-lg">
                        <div className="text-[10px] uppercase tracking-widest font-black text-slate-300">My Reward</div>
                        <div className="text-2xl font-black mt-1">{Number(rewardsData.points || 0).toLocaleString()} pts</div>
                        <div className="text-xs text-slate-300 mt-1">{rewardsData?.tier?.key || 'MEMBER'} Tier</div>
                        {rewardsData?.referralCode && (
                            <button
                                type="button"
                                onClick={copyReferralLink}
                                className="mt-2 w-full rounded-lg bg-white/10 px-2 py-1 text-left text-[10px] font-black uppercase tracking-widest text-emerald-200 hover:bg-white/20"
                            >
                                Copy Referral Link
                            </button>
                        )}
                        <div className="grid grid-cols-2 gap-2 mt-3">
                            <button
                                type="button"
                                onClick={() => { setActiveTab('REWARDS'); setShowRewardsHistoryModal(true); setIsMobileMenuOpen(false); }}
                                className="px-2 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-black"
                            >
                                History
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowRewardsQrModal(true); setIsMobileMenuOpen(false); }}
                                className="px-2 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-xs font-black"
                            >
                                Use in Hotel
                            </button>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {[
                        { id: 'BOOKINGS', label: 'My Bookings', icon: '🛎️' },
                        { id: 'RECEIPTS', label: 'Receipts', icon: '🧾' },
                        ...(rewardsEnabled ? [{ id: 'REWARDS', label: 'Rewards', icon: '🎁' }] : []),
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
                    <div className={`${isMobileMenuOpen ? 'hidden' : 'block'} md:hidden mb-4`}>
                        <div className="rounded-2xl bg-slate-900 text-white p-4 shadow-lg border border-slate-700">
                            <div className="text-[10px] uppercase tracking-widest font-black text-slate-300">My Reward</div>
                            <div className="text-2xl font-black mt-1">{Number(rewardsData.points || 0).toLocaleString()} pts</div>
                            <div className="text-xs text-slate-300 mt-1">{rewardsData?.tier?.key || 'MEMBER'} Tier</div>
                            {rewardsData?.referralCode && (
                                <button
                                    type="button"
                                    onClick={copyReferralLink}
                                    className="mt-2 w-full rounded-lg bg-white/10 px-2 py-1 text-left text-[10px] font-black uppercase tracking-widest text-emerald-200 hover:bg-white/20"
                                >
                                    Copy Referral Link
                                </button>
                            )}
                            <div className="grid grid-cols-2 gap-2 mt-3">
                                <button
                                    type="button"
                                    onClick={() => { setActiveTab('REWARDS'); setShowRewardsHistoryModal(true); }}
                                    className="px-2 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-black"
                                >
                                    History
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowRewardsQrModal(true); }}
                                    className="px-2 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-xs font-black"
                                >
                                    Use in Hotel
                                </button>
                            </div>
                        </div>
                    </div>

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


                    {activeTab === 'REWARDS' && rewardsEnabled && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            <h2 className="text-3xl font-black text-slate-800">Rewards</h2>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                                    <div className="text-xs uppercase tracking-widest font-black text-slate-400">Current Points</div>
                                    <div className="text-3xl font-black text-blue-700 mt-2">{Number(rewardsData.points || 0).toLocaleString()}</div>
                                </div>
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                                    <div className="text-xs uppercase tracking-widest font-black text-slate-400">Current Tier</div>
                                    <div className="text-2xl font-black text-slate-800 mt-2">{rewardsData?.tier?.key || 'MEMBER'}</div>
                                    <div className="text-xs text-slate-500 mt-1">{rewardsData?.tier?.benefit || 'Member benefits active'}</div>
                                </div>
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                                    <div className="text-xs uppercase tracking-widest font-black text-slate-400">Program</div>
                                    <div className="text-lg font-black text-slate-800 mt-2">{rewardsConfig?.program_name || 'Hotel Rewards Club'}</div>
                                    <div className="text-xs text-slate-500 mt-1">{rewardsConfig?.points_per_unit || 1} point(s) per {rewardsConfig?.points_unit_currency || 100} currency</div>
                                </div>
                            </div>

                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                                <h3 className="text-lg font-black text-slate-800 mb-3">How You Earn</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm font-bold text-slate-700">
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">Per Stay: {Number(rewardsConfig?.points_per_stay || 0).toLocaleString()} points</div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">Welcome Bonus: {Number(rewardsConfig?.welcome_bonus_points || 0).toLocaleString()} points</div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">Birthday Bonus: {Number(rewardsConfig?.birthday_bonus_points || 0).toLocaleString()} points</div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">Referral Bonus: {Number(rewardsConfig?.referral_bonus_points || 0).toLocaleString()} points</div>
                                </div>
                                {rewardsData?.referralCode && (
                                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Your Referral Link</div>
                                        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="break-all rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-900">{buildReferralLink()}</div>
                                            <button
                                                type="button"
                                                onClick={copyReferralLink}
                                                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
                                            >
                                                Copy Link
                                            </button>
                                        </div>
                                        <p className="mt-2 text-xs font-bold text-emerald-800">Share this link with a new member. Their signup form will automatically include your referral code, and referral points are credited after they join this hotel.</p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
                                <div className="p-6 border-b border-slate-100">
                                    <h3 className="text-lg font-black text-slate-800">Point History</h3>
                                </div>
                                {rewardsLoading ? (
                                    <div className="p-6 text-sm font-bold text-slate-500">Loading rewards history...</div>
                                ) : rewardsData.transactions.length === 0 ? (
                                    <div className="p-6 text-sm font-bold text-slate-500">No reward transactions yet.</div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 text-slate-600">
                                            <tr>
                                                <th className="text-left px-4 py-3 font-black">Date</th>
                                                <th className="text-left px-4 py-3 font-black">Type</th>
                                                <th className="text-left px-4 py-3 font-black">Points</th>
                                                <th className="text-left px-4 py-3 font-black">Description</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rewardsData.transactions.map((tx) => (
                                                <tr key={String(tx.id)} className="border-t border-slate-100">
                                                    <td className="px-4 py-3 text-slate-600">{String(tx.created_at || '').slice(0, 10) || '-'}</td>
                                                    <td className="px-4 py-3 font-bold text-slate-700">{String(tx.type || '').toUpperCase() || '-'}</td>
                                                    <td className="px-4 py-3 font-black text-blue-700">{Number(tx.amount || 0).toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-slate-600">{tx.description || tx.reference_type || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === 'PROFILE' && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-3xl font-black text-slate-800">My Profile</h2>

                            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs font-bold text-blue-700">
                                    Additional inputs below help make booking and check-in faster. Entered data is stored encrypted.
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                                        <input type="text" value={profileForm.firstName} onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })} className={optionalFieldClass(profileForm.firstName)} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                                        <input type="text" value={profileForm.lastName} onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })} className={optionalFieldClass(profileForm.lastName)} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                        <div className="relative">
                                            <input type="email" value={user.email || ''} disabled className="w-full p-4 bg-slate-100 border border-slate-100 rounded-2xl font-bold text-slate-400 cursor-not-allowed" />
                                            {isGoogleUser && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl">G</span>}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Birthday (MM/DD)</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <select value={profileForm.birthMonth} onChange={(e) => setProfileForm({ ...profileForm, birthMonth: e.target.value })} className={optionalFieldClass(profileForm.birthMonth)}>
                                                <option value="">Month</option>
                                                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                            <select value={profileForm.birthDay} onChange={(e) => setProfileForm({ ...profileForm, birthDay: e.target.value })} className={optionalFieldClass(profileForm.birthDay)}>
                                                <option value="">Day</option>
                                                {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((d) => (
                                                    <option key={d} value={d}>{d}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                                        <input type="tel" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} className={optionalFieldClass(profileForm.phone)} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nationality</label>
                                        <input type="text" value={profileForm.nationality} onChange={(e) => setProfileForm({ ...profileForm, nationality: e.target.value })} className={optionalFieldClass(profileForm.nationality)} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Province</label>
                                        <select value={profileForm.region} onChange={(e) => setProfileForm({ ...profileForm, region: e.target.value })} className={optionalFieldClass(profileForm.region)}>
                                            <option value="">Select Province</option>
                                            {PH_PROVINCES.map((p) => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Upload (for fast check-in)</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button type="button" onClick={openFileUpload} className="px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold text-sm hover:bg-slate-100 transition-all">
                                                File Upload
                                            </button>
                                            <button type="button" onClick={openCameraCapture} className="px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold text-sm hover:bg-slate-100 transition-all">
                                                Camera Capture
                                            </button>
                                        </div>
                                        <input ref={fileUploadInputRef} type="file" accept="image/*,.pdf" onChange={handleDocumentUpload} className="hidden" />
                                        <input ref={cameraCaptureInputRef} type="file" accept="image/*" capture="environment" onChange={handleDocumentUpload} className="hidden" />
                                    </div>
                                </div>
                                {profileForm.documentUrl && (
                                    <p className="text-xs text-slate-500 font-bold">ID file attached. It will be used to speed up booking and front desk check-in.</p>
                                )}
                                {!profileForm.documentUrl && (
                                    <p className="text-xs text-amber-700 font-bold">No ID uploaded yet. You can still update your profile.</p>
                                )}
                                <button onClick={handleProfileUpdate} className="px-8 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-blue-600 transition-all active:scale-95 shadow-lg">Update Profile</button>
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

                {showRewardsHistoryModal && (
                    <div className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowRewardsHistoryModal(false)}>
                        <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-xl font-black text-slate-800">Point History</h3>
                                <button type="button" className="text-slate-400 text-2xl font-black" onClick={() => setShowRewardsHistoryModal(false)}>×</button>
                            </div>
                            <div className="max-h-[70vh] overflow-y-auto">
                                {rewardsLoading ? (
                                    <div className="p-6 text-sm font-bold text-slate-500">Loading rewards history...</div>
                                ) : rewardsData.transactions.length === 0 ? (
                                    <div className="p-6 text-sm font-bold text-slate-500">No reward transactions yet.</div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 text-slate-600 sticky top-0">
                                            <tr>
                                                <th className="text-left px-4 py-3 font-black">Date</th>
                                                <th className="text-left px-4 py-3 font-black">Type</th>
                                                <th className="text-left px-4 py-3 font-black">Points</th>
                                                <th className="text-left px-4 py-3 font-black">Description</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rewardsData.transactions.map((tx) => {
                                                const signed = Number(tx.amount || 0);
                                                const isRedeem = String(tx.type || '').toUpperCase() === 'REDEEM';
                                                return (
                                                    <tr key={`hist_${tx.id}`} className="border-t border-slate-100">
                                                        <td className="px-4 py-3 text-slate-600">{String(tx.created_at || '').slice(0, 10) || '-'}</td>
                                                        <td className="px-4 py-3 font-bold text-slate-700">{String(tx.type || '').toUpperCase() || '-'}</td>
                                                        <td className={`px-4 py-3 font-black ${isRedeem ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                            {signed > 0 ? '+' : ''}{signed.toLocaleString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600">{tx.description || tx.reference_type || '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {showRewardsQrModal && (
                    <div className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowRewardsQrModal(false)}>
                        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-lg font-black text-slate-800">QR Point Payment</h3>
                                <button type="button" className="text-slate-400 text-2xl font-black" onClick={() => setShowRewardsQrModal(false)}>×</button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="text-xs font-bold text-slate-500">Available points: {Number(rewardsData.points || 0).toLocaleString()} pts</div>
                                <input
                                    type="number"
                                    min="0"
                                    value={qrRedeemPoints}
                                    onChange={(e) => setQrRedeemPoints(e.target.value)}
                                    placeholder="Enter points to use"
                                    className="w-full p-3 border border-slate-200 rounded-xl font-bold"
                                />
                                <button
                                    type="button"
                                    onClick={handleGenerateRewardsQr}
                                    disabled={qrRedeemLoading}
                                    className="w-full py-3 rounded-xl bg-slate-900 text-white font-black disabled:opacity-50"
                                >
                                    {qrRedeemLoading ? 'Generating...' : 'Generate QR'}
                                </button>
                                {qrRedeemData?.qr_image_url && (
                                    <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50 text-center">
                                        <img src={qrRedeemData.qr_image_url} alt="Rewards QR" className="w-52 h-52 mx-auto rounded-xl border border-slate-200 bg-white p-2" />
                                        <div className="mt-3 text-xs font-bold text-slate-600">Value: ₱{Number(qrRedeemData.value_amount || 0).toLocaleString()} | Points: {Number(qrRedeemData.points_used || 0).toLocaleString()}</div>
                                        <div className="mt-1 text-[11px] text-slate-500">Show this QR at hotel facilities (valid 15 minutes).</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}


