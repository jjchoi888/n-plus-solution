"use client";
import React, { useState, useEffect } from "react";
import RoomList from "./RoomList";

const BASE_URL = 'http://136.117.49.111:8000';

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

// 💡 [신규] 장바구니(RoomList) 하얀 화면 원인 추적기
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 bg-red-50 border border-red-200 rounded-3xl text-center max-w-3xl mx-auto mt-20 shadow-xl">
          <h2 className="text-2xl font-black text-red-600 mb-4">Oops! A rendering error occurred 🚨</h2>
          <p className="text-slate-700 font-bold mb-2">Error Details:</p>
          <pre className="bg-white p-4 rounded-xl text-sm text-left overflow-auto border border-red-100 text-red-800">
            {this.state.error.toString()}
          </pre>
          <p className="text-slate-500 mt-6 text-sm font-bold">Please refresh the page or contact the administrator.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const translations = {
    en: {
        home: 'HOME', rooms: 'ROOMS', facilities: 'FACILITIES', attractions: 'ATTRACTIONS', contact: 'CONTACT',
        bookNow: 'Book Now', aboutUs: 'About Us', bookStay: 'Book Your Stay', reserveNow: 'Reserve Now',
        expStart: 'Experience', startingFrom: 'starting from', night: '/night',
        checkIn: 'Check-in', checkOut: 'Check-out', guestsRooms: 'Guests & Rooms',
        adults: 'Adults', age13: 'Age 13+', children: 'Children', age2_12: 'Ages 2-12', infants: 'Infants', under2: 'Under 2',
        room: 'Room', rooms: 'Rooms', done: 'Done', maxGuests: 'Max', guests: 'Guests',
        noImg: 'No Image Available', noRooms: 'No rooms available.', noFac: 'No facilities registered.', noAtt: 'No attractions registered.',
        mapUpdating: 'Location map is currently being updated.', contactUs: 'Contact Us', rights: 'All rights reserved.',
        standardBed: 'Standard Bed', available: 'Available', soldOut: 'Sold Out / Not Enough Rooms',
        secureCheckout: 'Secure Checkout', guestDetails: 'Guest Details', 
        firstName: 'First Name', lastName: 'Last Name', email: 'Email Address', phone: 'Phone Number', nationality: 'Nationality',
        extraOptions: 'Extra Options', extraBed: 'Extra Bed',
        paymentMethod: 'Payment Method', cardNum: 'Card Number', expiry: 'Expiry Date', cvv: 'CVV',
        bookingSummary: 'Booking Summary', promoCode: 'Promo Code', apply: 'Apply', total: 'Total', confirmBook: 'Confirm & Book', processing: 'Processing...'
    },
    ko: {
        home: '홈', rooms: '객실', facilities: '부대시설', attractions: '관광지', contact: '오시는길',
        bookNow: '예약하기', aboutUs: '호텔 소개', bookStay: '객실 예약', reserveNow: '예약 진행하기',
        expStart: '', startingFrom: '최저가', night: '/1박',
        checkIn: '체크인', checkOut: '체크아웃', guestsRooms: '인원 및 객실',
        adults: '성인', age13: '13세 이상', children: '어린이', age2_12: '2~12세', infants: '유아', under2: '2세 미만',
        room: '객실', rooms: '객실', done: '완료', maxGuests: '최대', guests: '명',
        noImg: '이미지 없음', noRooms: '등록된 객실이 없습니다.', noFac: '등록된 부대시설이 없습니다.', noAtt: '등록된 관광지가 없습니다.',
        mapUpdating: '지도가 업데이트 중입니다.', contactUs: '문의 및 연락처', rights: '모든 권리 보유.',
        standardBed: '스탠다드 베드', available: '예약 가능', soldOut: '해당 일자 예약 마감 (객실 부족)',
        secureCheckout: '안전한 객실 결제', guestDetails: '예약자 정보', 
        firstName: '이름 (First Name)', lastName: '성 (Last Name)', email: '이메일', phone: '연락처', nationality: '국적',
        extraOptions: '추가 옵션', extraBed: '엑스트라 베드',
        paymentMethod: '결제 정보', cardNum: '카드 번호', expiry: '유효기간 (MM/YY)', cvv: '보안코드 (CVV)',
        bookingSummary: '예약 요약', promoCode: '프로모션 코드', apply: '적용', total: '총 결제 금액', confirmBook: '결제 및 예약 확정', processing: '처리 중...'
    },
    zh: {
        home: '首页', rooms: '客房', facilities: '设施', attractions: '景点', contact: '联系我们',
        bookNow: '立即预订', aboutUs: '关于我们', bookStay: '预订客房', reserveNow: '立即预订',
        expStart: '体验', startingFrom: '起价', night: '/晚',
        checkIn: '入住', checkOut: '退房', guestsRooms: '人数与客房',
        adults: '成人', age13: '13岁以上', children: '儿童', age2_12: '2-12岁', infants: '婴儿', under2: '2岁以下',
        room: '间', rooms: '间', done: '完成', maxGuests: '最多', guests: '人',
        noImg: '暂无图片', noRooms: '暂无客房。', noFac: '暂无设施。', noAtt: '暂无景点。',
        mapUpdating: '位置地图正在更新中。', contactUs: '联系我们', rights: '版权所有。',
        standardBed: '标准床', available: '可预订', soldOut: '客房已满',
        secureCheckout: '安全结账', guestDetails: '客人信息', 
        firstName: '名字', lastName: '姓氏', email: '电子邮件', phone: '电话号码', nationality: '国籍',
        extraOptions: '额外选项', extraBed: '加床',
        paymentMethod: '付款方式', cardNum: '卡号', expiry: '有效期', cvv: 'CVV',
        bookingSummary: '预订摘要', promoCode: '优惠码', apply: '应用', total: '总计', confirmBook: '确认并预订', processing: '处理中...'
    },
    ja: {
        home: 'ホーム', rooms: '客室', facilities: '施設', attractions: '観光', contact: 'アクセス',
        bookNow: '今すぐ予約', aboutUs: 'ホテルについて', bookStay: 'ご予約', reserveNow: '予約する',
        expStart: '', startingFrom: '最安値', night: '/泊',
        checkIn: 'チェックイン', checkOut: 'チェックアウト', guestsRooms: '人数と客室',
        adults: '大人', age13: '13歳以上', children: '子供', age2_12: '2~12歳', infants: '幼児', under2: '2歳未満',
        room: '室', rooms: '室', done: '完了', maxGuests: '最大', guests: '名',
        noImg: '画像なし', noRooms: '利用可能な客室がありません。', noFac: '登録された施設がありません。', noAtt: '登録された観光地がありません。',
        mapUpdating: 'マップは現在更新中です。', contactUs: 'お問い合わせ', rights: '無断複写・転載を禁じます。',
        standardBed: 'スタンダードベッド', available: '空室あり', soldOut: '満室 (予約不可)',
        secureCheckout: '安全なチェックアウト', guestDetails: '宿泊者情報', 
        firstName: '名', lastName: '姓', email: 'メールアドレス', phone: '電話番号', nationality: '国籍',
        extraOptions: '追加オプション', extraBed: 'エキストラベッド',
        paymentMethod: 'お支払い方法', cardNum: 'カード番号', expiry: '有効期限', cvv: 'CVV',
        bookingSummary: '予約の概要', promoCode: 'プロモコード', apply: '適用', total: '合計', confirmBook: '予約を確定する', processing: '処理中...'
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
  const [hasSearched, setHasSearched] = useState(false); // 💡 모달 대신 검색창 바로 밑에 띄우기 위한 스위치
  const [alertMessage, setAlertMessage] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [nationality, setNationality] = useState('Philippines');
  const [extraBed, setExtraBed] = useState(0);
  const [cardNum, setCardNum] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  const [availableCount, setAvailableCount] = useState(null);

  const getEffectiveHotelCode = () => {
    if (typeof window === 'undefined') return domain || 'sample001';
    
    const params = new URLSearchParams(window.location.search);
    const hotelParam = params.get('hotel');
    
    // 1순위: URL 파라미터 (?hotel=sample001)
    if (hotelParam) return hotelParam;
    
    // 2순위: 도메인 분석 (로컬 환경 대응)
    const hostname = window.location.hostname;
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
      return 'sample001'; 
    }
    
    // 3순위: 기본값 (매우 중요)
    return 'sample001'; 
  };

  const hotelCode = getEffectiveHotelCode();

  useEffect(() => {
    // 💡 로딩 상태 시작
    setLoading(true);

    // 1. 웹사이트 설정 로드
    fetch(`${BASE_URL}/api/settings/website?hotel=${hotelCode}`)
      .then(res => res.json())
      .then(data => { 
        if (data && data.success && data.config) {
          setConfig(data.config); 
        } 
      })
      .catch(err => console.error("Failed to load config", err));

    // 2. 객실 타입 로드
    fetch(`${BASE_URL}/api/admin/room-types?hotel=${hotelCode}`)
      .then(r => r.json())
      .then(adminData => {
          if(adminData.success && adminData.rooms) {
              const formattedRooms = adminData.rooms.map(r => ({
                  id: r.id, 
                  name: typeof r.name === 'object' ? r.name.en : r.name,
                  price: r.basePrice, 
                  images: r.images || [], 
                  availableCount: 5, 
                  roomConfig: r.roomConfig,
                  maxGuests: r.roomConfig?.maxGuests || 2,
                  size: r.roomConfig?.size || '',
                  description: r.roomConfig?.description || ''
              }));
              setRooms(formattedRooms);
              if(formattedRooms.length > 0) setSelectedRoomId(formattedRooms[0].id);
          }
      })
      .catch(err => console.error("Failed to load room types", err))
      .finally(() => setLoading(false));
      
  }, [hotelCode]); //

  const safeConfig = config || {};
  let gallery = []; try { gallery = JSON.parse(safeConfig.gallery_json || '[]'); } catch(e){}
  let sns = {}; try { if (safeConfig.sns_json) { sns = typeof safeConfig.sns_json === 'string' ? JSON.parse(safeConfig.sns_json) : safeConfig.sns_json; if (typeof sns === 'string') sns = JSON.parse(sns); } } catch(e){}
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

  const activeRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0];

  useEffect(() => {
      if (checkIn && checkOut && activeRoom && activeMenu === 'ROOMS') {
          fetch(`${BASE_URL}/api/public/check-availability?hotel=${hotelCode}&type=${activeRoom.name}&check_in=${checkIn}&check_out=${checkOut}`)
              .then(r => r.json())
              .then(data => setAvailableCount(data.count))
              .catch(() => setAvailableCount(null));
      } else {
          setAvailableCount(null);
      }
  }, [checkIn, checkOut, activeRoom, hotelCode, activeMenu]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-xl font-bold text-slate-500 bg-slate-50">Loading your perfect stay...</div>;

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
        :root { --theme-color: ${themeColor}; --theme-color-light: ${themeColor}15; --theme-color-border: ${themeColor}40; }
        .custom-font { font-family: '${themeFont}', sans-serif; }
        .theme-bg { background-color: var(--theme-color) !important; }
        .theme-bg-light { background-color: var(--theme-color-light) !important; }
        .theme-text { color: var(--theme-color) !important; }
        .theme-border { border-color: var(--theme-color-border) !important; }
        .theme-hover:hover { opacity: 0.85; transform: translateY(-2px); transition: all 0.2s; }
        .theme-focus:focus { border-color: var(--theme-color) !important; box-shadow: 0 0 0 2px var(--theme-color-light) !important; outline: none; }
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
                  <button onClick={() => setActiveMenu('BOOK')} className="theme-bg theme-hover text-white px-4 md:px-7 py-2 md:py-2.5 rounded-full font-bold shadow-md text-xs md:text-base whitespace-nowrap">{t.bookNow}</button>
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

        {/* 💡 [완벽 복구] 인라인 장바구니 검색 화면 (모달 아님!) */}
        {/* 💡 [완벽 복구] 인라인 장바구니 검색 화면 (모달 아님!) */}
        {activeMenu === 'BOOK' && (
          <section className="relative pt-32 pb-20 px-4 md:px-6 w-full flex-grow min-h-[85vh] flex flex-col items-center justify-start animate-fade-in-up">
              
              {/* 1. 뒷배경 슬라이더 */}
              <div className="fixed inset-0 z-0 bg-slate-50">
                  {sliderImages.map((img, idx) => (
                      <img key={idx} src={img} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? 'opacity-40 z-10' : 'opacity-0 z-0'}`} alt="slide" />
                  ))}
                  <div className="absolute inset-0 bg-white/60 z-10 pointer-events-none"></div>
              </div>

              {/* 2. 💡 [핵심 수정] 검색 필터 전체를 완전히 독립된 높은 레이어(z-[100]) 박스로 분리했습니다! */}
              <div className="relative z-[100] w-full max-w-5xl flex flex-col items-center mt-4">
                  <div className="bg-white p-2 md:p-3 rounded-3xl md:rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col md:flex-row items-center gap-2 w-full border border-white/50 backdrop-blur-xl bg-white/90">
                      
                      <div className="flex-1 px-6 py-3 border-b md:border-b-0 md:border-r border-slate-200 w-full relative hover:bg-slate-50 transition-colors md:rounded-l-full cursor-pointer">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">{t.checkIn}</label>
                          {/* 💡 min 속성에 getHotelDate(0) 적용 */}
                          <input type="date" value={checkIn} min={getHotelDate(0)} onChange={e=>{
                              const newIn = e.target.value;
                              setCheckIn(newIn); 
                              setHasSearched(false);
                              if (!checkOut || newIn >= checkOut) {
                                  const d = new Date(newIn); d.setDate(d.getDate() + 1);
                                  setCheckOut(d.toISOString().split('T')[0]);
                              }
                          }} className="w-full bg-transparent font-black text-slate-800 outline-none text-base md:text-lg cursor-pointer" />
                      </div>
                      
                      <div className="flex-1 px-6 py-3 border-b md:border-b-0 md:border-r border-slate-200 w-full relative hover:bg-slate-50 transition-colors cursor-pointer">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">{t.checkOut}</label>
                          {/* 💡 min 속성에 getHotelDate(0) 적용 */}
                          <input type="date" value={checkOut} min={checkIn ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().split('T')[0] : getHotelDate(0)} onChange={e=>{setCheckOut(e.target.value); setHasSearched(false);}} className="w-full bg-transparent font-black text-slate-800 outline-none text-base md:text-lg cursor-pointer" />
                      </div>
                      
                      <div className="flex-1 px-6 py-3 w-full cursor-pointer relative hover:bg-slate-50 transition-colors" onClick={() => setShowGuestPicker(!showGuestPicker)}>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">{t.guestsRooms}</label>
                          <div className="font-black text-slate-800 text-base md:text-lg truncate">{adults} {t.adults}{kids > 0 ? `, ${kids} ${t.children}` : ''} · {roomCount} {t.room}</div>
                          
                          {/* 💡 드롭다운 내부 z-index 강화 */}
                          {showGuestPicker && (
                              <div className="absolute top-full left-0 md:left-auto md:right-0 w-[300px] mt-4 bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 z-[200] animate-fade-in space-y-5 text-slate-800 cursor-default" onClick={e => e.stopPropagation()}>
                                  <div className="flex justify-between items-center">
                                      <div><p className="font-bold text-sm">{t.adults}</p><p className="text-[10px] text-slate-500">{t.age13}</p></div>
                                      <div className="flex items-center gap-3"><button type="button" onClick={(e)=>{e.stopPropagation(); setAdults(Math.max(1, adults-1)); setHasSearched(false);}} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">-</button><span className="w-4 text-center font-bold">{adults}</span><button type="button" onClick={(e)=>{e.stopPropagation(); setAdults(adults+1); setHasSearched(false);}} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">+</button></div>
                                  </div>
                                  <div className="flex justify-between items-center">
                                      <div><p className="font-bold text-sm">{t.children}</p><p className="text-[10px] text-slate-500">{t.age2_12}</p></div>
                                      <div className="flex items-center gap-3"><button type="button" onClick={(e)=>{e.stopPropagation(); setKids(Math.max(0, kids-1)); setHasSearched(false);}} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">-</button><span className="w-4 text-center font-bold">{kids}</span><button type="button" onClick={(e)=>{e.stopPropagation(); setKids(kids+1); setHasSearched(false);}} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">+</button></div>
                                  </div>
                                  
                                  {/* 💡 영유아(Free) 표시 */}
                                  <div className="flex justify-between items-center bg-emerald-50/50 p-2 -mx-2 rounded-lg border border-emerald-100/50">
                                      <div><p className="font-bold text-sm text-emerald-900">{t.infants}</p><p className="text-[10px] text-emerald-600/80">{t.under2}</p></div>
                                      <div className="font-black text-emerald-600 bg-white px-3 py-1 rounded-full text-xs border border-emerald-100 shadow-sm uppercase tracking-widest">Free</div>
                                  </div>

                                  <div className="border-t border-slate-100 pt-5 flex justify-between items-center">
                                      <div><p className="font-bold text-sm">{t.rooms}</p></div>
                                      <div className="flex items-center gap-3"><button type="button" onClick={(e)=>{e.stopPropagation(); setRoomCount(Math.max(1, roomCount-1)); setHasSearched(false);}} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">-</button><span className="w-4 text-center font-bold">{roomCount}</span><button type="button" onClick={(e)=>{e.stopPropagation(); setRoomCount(roomCount+1); setHasSearched(false);}} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">+</button></div>
                                  </div>
                                  <button type="button" onClick={(e)=>{e.stopPropagation(); setShowGuestPicker(false);}} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl mt-2 hover:bg-slate-800 transition-colors">{t.done}</button>
                              </div>
                          )}
                      </div>

                      <button onClick={() => {
                          if(!checkIn || !checkOut) return setAlertMessage(lang === 'ko' ? "체크인과 체크아웃 날짜를 선택해주세요." : "Please select valid dates.");
                          setHasSearched(true);
                      }} className="w-full md:w-auto theme-bg theme-hover text-white px-10 py-4 md:py-5 rounded-2xl md:rounded-full font-black text-lg transition-transform active:scale-95 shadow-md m-1">
                          Search
                      </button>
                  </div>
              </div>

              {/* 3. 💡 [핵심 수정] 검색 결과창을 필터 박스 밖으로 완전히 분리하여 낮은 레이어(z-10)로 깔아줍니다! */}
              {hasSearched && (
                  <div className="w-full max-w-5xl relative z-10 mt-8">
                      <ErrorBoundary>
                          <RoomList 
                              hotelCode={hotelCode} 
                              lang={lang} 
                              checkIn={checkIn} 
                              checkOut={checkOut} 
                              adults={adults} 
                              kids={kids} 
                          />
                      </ErrorBoundary>
                  </div>
              )}
          </section>
        )}

        {/* 🛏️ 개별 ROOMS 탭 */}
        {activeMenu === 'ROOMS' && (
          <section className="pt-24 md:pt-32 pb-40 md:pb-56 px-4 md:px-6 max-w-7xl mx-auto animate-fade-in-up w-full flex-grow relative z-20">
            {rooms.length > 0 && activeRoom ? (
                <div className="relative z-30">
                    <div className="flex overflow-x-auto gap-2 mb-0 px-2 md:px-4 scrollbar-hide snap-x relative z-10">
                        {rooms.map(r => (
                            <button key={r.id} onClick={(e) => handleTabClick(e, setSelectedRoomId, r.id)} 
                                className={`snap-center px-5 md:px-6 py-3 md:py-4 font-black rounded-t-2xl whitespace-nowrap transition-all border-t border-l border-r border-slate-200 ${selectedRoomId === r.id ? 'bg-white theme-text shadow-[0_-4px_10px_rgba(0,0,0,0.05)] text-base md:text-lg z-10 relative' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 text-xs md:text-sm mt-1.5 md:mt-2'}`}>
                                {r.name}
                            </button>
                        ))}
                    </div>
                    <div className="bg-white rounded-b-3xl rounded-tr-3xl shadow-xl border border-slate-200 p-5 md:p-8 grid grid-cols-1 lg:grid-cols-10 gap-6 md:gap-8 relative z-30 -mt-px">
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
                                    {/* 💡 [수정] 데이터 경로를 완벽하게 찾아 사이즈를 띄워줍니다. */}
                                    {(activeRoom.size || activeRoom.roomConfig?.size) && <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs md:text-sm font-bold">📏 {activeRoom.size || activeRoom.roomConfig?.size} sq.m</span>}
                                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs md:text-sm font-bold">🛏️ {activeRoom.roomConfig?.bedType || t.standardBed}</span>
                                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs md:text-sm font-bold">👥 {t.maxGuests} {activeRoom.maxGuests || 2} {t.guests}</span>
                                </div>
                                <p className="text-slate-600 leading-relaxed font-medium text-sm md:text-base whitespace-pre-wrap">{activeRoom.description || activeRoom.roomConfig?.description}</p>
                            </div>
                        </div>
                        <div className="lg:col-span-3 theme-bg-light p-5 md:p-8 rounded-2xl md:rounded-3xl border theme-border flex flex-col justify-center h-full">
                            <h3 className="text-xl md:text-2xl font-black theme-text mb-2">{t.bookStay}</h3>
                            <p className="text-slate-500 text-xs md:text-sm font-bold mb-6">{renderPriceStr(activeRoom.price, activeRoom.name)}</p>
                            
                            <form className="space-y-4 relative mt-2" onSubmit={(e) => { 
                                e.preventDefault(); 
                                // 💡 [Cleaned] Standardized alert messages to English
                                if (!checkIn || !checkOut) return setAlertMessage("Please select valid dates.");
                                if (new Date(checkOut) <= new Date(checkIn)) return setAlertMessage("Check-out must be after check-in.");
                                if (availableCount !== null && availableCount < roomCount) return setAlertMessage("Not enough rooms available.");
                                setShowBookingModal(true); 
                            }}>
                                <div className="flex flex-col gap-4">
                                    <div className="w-full">
                                        <label className="text-[10px] md:text-xs font-bold text-slate-600 uppercase mb-1 block">{t.checkIn}</label>
                                        {/* 💡 min 속성에 getHotelDate(0) 적용 */}
                                        <input type="date" value={checkIn} min={getHotelDate(0)} onChange={e=>{
                                            const newIn = e.target.value;
                                            setCheckIn(newIn);
                                            if (!checkOut || newIn >= checkOut) {
                                                const d = new Date(newIn); d.setDate(d.getDate() + 1);
                                                setCheckOut(d.toISOString().split('T')[0]);
                                            }
                                        }} className="w-full p-2.5 md:p-3 border border-slate-200 rounded-xl bg-white shadow-sm font-bold text-xs md:text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" required />
                                    </div>
                                    <div className="w-full">
                                        <label className="text-[10px] md:text-xs font-bold text-slate-600 uppercase mb-1 block">{t.checkOut}</label>
                                        {/* 💡 min 속성에 getHotelDate(0) 적용 */}
                                        <input type="date" value={checkOut} min={checkIn ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().split('T')[0] : getHotelDate(0)} onChange={e=>setCheckOut(e.target.value)} className="w-full p-2.5 md:p-3 border border-slate-200 rounded-xl bg-white shadow-sm font-bold text-xs md:text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" required />
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
                                
                                {availableCount !== null && checkIn && checkOut && (
                                    <div className="mt-4 p-3 rounded-xl text-center font-black text-sm border shadow-sm transition-all" style={{ backgroundColor: availableCount >= roomCount ? '#f0fdf4' : '#fef2f2', borderColor: availableCount >= roomCount ? '#bbf7d0' : '#fecaca', color: availableCount >= roomCount ? '#166534' : '#991b1b' }}>
                                        {availableCount >= roomCount ? `✅ ${availableCount} ${t.rooms} ${t.available}` : `❌ ${t.soldOut}`}
                                    </div>
                                )}

                                {/* 💡 [요청 반영] Reserve Now 변경 */}
                                <button type="submit" disabled={availableCount !== null && availableCount < roomCount} className="w-full theme-bg theme-hover text-white py-3.5 md:py-4 rounded-xl font-black md:text-lg mt-2 shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {t.reserveNow}
                                </button>
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

        {/* 💡 Secure Checkout 모달창 */}
        {showBookingModal && (() => {
            const start = new Date(checkIn);
            const end = new Date(checkOut);
            const nights = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
            
            const basePrice = (activeRoom?.price || 0) * nights * roomCount;
            const extraBedPrice = extraBed * 1000 * nights;
            const finalTotal = basePrice + extraBedPrice;

            const topCountries = ["Philippines", "South Korea", "China", "Japan", "United States"];
            const otherCountries = "Afghanistan,Albania,Algeria,Andorra,Angola,Argentina,Armenia,Australia,Austria,Azerbaijan,Bahamas,Bahrain,Bangladesh,Barbados,Belarus,Belgium,Belize,Benin,Bhutan,Bolivia,Bosnia and Herzegovina,Botswana,Brazil,Brunei,Bulgaria,Burkina Faso,Burundi,Cabo Verde,Cambodia,Cameroon,Canada,Central African Republic,Chad,Chile,Colombia,Comoros,Congo,Costa Rica,Croatia,Cuba,Cyprus,Czech Republic,Denmark,Djibouti,Dominica,Dominican Republic,Ecuador,Egypt,El Salvador,Equatorial Guinea,Eritrea,Estonia,Eswatini,Ethiopia,Fiji,Finland,France,Gabon,Gambia,Georgia,Germany,Ghana,Greece,Grenada,Guatemala,Guinea,Guinea-Bissau,Guyana,Haiti,Honduras,Hungary,Iceland,India,Indonesia,Iran,Iraq,Ireland,Israel,Italy,Jamaica,Jordan,Kazakhstan,Kenya,Kiribati,Kuwait,Kyrgyzstan,Laos,Latvia,Lebanon,Lesotho,Liberia,Libya,Liechtenstein,Lithuania,Luxembourg,Madagascar,Malawi,Malaysia,Maldives,Mali,Malta,Marshall Islands,Mauritania,Mauritius,Mexico,Micronesia,Moldova,Monaco,Mongolia,Montenegro,Morocco,Mozambique,Myanmar,Namibia,Nauru,Nepal,Netherlands,New Zealand,Nicaragua,Niger,Nigeria,North Macedonia,Norway,Oman,Pakistan,Palau,Panama,Papua New Guinea,Paraguay,Peru,Poland,Portugal,Qatar,Romania,Russia,Rwanda,Saint Kitts and Nevis,Saint Lucia,Saint Vincent,Samoa,San Marino,Sao Tome and Principe,Saudi Arabia,Senegal,Serbia,Seychelles,Sierra Leone,Singapore,Slovakia,Slovenia,Solomon Islands,Somalia,South Africa,Spain,Sri Lanka,Sudan,Suriname,Sweden,Switzerland,Syria,Taiwan,Tajikistan,Tanzania,Thailand,Timor-Leste,Togo,Tonga,Trinidad and Tobago,Tunisia,Turkey,Turkmenistan,Tuvalu,Uganda,Ukraine,United Arab Emirates,United Kingdom,Uruguay,Uzbekistan,Vanuatu,Vatican City,Venezuela,Vietnam,Yemen,Zambia,Zimbabwe".split(',');

            const handleConfirmBooking = async () => {
                // 💡 [Cleaned] Standardized alert messages to English
                if (!firstName || !lastName || !guestEmail || !guestPhone || !cardNum) {
                    return setAlertMessage("Please fill in all required details.");
                }
                setIsBooking(true);
                try {
                    const res = await fetch(`${BASE_URL}/api/public/reservations/create`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            hotel_code: hotelCode,
                            room_type: activeRoom.name,
                            check_in_date: checkIn,
                            check_out_date: checkOut,
                            guest_name: `${firstName} ${lastName}`, 
                            email: guestEmail,
                            phone: guestPhone,
                            nationality: nationality,
                            total_price: finalTotal,
                            room_count: roomCount 
                        })
                    });
                    
                    const data = await res.json();
                    if (res.ok || data.success) {
                        setAlertMessage("✅ Booking Confirmed!\nEmail and receipt have been sent.");
                        setShowBookingModal(false);
                        setFirstName(''); setLastName(''); setGuestEmail(''); setGuestPhone('');
                        setCardNum(''); setCardExp(''); setCardCvv(''); setExtraBed(0);
                        setCheckIn(''); setCheckOut('');
                    } else {
                        setAlertMessage("❌ Failed: " + (data.message || "Booking API Error"));
                    }
                } catch (error) {
                    console.error("Booking Error:", error);
                    setAlertMessage("Error connecting to the server.");
                } finally {
                    setIsBooking(false);
                }
            };

            return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 md:p-6 animate-fade-in" onClick={() => !isBooking && setShowBookingModal(false)}>
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    <div className="theme-bg p-5 md:p-6 text-white flex justify-between items-center shrink-0">
                        <h2 className="text-xl md:text-2xl font-black">{t.secureCheckout}</h2>
                        {!isBooking && <button onClick={() => setShowBookingModal(false)} className="text-white/80 hover:text-white text-3xl font-bold">×</button>}
                    </div>
                    <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">
                        <div className="flex-1 p-6 md:p-8 lg:overflow-y-auto space-y-8">
                            <section>
                                <h3 className="text-lg font-black text-slate-800 border-b-2 border-slate-100 pb-2 mb-4">1. {t.guestDetails}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{t.firstName}</label>
                                        <input value={firstName} onChange={e=>setFirstName(e.target.value)} disabled={isBooking} className="w-full p-3 border border-slate-200 rounded-xl theme-focus outline-none" placeholder="John" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{t.lastName}</label>
                                        <input value={lastName} onChange={e=>setLastName(e.target.value)} disabled={isBooking} className="w-full p-3 border border-slate-200 rounded-xl theme-focus outline-none" placeholder="Doe" />
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{t.email}</label>
                                    <input value={guestEmail} onChange={e=>setGuestEmail(e.target.value)} disabled={isBooking} type="email" className="w-full p-3 border border-slate-200 theme-bg-light rounded-xl theme-focus outline-none" placeholder="john@example.com" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{t.phone}</label>
                                        <input value={guestPhone} onChange={e=>setGuestPhone(e.target.value)} disabled={isBooking} type="tel" className="w-full p-3 border border-slate-200 rounded-xl theme-focus outline-none" placeholder="+1 234 567 890" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{t.nationality}</label>
                                        <select value={nationality} onChange={e=>setNationality(e.target.value)} disabled={isBooking} className="w-full p-3 border border-slate-200 rounded-xl theme-focus outline-none bg-white cursor-pointer">
                                            <optgroup label="Top Options">
                                                {topCountries.map(c => <option key={`top_${c}`} value={c}>{c}</option>)}
                                            </optgroup>
                                            <optgroup label="All Countries">
                                                {otherCountries.map(c => <option key={`oth_${c}`} value={c}>{c}</option>)}
                                            </optgroup>
                                        </select>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-lg font-black text-slate-800 border-b-2 border-slate-100 pb-2 mb-4">2. {t.extraOptions}</h3>
                                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                    <div>
                                        <p className="font-bold text-slate-800">{t.extraBed}</p>
                                        <p className="text-xs text-slate-500">₱1,000 / night</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button type="button" disabled={isBooking} onClick={()=>setExtraBed(Math.max(0, extraBed-1))} className="w-8 h-8 rounded-full bg-white border border-slate-300 font-bold hover:bg-slate-100 transition-colors">-</button>
                                        <span className="w-4 text-center font-bold theme-text">{extraBed}</span>
                                        <button type="button" disabled={isBooking} onClick={()=>setExtraBed(extraBed+1)} className="w-8 h-8 rounded-full bg-white border border-slate-300 font-bold hover:bg-slate-100 transition-colors">+</button>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-lg font-black text-slate-800 border-b-2 border-slate-100 pb-2 mb-4">3. {t.paymentMethod}</h3>
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{t.cardNum}</label>
                                        <input value={cardNum} onChange={e=>setCardNum(e.target.value)} disabled={isBooking} className="w-full p-3 border border-slate-200 rounded-xl font-mono text-sm theme-focus outline-none tracking-widest" placeholder="0000 0000 0000 0000" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{t.expiry}</label>
                                            <input value={cardExp} onChange={e=>setCardExp(e.target.value)} disabled={isBooking} className="w-full p-3 border border-slate-200 rounded-xl font-mono text-sm theme-focus outline-none text-center" placeholder="MM/YY" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{t.cvv}</label>
                                            <input value={cardCvv} onChange={e=>setCardCvv(e.target.value)} disabled={isBooking} type="password" maxLength={4} className="w-full p-3 border border-slate-200 rounded-xl font-mono text-sm theme-focus outline-none text-center tracking-widest" placeholder="•••" />
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="w-full lg:w-[350px] theme-bg-light p-6 md:p-8 shrink-0 border-t lg:border-t-0 lg:border-l theme-border flex flex-col h-auto lg:h-full lg:overflow-y-auto">
                            <h3 className="text-xl font-black theme-text mb-6">{t.bookingSummary}</h3>
                            
                            <div className="bg-white rounded-2xl p-4 shadow-sm border theme-border mb-6">
                                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase mb-2">
                                    <span>{t.checkIn}</span>
                                    <span>{t.checkOut}</span>
                                </div>
                                <div className="flex justify-between font-black text-slate-800 text-sm">
                                    <span>{checkIn}</span>
                                    <span>{checkOut}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <p className="font-black theme-text text-lg leading-tight">{activeRoom?.name}</p>
                                    <p className="theme-text text-xs font-bold mt-1 opacity-80">₱{(activeRoom?.price || 0).toLocaleString()} x {nights} {t.night.replace('/','')}</p>
                                    {extraBed > 0 && <p className="theme-text text-xs font-bold mt-1 opacity-80">+ {t.extraBed} (x{extraBed})</p>}
                                </div>
                                <div className="bg-white/50 border theme-border theme-text font-black px-3 py-1 rounded-lg text-sm">
                                    x {roomCount}
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="text-[10px] font-bold theme-text uppercase mb-1 block">{t.promoCode}</label>
                                <div className="flex gap-2">
                                    <input value={promoCode} onChange={e=>setPromoCode(e.target.value)} disabled={isBooking} className="flex-1 p-2.5 border theme-border rounded-xl text-sm outline-none theme-focus" placeholder="E.G. WELCOME10" />
                                    <button type="button" disabled={isBooking} className="theme-bg text-white px-4 rounded-xl font-bold theme-hover transition-colors text-sm">{t.apply}</button>
                                </div>
                            </div>

                            <div className="mt-auto pt-6 border-t theme-border">
                                <div className="flex justify-between items-end mb-6">
                                    <span className="font-black text-slate-800 text-xl">{t.total}</span>
                                    <span className="font-black theme-text text-3xl">₱{finalTotal.toLocaleString()}</span>
                                </div>
                                <button onClick={handleConfirmBooking} disabled={isBooking} className="w-full theme-bg theme-hover text-white py-4 rounded-2xl font-black transition-transform active:scale-95 shadow-xl disabled:opacity-50 flex justify-center items-center gap-2 text-lg">
                                    {isBooking ? <span className="animate-pulse">{t.processing}</span> : <span>{t.confirmBook}</span>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            );
        })()}    

        {/* 💡 전역 알림(Alert) 커스텀 모달창 */}
        {alertMessage && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setAlertMessage('')}>
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center border border-slate-100" onClick={e => e.stopPropagation()}>
                    <div className="bg-blue-600 p-4 text-white flex justify-center items-center">
                        <h3 className="font-black text-lg">Notification</h3>
                    </div>
                    <div className="p-8 text-slate-700 font-bold text-[15px] whitespace-pre-wrap leading-relaxed">
                        {alertMessage}
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                        <button onClick={() => setAlertMessage('')} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-black transition-transform active:scale-95 shadow-md">
                            OK
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* 📱 푸터 (예약 장바구니가 열려있지 않을 때만 표시) */}
        {!hasSearched && (
          <footer className="bg-white/90 backdrop-blur-md border-t border-slate-200 py-8 md:py-10 px-6 mt-auto relative z-10">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="hidden md:block flex-1"></div>
                <div className="flex-1 flex justify-center gap-4">
                    {sns?.ig && <a href={sns.ig.startsWith('http') ? sns.ig : `https://${sns.ig}`} target="_blank" rel="noreferrer" className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-pink-600 hover:bg-pink-600 hover:text-white hover:border-pink-600 transition-all shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16.11 7.99a.01.01 0 0 1 .02 0"/><path d="M15.82 12.18A4 4 0 1 1 11.82 8a4 4 0 0 1 4 4.18"/></svg></a>}
                    {sns?.fb && <a href={sns.fb.startsWith('http') ? sns.fb : `https://${sns.fb}`} target="_blank" rel="noreferrer" className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>}
                </div>
                <div className="flex-1 flex justify-center md:justify-end w-full">
                    <p className="text-xs md:text-sm font-bold text-slate-500 text-center md:text-right">
                        &copy; {new Date().getFullYear()} <span className="theme-text">{safeConfig.footer_company_name || safeConfig.welcome_title || "Our Hotel"}</span>. {t.rights}
                    </p>
                </div>
            </div>
          </footer>
        )}
      </div>
    </>
  );
}