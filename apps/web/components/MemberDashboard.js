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

const normalizeMemberBooking = (booking = {}) => {
    const reservationId = booking.id || booking.res_id || booking.reservation_id || '';
    const hotelName = booking.hotel_name || booking.hotel_code || 'Hotel Booking';
    const totalAmount = Number(
        booking.total_amount ??
        booking.total_price ??
        booking.amount ??
        booking.paid_amount ??
        0
    );

    return {
        ...booking,
        id: reservationId,
        reservation_id: reservationId,
        hotel_name: hotelName,
        room_type: booking.room_type || booking.room_name || 'Room',
        check_in: booking.check_in || booking.check_in_date || '',
        check_out: booking.check_out || booking.check_out_date || '',
        total_amount: Number.isFinite(totalAmount) ? totalAmount : 0,
        paid_amount: Number.isFinite(Number(booking.paid_amount)) ? Number(booking.paid_amount) : (Number.isFinite(totalAmount) ? totalAmount : 0),
        status: booking.status || 'CONFIRMED'
    };
};

export default function MemberDashboard({ hotelCode, isSiteMobileMenuOpen = false, posRewardToken = '' }) {
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
    const qrScannerVideoRef = useRef(null);
    const qrScannerStreamRef = useRef(null);
    const qrScannerRafRef = useRef(null);

    // 💡 State initialization (removed mock data)
    const [user, setUser] = useState({});
    const [upcomingBookings, setUpcomingBookings] = useState([]);
    const [receiptDocuments, setReceiptDocuments] = useState([]);
    const [rewardsEnabled, setRewardsEnabled] = useState(false);
    const [rewardsConfig, setRewardsConfig] = useState(null);
    const [rewardsData, setRewardsData] = useState({ points: 0, tier: null, transactions: [], referralCode: '' });
    const [rewardsLoading, setRewardsLoading] = useState(false);
    const [showRewardsHistoryModal, setShowRewardsHistoryModal] = useState(false);
    const [showRewardsQrModal, setShowRewardsQrModal] = useState(false);
    const [qrRedeemPoints, setQrRedeemPoints] = useState('');
    const [qrRedeemData, setQrRedeemData] = useState(null);
    const [qrRedeemLoading, setQrRedeemLoading] = useState(false);
    const [posRewardIntent, setPosRewardIntent] = useState(null);
    const [posRewardTokenInput, setPosRewardTokenInput] = useState('');
    const [posRewardPayLoading, setPosRewardPayLoading] = useState(false);
    const [isQrScannerStarting, setIsQrScannerStarting] = useState(false);
    const [isQrScannerActive, setIsQrScannerActive] = useState(false);
    const [qrScannerError, setQrScannerError] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const refreshRewardsData = async (email, targetHotelCode) => {
        if (!email || !targetHotelCode) return null;
        try {
            setRewardsLoading(true);
            const pendingReferralCode = typeof window !== 'undefined'
                ? String(localStorage.getItem('nplus_pending_referral_code') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
                : '';
            const referralQuery = pendingReferralCode ? `&referral_code=${encodeURIComponent(pendingReferralCode)}` : '';
            const rewardsRes = await axios.get(`/api/members/rewards?email=${encodeURIComponent(email)}&hotel_code=${encodeURIComponent(targetHotelCode)}${referralQuery}`);
            if (rewardsRes?.data?.success) {
                if (rewardsRes.data.referral_applied && typeof window !== 'undefined') {
                    localStorage.removeItem('nplus_pending_referral_code');
                }
                const nextReferralCode = rewardsRes.data.referral_code || '';
                setRewardsEnabled(!!rewardsRes.data.rewards_enabled || !!nextReferralCode);
                setRewardsConfig(rewardsRes.data.config || null);
                setRewardsData({
                    points: Number(rewardsRes.data.points || 0),
                    tier: rewardsRes.data.tier || null,
                    referralCode: nextReferralCode,
                    transactions: Array.isArray(rewardsRes.data.transactions) ? rewardsRes.data.transactions : []
                });
                return rewardsRes.data;
            }
            return null;
        } catch (err) {
            console.error('Rewards refresh failed:', err);
            return null;
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

                // Booking history should not block rewards/referral loading.
                try {
                    const qs = new URLSearchParams({ email: parsedUser.email, hotel: effectiveHotel });
                    const res = await axios.get(`/api/members/bookings?${qs.toString()}`);

                    if (res.data && res.data.success) {
                        let fetchBookings = (res.data.bookings || []).map(normalizeMemberBooking);

                        // If accessed via a single hotel website (?hotel=A001), filter bookings accordingly
                        if (hotelCode) {
                            fetchBookings = fetchBookings.filter(b => b.hotel_code === hotelCode);
                        }
                        setUpcomingBookings(fetchBookings);
                    }
                } catch (bookingErr) {
                    console.error('Failed to load real bookings:', bookingErr);
                    setUpcomingBookings([]);
                }

                try {
                    const receiptQs = new URLSearchParams({ email: parsedUser.email, hotel_code: effectiveHotel });
                    const receiptRes = await axios.get(`/api/members/receipts?${receiptQs.toString()}`);
                    if (receiptRes?.data?.success) {
                        setReceiptDocuments(Array.isArray(receiptRes.data.receipts) ? receiptRes.data.receipts : []);
                    } else {
                        setReceiptDocuments([]);
                    }
                } catch (receiptErr) {
                    console.error('Failed to load archived receipts:', receiptErr);
                    setReceiptDocuments([]);
                }

                if (effectiveHotel) {
                    try {
                        const cfgRes = await axios.get(`/api/public/rewards-config?hotel_code=${encodeURIComponent(effectiveHotel)}`);
                        const cfgEnabled = !!cfgRes?.data?.rewards_enabled;
                        setRewardsEnabled(cfgEnabled);
                        setRewardsConfig(cfgRes?.data?.config || null);

                        const rewardData = parsedUser.email
                            ? await refreshRewardsData(parsedUser.email, effectiveHotel)
                            : null;
                        const shouldShowRewards = cfgEnabled || !!rewardData?.referral_code;
                        setRewardsEnabled(shouldShowRewards);

                        if (shouldShowRewards && sessionStorage.getItem('nplus_open_rewards') === '1') {
                            setActiveTab('REWARDS');
                            sessionStorage.removeItem('nplus_open_rewards');
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

    useEffect(() => {
        const token = String(posRewardToken || '').trim();
        if (!token) return;
        setShowRewardsQrModal(true);
        setPosRewardTokenInput(token);
        if (hotelCode || user?.hotel_code) loadPosRewardIntent(token);
    }, [posRewardToken, hotelCode, user?.hotel_code]);

    const handleDownloadReceipt = async (receipt) => {
        try {
            const qs = new URLSearchParams({
                hotel_code: hotelCode || user?.hotel_code || ''
            });
            const res = await axios.get(`/api/members/receipts/${receipt.id}/pdf?${qs.toString()}`, {
                responseType: 'blob'
            });
            const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${receipt.receipt_no || `receipt_${receipt.id}`}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Receipt download failed:', error);
            alert('Failed to download the archived receipt PDF.');
        }
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

    const loadPosRewardIntent = async (tokenValue) => {
        const token = String(tokenValue || '').trim();
        const hCode = hotelCode || user?.hotel_code || '';
        if (!token || !hCode) return null;
        try {
            setQrRedeemLoading(true);
            const res = await axios.get(`/api/members/rewards/pos-payment-intent?token=${encodeURIComponent(token)}&hotel_code=${encodeURIComponent(hCode)}`);
            if (res?.data?.success) {
                setPosRewardIntent(res.data.intent || null);
                setPosRewardTokenInput(token);
                return res.data.intent || null;
            }
            return null;
        } catch (error) {
            alert(`Failed to load POS payment QR: ${error?.response?.data?.message || error.message}`);
            return null;
        } finally {
            setQrRedeemLoading(false);
        }
    };

    const qrScannerSupported = typeof window !== 'undefined'
        && 'BarcodeDetector' in window
        && !!navigator.mediaDevices?.getUserMedia;

    const stopQrScanner = () => {
        try {
            if (qrScannerRafRef.current && typeof window !== 'undefined') {
                window.cancelAnimationFrame(qrScannerRafRef.current);
            }
        } catch (_) { }
        qrScannerRafRef.current = null;

        try {
            qrScannerStreamRef.current?.getTracks?.().forEach((track) => track.stop());
        } catch (_) { }
        qrScannerStreamRef.current = null;

        if (qrScannerVideoRef.current) {
            try {
                qrScannerVideoRef.current.pause();
            } catch (_) { }
            qrScannerVideoRef.current.srcObject = null;
        }

        setIsQrScannerActive(false);
        setIsQrScannerStarting(false);
    };

    const extractPosRewardToken = (rawValue) => {
        const raw = String(rawValue || '').trim();
        if (!raw) return '';

        const parseUrlToken = (value) => {
            try {
                const url = new URL(value);
                return String(
                    url.searchParams.get('pos_reward_token')
                    || url.searchParams.get('reward_payment_token')
                    || url.searchParams.get('token')
                    || ''
                ).trim();
            } catch (_) {
                return '';
            }
        };

        const directFromUrl = parseUrlToken(raw);
        if (directFromUrl) return directFromUrl;

        if (raw.includes('pos_reward_token=') || raw.includes('reward_payment_token=')) {
            try {
                const query = raw.includes('?') ? raw.split('?')[1] : raw;
                const params = new URLSearchParams(query);
                return String(
                    params.get('pos_reward_token')
                    || params.get('reward_payment_token')
                    || params.get('token')
                    || raw
                ).trim();
            } catch (_) {
                return raw;
            }
        }

        return raw;
    };

    const startQrScanner = async () => {
        if (!qrScannerSupported) {
            setQrScannerError('Camera QR scanning is not supported on this browser. Please use Chrome or Edge on mobile, or paste the POS reward token manually.');
            return;
        }

        try {
            stopQrScanner();
            setQrScannerError('');
            setQrRedeemData(null);
            setPosRewardIntent(null);
            setIsQrScannerStarting(true);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' }
                },
                audio: false
            });

            qrScannerStreamRef.current = stream;
            const video = qrScannerVideoRef.current;
            if (!video) {
                throw new Error('Scanner preview could not be initialized.');
            }

            video.srcObject = stream;
            video.setAttribute('playsinline', 'true');
            await video.play();

            const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            setIsQrScannerActive(true);
            setIsQrScannerStarting(false);

            const scanFrame = async () => {
                if (!qrScannerVideoRef.current) return;
                try {
                    const codes = await detector.detect(qrScannerVideoRef.current);
                    const rawValue = codes?.[0]?.rawValue || '';
                    const token = extractPosRewardToken(rawValue);
                    if (token) {
                        setPosRewardTokenInput(token);
                        setQrScannerError('');
                        stopQrScanner();
                        await loadPosRewardIntent(token);
                        return;
                    }
                } catch (_) {
                    // keep scanning until a QR is detected
                }
                qrScannerRafRef.current = window.requestAnimationFrame(scanFrame);
            };

            qrScannerRafRef.current = window.requestAnimationFrame(scanFrame);
        } catch (error) {
            stopQrScanner();
            setQrScannerError(error?.message || 'Unable to access the camera for QR scanning.');
        }
    };

    useEffect(() => {
        if (!showRewardsQrModal) {
            stopQrScanner();
            setQrScannerError('');
        }
    }, [showRewardsQrModal]);

    useEffect(() => {
        return () => stopQrScanner();
    }, []);

    useEffect(() => {
        if (!showRewardsQrModal || !qrScannerSupported || isQrScannerActive || posRewardIntent || String(posRewardTokenInput || '').trim()) {
            return;
        }
        startQrScanner();
    }, [showRewardsQrModal, posRewardIntent, posRewardTokenInput, isQrScannerActive]);

    const handlePayPosRewardQr = async () => {
        const email = user?.email;
        const hCode = hotelCode || user?.hotel_code || '';
        const token = String(posRewardIntent?.token || posRewardTokenInput || '').trim();
        if (!email || !hCode) return alert('Please log in again and try.');
        if (!token) return alert('Please scan or enter a POS reward payment QR first.');
        try {
            setPosRewardPayLoading(true);
            const res = await axios.post('/api/members/rewards/pay-pos-qr', {
                email,
                hotel_code: hCode,
                token
            });
            if (!res?.data?.success) {
                alert(`Reward points payment failed: ${res?.data?.message || 'unknown error'}`);
                return;
            }
            setQrRedeemData(res.data);
            setPosRewardIntent(prev => ({ ...(prev || {}), status: 'PAID', points_used: res.data.points_used, currency_amount: res.data.value_amount }));
            await refreshRewardsData(email, hCode);
            alert(`Reward points payment completed. ${Number(res.data.points_used || 0).toLocaleString()} pts used.`);
        } catch (error) {
            alert(`Reward points payment failed: ${error?.response?.data?.message || error.message}`);
        } finally {
            setPosRewardPayLoading(false);
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
                        {rewardsData?.referralCode ? (
                            <button
                                type="button"
                                onClick={copyReferralLink}
                                className="mt-2 w-full rounded-lg bg-white/10 px-2 py-1 text-left text-[10px] font-black uppercase tracking-widest text-emerald-200 hover:bg-white/20"
                            >
                                Copy Referral Link
                            </button>
                        ) : (
                            <div className="mt-2 rounded-lg bg-white/5 px-2 py-1 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Referral link loading
                            </div>
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
                            {rewardsData?.referralCode ? (
                                <button
                                    type="button"
                                    onClick={copyReferralLink}
                                    className="mt-2 w-full rounded-lg bg-white/10 px-2 py-1 text-left text-[10px] font-black uppercase tracking-widest text-emerald-200 hover:bg-white/20"
                                >
                                    Copy Referral Link
                                </button>
                            ) : (
                                <div className="mt-2 rounded-lg bg-white/5 px-2 py-1 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Referral link loading
                                </div>
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
                            {receiptDocuments.length === 0 ? (
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center">
                                    <div className="text-5xl mb-4">🧾</div>
                                    <h3 className="text-lg font-bold text-slate-700 mb-2">No receipts available.</h3>
                                    <p className="text-sm text-slate-500">Issued reservation, deposit, and checkout receipts will be stored here.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {receiptDocuments.map((receipt) => {
                                        const receiptKind = String(receipt.receipt_kind || 'RECEIPT').toUpperCase();
                                        const receiptTypeLabel = receiptKind === 'CHECKIN'
                                            ? 'Check-in Deposit'
                                            : receiptKind === 'CHECKOUT'
                                                ? 'Check-out Settlement'
                                                : receiptKind === 'CONFIRMATION'
                                                    ? 'Reservation Confirmation'
                                                    : 'Official Receipt';
                                        return (
                                        <div key={`rcpt-${receipt.id}`} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
                                            <div className="mb-8">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🧾</div>
                                                    <span className="text-[10px] font-mono font-bold text-slate-400">#{receipt.receipt_no || receipt.id}</span>
                                                </div>
                                                <h4 className="font-black text-slate-800 mb-1">{receiptTypeLabel}</h4>
                                                <p className="text-xs font-bold text-blue-600 mb-2">{receipt.room_type || 'Accommodation'}</p>
                                                <p className="text-xs font-bold text-slate-500">{receipt.check_in || '-'} ~ {receipt.check_out || '-'}</p>
                                                <p className="mt-3 text-xs font-semibold text-slate-500 line-clamp-2">{receipt.description || 'Issued hotel receipt'}</p>
                                                <div className="mt-4 flex items-center justify-between gap-3">
                                                    <div className="flex flex-col">
                                                        <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase text-emerald-700">{receiptKind}</span>
                                                        <span className="mt-2 text-[11px] font-bold text-slate-400">{receipt.date || String(receipt.timestamp || '').slice(0, 10) || '-'}</span>
                                                    </div>
                                                    <span className="text-base font-black text-slate-900">PHP {Number(receipt.amount || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <button onClick={() => handleDownloadReceipt(receipt)} className="w-full py-3.5 bg-blue-50 text-blue-600 font-black rounded-2xl hover:bg-blue-600 hover:text-white transition-all">Download PDF</button>
                                        </div>
                                    )})}
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
                                                <th className="text-right px-4 py-3 font-black">Points</th>
                                                <th className="text-left px-4 py-3 font-black">Description</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rewardsData.transactions.map((tx) => {
                                                const signed = Number(tx.amount || 0);
                                                const isRedeem = String(tx.type || '').toUpperCase() === 'REDEEM';
                                                const badgeClass = isRedeem
                                                    ? 'bg-red-50 border-red-200 text-red-600'
                                                    : 'bg-green-50 border-green-200 text-green-600';
                                                return (
                                                    <tr key={String(tx.id)} className="border-t border-slate-100">
                                                        <td className="px-4 py-3 text-slate-600">{String(tx.created_at || '').slice(0, 10) || '-'}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex min-w-[84px] items-center justify-center rounded-md border px-3 py-1 text-xs font-black tracking-wide ${badgeClass}`}>
                                                                {String(tx.type || '').toUpperCase() || '-'}
                                                            </span>
                                                        </td>
                                                        <td className={`px-4 py-3 text-right font-black ${isRedeem ? 'text-red-600' : 'text-blue-600'}`}>
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
                                        <div className="flex items-center gap-2 min-h-[20px]">
                                            {profileForm.documentUrl ? (
                                                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">
                                                    <span>✓</span>
                                                    <span>ID uploaded</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-black text-slate-500">
                                                    <span>○</span>
                                                    <span>No file yet</span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button type="button" onClick={openFileUpload} className={`px-3 py-3 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${profileForm.documentUrl ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>
                                                <span>File Upload</span>
                                                {profileForm.documentUrl && <span className="text-base leading-none">✓</span>}
                                            </button>
                                            <button type="button" onClick={openCameraCapture} className={`px-3 py-3 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${profileForm.documentUrl ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>
                                                <span>Camera Capture</span>
                                                {profileForm.documentUrl && <span className="text-base leading-none">✓</span>}
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
                                                <th className="text-right px-4 py-3 font-black">Points</th>
                                                <th className="text-left px-4 py-3 font-black">Description</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rewardsData.transactions.map((tx) => {
                                                const signed = Number(tx.amount || 0);
                                                const isRedeem = String(tx.type || '').toUpperCase() === 'REDEEM';
                                                const badgeClass = isRedeem
                                                    ? 'bg-red-50 border-red-200 text-red-600'
                                                    : 'bg-green-50 border-green-200 text-green-600';
                                                return (
                                                    <tr key={`hist_${tx.id}`} className="border-t border-slate-100">
                                                        <td className="px-4 py-3 text-slate-600">{String(tx.created_at || '').slice(0, 10) || '-'}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex min-w-[84px] items-center justify-center rounded-md border px-3 py-1 text-xs font-black tracking-wide ${badgeClass}`}>
                                                                {String(tx.type || '').toUpperCase() || '-'}
                                                            </span>
                                                        </td>
                                                        <td className={`px-4 py-3 text-right font-black ${isRedeem ? 'text-red-600' : 'text-blue-600'}`}>
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
                                <h3 className="text-lg font-black text-slate-800">Pay POS QR with Points</h3>
                                <button type="button" className="text-slate-400 text-2xl font-black" onClick={() => setShowRewardsQrModal(false)}>×</button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs font-bold text-blue-700">
                                    Scan the QR shown on the hotel POS. This screen approves the POS payment with your reward points.
                                </div>
                                <div className="text-xs font-bold text-slate-500">Available points: {Number(rewardsData.points || 0).toLocaleString()} pts</div>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                                        <input
                                            type="text"
                                            value={posRewardTokenInput}
                                            onChange={(e) => setPosRewardTokenInput(e.target.value)}
                                            placeholder="POS reward QR token"
                                            className="flex-1 p-3 border border-slate-200 rounded-xl font-bold"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => loadPosRewardIntent(posRewardTokenInput)}
                                            disabled={qrRedeemLoading}
                                            className="px-4 rounded-xl bg-slate-900 text-white text-xs font-black disabled:opacity-50"
                                        >
                                            Load
                                        </button>
                                        <button
                                            type="button"
                                            onClick={isQrScannerActive ? stopQrScanner : startQrScanner}
                                            disabled={isQrScannerStarting}
                                            className="px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-black disabled:opacity-50"
                                        >
                                            {isQrScannerStarting ? 'Starting...' : (isQrScannerActive ? 'Stop Scan' : 'Scan QR')}
                                        </button>
                                    </div>

                                    <div className={`overflow-hidden rounded-2xl border ${isQrScannerActive ? 'border-emerald-200 bg-slate-950' : 'border-dashed border-slate-200 bg-slate-50'}`}>
                                        {isQrScannerActive ? (
                                            <div className="relative">
                                                <video
                                                    ref={qrScannerVideoRef}
                                                    autoPlay
                                                    muted
                                                    playsInline
                                                    className="h-56 w-full object-cover"
                                                />
                                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                                    <div className="h-40 w-40 rounded-3xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.28)]" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 text-xs font-bold text-slate-500">
                                                {qrScannerSupported
                                                    ? 'Tap "Scan QR" to open the camera and read the hotel POS QR automatically.'
                                                    : 'Camera QR scanning is not supported on this browser yet. You can still paste the POS reward token manually.'}
                                            </div>
                                        )}
                                    </div>

                                    {qrScannerError && (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-bold text-amber-700">
                                            {qrScannerError}
                                        </div>
                                    )}
                                </div>

                                {posRewardIntent && (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Request</div>
                                        <div className="mt-2 flex items-center justify-between text-sm font-bold text-slate-700"><span>Store</span><span>{posRewardIntent.store_name || '-'}</span></div>
                                        <div className="mt-1 flex items-center justify-between text-sm font-bold text-slate-700"><span>Table</span><span>{posRewardIntent.table_number || '-'}</span></div>
                                        <div className="mt-1 flex items-center justify-between text-sm font-bold text-slate-700"><span>Status</span><span>{posRewardIntent.status || 'PENDING'}</span></div>
                                        <div className="mt-3 flex items-end justify-between border-t border-slate-200 pt-3">
                                            <span className="text-sm font-black text-slate-600">Amount</span>
                                            <span className="text-2xl font-black text-slate-900">₱{Number(posRewardIntent.amount || posRewardIntent.currency_amount || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={handlePayPosRewardQr}
                                    disabled={posRewardPayLoading || !posRewardIntent || String(posRewardIntent.status || '').toUpperCase() !== 'PENDING'}
                                    className="w-full py-3 rounded-xl bg-emerald-600 text-white font-black disabled:opacity-50"
                                >
                                    {posRewardPayLoading ? 'Paying...' : 'Pay with Reward Points'}
                                </button>

                                {qrRedeemData?.success && (
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                                        <div className="text-sm font-black text-emerald-700">Payment completed</div>
                                        <div className="mt-2 text-xs font-bold text-emerald-800">Used {Number(qrRedeemData.points_used || 0).toLocaleString()} pts for ₱{Number(qrRedeemData.value_amount || 0).toLocaleString()}</div>
                                        <div className="mt-1 text-[11px] text-emerald-700">You may now return to the cashier.</div>
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




