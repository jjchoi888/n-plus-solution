"use client";
import { useState, useEffect, useRef } from "react";
import Navbar from "./Navbar";
import BookingBar from "./BookingBar";
import RoomList from "./RoomList";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { app } from '../lib/firebase';
import axios from 'axios';

const heroImages = [
  "/hero1.png",
  "/hero2.png",
  "/hero3.png",
  "/hero4.png",
  "/hero5.png",
  "/hero6.png"
];

const nLogo = <img src="/logo192.png" alt="n+" className="h-[1.2em] w-auto inline-block transform -translate-y-[10%] mx-1" />;

const translations = {
  en: {
    heroBadge: "THE ALL-IN-ONE HOTEL SOFTWARE", heroTitle: <>Empowering Hotels.<br />Delighting Guests.</>, heroDesc: <>{nLogo} is a next-generation Cloud PMS designed to <br /> maximize hotel revenue and streamline operations. <br className="hidden md:block" />Guests can easily book our partner hotels directly below.</>,
    bookPartner: <>Book with {nLogo} Partner Hotels</>, zeroComm: "Low 1.5% Commission", searchResults: "Search Results", whyChoose: <>Why Hoteliers Choose {nLogo}</>, whyDesc: "Our comprehensive suite of tools helps you reduce operational costs, increase direct bookings, and elevate the guest experience.",
    saasFeatures: [
      { icon: "📉", title: "Drastic Cost Reduction", desc: "Powerful analysis algorithms optimize workforce management, significantly reducing the need for high-cost accounting or administrative personnel." },
      { icon: "🌐", title: "Native Direct Booking Engine", desc: "Elevate your brand with a custom webpage featuring a powerful, real-time automatic booking engine to drive reservations with an industry-low 1.5% fee." },
      { icon: "☁️", title: "Cloud-Based Total Solution", desc: "Seamlessly integrate payment, POS, booking, and management into a single, intuitive cloud platform—designed for effortless operation without IT experts." },
      { icon: "🌱", title: "Sustainable Paperless Operations", desc: "Lead the way in environmental protection. Utilize infinite cloud storage to digitize vast amounts of documents, achieving a 100% paperless workflow." }
    ],
    partnerNetwork: "Our Partner Network", partnerDesc: <>Join hundreds of properties globally powered by {nLogo}. By joining our network, your hotel gains direct exposure to our unified booking portal.</>, viewAll: "View All Partners", partnerHotel: "Partner Hotel",
    poweredBy: { pms: "Powered by n+ Smart PMS", kiosk: "Powered by n+ Kiosk", cm: "Powered by n+ Channel Manager", db: "Powered by n+ Direct Booking" },
    ctaTitle: "Ready to Transform Your Hotel?", ctaDesc: "Stop paying exorbitant 15-20% OTA commissions. Boost your revenue with our industry-leading 1.5% low-rate platform and ultimate Cloud PMS.", reqDemo: "Request a Demo", partnerLogin: "Partner Login",
    footerSaaS: "n+ Solutions", footerDesc: "The operating system for modern hoteliers. Streamline operations, boost direct bookings, and maximize revenue globally.", fSolutions: "Solutions", fCompany: "Company", fStayUpdated: "Stay Updated",
    fCloudPMS: "Cloud PMS", fChanMgr: "Channel Manager", fDirectBook: "Direct Booking Engine", fKiosk: "Smart Kiosk API", fAbout: "About n+", fPartners: "Partner Hotels", fPricing: "Pricing", fContact: "Contact Sales", fNews: "Get the latest hospitality tech news.", fEmail: "Work email", fJoin: "Join", fRights: "All rights reserved.", fPrivacy: "Privacy Policy", fTerms: "Terms of Service", fSecurity: "Security",
    alertDest: "is powered by n+ Hotel Solution.\nUse the booking bar above to find available rooms.", alertDemo: "Thank you for your interest! Our sales team will contact you shortly.", close: "Close",
    pmsPageTitle: "Cloud PMS Solutions", pmsPageSubtitle: "The Ultimate Operating System for Modern Hotels", pmsPageDesc: "Discover the powerful tools integrated into n+ to automate operations, connect with global OTAs, and drive revenue.",
    pmsSection1Title: "Intelligent Front Desk", pmsSection1Desc: "Speed up check-ins, manage folios seamlessly, and gain a bird's-eye view of all room statuses in real time. Designed for maximum staff efficiency.", pmsSection2Title: "Two-Way Channel Manager", pmsSection2Desc: "Connect to major OTAs (Agoda, Booking.com, Expedia) instantly. Rates and availability are automatically synced, eliminating overbookings and manual data entry.", pmsSection3Title: "Low-Commission Booking Engine", pmsSection3Desc: "Convert website visitors into direct guests. Offer a secure, modern, and mobile-friendly booking experience on your own domain with only a 1.5% transaction fee.",
    loginTitle: "Partner Login", hotelCodeStr: "Hotel Code", emailStr: "User ID", pwStr: "Password", loginBtn: "Sign In", loginErr: "Invalid credentials.",
    dashTitle: "Partner Dashboard", dashSub: "Manage your hotel's integrations and billing.",
    dbBilling: "Billing & Payments", dbCardReg: "Auto-Payment Card", dbCardRegBtn: "Update Card", dbInvoices: "Payment History", dbReceipt: "Receipt",
    dbDomain: "Domain Settings", dbDomainDesc: "Link your custom domain for direct bookings.", dbDomainStatus: "Status", dbLinked: "Linked", dbDomainBtn: "Save Domain",
    dbCode: "Hotel Code Settings", dbCodeDesc: "6-character alphanumeric code for PMS sync.", dbCodeBtn: "Update Code",
    dbPlan: "Current Plan", dbPlanName: "n+ Enterprise Suite", dbPlanNext: "Next billing date", logoutBtn: "Logout",
    dbAnalytics: "Performance Overview", dbBookings: "Monthly Direct Bookings", dbSaved: "OTA Commission Saved", dbOcc: "Current Occupancy",
    dbProfile: "Portal Profile Settings", dbProfileDesc: "Manage how your hotel appears on the n+ booking portal.", dbProfileImg: "Main Image URL", dbProfileText: "Short Description", dbProfileBtn: "Save Profile",
    dbSupport: "Support & Helpdesk", dbInquiry: "1:1 Inquiry", dbApiGuide: "API Integration Guide", dbNotices: "System Notices",
    contactSalesTitle: "Contact Sales", sendEmail: "Send an Email", whatsapp: "WhatsApp", emailLabel: "Your Email", msgLabel: "Message", sendBtn: "Send Message", backBtn: "Back", successMsg: "Your message has been sent successfully!",
    specialOffers: "Special Offers & Packages", promoCode: "Promo Code", validUntil: "Valid until", bookNow: "Book Now"
  },
  ko: {
    heroBadge: "올인원 호텔 소프트웨어", heroTitle: <>호텔의 혁신.<br />고객의 감동.</>, heroDesc: <>{nLogo}는 호텔 수익을 극대화하고 운영을 간소화하는 차세대 클라우드 PMS입니다. <br className="hidden md:block" />고객은 아래에서 파트너 호텔을 쉽고 빠르게 다이렉트로 예약할 수 있습니다.</>,
    bookPartner: <>{nLogo} 파트너 호텔 예약</>, zeroComm: "업계 최저 1.5% 수수료", searchResults: "검색 결과", whyChoose: <>왜 {nLogo}를 선택해야 할까요?</>, whyDesc: "n+의 통합 솔루션은 호텔의 운영 비용을 줄이고, 다이렉트 예약을 늘리며, 고객 경험을 향상시킵니다.",
    saasFeatures: [
      { icon: "📉", title: "획기적인 비용 절감", desc: "강력한 분석 알고리즘으로 인력 관리를 최적화하여 고비용의 회계 및 관리 인력 수요를 획기적으로 대체합니다." },
      { icon: "🌐", title: "자체 웹사이트 & 다이렉트 예약 엔진", desc: "실시간 자동 예약 엔진이 탑재된 맞춤형 웹사이트를 통해 1.5%의 합리적인 수수료로 다이렉트 예약을 유도합니다." },
      { icon: "☁️", title: "클라우드 기반 통합 솔루션", desc: "결제, POS, 예약 및 객실 관리 시스템을 단일 클라우드 플랫폼으로 통합하여 전문가 없이도 누구나 쉽게 운영할 수 있습니다." },
      { icon: "🌱", title: "친환경 페이퍼리스 운영", desc: "무제한 클라우드 스토리지를 제공하여 방대한 문서를 종이 없이 안전하게 보관하며, 친환경 호텔 운영을 선도합니다." }
    ],
    partnerNetwork: "파트너 네트워크", partnerDesc: <>전 세계 수백 개의 호텔이 {nLogo}와 함께하고 있습니다. {nLogo} 네트워크에 합류하여 통합 예약 포털에 호텔을 직접 노출하세요.</>, viewAll: "모든 파트너 보기", partnerHotel: "파트너 호텔",
    poweredBy: { pms: "n+ 스마트 PMS 적용", kiosk: "n+ 스마트 키오스크 적용", cm: "n+ 채널 매니저 적용", db: "n+ 다이렉트 예약 적용" },
    ctaTitle: "호텔을 혁신할 준비가 되셨나요?", ctaDesc: "15~20%에 달하는 높은 OTA 수수료는 이제 그만. 업계 최저 1.5% 수수료 플랫폼과 최고의 클라우드 PMS로 수익을 극대화하세요.", reqDemo: "데모 신청하기", partnerLogin: "파트너 로그인",
    footerSaaS: "n+ SaaS", footerDesc: "현대 호텔리어를 위한 운영 체제. 운영을 간소화하고 다이렉트 예약을 늘려 전 세계적으로 수익을 극대화하세요.", fSolutions: "솔루션", fCompany: "회사 소개", fStayUpdated: "최신 소식 받기",
    fCloudPMS: "클라우드 PMS", fChanMgr: "채널 매니저", fDirectBook: "다이렉트 예약 엔진", fKiosk: "스마트 키오스크 API", fAbout: "n+ 소개", fPartners: "파트너 호텔", fPricing: "요금 안내", fContact: "도입 문의", fNews: "최신 호스피탈리티 테크 뉴스를 받아보세요.", fEmail: "이메일 주소", fJoin: "구독", fRights: "모든 권리 보유.", fPrivacy: "개인정보처리방침", fTerms: "이용약관", fSecurity: "보안 정책",
    alertDest: "은(는) n+ 호텔 솔루션 파트너입니다.\n상단의 예약 검색바를 이용해 남은 객실을 확인해 주세요.", alertDemo: "관심을 가져주셔서 감사합니다! 곧 영업팀에서 연락드리겠습니다.", close: "닫기",
    pmsPageTitle: "클라우드 PMS 솔루션", pmsPageSubtitle: "현대 호텔을 위한 궁극의 운영 체제", pmsPageDesc: "운영을 자동화하고, 글로벌 OTA와 연결하며, 수익을 창출하는 n+의 강력한 툴을 발견해보세요.",
    pmsSection1Title: "지능형 프론트 데스크", pmsSection1Desc: "체크인 속도를 높이고, 정산을 매끄럽게 처리하며, 모든 객실 상태를 실시간으로 한눈에 파악하세요. 직원의 업무 효율성을 극대화하도록 설계되었습니다.", pmsSection2Title: "양방향 채널 매니저", pmsSection2Desc: "Agoda, Booking.com, Expedia 등 주요 OTA와 즉시 연결됩니다. 요금과 가용 객실이 자동으로 동기화되어 오버부킹과 수기 입력의 번거로움을 없앱니다.", pmsSection3Title: "초저수수료 다이렉트 예약 엔진", pmsSection3Desc: "웹사이트 방문자를 다이렉트 고객으로 전환하세요. 호텔의 자체 도메인에서 단 1.5%의 수수료로 모바일에 최적화된 최신 예약 경험을 제공합니다.",
    loginTitle: "파트너 로그인", hotelCodeStr: "호텔 코드", emailStr: "사용자 ID", pwStr: "비밀번호", loginBtn: "로그인", loginErr: "로그인 정보가 올바르지 않습니다.",
    dashTitle: "파트너 대시보드", dashSub: "호텔의 연동 정보 및 결제 내역을 관리하세요.",
    dbBilling: "자동 결제 및 영수증", dbCardReg: "결제 카드 등록", dbCardRegBtn: "카드 변경", dbInvoices: "결제 및 영수증 내역", dbReceipt: "영수증 발급",
    dbDomain: "연동 도메인 설정", dbDomainDesc: "다이렉트 예약을 위한 자체 도메인을 연결하세요.", dbDomainStatus: "상태", dbLinked: "연동 완료", dbDomainBtn: "도메인 저장",
    dbCode: "호텔 코드 설정", dbCodeDesc: "시스템 연동을 위한 6자리 영어/숫자 조합 코드", dbCodeBtn: "코드 변경",
    dbPlan: "현재 구독 플랜", dbPlanName: "n+ 엔터프라이즈 스위트", dbPlanNext: "다음 결제일", logoutBtn: "로그아웃",
    dbAnalytics: "다이렉트 예약 성과 요약", dbBookings: "이번 달 다이렉트 예약", dbSaved: "절감한 OTA 수수료", dbOcc: "현재 객실 가동률",
    dbProfile: "포털 프로필 관리", dbProfileDesc: "n+ 통합 포털에 노출될 호텔 사진과 소개글을 관리하세요.", dbProfileImg: "대표 이미지 URL", dbProfileText: "한 줄 소개글", dbProfileBtn: "프로필 저장",
    dbSupport: "기술 지원 및 헬프데스크", dbInquiry: "1:1 문의하기", dbApiGuide: "API 연동 가이드", dbNotices: "시스템 공지사항",
    contactSalesTitle: "도입 문의", sendEmail: "이메일 보내기", whatsapp: "WhatsApp 문의", emailLabel: "이메일 주소", msgLabel: "문의 내용", sendBtn: "메시지 전송", backBtn: "뒤로 가기", successMsg: "메시지가 성공적으로 전송되었습니다!",
    specialOffers: "스페셜 프로모션 & 패키지", promoCode: "할인 코드", validUntil: "유효기간", bookNow: "지금 예약하기"
  },
  ja: {
    heroBadge: "オールインワン ホテルソフトウェア", heroTitle: <>ホテルの革新。<br />ゲストの感動。</>, heroDesc: <>{nLogo}は、ホテルの収益を最大化し、運営を合理化する次世代クラウドPMSです。<br className="hidden md:block" />ゲストは以下のパートナーホテルを直接予約できます。</>,
    bookPartner: <>{nLogo} パートナーホテルを予約</>, zeroComm: "業界最安水準 1.5% 手数料", searchResults: "検索結果", whyChoose: <>{nLogo} が選ばれる理由</>, whyDesc: "当社の包括的なツールは、運用コストの削減、直接予約の増加、ゲスト体験の向上をサポートします。",
    saasFeatures: [
      { icon: "📉", title: "大幅なコスト削減", desc: "強力な分析アルゴリズムにより労働力管理を最適化し、高コストな経理や管理スタッフの必要性を大幅に削減します。" },
      { icon: "🌐", title: "自社ウェブサイト＆ダイレクト予約エンジン", desc: "リアルタイム自動予約エンジンを搭載したカスタムウェブサイトにより、わずか1.5%の手数料で直接予約を促進します。" },
      { icon: "☁️", title: "クラウド型トータルソリューション", desc: "決済、POS、予約、管理システムを単一のクラウドプラットフォームに統合し、ITの専門家不要で簡単に運用できます。" },
      { icon: "🌱", title: "環境に配慮したペーパーレス運営", desc: "無限のクラウドストレージを活用して膨大な文書をデジタル化し、環境保護をリードするペーパーレス運用を実現します。" }
    ],
    partnerNetwork: "パートナーネットワーク", partnerDesc: <>世界中の何百ものホテルが{nLogo}を導入しています。私たちのネットワークに参加し、統合予約ポータルで直接露出を高めましょう。</>, viewAll: "すべてのパートナーを見る", partnerHotel: "パートナーホテル",
    poweredBy: { pms: "n+ スマートPMS 導入", kiosk: "n+ スマートキオスク 導入", cm: "n+ チャネルマネージャー 導入", db: "n+ ダイレクト予約 導入" },
    ctaTitle: "ホテルを革新する準備はできましたか？", ctaDesc: "高額なOTA手数料（15〜20%）はもう不要です。わずか1.5%の低手数料プラットフォームと最高のクラウドPMSで収益を最大化しましょう。", reqDemo: "デモをリクエスト", partnerLogin: "パートナーログイン",
    footerSaaS: "n+ SaaS", footerDesc: "現代のホテリエのためのオペレーティングシステム。運営を合理化し、直接予約を増やし、収益を最大化します。", fSolutions: "ソリューション", fCompany: "会社情報", fStayUpdated: "最新情報",
    fCloudPMS: "クラウド PMS", fChanMgr: "チャネルマネージャー", fDirectBook: "ダイレクト予約エンジン", fKiosk: "スマートキオスク API", fAbout: "n+ について", fPartners: "パートナーホテル", fPricing: "料金", fContact: "お問い合わせ", fNews: "ホスピタリティテックの最新ニュースをお届けします。", fEmail: "メールアドレス", fJoin: "登録", fRights: "無断複写・転載を禁じます。", fPrivacy: "プライバシーポリシー", fTerms: "利用規約", fSecurity: "セキュリティ",
    alertDest: "はn+ ホテルソリューションのパートナーです。\n上の検索バーを使用して空室を確認してください。", alertDemo: "ご関心をお寄せいただきありがとうございます！担当者より追ってご連絡いたします。", close: "閉じる",
    pmsPageTitle: "クラウド PMS ソリューション", pmsPageSubtitle: "現代ホテルのための究極のオペレーティングシステム", pmsPageDesc: "業務を自動化し、グローバルOTAと接続し、収益を牽引するn+の強力なツールを発見してください。",
    pmsSection1Title: "インテリジェントなフロントデスク", pmsSection1Desc: "チェックインを迅速化し、会計をシームレスに管理し、すべての客室状況をリアルタイムで把握します。", pmsSection2Title: "双方向チャネルマネージャー", pmsSection2Desc: "主要なOTAと即座に接続します。料金と空室状況は自動的に同期され、オーバーブッキングを防ぎます。", pmsSection3Title: "低手数料（1.5%）の予約エンジン", pmsSection3Desc: "ウェブサイト訪問者を直接のゲストに変換します。わずか1.5%の取引手数料で、安全でモバイルフレンドリーな予約体験を提供します。",
    loginTitle: "パートナーログイン", hotelCodeStr: "ホテルコード", emailStr: "ユーザーID", pwStr: "パスワード", loginBtn: "ログイン", loginErr: "無効な資格情報です。",
    dashTitle: "パートナーダッシュボード", dashSub: "ホテルの統合と請求を管理します。",
    dbBilling: "請求と支払い", dbCardReg: "自動支払いカード", dbCardRegBtn: "カードの更新", dbInvoices: "支払い履歴", dbReceipt: "領収書",
    dbDomain: "ドメイン設定", dbDomainDesc: "直接予約用のカスタムドメインをリンクします。", dbDomainStatus: "ステータス", dbLinked: "リンク済み", dbDomainBtn: "ドメインの保存",
    dbCode: "ホテルコード設定", dbCodeDesc: "PMS同期用の6文字の英数字コード。", dbCodeBtn: "コードの更新",
    dbPlan: "現在のプラン", dbPlanName: "n+ エンタープライズ スイート", dbPlanNext: "次回の請求日", logoutBtn: "ログアウト",
    dbAnalytics: "パフォーマンス概要", dbBookings: "今月の直接予約", dbSaved: "節約したOTA手数料", dbOcc: "現在の稼働率",
    dbProfile: "ポータルプロファイル設定", dbProfileDesc: "n+ポータルでのホテルの表示を管理します。", dbProfileImg: "画像 URL", dbProfileText: "短い説明", dbProfileBtn: "プロファイルを保存",
    dbSupport: "サポートとヘルプデスク", dbInquiry: "1:1 お問い合わせ", dbApiGuide: "API ガイド", dbNotices: "システム通知",
    contactSalesTitle: "お問い合わせ", sendEmail: "メールを送信", whatsapp: "WhatsApp", emailLabel: "メールアドレス", msgLabel: "メッセージ", sendBtn: "送信", backBtn: "戻る", successMsg: "メッセージが正常に送信されました！",
    specialOffers: "特別プロモーション＆パッケージ", promoCode: "プロモコード", validUntil: "有効期限", bookNow: "今すぐ予約"
  },
  zh: {
    heroBadge: "一体化酒店软件", heroTitle: <>赋能酒店。<br />愉悦宾客。</>, heroDesc: <>{nLogo} 是下一代云端 PMS，旨在最大化酒店收入并简化运营。<br className="hidden md:block" />宾客可以在下方轻松直接预订我们的合作伙伴酒店。</>,
    bookPartner: <>预订 {nLogo} 合作伙伴酒店</>, zeroComm: "超低 1.5% 佣金", searchResults: "搜索结果", whyChoose: <>为什么选择 {nLogo}</>, whyDesc: "我们全面的工具套件可帮助您降低运营成本、增加直接预订并提升宾客体验。",
    saasFeatures: [
      { icon: "📉", title: "显著降低成本", desc: "强大的分析算法优化了劳动力管理，大幅减少了对高成本会计和行政人员的需求。" },
      { icon: "🌐", title: "专属网站与直连预订引擎", desc: "借助配备实时自动预订引擎的定制网站，以 1.5% 的行业超低费率推动直接预订。" },
      { icon: "☁️", title: "基于云端的全面解决方案", desc: "将支付、POS、预订和管理系统无缝集成到一个云平台中，无需 IT 专业人员即可轻松操作。" },
      { icon: "🌱", title: "环保无纸化运营", desc: "利用无限的云存储空间将海量文档数字化，实现 100% 无纸化工作流程，引领环保潮流。" }
    ],
    partnerNetwork: "合作伙伴网络", partnerDesc: <>全球数百家酒店均由 {nLogo} 提供支持。加入我们的网络，让您的酒店在统一的预订门户中获得直接曝光。</>, viewAll: "查看所有合作伙伴", partnerHotel: "合作伙伴酒店",
    poweredBy: { pms: "由 n+ 智能 PMS 提供支持", kiosk: "由 n+ 自助终端 提供支持", cm: "由 n+ 渠道管理 提供支持", db: "由 n+ 直接预订 提供支持" },
    ctaTitle: "准备好转型您的酒店了吗？", ctaDesc: "告别高达 15-20% 的 OTA 佣金。借助我们 1.5% 超低费率平台和终极云端 PMS 提升您的收入。", reqDemo: "申请演示", partnerLogin: "合作伙伴登录",
    footerSaaS: "n+ SaaS", footerDesc: "现代酒店经营者的操作系统。简化运营、提高直接预订并最大化全球收入。", fSolutions: "解决方案", fCompany: "公司", fStayUpdated: "获取最新动态",
    fCloudPMS: "云端 PMS", fChanMgr: "渠道管理器", fDirectBook: "直接预订引擎", fKiosk: "智能终端 API", fAbout: "关于 n+", fPartners: "合作伙伴酒店", fPricing: "定价", fContact: "联系销售", fNews: "获取最新的酒店科技新闻。", fEmail: "工作邮箱", fJoin: "加入", fRights: "版权所有。", fPrivacy: "隐私政策", fTerms: "服务条款", fSecurity: "安全政策",
    alertDest: "由 n+ 酒店解决方案提供支持。\n请使用上方的搜索栏查找可用客房。", alertDemo: "感谢您的关注！我们的销售团队将很快与您联系。", close: "关闭",
    pmsPageTitle: "云端 PMS 解决方案", pmsPageSubtitle: "现代酒店的终极操作系统", pmsPageDesc: "发现 n+ 中集成的强大工具，以自动化运营、连接全球 OTA 并增加收入。",
    pmsSection1Title: "智能前台", pmsSection1Desc: "加快入住办理速度，无缝管理账单，并实时鸟瞰所有客房状态。", pmsSection2Title: "双向渠道管理器", pmsSection2Desc: "立即连接到主要 OTA。价格和空房情况自动同步，消除超售。", pmsSection3Title: "超低佣金预订引擎", pmsSection3Desc: "将网站访问者转化为直接宾客。在您自己的域名上提供安全、现代的预订体验，交易费仅为 1.5%。",
    loginTitle: "合作伙伴登录", hotelCodeStr: "酒店代码", emailStr: "用户 ID", pwStr: "密码", loginBtn: "登录", loginErr: "凭据无效。",
    dashTitle: "合作伙伴仪表板", dashSub: "管理您酒店的集成和账单。",
    dbBilling: "账单与支付", dbCardReg: "自动支付卡", dbCardRegBtn: "更新银行卡", dbInvoices: "支付历史", dbReceipt: "收据",
    dbDomain: "域名设置", dbDomainDesc: "链接您的自定义域名以进行直接预订。", dbDomainStatus: "状态", dbLinked: "已链接", dbDomainBtn: "保存域名",
    dbCode: "酒店代码设置", dbCodeDesc: "用于 PMS 同步的 6 位字母数字代码。", dbCodeBtn: "更新代码",
    dbPlan: "当前计划", dbPlanName: "n+ 企业套件", dbPlanNext: "下一个计费日期", logoutBtn: "登出",
    dbAnalytics: "业绩概览", dbBookings: "本月直接预订", dbSaved: "节省的 OTA 佣金", dbOcc: "当前入住率",
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
  const [loginHotelCode, setLoginHotelCode] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");

  const [partnerDomain, setPartnerDomain] = useState("");
  const [partnerCode, setPartnerCode] = useState("");
  const [partnerCard, setPartnerCard] = useState("");

  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isCardUpdating, setIsCardUpdating] = useState(false);
  const [cardForm, setCardForm] = useState({ number: '', expiry: '', cvc: '', name: '' });

  const [profileImg, setProfileImg] = useState("");
  const [profileDesc, setProfileDesc] = useState("Powered by n+ Smart PMS");

  const [isContactOpen, setIsContactOpen] = useState(false);
  const [contactMode, setContactMode] = useState('CHOICE');

  const [promotions, setPromotions] = useState([]);
  const [partnerHotels, setPartnerHotels] = useState([]);

  const [selectedPromoHotel, setSelectedPromoHotel] = useState(null);

  // =========================================================
  // 💡 [NEW] 게스트 로그인 / 회원가입 (스크린샷 기반 100% 매칭)
  // =========================================================
  const [user, setUser] = useState(null);
  const [isMembershipActive, setIsMembershipActive] = useState(false);

  const [showGuestAuthModal, setShowGuestAuthModal] = useState(false);
  const [guestAuthMode, setGuestAuthMode] = useState('REGISTER'); // 💡 기본 상태: 회원가입

  const [guestEmail, setGuestEmail] = useState("");
  const [guestPw, setGuestPw] = useState("");
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestNationality, setGuestNationality] = useState("");

  // guest-app의 3단계 온보딩 로직 연동을 위한 상태 유지
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardStep, setOnboardStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [idUploaded, setIdUploaded] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardNum, setCardNum] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // 페이지 로드 시 로컬 스토리지 확인
  useEffect(() => {
    const savedUser = localStorage.getItem('nplus_guest_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        if (parsedUser.is_membership_active) {
          setIsMembershipActive(true);
        }
      } catch (e) { }
    }
  }, []);

  const handleGuestLogout = () => {
    localStorage.removeItem('nplus_guest_user');
    setUser(null);
    setIsMembershipActive(false);
    window.location.reload();
  };

  // 💡 통합 회원가입/로그인 제출 처리
  const handleGuestAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = guestAuthMode === 'LOGIN' ? '/api/guest-login' : '/api/guest-register';
      const payload = guestAuthMode === 'LOGIN'
        ? { email: guestEmail, password: guestPw }
        : { email: guestEmail, password: guestPw, first_name: guestFirstName, last_name: guestLastName, phone: guestPhone, nationality: guestNationality };

      // API 호출 처리 (백엔드가 연결 안되어있을 경우를 대비해 fetch 실패 시 에러 무시)
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => null);

      // 로컬 스토리지에 guest-app과 동일한 규격으로 유저 데이터 저장
      const userData = {
        email: guestEmail,
        name: guestAuthMode === 'REGISTER' ? `${guestFirstName} ${guestLastName}` : "Guest User",
        first_name: guestFirstName,
        last_name: guestLastName,
        phone: guestPhone || phone,
        nationality: guestNationality,
        is_membership_active: false,
        tierName: "Basic",
        total_points: 0
      };

      localStorage.setItem('nplus_guest_user', JSON.stringify(userData));
      setUser(userData);
      setShowGuestAuthModal(false);
      setAlertMessage(guestAuthMode === 'LOGIN' ? "Welcome back!" : "Account created successfully!");

      // 폼 초기화
      setGuestEmail(""); setGuestPw(""); setGuestFirstName(""); setGuestLastName(""); setGuestPhone(""); setGuestNationality("");
    } catch (err) {
      setAlertMessage("Server connection error.");
    }
  };

  const startOnboarding = () => {
    setShowOnboarding(true);
    setOnboardStep(1);
  };

  const nextStep = () => {
    if (onboardStep === 1 && !phone) return alert('Please enter your phone number.');
    if (onboardStep === 2 && !idUploaded) return alert('Please upload your ID card for verification.');
    if (onboardStep === 3 && (!cardName || !cardNum || !cardExp || !cardCvv)) return alert('Please enter all payment details.');

    if (onboardStep < 3) {
      setOnboardStep(onboardStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const completeOnboarding = () => {
    const updatedUser = {
      ...user,
      phone: phone,
      is_membership_active: true,
      tierId: 'MEMBER',
      tierName: 'Member',
      total_points: 1000,
      total_spend: 0,
      name: user?.name || "Guest User"
    };
    localStorage.setItem('nplus_guest_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    setIsMembershipActive(true);
    setShowOnboarding(false);
    alert('Welcome to N+ Rewards! 1,000 Bonus Points have been added to your account.');
  };
  // =========================================================

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const resPromo = await fetch('/api/promotions?hotel=ALL');
        const dataPromo = await resPromo.json();

        const resHotels = await fetch('/api/hotels');
        const dataHotels = await resHotels.json();

        if (Array.isArray(dataHotels)) {
          setPartnerHotels(dataHotels);
        }

        if (Array.isArray(dataPromo)) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const validPromos = dataPromo.filter(p => p.is_active === 1 && (!p.end_date || new Date(p.end_date) >= today));
          setPromotions(validPromos);
        }
      } catch (e) { console.error("Failed to load portal data", e); }
    };

    fetchAllData();
  }, []);

  const [promoRegion, setPromoRegion] = useState("ALL");
  const [promoSearch, setPromoSearch] = useState("");

  const enrichedPromotions = promotions.map(promo => {
    const matchedHotel = partnerHotels.find(h => h.code === promo.hotel_code) || {};
    return {
      ...promo,
      hotel_name: promo.hotel_name || matchedHotel.name || "Partner Hotel",
      city: promo.city || matchedHotel.city || "City",
      province: promo.province || matchedHotel.province || "Province",
    };
  });

  const availableRegions = ["ALL", ...Array.from(new Set(enrichedPromotions.map(p => p.province).filter(Boolean)))];

  const filteredPromos = enrichedPromotions.filter(promo => {
    const matchRegion = promoRegion === "ALL" || promo.province === promoRegion;
    const searchLower = promoSearch.toLowerCase();
    const matchSearch = promoSearch === "" ||
      (promo.hotel_name && promo.hotel_name.toLowerCase().includes(searchLower)) ||
      (promo.city && promo.city.toLowerCase().includes(searchLower)) ||
      (promo.title && promo.title.toLowerCase().includes(searchLower));
    return matchRegion && matchSearch;
  });

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

  useEffect(() => {
    const preventRightClick = (e) => e.preventDefault();
    document.addEventListener("contextmenu", preventRightClick);
    return () => document.removeEventListener("contextmenu", preventRightClick);
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("partner_logged_in") === "true") {
      setIsPartnerLoggedIn(true);
      setActiveView("LOGIN");
    }
  }, []);

  useEffect(() => {
    const savedCard = localStorage.getItem("mock_partner_card");
    if (savedCard) {
      setPartnerCard(savedCard);
    }
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
      setIsContactOpen(true);
    }
  };

  const handleCardSave = (e) => {
    e.preventDefault();
    setIsCardUpdating(true);

    setTimeout(() => {
      const last4 = cardForm.number.slice(-4).padStart(4, '0');
      const maskedCard = `**** **** **** ${last4}`;

      setPartnerCard(maskedCard);
      localStorage.setItem("mock_partner_card", maskedCard);

      setIsCardUpdating(false);
      setIsCardModalOpen(false);
      setAlertMessage("Payment card updated successfully!");
      setCardForm({ number: '', expiry: '', cvc: '', name: '' });
    }, 1500);
  };

  const closeContactModal = () => {
    setIsContactOpen(false);
    setTimeout(() => setContactMode('CHOICE'), 300);
  };

  const handleUpdateHotelCode = () => {
    const regex = /^[A-Za-z0-9]{6}$/;
    if (!regex.test(partnerCode)) {
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

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const BASE_URL = '';

      const res = await fetch(`${BASE_URL}/api/portal-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotel_code: loginHotelCode.trim(),
          user_id: loginEmail.trim(),
          password: loginPw.trim()
        })
      });

      const data = await res.json();

      if (data.success) {
        sessionStorage.setItem("partner_logged_in", "true");
        sessionStorage.setItem("partner_hotel_code", data.hotel_code);

        setIsPartnerLoggedIn(true);
        setActiveView("LOGIN");
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setAlertMessage(`Login Failed: ${data.message}`);
      }
    } catch (error) {
      console.error("Login request error:", error);
      setAlertMessage("Unable to connect to the server. Please check your network connection.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-start overflow-x-hidden font-sans">

      {/* 💡 Navbar에 guest Auth 관련 prop 전달 */}
      <Navbar
        currentLang={lang}
        setLang={setLang}
        onMenuClick={handleMenuClick}
        user={user}
        onLogout={handleGuestLogout}
        onLoginClick={() => {
          setGuestAuthMode('REGISTER'); // 로그인 버튼 클릭 시 무조건 회원가입 창부터 띄움
          setShowGuestAuthModal(true);
        }}
      />

      {searchData ? (
        <section className="w-full max-w-6xl mx-auto mt-28 px-4 animate-fade-in-up relative z-10 pb-20 flex-grow">
          <RoomList hotelCode={searchData.destination} lang={lang} checkIn={searchData.checkIn} checkOut={searchData.checkOut} adults={searchData.adults} kids={searchData.kids} source="Portal" />
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
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                      {t.hotelCodeStr || "Hotel Code"}
                    </label>
                    <input
                      type="text"
                      value={loginHotelCode}
                      onChange={e => setLoginHotelCode(e.target.value)}
                      required
                      className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none tracking-widest"
                      placeholder="e.g. SKY001"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                      {t.emailStr || "User ID"}
                    </label>
                    <input
                      type="text"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      required
                      className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="e.g. MA001"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t.pwStr}</label>
                    <input type="password" value={loginPw} onChange={e => setLoginPw(e.target.value)} required className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none tracking-widest" placeholder="••••••••" />
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-emerald-700 transition-colors mt-4">
                    {t.loginBtn}
                  </button>
                </form>
              </div>
            </div>
          ) : (

            <div className="w-full max-w-6xl mx-auto py-12 px-4 md:px-6 space-y-8">

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
                <div>
                  <h1 className="text-3xl font-black text-slate-900">{t.dashTitle}</h1>
                  <p className="text-slate-500 font-bold">{t.dashSub}</p>
                </div>
                <button onClick={() => {
                  sessionStorage.removeItem("partner_logged_in");
                  setIsPartnerLoggedIn(false);
                  setLoginPw('');
                  setLoginEmail('');
                  setLoginHotelCode('');
                }} className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg font-bold hover:bg-slate-300 transition-colors text-sm">
                  {t.logoutBtn}
                </button>
              </div>

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

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

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
                        <button onClick={() => setIsCardModalOpen(true)} className="bg-slate-800 text-white px-4 rounded-lg font-bold text-xs whitespace-nowrap hover:bg-slate-700 transition-colors shadow-sm">{t.dbCardRegBtn}</button>
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
                          <button onClick={() => setAlertMessage("Downloading receipt...")} className="text-xs font-bold text-emerald-600 hover:underline bg-emerald-50 px-2 py-1 rounded border border-emerald-100">📄 {t.dbReceipt}</button>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <div>
                            <p className="text-xs font-bold text-slate-800">Aug 2026</p>
                            <p className="text-[10px] text-slate-500">₱15,000</p>
                          </div>
                          <button onClick={() => setAlertMessage("Downloading receipt...")} className="text-xs font-bold text-emerald-600 hover:underline bg-emerald-50 px-2 py-1 rounded border border-emerald-100">📄 {t.dbReceipt}</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{t.dbSupport}</h3>
                    <div className="space-y-3">
                      <button onClick={() => setIsContactOpen(true)} className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-colors">
                        <span className="text-sm font-bold text-slate-700">🎧 {t.dbInquiry}</span>
                        <span className="text-slate-400">→</span>
                      </button>
                      <button onClick={() => setAlertMessage("Opening API Guide...")} className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-colors">
                        <span className="text-sm font-bold text-slate-700">📖 {t.dbApiGuide}</span>
                        <span className="text-slate-400">→</span>
                      </button>
                      <button onClick={() => setAlertMessage("No new notices at this time.")} className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-colors">
                        <span className="text-sm font-bold text-slate-700">📢 {t.dbNotices}</span>
                        <span className="text-emerald-600 text-[10px] font-black bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-widest">New</span>
                      </button>
                    </div>
                  </div>

                </div>

                <div className="lg:col-span-2 space-y-6">

                  <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-black text-slate-800 mb-1">{t.dbProfile}</h3>
                    <p className="text-sm text-slate-500 mb-6">{t.dbProfileDesc}</p>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">{t.dbProfileImg}</label>
                        <input type="text" placeholder="https://..." value={profileImg} onChange={e => setProfileImg(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500" />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                          <label className="text-xs font-bold text-slate-500 block mb-1">{t.dbProfileText}</label>
                          <input type="text" value={profileDesc} onChange={e => setProfileDesc(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500" />
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
                        <input type="text" maxLength={6} value={partnerCode} onChange={e => setPartnerCode(e.target.value.toUpperCase())} className="w-full p-3 border-2 border-slate-200 rounded-xl font-black text-lg text-slate-700 focus:border-emerald-500 outline-none uppercase tracking-widest" placeholder="EXMPL1" />
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
                        <input type="text" value={partnerDomain} onChange={e => setPartnerDomain(e.target.value)} className="w-full p-3 bg-transparent font-bold text-slate-700 outline-none" placeholder="www.yourhotel.com" />
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
                </div>
                <BookingBar lang={lang} onSearchResults={setSearchData} hotels={partnerHotels} preselectedHotelCode={selectedPromoHotel} />
              </div>
            </div>
          </section>

          <section className="w-full bg-slate-50 pt-40 md:pt-48 pb-16 px-6 -mt-10">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2 shrink-0">
                  <span className="text-emerald-500">🎁</span> {t.specialOffers}
                </h2>

                <div className="relative w-full md:w-72 shrink-0">
                  <input
                    type="text"
                    value={promoSearch}
                    onChange={(e) => setPromoSearch(e.target.value)}
                    placeholder="Search hotel or city..."
                    className="w-full py-2.5 pl-10 pr-4 rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm"
                  />
                  <svg className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
              </div>

              <div className="flex overflow-x-auto gap-2 pb-6 mb-2 scrollbar-hide">
                {availableRegions.map((region, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPromoRegion(region)}
                    className={`whitespace-nowrap px-5 py-2 rounded-full text-xs font-black tracking-wide transition-all duration-300 border shadow-sm
            ${promoRegion === region
                        ? "bg-slate-900 text-white border-slate-900 scale-105"
                        : "bg-white text-slate-500 border-slate-200 hover:border-emerald-500 hover:text-emerald-600"
                      }`}
                  >
                    {region === "ALL" ? "All Locations" : region}
                  </button>
                ))}
              </div>

              <div className="flex overflow-x-auto gap-6 pb-6 snap-x scrollbar-hide px-2">
                {filteredPromos.length === 0 ? (
                  <div className="w-full flex flex-col items-center justify-center py-12 text-center bg-white rounded-3xl border border-slate-100 border-dashed">
                    <span className="text-4xl mb-4">🔍</span>
                    <p className="text-slate-500 font-bold text-lg">No promotions found.</p>
                    <p className="text-slate-400 text-sm mt-1">Try adjusting your search or region filter.</p>
                  </div>
                ) : (
                  filteredPromos.map(promo => (
                    <div key={promo.id} className="snap-start shrink-0 w-[300px] md:w-[380px] bg-white rounded-3xl overflow-hidden shadow-lg border border-slate-100 transform hover:-translate-y-2 transition-transform duration-300 flex flex-col">
                      <div className="h-48 relative shrink-0">
                        <img src={promo.image_url} alt="Promo" className="w-full h-full object-cover" />
                        <div className="absolute top-4 left-4 bg-red-500 text-white font-black text-sm px-3 py-1 rounded-lg shadow-md">{promo.discount_pct}% OFF</div>
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
                        <h3 className="absolute bottom-4 left-4 text-white font-black text-xl line-clamp-1 pr-4">{promo.title}</h3>
                      </div>
                      <div className="p-6 flex-grow flex flex-col">

                        <div className="mb-4 pb-4 border-b border-slate-100">
                          <h4 className="text-slate-900 font-black text-lg leading-tight line-clamp-1 hover:text-emerald-600 transition-colors cursor-pointer">
                            {promo.hotel_name}
                          </h4>
                          <p className="text-slate-500 text-xs font-bold mt-1.5 flex items-center gap-1.5 line-clamp-1">
                            <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                            {promo.city}, {promo.province}
                          </p>
                        </div>

                        <span className="inline-block bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-black border border-blue-100 mb-3 w-fit">🛏️ {promo.target_room_type}</span>
                        <p className="text-sm text-slate-500 mb-4 h-10 line-clamp-2 flex-grow">{promo.description}</p>
                        <div className="flex justify-between items-center bg-slate-50 border border-slate-200 p-3 rounded-xl mb-4 shrink-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.promoCode}</span>
                          <span className="font-mono font-black text-emerald-600 text-lg">{promo.code}</span>
                        </div>
                        <div className="flex justify-between items-center shrink-0">
                          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
                            {t.validUntil}: <br className="sm:hidden" />{promo.end_date}
                          </span>

                          <button
                            onClick={() => {
                              const matchedHotel = partnerHotels.find(h => h.code === promo.hotel_code);

                              const baseUrl = matchedHotel?.domain
                                ? `https://${matchedHotel.domain}`
                                : `/?hotel=${promo.hotel_code}`;

                              const separator = baseUrl.includes('?') ? '&' : '?';
                              const deepLink = `${baseUrl}${separator}promo=${promo.code}&roomType=${encodeURIComponent(promo.target_room_type)}`;

                              window.open(deepLink, '_blank');
                            }}
                            className="bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-emerald-600 transition-colors shadow-md"
                          >
                            {t.bookNow}
                          </button>
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
              <button
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  setTimeout(() => {
                    const destInput = document.getElementById("destination-trigger");
                    if (destInput) {
                      destInput.click();
                    }
                  }, 300);
                }}
                className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors uppercase tracking-widest text-sm border-b-2 border-emerald-600 pb-1"
              >
                {t.viewAll}
              </button>
            </div>

            <div className="relative group/slider">
              <button onClick={slideLeft} className="absolute -left-4 md:-left-6 top-1/2 -translate-y-1/2 z-20 bg-white shadow-xl rounded-full w-12 h-12 flex items-center justify-center text-emerald-600 font-black text-xl hover:bg-emerald-50 hover:scale-110 transition-all opacity-0 group-hover/slider:opacity-100">
                ❮
              </button>

              <div ref={sliderRef} className="flex overflow-x-auto gap-6 snap-x pb-8 pt-4 px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {partnerHotels.length > 0 ? partnerHotels.map((dest, idx) => {
                  const hotelLink = dest.domain ? `https://${dest.domain}` : `/?hotel=${dest.code}`;

                  return (
                    <div key={idx} className="snap-start shrink-0 w-full sm:w-[300px] md:w-[320px]">
                      <a href={hotelLink} target="_blank" rel="noopener noreferrer" className="block group relative h-[380px] rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-slate-200"
                        onClick={(e) => {
                          if (!dest.code) {
                            e.preventDefault();
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            setAlertMessage(`[ ${dest.name} ] ${t.alertDest}`);
                          }
                        }}
                      >
                        <img src={dest.image_url} alt={dest.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="absolute bottom-0 left-0 w-full p-6 text-white transform transition-transform duration-300">
                          <p className="text-emerald-400 font-bold text-[10px] tracking-widest uppercase mb-1 flex items-center gap-1">
                            {t.partnerHotel} <span className="opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                          </p>
                          <h3 className="text-xl font-black mb-1 leading-tight">{dest.name}</h3>

                          <p className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                            <span className="line-clamp-1">{[dest.city, dest.province].filter(Boolean).join(", ") || "Philippines"}</span>
                          </p>

                          <div className="h-0 overflow-hidden group-hover:h-auto transition-all duration-300">
                            <p className="text-xs text-slate-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 border-t border-white/20 pt-2 flex items-center gap-2">
                              <span>⚡</span> {t.poweredBy[dest.descKey || 'pms']}
                            </p>
                          </div>
                        </div>
                      </a>
                    </div>
                  );
                }) : (
                  <div className="w-full text-center py-10 text-slate-500 font-bold">No partner hotels found.</div>
                )}
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

      <footer className="w-full bg-slate-950 text-slate-400 py-16 px-6 border-t border-slate-900 mt-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div className="lg:col-span-1">
            <img src="/logo.png" alt="n+ Solutions Logo" className="h-10 mb-6 object-contain" />
            <p className="text-sm leading-relaxed mb-6">{t.footerDesc}</p>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Solutions</h4>
            <ul className="space-y-3 text-sm">
              <li><button onClick={() => handleMenuClick('PMS')} className="hover:text-emerald-400 transition-colors">Cloud PMS</button></li>
              <li><button className="hover:text-emerald-400 transition-colors">Table Order & Pay</button></li>
              <li><button className="hover:text-emerald-400 transition-colors">Fintech Solutions</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Company</h4>
            <ul className="space-y-3 text-sm">
              <li><button onClick={() => handleMenuClick('HOME')} className="hover:text-emerald-400 transition-colors">About n+</button></li>
              <li><button onClick={() => handleMenuClick('CONTACT')} className="hover:text-emerald-400 transition-colors">Contact Us</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-xs">Stay Updated</h4>
            <p className="text-sm mb-6">Get the latest our solutions news.</p>
            {/* 푸터 SNS 아이콘 영역 (에러 방지를 위해 안전한 텍스트로 대체) */}
            <div className="flex gap-4">
              <a href="#" className="text-slate-400 hover:text-white transition-all text-sm font-bold">Facebook</a>
              <a href="#" className="text-slate-400 hover:text-white transition-all text-sm font-bold">Twitter</a>
              <a href="#" className="text-slate-400 hover:text-white transition-all text-sm font-bold">Instagram</a>
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
                  <button onClick={() => setContactMode('EMAIL')} className="flex items-center justify-center gap-3 w-full py-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 transition-colors shadow-sm">
                    <span className="text-2xl">✉️</span> {t.sendEmail}
                  </button>

                  <a href="https://wa.me/639123456789" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 w-full py-4 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 rounded-xl font-bold text-[#075E54] transition-colors shadow-sm">
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.394 0 0 5.394 0 12.031c0 2.155.564 4.246 1.638 6.096L.18 24l5.986-1.45A11.968 11.968 0 0012.031 24c6.637 0 12.031-5.394 12.031-12.031S18.668 0 12.031 0zm0 22.012c-1.84 0-3.64-.49-5.21-1.42l-.37-.22-3.87.94 1.03-3.77-.24-.38a10.021 10.021 0 01-1.54-5.402c0-5.541 4.509-10.051 10.051-10.051s10.051 4.51 10.051 10.051-4.51 10.051-10.051 10.051zm5.51-7.53c-.3-.15-1.79-.88-2.07-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.17.2-.34.22-.64.07-.3-.15-1.28-.47-2.44-1.5-.9-.8-1.51-1.79-1.69-2.09-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.38-.03-.53-.08-.15-.68-1.64-.93-2.25-.25-.59-.5-.51-.68-.52h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.5 0 1.48 1.08 2.9 1.23 3.1.15.2 2.11 3.22 5.11 4.52.71.3 1.27.48 1.7.62.72.23 1.38.2 1.89.12.58-.09 1.79-.73 2.04-1.44.25-.71.25-1.32.18-1.44-.08-.13-.28-.2-.58-.35z" /></svg>
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

      {/* ========================================================= */}
      {/* 💡 [NEW] 결제 카드 업데이트 모달창 */}
      {/* ========================================================= */}
      {isCardModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => !isCardUpdating && setIsCardModalOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 transform transition-all" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-900 p-5 flex justify-between items-center">
              <h3 className="font-black text-white text-lg flex items-center gap-2">💳 Update Payment Method</h3>
              {!isCardUpdating && (
                <button onClick={() => setIsCardModalOpen(false)} className="text-slate-400 hover:text-white transition-colors text-xl leading-none">&times;</button>
              )}
            </div>

            <form onSubmit={handleCardSave} className="p-6 md:p-8 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Card Number</label>
                <div className="relative">
                  <input type="text" required maxLength="16" value={cardForm.number} onChange={e => setCardForm({ ...cardForm, number: e.target.value.replace(/[^0-9]/g, '') })} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all" placeholder="0000 0000 0000 0000" />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">💳</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Expiry Date</label>
                  <input type="text" required maxLength="5" value={cardForm.expiry} onChange={e => setCardForm({ ...cardForm, expiry: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all" placeholder="MM/YY" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">CVC / CVV</label>
                  <input type="password" required maxLength="4" value={cardForm.cvc} onChange={e => setCardForm({ ...cardForm, cvc: e.target.value.replace(/[^0-9]/g, '') })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all" placeholder="•••" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Cardholder Name</label>
                <input type="text" required value={cardForm.name} onChange={e => setCardForm({ ...cardForm, name: e.target.value.toUpperCase() })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all uppercase" placeholder="JOHN DOE" />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" disabled={isCardUpdating} onClick={() => setIsCardModalOpen(false)} className="flex-1 px-4 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={isCardUpdating || cardForm.number.length < 15} className="flex-1 px-4 py-3.5 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2">
                  {isCardUpdating ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Verifying...</>
                  ) : "Save Card"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 💡 [NEW] guest-app 3단계 온보딩 풀스크린 UI */}
      {/* ========================================================= */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-slate-50 z-[200] flex flex-col font-sans text-slate-700 animate-fade-in">
          <div className="bg-white p-4 border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm">
            <button onClick={() => setShowOnboarding(false)} className="text-slate-400 font-bold text-xl px-2 hover:text-slate-600 transition-colors">✕</button>
            <h2 className="font-bold text-slate-800 text-lg">Join Membership</h2>
            <span className="text-[#009900] font-bold text-xs">Step {onboardStep} / 3</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col max-w-md mx-auto w-full pb-20">
            <div className="flex gap-2 mb-8 shrink-0">
              <div className={`h-1.5 flex-1 ${onboardStep >= 1 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
              <div className={`h-1.5 flex-1 ${onboardStep >= 2 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
              <div className={`h-1.5 flex-1 ${onboardStep >= 3 ? 'bg-[#009900]' : 'bg-slate-200'}`}></div>
            </div>

            {onboardStep === 1 && (
              <div className="animate-fade-in-up">
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Exclusive Benefits</h3>
                <p className="text-slate-500 text-sm font-medium mb-6">Complete your profile to unlock our progressive reward tiers.</p>

                <div className="bg-white border border-slate-200 p-5 shadow-sm mb-8 space-y-5">
                  <div className="flex items-start gap-3">
                    <img src="/point.svg" alt="Points" className="w-7 h-7 object-contain shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800 text-sm">Up to 10% Reward Points</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Start with 2% back on all bookings as a Member, growing up to 10% as VIP.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <img src="/progressive.svg" alt="Progressive" className="w-7 h-7 object-contain shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800 text-sm">Progressive Perks</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Unlock 1-Hour Late Checkout (Silver) and Free Breakfast & Upgrades (Gold).</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <img src="/vip.svg" alt="VIP" className="w-7 h-7 object-contain shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800 text-sm">VIP Experience</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Reach VIP tier for exclusive Lounge Access and complimentary Mini-bar.</p>
                    </div>
                  </div>
                </div>

                <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Phone Number</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="09" className="w-full p-4 border border-slate-300 text-sm font-semibold text-slate-800 focus:border-[#009900] outline-none shadow-sm rounded-none" />
              </div>
            )}

            {onboardStep === 2 && (
              <div className="animate-fade-in-up">
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Identity Verification</h3>
                <p className="text-slate-500 text-sm font-medium mb-6">Please upload a valid ID for security and age verification.</p>

                <div className="border-2 border-dashed border-slate-300 bg-white p-8 text-center relative hover:border-[#009900] transition-colors cursor-pointer group">
                  <input type="file" accept="image/*" onChange={(e) => { if (e.target.files.length > 0) setIdUploaded(true) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">🪪</div>
                  {idUploaded ? (
                    <p className="text-[#009900] font-bold text-lg">ID Uploaded Successfully ✓</p>
                  ) : (
                    <>
                      <p className="font-bold text-slate-800 text-lg mb-1">Tap to Upload ID</p>
                      <p className="text-xs font-medium text-slate-400">Passport, Driver's License, or National ID</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {onboardStep === 3 && (
              <div className="animate-fade-in-up">
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Link Payment Method</h3>
                <p className="text-slate-500 text-sm font-medium mb-6">Register a credit card to secure future bookings and prevent no-shows. No charges will be made now.</p>

                <div className="bg-white p-5 border border-slate-200 shadow-sm space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Name on Card</label>
                    <input type="text" name="cardName" autoComplete="cc-name" value={cardName} onChange={e => setCardName(e.target.value)} placeholder="John Doe" className="w-full p-4 border border-slate-300 text-sm font-semibold text-slate-800 focus:border-[#009900] outline-none shadow-sm rounded-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Card Number</label>
                    <input type="text" name="cardNumber" autoComplete="cc-number" value={cardNum} onChange={e => setCardNum(e.target.value)} placeholder="0000 0000 0000 0000" className="w-full p-4 border border-slate-300 text-sm font-semibold text-slate-800 focus:border-[#009900] outline-none shadow-sm rounded-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Expiry Date</label>
                      <input type="text" name="cardExpiry" autoComplete="cc-exp" value={cardExp} onChange={e => setCardExp(e.target.value)} placeholder="MM/YY" className="w-full p-4 border border-slate-300 text-sm font-semibold text-slate-800 focus:border-[#009900] outline-none shadow-sm rounded-none text-center" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">CVV</label>
                      <input type="password" name="cardCvc" autoComplete="cc-csc" maxLength="4" value={cardCvv} onChange={e => setCardCvv(e.target.value)} placeholder="•••" className="w-full p-4 border border-slate-300 text-sm font-semibold text-slate-800 focus:border-[#009900] outline-none shadow-sm rounded-none text-center" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 pt-4">
              <button onClick={nextStep} className="w-full bg-[#009900] hover:bg-[#008000] text-white py-4 font-bold text-base shadow-lg transition-transform active:scale-95 rounded-none">
                {onboardStep === 3 ? 'Complete Registration ✓' : 'Next Step ➔'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 💡 [NEW] 통합웹 회원가입/로그인 모달 (스크린샷 완벽 재현) */}
      {/* ========================================================= */}
      {showGuestAuthModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 animate-fade-in" onClick={() => setShowGuestAuthModal(false)}>
          <div className="bg-white w-full max-w-[400px] overflow-hidden transform transition-all border border-slate-200 shadow-2xl rounded-sm" onClick={e => e.stopPropagation()}>
            <div className="p-8 overflow-y-auto max-h-[90vh] custom-scrollbar">
              <div className="flex justify-end mb-2">
                <button onClick={() => setShowGuestAuthModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-light">&times;</button>
              </div>

              {guestAuthMode === 'REGISTER' ? (
                <>
                  {/* 구글 연동 로그인 버튼 */}
                  <button
                    type="button"
                    onClick={() => signIn('google')}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 text-slate-600 font-bold py-3 hover:bg-slate-50 transition-colors mb-6 shadow-sm text-sm"
                  >
                    {/* 💡 여기에 여는 svg 태그를 추가했습니다! */}
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                  </button>

                  <div className="flex items-center mb-6">
                    <div className="flex-1 border-t border-slate-200"></div>
                    <span className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">OR</span>
                    <div className="flex-1 border-t border-slate-200"></div>
                  </div>

                  <form onSubmit={handleGuestAuthSubmit} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Email Address</label>
                      <input type="email" required value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="w-full p-3 border border-slate-300 focus:border-blue-500 outline-none text-sm" placeholder="name@email.com" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">First Name</label>
                        <input type="text" required value={guestFirstName} onChange={(e) => setGuestFirstName(e.target.value)} className="w-full p-3 border border-slate-300 focus:border-blue-500 outline-none text-sm" placeholder="John" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Last Name</label>
                        <input type="text" required value={guestLastName} onChange={(e) => setGuestLastName(e.target.value)} className="w-full p-3 border border-slate-300 focus:border-blue-500 outline-none text-sm" placeholder="Doe" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Phone Number</label>
                      <input type="tel" required value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className="w-full p-3 border border-slate-300 focus:border-blue-500 outline-none text-sm" placeholder="09" />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Nationality</label>
                      <select required value={guestNationality} onChange={(e) => setGuestNationality(e.target.value)} className="w-full p-3 border border-slate-300 focus:border-blue-500 outline-none text-sm bg-white font-bold text-slate-700">
                        <option value="">Select Country...</option>
                        <option value="Philippines">Philippines</option>
                        <option value="South Korea">South Korea</option>
                        <option value="USA">United States</option>
                        <option value="Japan">Japan</option>
                        <option value="China">China</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Password</label>
                      <input type="password" required value={guestPw} onChange={(e) => setGuestPw(e.target.value)} className="w-full p-3 border border-slate-300 focus:border-blue-500 outline-none text-sm tracking-widest" placeholder="••••••••" />
                    </div>

                    <div className="pt-2">
                      <button type="submit" className="w-full bg-[#0f172a] text-white font-bold py-3.5 hover:bg-slate-800 transition-colors shadow-md text-sm">
                        Sign Up with Email
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                // 로그인 화면 
                <>
                  <h2 className="text-2xl font-black text-slate-800 mb-6">Log In</h2>
                  <form onSubmit={handleGuestAuthSubmit} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Email Address</label>
                      <input type="email" required value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="w-full p-3 border border-slate-300 focus:border-blue-500 outline-none text-sm" placeholder="name@email.com" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Password</label>
                      <input type="password" required value={guestPw} onChange={(e) => setGuestPw(e.target.value)} className="w-full p-3 border border-slate-300 focus:border-blue-500 outline-none text-sm tracking-widest" placeholder="••••••••" />
                    </div>
                    <div className="pt-2">
                      <button type="submit" className="w-full bg-[#0f172a] text-white font-bold py-3.5 hover:bg-slate-800 transition-colors shadow-md text-sm">
                        Log In
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* 하단 옵션 링크 영역 */}
              <div className="text-center pt-8 mt-8 border-t border-slate-100 space-y-3">
                {guestAuthMode === 'REGISTER' ? (
                  <div className="text-sm font-bold text-slate-500">
                    Already a member? <button type="button" onClick={() => setGuestAuthMode('LOGIN')} className="text-blue-600 hover:underline">Log in</button>
                  </div>
                ) : (
                  <div className="text-sm font-bold text-slate-500">
                    Don't have an account? <button type="button" onClick={() => setGuestAuthMode('REGISTER')} className="text-blue-600 hover:underline">Sign up</button>
                  </div>
                )}

                <div className="text-sm font-bold text-slate-500">
                  Not a member yet? <br />
                  <button type="button" onClick={() => {
                    setShowGuestAuthModal(false);
                    startOnboarding();
                  }} className="inline-flex items-center justify-center gap-1.5 text-slate-800 hover:underline mt-2 text-base">
                    <img src="/logo192.png" alt="n+" className="h-5 w-auto transform -translate-y-[1px]" />
                    Rewards join
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </main>
  );
}