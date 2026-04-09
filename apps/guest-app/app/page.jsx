'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // 💡 [NEW] 라우팅을 위한 훅 추가
import axios from 'axios';

export default function HomePage() {
    const router = useRouter(); // 💡 [NEW] 라우터 초기화
    const [user, setUser] = useState(null);
    const [isMembershipActive, setIsMembershipActive] = useState(false);

    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardStep, setOnboardStep] = useState(1);

    const [phone, setPhone] = useState('');
    const [idUploaded, setIdUploaded] = useState(false);
    const [cardName, setCardName] = useState('');
    const [cardNum, setCardNum] = useState('');
    const [cardExp, setCardExp] = useState('');
    const [cardCvv, setCardCvv] = useState('');

    const [hotels, setHotels] = useState([]);
    const [currentHotelIndex, setCurrentHotelIndex] = useState(0);

    // 💡 [NEW] PWA 설치 프롬프트 이벤트를 저장할 상태 추가
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        // 💡 [NEW] PWA 설치 가능 이벤트 리스너
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault(); // 기본 알림 억제
            setDeferredPrompt(e); // 이벤트 저장
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // 1. 빠른 렌더링을 위해 로컬 스토리지 데이터 먼저 세팅
        const savedUser = localStorage.getItem('nplus_guest_user');
        if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);
            if (parsedUser.is_membership_active) {
                setIsMembershipActive(true);
            }

            // 2. 백엔드에서 최신 데이터를 가져와 홈 화면 즉시 갱신 (캐시 방지 적용)
            axios.get(`https://api.hotelnplus.com/api/members/profile?email=${parsedUser.email}&t=${Date.now()}`, {
                headers: { 'Cache-Control': 'no-cache' }
            })
                .then(res => {
                    if (res.data && res.data.success && res.data.member) {
                        const freshUser = {
                            ...res.data.member,
                            name: `${res.data.member.first_name || ''} ${res.data.member.last_name || ''}`.trim() || 'Guest User'
                        };
                        localStorage.setItem('nplus_guest_user', JSON.stringify(freshUser));
                        setUser(freshUser);
                        setIsMembershipActive(freshUser.is_membership_active === 1 || freshUser.is_membership_active === true);
                    }
                })
                .catch(err => console.error("Home sync error:", err));
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
        window.location.reload();
    };

    const startOnboarding = () => {
        setShowOnboarding(true);
        setOnboardStep(1);
    };

    const nextStep = () => {
        if (onboardStep === 1 && !phone) return alert('Please enter your phone number.');
        if (onboardStep === 2 && !idUploaded) return alert('Please upload your ID card for verification.');
        if (onboardStep === 3 && (!cardName || !cardNum || !cardExp || !cardCvv)) return alert('Please enter all payment details.');

        if (onboardStep < 3) {
            setOnboardStep(onboardStep + 1);
        } else {
            completeOnboarding();
        }
    };

    const completeOnboarding = async () => {
        try {
            const response = await axios.post("https://api.hotelnplus.com/api/members/join-rewards", {
                email: user.email,
                phone: phone,
                first_name: user.first_name || '',
                last_name: user.last_name || '',
            });

            if (response.data && response.data.success) {
                const updatedUser = response.data.member;
                const finalUser = {
                    ...updatedUser,
                    name: `${updatedUser.first_name || ''} ${updatedUser.last_name || ''}`.trim() || 'Guest User',
                };

                localStorage.setItem('nplus_guest_user', JSON.stringify(finalUser));
                setUser(finalUser);
                setIsMembershipActive(true);
                setShowOnboarding(false);
                alert('Welcome to N+ Rewards! 1,000 Bonus Points have been added to your account.');
            } else {
                alert("Failed to join rewards: " + response.data.message);
            }
        } catch (error) {
            console.error("Join Error:", error);
            alert(error.response?.data?.message || "Server error occurred.");
        }
    };

    // 💡 [NEW] "Join Rewards" 버튼 클릭 시 PWA 로직 실행 후 이동
    const handleJoinClick = async () => {
        if (deferredPrompt) {
            // 안드로이드/데스크톱 등에서 설치 프롬프트 띄우기
            deferredPrompt.prompt();
            // 사용자의 선택(설치 완료 또는 취소) 대기
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`PWA Install Outcome: ${outcome}`);
            // 한 번 사용한 프롬프트는 무효화되므로 초기화
            setDeferredPrompt(null);
        } else {
            // 이미 설치되었거나 iOS 기기일 경우 프롬프트를 띄울 수 없으므로 무시하고 진행
            console.log("PWA prompt not available or already installed.");
        }

        // PWA 설치 여부와 상관없이 로그인 페이지로 이동
        router.push('/login');
    };

    if (showOnboarding) {
        return (
            <div className="fixed inset-0 bg-slate-50 z-[100] flex flex-col font-sans text-slate-700">
                <div className="bg-white p-4 border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm">
                    <button onClick={() => setShowOnboarding(false)} className="text-slate-400 font-bold text-xl px-2 hover:text-slate-600 transition-colors">✕</button>
                    <h2 className="font-bold text-slate-800 text-lg">Join Membership</h2>
                    <span className="text-[#009900] font-bold text-xs">Step {onboardStep} / 3</span>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col max-w-md mx-auto w-full pb-20">
                    <div className="flex gap-2 mb-8 shrink-0">
                        <div className={`h-1.5 flex-1 ${onboardStep >= 1 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
                        <div className={`h-1.5 flex-1 ${onboardStep >= 2 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
                        <div className={`h-1.5 flex-1 ${onboardStep >= 3 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
                    </div>

                    {onboardStep === 1 && (
                        <div className="animate-fade-in-up">
                            <h3 className="text-2xl font-bold text-slate-800 mb-2">Exclusive Benefits</h3>
                            <p className="text-slate-500 text-sm font-medium mb-6">Complete your profile to unlock our progressive reward tiers.</p>

                            <div className="bg-white border border-slate-200 p-5 shadow-sm mb-8 space-y-5">
                                <div className="flex items-start gap-3">
                                    <img src="/point.svg" alt="Points" className="w-7 h-7 object-contain shrink-0" />
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">Up to 10% Reward Points</p>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">Start with 2% back on all bookings as a Member, growing up to 10% as VIP.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <img src="/progressive.svg" alt="Progressive" className="w-7 h-7 object-contain shrink-0" />
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">Progressive Perks</p>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">Unlock 1-Hour Late Checkout (Silver) and Free Breakfast & Upgrades (Gold).</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <img src="/vip.svg" alt="VIP" className="w-7 h-7 object-contain shrink-0" />
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">VIP Experience</p>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">Reach VIP tier for exclusive Lounge Access and complimentary Mini-bar.</p>
                                    </div>
                                </div>
                            </div>

                            <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Phone Number</label>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="09" className="w-full p-4 border border-slate-300 text-sm font-semibold text-slate-800 focus:border-[#009900] outline-none shadow-sm rounded-none" />
                        </div>
                    )}

                    {onboardStep === 2 && (
                        <div className="animate-fade-in-up">
                            <h3 className="text-2xl font-bold text-slate-800 mb-2">Identity Verification</h3>
                            <p className="text-slate-500 text-sm font-medium mb-6">Please upload a valid ID for security and age verification.</p>

                            <div className="border-2 border-dashed border-slate-300 bg-white p-8 text-center relative hover:border-[#009900] transition-colors cursor-pointer group">
                                <input type="file" accept="image/*" onChange={(e) => { if (e.target.files.length > 0) setIdUploaded(true) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">🪪</div>
                                {idUploaded ? (
                                    <p className="text-[#009900] font-bold text-lg">ID Uploaded Successfully ✓</p>
                                ) : (
                                    <>
                                        <p className="font-bold text-slate-800 text-lg mb-1">Tap to Upload ID</p>
                                        <p className="text-xs font-medium text-slate-400">Passport, Driver's License, or National ID</p>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {onboardStep === 3 && (
                        <div className="animate-fade-in-up">
                            <h3 className="text-2xl font-bold text-slate-800 mb-2">Link Payment Method</h3>
                            <p className="text-slate-500 text-sm font-medium mb-6">Register a credit card to secure future bookings and prevent no-shows. No charges will be made now.</p>

                            <div className="bg-white p-5 border border-slate-200 shadow-sm space-y-4">
                                <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Name on Card</label>
                                    <input type="text" name="cardName" autoComplete="cc-name" value={cardName} onChange={e => setCardName(e.target.value)} placeholder="John Doe" className="w-full p-4 border border-slate-300 text-sm font-semibold text-slate-800 focus:border-[#009900] outline-none shadow-sm rounded-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Card Number</label>
                                    <input type="text" name="cardNumber" autoComplete="cc-number" value={cardNum} onChange={e => setCardNum(e.target.value)} placeholder="0000 0000 0000 0000" className="w-full p-4 border border-slate-300 text-sm font-semibold text-slate-800 focus:border-[#009900] outline-none shadow-sm rounded-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 pt-4">
                        <button onClick={nextStep} className="w-full bg-[#009900] hover:bg-[#008000] text-white py-4 font-bold text-base shadow-lg transition-transform active:scale-95 rounded-none">
                            {onboardStep === 3 ? 'Complete Registration ✓' : 'Next Step ➔'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 flex flex-col font-sans selection:bg-[#009900]/20 min-h-[calc(100vh-80px)] text-slate-700">
            {user ? (
                isMembershipActive ? (
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg mb-6 relative overflow-hidden rounded-none shrink-0">
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
                                <h2 className="text-xl font-bold">
                                    {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.name}
                                </h2>
                            </div>
                        </div>

                        <div className="bg-white/10 p-4 backdrop-blur-md border border-white/10 rounded-none flex justify-between items-center">
                            <div>
                                <p className="text-[10px] text-slate-300 mb-1 uppercase font-semibold tracking-wider">Available Reward Points</p>
                                <p className="text-2xl md:text-3xl font-bold tracking-wider text-white">₱ {user.total_points ? user.total_points.toLocaleString() : 0}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white shadow-sm mb-6 border border-slate-200 rounded-none flex flex-col shrink-0 overflow-hidden relative">
                        <img src="/rewards.webp" alt="N+ Rewards" className="w-full h-auto block" />
                        <button
                            onClick={startOnboarding}
                            className="bg-[#009900] text-white font-semibold px-5 py-2 shadow-lg hover:bg-[#008000] transition-colors rounded-none absolute bottom-4 right-4 z-10 text-xs"
                        >
                            Join Now ➔
                        </button>
                    </div>
                )
            ) : (
                <div className="bg-white shadow-sm mb-6 border border-slate-200 rounded-none flex flex-col shrink-0 overflow-hidden">
                    <img src="/rewards.webp" alt="N+ Rewards" className="w-full h-auto block" />
                    <div className="p-6 pt-5 text-center bg-white">
                        {/* 💡 [NEW] 요청하신 대로 문구 변경 */}
                        <p className="text-sm font-medium text-slate-600 mb-5 leading-relaxed">
                            Join now to earn points on every stay and unlock exclusive tier perks.
                        </p>
                        {/* 💡 [NEW] Link 태그를 button으로 변경하고 onClick 핸들러 연결, 버튼명 변경 */}
                        <button
                            onClick={handleJoinClick}
                            className="inline-block bg-[#009900] text-white font-bold px-10 py-3 shadow-md hover:bg-[#008000] transition-colors text-sm w-full sm:w-auto rounded-none"
                        >
                            Join Rewards
                        </button>
                    </div>
                </div>
            )}

            <h3 className="font-bold text-slate-800 text-lg mb-3 pl-1 shrink-0">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4 mb-6 shrink-0">
                <Link href="/book" className="bg-white border border-slate-200 p-4 flex flex-col justify-center gap-1.5 hover:border-[#009900] transition-all rounded-none shadow-sm h-24 group">
                    <img src="/bed-icon.svg" alt="Book Room" className="w-6 h-6 group-hover:scale-110 transition-transform object-contain shrink-0" />
                    <span className="font-bold text-slate-800 text-sm">Book Room</span>
                </Link>
                <Link href="/promos" className="bg-white border border-slate-200 p-4 flex flex-col justify-center gap-1.5 hover:border-[#009900] transition-all rounded-none shadow-sm h-24 group">
                    <svg className="w-6 h-6 text-[#009900] group-hover:scale-110 transition-transform shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                    </svg>
                    <span className="font-bold text-slate-800 text-sm">Special Offers</span>
                </Link>
            </div>

            <h3 className="font-bold text-slate-800 text-lg mb-3 pl-1 shrink-0">Discover</h3>

            <Link href="/book" className="overflow-hidden relative shadow-md flex-1 flex items-end group cursor-pointer rounded-none min-h-[200px] mb-2 bg-slate-900 w-full block">
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
                    <p className="text-[10px] font-bold text-[#009900] bg-green-100 inline-block px-2 py-0.5 rounded-none uppercase tracking-widest mb-2 shadow-sm">
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

            {user && (
                <div className="mt-4 mb-2 text-center shrink-0">
                    <button onClick={handleLogout} className="text-xs font-semibold text-slate-400 hover:text-red-500 underline py-2">Sign Out securely</button>
                </div>
            )}
        </div>
    );
}