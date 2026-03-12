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
  
  const [activeFacIdx, setActiveFacIdx] = useState(0);
  const [activeAttIdx, setActiveAttIdx] = useState(0);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  useEffect(() => {
    let timer;
    if (activeMenu === 'HOME' && sliderImages.length > 1) {
        timer = setInterval(() => setCurrentSlide(prev => (prev + 1) % sliderImages.length), 4000);
    } else if (activeMenu === 'ROOMS') {
        timer = setInterval(() => setRoomSlideIdx(prev => prev + 1), 3500);
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

  // 💡 [신규] 에디터에서 작성된 HTML을 예쁘게 화면에 그려주는 전용 클래스 모음
  const htmlRenderClass = "leading-relaxed text-slate-600 font-medium text-sm md:text-base [&>h1]:text-3xl [&>h1]:font-black [&>h1]:mb-3 [&>h1]:text-slate-800 [&>h3]:text-xl [&>h3]:font-bold [&>h3]:mb-2 [&>h3]:text-slate-800 [&>p]:mb-2";

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
            <section className="relative h-[85vh] flex flex-col items-center justify-center text-center mt-[72px] overflow-hidden bg-slate-900">
              {sliderImages.map((img, idx) => (
                  <img key={idx} src={img} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? 'opacity-60 z-10' : 'opacity-0 z-0'}`} alt="slide" />
              ))}
              <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-3 z-20">
                  {sliderImages.length > 1 && sliderImages.map((_, idx) => (
                      <button key={idx} onClick={() => setCurrentSlide(idx)} className={`w-3 h-3 rounded-full transition-all ${idx === currentSlide ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/70'}`} />
                  ))}
              </div>
              <div className="relative z-20 max-w-4xl mx-auto px-4 mt-10">
                <h1 className="text-5xl md:text-7xl text-white leading-tight mb-6 drop-shadow-2xl font-black">{safeConfig.welcome_title || "Welcome"}</h1>
                <p className="text-xl md:text-2xl text-slate-200 font-medium drop-shadow-lg">{safeConfig.welcome_subtitle || "Your perfect stay awaits."}</p>
              </div>
            </section>
            
            <section className="py-24 px-8 bg-white text-center">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-3xl font-black mb-8 theme-text">About Us</h2>
                {/* 💡 에디터 HTML 렌더링 적용 */}
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
                            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert("예약 시스템과 연결 중입니다."); }}>
                                <div><label className="text-[10px] md:text-xs font-bold text-slate-600 uppercase">Check-in</label><input type="date" className="w-full p-2.5 md:p-3 border border-white rounded-xl bg-white shadow-sm font-bold text-sm text-slate-700" required /></div>
                                <div><label className="text-[10px] md:text-xs font-bold text-slate-600 uppercase">Check-out</label><input type="date" className="w-full p-2.5 md:p-3 border border-white rounded-xl bg-white shadow-sm font-bold text-sm text-slate-700" required /></div>
                                <div><label className="text-[10px] md:text-xs font-bold text-slate-600 uppercase">Guest Name</label><input type="text" placeholder="John Doe" className="w-full p-2.5 md:p-3 border border-white rounded-xl bg-white shadow-sm font-bold text-sm text-slate-700" required /></div>
                                <button type="submit" className="w-full theme-bg theme-hover text-white py-3.5 md:py-4 rounded-xl font-black md:text-lg mt-2 shadow-lg transition-transform active:scale-95">Confirm Booking</button>
                            </form>
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
                            <div className="w-full h-[250px] sm:h-[350px] md:h-[450px] rounded-2xl md:rounded-3xl overflow-hidden relative shadow-inner bg-slate-900">
                                {facilities.map((fac, idx) => (
                                    <img key={`fac_${idx}`} src={fac.image_url || "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=1000"} 
                                         className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${activeFacIdx === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} alt={fac.title} />
                                ))}
                            </div>
                        </div>
                        <div className="lg:col-span-3 flex flex-col justify-center">
                            {/* 💡 [수정] 구분선을 아주 얇은 1px 선(border-b)으로 변경했습니다! */}
                            <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-6 border-b border-slate-300 pb-2 inline-block self-start whitespace-pre-wrap">{facilities[activeFacIdx]?.title}</h3>
                            {/* 💡 [수정] 에디터의 HTML 코드를 적용합니다! */}
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
                            <div className="w-full h-[250px] sm:h-[350px] md:h-[450px] rounded-2xl md:rounded-3xl overflow-hidden relative shadow-inner bg-slate-900">
                                {attractions.map((att, idx) => (
                                    <img key={`att_${idx}`} src={att.image_url || "https://images.unsplash.com/photo-1542314831-c6a4d27a658d?auto=format&fit=crop&q=80&w=1000"} 
                                         className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${activeAttIdx === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} alt={att.title} />
                                ))}
                            </div>
                        </div>
                        <div className="lg:col-span-3 flex flex-col justify-center">
                            {/* 💡 [수정] 구분선을 아주 얇은 1px 선(border-b)으로 변경했습니다! */}
                            <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-6 border-b border-slate-300 pb-2 inline-block self-start whitespace-pre-wrap">{attractions[activeAttIdx]?.title}</h3>
                            {/* 💡 [수정] 에디터의 HTML 코드를 적용합니다! */}
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

        {/* 📱 푸터 */}
        <footer className="bg-white/90 backdrop-blur-md border-t border-slate-200 py-8 md:py-10 px-6 text-center mt-auto">
          <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
              
              {/* 💡 [신규] 푸터에 SNS 링크들을 전역적으로 복구했습니다! */}
              {(sns.ig || sns.fb) && (
                  <div className="flex gap-4 mb-2">
                      {sns.ig && <a href={sns.ig} target="_blank" rel="noreferrer" className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-pink-600 hover:bg-pink-600 hover:text-white hover:border-pink-600 transition-all shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16.11 7.99a.01.01 0 0 1 .02 0"/><path d="M15.82 12.18A4 4 0 1 1 11.82 8a4 4 0 0 1 4 4.18"/></svg></a>}
                      {sns.fb && <a href={sns.fb} target="_blank" rel="noreferrer" className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>}
                  </div>
              )}

              <p className="text-xs md:text-sm font-bold text-slate-500">&copy; {new Date().getFullYear()} <span className="theme-text">{safeConfig.welcome_title || "Our Hotel"}</span>. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
}