
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';

const TOP_COUNTRIES = ["Philippines", "South Korea", "China", "United States"];
const ALL_COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

export default function Front() {
    const currentUserId = sessionStorage.getItem('userId') || 'UNKNOWN';
    const currentHotelCode = sessionStorage.getItem('hotelCode') || '';
    
    const [hotelCheckOutHour, setHotelCheckOutHour] = useState(11);

    useEffect(() => {
        if (currentHotelCode) {
            fetch(`/api/settings/times?hotel=${currentHotelCode}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.checkOut) {
                        // "11:00" 같은 문자열에서 앞의 "11"만 빼서 숫자로 변환합니다.
                        setHotelCheckOutHour(parseInt(data.checkOut.split(':')[0], 10));
                    }
                }).catch(e => console.log(e));
        }
    }, [currentHotelCode]);

    // 💡 [핵심 수정] 하드코딩된 '12시' 대신, Admin에서 설정한 진짜 체크아웃 시간을 기준으로 어제/오늘을 판별합니다!
    const getHotelDate = (offsetDays = 0) => {
        const now = new Date();
        // 예: 체크아웃 설정이 11시라면, 11시 이전(예: 오전 5시)은 아직 '어제 영업일'로 계산됩니다.
        if (now.getHours() < hotelCheckOutHour) {
            now.setDate(now.getDate() - 1);
        }
        now.setDate(now.getDate() + offsetDays);
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    // 💡 [신규] 객실 카드 메모장의 펼쳐짐 상태를 관리합니다. (room.id: true/false 형태)
    const [expandedMemos, setExpandedMemos] = useState({});

    // 💡 [신규] 메모장 펼치기/접기 토글 함수
    const toggleMemo = (roomId, e) => {
        e.stopPropagation(); // 객실 카드 클릭(체크인 모달 오픈) 방지
        setExpandedMemos(prev => ({
            ...prev,
            [roomId]: !prev[roomId] // 현재 상태를 반전시킵니다.
        }));
    };

    // 💡 [신규] 객실 메모를 하우스키핑(HK)과 메인터넌스(MT)용으로 쪼개주는 스마트 함수
    const parseRoomMemos = (remarks) => {
        if (!remarks) return { hk: null, mt: null };
        const lines = remarks.split('\n');
        const hkLines = lines.filter(l => l.includes('🧹') || l.includes('Make Up Req') || l.includes('Note:'));
        const mtLines = lines.filter(l => l.includes('🛠️') || l.includes('Service Task') || l.includes('📝') || l.includes('Issue:'));
        return {
            hk: hkLines.length > 0 ? hkLines.join('\n') : null,
            mt: mtLines.length > 0 ? mtLines.join('\n') : null
        };
    };

    const [rooms, setRooms] = useState([]);
    // 💡 [신규] OTA 예약 알림 상태 및 오디오 객체
    const [isOtaAlarmRinging, setIsOtaAlarmRinging] = useState(false);
    const otaAudioRef = useRef(null);

    useEffect(() => {
        // 💡 알림음 파일 셋팅 (반복 재생)
        otaAudioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
        otaAudioRef.current.loop = true;
    }, []);

    const stopOtaAlarm = (e) => {
        if (e) e.stopPropagation();
        setIsOtaAlarmRinging(false);
        if (otaAudioRef.current) {
            otaAudioRef.current.pause();
            otaAudioRef.current.currentTime = 0; // 처음으로 되감기
        }
    };

    // 💡 [신규] 웹소켓 및 태블릿 서명 관련 상태 추가
    const socketRef = useRef(null);
    const [tabletSignature, setTabletSignature] = useState('');
    const [isTabletPending, setIsTabletPending] = useState(false);
    // 💡 [신규 추가] 내가 서명을 요청한 방 번호를 몰래 기억해두는 장치
    const waitingForSignatureRoomId = useRef(null);

    // 💡 [신규] 태블릿으로 체크인 서명 요청 쏘기
    const requestCheckinSignature = () => {
        if (!guestInfo.guestName) return showAlert("Notice", "Please enter guest name first.", "info");
        setIsTabletPending(true);
        waitingForSignatureRoomId.current = String(selectedRoom.id); // 💡 [핵심] 내가 요청한 방 번호 기억!

        if (socketRef.current) {
            socketRef.current.emit('checkin_signature_request', {
                target_tablet: targetTablet,
                roomId: selectedRoom.id,
                guestName: guestInfo.guestName,
                checkInDate: guestInfo.check_in_date || getHotelDate(0),
                checkOutDate: guestInfo.check_out_date,
                deposit: extraInfo.deposit || 0
            });
        }
    };

    // 💡 [신규] 태블릿으로 체크아웃 서명 요청 쏘기
    const requestCheckoutSignature = () => {
        setIsTabletPending(true);
        waitingForSignatureRoomId.current = String(selectedRoom.id); // 💡 [핵심] 내가 요청한 방 번호 기억!

        const folio = selectedRoom.balance || 0;
        const deposit = extraInfo.deposit_method === 'CC Open' ? 0 : (parseFloat(extraInfo.deposit) || 0);
        const refundAmt = parseFloat(checkoutData.refundAmount) || 0;
        const netDue = folio - deposit - refundAmt;

        // 💡 [추가] 고객 태블릿에도 Folio 내역을 함께 보냅니다!
        let parsedCart = [];
        try { parsedCart = typeof selectedRoom.cart_data === 'string' ? JSON.parse(selectedRoom.cart_data) : (selectedRoom.cart_data || []); } catch (e) { }

        if (socketRef.current) {
            socketRef.current.emit('checkout_signature_request', {
                target_tablet: targetTablet,
                roomId: selectedRoom.id,
                guestName: selectedRoom.guestName,
                deposit: deposit,
                deduction: folio,
                folio_items: parsedCart, // 방금 풀어낸 장바구니 내역 전송
                refund: Math.abs(netDue)
            });
        }
    };

    // 💡 [신규] 태블릿 요청 취소
    const cancelTabletRequest = () => {
        setIsTabletPending(false);
        waitingForSignatureRoomId.current = null; // 💡 취소했으니 기억 지우기
        if (socketRef.current) {
            socketRef.current.emit('cancel_signature_request');
        }
    };

    const [selectedRoom, setSelectedRoom] = useState(null);
    const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });
    const [svcModal, setSvcModal] = useState({ show: false, type: '', memo: '' });
    // 💡 [신규] 객실 카드 배지 클릭 시 뜨는 빠른 메모장 상태
    const [quickMemoModal, setQuickMemoModal] = useState({ show: false, room: null, memo: '' });

    const showAlert = (title, message, type = 'info') => {
        setAlertModal({ show: true, title, message, type });
    };

    // 💡 [신규] 빠른 메모장 저장 함수 (클릭 시 KDS로 메모 즉각 전송)
    const handleSaveQuickMemo = async () => {
        if (!quickMemoModal.memo.trim()) return;
        const now = new Date();
        const timeStr = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const prevMemo = quickMemoModal.room.maintenance_remarks ? quickMemoModal.room.maintenance_remarks + '\n' : '';
        const newMemo = `${prevMemo}📝 [Front Note at ${timeStr}] ${quickMemoModal.memo}`;

        await fetch('/api/rooms/update', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...quickMemoModal.room, maintenance_remarks: newMemo, increment_usage: false, hotel_code: currentHotelCode })
        });
        setQuickMemoModal({ show: false, room: null, memo: '' });
        fetchRooms();
    };

    const [selectedResDetail, setSelectedResDetail] = useState(null); // 예약 상세 모달 상태

    const [roomTypes, setRoomTypes] = useState([]);
    const [selectedRoomType, setSelectedRoomType] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    const [showSmartSearch, setShowSmartSearch] = useState(false);
    const [smartSearchParams, setSmartSearchParams] = useState({
        check_in: getHotelDate(0),
        check_out: getHotelDate(1),
        room_type: 'All'
    });
    const [smartSearchResults, setSmartSearchResults] = useState(null);
    const [activeSmartSearchTab, setActiveSmartSearchTab] = useState('instant');

    const [showCleaningModal, setShowCleaningModal] = useState(false);
    const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);

    const [guestInfo, setGuestInfo] = useState({
        guestName: '', nationality: '', email: '', phone: '', check_in_date: '', check_out_date: '', room_type: '', id_image: '', channel: 'Walk-in'
    });

    const [extraInfo, setExtraInfo] = useState({ deposit: '', deposit_method: 'Cash', folio_limit: '', group_id: '', wakeup_call: '', has_parcel: false });
    const [payAmount, setPayAmount] = useState('');
    const [extensionDate, setExtensionDate] = useState('');

    const [addDepositAmt, setAddDepositAmt] = useState('');
    const [addDepositMethod, setAddDepositMethod] = useState('Cash');

    const [isIssuingKey, setIsIssuingKey] = useState(false);
    const [isKeyIssued, setIsKeyIssued] = useState(false);

    const [isProcessingDeposit, setIsProcessingDeposit] = useState(false);
    const [isDepositPaid, setIsDepositPaid] = useState(false);
    const [isSigned, setIsSigned] = useState(false);

    const [extendPaymentData, setExtendPaymentData] = useState({ show: false, extraNights: 0, amount: 0, newDate: '' });
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);

    const [showMorningCheckoutAlert, setShowMorningCheckoutAlert] = useState(false);
    const [morningCheckoutRooms, setMorningCheckoutRooms] = useState([]);
    const checkoutAlertHasShown = useRef(false);

    // 💡 [추가] Folio 세부 내역 모달 상태
    const [showFolioDetailsModal, setShowFolioDetailsModal] = useState(false);

    // 💡 [신규] 단말기 연동 및 각 모달별 결제 수단 상태
    const [terminals, setTerminals] = useState([]);
    const [selectedTerminal, setSelectedTerminal] = useState('');
    const [payMethod, setPayMethod] = useState('Cash');
    const [extendMethod, setExtendMethod] = useState('Cash');
    const [checkoutData, setCheckoutData] = useState({ refundAmount: 0, refundMethod: 'Cash', earlyNights: 0, settleMethod: 'Cash' });
    // 💡 [신규] 서명을 쏠 타겟 태블릿 ID (브라우저에 기억시킴)
    const [targetTablet, setTargetTablet] = useState(localStorage.getItem('targetTablet') || 'PAD-1');
    const handleTabletChange = (val) => { setTargetTablet(val); localStorage.setItem('targetTablet', val); };

    // 💡 [신규] 웹캠/스캐너 관련 상태 및 참조
    const [showCamera, setShowCamera] = useState(false);
    const videoRef = useRef(null);

    const [pendingReservations, setPendingReservations] = useState([]);

    const prevPendingCountRef = useRef(0);
    const isInitialLoad = useRef(true);

    useEffect(() => {
        // 처음 화면을 켰을 때는 울리지 않음
        if (isInitialLoad.current) {
            isInitialLoad.current = false;
            prevPendingCountRef.current = pendingReservations.length;
            return;
        }

        // 이전보다 예약 건수가 늘어났다면 무조건 알람 스위치 ON!
        if (pendingReservations.length > prevPendingCountRef.current) {
            setIsOtaAlarmRinging(true); // 🔕 버튼을 화면에 나타나게 함
            if (otaAudioRef.current) {
                otaAudioRef.current.play().catch(e => console.log('브라우저 소리 자동재생 차단됨'));
            }
        }
        prevPendingCountRef.current = pendingReservations.length;
    }, [pendingReservations.length]);

    const [showResModal, setShowResModal] = useState(false);
    const [linkedResId, setLinkedResId] = useState('');

    const [showNewResModal, setShowNewResModal] = useState(false);
    const [newResData, setNewResData] = useState({
        guest_name: '', channel: 'Walk-in', room_type: 'Standard', check_in_date: '', check_out_date: '', phone: '', email: ''
    });

    const [showCrmModal, setShowCrmModal] = useState(false);
    const [crmQuery, setCrmQuery] = useState('');
    const [crmResults, setCrmResults] = useState([]);

    const [showTransferMode, setShowTransferMode] = useState(false);
    const [transferTarget, setTransferTarget] = useState('');

    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [handoverData, setHandoverData] = useState({ total_cash: '', notes: '', receiver_id: '', handover_pwd: '', receiver_pwd: '' });
    
    const [showLedgerModal, setShowLedgerModal] = useState(false);
    const [ledgerList, setLedgerList] = useState([]);
    const [ledgerCategories, setLedgerCategories] = useState(['Petty Cash (Fund)', 'Cash Sales (Deposit)', 'Refund / Void', 'Office Supplies', 'Tips', 'Miscellaneous']);
    const [newLedgerCat, setNewLedgerCat] = useState('');
    const [isAddingLedgerCat, setIsAddingLedgerCat] = useState(false);
    const [ledgerTx, setLedgerTx] = useState({ type: 'IN', category: 'Petty Cash (Fund)', amount: '', description: '' });
    const [ledgerFilter, setLedgerFilter] = useState({ startDate: '', endDate: '', type: 'ALL', category: 'ALL' });

    const [activeWakeupCalls, setActiveWakeupCalls] = useState([]);

    // 💡 [신규] 매니저 승인 모달 상태
    const [managerOverride, setManagerOverride] = useState({ show: false, resId: '', guestName: '', empId: '', password: '' });

    // 💡 [신규] Front.jsx 전용 시스템 감사 로그(Audit Log) 기록 함수
    const recordAuditLog = (actionDesc) => {
        const newLog = {
            id: `local_${Date.now()}`,
            timestamp: new Date().toLocaleString('en-US', { hour12: false }),
            user_id: currentUser || 'FrontDesk', // 현재 접속 중인 직원 ID
            action: actionDesc,
            hotel_code: currentHotelCode
        };
        
        // 💡 Admin의 로그와 연동하기 위해 로컬 스토리지에도 동기화 저장
        try {
            const existingLogs = JSON.parse(localStorage.getItem(`audit_logs_${currentHotelCode}`) || '[]');
            const updatedLocalLogs = [newLog, ...existingLogs].slice(0, 500);
            localStorage.setItem(`audit_logs_${currentHotelCode}`, JSON.stringify(updatedLocalLogs));
        } catch(e) {}

        fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newLog)
        }).catch(() => { });
    };

    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            const currentTime = now.toTimeString().slice(0, 5);
            setRooms((prevRooms) => {
                const updatedCalls = [];
                prevRooms.forEach((room) => {
                    if (room.status === 'OCCUPIED' && room.wakeup_call === currentTime) {
                        updatedCalls.push({ id: room.id, guest: room.guestName, time: currentTime });
                    }
                });
                setActiveWakeupCalls((currentCalls) => {
                    const newCalls = updatedCalls.filter((uc) => !currentCalls.some((cc) => cc.id === uc.id));
                    return [...currentCalls, ...newCalls];
                });

                // 💡 [추가] 09:00 ~ 12:00 사이에 체크아웃 대상자 알림 팝업 띄우기
                const currentHour = now.getHours();
                if (currentHour >= 9 && currentHour < 12 && !checkoutAlertHasShown.current) {
                    const today = getHotelDate(0);
                    const checkOutToday = prevRooms.filter(r => r.status === 'OCCUPIED' && r.check_out_date === today);

                    if (checkOutToday.length > 0) {
                        setMorningCheckoutRooms(checkOutToday);
                        setShowMorningCheckoutAlert(true);
                        checkoutAlertHasShown.current = true; // 하루 한 번만 표시되도록 잠금
                    }
                }
                // 12시가 지나면 내일을 위해 알림 팝업 잠금 해제
                if (currentHour >= 12) {
                    checkoutAlertHasShown.current = false;
                }

                return prevRooms;
            });
        }, 10000);
        return () => clearInterval(timer);
    }, []);

    const handleDismissWakeup = async (roomId) => {
        if (window.confirm(`Have you completed the wake-up call for Room ${roomId}?`)) {
            setActiveWakeupCalls((prev) => prev.filter((call) => call.id !== roomId));
            await fetch('/api/rooms/extra-info', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: roomId, wakeup_call: '', hotel_code: currentHotelCode })
            });
            setRooms((prev) => prev.map((r) => r.id === roomId ? { ...r, wakeup_call: '' } : r));
        }
    };

    // 💡 [수정 1] 데이터를 불러오는 함수를 분리하고, 무조건 최신 데이터를 가져오도록 캐시 무력화(t=현재시간) 장착!
    const fetchReservations = () => {
        fetch(`/api/reservations?hotel=${currentHotelCode}&t=${Date.now()}`, { cache: 'no-store' })
            .then((res) => res.json())
            .then((data) => setPendingReservations(data));
    };

    const fetchRooms = () => {
        fetch(`/api/rooms?hotel=${currentHotelCode}&t=${Date.now()}`, { cache: 'no-store' })
            .then((res) => res.json())
            .then((data) => setRooms(data));
    };

    useEffect(() => {
        fetchRooms(); // 초기 로딩 시 객실 불러오기

        fetch(`/api/room-types?hotel=${currentHotelCode}&t=${Date.now()}`, { cache: 'no-store' })
            .then((res) => res.json())
            .then((data) => setRoomTypes(data));

        fetch(`/api/settings/devices?t=${Date.now()}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                if (data && data.success && data.devices) {
                    const frontTerminals = data.devices.filter(d => d.type === 'Payment Terminal' && d.target_store === 'Front Desk');
                    setTerminals(frontTerminals);
                    if (frontTerminals.length > 0) setSelectedTerminal(frontTerminals[0].id.toString());
                }
            }).catch(e => console.log(e));

        fetchReservations();

        // ========================================================
        // 💡 [웹소켓 엔진] 전역 수신기를 장착합니다!
        // ========================================================
        const socketUrl = import.meta.env.VITE_API_URL || 'https://api.hotelnplus.com';
        socketRef.current = io(socketUrl, { transports: ['websocket'] });
        const socket = socketRef.current;

        // 1. 호텔 전체 데이터가 변했을 때 객실/예약 즉시 갱신
        socket.on('db_updated', (data) => {
            if (data.hotel_code === currentHotelCode || data.hotel_code === 'ALL') {
                console.log("🔄 [FrontDesk] Real-time data sync completed!");
                fetchRooms();
                fetchReservations();
            }
        });

        // 2. OTA에서 새 예약이 들어왔을 때 알람 소리 울리기 (기존 기능 유지)
        socket.on('newReservation', (data) => {
            if (data.hotel_code !== currentHotelCode && data.hotel_code !== 'ALL') return;

            showAlert('🔔 New Web Booking!', `Guest: ${data.guest_name}\nRoom: ${data.room_type}\nPlease check the OTA list.`, 'success');
            fetchReservations();
            fetchRooms();

            setIsOtaAlarmRinging(true);
            if (otaAudioRef.current) {
                otaAudioRef.current.play().catch(e => console.log('Audio blocked by browser'));
            }
        });

        // 💡 [신규] 태블릿에서 체크인 서명이 완료되어 날아올 때
        socket.on('checkin_signature_submit', (data) => {
            // 💡 [방어막] 수신된 서명의 방 번호가 '내가 금방 요청했던 방 번호'와 일치할 때만 모달을 띄웁니다!
            if (waitingForSignatureRoomId.current === String(data.roomId)) {
                setTabletSignature(data.signature);
                setIsTabletPending(false);
                setIsSigned(true);
                showAlert('✅ Signature Received', `Guest signature for Room ${data.roomId} received from tablet!`, 'success');
                waitingForSignatureRoomId.current = null; // 처리 완료 후 기억 지우기
            }
        });

        // 💡 [신규] 태블릿에서 체크아웃 서명이 완료되어 날아올 때
        socket.on('checkout_signature_submit', (data) => {
            if (waitingForSignatureRoomId.current === String(data.roomId)) {
                setTabletSignature(data.signature);
                setIsTabletPending(false);
                showAlert('✅ Signature Received', `Check-out acknowledgment for Room ${data.roomId} received from tablet!`, 'success');
                waitingForSignatureRoomId.current = null; // 처리 완료 후 기억 지우기
            }
        });

        return () => {
            socket.disconnect(); // 컴포넌트가 꺼지면 소켓 연결 안전하게 해제
        };
    }, [currentHotelCode]);

    const startCamera = async () => {
        setShowCamera(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) { videoRef.current.srcObject = stream; }
        } catch (err) {
            showAlert("Error", "Camera access denied or unavailable. Please use file upload.", "error");
            setShowCamera(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        }
        setShowCamera(false);
    };

    const startDrawing = ({ nativeEvent }) => {
        const { offsetX, offsetY } = nativeEvent;
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath(); ctx.moveTo(offsetX, offsetY); setIsDrawing(true);
        setIsSigned(true); // 💡 서명을 시작하면 상태를 true로 변경
    };
    const draw = ({ nativeEvent }) => {
        if (!isDrawing) return;
        const { offsetX, offsetY } = nativeEvent;
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(offsetX, offsetY); ctx.stroke();
    };
    const stopDrawing = () => setIsDrawing(false);
    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
        setIsSigned(false); // 💡 서명을 지우면 상태를 다시 false로 초기화
    };

    const startLine = (e, ref, setDrawing) => {
        const ctx = ref.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); setDrawing(true);
    };

    const drawLine = (e, ref, drawingState) => {
        if (!drawingState) return;
        const ctx = ref.current.getContext('2d'); ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); ctx.stroke();
    };

    const handleHandoverSubmit = async () => {
        if (!handoverData.total_cash || !handoverData.receiver_id || !handoverData.handover_pwd || !handoverData.receiver_pwd) {
            return showAlert('Error', 'All fields including passwords are required.', 'error');
        }

        try {
            // 1. 현재 근무자(인계자) 비밀번호 검증
            const hoRes = await fetch('/api/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUserId, username: currentUserId, password: handoverData.handover_pwd, hotel_code: currentHotelCode })
            });
            const hoData = await hoRes.json();
            if (!hoData.success) throw new Error("Invalid password for the current user (Handing Over).");

            // 2. 다음 근무자(인수자) ID 및 비밀번호 검증
            const recRes = await fetch('/api/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: handoverData.receiver_id, username: handoverData.receiver_id, password: handoverData.receiver_pwd, hotel_code: currentHotelCode })
            });
            const recData = await recRes.json();
            if (!recData.success) throw new Error("Invalid ID or password for the receiving user.");

            // 3. 검증 성공 시 교대 장부(DB) 기록
            await fetch('/api/shift/handover', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUserId,
                    receiver_id: handoverData.receiver_id,
                    total_cash: handoverData.total_cash,
                    notes: handoverData.notes,
                    handover_sig: 'VERIFIED_BY_PWD', // 서명 이미지 대신 텍스트 기록
                    receiver_sig: 'VERIFIED_BY_PWD',
                    hotel_code: currentHotelCode
                })
            });

            recordAuditLog(`Shift Handover to ${handoverData.receiver_id} completed. (Drawer Cash: ₱${handoverData.total_cash})`);
            showAlert('✅ Success', 'Shift Handover Verified & Completed!', 'success');

            setShowHandoverModal(false);
            setHandoverData({ total_cash: '', notes: '', receiver_id: '', handover_pwd: '', receiver_pwd: '' });
        } catch (err) {
            showAlert('Verification Failed', err.message || "Network error during verification.", 'error');
        }
    };

    // 💡 [수정 1] 스마트 검색 시 Vercel 캐시를 무시하고, 유지보수(503호 등) 방까지 모두 포함하여 무조건 최신 데이터를 가져옵니다.
    useEffect(() => {
        if (showSmartSearch && smartSearchParams.check_in && smartSearchParams.check_out && smartSearchParams.check_in < smartSearchParams.check_out) {
            fetch(`/api/rooms/available-search?t=${Date.now()}`, { // 🔥 Vercel 캐시 냉동 버그 파괴 (날짜 꼬리표 부착)
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                // 🔥 [Fix] include_maintenance: true 파라미터를 추가하여, 503호 같은 유지보수 방도 스마트 검색 결과에 포함되도록 요청합니다.
                body: JSON.stringify({ ...smartSearchParams, hotel_code: currentHotelCode, include_maintenance: true })
            })
                .then(res => res.json())
                .then(data => { if (data.success) { setSmartSearchResults(data.rooms); } })
                .catch(e => console.error(e));
        } else if (showSmartSearch && smartSearchParams.check_in >= smartSearchParams.check_out) {
            setSmartSearchResults([]);
        }
    }, [smartSearchParams, showSmartSearch, currentHotelCode]);

    const selectSmartRoom = (room) => {
        setShowSmartSearch(false); openModal(room);
        setGuestInfo((prev) => ({ ...prev, check_in_date: smartSearchParams.check_in, check_out_date: smartSearchParams.check_out }));
    };

    const handleCrmSearch = async () => {
        if (!crmQuery) return;
        const res = await fetch('/api/guests/search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: crmQuery, hotel_code: currentHotelCode })
        });
        const data = await res.json();
        if (data.success) { setCrmResults(data.guests); }
    };

    // 💡 [신규] 타이핑 할 때마다 실시간으로 자동 검색하는 엔진 (서버 과부하 방지용 0.3초 딜레이 적용)
    useEffect(() => {
        if (showCrmModal && crmQuery.trim().length > 0) {
            const delayDebounceFn = setTimeout(() => {
                handleCrmSearch();
            }, 300);
            return () => clearTimeout(delayDebounceFn);
        } else if (showCrmModal && crmQuery.trim().length === 0) {
            setCrmResults([]); // 검색어가 지워지면 결과도 초기화
        }
    }, [crmQuery, showCrmModal]);

    const selectCrmGuest = (guest) => {
        // 💡 [수정] 고객 이름(Full Name)을 First Name과 Last Name으로 똑똑하게 쪼개기
        const nameParts = (guest.name || '').trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        setGuestInfo((prev) => ({
            ...prev,
            guestName: guest.name || '',
            firstName: firstName,
            lastName: lastName,
            phone: guest.phone || '',
            email: guest.email || '',
            nationality: guest.nationality || prev.nationality,
            id_image: guest.id_image || prev.id_image || '' // 💡 신분증 이미지도 폼으로 즉시 전달!
        }));
        setShowCrmModal(false);
    };

    const fetchLedger = () => {
        fetch(`/api/front-ledger?hotel=${currentHotelCode}`)
            .then((r) => r.json()).then((data) => setLedgerList(data));
    };

    const handleLedgerSubmit = async () => {
        if (!ledgerTx.amount || !ledgerTx.description) return showAlert('Notice', "Amount and Description are required.", 'info');
        await fetch('/api/front-ledger', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...ledgerTx, user_id: currentUserId, date: getManilaDateTime(), hotel_code: currentHotelCode })
        });
        showAlert("Success", "Ledger Entry Saved!", 'success');
        setLedgerTx({ ...ledgerTx, amount: '', description: '' }); fetchLedger();
    };

    const handleAddLedgerCat = () => {
        if (newLedgerCat && !ledgerCategories.includes(newLedgerCat)) {
            setLedgerCategories([...ledgerCategories, newLedgerCat]); setLedgerTx({ ...ledgerTx, category: newLedgerCat });
        }
        setNewLedgerCat(''); setIsAddingLedgerCat(false);
    };

    // 💡 [신규 추가] 재무 기록 전용 필리핀 마닐라 시간 생성 함수 (24시간제)
    const getManilaDateTime = () => {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).format(new Date()).replace(', ', ' ');
    };

    // 💡 [수정] 메인 로그인 API(/api/login)를 재활용하여 매니저 권한을 완벽하게 검증하는 예약 취소 함수
    const executeCancelReservation = async () => {
        const cleanId = managerOverride.empId.trim();
        const cleanPwd = managerOverride.password.trim();

        if (!cleanId || !cleanPwd) {
            return showAlert("Notice", "Please enter Manager ID and Password.", "info");
        }

        try {
            // 1. 기존 로그인 API를 몰래 호출하여 완벽하게 검증 (POS와 동일한 방식)
            const payload = {
                user_id: cleanId,
                username: cleanId,
                password: cleanPwd,
                hotel_code: currentHotelCode
            };

            const verifyRes = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const verifyData = await verifyRes.json();

            if (verifyData.success) {
                // 직급(Role) 확인
                const role = (verifyData.user?.role || verifyData.role || verifyData.employee?.role || '').toUpperCase();
                const isManagerRole = role === 'SUPER_ADMIN' || role.includes('MANAGER') || role.includes('DIRECTOR') || role.includes('ADMIN');

                if (!isManagerRole) {
                    return showAlert("Access Denied", `Insufficient privileges.\n(Current Role: ${role})`, "error");
                }

                // 2. 권한 승인 완료! 예약 삭제 진짜로 진행
                const res = await fetch(`/api/reservations/${managerOverride.resId}?hotel=${currentHotelCode}`, { method: 'DELETE' });
                if (res.ok) {
                    showAlert('✅ Success', `Reservation cancelled.`, 'success');

                    // 💡 [로깅] 매니저 권한으로 예약을 취소했음을 백오피스 Audit Log에 정확히 기록!
                    recordAuditLog(`[Manager Override: ${cleanId}] Cancelled Reservation ${managerOverride.resId} (${managerOverride.guestName})`);

                    fetchReservations();
                    setManagerOverride({ show: false, resId: '', guestName: '', empId: '', password: '' });
                } else {
                    showAlert('Error', 'Failed to cancel reservation.', 'error');
                }
            } else {
                showAlert("Access Denied", verifyData.message || "Invalid ID or Password.", "error");
            }
        } catch (err) {
            console.error("Manager Verification Error:", err);
            showAlert('Error', 'Network error during verification.', 'error');
        }
    };

    // 💡 [수정] 새 예약 저장 시 룸 타입 초기화 버그 완벽 해결
    const handleCreateReservation = async () => {
        if (!newResData.guest_name || !newResData.check_in_date || !newResData.check_out_date) {
            return showAlert('Notice', 'Guest Name, Check-in, and Check-out dates are required.', 'info');
        }
        try {
            // 방 타입이 비정상일 경우(화면과 상태값 불일치 시) 첫 번째 방 타입으로 강제 매핑
            const finalRoomType = newResData.room_type || (roomTypes.length > 0 ? roomTypes[0].name : 'Standard');

            const res = await fetch('/api/reservations/create', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newResData, room_type: finalRoomType, hotel_code: currentHotelCode })
            });

            if (res.ok) {
                showAlert('✅ Success', 'Reservation created successfully!', 'success');
                setShowNewResModal(false);
                fetchReservations();
                // 💡 다음 예약을 위해 폼을 비울 때, "현재 호텔의 진짜 첫 번째 룸 타입"으로 초기화합니다!
                setNewResData({
                    guest_name: '', channel: 'Walk-in',
                    room_type: roomTypes.length > 0 ? roomTypes[0].name : 'Standard',
                    check_in_date: getHotelDate(0), check_out_date: getHotelDate(1), phone: '', email: ''
                });
            }
        } catch (e) { showAlert('Error', 'Failed to create reservation.', 'error'); }
    };

    const handleDirectOTAConfirm = (res) => {
        const today = getHotelDate(0);

        if (res.check_in_date > today) {
            showAlert('Future Booking', `This is a future reservation (Check-in: ${res.check_in_date}).\n\nPlease assign a physical room on the actual day of arrival to avoid blocking the room today.`, 'info');
            return;
        }

        const availableRoomsForType = rooms.filter((r) => r.room_type === res.room_type && r.status === 'VACANT');

        if (availableRoomsForType.length > 0) {
            availableRoomsForType.sort((a, b) => (a.usage_count || a.usageCount || 0) - (b.usage_count || b.usageCount || 0));
            const selectedAvailableRoom = availableRoomsForType[0];

            setShowResModal(false); setSelectedRoom(selectedAvailableRoom); setLinkedResId(res.res_id);
            const gName = res.guest_name || ''; const nameParts = gName.trim().split(' ');
            setGuestInfo({
                guestName: gName, firstName: nameParts[0] || '', lastName: nameParts.slice(1).join(' ') || '',
                nationality: res.nationality || '', email: res.email || '', phone: res.phone || '',
                check_in_date: res.check_in_date || '', check_out_date: res.check_out_date || '',
                room_type: res.room_type,
                // 💡 [수정 1] Rewards(App) 예약일 때만 신분증 이미지를 가져오고, 나머진 빈칸으로 초기화!
                id_image: res.channel === 'n+ Rewards (App)' ? (res.id_image || '') : '',
                channel: res.channel || 'Walk-in'
            });
            setPayAmount(''); setPayMethod('Cash'); setExtendMethod('Cash'); setExtensionDate('');
            setIsIssuingKey(false); setIsKeyIssued(false); setIsDepositPaid(false); setTimeout(clearSignature, 100);
            setTabletSignature('');
            setIsTabletPending(false);
        } else {
            showAlert('Error', `No vacant rooms available for type: ${res.room_type}.`, 'error');
        }
    };

    const handleLinkReservation = (resId) => {
        setLinkedResId(resId);
        const res = pendingReservations.find((r) => r.res_id === resId);
        if (res) {
            const gName = res.guest_name || ''; const nameParts = gName.trim().split(' ');
            setGuestInfo((prev) => ({
                ...prev, guestName: gName, firstName: nameParts[0] || '', lastName: nameParts.slice(1).join(' ') || '',
                phone: res.phone || '', email: res.email || '', nationality: res.nationality || prev.nationality,
                check_in_date: res.check_in_date, check_out_date: res.check_out_date, channel: res.channel,
                // 💡 [수정 1] 드롭다운 연동 시에도 동일한 조건 적용!
                id_image: res.channel === 'n+ Rewards (App)' ? (res.id_image || '') : ''
            }));
            if (res.room_type !== guestInfo.room_type) handleUpdateRoomType(res.room_type);
        } else {
            setGuestInfo({ guestName: '', firstName: '', lastName: '', nationality: '', email: '', phone: '', check_in_date: getHotelDate(0), check_out_date: '', room_type: selectedRoom.room_type, id_image: '', channel: 'Walk-in' });
        }
    };

    // 💡 [신규 추가] 보증금 장부 기록을 '체크인/예약 확정 100% 성공 시'에만 실행하는 헬퍼 함수
    const recordDepositToDB = async (roomId, guestName) => {
        if (!isDepositPaid) return;
        const depositAmt = parseFloat(extraInfo.deposit) || 0;
        if (depositAmt > 0 && extraInfo.deposit_method !== 'CC Open') {
            // 💡 [중복 방지 완벽 해결]
            if (extraInfo.deposit_method === 'Cash') {
                await fetch('/api/front-ledger', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: getManilaDateTime(), type: 'IN', category: 'Cash Sales (Deposit)', amount: depositAmt, description: `Room ${roomId} Deposit (${guestName || 'Guest'})`, user_id: currentUserId, hotel_code: currentHotelCode })
                });
            } else {
                await fetch('/api/finance/transactions', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: getManilaDateTime(), type: 'REVENUE', category: 'Downpayment / Deposit', amount: depositAmt, description: `Room ${roomId} Deposit via ${extraInfo.deposit_method}`, hotel_code: currentHotelCode })
                });
            }
        }
    };

    const handleAddAdditionalDeposit = () => {
        if (addDepositMethod === 'Card' && !selectedTerminal) return showAlert("Terminal Required", "Please select your connected Payment Terminal.", "info");
        const amt = parseFloat(addDepositAmt);
        if (!amt || amt <= 0) return showAlert("Notice", "Enter a valid amount to add.", "info");

        setIsProcessingDeposit(true);
        setTimeout(async () => {
            setIsProcessingDeposit(false);
            const currentDep = parseFloat(extraInfo.deposit || 0);
            setExtraInfo({ ...extraInfo, deposit: currentDep + amt }); setAddDepositAmt('');

            if (addDepositMethod !== 'CC Open') {
                // 💡 [중복 방지 완벽 해결]
                if (addDepositMethod === 'Cash') {
                    await fetch('/api/front-ledger', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date: getManilaDateTime(), type: 'IN', category: 'Cash Sales (Deposit)', amount: amt, description: `Room ${selectedRoom.id} Addl Deposit`, user_id: currentUserId, hotel_code: currentHotelCode })
                    });
                } else {
                    await fetch('/api/finance/transactions', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date: getManilaDateTime(), type: 'REVENUE', category: 'Downpayment / Deposit', amount: amt, description: `Room ${selectedRoom.id} Addl Deposit via Card`, hotel_code: currentHotelCode })
                    });
                }
            }
            showAlert("✅ Success", `Additional Deposit of ₱${amt.toLocaleString()} via ${addDepositMethod} approved.`, "success");
        }, 1500);
    };

    // 💡 [신규] 서명 이미지에서 빈 공간(여백)을 자동으로 찾아내 싹둑 잘라내는 함수
    const cropSignature = (base64) => {
        return new Promise((resolve) => {
            if (!base64 || base64 === '') return resolve('');
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
                let hasPixels = false;

                // 픽셀 하나하나 검사해서 실제 펜 자국(글씨)이 있는 상하좌우 끝점 찾기
                for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        const alpha = data[(y * canvas.width + x) * 4 + 3];
                        if (alpha > 5) { // 투명하지 않은 픽셀(글씨) 감지
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                            hasPixels = true;
                        }
                    }
                }

                if (!hasPixels) return resolve(base64); // 글씨가 없으면 원본 반환

                // 잘라낼 때 상하좌우 여유 공간(Padding) 10px 주기
                const padding = 10;
                minX = Math.max(0, minX - padding);
                minY = Math.max(0, minY - padding);
                maxX = Math.min(canvas.width, maxX + padding);
                maxY = Math.min(canvas.height, maxY + padding);

                const cropW = maxX - minX;
                const cropH = maxY - minY;

                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = cropW;
                cropCanvas.height = cropH;
                const cropCtx = cropCanvas.getContext('2d');

                // 실제 글씨 부분만 새 캔버스에 그리기
                cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
                resolve(cropCanvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(base64);
            img.src = base64;
        });
    };

    // 💡 [혁신 1] 신분증 사진 업로드 시 용량을 800px 크기의 가벼운 JPG로 자동 압축합니다. (에러 원천 차단)
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
                const MAX_WIDTH = 800; // 최대 가로 길이 제한

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // 화질 70%의 가벼운 JPEG로 변환
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                setGuestInfo((prev) => ({ ...prev, id_image: compressedDataUrl }));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    };

    // 💡 웹캠 촬영 시에도 자동으로 용량을 압축합니다.
    const captureImage = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            let width = videoRef.current.videoWidth;
            let height = videoRef.current.videoHeight;
            const MAX_WIDTH = 800;

            if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, width, height);

            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setGuestInfo(prev => ({ ...prev, id_image: compressedDataUrl }));
            stopCamera();
        }
    };

    // 💡 [핵심] 보증금 버튼을 누르면 DB로 전송하지 않고 "결제 대기(Verified)" 상태로만 만듭니다!
    const handleProcessDeposit = (e) => {
        e.preventDefault();
        if (extraInfo.deposit_method === 'Card' && !selectedTerminal) return showAlert("Terminal Required", "Please select your connected Payment Terminal from the TOP MENU before charging.", "info");
        const depositAmt = parseFloat(extraInfo.deposit);
        if (!depositAmt || depositAmt <= 0) return showAlert("Notice", "Please enter a valid deposit amount to charge.", "info");

        setIsProcessingDeposit(true);
        setTimeout(() => {
            setIsProcessingDeposit(false);
            setIsDepositPaid(true); // 🟢 녹색 체크 표시로 바뀜
            showAlert("✅ Verified", `Deposit of ₱${depositAmt.toLocaleString()} is ready.\nIt will be securely recorded when Check-in is successfully completed.`, "success");
        }, 1000);
    };

    // 💡 예약 확정 로직 (에러 나도 창 안 닫힘 + 100% 성공 시에만 돈 전송)
    const handleConfirmReservation = async () => {
        if (!guestInfo.guestName || !guestInfo.guestName.trim()) return showAlert("Notice", "Please enter guest's name.", "info");

        const currentRoomId = selectedRoom.id;
        const currentGuestName = guestInfo.guestName;

        const payloadUpdate = {
            id: currentRoomId, status: 'RESERVED', ...guestInfo, check_in_date: guestInfo.check_in_date || getHotelDate(0), signature: '',
            id_image: guestInfo.id_image || '', increment_usage: false, hotel_code: currentHotelCode, remark: selectedRoom.remark || '', maintenance_remarks: selectedRoom.maintenance_remarks || '', deposit: extraInfo.deposit || 0
        };
        const payloadRes = linkedResId ? { res_id: linkedResId, hotel_code: currentHotelCode } : null;
        const payloadExtra = { id: currentRoomId, ...extraInfo, hotel_code: currentHotelCode };

        try {
            const updateRes = await fetch('/api/rooms/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadUpdate) });
            const updateData = await updateRes.json();

            if (updateRes.ok && updateData.success) {
                if (payloadRes) {
                    await fetch('/api/reservations/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadRes) });
                    fetchReservations();
                }
                await fetch('/api/rooms/extra-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadExtra) });

                // 💡 [안전] 100% 배정이 완료되었을 때만 장부에 기록합니다.
                await recordDepositToDB(currentRoomId, currentGuestName);

                fetchRooms();
                closeModal(); // 🟢 성공 시에만 모달창 닫기!
                showAlert('Success', `Reservation Confirmed! Room ${currentRoomId} is now RESERVED for ${currentGuestName}.`, 'success');
            } else {
                showAlert('Error', `Failed to assign room: ${updateData.message || 'Server Error'}`, 'error');
            }
        } catch (error) {
            showAlert('Error', 'Network error while assigning reservation.', 'error');
        }
    };

    // 💡 일반 체크인 로직 (에러 나도 창 안 닫힘 + 100% 성공 시에만 돈 전송)
    const handleCheckIn = async () => {
        if (!guestInfo.guestName || !guestInfo.guestName.trim()) return showAlert("Notice", "Please enter guest's name.", "info");
        if (!guestInfo.phone || !guestInfo.phone.trim()) return showAlert("Notice", "Please enter phone number.", "info");
        if (!guestInfo.email || !guestInfo.email.trim()) return showAlert("Notice", "Please enter email address.", "info");
        if (!guestInfo.nationality) return showAlert("Notice", "Please select nationality.", "info");
        if (!guestInfo.check_out_date) return showAlert("Notice", "Please select expected check-out date.", "info");
        if (!guestInfo.id_image) return showAlert("Notice", "Please upload or capture ID Card.", "info");
        if (!isSigned && !tabletSignature) return showAlert("Notice", "Please get guest's electronic signature.", "info");
        if (extraInfo.deposit === '') return showAlert("Notice", "Please enter Deposit amount (0 if none).", "info");
        if (parseFloat(extraInfo.deposit) > 0 && !isDepositPaid) return showAlert("Notice", "Please execute Deposit charge first.", "info");
        if (!isKeyIssued) return showAlert("Notice", "Please issue Key Card first.", "info");

        let rawSignature = tabletSignature || (canvasRef.current ? canvasRef.current.toDataURL() : '');
        let signatureData = typeof cropSignature === 'function' ? await cropSignature(rawSignature) : rawSignature;

        const currentRoomId = selectedRoom.id;
        const currentGuestName = guestInfo.guestName;

        const payloadUpdate = { id: currentRoomId, status: 'OCCUPIED', ...guestInfo, check_in_date: guestInfo.check_in_date || getHotelDate(0), signature: signatureData, increment_usage: true, hotel_code: currentHotelCode, remark: selectedRoom.remark || '', maintenance_remarks: selectedRoom.maintenance_remarks || '', deposit: extraInfo.deposit || 0 };
        const payloadExtra = { id: currentRoomId, ...extraInfo, hotel_code: currentHotelCode };

        try {
            const updateRes = await fetch('/api/rooms/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadUpdate) });
            const updateData = await updateRes.json();

            if (updateRes.ok && updateData.success) {
                await fetch('/api/rooms/extra-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadExtra) });

                // 💡 [안전] 100% 체크인이 완료되었을 때만 장부에 기록합니다.
                await recordDepositToDB(currentRoomId, currentGuestName);

                fetchRooms();
                closeModal(); // 🟢 성공 시에만 모달창 닫기!
                showAlert('Success', `Successfully checked in ${currentGuestName} to Room ${currentRoomId}`, 'success');
            } else {
                showAlert('Error', `Check-in failed: ${updateData.message || 'A server error occurred.'}`, 'error');
            }
        } catch (error) {
            showAlert('Error', 'Unable to communicate with the server. Please check the network or image size.', 'error');
        }
    };

    // 💡 예약 체크인 로직
    const handleReservedCheckIn = handleCheckIn;

    const saveExtraInfo = async () => {
        await fetch('/api/rooms/extra-info', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: selectedRoom.id, ...extraInfo, hotel_code: currentHotelCode })
        });
        showAlert("Success", "Additional info and Folio limits updated successfully.", 'success');
    };

    const handleTransferRoom = async () => {
        if (!transferTarget) return showAlert("Notice", "Select a target room.", 'info');
        const res = await fetch('/api/rooms/transfer', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_room_id: selectedRoom.id, new_room_id: transferTarget, user_id: currentUser, hotel_code: currentHotelCode })
        });
        if (res.ok) {
            closeModal();
            fetchRooms(); // 💡 [추가] 방 이동 완료 직후 두 방의 상태를 즉시 새로고침!
            showAlert("Success", `Transferred to Room ${transferTarget}.`, 'success');
            setShowTransferMode(false);
        }
        else { showAlert("Error", "Transfer failed.", 'error'); }
    };

    const handleIssueKeyCard = () => {
        setIsIssuingKey(true);
        setTimeout(() => { setIsIssuingKey(false); setIsKeyIssued(true); showAlert("Success", `✅ Key Card successfully encoded for Room ${selectedRoom.id}.`, 'success'); }, 1500);
    };

    // 💡 [Ultimate AI Recommendation Engine] Provides comprehensive Option 1 and Option 2
    const handleExtendRoomClick = async () => {
        if (!extensionDate) return showAlert("Notice", "Please select a checkout date.", "info");

        const currentOutDate = (selectedRoom.check_out_date || new Date().toISOString()).substring(0, 10);
        const targetOutDate = extensionDate.substring(0, 10);

        const parseSafeDate = (dStr) => {
            const [y, m, d] = dStr.split('-').map(Number);
            return new Date(y, m - 1, d);
        };

        const extraNights = Math.ceil((parseSafeDate(targetOutDate) - parseSafeDate(currentOutDate)) / (1000 * 60 * 60 * 24));
        if (extraNights <= 0) return showAlert("Notice", "New checkout date must be AFTER the current checkout date.", "info");

        showAlert("Analyzing...", "Generating smart extension options. Please wait...", "info");

        try {
            let nightStatus = [];
            let canStayInCurrentRoomAllNights = true;

            const addDaysSafe = (dateStr, days) => {
                const d = parseSafeDate(dateStr);
                d.setDate(d.getDate() + days);
                const ny = d.getFullYear();
                const nm = String(d.getMonth() + 1).padStart(2, '0');
                const nd = String(d.getDate()).padStart(2, '0');
                return `${ny}-${nm}-${nd}`;
            };

            const currentRoomType = String(selectedRoom.room_type).trim();
            const currentRoomTypeLower = currentRoomType.toLowerCase();

            for (let i = 0; i < extraNights; i++) {
                const checkIn = addDaysSafe(currentOutDate, i);
                const checkOut = addDaysSafe(currentOutDate, i + 1);

                // 💡 [핵심 해결] RoomList(정상)와 완벽히 똑같이 주소줄 끝에 ?hotel= 을 붙여서 검색 실패를 원천 차단합니다!
                const res = await fetch(`/api/public/rooms/available?hotel=${currentHotelCode}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ checkIn, checkOut, hotel_code: currentHotelCode })
                });
                const availableRooms = await res.json();

                if (Array.isArray(availableRooms)) {
                    // 1개라도 남아있는 객실 타입들을 싹 다 추출
                    const availableTypes = availableRooms
                        .filter(r => Number(r.availableCount) > 0)
                        .map(r => String(r.name).trim());

                    nightStatus.push({
                        date: checkIn,
                        availableTypes: availableTypes
                    });

                    if (!availableTypes.map(t => t.toLowerCase()).includes(currentRoomTypeLower)) {
                        canStayInCurrentRoomAllNights = false;
                    }
                } else {
                    throw new Error("API returned non-array");
                }
            }

            if (canStayInCurrentRoomAllNights) {
                // 현재 방에서 모든 기간 연장이 가능한 최고의 상황 -> 결제창 즉시 오픈
                setAlertModal({ show: false, title: '', message: '', type: 'info' });
                const rType = roomTypes.find(rt => String(rt.name).trim().toLowerCase() === currentRoomTypeLower);
                const nightlyRate = rType ? (rType.price || rType.basePrice || 5000) : 5000;
                setExtendPaymentData({ show: true, extraNights, amount: extraNights * nightlyRate, newDate: targetOutDate });
            } else {
                // 💡 [옵션 1 & 2 자동 생성기] 프론트 데스크 직원을 위한 완벽한 영문 안내 대본
                let guideMessage = `Requested Extension: ${extraNights} night(s) from ${currentOutDate}\n\n`;

                // 🌟 옵션 1: 전체 기간을 "방 한 번만 옮기고" 지낼 수 있는 객실 타입 찾기
                let commonTypes = nightStatus[0].availableTypes;
                for (let i = 1; i < extraNights; i++) {
                    commonTypes = commonTypes.filter(t => nightStatus[i].availableTypes.includes(t));
                }

                if (commonTypes.length > 0) {
                    guideMessage += `🌟 OPTION 1: Seamless Room Move (1-Time Move)\n`;
                    guideMessage += `Guest can stay in the following room(s) for the ENTIRE duration:\n`;
                    commonTypes.forEach(t => {
                        guideMessage += ` - Check-in to [ ${t} ] for ${extraNights} nights.\n`;
                    });
                    guideMessage += `\n`;
                } else {
                    guideMessage += `🌟 OPTION 1: Seamless Room Move\n - ❌ No single room type is available for the entire duration.\n\n`;
                }

                // 🔄 옵션 2: 1박 단위로 쪼개서 빈 방 긁어모아주기
                guideMessage += `🔄 OPTION 2: Night-by-Night Breakdown (Partial Moves)\n`;
                nightStatus.forEach((night, idx) => {
                    const hasCurrent = night.availableTypes.map(t => t.toLowerCase()).includes(currentRoomTypeLower);
                    if (hasCurrent) {
                        // 현재 방 연장 가능 시 1순위 추천
                        guideMessage += ` - Night ${idx + 1} (${night.date}): Stay in CURRENT ROOM (${currentRoomType})\n`;
                    } else if (night.availableTypes.length > 0) {
                        // 다른 방으로 옮겨야 할 때
                        guideMessage += ` - Night ${idx + 1} (${night.date}): Move to [ ${night.availableTypes.join(' OR ')} ]\n`;
                    } else {
                        // 호텔 전체가 꽉 찼을 때
                        guideMessage += ` - Night ${idx + 1} (${night.date}): ❌ HOTEL FULLY BOOKED\n`;
                    }
                });

                guideMessage += `\n💡 Action:\nTo extend the nights they can stay in the current room, reduce the checkout date and click 'Extend'. For room moves, please create a NEW reservation.`;

                showAlert("Smart Extension Analysis", guideMessage, "info");
            }

        } catch (error) {
            console.error(error);
            showAlert("Error", "An error occurred while checking availability. Please try again.", "error");
        }
    };

    const handleConfirmExtendPayment = async () => {
        if (extendMethod === 'Card' && !selectedTerminal) return showAlert("Terminal Required", "Please select a Terminal.", "info");
        const { newDate, extraNights, amount } = extendPaymentData;
        setExtendPaymentData({ show: false, extraNights: 0, amount: 0, newDate: '' });

        await fetch('/api/rooms/update', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...selectedRoom, check_out_date: newDate, increment_usage: false, hotel_code: currentHotelCode })
        });

        // 💡 [중복 방지 완벽 해결] 현금은 front-ledger, 카드는 finance로만 쏩니다!
        if (extendMethod === 'Cash') {
            await fetch('/api/front-ledger', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: getManilaDateTime(), type: 'IN', category: 'Room Payment', amount: amount, description: `Room ${selectedRoom.id} Extension (Cash)`, user_id: currentUserId, hotel_code: currentHotelCode })
            });
        } else {
            await fetch('/api/finance/transactions', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: getManilaDateTime(), type: 'REVENUE', category: 'Room Payment', amount: amount, description: `Room ${selectedRoom.id} Extension`, user_id: currentUserId, hotel_code: currentHotelCode })
            });
        }

        fetchRooms();
        showAlert("Success", `Room ${selectedRoom.id} extended to ${newDate}.\nPayment ₱${amount.toLocaleString()} received.`, 'success');
        setExtensionDate('');
        setRooms(prev => prev.map(r => r.id === selectedRoom.id ? { ...r, check_out_date: newDate } : r));
        setSelectedRoom(prev => ({ ...prev, check_out_date: newDate }));
    };

    const handlePayment = async () => {
        if (payMethod === 'Card' && !selectedTerminal) return showAlert("Terminal Required", "Please select a Terminal.", "info");
        const amount = parseFloat(payAmount);
        if (!amount || amount <= 0) return showAlert("Notice", "Enter a valid amount.", "info");
        if (amount > selectedRoom.balance) return showAlert("Notice", "Payment cannot exceed balance.", "error");

        const res = await fetch('/api/folio/pay', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_number: selectedRoom.id, amount: amount, user_id: currentUserId, hotel_code: currentHotelCode })
        });
        if (res.ok) {
            // 💡 [중복 방지 완벽 해결]
            if (payMethod === 'Cash') {
                await fetch('/api/front-ledger', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: getManilaDateTime(), type: 'IN', category: 'Room Payment', amount: amount, description: `Room ${selectedRoom.id} Folio Payment`, user_id: currentUserId, hotel_code: currentHotelCode })
                });
            } else {
                await fetch('/api/finance/transactions', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: getManilaDateTime(), type: 'REVENUE', category: 'Room Payment', amount: amount, description: `Room ${selectedRoom.id} Folio Payment`, user_id: currentUserId, hotel_code: currentHotelCode })
                });
            }
            showAlert("Success", `Payment of ₱${amount.toLocaleString()} processed.`, 'success'); setPayAmount('');
        } else { showAlert("Error", "Payment failed.", "error"); }
    };

    // 💡 [수정] 투숙 중 요청(w/o check out)은 방 상태(OCCUPIED)를 유지하고, 퇴실/블록 요청만 상태를 변경합니다!
    const executeServiceRequest = async () => {
        const { type, memo } = svcModal;
        let requestMemo = '';
        const now = new Date();
        const timeStr = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        let newStatus = selectedRoom.status;

        // 💡 [핵심 수정] KDS가 알림을 띄울 수 있도록 투숙 중(In-Stay) 상태 코드로 확실히 변경합니다!
        if (type === 'MAKE_UP_STAY') {
            requestMemo = `🧹 [Make Up Req (In-Stay): ${timeStr}] ${memo ? '\nNote: ' + memo : ''}`;
            newStatus = 'MAKE_UP_GUEST';
        }
        else if (type === 'MAKE_UP_OUT') {
            requestMemo = `🧹 [Make Up Req (Checkout): ${timeStr}]`;
            newStatus = 'MAKE_UP_CHECKOUT';
        }
        else if (type === 'MAINT_STAY') {
            requestMemo = `🛠️ [Service Task (In-Stay): ${timeStr}] ${memo ? '\nIssue: ' + memo : ''}`;
            newStatus = 'MT_PREPARATION';
        }
        else if (type === 'MAINT_OUT') {
            requestMemo = `🛠️ [Maintenance Block: ${timeStr}]`;
            newStatus = 'MAINTENANCE';
        }

        const prevMemo = selectedRoom.maintenance_remarks ? selectedRoom.maintenance_remarks + '\n' : '';

        // 💡 [수정] 방 타입 보호 로직 추가 (selectedRoom.type 대비)
        const safeRoomType = selectedRoom.room_type || selectedRoom.type || 'Standard';

        const payloadUpdate = {
            id: selectedRoom.id, status: newStatus, guestName: selectedRoom.guestName,
            nationality: selectedRoom.nationality, email: selectedRoom.email, phone: selectedRoom.phone,
            check_in_date: selectedRoom.check_in_date, check_out_date: selectedRoom.check_out_date,
            signature: selectedRoom.signature, id_image: selectedRoom.id_image,
            room_type: safeRoomType, // 👈 안전하게 묶은 변수 사용
            hotel_code: currentHotelCode, remark: selectedRoom.remark || '', maintenance_remarks: prevMemo + requestMemo,
            increment_usage: false
        };

        try {
            setSvcModal({ show: false, type: '', memo: '' });
            closeModal();
            const res = await fetch('/api/rooms/update', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadUpdate)
            });
            const data = await res.json();
            if (res.ok && data.success) {
                fetchRooms();
                showAlert('Success', `Request has been successfully sent to KDS.`, 'success');
            } else {
                showAlert('Error', 'Failed to send the request.', 'error');
            }
        } catch (e) {
            showAlert('Error', 'Server communication error occurred.', 'error');
        }
    };

    const openCheckoutFlow = () => {
        // 1. 예정된 체크아웃 날짜 안전하게 파싱 (예: "2026-04-25")
        const outDateStr = selectedRoom.check_out_date || getHotelDate(1);
        const [outY, outM, outD] = outDateStr.split('-').map(Number);
        const targetOutDate = new Date(outY, outM - 1, outD, 0, 0, 0);

        // 2. 현재 시간 기준 '실제 정산 기준일' 계산
        const now = new Date();
        const effectiveCurrentDate = new Date(now);

        // 💡 [핵심: 오후 1시 룰] 
        // 오후 1시(13:00)가 지났으면, 오늘 밤 숙박을 소진한 것으로 간주하여 '내일 나간 것'과 동일하게 처리합니다.
        if (effectiveCurrentDate.getHours() >= 13) {
            effectiveCurrentDate.setDate(effectiveCurrentDate.getDate() + 1);
        }
        effectiveCurrentDate.setHours(0, 0, 0, 0);

        // 3. 조기 퇴실 일수 = (예정된 체크아웃 날짜) - (실제 정산 기준일)
        // 예: 25일 아웃 예정자가 24일 14:00에 나간다면 -> effectiveCurrentDate가 25일이 되므로 25 - 25 = 0 (정상 퇴실)
        // 예: 25일 아웃 예정자가 24일 11:00에 나간다면 -> effectiveCurrentDate가 24일이 되므로 25 - 24 = 1 (1박 조기 퇴실)
        let earlyNights = Math.max(0, Math.round((targetOutDate - effectiveCurrentDate) / (1000 * 60 * 60 * 24)));

        setCheckoutData({ refundAmount: 0, refundMethod: 'Cash', earlyNights, settleMethod: 'Cash' });
        setShowCheckoutModal(true);

        // 유령 서명 강제 초기화
        setTabletSignature('');
        setIsTabletPending(false);
    };

    const applyRefundPolicy = (percent) => {
        const rType = roomTypes.find(rt => rt.name === selectedRoom.room_type);
        const nightlyRate = rType ? (rType.price || rType.basePrice || 5000) : 5000;
        setCheckoutData({ ...checkoutData, refundAmount: checkoutData.earlyNights * nightlyRate * (percent / 100) });
    };

    const handleFinalCheckout = async () => {
        const folio = selectedRoom.balance || 0;
        const deposit = extraInfo.deposit_method === 'CC Open' ? 0 : (parseFloat(extraInfo.deposit) || 0);
        const refundAmt = parseFloat(checkoutData.refundAmount) || 0;
        const netDue = folio - deposit - refundAmt;

        if (netDue > 0 && checkoutData.settleMethod === 'Card' && !selectedTerminal) return showAlert("Terminal Required", "Please select a Payment Terminal.", "info");

        if (!tabletSignature && netDue <= 0 && deposit > 0) {
            return showAlert("Signature Required", "Please get the guest's signature on the tablet before finalizing the refund.", "info");
        }

        if (netDue !== 0) {
            const action = netDue > 0 ? `COLLECT ₱${netDue.toLocaleString()}` : `REFUND ₱${Math.abs(netDue).toLocaleString()}`;
            if (!window.confirm(`Net Balance is not zero!\n\nPlease ${action}\n\nDid you complete this transaction?`)) return;
        }

        // 💡 [중복 방지 완벽 해결] 정산(수금 및 환불) 시 현금과 카드를 완벽히 분리!
        if (netDue > 0) {
            if (checkoutData.settleMethod === 'Cash') {
                await fetch('/api/front-ledger', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: getManilaDateTime(), type: 'IN', category: 'Room Payment', amount: netDue, description: `Final Settlement Collect (Room ${selectedRoom.id})`, user_id: currentUserId, hotel_code: currentHotelCode })
                });
            } else {
                await fetch('/api/finance/transactions', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: getManilaDateTime(), type: 'REVENUE', category: 'Room Payment', amount: netDue, description: `Final Settlement Collect (Room ${selectedRoom.id})`, hotel_code: currentHotelCode })
                });
            }
        } else if (netDue < 0) {
            if (checkoutData.refundMethod === 'Cash') {
                await fetch('/api/front-ledger', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: getManilaDateTime(), type: 'OUT', category: 'Refund / Void', amount: Math.abs(netDue), description: `Final Settlement Refund (Room ${selectedRoom.id})`, user_id: currentUserId, hotel_code: currentHotelCode })
                });
            } else {
                await fetch('/api/finance/transactions', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: getManilaDateTime(), type: 'EXPENSE', category: 'Refund / Void', amount: Math.abs(netDue), description: `Final Settlement Refund (Room ${selectedRoom.id})`, hotel_code: currentHotelCode })
                });
            }
        }

        const currentRoomId = selectedRoom.id;
        const snapshotData = {
            folio_charges: folio,
            security_deposit: deposit,
            early_checkout_refund: checkoutData.refundAmount,
            net_balance: netDue,
            settle_method: netDue > 0 ? checkoutData.settleMethod : checkoutData.refundMethod,
            signature_image: tabletSignature || ''
        };

        setShowCheckoutModal(false);
        closeModal();

        await fetch('/api/rooms/checkout', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: currentRoomId, hotel_code: currentHotelCode, checkout_signature: JSON.stringify(snapshotData) })
        });
        showAlert("✅ Success", `Room ${currentRoomId} successfully checked out and settled!`, 'success');
    };

    const handleMarkClean = async () => {
        const currentRoomId = selectedRoom.id;
        // 💡 [수정] 방 타입이 undefined로 날아가서 NOT SET이 되는 버그 방지
        const currentRoomType = selectedRoom.room_type || selectedRoom.type || 'Standard';

        const revertStatus = (selectedRoom.status === 'MAKE_UP_GUEST' || selectedRoom.status === 'MT_PREPARATION') ? 'OCCUPIED' : 'VACANT';
        closeModal();
        await fetch('/api/rooms/update', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: currentRoomId, status: revertStatus, room_type: currentRoomType, increment_usage: false, maintenance_remarks: '', hotel_code: currentHotelCode })
        });
        fetchRooms();
        showAlert("Success", "Room marked as Clean & Ready.", 'success');
    };

    const handleMarkMaintenance = async () => {
        const remark = window.prompt("Enter the reason for maintenance:", "");
        if (remark === null) return;
        const currentRoomId = selectedRoom.id;
        // 💡 [수정] 방 타입 보호 로직 추가
        const currentRoomType = selectedRoom.room_type || selectedRoom.type || 'Standard';
        closeModal();
        await fetch('/api/rooms/update', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: currentRoomId, status: 'MAINTENANCE', room_type: currentRoomType, increment_usage: false, maintenance_remarks: remark, hotel_code: currentHotelCode })
        });
    };

    const handleUpdateRoomType = async (newType) => {
        await fetch('/api/rooms/update-type', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: selectedRoom.id, room_type: newType, hotel_code: currentHotelCode })
        });
        setGuestInfo({ ...guestInfo, room_type: newType });
    };

    const handleDeletePhysicalRoom = async () => {
        if (window.confirm(`Are you sure you want to completely DELETE Room ${selectedRoom.id} from the system?`)) {
            const currentRoomId = selectedRoom.id;
            try {
                closeModal();
                await fetch(`/api/rooms/${currentRoomId}?hotel=${currentHotelCode}`, { method: 'DELETE' });
                setRooms(prev => prev.filter(r => r.id !== currentRoomId));
                showAlert("Success", `Room ${currentRoomId} has been permanently deleted.`, "success");
            } catch (e) { showAlert("Error", "Failed to delete room.", "error"); }
        }
    };

    const openModal = (room) => {
        setSelectedRoom(room); setLinkedResId(''); setShowTransferMode(false); setIsKeyIssued(false); setIsDepositPaid(false); setIsProcessingDeposit(false);
        const gName = room.guestName || ''; const nameParts = gName.trim().split(' ');

        // 💡 [수정] 모달 열 때 room_type 안전성 강화
        const safeRoomType = room.room_type || room.type || 'Standard';

        // 💡 [신규 추가] Admin에서 설정한 객실 타입별 보증금(Deposit) 자동 불러오기
        const targetRoomType = roomTypes.find(rt => (rt.name?.en || rt.name) === safeRoomType);
        let defaultDeposit = 0;
        if (targetRoomType) {
            let rConfig = {};
            try { rConfig = typeof targetRoomType.roomConfig === 'string' ? JSON.parse(targetRoomType.roomConfig) : (targetRoomType.roomConfig || {}); } catch (e) { }
            // roomConfig 내부의 deposit 값을 확인하고, 없으면 security_deposit 컬럼 확인
            defaultDeposit = rConfig.deposit || targetRoomType.security_deposit || 0;
        }

        // 이미 결제된 보증금(room.deposit)이 있으면 유지하고, 빈 방이면 Admin 설정값 자동 적용!
        const autoDeposit = room.deposit ? room.deposit : (defaultDeposit > 0 ? defaultDeposit : '');

        setGuestInfo({ guestName: gName, firstName: nameParts[0] || '', lastName: nameParts.slice(1).join(' ') || '', nationality: room.nationality || '', email: room.email || '', phone: room.phone || '', check_in_date: room.check_in_date || getHotelDate(0), check_out_date: room.check_out_date || '', room_type: safeRoomType, id_image: room.id_image || '', channel: 'Walk-in' });

        // 💡 [수정] deposit 부분에 autoDeposit 변수 적용
        setExtraInfo({ deposit: autoDeposit, deposit_method: room.deposit_method || 'Cash', folio_limit: room.folio_limit || '', group_id: room.group_id || '', wakeup_call: room.wakeup_call || '', has_parcel: room.has_parcel === 1 });

        setPayAmount(''); setExtensionDate(''); setIsIssuingKey(false); setIsSigned(false); setTimeout(clearSignature, 100);
        setTabletSignature('');
        setIsTabletPending(false);
    };

    const closeModal = () => {
        stopCamera();
        setSelectedRoom(null);
        setTabletSignature('');
        setIsTabletPending(false);
        waitingForSignatureRoomId.current = null;
    };

    const executeGlobalSearch = async () => {
        if (!searchQuery) return;
        const query = searchQuery.trim();
        const pending = pendingReservations.find(r => r.res_id.toLowerCase() === query.toLowerCase() || r.guest_name.toLowerCase().includes(query.toLowerCase()));
        if (pending) { setShowResModal(true); return; }

        try {
            const res = await fetch('/api/public/reservations/lookup', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ res_id: query, email: '', hotel_code: currentHotelCode })
            });
            const data = await res.json();
            if (data.success) showAlert('🔍 Reservation Found', `ID: ${data.reservation.res_id}\nGuest: ${data.reservation.guest_name}\nRoom: ${data.reservation.room_type}\nCheck-in: ${data.reservation.check_in_date}\nStatus: ${data.reservation.status}`, 'success');
            else showAlert('Error', 'No reservation found.', 'error');
        } catch (err) { showAlert('Error', 'Failed to search reservation.', 'error'); }
    };

    const handleGlobalSearchEnter = (e) => { if (e.key === 'Enter') executeGlobalSearch(); };


    const filteredPendingReservations = pendingReservations.filter((res) => {
        if (!searchQuery) return true;
        return res.res_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            res.guest_name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const displayRooms = rooms.filter((r) => {
        const matchesType = selectedRoomType === 'All' || r.room_type === selectedRoomType;
        const matchesSearch = r.id.toString().includes(searchQuery) || (r.guestName && r.guestName.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesType && matchesSearch;
    });

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter((r) => r.status === 'OCCUPIED').length;
    const reservedRooms = rooms.filter((r) => r.status === 'RESERVED').length;
    const availableRooms = rooms.filter((r) => r.status === 'VACANT').length;

    // 💡 [수정 1] HK_(하우스키핑) 및 MT_(유지보수) 상태도 카운트에 포함되도록 로직 추가!
    const dirtyRooms = rooms.filter((r) => r.status.includes('MAKE_UP') || r.status.includes('HK_')).length;
    const maintenanceRooms = rooms.filter((r) => r.status === 'MAINTENANCE' || r.status.includes('MT_')).length;

    const getRoomColor = (status) => {
        switch (status) {
            case 'VACANT': return 'bg-white border-green-400 hover:bg-green-50';
            case 'OCCUPIED': return 'bg-blue-50 border-blue-400 shadow-md';
            case 'RESERVED': return 'bg-yellow-50 border-yellow-400 shadow-md';
            case 'MAKE_UP_GUEST': return 'bg-purple-50 border-purple-500 animate-pulse';
            case 'MAKE_UP_CHECKOUT': return 'bg-orange-50 border-orange-400';
            case 'MAINTENANCE': return 'bg-slate-200 border-slate-400 opacity-80';
            // 💡 새로 추가된 HK 및 MT 작업 진행 상태 색상
            case 'HK_START': return 'bg-blue-50 border-blue-500 animate-pulse shadow-md';
            case 'HK_FINISHED': return 'bg-purple-50 border-purple-400 shadow-md';
            case 'MT_PREPARATION': return 'bg-yellow-50 border-yellow-500 shadow-md';
            case 'MT_ONGOING': return 'bg-red-50 border-red-500 animate-pulse shadow-md';
            default: return 'bg-white border-slate-200';
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 font-sans flex flex-col relative">

            {/* 💡 [추가] 아침 체크아웃 경고 모달창 */}
            {showMorningCheckoutAlert && morningCheckoutRooms.length > 0 && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-md overflow-hidden text-center transform scale-100 transition-all border border-slate-100">
                        <div className="bg-orange-500 p-8 text-white">
                            <span className="text-6xl drop-shadow-md">⏰</span>
                            <h3 className="text-2xl font-black mt-4">Check-out Reminder</h3>
                        </div>
                        <div className="p-8">
                            <p className="text-slate-500 text-sm mb-6 leading-relaxed font-bold">
                                It's morning. The following rooms are scheduled to check out today. Please prepare their folios.
                            </p>
                            <div className="flex flex-wrap justify-center gap-2 mb-8 max-h-[150px] overflow-y-auto">
                                {morningCheckoutRooms.map(r => (
                                    <span key={r.id} className="bg-orange-100 text-orange-700 px-3 py-1 rounded-md font-black text-sm border border-orange-200">Room {r.id}</span>
                                ))}
                            </div>
                            <button onClick={() => setShowMorningCheckoutAlert(false)} className="w-full py-4 rounded-md font-black text-white shadow-lg transition-all text-lg bg-slate-800 hover:bg-slate-700">
                                Acknowledge
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 💡 [추가] Folio 상세 내역(영수증) 확인 모달창 */}
            {showFolioDetailsModal && selectedRoom && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-[400px] overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="bg-slate-800 p-5 text-white flex justify-between items-center">
                            <h3 className="text-xl font-black tracking-widest flex items-center gap-2">🧾 FOLIO DETAILS</h3>
                            <button onClick={() => setShowFolioDetailsModal(false)} className="text-xl font-bold hover:text-red-400 w-8 h-8 flex items-center justify-center bg-white/10 rounded-md transition-colors">✕</button>
                        </div>

                        <div className="p-6 overflow-y-auto font-mono text-sm text-slate-700 bg-slate-50">
                            <div className="text-center mb-6 border-b-2 border-dashed border-slate-300 pb-4">
                                <h4 className="text-lg font-black mb-1 text-slate-800">ROOM {selectedRoom.id}</h4>
                                <p className="text-xs text-slate-500">{selectedRoom.guestName}</p>
                            </div>

                            <div className="min-h-[150px] mb-4">
                                {(() => {
                                    let items = [];
                                    try { items = typeof selectedRoom.cart_data === 'string' ? JSON.parse(selectedRoom.cart_data) : (selectedRoom.cart_data || []); } catch (e) { }

                                    if (!Array.isArray(items) || items.length === 0) {
                                        return <p className="text-center text-slate-400 font-bold py-10">No detailed charges found.</p>;
                                    }

                                    return items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-start mb-3 border-b border-slate-200 border-dotted pb-2">
                                            <div className="flex-1 pr-2">
                                                <div className="font-bold text-slate-800">{item.name}</div>
                                                <div className="text-[10px] text-slate-500">
                                                    {item.selectedSize !== 'Regular' ? `Size: ${item.selectedSize}` : ''}
                                                    {item.requestTime ? ` | Ordered: ${item.requestTime}` : ''}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold">x{item.quantity}</div>
                                                <div className="font-black text-blue-600">₱{(item.price * item.quantity).toLocaleString()}</div>
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>

                            <div className="border-t-2 border-slate-800 pt-4 mt-6">
                                <div className="flex justify-between items-end">
                                    <span className="font-black text-base tracking-widest uppercase">Total Charges</span>
                                    <span className="text-2xl font-black text-red-600">₱{(selectedRoom.balance || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showCheckoutModal && selectedRoom && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[110] animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-[500px] overflow-hidden">
                        <div className="bg-slate-800 p-6 text-white flex justify-between items-center">
                            <h3 className="text-2xl font-black">🧾 Final Settlement</h3>
                            <button onClick={() => setShowCheckoutModal(false)} className="text-xl font-bold hover:text-red-400">✕</button>
                        </div>
                        <div className="p-6 md:p-8 space-y-6">

                            {checkoutData.earlyNights > 0 && (
                                <div className="bg-red-50 border-2 border-red-200 p-4 rounded-md shadow-sm animate-pulse">
                                    <h4 className="text-red-700 font-black text-sm flex items-center gap-2 mb-2">⚠️ Early Check-out Detected</h4>
                                    <p className="text-xs font-bold text-red-600 mb-3">Guest is leaving {checkoutData.earlyNights} night(s) early.</p>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-500">Apply Refund Policy</label>
                                        <div className="flex gap-2">
                                            <button onClick={() => applyRefundPolicy(100)} className="flex-1 bg-white border border-red-300 text-red-600 font-bold py-1.5 rounded text-xs hover:bg-red-100">100% (Full)</button>
                                            <button onClick={() => applyRefundPolicy(50)} className="flex-1 bg-white border border-red-300 text-red-600 font-bold py-1.5 rounded text-xs hover:bg-red-100">50% (Off-peak)</button>
                                            <button onClick={() => applyRefundPolicy(0)} className="flex-1 bg-white border border-red-300 text-red-600 font-bold py-1.5 rounded text-xs hover:bg-red-100">0% (Peak/Wknd)</button>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-xs font-bold text-slate-600 w-16">Custom ₱</span>
                                            <input type="number" value={checkoutData.refundAmount} onChange={(e) => setCheckoutData({ ...checkoutData, refundAmount: e.target.value })} className="flex-1 p-2 border rounded font-bold outline-none" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-slate-50 p-5 rounded-md border border-slate-200 space-y-3">
                                <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                                    <span>Room Folio (Charges)</span>
                                    <span className="text-slate-800">₱{(selectedRoom.balance || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                                    <span>Security Deposit</span>
                                    <span className="text-green-600">- ₱{Number(extraInfo.deposit || 0).toLocaleString()}</span>
                                </div>
                                {checkoutData.refundAmount > 0 && (
                                    <div className="flex justify-between items-center text-sm font-bold text-red-500">
                                        <span>Early Checkout Refund</span>
                                        <span>- ₱{Number(checkoutData.refundAmount).toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="border-t border-slate-300 pt-3 mt-3 flex justify-between items-center">
                                    <span className="font-black text-slate-700 uppercase tracking-widest">Net Balance</span>
                                    <span className={`text-2xl font-black ${((selectedRoom.balance || 0) - Number(extraInfo.deposit || 0) - Number(checkoutData.refundAmount)) > 0 ? 'text-red-600' : ((selectedRoom.balance || 0) - Number(extraInfo.deposit || 0) - Number(checkoutData.refundAmount)) < 0 ? 'text-blue-600' : 'text-green-600'}`}>
                                        ₱{((selectedRoom.balance || 0) - Number(extraInfo.deposit || 0) - Number(checkoutData.refundAmount)).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* 💡 [신규] 추가 정산 금액 발생 시 결제 수단 */}
                            {((selectedRoom.balance || 0) - Number(extraInfo.deposit || 0) - Number(checkoutData.refundAmount)) > 0 && (
                                <div className="space-y-2 mt-4">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Collection Method</label>
                                    <select value={checkoutData.settleMethod} onChange={(e) => setCheckoutData({ ...checkoutData, settleMethod: e.target.value })} className="w-full p-3 border rounded-md font-bold bg-white outline-none">
                                        <option value="Cash">💵 Cash</option>
                                        <option value="Card">💳 Card</option>
                                    </select>
                                </div>
                            )}

                            {/* 💡 [신규] 체크아웃 시 태블릿으로 서명 보내기 및 수신 UI */}
                            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-md text-center">
                                {!tabletSignature ? (
                                    isTabletPending ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="animate-pulse font-bold text-indigo-600">Waiting for guest signature on tablet...</span>
                                            <button onClick={cancelTabletRequest} className="text-xs text-red-500 hover:underline">Cancel Request</button>
                                        </div>
                                    ) : (
                                        <button onClick={requestCheckoutSignature} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold shadow-md transition-colors flex items-center justify-center gap-2">
                                            📱 Request Signature on Tablet
                                        </button>
                                    )
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="text-green-600 font-black text-lg">✅ Signature Received!</span>
                                        <img src={tabletSignature} className="h-16 border bg-white rounded-md px-2" alt="Guest Signature" />
                                        <button onClick={() => setTabletSignature('')} className="text-xs text-slate-500 hover:underline">Redo Signature</button>
                                    </div>
                                )}
                            </div>

                            <button onClick={handleFinalCheckout} className={`w-full py-4 rounded-md font-black text-lg text-white shadow-lg transition-all ${((selectedRoom.balance || 0) - Number(extraInfo.deposit || 0) - Number(checkoutData.refundAmount)) > 0 ? 'bg-red-600 hover:bg-red-700' : ((selectedRoom.balance || 0) - Number(extraInfo.deposit || 0) - Number(checkoutData.refundAmount)) < 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                                {((selectedRoom.balance || 0) - Number(extraInfo.deposit || 0) - Number(checkoutData.refundAmount)) > 0
                                    ? 'Receive Payment & Check-out'
                                    : ((selectedRoom.balance || 0) - Number(extraInfo.deposit || 0) - Number(checkoutData.refundAmount)) < 0
                                        ? 'Refund Guest & Check-out'
                                        : 'Complete Check-out'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {extendPaymentData.show && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-[400px] overflow-hidden text-center transform transition-all scale-100 border-t-8 border-blue-600">
                        <div className="p-8">
                            <div className="text-6xl mb-4">💳</div>
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Extension Payment</h3>
                            <p className="text-slate-500 font-bold mb-6">Room {selectedRoom?.id} • +{extendPaymentData.extraNights} Night(s)</p>

                            <div className="bg-blue-50 p-6 rounded-md border border-blue-100 mb-4">
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Total Due</p>
                                <p className="text-4xl font-black text-blue-700">₱{extendPaymentData.amount.toLocaleString()}</p>
                            </div>

                            {/* 💡 [신규] 연장 시 결제 수단 */}
                            <select value={extendMethod} onChange={(e) => setExtendMethod(e.target.value)} className="w-full mb-8 p-3 border border-blue-200 rounded-md font-bold bg-white outline-none">
                                <option value="Cash">💵 Pay by Cash</option>
                                <option value="Card">💳 Pay by Card</option>
                            </select>

                            <div className="flex gap-3">

                                <button onClick={() => setExtendPaymentData({ show: false, extraNights: 0, amount: 0, newDate: '' })} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-4 rounded-md font-bold transition-colors">Cancel</button>
                                <button onClick={handleConfirmExtendPayment} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-md font-black shadow-lg transition-colors text-lg">Confirm & Pay</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="absolute top-24 right-4 md:right-10 left-4 md:left-auto z-[100] flex flex-col gap-3 md:w-96 pointer-events-none">
                {activeWakeupCalls.map((call) => (
                    <div key={`wakeup-${call.id}`} className="bg-yellow-400 border-l-8 border-yellow-600 p-4 rounded-md shadow-2xl animate-bounce pointer-events-auto flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="text-3xl">⏰</div>
                            <div>
                                <h4 className="font-black text-slate-900 text-lg">Wake-up Call!</h4>
                                <p className="text-slate-800 font-bold text-sm">Room {call.id} • {call.time}</p>
                                <p className="text-slate-700 text-xs">Guest: {call.guest}</p>
                            </div>
                        </div>
                        <button onClick={() => handleDismissWakeup(call.id)} className="bg-slate-900 text-white px-3 py-2 rounded-md text-xs font-bold hover:bg-slate-700 transition-colors">Dismiss</button>
                    </div>
                ))}
            </div>

            {showCrmModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white p-6 md:p-8 rounded-md w-full max-w-[600px] shadow-2xl">
                        <h3 className="font-black text-xl md:text-2xl mb-6 text-slate-800 flex items-center gap-2">🔍 CRM Guest Database</h3>
                        <div className="flex flex-col sm:flex-row gap-3 mb-6 relative">
                            <span className="absolute left-4 top-4 text-xl opacity-50">🔍</span>
                            <input
                                type="text"
                                placeholder="Type Name or Phone Number... (Auto-search)"
                                value={crmQuery}
                                onChange={(e) => setCrmQuery(e.target.value)}
                                className="border-2 border-slate-200 p-4 pl-12 rounded-md flex-1 font-bold text-lg focus:border-blue-500 outline-none bg-slate-50 focus:bg-white transition-colors"
                            />
                        </div>
                        <div className="max-h-72 overflow-y-auto space-y-3">
                            {crmResults.length === 0 && <p className="text-center text-slate-400 font-bold py-6">No matching records found.</p>}
                            {crmResults.map((g) => (
                                <div key={g.id} onClick={() => selectCrmGuest(g)} className="p-4 border-2 border-slate-100 rounded-md hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors group">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-black text-lg text-slate-800 group-hover:text-blue-700">{g.name}</div>
                                        <div className="flex gap-2">
                                            {g.is_vip === 1 && <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-bold shadow-sm">⭐ VIP</span>}
                                            {g.is_blacklist === 1 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold shadow-sm">🚫 Blacklist</span>}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500 font-bold">{g.phone} | {g.email}</div>
                                    <div className="text-xs text-blue-600 font-bold mt-2 bg-blue-100/50 p-2 rounded">Total Visits: {g.visit_count} time(s) {g.preferences && `| Pref: ${g.preferences}`}</div>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setShowCrmModal(false)} className="mt-6 w-full bg-slate-200 text-slate-600 py-4 rounded-md font-bold hover:bg-slate-300">Close</button>
                    </div>
                </div>
            )}

            {showHandoverModal && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[90] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white p-6 md:p-10 rounded-md w-full max-w-[650px] shadow-2xl border-t-8 border-emerald-500 overflow-y-auto max-h-[90vh]">
                        <h3 className="font-black text-2xl md:text-3xl mb-2 text-slate-800">💰 Shift Handover</h3>
                        <p className="text-slate-500 font-bold mb-8 text-sm">Verify cash drop and authenticate next shift.</p>

                        <div className="space-y-6">
                            {/* 💡 [수정됨] 캔버스(서명) 대신 ID/비밀번호 검증 박스로 변경 */}
                            <div className="flex flex-col sm:flex-row gap-4 bg-slate-50 p-5 rounded-md border border-slate-200">
                                <div className="flex-1 space-y-3">
                                    <h4 className="font-black text-slate-700 border-b border-slate-200 pb-2">📤 Handing Over</h4>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Current ID</label>
                                        <input type="text" value={currentUserId} disabled className="w-full p-2.5 border border-slate-200 rounded-md bg-slate-100 font-bold text-slate-500" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block mb-1">Your Password *</label>
                                        <input type="password" value={handoverData.handover_pwd || ''} onChange={(e) => setHandoverData({ ...handoverData, handover_pwd: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md font-bold focus:border-blue-500 outline-none bg-white" placeholder="••••••••" />
                                    </div>
                                </div>

                                <div className="hidden sm:block w-px bg-slate-200"></div>

                                <div className="flex-1 space-y-3">
                                    <h4 className="font-black text-emerald-700 border-b border-emerald-100 pb-2">📥 Receiving (Next Shift)</h4>
                                    <div>
                                        <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-1">Receiver ID *</label>
                                        <input type="text" value={handoverData.receiver_id} onChange={(e) => setHandoverData({ ...handoverData, receiver_id: e.target.value.toUpperCase() })} placeholder="e.g. FD002" className="w-full p-2.5 border border-slate-300 rounded-md font-bold uppercase focus:border-emerald-500 outline-none bg-white" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-1">Receiver Password *</label>
                                        <input type="password" value={handoverData.receiver_pwd || ''} onChange={(e) => setHandoverData({ ...handoverData, receiver_pwd: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md font-bold focus:border-emerald-500 outline-none bg-white" placeholder="••••••••" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-2 uppercase tracking-widest">Total Cash in Drawer (₱) *</label>
                                <input type="number" value={handoverData.total_cash} onChange={(e) => setHandoverData({ ...handoverData, total_cash: e.target.value })} className="w-full p-4 border-2 border-slate-200 rounded-md font-black text-2xl text-emerald-700 focus:border-emerald-500 outline-none bg-slate-50" placeholder="0.00" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-2 uppercase tracking-widest">Pass-down Notes / Remarks</label>
                                <textarea rows="2" value={handoverData.notes} onChange={(e) => setHandoverData({ ...handoverData, notes: e.target.value })} className="w-full p-4 border-2 border-slate-200 rounded-md font-bold text-slate-700 focus:border-emerald-500 outline-none" placeholder="E.g., Room 201 requested extra towels..."></textarea>
                            </div>
                        </div>
                        <div className="flex gap-4 mt-8">
                            <button onClick={() => setHandoverData({ total_cash: '', notes: '', receiver_id: '', handover_pwd: '', receiver_pwd: '' }) || setShowHandoverModal(false)} className="flex-1 bg-slate-200 text-slate-700 py-3 md:py-4 rounded-md font-bold hover:bg-slate-300">Cancel</button>
                            <button onClick={handleHandoverSubmit} className="flex-[2] bg-emerald-600 text-white py-3 md:py-4 rounded-md font-black hover:bg-emerald-700 shadow-lg text-lg">Verify & Handover</button>
                        </div>
                    </div>
                </div>
            )}

            {showLedgerModal && (
                <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center backdrop-blur-sm animate-fade-in p-4 md:p-6">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl h-[90vh] md:h-[85vh] flex flex-col overflow-hidden border border-slate-200">
                        <div className="p-4 md:p-6 border-b bg-slate-50 flex justify-between items-center">
                            <h2 className="text-xl md:text-2xl font-black text-emerald-800 flex items-center gap-2"><span>💵</span> Front Desk Cash Ledger</h2>
                            <button onClick={() => setShowLedgerModal(false)} className="bg-white border text-slate-500 hover:text-red-500 w-8 h-8 md:w-10 md:h-10 rounded-md font-bold shadow-sm">✕</button>
                        </div>

                        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                            <div className="w-full md:w-1/3 p-4 md:p-6 border-b md:border-b-0 md:border-r bg-white overflow-y-auto shrink-0 md:shrink">
                                <h3 className="text-lg font-bold mb-4 border-b pb-2 text-slate-700">New Entry</h3>
                                <div className="space-y-4">
                                    <div className="flex bg-slate-100 p-1 rounded-md">
                                        <button onClick={() => setLedgerTx({ ...ledgerTx, type: 'IN' })} className={`flex-1 py-2 rounded-md font-bold text-sm ${ledgerTx.type === 'IN' ? 'bg-emerald-500 text-white shadow' : 'text-slate-500'}`}>Income (IN)</button>
                                        <button onClick={() => setLedgerTx({ ...ledgerTx, type: 'OUT' })} className={`flex-1 py-2 rounded-md font-bold text-sm ${ledgerTx.type === 'OUT' ? 'bg-red-500 text-white shadow' : 'text-slate-500'}`}>Expense (OUT)</button>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 block mb-1">Category</label>
                                        <div className="flex gap-2">
                                            <select value={ledgerTx.category} onChange={(e) => setLedgerTx({ ...ledgerTx, category: e.target.value })} className="flex-1 p-3 border rounded-md bg-slate-50 text-sm font-bold">
                                                {ledgerCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <button onClick={() => setIsAddingLedgerCat(!isAddingLedgerCat)} className="bg-slate-200 px-3 rounded-md font-bold hover:bg-slate-300">+</button>
                                        </div>
                                        {isAddingLedgerCat && (
                                            <div className="flex gap-2 mt-2">
                                                <input value={newLedgerCat} onChange={(e) => setNewLedgerCat(e.target.value)} placeholder="New Cat" className="flex-1 p-2 border rounded-md text-sm" />
                                                <button onClick={handleAddLedgerCat} className="bg-blue-600 text-white px-3 rounded-md font-bold text-sm">Add</button>
                                            </div>
                                        )}
                                    </div>
                                    <div><label className="text-xs font-bold text-slate-500 block mb-1">Amount (₱)</label><input type="number" value={ledgerTx.amount} onChange={(e) => setLedgerTx({ ...ledgerTx, amount: e.target.value })} className="w-full p-3 border rounded-md font-black text-lg bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0.00" /></div>
                                    <div><label className="text-xs font-bold text-slate-500 block mb-1">Description / Remarks</label><input type="text" value={ledgerTx.description} onChange={(e) => setLedgerTx({ ...ledgerTx, description: e.target.value })} className="w-full p-3 border rounded-md bg-slate-50 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Details..." /></div>
                                    <button onClick={handleLedgerSubmit} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-md font-bold shadow-md transition-colors mt-2">💾 Save Record</button>
                                </div>
                            </div>

                            <div className="flex-1 p-4 md:p-6 flex flex-col bg-slate-50 overflow-hidden">
                                <div className="flex flex-wrap md:flex-nowrap gap-3 mb-4 bg-white p-3 rounded-md shadow-sm border border-slate-200 items-end">
                                    <div className="w-full sm:w-auto flex-1"><label className="text-[10px] font-bold text-slate-500 block">Start Date</label><input type="date" value={ledgerFilter.startDate} onChange={(e) => setLedgerFilter({ ...ledgerFilter, startDate: e.target.value })} className="p-2 border rounded-md text-sm font-bold w-full" /></div>
                                    <div className="w-full sm:w-auto flex-1"><label className="text-[10px] font-bold text-slate-500 block">End Date</label><input type="date" value={ledgerFilter.endDate} onChange={(e) => setLedgerFilter({ ...ledgerFilter, endDate: e.target.value })} className="p-2 border rounded-md text-sm font-bold w-full" /></div>
                                    <div className="w-[45%] sm:w-auto"><label className="text-[10px] font-bold text-slate-500 block">Type</label><select value={ledgerFilter.type} onChange={(e) => setLedgerFilter({ ...ledgerFilter, type: e.target.value })} className="p-2 border rounded-md text-sm font-bold w-full"><option value="ALL">All</option><option value="IN">Income</option><option value="OUT">Expense</option></select></div>
                                    <div className="w-[45%] sm:w-auto flex-1"><label className="text-[10px] font-bold text-slate-500 block">Category</label><select value={ledgerFilter.category} onChange={(e) => setLedgerFilter({ ...ledgerFilter, category: e.target.value })} className="p-2 border rounded-md text-sm font-bold w-full"><option value="ALL">All Categories</option>{ledgerCategories.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                                    <button onClick={() => setLedgerFilter({ startDate: '', endDate: '', type: 'ALL', category: 'ALL' })} className="px-3 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 rounded-md w-full sm:w-auto mt-2 sm:mt-0">Clear</button>
                                </div>

                                <div className="flex-1 overflow-auto border rounded-md shadow-inner bg-white">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-slate-100 border-b sticky top-0 z-10">
                                            <tr><th className="p-3 text-slate-500 font-bold uppercase tracking-widest text-[10px]">Date</th><th className="p-3 text-slate-500 font-bold uppercase tracking-widest text-[10px]">Type</th><th className="p-3 text-slate-500 font-bold uppercase tracking-widest text-[10px]">Category</th><th className="p-3 text-slate-500 font-bold uppercase tracking-widest text-[10px]">Description</th><th className="p-3 text-slate-500 font-bold uppercase tracking-widest text-[10px]">User</th><th className="p-3 text-right text-slate-500 font-bold uppercase tracking-widest text-[10px]">Amount</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {ledgerList.filter((t) => {
                                                if (ledgerFilter.type !== 'ALL' && t.type !== ledgerFilter.type) return false;
                                                if (ledgerFilter.category !== 'ALL' && t.category !== ledgerFilter.category) return false;
                                                if (ledgerFilter.startDate && t.date < ledgerFilter.startDate) return false;
                                                if (ledgerFilter.endDate && t.date > ledgerFilter.endDate) return false;
                                                return true;
                                            }).map((t) => (
                                                <tr key={t.id} className="hover:bg-slate-50">
                                                    <td className="p-3 font-mono text-slate-500 text-xs">{t.date}</td>
                                                    <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{t.type}</span></td>
                                                    <td className="p-3 font-bold text-slate-700">{t.category}</td>
                                                    <td className="p-3 text-slate-600 truncate max-w-[150px]">{t.description}</td>
                                                    <td className="p-3 text-xs font-bold text-blue-500">{t.user_id}</td>
                                                    <td className={`p-3 text-right font-black ${t.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>{t.type === 'IN' ? '+' : '-'}₱{t.amount.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showNewResModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-[600px] overflow-hidden">
                        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
                            <h2 className="text-xl md:text-2xl font-black flex items-center gap-3">➕ Create New Reservation</h2>
                            <button onClick={() => setShowNewResModal(false)} className="text-xl hover:text-red-300 font-bold bg-white/20 w-8 h-8 rounded-md">✕</button>
                        </div>
                        <div className="p-6 md:p-8 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Booking Channel</label>
                                    <select value={newResData.channel} onChange={(e) => setNewResData({ ...newResData, channel: e.target.value })} className="w-full p-3 border border-slate-300 rounded-md font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500">
                                        <option value="Walk-in">Walk-in</option>
                                        <option value="n+ Rewards (App)">n+ Rewards (App)</option>
                                        <option value="Portal">Portal (HQ Web)</option>
                                        <option value="Hotel Web">Hotel Web (Custom Domain)</option>
                                        <option value="Agoda">Agoda</option>
                                        <option value="Booking.com">Booking.com</option>
                                        <option value="Hotels.com">Hotels.com</option>
                                        <option value="Trip.com">Trip.com</option>
                                        <option value="Expedia">Expedia</option>
                                        <option value="Facebook">Facebook</option>
                                        <option value="Instagram">Instagram</option>
                                        <option value="Phone Call">Phone Call</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Room Type</label>
                                    <select value={newResData.room_type} onChange={(e) => setNewResData({ ...newResData, room_type: e.target.value })} className="w-full p-3 border border-slate-300 rounded-md font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500">
                                        {roomTypes.map((rt) => <option key={rt.id} value={rt.name}>{rt.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Guest Name (First / Last)</label>
                                <div className="flex gap-2">
                                    <input type="text" value={newResData.first_name || ''} onChange={(e) => setNewResData({ ...newResData, first_name: e.target.value, guest_name: `${e.target.value} ${newResData.last_name || ''}`.trim() })} className="w-1/2 p-3 border border-slate-300 rounded-md font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500" placeholder="First Name" />
                                    <input type="text" value={newResData.last_name || ''} onChange={(e) => setNewResData({ ...newResData, last_name: e.target.value, guest_name: `${newResData.first_name || ''} ${e.target.value}`.trim() })} className="w-1/2 p-3 border border-slate-300 rounded-md font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500" placeholder="Last (Surname)" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500 block mb-1">Phone Number</label><input type="text" value={newResData.phone} onChange={(e) => setNewResData({ ...newResData, phone: e.target.value })} className="w-full p-3 border border-slate-300 rounded-md font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500" placeholder="010-..." /></div>
                                <div><label className="text-xs font-bold text-slate-500 block mb-1">Email</label><input type="email" value={newResData.email} onChange={(e) => setNewResData({ ...newResData, email: e.target.value })} className="w-full p-3 border border-slate-300 rounded-md font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500" placeholder="email@address.com" /></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500 block mb-1">Check-in Date</label><input type="date" value={newResData.check_in_date} onChange={(e) => setNewResData({ ...newResData, check_in_date: e.target.value })} className="w-full p-3 border border-slate-300 rounded-md font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500" /></div>
                                <div><label className="text-xs font-bold text-slate-500 block mb-1">Check-out Date</label><input type="date" value={newResData.check_out_date} onChange={(e) => setNewResData({ ...newResData, check_out_date: e.target.value })} className="w-full p-3 border border-slate-300 rounded-md font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500" /></div>
                            </div>
                            <button onClick={handleCreateReservation} className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-md font-bold text-lg shadow-md transition-colors">💾 Save Reservation</button>
                        </div>
                    </div>
                </div>
            )}

            {showCleaningModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[75] animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-[600px] overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="bg-orange-500 p-6 text-white flex justify-between items-center shrink-0">
                            <h2 className="text-xl md:text-2xl font-black flex items-center gap-3">🧹 Rooms to Clean</h2>
                            <button onClick={() => setShowCleaningModal(false)} className="text-xl hover:text-orange-200 font-bold bg-white/20 w-8 h-8 rounded-md">✕</button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
                            {rooms.filter((r) => r.status.includes('MAKE_UP')).length === 0 ? (
                                <div className="text-center text-slate-500 py-10 font-bold text-lg">No rooms currently need cleaning.</div>
                            ) : (
                                <div className="space-y-3">
                                    {rooms.filter((r) => r.status.includes('MAKE_UP')).map((room) => (
                                        <div key={room.id} className="bg-white border-2 border-orange-200 rounded-md p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-md flex items-center justify-center font-black text-2xl">{room.id}</div>
                                                <div>
                                                    <div className="font-black text-lg text-slate-800">{room.room_type}</div>
                                                    <div className="text-xs font-bold text-orange-500">{room.status.replace(/_/g, ' ')}</div>
                                                </div>
                                            </div>
                                            <button onClick={async () => {
                                                await fetch('/api/rooms/update', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ id: room.id, status: 'VACANT', room_type: room.room_type, increment_usage: false, maintenance_remarks: '' })
                                                });
                                            }} className="w-full sm:w-auto bg-green-500 hover:bg-green-400 text-white px-5 py-3 rounded-md font-bold shadow-md transition-colors text-sm">
                                                ✨ Mark Clean
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showMaintenanceModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[75] animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-[600px] overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="bg-slate-700 p-6 text-white flex justify-between items-center shrink-0">
                            <h2 className="text-xl md:text-2xl font-black flex items-center gap-3">🛠️ Rooms Under Maintenance</h2>
                            <button onClick={() => setShowMaintenanceModal(false)} className="text-xl hover:text-slate-300 font-bold bg-white/20 w-8 h-8 rounded-md">✕</button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
                            {rooms.filter((r) => r.status === 'MAINTENANCE').length === 0 ? (
                                <div className="text-center text-slate-500 py-10 font-bold text-lg">No rooms under maintenance.</div>
                            ) : (
                                <div className="space-y-4">
                                    {rooms.filter((r) => r.status === 'MAINTENANCE').map((room) => (
                                        <div key={room.id} className="bg-white border-2 border-slate-300 rounded-md p-5 flex flex-col gap-4 shadow-sm">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-14 h-14 bg-slate-200 text-slate-700 rounded-md flex items-center justify-center font-black text-2xl">{room.id}</div>
                                                    <div>
                                                        <div className="font-black text-lg text-slate-800">{room.room_type}</div>
                                                        <div className="text-xs font-bold text-slate-500">Under Maintenance</div>
                                                    </div>
                                                </div>
                                                <button onClick={async () => {
                                                    await fetch('/api/rooms/update', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ id: room.id, status: 'VACANT', room_type: room.room_type, increment_usage: false, maintenance_remarks: '' })
                                                    });
                                                }} className="w-full sm:w-auto bg-green-500 hover:bg-green-400 text-white px-5 py-3 rounded-md font-bold shadow-md transition-colors text-sm">
                                                    ✅ Resolved
                                                </button>
                                            </div>
                                            {/* 💡 [수정] 객실 카드 내 노란색 메모장 크기 대폭 확대 (가로 100% 꽉 채우기) */}
                                            {/* 💡 [수정] 스크롤바(overflow)와 높이 제한(max-h)을 완전히 없애고, 글자 수에 맞춰 카드가 아래로 무한정 늘어나게 강제 설정했습니다! */}
                                            {room.maintenance_remarks && (
                                                <div className="mt-4 w-full block bg-yellow-100 p-4 rounded-md text-slate-800 font-bold text-sm whitespace-pre-wrap border-2 border-yellow-400 shadow-md h-auto min-h-[60px]">
                                                    {room.maintenance_remarks}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showSmartSearch && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-[800px] overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="bg-teal-600 p-6 text-white flex justify-between items-center shrink-0">
                            <h2 className="text-xl md:text-2xl font-black flex items-center gap-3">🧠 Smart Availability Search</h2>
                            <button onClick={() => { setShowSmartSearch(false); setSmartSearchResults(null); }} className="text-xl hover:text-teal-200 font-bold bg-white/10 w-8 h-8 rounded-md">✕</button>
                        </div>

                        <div className="p-4 md:p-8 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-end shadow-inner">
                            <div className="w-full sm:flex-1">
                                <label className="text-xs font-bold text-slate-500 block mb-1">Room Type</label>
                                <select value={smartSearchParams.room_type} onChange={(e) => setSmartSearchParams({ ...smartSearchParams, room_type: e.target.value })} className="w-full p-3 border border-slate-300 rounded-md font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500">
                                    <option value="All">Any Type</option>
                                    {roomTypes.map((rt) => <option key={rt.id} value={rt.name}>{rt.name}</option>)}
                                </select>
                            </div>
                            <div className="w-full sm:flex-1">
                                <label className="text-xs font-bold text-slate-500 block mb-1">Check-in</label>
                                <input type="date" value={smartSearchParams.check_in} onChange={(e) => setSmartSearchParams({ ...smartSearchParams, check_in: e.target.value })} className="w-full p-3 border border-slate-300 rounded-md font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                            </div>
                            <div className="w-full sm:flex-1">
                                <label className="text-xs font-bold text-slate-500 block mb-1">Check-out</label>
                                <input type="date" value={smartSearchParams.check_out} onChange={(e) => setSmartSearchParams({ ...smartSearchParams, check_out: e.target.value })} className="w-full p-3 border border-slate-300 rounded-md font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                            </div>
                        </div>

                        <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-white">
                            {!smartSearchResults ? (
                                <div className="text-center text-slate-400 py-10 font-bold text-lg">Enter dates to find optimized room assignments.</div>
                            ) : smartSearchResults.length === 0 ? (
                                <div className="text-center text-red-500 py-10 font-bold text-lg">No available rooms found for the selected criteria.</div>
                            ) : (() => {

                                // 💡 [핵심 수정 3] 백엔드가 빈 방만 보내주더라도, 프론트엔드의 전체 객실 목록(rooms)에서 
                                // 청소 중(HK/MAKE_UP)이거나 유지보수 중(MT/MAINTENANCE)인 방들을 강제로 찾아서 합쳐줍니다!
                                let combinedResults = [...smartSearchResults];
                                const offlineRooms = rooms.filter(r => r.status.includes('MT_') || r.status === 'MAINTENANCE' || r.status.includes('HK_') || r.status.includes('MAKE_UP'));

                                offlineRooms.forEach(offRoom => {
                                    // 아직 목록에 없다면 강제로 끼워넣기
                                    if (!combinedResults.find(r => r.id === offRoom.id)) {
                                        combinedResults.push(offRoom);
                                    }
                                });

                                const liveResults = combinedResults.map(resRoom => rooms.find(r => r.id === resRoom.id) || resRoom);

                                // 💡 [핵심 추가] 객실 사용량(usage_count)이 가장 적은 방부터 위로 올라오도록 '오름차순 정렬'을 강력하게 걸어줍니다!
                                liveResults.sort((a, b) => (a.usage_count || a.usageCount || 0) - (b.usage_count || b.usageCount || 0));

                                // 1️⃣ 즉시 투숙 가능 (완전 빈 방 + 청소 중인 방 전체)
                                const tier1 = liveResults.filter(r => r.status === 'VACANT' || r.status.includes('MAKE_UP') || r.status.includes('HK_'));
                                // 2️⃣ 오늘 퇴실 예정 (체크아웃 날짜가 체크인 날짜와 같거나 이전인 현재 투숙/예약 객실)
                                const tier2 = liveResults.filter(r => (r.status === 'OCCUPIED' || r.status === 'RESERVED') && r.check_out_date <= smartSearchParams.check_in);
                                // 3️⃣ 유지보수 중 (현장 확인 후 프론트 재량 오픈 가능 - 이제 503호가 완벽하게 잡힙니다!)
                                const tier3 = liveResults.filter(r => r.status === 'MAINTENANCE' || r.status.includes('MT_'));

                                // 💡 객실 카드 렌더링을 돕는 내부 컴포넌트 함수
                                const renderRoomRow = (room, badgeText, badgeColorClass) => (
                                    <div key={room.id} className="border-2 border-slate-200 rounded-md p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white hover:border-teal-400 hover:bg-teal-50 transition-colors group gap-4 shadow-sm">
                                        <div className="flex items-center gap-4 md:gap-6">
                                            <div className="text-3xl md:text-4xl font-black text-slate-800 w-16 md:w-20 text-center">{room.id}</div>
                                            <div>
                                                <div className="font-bold text-lg md:text-xl text-blue-700 mb-1">{room.room_type || room.type}</div>
                                                <div className="text-[10px] md:text-xs font-bold text-slate-500 flex flex-wrap items-center gap-2 md:gap-3">
                                                    <span>Status: <span className={room.status === 'VACANT' ? 'text-green-600' : 'text-slate-700'}>{room.status.replace(/_/g, ' ')}</span></span>
                                                    <span className="text-slate-300 hidden sm:inline">|</span>
                                                    <span>Past Usage: <span className="text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded">{room.usage_count || room.usageCount || 0} times</span></span>
                                                    <span className={`ml-0 sm:ml-2 text-white px-2 py-1 rounded-md text-[9px] uppercase shadow-sm mt-1 sm:mt-0 ${badgeColorClass}`}>{badgeText}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => selectSmartRoom(room)} className="w-full sm:w-auto bg-teal-100 text-teal-800 border border-teal-300 hover:bg-teal-600 hover:text-white px-8 py-3 rounded-md font-bold transition-all shadow-sm">
                                            Assign Room
                                        </button>
                                    </div>
                                );

                                const tabsConfig = [
                                    { id: 'instant', label: '1. Instant Available', icon: '✨', rooms: tier1, color: 'emerald', badgeText: "⭐ Best Choice" },
                                    { id: 'dueOut', label: '2. Due Out Today', icon: '⏰', rooms: tier2, color: 'blue', badgeText: "⏳ Wait for Clean" },
                                    { id: 'mt', label: '3. Under Maintenance', icon: '🛠️', rooms: tier3, color: 'slate', badgeText: "⚠️ Check First" }
                                ];
                                const activeTab = tabsConfig.find(t => t.id === activeSmartSearchTab) || tabsConfig[0];

                                return (
                                    <div className="space-y-6">
                                        <div className="flex border-b-2 border-slate-200 gap-1 md:gap-2 pt-2 bg-slate-100 rounded-t-xl px-2 shadow-inner overflow-x-auto scrollbar-hide">
                                            {tabsConfig.map(tab => (
                                                <button key={tab.id} onClick={() => setActiveSmartSearchTab(tab.id)}
                                                    className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2.5 md:py-3 font-bold rounded-t-xl border-t-4 transition-all relative flex-shrink-0 text-xs md:text-sm ${activeSmartSearchTab === tab.id ? `bg-white border-${tab.color}-500 text-${tab.color}-800 shadow-[-2px_-4px_10px_rgba(0,0,0,0.05)] -mb-0.5 z-10` : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                                                    <span className="text-lg">{tab.icon}</span>
                                                    <span className="whitespace-nowrap">{tab.label}</span>
                                                    <span className="flex items-center justify-center bg-red-600 text-white font-black text-[10px] md:text-[11px] font-mono rounded-md w-5 h-5 md:w-6 md:h-6 shadow-md border-2 border-white ml-2">
                                                        {tab.rooms.length}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>

                                        <div className="space-y-4">
                                            {activeTab.rooms.length === 0 ? (
                                                <div className={`text-center text-${activeTab.color}-500 py-12 font-bold text-lg bg-${activeTab.color}-50/50 rounded-md border-2 border-${activeTab.color}-100 border-dashed`}>
                                                    <div className="text-5xl mb-3">{activeTab.icon}</div>
                                                    No rooms currently in this category.
                                                </div>
                                            ) : (
                                                activeTab.rooms.map(room => renderRoomRow(room, activeTab.badgeText, `bg-${activeTab.color}-500`))
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* 🔐 매니저 승인 (Manager Override) 모달창 */}
            {managerOverride.show && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[300] animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-sm overflow-hidden text-center border-t-8 border-red-500">
                        <div className="p-6 bg-slate-50 border-b border-slate-200">
                            <h3 className="text-xl font-black text-slate-800 mb-1">Manager Override</h3>
                            <p className="text-xs font-bold text-slate-500">Authorization required to cancel</p>
                        </div>
                        <div className="p-6 space-y-4 text-left">
                            <p className="text-sm font-bold text-red-600 bg-red-50 p-3 rounded-md border border-red-100 mb-2">
                                Cancelling: <span className="font-black">{managerOverride.guestName}</span>
                            </p>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Manager ID</label>
                                <input type="text" value={managerOverride.empId} onChange={(e) => setManagerOverride({ ...managerOverride, empId: e.target.value })} className="w-full p-3 border rounded-md font-bold mt-1 outline-none focus:border-red-400 bg-slate-50 focus:bg-white" placeholder="Enter ID..." />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                                <input type="password" value={managerOverride.password} onChange={(e) => setManagerOverride({ ...managerOverride, password: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && executeCancelReservation()} className="w-full p-3 border rounded-md font-bold mt-1 outline-none focus:border-red-400 bg-slate-50 focus:bg-white" placeholder="••••••••" />
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 flex gap-3 border-t border-slate-100">
                            <button onClick={() => setManagerOverride({ show: false, resId: '', guestName: '', empId: '', password: '' })} className="flex-1 py-3 rounded-md font-bold text-slate-600 bg-slate-200 hover:bg-slate-300">Abort</button>
                            <button onClick={executeCancelReservation} className="flex-[2] py-3 rounded-md font-black text-white bg-red-600 hover:bg-red-700 shadow-md">Verify & Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {showResModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-[800px] overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center shrink-0">
                            <h2 className="text-xl md:text-2xl font-black flex items-center gap-3">📥 Live OTA Reservations</h2>
                            <button onClick={() => setShowResModal(false)} className="text-xl hover:text-red-400 font-bold bg-white/10 w-8 h-8 rounded-md">✕</button>
                        </div>
                        <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-slate-50">
                            {filteredPendingReservations.length === 0 ? (
                                <div className="text-center text-slate-500 py-20 font-bold text-xl">No pending reservations found.</div>
                            ) : (() => {
                                const today = getHotelDate(0);
                                // 💡 전체 예약 중 체크인 완료된 건 제외
                                const activeRes = filteredPendingReservations.filter(res => res.status !== 'CHECKED_IN');

                                // 💡 오늘 입실해야 할 예약 vs 내일 이후 입실할 미래 예약 분리
                                const todayRes = activeRes.filter(res => res.check_in_date <= today);
                                const futureRes = activeRes.filter(res => res.check_in_date > today);

                                    const renderResCard = (res, isFuture) => (
                                        // 💡 [수정 1] 카드 전체를 흐리게 만들던 'opacity-80' 속성을 제거했습니다.
                                        <div key={res.res_id} onClick={() => handleDirectOTAConfirm(res)} className={`relative border-2 rounded-md p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center transition-colors cursor-pointer group shadow-sm gap-4 mb-3 ${isFuture ? 'bg-white border-slate-200 hover:bg-slate-100 hover:border-slate-300' : 'bg-white border-blue-200 hover:bg-yellow-50 hover:border-yellow-400'}`}>

                                            {/* X 취소 버튼 */}
                                            <button onClick={(e) => {
                                                e.stopPropagation();
                                                setManagerOverride({ show: true, resId: res.res_id, guestName: res.guest_name, empId: '', password: '' });
                                            }} className="absolute top-2 right-2 bg-slate-100 hover:bg-red-500 text-slate-400 hover:text-white w-7 h-7 rounded-md text-xs font-bold flex items-center justify-center transition-all z-10" title="Cancel Reservation">✕</button>

                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-md flex items-center justify-center font-black text-white text-lg md:text-xl shadow-inner ${res.channel === 'Agoda' ? 'bg-red-500' : res.channel === 'Booking.com' ? 'bg-blue-800' : res.channel === 'Expedia' ? 'bg-yellow-500' : 'bg-slate-700'}`}>
                                                    {res.channel.charAt(0)}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-lg md:text-xl text-slate-800 mb-1 group-hover:text-blue-700 transition-colors pr-6">{res.guest_name}</h4>
                                                    <p className="text-xs md:text-sm text-slate-500 font-bold bg-slate-200 inline-block px-2 py-0.5 rounded">{res.channel}</p>
                                                    <span className="text-xs md:text-sm font-bold text-slate-400 ml-2">ID: {res.res_id}</span>

                                                    {/* 날짜 표시 */}
                                                    <div className="text-xs md:text-sm font-bold text-slate-500 mt-2 flex gap-2 items-center">
                                                        <span className="bg-slate-100 px-2 py-1 rounded-md border border-slate-200">📥 In: {res.check_in_date}</span>
                                                        <span className="bg-slate-100 px-2 py-1 rounded-md border border-slate-200">📤 Out: {res.check_out_date}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 💡 [수정 2] 버튼 구역을 흐리게 만들던 'opacity-50' 속성을 완전히 제거했습니다. */}
                                            <div className="mt-2 flex items-center gap-2">
                                                {!isFuture && (
                                                    <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        setLinkedResId(res.res_id);
                                                        setShowResModal(false);
                                                        showAlert("Manual Assignment", `Reservation [${res.guest_name}] selected.\n\nPlease click any VACANT room on the main dashboard to assign it manually.`, "success");
                                                    }} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-md text-xs font-black transition-colors z-10 shadow-sm border border-slate-300">
                                                        Manual Assign
                                                    </button>
                                                )}
                                                <button onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isFuture) {
                                                        // 미래 예약이면 상세 모달 띄우기
                                                        setSelectedResDetail(res);
                                                    } else {
                                                        // 오늘 예약이면 자동 배정 실행
                                                        handleDirectOTAConfirm(res);
                                                    }
                                                }} className={`px-3 py-1.5 rounded-md text-xs font-black shadow-sm transition-colors ${isFuture ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                                                    {isFuture ? '🔍 View Details' : 'Auto Assign ➔'}
                                                </button>
                                            </div>
                                        </div>
                                    );

                                return (
                                    <div className="space-y-6">
                                        {/* 💡 [명단 1] 오늘 입실 예정 목록 */}
                                        <div>
                                            <h3 className="font-black text-slate-800 text-lg mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
                                                <span>📅 Today's Arrivals</span>
                                                <span className="bg-blue-600 text-white px-2 py-0.5 rounded-md text-xs">{todayRes.length}</span>
                                            </h3>
                                            {todayRes.length === 0 ? (
                                                <div className="text-center bg-white border border-slate-200 rounded-md p-6 text-slate-400 font-bold text-sm">No arrivals for today.</div>
                                            ) : (
                                                todayRes.map(res => renderResCard(res, false))
                                            )}
                                        </div>

                                        {/* 💡 [명단 2] 내일 이후 미래 예약 목록 */}
                                        <div>
                                            <h3 className="font-black text-slate-500 text-lg mb-3 flex items-center gap-2 border-b border-slate-200 pb-2 mt-6">
                                                <span>🗓️ Future Bookings</span>
                                                <span className="bg-slate-400 text-white px-2 py-0.5 rounded-md text-xs">{futureRes.length}</span>
                                            </h3>
                                            {futureRes.length === 0 ? (
                                                <div className="text-center bg-white border border-slate-200 rounded-md p-6 text-slate-400 font-bold text-sm">No future bookings.</div>
                                            ) : (
                                                futureRes.map(res => renderResCard(res, true))
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* 💡 [신규 추가] View Details 클릭 시 나타나는 예약 상세 모달 */}
            {selectedResDetail && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="bg-slate-800 p-4 text-white flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-black flex items-center gap-2">🔍 Reservation Details</h3>
                            <button onClick={() => setSelectedResDetail(null)} className="text-white hover:text-red-400 font-bold text-xl">✕</button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Guest Name</p>
                                    <p className="font-black text-slate-800 text-lg">{selectedResDetail.guest_name}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Reservation ID</p>
                                    <p className="font-bold text-blue-600">{selectedResDetail.res_id}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Check-in</p>
                                    <p className="font-bold text-slate-800">{selectedResDetail.check_in_date}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Check-out</p>
                                    <p className="font-bold text-slate-800">{selectedResDetail.check_out_date}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Room Type</p>
                                    <p className="font-bold text-slate-800">{selectedResDetail.room_type || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Booking Channel</p>
                                    <p className="font-bold text-slate-800">{selectedResDetail.channel}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Email</p>
                                    <p className="font-bold text-slate-800 text-sm break-all">{selectedResDetail.email || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Phone</p>
                                    <p className="font-bold text-slate-800">{selectedResDetail.phone || 'N/A'}</p>
                                </div>
                            </div>

                            {selectedResDetail.special_requests && (
                                <div className="pb-2">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Special Requests</p>
                                    <p className="text-sm font-bold text-slate-700 bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                                        {selectedResDetail.special_requests}
                                    </p>
                                </div>
                            )}

                            <button onClick={() => setSelectedResDetail(null)} className="w-full bg-slate-900 text-white py-3.5 rounded-md font-bold hover:bg-slate-800 transition-colors shadow-md mt-4">
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {selectedRoom && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-[750px] overflow-hidden flex flex-col max-h-[95vh]">
                        <div className={`p-4 md:p-6 text-white flex justify-between items-center shrink-0 ${selectedRoom.status === 'OCCUPIED' ? 'bg-blue-700' : selectedRoom.status === 'RESERVED' ? 'bg-yellow-600' : selectedRoom.status.includes('MAKE_UP') ? 'bg-orange-500' : selectedRoom.status === 'MAINTENANCE' ? 'bg-slate-700' : 'bg-slate-800'}`}>
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black flex items-center gap-3">Room {selectedRoom.id}
                                    <select value={guestInfo.room_type} onChange={(e) => handleUpdateRoomType(e.target.value)} className="bg-black/20 text-white text-xs md:text-sm font-bold px-2 py-1 rounded outline-none border border-transparent focus:border-white/50 w-28 md:w-36 cursor-pointer">
                                        {roomTypes.map((rt) => <option key={rt.id} value={rt.name} className="text-black">{rt.name}</option>)}
                                    </select>
                                </h2>
                                <p className="text-xs md:text-sm font-bold opacity-80 uppercase tracking-widest mt-1">{selectedRoom.status.replace(/_/g, ' ')}</p>
                            </div>
                            <button onClick={closeModal} className="text-xl md:text-2xl hover:text-red-300 transition-colors bg-black/20 w-8 h-8 md:w-10 md:h-10 rounded-md flex items-center justify-center">✕</button>
                        </div>

                        <div className="p-4 md:p-8 overflow-y-auto flex-1">

                            {/* 💡 상태 1: VACANT (빈 방 - 체크인/예약 진행) */}
                            {selectedRoom.status === 'VACANT' && (
                                <div className="space-y-4 md:space-y-5">
                                    <div className="bg-blue-50 border border-blue-200 p-4 md:p-5 rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm gap-3">
                                        <div><label className="text-sm font-black text-blue-800 block mb-1">🔗 Link OTA Reservation</label><p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Auto-fill guest details</p></div>
                                        <select value={linkedResId} onChange={(e) => handleLinkReservation(e.target.value)} className="p-3 border border-blue-300 rounded-md text-sm font-bold text-blue-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64 shadow-sm cursor-pointer">
                                            <option value="">-- Walk-in (No Reservation) --</option>
                                            {pendingReservations.map((r) => <option key={r.res_id} value={r.res_id}>[{r.channel}] {r.guest_name}</option>)}
                                        </select>
                                    </div>

                                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                        <h3 className="font-black text-slate-800 text-base md:text-lg">{linkedResId ? 'OTA Confirmation' : 'Guest Registration'}</h3>
                                        {!linkedResId && <button onClick={() => setShowCrmModal(true)} className="text-[10px] md:text-xs bg-slate-800 text-white px-3 py-1.5 rounded-md font-bold shadow-sm hover:bg-slate-700 flex items-center gap-1">🔍 Load CRM Guest</button>}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                                        <div className="sm:col-span-2">
                                            <label className="text-xs font-bold text-slate-500 block mb-1">Booking Channel</label>
                                            <select value={guestInfo.channel || 'Walk-in'} onChange={(e) => setGuestInfo({ ...guestInfo, channel: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-300 rounded-md font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400">
                                                <option value="Walk-in">Walk-in</option>
                                                <option value="n+ Rewards (App)">n+ Rewards (App)</option>
                                                <option value="Portal">Portal (HQ Web)</option>
                                                <option value="Hotel Web">Hotel Web (Custom Domain)</option>
                                                <option value="Agoda">Agoda</option>
                                                <option value="Booking.com">Booking.com</option>
                                                <option value="Hotels.com">Hotels.com</option>
                                                <option value="Trip.com">Trip.com</option>
                                                <option value="Expedia">Expedia</option>
                                                <option value="Facebook">Facebook</option>
                                                <option value="Instagram">Instagram</option>
                                                <option value="Phone Call">Phone Call</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-500 block mb-1">Guest Name (First / Last)</label>
                                            <div className="flex gap-2">
                                                <input type="text" value={guestInfo.firstName || ''} onChange={(e) => setGuestInfo({ ...guestInfo, firstName: e.target.value, guestName: `${e.target.value} ${guestInfo.lastName || ''}`.trim() })} className="w-1/2 p-2.5 md:p-3 border border-slate-300 rounded-md font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="First Name" />
                                                <input type="text" value={guestInfo.lastName || ''} onChange={(e) => setGuestInfo({ ...guestInfo, lastName: e.target.value, guestName: `${guestInfo.firstName || ''} ${e.target.value}`.trim() })} className="w-1/2 p-2.5 md:p-3 border border-slate-300 rounded-md font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Last (Surname)" />
                                            </div>
                                        </div>

                                        <div><label className="text-xs font-bold text-slate-500 block mb-1">Phone Number</label><input type="text" value={guestInfo.phone} onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-300 rounded-md font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
                                        <div><label className="text-xs font-bold text-slate-500 block mb-1">Check-in Date</label><input type="date" value={guestInfo.check_in_date} onChange={(e) => setGuestInfo({ ...guestInfo, check_in_date: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-300 rounded-md font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
                                        <div><label className="text-xs font-bold text-slate-500 block mb-1">Expected Check-out</label><input type="date" value={guestInfo.check_out_date} onChange={(e) => setGuestInfo({ ...guestInfo, check_out_date: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-300 rounded-md font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-500 block mb-1">Nationality</label>
                                            <select value={guestInfo.nationality} onChange={(e) => setGuestInfo({ ...guestInfo, nationality: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-300 rounded-md font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400">
                                                <option value="">Select Country...</option>
                                                {TOP_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                <option disabled>──────────</option>
                                                {ALL_COUNTRIES.filter(c => !TOP_COUNTRIES.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div><label className="text-xs font-bold text-slate-500 block mb-1">Email Address</label><input type="email" value={guestInfo.email} onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-300 rounded-md font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
                                    </div>

                                    {!linkedResId && (
                                        <>
                                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-md">
                                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Extra Details</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-xs font-bold text-slate-500 block mb-1">Security Deposit & Method</label>
                                                        <div className="flex gap-2">
                                                            <input type="number" value={extraInfo.deposit} onChange={(e) => { setExtraInfo({ ...extraInfo, deposit: e.target.value }); setIsDepositPaid(false); }} className="w-1/3 p-2 border border-slate-300 rounded-md text-sm font-bold focus:outline-none focus:border-blue-400" placeholder="Amount (₱)" />
                                                            <select value={extraInfo.deposit_method} onChange={(e) => { setExtraInfo({ ...extraInfo, deposit_method: e.target.value }); setIsDepositPaid(false); }} className="w-1/3 p-2 border border-slate-300 rounded-md text-sm font-bold focus:outline-none focus:border-blue-400 bg-white cursor-pointer">
                                                                <option value="Cash">💵 Cash</option>
                                                                <option value="Card">💳 Card</option>
                                                                <option value="CC Open">🔓 CC Open</option>
                                                            </select>
                                                            <button onClick={handleProcessDeposit} disabled={isProcessingDeposit || isDepositPaid} className={`w-1/3 text-xs font-bold rounded-md text-white transition-colors shadow-sm ${isDepositPaid ? 'bg-green-500' : isProcessingDeposit ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                                                {isDepositPaid ? '✅ Verified' : isProcessingDeposit ? 'Processing...' : 'Charge'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div><label className="text-xs font-bold text-slate-500 block mb-1">Group ID (Optional)</label><input type="text" value={extraInfo.group_id} onChange={(e) => setExtraInfo({ ...extraInfo, group_id: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md text-sm font-bold focus:outline-none focus:border-blue-400" placeholder="e.g. TOUR-01" /></div>
                                                </div>
                                            </div>

                                            <div className="border border-slate-200 p-4 rounded-md bg-slate-50">
                                                <label className="text-xs font-bold text-slate-500 block mb-2">ID Card (Upload or Scan Camera) <span className="text-red-500">*</span></label>
                                                {!showCamera ? (
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="flex flex-col gap-2 w-full">
                                                            <input type="file" accept="image/*" onChange={handleIdUpload} className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer w-full" />
                                                            <button onClick={startCamera} className="bg-slate-800 text-white px-4 py-2 rounded-md text-xs font-bold w-fit hover:bg-slate-700 flex items-center gap-1 shadow-sm">📷 Use Webcam / Scanner</button>
                                                        </div>
                                                        {guestInfo.id_image ? (
                                                            <div className="relative group cursor-pointer" onClick={() => {
                                                                const win = window.open();
                                                                win.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;background:#333;"><img src="${guestInfo.id_image}" style="max-width:100%;max-height:100vh;"/></body></html>`);
                                                            }}>
                                                                <img src={guestInfo.id_image} alt="ID" className="h-16 w-24 md:h-20 md:w-32 object-cover border-2 border-emerald-300 rounded-md shadow-md shrink-0 transition-transform group-hover:scale-105" />
                                                                <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-sm animate-pulse border border-white">
                                                                    Member ID
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="h-16 w-24 md:h-20 md:w-32 bg-slate-100 border border-dashed border-slate-300 rounded-md flex flex-col items-center justify-center text-slate-400 shrink-0">
                                                                <span className="text-2xl mb-1">🪪</span>
                                                                <span className="text-[8px] font-bold">No ID</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-3 bg-slate-900 p-3 rounded-md">
                                                        <video ref={videoRef} autoPlay playsInline className="w-full max-w-sm rounded border border-slate-700 bg-black h-48 object-cover"></video>
                                                        <div className="flex gap-2 w-full max-w-sm">
                                                            <button onClick={stopCamera} className="flex-1 bg-slate-600 text-white py-2 rounded-md text-xs font-bold hover:bg-slate-500">Cancel</button>
                                                            <button onClick={captureImage} className="flex-[2] bg-emerald-500 text-white py-2 rounded-md text-xs font-bold shadow-md hover:bg-emerald-400">📸 Capture ID</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-md text-center mb-2 mt-4">
                                                {!tabletSignature ? (
                                                    isTabletPending ? (
                                                        <div className="flex flex-col items-center gap-2">
                                                            <span className="animate-pulse font-bold text-indigo-600">Waiting for guest signature on tablet...</span>
                                                            <button onClick={cancelTabletRequest} className="text-xs text-red-500 hover:underline">Cancel Request</button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={requestCheckinSignature} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold shadow-md transition-colors flex items-center justify-center gap-2">
                                                            📱 Request Signature on Tablet
                                                        </button>
                                                    )
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <span className="text-green-600 font-black text-lg">✅ Signature Received!</span>
                                                        <img src={tabletSignature} className="h-16 border bg-white rounded-md px-2" alt="Guest Signature" />
                                                        <button onClick={() => setTabletSignature('')} className="text-xs text-slate-500 hover:underline">Redo Signature</button>
                                                    </div>
                                                )}
                                            </div>

                                            {!tabletSignature && !isTabletPending && (
                                                <div>
                                                    <div className="flex justify-between items-end mb-1 mt-2">
                                                        <label className="text-[10px] md:text-xs font-bold text-slate-500">Or Manual Draw Signature</label>
                                                        <button onClick={clearSignature} className="text-[10px] text-blue-500 hover:underline font-bold">Clear</button>
                                                    </div>
                                                    <div className="w-full overflow-x-auto">
                                                        <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} width={650} height={120} className="w-[650px] h-[120px] border-2 border-dashed border-slate-300 rounded-md bg-slate-50 cursor-crosshair touch-none" />
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {!linkedResId && (
                                        <div className="bg-teal-50 border border-teal-200 p-4 rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="text-2xl md:text-3xl">💳</div>
                                                <div>
                                                    <p className="text-[10px] md:text-xs font-bold text-teal-700 mb-1 uppercase tracking-widest">RFID Key Card</p>
                                                    <p className="text-xs md:text-sm font-bold text-slate-700">Issue room access key</p>
                                                </div>
                                            </div>
                                            <button onClick={handleIssueKeyCard} disabled={isIssuingKey} className={`w-full sm:w-auto text-white px-5 py-3 rounded-md font-bold transition-colors shadow-sm text-sm whitespace-nowrap flex items-center justify-center gap-2 ${isKeyIssued ? 'bg-green-500' : 'bg-teal-600 hover:bg-teal-700'}`}>
                                                {isIssuingKey ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-md inline-block"></span> Encoding...</> : isKeyIssued ? '✅ Key Issued' : 'Issue Key'}
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-2 md:pt-4">
                                        <button onClick={handleMarkMaintenance} className="w-full sm:w-auto px-6 py-3 md:py-4 bg-slate-200 text-slate-700 rounded-md font-bold hover:bg-slate-300 transition-all text-sm">🛠️ Set Maintenance</button>
                                        {linkedResId ?
                                            <button onClick={handleConfirmReservation} className="w-full sm:flex-1 bg-yellow-500 hover:bg-yellow-400 text-white py-3 md:py-4 rounded-md font-bold text-base md:text-lg shadow-lg transition-all">📝 Confirm Reservation & Assign</button>
                                            : <button onClick={handleCheckIn} className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 md:py-4 rounded-md font-bold text-base md:text-lg shadow-lg transition-all">🔑 Check In & Save</button>
                                        }
                                    </div>

                                    <div className="mt-8 pt-4 border-t border-red-100 flex justify-center">
                                        <button onClick={handleDeletePhysicalRoom} className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 transition-colors">
                                            🚨 Delete this Physical Room
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 💡 상태 2: RESERVED (예약됨 - 체크인 전) */}
                            {selectedRoom.status === 'RESERVED' && (
                                <div className="space-y-4 md:space-y-5">
                                    <h3 className="font-black text-slate-800 border-b border-slate-200 pb-2 mb-4">Arrival Check-in (Pre-booked)</h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 block mb-1">Guest Name (First / Last)</label>
                                            <div className="flex gap-2">
                                                <input type="text" value={guestInfo.firstName || ''} onChange={(e) => setGuestInfo({ ...guestInfo, firstName: e.target.value, guestName: `${e.target.value} ${guestInfo.lastName || ''}`.trim() })} className="w-1/2 p-2.5 md:p-3 border border-slate-300 rounded-md font-bold bg-slate-50" placeholder="First Name" />
                                                <input type="text" value={guestInfo.lastName || ''} onChange={(e) => setGuestInfo({ ...guestInfo, lastName: e.target.value, guestName: `${guestInfo.firstName || ''} ${e.target.value}`.trim() })} className="w-1/2 p-2.5 md:p-3 border border-slate-300 rounded-md font-bold bg-slate-50" placeholder="Last (Surname)" />
                                            </div>
                                        </div>

                                        <div><label className="text-xs font-bold text-slate-500 block mb-1">Phone Number</label><input type="text" value={guestInfo.phone} onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-300 rounded-md font-bold bg-slate-50" /></div>
                                        <div><label className="text-xs font-bold text-slate-500 block mb-1">Check-in Date</label><input type="date" value={guestInfo.check_in_date} onChange={(e) => setGuestInfo({ ...guestInfo, check_in_date: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-300 rounded-md font-bold bg-slate-50" /></div>
                                        <div><label className="text-xs font-bold text-slate-500 block mb-1">Expected Check-out</label><input type="date" value={guestInfo.check_out_date} onChange={(e) => setGuestInfo({ ...guestInfo, check_out_date: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-300 rounded-md font-bold bg-slate-50" /></div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-500 block mb-1">Nationality</label>
                                            <select value={guestInfo.nationality} onChange={(e) => setGuestInfo({ ...guestInfo, nationality: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-300 rounded-md font-bold bg-slate-50">
                                                <option value="">Select Country...</option>
                                                {TOP_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                <option disabled>──────────</option>
                                                {ALL_COUNTRIES.filter(c => !TOP_COUNTRIES.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div><label className="text-xs font-bold text-slate-500 block mb-1">Email Address</label><input type="email" value={guestInfo.email} onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-300 rounded-md font-bold bg-slate-50" /></div>
                                    </div>

                                    {/* 💡 [정리됨] 중복 코드가 완전히 삭제되었습니다! */}

                                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-md">
                                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Extra Details</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 block mb-1">Security Deposit & Method</label>
                                                <div className="flex gap-2">
                                                    <input type="number" value={extraInfo.deposit} onChange={(e) => { setExtraInfo({ ...extraInfo, deposit: e.target.value }); setIsDepositPaid(false); }} className="w-1/3 p-2 border border-slate-300 rounded-md text-sm font-bold focus:outline-none focus:border-blue-400" placeholder="Amount (₱)" />
                                                    <select value={extraInfo.deposit_method} onChange={(e) => { setExtraInfo({ ...extraInfo, deposit_method: e.target.value }); setIsDepositPaid(false); }} className="w-1/3 p-2 border border-slate-300 rounded-md text-sm font-bold focus:outline-none focus:border-blue-400 bg-white cursor-pointer">
                                                        <option value="Cash">💵 Cash</option>
                                                        <option value="Card">💳 Card</option>
                                                        <option value="CC Open">🔓 CC Open</option>
                                                    </select>
                                                    <button onClick={handleProcessDeposit} disabled={isProcessingDeposit || isDepositPaid} className={`w-1/3 text-xs font-bold rounded-md text-white transition-colors shadow-sm ${isDepositPaid ? 'bg-green-500' : isProcessingDeposit ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                                        {isDepositPaid ? '✅ Verified' : isProcessingDeposit ? 'Processing...' : 'Charge'}
                                                    </button>
                                                </div>
                                            </div>
                                            <div><label className="text-xs font-bold text-slate-500 block mb-1">Group ID (Optional)</label><input type="text" value={extraInfo.group_id} onChange={(e) => setExtraInfo({ ...extraInfo, group_id: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md text-sm font-bold focus:outline-none focus:border-blue-400" placeholder="e.g. TOUR-01" /></div>
                                        </div>
                                    </div>

                                    <div className="border border-slate-200 p-4 rounded-md bg-slate-50">
                                        <label className="text-xs font-bold text-slate-500 block mb-2">ID Card (Upload or Scan Camera) <span className="text-red-500">*</span></label>
                                        {!showCamera ? (
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex flex-col gap-2 w-full">
                                                    <input type="file" accept="image/*" onChange={handleIdUpload} className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer w-full" />
                                                    <button onClick={startCamera} className="bg-slate-800 text-white px-4 py-2 rounded-md text-xs font-bold w-fit hover:bg-slate-700 flex items-center gap-1 shadow-sm">📷 Use Webcam / Scanner</button>
                                                </div>
                                                {guestInfo.id_image ? (
                                                    <div className="relative group cursor-pointer" onClick={() => {
                                                        const win = window.open();
                                                        win.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;background:#333;"><img src="${guestInfo.id_image}" style="max-width:100%;max-height:100vh;"/></body></html>`);
                                                    }}>
                                                        <img src={guestInfo.id_image} alt="ID" className="h-16 w-24 md:h-20 md:w-32 object-cover border-2 border-emerald-300 rounded-md shadow-md shrink-0 transition-transform group-hover:scale-105" />
                                                        <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-sm animate-pulse border border-white">
                                                            Member ID
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="h-16 w-24 md:h-20 md:w-32 bg-slate-100 border border-dashed border-slate-300 rounded-md flex flex-col items-center justify-center text-slate-400 shrink-0">
                                                        <span className="text-2xl mb-1">🪪</span>
                                                        <span className="text-[8px] font-bold">No ID</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-3 bg-slate-900 p-3 rounded-md">
                                                <video ref={videoRef} autoPlay playsInline className="w-full max-w-sm rounded border border-slate-700 bg-black h-48 object-cover"></video>
                                                <div className="flex gap-2 w-full max-w-sm">
                                                    <button onClick={stopCamera} className="flex-1 bg-slate-600 text-white py-2 rounded-md text-xs font-bold hover:bg-slate-500">Cancel</button>
                                                    <button onClick={captureImage} className="flex-[2] bg-emerald-500 text-white py-2 rounded-md text-xs font-bold shadow-md hover:bg-emerald-400">📸 Capture ID</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-md text-center mb-2 mt-4">
                                        {!tabletSignature ? (
                                            isTabletPending ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className="animate-pulse font-bold text-indigo-600">Waiting for guest signature on tablet...</span>
                                                    <button onClick={cancelTabletRequest} className="text-xs text-red-500 hover:underline">Cancel Request</button>
                                                </div>
                                            ) : (
                                                <button onClick={requestCheckinSignature} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold shadow-md transition-colors flex items-center justify-center gap-2">
                                                    📱 Request Signature on Tablet
                                                </button>
                                            )
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="text-green-600 font-black text-lg">✅ Signature Received!</span>
                                                <img src={tabletSignature} className="h-16 border bg-white rounded-md px-2" alt="Guest Signature" />
                                                <button onClick={() => setTabletSignature('')} className="text-xs text-slate-500 hover:underline">Redo Signature</button>
                                            </div>
                                        )}
                                    </div>

                                    {!tabletSignature && !isTabletPending && (
                                        <div>
                                            <div className="flex justify-between items-end mb-1 mt-2">
                                                <label className="text-[10px] md:text-xs font-bold text-slate-500">Or Manual Draw Signature</label>
                                                <button onClick={clearSignature} className="text-[10px] text-blue-500 hover:underline font-bold">Clear</button>
                                            </div>
                                            <div className="w-full overflow-x-auto">
                                                <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} width={650} height={120} className="w-[650px] h-[120px] border-2 border-dashed border-slate-300 rounded-md bg-slate-50 cursor-crosshair touch-none" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-teal-50 border border-teal-200 p-4 rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 mb-2">
                                        <div className="flex items-center gap-3"><div className="text-2xl md:text-3xl">💳</div><div><p className="text-[10px] md:text-xs font-bold text-teal-700 mb-1 uppercase tracking-widest">RFID Key Card</p><p className="text-xs md:text-sm font-bold text-slate-700">Issue room access key</p></div></div>
                                        <button onClick={handleIssueKeyCard} disabled={isIssuingKey} className={`w-full sm:w-auto text-white px-5 py-3 rounded-md font-bold transition-colors shadow-sm text-sm whitespace-nowrap flex items-center justify-center gap-2 ${isKeyIssued ? 'bg-green-500' : 'bg-teal-600 hover:bg-teal-700'}`}>
                                            {isIssuingKey ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-md inline-block"></span> Encoding...</> : isKeyIssued ? '✅ Key Issued' : 'Issue Key'}
                                        </button>
                                    </div>

                                    <button onClick={handleReservedCheckIn} className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-3 md:py-4 rounded-md font-bold text-base md:text-lg shadow-lg transition-all">🔑 Complete Arrival Check-in</button>
                                </div>
                            )}

                            {/* 💡 상태 3: OCCUPIED / MAKE_UP_GUEST / MT_PREPARATION / HK_START / HK_FINISHED / MT_ONGOING (투숙 중) */}
                            {(selectedRoom.status === 'OCCUPIED' || selectedRoom.status === 'MAKE_UP_GUEST' || selectedRoom.status === 'MT_PREPARATION' || selectedRoom.status === 'HK_START' || selectedRoom.status === 'HK_FINISHED' || selectedRoom.status === 'MT_ONGOING') && (
                                <div className="space-y-4 md:space-y-5">

                                    {/* 💡 [수정] 상단 정보 영역을 좌/우 분리 구조로 변경 */}
                                    <div className="bg-slate-50 p-4 md:p-6 rounded-md border border-slate-200 relative shadow-sm flex flex-col md:flex-row gap-6">

                                        {/* ⬅️ 왼쪽 영역 (1/3 비율): 게스트 정보, 서명, Expected Out */}
                                        <div className="w-full md:w-1/3 flex flex-col">
                                            <div className="mb-4">
                                                <div className="text-xs md:text-sm font-bold text-slate-500 mb-1">Registered Guest</div>
                                                <div className="text-xl md:text-2xl font-black text-slate-800 mb-2 truncate">👤 {selectedRoom.guestName}</div>
                                                <div className="text-[10px] md:text-xs text-slate-500">{selectedRoom.nationality} | {selectedRoom.phone}</div>
                                            </div>

                                            {selectedRoom.signature && (
                                                <div className="mb-6">
                                                    <p className="text-[10px] font-bold text-slate-400 mb-1">Signature:</p>
                                                    <img src={selectedRoom.signature} className="h-12 md:h-16 w-auto object-contain border border-slate-200 bg-white rounded p-1 shadow-sm" alt="sig" />
                                                </div>
                                            )}

                                            <div className="mt-auto pt-4 border-t border-slate-200 text-left">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Expected Out</div>
                                                {selectedRoom.check_out_date < getHotelDate(0) ? (
                                                    <div className="text-sm font-black text-red-600 bg-red-100 px-2 py-0.5 rounded animate-pulse border border-red-300 inline-block">
                                                        🚨 OVERDUE: {selectedRoom.check_out_date}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm font-bold text-slate-700">{selectedRoom.check_out_date || 'N/A'}</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* ➡️ 오른쪽 영역 (2/3 비율): ID 카드 넓게 배치 및 확대 기능 */}
                                        {selectedRoom.id_image && (
                                            <div className="w-full md:w-2/3 flex flex-col h-full border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className="text-[10px] font-bold text-slate-400">ID Card:</p>
                                                    <button
                                                        onClick={() => {
                                                            const win = window.open();
                                                            if (win) win.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;background:#333;"><img src="${selectedRoom.id_image}" style="max-width:100%;max-height:100vh;"/></body></html>`);
                                                        }}
                                                        className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded font-bold border border-blue-200 transition-colors shadow-sm flex items-center gap-1"
                                                    >
                                                        🔍 View Full Size
                                                    </button>
                                                </div>
                                                {/* 클릭 시 새 창 열림 */}
                                                <div
                                                    className="flex-1 w-full bg-white border border-slate-200 rounded-md p-2 shadow-sm cursor-zoom-in hover:border-blue-400 transition-colors flex items-center justify-center min-h-[200px]"
                                                    onClick={() => {
                                                        const win = window.open();
                                                        if (win) win.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;background:#333;"><img src="${selectedRoom.id_image}" style="max-width:100%;max-height:100vh;"/></body></html>`);
                                                    }}
                                                    title="Click to enlarge in new tab"
                                                >
                                                    <img src={selectedRoom.id_image} className="w-full h-full max-h-[280px] object-contain" alt="id" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 아래는 기존과 동일한 재무/컨트롤 영역 */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white p-4 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between">
                                            <div className="flex justify-between items-center mb-1">
                                                <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest">Folio Balance</p>
                                                {selectedRoom.balance > 0 && (
                                                    <button onClick={() => setShowFolioDetailsModal(true)} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold border border-slate-300 transition-colors">
                                                        🧾 View
                                                    </button>
                                                )}
                                            </div>
                                            <p className={`text-2xl md:text-3xl font-black mt-2 ${selectedRoom.balance > 0 ? 'text-red-600' : 'text-slate-800'}`}>₱{(selectedRoom.balance || 0).toLocaleString()}</p>
                                            {extraInfo.folio_limit > 0 && selectedRoom.balance >= extraInfo.folio_limit && (
                                                <p className="text-xs text-red-600 font-bold animate-pulse mt-1 bg-red-50 py-1 px-2 rounded w-fit">⚠️ Limit Exceeded!</p>
                                            )}
                                        </div>
                                        <div className="bg-emerald-50 p-4 rounded-md border border-emerald-200 shadow-sm flex flex-col justify-between">
                                            <p className="text-[10px] md:text-xs font-bold text-emerald-700 uppercase tracking-widest">Current Deposit</p>
                                            <p className="text-2xl md:text-3xl font-black text-emerald-800 mt-2">₱{Number(extraInfo.deposit || 0).toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {selectedRoom.balance > 0 && (
                                        <div className="bg-white border-2 border-slate-200 p-3 md:p-4 rounded-md flex flex-col sm:flex-row gap-3 shadow-sm mt-2">
                                            <input type="number" placeholder="Amount to Pay (₱)" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="flex-[2] p-2 md:p-3 border border-slate-200 sm:border-none rounded sm:rounded-none font-bold text-lg md:text-xl focus:outline-none focus:ring-0 bg-transparent text-slate-800" />
                                            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="flex-1 p-2 border border-slate-200 rounded-md text-sm font-bold bg-slate-50 outline-none cursor-pointer">
                                                <option value="Cash">💵 Cash</option>
                                                <option value="Card">💳 Card</option>
                                            </select>
                                            <button onClick={handlePayment} className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-md font-bold shadow-md transition-all whitespace-nowrap text-base md:text-lg">💳 Pay Folio</button>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-md">
                                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Financial Controls</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] md:text-xs font-bold text-slate-500 block mb-1">Set Folio Limit (₱)</label>
                                                <input type="number" value={extraInfo.folio_limit} onChange={(e) => setExtraInfo({ ...extraInfo, folio_limit: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md text-sm font-bold focus:outline-none focus:border-blue-400 bg-white" placeholder="Limit Amount" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] md:text-xs font-bold text-slate-500 block mb-1">Add More Deposit</label>
                                                <div className="flex gap-2">
                                                    <input type="number" value={addDepositAmt} onChange={(e) => setAddDepositAmt(e.target.value)} className="w-1/3 p-2.5 border border-slate-300 rounded-md text-sm font-bold focus:outline-none focus:border-blue-400 bg-white" placeholder="Amt" />
                                                    <select value={addDepositMethod} onChange={(e) => setAddDepositMethod(e.target.value)} className="w-1/3 p-2.5 border border-slate-300 rounded-md text-sm font-bold focus:outline-none focus:border-blue-400 bg-white cursor-pointer">
                                                        <option value="Cash">Cash</option><option value="Card">Card</option>
                                                    </select>
                                                    <button onClick={handleAddAdditionalDeposit} disabled={isProcessingDeposit} className={`w-1/3 text-xs font-bold rounded-md text-white shadow-sm transition-colors ${isProcessingDeposit ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                                        {isProcessingDeposit ? 'Wait...' : 'Charge'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-md">
                                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">General Details</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div><label className="text-xs font-bold text-slate-500 block mb-1">Group ID</label><input type="text" value={extraInfo.group_id} onChange={(e) => setExtraInfo({ ...extraInfo, group_id: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md text-sm font-bold bg-white outline-none" /></div>
                                            <div><label className="text-xs font-bold text-slate-500 block mb-1">Wake-up Call</label><input type="time" value={extraInfo.wakeup_call} onChange={(e) => setExtraInfo({ ...extraInfo, wakeup_call: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md text-sm font-bold bg-white outline-none" /></div>
                                        </div>
                                        <div className="flex items-center gap-3 bg-white p-3 rounded-md border border-slate-200 mt-4">
                                            <input type="checkbox" id="parcel" checked={extraInfo.has_parcel} onChange={(e) => setExtraInfo({ ...extraInfo, has_parcel: e.target.checked })} className="w-5 h-5 accent-red-500 cursor-pointer" />
                                            <label htmlFor="parcel" className="text-xs md:text-sm font-bold text-slate-700 cursor-pointer select-none">Guest Parcel (Package) 📦</label>
                                        </div>
                                    </div>

                                    <button onClick={saveExtraInfo} className="w-full bg-slate-800 text-white py-3.5 rounded-md font-bold hover:bg-slate-700 transition-all shadow-md text-sm flex justify-center items-center gap-2">
                                        💾 Save Limits & Details
                                    </button>

                                    <div className="bg-purple-50 border border-purple-200 p-4 rounded-md">
                                        {!showTransferMode ? (
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div><p className="text-xs font-bold text-purple-700 mb-1 uppercase tracking-widest">Room Transfer</p><p className="text-xs md:text-sm font-bold text-slate-700">Move guest to another room</p></div>
                                                <button onClick={() => setShowTransferMode(true)} className="w-full sm:w-auto bg-purple-600 text-white px-4 py-2 rounded-md font-bold hover:bg-purple-700 text-sm shadow-sm">🔄 Transfer</button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
                                                <div className="w-full sm:flex-1">
                                                    <p className="text-xs font-bold text-purple-700 mb-1 uppercase tracking-widest">Select Target Vacant Room</p>
                                                    <select value={transferTarget} onChange={(e) => setTransferTarget(e.target.value)} className="w-full p-2 border border-purple-300 rounded font-bold text-slate-700 focus:outline-none">
                                                        <option value="">-- Select Room --</option>
                                                        {rooms.filter((r) => r.status === 'VACANT').map((r) => <option key={r.id} value={r.id}>Room {r.id} ({r.room_type})</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex gap-2 w-full sm:w-auto sm:mt-4">
                                                    <button onClick={() => setShowTransferMode(false)} className="flex-1 sm:flex-none bg-slate-200 text-slate-600 px-3 py-2 rounded font-bold text-sm">Cancel</button>
                                                    <button onClick={handleTransferRoom} className="flex-[2] sm:flex-none bg-purple-600 text-white px-4 py-2 rounded font-bold text-sm shadow-md hover:bg-purple-700">Confirm Move</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-teal-50 border border-teal-200 p-4 rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 mb-2">
                                        <div className="flex items-center gap-3"><div className="text-2xl md:text-3xl">💳</div><div><p className="text-[10px] md:text-xs font-bold text-teal-700 mb-1 uppercase tracking-widest">RFID Key Card</p><p className="text-xs md:text-sm font-bold text-slate-700">Issue or duplicate room access key</p></div></div>
                                        <button onClick={handleIssueKeyCard} disabled={isIssuingKey} className={`w-full sm:w-auto text-white px-5 py-3 rounded-md font-bold transition-colors shadow-sm text-sm whitespace-nowrap flex items-center justify-center gap-2 ${isKeyIssued ? 'bg-green-500' : 'bg-teal-600 hover:bg-teal-700'}`}>
                                            {isIssuingKey ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-md inline-block"></span> Encoding...</> : isKeyIssued ? '✅ Key Issued' : 'Issue Key'}
                                        </button>
                                    </div>

                                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
                                        <div className="w-full sm:w-auto"><p className="text-[10px] md:text-xs font-bold text-blue-600 mb-1 uppercase tracking-widest">Extend Stay</p><input type="date" value={extensionDate} onChange={(e) => setExtensionDate(e.target.value)} className="w-full sm:w-auto p-2 border border-blue-300 rounded text-sm font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                                        <button onClick={handleExtendRoomClick} className="w-full sm:w-auto bg-blue-600 text-white px-5 py-2.5 md:py-3 rounded-md font-bold hover:bg-blue-700 transition-colors shadow-sm text-sm whitespace-nowrap mt-2 sm:mt-0">Check & Extend</button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-6 mb-4">
                                        <div className="border border-purple-200 bg-purple-50 p-3 rounded-md flex flex-col gap-2.5">
                                            <p className="text-xs font-bold text-purple-900 mb-0.5 text-center">Housekeeping</p>
                                            <button onClick={() => setSvcModal({ show: true, type: 'MAKE_UP_STAY', memo: '' })} className="bg-purple-100 hover:bg-purple-200 text-purple-950 py-2.5 rounded-md font-bold shadow transition-transform active:scale-95 text-[10px] md:text-xs xl:text-sm flex justify-center items-center gap-1 border border-purple-200">
                                                🧹 Make Up (w/o check out)
                                            </button>
                                            <button onClick={() => setSvcModal({ show: true, type: 'MAKE_UP_OUT', memo: '' })} className="bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-md font-bold shadow-md transition-transform active:scale-95 text-[10px] md:text-xs xl:text-sm flex justify-center items-center gap-1">
                                                🧹 Make Up Room
                                            </button>
                                        </div>
                                        <div className="border border-slate-200 bg-slate-50 p-3 rounded-md flex flex-col gap-2.5">
                                            <p className="text-xs font-bold text-slate-700 mb-0.5 text-center">Maintenance</p>
                                            <button onClick={() => setSvcModal({ show: true, type: 'MAINT_STAY', memo: '' })} className="bg-slate-200 hover:bg-slate-300 text-slate-950 py-2.5 rounded-md font-bold shadow transition-transform active:scale-95 text-[10px] md:text-xs xl:text-sm flex justify-center items-center gap-1 border border-slate-300">
                                                🛠️ Service Maintenance
                                            </button>
                                            <button onClick={() => setSvcModal({ show: true, type: 'MAINT_OUT', memo: '' })} className="bg-slate-700 hover:bg-slate-800 text-white py-2.5 rounded-md font-bold shadow-md transition-transform active:scale-95 text-[10px] md:text-xs xl:text-sm flex justify-center items-center gap-1">
                                                🛠️ Set Maintenance
                                            </button>
                                        </div>
                                    </div>

                                    <button onClick={openCheckoutFlow} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-md font-black text-lg shadow-2xl transition-all hover:-translate-y-1 flex items-center justify-center gap-3">
                                        🚪 Settle & Express Check-out ➔
                                    </button>
                                </div>
                            )}

                            {/* 💡 상태 4: MAINTENANCE 등 (관리 중) */}
                            {selectedRoom.status !== 'VACANT' && selectedRoom.status !== 'RESERVED' && selectedRoom.status !== 'OCCUPIED' && selectedRoom.status !== 'MAKE_UP_GUEST' && selectedRoom.status !== 'MT_PREPARATION' && selectedRoom.status !== 'HK_START' && selectedRoom.status !== 'HK_FINISHED' && selectedRoom.status !== 'MT_ONGOING' && (
                                <div className="py-10 text-center">
                                    <div className="text-5xl md:text-6xl mb-6">{selectedRoom.status === 'MAINTENANCE' ? '🛠️' : '🧹'}</div>
                                    <h3 className="text-xl md:text-2xl font-black text-slate-800 mb-2">Room Needs Attention</h3>
                                    <p className="text-sm md:text-base text-slate-500 mb-8">This room is currently marked as <strong className="text-slate-700">{selectedRoom.status.replace(/_/g, ' ')}</strong>.<br />Once work is done, mark it as clean to allow check-ins.</p>

                                    {selectedRoom.status === 'MAINTENANCE' && selectedRoom.maintenance_remarks && (
                                        <div className="bg-red-50 text-red-700 p-4 rounded-md text-sm font-bold border border-red-200 mb-8 mx-auto max-w-sm flex items-start gap-2 text-left shadow-sm">
                                            <span className="text-xl shrink-0">⚠️</span><span>Issue: {selectedRoom.maintenance_remarks}</span>
                                        </div>
                                    )}

                                    <button onClick={handleMarkClean} className="bg-green-500 hover:bg-green-400 text-white px-8 md:px-10 py-3 md:py-4 rounded-md font-bold text-base md:text-lg shadow-lg transition-all w-full max-w-sm">✨ Mark as Clean (Vacant)</button>

                                    <div className="mt-8 pt-4 border-t border-red-100 flex justify-center">
                                        <button onClick={handleDeletePhysicalRoom} className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 transition-colors">
                                            🚨 Delete this Physical Room
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* 헤더 및 상단 메뉴 */}
            <div className="bg-slate-900 text-white p-4 md:p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center z-10 gap-4 md:gap-0">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2 md:gap-3">🛎️ Front Desk Plus</h1>
                    <p className="text-slate-400 font-bold mt-1 tracking-widest text-[10px] md:text-sm">PMS & Channel Manager Sync</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">

                    {/* 💳 결제 단말기 선택 드롭다운 */}
                    <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 md:py-2.5 rounded-md border border-slate-600 shadow-md">
                        <span className="text-sm md:text-base">💳</span>
                        <select value={selectedTerminal} onChange={(e) => setSelectedTerminal(e.target.value)} className="bg-transparent text-white text-xs md:text-sm font-bold outline-none cursor-pointer w-24 md:w-32 truncate">
                            <option value="" className="text-black">No Terminal</option>
                            {terminals.map(t => <option key={t.id} value={t.id} className="text-black">{t.name}</option>)}
                        </select>
                    </div>

                    {/* 📱 [신규] 태블릿 선택 드롭다운 (여기가 추가된 부분입니다!) */}
                    <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 md:py-2.5 rounded-md border border-slate-600 shadow-md mr-2">
                        <span className="text-sm md:text-base">📱</span>
                        <select value={targetTablet} onChange={(e) => handleTabletChange(e.target.value)} className="bg-transparent text-white text-xs md:text-sm font-bold outline-none cursor-pointer w-20 md:w-24">
                            <option value="PAD-1" className="text-black">PAD-1</option>
                            <option value="PAD-2" className="text-black">PAD-2</option>
                            <option value="PAD-3" className="text-black">PAD-3</option>
                            <option value="ALL" className="text-black">ALL PADS</option>
                        </select>
                    </div>

                    <button onClick={() => setShowHandoverModal(true)} className="flex-1 md:flex-none bg-slate-700 hover:bg-slate-600 px-3 md:px-5 py-2 md:py-2.5 rounded-md text-xs md:text-sm font-bold transition-all shadow-md flex items-center justify-center gap-1 md:gap-2 border border-slate-500 text-white">
                        <span>🔄</span> <span className="hidden sm:inline">Shift Handover</span><span className="sm:hidden">Handover</span>
                    </button>
                    <button onClick={() => { setShowLedgerModal(true); fetchLedger(); }} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 px-3 md:px-5 py-2 md:py-2.5 rounded-md text-xs md:text-sm font-bold transition-all shadow-md flex items-center justify-center gap-1 md:gap-2 border border-emerald-500 text-white">
                        <span>💵</span> <span className="hidden sm:inline">Cash Ledger</span><span className="sm:hidden">Ledger</span>
                    </button>
                    <Link to="/" className="w-full sm:w-auto text-center bg-slate-700 border border-slate-600 px-4 md:px-6 py-2 rounded-md font-bold text-slate-200 hover:bg-slate-600 transition-colors shadow-sm text-xs md:text-sm">🏠 Exit</Link>
                </div>
            </div>

            <div className="bg-white border-b border-slate-200 p-4 md:p-6 flex flex-col xl:flex-row items-start xl:items-center justify-between shadow-sm gap-4 xl:gap-0">
                <div className="grid grid-cols-3 sm:grid-cols-6 xl:flex gap-2 md:gap-4 w-full xl:w-auto">
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3 w-full xl:w-28 text-center">
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase truncate">Total</p><p className="text-xl md:text-2xl font-black text-slate-800">{totalRooms}</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 w-full xl:w-28 text-center">
                        <p className="text-[9px] md:text-[10px] font-bold text-blue-500 uppercase truncate">Occupied</p><p className="text-xl md:text-2xl font-black text-blue-700">{occupiedRooms}</p>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 w-full xl:w-28 text-center">
                        <p className="text-[9px] md:text-[10px] font-bold text-yellow-600 uppercase truncate">Reserved</p><p className="text-xl md:text-2xl font-black text-yellow-700">{reservedRooms}</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-md p-3 w-full xl:w-28 text-center">
                        <p className="text-[9px] md:text-[10px] font-bold text-green-500 uppercase truncate">Available</p><p className="text-xl md:text-2xl font-black text-green-700">{availableRooms}</p>
                    </div>
                    <div onClick={() => setShowCleaningModal(true)} className="bg-orange-50 border border-orange-200 rounded-md p-3 w-full xl:w-28 text-center cursor-pointer hover:bg-orange-100 hover:scale-105 transition-all shadow-sm group">
                        <p className="text-[9px] md:text-[10px] font-bold text-orange-500 uppercase group-hover:text-orange-600 truncate">Cleaning</p><p className="text-xl md:text-2xl font-black text-orange-700">{dirtyRooms}</p>
                    </div>
                    <div onClick={() => setShowMaintenanceModal(true)} className="bg-slate-200 border border-slate-300 rounded-md p-3 w-full xl:w-32 text-center cursor-pointer hover:bg-slate-300 hover:scale-105 transition-all shadow-sm group">
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-600 uppercase group-hover:text-slate-700 truncate">Maintenance</p><p className="text-xl md:text-2xl font-black text-slate-800">{maintenanceRooms}</p>
                    </div>
                </div>

                <div className="bg-slate-900 p-4 rounded-md text-white shadow-inner flex flex-col justify-center w-full xl:w-[220px] shrink-0 mt-2 xl:mt-0 relative">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Channel Manager</span>
                        <span className="text-[10px] font-bold text-green-400 flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-md animate-pulse"></span> Live Sync</span>
                    </div>

                    {/* 💡 [알림 끄기 버튼] 새 예약이 들어와서 소리가 울릴 때만 나타납니다 */}
                    {isOtaAlarmRinging && (
                        <button onClick={stopOtaAlarm} className="absolute -top-3 -right-2 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-md shadow-lg animate-bounce z-10 flex items-center gap-1 border-2 border-white">
                            🔕 Stop Alarm
                        </button>
                    )}

                    <div className="flex gap-2">
                        <button onClick={() => { setShowResModal(true); stopOtaAlarm(); }} className="flex-[2] bg-slate-800 hover:bg-slate-700 py-2.5 rounded-md text-xs font-bold transition-colors flex justify-center items-center gap-2 border border-slate-700 shadow-sm">
                            📥 View
                            {/* 💡 [핵심 수정] 대기 중인 예약이 1개라도 있으면 파란 동그라미가 상시 바운스(animate-bounce) 합니다! */}
                            <span className={`text-white px-2 py-0.5 rounded-md text-[10px] font-black transition-all inline-block ${pendingReservations.length > 0 ? 'bg-blue-500 animate-bounce shadow-[0_0_10px_rgba(59,130,246,0.8)]' : 'bg-slate-600'}`}>
                                {pendingReservations.length}
                            </span>
                        </button>
                        <button onClick={() => {
                            // 창을 열 때마다 현재 DB에 있는 진짜 첫 번째 방 타입과 오늘 날짜로 세팅!
                            setNewResData({
                                guest_name: '', channel: 'Walk-in',
                                room_type: roomTypes.length > 0 ? roomTypes[0].name : 'Standard',
                                check_in_date: getHotelDate(0), check_out_date: getHotelDate(1), phone: '', email: ''
                            });
                            setShowNewResModal(true);
                        }} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2.5 rounded-md text-xs font-bold transition-colors flex justify-center items-center gap-1 shadow-sm">
                            ➕ New
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-4 md:px-10 pt-4 md:pt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex gap-2 overflow-x-auto w-full pb-2 md:pb-0 scrollbar-hide">
                    <button onClick={() => setSelectedRoomType('All')} className={`whitespace-nowrap px-4 md:px-6 py-2 rounded-md font-bold text-xs md:text-sm shadow-sm transition-all ${selectedRoomType === 'All' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>All Rooms</button>
                    {roomTypes.map((rt) => (
                        <button key={rt.id} onClick={() => setSelectedRoomType(rt.name)} className={`whitespace-nowrap px-4 md:px-6 py-2 rounded-md font-bold text-xs md:text-sm shadow-sm transition-all ${selectedRoomType === rt.name ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{rt.name}</button>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <button onClick={() => setShowSmartSearch(true)} className="whitespace-nowrap w-auto px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-md font-bold shadow-md flex items-center justify-center gap-2 transition-all text-sm">
                        🧠 Smart Room checker
                    </button>
                    <div className="relative w-full sm:w-72 md:w-96 flex">
                        <span className="absolute left-4 top-2.5 opacity-50 text-sm">🔍</span>
                        <input type="text" placeholder="Search Room, Guest, or Res ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleGlobalSearchEnter}
                            className="w-full py-2.5 pl-10 pr-12 rounded-md border border-slate-300 font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                        <button onClick={executeGlobalSearch} className="absolute right-1 top-1 bottom-1 bg-blue-600 hover:bg-blue-700 text-white px-3 rounded-md font-bold text-xs shadow-sm transition-colors">
                            Search
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-4 md:p-10 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 max-w-7xl mx-auto">
                    {displayRooms.map((room) => {
                        const isOcc = room.status === 'OCCUPIED' || room.status === 'MAKE_UP_GUEST' || room.status === 'MT_PREPARATION' || room.status === 'HK_START' || room.status === 'HK_FINISHED' || room.status === 'MT_ONGOING';
                        const isRes = room.status === 'RESERVED';

                        // 💡 [추가] 오늘 체크아웃 해야 하는데 아직 OCCUPIED인 경우 (Overdue)
                        const isOverdue = isOcc && room.check_out_date < getHotelDate(0);

                        const parsedMemos = parseRoomMemos ? parseRoomMemos(room.maintenance_remarks) : { hk: null, mt: null };

                        const hkStyle = {
                            maxHeight: (expandedMemos && expandedMemos[room.id]) ? '200px' : '32px',
                            overflow: (expandedMemos && expandedMemos[room.id]) ? 'auto' : 'hidden'
                        };
                        const mtStyle = {
                            maxHeight: (expandedMemos && expandedMemos[room.id]) ? '200px' : '32px',
                            overflow: (expandedMemos && expandedMemos[room.id]) ? 'auto' : 'hidden'
                        };

                        return (
                            // 💡 [변경] Overdue인 객실은 전체 테두리가 빨간색으로 깜빡거림
                            <div key={room.id} onClick={() => openModal(room)} className={`flex flex-col h-auto min-h-36 md:min-h-44 rounded-md shadow-sm border-2 transition-all p-3 md:p-4 relative text-left group cursor-pointer ${isOverdue ? 'bg-red-50 border-red-500 hover:bg-red-100 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : getRoomColor(room.status)}`}>

                                <div className="flex justify-between items-start w-full mb-2">
                                    <div>
                                        {/* 💡 [변경] 룸 번호 텍스트 색상도 붉게 */}
                                        <div className={`text-xl md:text-2xl font-black ${(isOcc || isRes) ? (isOverdue ? 'text-red-700' : 'text-blue-800') : 'text-slate-700'}`}>{room.id}</div>
                                        <div className={`text-[9px] md:text-[11px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border mt-1 inline-block ${isOverdue ? 'bg-red-100 text-red-700 border-red-200' : 'text-slate-500 bg-slate-100 border-slate-200'}`}>
                                            {room.room_type || 'NOT SET'}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1 items-end shrink-0 z-10">
                                        {(room.status.includes('HK_') || room.status.includes('MAKE_UP') || parsedMemos.hk) && (
                                            <button onClick={(e) => { e.stopPropagation(); setQuickMemoModal({ show: true, room, memo: '' }); }}
                                                className="px-2 py-1 rounded-md text-[8px] md:text-[9px] font-bold uppercase tracking-wider shadow-sm border bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200 hover:scale-105 transition-transform">
                                                {room.status.includes('HK_') || room.status.includes('MAKE_UP') ? room.status.replace(/_/g, ' ') : 'HK PENDING'}
                                            </button>
                                        )}
                                        {(room.status.includes('MT_') || room.status === 'MAINTENANCE' || parsedMemos.mt) && (
                                            <button onClick={(e) => { e.stopPropagation(); setQuickMemoModal({ show: true, room, memo: '' }); }}
                                                className="px-2 py-1 rounded-md text-[8px] md:text-[9px] font-bold uppercase tracking-wider shadow-sm border bg-slate-700 text-white border-slate-800 hover:bg-slate-600 hover:scale-105 transition-transform">
                                                {room.status.includes('MT_') || room.status === 'MAINTENANCE' ? room.status.replace(/_/g, ' ') : 'MT PENDING'}
                                            </button>
                                        )}
                                        {!(room.status.includes('HK_') || room.status.includes('MAKE_UP') || parsedMemos.hk) &&
                                            !(room.status.includes('MT_') || room.status === 'MAINTENANCE' || parsedMemos.mt) && (
                                                <span className={`px-2 py-1 rounded-md text-[8px] md:text-[9px] font-bold uppercase tracking-wider shadow-sm border ${isOverdue ? 'bg-red-600 text-white border-red-700 animate-pulse' : isOcc ? 'bg-blue-600 text-white border-blue-700' : isRes ? 'bg-yellow-500 text-white border-yellow-600' : 'bg-white/60 text-slate-800 border-slate-200/50'}`}>
                                                    {isOverdue ? '🚨 OVERDUE' : room.status.replace(/_/g, ' ')}
                                                </span>
                                            )}
                                    </div>
                                </div>

                                {/* 💡 중앙 2구역: 층 분리된 메모장 영역 (더보기/접기 기능) */}
                                {(parsedMemos.hk || parsedMemos.mt) && (
                                    <div className="w-full flex flex-col gap-1.5 mb-2 relative group-memo z-10" onClick={(e) => e.stopPropagation()}>
                                        {parsedMemos.hk && (
                                            <div className="w-full bg-orange-50 border border-orange-200 text-orange-800 p-2 pr-6 rounded text-[9px] md:text-[10px] font-bold whitespace-pre-wrap leading-tight shadow-sm transition-all duration-300 ease-in-out" style={hkStyle}>
                                                {parsedMemos.hk}
                                            </div>
                                        )}
                                        {parsedMemos.mt && (
                                            <div className="w-full bg-slate-100 border border-slate-300 text-slate-700 p-2 pr-6 rounded text-[9px] md:text-[10px] font-bold whitespace-pre-wrap leading-tight shadow-sm transition-all duration-300 ease-in-out" style={mtStyle}>
                                                {parsedMemos.mt}
                                            </div>
                                        )}
                                        <button onClick={(e) => toggleMemo(room.id, e)} className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded bg-white/90 hover:bg-white text-slate-500 hover:text-blue-600 shadow-sm opacity-0 group-memo-hover:opacity-100 transition-opacity border border-slate-200">
                                            {expandedMemos && expandedMemos[room.id] ? '▲' : '▼'}
                                        </button>
                                    </div>
                                )}

                                {(isOcc || isRes) ? (
                                    <div className="mt-auto w-full pt-1 border-t border-black/5">
                                        <div className="text-xs md:text-sm font-bold text-slate-700 truncate mb-1">👤 {room.guestName}</div>
                                        <div className="flex gap-1 mb-1 flex-wrap">
                                            <span className="bg-slate-200 text-slate-700 text-[8px] md:text-[9px] px-1 rounded shadow-sm">
                                                👥 {room.group_id || 'None'}
                                            </span>
                                            {room.wakeup_call && <span className="bg-yellow-100 text-yellow-700 text-[8px] md:text-[9px] px-1 rounded shadow-sm">🔔 {room.wakeup_call}</span>}
                                            {room.has_parcel === 1 && <span className="bg-red-100 text-red-700 text-[8px] md:text-[9px] px-1 rounded shadow-sm animate-pulse">📦 Parcel</span>}
                                        </div>
                                        {isOcc && <div className={`text-xs md:text-sm font-black p-1 rounded-md text-center mt-1 ${room.balance > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>Folio: ₱{room.balance.toLocaleString()}</div>}
                                    </div>
                                ) : (
                                    <div className="mt-auto text-xs md:text-sm font-bold text-slate-400 group-hover:text-slate-600 transition-colors pt-2">
                                        {room.status === 'VACANT' ? 'Click to Check-in' : 'Click to Manage'}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 💡 빠른 메모장 모달창 */}
            {quickMemoModal?.show && quickMemoModal?.room && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-md overflow-hidden transform scale-100 transition-all border border-slate-100">
                        <div className="p-5 text-white flex justify-between items-center bg-slate-800">
                            <h3 className="text-xl font-black">📝 Quick Note (Room {quickMemoModal.room.id})</h3>
                            <button onClick={() => setQuickMemoModal({ show: false, room: null, memo: '' })} className="text-slate-300 hover:text-white font-bold text-xl">✕</button>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-600 font-bold text-sm mb-3">Add a note for Housekeeping or Maintenance:</p>
                            <textarea
                                rows="4"
                                value={quickMemoModal.memo}
                                onChange={(e) => setQuickMemoModal({ ...quickMemoModal, memo: e.target.value })}
                                className="w-full p-4 border-2 border-slate-200 rounded-md focus:border-blue-500 outline-none text-sm font-bold text-slate-800 bg-slate-50 shadow-inner resize-none"
                                placeholder="e.g., Clean after 2 PM, Watch out for broken glass..."
                            ></textarea>
                        </div>
                        <div className="flex bg-slate-50 p-4 gap-3 border-t border-slate-100">
                            <button onClick={() => setQuickMemoModal({ show: false, room: null, memo: '' })} className="flex-1 py-3 rounded-md font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 transition-colors">Cancel</button>
                            <button onClick={handleSaveQuickMemo} className="flex-[2] py-3 rounded-md font-black text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-colors">Save Note</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 하우스키핑 / 유지보수 요청 모달창 */}
            {svcModal.show && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-xl overflow-hidden transform scale-100 transition-all border border-slate-100">
                        <div className={`p-6 text-white flex items-center justify-center ${svcModal.type.includes('MAKE_UP') ? 'bg-purple-600' : 'bg-slate-700'}`}>
                            <h3 className="text-2xl font-black">{svcModal.type.includes('MAKE_UP') ? '🧹 Housekeeping' : '🛠️ Maintenance'}</h3>
                        </div>
                        <div className="p-8">
                            {svcModal.type === 'MAKE_UP_STAY' || svcModal.type === 'MAINT_STAY' ? (
                                <div className="flex flex-col h-full">
                                    <p className="text-slate-800 font-black text-lg mb-4 text-left">
                                        {svcModal.type === 'MAKE_UP_STAY' ? 'Please enter preferred time or specific requests:' : 'Please enter the issue details (e.g. Remote battery):'}
                                    </p>
                                    <textarea
                                        rows="7"
                                        value={svcModal.memo}
                                        onChange={(e) => setSvcModal({ ...svcModal, memo: e.target.value })}
                                        className="w-full p-5 border-2 border-slate-200 rounded-md focus:border-blue-500 outline-none text-lg font-bold text-slate-800 bg-slate-50 shadow-inner resize-none leading-relaxed"
                                        placeholder="Type details here..."
                                    ></textarea>
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <p className="text-slate-800 font-black text-2xl mb-4">⚠️ Warning</p>
                                    <p className="text-red-500 text-base font-bold leading-relaxed whitespace-pre-wrap">
                                        {svcModal.type === 'MAKE_UP_OUT'
                                            ? 'This request is for check-out.\nIs it correct to mark this room as Checked Out?'
                                            : 'This request restricts room usage.\nIs it correct to block this room for maintenance?'}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="flex bg-slate-50 p-5 gap-4 border-t border-slate-100">
                            <button onClick={() => setSvcModal({ show: false, type: '', memo: '' })} className="flex-1 py-4 rounded-md font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 transition-colors text-lg">Back</button>
                            <button onClick={executeServiceRequest} className="flex-[2] py-4 rounded-md font-black text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-colors text-lg">Proceed</button>
                        </div>
                    </div>
                </div>
            )}

            {alertModal.show && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-sm overflow-hidden text-center transform scale-100 transition-all border border-slate-100">
                        <div className={`p-8 ${alertModal.type === 'success' ? 'bg-emerald-500' : alertModal.type === 'error' ? 'bg-red-500' : 'bg-blue-600'}`}>
                            <span className="text-6xl drop-shadow-md">
                                {alertModal.type === 'success' ? '✅' : alertModal.type === 'error' ? '❌' : 'ℹ️'}
                            </span>
                        </div>
                        <div className="p-8">
                            <h3 className="text-2xl font-black text-slate-800 mb-3">{alertModal.title}</h3>
                            <p className="text-slate-500 text-sm mb-8 leading-relaxed font-medium whitespace-pre-wrap">{alertModal.message}</p>
                            <button onClick={() => setAlertModal({ ...alertModal, show: false })}
                                className={`w-full py-4 rounded-md font-black text-white shadow-lg transition-all text-lg ${alertModal.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-800 hover:bg-slate-700'}`}>
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 💡 [호버 효과 CSS] 펼쳐보기 버튼이 마우스를 올렸을 때만 나타나게 만듭니다. */}
            <style>{`
        .group-memo:hover .group-memo-hover\\:opacity-100 {
            opacity: 1 !important;
        }
      `}</style>
        </div>
    );
}
