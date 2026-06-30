'use client';

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import {
    buildManagedEventPosStorePayload,
    isEventBanquetStore,
    loadBanquetVenues,
    loadEventPosStoreMeta
} from '../utils/banquetEvents';

// 💡 [캐시 충돌 방지] 새로운 버전 배포 후 브라우저에 남은 구버전 캐시 때문에 
// 동적 임포트(JS 청크)를 불러오지 못해 빈 화면이 뜨는 현상을 원천 차단합니다.
window.addEventListener('vite:preloadError', () => {
    window.location.reload();
});
window.addEventListener('error', (e) => {
    if (e.message && e.message.includes('Failed to fetch dynamically imported module')) {
        window.location.reload();
    }
});

export default function Home() {
    // 💡 상태 정의
    const [hotelCodeInput, setHotelCodeInput] = useState('');
    const [userIdInput, setUserIdInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');

    const [currentUser, setCurrentUser] = useState(sessionStorage.getItem('userId') || null);
    const [currentHotel, setCurrentHotel] = useState(sessionStorage.getItem('hotelCode') || null);

    const navigate = useNavigate();
    const [posStores, setPosStores] = useState([]);
    const [showPwdModal, setShowPwdModal] = useState(false);
    const [pwdData, setPwdData] = useState({ old: '', new: '' });

    // 💡 [PWA] 설치 유도를 위한 상태
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(() => (
        typeof window !== 'undefined'
        && window.matchMedia('(display-mode: standalone)').matches
    ));

    const buildVisiblePosStores = (stores = [], hotelCode) => {
        const safeStores = Array.isArray(stores) ? stores : [];
        const eventStores = safeStores.filter(isEventBanquetStore);
        const eventMeta = loadEventPosStoreMeta(hotelCode);
        const canonicalEventStore = eventStores.find((store) => String(store.id) === String(eventMeta?.id || ''))
            || eventStores.find((store) => String(store.location) === String(eventMeta?.location || ''))
            || eventStores[0]
            || null;
        const venueSource = loadBanquetVenues(hotelCode);
        const managedPayload = canonicalEventStore
            ? buildManagedEventPosStorePayload({
                venues: venueSource,
                existingStore: canonicalEventStore,
                stores: safeStores
            })
            : null;

        return safeStores
            .filter((store) => !isEventBanquetStore(store) || String(store.id) === String(canonicalEventStore?.id || ''))
            .map((store) => (
                canonicalEventStore && String(store.id) === String(canonicalEventStore.id)
                    ? { ...store, ...managedPayload, is_auto_managed: true }
                    : store
            ));
    };

    // 💡 [PWA] 설치 이벤트 리스너
    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    // 💡 [PWA] 설치 버튼 클릭 핸들러
    const handleInstallApp = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setIsInstalled(true);
        }
    };

    useEffect(() => {
        if (currentUser && currentHotel) {
            fetch(`/api/pos-stores?hotel=${currentHotel}`)
                .then(res => res.json())
                .then(data => { if (Array.isArray(data)) setPosStores(buildVisiblePosStores(data, currentHotel)); })
                .catch(err => console.error("Failed to load POS stores on home.", err));
        }
    }, [currentUser, currentHotel]);

    const handleLogin = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        const hCode = hotelCodeInput.trim();
        const id = userIdInput.trim();
        const pwd = passwordInput.trim();

        if (!hCode) return alert("Please enter the Hotel Code.");
        if (!id || !pwd) return alert("Please enter Staff ID and Password.");

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: id, password: pwd, hotel_code: hCode })
            });

            const data = await res.json();

            if (data.success) {
                sessionStorage.setItem('userId', id);
                sessionStorage.setItem('userName', data.name || id);
                sessionStorage.setItem('hotelCode', hCode);
                sessionStorage.setItem('role', data.role || 'GUEST');
                if (data.assigned_store) sessionStorage.setItem('assignedStore', data.assigned_store);

                // 💡 서버에서 받은 권한을 세션에 저장
                const accessStr = data.accessible_menus || '';
                sessionStorage.setItem('accessible_menus', accessStr);
                sessionStorage.setItem('is_sub_admin', data.is_sub_admin || 0);

                setCurrentUser(id);
                setCurrentHotel(hCode);
                setUserIdInput('');
                setPasswordInput('');

                // 🚀 [스마트 하이브리드 길안내]
                const accessArr = accessStr.split(',');

                // 1. 하우스키핑 현장 직원인 경우 -> 하우스키핑 전용 앱 화면으로 직행!
                if (accessArr.includes('HK') && !accessArr.some(m => m.startsWith('ADMIN_'))) {
                    navigate('/housekeeping');
                }
                // 2. 메인테넌스 현장 직원인 경우 -> 수리/유지보수 전용 앱 화면으로 직행!
                else if (accessArr.includes('MAINTENANCE') && !accessArr.some(m => m.startsWith('ADMIN_'))) {
                    navigate('/maintenance');
                }
                // 3. 그 외 프론트, 매니저, 최고 관리자 등은 권한에 상관없이 무조건 메인 대시보드로 진입!
                else {
                    navigate('/');
                }

            } else {
                alert(data.message || "Invalid ID or Password / Access Denied.");
            }
        } catch (error) {
            console.error("Login error:", error);
            alert("Failed to connect to the server.");
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('userId');
        sessionStorage.removeItem('userName');
        sessionStorage.removeItem('hotelCode');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('assignedStore');
        sessionStorage.removeItem('accessible_menus');
        setCurrentUser(null);
        setCurrentHotel(null);
        navigate('/');
    };

    const handleChangePassword = async () => {
        if (!pwdData.old || !pwdData.new) return alert('Please enter both current and new passwords.');
        try {
            const res = await fetch('/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser,
                    old_password: pwdData.old,
                    new_password: pwdData.new
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('✅ Password changed successfully!');
                setShowPwdModal(false);
                setPwdData({ old: '', new: '' });
            } else {
                alert('❌ Change failed: ' + (data.message || 'Incorrect current password.'));
            }
        } catch { alert('A server error occurred.'); }
    };

    if (!currentUser) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900 font-sans p-4">
                <div className="bg-white p-8 md:p-12 rounded-md shadow-2xl w-full max-w-md animate-fade-in text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
                    <img src={logo} alt="Hotel Logo" className="h-16 md:h-20 mx-auto mb-4 object-contain" />
                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-2 tracking-tight">Cloud PMS</h2>
                    <p className="text-slate-500 font-medium mb-8 text-sm">Multi-Property Management System</p>
                    <div className="space-y-4 md:space-y-5">
                        <input type="text" placeholder="Hotel Code" className="w-full p-4 md:p-5 border border-blue-200 rounded-md bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold text-blue-900 transition-all text-sm md:text-base" value={hotelCodeInput} onChange={e => setHotelCodeInput(e.target.value)} />
                        <input type="text" placeholder="Staff ID" className="w-full p-4 md:p-5 border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all text-sm md:text-base" value={userIdInput} onChange={e => setUserIdInput(e.target.value)} />
                        <input type="password" placeholder="Password" className="w-full p-4 md:p-5 border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all text-sm md:text-base" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                        <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black p-4 md:p-5 rounded-md transition-transform transform active:scale-95 shadow-lg shadow-blue-600/30 text-lg md:text-xl mt-2">System Login</button>
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-100 text-[10px] md:text-xs text-slate-400 font-medium space-y-1">
                        <p>Hotel Code required for multi-property access.</p>
                        <p>Contact IT support for your credentials.</p>
                    </div>
                </div>
            </div>
        );
    }

    // 🛡️ [시스템 권한]
    const currentRole = sessionStorage.getItem('role') || 'GUEST';
    const userAccess = sessionStorage.getItem('accessible_menus') || '';

    const isSubAdmin = sessionStorage.getItem('is_sub_admin') === '1' || sessionStorage.getItem('is_sub_admin') === 1;
    const isMaster = currentRole === 'SUPER_ADMIN' || isSubAdmin;

    const canAccessAdmin = isMaster || userAccess.includes('ADMIN_');
    const canAccessFinance = isMaster || userAccess.includes('FINANCE');
    const canAccessFront = isMaster || userAccess.includes('FRONT');
    const canAccessHK = isMaster || userAccess.includes('HK');
    const canAccessMaintenance = isMaster || userAccess.includes('MAINTENANCE');
    const canAccessInventory = isMaster || userAccess.includes('INVENTORY');

    const getStoreIcon = (type) => {
        switch (type) {
            case 'Event & Banquet': return '🎉';
            case 'Cafe': return '☕';
            case 'Bar': return '🍸';
            case 'Spa & Wellness': return '💆';
            case 'Activity & Tour': return '🗺️';
            case 'Rental Service': return '🚗';
            default: return '🍽️';
        }
    };

    return (
        <div className="flex flex-col items-center justify-start md:justify-center min-h-screen bg-slate-50 font-sans relative overflow-x-hidden pb-10 md:pb-0">

            {/* 💡 [강제 설치 유도 바] 로그인 후 앱이 설치되지 않았을 때만 화면 최상단에 노출 */}
            {!isInstalled && deferredPrompt && (
                <div className="w-full bg-blue-600 text-white p-3 flex justify-center items-center shadow-md z-[100] border-b border-blue-700 animate-pulse mb-4">
                    <div className="max-w-6xl w-full flex justify-between items-center px-4 md:px-0">
                        <div className="flex items-center gap-2 text-xs md:text-sm font-bold">
                            <span className="text-lg">📲</span> Install Hotel PMS App for Instant Alerts
                        </div>
                        <button onClick={handleInstallApp} className="bg-white text-blue-600 px-4 py-1.5 rounded font-black text-xs uppercase shadow-sm hover:bg-blue-50 active:scale-95 transition-transform">
                            Install Now
                        </button>
                    </div>
                </div>
            )}

            <div className="w-full max-w-6xl p-4 md:p-10 mx-auto">
                <div className="flex flex-col-reverse md:flex-row justify-between items-center mb-6 md:mb-8 gap-4 pt-4 md:pt-0">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2 md:gap-3 w-full md:w-auto justify-center md:justify-start">
                        <img src={logo} alt="Hotel Logo" className="h-10 md:h-12 w-auto object-contain" />
                        <span className="hidden sm:inline">Integrated Hotel PMS</span>
                    </h1>
                    <div className="flex items-center gap-3 md:gap-4 bg-white px-4 md:px-5 py-2.5 md:py-3 rounded-md shadow-sm border border-slate-200 self-end md:self-auto shrink-0">
                        <div className="text-xs font-black text-blue-800 bg-blue-100 px-3 py-1 rounded-sm">🏢 {currentHotel}</div>
                        <button onClick={() => setShowPwdModal(true)} className="font-bold text-xs md:text-sm text-slate-700 hover:text-blue-600 transition-colors flex items-center gap-1.5 md:gap-2">👤 {currentUser}</button>
                        <button onClick={handleLogout} className="text-[10px] md:text-xs font-bold text-red-500 border-l pl-3 md:pl-4 border-slate-300 hover:underline">Logout</button>
                    </div>
                </div>

                <div className="space-y-8 md:space-y-10">
                    <div>
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 pl-2">Core Management</h2>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                            <Link to={canAccessAdmin ? "/admin" : "#"} className={`bg-slate-900 text-white p-5 md:p-8 rounded-md shadow-lg transition-all flex flex-col justify-center items-center h-32 md:h-40 group ${canAccessAdmin ? 'hover:-translate-y-1' : 'opacity-40 cursor-not-allowed'}`}>
                                <div className="text-3xl md:text-4xl mb-1 md:mb-2 group-hover:scale-110 transition-transform">🏢</div>
                                <h2 className="text-base md:text-xl font-bold text-center">Back Office</h2>
                                <p className="text-slate-400 text-[10px] md:text-xs mt-1">Settings & HR</p>
                            </Link>
                            <Link to={canAccessFinance ? "/finance" : "#"} className={`bg-yellow-600 text-white p-5 md:p-8 rounded-md shadow-lg transition-all flex flex-col justify-center items-center h-32 md:h-40 group ${canAccessFinance ? 'hover:-translate-y-1' : 'opacity-40 cursor-not-allowed'}`}>
                                <div className="text-3xl md:text-4xl mb-1 md:mb-2 group-hover:scale-110 transition-transform">📊</div>
                                <h2 className="text-base md:text-xl font-bold text-center">Finance</h2>
                                <p className="text-yellow-200 text-[10px] md:text-xs mt-1">Control & Report</p>
                            </Link>
                            <Link to={canAccessFront ? "/front" : "#"} className={`bg-blue-600 text-white p-5 md:p-8 rounded-md shadow-lg transition-all flex flex-col justify-center items-center h-32 md:h-40 group ${canAccessFront ? 'hover:-translate-y-1' : 'opacity-40 cursor-not-allowed'}`}>
                                <div className="text-3xl md:text-4xl mb-1 md:mb-2 group-hover:scale-110 transition-transform">🛎️</div>
                                <h2 className="text-base md:text-xl font-bold text-center">Front Desk</h2>
                                <p className="text-blue-200 text-[10px] md:text-xs mt-1 text-center">Room Management</p>
                            </Link>
                            <Link to={canAccessInventory ? "/inventory" : "#"} className={`bg-emerald-600 text-white p-5 md:p-8 rounded-md shadow-lg transition-all flex flex-col justify-center items-center h-32 md:h-40 group ${canAccessInventory ? 'hover:-translate-y-1' : 'opacity-40 cursor-not-allowed'}`}>
                                <div className="text-3xl md:text-4xl mb-1 md:mb-2 group-hover:scale-110 transition-transform">📦</div>
                                <h2 className="text-base md:text-xl font-bold text-center">Inventory</h2>
                                <p className="text-emerald-200 text-[10px] md:text-xs mt-1">Asset & Cost Control</p>
                            </Link>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 pl-2">Food & Beverage Operations</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                            {posStores.length > 0 ? (
                                posStores.map(store => {
                                    const canAccessPos = isMaster || userAccess.includes(`POS_${store.id}`);
                                    const canAccessKds = isMaster || userAccess.includes(`KDS_${store.id}`);
                                    const isEventStore = String(store.type || '').toLowerCase().includes('event')
                                        || String(store.type || '').toLowerCase().includes('banquet');
                                    return (
                                        <div key={store.id} className="bg-white p-5 md:p-8 rounded-md shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:shadow-md transition-shadow gap-4 sm:gap-6">
                                            <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
                                                <span className="text-4xl md:text-5xl shrink-0">{getStoreIcon(store.type)}</span>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-black text-slate-800 text-lg md:text-2xl leading-tight truncate">{store.name}</h3>
                                                    <p className="text-xs md:text-sm font-bold text-slate-400 truncate">{store.type}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
                                                <Link to={canAccessPos ? `/pos/${store.location}` : "#"} className={`flex-1 sm:flex-none text-center px-4 py-3 md:px-6 md:py-4 rounded-md font-black transition-colors text-sm md:text-base border shadow-sm whitespace-nowrap ${canAccessPos ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 hover:shadow-md' : 'bg-slate-50 text-slate-400 border-slate-200 opacity-50 cursor-not-allowed'}`}>{isEventStore ? '🎉 Event POS' : '💳 POS'}</Link>
                                                <Link to={canAccessKds ? `/kitchen/${store.location}` : "#"} className={`flex-1 sm:flex-none text-center px-4 py-3 md:px-6 md:py-4 rounded-md font-black transition-colors text-sm md:text-base border shadow-sm whitespace-nowrap ${canAccessKds ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700 hover:shadow-md' : 'bg-slate-50 text-slate-400 border-slate-200 opacity-50 cursor-not-allowed'}`}>👨‍🍳 KDS</Link>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="col-span-1 lg:col-span-2 text-center py-8 md:py-10 text-slate-400 font-bold bg-white rounded-md border border-dashed border-slate-300 text-sm md:text-base px-4">No POS facilities created yet.</div>
                            )}
                        </div>
                    </div>

                    <div>
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 pl-2">On-site Services & Utility</h2>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                            <Link to={canAccessFront ? "/self-checkin" : "#"} className={`bg-teal-600 text-white p-5 md:p-8 rounded-md shadow-lg transition-all flex flex-col justify-center items-center h-32 md:h-40 group ${canAccessFront ? 'hover:-translate-y-1' : 'opacity-40 cursor-not-allowed'}`}>
                                <div className="text-3xl md:text-4xl mb-1 md:mb-2 group-hover:scale-110 transition-transform">📱</div>
                                <h2 className="text-base md:text-xl font-bold text-center leading-tight">Self Check-in</h2>
                            </Link>
                            <Link to={canAccessHK ? "/housekeeping" : "#"} className={`bg-orange-500 text-white p-5 md:p-8 rounded-md shadow-lg transition-all flex flex-col justify-center items-center h-32 md:h-40 group ${canAccessHK ? 'hover:-translate-y-1' : 'opacity-40 cursor-not-allowed'}`}>
                                <div className="text-3xl md:text-4xl mb-1 md:mb-2 group-hover:scale-110 transition-transform">🧹</div>
                                <h2 className="text-base md:text-xl font-bold text-center leading-tight">HouseKeeping</h2>
                            </Link>
                            <Link to={canAccessMaintenance ? "/maintenance" : "#"} className={`bg-slate-700 text-white p-5 md:p-8 rounded-md shadow-lg transition-all flex flex-col justify-center items-center h-32 md:h-40 group ${canAccessMaintenance ? 'hover:-translate-y-1' : 'opacity-40 cursor-not-allowed'}`}>
                                <div className="text-3xl md:text-4xl mb-1 md:mb-2 group-hover:scale-110 transition-transform">🔧</div>
                                <h2 className="text-base md:text-xl font-bold text-center leading-tight">Maintenance</h2>
                            </Link>
                            <Link to={canAccessFront ? "/tv/501" : "#"} className={`bg-indigo-600 text-white p-5 md:p-8 rounded-md shadow-lg transition-all flex flex-col justify-center items-center h-32 md:h-40 group ${canAccessFront ? 'hover:-translate-y-1' : 'opacity-40 cursor-not-allowed'}`}>
                                <div className="text-3xl md:text-4xl mb-1 md:mb-2 group-hover:scale-110 transition-transform">📺</div>
                                <h2 className="text-base md:text-xl font-bold text-center leading-tight">Smart TV System</h2>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {showPwdModal && (
                <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center backdrop-blur-sm p-4">
                    <div className="bg-white p-6 md:p-8 rounded-md w-full max-w-sm shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl md:text-2xl font-black text-slate-800">Change Password</h2>
                            <button onClick={() => { setShowPwdModal(false); setPwdData({ old: '', new: '' }); }} className="text-slate-400 hover:text-red-500 font-bold text-2xl">&times;</button>
                        </div>
                        <label className="block text-xs md:text-sm font-bold text-slate-500 mb-2">Current Password</label>
                        <input type="password" value={pwdData.old} onChange={e => setPwdData({ ...pwdData, old: e.target.value })} className="w-full p-3 md:p-4 border rounded-md mb-4 bg-slate-50 outline-none focus:border-blue-500" placeholder="Enter current password" />
                        <label className="block text-xs md:text-sm font-bold text-slate-500 mb-2">New Password</label>
                        <input type="password" value={pwdData.new} onChange={e => setPwdData({ ...pwdData, new: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleChangePassword()} className="w-full p-3 md:p-4 border rounded-md mb-8 bg-slate-50 outline-none focus:border-blue-500" placeholder="Enter new password" />
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={handleChangePassword} className="bg-blue-600 text-white font-bold py-3 rounded-md hover:bg-blue-700 shadow-md">Confirm</button>
                            <button onClick={() => { setShowPwdModal(false); setPwdData({ old: '', new: '' }); }} className="bg-slate-200 text-slate-700 font-bold py-3 rounded-md hover:bg-slate-300">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
