"use client";
import { useState, useEffect } from "react";
import RoomList from "./RoomList";

const BASE_URL = 'https://hotel-pms-backend-production.up.railway.app';

export default function HotelWebsite({ domain }) {
  const [config, setConfig] = useState(null);
  const [rooms, setRooms] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [activeMenu, setActiveMenu] = useState('HOME'); 
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  
  // 💡 [추가 1] 부대시설과 관광지도 메인 화면처럼 슬라이드 되도록 타이머 상태 추가
  const [roomSlideIdx, setRoomSlideIdx] = useState(0);

  // 💡 [신규] 고급 예약 시스템(날짜, 인원, 방 갯수) 전용 상태 추가
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  const [infants, setInfants] = useState(0); // 유아 추가
  const [roomCount, setRoomCount] = useState(1);
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [facSlideIdx, setFacSlideIdx] = useState(0);
  const [attSlideIdx, setAttSlideIdx] = useState(0);
  
  const [activeFacIdx, setActiveFacIdx] = useState(0);
  const [activeAttIdx, setActiveAttIdx] = useState(0);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false); // 💡 4개 국어 예약 알림창 스위치 추가

  const getHotelCodeFromDomain = (hostname) => {
    if (hostname.includes('seoul') || hostname.includes('127.0.0.1')) return 'NPLUS02'; 
    if (hostname.includes('busan')) return 'NPLUS03';
    return 'NPLUS01';
  };

  const hotelCode = getHotelCodeFromDomain(domain);

  useEffect(() => {
    fetch(`${BASE_URL}/api/settings/website?hotel=${hotelCode}`)
      .then(res => res.json())
      .then(data => { if (data && data.success && data.config) setConfig(data.config); })
      .catch(err => console.error("Failed to load config", err));

    fetch(`${BASE_URL}/api/admin/room-types?hotel=${hotelCode}`)
      .then(r => r.json())
      .then(adminData => {
          if(adminData.success) {
              const formattedRooms = adminData.rooms.map(r => ({
                  id: r.id, name: typeof r.name === 'object' ? r.name.en : r.name,
                  price: r.basePrice, images: r.images || [], availableCount: 5, roomConfig: r.roomConfig
              }));
              setRooms(formattedRooms);
              if(formattedRooms.length > 0) setSelectedRoomId(formattedRooms[0].id);
          }
      })
      .finally(() => setLoading(false));
  }, [domain, hotelCode]);

  const safeConfig = config || {};
  let gallery = []; try { gallery = JSON.parse(safeConfig.gallery_json || '[]'); } catch(e){}
  let sns = {}; try { sns = JSON.parse(safeConfig.sns_json || '{}'); } catch(e){}
  
  let facilities = []; try { facilities = JSON.parse(safeConfig.facilities_json || '[]'); } catch(e){}
  let attractions = []; try { attractions = JSON.parse(safeConfig.attractions_json || '[]'); } catch(e){}

  const themeColor = safeConfig.theme_color?.startsWith('#') ? safeConfig.theme_color : '#2563eb';
  const themeFont = safeConfig.theme_font || 'Inter';
  const sliderStyle = safeConfig.slider_style || 'fade';
  
  const sliderImages = [];
  if (gallery.length > 0) sliderImages.push(...gallery);
  else if (safeConfig.bg_image_url) sliderImages.push(safeConfig.bg_image_url);
  if (sliderImages.length === 0) sliderImages.push("https://images.unsplash.com/photo-1542314831-c6a4d27a658d?q=80&w=2000&auto=format&fit=crop"); 

  // 💡 [추가 2] 현재 보고 있는 탭에 맞춰서 사진이 돌아가도록 타이머 최적화
  useEffect(() => {
    let timer;
    if (activeMenu === 'HOME' && sliderImages.length > 1) {
        timer = setInterval(() => setCurrentSlide(prev => (prev + 1) % sliderImages.length), 4000);
    } else if (activeMenu === 'ROOMS') {
        timer = setInterval(() => setRoomSlideIdx(prev => prev + 1), 3500);
    } else if (activeMenu === 'FACILITIES') {
        timer = setInterval(() => setFacSlideIdx(prev => prev + 1), 3500);
    } else if (activeMenu === 'ATTRACTIONS') {
        timer = setInterval(() => setAttSlideIdx(prev => prev + 1), 3500);
    }
    return () => clearInterval(timer);
  }, [activeMenu, sliderImages.length]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-xl font-bold text-slate-500 bg-slate-50">Loading your perfect stay...</div>;

  const activeRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0];

  const handleTabClick = (e, setter, value) => {
      setter(value);
      if (e.target) {
          e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
  };

  const htmlRenderClass = "leading-relaxed text-slate-600 font-medium text-sm md:text-base [&>h1]:text-3xl [&>h1]:font-black [&>h1]:mb-3 [&>h1]:text-slate-800 [&>h3]:text-xl [&>h3]:font-bold [&>h3]:mb-2 [&>h3]:text-slate-800 [&>p]:mb-2";

  // 💡 [추가 3] 백오피스에서 드래그로 저장된 텍스트 위치(좌표) 파싱 (안전장치 포함)
  // 💡 [분리형 좌표 적용] 타이틀과 서브타이틀 각각의 좌표 파싱 (구버전 호환)
  let textPos = { title: {x: 50, y: 40}, subtitle: {x: 50, y: 55} };
  try { 
      if(safeConfig.welcome_text_pos) {
          const raw = JSON.parse(safeConfig.welcome_text_pos);
          if (raw.title && raw.subtitle) textPos = raw;
          else textPos = { title: {x: raw.x || 50, y: Math.max(0, (raw.y || 50) - 10)}, subtitle: {x: raw.x || 50, y: Math.min(100, (raw.y || 50) + 10)} };
      }
  } catch(e){}

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=${themeFont.replace(/ /g, '+')}:wght@300;400;600;900&display=swap');
        :root { --theme-color: ${themeColor}; --theme-color-light: ${themeColor}15; }
        .custom-font { font-family: '${themeFont}', sans-serif; }
        .theme-bg { background-color: var(--theme-color) !important; }
        .theme-bg-light { background-color: var(--theme-color-light) !important; }
        .theme-text { color: var(--theme-color) !important; }
        .theme-border { border-color: var(--theme-color) !important; }
        .theme-hover:hover { opacity: 0.85; transform: translateY(-2px); transition: all 0.2s; }
      `}} />

      {/* 💡 [추가 4] 우클릭 방지 코드 적용: onContextMenu 방어 */}
      <div 
        className="min-h-screen bg-slate-50 flex flex-col animate-fade-in custom-font selection:bg-slate-800 selection:text-white"
        onContextMenu={(e) => e.preventDefault()}
      >
        
        {/* 헤더 */}
        <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md shadow-sm">
          <div className="flex justify-between items-center px-6 md:px-12 py-4 relative z-50">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveMenu('HOME')}>
                {safeConfig.logo_url ? <img src={safeConfig.logo_url} className="h-8 md:h-12 object-contain" /> : <span className="text-2xl font-black theme-text uppercase">{safeConfig.welcome_title || 'LOGO'}</span>}
              </div>
              <div className="hidden md:flex gap-8 font-bold text-sm text-slate-500 uppercase tracking-widest">
                {['HOME', 'ROOMS', 'FACILITIES', 'ATTRACTIONS', 'CONTACT'].map(menu => (
                    <button key={menu} onClick={() => setActiveMenu(menu)} className={`transition-colors pb-1 ${activeMenu === menu ? 'theme-text border-b-2 theme-border' : 'hover:theme-text'}`}>{menu}</button>
                ))}
              </div>
              <div className="flex items-center gap-4">
                  <button onClick={() => setActiveMenu('ROOMS')} className="theme-bg theme-hover text-white px-5 md:px-7 py-2 md:py-2.5 rounded-full font-bold shadow-md text-sm md:text-base">Book Now</button>
                  <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden text-2xl theme-text p-2">{isMobileMenuOpen ? '✕' : '☰'}</button>
              </div>
          </div>
          <div className={`md:hidden absolute top-full left-0 w-full bg-white shadow-xl border-t border-slate-100 flex flex-col overflow-hidden transition-all duration-300 ${isMobileMenuOpen ? 'max-h-80 py-2' : 'max-h-0 py-0'}`}>
              {['HOME', 'ROOMS', 'FACILITIES', 'ATTRACTIONS', 'CONTACT'].map(menu => (
                  <button key={menu} onClick={() => { setActiveMenu(menu); setIsMobileMenuOpen(false); }} className={`p-4 text-left font-black text-sm tracking-widest uppercase ${activeMenu === menu ? 'theme-text bg-slate-50' : 'text-slate-600'}`}>{menu}</button>
              ))}
          </div>
        </header>

        {/* 🏠 메인 화면 */}
        {activeMenu === 'HOME' && (
          <div className="animate-fade-in-up">
            <section className="relative h-[85vh] flex flex-col items-center justify-center mt-[72px] overflow-hidden bg-slate-900">
              {sliderImages.map((img, idx) => (
                  <img key={idx} src={img} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? 'opacity-60 z-10' : 'opacity-0 z-0'}`} alt="slide" />
              ))}
              <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-3 z-20">
                  {sliderImages.length > 1 && sliderImages.map((_, idx) => (
                      <button key={idx} onClick={() => setCurrentSlide(idx)} className={`w-3 h-3 rounded-full transition-all ${idx === currentSlide ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/70'}`} />
                  ))}
              </div>
              
              {/* 💡 [분리 적용] 타이틀과 서브타이틀 각각의 위치와 줄바꿈(whitespace-pre-wrap) 적용 */}
              <div className="absolute z-20 w-full px-4 md:w-auto transition-all duration-500 ease-out" 
                   style={{ 
                       left: `${textPos.title?.x ?? 50}%`, top: `${textPos.title?.y ?? 40}%`, 
                       transform: `translate(-${textPos.title?.x ?? 50}%, -${textPos.title?.y ?? 40}%)`,
                       textAlign: (textPos.title?.x ?? 50) < 30 ? 'left' : (textPos.title?.x ?? 50) > 70 ? 'right' : 'center'
                   }}>
                <h1 className="text-5xl md:text-7xl text-white leading-tight drop-shadow-2xl font-black whitespace-pre-wrap">{safeConfig.welcome_title || "Welcome"}</h1>
              </div>

              <div className="absolute z-20 w-full px-4 md:w-auto transition-all duration-500 ease-out" 
                   style={{ 
                       left: `${textPos.subtitle?.x ?? 50}%`, top: `${textPos.subtitle?.y ?? 60}%`, 
                       transform: `translate(-${textPos.subtitle?.x ?? 50}%, -${textPos.subtitle?.y ?? 60}%)`,
                       textAlign: (textPos.subtitle?.x ?? 50) < 30 ? 'left' : (textPos.subtitle?.x ?? 50) > 70 ? 'right' : 'center'
                   }}>
                <p className="text-xl md:text-2xl text-slate-200 font-medium drop-shadow-lg whitespace-pre-wrap">{safeConfig.welcome_subtitle || "Your perfect stay awaits."}</p>
              </div>
            </section>
            
            <section className="py-24 px-8 bg-white text-center">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-3xl font-black mb-8 theme-text">About Us</h2>
                <div className={`${htmlRenderClass} text-center`} dangerouslySetInnerHTML={{ __html: safeConfig.description || "Information updating..." }} />
              </div>
            </section>
          </div>
        )}

        {/* 🛏️ ROOMS */}
        {activeMenu === 'ROOMS' && (
          <section className="pt-24 md:pt-32 pb-20 px-4 md:px-6 max-w-7xl mx-auto animate-fade-in-up w-full flex-grow">
            {rooms.length > 0 && activeRoom ? (
                <div>
                    <div className="flex overflow-x-auto gap-2 mb-0 px-2 md:px-4 scrollbar-hide snap-x">
                        {rooms.map(r => (
                            <button key={r.id} onClick={(e) => handleTabClick(e, setSelectedRoomId, r.id)} 
                                className={`snap-center px-5 md:px-6 py-3 md:py-4 font-black rounded-t-2xl whitespace-nowrap transition-all border-t border-l border-r border-slate-200 ${selectedRoomId === r.id ? 'bg-white theme-text shadow-[0_-4px_10px_rgba(0,0,0,0.05)] text-base md:text-lg z-10 relative' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 text-xs md:text-sm mt-1.5 md:mt-2'}`}>
                                {r.name}
                            </button>
                        ))}
                    </div>
                    <div className="bg-white rounded-b-3xl rounded-tr-3xl shadow-xl border border-slate-200 p-5 md:p-8 grid grid-cols-1 lg:grid-cols-10 gap-6 md:gap-8 relative z-0 -mt-px">
                        <div className="lg:col-span-7 flex flex-col gap-4 md:gap-6">
                            <div className="w-full h-[250px] sm:h-[350px] md:h-[450px] rounded-2xl md:rounded-3xl overflow-hidden relative shadow-inner bg-slate-900">
                                {activeRoom.images && activeRoom.images.length > 0 ? (
                                    activeRoom.images.map((img, idx) => (
                                        <img key={idx} src={img} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${(roomSlideIdx % activeRoom.images.length) === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} alt="room" />
                                    ))
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold bg-slate-100">No Image Available</div>
                                )}
                            </div>
                            <div>
                                <h3 className="text-2xl md:text-3xl font-black mb-3 text-slate-800">{activeRoom.name}</h3>
                                <div className="flex flex-wrap gap-2 md:gap-4 mb-4">
                                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs md:text-sm font-bold">👥 Max {activeRoom.maxGuests || 2} Guests</span>
                                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs md:text-sm font-bold">🛏️ {activeRoom.roomConfig?.bedType || 'Standard Bed'}</span>
                                </div>
                                <p className="text-slate-600 leading-relaxed font-medium text-sm md:text-base">{activeRoom.description || 'A beautiful room for your comfortable stay.'}</p>
                            </div>
                        </div>
                        <div className="lg:col-span-3 theme-bg-light p-5 md:p-8 rounded-2xl md:rounded-3xl border theme-border flex flex-col justify-center h-full">
                            <h3 className="text-xl md:text-2xl font-black theme-text mb-2">Book Your Stay</h3>
                            <p className="text-slate-500 text-xs md:text-sm font-bold mb-6">Experience {activeRoom.name} starting from ₱{activeRoom.price.toLocaleString()}/night.</p>
                            {/* 💡 [업그레이드] 통합 채널 스타일의 고급 예약 검색 모달 */}
                            {/* 💡 [업그레이드] 통합 채널 스타일의 고급 예약 검색 모달 */}
                            <div className="space-y-4 relative mt-2">
                                {/* 💡 [수정] 공간 부족을 해결하기 위해 체크인/체크아웃을 세로로 분리 */}
                                <div className="flex flex-col gap-4">
                                    <div className="w-full">
                                        <label className="text-[10px] md:text-xs font-bold text-slate-600 uppercase mb-1 block">Check-in</label>
                                        <input type="date" value={checkIn} onChange={e=>setCheckIn(e.target.value)} className="w-full p-2.5 md:p-3 border border-white rounded-xl bg-white shadow-sm font-bold text-xs md:text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" />
                                    </div>
                                    <div className="w-full">
                                        <label className="text-[10px] md:text-xs font-bold text-slate-600 uppercase mb-1 block">Check-out</label>
                                        <input type="date" value={checkOut} onChange={e=>setCheckOut(e.target.value)} className="w-full p-2.5 md:p-3 border border-white rounded-xl bg-white shadow-sm font-bold text-xs md:text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" />
                                    </div>
                                </div>

                                <div className="relative mt-2">
                                    <label className="text-[10px] md:text-xs font-bold text-slate-600 uppercase block mb-1">Guests & Rooms</label>
                                    <div 
                                        onClick={() => setShowGuestPicker(!showGuestPicker)}
                                        className="w-full p-2.5 md:p-3 border border-white rounded-xl bg-white shadow-sm font-bold text-xs md:text-sm text-slate-700 cursor-pointer flex justify-between items-center select-none hover:bg-blue-50 transition-colors"
                                    >
                                        <span className="truncate pr-2">
                                            {adults} Adults{kids > 0 ? `, ${kids} Kids` : ''}{infants > 0 ? `, ${infants} Inf` : ''} · {roomCount} Room
                                        </span>
                                        <span className="text-slate-400 shrink-0">▼</span>
                                    </div>

                                    {/* 💡 기존에 만드셨던 인원수/객실수 팝업 유지 */}
                                    {showGuestPicker && (
                                        <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-fade-in space-y-4 text-slate-800">
                                            <div className="flex justify-between items-center">
                                                <div><p className="font-bold text-sm">Adults</p><p className="text-[10px] text-slate-500">Age 13+</p></div>
                                                <div className="flex items-center gap-3"><button onClick={()=>setAdults(Math.max(1, adults-1))} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200 transition-colors">-</button><span className="w-4 text-center font-bold">{adults}</span><button onClick={()=>setAdults(adults+1)} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200 transition-colors">+</button></div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div><p className="font-bold text-sm">Children</p><p className="text-[10px] text-slate-500">Ages 2-12</p></div>
                                                <div className="flex items-center gap-3"><button onClick={()=>setKids(Math.max(0, kids-1))} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200 transition-colors">-</button><span className="w-4 text-center font-bold">{kids}</span><button onClick={()=>setKids(kids+1)} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200 transition-colors">+</button></div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div><p className="font-bold text-sm">Infants</p><p className="text-[10px] text-slate-500">Under 2</p></div>
                                                <div className="flex items-center gap-3"><button onClick={()=>setInfants(Math.max(0, infants-1))} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200 transition-colors">-</button><span className="w-4 text-center font-bold">{infants}</span><button onClick={()=>setInfants(infants+1)} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200 transition-colors">+</button></div>
                                            </div>
                                            <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                                                <div><p className="font-bold text-sm">Rooms</p></div>
                                                <div className="flex items-center gap-3"><button onClick={()=>setRoomCount(Math.max(1, roomCount-1))} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200 transition-colors">-</button><span className="w-4 text-center font-bold">{roomCount}</span><button onClick={()=>setRoomCount(roomCount+1)} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200 transition-colors">+</button></div>
                                            </div>
                                            <button onClick={()=>setShowGuestPicker(false)} className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl mt-2 hover:bg-slate-800 transition-colors">Done</button>
                                        </div>
                                    )}
                                </div>
                                
                                {/* 💡 [수정] 얼럿 창 대신 커스텀 모달창 띄우기 함수 연결 */}
                                <button onClick={() => setShowBookingModal(true)} className="w-full theme-bg theme-hover text-white py-3.5 md:py-4 rounded-xl font-black md:text-lg mt-2 shadow-lg transition-transform active:scale-95">Check Availability</button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : ( <p className="text-center text-slate-400 font-bold py-20">No rooms available.</p> )}
          </section>
        )}

        {/* 🍴 FACILITIES */}
        {activeMenu === 'FACILITIES' && (
          <section className="pt-24 md:pt-32 pb-20 px-4 md:px-6 max-w-7xl mx-auto animate-fade-in-up w-full flex-grow">
            {facilities.length > 0 ? (
                <div>
                    <div className="flex overflow-x-auto gap-2 mb-0 px-2 md:px-4 scrollbar-hide snap-x">
                        {facilities.map((fac, idx) => (
                            <button key={idx} onClick={(e) => handleTabClick(e, setActiveFacIdx, idx)} 
                                className={`snap-center px-5 md:px-6 py-3 md:py-4 font-black rounded-t-2xl whitespace-pre-wrap leading-tight text-center transition-all border-t border-l border-r border-slate-200 ${activeFacIdx === idx ? 'bg-white theme-text shadow-[0_-4px_10px_rgba(0,0,0,0.05)] text-base md:text-lg z-10 relative' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 text-xs md:text-sm mt-1.5 md:mt-2'}`}>
                                {fac.title || 'Facility'}
                            </button>
                        ))}
                    </div>
                    <div className="bg-white rounded-b-3xl rounded-tr-3xl shadow-xl border border-slate-200 p-5 md:p-8 grid grid-cols-1 lg:grid-cols-10 gap-6 md:gap-8 relative z-0 -mt-px">
                        <div className="lg:col-span-7 flex flex-col gap-6">
                            {/* 💡 [추가 6] 최대 5장 이미지 부드러운 슬라이더 적용 */}
                            <div className="w-full h-[250px] sm:h-[350px] md:h-[450px] rounded-2xl md:rounded-3xl overflow-hidden relative shadow-inner bg-slate-900">
                                {(() => {
                                    const activeItem = facilities[activeFacIdx] || {};
                                    let images = [];
                                    if (activeItem.image_urls && activeItem.image_urls.length > 0) images = activeItem.image_urls;
                                    else if (activeItem.image_url) images = [activeItem.image_url]; // 이전 버전 호환
                                    else images = ["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=1000"];
                                    
                                    return images.map((img, idx) => (
                                        <img key={`fac_slide_${idx}`} src={img} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${(facSlideIdx % images.length) === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} alt="facility" />
                                    ));
                                })()}
                            </div>
                        </div>
                        <div className="lg:col-span-3 flex flex-col justify-center">
                            <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-6 border-b border-slate-300 pb-2 inline-block self-start whitespace-pre-wrap">{facilities[activeFacIdx]?.title}</h3>
                            <div className={htmlRenderClass} dangerouslySetInnerHTML={{ __html: facilities[activeFacIdx]?.description || '' }} />
                        </div>
                    </div>
                </div>
            ) : <p className="text-center text-slate-400 font-bold py-20">No facilities registered.</p>}
          </section>
        )}

        {/* 🗺️ ATTRACTIONS */}
        {activeMenu === 'ATTRACTIONS' && (
          <section className="pt-24 md:pt-32 pb-20 px-4 md:px-6 max-w-7xl mx-auto animate-fade-in-up w-full flex-grow">
             {attractions.length > 0 ? (
                 <div>
                    <div className="flex overflow-x-auto gap-2 mb-0 px-2 md:px-4 scrollbar-hide snap-x">
                        {attractions.map((att, idx) => (
                            <button key={idx} onClick={(e) => handleTabClick(e, setActiveAttIdx, idx)} 
                                className={`snap-center px-5 md:px-6 py-3 md:py-4 font-black rounded-t-2xl whitespace-pre-wrap leading-tight text-center transition-all border-t border-l border-r border-slate-200 ${activeAttIdx === idx ? 'bg-white theme-text shadow-[0_-4px_10px_rgba(0,0,0,0.05)] text-base md:text-lg z-10 relative' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 text-xs md:text-sm mt-1.5 md:mt-2'}`}>
                                {att.title || 'Attraction'}
                            </button>
                        ))}
                    </div>
                    <div className="bg-white rounded-b-3xl rounded-tr-3xl shadow-xl border border-slate-200 p-5 md:p-8 grid grid-cols-1 lg:grid-cols-10 gap-6 md:gap-8 relative z-0 -mt-px">
                        <div className="lg:col-span-7 flex flex-col gap-6">
                            {/* 💡 [추가 7] 관광지 이미지 슬라이더 적용 */}
                            <div className="w-full h-[250px] sm:h-[350px] md:h-[450px] rounded-2xl md:rounded-3xl overflow-hidden relative shadow-inner bg-slate-900">
                                {(() => {
                                    const activeItem = attractions[activeAttIdx] || {};
                                    let images = [];
                                    if (activeItem.image_urls && activeItem.image_urls.length > 0) images = activeItem.image_urls;
                                    else if (activeItem.image_url) images = [activeItem.image_url];
                                    else images = ["https://images.unsplash.com/photo-1542314831-c6a4d27a658d?auto=format&fit=crop&q=80&w=1000"];
                                    
                                    return images.map((img, idx) => (
                                        <img key={`att_slide_${idx}`} src={img} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${(attSlideIdx % images.length) === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} alt="attraction" />
                                    ));
                                })()}
                            </div>
                        </div>
                        <div className="lg:col-span-3 flex flex-col justify-center">
                            <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-6 border-b border-slate-300 pb-2 inline-block self-start whitespace-pre-wrap">{attractions[activeAttIdx]?.title}</h3>
                            <div className={htmlRenderClass} dangerouslySetInnerHTML={{ __html: attractions[activeAttIdx]?.description || '' }} />
                        </div>
                    </div>
                 </div>
             ) : <p className="text-center text-slate-400 font-bold py-20">No attractions registered.</p>}
          </section>
        )}

        {/* 📍 CONTACT */}
        {activeMenu === 'CONTACT' && (
          <section className="pt-24 md:pt-32 pb-20 px-4 md:px-6 max-w-7xl mx-auto animate-fade-in-up w-full flex-grow">
             <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl border border-slate-200 p-5 md:p-8 grid grid-cols-1 lg:grid-cols-10 gap-6 md:gap-8">
                <div className="lg:col-span-7 w-full h-[300px] md:h-[500px] rounded-2xl md:rounded-3xl overflow-hidden shadow-inner border border-slate-100 bg-slate-100 [&_iframe]:!w-full [&_iframe]:!h-full [&_div]:!w-full [&_div]:!h-full">
                    {safeConfig.map_embed_url ? (
                         <div dangerouslySetInnerHTML={{ __html: safeConfig.map_embed_url }} className="w-full h-full" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-sm">Location map is currently being updated.</div>
                    )}
                </div>
                <div className="lg:col-span-3 flex flex-col">
                    <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-6 self-start">Contact Us</h3>
                    <div className="space-y-4 md:space-y-6 text-slate-600 flex-1">
                        <div>
                            <p className="font-black text-lg md:text-xl text-slate-800 mb-4">{safeConfig.welcome_title || "Our Hotel"}</p>
                            {sns.address && <p className="flex items-start gap-3 mb-3 text-sm font-medium"><span className="shrink-0 mt-0.5 text-base">🏠</span> <span className="whitespace-pre-wrap">{sns.address}</span></p>}
                            {sns.phone && <p className="flex items-start gap-3 mb-3 text-sm font-medium"><span className="shrink-0 mt-0.5 text-base">📞</span> <span className="whitespace-pre-wrap">{sns.phone}</span></p>}
                            {sns.email && <p className="flex items-center gap-3 mb-3 text-sm font-medium"><span className="shrink-0 text-base">✉️</span> <span>{sns.email}</span></p>}
                        </div>
                    </div>
                </div>
            </div>
          </section>
        )}

        {/* 💡 [신규] 4개 국어 지원 중앙 예약 알림 모달창 */}
        {showBookingModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowBookingModal(false)}>
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden text-center border border-slate-100" onClick={e => e.stopPropagation()}>
                    <div className="bg-blue-600 p-6 text-white">
                        <span className="text-4xl block mb-2">🗓️</span>
                        <h3 className="text-xl font-black">Booking System Update</h3>
                    </div>
                    <div className="p-8 space-y-4 text-slate-700 font-medium text-sm md:text-base">
                        <p className="font-bold text-lg text-slate-900 border-b border-slate-100 pb-4 mb-4">Booking API integration is in preparation.</p>
                        <p>예약 API 연동 준비 중입니다.</p>
                        <p>预订 API 连动准备中。</p>
                        <p>予約API連携の準備中です。</p>
                    </div>
                    <div className="p-5 bg-slate-50 border-t border-slate-100">
                        <button onClick={() => setShowBookingModal(false)} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-black transition-transform active:scale-95 shadow-md">
                            Close / 닫기
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* 📱 푸터 */}
        <footer className="bg-white/90 backdrop-blur-md border-t border-slate-200 py-8 md:py-10 px-6 text-center mt-auto">
          <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
              
              {(sns.ig || sns.fb) && (
                  <div className="flex gap-4 mb-2">
                      {sns.ig && <a href={sns.ig} target="_blank" rel="noreferrer" className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-pink-600 hover:bg-pink-600 hover:text-white hover:border-pink-600 transition-all shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16.11 7.99a.01.01 0 0 1 .02 0"/><path d="M15.82 12.18A4 4 0 1 1 11.82 8a4 4 0 0 1 4 4.18"/></svg></a>}
                      {sns.fb && <a href={sns.fb} target="_blank" rel="noreferrer" className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>}
                  </div>
              )}

              {/* 💡 [추가 8] 사용자가 입력한 회사 이름이 우선적으로 표기되도록 적용 */}
              <p className="text-xs md:text-sm font-bold text-slate-500">
                  &copy; {new Date().getFullYear()} <span className="theme-text">{safeConfig.footer_company_name || safeConfig.welcome_title || "Our Hotel"}</span>. All rights reserved.
              </p>
          </div>
        </footer>
      </div>
    </>
  );
}