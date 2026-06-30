import React, { useState, useEffect } from "react";

// 💡 [수정] 부모(Admin)로부터 otaConfigs 데이터를 Props로 전달받습니다.
export default function ChannelRateManager({ otaConfigs = [] }) {
    const currentHotelCode = sessionStorage.getItem('hotelCode') || '';

    // 1. 상태 관리
    const [roomTypes, setRoomTypes] = useState([]);

    // 💡 초기값은 공식 웹(n+ Direct) 하나만 둡니다. (나머지는 아래 useEffect에서 자동 생성)
    const [channels, setChannels] = useState([
        { id: 'nplus', name: 'n+ Direct (공식웹)', markup: 0, commission: 1.5, isActive: true, isNative: true }
    ]);
    const [selectedRoomIdx, setSelectedRoomIdx] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // 💡 [핵심] otaConfigs가 변경될 때마다 하드코딩 목록을 동적으로 업데이트합니다.
    useEffect(() => {
        setChannels(prev => {
            // 공식 웹(n+ Direct) 정보는 유지
            const nativeChannel = prev.find(c => c.isNative) || { id: 'nplus', name: 'n+ Direct (공식웹)', markup: 0, commission: 1.5, isActive: true, isNative: true };

            // 밑에 등록된 OTA 중에서 'Live Sync ON' (is_active === 1) 인 채널만 가져옵니다.
            const activeOtAs = otaConfigs.filter(c => c.is_active === 1 || c.is_active === true);

            const dynamicChannels = activeOtAs.map(ota => {
                // 기존에 사용자가 입력해둔 마진값이 있다면 날아가지 않게 유지
                const existing = prev.find(p => p.name === ota.channel);

                // OTA별 기본 수수료 추정치 세팅 (Booking/Expedia는 통상 18%, 나머진 15%)
                let estCommission = 15;
                if (ota.channel.toLowerCase().includes('booking') || ota.channel.toLowerCase().includes('expedia')) {
                    estCommission = 18;
                }

                return {
                    id: ota.channel.toLowerCase().replace(/[^a-z0-9]/g, ''), // 아이디는 소문자/공백제거
                    name: ota.channel,
                    markup: existing ? existing.markup : 0, // 기본 마진 0% 시작
                    commission: existing ? existing.commission : estCommission,
                    isActive: true,
                    isNative: false
                };
            });

            // 공식웹을 맨 위에 두고, 그 아래에 활성화된 OTA들을 붙여서 화면에 렌더링
            return [nativeChannel, ...dynamicChannels];
        });
    }, [otaConfigs]);

    // 2. 실데이터 로드: DB에서 객실 타입 가져오기
    useEffect(() => {
        const fetchRoomData = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/admin/room-types?hotel=${currentHotelCode}`);
                const data = await res.json();

                if (data.success && data.rooms) {
                    const formatted = data.rooms.map(r => ({
                        id: r.id,
                        name: r.name?.en || r.name || 'Unnamed Room',
                        basePrice: r.basePrice || 0,
                        breakfastPrice: r.breakfastPrice || 500
                    }));
                    setRoomTypes(formatted);
                }
            } catch (e) {
                console.error("Room fetch failed:", e);
            } finally {
                setIsLoading(false);
            }
        };

        if (currentHotelCode) fetchRoomData();
    }, [currentHotelCode]);

    const handleRoomBaseChange = (field, value) => {
        const updated = [...roomTypes];
        updated[selectedRoomIdx][field] = Number(value);
        setRoomTypes(updated);
    };

    const handleChannelMarkupChange = (id, value) => {
        setChannels(prev => prev.map(ch => ch.id === id ? { ...ch, markup: Number(value) } : ch));
    };

    // 3. 서버 전송: 동기화 및 마진값 저장
    const handleSave = async () => {
        try {
            const payload = {
                hotel_code: currentHotelCode,
                room_rates: roomTypes,
                channel_margins: channels
            };

            console.log("📦 [Frontend Payload to Backend]:", JSON.stringify(payload, null, 2));

            const res = await fetch('/api/admin/ota-sync/rates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (result.success) {
                alert("✅ All rates and markups have been saved and pushed to Channex!");
            } else {
                alert("❌ Sync failed: " + result.message);
            }
        } catch (e) {
            alert("🚨 Network error. Could not connect to the sync server.");
        }
    };

    if (isLoading) return <div className="p-10 text-center font-bold text-slate-400">Loading live room data...</div>;
    if (roomTypes.length === 0) return <div className="p-10 text-center font-bold text-slate-400">No room types found. Please create rooms first.</div>;

    const activeRoom = roomTypes[selectedRoomIdx];

    return (
        <div className="animate-fade-in font-sans">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Channel Rate Manager</h2>
                    <p className="text-xs font-bold text-slate-500 mt-1">Multi-Room & Meal Plan Management</p>
                </div>
                <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-black shadow-lg transition-all active:scale-95">
                    Sync All to OTA ➔
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* 왼쪽 객실 리스트 */}
                <div className="lg:col-span-4 space-y-2">
                    {roomTypes.map((room, idx) => (
                        <div
                            key={room.id}
                            onClick={() => setSelectedRoomIdx(idx)}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedRoomIdx === idx ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                        >
                            <div className="flex justify-between items-center">
                                <span className={`font-bold ${selectedRoomIdx === idx ? 'text-blue-700' : 'text-slate-700'}`}>{room.name}</span>
                                <span className="text-[10px] font-black text-slate-400">₱{room.basePrice.toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 오른쪽 가격 설정 구역 */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
                            ⚙️ {activeRoom.name} Base
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Room Only (₱)</label>
                                <input type="number" value={activeRoom.basePrice} onChange={(e) => handleRoomBaseChange('basePrice', e.target.value)} className="w-full text-xl font-black p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Breakfast (₱)</label>
                                <input type="number" value={activeRoom.breakfastPrice} onChange={(e) => handleRoomBaseChange('breakfastPrice', e.target.value)} className="w-full text-xl font-black p-3 bg-orange-50/30 border-orange-100 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-orange-600" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {channels.map(ch => {
                            const finalRoomOnly = activeRoom.basePrice * (1 + ch.markup / 100);
                            const finalWithBreakfast = (activeRoom.basePrice + activeRoom.breakfastPrice) * (1 + ch.markup / 100);
                            return (
                                <div key={ch.id} className={`bg-white rounded-xl border p-4 transition-all ${ch.isNative ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-100'}`}>
                                    <div className="flex flex-col md:flex-row gap-4 items-center">
                                        <div className="w-full md:w-40 shrink-0">
                                            <p className="font-bold text-slate-800 text-sm">{ch.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <input type="number" value={ch.markup} onChange={(e) => handleChannelMarkupChange(ch.id, e.target.value)} className="w-12 p-1 border rounded text-[10px] font-black text-center text-blue-600 outline-none" />
                                                <span className="text-[10px] font-bold text-slate-400">% Markup</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 grid grid-cols-2 gap-3 w-full">
                                            <div className="bg-slate-50 p-2 rounded-lg text-center">
                                                <p className="text-[8px] font-black text-slate-400 uppercase">Room Only</p>
                                                <p className="text-sm font-black text-slate-700">₱{Math.round(finalRoomOnly).toLocaleString()}</p>
                                            </div>
                                            <div className="bg-orange-50 p-2 rounded-lg text-center">
                                                <p className="text-[8px] font-black text-orange-400 uppercase">+ Breakfast</p>
                                                <p className="text-sm font-black text-orange-700">₱{Math.round(finalWithBreakfast).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="hidden xl:block text-right shrink-0">
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">Est. Net ({-ch.commission}%)</p>
                                            <p className="text-xs font-black text-emerald-600">₱{Math.round(finalRoomOnly * (1 - ch.commission / 100)).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}