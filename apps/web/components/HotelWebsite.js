"use client";
import { useState, useEffect } from "react";
import RoomList from "./RoomList";

const BASE_URL = 'https://hotel-pms-backend-production.up.railway.app';

// 💡 4개 국어(EN, KO, ZH, JA) 번역 딕셔너리
const translations = {
    en: {
        home: 'HOME', rooms: 'ROOMS', facilities: 'FACILITIES', attractions: 'ATTRACTIONS', contact: 'CONTACT',
        bookNow: 'Book Now', aboutUs: 'About Us', bookStay: 'Book Your Stay', checkAvail: 'Check Availability',
        expStart: 'Experience', startingFrom: 'starting from', night: '/night',
        checkIn: 'Check-in', checkOut: 'Check-out', guestsRooms: 'Guests & Rooms',
        adults: 'Adults', age13: 'Age 13+', children: 'Children', age2_12: 'Ages 2-12', infants: 'Infants', under2: 'Under 2',
        room: 'Room', rooms: 'Rooms', done: 'Done', maxGuests: 'Max', guests: 'Guests',
        noImg: 'No Image Available', noRooms: 'No rooms available.', noFac: 'No facilities registered.', noAtt: 'No attractions registered.',
        mapUpdating: 'Location map is currently being updated.', contactUs: 'Contact Us', rights: 'All rights reserved.',
        modalTitle: 'Booking System Update', modalMsg: 'Booking API integration is in preparation.', close: 'Close',
        standardBed: 'Standard Bed'
    },
    ko: {
        home: '홈', rooms: '객실', facilities: '부대시설', attractions: '관광지', contact: '오시는길',
        bookNow: '예약하기', aboutUs: '호텔 소개', bookStay: '객실 예약', checkAvail: '예약 가능 여부 확인',
        expStart: '', startingFrom: '최저가', night: '/1박',
        checkIn: '체크인', checkOut: '체크아웃', guestsRooms: '인원 및 객실',
        adults: '성인', age13: '13세 이상', children: '어린이', age2_12: '2~12세', infants: '유아', under2: '2세 미만',
        room: '객실', rooms: '객실', done: '완료', maxGuests: '최대', guests: '명',
        noImg: '이미지 없음', noRooms: '등록된 객실이 없습니다.', noFac: '등록된 부대시설이 없습니다.', noAtt: '등록된 관광지가 없습니다.',
        mapUpdating: '지도가 업데이트 중입니다.', contactUs: '문의 및 연락처', rights: '모든 권리 보유.',
        modalTitle: '예약 시스템 안내', modalMsg: '개별 호텔 예약 API 연동 준비 중입니다.', close: '닫기',
        standardBed: '스탠다드 베드'
    },
    zh: {
        home: '首页', rooms: '客房', facilities: '设施', attractions: '景点', contact: '联系我们',
        bookNow: '立即预订', aboutUs: '关于我们', bookStay: '预订客房', checkAvail: '查看空房情况',
        expStart: '体验', startingFrom: '起价', night: '/晚',
        checkIn: '入住', checkOut: '退房', guestsRooms: '人数与客房',
        adults: '成人', age13: '13岁以上', children: '儿童', age2_12: '2-12岁', infants: '婴儿', under2: '2岁以下',
        room: '间', rooms: '间', done: '完成', maxGuests: '最多', guests: '人',
        noImg: '暂无图片', noRooms: '暂无客房。', noFac: '暂无设施。', noAtt: '暂无景点。',
        mapUpdating: '位置地图正在更新中。', contactUs: '联系我们', rights: '版权所有。',
        modalTitle: '预订系统通知', modalMsg: '预订 API 连动准备中。', close: '关闭',
        standardBed: '标准床'
    },
    ja: {
        home: 'ホーム', rooms: '客室', facilities: '施設', attractions: '観光', contact: 'アクセス',
        bookNow: '今すぐ予約', aboutUs: 'ホテルについて', bookStay: 'ご予約', checkAvail: '空室状況を確認',
        expStart: '', startingFrom: '最安値', night: '/泊',
        checkIn: 'チェックイン', checkOut: 'チェックアウト', guestsRooms: '人数と客室',
        adults: '大人', age13: '13歳以上', children: '子供', age2_12: '2~12歳', infants: '幼児', under2: '2歳未満',
        room: '室', rooms: '室', done: '完了', maxGuests: '最大', guests: '名',
        noImg: '画像なし', noRooms: '利用可能な客室がありません。', noFac: '登録された施設がありません。', noAtt: '登録された観光地がありません。',
        mapUpdating: 'マップは現在更新中です。', contactUs: 'お問い合わせ', rights: '無断複写・転載を禁じます。',
        modalTitle: '予約システムのお知らせ', modalMsg: '予約API連携の準備中です。', close: '閉じる',
        standardBed: 'スタンダードベッド'
    }
};

export default function HotelWebsite({ domain }) {
  const [lang, setLang] = useState('en');
  const [config, setConfig] = useState(null);
  const [rooms, setRooms] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [activeMenu, setActiveMenu] = useState('HOME'); 
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  
  const [roomSlideIdx, setRoomSlideIdx] = useState(0);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  const [infants, setInfants] = useState(0); 
  const [roomCount, setRoomCount] = useState(1);
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  
  const [facSlideIdx, setFacSlideIdx] = useState(0);
  const [attSlideIdx, setAttSlideIdx] = useState(0);
  const [activeFacIdx, setActiveFacIdx] = useState(0);
  const [activeAttIdx, setActiveAttIdx] = useState(0);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false); 

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
  
  let sns = {}; 
  try { 
      if (safeConfig.sns_json) {
          sns = typeof safeConfig.sns_json === 'string' ? JSON.parse(safeConfig.sns_json) : safeConfig.sns_json;
          if (typeof sns === 'string') sns = JSON.parse(sns); 
      }
  } catch(e){}
  
  let facilities = []; try { facilities = JSON.parse(safeConfig.facilities_json || '[]'); } catch(e){}
  let attractions = []; try { attractions = JSON.parse(safeConfig.attractions_json || '[]'); } catch(e){}

  let textPos = { title: {x: 50, y: 40}, subtitle: {x: 50, y: 55} };
  try { 
      if(safeConfig.welcome_text_pos) {
          const raw = JSON.parse(safeConfig.welcome_text_pos);
          if (raw.title && raw.subtitle) textPos = raw;
          else textPos = { title: {x: raw.x || 50, y: Math.max(0, (raw.y || 50) - 10)}, subtitle: {x: raw.x || 50, y: Math.min(100, (raw.y || 50) + 10)} };
      }
  } catch(e){}

  const themeColor = safeConfig.theme_color?.startsWith('#') ? safeConfig.theme_color : '#2563eb';
  const themeFont = safeConfig.theme_font || 'Inter';
  
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
    } else if (activeMenu === 'FACILITIES') {
        timer = setInterval(() => setFacSlideIdx(prev => prev + 1), 3500);
    } else if (activeMenu === 'ATTRACTIONS') {
        timer = setInterval(() => setAttSlideIdx(prev => prev + 1), 3500);
    }
    return () => clearInterval(timer);
  }, [activeMenu, sliderImages.length]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-xl font-bold text-slate-500 bg-slate-50">Loading your perfect stay...</div>;

  const activeRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0];
  const handleTabClick = (e, setter, value) => { setter(value); if (e.target) e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); };
  const htmlRenderClass = "leading-relaxed text-slate-600 font-medium text-sm md:text-base [&>h1]:text-3xl [&>h1]:font-black [&>h1]:mb-3 [&>h1]:text-slate-800 [&>h3]:text-xl [&>h3]:font-bold [&>h3]:mb-2 [&>h3]:text-slate-800 [&>p]:mb-2";

  const t = translations[lang] || translations.en;
  
  const renderPriceStr = (price, name) => {
      if(lang === 'ko') return `${name} 객실을 ₱${price.toLocaleString()}${t.night} ${t.startingFrom}`;
      if(lang === 'zh') return `${t.expStart} ${name} ${t.startingFrom} ₱${price.toLocaleString()}${t.night}`;
      if(lang === 'ja') return `${name} を ₱${price.toLocaleString()}${t.night} からご体験ください。`;
      return `${t.expStart} ${name} ${t.startingFrom} ₱${price.toLocaleString()}${t.night}.`;
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

      <div className="min-h-screen bg-slate-50 flex flex-col animate-fade-in custom-font selection:bg-slate-800 selection:text-white" onContextMenu={(e) => e.preventDefault()}>
        
        {/* 헤더 */}
        <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md shadow-sm">
          <div className="flex justify-between items-center px-6 md:px-12 py-4 relative z-50">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveMenu('HOME')}>
                {safeConfig.logo_url ? <img src={safeConfig.logo_url} className="h-8 md:h-12 object-contain" alt="Logo" /> : <span className="text-2xl font-black theme-text uppercase">{safeConfig.welcome_title || 'LOGO'}</span>}
              </div>
              <div className="hidden md:flex gap-8 font-bold text-sm text-slate-500 uppercase tracking-widest">
                {[ { id: 'HOME', label: t.home }, { id: 'ROOMS', label: t.rooms }, { id: 'FACILITIES', label: t.facilities }, { id: 'ATTRACTIONS', label: t.attractions }, { id: 'CONTACT', label: t.contact } ].map(menu => (
                    <button key={menu.id} onClick={() => setActiveMenu(menu.id)} className={`transition-colors pb-1 ${activeMenu === menu.id ? 'theme-text border-b-2 theme-border' : 'hover:theme-text'}`}>{menu.label}</button>
                ))}
              </div>
              <div className="flex items-center gap-2 md:gap-4">
                  <select value={lang} onChange={(e) => setLang(e.target.value)} className="bg-slate-100 text-slate-600 px-2 py-1.5 md:px-3 md:py-2 rounded-lg text-xs md:text-sm font-bold outline-none cursor-pointer hover:bg-slate-200 transition-colors border border-slate-200">
                      <option value="en">EN</option><option value="ko">KR</option><option value="zh">CN</option><option value="ja">JP</option>
                  </select>
                  <button onClick={() => setActiveMenu('ROOMS')} className="theme-bg theme-hover text-white px-4 md:px-7 py-2 md:py-2.5 rounded-full font-bold shadow-md text-xs md:text-base whitespace-nowrap">{t.bookNow}</button>
                  <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden text-2xl theme-text p-2">{isMobileMenuOpen ? '✕' : '☰'}</button>
              </div>
          </div>
          <div className={`md:hidden absolute top-full left-0 w-full bg-white shadow-xl border-t border-slate-100 flex flex-col overflow-hidden transition-all duration-300 ${isMobileMenuOpen ? 'max-h-80 py-2' : 'max-h-0 py-0'}`}>
              {[ { id: 'HOME', label: t.home }, { id: 'ROOMS', label: t.rooms }, { id: 'FACILITIES', label: t.facilities }, { id: 'ATTRACTIONS', label: t.attractions }, { id: 'CONTACT', label: t.contact } ].map(menu => (
                  <button key={menu.id} onClick={() => { setActiveMenu(menu.id); setIsMobileMenuOpen(false); }} className={`p-4 text-left font-black text-sm tracking-widest uppercase ${activeMenu === menu.id ? 'theme-text bg-slate-50' : 'text-slate-600'}`}>{menu.label}</button>
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
              <div className="absolute z-20 w-full px-4 md:w-auto transition-all duration-500 ease-out" 
                   style={{ left: `${textPos.title?.x ?? 50}%`, top: `${textPos.title?.y ?? 40}%`, transform: `translate(-${textPos.title?.x ?? 50}%, -${textPos.title?.y ?? 40}%)`, textAlign: (textPos.title?.x ?? 50) < 30 ? 'left' : (textPos.title?.x ?? 50) > 70 ? 'right' : 'center' }}>
                <h1 className="text-5xl md:text-7xl text-white leading-tight drop-shadow-2xl font-black whitespace-pre-wrap">{safeConfig.welcome_title || "Welcome"}</h1>
              </div>
              <div className="absolute z-20 w-full px-4 md:w-auto transition-all duration-500 ease-out" 
                   style={{ left: `${textPos.subtitle?.x ?? 50}%`, top: `${textPos.subtitle?.y ?? 60}%`, transform: `translate(-${textPos.subtitle?.x ?? 50}%, -${textPos.subtitle?.y ?? 60}%)`, textAlign: (textPos.subtitle?.x ?? 50) < 30 ? 'left' : (textPos.subtitle?.x ?? 50) > 70 ? 'right' : 'center' }}>
                <p className="text-xl md:text-2xl text-slate-200 font-medium drop-shadow-lg whitespace-pre-wrap">{safeConfig.welcome_subtitle || "Your perfect stay awaits."}</p>
              </div>
            </section>
            
            <section className="py-24 px-8 bg-white text-center">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-3xl font-black mb-8 theme-text">{t.aboutUs}</h2>
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
                                ) : ( <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold bg-slate-100">{t.noImg}</div> )}
                            </div>
                            <div>
                                <h3 className="text-2xl md:text-3xl font-black mb-3 text-slate-800">{activeRoom.name}</h3>
                                <div className="flex flex-wrap gap-2 md:gap-4 mb-4">
                                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs md:text-sm font-bold">👥 {t.maxGuests} {activeRoom.maxGuests || 2} {t.guests}</span>
                                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs md:text-sm font-bold">🛏️ {activeRoom.roomConfig?.bedType || t.standardBed}</span>
                                </div>
                                <p className="text-slate-600 leading-relaxed font-medium text-sm md:text-base">{activeRoom.description}</p>
                            </div>
                        </div>
                        <div className="lg:col-span-3 theme-bg-light p-5 md:p-8 rounded-2xl md:rounded-3xl border theme-border flex flex-col justify-center h-full">
                            <h3 className="text-xl md:text-2xl font-black theme-text mb-2">{t.bookStay}</h3>
                            <p className="text-slate-500 text-xs md:text-sm font-bold mb-6">{renderPriceStr(activeRoom.price, activeRoom.name)}</p>
                            
                            <form className="space-y-4 relative mt-2" onSubmit={(e) => { e.preventDefault(); setShowBookingModal(true); }}>
                                <div className="flex flex-col gap-4">
                                    <div className="w-full">
                                        <label className="text-[10px] md:text-xs font-bold text-slate-600 uppercase mb-1 block">{t.checkIn}</label>
                                        <input type="date" value={checkIn} onChange={e=>setCheckIn(e.target.value)} className="w-full p-2.5 md:p-3 border border-slate-200 rounded-xl bg-white shadow-sm font-bold text-xs md:text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" required />
                                    </div>
                                    <div className="w-full">
                                        <label className="text-[10px] md:text-xs font-bold text-slate-600 uppercase mb-1 block">{t.checkOut}</label>
                                        <input type="date" value={checkOut} onChange={e=>setCheckOut(e.target.value)} className="w-full p-2.5 md:p-3 border border-slate-200 rounded-xl bg-white shadow-sm font-bold text-xs md:text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" required />
                                    </div>
                                </div>

                                <div className="relative mt-2">
                                    <label className="text-[10px] md:text-xs font-bold text-slate-600 uppercase block mb-1">{t.guestsRooms}</label>
                                    <div onClick={() => setShowGuestPicker(!showGuestPicker)} className="w-full p-2.5 md:p-3 border border-slate-200 rounded-xl bg-white shadow-sm font-bold text-xs md:text-sm text-slate-700 cursor-pointer flex justify-between items-center select-none hover:bg-blue-50 transition-colors">
                                        <span className="truncate pr-2">{adults} {t.adults}{kids > 0 ? `, ${kids} ${t.children}` : ''}{infants > 0 ? `, ${infants} ${t.infants}` : ''} · {roomCount} {t.room}</span>
                                        <span className="text-slate-400 shrink-0">▼</span>
                                    </div>

                                    {showGuestPicker && (
                                        <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-fade-in space-y-4 text-slate-800">
                                            <div className="flex justify-between items-center">
                                                <div><p className="font-bold text-sm">{t.adults}</p><p className="text-[10px] text-slate-500">{t.age13}</p></div>
                                                <div className="flex items-center gap-3"><button type="button" onClick={()=>setAdults(Math.max(1, adults-1))} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">-</button><span className="w-4 text-center font-bold">{adults}</span><button type="button" onClick={()=>setAdults(adults+1)} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">+</button></div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div><p className="font-bold text-sm">{t.children}</p><p className="text-[10px] text-slate-500">{t.age2_12}</p></div>
                                                <div className="flex items-center gap-3"><button type="button" onClick={()=>setKids(Math.max(0, kids-1))} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">-</button><span className="w-4 text-center font-bold">{kids}</span><button type="button" onClick={()=>setKids(kids+1)} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">+</button></div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div><p className="font-bold text-sm">{t.infants}</p><p className="text-[10px] text-slate-500">{t.under2}</p></div>
                                                <div className="flex items-center gap-3"><button type="button" onClick={()=>setInfants(Math.max(0, infants-1))} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">-</button><span className="w-4 text-center font-bold">{infants}</span><button type="button" onClick={()=>setInfants(infants+1)} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">+</button></div>
                                            </div>
                                            <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                                                <div><p className="font-bold text-sm">{t.rooms}</p></div>
                                                <div className="flex items-center gap-3"><button type="button" onClick={()=>setRoomCount(Math.max(1, roomCount-1))} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">-</button><span className="w-4 text-center font-bold">{roomCount}</span><button type="button" onClick={()=>setRoomCount(roomCount+1)} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">+</button></div>
                                            </div>
                                            <button type="button" onClick={()=>setShowGuestPicker(false)} className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl mt-2 hover:bg-slate-800 transition-colors">{t.done}</button>
                                        </div>
                                    )}
                                </div>
                                <button type="submit" className="w-full theme-bg theme-hover text-white py-3.5 md:py-4 rounded-xl font-black md:text-lg mt-2 shadow-lg transition-transform active:scale-95">{t.checkAvail}</button>
                            </form>
                        </div>
                    </div>
                </div>
            ) : ( <p className="text-center text-slate-400 font-bold py-20">{t.noRooms}</p> )}
          </section>
        )}

        {/* 🍴 FACILITIES */}
        {activeMenu === 'FACILITIES' && (
          <section className="pt-24 md:pt-32 pb-20 px-4 md:px-6 max-w-7xl mx-auto animate-fade-in-up w-full flex-grow">
            {facilities.length > 0 ? (
                <div>
                    <div className="flex overflow-x-auto gap-2 mb-0 px-2 md:px-4 scrollbar-hide snap-x">
                        {facilities.map((fac, idx) => (
                            <button key={idx} onClick={(e) => handleTabClick(e, setActiveFacIdx, idx)} className={`snap-center px-5 md:px-6 py-3 md:py-4 font-black rounded-t-2xl whitespace-pre-wrap leading-tight text-center transition-all border-t border-l border-r border-slate-200 ${activeFacIdx === idx ? 'bg-white theme-text shadow-[0_-4px_10px_rgba(0,0,0,0.05)] text-base md:text-lg z-10 relative' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 text-xs md:text-sm mt-1.5 md:mt-2'}`}>{fac.title || 'Facility'}</button>
                        ))}
                    </div>
                    <div className="bg-white rounded-b-3xl rounded-tr-3xl shadow-xl border border-slate-200 p-5 md:p-8 grid grid-cols-1 lg:grid-cols-10 gap-6 md:gap-8 relative z-0 -mt-px">
                        <div className="lg:col-span-7 flex flex-col gap-6">
                            <div className="w-full h-[250px] sm:h-[350px] md:h-[450px] rounded-2xl md:rounded-3xl overflow-hidden relative shadow-inner bg-slate-900">
                                {(() => {
                                    const activeItem = facilities[activeFacIdx] || {};
                                    let images = activeItem.image_urls?.length > 0 ? activeItem.image_urls : (activeItem.image_url ? [activeItem.image_url] : ["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=1000"]);
                                    return images.map((img, idx) => ( <img key={`fac_slide_${idx}`} src={img} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${(facSlideIdx % images.length) === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} alt="facility" /> ));
                                })()}
                            </div>
                        </div>
                        <div className="lg:col-span-3 flex flex-col justify-center">
                            <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-6 border-b border-slate-300 pb-2 inline-block self-start whitespace-pre-wrap">{facilities[activeFacIdx]?.title}</h3>
                            <div className={htmlRenderClass} dangerouslySetInnerHTML={{ __html: facilities[activeFacIdx]?.description || '' }} />
                        </div>
                    </div>
                </div>
            ) : <p className="text-center text-slate-400 font-bold py-20">{t.noFac}</p>}
          </section>
        )}

        {/* 🗺️ ATTRACTIONS */}
        {activeMenu === 'ATTRACTIONS' && (
          <section className="pt-24 md:pt-32 pb-20 px-4 md:px-6 max-w-7xl mx-auto animate-fade-in-up w-full flex-grow">
             {attractions.length > 0 ? (
                 <div>
                    <div className="flex overflow-x-auto gap-2 mb-0 px-2 md:px-4 scrollbar-hide snap-x">
                        {attractions.map((att, idx) => (
                            <button key={idx} onClick={(e) => handleTabClick(e, setActiveAttIdx, idx)} className={`snap-center px-5 md:px-6 py-3 md:py-4 font-black rounded-t-2xl whitespace-pre-wrap leading-tight text-center transition-all border-t border-l border-r border-slate-200 ${activeAttIdx === idx ? 'bg-white theme-text shadow-[0_-4px_10px_rgba(0,0,0,0.05)] text-base md:text-lg z-10 relative' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 text-xs md:text-sm mt-1.5 md:mt-2'}`}>{att.title || 'Attraction'}</button>
                        ))}
                    </div>
                    <div className="bg-white rounded-b-3xl rounded-tr-3xl shadow-xl border border-slate-200 p-5 md:p-8 grid grid-cols-1 lg:grid-cols-10 gap-6 md:gap-8 relative z-0 -mt-px">
                        <div className="lg:col-span-7 flex flex-col gap-6">
                            <div className="w-full h-[250px] sm:h-[350px] md:h-[450px] rounded-2xl md:rounded-3xl overflow-hidden relative shadow-inner bg-slate-900">
                                {(() => {
                                    const activeItem = attractions[activeAttIdx] || {};
                                    let images = activeItem.image_urls?.length > 0 ? activeItem.image_urls : (activeItem.image_url ? [activeItem.image_url] : ["https://images.unsplash.com/photo-1542314831-c6a4d27a658d?auto=format&fit=crop&q=80&w=1000"]);
                                    return images.map((img, idx) => ( <img key={`att_slide_${idx}`} src={img} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${(attSlideIdx % images.length) === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} alt="attraction" /> ));
                                })()}
                            </div>
                        </div>
                        <div className="lg:col-span-3 flex flex-col justify-center">
                            <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-6 border-b border-slate-300 pb-2 inline-block self-start whitespace-pre-wrap">{attractions[activeAttIdx]?.title}</h3>
                            <div className={htmlRenderClass} dangerouslySetInnerHTML={{ __html: attractions[activeAttIdx]?.description || '' }} />
                        </div>
                    </div>
                 </div>
             ) : <p className="text-center text-slate-400 font-bold py-20">{t.noAtt}</p>}
          </section>
        )}

        {/* 📍 CONTACT */}
        {activeMenu === 'CONTACT' && (
          <section className="pt-24 md:pt-32 pb-20 px-4 md:px-6 max-w-7xl mx-auto animate-fade-in-up w-full flex-grow">
             <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl border border-slate-200 p-5 md:p-8 grid grid-cols-1 lg:grid-cols-10 gap-6 md:gap-8">
                <div className="lg:col-span-7 w-full h-[300px] md:h-[500px] rounded-2xl md:rounded-3xl overflow-hidden shadow-inner border border-slate-100 bg-slate-100 [&_iframe]:!w-full [&_iframe]:!h-full [&_div]:!w-full [&_div]:!h-full">
                    {safeConfig.map_embed_url ? ( <div dangerouslySetInnerHTML={{ __html: safeConfig.map_embed_url }} className="w-full h-full" /> ) : ( <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-sm">{t.mapUpdating}</div> )}
                </div>
                <div className="lg:col-span-3 flex flex-col">
                    <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-6 self-start">{t.contactUs}</h3>
                    <div className="space-y-4 md:space-y-6 text-slate-600 flex-1">
                        <div>
                            <p className="font-black text-lg md:text-xl text-slate-800 mb-4">{safeConfig.welcome_title || "Our Hotel"}</p>
                            {sns?.address && <p className="flex items-start gap-3 mb-3 text-sm font-medium"><span className="shrink-0 mt-0.5 text-base">🏠</span> <span className="whitespace-pre-wrap">{sns.address}</span></p>}
                            {sns?.phone && <p className="flex items-start gap-3 mb-3 text-sm font-medium"><span className="shrink-0 mt-0.5 text-base">📞</span> <span className="whitespace-pre-wrap">{sns.phone}</span></p>}
                            {sns?.email && <p className="flex items-center gap-3 mb-3 text-sm font-medium"><span className="shrink-0 text-base">✉️</span> <span>{sns.email}</span></p>}
                        </div>
                    </div>
                </div>
            </div>
          </section>
        )}

        {/* 💡 4개 국어 지원 중앙 예약 알림 모달창 */}
        {showBookingModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowBookingModal(false)}>
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden text-center border border-slate-100" onClick={e => e.stopPropagation()}>
                    <div className="bg-blue-600 p-6 text-white">
                        <span className="text-4xl block mb-2">🗓️</span>
                        <h3 className="text-xl font-black">{t.modalTitle}</h3>
                    </div>
                    <div className="p-8 text-slate-700 font-medium text-base">
                        <p className="font-bold text-lg text-slate-900 mb-4">{t.modalMsg}</p>
                    </div>
                    <div className="p-5 bg-slate-50 border-t border-slate-100">
                        <button onClick={() => setShowBookingModal(false)} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-black transition-transform active:scale-95 shadow-md">{t.close}</button>
                    </div>
                </div>
            </div>
        )}

        {/* 📱 푸터 (집 나간 SNS 링크 정상 복구!) */}
        <footer className="bg-white/90 backdrop-blur-md border-t border-slate-200 py-8 md:py-10 px-6 text-center mt-auto">
          <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
              
              {/* 💡 [핵심 해결] SNS 아이콘이 http 포함 여부 상관없이 100% 렌더링되도록 수정 */}
              {(sns?.ig || sns?.fb) && (
                  <div className="flex gap-4 mb-2">
                      {sns?.ig && <a href={sns.ig.startsWith('http') ? sns.ig : `https://${sns.ig}`} target="_blank" rel="noreferrer" className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-pink-600 hover:bg-pink-600 hover:text-white hover:border-pink-600 transition-all shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16.11 7.99a.01.01 0 0 1 .02 0"/><path d="M15.82 12.18A4 4 0 1 1 11.82 8a4 4 0 0 1 4 4.18"/></svg></a>}
                      {sns?.fb && <a href={sns.fb.startsWith('http') ? sns.fb : `https://${sns.fb}`} target="_blank" rel="noreferrer" className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>}
                  </div>
              )}

              <p className="text-xs md:text-sm font-bold text-slate-500">
                  &copy; {new Date().getFullYear()} <span className="theme-text">{safeConfig.footer_company_name || safeConfig.welcome_title || "Our Hotel"}</span>. {t.rights}
              </p>
          </div>
        </footer>
      </div>
    </>
  );
}