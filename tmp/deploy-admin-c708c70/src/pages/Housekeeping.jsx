import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';

const ALERT_SOUNDS = [
    { name: 'Short Beep (Default)', url: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
    { name: 'Digital Alarm', url: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg' },
    { name: 'Bugle Tune', url: 'https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg' },
    { name: 'Chime', url: 'https://actions.google.com/sounds/v1/bells/chimes_reverberating.ogg' },
    { name: 'Mechanical Clock', url: 'https://actions.google.com/sounds/v1/alarms/mechanical_clock_ring.ogg' },
    { name: 'Siren', url: 'https://actions.google.com/sounds/v1/alarms/spaceship_alarm.ogg' }
];

const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
};

export default function Housekeeping() {
    const [rooms, setRooms] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [memos, setMemos] = useState({});

    const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
    const [isPowerSaveMode, setIsPowerSaveMode] = useState(false);

    const isUnlockedRef = useRef(false);
    const wakeLockRef = useRef(null);
    const audioCtxRef = useRef(null);
    const prevRoomsRef = useRef([]);

    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showCustomInstallModal, setShowCustomInstallModal] = useState(false);
    const [isInstalled, setIsInstalled] = useState(window.matchMedia('(display-mode: standalone)').matches);

    const currentHotelCode = sessionStorage.getItem('hotelCode') || '';
    const currentUser = sessionStorage.getItem('userId') || 'UNKNOWN';
    const [alertSound, setAlertSound] = useState(localStorage.getItem('hk_alertSound') || ALERT_SOUNDS[0].url);
    const [alertVolume, setAlertVolume] = useState(parseFloat(localStorage.getItem('hk_alertVolume')) || 1.0);

    const alertVolumeRef = useRef(alertVolume);
    useEffect(() => { alertVolumeRef.current = alertVolume; }, [alertVolume]);

    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [hkLogs, setHkLogs] = useState(() => JSON.parse(localStorage.getItem(`hk_logs_${currentHotelCode}`)) || []);
    const [cleaningStartTimes, setCleaningStartTimes] = useState(() => JSON.parse(localStorage.getItem(`hk_start_times_${currentHotelCode}`)) || {});

    const [filterStart, setFilterStart] = useState('');
    const [filterEnd, setFilterEnd] = useState('');

    useEffect(() => { localStorage.setItem(`hk_start_times_${currentHotelCode}`, JSON.stringify(cleaningStartTimes)); }, [cleaningStartTimes, currentHotelCode]);
    useEffect(() => { localStorage.setItem(`hk_logs_${currentHotelCode}`, JSON.stringify(hkLogs)); }, [hkLogs, currentHotelCode]);

    // 💡 하드웨어 오디오 칩 기계음
    const playHardwareBeep = () => {
        try {
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') ctx.resume();

            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);

            gainNode.gain.setValueAtTime(alertVolumeRef.current, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) { console.error("Hardware beep failed:", e); }
    };

    // 💡 배너 클릭 시 오디오 칩 전원 켜기
    const unlockAudio = async () => {
        try {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            await audioCtxRef.current.resume();

            const audioEl = document.getElementById('pms-alert-audio');
            if (audioEl) {
                audioEl.volume = 0.01;
                await audioEl.play();
                audioEl.pause();
            }
            playHardwareBeep();
        } catch (err) { console.log(err); }

        if ("vibrate" in navigator) { try { navigator.vibrate(100); } catch (e) { } }
        if ('wakeLock' in navigator) { try { wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch (e) { } }

        setIsAudioUnlocked(true);
        isUnlockedRef.current = true;
    };

    // =========================================================
    // 💡 [수정됨] 진동 시간 2배 연장 및 기계음 횟수 증가
    // =========================================================
    const triggerLocalAlert = () => {
        if (!isUnlockedRef.current) return;

        // 🚨 진동 패턴을 2배로 늘림 (2초 진동, 0.5초 쉬고, 2초 진동, 0.5초 쉬고, 2초 진동)
        if ("vibrate" in navigator) {
            try { navigator.vibrate([2000, 500, 2000, 500, 2000]); } catch (e) { }
        }

        // 🚨 길어진 진동 시간에 맞춰 기계음도 5연타로 늘림
        playHardwareBeep();
        setTimeout(playHardwareBeep, 800);
        setTimeout(playHardwareBeep, 1600);
        setTimeout(playHardwareBeep, 2400);
        setTimeout(playHardwareBeep, 3200);

        try {
            const audioEl = document.getElementById('pms-alert-audio');
            if (audioEl) {
                audioEl.currentTime = 0;
                audioEl.volume = alertVolumeRef.current;
                audioEl.play().catch(e => { });
            }
        } catch (e) { }
    };

    // 💡 레이더망 분석 엔진
    const checkAndTriggerAlarm = (newHkRooms) => {
        if (!isUnlockedRef.current) return;

        const oldRooms = prevRoomsRef.current;
        let hasNewAlert = false;

        newHkRooms.forEach(newRoom => {
            const isExisting = oldRooms.some(oldRoom => oldRoom.id === newRoom.id);
            if (!isExisting) {
                hasNewAlert = true;
            }
        });

        if (hasNewAlert) {
            setIsPowerSaveMode(false);
            triggerLocalAlert();
        }

        prevRoomsRef.current = newHkRooms;
    };

    const isHkTarget = (r) => {
        if (!r) return false;
        return r.status.includes('MAKE_UP') || r.status.includes('HK_') || (r.maintenance_remarks && r.maintenance_remarks.includes('Make Up Req'));
    };

    const fetchRooms = () => {
        if (!currentHotelCode) return;
        fetch(`/api/rooms?hotel=${currentHotelCode}&t=${Date.now()}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    const newHkRooms = data.filter(r => isHkTarget(r));
                    checkAndTriggerAlarm(newHkRooms);
                    setRooms(newHkRooms);
                }
            })
            .catch(e => console.log(e));
    };

    // 백그라운드 10초 레이더망 가동 (10s Polling)
    useEffect(() => {
        if (!currentHotelCode) return;
        const interval = setInterval(() => {
            fetchRooms();
        }, 10000);
        return () => clearInterval(interval);
    }, [currentHotelCode]);

    // 기존 웹소켓 리스너
    useEffect(() => {
        if (!currentHotelCode) return;
        fetchRooms();

        const socketUrl = import.meta.env.VITE_API_URL || 'https://api.hotelnplus.com';
        const socket = io(socketUrl, { transports: ['websocket'] });

        socket.on('db_updated', (data) => {
            if (data.hotel_code === currentHotelCode || data.hotel_code === 'ALL') fetchRooms();
        });

        socket.on('hkAlert', (alertData) => {
            if (alertData.hotel_code && alertData.hotel_code !== currentHotelCode) return;
            setAlerts(prev => [alertData, ...prev]);

            setIsPowerSaveMode(false);
            triggerLocalAlert();

            setTimeout(() => setAlerts(prev => prev.filter(a => a.time !== alertData.time)), 10000);
        });

        return () => socket.disconnect();
    }, [currentHotelCode]);

    // Web Push 백그라운드 구독 로직
    useEffect(() => {
        const subscribeToPush = async () => {
            if ('serviceWorker' in navigator && 'PushManager' in window) {
                try {
                    const registration = await navigator.serviceWorker.register('/sw.js');
                    const response = await fetch('/api/notifications/vapidPublicKey');
                    const vapidData = await response.json();
                    const convertedVapidKey = urlBase64ToUint8Array(vapidData.publicKey);
                    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: convertedVapidKey });
                    await fetch('/api/notifications/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription, hotel_code: currentHotelCode, user_id: currentUser }) });
                } catch (error) { console.error("Web Push Error:", error); }
            }
        };
        if ("Notification" in window) {
            if (Notification.permission === "granted") subscribeToPush();
            else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(permission => { if (permission === "granted") subscribeToPush(); });
            }
        }
    }, [currentHotelCode, currentUser]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchRooms();
                if ('wakeLock' in navigator && wakeLockRef.current === null && isUnlockedRef.current) {
                    navigator.wakeLock.request('screen').then(lock => wakeLockRef.current = lock).catch(() => { });
                }
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, []);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => { e.preventDefault(); setDeferredPrompt(e); setShowCustomInstallModal(true); };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallApp = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') { setDeferredPrompt(null); setShowCustomInstallModal(false); setIsInstalled(true); }
    };

    const updateHkStatus = async (e, room, actionType, actionName) => {
        e.stopPropagation();
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const prevMemo = room.maintenance_remarks ? room.maintenance_remarks + '\n' : '';
        const newMemo = `${prevMemo}🧹 [${actionName} at ${timeStr}]`;

        let finalStatus = room.status;

        // 💡 [핵심 수정] START, FINISHED, DONE 3단계를 명확히 분리하여 중복 저장을 차단합니다.
        if (actionType === 'START') {
            setCleaningStartTimes(prev => ({ ...prev, [room.id]: now.getTime() }));
            finalStatus = 'HK_START';
        } else if (actionType === 'FINISHED') {
            // Finished는 상태만 업데이트하고 히스토리(장부)에는 아직 기록하지 않습니다.
            finalStatus = 'HK_FINISHED';
        } else if (actionType === 'DONE') {
            // 오직 DONE(최종 완료)일 때만 시간을 계산하여 히스토리에 1번만 기록합니다!
            let startTimeMs = cleaningStartTimes[room.id];
            if (!startTimeMs) startTimeMs = now.getTime() - 60000; // 시작 시간이 없으면 1분으로 기본 계산

            const diffMs = now.getTime() - startTimeMs;
            const durationMins = Math.max(1, Math.floor(diffMs / 60000));

            const newLog = {
                id: Date.now().toString(),
                roomId: room.id,
                startTime: new Date(startTimeMs).toLocaleString(),
                endTime: now.toLocaleString(),
                durationMins: durationMins,
                remarks: prevMemo ? prevMemo.split('\n').filter(l => l.trim().length > 0).pop() : `Task Completed`,
                timestamp: now.getTime()
            };
            setHkLogs(prev => [newLog, ...prev]);

            // 타이머 초기화
            const nextStarts = { ...cleaningStartTimes };
            delete nextStarts[room.id];
            setCleaningStartTimes(nextStarts);

            // 다음 상태 판별
            const hasMtPending = room.maintenance_remarks && room.maintenance_remarks.includes('Service Task') && !room.maintenance_remarks.includes('🛠️ [Done');
            const isOcc = room.status === 'OCCUPIED' || room.status === 'MAKE_UP_GUEST' || room.status === 'MT_PREPARATION';
            finalStatus = hasMtPending ? 'MT_PREPARATION' : (isOcc ? 'OCCUPIED' : 'VACANT');
        }

        const shouldClearMemo = actionType === 'DONE' && (finalStatus === 'VACANT' || finalStatus === 'OCCUPIED');

        await fetch('/api/rooms/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...room,
                status: finalStatus,
                maintenance_remarks: shouldClearMemo ? '' : newMemo,
                increment_usage: false,
                hotel_code: currentHotelCode
            })
        });
        fetchRooms();
    };

    const submitMemo = async (e, room) => {
        e.stopPropagation();
        if (!memos[room.id]) return;
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const prevMemo = room.maintenance_remarks ? room.maintenance_remarks + '\n' : '';
        const newMemo = `${prevMemo}🧹 [Reply at ${timeStr}] ${memos[room.id]}`;
        await fetch('/api/rooms/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...room, maintenance_remarks: newMemo, increment_usage: false, hotel_code: currentHotelCode }) });
        setMemos(prev => ({ ...prev, [room.id]: '' }));
        fetchRooms();
    };

    const getHkMemos = (remarks) => {
        if (!remarks) return "No housekeeping history yet.";
        const lines = remarks.split('\n');
        const hkLines = lines.filter(line => line.includes('🧹') || line.includes('Make Up Req') || line.includes('Note:') || line.includes('Reply'));
        return hkLines.length > 0 ? hkLines.join('\n') : "No housekeeping history yet.";
    };

    const getHkInternalState = (remarks) => {
        if (!remarks) return 'PENDING';
        const lines = remarks.split('\n').reverse();
        for (const line of lines) {
            if (line.includes('🧹 [Finished')) return 'FINISHED';
            if (line.includes('🧹 [Start')) return 'STARTED';
        }
        return 'PENDING';
    };

    const playTestSound = () => {
        playHardwareBeep();
        try {
            const audioEl = document.getElementById('pms-alert-audio');
            if (audioEl) {
                audioEl.currentTime = 0;
                audioEl.volume = alertVolume;
                audioEl.play().catch(e => console.log(e));
            }
        } catch (e) { }
    };

    const testSystemPush = async () => {
        if (Notification.permission === 'granted') {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
                reg.showNotification('🔔 OS Notification Channel Created!', {
                    body: 'You can now configure detailed vibration and sound settings in your device settings.',
                    icon: '/logo192.png',
                    // 💡 여기도 진동 시간을 기존 대비 2배로 늘림
                    vibrate: [2000, 500, 2000, 500, 2000]
                });
            } else { alert("Service Worker not found. Please reinstall the app."); }
        } else { alert("Please allow notification permissions first."); }
    };

    const filteredLogs = hkLogs.filter(log => {
        if (filterStart && log.timestamp < new Date(filterStart).getTime()) return false;
        if (filterEnd && log.timestamp > new Date(filterEnd).getTime()) return false;
        return true;
    });

    const totalFilteredMins = filteredLogs.reduce((acc, log) => acc + log.durationMins, 0);
    const avgMins = filteredLogs.length > 0 ? Math.round(totalFilteredMins / filteredLogs.length) : 0;

    const exportToPDF = () => {
        const printWindow = window.open('', '_blank');
        const html = `<html><head><title>Housekeeping History Report</title><style>body { font-family: sans-serif; padding: 20px; color: #333; }table { width: 100%; border-collapse: collapse; margin-top: 20px; }th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; font-size: 14px; }th { background-color: #f8fafc; font-weight: bold; }h2 { color: #0f172a; margin-bottom: 5px; }.header { margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }</style></head><body><div class="header"><h2>🧹 Housekeeping Cleaning History</h2><p style="color: #64748b; font-size: 14px;">Generated on: ${new Date().toLocaleString()}</p></div><table><thead><tr><th>Room</th><th>Start Time</th><th>End Time</th><th>Elapsed Time</th><th>Remarks</th></tr></thead><tbody>${filteredLogs.map(log => `<tr><td><b>${log.roomId}</b></td><td>${log.startTime}</td><td>${log.endTime}</td><td><b style="color: #059669;">${log.durationMins} mins</b></td><td>${log.remarks}</td></tr>`).join('')}</tbody></table><script>window.onload = () => { window.print(); window.close(); }</script></body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans flex flex-col relative overflow-hidden pb-10">

            <audio id="pms-alert-audio" src={alertSound} preload="auto" style={{ display: 'none' }} />

            {/* 💡 블랙 스크린 (가짜 절전 모드) 오버레이 */}
            {isPowerSaveMode && (
                <div
                    className="fixed inset-0 bg-black z-[99999] flex flex-col items-center justify-center text-slate-700 cursor-pointer"
                    onClick={() => setIsPowerSaveMode(false)}
                >
                    <div className="text-6xl mb-6 opacity-30 animate-pulse">🌙</div>
                    <div className="text-lg font-bold opacity-40 uppercase tracking-widest text-slate-500">Power Saving Mode</div>
                    <div className="text-sm mt-4 opacity-30 text-slate-500">Tap anywhere to wake up</div>
                </div>
            )}

            {!isAudioUnlocked && (
                <div className="bg-red-600 text-white p-3 text-center font-bold animate-pulse cursor-pointer shadow-lg z-50 flex items-center justify-center gap-2" onClick={unlockAudio}>
                    ⚠️ Tap to activate alerts (beep/vibration)! (Required)
                </div>
            )}

            {!isInstalled && showCustomInstallModal && (
                <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-xl p-8 w-full max-w-sm shadow-2xl text-center border-t-8 border-blue-600">
                        <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">📲</div>
                        <h2 className="text-2xl font-black text-slate-800 mb-3">Install Hotel App</h2>
                        <p className="text-slate-600 font-bold text-sm mb-8 leading-relaxed">Install this app on your home screen to receive background alerts and use it like a native app!</p>
                        <button onClick={handleInstallApp} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-lg font-black shadow-lg transition-transform active:scale-95 text-lg mb-3">📥 Install App Now</button>
                        <button onClick={() => setShowCustomInstallModal(false)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-500 py-3 rounded-lg font-bold transition-colors">Maybe Later</button>
                    </div>
                </div>
            )}

            {showSettings && (
                <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-md p-6 md:p-8 w-full max-w-sm shadow-2xl border-t-8 border-orange-500">
                        <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">⚙️ Alert Settings</h2>
                        <div className="bg-slate-100 p-4 rounded text-sm text-slate-600 mb-6 font-bold text-center">Incoming alerts will now trigger a strong hardware beep.</div>
                        <label className="block text-sm font-bold text-slate-500 mb-2 uppercase tracking-widest">Select Sound (Additional)</label>
                        <select value={alertSound} onChange={e => { setAlertSound(e.target.value); localStorage.setItem('hk_alertSound', e.target.value); }} className="w-full p-3 border-2 border-slate-200 rounded-md mb-6 font-bold text-slate-700 outline-none focus:border-orange-500">
                            {ALERT_SOUNDS.map(s => <option key={s.name} value={s.url}>{s.name}</option>)}
                        </select>
                        <div className="flex justify-between items-end mb-2">
                            <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest">Volume: {Math.round(alertVolume * 100)}%</label>
                            <div className="flex gap-2">
                                <button onClick={playTestSound} className="bg-orange-100 text-orange-700 px-3 py-1 rounded-md text-xs font-bold hover:bg-orange-200">🔊 Test Sound</button>
                                <button onClick={testSystemPush} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-xs font-bold hover:bg-blue-200">🔔 Test OS Push</button>
                            </div>
                        </div>
                        <input type="range" min="0.1" max="1" step="0.1" value={alertVolume} onChange={e => { const vol = parseFloat(e.target.value); setAlertVolume(vol); localStorage.setItem('hk_alertVolume', vol); }} className="w-full mb-8 accent-orange-500" />
                        <button onClick={() => setShowSettings(false)} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-md font-bold shadow-md transition-colors text-lg">Save & Close</button>
                    </div>
                </div>
            )}

            {showHistory && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-md w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden border-t-8 border-blue-600">
                        <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-center shrink-0">
                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">📊 Cleaning History & Stats</h2>
                            <button onClick={() => setShowHistory(false)} className="text-3xl text-slate-400 hover:text-red-500">&times;</button>
                        </div>
                        <div className="p-6 bg-white border-b border-slate-200 shrink-0 flex flex-col md:flex-row gap-6 items-end">
                            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Start Date & Time</label><input type="datetime-local" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">End Date & Time</label><input type="datetime-local" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto"><button onClick={() => { setFilterStart(''); setFilterEnd(''); }} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-md font-bold text-sm shadow-sm">Clear Filter</button></div>
                        </div>
                        <div className="flex px-6 py-4 bg-slate-100 gap-4 shrink-0">
                            <div className="bg-white p-4 rounded-md border border-slate-200 shadow-sm flex-1 flex flex-col justify-center"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Rooms Cleaned</p><p className="text-3xl font-black text-blue-600">{filteredLogs.length} <span className="text-sm text-slate-500 font-bold">rooms</span></p></div>
                            <div className="bg-white p-4 rounded-md border border-slate-200 shadow-sm flex-1 flex flex-col justify-center"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Average Time</p><p className="text-3xl font-black text-emerald-600">{avgMins} <span className="text-sm text-slate-500 font-bold">mins / room</span></p></div>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-slate-50">
                            {filteredLogs.length === 0 ? (<div className="text-center text-slate-400 py-10 font-bold">No cleaning records found for the selected period.</div>) : (
                                <div className="border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-800 text-white"><tr><th className="p-3 font-bold uppercase tracking-wider text-xs">Room</th><th className="p-3 font-bold uppercase tracking-wider text-xs">Start Time</th><th className="p-3 font-bold uppercase tracking-wider text-xs">End Time</th><th className="p-3 font-bold uppercase tracking-wider text-xs">Elapsed Time</th><th className="p-3 font-bold uppercase tracking-wider text-xs">Remarks</th></tr></thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredLogs.map(log => (<tr key={log.id} className="hover:bg-slate-50"><td className="p-3 font-black text-slate-800">{log.roomId}</td><td className="p-3 text-slate-600">{log.startTime}</td><td className="p-3 text-slate-600">{log.endTime}</td><td className="p-3 font-bold text-emerald-600">{log.durationMins} mins</td><td className="p-3 text-xs text-slate-500 max-w-[200px] truncate">{log.remarks}</td></tr>))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end"><button onClick={exportToPDF} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-md font-bold shadow-md flex items-center gap-2 transition-colors">📄 Export to PDF</button></div>
                    </div>
                </div>
            )}

            <div className="absolute top-24 right-4 left-4 sm:left-auto sm:right-10 z-50 flex flex-col gap-3 sm:w-96 pointer-events-none">
                {alerts.map((alert, idx) => (
                    <div key={idx} className="bg-white border-l-8 border-orange-500 p-4 rounded-md shadow-2xl animate-fade-in flex items-start gap-3 md:gap-4 pointer-events-auto">
                        <div className="text-2xl md:text-3xl animate-bounce shrink-0">🧹</div>
                        <div><h4 className="font-black text-slate-800 text-sm md:text-base">Cleaning Requested</h4><p className="text-slate-600 text-xs md:text-sm mt-1">{alert.message}</p></div>
                    </div>
                ))}
            </div>

            <div className="bg-orange-600 text-white p-4 md:p-6 shadow-md flex justify-between items-center z-10 shrink-0">
                <div><h1 className="text-xl md:text-3xl font-black flex items-center gap-2 md:gap-3">🧹 Housekeeping KDS</h1></div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsPowerSaveMode(true)}
                        className="bg-slate-800 text-slate-100 hover:bg-black px-3 md:px-4 py-2 rounded-md font-bold shadow-inner transition-colors text-sm md:text-base flex items-center gap-2 border border-slate-700"
                    >
                        🌙 Power Save
                    </button>
                    <button onClick={() => setShowHistory(true)} className="bg-white/20 hover:bg-white/30 px-3 md:px-4 py-2 rounded-md font-bold transition-colors text-sm md:text-base border border-white/30">🕒 History</button>
                    <button onClick={() => setShowSettings(true)} className="bg-white/20 hover:bg-white/30 px-3 md:px-4 py-2 rounded-md font-bold transition-colors text-sm md:text-base border border-white/30">⚙️</button>
                    <Link to="/" className="bg-orange-800 border border-orange-700 px-4 md:px-6 py-2 rounded-md font-bold hover:bg-orange-900 transition-colors text-sm md:text-base shrink-0">🏠 Exit</Link>
                </div>
            </div>

            <div className="flex-1 p-4 md:p-10 overflow-y-auto">
                {rooms.length === 0 ? (
                    <div className="text-center py-20 opacity-50 px-4"><div className="text-6xl md:text-8xl mb-4">✨</div><p className="text-xl md:text-2xl font-bold text-slate-500">All rooms are clean!</p></div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                        {rooms.map(room => {
                            const hkState = getHkInternalState(room.maintenance_remarks);
                            const headerBg = hkState === 'STARTED' ? 'bg-blue-600' : hkState === 'FINISHED' ? 'bg-purple-600' : 'bg-orange-500';
                            const badgeText = hkState === 'STARTED' ? 'HK ON-GOING' : hkState === 'FINISHED' ? 'HK FINISHED' : 'HK PENDING';

                            return (
                                <div key={room.id} className="bg-white rounded-md shadow-md border-2 overflow-hidden flex flex-col transition-all border-orange-200 relative">
                                    <div className={`p-4 text-white flex justify-between items-center ${headerBg}`}>
                                        <div><div className="text-2xl md:text-3xl font-black">Room {room.id}</div><div className="text-[10px] md:text-xs font-bold uppercase opacity-80">{room.room_type}</div></div>
                                        <div className="text-2xl md:text-3xl">🧹</div>
                                    </div>
                                    <div className="p-4 flex flex-col gap-3 flex-1">
                                        <div className="bg-slate-50 p-2 rounded-md border border-slate-200 text-center"><span className="text-sm font-bold text-orange-600 uppercase tracking-widest">{badgeText}</span></div>
                                        <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200 flex-1 flex flex-col justify-center gap-2">
                                            <div className="text-slate-700 text-xs font-mono whitespace-pre-wrap bg-white/50 p-2 rounded max-h-24 overflow-y-auto scrollbar-hide mb-1">{getHkMemos(room.maintenance_remarks)}</div>
                                            <div className="flex gap-2 mb-2">
                                                <input type="text" placeholder="Add memo/reply..." value={memos[room.id] || ''} onChange={e => setMemos({ ...memos, [room.id]: e.target.value })} className="flex-1 p-2 rounded-md text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500" onClick={e => e.stopPropagation()} />
                                                <button onClick={(e) => submitMemo(e, room)} className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-md font-bold text-sm shadow-md transition-colors">Save</button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button onClick={(e) => updateHkStatus(e, room, 'START', 'Start')} className="bg-blue-600 text-white py-3 rounded-md font-bold text-xs shadow-md hover:bg-blue-700 active:scale-95">▶ Start</button>
                                                <button onClick={(e) => updateHkStatus(e, room, 'FINISHED', 'Finished')} className="bg-purple-600 text-white py-3 rounded-md font-bold text-xs shadow-md hover:bg-purple-700 active:scale-95">⏸ Finished</button>
                                            </div>
                                            <button onClick={(e) => updateHkStatus(e, room, 'DONE', 'Done')} className="bg-green-600 text-white py-3.5 rounded-md font-black text-sm shadow-md hover:bg-green-700 active:scale-95 w-full mt-1">✅ Done</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}