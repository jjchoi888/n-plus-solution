"use client";
import { useState, useEffect } from "react";

const BASE_URL = 'http://136.117.49.111:5000';

const TOP_COUNTRIES = ["Philippines", "South Korea", "China", "United States"];
const ALL_COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

const translations = {
  en: { searchResults: "Search Results", roomsLeft: "ROOM(S) LEFT", night: "/ night", selectRooms: "Select Quantity", cartTotal: "Room(s) Selected", proceedCheckout: "Proceed to Checkout", secureCheckout: "Secure Checkout", guestDetails: "1. Guest Details", paymentMethod: "2. Payment Method", extraOptions: "3. Extra Options", extraBed: "Extra Bed", childFee: "Child Surcharge", promoCode: "Promo Code", apply: "Apply", summary: "Booking Summary", processing: "Processing...", pay: "Pay", andBook: "& Book", success: "Success!", successMsg: "Payment Successful & Booking Confirmed!", error: "Error", failMsg: "Failed to create some bookings", networkError: "Network Error. Please try again.", dateMissing: "Dates are missing.", ok: "OK", roomInfo: "Room", discount: "Discount", size: "sq.m", maxGuests: "Max Guests:" },
  ko: { searchResults: "검색 결과", roomsLeft: "객실 남음", night: "/ 1박", selectRooms: "수량 선택", cartTotal: "개의 객실 선택됨", proceedCheckout: "예약 진행하기", secureCheckout: "안전 결제", guestDetails: "1. 예약자 정보", paymentMethod: "2. 결제 정보", extraOptions: "3. 추가 옵션", extraBed: "엑스트라 베드", childFee: "아동 추가 요금", promoCode: "할인 코드", apply: "적용", summary: "예약 요약", processing: "결제 진행 중...", pay: "", andBook: "결제 및 예약하기", success: "예약 완료!", successMsg: "결제 및 예약이 성공적으로 완료되었습니다!", error: "오류", failMsg: "일부 예약 처리에 실패했습니다", networkError: "네트워크 오류입니다. 다시 시도해 주세요.", dateMissing: "날짜 정보가 누락되었습니다.", ok: "확인", roomInfo: "객실", discount: "할인 금액", size: "sq.m", maxGuests: "최대 인원:" },
  zh: { searchResults: "搜索结果", roomsLeft: "间客房剩余", night: "/ 晚", selectRooms: "选择数量", cartTotal: "间客房已选", proceedCheckout: "去结账", secureCheckout: "安全结账", guestDetails: "1. 客人信息", paymentMethod: "2. 付款方式", extraOptions: "3. 额外选项", extraBed: "加床", childFee: "儿童附加费", promoCode: "优惠码", apply: "应用", summary: "预订摘要", processing: "处理中...", pay: "支付", andBook: "并预订", success: "成功！", successMsg: "付款成功，预订已确认！", error: "错误", failMsg: "部分预订失败", networkError: "网络错误，请重试。", dateMissing: "缺少日期信息。", ok: "确定", roomInfo: "房间", discount: "折扣", size: "平方米", maxGuests: "最多人数:" },
  ja: { searchResults: "検索結果", roomsLeft: "室残り", night: "/ 泊", selectRooms: "数量を選択", cartTotal: "室選択中", proceedCheckout: "チェックアウトへ進む", secureCheckout: "安全な決済", guestDetails: "1. 宿泊者情報", paymentMethod: "2. お支払い方法", extraOptions: "3. 追加オプション", extraBed: "エキストラベッド", childFee: "子供追加料金", promoCode: "プロモコード", apply: "適用", summary: "予約の概要", processing: "処理中...", pay: "支払う", andBook: "＆予約", success: "予約完了！", successMsg: "決済と予約が正常に完了しました！", error: "エラー", failMsg: "一部の予約に失敗しました", networkError: "ネットワークエラーです。もう一度お試しください。", dateMissing: "日付が選択されていません。", ok: "確認", roomInfo: "客室", discount: "割引額", size: "平米", maxGuests: "最大定員:" }
};

const getHotelName = (code) => {
    if (!code || code === 'ALL') return null;
    const mapping = {
        'NPLUS01': '📍 Metro Manila (Premier)',
        'NPLUS02': '📍 Cebu (Resort & Spa)',
        'NPLUS03': '📍 Boracay (Beachfront)',
        'NPLUS04': '📍 Palawan (Eco Lodge)',
        'NPLUS05': '📍 BGC (Boutique)'
    };
    return mapping[code] || `📍 Branch: ${code}`;
};

const RoomImageCarousel = ({ images, name }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  useEffect(() => {
    if (!images || images.length <= 1) return;
    const timer = setInterval(() => setCurrentIndex((prev) => (prev + 1) % images.length), 3000); 
    return () => clearInterval(timer);
  }, [images]);
  if (!images || images.length === 0) return <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm border-b">No Image</div>;
  return <img src={images[currentIndex]} alt={name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" key={currentIndex} />;
};

export default function RoomList({ rooms, searchParams, lang = 'en', hotelCode, checkIn, checkOut, adults, kids }) {
  const t = translations[lang] || translations.en;

  const [fetchedRooms, setFetchedRooms] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [cart, setCart] = useState({});
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  
  const [modal, setModal] = useState({ show: false, title: '', message: '', highlight: '', type: 'warning' });
  const [formData, setFormData] = useState({ firstName: "", lastName: "", nationality: "Philippines", email: "", phone: "", cardNumber: "", expiry: "", cvv: "" });

  const [extraBeds, setExtraBeds] = useState(0);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [fees, setFees] = useState({ child: 500, extraBed: 1000 });

  const effectiveCheckIn = checkIn || searchParams?.checkIn || "";
  const effectiveCheckOut = checkOut || searchParams?.checkOut || "";
  const effectiveAdults = adults || searchParams?.guests?.adults || 2;
  const effectiveKids = kids || searchParams?.guests?.child || 0;
  const effectiveHotelCode = hotelCode || searchParams?.destination || 'ALL';

  useEffect(() => {
    const fetchFees = async () => {
        try {
            const res = await fetch(`${BASE_URL}/api/settings/fees`);
            const data = await res.json();
            if (data.success && data.fees) setFees({ child: data.fees.child_fee, extraBed: data.fees.extra_bed_fee });
        } catch (e) {}
    };
    fetchFees();
  }, []);

  // 💡 [핵심 복구] 무거운 반복 통신을 제거하고, 서버에 딱 한 번만 물어보도록 롤백!
  useEffect(() => {
    if ((!rooms || rooms.length === 0) && effectiveCheckIn && effectiveCheckOut) {
        setIsFetching(true);
        fetch(`${BASE_URL}/api/public/rooms/available?hotel=${effectiveHotelCode}&lang=${lang}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkIn: effectiveCheckIn, checkOut: effectiveCheckOut, hotel_code: effectiveHotelCode })
        })
        .then(async (res) => {
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || "Search Error");
            setFetchedRooms(Array.isArray(data) ? data : []);
        })
        .catch(err => {
            console.error("Room fetch error:", err);
            setFetchedRooms([]);
        })
        .finally(() => setIsFetching(false));
    }
  }, [rooms, effectiveCheckIn, effectiveCheckOut, effectiveHotelCode, lang, refreshKey]);

  const actualRooms = (rooms && rooms.length > 0) ? rooms : fetchedRooms;
  
  let nights = 1;
  if (effectiveCheckIn && effectiveCheckOut) {
    nights = Math.ceil((new Date(effectiveCheckOut) - new Date(effectiveCheckIn)) / (1000 * 60 * 60 * 24));
    if (nights <= 0) nights = 1;
  }

  const updateCart = (roomId, delta, maxCount) => {
    setCart(prev => {
      const newCount = (prev[roomId] || 0) + delta;
      if (newCount < 0 || newCount > maxCount) return prev;
      return { ...prev, [roomId]: newCount };
    });
  };

  const totalRoomsInCart = Object.values(cart).reduce((sum, count) => sum + count, 0);
  const roomBaseTotal = actualRooms.reduce((sum, room) => sum + (cart[room.id] || 0) * (room.price || 0) * nights, 0);
  
  const totalChildFee = effectiveKids * fees.child * nights;
  const totalExtraBedFee = extraBeds * fees.extraBed * nights;
  const subTotal = roomBaseTotal + totalChildFee + totalExtraBedFee;

  let discountAmount = 0;
  if (appliedPromo) {
      if (appliedPromo.type === 'percent') discountAmount = subTotal * (appliedPromo.value / 100);
      else if (appliedPromo.type === 'fixed') discountAmount = appliedPromo.value;
  }
  const grandTotal = Math.max(0, subTotal - discountAmount);

  const handleApplyPromo = async () => {
      if(!promoInput) return;
      setIsApplyingPromo(true);
      try {
          const res = await fetch(`${BASE_URL}/api/public/promo/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: promoInput }) });
          const data = await res.json();
          if(data.success) {
              setAppliedPromo(data.promo);
              setModal({ show: true, type: 'success', title: 'Promo Applied', message: data.promo.desc, highlight: '' });
          } else {
              setAppliedPromo(null);
              setModal({ show: true, type: 'warning', title: 'Invalid Code', message: data.message, highlight: '' });
          }
      } catch (e) { setModal({ show: true, type: 'error', title: 'Error', message: 'Could not verify promo code.', highlight: '' }); } 
      finally { setIsApplyingPromo(false); }
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    if (!effectiveCheckIn || !effectiveCheckOut) return setModal({ show: true, title: t.error, message: t.dateMissing, type: 'error', highlight: '' });

    setIsBooking(true);
    const dividedGrandTotal = grandTotal / totalRoomsInCart;
    let bookingPayloads = [];

    for (const room of actualRooms) {
      const count = cart[room.id] || 0;
      if (count === 0) continue;

      for (let i = 0; i < count; i++) {
        const fullName = `${formData.firstName} ${formData.lastName}`.trim();
        const targetHotelCode = room.hotelCode || effectiveHotelCode;

        bookingPayloads.push({
          room_type: room.name,
          check_in_date: effectiveCheckIn,
          check_out_date: effectiveCheckOut,
          guest_name: totalRoomsInCart > 1 ? `${fullName} (${t.roomInfo} ${bookingPayloads.length + 1})` : fullName,
          nationality: formData.nationality,
          email: formData.email,
          phone: formData.phone,
          total_price: dividedGrandTotal,
          payment_method: "Credit Card",
          hotel_code: targetHotelCode 
        });
      }
    }

    try {
      const response = await fetch(`${BASE_URL}/api/public/reservations/batch-create`, { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ bookings: bookingPayloads }) 
      });
      const data = await response.json();
      
      if (data.success) {
          setModal({ show: true, type: 'success', title: t.success, message: t.successMsg, highlight: data.res_ids.join('\n') });
          setIsCheckoutOpen(false); setCart({}); setExtraBeds(0); setAppliedPromo(null); setPromoInput("");
      } else {
          setModal({ show: true, title: t.error, message: data.message || t.networkError, type: 'error', highlight: '' });
      }
    } catch (error) { 
        setModal({ show: true, title: t.error, message: t.networkError, type: 'error', highlight: '' });
    } finally {
        setIsBooking(false);
    }
  };

  if (isFetching) return <div className="p-20 text-center text-emerald-600 font-bold text-xl animate-pulse">Searching available rooms...</div>;

  return (
    <>
      <div className="w-full max-w-5xl mx-auto mt-8 animate-fade-in-up pb-32 relative">
        <div className="flex justify-between items-end border-b pb-2 mb-6 text-left">
          <div className="flex items-center gap-3">
            <h3 className="text-2xl font-bold text-gray-800">
              {t.searchResults} <span className="text-emerald">({actualRooms.length})</span>
            </h3>
            {/* 💡 [수정 완료] 아이콘 옆에 'search again' 작은 글씨를 추가하고 알약 모양으로 넓혔습니다! */}
            <button
              onClick={() => setRefreshKey(prev => prev + 1)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-emerald-600 rounded-full transition-all active:scale-90 shadow-sm"
              title="Search Again"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-xs font-bold">search again</span>
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {actualRooms.map((room) => {
            const currentCount = cart[room.id] || 0;
            const locationName = getHotelName(room.hotelCode);
            const showLocationBadge = effectiveHotelCode === 'ALL' && locationName;

            return (
              <div key={room.id} className={`bg-white rounded-2xl shadow-lg overflow-hidden border-2 transition-all flex flex-col hover:-translate-y-1 relative ${currentCount > 0 ? 'border-emerald shadow-emerald/20' : 'border-gray-100 hover:shadow-2xl'}`}>
                <div className="h-48 bg-gray-100 w-full relative overflow-hidden">
                  <RoomImageCarousel images={room.images} name={room.name} />
                  
                  {showLocationBadge && (
                     <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg z-10 animate-fade-in">
                        {locationName}
                     </div>
                  )}

                  {currentCount > 0 && (<div className="absolute top-3 right-3 bg-emerald text-white text-xs font-black px-3 py-1.5 rounded-full shadow-lg z-10 animate-fade-in">{currentCount} {lang === 'ko' ? '개 선택됨' : 'Selected'}</div>)}
                </div>
                <div className="p-6 flex flex-col flex-grow text-left">
                  <h4 className="text-xl font-black text-gray-900 mb-3">{room.name}</h4>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                      {(room.size || room.roomConfig?.size) && <span className="bg-gray-50 text-gray-600 px-2 py-1 rounded border border-gray-100 text-[10px] md:text-xs font-bold shadow-sm">📏 {room.size || room.roomConfig?.size} {t.size}</span>}
                      <span className="bg-gray-50 text-gray-600 px-2 py-1 rounded border border-gray-100 text-[10px] md:text-xs font-bold shadow-sm">🛏️ {room.roomConfig?.bedType || 'Standard Bed'}</span>
                      <span className="bg-gray-50 text-gray-600 px-2 py-1 rounded border border-gray-100 text-[10px] md:text-xs font-bold shadow-sm">👥 {t.maxGuests} {room.maxGuests || 2}</span>
                  </div>

                  <p className="text-xs text-gray-500 mb-5 whitespace-pre-wrap leading-relaxed line-clamp-3 hover:line-clamp-none transition-all cursor-pointer" title="Click to expand">
                      {room.roomConfig?.description || room.description || ''}
                  </p>

                  <div className="mb-4"><span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-md text-xs font-black tracking-wider shadow-sm inline-block">🔥 {room.availableCount} {t.roomsLeft}</span></div>
                  <p className="text-emerald font-black text-2xl mt-auto pt-4 border-t border-gray-100">₱{room.price ? room.price.toLocaleString() : "0"} <span className="text-sm font-normal text-gray-500">{t.night}</span></p>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-600">{t.selectRooms}:</span>
                    <div className="flex items-center gap-3 bg-gray-50 rounded-full p-1 border border-gray-200">
                      <button onClick={() => updateCart(room.id, -1, room.availableCount)} disabled={currentCount === 0} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors ${currentCount > 0 ? 'bg-white text-gray-600 shadow-sm border border-gray-300 hover:text-emerald hover:border-emerald' : 'text-gray-300'}`}>-</button>
                      <span className="w-4 text-center font-black text-emerald text-lg">{currentCount}</span>
                      <button onClick={() => updateCart(room.id, 1, room.availableCount)} disabled={currentCount >= room.availableCount} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors ${currentCount < room.availableCount ? 'bg-white text-gray-600 shadow-sm border border-gray-300 hover:text-emerald hover:border-emerald' : 'text-gray-300'}`}>+</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {totalRoomsInCart > 0 && (
          <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[160] animate-fade-in-up rounded-t-3xl">
            <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold text-gray-500">{lang === 'en' ? `${totalRoomsInCart} ${t.cartTotal}` : `${totalRoomsInCart}${t.cartTotal}`}</span>
                <span className="text-2xl font-black text-emerald">₱{grandTotal.toLocaleString()} <span className="text-sm font-medium text-gray-500">/ {nights} {t.night.replace('/', '').trim()}</span></span>
              </div>
              <button onClick={() => setIsCheckoutOpen(true)} className="w-full md:w-auto px-10 py-4 bg-emerald hover:bg-emerald-dark text-white rounded-full font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 text-lg">
                {t.proceedCheckout} →
              </button>
            </div>
          </div>
        )}

        {isCheckoutOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[200] p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden max-h-[90vh] overflow-y-auto text-left">
              <div className="bg-emerald px-6 py-4 flex justify-between items-center text-white sticky top-0 z-10">
                <h2 className="text-xl font-bold">{t.secureCheckout}</h2>
                <button onClick={() => setIsCheckoutOpen(false)} className="text-white hover:text-gray-200 text-3xl font-light">&times;</button>
              </div>
              <form onSubmit={submitBooking} className="p-6 md:p-8 flex flex-col lg:flex-row gap-8">
                
                <div className="flex-1 space-y-6 text-left">
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b pb-2 text-left">{t.guestDetails}</h3>
                    
                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">First Name</label><input type="text" required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none" placeholder="e.g. Alice" /></div>
                      <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Last Name</label><input type="text" required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none" placeholder="e.g. Smith" /></div>
                    </div>

                    <div className="text-left"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label><input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none" /></div>

                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone</label><input type="tel" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none" /></div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nationality</label>
                        <select required value={formData.nationality} onChange={e => setFormData({...formData, nationality: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none bg-white">
                          <option value="">Select Country...</option>
                          {TOP_COUNTRIES.map(c => <option key={`top_${c}`} value={c}>{c}</option>)}
                          <option disabled>──────────</option>
                          {ALL_COUNTRIES.filter(c => !TOP_COUNTRIES.includes(c)).map(c => <option key={`all_${c}`} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b pb-2 pt-2 text-left">{t.extraOptions}</h3>
                    <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                       <div className="text-left">
                           <p className="text-sm font-bold text-gray-800">{t.extraBed}</p>
                           <p className="text-xs text-gray-500">₱{fees.extraBed.toLocaleString()} {t.night}</p>
                       </div>
                       <div className="flex items-center gap-3 bg-white rounded-full border border-gray-300 px-1 py-1 shadow-sm">
                           <button type="button" onClick={() => setExtraBeds(Math.max(0, extraBeds - 1))} className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-gray-600 hover:text-emerald">-</button>
                           <span className="w-4 text-center font-bold text-emerald">{extraBeds}</span>
                           <button type="button" onClick={() => setExtraBeds(extraBeds + 1)} className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-gray-600 hover:text-emerald">+</button>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b pb-2 pt-2 text-left">{t.paymentMethod}</h3>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                      <div className="text-left"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Card Number</label><input type="text" required placeholder="0000 0000 0000 0000" value={formData.cardNumber} onChange={e => setFormData({...formData, cardNumber: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none font-mono" /></div>
                      <div className="grid grid-cols-2 gap-4 text-left">
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Expiry Date</label><input type="text" required placeholder="MM/YY" value={formData.expiry} onChange={e => setFormData({...formData, expiry: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none text-center" /></div>
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">CVV</label><input type="password" required placeholder="123" maxLength="3" value={formData.cvv} onChange={e => setFormData({...formData, cvv: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none text-center tracking-widest" /></div>
                      </div>
                    </div>
                  </div>
                  
                  <button type="submit" disabled={isBooking} className={`mt-8 w-full py-4 text-white font-bold rounded-xl shadow-lg transition-all text-lg ${isBooking ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald hover:bg-emerald-dark hover:shadow-xl hover:-translate-y-1'}`}>
                    {isBooking ? t.processing : `${lang === 'ko' ? '' : t.pay} ₱${grandTotal.toLocaleString()} ${t.andBook}`}
                  </button>
                </div>

                <div className="w-full lg:w-80 bg-emerald-50 rounded-2xl p-6 border border-emerald-100 flex flex-col h-fit sticky top-6 text-left">
                  <h3 className="text-lg font-bold text-emerald-900 mb-4 border-b border-emerald-200 pb-2 text-left">{t.summary}</h3>
                  
                  <div className="space-y-4 text-sm text-emerald-800 flex-grow">
                    <div className="flex justify-between bg-white p-3 rounded-lg shadow-sm border border-emerald-100">
                      <p className="flex flex-col text-left"><span className="text-[10px] uppercase text-emerald-600 font-bold">Check-in</span> <span className="font-bold">{effectiveCheckIn || "-"}</span></p>
                      <p className="flex flex-col text-right"><span className="text-[10px] uppercase text-emerald-600 font-bold">Check-out</span> <span className="font-bold">{effectiveCheckOut || "-"}</span></p>
                    </div>
                    
                    <div className="space-y-3 pt-2">
                      {actualRooms.filter(r => cart[r.id] > 0).map(r => (
                        <div key={r.id} className="flex justify-between items-start pb-1">
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-emerald-900">{r.name}</span>
                            <span className="text-xs text-emerald-600">₱{r.price.toLocaleString()} x {nights} {t.night.replace('/', '').trim()}</span>
                          </div>
                          <span className="font-black bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded text-xs">x {cart[r.id]}</span>
                        </div>
                      ))}
                    </div>

                    {(effectiveKids > 0 || extraBeds > 0) && (
                      <div className="border-t border-emerald-200 pt-3 space-y-2">
                        {effectiveKids > 0 && (
                          <div className="flex justify-between text-xs font-bold text-amber-700 bg-amber-50 p-2 rounded">
                            <span>{t.childFee} (x{effectiveKids})</span>
                            <span>+ ₱{totalChildFee.toLocaleString()}</span>
                          </div>
                        )}
                        {extraBeds > 0 && (
                          <div className="flex justify-between text-xs font-bold text-blue-700 bg-blue-50 p-2 rounded">
                            <span>{t.extraBed} (x{extraBeds})</span>
                            <span>+ ₱{totalExtraBedFee.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="border-t border-emerald-200 pt-4 text-left">
                      <label className="block text-xs font-bold text-emerald-700 uppercase mb-2 text-left">{t.promoCode}</label>
                      <div className="flex gap-2">
                        <input type="text" value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())} placeholder="e.g. WELCOME10" className="flex-1 border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald uppercase" disabled={appliedPromo}/>
                        {!appliedPromo ? (
                          <button type="button" onClick={handleApplyPromo} disabled={isApplyingPromo} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition">{t.apply}</button>
                        ) : (
                          <button type="button" onClick={() => {setAppliedPromo(null); setPromoInput("");}} className="bg-red-50 text-red-500 px-4 py-2 rounded-lg text-sm font-bold border border-red-200 hover:bg-red-100 transition">X</button>
                        )}
                      </div>
                      {appliedPromo && (
                        <div className="mt-3 flex justify-between items-center text-xs font-black text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
                          <span>🎉 {appliedPromo.desc}</span>
                          <span>- ₱{discountAmount.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                  </div>

                  <div className="mt-6 border-t-4 border-emerald-200 pt-4">
                    <p className="flex justify-between items-center text-xl font-black text-emerald-900">
                      <span>Total</span>
                      <span>₱{grandTotal.toLocaleString()}</span>
                    </p>
                  </div>
                </div>

              </form>
            </div>
          </div>
        )}
      </div>

      {modal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[250] p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden text-center transform transition-all scale-100">
            <div className={`p-8 ${modal.type === 'success' ? 'bg-emerald-500' : modal.type === 'warning' ? 'bg-amber-400' : 'bg-red-500'}`}>
                <span className="text-6xl drop-shadow-lg">{modal.type === 'success' ? '✅' : modal.type === 'warning' ? '⚠️' : '❌'}</span>
            </div>
            <div className="p-8 text-center">
              <h3 className="text-xl font-black text-gray-800 mb-3">{modal.title}</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed whitespace-pre-wrap">{modal.message}</p>
              
              {modal.highlight && (
                 <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 mb-8 shadow-inner">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Your Reservation ID</p>
                    {modal.highlight.split('\n').map(id => (
                        <p key={id} className="text-3xl font-mono font-black text-emerald-900 tracking-widest">{id}</p>
                    ))}
                 </div>
              )}

              <button onClick={() => setModal({ show: false, title: '', message: '', highlight: '', type: 'warning' })} className={`w-full text-white font-bold py-3.5 rounded-xl shadow-md transition-colors text-lg ${modal.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : modal.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-600 hover:bg-red-700'}`}>
                {t.ok}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}