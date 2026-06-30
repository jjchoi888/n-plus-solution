import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';

const TOP_COUNTRIES = ["Philippines", "South Korea", "China", "United States", "Japan"];
const ALL_COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

// 💡 [수정 1] 고정 객체 대신, 호텔 이름을 변수(hotelName)로 받아서 동적으로 문구를 생성하는 함수로 변경
const getTranslations = (hotelName) => ({
    EN: {
        welcome: `Welcome to ${hotelName}`, selectLang: "Select Language", methodTitle: "Check-in Method",
        resNum: "Reservation No.", resName: "Reservation Name", walkIn: "Walk-in", back: "Back", search: "Search",
        enterNum: "Enter Res Number", enterName: "Enter Full Name",
        roomTypes: "Select Room", noRooms: "No rooms available", pricePerNight: " / night",
        verifyID: "Guest Info & ID", scanID: "Upload ID / Passport",
        signHere: "Signature", clear: "Clear", complete: "Proceed to Secure Payment",
        successTitle: "You're all set!", successSub: "is ready. Please get your key at the Front Desk.", finish: "Done",
        agreeTerms: "I agree to the Terms & Conditions above.", agreeAlert: "Please agree to the Terms & Conditions to proceed.",
        termsDetail: "I agree that my liability for this bill is not waived and I agree to be held personally liable in the event that the indicated person, company, or association fails to pay for any part or the full amount of these charges, including any intentional property damage or violation of hotel policies (e.g., smoking). I authorize the hotel to bill these charges to my registered account."
    },
    KR: {
        welcome: `${hotelName} 모바일 체크인`, selectLang: "언어 선택", methodTitle: "체크인 방식",
        resNum: "예약 번호", resName: "예약자 이름", walkIn: "당일 방문 (워크인)", back: "뒤로", search: "조회",
        enterNum: "예약번호 입력 (예: RES123)", enterName: "영문 이름 입력",
        roomTypes: "객실 선택", noRooms: "빈 객실이 없습니다", pricePerNight: " / 1박",
        verifyID: "정보 입력 및 신분증", scanID: "신분증/여권 촬영",
        signHere: "전자 서명", clear: "지우기", complete: "결제창으로 이동하기",
        successTitle: "체크인 완료!", successSub: "준비되었습니다. 프런트에서 키를 받아주세요.", finish: "처음으로",
        agreeTerms: "위 약관에 동의합니다.", agreeAlert: "체크인을 진행하려면 약관에 동의해 주세요.",
        termsDetail: "본인은 객실 이용 중 발생하는 추가 요금(미니바 등) 및 고의적인 기물 파손, 호텔 규정 위반(객실 내 흡연 등)에 대한 전적인 배상 책임이 있음에 동의하며, 발생한 모든 비용이 즉시 청구되는 것을 승인합니다."
    },
    CN: {
        welcome: `欢迎来到 ${hotelName}`, selectLang: "选择语言", methodTitle: "入住方式",
        resNum: "预订号", resName: "预订姓名", walkIn: "直接入住", back: "返回", search: "搜索",
        enterNum: "输入预订号", enterName: "输入姓名",
        roomTypes: "选择房型", noRooms: "无可用客房", pricePerNight: " / 晚",
        verifyID: "信息与证件", scanID: "上传身份证/护照",
        signHere: "签名", clear: "清除", complete: "前往安全付款",
        successTitle: "办理完成！", successSub: "已准备好。请到前台领取房卡。", finish: "完成",
        agreeTerms: "我同意上述条款和条件。", agreeAlert: "请同意条款和条件以继续。",
        termsDetail: "我同意我对该账单的责任不可免除，并且我同意在指定人员、公司或协会未能支付部分或全部这些费用时承担个人责任。"
    },
    JP: {
        welcome: `${hotelName}へようこそ`, selectLang: "言語を選択", methodTitle: "チェックイン方法",
        resNum: "予約番号", resName: "予約名", walkIn: "当日チェックイン", back: "戻る", search: "検索",
        enterNum: "予約番号を入力", enterName: "フルネームを入力",
        roomTypes: "お部屋を選択", noRooms: "空室なし", pricePerNight: " / 泊",
        verifyID: "情報入力・身分証明書", scanID: "身分証・パスポートを撮影",
        signHere: "署名", clear: "クリア", complete: "決済画面へ進む",
        successTitle: "完了しました！", successSub: "の準備ができました。フロントでキーをお受け取りください。", finish: "終了",
        agreeTerms: "上記の利用規約に同意します。", agreeAlert: "チェックインを進めるには、利用規約に同意してください。",
        termsDetail: "私は、本請求書に対する責任を免除されないことに同意し、指定された個人、会社、または団体がこれらの料金の一部または全部を支払わない場合、個人的に責任を負うことに同意します。"
    }
});

export default function MobileCheckin() {
    const queryParams = new URLSearchParams(window.location.search);
    const currentHotelCode = queryParams.get('hotel') || localStorage.getItem('hotelCode') || '';

    // 💡 [수정 2] 호텔 이름과 체크아웃 기준 시간 상태 추가
    const [hotelName, setHotelName] = useState('N Plus Hotel');
    const [hotelCheckOutHour, setHotelCheckOutHour] = useState(11);

    // 💡 [수정 3] 서버에서 호텔 이름과 시간 설정을 불러옵니다.
    useEffect(() => {
        if (currentHotelCode) {
            // 호텔 이름 불러오기
            fetch(`/api/receipt-settings?hotel=${currentHotelCode}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.header_text) setHotelName(data.header_text);
                }).catch(e => console.log(e));

            // 호텔 체크아웃 기준 시간 불러오기
            fetch(`/api/settings/times?hotel=${currentHotelCode}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.checkOut) {
                        setHotelCheckOutHour(parseInt(data.checkOut.split(':')[0], 10));
                    }
                }).catch(e => console.log(e));
        }
    }, [currentHotelCode]);

    // 💡 [수정 4] 이제 하드코딩된 '12시'가 아닌 호텔의 공식 체크아웃 시간을 기준으로 날짜를 계산합니다.
    const getHotelDate = (offsetDays = 0) => {
        const now = new Date();
        if (now.getHours() < hotelCheckOutHour) {
            now.setDate(now.getDate() - 1);
        }
        now.setDate(now.getDate() + offsetDays);
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // 💡 [수정 및 강화] 결제 결과 리다이렉트 처리 로직 (취소/실패 방어막 및 URL 청소 추가)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const paymentStatus = params.get('payment');
        const roomId = params.get('room');
        const txId = params.get('tx_id');

        if (paymentStatus === 'success' && roomId) {
            setStep(5);
            setAssignedRoom({ id: roomId });

            const pendingStr = localStorage.getItem('pendingFinanceRecord');
            if (pendingStr) {
                try {
                    const pendingData = JSON.parse(pendingStr);
                    fetch('/api/payment/checkin-success', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            hotel_code: currentHotelCode,
                            room_id: roomId,
                            tx_id: txId || pendingData.txId,
                            amount: pendingData.amount
                        })
                    }).catch(e => console.error("Check-in success fallback error:", e));
                    // 결제가 완전히 성공했을 때만 장부에 올립니다.
                    fetch('/api/finance/transactions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            date: getHotelDate(0),
                            type: 'REVENUE',
                            category: pendingData.isWalkIn ? 'Walk-in Full Pay' : 'Deposit Only',
                            amount: pendingData.amount,
                            description: `Room ${roomId} Paid via PaynPlus (${pendingData.txId})`,
                            hotel_code: currentHotelCode
                        })
                    }).then(() => {
                        localStorage.removeItem('pendingFinanceRecord');
                    }).catch(e => console.error("Ledger save error:", e));
                } catch (e) { console.error("Parse error:", e); }
            }

            // 💡 [핵심] 성공 후 새로고침(F5) 시 중복 실행 방지를 위해 주소창의 꼬리표를 청소합니다.
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?hotel=${currentHotelCode}`;
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);

        } else if (paymentStatus === 'cancel' || paymentStatus === 'failed') {
            // 💡 [방어막] 결제창에서 이탈하거나 에러가 났을 때 안내 및 임시 데이터 삭제
            alert("❌ Payment was not completed. Please try again.");
            setIsProcessing(false);
            localStorage.removeItem('pendingFinanceRecord');

            // URL 꼬리표 청소
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?hotel=${currentHotelCode}`;
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        }
    }, [currentHotelCode, hotelCheckOutHour]);

    const [lang, setLang] = useState('EN');
    // 💡 [수정 5] 동적으로 불러온 호텔 이름을 다국어 번역 함수에 전달합니다.
    const t = getTranslations(hotelName)[lang];

    const [step, setStep] = useState(1);
    const [method, setMethod] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [dbRoomTypes, setDbRoomTypes] = useState([]);
    const [availableRooms, setAvailableRooms] = useState([]);
    const [reservation, setReservation] = useState(null);
    const [assignedRoom, setAssignedRoom] = useState(null);

    const [guestInfo, setGuestInfo] = useState({ firstName: '', lastName: '', guestName: '', nationality: '', email: '', phone: '', check_in_date: getHotelDate(0), check_out_date: '' });
    const [idImage, setIdImage] = useState(null);
    const [termsAgreed, setTermsAgreed] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const checkInD = new Date(guestInfo.check_in_date || getHotelDate(0));
    const checkOutD = new Date(guestInfo.check_out_date || getHotelDate(1));
    let nights = Math.ceil((checkOutD - checkInD) / 86400000);
    if (nights < 1 || isNaN(nights)) nights = 1;

    let securityDeposit = 2000;
    let basePrice = 0;

    if (assignedRoom && dbRoomTypes.length > 0) {
        const matchedRt = dbRoomTypes.find(rt => String(rt.name).trim().toLowerCase() === String(assignedRoom.room_type || assignedRoom.name).trim().toLowerCase());
        if (matchedRt) {
            basePrice = Number(matchedRt.price) || 0;
            let rtConfig = matchedRt.roomConfig || {};
            if (typeof rtConfig === 'string') { try { rtConfig = JSON.parse(rtConfig); } catch (e) { } }
            if (rtConfig && rtConfig.deposit !== undefined) {
                securityDeposit = Number(rtConfig.deposit);
            }
        }
    }

    const roomTotal = reservation ? 0 : (basePrice * nights);
    const grandTotal = roomTotal + securityDeposit;

    const sigCanvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        if (!currentHotelCode) return;

        const fetchCheckinData = () => {
            fetch(`/api/room-types?hotel=${currentHotelCode}`)
                .then(res => res.json())
                .then(setDbRoomTypes);

            fetch(`/api/rooms?hotel=${currentHotelCode}&t=${Date.now()}`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setAvailableRooms(data.filter(r => r.status === 'VACANT'));
                    }
                });
        };

        fetchCheckinData();

        const socketUrl = import.meta.env.VITE_API_URL || 'https://api.hotelnplus.com';
        const socket = io(socketUrl, { transports: ['websocket'] });

        socket.on('db_updated', (data) => {
            if (data.hotel_code === currentHotelCode || data.hotel_code === 'ALL') {
                fetchCheckinData();
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [currentHotelCode]);

    const handleIdUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_WIDTH = 800;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                setIdImage(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    };

    const startDrawing = ({ nativeEvent }) => {
        let offsetX, offsetY;
        if (nativeEvent.touches) {
            const rect = sigCanvasRef.current.getBoundingClientRect();
            offsetX = nativeEvent.touches[0].clientX - rect.left;
            offsetY = nativeEvent.touches[0].clientY - rect.top;
        } else { offsetX = nativeEvent.offsetX; offsetY = nativeEvent.offsetY; }
        const ctx = sigCanvasRef.current.getContext('2d');
        ctx.beginPath(); ctx.lineWidth = 2; ctx.strokeStyle = "#000"; ctx.moveTo(offsetX, offsetY); setIsDrawing(true);
    };

    const draw = ({ nativeEvent }) => {
        if (!isDrawing) return;
        let offsetX, offsetY;
        if (nativeEvent.touches) {
            const rect = sigCanvasRef.current.getBoundingClientRect();
            offsetX = nativeEvent.touches[0].clientX - rect.left;
            offsetY = nativeEvent.touches[0].clientY - rect.top;
        } else { offsetX = nativeEvent.offsetX; offsetY = nativeEvent.offsetY; }
        const ctx = sigCanvasRef.current.getContext('2d');
        ctx.lineTo(offsetX, offsetY); ctx.stroke();
    };

    const stopDrawing = () => setIsDrawing(false);
    const clearSignature = () => {
        const canvas = sigCanvasRef.current;
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSearch = async () => {
        if (!searchQuery) return;
        const res = await fetch('/api/reservations/search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: method, query: searchQuery, hotel_code: currentHotelCode })
        });
        const data = await res.json();

        if (data.success) {
            const resData = data.reservation;
            const hotelToday = getHotelDate(0);
            if (resData.check_in_date !== hotelToday) {
                return alert(lang === 'KR' ? `체크인은 예약하신 도착일(${resData.check_in_date})에만 가능합니다.` : `Check-in available only on your arrival date (${resData.check_in_date}).`);
            }

            setReservation(resData);

            const nameParts = (resData.guest_name || '').trim().split(' ');
            setGuestInfo({
                ...guestInfo,
                firstName: nameParts[0] || '', lastName: nameParts.slice(1).join(' ') || '', guestName: resData.guest_name || '',
                check_in_date: resData.check_in_date || hotelToday, check_out_date: resData.check_out_date || '',
                nationality: resData.nationality || '', email: resData.email || '', phone: resData.phone || ''
            });

            const room = availableRooms.find(r => String(r.room_type).trim().toLowerCase() === String(resData.room_type).trim().toLowerCase());
            if (room) { setAssignedRoom(room); setStep(4); }
            else { alert(t.noRooms); }
        } else { alert(data.message); }
    };

    const handleWalkInSelect = (roomType) => {
        const room = availableRooms.find(r => String(r.room_type).trim().toLowerCase() === String(roomType.name).trim().toLowerCase());
        if (room) {
            setAssignedRoom(room);
            const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
            setGuestInfo({ ...guestInfo, check_in_date: getHotelDate(0), check_out_date: tomorrow.toISOString().split('T')[0] });
            setStep(4);
        } else { alert(t.noRooms); }
    };

    const submitCheckIn = async () => {
        // 💡 [추가] 중복 터치/클릭 완벽 차단! (모바일 환경 필수 방어막)
        if (isProcessing) return;

        if (!termsAgreed) return alert(t.agreeAlert);
        if (!guestInfo.firstName || !guestInfo.lastName || !idImage) {
            return alert("Please enter your First/Last name and scan your ID.");
        }

        const fullName = `${guestInfo.firstName} ${guestInfo.lastName}`.trim();
        let signatureData = '';
        if (sigCanvasRef.current) {
            signatureData = sigCanvasRef.current.toDataURL('image/png'); // 투명도 유지 PNG
        }

        setIsProcessing(true); // 💡 여기서부터 버튼 비활성화 & 로딩 시작

        try {
            const tempTxId = `CHK_${assignedRoom.id}_${Date.now()}`;

            // 💡 [핵심 혁신] OCCUPIED가 아니라 PENDING_PAYMENT로 설정!
            const checkinRes = await fetch('/api/rooms/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: assignedRoom.id,
                    status: 'PENDING_PAYMENT',
                    ...guestInfo,
                    guestName: fullName,
                    signature: signatureData,
                    id_image: idImage,
                    room_type: assignedRoom.room_type || assignedRoom.name,
                    deposit: securityDeposit,
                    total_amount: grandTotal,
                    hotel_code: currentHotelCode,
                    transaction_id: tempTxId
                })
            });

            if (checkinRes.ok) {
                // paynplus 결제 링크 요청
                const paymentRes = await fetch('/api/payment/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: grandTotal,
                        guest_info: { guestName: fullName, email: guestInfo.email, phone: guestInfo.phone },
                        hotel_code: currentHotelCode,
                        room_id: assignedRoom.id,
                        tx_id: tempTxId
                    })
                });

                const paymentData = await paymentRes.json();

                if (paymentRes.ok && paymentData.paymentUrl) {
                    // 장부 기록용 임시 저장
                    localStorage.setItem('pendingFinanceRecord', JSON.stringify({
                        amount: grandTotal,
                        isWalkIn: !reservation,
                        txId: tempTxId
                    }));

                    // 💡 [유지] 성공 시 setIsProcessing(false) 없이 즉시 결제창으로 진입! (깜빡임 완벽 차단)
                    window.location.href = paymentData.paymentUrl;
                } else {
                    alert(`Payment Server Error: ${paymentData.message || 'Could not generate payment link'}`);
                    setIsProcessing(false); // 실패 시에만 로딩 해제
                }
            } else {
                alert("Check-in processing failed.");
                setIsProcessing(false); // 실패 시에만 로딩 해제
            }
        } catch (error) {
            console.error("Check-in Error:", error);
            alert("Network error. Please try again.");
            setIsProcessing(false); // 에러 시에만 로딩 해제
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans flex flex-col relative select-none">
            <div className="p-4 bg-slate-900 text-center shadow-md shrink-0">
                <h1 className="text-xl font-black text-teal-400 tracking-widest uppercase">Mobile Check-in</h1>
                {/* 💡 [수정 6] 동적으로 변경된 환영 메시지 출력 */}
                <p className="text-slate-300 text-xs mt-1">{t.welcome}</p>
            </div>

            <div className="flex-1 flex flex-col p-4 overflow-y-auto">
                {step === 1 && (
                    <div className="flex-1 flex flex-col justify-center animate-fade-in">
                        <h2 className="text-xl font-bold text-center mb-6 text-slate-800">{t.selectLang}</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => { setLang('EN'); setStep(2); }} className="bg-white hover:bg-slate-100 border border-slate-200 p-6 rounded-md text-lg font-black shadow-sm flex flex-col items-center gap-2"><span className="text-teal-600">EN</span> English</button>
                            <button onClick={() => { setLang('KR'); setStep(2); }} className="bg-white hover:bg-slate-100 border border-slate-200 p-6 rounded-md text-lg font-black shadow-sm flex flex-col items-center gap-2"><span className="text-teal-600">KR</span> 한국어</button>
                            <button onClick={() => { setLang('CN'); setStep(2); }} className="bg-white hover:bg-slate-100 border border-slate-200 p-6 rounded-md text-lg font-black shadow-sm flex flex-col items-center gap-2"><span className="text-teal-600">CN</span> 中文</button>
                            <button onClick={() => { setLang('JP'); setStep(2); }} className="bg-white hover:bg-slate-100 border border-slate-200 p-6 rounded-md text-lg font-black shadow-sm flex flex-col items-center gap-2"><span className="text-teal-600">JP</span> 日本語</button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="flex-1 flex flex-col justify-center animate-fade-in">
                        <button onClick={() => setStep(1)} className="mb-4 text-slate-500 font-bold self-start text-sm">⬅ {t.back}</button>
                        <h2 className="text-xl font-bold text-center mb-6 text-slate-800">{t.methodTitle}</h2>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => { setMethod('number'); setStep(3); }} className="bg-white border border-slate-200 p-5 rounded-md font-bold shadow-sm flex items-center gap-4"><span className="text-2xl">🔢</span> {t.resNum}</button>
                            <button onClick={() => { setMethod('name'); setStep(3); }} className="bg-white border border-slate-200 p-5 rounded-md font-bold shadow-sm flex items-center gap-4"><span className="text-2xl">🔤</span> {t.resName}</button>
                            <button onClick={() => { setMethod('walkin'); setStep(3); }} className="bg-white border border-slate-200 p-5 rounded-md font-bold shadow-sm flex items-center gap-4"><span className="text-2xl">🚶‍♂️</span> {t.walkIn}</button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="animate-fade-in flex flex-col pt-4">
                        <button onClick={() => setStep(2)} className="mb-6 text-slate-500 font-bold self-start text-sm">⬅ {t.back}</button>
                        {method === 'walkin' ? (
                            <div>
                                <h2 className="text-xl font-bold mb-4 text-slate-800">{t.roomTypes}</h2>
                                <div className="flex flex-col gap-3">
                                    {dbRoomTypes.map(rt => {
                                        const count = availableRooms.filter(r => String(r.room_type).trim().toLowerCase() === String(rt.name).trim().toLowerCase()).length;
                                        return (
                                            <button key={rt.id} onClick={() => handleWalkInSelect(rt)} disabled={count === 0} className="bg-white border border-slate-200 p-4 rounded-md text-left disabled:opacity-50 flex justify-between items-center shadow-sm">
                                                <div><div className="text-lg font-black text-slate-800">{rt.name}</div><div className="text-xs font-bold text-slate-500 mt-1">{count > 0 ? `${count} Rooms` : t.noRooms}</div></div>
                                                <div className="text-right"><div className="text-lg font-black text-teal-600">₱{rt.price.toLocaleString()}</div><div className="text-[10px] text-slate-400">{t.pricePerNight}</div></div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col flex-1 mt-10">
                                <h2 className="text-xl font-bold mb-4 text-slate-800 text-center">{method === 'number' ? t.enterNum : t.enterName}</h2>
                                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full p-4 text-lg font-bold text-center bg-white border border-slate-300 rounded-md mb-4 focus:outline-none focus:border-teal-500 shadow-sm" />
                                <button onClick={handleSearch} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-md text-lg font-black shadow-md">{t.search}</button>
                            </div>
                        )}
                    </div>
                )}

                {step === 4 && (
                    <div className="animate-fade-in pb-10">
                        <div className="bg-teal-50 border border-teal-100 p-4 rounded-md mb-6 mt-2">
                            <p className="text-teal-800 font-bold text-sm text-center">Room Assigned: <span className="font-black text-lg ml-1">{assignedRoom?.id}</span></p>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="flex gap-3">
                                <input type="text" placeholder="First Name" value={guestInfo.firstName} onChange={e => setGuestInfo({ ...guestInfo, firstName: e.target.value })} className="w-1/2 p-3.5 bg-white border border-slate-300 rounded-md text-sm font-bold shadow-sm focus:outline-none focus:border-teal-500" />
                                <input type="text" placeholder="Last Name" value={guestInfo.lastName} onChange={e => setGuestInfo({ ...guestInfo, lastName: e.target.value })} className="w-1/2 p-3.5 bg-white border border-slate-300 rounded-md text-sm font-bold shadow-sm focus:outline-none focus:border-teal-500" />
                            </div>

                            <select value={guestInfo.nationality} onChange={e => setGuestInfo({ ...guestInfo, nationality: e.target.value })} className="w-full p-3.5 bg-white border border-slate-300 rounded-md text-sm font-bold shadow-sm focus:outline-none focus:border-teal-500 cursor-pointer text-slate-700">
                                <option value="">Select Nationality...</option>
                                {TOP_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                <option disabled>──────────</option>
                                {ALL_COUNTRIES.filter(c => !TOP_COUNTRIES.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>

                            <input type="email" placeholder="Email" value={guestInfo.email} onChange={e => setGuestInfo({ ...guestInfo, email: e.target.value })} className="w-full p-3.5 bg-white border border-slate-300 rounded-md text-sm font-bold shadow-sm focus:outline-none focus:border-teal-500" />
                            <input type="tel" placeholder="Phone Number" value={guestInfo.phone} onChange={e => setGuestInfo({ ...guestInfo, phone: e.target.value })} className="w-full p-3.5 bg-white border border-slate-300 rounded-md text-sm font-bold shadow-sm focus:outline-none focus:border-teal-500" />

                            <div className="flex gap-3">
                                <div className="w-1/2">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 ml-1">Check-in</label>
                                    <input type="date" value={guestInfo.check_in_date} onChange={e => setGuestInfo({ ...guestInfo, check_in_date: e.target.value })} className="w-full p-3.5 bg-white border border-slate-300 rounded-md text-sm font-bold shadow-sm focus:outline-none focus:border-teal-500 text-slate-700" />
                                </div>
                                <div className="w-1/2">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 ml-1">Check-out</label>
                                    <input type="date" value={guestInfo.check_out_date} onChange={e => setGuestInfo({ ...guestInfo, check_out_date: e.target.value })} className="w-full p-3.5 bg-white border border-slate-300 rounded-md text-sm font-bold shadow-sm focus:outline-none focus:border-teal-500 text-slate-700" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-md border border-slate-300 shadow-sm mb-6">
                            <label className="font-bold text-sm text-slate-700 block mb-2">{t.scanID}</label>
                            {idImage ? (
                                <div className="relative"><img src={idImage} alt="ID" className="w-full aspect-[4/3] object-cover rounded-md border border-slate-200" /><button onClick={() => setIdImage(null)} className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-md text-xs font-bold shadow-md">Retake</button></div>
                            ) : (
                                <div className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded-md aspect-[4/3] w-full min-h-[200px] bg-slate-50 relative overflow-hidden">
                                    <input type="file" accept="image/*" capture="environment" onChange={handleIdUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                    <div className="flex flex-col items-center text-slate-400"><span className="text-4xl mb-2">📷</span><span className="text-sm font-bold">Tap to Camera</span></div>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-md p-4 mb-4 text-left">
                            <h4 className="text-xs font-black text-slate-700 mb-3 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2"><span>⚖️</span> Terms & Conditions</h4>
                            <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                <p className="text-[10px] md:text-[11px] text-slate-600 leading-relaxed break-keep">
                                    {t.termsDetail}
                                </p>
                            </div>
                        </div>

                        <div className="mb-6 flex items-center gap-3 bg-white p-4 rounded-md border border-slate-300 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer" onClick={() => setTermsAgreed(!termsAgreed)}>
                            <input type="checkbox" checked={termsAgreed} onChange={(e) => setTermsAgreed(e.target.checked)} onClick={(e) => e.stopPropagation()} className="w-5 h-5 text-teal-600 border-slate-300 rounded focus:ring-teal-500 cursor-pointer" />
                            <label className="text-sm font-bold text-slate-700 cursor-pointer select-none">{t.agreeTerms}</label>
                        </div>

                        <div className="bg-white p-4 rounded-md border border-slate-300 shadow-sm mb-8 relative">
                            <div className="flex justify-between items-end mb-2"><label className="font-bold text-sm text-slate-700">{t.signHere}</label><button onClick={clearSignature} className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-1 rounded border border-slate-200">{t.clear}</button></div>
                            <div className="w-full flex justify-center bg-slate-50 rounded-md border border-slate-200 overflow-hidden relative">
                                {!termsAgreed && (<div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center"><span className="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-lg">Please check the agreement first</span></div>)}
                                <canvas ref={sigCanvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} width={300} height={120} className="cursor-crosshair touch-none" />
                            </div>
                        </div>

                        {/* 💡 [신규 추가] 다국어 지원 및 보증금 안내가 포함된 Payment Summary */}
                        <div className="bg-white p-5 rounded-md border border-slate-300 shadow-sm mb-6 text-left">
                            <h4 className="font-black text-slate-800 text-lg mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                                💳 {{ EN: "Payment Summary", KR: "결제 요약", CN: "费用明细", JP: "会計要約" }[lang]}
                            </h4>

                            <div className="space-y-3 mb-4 text-sm text-slate-600 font-bold">
                                {!reservation && (
                                    <div className="flex justify-between items-center">
                                        <span>{{ EN: `Room Rate (${nights} nights)`, KR: `객실 요금 (${nights}박)`, CN: `房费 (${nights}晚)`, JP: `客室料金 (${nights}泊)` }[lang]}</span>
                                        <span className="text-slate-800">₱{roomTotal.toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center">
                                    <span>{{ EN: "Security Deposit (Refundable)", KR: "보증금 (퇴실 시 환불)", CN: "安全押金 (可退还)", JP: "保証金 (チェックアウト時返金)" }[lang]}</span>
                                    <span className="text-teal-600">₱{securityDeposit.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-lg font-black text-teal-600 pt-4 border-t border-slate-200 mt-2">
                                    <span>{{ EN: "Total Due", KR: "총 결제 금액", CN: "应付总额", JP: "合計金額" }[lang]}</span>
                                    <span>₱{grandTotal.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* 노란색 경고/안내 패널 */}
                            <div className="text-[10px] md:text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-md leading-relaxed">
                                {{
                                    EN: "⚠️ Notice: The security deposit is fully refundable upon check-out after room inspection.",
                                    KR: "⚠️ 안내: 보증금은 체크아웃 시 객실 점검 후 전액 환불 처리됩니다.",
                                    CN: "⚠️ 提示：退房时经客房检查无误后，押金将全额退还。",
                                    JP: "⚠️ ご案内：保証金はチェックアウト時、お部屋の確認後に全額返金されます。"
                                }[lang]}
                            </div>
                        </div>

                        <button onClick={submitCheckIn} disabled={isProcessing} className="w-full bg-teal-600 hover:bg-teal-500 text-white py-4 md:py-5 rounded-md font-black text-lg shadow-lg disabled:bg-slate-400 disabled:scale-100 transition-transform active:scale-95">
                            {isProcessing
                                ? 'Connecting to Payment...'
                                : (lang === 'KR'
                                    ? `결제창으로 이동하기 (Pay ₱${grandTotal.toLocaleString()})`
                                    : `${t.complete} (Pay ₱${grandTotal.toLocaleString()})`
                                )
                            }
                        </button>
                    </div>
                )}

                {/* 💡 [가시성 개선 완료] 방 번호와 텍스트를 거대하게 키운 Step 5 화면 */}
                {step === 5 && (
                    <div className="flex-1 flex flex-col justify-center items-center text-center animate-fade-in mt-6 px-4 w-full">
                        <div className="text-7xl md:text-8xl mb-6">🎉</div>

                        <h2 className="text-3xl md:text-4xl font-black mb-2 text-slate-800 tracking-wide">{t.successTitle}</h2>

                        <p className="text-lg md:text-xl text-slate-500 mb-8 font-medium">
                            Welcome, <span className="font-black text-slate-800">{guestInfo.firstName} {guestInfo.lastName}</span>!
                        </p>

                        <div className="text-3xl md:text-4xl font-bold text-slate-500 my-4 flex items-center justify-center gap-3">
                            <span>Room</span>
                            <span className="text-5xl md:text-6xl font-black text-teal-500 tracking-wider font-mono animate-pulse slashed-zero-font">
                                {assignedRoom?.id}
                            </span>
                            <span>is ready.</span>
                        </div>

                        <p className="text-sm md:text-base text-slate-500 font-bold mb-12 leading-relaxed">
                            Please get your key at the Front Desk.
                        </p>

                        <button
                            onClick={() => {
                                setStep(1); setAssignedRoom(null); setReservation(null); setMethod(''); setSearchQuery('');
                                setGuestInfo({ firstName: '', lastName: '', guestName: '', nationality: '', email: '', phone: '', check_in_date: getHotelDate(0), check_out_date: '' });
                                setIdImage(null); setTermsAgreed(false); window.history.replaceState(null, '', window.location.pathname);
                            }}
                            className="bg-slate-900 hover:bg-slate-800 px-12 py-4 rounded-xl text-base md:text-lg font-black transition-all text-white shadow-lg w-full max-w-[250px]"
                        >
                            {lang === 'KR' ? '완료' : 'Done'}
                        </button>
                    </div>
                )}        
            </div>
        </div>
    );
}