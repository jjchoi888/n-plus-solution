'use client';

// 💡 1. Suspense를 추가로 불러옵니다.
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';

const TOP_COUNTRIES = ["Philippines", "South Korea", "China", "United States"];
const ALL_COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Argentina", "Australia", "Canada",
    "France", "Germany", "India", "Indonesia", "Japan", "Malaysia", "Singapore",
    "Taiwan", "Thailand", "United Kingdom", "Vietnam"
];

const FILIPINO_IDS = [
    "PhilSys ID", "Passport", "Driver's License",
    "PRC ID", "SSS/GSIS ID", "PhilHealth ID", "Voter's ID"
];

// 💡 2. 기존의 메인 함수 이름을 GuestLoginContent로 살짝 바꿉니다.
function GuestLoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [isCheckingDevice, setIsCheckingDevice] = useState(true);
    const [onboardStep, setOnboardStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [dob, setDob] = useState('');
    const [phone, setPhone] = useState('');
    const [nationality, setNationality] = useState('');

    const [citizenType, setCitizenType] = useState('');
    const [idType, setIdType] = useState('');
    const [idUploaded, setIdUploaded] = useState("");

    const [paymentMethod, setPaymentMethod] = useState('');
    const [accNum, setAccNum] = useState('');
    const [accName, setAccName] = useState('');

    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');

    useEffect(() => {
        const stepParam = searchParams.get('step');
        if (stepParam) {
            const stepNum = parseInt(stepParam, 10);
            if (stepNum >= 1 && stepNum <= 4) {
                setOnboardStep(stepNum);
            }
        }
    }, [searchParams]);

    useEffect(() => {
        const sessionKey = localStorage.getItem('nplus_session_key');
        if (sessionKey) {
            try {
                const parsed = JSON.parse(sessionKey);
                if (parsed.email) setEmail(parsed.email);

                const fullUser = localStorage.getItem('nplus_guest_user');
                if (fullUser) {
                    router.replace('/');
                    return;
                }
            } catch (e) { }
        }
        setIsCheckingDevice(false);
    }, [router]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                setIdUploaded(compressedBase64);
            };
        };
    };

    const nextStep = () => {
        if (onboardStep === 1) {
            if (!email || !firstName || !lastName || !dob || !phone || !nationality) {
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
            if (!accNum || !accName) return alert('Please fill in your payment details.');
        }

        setOnboardStep(onboardStep + 1);
    };

    const handleSubmit = async () => {
        if (pin.length !== 4) return alert("Please enter a 4-digit PIN.");
        if (pin !== confirmPin) return alert("The PIN numbers do not match.");

        setIsLoading(true);

        try {
            const payload = {
                email, first_name: firstName, last_name: lastName, phone, nationality, dob,
                citizen_type: citizenType, id_type: idType,
                document_url: idUploaded,
                payment_method: paymentMethod, payment_acc_name: accName, payment_acc_num: accNum,
                pin, membership_status: 'pending'
            };

            const response = await axios.post('https://api.hotelnplus.com/api/members/auth', payload);

            if (response.data && response.data.success) {
                const finalUser = response.data.member || {
                    ...payload, name: `${firstName} ${lastName}`.trim(), is_membership_active: false, tierName: 'MEMBER', total_points: 0
                };
                finalUser.membership_status = 'pending';

                localStorage.setItem('nplus_guest_user', JSON.stringify(finalUser));
                localStorage.setItem('nplus_session_key', JSON.stringify({ email }));
                localStorage.setItem('guest_pin', pin);

                alert("Your application for n+ Rewards membership has been successfully submitted.\n\nYou will be notified within 24 hours once the HQ review is complete and your account is activated.");
                window.location.href = '/';
            } else {
                alert(response.data.message || "Registration failed. Please try again.");
            }
        } catch (error) {
            console.error("Join Error:", error);
            alert("Error connecting to server. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isCheckingDevice) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <style dangerouslySetInnerHTML={{ __html: `nav, header { display: none !important; } body { padding-bottom: 0 !important; }` }} />
                <div className="text-slate-500 font-bold">Checking device status...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col justify-center selection:bg-[#009900]/20 font-sans bg-slate-50 p-4 md:p-6">
            <style dangerouslySetInnerHTML={{ __html: `nav, header { display: none !important; } body { padding-bottom: 0 !important; }` }} />

            <div className="bg-white p-6 shadow-xl border border-slate-100 rounded-2xl w-full max-w-md mx-auto flex flex-col min-h-[600px] animate-fade-in-up">

                <div className="text-center mb-6 shrink-0">
                    <div className="flex items-center gap-2 mb-3 justify-center">
                        <img src="/logo192.png" alt="N+ Logo" className="h-8 w-auto object-contain" />
                        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Rewards</h2>
                    </div>
                    <p className="text-sm font-bold text-slate-500 mt-2 leading-relaxed">
                        n+ Rewards membership<br />
                        <span className="text-xs font-medium">Sign up to earn points and auto-fill your bookings.</span>
                    </p>

                    <div className="flex gap-2 mt-6">
                        <div className={`h-1.5 flex-1 rounded-full ${onboardStep >= 1 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
                        <div className={`h-1.5 flex-1 rounded-full ${onboardStep >= 2 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
                        <div className={`h-1.5 flex-1 rounded-full ${onboardStep >= 3 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
                        <div className={`h-1.5 flex-1 rounded-full ${onboardStep >= 4 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden px-1">
                    {onboardStep === 1 && (
                        <div className="space-y-4 animate-fade-in">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Email Address</label>
                                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                    className="w-full p-3.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-inner bg-slate-50"
                                    placeholder="name@email.com" />
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">First Name</label>
                                    <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value.toUpperCase())}
                                        className="w-full p-3.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-inner bg-slate-50 uppercase" placeholder="JOHN" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Last Name</label>
                                    <input type="text" required value={lastName} onChange={e => setLastName(e.target.value.toUpperCase())}
                                        className="w-full p-3.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-inner bg-slate-50 uppercase" placeholder="DOE" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Date of Birth</label>
                                <input type="date" required value={dob} onChange={e => setDob(e.target.value)}
                                    className="w-full p-3.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-inner bg-slate-50" />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Phone Number</label>
                                <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)}
                                    className="w-full p-3.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-inner bg-slate-50" placeholder="09XX XXX XXXX" />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Nationality</label>
                                <select required value={nationality} onChange={e => setNationality(e.target.value)}
                                    className="w-full p-3.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-[#009900] outline-none shadow-inner cursor-pointer bg-slate-50">
                                    <option value="" disabled>Select Country...</option>
                                    <optgroup label="Top Nationalities">
                                        {TOP_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </optgroup>
                                    <optgroup label="Other Nationalities">
                                        {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </optgroup>
                                </select>
                            </div>
                        </div>
                    )}

                    {onboardStep === 2 && (
                        <div className="space-y-5 animate-fade-in">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Identity Verification</label>

                            <div className="grid grid-cols-2 gap-3 mb-2">
                                <button onClick={() => { setCitizenType('filipino'); setIdType(''); setIdUploaded(""); }}
                                    className={`py-3.5 text-sm font-bold rounded-xl border-2 transition-colors ${citizenType === 'filipino' ? 'bg-[#009900] text-white border-[#009900]' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                                    Filipino
                                </button>
                                <button onClick={() => { setCitizenType('foreigner'); setIdType('Passport'); setIdUploaded(""); }}
                                    className={`py-3.5 text-sm font-bold rounded-xl border-2 transition-colors ${citizenType === 'foreigner' ? 'bg-[#009900] text-white border-[#009900]' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                                    Foreigner
                                </button>
                            </div>

                            {citizenType === 'filipino' && (
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Select ID Type</label>
                                    <select value={idType} onChange={e => setIdType(e.target.value)} className="w-full p-3.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-[#009900] outline-none bg-slate-50">
                                        <option value="">-- Choose ID --</option>
                                        {FILIPINO_IDS.map(id => <option key={id} value={id}>{id}</option>)}
                                    </select>
                                </div>
                            )}

                            {citizenType === 'foreigner' && (
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">ID Type</label>
                                    <input type="text" readOnly value="Passport" className="w-full p-3.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 outline-none" />
                                </div>
                            )}

                            {idType && (
                                <div className="mt-4 pt-2">
                                    <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Upload Method</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="border-2 border-slate-200 bg-slate-50 p-4 text-center relative hover:border-[#009900] transition-colors rounded-xl overflow-hidden group">
                                            <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                                            <div className="text-3xl mb-1 group-hover:scale-110 transition-transform relative z-10 pointer-events-none">📷</div>
                                            <p className="font-bold text-slate-700 text-xs relative z-10 pointer-events-none">Take Photo</p>
                                        </div>
                                        <div className="border-2 border-slate-200 bg-slate-50 p-4 text-center relative hover:border-[#009900] transition-colors rounded-xl overflow-hidden group">
                                            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                                            <div className="text-3xl mb-1 group-hover:scale-110 transition-transform relative z-10 pointer-events-none">🖼️</div>
                                            <p className="font-bold text-slate-700 text-xs relative z-10 pointer-events-none">Gallery</p>
                                        </div>
                                    </div>
                                    {idUploaded && <p className="text-[#009900] font-bold text-sm text-center mt-4 bg-green-50 py-3 rounded-lg border border-green-100">ID Image Attached ✓</p>}
                                </div>
                            )}
                        </div>
                    )}

                    {onboardStep === 3 && (
                        <div className="space-y-5 animate-fade-in">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Payment Details</label>

                            <div className="grid grid-cols-3 gap-2 mb-2">
                                <button onClick={() => { setPaymentMethod('card'); setAccName(''); setAccNum(''); }} className={`py-3.5 text-xs font-bold rounded-xl border-2 flex flex-col items-center gap-1 transition-colors ${paymentMethod === 'card' ? 'bg-[#009900] text-white border-[#009900]' : 'bg-white text-slate-500 border-slate-200'}`}>
                                    <span className="text-xl">💳</span> Card
                                </button>
                                <button onClick={() => { setPaymentMethod('gcash'); setAccName(''); setAccNum(''); }} className={`py-3.5 text-xs font-bold rounded-xl border-2 flex flex-col items-center gap-1 transition-colors ${paymentMethod === 'gcash' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                                    <span className="text-xl font-serif">G</span> GCash
                                </button>
                                <button onClick={() => { setPaymentMethod('maya'); setAccName(''); setAccNum(''); }} className={`py-3.5 text-xs font-bold rounded-xl border-2 flex flex-col items-center gap-1 transition-colors ${paymentMethod === 'maya' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-slate-500 border-slate-200'}`}>
                                    <span className="text-xl font-serif">M</span> Maya
                                </button>
                            </div>

                            {paymentMethod && (
                                <div className="space-y-4 pt-2">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                                            {paymentMethod === 'card' ? 'Card Number' : 'Account Number'}
                                        </label>
                                        <input type="text" value={accNum} onChange={e => setAccNum(e.target.value)} placeholder={paymentMethod === 'card' ? "0000 0000 0000 0000" : "09XX XXX XXXX"} className="w-full p-3.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-[#009900] outline-none bg-slate-50" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                                            {paymentMethod === 'card' ? 'Name on Card' : 'Account Name'}
                                        </label>
                                        <input type="text" value={accName} onChange={e => setAccName(e.target.value.toUpperCase())} placeholder="JOHN DOE" className="w-full p-3.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-[#009900] outline-none bg-slate-50 uppercase" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {onboardStep === 4 && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="text-center mb-4">
                                <h3 className="text-xl font-bold text-slate-800">Secure Your Account</h3>
                                <p className="text-xs font-medium text-slate-500 mt-1">Create a 4-digit PIN</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Create PIN</label>
                                    <input type="password" required value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))} maxLength="4" inputMode="numeric"
                                        className="w-full p-4 border border-slate-200 rounded-xl text-2xl tracking-[1em] text-center font-bold text-slate-800 focus:border-[#009900] outline-none shadow-inner bg-slate-50" placeholder="••••" />
                                </div>
                                <div className="pt-2">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Confirm PIN</label>
                                    <input type="password" required value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))} maxLength="4" inputMode="numeric"
                                        className="w-full p-4 border border-slate-200 rounded-xl text-2xl tracking-[1em] text-center font-bold text-slate-800 focus:border-[#009900] outline-none shadow-inner bg-slate-50" placeholder="••••" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-6 shrink-0 border-t border-slate-100 mt-4">
                    {onboardStep < 4 ? (
                        <button onClick={nextStep}
                            className="w-full bg-[#009900] hover:bg-[#008000] text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-green-900/20 transition-transform active:scale-95 flex justify-center items-center gap-2">
                            Next Step ➔
                        </button>
                    ) : (
                        <button onClick={handleSubmit} disabled={isLoading}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold text-base shadow-lg transition-transform active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2">
                            {isLoading ? 'Processing...' : 'Complete Membership ✓'}
                        </button>
                    )}

                    {onboardStep > 1 && (
                        <button onClick={() => setOnboardStep(onboardStep - 1)} className="w-full mt-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">
                            ← Back to previous step
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}

// 💡 3. 위에서 선언한 GuestLoginContent를 Suspense 보호막으로 감싸서 최종 내보냅니다!
export default function GuestLogin() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-slate-500 font-bold">Loading...</div>
            </div>
        }>
            <GuestLoginContent />
        </Suspense>
    );
}