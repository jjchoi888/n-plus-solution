'use client';

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

export default function Maintenance() {
    const [tasks, setTasks] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [memos, setMemos] = useState({});

    // 💡 [핵심] 오디오 잠금 및 가짜 절전 모드 상태
    const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
    const [isPowerSaveMode, setIsPowerSaveMode] = useState(false);

    const isUnlockedRef = useRef(false);
    const wakeLockRef = useRef(null);
    const audioCtxRef = useRef(null);
    const prevRoomsRef = useRef([]); // 💡 레이더망 감지용 메모리

    const currentHotelCode = sessionStorage.getItem('hotelCode') || '';
    const currentUser = sessionStorage.getItem('userId') || 'UNKNOWN';

    const [alertSound, setAlertSound] = useState(localStorage.getItem('mt_alertSound') || ALERT_SOUNDS[0].url);
    const [alertVolume, setAlertVolume] = useState(parseFloat(localStorage.getItem('mt_alertVolume')) || 1.0);

    // 백그라운드에서도 항상 최신 볼륨을 알 수 있도록 Ref 사용
    const alertVolumeRef = useRef(alertVolume);
    useEffect(() => { alertVolumeRef.current = alertVolume; }, [alertVolume]);

    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [mtLogs, setMtLogs] = useState(() => JSON.parse(localStorage.getItem(`mt_logs_${currentHotelCode}`)) || []);
    const [mtStartTimes, setMtStartTimes] = useState(() => JSON.parse(localStorage.getItem(`mt_start_times_${currentHotelCode}`)) || {});

    const [filterStart, setFilterStart] = useState('');
    const [filterEnd, setFilterEnd] = useState('');
    const [filterRoom, setFilterRoom] = useState('');

    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => { localStorage.setItem(`mt_start_times_${currentHotelCode}`, JSON.stringify(mtStartTimes)); }, [mtStartTimes, currentHotelCode]);
    useEffect(() => { localStorage.setItem(`mt_logs_${currentHotelCode}`, JSON.stringify(mtLogs)); }, [mtLogs, currentHotelCode]);

    // =========================================================
    // 💡 하드웨어 오디오 칩 기계음
    // =========================================================
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

    // =========================================================
    // 💡 배너 클릭 시 오디오/진동/화면 권한 획득
    // =========================================================
    const unlockAudio = async () => {
        try {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            await audioCtxRef.current.resume();

            const audioEl = document.getElementById('mt-alert-audio');
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
    // 💡 강력한 알람 발사 엔진 (진동 + 기계음 + 오디오파일)
    // =========================================================
    const triggerLocalAlert = () => {
        if (!isUnlockedRef.current) return;

        // 🚨 진동 패턴을 길게 (2초 진동, 0.5초 휴식의 3연타)
        if ("vibrate" in navigator) {
            try { navigator.vibrate([2000, 500, 2000, 500, 2000]); } catch (e) { }
        }

        // 🚨 기계음 5연타 폭격
        playHardwareBeep();
        setTimeout(playHardwareBeep, 800);
        setTimeout(playHardwareBeep, 1600);
        setTimeout(playHardwareBeep, 2400);
        setTimeout(playHardwareBeep, 3200);

        // 추가 오디오 파일 재생
        try {
            const audioEl = document.getElementById('mt-alert-audio');
            if (audioEl) {
                audioEl.currentTime = 0;
                audioEl.volume = alertVolumeRef.current;
                audioEl.play().catch(e => { });
            }
        } catch (e) { }

        // 시스템 푸시 배너 (선택 사항)
        if ("Notification" in window && Notification.permission === "granted") {
            try {
                const notification = new Notification("🔧 PMS Maintenance Alert", {
                    body: "New maintenance request received",
                    icon: "/logo192.png",
                    requireInteraction: true
                });
                notification.onclick = () => { window.focus(); notification.close(); };
            } catch (e) { }
        }
    };

    // =========================================================
    // 💡 레이더망 분석 엔진: 새로운 유지보수 작업 감지
    // =========================================================
    const checkAndTriggerAlarm = (newMtRooms) => {
        if (!isUnlockedRef.current) return;

        const oldRooms = prevRoomsRef.current;
        let hasNewAlert = false;

        newMtRooms.forEach(newRoom => {
            const isExisting = oldRooms.some(oldRoom => oldRoom.id === newRoom.id);
            if (!isExisting) {
                hasNewAlert = true;
            }
        });

        if (hasNewAlert) {
            console.log("🚨 [Maintenance] New maintenance request detected!");
            setIsPowerSaveMode(false); // 까만 절전화면 강제 해제
            triggerLocalAlert();
        }

        prevRoomsRef.current = newMtRooms;
    };

    // Maintenance 타겟 필터링 로직
    const isMtTarget = (r) => {
        if (!r) return false;
        const hasMtStatus = r.status === 'MAINTENANCE' || r.status === 'MT_PREPARATION' || r.status.includes('MT_');
        const hasMtMemo = r.maintenance_remarks && r.maintenance_remarks.includes('Service Task');
        return hasMtStatus || hasMtMemo;
    };

    const fetchRooms = () => {
        if (!currentHotelCode) return;
        fetch(`/api/rooms?hotel=${currentHotelCode}&t=${Date.now()}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    const newMtRooms = data.filter(r => isMtTarget(r));
                    checkAndTriggerAlarm(newMtRooms); // 레이더 분석
                    setTasks(newMtRooms);
                }
            })
            .catch(e => console.log(e));
    };

    // =========================================================
    // 💡 백그라운드 10초 레이더망 가동 (10s Polling)
    // =========================================================
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

        socket.on('maintenanceAlert', (alertData) => {
            if (alertData.hotel_code && alertData.hotel_code !== currentHotelCode) return;
            setAlerts(prev => [alertData, ...prev]);

            setIsPowerSaveMode(false); // 웹소켓이 살아있을 때도 오더가 오면 화면을 밝힙니다.
            triggerLocalAlert();

            setTimeout(() => setAlerts(prev => prev.filter(a => a.time !== alertData.time)), 10000);
        });

        return () => socket.disconnect();
    }, [currentHotelCode]);

    // Web Push (Service Worker) 초기화 및 권한 요청
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

        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        if (window.matchMedia('(display-mode: standalone)').matches) setIsInstalled(true);

        if ("Notification" in window) {
            if (Notification.permission === "granted") subscribeToPush();
            else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(permission => { if (permission === "granted") subscribeToPush(); });
            }
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, [currentHotelCode, currentUser]);

    // 화면 켜질 때 자동 새로고침 및 WakeLock 관리
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

    const handleInstallApp = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') { setDeferredPrompt(null); setIsInstalled(true); }
    };

    const updateMtStatus = async (e, room, actionType, actionName) => {
        e.stopPropagation();
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const prevMemo = room.maintenance_remarks ? room.maintenance_remarks + '\n' : '';
        const newMemo = `${prevMemo}🛠️ [${actionName} at ${timeStr}]`;

        let finalStatus = room.status;

        // 💡 [핵심 수정] PREP, START, DONE 단계를 분리하여 중복 저장을 막습니다.
        if (actionType === 'PREP') {
            finalStatus = 'MT_PREPARATION';
        } else if (actionType === 'START') {
            setMtStartTimes(prev => ({ ...prev, [room.id]: now.getTime() }));
            finalStatus = 'MT_ONGOING';
        } else if (actionType === 'DONE') {
            let startTimeMs = mtStartTimes[room.id];
            if (!startTimeMs) startTimeMs = now.getTime() - 60000;

            const diffMs = now.getTime() - startTimeMs;
            const durationHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60))); // 수리는 시간(Hour) 단위

            // 오직 DONE 상태일 때만 히스토리에 기록
            const newLog = {
                id: Date.now().toString(),
                date: now.toLocaleDateString(),
                startTime: new Date(startTimeMs).toLocaleString(), // 👈 시작 시간 추가
                endTime: now.toLocaleString(),                     // 👈 종료 시간 추가
                roomId: room.id,
                subject: 'Maintenance Repair',
                durationHours: durationHours,
                remark: prevMemo ? prevMemo.split('\n').filter(l => l.trim().length > 0).pop() : 'Task Completed',
                timestamp: now.getTime()
            };
            setMtLogs(prev => [newLog, ...prev]);

            // 타이머 초기화
            const nextStarts = { ...mtStartTimes };
            delete nextStarts[room.id];
            setMtStartTimes(nextStarts);

            // 다음 상태 판별
            const hasHkPending = room.maintenance_remarks && room.maintenance_remarks.includes('Make Up Req') && !room.maintenance_remarks.includes('🧹 [Done');
            const isOcc = room.status === 'OCCUPIED' || room.status === 'MAKE_UP_GUEST' || room.status === 'MT_PREPARATION' || room.status === 'MT_ONGOING';

            if (hasHkPending) finalStatus = 'MAKE_UP_GUEST';
            else finalStatus = isOcc ? 'OCCUPIED' : 'VACANT';
        }

        const shouldClearMemo = actionType === 'DONE' && (finalStatus === 'VACANT' || finalStatus === 'OCCUPIED');

        await fetch('/api/rooms/update', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: room.id,
                status: finalStatus,
                room_type: room.room_type,
                maintenance_remarks: shouldClearMemo ? '' : newMemo,
                increment_usage: false,
                hotel_code: currentHotelCode
            })
        });
        fetchRooms();
    };

    const submitMemo = async (e, room) => {
        e.stopPropagation();
        if (!memos[room.id] || !memos[room.id].trim()) return;
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const prevMemo = room.maintenance_remarks ? room.maintenance_remarks + '\n' : '';
        const newMemo = `${prevMemo}🛠️ [Reply at ${timeStr}] ${memos[room.id]}`;

        await fetch('/api/rooms/update', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...room, maintenance_remarks: newMemo, increment_usage: false, hotel_code: currentHotelCode })
        });
        setMemos(prev => ({ ...prev, [room.id]: '' }));
        fetchRooms();
    };

    const getMtMemos = (remarks) => {
        if (!remarks) return "No maintenance history yet.";
        const lines = remarks.split('\n');
        const mtLines = lines.filter(line => line.includes('🛠️') || line.includes('Service Task') || line.includes('📝') || line.includes('Issue:') || line.includes('Reply'));
        return mtLines.length > 0 ? mtLines.join('\n') : "No maintenance history yet.";
    };

    const getMtInternalState = (remarks) => {
        if (!remarks) return 'PENDING';
        const lines = remarks.split('\n').reverse();
        for (const line of lines) {
            if (line.includes('🛠️ [Done')) return 'DONE';
            if (line.includes('🛠️ [On-going')) return 'ONGOING';
            if (line.includes('🛠️ [Prep')) return 'PREP';
        }
        return 'PENDING';
    };

    const playTestSound = () => {
        playHardwareBeep();
        try {
            const audioEl = document.getElementById('mt-alert-audio');
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
                reg.showNotification('🔔 OS Notification Channel Created!', { body: 'You can now configure detailed vibration and sound settings in your device settings.', icon: '/logo192.png', vibrate: [2000, 500, 2000, 500, 2000] });
            } else { alert("Service Worker not found. Please reinstall the app."); }
        } else { alert("Please allow notification permissions first."); }
    };

    const filteredLogs = mtLogs.filter(log => {
        if (filterRoom && !String(log.roomId).includes(filterRoom)) return false;
        if (filterStart && log.timestamp < new Date(filterStart).getTime()) return false;
        if (filterEnd && log.timestamp > new Date(filterEnd).getTime()) return false;
        return true;
    });

    const totalFilteredHours = filteredLogs.reduce((acc, log) => acc + log.durationHours, 0);
    const avgHours = filteredLogs.length > 0 ? (totalFilteredHours / filteredLogs.length).toFixed(1) : 0;

    const exportToPDF = () => {
        const printWindow = window.open('', '_blank');
        const html = `<html><head><title>Maintenance History Report</title><style>body { font-family: sans-serif; padding: 20px; color: #333; }table { width: 100%; border-collapse: collapse; margin-top: 20px; }th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; font-size: 14px; }th { background-color: #f8fafc; font-weight: bold; }h2 { color: #0f172a; margin-bottom: 5px; }.header { margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }</style></head><body><div class="header"><h2>🛠️ Maintenance History</h2><p style="color: #64748b; font-size: 14px;">Generated on: ${new Date().toLocaleString()}</p></div><table><thead><tr><th>Room</th><th>Start Time</th><th>End Time</th><th>Elapsed Time</th><th>Remarks</th></tr></thead><tbody>${filteredLogs.map(log => `<tr><td><b>${log.roomId}</b></td><td>${log.startTime || log.date}</td><td>${log.endTime || '-'}</td><td><b style="color: #0284c7;">${log.durationHours} hrs</b></td><td>${log.remark}</td></tr>`).join('')}</tbody></table><script>window.onload = () => { window.print(); window.close(); }</script></body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="min-h-screen bg-slate-800 font-sans flex flex-col relative overflow-hidden">

            <audio id="mt-alert-audio" src={alertSound} preload="auto" style={{ display: 'none' }} />

            {/* 💡 [핵심] 블랙 스크린 (가짜 절전 모드) 오버레이 */}
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

            {/* 💡 화면을 가리지 않는 상단 얇은 배너 (유지보수 색상 톤 맞춤) */}
            {!isAudioUnlocked && (
                <div className="bg-red-600 text-white p-3 text-center font-bold animate-pulse cursor-pointer shadow-lg z-50 flex items-center justify-center gap-2 border-b-2 border-red-800" onClick={unlockAudio}>
                    ⚠️ Tap to activate alerts (beep/vibration)! (Required)
                </div>
            )}

            {!isInstalled && deferredPrompt && (
                <div className="bg-blue-600 text-white p-3 flex justify-between items-center shadow-lg z-[210] border-b border-blue-700">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-bold"><span className="text-lg">📲</span> Install App for Instant Alerts</div>
                    <button onClick={handleInstallApp} className="bg-white text-blue-600 px-4 py-1.5 rounded font-black text-xs uppercase shadow-sm hover:bg-blue-50 active:scale-95 transition-transform">Install Now</button>
                </div>
            )}

            {showSettings && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-md p-6 md:p-8 w-full max-w-sm shadow-2xl border-t-8 border-slate-700">
                        <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">⚙️ Alert Settings</h2>
                        <div className="bg-slate-100 p-4 rounded text-sm text-slate-600 mb-6 font-bold text-center">Incoming alerts will now trigger a strong hardware beep.</div>
                        <label className="block text-sm font-bold text-slate-500 mb-2 uppercase tracking-widest">Select Sound (Additional)</label>
                        <select value={alertSound} onChange={e => { setAlertSound(e.target.value); localStorage.setItem('mt_alertSound', e.target.value); }} className="w-full p-3 border-2 border-slate-200 rounded-md mb-6 font-bold text-slate-700 outline-none focus:border-slate-500">
                            {ALERT_SOUNDS.map(s => <option key={s.name} value={s.url}>{s.name}</option>)}
                        </select>
                        <div className="flex justify-between items-end mb-2">
                            <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest">Volume: {Math.round(alertVolume * 100)}%</label>
                            <div className="flex gap-2">
                                <button onClick={playTestSound} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-200">🔊 Test Sound</button>
                                <button onClick={testSystemPush} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-xs font-bold hover:bg-blue-200">🔔 OS Push</button>
                            </div>
                        </div>
                        <input type="range" min="0.1" max="1" step="0.1" value={alertVolume} onChange={e => { const vol = parseFloat(e.target.value); setAlertVolume(vol); localStorage.setItem('mt_alertVolume', vol); }} className="w-full mb-8 accent-slate-600" />
                        <button onClick={() => setShowSettings(false)} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-md font-bold shadow-md transition-colors text-lg">Save & Close</button>
                    </div>
                </div>
            )}

            {showHistory && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-md w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden border-t-8 border-slate-700">
                        <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-center shrink-0">
                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">📊 Maintenance History & Stats</h2>
                            <button onClick={() => setShowHistory(false)} className="text-3xl text-slate-400 hover:text-red-500">&times;</button>
                        </div>
                        <div className="p-6 bg-white border-b border-slate-200 shrink-0 flex flex-col md:flex-row gap-6 items-end">
                            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Room No.</label><input type="text" placeholder="e.g. 101" value={filterRoom} onChange={e => setFilterRoom(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Start Date & Time</label><input type="datetime-local" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">End Date & Time</label><input type="datetime-local" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto"><button onClick={() => { setFilterStart(''); setFilterEnd(''); setFilterRoom(''); }} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-md font-bold text-sm shadow-sm whitespace-nowrap">Clear Filter</button></div>
                        </div>
                        <div className="flex px-6 py-4 bg-slate-100 gap-4 shrink-0">
                            <div className="bg-white p-4 rounded-md border border-slate-200 shadow-sm flex-1 flex flex-col justify-center"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tasks Completed</p><p className="text-3xl font-black text-blue-600">{filteredLogs.length} <span className="text-sm text-slate-500 font-bold">tasks</span></p></div>
                            <div className="bg-white p-4 rounded-md border border-slate-200 shadow-sm flex-1 flex flex-col justify-center"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Average Duration</p><p className="text-3xl font-black text-emerald-600">{avgHours} <span className="text-sm text-slate-500 font-bold">hours / task</span></p></div>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-slate-50">
                            {filteredLogs.length === 0 ? (<div className="text-center text-slate-400 py-10 font-bold">No maintenance records found.</div>) : (
                                <div className="border border-slate-200 rounded-md overflow-hidden shadow-sm bg-white">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-800 text-white"><tr><th className="p-3 font-bold uppercase tracking-wider text-xs">Date</th><th className="p-3 font-bold uppercase tracking-wider text-xs">Room</th><th className="p-3 font-bold uppercase tracking-wider text-xs">Subject</th><th className="p-3 font-bold uppercase tracking-wider text-xs text-center">Working Duration</th><th className="p-3 font-bold uppercase tracking-wider text-xs">Remark</th></tr></thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredLogs.map(log => (<tr key={log.id} className="hover:bg-slate-50"><td className="p-3 text-slate-600">{log.date || log.startTime}</td><td className="p-3 font-black text-slate-800">Rm {log.roomId}</td><td className="p-3 text-slate-700 font-bold">{log.subject}</td><td className="p-3 font-black text-emerald-600 text-center">{log.durationHours} hrs</td><td className="p-3 text-xs text-slate-500 max-w-[250px] truncate">{log.remark || log.remarks}</td></tr>))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end"><button onClick={exportToPDF} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-md font-bold shadow-md flex items-center gap-2 transition-colors">📄 Export to PDF</button></div>
                    </div>
                </div>
            )}

            <div className="absolute top-20 right-4 left-4 sm:left-auto sm:right-10 z-50 flex flex-col gap-3 sm:w-96 pointer-events-none">
                {alerts.map((alert, idx) => (
                    <div key={idx} className="bg-white border-l-8 border-orange-500 p-3 md:p-4 rounded-md shadow-2xl animate-fade-in flex items-start gap-3 md:gap-4 pointer-events-auto">
                        <span className="text-2xl md:text-3xl shrink-0 animate-bounce">🔧</span>
                        <div><h4 className="font-bold text-sm md:text-base text-slate-800">New Repair Request</h4><p className="text-xs md:text-sm mt-0.5 text-slate-600">{alert.message}</p></div>
                    </div>
                ))}
            </div>

            <div className="bg-slate-800 text-white p-4 md:p-6 shadow-md flex justify-between items-center z-10 border-b-4 border-slate-600 shrink-0">
                <div><h1 className="text-xl md:text-3xl font-black flex items-center gap-2 md:gap-3">🔧 Maintenance KDS</h1></div>
                <div className="flex gap-2">
                    {/* 💡 [핵심] 직원이 누를 수 있는 화면 끄기(절전) 버튼 추가 */}
                    <button
                        onClick={() => setIsPowerSaveMode(true)}
                        className="bg-black/40 text-slate-200 hover:bg-black px-3 md:px-4 py-2 rounded-md font-bold shadow-inner transition-colors text-sm md:text-base flex items-center gap-2 border border-slate-700"
                    >
                        🌙 Power Save
                    </button>
                    <button onClick={() => setShowHistory(true)} className="bg-white/10 hover:bg-white/20 px-3 md:px-4 py-2 rounded-md font-bold transition-colors text-sm md:text-base border border-white/20">🕒 History</button>
                    <button onClick={() => setShowSettings(true)} className="bg-white/10 hover:bg-white/20 px-3 md:px-4 py-2 rounded-md font-bold transition-colors text-sm md:text-base border border-white/20">⚙️</button>
                    <Link to="/" className="bg-slate-900 border border-slate-700 px-4 md:px-6 py-2.5 md:py-2 rounded-md font-bold hover:bg-black transition-colors text-sm md:text-base shrink-0">🏠 Exit</Link>
                </div>
            </div>

            <div className="flex-1 p-4 md:p-10 overflow-y-auto">
                {tasks.length === 0 ? (
                    <div className="text-center py-20 opacity-30 text-white px-4"><div className="text-5xl md:text-7xl mb-4">✅</div><p className="text-xl md:text-2xl font-bold">No active repair requests.</p></div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                        {tasks.map(room => {
                            const mtState = getMtInternalState(room.maintenance_remarks);
                            const headerBg = mtState === 'ONGOING' ? 'bg-blue-600' : mtState === 'PREP' ? 'bg-yellow-600' : 'bg-red-600';
                            const badgeText = mtState === 'ONGOING' ? 'MT ON-GOING' : mtState === 'PREP' ? 'MT PREP' : 'MT PENDING';

                            return (
                                <div key={room.id} className="rounded-md shadow-lg overflow-hidden flex flex-col border-2 transition-all bg-slate-700 border-slate-600 relative">
                                    <div className={`p-3 md:p-4 flex justify-between items-center ${headerBg}`}>
                                        <span className="text-xl md:text-2xl font-black text-white">Room {room.id}</span>
                                        <span className="px-2 md:px-3 py-1 rounded-md bg-black/30 text-white text-[10px] md:text-xs font-bold uppercase">{badgeText}</span>
                                    </div>
                                    <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
                                        <div className="bg-slate-800 p-3 rounded-md border border-slate-600 flex-1 flex flex-col">
                                            <p className="text-[10px] md:text-xs text-slate-400 uppercase mb-2">History & Chat</p>
                                            <div className="text-white font-mono text-xs md:text-sm whitespace-pre-wrap break-words flex-1 bg-black/20 p-2 rounded-md max-h-32 overflow-y-auto scrollbar-hide mb-1">
                                                {getMtMemos(room.maintenance_remarks)}
                                            </div>
                                            <div className="mt-2 flex gap-2">
                                                <input type="text" value={memos[room.id] || ''} onChange={(e) => setMemos({ ...memos, [room.id]: e.target.value })} placeholder="Type chat message..." className="flex-1 p-2 rounded-md text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" onClick={e => e.stopPropagation()} />
                                                <button onClick={(e) => submitMemo(e, room)} className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded-md font-bold text-sm shadow-md transition-colors">Send</button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mt-1">
                                            <button onClick={(e) => updateMtStatus(e, room, 'PREP', 'Prep')} className="bg-yellow-500 text-white py-3 rounded-md font-bold text-xs shadow-md hover:bg-yellow-600 active:scale-95">🛠️ Prep</button>
                                            <button onClick={(e) => updateMtStatus(e, room, 'START', 'On-going')} className="bg-blue-600 text-white py-3 rounded-md font-bold text-xs shadow-md hover:bg-blue-700 active:scale-95">⚙️ On-going</button>
                                        </div>
                                        <button onClick={(e) => updateMtStatus(e, room, 'DONE', 'Done')} className="bg-green-600 text-white py-3.5 rounded-md font-black text-sm shadow-md hover:bg-green-700 active:scale-95 w-full mt-1">✅ Done</button>
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