"use client";
import { useState, useEffect, useRef } from "react";
import Navbar from "./Navbar";
import BookingBar from "./BookingBar";
import RoomList from "./RoomList";

// 💡 1. 메인 배경 (public 폴더의 로컬 이미지)
const heroImages = [
  "/hero1.png",
  "/hero2.png",
  "/hero3.png",
  "/hero4.png",
  "/hero5.png",
  "/hero6.png"
];

// 💡 2. 파트너 호텔 데이터 (desc 대신 다국어 키 descKey 사용)
const partnerHotels = [
  { code: "NPLUS01", name: "Metro Manila Hotel", img: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&q=80&w=800", descKey: "pms", url: "http://localhost:3000" },
  { code: "NPLUS02", name: "Seoul Boutique", img: "https://images.unsplash.com/photo-1538626606363-47201e74bf0e?auto=format&fit=crop&q=80&w=800", descKey: "kiosk", url: "http://seoul.localhost:3000" },
  { code: "NPLUS03", name: "Busan Ocean Resort", img: "https://images.unsplash.com/photo-1620800720456-11f84dfcc021?auto=format&fit=crop&q=80&w=800", descKey: "cm", url: "http://busan.localhost:3000" },
  { code: "CEBU", name: "Cebu Tropical", img: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&q=80&w=800", descKey: "db", url: "#" },
  { code: "BORACAY", name: "Boracay Paradise", img: "https://images.unsplash.com/photo-1523592322629-416113c2e171?auto=format&fit=crop&q=80&w=800", descKey: "pms", url: "#" }
];

// 💡 3. 글로벌 다국어 번역 사전 (전체 페이지 적용)
const translations = {
  en: {
    heroBadge: "THE ALL-IN-ONE HOTEL SOFTWARE",
    heroTitle: <>Empowering Hotels.<br/>Delighting Guests.</>,
    heroDesc: <>n+ is a next-generation Cloud PMS designed to maximize hotel revenue and streamline operations. <br className="hidden md:block"/>Guests can easily book our partner hotels directly below.</>,
    bookPartner: "Book with n+ Partner Hotels",
    zeroComm: "Zero Commission",
    searchResults: "Search Results",
    whyChoose: "Why Hoteliers Choose n+",
    whyDesc: "Our comprehensive suite of tools helps you reduce operational costs, increase direct bookings, and elevate the guest experience.",
    saasFeatures: [
      { icon: "☁️", title: "Cloud-based PMS", desc: "Manage your property anywhere, anytime with our lightning-fast cloud architecture." },
      { icon: "🔄", title: "Channel Manager", desc: "Sync inventory across OTA platforms in real-time to prevent overbookings." },
      { icon: "💻", title: "Direct Booking Engine", desc: "Drive commission-free direct bookings through our integrated web portal." },
      { icon: "📊", title: "Smart Analytics", desc: "Make data-driven decisions with real-time revenue and occupancy reports." }
    ],
    partnerNetwork: "Our Partner Network",
    partnerDesc: "Join hundreds of properties globally powered by n+. By joining our network, your hotel gains direct exposure to our unified booking portal.",
    viewAll: "View All Partners",
    partnerHotel: "Partner Hotel",
    poweredBy: { pms: "Powered by n+ Smart PMS", kiosk: "Powered by n+ Kiosk", cm: "Powered by n+ Channel Manager", db: "Powered by n+ Direct Booking" },
    ctaTitle: "Ready to Transform Your Hotel?",
    ctaDesc: "Stop paying high OTA commissions. Empower your staff and delight your guests with the ultimate Cloud PMS.",
    reqDemo: "Request a Demo",
    partnerLogin: "Partner Login",
    footerDesc: "The operating system for modern hoteliers. Streamline operations, boost direct bookings, and maximize revenue globally.",
    fSolutions: "Solutions", fCompany: "Company", fStayUpdated: "Stay Updated",
    fCloudPMS: "Cloud PMS", fChanMgr: "Channel Manager", fDirectBook: "Direct Booking Engine", fKiosk: "Smart Kiosk API",
    fAbout: "About n+", fPartners: "Partner Hotels", fPricing: "Pricing", fContact: "Contact Sales",
    fNews: "Get the latest hospitality tech news.", fEmail: "Work email", fJoin: "Join",
    fRights: "All rights reserved.", fPrivacy: "Privacy Policy", fTerms: "Terms of Service", fSecurity: "Security",
    alertDest: "is powered by n+ Hotel Solution.\nUse the booking bar above to find available rooms.",
    alertDemo: "Thank you for your interest! Our sales team will contact you shortly.",
    alertLogin: "Partner login portal will be available soon.",
    close: "Close"
  },
  ko: {
    heroBadge: "올인원 호텔 소프트웨어",
    heroTitle: <>호텔의 혁신.<br/>고객의 감동.</>,
    heroDesc: <>n+는 호텔 수익을 극대화하고 운영을 간소화하는 차세대 클라우드 PMS입니다. <br className="hidden md:block"/>고객은 아래에서 파트너 호텔을 수수료 없이 다이렉트로 예약할 수 있습니다.</>,
    bookPartner: "n+ 파트너 호텔 다이렉트 예약",
    zeroComm: "수수료 0%",
    searchResults: "검색 결과",
    whyChoose: "왜 n+를 선택해야 할까요?",
    whyDesc: "n+의 통합 솔루션은 호텔의 운영 비용을 줄이고, 다이렉트 예약을 늘리며, 고객 경험을 향상시킵니다.",
    saasFeatures: [
      { icon: "☁️", title: "클라우드 기반 PMS", desc: "초고속 클라우드 아키텍처로 언제 어디서나 호텔을 완벽하게 관리하세요." },
      { icon: "🔄", title: "채널 매니저", desc: "다양한 OTA 플랫폼과 실시간으로 객실을 연동하여 오버부킹을 완벽히 방지합니다." },
      { icon: "💻", title: "다이렉트 예약 엔진", desc: "통합 웹 포털을 통해 수수료 없는 다이렉트 예약 매출을 창출하세요." },
      { icon: "📊", title: "스마트 분석", desc: "실시간 매출 및 객실 점유율 보고서를 통해 데이터 기반의 의사결정을 내리세요." }
    ],
    partnerNetwork: "파트너 네트워크",
    partnerDesc: "전 세계 수백 개의 호텔이 n+와 함께하고 있습니다. n+ 네트워크에 합류하여 통합 예약 포털에 호텔을 직접 노출하세요.",
    viewAll: "모든 파트너 보기",
    partnerHotel: "파트너 호텔",
    poweredBy: { pms: "n+ 스마트 PMS 적용", kiosk: "n+ 스마트 키오스크 적용", cm: "n+ 채널 매니저 적용", db: "n+ 다이렉트 예약 적용" },
    ctaTitle: "호텔을 혁신할 준비가 되셨나요?",
    ctaDesc: "높은 OTA 수수료는 이제 그만. 최고의 클라우드 PMS로 직원의 업무 효율을 높이고 고객에게 감동을 선사하세요.",
    reqDemo: "데모 신청하기",
    partnerLogin: "파트너 로그인",
    footerDesc: "현대 호텔리어를 위한 운영 체제. 운영을 간소화하고 다이렉트 예약을 늘려 전 세계적으로 수익을 극대화하세요.",
    fSolutions: "솔루션", fCompany: "회사 소개", fStayUpdated: "최신 소식 받기",
    fCloudPMS: "클라우드 PMS", fChanMgr: "채널 매니저", fDirectBook: "다이렉트 예약 엔진", fKiosk: "스마트 키오스크 API",
    fAbout: "n+ 소개", fPartners: "파트너 호텔", fPricing: "요금 안내", fContact: "도입 문의",
    fNews: "최신 호스피탈리티 테크 뉴스를 받아보세요.", fEmail: "이메일 주소", fJoin: "구독",
    fRights: "모든 권리 보유.", fPrivacy: "개인정보처리방침", fTerms: "이용약관", fSecurity: "보안 정책",
    alertDest: "은(는) n+ 호텔 솔루션 파트너입니다.\n상단의 예약 검색바를 이용해 남은 객실을 확인해 주세요.",
    alertDemo: "관심을 가져주셔서 감사합니다! 곧 영업팀에서 연락드리겠습니다.",
    alertLogin: "파트너 로그인 포털은 곧 오픈될 예정입니다.",
    close: "닫기"
  },
  ja: {
    heroBadge: "オールインワン ホテルソフトウェア",
    heroTitle: <>ホテルの革新。<br/>ゲストの感動。</>,
    heroDesc: <>n+は、ホテルの収益を最大化し、運営を合理化する次世代クラウドPMSです。<br className="hidden md:block"/>ゲストは以下のパートナーホテルを直接予約できます。</>,
    bookPartner: "n+ パートナーホテルを予約",
    zeroComm: "手数料無料",
    searchResults: "検索結果",
    whyChoose: "n+ が選ばれる理由",
    whyDesc: "当社の包括的なツールは、運用コストの削減、直接予約の増加、ゲスト体験の向上をサポートします。",
    saasFeatures: [
      { icon: "☁️", title: "クラウド型 PMS", desc: "超高速クラウドアーキテクチャで、いつでもどこでもホテルを管理できます。" },
      { icon: "🔄", title: "チャネルマネージャー", desc: "OTAプラットフォーム間で在庫をリアルタイムに同期し、オーバーブッキングを防ぎます。" },
      { icon: "💻", title: "ダイレクト予約エンジン", desc: "統合ウェブポータルを通じて、手数料ゼロの直接予約を促進します。" },
      { icon: "📊", title: "スマート分析", desc: "リアルタイムの収益および稼働率レポートでデータ主導の意思決定を行います。" }
    ],
    partnerNetwork: "パートナーネットワーク",
    partnerDesc: "世界中の何百ものホテルがn+を導入しています。私たちのネットワークに参加し、統合予約ポータルで直接露出を高めましょう。",
    viewAll: "すべてのパートナーを見る",
    partnerHotel: "パートナーホテル",
    poweredBy: { pms: "n+ スマートPMS 導入", kiosk: "n+ スマートキオスク 導入", cm: "n+ チャネルマネージャー 導入", db: "n+ ダイレクト予約 導入" },
    ctaTitle: "ホテルを革新する準備はできましたか？",
    ctaDesc: "高いOTA手数料はもう不要です。最高のクラウドPMSでスタッフを支援し、ゲストに感動を届けましょう。",
    reqDemo: "デモをリクエスト",
    partnerLogin: "パートナーログイン",
    footerDesc: "現代のホテリエのためのオペレーティングシステム。運営を合理化し、直接予約を増やし、収益を最大化します。",
    fSolutions: "ソリューション", fCompany: "会社情報", fStayUpdated: "最新情報",
    fCloudPMS: "クラウド PMS", fChanMgr: "チャネルマネージャー", fDirectBook: "ダイレクト予約エンジン", fKiosk: "スマートキオスク API",
    fAbout: "n+ について", fPartners: "パートナーホテル", fPricing: "料金", fContact: "お問い合わせ",
    fNews: "ホスピタリティテックの最新ニュースをお届けします。", fEmail: "メールアドレス", fJoin: "登録",
    fRights: "無断複写・転載を禁じます。", fPrivacy: "プライバシーポリシー", fTerms: "利用規約", fSecurity: "セキュリティ",
    alertDest: "はn+ ホテルソリューションのパートナーです。\n上の検索バーを使用して空室を確認してください。",
    alertDemo: "ご関心をお寄せいただきありがとうございます！担当者より追ってご連絡いたします。",
    alertLogin: "パートナーログインポータルは近日公開予定です。",
    close: "閉じる"
  },
  zh: {
    heroBadge: "一体化酒店软件",
    heroTitle: <>赋能酒店。<br/>愉悦宾客。</>,
    heroDesc: <>n+ 是下一代云端 PMS，旨在最大化酒店收入并简化运营。<br className="hidden md:block"/>宾客可以在下方轻松直接预订我们的合作伙伴酒店。</>,
    bookPartner: "预订 n+ 合作伙伴酒店",
    zeroComm: "零佣金",
    searchResults: "搜索结果",
    whyChoose: "为什么选择 n+",
    whyDesc: "我们全面的工具套件可帮助您降低运营成本、增加直接预订并提升宾客体验。",
    saasFeatures: [
      { icon: "☁️", title: "云端 PMS", desc: "借助我们极速的云架构，随时随地管理您的酒店。" },
      { icon: "🔄", title: "渠道管理器", desc: "在各大 OTA 平台实时同步库存，防止超售。" },
      { icon: "💻", title: "直接预订引擎", desc: "通过我们的综合网络门户推动免佣金的直接预订。" },
      { icon: "📊", title: "智能分析", desc: "利用实时收入和入住率报告做出数据驱动的决策。" }
    ],
    partnerNetwork: "合作伙伴网络",
    partnerDesc: "全球数百家酒店均由 n+ 提供支持。加入我们的网络，让您的酒店在统一的预订门户中获得直接曝光。",
    viewAll: "查看所有合作伙伴",
    partnerHotel: "合作伙伴酒店",
    poweredBy: { pms: "由 n+ 智能 PMS 提供支持", kiosk: "由 n+ 自助终端 提供支持", cm: "由 n+ 渠道管理 提供支持", db: "由 n+ 直接预订 提供支持" },
    ctaTitle: "准备好转型您的酒店了吗？",
    ctaDesc: "停止支付高额 OTA 佣金。用终极云端 PMS 赋能员工并愉悦宾客。",
    reqDemo: "申请演示",
    partnerLogin: "合作伙伴登录",
    footerDesc: "现代酒店经营者的操作系统。简化运营、提高直接预订并最大化全球收入。",
    fSolutions: "解决方案", fCompany: "公司", fStayUpdated: "获取最新动态",
    fCloudPMS: "云端 PMS", fChanMgr: "渠道管理器", fDirectBook: "直接预订引擎", fKiosk: "智能终端 API",
    fAbout: "关于 n+", fPartners: "合作伙伴酒店", fPricing: "定价", fContact: "联系销售",
    fNews: "获取最新的酒店科技新闻。", fEmail: "工作邮箱", fJoin: "加入",
    fRights: "版权所有。", fPrivacy: "隐私政策", fTerms: "服务条款", fSecurity: "安全政策",
    alertDest: "由 n+ 酒店解决方案提供支持。\n请使用上方的搜索栏查找可用客房。",
    alertDemo: "感谢您的关注！我们的销售团队将很快与您联系。",
    alertLogin: "合作伙伴登录门户即将开放。",
    close: "关闭"
  }
};

export default function MainPortal() {
  const [lang, setLang] = useState("en"); 
  const [searchData, setSearchData] = useState(null); 
  const [currentSlide, setCurrentSlide] = useState(0);
  const [alertMessage, setAlertMessage] = useState("");

  const t = translations[lang] || translations.en;

  const sliderRef = useRef(null);
  const slideLeft = () => { if (sliderRef.current) sliderRef.current.scrollBy({ left: -350, behavior: 'smooth' }); };
  const slideRight = () => { if (sliderRef.current) sliderRef.current.scrollBy({ left: 350, behavior: 'smooth' }); };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-start overflow-x-hidden font-sans">
      <Navbar currentLang={lang} setLang={setLang} />

      {/* 🌟 1. SaaS Hero Section */}
      <section className="relative w-full min-h-[75vh] md:min-h-[85vh] flex flex-col items-center justify-center mt-[72px] pb-16 md:pb-0 pt-10 md:pt-0">
        {heroImages.map((img, idx) => (
          <div key={idx} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? "opacity-100 z-0" : "opacity-0 z-0"}`}>
            <img src={img} alt="SaaS Background" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-slate-900/60"></div>
          </div>
        ))}
        
        <div className="relative z-10 text-center px-4 max-w-5xl animate-fade-in-up mt-8 md:mt-0">
          <div className="inline-block bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-bold tracking-widest text-xs md:text-sm px-4 py-1.5 rounded-full mb-6">
            {t.heroBadge}
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-tight mb-6 drop-shadow-2xl tracking-tight">
            {t.heroTitle}
          </h1>
          <p className="text-lg md:text-xl text-slate-300 mb-8 md:mb-10 leading-relaxed font-light drop-shadow max-w-3xl mx-auto">
            {t.heroDesc}
          </p>
        </div>

        {/* 💡 예약바 위치 조정 */}
        <div className="relative z-[60] w-full max-w-6xl px-4 mt-6 md:mt-12 md:-mb-32">
           <div className="bg-white rounded-3xl md:rounded-[40px] shadow-2xl p-4 md:p-6 border border-slate-100 flex flex-col gap-4">
             <div className="flex justify-between items-center px-2">
                <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2">
                  <span className="text-emerald-600">✨</span> {t.bookPartner}
                </h3>
                <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 md:px-3 py-1 rounded-full">{t.zeroComm}</span>
             </div>
             <BookingBar lang={lang} onSearchResults={setSearchData} />
           </div>
        </div>
      </section>

      {searchData ? (
        <section className="w-full max-w-6xl mx-auto mt-20 md:mt-32 px-4 animate-fade-in-up relative z-10 pb-20 flex-grow">
           <h3 className="text-2xl font-black text-slate-800 mb-6 border-b border-slate-200 pb-3 flex items-center gap-2">
             <span className="text-emerald-600">📍</span> {t.searchResults}
           </h3>
           <RoomList hotelCode={searchData.destination} lang={lang} checkIn={searchData.checkIn} checkOut={searchData.checkOut} adults={searchData.adults} kids={searchData.kids} />
        </section>
      ) : (
        <div className="w-full flex-grow flex flex-col items-center">
          
          {/* 🌟 2. B2B 핵심: n+ SaaS Features */}
          <section className="w-full bg-white mt-20 md:mt-32 pt-24 pb-20 px-6 border-b border-slate-100 animate-fade-in-up">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight">{t.whyChoose}</h2>
                <p className="text-slate-500 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
                  {t.whyDesc}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {t.saasFeatures.map((feat, idx) => (
                  <div key={idx} className="bg-slate-50 p-8 rounded-3xl border border-slate-100 hover:border-emerald-200 hover:shadow-xl transition-all duration-300 group flex flex-col items-center text-center">
                    <div className="text-4xl mb-6 bg-white w-16 h-16 rounded-2xl shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                      {feat.icon}
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-3 group-hover:text-emerald-600 transition-colors">{feat.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{feat.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 🌟 3. 가맹 호텔 네트워크 */}
          <section className="w-full max-w-7xl mx-auto py-24 px-6 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
              <div>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight">{t.partnerNetwork}</h2>
                <p className="text-slate-500 max-w-xl text-sm md:text-base leading-relaxed">
                  {t.partnerDesc}
                </p>
              </div>
              <button className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors uppercase tracking-widest text-sm border-b-2 border-emerald-600 pb-1">{t.viewAll}</button>
            </div>
            
            <div className="relative group/slider">
              <button onClick={slideLeft} className="absolute -left-4 md:-left-6 top-1/2 -translate-y-1/2 z-20 bg-white shadow-xl rounded-full w-12 h-12 flex items-center justify-center text-emerald-600 font-black text-xl hover:bg-emerald-50 hover:scale-110 transition-all opacity-0 group-hover/slider:opacity-100">
                ❮
              </button>

              <div ref={sliderRef} className="flex overflow-x-auto gap-6 snap-x pb-8 pt-4 px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {partnerHotels.map((dest, idx) => (
                  <div key={idx} className="snap-start shrink-0 w-full sm:w-[300px] md:w-[320px]">
                    <a href={dest.url} target="_blank" rel="noopener noreferrer" className="block group relative h-[380px] rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-slate-200"
                        onClick={(e) => {
                          if(dest.url === '#') {
                              e.preventDefault();
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                              setAlertMessage(`[ ${dest.name} ] ${t.alertDest}`);
                          }
                        }}
                    >
                      <img src={dest.img} alt={dest.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="absolute bottom-0 left-0 w-full p-6 text-white transform transition-transform duration-300">
                        <p className="text-emerald-400 font-bold text-[10px] tracking-widest uppercase mb-2 flex items-center gap-1">
                          {t.partnerHotel} <span className="opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                        </p>
                        <h3 className="text-xl font-black mb-2">{dest.name}</h3>
                        <div className="h-0 overflow-hidden group-hover:h-auto transition-all duration-300">
                           <p className="text-xs text-slate-300 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 border-t border-white/20 pt-2 flex items-center gap-2">
                             <span>⚡</span> {t.poweredBy[dest.descKey]}
                           </p>
                        </div>
                      </div>
                    </a>
                  </div>
                ))}
              </div>

              <button onClick={slideRight} className="absolute -right-4 md:-right-6 top-1/2 -translate-y-1/2 z-20 bg-white shadow-xl rounded-full w-12 h-12 flex items-center justify-center text-emerald-600 font-black text-xl hover:bg-emerald-50 hover:scale-110 transition-all opacity-0 group-hover/slider:opacity-100">
                ❯
              </button>
            </div>
          </section>

          {/* 🌟 4. B2B CTA */}
          <section className="w-full bg-emerald-600 py-20 px-6 mt-10">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-6 tracking-tight">{t.ctaTitle}</h2>
              <p className="text-emerald-100 text-lg mb-10 max-w-2xl mx-auto">
                {t.ctaDesc}
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button onClick={() => setAlertMessage(t.alertDemo)} className="bg-white text-emerald-700 font-black px-8 py-4 rounded-full shadow-lg hover:bg-slate-50 transition-transform active:scale-95 text-lg">
                  {t.reqDemo}
                </button>
                <button onClick={() => setAlertMessage(t.alertLogin)} className="bg-emerald-700 text-white border border-emerald-500 font-bold px-8 py-4 rounded-full hover:bg-emerald-800 transition-colors text-lg">
                  {t.partnerLogin}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 🌟 5. B2B SaaS Footer */}
      <footer className="w-full bg-slate-950 text-slate-400 py-16 px-6 border-t border-slate-900">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div className="lg:col-span-1">
            <h2 className="text-2xl font-black text-white mb-6 tracking-widest uppercase">{t.footerSaaS}</h2>
            <p className="text-sm leading-relaxed mb-6">{t.footerDesc}</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">{t.fSolutions}</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-emerald-400 transition-colors">{t.fCloudPMS}</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">{t.fChanMgr}</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">{t.fDirectBook}</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">{t.fKiosk}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">{t.fCompany}</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-emerald-400 transition-colors">{t.fAbout}</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">{t.fPartners}</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">{t.fPricing}</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">{t.fContact}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">{t.fStayUpdated}</h4>
            <p className="text-sm mb-4">{t.fNews}</p>
            <div className="flex">
              <input type="email" placeholder={t.fEmail} className="bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-l-lg w-full outline-none focus:border-emerald-500 text-sm" />
              <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-r-lg font-bold transition-colors text-sm">{t.fJoin}</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
          <p>&copy; {new Date().getFullYear()} n+ HOTEL SOLUTION. {t.fRights}</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">{t.fPrivacy}</a>
            <a href="#" className="hover:text-white transition-colors">{t.fTerms}</a>
            <a href="#" className="hover:text-white transition-colors">{t.fSecurity}</a>
          </div>
        </div>
      </footer>

      {/* 💡 전역 알림 모달 */}
      {alertMessage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setAlertMessage('')}>
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center border border-slate-100" onClick={e => e.stopPropagation()}>
                  <div className="bg-emerald-600 p-4 text-white flex justify-center items-center">
                      <h3 className="font-black text-lg">Notification</h3>
                  </div>
                  <div className="p-8 text-slate-700 font-bold text-[15px] whitespace-pre-wrap leading-relaxed">
                      {alertMessage}
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100">
                      <button onClick={() => setAlertMessage('')} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-black transition-transform active:scale-95 shadow-md">
                          {t.close}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </main>
  );
}