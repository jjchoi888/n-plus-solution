const storageAvailable = () => typeof window !== 'undefined' && !!window.localStorage;

const getHotelStorageSuffix = (hotelCode) => String(hotelCode || '').trim() || 'default';

const REQUEST_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
const APPROVER_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
const NOTIFICATION_TYPES = [
    'REQUEST_SUBMITTED',
    'REQUEST_APPROVED',
    'REQUEST_REJECTED',
    'REQUEST_UPDATED',
    'REQUEST_APPLIED',
    'REQUEST_ROUTED'
];

export const APPROVAL_REQUEST_STATUS_META = {
    DRAFT: { label: 'Draft', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    PENDING: { label: 'Pending Approval', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    APPROVED: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    REJECTED: { label: 'Rejected', className: 'bg-rose-100 text-rose-700 border-rose-200' },
    CANCELLED: { label: 'Cancelled', className: 'bg-slate-200 text-slate-600 border-slate-300' }
};

export const APPROVAL_REQUEST_TYPE_META = {
    EVENT_PAYMENT: {
        label: 'Event Payment Approval',
        moduleLabel: 'Event POS'
    }
};

const toSafeToken = (value) => String(value || '').trim();
const normalizeApprovalLevel = (value) => {
    const parsedLevel = Number.parseInt(value, 10);
    return Number.isFinite(parsedLevel) && parsedLevel > 0 ? parsedLevel : 1;
};
const cloneTimelineEntries = (timeline = []) => (
    (Array.isArray(timeline) ? timeline : []).map((entry) => ({ ...entry }))
);
const dedupeApprovalParties = (parties = []) => {
    const seen = new Set();

    return (Array.isArray(parties) ? parties : [])
        .map(normalizeApprovalParty)
        .filter((party) => {
            const normalizedId = party.user_id.toLowerCase();
            if (!normalizedId || seen.has(normalizedId)) return false;
            seen.add(normalizedId);
            return true;
        });
};

const createTimelineEntry = ({
    type,
    userId = '',
    userName = '',
    note = '',
    meta = {}
}) => ({
    id: `approval_timeline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: toSafeToken(type) || 'UPDATED',
    user_id: toSafeToken(userId),
    user_name: toSafeToken(userName || userId),
    note: String(note || '').trim(),
    created_at: new Date().toISOString(),
    meta: meta && typeof meta === 'object' ? meta : {}
});

export const createApprovalParty = ({ userId = '', userName = '', role = '' } = {}) => ({
    user_id: toSafeToken(userId),
    user_name: toSafeToken(userName || userId),
    role: toSafeToken(role)
});

export const normalizeApprovalParty = (party = {}) => {
    const safeParty = party && typeof party === 'object' ? party : {};

    return createApprovalParty({
        userId: safeParty.user_id || safeParty.userId || '',
        userName: safeParty.user_name || safeParty.userName || safeParty.name || '',
        role: safeParty.role || ''
    });
};

export const normalizeApprovalApprover = (approver = {}) => {
    const safeApprover = approver && typeof approver === 'object' ? approver : {};
    const normalizedParty = normalizeApprovalParty(safeApprover);
    const requestedStatus = String(safeApprover.status || 'PENDING').trim().toUpperCase();

    return {
        ...normalizedParty,
        status: APPROVER_STATUSES.includes(requestedStatus) ? requestedStatus : 'PENDING',
        level: normalizeApprovalLevel(safeApprover.level),
        acted_at: toSafeToken(safeApprover.acted_at),
        decision_note: String(safeApprover.decision_note || '').trim(),
        routed_by: toSafeToken(safeApprover.routed_by),
        routed_at: toSafeToken(safeApprover.routed_at)
    };
};

export const normalizeApprovalArchive = (archive = {}) => {
    const safeArchive = archive && typeof archive === 'object' ? archive : {};

    return {
        id: toSafeToken(safeArchive.id) || `approval_archive_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        created_at: toSafeToken(safeArchive.created_at) || new Date().toISOString(),
        approved_at: toSafeToken(safeArchive.approved_at),
        file_name: toSafeToken(safeArchive.file_name || safeArchive.pdf_file_name),
        pdf_data_url: String(safeArchive.pdf_data_url || '').trim(),
        meta: safeArchive.meta && typeof safeArchive.meta === 'object' ? safeArchive.meta : {}
    };
};

const deriveRequestStatus = (request = {}) => {
    const rawStatus = String(request.status || '').trim().toUpperCase();
    if (rawStatus === 'DRAFT' || rawStatus === 'CANCELLED') return rawStatus;

    const approvers = (Array.isArray(request.approvers) ? request.approvers : []).map(normalizeApprovalApprover);
    if (approvers.some((approver) => approver.status === 'REJECTED')) return 'REJECTED';
    if (approvers.length > 0 && approvers.every((approver) => approver.status === 'APPROVED')) return 'APPROVED';
    if (request.submitted_at || approvers.length > 0) return 'PENDING';
    return REQUEST_STATUSES.includes(rawStatus) ? rawStatus : 'DRAFT';
};

export const normalizeApprovalRequest = (request = {}) => {
    const safeRequest = request && typeof request === 'object' ? request : {};
    const timeline = (Array.isArray(safeRequest.timeline) ? safeRequest.timeline : []).map((entry) => ({
        id: toSafeToken(entry.id) || `approval_timeline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: toSafeToken(entry.type) || 'UPDATED',
        user_id: toSafeToken(entry.user_id),
        user_name: toSafeToken(entry.user_name),
        note: String(entry.note || '').trim(),
        created_at: toSafeToken(entry.created_at) || new Date().toISOString(),
        meta: entry.meta && typeof entry.meta === 'object' ? entry.meta : {}
    }));

    return {
        id: toSafeToken(safeRequest.id) || `approval_request_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        hotel_code: toSafeToken(safeRequest.hotel_code),
        type: toSafeToken(safeRequest.type) || 'EVENT_PAYMENT',
        title: String(safeRequest.title || '').trim(),
        subject: String(safeRequest.subject || '').trim(),
        status: deriveRequestStatus(safeRequest),
        source_module: toSafeToken(safeRequest.source_module || safeRequest.sourceModule),
        source_path: toSafeToken(safeRequest.source_path || safeRequest.sourcePath),
        source_label: String(safeRequest.source_label || safeRequest.sourceLabel || '').trim(),
        source_record_id: toSafeToken(safeRequest.source_record_id || safeRequest.sourceRecordId),
        source_record_title: String(safeRequest.source_record_title || safeRequest.sourceRecordTitle || '').trim(),
        requested_by: normalizeApprovalParty(safeRequest.requested_by || safeRequest.requestedBy),
        approvers: (Array.isArray(safeRequest.approvers) ? safeRequest.approvers : []).map(normalizeApprovalApprover),
        watchers: (Array.isArray(safeRequest.watchers) ? safeRequest.watchers : []).map(normalizeApprovalParty),
        request_note: String(safeRequest.request_note || '').trim(),
        decision_note: String(safeRequest.decision_note || '').trim(),
        summary: safeRequest.summary && typeof safeRequest.summary === 'object' ? safeRequest.summary : {},
        payload: safeRequest.payload && typeof safeRequest.payload === 'object' ? safeRequest.payload : {},
        archive: safeRequest.archive ? normalizeApprovalArchive(safeRequest.archive) : null,
        created_at: toSafeToken(safeRequest.created_at) || new Date().toISOString(),
        updated_at: toSafeToken(safeRequest.updated_at) || new Date().toISOString(),
        submitted_at: toSafeToken(safeRequest.submitted_at),
        approved_at: toSafeToken(safeRequest.approved_at),
        rejected_at: toSafeToken(safeRequest.rejected_at),
        cancelled_at: toSafeToken(safeRequest.cancelled_at),
        source_applied_at: toSafeToken(safeRequest.source_applied_at),
        source_applied_by: toSafeToken(safeRequest.source_applied_by),
        linked_record_id: toSafeToken(safeRequest.linked_record_id),
        timeline: timeline.length > 0 ? timeline : [
            createTimelineEntry({
                type: 'DRAFT_CREATED',
                userId: safeRequest.requested_by?.user_id || safeRequest.requestedBy?.user_id || '',
                userName: safeRequest.requested_by?.user_name || safeRequest.requestedBy?.user_name || '',
                note: safeRequest.subject || safeRequest.title || 'Approval request created.'
            })
        ]
    };
};

export const normalizeApprovalNotification = (notification = {}) => {
    const type = String(notification.type || 'REQUEST_UPDATED').trim().toUpperCase();

    return {
        id: toSafeToken(notification.id) || `approval_notification_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        hotel_code: toSafeToken(notification.hotel_code),
        user_id: toSafeToken(notification.user_id),
        type: NOTIFICATION_TYPES.includes(type) ? type : 'REQUEST_UPDATED',
        request_id: toSafeToken(notification.request_id),
        title: String(notification.title || '').trim(),
        message: String(notification.message || '').trim(),
        source_path: toSafeToken(notification.source_path),
        created_at: toSafeToken(notification.created_at) || new Date().toISOString(),
        read_at: toSafeToken(notification.read_at)
    };
};

export const getCompanyApprovalRequestsStorageKey = (hotelCode) => `company_approval_requests_${getHotelStorageSuffix(hotelCode)}`;
export const getCompanyApprovalNotificationsStorageKey = (hotelCode) => `company_approval_notifications_${getHotelStorageSuffix(hotelCode)}`;

export const loadCompanyApprovalRequests = (hotelCode) => {
    if (!storageAvailable()) return [];

    try {
        const stored = JSON.parse(window.localStorage.getItem(getCompanyApprovalRequestsStorageKey(hotelCode)) || '[]');
        return (Array.isArray(stored) ? stored : [])
            .map(normalizeApprovalRequest)
            .sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || '')));
    } catch {
        return [];
    }
};

export const saveCompanyApprovalRequests = (hotelCode, requests) => {
    if (!storageAvailable()) return;
    window.localStorage.setItem(
        getCompanyApprovalRequestsStorageKey(hotelCode),
        JSON.stringify((Array.isArray(requests) ? requests : []).map(normalizeApprovalRequest))
    );
};

export const loadCompanyApprovalNotifications = (hotelCode) => {
    if (!storageAvailable()) return [];

    try {
        const stored = JSON.parse(window.localStorage.getItem(getCompanyApprovalNotificationsStorageKey(hotelCode)) || '[]');
        return (Array.isArray(stored) ? stored : [])
            .map(normalizeApprovalNotification)
            .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')));
    } catch {
        return [];
    }
};

export const saveCompanyApprovalNotifications = (hotelCode, notifications) => {
    if (!storageAvailable()) return;
    window.localStorage.setItem(
        getCompanyApprovalNotificationsStorageKey(hotelCode),
        JSON.stringify((Array.isArray(notifications) ? notifications : []).map(normalizeApprovalNotification))
    );
};

export const parseApprovalUserList = (rawValue) => {
    const entries = String(rawValue || '')
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean);

    return Array.from(new Set(entries.map((entry) => entry.toLowerCase())))
        .map((lowerCased) => {
            const original = entries.find((entry) => entry.toLowerCase() === lowerCased) || lowerCased;
            return createApprovalParty({ userId: original, userName: original });
        });
};

export const formatApprovalUserList = (parties = []) => (
    (Array.isArray(parties) ? parties : [])
        .map(normalizeApprovalParty)
        .map((party) => party.user_id)
        .filter(Boolean)
        .join(', ')
);

export const getApprovalActiveLevel = (request) => {
    const pendingApprovers = normalizeApprovalRequest(request).approvers
        .filter((approver) => approver.status === 'PENDING');

    if (pendingApprovers.length === 0) return 0;
    return Math.min(...pendingApprovers.map((approver) => normalizeApprovalLevel(approver.level)));
};

export const getApprovalActiveApprovers = (request) => {
    const normalizedRequest = normalizeApprovalRequest(request);
    const activeLevel = getApprovalActiveLevel(normalizedRequest);

    if (!activeLevel) return [];
    return normalizedRequest.approvers.filter((approver) => (
        approver.status === 'PENDING'
        && approver.level === activeLevel
    ));
};

export const createApprovalRequestDraft = ({
    hotelCode,
    type = 'EVENT_PAYMENT',
    title = '',
    subject = '',
    sourceModule = '',
    sourcePath = '',
    sourceLabel = '',
    sourceRecordId = '',
    sourceRecordTitle = '',
    requester = {},
    summary = {},
    payload = {}
}) => normalizeApprovalRequest({
    hotel_code: hotelCode,
    type,
    title,
    subject,
    status: 'DRAFT',
    source_module: sourceModule,
    source_path: sourcePath,
    source_label: sourceLabel,
    source_record_id: sourceRecordId,
    source_record_title: sourceRecordTitle,
    requested_by: requester,
    summary,
    payload,
    timeline: [
        createTimelineEntry({
            type: 'DRAFT_CREATED',
            userId: requester.user_id,
            userName: requester.user_name,
            note: subject || title || 'Approval draft created.'
        })
    ]
});

export const submitApprovalRequest = ({
    request,
    approvers = [],
    watchers = [],
    requestNote = '',
    archive = null
}) => {
    const normalizedApprovers = (Array.isArray(approvers) ? approvers : []).map((approver) => ({
        ...normalizeApprovalApprover(approver),
        status: 'PENDING',
        level: normalizeApprovalLevel(approver.level),
        acted_at: '',
        decision_note: '',
        routed_by: '',
        routed_at: ''
    }));

    const submittedAt = new Date().toISOString();
    return normalizeApprovalRequest({
        ...request,
        status: 'PENDING',
        approvers: normalizedApprovers,
        watchers: (Array.isArray(watchers) ? watchers : []).map(normalizeApprovalParty),
        request_note: requestNote,
        archive: archive ? normalizeApprovalArchive(archive) : request.archive,
        submitted_at: submittedAt,
        approved_at: '',
        rejected_at: '',
        updated_at: submittedAt,
        timeline: [
            ...cloneTimelineEntries(request.timeline),
            createTimelineEntry({
                type: 'REQUEST_SUBMITTED',
                userId: request.requested_by?.user_id,
                userName: request.requested_by?.user_name,
                note: requestNote || 'Approval request submitted.'
            })
        ]
    });
};

export const setApprovalRequestDecision = ({
    request,
    actor = {},
    decision = 'APPROVED',
    decisionNote = ''
}) => {
    const normalizedActor = normalizeApprovalParty(actor);
    const normalizedDecision = decision === 'REJECTED' ? 'REJECTED' : 'APPROVED';
    const actedAt = new Date().toISOString();
    const nextApprovers = (Array.isArray(request.approvers) ? request.approvers : []).map((approver) => {
        const normalizedApprover = normalizeApprovalApprover(approver);
        if (normalizedApprover.user_id !== normalizedActor.user_id) return normalizedApprover;

        return {
            ...normalizedApprover,
            status: normalizedDecision,
            acted_at: actedAt,
            decision_note: String(decisionNote || '').trim()
        };
    });

    const overallStatus = normalizedDecision === 'REJECTED'
        ? 'REJECTED'
        : (nextApprovers.length > 0 && nextApprovers.every((approver) => approver.status === 'APPROVED')
            ? 'APPROVED'
            : 'PENDING');

    return normalizeApprovalRequest({
        ...request,
        approvers: nextApprovers,
        status: overallStatus,
        approved_at: overallStatus === 'APPROVED' ? actedAt : '',
        rejected_at: overallStatus === 'REJECTED' ? actedAt : '',
        decision_note: String(decisionNote || '').trim(),
        updated_at: actedAt,
        timeline: [
            ...cloneTimelineEntries(request.timeline),
            createTimelineEntry({
                type: normalizedDecision === 'APPROVED' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED',
                userId: normalizedActor.user_id,
                userName: normalizedActor.user_name,
                note: decisionNote || (normalizedDecision === 'APPROVED' ? 'Approval completed.' : 'Approval was rejected.')
            })
        ]
    });
};

export const routeApprovalRequestUpward = ({
    request,
    actor = {},
    nextApprovers = [],
    decisionNote = ''
}) => {
    const normalizedRequest = normalizeApprovalRequest(request);
    const normalizedActor = normalizeApprovalParty(actor);
    const activeLevel = getApprovalActiveLevel(normalizedRequest);
    const actedAt = new Date().toISOString();
    const normalizedNextApprovers = dedupeApprovalParties(nextApprovers);

    if (!normalizedActor.user_id || !activeLevel || normalizedNextApprovers.length === 0) {
        return normalizedRequest;
    }

    const existingApprovers = normalizedRequest.approvers.map(normalizeApprovalApprover);
    const actorApprover = existingApprovers.find((approver) => (
        approver.user_id.toLowerCase() === normalizedActor.user_id.toLowerCase()
        && approver.status === 'PENDING'
        && approver.level === activeLevel
    ));

    if (!actorApprover) return normalizedRequest;

    const existingIds = new Set(existingApprovers.map((approver) => approver.user_id.toLowerCase()));
    const nextLevel = activeLevel + 1;
    const appendedApprovers = normalizedNextApprovers
        .filter((approver) => (
            approver.user_id.toLowerCase() !== normalizedActor.user_id.toLowerCase()
            && !existingIds.has(approver.user_id.toLowerCase())
        ))
        .map((approver) => ({
            ...normalizeApprovalApprover(approver),
            status: 'PENDING',
            level: nextLevel,
            acted_at: '',
            decision_note: '',
            routed_by: normalizedActor.user_id,
            routed_at: actedAt
        }));

    if (appendedApprovers.length === 0) return normalizedRequest;

    const updatedApprovers = existingApprovers.map((approver) => {
        if (
            approver.user_id.toLowerCase() !== normalizedActor.user_id.toLowerCase()
            || approver.status !== 'PENDING'
            || approver.level !== activeLevel
        ) {
            return approver;
        }

        return {
            ...approver,
            status: 'APPROVED',
            acted_at: actedAt,
            decision_note: String(decisionNote || 'Routed to the next approval level.').trim(),
            routed_at: actedAt
        };
    });

    return normalizeApprovalRequest({
        ...normalizedRequest,
        approvers: [...updatedApprovers, ...appendedApprovers],
        status: 'PENDING',
        approved_at: '',
        rejected_at: '',
        decision_note: String(decisionNote || '').trim(),
        updated_at: actedAt,
        timeline: [
            ...cloneTimelineEntries(normalizedRequest.timeline),
            createTimelineEntry({
                type: 'REQUEST_ROUTED',
                userId: normalizedActor.user_id,
                userName: normalizedActor.user_name,
                note: String(decisionNote || `Routed to approval level ${nextLevel}.`).trim(),
                meta: {
                    from_level: activeLevel,
                    to_level: nextLevel,
                    next_approvers: appendedApprovers.map((approver) => approver.user_id)
                }
            })
        ]
    });
};

export const markApprovalRequestApplied = ({
    request,
    actor = {},
    linkedRecordId = ''
}) => {
    const normalizedActor = normalizeApprovalParty(actor);
    const appliedAt = new Date().toISOString();

    return normalizeApprovalRequest({
        ...request,
        source_applied_at: appliedAt,
        source_applied_by: normalizedActor.user_id,
        linked_record_id: toSafeToken(linkedRecordId),
        updated_at: appliedAt,
        timeline: [
            ...cloneTimelineEntries(request.timeline),
            createTimelineEntry({
                type: 'REQUEST_APPLIED',
                userId: normalizedActor.user_id,
                userName: normalizedActor.user_name,
                note: linkedRecordId
                    ? `Source record registered as ${linkedRecordId}.`
                    : 'Approved request was applied to the source record.'
            })
        ]
    });
};

export const createApprovalNotification = ({
    hotelCode,
    userId,
    type,
    requestId,
    title,
    message,
    sourcePath = ''
}) => normalizeApprovalNotification({
    hotel_code: hotelCode,
    user_id: userId,
    type,
    request_id: requestId,
    title,
    message,
    source_path: sourcePath
});

export const markApprovalNotificationsRead = ({
    notifications = [],
    userId = '',
    notificationIds = []
}) => {
    const targetIds = new Set((Array.isArray(notificationIds) ? notificationIds : []).map((id) => String(id)));
    const normalizedUserId = toSafeToken(userId);

    return (Array.isArray(notifications) ? notifications : []).map((notification) => {
        const normalized = normalizeApprovalNotification(notification);
        if (normalized.user_id !== normalizedUserId) return normalized;
        if (!targetIds.has(normalized.id)) return normalized;
        return {
            ...normalized,
            read_at: normalized.read_at || new Date().toISOString()
        };
    });
};

export const getUserApprovalQueue = ({
    requests = [],
    userId = '',
    includeSubmittedByMe = false
}) => {
    const normalizedUserId = toSafeToken(userId).toLowerCase();

    return (Array.isArray(requests) ? requests : [])
        .map(normalizeApprovalRequest)
        .filter((request) => {
            const isApprover = request.approvers.some((approver) => approver.user_id.toLowerCase() === normalizedUserId);
            const isRequester = request.requested_by.user_id.toLowerCase() === normalizedUserId;
            return isApprover || (includeSubmittedByMe && isRequester);
        });
};

export const buildApprovalDecisionNotifications = ({
    request,
    actor,
    decision
}) => {
    const normalizedRequest = normalizeApprovalRequest(request);
    const normalizedActor = normalizeApprovalParty(actor);
    const decisionLabel = decision === 'REJECTED' ? 'rejected' : 'approved';
    const recipients = [
        normalizedRequest.requested_by,
        ...normalizedRequest.watchers
    ].filter((party) => party.user_id && party.user_id !== normalizedActor.user_id);

    return recipients.map((party) => createApprovalNotification({
        hotelCode: normalizedRequest.hotel_code,
        userId: party.user_id,
        type: decision === 'REJECTED' ? 'REQUEST_REJECTED' : 'REQUEST_APPROVED',
        requestId: normalizedRequest.id,
        title: normalizedRequest.title || 'Approval Update',
        message: `${normalizedActor.user_name || normalizedActor.user_id} ${decisionLabel} ${normalizedRequest.subject || 'the approval request'}.`,
        sourcePath: normalizedRequest.source_path
    }));
};

export const buildApprovalSubmissionNotifications = ({ request }) => {
    const normalizedRequest = normalizeApprovalRequest(request);
    const activeLevel = getApprovalActiveLevel(normalizedRequest);
    const approverNotifications = normalizedRequest.approvers
        .filter((approver) => (
            approver.user_id
            && approver.user_id !== normalizedRequest.requested_by.user_id
            && approver.status === 'PENDING'
            && approver.level === activeLevel
        ))
        .map((approver) => createApprovalNotification({
            hotelCode: normalizedRequest.hotel_code,
            userId: approver.user_id,
            type: 'REQUEST_SUBMITTED',
            requestId: normalizedRequest.id,
            title: normalizedRequest.title || 'Approval Request',
            message: `${normalizedRequest.requested_by.user_name || normalizedRequest.requested_by.user_id} sent ${normalizedRequest.subject || 'a payment approval'} for your action.`,
            sourcePath: normalizedRequest.source_path
        }));
    const notifiedApproverIds = new Set(approverNotifications.map((notification) => notification.user_id.toLowerCase()));
    const watcherNotifications = normalizedRequest.watchers
        .filter((watcher) => (
            watcher.user_id
            && watcher.user_id !== normalizedRequest.requested_by.user_id
            && !notifiedApproverIds.has(watcher.user_id.toLowerCase())
        ))
        .map((watcher) => createApprovalNotification({
            hotelCode: normalizedRequest.hotel_code,
            userId: watcher.user_id,
            type: 'REQUEST_SUBMITTED',
            requestId: normalizedRequest.id,
            title: normalizedRequest.title || 'Approval Reference',
            message: `${normalizedRequest.requested_by.user_name || normalizedRequest.requested_by.user_id} added you as Notify / CC for ${normalizedRequest.subject || 'this approval request'}.`,
            sourcePath: normalizedRequest.source_path
        }));

    return [
        ...approverNotifications,
        ...watcherNotifications
    ];
};

export const buildApprovalRoutingNotifications = ({
    request,
    actor,
    nextApprovers = []
}) => {
    const normalizedRequest = normalizeApprovalRequest(request);
    const normalizedActor = normalizeApprovalParty(actor);
    const routedApprovers = dedupeApprovalParties(nextApprovers)
        .filter((party) => party.user_id && party.user_id !== normalizedActor.user_id);
    const watcherUpdates = dedupeApprovalParties([
        normalizedRequest.requested_by,
        ...normalizedRequest.watchers
    ]).filter((party) => (
        party.user_id
        && party.user_id !== normalizedActor.user_id
        && !routedApprovers.some((approver) => approver.user_id.toLowerCase() === party.user_id.toLowerCase())
    ));

    return [
        ...routedApprovers.map((party) => createApprovalNotification({
            hotelCode: normalizedRequest.hotel_code,
            userId: party.user_id,
            type: 'REQUEST_ROUTED',
            requestId: normalizedRequest.id,
            title: normalizedRequest.title || 'Approval Request',
            message: `${normalizedActor.user_name || normalizedActor.user_id} routed ${normalizedRequest.subject || 'the approval request'} to you for next-level approval.`,
            sourcePath: normalizedRequest.source_path
        })),
        ...watcherUpdates.map((party) => createApprovalNotification({
            hotelCode: normalizedRequest.hotel_code,
            userId: party.user_id,
            type: 'REQUEST_ROUTED',
            requestId: normalizedRequest.id,
            title: normalizedRequest.title || 'Approval Update',
            message: `${normalizedActor.user_name || normalizedActor.user_id} escalated ${normalizedRequest.subject || 'the approval request'} to the next approval level.`,
            sourcePath: normalizedRequest.source_path
        }))
    ];
};

export const buildApprovalAppliedNotifications = ({ request, actor }) => {
    const normalizedRequest = normalizeApprovalRequest(request);
    const normalizedActor = normalizeApprovalParty(actor);
    const recipients = [
        normalizedRequest.requested_by,
        ...normalizedRequest.watchers
    ].filter((party) => party.user_id && party.user_id !== normalizedActor.user_id);

    return recipients.map((party) => createApprovalNotification({
        hotelCode: normalizedRequest.hotel_code,
        userId: party.user_id,
        type: 'REQUEST_APPLIED',
        requestId: normalizedRequest.id,
        title: normalizedRequest.title || 'Approved Request Applied',
        message: `${normalizedActor.user_name || normalizedActor.user_id} applied the approved request back to ${normalizedRequest.source_label || normalizedRequest.source_module || 'the source workflow'}.`,
        sourcePath: normalizedRequest.source_path
    }));
};

export const canUserApproveRequest = ({
    request,
    userId = ''
}) => {
    const normalizedRequest = normalizeApprovalRequest(request);
    const normalizedUserId = toSafeToken(userId).toLowerCase();
    const activeLevel = getApprovalActiveLevel(normalizedRequest);

    if (normalizedRequest.status !== 'PENDING' || !activeLevel) return false;

    return normalizedRequest.approvers.some((approver) => (
        approver.user_id.toLowerCase() === normalizedUserId
        && approver.status === 'PENDING'
        && approver.level === activeLevel
    ));
};
