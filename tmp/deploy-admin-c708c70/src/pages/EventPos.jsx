import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ReceiptViewerModal from '../components/ReceiptViewerModal';
import {
    CATERING_TEMPLATE_OPTIONS,
    EVENT_OPTION_TEMPLATE_OPTIONS,
    assignEventRoomBlocks,
    buildLocalDateInput,
    calculateCateringLineTotal,
    calculateEventOptionLineTotal,
    calculateEventSpanDays,
    EVENT_STATUSES,
    EVENT_TYPES,
    createCateringItem,
    createDefaultEventApprovalMeta,
    createDefaultEventDraft,
    createDefaultFinanceSync,
    createEventOptionItem,
    createEventPosOrderRecord,
    createRoomBlock,
    formatCurrency,
    getBanquetApprovalArchiveStorageKey,
    getBanquetEventsStorageKey,
    getBanquetVenuesStorageKey,
    getCateringTotal,
    getEventGrandTotal,
    getEventOptionsTotal,
    getEventPaymentsTotal,
    getEventPosOrdersTotal,
    getNextDateInput,
    getOtherRevenueTotal,
    getRoomBlockRevenue,
    getRoomBlocksBaseRevenue,
    getRoomBlocksRevenue,
    getRoomDiscountAmount,
    getVenueBaseTotal,
    getVenueDiscountAmount,
    getVenueNetTotal,
    loadBanquetApprovalArchives,
    loadBanquetEvents,
    loadBanquetVenues,
    normalizeCateringItem,
    normalizeEventApprovalArchive,
    normalizeEventApprovalMeta,
    normalizeEventOptionItem,
    normalizeEventPaymentRecord,
    normalizeEventRecord,
    normalizeRoomBlock,
    saveBanquetApprovalArchives,
    saveBanquetEvents,
    shouldSyncRoomBlock
} from '../utils/banquetEvents';
import {
    APPROVAL_REQUEST_STATUS_META,
    buildApprovalAppliedNotifications,
    createApprovalParty,
    createApprovalRequestDraft,
    getCompanyApprovalRequestsStorageKey,
    loadCompanyApprovalNotifications,
    loadCompanyApprovalRequests,
    markApprovalRequestApplied,
    normalizeApprovalRequest,
    saveCompanyApprovalNotifications,
    saveCompanyApprovalRequests
} from '../utils/companyApprovals';

const EVENT_PAYMENT_METHODS = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CARD', label: 'Card / Hosted PG' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'ONLINE', label: 'Online / QR Gateway' }
];

const EVENT_COLLECTION_TYPES = [
    { value: 'DEPOSIT', label: 'Deposit' },
    { value: 'PARTIAL', label: 'Partial Payment' },
    { value: 'FULL_SETTLEMENT', label: 'Full Settlement' }
];

const SUMMARY_BADGE_CLASS = 'flex min-h-[74px] min-w-[138px] flex-col justify-center rounded-2xl border border-slate-200 px-4 py-3 text-center shadow-sm';
const ACTION_TILE_CLASS = 'inline-flex min-h-[74px] min-w-[138px] items-center justify-center rounded-2xl px-4 py-3 text-center text-sm font-black transition-colors shadow-sm';
const EVENT_STORAGE_PAGE_SIZE = 20;
const AUTO_APPLY_WORKFLOW_ACTOR = {
    userId: 'event_pos_auto_sync',
    userName: 'Event POS Auto Sync',
    role: 'SYSTEM'
};

let pdfToolsPromise = null;
const loadPdfTools = async () => {
    if (!pdfToolsPromise) {
        pdfToolsPromise = Promise.all([
            import('jspdf'),
            import('jspdf-autotable')
        ]).then(([jspdfModule, autoTableModule]) => ({
            jsPDF: jspdfModule.jsPDF,
            autoTable: autoTableModule.default
        }));
    }

    return pdfToolsPromise;
};

const getDateKey = (dateValue) => String(dateValue || '').slice(0, 10);
const matchesDateRange = (dateValue, startDate, endDate) => {
    const dateKey = getDateKey(dateValue);
    if (startDate && (!dateKey || dateKey < startDate)) return false;
    if (endDate && (!dateKey || dateKey > endDate)) return false;
    return true;
};
const getPaginationMeta = (items, page, pageSize = EVENT_STORAGE_PAGE_SIZE) => {
    const rows = Array.isArray(items) ? items : [];
    const totalCount = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const pageItems = rows.slice(startIndex, startIndex + pageSize);
    const from = totalCount === 0 ? 0 : startIndex + 1;
    const to = totalCount === 0 ? 0 : startIndex + pageItems.length;

    return {
        totalCount,
        totalPages,
        safePage,
        pageItems,
        from,
        to
    };
};

function StoragePaginationFooter({ pagination, page, onPrevious, onNext }) {
    const safePage = pagination?.safePage || Math.max(1, Number(page) || 1);

    return (
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 md:flex-row md:items-center md:justify-between">
            <div className="text-xs font-bold text-slate-500">
                Showing {pagination.from}-{pagination.to} of {pagination.totalCount.toLocaleString()} rows
                <span className="mx-2 text-slate-300">|</span>
                Rows per page: 20
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onPrevious}
                    disabled={safePage <= 1 || pagination.totalCount === 0}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Previous
                </button>
                <div className="min-w-[78px] rounded-xl bg-slate-900 px-3 py-2 text-center text-xs font-black text-white">
                    {pagination.totalCount === 0 ? '0 / 0' : `${safePage} / ${pagination.totalPages}`}
                </div>
                <button
                    type="button"
                    onClick={onNext}
                    disabled={safePage >= pagination.totalPages || pagination.totalCount === 0}
                    className="rounded-xl bg-fuchsia-600 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Next
                </button>
            </div>
        </div>
    );
}

const VENUE_FILTERS = [
    { value: 'ALL', label: 'All Venues' },
    { value: 'ACTIVE', label: 'With Event' },
    { value: 'OPEN', label: 'Open for Sale' }
];

const CLOSED_EVENT_STATUSES = ['COMPLETED', 'CANCELLED'];

const getHotelDate = (offsetDays = 0) => {
    const now = new Date();
    if (now.getHours() < 12) now.setDate(now.getDate() - 1);
    now.setDate(now.getDate() + offsetDays);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getFinanceTimestamp = () => {
    const now = new Date();
    const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
    return localDate.toISOString().replace('T', ' ').slice(0, 19);
};

const getCollectionLabel = (value) => (
    EVENT_COLLECTION_TYPES.find((item) => item.value === value)?.label || value
);

const getPaymentMethodLabel = (value) => (
    EVENT_PAYMENT_METHODS.find((item) => item.value === value)?.label || value
);

const getApprovalSourcePath = (pathname, requestId) => {
    const params = new URLSearchParams();
    if (requestId) params.set('approvalRequest', requestId);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
};

const createApprovalDraftComparisonPayload = (eventItem = {}) => {
    const normalizedEvent = normalizeEventRecord(eventItem);

    return {
        id: String(normalizedEvent.id || '').trim(),
        title: normalizedEvent.title,
        client_name: normalizedEvent.client_name,
        company_name: normalizedEvent.company_name,
        contact_phone: normalizedEvent.contact_phone,
        contact_email: normalizedEvent.contact_email,
        event_type: normalizedEvent.event_type,
        status: normalizedEvent.status,
        start_date: normalizedEvent.start_date,
        end_date: normalizedEvent.end_date,
        start_time: normalizedEvent.start_time,
        end_time: normalizedEvent.end_time,
        pax: Number(normalizedEvent.pax || 0),
        venue_id: String(normalizedEvent.venue_id || '').trim(),
        venue_name: normalizedEvent.venue_name,
        venue_rate: String(normalizedEvent.venue_rate ?? ''),
        venue_pricing_mode: normalizedEvent.venue_pricing_mode,
        venue_discount_mode: normalizedEvent.venue_discount_mode,
        venue_discount_value: String(normalizedEvent.venue_discount_value ?? ''),
        room_discount_mode: normalizedEvent.room_discount_mode,
        room_discount_value: String(normalizedEvent.room_discount_value ?? ''),
        other_revenue: String(normalizedEvent.other_revenue ?? ''),
        deposit_amount: Number(normalizedEvent.deposit_amount || 0),
        notes: normalizedEvent.notes,
        room_blocks: (normalizedEvent.room_blocks || []).map((block) => {
            const normalizedBlock = normalizeRoomBlock(block);
            return {
                room_type: normalizedBlock.room_type,
                quantity: Number(normalizedBlock.quantity || 0),
                check_in_date: normalizedBlock.check_in_date,
                check_out_date: normalizedBlock.check_out_date,
                rate: String(normalizedBlock.rate ?? ''),
                guest_name: normalizedBlock.guest_name,
                reservation_status: normalizedBlock.reservation_status,
                note: normalizedBlock.note
            };
        }),
        catering_items: (normalizedEvent.catering_items || []).map((item) => {
            const normalizedItem = normalizeCateringItem(item);
            return {
                name: normalizedItem.name,
                category: normalizedItem.category,
                quantity: Number(normalizedItem.quantity || 0),
                unit_price: Number(normalizedItem.unit_price || 0),
                service_days: Number(normalizedItem.service_days || 0),
                attendees: Number(normalizedItem.attendees || 0),
                note: normalizedItem.note
            };
        }),
        option_items: (normalizedEvent.option_items || []).map((item) => {
            const normalizedItem = normalizeEventOptionItem(item);
            return {
                name: normalizedItem.name,
                category: normalizedItem.category,
                quantity: Number(normalizedItem.quantity || 0),
                unit_price: Number(normalizedItem.unit_price || 0),
                note: normalizedItem.note
            };
        })
    };
};

const mapRoomTypeCatalog = (source) => (Array.isArray(source) ? source : []).map((room) => ({
    id: room.id || room.displayName || room.name?.en || room.name,
    name: String(room.displayName || room.name?.en || room.name || 'Unnamed Room'),
    baseRate: Number(room.basePriceValue || room.price || room.basePrice || 0),
    totalRooms: Number(room.assignmentCount || 0),
    size: String(room.parsedConfig?.size || ''),
    bedType: String(room.parsedConfig?.bedType || '')
}));

const getMenuImage = (item) => {
    if (!item?.image_url) return 'https://via.placeholder.com/300';

    try {
        const parsedImages = JSON.parse(item.image_url);
        if (Array.isArray(parsedImages) && parsedImages.length > 0) {
            return parsedImages[0];
        }
    } catch {
        return item.image_url;
    }

    return 'https://via.placeholder.com/300';
};

const matchesEventVenue = (eventItem, venue) => (
    String(eventItem?.venue_id || '').trim() === String(venue?.id || '').trim()
    || String(eventItem?.venue_name || '').trim() === String(venue?.name || '').trim()
);

const isEventOpen = (eventItem) => !CLOSED_EVENT_STATUSES.includes(String(eventItem?.status || '').toUpperCase());

const isEventOnDate = (eventItem, dateKey) => {
    const start = String(eventItem?.start_date || '').trim();
    const end = String(eventItem?.end_date || eventItem?.start_date || '').trim();
    if (!dateKey || !start || !end) return false;
    return start <= dateKey && end >= dateKey;
};

const getEventWorkQueueRank = (eventItem, dateKey) => {
    if (isEventOpen(eventItem) && isEventOnDate(eventItem, dateKey)) return 0;
    if (isEventOpen(eventItem) && String(eventItem?.start_date || '') > dateKey) return 1;
    if (isEventOpen(eventItem)) return 2;
    return String(eventItem?.status || '').toUpperCase() === 'COMPLETED' ? 3 : 4;
};

const sortVenueEvents = (events, dateKey) => [...events].sort((left, right) => {
    const leftRank = getEventWorkQueueRank(left, dateKey);
    const rightRank = getEventWorkQueueRank(right, dateKey);
    if (leftRank !== rightRank) return leftRank - rightRank;

    const leftDate = String(left?.start_date || '');
    const rightDate = String(right?.start_date || '');

    if (leftRank <= 1) {
        return rightDate.localeCompare(leftDate) || String(left?.title || '').localeCompare(String(right?.title || ''));
    }

    return (
        String(right?.updated_at || right?.created_at || '').localeCompare(String(left?.updated_at || left?.created_at || ''))
        || rightDate.localeCompare(leftDate)
        || String(left?.title || '').localeCompare(String(right?.title || ''))
    );
});

export default function EventPos({
    currentHotelCode,
    currentUser,
    posMenu,
    receiptConfig,
    storeInfo
}) {
    const location = useLocation();
    const navigate = useNavigate();
    const currentUserName = sessionStorage.getItem('userName') || localStorage.getItem('userName') || currentUser || 'Event POS';
    const currentUserRole = sessionStorage.getItem('role') || localStorage.getItem('role') || 'GENERAL';
    const [events, setEvents] = useState([]);
    const [venues, setVenues] = useState([]);
    const [approvalArchives, setApprovalArchives] = useState([]);
    const [approvalRequests, setApprovalRequests] = useState(() => loadCompanyApprovalRequests(currentHotelCode));
    const [roomTypeRateMap, setRoomTypeRateMap] = useState({});
    const [selectedVenueId, setSelectedVenueId] = useState('');
    const [selectedEventId, setSelectedEventId] = useState('');
    const [venueSearch, setVenueSearch] = useState('');
    const [venueFilter, setVenueFilter] = useState('ALL');
    const [activeCategory, setActiveCategory] = useState('All');
    const [menuSearch, setMenuSearch] = useState('');
    const [cart, setCart] = useState([]);
    const [sizeModalData, setSizeModalData] = useState(null);
    const [chargeNote, setChargeNote] = useState('');
    const [collectionType, setCollectionType] = useState('DEPOSIT');
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNote, setPaymentNote] = useState('');
    const [isSavingCharge, setIsSavingCharge] = useState(false);
    const [isSavingPayment, setIsSavingPayment] = useState(false);
    const [isLaunchingGateway, setIsLaunchingGateway] = useState(false);
    const [paymentConfigs, setPaymentConfigs] = useState([]);
    const [pgSession, setPgSession] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [eventDraft, setEventDraft] = useState(() => createDefaultEventDraft());
    const [showRoomDiscountModal, setShowRoomDiscountModal] = useState(false);
    const [isSavingEvent, setIsSavingEvent] = useState(false);
    const [isRoutingApproval, setIsRoutingApproval] = useState(false);
    const [receiptsData, setReceiptsData] = useState([]);
    const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);
    const [isActivityArchiveOpen, setIsActivityArchiveOpen] = useState(false);
    const [isReceiptArchiveOpen, setIsReceiptArchiveOpen] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [activitySearch, setActivitySearch] = useState('');
    const [activityStartDate, setActivityStartDate] = useState('');
    const [activityEndDate, setActivityEndDate] = useState('');
    const [activityPage, setActivityPage] = useState(1);
    const [receiptSearch, setReceiptSearch] = useState('');
    const [receiptStartDate, setReceiptStartDate] = useState('');
    const [receiptEndDate, setReceiptEndDate] = useState('');
    const [receiptPage, setReceiptPage] = useState(1);
    const pgSessionSavedRef = useRef(false);
    const restoredApprovalRequestRef = useRef('');
    const autoApplyInFlightRef = useRef(new Set());
    const autoApplyFailureRef = useRef({});
    const draft = eventDraft;
    const setDraft = setEventDraft;

    const todayVenueDate = getHotelDate(0);
    const normalizedEvents = useMemo(() => events.map(normalizeEventRecord), [events]);

    const venueMap = useMemo(() => venues.reduce((map, venue) => {
        map[venue.id] = venue;
        map[venue.name] = venue;
        return map;
    }, {}), [venues]);

    const roomTypeOptions = useMemo(() => Object.values(roomTypeRateMap), [roomTypeRateMap]);

    const activeGatewayProviders = useMemo(() => (
        (Array.isArray(paymentConfigs) ? paymentConfigs : [])
            .filter((provider) => provider?.is_active === 1 || provider?.is_active === true)
            .map((provider) => String(provider.provider || '').trim())
            .filter(Boolean)
    ), [paymentConfigs]);

    const activeGatewayLabel = activeGatewayProviders[0] || 'Unified QR Gateway';

    const venueCards = useMemo(() => {
        const normalizedQuery = String(venueSearch || '').trim().toLowerCase();
        const registeredCards = (Array.isArray(venues) ? venues : []).map((venue) => {
            const matchingEvents = sortVenueEvents(
                normalizedEvents.filter((eventItem) => matchesEventVenue(eventItem, venue)),
                todayVenueDate
            );
            const focusEvent = matchingEvents[0] || null;
            const openEventCount = matchingEvents.filter(isEventOpen).length;
            const totalBalance = matchingEvents
                .filter(isEventOpen)
                .reduce((sum, eventItem) => (
                    sum + Math.max(0, getEventGrandTotal(eventItem, { venueMap, roomTypeRateMap }) - getEventPaymentsTotal(eventItem))
                ), 0);
            const hasReservationToday = matchingEvents.some((eventItem) => isEventOpen(eventItem) && isEventOnDate(eventItem, todayVenueDate));

            return {
                ...venue,
                matchingEvents,
                focusEvent,
                openEventCount,
                totalBalance,
                hasReservationToday
            };
        });

        const registeredVenueKeys = new Set(registeredCards.map((venue) => `${String(venue.id || '').trim()}::${String(venue.name || '').trim()}`));
        const derivedCards = normalizedEvents.reduce((list, eventItem) => {
            const venueId = String(eventItem?.venue_id || '').trim();
            const venueName = String(eventItem?.venue_name || '').trim();
            if (!venueName) return list;

            const dedupeKey = `${venueId}::${venueName}`;
            if (registeredVenueKeys.has(dedupeKey) || list.some((venue) => `${String(venue.id || '').trim()}::${String(venue.name || '').trim()}` === dedupeKey)) {
                return list;
            }

            const matchingEvents = sortVenueEvents(
                normalizedEvents.filter((candidate) => String(candidate?.venue_name || '').trim() === venueName),
                todayVenueDate
            );
            const focusEvent = matchingEvents[0] || null;
            const openEventCount = matchingEvents.filter(isEventOpen).length;
            const totalBalance = matchingEvents
                .filter(isEventOpen)
                .reduce((sum, candidate) => (
                    sum + Math.max(0, getEventGrandTotal(candidate, { venueMap, roomTypeRateMap }) - getEventPaymentsTotal(candidate))
                ), 0);

            list.push({
                id: venueId || `derived_${venueName.replace(/\s+/g, '_').toLowerCase()}`,
                name: venueName,
                category: 'Venue',
                capacity: 0,
                base_rate: Number(eventItem?.venue_rate || 0),
                pricing_mode: eventItem?.venue_pricing_mode || 'PER_EVENT',
                description: '',
                matchingEvents,
                focusEvent,
                openEventCount,
                totalBalance,
                hasReservationToday: matchingEvents.some((candidate) => isEventOpen(candidate) && isEventOnDate(candidate, todayVenueDate))
            });
            return list;
        }, []);

        return [...registeredCards, ...derivedCards]
            .filter((venueCard) => {
                const reservationSearchText = (venueCard.matchingEvents || [])
                    .map((eventItem) => `${eventItem.start_date || ''} ${eventItem.title || ''} ${eventItem.client_name || ''}`)
                    .join(' ')
                    .toLowerCase();
                const searchableText = `${venueCard.name} ${venueCard.category} ${reservationSearchText}`.toLowerCase();
                const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);
                const matchesFilter = venueFilter === 'ALL'
                    || (venueFilter === 'ACTIVE' ? venueCard.matchingEvents.length > 0 : venueCard.matchingEvents.length === 0);
                return matchesQuery && matchesFilter;
            });
    }, [normalizedEvents, roomTypeRateMap, todayVenueDate, venueFilter, venueMap, venueSearch, venues]);

    const categories = useMemo(() => (
        ['All', ...new Set((Array.isArray(posMenu) ? posMenu : []).map((item) => item.category).filter(Boolean))]
    ), [posMenu]);

    const categoryOptions = useMemo(() => (
        categories.map((category) => ({
            value: category,
            label: category === 'All' ? 'All categories' : category,
            count: category === 'All'
                ? (Array.isArray(posMenu) ? posMenu.length : 0)
                : (Array.isArray(posMenu) ? posMenu.filter((item) => item.category === category).length : 0)
        }))
    ), [categories, posMenu]);

    const filteredMenu = useMemo(() => {
        const normalizedQuery = String(menuSearch || '').trim().toLowerCase();
        return (Array.isArray(posMenu) ? posMenu : []).filter((item) => {
            const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
            const matchesQuery = !normalizedQuery
                || String(item.name || '').toLowerCase().includes(normalizedQuery)
                || String(item.category || '').toLowerCase().includes(normalizedQuery);
            return matchesCategory && matchesQuery;
        });
    }, [activeCategory, menuSearch, posMenu]);

    const selectedVenueCard = useMemo(() => (
        venueCards.find((venueCard) => String(venueCard.id) === String(selectedVenueId))
        || venueCards[0]
        || null
    ), [selectedVenueId, venueCards]);

    const selectedVenueEvents = useMemo(() => (
        selectedVenueCard?.matchingEvents || []
    ), [selectedVenueCard]);

    const selectedEvent = useMemo(() => (
        selectedVenueEvents.find((eventItem) => eventItem.id === selectedEventId)
        || selectedVenueEvents[0]
        || null
    ), [selectedEventId, selectedVenueEvents]);

    const rawSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const vatRate = Number(receiptConfig?.vat_rate || 12) / 100;
    const serviceCharge = rawSubtotal * (Number(receiptConfig?.sc_rate || 10) / 100);
    const vatAmount = rawSubtotal - (rawSubtotal / (1 + vatRate));
    const finalChargeTotal = rawSubtotal + serviceCharge;

    const selectedGrandTotal = selectedEvent ? getEventGrandTotal(selectedEvent, { venueMap, roomTypeRateMap }) : 0;
    const selectedPaymentsTotal = selectedEvent ? getEventPaymentsTotal(selectedEvent) : 0;
    const selectedBalanceDue = Math.max(0, selectedGrandTotal - selectedPaymentsTotal);
    const depositGap = Math.max(0, Number(selectedEvent?.deposit_amount || 0) - selectedPaymentsTotal);
    const paymentUsesGatewayApproval = paymentMethod === 'CARD' || paymentMethod === 'ONLINE';

    const recentPosOrders = Array.isArray(selectedEvent?.pos_orders)
        ? [...selectedEvent.pos_orders].sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
        : [];
    const recentPayments = Array.isArray(selectedEvent?.payments)
        ? [...selectedEvent.payments].sort((left, right) => String(right.paid_at || '').localeCompare(String(left.paid_at || '')))
        : [];
    const eventActivityArchiveRows = useMemo(() => (
        normalizedEvents.flatMap((eventItem) => {
            const posChargeRows = (Array.isArray(eventItem.pos_orders) ? eventItem.pos_orders : []).map((order) => ({
                id: order.id,
                eventId: eventItem.id,
                eventTitle: eventItem.title || 'Untitled Event',
                clientName: eventItem.client_name || '',
                venueName: eventItem.venue_name || '',
                type: 'POS_CHARGE',
                typeLabel: 'POS Charge',
                title: order.note || `${order.source_store_name || storeInfo?.name || 'Event POS'} POS Charge`,
                detail: `${order.items?.length || 0} item(s) · ${order.source_store_name || storeInfo?.name || 'Event POS'}`,
                amount: Number(order.total_amount || 0),
                happenedAt: order.created_at || ''
            }));
            const paymentRows = (Array.isArray(eventItem.payments) ? eventItem.payments : []).map((payment) => ({
                id: payment.id,
                eventId: eventItem.id,
                eventTitle: eventItem.title || 'Untitled Event',
                clientName: eventItem.client_name || '',
                venueName: eventItem.venue_name || '',
                type: 'PAYMENT',
                typeLabel: 'Payment',
                title: `${getCollectionLabel(payment.collection_type)} via ${getPaymentMethodLabel(payment.method)}`,
                detail: payment.note || payment.provider || payment.gateway_reference || (payment.pos_store_name || 'Event POS'),
                amount: Number(payment.amount || 0),
                happenedAt: payment.paid_at || ''
            }));

            return [...posChargeRows, ...paymentRows];
        }).sort((left, right) => (
            String(right.happenedAt || '').localeCompare(String(left.happenedAt || ''))
        ))
    ), [normalizedEvents, storeInfo?.name]);

    const draftEventSpanDays = calculateEventSpanDays(draft.start_date, draft.end_date);
    const draftVenueBase = getVenueBaseTotal(draft, venueMap);
    const draftVenueDiscount = getVenueDiscountAmount(draft, venueMap);
    const draftVenueNet = getVenueNetTotal(draft, venueMap);
    const draftCateringTotal = getCateringTotal(draft.catering_items);
    const draftOptionTotal = getEventOptionsTotal(draft.option_items);
    const draftRoomBaseRevenue = getRoomBlocksBaseRevenue(draft.room_blocks, roomTypeRateMap);
    const draftRoomDiscount = getRoomDiscountAmount(draft, roomTypeRateMap);
    const draftRoomRevenue = getRoomBlocksRevenue(draft, roomTypeRateMap);
    const draftOtherRevenue = getOtherRevenueTotal(draft);
    const draftGrandTotal = getEventGrandTotal(draft, { venueMap, roomTypeRateMap });
    const draftPaymentsTotal = getEventPaymentsTotal(draft);
    const draftBalanceDue = Math.max(0, draftGrandTotal - draftPaymentsTotal);
    const draftTotalRooms = (draft.room_blocks || []).reduce((sum, block) => sum + (Number(block.quantity) || 0), 0);
    const approvalRequestIdFromQuery = useMemo(() => (
        new URLSearchParams(location.search).get('approvalRequest') || ''
    ), [location.search]);
    const approvalArchiveMap = useMemo(() => approvalArchives.reduce((map, archive) => {
        map[archive.id] = archive;
        return map;
    }, {}), [approvalArchives]);
    const approvalRequestMap = useMemo(() => approvalRequests.reduce((map, request) => {
        map[request.id] = request;
        return map;
    }, {}), [approvalRequests]);
    const draftApprovalMeta = normalizeEventApprovalMeta(
        draft.approval_meta,
        draft.id ? 'LEGACY' : 'PENDING'
    );
    const draftApprovalArchive = draftApprovalMeta.archive_id
        ? approvalArchiveMap[draftApprovalMeta.archive_id] || null
        : null;
    const linkedApprovalRequestId = String(draft.approval_request_id || approvalRequestIdFromQuery || '').trim();
    const activeApprovalRequest = linkedApprovalRequestId
        ? approvalRequestMap[linkedApprovalRequestId] || null
        : null;
    const activeApprovalWatchers = Array.isArray(activeApprovalRequest?.watchers)
        ? activeApprovalRequest.watchers.filter((watcher) => String(watcher?.user_id || '').trim())
        : [];
    const approvalDraftMatchesRequest = useMemo(() => {
        if (!activeApprovalRequest?.payload?.event_draft) return false;

        return JSON.stringify(
            createApprovalDraftComparisonPayload(activeApprovalRequest.payload.event_draft)
        ) === JSON.stringify(
            createApprovalDraftComparisonPayload({
                ...draft,
                approval_request_id: activeApprovalRequest.id
            })
        );
    }, [activeApprovalRequest, draft]);
    const activeApprovalStatusMeta = activeApprovalRequest
        ? (APPROVAL_REQUEST_STATUS_META[activeApprovalRequest.status] || APPROVAL_REQUEST_STATUS_META.DRAFT)
        : null;
    const approvalWorkflowState = useMemo(() => {
        if (!activeApprovalRequest) {
            if (draftApprovalArchive) {
                return {
                    key: 'LEGACY',
                    badgeLabel: 'Legacy Approval PDF',
                    badgeClass: 'bg-slate-200 text-slate-700',
                    title: 'A legacy approval PDF is already attached to this record.',
                    description: 'Any new registration or pricing revision should now go through the company approval workflow before saving.',
                    primaryActionLabel: 'Prepare New Approval Request'
                };
            }

            return {
                key: 'REQUIRED',
                badgeLabel: 'Approval Required',
                badgeClass: 'bg-amber-100 text-amber-700',
                title: 'Registration is held until a company payment request is routed and approved.',
                description: 'Prepare the approval packet, send it to the authorized approvers, and come back here after the workflow is complete.',
                primaryActionLabel: 'Prepare Approval Request'
            };
        }

        if (activeApprovalRequest.status === 'DRAFT') {
            return {
                key: 'DRAFT',
                badgeLabel: 'Draft Request',
                badgeClass: 'bg-slate-100 text-slate-700',
                title: 'An approval draft is ready to finish.',
                description: 'Open the company approval form, complete the routing list, and send the request for authorization.',
                primaryActionLabel: 'Continue Draft'
            };
        }

        if (activeApprovalRequest.status === 'REJECTED') {
            return {
                key: 'REJECTED',
                badgeLabel: 'Rejected',
                badgeClass: 'bg-rose-100 text-rose-700',
                title: 'The last approval request was rejected.',
                description: 'Revise the event charges, explain the changes, and resubmit the request from the approval workflow.',
                primaryActionLabel: 'Revise & Resubmit'
            };
        }

        if (activeApprovalRequest.status === 'PENDING') {
            return {
                key: 'PENDING',
                badgeLabel: 'Awaiting Approval',
                badgeClass: 'bg-amber-100 text-amber-700',
                title: 'The request has been sent and is waiting on the approver queue.',
                description: 'Approvers can review it from the approval box. Once approved, the requester and related watchers will be notified and can return here.',
                primaryActionLabel: 'View Approval Workflow'
            };
        }

        if (activeApprovalRequest.source_applied_at) {
            return {
                key: 'APPLIED',
                badgeLabel: 'Already Applied',
                badgeClass: 'bg-slate-200 text-slate-700',
                title: 'This approval cycle has already been applied back to the source record.',
                description: 'If you change pricing, options, or notes again, create a fresh approval request before saving the next revision.',
                primaryActionLabel: 'Prepare New Approval Request'
            };
        }

        if (!approvalDraftMatchesRequest) {
            return {
                key: 'OUTDATED',
                badgeLabel: 'Approval Outdated',
                badgeClass: 'bg-rose-100 text-rose-700',
                title: 'The current draft no longer matches the approved packet.',
                description: 'A fresh approval request is needed because the event terms changed after the last approved snapshot.',
                primaryActionLabel: 'Prepare Fresh Request'
            };
        }

        return {
            key: 'APPROVED',
            badgeLabel: activeApprovalStatusMeta?.label || 'Approved',
            badgeClass: 'bg-emerald-100 text-emerald-700',
            title: 'Approval is complete and this event can now be registered.',
            description: 'Use the approved packet below to finalize the event, then the workflow will return you to the reservation listing.',
            primaryActionLabel: draft.id ? 'Register Approved Revision' : 'Register Approved Event'
        };
    }, [activeApprovalRequest, activeApprovalStatusMeta?.label, approvalDraftMatchesRequest, draft.id, draftApprovalArchive]);
    const filteredEventActivityArchiveRows = useMemo(() => {
        const normalizedQuery = String(activitySearch || '').trim().toLowerCase();
        return eventActivityArchiveRows.filter((row) => {
            const matchesSearch = !normalizedQuery || `${row.eventTitle} ${row.clientName} ${row.venueName} ${row.title} ${row.detail} ${row.typeLabel}`.toLowerCase().includes(normalizedQuery);
            return matchesSearch && matchesDateRange(row.happenedAt, activityStartDate, activityEndDate);
        });
    }, [activityEndDate, activitySearch, activityStartDate, eventActivityArchiveRows]);
    const activityPagination = useMemo(() => (
        getPaginationMeta(filteredEventActivityArchiveRows, activityPage)
    ), [activityPage, filteredEventActivityArchiveRows]);
    const receiptArchiveRows = useMemo(() => (
        (Array.isArray(receiptsData) ? receiptsData : [])
            .filter((receipt) => {
                const sourceModule = String(receipt?.source_module || '').trim().toUpperCase();
                const department = String(receipt?.department || '').trim().toUpperCase();
                return sourceModule === 'EVENT_POS'
                    || Boolean(String(receipt?.event_id || '').trim())
                    || Boolean(String(receipt?.event_title || '').trim())
                    || Boolean(String(receipt?.approval_request_id || '').trim())
                    || department.includes('EVENT')
                    || department.includes('BANQUET');
            })
            .slice()
            .sort((left, right) => (
                String(right?.date || right?.created_at || '').localeCompare(String(left?.date || left?.created_at || ''))
            ))
    ), [receiptsData]);
    const filteredReceiptArchiveRows = useMemo(() => {
        const normalizedQuery = String(receiptSearch || '').trim().toLowerCase();
        return receiptArchiveRows.filter((receipt) => {
            const matchesSearch = !normalizedQuery || [
                receipt?.receipt_no,
                receipt?.event_title,
                receipt?.guest_name,
                receipt?.description,
                receipt?.department
            ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));

            return matchesSearch && matchesDateRange(receipt?.date || receipt?.created_at, receiptStartDate, receiptEndDate);
        });
    }, [receiptArchiveRows, receiptEndDate, receiptSearch, receiptStartDate]);
    const receiptPagination = useMemo(() => (
        getPaginationMeta(filteredReceiptArchiveRows, receiptPage)
    ), [filteredReceiptArchiveRows, receiptPage]);

    const applySuggestedPayment = (eventItem) => {
        if (!eventItem) {
            setCollectionType('DEPOSIT');
            setPaymentAmount('');
            setPaymentMethod('CASH');
            setPaymentNote('');
            return;
        }

        const currentPaid = getEventPaymentsTotal(eventItem);
        const currentGrandTotal = getEventGrandTotal(eventItem, { venueMap, roomTypeRateMap });
        const remainingDepositTarget = Math.max(0, Number(eventItem.deposit_amount || 0) - currentPaid);
        const remainingBalanceTarget = Math.max(0, currentGrandTotal - currentPaid);
        const suggestedAmount = remainingDepositTarget > 0 ? remainingDepositTarget : remainingBalanceTarget;
        const suggestedCollectionType = remainingDepositTarget > 0
            ? 'DEPOSIT'
            : (remainingBalanceTarget > 0 ? 'PARTIAL' : 'FULL_SETTLEMENT');

        setCollectionType(suggestedCollectionType);
        setPaymentMethod('CASH');
        setPaymentAmount(suggestedAmount > 0 ? String(Math.round(suggestedAmount)) : '');
        setPaymentNote('');
    };

    const persistEvents = (nextEvents) => {
        setEvents(nextEvents);
        saveBanquetEvents(currentHotelCode, nextEvents);
    };

    const persistApprovalArchives = (nextArchives) => {
        setApprovalArchives(nextArchives);
        saveBanquetApprovalArchives(currentHotelCode, nextArchives);
    };

    const persistApprovalRequests = (nextRequests) => {
        setApprovalRequests(nextRequests);
        saveCompanyApprovalRequests(currentHotelCode, nextRequests);
    };

    const resetArchiveState = () => {
        setActivitySearch('');
        setActivityStartDate('');
        setActivityEndDate('');
        setActivityPage(1);
        setReceiptSearch('');
        setReceiptStartDate('');
        setReceiptEndDate('');
        setReceiptPage(1);
        setSelectedReceipt(null);
    };

    const handleOpenActivityArchive = () => {
        resetArchiveState();
        setIsReceiptArchiveOpen(false);
        setIsActivityArchiveOpen(true);
    };

    const handleOpenReceiptArchive = async () => {
        resetArchiveState();
        setIsActivityArchiveOpen(false);
        setIsReceiptArchiveOpen(true);
        await loadReceipts();
    };

    const handleExportActivityArchivePdf = async () => {
        if (filteredEventActivityArchiveRows.length === 0) {
            alert('No event activity rows matched the current filters.');
            return;
        }

        const { jsPDF, autoTable } = await loadPdfTools();
        const doc = new jsPDF({ orientation: 'landscape' });
        const generatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
        const filterSummary = [
            activitySearch ? `Search: ${activitySearch}` : 'Search: All',
            activityStartDate ? `From: ${activityStartDate}` : 'From: Any',
            activityEndDate ? `To: ${activityEndDate}` : 'To: Any'
        ].join('  |  ');

        doc.setFontSize(18);
        doc.text('Event POS Activity Archive', 14, 16);
        doc.setFontSize(10);
        doc.text(`${currentHotelCode || 'HOTEL'} · Generated ${generatedAt}`, 14, 23);
        doc.text(filterSummary, 14, 29);

        autoTable(doc, {
            startY: 36,
            head: [['Date', 'Event', 'Client / Venue', 'Type', 'Reference', 'Amount']],
            body: filteredEventActivityArchiveRows.map((row) => ([
                row.happenedAt ? new Date(row.happenedAt).toLocaleString('en-US', { timeZone: 'Asia/Manila' }) : '-',
                row.eventTitle || '-',
                [row.clientName, row.venueName].filter(Boolean).join(' / ') || '-',
                row.typeLabel,
                [row.title, row.detail].filter(Boolean).join(' | '),
                formatCurrency(row.amount)
            ])),
            styles: { fontSize: 8.5, cellPadding: 2.8 },
            headStyles: { fillColor: [15, 23, 42] }
        });

        doc.save(`event_pos_activity_archive_${getDateKey(new Date().toISOString())}.pdf`);
    };

    const handleExportReceiptArchivePdf = async () => {
        if (filteredReceiptArchiveRows.length === 0) {
            alert('No receipt rows matched the current filters.');
            return;
        }

        const { jsPDF, autoTable } = await loadPdfTools();
        const doc = new jsPDF({ orientation: 'landscape' });
        const generatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
        const filterSummary = [
            receiptSearch ? `Search: ${receiptSearch}` : 'Search: All',
            receiptStartDate ? `From: ${receiptStartDate}` : 'From: Any',
            receiptEndDate ? `To: ${receiptEndDate}` : 'To: Any'
        ].join('  |  ');

        doc.setFontSize(18);
        doc.text('Event POS Receipt Archive', 14, 16);
        doc.setFontSize(10);
        doc.text(`${currentHotelCode || 'HOTEL'} · Generated ${generatedAt}`, 14, 23);
        doc.text(filterSummary, 14, 29);

        autoTable(doc, {
            startY: 36,
            head: [['Date', 'OR No.', 'Event / Ref', 'Department', 'Description', 'Amount']],
            body: filteredReceiptArchiveRows.map((receipt) => ([
                receipt.date || getDateKey(receipt.created_at) || '-',
                receipt.receipt_no || '-',
                receipt.event_title || receipt.guest_name || '-',
                receipt.department || '-',
                receipt.description || '-',
                formatCurrency(receipt.amount || 0)
            ])),
            styles: { fontSize: 8.5, cellPadding: 2.8 },
            headStyles: { fillColor: [30, 41, 59] }
        });

        doc.save(`event_pos_receipt_archive_${getDateKey(new Date().toISOString())}.pdf`);
    };

    const recordAuditLog = (actionDesc) => {
        const newLog = {
            id: `local_${Date.now()}`,
            timestamp: new Date().toLocaleString('en-US', { hour12: false }),
            user_id: currentUser || 'Event POS',
            action: actionDesc,
            hotel_code: currentHotelCode
        };

        try {
            const existingLogs = JSON.parse(window.localStorage.getItem(`audit_logs_${currentHotelCode}`) || '[]');
            const updatedLocalLogs = [newLog, ...existingLogs].slice(0, 500);
            window.localStorage.setItem(`audit_logs_${currentHotelCode}`, JSON.stringify(updatedLocalLogs));
        } catch {
            // Keep the approval flow moving even if local audit storage is unavailable.
        }

        fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newLog)
        }).catch(() => {});
    };

    const loadReceipts = useCallback(async () => {
        if (!currentHotelCode) {
            setReceiptsData([]);
            return [];
        }

        setIsLoadingReceipts(true);
        try {
            const response = await fetch(`/api/receipts?hotel=${currentHotelCode}`);
            const data = await response.json().catch(() => ([]));
            const nextReceipts = Array.isArray(data) ? data : [];
            setReceiptsData(nextReceipts);
            return nextReceipts;
        } catch {
            setReceiptsData([]);
            return [];
        } finally {
            setIsLoadingReceipts(false);
        }
    }, [currentHotelCode]);

    useEffect(() => {
        setEvents(loadBanquetEvents(currentHotelCode));
        setVenues(loadBanquetVenues(currentHotelCode));
        setApprovalArchives(loadBanquetApprovalArchives(currentHotelCode));
        setApprovalRequests(loadCompanyApprovalRequests(currentHotelCode));
        restoredApprovalRequestRef.current = '';
        autoApplyInFlightRef.current.clear();
        autoApplyFailureRef.current = {};
    }, [currentHotelCode]);

    useEffect(() => {
        loadReceipts();
    }, [loadReceipts]);

    useEffect(() => {
        const loadPaymentConfigs = async () => {
            try {
                const response = await fetch(`/api/payment-configs?hotel=${currentHotelCode}`);
                const data = await response.json().catch(() => ([]));
                setPaymentConfigs(Array.isArray(data) ? data : []);
            } catch {
                setPaymentConfigs([]);
            }
        };

        if (currentHotelCode) {
            loadPaymentConfigs();
        }
    }, [currentHotelCode]);

    useEffect(() => {
        const handleStorage = (storageEvent) => {
            const banquetEventKey = getBanquetEventsStorageKey(currentHotelCode);
            const banquetVenueKey = getBanquetVenuesStorageKey(currentHotelCode);
            const banquetApprovalArchiveKey = getBanquetApprovalArchiveStorageKey(currentHotelCode);
            const companyApprovalRequestKey = getCompanyApprovalRequestsStorageKey(currentHotelCode);

            if (
                !storageEvent.key
                || storageEvent.key === banquetEventKey
                || storageEvent.key === banquetVenueKey
                || storageEvent.key === banquetApprovalArchiveKey
            ) {
                setEvents(loadBanquetEvents(currentHotelCode));
                setVenues(loadBanquetVenues(currentHotelCode));
                setApprovalArchives(loadBanquetApprovalArchives(currentHotelCode));
            }

            if (!storageEvent.key || storageEvent.key === companyApprovalRequestKey) {
                setApprovalRequests(loadCompanyApprovalRequests(currentHotelCode));
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [currentHotelCode]);

    useEffect(() => {
        if (!approvalRequestIdFromQuery) {
            restoredApprovalRequestRef.current = '';
            return;
        }
        if (restoredApprovalRequestRef.current === approvalRequestIdFromQuery) return;

        const approvalRequest = approvalRequestMap[approvalRequestIdFromQuery];
        if (!approvalRequest) return;

        const fallbackEvent = normalizedEvents.find((eventItem) => (
            String(eventItem.id || '').trim()
            && (
                String(eventItem.id) === String(approvalRequest.linked_record_id || '')
                || String(eventItem.id) === String(approvalRequest.source_record_id || '')
            )
        )) || null;
        const requestDraftPayload = approvalRequest.payload?.event_draft || {};
        const restoredDraft = normalizeEventRecord({
            ...(approvalRequest.source_applied_at ? requestDraftPayload : (fallbackEvent || {})),
            ...(approvalRequest.source_applied_at ? (fallbackEvent || {}) : requestDraftPayload),
            approval_request_id: approvalRequest.id
        });
        const baseVenue = venueMap[restoredDraft.venue_id] || venueMap[restoredDraft.venue_name] || null;

        restoredApprovalRequestRef.current = approvalRequestIdFromQuery;
        setSelectedVenueId(String(restoredDraft.venue_id || baseVenue?.id || ''));
        setSelectedEventId(String(restoredDraft.id || approvalRequest.linked_record_id || approvalRequest.source_record_id || ''));
        setShowRoomDiscountModal(false);
        setEventDraft({
            ...restoredDraft,
            approval_request_id: approvalRequest.id,
            venue_id: String(restoredDraft.venue_id || baseVenue?.id || ''),
            venue_name: String(restoredDraft.venue_name || baseVenue?.name || ''),
            venue_rate: String(restoredDraft.venue_rate !== '' ? restoredDraft.venue_rate : (baseVenue?.base_rate || '')),
            venue_pricing_mode: restoredDraft.venue_pricing_mode || baseVenue?.pricing_mode || 'PER_EVENT',
            finance_sync: restoredDraft.finance_sync || createDefaultFinanceSync()
        });
        setEventModalOpen(true);

        if (approvalRequest.status === 'APPROVED' && !approvalRequest.source_applied_at) {
            setFeedback({ type: 'success', text: 'Approval completed. Event POS is syncing the approved event back to the venue board now.' });
            return;
        }
        if (approvalRequest.status === 'PENDING') {
            setFeedback({ type: 'success', text: 'Approval request sent. The event draft has been restored while the approver queue reviews it.' });
            return;
        }
        if (approvalRequest.status === 'REJECTED') {
            setFeedback({ type: 'error', text: 'Approval was rejected. Revise the draft and resubmit from the company approval workflow.' });
            return;
        }

        setFeedback(null);
    }, [approvalRequestIdFromQuery, approvalRequestMap, normalizedEvents, venueMap]);

    useEffect(() => {
        const loadRoomTypes = async () => {
            try {
                const primaryResponse = await fetch(`/api/admin/room-types?hotel=${currentHotelCode}`);
                const primaryData = await primaryResponse.json().catch(() => ({}));
                const roomTypeSource = primaryData?.success && Array.isArray(primaryData.rooms)
                    ? primaryData.rooms
                    : null;

                if (roomTypeSource) {
                    const mapped = mapRoomTypeCatalog(roomTypeSource);
                    setRoomTypeRateMap(mapped.reduce((map, roomType) => {
                        map[roomType.name] = roomType;
                        return map;
                    }, {}));
                    return;
                }

                const fallbackResponse = await fetch(`/api/room-types?hotel=${currentHotelCode}`);
                const fallbackData = await fallbackResponse.json().catch(() => ([]));
                const mapped = mapRoomTypeCatalog(Array.isArray(fallbackData) ? fallbackData : []);
                setRoomTypeRateMap(mapped.reduce((map, roomType) => {
                    map[roomType.name] = roomType;
                    return map;
                }, {}));
            } catch {
                setRoomTypeRateMap({});
            }
        };

        if (currentHotelCode) {
            loadRoomTypes();
        }
    }, [currentHotelCode]);

    useEffect(() => {
        if (!venueCards.length) {
            setSelectedVenueId('');
            return;
        }

        if (!selectedVenueId || !venueCards.some((venueCard) => String(venueCard.id) === String(selectedVenueId))) {
            setSelectedVenueId(venueCards[0].id);
        }
    }, [selectedVenueId, venueCards]);

    useEffect(() => {
        if (!selectedVenueEvents.length) {
            setSelectedEventId('');
            applySuggestedPayment(null);
            return;
        }

        if (!selectedEventId || !selectedVenueEvents.some((eventItem) => String(eventItem.id) === String(selectedEventId))) {
            setSelectedEventId(selectedVenueEvents[0].id);
            return;
        }

        if (selectedEvent) {
            applySuggestedPayment(selectedEvent);
        }
    }, [selectedEvent, selectedEventId, selectedVenueEvents]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setActivityPage(1);
    }, [activityEndDate, activitySearch, activityStartDate]);

    useEffect(() => {
        setReceiptPage(1);
    }, [receiptEndDate, receiptSearch, receiptStartDate]);

    useEffect(() => {
        const nextCandidate = approvalRequests
            .map(normalizeApprovalRequest)
            .filter((request) => (
                request.status === 'APPROVED'
                && !request.source_applied_at
                && request.type === 'EVENT_PAYMENT'
                && request.source_module === 'EVENT_POS'
                && request.payload?.event_draft
            ))
            .sort((left, right) => (
                String(left.approved_at || left.updated_at || '').localeCompare(String(right.approved_at || right.updated_at || ''))
            ))
            .find((request) => (
                !autoApplyInFlightRef.current.has(request.id)
                && autoApplyFailureRef.current[request.id] !== request.updated_at
            ));

        if (!nextCandidate) return;

        autoApplyInFlightRef.current.add(nextCandidate.id);

        (async () => {
            try {
                await applyApprovedRequestToSource({
                    request: nextCandidate,
                    actor: AUTO_APPLY_WORKFLOW_ACTOR,
                    focusSavedEvent: false,
                    closeModalOnSuccess: false,
                    navigateOnSuccess: false,
                    silent: true
                });
            } catch (error) {
                autoApplyFailureRef.current[nextCandidate.id] = nextCandidate.updated_at;
                setFeedback({
                    type: 'error',
                    text: `${nextCandidate.title || nextCandidate.subject || 'Approved event'} sync failed. ${error.message || 'Please refresh and review the approval record.'}`
                });
                recordAuditLog(`[Approval Workflow] Auto-sync failed for request ${nextCandidate.id}: ${error.message || 'Unknown error'}`);
            } finally {
                autoApplyInFlightRef.current.delete(nextCandidate.id);
            }
        })();
    }, [approvalRequests]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!pgSession?.token || String(pgSession.status || '').toUpperCase() === 'PAID') return;

        let cancelled = false;
        const pollGatewayPayment = async () => {
            try {
                const response = await fetch(`/api/pos/rewards/payment-intents/${encodeURIComponent(pgSession.token)}?hotel_code=${encodeURIComponent(currentHotelCode)}`);
                const data = await response.json().catch(() => ({}));
                const intent = data?.intent;
                if (!response.ok || !intent || cancelled) return;

                const nextStatus = String(intent.status || '').toUpperCase();
                if (nextStatus === 'PAID') {
                    if (pgSessionSavedRef.current) return;
                    pgSessionSavedRef.current = true;

                    const paidAmount = Math.round(Number(intent.currency_amount || intent.amount || pgSession.amount || 0));
                    const eventItem = normalizedEvents.find((currentEvent) => currentEvent.id === pgSession.eventId);
                    if (!eventItem) {
                        if (!cancelled) {
                            setFeedback({ type: 'error', text: 'Payment approved, but the event record is no longer available.' });
                            setPgSession(null);
                        }
                        return;
                    }

                    try {
                        const nextNote = [pgSession.note, intent.token ? `PG Ref: ${intent.token}` : ''].filter(Boolean).join(' · ');
                        const { syncedEvent, warnings } = await finalizeEventPayment({
                            eventItem,
                            amount: paidAmount,
                            methodValue: pgSession.method,
                            collectionTypeValue: pgSession.collectionType,
                            noteValue: nextNote,
                            approvalMeta: {
                                provider: pgSession.provider,
                                gateway_reference: String(intent.token || ''),
                                gateway_url: String(intent.payment_url || pgSession.payment_url || ''),
                                approval_status: 'APPROVED',
                                verified_at: new Date().toISOString()
                            }
                        });

                        if (!cancelled) {
                            setSelectedEventId(syncedEvent.id);
                            setPgSession(null);
                            setFeedback({
                                type: warnings.length > 0 ? 'error' : 'success',
                                text: warnings.length > 0
                                    ? `PG payment approved for ${syncedEvent.title}, but ${warnings.join(' / ')}`
                                    : `${formatCurrency(paidAmount)} PG payment approved for ${syncedEvent.title}.`
                            });
                        }
                    } catch (error) {
                        if (!cancelled) {
                            setFeedback({ type: 'error', text: `Gateway approved, but saving failed: ${error.message || 'unknown error'}` });
                            setPgSession((prev) => prev ? { ...prev, status: 'APPROVED' } : null);
                        }
                    }
                } else if (nextStatus === 'EXPIRED') {
                    if (!cancelled) {
                        setPgSession((prev) => prev ? { ...prev, status: 'EXPIRED' } : null);
                        setFeedback({ type: 'error', text: 'PG checkout expired before payment approval.' });
                    }
                } else if (!cancelled) {
                    setPgSession((prev) => prev ? { ...prev, status: nextStatus } : null);
                }
            } catch (error) {
                console.error('Event POS PG polling failed:', error);
            }
        };

        pollGatewayPayment();
        const timer = window.setInterval(pollGatewayPayment, 2500);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [currentHotelCode, normalizedEvents, pgSession?.eventId, pgSession?.status, pgSession?.token]); // eslint-disable-line react-hooks/exhaustive-deps

    const postFinanceTransaction = async ({ type, category, amount, description }) => {
        const normalizedAmount = Math.abs(Number(amount) || 0);
        if (!normalizedAmount) return;

        const response = await fetch('/api/finance/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: getFinanceTimestamp(),
                type,
                category,
                amount: normalizedAmount,
                description,
                user_id: currentUser,
                hotel_code: currentHotelCode
            })
        });

        if (!response.ok) {
            throw new Error(`Finance sync failed for ${category} (HTTP ${response.status})`);
        }
    };

    const parseJsonSafely = async (response) => {
        try {
            return await response.json();
        } catch {
            return null;
        }
    };

    const fetchHotelRoomsSnapshot = async () => {
        if (!currentHotelCode) return [];

        const response = await fetch(`/api/rooms?hotel=${encodeURIComponent(currentHotelCode)}&t=${Date.now()}`, {
            cache: 'no-store'
        });
        const data = await parseJsonSafely(response);

        if (!response.ok) {
            throw new Error(`Unable to load hotel rooms for reservation sync (HTTP ${response.status})`);
        }

        return Array.isArray(data) ? data : [];
    };

    const deleteEventReservation = async (reservationId) => {
        if (!reservationId || !currentHotelCode) return;

        const response = await fetch(`/api/reservations/${encodeURIComponent(reservationId)}?hotel=${encodeURIComponent(currentHotelCode)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`Room reservation release failed for ${reservationId} (HTTP ${response.status})`);
        }
    };

    const findCreatedReservationId = async (payload) => {
        if (!currentHotelCode) return '';

        const response = await fetch(`/api/reservations?hotel=${encodeURIComponent(currentHotelCode)}&t=${Date.now()}`, {
            cache: 'no-store'
        });
        const data = await parseJsonSafely(response);
        if (!response.ok || !Array.isArray(data)) return '';

        const exactMatch = data.find((reservation) => (
            String(reservation?.guest_name || '').trim() === payload.guest_name
            && String(reservation?.channel || '').trim() === payload.channel
            && String(reservation?.room_type || '').trim() === payload.room_type
            && String(reservation?.check_in_date || '').trim() === payload.check_in_date
            && String(reservation?.check_out_date || '').trim() === payload.check_out_date
        ));

        return String(exactMatch?.res_id || exactMatch?.id || '').trim();
    };

    const createEventReservation = async ({ eventItem, block, roomId }) => {
        const payload = {
            guest_name: `[EVENT HOLD] ${eventItem.title} / Room ${roomId}`,
            channel: 'Event Block',
            room_type: block.room_type,
            check_in_date: block.check_in_date || eventItem.start_date,
            check_out_date: block.check_out_date || eventItem.end_date,
            phone: eventItem.contact_phone || '',
            email: eventItem.contact_email || '',
            hotel_code: currentHotelCode
        };

        const response = await fetch('/api/reservations/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await parseJsonSafely(response);

        if (!response.ok) {
            throw new Error(data?.message || `Room reservation sync failed for Room ${roomId} (HTTP ${response.status})`);
        }

        const directId = String(
            data?.reservation?.res_id
            || data?.reservation?.id
            || data?.res_id
            || data?.id
            || ''
        ).trim();

        if (directId) return directId;
        return findCreatedReservationId(payload);
    };

    const releaseEventReservations = async (eventItem) => {
        const warnings = [];
        const reservationIds = Array.from(
            new Set((eventItem?.room_blocks || []).flatMap((block) => normalizeRoomBlock(block).reservation_ids || []).filter(Boolean))
        );

        for (const reservationId of reservationIds) {
            try {
                await deleteEventReservation(reservationId);
            } catch (error) {
                warnings.push(error.message || `Unable to release room reservation ${reservationId}.`);
            }
        }

        return warnings;
    };

    const syncEventReservations = async (nextEvent, previousEvent) => {
        const warnings = await releaseEventReservations(previousEvent);
        const shouldSyncReservations = shouldSyncRoomBlock(nextEvent);

        const nextBlocks = await Promise.all((nextEvent.room_blocks || []).map(async (block) => {
            const normalizedBlock = normalizeRoomBlock(block);

            if (!shouldSyncReservations) {
                return {
                    ...normalizedBlock,
                    reservation_ids: []
                };
            }

            const assignedRoomIds = Array.from(new Set(normalizedBlock.assigned_room_ids || [])).slice(0, Number(normalizedBlock.quantity || 0));
            if (!assignedRoomIds.length) {
                if (Number(normalizedBlock.quantity || 0) > 0) {
                    warnings.push(`No reservation record was created for ${normalizedBlock.room_type || 'room block'} because no physical room IDs were assigned yet.`);
                }
                return {
                    ...normalizedBlock,
                    reservation_ids: []
                };
            }

            if (assignedRoomIds.length < Number(normalizedBlock.quantity || 0)) {
                warnings.push(`${normalizedBlock.room_type || 'Room block'} reserved ${assignedRoomIds.length} of ${normalizedBlock.quantity} requested room(s).`);
            }

            const reservationIds = [];

            for (const roomId of assignedRoomIds) {
                try {
                    const reservationId = await createEventReservation({
                        eventItem: nextEvent,
                        block: normalizedBlock,
                        roomId
                    });

                    if (reservationId) {
                        reservationIds.push(String(reservationId));
                    } else {
                        warnings.push(`Room ${roomId} was created in Reservations, but its reservation ID could not be read back automatically.`);
                    }
                } catch (error) {
                    warnings.push(error.message || `Unable to sync reservation for Room ${roomId}.`);
                }
            }

            return {
                ...normalizedBlock,
                reservation_ids: reservationIds
            };
        }));

        return {
            event: {
                ...nextEvent,
                room_blocks: nextBlocks
            },
            warnings
        };
    };

    const syncFinanceForEvent = async (nextEvent, previousEvent) => {
        const previousSync = {
            ...createDefaultFinanceSync(),
            ...(previousEvent?.finance_sync || {})
        };

        const shouldSyncRevenue = ['CONFIRMED', 'OPERATION', 'COMPLETED'].includes(String(nextEvent.status || '').toUpperCase());
        const targetBanquetRevenue = shouldSyncRevenue
            ? (
                getVenueNetTotal(nextEvent, venueMap)
                + getEventOptionsTotal(nextEvent.option_items)
                + getOtherRevenueTotal(nextEvent)
                + getEventPosOrdersTotal(nextEvent)
            )
            : 0;
        const targetCateringRevenue = shouldSyncRevenue ? getCateringTotal(nextEvent.catering_items) : 0;
        const targetRoomRevenue = shouldSyncRevenue ? getRoomBlocksRevenue(nextEvent, roomTypeRateMap) : 0;
        const targetDepositRevenue = String(nextEvent.status || '').toUpperCase() === 'CANCELLED'
            ? 0
            : Math.max(0, Number(nextEvent.deposit_amount || 0));

        const syncTargets = [
            {
                key: 'banquet_revenue',
                target: targetBanquetRevenue,
                category: 'Banquet Revenue',
                description: `${nextEvent.title} / ${nextEvent.venue_name || 'Venue'}`
            },
            {
                key: 'catering_revenue',
                target: targetCateringRevenue,
                category: 'Catering Revenue',
                description: `${nextEvent.title} / Catering`
            },
            {
                key: 'room_block_revenue',
                target: targetRoomRevenue,
                category: 'Group Room Block Revenue',
                description: `${nextEvent.title} / Linked room block`
            },
            {
                key: 'event_deposit',
                target: targetDepositRevenue,
                category: 'Event Deposit',
                description: `${nextEvent.title} / Deposit`
            }
        ];

        const nextSync = { ...previousSync, last_error: '' };
        const syncErrors = [];

        for (const syncItem of syncTargets) {
            const alreadySynced = Math.round((Number(previousSync[syncItem.key] || 0) + Number.EPSILON) * 100) / 100;
            const targetAmount = Math.round((Number(syncItem.target || 0) + Number.EPSILON) * 100) / 100;
            const delta = Math.round(((targetAmount - alreadySynced) + Number.EPSILON) * 100) / 100;

            if (Math.abs(delta) < 0.01) {
                nextSync[syncItem.key] = targetAmount;
                continue;
            }

            try {
                await postFinanceTransaction({
                    type: delta >= 0 ? 'REVENUE' : 'EXPENSE',
                    category: syncItem.category,
                    amount: delta,
                    description: `${syncItem.description}${delta < 0 ? ' (Adjustment / reversal)' : ''}`
                });
                nextSync[syncItem.key] = targetAmount;
            } catch (error) {
                syncErrors.push(error.message || `Unable to sync ${syncItem.category}.`);
                nextSync[syncItem.key] = alreadySynced;
            }
        }

        nextSync.synced_at = syncErrors.length ? previousSync.synced_at || '' : new Date().toISOString();
        nextSync.last_error = syncErrors.join('\n');

        return {
            ...nextEvent,
            finance_sync: nextSync
        };
    };

    const createPaymentReceipt = async ({ eventItem, amount, collectionTypeValue, methodValue }) => {
        const receiptResponse = await fetch('/api/receipts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hotel_code: currentHotelCode,
                department: `POS ${storeInfo.name}`,
                date: getHotelDate(0),
                amount,
                event_id: String(eventItem.id || '').trim(),
                event_title: String(eventItem.title || '').trim(),
                approval_request_id: String(eventItem.approval_request_id || '').trim(),
                source_module: 'EVENT_POS',
                guest_name: eventItem.client_name || eventItem.title || 'Event Guest',
                description: `${eventItem.title} / ${getCollectionLabel(collectionTypeValue)} via ${getPaymentMethodLabel(methodValue)}`,
                cart_data: [
                    {
                        name: `${eventItem.title} Event Payment`,
                        selectedSize: getCollectionLabel(collectionTypeValue),
                        quantity: 1,
                        price: amount
                    }
                ],
                user_id: currentUser
            })
        });

        if (!receiptResponse.ok) {
            throw new Error(`Receipt creation failed (HTTP ${receiptResponse.status})`);
        }
    };

    const finalizeEventPayment = async ({
        eventItem,
        amount,
        methodValue,
        collectionTypeValue,
        noteValue,
        approvalMeta = {}
    }) => {
        const nextEvent = normalizeEventRecord({
            ...eventItem,
            deposit_amount: collectionTypeValue === 'DEPOSIT'
                ? Math.max(Number(eventItem.deposit_amount || 0), amount)
                : Number(eventItem.deposit_amount || 0),
            payments: [
                ...(eventItem.payments || []),
                normalizeEventPaymentRecord({
                    amount,
                    method: methodValue,
                    collection_type: collectionTypeValue,
                    pos_store_id: storeInfo.id,
                    pos_store_name: storeInfo.name,
                    note: noteValue,
                    paid_at: new Date().toISOString(),
                    ...approvalMeta
                })
            ],
            updated_at: new Date().toISOString()
        });

        const syncedEvent = await syncFinanceForEvent(nextEvent, eventItem);
        const nextEvents = normalizedEvents.map((existingEvent) => (
            existingEvent.id === syncedEvent.id ? syncedEvent : existingEvent
        ));

        persistEvents(nextEvents);

        const warnings = [];
        try {
            await createPaymentReceipt({
                eventItem: syncedEvent,
                amount,
                collectionTypeValue,
                methodValue
            });
            await loadReceipts();
        } catch (receiptError) {
            warnings.push(receiptError.message);
        }

        if (syncedEvent.finance_sync?.last_error) {
            warnings.push(syncedEvent.finance_sync.last_error);
        }

        applySuggestedPayment(syncedEvent);
        setPaymentAmount('');
        setPaymentNote('');

        return {
            syncedEvent,
            warnings
        };
    };

    const launchGatewayPayment = async () => {
        if (!selectedEvent) {
            setFeedback({ type: 'error', text: 'Create or select an event record first.' });
            return;
        }

        const amount = Math.max(0, Number(paymentAmount) || 0);
        if (!amount) {
            setFeedback({ type: 'error', text: 'Enter a valid payment amount.' });
            return;
        }

        setIsLaunchingGateway(true);
        setFeedback(null);
        pgSessionSavedRef.current = false;

        try {
            const response = await fetch('/api/pos/rewards/payment-intents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hotel_code: currentHotelCode,
                    amount,
                    store_id: String(storeInfo.id || ''),
                    store_name: storeInfo.name || 'Event POS',
                    table_number: `EVENT-${selectedEvent.id}`,
                    payment_method: paymentMethod,
                    collection_type: collectionType,
                    note: paymentNote,
                    event_id: selectedEvent.id,
                    event_title: selectedEvent.title
                })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data?.success) {
                throw new Error(data?.message || `HTTP ${response.status}`);
            }

            setPgSession({
                token: String(data.token || ''),
                qr_image_url: String(data.qr_image_url || ''),
                payment_url: String(data.payment_url || ''),
                status: 'PENDING',
                amount,
                eventId: selectedEvent.id,
                method: paymentMethod,
                collectionType,
                note: paymentNote,
                provider: activeGatewayLabel
            });
            setFeedback({
                type: 'success',
                text: `${getPaymentMethodLabel(paymentMethod)} checkout started. The payment will be saved after PG approval.`
            });
        } catch (error) {
            setFeedback({ type: 'error', text: error.message || 'Unable to start PG checkout.' });
        } finally {
            setIsLaunchingGateway(false);
        }
    };

    const getItemQty = (itemId) => cart.filter((item) => item.id === itemId).reduce((sum, item) => sum + item.quantity, 0);

    const addToCart = (item, sizeOption) => {
        const cartId = `${item.id}-${sizeOption.name}`;
        setCart((prev) => {
            const existing = prev.find((entry) => entry.cartId === cartId);
            if (existing) {
                return prev.map((entry) => (
                    entry.cartId === cartId ? { ...entry, quantity: entry.quantity + 1 } : entry
                ));
            }

            return [
                ...prev,
                {
                    ...item,
                    cartId,
                    price: parseFloat(sizeOption.price),
                    selectedSize: sizeOption.name,
                    quantity: 1
                }
            ];
        });
        setSizeModalData(null);
    };

    const removeFromCart = (cartId) => {
        setCart((prev) => {
            const existing = prev.find((item) => item.cartId === cartId);
            if (existing && existing.quantity > 1) {
                return prev.map((item) => (
                    item.cartId === cartId ? { ...item, quantity: item.quantity - 1 } : item
                ));
            }
            return prev.filter((item) => item.cartId !== cartId);
        });
    };

    const handleItemClick = (item) => {
        if (item.sizes && item.sizes.length > 1) {
            setSizeModalData(item);
            return;
        }

        addToCart(item, item.sizes && item.sizes.length > 0 ? item.sizes[0] : { name: 'Regular', price: item.price });
    };

    const handleRefresh = async () => {
        setEvents(loadBanquetEvents(currentHotelCode));
        setVenues(loadBanquetVenues(currentHotelCode));
        setApprovalArchives(loadBanquetApprovalArchives(currentHotelCode));
        setApprovalRequests(loadCompanyApprovalRequests(currentHotelCode));
        await loadReceipts();
        setFeedback({ type: 'success', text: 'Venue board and event records refreshed.' });
    };

    const openEventModal = (venueCard, eventItem = null) => {
        const baseVenue = venueMap[venueCard?.id] || venueCard || null;
        const baseDraft = eventItem ? normalizeEventRecord(eventItem) : createDefaultEventDraft();

        setSelectedVenueId(String(baseVenue?.id || ''));
        setShowRoomDiscountModal(false);
        restoredApprovalRequestRef.current = approvalRequestIdFromQuery || '';
        setEventDraft({
            ...baseDraft,
            venue_id: String(baseDraft.venue_id || baseVenue?.id || ''),
            venue_name: String(baseDraft.venue_name || baseVenue?.name || ''),
            venue_rate: String(baseDraft.venue_rate !== '' ? baseDraft.venue_rate : (baseVenue?.base_rate || '')),
            venue_pricing_mode: baseDraft.venue_pricing_mode || baseVenue?.pricing_mode || 'PER_EVENT',
            finance_sync: baseDraft.finance_sync || createDefaultFinanceSync()
        });
        setEventModalOpen(true);
    };

    const closeEventModal = () => {
        setEventModalOpen(false);
        setShowRoomDiscountModal(false);
        setEventDraft(createDefaultEventDraft());
        if (approvalRequestIdFromQuery) {
            navigate(location.pathname, { replace: true });
        }
    };

    const handlePayEvent = (venueCard, eventItem) => {
        setSelectedVenueId(String(venueCard?.id || ''));
        setSelectedEventId(String(eventItem?.id || ''));
        setFeedback(null);
        if (eventItem) {
            applySuggestedPayment(eventItem);
        }
    };

    const handleEditEvent = (venueCard, eventItem) => {
        setSelectedVenueId(String(venueCard?.id || ''));
        setSelectedEventId(String(eventItem?.id || ''));
        setFeedback(null);
        openEventModal(venueCard, eventItem);
    };

    const handleCreateReservation = (venueCard) => {
        setSelectedVenueId(String(venueCard?.id || ''));
        setSelectedEventId('');
        setFeedback(null);
        openEventModal(venueCard);
    };

    const handleEventDraftVenueSelection = (venueId) => {
        const selectedVenue = venueMap[venueId] || null;

        if (!selectedVenue) {
            setEventDraft((prev) => ({
                ...prev,
                venue_id: '',
                venue_name: '',
                venue_rate: '',
                venue_pricing_mode: 'PER_EVENT'
            }));
            return;
        }

        setSelectedVenueId(selectedVenue.id);
        setEventDraft((prev) => ({
            ...prev,
            venue_id: selectedVenue.id,
            venue_name: selectedVenue.name,
            venue_rate: String(selectedVenue.base_rate || ''),
            venue_pricing_mode: selectedVenue.pricing_mode
        }));
    };

    const handleVenueSelection = handleEventDraftVenueSelection;

    const resetEventDraft = () => {
        const baseVenue = venueMap[selectedVenueId] || selectedVenueCard || null;
        setShowRoomDiscountModal(false);
        setEventDraft({
            ...createDefaultEventDraft(),
            venue_id: String(baseVenue?.id || ''),
            venue_name: String(baseVenue?.name || ''),
            venue_rate: String(baseVenue?.base_rate || ''),
            venue_pricing_mode: baseVenue?.pricing_mode || 'PER_EVENT',
            finance_sync: createDefaultFinanceSync()
        });
    };

    const addRoomBlockToDraft = (roomTypeName = '') => {
        const roomTypeMeta = roomTypeRateMap[roomTypeName] || roomTypeOptions[0] || null;
        const nextCheckInDate = String(draft.start_date || '').trim() || buildLocalDateInput(0);
        const nextCheckOutDate = String(draft.end_date || '').trim() && String(draft.end_date || '') > nextCheckInDate
            ? String(draft.end_date || '').trim()
            : getNextDateInput(nextCheckInDate);
        const nextRoomBlock = createRoomBlock(roomTypeMeta?.name || '', roomTypeMeta?.baseRate || '');

        setDraft((prev) => ({
            ...prev,
            room_blocks: [
                ...(prev.room_blocks || []),
                {
                    ...nextRoomBlock,
                    check_in_date: nextCheckInDate,
                    check_out_date: nextCheckOutDate
                }
            ]
        }));
    };

    const updateDraftRoomBlock = (blockId, key, value) => {
        setDraft((prev) => ({
            ...prev,
            room_blocks: (prev.room_blocks || []).map((block) => {
                if (block.id !== blockId) return block;

                const nextBlock = { ...block, [key]: value };
                if (key === 'room_type') {
                    const roomTypeMeta = roomTypeRateMap[value];
                    nextBlock.nightly_rate = String(roomTypeMeta?.baseRate || '');
                }
                if (key === 'check_in_date' && (!String(nextBlock.check_out_date || '').trim() || String(nextBlock.check_out_date || '') <= String(value || ''))) {
                    nextBlock.check_out_date = getNextDateInput(value);
                }
                return nextBlock;
            })
        }));
    };

    const removeDraftRoomBlock = (blockId) => {
        setDraft((prev) => ({
            ...prev,
            room_blocks: (prev.room_blocks || []).filter((block) => block.id !== blockId)
        }));
    };

    const addCateringItemToDraft = (template = {}) => {
        setDraft((prev) => ({
            ...prev,
            catering_items: [
                ...(prev.catering_items || []),
                createCateringItem({
                    ...template,
                    pax_count: Number(prev.pax || 0) || Number(template.pax_count || 0) || 0
                })
            ]
        }));
    };

    const updateDraftCateringItem = (itemId, key, value) => {
        setDraft((prev) => ({
            ...prev,
            catering_items: (prev.catering_items || []).map((item) => (
                item.id === itemId ? { ...item, [key]: value } : item
            ))
        }));
    };

    const removeDraftCateringItem = (itemId) => {
        setDraft((prev) => ({
            ...prev,
            catering_items: (prev.catering_items || []).filter((item) => item.id !== itemId)
        }));
    };

    const addOptionItemToDraft = (template = {}) => {
        setDraft((prev) => ({
            ...prev,
            option_items: [
                ...(prev.option_items || []),
                createEventOptionItem(template)
            ]
        }));
    };

    const updateDraftOptionItem = (itemId, key, value) => {
        setDraft((prev) => ({
            ...prev,
            option_items: (prev.option_items || []).map((item) => (
                item.id === itemId ? { ...item, [key]: value } : item
            ))
        }));
    };

    const removeDraftOptionItem = (itemId) => {
        setDraft((prev) => ({
            ...prev,
            option_items: (prev.option_items || []).filter((item) => item.id !== itemId)
        }));
    };

    const handleEventDraftStartDateChange = (value) => {
        setEventDraft((prev) => ({
            ...prev,
            start_date: value,
            end_date: !String(prev.end_date || '').trim() || String(prev.end_date || '') <= String(value || '')
                ? getNextDateInput(value)
                : prev.end_date
        }));
    };

    const validateEventDraft = (draftSource = eventDraft) => {
        const normalizedDraft = normalizeEventRecord(draftSource);

        if (!String(normalizedDraft.title || '').trim()) return 'Event title is required.';
        if (!String(normalizedDraft.client_name || '').trim()) return 'Client name is required.';
        if (!String(normalizedDraft.start_date || '').trim()) return 'Start date is required.';
        if (!String(normalizedDraft.end_date || '').trim()) return 'End date is required.';
        if (String(normalizedDraft.end_date || '') < String(normalizedDraft.start_date || '')) return 'End date cannot be earlier than the start date.';
        if (!String(normalizedDraft.venue_name || '').trim()) return 'Select a venue card first.';

        const invalidRoomBlock = (normalizedDraft.room_blocks || [])
            .map(normalizeRoomBlock)
            .find((block) => String(block.check_out_date || '') <= String(block.check_in_date || ''));

        if (invalidRoomBlock) {
            return `Room block check-out must be later than check-in for ${invalidRoomBlock.room_type || 'the linked room block'}.`;
        }

        return '';
    };

    const openPdfDataUrl = (pdfDataUrl, emptyMessage) => {
        if (!pdfDataUrl) {
            alert(emptyMessage);
            return;
        }

        const pdfWindow = window.open('');
        if (!pdfWindow) {
            alert('Please allow pop-ups to view the approval PDF.');
            return;
        }

        pdfWindow.document.write(
            `<iframe width="100%" height="100%" style="border:none;" src="${pdfDataUrl}"></iframe>`
        );
    };

    const handleViewApprovalArchivePdf = (archiveId) => {
        const archive = approvalArchiveMap[archiveId];
        openPdfDataUrl(archive?.pdf_data_url, 'No approval PDF archive was found for this event.');
    };

    const handleViewApprovalRequestPdf = (request) => {
        openPdfDataUrl(request?.archive?.pdf_data_url, 'No approval request PDF was found for this event.');
    };

    const buildApprovalSummarySnapshot = (eventItem = draft) => {
        const normalizedEvent = normalizeEventRecord(eventItem);
        const venueFinal = getVenueNetTotal(normalizedEvent, venueMap);
        const cateringTotal = getCateringTotal(normalizedEvent.catering_items);
        const optionTotal = getEventOptionsTotal(normalizedEvent.option_items);
        const roomBase = getRoomBlocksBaseRevenue(normalizedEvent.room_blocks, roomTypeRateMap);
        const roomDiscount = getRoomDiscountAmount(normalizedEvent, roomTypeRateMap);
        const roomNet = getRoomBlocksRevenue(normalizedEvent, roomTypeRateMap);
        const manualCharges = getOtherRevenueTotal(normalizedEvent);
        const posCharges = getEventPosOrdersTotal(normalizedEvent);
        const finalAmount = getEventGrandTotal(normalizedEvent, { venueMap, roomTypeRateMap });
        const paidToDate = getEventPaymentsTotal(normalizedEvent);

        return {
            title: normalizedEvent.title,
            client_name: normalizedEvent.client_name,
            company_name: normalizedEvent.company_name,
            event_type: normalizedEvent.event_type,
            status: normalizedEvent.status,
            start_date: normalizedEvent.start_date,
            end_date: normalizedEvent.end_date,
            start_time: normalizedEvent.start_time,
            end_time: normalizedEvent.end_time,
            venue_name: normalizedEvent.venue_name,
            pax: Number(normalizedEvent.pax || 0),
            room_count: (normalizedEvent.room_blocks || []).reduce((sum, block) => sum + (Number(block.quantity) || 0), 0),
            venue_final: venueFinal,
            catering_total: cateringTotal,
            option_total: optionTotal,
            room_base: roomBase,
            room_discount: roomDiscount,
            room_net: roomNet,
            manual_charges: manualCharges,
            pos_charges: posCharges,
            final_amount: finalAmount,
            deposit_target: Number(normalizedEvent.deposit_amount || 0),
            paid_to_date: paidToDate,
            balance_due: Math.max(0, finalAmount - paidToDate),
            notes: normalizedEvent.notes
        };
    };

    const getLatestApprovedApprover = (request) => {
        const normalizedRequest = normalizeApprovalRequest(request);
        return [...normalizedRequest.approvers]
            .filter((approver) => approver.status === 'APPROVED')
            .sort((left, right) => String(right.acted_at || '').localeCompare(String(left.acted_at || '')))[0]
            || null;
    };

    const createEventApprovalArchiveFromRequest = (request, sourceEvent = null) => {
        const normalizedRequest = normalizeApprovalRequest(request);
        if (!normalizedRequest.archive?.pdf_data_url) return null;

        const approvedApprover = getLatestApprovedApprover(normalizedRequest);
        const summary = normalizedRequest.summary || {};
        const approvedAt = normalizedRequest.approved_at || approvedApprover?.acted_at || normalizedRequest.archive.created_at || new Date().toISOString();
        const sourceRecord = normalizeEventRecord(
            sourceEvent
            || normalizedRequest.payload?.event_draft
            || draft
        );

        return normalizeEventApprovalArchive({
            id: normalizedRequest.archive.id,
            created_at: normalizedRequest.archive.created_at || approvedAt,
            approved_at: approvedAt,
            hotel_code: currentHotelCode,
            event_id: String(sourceRecord.id || normalizedRequest.linked_record_id || normalizedRequest.source_record_id || '').trim(),
            event_title: String(summary.title || normalizedRequest.source_record_title || sourceRecord.title || '').trim(),
            client_name: String(summary.client_name || sourceRecord.client_name || '').trim(),
            venue_name: String(summary.venue_name || sourceRecord.venue_name || '').trim(),
            approver_id: approvedApprover?.user_id || '',
            approver_name: approvedApprover?.user_name || approvedApprover?.user_id || '',
            approver_role: approvedApprover?.role || '',
            pdf_data_url: normalizedRequest.archive.pdf_data_url,
            pdf_file_name: normalizedRequest.archive.file_name,
            event_snapshot: {
                ...summary,
                request_note: normalizedRequest.request_note,
                decision_note: normalizedRequest.decision_note,
                approval_request_id: normalizedRequest.id
            }
        });
    };

    const buildEventApprovalMetaFromRequest = (request, approvalArchive) => {
        const normalizedRequest = normalizeApprovalRequest(request);
        const approvedApprover = getLatestApprovedApprover(normalizedRequest);

        return normalizeEventApprovalMeta({
            status: 'APPROVED',
            archive_id: approvalArchive?.id || '',
            approved_at: normalizedRequest.approved_at || approvedApprover?.acted_at || approvalArchive?.approved_at || '',
            approver_id: approvedApprover?.user_id || '',
            approver_name: approvedApprover?.user_name || approvedApprover?.user_id || '',
            approver_role: approvedApprover?.role || '',
            pdf_file_name: approvalArchive?.pdf_file_name || normalizedRequest.archive?.file_name || ''
        }, 'APPROVED');
    };

    const buildLinkedApprovalDraft = (existingRequest = null) => {
        const requester = createApprovalParty({
            userId: currentUser,
            userName: currentUserName,
            role: currentUserRole
        });
        const baseRequest = existingRequest
            ? normalizeApprovalRequest(existingRequest)
            : createApprovalRequestDraft({
                hotelCode: currentHotelCode,
                type: 'EVENT_PAYMENT',
                title: '',
                subject: '',
                sourceModule: 'EVENT_POS',
                sourcePath: location.pathname,
                sourceLabel: storeInfo?.name || 'Event POS',
                sourceRecordId: String(draft.id || ''),
                sourceRecordTitle: String(draft.title || draft.client_name || 'Event Draft'),
                requester,
                summary: {},
                payload: {}
            });
        const normalizedDraft = normalizeEventRecord({
            ...draft,
            approval_request_id: baseRequest.id
        });
        const draftLabel = normalizedDraft.title || normalizedDraft.client_name || normalizedDraft.venue_name || 'Banquet Event';

        return normalizeApprovalRequest({
            ...baseRequest,
            hotel_code: currentHotelCode,
            type: 'EVENT_PAYMENT',
            title: baseRequest.title || `${draftLabel} Payment Approval`,
            subject: baseRequest.subject || `${draftLabel} payment approval`,
            source_module: 'EVENT_POS',
            source_path: getApprovalSourcePath(location.pathname, baseRequest.id),
            source_label: storeInfo?.name || 'Event POS',
            source_record_id: String(normalizedDraft.id || ''),
            source_record_title: String(normalizedDraft.title || normalizedDraft.client_name || baseRequest.source_record_title || 'Event Draft'),
            requested_by: requester,
            summary: buildApprovalSummarySnapshot(normalizedDraft),
            payload: {
                ...(baseRequest.payload && typeof baseRequest.payload === 'object' ? baseRequest.payload : {}),
                event_draft: normalizedDraft,
                source_store_id: String(storeInfo?.id || ''),
                source_store_location: String(storeInfo?.location || ''),
                source_store_name: String(storeInfo?.name || '')
            },
            updated_at: new Date().toISOString()
        });
    };

    const persistEventRecord = async ({ approvalMeta, sourceDraft = eventDraft, focusSavedEvent = true, clearFeedback = true }) => {
        const normalizedSourceDraft = normalizeEventRecord(sourceDraft);
        const validationError = validateEventDraft(normalizedSourceDraft);
        if (validationError) {
            throw new Error(validationError);
        }

        setIsSavingEvent(true);
        if (clearFeedback) {
            setFeedback(null);
        }

        try {
            const previousEvent = normalizedEvents.find((eventItem) => (
                String(eventItem.id || '').trim()
                && String(eventItem.id || '').trim() === String(normalizedSourceDraft.id || '').trim()
            )) || normalizedEvents.find((eventItem) => (
                String(eventItem.approval_request_id || '').trim()
                && String(eventItem.approval_request_id || '').trim() === String(normalizedSourceDraft.approval_request_id || '').trim()
            )) || null;
            const isNewEventRecord = !previousEvent;
            const normalizedEvent = normalizeEventRecord({
                ...(previousEvent || {}),
                ...normalizedSourceDraft,
                id: normalizedSourceDraft.id || previousEvent?.id || `event_${Date.now()}`,
                approval_request_id: String(normalizedSourceDraft.approval_request_id || previousEvent?.approval_request_id || '').trim(),
                title: String(normalizedSourceDraft.title || '').trim(),
                client_name: String(normalizedSourceDraft.client_name || '').trim(),
                company_name: String(normalizedSourceDraft.company_name || '').trim(),
                contact_phone: String(normalizedSourceDraft.contact_phone || '').trim(),
                contact_email: String(normalizedSourceDraft.contact_email || '').trim(),
                pax: Number(normalizedSourceDraft.pax) || 0,
                venue_id: String(normalizedSourceDraft.venue_id || '').trim(),
                venue_name: String(normalizedSourceDraft.venue_name || '').trim(),
                venue_rate: String(normalizedSourceDraft.venue_rate ?? ''),
                venue_pricing_mode: normalizedSourceDraft.venue_pricing_mode === 'PER_DAY' ? 'PER_DAY' : 'PER_EVENT',
                venue_discount_mode: String(normalizedSourceDraft.venue_discount_mode || 'NONE').toUpperCase(),
                venue_discount_value: String(normalizedSourceDraft.venue_discount_value ?? ''),
                room_discount_mode: String(normalizedSourceDraft.room_discount_mode || 'NONE').toUpperCase(),
                room_discount_value: String(normalizedSourceDraft.room_discount_value ?? ''),
                other_revenue: String(normalizedSourceDraft.other_revenue ?? ''),
                deposit_amount: Number(normalizedSourceDraft.deposit_amount) || 0,
                notes: String(normalizedSourceDraft.notes || '').trim(),
                updated_at: new Date().toISOString(),
                created_at: normalizedSourceDraft.created_at || previousEvent?.created_at || new Date().toISOString(),
                room_blocks: (normalizedSourceDraft.room_blocks || []).map(normalizeRoomBlock).filter((block) => !!block.room_type),
                catering_items: (normalizedSourceDraft.catering_items || []).map(normalizeCateringItem).filter((item) => !!item.name),
                option_items: (normalizedSourceDraft.option_items || []).map(normalizeEventOptionItem).filter((item) => !!item.name),
                finance_sync: previousEvent?.finance_sync || normalizedSourceDraft.finance_sync || createDefaultFinanceSync(),
                approval_meta: normalizeEventApprovalMeta(
                    approvalMeta || previousEvent?.approval_meta || createDefaultEventApprovalMeta(previousEvent ? 'LEGACY' : 'PENDING'),
                    approvalMeta ? 'APPROVED' : (previousEvent ? 'LEGACY' : 'PENDING')
                )
            });

            const reservedEvent = shouldSyncRoomBlock(normalizedEvent)
                ? assignEventRoomBlocks({
                    event: normalizedEvent,
                    otherEvents: normalizedEvents.filter((eventItem) => eventItem.id !== normalizedEvent.id),
                    hotelRooms: (normalizedEvent.room_blocks || []).length > 0 ? await fetchHotelRoomsSnapshot() : []
                })
                : {
                    ...normalizedEvent,
                    room_blocks: normalizedEvent.room_blocks.map((block) => ({
                        ...block,
                        assigned_room_ids: [],
                        allocation_warning: ''
                    }))
                };

            const { event: reservationSyncedEvent, warnings: reservationWarnings } = await syncEventReservations(reservedEvent, previousEvent);
            const syncedEvent = await syncFinanceForEvent(reservationSyncedEvent, previousEvent);
            const allocationWarnings = (syncedEvent.room_blocks || []).map((block) => block.allocation_warning).filter(Boolean);
            const nextEvents = previousEvent
                ? normalizedEvents.map((eventItem) => (eventItem.id === syncedEvent.id ? syncedEvent : eventItem))
                : [syncedEvent, ...normalizedEvents];

            persistEvents(nextEvents);
            if (focusSavedEvent) {
                setSelectedVenueId(syncedEvent.venue_id || selectedVenueId);
                setSelectedEventId(syncedEvent.id);
                applySuggestedPayment(syncedEvent);
            }

            const notices = [];
            if (allocationWarnings.length > 0) {
                notices.push(`Room hold note: ${allocationWarnings.join(' / ')}`);
            }
            if (reservationWarnings.length > 0) {
                notices.push(`Reservation sync note: ${reservationWarnings.join(' / ')}`);
            }
            if (syncedEvent.finance_sync?.last_error) {
                notices.push(`Finance sync note: ${syncedEvent.finance_sync.last_error}`);
            }

            return {
                syncedEvent,
                notices,
                isNewEventRecord
            };
        } finally {
            setIsSavingEvent(false);
        }
    };

    const applyApprovedRequestToSource = async ({
        request,
        actor = AUTO_APPLY_WORKFLOW_ACTOR,
        focusSavedEvent = false,
        closeModalOnSuccess = false,
        navigateOnSuccess = false,
        silent = false
    }) => {
        const normalizedRequest = normalizeApprovalRequest(request);
        if (normalizedRequest.status !== 'APPROVED') {
            throw new Error('The company approval request is not approved yet.');
        }
        if (normalizedRequest.source_applied_at) {
            throw new Error('This approval cycle has already been applied.');
        }
        if (normalizedRequest.type !== 'EVENT_PAYMENT' || normalizedRequest.source_module !== 'EVENT_POS') {
            throw new Error('This approved request is not linked to Event POS.');
        }

        const sourceDraft = normalizeEventRecord({
            ...(normalizedRequest.payload?.event_draft || {}),
            approval_request_id: normalizedRequest.id
        });
        const validationError = validateEventDraft(sourceDraft);
        if (validationError) {
            throw new Error(validationError);
        }

        const approvalArchive = createEventApprovalArchiveFromRequest(normalizedRequest, sourceDraft);
        if (!approvalArchive?.pdf_data_url) {
            throw new Error('The approved request PDF archive could not be found.');
        }

        const latestArchives = loadBanquetApprovalArchives(currentHotelCode);
        persistApprovalArchives([
            approvalArchive,
            ...latestArchives.filter((archive) => archive.id !== approvalArchive.id)
        ].slice(0, 200));

        const approvalMeta = buildEventApprovalMetaFromRequest(normalizedRequest, approvalArchive);
        const { syncedEvent, notices } = await persistEventRecord({
            approvalMeta,
            sourceDraft,
            focusSavedEvent,
            clearFeedback: !silent
        });
        if (eventModalOpen && String(draft.approval_request_id || '').trim() === normalizedRequest.id) {
            setDraft(syncedEvent);
            setSelectedVenueId(syncedEvent.venue_id || selectedVenueId);
            setSelectedEventId(syncedEvent.id);
        }
        const workflowActor = createApprovalParty(actor);
        const appliedRequest = markApprovalRequestApplied({
            request: normalizedRequest,
            actor: workflowActor,
            linkedRecordId: syncedEvent.id
        });
        const latestRequests = loadCompanyApprovalRequests(currentHotelCode);
        const nextRequests = latestRequests.map((requestItem) => (
            requestItem.id === appliedRequest.id ? appliedRequest : requestItem
        ));
        persistApprovalRequests(nextRequests);

        const nextNotifications = [
            ...buildApprovalAppliedNotifications({
                request: appliedRequest,
                actor: workflowActor
            }),
            ...loadCompanyApprovalNotifications(currentHotelCode)
        ];
        saveCompanyApprovalNotifications(currentHotelCode, nextNotifications);

        recordAuditLog(`[Approval Workflow] ${workflowActor.user_id || workflowActor.user_name} applied request ${appliedRequest.id} and synced event ${syncedEvent.title} (${syncedEvent.id}).`);
        delete autoApplyFailureRef.current[normalizedRequest.id];

        if (closeModalOnSuccess) {
            closeEventModal();
        }

        if (!silent && notices.length) {
            alert(notices.join('\n\n'));
        }

        if (navigateOnSuccess) {
            navigate('/front?openReservations=1');
        }

        return {
            appliedRequest,
            syncedEvent,
            notices
        };
    };

    const handleOpenApprovalWorkflow = () => {
        const validationError = validateEventDraft();
        if (validationError) {
            setFeedback({ type: 'error', text: validationError });
            return;
        }

        const normalizedRequest = activeApprovalRequest ? normalizeApprovalRequest(activeApprovalRequest) : null;
        if (normalizedRequest?.status === 'PENDING') {
            setIsRoutingApproval(true);
            navigate(`/approvals?requestId=${normalizedRequest.id}&returnTo=${encodeURIComponent(normalizedRequest.source_path || getApprovalSourcePath(location.pathname, normalizedRequest.id))}`);
            return;
        }

        const shouldReuseExistingDraft = normalizedRequest && ['DRAFT', 'REJECTED'].includes(normalizedRequest.status);
        const nextRequest = buildLinkedApprovalDraft(shouldReuseExistingDraft ? normalizedRequest : null);
        const nextRequests = shouldReuseExistingDraft
            ? approvalRequests.map((request) => (request.id === nextRequest.id ? nextRequest : request))
            : [nextRequest, ...approvalRequests.filter((request) => request.id !== nextRequest.id)];

        persistApprovalRequests(nextRequests);
        setDraft((prev) => ({
            ...prev,
            approval_request_id: nextRequest.id,
            approval_meta: createDefaultEventApprovalMeta('PENDING')
        }));
        setFeedback(null);
        setIsRoutingApproval(true);
        recordAuditLog(`[Approval Workflow] ${currentUser} prepared company approval request ${nextRequest.id} for ${nextRequest.subject || nextRequest.title || 'an event draft'}.`);
        navigate(`/approvals?requestId=${nextRequest.id}&compose=1&returnTo=${encodeURIComponent(nextRequest.source_path)}`);
    };

    const handleOpenLinkedApprovalCenter = () => {
        if (!activeApprovalRequest) {
            handleOpenApprovalWorkflow();
            return;
        }

        const composeFlag = ['DRAFT', 'REJECTED'].includes(activeApprovalRequest.status) ? '&compose=1' : '';
        setIsRoutingApproval(true);
        navigate(`/approvals?requestId=${activeApprovalRequest.id}${composeFlag}&returnTo=${encodeURIComponent(activeApprovalRequest.source_path || getApprovalSourcePath(location.pathname, activeApprovalRequest.id))}`);
    };

    const handleOpenNotifyCcReferenceView = () => {
        if (!activeApprovalRequest) return;

        setIsRoutingApproval(true);
        navigate(`/approvals?requestId=${activeApprovalRequest.id}&scope=all&returnTo=${encodeURIComponent(activeApprovalRequest.source_path || getApprovalSourcePath(location.pathname, activeApprovalRequest.id))}`);
    };

    const handleRegisterApprovedEvent = async () => {
        const validationError = validateEventDraft();
        if (validationError) {
            alert(validationError);
            return;
        }

        const normalizedRequest = activeApprovalRequest ? normalizeApprovalRequest(activeApprovalRequest) : null;
        if (!normalizedRequest || normalizedRequest.status !== 'APPROVED') {
            alert('The company approval request is not approved yet.');
            return;
        }
        if (normalizedRequest.source_applied_at) {
            alert('This approval cycle has already been applied. Prepare a fresh approval request before saving another revision.');
            return;
        }
        if (!approvalDraftMatchesRequest) {
            alert('The event draft changed after approval. Please prepare a fresh approval request.');
            return;
        }

        try {
            await applyApprovedRequestToSource({
                request: normalizedRequest,
                actor: {
                userId: currentUser,
                userName: currentUserName,
                role: currentUserRole
                },
                focusSavedEvent: true,
                closeModalOnSuccess: true,
                navigateOnSuccess: true
            });
        } catch (error) {
            alert(error.message || 'Unable to register the approved event.');
        }
    };

    const handleVenueCardClick = (venueCard) => {
        setSelectedVenueId(venueCard.id);
        setFeedback(null);
        setSelectedEventId(venueCard.focusEvent?.id || '');
    };

    const handlePostPosCharge = async () => {
        if (!selectedEvent) {
            setFeedback({ type: 'error', text: 'Create or select an event record first.' });
            return;
        }

        if (cart.length === 0) {
            setFeedback({ type: 'error', text: 'Add at least one menu item before posting a POS charge.' });
            return;
        }

        setIsSavingCharge(true);
        setFeedback(null);

        try {
            const nextOrder = createEventPosOrderRecord({
                items: cart,
                subtotal: rawSubtotal,
                vat_amount: vatAmount,
                service_charge: serviceCharge,
                total_amount: Math.round(finalChargeTotal),
                note: chargeNote,
                source_store_id: storeInfo.id,
                source_store_name: storeInfo.name,
                created_by: currentUser
            });

            const nextEvent = normalizeEventRecord({
                ...selectedEvent,
                pos_orders: [
                    ...(selectedEvent.pos_orders || []),
                    nextOrder
                ],
                updated_at: new Date().toISOString()
            });

            const syncedEvent = await syncFinanceForEvent(nextEvent, selectedEvent);
            const nextEvents = normalizedEvents.map((eventItem) => (
                eventItem.id === syncedEvent.id ? syncedEvent : eventItem
            ));

            persistEvents(nextEvents);
            setSelectedEventId(syncedEvent.id);
            setCart([]);
            setChargeNote('');
            applySuggestedPayment(syncedEvent);
            setFeedback({ type: 'success', text: `${formatCurrency(nextOrder.total_amount)} posted to ${selectedEvent.title}.` });

            if (syncedEvent.finance_sync?.last_error) {
                setFeedback({
                    type: 'error',
                    text: `Charge saved, but Finance noted: ${syncedEvent.finance_sync.last_error}`
                });
            }
        } catch (error) {
            setFeedback({ type: 'error', text: error.message || 'Unable to save POS charge.' });
        } finally {
            setIsSavingCharge(false);
        }
    };

    const handleRecordPayment = async () => {
        if (!selectedEvent) {
            setFeedback({ type: 'error', text: 'Create or select an event record first.' });
            return;
        }

        const amount = Math.max(0, Number(paymentAmount) || 0);
        if (!amount) {
            setFeedback({ type: 'error', text: 'Enter a valid payment amount.' });
            return;
        }

        if (paymentUsesGatewayApproval) {
            await launchGatewayPayment();
            return;
        }

        setIsSavingPayment(true);
        setFeedback(null);

        try {
            const { syncedEvent, warnings } = await finalizeEventPayment({
                eventItem: selectedEvent,
                amount,
                methodValue: paymentMethod,
                collectionTypeValue: collectionType,
                noteValue: paymentNote
            });

            setSelectedEventId(syncedEvent.id);

            if (warnings.length > 0) {
                setFeedback({
                    type: 'error',
                    text: `Payment saved, but ${warnings.join(' / ')}`
                });
            } else {
                setFeedback({ type: 'success', text: `${formatCurrency(amount)} payment saved for ${syncedEvent.title}.` });
            }
        } catch (error) {
            setFeedback({ type: 'error', text: error.message || 'Unable to save event payment.' });
        } finally {
            setIsSavingPayment(false);
        }
    };

    return (
        <div className="flex h-screen flex-col bg-slate-100 p-4 md:p-6">
            <div className="rounded-[28px] border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-fuchsia-950 px-5 py-5 text-white shadow-2xl shadow-slate-300/30 md:px-7">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.28em] text-fuchsia-200">Venue Card POS</div>
                        <h1 className="mt-2 text-2xl font-black md:text-4xl">Event &amp; Banquet POS</h1>
                        <p className="mt-2 max-w-3xl text-sm font-medium text-slate-200">
                            Event sales can now open the venue board, create the booking record from the card, then continue with menu charges, deposit collection, and final settlement in one POS flow.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-100">{storeInfo.name}</span>
                            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-100">POS {storeInfo.location}</span>
                            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-100">{venueCards.length} venue cards</span>
                            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-100">{Array.isArray(posMenu) ? posMenu.length : 0} menu cards</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={handleOpenActivityArchive}
                            className="rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-sm font-black text-amber-100 transition-colors hover:bg-amber-400/20"
                        >
                            Event Activity Archive
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenReceiptArchive}
                            className="rounded-2xl border border-sky-300/40 bg-sky-400/10 px-4 py-3 text-sm font-black text-sky-100 transition-colors hover:bg-sky-400/20"
                        >
                            Receipt Archive
                        </button>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-white/20"
                        >
                            Refresh Board
                        </button>
                        <Link
                            to="/"
                            className="rounded-2xl border border-white/15 bg-white px-4 py-3 text-sm font-black text-slate-900 transition-colors hover:bg-slate-100"
                        >
                            Exit POS
                        </Link>
                    </div>
                </div>
            </div>

            <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="min-h-0 overflow-y-auto rounded-[28px] border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-5 py-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                            <div>
                                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-fuchsia-500">Venue Cards</div>
                                <h2 className="mt-2 text-2xl font-black text-slate-900">Event Venue Board</h2>
                                <p className="mt-2 text-sm font-medium text-slate-500">
                                    Every venue card shows its reservation list, plus direct Edit, Pay, and Reserve actions. This top section is now the main working area for event sales.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                <input
                                    value={venueSearch}
                                    onChange={(event) => setVenueSearch(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100 md:w-72"
                                    placeholder="Search venue or event"
                                />
                                <div className="flex flex-wrap gap-2">
                                    {VENUE_FILTERS.map((filterOption) => (
                                        <button
                                            key={filterOption.value}
                                            type="button"
                                            onClick={() => setVenueFilter(filterOption.value)}
                                            className={`rounded-full px-4 py-2 text-xs font-black transition-colors ${venueFilter === filterOption.value ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}
                                        >
                                            {filterOption.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-5 py-5">
                        {venueCards.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {venueCards.map((venueCard) => {
                                    const venueReservations = sortVenueEvents(venueCard.matchingEvents || [], todayVenueDate);
                                    const isSelectedVenue = String(selectedVenueCard?.id || '') === String(venueCard.id);

                                    return (
                                        <div
                                            key={venueCard.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => handleVenueCardClick(venueCard)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    handleVenueCardClick(venueCard);
                                                }
                                            }}
                                            className={`flex min-h-[320px] cursor-pointer flex-col rounded-[28px] border p-5 text-left transition-all ${isSelectedVenue ? 'border-fuchsia-300 bg-fuchsia-50 shadow-lg shadow-fuchsia-100/60' : 'border-slate-200 bg-slate-50 hover:border-fuchsia-200 hover:bg-white'}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap gap-2">
                                                        <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${venueCard.hasReservationToday ? 'bg-fuchsia-600 text-white' : 'bg-emerald-600 text-white'}`}>
                                                            {venueCard.hasReservationToday ? 'Reserved Today' : 'Open Today'}
                                                        </span>
                                                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600 shadow-sm">{venueCard.category}</span>
                                                    </div>
                                                    <h3 className="mt-3 text-lg font-black text-slate-900">{venueCard.name}</h3>
                                                    <div className="mt-2 text-xs font-bold text-slate-500">
                                                        Capacity {Number(venueCard.capacity || 0).toLocaleString()} · {formatCurrency(venueCard.base_rate)}
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl bg-white px-3 py-3 text-right shadow-sm">
                                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Reservations</div>
                                                    <div className="mt-1 text-lg font-black text-fuchsia-700">{venueReservations.length}</div>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex-1 rounded-3xl border border-slate-200 bg-white/80 p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Reservation List</div>
                                                    <div className="text-[11px] font-black text-slate-500">{venueCard.openEventCount} open</div>
                                                </div>

                                                {venueReservations.length > 0 ? (
                                                    <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-1">
                                                        {venueReservations.map((eventItem) => {
                                                            const isSelectedEvent = String(selectedEvent?.id || '') === String(eventItem.id);
                                                            return (
                                                                <div
                                                                    key={eventItem.id}
                                                                    className={`rounded-2xl border px-3 py-3 ${isSelectedEvent ? 'border-fuchsia-200 bg-fuchsia-50' : 'border-slate-200 bg-white'}`}
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        <button
                                                                            type="button"
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                handlePayEvent(venueCard, eventItem);
                                                                            }}
                                                                            className="min-w-0 flex-1 text-left"
                                                                        >
                                                                            <div className="text-[11px] font-black text-slate-500">{eventItem.start_date || 'No Date'}</div>
                                                                            <div className="mt-1 truncate text-sm font-black text-slate-900">{eventItem.title || 'Untitled Event'}</div>
                                                                        </button>
                                                                        <div className="flex shrink-0 gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={(event) => {
                                                                                    event.stopPropagation();
                                                                                    handleEditEvent(venueCard, eventItem);
                                                                                }}
                                                                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 transition-colors hover:bg-slate-100"
                                                                            >
                                                                                Edit
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={(event) => {
                                                                                    event.stopPropagation();
                                                                                    handlePayEvent(venueCard, eventItem);
                                                                                }}
                                                                                className="rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-black text-white transition-colors hover:bg-slate-800"
                                                                            >
                                                                                Pay
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="mt-3 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-8 text-center text-sm font-bold text-emerald-700">
                                                        No reservations yet for this venue.
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleCreateReservation(venueCard);
                                                }}
                                                className="mt-4 w-full rounded-2xl bg-fuchsia-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-fuchsia-500"
                                            >
                                                Reserve
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">
                                <div className="text-lg font-black text-slate-500">No venue cards found.</div>
                                <p className="mt-2 text-sm font-medium text-slate-400">
                                    Add venue cards from POS Stores &amp; Menus first, then come back here to start venue-based event sales.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-slate-100 px-5 py-5">
                        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Current POS Target</div>
                                    <h3 className="mt-2 text-xl font-black text-slate-900">{selectedEvent ? selectedEvent.title : 'No Event Selected'}</h3>
                                    <p className="mt-2 text-sm font-medium text-slate-500">
                                        {selectedEvent
                                            ? `${selectedEvent.venue_name || 'Venue'} · ${selectedEvent.start_date || 'No date'} · ${selectedEvent.client_name || 'No client'}`
                                            : 'Choose Pay on a reservation row to connect the right-side charge and payment panel to an event.'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Venue Cards</div>
                                        <div className="mt-2 text-sm font-black text-slate-900">{venueCards.length}</div>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Selected Venue</div>
                                        <div className="mt-2 text-sm font-black text-slate-900">{selectedVenueCard?.name || 'None'}</div>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Venue Events</div>
                                        <div className="mt-2 text-sm font-black text-slate-900">{selectedVenueEvents.length}</div>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Balance</div>
                                        <div className="mt-2 text-sm font-black text-emerald-700">{formatCurrency(selectedBalanceDue)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 rounded-[28px] border border-slate-200 bg-white">
                            <div className="border-b border-slate-100 px-5 py-5">
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                                    <div>
                                        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-fuchsia-500">POS Menu</div>
                                        <h3 className="mt-2 text-xl font-black text-slate-900">Add Charges to the Selected Event</h3>
                                        <p className="mt-2 text-sm font-medium text-slate-500">
                                            Select an event first, then filter this catalog by category or keyword and post the chosen charges to that event.
                                        </p>
                                    </div>
                                    <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
                                        <label className="block w-full sm:w-56">
                                            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Category</span>
                                            <select
                                                value={activeCategory}
                                                onChange={(event) => setActiveCategory(event.target.value)}
                                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100"
                                            >
                                                {categoryOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label} ({option.count})
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="block w-full xl:w-72">
                                            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Search</span>
                                            <input
                                                value={menuSearch}
                                                onChange={(event) => setMenuSearch(event.target.value)}
                                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100"
                                                placeholder="Search menu item"
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                                        {activeCategory === 'All' ? 'All categories' : activeCategory}
                                    </span>
                                    <span>
                                        Showing {filteredMenu.length} menu item{filteredMenu.length === 1 ? '' : 's'} for the selected event.
                                    </span>
                                </div>
                            </div>

                            <div className="px-5 py-5">
                                {filteredMenu.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
                                        {filteredMenu.map((item) => {
                                            const qty = getItemQty(item.id);
                                            const displayPrice = item.sizes && item.sizes.length > 0 ? item.sizes[0].price : item.price;

                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => handleItemClick(item)}
                                                    className={`group overflow-hidden rounded-3xl border-2 bg-white text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${qty > 0 ? 'border-fuchsia-300 ring-2 ring-fuchsia-100' : 'border-slate-200'}`}
                                                >
                                                    <div className="relative">
                                                        {qty > 0 && (
                                                            <div className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-fuchsia-600 text-sm font-black text-white shadow-lg">
                                                                {qty}
                                                            </div>
                                                        )}
                                                        <img src={getMenuImage(item)} alt={item.name} className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                                    </div>
                                                    <div className="p-4">
                                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{item.category || 'Menu Item'}</div>
                                                        <div className="mt-2 line-clamp-2 min-h-[44px] text-sm font-black text-slate-900">{item.name}</div>
                                                        <div className="mt-4 flex items-center justify-between">
                                                            <div className="text-base font-black text-fuchsia-700">₱{Number(displayPrice || 0).toLocaleString()}</div>
                                                            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 transition-colors group-hover:bg-fuchsia-100 group-hover:text-fuchsia-700">
                                                                Add
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-16 text-center">
                                        <div className="text-lg font-black text-slate-500">No POS menu cards matched.</div>
                                        <p className="mt-2 text-sm font-medium text-slate-400">
                                            Add menus to this Event &amp; Banquet facility from POS Stores &amp; Menus, or clear the current menu filters.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="min-h-0 overflow-y-auto rounded-[28px] border border-slate-200 bg-slate-950 text-white shadow-2xl shadow-slate-300/20">
                    <div className="border-b border-slate-800 px-5 py-5">
                        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-fuchsia-200">Receipt, Deposit, Settle</div>
                        <h2 className="mt-2 text-2xl font-black">{selectedEvent ? selectedEvent.title : 'Charge the Event'}</h2>
                        <p className="mt-2 text-sm font-medium text-slate-300">
                            {selectedEvent
                                ? 'Post venue menu charges first, then collect deposit or settlement from the same event receipt flow on the right.'
                                : 'Select or create an event record to activate the receipt, deposit, and settlement workflow.'}
                        </p>
                    </div>

                    {feedback && (
                        <div className={`mx-5 mt-5 rounded-2xl border px-4 py-3 text-sm font-black ${feedback.type === 'success' ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300' : 'border-rose-400/40 bg-rose-500/10 text-rose-200'}`}>
                            {feedback.text}
                        </div>
                    )}

                    <div className="border-b border-slate-800 px-5 py-5">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-lg font-black">POS Charge Cart</h3>
                            <button
                                type="button"
                                onClick={() => setCart([])}
                                className="text-xs font-black text-slate-400 transition-colors hover:text-white"
                            >
                                Clear Cart
                            </button>
                        </div>

                        <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                            {cart.length === 0 ? (
                                <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/70 px-5 py-10 text-center text-sm font-bold text-slate-500">
                                    No POS items selected yet.
                                </div>
                            ) : (
                                cart.map((item) => (
                                    <div key={item.cartId} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-3 py-3">
                                        <div className="min-w-0 flex-1 pr-2">
                                            <div className="truncate text-sm font-black text-white">{item.name}</div>
                                            <div className="mt-1 text-xs font-bold text-slate-400">
                                                {item.selectedSize !== 'Regular' ? `${item.selectedSize} · ` : ''}₱{Number(item.price || 0).toLocaleString()} x {item.quantity}
                                            </div>
                                        </div>
                                        <div className="pr-2 text-sm font-black text-fuchsia-300">₱{Number(item.price * item.quantity).toLocaleString()}</div>
                                        <button
                                            type="button"
                                            onClick={() => removeFromCart(item.cartId)}
                                            className="rounded-xl bg-slate-800 px-2 py-1 text-xs font-black text-slate-300 transition-colors hover:bg-rose-500 hover:text-white"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-900 px-4 py-4">
                            <div className="space-y-2 text-sm font-bold text-slate-300">
                                <div className="flex items-center justify-between"><span>Subtotal</span><span>{formatCurrency(rawSubtotal)}</span></div>
                                <div className="flex items-center justify-between"><span>VAT ({Number(receiptConfig?.vat_rate || 12)}%)</span><span>{formatCurrency(vatAmount)}</span></div>
                                <div className="flex items-center justify-between"><span>Service Charge ({Number(receiptConfig?.sc_rate || 10)}%)</span><span>{formatCurrency(serviceCharge)}</span></div>
                            </div>
                            <div className="mt-4 flex items-end justify-between border-t border-slate-800 pt-4">
                                <span className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Charge Total</span>
                                <span className="text-3xl font-black text-white">{formatCurrency(finalChargeTotal)}</span>
                            </div>
                        </div>

                        <textarea
                            value={chargeNote}
                            onChange={(event) => setChargeNote(event.target.value)}
                            rows="3"
                            className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none transition-colors placeholder:text-slate-500 focus:border-fuchsia-300"
                            placeholder="Charge note: buffet extension, AV add-on, corkage, overtime, or event-specific remarks"
                        />

                        <button
                            type="button"
                            onClick={handlePostPosCharge}
                            disabled={!selectedEvent || cart.length === 0 || isSavingCharge}
                            className="mt-4 w-full rounded-2xl bg-fuchsia-600 px-5 py-4 text-sm font-black text-white transition-colors hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:bg-fuchsia-900/60"
                        >
                            {isSavingCharge ? 'Posting POS Charge...' : 'Post POS Charge to Event'}
                        </button>
                    </div>

                    <div className="border-b border-slate-800 px-5 py-5">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-lg font-black">Record Payment</h3>
                            <div className="text-xs font-black text-slate-400">
                                Balance {formatCurrency(selectedBalanceDue)}
                            </div>
                        </div>

                        {paymentUsesGatewayApproval && (
                            <div className="mb-4 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-xs font-bold text-cyan-100">
                                Approved PG mode is active via <span className="font-black text-white">{activeGatewayLabel}</span>. This payment is recorded only after the gateway confirms the checkout.
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Collection Type</label>
                                <select
                                    value={collectionType}
                                    onChange={(event) => setCollectionType(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none transition-colors focus:border-fuchsia-300"
                                >
                                    {EVENT_COLLECTION_TYPES.map((item) => (
                                        <option key={item.value} value={item.value}>{item.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Payment Method</label>
                                <select
                                    value={paymentMethod}
                                    onChange={(event) => setPaymentMethod(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none transition-colors focus:border-fuchsia-300"
                                >
                                    {EVENT_PAYMENT_METHODS.map((item) => (
                                        <option key={item.value} value={item.value}>{item.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Amount</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={paymentAmount}
                                    onChange={(event) => setPaymentAmount(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-lg font-black text-white outline-none transition-colors focus:border-fuchsia-300"
                                    placeholder="50000"
                                />
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setCollectionType('DEPOSIT');
                                    setPaymentAmount(depositGap > 0 ? String(Math.round(depositGap)) : '');
                                }}
                                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-black text-slate-300 transition-colors hover:border-fuchsia-300 hover:text-white"
                            >
                                Deposit Gap
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setCollectionType(selectedBalanceDue > 0 ? 'PARTIAL' : 'FULL_SETTLEMENT');
                                    setPaymentAmount(selectedBalanceDue > 0 ? String(Math.round(selectedBalanceDue)) : '');
                                }}
                                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-black text-slate-300 transition-colors hover:border-fuchsia-300 hover:text-white"
                            >
                                Balance Due
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentAmount(finalChargeTotal > 0 ? String(Math.round(finalChargeTotal)) : '')}
                                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-black text-slate-300 transition-colors hover:border-fuchsia-300 hover:text-white"
                            >
                                Cart Total
                            </button>
                        </div>

                        <input
                            value={paymentNote}
                            onChange={(event) => setPaymentNote(event.target.value)}
                            className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none transition-colors placeholder:text-slate-500 focus:border-fuchsia-300"
                            placeholder="Receipt no., approval code, card holder, or notes"
                        />

                        <button
                            type="button"
                            onClick={handleRecordPayment}
                            disabled={!selectedEvent || !paymentAmount || isSavingPayment || isLaunchingGateway}
                            className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900/60"
                        >
                            {isSavingPayment
                                ? 'Saving Payment...'
                                : isLaunchingGateway
                                    ? 'Launching PG Checkout...'
                                    : (paymentUsesGatewayApproval ? 'Start PG Approval' : 'Save Event Payment')}
                        </button>
                    </div>

                    <div className="px-5 py-5">
                        <div className="rounded-3xl border border-slate-800 bg-slate-900 px-4 py-4">
                            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Recent Event POS Activity</div>

                            <div className="mt-4">
                                <div className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">POS Charges</div>
                                {recentPosOrders.length > 0 ? (
                                    <div className="mt-2 space-y-2">
                                        {recentPosOrders.slice(0, 3).map((order) => (
                                            <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-black text-white">{order.note || `${storeInfo.name} POS Charge`}</div>
                                                        <div className="mt-1 text-xs font-bold text-slate-500">
                                                            {new Date(order.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}
                                                        </div>
                                                    </div>
                                                    <div className="text-sm font-black text-fuchsia-300">{formatCurrency(order.total_amount)}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-2 text-sm font-bold text-slate-500">No POS charges posted yet.</div>
                                )}
                            </div>

                            <div className="mt-5 border-t border-slate-800 pt-4">
                                <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Payments</div>
                                {recentPayments.length > 0 ? (
                                    <div className="mt-2 space-y-2">
                                        {recentPayments.slice(0, 3).map((payment) => (
                                            <div key={payment.id} className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-black text-white">
                                                            {getCollectionLabel(payment.collection_type)} via {getPaymentMethodLabel(payment.method)}
                                                        </div>
                                                        <div className="mt-1 text-xs font-bold text-slate-500">
                                                            {new Date(payment.paid_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}
                                                        </div>
                                                    </div>
                                                    <div className="text-sm font-black text-emerald-300">{formatCurrency(payment.amount)}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-2 text-sm font-bold text-slate-500">No event payments recorded yet.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isActivityArchiveOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div>
                                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-500">Event Activity Archive</div>
                                    <h3 className="mt-2 text-2xl font-black text-slate-900">Search past POS charges and payment history</h3>
                                    <p className="mt-2 text-sm font-medium text-slate-500">
                                        Review the full Event POS history across all venue bookings, then export the filtered result as a PDF archive.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActivitySearch('');
                                            setActivityStartDate('');
                                            setActivityEndDate('');
                                        }}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-100"
                                    >
                                        Reset Filters
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleExportActivityArchivePdf}
                                        className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 transition-colors hover:bg-amber-100"
                                    >
                                        Export PDF
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsActivityArchiveOpen(false)}
                                        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-slate-800"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-y-auto px-6 py-5">
                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
                                <input
                                    value={activitySearch}
                                    onChange={(event) => setActivitySearch(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-amber-300"
                                    placeholder="Search event, client, venue, title, or note"
                                />
                                <input
                                    type="date"
                                    value={activityStartDate}
                                    onChange={(event) => setActivityStartDate(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-amber-300"
                                />
                                <input
                                    type="date"
                                    value={activityEndDate}
                                    onChange={(event) => setActivityEndDate(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-amber-300"
                                />
                                <div className="flex items-center justify-center rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700">
                                    {filteredEventActivityArchiveRows.length} rows
                                </div>
                            </div>

                            <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200">
                                        <thead className="bg-slate-900 text-white">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em]">Date</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em]">Event</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em]">Client / Venue</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em]">Type</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em]">Reference</th>
                                                <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.22em]">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {activityPagination.pageItems.length > 0 ? activityPagination.pageItems.map((row) => (
                                                <tr key={`${row.type}_${row.eventId}_${row.id}`} className="align-top">
                                                    <td className="px-4 py-3 text-sm font-bold text-slate-600">
                                                        {row.happenedAt ? new Date(row.happenedAt).toLocaleString('en-US', { timeZone: 'Asia/Manila' }) : '-'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-sm font-black text-slate-900">{row.eventTitle}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-medium text-slate-600">
                                                        {[row.clientName, row.venueName].filter(Boolean).join(' / ') || '-'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${row.type === 'PAYMENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-fuchsia-100 text-fuchsia-700'}`}>
                                                            {row.typeLabel}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-medium text-slate-600">
                                                        <div className="font-bold text-slate-900">{row.title}</div>
                                                        <div className="mt-1">{row.detail || '-'}</div>
                                                    </td>
                                                    <td className={`px-4 py-3 text-right text-sm font-black ${row.type === 'PAYMENT' ? 'text-emerald-700' : 'text-fuchsia-700'}`}>
                                                        {formatCurrency(row.amount)}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="6" className="px-4 py-16 text-center text-sm font-bold text-slate-400">
                                                        No event activity matched the current filters.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <StoragePaginationFooter
                                pagination={activityPagination}
                                page={activityPagination.safePage}
                                onPrevious={() => setActivityPage(Math.max(1, activityPagination.safePage - 1))}
                                onNext={() => setActivityPage(Math.min(activityPagination.totalPages, activityPagination.safePage + 1))}
                            />
                        </div>
                    </div>
                </div>
            )}

            {isReceiptArchiveOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div>
                                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-500">Receipt Archive</div>
                                    <h3 className="mt-2 text-2xl font-black text-slate-900">Search issued Event POS receipts</h3>
                                    <p className="mt-2 text-sm font-medium text-slate-500">
                                        Review receipt history across all events, open any receipt, and export the filtered archive to PDF.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setReceiptSearch('');
                                            setReceiptStartDate('');
                                            setReceiptEndDate('');
                                        }}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-100"
                                    >
                                        Reset Filters
                                    </button>
                                    <button
                                        type="button"
                                        onClick={loadReceipts}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-100"
                                    >
                                        Refresh Receipts
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleExportReceiptArchivePdf}
                                        className="rounded-2xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700 transition-colors hover:bg-sky-100"
                                    >
                                        Export PDF
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsReceiptArchiveOpen(false)}
                                        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-slate-800"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-y-auto px-6 py-5">
                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
                                <input
                                    value={receiptSearch}
                                    onChange={(event) => setReceiptSearch(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-sky-300"
                                    placeholder="Search OR no., title, guest, description, or department"
                                />
                                <input
                                    type="date"
                                    value={receiptStartDate}
                                    onChange={(event) => setReceiptStartDate(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-sky-300"
                                />
                                <input
                                    type="date"
                                    value={receiptEndDate}
                                    onChange={(event) => setReceiptEndDate(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-sky-300"
                                />
                                <div className="flex items-center justify-center rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700">
                                    {isLoadingReceipts ? 'Loading...' : `${filteredReceiptArchiveRows.length} rows`}
                                </div>
                            </div>

                            <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200">
                                        <thead className="bg-slate-900 text-white">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em]">Date</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em]">OR No.</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em]">Event / Ref</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em]">Department</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em]">Description</th>
                                                <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.22em]">Amount</th>
                                                <th className="px-4 py-3 text-center text-[11px] font-black uppercase tracking-[0.22em]">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {receiptPagination.pageItems.length > 0 ? receiptPagination.pageItems.map((receipt) => (
                                                <tr key={receipt.receipt_no || receipt.id || `${receipt.date}_${receipt.amount}`} className="align-top">
                                                    <td className="px-4 py-3 text-sm font-bold text-slate-600">{receipt.date || getDateKey(receipt.created_at) || '-'}</td>
                                                    <td className="px-4 py-3 text-sm font-black text-sky-700">{receipt.receipt_no || '-'}</td>
                                                    <td className="px-4 py-3 text-sm font-black text-slate-900">{receipt.event_title || receipt.guest_name || '-'}</td>
                                                    <td className="px-4 py-3 text-sm font-medium text-slate-600">{receipt.department || '-'}</td>
                                                    <td className="px-4 py-3 text-sm font-medium text-slate-600">{receipt.description || '-'}</td>
                                                    <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{formatCurrency(receipt.amount || 0)}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedReceipt(receipt)}
                                                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 transition-colors hover:bg-slate-100"
                                                        >
                                                            View Receipt
                                                        </button>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="7" className="px-4 py-16 text-center text-sm font-bold text-slate-400">
                                                        {isLoadingReceipts ? 'Loading receipt archive...' : 'No receipts matched the current filters.'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <StoragePaginationFooter
                                pagination={receiptPagination}
                                page={receiptPagination.safePage}
                                onPrevious={() => setReceiptPage(Math.max(1, receiptPagination.safePage - 1))}
                                onNext={() => setReceiptPage(Math.min(receiptPagination.totalPages, receiptPagination.safePage + 1))}
                            />
                        </div>
                    </div>
                </div>
            )}

            {eventModalOpen && (
                <>
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
                        <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-[30px] border border-slate-200 bg-white p-6 shadow-2xl md:p-7">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-fuchsia-500">Event Reservation Input</div>
                                    <h3 className="mt-2 text-2xl font-black text-slate-900">{draft.id ? 'Edit Event Record' : 'Create Event Record'}</h3>
                                    <p className="mt-2 text-sm font-medium text-slate-500">
                                        Capture multi-day events, venue pricing, catering sections, guest-room blocks, and finance-linked totals in one workflow from Event POS.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={resetEventDraft}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-100 transition-colors"
                                    >
                                        Reset
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeEventModal}
                                        className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-100 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>

                            <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                                <div>
                                    <p className="mt-2 text-sm font-medium text-slate-500">
                                        The saved event record remains linked to POS charges, deposits, settlements, and front-desk room holds for this venue.
                                    </p>
                                </div>
                                <div className={`${SUMMARY_BADGE_CLASS} bg-slate-50`}>
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Draft Total</div>
                                    <div className="mt-1 text-sm font-black text-slate-900">{formatCurrency(draftGrandTotal)}</div>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                <div>
                                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Event Type</label>
                                    <select value={draft.event_type} onChange={(e) => setDraft((prev) => ({ ...prev, event_type: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                                        {EVENT_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Status</label>
                                    <select value={draft.status} onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                                        {Object.entries(EVENT_STATUSES).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Venue</label>
                                    <select value={draft.venue_id || ''} onChange={(e) => handleVenueSelection(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                                        <option value="">Select registered venue</option>
                                        {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
                                    </select>
                                </div>

                                <div className="md:col-span-2 xl:col-span-3">
                                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Event Title</label>
                                    <input value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" placeholder="Example: Santos - Cruz Wedding Reception" />
                                </div>

                                <div>
                                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Primary Client</label>
                                    <input value={draft.client_name} onChange={(e) => setDraft((prev) => ({ ...prev, client_name: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" placeholder="Client full name" />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Company / Organizer</label>
                                    <input value={draft.company_name} onChange={(e) => setDraft((prev) => ({ ...prev, company_name: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" placeholder="Optional company name" />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Expected Pax</label>
                                    <input type="number" min="0" value={draft.pax} onChange={(e) => setDraft((prev) => ({ ...prev, pax: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" placeholder="150" />
                                </div>

                                <div>
                                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Contact Phone</label>
                                    <input value={draft.contact_phone} onChange={(e) => setDraft((prev) => ({ ...prev, contact_phone: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" placeholder="+63 ..." />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Contact Email</label>
                                    <input type="email" value={draft.contact_email} onChange={(e) => setDraft((prev) => ({ ...prev, contact_email: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" placeholder="planner@email.com" />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Event Start Date</label>
                                    <input type="date" value={draft.start_date} onChange={(e) => handleEventDraftStartDateChange(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Start Time</label>
                                    <input type="time" value={draft.start_time} onChange={(e) => setDraft((prev) => ({ ...prev, start_time: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">End Time</label>
                                    <input type="time" value={draft.end_time} onChange={(e) => setDraft((prev) => ({ ...prev, end_time: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Event End Date</label>
                                    <input type="date" min={draft.start_date || undefined} value={draft.end_date} onChange={(e) => setDraft((prev) => ({ ...prev, end_date: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" />
                                </div>
                            </div>

                            <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 md:p-6">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <h4 className="text-lg font-black text-slate-900">Venue Pricing & Discount</h4>
                                        <p className="mt-2 text-sm font-medium text-slate-500">
                                            Set the venue rate, choose whether the rate is per event or per day, then apply an optional discount before the final amount is posted to Finance.
                                        </p>
                                    </div>
                                    <div className={`${SUMMARY_BADGE_CLASS} bg-white`}>
                                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Duration</div>
                                        <div className="mt-1 text-sm font-black text-slate-900">
                                            {draftEventSpanDays} Day{draftEventSpanDays === 1 ? '' : 's'}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <div>
                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Venue Rate</label>
                                        <input type="number" min="0" value={draft.venue_rate} onChange={(e) => setDraft((prev) => ({ ...prev, venue_rate: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700" placeholder="180000" />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Rate Basis</label>
                                        <select value={draft.venue_pricing_mode} onChange={(e) => setDraft((prev) => ({ ...prev, venue_pricing_mode: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                                            <option value="PER_EVENT">Per Event</option>
                                            <option value="PER_DAY">Per Day</option>
                                        </select>
                                    </div>
                                    <div className="xl:col-span-2">
                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Discount Option</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { value: 'NONE', label: 'No Discount' },
                                                { value: 'PERCENT', label: '% Discount' },
                                                { value: 'FIXED', label: 'Fixed Less' }
                                            ].map((discountOption) => (
                                                <button
                                                    key={discountOption.value}
                                                    type="button"
                                                    onClick={() => setDraft((prev) => ({ ...prev, venue_discount_mode: discountOption.value, venue_discount_value: discountOption.value === 'NONE' ? '' : prev.venue_discount_value }))}
                                                    className={`rounded-2xl border px-3 py-3 text-xs font-black transition-colors ${draft.venue_discount_mode === discountOption.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'}`}
                                                >
                                                    {discountOption.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Discount Value</label>
                                        <input
                                            type="number"
                                            min="0"
                                            disabled={draft.venue_discount_mode === 'NONE'}
                                            value={draft.venue_discount_value}
                                            onChange={(e) => setDraft((prev) => ({ ...prev, venue_discount_value: e.target.value }))}
                                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
                                            placeholder={draft.venue_discount_mode === 'PERCENT' ? '10' : '5000'}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Additional Event Charges</label>
                                        <input type="number" min="0" value={draft.other_revenue} onChange={(e) => setDraft((prev) => ({ ...prev, other_revenue: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700" placeholder="15000" />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Deposit</label>
                                        <input type="number" min="0" value={draft.deposit_amount} onChange={(e) => setDraft((prev) => ({ ...prev, deposit_amount: e.target.value }))} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700" placeholder="50000" />
                                    </div>
                                </div>

                                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
                                    <div className="rounded-2xl border border-white bg-white/80 p-4">
                                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Venue Base</div>
                                        <div className="mt-2 text-lg font-black text-slate-900">{formatCurrency(draftVenueBase)}</div>
                                    </div>
                                    <div className="rounded-2xl border border-white bg-white/80 p-4">
                                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Discount</div>
                                        <div className="mt-2 text-lg font-black text-rose-600">{formatCurrency(draftVenueDiscount)}</div>
                                    </div>
                                    <div className="rounded-2xl border border-white bg-white/80 p-4">
                                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Venue Final</div>
                                        <div className="mt-2 text-lg font-black text-emerald-600">{formatCurrency(draftVenueNet)}</div>
                                    </div>
                                    <div className="rounded-2xl border border-white bg-white/80 p-4">
                                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Finance Auto-Sync</div>
                                        <div className="mt-2 text-sm font-black text-slate-900">Banquet Revenue / Event Deposit</div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 md:p-6">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <h4 className="text-lg font-black text-slate-900">Catering Section</h4>
                                        <p className="mt-2 text-sm font-medium text-slate-500">
                                            Add seminar packages, coffee breaks, wedding buffet items, or custom catering charges. Each line is rolled into the final event amount and auto-posted to Finance as Catering Revenue.
                                        </p>
                                    </div>
                                    <button type="button" onClick={() => addCateringItemToDraft()} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 transition-colors">
                                        Add Custom Catering
                                    </button>
                                </div>

                                <div className="mt-5 flex flex-wrap gap-2">
                                    {CATERING_TEMPLATE_OPTIONS.map((template) => (
                                        <button
                                            key={template.name}
                                            type="button"
                                            onClick={() => addCateringItemToDraft(template)}
                                            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-100"
                                        >
                                            + {template.name}
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-5 space-y-4">
                                    {(draft.catering_items || []).map((item) => {
                                        const lineTotal = calculateCateringLineTotal(item);
                                        return (
                                            <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                                                    <div className="xl:col-span-2">
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Item Name</label>
                                                        <input value={item.name} onChange={(e) => updateDraftCateringItem(item.id, 'name', e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" placeholder="Buffet Lunch" />
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Billing</label>
                                                        <select value={item.billing_mode} onChange={(e) => updateDraftCateringItem(item.id, 'billing_mode', e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                                                            <option value="PER_PAX">Per Pax</option>
                                                            <option value="PACKAGE">Package</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Unit Price</label>
                                                        <input type="number" min="0" value={item.unit_price} onChange={(e) => updateDraftCateringItem(item.id, 'unit_price', e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" />
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{item.billing_mode === 'PACKAGE' ? 'Quantity' : 'Pax'}</label>
                                                        <input type="number" min="0" value={item.billing_mode === 'PACKAGE' ? item.quantity : item.pax_count} onChange={(e) => updateDraftCateringItem(item.id, item.billing_mode === 'PACKAGE' ? 'quantity' : 'pax_count', e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" />
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{item.billing_mode === 'PACKAGE' ? 'Line Total' : 'Service Days'}</label>
                                                        {item.billing_mode === 'PACKAGE' ? (
                                                            <div className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-700">
                                                                {formatCurrency(lineTotal)}
                                                            </div>
                                                        ) : (
                                                            <input type="number" min="1" value={item.service_days} onChange={(e) => updateDraftCateringItem(item.id, 'service_days', e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" />
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                                                    <div>
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Catering Note</label>
                                                        <input value={item.note} onChange={(e) => updateDraftCateringItem(item.id, 'note', e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700" placeholder="Menu details, set-up notes, dietary reminders, or service timing." />
                                                    </div>
                                                    <button type="button" onClick={() => removeDraftCateringItem(item.id)} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 hover:bg-rose-100 transition-colors">
                                                        Remove
                                                    </button>
                                                </div>

                                                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold">
                                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Billing: {item.billing_mode === 'PACKAGE' ? 'Package' : 'Per Pax'}</span>
                                                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Projected: {formatCurrency(lineTotal)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {(draft.catering_items || []).length === 0 && (
                                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm font-bold text-slate-400">
                                            No catering items added yet. Use a template button above or create a custom line.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 md:p-6">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <h4 className="text-lg font-black text-slate-900">Event Options</h4>
                                        <p className="mt-2 text-sm font-medium text-slate-500">
                                            Add optional upsells like cake, flower basket, orchestra, photo booth, or any custom enhancement. These charges are included in the approval PDF and final event amount.
                                        </p>
                                    </div>
                                    <button type="button" onClick={() => addOptionItemToDraft()} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 transition-colors">
                                        Add Custom Option
                                    </button>
                                </div>

                                <div className="mt-5 flex flex-wrap gap-2">
                                    {EVENT_OPTION_TEMPLATE_OPTIONS.map((template) => (
                                        <button
                                            key={template.name}
                                            type="button"
                                            onClick={() => addOptionItemToDraft(template)}
                                            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-100"
                                        >
                                            + {template.name}
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-5 space-y-4">
                                    {(draft.option_items || []).map((item) => {
                                        const lineTotal = calculateEventOptionLineTotal(item);
                                        return (
                                            <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                                                    <div className="xl:col-span-2">
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Option Name</label>
                                                        <input value={item.name} onChange={(e) => updateDraftOptionItem(item.id, 'name', e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" placeholder="Flower Basket" />
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Quantity</label>
                                                        <input type="number" min="1" value={item.quantity} onChange={(e) => updateDraftOptionItem(item.id, 'quantity', e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" />
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Unit Price</label>
                                                        <input type="number" min="0" value={item.unit_price} onChange={(e) => updateDraftOptionItem(item.id, 'unit_price', e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" />
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Line Total</label>
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-700">
                                                            {formatCurrency(lineTotal)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                                                    <div>
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Option Note</label>
                                                        <input value={item.note} onChange={(e) => updateDraftOptionItem(item.id, 'note', e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700" placeholder="Delivery time, stage set-up, celebrant name, song request, or vendor details." />
                                                    </div>
                                                    <button type="button" onClick={() => removeDraftOptionItem(item.id)} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 hover:bg-rose-100 transition-colors">
                                                        Remove
                                                    </button>
                                                </div>

                                                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold">
                                                    <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Options total: {formatCurrency(lineTotal)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {(draft.option_items || []).length === 0 && (
                                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm font-bold text-slate-400">
                                            No event options added yet. Use a preset above or create a custom option line.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 md:p-6">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <h4 className="text-lg font-black text-slate-900">Linked Guest Room Blocks</h4>
                                        <p className="mt-2 text-sm font-medium text-slate-500">
                                            Event room blocks now sync to Front Desk and reservation records from Event POS as well. Add the room types and stay dates here before saving.
                                        </p>
                                    </div>
                                    <div className="grid w-full gap-3 sm:grid-cols-3 md:w-auto md:min-w-[456px]">
                                        <div className={`${SUMMARY_BADGE_CLASS} bg-white text-left`}>
                                            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Room Discount</div>
                                            <div className="mt-1 text-sm font-black text-slate-900">
                                                {draft.room_discount_mode === 'NONE'
                                                    ? 'No Discount'
                                                    : draft.room_discount_mode === 'PERCENT'
                                                        ? `${Number(draft.room_discount_value || 0)}% Off`
                                                        : `${formatCurrency(draftRoomDiscount)} Off`}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowRoomDiscountModal(true)}
                                            className={`${ACTION_TILE_CLASS} border border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}
                                        >
                                            Discount
                                        </button>
                                        <button type="button" onClick={() => addRoomBlockToDraft()} className={`${ACTION_TILE_CLASS} bg-slate-900 text-white hover:bg-slate-800`}>
                                            Add Block
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {roomTypeOptions.map((roomType) => (
                                        <button
                                            key={roomType.id}
                                            type="button"
                                            onClick={() => addRoomBlockToDraft(roomType.name)}
                                            className="rounded-3xl border border-slate-200 bg-white p-4 text-left hover:border-sky-300 hover:bg-sky-50/50 transition-all shadow-sm"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-black text-slate-900">{roomType.name}</div>
                                                    <div className="mt-1 text-xs font-medium text-slate-500">{roomType.size || 'Room type'}{roomType.bedType ? ` · ${roomType.bedType}` : ''}</div>
                                                </div>
                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">{roomType.totalRooms} rooms</span>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                                                <span>Base rate</span>
                                                <span className="text-sky-700">{formatCurrency(roomType.baseRate)}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-5 space-y-4">
                                    {(draft.room_blocks || []).map((block) => {
                                        const roomTypeMeta = roomTypeRateMap[block.room_type];
                                        const totalRoomsForType = Number(roomTypeMeta?.totalRooms || 0);
                                        const projectedBlockRevenue = getRoomBlockRevenue(block, roomTypeRateMap);
                                        const assignedRoomIds = Array.isArray(block.assigned_room_ids) ? block.assigned_room_ids : [];
                                        const isOverInventory = totalRoomsForType > 0 && Number(block.quantity || 0) > totalRoomsForType;

                                        return (
                                            <div key={block.id} className={`rounded-3xl border p-4 md:p-5 shadow-sm ${isOverInventory ? 'border-rose-300 bg-rose-50/60' : 'border-slate-200 bg-white'}`}>
                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                                                    <div className="xl:col-span-2">
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Room Type</label>
                                                        <select value={block.room_type} onChange={(e) => updateDraftRoomBlock(block.id, 'room_type', e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                                                            <option value="">Select room type</option>
                                                            {roomTypeOptions.map((roomType) => <option key={roomType.id} value={roomType.name}>{roomType.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Rooms</label>
                                                        <input type="number" min="1" value={block.quantity} onChange={(e) => updateDraftRoomBlock(block.id, 'quantity', e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" />
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Nightly Rate</label>
                                                        <input type="number" min="0" value={block.nightly_rate} onChange={(e) => updateDraftRoomBlock(block.id, 'nightly_rate', e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" />
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Check-in</label>
                                                        <input type="date" value={block.check_in_date} onChange={(e) => updateDraftRoomBlock(block.id, 'check_in_date', e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" />
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Check-out</label>
                                                        <input type="date" min={block.check_in_date || undefined} value={block.check_out_date} onChange={(e) => updateDraftRoomBlock(block.id, 'check_out_date', e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" />
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                                                    <div>
                                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Room Block Note</label>
                                                        <input value={block.note} onChange={(e) => updateDraftRoomBlock(block.id, 'note', e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700" placeholder="VIP rooms, speakers, bridal suite, corporate delegation, etc." />
                                                    </div>
                                                    <button type="button" onClick={() => removeDraftRoomBlock(block.id)} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 hover:bg-rose-100 transition-colors">
                                                        Remove
                                                    </button>
                                                </div>

                                                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold">
                                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Inventory linked: {totalRoomsForType} room(s)</span>
                                                    <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">Assigned now: {assignedRoomIds.length}</span>
                                                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Projected: {formatCurrency(projectedBlockRevenue)}</span>
                                                    {isOverInventory && <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">Requested quantity exceeds mapped room inventory</span>}
                                                </div>

                                                {assignedRoomIds.length > 0 && (
                                                    <div className="mt-3">
                                                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Assigned Physical Rooms</div>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {assignedRoomIds.map((roomId) => (
                                                                <span key={`${block.id}_${roomId}`} className="rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-black text-fuchsia-700">
                                                                    Room {roomId}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {block.allocation_warning && (
                                                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-black text-amber-700">
                                                        {block.allocation_warning}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {(draft.room_blocks || []).length === 0 && (
                                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm font-bold text-slate-400">
                                            No room blocks added yet. Add one when the event also requires guest-room allotments.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Venue Final</div>
                                    <div className="mt-2 text-lg font-black text-slate-900">{formatCurrency(draftVenueNet)}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Catering</div>
                                    <div className="mt-2 text-lg font-black text-emerald-700">{formatCurrency(draftCateringTotal)}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Options</div>
                                    <div className="mt-2 text-lg font-black text-amber-700">{formatCurrency(draftOptionTotal)}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Room Base</div>
                                    <div className="mt-2 text-lg font-black text-slate-900">{formatCurrency(draftRoomBaseRevenue)}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Room Discount</div>
                                    <div className="mt-2 text-lg font-black text-rose-600">{formatCurrency(draftRoomDiscount)}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Room Net</div>
                                    <div className="mt-2 text-lg font-black text-sky-700">{formatCurrency(draftRoomRevenue)}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Manual Charges</div>
                                    <div className="mt-2 text-lg font-black text-violet-700">{formatCurrency(draftOtherRevenue)}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-900 px-5 py-3 text-white md:col-span-2 xl:col-start-5 xl:col-span-3">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">Final Amount</div>
                                            <div className="mt-1 text-2xl font-black">{formatCurrency(draftGrandTotal)}</div>
                                        </div>
                                        <div className="text-xs font-bold text-slate-300 sm:text-right">{draftTotalRooms} room(s) in group hold</div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Sales / Operations Notes</label>
                                <textarea value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} rows="4" className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 resize-y" placeholder="Package notes, menu requests, ingress / egress schedule, audio visual requirements, or client reminders." />
                            </div>

                            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Company Payment Workflow</div>
                                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                                            <span className={`rounded-full px-3 py-1 shadow-sm ${approvalWorkflowState.badgeClass}`}>
                                                {approvalWorkflowState.badgeLabel}
                                            </span>
                                            {activeApprovalRequest && (
                                                <span className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm">
                                                    Request: {activeApprovalRequest.id.slice(-8)}
                                                </span>
                                            )}
                                            <span className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm">Final: {formatCurrency(draftGrandTotal)}</span>
                                            <span className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm">Balance: {formatCurrency(draftBalanceDue)}</span>
                                            {activeApprovalRequest?.approved_at && (
                                                <span className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm">
                                                    Approved: {new Date(activeApprovalRequest.approved_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-4 text-base font-black text-slate-900">
                                            {approvalWorkflowState.title}
                                        </div>
                                        <div className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
                                            {approvalWorkflowState.description}
                                        </div>
                                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Initiator</div>
                                                <div className="mt-2 text-sm font-black text-slate-900">{currentUserName}</div>
                                                <div className="mt-1 text-xs font-medium text-slate-500">The requester prepares the packet in Event POS and returns here after approval.</div>
                                            </div>
                                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Approvers</div>
                                                <div className="mt-2 text-sm font-black text-slate-900">
                                                    {(activeApprovalRequest?.approvers || []).map((approver) => approver.user_id).join(', ') || 'Set in approval form'}
                                                </div>
                                                <div className="mt-1 text-xs font-medium text-slate-500">Approvers receive alerts from the floating approval box instead of coming to this POS.</div>
                                            </div>
                                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Archive</div>
                                                <div className="mt-2 text-sm font-black text-slate-900">
                                                    {activeApprovalRequest?.archive?.file_name || draftApprovalArchive?.pdf_file_name || 'Generated after request submission'}
                                                </div>
                                                <div className="mt-1 text-xs font-medium text-slate-500">The approval PDF is stored first, then the event registration is applied after approval.</div>
                                            </div>
                                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Notify / CC</div>
                                                <div className="mt-2 text-sm font-black text-slate-900">
                                                    {activeApprovalWatchers.map((watcher) => watcher.user_id).join(', ') || 'Set in approval form'}
                                                </div>
                                                <div className="mt-1 text-xs font-medium text-slate-500">Referenced users can open the workflow and then view the reservation details from the source record button.</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-3 xl:justify-end">
                                        {activeApprovalRequest?.archive?.pdf_data_url && (
                                            <button type="button" onClick={() => handleViewApprovalRequestPdf(activeApprovalRequest)} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-100 transition-colors">
                                                View Request PDF
                                            </button>
                                        )}
                                        {!activeApprovalRequest?.archive?.pdf_data_url && draftApprovalArchive && (
                                            <button type="button" onClick={() => handleViewApprovalArchivePdf(draftApprovalArchive.id)} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-100 transition-colors">
                                                View Archived Approval PDF
                                            </button>
                                        )}
                                        {activeApprovalRequest && (
                                            <button type="button" onClick={handleOpenLinkedApprovalCenter} className="rounded-2xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700 hover:bg-sky-100 transition-colors">
                                                Open Approval Workflow
                                            </button>
                                        )}
                                        {activeApprovalRequest && activeApprovalWatchers.length > 0 && (
                                            <button type="button" onClick={handleOpenNotifyCcReferenceView} className="rounded-2xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm font-black text-violet-700 hover:bg-violet-100 transition-colors">
                                                View Notify / CC Details
                                            </button>
                                        )}
                                        <button type="button" onClick={closeEventModal} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-100 transition-colors">
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={approvalWorkflowState.key === 'APPROVED' ? handleRegisterApprovedEvent : handleOpenApprovalWorkflow}
                                            disabled={isSavingEvent || isRoutingApproval}
                                            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 transition-colors shadow-sm disabled:cursor-not-allowed disabled:bg-slate-400"
                                        >
                                            {isSavingEvent
                                                ? 'Saving & Syncing...'
                                                : (isRoutingApproval ? 'Opening Approval...' : approvalWorkflowState.primaryActionLabel)}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {showRoomDiscountModal && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
                            <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Room Discount Settings</div>
                                        <h4 className="mt-2 text-2xl font-black text-slate-900">Apply a guest-room block discount</h4>
                                        <p className="mt-2 text-sm font-medium text-slate-500">
                                            Set a room-package less amount or percentage. The net room value is what syncs into banquet totals and room-hold calculations.
                                        </p>
                                    </div>
                                    <button type="button" onClick={() => setShowRoomDiscountModal(false)} className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-100 transition-colors">
                                        Close
                                    </button>
                                </div>

                                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                                    {[
                                        { value: 'NONE', label: 'No Discount' },
                                        { value: 'PERCENT', label: '% Discount' },
                                        { value: 'FIXED', label: 'Fixed Less' }
                                    ].map((discountOption) => (
                                        <button
                                            key={discountOption.value}
                                            type="button"
                                            onClick={() => setDraft((prev) => ({
                                                ...prev,
                                                room_discount_mode: discountOption.value,
                                                room_discount_value: discountOption.value === 'NONE' ? '' : prev.room_discount_value
                                            }))}
                                            className={`rounded-3xl border px-4 py-5 text-left transition-colors ${draft.room_discount_mode === discountOption.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                                        >
                                            <div className="text-sm font-black">{discountOption.label}</div>
                                            <div className={`mt-2 text-xs font-bold ${draft.room_discount_mode === discountOption.value ? 'text-slate-200' : 'text-slate-500'}`}>
                                                {discountOption.value === 'NONE' ? 'Keep room blocks at full contracted rate.' : 'Apply discount to the combined room-block revenue.'}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                                    <div>
                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Discount Value</label>
                                        <input
                                            type="number"
                                            min="0"
                                            disabled={draft.room_discount_mode === 'NONE'}
                                            value={draft.room_discount_value}
                                            onChange={(e) => setDraft((prev) => ({ ...prev, room_discount_value: e.target.value }))}
                                            className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
                                            placeholder={draft.room_discount_mode === 'PERCENT' ? '10' : '5000'}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Room Base</div>
                                            <div className="mt-2 text-lg font-black text-slate-900">{formatCurrency(draftRoomBaseRevenue)}</div>
                                        </div>
                                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
                                            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-600">Discount</div>
                                            <div className="mt-2 text-lg font-black text-rose-700">{formatCurrency(draftRoomDiscount)}</div>
                                        </div>
                                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                                            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">Room Net</div>
                                            <div className="mt-2 text-lg font-black text-emerald-700">{formatCurrency(draftRoomRevenue)}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 flex flex-wrap justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setDraft((prev) => ({ ...prev, room_discount_mode: 'NONE', room_discount_value: '' }))}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-100 transition-colors"
                                    >
                                        Clear Discount
                                    </button>
                                    <button type="button" onClick={() => setShowRoomDiscountModal(false)} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 transition-colors shadow-sm">
                                        Apply to Draft
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </>
            )}

            {selectedReceipt && (
                <ReceiptViewerModal
                    receipt={selectedReceipt}
                    receiptConfig={receiptConfig}
                    hotelLabel={currentHotelCode || 'SAMPLE HOTEL INC.'}
                    fallbackDepartment={`POS ${storeInfo.name || 'Event & Banquet'}`}
                    fileNamePrefix="event_pos_receipt"
                    onClose={() => setSelectedReceipt(null)}
                />
            )}

            {pgSession && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-fuchsia-500">PG Approval</div>
                                <h3 className="mt-2 text-2xl font-black text-slate-900">{getPaymentMethodLabel(pgSession.method)}</h3>
                                <p className="mt-2 text-sm font-medium text-slate-500">
                                    Hosted checkout is running for {selectedEvent?.title || 'the selected event'}. The payment entry is saved only after the gateway returns `PAID`.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPgSession(null)}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-100"
                            >
                                Close
                            </button>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Amount</div>
                                <div className="mt-2 text-lg font-black text-slate-900">{formatCurrency(pgSession.amount)}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Collection</div>
                                <div className="mt-2 text-lg font-black text-slate-900">{getCollectionLabel(pgSession.collectionType)}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Status</div>
                                <div className="mt-2 text-lg font-black text-slate-900">{pgSession.status || 'PENDING'}</div>
                            </div>
                        </div>

                        {pgSession.qr_image_url && (
                            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-6 text-center">
                                <img src={pgSession.qr_image_url} alt="Gateway checkout QR" className="mx-auto h-56 w-56 rounded-2xl bg-white p-3 shadow-sm" />
                                <div className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Scan or open the hosted checkout</div>
                                <div className="mt-2 break-all text-[11px] font-bold text-slate-500">{pgSession.payment_url || 'Gateway link pending'}</div>
                            </div>
                        )}

                        <div className="mt-5 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    if (pgSession.payment_url) {
                                        window.open(pgSession.payment_url, '_blank', 'noopener,noreferrer');
                                    }
                                }}
                                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
                            >
                                Open Hosted Checkout
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    pgSessionSavedRef.current = false;
                                    setPgSession(null);
                                }}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                            >
                                Stop Watching
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {sizeModalData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Size / Variant</div>
                                <h3 className="mt-2 text-2xl font-black text-slate-900">{sizeModalData.name}</h3>
                            </div>
                            <button type="button" onClick={() => setSizeModalData(null)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-100">
                                Close
                            </button>
                        </div>
                        <div className="mt-5 space-y-3">
                            {sizeModalData.sizes.map((size) => (
                                <button
                                    key={`${sizeModalData.id}_${size.name}`}
                                    type="button"
                                    onClick={() => addToCart(sizeModalData, size)}
                                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-left transition-colors hover:border-fuchsia-300 hover:bg-fuchsia-50"
                                >
                                    <span className="text-base font-black text-slate-900">{size.name}</span>
                                    <span className="text-base font-black text-fuchsia-700">₱{Number(size.price || 0).toLocaleString()}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
