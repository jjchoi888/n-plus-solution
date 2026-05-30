"use client";
import React, { useState, useEffect } from "react";
import RoomList from "./RoomList";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from "firebase/auth";
import { app, hasValidFirebaseConfig, firebaseInitError } from '../lib/firebase';
import MemberDashboard from "./MemberDashboard";

const BASE_URL = '';

const getHotelDate = (offsetDays = 0) => {
    const now = new Date();
    if (now.getHours() < 12) now.setDate(now.getDate() - 1);
    now.setDate(now.getDate() + offsetDays);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const PRIORITY_COUNTRIES = ['Philippines', 'South Korea', 'China', 'United States'];
const FALLBACK_COUNTRIES = [
    'Philippines', 'South Korea', 'China', 'United States', 'Japan', 'Singapore', 'Thailand', 'Vietnam',
    'Malaysia', 'Indonesia', 'India', 'Australia', 'Canada', 'United Kingdom', 'France', 'Germany', 'Spain',
    'Italy', 'Netherlands', 'United Arab Emirates', 'Saudi Arabia', 'Qatar'
];

const buildCountryOptions = () => {
    try {
        if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
            const dn = new Intl.DisplayNames(['en'], { type: 'region' });
            const names = Intl.supportedValuesOf('region')
                .map((code) => dn.of(code))
                .filter((name) => name && !/^\d+$/.test(name));
            const unique = [...new Set(names)].sort((a, b) => a.localeCompare(b));
            const pinned = [...PRIORITY_COUNTRIES];
            const rest = unique.filter((c) => !PRIORITY_COUNTRIES.includes(c));
            return [...pinned, ...rest];
        }
    } catch (e) {
        // Fallback list below
    }
    const unique = [...new Set(FALLBACK_COUNTRIES)].sort((a, b) => a.localeCompare(b));
    const pinned = [...PRIORITY_COUNTRIES];
    const rest = unique.filter((c) => !PRIORITY_COUNTRIES.includes(c));
    return [...pinned, ...rest];
};

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

// 💡 [핵심] 번역 사전에 모든 알림 메시지와 로그인 UI 텍스트를 추가했습니다.
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
        bookingSummary: 'Booking Summary', promoCode: 'Promo Code', apply: 'Apply', total: 'Total', confirmBook: 'Proceed to Payment ➔', processing: 'Processing...',

        // --- 신규 추가된 시스템 알림 및 Auth 번역 ---
        selectValidDates: "Please select valid dates.",
        checkoutAfterCheckin: "Check-out must be after check-in.",
        notEnoughRooms: "Not enough rooms available.",
        invalidPromo: "Invalid or expired promo code.",
        promoRoomOnly: "This code is only valid for: ",
        promoApplied: "🎉 Promo applied successfully! You get ",
        promoOff: "% OFF!",
        fillRequired: "Please fill in all required details.",
        bookingConfirmed: "✅ Booking Confirmed!\nEmail and receipt have been sent.",
        bookingFailed: "❌ Failed: ",
        bookingApiError: "Booking API Error",
        serverError: "Error connecting to the server.",
        promoAuto1: "🎁 Promo [ ",
        promoAuto2: " ] has been applied automatically!\nPlease select your check-in/check-out dates below to proceed.",
        promoCopied1: "🎁 Promo code '",
        promoCopied2: "' has been copied!\nPlease select your dates and room, then apply it at checkout.",
        guestNameMissing: "Please enter the guest's First and Last Name.", // 💡 추가됨

        loginTo: "Log In to ",
        continueGoogle: "Continue with Google",
        or: "OR",
        forgotPw: "Forgot Password?",
        loginBtn: "Log In",
        createAccount: "Create Account",
        signUpBtn: "Sign Up",
        resetPw: "Reset Password",
        resetDesc: "Enter your registered email address to receive a reset link.",
        regEmail: "Registered Email",
        sendReset: "Send Reset Link",
        backLogin: "Back to Login",
        noAccount: "Don't have an account? ",
        signUpLink: "Sign up",
        hasAccount: "Already a member? ",
        loginLink: "Log in",
        logoutMsg: "You have been logged out.",
        welcomeBack: "Welcome back!",
        welcomeNew: "Welcome to our hotel!",
        authFailed: "Authentication failed.",
        googleFailed: "Google Login failed.",
        resetSent: "A password reset link has been sent if the email exists.",
        myPageBtn: "My Page",
        loginSignUpBtn: "Log In / Sign Up",
        logoutBtn: "Logout"
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
        bookingSummary: '예약 요약', promoCode: '프로모션 코드', apply: '적용', total: '총 결제 금액', confirmBook: '결제 진행하기 ➔', processing: '처리 중...',

        selectValidDates: "체크인과 체크아웃 날짜를 선택해주세요.",
        checkoutAfterCheckin: "체크아웃은 체크인 날짜 이후여야 합니다.",
        notEnoughRooms: "예약 가능한 객실이 부족합니다.",
        invalidPromo: "존재하지 않거나 만료된 코드입니다.",
        promoRoomOnly: "이 코드는 다음 객실에만 적용됩니다: ",
        promoApplied: "🎉 프로모션이 적용되었습니다! ",
        promoOff: "% 할인 혜택!",
        fillRequired: "모든 필수 입력란을 채워주세요.",
        bookingConfirmed: "✅ 예약이 확정되었습니다!\n입력하신 이메일로 영수증과 확정서가 발송되었습니다.",
        bookingFailed: "❌ 실패: ",
        bookingApiError: "예약 서버 오류",
        serverError: "서버 연결에 실패했습니다.",
        promoAuto1: "🎁 [ ",
        promoAuto2: " ] 프로모션 혜택이 자동 적용되었습니다!\n아래 화면에서 원하시는 '체크인/체크아웃 날짜'를 선택하고 예약을 진행해 주세요.",
        promoCopied1: "🎁 '",
        promoCopied2: "' 코드가 복사되었습니다!\n원하시는 날짜와 객실을 선택 후 결제창에서 적용(Apply)을 눌러주세요.",
        guestNameMissing: "투숙객의 영문 이름과 성을 모두 입력해 주세요.", // 💡 추가됨

        loginTo: "로그인 - ",
        continueGoogle: "Google로 계속하기",
        or: "또는",
        forgotPw: "비밀번호 찾기",
        loginBtn: "로그인",
        createAccount: "회원가입",
        signUpBtn: "가입하기",
        resetPw: "비밀번호 재설정",
        resetDesc: "가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.",
        regEmail: "가입된 이메일",
        sendReset: "재설정 링크 보내기",
        backLogin: "로그인으로 돌아가기",
        noAccount: "계정이 없으신가요? ",
        signUpLink: "회원가입",
        hasAccount: "이미 회원이신가요? ",
        loginLink: "로그인",
        logoutMsg: "로그아웃 되었습니다.",
        welcomeBack: "다시 오신 것을 환영합니다!",
        welcomeNew: "저희 호텔에 오신 것을 환영합니다!",
        authFailed: "인증에 실패했습니다.",
        googleFailed: "구글 로그인에 실패했습니다.",
        resetSent: "등록된 이메일이 맞다면 비밀번호 재설정 링크가 발송되었습니다.",
        myPageBtn: "마이페이지",
        loginSignUpBtn: "로그인 / 회원가입",
        logoutBtn: "로그아웃"
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
        bookingSummary: '预订摘要', promoCode: '优惠码', apply: '应用', total: '总计', confirmBook: '前往支付 ➔', processing: '处理中...',

        selectValidDates: "请选择有效的日期。",
        checkoutAfterCheckin: "退房日期必须在入住日期之后。",
        notEnoughRooms: "可用客房不足。",
        invalidPromo: "优惠码无效或已过期。",
        promoRoomOnly: "此代码仅适用于：",
        promoApplied: "🎉 优惠码已成功应用！您将享受 ",
        promoOff: "% 的折扣！",
        fillRequired: "请填写所有必填信息。",
        bookingConfirmed: "✅ 预订已确认！\n电子邮件和收据已发送。",
        bookingFailed: "❌ 失败：",
        bookingApiError: "预订 API 错误",
        serverError: "连接服务器错误。",
        promoAuto1: "🎁 优惠码 [ ",
        promoAuto2: " ] 已自动应用！\n请在下方选择您的入住/退房日期以继续。",
        promoCopied1: "🎁 优惠码 '",
        promoCopied2: "' 已复制！\n请选择您的日期和客房，然后在结账时应用它。",
        guestNameMissing: "请输入入住客人的姓氏和名字。", // 💡 追加

        loginTo: "登录到 ",
        continueGoogle: "使用 Google 继续",
        or: "或",
        forgotPw: "忘记密码？",
        loginBtn: "登录",
        createAccount: "创建账户",
        signUpBtn: "注册",
        resetPw: "重置密码",
        resetDesc: "输入您注册的电子邮件地址以接收重置链接。",
        regEmail: "注册邮箱",
        sendReset: "发送重置链接",
        backLogin: "返回登录",
        noAccount: "没有账户？",
        signUpLink: "注册",
        hasAccount: "已经是会员？",
        loginLink: "登录",
        logoutMsg: "您已成功注销。",
        welcomeBack: "欢迎回来！",
        welcomeNew: "欢迎来到我们的酒店！",
        authFailed: "认证失败。",
        googleFailed: "Google 登录失败。",
        resetSent: "如果邮箱存在，密码重置链接已发送。",
        myPageBtn: "我的主页",
        loginSignUpBtn: "登录 / 注册",
        logoutBtn: "注销"
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
        bookingSummary: '予約の概要', promoCode: 'プロモコード', apply: '適用', total: '合計', confirmBook: '支払いへ進む ➔', processing: '処理中...',

        selectValidDates: "有効な日付を選択してください。",
        checkoutAfterCheckin: "チェックアウトはチェックインの日付より後にする必要があります。",
        notEnoughRooms: "利用可能な客室が不足しています。",
        invalidPromo: "無効または期限切れのプロモコードです。",
        promoRoomOnly: "このコードは以下の客室にのみ適用されます: ",
        promoApplied: "🎉 プロモコードが正常に適用されました！ ",
        promoOff: "% オフになります！",
        fillRequired: "すべての必須項目を入力してください。",
        bookingConfirmed: "✅ 予約が確定しました！\nメールと領収書が送信されました。",
        bookingFailed: "❌ 失敗: ",
        bookingApiError: "予約 API エラー",
        serverError: "サーバーへの接続エラー。",
        promoAuto1: "🎁 プロモコード [ ",
        promoAuto2: " ] が自動的に適用されました！\nチェックイン/チェックアウトの日付を選択して続行してください。",
        promoCopied1: "🎁 プロモコード '",
        promoCopied2: "' をコピーしました！\n日付と客室を選択し、お支払い画面で適用してください。",
        guestNameMissing: "宿泊者の名と姓を入力してください。", // 💡 追加

        loginTo: "ログイン - ",
        continueGoogle: "Googleで続行",
        or: "または",
        forgotPw: "パスワードをお忘れですか？",
        loginBtn: "ログイン",
        createAccount: "アカウント作成",
        signUpBtn: "登録",
        resetPw: "パスワードのリセット",
        resetDesc: "登録したメールアドレスを入力して、リセットリンクを受け取ってください。",
        regEmail: "登録メールアドレス",
        sendReset: "リセットリンクを送信",
        backLogin: "ログインに戻る",
        noAccount: "アカウントをお持ちでないですか？",
        signUpLink: "登録する",
        hasAccount: "すでに会員ですか？",
        loginLink: "ログイン",
        logoutMsg: "ログアウトしました。",
        welcomeBack: "お帰りなさい！",
        welcomeNew: "当ホテルへようこそ！",
        authFailed: "認証に失敗しました。",
        googleFailed: "Googleログインに失敗しました。",
        resetSent: "メールアドレスが存在する場合、パスワードリセットリンクが送信されました。",
        myPageBtn: "マイページ",
        loginSignUpBtn: "ログイン / 登録",
        logoutBtn: "ログアウト"
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
    const [hasSearched, setHasSearched] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [rewardPopup, setRewardPopup] = useState(null);
    const [hideRewardPopupToday, setHideRewardPopupToday] = useState(false);

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [nationality, setNationality] = useState('Philippines');
    const [guestRegion, setGuestRegion] = useState('');
    const [guestDob, setGuestDob] = useState('');
    const [guestDocumentUrl, setGuestDocumentUrl] = useState('');
    const [extraBed, setExtraBed] = useState(0);

    const [promoCode, setPromoCode] = useState('');
    const [isBooking, setIsBooking] = useState(false);

    const [availableCount, setAvailableCount] = useState(null);
    const [showPromoModal, setShowPromoModal] = useState(false);
    const [activePromos, setActivePromos] = useState([]);
    const [selectedPromo, setSelectedPromo] = useState(null);
    const [appliedPromo, setAppliedPromo] = useState(null);

    const [showBookingSuccessModal, setShowBookingSuccessModal] = useState(false);
    const [modalResId, setModalResId] = useState('');

    const [user, setUser] = useState(null);
    const [showGuestAuthModal, setShowGuestAuthModal] = useState(false);
    const [guestAuthMode, setGuestAuthMode] = useState('LOGIN'); // LOGIN, REGISTER, FORGOT_PASSWORD
    const [authForm, setAuthForm] = useState({ email: '', pw: '', pwConfirm: '', first: '', last: '', phone: '', nationality: '', referralCode: '' });
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showRegisterPassword, setShowRegisterPassword] = useState(false);
    const [showRegisterPasswordConfirm, setShowRegisterPasswordConfirm] = useState(false);
    const [googlePendingProfile, setGooglePendingProfile] = useState(null);
    const [countryOptions] = useState(buildCountryOptions);
    const [showAuthCountryMenu, setShowAuthCountryMenu] = useState(false);
    const [memberRewardsSnapshot, setMemberRewardsSnapshot] = useState({
        enabled: false,
        points: 0,
        config: null
    });
    const [pendingPosRewardToken, setPendingPosRewardToken] = useState('');
    const [redeemPointsInput, setRedeemPointsInput] = useState('');
    const [appliedRedeemPoints, setAppliedRedeemPoints] = useState(0);
    const [appliedRedeemAmount, setAppliedRedeemAmount] = useState(0);

    const t = translations[lang] || translations.en; // 💡 렌더링 최상단에서 t 변수 초기화
    const hotelCode = getEffectiveHotelCode();

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search || '');
        const referralFromLink = String(
            params.get('ref') || params.get('referral') || params.get('referral_code') || ''
        ).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const posRewardToken = String(
            params.get('pos_reward_token') || params.get('reward_payment_token') || ''
        ).trim();
        const savedUser = localStorage.getItem('nplus_guest_user');

        if (referralFromLink) {
            try { localStorage.setItem('nplus_pending_referral_code', referralFromLink); } catch (_) { }
            setAuthForm((prev) => ({ ...prev, referralCode: prev.referralCode || referralFromLink }));
            if (!savedUser) {
                setGuestAuthMode('REGISTER');
                setShowGuestAuthModal(true);
            }
        }

        if (posRewardToken) {
            setPendingPosRewardToken(posRewardToken);
            setActiveMenu('MYPAGE');
            if (!savedUser) {
                setGuestAuthMode('LOGIN');
                setShowGuestAuthModal(true);
            }
        }
    }, []);

    // 로그인/가입/로그아웃 핸들러
    useEffect(() => {
        const savedUser = localStorage.getItem('nplus_guest_user');
        if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);
            setFirstName(parsedUser.first_name || '');
            setLastName(parsedUser.last_name || '');
            setGuestEmail(parsedUser.email || '');
            setGuestPhone(parsedUser.phone || '');
            setNationality(parsedUser.nationality || 'Philippines');
            setGuestRegion(parsedUser.region || '');
            setGuestDob(parsedUser.dob || '');
            setGuestDocumentUrl(parsedUser.document_url || '');
        }
    }, []);

    useEffect(() => {
        const loadMemberRewards = async () => {
            if (!user?.email || !hotelCode) {
                setMemberRewardsSnapshot({ enabled: false, points: 0, config: null });
                return;
            }
            try {
                const res = await fetch(`/api/members/rewards?email=${encodeURIComponent(user.email)}&hotel_code=${encodeURIComponent(hotelCode)}`);
                const data = await res.json().catch(() => ({}));
                if (res.ok && data?.success) {
                    setMemberRewardsSnapshot({
                        enabled: !!data.rewards_enabled,
                        points: Number(data.points || 0),
                        config: data.config || null
                    });
                } else {
                    setMemberRewardsSnapshot({ enabled: false, points: 0, config: null });
                }
            } catch (_) {
                setMemberRewardsSnapshot({ enabled: false, points: 0, config: null });
            }
        };
        loadMemberRewards();
    }, [user?.email, hotelCode]);

    const finalizeGoogleMember = async (gUser) => {
        if (!gUser?.email) {
            setAlertMessage("❌ " + t.googleFailed);
            return;
        }

        const profileRes = await fetch(`/api/members/profile?email=${encodeURIComponent(gUser.email || '')}&hotel_code=${encodeURIComponent(hotelCode || '')}`);
        const profileData = await profileRes.json().catch(() => ({}));
        const existingUser = profileData?.member;
        const hasRequiredProfile = Boolean(
            existingUser?.first_name &&
            existingUser?.last_name &&
            existingUser?.email &&
            existingUser?.phone &&
            existingUser?.nationality
        );

        if (profileData?.success && existingUser && hasRequiredProfile) {
            localStorage.setItem('nplus_guest_user', JSON.stringify(existingUser));
            setUser(existingUser);
            setShowGuestAuthModal(false);
            setAlertMessage(t.welcomeBack);
            setFirstName(existingUser.first_name || '');
            setLastName(existingUser.last_name || '');
            setGuestEmail(existingUser.email || '');
            setGuestPhone(existingUser.phone || '');
            setNationality(existingUser.nationality || 'Philippines');
            setGuestRegion(existingUser.region || '');
            setGuestDob(existingUser.dob || '');
            setGuestDocumentUrl(existingUser.document_url || '');
            return;
        }

        const displayNameParts = (gUser.displayName || '').trim().split(/\s+/).filter(Boolean);
        setGooglePendingProfile(gUser);
        setAuthForm({
            email: gUser.email || '',
            pw: '',
            pwConfirm: '',
            first: existingUser?.first_name || displayNameParts[0] || '',
            last: existingUser?.last_name || displayNameParts.slice(1).join(' ') || '',
            phone: existingUser?.phone || gUser.phoneNumber || '',
            nationality: existingUser?.nationality || '',
            referralCode: ''
        });
        setGuestAuthMode('GOOGLE_COMPLETE');
    };

    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        if (guestAuthMode === 'REGISTER' && authForm.pw !== authForm.pwConfirm) {
            setAlertMessage("❌ Password confirmation does not match.");
            return;
        }

        try {
            const isRegisterAttempt = guestAuthMode === 'REGISTER';
            const payload = isRegisterAttempt
                ? {
                    auth_mode: 'register',
                    hotel_code: hotelCode,
                    email: authForm.email,
                    pin: authForm.pw,
                    first_name: authForm.first,
                    last_name: authForm.last,
                    phone: authForm.phone,
                    nationality: authForm.nationality || 'Philippines',
                    referral_code: authForm.referralCode || '',
                    membership_status: 'active'
                }
                : {
                    auth_mode: 'login',
                    hotel_code: hotelCode,
                    email: authForm.email,
                    pin: authForm.pw
                };

            const res = await fetch('/api/members/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                const freshUser = data.member || { ...payload, name: `${payload.first_name} ${payload.last_name}`.trim() };
                localStorage.setItem('nplus_guest_user', JSON.stringify(freshUser));
                setUser(freshUser);
                setShowGuestAuthModal(false);
                setAlertMessage(guestAuthMode === 'REGISTER' ? t.welcomeNew : t.welcomeBack);
                setFirstName(freshUser.first_name || '');
                setLastName(freshUser.last_name || '');
                setGuestEmail(freshUser.email || '');
                setGuestPhone(freshUser.phone || '');
                setNationality(freshUser.nationality || 'Philippines');
                setGuestRegion(freshUser.region || '');
                setGuestDob(freshUser.dob || '');
                setGuestDocumentUrl(freshUser.document_url || '');
                setAuthForm({ email: '', pw: '', pwConfirm: '', first: '', last: '', phone: '', nationality: '', referralCode: '' });
            } else {
                setAlertMessage("❌ " + (data.message || t.authFailed));
            }
        } catch (err) {
            setAlertMessage("🚨 " + t.serverError);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            if (!app || !hasValidFirebaseConfig) {
                throw new Error(firebaseInitError || 'Firebase is not configured.');
            }
            const auth = getAuth(app);
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            await finalizeGoogleMember(result.user);
        } catch (error) {
            console.error("Google Popup Error:", error);
            const code = String(error?.code || '');
            if (code.includes('popup-blocked') || code.includes('popup-closed-by-user')) {
                try {
                    await signInWithRedirect(auth, provider);
                    return;
                } catch (redirectErr) {
                    console.error("Google Redirect Error:", redirectErr);
                }
            }
            if (code.includes('unauthorized-domain')) {
                setAlertMessage("❌ Google auth domain is not authorized. Please register this domain in Firebase Authentication settings.");
                return;
            }
            const rawMsg = String(error?.message || '');
            if (rawMsg.toLowerCase().includes('firebase config is missing') || rawMsg.toLowerCase().includes('invalid-api-key')) {
                setAlertMessage("❌ Google login is temporarily unavailable on this domain. Please use email login for now.");
                return;
            }
            setAlertMessage("❌ " + (error?.message || t.googleFailed));
        }
    };

    useEffect(() => {
        if (!app || !hasValidFirebaseConfig) return;
        try {
            const auth = getAuth(app);
            getRedirectResult(auth)
                .then(async (result) => {
                    if (result?.user) {
                        await finalizeGoogleMember(result.user);
                    }
                })
                .catch((err) => {
                    console.error("Google Redirect Result Error:", err);
                    if (err?.code) setAlertMessage("❌ " + (err.message || t.googleFailed));
                });
        } catch (err) {
            console.error("Google Auth Init Error:", err);
        }
    }, []);

    const handleGoogleProfileComplete = async (e) => {
        e.preventDefault();
        if (!googlePendingProfile?.email) {
            setAlertMessage("❌ " + t.googleFailed);
            return;
        }
        if (!authForm.first || !authForm.last || !authForm.email || !authForm.phone || !authForm.nationality) {
            setAlertMessage("❌ " + t.fillRequired);
            return;
        }

        try {
            const pseudoPin = `google_${(googlePendingProfile.uid || 'guest').slice(-10)}`;
            const response = await fetch('/api/members/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hotel_code: hotelCode,
                    email: authForm.email,
                    pin: pseudoPin,
                    first_name: authForm.first,
                    last_name: authForm.last,
                    phone: authForm.phone,
                    nationality: authForm.nationality,
                    referral_code: authForm.referralCode || '',
                    membership_status: 'active'
                })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok && response.status !== 409) {
                setAlertMessage("❌ " + (data?.message || t.authFailed));
                return;
            }

            const profileRes = await fetch(`/api/members/profile?email=${encodeURIComponent(authForm.email)}&hotel_code=${encodeURIComponent(hotelCode || '')}`);
            const profileData = await profileRes.json().catch(() => ({}));
            const finalUser = profileData?.member || data?.member || {
                first_name: authForm.first,
                last_name: authForm.last,
                email: authForm.email,
                phone: authForm.phone,
                nationality: authForm.nationality,
                membership_status: 'active'
            };

            localStorage.setItem('nplus_guest_user', JSON.stringify(finalUser));
            setUser(finalUser);
            setShowGuestAuthModal(false);
            setAlertMessage(t.welcomeNew);
            setFirstName(finalUser.first_name || '');
            setLastName(finalUser.last_name || '');
            setGuestEmail(finalUser.email || '');
            setGuestPhone(finalUser.phone || '');
            setNationality(finalUser.nationality || 'Philippines');
            setGuestRegion(finalUser.region || '');
            setGuestDob(finalUser.dob || '');
            setGuestDocumentUrl(finalUser.document_url || '');
            setAuthForm({ email: '', pw: '', pwConfirm: '', first: '', last: '', phone: '', nationality: '', referralCode: '' });
            setGooglePendingProfile(null);
            setGuestAuthMode('LOGIN');
        } catch (err) {
            setAlertMessage("🚨 " + t.serverError);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('nplus_guest_user');
        setUser(null);
        setAlertMessage(t.logoutMsg);
        setActiveMenu('HOME');
    };

    function getEffectiveHotelCode() {
        if (typeof window === 'undefined') return 'sample001';

        const params = new URLSearchParams(window.location.search);
        const hotelParam = params.get('hotel');

        if (hotelParam) return hotelParam;

        const hostname = window.location.hostname;

        if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
            return 'sample001';
        }

        const domainMap = {
            'grandhotel.com': 'grand_001',
            'www.grandhotel.com': 'grand_001',
            'oceanview.ph': 'ocean_v',
            'hotel-n-plus.vercel.app': 'sample001'
        };

        if (domainMap[hostname]) return domainMap[hostname];

        if (hostname.includes('hotelnplus.com')) {
            const parts = hostname.split('.');
            const subdomain = parts[0].toLowerCase();
            const systemReserved = ['app', 'manage', 'hq', 'www', 'api'];

            if (!systemReserved.includes(subdomain)) {
                return subdomain;
            }
        }

        return 'sample001';
    }

    const renderRewardBenefitIcon = (iconKey) => {
        const baseClass = "w-5 h-5 text-white";
        if (iconKey === 'gift') {
            return (
                <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="8" width="18" height="13" rx="2"></rect>
                    <path d="M12 8v13"></path>
                    <path d="M3 12h18"></path>
                    <path d="M7.5 8a2.5 2.5 0 1 1 0-5c2.4 0 4.5 2.6 4.5 5"></path>
                    <path d="M16.5 8a2.5 2.5 0 1 0 0-5c-2.4 0-4.5 2.6-4.5 5"></path>
                </svg>
            );
        }
        if (iconKey === 'star') {
            return (
                <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18l-5.8 3.1 1.1-6.5L2.6 9.8l6.5-.9L12 3z"></path>
                </svg>
            );
        }
        if (iconKey === 'moon') {
            return (
                <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8z"></path>
                </svg>
            );
        }
        return (
            <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20"></path>
                <path d="M2 12h20"></path>
            </svg>
        );
    };

    const getRewardPopupTheme = (themeKey) => {
        const key = String(themeKey || 'CORPORATE_LIGHT').toUpperCase();
        const themes = {
            CORPORATE_LIGHT: {
                panel: 'bg-white border border-slate-200 shadow-2xl',
                header: 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white',
                body: 'bg-slate-50 border-b border-slate-100',
                bodyText: 'text-slate-700',
                card: 'bg-white border border-slate-200',
                iconWrap: 'bg-orange-500',
                titleText: 'text-slate-800',
                summaryText: 'text-slate-600',
                footer: 'bg-slate-50 border-t border-slate-100',
                laterBtn: 'border border-slate-300 text-slate-700',
                ctaBtn: 'bg-slate-900 hover:bg-slate-800 text-white'
            },
            LUXE_GLASS: {
                panel: 'bg-slate-900/70 border border-white/20 backdrop-blur-2xl shadow-2xl',
                header: 'bg-gradient-to-r from-emerald-700/80 via-teal-700/80 to-slate-900/80 text-white',
                body: 'bg-transparent border-b border-white/15',
                bodyText: 'text-slate-100',
                card: 'bg-white/10 border border-white/20',
                iconWrap: 'bg-white/20',
                titleText: 'text-white',
                summaryText: 'text-slate-200',
                footer: 'bg-white/5 border-t border-white/15',
                laterBtn: 'border border-white/30 text-white/90',
                ctaBtn: 'bg-emerald-500 hover:bg-emerald-600 text-white'
            },
            MODERN_LILAC: {
                panel: 'bg-[#F1ECFF] border border-[#DDD0FF] shadow-2xl',
                header: 'bg-gradient-to-r from-[#5A48CC] via-[#6E56D6] to-[#8E7AE8] text-white',
                body: 'bg-[#EFE8FF] border-b border-[#DDD0FF]',
                bodyText: 'text-[#2F2B5A]',
                card: 'bg-white/80 border border-[#D7C9FF]',
                iconWrap: 'bg-[#6B56DA]',
                titleText: 'text-[#241F4D]',
                summaryText: 'text-[#4A4475]',
                footer: 'bg-[#EFE8FF] border-t border-[#DDD0FF]',
                laterBtn: 'border border-[#B9A8F5] text-[#3A3270]',
                ctaBtn: 'bg-[#3F35A8] hover:bg-[#342A97] text-white'
            }
        };
        return themes[key] || themes.CORPORATE_LIGHT;
    };

    useEffect(() => {
        const fetchRewardsPopup = async () => {
            // `user` starts as an empty object before guest state hydrates.
            // Only hide the rewards popup for an authenticated member.
            if (user?.email) {
                setRewardPopup(null);
                return;
            }
            try {
                const res = await fetch(`/api/public/rewards-config?hotel_code=${encodeURIComponent(hotelCode)}`);
                const data = await res.json().catch(() => ({}));
                if (!data?.success || !data?.popup?.enabled) return;

                const rewardConfig = data.config || {};
                const frequency = String(data.popup.frequency || 'ONCE_PER_SESSION').toUpperCase();
                const sessionKey = `rewards_popup_session_${hotelCode}`;
                const dailyKey = `rewards_popup_daily_${hotelCode}`;
                const hideTodayKey = 'rewards_popup_hide_today_' + hotelCode;
                const todayKey = new Date().toISOString().slice(0, 10);
                const popupSignature = JSON.stringify({
                    hotelCode,
                    title: data.popup.title || 'Rewards Program',
                    message: data.popup.message || 'Join our rewards program and earn points.',
                    ctaLabel: data.popup.cta_label || 'View Rewards',
                    ctaTarget: data.popup.cta_target || 'MYPAGE_REWARDS',
                    theme: data.popup.theme || rewardConfig.popup_theme || 'CORPORATE_LIGHT',
                    welcome: Number(rewardConfig.welcome_bonus_points || 0),
                    stay: Number(rewardConfig.points_per_stay || 0),
                    birthday: Number(rewardConfig.birthday_bonus_points || 0),
                    tierEnabled: Boolean(rewardConfig.tier_enabled)
                });

                if (frequency === 'ONCE_PER_SESSION' && sessionStorage.getItem(sessionKey) === popupSignature) return;
                if (frequency === 'ONCE_PER_DAY' && localStorage.getItem(dailyKey) === `${todayKey}::${popupSignature}`) return;
                if (localStorage.getItem(hideTodayKey) === `${todayKey}::${popupSignature}`) return;
                const popupBenefits = [
                    {
                        icon: 'gift',
                        title: 'Welcome Bonus',
                        summary: `${Number(rewardConfig.welcome_bonus_points || 0).toLocaleString()} points on join`
                    },
                    {
                        icon: 'star',
                        title: 'Stay Rewards',
                        summary: `${Number(rewardConfig.points_per_stay || 0).toLocaleString()} points per stay`
                    },
                    {
                        icon: 'moon',
                        title: 'Birthday Benefit',
                        summary: `${Number(rewardConfig.birthday_bonus_points || 0).toLocaleString()} bonus points`
                    },
                    {
                        icon: 'star',
                        title: 'Tier Perks',
                        summary: rewardConfig.tier_enabled
                            ? `Upgrades and member-only benefits`
                            : `Flexible member discounts`
                    }
                ];

                setHideRewardPopupToday(false);
                setRewardPopup({
                    title: data.popup.title || 'Rewards Program',
                    message: data.popup.message || 'Join our rewards program and earn points.',
                    ctaLabel: data.popup.cta_label || 'View Rewards',
                    ctaTarget: data.popup.cta_target || 'MYPAGE_REWARDS',
                    theme: data.popup.theme || rewardConfig.popup_theme || 'CORPORATE_LIGHT',
                    frequency,
                    benefits: popupBenefits,
                    signature: popupSignature
                });
            } catch (e) {
                console.error('Rewards popup fetch failed', e);
            }
        };

        fetchRewardsPopup();
    }, [hotelCode, user]);

    const dismissRewardPopup = () => {
        if (typeof window !== 'undefined' && rewardPopup?.signature) {
            const todayKey = new Date().toISOString().slice(0, 10);
            const sessionKey = `rewards_popup_session_${hotelCode}`;
            const dailyKey = `rewards_popup_daily_${hotelCode}`;
            if (rewardPopup?.frequency === 'ONCE_PER_SESSION') {
                sessionStorage.setItem(sessionKey, rewardPopup.signature);
            }
            if (rewardPopup?.frequency === 'ONCE_PER_DAY') {
                localStorage.setItem(dailyKey, `${todayKey}::${rewardPopup.signature}`);
            }
        }
        if (hideRewardPopupToday && typeof window !== 'undefined') {
            localStorage.setItem(
                'rewards_popup_hide_today_' + hotelCode,
                `${new Date().toISOString().slice(0, 10)}::${rewardPopup?.signature || ''}`
            );
        }
        setRewardPopup(null);
        setHideRewardPopupToday(false);
    };

    useEffect(() => {
        const fetchLivePromotions = async () => {
            try {
                const res = await fetch(`/api/promotions?hotel=${hotelCode}`);
                const data = await res.json();

                if (Array.isArray(data)) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const validPromos = data.filter(p => p.is_active === 1 && (!p.end_date || new Date(p.end_date) >= today));
                    setActivePromos(validPromos);
                }
            } catch (e) { console.error("Live promo fetch failed", e); }
        };

        fetchLivePromotions();
    }, [hotelCode, user]);

    useEffect(() => {
        if (!showBookingModal) {
            setRedeemPointsInput('');
            setAppliedRedeemPoints(0);
            setAppliedRedeemAmount(0);
        }
    }, [showBookingModal]);

    useEffect(() => {
        setLoading(true);

        fetch(`${BASE_URL}/api/settings/website?hotel=${hotelCode}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.success && data.config) {
                    setConfig(data.config);
                }
            })
            .catch(err => console.error("Failed to load config", err));

        fetch(`${BASE_URL}/api/admin/room-types?hotel=${hotelCode}`)
            .then(r => r.json())
            .then(adminData => {
                if (adminData.success && adminData.rooms) {
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
                    if (formattedRooms.length > 0) setSelectedRoomId(formattedRooms[0].id);
                }
            })
            .catch(err => console.error("Failed to load room types", err))
            .finally(() => setLoading(false));

    }, [hotelCode, user]);

    // 💡 [수정] 결제 완료 후 돌아왔을 때 알림 문구 대신 모달창 띄우기
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const paymentStatus = params.get('payment');
            const resIds = params.get('res_ids');

            if (paymentStatus === 'success') {
                const invoice = params.get('invoice') || '';
                const resIdList = String(resIds || '').split(',').map(id => id.trim()).filter(Boolean);

                if (resIdList.length > 0 && hotelCode) {
                    fetch(`${BASE_URL}/api/public/reservations/confirm-paid-return`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ res_ids: resIdList, hotel_code: hotelCode, invoice })
                    }).catch(err => console.error('Payment return confirmation failed:', err));
                }

                // 1. 성공 모달창 활성화 및 예약 번호 저장
                setModalResId(resIds || '');
                setShowBookingSuccessModal(true);

                // 2. 기존 결제창 모달 및 상태 초기화
                setShowBookingModal(false);
                setIsBooking(false);

                // 3. URL 파라미터 제거 (새로고침 시 중복 알림 방지)
                const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?hotel=${hotelCode}`;
                window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
            }
            else if (paymentStatus === 'cancel') {
                // 취소 알림 (영어)
                setAlertMessage("❌ Payment was cancelled. Please try again.");
                setShowBookingModal(false);
                setIsBooking(false);

                const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?hotel=${hotelCode}`;
                window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
            }
        }
    }, [hotelCode, user]);

    useEffect(() => {
        if (typeof window !== 'undefined' && activePromos.length > 0 && rooms.length > 0) {
            const params = new URLSearchParams(window.location.search);
            const promoParam = params.get('promo');
            const roomTypeParam = params.get('roomType');
            // 💡 통합웹에서 보낸 '자동 적용' 신호를 잡습니다.
            const autoApplyParam = params.get('autoApply');

            if (promoParam) {
                const promoObj = activePromos.find(p => p.code.toUpperCase() === promoParam.toUpperCase());

                if (promoObj) {
                    if (roomTypeParam) {
                        const targetRoom = rooms.find(r => r.name.toLowerCase() === roomTypeParam.toLowerCase());
                        if (targetRoom) setSelectedRoomId(targetRoom.id);
                    }

                    setPromoCode(promoObj.code);

                    // 💡 [핵심 혁신 2] 통합웹에서 온 손님이거나 autoApply 신호가 있으면 귀찮은 'Apply' 버튼 없이 즉시 장착!
                    if (autoApplyParam === 'true') {
                        setAppliedPromo(promoObj);
                    }

                    setActiveMenu('ROOMS');

                    // 💡 [변경] 고객을 안심시키는 세련된 알림창
                    const msg = lang === 'ko'
                        ? `🎁 [ ${promoObj.code} ] 프로모션 혜택이 자동 적용되었습니다!\n화면에는 해당 프로모션이 가능한 객실만 표시됩니다.`
                        : `🎁 Promo [ ${promoObj.code} ] is now ACTIVE!\nWe've filtered the eligible rooms. The discount is automatically applied at checkout!`;

                    setAlertMessage(msg);

                    setTimeout(() => {
                        window.scrollTo({ top: 300, behavior: 'smooth' });
                    }, 300);

                    // URL 깔끔하게 청소
                    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?hotel=${hotelCode}`;
                    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
                }
            }
        }
    }, [activePromos, rooms, hotelCode, lang]);

    const safeConfig = config || {};
    let gallery = []; try { gallery = JSON.parse(safeConfig.gallery_json || '[]'); } catch (e) { }
    let sns = {}; try { if (safeConfig.sns_json) { sns = typeof safeConfig.sns_json === 'string' ? JSON.parse(safeConfig.sns_json) : safeConfig.sns_json; if (typeof sns === 'string') sns = JSON.parse(sns); } } catch (e) { }
    let facilities = []; try { facilities = JSON.parse(safeConfig.facilities_json || '[]'); } catch (e) { }
    let attractions = []; try { attractions = JSON.parse(safeConfig.attractions_json || '[]'); } catch (e) { }

    let textPos = { title: { x: 50, y: 40 }, subtitle: { x: 50, y: 55 } };
    try {
        if (safeConfig.welcome_text_pos) {
            const raw = JSON.parse(safeConfig.welcome_text_pos);
            if (raw.title && raw.subtitle) textPos = raw;
            else textPos = { title: { x: raw.x || 50, y: Math.max(0, (raw.y || 50) - 10) }, subtitle: { x: raw.x || 50, y: Math.min(100, (raw.y || 50) + 10) } };
        }
    } catch (e) { }

    const themeColor = safeConfig.theme_color?.startsWith('#') ? safeConfig.theme_color : '#2563eb';
    const themeFont = safeConfig.theme_font || 'Inter';

    const sliderImages = [];
    if (gallery.length > 0) sliderImages.push(...gallery);
    else if (safeConfig.bg_image_url) sliderImages.push(safeConfig.bg_image_url);
    if (sliderImages.length === 0) sliderImages.push("https://images.unsplash.com/photo-1542314831-c6a4d27a658d?q=80&w=2000&auto=format&fit=crop");

    // 슬라이더 모드 확인용
    const isMainSliderAuto = !safeConfig.slider_style || safeConfig.slider_style.includes('auto');
    const activeFac = facilities[activeFacIdx] || {};
    const isFacSliderAuto = !activeFac.display_style || activeFac.display_style === 'slider';
    const activeAtt = attractions[activeAttIdx] || {};
    const isAttSliderAuto = !activeAtt.display_style || activeAtt.display_style === 'slider';

    // 💡 [혁신 1] 프로모션이 적용되면, 해당 프로모션에 허용된 객실 타입만 남기고 싹 필터링합니다!
    const visibleRooms = appliedPromo && Array.isArray(appliedPromo.target_room_type) && !appliedPromo.target_room_type.includes('All Rooms')
        ? rooms.filter(r => appliedPromo.target_room_type.includes(r.name))
        : rooms;

    // 💡 [혁신 2] 전체 객실(rooms) 대신 필터링된 객실(visibleRooms) 안에서 포커스를 잡습니다.
    const activeRoom = visibleRooms.find(r => r.id === selectedRoomId) || visibleRooms[0];
    const isRoomSliderAuto = !activeRoom?.roomConfig?.display_style || activeRoom.roomConfig.display_style === 'slider';

    useEffect(() => {
        let timer;
        if (activeMenu === 'HOME' && sliderImages.length > 1 && isMainSliderAuto) {
            timer = setInterval(() => setCurrentSlide(prev => (prev + 1) % sliderImages.length), 4000);
        } else if (activeMenu === 'ROOMS' && isRoomSliderAuto) { // 👈 [여기 수정됨] isRoomSliderAuto 조건 추가
            timer = setInterval(() => setRoomSlideIdx(prev => prev + 1), 3500);
        } else if (activeMenu === 'FACILITIES' && isFacSliderAuto) {
            timer = setInterval(() => setFacSlideIdx(prev => prev + 1), 3500);
        } else if (activeMenu === 'ATTRACTIONS' && isAttSliderAuto) {
            timer = setInterval(() => setAttSlideIdx(prev => prev + 1), 3500);
        }
        return () => clearInterval(timer);
    }, [activeMenu, sliderImages.length, isMainSliderAuto, isFacSliderAuto, isAttSliderAuto, isRoomSliderAuto]);

    // 수동 슬라이드 조작
    const nextMainSlide = () => setCurrentSlide(prev => (prev + 1) % sliderImages.length);
    const prevMainSlide = () => setCurrentSlide(prev => (prev === 0 ? sliderImages.length - 1 : prev - 1));

    const nextFacSlide = (imgCount) => setFacSlideIdx(prev => (prev + 1) % imgCount);
    const prevFacSlide = (imgCount) => setFacSlideIdx(prev => (prev === 0 ? imgCount - 1 : prev - 1));

    const nextAttSlide = (imgCount) => setAttSlideIdx(prev => (prev + 1) % imgCount);
    const prevAttSlide = (imgCount) => setAttSlideIdx(prev => (prev === 0 ? imgCount - 1 : prev - 1));

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

    const handleTabClick = (e, setter, value) => { setter(value); if (e.target) e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); };
    const htmlRenderClass = "leading-relaxed text-slate-600 font-medium text-sm md:text-base [&>h1]:text-3xl [&>h1]:font-black [&>h1]:mb-3 [&>h1]:text-slate-800 [&>h3]:text-xl [&>h3]:font-bold [&>h3]:mb-2 [&>h3]:text-slate-800 [&>p]:mb-2";

    const renderPriceStr = (price, name) => {
        if (lang === 'ko') return `${name} 객실을 ₱${price.toLocaleString()}${t.night} ${t.startingFrom}`;
        if (lang === 'zh') return `${t.expStart} ${name} ${t.startingFrom} ₱${price.toLocaleString()}${t.night}`;
        if (lang === 'ja') return `${name} を ₱${price.toLocaleString()}${t.night} からご体験ください。`;
        return `${t.expStart} ${name} ${t.startingFrom} ₱${price.toLocaleString()}${t.night}.`;
    };

    // 💡 [수정됨] 복잡한 계산식과 함수들을 return 밖으로 완전히 빼내어 문법 에러 원천 차단
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const nights = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

    const roomPrice = Number(activeRoom?.price || activeRoom?.basePrice || 0);
    const safeRoomCount = Number(roomCount || 1);
    const safeExtraBed = Number(extraBed || 0);

    const basePrice = roomPrice * nights * safeRoomCount;
    const extraBedPrice = safeExtraBed * 1000 * nights;

    const discountPct = appliedPromo ? Number(appliedPromo.discount_pct || 0) : 0;
    const discountAmount = appliedPromo ? (basePrice * discountPct) / 100 : 0;
    const finalTotal = basePrice + extraBedPrice - discountAmount;
    const rewardsCfg = memberRewardsSnapshot.config || {};
    const redeemRatePer100 = Math.max(1, Number(rewardsCfg.redeem_rate_points_per_100 || 100));
    const minRedeemPoints = Math.max(0, Number(rewardsCfg.min_redeem_points || 0));
    const maxRedeemPointsByPrice = Math.floor(Math.max(0, finalTotal) / 100) * redeemRatePer100;
    const maxRedeemPointsAllowed = Math.max(0, Math.min(Number(memberRewardsSnapshot.points || 0), maxRedeemPointsByPrice));
    const payableTotal = Math.max(0, finalTotal - Number(appliedRedeemAmount || 0));

    const handleApplyPromo = () => {
        const promo = activePromos.find(p => p.code.toUpperCase() === promoCode.toUpperCase());
        if (!promo) return setAlertMessage(t.invalidPromo);

        if (!promo.target_room_type.includes('All Rooms') && !promo.target_room_type.includes(activeRoom?.name)) {
            return setAlertMessage(t.promoRoomOnly + promo.target_room_type.join(', '));
        }

        setAppliedPromo(promo);
        setAlertMessage(t.promoApplied + promo.discount_pct + t.promoOff);
    };

    useEffect(() => {
        if (appliedRedeemPoints <= 0) return;
        let adjustedPoints = Math.min(appliedRedeemPoints, maxRedeemPointsAllowed);
        adjustedPoints = Math.floor(adjustedPoints / redeemRatePer100) * redeemRatePer100;
        if (adjustedPoints <= 0 || adjustedPoints < minRedeemPoints) {
            setAppliedRedeemPoints(0);
            setAppliedRedeemAmount(0);
            return;
        }
        const adjustedAmount = Math.floor(adjustedPoints / redeemRatePer100) * 100;
        if (adjustedPoints !== appliedRedeemPoints) setAppliedRedeemPoints(adjustedPoints);
        if (adjustedAmount !== appliedRedeemAmount) setAppliedRedeemAmount(adjustedAmount);
    }, [appliedRedeemPoints, maxRedeemPointsAllowed, redeemRatePer100, minRedeemPoints, appliedRedeemAmount]);

    if (loading) return <div className="min-h-screen flex items-center justify-center text-xl font-bold text-slate-500 bg-slate-50">Loading your perfect stay...</div>;

    const handleApplyRedeemPoints = () => {
        if (!user?.email) {
            setAlertMessage("❌ Please log in first to use reward points.");
            return;
        }
        if (!memberRewardsSnapshot.enabled) {
            setAlertMessage("❌ Rewards program is not active for this hotel.");
            return;
        }
        const raw = Math.max(0, Math.floor(Number(redeemPointsInput || 0)));
        if (raw <= 0) {
            setAlertMessage("❌ Enter points to use.");
            return;
        }
        if (raw < minRedeemPoints) {
            setAlertMessage(`❌ Minimum redeem is ${minRedeemPoints.toLocaleString()} points.`);
            return;
        }
        if (maxRedeemPointsAllowed <= 0) {
            setAlertMessage("❌ No redeemable points for this booking amount.");
            return;
        }

        let usablePoints = Math.min(raw, maxRedeemPointsAllowed);
        usablePoints = Math.floor(usablePoints / redeemRatePer100) * redeemRatePer100;
        if (usablePoints < minRedeemPoints || usablePoints <= 0) {
            setAlertMessage("❌ Enter a valid redeemable points amount.");
            return;
        }

        const currencyAmount = Math.floor(usablePoints / redeemRatePer100) * 100;
        setAppliedRedeemPoints(usablePoints);
        setAppliedRedeemAmount(currencyAmount);
        setAlertMessage(`✅ Points applied: ${usablePoints.toLocaleString()} pts (₱${currencyAmount.toLocaleString()} discount)`);
    };

    const handleClearRedeemPoints = () => {
        setAppliedRedeemPoints(0);
        setAppliedRedeemAmount(0);
        setRedeemPointsInput('');
    };

    const topCountries = PRIORITY_COUNTRIES;
    const otherCountries = "Afghanistan,Albania,Algeria,Andorra,Angola,Argentina,Armenia,Australia,Austria,Azerbaijan,Bahamas,Bahrain,Bangladesh,Barbados,Belarus,Belgium,Belize,Benin,Bhutan,Bolivia,Bosnia and Herzegovina,Botswana,Brazil,Brunei,Bulgaria,Burkina Faso,Burundi,Cabo Verde,Cambodia,Cameroon,Canada,Central African Republic,Chad,Chile,Colombia,Comoros,Congo,Costa Rica,Croatia,Cuba,Cyprus,Czech Republic,Denmark,Djibouti,Dominica,Dominican Republic,Ecuador,Egypt,El Salvador,Equatorial Guinea,Eritrea,Estonia,Eswatini,Ethiopia,Fiji,Finland,France,Gabon,Gambia,Georgia,Germany,Ghana,Greece,Grenada,Guatemala,Guinea,Guinea-Bissau,Guyana,Haiti,Honduras,Hungary,Iceland,India,Indonesia,Iran,Iraq,Ireland,Israel,Italy,Jamaica,Jordan,Kazakhstan,Kenya,Kiribati,Kuwait,Kyrgyzstan,Laos,Latvia,Lebanon,Lesotho,Liberia,Libya,Liechtenstein,Lithuania,Luxembourg,Madagascar,Malawi,Malaysia,Maldives,Mali,Malta,Marshall Islands,Mauritania,Mauritius,Mexico,Micronesia,Moldova,Monaco,Mongolia,Montenegro,Morocco,Mozambique,Myanmar,Namibia,Nauru,Nepal,Netherlands,New Zealand,Nicaragua,Niger,Nigeria,North Macedonia,Norway,Oman,Pakistan,Palau,Panama,Papua New Guinea,Paraguay,Peru,Poland,Portugal,Qatar,Romania,Russia,Rwanda,Saint Kitts and Nevis,Saint Lucia,Saint Vincent,Samoa,San Marino,Sao Tome and Principe,Saudi Arabia,Senegal,Serbia,Seychelles,Sierra Leone,Singapore,Slovakia,Slovenia,Solomon Islands,Somalia,South Africa,Spain,Sri Lanka,Sudan,Suriname,Sweden,Switzerland,Syria,Taiwan,Tajikistan,Tanzania,Thailand,Timor-Leste,Togo,Tonga,Trinidad and Tobago,Tunisia,Turkey,Turkmenistan,Tuvalu,Uganda,Ukraine,United Arab Emirates,United Kingdom,Uruguay,Uzbekistan,Vanuatu,Vatican City,Venezuela,Vietnam,Yemen,Zambia,Zimbabwe".split(',');
    const authCountryQuery = String(authForm.nationality || '').trim().toLowerCase();
    const filteredPriorityCountries = PRIORITY_COUNTRIES.filter((country) => country.toLowerCase().includes(authCountryQuery));
    const filteredOtherCountries = countryOptions.filter((country) => !PRIORITY_COUNTRIES.includes(country) && country.toLowerCase().includes(authCountryQuery));

    const formatSlashedZero = (id) => {
        return String(id).replace(/0/g, '0̸');
    };

    const renderAuthCountryField = () => (
        <div className="relative">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{t.nationality}</label>
            <input
                type="text"
                autoComplete="off"
                required
                value={authForm.nationality}
                onFocus={() => setShowAuthCountryMenu(true)}
                onChange={(e) => {
                    setAuthForm({ ...authForm, nationality: e.target.value });
                    setShowAuthCountryMenu(true);
                }}
                onBlur={() => {
                    window.setTimeout(() => setShowAuthCountryMenu(false), 150);
                }}
                className="w-full p-3 border border-slate-300 focus:theme-border outline-none text-sm rounded-xl"
                placeholder="Type to search country"
            />
            {showAuthCountryMenu && (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    {filteredPriorityCountries.length > 0 && (
                        <>
                            <div className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Top Countries</div>
                            {filteredPriorityCountries.map((country) => (
                                <button
                                    key={`priority_${country}`}
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        setAuthForm({ ...authForm, nationality: country });
                                        setShowAuthCountryMenu(false);
                                    }}
                                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-black text-slate-900 hover:bg-slate-50"
                                >
                                    <span>{country}</span>
                                </button>
                            ))}
                            <div className="mx-4 border-t border-slate-200" />
                        </>
                    )}
                    {filteredOtherCountries.length > 0 ? (
                        filteredOtherCountries.map((country) => (
                            <button
                                key={`country_${country}`}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    setAuthForm({ ...authForm, nationality: country });
                                    setShowAuthCountryMenu(false);
                                }}
                                className="flex w-full items-center px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                                <span>{country}</span>
                            </button>
                        ))
                    ) : filteredPriorityCountries.length === 0 ? (
                        <div className="px-4 py-3 text-sm font-bold text-slate-400">No matching countries</div>
                    ) : null}
                </div>
            )}
        </div>
    );

    const handleGuestDocumentUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setGuestDocumentUrl(String(reader.result || ''));
        reader.readAsDataURL(file);
    };

    const handleConfirmBooking = async (e) => {
        if (isBooking) return;

        if (e && e.currentTarget) {
            if (e.currentTarget.disabled) return;
            e.currentTarget.disabled = true;
            e.currentTarget.innerText = "Processing... ⏳";
            e.currentTarget.style.opacity = "0.7";
            e.currentTarget.style.cursor = "wait";
        }

        const resetBtn = () => {
            setIsBooking(false);
            if (e && e.currentTarget) {
                e.currentTarget.disabled = false;
                e.currentTarget.innerText = t.confirmBook || "Proceed to Payment ➔";
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.cursor = "pointer";
            }
        };

        if (!firstName || !lastName || !guestEmail || !guestPhone) {
            resetBtn();
            return setAlertMessage(t.fillRequired);
        }
        if (appliedRedeemPoints > 0 && user?.email && String(guestEmail || '').toLowerCase() !== String(user.email || '').toLowerCase()) {
            resetBtn();
            return setAlertMessage("❌ Reward points can be used only when booking with your own member email.");
        }

        setIsBooking(true);

        try {
            if (guestEmail) {
                try {
                    await fetch('/api/members/update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: guestEmail,
                            first_name: firstName,
                            last_name: lastName,
                            phone: guestPhone,
                            nationality,
                            region: guestRegion,
                            dob: guestDob,
                            document_url: guestDocumentUrl,
                            hotel_code: hotelCode
                        })
                    });
                } catch (_) { }
            }

            const dividedGrandTotal = finalTotal / safeRoomCount;
            let bookingPayloads = [];

            for (let i = 0; i < safeRoomCount; i++) {
                const fullName = `${firstName} ${lastName}`.trim();
                bookingPayloads.push({
                    hotel_code: hotelCode,
                    room_type: activeRoom.name,
                    check_in_date: checkIn,
                    check_out_date: checkOut,
                    guest_name: safeRoomCount > 1 ? `${fullName} (Room ${i + 1})` : fullName,
                    email: guestEmail,
                    phone: guestPhone,
                    nationality: nationality,
                    region: guestRegion,
                    dob: guestDob,
                    document_url: guestDocumentUrl,
                    total_price: dividedGrandTotal,
                    promo_code: appliedPromo ? appliedPromo.code : null,
                    discount_amount: appliedPromo ? (discountAmount / safeRoomCount) : 0,
                    payment_method: "Credit Card",
                    channel: "Hotel Web",
                    status: 'PENDING_PAYMENT'
                });
            }

            const res = await fetch(`${BASE_URL}/api/public/reservations/batch-create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookings: bookingPayloads,
                    points_redeem: appliedRedeemPoints > 0
                        ? {
                            email: user?.email || guestEmail,
                            points_used: appliedRedeemPoints
                        }
                        : null
                })
            });

            const raw = await res.text();
            let data = {};
            try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { message: raw }; }

            if (!res.ok) {
                setAlertMessage(t.bookingFailed + (data.message || t.bookingApiError));
                resetBtn();
                return;
            }

            if (data.success && data.paymentUrl) {
                window.location.replace(data.paymentUrl);
            } else {
                setAlertMessage(t.bookingFailed + (data.message || t.bookingApiError));
                resetBtn();
            }
        } catch (error) {
            console.error("Booking Error:", error);
            setAlertMessage(t.serverError);
            resetBtn();
        }
    };

    // 💡 아래부터 화면을 그리는 return 문 시작입니다. (중첩 및 괄호 오류 완벽 제거)
    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
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
                            {[{ id: 'HOME', label: t.home }, { id: 'ROOMS', label: t.rooms }, { id: 'FACILITIES', label: t.facilities }, { id: 'ATTRACTIONS', label: t.attractions }, { id: 'CONTACT', label: t.contact }].map(menu => (
                                <button key={menu.id} onClick={() => setActiveMenu(menu.id)} className={`transition-colors pb-1 ${activeMenu === menu.id ? 'theme-text border-b-2 theme-border' : 'hover:theme-text'}`}>{menu.label}</button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 md:gap-4">
                            <button onClick={() => setActiveMenu('BOOK')} className="theme-bg theme-hover text-white px-3 md:px-7 py-2 md:py-2.5 rounded-full font-bold shadow-md text-xs md:text-base whitespace-nowrap">{t.bookNow}</button>

                            <select value={lang} onChange={(e) => setLang(e.target.value)} className="bg-slate-100 text-slate-600 px-2 py-1.5 md:px-3 md:py-2 rounded-lg text-xs md:text-sm font-bold outline-none cursor-pointer hover:bg-slate-200 transition-colors border border-slate-200">
                                <option value="en">EN</option><option value="ko">KR</option><option value="zh">CN</option><option value="ja">JP</option>
                            </select>

                            {!user ? (
                                <button onClick={() => { setGuestAuthMode('LOGIN'); setShowGuestAuthModal(true); }} className="px-3 md:px-4 py-2 border theme-border theme-text rounded-full font-bold text-xs md:text-sm hover:bg-slate-50 transition-colors whitespace-nowrap">
                                    {t.loginBtn || 'Log In'}
                                </button>
                            ) : (
                                <div className="hidden sm:flex items-center gap-3">
                                    <span className="text-xs font-black text-slate-500 uppercase">{user.first_name || user.name}</span>
                                    <button onClick={() => { setActiveMenu('MYPAGE'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-4 py-2 border theme-border theme-text rounded-full font-bold text-sm hover:bg-slate-50 transition-colors whitespace-nowrap shadow-sm">
                                        {t.myPageBtn}
                                    </button>
                                    <button onClick={handleLogout} className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors">{t.logoutBtn}</button>
                                </div>
                            )}

                            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden text-2xl theme-text p-2">{isMobileMenuOpen ? '✕' : '☰'}</button>
                        </div>
                    </div>
                    {isMobileMenuOpen && (
                        <div className="md:hidden fixed inset-0 top-[72px] z-40 bg-black/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
                            <div className="absolute right-5 top-8 flex flex-col gap-5" onClick={(e) => e.stopPropagation()}>
                                {[{ id: 'HOME', label: t.home }, { id: 'ROOMS', label: t.rooms }, { id: 'FACILITIES', label: t.facilities }, { id: 'ATTRACTIONS', label: t.attractions }, { id: 'CONTACT', label: t.contact }, ...(user ? [{ id: 'MYPAGE', label: t.myPageBtn }] : [{ id: 'LOGIN_SIGNUP', label: t.loginSignUpBtn }])].map(menu => (
                                    <button key={menu.id} onClick={() => {
                                        if (menu.id === 'LOGIN_SIGNUP') {
                                            setGuestAuthMode('LOGIN');
                                            setShowGuestAuthModal(true);
                                        } else {
                                            setActiveMenu(menu.id);
                                        }
                                        setIsMobileMenuOpen(false);
                                    }} className={`flex h-20 w-20 items-center justify-center rounded-full bg-white/85 px-3 text-center text-xs font-black shadow-2xl backdrop-blur-md transition-transform active:scale-95 ${(menu.id !== 'LOGIN_SIGNUP' && activeMenu === menu.id) ? 'theme-text ring-4 ring-white/40' : 'text-slate-900'}`}>
                                        {menu.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </header>

                {/* 🏠 메인 화면 */}
                {activeMenu === 'HOME' && (
                    <div className="animate-fade-in-up">
                        <section className="relative h-[85vh] flex flex-col items-center justify-center mt-[72px] overflow-hidden bg-slate-900 group">
                            {safeConfig.slider_style === 'auto_slide' ? (
                                <div
                                    className="absolute inset-0 flex transition-transform duration-700 ease-in-out z-10"
                                    style={{ transform: `translateX(-${currentSlide * 100}%)`, width: `${sliderImages.length * 100}%` }}
                                >
                                    {sliderImages.map((img, idx) => (
                                        <img key={idx} src={img} className="w-full h-full object-cover opacity-60" style={{ width: `${100 / sliderImages.length}%` }} alt="slide" />
                                    ))}
                                </div>
                            ) : (
                                sliderImages.map((img, idx) => (
                                    <img key={idx} src={img} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? 'opacity-60 z-10' : 'opacity-0 z-0'}`} alt="slide" />
                                ))
                            )}

                            {!isMainSliderAuto && sliderImages.length > 1 && (
                                <>
                                    <button onClick={prevMainSlide} className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-30 p-2 md:p-3 bg-black/40 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all opacity-80 hover:opacity-100">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                    </button>
                                    <button onClick={nextMainSlide} className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-30 p-2 md:p-3 bg-black/40 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all opacity-80 hover:opacity-100">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                    </button>

                                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2">
                                        {sliderImages.map((_, idx) => (
                                            <div key={`dot_${idx}`} className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full transition-all shadow-sm ${currentSlide === idx ? 'bg-white scale-125' : 'bg-white/50'}`}></div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {(() => {
                                let finalPos = { title: { x: 10, y: 20, w: 80, size: 48, align: 'center' }, subtitle: { x: 30, y: 50, w: 80, size: 18, align: 'center' } };
                                try {
                                    if (safeConfig.welcome_text_pos) {
                                        const parsed = typeof safeConfig.welcome_text_pos === 'string' ? JSON.parse(safeConfig.welcome_text_pos) : safeConfig.welcome_text_pos;
                                        if (parsed.title) finalPos.title = { ...finalPos.title, ...parsed.title };
                                        if (parsed.subtitle) finalPos.subtitle = { ...finalPos.subtitle, ...parsed.subtitle };
                                    }
                                } catch (e) { }

                                return (
                                    <>
                                        <div className="absolute z-20 px-4 transition-all duration-500 ease-out pointer-events-none"
                                            style={{ left: `${Math.max(0, Math.min(90, finalPos.title.x))}%`, top: `${Math.max(0, Math.min(90, finalPos.title.y))}%`, width: `${Math.max(20, Math.min(100, finalPos.title.w))}%`, maxWidth: '100vw' }}>
                                            <h1 className="text-white leading-tight drop-shadow-2xl font-black whitespace-pre-wrap w-full"
                                                style={{ textAlign: finalPos.title.align, fontSize: `clamp(1.5rem, ${finalPos.title.size * 0.08}vw, ${finalPos.title.size}px)` }}>
                                                {safeConfig.welcome_title || "Welcome"}
                                            </h1>
                                        </div>

                                        <div className="absolute z-20 px-4 transition-all duration-500 ease-out pointer-events-none"
                                            style={{ left: `${Math.max(0, Math.min(90, finalPos.subtitle.x))}%`, top: `${Math.max(0, Math.min(90, finalPos.subtitle.y))}%`, width: `${Math.max(20, Math.min(100, finalPos.subtitle.w))}%`, maxWidth: '100vw' }}>
                                            <p className="text-slate-200 font-medium drop-shadow-lg whitespace-pre-wrap w-full"
                                                style={{ textAlign: finalPos.subtitle.align, fontSize: `clamp(0.9rem, ${finalPos.subtitle.size * 0.08}vw, ${finalPos.subtitle.size}px)` }}>
                                                {safeConfig.welcome_subtitle || "Your perfect stay awaits."}
                                            </p>
                                        </div>
                                    </>
                                );
                            })()}
                        </section>

                        <section className="py-24 px-8 bg-white text-center">
                            <div className="max-w-3xl mx-auto">
                                <h2 className="text-3xl font-black mb-8 theme-text">{t.aboutUs}</h2>
                                <div className={`${htmlRenderClass} text-center`} dangerouslySetInnerHTML={{ __html: safeConfig.description || "Information updating..." }} />
                            </div>
                        </section>
                    </div>
                )}

                {/* 💡 예약 화면 (BOOK) */}
                {activeMenu === 'BOOK' && (
                    <section className="relative pt-32 pb-20 px-4 md:px-6 w-full flex-grow min-h-[85vh] flex flex-col items-center justify-start animate-fade-in-up">
                        <div className="fixed inset-0 z-0 bg-slate-50">
                            {sliderImages.map((img, idx) => (
                                <img key={idx} src={img} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? 'opacity-40 z-10' : 'opacity-0 z-0'}`} alt="slide" />
                            ))}
                            <div className="absolute inset-0 bg-white/60 z-10 pointer-events-none"></div>
                        </div>

                        {!showBookingModal && !hasSearched && (
                            <div className="relative z-40 w-full max-w-5xl flex flex-col items-center mt-4">
                                <div className="bg-white p-2 md:p-3 rounded-3xl md:rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col md:flex-row items-center gap-2 w-full border-2 theme-border backdrop-blur-xl bg-white/90">
                                    <div className="flex-1 px-6 py-3 border-b md:border-b-0 md:border-r border-slate-200 w-full relative hover:bg-slate-50 transition-colors md:rounded-l-full cursor-pointer">
                                        <label className="text-[10px] font-bold text-slate-600 md:text-slate-400 uppercase tracking-wider block mb-1">{t.checkIn}</label>
                                        <input type="date" value={checkIn} min={getHotelDate(0)} onChange={e => {
                                            const newIn = e.target.value;
                                            setCheckIn(newIn);
                                            setHasSearched(false);
                                            if (!checkOut || newIn >= checkOut) {
                                                const d = new Date(newIn); d.setDate(d.getDate() + 1);
                                                setCheckOut(d.toISOString().split('T')[0]);
                                            }
                                        }} className="w-full bg-transparent font-bold text-slate-700 md:text-slate-600 outline-none text-base md:text-lg cursor-pointer" required />
                                    </div>

                                    <div className="flex-1 px-6 py-3 border-b md:border-b-0 md:border-r border-slate-200 w-full relative hover:bg-slate-50 transition-colors cursor-pointer">
                                        <label className="text-[10px] font-bold text-slate-600 md:text-slate-400 uppercase tracking-wider block mb-1">{t.checkOut}</label>
                                        <input type="date" value={checkOut} min={checkIn ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().split('T')[0] : getHotelDate(0)} onChange={e => { setCheckOut(e.target.value); setHasSearched(false); }} className="w-full bg-transparent font-bold text-slate-700 md:text-slate-600 outline-none text-base md:text-lg cursor-pointer" required />
                                    </div>

                                    <div className="flex-1 px-6 py-3 w-full cursor-pointer relative hover:bg-slate-50 transition-colors" onClick={() => setShowGuestPicker(!showGuestPicker)}>
                                        <label className="text-[10px] font-bold text-slate-600 md:text-slate-400 uppercase tracking-wider block mb-1">{t.guestsRooms}</label>
                                        <div className="font-bold text-slate-700 md:text-slate-600 text-base md:text-lg truncate flex justify-between items-center">
                                            <span>{adults} {t.adults}{kids > 0 ? `, ${kids} ${t.children}` : ''} · {roomCount} {t.room}</span>
                                            <span className="text-slate-600 md:hidden text-xs">▼</span>
                                        </div>

                                        {showGuestPicker && (
                                            <div className="absolute top-full left-0 md:left-auto md:right-0 w-[300px] mt-4 bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 z-[200] animate-fade-in space-y-5 text-slate-800 cursor-default" onClick={e => e.stopPropagation()}>
                                                <div className="flex justify-between items-center">
                                                    <div><p className="font-bold text-sm">{t.adults}</p><p className="text-[10px] text-slate-500">{t.age13}</p></div>
                                                    <div className="flex items-center gap-3"><button type="button" onClick={(e) => { e.stopPropagation(); setAdults(Math.max(1, adults - 1)); setHasSearched(false); }} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">-</button><span className="w-4 text-center font-bold">{adults}</span><button type="button" onClick={(e) => { e.stopPropagation(); setAdults(adults + 1); setHasSearched(false); }} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">+</button></div>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <div><p className="font-bold text-sm">{t.children}</p><p className="text-[10px] text-slate-500">{t.age2_12}</p></div>
                                                    <div className="flex items-center gap-3"><button type="button" onClick={(e) => { e.stopPropagation(); setKids(Math.max(0, kids - 1)); setHasSearched(false); }} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">-</button><span className="w-4 text-center font-bold">{kids}</span><button type="button" onClick={(e) => { e.stopPropagation(); setKids(kids + 1); setHasSearched(false); }} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">+</button></div>
                                                </div>
                                                <div className="flex justify-between items-center theme-bg-light/50 p-2 -mx-2 rounded-lg border theme-border/50">
                                                    <div><p className="font-bold text-sm text-emerald-900">{t.infants}</p><p className="text-[10px] theme-text/80">{t.under2}</p></div>
                                                    <div className="font-black theme-text bg-white px-3 py-1 rounded-full text-xs border theme-border shadow-sm uppercase tracking-widest">Free</div>
                                                </div>
                                                <div className="border-t border-slate-100 pt-5 flex justify-between items-center">
                                                    <div><p className="font-bold text-sm">{t.rooms}</p></div>
                                                    <div className="flex items-center gap-3"><button type="button" onClick={(e) => { e.stopPropagation(); setRoomCount(Math.max(1, roomCount - 1)); setHasSearched(false); }} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">-</button><span className="w-4 text-center font-bold">{roomCount}</span><button type="button" onClick={(e) => { e.stopPropagation(); setRoomCount(roomCount + 1); setHasSearched(false); }} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">+</button></div>
                                                </div>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); setShowGuestPicker(false); }} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl mt-2 hover:bg-slate-800 transition-colors">{t.done}</button>
                                            </div>
                                        )}
                                    </div>

                                    <button onClick={() => {
                                        if (!checkIn || !checkOut) return setAlertMessage(t.selectValidDates);
                                        setHasSearched(true);
                                    }} className="w-full md:w-auto theme-bg theme-hover text-white px-10 py-4 md:py-5 rounded-2xl md:rounded-full font-black text-lg transition-transform active:scale-95 shadow-md m-1">
                                        Search
                                    </button>
                                </div>
                            </div>
                        )}

                        {hasSearched && (
                            <div className="w-full max-w-5xl relative z-10 mt-8">
                                <ErrorBoundary>
                                    <RoomList hotelCode={hotelCode} lang={lang} checkIn={checkIn} checkOut={checkOut} adults={adults} kids={kids} source="Hotel Web" />
                                </ErrorBoundary>
                            </div>
                        )}
                    </section>
                )}

                {/* 🛏️ 개별 ROOMS 탭 */}
                {activeMenu === 'ROOMS' && (
                    <section className="pt-24 md:pt-32 pb-40 md:pb-56 px-4 md:px-6 max-w-7xl mx-auto animate-fade-in-up w-full flex-grow relative z-20">
                        {visibleRooms.length > 0 && activeRoom ? (
                            <div className="relative z-30">
                                {appliedPromo && !appliedPromo.target_room_type.includes('All Rooms') && (
                                    <div className="mb-4 theme-bg-light border theme-border text-emerald-800 p-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs md:text-sm shadow-sm animate-fade-in">
                                        <span className="text-lg">🎁</span>
                                        <span>Only rooms eligible for <b>{appliedPromo.code}</b> ({appliedPromo.discount_pct}% OFF) are shown below.</span>
                                        <button onClick={() => { setAppliedPromo(null); setPromoCode(''); }} className="ml-2 theme-bg-light hover:bg-emerald-200 text-emerald-800 px-3 py-1 rounded-md text-[10px] md:text-xs transition-colors shadow-sm border theme-border">
                                            Show All Rooms
                                        </button>
                                    </div>
                                )}

                                <div className="flex overflow-x-auto gap-2 mb-0 px-2 md:px-4 scrollbar-hide snap-x relative z-10">
                                    {visibleRooms.map(r => (
                                        <button key={r.id} onClick={(e) => handleTabClick(e, setSelectedRoomId, r.id)}
                                            className={`snap-center px-5 md:px-6 py-3 md:py-4 font-black rounded-t-2xl whitespace-nowrap transition-all border-t border-l border-r border-slate-200 ${selectedRoomId === r.id || activeRoom.id === r.id ? 'bg-white theme-text shadow-[0_-4px_10px_rgba(0,0,0,0.05)] text-base md:text-lg z-10 relative' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 text-xs md:text-sm mt-1.5 md:mt-2'}`}>
                                            {r.name}
                                        </button>
                                    ))}
                                </div>
                                <div className="bg-white rounded-b-3xl rounded-tr-3xl shadow-xl border border-slate-200 p-5 md:p-8 grid grid-cols-1 lg:grid-cols-10 gap-6 md:gap-8 relative z-30 -mt-px">
                                    <div className="lg:col-span-7 flex flex-col gap-4 md:gap-6">
                                        <div className="w-full h-[250px] sm:h-[350px] md:h-[450px] rounded-2xl md:rounded-3xl overflow-hidden relative shadow-inner bg-slate-900 group">
                                            {activeRoom.images && activeRoom.images.length > 0 ? (
                                                <>
                                                    {activeRoom.images.map((img, idx) => (
                                                        <img key={idx} src={img} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${(roomSlideIdx % activeRoom.images.length) === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} alt="room" />
                                                    ))}
                                                    {activeRoom.images.length > 1 && !isRoomSliderAuto && (
                                                        <>
                                                            <button onClick={(e) => { e.preventDefault(); setRoomSlideIdx(prev => prev === 0 ? activeRoom.images.length - 1 : prev - 1); }} className="absolute left-2 top-1/2 -translate-y-1/2 z-30 p-1.5 md:p-2 bg-black/40 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all opacity-80 hover:opacity-100">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                                            </button>
                                                            <button onClick={(e) => { e.preventDefault(); setRoomSlideIdx(prev => prev + 1); }} className="absolute right-2 top-1/2 -translate-y-1/2 z-30 p-1.5 md:p-2 bg-black/40 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all opacity-80 hover:opacity-100">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                                            </button>

                                                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex gap-1.5">
                                                                {activeRoom.images.map((_, idx) => (
                                                                    <div key={`dot_${idx}`} className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-all shadow-sm ${(roomSlideIdx % activeRoom.images.length) === idx ? 'bg-white scale-125' : 'bg-white/50'}`}></div>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                </>
                                            ) : (<div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold bg-slate-100">{t.noImg}</div>)}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl md:text-3xl font-black mb-3 text-slate-800">{activeRoom.name}</h3>
                                            <div className="flex flex-wrap gap-2 md:gap-4 mb-4">
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
                                            if (!checkIn || !checkOut) return setAlertMessage(t.selectValidDates);
                                            if (new Date(checkOut) <= new Date(checkIn)) return setAlertMessage(t.checkoutAfterCheckin);
                                            if (availableCount !== null && Number(availableCount) < Number(roomCount)) {
                                                return setAlertMessage(t.notEnoughRooms);
                                            }
                                            setShowBookingModal(true);
                                        }}>
                                            <div className="flex flex-col gap-4">
                                                <div className="w-full">
                                                    <label className="text-[10px] md:text-xs font-black md:font-bold text-slate-800 md:text-slate-600 uppercase mb-1 block">{t.checkIn}</label>
                                                    <input type="date" value={checkIn} min={getHotelDate(0)} onChange={e => {
                                                        const newIn = e.target.value;
                                                        setCheckIn(newIn);
                                                        if (!checkOut || newIn >= checkOut) {
                                                            const d = new Date(newIn); d.setDate(d.getDate() + 1);
                                                            setCheckOut(d.toISOString().split('T')[0]);
                                                        }
                                                    }} className="w-full p-2.5 pr-10 md:p-3 md:pr-12 border border-slate-200 rounded-xl bg-white shadow-sm font-black md:font-bold text-xs md:text-sm text-slate-900 md:text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" required />
                                                </div>
                                                <div className="w-full">
                                                    <label className="text-[10px] md:text-xs font-black md:font-bold text-slate-800 md:text-slate-600 uppercase mb-1 block">{t.checkOut}</label>
                                                    <input type="date" value={checkOut} min={checkIn ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().split('T')[0] : getHotelDate(0)} onChange={e => setCheckOut(e.target.value)} className="w-full p-2.5 pr-10 md:p-3 md:pr-12 border border-slate-200 rounded-xl bg-white shadow-sm font-black md:font-bold text-xs md:text-sm text-slate-900 md:text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" required />
                                                </div>
                                            </div>

                                            <div className="relative mt-2">
                                                <label className="text-[10px] md:text-xs font-black md:font-bold text-slate-800 md:text-slate-600 uppercase block mb-1">{t.guestsRooms}</label>
                                                <div onClick={() => setShowGuestPicker(!showGuestPicker)} className="w-full p-2.5 md:p-3 border border-slate-200 rounded-xl bg-white shadow-sm font-black md:font-bold text-xs md:text-sm text-slate-900 md:text-slate-700 cursor-pointer flex justify-between items-center select-none hover:bg-blue-50 transition-colors">
                                                    <span className="truncate pr-2">{adults} {t.adults}{kids > 0 ? `, ${kids} ${t.children}` : ''}{infants > 0 ? `, ${infants} ${t.infants}` : ''} · {roomCount} {t.room}</span>
                                                    <span className="text-slate-800 md:text-slate-400 font-black md:font-normal shrink-0">▼</span>
                                                </div>

                                                {showGuestPicker && (
                                                    <div className="absolute top-full left-0 md:left-auto md:right-0 w-[300px] mt-4 bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 z-[200] animate-fade-in space-y-5 text-slate-800 cursor-default" onClick={e => e.stopPropagation()}>
                                                        <div className="flex justify-between items-center">
                                                            <div><p className="font-bold text-sm">{t.adults}</p><p className="text-[10px] text-slate-500">{t.age13}</p></div>
                                                            <div className="flex items-center gap-3"><button type="button" onClick={(e) => { e.stopPropagation(); setAdults(Math.max(1, adults - 1)); setHasSearched(false); }} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">-</button><span className="w-4 text-center font-bold">{adults}</span><button type="button" onClick={(e) => { e.stopPropagation(); setAdults(adults + 1); setHasSearched(false); }} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">+</button></div>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <div><p className="font-bold text-sm">{t.children}</p><p className="text-[10px] text-slate-500">{t.age2_12}</p></div>
                                                            <div className="flex items-center gap-3"><button type="button" onClick={(e) => { e.stopPropagation(); setKids(Math.max(0, kids - 1)); setHasSearched(false); }} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">-</button><span className="w-4 text-center font-bold">{kids}</span><button type="button" onClick={(e) => { e.stopPropagation(); setKids(kids + 1); setHasSearched(false); }} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">+</button></div>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <div><p className="font-bold text-sm">{t.infants}</p><p className="text-[10px] text-slate-500">{t.under2}</p></div>
                                                            <div className="flex items-center gap-3"><button type="button" onClick={() => setInfants(Math.max(0, infants - 1))} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">-</button><span className="w-4 text-center font-bold">{infants}</span><button type="button" onClick={() => setInfants(infants + 1)} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">+</button></div>
                                                        </div>
                                                        <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                                                            <div><p className="font-bold text-sm">{t.rooms}</p></div>
                                                            <div className="flex items-center gap-3"><button type="button" onClick={() => setRoomCount(Math.max(1, roomCount - 1))} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">-</button><span className="w-4 text-center font-bold">{roomCount}</span><button type="button" onClick={() => setRoomCount(roomCount + 1)} className="w-8 h-8 rounded-full bg-slate-100 font-bold hover:bg-slate-200">+</button></div>
                                                        </div>
                                                        <button type="button" onClick={() => setShowGuestPicker(false)} className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl mt-2 hover:bg-slate-800 transition-colors">{t.done}</button>
                                                    </div>
                                                )}
                                            </div>

                                            {availableCount !== null && checkIn && checkOut && (
                                                <div className="mt-4 p-3 rounded-xl text-center font-black text-sm border shadow-sm transition-all" style={{ backgroundColor: Number(availableCount) >= Number(roomCount) ? '#f0fdf4' : '#fef2f2', borderColor: Number(availableCount) >= Number(roomCount) ? '#bbf7d0' : '#fecaca', color: Number(availableCount) >= Number(roomCount) ? '#166534' : '#991b1b' }}>
                                                    {Number(availableCount) >= Number(roomCount) ? `✅ ${availableCount} ${t.rooms} ${t.available}` : `❌ ${t.soldOut}`}
                                                </div>
                                            )}

                                            <button type="submit" disabled={availableCount !== null && Number(availableCount) < Number(roomCount)} className="w-full theme-bg theme-hover text-white py-3.5 md:py-4 rounded-xl font-black md:text-lg mt-2 shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                                                {t.reserveNow}
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        ) : (<p className="text-center text-slate-400 font-bold py-20">{t.noRooms}</p>)}
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
                                        <div className="w-full h-[250px] sm:h-[350px] md:h-[450px] rounded-2xl md:rounded-3xl overflow-hidden relative shadow-inner bg-slate-900 group">
                                            {(() => {
                                                const activeItem = facilities[activeFacIdx] || {};
                                                let images = activeItem.image_urls?.length > 0 ? activeItem.image_urls : (activeItem.image_url ? [activeItem.image_url] : ["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=1000"]);

                                                return (
                                                    <>
                                                        {images.map((img, idx) => (
                                                            <img key={`fac_slide_${idx}`} src={img} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${(facSlideIdx % images.length) === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} alt="facility" />
                                                        ))}

                                                        {/* 💡 [수정] 부대시설 갤러리: 화살표 항상 노출 & 하단 점(Dots) 추가 */}
                                                        {!isFacSliderAuto && images.length > 1 && (
                                                            <>
                                                                <button onClick={() => prevFacSlide(images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 z-30 p-1.5 md:p-2 bg-black/40 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all opacity-80 hover:opacity-100">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                                                </button>
                                                                <button onClick={() => nextFacSlide(images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 z-30 p-1.5 md:p-2 bg-black/40 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all opacity-80 hover:opacity-100">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                                                </button>

                                                                {/* 모바일 화면용 사진 위치 표시 점(Dots) */}
                                                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex gap-1.5">
                                                                    {images.map((_, idx) => (
                                                                        <div key={`dot_${idx}`} className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-all shadow-sm ${(facSlideIdx % images.length) === idx ? 'bg-white scale-125' : 'bg-white/50'}`}></div>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </>
                                                );
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
                                        <div className="w-full h-[250px] sm:h-[350px] md:h-[450px] rounded-2xl md:rounded-3xl overflow-hidden relative shadow-inner bg-slate-900 group">
                                            {(() => {
                                                const activeItem = attractions[activeAttIdx] || {};
                                                let images = activeItem.image_urls?.length > 0 ? activeItem.image_urls : (activeItem.image_url ? [activeItem.image_url] : ["https://images.unsplash.com/photo-1542314831-c6a4d27a658d?auto=format&fit=crop&q=80&w=1000"]);

                                                return (
                                                    <>
                                                        {images.map((img, idx) => (
                                                            <img key={`att_slide_${idx}`} src={img} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${(attSlideIdx % images.length) === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} alt="attraction" />
                                                        ))}

                                                        {/* 💡 [수정] 관광지 갤러리: 화살표 항상 노출 & 하단 점(Dots) 추가 */}
                                                        {!isAttSliderAuto && images.length > 1 && (
                                                            <>
                                                                <button onClick={() => prevAttSlide(images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 z-30 p-1.5 md:p-2 bg-black/40 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all opacity-80 hover:opacity-100">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                                                </button>
                                                                <button onClick={() => nextAttSlide(images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 z-30 p-1.5 md:p-2 bg-black/40 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all opacity-80 hover:opacity-100">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                                                </button>

                                                                {/* 모바일 화면용 사진 위치 표시 점(Dots) */}
                                                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex gap-1.5">
                                                                    {images.map((_, idx) => (
                                                                        <div key={`dot_${idx}`} className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-all shadow-sm ${(attSlideIdx % images.length) === idx ? 'bg-white scale-125' : 'bg-white/50'}`}></div>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    <div className="lg:col-span-3 flex flex-col justify-center">
                                        <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-6 self-start">{attractions[activeAttIdx]?.title}</h3>
                                        <div className={htmlRenderClass} dangerouslySetInnerHTML={{ __html: attractions[activeAttIdx]?.description || '' }} />
                                    </div>
                                </div>
                            </div>
                        ) : <p className="text-center text-slate-400 font-bold py-20">{t.noAtt}</p>}
                    </section>
                )}

                {/* 📍 CONTACT 섹션 */}
                {activeMenu === 'CONTACT' && (
                    <section className="pt-24 md:pt-32 pb-20 px-4 md:px-6 max-w-7xl mx-auto animate-fade-in-up w-full flex-grow">
                        <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl border border-slate-200 p-5 md:p-8 grid grid-cols-1 lg:grid-cols-10 gap-6 md:gap-8">
                            <div className="lg:col-span-7 w-full h-[300px] md:h-[500px] rounded-2xl md:rounded-3xl overflow-hidden shadow-inner border border-slate-100 bg-slate-100 [&_iframe]:!w-full [&_iframe]:!h-full [&_div]:!w-full [&_div]:!h-full">
                                {safeConfig.map_embed_url ? (
                                    <iframe
                                        src={safeConfig.map_embed_url}
                                        width="100%"
                                        height="100%"
                                        style={{ border: 0 }}
                                        allowFullScreen=""
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                        title="Google Map"
                                    ></iframe>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-sm">{t.mapUpdating}</div>
                                )}
                            </div>
                            <div className="lg:col-span-3 flex flex-col">
                                <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-6 self-start">{t.contactUs}</h3>
                                <div className="space-y-4 md:space-y-6 text-slate-600 flex-1">
                                    <div>
                                        <p className="font-black text-lg md:text-xl text-slate-800 mb-4">{sns?.title || "Contact Us"}</p>
                                        {(sns?.address || sns?.city || sns?.province) && (
                                            <p className="flex items-start gap-3 mb-3 text-sm font-medium">
                                                <span className="shrink-0 mt-0.5 text-base">🏠</span>
                                                <span className="whitespace-pre-wrap">
                                                    {[sns?.address, sns?.city, sns?.province, "Philippines"].filter(Boolean).join(", ")}
                                                </span>
                                            </p>
                                        )}
                                        {sns?.phone && <p className="flex items-start gap-3 mb-3 text-sm font-medium"><span className="shrink-0 mt-0.5 text-base">📞</span> <span className="whitespace-pre-wrap">{sns.phone}</span></p>}
                                        {sns?.email && <p className="flex items-center gap-3 mb-3 text-sm font-medium"><span className="shrink-0 text-base">✉️</span> <span>{sns.email}</span></p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* 💡 고객용 MY PAGE */}
                {activeMenu === 'MYPAGE' && (
                    <div className="w-full flex-grow bg-slate-50 min-h-screen pt-20">
                        <MemberDashboard hotelCode={hotelCode} isSiteMobileMenuOpen={isMobileMenuOpen} posRewardToken={pendingPosRewardToken} />
                    </div>
                )}

                {showBookingModal && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 md:p-6 animate-fade-in" onClick={() => !isBooking && setShowBookingModal(false)}>
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

                            <div className="theme-bg p-5 md:p-6 text-white flex justify-between items-center shrink-0">
                                <h2 className="text-xl md:text-2xl font-black">{t.secureCheckout}</h2>
                                {!isBooking && <button onClick={() => setShowBookingModal(false)} className="text-white/80 hover:text-white text-3xl font-bold">×</button>}
                            </div>

                            <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto">
                                {/* 1. 게스트 정보 */}
                                
                                <div className="flex-1 p-6 md:p-8 lg:overflow-y-auto space-y-8">
                                    <section>
                                        <h3 className="text-lg font-black text-slate-800 border-b-2 border-slate-100 pb-2 mb-4">1. {t.guestDetails}</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{t.firstName}</label><input value={firstName} onChange={e => setFirstName(e.target.value)} disabled={isBooking} className="w-full p-3 border border-slate-200 rounded-xl theme-focus outline-none" placeholder="John" /></div>
                                            <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{t.lastName}</label><input value={lastName} onChange={e => setLastName(e.target.value)} disabled={isBooking} className="w-full p-3 border border-slate-200 rounded-xl theme-focus outline-none" placeholder="Doe" /></div>
                                        </div>
                                        <div className="mb-4"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{t.email}</label><input value={guestEmail} onChange={e => setGuestEmail(e.target.value)} disabled={isBooking} type="email" className="w-full p-3 border border-slate-200 theme-bg-light rounded-xl theme-focus outline-none" placeholder="john@example.com" /></div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{t.phone}</label><input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} disabled={isBooking} type="tel" className="w-full p-3 border border-slate-200 rounded-xl theme-focus outline-none" placeholder="+1 234 567 890" /></div>
                                            <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{t.nationality}</label><select value={nationality} onChange={e => setNationality(e.target.value)} disabled={isBooking} className="w-full p-3 border border-slate-200 rounded-xl theme-focus outline-none bg-white cursor-pointer"><optgroup label="Top Options">{topCountries.map(c => <option key={`top_${c}`} value={c}>{c}</option>)}</optgroup></select></div>
                                        </div>
                                    </section>

                                    <section>
                                        <h3 className="text-lg font-black text-slate-800 border-b-2 border-slate-100 pb-2 mb-4">2. {t.extraOptions || 'Extra Options'}</h3>
                                        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{t.extraBed || 'Extra Bed'}</p>
                                                <p className="text-xs text-slate-500">₱1,000 / night</p>
                                            </div>
                                            <div className="flex items-center gap-3 bg-white rounded-full border border-slate-300 px-1 py-1 shadow-sm">
                                                <button type="button" onClick={() => setExtraBed(Math.max(0, extraBed - 1))} className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-slate-600 hover:text-emerald-600">-</button>
                                                <span className="w-4 text-center font-bold text-emerald-600">{extraBed}</span>
                                                <button type="button" onClick={() => setExtraBed(extraBed + 1)} className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-slate-600 hover:text-emerald-600">+</button>
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                {/* 2. 우측 사이드바 (Summary + Button, 레이아웃 순서 고정) */}
                                <div className="w-full lg:w-[350px] theme-bg-light p-6 md:p-8 shrink-0 border-t lg:border-t-0 lg:border-l theme-border flex flex-col">

                                    {/* Booking Summary 영역 */}
                                    <div className="mb-6">
                                        <h3 className="text-xl font-black theme-text mb-6">{t.bookingSummary}</h3>
                                        <div className="bg-white rounded-2xl p-4 shadow-sm border theme-border mb-6">
                                            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase mb-2">
                                                <span>{t.checkIn}</span><span>{t.checkOut}</span>
                                            </div>
                                            <div className="flex justify-between font-black text-slate-800 text-sm">
                                                <span>{checkIn}</span><span>{checkOut}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="w-full">
                                                <p className="font-black theme-text text-lg leading-tight">{activeRoom?.name}</p>
                                                <div className="mt-3 space-y-1.5 border-t theme-border pt-3 text-slate-600 text-xs font-bold">
                                                    <p className="flex justify-between">
                                                        <span>Base: ₱{Number(activeRoom?.price || activeRoom?.basePrice || 0).toLocaleString()} x {nights} {t.night.replace('/', '').trim()}</span>
                                                    </p>
                                                    {appliedPromo && (
                                                        <p className="flex justify-between theme-text theme-bg-light px-2 py-1 rounded-md mt-1 border theme-border">
                                                            <span>- Discount ({appliedPromo.discount_pct}%)</span><span>- ₱{discountAmount.toLocaleString()}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-200 pt-4 space-y-3">
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.promoCode || 'Promo Code'}</div>
                                            <div className="grid grid-cols-[1fr_112px] gap-2">
                                                <input
                                                    value={promoCode}
                                                    onChange={(e) => setPromoCode(e.target.value)}
                                                    placeholder="E.g. WELCOME10"
                                                    className="flex-1 p-2.5 border border-slate-200 rounded-lg text-xs font-bold"
                                                />
                                                <button type="button" onClick={handleApplyPromo} className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-black text-xs">
                                                    {t.apply || 'Apply'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-200 pt-4 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Use Reward Points</div>
                                                <div className="text-[11px] font-bold text-slate-600">
                                                    Balance: {Number(memberRewardsSnapshot.points || 0).toLocaleString()} pts
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-[1fr_112px] gap-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={redeemPointsInput}
                                                    onChange={(e) => setRedeemPointsInput(e.target.value)}
                                                    placeholder={`Min ${Number(minRedeemPoints || 0).toLocaleString()} pts`}
                                                    className="flex-1 p-2.5 border border-slate-200 rounded-lg text-xs font-bold"
                                                    disabled={!user || !memberRewardsSnapshot.enabled}
                                                />
                                                <button type="button" onClick={handleApplyRedeemPoints} disabled={!user || !memberRewardsSnapshot.enabled} className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-black text-xs disabled:opacity-50">
                                                    Use Points
                                                </button>
                                            </div>
                                            {appliedRedeemPoints > 0 && (
                                                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs">
                                                    <span className="font-bold text-emerald-700">Applied {appliedRedeemPoints.toLocaleString()} pts</span>
                                                    <button type="button" onClick={handleClearRedeemPoints} className="font-black text-emerald-700 underline">Clear</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 결제 버튼 영역 (Summary 바로 아래에 위치) */}
                                    <div className="pt-6 border-t border-slate-300 w-full shrink-0">
                                        <div className="flex justify-between items-end mb-6">
                                            <span className="font-black text-slate-800 text-xl">{t.total}</span>
                                            <div className="text-right">
                                                {appliedRedeemAmount > 0 && (
                                                    <div className="text-xs font-bold text-slate-500 line-through">₱{finalTotal.toLocaleString()}</div>
                                                )}
                                                <span className="font-black theme-text text-3xl">₱{payableTotal.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 w-full">
                                            <button type="button" onClick={() => setShowBookingModal(false)} className="w-[30%] py-4 rounded-xl font-black text-sm border-2 theme-border theme-text bg-transparent hover:bg-slate-50 transition-colors flex items-center justify-center">← BACK</button>
                                            <button type="button" onClick={handleConfirmBooking} disabled={isBooking} className="w-[70%] theme-bg text-white py-4 rounded-xl font-black shadow-lg transition-transform active:scale-95 text-sm theme-hover disabled:opacity-50 whitespace-nowrap">{t.confirmBook || 'Proceed to Payment ➔'}</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}               

                {/* 🎈 우측 상단 바운스 대화 풍선 */}
                {activePromos.length > 0 && (
                    <div className="fixed top-24 right-6 z-40 flex flex-col md:flex-row gap-4 items-end md:items-center">
                        {activePromos.map((promo, idx) => {
                            const colors = ['bg-red-600', 'bg-blue-600', 'theme-bg text-white', 'bg-purple-600'];
                            const colorClass = colors[idx % colors.length];

                            return (
                                <button
                                    key={`balloon_${promo.id}`}
                                    onClick={() => { setSelectedPromo(promo); setShowPromoModal(true); }}
                                    className={`relative ${colorClass} text-white font-black text-[10px] sm:text-xs w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-2xl animate-bounce flex flex-col items-center justify-center border-2 border-white transition-transform hover:scale-110 shrink-0`}
                                >
                                    <span>{promo.discount_pct}%</span>
                                    <span>OFF</span>
                                    <div className={`absolute -bottom-2 right-1/2 translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-t-[8px] border-t-current border-r-[6px] border-r-transparent ${colorClass.replace('bg-', 'text-')}`}></div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* 🎁 스페셜 오퍼 팝업 모달창 */}
                {showPromoModal && selectedPromo && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in relative flex flex-col">
                            <div className="h-48 w-full relative">
                                <img src={selectedPromo.image_url} alt="Promo" className="w-full h-full object-cover" />
                                <div className="absolute top-4 left-4 bg-white/95 backdrop-blur px-3 py-1 rounded-lg font-black theme-text shadow-sm">{selectedPromo.discount_pct}% OFF</div>
                                <button onClick={() => setShowPromoModal(false)} className="absolute top-4 right-4 bg-red-500 text-white w-8 h-8 rounded-full font-bold shadow-md hover:bg-red-600 flex items-center justify-center">✕</button>
                            </div>
                            <div className="p-6 text-left">
                                <div className="mb-4 flex flex-wrap gap-1">
                                    {Array.isArray(selectedPromo.target_room_type) ? selectedPromo.target_room_type.map(r => (
                                        <span key={`modal_${r}`} className="inline-block bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-black border border-blue-100">🛏️ {r}</span>
                                    )) : <span className="inline-block bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-black border border-blue-100">🛏️ All Rooms</span>}
                                </div>

                                <div className="flex justify-between items-center theme-bg-light p-4 rounded-xl border theme-border mb-6">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Code</span>
                                    <span className="font-mono font-black theme-text tracking-wider text-lg bg-white px-3 py-1 rounded shadow-sm">{selectedPromo.code}</span>
                                </div>

                                <div className="flex justify-between items-center mb-6">
                                    <span className="text-[10px] font-bold text-red-500">Ends: {selectedPromo.end_date}</span>
                                    <span className="text-[10px] font-black theme-text uppercase flex items-center gap-1">✅ Active</span>
                                </div>

                                <button onClick={() => {
                                    setShowPromoModal(false);
                                    setPromoCode(selectedPromo.code);

                                    // 💡 [혁신 3] 사용자가 귀찮게 Apply를 누를 필요 없이 즉시 할인을 장착(Inject)합니다!
                                    setAppliedPromo(selectedPromo);

                                    // 💡 [혁신 4] 프로모션이 적용되는 첫 번째 방으로 포커스를 강제 이동시킵니다.
                                    let firstValidId = null;
                                    if (selectedPromo.target_room_type.includes('All Rooms')) {
                                        firstValidId = rooms.length > 0 ? rooms[0].id : null;
                                    } else {
                                        const validRoom = rooms.find(r => selectedPromo.target_room_type.includes(r.name));
                                        if (validRoom) firstValidId = validRoom.id;
                                    }
                                    if (firstValidId) setSelectedRoomId(firstValidId);

                                    setActiveMenu('ROOMS');
                                    window.scrollTo({ top: 0, behavior: 'smooth' });

                                    // 💡 고객에게 자동 적용되었다고 안심시켜주는 멘트로 변경!
                                    const msg = lang === 'ko'
                                        ? `🎁 '${selectedPromo.code}' 할인이 자동 적용되었습니다!\n화면에는 해당 프로모션이 가능한 객실만 표시됩니다.`
                                        : `🎁 Promo '${selectedPromo.code}' is now ACTIVE!\nWe've filtered the eligible rooms. The discount is automatically applied at checkout!`;
                                    setAlertMessage(msg);
                                }} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-black shadow-lg transition-transform active:scale-95 text-lg">
                                    RESERVE NOW
                                </button>
                            </div>
                        </div>
                    </div>
                )}


                {rewardPopup && (
                    <div className="fixed z-[1190] right-4 bottom-5 md:right-8 md:bottom-8 w-[calc(100vw-2rem)] max-w-md animate-fade-in">
                        <div className="relative overflow-hidden border border-amber-100 bg-white shadow-2xl">
                            <div
                                className="absolute inset-0 bg-cover bg-center opacity-35"
                                style={{ backgroundImage: `url(${sliderImages[0]})` }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-br from-white via-amber-50/95 to-emerald-50/90" />
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={dismissRewardPopup}
                                    className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center border border-slate-300 bg-white/80 text-lg font-black text-slate-700 hover:bg-white"
                                    aria-label="Close rewards popup"
                                >
                                    x
                                </button>
                                <div className="border-b border-amber-100 p-5 pr-12 md:p-6 md:pr-14">
                                    <div className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-700">Hotel Rewards</div>
                                    <h3 className="text-2xl font-black leading-tight text-slate-900">{rewardPopup.title || 'Rewards Program'}</h3>
                                    <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-700 whitespace-pre-wrap">
                                        {rewardPopup.message}
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
                                    {(rewardPopup.benefits || []).slice(0, 4).map((item, idx) => (
                                        <div key={`rw_benefit_${idx}`} className="border border-white/80 bg-white/85 p-3 shadow-sm backdrop-blur">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-emerald-600 text-white">
                                                    {renderRewardBenefitIcon(item.icon)}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-slate-900">{item.title}</div>
                                                    <div className="mt-0.5 text-xs font-semibold text-slate-600">{item.summary}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t border-amber-100 bg-white/70 p-5 backdrop-blur">
                                    <div className="mb-4 grid grid-cols-[120px_1fr] gap-2">
                                        <button
                                            type="button"
                                            onClick={dismissRewardPopup}
                                            className="border border-slate-300 bg-white py-3 font-black text-slate-700 hover:bg-slate-50"
                                        >
                                            Later
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                dismissRewardPopup();
                                                if ((rewardPopup?.ctaTarget || '').toUpperCase() === 'MYPAGE_REWARDS') {
                                                    sessionStorage.setItem('nplus_open_rewards', '1');
                                                }
                                                setActiveMenu('MYPAGE');
                                                if (!user) setShowGuestAuthModal(true);
                                            }}
                                            className="theme-bg py-3 font-black text-white shadow-lg theme-hover"
                                        >
                                            {rewardPopup.ctaLabel || 'View Rewards'}
                                        </button>
                                    </div>
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                        <input
                                            type="checkbox"
                                            checked={hideRewardPopupToday}
                                            onChange={(e) => setHideRewardPopupToday(e.target.checked)}
                                            className="h-4 w-4 accent-emerald-600"
                                        />
                                        Do not show again today
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* 💡 전역 알림(Alert) 모달창 */}                {alertMessage && (
                    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setAlertMessage('')}>
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center border border-slate-100" onClick={e => e.stopPropagation()}>
                            {/* 💡 헤더 색상을 브랜드 컬러로 변경 */}
                            <div className="theme-bg p-4 text-white flex justify-center items-center">
                                <h3 className="font-black text-lg">Notification</h3>
                            </div>
                            <div className="p-8 text-slate-700 font-bold text-[15px] whitespace-pre-wrap leading-relaxed">
                                {alertMessage}
                            </div>
                            <div className="p-4 bg-slate-50 border-t border-slate-100">
                                {/* 💡 확인 버튼 색상을 브랜드 컬러로 변경 */}
                                <button onClick={() => setAlertMessage('')} className="w-full theme-bg theme-hover text-white py-3.5 rounded-xl font-black transition-transform active:scale-95 shadow-md">
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 📱 푸터 */}
                {!hasSearched && (
                    <footer className="bg-white/90 backdrop-blur-md border-t border-slate-200 py-8 md:py-10 px-6 mt-auto relative z-10">
                        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="hidden md:block flex-1"></div>
                            <div className="flex-1 flex justify-center gap-4">
                                {sns?.ig && <a href={sns.ig.startsWith('http') ? sns.ig : `https://${sns.ig}`} target="_blank" rel="noreferrer" className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-pink-600 hover:bg-pink-600 hover:text-white hover:border-pink-600 transition-all shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16.11 7.99a.01.01 0 0 1 .02 0" /><path d="M15.82 12.18A4 4 0 1 1 11.82 8a4 4 0 0 1 4 4.18" /></svg></a>}
                                {sns?.fb && <a href={sns.fb.startsWith('http') ? sns.fb : `https://${sns.fb}`} target="_blank" rel="noreferrer" className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg></a>}
                            </div>
                            <div className="flex-1 flex justify-center md:justify-end w-full">
                                <p className="text-xs md:text-sm font-bold text-slate-500 text-center md:text-right">
                                    &copy; {new Date().getFullYear()} <span className="theme-text">{safeConfig.footer_company_name || safeConfig.welcome_title || "Our Hotel"}</span>. {t.rights}
                                </p>
                            </div>
                        </div>
                    </footer>
                )}

                {/* 💡 고객 인증(Auth) 모달창 */}
                {showGuestAuthModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4 animate-fade-in" onClick={() => setShowGuestAuthModal(false)}>
                        <div className="bg-white w-full max-w-[400px] overflow-hidden transform transition-all border border-slate-200 shadow-2xl rounded-3xl" onClick={e => e.stopPropagation()}>
                            <div className="p-8 overflow-y-auto max-h-[90vh] custom-scrollbar">
                                <div className="flex justify-end mb-2">
                                    <button onClick={() => setShowGuestAuthModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-light">&times;</button>
                                </div>

                                {guestAuthMode === 'LOGIN' ? (
                                    <div className="animate-fade-in-up">
                                        <h2 className="text-2xl font-black text-slate-800 mb-6 text-center">{t.loginTo}{safeConfig.welcome_title || 'Hotel'}</h2>
                                        <button type="button" onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 text-slate-600 font-bold py-3 hover:bg-slate-50 transition-colors mb-6 shadow-sm text-sm rounded-xl">
                                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                            </svg>
                                            {t.continueGoogle}
                                        </button>
                                        <div className="flex items-center mb-6">
                                            <div className="flex-1 border-t border-slate-200"></div>
                                            <span className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.or}</span>
                                            <div className="flex-1 border-t border-slate-200"></div>
                                        </div>
                                        <form onSubmit={handleAuthSubmit} className="space-y-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{t.email}</label>
                                                <input type="email" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} className="w-full p-3 border border-slate-300 focus:theme-border outline-none text-sm rounded-xl" placeholder="name@email.com" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{t.paymentMethod}</label>
                                                <div className="relative">
                                                    <input type={showLoginPassword ? "text" : "password"} required value={authForm.pw} onChange={(e) => setAuthForm({ ...authForm, pw: e.target.value })} className="w-full p-3 pr-16 border border-slate-300 focus:theme-border outline-none text-sm tracking-widest rounded-xl" placeholder="••••••••" />
                                                    <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-700">
                                                        {showLoginPassword ? 'Hide' : 'Show'}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex justify-end mt-1 mb-2">
                                                <button type="button" onClick={() => setGuestAuthMode('FORGOT_PASSWORD')} className="text-xs font-bold theme-text hover:underline">{t.forgotPw}</button>
                                            </div>
                                            <div className="pt-2">
                                                <button type="submit" className="w-full theme-bg text-white font-black py-3.5 rounded-xl theme-hover transition-colors shadow-md text-sm">{t.loginBtn}</button>
                                            </div>
                                        </form>
                                    </div>
                                ) : guestAuthMode === 'REGISTER' ? (
                                    <div className="animate-fade-in-up">
                                        <h2 className="text-2xl font-black text-slate-800 mb-6 text-center">{t.createAccount}</h2>
                                        <form onSubmit={handleAuthSubmit} className="space-y-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{t.email}</label>
                                                <input type="email" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} className="w-full p-3 border border-slate-300 focus:theme-border outline-none text-sm rounded-xl" placeholder="name@email.com" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{t.firstName}</label>
                                                    <input type="text" required value={authForm.first} onChange={(e) => setAuthForm({ ...authForm, first: e.target.value })} className="w-full p-3 border border-slate-300 focus:theme-border outline-none text-sm rounded-xl" placeholder="John" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{t.lastName}</label>
                                                    <input type="text" required value={authForm.last} onChange={(e) => setAuthForm({ ...authForm, last: e.target.value })} className="w-full p-3 border border-slate-300 focus:theme-border outline-none text-sm rounded-xl" placeholder="Doe" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{t.phone}</label>
                                                <input type="tel" required value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} className="w-full p-3 border border-slate-300 focus:theme-border outline-none text-sm rounded-xl" placeholder="09..." />
                                            </div>
                                            {renderAuthCountryField()}
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Referral Code (optional)</label>
                                                <input
                                                    type="text"
                                                    value={authForm.referralCode || ''}
                                                    onChange={(e) => setAuthForm({ ...authForm, referralCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                                                    className="w-full p-3 border border-slate-300 focus:theme-border outline-none text-sm rounded-xl uppercase tracking-widest"
                                                    placeholder="Enter referral code"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Password</label>
                                                <div className="relative">
                                                    <input type={showRegisterPassword ? "text" : "password"} required value={authForm.pw} onChange={(e) => setAuthForm({ ...authForm, pw: e.target.value })} className="w-full p-3 pr-16 border border-slate-300 focus:theme-border outline-none text-sm tracking-widest rounded-xl" placeholder="••••••••" />
                                                    <button type="button" onClick={() => setShowRegisterPassword(!showRegisterPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-700">
                                                        {showRegisterPassword ? 'Hide' : 'Show'}
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Confirm Password</label>
                                                <div className="relative">
                                                    <input type={showRegisterPasswordConfirm ? "text" : "password"} required value={authForm.pwConfirm} onChange={(e) => setAuthForm({ ...authForm, pwConfirm: e.target.value })} className="w-full p-3 pr-16 border border-slate-300 focus:theme-border outline-none text-sm tracking-widest rounded-xl" placeholder="••••••••" />
                                                    <button type="button" onClick={() => setShowRegisterPasswordConfirm(!showRegisterPasswordConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-700">
                                                        {showRegisterPasswordConfirm ? 'Hide' : 'Show'}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <button type="submit" className="w-full theme-bg text-white font-black py-3.5 rounded-xl theme-hover transition-colors shadow-md text-sm">{t.signUpBtn}</button>
                                            </div>
                                        </form>
                                    </div>
                                ) : guestAuthMode === 'GOOGLE_COMPLETE' ? (
                                    <div className="animate-fade-in-up">
                                        <h2 className="text-2xl font-black text-slate-800 mb-3 text-center">Complete Your Profile</h2>
                                        <p className="text-xs font-bold text-slate-500 mb-6 text-center leading-relaxed">Google sign up succeeded. Please add required profile details.</p>
                                        <form onSubmit={handleGoogleProfileComplete} className="space-y-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{t.email}</label>
                                                <input type="email" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} className="w-full p-3 border border-slate-300 focus:theme-border outline-none text-sm rounded-xl" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{t.firstName}</label>
                                                    <input type="text" required value={authForm.first} onChange={(e) => setAuthForm({ ...authForm, first: e.target.value })} className="w-full p-3 border border-slate-300 focus:theme-border outline-none text-sm rounded-xl" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{t.lastName}</label>
                                                    <input type="text" required value={authForm.last} onChange={(e) => setAuthForm({ ...authForm, last: e.target.value })} className="w-full p-3 border border-slate-300 focus:theme-border outline-none text-sm rounded-xl" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{t.phone}</label>
                                                <input type="tel" required value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} className="w-full p-3 border border-slate-300 focus:theme-border outline-none text-sm rounded-xl" />
                                            </div>
                                            {renderAuthCountryField()}
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Referral Code (optional)</label>
                                                <input
                                                    type="text"
                                                    value={authForm.referralCode || ''}
                                                    onChange={(e) => setAuthForm({ ...authForm, referralCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                                                    className="w-full p-3 border border-slate-300 focus:theme-border outline-none text-sm rounded-xl uppercase tracking-widest"
                                                    placeholder="Enter referral code"
                                                />
                                            </div>
                                            <div className="pt-2">
                                                <button type="submit" className="w-full theme-bg text-white font-black py-3.5 rounded-xl theme-hover transition-colors shadow-md text-sm">Save & Continue</button>
                                            </div>
                                        </form>
                                    </div>
                                ) : guestAuthMode === 'FORGOT_PASSWORD' ? (
                                    <div className="animate-fade-in-up">
                                        <h2 className="text-2xl font-black text-slate-800 mb-2 text-center">{t.resetPw}</h2>
                                        <p className="text-xs font-bold text-slate-500 mb-6 text-center leading-relaxed">{t.resetDesc}</p>
                                        <form onSubmit={(e) => { e.preventDefault(); setAlertMessage(t.resetSent); setGuestAuthMode('LOGIN'); }} className="space-y-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{t.regEmail}</label>
                                                <input type="email" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} className="w-full p-3 border border-slate-300 focus:theme-border outline-none text-sm rounded-xl" placeholder="name@email.com" />
                                            </div>
                                            <div className="pt-2">
                                                <button type="submit" className="w-full bg-slate-800 text-white font-black py-3.5 rounded-xl hover:bg-slate-700 transition-colors shadow-md text-sm">{t.sendReset}</button>
                                            </div>
                                            <div className="text-center pt-4">
                                                <button type="button" onClick={() => setGuestAuthMode('LOGIN')} className="text-xs font-bold text-slate-500 hover:underline flex items-center justify-center gap-1 mx-auto">
                                                    <span>←</span> {t.backLogin}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                ) : null}

                                {(guestAuthMode === 'LOGIN' || guestAuthMode === 'REGISTER') && (
                                    <div className="text-center pt-8 mt-8 border-t border-slate-100">
                                        {guestAuthMode === 'LOGIN' ? (
                                            <p className="text-sm font-bold text-slate-500">{t.noAccount}<button type="button" onClick={() => setGuestAuthMode('REGISTER')} className="theme-text hover:underline">{t.signUpLink}</button></p>
                                        ) : (
                                            <p className="text-sm font-bold text-slate-500">{t.hasAccount}<button type="button" onClick={() => setGuestAuthMode('LOGIN')} className="theme-text hover:underline">{t.loginLink}</button></p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 💡 예약 완료 모달창 */}
                {showBookingSuccessModal && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white rounded-[40px] p-8 md:p-10 max-w-sm w-full text-center shadow-2xl transform animate-scale-up">
                            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200">
                                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-emerald-600 font-black text-lg mb-1">Payment Success!</p>
                            <h2 className="text-3xl font-black text-slate-900 mb-2">Booking Confirmed!</h2>
                            <p className="text-slate-500 font-bold text-lg mb-8">Your stay is Secured.</p>
                            <div className="border-t border-slate-100 pt-8 mb-10">
                                <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] slashed-zero-font mb-4">Reservation ID</p>
                                <div className="border border-slate-300 rounded-xl py-4 px-2 inline-block bg-slate-50 w-full">
                                    <p className="text-3xl md:text-4xl font-black text-slate-800 tracking-widest truncate px-2"
                                        style={{ fontVariantNumeric: 'slashed-zero', fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}>
                                        {modalResId}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowBookingSuccessModal(false)} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all active:scale-95 text-lg">
                                Return to Home
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}




