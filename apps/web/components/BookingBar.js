"use client";
import { useState, useRef, useEffect } from "react";
import { roomApi } from "../lib/api"; 

const translations = {
  en: { destination: "Destination", whereTo: "Where are you going?", mapTitle: "Select Region & Hotel", allHotels: "All Philippines", checkIn: "Check-In", checkOut: "Check-Out", guestsRooms: "Guests & Rooms", guests: "Guests", room: "Room", adult: "Adults", child: "Children", infant: "Infants", free: "Free", search: "Search", searching: "Searching...", error: "Notice", selectDates: "Please select both check-in and check-out dates.", fetchError: "Failed to fetch rooms. Please try again.", fullyBooked: "Fully Booked!", noRooms: "There are no rooms available for the selected dates.\nPlease try changing your check-in or check-out schedule.", ok: "OK", okChange: "Change Dates", proceed: "Proceed anyway", viewOnMap: "View on Map", selectHotel: "Select Hotel" },
  ko: { destination: "목적지", whereTo: "어디로 떠나시나요?", mapTitle: "지역 및 호텔 선택", allHotels: "필리핀 전체", checkIn: "체크인", checkOut: "체크아웃", guestsRooms: "인원 및 객실", guests: "명", room: "객실", adult: "성인", child: "어린이", infant: "유아", free: "무료", search: "검색하기", searching: "검색 중...", error: "알림", selectDates: "체크인과 체크아웃 날짜를 모두 선택해 주세요.", fetchError: "객실 정보를 불러오지 못했습니다. 다시 시도해 주세요.", fullyBooked: "예약 마감!", noRooms: "선택하신 날짜에 예약 가능한 객실이 없습니다.\n일정을 변경해 주세요.", ok: "확인", okChange: "일정 변경하기", proceed: "남은 방으로 진행", viewOnMap: "지도에서 보기", selectHotel: "이 호텔 선택하기" }
};

const BASE_URL = '';

// 💡 [추가] 낮 12시 이전이면 날짜를 하루 빼서 '호텔 영업일' 기준으로 맞춰주는 함수
const getHotelDate = (offsetDays = 0) => {
    const now = new Date();
    if (now.getHours() < 12) now.setDate(now.getDate() - 1);
    now.setDate(now.getDate() + offsetDays);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// 🗺️ 1. 필리핀 Region -> City/Municipal 계층형 데이터 (호텔 주소 포함)
const PH_LOCATIONS = [
  {
    region: "NCR (Metro Manila)",
    cities: [
      { name: "Makati City", hotels: [{ code: "NPLUS01", name: "NPLUS Manila Premier", address: "Makati, Metro Manila, Philippines" }] },
      { name: "Taguig City (BGC)", hotels: [{ code: "NPLUS05", name: "NPLUS BGC Boutique", address: "BGC, Taguig, Metro Manila, Philippines" }] },
      { name: "Quezon City", hotels: [{ code: "NPLUS06", name: "NPLUS QC Suites", address: "Quezon City, Metro Manila, Philippines" }] }
    ]
  },
  {
    region: "Central Visayas",
    cities: [
      { name: "Cebu City", hotels: [{ code: "NPLUS02", name: "NPLUS Cebu Resort & Spa", address: "Cebu City, Cebu, Philippines" }] },
      { name: "Lapu-Lapu City", hotels: [{ code: "NPLUS07", name: "NPLUS Mactan Ocean", address: "Lapu-Lapu City, Cebu, Philippines" }] }
    ]
  },
  {
    region: "Western Visayas",
    cities: [
      { name: "Malay (Boracay)", hotels: [{ code: "NPLUS03", name: "NPLUS Boracay Beachfront", address: "Boracay Island, Malay, Aklan, Philippines" }] }
    ]
  },
  {
    region: "MIMAROPA",
    cities: [
      { name: "El Nido", hotels: [{ code: "NPLUS04", name: "NPLUS Palawan Eco Lodge", address: "El Nido, Palawan, Philippines" }] },
      { name: "Puerto Princesa", hotels: [{ code: "NPLUS08", name: "NPLUS Puerto City Hotel", address: "Puerto Princesa, Palawan, Philippines" }] }
    ]
  }
];

export default function BookingBar({ lang = 'en', onSearchResults }) {
  const t = translations[lang] || translations.en;

  // 기본 예약 상태 관리
  const [destination, setDestination] = useState({ code: "ALL", name: t.allHotels });
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGuestOpen, setIsGuestOpen] = useState(false);
  const [counts, setCounts] = useState({ adult: 2, child: 0, infant: 0, room: 1 });
  const guestRef = useRef(null);
  const [modal, setModal] = useState({ show: false, title: '', message: '', type: 'default', availableRoomsData: null });

  // 🗺️ 모달 & 구글맵 상태 관리
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [mapQuery, setMapQuery] = useState("Philippines"); // 구글맵 Iframe 검색어
  const [activeMapHotel, setActiveMapHotel] = useState(null); // 지도에 포커스된 호텔

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (guestRef.current && !guestRef.current.contains(event.target)) setIsGuestOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCheckInChange = (e) => {
    const selectedDate = e.target.value;
    setCheckIn(selectedDate);
    if (selectedDate) {
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      setCheckOut(nextDay.toISOString().split('T')[0]);
    }
  };

  const updateCount = (type, delta, min, max) => {
    setCounts(prev => {
      const newVal = prev[type] + delta;
      if (newVal >= min && newVal <= max) return { ...prev, [type]: newVal };
      return prev;
    });
  };

  // 💡 [드롭다운 로직] Region 선택 시
  const handleRegionChange = (e) => {
    const val = e.target.value;
    setSelectedRegion(val);
    setSelectedCity(""); // Region이 바뀌면 City 초기화
    setActiveMapHotel(null);
    setMapQuery(val ? `${val}, Philippines` : "Philippines");
  };

  // 💡 [드롭다운 로직] City 선택 시
  const handleCityChange = (e) => {
    const val = e.target.value;
    setSelectedCity(val);
    setActiveMapHotel(null);
    setMapQuery(val ? `${val}, ${selectedRegion}, Philippines` : `${selectedRegion}, Philippines`);
  };

  // 💡 호텔 리스트 클릭 시 (지도 뷰어 이동용)
  const handleHotelFocus = (hotel) => {
    setActiveMapHotel(hotel);
    setMapQuery(hotel.address);
  };

  // 💡 최종 호텔(지점) 선택 적용
  const handleSelectHotel = (code, name) => {
    setDestination({ code, name });
    setIsMapOpen(false); // 모달 닫기
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!checkIn || !checkOut) {
      setModal({ show: true, title: t.error, message: t.selectDates, type: 'error' });
      return;
    }
    onSearchResults({
      checkIn, checkOut, adults: counts.adult, kids: counts.child, destination: destination.code
    });
  };

  // 💡 필터링된 호탤 리스트 계산
  const availableCities = selectedRegion ? PH_LOCATIONS.find(r => r.region === selectedRegion)?.cities || [] : [];
  let filteredHotels = [];
  if (selectedCity) {
    filteredHotels = availableCities.find(c => c.name === selectedCity)?.hotels || [];
  } else if (selectedRegion) {
    availableCities.forEach(c => { filteredHotels = [...filteredHotels, ...c.hotels]; });
  } else {
    PH_LOCATIONS.forEach(r => { r.cities.forEach(c => { filteredHotels = [...filteredHotels, ...c.hotels]; }); });
  }

  return (
    <>
      <div className="mt-4 w-full max-w-6xl bg-white rounded-full shadow-lg p-3 border border-gray-100 relative z-40 animate-fade-in-up">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center justify-between gap-2">
          
          {/* 💡 [수정] id="destination-trigger" 추가 완료 */}
          <div id="destination-trigger" onClick={() => setIsMapOpen(true)} className="flex flex-col px-6 py-2 border-b md:border-b-0 md:border-r border-gray-200 w-full md:w-[25%] cursor-pointer group">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 group-hover:text-emerald-600 transition-colors">{t.destination}</label>
            <div className="text-gray-800 font-bold text-base truncate">{destination.name}</div>
          </div>

          <div className="flex flex-col px-6 py-2 border-b md:border-b-0 md:border-r border-gray-200 w-full md:w-[22%]">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.checkIn}</label>
            {/* 💡 min 속성을 getHotelDate(0)으로 변경하여 낮 12시 이전에는 어제 날짜도 선택 가능하도록 허용 */}
            <input type="date" className="w-full text-gray-800 font-bold focus:outline-none bg-transparent cursor-pointer" required value={checkIn} min={getHotelDate(0)} onChange={handleCheckInChange} />
          </div>

          <div className="flex flex-col px-6 py-2 border-b md:border-b-0 md:border-r border-gray-200 w-full md:w-[22%]">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.checkOut}</label>
            {/* 💡 여기도 기본 min 값을 getHotelDate(0)으로 적용 */}
            <input type="date" className="w-full text-gray-800 font-bold focus:outline-none bg-transparent cursor-pointer" required value={checkOut} min={checkIn ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().split('T')[0] : getHotelDate(0)} onChange={(e) => setCheckOut(e.target.value)} />
          </div>

          <div className="relative flex flex-col px-6 py-2 w-full md:w-[25%]" ref={guestRef}>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.guestsRooms}</label>
            <button type="button" onClick={() => setIsGuestOpen(!isGuestOpen)} className="w-full text-left text-gray-800 font-bold focus:outline-none bg-transparent truncate hover:text-emerald-600 transition">
              {counts.adult + counts.child} {t.guests}, {counts.room} {t.room}
            </button>

            {isGuestOpen && (
              <div className="absolute top-16 right-0 w-full md:w-80 bg-white shadow-2xl rounded-2xl p-6 border border-gray-100 z-50">
                <div className="flex justify-between items-center mb-5">
                  <div><p className="font-bold text-gray-800">{t.adult}</p><p className="text-xs text-gray-400">Ages 12 or above</p></div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => updateCount('adult', -1, 1, 99)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center font-bold text-gray-600 hover:border-emerald-600 hover:text-emerald-600">-</button>
                    <span className="w-4 text-center font-bold text-gray-800">{counts.adult}</span>
                    <button type="button" onClick={() => updateCount('adult', 1, 1, 99)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center font-bold text-gray-600 hover:border-emerald-600 hover:text-emerald-600">+</button>
                  </div>
                </div>
                <div className="flex justify-between items-center mb-5">
                  <div><p className="font-bold text-gray-800">{t.child}</p><p className="text-xs text-gray-400">Ages 3–11</p></div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => updateCount('child', -1, 0, 99)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center font-bold text-gray-600 hover:border-emerald-600 hover:text-emerald-600">-</button>
                    <span className="w-4 text-center font-bold text-gray-800">{counts.child}</span>
                    <button type="button" onClick={() => updateCount('child', 1, 0, 99)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center font-bold text-gray-600 hover:border-emerald-600 hover:text-emerald-600">+</button>
                  </div>
                </div>
                <div className="flex justify-between items-center mb-5 border-b pb-5">
                  <div><p className="font-bold text-gray-800">{t.infant} <span className="text-emerald-600 font-black text-sm ml-1">({t.free})</span></p><p className="text-xs text-gray-400">Under 2</p></div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => updateCount('infant', -1, 0, 99)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center font-bold text-gray-600 hover:border-emerald-600 hover:text-emerald-600">-</button>
                    <span className="w-4 text-center font-bold text-gray-800">{counts.infant}</span>
                    <button type="button" onClick={() => updateCount('infant', 1, 0, 99)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center font-bold text-gray-600 hover:border-emerald-600 hover:text-emerald-600">+</button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div><p className="font-bold text-emerald-600">{t.room}</p></div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => updateCount('room', -1, 1, 99)} className="w-8 h-8 rounded-full border border-emerald-600 flex items-center justify-center font-bold text-emerald-600 hover:bg-emerald-50">-</button>
                    <span className="w-4 text-center font-bold text-emerald-600">{counts.room}</span>
                    <button type="button" onClick={() => updateCount('room', 1, 1, 99)} className="w-8 h-8 rounded-full border border-emerald-600 flex items-center justify-center font-bold text-emerald-600 hover:bg-emerald-50">+</button>
                  </div>
                </div>
                <button type="button" onClick={() => setIsGuestOpen(false)} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl mt-4 hover:bg-slate-800 transition-colors">{t.ok}</button>
              </div>
            )}
          </div>

          <div className="w-full md:w-auto pr-2">
            <button type="submit" disabled={isLoading} className={`w-full md:w-auto px-10 py-3.5 rounded-full font-black shadow-md transition-all whitespace-nowrap text-white ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg active:scale-95'}`}>
              {isLoading ? t.searching : t.search}
            </button>
          </div>

        </form>
      </div>

      {/* ==========================================
          🗺️ GOOGLE MAPS & DYNAMIC FILTERS MODAL
      ========================================== */}
      {isMapOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsMapOpen(false)}>
          <div className="bg-slate-50 w-full max-w-6xl h-[85vh] rounded-[2rem] overflow-hidden flex flex-col md:flex-row shadow-2xl relative" onClick={e => e.stopPropagation()}>
            
            <button onClick={() => setIsMapOpen(false)} className="absolute top-4 right-4 z-50 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-800 font-bold text-xl">
              ✕
            </button>

            {/* 왼쪽 패널: 지역(Region) -> 도시(City) 필터 & 리스트 */}
            <div className="w-full md:w-1/3 bg-white border-r border-slate-200 flex flex-col h-full shadow-lg z-10">
              
              <div className="p-6 pb-4 border-b border-slate-100">
                <h2 className="text-2xl font-black text-slate-900 mb-4">{t.mapTitle}</h2>
                
                {/* 1. 맨 위로 올린 전체 지역 검색 버튼 */}
                <button onClick={() => handleSelectHotel('ALL', t.allHotels)} className="w-full py-3.5 mb-5 rounded-xl bg-slate-900 text-white font-black hover:bg-slate-800 transition-colors shadow-md flex items-center justify-center gap-2">
                  🌍 Search All Regions
                </button>

                {/* 2. 연동형 드롭다운 필터 */}
                <div className="space-y-3">
                  <select 
                    className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-colors cursor-pointer" 
                    value={selectedRegion} 
                    onChange={handleRegionChange}
                  >
                    <option value="">🗺️ Select Region </option>
                    {PH_LOCATIONS.map(loc => (
                      <option key={loc.region} value={loc.region}>{loc.region}</option>
                    ))}
                  </select>

                  <select 
                    className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" 
                    value={selectedCity} 
                    onChange={handleCityChange} 
                    disabled={!selectedRegion}
                  >
                    <option value="">🏙️ Select City/Municipal </option>
                    {availableCities.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. 필터링된 호텔 리스트 (스크롤) */}
              <div className="overflow-y-auto flex-1 p-4 space-y-3 bg-slate-50">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Available Hotels ({filteredHotels.length})</div>
                
                {filteredHotels.length > 0 ? filteredHotels.map(hotel => (
                  <div 
                    key={hotel.code} 
                    className={`p-5 rounded-2xl cursor-pointer transition-all border shadow-sm ${activeMapHotel?.code === hotel.code ? 'bg-emerald-50 border-emerald-500 shadow-md ring-2 ring-emerald-200' : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md'}`} 
                    onClick={() => handleHotelFocus(hotel)}
                  >
                    <h3 className="font-black text-lg text-slate-800 mb-1">{hotel.name}</h3>
                    <p className="text-xs text-slate-500 font-medium mb-4 flex items-start gap-1">
                      <span className="mt-0.5 text-emerald-600">📍</span> {hotel.address}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); handleHotelFocus(hotel); }} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${activeMapHotel?.code === hotel.code ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {t.viewOnMap}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleSelectHotel(hotel.code, hotel.name); }} className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-lg text-sm hover:bg-emerald-700 transition-colors shadow-sm">
                        {t.selectHotel}
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-10 text-slate-400 font-bold flex flex-col items-center">
                    <span className="text-4xl mb-3">📭</span>
                    No hotels found in this area.
                  </div>
                )}
              </div>
            </div>

            {/* 오른쪽 패널: 🗺️ 동적 구글맵 Iframe 연동 */}
            <div className="w-full md:w-2/3 h-[50vh] md:h-full relative bg-slate-200 flex items-center justify-center overflow-hidden">
              <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-md font-bold text-sm text-slate-700 border border-slate-200 flex items-center gap-2 pointer-events-none">
                 <span className="animate-pulse text-red-500">🔴</span> Live Google Maps
              </div>
              
              {/* API 키가 필요 없는 구글맵 주소 검색 Iframe */}
              <iframe 
                  title="Google Maps Location"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=m&z=14&ie=UTF8&iwloc=&output=embed`} 
                  width="100%"
                  height="100%" 
                  frameBorder="0" 
                  style={{ border: 0 }} 
                  allowFullScreen="" 
                  aria-hidden="false" 
                  tabIndex="0"
                  className="absolute inset-0 w-full h-full bg-slate-100"
              ></iframe>
            </div>
          </div>
        </div>
      )}

      {/* 기본 알림/에러 모달 */}
      {modal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center transform transition-all scale-100 border border-slate-100">
            <div className="bg-slate-900 p-6"><span className="text-5xl drop-shadow-lg">{modal.type === 'error' ? '⚠️' : 'ℹ️'}</span></div>
            <div className="p-8">
              <h3 className="text-2xl font-black text-slate-800 mb-4">{modal.title}</h3>
              <p className={`text-slate-600 text-sm mb-8 leading-relaxed whitespace-pre-wrap ${modal.type === 'partial' ? 'text-left bg-slate-50 p-4 rounded-xl border border-slate-100' : 'text-center'}`}>{modal.message}</p>
              <button onClick={() => setModal({ show: false, title: '', message: '', type: 'default', availableRoomsData: null })} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-md transition-colors text-lg active:scale-95">{t.ok}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}