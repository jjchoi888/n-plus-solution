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
  const [roomSlideIdx, setRoomSlideIdx] = useState(0);
  
  // 💡 [신규] 부대시설과 관광지용 폴더 탭 선택 상태 추가
  const [activeFacIdx, setActiveFacIdx] = useState(0);
  const [activeAttIdx, setActiveAttIdx] = useState(0);

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
  
  // 💡 [핵심] JSON 글씨로 나오던 데이터를 배열(폴더)로 예쁘게 번역합니다!
  let facilities = []; try { facilities = JSON.parse(safeConfig.facilities_json || '[]'); } catch(e){}
  let attractions = []; try { attractions = JSON.parse(safeConfig.attractions_json || '[]'); } catch(e){}

  const themeColor = safeConfig.theme_color?.startsWith('#') ? safeConfig.theme_color : '#2563eb';
  const themeFont = safeConfig.theme_font || 'Inter';
  const sliderStyle = safeConfig.slider_style || 'fade';

  // 메인 대문용 슬라이더 이미지
  const sliderImages = [];
  if (gallery.length > 0) sliderImages.push(...gallery);
  else if (safeConfig.bg_image_url) sliderImages.push(safeConfig.bg_image_url);
  
  if (sliderImages.length === 0) sliderImages.push("https://images.unsplash.com/photo-1542314831-c6a4d27a658d?q=80&w=2000&auto=format&fit=crop"); 

  useEffect(() => {
    if (sliderImages.length > 1 && activeMenu === 'HOME') {
      const timer = setInterval(() => setCurrentSlide(prev => (prev + 1) % sliderImages.length), 4000);
      return () => clearInterval(timer);
    }
  }, [sliderImages.length, activeMenu]);

  useEffect(() => {
    const timer = setInterval(() => setRoomSlideIdx(prev => prev + 1), 3000);
    return () => clearInterval(timer);
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-xl font-bold text-slate-500 bg-slate-50">Loading your perfect stay...</div>;

  const activeRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0];

  const getSliderClass = (idx, currentIdx) => {
      const isActive = idx === currentIdx;
      if (sliderStyle === 'zoom') return `transition-all duration-1000 ease-in-out absolute inset-0 ${isActive ? 'opacity-100 scale-100 z-0' : 'opacity-0 scale-110 -z-10'}`;
      if (sliderStyle === 'slide') return `transition-transform duration-1000 ease-in-out absolute inset-0 ${isActive ? 'translate-x-0 z-0' : 'translate-x-full -z-10'}`;
      return `transition-opacity duration-1000 ease-in-out absolute inset-0 ${isActive ? 'opacity-100 z-0' : 'opacity-0 -z-10'}`;
  };

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

      <div className="min-h-screen bg-slate-50 flex flex-col animate-fade-in custom-font selection:bg-slate-800 selection:text-white">
        
        {/* 🧭 헤더 */}
        <header className="fixed top-0 w-full z-50 px-6 md:px-12 py-4 flex justify-between items-center bg-white/90 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveMenu('HOME')}>
            {safeConfig.logo_url ? <img src={safeConfig.logo_url} className="h-8 md:h-12 object-contain" /> : <span className="text-2xl font-black theme-text uppercase">{safeConfig.welcome_title || 'LOGO'}</span>}
          </div>
          <div className="hidden md:flex gap-8 font-bold text-sm text-slate-500 uppercase tracking-widest">
            {['HOME', 'ROOMS', 'FACILITIES', 'ATTRACTIONS', 'LOCATION'].map(menu => (
                <button key={menu} onClick={() => setActiveMenu(menu)} className={`transition-colors pb-1 ${activeMenu === menu ? 'theme-text border-b-2 theme-border' : 'hover:theme-text'}`}>{menu}</button>
            ))}
          </div>
          <button onClick={() => setActiveMenu('ROOMS')} className="theme-bg theme-hover text-white px-7 py-2.5 rounded-full font-bold shadow-md">Book Now</button>
        </header>

        {/* 🏠 메인 화면 */}
        {activeMenu === 'HOME' && (
          <div className="animate-fade-in-up">
            <section className="relative h-[85vh] flex flex-col items-center justify-center text-center mt-[72px] overflow-hidden bg-black">
              {sliderImages.map((img, idx) => (
                  <div key={idx} className={getSliderClass(idx, currentSlide)}>
                      <img src={img} className="w-full h-full object-cover opacity-70" />
                  </div>
              ))}
              <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-3 z-20">
                  {sliderImages.length > 1 && sliderImages.map((_, idx) => (
                      <button key={idx} onClick={() => setCurrentSlide(idx)} className={`w-3 h-3 rounded-full transition-all ${idx === currentSlide ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/70'}`} />
                  ))}
              </div>
              <div className="relative z-10 max-w-4xl mx-auto px-4 mt-10">
                <h1 className="text-5xl md:text-7xl text-white leading-tight mb-6 drop-shadow-2xl font-black">{safeConfig.welcome_title || "Welcome"}</h1>
                <p className="text-xl md:text-2xl text-slate-200 font-medium drop-shadow-lg">{safeConfig.welcome_subtitle || "Your perfect stay awaits."}</p>
              </div>
            </section>
          </div>
        )}

        {/* 🛏️ 메뉴 2: 객실 (ROOMS) - 70:30 구조 유지 */}
        {activeMenu === 'ROOMS' && (
          <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto animate-fade-in-up w-full flex-grow">
            {rooms.length > 0 && activeRoom ? (
                <div>
                    <div className="flex overflow-x-auto gap-2 mb-0 px-4 scrollbar-hide">
                        {rooms.map(r => (
                            <button key={r.id} onClick={() => setSelectedRoomId(r.id)} 
                                className={`px-6 py-4 font-black rounded-t-2xl whitespace-nowrap transition-all border-t border-l border-r border-slate-200 ${selectedRoomId === r.id ? 'bg-white theme-text shadow-[0_-4px_10px_rgba(0,0,0,0.05)] text-lg z-10 relative' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 text-sm mt-2'}`}>
                                {r.name}
                            </button>
                        ))}
                    </div>
                    <div className="bg-white rounded-b-3xl rounded-tr-3xl shadow-xl border border-slate-200 p-6 md:p-8 grid grid-cols-1 lg:grid-cols-10 gap-8 relative z-0 -mt-px">
                        <div className="lg:col-span-7 flex flex-col gap-6">
                            <div className="w-full h-[300px] md:h-[450px] rounded-3xl overflow-hidden relative shadow-inner bg-slate-100">
                                {activeRoom.images && activeRoom.images.length > 0 ? (
                                    activeRoom.images.map((img, idx) => (
                                        <div key={idx} className={getSliderClass(idx, roomSlideIdx % activeRoom.images.length)}>
                                            <img src={img} className="w-full h-full object-cover" />
                                        </div>
                                    ))
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">No Image Available</div>
                                )}
                            </div>
                            <div>
                                <h3 className="text-3xl font-black mb-3 text-slate-800">{activeRoom.name}</h3>
                                <div className="flex gap-4 mb-4">
                                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-sm font-bold">👥 Max {activeRoom.maxGuests || 2} Guests</span>
                                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-sm font-bold">🛏️ {activeRoom.roomConfig?.bedType || 'Standard Bed'}</span>
                                </div>
                                <p className="text-slate-600 leading-relaxed font-medium">{activeRoom.description || 'A beautiful room for your comfortable stay.'}</p>
                            </div>
                        </div>
                        <div className="lg:col-span-3 theme-bg-light p-6 md:p-8 rounded-3xl border theme-border flex flex-col justify-center h-full">
                            <h3 className="text-2xl font-black theme-text mb-2">Book Your Stay</h3>
                            <p className="text-slate-500 text-sm font-bold mb-6">Experience {activeRoom.name} starting from ₱{activeRoom.price.toLocaleString()}/night.</p>
                            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert("예약 시스템과 연결 중입니다."); }}>
                                <div><label className="text-xs font-bold text-slate-600 uppercase">Check-in</label><input type="date" className="w-full p-3 border border-white rounded-xl bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-400 font-bold text-slate-700" required /></div>
                                <div><label className="text-xs font-bold text-slate-600 uppercase">Check-out</label><input type="date" className="w-full p-3 border border-white rounded-xl bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-400 font-bold text-slate-700" required /></div>
                                <div><label className="text-xs font-bold text-slate-600 uppercase">Guest Name</label><input type="text" placeholder="John Doe" className="w-full p-3 border border-white rounded-xl bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-400 font-bold text-slate-700" required /></div>
                                <button type="submit" className="w-full theme-bg theme-hover text-white py-4 rounded-xl font-black text-lg mt-4 shadow-lg">Confirm Booking</button>
                            </form>
                        </div>
                    </div>
                </div>
            ) : ( <p className="text-center text-slate-400 font-bold py-20">No rooms available.</p> )}
          </section>
        )}

        {/* 🍴 메뉴 3: 부대시설 (FACILITIES) - 💡 [업그레이드] Rooms처럼 탭+70:30 구조 적용! */}
        {activeMenu === 'FACILITIES' && (
          <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto animate-fade-in-up w-full flex-grow">
            {facilities.length > 0 ? (
                <div>
                    <div className="flex overflow-x-auto gap-2 mb-0 px-4 scrollbar-hide">
                        {facilities.map((fac, idx) => (
                            <button key={idx} onClick={() => setActiveFacIdx(idx)} 
                                className={`px-6 py-4 font-black rounded-t-2xl whitespace-nowrap transition-all border-t border-l border-r border-slate-200 ${activeFacIdx === idx ? 'bg-white theme-text shadow-[0_-4px_10px_rgba(0,0,0,0.05)] text-lg z-10 relative' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 text-sm mt-2'}`}>
                                {fac.title || 'Facility'}
                            </button>
                        ))}
                    </div>
                    <div className="bg-white rounded-b-3xl rounded-tr-3xl shadow-xl border border-slate-200 p-6 md:p-8 grid grid-cols-1 lg:grid-cols-10 gap-8 relative z-0 -mt-px">
                        <div className="lg:col-span-7 flex flex-col gap-6">
                            <div className="w-full h-[300px] md:h-[450px] rounded-3xl overflow-hidden relative shadow-inner bg-slate-100">
                                {facilities[activeFacIdx]?.image_url ? (
                                    <img src={facilities[activeFacIdx].image_url} className="w-full h-full object-cover animate-fade-in" alt="facility" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">No Image</div>
                                )}
                            </div>
                        </div>
                        <div className="lg:col-span-3 flex flex-col justify-center">
                            <div className="text-5xl mb-4">🍴</div>
                            <h3 className="text-3xl font-black text-slate-800 mb-6">{facilities[activeFacIdx]?.title}</h3>
                            <div className="whitespace-pre-wrap leading-loose text-slate-600 font-medium text-lg">
                              {facilities[activeFacIdx]?.description}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <p className="text-center text-slate-400 font-bold py-20 bg-white rounded-3xl shadow-sm border border-slate-200">No facilities registered.</p>
            )}
          </section>
        )}

        {/* 🗺️ 메뉴 4: 주변 관광지 (ATTRACTIONS) - 💡 [업그레이드] Rooms처럼 탭+70:30 구조 적용! */}
        {activeMenu === 'ATTRACTIONS' && (
          <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto animate-fade-in-up w-full flex-grow">
             {attractions.length > 0 ? (
                 <div>
                    <div className="flex overflow-x-auto gap-2 mb-0 px-4 scrollbar-hide">
                        {attractions.map((att, idx) => (
                            <button key={idx} onClick={() => setActiveAttIdx(idx)} 
                                className={`px-6 py-4 font-black rounded-t-2xl whitespace-nowrap transition-all border-t border-l border-r border-slate-200 ${activeAttIdx === idx ? 'bg-white theme-text shadow-[0_-4px_10px_rgba(0,0,0,0.05)] text-lg z-10 relative' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 text-sm mt-2'}`}>
                                {att.title || 'Attraction'}
                            </button>
                        ))}
                    </div>
                    <div className="bg-white rounded-b-3xl rounded-tr-3xl shadow-xl border border-slate-200 p-6 md:p-8 grid grid-cols-1 lg:grid-cols-10 gap-8 relative z-0 -mt-px">
                        <div className="lg:col-span-7 flex flex-col gap-6">
                            <div className="w-full h-[300px] md:h-[450px] rounded-3xl overflow-hidden relative shadow-inner bg-slate-100">
                                {attractions[activeAttIdx]?.image_url ? (
                                    <img src={attractions[activeAttIdx].image_url} className="w-full h-full object-cover animate-fade-in" alt="attraction" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">No Image</div>
                                )}
                            </div>
                        </div>
                        <div className="lg:col-span-3 flex flex-col justify-center">
                            <div className="text-5xl mb-4">📸</div>
                            <h3 className="text-3xl font-black text-slate-800 mb-6">{attractions[activeAttIdx]?.title}</h3>
                            <div className="whitespace-pre-wrap leading-loose text-slate-600 font-medium text-lg">
                              {attractions[activeAttIdx]?.description}
                            </div>
                        </div>
                    </div>
                 </div>
             ) : (
                <p className="text-center text-slate-400 font-bold py-20 bg-white rounded-3xl shadow-sm border border-slate-200">No attractions registered.</p>
             )}
          </section>
        )}

        {/* 📍 메뉴 5: 오시는 길 (LOCATION) */}
        {activeMenu === 'LOCATION' && (
          <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto animate-fade-in-up w-full flex-grow">
             <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 md:p-8 grid grid-cols-1 lg:grid-cols-10 gap-8">
                <div className="lg:col-span-7 w-full h-[400px] md:h-[500px] rounded-3xl overflow-hidden shadow-inner border border-slate-100 bg-slate-100 [&>iframe]:w-full [&>iframe]:h-full">
                    {safeConfig.map_embed_url ? (
                         <div dangerouslySetInnerHTML={{ __html: safeConfig.map_embed_url }} className="w-full h-full" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">Location map is currently being updated.</div>
                    )}
                </div>
                <div className="lg:col-span-3 flex flex-col justify-center">
                    <div className="text-5xl mb-4">📍</div>
                    <h3 className="text-3xl font-black text-slate-800 mb-6 border-b-4 theme-border pb-2 inline-block">Find Us Here</h3>
                    <div className="space-y-4 text-slate-600">
                        <p className="font-bold text-lg text-slate-800">{safeConfig.welcome_title || "Our Hotel"}</p>
                        <p className="font-medium text-base">We are located in the heart of the city, providing easy access to all major attractions and transport links.</p>
                    </div>
                </div>
            </div>
          </section>
        )}

        {/* 📱 푸터 */}
        <footer className="bg-white/90 backdrop-blur-md border-t border-slate-200 py-10 px-6 text-center mt-auto">
          <div className="max-w-4xl mx-auto flex flex-col items-center gap-6">
              {(sns.ig || sns.fb) && (
                  <div className="flex gap-4 mb-2">
                      {sns.ig && <a href={sns.ig} target="_blank" rel="noreferrer" className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-pink-600 hover:bg-pink-600 hover:text-white transition-all shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16.11 7.99a.01.01 0 0 1 .02 0"/><path d="M15.82 12.18A4 4 0 1 1 11.82 8a4 4 0 0 1 4 4.18"/></svg></a>}
                      {sns.fb && <a href={sns.fb} target="_blank" rel="noreferrer" className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>}
                  </div>
              )}
              <p className="text-sm font-bold text-slate-500">&copy; {new Date().getFullYear()} <span className="theme-text">{safeConfig.welcome_title || "Our Hotel"}</span>. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
}