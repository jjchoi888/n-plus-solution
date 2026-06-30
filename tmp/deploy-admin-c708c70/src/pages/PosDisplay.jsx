import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export default function PosDisplay() {
    // ====================================================
    // ⚙️ 1. 기기 기본 설정 상태 (Local Storage 연동)
    // ====================================================
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('posTabletSettings');
        return saved ? JSON.parse(saved) : {
            deviceId: 'POS-1',
            welcomeText: 'Restaurant & Bar',
            subText: 'Touch to see our latest promotions',
            bgColor: '#0f172a',
            slideInterval: 5,
            images: [],
            hotelCode: ''
        };
    });

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [hiddenClickCount, setHiddenClickCount] = useState(0);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

    // ====================================================
    // 🔒 2. 뷰어 초기 잠금장치 (직원 인증 로직)
    // ====================================================
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return sessionStorage.getItem('posViewerAuthed') === 'true';
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
                const isAuthorized = role.includes('POS') || role.includes('MANAGER') || role.includes('ADMIN') || role === 'SUPER_ADMIN';

                if (isAuthorized) {
                    sessionStorage.setItem('posViewerAuthed', 'true');

                    const updatedSettings = { ...settings, hotelCode: loginHotelCode };
                    setSettings(updatedSettings);
                    localStorage.setItem('posTabletSettings', JSON.stringify(updatedSettings));

                    setIsAuthenticated(true);
                } else {
                    alert(`❌ Access Denied: You do not have permission to access the POS Viewer.\n(Current Role: ${role})`);
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
    // 📝 3. 화면 모드 및 주문 상태 변수
    // ====================================================
    const [mode, setMode] = useState('standby');
    const [orderData, setOrderData] = useState({ cart: [], subtotal: 0, tax: 0, serviceCharge: 0, total: 0 });
    const [roomChargeData, setRoomChargeData] = useState({ roomNumber: '', guestName: '' });
    const [isChecked, setIsChecked] = useState(false);

    const canvasRef = useRef(null);
    const socketRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signatureData, setSignatureData] = useState('');
    const [receiptUrl, setReceiptUrl] = useState('');

    // ====================================================
    // 🚀 4. 슬라이드 타이머 & 소켓 통신 엔진
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
        if (!isAuthenticated) return;

        const socketUrl = import.meta.env.VITE_API_URL || 'https://api.hotelnplus.com';

        socketRef.current = io(socketUrl, {
            transports: ['websocket', 'polling'],
            secure: true,
            rejectUnauthorized: false
        });

        const socket = socketRef.current;

        // 1. POS 카트 실시간 동기화
        socket.on('pos_cart_sync', (data) => {
            if (data.target_tablet === settings.deviceId || data.target_tablet === 'ALL') {
                setOrderData(data.order_info);
                setMode('ordering');
            }
        });

        // 2. 룸 차지 서명 요청 수신
        socket.on('pos_signature_request', (data) => {
            if (data.target_tablet === settings.deviceId) {
                setOrderData(data.order_info);
                setRoomChargeData({ roomNumber: data.room_number, guestName: data.guest_name });
                setIsChecked(false);
                setSignatureData('');
                setMode('signing');
                setTimeout(clearSignature, 100);
            }
        });

        // 3. POS에서 QR 결제 요청이 왔을 때
        socket.on('pos_qr_request', (data) => {
            if (data.target_tablet === settings.deviceId) {
                setOrderData(prev => ({ ...prev, total: data.total_amount }));
                setMode('qr_pay');
            }
        });

        // 4. POS에서 QR 결제 완료 후 영수증 팝업 요청
        socket.on('pos_qr_receipt', (data) => {
            if (data.target_tablet === settings.deviceId) {
                setReceiptUrl(data.receipt_url);
                setMode('qr_receipt');

                setTimeout(() => {
                    setMode('standby');
                    setOrderData({ cart: [], subtotal: 0, tax: 0, serviceCharge: 0, total: 0 });
                }, 15000);
            }
        });

        // 5. 트랜잭션 초기화 (취소 또는 완료 시 대기 화면으로)
        socket.on('pos_transaction_clear', (data) => {
            if (data.target_tablet === settings.deviceId || data.target_tablet === 'ALL') {
                setMode('standby');
                setOrderData({ cart: [], subtotal: 0, tax: 0, serviceCharge: 0, total: 0 });
                setRoomChargeData({ roomNumber: '', guestName: '' });
                setSignatureData('');
            }
        });

        return () => {
            if (socket) socket.disconnect();
        };
    }, [settings.deviceId, isAuthenticated]);

    // ====================================================
    // ⚙️ 5. 설정창 & 이미지 업로드 로직
    // ====================================================
    const handleHiddenClick = () => {
        setHiddenClickCount(prev => {
            if (prev + 1 >= 5) { setIsSettingsOpen(true); return 0; }
            return prev + 1;
        });
        setTimeout(() => setHiddenClickCount(0), 3000);
    };

    const saveSettings = () => {
        localStorage.setItem('posTabletSettings', JSON.stringify(settings));
        setIsSettingsOpen(false);
    };

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (settings.images.length + files.length > 5) return alert('Max 5 images allowed.');
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
                    setSettings(prev => ({ ...prev, images: [...prev.images, canvas.toDataURL('image/jpeg', 0.7)] }));
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
    // ✍️ 6. 전자 서명 엔진
    // ====================================================
    useEffect(() => {
        if (mode === 'signing' && canvasRef.current) {
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

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            if (canvasRef.current) {
                setSignatureData(canvasRef.current.toDataURL('image/png'));
            }
        }
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureData('');
    };

    const handleSubmitSignature = () => {
        if (!isChecked) return alert("Please check the agreement box to proceed.");
        if (signatureData.length < 3000) return alert("Please provide your signature.");

        if (socketRef.current) {
            socketRef.current.emit('pos_signature_submit', {
                target_tablet: settings.deviceId,
                signature: signatureData,
                room_number: roomChargeData.roomNumber
            });
            alert("Thank you! Your order has been confirmed.");
        }

        setMode('standby');
        setOrderData({ cart: [], subtotal: 0, tax: 0, serviceCharge: 0, total: 0 });
        setSignatureData('');
        setIsChecked(false);
    };

    // ====================================================
    // 🎨 7. 화면 렌더링 (모드별 분기)
    // ====================================================

    // 🔒 [모드 0] 로그인되지 않은 경우 잠금 화면
    if (!isAuthenticated) {
        return (
            <div className="h-screen w-screen bg-slate-900 flex items-center justify-center font-sans select-none relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=2000')] bg-cover bg-center mix-blend-overlay"></div>
                <div className="bg-white/10 backdrop-blur-xl p-10 rounded-[2rem] shadow-2xl border border-white/20 w-full max-w-md relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 bg-blue-600 rounded-md flex items-center justify-center text-4xl mb-6 shadow-lg">🍽️</div>
                    <h1 className="text-3xl font-black text-white tracking-widest mb-2 uppercase">POS Viewer</h1>
                    <p className="text-blue-200 font-bold mb-8 tracking-widest text-sm">Device Setup & Authentication</p>

                    <form onSubmit={handleViewerLogin} className="w-full flex flex-col gap-4">
                        <input
                            type="text"
                            placeholder="Hotel Code (ex: NPLUS01)"
                            value={loginHotelCode}
                            onChange={(e) => setLoginHotelCode(e.target.value)}
                            className="w-full bg-black/40 border border-blue-500/50 text-blue-100 placeholder:text-blue-200/50 p-4 rounded-md text-center font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <input
                            type="text"
                            placeholder="Staff ID"
                            value={loginId}
                            onChange={(e) => setLoginId(e.target.value)}
                            className="w-full bg-black/30 border border-white/10 text-white placeholder:text-slate-400 p-4 rounded-md text-center font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={loginPwd}
                            onChange={(e) => setLoginPwd(e.target.value)}
                            className="w-full bg-black/30 border border-white/10 text-white placeholder:text-slate-400 p-4 rounded-md text-center text-xl tracking-[0.5em] font-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-lg py-4 rounded-md mt-4 shadow-lg transition-colors tracking-widest uppercase">
                            Unlock Display
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // 📺 [모드 1] 대기 화면 (Standby)
    if (mode === 'standby') {
        const hasImages = settings.images.length > 0;
        const currentBg = hasImages ? `url(${settings.images[currentSlideIndex]})` : 'none';

        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center relative select-none transition-all duration-1000 ease-in-out"
                style={{ backgroundColor: hasImages ? '#000' : settings.bgColor, backgroundImage: currentBg, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <div onClick={handleHiddenClick} className="absolute top-0 right-0 w-32 h-32 z-50 cursor-pointer bg-transparent"></div>

                <div className={`z-10 animate-pulse flex flex-col items-center p-8 rounded-md ${hasImages ? 'bg-black/50 backdrop-blur-md' : ''}`}>
                    <h1 className="text-6xl md:text-7xl font-black mb-4 text-center" style={{ color: hasImages ? '#ffffff' : '#60a5fa', textShadow: hasImages ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none' }}>
                        {settings.welcomeText}
                    </h1>
                    <p className="text-2xl tracking-widest text-center" style={{ color: hasImages ? '#e2e8f0' : '#cbd5e1', textShadow: hasImages ? '1px 1px 3px rgba(0,0,0,0.8)' : 'none' }}>
                        {settings.subText}
                    </p>
                </div>

                {isSettingsOpen && (
                    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-md w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">

                            <h2 className="text-2xl font-black mb-4 border-b pb-2 flex justify-between text-slate-800">
                                <span>⚙️ POS Viewer Settings</span>
                                <span className="text-blue-600 bg-blue-100 px-3 py-1 rounded-md text-lg">Target: {settings.deviceId}</span>
                            </h2>

                            <div className="space-y-4 text-slate-700">
                                <div>
                                    <label className="block text-sm font-bold text-slate-500 mb-1">Device Pairing ID (Matches POS)</label>
                                    <input type="text" value={settings.deviceId} onChange={e => setSettings({ ...settings, deviceId: e.target.value })} className="w-full p-3 border border-slate-300 rounded-md font-bold bg-slate-50 outline-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-500 mb-1">Welcome Text</label>
                                        <input type="text" value={settings.welcomeText} onChange={e => setSettings({ ...settings, welcomeText: e.target.value })} className="w-full p-3 border border-slate-300 rounded-md font-bold bg-slate-50 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-500 mb-1">Sub Text</label>
                                        <input type="text" value={settings.subText} onChange={e => setSettings({ ...settings, subText: e.target.value })} className="w-full p-3 border border-slate-300 rounded-md font-bold bg-slate-50 outline-none" />
                                    </div>
                                </div>

                                <div className="border-t border-slate-200 pt-4">
                                    <label className="block text-sm font-black text-slate-700 mb-2">⏱️ Slideshow Duration (Seconds)</label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min="3"
                                            max="30"
                                            value={settings.slideInterval}
                                            onChange={e => setSettings({ ...settings, slideInterval: parseInt(e.target.value) })}
                                            className="flex-1 accent-blue-600"
                                        />
                                        <span className="font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200 w-16 text-center">
                                            {settings.slideInterval}s
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1 font-bold">Set how long each promotional image stays on the screen.</p>
                                </div>

                                <div className="border-t border-slate-200 pt-4">
                                    <label className="block text-sm font-black text-slate-700 mb-2">📸 Promotional Slideshow Images</label>
                                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="mb-3 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:bg-blue-100 file:text-blue-700" />
                                    <div className="flex gap-3 overflow-x-auto pb-2">
                                        {settings.images.map((img, idx) => (
                                            <div key={idx} className="relative shrink-0">
                                                <img src={img} alt={`slide-${idx}`} className="w-32 h-20 object-cover rounded-md border-2 border-slate-300" />
                                                <button onClick={() => removeImage(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-md w-6 h-6 font-bold shadow-md">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                                <button onClick={() => setIsSettingsOpen(false)} className="px-6 py-3 bg-slate-200 rounded-md font-bold">Cancel</button>
                                <button onClick={saveSettings} className="px-8 py-3 bg-blue-600 text-white rounded-md font-black shadow-md">💾 Save Settings</button>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        );
    }

    // 🧾 [모드 2] 실시간 주문 확인 화면 (Ordering View)
    if (mode === 'ordering') {
        return (
            <div className="h-screen w-screen bg-slate-900 flex flex-col p-6 font-sans text-white select-none animate-fade-in">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
                    <h1 className="text-3xl font-black tracking-widest text-blue-400">YOUR ORDER</h1>
                    <span className="text-slate-400 font-bold bg-slate-800 px-4 py-2 rounded-md">Please review your items</span>
                </div>

                <div className="flex-1 overflow-y-auto mb-6 space-y-3 pr-2">
                    {orderData.cart.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-500 text-2xl font-bold">Awaiting Items...</div>
                    ) : (
                        orderData.cart.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-800 p-5 rounded-md border border-slate-700">
                                <div className="flex-1">
                                    <div className="text-xl font-bold">{item.name} <span className="text-blue-400 font-black ml-2">x{item.quantity}</span></div>
                                    {item.selectedSize !== 'Regular' && <div className="text-sm text-slate-400 mt-1 uppercase tracking-wider">{item.selectedSize}</div>}
                                </div>
                                <div className="text-2xl font-black text-emerald-400">₱{(item.price * item.quantity).toLocaleString()}</div>
                            </div>
                        ))
                    )}
                </div>

                <div className="bg-slate-800 p-6 rounded-md border border-slate-700 shrink-0 shadow-2xl">
                    <div className="flex justify-between text-slate-400 mb-2 text-lg"><span>Subtotal</span><span>₱{orderData.subtotal.toLocaleString()}</span></div>
                    <div className="flex justify-between text-slate-400 mb-2 text-lg"><span>Taxes & Fees</span><span>₱{(orderData.tax + orderData.serviceCharge).toLocaleString()}</span></div>
                    <div className="flex justify-between items-end border-t border-slate-700 pt-4 mt-2">
                        <span className="text-2xl font-black uppercase tracking-widest">Total Due</span>
                        <span className="text-5xl font-black text-white">₱{orderData.total.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        );
    }

    // 💡 [모드 4] QR 결제 요청 화면
    if (mode === 'qr_pay') {
        return (
            <div className="h-screen w-screen bg-slate-900 flex items-center justify-center font-sans select-none animate-fade-in relative overflow-hidden">
                <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center max-w-lg w-full text-center relative z-10 border-8 border-blue-500">
                    <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-md flex items-center justify-center text-5xl mb-6">📱</div>
                    <h2 className="text-3xl font-black text-slate-800 mb-2">Scan to Pay</h2>
                    <p className="text-slate-500 font-bold mb-8 text-lg">Please scan the QR code with your e-wallet app.</p>

                    <div className="bg-slate-50 p-4 rounded-md border border-slate-200 mb-8 shadow-inner">
                        {/* API를 활용한 동적 결제 금액 QR 생성 */}
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=PAYMENT_AMOUNT_${orderData.total}`} alt="Payment QR" className="w-64 h-64 rounded-md" />
                    </div>

                    <div className="text-5xl font-black text-blue-600">₱{orderData.total.toLocaleString()}</div>
                </div>
            </div>
        );
    }

    // 💡 [모드 5] QR 결제 성공 및 영수증 화면
    if (mode === 'qr_receipt') {
        return (
            <div className="h-screen w-screen bg-emerald-600 flex items-center justify-center font-sans select-none animate-fade-in">
                <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center max-w-lg w-full text-center relative z-10">
                    <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-md flex items-center justify-center text-5xl mb-6">✅</div>
                    <h2 className="text-3xl font-black text-slate-800 mb-2">Payment Successful!</h2>
                    <p className="text-slate-500 font-bold mb-8 text-lg">Scan to get your digital receipt.</p>

                    <div className="bg-slate-50 p-4 rounded-md border border-slate-200 mb-8 shadow-inner">
                        {/* 서버에서 보내준 영수증 URL 기반 QR 생성 */}
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${receiptUrl}`} alt="Receipt QR" className="w-64 h-64 rounded-md" />
                    </div>

                    <button onClick={() => {
                        setMode('standby');
                        setOrderData({ cart: [], subtotal: 0, tax: 0, serviceCharge: 0, total: 0 });
                    }} className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-black text-xl py-4 px-12 rounded-md transition-colors shadow-sm">
                        Done
                    </button>
                </div>
            </div>
        );
    }

    // ✍️ [모드 3] 룸 차지 서명 및 동의 화면 (Signing View)
    return (
        <div className="h-screen w-screen bg-slate-50 flex items-center justify-center p-6 font-sans select-none animate-fade-in">
            <div className="bg-white max-w-6xl w-full rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row h-full max-h-[850px] overflow-hidden border border-slate-200">

                <div className="w-full md:w-5/12 bg-slate-900 text-white p-8 flex flex-col">
                    <h2 className="text-3xl font-black mb-2 text-blue-400">Room Charge</h2>
                    <p className="text-slate-400 mb-8 border-b border-slate-700 pb-6 text-lg">
                        Room <span className="text-white font-black mx-1">{roomChargeData.roomNumber}</span> | {roomChargeData.guestName || 'Guest'}
                    </p>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-6">
                        {orderData.cart.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-lg">
                                <span className="font-bold text-slate-300"><span className="text-blue-400 mr-2">x{item.quantity}</span>{item.name}</span>
                                <span className="font-black">₱{(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-slate-700 pt-6 mt-auto">
                        <div className="flex justify-between items-end">
                            <span className="text-xl font-bold text-slate-400">Total Amount</span>
                            <span className="text-4xl font-black text-emerald-400">₱{orderData.total.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="w-full md:w-7/12 bg-white p-8 md:p-12 flex flex-col text-slate-800">
                    <h3 className="text-2xl font-black mb-6 uppercase tracking-widest flex justify-between items-center border-b pb-4">
                        <span>✍️ Digital Signature</span>
                        <button onClick={clearSignature} className="text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-md transition-colors">Clear</button>
                    </h3>

                    <div className="flex-1 bg-slate-50 border-4 border-slate-200 rounded-md relative overflow-hidden shadow-inner touch-none">
                        <canvas
                            ref={canvasRef}
                            width={800}
                            height={400}
                            className="w-full h-full cursor-crosshair touch-none"
                            onPointerDown={startDrawing}
                            onPointerMove={draw}
                            onPointerUp={stopDrawing}
                            onPointerOut={stopDrawing}
                            onPointerCancel={stopDrawing}
                        />
                        {!isDrawing && !signatureData && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                                <span className="text-4xl font-black uppercase tracking-widest text-slate-600">Please Sign Here</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-8">
                        <label className="flex items-start gap-4 cursor-pointer group bg-blue-50 p-5 rounded-md border border-blue-100 transition-colors hover:border-blue-300">
                            <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => setIsChecked(e.target.checked)}
                                className="w-8 h-8 mt-1 accent-blue-600 cursor-pointer shrink-0 border-2"
                            />
                            <span className="text-lg font-bold text-slate-600 group-hover:text-slate-800 leading-snug">
                                I confirm the items ordered and agree to charge the total amount of <span className="text-blue-600 font-black">₱{orderData.total.toLocaleString()}</span> to my room bill. I acknowledge that this charge is final and cannot be disputed.
                            </span>
                        </label>
                    </div>

                    <button
                        onClick={handleSubmitSignature}
                        disabled={!isChecked || !signatureData}
                        className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-[2rem] font-black text-2xl shadow-xl transition-all disabled:opacity-50 disabled:bg-slate-400 disabled:shadow-none active:scale-95"
                    >
                        Confirm & Charge Room
                    </button>
                </div>
            </div>
        </div>
    );
}