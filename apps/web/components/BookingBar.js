"use client";
import { useState, useRef, useEffect } from "react";

const translations = {
  en: { destination: "Destination", whereTo: "Where are you going?", mapTitle: "Select Region & Hotel", allHotels: "All Philippines", checkIn: "Check-In", checkOut: "Check-Out", guestsRooms: "Guests & Rooms", guests: "Guests", room: "Room", adult: "Adults", child: "Children", infant: "Infants", free: "Free", search: "Search", searching: "Searching...", error: "Notice", selectDates: "Please select both check-in and check-out dates.", fetchError: "Failed to fetch rooms. Please try again.", fullyBooked: "Fully Booked!", noRooms: "There are no rooms available for the selected dates.\nPlease try changing your check-in or check-out schedule.", ok: "OK", okChange: "Change Dates", proceed: "Proceed anyway", viewOnMap: "View on Map", selectHotel: "Select Hotel", searchResults: "Search Results", roomsLeft: "ROOM(S) LEFT", night: "/ night", selectRooms: "Select Quantity", cartTotal: "Room(s) Selected", proceedCheckout: "Proceed to Checkout", secureCheckout: "Secure Checkout", guestDetails: "1. Guest Details", paymentMethod: "2. Payment Method", extraOptions: "3. Extra Options", extraBed: "Extra Bed", childFee: "Child Surcharge", promoCode: "Promo Code", apply: "Apply", summary: "Booking Summary", processing: "Processing...", pay: "Pay", andBook: "& Book", success: "Success!", successMsg: "Payment Successful & Booking Confirmed!", failMsg: "Failed to create some bookings", networkError: "Network Error. Please try again.", dateMissing: "Dates are missing.", roomInfo: "Room", discount: "Discount", size: "sq.m", maxGuests: "Max Guests:" },
  ko: { destination: "목적지", whereTo: "어디로 떠나시나요?", mapTitle: "지역 및 호텔 선택", allHotels: "필리핀 전체", checkIn: "체크인", checkOut: "체크아웃", guestsRooms: "인원 및 객실", guests: "명", room: "객실", adult: "성인", child: "어린이", infant: "유아", free: "무료", search: "검색하기", searching: "검색 중...", error: "알림", selectDates: "체크인과 체크아웃 날짜를 모두 선택해 주세요.", fetchError: "객실 정보를 불러오지 못했습니다. 다시 시도해 주세요.", fullyBooked: "예약 마감!", noRooms: "선택하신 날짜에 예약 가능한 객실이 없습니다.\n일정을 변경해 주세요.", ok: "확인", okChange: "일정 변경하기", proceed: "남은 방으로 진행", viewOnMap: "지도에서 보기", selectHotel: "이 호텔 선택하기", searchResults: "검색 결과", roomsLeft: "객실 남음", night: "/ 1박", selectRooms: "수량 선택", cartTotal: "개의 객실 선택됨", proceedCheckout: "예약 진행하기", secureCheckout: "안전 결제", guestDetails: "1. 예약자 정보", paymentMethod: "2. 결제 정보", extraOptions: "3. 추가 옵션", extraBed: "엑스트라 베드", childFee: "아동 추가 요금", promoCode: "할인 코드", apply: "적용", summary: "예약 요약", processing: "결제 진행 중...", pay: "", andBook: "결제 및 예약하기", success: "예약 완료!", successMsg: "결제 및 예약이 성공적으로 완료되었습니다!", failMsg: "일부 예약 처리에 실패했습니다", networkError: "네트워크 오류입니다. 다시 시도해 주세요.", dateMissing: "날짜 정보가 누락되었습니다.", roomInfo: "객실", discount: "할인 금액", size: "sq.m", maxGuests: "최대 인원:" },
  zh: { destination: "目的地", whereTo: "去哪里？", mapTitle: "选择地区与酒店", allHotels: "全菲律宾", checkIn: "入住", checkOut: "退房", guestsRooms: "人数与客房", guests: "人", room: "客房", adult: "成人", child: "儿童", infant: "婴儿", free: "免费", search: "搜索", searching: "搜索中...", error: "提示", selectDates: "请选择入住和退房日期。", fetchError: "获取客房信息失败，请重试。", fullyBooked: "已满房！", noRooms: "所选日期没有可用客房。\n请尝试更改日期。", ok: "确定", okChange: "更改日期", proceed: "继续", viewOnMap: "在地图上查看", selectHotel: "选择此酒店", searchResults: "搜索结果", roomsLeft: "间客房剩余", night: "/ 晚", selectRooms: "选择数量", cartTotal: "间客房已选", proceedCheckout: "去结账", secureCheckout: "安全结账", guestDetails: "1. 客人信息", paymentMethod: "2. 付款方式", extraOptions: "3. 额外选项", extraBed: "加床", childFee: "儿童附加费", promoCode: "优惠码", apply: "应用", summary: "预订摘要", processing: "处理中...", pay: "支付", andBook: "并预订", success: "成功！", successMsg: "付款成功，预订已确认！", failMsg: "部分预订失败", networkError: "网络错误，请重试。", dateMissing: "缺少日期信息。", roomInfo: "房间", discount: "折扣", size: "平方米", maxGuests: "最多人数:" },
  ja: { destination: "目的地", whereTo: "どこへ行きますか？", mapTitle: "地域とホテルの選択", allHotels: "フィリピン全土", checkIn: "チェックイン", checkOut: "チェックアウト", guestsRooms: "人数と客室", guests: "名", room: "客室", adult: "大人", child: "子供", infant: "幼児", free: "無料", search: "検索する", searching: "検索中...", error: "通知", selectDates: "チェックインとチェックアウトの日付を選択してください。", fetchError: "客室情報の取得に失敗しました。もう一度お試しください。", fullyBooked: "満室！", noRooms: "選択した日付に利用可能な客室がありません。\n日付を変更してみてください。", ok: "確認", okChange: "日付を変更", proceed: "続行する", viewOnMap: "地図で見る", selectHotel: "このホテルを選択", searchResults: "検索結果", roomsLeft: "室残り", night: "/ 泊", selectRooms: "数量を選択", cartTotal: "室選択中", proceedCheckout: "チェックアウトへ進む", secureCheckout: "安全な決済", guestDetails: "1. 宿泊者情報", paymentMethod: "2. お支払い方法", extraOptions: "3. 追加オプション", extraBed: "エキストラベッド", childFee: "子供追加料金", promoCode: "プロモコード", apply: "適用", summary: "予約の概要", processing: "処理中...", pay: "支払う", andBook: "＆予約", success: "予約完了！", successMsg: "決済と予約が正常に完了しました！", failMsg: "一部の予約に失敗しました", networkError: "ネットワークエラーです。もう一度お試しください。", dateMissing: "日付が選択されていません。", roomInfo: "客室", discount: "割引額", size: "平米", maxGuests: "最大定員:" }
};

const BASE_URL = '';

const TOP_COUNTRIES = ["Philippines", "South Korea", "China", "United States"];
const ALL_COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

const getHotelDate = (offsetDays = 0) => {
  const now = new Date();
  if (now.getHours() < 12) now.setDate(now.getDate() - 1);
  now.setDate(now.getDate() + offsetDays);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

export default function BookingBar({ lang = 'en', onSearchResults, hotels = [], preselectedHotelCode = null, source = 'Portal' }) {
  const t = translations[lang] || translations.en;

  const [destination, setDestination] = useState({ code: "ALL", name: t.allHotels });
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [counts, setCounts] = useState({ adult: 2, child: 0, infant: 0, room: 1 });
  const [isGuestOpen, setIsGuestOpen] = useState(false);
  const guestRef = useRef(null);

  const [isMapOpen, setIsMapOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [mapQuery, setMapQuery] = useState("Philippines");
  const [activeMapHotel, setActiveMapHotel] = useState(null);

  const [fetchedRooms, setFetchedRooms] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [cart, setCart] = useState({});
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  const [modal, setModal] = useState({ show: false, title: '', message: '', highlight: '', type: 'warning' });

  // 💡 [대리 예약 기능] 체크인 주체 선택 상태
  const [checkinType, setCheckinType] = useState('self'); // 'self' or 'guest'

  const [formData, setFormData] = useState({
    firstName: "", lastName: "", nationality: "Philippines", email: "", phone: "",
    cardNumber: "", expiry: "", cvv: "",
    // 💡 [대리 예약 기능] 지인(투숙객) 정보 필드 추가
    guestFirstName: "", guestLastName: "", guestEmail: "", guestPhone: ""
  });

  const [extraBeds, setExtraBeds] = useState(0);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [fees, setFees] = useState({ child: 500, extraBed: 1000 });

  const effectiveCheckIn = checkIn || "";
  const effectiveCheckOut = checkOut || "";
  const effectiveHotelCode = destination.code || 'ALL';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (guestRef.current && !guestRef.current.contains(event.target)) setIsGuestOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (preselectedHotelCode && hotels.length > 0) {
      const targetHotel = hotels.find(h => h.code === preselectedHotelCode);
      if (targetHotel) {
        setDestination({ code: targetHotel.code, name: targetHotel.name });
      }
    }
  }, [preselectedHotelCode, hotels]);

  useEffect(() => {
    const fetchFees = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/settings/fees`);
        const data = await res.json();
        if (data.success && data.fees) setFees({ child: data.fees.child_fee, extraBed: data.fees.extra_bed_fee });
      } catch (e) { }
    };
    fetchFees();
  }, []);

  // 검색 시 무조건 통신 (rooms prop 제거 및 자체 처리)
  useEffect(() => {
    if (effectiveCheckIn && effectiveCheckOut && isFetching) {
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
  }, [effectiveCheckIn, effectiveCheckOut, effectiveHotelCode, lang, refreshKey, isFetching]);

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

  const handleRegionChange = (e) => {
    const val = e.target.value;
    setSelectedRegion(val);
    setSelectedCity("");
    setActiveMapHotel(null);
    setMapQuery(val ? `${val}, Philippines` : "Philippines");
  };

  const handleCityChange = (e) => {
    const val = e.target.value;
    setSelectedCity(val);
    setActiveMapHotel(null);
    setMapQuery(val ? `${val}, ${selectedRegion}, Philippines` : `${selectedRegion}, Philippines`);
  };

  const handleHotelFocus = (hotel) => {
    setActiveMapHotel(hotel);
    setMapQuery(hotel.address);
  };

  const handleSelectHotel = (code, name) => {
    setDestination({ code, name });
    setIsMapOpen(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!checkIn || !checkOut) {
      setModal({ show: true, title: t.error, message: t.selectDates, type: 'error' });
      return;
    }
    // API 강제 재호출 트리거
    setIsFetching(true);
    setRefreshKey(prev => prev + 1);
    if (onSearchResults) {
      onSearchResults({ checkIn, checkOut, adults: counts.adult, kids: counts.child, destination: destination.code });
    }
  };

  const availableCities = selectedRegion ? PH_LOCATIONS.find(r => r.region === selectedRegion)?.cities || [] : [];
  let filteredHotels = [];
  if (selectedCity) {
    filteredHotels = availableCities.find(c => c.name === selectedCity)?.hotels || [];
  } else if (selectedRegion) {
    availableCities.forEach(c => { filteredHotels = [...filteredHotels, ...c.hotels]; });
  } else {
    PH_LOCATIONS.forEach(r => { r.cities.forEach(c => { filteredHotels = [...filteredHotels, ...c.hotels]; }); });
  }

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
  const roomBaseTotal = fetchedRooms.reduce((sum, room) => sum + (cart[room.id] || 0) * (room.price || 0) * nights, 0);

  const totalChildFee = counts.child * fees.child * nights;
  const totalExtraBedFee = extraBeds * fees.extraBed * nights;
  const subTotal = roomBaseTotal + totalChildFee + totalExtraBedFee;

  let discountAmount = 0;
  if (appliedPromo) {
    if (appliedPromo.type === 'percent') discountAmount = subTotal * (appliedPromo.value / 100);
    else if (appliedPromo.type === 'fixed') discountAmount = appliedPromo.value;
  }
  const grandTotal = Math.max(0, subTotal - discountAmount);

  const handleApplyPromo = async () => {
    if (!promoInput) return;
    setIsApplyingPromo(true);
    try {
      const res = await fetch(`${BASE_URL}/api/public/promo/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: promoInput }) });
      const data = await res.json();
      if (data.success) {
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

    // 💡 [대리 예약] 지인 예약일 경우 지인 이름 필수
    if (checkinType === 'guest' && (!formData.guestFirstName || !formData.guestLastName)) {
      return setModal({ show: true, title: t.error, message: "Please fill in the Guest's First and Last Name.", type: 'warning', highlight: '' });
    }

    setIsBooking(true);
    const dividedGrandTotal = grandTotal / totalRoomsInCart;
    let bookingPayloads = [];

    // 예약자(돈 내는 사람) 본인 이름
    const payerName = `${formData.firstName} ${formData.lastName}`.trim();

    for (const room of fetchedRooms) {
      const count = cart[room.id] || 0;
      if (count === 0) continue;

      for (let i = 0; i < count; i++) {
        const targetHotelCode = room.hotelCode || effectiveHotelCode;

        // 💡 [핵심] 결제 페이로드 구성 (우리가 백엔드에 추가했던 파라미터 싹 다 넘김!)
        bookingPayloads.push({
          room_type: room.name,
          check_in_date: effectiveCheckIn,
          check_out_date: effectiveCheckOut,
          guest_name: totalRoomsInCart > 1 ? `${payerName} (${t.roomInfo} ${bookingPayloads.length + 1})` : payerName,
          nationality: formData.nationality,
          email: formData.email,
          phone: formData.phone,
          total_price: dividedGrandTotal,
          payment_method: "Credit Card",
          hotel_code: targetHotelCode,
          channel: source,
          // 💡 [대리 예약] 백엔드로 추가 데이터 전송
          checkin_type: checkinType,
          guest_first_name: formData.guestFirstName,
          guest_last_name: formData.guestLastName,
          guest_email: formData.guestEmail,
          guest_phone: formData.guestPhone
        });
      }
    }

    try {
      // 먼저 예약을 생성하고, 생성된 예약 ID들을 받습니다.
      const response = await fetch(`${BASE_URL}/api/public/reservations/batch-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookings: bookingPayloads })
      });
      const data = await response.json();

      if (data.success) {
        // 💡 [핵심] 예약 생성 성공 후, 결제 프로세스(이메일 발송 포함)로 바로 꽂아 넣습니다!
        // Guest App의 로직을 여기에 그대로 이식했습니다.
        const processPayload = {
          res_ids: data.res_ids,
          hotel_code: effectiveHotelCode === 'ALL' ? (fetchedRooms[0]?.hotelCode || 'HQ') : effectiveHotelCode,
          amount: grandTotal,
          points_used: 0, // 기본 웹 예약에서는 포인트 미사용
          method: 'card',
          email: formData.email, // 예약자 메일
          checkin_type: checkinType,
          guest_first_name: formData.guestFirstName,
          guest_last_name: formData.guestLastName,
          guest_email: formData.guestEmail,
          guest_phone: formData.guestPhone
        };

        await fetch(`${BASE_URL}/api/public/payment/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(processPayload)
        });

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

  return (
    <>
      <div className="mt-4 w-full max-w-6xl bg-white rounded-full shadow-lg p-3 border border-gray-100 relative z-40 animate-fade-in-up mx-auto">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center justify-between gap-2">

          <div id="destination-trigger" onClick={() => setIsMapOpen(true)} className="flex flex-col px-6 py-2 border-b md:border-b-0 md:border-r border-gray-200 w-full md:w-[25%] cursor-pointer group">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 group-hover:text-emerald-600 transition-colors">{t.destination}</label>
            <div className="text-gray-800 font-bold text-base truncate">{destination.name}</div>
          </div>

          <div className="flex flex-col px-6 py-2 border-b md:border-b-0 md:border-r border-gray-200 w-full md:w-[22%]">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.checkIn}</label>
            <input type="date" className="w-full text-gray-800 font-bold focus:outline-none bg-transparent cursor-pointer" required value={checkIn} min={getHotelDate(0)} onChange={handleCheckInChange} />
          </div>

          <div className="flex flex-col px-6 py-2 border-b md:border-b-0 md:border-r border-gray-200 w-full md:w-[22%]">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.checkOut}</label>
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
            <button type="submit" disabled={isFetching} className={`w-full md:w-auto px-10 py-3.5 rounded-full font-black shadow-md transition-all whitespace-nowrap text-white ${isFetching ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg active:scale-95'}`}>
              {isFetching ? t.searching : t.search}
            </button>
          </div>

        </form>
      </div>

      {isMapOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsMapOpen(false)}>
          <div className="bg-slate-50 w-full max-w-6xl h-[85vh] rounded-[2rem] overflow-hidden flex flex-col md:flex-row shadow-2xl relative" onClick={e => e.stopPropagation()}>

            <button onClick={() => setIsMapOpen(false)} className="absolute top-4 right-4 z-50 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-800 font-bold text-xl">
              ✕
            </button>

            <div className="w-full md:w-1/3 bg-white border-r border-slate-200 flex flex-col h-full shadow-lg z-10">

              <div className="p-6 pb-4 border-b border-slate-100">
                <h2 className="text-2xl font-black text-slate-900 mb-4">{t.mapTitle}</h2>

                <button onClick={() => handleSelectHotel('ALL', t.allHotels)} className="w-full py-3.5 mb-5 rounded-xl bg-slate-900 text-white font-black hover:bg-slate-800 transition-colors shadow-md flex items-center justify-center gap-2">
                  🌍 Search All Regions
                </button>

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

            <div className="w-full md:w-2/3 h-[50vh] md:h-full relative bg-slate-200 flex items-center justify-center overflow-hidden">
              <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-md font-bold text-sm text-slate-700 border border-slate-200 flex items-center gap-2 pointer-events-none">
                <span className="animate-pulse text-red-500">🔴</span> Live Google Maps
              </div>

              <iframe
                title="Google Maps Location"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=m&z=14&output=embed`}
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

      {/* 결과 목록 렌더링 영역 (RoomList) */}
      {(effectiveCheckIn && effectiveCheckOut && !isFetching && fetchedRooms.length > 0) && (
        <div className="w-full max-w-5xl mx-auto mt-8 animate-fade-in-up pb-32 relative text-left">
          <div className="flex justify-between items-end border-b pb-2 mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-bold text-gray-800">
                {t.searchResults} <span className="text-emerald">({fetchedRooms.length})</span>
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {fetchedRooms.map((room) => {
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

                    {currentCount > 0 && (<div className="absolute top-3 right-3 bg-emerald text-white text-xs font-black px-3 py-1.5 rounded-full shadow-lg z-10 animate-fade-in">{currentCount} Selected</div>)}
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
        </div>
      )}

      {/* 결제 모달창 */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[200] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden max-h-[90vh] overflow-y-auto text-left">
            <div className="bg-emerald px-6 py-4 flex justify-between items-center text-white sticky top-0 z-10">
              <h2 className="text-xl font-bold">{t.secureCheckout}</h2>
              <button onClick={() => setIsCheckoutOpen(false)} className="text-white hover:text-gray-200 text-3xl font-light">×</button>
            </div>
            <form onSubmit={submitBooking} className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

              <div className="lg:col-span-8 space-y-6 text-left order-1">

                {/* 💡 [대리 예약 기능] 체크인 주체 선택 (본인/지인) */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-800 border-b pb-2 text-left">Who is checking in?</h3>
                  <div className="flex gap-4">
                    <label className={`flex-1 border-2 p-4 rounded-xl cursor-pointer transition-colors flex items-center gap-3 ${checkinType === 'self' ? 'border-emerald bg-emerald-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                      <input type="radio" name="checkin_type" value="self" checked={checkinType === 'self'} onChange={() => setCheckinType('self')} className="w-5 h-5 accent-emerald" />
                      <div>
                        <span className="font-bold text-gray-800 block">I am checking in</span>
                        <span className="text-xs text-gray-500">Book for myself</span>
                      </div>
                    </label>
                    <label className={`flex-1 border-2 p-4 rounded-xl cursor-pointer transition-colors flex items-center gap-3 ${checkinType === 'guest' ? 'border-emerald bg-emerald-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                      <input type="radio" name="checkin_type" value="guest" checked={checkinType === 'guest'} onChange={() => setCheckinType('guest')} className="w-5 h-5 accent-emerald" />
                      <div>
                        <span className="font-bold text-gray-800 block">Booking for someone else</span>
                        <span className="text-xs text-gray-500">I am paying for a guest</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 결제자(본인) 정보 입력란 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-800 border-b pb-2 text-left">{checkinType === 'guest' ? 'Your Details (Payer)' : t.guestDetails}</h3>
                  <div className="grid grid-cols-2 gap-4 text-left">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">First Name</label><input type="text" required value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none" placeholder="e.g. Alice" /></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Last Name</label><input type="text" required value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none" placeholder="e.g. Smith" /></div>
                  </div>
                  <div className="text-left"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label><input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none" /></div>
                  <div className="grid grid-cols-2 gap-4 text-left">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone</label><input type="tel" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none" /></div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nationality</label>
                      <select required value={formData.nationality} onChange={e => setFormData({ ...formData, nationality: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none bg-white">
                        <option value="">Select Country...</option>
                        {TOP_COUNTRIES.map(c => <option key={`top_${c}`} value={c}>{c}</option>)}
                        <option disabled>──────────</option>
                        {ALL_COUNTRIES.filter(c => !TOP_COUNTRIES.includes(c)).map(c => <option key={`all_${c}`} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 💡 [대리 예약 기능] 지인 정보 폼 (guest를 선택했을 때만 나타남!) */}
                {checkinType === 'guest' && (
                  <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-200 animate-fade-in">
                    <h3 className="text-lg font-bold text-gray-800 border-b pb-2 text-left">Guest Details (Checking-in)</h3>
                    <p className="text-xs text-gray-500">The booking confirmation will also be sent to this email.</p>
                    <div className="grid grid-cols-2 gap-4 text-left mt-3">
                      <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">First Name <span className="text-red-500">*</span></label><input type="text" required value={formData.guestFirstName} onChange={e => setFormData({ ...formData, guestFirstName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none" placeholder="Guest First Name" /></div>
                      <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Last Name <span className="text-red-500">*</span></label><input type="text" required value={formData.guestLastName} onChange={e => setFormData({ ...formData, guestLastName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none" placeholder="Guest Last Name" /></div>
                    </div>
                    <div className="text-left"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Guest Email (Optional)</label><input type="email" value={formData.guestEmail} onChange={e => setFormData({ ...formData, guestEmail: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none" placeholder="Will send CC receipt here" /></div>
                    <div className="text-left"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Guest Phone (Optional)</label><input type="tel" value={formData.guestPhone} onChange={e => setFormData({ ...formData, guestPhone: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none" placeholder="Guest Contact No." /></div>
                  </div>
                )}

                {/* Extra Options */}
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

                {/* Payment Method */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 border-b pb-2 pt-2 text-left">{t.paymentMethod}</h3>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                    <div className="text-left"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Card Number</label><input type="text" required placeholder="0000 0000 0000 0000" value={formData.cardNumber} onChange={e => setFormData({ ...formData, cardNumber: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none font-mono" /></div>
                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Expiry Date</label><input type="text" required placeholder="MM/YY" value={formData.expiry} onChange={e => setFormData({ ...formData, expiry: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none text-center" /></div>
                      <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">CVV</label><input type="password" required placeholder="123" maxLength="3" value={formData.cvv} onChange={e => setFormData({ ...formData, cvv: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald outline-none text-center tracking-widest" /></div>
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={isBooking} className={`mt-8 w-full py-4 text-white font-bold rounded-xl shadow-lg transition-all text-lg ${isBooking ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald hover:bg-emerald-dark hover:shadow-xl hover:-translate-y-1'}`}>
                  {isBooking ? t.processing : `${lang === 'ko' ? '' : t.pay} ₱${grandTotal.toLocaleString()} ${t.andBook}`}
                </button>
              </div>

              {/* Booking Summary (PC에서는 우측 고정) */}
              <div className="lg:col-span-4 lg:row-span-2 w-full bg-emerald-50 rounded-2xl p-6 border border-emerald-100 flex flex-col h-fit sticky top-6 text-left order-2">
                <h3 className="text-lg font-bold text-emerald-900 mb-4 border-b border-emerald-200 pb-2 text-left">{t.summary}</h3>

                <div className="space-y-4 text-sm text-emerald-800 flex-grow">
                  <div className="flex justify-between bg-white p-3 rounded-lg shadow-sm border border-emerald-100">
                    <p className="flex flex-col text-left"><span className="text-[10px] uppercase text-emerald-600 font-bold">Check-in</span> <span className="font-bold">{effectiveCheckIn || "-"}</span></p>
                    <p className="flex flex-col text-right"><span className="text-[10px] uppercase text-emerald-600 font-bold">Check-out</span> <span className="font-bold">{effectiveCheckOut || "-"}</span></p>
                  </div>

                  <div className="space-y-3 pt-2">
                    {fetchedRooms.filter(r => cart[r.id] > 0).map(r => (
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
                      <input type="text" value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())} placeholder="e.g. WELCOME10" className="flex-1 border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald uppercase" disabled={appliedPromo} />
                      {!appliedPromo ? (
                        <button type="button" onClick={handleApplyPromo} disabled={isApplyingPromo} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition">{t.apply}</button>
                      ) : (
                        <button type="button" onClick={() => { setAppliedPromo(null); setPromoInput(""); }} className="bg-red-50 text-red-500 px-4 py-2 rounded-lg text-sm font-bold border border-red-200 hover:bg-red-100 transition">X</button>
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

      {modal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[300] p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center transform transition-all scale-100">
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