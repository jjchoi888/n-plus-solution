import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function Kitchen() {
    const { id } = useParams();

    // 💡 [핵심 해결 1] KDS도 자신이 속한 지점 코드(hotel_code)를 절대 잊지 않도록 가져옵니다!
    const currentHotelCode = sessionStorage.getItem('hotelCode') || localStorage.getItem('hotelCode') || '';

    const [storeInfo, setStoreInfo] = useState({ name: `Loading...`, id: null, type: 'Restaurant', is_room_linked: 0 });
    const [orders, setOrders] = useState([]);
    const [kdsDoneActiveOrders, setKdsDoneActiveOrders] = useState([]);

    const [isAlarmRinging, setIsAlarmRinging] = useState(false);
    const previousItemCount = useRef(-1);
    const orderReceivedTimes = useRef({});

    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 10000);
        return () => clearInterval(timer);
    }, []);

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [historyData, setHistoryData] = useState([]);

    const getLocalDateString = () => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const [historyStartDate, setHistoryStartDate] = useState(getLocalDateString());
    const [historyEndDate, setHistoryEndDate] = useState(getLocalDateString());

    const [alarmVolume, setAlarmVolume] = useState(parseFloat(localStorage.getItem('kds_vol')) || 0.5);
    const [selectedRingtone, setSelectedRingtone] = useState(localStorage.getItem('kds_ring') || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

    const parseDate = (val) => {
        if (!val) return null;
        if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
        const str = String(val).trim();
        if (str.startsWith('0000') || str === 'null') return null;
        let d = new Date(str);
        if (!isNaN(d.getTime())) return d;
        d = new Date(str.replace(' ', 'T'));
        if (!isNaN(d.getTime())) return d;
        const cleanStr = str.replace(/-/g, '/').replace('T', ' ').split('.')[0].replace('Z', '');
        d = new Date(cleanStr);
        return isNaN(d.getTime()) ? null : d;
    };

    const extractStableDate = (order) => {
        if (!order) return new Date();
        const lockKey = `kds_time_lock_${order.id || 'new'}_${order.table_number}_${order.total_amount}`;
        const lockedTime = localStorage.getItem(lockKey);
        if (lockedTime) return new Date(lockedTime);

        let d = null;
        const possibleFields = ['created_at', 'updated_at', 'completed_at', 'date', 'timestamp', 'receivedTime'];
        for (let f of possibleFields) {
            if (order[f]) {
                d = parseDate(order[f]);
                if (d) break;
            }
        }
        if (!d) d = new Date();
        localStorage.setItem(lockKey, d.toISOString());
        return d;
    };

    useEffect(() => {
        const audioEl = document.getElementById('kds-alarm-audio');
        if (audioEl) {
            audioEl.volume = alarmVolume;
            if (isAlarmRinging) {
                audioEl.loop = true;
                audioEl.play().catch(() => { });
            } else {
                audioEl.pause();
                audioEl.currentTime = 0;
            }
        }
    }, [isAlarmRinging, alarmVolume, selectedRingtone]);

    const testAlarm = () => {
        const audioEl = document.getElementById('kds-alarm-audio');
        if (audioEl) {
            audioEl.loop = false;
            audioEl.volume = alarmVolume;
            audioEl.currentTime = 0;
            audioEl.play().catch(() => { });
        }
    };

    useEffect(() => {
        // 💡 [핵심 해결 2] 지점 코드를 달아서 정보를 정확히 가져옵니다.
        fetch(`/api/store/location/${id}?hotel=${currentHotelCode}`)
            .then(res => res.json())
            .then(data => { if (data.success) setStoreInfo(data.store); });
    }, [id, currentHotelCode]);

    const fetchOrders = () => {
        if (!storeInfo.id) return;
        // 💡 [핵심 해결 3] 주문 목록을 가져올 때도 지점 코드를 반드시 보냅니다!
        fetch(`/api/tables/${storeInfo.id}?hotel=${currentHotelCode}`)
            .then(res => res.json())
            .then(data => {
                const activeList = [];
                const completedList = [];
                let totalItemsInActive = 0;

                if (Array.isArray(data)) {
                    data.forEach(order => {
                        let items = [];
                        try { items = typeof order.cart_data === 'string' ? JSON.parse(order.cart_data) : (order.cart_data || []); } catch (e) { }
                        const isAllDone = items.length > 0 && items.every(i => i.kdsStatus === 'Done' || i.kdsDone);

                        if (!orderReceivedTimes.current[order.table_number]) {
                            orderReceivedTimes.current[order.table_number] = parseDate(order.created_at || order.updated_at) || new Date();
                        }

                        const processedOrder = { ...order, items, receivedTime: orderReceivedTimes.current[order.table_number] };

                        if (isAllDone) {
                            completedList.push(processedOrder);
                        } else {
                            activeList.push(processedOrder);
                            totalItemsInActive += items.length;
                        }
                    });
                }

                const activeTableNums = activeList.map(o => String(o.table_number));
                Object.keys(orderReceivedTimes.current).forEach(tNum => {
                    if (!activeTableNums.includes(String(tNum))) delete orderReceivedTimes.current[tNum];
                });

                if (previousItemCount.current !== -1 && totalItemsInActive > previousItemCount.current) {
                    setIsAlarmRinging(true);
                }
                previousItemCount.current = totalItemsInActive;

                setOrders(activeList);
                setKdsDoneActiveOrders(completedList);
            })
            .catch(err => console.error("KDS Fetch Error:", err));
    };

    useEffect(() => {
        if (storeInfo.id) {
            // 1. 주방 화면을 처음 열었을 때 주문 목록 호출
            fetchOrders();

            // 💡 2. [웹소켓 엔진] 무식한 4초 타이머를 버리고, POS에서 결제/주문을 홀딩할 때만 즉시 반응!
            const socketUrl = import.meta.env.VITE_API_URL || 'https://api.hotelnplus.com';
            const socket = io(socketUrl, { transports: ['websocket'] });
            
            socket.on('db_updated', (data) => {
                if (data.hotel_code === currentHotelCode || data.hotel_code === 'ALL') {
                    fetchOrders();
                }
            });

            return () => socket.disconnect();
        }
    }, [storeInfo.id, currentHotelCode]);

    const setItemStatus = async (tableNumber, cartData, itemIndex, totalAmount, newStatus) => {
        const updatedCart = [...cartData];
        updatedCart[itemIndex].kdsStatus = newStatus;
        updatedCart[itemIndex].kdsDone = (newStatus === 'Done');

        // 💡 [핵심 해결 4] KDS에서 조리 상태를 바꿀 때도 지점 코드를 담아서 보냅니다!
        await fetch('/api/tables/save', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                store_id: storeInfo.id,
                table_number: tableNumber,
                cart_data: updatedCart,
                total_amount: totalAmount,
                user_id: 'KDS_OPERATOR',
                hotel_code: currentHotelCode // 👈 여기 추가됨
            })
        });
        fetchOrders();
    };

    const handleOpenHistory = async () => {
        try {
            // 💡 [핵심 해결 5] 히스토리(과거 기록)를 열 때도 지점 코드를 보냅니다!
            const res = await fetch(`/api/tables/history/${storeInfo.id}?hotel=${currentHotelCode}`);
            const result = await res.json();

            let dbList = [];
            if (Array.isArray(result)) dbList = result;
            else if (result && Array.isArray(result.history)) dbList = result.history;
            else if (result && Array.isArray(result.data)) dbList = result.data;

            const combined = [...kdsDoneActiveOrders, ...dbList];

            const uniqueMap = new Map();
            combined.forEach(item => {
                const key = item.id ? item.id : `${item.table_number}_${item.total_amount}`;
                uniqueMap.set(key, item);
            });
            const finalData = Array.from(uniqueMap.values());

            finalData.sort((a, b) => {
                const timeA = extractStableDate(a) || new Date(0);
                const timeB = extractStableDate(b) || new Date(0);
                return timeB.getTime() - timeA.getTime();
            });

            setHistoryData(finalData);
            setShowHistoryModal(true);
        } catch (e) {
            setHistoryData([...kdsDoneActiveOrders]);
            setShowHistoryModal(true);
        }
    };

    const filteredHistory = historyData.filter(order => {
        const d = extractStableDate(order);
        if (!d) return true;

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const localDateStr = `${yyyy}-${mm}-${dd}`;

        if (historyStartDate && localDateStr < historyStartDate) return false;
        if (historyEndDate && localDateStr > historyEndDate) return false;
        return true;
    });

    const getActiveStyle = (status) => {
        switch (status) {
            case 'Preparation': return 'bg-yellow-500 text-yellow-900 shadow-lg scale-105';
            case 'Cook': return 'bg-orange-500 text-white shadow-lg scale-105 animate-pulse';
            case 'Served': return 'bg-blue-500 text-white shadow-lg scale-105';
            case 'On Process': return 'bg-purple-500 text-white shadow-lg scale-105 animate-pulse';
            case 'Confirmed': return 'bg-blue-500 text-white shadow-lg scale-105';
            case 'Done': return 'bg-green-600 text-white shadow-lg scale-105';
            default: return 'bg-slate-500 text-white shadow-lg scale-105';
        }
    };

    const typeStr = (storeInfo.type || '').toLowerCase();
    const isFnB = typeStr.includes('restaurant') || typeStr.includes('cafe') || typeStr.includes('bar');
    const statusSteps = isFnB ? ['Pending', 'Preparation', 'Cook', 'Served', 'Done'] : ['Pending', 'On Process', 'Confirmed', 'Done'];

    let kdsTitle = 'Main Kitchen'; let themeColor = 'text-orange-400'; let icon = '👨‍🍳';
    if (typeStr.includes('cafe')) { kdsTitle = 'Cafe Barista'; themeColor = 'text-purple-400'; icon = '☕'; }
    else if (typeStr.includes('bar')) { kdsTitle = 'Bar Station'; themeColor = 'text-pink-400'; icon = '🍸'; }
    else if (typeStr.includes('spa')) { kdsTitle = 'Spa Desk'; themeColor = 'text-teal-400'; icon = '💆'; }

    return (
        <div className={`p-4 md:p-6 font-sans min-h-screen transition-colors duration-700 ${isAlarmRinging ? 'bg-red-900' : 'bg-slate-900'} text-white relative`}>

            <audio id="kds-alarm-audio" src={selectedRingtone} preload="auto" />

            {isAlarmRinging && (
                <button
                    onClick={() => setIsAlarmRinging(false)}
                    className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-red-600 hover:bg-red-500 text-white font-black text-2xl md:text-4xl px-8 py-5 rounded-md shadow-[0_0_40px_rgba(220,38,38,0.9)] animate-pulse border-4 border-white flex flex-col items-center gap-1 transition-transform transform hover:scale-105"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-4xl md:text-5xl animate-bounce">🔔</span>
                        <span>STOP ALARM</span>
                    </div>
                    <span className="text-sm md:text-lg opacity-80 uppercase tracking-widest font-bold">New Order Arrived!</span>
                </button>
            )}

            {showSettingsModal && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-800 rounded-md p-6 md:p-8 w-full max-w-md border border-slate-600 shadow-2xl">
                        <div className="flex justify-between items-center mb-6 text-white"><h3 className="text-xl font-black flex items-center gap-2"><span>🔔</span> Alarm Settings</h3><button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-white text-xl">✕</button></div>
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-slate-400 block mb-2 uppercase">Select Notification Tone</label>
                                <select value={selectedRingtone} onChange={(e) => { setSelectedRingtone(e.target.value); localStorage.setItem('kds_ring', e.target.value); }} className="w-full p-3 rounded-md bg-slate-700 border border-slate-600 font-bold text-white outline-none cursor-pointer">
                                    <option value="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3">Digital Chime (Soft)</option>
                                    <option value="https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3">Service Bell (Classic)</option>
                                    <option value="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3">Fast Beep (Urgent)</option>
                                    <option value="https://assets.mixkit.co/active_storage/sfx/2190/2190-preview.mp3">Kitchen Whistle</option>
                                    <option value="https://www.soundjay.com/buttons/beep-07.mp3">Standard Ping</option>
                                    <option value="https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3">Twinkle Success</option>
                                    <option value="https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3">Deep Alert Pulse</option>
                                    <option value="https://assets.mixkit.co/active_storage/sfx/1987/1987-preview.mp3">Short Notice</option>
                                    <option value="https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3">Reception Desk</option>
                                    <option value="https://assets.mixkit.co/active_storage/sfx/1830/1830-preview.mp3">Electronic Buzz</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 block mb-2 flex justify-between uppercase"><span>Volume Control</span><span>{Math.round(alarmVolume * 100)}%</span></label>
                                <input type="range" min="0" max="1" step="0.1" value={alarmVolume} onChange={(e) => { setAlarmVolume(parseFloat(e.target.value)); localStorage.setItem('kds_vol', e.target.value); }} className="w-full h-2 bg-slate-700 rounded-md appearance-none cursor-pointer accent-orange-500" />
                            </div>
                            <button onClick={testAlarm} className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-md font-bold border border-slate-500 transition-colors shadow-md">▶️ Test Sound</button>
                            <button onClick={() => setShowSettingsModal(false)} className="w-full bg-orange-500 hover:bg-orange-600 py-3 rounded-md font-black mt-2 shadow-lg transition-all">Save & Close</button>
                        </div>
                    </div>
                </div>
            )}

            {showHistoryModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in text-white">
                    <div className="bg-slate-800 rounded-[2rem] shadow-2xl p-5 md:p-8 w-full max-w-5xl h-[90vh] md:h-[85vh] flex flex-col border border-slate-600">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl md:text-3xl font-black flex items-center gap-2">📜 Order History</h3>
                            <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-red-400 text-2xl bg-slate-700 w-10 h-10 rounded-md flex items-center justify-center transition-colors">✕</button>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-slate-700 p-4 rounded-md border border-slate-600">
                            <div className="flex-1"><label className="text-xs font-bold text-slate-400 block mb-1 uppercase">Start Date</label><input type="date" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)} className="w-full p-2.5 border border-slate-600 rounded-md font-bold text-white bg-slate-800 outline-none text-sm cursor-pointer" /></div>
                            <div className="flex-1"><label className="text-xs font-bold text-slate-400 block mb-1 uppercase">End Date</label><input type="date" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)} className="w-full p-2.5 border border-slate-600 rounded-md font-bold text-white bg-slate-800 outline-none text-sm cursor-pointer" /></div>
                        </div>
                        <div className="flex-1 overflow-auto border border-slate-600 rounded-md bg-slate-900 shadow-inner">
                            <table className="w-full text-left text-sm whitespace-nowrap min-w-[500px]">
                                <thead className="bg-slate-800 sticky top-0 shadow-sm z-10 border-b border-slate-700">
                                    <tr><th className="p-4 text-slate-300 font-bold uppercase tracking-wider">Order Time</th><th className="p-4 text-slate-300 font-bold uppercase tracking-wider">Target</th><th className="p-4 text-slate-300 font-bold uppercase tracking-wider">Processed Items</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {filteredHistory.length === 0 ? (
                                        <tr><td colSpan="3" className="text-center py-20 text-slate-400 font-bold text-lg bg-slate-900">No records found.</td></tr>
                                    ) : (
                                        filteredHistory.map((order, idx) => {
                                            let its = []; try { its = typeof order.cart_data === 'string' ? JSON.parse(order.cart_data) : (order.cart_data || []); } catch (e) { }
                                            const histTime = extractStableDate(order);

                                            return (
                                                <tr key={idx} className="hover:bg-slate-800 transition-colors">
                                                    <td className="p-4 font-mono text-slate-400 text-xs md:text-sm">
                                                        {histTime ? histTime.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Error'}
                                                    </td>
                                                    <td className="p-4 font-black text-base md:text-lg text-orange-400">{storeInfo.is_room_linked ? 'Room' : 'Table'} {order.table_number}</td>
                                                    <td className="p-4">
                                                        <ul className="text-xs md:text-sm text-slate-200 space-y-1">
                                                            {(its || []).map((it, i) => <li key={i} className="flex gap-2 items-center"><span>{it.name}</span>{it.selectedSize && it.selectedSize !== 'Regular' && <span className="bg-slate-700 px-1 rounded text-[10px]">{it.selectedSize}</span>}<span className="text-blue-400 font-black">x{it.quantity}</span></li>)}
                                                        </ul>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-700 pb-4 gap-4 md:gap-0">
                <div>
                    <h1 className={`text-2xl md:text-4xl font-black ${themeColor} flex items-center gap-2 md:gap-3`}>
                        <span>{icon}</span> {storeInfo.name} <span className="hidden md:inline">-</span> <span className="text-xl md:text-4xl text-slate-300 md:text-inherit">{kdsTitle}</span>
                    </h1>
                    <p className="text-slate-400 font-bold mt-1 md:mt-2 tracking-widest text-[10px] md:text-sm uppercase">
                        {currentTime.toLocaleDateString('en-US')} {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
                <div className="flex gap-2 md:gap-3 w-full md:w-auto">
                    <button onClick={() => setShowSettingsModal(true)} className="flex-1 md:flex-none justify-center bg-slate-700 hover:bg-slate-600 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-md font-bold transition-all shadow-md flex items-center gap-2 text-xs md:text-base border border-slate-600"><span>⚙️</span> Settings</button>
                    <button onClick={handleOpenHistory} className="flex-1 md:flex-none justify-center bg-slate-700 hover:bg-slate-600 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-md font-bold transition-all shadow-md flex items-center gap-2 text-xs md:text-base border border-slate-600"><span>📜</span> History</button>
                    <Link to="/" className="flex-1 md:flex-none justify-center bg-slate-700 hover:bg-slate-600 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-md font-bold transition-all shadow-md flex items-center gap-2 text-xs md:text-base border border-slate-600 text-center">🏠 Exit</Link>
                </div>
            </div>

            {orders.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-[60vh] text-slate-500 opacity-60 px-4 text-center">
                    <div className="text-5xl md:text-6xl mb-4">{icon}</div>
                    <div className="text-xl md:text-2xl font-bold animate-pulse">Waiting for orders...</div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 pb-4 items-start">
                    {orders.map((order) => {
                        let items = order.items || [];
                        const isAllDone = items.length > 0 && items.every(i => i.kdsStatus === 'Done' || i.kdsDone);

                        const orderTimeObj = order.receivedTime;
                        const diffMins = orderTimeObj ? Math.floor(Math.max(0, (currentTime.getTime() - orderTimeObj.getTime()) / 60000)) : 0;
                        const timerColor = diffMins >= 15 ? 'text-red-500 animate-pulse' : diffMins >= 5 ? 'text-orange-400' : 'text-green-400';

                        return (
                            <div key={order.id} className={`bg-slate-800 rounded-md p-4 md:p-6 shadow-2xl border-t-8 transition-all relative overflow-hidden flex flex-col min-h-[350px] ${isAllDone ? 'border-slate-600 opacity-60' : 'border-orange-500'}`}>
                                <div className="flex justify-between items-start border-b border-slate-600 pb-3 md:pb-4 mb-3 md:mb-4">
                                    <span className="text-2xl md:text-3xl font-black text-white">{storeInfo.is_room_linked === 1 ? 'Room' : 'Table'} {order.table_number}</span>
                                    <div className="flex flex-col items-end">
                                        <span className={`text-[10px] md:text-xs font-bold px-2.5 py-1 md:px-3 md:py-1 rounded-md shadow-inner mb-1 bg-orange-500/20 text-orange-400`}>
                                            ⏰ {orderTimeObj ? orderTimeObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'NEW'}
                                        </span>
                                        {!isAllDone && <span className={`text-sm md:text-base font-black tracking-widest ${timerColor}`}>⏳ {diffMins} min</span>}
                                    </div>
                                </div>

                                <ul className="space-y-3 md:space-y-4 mb-4 md:mb-6 flex-1">
                                    {items.map((item, idx) => {
                                        const currentStatus = item.kdsStatus || (item.kdsDone ? 'Done' : 'Pending');
                                        const isDone = currentStatus === 'Done';
                                        return (
                                            <li key={idx} className={`p-3 md:p-4 rounded-md transition-all border-2 flex flex-col gap-2 md:gap-3 ${isDone ? 'bg-slate-900 border-slate-700 text-slate-500 opacity-70' : 'bg-slate-700 border-slate-600 text-white shadow-md'}`}>
                                                <div className="flex justify-between items-start w-full">
                                                    <div className="flex-1 pr-2 truncate">
                                                        <div className={`font-bold text-base md:text-lg leading-tight ${isDone ? 'line-through text-slate-500' : ''}`}>{item.name}</div>
                                                        {item.selectedSize && item.selectedSize !== 'Regular' && <div className="text-[10px] md:text-xs font-bold text-blue-300">{item.selectedSize}</div>}
                                                    </div>
                                                    <div className={`text-xl md:text-2xl font-black ${isDone ? 'text-slate-600' : 'text-orange-400'}`}>x{item.quantity}</div>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 w-full mt-1 bg-slate-800 p-1.5 rounded-md border border-slate-700">
                                                    {statusSteps.map(step => (
                                                        <button key={step} onClick={() => setItemStatus(order.table_number, items, idx, order.total_amount, step)}
                                                            className={`flex-1 py-1.5 rounded text-[8px] sm:text-[10px] font-black uppercase transition-all ${currentStatus === step ? getActiveStyle(step) : 'bg-slate-800 text-slate-500 hover:bg-slate-600'}`}>{step}</button>
                                                    ))}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                                {isAllDone && <div className="bg-green-900/50 text-green-400 text-center py-2.5 md:py-3 rounded-md font-bold text-sm border border-green-800 mt-auto">✅ ALL DONE</div>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}