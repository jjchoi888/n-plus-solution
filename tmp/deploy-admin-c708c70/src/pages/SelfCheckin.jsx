import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const TOP_COUNTRIES = ["Philippines", "South Korea", "China", "United States", "Japan"];
const ALL_COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

// 💡 [수정] 고정된 객체 대신, 호텔 이름을 변수(hotelName)로 받아서 동적으로 문구를 생성하는 함수로 변경합니다.
const getTranslations = (hotelName) => ({
    EN: {
        welcome: `Welcome to ${hotelName}`, selectLang: "Please select your language", methodTitle: "How would you like to check in?",
        resNum: "Reservation Number", resName: "Reservation Name", walkIn: "Walk-in", back: "Back", search: "Search",
        enterNum: "Enter Reservation Number (e.g. RES12345)", enterName: "Enter Full Name (e.g. Alice Smith)",
        roomTypes: "Select Room Type", noRooms: "No rooms available", pricePerNight: " / night",
        verifyID: "ID Verification", scanID: "Please scan your ID or Passport", takePhoto: "Take Photo",
        signHere: "Guest Signature", clear: "Clear", complete: "Proceed to Secure Payment",
        successTitle: "You're all set!", successSub: "is ready for you. Please collect your room key from the Front Desk.", finish: "Finish",
        agreeTerms: "I agree to the Terms & Conditions above.", agreeAlert: "Please agree to the Terms & Conditions to proceed.",
        termsDetail: "I agree that my liability for this bill is not waived and I agree to be held personally liable in the event that the indicated person, company, or association fails to pay for any part or the full amount of these charges, including any intentional property damage or violation of hotel policies (e.g., smoking). I authorize the hotel to bill these charges to my registered account."
    },
    KR: {
        welcome: `${hotelName}에 오신 것을 환영합니다`, selectLang: "언어를 선택해 주세요", methodTitle: "체크인 방식을 선택해 주세요",
        resNum: "예약 번호", resName: "예약자 이름", walkIn: "당일 방문 (워크인)", back: "뒤로", search: "검색",
        enterNum: "예약 번호 입력 (예: RES12345)", enterName: "영문 이름 입력 (예: Alice Smith)",
        roomTypes: "객실 타입 선택", noRooms: "이용 가능한 객실이 없습니다", pricePerNight: " / 1박",
        verifyID: "신분증 확인", scanID: "신분증 또는 여권을 촬영해 주세요", takePhoto: "촬영하기",
        signHere: "전자 서명", clear: "지우기", complete: "결제창으로 이동하기",
        successTitle: "체크인 완료!", successSub: "준비되었습니다. 프런트 데스크에서 룸 키를 수령해 주세요.", finish: "처음으로",
        agreeTerms: "위 약관에 동의합니다.", agreeAlert: "체크인을 진행하려면 약관에 동의해 주세요.",
        termsDetail: "본인은 객실 이용 중 발생하는 추가 요금(미니바 등) 및 고의적인 기물 파손, 호텔 규정 위반(객실 내 흡연 등)에 대한 전적인 배상 책임이 있음에 동의하며, 발생한 모든 비용이 등록된 예약자 정보(또는 결제 수단)로 즉시 청구되는 것을 승인합니다. 본 서명으로 이 약관에 법적으로 동의함을 확인합니다."
    },
    CN: {
        welcome: `欢迎来到 ${hotelName}`, selectLang: "请选择您的语言", methodTitle: "您想如何办理入住？",
        resNum: "预订号", resName: "预订姓名", walkIn: "直接入住", back: "返回", search: "搜索",
        enterNum: "输入预订号 (例如: RES12345)", enterName: "输入姓名 (例如: Alice Smith)",
        roomTypes: "选择房型", noRooms: "没有可用客房", pricePerNight: " / 晚",
        verifyID: "身份验证", scanID: "请拍摄您的身份证或护照", takePhoto: "拍照",
        signHere: "电子签名", clear: "清除", complete: "前往安全付款",
        successTitle: "办理完成！", successSub: "已为您准备好。请到前台领取房卡。", finish: "完成",
        agreeTerms: "我同意上述条款和条件。", agreeAlert: "请同意条款和条件以继续。",
        termsDetail: "本人同意对客房使用期间产生的额外费用（如迷你吧等）、蓄意破坏酒店财物或违反酒店规定（如室内吸烟等）承担全额赔偿责任，并授权酒店将所有相关费用直接计入登记的预订人账户（或支付方式）。本签名即表示在法律上同意此条款。"
    },
    JP: {
        welcome: `${hotelName}へようこそ`, selectLang: "言語を選択してください", methodTitle: "チェックイン方法を選択してください",
        resNum: "予約番号", resName: "予約名", walkIn: "当日チェックイン", back: "戻る", search: "検索",
        enterNum: "予約番号を入力 (例: RES12345)", enterName: "フルネームを入力 (例: Alice Smith)",
        roomTypes: "お部屋のタイプを選択", noRooms: "空室がありません", pricePerNight: " / 泊",
        verifyID: "身分証明書の確認", scanID: "身分証明書またはパスポートを撮影してください", takePhoto: "撮影する",
        signHere: "電子署名", clear: "クリア", complete: "決済画面へ進む",
        successTitle: "チェックインが完了しました！", successSub: "お部屋の準備ができました。フロントでルームキーをお受け取りください。", finish: "終了",
        agreeTerms: "上記の利用規約に同意します。", agreeAlert: "チェックインを進めるには、利用規約に同意してください。",
        termsDetail: "私は、客室利用中に発生した追加料金（ミニバーなど）、意図的な器物破損、またはホテル規約違反（室内での喫煙など）に対する賠償責任に同意し、発生したすべての費用が登録された予約者情報（または決済手段）に請求されることを承認します。本署名により、この規約に法的に同意したものとみなされます。"
    }
});

export default function SelfCheckin() {
    const navigate = useNavigate();
    const urlParams = new URLSearchParams(window.location.search);
    const currentHotelCode = urlParams.get('hotel') || sessionStorage.getItem('hotelCode') || localStorage.getItem('hotelCode') || '';

    // 1. 호텔 이름을 관리할 상태 추가 (기본값 설정)
    const [hotelName, setHotelName] = useState('N Plus Hotel');

    // 2. 서버에서 실제 호텔 이름을 불러오는 로직 (기존 useEffect 아래나 위에 추가)
    useEffect(() => {
        if (currentHotelCode) {
            // 영수증 설정 API에서 등록된 호텔 이름을 가져옵니다.
            fetch(`/api/receipt-settings?hotel=${currentHotelCode}`)
                .then(res => res.json())
                .then(data => {
                    // header_text 필드에 저장된 이름을 사용합니다.
                    if (data && data.header_text) {
                        setHotelName(data.header_text);
                    }
                })
                .catch(e => console.error("Failed to load the hotel name.", e));
        }
    }, [currentHotelCode]);

    const getHotelDate = (offsetDays = 0) => {
        const now = new Date();
        if (now.getHours() < 12) now.setDate(now.getDate() - 1);
        now.setDate(now.getDate() + offsetDays);
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // 💡 [수정 및 강화] 결제 결과 리다이렉트 처리 로직 (취소/실패 방어막 추가)
    useEffect(() => {
        const paymentStatus = urlParams.get('payment');
        const roomId = urlParams.get('room');
        const txId = urlParams.get('tx_id');

        if (paymentStatus === 'success' && roomId) {
            setStep(5);
            setAssignedRoom({ id: roomId });

            const pendingStr = localStorage.getItem('pendingFinanceRecord');
            if (pendingStr) {
                try {
                    const pendingData = JSON.parse(pendingStr);
                    const requests = [];

                    requests.push(
                        fetch('/api/payment/checkin-success', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                hotel_code: currentHotelCode,
                                room_id: roomId,
                                tx_id: txId || pendingData.txId,
                                amount: pendingData.amount
                            })
                        })
                    );

                    // 1. 객실 요금 장부 기록 (객실 요금이 0보다 클 때만)
                    if (Number(pendingData.roomTotal) > 0) {
                        requests.push(
                            fetch('/api/finance/transactions', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    date: getHotelDate(0),
                                    type: 'REVENUE',
                                    category: pendingData.isWalkIn ? 'Walk-in Room Charge' : 'Room Charge',
                                    amount: Number(pendingData.roomTotal) || 0,
                                    description: `Room ${roomId} Rate Paid via PaynPlus (${pendingData.txId})`,
                                    hotel_code: currentHotelCode,

                                    // 영수증 분리 발급을 위해 추가
                                    transaction_id: pendingData.txId,
                                    receipt_type: 'ROOM',
                                    guest_name: pendingData.guestName,
                                    room_id: roomId,
                                    room_type: pendingData.roomType,
                                    check_in_date: pendingData.checkInDate,
                                    check_out_date: pendingData.checkOutDate
                                })
                            })
                        );
                    }

                    // 2. 보증금 장부 기록 (보증금이 0보다 클 때만)
                    if (Number(pendingData.depositTotal) > 0) {
                        requests.push(
                            fetch('/api/finance/transactions', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    date: getHotelDate(0),
                                    type: 'REVENUE',
                                    category: 'Deposit',
                                    amount: Number(pendingData.depositTotal) || 0,
                                    description: `Room ${roomId} Deposit Paid via PaynPlus (${pendingData.txId})`,
                                    hotel_code: currentHotelCode,

                                    // 영수증 분리 발급을 위해 추가
                                    transaction_id: pendingData.txId,
                                    receipt_type: 'DEPOSIT',
                                    guest_name: pendingData.guestName,
                                    room_id: roomId,
                                    room_type: pendingData.roomType,
                                    check_in_date: pendingData.checkInDate,
                                    check_out_date: pendingData.checkOutDate
                                })
                            })
                        );
                    }

                    // 두 개의 API 요청을 병렬로 처리 후 스토리지 비우기
                    Promise.all(requests).then(() => {
                        localStorage.removeItem('pendingFinanceRecord');
                    }).catch(e => console.error("Ledger save error:", e));

                } catch (e) { console.error("Parse error:", e); }
            }

            // 💡 URL 파라미터 청소 (새로고침 시 중복 실행 방지)
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?hotel=${currentHotelCode}`;
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        }
        else if (paymentStatus === 'cancel' || paymentStatus === 'failed') {
            // 결제창에서 이탈하거나 실패하고 돌아왔을 때의 처리
            alert("❌ Payment was not completed. Please try again.");
            setIsProcessing(false);

            // 임시 장부 기록 삭제
            localStorage.removeItem('pendingFinanceRecord');

            // URL 파라미터 청소
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?hotel=${currentHotelCode}`;
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        }
    }, [currentHotelCode]);

    const [lang, setLang] = useState('EN');
    // 이전에 정의한 getTranslations 함수를 사용하여 동적으로 매핑합니다.
    const t = getTranslations(hotelName)[lang];

    const [step, setStep] = useState(1);
    const [method, setMethod] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [dbRoomTypes, setDbRoomTypes] = useState([]);
    const [availableRooms, setAvailableRooms] = useState([]);

    const [reservation, setReservation] = useState(null);
    const [assignedRoom, setAssignedRoom] = useState(null);

    const [guestInfo, setGuestInfo] = useState({
        firstName: '', lastName: '', guestName: '', nationality: '', email: '', phone: '', check_in_date: getHotelDate(0), check_out_date: ''
    });

    const [idImage, setIdImage] = useState(null);
    const [termsAgreed, setTermsAgreed] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Camera & Canvas Ref
    const videoRef = useRef(null);
    const photoCanvasRef = useRef(null);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    // E-Signature Ref
    const sigCanvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // 보증금 및 결제 금액 계산
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

    const toAmount = (value) => {
        const num = Number(String(value ?? '').replace(/,/g, ''));
        return Number.isFinite(num) ? num : 0;
    };

    const roomTotal = reservation
        ? toAmount(reservation.total_price || (basePrice * nights))
        : toAmount(basePrice * nights);

    const depositTotal = toAmount(securityDeposit);
    const grandTotal = roomTotal + depositTotal;

    useEffect(() => {
        if (!currentHotelCode) return;

        const fetchSelfCheckinData = () => {
            fetch(`/api/room-types?hotel=${currentHotelCode}&t=${Date.now()}`)
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

        fetchSelfCheckinData();

        const socketUrl = import.meta.env.VITE_API_URL || 'https://api.hotelnplus.com';
        const socket = io(socketUrl, { transports: ['websocket'] });

        socket.on('db_updated', (data) => {
            if (data.hotel_code === currentHotelCode || data.hotel_code === 'ALL') {
                fetchSelfCheckinData();
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [currentHotelCode]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsCameraOn(true);
            }
        } catch (err) {
            alert("Camera access denied or unavailable. Please check your device settings.");
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            setIsCameraOn(false);
        }
    };

    const captureID = () => {
        const video = videoRef.current;
        if (video) {
            const canvas = document.createElement('canvas');
            let width = video.videoWidth;
            let height = video.videoHeight;
            const MAX_WIDTH = 800;

            if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, width, height);

            setIsScanning(true);

            setTimeout(() => {
                setIsScanning(false);
                const isBlurred = Math.random() < 0.1;

                if (isBlurred) {
                    alert(lang === 'The ID photo is blurry or has too much glare. Please retake it clearly.');
                    setIdImage(null);
                } else {
                    setIdImage(canvas.toDataURL('image/jpeg', 0.7));
                    stopCamera();
                }
            }, 1500);
        }
    };

    const startDrawing = ({ nativeEvent }) => {
        let offsetX, offsetY;
        if (nativeEvent.touches) {
            const rect = sigCanvasRef.current.getBoundingClientRect();
            offsetX = nativeEvent.touches[0].clientX - rect.left;
            offsetY = nativeEvent.touches[0].clientY - rect.top;
        } else {
            offsetX = nativeEvent.offsetX;
            offsetY = nativeEvent.offsetY;
        }

        const ctx = sigCanvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);
        setIsDrawing(true);
    };

    const draw = ({ nativeEvent }) => {
        if (!isDrawing) return;
        let offsetX, offsetY;
        if (nativeEvent.touches) {
            const rect = sigCanvasRef.current.getBoundingClientRect();
            offsetX = nativeEvent.touches[0].clientX - rect.left;
            offsetY = nativeEvent.touches[0].clientY - rect.top;
        } else {
            offsetX = nativeEvent.offsetX;
            offsetY = nativeEvent.offsetY;
        }

        const ctx = sigCanvasRef.current.getContext('2d');
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
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
                return alert(lang === `Check-in available only on your arrival date (${resData.check_in_date}).`);
            }

            setReservation(resData);

            const nameParts = (resData.guest_name || '').trim().split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            setGuestInfo({
                ...guestInfo,
                firstName: firstName,
                lastName: lastName,
                guestName: resData.guest_name || '',
                check_in_date: resData.check_in_date || hotelToday,
                check_out_date: resData.check_out_date || '',
                nationality: resData.nationality || '',
                email: resData.email || '',
                phone: resData.phone || ''
            });

            const room = availableRooms.find(r => r.room_type === resData.room_type);
            if (room) {
                setAssignedRoom(room);
                setStep(4);
                setTimeout(startCamera, 500);
            } else {
                alert(t.noRooms);
            }
        } else {
            alert(data.message);
        }
    };

    const handleWalkInSelect = (roomType) => {
        const room = availableRooms.find(r => r.room_type === roomType.name);
        if (room) {
            setAssignedRoom(room);
            const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
            setGuestInfo({ ...guestInfo, check_in_date: getHotelDate(0), check_out_date: tomorrow.toISOString().split('T')[0] });
            setStep(4);
            setTimeout(startCamera, 500);
        } else {
            alert(t.noRooms);
        }
    };

    // 💡 [핵심] paynplus 결제창(리다이렉트) 연동 및 보증금 안전 저장 로직 (모바일과 동일하게 수정됨)
    const submitCheckIn = async () => {
        // 💡 [추가] 키오스크/태블릿 터치 시 발생하는 중복 클릭(따닥) 완벽 차단!
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

            // 💡 OCCUPIED가 아니라 PENDING_PAYMENT로 설정하여 결제 전 상태 명시
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

                        // 영수증 분리 발급용 핵심 값
                        room_amount: roomTotal,
                        deposit_amount: depositTotal,
                        receipt_mode: 'SPLIT_ROOM_AND_DEPOSIT',

                        guest_info: {
                            guestName: fullName,
                            email: guestInfo.email,
                            phone: guestInfo.phone
                        },
                        hotel_code: currentHotelCode,
                        room_id: assignedRoom.id,
                        room_type: assignedRoom.room_type || assignedRoom.name,
                        check_in_date: guestInfo.check_in_date,
                        check_out_date: guestInfo.check_out_date,
                        tx_id: tempTxId
                    })
                });

                const paymentData = await paymentRes.json();

                if (paymentRes.ok && paymentData.paymentUrl) {
                    // 장부 기록용 임시 저장
                    localStorage.setItem('pendingFinanceRecord', JSON.stringify({
                        amount: grandTotal,
                        roomTotal,
                        depositTotal,
                        isWalkIn: !reservation,
                        txId: tempTxId,
                        guestName: fullName,
                        email: guestInfo.email,
                        phone: guestInfo.phone,
                        roomId: assignedRoom.id,
                        roomType: assignedRoom.room_type || assignedRoom.name,
                        checkInDate: guestInfo.check_in_date,
                        checkOutDate: guestInfo.check_out_date,
                        hotelCode: currentHotelCode
                    }));

                    // 💡 성공 시 setIsProcessing(false) 없이 즉시 결제창으로 진입! (깜빡임 완벽 차단)
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
        <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col relative select-none overflow-hidden">

            <div className="p-4 md:p-8 text-center border-b border-slate-800 relative z-10 bg-slate-900 shadow-md shrink-0">
                <Link to="/" className="absolute top-4 md:top-8 left-4 md:left-8 text-slate-400 hover:text-white font-bold border border-slate-700 px-4 md:px-6 py-1.5 md:py-2 rounded-md transition-colors backdrop-blur-sm text-sm md:text-base">✕ Exit</Link>
                <h1 className="text-2xl md:text-4xl font-black text-teal-400 tracking-widest uppercase mt-10 md:mt-0">Self Check-in</h1>
                <p className="text-slate-400 mt-1 md:mt-2 font-bold text-xs md:text-base">{t.welcome}</p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-start md:justify-center p-4 md:p-10 bg-gradient-to-b from-slate-900 to-slate-950 overflow-y-auto">

                {step === 1 && (
                    <div className="flex flex-col items-center justify-center animate-fade-in w-full max-w-3xl py-6 md:py-0 h-full">
                        <h2 className="text-xl md:text-3xl font-light mb-6 md:mb-8 text-teal-300 tracking-wide">{t.selectLang}</h2>
                        <div className="grid grid-cols-2 gap-3 md:gap-6 px-4 sm:px-0 w-full mb-10 md:mb-14">
                            <button onClick={() => { setLang('EN'); setStep(2); }} className="bg-slate-800/80 hover:bg-teal-700 border border-slate-700 p-6 md:p-10 rounded-md md:rounded-md text-lg md:text-2xl font-black transition-all transform hover:-translate-y-1 shadow-lg flex flex-col items-center gap-2">
                                <span className="text-teal-400">EN</span> English
                            </button>
                            <button onClick={() => { setLang('KR'); setStep(2); }} className="bg-slate-800/80 hover:bg-teal-700 border border-slate-700 p-6 md:p-10 rounded-md md:rounded-md text-lg md:text-2xl font-black transition-all transform hover:-translate-y-1 shadow-lg flex flex-col items-center gap-2">
                                <span className="text-teal-400">KR</span> 한국어
                            </button>
                            <button onClick={() => { setLang('CN'); setStep(2); }} className="bg-slate-800/80 hover:bg-teal-700 border border-slate-700 p-6 md:p-10 rounded-md md:rounded-md text-lg md:text-2xl font-black transition-all transform hover:-translate-y-1 shadow-lg flex flex-col items-center gap-2">
                                <span className="text-teal-400">CN</span> 中文
                            </button>
                            <button onClick={() => { setLang('JP'); setStep(2); }} className="bg-slate-800/80 hover:bg-teal-700 border border-slate-700 p-6 md:p-10 rounded-md md:rounded-md text-lg md:text-2xl font-black transition-all transform hover:-translate-y-1 shadow-lg flex flex-col items-center gap-2">
                                <span className="text-teal-400">JP</span> 日本語
                            </button>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 md:p-10 rounded-[2rem] shadow-2xl flex flex-col items-center w-[90%] sm:w-auto">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-3xl md:text-4xl animate-bounce">📱</span>
                                <h3 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-white">Mobile Check-in</h3>
                            </div>
                            <p className="text-sm md:text-base font-bold text-teal-200 mb-6 text-center">Scan the QR code to check-in on your phone.</p>

                            <div className="p-4 md:p-6 bg-white rounded-md shadow-inner border-4 border-teal-500/30 flex items-center justify-center">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`https://pms.hotelnplus.com/mobile-checkin?hotel=${currentHotelCode}`)}&margin=10`}
                                    alt="Mobile Check-in QR"
                                    className="w-48 h-48 md:w-64 md:h-64 object-contain"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="text-center animate-fade-in w-full max-w-4xl py-10 md:py-0">
                        <button onClick={() => setStep(1)} className="mb-6 md:mb-10 text-slate-400 hover:text-white font-bold text-base md:text-lg">⬅ {t.back}</button>
                        <h2 className="text-2xl md:text-4xl font-light mb-8 md:mb-12 px-2">{t.methodTitle}</h2>
                        <div className="flex flex-col sm:flex-row justify-center gap-4 md:gap-8 px-4 sm:px-0">
                            <button onClick={() => { setMethod('number'); setStep(3); }} className="bg-slate-800 border border-slate-700 hover:border-teal-400 p-6 md:p-10 rounded-md md:rounded-md flex-1 transition-all group">
                                <div className="text-5xl md:text-6xl mb-3 md:mb-4 group-hover:scale-110 transition-transform">🔢</div>
                                <div className="text-lg md:text-2xl font-bold">{t.resNum}</div>
                            </button>
                            <button onClick={() => { setMethod('name'); setStep(3); }} className="bg-slate-800 border border-slate-700 hover:border-teal-400 p-6 md:p-10 rounded-md md:rounded-md flex-1 transition-all group">
                                <div className="text-5xl md:text-6xl mb-3 md:mb-4 group-hover:scale-110 transition-transform">🔤</div>
                                <div className="text-lg md:text-2xl font-bold">{t.resName}</div>
                            </button>
                            <button onClick={() => { setMethod('walkin'); setStep(3); }} className="bg-slate-800 border border-slate-700 hover:border-teal-400 p-6 md:p-10 rounded-md md:rounded-md flex-1 transition-all group">
                                <div className="text-5xl md:text-6xl mb-3 md:mb-4 group-hover:scale-110 transition-transform">🚶‍♂️</div>
                                <div className="text-lg md:text-2xl font-bold">{t.walkIn}</div>
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="w-full max-w-5xl animate-fade-in text-center py-6 md:py-0">
                        <button onClick={() => setStep(2)} className="mb-6 md:mb-8 text-slate-400 hover:text-white font-bold text-base md:text-lg">⬅ {t.back}</button>

                        {method === 'walkin' ? (
                            <div className="px-4 md:px-0">
                                <h2 className="text-2xl md:text-4xl font-light mb-6 md:mb-10">{t.roomTypes}</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                                    {dbRoomTypes.map(rt => {
                                        const count = availableRooms.filter(r => r.room_type === rt.name).length;
                                        return (
                                            <button
                                                key={rt.id} onClick={() => handleWalkInSelect(rt)} disabled={count === 0}
                                                className="bg-slate-800 border border-slate-700 hover:border-teal-400 p-6 md:p-8 rounded-md md:rounded-md text-left transition-all disabled:opacity-30 disabled:cursor-not-allowed flex flex-col md:flex-row justify-between md:items-center gap-4 md:gap-0"
                                            >
                                                <div>
                                                    <div className="text-xl md:text-2xl font-black mb-1">{rt.name}</div>
                                                    <div className="text-xs md:text-sm font-bold text-slate-400">{count > 0 ? `${count} Rooms Available` : t.noRooms}</div>
                                                </div>
                                                <div className="text-left md:text-right">
                                                    <div className="text-2xl md:text-3xl font-black text-teal-400">₱{rt.price.toLocaleString()}</div>
                                                    <div className="text-[10px] md:text-xs text-slate-500">{t.pricePerNight}</div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-2xl mx-auto px-4 sm:px-0">
                                <h2 className="text-2xl md:text-3xl font-light mb-6 md:mb-8">{method === 'number' ? t.enterNum : t.enterName}</h2>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full p-4 md:p-6 text-xl md:text-2xl font-bold text-center bg-slate-800 border border-slate-600 rounded-md mb-6 md:mb-8 focus:outline-none focus:border-teal-500"
                                />
                                <button onClick={handleSearch} className="w-full bg-teal-600 hover:bg-teal-500 text-white py-4 md:py-5 rounded-md text-xl md:text-2xl font-black shadow-lg">
                                    {t.search}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {step === 4 && (
                    <div className="w-full max-w-5xl bg-slate-800 p-6 md:p-10 rounded-md md:rounded-md border border-slate-700 shadow-2xl animate-fade-in flex flex-col lg:flex-row gap-8 md:gap-10 my-4 md:my-0">

                        <div className="flex-1 space-y-4 md:space-y-6">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black text-white">{t.verifyID} & Registration</h2>
                                <p className="text-teal-400 font-bold mb-4 md:mb-6 text-sm md:text-base">Assigned: {assignedRoom?.room_type} (Room {assignedRoom?.id})</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs md:text-sm text-slate-400 block mb-1.5 md:mb-2">First Name</label>
                                    <input type="text" placeholder="e.g. Alice" value={guestInfo.firstName} onChange={e => setGuestInfo({ ...guestInfo, firstName: e.target.value })} className="w-full p-3 md:p-4 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-teal-500 text-base md:text-lg font-bold text-white" />
                                </div>
                                <div>
                                    <label className="text-xs md:text-sm text-slate-400 block mb-1.5 md:mb-2">Last Name (Surname)</label>
                                    <input type="text" placeholder="e.g. Smith" value={guestInfo.lastName} onChange={e => setGuestInfo({ ...guestInfo, lastName: e.target.value })} className="w-full p-3 md:p-4 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-teal-500 text-base md:text-lg font-bold text-white" />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs md:text-sm text-slate-400 block mb-1.5 md:mb-2">Nationality</label>
                                <select value={guestInfo.nationality} onChange={e => setGuestInfo({ ...guestInfo, nationality: e.target.value })} className="w-full p-3 md:p-4 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-teal-500 text-base md:text-lg font-bold text-white cursor-pointer" style={{ colorScheme: 'dark' }}>
                                    <option value="">Select Country...</option>
                                    {TOP_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    <option disabled>──────────</option>
                                    {ALL_COUNTRIES.filter(c => !TOP_COUNTRIES.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div><label className="text-xs md:text-sm text-slate-400 block mb-1.5 md:mb-2">Email Address</label><input type="email" value={guestInfo.email} onChange={e => setGuestInfo({ ...guestInfo, email: e.target.value })} className="w-full p-3 md:p-4 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-teal-500 text-base md:text-lg font-bold text-white" /></div>
                            <div><label className="text-xs md:text-sm text-slate-400 block mb-1.5 md:mb-2">Phone</label><input type="text" value={guestInfo.phone} onChange={e => setGuestInfo({ ...guestInfo, phone: e.target.value })} className="w-full p-3 md:p-4 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-teal-500 text-base md:text-lg font-bold text-white" /></div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs md:text-sm text-slate-400 block mb-1.5 md:mb-2">Check-in Date</label>
                                    <input type="date" value={guestInfo.check_in_date} onChange={e => setGuestInfo({ ...guestInfo, check_in_date: e.target.value })} className="w-full p-3 md:p-4 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-teal-500 text-base md:text-lg font-bold text-white" style={{ colorScheme: 'dark' }} />
                                </div>
                                <div>
                                    <label className="text-xs md:text-sm text-slate-400 block mb-1.5 md:mb-2">Check-out Date</label>
                                    <input type="date" value={guestInfo.check_out_date} onChange={e => setGuestInfo({ ...guestInfo, check_out_date: e.target.value })} className="w-full p-3 md:p-4 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-teal-500 text-base md:text-lg font-bold text-white" style={{ colorScheme: 'dark' }} />
                                </div>
                            </div>
                        </div>

                        <div className="w-full lg:w-[400px] flex flex-col gap-6">

                            <div className="bg-slate-900 p-4 rounded-md border border-slate-700 relative overflow-hidden">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="font-bold text-xs md:text-sm text-teal-400">{t.scanID}</span>
                                    {isCameraOn ? <button onClick={stopCamera} className="text-xs text-red-400 font-bold px-2 py-1 bg-slate-800 rounded">Stop</button> : <button onClick={startCamera} className="text-xs text-blue-400 font-bold px-2 py-1 bg-slate-800 rounded">Start Camera</button>}
                                </div>

                                <div className="aspect-video w-full bg-black rounded-md overflow-hidden relative flex items-center justify-center border-2 border-dashed border-slate-600">
                                    {idImage ? (
                                        <img src={idImage} alt="Scanned ID" className="w-full h-full object-cover" />
                                    ) : (
                                        <>
                                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                                            {isCameraOn && <div className="absolute w-[80%] h-[70%] border-2 border-teal-500/50 rounded-md z-10 pointer-events-none"></div>}
                                        </>
                                    )}

                                    {isScanning && (
                                        <div className="absolute inset-0 bg-teal-500/20 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                                            <div className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-md animate-spin mb-2"></div>
                                            <p className="font-bold text-teal-300 drop-shadow-md text-sm">Scanning...</p>
                                        </div>
                                    )}
                                </div>

                                <canvas ref={photoCanvasRef} className="hidden"></canvas>

                                {!idImage && isCameraOn && (
                                    <button onClick={captureID} className="w-full mt-3 bg-teal-600 hover:bg-teal-500 py-2.5 md:py-3 rounded-md font-bold text-white shadow-md text-sm md:text-base transition-colors">📸 {t.takePhoto}</button>
                                )}
                                {idImage && (
                                    <button onClick={() => { setIdImage(null); startCamera(); }} className="w-full mt-3 bg-slate-700 hover:bg-slate-600 py-2.5 md:py-3 rounded-md font-bold text-white text-sm md:text-base transition-colors">Retake Photo</button>
                                )}
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-md p-4 mb-1 text-left">
                                <h4 className="text-xs font-black text-slate-700 mb-3 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
                                    <span>⚖️</span> Terms & Conditions Agreement
                                </h4>
                                <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                    <p className="text-[10px] md:text-[11px] text-slate-600 leading-relaxed break-keep">
                                        {t.termsDetail}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 bg-slate-900 p-4 rounded-md border border-slate-700 shadow-sm transition-colors hover:bg-slate-800 cursor-pointer mb-2" onClick={() => setTermsAgreed(!termsAgreed)}>
                                <input
                                    type="checkbox"
                                    checked={termsAgreed}
                                    onChange={(e) => setTermsAgreed(e.target.checked)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-5 h-5 text-teal-500 border-slate-600 rounded bg-slate-800 focus:ring-teal-500 cursor-pointer"
                                />
                                <label className="text-sm font-bold text-slate-300 cursor-pointer select-none">
                                    {t.agreeTerms}
                                </label>
                            </div>

                            <div className="bg-slate-900 p-4 rounded-md border border-slate-700 relative">
                                <div className="flex justify-between items-end mb-2">
                                    <label className="text-xs md:text-sm font-bold text-teal-400">{t.signHere}</label>
                                    <button onClick={clearSignature} className="text-xs text-slate-400 hover:text-white font-bold bg-slate-800 px-2 py-1 rounded transition-colors">{t.clear}</button>
                                </div>
                                <div className="w-full flex justify-center bg-white rounded-md overflow-hidden border border-slate-300 relative">
                                    {!termsAgreed && (
                                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                                            <span className="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-lg">Please check the agreement first</span>
                                        </div>
                                    )}
                                    <canvas
                                        ref={sigCanvasRef}
                                        onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                                        width={350} height={120}
                                        className="cursor-crosshair touch-none max-w-full"
                                    />
                                </div>
                            </div>

                            {/* 💡 [신규 수정] Payment Summary (에러 방지 렌더링 적용) */}
                            <div className="bg-slate-900 border border-slate-700 p-4 rounded-md text-left space-y-3 shadow-inner mb-4">
                                <h4 className="text-xs font-black text-teal-400 tracking-wider uppercase border-b border-slate-800 pb-2">
                                    💳 {lang === 'KR' ? '결제 요약 대장' : lang === 'CN' ? '费用明细' : lang === 'JP' ? '会計要約' : 'Payment Summary'}
                                </h4>
                                <div className="space-y-2 text-xs md:text-sm">
                                    <div className="flex justify-between font-bold text-slate-400">
                                        <span>{lang === 'KR' ? `객실 요금 (${nights}박)` : lang === 'CN' ? `房费 (${nights}晚)` : lang === 'JP' ? `客室料金 (${nights}泊)` : `Room Rate (${nights} nights)`}</span>
                                        <span>₱{roomTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-slate-400">
                                        <span>{lang === 'KR' ? '보증금 (퇴실 시 환불)' : lang === 'CN' ? '安全押金 (可退还)' : lang === 'JP' ? '保証金 (チェックアウト時返金)' : 'Security Deposit (Refundable)'}</span>
                                        <span className="text-teal-400">₱{depositTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="border-t border-slate-800 pt-2 mt-2 flex justify-between items-center">
                                        <span className="font-black text-slate-300 uppercase text-xs md:text-sm">{lang === 'KR' ? '총 결제 금액' : lang === 'CN' ? '应付总额' : lang === 'JP' ? '合計金額' : 'Total Due'}</span>
                                        <span className="text-xl font-black text-teal-400">₱{grandTotal.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="text-[10px] md:text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded-md leading-relaxed mt-1">
                                    {lang === 'KR' ? '⚠️ 안내: 보증금은 체크아웃 시 객실 점검 후 전액 환불 처리됩니다.' : lang === 'CN' ? '⚠️ 提示：退房时经客房检查无误后，押金将全额退还。' : lang === 'JP' ? '⚠️ ご案内：保証金はチェックアウト時、お部屋の確認後に全額返金されます。' : '⚠️ Notice: The security deposit is fully refundable upon check-out after room inspection.'}
                                </div>
                            </div>
                            <button onClick={submitCheckIn} disabled={isProcessing} className="mt-auto bg-blue-600 hover:bg-blue-500 text-white py-4 md:py-5 rounded-md font-black text-lg md:text-xl shadow-lg transition-transform hover:scale-105 w-full disabled:bg-slate-600 disabled:scale-100 disabled:hover:scale-100">
                                {isProcessing
                                    ? 'Processing Payment...'
                                    : (lang === 'KR'
                                        ? `결제창으로 이동하기 (Pay ₱${grandTotal.toLocaleString()})`
                                        : `${t.complete} (Pay ₱${grandTotal.toLocaleString()})`
                                    )
                                }
                            </button>
                        </div>

                    </div>
                )}

                {step === 5 && (
                    <div className="text-center animate-fade-in px-4 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
                        {/* 🎉 폭죽 아이콘 */}
                        <div className="text-7xl md:text-8xl mb-6">🎉</div>

                        {/* You're all set! 타이틀 */}
                        <h2 className="text-3xl md:text-5xl font-black mb-2 tracking-wide text-white">{t.successTitle}</h2>

                        {/* Welcome, [이름] 환영 문구 */}
                        <p className="text-lg md:text-2xl text-slate-400 mb-8 font-medium">
                            Welcome, <span className="font-black text-white">{guestInfo.firstName} {guestInfo.lastName}</span>!
                        </p>

                        {/* 💡 가시성 개선: 2번째 첨부사진 규격에 맞춘 거대 룸 번호 배치 영역 */}
                        <div className="text-3xl md:text-5xl font-bold text-slate-400 my-6 flex items-center justify-center gap-3">
                            <span>Room</span>
                            <span className="slashed-zero-font text-5xl md:text-7xl font-black text-emerald-400 tracking-wider font-mono animate-pulse">
                                {assignedRoom?.id}
                            </span>
                            <span>is ready.</span>
                        </div>

                        {/* 안내 문구 가독성 확보 */}
                        <p className="text-base md:text-xl text-slate-300 font-bold max-w-md mx-auto mb-12 leading-relaxed">
                            Please get your key at the Front Desk.
                        </p>

                        {/* 처음으로 돌아가기 버튼 (Done/Finish) */}
                        <button
                            onClick={() => {
                                setStep(1); setAssignedRoom(null); setReservation(null); setMethod(''); setSearchQuery('');
                                setGuestInfo({ firstName: '', lastName: '', guestName: '', nationality: '', email: '', phone: '', check_in_date: getHotelDate(0), check_out_date: '' });
                                setIdImage(null); setTermsAgreed(false); window.history.replaceState(null, '', window.location.pathname);
                            }}
                            className="bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 px-12 py-4 rounded-xl text-base md:text-lg font-black transition-all text-white shadow-lg w-full max-w-xs"
                        >
                            {lang === 'KR' ? '완료' : 'Done'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}