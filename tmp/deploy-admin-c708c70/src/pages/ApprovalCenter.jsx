import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import logo from '../assets/logo.png';
import { formatCurrency } from '../utils/banquetEvents';
import {
    APPROVAL_REQUEST_STATUS_META,
    APPROVAL_REQUEST_TYPE_META,
    buildApprovalDecisionNotifications,
    buildApprovalRoutingNotifications,
    buildApprovalSubmissionNotifications,
    canUserApproveRequest,
    createApprovalParty,
    getApprovalActiveApprovers,
    getApprovalActiveLevel,
    getCompanyApprovalNotificationsStorageKey,
    getCompanyApprovalRequestsStorageKey,
    loadCompanyApprovalNotifications,
    loadCompanyApprovalRequests,
    markApprovalNotificationsRead,
    normalizeApprovalRequest,
    routeApprovalRequestUpward,
    saveCompanyApprovalNotifications,
    saveCompanyApprovalRequests,
    setApprovalRequestDecision,
    submitApprovalRequest
} from '../utils/companyApprovals';

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

const getStatusMeta = (status) => APPROVAL_REQUEST_STATUS_META[status] || APPROVAL_REQUEST_STATUS_META.DRAFT;
const APPROVER_ROLE_KEYWORDS = [
    'manager',
    'director',
    'head',
    'chief',
    'owner',
    'president',
    'vicepresident',
    'vp',
    'executive',
    'officer',
    'controller'
];
const createEmptyEditorState = () => ({
    title: '',
    subject: '',
    requestNote: '',
    approvers: [],
    watchers: [],
    decisionNote: '',
    forwardApprovers: []
});

const buildDirectoryOption = (record = {}) => {
    const userId = String(record.user_id || record.userId || record.emp_id || record.empId || '').trim();
    if (!userId) return null;

    return {
        userId,
        userName: String(record.user_name || record.userName || record.name || userId).trim() || userId,
        role: String(record.role || record.position || record.job_title || '').trim()
    };
};
const normalizeRoleSearchValue = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const isManagerLevelOption = (option = {}) => {
    const searchableValue = normalizeRoleSearchValue(`${option.role || ''} ${option.userId || ''} ${option.userName || ''}`);
    return APPROVER_ROLE_KEYWORDS.some((keyword) => searchableValue.includes(keyword));
};
const mergeUniqueRequests = (...requestGroups) => {
    const seen = new Set();
    const merged = [];

    requestGroups.flat().forEach((request) => {
        const requestId = String(request?.id || '').trim();
        if (!requestId || seen.has(requestId)) return;
        seen.add(requestId);
        merged.push(request);
    });

    return merged;
};

function ApprovalPartyDropdown({
    label,
    options,
    selectedIds,
    onChange,
    disabled,
    placeholder,
    helperText = ''
}) {
    const containerRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownOpen = isOpen && !disabled;

    useEffect(() => {
        if (!dropdownOpen) return undefined;

        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen]);

    const isSelected = (userId) => (
        selectedIds.some((selectedId) => selectedId.toLowerCase() === userId.toLowerCase())
    );
    const toggleSelection = (userId) => {
        if (disabled) return;

        onChange(
            isSelected(userId)
                ? selectedIds.filter((selectedId) => selectedId.toLowerCase() !== userId.toLowerCase())
                : [...selectedIds, userId]
        );
    };
    const selectedOptions = selectedIds.map((selectedId) => (
        options.find((option) => option.userId.toLowerCase() === selectedId.toLowerCase())
        || buildDirectoryOption({ user_id: selectedId, user_name: selectedId })
    )).filter(Boolean);

    return (
        <div ref={containerRef} className="relative">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</label>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen((prev) => !prev)}
                disabled={disabled}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-bold text-slate-700 transition-colors hover:border-slate-400 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500"
            >
                <span className={selectedOptions.length > 0 ? 'text-slate-700' : 'text-slate-400'}>
                    {selectedOptions.length > 0 ? `${selectedOptions.length} selected` : placeholder}
                </span>
                <svg className={`h-4 w-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 011.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
            </button>

            {selectedOptions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                    {selectedOptions.map((option) => (
                        <span key={option.userId} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                            <span>{option.userName}{option.userName !== option.userId ? ` (${option.userId})` : ''}</span>
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => toggleSelection(option.userId)}
                                    className="text-slate-400 transition-colors hover:text-rose-500"
                                    aria-label={`Remove ${option.userId}`}
                                >
                                    ×
                                </button>
                            )}
                        </span>
                    ))}
                </div>
            )}

            {helperText && <div className="mt-2 text-xs font-medium text-slate-500">{helperText}</div>}

            {dropdownOpen && (
                <div className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                    {options.length === 0 && (
                        <div className="px-3 py-4 text-sm font-medium text-slate-400">No selectable users are available yet.</div>
                    )}
                    {options.map((option) => (
                        <label
                            key={option.userId}
                            className={`flex cursor-pointer items-start gap-3 rounded-2xl px-3 py-3 transition-colors ${isSelected(option.userId) ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
                        >
                            <input
                                type="checkbox"
                                checked={isSelected(option.userId)}
                                onChange={() => toggleSelection(option.userId)}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            />
                            <div className="min-w-0">
                                <div className="text-sm font-black text-slate-900">{option.userName}</div>
                                <div className="text-xs font-medium text-slate-500">
                                    {option.userId}
                                    {option.role ? ` · ${option.role}` : ''}
                                </div>
                            </div>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ApprovalCenter() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentUserId = sessionStorage.getItem('userId') || '';
    const currentUserName = sessionStorage.getItem('userName') || currentUserId;
    const currentRole = sessionStorage.getItem('role') || 'GENERAL';
    const currentHotelCode = sessionStorage.getItem('hotelCode') || '';

    const [requests, setRequests] = useState(() => loadCompanyApprovalRequests(currentHotelCode));
    const [notifications, setNotifications] = useState(() => loadCompanyApprovalNotifications(currentHotelCode));
    const [activeScope, setActiveScope] = useState(() => searchParams.get('scope') || 'queue');
    const [editor, setEditor] = useState(createEmptyEditorState);
    const [directoryUsers, setDirectoryUsers] = useState([]);
    const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
    const [directoryLoadError, setDirectoryLoadError] = useState('');

    useEffect(() => {
        if (!currentUserId || !currentHotelCode) {
            navigate('/');
        }
    }, [currentHotelCode, currentUserId, navigate]);

    useEffect(() => {
        setRequests(loadCompanyApprovalRequests(currentHotelCode));
        setNotifications(loadCompanyApprovalNotifications(currentHotelCode));
    }, [currentHotelCode]);

    useEffect(() => {
        const handleStorage = (event) => {
            const requestKey = getCompanyApprovalRequestsStorageKey(currentHotelCode);
            const notificationKey = getCompanyApprovalNotificationsStorageKey(currentHotelCode);

            if (!event.key || event.key === requestKey) {
                setRequests(loadCompanyApprovalRequests(currentHotelCode));
            }
            if (!event.key || event.key === notificationKey) {
                setNotifications(loadCompanyApprovalNotifications(currentHotelCode));
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [currentHotelCode]);

    useEffect(() => {
        let ignore = false;

        const loadDirectoryUsers = async () => {
            if (!currentHotelCode) {
                setDirectoryUsers([]);
                setDirectoryLoadError('');
                return;
            }

            setIsLoadingDirectory(true);
            setDirectoryLoadError('');

            try {
                const response = await fetch(`/api/hr/employees?hotel=${currentHotelCode}`);
                const payload = await response.json().catch(() => []);

                if (ignore) return;
                setDirectoryUsers(Array.isArray(payload) ? payload : []);
            } catch {
                if (ignore) return;
                setDirectoryUsers([]);
                setDirectoryLoadError('Approver directory is temporarily unavailable. Existing request users are still selectable.');
            } finally {
                if (!ignore) {
                    setIsLoadingDirectory(false);
                }
            }
        };

        loadDirectoryUsers();
        return () => {
            ignore = true;
        };
    }, [currentHotelCode]);

    const requestId = searchParams.get('requestId') || '';
    const composeMode = searchParams.get('compose') === '1';
    const returnTo = searchParams.get('returnTo') || '';

    const pendingForMe = useMemo(() => (
        requests.filter((request) => canUserApproveRequest({ request, userId: currentUserId }))
    ), [currentUserId, requests]);

    const requestedByMe = useMemo(() => (
        requests.filter((request) => String(request.requested_by?.user_id || '').toLowerCase() === currentUserId.toLowerCase())
    ), [currentUserId, requests]);

    const referencedForMe = useMemo(() => (
        requests.filter((request) => request.watchers.some((watcher) => (
            String(watcher.user_id || '').toLowerCase() === currentUserId.toLowerCase()
        )))
    ), [currentUserId, requests]);

    const updatesForMe = useMemo(() => (
        notifications.filter((notification) => String(notification.user_id || '').toLowerCase() === currentUserId.toLowerCase())
    ), [currentUserId, notifications]);

    const visibleRequests = useMemo(() => {
        if (activeScope === 'requested') return requestedByMe;
        if (activeScope === 'all') return requests;
        return mergeUniqueRequests(pendingForMe, referencedForMe, requestedByMe);
    }, [activeScope, pendingForMe, referencedForMe, requestedByMe, requests]);

    useEffect(() => {
        if (!requestId && visibleRequests.length > 0) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.set('requestId', visibleRequests[0].id);
            if (!nextParams.get('scope')) nextParams.set('scope', activeScope);
            setSearchParams(nextParams, { replace: true });
        }
    }, [activeScope, requestId, searchParams, setSearchParams, visibleRequests]);

    const selectedRequest = useMemo(() => (
        requests.find((request) => request.id === requestId) || null
    ), [requestId, requests]);

    const selectedStatusMeta = getStatusMeta(selectedRequest?.status);
    const selectedRequestTypeMeta = APPROVAL_REQUEST_TYPE_META[selectedRequest?.type] || APPROVAL_REQUEST_TYPE_META.EVENT_PAYMENT;
    const isRequester = String(selectedRequest?.requested_by?.user_id || '').toLowerCase() === currentUserId.toLowerCase();
    const isWatcher = !!selectedRequest && selectedRequest.watchers.some((watcher) => (
        String(watcher.user_id || '').toLowerCase() === currentUserId.toLowerCase()
    ));
    const canEditRequest = !!selectedRequest && isRequester && ['DRAFT', 'REJECTED'].includes(String(selectedRequest.status || ''));
    const canApprove = !!selectedRequest && canUserApproveRequest({ request: selectedRequest, userId: currentUserId });
    const activeApprovalLevel = useMemo(() => getApprovalActiveLevel(selectedRequest), [selectedRequest]);
    const activeApprovers = useMemo(() => getApprovalActiveApprovers(selectedRequest), [selectedRequest]);
    const pendingApproverIds = activeApprovers.map((approver) => approver.user_id);
    const sourceRecordActionLabel = selectedRequest?.type === 'EVENT_PAYMENT'
        ? 'Open Reservation Details'
        : (isWatcher ? 'Open Reference Record' : 'Open Source Record');

    const routingLevels = useMemo(() => {
        if (!selectedRequest) return [];

        const groupedLevels = new Map();
        selectedRequest.approvers.forEach((approver) => {
            const level = Number(approver.level) || 1;
            if (!groupedLevels.has(level)) {
                groupedLevels.set(level, []);
            }
            groupedLevels.get(level).push(approver);
        });

        return Array.from(groupedLevels.entries())
            .sort(([leftLevel], [rightLevel]) => leftLevel - rightLevel)
            .map(([level, approvers]) => ({ level, approvers }));
    }, [selectedRequest]);

    const summaryCards = useMemo(() => (
        selectedRequest
            ? [
                {
                    key: 'venue_final',
                    label: 'Venue Final',
                    value: selectedRequest.summary?.venue_final,
                    className: 'border-slate-200 bg-slate-50',
                    labelClassName: 'text-slate-500',
                    valueClassName: 'text-slate-900'
                },
                {
                    key: 'catering_total',
                    label: 'Catering',
                    value: selectedRequest.summary?.catering_total,
                    className: 'border-emerald-200 bg-emerald-50',
                    labelClassName: 'text-emerald-700',
                    valueClassName: 'text-emerald-700'
                },
                {
                    key: 'option_total',
                    label: 'Options',
                    value: selectedRequest.summary?.option_total,
                    className: 'border-amber-200 bg-amber-50',
                    labelClassName: 'text-amber-700',
                    valueClassName: 'text-amber-700'
                },
                {
                    key: 'room_net',
                    label: 'Room Net',
                    value: selectedRequest.summary?.room_net,
                    className: 'border-sky-200 bg-sky-50',
                    labelClassName: 'text-sky-700',
                    valueClassName: 'text-sky-700'
                },
                {
                    key: 'balance_due',
                    label: 'Balance Due',
                    value: selectedRequest.summary?.balance_due,
                    className: 'border-violet-200 bg-violet-50',
                    labelClassName: 'text-violet-700',
                    valueClassName: 'text-violet-700'
                },
                {
                    key: 'final_amount',
                    label: 'Final Amount',
                    value: selectedRequest.summary?.final_amount,
                    className: 'border-slate-900 bg-slate-900 text-white',
                    labelClassName: 'text-slate-300',
                    valueClassName: 'text-white'
                }
            ]
            : []
    ), [selectedRequest]);

    const userDirectoryOptions = useMemo(() => {
        const directoryMap = new Map();
        const addOption = (record) => {
            const nextOption = buildDirectoryOption(record);
            if (!nextOption) return;

            const key = nextOption.userId.toLowerCase();
            if (!directoryMap.has(key)) {
                directoryMap.set(key, nextOption);
                return;
            }

            const currentOption = directoryMap.get(key);
            directoryMap.set(key, {
                ...currentOption,
                userName: currentOption.userName || nextOption.userName,
                role: currentOption.role || nextOption.role
            });
        };

        directoryUsers.forEach(addOption);
        addOption({ user_id: currentUserId, user_name: currentUserName, role: currentRole });
        requests.forEach((request) => {
            addOption(request.requested_by);
            request.approvers.forEach(addOption);
            request.watchers.forEach(addOption);
        });

        return Array.from(directoryMap.values()).sort((left, right) => (
            `${left.userName} ${left.userId}`.localeCompare(`${right.userName} ${right.userId}`)
        ));
    }, [currentRole, currentUserId, currentUserName, directoryUsers, requests]);

    const directoryOptionMap = useMemo(() => (
        userDirectoryOptions.reduce((map, option) => {
            map.set(option.userId.toLowerCase(), option);
            return map;
        }, new Map())
    ), [userDirectoryOptions]);

    const approverDirectoryOptions = useMemo(() => (
        userDirectoryOptions.filter(isManagerLevelOption)
    ), [userDirectoryOptions]);

    const forwardApproverOptions = useMemo(() => {
        if (!selectedRequest) return [];

        const existingApproverIds = new Set(
            selectedRequest.approvers.map((approver) => String(approver.user_id || '').toLowerCase())
        );

        return approverDirectoryOptions.filter((option) => (
            option.userId.toLowerCase() !== currentUserId.toLowerCase()
            && !existingApproverIds.has(option.userId.toLowerCase())
        ));
    }, [approverDirectoryOptions, currentUserId, selectedRequest]);

    const resolveSelectedParties = (selectedIds = []) => (
        selectedIds.reduce((parties, selectedId) => {
            const normalizedId = String(selectedId || '').trim();
            if (!normalizedId) return parties;
            if (parties.some((party) => party.user_id.toLowerCase() === normalizedId.toLowerCase())) return parties;

            const option = directoryOptionMap.get(normalizedId.toLowerCase());
            return [
                ...parties,
                createApprovalParty({
                    userId: option?.userId || normalizedId,
                    userName: option?.userName || normalizedId,
                    role: option?.role || ''
                })
            ];
        }, [])
    );

    useEffect(() => {
        if (!selectedRequest) {
            setEditor(createEmptyEditorState());
            return;
        }

        setEditor({
            title: selectedRequest.title || '',
            subject: selectedRequest.subject || '',
            requestNote: selectedRequest.request_note || '',
            approvers: selectedRequest.approvers.map((approver) => approver.user_id).filter(Boolean),
            watchers: selectedRequest.watchers.map((watcher) => watcher.user_id).filter(Boolean),
            decisionNote: '',
            forwardApprovers: []
        });
    }, [selectedRequest?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!selectedRequest) return;

        const relatedUnread = updatesForMe.filter((notification) => (
            notification.request_id === selectedRequest.id && !notification.read_at
        ));
        if (relatedUnread.length === 0) return;

        const nextNotifications = markApprovalNotificationsRead({
            notifications,
            userId: currentUserId,
            notificationIds: relatedUnread.map((notification) => notification.id)
        });
        setNotifications(nextNotifications);
        saveCompanyApprovalNotifications(currentHotelCode, nextNotifications);
    }, [currentHotelCode, currentUserId, notifications, selectedRequest, updatesForMe]);

    const persistRequests = (nextRequests) => {
        setRequests(nextRequests);
        saveCompanyApprovalRequests(currentHotelCode, nextRequests);
    };

    const persistNotifications = (nextNotifications) => {
        setNotifications(nextNotifications);
        saveCompanyApprovalNotifications(currentHotelCode, nextNotifications);
    };

    const openPdfArchive = (request) => {
        if (!request?.archive?.pdf_data_url) {
            alert('No request PDF archive was found.');
            return;
        }

        const pdfWindow = window.open('');
        if (!pdfWindow) {
            alert('Please allow pop-ups to view the approval PDF.');
            return;
        }

        pdfWindow.document.write(`<iframe width="100%" height="100%" style="border:none;" src="${request.archive.pdf_data_url}"></iframe>`);
    };

    const buildRequestArchive = async ({
        request,
        approvers,
        watchers,
        requestNote
    }) => {
        const { jsPDF, autoTable } = await loadPdfTools();
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const now = new Date().toISOString();
        const safeTitle = String(request.subject || request.title || 'approval').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'approval';
        const fileName = `approval_request_${safeTitle}_${now.slice(0, 10)}.pdf`;
        const summary = request.summary || {};

        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 26, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.text('Company Workflow Approval Request', 14, 16);
        doc.setFontSize(10);
        doc.text(`Generated ${new Date(now).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`, pageWidth - 14, 16, { align: 'right' });

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.text('This request was prepared in Event POS and routed through the company workflow.', 14, 36);

        autoTable(doc, {
            startY: 42,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3.2, textColor: [15, 23, 42] },
            columnStyles: {
                0: { fillColor: [241, 245, 249], fontStyle: 'bold', cellWidth: 42 },
                1: { cellWidth: 52 },
                2: { fillColor: [241, 245, 249], fontStyle: 'bold', cellWidth: 42 },
                3: { cellWidth: 52 }
            },
            body: [[
                'Request Title',
                request.title || '-',
                'Subject',
                request.subject || '-'
            ], [
                'Requested By',
                request.requested_by?.user_name || request.requested_by?.user_id || '-',
                'Role',
                request.requested_by?.role || '-'
            ], [
                'Source Module',
                request.source_label || request.source_module || '-',
                'Source Record',
                request.source_record_title || request.source_record_id || '-'
            ], [
                'Approvers',
                approvers.map((approver) => `L${approver.level || 1}: ${approver.user_id}`).join(' | ') || '-',
                'Notify / CC',
                watchers.map((watcher) => watcher.user_id).join(', ') || '-'
            ]]
        });

        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 6,
            theme: 'grid',
            head: [['Financial Snapshot', 'Amount']],
            headStyles: { fillColor: [15, 23, 42] },
            styles: { fontSize: 9, cellPadding: 3.2 },
            body: [
                ['Venue Final', formatCurrency(summary.venue_final)],
                ['Catering', formatCurrency(summary.catering_total)],
                ['Options', formatCurrency(summary.option_total)],
                ['Room Net', formatCurrency(summary.room_net)],
                ['Balance Due', formatCurrency(summary.balance_due)],
                ['Final Amount', formatCurrency(summary.final_amount)]
            ]
        });

        const noteText = requestNote
            ? `Request note: ${requestNote}`
            : 'Request note: -';
        const noteLines = doc.splitTextToSize(noteText, pageWidth - 28);
        doc.setFontSize(10);
        doc.text(noteLines, 14, doc.lastAutoTable.finalY + 10);

        return {
            id: `approval_archive_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            created_at: now,
            file_name: fileName,
            pdf_data_url: doc.output('datauristring'),
            meta: {
                request_type: request.type,
                generated_by: request.requested_by?.user_id || ''
            }
        };
    };

    const handleSaveDraftRequest = () => {
        if (!selectedRequest) return;

        const updatedDraft = normalizeApprovalRequest({
            ...selectedRequest,
            title: editor.title,
            subject: editor.subject,
            request_note: editor.requestNote,
            approvers: resolveSelectedParties(editor.approvers),
            watchers: resolveSelectedParties(editor.watchers),
            updated_at: new Date().toISOString()
        });

        persistRequests(requests.map((request) => (
            request.id === updatedDraft.id ? updatedDraft : request
        )));

        alert('Approval draft updated.');
    };

    const handleSubmitRequest = async () => {
        if (!selectedRequest) return;
        if (!editor.subject.trim()) {
            alert('Request subject is required.');
            return;
        }

        const approvers = resolveSelectedParties(editor.approvers);
        if (approvers.length === 0) {
            alert('Select at least one approver.');
            return;
        }

        const watchers = resolveSelectedParties(editor.watchers).filter((watcher) => (
            !approvers.some((approver) => approver.user_id.toLowerCase() === watcher.user_id.toLowerCase())
        ));

        try {
            const normalizedRequest = normalizeApprovalRequest({
                ...selectedRequest,
                title: editor.title,
                subject: editor.subject,
                request_note: editor.requestNote,
                approvers,
                watchers,
                updated_at: new Date().toISOString()
            });
            const archive = await buildRequestArchive({
                request: normalizedRequest,
                approvers,
                watchers,
                requestNote: editor.requestNote
            });

            const submittedRequest = submitApprovalRequest({
                request: normalizedRequest,
                approvers,
                watchers,
                requestNote: editor.requestNote,
                archive
            });

            const nextRequests = requests.some((request) => request.id === submittedRequest.id)
                ? requests.map((request) => (request.id === submittedRequest.id ? submittedRequest : request))
                : [submittedRequest, ...requests];
            persistRequests(nextRequests);

            const nextNotifications = [
                ...buildApprovalSubmissionNotifications({ request: submittedRequest }),
                ...notifications
            ];
            persistNotifications(nextNotifications);

            alert('Approval request submitted successfully.');
            navigate(returnTo || selectedRequest.source_path || '/approvals');
        } catch (error) {
            alert(error.message || 'Unable to submit the approval request.');
        }
    };

    const handleApproveRequest = (decision) => {
        if (!selectedRequest) return;

        const actor = createApprovalParty({
            userId: currentUserId,
            userName: currentUserName,
            role: currentRole
        });
        const updatedRequest = setApprovalRequestDecision({
            request: selectedRequest,
            actor,
            decision,
            decisionNote: editor.decisionNote
        });

        const nextRequests = requests.map((request) => (
            request.id === updatedRequest.id ? updatedRequest : request
        ));
        persistRequests(nextRequests);

        const nextNotifications = [
            ...buildApprovalDecisionNotifications({
                request: updatedRequest,
                actor,
                decision
            }),
            ...notifications
        ];
        persistNotifications(nextNotifications);
        setEditor((prev) => ({ ...prev, decisionNote: '', forwardApprovers: [] }));
        alert(decision === 'REJECTED' ? 'Request rejected.' : 'Approval recorded.');
    };

    const handleRouteRequestUpward = () => {
        if (!selectedRequest) return;

        const nextApprovers = resolveSelectedParties(editor.forwardApprovers);
        if (nextApprovers.length === 0) {
            alert('Select at least one next-level approver.');
            return;
        }

        const actor = createApprovalParty({
            userId: currentUserId,
            userName: currentUserName,
            role: currentRole
        });
        const updatedRequest = routeApprovalRequestUpward({
            request: selectedRequest,
            actor,
            nextApprovers,
            decisionNote: editor.decisionNote
        });

        if (updatedRequest.approvers.length === selectedRequest.approvers.length) {
            alert('Selected next-level approvers are already included in this route.');
            return;
        }

        const nextRequests = requests.map((request) => (
            request.id === updatedRequest.id ? updatedRequest : request
        ));
        persistRequests(nextRequests);

        const nextNotifications = [
            ...buildApprovalRoutingNotifications({
                request: updatedRequest,
                actor,
                nextApprovers
            }),
            ...notifications
        ];
        persistNotifications(nextNotifications);
        setEditor((prev) => ({ ...prev, decisionNote: '', forwardApprovers: [] }));
        alert('Approval routed to the next level.');
    };

    const approverDropdownHelperText = directoryLoadError
        || (isLoadingDirectory ? 'Loading selectable approvers...' : 'Only manager-level users or higher appear in this list.');
    const ccDropdownHelperText = directoryLoadError
        || (isLoadingDirectory ? 'Loading selectable users...' : 'Select one or more users from the employee directory.');

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
                <div className="flex flex-col gap-6 rounded-[32px] border border-slate-200 bg-white px-6 py-6 shadow-sm md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                        <img src={logo} alt="Hotel Logo" className="h-12 w-auto object-contain" />
                        <div className="min-w-0">
                            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Approval Center</div>
                            <h1 className="mt-2 text-2xl font-black text-slate-900">Company Workflow</h1>
                            <p className="mt-1 text-sm font-medium text-slate-500">Draft requests in Event POS, route them across approval levels, and return approved items to the source module.</p>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-3 self-end sm:flex-nowrap md:self-start">
                        <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700">🏢 {currentHotelCode || '-'}</div>
                        <div className="rounded-2xl bg-sky-100 px-4 py-3 text-sm font-black text-sky-700">👤 {currentUserName}</div>
                        <Link to="/" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-100">
                            Home
                        </Link>
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <button type="button" onClick={() => { setActiveScope('queue'); setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('scope', 'queue'); return next; }); }} className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-5 text-left">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">Needs My Approval</div>
                        <div className="mt-2 text-3xl font-black text-amber-700">{pendingForMe.length}</div>
                    </button>
                    <button type="button" onClick={() => { setActiveScope('requested'); setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('scope', 'requested'); return next; }); }} className="rounded-3xl border border-sky-200 bg-sky-50 px-5 py-5 text-left">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-700">Submitted By Me</div>
                        <div className="mt-2 text-3xl font-black text-sky-700">{requestedByMe.length}</div>
                    </button>
                    <button type="button" onClick={() => { setActiveScope('all'); setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('scope', 'all'); return next; }); }} className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-5 text-left">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">Recent Updates</div>
                        <div className="mt-2 text-3xl font-black text-emerald-700">{updatesForMe.length}</div>
                    </button>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Request Queue</div>
                                <div className="mt-2 text-lg font-black text-slate-900">
                                    {activeScope === 'requested' ? 'My Requests' : activeScope === 'all' ? 'All Visible Requests' : 'Assigned / Notify Me'}
                                </div>
                            </div>
                            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{visibleRequests.length}</div>
                        </div>

                        <div className="mt-4 space-y-3">
                            {visibleRequests.map((request) => {
                                const statusMeta = getStatusMeta(request.status);
                                const requestTypeMeta = APPROVAL_REQUEST_TYPE_META[request.type] || APPROVAL_REQUEST_TYPE_META.EVENT_PAYMENT;

                                return (
                                    <button
                                        key={request.id}
                                        type="button"
                                        onClick={() => {
                                            const next = new URLSearchParams(searchParams);
                                            next.set('requestId', request.id);
                                            next.set('scope', activeScope);
                                            if (!composeMode) next.delete('compose');
                                            setSearchParams(next);
                                        }}
                                        className={`w-full rounded-3xl border px-4 py-4 text-left transition-colors ${selectedRequest?.id === request.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className={`truncate text-sm font-black ${selectedRequest?.id === request.id ? 'text-white' : 'text-slate-900'}`}>
                                                    {request.subject || request.title || 'Approval Request'}
                                                </div>
                                                <div className={`mt-1 truncate text-xs font-bold ${selectedRequest?.id === request.id ? 'text-slate-300' : 'text-slate-500'}`}>
                                                    {request.requested_by.user_name || request.requested_by.user_id} · {requestTypeMeta.label}
                                                </div>
                                            </div>
                                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${selectedRequest?.id === request.id ? 'border-white/20 bg-white/10 text-white' : statusMeta.className}`}>
                                                {statusMeta.label}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                            {visibleRequests.length === 0 && (
                                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
                                    No requests match this scope yet.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
                        {!selectedRequest && (
                            <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm font-bold text-slate-400">
                                Select an approval request to review or continue drafting.
                            </div>
                        )}

                        {selectedRequest && (
                            <>
                                <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{selectedRequestTypeMeta.moduleLabel}</div>
                                        <h2 className="mt-2 text-2xl font-black text-slate-900">{selectedRequest.subject || selectedRequest.title || 'Approval Request'}</h2>
                                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                                            <span className={`rounded-full border px-3 py-1 ${selectedStatusMeta.className}`}>{selectedStatusMeta.label}</span>
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Requester: {selectedRequest.requested_by.user_name || selectedRequest.requested_by.user_id}</span>
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                                                Pending Level {activeApprovalLevel || '-'}: {pendingApproverIds.join(', ') || 'None'}
                                            </span>
                                            {isWatcher && (
                                                <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">Notify / CC</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        {selectedRequest.archive?.pdf_data_url && (
                                            <button type="button" onClick={() => openPdfArchive(selectedRequest)} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-100">
                                                View Request PDF
                                            </button>
                                        )}
                                        {selectedRequest.source_path && (
                                            <button type="button" onClick={() => navigate(selectedRequest.source_path)} className="rounded-2xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700 transition-colors hover:bg-sky-100">
                                                {sourceRecordActionLabel}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                                    <div>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            {summaryCards.map((card) => (
                                                <div key={card.key} className={`rounded-2xl border px-4 py-4 ${card.className}`}>
                                                    <div className={`text-[10px] font-black uppercase tracking-[0.22em] ${card.labelClassName}`}>{card.label}</div>
                                                    <div className={`mt-2 text-2xl font-black ${card.valueClassName}`}>{formatCurrency(card.value)}</div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                                            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Approval Request Form</div>
                                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <div>
                                                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Request Title</label>
                                                    <input value={editor.title} onChange={(e) => setEditor((prev) => ({ ...prev, title: e.target.value }))} disabled={!canEditRequest} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-500" placeholder="Banquet payment approval" />
                                                </div>
                                                <div>
                                                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Subject</label>
                                                    <input value={editor.subject} onChange={(e) => setEditor((prev) => ({ ...prev, subject: e.target.value }))} disabled={!canEditRequest} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-500" placeholder="Wedding package approval for Rivera event" />
                                                </div>
                                                <ApprovalPartyDropdown
                                                    label="Approver IDs"
                                                    options={approverDirectoryOptions}
                                                    selectedIds={editor.approvers}
                                                    onChange={(approvers) => setEditor((prev) => ({ ...prev, approvers }))}
                                                    disabled={!canEditRequest}
                                                    placeholder="Select approvers"
                                                    helperText={approverDropdownHelperText}
                                                />
                                                <ApprovalPartyDropdown
                                                    label="Notify / CC IDs"
                                                    options={userDirectoryOptions}
                                                    selectedIds={editor.watchers}
                                                    onChange={(watchers) => setEditor((prev) => ({ ...prev, watchers }))}
                                                    disabled={!canEditRequest}
                                                    placeholder="Select notify / CC users"
                                                    helperText={ccDropdownHelperText}
                                                />
                                            </div>
                                            <div className="mt-4">
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Request Note</label>
                                                <textarea value={editor.requestNote} onChange={(e) => setEditor((prev) => ({ ...prev, requestNote: e.target.value }))} disabled={!canEditRequest} rows="5" className="w-full resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 disabled:bg-slate-100 disabled:text-slate-500" placeholder="Explain discount approvals, complimentary items, option requests, risk notes, or why management sign-off is required." />
                                            </div>

                                            {canEditRequest && (
                                                <div className="mt-5 flex flex-wrap gap-3">
                                                    <button type="button" onClick={handleSaveDraftRequest} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-100">
                                                        Save Draft
                                                    </button>
                                                    <button type="button" onClick={handleSubmitRequest} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-slate-800">
                                                        {selectedRequest.status === 'REJECTED' ? 'Resubmit Approval Request' : 'Send Approval Request'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {canApprove && (
                                            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
                                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">Approver Decision</div>
                                                <div className="mt-2 text-sm font-medium text-amber-800">
                                                    You are acting on level {activeApprovalLevel}. Approve directly, reject, or route the request up to the next approval level.
                                                </div>
                                                <textarea value={editor.decisionNote} onChange={(e) => setEditor((prev) => ({ ...prev, decisionNote: e.target.value }))} rows="4" className="mt-4 w-full resize-y rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-medium text-slate-700" placeholder="State your approval note, controls, escalation reason, or rejection detail." />

                                                <div className="mt-5 rounded-3xl border border-sky-200 bg-white p-4">
                                                    <ApprovalPartyDropdown
                                                        label="Next-Level Approvers"
                                                        options={forwardApproverOptions}
                                                        selectedIds={editor.forwardApprovers}
                                                        onChange={(forwardApprovers) => setEditor((prev) => ({ ...prev, forwardApprovers }))}
                                                        disabled={forwardApproverOptions.length === 0}
                                                        placeholder="Select upper approvers"
                                                        helperText={forwardApproverOptions.length > 0
                                                            ? 'Use this when the current approver needs to send the request to higher management.'
                                                            : 'No additional approvers are available for the next level.'}
                                                    />
                                                </div>

                                                <div className="mt-4 flex flex-wrap gap-3">
                                                    <button type="button" onClick={() => handleApproveRequest('REJECTED')} className="rounded-2xl border border-rose-300 bg-white px-4 py-3 text-sm font-black text-rose-700 transition-colors hover:bg-rose-50">
                                                        Reject
                                                    </button>
                                                    <button type="button" onClick={() => handleApproveRequest('APPROVED')} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700">
                                                        Approve Request
                                                    </button>
                                                    <button type="button" onClick={handleRouteRequestUpward} disabled={editor.forwardApprovers.length === 0} className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300">
                                                        Approve & Route Up
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-5">
                                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Routing</div>
                                                {activeApprovalLevel > 0 && (
                                                    <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black text-sky-700">Current Level {activeApprovalLevel}</span>
                                                )}
                                            </div>
                                            <div className="mt-4 space-y-4 text-sm">
                                                <div>
                                                    <div className="font-black text-slate-900">Approval Levels</div>
                                                    <div className="mt-2 space-y-3">
                                                        {routingLevels.map((levelGroup) => (
                                                            <div key={levelGroup.level} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Level {levelGroup.level}</div>
                                                                <div className="mt-2 flex flex-wrap gap-2">
                                                                    {levelGroup.approvers.map((approver) => {
                                                                        const statusMeta = getStatusMeta(approver.status);
                                                                        return (
                                                                            <span key={`${levelGroup.level}-${approver.user_id}`} className={`rounded-full border px-3 py-1 text-[11px] font-black ${statusMeta.className}`}>
                                                                                {approver.user_id}
                                                                                {approver.role ? ` · ${approver.role}` : ''}
                                                                                {` · ${approver.status}`}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900">Notify / CC</div>
                                                    <div className="mt-1 text-slate-500">{selectedRequest.watchers.map((watcher) => watcher.user_id).join(', ') || '-'}</div>
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900">Return Path</div>
                                                    <div className="mt-1 break-all text-slate-500">{selectedRequest.source_path || returnTo || '-'}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Timeline</div>
                                            <div className="mt-4 space-y-3">
                                                {(selectedRequest.timeline || []).slice().reverse().map((entry) => (
                                                    <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                        <div className="text-xs font-black text-slate-900">{entry.type.replace(/_/g, ' ')}</div>
                                                        <div className="mt-1 text-xs font-medium text-slate-500">{entry.user_name || entry.user_id || 'System'} · {new Date(entry.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}</div>
                                                        {entry.note && <div className="mt-2 text-sm font-medium text-slate-600">{entry.note}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
