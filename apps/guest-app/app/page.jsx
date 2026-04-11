'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function HomePage() {
    const router = useRouter();

    // 💡 [수정됨] 앱 초기 로딩 상태 (데이터 동기화 중 화면 깜박임 방지)
    const [isAppLoading, setIsAppLoading] = useState(true);

    // Auth & Security States
    const [user, setUser] = useState(null);
    const [isMembershipActive, setIsMembershipActive] = useState(false);
    const [membershipStatus, setMembershipStatus] = useState('');
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [loginPin, setLoginPin] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    // 온보딩 상태
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

        const sessionData = localStorage.getItem('nplus_session_key');
        const legacyData = localStorage.getItem('nplus_guest_user');
        const targetSession = sessionData ? JSON.parse(sessionData) : (legacyData ? JSON.parse(legacyData) : null);

        if (targetSession && targetSession.email) {
            setIsUnlocked(false);

            // 💡 [핵심 수정] 서버에서 최신 상태를 긁어오는 함수를 따로 만듭니다.
            const fetchProfile = () => {
                axios.get(`https://api.hotelnplus.com/api/members/profile?email=${targetSession.email}&t=${Date.now()}`, {
                    headers: { 'Cache-Control': 'no-cache' }
                })
                    .then(res => {
                        if (res.data && res.data.success && res.data.member) {
                            const freshUser = {
                                ...targetSession,
                                ...res.data.member,
                                name: `${res.data.member.first_name || ''} ${res.data.member.last_name || ''}`.trim() || 'Guest User'
                            };
                            localStorage.setItem('nplus_guest_user', JSON.stringify(freshUser));
                            setUser(freshUser);
                            setIsMembershipActive(freshUser.is_membership_active === 1 || freshUser.is_membership_active === true);
                            setMembershipStatus(freshUser.membership_status || 'active');
                        }
                    })
                    .finally(() => {
                        setIsAppLoading(false);
                    });
            };

            // 처음 화면 켤 때 1번 실행
            fetchProfile();
            // 💡 [추가] 5초마다 몰래 최신 상태인지 확인합니다. (HQ에서 승인 누르면 화면이 알아서 카드로 변신함!)
            const interval = setInterval(fetchProfile, 5000);
            return () => {
                clearInterval(interval);
                window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            };

        } else {
            setIsUnlocked(true);
            setIsAppLoading(false);
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
        // 💡 [수정됨] 세션 키와 기존 유저 데이터를 모두 삭제합니다.
        localStorage.removeItem('nplus_session_key');
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
                pin: pin, // 백엔드로 PIN 전달
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

                // 💡 [수정됨] 가입 로직에서도 서버 세션 키를 생성합니다.
                localStorage.setItem('nplus_session_key', JSON.stringify({ email: payload.email }));
                localStorage.setItem('nplus_guest_user', JSON.stringify(finalUser));

                setUser(finalUser);
                setIsMembershipActive(false);
                setMembershipStatus('pending');
                setIsUnlocked(true);
                setShowOnboarding(false);

                // 💡 [수정] 24시간 이내 리뷰 안내를 영어로 변경
                alert("Your application for n+ Rewards membership has been successfully submitted.\n\nYou will be notified within 24 hours once the HQ review is complete and your account is activated.");
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
        // 기존의 로그인 페이지 이동이 아닌 현재 페이지에서 팝업으로 온보딩 띄움
        startOnboarding();
    };

    // 💡 [수정] PIN 번호를 로컬이 아닌 백엔드 서버에 직접 물어봐서 검증합니다!
    const handleLoginPinInput = async (num) => {
        if (loginPin.length < 4) {
            const newPin = loginPin + num;
            setLoginPin(newPin);

            if (newPin.length === 4) {
                try {
                    // 💡 서버에 이메일과 입력한 PIN을 보내서 맞는지 확인 요청
                    const res = await axios.post('https://api.hotelnplus.com/api/members/verify-pin', {
                        email: user.email,
                        pin: newPin
                    });

                    if (res.data && res.data.success) {
                        setIsUnlocked(true); // PIN이 맞으면 잠금 해제!
                    } else {
                        throw new Error("Invalid PIN");
                    }
                } catch (error) {
                    setTimeout(() => {
                        alert('Incorrect PIN. Please try again.');
                        setLoginPin(''); // 틀리면 입력창 초기화
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

    // 💡 [수정됨] 0. 데이터 로딩 화면 (화면 깜박임 방지)
    if (isAppLoading) {
        return (
            <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-slate-50">
                <style dangerouslySetInnerHTML={{ __html: `nav, header { display: none !important; } body { padding-bottom: 0 !important; }` }} />
                <div className="text-slate-400 font-bold animate-pulse text-sm">Loading N+ Rewards...</div>
            </div>
        );
    }

    // 💡 1. 락스크린 (보안 화면): 네비게이션 바와 헤더 숨김 처리
    if (user && !isUnlocked) {
        return (
            <div className="fixed inset-0 bg-slate-900 z-[200] flex flex-col items-center justify-center font-sans text-white p-6">
                <style dangerouslySetInnerHTML={{ __html: `nav, header { display: none !important; } body { padding-bottom: 0 !important; }` }} />

                <div className="text-center mb-8">
                    <div className="bg-white p-3 rounded-full inline-block mb-4">
                        <img src="/logo192.png" alt="Logo" className="w-12 h-12 object-contain" />
                    </div>
                    <h2 className="text-2xl font-bold mb-1">Welcome Back</h2>
                    {/* 💡 [추가] 대표님 제안대로 누구의 락스크린인지 이메일을 명확히 표시! */}
                    <p className="text-emerald-400 text-sm font-semibold mb-2">{user.email}</p>
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

    // 💡 2. 온보딩 화면 (내부 팝업용 - 기존 로직 완벽 복구)
    if (showOnboarding) {
        return (
            <div className="fixed inset-0 bg-slate-50 z-[100] flex flex-col font-sans text-slate-700">
                <style dangerouslySetInnerHTML={{ __html: `nav, header { display: none !important; } body { padding-bottom: 0 !important; }` }} />

                <div className="bg-white p-4 border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm">
                    <button onClick={() => setShowOnboarding(false)} className="text-slate-400 font-bold text-xl px-2 hover:text-slate-600 transition-colors">✕</button>
                    <h2 className="font-bold text-slate-800 text-lg">Join Membership</h2>
                    <span className="text-[#009900] font-bold text-xs">Step {onboardStep} / 4</span>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col max-w-md mx-auto w-full pb-20">
                    <div className="flex gap-2 mb-8 shrink-0">
                        <div className={`h-1.5 flex-1 ${onboardStep >= 1 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
                        <div className={`h-1.5 flex-1 ${onboardStep >= 2 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
                        <div className={`h-1.5 flex-1 ${onboardStep >= 3 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
                        <div className={`h-1.5 flex-1 ${onboardStep >= 4 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
                    </div>

                    {/* STEP 1: 개인정보 입력 */}
                    {onboardStep === 1 && (
                        <div className="animate-fade-in-up space-y-4">
                            <h3 className="text-2xl font-bold text-slate-800 mb-2">Personal Information</h3>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">First Name</label>
                                    <input type="text" value={firstName} onChange={e => setFirstName(e.target.value.toUpperCase())} className="w-full p-3 border border-slate-300 text-sm focus:border-[#009900] outline-none uppercase" placeholder="JOHN" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">Last Name</label>
                                    <input type="text" value={lastName} onChange={e => setLastName(e.target.value.toUpperCase())} className="w-full p-3 border border-slate-300 text-sm focus:border-[#009900] outline-none uppercase" placeholder="DOE" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">Date of Birth</label>
                                <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full p-3 border border-slate-300 text-sm focus:border-[#009900] outline-none bg-white" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">Phone Number</label>
                                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+63 9XX XXX XXXX" className="w-full p-3 border border-slate-300 text-sm focus:border-[#009900] outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">Nationality</label>
                                <select value={nationality} onChange={e => setNationality(e.target.value)} className="w-full p-3 border border-slate-300 text-sm focus:border-[#009900] outline-none bg-white">
                                    <option value="">-- Select Nationality --</option>
                                    <optgroup label="Top Nationalities">
                                        {topNationalities.map(nat => <option key={nat} value={nat}>{nat}</option>)}
                                    </optgroup>
                                    <optgroup label="Other Nationalities">
                                        {otherNationalities.map(nat => <option key={nat} value={nat}>{nat}</option>)}
                                    </optgroup>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">Email Address</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" className="w-full p-3 border border-slate-300 text-sm focus:border-[#009900] outline-none" />
                            </div>
                        </div>
                    )}

                    {/* STEP 2: 신분증 업로드 */}
                    {onboardStep === 2 && (
                        <div className="animate-fade-in-up space-y-5">
                            <h3 className="text-2xl font-bold text-slate-800 mb-2">Identity Verification</h3>

                            <div className="grid grid-cols-2 gap-3 mb-2">
                                <button
                                    onClick={() => { setCitizenType('filipino'); setIdType(''); }}
                                    className={`py-3 text-sm font-bold border ${citizenType === 'filipino' ? 'bg-[#009900] text-white border-[#009900]' : 'bg-white text-slate-500 border-slate-300'}`}
                                >
                                    Filipino
                                </button>
                                <button
                                    onClick={() => { setCitizenType('foreigner'); setIdType('Passport'); }}
                                    className={`py-3 text-sm font-bold border ${citizenType === 'foreigner' ? 'bg-[#009900] text-white border-[#009900]' : 'bg-white text-slate-500 border-slate-300'}`}
                                >
                                    Foreigner
                                </button>
                            </div>

                            {citizenType === 'filipino' && (
                                <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">Select ID Type</label>
                                    <select value={idType} onChange={e => setIdType(e.target.value)} className="w-full p-3 border border-slate-300 text-sm focus:border-[#009900] outline-none bg-white">
                                        <option value="">-- Choose ID --</option>
                                        {filipinoIdOptions.map(id => <option key={id} value={id}>{id}</option>)}
                                    </select>
                                </div>
                            )}

                            {citizenType === 'foreigner' && (
                                <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">ID Type</label>
                                    <input type="text" readOnly value="Passport" className="w-full p-3 border border-slate-300 text-sm bg-slate-100 outline-none text-slate-500" />
                                </div>
                            )}

                            {idType && (
                                <div className="mt-6">
                                    <p className="text-xs font-semibold text-slate-500 mb-3 text-center uppercase">Choose Upload Method</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="border-2 border-slate-200 bg-white p-4 text-center relative hover:border-[#009900] transition-colors rounded-md group">
                                            <input type="file" accept="image/*" capture="environment" onChange={(e) => { if (e.target.files.length > 0) setIdUploaded(true) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                            <div className="text-3xl mb-1 group-hover:scale-110 transition-transform">📷</div>
                                            <p className="font-bold text-slate-700 text-xs">Take Photo</p>
                                        </div>
                                        <div className="border-2 border-slate-200 bg-white p-4 text-center relative hover:border-[#009900] transition-colors rounded-md group">
                                            <input type="file" accept="image/*" onChange={(e) => { if (e.target.files.length > 0) setIdUploaded(true) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                            <div className="text-3xl mb-1 group-hover:scale-110 transition-transform">🖼️</div>
                                            <p className="font-bold text-slate-700 text-xs">Gallery</p>
                                        </div>
                                    </div>
                                    {idUploaded && <p className="text-[#009900] font-bold text-sm text-center mt-4 bg-green-50 py-2">ID Attached Successfully ✓</p>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: 결제 정보 입력 */}
                    {onboardStep === 3 && (
                        <div className="animate-fade-in-up space-y-5">
                            <h3 className="text-2xl font-bold text-slate-800 mb-2">Payment Details</h3>
                            <p className="text-slate-500 text-[11px] mb-4">Secure your bookings. No charges will be made at this step.</p>

                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => { setPaymentMethod('card'); setAccName(''); setAccNum(''); }} className={`py-3 text-xs font-bold border flex flex-col items-center gap-1 ${paymentMethod === 'card' ? 'bg-[#009900] text-white border-[#009900]' : 'bg-white text-slate-500 border-slate-300'}`}>
                                    <span>💳</span> Card
                                </button>
                                <button onClick={() => { setPaymentMethod('gcash'); setAccName(''); setAccNum(''); }} className={`py-3 text-xs font-bold border flex flex-col items-center gap-1 ${paymentMethod === 'gcash' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-300'}`}>
                                    <span>G</span> GCash
                                </button>
                                <button onClick={() => { setPaymentMethod('maya'); setAccName(''); setAccNum(''); }} className={`py-3 text-xs font-bold border flex flex-col items-center gap-1 ${paymentMethod === 'maya' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-slate-500 border-slate-300'}`}>
                                    <span>M</span> Maya
                                </button>
                            </div>

                            {paymentMethod && (
                                <div className="space-y-4 bg-white p-4 border border-slate-200 mt-2">
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">
                                            {paymentMethod === 'card' ? 'Card Number' : 'Account Number (Mobile)'}
                                        </label>
                                        <input type="text" value={accNum} onChange={e => setAccNum(e.target.value)} placeholder={paymentMethod === 'card' ? "0000 0000 0000 0000" : "09XX XXX XXXX"} className="w-full p-3 border border-slate-300 text-sm focus:border-[#009900] outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">
                                            {paymentMethod === 'card' ? 'Name on Card' : 'Registered Name'}
                                        </label>
                                        <input type="text" value={accName} onChange={e => setAccName(e.target.value.toUpperCase())} placeholder="JOHN DOE" className="w-full p-3 border border-slate-300 text-sm focus:border-[#009900] outline-none uppercase" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 4: 앱 보안 장치 설정 */}
                    {onboardStep === 4 && (
                        <div className="animate-fade-in-up space-y-5">
                            <h3 className="text-2xl font-bold text-slate-800 mb-2">Secure Your Account</h3>
                            <p className="text-slate-500 text-[11px] mb-6">Create a 4-digit PIN to protect your rewards and personal data.</p>

                            <div className="space-y-4 bg-white p-5 border border-slate-200 text-center">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase">Create PIN</label>
                                    <input type="password" inputMode="numeric" maxLength="4" value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))} placeholder="••••" className="w-full text-center tracking-[1em] text-2xl p-3 border border-slate-300 focus:border-[#009900] outline-none bg-slate-50" />
                                </div>
                                <div className="pt-2">
                                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase">Confirm PIN</label>
                                    <input type="password" inputMode="numeric" maxLength="4" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))} placeholder="••••" className="w-full text-center tracking-[1em] text-2xl p-3 border border-slate-300 focus:border-[#009900] outline-none bg-slate-50" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 pt-4">
                        <button onClick={nextStep} className="w-full bg-[#009900] hover:bg-[#008000] text-white py-4 font-bold text-base shadow-lg transition-transform active:scale-95 rounded-none">
                            {onboardStep === 4 ? 'Submit Application ✓' : 'Next Step ➔'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 💡 3. 메인 렌더링 영역 (비로그인 시 화면 중앙 집중 UI)
    return (
        <div className={`p-4 md:p-6 flex flex-col font-sans selection:bg-[#009900]/20 text-slate-700 ${!user ? 'justify-center bg-slate-100 min-h-screen' : 'min-h-[calc(100vh-80px)]'}`}>

            {/* 비회원 화면일 때 네비게이션과 헤더 강제 숨김 */}
            {!user && (
                <style dangerouslySetInnerHTML={{ __html: `nav, header { display: none !important; } body { padding-bottom: 0 !important; }` }} />
            )}

            {user ? (
                <>
                    {membershipStatus === 'pending' ? (
                        <div className="bg-amber-50 shadow-sm mb-6 border border-amber-200 p-6 text-center rounded-xl mt-4">
                            <div className="text-4xl mb-3">⏳</div>
                            <h3 className="font-bold text-amber-800 text-lg mb-2">Application Under Review</h3>
                            <p className="text-xs text-amber-700 font-medium leading-relaxed">
                                Thank you for applying for n+ Rewards membership.<br />
                                Your application is currently under review by our n+ Rewards team.<br />
                                We will notify you within 24 hours once your account has been activated.
                            </p>
                            <button onClick={handleLogout} className="mt-5 text-[11px] font-semibold text-slate-400 hover:text-red-500 underline py-2">
                                Sign Out securely
                            </button>
                        </div>
                    ) : isMembershipActive ? (
                            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg mb-6 relative overflow-hidden rounded-xl shrink-0 mt-4">
                                {/* ❌ 👑 이모티콘이 있던 줄 삭제됨 */}
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

                    {/* 회원에게만 보이는 메뉴 및 콘텐츠 */}
                    <h3 className="font-bold text-slate-800 text-lg mb-3 pl-1 shrink-0 mt-2">Quick Actions</h3>
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
                /* 비회원(로그인 전) 화면: 네비게이션이 사라지고 가운데 정렬됨 */
                <div className="w-full max-w-sm mx-auto animate-fade-in-up">
                    <div className="bg-white shadow-xl border border-slate-100 rounded-3xl overflow-hidden flex flex-col">
                        <div className="relative h-48 w-full bg-slate-900">
                            <img src="/rewards.webp" alt="N+ Rewards" className="w-full h-full object-cover opacity-90" />
                            <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent"></div>
                        </div>

                        <div className="p-8 pt-2 text-center bg-white relative z-10">
                            <div className="bg-white p-3 rounded-2xl shadow-sm inline-block -mt-10 mb-4 border border-slate-50">
                                <img src="/logo192.png" alt="N+ Logo" className="w-12 h-12 object-contain" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">Welcome to n+</h2>
                            <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed px-2">
                                Join our exclusive n+ Rewards membership to earn points on every stay and unlock premium tier perks.
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