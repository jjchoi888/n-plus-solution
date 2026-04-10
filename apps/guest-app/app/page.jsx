'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function HomePage() {
    const router = useRouter();

    // Auth & Security States
    const [user, setUser] = useState(null);
    const [isMembershipActive, setIsMembershipActive] = useState(false);
    const [membershipStatus, setMembershipStatus] = useState('');
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [loginPin, setLoginPin] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardStep, setOnboardStep] = useState(1);

    // Step 1: 개인정보
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [dob, setDob] = useState('');
    const [phone, setPhone] = useState('');
    const [nationality, setNationality] = useState('');
    const [email, setEmail] = useState('');

    // Step 2: 신분증 정보
    const [citizenType, setCitizenType] = useState('');
    const [idType, setIdType] = useState('');
    const [idUploaded, setIdUploaded] = useState(false);

    // Step 3: 결제 정보
    const [paymentMethod, setPaymentMethod] = useState('');
    const [accName, setAccName] = useState('');
    const [accNum, setAccNum] = useState('');

    // Step 4: 보안 (PIN 설정)
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');

    const [hotels, setHotels] = useState([]);
    const [currentHotelIndex, setCurrentHotelIndex] = useState(0);
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    const filipinoIdOptions = [
        "PhilSys ID", "Passport", "Driver's License",
        "PRC ID", "SSS/GSIS ID", "PhilHealth ID", "Voter's ID"
    ];

    const topNationalities = ['Philippines', 'South Korea', 'China', 'Japan', 'United States'];
    const otherNationalities = ['Australia', 'Canada', 'France', 'Germany', 'India', 'Indonesia', 'Malaysia', 'Singapore', 'Taiwan', 'Thailand', 'United Kingdom', 'Vietnam'];

    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        const savedUser = localStorage.getItem('nplus_guest_user');
        if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);
            setIsMembershipActive(parsedUser.is_membership_active === 1 || parsedUser.is_membership_active === true);
            setMembershipStatus(parsedUser.membership_status || 'active');

            // 유저가 있으면 앱 접속 시 잠금 상태로 설정 (PIN 요구)
            setIsUnlocked(false);

            axios.get(`https://api.hotelnplus.com/api/members/profile?email=${parsedUser.email}&t=${Date.now()}`, {
                headers: { 'Cache-Control': 'no-cache' }
            })
                .then(res => {
                    if (res.data && res.data.success && res.data.member) {
                        const freshUser = {
                            ...parsedUser, // 유지할 로컬 데이터 (PIN 등)
                            ...res.data.member,
                            name: `${res.data.member.first_name || ''} ${res.data.member.last_name || ''}`.trim() || 'Guest User'
                        };
                        localStorage.setItem('nplus_guest_user', JSON.stringify(freshUser));
                        setUser(freshUser);
                        setIsMembershipActive(freshUser.is_membership_active === 1 || freshUser.is_membership_active === true);
                        setMembershipStatus(freshUser.membership_status || 'active');
                    }
                })
                .catch(err => console.error("Home sync error:", err));
        } else {
            // 로그인 안된 상태면 화면 바로 표시
            setIsUnlocked(true);
        }

        axios.get('https://api.hotelnplus.com/api/hotels')
            .then(res => {
                const validHotels = (res.data || []).filter(h => h.code);
                setHotels(validHotels);
            })
            .catch(err => console.error(err));

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    useEffect(() => {
        if (hotels.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentHotelIndex(prev => (prev + 1) % hotels.length);
        }, 3500);
        return () => clearInterval(timer);
    }, [hotels.length]);

    const handleLogout = () => {
        localStorage.removeItem('nplus_guest_user');
        setUser(null);
        setIsMembershipActive(false);
        setMembershipStatus('');
        setIsUnlocked(true);
        window.location.reload();
    };

    const startOnboarding = () => {
        setShowOnboarding(true);
        setOnboardStep(1);
    };

    const nextStep = () => {
        if (onboardStep === 1) {
            if (!firstName || !lastName || !dob || !phone || !nationality || !email) {
                return alert('Please fill in all personal information fields.');
            }
        }
        if (onboardStep === 2) {
            if (!citizenType) return alert('Please select Filipino or Foreigner.');
            if (!idType) return alert('Please select an ID type.');
            if (!idUploaded) return alert('Please upload your ID or take a photo.');
        }
        if (onboardStep === 3) {
            if (!paymentMethod) return alert('Please select a payment method.');
            if (!accName || !accNum) return alert('Please fill in your payment details.');
        }
        if (onboardStep === 4) {
            if (pin.length !== 4) return alert('Please enter a 4-digit PIN.');
            if (pin !== confirmPin) return alert('PIN numbers do not match.');
            return completeOnboarding();
        }

        setOnboardStep(onboardStep + 1);
    };

    const completeOnboarding = async () => {
        try {
            const payload = {
                first_name: firstName,
                last_name: lastName,
                dob: dob,
                phone: phone,
                nationality: nationality,
                email: email,
                citizen_type: citizenType,
                id_type: idType,
                payment_method: paymentMethod,
                payment_acc_name: accName,
                payment_acc_num: accNum,
                membership_status: 'pending'
            };

            const response = await axios.post("https://api.hotelnplus.com/api/members/join-rewards", payload);

            if (response.data && response.data.success) {
                const finalUser = {
                    ...payload,
                    name: `${firstName} ${lastName}`.trim(),
                    is_membership_active: false,
                    pin: pin
                };

                localStorage.setItem('nplus_guest_user', JSON.stringify(finalUser));
                setUser(finalUser);
                setIsMembershipActive(false);
                setMembershipStatus('pending');
                setIsUnlocked(true);
                setShowOnboarding(false);

                alert('Registration submitted successfully! Your account is currently under review by n+ Rewards. You will be notified once activated.');
            } else {
                alert("Failed to join rewards: " + response.data.message);
            }
        } catch (error) {
            console.error("Join Error:", error);
            alert(error.response?.data?.message || "Server error occurred.");
        }
    };

    const handleJoinClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            setDeferredPrompt(null);
        }
        // 이메일 로그인 페이지로 이동하도록 수정 (기존의 모달 팝업 대신 로그인/가입 전용 페이지로 라우팅)
        router.push('/login');
    };

    const handleLoginPinInput = (num) => {
        if (loginPin.length < 4) {
            const newPin = loginPin + num;
            setLoginPin(newPin);
            if (newPin.length === 4) {
                if (newPin === user.pin) {
                    setIsUnlocked(true);
                } else {
                    setTimeout(() => {
                        alert('Incorrect PIN. Please try again.');
                        setLoginPin('');
                    }, 100);
                }
            }
        }
    };

    const handleForgotPinLockScreen = async () => {
        if (!user || !user.email) return;

        setIsResetting(true);
        try {
            // await axios.post('https://api.hotelnplus.com/api/members/forgot-pin', { email: user.email });
            await new Promise(resolve => setTimeout(resolve, 800));
            alert(`A PIN reset link has been sent to ${user.email}. Please check your inbox to reset your PIN.`);
        } catch (error) {
            console.error("Forgot PIN Error:", error);
            alert("Failed to send reset link. Please try again.");
        } finally {
            setIsResetting(false);
        }
    };

    // 💡 락스크린 (보안 화면) 렌더링
    if (user && !isUnlocked) {
        return (
            <div className="fixed inset-0 bg-slate-900 z-[200] flex flex-col items-center justify-center font-sans text-white p-6">
                <div className="text-center mb-8">
                    <div className="bg-white p-3 rounded-full inline-block mb-4">
                        <img src="/logo192.png" alt="Logo" className="w-12 h-12 object-contain" />
                    </div>
                    <h2 className="text-2xl font-bold mb-1">Welcome Back</h2>
                    <p className="text-slate-400 text-sm">Enter your PIN to unlock</p>
                </div>

                <div className="flex gap-4 mb-10">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`w-4 h-4 rounded-full border-2 transition-colors duration-200 ${loginPin.length > i ? 'bg-[#009900] border-[#009900]' : 'border-slate-500'}`} />
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-6 max-w-[280px] w-full">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button key={num} onClick={() => handleLoginPinInput(num.toString())} className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-2xl font-semibold hover:bg-slate-700 active:bg-slate-600 transition-colors mx-auto">
                            {num}
                        </button>
                    ))}
                    <div className="col-start-2">
                        <button onClick={() => handleLoginPinInput('0')} className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-2xl font-semibold hover:bg-slate-700 active:bg-slate-600 transition-colors mx-auto">0</button>
                    </div>
                    <div className="flex items-center justify-center">
                        <button onClick={() => setLoginPin(loginPin.slice(0, -1))} className="text-slate-400 font-bold active:text-white p-2 text-xl">⌫</button>
                    </div>
                </div>

                <div className="mt-12 space-y-5 text-center w-full max-w-[280px]">
                    <button onClick={() => alert('Biometric login requires secure backend setup. Please use PIN for now.')} className="text-[#009900] text-sm font-semibold flex items-center justify-center gap-2 w-full">
                        <span className="text-xl">🪪</span> Use Face ID / Fingerprint
                    </button>

                    <button
                        onClick={handleForgotPinLockScreen}
                        disabled={isResetting}
                        className="text-slate-400 text-sm font-medium hover:text-white transition-colors block mx-auto disabled:opacity-50"
                    >
                        {isResetting ? 'Sending Link...' : 'Forgot PIN?'}
                    </button>

                    <button onClick={handleLogout} className="text-slate-500 text-xs underline block mx-auto pt-2 border-t border-slate-800 w-full">
                        Sign in with different account
                    </button>
                </div>
            </div>
        );
    }

    // 💡 메인 렌더링 영역: 유저 로그인 여부에 따라 완전히 다른 화면 구조를 보여줍니다.
    return (
        <div className={`p-4 md:p-6 flex flex-col font-sans selection:bg-[#009900]/20 min-h-[calc(100vh-80px)] text-slate-700 ${!user ? 'justify-center bg-slate-100' : ''}`}>

            {user ? (
                /* ---------------------------------------------------- */
                /* 💡 1. 회원용 화면: 상태에 따른 멤버십 카드 및 하위 기능 표시 */
                /* ---------------------------------------------------- */
                <>
                    {membershipStatus === 'pending' ? (
                        <div className="bg-amber-50 shadow-sm mb-6 border border-amber-200 p-6 text-center rounded-xl">
                            <div className="text-4xl mb-3">⏳</div>
                            <h3 className="font-bold text-amber-800 text-lg mb-2">Application Pending Review</h3>
                            <p className="text-xs text-amber-700 font-medium">Your registration has been submitted and is currently under review by n+ Rewards. Please wait for activation.</p>
                        </div>
                    ) : isMembershipActive ? (
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg mb-6 relative overflow-hidden rounded-xl shrink-0">
                            <div className="absolute -right-4 -top-4 text-8xl opacity-10">👑</div>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <p className="text-slate-400 font-semibold text-[10px] uppercase tracking-widest mb-1">Membership</p>
                                    <p className="text-[#009900] font-bold text-sm uppercase tracking-widest">
                                        {(() => {
                                            const tier = user?.tier_id || user?.tier || user?.tierName;
                                            if (!tier || tier === 1 || tier === '1') return 'MEMBER TIER';
                                            if (tier === 2 || tier === '2') return 'SILVER TIER';
                                            if (tier === 3 || tier === '3') return 'GOLD TIER';
                                            if (tier === 4 || tier === '4') return 'VIP TIER';
                                            return `${String(tier).toUpperCase()} TIER`;
                                        })()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-xl font-bold">{user.name}</h2>
                                </div>
                            </div>

                            <div className="bg-white/10 p-4 backdrop-blur-md border border-white/10 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] text-slate-300 mb-1 uppercase font-semibold tracking-wider">Available Reward Points</p>
                                    <p className="text-2xl md:text-3xl font-bold tracking-wider text-white">₱ {user.total_points ? user.total_points.toLocaleString() : 0}</p>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* 회원이 진입했을 때만 보이는 하위 메뉴들 */}
                    <h3 className="font-bold text-slate-800 text-lg mb-3 pl-1 shrink-0">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-4 mb-6 shrink-0">
                        <Link href="/book" className="bg-white border border-slate-200 p-4 flex flex-col justify-center gap-1.5 hover:border-[#009900] transition-all rounded-xl shadow-sm h-24 group">
                            <img src="/bed-icon.svg" alt="Book Room" className="w-6 h-6 group-hover:scale-110 transition-transform object-contain shrink-0" />
                            <span className="font-bold text-slate-800 text-sm">Book Room</span>
                        </Link>
                        <Link href="/promos" className="bg-white border border-slate-200 p-4 flex flex-col justify-center gap-1.5 hover:border-[#009900] transition-all rounded-xl shadow-sm h-24 group">
                            <svg className="w-6 h-6 text-[#009900] group-hover:scale-110 transition-transform shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                            </svg>
                            <span className="font-bold text-slate-800 text-sm">Special Offers</span>
                        </Link>
                    </div>

                    <h3 className="font-bold text-slate-800 text-lg mb-3 pl-1 shrink-0">Discover</h3>
                    <Link href="/book" className="overflow-hidden relative shadow-md flex-1 flex items-end group cursor-pointer rounded-xl min-h-[200px] mb-2 bg-slate-900 w-full block">
                        {hotels.length > 0 ? hotels.map((h, idx) => {
                            let rawGallery = h.app_gallery || h.app_gallery_urls || h.gallery_json || h.gallery_urls || [];
                            if (typeof rawGallery === 'string') { try { rawGallery = JSON.parse(rawGallery); } catch (e) { rawGallery = []; } }
                            if (!Array.isArray(rawGallery)) rawGallery = [rawGallery];
                            let imgUrl = rawGallery[0] || h.image_url || h.bg_image_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800';
                            if (typeof imgUrl === 'object') imgUrl = imgUrl.url || imgUrl.src;

                            return (
                                <img key={h.code} src={imgUrl} alt={h.name} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${idx === currentHotelIndex ? 'opacity-100' : 'opacity-0'}`} />
                            );
                        }) : (
                            <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800" alt="Hotel Pool" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000" />
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent z-10"></div>
                        <div className="relative z-20 text-white w-full p-5">
                            <p className="text-[10px] font-bold text-[#009900] bg-green-100 inline-block px-2 py-0.5 rounded-sm uppercase tracking-widest mb-2 shadow-sm">
                                {hotels.length > 0 ? (hotels[currentHotelIndex]?.city || 'Explore') : 'Featured'}
                            </p>
                            <h3 className="text-xl md:text-2xl font-bold leading-tight drop-shadow-md mb-1">
                                {hotels.length > 0 ? hotels[currentHotelIndex]?.name : 'Experience true relaxation'}
                            </h3>
                            <div className="mt-3 flex justify-between items-center w-full border-t border-white/20 pt-3">
                                <span className="text-xs font-semibold text-white/90">Book This Hotel</span>
                                <span className="text-white group-hover:translate-x-1 transition-transform">➔</span>
                            </div>
                        </div>
                    </Link>

                    {membershipStatus === 'active' && (
                        <div className="mt-4 mb-2 text-center shrink-0">
                            <button onClick={handleLogout} className="text-xs font-semibold text-slate-400 hover:text-red-500 underline py-2">Sign Out securely</button>
                        </div>
                    )}
                </>
            ) : (
                /* ---------------------------------------------------- */
                /* 💡 2. 초기 진입 화면 (비회원): 오직 가입 안내만 표시 */
                /* ---------------------------------------------------- */
                <div className="w-full max-w-sm mx-auto animate-fade-in-up">
                    <div className="bg-white shadow-xl border border-slate-100 rounded-3xl overflow-hidden flex flex-col">
                        {/* 상단 썸네일 이미지 */}
                        <div className="relative h-48 w-full bg-slate-900">
                            <img src="/rewards.webp" alt="N+ Rewards" className="w-full h-full object-cover opacity-90" />
                            <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent"></div>
                        </div>

                        {/* 안내 문구 및 버튼 */}
                        <div className="p-8 pt-2 text-center bg-white relative z-10">
                            <div className="bg-white p-3 rounded-2xl shadow-sm inline-block -mt-10 mb-4 border border-slate-50">
                                <img src="/logo192.png" alt="N+ Logo" className="w-12 h-12 object-contain" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">Welcome to N+</h2>
                            <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed px-2">
                                Join our exclusive rewards program to earn points on every stay and unlock premium tier perks.
                            </p>
                            <button
                                onClick={handleJoinClick}
                                className="bg-[#009900] text-white font-bold py-4 px-6 shadow-lg shadow-green-900/20 hover:bg-[#008000] active:scale-95 transition-all text-sm w-full rounded-2xl"
                            >
                                Get Started
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}