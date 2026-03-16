"use client";
import { useState } from "react";

// 💡 다국어 번역 사전
const translations = {
  en: { findBooking: "Find Booking", resId: "Reservation ID", email: "Email", search: "Search", close: "Close", status: "Status", checkIn: "Check-in", checkOut: "Check-out", room: "Room Type", notFound: "No matching reservation found.", enterDetails: "Please enter your Reservation ID OR Email.", searching: "Searching...", guest: "Guest Name", menuPms: "Cloud PMS Solutions", menuLogin: "Partner Login", menuContact: "Contact Sales" },
  ko: { findBooking: "예약 조회", resId: "예약 번호", email: "이메일", search: "조회하기", close: "닫기", status: "상태", checkIn: "체크인", checkOut: "체크아웃", room: "객실 타입", notFound: "일치하는 예약 내역이 없습니다.", enterDetails: "예약 번호 또는 이메일을 입력해 주세요.", searching: "조회 중...", guest: "예약자명", menuPms: "클라우드 PMS 솔루션", menuLogin: "파트너 로그인", menuContact: "도입 문의" },
  ja: { findBooking: "予約照会", resId: "予約番号", email: "メールアドレス", search: "検索", close: "閉じる", status: "状態", checkIn: "チェックイン", checkOut: "チェックアウト", room: "客室タイプ", notFound: "一致する予約が見つかりません。", enterDetails: "予約情報を入力してください。", searching: "検索中...", guest: "予約者名", menuPms: "クラウド PMS ソリューション", menuLogin: "パートナーログイン", menuContact: "お問い合わせ" },
  zh: { findBooking: "查找预订", resId: "预订编号", email: "电子邮箱", search: "搜索", close: "关闭", status: "状态", checkIn: "入住", checkOut: "退房", room: "客房类型", notFound: "未找到匹配的预订。", enterDetails: "请输入您的预订信息。", searching: "搜索中...", guest: "预订人", menuPms: "云端 PMS 解决方案", menuLogin: "合作伙伴登录", menuContact: "联系销售" }
};

const BASE_URL = 'https://hotel-pms-backend-production.up.railway.app';

export default function Navbar({ currentLang, setLang, onMenuClick }) {
  const t = translations[currentLang] || translations.en;
  
  const [isOpen, setIsOpen] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [lookupData, setLookupData] = useState({ res_id: "", email: "" });
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);

  const languages = [
    { code: "ko", label: "한국어" },
    { code: "en", label: "English" },
    { code: "zh", label: "简体中文" },
    { code: "ja", label: "日本語" },
  ];

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!lookupData.res_id.trim() && !lookupData.email.trim()) {
        setLookupError(t.enterDetails);
        return;
    }

    setIsLookingUp(true);
    setLookupError("");
    setLookupResult(null);

    try {
      const response = await fetch(`${BASE_URL}/api/public/reservations/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lookupData)
      });
      const data = await response.json();

      if (data.success) {
        setLookupResult(data.reservation);
      } else {
        setLookupError(t.notFound);
      }
    } catch (error) {
      setLookupError("Network Error.");
    } finally {
      setIsLookingUp(false);
    }
  };

  const closeLookupModal = () => {
    setIsLookupOpen(false);
    setLookupResult(null);
    setLookupError("");
    setLookupData({ res_id: "", email: "" });
  };

  return (
    <>
      <nav className="w-full flex justify-between items-center px-6 md:px-8 py-4 md:py-6 bg-white border-b border-gray-100 shadow-sm fixed top-0 z-50">
        <div onClick={() => onMenuClick && onMenuClick('HOME')} className="text-2xl font-black text-emerald-600 tracking-tighter cursor-pointer">
          n+
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-1 md:gap-2 border-2 border-emerald-600 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-emerald-600 font-bold hover:bg-emerald-600 hover:text-white transition-colors text-xs md:text-sm"
            >
              {languages.find((l) => l.code === currentLang)?.label} ▼
            </button>

            {isOpen && (
              <div className="absolute right-0 mt-2 w-32 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden flex flex-col z-[60]">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLang(l.code);
                      setIsOpen(false);
                    }}
                    className="px-4 py-3 text-left hover:bg-emerald-50 hover:text-emerald-600 transition-colors text-sm font-medium text-gray-700"
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-2xl md:text-3xl text-emerald-600 hover:text-emerald-800 transition-colors focus:outline-none p-1 ml-1"
          >
            {isMobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* 💡 [수정] 텍스트 오른쪽 정렬(text-right) 적용 */}
        <div className={`absolute top-full left-0 w-full bg-white shadow-2xl border-t border-slate-100 flex flex-col overflow-hidden transition-all duration-300 ${isMobileMenuOpen ? 'max-h-[400px] py-2' : 'max-h-0 py-0'}`}>
            <button onClick={() => { setIsMobileMenuOpen(false); setIsLookupOpen(true); }} className="px-8 py-4 text-right font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 border-b border-slate-50 transition-colors tracking-wide">
                {t.findBooking}
            </button>
            <button onClick={() => { setIsMobileMenuOpen(false); onMenuClick && onMenuClick('PMS'); }} className="px-8 py-4 text-right font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 border-b border-slate-50 transition-colors tracking-wide">
                {t.menuPms}
            </button>
            <button onClick={() => { setIsMobileMenuOpen(false); onMenuClick && onMenuClick('LOGIN'); }} className="px-8 py-4 text-right font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 border-b border-slate-50 transition-colors tracking-wide">
                {t.menuLogin}
            </button>
            <button onClick={() => { setIsMobileMenuOpen(false); onMenuClick && onMenuClick('CONTACT'); }} className="px-8 py-4 text-right font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors tracking-wide">
                {t.menuContact}
            </button>
        </div>
      </nav>

      {/* 예약 조회 팝업 모달창 */}
      {isLookupOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="bg-emerald-600 px-6 py-5 flex justify-between items-center text-white">
              <h2 className="text-xl font-bold">{t.findBooking}</h2>
              <button onClick={closeLookupModal} className="text-white hover:text-gray-200 text-3xl font-light leading-none">&times;</button>
            </div>
            
            <div className="p-8">
              {!lookupResult ? (
                <form onSubmit={handleLookup} className="space-y-5">
                  <p className="text-sm text-gray-500 mb-2">{t.enterDetails}</p>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.resId}</label>
                    <input type="text" placeholder="WEBXXXXXX" value={lookupData.res_id} onChange={e => setLookupData({...lookupData, res_id: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none font-mono" />
                  </div>
                  <div className="flex items-center justify-center"><span className="text-xs font-black text-gray-400 bg-gray-100 px-3 rounded-full">OR</span></div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.email}</label>
                    <input type="email" placeholder="email@example.com" value={lookupData.email} onChange={e => setLookupData({...lookupData, email: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  
                  {lookupError && <p className="text-sm text-red-500 font-bold bg-red-50 p-3 rounded-lg">{lookupError}</p>}

                  <button type="submit" disabled={isLookingUp} className={`w-full py-3.5 text-white font-bold rounded-xl shadow-md transition-all text-lg mt-4 ${isLookingUp ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                    {isLookingUp ? t.searching : t.search}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col items-center mb-6">
                    <span className="text-xs uppercase text-emerald-600 font-bold mb-1">{t.resId}</span>
                    <span className="text-2xl font-black text-emerald-900 font-mono tracking-widest">{lookupResult.res_id}</span>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-bold">{t.guest}</span><span className="font-bold text-gray-800">{lookupResult.guest_name}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-bold">{t.status}</span><span className={`font-black px-2 py-0.5 rounded text-xs ${lookupResult.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{lookupResult.status}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-bold">{t.room}</span><span className="font-bold text-gray-800">{lookupResult.room_type}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-bold">{t.checkIn}</span><span className="font-bold text-gray-800">{lookupResult.check_in_date}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-bold">{t.checkOut}</span><span className="font-bold text-gray-800">{lookupResult.check_out_date}</span></div>
                  </div>

                  <button onClick={closeLookupModal} className="w-full mt-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-colors">
                    {t.close}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}