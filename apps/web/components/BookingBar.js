"use client";
import { useState, useRef, useEffect } from "react";
import { roomApi } from "../lib/api"; 

const translations = {
  en: { destination: "Destination", whereTo: "Where are you going?", mapTitle: "Select a Region & Hotel", allHotels: "All Philippines", checkIn: "Check-In", checkOut: "Check-Out", guestsRooms: "Guests & Rooms", guests: "Guests", room: "Room", adult: "Adults", child: "Children", infant: "Infants", free: "Free", search: "Search", searching: "Searching...", error: "Notice", selectDates: "Please select both check-in and check-out dates.", fetchError: "Failed to fetch rooms. Please try again.", fullyBooked: "Fully Booked!", noRooms: "There are no rooms available for the selected dates.\nPlease try changing your check-in or check-out schedule.", ok: "OK", okChange: "Change Dates", proceed: "Proceed anyway" },
  ko: { destination: "목적지", whereTo: "어디로 떠나시나요?", mapTitle: "지역 및 호텔 선택", allHotels: "필리핀 전체", checkIn: "체크인", checkOut: "체크아웃", guestsRooms: "인원 및 객실", guests: "명", room: "객실", adult: "성인", child: "어린이", infant: "유아", free: "무료", search: "검색하기", searching: "검색 중...", error: "알림", selectDates: "체크인과 체크아웃 날짜를 모두 선택해 주세요.", fetchError: "객실 정보를 불러오지 못했습니다. 다시 시도해 주세요.", fullyBooked: "예약 마감!", noRooms: "선택하신 날짜에 예약 가능한 객실이 없습니다.\n일정을 변경해 주세요.", ok: "확인", okChange: "일정 변경하기", proceed: "남은 방으로 진행" }
};

const BASE_URL = 'https://hotel-pms-backend-production.up.railway.app';

// 🗺️ 필리핀 지역 및 지점(핀) 하드코딩 데이터
const PROVINCES = [
  { id: 'ALL', name: 'All Philippines', nameKo: '필리핀 전체', desc: 'Search all available NPLUS hotels.' },
  { id: 'MANILA', name: 'Metro Manila', nameKo: '메트로 마닐라', desc: 'The bustling heart of the Philippines.', bgUrl: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?q=80&w=1000&auto=format&fit=crop',
    hotels: [
      { code: 'NPLUS01', name: 'NPLUS Manila Premier', top: '40%', left: '45%' },
      { code: 'NPLUS05', name: 'NPLUS BGC Boutique', top: '55%', left: '55%' }
    ]
  },
  { id: 'CEBU', name: 'Cebu', nameKo: '세부', desc: 'Queen City of the South with pristine beaches.', bgUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1000&auto=format&fit=crop',
    hotels: [
      { code: 'NPLUS02', name: 'NPLUS Cebu Resort & Spa', top: '50%', left: '50%' }
    ]
  },
  { id: 'BORACAY', name: 'Boracay', nameKo: '보라카이', desc: 'World-famous white sand beaches.', bgUrl: 'https://images.unsplash.com/photo-1523592322629-416113c2e171?q=80&w=1000&auto=format&fit=crop',
    hotels: [
      { code: 'NPLUS03', name: 'NPLUS Boracay Beachfront', top: '35%', left: '60%' }
    ]
  },
  { id: 'PALAWAN', name: 'Palawan', nameKo: '팔라완', desc: 'The last ecological frontier.', bgUrl: 'https://images.unsplash.com/photo-1533664488383-7186ccf4d852?q=80&w=1000&auto=format&fit=crop',
    hotels: [
      { code: 'NPLUS04', name: 'NPLUS Palawan Eco Lodge', top: '65%', left: '35%' }
    ]
  }
];

export default function BookingBar({ lang = 'en', onSearchResults }) {
  const t = translations[lang] || translations.en;

  // 상태 관리
  const [destination, setDestination] = useState({ code: "ALL", name: t.allHotels });
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [activeProvince, setActiveProvince] = useState(PROVINCES[0]);

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [isGuestOpen, setIsGuestOpen] = useState(false);
  const [counts, setCounts] = useState({ adult: 2, child: 0, infant: 0, room: 1 });
  const guestRef = useRef(null);

  const [modal, setModal] = useState({ show: false, title: '', message: '', type: 'default', availableRoomsData: null });
  const [fees, setFees] = useState({ child: 500, extraBed: 1000 });

  useEffect(() => {
    const fetchFees = async () => {
        try {
            const res = await fetch(`${BASE_URL}/api/settings/fees`);
            const data = await res.json();
            if (data.success && data.fees) setFees({ child: data.fees.child_fee, extraBed: data.fees.extra_bed_fee });
        } catch (e) { console.error("Failed to fetch fees", e); }
    };
    fetchFees();
  }, []);

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

  // 💡 지도에서 호텔 선택 시 실행
  const handleSelectHotel = (code, name) => {
    setDestination({ code, name });
    setIsMapOpen(false); // 모달 닫기
  };

  // 💡 [핵심 수정] 낡은 검색 API 호출을 지우고, 부모(MainPortal)에게 날짜/인원/지점 파라미터만 깔끔하게 토스합니다!
  const handleSearch = (e) => {
    e.preventDefault();
    if (!checkIn || !checkOut) {
      setModal({ show: true, title: t.error, message: t.selectDates, type: 'error' });
      return;
    }
    
    // RoomList가 알아들을 수 있도록 데이터 포장해서 전달
    onSearchResults({
      checkIn,
      checkOut,
      adults: counts.adults,
      kids: counts.child,
      destination: destination.code
    });
  };

  return (
    <>
      <div className="mt-12 w-full max-w-6xl bg-white rounded-full shadow-2xl p-4 border border-gray-100 relative z-40 animate-fade-in-up">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center justify-between gap-2">
          
          {/* 💡 1. 목적지 선택 (클릭 시 지도 모달 오픈) */}
          <div onClick={() => setIsMapOpen(true)} className="flex flex-col px-6 py-2 border-b md:border-b-0 md:border-r border-gray-200 w-full md:w-[25%] cursor-pointer group">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 group-hover:text-emerald transition-colors">{t.destination}</label>
            <div className="text-gray-800 font-bold text-base truncate">
              {destination.name}
            </div>
          </div>

          <div className="flex flex-col px-6 py-2 border-b md:border-b-0 md:border-r border-gray-200 w-full md:w-[22%]">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.checkIn}</label>
            <input type="date" className="w-full text-gray-800 font-medium focus:outline-none bg-transparent cursor-pointer" 
                   required value={checkIn} onChange={handleCheckInChange} />
          </div>

          <div className="flex flex-col px-6 py-2 border-b md:border-b-0 md:border-r border-gray-200 w-full md:w-[22%]">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.checkOut}</label>
            <input type="date" className="w-full text-gray-800 font-medium focus:outline-none bg-transparent cursor-pointer" 
                   required value={checkOut} min={checkIn} onChange={(e) => setCheckOut(e.target.value)} />
          </div>

          <div className="relative flex flex-col px-6 py-2 w-full md:w-[25%]" ref={guestRef}>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.guestsRooms}</label>
            <button type="button" onClick={() => setIsGuestOpen(!isGuestOpen)} className="w-full text-left text-gray-800 font-medium focus:outline-none bg-transparent truncate hover:text-emerald transition">
              {counts.adult + counts.child} {t.guests}, {counts.room} {t.room}
            </button>

            {isGuestOpen && (
              <div className="absolute top-16 right-0 w-full md:w-80 bg-white shadow-2xl rounded-2xl p-6 border border-gray-100 z-50">
                <div className="flex justify-between items-center mb-5">
                  <div><p className="font-bold text-gray-800">{t.adult}</p><p className="text-xs text-gray-400">Ages 12 or above</p></div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => updateCount('adult', -1, 1, 99)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center font-bold text-gray-600 hover:border-emerald hover:text-emerald">-</button>
                    <span className="w-4 text-center font-bold text-gray-800">{counts.adult}</span>
                    <button type="button" onClick={() => updateCount('adult', 1, 1, 99)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center font-bold text-gray-600 hover:border-emerald hover:text-emerald">+</button>
                  </div>
                </div>
                <div className="flex justify-between items-center mb-5">
                  <div><p className="font-bold text-gray-800">{t.child}</p><p className="text-xs text-gray-400">Ages 3–11</p></div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => updateCount('child', -1, 0, 99)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center font-bold text-gray-600 hover:border-emerald hover:text-emerald">-</button>
                    <span className="w-4 text-center font-bold text-gray-800">{counts.child}</span>
                    <button type="button" onClick={() => updateCount('child', 1, 0, 99)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center font-bold text-gray-600 hover:border-emerald hover:text-emerald">+</button>
                  </div>
                </div>
                <div className="flex justify-between items-center mb-5 border-b pb-5">
                  <div><p className="font-bold text-gray-800">{t.infant} <span className="text-emerald font-black text-sm ml-1">({t.free})</span></p><p className="text-xs text-gray-400">Under 2</p></div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => updateCount('infant', -1, 0, 99)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center font-bold text-gray-600 hover:border-emerald hover:text-emerald">-</button>
                    <span className="w-4 text-center font-bold text-gray-800">{counts.infant}</span>
                    <button type="button" onClick={() => updateCount('infant', 1, 0, 99)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center font-bold text-gray-600 hover:border-emerald hover:text-emerald">+</button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div><p className="font-bold text-emerald">{t.room}</p></div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => updateCount('room', -1, 1, 99)} className="w-8 h-8 rounded-full border border-emerald flex items-center justify-center font-bold text-emerald hover:bg-emerald-50">-</button>
                    <span className="w-4 text-center font-bold text-emerald">{counts.room}</span>
                    <button type="button" onClick={() => updateCount('room', 1, 1, 99)} className="w-8 h-8 rounded-full border border-emerald flex items-center justify-center font-bold text-emerald hover:bg-emerald-50">+</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="w-full md:w-auto pr-2">
            <button type="submit" disabled={isLoading} className={`w-full md:w-auto px-10 py-4 rounded-full font-bold shadow-md transition-all whitespace-nowrap text-white ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald hover:bg-emerald-dark hover:shadow-lg'}`}>
              {isLoading ? t.searching : t.search}
            </button>
          </div>

        </form>
      </div>

      {/* ==========================================
          🗺️ INTERACTIVE MAP MODAL (지역 및 호텔 선택기)
      ========================================== */}
      {isMapOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[2rem] overflow-hidden flex flex-col md:flex-row shadow-2xl relative">
            
            {/* 닫기 버튼 */}
            <button onClick={() => setIsMapOpen(false)} className="absolute top-4 right-4 z-50 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors text-slate-800 font-bold text-xl">
              ✕
            </button>

            {/* 왼쪽 패널: 지역(Province) 리스트 */}
            <div className="w-full md:w-1/3 bg-slate-50 border-r border-slate-200 flex flex-col h-full">
              <div className="p-8 pb-4">
                <h2 className="text-3xl font-black text-slate-900 mb-2">{t.mapTitle}</h2>
                <p className="text-slate-500 font-medium">{t.whereTo}</p>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-2">
                {PROVINCES.map(prov => (
                  <div 
                    key={prov.id} 
                    onClick={() => setActiveProvince(prov)}
                    className={`p-5 rounded-2xl cursor-pointer transition-all ${activeProvince.id === prov.id ? 'bg-emerald text-white shadow-lg transform scale-[1.02]' : 'bg-white hover:bg-emerald/10 text-slate-800 border border-slate-100'}`}
                  >
                    <h3 className="font-bold text-lg">{lang === 'ko' ? (prov.nameKo || prov.name) : prov.name}</h3>
                    <p className={`text-sm mt-1 ${activeProvince.id === prov.id ? 'text-emerald-100' : 'text-slate-500'}`}>{prov.desc}</p>
                  </div>
                ))}
              </div>
              
              {/* 전체 검색용 버튼 */}
              <div className="p-6 bg-white border-t border-slate-200">
                <button onClick={() => handleSelectHotel('ALL', t.allHotels)} className="w-full py-4 rounded-xl border-2 border-slate-800 text-slate-800 font-black hover:bg-slate-800 hover:text-white transition-colors">
                  🔍 Search All Regions
                </button>
              </div>
            </div>

            {/* 오른쪽 패널: 인터랙티브 지도 뷰 */}
            <div className="w-full md:w-2/3 h-full relative bg-slate-900 flex items-center justify-center overflow-hidden">
              {activeProvince.id === 'ALL' ? (
                <div className="text-center p-8">
                  <div className="text-8xl mb-6">🇵🇭</div>
                  <h3 className="text-3xl font-black text-white mb-4">Explore the Philippines</h3>
                  <p className="text-slate-400 text-lg">Select a province from the left to view hotel locations.</p>
                </div>
              ) : (
                <>
                  {/* 지역별 멋진 배경 사진 (지도 대용) */}
                  <div className="absolute inset-0 transition-opacity duration-500">
                    <img src={activeProvince.bgUrl} alt={activeProvince.name} className="w-full h-full object-cover opacity-60 mix-blend-overlay" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
                  </div>
                  
                  {/* 중앙 지역 타이틀 */}
                  <h3 className="absolute bottom-12 left-12 text-5xl font-black text-white drop-shadow-2xl opacity-50 z-10">
                    {lang === 'ko' ? (activeProvince.nameKo || activeProvince.name) : activeProvince.name}
                  </h3>

                  {/* 📍 인터랙티브 호텔 핀 생성 */}
                  {activeProvince.hotels?.map((hotel, idx) => (
                    <div 
                      key={idx} 
                      className="absolute group cursor-pointer z-20 animate-fade-in-up"
                      style={{ top: hotel.top, left: hotel.left }}
                      onClick={() => handleSelectHotel(hotel.code, hotel.name)}
                    >
                      {/* 맥박 치는 애니메이션 링 */}
                      <div className="absolute -inset-4 bg-emerald/30 rounded-full animate-ping"></div>
                      
                      {/* 실제 핀 아이콘 */}
                      <div className="relative w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-2xl shadow-black border-4 border-emerald transform transition-transform group-hover:scale-110 group-hover:bg-emerald text-xl">
                        🏨
                      </div>

                      {/* 호버 시 나타나는 말풍선(Tooltip) */}
                      <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-white text-slate-900 px-4 py-2 rounded-lg font-black text-sm shadow-2xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {hotel.name}
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 border-8 border-transparent border-b-white"></div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 기존 Error/Partial 예약 모달 */}
      {modal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[300] p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center transform transition-all scale-100">
            <div className="bg-gray-900 p-8"><span className="text-6xl drop-shadow-lg">{modal.type === 'error' ? '⚠️' : '🏨'}</span></div>
            <div className="p-8">
              <h3 className="text-2xl font-black text-gray-800 mb-4">{modal.title}</h3>
              <p className={`text-gray-600 text-sm mb-8 leading-relaxed whitespace-pre-wrap ${modal.type === 'partial' ? 'text-left bg-gray-50 p-4 rounded-xl border border-gray-100' : 'text-center'}`}>{modal.message}</p>
              {modal.type === 'partial' ? (
                  <div className="flex flex-col gap-3">
                      <button onClick={() => { setModal({ show: false, title: '', message: '', type: 'default', availableRoomsData: null }); onSearchResults({ rooms: modal.availableRoomsData, searchParams: { checkIn, checkOut, guests: counts, destination: destination.code } }); }} className="w-full bg-emerald hover:bg-emerald-dark text-white font-bold py-3.5 rounded-xl shadow-md transition-colors text-base">{t.proceed}</button>
                      <button onClick={() => setModal({ show: false, title: '', message: '', type: 'default', availableRoomsData: null })} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3.5 rounded-xl transition-colors text-base">{t.okChange}</button>
                  </div>
              ) : (
                  <button onClick={() => setModal({ show: false, title: '', message: '', type: 'default', availableRoomsData: null })} className="w-full bg-emerald hover:bg-emerald-dark text-white font-bold py-3.5 rounded-xl shadow-md transition-colors text-lg">{modal.type === 'full' ? t.okChange : t.ok}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}