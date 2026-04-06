'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';

export default function PromosPage() {
    const [promos, setPromos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [partnerHotels, setPartnerHotels] = useState([]);

    // 💡 검색 필터용 상태 (State) 추가
    const [selectedProvince, setSelectedProvince] = useState('ALL');
    const [selectedCity, setSelectedCity] = useState('ALL');

    useEffect(() => {
        const fetchPromoData = async () => {
            try {
                // 호텔 목록 API
                const hotelRes = await axios.get('https://api.hotelnplus.com/api/hotels').catch(() => ({ data: [] }));
                setPartnerHotels(hotelRes.data || []);

                // 프로모션 목록 API
                const promoRes = await axios.get('https://api.hotelnplus.com/api/promotions');

                if (promoRes.data && Array.isArray(promoRes.data)) {
                    // 호텔 이름과 지역 정보 병합
                    const enrichedPromotions = promoRes.data.map(promo => {
                        const matchedHotel = (hotelRes.data || []).find(h => h.code === promo.hotel_code) || {};
                        return {
                            ...promo,
                            hotel_name: promo.hotel_name || matchedHotel.name || "Partner Hotel",
                            city: promo.city || matchedHotel.city || "",
                            province: promo.province || matchedHotel.province || "",
                        };
                    });
                    setPromos(enrichedPromotions);
                } else {
                    setPromos([]);
                }
            } catch (err) {
                console.error("Failed to load promotions:", err.message);
                setPromos([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPromoData();
    }, []);

    const handleBookNow = (promo) => {
        // 예약 페이지(/book)로 이동하면서 파라미터를 넘깁니다.
        const targetUrl = `/book?hotel=${promo.hotel_code || 'ALL'}&promo=${promo.code}&roomType=${encodeURIComponent(promo.target_room_type || '')}`;
        window.location.href = targetUrl;
    };

    // 💡 필터 옵션 추출 (중복 제거)
    const availableProvinces = ["ALL", ...Array.from(new Set(promos.map(p => p.province).filter(Boolean)))];
    const availableCities = ["ALL", ...Array.from(new Set(
        promos
            .filter(p => selectedProvince === "ALL" || p.province === selectedProvince)
            .map(p => p.city)
            .filter(Boolean)
    ))];

    // 💡 선택된 필터에 맞춰 프로모션 리스트 필터링
    const filteredPromos = promos.filter(promo => {
        const matchProvince = selectedProvince === "ALL" || promo.province === selectedProvince;
        const matchCity = selectedCity === "ALL" || promo.city === selectedCity;
        return matchProvince && matchCity;
    });

    return (
        <div className="bg-slate-50 min-h-screen font-sans pb-20 selection:bg-[#009900]/20 text-slate-700">
            {/* 상단 헤더 */}
            <div className="bg-white p-4 sticky top-0 z-30 shadow-sm border-b border-slate-200 flex items-center gap-3">
                <Link href="/" className="text-slate-500 hover:text-slate-800 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path>
                    </svg>
                </Link>
                <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
                    <span>🎁</span> Special Offers & Packages
                </h1>
            </div>

            {/* 💡 지역 검색 필터 (헤더 바로 아래) */}
            {!isLoading && promos.length > 0 && (
                <div className="bg-white px-4 py-3 border-b border-slate-200 shadow-sm sticky top-[60px] z-20 flex gap-2">
                    <select
                        value={selectedProvince}
                        onChange={(e) => {
                            setSelectedProvince(e.target.value);
                            setSelectedCity('ALL'); // Province가 바뀌면 City는 초기화
                        }}
                        className="flex-1 p-2 border border-slate-300 rounded-none text-sm font-medium text-slate-700 bg-slate-50 focus:outline-none focus:border-[#009900] truncate"
                    >
                        {availableProvinces.map(prov => (
                            <option key={prov} value={prov}>{prov === 'ALL' ? 'All Provinces' : prov}</option>
                        ))}
                    </select>

                    <select
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        disabled={availableCities.length <= 1} // 선택 가능한 도시가 없으면 비활성화
                        className="flex-1 p-2 border border-slate-300 rounded-none text-sm font-medium text-slate-700 bg-slate-50 focus:outline-none focus:border-[#009900] disabled:bg-slate-200 disabled:text-slate-400 truncate"
                    >
                        {availableCities.map(city => (
                            <option key={city} value={city}>{city === 'ALL' ? 'All Cities' : city}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* 프로모션 리스트 출력 영역 */}
            <div className="p-4 md:p-6 space-y-6 max-w-md mx-auto">
                {isLoading ? (
                    <div className="text-center py-20 text-[#009900] font-semibold text-sm">Loading offers...</div>
                ) : filteredPromos.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 font-medium text-sm">
                        <span className="text-4xl mb-4 block">🔍</span>
                        No offers found for the selected location.
                    </div>
                ) : (
                    // 💡 promos.map -> filteredPromos.map 으로 변경하여 필터링된 결과만 출력
                    filteredPromos.map(promo => (
                        <div key={promo.id} className="bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col rounded-none">

                            {/* 썸네일 이미지 및 OFF 뱃지 */}
                            <div className="h-48 relative bg-slate-200 shrink-0">
                                <img src={promo.image_url} alt={promo.title} className="w-full h-full object-cover" />
                                {promo.discount_pct && (
                                    <div className="absolute top-4 left-4 bg-red-600 text-white text-xs font-bold px-3 py-1 shadow-md rounded-none">
                                        {promo.discount_pct}% OFF
                                    </div>
                                )}
                            </div>

                            {/* 프로모션 상세 정보 */}
                            <div className="p-5 flex flex-col flex-1">
                                <h2 className="text-xl font-bold text-slate-900 mb-1 leading-tight">{promo.title}</h2>

                                <div className="mb-4 pb-4 border-b border-slate-100">
                                    <p className="text-sm font-semibold text-slate-800">{promo.hotel_name}</p>
                                    <p className="text-xs font-medium text-[#009900] flex items-center gap-1 mt-1">
                                        <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path>
                                        </svg>
                                        <span className="truncate">{promo.city}{promo.province ? `, ${promo.province}` : ''}</span>
                                    </p>
                                </div>

                                {/* 적용 가능한 객실 타입 */}
                                {promo.target_room_type && (
                                    <div className="mb-6">
                                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50/50 px-2.5 py-1.5 border border-blue-100 rounded-none inline-block">
                                            🛏️ {promo.target_room_type}
                                        </span>
                                    </div>
                                )}

                                {/* 하단 영역 */}
                                <div className="mt-auto">
                                    <div className="bg-[#f0fdf4] border border-[#dcfce7] p-3 flex justify-between items-center mb-4 rounded-none">
                                        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Promo Code</span>
                                        <span className="text-base font-bold text-[#009900] font-mono">{promo.code}</span>
                                    </div>

                                    <div className="flex items-end justify-between border-t border-slate-100 pt-4">
                                        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest leading-relaxed">
                                            Valid Until:<br />
                                            <span className="text-red-600 font-semibold normal-case text-xs">{promo.end_date}</span>
                                        </span>
                                        <button
                                            onClick={() => handleBookNow(promo)}
                                            className="bg-slate-900 text-white font-semibold px-6 py-2.5 text-sm hover:bg-slate-800 transition-colors shadow-md active:scale-95 rounded-none"
                                        >
                                            Book Now
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}