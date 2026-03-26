"use client";
import { useState, useEffect, useRef } from "react";
import Navbar from "./Navbar";
import BookingBar from "./BookingBar";
import RoomList from "./RoomList";

const heroImages = [
  "/hero1.png",
  "/hero2.png",
  "/hero3.png",
  "/hero4.png",
  "/hero5.png",
  "/hero6.png"
];

// 💡 마닐라와 바기오 이미지를 public 폴더의 로컬 파일로 교체 완료!
const partnerHotels = [
  { 
    code: "NPLUS01", 
    name: "Metro Manila Hotel", 
    img: "/manila.png", // 💡 로컬 이미지 적용
    descKey: "pms", 
    url: "http://localhost:3000" 
  },
  { 
    code: "NPLUS02", 
    name: "Baguio Mountain Hotel", 
    img: "/baguio.png", // 💡 로컬 이미지 적용
    descKey: "kiosk", 
    url: "http://seoul.localhost:3000" 
  },
  { 
    code: "NPLUS03", 
    name: "Tagaytay Resort", 
    img: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=800", 
    descKey: "cm", 
    url: "http://busan.localhost:3000" 
  },
  { 
    code: "CEBU", 
    name: "Cebu Tropical", 
    img: "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&q=80&w=800", 
    descKey: "db", 
    url: "#" 
  },
  { 
    code: "BORACAY", 
    name: "Boracay Paradise", 
    img: "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&q=80&w=800", 
    descKey: "pms", 
    url: "#" 
  }
];

// 💡 [수정] 다국어 사전에 도입 문의(Contact) 관련 텍스트 추가
const translations = {
  en: {
    heroBadge: "THE ALL-IN-ONE HOTEL SOFTWARE", heroTitle: <>Empowering Hotels.<br/>Delighting Guests.</>, heroDesc: <>n+ is a next-generation Cloud PMS designed to <br/> maximize hotel revenue and streamline operations. <br className="hidden md:block"/>Guests can easily book our partner hotels directly below.</>,
    bookPartner: "Book with n+ Partner Hotels", zeroComm: "Zero Commission", searchResults: "Search Results", whyChoose: "Why Hoteliers Choose n+", whyDesc: "Our comprehensive suite of tools helps you reduce operational costs, increase direct bookings, and elevate the guest experience.",
    saasFeatures: [
      { icon: "☁️", title: "Cloud-based PMS", desc: "Manage your property anywhere, anytime with our lightning-fast cloud architecture." },
      { icon: "🔄", title: "Channel Manager", desc: "Sync inventory across OTA platforms in real-time to prevent overbookings." },
      { icon: "💻", title: "Direct Booking Engine", desc: "Drive commission-free direct bookings through our integrated web portal." },
      { icon: "📊", title: "Smart Analytics", desc: "Make data-driven decisions with real-time revenue and occupancy reports." }
    ],
    partnerNetwork: "Our Partner Network", partnerDesc: "Join hundreds of properties globally powered by n+. By joining our network, your hotel gains direct exposure to our unified booking portal.", viewAll: "View All Partners", partnerHotel: "Partner Hotel",
    poweredBy: { pms: "Powered by n+ Smart PMS", kiosk: "Powered by n+ Kiosk", cm: "Powered by n+ Channel Manager", db: "Powered by n+ Direct Booking" },
    ctaTitle: "Ready to Transform Your Hotel?", ctaDesc: "Stop paying high OTA commissions. Empower your staff and delight your guests with the ultimate Cloud PMS.", reqDemo: "Request a Demo", partnerLogin: "Partner Login",
    footerSaaS: "n+ Solutions", footerDesc: "The operating system for modern hoteliers. Streamline operations, boost direct bookings, and maximize revenue globally.", fSolutions: "Solutions", fCompany: "Company", fStayUpdated: "Stay Updated",
    fCloudPMS: "Cloud PMS", fChanMgr: "Channel Manager", fDirectBook: "Direct Booking Engine", fKiosk: "Smart Kiosk API", fAbout: "About n+", fPartners: "Partner Hotels", fPricing: "Pricing", fContact: "Contact Sales", fNews: "Get the latest hospitality tech news.", fEmail: "Work email", fJoin: "Join", fRights: "All rights reserved.", fPrivacy: "Privacy Policy", fTerms: "Terms of Service", fSecurity: "Security",
    alertDest: "is powered by n+ Hotel Solution.\nUse the booking bar above to find available rooms.", alertDemo: "Thank you for your interest! Our sales team will contact you shortly.", close: "Close",
    pmsPageTitle: "Cloud PMS Solutions", pmsPageSubtitle: "The Ultimate Operating System for Modern Hotels", pmsPageDesc: "Discover the powerful tools integrated into n+ to automate operations, connect with global OTAs, and drive revenue.",
    pmsSection1Title: "Intelligent Front Desk", pmsSection1Desc: "Speed up check-ins, manage folios seamlessly, and gain a bird's-eye view of all room statuses in real time. Designed for maximum staff efficiency.", pmsSection2Title: "Two-Way Channel Manager", pmsSection2Desc: "Connect to major OTAs (Agoda, Booking.com, Expedia) instantly. Rates and availability are automatically synced, eliminating overbookings and manual data entry.", pmsSection3Title: "Zero-Commission Booking Engine", pmsSection3Desc: "Convert website visitors into direct guests. Offer a secure, modern, and mobile-friendly booking experience right on your own domain.",
    loginTitle: "Partner Login", emailStr: "Email Address", pwStr: "Password", loginBtn: "Sign In", loginErr: "Invalid credentials.",
    dashTitle: "Partner Dashboard", dashSub: "Manage your hotel's integrations and billing.",
    dbBilling: "Billing & Payments", dbCardReg: "Auto-Payment Card", dbCardRegBtn: "Update Card", dbInvoices: "Payment History", dbReceipt: "Receipt",
    dbDomain: "Domain Settings", dbDomainDesc: "Link your custom domain for direct bookings.", dbDomainStatus: "Status", dbLinked: "Linked", dbDomainBtn: "Save Domain",
    dbCode: "Hotel Code Settings", dbCodeDesc: "6-character alphanumeric code for PMS sync.", dbCodeBtn: "Update Code",
    dbPlan: "Current Plan", dbPlanName: "n+ Enterprise Suite", dbPlanNext: "Next billing date", logoutBtn: "Logout",
    dbAnalytics: "Performance Overview", dbBookings: "Monthly Direct Bookings", dbSaved: "Commission Saved", dbOcc: "Current Occupancy",
    dbProfile: "Portal Profile Settings", dbProfileDesc: "Manage how your hotel appears on the n+ booking portal.", dbProfileImg: "Main Image URL", dbProfileText: "Short Description", dbProfileBtn: "Save Profile",
    dbSupport: "Support & Helpdesk", dbInquiry: "1:1 Inquiry", dbApiGuide: "API Integration Guide", dbNotices: "System Notices",
    contactSalesTitle: "Contact Sales", sendEmail: "Send an Email", whatsapp: "WhatsApp", emailLabel: "Your Email", msgLabel: "Message", sendBtn: "Send Message", backBtn: "Back", successMsg: "Your message has been sent successfully!",
    specialOffers: "Special Offers & Packages", promoCode: "Promo Code", validUntil: "Valid until", bookNow: "Book Now"
  },
  ko: {
    heroBadge: "올인원 호텔 소프트웨어", heroTitle: <>호텔의 혁신.<br/>고객의 감동.</>, heroDesc: <>n+는 호텔 수익을 극대화하고 운영을 간소화하는 차세대 클라우드 PMS입니다. <br className="hidden md:block"/>고객은 아래에서 파트너 호텔을 수수료 없이 다이렉트로 예약할 수 있습니다.</>,
    bookPartner: "n+ 파트너 호텔 다이렉트 예약", zeroComm: "수수료 0%", searchResults: "검색 결과", whyChoose: "왜 n+를 선택해야 할까요?", whyDesc: "n+의 통합 솔루션은 호텔의 운영 비용을 줄이고, 다이렉트 예약을 늘리며, 고객 경험을 향상시킵니다.",
    saasFeatures: [
      { icon: "☁️", title: "클라우드 기반 PMS", desc: "초고속 클라우드 아키텍처로 언제 어디서나 호텔을 완벽하게 관리하세요." },
      { icon: "🔄", title: "채널 매니저", desc: "다양한 OTA 플랫폼과 실시간으로 객실을 연동하여 오버부킹을 완벽히 방지합니다." },
      { icon: "💻", title: "다이렉트 예약 엔진", desc: "통합 웹 포털을 통해 수수료 없는 다이렉트 예약 매출을 창출하세요." },
      { icon: "📊", title: "스마트 분석", desc: "실시간 매출 및 객실 점유율 보고서를 통해 데이터 기반의 의사결정을 내리세요." }
    ],
    partnerNetwork: "파트너 네트워크", partnerDesc: "전 세계 수백 개의 호텔이 n+와 함께하고 있습니다. n+ 네트워크에 합류하여 통합 예약 포털에 호텔을 직접 노출하세요.", viewAll: "모든 파트너 보기", partnerHotel: "파트너 호텔",
    poweredBy: { pms: "n+ 스마트 PMS 적용", kiosk: "n+ 스마트 키오스크 적용", cm: "n+ 채널 매니저 적용", db: "n+ 다이렉트 예약 적용" },
    ctaTitle: "호텔을 혁신할 준비가 되셨나요?", ctaDesc: "높은 OTA 수수료는 이제 그만. 최고의 클라우드 PMS로 직원의 업무 효율을 높이고 고객에게 감동을 선사하세요.", reqDemo: "데모 신청하기", partnerLogin: "파트너 로그인",
    footerSaaS: "n+ SaaS", footerDesc: "현대 호텔리어를 위한 운영 체제. 운영을 간소화하고 다이렉트 예약을 늘려 전 세계적으로 수익을 극대화하세요.", fSolutions: "솔루션", fCompany: "회사 소개", fStayUpdated: "최신 소식 받기",
    fCloudPMS: "클라우드 PMS", fChanMgr: "채널 매니저", fDirectBook: "다이렉트 예약 엔진", fKiosk: "스마트 키오스크 API", fAbout: "n+ 소개", fPartners: "파트너 호텔", fPricing: "요금 안내", fContact: "도입 문의", fNews: "최신 호스피탈리티 테크 뉴스를 받아보세요.", fEmail: "이메일 주소", fJoin: "구독", fRights: "모든 권리 보유.", fPrivacy: "개인정보처리방침", fTerms: "이용약관", fSecurity: "보안 정책",
    alertDest: "은(는) n+ 호텔 솔루션 파트너입니다.\n상단의 예약 검색바를 이용해 남은 객실을 확인해 주세요.", alertDemo: "관심을 가져주셔서 감사합니다! 곧 영업팀에서 연락드리겠습니다.", close: "닫기",
    pmsPageTitle: "클라우드 PMS 솔루션", pmsPageSubtitle: "현대 호텔을 위한 궁극의 운영 체제", pmsPageDesc: "운영을 자동화하고, 글로벌 OTA와 연결하며, 수익을 창출하는 n+의 강력한 툴을 발견해보세요.",
    pmsSection1Title: "지능형 프론트 데스크", pmsSection1Desc: "체크인 속도를 높이고, 정산을 매끄럽게 처리하며, 모든 객실 상태를 실시간으로 한눈에 파악하세요. 직원의 업무 효율성을 극대화하도록 설계되었습니다.", pmsSection2Title: "양방향 채널 매니저", pmsSection2Desc: "Agoda, Booking.com, Expedia 등 주요 OTA와 즉시 연결됩니다. 요금과 가용 객실이 자동으로 동기화되어 오버부킹과 수기 입력의 번거로움을 없앱니다.", pmsSection3Title: "수수료 없는 다이렉트 예약 엔진", pmsSection3Desc: "웹사이트 방문자를 다이렉트 고객으로 전환하세요. 호텔의 자체 도메인에서 안전하고 모바일에 최적화된 최신 예약 경험을 제공합니다.",
    loginTitle: "파트너 로그인", emailStr: "이메일 주소", pwStr: "비밀번호", loginBtn: "로그인", loginErr: "로그인 정보가 올바르지 않습니다.",
    dashTitle: "파트너 대시보드", dashSub: "호텔의 연동 정보 및 결제 내역을 관리하세요.",
    dbBilling: "자동 결제 및 영수증", dbCardReg: "결제 카드 등록", dbCardRegBtn: "카드 변경", dbInvoices: "결제 및 영수증 내역", dbReceipt: "영수증 발급",
    dbDomain: "연동 도메인 설정", dbDomainDesc: "다이렉트 예약을 위한 자체 도메인을 연결하세요.", dbDomainStatus: "상태", dbLinked: "연동 완료", dbDomainBtn: "도메인 저장",
    dbCode: "호텔 코드 설정", dbCodeDesc: "시스템 연동을 위한 6자리 영어/숫자 조합 코드", dbCodeBtn: "코드 변경",
    dbPlan: "현재 구독 플랜", dbPlanName: "n+ 엔터프라이즈 스위트", dbPlanNext: "다음 결제일", logoutBtn: "로그아웃",
    dbAnalytics: "다이렉트 예약 성과 요약", dbBookings: "이번 달 다이렉트 예약", dbSaved: "절감한 수수료", dbOcc: "현재 객실 가동률",
    dbProfile: "포털 프로필 관리", dbProfileDesc: "n+ 통합 포털에 노출될 호텔 사진과 소개글을 관리하세요.", dbProfileImg: "대표 이미지 URL", dbProfileText: "한 줄 소개글", dbProfileBtn: "프로필 저장",
    dbSupport: "기술 지원 및 헬프데스크", dbInquiry: "1:1 문의하기", dbApiGuide: "API 연동 가이드", dbNotices: "시스템 공지사항",
    contactSalesTitle: "도입 문의", sendEmail: "이메일 보내기", whatsapp: "WhatsApp 문의", emailLabel: "이메일 주소", msgLabel: "문의 내용", sendBtn: "메시지 전송", backBtn: "뒤로 가기", successMsg: "메시지가 성공적으로 전송되었습니다!",
    specialOffers: "스페셜 프로모션 & 패키지", promoCode: "할인 코드", validUntil: "유효기간", bookNow: "지금 예약하기"
  },
  ja: {
    heroBadge: "オールインワン ホテルソフトウェア", heroTitle: <>ホテルの革新。<br/>ゲストの感動。</>, heroDesc: <>n+は、ホテルの収益を最大化し、運営を合理化する次世代クラウドPMSです。<br className="hidden md:block"/>ゲストは以下のパートナーホテルを直接予約できます。</>,
    bookPartner: "n+ パートナーホテルを予約", zeroComm: "手数料無料", searchResults: "検索結果", whyChoose: "n+ が選ばれる理由", whyDesc: "当社の包括的なツールは、運用コストの削減、直接予約の増加、ゲスト体験の向上をサポートします。",
    saasFeatures: [
      { icon: "☁️", title: "クラウド型 PMS", desc: "超高速クラウドアーキテクチャで、いつでもどこでもホテルを管理できます。" },
      { icon: "🔄", title: "チャネルマネージャー", desc: "OTAプラットフォーム間で在庫をリアルタイムに同期し、オーバーブッキングを防ぎます。" },
      { icon: "💻", title: "ダイレクト予約エンジン", desc: "統合ウェブポータルを通じて、手数料ゼロの直接予約を促進します。" },
      { icon: "📊", title: "スマート分析", desc: "リアルタイムの収益および稼働率レポートでデータ主導の意思決定を行います。" }
    ],
    partnerNetwork: "パートナーネットワーク", partnerDesc: "世界中の何百ものホテルがn+を導入しています。私たちのネットワークに参加し、統合予約ポータルで直接露出を高めましょう。", viewAll: "すべてのパートナーを見る", partnerHotel: "パートナーホテル",
    poweredBy: { pms: "n+ スマートPMS 導入", kiosk: "n+ スマートキオスク 導入", cm: "n+ チャネルマネージャー 導入", db: "n+ ダイレクト予約 導入" },
    ctaTitle: "ホテルを革新する準備はできましたか？", ctaDesc: "高いOTA手数料はもう不要です。最高のクラウドPMSでスタッフを支援し、ゲストに感動を届けましょう。", reqDemo: "デモをリクエスト", partnerLogin: "パートナーログイン",
    footerSaaS: "n+ SaaS", footerDesc: "現代のホテリエのためのオペレーティングシステム。運営を合理化し、直接予約を増やし、収益を最大化します。", fSolutions: "ソリューション", fCompany: "会社情報", fStayUpdated: "最新情報",
    fCloudPMS: "クラウド PMS", fChanMgr: "チャネルマネージャー", fDirectBook: "ダイレクト予約エンジン", fKiosk: "スマートキオスク API", fAbout: "n+ について", fPartners: "パートナーホテル", fPricing: "料金", fContact: "お問い合わせ", fNews: "ホスピタリティテックの最新ニュースをお届けします。", fEmail: "メールアドレス", fJoin: "登録", fRights: "無断複写・転載を禁じます。", fPrivacy: "プライバシーポリシー", fTerms: "利用規約", fSecurity: "セキュリティ",
    alertDest: "はn+ ホテルソリューションのパートナーです。\n上の検索バーを使用して空室を確認してください。", alertDemo: "ご関心をお寄せいただきありがとうございます！担当者より追ってご連絡いたします。", close: "閉じる",
    pmsPageTitle: "クラウド PMS ソリューション", pmsPageSubtitle: "現代ホテルのための究極のオペレーティングシステム", pmsPageDesc: "業務を自動化し、グローバルOTAと接続し、収益を牽引するn+の強力なツールを発見してください。",
    pmsSection1Title: "インテリジェントなフロントデスク", pmsSection1Desc: "チェックインを迅速化し、会計をシームレスに管理し、すべての客室状況をリアルタイムで把握します。", pmsSection2Title: "双方向チャネルマネージャー", pmsSection2Desc: "主要なOTAと即座に接続します。料金と空室状況は自動的に同期され、オーバーブッキングを防ぎます。", pmsSection3Title: "手数料ゼロの予約エンジン", pmsSection3Desc: "ウェブサイト訪問者を直接のゲストに変換します。安全でモバイルフレンドリーな予約体験を提供します。",
    loginTitle: "パートナーログイン", emailStr: "メールアドレス", pwStr: "パスワード", loginBtn: "ログイン", loginErr: "無効な資格情報です。",
    dashTitle: "パートナーダッシュボード", dashSub: "ホテルの統合と請求を管理します。",
    dbBilling: "請求と支払い", dbCardReg: "自動支払いカード", dbCardRegBtn: "カードの更新", dbInvoices: "支払い履歴", dbReceipt: "領収書",
    dbDomain: "ドメイン設定", dbDomainDesc: "直接予約用のカスタムドメインをリンクします。", dbDomainStatus: "ステータス", dbLinked: "リンク済み", dbDomainBtn: "ドメインの保存",
    dbCode: "ホテルコード設定", dbCodeDesc: "PMS同期用の6文字の英数字コード。", dbCodeBtn: "コードの更新",
    dbPlan: "現在のプラン", dbPlanName: "n+ エンタープライズ スイート", dbPlanNext: "次回の請求日", logoutBtn: "ログアウト",
    dbAnalytics: "パフォーマンス概要", dbBookings: "今月の直接予約", dbSaved: "節約した手数料", dbOcc: "現在の稼働率",
    dbProfile: "ポータルプロファイル設定", dbProfileDesc: "n+ポータルでのホテルの表示を管理します。", dbProfileImg: "画像 URL", dbProfileText: "短い説明", dbProfileBtn: "プロファイルを保存",
    dbSupport: "サポートとヘルプデスク", dbInquiry: "1:1 お問い合わせ", dbApiGuide: "API ガイド", dbNotices: "システム通知",
    contactSalesTitle: "お問い合わせ", sendEmail: "メールを送信", whatsapp: "WhatsApp", emailLabel: "メールアドレス", msgLabel: "メッセージ", sendBtn: "送信", backBtn: "戻る", successMsg: "メッセージが正常に送信されました！",
    specialOffers: "特別プロモーション＆パッケージ", promoCode: "プロモコード", validUntil: "有効期限", bookNow: "今すぐ予約"
  },
  zh: {
    heroBadge: "一体化酒店软件", heroTitle: <>赋能酒店。<br/>愉悦宾客。</>, heroDesc: <>n+ 是下一代云端 PMS，旨在最大化酒店收入并简化运营。<br className="hidden md:block"/>宾客可以在下方轻松直接预订我们的合作伙伴酒店。</>,
    bookPartner: "预订 n+ 合作伙伴酒店", zeroComm: "零佣金", searchResults: "搜索结果", whyChoose: "为什么选择 n+", whyDesc: "我们全面的工具套件可帮助您降低运营成本、增加直接预订并提升宾客体验。",
    saasFeatures: [
      { icon: "☁️", title: "云端 PMS", desc: "借助我们极速的云架构，随时随地管理您的酒店。" },
      { icon: "🔄", title: "渠道管理器", desc: "在各大 OTA 平台实时同步库存，防止超售。" },
      { icon: "💻", title: "直接预订引擎", desc: "通过我们的综合网络门户推动免佣金的直接预订。" },
      { icon: "📊", title: "智能分析", desc: "利用实时收入和入住率报告做出数据驱动的决策。" }
    ],
    partnerNetwork: "合作伙伴网络", partnerDesc: "全球数百家酒店均由 n+ 提供支持。加入我们的网络，让您的酒店在统一的预订门户中获得直接曝光。", viewAll: "查看所有合作伙伴", partnerHotel: "合作伙伴酒店",
    poweredBy: { pms: "由 n+ 智能 PMS 提供支持", kiosk: "由 n+ 自助终端 提供支持", cm: "由 n+ 渠道管理 提供支持", db: "由 n+ 直接预订 提供支持" },
    ctaTitle: "准备好转型您的酒店了吗？", ctaDesc: "停止支付高额 OTA 佣金。用终极云端 PMS 赋能员工并愉悦宾客。", reqDemo: "申请演示", partnerLogin: "合作伙伴登录",
    footerSaaS: "n+ SaaS", footerDesc: "现代酒店经营者的操作系统。简化运营、提高直接预订并最大化全球收入。", fSolutions: "解决方案", fCompany: "公司", fStayUpdated: "获取最新动态",
    fCloudPMS: "云端 PMS", fChanMgr: "渠道管理器", fDirectBook: "直接预订引擎", fKiosk: "智能终端 API", fAbout: "关于 n+", fPartners: "合作伙伴酒店", fPricing: "定价", fContact: "联系销售", fNews: "获取最新的酒店科技新闻。", fEmail: "工作邮箱", fJoin: "加入", fRights: "版权所有。", fPrivacy: "隐私政策", fTerms: "服务条款", fSecurity: "安全政策",
    alertDest: "由 n+ 酒店解决方案提供支持。\n请使用上方的搜索栏查找可用客房。", alertDemo: "感谢您的关注！我们的销售团队将很快与您联系。", close: "关闭",
    pmsPageTitle: "云端 PMS 解决方案", pmsPageSubtitle: "现代酒店的终极操作系统", pmsPageDesc: "发现 n+ 中集成的强大工具，以自动化运营、连接全球 OTA 并增加收入。",
    pmsSection1Title: "智能前台", pmsSection1Desc: "加快入住办理速度，无缝管理账单，并实时鸟瞰所有客房状态。", pmsSection2Title: "双向渠道管理器", pmsSection2Desc: "立即连接到主要 OTA。价格和空房情况自动同步，消除超售。", pmsSection3Title: "零佣金预订引擎", pmsSection3Desc: "将网站访问者转化为直接宾客。提供安全、现代且适合移动设备的预订体验。",
    loginTitle: "合作伙伴登录", emailStr: "电子邮箱", pwStr: "密码", loginBtn: "登录", loginErr: "凭据无效。",
    dashTitle: "合作伙伴仪表板", dashSub: "管理您酒店的集成和账单。",
    dbBilling: "账单与支付", dbCardReg: "自动支付卡", dbCardRegBtn: "更新银行卡", dbInvoices: "支付历史", dbReceipt: "收据",
    dbDomain: "域名设置", dbDomainDesc: "链接您的自定义域名以进行直接预订。", dbDomainStatus: "状态", dbLinked: "已链接", dbDomainBtn: "保存域名",
    dbCode: "酒店代码设置", dbCodeDesc: "用于 PMS 同步的 6 位字母数字代码。", dbCodeBtn: "更新代码",
    dbPlan: "当前计划", dbPlanName: "n+ 企业套件", dbPlanNext: "下一个计费日期", logoutBtn: "登出",
    dbAnalytics: "业绩概览", dbBookings: "本月直接预订", dbSaved: "节省的佣金", dbOcc: "当前入住率",
    dbProfile: "门户资料设置", dbProfileDesc: "管理您的酒店在 n+ 预订门户上的显示方式。", dbProfileImg: "图片网址", dbProfileText: "简短说明", dbProfileBtn: "保存资料",
    dbSupport: "支持与帮助", dbInquiry: "1:1 咨询", dbApiGuide: "API 集成指南", dbNotices: "系统通知",
    contactSalesTitle: "联系销售", sendEmail: "发送电子邮件", whatsapp: "WhatsApp", emailLabel: "您的电子邮箱", msgLabel: "留言", sendBtn: "发送消息", backBtn: "返回", successMsg: "您的消息已成功发送！",
    specialOffers: "特别优惠与套餐", promoCode: "优惠码", validUntil: "有效期至", bookNow: "立即预订"
  }
};

export default function MainPortal() {
  const [lang, setLang] = useState("en"); 
  const [searchData, setSearchData] = useState(null); 
  const [currentSlide, setCurrentSlide] = useState(0);
  const [alertMessage, setAlertMessage] = useState("");

  const [activeView, setActiveView] = useState("HOME");
  
  const [isPartnerLoggedIn, setIsPartnerLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");
  
  const [partnerDomain, setPartnerDomain] = useState("www.myhotel.com");
  const [partnerCode, setPartnerCode] = useState("NPLUS1");
  const [partnerCard, setPartnerCard] = useState("**** **** **** 1234");
  
  const [profileImg, setProfileImg] = useState("");
  const [profileDesc, setProfileDesc] = useState("Powered by n+ Smart PMS");

  // 💡 [신규 추가] Contact Sales 팝업창 관리를 위한 상태
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [contactMode, setContactMode] = useState('CHOICE');

  // 💡 [연동 완료] 로컬 스토리지에 저장된 "모든 호텔"의 프로모션을 싹 다 긁어옵니다.
  const [promotions, setPromotions] = useState([]);
  useEffect(() => {
    let allPromos = [];
    // 스토리지에 있는 모든 키를 검사해서 promotions_ 로 시작하는 데이터를 다 가져옵니다.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('promotions_')) {
        try {
          const parsed = JSON.parse(localStorage.getItem(key));
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          // Active 상태이면서 오늘 날짜 기준으로 만료되지 않은 것만 필터링
          const validPromos = parsed.filter(p => p.is_active === 1 && new Date(p.end_date) >= today);
          allPromos = [...allPromos, ...validPromos];
        } catch (e) {
          console.error("Promo parse error", e);
        }
      }
    }
    setPromotions(allPromos);
  }, []);

  const t = translations[lang] || translations.en;

  const sliderRef = useRef(null);
  const slideLeft = () => { if (sliderRef.current) sliderRef.current.scrollBy({ left: -350, behavior: 'smooth' }); };
  const slideRight = () => { if (sliderRef.current) sliderRef.current.scrollBy({ left: 350, behavior: 'smooth' }); };

  // 💡 [Cleaned] Fixed duplicate slider interval bug
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // ========================================================
  // 💡 [신규 추가] 사이트 전체 오른쪽 마우스(우클릭) 금지 로직
  // ========================================================
  useEffect(() => {
    const preventRightClick = (e) => e.preventDefault();
    document.addEventListener("contextmenu", preventRightClick);
    return () => document.removeEventListener("contextmenu", preventRightClick);
  }, []);

  const handleMenuClick = (action) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (action === 'HOME') {
      setActiveView("HOME");
      setSearchData(null);
    } else if (action === 'PMS') {
      setActiveView("PMS");
      setSearchData(null);
    } else if (action === 'LOGIN') {
      setActiveView("LOGIN"); 
      setSearchData(null);
    } else if (action === 'CONTACT') {
      // 💡 [핵심 연동] 이제 CONTACT 액션이 들어오면 알림창 대신 세련된 모달창을 엽니다!
      setIsContactOpen(true); 
    }
  };

  const closeContactModal = () => {
    setIsContactOpen(false);
    setTimeout(() => setContactMode('CHOICE'), 300); // 모달 닫힐 때 초기 화면으로 리셋
  };

  const handleUpdateHotelCode = () => {
    const regex = /^[A-Za-z0-9]{6}$/;
    if (!regex.test(partnerCode)) {
      // 💡 [Cleaned] Standardized alert messages to English
      setAlertMessage("Hotel code must be exactly 6 alphanumeric characters.");
      return;
    }
    setAlertMessage(`Hotel code successfully linked to [${partnerCode.toUpperCase()}].`);
  };

  const handleUpdateDomain = () => {
    setAlertMessage(`Domain [${partnerDomain}] successfully linked.`);
  };

  const handleUpdateProfile = () => {
    setAlertMessage(`Profile saved successfully and updated on the portal.`);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if(loginEmail && loginPw) {
      setIsPartnerLoggedIn(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setAlertMessage(t.loginErr);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-start overflow-x-hidden font-sans">
      
      <Navbar currentLang={lang} setLang={setLang} onMenuClick={handleMenuClick} />

      {searchData ? (
        <section className="w-full max-w-6xl mx-auto mt-28 px-4 animate-fade-in-up relative z-10 pb-20 flex-grow">
           {/* 💡 중복되던 📍 Search Results 제목과 밑줄을 완전히 삭제했습니다! */}
           <RoomList hotelCode={searchData.destination} lang={lang} checkIn={searchData.checkIn} checkOut={searchData.checkOut} adults={searchData.adults} kids={searchData.kids} />
        </section>
      ) : activeView === "LOGIN" ? (
        
        <div className="w-full flex-grow flex flex-col items-center mt-[72px] animate-fade-in bg-slate-50">
          {!isPartnerLoggedIn ? (
            <div className="w-full max-w-md mx-auto my-32 px-6">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                <div className="text-center mb-8">
                  <img src="/logo.png" alt="Hotel Logo" className="h-16 md:h-20 w-auto mx-auto mb-4 object-contain" />
                  <h2 className="text-2xl font-black text-slate-800">{t.loginTitle}</h2>
                </div>
                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t.emailStr}</label>
                    <input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} required className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="partner@hotel.com" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t.pwStr}</label>
                    <input type="password" value={loginPw} onChange={e=>setLoginPw(e.target.value)} required className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="••••••••" />
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-emerald-700 transition-colors mt-4">
                    {t.loginBtn}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            
            // 파트너 대시보드 화면
            <div className="w-full max-w-6xl mx-auto py-12 px-4 md:px-6 space-y-8">
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
                <div>
                  <h1 className="text-3xl font-black text-slate-900">{t.dashTitle}</h1>
                  <p className="text-slate-500 font-bold">{t.dashSub}</p>
                </div>
                <button onClick={()=>{setIsPartnerLoggedIn(false); setLoginPw('');}} className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg font-bold hover:bg-slate-300 transition-colors text-sm">
                  {t.logoutBtn}
                </button>
              </div>

              {/* 성과 요약 위젯 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t.dbBookings}</p>
                    <h3 className="text-3xl font-black text-slate-800">42</h3>
                  </div>
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xl shrink-0">📅</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t.dbSaved}</p>
                    <h3 className="text-2xl md:text-3xl font-black text-emerald-600">₱150,000</h3>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl shrink-0">💰</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t.dbOcc}</p>
                    <h3 className="text-3xl font-black text-slate-800">85%</h3>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xl shrink-0">🛏️</div>
                </div>
              </div>

              {/* 메인 2단 컬럼 레이아웃 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                
                {/* 왼쪽 열 */}
                <div className="lg:col-span-1 space-y-6">
                  
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{t.dbPlan}</h3>
                    <div className="text-xl font-black text-slate-800 mb-2">{t.dbPlanName}</div>
                    <div className="text-sm font-bold text-emerald-600 bg-emerald-50 w-fit px-3 py-1 rounded-full mb-4">Active</div>
                    <p className="text-xs text-slate-500"><strong>{t.dbPlanNext}:</strong> Oct 1, 2026</p>
                  </div>

                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{t.dbBilling}</h3>
                    <div className="mb-6">
                      <label className="text-xs font-bold text-slate-500 block mb-2">{t.dbCardReg}</label>
                      <div className="flex gap-2">
                        <input type="text" value={partnerCard} readOnly className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-mono text-slate-600 bg-slate-50" />
                        <button onClick={()=>setAlertMessage("Card update module opening...")} className="bg-slate-800 text-white px-4 rounded-lg font-bold text-xs whitespace-nowrap hover:bg-slate-700">{t.dbCardRegBtn}</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-2">{t.dbInvoices}</label>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <div>
                            <p className="text-xs font-bold text-slate-800">Sep 2026</p>
                            <p className="text-[10px] text-slate-500">₱15,000</p>
                          </div>
                          <button onClick={()=>setAlertMessage("Downloading receipt...")} className="text-xs font-bold text-emerald-600 hover:underline bg-emerald-50 px-2 py-1 rounded border border-emerald-100">📄 {t.dbReceipt}</button>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <div>
                            <p className="text-xs font-bold text-slate-800">Aug 2026</p>
                            <p className="text-[10px] text-slate-500">₱15,000</p>
                          </div>
                          <button onClick={()=>setAlertMessage("Downloading receipt...")} className="text-xs font-bold text-emerald-600 hover:underline bg-emerald-50 px-2 py-1 rounded border border-emerald-100">📄 {t.dbReceipt}</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 기술 지원 및 헬프데스크 */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{t.dbSupport}</h3>
                    <div className="space-y-3">
                      {/* 💡 [핵심 연동] 파트너 대시보드의 문의 버튼도 새 모달창으로 연결! */}
                      <button onClick={()=>setIsContactOpen(true)} className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-colors">
                        <span className="text-sm font-bold text-slate-700">🎧 {t.dbInquiry}</span>
                        <span className="text-slate-400">→</span>
                      </button>
                      <button onClick={()=>setAlertMessage("Opening API Guide...")} className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-colors">
                        <span className="text-sm font-bold text-slate-700">📖 {t.dbApiGuide}</span>
                        <span className="text-slate-400">→</span>
                      </button>
                      <button onClick={()=>setAlertMessage("No new notices at this time.")} className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-colors">
                        <span className="text-sm font-bold text-slate-700">📢 {t.dbNotices}</span>
                        <span className="text-emerald-600 text-[10px] font-black bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-widest">New</span>
                      </button>
                    </div>
                  </div>

                </div>

                {/* 오른쪽 열 */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* 3번: 포털 프로필 관리 */}
                  <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-black text-slate-800 mb-1">{t.dbProfile}</h3>
                    <p className="text-sm text-slate-500 mb-6">{t.dbProfileDesc}</p>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">{t.dbProfileImg}</label>
                        <input type="text" placeholder="https://..." value={profileImg} onChange={e=>setProfileImg(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500" />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                          <label className="text-xs font-bold text-slate-500 block mb-1">{t.dbProfileText}</label>
                          <input type="text" value={profileDesc} onChange={e=>setProfileDesc(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500" />
                        </div>
                        <div className="flex items-end shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                          <button onClick={handleUpdateProfile} className="bg-emerald-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-emerald-700 shadow-md transition-colors whitespace-nowrap w-full sm:w-auto">
                            {t.dbProfileBtn}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-black text-slate-800 mb-1">{t.dbCode}</h3>
                    <p className="text-sm text-slate-500 mb-6">{t.dbCodeDesc}</p>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 relative">
                        <input type="text" maxLength={6} value={partnerCode} onChange={e=>setPartnerCode(e.target.value.toUpperCase())} className="w-full p-3 border-2 border-slate-200 rounded-xl font-black text-lg text-slate-700 focus:border-emerald-500 outline-none uppercase tracking-widest" placeholder="EXMPL1" />
                        {partnerCode.length === 6 && <span className="absolute right-4 top-4 text-emerald-500 font-bold text-sm">✅</span>}
                      </div>
                      <button onClick={handleUpdateHotelCode} className="bg-emerald-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-emerald-700 shadow-md transition-colors whitespace-nowrap">
                        {t.dbCodeBtn}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">* Changing this code will automatically re-sync your PMS with the portal.</p>
                  </div>

                  <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-black text-slate-800 mb-1">{t.dbDomain}</h3>
                    <p className="text-sm text-slate-500 mb-6">{t.dbDomainDesc}</p>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 flex items-center bg-slate-50 border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 transition-colors">
                        <span className="pl-4 text-slate-400 font-bold">https://</span>
                        <input type="text" value={partnerDomain} onChange={e=>setPartnerDomain(e.target.value)} className="w-full p-3 bg-transparent font-bold text-slate-700 outline-none" placeholder="www.yourhotel.com" />
                      </div>
                      <button onClick={handleUpdateDomain} className="bg-emerald-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-emerald-700 shadow-md transition-colors whitespace-nowrap">
                        {t.dbDomainBtn}
                      </button>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">{t.dbDomainStatus}:</span>
                      <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {t.dbLinked}</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>

      ) : activeView === "PMS" ? (
        
        <div className="w-full flex-grow flex flex-col items-center mt-[72px] animate-fade-in">
          <section className="w-full bg-slate-900 py-24 md:py-32 px-6 border-b border-slate-800">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight drop-shadow-lg">{t.pmsPageTitle}</h1>
              <p className="text-xl md:text-2xl text-emerald-400 font-bold mb-6">{t.pmsPageSubtitle}</p>
              <p className="text-lg text-slate-300 leading-relaxed font-light max-w-2xl mx-auto">{t.pmsPageDesc}</p>
            </div>
          </section>

          <section className="w-full max-w-6xl mx-auto py-20 px-6 space-y-20 md:space-y-32">
            <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
              <div className="w-full md:w-1/2 flex justify-center">
                <div className="w-full max-w-md h-64 bg-emerald-100 rounded-3xl flex items-center justify-center text-7xl shadow-inner border-2 border-emerald-200">🛎️</div>
              </div>
              <div className="w-full md:w-1/2 text-center md:text-left">
                <h3 className="text-3xl font-black text-slate-800 mb-4">{t.pmsSection1Title}</h3>
                <p className="text-slate-600 text-lg leading-relaxed">{t.pmsSection1Desc}</p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row-reverse items-center gap-10 md:gap-16">
              <div className="w-full md:w-1/2 flex justify-center">
                <div className="w-full max-w-md h-64 bg-blue-100 rounded-3xl flex items-center justify-center text-7xl shadow-inner border-2 border-blue-200">🔄</div>
              </div>
              <div className="w-full md:w-1/2 text-center md:text-left">
                <h3 className="text-3xl font-black text-slate-800 mb-4">{t.pmsSection2Title}</h3>
                <p className="text-slate-600 text-lg leading-relaxed">{t.pmsSection2Desc}</p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
              <div className="w-full md:w-1/2 flex justify-center">
                <div className="w-full max-w-md h-64 bg-purple-100 rounded-3xl flex items-center justify-center text-7xl shadow-inner border-2 border-purple-200">💻</div>
              </div>
              <div className="w-full md:w-1/2 text-center md:text-left">
                <h3 className="text-3xl font-black text-slate-800 mb-4">{t.pmsSection3Title}</h3>
                <p className="text-slate-600 text-lg leading-relaxed">{t.pmsSection3Desc}</p>
              </div>
            </div>
          </section>

          <section className="w-full bg-emerald-600 py-20 px-6">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-6 tracking-tight">{t.ctaTitle}</h2>
              <button onClick={() => setAlertMessage(t.alertDemo)} className="bg-white text-emerald-700 font-black px-10 py-4 rounded-full shadow-lg hover:bg-slate-50 transition-transform active:scale-95 text-lg mt-4">
                {t.reqDemo}
              </button>
            </div>
          </section>
        </div>

      ) : (

        <div className="w-full flex-grow flex flex-col items-center animate-fade-in">
          <section className="relative w-full min-h-[75vh] md:min-h-[85vh] flex flex-col items-center justify-center mt-[72px] pb-16 md:pb-0 pt-10 md:pt-0">
            {heroImages.map((img, idx) => (
              <div key={idx} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? "opacity-100 z-0" : "opacity-0 z-0"}`}>
                <img src={img} alt="SaaS Background" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-slate-900/60"></div>
              </div>
            ))}
            
            <div className="relative z-10 text-center px-4 max-w-5xl mt-8 md:mt-0">
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

          {/* ====================================================
              💡 [신규] 예약 검색바 바로 밑 - 스페셜 프로모션 섹션
          ==================================================== */}
          <section className="w-full bg-slate-50 pt-40 md:pt-48 pb-16 px-6 -mt-10">
            <div className="max-w-7xl mx-auto">
              <div className="flex justify-between items-end mb-8">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span className="text-emerald-500">🎁</span> {t.specialOffers}
                </h2>
              </div>
              
                    <div className="flex overflow-x-auto gap-6 pb-6 snap-x scrollbar-hide px-2">
                      {promotions.length === 0 ? (
                        <p className="text-slate-400 font-bold p-4">No active promotions at this time.</p>
                      ) : (
                        promotions.map(promo => (
                          <div key={promo.id} className="snap-start shrink-0 w-[300px] md:w-[380px] bg-white rounded-3xl overflow-hidden shadow-lg border border-slate-100 transform hover:-translate-y-2 transition-transform duration-300">
                            <div className="h-48 relative">
                              <img src={promo.image_url} alt="Promo" className="w-full h-full object-cover" />
                              <div className="absolute top-4 left-4 bg-red-500 text-white font-black text-sm px-3 py-1 rounded-lg shadow-md">{promo.discount_pct}% OFF</div>
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
                              <h3 className="absolute bottom-4 left-4 text-white font-black text-xl">{promo.title}</h3>
                            </div>
                            <div className="p-6">
                              <span className="inline-block bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-black border border-blue-100 mb-3">🛏️ {promo.target_room_type}</span>
                              <p className="text-sm text-slate-500 mb-4 h-10 line-clamp-2">{promo.description}</p>
                              <div className="flex justify-between items-center bg-slate-50 border border-slate-200 p-3 rounded-xl mb-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.promoCode}</span>
                                <span className="font-mono font-black text-emerald-600 text-lg">{promo.code}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">{t.validUntil}: {promo.end_date}</span>
                                <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors">{t.bookNow}</button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>

          <section className="w-full bg-white mt-20 md:mt-32 pt-24 pb-20 px-6 border-b border-slate-100">
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

          <section className="w-full max-w-7xl mx-auto py-24 px-6">
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
                <button onClick={() => { setActiveView("LOGIN"); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-emerald-700 text-white border border-emerald-500 font-bold px-8 py-4 rounded-full hover:bg-emerald-800 transition-colors text-lg">
                  {t.partnerLogin}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 🌟 5. B2B SaaS Footer (푸터 업데이트 완료) */}
      <footer className="w-full bg-slate-950 text-slate-400 py-16 px-6 border-t border-slate-900 mt-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div className="lg:col-span-1">
            <img src="/logo.png" alt="n+ Solutions Logo" className="h-10 mb-6 object-contain" />
            <p className="text-sm leading-relaxed mb-6">{t.footerDesc}</p>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Solutions</h4>
            <ul className="space-y-3 text-sm">
              <li><button onClick={()=>handleMenuClick('PMS')} className="hover:text-emerald-400 transition-colors">Cloud PMS</button></li>
              <li><button className="hover:text-emerald-400 transition-colors">Table Order & Pay</button></li>
              <li><button className="hover:text-emerald-400 transition-colors">Fintech Solutions</button></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Company</h4>
            <ul className="space-y-3 text-sm">
              <li><button onClick={()=>handleMenuClick('HOME')} className="hover:text-emerald-400 transition-colors">About n+</button></li>
              {/* 💡 [핵심] 푸터의 Contact Us 버튼도 팝업창을 엽니다! */}
              <li><button onClick={()=>handleMenuClick('CONTACT')} className="hover:text-emerald-400 transition-colors">Contact Us</button></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Stay Updated</h4>
            <p className="text-sm mb-6">Get the latest our solutions news.</p>
            <div className="flex gap-4">
              <a href="#" className="text-slate-400 hover:text-white hover:scale-110 transition-all">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.604 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
              <a href="#" className="text-slate-400 hover:text-white hover:scale-110 transition-all">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="text-slate-400 hover:text-white hover:scale-110 transition-all">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
          <p>&copy; {new Date().getFullYear()} n+ Solutions Inc. {t.fRights}</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">{t.fPrivacy}</a>
            <a href="#" className="hover:text-white transition-colors">{t.fTerms}</a>
            <a href="#" className="hover:text-white transition-colors">{t.fSecurity}</a>
          </div>
        </div>
      </footer>

      {/* 💡 [신규] Contact Sales 모달창 (Email 폼 & WhatsApp 링크) */}
      {isContactOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 animate-fade-in" onClick={closeContactModal}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all" onClick={e => e.stopPropagation()}>
            <div className="bg-emerald-600 px-6 py-5 flex justify-between items-center text-white">
              <h2 className="text-xl font-bold">{t.contactSalesTitle}</h2>
              <button onClick={closeContactModal} className="text-white hover:text-gray-200 text-3xl font-light leading-none">&times;</button>
            </div>
            
            <div className="p-8">
              {contactMode === 'CHOICE' ? (
                <div className="flex flex-col gap-4">
                  {/* 이메일 버튼 -> 이메일 폼으로 화면 전환 */}
                  <button onClick={() => setContactMode('EMAIL')} className="flex items-center justify-center gap-3 w-full py-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 transition-colors shadow-sm">
                    <span className="text-2xl">✉️</span> {t.sendEmail}
                  </button>
                  
                  {/* WhatsApp 버튼 -> WhatsApp 링크로 바로 이동 (전화번호는 임시로 세팅) */}
                  <a href="https://wa.me/639123456789" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 w-full py-4 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 rounded-xl font-bold text-[#075E54] transition-colors shadow-sm">
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.394 0 0 5.394 0 12.031c0 2.155.564 4.246 1.638 6.096L.18 24l5.986-1.45A11.968 11.968 0 0012.031 24c6.637 0 12.031-5.394 12.031-12.031S18.668 0 12.031 0zm0 22.012c-1.84 0-3.64-.49-5.21-1.42l-.37-.22-3.87.94 1.03-3.77-.24-.38a10.021 10.021 0 01-1.54-5.402c0-5.541 4.509-10.051 10.051-10.051s10.051 4.51 10.051 10.051-4.51 10.051-10.051 10.051zm5.51-7.53c-.3-.15-1.79-.88-2.07-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.17.2-.34.22-.64.07-.3-.15-1.28-.47-2.44-1.5-.9-.8-1.51-1.79-1.69-2.09-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.38-.03-.53-.08-.15-.68-1.64-.93-2.25-.25-.59-.5-.51-.68-.52h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.5 0 1.48 1.08 2.9 1.23 3.1.15.2 2.11 3.22 5.11 4.52.71.3 1.27.48 1.7.62.72.23 1.38.2 1.89.12.58-.09 1.79-.73 2.04-1.44.25-.71.25-1.32.18-1.44-.08-.13-.28-.2-.58-.35z"/></svg>
                    {t.whatsapp}
                  </a>
                </div>
              ) : (
                <form onSubmit={(e) => { 
                    e.preventDefault(); 
                    setAlertMessage(t.successMsg); 
                    closeContactModal(); 
                }} className="space-y-4 animate-fade-in">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t.emailLabel}</label>
                    <input type="email" required className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="name@company.com" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t.msgLabel}</label>
                    <textarea required rows="4" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none resize-none" placeholder="How can we help you?"></textarea>
                  </div>
                  <div className="pt-2 flex flex-col gap-2">
                    <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 transition-colors shadow-md">
                        {t.sendBtn}
                    </button>
                    <button type="button" onClick={() => setContactMode('CHOICE')} className="w-full text-slate-500 font-bold py-2 hover:text-slate-700 text-sm transition-colors">
                        ← {t.backBtn}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 전역 알림 모달 */}
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