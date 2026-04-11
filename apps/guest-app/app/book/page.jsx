'use client';

import React, { useState, useEffect, Suspense } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

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

const CrossfadeSlider = ({ images }) => {
    const parsedImages = images && images.length > 0 ? images.map(img => {
        if (!img) return null;
        if (typeof img === 'string') return img;
        if (typeof img === 'object') return img.url || img.src || null;
        return null;
    }).filter(Boolean) : [];

    const slideImages = parsedImages;
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (slideImages.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % slideImages.length);
        }, 3000);
        return () => clearInterval(timer);
    }, [slideImages.length]);

    if (slideImages.length === 0) {
        return (
            <div className="h-56 w-full bg-slate-200 rounded-none flex items-center justify-center text-slate-400 text-xs font-medium">
                No Photos Available
            </div>
        );
    }

    return (
        <div className="h-56 w-full relative bg-slate-900 overflow-hidden rounded-none">
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
                        <div key={idx} className={`h-1.5 rounded-none transition-all duration-500 ${idx === currentIndex ? 'bg-white w-4' : 'bg-white/40 w-1.5'}`} />
                    ))}
                </div>
            )}
        </div>
    );
};

// 💡 URL 파라미터를 읽기 위해 메인 로직을 서브 컴포넌트로 분리합니다.
function BookRoomContent() {
    const searchParams = useSearchParams();
    const initialHotel = searchParams.get('hotel');
    const initialPromo = searchParams.get('promo');
    const initialRoomType = searchParams.get('roomType');

    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // 💡 [신규 추가] 포인트 결제를 위한 State
    const [userPoints, setUserPoints] = useState(0);
    const [pointPolicy, setPointPolicy] = useState({ max_pct: 100, min_unit: 1 });
    const [pointsToUse, setPointsToUse] = useState(0);

    const [allHotels, setAllHotels] = useState([]);
    const [provinces, setProvinces] = useState([]);
    const [cities, setCities] = useState([]);
    const [filteredHotels, setFilteredHotels] = useState([]);
    const [roomTypes, setRoomTypes] = useState([]);

    const [selectedProvince, setSelectedProvince] = useState('');
    const [selectedCity, setSelectedCity] = useState('');

    const [adults, setAdults] = useState(2);
    const [kids, setKids] = useState(0);
    const [infants, setInfants] = useState(0);
    const [roomCount, setRoomCount] = useState(1);
    const [showGuestPicker, setShowGuestPicker] = useState(false);

    const [selectedRooms, setSelectedRooms] = useState({});
    const [availability, setAvailability] = useState({});
    const [paymentMethod, setPaymentMethod] = useState('Credit / Debit Card');

    const [bookingData, setBookingData] = useState({
        hotel_code: '',
        check_in_date: getDefaultDate(0),
        check_out_date: getDefaultDate(1),
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
            setUserPoints(Number(user.total_points) || 0); // 💡 [신규] 유저의 보유 포인트 로드

            setBookingData(prev => ({
                ...prev,
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                email: user.email || '',
                phone: user.phone || '',
                nationality: user.nationality || 'Philippines'
            }));
        }

        // 💡 [신규] HQ의 포인트 정책(Policy) 불러오기
        axios.get('https://api.hotelnplus.com/api/settings/point-policy')
            .then(res => {
                if (res.data && res.data.success) {
                    setPointPolicy(res.data.policy);
                }
            }).catch(() => { });

        axios.get('https://api.hotelnplus.com/api/hotels')
            .then(res => {
                const cleanHotels = (res.data || []).map(h => {
                    const extractName = (fac) => typeof fac === 'object' ? (fac.title || fac.label || fac.name || 'Facility') : String(fac);

                    let rawGallery = h.app_gallery || h.app_gallery_urls || h.gallery_json || h.gallery_urls || [];
                    if (typeof rawGallery === 'string') {
                        try { rawGallery = JSON.parse(rawGallery); } catch (e) { rawGallery = []; }
                    }
                    if (!Array.isArray(rawGallery)) rawGallery = [rawGallery];

                    let appGallery = rawGallery.map(img => {
                        if (typeof img === 'string') return img;
                        if (typeof img === 'object' && img !== null) return img.url || img.src;
                        return null;
                    }).filter(Boolean);

                    if (appGallery.length === 0 && h.image_url) appGallery = [h.image_url];
                    if (appGallery.length === 0 && h.bg_image_url) appGallery = [h.bg_image_url];

                    return {
                        ...h,
                        name: typeof h.name === 'object' ? (h.name.title || h.name.hotel_name || h.code) : h.name,
                        facilities: (h.facilities || []).map(extractName),
                        app_facilities: (h.app_facilities || []).map(extractName),
                        app_gallery: appGallery
                    };
                });

                setAllHotels(cleanHotels);
                const uniqueProvinces = [...new Set(cleanHotels.map(h => h.province).filter(Boolean))];
                setProvinces(uniqueProvinces);

                if (initialHotel && initialHotel !== 'ALL') {
                    const targetHotel = cleanHotels.find(h => h.code === initialHotel);
                    if (targetHotel) {
                        setSelectedProvince(targetHotel.province);
                        const availCities = [...new Set(cleanHotels.filter(h => h.province === targetHotel.province).map(h => h.city).filter(Boolean))];
                        setCities(availCities);
                        setSelectedCity(targetHotel.city);
                        setFilteredHotels(cleanHotels.filter(h => h.province === targetHotel.province && h.city === targetHotel.city));

                        handleHotelSelect(initialHotel, true);
                    }
                }
            })
            .catch(err => console.error("Failed to fetch hotels:", err));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const fetchAvailability = async () => {
            if (!bookingData.hotel_code || !bookingData.check_in_date || !bookingData.check_out_date || roomTypes.length === 0) {
                setAvailability({});
                return;
            }

            const newAvail = {};
            await Promise.all(roomTypes.map(async (rt) => {
                try {
                    const res = await axios.get(`https://api.hotelnplus.com/api/public/check-availability?hotel=${bookingData.hotel_code}&type=${rt.name}&check_in=${bookingData.check_in_date}&check_out=${bookingData.check_out_date}`);
                    if (res.data && res.data.count !== undefined) {
                        newAvail[rt.name] = res.data.count;
                    }
                } catch (error) {
                    console.error("Availability error:", error);
                }
            }));
            setAvailability(newAvail);
        };

        fetchAvailability();
    }, [bookingData.hotel_code, bookingData.check_in_date, bookingData.check_out_date, roomTypes]);

    const handleProvinceChange = (e) => {
        const prov = e.target.value;
        setSelectedProvince(prov);
        setSelectedCity('');
        setBookingData(prev => ({ ...prev, hotel_code: '' }));

        const availableCities = [...new Set(allHotels.filter(h => h.province === prov).map(h => h.city).filter(Boolean))];
        setCities(availableCities);
        setFilteredHotels([]);
        setSelectedRooms({});
    };

    const handleCityChange = (e) => {
        const city = e.target.value;
        setSelectedCity(city);
        setBookingData(prev => ({ ...prev, hotel_code: '' }));

        const matchingHotels = allHotels.filter(h => h.province === selectedProvince && h.city === city);
        setFilteredHotels(matchingHotels);
        setSelectedRooms({});
    };

    const handleHotelSelect = async (hCode, isAutoSelect = false) => {
        setBookingData(prev => ({ ...prev, hotel_code: hCode }));
        setSelectedRooms({});

        try {
            const res = await axios.get(`https://api.hotelnplus.com/api/room-types?hotel=${hCode}`);
            if (res.data && res.data.length > 0) {
                let formattedRoomTypes = res.data.map(rt => {
                    let rawImages = rt.images || rt.gallery_json || [];
                    if (typeof rawImages === 'string') {
                        try { rawImages = JSON.parse(rawImages); } catch (e) { rawImages = []; }
                    }
                    if (!Array.isArray(rawImages)) rawImages = [rawImages];

                    let appImages = rawImages.map(img => {
                        if (typeof img === 'string') return img;
                        if (typeof img === 'object' && img !== null) return img.url || img.src;
                        return null;
                    }).filter(Boolean);

                    return { ...rt, app_images: appImages };
                });

                if (isAutoSelect && initialRoomType) {
                    formattedRoomTypes = formattedRoomTypes.filter(rt => initialRoomType.includes(rt.name));
                }

                setRoomTypes(formattedRoomTypes);
            } else {
                setRoomTypes([]);
            }
        } catch (error) {
            console.error("Failed to fetch room types:", error);
            setRoomTypes([]);
        }
    };

    const updateRoomQty = (roomName, delta) => {
        const maxAvailable = availability[roomName];

        setSelectedRooms(prev => {
            const currentQty = prev[roomName] || 0;
            let newQty = currentQty + delta;

            if (maxAvailable !== undefined && newQty > maxAvailable) {
                newQty = maxAvailable;
            }

            if (newQty <= 0) {
                const newState = { ...prev };
                delete newState[roomName];
                return newState;
            }

            return { ...prev, [roomName]: newQty };
        });
    };

    const handleChange = (e) => {
        setBookingData({ ...bookingData, [e.target.name]: e.target.value });
    };

    const totalSelectedRoomCount = Object.values(selectedRooms).reduce((acc, cur) => acc + cur, 0);

    // 💡 [신규 추가] 실시간 금액 계산 로직
    let subTotal = 0;
    Object.entries(selectedRooms).forEach(([roomName, qty]) => {
        const matchedRoom = roomTypes.find(r => r.name === roomName);
        const price = matchedRoom ? (matchedRoom.basePrice || matchedRoom.price || 0) : 0;
        subTotal += (price * qty);
    });

    const maxPointsByPolicy = Math.floor(subTotal * (pointPolicy.max_pct / 100));
    const maxUsablePoints = Math.min(userPoints, maxPointsByPolicy);
    const finalAmount = Math.max(0, subTotal - pointsToUse);

    const handlePointChange = (e) => {
        let val = Number(e.target.value) || 0;
        if (val < 0) val = 0;
        if (val > maxUsablePoints) val = maxUsablePoints;
        setPointsToUse(val);
    };

    const applyMaxPoints = () => {
        const unit = pointPolicy.min_unit || 1;
        const leveledMax = Math.floor(maxUsablePoints / unit) * unit;
        setPointsToUse(leveledMax);
    };

    const handleNextStep = () => {
        if (!bookingData.hotel_code) return alert("Please select a hotel destination.");
        if (totalSelectedRoomCount === 0) return alert("Please select at least one room to proceed.");
        if (bookingData.check_in_date >= bookingData.check_out_date) return alert("Check-out date must be after Check-in.");

        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 💡 [신규] 제출 전 포인트 단위 검증
        if (pointsToUse > 0 && pointPolicy.min_unit > 1) {
            if (pointsToUse % pointPolicy.min_unit !== 0) {
                return alert(`Points must be used in multiples of ${pointPolicy.min_unit}.`);
            }
        }

        setIsLoading(true);

        try {
            const bookingPayloads = [];

            Object.entries(selectedRooms).forEach(([roomName, qty]) => {
                const matchedRoom = roomTypes.find(r => r.name === roomName);
                const price = matchedRoom ? (matchedRoom.basePrice || matchedRoom.price || 0) : 0;

                for (let i = 0; i < qty; i++) {
                    bookingPayloads.push({
                        hotel_code: bookingData.hotel_code,
                        channel: 'Guest App',
                        room_type: roomName,
                        check_in_date: bookingData.check_in_date,
                        check_out_date: bookingData.check_out_date,
                        guest_name: qty > 1 || Object.keys(selectedRooms).length > 1
                            ? `${bookingData.first_name} ${bookingData.last_name} (${roomName} - ${i + 1})`.trim()
                            : `${bookingData.first_name} ${bookingData.last_name}`.trim(),
                        email: bookingData.email,
                        phone: bookingData.phone,
                        nationality: bookingData.nationality,
                        adults: adults,
                        kids: kids,
                        infants: infants,
                        payment_method: paymentMethod,
                        total_price: price, // 💡 [버그 수정] 누락되었던 원본 객실 가격 전송!
                        promo_code: (initialPromo && bookingData.hotel_code === initialHotel) ? initialPromo : null
                    });
                }
            });

            // 💡 [신규] 페이로드에 총 포인트 사용량과 최종 결제 금액 추가!
            const response = await axios.post('https://api.hotelnplus.com/api/public/reservations/batch-create', {
                bookings: bookingPayloads,
                total_points_used: pointsToUse,
                final_total_amount: finalAmount
            });

            if (response.data.success || response.status === 200 || response.status === 201) {
                const selectedHotel = allHotels.find(h => h.code === bookingData.hotel_code);
                const reqId = 'REQ-' + Math.random().toString(36).substr(2, 6).toUpperCase();

                const newBookingHistory = {
                    id: reqId,
                    hotelName: selectedHotel?.name || bookingData.hotel_code,
                    checkIn: bookingData.check_in_date,
                    checkOut: bookingData.check_out_date,
                    rooms: selectedRooms,
                    totalAmount: finalAmount, // 히스토리에도 최종 결제액 저장
                    status: 'Pending',
                    createdAt: new Date().toISOString()
                };

                const existingHistory = JSON.parse(localStorage.getItem('nplus_my_bookings') || '[]');
                localStorage.setItem('nplus_my_bookings', JSON.stringify([newBookingHistory, ...existingHistory]));

                alert("Booking request submitted and payment processed! Awaiting hotel confirmation.");
                window.location.href = '/profile';
            } else {
                alert("Failed to submit booking request. Please try again.");
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
        <div className="pb-40 font-sans bg-slate-50 min-h-screen relative selection:bg-[#009900]/20" onClick={() => setShowGuestPicker(false)}>
            <style jsx global>{`
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            <div className="bg-white px-4 py-4 flex items-center justify-between sticky top-0 z-40 border-b border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={() => step === 2 ? setStep(1) : window.history.back()} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-none text-slate-600 font-semibold hover:bg-slate-200 transition-colors">
                        ←
                    </button>
                    <h1 className="text-lg font-bold text-slate-800">
                        {step === 1 ? 'Find Hotels' : 'Complete Booking'}
                    </h1>
                </div>
                <div className="text-xs font-medium text-[#009900] bg-green-50 px-2 py-1 rounded-none">
                    Step {step} of 2
                </div>
            </div>

            <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">

                <div className={`transition-all duration-300 ${step === 1 ? 'block opacity-100' : 'hidden opacity-0'}`}>

                    <div className="bg-white p-5 rounded-none shadow-sm border border-slate-200 mb-6">
                        <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="text-lg">📍</span> Select Location
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase tracking-wider">Province</label>
                                <select
                                    value={selectedProvince}
                                    onChange={handleProvinceChange}
                                    className="w-full p-3 border border-slate-300 rounded-none text-sm font-medium text-slate-800 bg-white outline-none focus:border-[#009900] cursor-pointer shadow-sm"
                                >
                                    <option value="" disabled>Select Province...</option>
                                    {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase tracking-wider">City</label>
                                <select
                                    value={selectedCity}
                                    onChange={handleCityChange}
                                    disabled={!selectedProvince}
                                    className="w-full p-3 border border-slate-300 rounded-none text-sm font-medium text-slate-800 bg-white outline-none focus:border-[#009900] cursor-pointer shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
                                >
                                    <option value="" disabled>Select City...</option>
                                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {selectedCity && filteredHotels.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-sm font-bold text-slate-800 mb-3 pl-1 flex items-center justify-between">
                                <span>Choose your stay</span>
                                <span className="text-xs font-medium text-[#009900] bg-green-100 px-2 py-0.5 rounded-none">{filteredHotels.length} found</span>
                            </h2>

                            <div className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar px-1">
                                {filteredHotels.map(h => {
                                    const isSelected = bookingData.hotel_code === h.code;
                                    const cardImgRaw = (h.app_gallery && h.app_gallery.length > 0) ? h.app_gallery[0] : h.image_url;
                                    const cardImgUrl = typeof cardImgRaw === 'object' ? (cardImgRaw?.url || cardImgRaw?.src) : cardImgRaw;

                                    return (
                                        <div
                                            key={h.code}
                                            onClick={() => handleHotelSelect(h.code)}
                                            className={`min-w-[260px] snap-center relative rounded-none overflow-hidden cursor-pointer transition-all duration-300 border-2 shadow-sm flex flex-col
                                                ${isSelected ? 'border-[#009900] scale-[1.02] shadow-green-200/50' : 'border-transparent bg-white hover:shadow-md'}`}
                                        >
                                            <div className="h-40 w-full relative bg-slate-200 flex items-center justify-center">
                                                {cardImgUrl ? (
                                                    <img src={cardImgUrl} alt={h.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-xs font-medium text-slate-400">No Photo</span>
                                                )}

                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent"></div>

                                                {isSelected && (
                                                    <div className="absolute top-3 right-3 bg-[#009900] text-white rounded-none p-1.5 shadow-lg animate-bounce">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                                    </div>
                                                )}

                                                <div className="absolute bottom-3 left-4 right-4">
                                                    <h3 className="font-bold text-white text-lg leading-tight truncate">{h.name}</h3>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white flex-1">
                                                <p className="text-xs text-slate-500 font-medium flex items-center gap-1"><span className="text-[#00aa00]">📍</span> {h.city}, {h.province}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {bookingData.hotel_code && selectedHotelData && (
                        <div className="animate-fade-in-up">

                            <div className="bg-slate-50 rounded-none border border-slate-200 mb-6 shadow-inner overflow-hidden">
                                <CrossfadeSlider images={selectedHotelData.app_gallery || []} />

                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1 pr-2">
                                            <h3 className="text-xl font-bold text-[#009900] leading-tight mb-1">{selectedHotelData.name}</h3>
                                            <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                                                <span>📍</span> {selectedHotelData.city}, {selectedHotelData.province}
                                            </p>
                                        </div>

                                        {(() => {
                                            let finalMapUrl = '';
                                            const rawMapData = String(selectedHotelData.map_url || selectedHotelData.map_embed_url || '');

                                            if (rawMapData.includes('<iframe') || rawMapData.includes('src=')) {
                                                const srcMatch = rawMapData.match(/src=["'](.*?)["']/);
                                                if (srcMatch && srcMatch[1]) {
                                                    const iframeSrc = srcMatch[1];
                                                    const qMatch = iframeSrc.match(/[?&]q=([^&]+)/);
                                                    if (qMatch && qMatch[1]) {
                                                        finalMapUrl = `http://googleusercontent.com/maps.google.com/${qMatch[1]}`;
                                                    } else {
                                                        finalMapUrl = iframeSrc;
                                                    }
                                                }
                                            } else if (rawMapData.startsWith('http')) {
                                                finalMapUrl = rawMapData;
                                            }

                                            if (!finalMapUrl) {
                                                const searchQ = encodeURIComponent(`${selectedHotelData.name}, ${selectedHotelData.city}, ${selectedHotelData.province}`);
                                                finalMapUrl = `http://googleusercontent.com/maps.google.com/${searchQ}`;
                                            }

                                            return (
                                                <a href={finalMapUrl} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-[10px] font-semibold text-[#009900] bg-green-100 hover:bg-green-200 px-3 py-2 rounded-none transition-colors whitespace-nowrap shadow-sm shrink-0 mt-1">
                                                    📍 View Map
                                                </a>
                                            );
                                        })()}
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 mb-4 mt-2">
                                        {(selectedHotelData.app_facilities && selectedHotelData.app_facilities.length > 0
                                            ? selectedHotelData.app_facilities
                                            : selectedHotelData.facilities || []).map((fac, idx) => (
                                                <span key={idx} className="bg-white text-slate-600 border border-slate-200 text-[10px] font-semibold px-2.5 py-1 rounded-none shadow-sm flex items-center gap-1">
                                                    <span className="text-[#00aa00]">✓</span> {fac}
                                                </span>
                                            ))}
                                    </div>

                                    {selectedHotelData.app_description && (
                                        <div
                                            className="text-xs font-medium text-slate-500 leading-relaxed border-t border-slate-200 pt-4"
                                            dangerouslySetInnerHTML={{
                                                __html: selectedHotelData.app_description
                                            }}
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-none shadow-sm border border-slate-200 mb-6">
                                <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <span className="text-lg">📅</span> Dates & Guests
                                </h2>

                                <div className="grid grid-cols-1 gap-4 mb-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase tracking-wider">Check-in</label>
                                            <input
                                                type="date"
                                                name="check_in_date"
                                                value={bookingData.check_in_date}
                                                min={getDefaultDate(0)}
                                                onChange={handleChange}
                                                className="w-full p-3 border border-slate-200 rounded-none text-sm font-medium text-slate-800 focus:border-[#009900] outline-none bg-slate-50 shadow-inner"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase tracking-wider">Check-out</label>
                                            <input
                                                type="date"
                                                name="check_out_date"
                                                value={bookingData.check_out_date}
                                                min={bookingData.check_in_date ? new Date(new Date(bookingData.check_in_date).getTime() + 86400000).toISOString().split('T')[0] : getDefaultDate(0)}
                                                onChange={handleChange}
                                                className="w-full p-3 border border-slate-200 rounded-none text-sm font-medium text-slate-800 focus:border-[#009900] outline-none bg-slate-50 shadow-inner"
                                            />
                                        </div>
                                    </div>

                                    <div className="relative z-20">
                                        <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase tracking-wider">Guests & Summary</label>
                                        <div
                                            onClick={(e) => { e.stopPropagation(); setShowGuestPicker(!showGuestPicker); }}
                                            className="w-full p-3 border border-slate-200 rounded-none bg-slate-50 shadow-inner text-sm font-medium text-slate-800 cursor-pointer flex justify-between items-center select-none hover:bg-slate-100 transition-colors"
                                        >
                                            <span className="truncate pr-2">
                                                {adults} Adults{kids > 0 ? `, ${kids} Kids` : ''}{infants > 0 ? `, ${infants} Infants(Free)` : ''} · {totalSelectedRoomCount} Room(s)
                                            </span>
                                            <span className="text-slate-400 font-bold shrink-0 text-xs">▼</span>
                                        </div>

                                        {showGuestPicker && (
                                            <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-none shadow-2xl border border-slate-200 p-4 z-50 animate-fade-in space-y-4 text-slate-800" onClick={e => e.stopPropagation()}>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="font-semibold text-sm">Adults</p>
                                                        <p className="text-[10px] text-slate-500">Age 13+</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button type="button" onClick={() => setAdults(Math.max(1, adults - 1))} className="w-8 h-8 rounded-none bg-slate-100 font-semibold hover:bg-slate-200">-</button>
                                                        <span className="w-4 text-center font-semibold">{adults}</span>
                                                        <button type="button" onClick={() => setAdults(adults + 1)} className="w-8 h-8 rounded-none bg-slate-100 font-semibold hover:bg-slate-200">+</button>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="font-semibold text-sm">Children</p>
                                                        <p className="text-[10px] text-slate-500">Ages 2-12</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button type="button" onClick={() => setKids(Math.max(0, kids - 1))} className="w-8 h-8 rounded-none bg-slate-100 font-semibold hover:bg-slate-200">-</button>
                                                        <span className="w-4 text-center font-semibold">{kids}</span>
                                                        <button type="button" onClick={() => setKids(kids + 1)} className="w-8 h-8 rounded-none bg-slate-100 font-semibold hover:bg-slate-200">+</button>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center bg-green-50/50 p-2 -mx-2 rounded-none border border-green-100/50">
                                                    <div>
                                                        <p className="font-semibold text-sm text-green-900">Infants</p>
                                                        <p className="text-[10px] text-green-600/80">Under 2</p>
                                                    </div>
                                                    <div className="font-bold text-green-600 bg-white px-3 py-1 rounded-none text-xs border border-green-100 shadow-sm uppercase tracking-widest">
                                                        Free
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button type="button" onClick={() => setInfants(Math.max(0, infants - 1))} className="w-8 h-8 rounded-none bg-white border border-slate-200 font-semibold hover:bg-slate-100">-</button>
                                                        <span className="w-4 text-center font-semibold text-green-700">{infants}</span>
                                                        <button type="button" onClick={() => setInfants(infants + 1)} className="w-8 h-8 rounded-none bg-white border border-slate-200 font-semibold hover:bg-slate-100">+</button>
                                                    </div>
                                                </div>
                                                <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                                                    <div>
                                                        <p className="font-semibold text-sm">Rooms</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button type="button" onClick={() => setRoomCount(Math.max(1, roomCount - 1))} className="w-8 h-8 rounded-none bg-slate-100 font-semibold hover:bg-slate-200">-</button>
                                                        <span className="w-4 text-center font-semibold">{roomCount}</span>
                                                        <button type="button" onClick={() => setRoomCount(roomCount + 1)} className="w-8 h-8 rounded-none bg-slate-100 font-semibold hover:bg-slate-200">+</button>
                                                    </div>
                                                </div>

                                                <button type="button" onClick={() => setShowGuestPicker(false)} className="w-full bg-[#009900] text-white font-semibold py-2.5 rounded-none mt-2 hover:bg-[#008000] transition-colors">
                                                    Done
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 💡 프로모션 자동 적용 시각적 피드백 */}
                                {initialPromo && bookingData.hotel_code === initialHotel && (
                                    <div className="bg-green-50 border-l-4 border-[#009900] p-4 mb-6 flex justify-between items-center shadow-sm">
                                        <div>
                                            <p className="text-xs font-medium text-green-800 uppercase tracking-widest mb-1">Special Promo Applied!</p>
                                            <p className="text-lg font-bold text-[#009900]">{initialPromo}</p>
                                        </div>
                                        <span className="text-3xl">🎁</span>
                                    </div>
                                )}

                                <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 border-t border-slate-100 pt-6">
                                    <span className="text-lg">🛏️</span> Select Room Type & Quantity
                                </h2>

                                <div className="space-y-4">
                                    {roomTypes.length > 0 ? roomTypes.map(rt => {

                                        const currentQty = selectedRooms[rt.name] || 0;
                                        const isSelected = currentQty > 0;
                                        const availCount = availability[rt.name];

                                        let config = {};
                                        try { config = typeof rt.roomConfig === 'string' ? JSON.parse(rt.roomConfig) : (rt.roomConfig || {}); } catch (e) { }

                                        const size = config.size || rt.size;
                                        const bedType = config.bedType || rt.bedType || 'Standard Bed';
                                        const maxGuests = config.maxGuests || rt.maxGuests || 2;
                                        const desc = config.description || rt.description?.en || rt.description || '';
                                        const price = rt.basePrice || rt.price || 0;

                                        const roomImgRaw = rt.app_images && rt.app_images.length > 0 ? rt.app_images[0] : null;

                                        return (
                                            <div
                                                key={rt.id}
                                                className={`rounded-none border-2 transition-all shadow-sm relative overflow-hidden group flex flex-col
                                                    ${isSelected ? 'border-[#009900] bg-green-50/20' : 'border-slate-200 bg-white'}`}
                                            >
                                                <div className="h-44 w-full relative bg-slate-100 overflow-hidden">
                                                    {roomImgRaw ? (
                                                        <img src={roomImgRaw} alt={rt.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium text-xs">No Room Image</div>
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"></div>

                                                    {isSelected && (
                                                        <div className="absolute top-4 right-4 bg-[#009900] text-white px-3 py-1 rounded-none text-xs font-bold shadow-lg animate-pulse">
                                                            {currentQty} Selected
                                                        </div>
                                                    )}

                                                    <h3 className="absolute bottom-4 left-4 font-bold text-xl text-white leading-tight pr-4">{rt.name}</h3>
                                                </div>

                                                <div className="p-5 flex-1 flex flex-col">
                                                    <div className="flex flex-wrap gap-2 mb-3 mt-1">
                                                        {size && <span className="bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-none text-[10px] font-semibold shadow-sm">📏 {size} {String(size).includes('sq') ? '' : 'sq.m'}</span>}
                                                        <span className="bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-none text-[10px] font-semibold shadow-sm">🛏️ {bedType}</span>
                                                        <span className="bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-none text-[10px] font-semibold shadow-sm">👥 Max: {maxGuests} Guests</span>
                                                    </div>

                                                    {desc && <p className="text-xs text-slate-500 font-medium mb-5 line-clamp-2 leading-relaxed flex-1">{desc}</p>}

                                                    <div className="mt-auto pt-4 border-t border-slate-100">
                                                        {availCount !== undefined && (
                                                            <div className={`mb-2 inline-flex items-center gap-1 border px-2 py-0.5 rounded-none text-[9px] font-bold ${availCount > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                                                                {availCount > 0 ? `🔥 ${availCount} ROOM(S) LEFT` : '❌ SOLD OUT'}
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between items-end">
                                                            <div>
                                                                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-0.5">Price</label>
                                                                <span className={`font-bold text-2xl ${isSelected ? 'text-green-800' : 'text-slate-800'}`}>₱{price.toLocaleString()}</span>
                                                                <span className="text-[10px] text-slate-400 font-medium ml-1">/ night</span>
                                                            </div>

                                                            {isSelected ? (
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <span className="text-[9px] font-bold text-[#009900] uppercase tracking-widest">Quantity</span>
                                                                    <div className="flex items-center gap-1.5 bg-white border-2 border-[#009900] rounded-none p-1 shadow-sm">
                                                                        <button type="button" onClick={() => updateRoomQty(rt.name, -1)} className="w-7 h-7 rounded-none bg-green-50 text-green-700 font-bold hover:bg-green-100 flex items-center justify-center transition-colors">-</button>
                                                                        <span className="w-5 text-center font-bold text-green-800 text-sm">{currentQty}</span>
                                                                        <button type="button" onClick={() => updateRoomQty(rt.name, 1)} className="w-7 h-7 rounded-none bg-green-50 text-green-700 font-bold hover:bg-green-100 flex items-center justify-center transition-colors">+</button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => updateRoomQty(rt.name, 1)}
                                                                    disabled={availCount === 0}
                                                                    className={`px-6 py-2.5 rounded-none text-xs font-bold transition-all shadow-md active:scale-95 ${availCount === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-100 text-slate-600 hover:bg-[#009900] hover:text-white'}`}
                                                                >
                                                                    {availCount === 0 ? 'Sold Out' : 'Select Room'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }) : (
                                        <p className="text-center text-slate-400 text-xs font-medium py-10 bg-slate-50 rounded-none border border-slate-100">No room types available for this hotel.</p>
                                    )}
                                </div>
                            </div>

                        </div>
                    )}

                    <div className="pt-4">
                        <button
                            onClick={handleNextStep}
                            disabled={!bookingData.hotel_code || totalSelectedRoomCount === 0}
                            className="w-full bg-[#009900] hover:bg-[#008000] text-white py-4 rounded-none font-bold text-lg shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next: Guest Details ➔
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className={`transition-all duration-300 ${step === 2 ? 'block opacity-100' : 'hidden opacity-0'}`}>
                    <div className="bg-slate-800 text-white p-5 rounded-none shadow-md mb-6">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-medium text-green-300 uppercase tracking-wider">Your Final Selection</span>
                            <button type="button" onClick={() => setStep(1)} className="text-xs font-medium underline text-slate-300 hover:text-white">Edit</button>
                        </div>
                        <p className="font-bold text-xl text-[#009900] leading-tight mb-1.5">{selectedHotelData?.name}</p>

                        <div className="space-y-1 mb-4">
                            {Object.entries(selectedRooms).map(([name, qty]) => (
                                <p key={name} className="text-xs text-slate-200 font-medium">✓ {name} × {qty}</p>
                            ))}
                        </div>

                        {initialPromo && bookingData.hotel_code === initialHotel && (
                            <div className="mt-4 mb-4 border border-green-500/50 bg-green-900/30 p-3 rounded-none flex justify-between items-center">
                                <span className="text-[10px] font-medium text-green-300 uppercase tracking-widest">Promo Code Applied</span>
                                <span className="text-sm font-bold text-green-400">{initialPromo}</span>
                            </div>
                        )}

                        <p className="text-[10px] font-medium text-slate-400 mb-4">{adults} Adults, {kids} Kids{infants > 0 ? `, ${infants} Infants` : ''} · {totalSelectedRoomCount} Room(s)</p>
                        <div className="flex items-center gap-2 text-xs font-medium text-green-200 bg-slate-700/50 p-2.5 rounded-none inline-flex">
                            <span>{bookingData.check_in_date}</span>
                            <span>➔</span>
                            <span>{bookingData.check_out_date}</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-none shadow-sm border border-slate-200 mb-6">
                        {isLoggedIn && (
                            <div className="float-right bg-green-100 text-green-700 text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-none border border-green-200 mb-2">
                                ✨ Autofilled
                            </div>
                        )}

                        <h2 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2 mt-1 clear-both">
                            <span className="text-lg">👤</span> Guest Information
                        </h2>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase tracking-wider">First Name</label>
                                    <input type="text" name="first_name" required value={bookingData.first_name} onChange={handleChange}
                                        className="w-full p-3 border border-slate-300 rounded-none text-sm font-medium text-slate-800 focus:border-[#009900] outline-none shadow-sm" placeholder="John" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase tracking-wider">Last Name</label>
                                    <input type="text" name="last_name" required value={bookingData.last_name} onChange={handleChange}
                                        className="w-full p-3 border border-slate-300 rounded-none text-sm font-medium text-slate-800 focus:border-[#009900] outline-none shadow-sm" placeholder="Doe" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase tracking-wider">Email Address</label>
                                <input type="email" name="email" required value={bookingData.email} onChange={handleChange}
                                    className={`w-full p-3 border border-slate-300 rounded-none text-sm font-medium focus:border-[#009900] outline-none shadow-sm ${isLoggedIn ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'text-slate-800'}`}
                                    readOnly={isLoggedIn} />
                            </div>

                            <div>
                                <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase tracking-wider">Phone Number</label>
                                <input type="tel" name="phone" required value={bookingData.phone} onChange={handleChange}
                                    className="w-full p-3 border border-slate-300 rounded-none text-sm font-medium text-slate-800 focus:border-[#009900] outline-none shadow-sm" placeholder="09" />
                            </div>

                            <div>
                                <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase tracking-wider">Nationality</label>
                                <select name="nationality" required value={bookingData.nationality} onChange={handleChange}
                                    className="w-full p-3 border border-slate-300 rounded-none text-sm font-medium text-slate-800 focus:border-[#009900] outline-none bg-white cursor-pointer shadow-sm">
                                    {TOP_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    <option disabled>──────────</option>
                                    {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-none shadow-sm border border-slate-200 relative overflow-hidden mb-6">
                        <h2 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2 mt-1">
                            <span className="text-lg">💳</span> Payment Method
                        </h2>

                        <div className="space-y-3">
                            {['Credit / Debit Card', 'GCash', 'Maya'].map((method) => (
                                <div
                                    key={method}
                                    onClick={() => setPaymentMethod(method)}
                                    className={`p-4 border-2 cursor-pointer transition-all flex items-center justify-between
                                        ${paymentMethod === method ? 'border-[#009900] bg-green-50/30' : 'border-slate-200 bg-white hover:border-green-300'}`}
                                >
                                    <span className={`font-semibold text-sm ${paymentMethod === method ? 'text-green-800' : 'text-slate-700'}`}>
                                        {method}
                                    </span>
                                    <div className={`w-5 h-5 border-2 flex items-center justify-center transition-colors bg-white ${paymentMethod === method ? 'border-[#009900]' : 'border-slate-300'}`}>
                                        {paymentMethod === method && <div className="w-2.5 h-2.5 bg-[#009900]"></div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] font-medium text-slate-400 mt-4 leading-relaxed">
                            * You will be securely redirected to the payment gateway after confirming your booking.
                        </p>
                    </div>

                    {/* 💡 [신규] 포인트 복합 결제 (Hybrid Payment) UI 영역 */}
                    {isLoggedIn && userPoints > 0 && (
                        <div className="bg-white p-6 rounded-none shadow-sm border border-slate-200 mb-6 border-l-4 border-l-emerald-500">
                            <h2 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2 mt-1">
                                <span className="text-lg text-emerald-500">💎</span> Pay with Points
                            </h2>
                            <div className="bg-slate-50 p-4 border border-slate-100 rounded-lg">
                                <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-3">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Balance</span>
                                    <span className="font-black text-emerald-600 text-lg flex items-baseline gap-1">
                                        {userPoints.toLocaleString()} <span className="text-[10px] text-slate-500 uppercase">pts</span>
                                    </span>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-black text-slate-700">Points to Apply</label>
                                        <span className="text-[10px] text-slate-400 font-bold">Max: {maxUsablePoints.toLocaleString()} pts (Up to {pointPolicy.max_pct}%)</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={pointsToUse || ''}
                                            onChange={handlePointChange}
                                            placeholder="0"
                                            className="flex-1 p-3 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 text-right font-black text-slate-800"
                                        />
                                        <button type="button" onClick={applyMaxPoints} className="px-5 py-3 bg-slate-800 text-white text-xs font-black rounded-lg hover:bg-slate-700 transition-colors tracking-widest uppercase">
                                            Max
                                        </button>
                                    </div>
                                    {pointPolicy.min_unit > 1 && (
                                        <p className="text-[10px] text-emerald-600 font-bold mt-2 bg-emerald-50 w-fit px-2 py-1 rounded">
                                            * Must be used in multiples of {pointPolicy.min_unit.toLocaleString()} pts
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 💡 [신규] 최종 결제 금액 요약(Summary) 패널 */}
                    <div className="bg-slate-900 text-white p-6 rounded-t-2xl shadow-xl border-b border-slate-800">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-slate-400 font-medium">Subtotal</span>
                            <span className="text-sm font-bold">₱ {subTotal.toLocaleString()}</span>
                        </div>
                        {pointsToUse > 0 && (
                            <div className="flex justify-between items-center mb-2 text-emerald-400">
                                <span className="text-sm font-bold flex items-center gap-1">💎 Points Applied</span>
                                <span className="text-sm font-black">- ₱ {pointsToUse.toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-700">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total to Pay</span>
                            <span className="text-3xl font-black text-white">₱ {finalAmount.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="pb-10">
                        <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-b-2xl font-black text-lg shadow-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2 active:scale-95 tracking-wide">
                            {isLoading ? (
                                <><span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full inline-block"></span> Processing...</>
                            ) : (
                                'Confirm & Pay ➔'
                            )}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}

export default function BookRoomPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-[#009900]">
                Loading Booking...
            </div>
        }>
            <BookRoomContent />
        </Suspense>
    );
}