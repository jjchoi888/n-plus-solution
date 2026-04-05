'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';

const TOP_COUNTRIES = ["Philippines", "South Korea", "China", "United States"];
const ALL_COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Argentina", "Australia", "Canada",
    "France", "Germany", "India", "Indonesia", "Japan", "Malaysia", "Singapore",
    "Taiwan", "Thailand", "United Kingdom", "Vietnam"
];

const getDefaultDate = (offsetDays = 0) => {
    const now = new Date();
    now.setDate(now.getDate() + offsetDays);
    return now.toISOString().split('T')[0];
};

// 💡 [수정] 크로스페이드 슬라이더: 객체([object Object]) 에러 완벽 차단 및 기본 이미지 고화질 적용
const CrossfadeSlider = ({ images }) => {
    // 💡 안전하게 이미지 URL만 추출하는 마법의 함수
    const getSafeUrl = (img) => {
        const fallback = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800'; // 고화질 리조트 뷰
        if (!img) return fallback;
        if (typeof img === 'string') return img;
        if (typeof img === 'object') return img.url || img.src || fallback;
        return fallback;
    };

    const slideImages = images && images.length > 0 ? images.map(getSafeUrl) : [getSafeUrl(null)];
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (slideImages.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % slideImages.length);
        }, 3000);
        return () => clearInterval(timer);
    }, [slideImages.length]);

    return (
        <div className="h-56 w-full relative bg-slate-900 overflow-hidden rounded-t-xl">
            {slideImages.map((imgUrl, idx) => (
                <img
                    key={idx}
                    src={imgUrl}
                    alt={`Hotel View ${idx + 1}`}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out
                        ${idx === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent z-10"></div>

            {slideImages.length > 1 && (
                <div className="absolute bottom-4 right-4 flex gap-1.5 z-20">
                    {slideImages.map((_, idx) => (
                        <div key={idx} className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentIndex ? 'bg-white w-4' : 'bg-white/40 w-1.5'}`} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default function BookRoomPage() {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const [allHotels, setAllHotels] = useState([]);
    const [provinces, setProvinces] = useState([]);
    const [cities, setCities] = useState([]);
    const [filteredHotels, setFilteredHotels] = useState([]);
    const [roomTypes, setRoomTypes] = useState([]);

    const [selectedProvince, setSelectedProvince] = useState('');
    const [selectedCity, setSelectedCity] = useState('');

    const [bookingData, setBookingData] = useState({
        hotel_code: '',
        check_in_date: getDefaultDate(0),
        check_out_date: getDefaultDate(1),
        room_type: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        nationality: 'Philippines'
    });

    useEffect(() => {
        const savedUser = localStorage.getItem('nplus_guest_user');
        if (savedUser) {
            const user = JSON.parse(savedUser);
            setIsLoggedIn(true);
            setBookingData(prev => ({
                ...prev,
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                email: user.email || '',
                phone: user.phone || '',
                nationality: user.nationality || 'Philippines'
            }));
        }

        axios.get('https://api.hotelnplus.com/api/hotels')
            .then(res => {
                const cleanHotels = (res.data || []).map(h => {
                    const extractName = (fac) => typeof fac === 'object' ? (fac.title || fac.label || fac.name || 'Facility') : String(fac);
                    return {
                        ...h,
                        name: typeof h.name === 'object' ? (h.name.title || h.name.hotel_name || h.code) : h.name,
                        facilities: (h.facilities || []).map(extractName),
                        app_facilities: (h.app_facilities || []).map(extractName)
                    };
                });

                setAllHotels(cleanHotels);
                const uniqueProvinces = [...new Set(cleanHotels.map(h => h.province).filter(Boolean))];
                setProvinces(uniqueProvinces);
            })
            .catch(err => console.error("Failed to fetch hotels:", err));
    }, []);

    const handleProvinceChange = (e) => {
        const prov = e.target.value;
        setSelectedProvince(prov);
        setSelectedCity('');
        setBookingData(prev => ({ ...prev, hotel_code: '', room_type: '' }));

        const availableCities = [...new Set(allHotels.filter(h => h.province === prov).map(h => h.city).filter(Boolean))];
        setCities(availableCities);
        setFilteredHotels([]);
    };

    const handleCityChange = (e) => {
        const city = e.target.value;
        setSelectedCity(city);
        setBookingData(prev => ({ ...prev, hotel_code: '', room_type: '' }));

        const matchingHotels = allHotels.filter(h => h.province === selectedProvince && h.city === city);
        setFilteredHotels(matchingHotels);
    };

    const handleHotelSelect = async (hCode) => {
        setBookingData(prev => ({ ...prev, hotel_code: hCode, room_type: '' }));

        try {
            const res = await axios.get(`https://api.hotelnplus.com/api/room-types?hotel=${hCode}`);
            if (res.data && res.data.length > 0) {
                setRoomTypes(res.data);
                setBookingData(prev => ({ ...prev, hotel_code: hCode, room_type: res.data[0].name }));
            } else {
                setRoomTypes([{ id: 0, name: 'Standard (Default)' }]);
                setBookingData(prev => ({ ...prev, hotel_code: hCode, room_type: 'Standard (Default)' }));
            }
        } catch (error) {
            console.error("Failed to fetch room types:", error);
            setRoomTypes([{ id: 0, name: 'Standard' }]);
            setBookingData(prev => ({ ...prev, hotel_code: hCode, room_type: 'Standard' }));
        }
    };

    const handleChange = (e) => {
        setBookingData({ ...bookingData, [e.target.name]: e.target.value });
    };

    const handleNextStep = () => {
        if (!bookingData.hotel_code) return alert("Please select a hotel destination.");
        if (!bookingData.room_type) return alert("Please select a room type.");
        if (bookingData.check_in_date >= bookingData.check_out_date) return alert("Check-out date must be after Check-in.");

        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const payload = {
                hotel_code: bookingData.hotel_code,
                channel: 'Hotel Web',
                room_type: bookingData.room_type,
                check_in_date: bookingData.check_in_date,
                check_out_date: bookingData.check_out_date,
                guest_name: `${bookingData.first_name} ${bookingData.last_name}`.trim(),
                email: bookingData.email,
                phone: bookingData.phone,
                nationality: bookingData.nationality
            };

            const response = await axios.post('https://api.hotelnplus.com/api/reservations/create', payload);

            if (response.data.success || response.status === 200 || response.status === 201) {
                alert("Booking confirmed successfully! We look forward to your stay.");
                window.location.href = '/';
            } else {
                alert("Failed to confirm booking. Please try again.");
            }
        } catch (error) {
            console.error("Booking Error:", error);
            alert("Network error occurred while processing your booking.");
        } finally {
            setIsLoading(false);
        }
    };

    const selectedHotelData = allHotels.find(h => h.code === bookingData.hotel_code);

    return (
        <div className="pb-24 font-sans bg-slate-50 min-h-screen relative">
            <style jsx global>{`
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            <div className="bg-white px-4 py-4 flex items-center justify-between sticky top-0 z-40 border-b border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={() => step === 2 ? setStep(1) : window.history.back()} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-600 font-bold hover:bg-slate-200">
                        ←
                    </button>
                    <h1 className="text-lg font-black text-slate-800">
                        {step === 1 ? 'Find Hotels' : 'Complete Booking'}
                    </h1>
                </div>
                <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                    Step {step} of 2
                </div>
            </div>

            <div className="p-4 md:p-6 space-y-6">

                {/* ======================================================= */}
                {/* STEP 1: Find Hotels */}
                {/* ======================================================= */}
                <div className={`transition-all duration-300 ${step === 1 ? 'block opacity-100' : 'hidden opacity-0'}`}>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
                        <h2 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                            <span className="text-lg">📍</span> Select Location
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Province</label>
                                <select value={selectedProvince} onChange={handleProvinceChange}
                                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 bg-white outline-none focus:border-blue-500 cursor-pointer shadow-sm">
                                    <option value="" disabled>Select Province...</option>
                                    {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">City</label>
                                <select value={selectedCity} onChange={handleCityChange} disabled={!selectedProvince}
                                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 bg-white outline-none focus:border-blue-500 cursor-pointer shadow-sm disabled:bg-slate-50 disabled:text-slate-400">
                                    <option value="" disabled>Select City...</option>
                                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 가로 슬라이드 호텔 카드 */}
                    {selectedCity && filteredHotels.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-sm font-black text-slate-800 mb-3 pl-1 flex items-center justify-between">
                                <span>Choose your stay</span>
                                <span className="text-xs font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">{filteredHotels.length} found</span>
                            </h2>

                            <div className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar px-1">
                                {filteredHotels.map(h => {
                                    const isSelected = bookingData.hotel_code === h.code;

                                    // 💡 여기도 안전하게 이미지 파싱 적용
                                    const cardImgRaw = (h.app_gallery && h.app_gallery.length > 0) ? h.app_gallery[0] : h.image_url;
                                    const cardImgUrl = typeof cardImgRaw === 'object' ? (cardImgRaw?.url || cardImgRaw?.src) : cardImgRaw;

                                    return (
                                        <div
                                            key={h.code}
                                            onClick={() => handleHotelSelect(h.code)}
                                            className={`min-w-[260px] snap-center relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 border-2 shadow-sm 
                                                ${isSelected ? 'border-blue-600 scale-[1.02] shadow-blue-200/50' : 'border-transparent bg-white hover:shadow-md'}`}
                                        >
                                            <div className="h-40 w-full relative bg-slate-200">
                                                <img src={cardImgUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800'} alt={h.name} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent"></div>

                                                {isSelected && (
                                                    <div className="absolute top-3 right-3 bg-blue-600 text-white rounded-full p-1.5 shadow-lg animate-bounce">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                                    </div>
                                                )}

                                                <div className="absolute bottom-3 left-4 right-4">
                                                    <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-0.5">Partner Hotel</p>
                                                    <h3 className="font-black text-white text-lg leading-tight truncate">{h.name}</h3>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white">
                                                <p className="text-xs text-slate-500 font-bold flex items-center gap-1"><span className="text-blue-500">📍</span> {h.city}, {h.province}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* 호텔 상세 소개 & 날짜/객실 선택 */}
                    {bookingData.hotel_code && selectedHotelData && (
                        <div className="animate-fade-in-up">

                            <div className="bg-slate-50 rounded-xl border border-slate-200 mb-6 shadow-inner overflow-hidden">

                                <CrossfadeSlider images={selectedHotelData.app_gallery || []} />

                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        {/* 💡 [수정 3] "Welcome to" 삭제, 호텔명(파란색) / 하단에 📍 지역명 표시 */}
                                        <div className="flex-1 pr-2">
                                            <h3 className="text-xl font-black text-blue-600 leading-tight mb-1">{selectedHotelData.name}</h3>
                                            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                                                <span>📍</span> {selectedHotelData.city}, {selectedHotelData.province}
                                            </p>
                                        </div>

                                        {/* 💡 [수정 2] iframe 에러 방지 & 구글맵 모바일 앱 자동 검색 링크(Search Intent) 생성! */}
                                        {(() => {
                                            const mapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedHotelData.name} ${selectedHotelData.city} ${selectedHotelData.province}`)}`;
                                            return (
                                                <a href={mapSearchUrl} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-[10px] font-black text-blue-600 bg-blue-100 hover:bg-blue-200 px-3 py-2 rounded-xl transition-colors whitespace-nowrap shadow-sm shrink-0">
                                                    📍 View Map
                                                </a>
                                            );
                                        })()}
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 mb-4 mt-2">
                                        {(selectedHotelData.app_facilities && selectedHotelData.app_facilities.length > 0
                                            ? selectedHotelData.app_facilities
                                            : selectedHotelData.facilities || []).map((fac, idx) => (
                                                <span key={idx} className="bg-white text-slate-600 border border-slate-200 text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                                                    <span className="text-blue-500">✓</span> {fac}
                                                </span>
                                            ))}
                                    </div>

                                    {/* 💡 HTML 태그 노출 방어 */}
                                    <div
                                        className="text-xs font-bold text-slate-500 leading-relaxed border-t border-slate-200 pt-4"
                                        dangerouslySetInnerHTML={{
                                            __html: selectedHotelData.app_description || "Experience premium service and ultimate relaxation."
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
                                <h2 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                                    <span className="text-lg">📅</span> Dates & Room
                                </h2>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Check-in</label>
                                        <input type="date" name="check_in_date" value={bookingData.check_in_date} onChange={handleChange}
                                            className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:border-blue-500 outline-none bg-slate-50" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Check-out</label>
                                        <input type="date" name="check_out_date" value={bookingData.check_out_date} onChange={handleChange}
                                            className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:border-blue-500 outline-none bg-slate-50" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Select Room Type</label>
                                    <select name="room_type" value={bookingData.room_type} onChange={handleChange}
                                        className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm font-black text-slate-800 bg-white outline-none focus:border-blue-500 cursor-pointer shadow-sm">
                                        {roomTypes.map(rt => <option key={rt.id} value={rt.name}>{rt.name}</option>)}
                                    </select>
                                </div>
                            </div>

                        </div>
                    )}

                    <button onClick={handleNextStep} disabled={!bookingData.hotel_code} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-lg shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        Next: Guest Details ➔
                    </button>
                </div>

                {/* ======================================================= */}
                {/* STEP 2: Guest Information */}
                {/* ======================================================= */}
                <form onSubmit={handleSubmit} className={`transition-all duration-300 ${step === 2 ? 'block opacity-100' : 'hidden opacity-0'}`}>
                    <div className="bg-slate-800 text-white p-4 rounded-xl mb-6 shadow-md">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">Your Selection</span>
                            <button type="button" onClick={() => setStep(1)} className="text-xs font-bold underline text-slate-300 hover:text-white">Edit</button>
                        </div>
                        <p className="font-black text-lg leading-tight mb-1">{selectedHotelData?.name}</p>
                        <p className="text-sm text-slate-300 mb-3">{bookingData.room_type}</p>
                        <div className="flex items-center gap-2 text-xs font-bold text-blue-200 bg-slate-700/50 p-2 rounded-lg inline-flex">
                            <span>{bookingData.check_in_date}</span>
                            <span>➔</span>
                            <span>{bookingData.check_out_date}</span>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden mb-24">
                        {isLoggedIn && (
                            <div className="absolute top-0 right-0 bg-blue-100 text-blue-700 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl border-l border-b border-blue-200">
                                ✨ Autofilled
                            </div>
                        )}

                        <h2 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 mt-2">
                            <span className="text-lg">👤</span> Guest Information
                        </h2>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">First Name</label>
                                    <input type="text" name="first_name" required value={bookingData.first_name} onChange={handleChange}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:border-blue-500 outline-none" placeholder="John" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Last Name</label>
                                    <input type="text" name="last_name" required value={bookingData.last_name} onChange={handleChange}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:border-blue-500 outline-none" placeholder="Doe" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Email Address</label>
                                <input type="email" name="email" required value={bookingData.email} onChange={handleChange}
                                    className={`w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none ${isLoggedIn ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'text-slate-800'}`}
                                    readOnly={isLoggedIn} />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Phone Number</label>
                                <input type="tel" name="phone" required value={bookingData.phone} onChange={handleChange}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:border-blue-500 outline-none" placeholder="+63 917 123 4567" />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Nationality</label>
                                <select name="nationality" required value={bookingData.nationality} onChange={handleChange}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:border-blue-500 outline-none bg-white cursor-pointer">
                                    {TOP_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    <option disabled>──────────</option>
                                    {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-50">
                        <div className="max-w-md mx-auto">
                            <button type="submit" disabled={isLoading} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black text-lg shadow-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2">
                                {isLoading ? (
                                    <><span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full inline-block"></span> Processing...</>
                                ) : (
                                    'Confirm Booking ➔'
                                )}
                            </button>
                        </div>
                    </div>
                </form>

            </div>
        </div>
    );
}