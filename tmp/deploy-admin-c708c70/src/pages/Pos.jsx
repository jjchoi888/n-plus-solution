import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { io } from 'socket.io-client';
import ReceiptViewerModal from '../components/ReceiptViewerModal';
import { createDefaultReceiptConfig, mergeReceiptConfig } from '../utils/receiptView';
import EventPos from './EventPos';
import {
    buildManagedEventPosStorePayload,
    isEventBanquetStore,
    loadBanquetVenues,
    loadEventPosStoreMeta
} from '../utils/banquetEvents';

const getHotelDate = (offsetDays = 0) => {
    const now = new Date();
    if (now.getHours() < 12) now.setDate(now.getDate() - 1);
    now.setDate(now.getDate() + offsetDays);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function Pos() {
    const HISTORY_ROWS_PER_PAGE = 20;
    const { id } = useParams();

    const currentUser = sessionStorage.getItem('userId') || localStorage.getItem('userId') || 'UNKNOWN';
    const currentHotelCode = sessionStorage.getItem('hotelCode') || localStorage.getItem('hotelCode') || '';

    // 💡 [핵심 수정] 무전기(Socket) 변수와 서명 수신 상태 추가
    const socketRef = useRef(null);
    const [receivedSignature, setReceivedSignature] = useState(null);

    const [activeView, setActiveView] = useState('TABLES');
    const [storeInfo, setStoreInfo] = useState({ name: `Loading Store...`, id: null, table_count: 25, is_room_linked: false });
    const [posMenu, setPosMenu] = useState([]);
    const [activeCategory, setActiveCategory] = useState('All');

    const [activeTables, setActiveTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [cart, setCart] = useState([]);
    const [roomNumberInput, setRoomNumberInput] = useState('');

    const [walkInGuests, setWalkInGuests] = useState([]);

    const [receiptConfig, setReceiptConfig] = useState(createDefaultReceiptConfig());
    const [sizeModalData, setSizeModalData] = useState(null);
    const [hotelRooms, setHotelRooms] = useState([]);

    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [isDiscountApplied, setIsDiscountApplied] = useState(false);
    const [totalPax, setTotalPax] = useState(1);
    const [scPwdPax, setScPwdPax] = useState(0);
    const [managerId, setManagerId] = useState('');
    const [managerPassword, setManagerPassword] = useState('');

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [historyStartDate, setHistoryStartDate] = useState(getHotelDate(0));
    const [historyEndDate, setHistoryEndDate] = useState(getHotelDate(0));
    const [historyPage, setHistoryPage] = useState(1);
    const [showReceiptArchiveModal, setShowReceiptArchiveModal] = useState(false);
    const [receiptArchiveData, setReceiptArchiveData] = useState([]);
    const [receiptArchiveLoading, setReceiptArchiveLoading] = useState(false);
    const [receiptArchiveSearch, setReceiptArchiveSearch] = useState('');
    const [receiptArchiveStartDate, setReceiptArchiveStartDate] = useState('');
    const [receiptArchiveEndDate, setReceiptArchiveEndDate] = useState('');
    const [receiptArchivePage, setReceiptArchivePage] = useState(1);
    const [selectedReceiptRecord, setSelectedReceiptRecord] = useState(null);

    // 💡 [신규 1] QR 결제 대기 모달 상태
    const [qrPaymentData, setQrPaymentData] = useState(null);
    const [, setRewardQrToken] = useState('');
    const [rewardQrResult, setRewardQrResult] = useState(null);
    const [, setRewardQrPreview] = useState(null);
    const [, setRewardQrPreviewLoading] = useState(false);
    const rewardQrPaidNotifiedRef = useRef(false);
    const [paymentSuccessData, setPaymentSuccessData] = useState(null);
    const isEventPosStore = String(storeInfo.type || '').toLowerCase().includes('event')
        || String(storeInfo.type || '').toLowerCase().includes('banquet');

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Preparation': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'Cook': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'Served': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'On Process': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'Confirmed': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
            case 'Done': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            default: return 'bg-slate-100 text-slate-500 border-slate-200'; // Pending
        }
    };

    useEffect(() => {
        const loadPosData = async () => {
            try {
                const res = await fetch(`/api/pos-stores?hotel=${currentHotelCode}`);
                const storesData = await res.json();
                const rawStores = Array.isArray(storesData) ? storesData : (storesData.stores || []);
                const eventStoreMeta = loadEventPosStoreMeta(currentHotelCode);
                const eventStores = rawStores.filter(isEventBanquetStore);
                const canonicalEventStore = eventStores.find((store) => String(store.id) === String(eventStoreMeta?.id || ''))
                    || eventStores.find((store) => String(store.location) === String(eventStoreMeta?.location || ''))
                    || eventStores[0]
                    || null;
                const allStores = rawStores
                    .filter((store) => !isEventBanquetStore(store) || String(store.id) === String(canonicalEventStore?.id || ''))
                    .map((store) => (
                        canonicalEventStore && String(store.id) === String(canonicalEventStore.id)
                            ? {
                                ...store,
                                ...buildManagedEventPosStorePayload({
                                    venues: loadBanquetVenues(currentHotelCode),
                                    existingStore: canonicalEventStore,
                                    stores: rawStores
                                }),
                                is_auto_managed: true
                            }
                            : store
                    ));

                const targetStore = allStores.find(s =>
                    String(s.location) === String(id) ||
                    String(s.id) === String(id) ||
                    String(s.name) === String(id)
                );

                if (targetStore) {
                    const isRoomLinked = targetStore.is_room_linked === 1 || targetStore.is_room_linked === true || targetStore.is_room_linked === '1' || String(targetStore.is_room_linked).toLowerCase() === 'true';
                    setStoreInfo({ ...targetStore, is_room_linked: isRoomLinked });

                    try {
                        const menuRes = await fetch(`/api/pos-menus/${targetStore.id}`);
                        const menuData = await menuRes.json();
                        const parsedMenu = (Array.isArray(menuData) ? menuData : []).map(m => {
                            let parsedSizes = null;
                            try { parsedSizes = typeof m.sizes === 'string' ? JSON.parse(m.sizes) : m.sizes; } catch { parsedSizes = null; }
                            return { ...m, sizes: parsedSizes || [{ name: 'Regular', price: m.price }] };
                        });
                        setPosMenu(parsedMenu);
                    } catch (menuErr) {
                        console.error("Menu Fetch Error:", menuErr);
                        setPosMenu([]);
                    }
                } else {
                    setStoreInfo({ name: 'Store Not Found', id: null, is_room_linked: false });
                }
            } catch (err) {
                console.error("Store Load Error:", err);
                setStoreInfo({ name: 'Connection Error', id: null, is_room_linked: false });
            }
        };

        loadPosData();

        fetch(`/api/receipt-settings?hotel=${currentHotelCode}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.id) {
                    setReceiptConfig((prev) => mergeReceiptConfig(data, currentHotelCode, prev));
                }
            })
            .catch(e => console.error(e));
    }, [id, currentHotelCode]);

    const fetchActiveTables = () => {
        if (!storeInfo.id) return;
        fetch(`/api/tables/${storeInfo.id}?hotel=${currentHotelCode}`)
            .then(res => res.json())
            .then(data => {
                const tables = Array.isArray(data) ? data : [];
                setActiveTables(tables);

                const activeWalkIns = tables.filter(t => t.table_number.startsWith('Walk-in')).map(t => ({
                    id: t.table_number, isWalkIn: true
                }));

                setWalkInGuests(prev => {
                    const merged = [...prev];
                    activeWalkIns.forEach(aw => {
                        if (!merged.find(w => w.id === aw.id)) merged.push(aw);
                    });
                    return merged;
                });
            })
            .catch(e => console.error("Table fetch error:", e));
    };

    // 💡 [수정] 1. 화면 뷰(TABLES) 변경 시에만 테이블 데이터 갱신 (무전기와 완벽 분리)
    useEffect(() => {
        if (!isEventPosStore && activeView === 'TABLES' && storeInfo.id) {
            fetchActiveTables();
            if (storeInfo.is_room_linked) {
                fetch(`/api/rooms?hotel=${currentHotelCode}`)
                    .then(r => r.json())
                    .then(data => setHotelRooms(Array.isArray(data) ? data : []))
                    .catch(e => console.log(e));
            }
        }
    }, [activeView, currentHotelCode, isEventPosStore, storeInfo.id, storeInfo.is_room_linked]); // eslint-disable-line react-hooks/exhaustive-deps

    // 💡 [수정] 2. 무전기(웹소켓)는 화면 탭이 바뀌어도 절대 꺼지지 않도록 전역으로 켜둡니다!
    useEffect(() => {
        if (!storeInfo.id || isEventPosStore) return;

        const socketUrl = import.meta.env.VITE_API_URL || 'https://api.hotelnplus.com';
        socketRef.current = io(socketUrl, { transports: ['websocket'] });

        socketRef.current.on('db_updated', (data) => {
            if (data.hotel_code === currentHotelCode || data.hotel_code === 'ALL') {
                fetchActiveTables();
                if (storeInfo.is_room_linked) {
                    fetch(`/api/rooms?hotel=${currentHotelCode}`)
                        .then(r => r.json())
                        .then(d => setHotelRooms(Array.isArray(d) ? d : []));
                }
            }
        });

        // 💡 [신규] 고객용 태블릿에서 서명이 완료되었다는 신호를 받으면 저장
        socketRef.current.on('pos_signature_submit', (data) => {
            if (data.target_tablet === `POS-${id}`) {
                setReceivedSignature(data.signature);
            }
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [currentHotelCode, id, isEventPosStore, storeInfo.id, storeInfo.is_room_linked]); // eslint-disable-line react-hooks/exhaustive-deps

    const rawSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const vatRate = receiptConfig.vat_rate / 100;
    const serviceCharge = rawSubtotal * (receiptConfig.sc_rate / 100);

    let vatableSales = rawSubtotal / (1 + vatRate);
    let vatAmount = rawSubtotal - vatableSales;
    let discountAmount = 0;
    let scPwdDeduction = 0;
    let finalAmount = rawSubtotal + serviceCharge;

    if (isDiscountApplied && totalPax > 0 && scPwdPax > 0) {
        scPwdDeduction = (rawSubtotal / totalPax) * (0.32 / 1.12) * scPwdPax;
        finalAmount = rawSubtotal - scPwdDeduction + serviceCharge;
        discountAmount = scPwdDeduction;
    }

    // 💡 [신규] 서명이 도착하면 자동으로 룸 차지 결제를 승인하는 자동화 로직
    useEffect(() => {
        if (receivedSignature && activeView === 'ORDER') {
            const processRoomChargeWithSignature = async () => {
                const paidTotal = Math.round(finalAmount);
                const chargedRoom = hotelRooms.find((room) => String(room.id) === String(roomNumberInput));

                try {
                    await fetch('/api/folio/charge', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            room_number: roomNumberInput,
                            total_amount: paidTotal,
                            cart,
                            restaurant_id: storeInfo.id,
                            user_id: currentUser,
                            hotel_code: currentHotelCode,
                            signature: receivedSignature
                        })
                    });

                    await fetch('/api/finance/transactions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            date: getHotelDate(0),
                            type: 'REVENUE',
                            category: `POS ${id}`,
                            amount: paidTotal,
                            description: `Payment at ${storeInfo.name} - ${selectedTable} (ROOM CHARGE)`,
                            user_id: currentUser,
                            hotel_code: currentHotelCode
                        })
                    });

                    await fetch('/api/tables/clear', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ store_id: storeInfo.id, table_number: String(selectedTable), hotel_code: currentHotelCode })
                    });

                    // 💡 [핵심: 영수증 자동 발급 API 호출] 
                    await fetch('/api/receipts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            hotel_code: currentHotelCode,
                            department: `POS ${storeInfo.name}`,
                            date: getHotelDate(0),
                            amount: paidTotal,
                            guest_name: chargedRoom?.guestName || `Room ${roomNumberInput}`,
                            description: 'Room Charge (Signed)',
                            cart_data: cart,
                            user_id: currentUser
                        })
                    });

                    alert(`✅ Room Charge Confirmed & Signed successfully!`);

                    if (String(selectedTable).startsWith('Walk-in')) {
                        setWalkInGuests(prev => prev.filter(w => w.id !== selectedTable));
                    }

                    setCart([]);
                    setActiveView('TABLES');
                    fetchActiveTables();
                    setReceivedSignature(null); // 서명 데이터 초기화

                    // 결제 완료 후 고객 뷰어를 대기 화면으로 초기화
                    if (socketRef.current) {
                        socketRef.current.emit('pos_transaction_clear', { target_tablet: `POS-${id}` });
                    }
                } catch {
                    alert('Room Charge Processing Error!');
                    setReceivedSignature(null);
                }
            };

            processRoomChargeWithSignature();
        }
    }, [receivedSignature]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (activeView === 'ORDER' && socketRef.current) {
            socketRef.current.emit('pos_cart_sync', {
                target_tablet: `POS-${id}`,
                order_info: {
                    cart: cart,
                    subtotal: rawSubtotal,
                    tax: vatAmount,
                    serviceCharge: serviceCharge,
                    total: finalAmount
                }
            });
        }
    }, [cart, activeView, rawSubtotal, vatAmount, serviceCharge, finalAmount, id]);

    const handleAddWalkIn = () => {
        const newIndex = walkInGuests.length + 1;
        const newId = `Walk-in ${newIndex}`;
        setWalkInGuests([{ id: newId, isWalkIn: true }, ...walkInGuests]);
    };

    const handleOpenHistory = async () => {
        try {
            const res = await fetch(`/api/tables/history/${storeInfo.id}?hotel=${currentHotelCode}`);
            const result = await res.json();
            const dbHistoryData = Array.isArray(result) ? result : (result.history || []);

            const kdsDoneOrders = activeTables.filter(order => {
                let items = [];
                try { items = typeof order.cart_data === 'string' ? JSON.parse(order.cart_data) : order.cart_data; } catch { items = []; }
                return items.length > 0 && items.every(i => i.kdsStatus === 'Done' || i.kdsDone);
            });

            const combinedHistory = [...kdsDoneOrders, ...dbHistoryData];

            const sorted = combinedHistory.sort((a, b) => {
                const timeA = a.updated_at || a.timestamp || a.date || 0;
                const timeB = b.updated_at || b.timestamp || b.date || 0;
                return new Date(timeB) - new Date(timeA);
            });

            setHistoryData(sorted);
            setShowHistoryModal(true);
        } catch { alert("History fetch error"); }
    };

    const fetchReceiptArchive = async () => {
        if (!currentHotelCode) {
            setReceiptArchiveData([]);
            return;
        }

        setReceiptArchiveLoading(true);
        try {
            const response = await fetch(`/api/receipts?hotel=${currentHotelCode}`);
            const data = await response.json().catch(() => ([]));
            const receiptDepartment = `POS ${storeInfo.name}`;
            const nextReceipts = (Array.isArray(data) ? data : [])
                .filter((receipt) => {
                    const sourceModule = String(receipt?.source_module || '').trim().toUpperCase();
                    const department = String(receipt?.department || '').trim();
                    const receiptStoreId = String(receipt?.store_id || '').trim();
                    const receiptStoreName = String(receipt?.store_name || '').trim();

                    return department === receiptDepartment
                        || (
                            sourceModule === 'POS' && (
                                (receiptStoreId && String(storeInfo.id || '') && receiptStoreId === String(storeInfo.id || ''))
                                || (receiptStoreName && receiptStoreName === String(storeInfo.name || ''))
                            )
                        );
                })
                .sort((left, right) => (
                    String(right?.date || right?.created_at || '').localeCompare(String(left?.date || left?.created_at || ''))
                ));

            setReceiptArchiveData(nextReceipts);
        } catch (error) {
            console.error('Receipt archive fetch error:', error);
            setReceiptArchiveData([]);
        } finally {
            setReceiptArchiveLoading(false);
        }
    };

    const handleOpenReceiptArchive = async () => {
        setReceiptArchiveSearch('');
        setReceiptArchiveStartDate('');
        setReceiptArchiveEndDate('');
        setReceiptArchivePage(1);
        setSelectedReceiptRecord(null);
        setShowReceiptArchiveModal(true);
        await fetchReceiptArchive();
    };

    const filteredHistory = historyData.filter(order => {
        const timeField = order.updated_at || order.timestamp || order.date;
        if (!timeField) return false;

        const orderDate = String(timeField).substring(0, 10);
        if (historyStartDate && orderDate < historyStartDate) return false;
        if (historyEndDate && orderDate > historyEndDate) return false;
        return true;
    });

    const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_ROWS_PER_PAGE));
    const activeHistoryPage = Math.min(historyPage, historyTotalPages);
    const paginatedHistory = filteredHistory.slice(
        (activeHistoryPage - 1) * HISTORY_ROWS_PER_PAGE,
        activeHistoryPage * HISTORY_ROWS_PER_PAGE
    );
    const historyRangeStart = filteredHistory.length === 0 ? 0 : ((activeHistoryPage - 1) * HISTORY_ROWS_PER_PAGE) + 1;
    const historyRangeEnd = filteredHistory.length === 0
        ? 0
        : Math.min(activeHistoryPage * HISTORY_ROWS_PER_PAGE, filteredHistory.length);
    const filteredReceiptArchive = receiptArchiveData.filter((receipt) => {
        const receiptDate = String(receipt?.date || receipt?.created_at || '').substring(0, 10);
        const normalizedQuery = String(receiptArchiveSearch || '').trim().toLowerCase();

        if (receiptArchiveStartDate && receiptDate < receiptArchiveStartDate) return false;
        if (receiptArchiveEndDate && receiptDate > receiptArchiveEndDate) return false;
        if (!normalizedQuery) return true;

        return [
            receipt?.receipt_no,
            receipt?.guest_name,
            receipt?.description,
            receipt?.department,
            receipt?.store_name
        ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
    });
    const receiptArchiveTotalPages = Math.max(1, Math.ceil(filteredReceiptArchive.length / HISTORY_ROWS_PER_PAGE));
    const activeReceiptArchivePage = Math.min(receiptArchivePage, receiptArchiveTotalPages);
    const paginatedReceiptArchive = filteredReceiptArchive.slice(
        (activeReceiptArchivePage - 1) * HISTORY_ROWS_PER_PAGE,
        activeReceiptArchivePage * HISTORY_ROWS_PER_PAGE
    );
    const receiptArchiveRangeStart = filteredReceiptArchive.length === 0 ? 0 : ((activeReceiptArchivePage - 1) * HISTORY_ROWS_PER_PAGE) + 1;
    const receiptArchiveRangeEnd = filteredReceiptArchive.length === 0
        ? 0
        : Math.min(activeReceiptArchivePage * HISTORY_ROWS_PER_PAGE, filteredReceiptArchive.length);

    useEffect(() => {
        if (showHistoryModal) {
            setHistoryPage(1);
        }
    }, [showHistoryModal, historyStartDate, historyEndDate]);

    useEffect(() => {
        if (showReceiptArchiveModal) {
            setReceiptArchivePage(1);
        }
    }, [receiptArchiveSearch, receiptArchiveStartDate, receiptArchiveEndDate, showReceiptArchiveModal]);

    useEffect(() => {
        if (historyPage > historyTotalPages) {
            setHistoryPage(historyTotalPages);
        }
    }, [historyPage, historyTotalPages]);

    useEffect(() => {
        if (receiptArchivePage > receiptArchiveTotalPages) {
            setReceiptArchivePage(receiptArchiveTotalPages);
        }
    }, [receiptArchivePage, receiptArchiveTotalPages]);

    const handleExportHistoryPDF = () => {
        if (filteredHistory.length === 0) return alert('No data to export.');
        const doc = new jsPDF();
        doc.setFontSize(18); doc.text(`${storeInfo.name} - Order History`, 14, 22);
        doc.setFontSize(11); doc.setTextColor(100); doc.text(`Date Range: ${historyStartDate} to ${historyEndDate}`, 14, 30);
        const tableColumn = ["Date & Time", storeInfo.is_room_linked ? "Room/Guest" : "Table No.", "Order Details", "Total Amount"];
        const tableRows = [];
        filteredHistory.forEach(order => {
            let parsedCart = [];
            try { parsedCart = typeof order.cart_data === 'string' ? JSON.parse(order.cart_data) : order.cart_data; } catch { parsedCart = []; }
            const orderDetails = parsedCart.map(item => `${item.name} ${item.selectedSize !== 'Regular' ? `(${item.selectedSize})` : ''} x${item.quantity}`).join('\n');
            tableRows.push([order.updated_at, order.table_number, orderDetails, `PHP ${order.total_amount.toLocaleString()}`]);
        });
        autoTable(doc, { startY: 35, head: [tableColumn], body: tableRows, styles: { fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: [40, 40, 40] } });
        doc.save(`${storeInfo.name.replace(/ /g, '_')}_History_${historyStartDate}.pdf`);
    };

    const handleExportReceiptArchivePDF = () => {
        if (filteredReceiptArchive.length === 0) return alert('No receipts to export.');

        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`${storeInfo.name} - Receipt Archive`, 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(
            `Date Range: ${receiptArchiveStartDate || 'All'} to ${receiptArchiveEndDate || 'All'}`,
            14,
            30
        );

        autoTable(doc, {
            startY: 35,
            head: [['Date', 'OR No.', 'Guest / Ref', 'Description', 'Amount']],
            body: filteredReceiptArchive.map((receipt) => ([
                String(receipt?.date || receipt?.created_at || '').substring(0, 10) || '-',
                receipt?.receipt_no || '-',
                receipt?.guest_name || '-',
                receipt?.description || '-',
                `PHP ${Number(receipt?.amount || 0).toLocaleString()}`
            ])),
            styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
            headStyles: { fillColor: [30, 41, 59] }
        });

        doc.save(`${storeInfo.name.replace(/ /g, '_')}_Receipt_Archive.pdf`);
    };

    const handleTableClick = (tableNum, isWalkIn = false) => {
        setSelectedTable(tableNum);
        setIsDiscountApplied(false);
        const existingOrder = activeTables.find(t => t.table_number === String(tableNum));
        const isPaidOrder = String(existingOrder?.payment_status || '').toUpperCase() === 'PAID';
        if (existingOrder && !isPaidOrder) setCart(typeof existingOrder.cart_data === 'string' ? JSON.parse(existingOrder.cart_data) : existingOrder.cart_data);
        else setCart([]);

        // 워크인 방을 선택해도 입력창을 활성화하기 위해 초기화
        setRoomNumberInput(storeInfo.is_room_linked && !isWalkIn ? String(tableNum) : '');
        setActiveView('ORDER');
    };

    const handleItemClick = (item) => {
        if (item.sizes && item.sizes.length > 1) setSizeModalData(item);
        else addToCart(item, item.sizes && item.sizes.length > 0 ? item.sizes[0] : { name: 'Regular', price: item.price });
    };

    const addToCart = (item, sizeOption) => {
        const cartId = `${item.id}-${sizeOption.name}`;
        setCart(prev => {
            const existing = prev.find(i => i.cartId === cartId);
            if (existing) return prev.map(i => i.cartId === cartId ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { ...item, cartId: cartId, price: parseFloat(sizeOption.price), selectedSize: sizeOption.name, quantity: 1 }];
        });
        setSizeModalData(null);
    };

    const removeFromCart = (cartId) => {
        setCart(prev => {
            const existing = prev.find(i => i.cartId === cartId);
            if (existing && existing.quantity > 1) return prev.map(i => i.cartId === cartId ? { ...i, quantity: i.quantity - 1 } : i);
            return prev.filter(i => i.cartId !== cartId);
        });
    };

    const getItemQty = (itemId) => cart.filter(i => i.id === itemId).reduce((sum, i) => sum + i.quantity, 0);

    const handleApplyDiscount = async () => {
        const cleanId = managerId.trim();
        const cleanPwd = managerPassword.trim();

        if (!cleanId || !cleanPwd) {
            return alert('❌ Please enter both Manager ID and Password.');
        }

        try {
            const payload = {
                user_id: cleanId,
                username: cleanId,
                password: cleanPwd,
                hotel_code: currentHotelCode
            };

            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.success) {
                const role = (data.user?.role || data.role || data.employee?.role || '').toUpperCase();
                const isManagerRole = role === 'SUPER_ADMIN' || role.includes('MANAGER') || role.includes('DIRECTOR') || role.includes('ADMIN');

                if (isManagerRole) {
                    setIsDiscountApplied(true);
                    setShowDiscountModal(false);
                    setManagerId('');
                    setManagerPassword('');
                } else {
                    alert(`❌ Access Denied: This account does not have manager privileges.\n(Current Role: ${role})`);
                }
            } else {
                alert(`❌ Verification Failed: Invalid ID or Password.\n(Server Response: ${data.message || 'Unknown Error'})`);
            }
        } catch (e) {
            console.error("Manager Verification Error:", e);
            alert('❌ Network Error: Unable to connect to the server.');
        }
    };

    const handleSaveOrder = async () => {
        if (cart.length === 0) return alert('Cart is empty!');
        await fetch('/api/tables/save', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ store_id: storeInfo.id, table_number: String(selectedTable), cart_data: cart, total_amount: Math.round(finalAmount), user_id: currentUser, hotel_code: currentHotelCode })
        });
        alert(`Order for ${selectedTable} Saved & Sent to Kitchen!`);
        fetchActiveTables();
    };

    const handleMarkTableVacant = async (tableNumber, isWalkIn = false, event = null) => {
        event?.stopPropagation?.();
        try {
            const res = await fetch('/api/tables/vacate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_id: storeInfo.id, table_number: String(tableNumber), hotel_code: currentHotelCode })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.success === false) {
                throw new Error(data?.message || 'Failed to set table vacant.');
            }
            if (isWalkIn) {
                setWalkInGuests(prev => prev.filter(w => w.id !== tableNumber));
            }
            if (socketRef.current) {
                socketRef.current.emit('pos_transaction_clear', { target_tablet: `POS-${id}` });
            }
            fetchActiveTables();
        } catch {
            alert(`Unable to mark ${tableNumber} as vacant.`);
        }
    };

    // 💡 [신규 2] 결제 트랜잭션 공통 처리 함수 (코드 중복 방지 및 영수증 자동 발급)
    const executeTransactionProcessing = async (method, paidTotal) => {
        try {
            const isPointsPayment = String(method || '').toUpperCase().includes('POINT');
            const financeCategory = isPointsPayment ? `POS ${id} POINTS` : `POS ${id}`;
            const financeDescription = isPointsPayment
                ? `Payment at ${storeInfo.name} - ${selectedTable} (${method}) [REWARD POINTS]`
                : `Payment at ${storeInfo.name} - ${selectedTable} (${method})`;

            await fetch('/api/finance/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: getHotelDate(0),
                    type: 'REVENUE',
                    category: financeCategory,
                    amount: paidTotal,
                    description: financeDescription,
                    user_id: currentUser,
                    hotel_code: currentHotelCode
                })
            });

            await fetch('/api/tables/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_id: storeInfo.id, table_number: String(selectedTable), hotel_code: currentHotelCode })
            });

            // 💡 [핵심: 영수증 자동 발급 API 호출 및 서버 생성 번호 수신]
            const receiptRes = await fetch('/api/receipts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hotel_code: currentHotelCode,
                    department: `POS ${storeInfo.name}`,
                    source_module: 'POS',
                    store_id: storeInfo.id,
                    store_name: storeInfo.name,
                    date: getHotelDate(0),
                    amount: paidTotal,
                    guest_name: String(selectedTable).startsWith('Walk-in') ? 'Walk-in Guest' : `Table ${selectedTable}`,
                    description: isPointsPayment ? `Payment via ${method} (Reward Points)` : `Payment via ${method}`,
                    cart_data: cart,
                    user_id: currentUser
                })
            });
            const receiptData = await receiptRes.json(); // 서버가 응답한 영수증 정보 (receiptData.receipt_no)
            setPaymentSuccessData({
                method: String(method || '').toUpperCase(),
                amount: paidTotal,
                receiptNo: receiptData?.receipt_no || '',
                table: String(selectedTable || ''),
                store: storeInfo.name || `POS ${id}`,
                pointsUsed: Number(rewardQrResult?.points_used || qrPaymentData?.points_used || 0)
            });

            if (String(selectedTable).startsWith('Walk-in')) {
                setWalkInGuests(prev => prev.filter(w => w.id !== selectedTable));
            }

            setCart([]); fetchActiveTables();

            if (socketRef.current) {
                if ((method === 'QR' || method === 'POINTS_QR') && receiptData.success) {
                    // QR 결제일 경우, 방금 서버가 생성해준 '진짜 영수증 번호'를 뷰어에 띄워줍니다!
                    socketRef.current.emit('pos_qr_receipt', { target_tablet: `POS-${id}`, receipt_url: receiptData.receipt_no });
                } else {
                    // 일반 현금/카드 결제일 경우 대기 화면으로 초기화
                    socketRef.current.emit('pos_transaction_clear', { target_tablet: `POS-${id}` });
                }
            }
        } catch { alert('Payment Error!'); }
    };

    useEffect(() => {
        if (!qrPaymentData?.token || qrPaymentData?.status === 'PAID') return;
        let cancelled = false;
        const pollRewardPayment = async () => {
            try {
                const res = await fetch(`/api/pos/rewards/payment-intents/${encodeURIComponent(qrPaymentData.token)}?hotel_code=${encodeURIComponent(currentHotelCode)}`);
                const data = await res.json().catch(() => ({}));
                const intent = data?.intent;
                if (!res.ok || !intent || cancelled) return;
                const status = String(intent.status || '').toUpperCase();
                if (status === 'PAID') {
                    if (rewardQrPaidNotifiedRef.current) return;
                    rewardQrPaidNotifiedRef.current = true;
                    const paidAmount = Math.round(Number(intent.currency_amount || intent.amount || qrPaymentData.amount || 0));
                    setRewardQrResult({
                        token: intent.token,
                        points_used: intent.points_used,
                        value_amount: paidAmount,
                        email: intent.email
                    });
                    setQrPaymentData(prev => ({
                        ...(prev || {}),
                        status: 'PAID',
                        amount: paidAmount,
                        points_used: intent.points_used,
                        email: intent.email
                    }));
                    await executeTransactionProcessing('POINTS_QR', paidAmount);
                    if (!cancelled) setQrPaymentData(null);
                } else if (status === 'EXPIRED') {
                    setQrPaymentData(prev => ({ ...(prev || {}), status: 'EXPIRED' }));
                    alert('Reward points QR payment expired. Please create a new QR.');
                }
            } catch (err) {
                console.error('Reward points QR polling failed:', err);
            }
        };
        pollRewardPayment();
        const timer = setInterval(pollRewardPayment, 2500);
        return () => { cancelled = true; clearInterval(timer); };
    }, [qrPaymentData?.token, qrPaymentData?.method, qrPaymentData?.status, currentHotelCode]); // eslint-disable-line react-hooks/exhaustive-deps

    const createRewardQrPreview = async (amountOverride) => {
        const valueAmount = Math.round(Number(amountOverride || finalAmount || 0));
        if (valueAmount <= 0) throw new Error('Amount must be greater than zero.');
        try {
            setRewardQrPreviewLoading(true);
            const res = await fetch('/api/pos/rewards/payment-intents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hotel_code: currentHotelCode,
                    amount: valueAmount,
                    store_id: String(storeInfo.id || id || ''),
                    store_name: storeInfo.name || `POS ${id}`,
                    table_number: String(selectedTable || '')
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) throw new Error(data?.message || `HTTP ${res.status}`);
            setRewardQrPreview({
                amount: valueAmount,
                token: data.token,
                qr_image_url: data.qr_image_url,
                payment_url: data.payment_url,
                status: 'PENDING'
            });
            setRewardQrToken(data.token || '');
            return data;
        } finally {
            setRewardQrPreviewLoading(false);
        }
    };
    const resetQrModalState = () => {
        setQrPaymentData(null);
        setRewardQrToken('');
        setRewardQrResult(null);
        setRewardQrPreview(null);
        rewardQrPaidNotifiedRef.current = false;
        if (socketRef.current) socketRef.current.emit('pos_transaction_clear', { target_tablet: `POS-${id}` });
    };

    const handlePayment = async (method) => {
        if (cart.length === 0) return alert('Cart is empty!');

        const paidTotal = Math.round(finalAmount);

        if (method === 'ROOM') {
            if (!roomNumberInput) return alert('Please enter Room Number for Room Charge.');
            // 💡 [신규 3] 워크인 방지 로직 완전 제거. 이제 워크인도 호실만 입력하면 룸 차지 가능.
            if (socketRef.current) {
                socketRef.current.emit('pos_signature_request', {
                    target_tablet: `POS-${id}`,
                    room_number: roomNumberInput,
                    guest_name: 'Guest',
                    order_info: { cart, subtotal: rawSubtotal, tax: vatAmount, serviceCharge, total: finalAmount }
                });
                alert("Signature screen displayed on the customer tablet. Please wait for the guest's signature.");
            }
            return;
        }

        if (method === 'POINTS_QR') {
            try {
                const res = await fetch('/api/pos/rewards/payment-intents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        hotel_code: currentHotelCode,
                        amount: paidTotal,
                        store_id: String(storeInfo.id || id || ''),
                        store_name: storeInfo.name || `POS ${id}`,
                        table_number: String(selectedTable || '')
                    })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data?.success) throw new Error(data?.message || `HTTP ${res.status}`);

                const nextQrData = {
                    amount: paidTotal,
                    method: 'POINTS_QR',
                    status: 'PENDING',
                    token: data.token,
                    qr_image_url: data.qr_image_url,
                    payment_url: data.payment_url
                };
                setQrPaymentData(nextQrData);
                setRewardQrToken(data.token || '');
                setRewardQrResult(null);

                if (socketRef.current) {
                    socketRef.current.emit('pos_qr_request', {
                        target_tablet: `POS-${id}`,
                        total_amount: paidTotal,
                        store_name: storeInfo.name,
                        payment_method: 'POINTS_QR',
                        qr_image_url: data.qr_image_url,
                        payment_url: data.payment_url,
                        token: data.token
                    });
                }
            } catch (err) {
                alert(`Failed to create reward points QR: ${err.message || 'unknown error'}`);
            }
            return;
        }

                // 💡 [신규 4] QR 결제 처리: 일반 QR과 포인트 QR을 구분하지 않고 단일 QR 흐름으로 운영
        if (method === 'QR') {
            if (!socketRef.current) {
                alert("Not connected to the Customer Viewer tablet.");
                return;
            }

            setRewardQrResult(null);
            rewardQrPaidNotifiedRef.current = false;

            try {
                const preview = await createRewardQrPreview(paidTotal);
                const nextQrData = {
                    amount: paidTotal,
                    method: 'QR',
                    status: 'PENDING',
                    token: preview?.token || '',
                    qr_image_url: preview?.qr_image_url || '',
                    payment_url: preview?.payment_url || ''
                };

                setQrPaymentData(nextQrData);
                setRewardQrToken(preview?.token || '');

                socketRef.current.emit('pos_qr_request', {
                    target_tablet: `POS-${id}`,
                    total_amount: paidTotal,
                    store_name: storeInfo.name,
                    payment_method: 'QR',
                    token: preview?.token || '',
                    qr_image_url: preview?.qr_image_url || '',
                    payment_url: preview?.payment_url || ''
                });
            } catch (err) {
                console.error('Unified QR preview create failed:', err);
                alert(`Failed to create QR payment: ${err.message || 'unknown error'}`);
            }
            return;
        }

        // 현금/카드 처리
        executeTransactionProcessing(method, paidTotal);
    };

    const handlePrintReceipt = async () => {
        if (cart.length === 0) return alert('No items to print.');
        const formatReceiptMoney = (amount) => `₱${Number(amount || 0).toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
        const escapePrintHtml = (value = '') => String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const printedAt = new Date().toLocaleString('en-PH', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        const guestReference = String(selectedTable).startsWith('Walk-in')
            ? 'Walk-in Guest'
            : `${storeInfo.is_room_linked ? 'Room' : 'Table'} ${selectedTable}`;
        const businessInfoLine = [
            receiptConfig.business_no ? `BIZ: ${receiptConfig.business_no}` : '',
            receiptConfig.tax_id ? `TIN: ${receiptConfig.tax_id}` : ''
        ].filter(Boolean).join(' | ');
        const itemRows = cart.map((item) => {
            const quantity = Number(item.quantity || 1);
            const lineTotal = Number(item.price || 0) * quantity;
            return {
                label: `${item.name}${item.selectedSize && item.selectedSize !== 'Regular' ? ` (${item.selectedSize})` : ''}`,
                quantity,
                lineTotal
            };
        });
        const summaryRows = [
            { label: 'Subtotal', value: formatReceiptMoney(rawSubtotal) },
            ...(
                isDiscountApplied
                    ? [{ label: 'SC/PWD Deduction', value: `-${formatReceiptMoney(discountAmount)}` }]
                    : [{ label: `VAT (${receiptConfig.vat_rate}%)`, value: formatReceiptMoney(vatAmount) }]
            ),
            { label: `Service Charge (${receiptConfig.sc_rate}%)`, value: formatReceiptMoney(serviceCharge) }
        ];
        const receiptText = [
            String(receiptConfig.header_text || currentHotelCode || 'HOTEL').toUpperCase(),
            receiptConfig.address || '',
            businessInfoLine || '',
            '--------------------------------',
            'POS DRAFT RECEIPT',
            'OR Number (Serial): PENDING',
            `Date: ${printedAt}`,
            `Issued By: POS ${storeInfo.name || id}`,
            `Guest/Ref: ${guestReference}`,
            '--------------------------------',
            ...itemRows.flatMap((item) => [
                item.label,
                `  x${item.quantity} ${formatReceiptMoney(item.lineTotal)}`
            ]),
            '--------------------------------',
            ...summaryRows.map((row) => `${row.label}: ${row.value}`),
            `TOTAL: ${formatReceiptMoney(finalAmount)}`,
            '--------------------------------',
            receiptConfig.footer_text || 'Thank you for choosing us!'
        ].filter(Boolean).join('\n');

        try {
            const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] });
            const server = await device.gatt.connect();
            const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
            const encoder = new TextEncoder();
            const data = encoder.encode(receiptText);
            const CHUNK_SIZE = 100;
            for (let i = 0; i < data.length; i += CHUNK_SIZE) await characteristic.writeValue(data.slice(i, i + CHUNK_SIZE));
            alert('🖨️ Receipt printed via Bluetooth successfully!');
        } catch {
            const logoMarkup = receiptConfig.logo_url
                ? `<img class="logo" src="${escapePrintHtml(receiptConfig.logo_url)}" alt="Logo" />`
                : `<div class="fallback-logo">n<span>+</span></div>`;
            const receiptItemsMarkup = itemRows.map((item) => `
                <div class="item-row">
                    <span class="item-label">${escapePrintHtml(item.label)}</span>
                    <span class="item-total">x${item.quantity} ${escapePrintHtml(formatReceiptMoney(item.lineTotal))}</span>
                </div>
            `).join('');
            const summaryMarkup = summaryRows.map((row) => `
                <div class="summary-row">
                    <span>${escapePrintHtml(row.label)}</span>
                    <span>${escapePrintHtml(row.value)}</span>
                </div>
            `).join('');
            const printContent = `
            <!doctype html>
            <html>
                <head>
                    <meta charset="utf-8" />
                    <title>Receipt</title>
                    <style>
                        @page { size: 80mm auto; margin: 0; }
                        html, body { margin: 0; padding: 0; background: #ffffff; }
                        body {
                            color: #0f172a;
                            font-family: "Courier New", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                        }
                        .page {
                            width: 80mm;
                            margin: 0 auto;
                            padding: 2mm 0;
                        }
                        .receipt {
                            width: 72mm;
                            margin: 0 auto;
                            border-top: 4mm solid #cbd5e1;
                            background: #ffffff;
                            padding: 6mm 5mm 7mm;
                            clip-path: polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 5px) 100%, calc(100% - 10px) calc(100% - 10px), calc(100% - 15px) 100%, calc(100% - 20px) calc(100% - 10px), calc(100% - 25px) 100%, calc(100% - 30px) calc(100% - 10px), calc(100% - 35px) 100%, calc(100% - 40px) calc(100% - 10px), calc(100% - 45px) 100%, 0 calc(100% - 10px));
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                            box-sizing: border-box;
                        }
                        .header {
                            margin-bottom: 6mm;
                            text-align: center;
                        }
                        .logo {
                            width: 16mm;
                            height: 16mm;
                            margin: 0 auto 3mm;
                            object-fit: contain;
                            filter: grayscale(1);
                        }
                        .fallback-logo {
                            margin-bottom: 3mm;
                            color: #64748b;
                            font-size: 18mm;
                            font-weight: 700;
                            line-height: 1;
                        }
                        .fallback-logo span {
                            font-size: 10mm;
                        }
                        .brand {
                            margin-bottom: 1mm;
                            font-size: 4.8mm;
                            font-weight: 700;
                            letter-spacing: 0.08em;
                            text-transform: uppercase;
                        }
                        .subtle {
                            color: #64748b;
                            font-size: 2.6mm;
                            line-height: 1.5;
                        }
                        .meta {
                            margin-bottom: 4mm;
                            border-top: 0.3mm dashed #cbd5e1;
                            border-bottom: 0.3mm dashed #cbd5e1;
                            padding: 3mm 0;
                        }
                        .meta-row, .item-row, .summary-row, .total-row {
                            display: flex;
                            align-items: flex-start;
                            justify-content: space-between;
                            gap: 3mm;
                        }
                        .meta-row + .meta-row,
                        .item-row + .item-row,
                        .summary-row + .summary-row {
                            margin-top: 1.6mm;
                        }
                        .meta-label {
                            font-weight: 700;
                        }
                        .or-value {
                            background: #eff6ff;
                            color: #2563eb;
                            font-style: italic;
                            font-weight: 700;
                            padding: 0 1mm;
                        }
                        .item-list {
                            margin-bottom: 5mm;
                        }
                        .item-label {
                            flex: 1;
                            padding-right: 2mm;
                            word-break: break-word;
                        }
                        .item-total {
                            white-space: nowrap;
                            font-weight: 700;
                            text-align: right;
                        }
                        .summary {
                            border-top: 0.3mm dashed #cbd5e1;
                            padding-top: 3mm;
                            color: #475569;
                            font-size: 2.8mm;
                        }
                        .total-row {
                            margin-top: 2.5mm;
                            border-top: 0.3mm solid #e2e8f0;
                            padding-top: 2.5mm;
                            color: #0f172a;
                            font-size: 5.2mm;
                            font-weight: 700;
                        }
                        .footer {
                            padding-top: 6mm;
                            text-align: center;
                            color: #94a3b8;
                            font-size: 2.6mm;
                            white-space: pre-wrap;
                        }
                        .barcode {
                            margin-top: 4mm;
                            color: #cbd5e1;
                            font-size: 2.2mm;
                            font-weight: 700;
                            letter-spacing: 0.28em;
                        }
                    </style>
                </head>
                <body>
                    <div class="page">
                        <div class="receipt">
                            <div class="header">
                                ${logoMarkup}
                                <div class="brand">${escapePrintHtml(receiptConfig.header_text || currentHotelCode || 'HOTEL')}</div>
                                <div class="subtle">${escapePrintHtml(receiptConfig.address || '')}</div>
                                <div class="subtle" style="font-weight: 700; text-transform: uppercase;">${escapePrintHtml(businessInfoLine || '')}</div>
                            </div>

                            <div class="meta">
                                <div class="meta-row">
                                    <span class="meta-label">OR Number (Serial):</span>
                                    <span class="or-value">PENDING</span>
                                </div>
                                <div class="meta-row">
                                    <span>Date:</span>
                                    <span>${escapePrintHtml(printedAt)}</span>
                                </div>
                                <div class="meta-row">
                                    <span>Issued By:</span>
                                    <span>${escapePrintHtml(`POS ${storeInfo.name || id}`)}</span>
                                </div>
                                <div class="meta-row">
                                    <span>Guest/Ref:</span>
                                    <span>${escapePrintHtml(guestReference)}</span>
                                </div>
                            </div>

                            <div class="item-list">
                                ${receiptItemsMarkup}
                            </div>

                            <div class="summary">
                                ${summaryMarkup}
                                <div class="total-row">
                                    <span>TOTAL :</span>
                                    <span>${escapePrintHtml(formatReceiptMoney(finalAmount))}</span>
                                </div>
                            </div>

                            <div class="footer">
                                ${escapePrintHtml(receiptConfig.footer_text || 'Thank you for choosing us!')}
                                <div class="barcode">|| |||| ||| |||| || |||| || ||||</div>
                            </div>
                        </div>
                    </div>
                    <script>
                        window.onload = () => {
                            window.print();
                            window.close();
                        };
                    </script>
                </body>
            </html>
        `;
            const printWindow = window.open('', '', 'width=420,height=860');
            if (!printWindow) {
                alert('Print preview popup was blocked. Please allow popups and try again.');
                return;
            }
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
        }
    };

    const categories = ['All', ...new Set(posMenu.map(item => item.category))].filter(Boolean);
    const filteredMenu = activeCategory === 'All' ? posMenu : posMenu.filter(m => m.category === activeCategory);
    const currentTableCount = storeInfo.table_count || 25;

    if (isEventPosStore) {
        return (
            <EventPos
                currentHotelCode={currentHotelCode}
                currentUser={currentUser}
                posMenu={posMenu}
                receiptConfig={receiptConfig}
                storeInfo={storeInfo}
            />
        );
    }

    // ========================================================
    // 💡 뷰 1: 메인 대시보드 (TABLES VIEW)
    // ========================================================
    if (activeView === 'TABLES') {
        return (
            <div className="flex flex-col h-screen bg-slate-100 font-sans p-4 md:p-8 overflow-hidden">
                {selectedReceiptRecord && (
                    <ReceiptViewerModal
                        receipt={selectedReceiptRecord}
                        receiptConfig={receiptConfig}
                        hotelLabel={currentHotelCode || 'SAMPLE HOTEL INC.'}
                        fallbackDepartment={`POS ${storeInfo.name || id}`}
                        fileNamePrefix="pos_receipt"
                        onClose={() => setSelectedReceiptRecord(null)}
                    />
                )}

                {showReceiptArchiveModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-white rounded-[2rem] shadow-2xl p-6 md:p-8 w-full max-w-6xl h-[90vh] md:h-[86vh] flex flex-col border border-slate-200">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6 shrink-0">
                                <div>
                                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-500">Receipt Archive</div>
                                    <h3 className="mt-2 text-2xl md:text-3xl font-black text-slate-900">Search issued POS receipts</h3>
                                    <p className="mt-2 text-sm text-slate-500">Only receipts issued from this POS store are listed here.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setReceiptArchiveSearch('');
                                            setReceiptArchiveStartDate('');
                                            setReceiptArchiveEndDate('');
                                            setReceiptArchivePage(1);
                                        }}
                                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
                                    >
                                        Reset Filters
                                    </button>
                                    <button
                                        type="button"
                                        onClick={fetchReceiptArchive}
                                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
                                    >
                                        {receiptArchiveLoading ? 'Refreshing...' : 'Refresh Receipts'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleExportReceiptArchivePDF}
                                        className="rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-bold text-blue-600 hover:bg-blue-50"
                                    >
                                        Export PDF
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowReceiptArchiveModal(false);
                                            setSelectedReceiptRecord(null);
                                        }}
                                        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr),160px,160px,auto] shrink-0">
                                <input
                                    type="search"
                                    value={receiptArchiveSearch}
                                    onChange={(event) => setReceiptArchiveSearch(event.target.value)}
                                    placeholder="Search OR no., guest, description, or department"
                                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                                />
                                <input
                                    type="date"
                                    value={receiptArchiveStartDate}
                                    onChange={(event) => setReceiptArchiveStartDate(event.target.value)}
                                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                                />
                                <input
                                    type="date"
                                    value={receiptArchiveEndDate}
                                    onChange={(event) => setReceiptArchiveEndDate(event.target.value)}
                                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                                />
                                <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700">
                                    {receiptArchiveLoading ? 'Loading...' : `${filteredReceiptArchive.length} rows`}
                                </div>
                            </div>

                            <div className="mt-5 flex-1 overflow-auto rounded-[1.5rem] border border-slate-200 bg-slate-50">
                                <table className="min-w-[920px] w-full text-left text-sm">
                                    <thead className="sticky top-0 z-10 bg-slate-900 text-white">
                                        <tr>
                                            <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.24em]">Date</th>
                                            <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.24em]">OR No.</th>
                                            <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.24em]">Guest / Ref</th>
                                            <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.24em]">Department</th>
                                            <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.24em]">Description</th>
                                            <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.24em]">Amount</th>
                                            <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.24em]">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {paginatedReceiptArchive.length > 0 ? (
                                            paginatedReceiptArchive.map((receipt) => (
                                                <tr key={receipt?.id || receipt?.receipt_no} className="hover:bg-sky-50/60">
                                                    <td className="px-4 py-4 font-bold text-slate-600">{String(receipt?.date || receipt?.created_at || '').substring(0, 10) || '-'}</td>
                                                    <td className="px-4 py-4 font-black text-sky-700">{receipt?.receipt_no || '-'}</td>
                                                    <td className="px-4 py-4 font-semibold text-slate-800">{receipt?.guest_name || '-'}</td>
                                                    <td className="px-4 py-4 text-slate-500">{receipt?.department || '-'}</td>
                                                    <td className="px-4 py-4 text-slate-500">{receipt?.description || '-'}</td>
                                                    <td className="px-4 py-4 text-right font-black text-slate-900">PHP {Number(receipt?.amount || 0).toLocaleString()}</td>
                                                    <td className="px-4 py-4 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedReceiptRecord(receipt)}
                                                            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                                                        >
                                                            View Receipt
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-14 text-center text-sm font-bold text-slate-400">
                                                    {receiptArchiveLoading ? 'Loading receipt archive...' : 'No POS receipts matched the current filters.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-xs md:text-sm font-bold text-slate-500">
                                    Showing {receiptArchiveRangeStart}-{receiptArchiveRangeEnd} of {filteredReceiptArchive.length}
                                    <span className="mx-2 text-slate-300">•</span>
                                    Rows per page: {HISTORY_ROWS_PER_PAGE}
                                </div>
                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <button
                                        onClick={() => setReceiptArchivePage(prev => Math.max(1, prev - 1))}
                                        disabled={activeReceiptArchivePage === 1}
                                        className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 transition-colors enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Previous
                                    </button>
                                    <div className="rounded-md bg-slate-900 px-4 py-2 text-sm font-black text-white">
                                        {activeReceiptArchivePage} / {receiptArchiveTotalPages}
                                    </div>
                                    <button
                                        onClick={() => setReceiptArchivePage(prev => Math.min(receiptArchiveTotalPages, prev + 1))}
                                        disabled={activeReceiptArchivePage === receiptArchiveTotalPages}
                                        className="rounded-md bg-sky-500 px-4 py-2 text-sm font-bold text-white transition-colors enabled:hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showHistoryModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-white rounded-[2rem] shadow-2xl p-6 md:p-8 w-full max-w-5xl h-[90vh] md:h-[85vh] flex flex-col border border-slate-200">
                            <div className="flex justify-between items-center mb-6 shrink-0">
                                <h3 className="text-xl md:text-3xl font-black text-slate-800 flex items-center gap-2 md:gap-3"><span>📜</span> Order History</h3>
                                <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-red-500 font-bold text-xl md:text-2xl transition-colors bg-slate-100 hover:bg-red-50 w-8 h-8 md:w-10 md:h-10 rounded-md flex items-center justify-center">✕</button>
                            </div>
                            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 md:gap-4 mb-6 bg-slate-50 p-4 rounded-md border border-slate-200 shrink-0">
                                <div className="w-full sm:w-auto flex-1">
                                    <label className="text-[10px] md:text-xs font-bold text-slate-500 block mb-1">Start Date</label>
                                    <input type="date" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)} className="w-full p-2.5 md:p-3 border border-slate-300 rounded-md font-bold text-slate-700 bg-white shadow-sm focus:outline-none focus:border-blue-400 text-sm" />
                                </div>
                                <span className="hidden sm:block text-slate-400 font-black mb-3">~</span>
                                <div className="w-full sm:w-auto flex-1">
                                    <label className="text-[10px] md:text-xs font-bold text-slate-500 block mb-1">End Date</label>
                                    <input type="date" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)} className="w-full p-2.5 md:p-3 border border-slate-300 rounded-md font-bold text-slate-700 bg-white shadow-sm focus:outline-none focus:border-blue-400 text-sm" />
                                </div>
                                <div className="w-full sm:w-auto ml-0 sm:ml-auto flex items-center gap-2 md:gap-3 mt-2 sm:mt-0">
                                    <div className="flex-1 sm:flex-none text-xs md:text-sm font-bold text-slate-500 bg-white px-3 md:px-4 py-2.5 md:py-3 border rounded-md shadow-sm text-center">
                                        Found: <span className="text-blue-600">{filteredHistory.length}</span>
                                    </div>
                                    <button onClick={handleExportHistoryPDF} className="flex-1 sm:flex-none bg-red-600 hover:bg-red-500 text-white px-4 md:px-5 py-2.5 md:py-3 rounded-md font-bold shadow-sm flex items-center justify-center gap-1 md:gap-2 transition-colors text-sm md:text-base">
                                        <span>📄</span> Export
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-x-auto overflow-y-auto border border-slate-200 rounded-md shadow-inner bg-slate-50 p-2">
                                <table className="w-full text-left text-sm whitespace-nowrap min-w-[500px]">
                                    <thead className="bg-white sticky top-0 shadow-sm z-10 rounded-md">
                                        <tr>
                                            <th className="p-3 md:p-4 rounded-tl-xl text-slate-500 font-bold uppercase tracking-wider text-xs md:text-sm">Date & Time</th>
                                            <th className="p-3 md:p-4 text-slate-500 font-bold uppercase tracking-wider text-xs md:text-sm">{storeInfo.is_room_linked ? 'Room/Guest' : 'Table'} No.</th>
                                            <th className="p-3 md:p-4 text-slate-500 font-bold uppercase tracking-wider text-xs md:text-sm">Ordered Items</th>
                                            <th className="p-3 md:p-4 text-right rounded-tr-xl text-slate-500 font-bold uppercase tracking-wider text-xs md:text-sm">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {filteredHistory.length === 0 ? (
                                            <tr><td colSpan="4" className="text-center py-10 md:py-20 text-slate-400 font-bold text-sm md:text-lg">No past orders found for this date range.</td></tr>
                                        ) : (
                                            paginatedHistory.map((order, idx) => {
                                                let parsedCart = [];
                                                try { parsedCart = typeof order.cart_data === 'string' ? JSON.parse(order.cart_data) : order.cart_data; } catch { parsedCart = []; }
                                                return (
                                                    <tr key={order.id || idx} className="hover:bg-blue-50/50 transition-colors bg-white">
                                                        <td className="p-3 md:p-4 font-mono text-slate-600 text-xs md:text-sm">{order.updated_at}</td>
                                                        <td className="p-3 md:p-4 font-black text-base md:text-lg text-slate-800">{order.table_number}</td>
                                                        <td className="p-3 md:p-4 whitespace-normal min-w-[200px]">
                                                            <ul className="text-xs md:text-sm text-slate-600 space-y-1">
                                                                {parsedCart.map((item) => (
                                                                    <li key={`${order.id || idx}-${item.name}-${item.selectedSize || 'Regular'}-${item.quantity}`} className="flex gap-2 items-center flex-wrap">
                                                                        <span className="font-bold">{item.name}</span>
                                                                        {item.selectedSize !== 'Regular' && <span className="text-[9px] md:text-[10px] bg-slate-200 px-1 rounded text-slate-500">{item.selectedSize}</span>}
                                                                        <span className="text-blue-500 font-black">x{item.quantity}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </td>
                                                        <td className="p-3 md:p-4 text-right font-black text-blue-600 text-base md:text-lg">₱{order.total_amount.toLocaleString()}</td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-xs md:text-sm font-bold text-slate-500">
                                    Showing {historyRangeStart}-{historyRangeEnd} of {filteredHistory.length}
                                    <span className="mx-2 text-slate-300">•</span>
                                    Rows per page: {HISTORY_ROWS_PER_PAGE}
                                </div>
                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <button
                                        onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                                        disabled={activeHistoryPage === 1}
                                        className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 transition-colors enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Previous
                                    </button>
                                    <div className="rounded-md bg-slate-900 px-4 py-2 text-sm font-black text-white">
                                        {activeHistoryPage} / {historyTotalPages}
                                    </div>
                                    <button
                                        onClick={() => setHistoryPage(prev => Math.min(historyTotalPages, prev + 1))}
                                        disabled={activeHistoryPage === historyTotalPages}
                                        className="rounded-md bg-blue-400 px-4 py-2 text-sm font-bold text-white transition-colors enabled:hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 bg-white p-4 md:p-6 rounded-md shadow-sm border border-slate-200 gap-4 md:gap-0 shrink-0">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black text-slate-800 flex items-center gap-2 md:gap-3">
                            {storeInfo.is_room_linked ? '🏨' : '🍽️'} {storeInfo.name}
                        </h1>
                        <p className="text-slate-500 font-bold mt-1 tracking-widest uppercase text-[10px] md:text-sm">
                            {storeInfo.is_room_linked ? 'Hotel Room Guest Service' : `Table Management (POS ${id})`}
                        </p>
                    </div>

                    <div className="flex flex-wrap md:flex-nowrap gap-2 md:gap-4 w-full md:w-auto">
                        {storeInfo.is_room_linked ? (
                            <button onClick={handleAddWalkIn} className="flex-1 md:flex-none justify-center bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 md:px-6 py-2.5 md:py-3 rounded-md font-black hover:bg-emerald-100 shadow-sm flex items-center gap-1.5 md:gap-2 transition-colors text-xs md:text-base">
                                ➕ Add Walk-in
                            </button>
                        ) : null}

                        <button onClick={handleOpenHistory} className="flex-1 md:flex-none justify-center bg-blue-50 text-blue-700 border border-blue-200 px-4 md:px-6 py-2.5 md:py-3 rounded-md font-bold hover:bg-blue-100 shadow-sm flex items-center gap-1.5 md:gap-2 transition-colors text-xs md:text-base">
                            <span>📜</span> History
                        </button>
                        <button onClick={handleOpenReceiptArchive} className="flex-1 md:flex-none justify-center bg-amber-50 text-amber-700 border border-amber-200 px-4 md:px-6 py-2.5 md:py-3 rounded-md font-bold hover:bg-amber-100 shadow-sm flex items-center gap-1.5 md:gap-2 transition-colors text-xs md:text-base">
                            <span>🧾</span> Receipt Storage
                        </button>
                        <button onClick={fetchActiveTables} className="flex-1 md:flex-none justify-center bg-slate-100 border border-slate-300 px-4 md:px-6 py-2.5 md:py-3 rounded-md font-bold text-slate-700 hover:bg-slate-200 text-xs md:text-base">🔄 Refresh</button>
                        <Link to="/" className="w-full md:w-auto text-center bg-slate-900 text-white px-6 md:px-8 py-2.5 md:py-3 rounded-md font-bold hover:bg-slate-800 shadow-md text-xs md:text-base">Exit POS</Link>
                    </div>
                </div>

                <div className="bg-white flex-1 rounded-md shadow-sm border border-slate-200 p-4 md:p-8 overflow-y-auto">
                    {storeInfo.is_room_linked ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">

                            {/* 💡 워크인 게스트 (Walk-in) */}
                            {walkInGuests.map(walkIn => {
                                const hasOrder = activeTables.find(t => t.table_number === walkIn.id);
                                const isPaidOrder = String(hasOrder?.payment_status || '').toUpperCase() === 'PAID';
                                let pendingItems = [];
                                if (hasOrder) {
                                    try { pendingItems = typeof hasOrder.cart_data === 'string' ? JSON.parse(hasOrder.cart_data) : hasOrder.cart_data; } catch { pendingItems = []; }
                                }
                                return (
                                    <div key={walkIn.id} onClick={() => handleTableClick(walkIn.id, true)}
                                        className={`relative p-4 md:p-5 rounded-md border-2 flex flex-col justify-start transition-all min-h-[160px] md:min-h-[180px] cursor-pointer hover:-translate-y-1 shadow-md bg-emerald-50 border-emerald-200 ${hasOrder ? (isPaidOrder ? 'ring-4 ring-emerald-300 border-emerald-400 bg-emerald-50' : 'ring-4 ring-orange-400 border-orange-400 bg-orange-50') : ''}`}>
                                        <div className="flex justify-between items-start mb-1 md:mb-2">
                                            <span className="text-xl md:text-2xl font-black text-emerald-700 truncate pr-2">{walkIn.id}</span>
                                            {hasOrder ? (
                                                isPaidOrder ? (
                                                    <span className="text-[10px] md:text-xs font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200 mt-1">✅ PAID</span>
                                                ) : (
                                                    <span className="bg-orange-100 px-1.5 py-0.5 rounded text-orange-800 text-[10px] md:text-xs font-bold">₱{hasOrder.total_amount.toLocaleString()}</span>
                                                )
                                            ) : null}
                                        </div>
                                        <div>
                                            <div className="text-[10px] md:text-xs font-bold mb-0.5 md:mb-1 text-emerald-600">👤 WALK-IN GUEST</div>
                                        </div>
                                        {hasOrder && !isPaidOrder && pendingItems.length > 0 && (
                                            <div className="mt-2 bg-white p-2 rounded-md border border-orange-200 text-[10px] md:text-xs shadow-inner flex-1 flex flex-col overflow-hidden max-h-[150px]">
                                                <div className="font-bold text-orange-700 border-b border-orange-100 pb-1 mb-1.5 shrink-0 flex justify-between items-center">
                                                    <span>🛎️ Order Status</span>
                                                    <span className="bg-orange-100 px-1.5 py-0.5 rounded text-orange-800">₱{hasOrder.total_amount.toLocaleString()}</span>
                                                </div>
                                                <div className="overflow-y-auto scrollbar-hide pr-1 space-y-1.5 flex-1">
                                                    {pendingItems.map((pi, idx) => {
                                                        const status = pi.kdsStatus || (pi.kdsDone ? 'Done' : 'Pending');
                                                        return (
                                                            <div key={idx} className="flex justify-between items-start bg-slate-50 p-1.5 rounded-md border border-slate-100">
                                                                <div className="flex-1 pr-1 min-w-0 text-left">
                                                                    <div className="font-bold text-slate-700 truncate text-[10px] sm:text-xs">{pi.name} {pi.selectedSize && pi.selectedSize !== 'Regular' ? `(${pi.selectedSize})` : ''}</div>
                                                                    <div className={`inline-block mt-0.5 text-[8px] font-black px-1.5 py-0.5 rounded border ${getStatusBadge(status)}`}>{status}</div>
                                                                </div>
                                                                <div className="font-black text-orange-600 shrink-0 text-xs mt-0.5">x{pi.quantity}</div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {hasOrder && isPaidOrder && (
                                            <div className="mt-3">
                                                <button
                                                    onClick={(event) => handleMarkTableVacant(walkIn.id, true, event)}
                                                    className="w-full rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs md:text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                                                >
                                                    Mark Vacant
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* 💡 호텔 객실 (Hotel Rooms) */}
                            {hotelRooms.map(room => {
                                const isOccupied = room.status === 'OCCUPIED';
                                const hasOrder = activeTables.find(t => t.table_number === String(room.id));
                                const isPaidOrder = String(hasOrder?.payment_status || '').toUpperCase() === 'PAID';
                                let pendingItems = [];
                                let reqTime = '';
                                if (hasOrder) {
                                    try {
                                        pendingItems = typeof hasOrder.cart_data === 'string' ? JSON.parse(hasOrder.cart_data) : hasOrder.cart_data;
                                        if (pendingItems.length > 0 && pendingItems[0].requestTime) reqTime = pendingItems[0].requestTime;
                                    } catch {
                                        pendingItems = [];
                                        reqTime = '';
                                    }
                                }
                                return (
                                    <div key={room.id} onClick={() => isOccupied ? handleTableClick(String(room.id)) : alert('This room is currently vacant.')}
                                        className={`relative p-4 md:p-5 rounded-md border-2 flex flex-col justify-start transition-all min-h-[160px] md:min-h-[180px]
                                        ${isOccupied ? 'cursor-pointer hover:-translate-y-1 shadow-md bg-blue-50 border-blue-200' : 'opacity-60 bg-slate-50 border-slate-200'}
                                        ${hasOrder ? (isPaidOrder ? 'ring-4 ring-emerald-300 border-emerald-400 bg-emerald-50' : 'ring-4 ring-orange-400 border-orange-400 bg-orange-50') : ''}`}>
                                        <div className="flex justify-between items-start mb-1 md:mb-2">
                                            <span className={`text-2xl md:text-3xl font-black ${isOccupied ? 'text-blue-700' : 'text-slate-400'}`}>{room.id}</span>
                                            {hasOrder ? (
                                                isPaidOrder ? (
                                                    <span className="bg-emerald-500 text-white text-[9px] md:text-[10px] font-black px-1.5 py-0.5 md:px-2 md:py-1 rounded-md shadow-sm">PAID</span>
                                                ) : (
                                                    <span className="bg-orange-500 text-white text-[9px] md:text-[10px] font-black px-1.5 py-0.5 md:px-2 md:py-1 rounded-md animate-pulse shadow-sm flex items-center gap-1">⏰ {reqTime || 'NEW'}</span>
                                                )
                                            ) : null}
                                        </div>
                                        <div>
                                            <div className={`text-[10px] md:text-xs font-bold mb-0.5 md:mb-1 ${isOccupied ? 'text-blue-500' : 'text-slate-400'}`}>
                                                {isOccupied ? '👤 OCCUPIED' : '⚪ VACANT'}
                                            </div>
                                            <div className="font-bold text-slate-800 text-sm md:text-base truncate">
                                                {isOccupied ? room.guestName : 'No Guest'}
                                            </div>
                                        </div>
                                        {hasOrder && !isPaidOrder && pendingItems.length > 0 && (
                                            <div className="mt-2 bg-white p-2 rounded-md border border-orange-200 text-[10px] md:text-xs shadow-inner flex-1 flex flex-col overflow-hidden max-h-[150px]">
                                                <div className="font-bold text-orange-700 border-b border-orange-100 pb-1 mb-1.5 shrink-0 flex justify-between items-center">
                                                    <span>🛎️ Order Status</span>
                                                    <span className="bg-orange-100 px-1.5 py-0.5 rounded text-orange-800">₱{hasOrder.total_amount.toLocaleString()}</span>
                                                </div>
                                                <div className="overflow-y-auto scrollbar-hide pr-1 space-y-1.5 flex-1">
                                                    {pendingItems.map((pi, idx) => {
                                                        const status = pi.kdsStatus || (pi.kdsDone ? 'Done' : 'Pending');
                                                        return (
                                                            <div key={idx} className="flex justify-between items-start bg-slate-50 p-1.5 rounded-md border border-slate-100">
                                                                <div className="flex-1 pr-1 min-w-0 text-left">
                                                                    <div className="font-bold text-slate-700 truncate text-[10px] sm:text-xs">{pi.name} {pi.selectedSize && pi.selectedSize !== 'Regular' ? `(${pi.selectedSize})` : ''}</div>
                                                                    <div className={`inline-block mt-0.5 text-[8px] font-black px-1.5 py-0.5 rounded border ${getStatusBadge(status)}`}>{status}</div>
                                                                </div>
                                                                <div className="font-black text-orange-600 shrink-0 text-xs mt-0.5">x{pi.quantity}</div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {hasOrder && isPaidOrder && (
                                            <div className="mt-3">
                                                <button
                                                    onClick={(event) => handleMarkTableVacant(String(room.id), false, event)}
                                                    className="w-full rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs md:text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                                                >
                                                    Mark Vacant
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                            {/* 💡 일반 레스토랑 테이블 (Regular Tables) */}
                            {Array.from({ length: currentTableCount }, (_, i) => i + 1).map(num => {
                                const tableOrder = activeTables.find(t => t.table_number === String(num));
                                const isPaidOrder = String(tableOrder?.payment_status || '').toUpperCase() === 'PAID';
                                let pendingItems = [];
                                if (tableOrder) {
                                    try { pendingItems = typeof tableOrder.cart_data === 'string' ? JSON.parse(tableOrder.cart_data) : tableOrder.cart_data; } catch { pendingItems = []; }
                                }

                                return (
                                    <div key={num} onClick={() => handleTableClick(String(num))}
                                        className={`p-3 md:p-4 rounded-md flex flex-col transition-all shadow-sm border-2 cursor-pointer hover:-translate-y-1 min-h-[160px] md:min-h-[180px]
                                        ${tableOrder ? (isPaidOrder ? 'bg-emerald-50 border-emerald-400 ring-4 ring-emerald-100' : 'bg-orange-50 border-orange-400 ring-4 ring-orange-100') : 'bg-slate-50 border-slate-200 hover:border-blue-400 hover:bg-blue-50'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-xl md:text-2xl font-black ${tableOrder ? (isPaidOrder ? 'text-emerald-700' : 'text-orange-700') : 'text-slate-400'}`}>Table {num}</span>
                                            {tableOrder ? (
                                                isPaidOrder ? (
                                                    <span className="text-[10px] md:text-xs font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200 mt-1">✅ PAID</span>
                                                ) : (
                                                    <div className="text-xs md:text-sm font-bold text-orange-800 bg-white px-2 py-0.5 rounded-md shadow-sm border border-orange-200">₱{tableOrder.total_amount.toLocaleString()}</div>
                                                )
                                            ) : (
                                                <span className="text-[10px] md:text-xs font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200 mt-1">⚪ VACANT</span>
                                            )}
                                        </div>

                                        {tableOrder && !isPaidOrder && pendingItems.length > 0 && (
                                            <div className="mt-2 bg-white p-2 rounded-md border border-orange-200 text-[10px] md:text-xs shadow-inner flex-1 flex flex-col overflow-hidden max-h-[150px]">
                                                <div className="font-bold text-orange-700 border-b border-orange-100 pb-1 mb-1.5 shrink-0 flex items-center gap-1">
                                                    🛎️ Order Status
                                                </div>
                                                <div className="overflow-y-auto scrollbar-hide pr-1 space-y-1.5 flex-1">
                                                    {pendingItems.map((pi, idx) => {
                                                        const status = pi.kdsStatus || (pi.kdsDone ? 'Done' : 'Pending');
                                                        return (
                                                            <div key={idx} className="flex justify-between items-start bg-slate-50 p-1.5 rounded-md border border-slate-100">
                                                                <div className="flex-1 pr-1 min-w-0 text-left">
                                                                    <div className="font-bold text-slate-700 truncate text-[10px] sm:text-xs">{pi.name} {pi.selectedSize && pi.selectedSize !== 'Regular' ? `(${pi.selectedSize})` : ''}</div>
                                                                    <div className={`inline-block mt-0.5 text-[8px] font-black px-1.5 py-0.5 rounded border ${getStatusBadge(status)}`}>{status}</div>
                                                                </div>
                                                                <div className="font-black text-orange-600 shrink-0 text-xs mt-0.5">x{pi.quantity}</div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {tableOrder && isPaidOrder && (
                                            <div className="mt-3">
                                                <button
                                                    onClick={(event) => handleMarkTableVacant(String(num), false, event)}
                                                    className="w-full rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs md:text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                                                >
                                                    Mark Vacant
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ========================================================
    // 💡 뷰 2: 주문 및 결제 화면 (ORDER VIEW)
    // ========================================================
    return (
        <div className="flex flex-col md:flex-row h-screen bg-slate-100 font-sans select-none overflow-hidden">

            {/* 💡 [신규] QR 결제 대기 모달창 (POS 직원용) */}
            {qrPaymentData && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl p-8 md:p-10 max-w-lg w-full text-center border border-slate-200">
                        <div className="text-7xl mb-6">📱</div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-wide">Awaiting QR Payment</h3>
                        <p className="text-slate-500 mb-4 font-bold text-lg">Amount: <span className="text-blue-600 font-black">₱{qrPaymentData.amount.toLocaleString()}</span></p>
                        {qrPaymentData?.qr_image_url && (
                            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                                <img src={qrPaymentData.qr_image_url} alt="POS payment QR" className="mx-auto h-56 w-56 rounded-xl bg-white p-2 shadow" />
                                <div className="mt-3 text-xs font-black uppercase tracking-widest text-emerald-700">Customer scans this QR to complete payment</div>
                                <div className="mt-1 break-all text-[10px] font-semibold text-slate-500">{qrPaymentData.payment_url}</div>
                            </div>
                        )}

                        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left">
                            <div className="text-xs uppercase font-black text-emerald-700 mb-2">QR Payment Status</div>
                            <div className="text-sm font-bold text-slate-700">
                                Status:{' '}
                                <span className={`font-black ${String(qrPaymentData?.status || '').toUpperCase() === 'PAID' ? 'text-emerald-700' : 'text-blue-700'}`}>
                                    {qrPaymentData?.status || 'PENDING'}
                                </span>
                            </div>
                            {qrPaymentData?.token && (
                                <div className="mt-2 break-all text-[11px] font-semibold text-slate-500">
                                    Token: {qrPaymentData.token}
                                </div>
                            )}
                            <div className="mt-3 text-xs font-semibold text-slate-500">
                                One QR Pay flow is active. The customer can complete payment by scanning the same POS QR using a regular QR wallet or My Page reward points.
                            </div>
                            {rewardQrResult && (
                                <div className="mt-3 text-xs font-black text-emerald-700">
                                    Payment settled {Number(rewardQrResult.points_used || 0).toLocaleString()} pts = ₱{Number(rewardQrResult.value_amount || qrPaymentData?.amount || 0).toLocaleString()}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => {
                                resetQrModalState();
                            }} className="flex-1 py-4 bg-slate-200 text-slate-700 rounded-md font-bold hover:bg-slate-300 transition-colors">Cancel</button>
                            <button type="button" disabled className="flex-1 py-4 bg-blue-300 text-white rounded-md font-black shadow-lg cursor-not-allowed disabled:opacity-50">
                                {String(qrPaymentData?.status || '').toUpperCase() === 'PAID' ? 'Payment Completed' : 'Waiting for Customer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {paymentSuccessData && (
                <div className="fixed inset-0 bg-black/60 z-[220] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl p-8 max-w-md w-full text-center border border-emerald-200">
                        <div className="text-6xl mb-4">✅</div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Payment Successful!</h3>
                        <p className="text-slate-500 font-bold mb-4">{paymentSuccessData.store} · Table {paymentSuccessData.table || '-'}</p>
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left mb-6">
                            <div className="flex justify-between text-sm font-bold text-slate-600 mb-2"><span>Method</span><span className="text-emerald-700">{paymentSuccessData.method}</span></div>
                            <div className="flex justify-between text-sm font-bold text-slate-600 mb-2"><span>Amount</span><span className="text-blue-600">₱{Number(paymentSuccessData.amount || 0).toLocaleString()}</span></div>
                            {paymentSuccessData.pointsUsed > 0 && <div className="flex justify-between text-sm font-bold text-slate-600 mb-2"><span>Points Used</span><span className="text-emerald-700">{Number(paymentSuccessData.pointsUsed || 0).toLocaleString()} pts</span></div>}
                            {paymentSuccessData.receiptNo && <div className="flex justify-between text-sm font-bold text-slate-600"><span>Receipt</span><span className="text-slate-800">{paymentSuccessData.receiptNo}</span></div>}
                        </div>
                        <button onClick={() => {
                            setPaymentSuccessData(null);
                            setActiveView('TABLES');
                            fetchActiveTables();
                        }} className="w-full py-4 bg-blue-600 text-white rounded-md font-black shadow-lg hover:bg-blue-700 transition-transform active:scale-95">OK</button>
                    </div>
                </div>
            )}

            {sizeModalData && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-md shadow-2xl p-6 md:p-8 w-full max-w-md animate-fade-in">
                        <h3 className="text-xl md:text-2xl font-black mb-2 text-slate-800">{sizeModalData.name}</h3>
                        <p className="text-sm md:text-base text-slate-500 mb-6">Select Option</p>
                        <div className="space-y-3">
                            {sizeModalData.sizes.map((size, idx) => (
                                <button key={idx} onClick={() => addToCart(sizeModalData, size)} className="w-full flex justify-between items-center p-3 md:p-4 border-2 border-slate-100 rounded-md hover:border-blue-500 hover:bg-blue-50 transition-all group">
                                    <span className="font-bold text-base md:text-lg text-slate-700 group-hover:text-blue-700">{size.name}</span>
                                    <span className="font-black text-base md:text-lg text-slate-800 group-hover:text-blue-700">₱{size.price}</span>
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setSizeModalData(null)} className="w-full mt-6 py-3 bg-slate-200 text-slate-600 font-bold rounded-md hover:bg-slate-300 transition-colors">Cancel</button>
                    </div>
                </div>
            )}

            {showDiscountModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-200">
                            <h3 className="text-xl font-black text-slate-800 flex justify-between items-center">
                                <span>👴 SC / PWD Discount</span>
                                <button onClick={() => setShowDiscountModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl">✕</button>
                            </h3>
                        </div>
                        <div className="p-6 space-y-6 text-slate-800">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-600">Total Persons</span>
                                <div className="flex items-center border border-slate-300 rounded-md">
                                    <button onClick={() => setTotalPax(Math.max(1, totalPax - 1))} className="px-4 py-2 text-xl font-bold text-slate-600 hover:bg-slate-100">-</button>
                                    <span className="w-12 text-center font-black text-lg">{totalPax}</span>
                                    <button onClick={() => setTotalPax(totalPax + 1)} className="px-4 py-2 text-xl font-bold text-slate-600 hover:bg-slate-100">+</button>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-red-500">Senior/PWD</span>
                                <div className="flex items-center border border-red-200 rounded-md bg-red-50">
                                    <button onClick={() => setScPwdPax(Math.max(0, scPwdPax - 1))} className="px-4 py-2 text-xl font-bold text-red-500 hover:bg-red-100">-</button>
                                    <span className="w-12 text-center font-black text-lg text-red-600">{scPwdPax}</span>
                                    <button onClick={() => setScPwdPax(Math.min(totalPax, scPwdPax + 1))} className="px-4 py-2 text-xl font-bold text-red-500 hover:bg-red-100">+</button>
                                </div>
                            </div>
                            <div className="bg-orange-50 border border-orange-200 p-4 rounded-md space-y-3">
                                <label className="block text-center text-sm font-bold text-orange-600 mb-1">Manager Approval Required</label>
                                <input
                                    type="text"
                                    name="dummy_manager_id_prevent_autofill"
                                    autoComplete="off"
                                    data-form-type="other"
                                    value={managerId}
                                    onChange={(e) => setManagerId(e.target.value)}
                                    placeholder="Manager ID"
                                    className="w-full text-center text-lg font-bold p-3 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800"
                                />
                                <input
                                    type="password"
                                    name="dummy_manager_pwd_prevent_autofill"
                                    autoComplete="new-password"
                                    data-form-type="other"
                                    value={managerPassword}
                                    onChange={(e) => setManagerPassword(e.target.value)}
                                    placeholder="Password"
                                    className="w-full text-center text-2xl tracking-widest font-black p-3 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800"
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
                            <button onClick={() => setShowDiscountModal(false)} className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-md font-bold hover:bg-slate-300">Cancel</button>
                            <button onClick={handleApplyDiscount} className="flex-1 py-3 bg-green-500 text-white rounded-md font-black hover:bg-green-600 shadow-md">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 좌측 메뉴 선택 영역 */}
            <div className="flex-1 p-4 md:p-6 flex flex-col overflow-hidden relative w-full border-b md:border-b-0 md:border-r border-slate-300">
                <div className="flex flex-wrap justify-between items-center mb-4 md:mb-6 gap-3 shrink-0">
                    <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto">
                        <button
                            onClick={() => {
                                setActiveView('TABLES');
                                // 💡 뒤로 가기 클릭 시 고객 뷰어도 대기 화면으로 돌려보냄
                                if (socketRef.current) socketRef.current.emit('pos_transaction_clear', { target_tablet: `POS-${id}` });
                            }}
                            className="bg-white border-2 border-slate-300 text-slate-700 px-4 md:px-6 py-2.5 md:py-3 rounded-md font-bold hover:bg-slate-100 shadow-sm text-sm md:text-lg flex items-center gap-1 md:gap-2 shrink-0"
                        >
                            ⬅ Back
                        </button>
                        <h1 className="text-xl md:text-3xl font-black text-slate-800 bg-white px-4 md:px-6 py-2 md:py-2 rounded-md shadow-sm border border-slate-200 flex-1 md:flex-none truncate">
                            {storeInfo.is_room_linked && !String(selectedTable).startsWith('Walk-in') ? 'Room' : 'Table'} <span className="text-blue-600">{selectedTable}</span>
                        </h1>
                    </div>
                </div>
                <div className="flex gap-2 mb-4 md:mb-6 overflow-x-auto pb-2 scrollbar-hide shrink-0">
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setActiveCategory(cat)}
                            className={`px-4 md:px-6 py-2 md:py-3 rounded-md font-bold whitespace-nowrap transition-all shadow-sm text-xs md:text-sm ${activeCategory === cat ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-400'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto pr-1 md:pr-2 pb-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                        {filteredMenu.map(item => {
                            const qty = getItemQty(item.id);
                            let itemImage = item.image_url;
                            try {
                                const parsedImgs = JSON.parse(item.image_url);
                                if (Array.isArray(parsedImgs) && parsedImgs.length > 0) itemImage = parsedImgs[0];
                            } catch {
                                itemImage = item.image_url;
                            }

                            return (
                                <div key={item.id} onClick={() => handleItemClick(item)} className={`bg-white rounded-md shadow-sm overflow-hidden border-2 transition-all hover:shadow-md cursor-pointer group relative flex flex-col ${qty > 0 ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}>
                                    {item.is_recommended == 1 && <div className="absolute top-0 right-0 bg-yellow-400 text-white text-[9px] md:text-[10px] font-black px-2 md:px-3 py-1 rounded-bl-lg md:rounded-bl-xl z-10 shadow-sm">⭐ BEST</div>}
                                    <div className="relative shrink-0">
                                        {qty > 0 && <div className="absolute top-2 left-2 bg-blue-600 text-white font-bold text-sm w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md shadow-lg z-10">{qty}</div>}
                                        <img src={itemImage || 'https://via.placeholder.com/300'} className="w-full h-24 md:h-32 lg:h-40 object-cover group-hover:scale-105 transition-transform duration-300" alt={item.name} />
                                    </div>
                                    <div className="p-3 md:p-4 flex-1 flex flex-col justify-between">
                                        <h3 className="font-bold text-slate-800 text-xs md:text-sm leading-tight mb-2 line-clamp-2">{item.name}</h3>
                                        <div className="flex justify-between items-end mt-auto">
                                            <p className="text-blue-600 font-black text-sm md:text-base">₱{item.sizes && item.sizes.length > 0 ? item.sizes[0].price : item.price}</p>
                                            <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-md bg-slate-100 text-blue-600 font-bold shadow-sm group-hover:bg-blue-100 transition-colors text-sm md:text-base">+</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 우측 장바구니 및 결제 영역 */}
            <div className="w-full md:w-[340px] lg:w-[420px] bg-slate-900 text-white flex flex-col shadow-2xl relative z-10 h-[50vh] md:h-full shrink-0">
                <div className="p-3 md:p-5 border-b border-slate-700 bg-slate-800 flex justify-between items-center shrink-0">
                    <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">🛒 Order</h2>
                    <button onClick={handlePrintReceipt} className="bg-slate-700 hover:bg-slate-600 border border-slate-600 px-3 md:px-4 py-1.5 md:py-2 rounded-md font-bold text-xs md:text-sm flex items-center gap-1 md:gap-2 transition-colors">
                        🖨️ <span className="hidden sm:inline">Print</span><span className="sm:hidden">Print</span>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 border-b border-slate-800 bg-slate-900">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                            <div className="text-5xl md:text-6xl mb-4">🧾</div>
                            <p className="text-sm md:text-base">No items selected</p>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.cartId} className="flex justify-between items-center bg-slate-800 p-2.5 md:p-3 rounded-md border border-slate-700 animate-fade-in">
                                <div className="flex-1 min-w-0 pr-2">
                                    <div className="font-bold text-xs md:text-sm text-slate-200 truncate">{item.name}</div>
                                    <div className="text-[10px] md:text-xs text-slate-400 mt-1 flex items-center gap-1 md:gap-2 flex-wrap">
                                        {item.selectedSize !== 'Regular' && <span className="bg-slate-700 px-1.5 py-0.5 rounded text-[9px] md:text-[10px] uppercase font-bold text-slate-300">{item.selectedSize}</span>}
                                        <span className="whitespace-nowrap">₱{item.price} x {item.quantity}</span>
                                    </div>
                                </div>
                                <div className="font-bold text-sm md:text-lg text-orange-400">₱{(item.price * item.quantity).toLocaleString()}</div>
                                <button onClick={() => removeFromCart(item.cartId)} className="ml-2 md:ml-3 text-slate-500 hover:text-red-400 px-2 py-1 font-black transition-colors bg-slate-700/50 rounded-md">✕</button>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-3 md:p-5 bg-slate-900 border-t border-slate-700 shrink-0">
                    <div className="mb-3 md:mb-4">
                        <button onClick={() => isDiscountApplied ? setIsDiscountApplied(false) : setShowDiscountModal(true)} className={`w-full py-2.5 md:py-3 mb-3 md:mb-4 rounded-md font-bold flex justify-between items-center px-4 transition-colors ${isDiscountApplied ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'}`}>
                            <span className="flex items-center gap-2 text-xs md:text-sm">👴 SC / PWD Discount</span>
                            <span className="text-xs">{isDiscountApplied ? 'Cancel ✕' : 'Apply ➔'}</span>
                        </button>

                        <div className="space-y-1 text-xs md:text-sm text-slate-400 border-b border-slate-700 pb-3 md:pb-4">
                            <div className="flex justify-between"><span>Subtotal</span><span>₱{rawSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                            {isDiscountApplied && scPwdDeduction > 0 ? (
                                <div className="flex justify-between text-green-400 font-bold">
                                    <span>SC/PWD Deduction ({scPwdPax}/{totalPax} Pax)</span>
                                    <span>-₱{scPwdDeduction.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            ) : (
                                <div className="flex justify-between"><span>VAT ({receiptConfig.vat_rate}%)</span><span>₱{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                            )}
                            <div className="flex justify-between"><span>Service Charge ({receiptConfig.sc_rate}%)</span><span>₱{serviceCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                        </div>
                    </div>

                    <div className="flex justify-between items-end mb-3 md:mb-4">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-xs md:text-sm">Total Due</span>
                        <span className="text-3xl md:text-4xl font-black text-white">₱{Math.round(finalAmount).toLocaleString()}</span>
                    </div>

                    <button onClick={handleSaveOrder} disabled={cart.length === 0} className="w-full bg-orange-500 hover:bg-orange-600 border border-orange-600 text-white py-3 md:py-4 rounded-md font-black mb-3 md:mb-4 transition-transform transform hover:-translate-y-1 shadow-[0_4px_15px_rgba(249,115,22,0.3)] disabled:opacity-50 disabled:transform-none flex justify-center items-center gap-2 text-sm md:text-base">
                        👨‍🍳 Hold Order & Send
                    </button>

                    <div className={`bg-slate-800 rounded-md mb-3 md:mb-4 flex border border-slate-700 overflow-hidden ${storeInfo.is_room_linked && !String(selectedTable).startsWith('Walk-in') ? 'opacity-50' : ''}`}>
                        <div className="w-10 md:w-12 flex items-center justify-center bg-slate-700 text-xs md:text-sm">🏨</div>
                        <input
                            type="text"
                            // 💡 [신규] 워크인도 룸 차지 입력을 위해 Placeholder 변경
                            placeholder={storeInfo.is_room_linked && !String(selectedTable).startsWith('Walk-in') ? "Room No" : "Enter Room No"}
                            value={roomNumberInput}
                            onChange={(e) => setRoomNumberInput(e.target.value)}
                            // 💡 [신규] 워크인이면 ReadOnly 해제! 직접 입력 가능
                            readOnly={storeInfo.is_room_linked && !String(selectedTable).startsWith('Walk-in')}
                            className="bg-transparent flex-1 text-white font-bold px-2 md:px-3 py-2 focus:outline-none placeholder:text-slate-500 text-xs md:text-sm"
                        />
                        {roomNumberInput && (!storeInfo.is_room_linked || String(selectedTable).startsWith('Walk-in')) && (
                            <button onClick={() => setRoomNumberInput('')} className="px-2 md:px-3 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white text-[10px] md:text-xs font-bold transition-colors">CLR</button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:gap-3 mt-3 md:mt-4 pt-3 md:pt-4 border-t border-slate-700">
                        <button onClick={() => handlePayment('CASH')} disabled={cart.length === 0} className="bg-green-600 hover:bg-green-500 py-2.5 md:py-3 rounded-md font-bold flex items-center justify-center gap-1 md:gap-2 transition-all disabled:opacity-50 text-xs md:text-sm"><span className="text-base md:text-lg">💵</span> Cash</button>
                        <button onClick={() => handlePayment('CARD')} disabled={cart.length === 0} className="bg-purple-600 hover:bg-purple-500 py-2.5 md:py-3 rounded-md font-bold flex items-center justify-center gap-1 md:gap-2 transition-all disabled:opacity-50 text-xs md:text-sm"><span className="text-base md:text-lg">💳</span> Card</button>

                        {/* 💡 [신규] QR Pay 연동 버튼 */}
                        <button onClick={() => handlePayment('QR')} disabled={cart.length === 0} className="bg-blue-500 hover:bg-blue-400 py-2.5 md:py-3 rounded-md font-bold flex items-center justify-center gap-1 md:gap-2 transition-all disabled:opacity-50 text-white text-xs md:text-sm"><span className="text-base md:text-lg">📱</span> QR Pay</button>

                        {/* 💡 [신규] 워크인 룸 차지 가능하도록 disabled 조건 해제 */}
                        <button onClick={() => handlePayment('ROOM')} disabled={cart.length === 0 || !roomNumberInput} className="bg-slate-700 hover:bg-slate-600 border border-slate-500 py-2.5 md:py-3 rounded-md font-bold flex items-center justify-center gap-1 md:gap-2 transition-all disabled:opacity-50 text-slate-200 text-xs md:text-sm"><span className="text-base md:text-lg">🛎️</span> Room</button>
                    </div>
                </div>
            </div>
        </div>
    );
}



