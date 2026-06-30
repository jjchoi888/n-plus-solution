import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export default function CustomerDisplay() {
    // ====================================================
    // ⚙️ 1. 기기 기본 설정 상태 (Local Storage 연동)
    // ====================================================
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('tabletSettings');
        return saved ? JSON.parse(saved) : {
            deviceId: 'PAD-1',
            welcomeText: 'N Plus Hotel',
            subText: 'Welcome. We are at your service.',
            bgColor: '#0f172a',
            slideInterval: 5,
            images: [],
            hotelCode: '' // 멀티테넌트용 식별자 추가
        };
    });

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [hiddenClickCount, setHiddenClickCount] = useState(0);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

    // ====================================================
    // 🔒 2. 뷰어 초기 잠금장치 (직원 인증 로직)
    // ====================================================
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return sessionStorage.getItem('fdViewerAuthed') === 'true';
    });
    const [loginHotelCode, setLoginHotelCode] = useState('');
    const [loginId, setLoginId] = useState('');
    const [loginPwd, setLoginPwd] = useState('');

    const handleViewerLogin = async (e) => {
        e.preventDefault();
        if (!loginHotelCode || !loginId || !loginPwd) return alert("Please enter Hotel Code, ID, and Password.");

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hotel_code: loginHotelCode,
                    user_id: loginId,
                    username: loginId,
                    password: loginPwd
                })
            });
            const data = await res.json();

            if (data.success) {
                const role = (data.user?.role || data.role || data.employee?.role || '').toUpperCase();
                const isAuthorized = role.includes('FRONT') || role.includes('RECEPTION') || role.includes('MANAGER') || role.includes('ADMIN') || role === 'SUPER_ADMIN';

                if (isAuthorized) {
                    sessionStorage.setItem('fdViewerAuthed', 'true');

                    const updatedSettings = { ...settings, hotelCode: loginHotelCode };
                    setSettings(updatedSettings);
                    localStorage.setItem('tabletSettings', JSON.stringify(updatedSettings));

                    setIsAuthenticated(true);
                } else {
                    alert(`❌ Access Denied: You do not have permission to access the Front Viewer.\n(Current Role: ${role})`);
                }
            } else {
                alert("❌ Authentication Failed: Please check your Hotel Code, ID, or Password.");
            }
        } catch (e) {
            console.error("Login Error:", e);
            alert("❌ Server communication error occurred.");
        }
    };

    // ====================================================
    // 📝 3. 기존 상태 변수들
    // ====================================================
    const [mode, setMode] = useState('standby'); // 'standby', 'checkin', 'checkout'
    const [displayData, setDisplayData] = useState(null);
    const [isChecked, setIsChecked] = useState(false);

    // 💡 [신규] 고객용 영수증(사용 내역) 모달 상태
    const [showReceiptModal, setShowReceiptModal] = useState(false);

    const canvasRef = useRef(null);
    const socketRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // ====================================================
    // 🚀 4. 슬라이드 타이머 & 소켓 통신
    // ====================================================
    useEffect(() => {
        let slideTimer;
        if (mode === 'standby' && settings.images.length > 1) {
            slideTimer = setInterval(() => {
                setCurrentSlideIndex((prev) => (prev + 1) % settings.images.length);
            }, settings.slideInterval * 1000);
        }
        return () => clearInterval(slideTimer);
    }, [mode, settings.images.length, settings.slideInterval]);

    useEffect(() => {
        if (!isAuthenticated) return; // 로그인 전에는 소켓 연결 방지

        // 💡 [수정] localhost 대신 정식 API 도메인 적용 (https 권장)
        const socketUrl = import.meta.env.VITE_API_URL || 'https://api.hotelnplus.com';

        // 💡 [최적화] https 환경에 맞춰 secure 옵션 추가 및 전송 방식 설정
        socketRef.current = io(socketUrl, {
            transports: ['websocket', 'polling'],
            secure: true,
            rejectUnauthorized: false // 자체 서명 인증서 환경일 경우 대비
        });

        const socket = socketRef.current;

        // 💡 1. 체크인 서명 요청 수신
        socket.on('checkin_signature_request', (data) => {
            if (data.target_tablet === settings.deviceId || data.target_tablet === 'ALL' || !data.target_tablet) {
                setDisplayData(data);
                setIsChecked(false);
                setMode('checkin');
                setShowReceiptModal(false);
                setTimeout(clearSignature, 100);
            }
        });

        // 💡 2. 체크아웃 서명 요청 수신 (이때 folio_items 내역도 같이 받습니다)
        socket.on('checkout_signature_request', (data) => {
            if (data.target_tablet === settings.deviceId || data.target_tablet === 'ALL' || !data.target_tablet) {
                setDisplayData(data);
                setIsChecked(false);
                setMode('checkout');
                setShowReceiptModal(false);
                setTimeout(clearSignature, 100);
            }
        });

        // 💡 3. 요청 취소 수신
        socket.on('cancel_signature_request', () => {
            setMode('standby');
            setDisplayData(null);
            setShowReceiptModal(false);
        });

        return () => {
            if (socket) socket.disconnect();
        };
    }, [settings.deviceId, isAuthenticated]);

    // ====================================================
    // ⚙️ 5. 설정창 & 이미지 압축 로직
    // ====================================================
    const handleHiddenClick = () => {
        setHiddenClickCount(prev => {
            if (prev + 1 >= 5) { setIsSettingsOpen(true); return 0; }
            return prev + 1;
        });
        setTimeout(() => setHiddenClickCount(0), 3000);
    };

    const saveSettings = () => {
        localStorage.setItem('tabletSettings', JSON.stringify(settings));
        setIsSettingsOpen(false);
    };

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (settings.images.length + files.length > 5) {
            return alert('Maximum 5 images allowed.');
        }

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1280;
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                    setSettings(prev => ({ ...prev, images: [...prev.images, compressedBase64] }));
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    const removeImage = (index) => {
        setSettings(prev => {
            const newImages = [...prev.images];
            newImages.splice(index, 1);
            return { ...prev, images: newImages };
        });
        setCurrentSlideIndex(0);
    };

    // ====================================================
    // ✍️ 6. 서명 패드 엔진 (디스크펜 완벽 호환 PointerEvent)
    // ====================================================
    useEffect(() => {
        if ((mode === 'checkin' || mode === 'checkout') && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#1e293b';
        }
    }, [mode]);

    const getCoordinates = (e, canvas) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { x, y } = getCoordinates(e, canvas);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { x, y } = getCoordinates(e, canvas);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => { setIsDrawing(false); };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSubmitSignature = () => {
        if (!isChecked) return alert("Please check the agreement box.");

        const canvas = canvasRef.current;
        const signatureBase64 = canvas.toDataURL('image/png');
        if (signatureBase64.length < 3000) return alert("Please provide your signature.");

        if (socketRef.current) {
            if (mode === 'checkin') {
                socketRef.current.emit('checkin_signature_submit', { roomId: displayData.roomId, signature: signatureBase64 });
                alert("Welcome! Your check-in is complete.");
            } else if (mode === 'checkout') {
                socketRef.current.emit('checkout_signature_submit', { roomId: displayData.roomId, signature: signatureBase64 });
                alert("Thank you! Your check-out is complete.");
            }
        }
        setMode('standby');
        setShowReceiptModal(false);
    };

    // ====================================================
    // 🎨 7. 화면 렌더링
    // ====================================================

    if (!isAuthenticated) {
        return (
            <div className="h-screen w-screen bg-slate-900 flex items-center justify-center font-sans select-none relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1542314831-c6a4d1421c4b?q=80&w=2000')] bg-cover bg-center mix-blend-overlay"></div>
                <div className="bg-white/10 backdrop-blur-xl p-10 rounded-[2rem] shadow-2xl border border-white/20 w-full max-w-md relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 bg-indigo-600 rounded-md flex items-center justify-center text-4xl mb-6 shadow-lg">🛎️</div>
                    <h1 className="text-3xl font-black text-white tracking-widest mb-2 uppercase text-center">Front Desk<br />Viewer</h1>
                    <p className="text-indigo-200 font-bold mb-8 tracking-widest text-sm">Device Setup & Authentication</p>

                    <form onSubmit={handleViewerLogin} className="w-full flex flex-col gap-4">
                        <input
                            type="text"
                            placeholder="Hotel Code (ex: NPLUS01)"
                            value={loginHotelCode}
                            onChange={(e) => setLoginHotelCode(e.target.value)}
                            className="w-full bg-black/40 border border-indigo-500/50 text-indigo-100 placeholder:text-indigo-200/50 p-4 rounded-md text-center font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <input
                            type="text"
                            placeholder="Staff ID"
                            value={loginId}
                            onChange={(e) => setLoginId(e.target.value)}
                            className="w-full bg-black/30 border border-white/10 text-white placeholder:text-slate-400 p-4 rounded-md text-center font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={loginPwd}
                            onChange={(e) => setLoginPwd(e.target.value)}
                            className="w-full bg-black/30 border border-white/10 text-white placeholder:text-slate-400 p-4 rounded-md text-center text-xl tracking-[0.5em] font-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg py-4 rounded-md mt-4 shadow-lg transition-colors tracking-widest uppercase">
                            Unlock Display
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (mode === 'standby') {
        const hasImages = settings.images.length > 0;
        const currentBg = hasImages ? `url(${settings.images[currentSlideIndex]})` : 'none';

        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center relative select-none transition-all duration-1000 ease-in-out"
                style={{
                    backgroundColor: hasImages ? '#000' : settings.bgColor,
                    backgroundImage: currentBg,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                }}>

                <div onClick={handleHiddenClick} className="absolute top-0 right-0 w-32 h-32 z-50 cursor-pointer bg-transparent"></div>

                <div className={`z-10 animate-pulse flex flex-col items-center p-8 rounded-md ${hasImages ? 'bg-black/50 backdrop-blur-md' : ''}`}>
                    <h1 className="text-6xl md:text-7xl font-black mb-4"
                        style={{ color: hasImages ? '#ffffff' : '#60a5fa', textShadow: hasImages ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none' }}>
                        {settings.welcomeText}
                    </h1>
                    <p className="text-2xl tracking-widest"
                        style={{ color: hasImages ? '#e2e8f0' : '#cbd5e1', textShadow: hasImages ? '1px 1px 3px rgba(0,0,0,0.8)' : 'none' }}>
                        {settings.subText}
                    </p>
                </div>

                {isSettingsOpen && (
                    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-md w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                            <h2 className="text-2xl font-black mb-4 border-b pb-2 flex justify-between text-slate-800">
                                <span>⚙️ Tablet Device Settings</span>
                                <span className="text-blue-600 bg-blue-100 px-3 py-1 rounded-md text-lg">ID: {settings.deviceId}</span>
                            </h2>

                            <div className="space-y-4 text-slate-700">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-500 mb-1">Device Pairing ID (ex: PAD-1)</label>
                                        <input type="text" value={settings.deviceId} onChange={e => setSettings({ ...settings, deviceId: e.target.value })} className="w-full p-3 border border-slate-300 rounded-md font-bold bg-slate-50 outline-none focus:border-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-500 mb-1">Background Color</label>
                                        <div className="flex gap-2">
                                            <input type="color" value={settings.bgColor} onChange={e => setSettings({ ...settings, bgColor: e.target.value })} className="h-12 w-16 cursor-pointer rounded border border-slate-300" />
                                            <input type="text" value={settings.bgColor} onChange={e => setSettings({ ...settings, bgColor: e.target.value })} className="flex-1 p-3 border border-slate-300 rounded-md font-bold bg-slate-50 outline-none" />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-500 mb-1">Welcome Text (Main Title)</label>
                                    <input type="text" value={settings.welcomeText} onChange={e => setSettings({ ...settings, welcomeText: e.target.value })} className="w-full p-3 border border-slate-300 rounded-md font-bold text-lg bg-slate-50 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-500 mb-1">Sub Text (Subtitle)</label>
                                    <input type="text" value={settings.subText} onChange={e => setSettings({ ...settings, subText: e.target.value })} className="w-full p-3 border border-slate-300 rounded-md font-bold bg-slate-50 outline-none" />
                                </div>

                                <div className="border-t border-slate-200 pt-4 mt-4">
                                    <label className="block text-sm font-black text-slate-700 mb-2">📸 Promotional Slideshow Images</label>
                                    <div className="flex items-center justify-between mb-3 bg-slate-50 p-3 rounded-md border border-slate-200">
                                        <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer" />
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-slate-500">Interval:</span>
                                            <input type="number" value={settings.slideInterval} onChange={e => setSettings({ ...settings, slideInterval: Number(e.target.value) })} className="w-16 p-2 border border-slate-300 rounded text-center font-bold outline-none" />
                                            <span className="text-sm text-slate-500">sec</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 overflow-x-auto pb-2">
                                        {settings.images.map((img, idx) => (
                                            <div key={idx} className="relative shrink-0">
                                                <img src={img} alt={`slide-${idx}`} className="w-32 h-20 object-cover rounded-md border-2 border-slate-300 shadow-sm" />
                                                <button onClick={() => removeImage(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-md w-6 h-6 flex items-center justify-center font-bold shadow-md hover:bg-red-600">✕</button>
                                            </div>
                                        ))}
                                        {settings.images.length === 0 && <span className="text-xs text-slate-400 italic py-4">No images uploaded. Solid background color will be used.</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                                <button onClick={() => setIsSettingsOpen(false)} className="px-6 py-3 bg-slate-200 text-slate-700 rounded-md font-bold hover:bg-slate-300 transition-colors">Cancel</button>
                                <button onClick={saveSettings} className="px-8 py-3 bg-blue-600 text-white rounded-md font-black hover:bg-blue-700 shadow-md transition-colors">💾 Save Settings</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const isCheckin = mode === 'checkin';
    const headerTitle = isCheckin ? "Registration & Deposit Acknowledgment" : "Check-out & Refund Acknowledgment";
    const headerSub = isCheckin ? "Please review your stay details and hotel policies." : "Please review your folio and refund details.";
    const btnText = isCheckin ? "Confirm Check-in" : "Confirm Check-out";

    return (
        <div className="h-screen w-screen bg-slate-50 flex items-center justify-center p-8 font-sans select-none relative">

            {/* 💡 [신규] 고객용 사용 내역(Folio/Receipt) 확인 모달창 */}
            {showReceiptModal && (
                <div className="fixed inset-0 bg-slate-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in font-mono">
                    <div className="w-full max-w-[400px] flex flex-col max-h-[90vh]">
                        <div className="flex justify-end mb-3">
                            <button onClick={() => setShowReceiptModal(false)} className="text-white hover:text-red-400 font-bold text-2xl transition-colors bg-white/10 hover:bg-white/20 w-10 h-10 rounded-md flex items-center justify-center">✕</button>
                        </div>
                        <div className="bg-white flex-1 overflow-y-auto p-6 md:p-8 text-slate-800 shadow-2xl rounded-md border-t-[10px] border-blue-600">
                            <div className="text-center mb-6">
                                <h2 className="text-lg font-black tracking-widest uppercase mb-1">Folio Details</h2>
                                <p className="text-[10px] text-slate-500">Room {displayData?.roomId}</p>
                            </div>

                            <div className="border-t border-dashed border-slate-300 my-4"></div>

                            <div className="min-h-[150px] mb-4">
                                {displayData?.folio_items && displayData.folio_items.length > 0 ? (
                                    displayData.folio_items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-[11px] mb-2 text-slate-700">
                                            <div className="flex-1 pr-2">
                                                <span className="font-bold">{item.name}</span>
                                                {item.selectedSize && item.selectedSize !== 'Regular' && <span className="ml-1 text-slate-500">({item.selectedSize})</span>}
                                            </div>
                                            <span className="whitespace-nowrap font-bold text-right w-24">x{item.quantity} ₱{(item.price * item.quantity).toLocaleString()}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-xs text-slate-400 mt-10 font-bold">No detailed charges found.</p>
                                )}
                            </div>

                            <div className="border-t border-dashed border-slate-300 my-4"></div>

                            <div className="flex justify-between items-center text-slate-900 mt-6">
                                <span className="font-bold tracking-widest text-sm">TOTAL CHARGES:</span>
                                <span className="font-black text-xl text-blue-600">₱{Number(displayData?.deduction || 0).toLocaleString()}</span>
                            </div>

                            <button onClick={() => setShowReceiptModal(false)} className="w-full mt-8 bg-slate-100 text-slate-600 py-3 rounded-md font-bold hover:bg-slate-200 transition-colors">
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white max-w-2xl w-full rounded-md shadow-2xl overflow-hidden border border-slate-200 flex flex-col h-full max-h-[850px]">

                <div className={`${isCheckin ? 'bg-indigo-600' : 'bg-blue-600'} p-6 text-center text-white shrink-0 transition-colors`}>
                    <h2 className="text-2xl font-black tracking-wide">{headerTitle}</h2>
                    <p className="text-blue-100 mt-1">{headerSub}</p>
                </div>

                <div className="p-6 md:p-8 flex-1 overflow-y-auto text-slate-800">
                    <div className="bg-slate-50 p-6 rounded-md border border-slate-200 mb-6">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-4">
                            <div>
                                <p className="text-sm font-bold text-slate-500 uppercase">Room</p>
                                <p className="text-xl font-black text-slate-800">{displayData?.roomId || '---'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-slate-500 uppercase">Guest Name</p>
                                <p className="text-xl font-black text-slate-800">{displayData?.guestName || '---'}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {isCheckin ? (
                                <>
                                    <div className="flex justify-between text-slate-600 font-bold">
                                        <span>Check-in Date:</span>
                                        <span>{displayData?.checkInDate || '---'}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 font-bold">
                                        <span>Check-out Date:</span>
                                        <span>{displayData?.checkOutDate || '---'}</span>
                                    </div>
                                    <div className="flex justify-between pt-3 border-t border-slate-200 text-xl font-black text-indigo-600">
                                        <span>Security Deposit Paid (Cash):</span>
                                        <span>₱ {Number(displayData?.deposit || 0).toLocaleString()}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex justify-between text-slate-600 font-bold">
                                        <span>Initial Security Deposit:</span>
                                        <span>₱ {Number(displayData?.deposit || 0).toLocaleString()}</span>
                                    </div>

                                    {/* 💡 [신규] 고객 뷰어의 Folio Charges 영역에 영수증 보기 버튼 추가 */}
                                    <div className="flex justify-between text-red-500 font-bold items-center">
                                        <div className="flex items-center gap-2">
                                            <span>Folio Charges (Deductions):</span>
                                            {displayData?.folio_items && displayData.folio_items.length > 0 && (
                                                <button onClick={() => setShowReceiptModal(true)} className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider hover:bg-red-200 transition-colors border border-red-200 shadow-sm flex items-center gap-1">
                                                    🧾 View Details
                                                </button>
                                            )}
                                        </div>
                                        <span>- ₱ {Number(displayData?.deduction || 0).toLocaleString()}</span>
                                    </div>

                                    <div className="flex justify-between pt-3 border-t border-slate-200 text-xl font-black text-blue-600">
                                        <span>Total Refund Amount:</span>
                                        <span>₱ {Number(displayData?.refund || 0).toLocaleString()}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className={`mb-6 flex items-start gap-3 p-4 rounded-md border ${isCheckin ? 'bg-indigo-50 border-indigo-100' : 'bg-blue-50 border-blue-100'}`}>
                        <input
                            type="checkbox"
                            id="consent"
                            checked={isChecked}
                            onChange={(e) => setIsChecked(e.target.checked)}
                            className={`w-6 h-6 mt-1 rounded cursor-pointer ${isCheckin ? 'text-indigo-600 focus:ring-indigo-500' : 'text-blue-600 focus:ring-blue-500'}`}
                        />
                        <label htmlFor="consent" className="text-sm font-bold text-slate-700 cursor-pointer leading-relaxed">
                            {isCheckin
                                ? "I agree to the hotel rules and regulations. I confirm the security deposit amount stated above, which is fully refundable upon check-out subject to damage/minibar inspection. An electronic receipt will be sent to my email."
                                : "I confirm that I have reviewed the check-out details above and acknowledge the receipt of the refund amount in cash. I understand that an electronic copy of this document will be sent to my email."
                            }
                        </label>
                    </div>

                    <div className="mb-4 relative">
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Please Sign Below</label>
                            <button onClick={clearSignature} className="text-xs bg-slate-200 text-slate-600 px-3 py-1 rounded font-bold hover:bg-slate-300">Clear</button>
                        </div>

                        <div className="border-2 border-dashed border-slate-300 rounded-md overflow-hidden bg-white touch-none">
                            <canvas
                                ref={canvasRef}
                                width={600}
                                height={180}
                                className="w-full cursor-crosshair touch-none"
                                onPointerDown={startDrawing}
                                onPointerMove={draw}
                                onPointerUp={stopDrawing}
                                onPointerOut={stopDrawing}
                                onPointerCancel={stopDrawing}
                            />
                        </div>
                        <p className="text-center text-[10px] text-slate-400 mt-2">I acknowledge and agree to the hotel terms and conditions.</p>
                    </div>
                </div>

                <div className="p-6 bg-white border-t border-slate-100 shrink-0">
                    <button
                        onClick={handleSubmitSignature}
                        className={`w-full py-4 rounded-md font-black text-lg text-white transition-all shadow-lg 
                            ${!isChecked ? 'bg-slate-300 cursor-not-allowed' : (isCheckin ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700')}
                        `}
                    >
                        {btnText}
                    </button>
                </div>

            </div>
        </div>
    );
}