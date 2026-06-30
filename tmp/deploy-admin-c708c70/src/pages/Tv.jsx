import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const translations = {
    EN: { welcome: "Welcome", selectOption: "Please select a service using your remote control.", menu: { dining: { title: "In-Room Dining", desc: "Exquisite flavors delivered to your door." }, spa: { title: "Spa & Wellness", desc: "Rejuvenate your body and soul." }, todo: { title: "Local Guide", desc: "Explore the best spots around you." }, bill: { title: "Services & Checkout", desc: "Review charges and request services." }, tv: { title: "Live TV", desc: "Entertainment at your fingertips." } }, exit: "Exit" },
    KR: { welcome: "환영합니다", selectOption: "리모컨을 사용하여 서비스를 선택해주세요.", menu: { dining: { title: "룸서비스", desc: "객실에서 즐기는 품격 있는 식사." }, spa: { title: "스파 & 힐링", desc: "지친 몸과 마음을 위한 휴식." }, todo: { title: "로컬 가이드", desc: "주변의 핫플레이스를 찾아보세요." }, bill: { title: "고객 서비스 & 체크아웃", desc: "요금 확인 및 서비스 요청." }, tv: { title: "TV 시청", desc: "다양한 채널을 즐겨보세요." } }, exit: "나가기" },
    CN: { welcome: "欢迎光临", selectOption: "请使用遥控器选择服务。", menu: { dining: { title: "客房送餐", desc: "尽享美味佳肴." }, spa: { title: "水疗与健康", desc: "放松身心." }, todo: { title: "本地指南", desc: "探索周边最佳景点." }, bill: { title: "服务与退房", desc: "查看费用并请求服务." }, tv: { title: "直播电视", desc: "触手可及的娱乐." } }, exit: "退出" },
    JP: { welcome: "ようこそ", selectOption: "リモコンでサービスを選択してください。", menu: { dining: { title: "ルームサービス", desc: "お部屋で楽しむ特別なお食事。" }, spa: { title: "スパ＆ウェルネス", desc: "心と体をリフレッシュ。" }, todo: { title: "ローカルガイド", desc: "周辺のおすすめスポット。" }, bill: { title: "サービス＆チェックアウト", desc: "料金確認とサービスリクエスト。" }, tv: { title: "テレビ視聴", desc: "ライブチャンネルをお楽しみください。" } }, exit: "終了" },
};

const MENU_ITEMS_DATA = {
    dining: [{ id: 1, name: 'Club Sandwich', price: 450, img: '🥪', sizes: [{ name: 'Regular', price: 450 }] }],
    spa: [{ id: 101, name: 'Aromatherapy', price: 1500, img: '💆', sizes: [{ name: '60 Mins', price: 1500 }] }],
    todo: [{ id: 201, name: 'City Tour Bus', price: 1500, img: '🚌', sizes: [{ name: 'Half Day', price: 1500 }] }]
};

export default function Tv() {
    const { roomNumber } = useParams();
    const navigate = useNavigate();

    // 💡 [Cleaned] Fixed the blank space bug to ensure proper API communication
    const currentHotelCode = sessionStorage.getItem('hotelCode') || localStorage.getItem('hotelCode') || '';
    const cleanRoomNumber = (roomNumber || '').split(':')[0];

    const [currentScreen, setCurrentScreen] = useState('HOME');
    const [cart, setCart] = useState([]);
    const [roomBalance, setRoomBalance] = useState(0);
    const [guestInfo, setGuestInfo] = useState({ name: 'Guest', nationality: 'EN' });
    const [language, setLanguage] = useState('EN');
    const [activeIndex, setActiveIndex] = useState(0);
    const [dbSettings, setDbSettings] = useState({});
    const [folioItems, setFolioItems] = useState([]);
    const [currentTime, setCurrentTime] = useState(new Date());

    const [rsConfig, setRsConfig] = useState(null);
    const [activeOrderConfig, setActiveOrderConfig] = useState({ title: '', storeId: '', menuData: [] });
    const [sizeModalData, setSizeModalData] = useState(null);
    const [activeCategory, setActiveCategory] = useState('All');

    const [wakeupTime, setWakeupTime] = useState('');
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [isMakeupRequested, setIsMakeupRequested] = useState(false);
    const [makeupModalMsg, setMakeupModalMsg] = useState('');
    const [showQrModal, setShowQrModal] = useState(false);

    const [mcHour, setMcHour] = useState(7);
    const [mcMinute, setMcMinute] = useState(0);
    const [mcAmPm, setMcAmPm] = useState('AM');

    const [roomInfo, setRoomInfo] = useState(null);
    const t = translations[language] || translations['EN'];

    const handleKeyClick = (e, action) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            action();
        }
    };

    useEffect(() => {
        // 1. 기존 스마트 TV 상단의 '현재 시간 시계(1분마다 갱신)' 타이머는 그대로 살려둡니다.
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);

        // 2. TV 화면이 처음 켜졌을 때 데이터 즉시 호출
        fetchRoomInfo();
        fetchSettings();

        if (!currentHotelCode) {
            return () => clearInterval(timer);
        }

        // 💡 3. [웹소켓 엔진] 프론트/어드민에서 TV 설정이나 객실 상태를 바꾸면 즉각 반영!
        const socketUrl = import.meta.env.VITE_API_URL || 'https://api.hotelnplus.com';
        const socket = io(socketUrl, { transports: ['websocket'] });
        

        socket.on('db_updated', (data) => {
            // 남의 지점 데이터는 무시하고, 우리 호텔에 변경사항이 있을 때만
            if (data.hotel_code === currentHotelCode || data.hotel_code === 'ALL') {
                console.log("🔄 [TV] Real-time TV settings and room data sync completed!");
                // 룸서비스나 설정이 바뀌었을 수 있으므로 조용히 최신 데이터를 가져옵니다.
                fetchRoomInfo();
                fetchSettings();
            }
        });

        // 4. TV가 꺼지면 시계 타이머와 소켓 무전기를 모두 안전하게 끕니다.
        return () => {
            clearInterval(timer);
            socket.disconnect();
        };
    }, [cleanRoomNumber, currentHotelCode]);

    const fetchRoomInfo = async () => {
        try {
            const roomRes = await fetch(`/api/rooms?hotel=${currentHotelCode}`);
            if (roomRes.ok) {
                const data = await roomRes.json();
                const myRoom = data.find(r => String(r.id) === String(cleanRoomNumber));

                if (myRoom) {
                    setRoomInfo(myRoom);
                    setRoomBalance(myRoom.balance || 0);
                    setWakeupTime(myRoom.wakeup_call || '');
                    setIsMakeupRequested(myRoom.status === 'MAKE_UP_GUEST');

                    let nationality = 'EN';
                    if (myRoom.guestName) {
                        const name = myRoom.guestName.toLowerCase();
                        if (name.includes('kim') || name.includes('lee')) nationality = 'KR';
                        else if (name.includes('wang') || name.includes('li')) nationality = 'CN';
                        else if (name.includes('sato')) nationality = 'JP';
                    }
                    setGuestInfo({ name: myRoom.guestName || 'Guest', nationality });
                    setLanguage(nationality);
                } else { throw new Error("Room Not Found"); }
            }

            try {
                const folioRes = await fetch(`/api/folio/${cleanRoomNumber}?hotel=${currentHotelCode}`);
                if (folioRes.ok) {
                    const fData = await folioRes.json();
                    setFolioItems(Array.isArray(fData) ? fData : []);
                }
            } catch (e) { console.log('Folio not found (Normal if no bills)'); }
        } catch (e) {
            setRoomInfo({ id: cleanRoomNumber || '101', guest_name: 'Guest (Demo)', room_type: 'Standard' });
            setGuestInfo({ name: 'Guest (Demo)', nationality: 'EN' });
            setFolioItems([{ description: 'Room Charge (Night 1)', amount: 5500 }]);
            setRoomBalance(5500);
            setLanguage('EN');
        }
    };

    const fetchSettings = () => {
        fetch(`/api/tv-settings?hotel=${currentHotelCode}`)
            .then(res => res.json())
            .then(data => {
                const settingsMap = {};
                if (Array.isArray(data)) { data.forEach(item => { settingsMap[item.menu_id] = item.bg_image_url; }); setDbSettings(settingsMap); }
            }).catch(() => { });

        fetch(`/api/tv-settings/room-service?hotel=${currentHotelCode}`)
            .then(res => res.json())
            .then(data => { if (data && Object.keys(data).length > 0) setRsConfig(data); })
            .catch(() => { });
    };

    const openOrderScreen = async (type, title, storeId, needsTimeCheck) => {
        if (needsTimeCheck && rsConfig) {
            let opTime = type === 'spa' ? rsConfig.spa_open_time : rsConfig.open_time;
            let clTime = type === 'spa' ? rsConfig.spa_close_time : rsConfig.close_time;
            let clMsg = type === 'spa' ? rsConfig.spa_closed_message : rsConfig.closed_message;

            if (opTime && clTime) {
                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                try {
                    const [openH, openM] = opTime.split(':').map(Number);
                    const [closeH, closeM] = clTime.split(':').map(Number);
                    const startMinutes = openH * 60 + openM;
                    const endMinutes = closeH * 60 + closeM;
                    const isOpen = (endMinutes < startMinutes)
                        ? (currentMinutes >= startMinutes || currentMinutes < endMinutes)
                        : (currentMinutes >= startMinutes && currentMinutes < endMinutes);

                    if (!isOpen) { setMakeupModalMsg(clMsg || "Service is currently closed."); return; }
                } catch (e) { }
            }
        }

        if (!storeId) {
            let fallbackItems = MENU_ITEMS_DATA[type] || [];
            let displayItems = fallbackItems.map(item => {
                const sizes = item.sizes || [{ name: 'Regular', price: item.price }];
                return { ...item, sizes, displayPrice: parseFloat(sizes[0].price || item.price || 0) };
            });
            setActiveOrderConfig({ title, storeId: null, menuData: displayItems });
            setCart([]);
            setActiveCategory('All');
            setCurrentScreen('ORDER_SCREEN');
            return;
        }

        try {
            const res = await fetch(`/api/pos-menus/${storeId}`);
            const data = await res.json();

            // 💡 [핵심 해결] 이름에 [TV] 꼬리표가 붙은 항목만 룸서비스로 분류하고, 
            // 손님에게 보여줄 때는 [TV] 글자를 깔끔하게 지워버립니다!
            let displayItems = data
                .filter(item => item.name && item.name.includes('[TV]'))
                .map(item => {
                    let parsedSizes = [];
                    try { parsedSizes = typeof item.sizes === 'string' ? JSON.parse(item.sizes) : item.sizes; } catch (e) { }
                    if (!Array.isArray(parsedSizes) || parsedSizes.length === 0) parsedSizes = [{ name: 'Regular', price: item.price }];

                    return {
                        ...item,
                        name: item.name.replace(' [TV]', '').replace('[TV]', ''),
                        sizes: parsedSizes,
                        displayPrice: parseFloat(parsedSizes[0].price || item.price || 0)
                    };
                });

            setActiveOrderConfig({ title, storeId, menuData: displayItems });
            setCart([]);
            setActiveCategory('All');
            setCurrentScreen('ORDER_SCREEN');
        } catch (e) {
            setMakeupModalMsg("Failed to load items. Please try again.");
        }
    };

    const handleItemClick = (item) => {
        if (item.sizes && item.sizes.length > 1) setSizeModalData(item);
        else {
            const defaultSize = item.sizes && item.sizes.length > 0 ? item.sizes[0] : { name: 'Regular', price: item.displayPrice };
            addToCart(item, defaultSize);
        }
    };

    const addToCart = (item, sizeOption) => {
        const cartId = `${item.id}-${sizeOption.name}`;
        setCart(prev => {
            const existing = prev.find(i => i.cartId === cartId);
            if (existing) return prev.map(i => i.cartId === cartId ? { ...i, quantity: (i.quantity || 1) + 1 } : i);
            return [...prev, {
                ...item, cartId: cartId, displayName: item.name, variantName: sizeOption.name,
                displayPrice: parseFloat(sizeOption.price || 0), quantity: 1
            }];
        });
        setSizeModalData(null);
    };

    const removeFromCart = (cartId) => {
        setCart(prev => {
            const existing = prev.find(i => i.cartId === cartId);
            if (existing && existing.quantity > 1) return prev.map(i => i.cartId === cartId ? { ...i, quantity: i.quantity - 1 } : i);
            return prev.filter(i => i.cartId !== cartId);
        });
    };

    const incHour = () => setMcHour(h => h === 12 ? 1 : h + 1);
    const decHour = () => setMcHour(h => h === 1 ? 12 : h - 1);
    const incMin = () => setMcMinute(m => m === 55 ? 0 : m + 5);
    const decMin = () => setMcMinute(m => m === 0 ? 55 : m - 5);
    const toggleAmPm = () => setMcAmPm(a => a === 'AM' ? 'PM' : 'AM');

    const handleSaveWakeup = async () => {
        const timeStr = `${String(mcHour).padStart(2, '0')}:${String(mcMinute).padStart(2, '0')} ${mcAmPm}`;
        try {
            await fetch('/api/rooms/extra-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cleanRoomNumber, wakeup_call: timeStr, hotel_code: currentHotelCode }) });
        } catch (e) { }
        setWakeupTime(timeStr);
        setShowTimePicker(false);
        setMakeupModalMsg(`Wake-up call set for ${timeStr}`);
    };

    const handleToggleMakeup = async () => {
        const newStatus = isMakeupRequested ? 'OCCUPIED' : 'MAKE_UP_GUEST';
        try {
            await fetch('/api/rooms/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cleanRoomNumber, status: newStatus, hotel_code: currentHotelCode }) });
            socket.emit('hkRequest', { roomId: cleanRoomNumber, message: 'Guest requested make-up room' });
        } catch (e) { }
        setIsMakeupRequested(!isMakeupRequested);
        setMakeupModalMsg(isMakeupRequested ? "Request cancelled." : "Housekeeping has been notified.");
    };

    const totalAmount = cart.reduce((sum, item) => sum + (item.displayPrice * item.quantity), 0);

    const handlePayment = async () => {
        if (cart.length === 0) return;
        try {
            const orderTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const posFormattedCart = cart.map(item => ({
                ...item, price: item.displayPrice, selectedSize: item.variantName || 'Regular', requestTime: orderTime
            }));

            await fetch('/api/tables/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hotel_code: currentHotelCode,
                    store_id: activeOrderConfig.storeId,
                    table_number: String(cleanRoomNumber),
                    cart_data: posFormattedCart,
                    total_amount: totalAmount,
                    user_id: `TV-${cleanRoomNumber}`
                })
            });

            setCurrentScreen('SUCCESS'); setCart([]);
        } catch (error) { setMakeupModalMsg('Order simulated (Offline).'); setCurrentScreen('SUCCESS'); }
    };

    const handleCheckout = async () => {
        if (folioItems.reduce((sum, i) => sum + i.amount, 0) > 0) {
            setMakeupModalMsg("Please settle your balance via QR Code or at the Front Desk.");
            return;
        }
        try { await fetch('/api/rooms/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room_number: cleanRoomNumber, hotel_code: currentHotelCode }) }); } catch (e) { }
        navigate('/');
    };

    if (!roomInfo) return <div className="bg-black h-screen text-white flex items-center justify-center text-3xl animate-pulse">Initializing System...</div>;

    const menuSections = [
        { id: 'dining', title: t.menu.dining.title, desc: t.menu.dining.desc, bgImage: dbSettings.dining ? `url(${dbSettings.dining})` : 'url(https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1920)', action: () => openOrderScreen('dining', t.menu.dining.title, rsConfig?.target_store_id, true) },
        { id: 'spa', title: t.menu.spa.title, desc: t.menu.spa.desc, bgImage: dbSettings.spa ? `url(${dbSettings.spa})` : 'url(https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=1920)', action: () => openOrderScreen('spa', t.menu.spa.title, rsConfig?.spa_store_id, true) },
        { id: 'todo', title: t.menu.todo.title, desc: t.menu.todo.desc, bgImage: dbSettings.todo ? `url(${dbSettings.todo})` : 'url(https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?q=80&w=1920)', action: () => openOrderScreen('todo', t.menu.todo.title, rsConfig?.todo_store_id, false) },
        { id: 'checkout', title: t.menu.bill.title, desc: t.menu.bill.desc, bgImage: dbSettings.bill ? `url(${dbSettings.bill})` : 'url(https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=1920)', screen: 'CHECKOUT' },
        { id: 'tv', title: t.menu.tv.title, desc: t.menu.tv.desc, bgImage: dbSettings.tv ? `url(${dbSettings.tv})` : 'url(https://images.unsplash.com/photo-1593784697956-141c0c27934c?q=80&w=1920)', action: () => setMakeupModalMsg('HDMI Switching...') }
    ];

    const GlobalAlertModal = () => {
        if (!makeupModalMsg) return null;
        return (
            <div className="fixed inset-0 bg-black/90 z-[999] flex items-center justify-center backdrop-blur-md animate-fade-in">
                <div className="bg-slate-800 p-10 rounded-md border border-slate-600 w-[500px] text-center shadow-2xl flex flex-col items-center">
                    <div className="text-6xl mb-6">🔔</div>
                    <h3 className="text-3xl font-bold mb-8 text-white">{makeupModalMsg}</h3>
                    <button
                        autoFocus tabIndex={0}
                        onClick={() => setMakeupModalMsg('')}
                        onKeyDown={(e) => handleKeyClick(e, () => setMakeupModalMsg(''))}
                        className="bg-blue-600 text-white py-4 px-12 rounded-md text-xl font-bold transition-all focus:outline-none focus:ring-8 focus:ring-yellow-400 hover:ring-8 hover:ring-yellow-400"
                    >
                        OK
                    </button>
                </div>
            </div>
        );
    };

    if (currentScreen === 'HOME') {
        return (
            <div className="bg-slate-950 text-white w-screen h-screen flex flex-col font-sans select-none overflow-hidden relative">
                <GlobalAlertModal />

                {showTimePicker && (
                    <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center backdrop-blur-md animate-fade-in">
                        <div className="bg-slate-900 p-12 rounded-[3rem] border-2 border-slate-700 w-[600px] text-center shadow-2xl">
                            <h3 className="text-4xl font-black mb-10 text-blue-400">Set Wake-up Time</h3>
                            <div className="flex justify-center items-center gap-6 mb-12">
                                <div className="flex flex-col items-center gap-4">
                                    <button tabIndex={0} onClick={incHour} onKeyDown={(e) => handleKeyClick(e, incHour)} className="text-4xl p-4 bg-slate-800 rounded-md focus:outline-none focus:ring-8 focus:ring-yellow-400 hover:bg-slate-700 transition-all">▲</button>
                                    <div className="text-7xl font-black w-24 text-center">{String(mcHour).padStart(2, '0')}</div>
                                    <button tabIndex={0} onClick={decHour} onKeyDown={(e) => handleKeyClick(e, decHour)} className="text-4xl p-4 bg-slate-800 rounded-md focus:outline-none focus:ring-8 focus:ring-yellow-400 hover:bg-slate-700 transition-all">▼</button>
                                </div>
                                <div className="text-7xl font-black pb-20">:</div>
                                <div className="flex flex-col items-center gap-4">
                                    <button tabIndex={0} onClick={incMin} onKeyDown={(e) => handleKeyClick(e, incMin)} className="text-4xl p-4 bg-slate-800 rounded-md focus:outline-none focus:ring-8 focus:ring-yellow-400 hover:bg-slate-700 transition-all">▲</button>
                                    <div className="text-7xl font-black w-24 text-center">{String(mcMinute).padStart(2, '0')}</div>
                                    <button tabIndex={0} onClick={decMin} onKeyDown={(e) => handleKeyClick(e, decMin)} className="text-4xl p-4 bg-slate-800 rounded-md focus:outline-none focus:ring-8 focus:ring-yellow-400 hover:bg-slate-700 transition-all">▼</button>
                                </div>
                                <div className="flex flex-col items-center justify-center h-full ml-4">
                                    <button tabIndex={0} onClick={toggleAmPm} onKeyDown={(e) => handleKeyClick(e, toggleAmPm)} className="text-4xl font-black p-8 bg-blue-900 text-blue-200 rounded-md focus:outline-none focus:ring-8 focus:ring-yellow-400 hover:bg-blue-800 transition-all">
                                        {mcAmPm}
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <button tabIndex={0} onClick={handleSaveWakeup} onKeyDown={(e) => handleKeyClick(e, handleSaveWakeup)} className="bg-blue-600 py-6 rounded-md text-2xl font-bold hover:bg-blue-500 focus:outline-none focus:ring-8 focus:ring-yellow-400 shadow-lg">Confirm</button>
                                <button tabIndex={0} onClick={() => setShowTimePicker(false)} onKeyDown={(e) => handleKeyClick(e, () => setShowTimePicker(false))} className="bg-slate-700 py-6 rounded-md text-2xl font-bold hover:bg-slate-600 focus:outline-none focus:ring-8 focus:ring-yellow-400">Cancel</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-start p-8 px-12 z-20 absolute top-0 left-0 w-full bg-gradient-to-b from-black/80 to-transparent h-48 pointer-events-none">
                    <div className="pointer-events-auto">
                        <div className="text-2xl font-bold tracking-widest text-slate-300 mb-1">HOTEL LOGO</div>
                        <h1 className="text-5xl font-light drop-shadow-lg leading-tight mt-2">{t.welcome}, <br /><span className="font-bold text-blue-400">{guestInfo.name}</span></h1>
                    </div>
                    <div className="flex flex-col items-end pointer-events-auto">
                        <div className="flex gap-2 mb-4">
                            {['EN', 'KR', 'CN', 'JP'].map(l => (
                                <button key={l} tabIndex={0} onClick={() => setLanguage(l)} onKeyDown={(e) => handleKeyClick(e, () => setLanguage(l))}
                                    className={`px-3 py-1 rounded text-sm font-bold border transition-colors focus:outline-none focus:ring-4 focus:ring-yellow-400 ${language === l ? 'bg-blue-600 border-blue-600 text-white' : 'bg-black/30 border-slate-600 text-slate-300 hover:bg-black/50'}`}>
                                    {l}
                                </button>
                            ))}
                        </div>
                        <button tabIndex={0} onClick={() => navigate('/')} onKeyDown={(e) => handleKeyClick(e, () => navigate('/'))} className="text-slate-300 hover:text-white border border-slate-500 px-4 py-2 rounded bg-black/30 backdrop-blur-sm transition-all text-sm mb-4 focus:outline-none focus:ring-4 focus:ring-yellow-400">{t.exit}</button>
                        <p className="text-lg text-slate-300 drop-shadow-md text-right max-w-md">{t.selectOption}</p>
                    </div>
                </div>

                <div className="flex flex-1 h-full w-full">
                    {menuSections.map((section, index) => (
                        <div key={section.id}
                            onMouseEnter={() => setActiveIndex(index)}
                            tabIndex={section.id !== 'checkout' ? 0 : -1}
                            onFocus={() => setActiveIndex(index)}
                            onClick={() => { if (section.id !== 'checkout') { section.screen ? setCurrentScreen(section.screen) : section.action(); } }}
                            onKeyDown={(e) => { if (section.id !== 'checkout') { handleKeyClick(e, () => section.screen ? setCurrentScreen(section.screen) : section.action()); } }}
                            className={`relative h-full bg-cover bg-center transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] ${section.id !== 'checkout' ? 'cursor-pointer focus:outline-none focus:ring-[12px] focus:ring-yellow-400 focus:z-50' : ''} flex items-end overflow-hidden group ${activeIndex === index ? 'flex-[6]' : 'flex-[1]'} bg-slate-800`}
                            style={{ backgroundImage: section.id !== 'checkout' ? section.bgImage : 'none', padding: section.id === 'checkout' ? 0 : '2.5rem' }}>

                            {section.id !== 'checkout' && (
                                <div className={`absolute inset-0 bg-slate-950 transition-opacity duration-700 ${activeIndex === index ? 'opacity-30' : 'opacity-85'}`}></div>
                            )}

                            {section.id === 'checkout' ? (
                                <div className={`absolute inset-0 flex flex-col z-10 transition-opacity duration-500 ${activeIndex === index ? 'opacity-100 delay-200' : 'opacity-0 pointer-events-none'}`}>
                                    <div tabIndex={activeIndex === index ? 0 : -1} onClick={() => setShowTimePicker(true)} onKeyDown={(e) => handleKeyClick(e, () => setShowTimePicker(true))}
                                        className="relative h-1/4 border-b border-white/20 flex items-center px-16 cursor-pointer group/btn overflow-hidden focus:outline-none focus:ring-8 focus:ring-yellow-400 focus:z-50">
                                        <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover/btn:scale-105" style={{ backgroundImage: dbSettings.morning ? `url(${dbSettings.morning})` : 'url(https://images.unsplash.com/photo-1496661415325-ef8d19f8d7b8?q=80&w=1920)' }}></div>
                                        <div className="absolute inset-0 bg-slate-900/60 group-hover/btn:bg-blue-900/70 transition-colors duration-300"></div>
                                        <div className="relative z-10 flex items-center w-full">
                                            <div className="text-5xl mr-8 group-hover/btn:scale-110 transition-transform">⏰</div>
                                            <div>
                                                <h3 className="text-4xl font-bold mb-1 drop-shadow-lg text-white">Morning Call</h3>
                                                <p className="text-xl text-slate-300 font-light">{wakeupTime ? <span className="text-blue-300 font-bold">Scheduled: {wakeupTime}</span> : 'Touch to set time'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div tabIndex={activeIndex === index ? 0 : -1} onClick={handleToggleMakeup} onKeyDown={(e) => handleKeyClick(e, handleToggleMakeup)}
                                        className="relative h-1/4 border-b border-white/20 flex items-center px-16 cursor-pointer group/btn overflow-hidden focus:outline-none focus:ring-8 focus:ring-yellow-400 focus:z-50">
                                        <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover/btn:scale-105" style={{ backgroundImage: dbSettings.makeup ? `url(${dbSettings.makeup})` : 'url(https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1920)' }}></div>
                                        <div className="absolute inset-0 bg-slate-900/60 group-hover/btn:bg-orange-900/70 transition-colors duration-300"></div>
                                        <div className="relative z-10 flex items-center w-full">
                                            <div className="text-5xl mr-8 group-hover/btn:scale-110 transition-transform">🧹</div>
                                            <div>
                                                <h3 className="text-4xl font-bold mb-1 drop-shadow-lg text-white">Make Up Room</h3>
                                                <p className="text-xl text-slate-300 font-light">{isMakeupRequested ? <span className="text-orange-300 font-bold">Housekeeping Notified</span> : 'Touch to request cleaning'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div tabIndex={activeIndex === index ? 0 : -1} onClick={() => setCurrentScreen('CHECKOUT')} onKeyDown={(e) => handleKeyClick(e, () => setCurrentScreen('CHECKOUT'))}
                                        className="relative h-1/2 flex items-center px-16 cursor-pointer group/btn overflow-hidden focus:outline-none focus:ring-8 focus:ring-yellow-400 focus:z-50">
                                        <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover/btn:scale-105" style={{ backgroundImage: dbSettings.bill ? `url(${dbSettings.bill})` : 'url(https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=1920)' }}></div>
                                        <div className="absolute inset-0 bg-slate-900/60 group-hover/btn:bg-slate-800/80 transition-colors duration-300"></div>
                                        <div className="relative z-10 flex items-center w-full">
                                            <div className="text-6xl mr-8 group-hover/btn:scale-110 transition-transform">🧾</div>
                                            <div>
                                                <h3 className="text-5xl font-bold mb-2 drop-shadow-lg text-white">My Bill & Checkout</h3>
                                                <p className="text-2xl text-slate-300 font-light">Review charges and request services.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className={`relative z-10 transition-all duration-500 ${activeIndex === index ? 'opacity-100 translate-y-0 delay-200' : 'opacity-0 translate-y-8'}`}>
                                    <div>
                                        <h2 className="text-6xl font-bold mb-3 drop-shadow-2xl whitespace-nowrap text-white">{section.title}</h2>
                                        <p className="text-3xl text-slate-200 drop-shadow-lg whitespace-nowrap">{section.desc}</p>
                                    </div>
                                </div>
                            )}

                            <h2 className={`text-4xl font-bold text-slate-400/80 drop-shadow-lg whitespace-nowrap transform -rotate-90 origin-bottom-left absolute bottom-16 left-10 transition-opacity duration-300 ${activeIndex === index ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                {section.title}
                            </h2>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (currentScreen === 'CHECKOUT') {
        return (
            <div className="bg-slate-900 text-white w-screen h-screen flex flex-col font-sans p-10 relative">
                <GlobalAlertModal />

                {showQrModal && (
                    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center backdrop-blur-md animate-fade-in">
                        <div className="bg-slate-800 p-10 rounded-md border border-slate-600 w-[500px] text-center shadow-2xl flex flex-col items-center">
                            <h3 className="text-3xl font-bold mb-4 text-white">Scan to Pay</h3>
                            <p className="text-slate-400 mb-6">Use GCash or Maya to scan the QR code.</p>

                            <div className="bg-white p-4 rounded-md mb-8">
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=Room_${cleanRoomNumber}_Payment`} alt="QR Code" className="w-48 h-48" />
                            </div>

                            <button
                                autoFocus tabIndex={0}
                                onClick={() => { setShowQrModal(false); setMakeupModalMsg("Payment Processing... Please wait."); setTimeout(() => setMakeupModalMsg(""), 3000); }}
                                onKeyDown={(e) => handleKeyClick(e, () => { setShowQrModal(false); setMakeupModalMsg("Payment Processing..."); })}
                                className="bg-blue-600 text-white py-4 px-12 rounded-md text-xl font-bold transition-all focus:outline-none focus:ring-8 focus:ring-yellow-400 hover:ring-8 hover:ring-yellow-400"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}

                <button tabIndex={0} onClick={() => setCurrentScreen('HOME')} onKeyDown={(e) => handleKeyClick(e, () => setCurrentScreen('HOME'))} className="absolute top-10 left-10 bg-slate-800 border border-slate-600 hover:bg-slate-700 px-8 py-3 rounded-md text-lg font-bold transition-all z-20 shadow-lg focus:outline-none focus:ring-4 focus:ring-yellow-400">⬅ Back to Home</button>
                <div className="flex-1 flex flex-col gap-8 mt-16 max-w-6xl mx-auto w-full animate-fade-in">
                    <div className="flex-1 bg-slate-800/80 rounded-[3rem] border border-slate-700 p-10 flex flex-col shadow-2xl backdrop-blur-md relative overflow-hidden mt-10">
                        <h2 className="text-4xl font-black mb-6 flex items-center gap-3 border-b border-slate-600 pb-4"><span>🧾</span> Your Folio (Room Bill)</h2>
                        <div className="flex-1 overflow-y-auto pr-4 mb-6">{folioItems.length === 0 ? (<div className="h-full flex items-center justify-center text-2xl text-slate-500">No charges yet.</div>) : (<table className="w-full text-left text-2xl"><thead className="text-slate-400 font-bold border-b border-slate-600"><tr><th className="pb-4 pl-2">Item</th><th className="pb-4 pr-2 text-right">Price</th></tr></thead><tbody className="divide-y divide-slate-600/50">{folioItems.map((item, idx) => (<tr key={idx}><td className="py-4 pl-2 text-slate-200">{item.description}</td><td className="py-4 pr-2 text-right font-bold">₱{item.amount.toLocaleString()}</td></tr>))}</tbody></table>)}</div>

                        <div className="bg-slate-900/50 p-8 rounded-md border border-slate-600 flex justify-between items-center">
                            <div>
                                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">Total Outstanding</p>
                                <div className="text-5xl font-black text-blue-400">₱{roomBalance.toLocaleString()}</div>
                            </div>

                            <div className="flex gap-4">
                                {roomBalance > 0 ? (
                                    <>
                                        <button tabIndex={0} onClick={() => setShowQrModal(true)} onKeyDown={(e) => handleKeyClick(e, () => setShowQrModal(true))} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-5 rounded-md font-bold text-xl shadow-lg transition-all focus:outline-none focus:ring-8 focus:ring-yellow-400">
                                            📱 Pay via QR
                                        </button>
                                        <button disabled className="bg-slate-700 text-slate-400 px-8 py-5 rounded-md font-bold text-xl cursor-not-allowed border border-slate-600">
                                            Pay at Front Desk
                                        </button>
                                    </>
                                ) : (
                                    <button tabIndex={0} onClick={handleCheckout} onKeyDown={(e) => handleKeyClick(e, handleCheckout)} className="bg-green-600 hover:bg-green-500 text-white px-12 py-5 rounded-md font-black text-2xl shadow-lg transition-all focus:outline-none focus:ring-8 focus:ring-yellow-400">
                                        Express Check-out
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (currentScreen === 'ORDER_SCREEN') {
        const items = activeOrderConfig.menuData;

        const categories = ['All', ...new Set(items.map(item => item.category))].filter(Boolean);
        const filteredItems = activeCategory === 'All' ? items : items.filter(m => m.category === activeCategory);

        return (
            <div className="bg-slate-900 text-slate-800 w-screen h-screen flex p-8 gap-8 font-sans select-none overflow-hidden">
                <GlobalAlertModal />

                {sizeModalData && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 w-full max-w-2xl border border-slate-200">
                            <h3 className="text-4xl font-black mb-2 text-slate-800">{sizeModalData.name}</h3>
                            <p className="text-xl text-slate-500 mb-8 font-bold">Please select an option below.</p>
                            <div className="space-y-4">
                                {sizeModalData.sizes.map((size, idx) => (
                                    <button
                                        key={idx} tabIndex={0}
                                        onClick={() => addToCart(sizeModalData, size)}
                                        onKeyDown={(e) => handleKeyClick(e, () => addToCart(sizeModalData, size))}
                                        className="w-full flex justify-between items-center p-6 border-2 border-slate-200 bg-white rounded-md hover:border-blue-500 hover:bg-blue-50 transition-all group focus:outline-none focus:ring-8 focus:ring-yellow-400"
                                    >
                                        <span className="font-bold text-2xl text-slate-700 group-hover:text-blue-700">{size.name}</span>
                                        <span className="font-black text-2xl text-slate-800 group-hover:text-blue-700">₱{parseFloat(size.price).toLocaleString()}</span>
                                    </button>
                                ))}
                            </div>
                            <button
                                tabIndex={0} onClick={() => setSizeModalData(null)} onKeyDown={(e) => handleKeyClick(e, () => setSizeModalData(null))}
                                className="w-full mt-8 py-5 bg-slate-100 text-slate-600 text-xl font-bold rounded-md hover:bg-slate-200 transition-colors focus:outline-none focus:ring-8 focus:ring-yellow-400"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex-1 flex flex-col bg-slate-50 rounded-[2.5rem] p-8 shadow-inner relative overflow-hidden border-4 border-slate-200">
                    <div className="flex justify-between items-center mb-6 shrink-0">
                        <div className="flex items-center gap-4 w-full">
                            <button tabIndex={0} onClick={() => setCurrentScreen('HOME')} onKeyDown={(e) => handleKeyClick(e, () => setCurrentScreen('HOME'))} className="bg-white border-2 border-slate-300 text-slate-700 px-6 py-2.5 rounded-md font-bold shadow-sm flex items-center gap-2 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-4 focus:ring-yellow-400 text-xl">⬅ Back</button>
                            <h2 className="text-3xl font-black text-slate-800 bg-white px-6 py-2.5 rounded-md shadow-sm border border-slate-200 truncate">{activeOrderConfig.title}</h2>
                        </div>
                    </div>

                    <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide shrink-0">
                        {categories.map(cat => (
                            <button key={cat} onClick={() => setActiveCategory(cat)}
                                className={`px-8 py-3 rounded-md font-bold whitespace-nowrap transition-all shadow-sm text-lg border-2 focus:outline-none focus:ring-4 focus:ring-yellow-400 ${activeCategory === cat ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pr-2 pb-10">
                        {filteredItems.length === 0 ? (
                            <div className="col-span-full text-center text-slate-400 py-20 text-3xl font-bold">No items available.</div>
                        ) : (
                            filteredItems.map((item, i) => {
                                let itemImage = item.image_url;
                                try {
                                    const parsedImgs = JSON.parse(item.image_url);
                                    if (Array.isArray(parsedImgs) && parsedImgs.length > 0) itemImage = parsedImgs[0];
                                } catch (e) { }

                                return (
                                    <div key={item.id} tabIndex={0} onClick={() => handleItemClick(item)} onKeyDown={(e) => handleKeyClick(e, () => handleItemClick(item))}
                                        className="bg-white rounded-[2rem] shadow-sm overflow-hidden border-[3px] border-slate-200 transition-all hover:shadow-lg cursor-pointer group flex flex-col focus:outline-none focus:ring-8 focus:ring-yellow-400 hover:border-blue-400 relative">

                                        {item.is_recommended == 1 && <div className="absolute top-0 right-0 bg-yellow-400 text-white text-sm font-black px-4 py-2 rounded-bl-2xl z-10 shadow-sm">⭐ BEST</div>}

                                        <div className="relative shrink-0 bg-slate-100 flex justify-center items-center h-40 lg:h-48 overflow-hidden">
                                            {itemImage ? (
                                                <img src={itemImage} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            ) : (
                                                <div className="text-6xl group-hover:scale-110 transition-transform duration-300">{item.img || '🍽️'}</div>
                                            )}
                                        </div>

                                        <div className="p-5 flex-1 flex flex-col justify-between bg-white z-10">
                                            <h3 className="font-bold text-slate-800 text-xl leading-tight mb-3 line-clamp-2">{item.name}</h3>
                                            <div className="flex justify-between items-end mt-auto">
                                                <p className="text-blue-600 font-black text-2xl">₱{item.displayPrice.toLocaleString()}</p>
                                                <div className="w-12 h-12 flex items-center justify-center rounded-md bg-slate-100 text-blue-600 font-black shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors text-2xl">+</div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                <div className="w-[400px] lg:w-[480px] bg-slate-800 text-white rounded-[2.5rem] p-8 flex flex-col shadow-2xl border-[4px] border-slate-700 h-full shrink-0">
                    <h2 className="text-3xl font-bold mb-4 border-b border-slate-600 pb-4">🛒 Your Request</h2>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                        {cart.length === 0 ? (
                            <div className="text-center opacity-30 mt-40 text-2xl">List is empty</div>
                        ) : (
                            cart.map((item) => (
                                <div key={item.cartId} className="flex justify-between items-center text-lg bg-slate-700 p-5 rounded-md border border-slate-600 shadow-sm gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate text-slate-200 font-bold text-xl">
                                            {item.displayName}
                                            {item.quantity > 1 && <span className="text-blue-400 font-black ml-2">x{item.quantity}</span>}
                                        </div>
                                        {item.variantName && item.variantName.toLowerCase() !== 'regular' && (
                                            <div className="text-sm text-yellow-400 font-bold mt-1 bg-yellow-900/30 inline-block px-3 py-1 rounded-md border border-yellow-700/50">
                                                {item.variantName}
                                            </div>
                                        )}
                                    </div>
                                    <span className="font-black text-blue-300 text-2xl whitespace-nowrap">₱{(item.displayPrice * item.quantity).toLocaleString()}</span>

                                    <button tabIndex={0} onClick={(e) => { e.stopPropagation(); removeFromCart(item.cartId); }} onKeyDown={(e) => { e.stopPropagation(); handleKeyClick(e, () => removeFromCart(item.cartId)); }}
                                        className="w-10 h-10 flex items-center justify-center bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-md transition-colors font-black text-lg ml-2 flex-shrink-0 focus:outline-none focus:ring-4 focus:ring-yellow-400"
                                    >✕</button>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="border-t border-slate-600 pt-6 mt-4">
                        <div className="flex justify-between text-2xl font-bold mb-6"><span>Total:</span><span className="text-yellow-400 font-black text-4xl">₱{totalAmount.toLocaleString()}</span></div>
                        <button tabIndex={0} onClick={handlePayment} onKeyDown={(e) => handleKeyClick(e, handlePayment)} disabled={cart.length === 0}
                            className="w-full bg-blue-600 py-6 rounded-md text-2xl font-black text-white hover:bg-blue-500 disabled:opacity-50 transition-all shadow-lg focus:outline-none focus:ring-8 focus:ring-yellow-400 active:scale-95">
                            Confirm Order
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (currentScreen === 'SUCCESS') {
        return (
            <div className="bg-slate-900 text-white w-screen h-screen flex flex-col items-center justify-center">
                <div className="text-9xl mb-8 animate-bounce">✅</div>
                <h2 className="text-6xl font-black mb-4">Request Sent!</h2>
                <p className="text-2xl text-slate-400 mb-10">Our staff will process your request shortly.</p>
                <button autoFocus tabIndex={0} onClick={() => setCurrentScreen('HOME')} onKeyDown={(e) => handleKeyClick(e, () => setCurrentScreen('HOME'))} className="bg-slate-700 hover:bg-slate-600 px-12 py-5 rounded-md text-2xl font-bold shadow-lg transition-all focus:outline-none focus:ring-8 focus:ring-yellow-400">Back to Home</button>
            </div>
        );
    }

    return null;
}