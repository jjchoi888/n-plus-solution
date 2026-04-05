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

export default function BookRoomPage() {
    const [step, setStep] = useState(1); // 💡 화면 분리: 1단계(Find), 2단계(Guest)
    const [isLoading, setIsLoading] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // 지역 및 호텔 데이터 State
    const [allHotels, setAllHotels] = useState([]);
    const [provinces, setProvinces] = useState([]);
    const [cities, setCities] = useState([]);
    const [filteredHotels, setFilteredHotels] = useState([]);
    const [roomTypes, setRoomTypes] = useState([]); // 💡 선택된 호텔의 동적 객실 타입

    // 선택 상태 State
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

        // 1. 전체 호텔 목록 가져오기
        axios.get('https://api.hotelnplus.com/api/hotels')
            .then(res => {
                const hotels = res.data || [];
                setAllHotels(hotels);

                // 고유한 Province 목록 추출
                const uniqueProvinces = [...new Set(hotels.map(h => h.province).filter(Boolean))];
                setProvinces(uniqueProvinces);
            })
            .catch(err => console.error("Failed to fetch hotels:", err));
    }, []);

    // 💡 Province 선택 시 City 목록 업데이트
    const handleProvinceChange = (e) => {
        const prov = e.target.value;
        setSelectedProvince(prov);
        setSelectedCity('');
        setBookingData(prev => ({ ...prev, hotel_code: '', room_type: '' }));

        const availableCities = [...new Set(allHotels.filter(h => h.province === prov).map(h => h.city).filter(Boolean))];
        setCities(availableCities);
    };

    // 💡 City 선택 시 해당 지역 호텔 목록 업데이트
    const handleCityChange = (e) => {
        const city = e.target.value;
        setSelectedCity(city);
        setBookingData(prev => ({ ...prev, hotel_code: '', room_type: '' }));

        const matchingHotels = allHotels.filter(h => h.province === selectedProvince && h.city === city);
        setFilteredHotels(matchingHotels);
    };

    // 💡 호텔 선택 시 해당 호텔의 객실 타입(Room Types) 가져오기
    const handleHotelChange = async (e) => {
        const hCode = e.target.value;
        setBookingData(prev => ({ ...prev, hotel_code: hCode, room_type: '' }));

        try {
            // 해당 지점의 객실 타입 API 호출 (하드코딩 제거)
            const res = await axios.get(`https://api.hotelnplus.com/api/room-types?hotel=${hCode}`);
            if (res.data && res.data.length > 0) {
                setRoomTypes(res.data);
                setBookingData(prev => ({ ...prev, room_type: res.data[0].name })); // 첫 번째 룸타입 기본 선택
            } else {
                setRoomTypes([{ id: 0, name: 'Standard (Default)' }]); // 만약 등록된 룸타입이 없을 경우 방어 코드
                setBookingData(prev => ({ ...prev, room_type: 'Standard (Default)' }));
            }
        } catch (error) {
            console.error("Failed to fetch room types:", error);
            setRoomTypes([{ id: 0, name: 'Standard' }]);
            setBookingData(prev => ({ ...prev, room_type: 'Standard' }));
        }
    };

    const handleChange = (e) => {
        setBookingData({ ...bookingData, [e.target.name]: e.target.value });
    };

    // 1단계 -> 2단계 넘어가기
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

    return (
        <div className="pb-24 font-sans bg-slate-50 min-h-screen relative">
            {/* 상단 헤더 (진행도 표시) */}
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

                {/* ========================================================= */}
                {/* STEP 1: Find Hotels (목적지 및 일정 선택) */}
                {/* ========================================================= */}
                <div className={`transition-all duration-300 ${step === 1 ? 'block opacity-100' : 'hidden opacity-0'}`}>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
                        <h2 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                            <span className="text-lg">📍</span> Destination
                        </h2>

                        <div className="space-y-3 mb-6">
                            {/* Province 선택 */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Province</label>
                                <select value={selectedProvince} onChange={handleProvinceChange}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 bg-white outline-none focus:border-blue-500 cursor-pointer">
                                    <option value="" disabled>Select Province...</option>
                                    {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>

                            {/* City 선택 */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">City</label>
                                <select value={selectedCity} onChange={handleCityChange} disabled={!selectedProvince}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 bg-white outline-none focus:border-blue-500 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400">
                                    <option value="" disabled>Select City...</option>
                                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            {/* Hotel 선택 */}
                            <div>
                                <label className="block text-[10px] font-bold text-blue-600 mb-1 uppercase tracking-wider">Select Hotel</label>
                                <select name="hotel_code" value={bookingData.hotel_code} onChange={handleHotelChange} disabled={!selectedCity}
                                    className="w-full p-3 border-2 border-blue-200 rounded-lg text-sm font-black text-slate-800 bg-blue-50 outline-none focus:border-blue-600 cursor-pointer disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400">
                                    <option value="" disabled>Choose your stay...</option>
                                    {filteredHotels.map(h => <option key={h.code} value={h.code}>{h.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <h2 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 border-t border-slate-100 pt-5">
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

                        {/* 동적 Room Type 선택 */}
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Room Type</label>
                            <select name="room_type" value={bookingData.room_type} onChange={handleChange} disabled={!bookingData.hotel_code}
                                className="w-full p-3 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 bg-white outline-none focus:border-blue-500 cursor-pointer disabled:bg-slate-100">
                                {bookingData.hotel_code ? (
                                    roomTypes.map(rt => <option key={rt.id} value={rt.name}>{rt.name}</option>)
                                ) : (
                                    <option value="" disabled>Select hotel first</option>
                                )}
                            </select>
                        </div>
                    </div>

                    <button onClick={handleNextStep} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-lg shadow-lg transition-colors">
                        Next: Guest Details ➔
                    </button>
                </div>

                {/* ========================================================= */}
                {/* STEP 2: Guest Information (고객 정보 확인 및 확정) */}
                {/* ========================================================= */}
                <form onSubmit={handleSubmit} className={`transition-all duration-300 ${step === 2 ? 'block opacity-100' : 'hidden opacity-0'}`}>

                    {/* 선택 요약 카드 */}
                    <div className="bg-slate-800 text-white p-4 rounded-xl mb-6 shadow-md">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">Your Selection</span>
                            <button type="button" onClick={() => setStep(1)} className="text-xs font-bold underline text-slate-300 hover:text-white">Edit</button>
                        </div>
                        <p className="font-black text-lg leading-tight mb-1">{allHotels.find(h => h.code === bookingData.hotel_code)?.name}</p>
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
                                ✨ Autofilled from profile
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