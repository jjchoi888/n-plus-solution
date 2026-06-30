export const EVENT_TYPES = ['Wedding', 'Banquet', 'Seminar', 'Meeting', 'Birthday', 'Corporate Event', 'Social Event'];

export const EVENT_STATUSES = {
    LEAD: { label: 'Lead', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    QUOTED: { label: 'Quoted', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    CONFIRMED: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    OPERATION: { label: 'In Operation', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    COMPLETED: { label: 'Completed', className: 'bg-violet-100 text-violet-700 border-violet-200' },
    CANCELLED: { label: 'Cancelled', className: 'bg-rose-100 text-rose-700 border-rose-200' }
};

export const VENUE_CATEGORIES = [
    'Ballroom',
    'Function Room',
    'Boardroom',
    'Garden Venue',
    'Poolside Venue',
    'Rooftop Venue',
    'Pavilion',
    'Conference Hall'
];

export const CATERING_TEMPLATE_OPTIONS = [
    { name: 'AM Coffee Break', billing_mode: 'PER_PAX', unit_price: 450 },
    { name: 'PM Coffee Break', billing_mode: 'PER_PAX', unit_price: 450 },
    { name: 'Buffet Lunch', billing_mode: 'PER_PAX', unit_price: 1200 },
    { name: 'Buffet Dinner', billing_mode: 'PER_PAX', unit_price: 1450 },
    { name: 'Wedding Buffet', billing_mode: 'PER_PAX', unit_price: 1800 },
    { name: 'Seminar Full-Day Package', billing_mode: 'PER_PAX', unit_price: 2200 },
    { name: 'VIP Canape Reception', billing_mode: 'PACKAGE', unit_price: 18000 },
    { name: 'Packed Meals', billing_mode: 'PER_PAX', unit_price: 650 }
];

export const EVENT_OPTION_TEMPLATE_OPTIONS = [
    { name: 'Celebration Cake', unit_price: 3500 },
    { name: 'Flower Basket', unit_price: 2500 },
    { name: 'Live Orchestra', unit_price: 30000 },
    { name: 'Photo Booth', unit_price: 12000 },
    { name: 'LED Wall', unit_price: 18000 },
    { name: 'Sound System Upgrade', unit_price: 15000 }
];

export const BANQUET_FINANCE_CATEGORIES = [
    'Banquet Revenue',
    'Catering Revenue',
    'Group Room Block Revenue',
    'Event Deposit'
];

export const EVENT_POS_STORE_NAME = 'Event & Banquet';
export const EVENT_POS_STORE_TYPE = 'Event & Banquet';

const DEFAULT_BANQUET_VENUES = [
    {
        id: 'venue_grand_ballroom',
        name: 'Grand Ballroom',
        category: 'Ballroom',
        capacity: 350,
        base_rate: 180000,
        pricing_mode: 'PER_EVENT',
        description: 'Best for weddings, gala nights, and large social functions.'
    },
    {
        id: 'venue_function_hall_a',
        name: 'Function Hall A',
        category: 'Function Room',
        capacity: 120,
        base_rate: 55000,
        pricing_mode: 'PER_DAY',
        description: 'Flexible hall for training, seminars, and private dinners.'
    },
    {
        id: 'venue_boardroom',
        name: 'Executive Boardroom',
        category: 'Boardroom',
        capacity: 22,
        base_rate: 28000,
        pricing_mode: 'PER_DAY',
        description: 'Ideal for leadership meetings, presentations, and interviews.'
    },
    {
        id: 'venue_garden_lawn',
        name: 'Garden Lawn',
        category: 'Garden Venue',
        capacity: 220,
        base_rate: 90000,
        pricing_mode: 'PER_EVENT',
        description: 'Popular for outdoor ceremonies, receptions, and lifestyle events.'
    },
    {
        id: 'venue_poolside',
        name: 'Poolside Deck',
        category: 'Poolside Venue',
        capacity: 160,
        base_rate: 70000,
        pricing_mode: 'PER_EVENT',
        description: 'Good for cocktail parties, sunset banquets, and launch events.'
    },
    {
        id: 'venue_rooftop',
        name: 'Skyline Rooftop',
        category: 'Rooftop Venue',
        capacity: 80,
        base_rate: 65000,
        pricing_mode: 'PER_EVENT',
        description: 'Compact premium venue for private events and social celebrations.'
    }
];

const storageAvailable = () => typeof window !== 'undefined' && !!window.localStorage;

const getHotelStorageSuffix = (hotelCode) => String(hotelCode || '').trim() || 'default';
const normalizeEventPosStoreToken = (value) => String(value || '').trim().toLowerCase();

export const isEventBanquetStore = (store) => {
    const typeToken = normalizeEventPosStoreToken(store?.type);
    const nameToken = normalizeEventPosStoreToken(store?.name);
    return typeToken === normalizeEventPosStoreToken(EVENT_POS_STORE_TYPE)
        || nameToken === normalizeEventPosStoreToken(EVENT_POS_STORE_NAME)
        || (typeToken.includes('event') && typeToken.includes('banquet'))
        || (nameToken.includes('event') && nameToken.includes('banquet'));
};

const parseDate = (value) => {
    const raw = String(value || '').trim().slice(0, 10);
    if (!raw) return null;
    const parsed = new Date(`${raw}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getNextDateInput = (value) => {
    const parsed = parseDate(value);
    if (!parsed) return value;
    parsed.setDate(parsed.getDate() + 1);
    const localDate = new Date(parsed.getTime() - (parsed.getTimezoneOffset() * 60000));
    return localDate.toISOString().slice(0, 10);
};

const sortRoomsForStableAssignment = (rooms) => [...(Array.isArray(rooms) ? rooms : [])].sort((left, right) => {
    const getPriority = (room) => {
        const status = String(room?.status || '').toUpperCase();
        if (status === 'VACANT') return 0;
        if (status.includes('HK_') || status.includes('MAKE_UP')) return 1;
        if (status === 'RESERVED') return 2;
        if (status === 'OCCUPIED') return 3;
        if (status === 'MAINTENANCE' || status.includes('MT_')) return 4;
        return 5;
    };

    const leftPriority = getPriority(left);
    const rightPriority = getPriority(right);
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;

    const leftUsage = Number(left?.usage_count ?? left?.usageCount ?? 0);
    const rightUsage = Number(right?.usage_count ?? right?.usageCount ?? 0);
    if (leftUsage !== rightUsage) return leftUsage - rightUsage;

    return String(left?.id || '').localeCompare(String(right?.id || ''), undefined, { numeric: true });
});

export const buildLocalDateInput = (offsetDays = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return localDate.toISOString().slice(0, 10);
};

export const formatCurrency = (value) => `PHP ${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
})}`;

export const calculateEventSpanDays = (startDate, endDate) => {
    const start = parseDate(startDate);
    const end = parseDate(endDate || startDate);
    if (!start || !end) return 1;
    return Math.max(1, Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1);
};

export const calculateNights = (checkInDate, checkOutDate) => {
    const start = parseDate(checkInDate);
    const end = parseDate(checkOutDate);
    if (!start || !end) return 1;
    return Math.max(1, Math.floor((end - start) / (1000 * 60 * 60 * 24)) || 1);
};

export const createRoomBlock = (roomTypeName = '', nightlyRate = '') => ({
    id: `room_block_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    room_type: roomTypeName,
    quantity: 1,
    check_in_date: buildLocalDateInput(0),
    check_out_date: buildLocalDateInput(1),
    nightly_rate: nightlyRate ? String(nightlyRate) : '',
    note: '',
    assigned_room_ids: [],
    reservation_ids: [],
    allocation_warning: ''
});

export const normalizeRoomBlock = (block) => ({
    id: block?.id || `room_block_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    room_type: String(block?.room_type || '').trim(),
    quantity: Math.max(1, Number(block?.quantity) || 1),
    check_in_date: String(block?.check_in_date || buildLocalDateInput(0)),
    check_out_date: String(block?.check_out_date || buildLocalDateInput(1)),
    nightly_rate: String(block?.nightly_rate ?? ''),
    note: String(block?.note || '').trim(),
    assigned_room_ids: Array.isArray(block?.assigned_room_ids)
        ? Array.from(new Set(block.assigned_room_ids.map((roomId) => String(roomId || '').trim()).filter(Boolean)))
        : [],
    reservation_ids: Array.isArray(block?.reservation_ids)
        ? Array.from(new Set(block.reservation_ids.map((reservationId) => String(reservationId || '').trim()).filter(Boolean)))
        : [],
    allocation_warning: String(block?.allocation_warning || '').trim()
});

export const createCateringItem = (template = {}) => ({
    id: `catering_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: String(template?.name || ''),
    billing_mode: template?.billing_mode || 'PER_PAX',
    quantity: Number(template?.quantity || 1),
    pax_count: Number(template?.pax_count || 0),
    service_days: Number(template?.service_days || 1),
    unit_price: String(template?.unit_price ?? ''),
    note: String(template?.note || '')
});

export const normalizeCateringItem = (item) => ({
    id: item?.id || `catering_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: String(item?.name || '').trim(),
    billing_mode: item?.billing_mode === 'PACKAGE' ? 'PACKAGE' : 'PER_PAX',
    quantity: Math.max(1, Number(item?.quantity) || 1),
    pax_count: Math.max(0, Number(item?.pax_count) || 0),
    service_days: Math.max(1, Number(item?.service_days) || 1),
    unit_price: String(item?.unit_price ?? ''),
    note: String(item?.note || '').trim()
});

export const createEventOptionItem = (template = {}) => ({
    id: `event_option_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: String(template?.name || ''),
    quantity: Math.max(1, Number(template?.quantity) || 1),
    unit_price: String(template?.unit_price ?? ''),
    note: String(template?.note || '')
});

export const normalizeEventOptionItem = (item) => ({
    id: item?.id || `event_option_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: String(item?.name || '').trim(),
    quantity: Math.max(1, Number(item?.quantity) || 1),
    unit_price: String(item?.unit_price ?? ''),
    note: String(item?.note || '').trim()
});

export const createDefaultVenueDraft = () => ({
    id: null,
    name: '',
    category: VENUE_CATEGORIES[0],
    capacity: '',
    base_rate: '',
    pricing_mode: 'PER_EVENT',
    description: ''
});

export const normalizeVenueRecord = (venue) => ({
    id: String(venue?.id || `venue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    name: String(venue?.name || '').trim(),
    category: VENUE_CATEGORIES.includes(String(venue?.category || '').trim())
        ? String(venue.category).trim()
        : VENUE_CATEGORIES[0],
    capacity: Math.max(0, Number(venue?.capacity) || 0),
    base_rate: Math.max(0, Number(venue?.base_rate) || 0),
    pricing_mode: venue?.pricing_mode === 'PER_DAY' ? 'PER_DAY' : 'PER_EVENT',
    description: String(venue?.description || '').trim()
});

export const createDefaultFinanceSync = () => ({
    banquet_revenue: 0,
    catering_revenue: 0,
    room_block_revenue: 0,
    event_deposit: 0,
    synced_at: '',
    last_error: ''
});

export const createDefaultEventApprovalMeta = (status = 'PENDING') => ({
    status,
    archive_id: '',
    approved_at: '',
    approver_id: '',
    approver_name: '',
    approver_role: '',
    pdf_file_name: ''
});

export const normalizeEventApprovalMeta = (approval, fallbackStatus = 'PENDING') => {
    const requestedStatus = String(approval?.status || approval?.approval_status || fallbackStatus).trim().toUpperCase();
    const normalizedStatus = ['PENDING', 'APPROVED', 'LEGACY'].includes(requestedStatus)
        ? requestedStatus
        : fallbackStatus;

    return {
        ...createDefaultEventApprovalMeta(fallbackStatus),
        status: normalizedStatus,
        archive_id: String(approval?.archive_id || approval?.approval_archive_id || '').trim(),
        approved_at: String(approval?.approved_at || '').trim(),
        approver_id: String(approval?.approver_id || approval?.approved_by || '').trim(),
        approver_name: String(approval?.approver_name || approval?.approved_by_name || '').trim(),
        approver_role: String(approval?.approver_role || '').trim(),
        pdf_file_name: String(approval?.pdf_file_name || '').trim()
    };
};

export const createDefaultEventDraft = () => ({
    id: null,
    approval_request_id: '',
    event_type: 'Wedding',
    status: 'LEAD',
    title: '',
    client_name: '',
    company_name: '',
    contact_phone: '',
    contact_email: '',
    start_date: buildLocalDateInput(0),
    end_date: buildLocalDateInput(1),
    start_time: '09:00',
    end_time: '17:00',
    pax: '',
    venue_id: '',
    venue_name: '',
    venue_rate: '',
    venue_pricing_mode: 'PER_EVENT',
    venue_discount_mode: 'NONE',
    venue_discount_value: '',
    room_discount_mode: 'NONE',
    room_discount_value: '',
    other_revenue: '',
    deposit_amount: '',
    notes: '',
    room_blocks: [],
    catering_items: [],
    option_items: [],
    pos_orders: [],
    payments: [],
    finance_sync: createDefaultFinanceSync(),
    approval_meta: createDefaultEventApprovalMeta()
});

const normalizeEventPosOrderItem = (item) => ({
    id: String(item?.id || item?.cartId || `pos_item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    cartId: String(item?.cartId || item?.id || ''),
    name: String(item?.name || '').trim(),
    category: String(item?.category || '').trim(),
    selectedSize: String(item?.selectedSize || item?.size || 'Regular').trim() || 'Regular',
    price: Math.max(0, Number(item?.price) || 0),
    quantity: Math.max(1, Number(item?.quantity) || 1)
});

export const createEventPosOrderRecord = (order = {}) => ({
    id: String(order?.id || `event_pos_order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    created_at: String(order?.created_at || new Date().toISOString()),
    created_by: String(order?.created_by || '').trim(),
    source_store_id: String(order?.source_store_id || '').trim(),
    source_store_name: String(order?.source_store_name || '').trim(),
    note: String(order?.note || '').trim(),
    subtotal: Math.max(0, Number(order?.subtotal) || 0),
    vat_amount: Math.max(0, Number(order?.vat_amount) || 0),
    service_charge: Math.max(0, Number(order?.service_charge) || 0),
    total_amount: Math.max(0, Number(order?.total_amount) || 0),
    items: (Array.isArray(order?.items) ? order.items : []).map(normalizeEventPosOrderItem)
});

export const normalizeEventPosOrderRecord = (order) => createEventPosOrderRecord(order);

export const normalizeEventPaymentRecord = (payment) => ({
    id: String(payment?.id || `payment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    paid_at: String(payment?.paid_at || new Date().toISOString()),
    amount: Math.max(0, Number(payment?.amount) || 0),
    method: String(payment?.method || 'CASH').trim().toUpperCase(),
    collection_type: ['DEPOSIT', 'PARTIAL', 'FULL_SETTLEMENT'].includes(String(payment?.collection_type || '').toUpperCase())
        ? String(payment.collection_type).toUpperCase()
        : 'PARTIAL',
    pos_store_id: String(payment?.pos_store_id || '').trim(),
    pos_store_name: String(payment?.pos_store_name || '').trim(),
    terminal_id: String(payment?.terminal_id || '').trim(),
    terminal_name: String(payment?.terminal_name || '').trim(),
    note: String(payment?.note || '').trim(),
    provider: String(payment?.provider || payment?.gateway_provider || '').trim(),
    gateway_reference: String(payment?.gateway_reference || payment?.transaction_reference || '').trim(),
    gateway_url: String(payment?.gateway_url || payment?.payment_url || '').trim(),
    approval_status: String(payment?.approval_status || (payment?.gateway_reference ? 'APPROVED' : 'MANUAL')).trim().toUpperCase(),
    verified_at: String(payment?.verified_at || '').trim()
});

export const normalizeEventRecord = (event) => {
    const defaultDraft = createDefaultEventDraft();
    const financeSync = {
        ...createDefaultFinanceSync(),
        ...(event?.finance_sync || {})
    };
    const approvalSource = {
        ...(event?.approval_meta || {}),
        status: event?.approval_status || event?.approval_meta?.status || '',
        archive_id: event?.approval_archive_id || event?.approval_meta?.archive_id || '',
        approved_at: event?.approved_at || event?.approval_meta?.approved_at || '',
        approver_id: event?.approved_by || event?.approval_meta?.approver_id || '',
        approver_name: event?.approved_by_name || event?.approval_meta?.approver_name || '',
        approver_role: event?.approver_role || event?.approval_meta?.approver_role || '',
        pdf_file_name: event?.approval_pdf_file_name || event?.approval_meta?.pdf_file_name || ''
    };
    const hasApprovalFields = Object.values(approvalSource).some(Boolean);
    const approvalMeta = normalizeEventApprovalMeta(
        approvalSource,
        event?.id && !hasApprovalFields ? 'LEGACY' : 'PENDING'
    );
    const legacyDate = String(event?.start_date || event?.event_date || defaultDraft.start_date);
    const legacyEndDate = String(event?.end_date || event?.event_date || legacyDate);
    const otherRevenueValue = event?.other_revenue ?? event?.event_revenue ?? '';

    return {
        ...defaultDraft,
        ...event,
        approval_request_id: String(event?.approval_request_id || event?.approvalRequestId || '').trim(),
        start_date: legacyDate,
        end_date: legacyEndDate,
        pax: Number(event?.pax) || 0,
        venue_rate: String(event?.venue_rate ?? ''),
        venue_pricing_mode: event?.venue_pricing_mode === 'PER_DAY' ? 'PER_DAY' : 'PER_EVENT',
        venue_discount_mode: ['NONE', 'PERCENT', 'FIXED'].includes(String(event?.venue_discount_mode || '').toUpperCase())
            ? String(event.venue_discount_mode).toUpperCase()
            : 'NONE',
        venue_discount_value: String(event?.venue_discount_value ?? ''),
        room_discount_mode: ['NONE', 'PERCENT', 'FIXED'].includes(String(event?.room_discount_mode || '').toUpperCase())
            ? String(event.room_discount_mode).toUpperCase()
            : 'NONE',
        room_discount_value: String(event?.room_discount_value ?? ''),
        other_revenue: String(otherRevenueValue ?? ''),
        deposit_amount: Number(event?.deposit_amount) || 0,
        notes: String(event?.notes || '').trim(),
        room_blocks: (Array.isArray(event?.room_blocks) ? event.room_blocks : []).map(normalizeRoomBlock),
        catering_items: (Array.isArray(event?.catering_items) ? event.catering_items : []).map(normalizeCateringItem),
        option_items: (
            Array.isArray(event?.option_items)
                ? event.option_items
                : (Array.isArray(event?.event_options) ? event.event_options : [])
        ).map(normalizeEventOptionItem),
        pos_orders: (Array.isArray(event?.pos_orders) ? event.pos_orders : []).map(normalizeEventPosOrderRecord),
        payments: (Array.isArray(event?.payments) ? event.payments : []).map(normalizeEventPaymentRecord),
        finance_sync: financeSync,
        approval_meta: approvalMeta
    };
};

export const getBanquetEventsStorageKey = (hotelCode) => `banquet_events_${getHotelStorageSuffix(hotelCode)}`;

export const getBanquetVenuesStorageKey = (hotelCode) => `banquet_venues_${getHotelStorageSuffix(hotelCode)}`;

export const getBanquetApprovalArchiveStorageKey = (hotelCode) => `banquet_event_approval_archives_${getHotelStorageSuffix(hotelCode)}`;

export const getEventPosStoreMetaStorageKey = (hotelCode) => `event_pos_store_meta_${getHotelStorageSuffix(hotelCode)}`;

export const normalizeEventApprovalArchive = (archive) => ({
    id: String(archive?.id || `approval_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    created_at: String(archive?.created_at || archive?.approved_at || new Date().toISOString()),
    approved_at: String(archive?.approved_at || archive?.created_at || new Date().toISOString()),
    hotel_code: String(archive?.hotel_code || '').trim(),
    event_id: String(archive?.event_id || '').trim(),
    event_title: String(archive?.event_title || '').trim(),
    client_name: String(archive?.client_name || '').trim(),
    venue_name: String(archive?.venue_name || '').trim(),
    approver_id: String(archive?.approver_id || '').trim(),
    approver_name: String(archive?.approver_name || '').trim(),
    approver_role: String(archive?.approver_role || '').trim(),
    signature_data_url: String(archive?.signature_data_url || '').trim(),
    pdf_data_url: String(archive?.pdf_data_url || '').trim(),
    pdf_file_name: String(archive?.pdf_file_name || '').trim(),
    event_snapshot: archive?.event_snapshot && typeof archive.event_snapshot === 'object'
        ? archive.event_snapshot
        : {}
});

export const loadEventPosStoreMeta = (hotelCode) => {
    if (!storageAvailable()) return null;

    try {
        const stored = JSON.parse(window.localStorage.getItem(getEventPosStoreMetaStorageKey(hotelCode)) || 'null');
        if (!stored || typeof stored !== 'object') return null;
        return {
            id: String(stored.id || '').trim(),
            name: String(stored.name || '').trim(),
            location: String(stored.location || '').trim()
        };
    } catch {
        return null;
    }
};

export const saveEventPosStoreMeta = (hotelCode, meta) => {
    if (!storageAvailable()) return;
    window.localStorage.setItem(getEventPosStoreMetaStorageKey(hotelCode), JSON.stringify({
        id: String(meta?.id || '').trim(),
        name: String(meta?.name || '').trim(),
        location: String(meta?.location || '').trim()
    }));
};

export const clearEventPosStoreMeta = (hotelCode) => {
    if (!storageAvailable()) return;
    window.localStorage.removeItem(getEventPosStoreMetaStorageKey(hotelCode));
};

export const buildManagedEventPosStorePayload = ({ venues, existingStore, stores } = {}) => {
    const venueCount = Math.max(
        1,
        (Array.isArray(venues) ? venues : []).filter((venue) => String(venue?.name || '').trim()).length || 1
    );
    const numericLocations = (Array.isArray(stores) ? stores : [])
        .map((store) => Number(store?.location))
        .filter((value) => Number.isFinite(value) && value > 0);
    const nextLocation = numericLocations.length ? (Math.max(...numericLocations) + 1) : 1;

    return {
        name: EVENT_POS_STORE_NAME,
        type: EVENT_POS_STORE_TYPE,
        location: String(existingStore?.location || nextLocation),
        table_count: venueCount,
        is_room_linked: false
    };
};

export const loadBanquetEvents = (hotelCode) => {
    if (!storageAvailable()) return [];

    try {
        const stored = JSON.parse(window.localStorage.getItem(getBanquetEventsStorageKey(hotelCode)) || '[]');
        return (Array.isArray(stored) ? stored : []).map(normalizeEventRecord);
    } catch {
        return [];
    }
};

export const saveBanquetEvents = (hotelCode, events) => {
    if (!storageAvailable()) return;
    window.localStorage.setItem(getBanquetEventsStorageKey(hotelCode), JSON.stringify((Array.isArray(events) ? events : []).map(normalizeEventRecord)));
};

export const loadBanquetApprovalArchives = (hotelCode) => {
    if (!storageAvailable()) return [];

    try {
        const stored = JSON.parse(window.localStorage.getItem(getBanquetApprovalArchiveStorageKey(hotelCode)) || '[]');
        return (Array.isArray(stored) ? stored : []).map(normalizeEventApprovalArchive);
    } catch {
        return [];
    }
};

export const saveBanquetApprovalArchives = (hotelCode, archives) => {
    if (!storageAvailable()) return;
    window.localStorage.setItem(
        getBanquetApprovalArchiveStorageKey(hotelCode),
        JSON.stringify((Array.isArray(archives) ? archives : []).map(normalizeEventApprovalArchive))
    );
};

export const loadBanquetVenues = (hotelCode) => {
    if (!storageAvailable()) {
        return DEFAULT_BANQUET_VENUES.map(normalizeVenueRecord);
    }

    try {
        const stored = JSON.parse(window.localStorage.getItem(getBanquetVenuesStorageKey(hotelCode)) || '[]');
        const normalized = (Array.isArray(stored) ? stored : []).map(normalizeVenueRecord).filter((venue) => venue.name);
        return normalized.length ? normalized : DEFAULT_BANQUET_VENUES.map(normalizeVenueRecord);
    } catch {
        return DEFAULT_BANQUET_VENUES.map(normalizeVenueRecord);
    }
};

export const saveBanquetVenues = (hotelCode, venues) => {
    if (!storageAvailable()) return;
    window.localStorage.setItem(getBanquetVenuesStorageKey(hotelCode), JSON.stringify((Array.isArray(venues) ? venues : []).map(normalizeVenueRecord)));
};

export const getVenueRateForEvent = (event, venueMap = {}) => {
    const venue = venueMap[event?.venue_id] || venueMap[event?.venue_name] || null;
    const rawRate = event?.venue_rate !== '' && event?.venue_rate !== null && event?.venue_rate !== undefined
        ? event.venue_rate
        : venue?.base_rate;
    return Math.max(0, Number(rawRate) || 0);
};

export const getVenuePricingModeForEvent = (event, venueMap = {}) => {
    const venue = venueMap[event?.venue_id] || venueMap[event?.venue_name] || null;
    return event?.venue_pricing_mode === 'PER_DAY'
        ? 'PER_DAY'
        : (venue?.pricing_mode === 'PER_DAY' ? 'PER_DAY' : 'PER_EVENT');
};

export const getVenueBaseTotal = (event, venueMap = {}) => {
    const rate = getVenueRateForEvent(event, venueMap);
    const pricingMode = getVenuePricingModeForEvent(event, venueMap);
    const multiplier = pricingMode === 'PER_DAY' ? calculateEventSpanDays(event?.start_date, event?.end_date) : 1;
    return rate * multiplier;
};

export const getVenueDiscountAmount = (event, venueMap = {}) => {
    const baseTotal = getVenueBaseTotal(event, venueMap);
    const discountMode = String(event?.venue_discount_mode || 'NONE').toUpperCase();
    const discountValue = Math.max(0, Number(event?.venue_discount_value) || 0);

    if (discountMode === 'PERCENT') {
        return Math.min(baseTotal, (baseTotal * discountValue) / 100);
    }

    if (discountMode === 'FIXED') {
        return Math.min(baseTotal, discountValue);
    }

    return 0;
};

export const getVenueNetTotal = (event, venueMap = {}) => Math.max(0, getVenueBaseTotal(event, venueMap) - getVenueDiscountAmount(event, venueMap));

export const getOtherRevenueTotal = (event) => Math.max(0, Number(event?.other_revenue ?? event?.event_revenue ?? 0) || 0);

export const calculateCateringLineTotal = (item) => {
    const normalizedItem = normalizeCateringItem(item);
    const unitPrice = Math.max(0, Number(normalizedItem.unit_price) || 0);

    if (normalizedItem.billing_mode === 'PACKAGE') {
        return unitPrice * Math.max(1, Number(normalizedItem.quantity) || 1);
    }

    const paxCount = Math.max(0, Number(normalizedItem.pax_count) || 0);
    return unitPrice * paxCount * Math.max(1, Number(normalizedItem.service_days) || 1);
};

export const getCateringTotal = (items) => (Array.isArray(items) ? items : []).reduce((sum, item) => sum + calculateCateringLineTotal(item), 0);

export const calculateEventOptionLineTotal = (item) => {
    const normalizedItem = normalizeEventOptionItem(item);
    const unitPrice = Math.max(0, Number(normalizedItem.unit_price) || 0);
    return unitPrice * Math.max(1, Number(normalizedItem.quantity) || 1);
};

export const getEventOptionsTotal = (items) => (
    (Array.isArray(items) ? items : []).reduce((sum, item) => sum + calculateEventOptionLineTotal(item), 0)
);

const getRoomBlocksInput = (value) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.room_blocks)) return value.room_blocks;
    return [];
};

export const getRoomBlockRevenue = (block, roomTypeRateMap = {}) => {
    const normalizedBlock = normalizeRoomBlock(block);
    const fallbackRate = Number(roomTypeRateMap?.[normalizedBlock.room_type]?.baseRate || 0);
    const nightlyRate = Math.max(0, Number(normalizedBlock.nightly_rate || fallbackRate) || 0);
    return (Number(normalizedBlock.quantity) || 0) * nightlyRate * calculateNights(normalizedBlock.check_in_date, normalizedBlock.check_out_date);
};

export const getRoomBlocksBaseRevenue = (roomBlocks, roomTypeRateMap = {}) => (
    getRoomBlocksInput(roomBlocks).reduce((sum, block) => sum + getRoomBlockRevenue(block, roomTypeRateMap), 0)
);

export const getRoomDiscountAmount = (event, roomTypeRateMap = {}) => {
    const baseTotal = getRoomBlocksBaseRevenue(event, roomTypeRateMap);
    const discountMode = String(event?.room_discount_mode || 'NONE').toUpperCase();
    const discountValue = Math.max(0, Number(event?.room_discount_value) || 0);

    if (discountMode === 'PERCENT') {
        return Math.min(baseTotal, (baseTotal * discountValue) / 100);
    }

    if (discountMode === 'FIXED') {
        return Math.min(baseTotal, discountValue);
    }

    return 0;
};

export const getRoomBlocksRevenue = (event, roomTypeRateMap = {}) => (
    Math.max(0, getRoomBlocksBaseRevenue(event, roomTypeRateMap) - getRoomDiscountAmount(event, roomTypeRateMap))
);

export const getEventPaymentsTotal = (event) => (
    (Array.isArray(event?.payments) ? event.payments : []).reduce((sum, payment) => sum + (Number(payment?.amount) || 0), 0)
);

export const getEventPosOrderTotal = (order) => Math.max(0, Number(order?.total_amount) || 0);

export const getEventPosOrdersTotal = (event) => (
    (Array.isArray(event?.pos_orders) ? event.pos_orders : []).reduce((sum, order) => sum + getEventPosOrderTotal(order), 0)
);

export const getEventGrandTotal = (event, options = {}) => {
    const venueMap = options?.venueMap || {};
    const roomTypeRateMap = options?.roomTypeRateMap || {};

    return getVenueNetTotal(event, venueMap)
        + getCateringTotal(event?.catering_items)
        + getEventOptionsTotal(event?.option_items)
        + getOtherRevenueTotal(event)
        + getEventPosOrdersTotal(event)
        + getRoomBlocksRevenue(event, roomTypeRateMap);
};

export const isDateWithinRange = (targetDate, startDate, endDate) => {
    const target = parseDate(targetDate);
    const start = parseDate(startDate);
    const end = parseDate(endDate || startDate);
    if (!target || !start || !end) return false;
    return target >= start && target <= end;
};

export const doDateRangesOverlap = (startDateA, endDateA, startDateB, endDateB) => {
    const startA = parseDate(startDateA);
    const endA = parseDate(endDateA);
    const startB = parseDate(startDateB);
    const endB = parseDate(endDateB);
    if (!startA || !endA || !startB || !endB) return false;
    return startA < endB && startB < endA;
};

export const doesRoomBlockCoverDate = (targetDate, block) => doDateRangesOverlap(
    targetDate,
    getNextDateInput(targetDate),
    block?.check_in_date,
    block?.check_out_date
);

export const shouldReserveRoomBlock = (event) => ['CONFIRMED', 'OPERATION', 'COMPLETED'].includes(String(event?.status || '').toUpperCase());

export const shouldSyncRoomBlock = (event) => {
    const status = String(event?.status || '').toUpperCase();
    return status !== 'CANCELLED';
};

export const assignEventRoomBlocks = ({ event, otherEvents, hotelRooms }) => {
    const normalizedEvent = normalizeEventRecord(event);

    if (!shouldSyncRoomBlock(normalizedEvent)) {
        return {
            ...normalizedEvent,
            room_blocks: (normalizedEvent.room_blocks || []).map((block) => ({
                ...normalizeRoomBlock(block),
                assigned_room_ids: [],
                allocation_warning: ''
            }))
        };
    }

    const roomsByType = {};
    sortRoomsForStableAssignment(hotelRooms).forEach((room) => {
        const roomTypeName = String(room?.room_type || room?.type || '').trim();
        if (!roomTypeName) return;
        if (!roomsByType[roomTypeName]) roomsByType[roomTypeName] = [];
        roomsByType[roomTypeName].push(room);
    });

    const normalizedOtherEvents = (Array.isArray(otherEvents) ? otherEvents : [])
        .map(normalizeEventRecord)
        .filter((candidate) => candidate.id !== normalizedEvent.id && shouldSyncRoomBlock(candidate));

    const usedWithinEvent = new Set();
    const nextBlocks = (normalizedEvent.room_blocks || []).map((block) => {
        const normalizedBlock = normalizeRoomBlock(block);
        const reservedByOtherEvents = new Set();

        normalizedOtherEvents.forEach((otherEvent) => {
            (otherEvent.room_blocks || []).forEach((otherBlock) => {
                const normalizedOtherBlock = normalizeRoomBlock(otherBlock);
                const overlaps = doDateRangesOverlap(
                    normalizedBlock.check_in_date,
                    normalizedBlock.check_out_date,
                    normalizedOtherBlock.check_in_date,
                    normalizedOtherBlock.check_out_date
                );
                if (!overlaps) return;

                (normalizedOtherBlock.assigned_room_ids || []).forEach((roomId) => reservedByOtherEvents.add(String(roomId)));
            });
        });

        const validExistingAssignments = (normalizedBlock.assigned_room_ids || []).filter((roomId) => {
            if (usedWithinEvent.has(roomId)) return false;
            const roomMeta = (roomsByType[normalizedBlock.room_type] || []).find((room) => String(room.id) === String(roomId));
            if (!roomMeta) return false;
            return !reservedByOtherEvents.has(String(roomId));
        });

        const assignedRoomIds = [...validExistingAssignments];
        assignedRoomIds.forEach((roomId) => usedWithinEvent.add(roomId));

        const candidateRooms = (roomsByType[normalizedBlock.room_type] || []).filter((room) => {
            const roomId = String(room.id);
            return !usedWithinEvent.has(roomId) && !reservedByOtherEvents.has(roomId);
        });

        for (const room of candidateRooms) {
            if (assignedRoomIds.length >= Number(normalizedBlock.quantity || 0)) break;
            assignedRoomIds.push(String(room.id));
            usedWithinEvent.add(String(room.id));
        }

        const shortage = Math.max(0, Number(normalizedBlock.quantity || 0) - assignedRoomIds.length);
        const allocationWarning = shortage > 0
            ? `${shortage} room(s) still need physical assignment for ${normalizedBlock.room_type || 'this room type'}.`
            : '';

        return {
            ...normalizedBlock,
            assigned_room_ids: assignedRoomIds,
            allocation_warning: allocationWarning
        };
    });

    return {
        ...normalizedEvent,
        room_blocks: nextBlocks
    };
};

export const buildHeldRoomMap = ({ events, rooms, date }) => {
    const heldMap = {};
    const normalizedEvents = (Array.isArray(events) ? events : []).map(normalizeEventRecord).filter(shouldSyncRoomBlock);
    const normalizedDate = String(date || '').trim();
    if (!normalizedDate) return heldMap;

    const roomLookup = Object.fromEntries((Array.isArray(rooms) ? rooms : []).map((room) => [String(room.id), room]));

    normalizedEvents.forEach((event) => {
        (event.room_blocks || []).forEach((block) => {
            const normalizedBlock = normalizeRoomBlock(block);
            if (!doesRoomBlockCoverDate(normalizedDate, normalizedBlock)) return;

            (normalizedBlock.assigned_room_ids || []).forEach((roomId) => {
                heldMap[String(roomId)] = {
                    eventId: event.id,
                    title: event.title,
                    clientName: event.client_name,
                    venueName: event.venue_name,
                    roomType: normalizedBlock.room_type,
                    startDate: normalizedBlock.check_in_date,
                    endDate: normalizedBlock.check_out_date,
                    status: event.status,
                    room: roomLookup[String(roomId)] || null
                };
            });
        });
    });

    return heldMap;
};

export const getVenueAvailabilityCards = ({ events, venues, date }) => {
    const normalizedDate = String(date || '').trim();
    const normalizedEvents = (Array.isArray(events) ? events : []).map(normalizeEventRecord);
    const storedVenues = (Array.isArray(venues) ? venues : []).map(normalizeVenueRecord);
    const mappedVenues = new Map(storedVenues.map((venue) => [venue.name, venue]));

    normalizedEvents.forEach((event) => {
        const venueName = String(event.venue_name || '').trim();
        if (!venueName || mappedVenues.has(venueName)) return;
        mappedVenues.set(venueName, normalizeVenueRecord({
            id: `derived_${venueName.replace(/\s+/g, '_').toLowerCase()}`,
            name: venueName,
            category: VENUE_CATEGORIES[0],
            capacity: 0,
            base_rate: Number(event.venue_rate || 0),
            pricing_mode: event.venue_pricing_mode || 'PER_EVENT',
            description: ''
        }));
    });

    return Array.from(mappedVenues.values())
        .map((venue) => {
            const matchingEvents = normalizedEvents.filter((event) => String(event.venue_name || '').trim() === venue.name && isDateWithinRange(normalizedDate, event.start_date, event.end_date));
            const blockingEvents = matchingEvents.filter((event) => shouldReserveRoomBlock(event));
            const tentativeEvents = matchingEvents.filter((event) => ['LEAD', 'QUOTED'].includes(String(event.status || '').toUpperCase()));

            return {
                ...venue,
                isBooked: blockingEvents.length > 0,
                blockingEvents,
                tentativeEvents,
                blockedRooms: blockingEvents.reduce((sum, event) => sum + (event.room_blocks || []).reduce((roomSum, block) => roomSum + (Number(block.quantity) || 0), 0), 0),
                cateringTotal: blockingEvents.reduce((sum, event) => sum + getCateringTotal(event.catering_items), 0)
            };
        })
        .sort((left, right) => {
            if (left.isBooked !== right.isBooked) return left.isBooked ? -1 : 1;
            return left.name.localeCompare(right.name);
        });
};
