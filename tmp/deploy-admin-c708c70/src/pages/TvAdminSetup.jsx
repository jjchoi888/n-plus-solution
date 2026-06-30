import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function TvAdminSetup() {
    const navigate = useNavigate();

    const [pinCode, setPinCode] = useState('');
    const [hotelCode, setHotelCode] = useState('');
    const [roomNumber, setRoomNumber] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isPinVerified, setIsPinVerified] = useState(false);

    // 💡 관리자 핀 번호 (실제 환경에서는 환경변수나 서버 검증을 추천합니다)
    const ADMIN_PIN = '0000';

    useEffect(() => {
        // 이미 세팅이 완료된 TV라면 바로 객실 화면으로 리다이렉트 처리도 가능합니다.
        // const savedHotelCode = localStorage.getItem('hotelCode');
        // if (savedHotelCode) { ... }
    }, []);

    const handleKeyClick = (e, action) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            action();
        }
    };

    const handlePinSubmit = () => {
        if (pinCode === ADMIN_PIN) {
            setIsPinVerified(true);
            setErrorMsg('');
        } else {
            setErrorMsg('Invalid PIN Code. Please try again.');
            setPinCode('');
        }
    };

    const handleSaveSettings = () => {
        if (!hotelCode || !roomNumber) {
            setErrorMsg('Please fill in all fields.');
            return;
        }

        // 💡 1. hotelCode를 로컬 스토리지에 저장하여 Tv.jsx에서 읽을 수 있게 함
        localStorage.setItem('hotelCode', hotelCode);

        // 💡 2. 해당 객실의 TV 화면으로 라우팅 이동
        navigate(`/tv/${roomNumber}`);
    };

    return (
        <div className="bg-slate-950 text-white w-screen h-screen flex items-center justify-center font-sans select-none relative">
            <div className="bg-slate-900 p-12 rounded-[2rem] border-2 border-slate-700 w-[600px] shadow-2xl animate-fade-in flex flex-col items-center">
                <div className="text-6xl mb-6">⚙️</div>
                <h2 className="text-4xl font-black mb-2 text-white">TV System Setup</h2>
                <p className="text-slate-400 mb-8 text-lg">n+ HOTEL PMS Device Management</p>

                {errorMsg && (
                    <div className="bg-red-500/20 text-red-400 border border-red-500/50 p-4 rounded-md w-full mb-6 text-center font-bold">
                        {errorMsg}
                    </div>
                )}

                {!isPinVerified ? (
                    // --- 1단계: 관리자 PIN 인증 ---
                    <div className="w-full flex flex-col items-center">
                        <label className="text-slate-300 text-xl font-bold mb-4">Enter Admin PIN</label>
                        <input
                            type="password"
                            autoFocus
                            value={pinCode}
                            onChange={(e) => setPinCode(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handlePinSubmit();
                            }}
                            className="w-full bg-slate-800 border-2 border-slate-600 text-center text-4xl p-4 rounded-md text-white tracking-[1em] mb-8 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/50 transition-all"
                            maxLength={4}
                            placeholder="****"
                        />
                        <button
                            tabIndex={0}
                            onClick={handlePinSubmit}
                            onKeyDown={(e) => handleKeyClick(e, handlePinSubmit)}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-md text-2xl font-bold shadow-lg transition-all focus:outline-none focus:ring-8 focus:ring-yellow-400"
                        >
                            Verify
                        </button>
                    </div>
                ) : (
                    // --- 2단계: 지점 및 객실 정보 입력 ---
                    <div className="w-full flex flex-col gap-6">
                        <div>
                            <label className="block text-slate-300 text-xl font-bold mb-2">Hotel Code</label>
                            <input
                                type="text"
                                autoFocus
                                value={hotelCode}
                                onChange={(e) => setHotelCode(e.target.value.toUpperCase())}
                                className="w-full bg-slate-800 border-2 border-slate-600 p-4 rounded-md text-white text-2xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/50 uppercase"
                                placeholder="e.g., NPLUS_MANILA"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-300 text-xl font-bold mb-2">Room Number</label>
                            <input
                                type="text"
                                value={roomNumber}
                                onChange={(e) => setRoomNumber(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveSettings();
                                }}
                                className="w-full bg-slate-800 border-2 border-slate-600 p-4 rounded-md text-white text-2xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/50"
                                placeholder="e.g., 501"
                            />
                        </div>
                        <button
                            tabIndex={0}
                            onClick={handleSaveSettings}
                            onKeyDown={(e) => handleKeyClick(e, handleSaveSettings)}
                            className="w-full bg-green-600 hover:bg-green-500 text-white py-5 mt-4 rounded-md text-2xl font-bold shadow-lg transition-all focus:outline-none focus:ring-8 focus:ring-yellow-400"
                        >
                            Save & Initialize TV
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}