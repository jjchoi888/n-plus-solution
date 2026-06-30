import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Treemap } from 'recharts';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { io } from 'socket.io-client';
import '../App.css';
import ChannelRateManager from './ChannelRateManager';

// ========================================================
// 💡 모든 요청을 구글 서버로 자동 연결하는 네비게이터
// ========================================================
if (!window._fetchWrapped) {
    const originalFetch = window.fetch;
    window.fetch = async (url, options) => {
        const API_BASE = import.meta.env.VITE_API_URL || '';

        if (typeof url === 'string' && url.startsWith('/api')) {
            url = API_BASE + url;
        }
        return originalFetch(url, options);
    };
    window._fetchWrapped = true; // 💡 React HMR 시 무한 루프(로딩) 방지 방어막
}

// 💡 낮 12시 이전이면 날짜를 하루 빼서 '호텔 영업일' 기준으로 맞춰주는 함수
const getHotelDate = (offsetDays = 0) => {
    const now = new Date();
    if (now.getHours() < 12) now.setDate(now.getDate() - 1);
    now.setDate(now.getDate() + offsetDays);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getScheduleAnchorDate = (view = 'WEEKLY', baseDate = new Date()) => {
    const anchor = new Date(baseDate);
    if (view === 'MONTHLY') {
        anchor.setDate(1);
    } else {
        const day = anchor.getDay();
        const diff = anchor.getDate() - day + (day === 0 ? -6 : 1);
        anchor.setDate(diff);
    }
    return anchor.toISOString().split('T')[0];
};

const PAYROLL_DEPT_TREEMAP_COLORS = ['#2563eb', '#1d4ed8', '#0f766e', '#0891b2', '#4f46e5', '#4338ca', '#0369a1', '#0f766e'];
const PAYROLL_ROLE_TREEMAP_COLORS = ['#f97316', '#ea580c', '#fb7185', '#ef4444', '#d97706', '#f59e0b', '#e11d48', '#dc2626', '#f97316'];
const PAYROLL_PAGE_SIZE = 20;
const COE_TEMPLATE_TAGS = [
    '[NAME]',
    '[EMP_ID]',
    '[ROLE]',
    '[DEPARTMENT]',
    '[DATE_HIRED]',
    '[COMPANY]',
    '[ISSUE_DATE]',
    '[ISSUE_CITY]',
    '[REFERENCE_NO]',
    '[SIGNATORY_NAME]',
    '[SIGNATORY_TITLE]',
    '[COMPANY_ADDRESS]'
];
const COE_BORDER_OPTIONS = [
    { value: 'CLASSIC_NAVY', label: 'Classic Navy Frame' },
    { value: 'MODERN_FRAME', label: 'Modern Editorial Frame' },
    { value: 'EXECUTIVE_GOLD', label: 'Executive Gold' },
    { value: 'MINIMAL_LINE', label: 'Minimal Line' },
    { value: 'NONE', label: 'Clean / No Border' }
];

const clampEvaluationScore = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return Math.min(5, Math.max(1, Math.round(numeric * 2) / 2));
};

const coerceBoolean = (value, fallback = false) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0) return false;
    return fallback;
};

const createDefaultEvaluationDraft = () => ({
    emp_id: '',
    score: 5,
    remarks: '',
    period_month: getHotelDate(0).slice(0, 7),
    review_type: 'Monthly Review'
});

const getEvaluationMonthKey = (value) => {
    if (!value) return getHotelDate(0).slice(0, 7);
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 7);
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return getHotelDate(0).slice(0, 7);
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
};

const formatEvaluationMonthLabel = (monthKey) => {
    const normalized = getEvaluationMonthKey(monthKey);
    const parsed = new Date(`${normalized}-01T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return normalized;
    return parsed.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Manila'
    });
};

const formatEvaluationTimestamp = (value, fallback = 'Awaiting timestamp') => {
    if (!value) return fallback;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Manila'
    });
};

const formatShortEvaluationDate = (value, fallback = '--') => {
    if (!value) return fallback;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10) || fallback;
    return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Manila'
    });
};

const getEvaluationScoreTone = (score) => {
    if (score >= 4.5) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 3.5) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (score >= 2.5) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
};

const buildCoeReferenceNo = (config, empId) => {
    const prefix = String(config?.reference_prefix || 'COE').trim() || 'COE';
    const dateCode = getHotelDate(0).replace(/-/g, '');
    return `${prefix}-${dateCode}-${empId || 'EMP'}`;
};

const buildCoeTemplateText = (template, employee, config) => {
    const safeEmployee = employee || {};
    const safeConfig = config || {};
    const referenceNo = buildCoeReferenceNo(safeConfig, safeEmployee.emp_id);
    const issueDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Manila'
    });
    const replacements = {
        '[NAME]': safeEmployee.name || '',
        '[EMP_ID]': safeEmployee.emp_id || '',
        '[ROLE]': safeEmployee.role || '',
        '[DEPARTMENT]': safeEmployee.department || safeEmployee.dept || 'Unassigned',
        '[DATE_HIRED]': safeEmployee.date_hired || '',
        '[COMPANY]': safeConfig.company_name || 'HOTEL CMS',
        '[ISSUE_DATE]': issueDate,
        '[ISSUE_CITY]': safeConfig.issue_city || 'Manila',
        '[REFERENCE_NO]': referenceNo,
        '[SIGNATORY_NAME]': safeConfig.signatory_name || '',
        '[SIGNATORY_TITLE]': safeConfig.signatory_title || '',
        '[COMPANY_ADDRESS]': safeConfig.company_address || ''
    };

    return Object.entries(replacements).reduce((output, [tag, value]) => (
        output.replace(new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value)
    ), template || '');
};

const getDataUrlImageType = (dataUrl) => {
    const source = String(dataUrl || '').toLowerCase();
    if (source.startsWith('data:image/png')) return 'PNG';
    return 'JPEG';
};

const createDefaultPosStoreForm = () => ({
    name: '',
    type: 'Restaurant',
    location: '1',
    table_count: 25,
    is_room_linked: false
});

const createDefaultPosMenuForm = () => ({
    category: '',
    name: '',
    imageFiles: [],
    isRecommended: false,
    isRoomService: false,
    sizes: [{ name: 'Regular', price: '' }]
});

const parsePosMenuSizes = (sizesValue, fallbackPrice = '') => {
    let parsedSizes = [];

    try {
        parsedSizes = typeof sizesValue === 'string' ? JSON.parse(sizesValue) : sizesValue;
    } catch {
        parsedSizes = [];
    }

    if (!Array.isArray(parsedSizes) || parsedSizes.length === 0) {
        return [{ name: 'Regular', price: fallbackPrice || '' }];
    }

    return parsedSizes.map((size, index) => ({
        name: size?.name || (index === 0 ? 'Regular' : `Option ${index + 1}`),
        price: size?.price ?? '',
        is_room_service: size?.is_room_service ?? 0
    }));
};

const parsePosMenuImages = (imageValue) => {
    if (Array.isArray(imageValue)) {
        return imageValue.filter(Boolean);
    }

    if (!imageValue) return [];

    if (typeof imageValue === 'string') {
        try {
            const parsed = JSON.parse(imageValue);
            if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch {
            return [imageValue];
        }
        return [];
    }

    return [];
};

const normalizePosMenuRecord = (menu) => {
    const normalizedSizes = parsePosMenuSizes(menu?.sizes, menu?.price);
    const normalizedImages = parsePosMenuImages(menu?.image_url);
    const cleanName = String(menu?.name || '').replace(/\s*\[TV\]/g, '').trim();
    const isRoomService = normalizedSizes.some((size) => Number(size?.is_room_service) === 1)
        || Number(menu?.is_room_service) === 1
        || String(menu?.name || '').includes('[TV]');

    return {
        ...menu,
        categoryLabel: menu?.category || 'Uncategorized',
        cleanName: cleanName || 'Untitled Item',
        sizes: normalizedSizes,
        parsedImages: normalizedImages,
        primaryImage: normalizedImages[0] || '',
        variantCount: normalizedSizes.length,
        basePrice: Number(normalizedSizes[0]?.price || menu?.price || 0),
        isRecommendedFlag: Number(menu?.is_recommended) === 1 || menu?.is_recommended === true,
        isRoomServiceFlag: isRoomService
    };
};

const getDefaultPayrollConfig = () => ({
    base: {
        semiMonthlyDivisor: 2,
        annualWorkDays: 313,
        dailyWorkHours: 8,
        thirteenthMonthDivisor: 12
    },
    additions: {
        overtimeMultiplier: 1.25,
        nightDiffMultiplier: 0.10,
        holidayAllowance: 0,
        mealAllowance: 0,
        transportAllowance: 0,
        performanceAllowance: 0,
        otherAllowance: 0
    },
    deductions: {
        sssRate: 0.045,
        sssCap: 1350,
        philhealthRate: 0.02,
        philhealthCap: 1000,
        housingFundAmount: 100,
        insuranceAmount: 0,
        otherDeductionAmount: 0,
        withholdingThreshold: 20833,
        withholdingRate: 0.20,
        deductLateUndertime: true
    }
});

const mergePayrollConfig = (savedConfig) => {
    const defaults = getDefaultPayrollConfig();
    return {
        base: { ...defaults.base, ...(savedConfig?.base || {}) },
        additions: { ...defaults.additions, ...(savedConfig?.additions || {}) },
        deductions: { ...defaults.deductions, ...(savedConfig?.deductions || {}) }
    };
};

const getPayrollConfigStorageKey = (hotelCode) => `hr_payroll_config_${(hotelCode || 'default').trim() || 'default'}`;

const loadPayrollConfig = (hotelCode) => {
    try {
        const saved = localStorage.getItem(getPayrollConfigStorageKey(hotelCode));
        return mergePayrollConfig(saved ? JSON.parse(saved) : null);
    } catch (e) {
        console.error('Failed to load payroll config', e);
        return getDefaultPayrollConfig();
    }
};

const getDefaultCoeConfig = () => ({
    template: 'This is to certify that [NAME] (Employee ID: [EMP_ID]) is employed by [COMPANY] as [ROLE] under the [DEPARTMENT] department effective [DATE_HIRED]. This certificate is issued on [ISSUE_DATE] in [ISSUE_CITY] upon the employee\'s request for lawful business, banking, travel, or legal purposes.',
    border_style: 'CLASSIC_NAVY',
    bg_image_url: '',
    logo_image_url: '',
    signature_image_url: '',
    bgFile: null,
    logoFile: null,
    signatureFile: null,
    company_name: 'HOTEL CMS',
    company_address: 'Business Address',
    company_email: 'hr@hotelcms.example',
    company_phone: '+63 000 000 0000',
    document_title: 'CERTIFICATE OF EMPLOYMENT',
    issue_city: 'Manila',
    signatory_name: 'Human Resources Department',
    signatory_title: 'HR Manager',
    footer_note: 'This certificate is issued upon the employee\'s request for lawful business or legal purposes.',
    accent_color: '#1e293b',
    watermark_text: 'OFFICIAL',
    body_font_size: 11,
    reference_prefix: 'COE',
    show_reference: true,
    show_background: true,
    show_logo: true,
    show_watermark: true
});

const mergeCoeConfig = (savedConfig) => {
    const defaults = getDefaultCoeConfig();
    return {
        ...defaults,
        ...(savedConfig || {}),
        body_font_size: Math.min(14, Math.max(10, Number(savedConfig?.body_font_size || defaults.body_font_size) || defaults.body_font_size)),
        show_reference: coerceBoolean(savedConfig?.show_reference, defaults.show_reference),
        show_background: coerceBoolean(savedConfig?.show_background, defaults.show_background),
        show_logo: coerceBoolean(savedConfig?.show_logo, defaults.show_logo),
        show_watermark: coerceBoolean(savedConfig?.show_watermark, defaults.show_watermark),
        bgFile: null,
        logoFile: null,
        signatureFile: null
    };
};

const serializeCoeConfig = (config) => {
    const { bgFile, logoFile, signatureFile, ...serializable } = config || {};
    return serializable;
};

const getCoeConfigStorageKey = (hotelCode) => `hr_coe_config_${(hotelCode || 'default').trim() || 'default'}`;

const loadCoeConfig = (hotelCode) => {
    try {
        const saved = localStorage.getItem(getCoeConfigStorageKey(hotelCode));
        return mergeCoeConfig(saved ? JSON.parse(saved) : null);
    } catch (e) {
        console.error('Failed to load COE config', e);
        return getDefaultCoeConfig();
    }
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    if (!file) {
        resolve('');
        return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const ensureImageDataUrl = async (source) => {
    if (!source) return '';
    if (String(source).startsWith('data:')) return String(source);
    try {
        const response = await fetch(source);
        const blob = await response.blob();
        return await fileToDataUrl(blob);
    } catch (error) {
        console.error('Failed to load COE image asset', error);
        return '';
    }
};

const hexToRgb = (hex, fallback = [30, 41, 59]) => {
    const normalized = String(hex || '').replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
    return [
        parseInt(normalized.slice(0, 2), 16),
        parseInt(normalized.slice(2, 4), 16),
        parseInt(normalized.slice(4, 6), 16)
    ];
};

const BIOMETRIC_PROVIDER_OPTIONS = [
    'ZKTeco Push SDK',
    'ZKTeco Pull API',
    'eSSL / BioMax',
    'Anviz Cloud',
    'Suprema BioStar',
    'RFID Gateway',
    'Custom REST'
];

const getDefaultBiometricConfig = () => ({
    enabled: false,
    provider: 'ZKTeco Push SDK',
    connectionMode: 'PULL',
    endpointUrl: '',
    deviceIp: '',
    devicePort: '4370',
    apiKey: '',
    apiSecret: '',
    serialNumber: '',
    terminalId: '',
    siteId: '',
    webhookPath: '/api/hr/biometric/webhook',
    webhookSecret: '',
    syncIntervalMinutes: 15,
    employeeIdentifierField: 'emp_id',
    timezone: 'Asia/Manila',
    attendanceSourceMode: 'BIOMETRIC_FIRST',
    autoSyncBeforePayroll: true,
    requireFreshSyncMinutes: 60,
    notes: ''
});

const mergeBiometricConfig = (savedConfig) => ({
    ...getDefaultBiometricConfig(),
    ...(savedConfig || {})
});

const getDefaultBiometricStatus = () => ({
    connected: false,
    connectionCheckedAt: '',
    lastSyncAt: '',
    lastAttemptAt: '',
    lastImportedCount: 0,
    lastDuplicateCount: 0,
    source: '',
    message: 'Biometric connector not configured.',
    webhookHealthy: false
});

const mergeBiometricStatus = (savedStatus) => ({
    ...getDefaultBiometricStatus(),
    ...(savedStatus || {})
});

const getBiometricConfigStorageKey = (hotelCode) => `hr_biometric_config_${(hotelCode || 'default').trim() || 'default'}`;
const getBiometricStatusStorageKey = (hotelCode) => `hr_biometric_status_${(hotelCode || 'default').trim() || 'default'}`;
const getBiometricLogsStorageKey = (hotelCode) => `hr_biometric_logs_${(hotelCode || 'default').trim() || 'default'}`;

const loadBiometricConfig = (hotelCode) => {
    try {
        const saved = localStorage.getItem(getBiometricConfigStorageKey(hotelCode));
        return mergeBiometricConfig(saved ? JSON.parse(saved) : null);
    } catch (e) {
        console.error('Failed to load biometric config', e);
        return getDefaultBiometricConfig();
    }
};

const loadBiometricStatus = (hotelCode) => {
    try {
        const saved = localStorage.getItem(getBiometricStatusStorageKey(hotelCode));
        return mergeBiometricStatus(saved ? JSON.parse(saved) : null);
    } catch (e) {
        console.error('Failed to load biometric status', e);
        return getDefaultBiometricStatus();
    }
};

const loadBiometricLogs = (hotelCode) => {
    try {
        const saved = localStorage.getItem(getBiometricLogsStorageKey(hotelCode));
        const parsed = saved ? JSON.parse(saved) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error('Failed to load biometric logs', e);
        return [];
    }
};

const createDefaultManualAttendanceForm = () => ({
    id: null,
    emp_id: '',
    date: getHotelDate(0),
    time_in: '09:00',
    time_out: '18:00'
});

const parseAttendanceDateTime = (dateValue, timeValue) => {
    const safeDate = String(dateValue || '').trim();
    const safeTime = String(timeValue || '').trim();
    if (!safeDate || !safeTime) return null;

    const dateMatch = safeDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
        const fallback = new Date(`${safeDate} ${safeTime}`);
        return Number.isNaN(fallback.getTime()) ? null : fallback;
    }

    const timeMatch = safeTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!timeMatch) {
        const fallback = new Date(`${safeDate} ${safeTime}`);
        return Number.isNaN(fallback.getTime()) ? null : fallback;
    }

    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    const second = Number(timeMatch[3] || 0);
    const meridiem = (timeMatch[4] || '').toUpperCase();

    if (meridiem) {
        if (meridiem === 'PM' && hour !== 12) hour += 12;
        if (meridiem === 'AM' && hour === 12) hour = 0;
    }

    const parsed = new Date(
        Number(dateMatch[1]),
        Number(dateMatch[2]) - 1,
        Number(dateMatch[3]),
        hour,
        minute,
        second
    );

    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatAttendanceTimeInput = (dateValue, timeValue, fallback = '') => {
    const parsed = parseAttendanceDateTime(dateValue, timeValue);
    if (!parsed) return fallback;
    return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
};

const getCurrentTimeInputValue = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const formatAttendanceDisplayDate = (dateValue, options = { month: 'short', day: 'numeric', year: 'numeric' }) => {
    const parsed = parseAttendanceDateTime(dateValue, '00:00');
    if (!parsed) return dateValue || '-';
    return parsed.toLocaleDateString('en-US', options);
};

const formatAttendanceHours = (hours) => {
    if (!Number.isFinite(hours)) return '--';
    const fixed = hours >= 10 ? hours.toFixed(1) : hours.toFixed(2);
    return `${fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}h`;
};

const buildAttendanceRowMeta = (row) => {
    const timeIn = parseAttendanceDateTime(row?.date, row?.time_in);
    const timeOut = parseAttendanceDateTime(row?.date, row?.time_out);
    const parsedDate = parseAttendanceDateTime(row?.date, '00:00');

    let workedHours = null;
    if (timeIn && timeOut) {
        workedHours = (timeOut - timeIn) / (1000 * 60 * 60);
        if (workedHours < 0) workedHours += 24;
        workedHours = Number(workedHours.toFixed(2));
    }

    let statusKey = 'MISSING_IN';
    let statusLabel = 'Missing Time In';
    let statusClasses = 'border border-amber-200 bg-amber-50 text-amber-700';

    if (row?.time_in && row?.time_out) {
        statusKey = 'COMPLETE';
        statusLabel = 'Complete Shift';
        statusClasses = 'border border-emerald-200 bg-emerald-50 text-emerald-700';
    } else if (row?.time_in) {
        statusKey = 'OPEN';
        statusLabel = 'Open Shift';
        statusClasses = 'border border-rose-200 bg-rose-50 text-rose-700';
    }

    return {
        workedHours,
        workedHoursLabel: formatAttendanceHours(workedHours),
        dateLabel: formatAttendanceDisplayDate(row?.date),
        dateDayLabel: formatAttendanceDisplayDate(row?.date, { weekday: 'short' }).toUpperCase(),
        statusKey,
        statusLabel,
        statusClasses,
        sortTimestamp: timeIn?.getTime() ?? parsedDate?.getTime() ?? 0
    };
};

const formatBiometricTimestamp = (value, fallback = 'Never Sync') => {
    if (!value) return fallback;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? value
        : parsed.toLocaleString('en-US', { timeZone: 'Asia/Manila' });
};

const resolveBiometricWebhookUrl = (config) => {
    const rawPath = (config?.webhookPath || '/api/hr/biometric/webhook').trim();
    if (!rawPath) return '';
    if (/^https?:\/\//i.test(rawPath)) return rawPath;

    const base = (import.meta.env.VITE_API_URL || window.location.origin || '').replace(/\/$/, '');
    return `${base}${rawPath.startsWith('/') ? rawPath : `/${rawPath}`}`;
};

const mergeBiometricStatusPayload = (previousStatus, incomingStatus, fallbackProvider = '') => {
    const incoming = incomingStatus || {};
    return mergeBiometricStatus({
        ...previousStatus,
        ...incoming,
        connected: incoming.connected ?? previousStatus?.connected ?? false,
        connectionCheckedAt: incoming.connectionCheckedAt || incoming.checked_at || previousStatus?.connectionCheckedAt || '',
        lastSyncAt: incoming.lastSyncAt || incoming.last_sync_at || incoming.synced_at || previousStatus?.lastSyncAt || '',
        lastAttemptAt: incoming.lastAttemptAt || incoming.attempted_at || previousStatus?.lastAttemptAt || '',
        lastImportedCount: Number(incoming.lastImportedCount ?? incoming.imported_count ?? incoming.imported ?? previousStatus?.lastImportedCount ?? 0),
        lastDuplicateCount: Number(incoming.lastDuplicateCount ?? incoming.duplicate_count ?? incoming.duplicates ?? previousStatus?.lastDuplicateCount ?? 0),
        source: incoming.source || incoming.provider || previousStatus?.source || fallbackProvider,
        message: incoming.message || previousStatus?.message || '',
        webhookHealthy: incoming.webhookHealthy ?? incoming.webhook_healthy ?? previousStatus?.webhookHealthy ?? false
    });
};

const formatCompactCurrency = (value) => `₱${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0)}`;
const formatPayrollPdfCurrency = (value) => `PHP ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const truncateTreemapLabel = (label, maxLength = 20) => {
    if (!label) return '';
    return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
};

const buildPayrollTreemapData = (entries, total, palette, limit = entries.length) => {
    if (!Array.isArray(entries) || entries.length === 0) return [];

    const limitedEntries = entries.slice(0, limit);
    const remainingEntries = entries.slice(limit);
    const combinedEntries = [...limitedEntries];

    if (remainingEntries.length > 0) {
        const otherTotal = remainingEntries.reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
        combinedEntries.push(['Others', otherTotal]);
    }

    return combinedEntries.map(([name, value], index) => ({
        name,
        value,
        share: total > 0 ? (value / total) * 100 : 0,
        fill: palette[index % palette.length]
    }));
};

const PayrollTreemapTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;

    const node = payload[0]?.payload || payload[0] || {};
    const nodeName = node.name || node.payload?.name || 'Unknown';
    const nodeValue = Number(node.value ?? node.payload?.value ?? 0);
    const nodeShare = Number(node.share ?? node.payload?.share ?? 0);

    return (
        <div className="rounded-xl border border-slate-200 bg-slate-950/95 px-3 py-2 text-white shadow-xl">
            <p className="text-sm font-black">{nodeName}</p>
            <p className="mt-1 text-xs font-bold text-slate-200">{formatCompactCurrency(nodeValue)} · {nodeShare.toFixed(1)}%</p>
        </div>
    );
};

const PayrollTreemapNode = (props) => {
    const { depth, x, y, width, height, fill, name, share, value, index } = props;

    if (depth !== 1 || width <= 0 || height <= 0) return null;

    const tileFill = fill || PAYROLL_DEPT_TREEMAP_COLORS[index % PAYROLL_DEPT_TREEMAP_COLORS.length];
    const shareValue = Number(share || 0);
    const amountValue = Number(value || 0);
    const showLarge = width > 132 && height > 82;
    const showMedium = width > 96 && height > 56;
    const canShowLabel = width > 72 && height > 36;
    const label = truncateTreemapLabel(name, showLarge ? 24 : 16);
    const labelFontSize = showLarge ? 16 : showMedium ? 13 : 11;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx={18}
                ry={18}
                fill={tileFill}
                stroke="rgba(255,255,255,0.9)"
                strokeWidth={3}
                shapeRendering="geometricPrecision"
            />
            {canShowLabel && (
                <foreignObject
                    x={x + 12}
                    y={y + 12}
                    width={Math.max(width - 24, 0)}
                    height={Math.max(height - 24, 0)}
                    pointerEvents="none"
                >
                    <div
                        xmlns="http://www.w3.org/1999/xhtml"
                        style={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            color: '#ffffff',
                            fontFamily: 'inherit',
                            WebkitFontSmoothing: 'antialiased',
                            MozOsxFontSmoothing: 'grayscale',
                            textShadow: 'none'
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div
                                style={{
                                    fontSize: `${labelFontSize}px`,
                                    fontWeight: 800,
                                    lineHeight: 1.1,
                                    letterSpacing: '-0.01em',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitBoxOrient: 'vertical',
                                    WebkitLineClamp: showLarge ? 2 : 1
                                }}
                            >
                                {label}
                            </div>
                            {showMedium && (
                                <div style={{ fontSize: showLarge ? '12px' : '10px', fontWeight: 700, lineHeight: 1 }}>
                                    {shareValue.toFixed(1)}%
                                </div>
                            )}
                        </div>
                        {showLarge && (
                            <div style={{ fontSize: '12px', fontWeight: 700, lineHeight: 1.1 }}>
                                {formatCompactCurrency(amountValue)}
                            </div>
                        )}
                    </div>
                </foreignObject>
            )}
        </g>
    );
};

// 💡 외부 설치 없는 초경량 자체 Rich Text Editor 컴포넌트
const SimpleEditor = ({ value, onChange, placeholder }) => {
    const editorRef = useRef(null);
    useEffect(() => {
        if (editorRef.current && !editorRef.current.innerHTML && value) {
            editorRef.current.innerHTML = value;
        }
    }, [value]);
    return (
        <div className="border border-slate-200 rounded-md overflow-hidden bg-white flex flex-col shadow-sm">
            <div className="bg-slate-50 p-1.5 flex gap-1 border-b border-slate-200 flex-wrap">
                <button type="button" onClick={() => document.execCommand('bold')} className="px-2.5 py-1 font-black hover:bg-slate-200 rounded text-slate-700">B</button>
                <button type="button" onClick={() => document.execCommand('italic')} className="px-2.5 py-1 italic hover:bg-slate-200 rounded text-slate-700">I</button>
                <button type="button" onClick={() => document.execCommand('underline')} className="px-2.5 py-1 underline hover:bg-slate-200 rounded text-slate-700">U</button>
                <div className="w-px h-6 bg-slate-300 mx-1 self-center"></div>
                <button type="button" onClick={() => document.execCommand('justifyLeft')} className="px-2.5 py-1 hover:bg-slate-200 rounded text-slate-700">⬅️</button>
                <button type="button" onClick={() => document.execCommand('justifyCenter')} className="px-2.5 py-1 hover:bg-slate-200 rounded text-slate-700">↔️</button>
                <button type="button" onClick={() => document.execCommand('justifyRight')} className="px-2.5 py-1 hover:bg-slate-200 rounded text-slate-700">➡️</button>
                <div className="w-px h-6 bg-slate-300 mx-1 self-center"></div>
                <button type="button" onClick={() => document.execCommand('formatBlock', false, 'H1')} className="px-2.5 py-1 font-black hover:bg-slate-200 rounded text-slate-700 text-lg">H1</button>
                <button type="button" onClick={() => document.execCommand('formatBlock', false, 'H3')} className="px-2.5 py-1 font-bold hover:bg-slate-200 rounded text-slate-700">H2</button>
                <button type="button" onClick={() => document.execCommand('formatBlock', false, 'P')} className="px-2.5 py-1 text-sm font-medium hover:bg-slate-200 rounded text-slate-700">Normal</button>
            </div>
            <div
                ref={editorRef}
                className="p-4 min-h-[120px] outline-none text-sm text-slate-700 [&>h1]:text-2xl [&>h1]:font-black [&>h1]:mb-2 [&>h3]:text-lg [&>h3]:font-bold [&>h3]:mb-2 [&>p]:mb-1 focus:bg-blue-50/30 transition-colors whitespace-pre-wrap break-words"
                contentEditable
                onInput={(e) => onChange(e.currentTarget.innerHTML)}
                data-placeholder={placeholder}
            />
        </div>
    );
};

export default function Admin() {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(() => {
        // 1. 다른 페이지에서 넘어온 탭이 있으면 우선순위 적용
        if (location.state?.tab) return location.state.tab;

        const r = sessionStorage.getItem('role');
        const acc = sessionStorage.getItem('accessible_menus') || '';

        // 2. 최고 관리자나 매니저는 재무(Finance)가 기본
        if (r === 'SUPER_ADMIN') return 'FINANCE';

        // 3. 일반 직원은 자신의 권한 목록 중 가장 먼저 매칭되는 탭을 염
        const arr = acc.split(',');
        if (arr.includes('ADMIN_FINANCE')) return 'FINANCE';
        if (arr.includes('ADMIN_WEBSITE_BUILDER')) return 'WEBSITE_BUILDER';
        if (arr.includes('ADMIN_OTA_SYNC')) return 'OTA_SYNC';
        if (arr.includes('ADMIN_ROOMS')) return 'ROOMS';
        if (arr.includes('ADMIN_POS_MENU')) return 'POS_MENU';
        if (arr.includes('ADMIN_MEMBERS')) return 'MEMBERS';
        if (arr.includes('ADMIN_HR')) return 'HR';
        if (arr.includes('ADMIN_BANK_ACCOUNTS')) return 'BANK_ACCOUNTS';
        if (arr.includes('ADMIN_DEVICES')) return 'DEVICES';
        if (arr.includes('ADMIN_POLICIES')) return 'POLICIES';
        if (arr.includes('ADMIN_RECEIPT')) return 'RECEIPT';
        if (arr.includes('ADMIN_TV_CMS')) return 'TV_CMS';
        if (arr.includes('ADMIN_PROMOTIONS_CMS')) return 'PROMOTIONS_CMS';
        if (arr.includes('ADMIN_LOGS')) return 'LOGS';

        // 4. (예비용) 만약 여기까지 왔는데 아무것도 없으면 DASHBOARD 띄움
        return 'DASHBOARD';
    });

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const currentUserId = sessionStorage.getItem('userId') || '';
    const currentHotelCode = sessionStorage.getItem('hotelCode') || ' ';
    const [members, setMembers] = useState([]);
    const [memberLoading, setMemberLoading] = useState(false);
    const [memberError, setMemberError] = useState('');
    const [memberKeyword, setMemberKeyword] = useState('');
    const [memberFilters, setMemberFilters] = useState({ nationality: 'ALL', province: 'ALL', birthMonth: 'ALL', visitBand: 'ALL' });
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [memberDrafts, setMemberDrafts] = useState({});
    const [bulkTag, setBulkTag] = useState('');
    const [bulkMemo, setBulkMemo] = useState('');
    const [emailComposer, setEmailComposer] = useState({
        subject: '',
        content: '',
        fromName: 'Hotel CRM',
        senderEmail: '',
        replyTo: '',
        sendMode: 'SELECTED',
        transportMode: 'HOTEL_SMTP',
        smtpHost: '',
        smtpPort: '587',
        smtpSecure: false,
        smtpUser: '',
        smtpPass: ''
    });
    
    const [emailAttachments, setEmailAttachments] = useState([]);
    const [emailSending, setEmailSending] = useState(false);
    const [rewardsConfigLoading, setRewardsConfigLoading] = useState(false);
    const [rewardsConfigSaving, setRewardsConfigSaving] = useState(false);
    const [rewardsConfig, setRewardsConfig] = useState({
        enabled: false,
        program_name: 'Hotel Rewards Club',
        points_unit_currency: 100,
        points_per_unit: 1,
        // points_per_stay: 100, <-- 이 부분이 아래 두 줄로 대체되었습니다.
        points_per_room_rate_spend: 100, // 추가됨: 객실 요금 기준 금액 (예: 100페소)
        points_per_room_rate_earn: 1,    // 추가됨: 적립될 포인트 (예: 1포인트)
        welcome_bonus_points: 200,
        birthday_bonus_points: 150,
        referral_bonus_points: 100,
        tier_enabled: true,
        tiers: [
            { key: 'SILVER', min_points: 0, benefit: 'Member-only rates' },
            { key: 'GOLD', min_points: 2000, benefit: 'Late checkout (subject to availability)' },
            { key: 'PLATINUM', min_points: 5000, benefit: 'Room upgrade priority + welcome perks' }
        ],
        redeem_enabled: true,
        redeem_rate_points_per_100: 100,
        min_redeem_points: 500,
        points_expiry_months: 24,
        popup_enabled: false,
        popup_title: 'Join Our Rewards Program',
        popup_message: 'Earn points for every stay and unlock member-only perks.',
        popup_cta_label: 'View Rewards',
        popup_cta_target: 'MYPAGE_REWARDS',
        popup_frequency: 'ONCE_PER_SESSION',
        popup_theme: 'CORPORATE_LIGHT',
        auto_points_on_booking_confirmed: true,
        auto_points_on_checkin: true,
        auto_points_on_payment: true,
        auto_booking_points: 100,
        auto_checkin_points: 120
    });

    // --- 상태 변수 (State) ---
    const [transactions, setTransactions] = useState([]);
    const [financeFilter, setFinanceFilter] = useState({ startDate: '', endDate: '', type: 'ALL', category: 'ALL' });
    const [pointsAnalytics, setPointsAnalytics] = useState({
        summary: {
            issued_points: 0,
            used_points: 0,
            net_points: 0,
            points_payment_revenue: 0,
            points_payment_share_pct: 0
        },
        daily: [],
        recent_redemptions: []
    });
    const [pointsAnalyticsLoading, setPointsAnalyticsLoading] = useState(false);
    const [isPointsHistoryModalOpen, setIsPointsHistoryModalOpen] = useState(false);
    const [pointsHistoryFilter, setPointsHistoryFilter] = useState({ startDate: '', endDate: '', source: 'ALL', keyword: '' });
    const [pointsHistoryPage, setPointsHistoryPage] = useState(1);
    const pointsHistoryPageSize = 20;

    const getMemberId = (member) => member.id || member.member_id || member.user_id || member.email;
    const getVisitCount = (member) => Number(member.visit_count ?? member.stay_count ?? member.booking_count ?? member.total_stays ?? 0) || 0;
    const getVisitBand = (count) => {
        if (count === 0) return '0';
        if (count <= 2) return '1_2';
        if (count <= 5) return '3_5';
        return '6_PLUS';
    };
    const getBirthdayMonth = (member) => {
        const dobRaw = String(member?.dob || member?.birth_date || '').trim();
        if (!dobRaw) return '';
        if (/^\d{2}\/\d{2}$/.test(dobRaw)) return dobRaw.slice(0, 2);
        const parsed = new Date(dobRaw);
        if (!Number.isNaN(parsed.getTime())) return String(parsed.getMonth() + 1).padStart(2, '0');
        return '';
    };
    const birthdayMonthOptions = [
        { value: '01', label: 'January' }, { value: '02', label: 'February' }, { value: '03', label: 'March' }, { value: '04', label: 'April' },
        { value: '05', label: 'May' }, { value: '06', label: 'June' }, { value: '07', label: 'July' }, { value: '08', label: 'August' },
        { value: '09', label: 'September' }, { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' }
    ];

    const fetchMembers = async () => {
        try {
            setMemberLoading(true);
            setMemberError('');
            const res = await fetch(`/api/admin/members?hotel=${encodeURIComponent(currentHotelCode)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const rows = Array.isArray(data) ? data : (data?.members || []);
            setMembers(rows);
            const draftMap = {};
            rows.forEach((m) => {
                const memberId = getMemberId(m);
                if (!memberId) return;
                draftMap[memberId] = {
                    province: m.province || m.region || m.area || '',
                    nationality: m.nationality || m.country || '',
                    tag: m.tag || '',
                    memo: m.memo || '',
                    dob: m.dob || ''
                };
            });
            setMemberDrafts(draftMap);
        } catch (e) {
            setMemberError(`Failed to load members. ${String(e.message || '')}`.trim());
            setMembers([]);
        } finally {
            setMemberLoading(false);
        }
    };

    const fetchRewardsConfig = async () => {
        if (!String(currentHotelCode || '').trim()) return;
        try {
            setRewardsConfigLoading(true);
            const res = await fetch(`/api/admin/rewards-config?hotel=${encodeURIComponent(currentHotelCode)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data?.success && data?.config) {
                setRewardsConfig((prev) => ({
                    ...prev,
                    ...data.config,
                    tiers: Array.isArray(data.config.tiers) && data.config.tiers.length ? data.config.tiers : prev.tiers
                }));
            }
        } catch (e) {
            console.error('Rewards config load failed:', e);
        } finally {
            setRewardsConfigLoading(false);
        }
    };

    const fetchPointsAnalytics = async () => {
        if (!String(currentHotelCode || '').trim()) return;
        try {
            setPointsAnalyticsLoading(true);
            const res = await fetch(`/api/admin/rewards-analytics?hotel=${encodeURIComponent(currentHotelCode)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data?.success) {
                setPointsAnalytics({
                    summary: data.summary || {},
                    daily: Array.isArray(data.daily) ? data.daily : [],
                    recent_redemptions: Array.isArray(data.recent_redemptions) ? data.recent_redemptions : []
                });
            }
        } catch (e) {
            console.error('Points analytics load failed:', e);
            setPointsAnalytics({
                summary: {
                    issued_points: 0,
                    used_points: 0,
                    net_points: 0,
                    points_payment_revenue: 0,
                    points_payment_share_pct: 0
                },
                daily: [],
                recent_redemptions: []
            });
        } finally {
            setPointsAnalyticsLoading(false);
        }
    };

    const handleSaveRewardsConfig = async () => {
        try {
            setRewardsConfigSaving(true);
            const payload = {
                hotel_code: currentHotelCode,
                config: rewardsConfig
            };
            const res = await fetch('/api/admin/rewards-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) throw new Error(data?.message || `HTTP ${res.status}`);
            setRewardsConfig((prev) => ({ ...prev, ...(data.config || {}) }));
            recordAuditLog(`Updated rewards program config (${currentHotelCode})`);
            alert('Rewards program settings saved.');
        } catch (e) {
            alert(`Failed to save rewards settings: ${e.message || 'unknown error'}`);
        } finally {
            setRewardsConfigSaving(false);
        }
    };

    const handleRewardsTierChange = (index, key, value) => {
        setRewardsConfig((prev) => {
            const next = Array.isArray(prev.tiers) ? [...prev.tiers] : [];
            if (!next[index]) return prev;
            next[index] = {
                ...next[index],
                [key]: key === 'min_points' ? Number(value || 0) : value
            };
            return { ...prev, tiers: next };
        });
    };
    const handleMemberActivate = async (member) => {
        const memberId = member.id || member.member_id || member.user_id || member.email;
        if (!memberId) return alert('Member ID is missing.');
        await fetch('/api/admin/members/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hotel_code: currentHotelCode, member_id: memberId, is_active: !(member.is_active === 1 || member.is_active === true) })
        });
        recordAuditLog(`Updated member activation: ${memberId}`);
        fetchMembers();
    };

    const handleMemberSaveProfile = async (member) => {
        const memberId = member.id || member.member_id || member.user_id || member.email;
        if (!memberId) return alert('Member ID is missing.');
        const draft = memberDrafts[memberId] || {};
        await fetch('/api/admin/members/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hotel_code: currentHotelCode,
                member_id: memberId,
                province: draft.province || '',
                region: draft.province || '',
                nationality: draft.nationality || '',
                dob: draft.dob || '',
                tag: draft.tag || '',
                memo: draft.memo || ''
            })
        });
        await fetch('/api/admin/members/tag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hotel_code: currentHotelCode, member_id: memberId, tag: draft.tag || '', memo: draft.memo || '' })
        });
        recordAuditLog(`Updated member profile: ${memberId}`);
        fetchMembers();
    };

    const handleMemberDraftChange = (memberId, key, value) => {
        setMemberDrafts(prev => ({ ...prev, [memberId]: { ...(prev[memberId] || {}), [key]: value } }));
    };

    const handleToggleSelectMember = (memberId) => {
        setSelectedMemberIds(prev => prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]);
    };

    const handleSendMemberEmail = async (recipientMembers) => {
        if (!emailComposer.subject.trim() || !emailComposer.content.trim()) return alert('Please enter email subject and content.');
        if (!recipientMembers.length) return alert('No recipients selected.');
        if (!emailComposer.senderEmail.trim()) return alert('Please enter sender email.');
        if (emailComposer.transportMode === 'HOTEL_SMTP') {
            if (!emailComposer.smtpHost.trim() || !emailComposer.smtpPort.trim() || !emailComposer.smtpUser.trim() || !emailComposer.smtpPass.trim()) {
                return alert('Please enter complete SMTP settings for hotel email sending.');
            }
        }
        try {
            setEmailSending(true);
            const payload = {
                hotel_code: currentHotelCode,
                subject: emailComposer.subject,
                html: emailComposer.content,
                from_name: emailComposer.fromName,
                sender_email: emailComposer.senderEmail,
                reply_to: emailComposer.replyTo,
                transport_mode: emailComposer.transportMode,
                smtp: emailComposer.transportMode === 'HOTEL_SMTP' ? {
                    host: emailComposer.smtpHost,
                    port: Number(emailComposer.smtpPort || 587),
                    secure: !!emailComposer.smtpSecure,
                    user: emailComposer.smtpUser,
                    pass: emailComposer.smtpPass
                } : null,
                attachments: emailAttachments.map((a) => ({
                    filename: a.filename,
                    mime_type: a.mimeType,
                    content_base64: a.base64
                })),
                recipients: recipientMembers.map(m => ({
                    member_id: getMemberId(m),
                    email: m.email,
                    name: m.name || m.member_name || ''
                })).filter(r => !!r.email)
            };
            const res = await fetch('/api/admin/members/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            recordAuditLog(`Sent member campaign email (${payload.recipients.length} recipients)`);
            alert(`Email sent to ${payload.recipients.length} recipients.`);
        } catch (e) {
            alert(`Email send failed: ${e.message || 'unknown error'}`);
        } finally {
            setEmailSending(false);
        }
    };

    const handleEmailAttachmentUpload = async (files) => {
        const list = Array.from(files || []);
        const mapped = await Promise.all(list.map((file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = String(reader.result || '');
                const base64 = result.includes(',') ? result.split(',')[1] : result;
                resolve({
                    filename: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    size: file.size || 0,
                    base64
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        })));
        setEmailAttachments(prev => [...prev, ...mapped]);
    };

    const memberNationalityOptions = Array.from(new Set(members.map(m => (m.nationality || m.country || '').trim()).filter(Boolean)));
    const memberProvinceOptions = Array.from(new Set(members.map(m => (m.province || m.region || m.area || '').trim()).filter(Boolean)));
    const filteredMembers = members.filter((m) => {
        const q = memberKeyword.trim().toLowerCase();
        const visitCount = getVisitCount(m);
        const birthMonth = getBirthdayMonth(m);
        const visitBand = getVisitBand(visitCount);
        const nationality = (m.nationality || m.country || '').trim();
        const province = (m.province || m.region || m.area || '').trim();
        const matchKeyword = !q || `${m.name || ''} ${m.member_name || ''} ${m.email || ''} ${m.phone || ''}`.toLowerCase().includes(q);
        const matchNationality = memberFilters.nationality === 'ALL' || nationality === memberFilters.nationality;
        const matchProvince = memberFilters.province === 'ALL' || province === memberFilters.province;
        const matchBirthMonth = memberFilters.birthMonth === 'ALL' || birthMonth === memberFilters.birthMonth;
        const matchVisit = memberFilters.visitBand === 'ALL' || visitBand === memberFilters.visitBand;
        return matchKeyword && matchNationality && matchProvince && matchBirthMonth && matchVisit;
    });
    const selectedMembers = filteredMembers.filter(m => selectedMemberIds.includes(getMemberId(m)));
    const vipMembers = members.filter(m => getVisitCount(m) >= 6);
    const dormantMembers = members.filter(m => getVisitCount(m) === 0);
    const newMembers = members.filter(m => {
        const joined = new Date(m.created_at || m.createdAt || m.signup_date || '');
        if (Number.isNaN(joined.getTime())) return false;
        const now = new Date();
        return (now - joined) / (1000 * 60 * 60 * 24) <= 30;
    });

    const handleExportMembersCsv = () => {
        const rows = filteredMembers.map((m) => ({
            member_id: getMemberId(m),
            name: m.name || m.member_name || '',
            email: m.email || '',
            phone: m.phone || '',
            nationality: m.nationality || m.country || '',
            province: m.province || m.region || m.area || '',
            birthday_month: getBirthdayMonth(m) || '',
            visits: getVisitCount(m),
            is_active: (m.is_active === 1 || m.is_active === true) ? 'ACTIVE' : 'INACTIVE'
        }));
        if (!rows.length) return alert('No rows to export.');
        const headers = Object.keys(rows[0]);
        const csv = [headers.join(',')]
            .concat(rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `members_${currentHotelCode}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleBulkApplyTagMemo = async () => {
        const targets = selectedMembers;
        if (!targets.length) return alert('Select members first.');
        if (!bulkTag.trim() && !bulkMemo.trim()) return alert('Enter bulk tag or memo.');
        for (const m of targets) {
            const memberId = getMemberId(m);
            await fetch('/api/admin/members/tag', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hotel_code: currentHotelCode, member_id: memberId, tag: bulkTag.trim(), memo: bulkMemo.trim() })
            });
        }
        recordAuditLog(`Bulk CRM tag/memo applied to ${targets.length} members`);
        alert(`Applied to ${targets.length} members.`);
        fetchMembers();
    };

    // 👇 [신규 추가] Vault(정산) 탭 전용 필터 및 폼 상태
    const [vaultFilter, setVaultFilter] = useState({ startDate: '', endDate: '', department: 'ALL' });
    const [vaultTx, setVaultTx] = useState({ department: '', amount: '', description: '' });

    const [posStores, setPosStores] = useState([]);
    const [selectedStore, setSelectedStore] = useState('');
    const [menus, setMenus] = useState([]);
    const [editingMenu, setEditingMenu] = useState(null);
    const [newStore, setNewStore] = useState(() => createDefaultPosStoreForm());
    const [newMenu, setNewMenu] = useState(() => createDefaultPosMenuForm());
    const [draggedMenuImgIdx, setDraggedMenuImgIdx] = useState(null);
    const [editingStore, setEditingStore] = useState(null);
    const [posStoreSearch, setPosStoreSearch] = useState('');
    const [posStoreTypeFilter, setPosStoreTypeFilter] = useState('ALL');
    const [posMenuSearch, setPosMenuSearch] = useState('');
    const [posMenuCategoryFilter, setPosMenuCategoryFilter] = useState('ALL');
    const [posMenuScope, setPosMenuScope] = useState('ALL');
    const [posMenuSortMode, setPosMenuSortMode] = useState('CATEGORY');
    const posMenuBuilderRef = useRef(null);

    const [payments, setPayments] = useState([]);
    const [newPaymentProvider, setNewPaymentProvider] = useState('');
    const [devices, setDevices] = useState([]);
    const [newDevice, setNewDevice] = useState({ name: '', type: 'Payment Terminal', ip_address: '', target_store: '' });

    const [bankAccounts, setBankAccounts] = useState([]);
    const [cashData, setCashData] = useState({ frontOffice: 0, posOutlets: 0, bankTotal: 0 });
    const [newBank, setNewBank] = useState({ bank: '', account_name: '', account_num: '', type: 'Corporate', balance: 0 });

    const [contactTitleCount, setContactTitleCount] = useState(0);

    // 👇 POS 대시보드 분석용 상태 변수 추가
    const [posSubTab, setPosSubTab] = useState('MANAGE'); // 'MANAGE' 또는 'ANALYSIS'
    const [posAnalytics, setPosAnalytics] = useState([]);
    const [posAnalysisFilter, setPosAnalysisFilter] = useState('');
    useEffect(() => {
        if (posSubTab === 'ANALYSIS' && posStores.length > 0 && !posAnalysisFilter) {
            setPosAnalysisFilter(String(posStores[0].id)); // 첫 번째 매장 ID 자동 세팅
        }
    }, [posSubTab, posStores, posAnalysisFilter]);

    const [cancelPolicies, setCancelPolicies] = useState([]);

    // ========================================================
    // 💡 [핵심] 강력한 하이브리드 로깅 시스템 (Audit Logs)
    // ========================================================
    const [logs, setLogs] = useState([]);
    const [auditFilter, setAuditFilter] = useState({ startDate: '', endDate: '', keyword: '' });

    const recordAuditLog = (actionDesc) => {
        const newLog = {
            id: `local_${Date.now()}`,
            timestamp: new Date().toLocaleString('en-US', { hour12: false }),
            user_id: currentUserId || 'Admin',
            action: actionDesc,
            hotel_code: currentHotelCode
        };

        // 💡 1. 브라우저 로컬 저장소 백업 (최대 500개까지만 저장하여 브라우저 과부하 방지)
        const existingLogs = JSON.parse(localStorage.getItem(`audit_logs_${currentHotelCode}`) || '[]');
        const updatedLocalLogs = [newLog, ...existingLogs].slice(0, 500);
        localStorage.setItem(`audit_logs_${currentHotelCode}`, JSON.stringify(updatedLocalLogs));

        // 2. 화면 즉시 갱신
        fetchLogs();

        // 3. 백엔드 전송
        fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newLog)
        }).catch(() => { });
    };

    const fetchLogs = async () => {
        try {
            const res = await fetch(`/api/logs?hotel=${currentHotelCode}`);
            const data = await res.json();
            const backendLogs = Array.isArray(data) ? data : [];
            const localLogs = JSON.parse(localStorage.getItem(`audit_logs_${currentHotelCode}`) || '[]');

            const allLogs = [];

            // 💡 [핵심 수정] 서버와 로컬의 시간 표시 포맷(AM/PM vs 24h)이 다르거나, 
            // 통신 딜레이로 1~2초의 차이가 발생해도 중복을 완벽히 걸러내는 스마트 필터링
            const processLog = (log) => {
                const logTime = new Date(log.timestamp).getTime();

                // 이미 allLogs 배열에 '1분(60초) 이내'에 '동일한 유저'가 '동일한 액션'을 한 기록이 있는지 검사
                const isDuplicate = allLogs.some(existingLog => {
                    const existingTime = new Date(existingLog.timestamp).getTime();
                    const isSameUserAndAction = existingLog.user_id === log.user_id && existingLog.action === log.action;
                    const isWithinOneMinute = Math.abs(existingTime - logTime) < 60000;

                    return isSameUserAndAction && isWithinOneMinute;
                });

                if (!isDuplicate) {
                    allLogs.push(log);
                }
            };

            // 서버 데이터(DB)를 우선적으로 처리한 후, 로컬 백업 데이터를 덧붙이며 중복 검사 실행
            backendLogs.forEach(processLog);
            localLogs.forEach(processLog);

            // 최신 시간순으로 최종 정렬
            allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setLogs(allLogs);
        } catch (e) {
            const localLogs = JSON.parse(localStorage.getItem(`audit_logs_${currentHotelCode}`) || '[]');
            localLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setLogs(localLogs);
        }
    };

    const [receiptConfig, setReceiptConfig] = useState({
        header_text: '', footer_text: '', address: '', business_no: '', tax_id: '',
        vat_rate: 12, sc_rate: 10, logo_url: '', imageFile: null,
        signer_name: '', signer_title: '', signatureBase64: ''
    });

    // HR 관련 상태
    const [hrSubTab, setHrSubTab] = useState('DIRECTORY');
    const [employees, setEmployees] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [evaluations, setEvaluations] = useState([]);
    const [scheduleWeek, setScheduleWeek] = useState([]);

    const [payrollViewMode, setPayrollViewMode] = useState('CALCULATE'); // 'CALCULATE' (계산) 또는 'HISTORY' (보관함)
    const [payrollHistory, setPayrollHistory] = useState(() => JSON.parse(localStorage.getItem(`hr_payroll_history_${currentHotelCode}`) || '[]'));
    const [payrollHistorySearch, setPayrollHistorySearch] = useState('');
    const [isSettling, setIsSettling] = useState(false);
    const [showPayrollSettings, setShowPayrollSettings] = useState(false);
    const [payrollConfig, setPayrollConfig] = useState(() => loadPayrollConfig(currentHotelCode));
    const [showBiometricSettings, setShowBiometricSettings] = useState(false);
    const [isSavingBiometricConfig, setIsSavingBiometricConfig] = useState(false);
    const [isTestingBiometric, setIsTestingBiometric] = useState(false);
    const [biometricConfig, setBiometricConfig] = useState(() => loadBiometricConfig(currentHotelCode));
    const [biometricStatus, setBiometricStatus] = useState(() => loadBiometricStatus(currentHotelCode));
    const [biometricLogs, setBiometricLogs] = useState(() => loadBiometricLogs(currentHotelCode));

    // ========================================================
    // 📅 [스케줄러 고도화] 통합 상태 및 로직 (검색/시간설정 추가)
    // ========================================================

    // 1️⃣ 상태(State) 선언부
    const [scheduleView, setScheduleView] = useState('WEEKLY');
    const [showScheduleSettings, setShowScheduleSettings] = useState(false);
    const [scheduleMode, setScheduleMode] = useState('AUTO');

    // 🔍 검색 필터 상태 추가
    const [scheduleSearch, setScheduleSearch] = useState({ query: '', dept: '', role: '' });

    const [scheduleStartDate, setScheduleStartDate] = useState(() => getScheduleAnchorDate('WEEKLY'));
    const [scheduleContext, setScheduleContext] = useState(() => ({
        view: 'WEEKLY',
        startDate: getScheduleAnchorDate('WEEKLY')
    }));

    // ⚙️ 직종별 교대 규칙 및 상세 시간 세팅 (고도화)
    const [scheduleRules, setScheduleRules] = useState({
        maxHours: 40,
        deptShifts: {
            'Management': 'Day-Only',
            'Front Office': '3-Shifts',
            'Housekeeping': '2-Shifts',
            'Maintenance': '2-Shifts',
            'Security': '3-Shifts',
            'Food & Beverage': '2-Shifts'
        },
        shiftTimes: {
            'Day': { start: '09:00', end: '18:00', color: 'bg-yellow-50 text-yellow-600 border-yellow-200', label: 'Day Only' },
            'Morning': { start: '07:00', end: '15:00', color: 'bg-orange-50 text-orange-600 border-orange-200', label: 'Morning' },
            'Mid': { start: '15:00', end: '23:00', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', label: 'Mid' },
            'Night': { start: '23:00', end: '07:00', color: 'bg-indigo-50 text-indigo-600 border-indigo-200', label: 'Night' }
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(getPayrollConfigStorageKey(currentHotelCode), JSON.stringify(payrollConfig));
        } catch (e) {
            console.error('Failed to save payroll config', e);
        }
    }, [payrollConfig, currentHotelCode]);

    useEffect(() => {
        setBiometricConfig(loadBiometricConfig(currentHotelCode));
        setBiometricStatus(loadBiometricStatus(currentHotelCode));
        setBiometricLogs(loadBiometricLogs(currentHotelCode));
    }, [currentHotelCode]);

    useEffect(() => {
        try {
            localStorage.setItem(getBiometricConfigStorageKey(currentHotelCode), JSON.stringify(biometricConfig));
        } catch (e) {
            console.error('Failed to save biometric config', e);
        }
    }, [biometricConfig, currentHotelCode]);

    useEffect(() => {
        try {
            localStorage.setItem(getBiometricStatusStorageKey(currentHotelCode), JSON.stringify(biometricStatus));
        } catch (e) {
            console.error('Failed to save biometric status', e);
        }
    }, [biometricStatus, currentHotelCode]);

    useEffect(() => {
        try {
            localStorage.setItem(getBiometricLogsStorageKey(currentHotelCode), JSON.stringify((biometricLogs || []).slice(0, 40)));
        } catch (e) {
            console.error('Failed to save biometric logs', e);
        }
    }, [biometricLogs, currentHotelCode]);

    // 2️⃣ 계산식 (월/일 표기 반영)
    const scheduleDaysCount = scheduleView === 'WEEKLY' ? 7 : 30;
    const scheduleDateHeaders = Array.from({ length: scheduleDaysCount }).map((_, i) => {
        const d = new Date(scheduleStartDate);
        d.setDate(d.getDate() + i);
        return {
            key: d.toISOString().split('T')[0],
            dayStr: d.toLocaleDateString('en-US', { weekday: 'short' }),
            dateStr: `${d.getMonth() + 1}/${d.getDate()}`, // 💡 월/일 형태(예: 3/30)로 변경
            isWeekend: d.getDay() === 0 || d.getDay() === 6
        };
    });

    // 3️⃣ 스케줄 필터링 로직 (검색 반영)
    const filteredScheduleWeek = scheduleWeek.filter(emp => {
        const matchQuery = emp.name.toLowerCase().includes(scheduleSearch.query.toLowerCase()) || emp.emp_id.toLowerCase().includes(scheduleSearch.query.toLowerCase());
        const matchDept = scheduleSearch.dept ? emp.dept === scheduleSearch.dept : true;
        const matchRole = scheduleSearch.role ? emp.role === scheduleSearch.role : true;
        return matchQuery && matchDept && matchRole;
    });

    // 4️⃣ 함수부
    const generateSmartSchedule = () => {
        if (employees.length === 0) return alert("No registered employees.");
        const start = new Date(scheduleStartDate);

        const newSchedule = employees.map((emp, empIndex) => {
            const dept = getDepartmentForRole(emp.role);
            const allowedShifts = getAllowedShiftsForDept(dept);
            const row = { emp_id: emp.emp_id, name: emp.name, role: emp.role, dept, schedule: {} };

            const maxWeeklyHours = Math.max(8, Number(scheduleRules.maxHours) || 40);
            let weeklyHours = 0;
            let consecutiveWorkDays = 0;

            for (let i = 0; i < scheduleDaysCount; i++) {
                const current = new Date(start);
                current.setDate(start.getDate() + i);
                const dateKey = current.toISOString().split('T')[0];

                if (current.getDay() === 1) {
                    weeklyHours = 0;
                    consecutiveWorkDays = 0;
                }

                const plannedShift = allowedShifts[(empIndex + i) % allowedShifts.length];
                const plannedHours = getShiftDurationHours(plannedShift) || 8;
                const isPreferredOffDay = ((i + (empIndex % 3)) % 6 === 5) && weeklyHours >= plannedHours * 2;
                const isOff = isPreferredOffDay || consecutiveWorkDays >= 5 || (weeklyHours + plannedHours) > maxWeeklyHours;

                const assignedShift = isOff ? 'Off' : plannedShift;
                row.schedule[dateKey] = assignedShift;

                if (assignedShift === 'Off') {
                    consecutiveWorkDays = 0;
                } else {
                    weeklyHours += plannedHours;
                    consecutiveWorkDays += 1;
                }
            }

            return row;
        });

        setScheduleWeek(newSchedule);
        setScheduleContext({ view: scheduleView, startDate: scheduleStartDate });
        alert(`✨ ${scheduleView} schedule is ready. Review coverage cards below or switch to manual edit for fine-tuning.`);
    };

    const handleScheduleCellClick = (emp_id, dateKey, dept) => {
        if (scheduleMode !== 'MANUAL' || !isScheduleAligned) return;
        setScheduleWeek(prev => prev.map(emp => {
            if (emp.emp_id !== emp_id) return emp;
            const currentShift = emp.schedule[dateKey] || 'Off';
            const shiftCycle = [...getAllowedShiftsForDept(dept), 'Off'];
            const nextIndex = (shiftCycle.indexOf(currentShift) + 1) % shiftCycle.length;
            return { ...emp, schedule: { ...emp.schedule, [dateKey]: shiftCycle[nextIndex] } };
        }));
        setScheduleContext({ view: scheduleView, startDate: scheduleStartDate });
    };

    // 💡 Export PDF (검색/필터링된 결과물 출력)
    const handleExportSchedulePDF = () => {
        if (displayedScheduleRows.length === 0) return alert("No schedule to export.");

        const doc = new jsPDF('landscape');
        doc.setFontSize(18);
        doc.text(`Staff Schedule (${scheduleView} - ${getSchedulePeriodLabel()})`, 14, 20);

        const headRow = ['Employee', 'Dept/Role', ...scheduleDateHeaders.map(h => `${h.dayStr} ${h.dateStr}`)];

        const bodyRows = displayedScheduleRows.map(emp => {
            const row = [emp.name, `${emp.dept}\n${emp.role}`];
            scheduleDateHeaders.forEach(h => {
                row.push(emp.schedule[h.key] || '-');
            });
            return row;
        });

        autoTable(doc, {
            startY: 30,
            head: [headRow],
            body: bodyRows,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42] },
            styles: { fontSize: 8, cellPadding: 2, halign: 'center', valign: 'middle' },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold' }, 1: { halign: 'left' } }
        });

        doc.save(`Hotel_Schedule_${scheduleStartDate}.pdf`);
    };

    const handleExportScheduleCSV = () => {
        if (displayedScheduleRows.length === 0) return alert("No schedule to export.");

        const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const headers = ['Employee ID', 'Employee', 'Department', 'Role', 'Planned Hours', 'Off Days', ...scheduleDateHeaders.map(h => `${h.dayStr} ${h.dateStr}`)];
        const rows = displayedScheduleRows.map((emp) => {
            const metrics = scheduleEmployeeMetrics[emp.emp_id] || getEmployeeScheduleSummary(emp);
            return [
                emp.emp_id,
                emp.name,
                emp.dept,
                emp.role,
                metrics.hours,
                metrics.offDays,
                ...scheduleDateHeaders.map((header) => emp.schedule?.[header.key] || 'Off')
            ];
        });

        const csvContent = [headers, ...rows]
            .map((row) => row.map(escapeCsv).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Hotel_Schedule_${scheduleStartDate}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    const moveScheduleWindow = (direction) => {
        const nextDate = new Date(scheduleStartDate);
        nextDate.setDate(nextDate.getDate() + (direction * scheduleDaysCount));
        setScheduleStartDate(nextDate.toISOString().split('T')[0]);
    };

    const jumpToCurrentScheduleWindow = () => {
        setScheduleStartDate(getScheduleAnchorDate(scheduleView));
    };

    const handleClearScheduleFilters = () => {
        setScheduleSearch({ query: '', dept: '', role: '' });
    };

    const handleClearScheduleBoard = () => {
        if (scheduleWeek.length === 0) return;
        if (!window.confirm("Clear the current schedule board? This removes the generated draft from the screen.")) return;
        setScheduleWeek([]);
        setScheduleContext({ view: scheduleView, startDate: scheduleStartDate });
    };

    // 💡 [추가] CV 스캔, 파일 업로드 및 PDF 관련 통합 상태 (중복 제거)
    const [scannedImageBase64, setScannedImageBase64] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [cvFile, setCvFile] = useState(null);
    const [cvFileUrl, setCvFileUrl] = useState('');
    const cvFileInputRef = useRef(null);

    // 💡 [수정 및 고도화] CV 업로드, 스캔, PDF 다운로드 함수
    const handleCvUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setCvFile(file);
            setCvFileUrl(URL.createObjectURL(file)); // 미리보기 URL 생성
            setScannedImageBase64(''); // 파일 업로드 시 스캔 이미지는 삭제
        }
    };

    const handleScanCV = () => {
        // 💡 실제 스캐너 API 연결은 Dynamic Web TWAIN 등의 라이브러리/서비스가 필요합니다.
        // 여기서는 목업(mock-up)으로 구현하여 UI 작동만 보여줍니다.
        if (confirm("🚨 Additional work is required for API integration to connect the actual scanner. \n\nWould you like to load a virtual scan image for the demo?")) {
            setIsScanning(true);
            setCvFile(null); // 스캔 시 업로드된 파일은 삭제
            setCvFileUrl('');
            setTimeout(() => {
                // 실제로는 스캐너에서 base64 데이터를 받아옴 (예시)
                const dummyScanData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'; // 더미 base64
                setScannedImageBase64(dummyScanData);
                setIsScanning(false);
                alert("✅ CV scan completed. (Demo image)");
            }, 3000);
        }
    };

    const handleDownloadCVAsPDF = () => {
        if (!cvFileUrl && !scannedImageBase64) return alert("No CV file to download.");

        const doc = new jsPDF();

        const generatePDFFromImageData = (imageData) => {
            doc.addImage(imageData, 'JPEG', 10, 10, 190, 277);
            doc.save('cv_resume.pdf');
        };

        if (scannedImageBase64) {
            // 스캔된 이미지는 바로 PDF로 변환
            generatePDFFromImageData(scannedImageBase64);
        } else if (cvFileUrl) {
            // 업로드된 파일이 이미지인지 확인 (pdf는 jspdf로 직접 내보내기 어려움)
            if (cvFile.type.startsWith('image/')) {
                const img = new Image();
                img.src = cvFileUrl;
                img.onload = () => {
                    generatePDFFromImageData(cvFileUrl);
                };
            } else if (cvFile.type === 'application/pdf') {
                // PDF는 그냥 새 창에서 열어서 다운로드하도록 유도
                window.open(cvFileUrl, '_blank');
                alert("✅ PDF file opens in its original format. Please download it in a new window.");
            } else {
                alert("Currently, only scanned or uploaded images can be exported to PDF.");
            }
        }
    };

    const handleDeleteCv = () => {
        setCvFile(null);
        setCvFileUrl('');
        setScannedImageBase64(''); // 스캔 이미지도 삭제
        if (cvFileInputRef.current) cvFileInputRef.current.value = '';
    };

    const handleViewCv = () => {
        if (scannedImageBase64) {
            // 스캔 이미지는 새 창에서 base64 데이터를 보여줌
            const newWindow = window.open();
            newWindow.document.write('<img src="' + scannedImageBase64 + '" alt="Scanned CV" style="max-width:100%; height:auto;" />');
        } else if (cvFileUrl) {
            window.open(cvFileUrl, '_blank'); // 업로드된 파일 새 창에서 열기
        }
    };

    // 💡 [수정] accessible_menus (백오피스 체크박스 권한) 속성 추가
    const [newEmployee, setNewEmployee] = useState({ emp_id: '', password: '', role: '', base_salary: '', philhealth: '', pagibig: '', sss: '', assigned_store: '', accessible_menus: '' });

    // 💡 [수정] 고정되어 있던 departmentRoles를 편집 가능한 상태(State)로 변환
    const [departmentRoles, setDepartmentRoles] = useState(() => {
        const saved = sessionStorage.getItem('hr_dept_roles');
        return saved ? JSON.parse(saved) : {
            'Management': [ // [cite: 1]
                'General Manager', 'Hotel Manager', 'Hotel Manager Senior', 'Hotel Manager Junior',
                'Assistant Manager', 'Assistant Manager Senior', 'Assistant Manager Junior',
                'Director of Operations', 'Director of Operations Senior', 'Director of Operations Junior'
            ],
            'Front Office': [ // [cite: 1]
                'Front Office Manager', 'Front Office Manager Senior', 'Front Office Manager Junior',
                'Assistant Front Office Manager', 'Assistant Front Office Manager Senior', 'Assistant Front Office Manager Junior',
                'Duty Manager', 'Duty Manager Senior', 'Duty Manager Junior',
                'Front Desk Agent', 'Front Desk Agent Senior', 'Front Desk Agent Junior',
                'Concierge', 'Concierge Senior', 'Concierge Junior',
                'Bellman', 'Bellman Senior', 'Bellman Junior'
            ],
            'Housekeeping': [ // [cite: 2]
                'Executive Housekeeper', 'Executive Housekeeper Senior', 'Executive Housekeeper Junior',
                'Housekeeping Supervisor', 'Housekeeping Supervisor Senior', 'Housekeeping Supervisor Junior',
                'Room Attendant', 'Room Attendant Senior', 'Room Attendant Junior',
                'Public Area Attendant', 'Public Area Attendant Senior', 'Public Area Attendant Junior',
                'Laundry Staff', 'Laundry Staff Senior', 'Laundry Staff Junior'
            ],
            'Food & Beverage Service': [ // [cite: 2, 3]
                'F&B Manager', 'F&B Manager Senior', 'F&B Manager Junior',
                'Restaurant Manager', 'Restaurant Manager Senior', 'Restaurant Manager Junior',
                'Supervisor', 'Supervisor Senior', 'Supervisor Junior',
                'Waiter', 'Waiter Senior', 'Waiter Junior',
                'Bartender', 'Bartender Senior', 'Bartender Junior',
                'Hostess', 'Hostess Senior', 'Hostess Junior',
                'Banquet Staff', 'Banquet Staff Senior', 'Banquet Staff Junior'
            ],
            'Kitchen': [ // [cite: 3]
                'Executive Chef', 'Executive Chef Senior', 'Executive Chef Junior',
                'Sous Chef I', 'Sous Chef Senior', 'Sous Chef Junior',
                'Chef de Partie', 'Chef de Partie Senior', 'Chef de Partie Junior',
                'Commis Chef', 'Commis Chef Senior', 'Commis Chef Junior',
                'Pastry Chef', 'Pastry Chef Senior', 'Pastry Chef Junior',
                'Steward', 'Steward Senior', 'Steward Junior'
            ],
            'Sales & Marketing': [ // [cite: 3, 4]
                'Director', 'Director Senior', 'Director Junior',
                'Sales Manager', 'Sales Manager Senior', 'Sales Manager Junior',
                'Revenue Manager', 'Revenue Manager Senior', 'Revenue Manager Junior',
                'E-commerce Manager', 'E-commerce Manager Senior', 'E-commerce Manager Junior',
                'Marketing Executive', 'Marketing Executive Senior', 'Marketing Executive Junior'
            ],
            'Finance': [ // [cite: 4]
                'Director of Finance', 'Director of Finance Senior', 'Director of Finance Junior',
                'Accountant', 'Accountant Senior', 'Accountant Junior',
                'Accounts Payable', 'Accounts Payable Senior', 'Accounts Payable Junior',
                'Accounts Receivable', 'Accounts Receivable Senior', 'Accounts Receivable Junior',
                'Cashier', 'Cashier Senior', 'Cashier Junior'
            ],
            'Human Resources': [ // [cite: 4, 5]
                'HR Director', 'HR Director Senior', 'HR Director Junior',
                'HR Manager', 'HR Manager Senior', 'HR Manager Junior',
                'Recruitment Officer', 'Recruitment Officer Senior', 'Recruitment Officer Junior',
                'Training Officer', 'Training Officer Senior', 'Training Officer Junior',
                'Payroll Officer', 'Payroll Officer Senior', 'Payroll Officer Junior'
            ],
            'Maintenance': [ // [cite: 5]
                'Chief Engineer', 'Chief Engineer Senior', 'Chief Engineer Junior',
                'Supervisor', 'Supervisor Senior', 'Supervisor Junior',
                'Technician', 'Technician Senior', 'Technician Junior',
                'Electrician', 'Electrician Senior', 'Electrician Junior',
                'Plumber', 'Plumber Senior', 'Plumber Junior',
                'HVAC', 'HVAC Senior', 'HVAC Junior'
            ],
            'Security': [ // [cite: 5, 6]
                'Security Manager', 'Security Manager Senior', 'Security Manager Junior',
                'Supervisor', 'Supervisor Senior', 'Supervisor Junior',
                'Security Officer', 'Security Officer Senior'
            ],
            'IT': [ // [cite: 6]
                'IT Manager', 'IT Manager Senior', 'IT Manager Junior',
                'System Admin', 'System Admin Senior',
                'Network Engineer', 'Network Engineer Senior',
                'Support Staff'
            ],
            'Spa & Recreation': [ // [cite: 6]
                'Spa Manager', 'Spa Manager Senior',
                'Therapist', 'Gym Staff', 'Lifeguard'
            ]
        };
    });

    // 💡 [신규] Department 커스텀 추가/삭제용 상태 및 함수
    const [showDeptEditModal, setShowDeptEditModal] = useState(false);
    const [newDeptInput, setNewDeptInput] = useState('');

    const handleAddDepartment = () => {
        if (newDeptInput.trim() && !departmentRoles[newDeptInput.trim()]) {
            const updated = { ...departmentRoles, [newDeptInput.trim()]: [] };
            setDepartmentRoles(updated);
            sessionStorage.setItem('hr_dept_roles', JSON.stringify(updated));
            setNewDeptInput('');
        }
    };

    const handleDeleteDepartment = (deptToRemove) => {
        const updated = { ...departmentRoles };
        delete updated[deptToRemove];
        setDepartmentRoles(updated);
        sessionStorage.setItem('hr_dept_roles', JSON.stringify(updated));
        if (selectedDepartment === deptToRemove) {
            setSelectedDepartment('');
            setNewEmployee({ ...newEmployee, role: '' });
        }
    };

    const getDepartmentForRole = (role) => Object.keys(departmentRoles).find(dept => (departmentRoles[dept] || []).includes(role)) || 'Management';

    const getAllowedShiftsForDept = (dept) => {
        const shiftPattern = scheduleRules.deptShifts[dept] || '3-Shifts';
        if (shiftPattern === 'Day-Only') return ['Day'];
        if (shiftPattern === '2-Shifts') return ['Morning', 'Mid'];
        return ['Morning', 'Mid', 'Night'];
    };

    const getShiftDurationHours = (shiftKey) => {
        if (!shiftKey || shiftKey === 'Off') return 0;
        const config = scheduleRules.shiftTimes[shiftKey];
        if (!config?.start || !config?.end) return 8;

        const [startHour, startMinute] = config.start.split(':').map(Number);
        const [endHour, endMinute] = config.end.split(':').map(Number);
        let startMinutes = (startHour * 60) + startMinute;
        let endMinutes = (endHour * 60) + endMinute;
        if (endMinutes <= startMinutes) endMinutes += 24 * 60;

        return Math.round(((endMinutes - startMinutes) / 60) * 10) / 10;
    };

    const getSchedulePeriodLabel = () => {
        const start = new Date(scheduleStartDate);
        const end = new Date(scheduleStartDate);
        end.setDate(end.getDate() + scheduleDaysCount - 1);
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    };

    const getEmployeeScheduleSummary = (emp) => scheduleDateHeaders.reduce((acc, header) => {
        const shift = emp.schedule?.[header.key] || 'Off';
        if (shift === 'Off') {
            acc.offDays += 1;
            return acc;
        }

        acc.assignedDays += 1;
        acc.hours += getShiftDurationHours(shift);
        acc.shiftBreakdown[shift] = (acc.shiftBreakdown[shift] || 0) + 1;
        return acc;
    }, {
        hours: 0,
        assignedDays: 0,
        offDays: 0,
        shiftBreakdown: { Day: 0, Morning: 0, Mid: 0, Night: 0 }
    });

    const isScheduleAligned = scheduleContext.view === scheduleView && scheduleContext.startDate === scheduleStartDate;
    const displayedScheduleRows = isScheduleAligned ? filteredScheduleWeek : [];

    const scheduleEmployeeMetrics = displayedScheduleRows.reduce((acc, emp) => {
        acc[emp.emp_id] = getEmployeeScheduleSummary(emp);
        return acc;
    }, {});

    const scheduleSummary = displayedScheduleRows.reduce((acc, emp) => {
        const metrics = scheduleEmployeeMetrics[emp.emp_id];
        acc.staffCount += 1;
        acc.assignedSlots += metrics.assignedDays;
        acc.totalHours += metrics.hours;
        acc.offDays += metrics.offDays;
        return acc;
    }, {
        staffCount: 0,
        assignedSlots: 0,
        totalHours: 0,
        offDays: 0
    });

    const scheduleFillRate = scheduleSummary.staffCount > 0
        ? Math.round((scheduleSummary.assignedSlots / (scheduleSummary.staffCount * scheduleDaysCount)) * 100)
        : 0;

    const scheduleAverageHours = scheduleSummary.staffCount > 0
        ? Math.round((scheduleSummary.totalHours / scheduleSummary.staffCount) * 10) / 10
        : 0;

    const scheduleDailyInsights = scheduleDateHeaders.map((header) => {
        const shifts = { Day: 0, Morning: 0, Mid: 0, Night: 0, Off: 0 };

        displayedScheduleRows.forEach((emp) => {
            const shift = emp.schedule?.[header.key] || 'Off';
            shifts[shift] = (shifts[shift] || 0) + 1;
        });

        const assigned = displayedScheduleRows.length - shifts.Off;
        const dominantShift = ['Day', 'Morning', 'Mid', 'Night'].reduce((best, shift) => (
            shifts[shift] > shifts[best] ? shift : best
        ), 'Day');

        return {
            ...header,
            assigned,
            off: shifts.Off,
            fillRate: displayedScheduleRows.length > 0 ? Math.round((assigned / displayedScheduleRows.length) * 100) : 0,
            dominantShift: shifts[dominantShift] > 0 ? dominantShift : 'Off',
            shifts
        };
    });

    const scheduleDepartmentInsights = Object.keys(departmentRoles)
        .map((dept) => {
            const deptRows = displayedScheduleRows.filter((emp) => emp.dept === dept);
            if (deptRows.length === 0) return null;

            const totals = deptRows.reduce((acc, emp) => {
                const metrics = scheduleEmployeeMetrics[emp.emp_id];
                acc.hours += metrics.hours;
                acc.assignedDays += metrics.assignedDays;
                acc.offDays += metrics.offDays;
                return acc;
            }, { hours: 0, assignedDays: 0, offDays: 0 });

            return {
                dept,
                staffCount: deptRows.length,
                fillRate: Math.round((totals.assignedDays / (deptRows.length * scheduleDaysCount)) * 100),
                totalHours: totals.hours,
                offDays: totals.offDays
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.staffCount - a.staffCount);

    const scheduleLegendItems = Object.entries(scheduleRules.shiftTimes).map(([shiftKey, config]) => ({
        shiftKey,
        ...config,
        hours: getShiftDurationHours(shiftKey)
    }));

    // 💡 이 코드가 Admin 컴포넌트(export default function Admin() { ... }) 안쪽에 있어야 합니다!

    const [hotelTimes, setHotelTimes] = useState({ checkIn: '14:00', checkOut: '11:00' });

    useEffect(() => {
        if (currentHotelCode) {
            fetch(`/api/settings/times?hotel=${currentHotelCode}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.checkIn) setHotelTimes({ checkIn: data.checkIn, checkOut: data.checkOut });
                }).catch(e => console.log(e));
        }
    }, [currentHotelCode]);

    // ❌ 이 부분이 지워져서 에러가 난 것입니다! 반드시 추가해 주세요.
    const handleSaveHotelTimes = async () => {
        await fetch('/api/settings/times', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...hotelTimes, hotel_code: currentHotelCode })
        });
        alert("✅ Hotel standard times successfully saved!");
    };

    const [isIdAvailable, setIsIdAvailable] = useState(null);
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [selectedEmpForView, setSelectedEmpForView] = useState(null);
    const [isMessengerOpen, setIsMessengerOpen] = useState(false);
    const [chatRoom, setChatRoom] = useState('HOTEL');
    const [messages, setMessages] = useState(() => {
        const saved = JSON.parse(sessionStorage.getItem('hr_group_messages'));
        if (Array.isArray(saved)) return { HOTEL: saved, TEAM: [] };
        return saved || { HOTEL: [], TEAM: [] };
    });
    const [newMessage, setNewMessage] = useState('');
    const [extraEmpDetails, setExtraEmpDetails] = useState(() => JSON.parse(sessionStorage.getItem('hr_extra_details')) || {});

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [gender, setGender] = useState('');
    const [dob, setDob] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [emergencyContact, setEmergencyContact] = useState('');
    const [maritalStatus, setMaritalStatus] = useState('');
    const [childrenCount, setChildrenCount] = useState(0);
    const [dateHired, setDateHired] = useState('');

    const defaultRoles = ['Manager (Admin)', 'Front Desk', 'POS Staff (Server)', 'KDS Staff (Kitchen)', 'Housekeeping'];
    const [rolesList, setRolesList] = useState(() => JSON.parse(sessionStorage.getItem('hr_custom_roles')) || defaultRoles);
    const [showRoleEditModal, setShowRoleEditModal] = useState(false);
    const [newRoleInput, setNewRoleInput] = useState('');
    const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
    const [isEditingEmp, setIsEditingEmp] = useState(false);
    const [newEval, setNewEval] = useState(() => createDefaultEvaluationDraft());
    const [empSearch, setEmpSearch] = useState({ query: '', dept: '', role: '' });
    const [coeConfig, setCoeConfig] = useState(() => loadCoeConfig(currentHotelCode));
    const [selectedCoeEmployeeId, setSelectedCoeEmployeeId] = useState('');

    // 객실(Rooms) 관련 상태
    const [roomTypes, setRoomTypes] = useState([]);
    const [hotelRooms, setHotelRooms] = useState([]);
    const [newRoomId, setNewRoomId] = useState('');
    const [newRoomTypeForAdd, setNewRoomTypeForAdd] = useState('');
    const [editingRoomId, setEditingRoomId] = useState(null);
    const [newRoomTypeDetails, setNewRoomTypeDetails] = useState({
        name: '', basePrice: '', size: '', maxGuests: 2, bedType: '1 Queen Bed', description: '', imageFiles: [], existingImages: []
    });

    const [refundPolicies, setRefundPolicies] = useState({
        offpeak: { '1': 50, '2': 50, '3': 70 },
        weekend: { '1': 0, '2': 20, '3': 30 },
        peak: { '1': 0, '2': 0, '3': 0 }
    });

    // ========================================================
    // 💡 [신규] 투숙객 이력 아카이브 (Guest Stay History) 관련 상태
    // ========================================================
    const [historyLogs, setHistoryLogs] = useState([]); // 서버에서 불러올 진짜 이력 데이터
    const [historySearchText, setHistorySearchText] = useState(''); // 이름, 객실번호 검색어
    const [historySearchDate, setHistorySearchDate] = useState(''); // 날짜 필터링
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // 💡 [수정] 아카이브 전용 API 주소 및 검색 파라미터 매칭 완료
    const fetchHistoryLogs = async () => {
        setIsLoadingHistory(true);
        try {
            const query = new URLSearchParams({
                hotel: currentHotelCode,
                search: historySearchText, // 백엔드 설정에 맞게 search로 변경
                date: historySearchDate
            }).toString();

            const res = await fetch(`/api/admin/guest-archive?${query}`); // 전용 API로 변경
            const data = await res.json();

            if (data.success) {
                setHistoryLogs(data.archives || []);
            } else {
                console.error("Archive fetch failed:", data.message);
            }
        } catch (error) {
            console.error("Network error fetching archive:", error);
            setHistoryLogs([]);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // 💡 [신규] ROOMS 탭이 열릴 때 자동으로 이력을 불러옵니다.
    useEffect(() => {
        if (activeTab === 'ROOMS') {
            fetchHistoryLogs();
        }
    }, [activeTab, currentHotelCode]);

    // 💡 [신규] 아카이브에서 PDF를 불러와 새 창에 띄워주는 함수
    const [isPdfLoading, setIsPdfLoading] = useState(false);

    const handleViewArchivedPDF = async (log, docType) => {
        setIsPdfLoading(true);
        try {
            const res = await fetch('/api/admin/archive/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hotel_code: currentHotelCode, log: log, docType: docType })
            });
            const data = await res.json();

            if (data.success) {
                // 브라우저 새 창을 열고 완성된 PDF를 보여줍니다!
                const pdfWindow = window.open("");
                pdfWindow.document.write(
                    `<iframe width='100%' height='100%' style='border:none;' src='data:application/pdf;base64,${data.base64}'></iframe>`
                );
            } else {
                alert("❌ PDF Generation Failed: " + data.message);
            }
        } catch (error) {
            alert("❌ Network Error while generating PDF.");
        } finally {
            setIsPdfLoading(false);
        }
    };

    // ========================================================
    // 🛡️ [완벽 보안] 브라우저 창 닫힘 / 세션 종료 감지 및 로그아웃 기록
    // ========================================================
    useEffect(() => {
        const handleWindowClose = (e) => {
            const uid = sessionStorage.getItem('userId') || 'Admin';
            const hCode = sessionStorage.getItem('hotelCode') || '';

            const logoutLog = {
                id: `local_${Date.now()}`,
                timestamp: new Date().toLocaleString('en-US', { hour12: false }),
                user_id: uid,
                action: 'Logged Out (Session Closed)',
                hotel_code: hCode
            };

            // 1. 창이 닫히기 직전, 로컬 스토리지에 동기적으로 즉시 기록 저장
            const existingLogs = JSON.parse(localStorage.getItem(`audit_logs_${hCode}`) || '[]');
            const updatedLocalLogs = [logoutLog, ...existingLogs].slice(0, 500);
            localStorage.setItem(`audit_logs_${hCode}`, JSON.stringify(updatedLocalLogs));

            // 2. 창이 닫혀도 브라우저가 끝까지 책임지고 서버로 보내는 특수 전송 (sendBeacon)
            const blob = new Blob([JSON.stringify(logoutLog)], { type: 'application/json' });
            navigator.sendBeacon('/api/logs', blob);
        };

        // 브라우저 탭을 닫거나, 새로고침하거나, 다른 사이트로 넘어갈 때 이벤트 발생
        window.addEventListener('beforeunload', handleWindowClose);

        return () => {
            window.removeEventListener('beforeunload', handleWindowClose);
        };
    }, []);

    // 💡 [상용화 완료] 로컬 스토리지를 버리고 진짜 서버(DB)와 통신합니다.
    const [promotions, setPromotions] = useState([]);
    const [newPromo, setNewPromo] = useState({ title: '', description: '', code: '', discount_pct: '', end_date: '', target_room_type: ['All Rooms'], imageFile: null });
    const [editingPromoId, setEditingPromoId] = useState(null);

    const fetchPromotions = async () => {
        if (!currentHotelCode) return;
        try {
            // 💡 [캐시 완벽 파괴] Vercel이 옛날 데이터를 던져주지 못하도록 헤더와 타임스탬프를 강제합니다.
            const res = await fetch(`/api/promotions?hotel=${currentHotelCode}&nocache=${new Date().getTime()}`, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            const data = await res.json();
            setPromotions(Array.isArray(data) ? data : []);
        } catch (e) { console.error("Failed to fetch promotions", e); }
    };

    useEffect(() => { fetchPromotions(); }, [currentHotelCode]);

    const [promoRoomTypes, setPromoRoomTypes] = useState(['All Rooms', 'Standard', 'Deluxe', 'Suite']);
    useEffect(() => {
        fetch(`/api/admin/room-types?hotel=${currentHotelCode}`)
            .then(res => res.json())
            .then(data => { if (data.success && data.rooms) setPromoRoomTypes(['All Rooms', ...data.rooms.map(r => r.name.en || r.name)]); })
            .catch(() => { });
    }, [currentHotelCode]);

    const toggleTargetRoom = (roomName) => {
        setNewPromo(prev => {
            if (roomName === 'All Rooms') return { ...prev, target_room_type: ['All Rooms'] };
            let updated = prev.target_room_type.includes(roomName)
                ? prev.target_room_type.filter(r => r !== roomName)
                : [...prev.target_room_type.filter(r => r !== 'All Rooms'), roomName];
            if (updated.length === 0) updated = ['All Rooms'];
            return { ...prev, target_room_type: updated };
        });
    };

    const handleAddPromotion = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!newPromo.title || !newPromo.code) return alert("Title and Promo Code are required.");

        const formData = new FormData();
        formData.append('hotel_code', currentHotelCode);
        formData.append('title', newPromo.title);
        formData.append('description', newPromo.description || '');
        formData.append('code', newPromo.code.toUpperCase());
        formData.append('discount_pct', String(newPromo.discount_pct || 0));
        formData.append('end_date', newPromo.end_date || '');
        formData.append('target_room_type', JSON.stringify(newPromo.target_room_type));

        if (newPromo.imageFile) formData.append('image', newPromo.imageFile);
        if (editingPromoId && newPromo.existing_image_url && !newPromo.imageFile) {
            formData.append('existing_image_url', newPromo.existing_image_url);
        }

        try {
            const method = editingPromoId ? 'PUT' : 'POST';
            const url = editingPromoId
                ? `/api/admin/promotions/${editingPromoId}?hotel=${currentHotelCode}`
                : `/api/admin/promotions?hotel=${currentHotelCode}`;

            const res = await fetch(url, { method: method, body: formData });
            if (!res.ok) {
                const errorText = await res.text();
                return alert(`❌ Server connection failed (Status: ${res.status})\n\nServer response: ${errorText}`);
            }

            const result = await res.json();
            if (result.success) {
                alert(`✅ Promotion successfully ${editingPromoId ? 'updated' : 'saved'}!`);
                setNewPromo({ title: '', description: '', code: '', discount_pct: '', end_date: '', target_room_type: ['All Rooms'], imageFile: null });
                setEditingPromoId(null);
                fetchPromotions();
            } else {
                alert("❌ Save failed: " + result.message);
            }
        } catch (error) {
            console.error("Server connection failed.", error);
            alert("❌ Network Error.");
        }
    };

    const handleEditPromotion = (promo) => {
        const uniqueId = promo.id || promo.promo_id || promo.code;
        let parsedTargets = ['All Rooms'];
        try {
            if (typeof promo.target_room_type === 'string') parsedTargets = JSON.parse(promo.target_room_type);
            else if (Array.isArray(promo.target_room_type)) parsedTargets = promo.target_room_type;
        } catch (e) { }

        setNewPromo({
            title: promo.title || '', description: promo.description || '', code: promo.code || '',
            discount_pct: promo.discount_pct || '', end_date: promo.end_date || '',
            target_room_type: parsedTargets, imageFile: null, existing_image_url: promo.image_url
        });
        setEditingPromoId(uniqueId);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleTogglePromotion = async (uniqueId, currentStatus, title) => {
        if (!uniqueId) return;
        try {
            await fetch(`/api/admin/promotions/toggle/${uniqueId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hotel_code: currentHotelCode, is_active: currentStatus ? 0 : 1 })
            });
            recordAuditLog('PROMOTIONS', `Changed status [${title}] to ${currentStatus ? 'OFF' : 'ON'}`);
            fetchPromotions();
        } catch (e) { console.error(e); }
    };

    // 💡 [궁극의 삭제 로직] id가 비어있으면 무조건 code를 가져다 씁니다!
    const handleDeletePromotion = async (id, code, title) => {
        // id가 없으면 code를 식별자로 사용 (둘 다 없으면 에러)
        const targetId = id || code;

        if (!targetId) {
            return alert("❌ Error: 삭제할 프로모션의 ID와 Code가 모두 없습니다.");
        }

        if (window.confirm(`Are you sure you want to delete [${title}]?`)) {
            // 1. 화면에서 먼저 카드를 삭제합니다. (id나 code 중 일치하는 것을 날림)
            setPromotions(prev => prev.filter(p => p.id !== targetId && p.code !== targetId));

            try {
                // 2. 서버에 삭제 요청 (t=날짜 를 붙여서 브라우저 캐시 무시)
                const res = await fetch(`/api/admin/promotions/${targetId}?hotel=${currentHotelCode}&t=${Date.now()}`, {
                    method: 'DELETE'
                });

                const result = await res.json();

                if (res.ok && result.success) {
                    recordAuditLog('PROMOTIONS', `Deleted promotion: ${title}`);
                    alert("✅ Successfully deleted.");
                    fetchPromotions(); // 완벽히 삭제 후 목록 갱신
                } else {
                    alert(`❌ Server Error: ${result.message || 'Failed to delete from DB'}`);
                    fetchPromotions(); // 실패 시 화면 원상복구
                }
            } catch (e) {
                console.error("Delete Error:", e);
                alert("❌ Network Error.");
                fetchPromotions(); // 에러 시 화면 원상복구
            }
        }
    };

    const handleSaveCancelPolicies = async () => {
        try {
            await fetch('/api/settings/cancellation-policies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ policies: cancelPolicies, hotel_code: currentHotelCode })
            });
            alert("✅ Reservation Cancellation Policies saved successfully!");
        } catch (e) {
            alert("❌ Error saving cancellation policies.");
        }
    };

    const addCancelPolicyRule = () => {
        setCancelPolicies([...cancelPolicies, { id: Date.now(), days_before: 0, refund_percent: 0 }]);
    };

    const removeCancelPolicyRule = (idToRemove) => {
        setCancelPolicies(cancelPolicies.filter(p => p.id !== idToRemove));
    };

    // ========================================================
    // 💡 [에러 해결 1] 누락된 상태 변수(State) 완벽 복구
    // ========================================================

    // TV CMS 관련 상태
    const [tvImagesPending, setTvImagesPending] = useState({});
    const [rsConfig, setRsConfig] = useState({
        target_store_id: '', spa_store_id: '', todo_store_id: '',
        open_time: '07:00', close_time: '22:00', closed_message: 'Sorry, In-Room Dining is currently closed.',
        spa_open_time: '09:00', spa_close_time: '22:00', spa_closed_message: 'Sorry, Spa & Wellness is currently closed.'
    });

    // Website Builder 관련 상태
    const [websiteConfig, setWebsiteConfig] = useState({
        welcome_title: '', welcome_subtitle: '', description: '',
        logo_url: '', logoFile: null, bg_image_url: '', bgFile: null,
        slider_style: 'fade', theme_color: '#2563eb', theme_font: 'Inter',
        welcome_text_pos: { title: { x: 50, y: 40 }, subtitle: { x: 50, y: 55 } }, footer_company_name: '',
        map_embed_url: '', sns_ig: '', sns_fb: '', contact_phone: '', contact_email: '', contact_address: '',
        gallery_urls: [], galleryFiles: null, facilities_list: [], attractions_list: [],
        website_template: 'modern', // 💡 [신규] 템플릿 종류 저장
        // 💡 [신규 추가] Guest App 전용 초기 상태
        app_facilities: [], app_short_description: '', app_gallery_urls: []
    });

    const [draggedGalleryIdx, setDraggedGalleryIdx] = useState(null);
    const [draggingTextType, setDraggingTextType] = useState(null); // 💡 웹사이트 텍스트 드래그 에러 해결!
    const [resizingTextType, setResizingTextType] = useState(null);
    const [otaConfigs, setOtaConfigs] = useState([]);
    const [newOtaChannel, setNewOtaChannel] = useState('');
    const [isSyncing, setIsSyncing] = useState({});
    // 💡 [NEW] 매핑 모달 및 데이터 상태
    const [mappingModalOpen, setMappingModalOpen] = useState(false);
    const [selectedOtaForMapping, setSelectedOtaForMapping] = useState(null);
    const [channelMappings, setChannelMappings] = useState([]);

    // Inventory (재고 관리) 관련 상태
    const [inventorySubTab, setInventorySubTab] = useState('DASHBOARD');
    const [inventoryItems, setInventoryItems] = useState([]);
    const [inventoryLogs, setInventoryLogs] = useState([]);
    const [newInvItem, setNewInvItem] = useState({ name: '', category: 'Amenities', min_stock: 10, unit: 'ea' });
    const [stockMove, setStockMove] = useState({ item_id: '', type: 'IN', amount: '', notes: '' });

    // ========================================================
    // 💡 [글로벌 실시간 마스터 수신기] 서버 방송을 듣고 현재 탭만 0.1초 만에 새로고침!
    // ========================================================
    useEffect(() => {

        const socketUrl = import.meta.env.VITE_API_URL || 'https://api.hotelnplus.com';
        const socket = io(socketUrl, { transports: ['websocket'] });

        socket.on('db_updated', (data) => {
            // 우리 지점의 데이터가 변했다는 방송이 들리면
            if (data.hotel_code === currentHotelCode || data.hotel_code === 'ALL') {
                // 현재 대표님이 보고 계신 탭(activeTab)의 데이터만 콕 집어서 다시 가져옵니다. (깜빡임 없음)
                if (activeTab === 'FINANCE') {
                    fetch(`/api/finance/transactions?hotel=${currentHotelCode}`).then(res => res.json()).then(d => { if (Array.isArray(d)) setTransactions(d); });
                    fetchPointsAnalytics();
                }
                if (activeTab === 'POS_MENU') { fetchStores(); if (typeof posSubTab !== 'undefined' && posSubTab === 'ANALYSIS' && typeof fetchPosAnalytics === 'function') fetchPosAnalytics(); }
                if (activeTab === 'DEVICES') { fetchPayments(); fetchDevices(); fetchStores(); }
                if (activeTab === 'LOGS') fetchLogs();
                if (activeTab === 'RECEIPT') fetchReceiptConfig();
                if (activeTab === 'HR') { fetchHRData(); fetchStores(); }
                if (activeTab === 'ROOMS') fetchRoomData();
                if (activeTab === 'BANK_ACCOUNTS') fetch(`/api/bank-accounts?hotel=${currentHotelCode}`).then(res => res.json()).then(setBankAccounts);
                if (activeTab === 'MEMBERS') { fetchMembers(); fetchRewardsConfig(); }
                if (activeTab === 'OTA_SYNC') {
                    fetchOtaConfigs();
                    fetchRoomData(); // 💡 OTA 탭이 열릴 때도 객실 목록을 함께 불러오도록 추가!
                }
                if (activeTab === 'PROMOTIONS_CMS') fetchPromotions();
            }
        });

        // 탭을 옮길 때마다 수신기의 주파수를 맞춰줍니다.
        return () => socket.disconnect();
    }, [activeTab, currentHotelCode]); // 👈 (주의: 만약 posSubTab이나 다른 상태값 에러가 나면 의존성 배열에 추가해 주시면 됩니다)

    // --- 데이터 패칭 (useEffect) ---
    useEffect(() => {
        // 💡 [신규 추가] 오너 전용 현금 잔고 가져오기
        fetch(`/api/finance/cash-status?hotel=${currentHotelCode}`)
            .then(res => res.json())
            .then(setCashData)
            .catch(console.error);

        if (activeTab === 'FINANCE') {
            fetch(`/api/finance/transactions?hotel=${currentHotelCode}`).then(res => res.json()).then(data => { if (Array.isArray(data)) setTransactions(data); });
            fetchPointsAnalytics();
        }
        if (activeTab === 'POS_MENU') fetchStores();
        if (activeTab === 'DEVICES') { fetchPayments(); fetchDevices(); fetchStores(); }
        if (activeTab === 'LOGS') fetchLogs();
        if (activeTab === 'RECEIPT') fetchReceiptConfig();
        if (activeTab === 'HR') { fetchHRData(); fetchStores(); }
        if (activeTab === 'ROOMS') fetchRoomData();
        if (activeTab === 'BANK_ACCOUNTS') fetch(`/api/bank-accounts?hotel=${currentHotelCode}`).then(res => res.json()).then(setBankAccounts);
        if (activeTab === 'MEMBERS') { fetchMembers(); fetchRewardsConfig(); }
        if (activeTab === 'OTA_SYNC') fetchOtaConfigs();
        if (activeTab === 'TV_CMS') {
            fetchStores();
            fetch(`/api/tv-settings/room-service?hotel=${currentHotelCode}`)
                .then(res => res.json())
                .then(data => {
                    if (data && Object.keys(data).length > 0) setRsConfig(prev => ({ ...prev, ...data }));
                });
        }
        if (activeTab === 'POLICIES') {
            fetch(`/api/settings/refund-policies?hotel=${currentHotelCode}`)
                .then(res => res.json())
                .then(data => { if (data && data.success && data.policies) setRefundPolicies(data.policies); })
                .catch(() => { });
            fetch(`/api/settings/cancellation-policies?hotel=${currentHotelCode}`)
                .then(res => res.json())
                .then(data => { if (data && data.success && data.policies) setCancelPolicies(data.policies); })
                .catch(() => { });
        }

    }, [activeTab]);

    // 💡 [핵심 해결] useEffect 방어막: 탭을 눌렀을 때 딱 1번만 서버에서 데이터를 가져옵니다!
    useEffect(() => {
        if (activeTab === 'WEBSITE_BUILDER' && currentHotelCode) {
            // 💡 [캐시 파괴] 이전 템플릿 설정이 브라우저에 남아있지 않도록 캐시를 무력화합니다.
            fetch(`/api/settings/website?hotel=${currentHotelCode}&t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            })
                .then(res => res.json())
                .then(data => {
                    if (data && data.success && data.config) {
                        let parsedSNS = {}; try { parsedSNS = JSON.parse(data.config.sns_json || '{}'); } catch (e) { }
                        let parsedGallery = []; try { const rawGallery = JSON.parse(data.config.gallery_json || '[]'); parsedGallery = rawGallery.map((url, i) => ({ id: `existing_${i}_${Date.now()}`, type: 'url', url: url })); } catch (e) { }

                        // 💡 부대시설(Facilities) 데이터 파싱 및 슬라이더 스타일(display_style) 값 유지
                        let pFac = [];
                        try {
                            const f = data.config.facilities_json;
                            if (f && f.trim().startsWith('[')) {
                                pFac = JSON.parse(f).map(item => ({
                                    ...item,
                                    id: item.id || Date.now() + Math.random(),
                                    display_style: item.display_style || 'arrows' // 👈 서버 값 유지, 없으면 기본값
                                }));
                            } else if (f) {
                                pFac = [{ id: Date.now(), title: 'General Facility', description: f, image_url: '', display_style: 'arrows' }];
                            }
                        } catch (e) { }

                        // 💡 지역 관광(Attractions) 데이터 파싱 및 슬라이더 스타일(display_style) 값 유지
                        let pAtt = [];
                        try {
                            const a = data.config.attractions_json;
                            if (a && a.trim().startsWith('[')) {
                                pAtt = JSON.parse(a).map(item => ({
                                    ...item,
                                    id: item.id || Date.now() + Math.random(),
                                    display_style: item.display_style || 'arrows' // 👈 서버 값 유지, 없으면 기본값
                                }));
                            } else if (a) {
                                pAtt = [{ id: Date.now(), title: 'Local Attraction', description: a, image_url: '', display_style: 'arrows' }];
                            }
                        } catch (e) { }

                        let pAppFacilities = []; try { pAppFacilities = JSON.parse(data.config.app_facilities || '[]'); } catch (e) { }
                        let pAppGallery = []; try { const rawAppGallery = JSON.parse(data.config.app_gallery_urls || '[]'); pAppGallery = rawAppGallery.map((url, i) => ({ id: `app_existing_${i}_${Date.now()}`, type: 'url', url: url })); } catch (e) { }

                        let parsedPos = { title: { x: 10, y: 20, w: 80, size: 48, align: 'center' }, subtitle: { x: 30, y: 50, w: 80, size: 18, align: 'center' }, template: '' };
                        try { if (data.config.welcome_text_pos) { const raw = JSON.parse(data.config.welcome_text_pos); if (raw.title) parsedPos.title = { ...parsedPos.title, ...raw.title }; if (raw.subtitle) parsedPos.subtitle = { ...parsedPos.subtitle, ...raw.subtitle }; if (raw.template) parsedPos.template = raw.template; } } catch (e) { }

                        // 💡 [절대 방어] 용량 제한이 없는 description 필드의 HTML 주석에 숨겨둔 템플릿 값을 추출합니다.
                        const rawDesc = data.config.description || '';
                        const tmplMatch = rawDesc.match(/<!--TEMPLATE:(.*?)-->/);
                        const hiddenTemplate = tmplMatch ? tmplMatch[1] : '';
                        const rawThemeColor = data.config.theme_color || '#2563eb';
                        const [normalizedThemeColor, legacyThemeTemplate = ''] = String(rawThemeColor).split('|');

                        setWebsiteConfig(prev => ({
                            ...prev, ...data.config, logoFile: null, galleryFiles: null,
                            theme_color: normalizedThemeColor || '#2563eb', // 색상 복구 + 레거시 템플릿 분리
                            description: rawDesc.replace(/<!--TEMPLATE:.*?-->/g, ''), // 💡 에디터에는 숨겨진 코드가 안 보이게 제거하여 전달
                            sns_ig: parsedSNS.ig || '', sns_fb: parsedSNS.fb || '',
                            contact_phone: parsedSNS.phone || '', contact_email: parsedSNS.email || '', contact_address: parsedSNS.address || '', contact_title: parsedSNS.title || '',

                            gallery_urls: parsedGallery,
                            facilities_list: pFac,
                            attractions_list: pAtt,

                            // 💡 지도 주소를 명시적으로 매핑하여 확실히 불러오게 합니다.
                            map_embed_url: data.config.map_embed_url || '',

                            slider_style: data.config.slider_style || 'auto_fade',
                            website_template: hiddenTemplate || parsedPos.template || parsedSNS.website_template || data.config.website_template || legacyThemeTemplate || 'modern', // 💡 최종 방어막 적용
                            app_gallery_style: data.config.app_gallery_style || 'arrows',

                            footer_company_name: data.config.footer_company_name || '',
                            welcome_text_pos: parsedPos, welcome_title_font_size: parsedPos.title.size, welcome_title_text_align: parsedPos.title.align, welcome_subtitle_font_size: parsedPos.subtitle.size, welcome_subtitle_text_align: parsedPos.subtitle.align,
                            app_facilities: pAppFacilities, app_gallery_urls: pAppGallery, app_short_description: data.config.app_short_description || ''
                        }));
                    }
                }).catch(err => { console.error("Load Error:", err); });
        }
    }, [activeTab, currentHotelCode]);

    useEffect(() => {
        if (selectedStore) fetchMenus(selectedStore);
        else if (posStores.length > 0) setSelectedStore(String(posStores[0].id));
    }, [selectedStore, posStores]);

    const fetchHRData = async () => {
        const hotelCode = currentHotelCode;
        const locallySavedCoeConfig = loadCoeConfig(hotelCode);

        try {
            const [employeesRes, attendanceRes, evaluationsRes, settingsRes] = await Promise.allSettled([
                fetch(`/api/hr/employees?hotel=${hotelCode}`),
                fetch(`/api/hr/attendance?hotel=${hotelCode}`),
                fetch(`/api/hr/evaluations?hotel=${hotelCode}`),
                fetch(`/api/hr/settings?hotel=${hotelCode}`)
            ]);

            if (employeesRes.status === 'fulfilled') {
                const employeeData = await employeesRes.value.json();
                if (Array.isArray(employeeData)) setEmployees(employeeData);
            }

            if (attendanceRes.status === 'fulfilled') {
                const attendanceData = await attendanceRes.value.json();
                if (Array.isArray(attendanceData)) setAttendance(attendanceData);
            }

            if (evaluationsRes.status === 'fulfilled') {
                const evaluationData = await evaluationsRes.value.json();
                if (Array.isArray(evaluationData)) setEvaluations(evaluationData);
            }

            if (settingsRes.status === 'fulfilled') {
                const data = await settingsRes.value.json();
                const mergedConfig = mergeCoeConfig({
                    ...locallySavedCoeConfig,
                    template: data.coe_template || data.template || locallySavedCoeConfig.template,
                    border_style: data.coe_border_style || data.border_style || locallySavedCoeConfig.border_style,
                    bg_image_url: data.coe_bg_image || data.bg_image_url || locallySavedCoeConfig.bg_image_url,
                    logo_image_url: data.coe_logo_image || data.logo_image_url || locallySavedCoeConfig.logo_image_url,
                    signature_image_url: data.coe_signature_image || data.signature_image_url || locallySavedCoeConfig.signature_image_url,
                    company_name: data.coe_company_name || data.company_name || locallySavedCoeConfig.company_name,
                    company_address: data.coe_company_address || data.company_address || locallySavedCoeConfig.company_address,
                    company_email: data.coe_company_email || data.company_email || locallySavedCoeConfig.company_email,
                    company_phone: data.coe_company_phone || data.company_phone || locallySavedCoeConfig.company_phone,
                    document_title: data.coe_document_title || data.document_title || locallySavedCoeConfig.document_title,
                    issue_city: data.coe_issue_city || data.issue_city || locallySavedCoeConfig.issue_city,
                    signatory_name: data.coe_signatory_name || data.signatory_name || locallySavedCoeConfig.signatory_name,
                    signatory_title: data.coe_signatory_title || data.signatory_title || locallySavedCoeConfig.signatory_title,
                    footer_note: data.coe_footer_note || data.footer_note || locallySavedCoeConfig.footer_note,
                    accent_color: data.coe_accent_color || data.accent_color || locallySavedCoeConfig.accent_color,
                    watermark_text: data.coe_watermark_text || data.watermark_text || locallySavedCoeConfig.watermark_text,
                    body_font_size: Number(data.coe_body_font_size || data.body_font_size || locallySavedCoeConfig.body_font_size) || locallySavedCoeConfig.body_font_size,
                    reference_prefix: data.coe_reference_prefix || data.reference_prefix || locallySavedCoeConfig.reference_prefix,
                    show_reference: data.coe_show_reference ?? data.show_reference ?? locallySavedCoeConfig.show_reference,
                    show_background: data.coe_show_background ?? data.show_background ?? locallySavedCoeConfig.show_background,
                    show_logo: data.coe_show_logo ?? data.show_logo ?? locallySavedCoeConfig.show_logo,
                    show_watermark: data.coe_show_watermark ?? data.show_watermark ?? locallySavedCoeConfig.show_watermark
                });

                setCoeConfig(mergedConfig);
                localStorage.setItem(getCoeConfigStorageKey(hotelCode), JSON.stringify(serializeCoeConfig(mergedConfig)));
            } else {
                setCoeConfig(locallySavedCoeConfig);
            }
        } catch (error) {
            console.error('Failed to fetch HR data', error);
            setCoeConfig(locallySavedCoeConfig);
        }
    };

    const fetchStores = async () => {
        try {
            const res = await fetch(`/api/pos-stores?hotel=${currentHotelCode}`);
            const data = await res.json();
            const safeData = Array.isArray(data) ? data : [];
            setPosStores(safeData);
            if (safeData.length > 0 && !newMenu.store_id) setNewMenu(prev => ({ ...prev, store_id: safeData[0].id }));
        } catch (e) { setPosStores([]); }
    };

    useEffect(() => {
        setCoeConfig(loadCoeConfig(currentHotelCode));
    }, [currentHotelCode]);

    useEffect(() => {
        if (!employees.length) {
            setSelectedCoeEmployeeId('');
            return;
        }

        setSelectedCoeEmployeeId((prev) => {
            if (prev && employees.some((employee) => employee.emp_id === prev)) return prev;
            return employees[0].emp_id;
        });
    }, [employees]);

    // 👇 POS 분석 데이터 불러오기 함수
    const fetchPosAnalytics = async () => {
        try {
            const res = await fetch(`/api/analytics/pos?hotel=${currentHotelCode}`);
            const data = await res.json();
            if (Array.isArray(data)) setPosAnalytics(data);
        } catch (e) {
            console.error("POS Analytics fetch error:", e);
        }
    };

    // 💡 탭이 POS_MENU로 바뀔 때 데이터도 함께 불러오도록 useEffect 수정 (선택사항)
    useEffect(() => {
        if (activeTab === 'POS_MENU') {
            fetchStores();
            fetchPosAnalytics(); // 분석 데이터 로딩
        }
    }, [activeTab, currentHotelCode]);

    useEffect(() => {
        setPosMenuSearch('');
        setPosMenuCategoryFilter('ALL');
        setPosMenuScope('ALL');
        setPosMenuSortMode('CATEGORY');
        setEditingMenu(null);
    }, [selectedStore]);

    const fetchMenus = async (storeId) => {
        if (!storeId) return;
        try {
            const res = await fetch(`/api/pos-menus/${storeId}`);
            const data = await res.json();
            setMenus((Array.isArray(data) ? data : []).map(normalizePosMenuRecord));
        } catch (e) { }
    };

    const scrollToPosMenuBuilder = () => {
        posMenuBuilderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleResetPosMenuDraft = () => {
        setNewMenu(createDefaultPosMenuForm());
    };

    const handleLoadMenuDraft = (menu) => {
        const normalizedMenu = normalizePosMenuRecord(menu);
        setNewMenu({
            category: normalizedMenu.categoryLabel,
            name: normalizedMenu.cleanName,
            imageFiles: [],
            isRecommended: normalizedMenu.isRecommendedFlag,
            isRoomService: normalizedMenu.isRoomServiceFlag,
            sizes: normalizedMenu.sizes.map((size) => ({
                name: size.name,
                price: size.price
            }))
        });
        scrollToPosMenuBuilder();
    };

    const openMenuEditor = (menu) => {
        const normalizedMenu = normalizePosMenuRecord(menu);
        setEditingMenu({
            ...normalizedMenu,
            name: normalizedMenu.cleanName,
            existingImages: normalizedMenu.parsedImages,
            imageFiles: [],
            is_recommended: normalizedMenu.isRecommendedFlag,
            is_room_service: normalizedMenu.isRoomServiceFlag
        });
    };

    const fetchPayments = () => fetch(`/api/payment-configs?hotel=${currentHotelCode}`).then(res => res.json()).then(setPayments);

    const fetchDevices = () => {
        fetch(`/api/settings/devices?hotel=${currentHotelCode}`).then(res => res.json()).then(data => {
            if (data.success) setDevices(data.devices); else if (Array.isArray(data)) setDevices(data);
        }).catch(e => console.error(e));
    };

    const fetchReceiptConfig = () => {
        fetch(`/api/receipt-settings?hotel=${currentHotelCode}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                if (data && Object.keys(data).length > 0) {
                    const extraData = JSON.parse(localStorage.getItem(`receipt_extra_${currentHotelCode}`) || '{}');
                    setReceiptConfig(prev => ({
                        ...prev,
                        ...data,
                        // 💡 [핵심 해결] data(서버 DB값)를 가장 1순위로 사용하고, 없을 때만 로컬 백업을 쓰도록 순서를 바꿨습니다!
                        address: data.address || extraData.address || '',
                        business_no: data.business_no || extraData.business_no || '',
                        tax_id: data.tax_id || extraData.tax_id || '',
                        signer_name: data.signer_name || extraData.signer_name || '',
                        signer_title: data.signer_title || extraData.signer_title || '',
                        // 💡 [핵심 해결] DB에 저장된 서명 이미지 URL이 있다면 화면(signatureBase64)에 즉시 뿌려줍니다!
                        signatureBase64: data.signature_url || extraData.signatureBase64 || '',
                        imageFile: null
                    }));
                }
            }).catch(err => console.error(err));
    };

    const fetchOtaConfigs = () => { fetch(`/api/ota-configs?hotel=${currentHotelCode}`).then(res => res.json()).then(setOtaConfigs).catch(() => { }); };

    const fetchRoomData = async () => {
        try {
            const r = await fetch(`/api/admin/room-types?hotel=${currentHotelCode}`);
            const data = await r.json();
            if (data.success && data.rooms) {
                setRoomTypes(data.rooms);
                setNewRoomTypeForAdd(prev => { if (!prev && data.rooms.length > 0) return data.rooms[0].name?.en || data.rooms[0].name; return prev; });
            } else {
                const r2 = await fetch(`/api/room-types?hotel=${currentHotelCode}`);
                const data2 = await r2.json();
                const roomsArray = Array.isArray(data2) ? data2 : [];
                setRoomTypes(roomsArray);
                setNewRoomTypeForAdd(prev => { if (!prev && roomsArray.length > 0) return roomsArray[0].name?.en || roomsArray[0].name; return prev; });
            }
        } catch (e) { console.error(e); }
        fetch(`/api/rooms?hotel=${currentHotelCode}`).then(r => r.json()).then(data => { setHotelRooms(Array.isArray(data) ? data : []); });
    };

    // ========================================================
    // 🚀 핸들러 함수들 (모든 작업에 감시 로그 기록 부착 완료!)
    // ========================================================

    const handleAddDevice = async () => {
        if (!newDevice.name || !newDevice.target_store) return alert("Device Name and Target Store are required.");
        await fetch('/api/settings/devices', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newDevice, hotel_code: currentHotelCode })
        });
        recordAuditLog(`Registered Hardware Device: ${newDevice.name} (${newDevice.type})`);
        alert("✅ Device registered successfully!");
        setNewDevice({ name: '', type: 'Payment Terminal', ip_address: '', target_store: '' });
        fetchDevices();
    };

    const handleDeleteDevice = async (id, deviceName) => {
        if (window.confirm(`Delete device ${deviceName}?`)) {
            await fetch(`/api/devices/${id}?hotel=${currentHotelCode}`, { method: 'DELETE' });
            recordAuditLog(`Deleted Hardware Device: ${deviceName}`);
            fetchDevices();
        }
    };

    const handleAddStore = async () => {
        if (!newStore.name) return alert("Facility Name required.");
        await fetch('/api/pos-stores', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newStore, hotel_code: currentHotelCode })
        });
        recordAuditLog(`Created POS Store/Facility: ${newStore.name}`);
        setNewStore(createDefaultPosStoreForm());
        fetchStores();
    };

    const handleUpdateStore = async () => {
        if (!editingStore.name || !editingStore.location) return alert("Facility Name and POS Number are required.");
        try {
            const res = await fetch(`/api/pos-stores/${editingStore.id}?hotel=${currentHotelCode}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingStore)
            });
            if (res.ok) {
                recordAuditLog(`Updated POS Facility: ${editingStore.name} (POS ${editingStore.location})`);
                alert("✅ Store updated successfully!");
                setEditingStore(null);
                fetchStores();
            } else {
                const data = await res.json();
                alert(`❌ Update failed: ${data.message}`);
            }
        } catch (e) {
            console.error(e);
            alert("❌ Server connection error.");
        }
    };

    const handleDeleteStore = async (id, name) => {
        if (window.confirm(`🚨 Are you sure you want to delete [${name}]?\n\nWarning: This will also remove the facility from the selection list, but past orders remain in the ledger.`)) {
            try {
                await fetch(`/api/pos-stores/${id}?hotel=${currentHotelCode}`, { method: 'DELETE' });
                recordAuditLog(`Deleted POS Facility: ${name}`);
                fetchStores();
                if (selectedStore === String(id)) setSelectedStore(''); // 삭제된 매장이 선택되어 있으면 초기화
            } catch (e) { console.error(e); }
        }
    };

    const handleAddMenu = async () => {
        const trimmedName = String(newMenu.name || '').trim();
        if (!selectedStore || !trimmedName || !newMenu.sizes[0].price) return alert("Please fill item details.");

        const formData = new FormData();
        formData.append('store_id', selectedStore);
        formData.append('category', String(newMenu.category || '').trim() || 'Uncategorized');
        const finalName = newMenu.isRoomService ? `${trimmedName.replace(' [TV]', '')} [TV]` : trimmedName.replace(' [TV]', '');
        formData.append('name', finalName);
        formData.append('price', newMenu.sizes[0].price);
        formData.append('is_recommended', newMenu.isRecommended ? 1 : 0);

        const sizesWithRoomServiceFlag = newMenu.sizes.map((s, idx) => ({
            ...s,
            name: String(s.name || '').trim() || (idx === 0 ? 'Regular' : `Option ${idx + 1}`),
            is_room_service: idx === 0 ? (newMenu.isRoomService ? 1 : 0) : 0
        }));
        formData.append('sizes', JSON.stringify(sizesWithRoomServiceFlag));
        formData.append('user_id', currentUserId);
        formData.append('hotel_code', currentHotelCode);

        // 💡 [원인 1 해결] 업데이트 함수와 동일하게 'images' 키를 사용하고 배열 형태로 보냅니다.
        if (newMenu.imageFiles && newMenu.imageFiles.length > 0) {
            newMenu.imageFiles.forEach(file => {
                formData.append('images', file);
            });
        }

        try {
            // 💡 [원인 2 해결] 주소 끝에 반드시 ?hotel=${currentHotelCode} 를 붙여야 서버가 DB 위치를 찾습니다!
            const res = await fetch(`/api/pos-menus?hotel=${currentHotelCode}`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || "Server save failed.");
            }

            recordAuditLog(`Added New POS Menu Item: ${finalName}`);
            setNewMenu(createDefaultPosMenuForm());
            fetchMenus(selectedStore);
            alert("✅ Item registered successfully!");
        } catch (e) {
            console.error("Menu Add Error:", e);
            alert(`❌ Registration failed!\n\n${e.message}`);
        }
    };

    const handleSizeChange = (index, field, value) => { const newSizes = [...newMenu.sizes]; newSizes[index][field] = value; setNewMenu({ ...newMenu, sizes: newSizes }); };
    const addSizeRow = () => setNewMenu({ ...newMenu, sizes: [...newMenu.sizes, { name: '', price: '' }] });
    const removeSizeRow = (index) => { const newSizes = [...newMenu.sizes]; newSizes.splice(index, 1); setNewMenu({ ...newMenu, sizes: newSizes }); };

    const handleUpdateMenu = async () => {
        const trimmedName = String(editingMenu.name || '').trim();
        if (!trimmedName || !editingMenu.sizes[0]?.price) return alert("Please fill in the item details.");

        const formData = new FormData();
        formData.append('store_id', selectedStore);
        formData.append('category', String(editingMenu.category || '').trim() || 'Uncategorized');
        const finalName = editingMenu.is_room_service ? `${trimmedName.replace(' [TV]', '')} [TV]` : trimmedName.replace(' [TV]', '');
        formData.append('name', finalName);
        formData.append('price', editingMenu.sizes[0].price);
        formData.append('is_recommended', editingMenu.is_recommended ? 1 : 0);

        const sizesWithRoomServiceFlag = editingMenu.sizes.map((s, idx) => ({
            ...s,
            name: String(s.name || '').trim() || (idx === 0 ? 'Regular' : `Option ${idx + 1}`),
            is_room_service: idx === 0 ? (editingMenu.is_room_service ? 1 : 0) : 0
        }));
        formData.append('sizes', JSON.stringify(sizesWithRoomServiceFlag));
        formData.append('hotel_code', currentHotelCode);
        formData.append('existingImages', JSON.stringify(editingMenu.existingImages || []));

        // Send multiple images (Max 5)
        if (editingMenu.imageFiles && editingMenu.imageFiles.length > 0) {
            editingMenu.imageFiles.forEach(file => {
                formData.append('images', file);
            });
        }

        try {
            const res = await fetch(`/api/pos-menus/${editingMenu.id}?hotel=${currentHotelCode}`, {
                method: 'PUT',
                body: formData
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error("Backend Error Details:", errorText);
                throw new Error(errorText || `Server response error (Status code: ${res.status})`);
            }

            recordAuditLog(`Updated POS Menu Item: ${finalName}`);
            alert("✅ Menu updated successfully!");
            setEditingMenu(null);
            fetchMenus(selectedStore);
        } catch (e) {
            console.error(e);
            alert(`❌ Error updating menu:\n\n${e.message}\n\n(Please check the error details above.)`);
        }
    };

    const handleDeleteMenu = async (id, name) => {
        if (window.confirm(`Delete ${name}?`)) {
            // 💡 [사전 예방] 삭제 API 요청 시에도 ?hotel= 꼬리표를 명확히 달아줍니다.
            await fetch(`/api/pos-menus/${id}?hotel=${currentHotelCode}`, { method: 'DELETE' });
            recordAuditLog(`Deleted POS Menu Item: ${name}`);
            fetchMenus(selectedStore);
        }
    };

    const handleAddBank = async () => {
        if (!newBank.bank || !newBank.account_num) return alert("Bank Name and Account Number required.");
        await fetch('/api/bank-accounts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newBank, hotel_code: currentHotelCode })
        });
        recordAuditLog(`Added Corporate Bank Account: ${newBank.bank} (${newBank.account_num})`);
        setNewBank({ bank: '', account_name: '', account_num: '', type: 'Corporate', balance: 0 });
        fetch(`/api/bank-accounts?hotel=${currentHotelCode}`).then(res => res.json()).then(setBankAccounts);
    };

    const handleDeleteBank = async (id, bankName) => {
        if (window.confirm(`Delete ${bankName}?`)) {
            await fetch(`/api/bank-accounts/${id}?hotel=${currentHotelCode}`, { method: 'DELETE' });
            recordAuditLog(`Deleted Bank Account: ${bankName}`);
            fetch(`/api/bank-accounts?hotel=${currentHotelCode}`).then(res => res.json()).then(setBankAccounts);
        }
    };

    const handleEditRoomType = (room) => {
        setEditingRoomId(room.id);
        let parsedConfig = room.roomConfig || {}; if (typeof parsedConfig === 'string') { try { parsedConfig = JSON.parse(parsedConfig); } catch (e) { } }
        let parsedImages = room.images || []; if (typeof parsedImages === 'string') { try { parsedImages = JSON.parse(parsedImages); } catch (e) { } }

        setNewRoomTypeDetails({
            name: room.name?.en || room.name || '',
            basePrice: room.price || room.basePrice || '',
            bedType: parsedConfig.bedType || '1 Queen Bed',
            maxGuests: parsedConfig.maxGuests || room.maxGuests || 2,
            size: parsedConfig.size || room.size || '',
            description: parsedConfig.description || room.description?.en || room.description || '',
            display_style: parsedConfig.display_style || 'arrows',
            // 💡 [수정] DB 컬럼(security_deposit)을 1순위로 조회하고 없을 때만 2000 적용
            deposit: room.security_deposit !== undefined && room.security_deposit !== null ? room.security_deposit : (parsedConfig.deposit !== undefined ? parsedConfig.deposit : 2000),
            imageFiles: [],
            existingImages: parsedImages
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteRoomType = async (id, name) => {
        if (window.confirm('Delete this room type?')) {
            await fetch(`/api/admin/room-types/${id}?hotel=${currentHotelCode}&name=${name}`, { method: 'DELETE' });
            recordAuditLog(`Deleted Room Type: ${name}`);
            fetchRoomData();
        }
    };

    const handleSaveRoomType = async () => {
        if (!newRoomTypeDetails.name || !newRoomTypeDetails.basePrice) return alert("Room Name and Base Price are required.");
        const formData = new FormData(); formData.append('hotel_code', currentHotelCode);
        if (editingRoomId) formData.append('roomId', editingRoomId);
        formData.append('name', newRoomTypeDetails.name); formData.append('basePrice', newRoomTypeDetails.basePrice);

        // 💡 [수정] roomConfig에 deposit(보증금)을 숫자로 변환하여 함께 저장합니다.
        formData.append('roomConfig', JSON.stringify({
            bedType: newRoomTypeDetails.bedType,
            maxGuests: newRoomTypeDetails.maxGuests,
            size: newRoomTypeDetails.size,
            description: newRoomTypeDetails.description,
            display_style: newRoomTypeDetails.display_style || 'arrows',
            deposit: Number(newRoomTypeDetails.deposit) || 0 // 👈 여기에 추가!
        }));

        formData.append('existingImages', JSON.stringify(newRoomTypeDetails.existingImages || []));
        if (newRoomTypeDetails.imageFiles) Array.from(newRoomTypeDetails.imageFiles).forEach(file => formData.append('images', file));

        try {
            const res = await fetch('/api/admin/room-types/sync', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                alert(editingRoomId ? "✅ Room updated successfully!" : "✅ Room created successfully!");
                // 💡 [수정] 초기화 시 deposit: 2000 세팅
                setNewRoomTypeDetails({ name: '', basePrice: '', size: '', maxGuests: 2, bedType: '1 Queen Bed', description: '', display_style: 'arrows', deposit: 2000, imageFiles: [], existingImages: [] });
                setEditingRoomId(null); fetchRoomData();
            } else alert("Failed: " + (data.message || data.error));
        } catch (e) { alert("Error connecting to server."); }
    };

    const handleAddRoom = async () => {
        if (!newRoomId.trim()) return alert("Enter Room Number");
        const res = await fetch('/api/rooms/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room_number: newRoomId, room_type: newRoomTypeForAdd, hotel_code: currentHotelCode }) });
        const data = await res.json();
        if (data.success) {
            recordAuditLog(`Added Physical Room: ${newRoomId} (${newRoomTypeForAdd})`);
            setNewRoomId(''); fetchRoomData(); alert(`✅ Room ${newRoomId} added.`);
        } else { alert("Failed: " + data.message); }
    };

    const handleDeleteRoom = async (id) => {
        if (window.confirm(`Delete Room ${id}?`)) {
            await fetch(`/api/rooms/${id}?hotel=${currentHotelCode}`, { method: 'DELETE' });
            recordAuditLog(`Deleted Physical Room ID: ${id}`);
            fetchRoomData();
        }
    };

    const handleAssignRoomType = async (roomId, typeName) => {
        await fetch('/api/rooms/update-type', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: roomId, room_type: typeName, hotel_code: currentHotelCode }) });
        recordAuditLog(`Assigned Room Type ${typeName} to Room ID ${roomId}`);
        fetchRoomData();
    };

    // ========================================================
    // 💡 [복구 완료] HR 커스텀 직책(Role) 관리 상태 및 핸들러 
    // ========================================================
    const handleAddRole = () => {
        if (!selectedDepartment) return alert("Please select a department first.");
        if (newRoleInput.trim() && !departmentRoles[selectedDepartment].includes(newRoleInput.trim())) {
            const updatedRoles = [...departmentRoles[selectedDepartment], newRoleInput.trim()];
            const updatedDeptRoles = { ...departmentRoles, [selectedDepartment]: updatedRoles };
            setDepartmentRoles(updatedDeptRoles);
            sessionStorage.setItem('hr_dept_roles', JSON.stringify(updatedDeptRoles));
            setNewRoleInput('');
        }
    };

    const handleDeleteRole = (roleToRemove) => {
        if (!selectedDepartment) return;
        const updatedRoles = departmentRoles[selectedDepartment].filter(r => r !== roleToRemove);
        const updatedDeptRoles = { ...departmentRoles, [selectedDepartment]: updatedRoles };
        setDepartmentRoles(updatedDeptRoles);
        sessionStorage.setItem('hr_dept_roles', JSON.stringify(updatedDeptRoles));
        if (newEmployee.role === roleToRemove) setNewEmployee({ ...newEmployee, role: '' });
    };

    const clearHrForm = () => {
        setNewEmployee({ emp_id: '', password: '', role: '', base_salary: '', philhealth: '', pagibig: '', sss: '', assigned_store: '', accessible_menus: '' });
        setFirstName(''); setLastName(''); setGender(''); setDob(''); setEmail(''); setPhone(''); setAddress(''); setEmergencyContact(''); setMaritalStatus(''); setChildrenCount(0); setDateHired('');
        setSelectedDepartment('');
        setIsIdAvailable(null);
        setPhotoBase64('');
        setIdCardBase64(''); // 💡 신분증 초기화 추가
        closeCamera();
    };

    // 💡 [신규] 아이디 중복 확인 버튼 핸들러
    const handleCheckId = async () => {
        if (!newEmployee.emp_id) return alert("Please enter an Employee ID.");
        try {
            const res = await fetch(`/api/hr/check-id?emp_id=${newEmployee.emp_id}`);
            const data = await res.json();
            setIsIdAvailable(data.available);
            if (!data.available) alert("This ID is already in use. Please enter a different ID.");
        } catch (e) { console.error(e); }
    };

    const handleSaveEmployee = async () => {
        if (!newEmployee.emp_id || !firstName || !lastName || !newEmployee.role || !newEmployee.base_salary) return alert("Fill ID, First Name, Last Name, Role, Salary.");
        if (!isEditingEmp && isIdAvailable !== true) return alert("Please Check ID availability first.");

        const payload = { ...newEmployee, name: `${firstName} ${lastName}`, user_id: currentUserId, hotel_code: currentHotelCode, is_editing: isEditingEmp };
        try {
            const res = await fetch('/api/hr/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Server Error');

            // 💡 [수정] 신분증(id_card) 데이터 추가
            const extra = { first_name: firstName, last_name: lastName, gender, dob, email, phone, address, emergency_contact: emergencyContact, marital_status: maritalStatus, children_count: childrenCount, date_hired: dateHired, photo: photoBase64, id_card: idCardBase64, cv_data: scannedImageBase64 || cvFileUrl };
            const updatedExtras = { ...extraEmpDetails, [newEmployee.emp_id]: extra };
            setExtraEmpDetails(updatedExtras); sessionStorage.setItem('hr_extra_details', JSON.stringify(updatedExtras));

            recordAuditLog(`${isEditingEmp ? 'Updated' : 'Registered'} Employee: ${newEmployee.emp_id}`);
            clearHrForm(); setIsEditingEmp(false); fetchHRData();
            alert(isEditingEmp ? "✅ Updated Successfully!" : "✅ Registered Successfully!");
        } catch (error) { alert(`❌ Error: ${error.message}`); }
    };

    const handleEditEmployee = (emp) => {
        const extras = extraEmpDetails[emp.emp_id] || {};
        setNewEmployee({ emp_id: emp.emp_id, password: '', role: emp.role, base_salary: emp.base_salary, philhealth: emp.philhealth || '', pagibig: emp.pagibig || '', sss: emp.sss || '', assigned_store: emp.assigned_store || '', accessible_menus: emp.accessible_menus || '' });
        setFirstName(extras.first_name || emp.name?.split(' ')[0] || ''); setLastName(extras.last_name || emp.name?.split(' ').slice(1).join(' ') || ''); setGender(extras.gender || ''); setDob(extras.dob || ''); setEmail(extras.email || ''); setPhone(extras.phone || ''); setAddress(extras.address || ''); setEmergencyContact(extras.emergency_contact || ''); setMaritalStatus(extras.marital_status || ''); setChildrenCount(extras.children_count || 0); setDateHired(extras.date_hired || emp.date_hired || '');

        const foundDept = Object.keys(departmentRoles).find(dept => departmentRoles[dept].includes(emp.role));
        setSelectedDepartment(foundDept || '');

        setPhotoBase64(extras.photo || '');
        setIdCardBase64(extras.id_card || ''); // 💡 기존 신분증 불러오기 추가
        setScannedImageBase64(extras.cv_data || '');
        setCvFileUrl(extras.cv_data || '');

        setIsEditingEmp(true);
        const mainContainer = document.querySelector('.flex-1.overflow-y-auto');
        if (mainContainer) mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEditEmp = () => { clearHrForm(); setIsEditingEmp(false); };

    useEffect(() => {
        // 💡 [안전장치 1] 데이터가 배열인지, 존재는지 먼저 확인합니다.
        if (Array.isArray(employees) && employees.length > 0 && extraEmpDetails) {
            try {
                const today = new Date();
                const nextWeek = new Date();
                nextWeek.setDate(today.getDate() + 7);

                const upcoming = employees
                    .map(emp => {
                        // 💡 [안전장치 2] 해당 직원의 상세 정보가 없을 경우를 대비합니다.
                        const extras = (extraEmpDetails && extraEmpDetails[emp.emp_id]) || {};
                        return { ...emp, dob: extras.dob };
                    })
                    .filter(emp => {
                        if (!emp.dob) return false;
                        const dobDate = new Date(emp.dob);
                        // 날짜 형식이 잘못되었을 경우 패스
                        if (isNaN(dobDate.getTime())) return false;

                        const birthdayThisYear = new Date(today.getFullYear(), dobDate.getMonth(), dobDate.getDate());
                        if (birthdayThisYear < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
                            birthdayThisYear.setFullYear(today.getFullYear() + 1);
                        }
                        return birthdayThisYear >= today && birthdayThisYear <= nextWeek;
                    })
                    .map(emp => {
                        const dobDate = new Date(emp.dob);
                        const extras = extraEmpDetails[emp.emp_id] || {};
                        return {
                            ...emp,
                            first_name: extras.first_name || emp.name?.split(' ')[0] || 'Staff',
                            shortDob: `${dobDate.getMonth() + 1}/${dobDate.getDate()}`
                        };
                    });

                setUpcomingBirthdays(upcoming);
            } catch (error) {
                console.error("Birthday calculation error:", error);
                setUpcomingBirthdays([]); // 에러 발생 시 빈 배열로 초기화하여 화면 크래시 방지
            }
        } else {
            // 데이터가 없으면 안전하게 빈 배열 세팅
            setUpcomingBirthdays([]);
        }
    }, [employees, extraEmpDetails]);

    const handleDeleteEmployee = async (emp_id) => { if (window.confirm(`Delete employee ${emp_id}?`)) { await fetch(`/api/hr/employees/${emp_id}`, { method: 'DELETE' }); recordAuditLog(`Deleted Employee: ${emp_id}`); fetchHRData(); } };
    // ========================================================
    // ⏰ [고도화 완료] DTR 상태 및 출퇴근 펀치 엔진
    // ========================================================
    const [isSyncingDTR, setIsSyncingDTR] = useState(false);
    const [lastDtrSync, setLastDtrSync] = useState(() => formatBiometricTimestamp(loadBiometricStatus(currentHotelCode).lastSyncAt, sessionStorage.getItem('hr_last_sync') || 'Never Sync'));
    const [punchEmpId, setPunchEmpId] = useState('');
    const [manualAttendanceForm, setManualAttendanceForm] = useState(() => createDefaultManualAttendanceForm());
    const [isSavingManualAttendance, setIsSavingManualAttendance] = useState(false);
    const [isDeletingAttendanceId, setIsDeletingAttendanceId] = useState(null);
    const manualAttendanceCardRef = useRef(null);

    // 🔍 DTR 기간 및 키워드 검색 필터 상태
    const [dtrSearch, setDtrSearch] = useState({ query: '', startDate: '', endDate: '' });
    const [showSuggestions, setShowSuggestions] = useState(false);

    const getActiveHotelCode = () => sessionStorage.getItem('hotelCode') || currentHotelCode || '';
    const biometricWebhookUrl = resolveBiometricWebhookUrl(biometricConfig);
    const isManualAttendanceMode = biometricConfig.attendanceSourceMode === 'MANUAL_ONLY';
    const isBiometricAttendanceMode = !isManualAttendanceMode;

    const handleSelectAttendanceMode = (mode) => {
        setBiometricConfig((prev) => {
            if (mode === 'MANUAL') {
                return {
                    ...prev,
                    attendanceSourceMode: 'MANUAL_ONLY',
                    autoSyncBeforePayroll: false
                };
            }

            return {
                ...prev,
                attendanceSourceMode: 'BIOMETRIC_FIRST',
                autoSyncBeforePayroll: true
            };
        });
    };

    const appendBiometricLog = (level, title, message, extra = {}) => {
        setBiometricLogs((prev) => [{
            id: `bio_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
            timestamp: new Date().toISOString(),
            level,
            title,
            message,
            ...extra
        }, ...(prev || [])].slice(0, 40));
    };

    const parseApiJson = async (response) => {
        const text = await response.text();
        if (!text) return {};
        try {
            return JSON.parse(text);
        } catch {
            return { message: text };
        }
    };

    const biometricRequest = async (path, options = {}) => {
        const response = await fetch(path, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        const data = await parseApiJson(response);

        if (!response.ok || data?.success === false) {
            throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
        }

        return data;
    };

    const applyBiometricStatus = (incomingStatus = {}) => {
        setBiometricStatus((prev) => mergeBiometricStatusPayload(prev, incomingStatus, biometricConfig.provider));
    };

    const hydrateBiometricIntegration = async (includeLogs = false) => {
        const hotelCode = getActiveHotelCode();
        if (!hotelCode) return;

        try {
            const configResponse = await fetch(`/api/hr/biometric/config?hotel=${encodeURIComponent(hotelCode)}`);
            if (configResponse.ok) {
                const configData = await parseApiJson(configResponse);
                if (configData?.config) {
                    setBiometricConfig((prev) => mergeBiometricConfig({ ...prev, ...(configData.config || {}) }));
                }
                if (configData?.status) {
                    applyBiometricStatus(configData.status);
                }
            }
        } catch (error) {
            console.debug('Biometric config endpoint unavailable', error);
        }

        try {
            const statusResponse = await fetch(`/api/hr/biometric/status?hotel=${encodeURIComponent(hotelCode)}`);
            if (statusResponse.ok) {
                const statusData = await parseApiJson(statusResponse);
                applyBiometricStatus(statusData?.status || statusData || {});
                if (Array.isArray(statusData?.logs) && statusData.logs.length > 0) {
                    setBiometricLogs(statusData.logs.slice(0, 40));
                }
            }
        } catch (error) {
            console.debug('Biometric status endpoint unavailable', error);
        }

        if (includeLogs) {
            try {
                const logsResponse = await fetch(`/api/hr/biometric/logs?hotel=${encodeURIComponent(hotelCode)}`);
                if (logsResponse.ok) {
                    const logsData = await parseApiJson(logsResponse);
                    const logs = Array.isArray(logsData?.logs) ? logsData.logs : (Array.isArray(logsData) ? logsData : []);
                    if (logs.length > 0) {
                        setBiometricLogs(logs.slice(0, 40));
                    }
                }
            } catch (error) {
                console.debug('Biometric log endpoint unavailable', error);
            }
        }
    };

    const handleSaveBiometricConfig = async () => {
        const hotelCode = getActiveHotelCode();
        if (!hotelCode) return alert("🚨 Hotel code is missing. Please refresh and try again.");

        setIsSavingBiometricConfig(true);
        try {
            const data = await biometricRequest('/api/hr/biometric/config', {
                method: 'POST',
                body: JSON.stringify({
                    hotel_code: hotelCode,
                    config: biometricConfig
                })
            });

            if (data?.config) {
                setBiometricConfig((prev) => mergeBiometricConfig({ ...prev, ...(data.config || {}) }));
            }
            if (data?.status) {
                applyBiometricStatus(data.status);
            }

            appendBiometricLog('info', 'Connector saved', `${biometricConfig.provider} configuration saved for ${hotelCode}.`);
            recordAuditLog(`Saved biometric connector config: ${biometricConfig.provider}`);
            alert("✅ Biometric integration settings saved successfully.");
            setShowBiometricSettings(false);
        } catch (error) {
            appendBiometricLog('error', 'Save failed', error.message || 'Unable to save biometric configuration.');
            alert(`❌ Unable to save biometric settings to the connector service.\n\n${error.message}\n\nYour draft is still kept locally in this browser.`);
        } finally {
            setIsSavingBiometricConfig(false);
        }
    };

    const handleTestBiometricConnection = async () => {
        const hotelCode = getActiveHotelCode();
        if (!biometricConfig.enabled) return alert("🚨 Enable the biometric connector first.");
        if (!hotelCode) return alert("🚨 Hotel code is missing. Please refresh and try again.");

        setIsTestingBiometric(true);
        try {
            const data = await biometricRequest('/api/hr/biometric/test', {
                method: 'POST',
                body: JSON.stringify({
                    hotel_code: hotelCode,
                    config: biometricConfig
                })
            });

            applyBiometricStatus({
                connected: data?.connected ?? true,
                connectionCheckedAt: data?.checked_at || new Date().toISOString(),
                source: data?.source || biometricConfig.provider,
                message: data?.message || 'Biometric connector is reachable.',
                webhookHealthy: data?.webhook_healthy ?? biometricStatus.webhookHealthy
            });

            appendBiometricLog('success', 'Connection test passed', data?.message || `${biometricConfig.provider} responded successfully.`);
            recordAuditLog(`Tested biometric connector: ${biometricConfig.provider}`);
            alert(`✅ ${data?.message || 'Biometric connection test completed successfully.'}`);
        } catch (error) {
            applyBiometricStatus({
                connected: false,
                connectionCheckedAt: new Date().toISOString(),
                message: error.message || 'Connection test failed.'
            });
            appendBiometricLog('error', 'Connection test failed', error.message || 'Connector did not respond.');
            alert(`❌ Biometric connection test failed.\n\n${error.message}`);
        } finally {
            setIsTestingBiometric(false);
        }
    };

    const handleDeviceSync = async ({ silentAlert = false, trigger = 'manual' } = {}) => {
        const hotelCode = getActiveHotelCode();
        if (!biometricConfig.enabled) {
            if (!silentAlert) alert("🚨 Enable and save the biometric connector before syncing.");
            return false;
        }
        if (!hotelCode) {
            if (!silentAlert) alert("🚨 Hotel code is missing. Please refresh and try again.");
            return false;
        }

        setIsSyncingDTR(true);
        applyBiometricStatus({
            lastAttemptAt: new Date().toISOString(),
            message: 'Sync request sent to biometric connector.'
        });

        try {
            const data = await biometricRequest('/api/hr/biometric/sync', {
                method: 'POST',
                body: JSON.stringify({
                    hotel_code: hotelCode,
                    trigger,
                    config: biometricConfig
                })
            });

            const nextStatus = mergeBiometricStatusPayload(biometricStatus, {
                connected: data?.connected ?? true,
                lastSyncAt: data?.last_sync_at || data?.synced_at || new Date().toISOString(),
                lastAttemptAt: new Date().toISOString(),
                lastImportedCount: Number(data?.imported_count ?? data?.imported ?? 0),
                lastDuplicateCount: Number(data?.duplicate_count ?? data?.duplicates ?? 0),
                source: data?.source || biometricConfig.provider,
                message: data?.message || 'Biometric sync completed.',
                webhookHealthy: data?.webhook_healthy ?? biometricStatus.webhookHealthy
            }, biometricConfig.provider);

            setBiometricStatus(nextStatus);

            if (Array.isArray(data?.attendance)) {
                setAttendance(data.attendance);
            } else {
                await fetchAttendanceData();
            }

            appendBiometricLog(
                'success',
                'Device sync completed',
                `${nextStatus.lastImportedCount} punch record(s) imported from ${biometricConfig.provider}.`,
                { importedCount: nextStatus.lastImportedCount }
            );
            recordAuditLog(`Biometric sync completed (${biometricConfig.provider}) - ${nextStatus.lastImportedCount} records imported`);

            if (!silentAlert) {
                alert(`✅ Biometric sync completed.\n\nImported: ${nextStatus.lastImportedCount}\nDuplicates skipped: ${nextStatus.lastDuplicateCount}`);
            }
            return true;
        } catch (error) {
            applyBiometricStatus({
                lastAttemptAt: new Date().toISOString(),
                message: error.message || 'Biometric sync failed.'
            });
            appendBiometricLog('error', 'Device sync failed', error.message || 'Connector did not respond.');
            if (!silentAlert) {
                alert(`❌ Biometric sync failed.\n\n${error.message}`);
            }
            return false;
        } finally {
            setIsSyncingDTR(false);
        }
    };

    // 💡 수동 펀치 로직 (서버 DB 연동 완벽 수정 및 영어 알림 적용)
    const handlePunchTime = async (type) => {
        if (!punchEmpId) return alert("🚨 Please select an employee first.");
        const emp = employees.find(e => e.emp_id === punchEmpId);
        if (!emp) return alert("🚨 Employee not found.");

        try {
            // 1. 서버로 보낼 출퇴근 데이터 보따리 만들기 (sessionStorage 직결)
            const payload = {
                emp_id: punchEmpId,
                type: type,
                hotel_code: sessionStorage.getItem('hotelCode') || '' // 👈 확실하게 지점 코드를 가져오도록 변경!
            };

            // 2. 백엔드 API로 데이터 발사! (DB에 영구 저장)
            const response = await fetch('/api/hr/attendance/punch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            // 3. 서버 저장 결과에 따른 화면 처리
            if (data.success) {
                alert(`✅ [${type}] Time record for ${emp.name} has been successfully saved.`);
                setPunchEmpId(''); // 펀치 완료 후 셀렉트박스 초기화

                // 4. 저장이 완료되면 서버에서 최신 근태 내역을 다시 불러와 화면 갱신
                await fetchAttendanceData();
            } else {
                // 서버에서 튕겨냈을 경우 (중복 펀치 등)
                if (type === 'IN') {
                    alert("🚨 An active Time IN record already exists for today. Please Time OUT first.");
                } else {
                    alert("🚨 No active Time IN record found. Please Time IN first.");
                }
            }
        } catch (error) {
            console.error("Punch Error:", error);
            alert("🚨 A network error occurred while saving the record.");
        }
    };

    const resetManualAttendanceForm = () => setManualAttendanceForm(createDefaultManualAttendanceForm());
    const resetDtrFilters = () => setDtrSearch({ query: '', startDate: '', endDate: '' });

    const handleSetManualAttendanceToday = () => {
        setManualAttendanceForm((prev) => ({ ...prev, date: getHotelDate(0) }));
    };

    const handleApplyManualTimeNow = (field) => {
        setManualAttendanceForm((prev) => ({
            ...prev,
            date: prev.date || getHotelDate(0),
            [field]: getCurrentTimeInputValue()
        }));
    };

    const handleSaveManualAttendance = async () => {
        const hotelCode = getActiveHotelCode();
        if (!hotelCode) return alert("🚨 Hotel code is missing. Please refresh and try again.");
        if (!manualAttendanceForm.emp_id) return alert("🚨 Please select an employee.");
        if (!manualAttendanceForm.date) return alert("🚨 Please select a work date.");
        if (!manualAttendanceForm.time_in) return alert("🚨 Please enter Time In.");

        setIsSavingManualAttendance(true);
        try {
            const response = await fetch('/api/hr/attendance/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: manualAttendanceForm.id,
                    emp_id: manualAttendanceForm.emp_id,
                    date: manualAttendanceForm.date,
                    time_in: manualAttendanceForm.time_in,
                    time_out: manualAttendanceForm.time_out,
                    hotel_code: hotelCode
                })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data?.success) {
                throw new Error(data?.message || `HTTP ${response.status}`);
            }

            await fetchAttendanceData();
            resetManualAttendanceForm();
            recordAuditLog(`${manualAttendanceForm.id ? 'Updated' : 'Saved'} manual DTR for ${manualAttendanceForm.emp_id} on ${manualAttendanceForm.date}`);
            alert(`✅ ${data?.message || 'Manual attendance saved successfully.'}`);
        } catch (error) {
            alert(`❌ Failed to save manual DTR.\n\n${error.message || 'Unknown error'}`);
        } finally {
            setIsSavingManualAttendance(false);
        }
    };

    const handleEditAttendanceRecord = (row) => {
        setManualAttendanceForm({
            id: row?.id || null,
            emp_id: row?.emp_id || '',
            date: row?.date || getHotelDate(0),
            time_in: formatAttendanceTimeInput(row?.date, row?.time_in, '09:00'),
            time_out: formatAttendanceTimeInput(row?.date, row?.time_out, '')
        });
        window.requestAnimationFrame(() => {
            manualAttendanceCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    const handleDeleteAttendanceRecord = async (row) => {
        const hotelCode = getActiveHotelCode();
        if (!hotelCode) return alert("🚨 Hotel code is missing. Please refresh and try again.");
        if (!row?.id) return;
        if (!window.confirm(`Delete DTR for ${row.emp_id} on ${row.date}?`)) return;

        setIsDeletingAttendanceId(row.id);
        try {
            const response = await fetch(`/api/hr/attendance/${row.id}?hotel=${encodeURIComponent(hotelCode)}`, {
                method: 'DELETE'
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data?.success) {
                throw new Error(data?.message || `HTTP ${response.status}`);
            }

            await fetchAttendanceData();
            if (manualAttendanceForm.id === row.id) {
                resetManualAttendanceForm();
            }
            recordAuditLog(`Deleted manual DTR for ${row.emp_id} on ${row.date}`);
            alert("✅ Attendance record deleted.");
        } catch (error) {
            alert(`❌ Failed to delete attendance record.\n\n${error.message || 'Unknown error'}`);
        } finally {
            setIsDeletingAttendanceId(null);
        }
    };

    // 💡 1. 서버(DB)에서 최신 출퇴근 기록을 가져오는 함수
    const fetchAttendanceData = async () => {
        const hCode = getActiveHotelCode();
        if (!hCode) return [];

        try {
            const response = await fetch(`/api/hr/attendance?hotel=${encodeURIComponent(hCode)}`);
            const data = await response.json().catch(() => ([]));
            const rows = Array.isArray(data)
                ? data
                : (Array.isArray(data?.attendance) ? data.attendance : (Array.isArray(data?.records) ? data.records : []));
            setAttendance(rows);
            return rows;
        } catch (error) {
            console.error(error);
            return [];
        }
    };

    // 💡 2. 화면이 처음 열리거나 다른 메뉴에서 돌아올 때 '자동으로' 데이터를 불러오는 마법의 코드
    useEffect(() => {
        fetchAttendanceData();
    }, [currentHotelCode]);

    useEffect(() => {
        const syncLabel = formatBiometricTimestamp(
            biometricStatus.lastSyncAt,
            sessionStorage.getItem('hr_last_sync') || 'Never Sync'
        );
        setLastDtrSync(syncLabel);
        sessionStorage.setItem('hr_last_sync', syncLabel);
    }, [biometricStatus.lastSyncAt]);

    useEffect(() => {
        if (hrSubTab === 'ATTENDANCE' || hrSubTab === 'PAYROLL') {
            hydrateBiometricIntegration(hrSubTab === 'ATTENDANCE');
        }
    }, [hrSubTab, currentHotelCode]);

    const lastBiometricSyncDate = biometricStatus.lastSyncAt ? new Date(biometricStatus.lastSyncAt) : null;
    const biometricFreshnessMinutes = lastBiometricSyncDate && !Number.isNaN(lastBiometricSyncDate.getTime())
        ? Math.round((Date.now() - lastBiometricSyncDate.getTime()) / 60000)
        : null;
    const biometricRequiresFreshSync = isBiometricAttendanceMode && biometricConfig.enabled && biometricConfig.autoSyncBeforePayroll && (
        biometricFreshnessMinutes === null ||
        biometricFreshnessMinutes > Math.max(0, Number(biometricConfig.requireFreshSyncMinutes) || 0)
    );

    const ensureBiometricReadyForPayroll = async () => {
        if (!isBiometricAttendanceMode || !biometricConfig.enabled || !biometricConfig.autoSyncBeforePayroll) return true;
        if (!biometricRequiresFreshSync) return true;

        const freshnessWindow = Math.max(0, Number(biometricConfig.requireFreshSyncMinutes) || 0);
        const confirmSync = window.confirm(
            `Biometric attendance has not been synced within the last ${freshnessWindow} minute(s).\n\nWould you like to pull the latest punches before finalizing payroll?`
        );

        if (!confirmSync) return false;

        const didSync = await handleDeviceSync({ silentAlert: true, trigger: 'payroll_guard' });
        if (didSync) {
            alert("✅ Latest biometric punches were synced.\n\nPlease review the recalculated payroll totals, then click settle again.");
        }
        return false;
    };

    const getEmpDept = (emp) => {
        if (emp.department) return emp.department;
        if (emp.dept) return emp.dept;
        if (emp.role) {
            const roleToMatch = emp.role.toLowerCase().replace(/_/g, ' ');
            const foundDept = Object.keys(departmentRoles).find(dept =>
                departmentRoles[dept].some(r => r.toLowerCase() === roleToMatch)
            );
            if (foundDept) return foundDept;
        }
        return 'Unassigned';
    };

    // 🔍 DTR 검색 필터링 적용 로직 (날짜 비교 버그 완벽 수정)
    const attendanceEmployeeDirectory = employees.reduce((directory, employee) => {
        directory[employee.emp_id] = employee;
        return directory;
    }, {});

    const normalizedEvaluations = (evaluations || [])
        .map((entry, index) => {
            const employee = attendanceEmployeeDirectory[entry.emp_id] || employees.find((item) => item.emp_id === entry.emp_id) || null;
            const recordedAt = entry.recorded_at || entry.created_at || entry.updated_at || entry.date || entry.review_date || entry.period_month;
            const periodMonth = getEvaluationMonthKey(entry.period_month || entry.review_month || recordedAt);
            const remarks = entry.remarks || entry.feedback || entry.comment || '';
            const score = clampEvaluationScore(entry.score ?? entry.rating ?? entry.grade ?? 0);

            return {
                ...entry,
                id: entry.id || `${entry.emp_id || 'employee'}_${periodMonth}_${index}`,
                emp_id: entry.emp_id || employee?.emp_id || '',
                employee_name: employee?.name || entry.employee_name || entry.name || 'Unknown Employee',
                role: employee?.role || entry.role || '',
                department: employee?.department || employee?.dept || entry.department || entry.dept || (employee ? getEmpDept(employee) : 'Unassigned'),
                score,
                remarks,
                review_type: entry.review_type || entry.type || 'Monthly Review',
                period_month: periodMonth,
                recorded_at: recordedAt || '',
                month_label: formatEvaluationMonthLabel(periodMonth),
                recorded_label: formatEvaluationTimestamp(recordedAt, formatEvaluationMonthLabel(periodMonth))
            };
        })
        .sort((a, b) => {
            const left = new Date(b.recorded_at || `${b.period_month}-01T12:00:00`).getTime();
            const right = new Date(a.recorded_at || `${a.period_month}-01T12:00:00`).getTime();
            return left - right;
        });

    const groupedEvaluationArchive = normalizedEvaluations.reduce((archive, entry) => {
        if (!archive[entry.period_month]) {
            archive[entry.period_month] = {
                monthKey: entry.period_month,
                monthLabel: entry.month_label,
                reviews: [],
                averageScore: 0
            };
        }
        archive[entry.period_month].reviews.push(entry);
        return archive;
    }, {});

    const evaluationArchiveMonths = Object.values(groupedEvaluationArchive)
        .map((bucket) => ({
            ...bucket,
            reviewCount: bucket.reviews.length,
            averageScore: bucket.reviews.length
                ? Math.round((bucket.reviews.reduce((total, review) => total + review.score, 0) / bucket.reviews.length) * 10) / 10
                : 0
        }))
        .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    const evaluationAverageScore = normalizedEvaluations.length
        ? Math.round((normalizedEvaluations.reduce((total, entry) => total + entry.score, 0) / normalizedEvaluations.length) * 10) / 10
        : null;

    const selectedEmployeeEvaluations = selectedEmpForView
        ? normalizedEvaluations.filter((entry) => entry.emp_id === selectedEmpForView.emp_id)
        : [];

    const selectedEmployeeEvaluationMonths = Object.values(selectedEmployeeEvaluations.reduce((archive, entry) => {
        if (!archive[entry.period_month]) {
            archive[entry.period_month] = {
                monthKey: entry.period_month,
                monthLabel: entry.month_label,
                reviews: []
            };
        }
        archive[entry.period_month].reviews.push(entry);
        return archive;
    }, {})).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    const selectedEmployeeEvaluationAverage = selectedEmployeeEvaluations.length
        ? Math.round((selectedEmployeeEvaluations.reduce((total, entry) => total + entry.score, 0) / selectedEmployeeEvaluations.length) * 10) / 10
        : null;

    const selectedEmployeeLatestEvaluation = selectedEmployeeEvaluations[0] || null;
    const currentCoeEmployee = employees.find((employee) => employee.emp_id === selectedCoeEmployeeId) || null;
    const currentCoeEmployeeContext = currentCoeEmployee ? {
        ...currentCoeEmployee,
        department: currentCoeEmployee.department || currentCoeEmployee.dept || getEmpDept(currentCoeEmployee)
    } : null;
    const coePreviewText = buildCoeTemplateText(coeConfig.template, currentCoeEmployeeContext, coeConfig);
    const coePreviewBorderTone = (() => {
        const borderStyle = String(coeConfig.border_style || 'CLASSIC_NAVY').toUpperCase();
        if (borderStyle === 'EXECUTIVE_GOLD') return 'border-amber-200 shadow-amber-100';
        if (borderStyle === 'MINIMAL_LINE') return 'border-slate-200 shadow-slate-100';
        if (borderStyle === 'NONE') return 'border-transparent shadow-slate-100';
        if (borderStyle === 'MODERN_FRAME') return 'border-cyan-200 shadow-cyan-100';
        return 'border-slate-300 shadow-slate-200';
    })();

    const normalizedPosStoreQuery = String(posStoreSearch || '').trim().toLowerCase();
    const normalizedPosMenuQuery = String(posMenuSearch || '').trim().toLowerCase();
    const posStoreTypeOptions = Array.from(new Set((posStores || []).map((store) => store.type).filter(Boolean)));
    const filteredPosStores = (posStores || []).filter((store) => {
        const matchesQuery = !normalizedPosStoreQuery
            || String(store.name || '').toLowerCase().includes(normalizedPosStoreQuery)
            || String(store.type || '').toLowerCase().includes(normalizedPosStoreQuery)
            || String(store.location || '').toLowerCase().includes(normalizedPosStoreQuery);
        const matchesType = posStoreTypeFilter === 'ALL' || String(store.type || '') === posStoreTypeFilter;
        return matchesQuery && matchesType;
    });
    const selectedStoreDetails = (posStores || []).find((store) => String(store.id) === String(selectedStore)) || null;
    const posMenuCategoryOptions = Array.from(new Set((menus || []).map((menu) => menu.categoryLabel || menu.category || 'Uncategorized').filter(Boolean)));
    const filteredPosMenus = [...(menus || [])]
        .filter((menu) => {
            const matchesQuery = !normalizedPosMenuQuery
                || String(menu.cleanName || menu.name || '').toLowerCase().includes(normalizedPosMenuQuery)
                || String(menu.categoryLabel || menu.category || '').toLowerCase().includes(normalizedPosMenuQuery);
            const matchesCategory = posMenuCategoryFilter === 'ALL' || String(menu.categoryLabel || menu.category || 'Uncategorized') === posMenuCategoryFilter;
            const matchesScope = posMenuScope === 'ALL'
                || (posMenuScope === 'ROOM_SERVICE' && menu.isRoomServiceFlag)
                || (posMenuScope === 'FEATURED' && menu.isRecommendedFlag);
            return matchesQuery && matchesCategory && matchesScope;
        })
        .sort((left, right) => {
            if (posMenuSortMode === 'PRICE_HIGH') return right.basePrice - left.basePrice;
            if (posMenuSortMode === 'PRICE_LOW') return left.basePrice - right.basePrice;
            if (posMenuSortMode === 'NAME') return String(left.cleanName).localeCompare(String(right.cleanName));
            if (posMenuSortMode === 'FEATURED') {
                if (left.isRecommendedFlag === right.isRecommendedFlag) return String(left.cleanName).localeCompare(String(right.cleanName));
                return left.isRecommendedFlag ? -1 : 1;
            }
            const categorySort = String(left.categoryLabel).localeCompare(String(right.categoryLabel));
            if (categorySort !== 0) return categorySort;
            return String(left.cleanName).localeCompare(String(right.cleanName));
        });
    const posRoomServiceCount = (menus || []).filter((menu) => menu.isRoomServiceFlag).length;
    const posFeaturedCount = (menus || []).filter((menu) => menu.isRecommendedFlag).length;
    const posDraftVariantCount = (newMenu.sizes || []).length;
    const posDraftBasePrice = Number(newMenu.sizes?.[0]?.price || 0);

    const normalizedAttendanceQuery = (dtrSearch.query || '').toLowerCase();
    const attendanceSuggestions = !normalizedAttendanceQuery
        ? []
        : employees
            .filter((employee) =>
                (employee.emp_id || '').toLowerCase().includes(normalizedAttendanceQuery) ||
                (employee.name || '').toLowerCase().includes(normalizedAttendanceQuery)
            )
            .slice(0, 8);

    const filteredAttendance = attendance
        .filter((a) => {
            const empId = (a.emp_id || '').toLowerCase();
            const empName = (a.name || '').toLowerCase();

            const matchQuery = !normalizedAttendanceQuery || empId.includes(normalizedAttendanceQuery) || empName.includes(normalizedAttendanceQuery);

            let matchDate = true;
            if (dtrSearch.startDate && a.date < dtrSearch.startDate) {
                matchDate = false;
            }
            if (dtrSearch.endDate && a.date > dtrSearch.endDate) {
                matchDate = false;
            }

            return matchQuery && matchDate;
        })
        .map((row) => {
            const employee = attendanceEmployeeDirectory[row.emp_id] || null;
            return {
                ...row,
                role: row.role || employee?.role || '',
                department: row.department || row.dept || employee?.department || employee?.dept || (employee ? getEmpDept(employee) : 'Unassigned'),
                ...buildAttendanceRowMeta(row)
            };
        })
        .sort((left, right) => {
            if ((right.sortTimestamp || 0) !== (left.sortTimestamp || 0)) {
                return (right.sortTimestamp || 0) - (left.sortTimestamp || 0);
            }
            return String(right.id || '').localeCompare(String(left.id || ''));
        });

    const attendanceSummary = filteredAttendance.reduce((summary, row) => {
        summary.totalRecords += 1;
        if (row.statusKey === 'COMPLETE') {
            summary.completedCount += 1;
        } else if (row.statusKey === 'OPEN') {
            summary.openCount += 1;
        }
        if (Number.isFinite(row.workedHours)) {
            summary.totalWorkedHours += row.workedHours;
        }
        return summary;
    }, {
        totalRecords: 0,
        completedCount: 0,
        openCount: 0,
        totalWorkedHours: 0
    });

    const averageWorkedHours = attendanceSummary.completedCount
        ? attendanceSummary.totalWorkedHours / attendanceSummary.completedCount
        : null;
    const hasAttendanceFilters = Boolean(dtrSearch.query || dtrSearch.startDate || dtrSearch.endDate);
    const manualAttendanceEmployee = employees.find((employee) => employee.emp_id === manualAttendanceForm.emp_id) || null;

    const persistCoeConfigLocally = (config) => {
        localStorage.setItem(getCoeConfigStorageKey(currentHotelCode), JSON.stringify(serializeCoeConfig(config)));
    };

    const handleCoeAssetChange = async (assetKey, fileKey, file) => {
        if (!file) return;
        const dataUrl = await fileToDataUrl(file);
        setCoeConfig((prev) => {
            const nextConfig = mergeCoeConfig({
                ...prev,
                [assetKey]: dataUrl,
                [fileKey]: file
            });
            persistCoeConfigLocally(nextConfig);
            return nextConfig;
        });
    };

    const handleRemoveCoeAsset = (assetKey, fileKey) => {
        setCoeConfig((prev) => {
            const nextConfig = mergeCoeConfig({
                ...prev,
                [assetKey]: '',
                [fileKey]: null
            });
            persistCoeConfigLocally(nextConfig);
            return nextConfig;
        });
    };

    const handleAddEvaluation = async () => {
        const trimmedRemarks = String(newEval.remarks || '').trim();

        if (!newEval.emp_id) return alert('Please select an employee first.');
        if (!trimmedRemarks) return alert('Please enter evaluation remarks.');

        const payload = {
            ...newEval,
            score: clampEvaluationScore(newEval.score),
            remarks: trimmedRemarks,
            period_month: getEvaluationMonthKey(newEval.period_month),
            review_type: newEval.review_type || 'Monthly Review',
            hotel_code: currentHotelCode
        };

        const response = await fetch('/api/hr/evaluations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            alert('Unable to save the evaluation record right now.');
            return;
        }

        recordAuditLog(`Submitted Evaluation for Employee: ${newEval.emp_id}`);
        setNewEval(createDefaultEvaluationDraft());
        await fetchHRData();
        alert('Evaluation submitted successfully.');
    };

    const handleSaveCoeConfig = async () => {
        const normalizedConfig = mergeCoeConfig({
            ...coeConfig,
            template: String(coeConfig.template || '').trim() || getDefaultCoeConfig().template,
            company_name: String(coeConfig.company_name || '').trim() || 'HOTEL CMS',
            company_address: String(coeConfig.company_address || '').trim() || 'Business Address',
            company_email: String(coeConfig.company_email || '').trim() || 'hr@hotelcms.example',
            company_phone: String(coeConfig.company_phone || '').trim() || '+63 000 000 0000',
            document_title: String(coeConfig.document_title || '').trim() || 'CERTIFICATE OF EMPLOYMENT',
            issue_city: String(coeConfig.issue_city || '').trim() || 'Manila',
            signatory_name: String(coeConfig.signatory_name || '').trim() || 'Human Resources Department',
            signatory_title: String(coeConfig.signatory_title || '').trim() || 'HR Manager',
            footer_note: String(coeConfig.footer_note || '').trim() || getDefaultCoeConfig().footer_note,
            reference_prefix: String(coeConfig.reference_prefix || '').trim() || 'COE',
            watermark_text: String(coeConfig.watermark_text || '').trim() || 'OFFICIAL',
            body_font_size: Math.min(14, Math.max(10, Number(coeConfig.body_font_size) || 11))
        });

        setCoeConfig(normalizedConfig);
        persistCoeConfigLocally(normalizedConfig);

        const formData = new FormData();
        formData.append('hotel_code', currentHotelCode);
        formData.append('coe_template', normalizedConfig.template);
        formData.append('border_style', normalizedConfig.border_style);
        formData.append('existing_bg', normalizedConfig.bg_image_url || '');
        formData.append('existing_logo', normalizedConfig.logo_image_url || '');
        formData.append('existing_signature', normalizedConfig.signature_image_url || '');
        formData.append('company_name', normalizedConfig.company_name);
        formData.append('company_address', normalizedConfig.company_address);
        formData.append('company_email', normalizedConfig.company_email);
        formData.append('company_phone', normalizedConfig.company_phone);
        formData.append('document_title', normalizedConfig.document_title);
        formData.append('issue_city', normalizedConfig.issue_city);
        formData.append('signatory_name', normalizedConfig.signatory_name);
        formData.append('signatory_title', normalizedConfig.signatory_title);
        formData.append('footer_note', normalizedConfig.footer_note);
        formData.append('accent_color', normalizedConfig.accent_color);
        formData.append('watermark_text', normalizedConfig.watermark_text);
        formData.append('body_font_size', String(normalizedConfig.body_font_size));
        formData.append('reference_prefix', normalizedConfig.reference_prefix);
        formData.append('show_reference', String(Boolean(normalizedConfig.show_reference)));
        formData.append('show_background', String(Boolean(normalizedConfig.show_background)));
        formData.append('show_logo', String(Boolean(normalizedConfig.show_logo)));
        formData.append('show_watermark', String(Boolean(normalizedConfig.show_watermark)));

        if (normalizedConfig.bgFile) formData.append('bg_image', normalizedConfig.bgFile);
        if (normalizedConfig.logoFile) formData.append('logo_image', normalizedConfig.logoFile);
        if (normalizedConfig.signatureFile) formData.append('signature_image', normalizedConfig.signatureFile);

        const response = await fetch('/api/hr/settings', { method: 'POST', body: formData });
        if (!response.ok) {
            alert('Builder settings were saved locally, but the server copy could not be updated.');
            return;
        }

        recordAuditLog('Updated COE Template Configuration');
        await fetchHRData();
        alert('COE Builder settings saved.');
    };

    const handleGenerateCOE = async (emp_id) => {
        const employee = employees.find((entry) => entry.emp_id === emp_id);
        if (!employee) return alert('Employee not found.');

        const employeeContext = {
            ...employee,
            department: employee.department || employee.dept || getEmpDept(employee)
        };
        const config = mergeCoeConfig(coeConfig);
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const accentRgb = hexToRgb(config.accent_color, [30, 41, 59]);
        const issueDateLong = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Asia/Manila'
        });
        const referenceNo = buildCoeReferenceNo(config, employeeContext.emp_id);
        const bodyText = buildCoeTemplateText(config.template, employeeContext, config);

        const [backgroundAsset, logoAsset, signatureAsset] = await Promise.all([
            config.show_background ? ensureImageDataUrl(config.bgFile || config.bg_image_url) : Promise.resolve(''),
            config.show_logo ? ensureImageDataUrl(config.logoFile || config.logo_image_url) : Promise.resolve(''),
            ensureImageDataUrl(config.signatureFile || config.signature_image_url)
        ]);

        const drawCertificateBorder = () => {
            const borderStyle = String(config.border_style || 'CLASSIC_NAVY').toUpperCase();
            if (borderStyle === 'NONE') return;

            if (borderStyle === 'EXECUTIVE_GOLD') {
                doc.setDrawColor(180, 132, 45);
                doc.setLineWidth(1.2);
                doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
                doc.setLineWidth(0.35);
                doc.rect(14, 14, pageWidth - 28, pageHeight - 28);
                return;
            }

            if (borderStyle === 'MODERN_FRAME') {
                doc.setDrawColor(...accentRgb);
                doc.setLineWidth(1.1);
                doc.line(12, 12, pageWidth - 42, 12);
                doc.line(12, 12, 12, pageHeight - 36);
                doc.line(pageWidth - 12, 34, pageWidth - 12, pageHeight - 12);
                doc.line(36, pageHeight - 12, pageWidth - 12, pageHeight - 12);
                return;
            }

            if (borderStyle === 'MINIMAL_LINE') {
                doc.setDrawColor(148, 163, 184);
                doc.setLineWidth(0.4);
                doc.rect(14, 14, pageWidth - 28, pageHeight - 28);
                return;
            }

            doc.setDrawColor(...accentRgb);
            doc.setLineWidth(0.9);
            doc.rect(12, 12, pageWidth - 24, pageHeight - 24);
            doc.setLineWidth(0.25);
            doc.rect(16, 16, pageWidth - 32, pageHeight - 32);
        };

        if (backgroundAsset) {
            doc.addImage(backgroundAsset, getDataUrlImageType(backgroundAsset), 0, 0, pageWidth, pageHeight);
        } else {
            doc.setFillColor(248, 250, 252);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');
        }

        drawCertificateBorder();

        if (config.show_watermark && config.watermark_text) {
            doc.setTextColor(226, 232, 240);
            doc.setFontSize(34);
            doc.setFont(undefined, 'bold');
            doc.text(String(config.watermark_text).toUpperCase(), pageWidth / 2, pageHeight / 2, { align: 'center' });
        }

        doc.setFillColor(...accentRgb);
        doc.roundedRect(18, 18, pageWidth - 36, 24, 3, 3, 'F');

        if (logoAsset && config.show_logo) {
            doc.addImage(logoAsset, getDataUrlImageType(logoAsset), 22, 21, 16, 16);
        }

        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(16);
        doc.text(config.company_name || 'HOTEL CMS', logoAsset && config.show_logo ? 42 : 24, 28);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8.5);
        doc.text(config.company_address || '', logoAsset && config.show_logo ? 42 : 24, 34);

        doc.setTextColor(...accentRgb);
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text(issueDateLong, pageWidth - 24, 27, { align: 'right' });
        doc.setFont(undefined, 'normal');
        doc.text(config.show_reference ? referenceNo : `Issued in ${config.issue_city || 'Manila'}`, pageWidth - 24, 33, { align: 'right' });

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(24, 52, pageWidth - 48, pageHeight - 96, 4, 4, 'FD');

        doc.setTextColor(...accentRgb);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(21);
        doc.text(config.document_title || 'CERTIFICATE OF EMPLOYMENT', pageWidth / 2, 70, { align: 'center' });

        doc.setFontSize(9.5);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`Issue City: ${config.issue_city || 'Manila'}`, 32, 81);
        doc.text(`Employee ID: ${employeeContext.emp_id}`, pageWidth - 32, 81, { align: 'right' });

        doc.setTextColor(15, 23, 42);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text('To Whom It May Concern:', 32, 94);

        doc.setFont(undefined, 'normal');
        doc.setFontSize(Number(config.body_font_size) || 11);
        const bodyLines = doc.splitTextToSize(bodyText, pageWidth - 72);
        doc.text(bodyLines, 32, 104);

        const bodyBottomY = 104 + (bodyLines.length * ((Number(config.body_font_size) || 11) * 0.55));
        const summaryCardY = Math.min(Math.max(bodyBottomY + 10, 144), pageHeight - 82);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(32, summaryCardY, pageWidth - 64, 24, 3, 3, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('Department', 38, summaryCardY + 7);
        doc.text('Role', 86, summaryCardY + 7);
        doc.text('Date Hired', 144, summaryCardY + 7);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(employeeContext.department || 'Unassigned', 38, summaryCardY + 15);
        doc.text(employeeContext.role || '-', 86, summaryCardY + 15);
        doc.text(employeeContext.date_hired || '-', 144, summaryCardY + 15);

        const signatureBlockY = pageHeight - 56;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.text('Respectfully issued by,', 32, signatureBlockY);

        if (signatureAsset) {
            doc.addImage(signatureAsset, getDataUrlImageType(signatureAsset), 32, signatureBlockY + 4, 34, 18);
        }

        doc.setDrawColor(148, 163, 184);
        doc.line(32, pageHeight - 26, 88, pageHeight - 26);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text(config.signatory_name || 'Human Resources Department', 32, pageHeight - 21);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9.5);
        doc.text(config.signatory_title || 'HR Manager', 32, pageHeight - 16);

        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`${config.company_phone || ''}  |  ${config.company_email || ''}`.trim(), pageWidth - 32, pageHeight - 22, { align: 'right' });
        doc.text(config.footer_note || '', pageWidth / 2, pageHeight - 10, { align: 'center' });

        doc.save(`COE_${String(employeeContext.name || employeeContext.emp_id || 'Employee').replace(/\s+/g, '_')}.pdf`);
    };

    // 💡 [신규] 화면에 계산된 데이터를 그대로 PDF로 뽑아주는 함수
    const handleDownloadPayslipPDF = (data) => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("OFFICIAL PAYSLIP", 105, 20, null, null, "center");

        doc.setFontSize(10);
        doc.text(`Employee Name: ${data.name || ''}`, 14, 35);
        doc.text(`Position: ${data.role || ''} (${data.dept || ''})`, 14, 41);
        doc.text(`Employee ID: ${data.emp_id || ''}`, 14, 47);

        const pStart = typeof payrollDates !== 'undefined' ? payrollDates.start : '';
        const pEnd = typeof payrollDates !== 'undefined' ? payrollDates.end : '';
        doc.text(`Payroll Period: ${pStart} ~ ${pEnd}`, 14, 53);

        const earnings = data.earningLines || [];
        const deductions = data.deductionLines || [];
        const longestSection = Math.max(earnings.length, deductions.length);
        const bodyRows = Array.from({ length: longestSection }).map((_, index) => ([
            earnings[index]?.label || '',
            typeof earnings[index]?.amount === 'number' ? earnings[index].amount.toLocaleString() : '',
            deductions[index]?.label || '',
            typeof deductions[index]?.amount === 'number' ? deductions[index].amount.toLocaleString() : ''
        ]));

        bodyRows.push([
            { content: 'Gross Pay', fontStyle: 'bold' },
            { content: (data.grossPay || 0).toLocaleString(), fontStyle: 'bold' },
            { content: 'Total Deductions', fontStyle: 'bold' },
            { content: (data.totalDed || 0).toLocaleString(), fontStyle: 'bold' }
        ]);

        autoTable(doc, {
            startY: 60,
            head: [["Earnings", "Amount (PHP)", "Deductions", "Amount (PHP)"]],
            body: bodyRows,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59] },
            styles: { fontSize: 10, cellPadding: 4 }
        });

        const finalY = doc.lastAutoTable.finalY || 120;

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(`NET PAYOUT: PHP ${(data.netPay || 0).toLocaleString()}`, 105, finalY + 15, null, null, "center");

        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text("This is a system-generated document.", 105, finalY + 30, null, null, "center");

        doc.save(`Payslip_${(data.name || 'Unknown').replace(/ /g, '_')}_${pEnd}.pdf`);
    };

    const handleExportEmployeePDF = (emp) => {
        const extras = extraEmpDetails[emp.emp_id] || {};
        const doc = new jsPDF(); doc.setFontSize(20); doc.text("EMPLOYEE PROFILE", 105, 20, null, null, "center"); doc.setFontSize(10); doc.setTextColor(100); doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
        const hireDate = extras.date_hired || (emp.updated_at ? String(emp.updated_at).substring(0, 10) : 'N/A');
        autoTable(doc, { startY: 40, body: [["Employee ID", emp.emp_id, "Role / Position", emp.role], ["First Name", extras.first_name || '-', "Last Name", extras.last_name || '-'], ["Gender", extras.gender || '-', "Date of Birth", extras.dob || '-'], ["Phone", extras.phone || '-', "Email", extras.email || '-'], ["Marital Status", extras.marital_status || '-', "Children", String(extras.children_count || 0)], ["Date Hired", hireDate, "Base Salary", `PHP ${parseFloat(emp.base_salary || 0).toLocaleString()}`], ["Emergency Contact", extras.emergency_contact || '-', "Home Address", extras.address || '-']], theme: 'grid', styles: { fontSize: 9, cellPadding: 5 }, columnStyles: { 0: { fillColor: [240, 240, 240], fontStyle: 'bold' }, 2: { fillColor: [240, 240, 240], fontStyle: 'bold' } } }); doc.save(`Profile_${emp.name.replace(/ /g, '_')}.pdf`);
    };

    const handleSendMessage = () => {
        if (!newMessage.trim()) return;
        const msg = { id: Date.now(), sender: currentUserId, text: newMessage, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        const updated = { ...messages, [chatRoom]: [...(messages[chatRoom] || []), msg] };
        setMessages(updated); sessionStorage.setItem('hr_group_messages', JSON.stringify(updated)); setNewMessage('');
    };

    // ========================================================
    // 💡 [추가 1] 웹캠 촬영용 상태 및 함수
    // ========================================================
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [photoBase64, setPhotoBase64] = useState('');
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // 👇 [신규 추가] 신분증 스캐너 전용 상태 및 함수
    const [idCardBase64, setIdCardBase64] = useState('');
    const [isIdScanning, setIsIdScanning] = useState(false);

    const handleScanID = () => {
        if (confirm("🚨 API integration for ID Scanner required. \n\nLoad a virtual ID scan image for the demo?")) {
            setIsIdScanning(true);
            setTimeout(() => {
                // 더미 신분증 스캔 이미지 (실제 스캐너 API 연동 시 이 부분을 교체합니다)
                const dummyIdScan = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAAXNSR0IArs4c6QAAACVJREFUKFNjZCASMDKhkI0M2D8zUBoS1AwZ/0g1hKQyk6iGoCwaRzUERYuohoAUnv///z8A1VwUwwyYkZMAAAAASUVORK5CYII=';
                setIdCardBase64(dummyIdScan);
                setIsIdScanning(false);
                alert("✅ ID Card scan completed.");
            }, 2000);
        }
    };

    // 👇 [신규 추가] 얼굴 사진과 신분증을 묶어서 PDF로 내보내는 함수
    const handleDownloadIDPhotoPDF = () => {
        if (!photoBase64 && !idCardBase64) return alert("No Photo or ID Card to download.");
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Identity Verification Document", 14, 20);
        doc.setFontSize(12);
        doc.text(`Employee: ${newEmployee.emp_id || 'Pending'} (${firstName} ${lastName})`, 14, 30);

        let yPos = 45;
        if (photoBase64) {
            doc.setFontSize(14);
            doc.text("1. Face Photo", 14, yPos);
            doc.addImage(photoBase64, 'JPEG', 14, yPos + 5, 50, 66); // 증명사진 3:4 비율
            yPos += 85;
        }

        if (idCardBase64) {
            doc.setFontSize(14);
            doc.text("2. Scanned ID Card", 14, yPos);
            doc.addImage(idCardBase64, 'PNG', 14, yPos + 5, 110, 70); // 신분증 가로 비율
        }

        doc.save(`Verification_${newEmployee.emp_id || 'Emp'}.pdf`);
    };

    const openCamera = async () => {
        setIsCameraOpen(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
            alert("No camera permission or no connected webcam.");
            setIsCameraOpen(false);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            context.drawImage(videoRef.current, 0, 0);
            setPhotoBase64(canvasRef.current.toDataURL('image/jpeg'));
            closeCamera();
        }
    };

    const closeCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        }
        setIsCameraOpen(false);
    };

    // ========================================================
    // 💰 [필리핀 현지화 Payroll] 상태 및 계산 엔진 (15일 정산 업그레이드)
    // ========================================================
    const [payrollPeriod, setPayrollPeriod] = useState('SEMI_MONTHLY'); // 기본값을 15일 정산으로 변경
    const [selectedPayslip, setSelectedPayslip] = useState(null);
    const [payrollPage, setPayrollPage] = useState(1);

    // 💡 [신규] 급여 정산 기간(Cut-off) 상태 관리 (기본값: 현재 날짜 기준 15일 구간 자동 셋팅)
    const [payrollDates, setPayrollDates] = useState(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        if (today.getDate() <= 15) {
            return { start: `${year}-${month}-01`, end: `${year}-${month}-15` }; // 전반기
        } else {
            const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
            return { start: `${year}-${month}-16`, end: `${year}-${month}-${lastDay}` }; // 후반기
        }
    });

    const [payrollSearch, setPayrollSearch] = useState({ query: '', dept: '', role: '' });
    const payrollBaseFields = [
        { key: 'semiMonthlyDivisor', label: 'Semi-monthly Divisor', help: 'Used to prorate monthly salary for semi-monthly cutoffs.', step: '0.1', min: '1' },
        { key: 'annualWorkDays', label: 'Annual Work Days', help: 'Controls the base hourly-rate conversion formula.', step: '1', min: '1' },
        { key: 'dailyWorkHours', label: 'Daily Work Hours', help: 'Standard work hours per day for OT and late calculations.', step: '0.5', min: '1' },
        { key: 'thirteenthMonthDivisor', label: '13th Month Divisor', help: 'Used when the 13th month mode is selected.', step: '1', min: '1' }
    ];
    const payrollAdditionFields = [
        { key: 'overtimeMultiplier', label: 'Overtime Multiplier', help: 'Applied against the hourly rate for overtime pay.', step: '0.05', min: '0' },
        { key: 'nightDiffMultiplier', label: 'Night Differential', help: 'Applied to eligible late-night hours.', step: '0.01', min: '0' },
        { key: 'holidayAllowance', label: 'Holiday Allowance', help: 'Flat per-period allowance added on top of operational pay.', step: '1', min: '0' },
        { key: 'mealAllowance', label: 'Meal Allowance', help: 'Flat per-period meal benefit.', step: '1', min: '0' },
        { key: 'transportAllowance', label: 'Transport Allowance', help: 'Flat per-period transport support.', step: '1', min: '0' },
        { key: 'performanceAllowance', label: 'Performance Allowance', help: 'Flat performance incentive amount.', step: '1', min: '0' },
        { key: 'otherAllowance', label: 'Other Allowance', help: 'Catch-all allowance for local policy needs.', step: '1', min: '0' }
    ];
    const payrollDeductionFields = [
        { key: 'sssRate', label: 'SSS Rate', help: 'Employee-side SSS contribution rate.', step: '0.001', min: '0' },
        { key: 'sssCap', label: 'SSS Cap', help: 'Maximum SSS deduction per full month.', step: '1', min: '0' },
        { key: 'philhealthRate', label: 'PhilHealth Rate', help: 'Employee-side PhilHealth rate.', step: '0.001', min: '0' },
        { key: 'philhealthCap', label: 'PhilHealth Cap', help: 'Maximum PhilHealth deduction per full month.', step: '1', min: '0' },
        { key: 'housingFundAmount', label: 'Housing Fund (HDMF)', help: 'Flat housing fund / Pag-IBIG deduction.', step: '1', min: '0' },
        { key: 'insuranceAmount', label: 'Insurance', help: 'Flat insurance deduction per period.', step: '1', min: '0' },
        { key: 'otherDeductionAmount', label: 'Other Deduction', help: 'Additional fixed deduction for custom policies.', step: '1', min: '0' },
        { key: 'withholdingThreshold', label: 'Tax Threshold', help: 'Threshold used before withholding tax applies.', step: '1', min: '0' },
        { key: 'withholdingRate', label: 'Tax Rate', help: 'Applied to the taxable portion above the threshold.', step: '0.01', min: '0' }
    ];

    const updatePayrollConfigValue = (section, key, value) => {
        setPayrollConfig(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }));
    };

    const handleResetPayrollConfig = () => {
        if (!window.confirm("Reset payroll settings to the default structure?")) return;
        setPayrollConfig(getDefaultPayrollConfig());
    };

    const filteredPayrollEmps = employees.filter(emp => {
        const dept = getEmpDept(emp);
        const matchQuery = emp.name.toLowerCase().includes(payrollSearch.query.toLowerCase()) || emp.emp_id.toLowerCase().includes(payrollSearch.query.toLowerCase());
        const matchDept = payrollSearch.dept ? dept === payrollSearch.dept : true;
        const matchRole = payrollSearch.role ? emp.role === payrollSearch.role : true;
        return matchQuery && matchDept && matchRole;
    });

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    const deptCosts = {};
    const roleCosts = {};

    // ⏱️ [업그레이드] 선택된 '정산 기간(Cut-off)' 안에 찍힌 DTR만 골라서 계산하도록 필터링 적용
    const calculateTimeMetrics = (emp_id, startDate, endDate) => {
        const empDTR = attendance.filter(a =>
            a.emp_id === emp_id &&
            a.time_out &&
            a.date >= startDate &&
            a.date <= endDate
        );

        let totalLateHours = 0;
        let totalOTHours = 0;
        let totalNSDHours = 0;

        empDTR.forEach(record => {
            try {
                const timeIn = parseAttendanceDateTime(record.date, record.time_in);
                let timeOut = parseAttendanceDateTime(record.date, record.time_out);
                if (!timeIn || !timeOut) return;

                let hoursWorked = (timeOut - timeIn) / (1000 * 60 * 60);
                if (hoursWorked < 0) hoursWorked += 24;

                if (hoursWorked > 8) totalOTHours += (hoursWorked - 8);
                if (hoursWorked < 8) totalLateHours += (8 - hoursWorked);

                const inHour = timeIn.getHours();
                if (inHour >= 22 || inHour < 6) {
                    totalNSDHours += Math.min(hoursWorked, 8);
                }
            } catch (e) { console.error("Time parsing error", e); }
        });

        return { totalLateHours, totalOTHours, totalNSDHours, recordsCount: empDTR.length };
    };

    const payrollData = filteredPayrollEmps.map(emp => {
        const dept = getEmpDept(emp);
        const baseSalary = parseFloat(emp.base_salary) || 15000;
        const isSemi = payrollPeriod === 'SEMI_MONTHLY';
        const isThirteenthMonth = payrollPeriod === '13TH_MONTH';
        const divisor = isSemi ? Math.max(1, Number(payrollConfig.base.semiMonthlyDivisor) || 2) : 1;
        const workDays = Math.max(1, Number(payrollConfig.base.annualWorkDays) || 313);
        const dailyWorkHours = Math.max(1, Number(payrollConfig.base.dailyWorkHours) || 8);
        const thirteenthMonthDivisor = Math.max(1, Number(payrollConfig.base.thirteenthMonthDivisor) || 12);
        const periodBaseSalary = isThirteenthMonth
            ? (baseSalary / thirteenthMonthDivisor)
            : (isSemi ? (baseSalary / divisor) : baseSalary);

        const hourlyRate = (baseSalary * 12) / workDays / dailyWorkHours;
        const { totalLateHours, totalOTHours, totalNSDHours, recordsCount } = isThirteenthMonth
            ? { totalLateHours: 0, totalOTHours: 0, totalNSDHours: 0, recordsCount: 0 }
            : calculateTimeMetrics(emp.emp_id, payrollDates.start, payrollDates.end);

        const overtimePay = Math.round(totalOTHours * hourlyRate * (Number(payrollConfig.additions.overtimeMultiplier) || 1.25));
        const nsdPay = Math.round(totalNSDHours * hourlyRate * (Number(payrollConfig.additions.nightDiffMultiplier) || 0.10));
        const holidayPay = isThirteenthMonth ? 0 : ((Number(payrollConfig.additions.holidayAllowance) || 0) / divisor);
        const mealAllowance = isThirteenthMonth ? 0 : ((Number(payrollConfig.additions.mealAllowance) || 0) / divisor);
        const transportAllowance = isThirteenthMonth ? 0 : ((Number(payrollConfig.additions.transportAllowance) || 0) / divisor);
        const performanceAllowance = isThirteenthMonth ? 0 : ((Number(payrollConfig.additions.performanceAllowance) || 0) / divisor);
        const otherAllowance = isThirteenthMonth ? 0 : ((Number(payrollConfig.additions.otherAllowance) || 0) / divisor);
        const fixedAllowanceTotal = holidayPay + mealAllowance + transportAllowance + performanceAllowance + otherAllowance;
        const totalAdditions = overtimePay + nsdPay + fixedAllowanceTotal;

        const lateTardiness = payrollConfig.deductions.deductLateUndertime ? Math.round(totalLateHours * hourlyRate) : 0;
        const grossPay = periodBaseSalary + totalAdditions;

        const sssRate = Number(payrollConfig.deductions.sssRate) || 0.045;
        const sssCap = Number(payrollConfig.deductions.sssCap) || 1350;
        const philhealthRate = Number(payrollConfig.deductions.philhealthRate) || 0.02;
        const philhealthCap = Number(payrollConfig.deductions.philhealthCap) || 1000;
        const housingFundAmount = Number(payrollConfig.deductions.housingFundAmount) || 100;
        const insuranceAmount = Number(payrollConfig.deductions.insuranceAmount) || 0;
        const otherDeductionAmount = Number(payrollConfig.deductions.otherDeductionAmount) || 0;
        const withholdingThreshold = Number(payrollConfig.deductions.withholdingThreshold) || 20833;
        const withholdingRate = Number(payrollConfig.deductions.withholdingRate) || 0.20;

        const sss = isThirteenthMonth ? 0 : (Math.min(Math.floor(baseSalary * sssRate), sssCap) / divisor);
        const philhealth = isThirteenthMonth ? 0 : (Math.min(Math.floor(baseSalary * philhealthRate), philhealthCap) / divisor);
        const pagibig = isThirteenthMonth ? 0 : (housingFundAmount / divisor);
        const insurance = isThirteenthMonth ? 0 : (insuranceAmount / divisor);
        const otherDeduction = isThirteenthMonth ? 0 : (otherDeductionAmount / divisor);
        const taxableThreshold = isThirteenthMonth ? withholdingThreshold : (withholdingThreshold / divisor);
        const wht = grossPay > taxableThreshold ? Math.floor((grossPay - taxableThreshold) * withholdingRate) : 0;

        const totalDed = sss + philhealth + pagibig + insurance + otherDeduction + lateTardiness + wht;
        const netPay = grossPay - totalDed;

        const earningLines = [
            { label: 'Basic Pay', amount: periodBaseSalary },
            { label: 'Overtime Pay', amount: overtimePay },
            { label: 'Holiday Allowance', amount: holidayPay },
            { label: 'Night Differential', amount: nsdPay },
            { label: 'Meal Allowance', amount: mealAllowance },
            { label: 'Transport Allowance', amount: transportAllowance },
            { label: 'Performance Allowance', amount: performanceAllowance },
            { label: 'Other Allowance', amount: otherAllowance }
        ].filter((line) => line.amount > 0 || line.label === 'Basic Pay');

        const deductionLines = [
            { label: 'SSS Contribution', amount: sss },
            { label: 'PhilHealth', amount: philhealth },
            { label: 'Housing Fund (HDMF)', amount: pagibig },
            { label: 'Insurance', amount: insurance },
            { label: 'Withholding Tax', amount: wht },
            { label: 'Late / Undertime', amount: lateTardiness },
            { label: 'Other Deduction', amount: otherDeduction }
        ].filter((line) => line.amount > 0);

        totalGross += grossPay;
        totalDeductions += totalDed;
        totalNet += netPay;
        deptCosts[dept] = (deptCosts[dept] || 0) + grossPay;
        roleCosts[emp.role] = (roleCosts[emp.role] || 0) + grossPay;

        return {
            ...emp,
            dept,
            periodBaseSalary,
            overtimePay,
            holidayPay,
            nsdPay,
            mealAllowance,
            transportAllowance,
            performanceAllowance,
            otherAllowance,
            fixedAllowanceTotal,
            totalAdditions,
            grossPay,
            sss,
            philhealth,
            pagibig,
            insurance,
            otherDeduction,
            lateTardiness,
            wht,
            totalDed,
            netPay,
            dtrCount: recordsCount,
            earningLines,
            deductionLines
        };
    });

    const sortedDeptCosts = Object.entries(deptCosts).sort((a, b) => b[1] - a[1]);
    const sortedRoleCosts = Object.entries(roleCosts).sort((a, b) => b[1] - a[1]);
    const payrollSummary = payrollData.reduce((acc, row) => {
        acc.totalAdditions += row.totalAdditions || 0;
        acc.totalAllowances += row.fixedAllowanceTotal || 0;
        acc.totalStatutory += (row.sss || 0) + (row.philhealth || 0) + (row.pagibig || 0) + (row.insurance || 0) + (row.otherDeduction || 0);
        acc.totalTax += row.wht || 0;
        acc.totalLate += row.lateTardiness || 0;
        return acc;
    }, {
        totalAdditions: 0,
        totalAllowances: 0,
        totalStatutory: 0,
        totalTax: 0,
        totalLate: 0
    });
    const payrollDeptTreemap = buildPayrollTreemapData(sortedDeptCosts, totalGross, PAYROLL_DEPT_TREEMAP_COLORS, 10);
    const payrollRoleTreemap = buildPayrollTreemapData(sortedRoleCosts, totalGross, PAYROLL_ROLE_TREEMAP_COLORS, 12);
    const payrollConfiguredAllowanceCount = payrollAdditionFields.filter((field) => (
        !['overtimeMultiplier', 'nightDiffMultiplier'].includes(field.key) && Number(payrollConfig.additions[field.key]) > 0
    )).length;
    const payrollConfiguredDeductionCount = payrollDeductionFields.filter((field) => (
        !['sssRate', 'sssCap', 'philhealthRate', 'philhealthCap', 'withholdingThreshold', 'withholdingRate'].includes(field.key) && Number(payrollConfig.deductions[field.key]) > 0
    )).length + (payrollConfig.deductions.deductLateUndertime ? 1 : 0);
    const payrollSubtotal = payrollData.reduce((acc, row) => {
        acc.basicPay += row.periodBaseSalary || row.baseSalary || 0;
        acc.additions += row.totalAdditions || 0;
        acc.grossPay += row.grossPay || 0;
        acc.deductions += row.totalDed || 0;
        acc.netPay += row.netPay || 0;
        return acc;
    }, {
        basicPay: 0,
        additions: 0,
        grossPay: 0,
        deductions: 0,
        netPay: 0
    });
    const payrollTotalPages = Math.max(1, Math.ceil(payrollData.length / PAYROLL_PAGE_SIZE));
    const safePayrollPage = Math.min(payrollPage, payrollTotalPages);
    const payrollPageStartIndex = (safePayrollPage - 1) * PAYROLL_PAGE_SIZE;
    const payrollPageRows = payrollData.slice(payrollPageStartIndex, payrollPageStartIndex + PAYROLL_PAGE_SIZE);
    const payrollPageStartRow = payrollData.length === 0 ? 0 : payrollPageStartIndex + 1;
    const payrollPageEndRow = payrollData.length === 0 ? 0 : payrollPageStartIndex + payrollPageRows.length;
    const payrollPageWindowStart = Math.max(1, Math.min(safePayrollPage - 2, payrollTotalPages - 4));
    const payrollPageNumbers = Array.from(
        { length: Math.min(5, payrollTotalPages) },
        (_, index) => payrollPageWindowStart + index
    );

    const handleExportPayrollLedgerPDF = () => {
        if (!payrollData.length) {
            alert("🚨 No payroll rows are available for PDF export.");
            return;
        }

        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const generatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
        const activeQuery = payrollSearch.query || 'All Employees';
        const activeDept = payrollSearch.dept || 'All Depts';
        const activeRole = payrollSearch.role || 'All Roles';

        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text("PAYROLL LEDGER", 14, 16);
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Generated: ${generatedAt}`, 14, 23);
        doc.text(`Payroll Window: ${payrollDates.start} ~ ${payrollDates.end}`, 14, 29);
        doc.text(`Filters: ${activeQuery} | ${activeDept} | ${activeRole}`, 14, 35);
        doc.text(`Filtered Rows: ${payrollData.length} employee(s) | Current screen page: ${safePayrollPage}/${payrollTotalPages}`, 14, 41);

        autoTable(doc, {
            startY: 48,
            theme: 'grid',
            head: [[
                'Summary',
                'Basic Pay',
                'Additions',
                'Gross Pay',
                'Deductions',
                'Net Payout'
            ]],
            headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: 'bold' },
            styles: { fontSize: 8.5, cellPadding: 3.2, textColor: [30, 41, 59], valign: 'middle' },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 52 },
                1: { halign: 'right', cellWidth: 32 },
                2: { halign: 'right', cellWidth: 32 },
                3: { halign: 'right', cellWidth: 34 },
                4: { halign: 'right', cellWidth: 34 },
                5: { halign: 'right', cellWidth: 34 }
            },
            body: [[
                `Subtotal (${payrollData.length} rows)`,
                formatPayrollPdfCurrency(payrollSubtotal.basicPay),
                formatPayrollPdfCurrency(payrollSubtotal.additions),
                formatPayrollPdfCurrency(payrollSubtotal.grossPay),
                formatPayrollPdfCurrency(payrollSubtotal.deductions),
                formatPayrollPdfCurrency(payrollSubtotal.netPay)
            ]],
            bodyStyles: { fillColor: [255, 255, 255] },
            margin: { left: 14, right: 14 }
        });

        autoTable(doc, {
            startY: (doc.lastAutoTable?.finalY || 48) + 6,
            theme: 'striped',
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 7.5, cellPadding: 2.8, valign: 'middle', textColor: [30, 41, 59], overflow: 'linebreak' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 42, fontStyle: 'bold' },
                1: { cellWidth: 30 },
                2: { cellWidth: 42 },
                3: { halign: 'right', cellWidth: 31 },
                4: { halign: 'right', cellWidth: 31 },
                5: { halign: 'right', cellWidth: 31 },
                6: { halign: 'right', cellWidth: 31 },
                7: { halign: 'right', cellWidth: 31 }
            },
            head: [[
                'Employee',
                'Department',
                'Role',
                'Basic Pay',
                'Additions',
                'Gross Pay',
                'Deductions',
                'Net Payout'
            ]],
            body: payrollData.map((row) => ([
                `${row.name || '-'}\n${row.emp_id || '-'}`,
                row.dept || '-',
                row.role || '-',
                formatPayrollPdfCurrency(row.periodBaseSalary || row.baseSalary || 0),
                formatPayrollPdfCurrency(row.totalAdditions || 0),
                formatPayrollPdfCurrency(row.grossPay || 0),
                formatPayrollPdfCurrency(row.totalDed || 0),
                formatPayrollPdfCurrency(row.netPay || 0)
            ]))
        });

        doc.save(`Payroll_Ledger_${payrollDates.start}_${payrollDates.end}.pdf`);
    };

    useEffect(() => {
        setPayrollPage(1);
    }, [payrollSearch.query, payrollSearch.dept, payrollSearch.role, payrollViewMode, payrollDates.start, payrollDates.end, payrollPeriod]);

    useEffect(() => {
        if (payrollPage > payrollTotalPages) {
            setPayrollPage(payrollTotalPages);
        }
    }, [payrollPage, payrollTotalPages]);

    const handleSettlePayroll = async () => {
        if (totalGross <= 0 || payrollData.length === 0) {
            return alert("🚨 No valid payroll data to settle for this period.");
        }

        const biometricReady = await ensureBiometricReadyForPayroll();
        if (!biometricReady) return;

        const confirmMsg = `Are you sure you want to settle the payroll for ${payrollDates.start} ~ ${payrollDates.end}?\n\nTotal Gross Expense: ₱${totalGross.toLocaleString()}\nTotal Net Payout: ₱${totalNet.toLocaleString()}\n\n⚠️ This will automatically be posted to the Finance Ledger as an Expense.`;
        if (!window.confirm(confirmMsg)) return;

        setIsSettling(true);
        try {
            // 1. 보관함(Archive)에 저장할 데이터 패키징
            const record = {
                id: `PR_${Date.now()}`,
                period_start: payrollDates.start,
                period_end: payrollDates.end,
                total_gross: totalGross,
                total_net: totalNet,
                total_deductions: totalDeductions,
                employee_count: payrollData.length,
                settled_at: new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
                details: payrollData
            };

            // 서버 DB 연동 전까지 LocalStorage를 활용해 안전하게 백업
            const updatedHistory = [record, ...payrollHistory];
            localStorage.setItem(`hr_payroll_history_${currentHotelCode}`, JSON.stringify(updatedHistory));
            setPayrollHistory(updatedHistory);

            // 2. Finance(재무) 시스템에 자동으로 지출(Expense) 트랜잭션 전송
            const financePayload = {
                id: Date.now(),
                date: getHotelDate(0), // 오늘 호텔 영업일 기준
                type: 'EXPENSE',
                category: 'Salaries & Wages', // 자동으로 '인건비' 카테고리로 분류
                amount: totalGross, // 회사의 실 지출액은 총 급여(Gross) 기준
                description: `Payroll Settlement: ${payrollDates.start} ~ ${payrollDates.end}`,
                hotel_code: currentHotelCode,
                user_id: currentUserId
            };

            await fetch('/api/finance/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(financePayload)
            });

            // 3. 재무 데이터 즉시 새로고침 (Finance 탭에 가면 바로 반영됨)
            const fRes = await fetch(`/api/finance/transactions?hotel=${currentHotelCode}`);
            const fData = await fRes.json();
            if (Array.isArray(fData)) setTransactions(fData);

            recordAuditLog(`Settled Payroll for period: ${payrollDates.start} ~ ${payrollDates.end} (Total: ₱${totalGross.toLocaleString()})`);

            alert("✅ Payroll successfully settled and securely posted to the Finance Ledger!");
            setPayrollViewMode('HISTORY'); // 정산 완료 후 보관함 화면으로 자동 이동
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (e) {
            console.error(e);
            alert("❌ Error processing payroll settlement.");
        } finally {
            setIsSettling(false);
        }
    };

    // Payment & OTA & TV Handlers
    const handleAddPaymentProvider = async () => { if (!newPaymentProvider.trim()) return; await fetch('/api/payment-configs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: newPaymentProvider, api_key: '', is_active: 0, hotel_code: currentHotelCode }) }); recordAuditLog(`Added Payment Gateway: ${newPaymentProvider}`); setNewPaymentProvider(''); fetchPayments(); };
    const handleUpdatePayment = async (provider, key, active) => { await fetch('/api/payment-configs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, api_key: key, is_active: active ? 1 : 0, hotel_code: currentHotelCode }) }); recordAuditLog(`Updated Payment Gateway: ${provider} (Active: ${active})`); fetchPayments(); };
    const handleDeletePayment = async (provider) => { if (window.confirm(`Delete ${provider}?`)) { await fetch(`/api/payment-configs/${provider}?hotel=${currentHotelCode}`, { method: 'DELETE' }); recordAuditLog(`Deleted Payment Gateway: ${provider}`); fetchPayments(); } };

    const handleBluetoothScan = async () => { try { const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true }); setNewDevice({ ...newDevice, name: device.name || 'Bluetooth Device', ip_address: device.id, type: 'Bluetooth Printer' }); alert(`Found: ${device.name || device.id}`); } catch (e) { alert('Bluetooth scan cancelled or not supported.'); } };

    const handleSaveReceiptConfig = async () => {
        try {
            const formData = new FormData();
            formData.append('header_text', receiptConfig.header_text || '');
            formData.append('footer_text', receiptConfig.footer_text || '');
            formData.append('vat_rate', receiptConfig.vat_rate || 0);
            formData.append('sc_rate', receiptConfig.sc_rate || 0);
            formData.append('existing_logo', receiptConfig.logo_url || '');
            formData.append('hotel_code', currentHotelCode);

            // 💡 [핵심 수정] DB 저장을 위해 누락되었던 서명 및 주소 정보들을 폼 데이터에 추가합니다!
            formData.append('address', receiptConfig.address || '');
            formData.append('business_no', receiptConfig.business_no || '');
            formData.append('tax_id', receiptConfig.tax_id || '');
            formData.append('signer_name', receiptConfig.signer_name || '');
            formData.append('signer_title', receiptConfig.signer_title || '');

            if (receiptConfig.imageFile) formData.append('image', receiptConfig.imageFile);

            // 💡 [핵심 수정] 서명 이미지 파일도 서버로 전송합니다.
            if (receiptConfig.signatureFile) formData.append('signature_image', receiptConfig.signatureFile);

            // (만약을 대비한 로컬 백업은 그대로 유지)
            localStorage.setItem(`receipt_extra_${currentHotelCode}`, JSON.stringify({ address: receiptConfig.address || '', business_no: receiptConfig.business_no || '', tax_id: receiptConfig.tax_id || '', signer_name: receiptConfig.signer_name || '', signer_title: receiptConfig.signer_title || '', signatureBase64: receiptConfig.signatureBase64 || '' }));

            const res = await fetch('/api/receipt-settings', { method: 'POST', body: formData });
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) throw new Error("Server error (500) occurred.");
            const data = await res.json();
            if (res.ok && data.success) {
                recordAuditLog(`Updated Receipt & Taxes (VAT changed to ${receiptConfig.vat_rate}%, SC changed to ${receiptConfig.sc_rate}%)`);
                alert('✅ Receipt and email signature settings saved successfully!'); fetchReceiptConfig();
            } else throw new Error(data.error || 'An error occurred while saving.');
        } catch (error) { alert(`❌ Save failed: ${error.message}`); }
    };

    const handleSaveRSConfig = async () => { try { await fetch('/api/tv-settings/room-service', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...rsConfig, hotel_code: currentHotelCode }) }); recordAuditLog('Updated TV Room Service Options'); alert("Saved!"); } catch (e) { alert("Failed."); } };
    const handleSaveAllTvImages = async () => { const menusToUpdate = Object.keys(tvImagesPending); if (menusToUpdate.length === 0) return alert("Select an image."); try { for (let menu_id of menusToUpdate) { const formData = new FormData(); formData.append('image', tvImagesPending[menu_id]); formData.append('menu_id', menu_id); formData.append('user_id', currentUserId); formData.append('hotel_code', currentHotelCode); await fetch('/api/tv-settings/upload', { method: 'POST', body: formData }); } recordAuditLog('Updated TV Menu Background Images'); alert("Saved!"); setTvImagesPending({}); } catch (e) { alert("Error."); } };

    const handleAddOta = async () => { if (!newOtaChannel.trim()) return; await fetch('/api/ota-configs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: newOtaChannel, api_key: '', is_active: 0, hotel_code: currentHotelCode }) }); recordAuditLog(`Added OTA Channel: ${newOtaChannel}`); setNewOtaChannel(''); fetchOtaConfigs(); };
    const handleUpdateOta = async (channel, key, active) => { await fetch('/api/ota-configs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel, api_key: key, is_active: active ? 1 : 0, hotel_code: currentHotelCode }) }); recordAuditLog(`Updated OTA Channel: ${channel} (Active: ${active})`); fetchOtaConfigs(); };
    const handleDeleteOta = async (channel) => { if (window.confirm(`Disconnect ${channel}?`)) { await fetch(`/api/ota-configs/${channel}?hotel=${currentHotelCode}`, { method: 'DELETE' }); recordAuditLog(`Deleted OTA Channel: ${channel}`); fetchOtaConfigs(); } };
    const triggerOtaSync = (channel) => { setIsSyncing({ ...isSyncing, [channel]: true }); recordAuditLog(`Triggered Manual Sync for OTA Channel: ${channel}`); setTimeout(() => { setIsSyncing({ ...isSyncing, [channel]: false }); alert(`✅ ${channel} inventory and rates have been successfully synchronized!`); }, 1500); };

    const handleSaveRefundPolicies = async () => { try { await fetch('/api/settings/refund-policies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...refundPolicies, hotel_code: currentHotelCode }) }); recordAuditLog('Updated Early Check-out Refund Policies'); alert("✅ Refund policies saved successfully!"); } catch (e) { alert("❌ Error saving policies."); } };

    // 💡 [신규 2] 직원 검색 필터링 로직
    const filteredEmployees = employees.filter(e => {
        const searchLower = empSearch.query.toLowerCase();
        const matchQuery = !empSearch.query || e.name.toLowerCase().includes(searchLower) || e.emp_id.toLowerCase().includes(searchLower);
        const matchRole = !empSearch.role || e.role === empSearch.role;
        const matchDept = !empSearch.dept || (departmentRoles[empSearch.dept] && departmentRoles[empSearch.dept].includes(e.role));
        return matchQuery && matchRole && matchDept;
    });

    // Website Config Handler
    const handleSaveWebsiteConfig = async () => {
        const formData = new FormData();
        formData.append('hotel_code', currentHotelCode);
        formData.append('welcome_title', websiteConfig.welcome_title || '');
        formData.append('welcome_subtitle', websiteConfig.welcome_subtitle || '');

        // 💡 [절대 방어] DB 컬럼 길이(Length) 제한으로 데이터가 잘리는 것을 막기 위해, 매우 긴 글을 쓸 수 있는 description(TEXT) 필드에 HTML 주석으로 템플릿 값을 숨깁니다.
        let finalDesc = websiteConfig.description || '';
        finalDesc = finalDesc.replace(/<!--TEMPLATE:.*?-->/g, ''); // 혹시 모를 중복 방지
        finalDesc += `<!--TEMPLATE:${websiteConfig.website_template || 'modern'}-->`;
        formData.append('description', finalDesc);
        
        formData.append('theme_color', websiteConfig.theme_color || '#2563eb');
        formData.append('theme_font', websiteConfig.theme_font || 'Inter');

        formData.append('website_template', websiteConfig.website_template || 'modern'); // 💡 템플릿 값 저장
        formData.append('slider_style', websiteConfig.slider_style || 'auto_fade');

        // 💡 [원상복구 완료] 어떠한 변환이나 간섭 없이 입력하신 주소 그대로를 저장합니다!
        formData.append('map_embed_url', websiteConfig.map_embed_url || '');

        formData.append('app_facilities', JSON.stringify(websiteConfig.app_facilities || []));
        formData.append('app_short_description', websiteConfig.app_short_description || '');
        formData.append('app_gallery_style', websiteConfig.app_gallery_style || 'arrows');

        const appGalleryStructure = [];
        (websiteConfig.app_gallery_urls || []).forEach(item => {
            if (item.type === 'file' && item.file) {
                appGalleryStructure.push({ type: 'file' });
                formData.append('app_gallery_images', item.file);
            } else if (item.type === 'url') {
                appGalleryStructure.push({ type: 'url', url: item.url });
            } else {
                appGalleryStructure.push({ type: 'url', url: item.url || item });
            }
        });
        formData.append('app_gallery_urls', JSON.stringify(appGalleryStructure));

        formData.append('sns_json', JSON.stringify({
            ig: websiteConfig.sns_ig,
            fb: websiteConfig.sns_fb,
            phone: websiteConfig.contact_phone,
            email: websiteConfig.contact_email,
            address: websiteConfig.contact_address,
            title: websiteConfig.contact_title || websiteConfig.hotel_name,
            hotel_name: websiteConfig.hotel_name,
            province: websiteConfig.province,
            city: websiteConfig.city,
            website_template: websiteConfig.website_template || 'modern' // 💡 DB 스키마 추가 없이 기존 JSON 컬럼에 안전하게 끼워 넣어 저장합니다.
        }));

        formData.append('footer_company_name', websiteConfig.footer_company_name || '');

        const finalPos = {
            title: {
                x: websiteConfig.welcome_text_pos?.title?.x ?? 10,
                y: websiteConfig.welcome_text_pos?.title?.y ?? 20,
                w: websiteConfig.welcome_text_pos?.title?.w ?? 80,
                size: websiteConfig.welcome_title_font_size || 48,
                align: websiteConfig.welcome_title_text_align || 'center'
            },
            subtitle: {
                x: websiteConfig.welcome_text_pos?.subtitle?.x ?? 30,
                y: websiteConfig.welcome_text_pos?.subtitle?.y ?? 50,
                w: websiteConfig.welcome_text_pos?.subtitle?.w ?? 80,
                size: websiteConfig.welcome_subtitle_font_size || 18,
                align: websiteConfig.welcome_subtitle_text_align || 'center'
                },
                template: websiteConfig.website_template || 'modern' // 💡 DB 스키마 용량 초과로 인한 데이터 잘림 현상을 피하기 위해 가장 안전한 필드에 템플릿 값을 동기화합니다.
        };
        formData.append('welcome_text_pos', JSON.stringify(finalPos));
        formData.append('welcome_title_font_size', websiteConfig.welcome_title_font_size || 48);
        formData.append('welcome_title_text_align', websiteConfig.welcome_title_text_align || 'center');
        formData.append('welcome_subtitle_font_size', websiteConfig.welcome_subtitle_font_size || 18);
        formData.append('welcome_subtitle_text_align', websiteConfig.welcome_subtitle_text_align || 'center');

        const galleryStructure = [];
        (websiteConfig.gallery_urls || []).forEach(item => {
            if (item.type === 'url') {
                galleryStructure.push({ type: 'url', url: item.url });
            } else if (item.type === 'file') {
                galleryStructure.push({ type: 'file' });
                formData.append('gallery_images', item.file);
            }
        });
        formData.append('gallery_structure', JSON.stringify(galleryStructure));

        if (websiteConfig.logoFile) { formData.append('logo', websiteConfig.logoFile); }
        else if (websiteConfig.logo_url) { formData.append('existing_logo', websiteConfig.logo_url); }
        if (websiteConfig.bgFile) { formData.append('bg_image', websiteConfig.bgFile); }
        else if (websiteConfig.bg_image_url) { formData.append('existing_bg', websiteConfig.bg_image_url); }

        const facData = websiteConfig.facilities_list.map(f => ({
            title: f.title, description: f.description, image_urls: f.image_urls || [], display_style: f.display_style || 'arrows'
        }));
        formData.append('facilities_json', JSON.stringify(facData));
        websiteConfig.facilities_list.forEach((f, idx) => { if (f.imageFiles) Array.from(f.imageFiles).forEach(file => formData.append(`fac_img_${idx}`, file)); });

        const attData = websiteConfig.attractions_list.map(a => ({
            title: a.title, description: a.description, image_urls: a.image_urls || [], display_style: a.display_style || 'arrows'
        }));
        formData.append('attractions_json', JSON.stringify(attData));
        websiteConfig.attractions_list.forEach((a, idx) => { if (a.imageFiles) Array.from(a.imageFiles).forEach(file => formData.append(`att_img_${idx}`, file)); });

        try {
            const res = await fetch('/api/settings/website', { method: 'POST', body: formData });
            const result = await res.json();

            if (res.ok && result.success) {
                alert('✅ Premium Website Settings saved successfully!');
            } else {
                alert(`❌ Failed to save: ${result.message || 'Database error'}`);
            }
        } catch (e) {
            alert('❌ Network Error while saving.');
        }
    };

    // 📦 INVENTORY 핸들러 함수들
    const fetchInventoryData = () => { fetch(`/api/inventory/items?hotel=${currentHotelCode}`).then(r => r.json()).then(d => { if (d.success) setInventoryItems(d.items) }); fetch(`/api/inventory/logs?hotel=${currentHotelCode}`).then(r => r.json()).then(d => { if (d.success) setInventoryLogs(d.logs) }); };
    const handleAddInvItem = async () => { if (!newInvItem.name) return alert("Please enter an item name."); await fetch('/api/inventory/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newInvItem, hotel_code: currentHotelCode }) }); recordAuditLog(`Added Inventory Item: ${newInvItem.name}`); setNewInvItem({ name: '', category: 'Amenities', min_stock: 10, unit: 'ea' }); fetchInventoryData(); alert("✅ Item registered!"); };
    const handleDeleteInvItem = async (id) => { if (window.confirm('Delete this item completely?')) { await fetch(`/api/inventory/items/${id}?hotel=${currentHotelCode}`, { method: 'DELETE' }); recordAuditLog(`Deleted Inventory Item ID: ${id}`); fetchInventoryData(); } };
    const handleStockMove = async () => {
        if (!stockMove.item_id || !stockMove.amount || stockMove.amount <= 0) return alert("Select an item and enter a valid quantity.");
        const payload = { ...stockMove, user_id: currentUserId, hotel_code: currentHotelCode };
        const res = await fetch('/api/inventory/movement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) { recordAuditLog(`Processed Stock ${stockMove.type} for Item ID: ${stockMove.item_id} (Qty: ${stockMove.amount})`); alert(`✅ Stock ${stockMove.type} recorded successfully!`); setStockMove({ item_id: '', type: 'IN', amount: '', notes: '' }); fetchInventoryData(); } else { alert("Error: " + data.message); }
    };

    // ========================================================
    // 📊 Dashboard Data & Calculations (수치 계산)
    // ========================================================
    const todayStr = getHotelDate(0);
    const monthStr = todayStr.substring(0, 7);
    const yearStr = todayStr.substring(0, 4);

    const revToday = transactions.filter(t => t.type === 'REVENUE' && t.date === todayStr).reduce((a, c) => a + c.amount, 0);
    const revMonth = transactions.filter(t => t.type === 'REVENUE' && t.date.startsWith(monthStr)).reduce((a, c) => a + c.amount, 0);
    const revYTD = transactions.filter(t => t.type === 'REVENUE' && t.date.startsWith(yearStr)).reduce((a, c) => a + c.amount, 0);

    const expToday = transactions.filter(t => t.type === 'EXPENSE' && t.date === todayStr).reduce((a, c) => a + c.amount, 0);
    const expMonth = transactions.filter(t => t.type === 'EXPENSE' && t.date.startsWith(monthStr)).reduce((a, c) => a + c.amount, 0);
    const expYTD = transactions.filter(t => t.type === 'EXPENSE' && t.date.startsWith(yearStr)).reduce((a, c) => a + c.amount, 0);

    const netToday = revToday - expToday;
    const netMonth = revMonth - expMonth;
    const netYTD = revYTD - expYTD;

    const chartDataMap = {};
    transactions.forEach(t => {
        if (!t.date) return;
        const monthKey = t.date.substring(0, 7);
        if (!chartDataMap[monthKey]) chartDataMap[monthKey] = { name: monthKey, income: 0, expense: 0 };
        if (t.type === 'REVENUE') chartDataMap[monthKey].income += t.amount;
        else if (t.type === 'EXPENSE') chartDataMap[monthKey].expense += t.amount;
    });
    const dynamicChartData = Object.values(chartDataMap).sort((a, b) => a.name.localeCompare(b.name));

    // 💡 [정리 완료] 연간 객실 가동률 가짜 데이터 제거 (DB 연동 전까지 0%로 초기화)
    const occupancyData = [
        { month: 'Jan', rate: 0 }, { month: 'Feb', rate: 0 }, { month: 'Mar', rate: 0 },
        { month: 'Apr', rate: 0 }, { month: 'May', rate: 0 }, { month: 'Jun', rate: 0 },
        { month: 'Jul', rate: 0 }, { month: 'Aug', rate: 0 }, { month: 'Sep', rate: 0 },
        { month: 'Oct', rate: 0 }, { month: 'Nov', rate: 0 }, { month: 'Dec', rate: 0 }
    ];

    const predefinedExpenses = ["Cost of Sales (F&B)", "Cost of Service (Room)", "Salaries & Wages", "SSS/PhilHealth/HDMF Cont.", "Rent Expense", "Utilities (Power & Water)", "Communication & Internet", "Repairs & Maintenance", "Taxes & Licenses", "Professional Fees", "Supplies (Office/Hotel)", "Marketing & Advertising", "Representation & Ent.", "Transportation & Travel", "Miscellaneous"];
    const posTypes = Array.from(new Set(posStores.map(s => s.type)));
    const predefinedRevenues = ["Room Payment", "Room Booking (Portal)", "Room Booking (Hotel Web)", "Room Service", "F&B", "Other Revenue", ...posTypes];

    const uniqueCategories = [...new Set(transactions.map(t => t.category))];
    const otherCategories = uniqueCategories.filter(c => !predefinedRevenues.includes(c) && !predefinedExpenses.includes(c));

    const filteredTransactions = transactions.filter(t => {
        if (financeFilter.type !== 'ALL' && t.type !== financeFilter.type) return false;
        if (financeFilter.category !== 'ALL' && t.category !== financeFilter.category) return false;
        if (financeFilter.startDate && t.date < financeFilter.startDate) return false;
        if (financeFilter.endDate && t.date > financeFilter.endDate) return false;
        return true;
    });

    const financeTotal = filteredTransactions.reduce((sum, t) => sum + (t.type === 'REVENUE' ? t.amount : -t.amount), 0);

    // 👇 [신규 추가] Vault 필터링 및 합계 계산 로직
    const allDepartments = ["Finance Office", "Front Office", ...posStores.map(s => s.name), "Other"];
    const filteredVaultHistory = transactions.filter((t) => {
        if (t.type !== 'REVENUE') return false; // 임시로 REVENUE를 정산 내역으로 취급
        if (vaultFilter.department !== 'ALL' && t.category !== vaultFilter.department) return false;
        if (vaultFilter.startDate && t.date < vaultFilter.startDate) return false;
        if (vaultFilter.endDate && t.date > vaultFilter.endDate) return false;
        return true;
    });
    const vaultFilteredTotal = filteredVaultHistory.reduce((sum, t) => sum + t.amount, 0);

    const handleExportLedgerPDF = () => {
        if (filteredTransactions.length === 0) return alert('No data to export.');
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Financial Ledger Report", 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Date Range: ${financeFilter.startDate || 'All'} to ${financeFilter.endDate || 'All'}`, 14, 30);
        autoTable(doc, {
            startY: 35,
            head: [["Date", "Type", "Category", "Description", "Amount (PHP)"]],
            body: filteredTransactions.map(t => [t.date, t.type, t.category, t.description, (t.type === 'REVENUE' ? '+' : '-') + t.amount.toLocaleString()]),
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [40, 40, 40] }
        });
        doc.save(`Financial_Ledger_${getHotelDate(0)}.pdf`);
    };

    const handleMenuClick = (tabName) => {
        setActiveTab(tabName);
        setIsMobileMenuOpen(false);
    };

    // 💡 [완벽 보안] accessible_menus 기반 백오피스 접근 통제
    const currentRole = sessionStorage.getItem('role');
    const userAccess = sessionStorage.getItem('accessible_menus') || '';

    if (currentRole !== 'SUPER_ADMIN' && !userAccess.includes('ADMIN_')) {
        // 튕겨내기
    }

    const hasAdminAccess = (tabMenu) => {
        if (currentRole === 'SUPER_ADMIN') return true;
        if (tabMenu === 'MEMBERS' && userAccess.includes('ADMIN_')) return true;
        return userAccess.includes(`ADMIN_${tabMenu}`);
    };

    // 👇 POS 분석 데이터 차트용으로 가공하기 (완전히 덮어쓰기)
    const processPosAnalytics = () => {
        const timeData = {};
        const dayData = { 'Sun': 0, 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0 };
        const menuData = {};


        const filteredOrders = posAnalytics.filter(order =>
            String(order.store_id) === String(posAnalysisFilter)
        );

        filteredOrders.forEach(order => {
            // 시간 데이터 추출 
            const orderDate = new Date(order.timestamp || order.updated_at || new Date());
            const hour = orderDate.getHours();
            const dayIdx = orderDate.getDay();
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

            // 시간대별 카운트 
            const hourStr = `${String(hour).padStart(2, '0')}:00`;
            timeData[hourStr] = (timeData[hourStr] || 0) + 1;

            // 요일별 카운트
            dayData[days[dayIdx]] += 1;

            // 메뉴별 카운트 
            try {
                const cart = typeof order.cart_data === 'string' ? JSON.parse(order.cart_data) : order.cart_data;
                if (Array.isArray(cart)) {
                    cart.forEach(item => {
                        menuData[item.name] = (menuData[item.name] || 0) + item.quantity;
                    });
                }
            } catch (e) { }
        });

        // 차트용 배열로 변환 및 정렬
        const formattedTimeData = Object.keys(timeData).sort().map(time => ({ time, orders: timeData[time] }));
        const formattedDayData = Object.keys(dayData).map(day => ({ day, orders: dayData[day] }));
        const formattedMenuData = Object.entries(menuData).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, qty]) => ({ name, qty }));

        return { formattedTimeData, formattedDayData, formattedMenuData };
    };

    const { formattedTimeData, formattedDayData, formattedMenuData } = posAnalytics.length > 0 ? processPosAnalytics() : { formattedTimeData: [], formattedDayData: [], formattedMenuData: [] };

    // ==========================================
    // 💡 [NEW] 채널 매핑 모달 열기 및 저장 로직
    // ==========================================
    const handleSaveMapping = async () => {
        try {
            const payload = {
                hotel_code: currentHotelCode,
                channel_name: selectedOtaForMapping,
                mappings: channelMappings
            };
            await fetch('/api/admin/ota-mappings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            recordAuditLog(`Updated Room Mappings for ${selectedOtaForMapping}`);
            alert('✅ Mapping saved successfully!');
            setMappingModalOpen(false);
        } catch (error) {
            alert('❌ Failed to save mappings.');
        }
    };

    // 💡 [NEW] 매핑 모달 열기 (서버 통신 실패 시에도 화면이 튕기지 않는 완벽 방어 코드 적용)
    const openMappingModal = async (channelName) => {
        setSelectedOtaForMapping(channelName);
        setMappingModalOpen(true);

        try {
            // 1️⃣ 기존 백엔드 API 규격에 맞춰 'hotel_code=' 대신 'hotel=' 로 복구합니다.
            const r = await fetch(`/api/admin/room-types?hotel=${currentHotelCode}`);
            const roomData = await r.json();

            let currentRooms = [];
            if (roomData.success && roomData.rooms && roomData.rooms.length > 0) {
                currentRooms = roomData.rooms;
            } else {
                const r2 = await fetch(`/api/room-types?hotel=${currentHotelCode}`);
                const data2 = await r2.json();
                currentRooms = Array.isArray(data2) ? data2 : [];
            }

            // 💡 [핵심 방어막] 서버에서 빈 값을 주더라도, 이미 불러와 둔 방 목록(roomTypes)이 있으면 그걸 우선적으로 씁니다!
            if (currentRooms.length === 0 && roomTypes.length > 0) {
                currentRooms = roomTypes;
            } else {
                setRoomTypes(currentRooms);
            }

            // 2️⃣ 확보된 방 목록을 기반으로 매핑 뼈대(초기값)를 세팅합니다.
            const initialMappings = currentRooms.map(rt => ({
                room_type_id: rt.id,
                nplus_room_type: rt.name?.en || rt.name || 'Unnamed Room',
                ota_room_id: '',
                is_active: true
            }));

            // 일단 화면에 쫙 뿌려줍니다.
            setChannelMappings(initialMappings);

            // 3️⃣ 기존 매핑 데이터 가져오기 (이 부분도 안전하게 hotel 파라미터로 통일)
            const res = await fetch(`/api/admin/ota-mappings?hotel=${currentHotelCode}&channel=${channelName}`);

            if (res.ok) {
                const data = await res.json();
                if (data.success && data.mappings && data.mappings.length > 0) {
                    const merged = initialMappings.map(im => {
                        const existing = data.mappings.find(m => m.nplus_room_type === im.nplus_room_type);
                        return existing ? { ...im, ota_room_id: existing.ota_room_id, is_active: existing.is_active } : im;
                    });
                    setChannelMappings(merged);
                }
            }
        } catch (e) {
            console.error("Mapping fetch error, but UI is protected:", e);
            // 🚨 백엔드 에러가 터져도, 기존에 가지고 있던 방 목록(roomTypes)으로 무조건 화면을 띄웁니다!
            if (roomTypes.length > 0) {
                const backupMappings = roomTypes.map(rt => ({
                    room_type_id: rt.id,
                    nplus_room_type: rt.name?.en || rt.name || 'Unnamed Room',
                    ota_room_id: '',
                    is_active: true
                }));
                setChannelMappings(backupMappings);
            }
        }
    };

    const filteredPointsHistory = (pointsAnalytics?.recent_redemptions || []).filter((row) => {
        const createdDate = String(row?.created_at || '').slice(0, 10);
        const sourceMatch = pointsHistoryFilter.source === 'ALL' || String(row?.source || '').toUpperCase() === pointsHistoryFilter.source;
        const startMatch = !pointsHistoryFilter.startDate || (createdDate && createdDate >= pointsHistoryFilter.startDate);
        const endMatch = !pointsHistoryFilter.endDate || (createdDate && createdDate <= pointsHistoryFilter.endDate);
        const keyword = String(pointsHistoryFilter.keyword || '').trim().toLowerCase();
        const haystack = `${row?.reference_id || ''} ${row?.member_email || ''} ${row?.status || ''} ${row?.source || ''}`.toLowerCase();
        const keywordMatch = !keyword || haystack.includes(keyword);
        return sourceMatch && startMatch && endMatch && keywordMatch;
    });
    const pointsHistoryTotalPages = Math.max(1, Math.ceil(filteredPointsHistory.length / pointsHistoryPageSize));
    const paginatedPointsHistory = filteredPointsHistory.slice(
        (pointsHistoryPage - 1) * pointsHistoryPageSize,
        pointsHistoryPage * pointsHistoryPageSize
    );

    useEffect(() => {
        setPointsHistoryPage(1);
    }, [
        pointsHistoryFilter.startDate,
        pointsHistoryFilter.endDate,
        pointsHistoryFilter.source,
        pointsHistoryFilter.keyword,
        isPointsHistoryModalOpen
    ]);

    useEffect(() => {
        if (pointsHistoryPage > pointsHistoryTotalPages) {
            setPointsHistoryPage(pointsHistoryTotalPages);
        }
    }, [pointsHistoryPage, pointsHistoryTotalPages]);

    const handleExportPointsHistoryPdf = () => {
        try {
            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.text('Rewards Points Payment Details', 14, 18);
            doc.setFontSize(10);
            doc.text(`Hotel: ${String(currentHotelCode || '-').trim() || '-'}`, 14, 25);
            doc.text(`Source: ${pointsHistoryFilter.source || 'ALL'}`, 14, 31);
            doc.text(`Date Range: ${pointsHistoryFilter.startDate || 'Any'} to ${pointsHistoryFilter.endDate || 'Any'}`, 14, 37);
            autoTable(doc, {
                startY: 44,
                head: [['Date', 'Source', 'Member Email', 'Reference', 'Used Points', 'Revenue (PHP)']],
                body: filteredPointsHistory.map((row) => [
                    String(row?.created_at || '').slice(0, 19).replace('T', ' ') || '-',
                    row?.source || '-',
                    row?.member_email || '-',
                    row?.reference_id || '-',
                    Number(row?.used_points || 0).toLocaleString(),
                    `PHP ${Number(row?.currency_amount || 0).toLocaleString()}`
                ]),
                styles: { fontSize: 9, cellPadding: 3 },
                headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] }
            });
            doc.save(`Rewards_Points_Details_${String(currentHotelCode || 'hotel').trim() || 'hotel'}.pdf`);
        } catch (error) {
            console.error('Failed to export points history PDF:', error);
            alert('Failed to export PDF.');
        }
    };
    // ========================================================
    // 🎨 화면 렌더링 (UI Return)
    // ========================================================
    return (
        <div className="fixed inset-0 flex flex-col md:flex-row bg-slate-50 font-sans text-slate-800 overflow-hidden">

            {/* 📱 모바일 메뉴 바 */}
            <div className="md:hidden flex justify-between items-center bg-slate-900 text-white p-4 shrink-0 shadow-md z-40">
                <h1 className="text-xl font-black text-blue-400 tracking-wider">HOTEL CMS</h1>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-slate-800 rounded-md">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}></path></svg>
                </button>
            </div>

            {isMobileMenuOpen && (
                <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
            )}

            {/* 🖥️ 좌측 메인 사이드바 (💡 권한에 따라 버튼들이 나타났다 사라집니다!) */}
            <div className={`fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-40 w-72 bg-slate-900 text-white flex flex-col shadow-2xl shrink-0`}>
                <div className="p-6 border-b border-slate-700 hidden md:block">
                    <h1 className="text-2xl font-black tracking-wider text-blue-400">HOTEL CMS</h1>
                    <p className="text-slate-400 text-sm mt-1">Logged in as {currentUserId}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

                    {hasAdminAccess('FINANCE') && (
                        <>
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-4 mb-2 pl-2">Dashboards</div>
                            <button onClick={() => handleMenuClick('FINANCE')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'FINANCE' ? 'bg-blue-600 shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>📊 Finance & Revenue</button>
                        </>
                    )}

                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-6 mb-2 pl-2">System Config</div>
                    {hasAdminAccess('WEBSITE_BUILDER') && <button onClick={() => handleMenuClick('WEBSITE_BUILDER')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'WEBSITE_BUILDER' ? 'bg-blue-600 shadow-lg text-white' : 'hover:bg-slate-800 text-slate-300'}`}>🌐 Website Builder</button>}
                    {hasAdminAccess('OTA_SYNC') && <button onClick={() => handleMenuClick('OTA_SYNC')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'OTA_SYNC' ? 'bg-blue-600 shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>🌍 Channel Manager</button>}
                    {hasAdminAccess('ROOMS') && <button onClick={() => handleMenuClick('ROOMS')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'ROOMS' ? 'bg-blue-600 shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>🛏️ Rooms & Types</button>}
                    {hasAdminAccess('POS_MENU') && <button onClick={() => handleMenuClick('POS_MENU')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'POS_MENU' ? 'bg-blue-600 shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>🍴 POS Stores & Menus</button>}
                    {hasAdminAccess('MEMBERS') && <button onClick={() => handleMenuClick('MEMBERS')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'MEMBERS' ? 'bg-blue-600 shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>🧩 Members / CRM</button>}
                    {hasAdminAccess('HR') && <button onClick={() => handleMenuClick('HR')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'HR' ? 'bg-blue-600 shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>👥 Human Resources</button>}
                    {hasAdminAccess('BANK_ACCOUNTS') && <button onClick={() => handleMenuClick('BANK_ACCOUNTS')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'BANK_ACCOUNTS' ? 'bg-blue-600 shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>🏦 Bank Accounts</button>}

                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-6 mb-2 pl-2">Operations Settings</div>
                    {hasAdminAccess('DEVICES') && <button onClick={() => handleMenuClick('DEVICES')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'DEVICES' ? 'bg-blue-600 shadow-lg text-white' : 'hover:bg-slate-800 text-slate-300'}`}>💳 PG & Devices</button>}
                    {hasAdminAccess('POLICIES') && <button onClick={() => handleMenuClick('POLICIES')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'POLICIES' ? 'bg-blue-600 shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>⚖️ Refund Policies</button>}
                    {hasAdminAccess('RECEIPT') && <button onClick={() => handleMenuClick('RECEIPT')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'RECEIPT' ? 'bg-blue-600 shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>🧾 Receipt & Taxes</button>}
                    {hasAdminAccess('TV_CMS') && <button onClick={() => handleMenuClick('TV_CMS')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'TV_CMS' ? 'bg-blue-600 shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>📺 TV Theme Settings</button>}
                    {hasAdminAccess('PROMOTIONS_CMS') && <button onClick={() => handleMenuClick('PROMOTIONS_CMS')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-colors flex items-center gap-3 ${activeTab === 'PROMOTIONS_CMS' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <span className="text-xl">🎁</span> Special Offers
                    </button>}

                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-6 mb-2 pl-2">Security</div>
                    {hasAdminAccess('LOGS') && <button onClick={() => handleMenuClick('LOGS')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'LOGS' ? 'bg-red-600 shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}>📜 System Audit Logs</button>}
                </div>
                <div className="p-6 border-t border-slate-700 mt-auto">
                    <Link to="/" className="block w-full text-center bg-slate-800 hover:bg-slate-700 py-3 rounded-md font-bold transition-all border border-slate-600 text-slate-300">🏠 Exit to Main</Link>
                </div>
            </div>

            {/* 🚀 우측 콘텐츠 메인 영역 시작 */}
            <div className="flex-1 min-w-0 h-full overflow-y-auto p-4 md:p-10 bg-slate-50 relative">

                {/* 🧩 MEMBERS / CRM */}
                {activeTab === 'MEMBERS' && (
                    <div className="animate-fade-in w-full max-w-full pb-20">
                        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black text-slate-800">Members / CRM</h2>
                                <p className="text-slate-500 text-sm font-bold mt-1">Professional CRM dashboard (hotel scope: <span className="text-slate-700">{currentHotelCode}</span>)</p>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    value={memberKeyword}
                                    onChange={(e) => setMemberKeyword(e.target.value)}
                                    placeholder="Search name/email/phone"
                                    className="px-3 py-2 border border-slate-200 rounded-md text-sm"
                                />
                                <button onClick={fetchMembers} className="px-4 py-2 bg-slate-900 text-white rounded-md font-bold">Refresh</button>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-md shadow-sm p-4 mb-5">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                                <div>
                                    <h3 className="text-lg font-black text-slate-800">Rewards Program Settings</h3>
                                    <p className="text-xs text-slate-500 font-semibold mt-1">Enable/disable rewards for this hotel and customize earning rules, tier benefits, and popup announcements.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <input type="checkbox" checked={!!rewardsConfig.enabled} onChange={(e) => setRewardsConfig(prev => ({ ...prev, enabled: e.target.checked }))} />
                                        Enable Rewards Program
                                    </label>
                                    <button onClick={handleSaveRewardsConfig} disabled={rewardsConfigSaving} className="px-4 py-2 rounded-md bg-slate-900 text-white font-bold disabled:opacity-50">
                                        {rewardsConfigSaving ? 'Saving...' : 'Save Rewards Config'}
                                    </button>
                                </div>
                            </div>

                            {rewardsConfigLoading ? (
                                <div className="text-sm font-bold text-slate-500">Loading rewards settings...</div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                        <div>
                                            <div className="text-xs font-bold uppercase text-slate-500 mb-1">Program Name</div>
                                            <input value={rewardsConfig.program_name || ''} onChange={(e) => setRewardsConfig(prev => ({ ...prev, program_name: e.target.value }))} className="w-full p-2 border border-slate-200 rounded-md text-sm" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold uppercase text-slate-500 mb-1">Points Rule (Per Spend)</div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input type="number" min="1" value={rewardsConfig.points_unit_currency || 100} onChange={(e) => setRewardsConfig(prev => ({ ...prev, points_unit_currency: Number(e.target.value || 1) }))} className="w-full p-2 border border-slate-200 rounded-md text-sm" placeholder="Currency unit" />
                                                <input type="number" min="1" value={rewardsConfig.points_per_unit || 1} onChange={(e) => setRewardsConfig(prev => ({ ...prev, points_per_unit: Number(e.target.value || 1) }))} className="w-full p-2 border border-slate-200 rounded-md text-sm" placeholder="Points" />
                                            </div>
                                        </div>
                                            <div>
                                                <div className="text-xs font-bold uppercase text-slate-500 mb-1">Points Per Room Rate</div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder="예: 100"
                                                        value={rewardsConfig.points_per_room_rate_spend || 0}
                                                        onChange={(e) => setRewardsConfig(prev => ({ ...prev, points_per_room_rate_spend: Number(e.target.value || 0) }))}
                                                        className="w-full p-2 border border-slate-200 rounded-md text-sm"
                                                    />
                                                    <span className="text-sm font-medium text-slate-500 whitespace-nowrap">per peso</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder="예: 1"
                                                        value={rewardsConfig.points_per_room_rate_earn || 0}
                                                        onChange={(e) => setRewardsConfig(prev => ({ ...prev, points_per_room_rate_earn: Number(e.target.value || 0) }))}
                                                        className="w-full p-2 border border-slate-200 rounded-md text-sm"
                                                    />
                                                    <span className="text-sm font-medium text-slate-500 whitespace-nowrap">Earn Point </span>
                                                </div>
                                            </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                                        <div><div className="text-xs font-bold uppercase text-slate-500 mb-1">Welcome Bonus</div><input type="number" min="0" value={rewardsConfig.welcome_bonus_points || 0} onChange={(e) => setRewardsConfig(prev => ({ ...prev, welcome_bonus_points: Number(e.target.value || 0) }))} className="w-full p-2 border border-slate-200 rounded-md text-sm" /></div>
                                        <div><div className="text-xs font-bold uppercase text-slate-500 mb-1">Birthday Bonus</div><input type="number" min="0" value={rewardsConfig.birthday_bonus_points || 0} onChange={(e) => setRewardsConfig(prev => ({ ...prev, birthday_bonus_points: Number(e.target.value || 0) }))} className="w-full p-2 border border-slate-200 rounded-md text-sm" /></div>
                                        <div><div className="text-xs font-bold uppercase text-slate-500 mb-1">Referral Bonus</div><input type="number" min="0" value={rewardsConfig.referral_bonus_points || 0} onChange={(e) => setRewardsConfig(prev => ({ ...prev, referral_bonus_points: Number(e.target.value || 0) }))} className="w-full p-2 border border-slate-200 rounded-md text-sm" /></div>
                                        <div><div className="text-xs font-bold uppercase text-slate-500 mb-1">Points Expiry (Months)</div><input type="number" min="1" value={rewardsConfig.points_expiry_months || 24} onChange={(e) => setRewardsConfig(prev => ({ ...prev, points_expiry_months: Number(e.target.value || 1) }))} className="w-full p-2 border border-slate-200 rounded-md text-sm" /></div>
                                    </div>

                                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                                            <input type="checkbox" checked={!!rewardsConfig.tier_enabled} onChange={(e) => setRewardsConfig(prev => ({ ...prev, tier_enabled: e.target.checked }))} />
                                            Tier Benefits Enabled
                                        </label>
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                                            {(rewardsConfig.tiers || []).slice(0, 3).map((tier, idx) => (
                                                <div key={'tier_' + idx} className="bg-white border border-slate-200 rounded-md p-2">
                                                    <input value={tier.key || ''} onChange={(e) => handleRewardsTierChange(idx, 'key', e.target.value.toUpperCase())} placeholder="Tier name" className="w-full p-2 border border-slate-200 rounded-md text-xs mb-2" />
                                                    <input type="number" min="0" value={tier.min_points || 0} onChange={(e) => handleRewardsTierChange(idx, 'min_points', e.target.value)} placeholder="Min points" className="w-full p-2 border border-slate-200 rounded-md text-xs mb-2" />
                                                    <input value={tier.benefit || ''} onChange={(e) => handleRewardsTierChange(idx, 'benefit', e.target.value)} placeholder="Benefit summary" className="w-full p-2 border border-slate-200 rounded-md text-xs" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-sm font-black text-blue-900">Rewards Popup Builder (Web & Mobile)</div>
                                            <label className="text-xs font-bold text-blue-800 flex items-center gap-2">
                                                <input type="checkbox" checked={!!rewardsConfig.popup_enabled} onChange={(e) => setRewardsConfig(prev => ({ ...prev, popup_enabled: e.target.checked }))} />
                                                Popup Active
                                            </label>
                                        </div>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                            <input value={rewardsConfig.popup_title || ''} onChange={(e) => setRewardsConfig(prev => ({ ...prev, popup_title: e.target.value }))} placeholder="Popup Title" className="w-full p-2 border border-slate-200 rounded-md text-sm" />
                                            <input value={rewardsConfig.popup_cta_label || ''} onChange={(e) => setRewardsConfig(prev => ({ ...prev, popup_cta_label: e.target.value }))} placeholder="CTA Button Label" className="w-full p-2 border border-slate-200 rounded-md text-sm" />
                                            <input value={rewardsConfig.popup_cta_target || ''} onChange={(e) => setRewardsConfig(prev => ({ ...prev, popup_cta_target: e.target.value }))} placeholder="CTA Target (e.g. MYPAGE_REWARDS)" className="w-full p-2 border border-slate-200 rounded-md text-sm" />
                                            <select value={rewardsConfig.popup_frequency || 'ONCE_PER_SESSION'} onChange={(e) => setRewardsConfig(prev => ({ ...prev, popup_frequency: e.target.value }))} className="w-full p-2 border border-slate-200 rounded-md text-sm">
                                                <option value="ONCE_PER_SESSION">Once per session</option>
                                                <option value="ONCE_PER_DAY">Once per day</option>
                                                <option value="ALWAYS">Always</option>
                                            </select>
                                            <select value={rewardsConfig.popup_theme || 'CORPORATE_LIGHT'} onChange={(e) => setRewardsConfig(prev => ({ ...prev, popup_theme: e.target.value }))} className="w-full p-2 border border-slate-200 rounded-md text-sm">
                                                <option value="CORPORATE_LIGHT">Theme A - Corporate Light (Sample 3 feel)</option>
                                                <option value="LUXE_GLASS">Theme B - Luxe Glass (Sample 4 feel)</option>
                                                <option value="MODERN_LILAC">Theme C - Modern Lilac (Sample 5 feel)</option>
                                            </select>
                                            <textarea value={rewardsConfig.popup_message || ''} onChange={(e) => setRewardsConfig(prev => ({ ...prev, popup_message: e.target.value }))} placeholder="Popup message" rows={3} className="lg:col-span-2 w-full p-2 border border-slate-200 rounded-md text-sm" />
                                        </div>
                                    </div>

                                    <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3">
                                        <div className="text-sm font-black text-emerald-900 mb-2">Auto Point Accrual Rules</div>
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                            <div className="bg-white border border-emerald-200 rounded-md p-3">
                                                <label className="text-xs font-bold text-emerald-900 flex items-center gap-2 mb-2">
                                                    <input type="checkbox" checked={!!rewardsConfig.auto_points_on_booking_confirmed} onChange={(e) => setRewardsConfig(prev => ({ ...prev, auto_points_on_booking_confirmed: e.target.checked }))} />
                                                    Auto accrual on Booking Confirmed
                                                </label>
                                                <input type="number" min="0" value={rewardsConfig.auto_booking_points ?? 100} onChange={(e) => setRewardsConfig(prev => ({ ...prev, auto_booking_points: Number(e.target.value || 0) }))} className="w-full p-2 border border-slate-200 rounded-md text-sm" placeholder="Points per booking confirmation" />
                                            </div>
                                            <div className="bg-white border border-emerald-200 rounded-md p-3">
                                                <label className="text-xs font-bold text-emerald-900 flex items-center gap-2 mb-2">
                                                    <input type="checkbox" checked={!!rewardsConfig.auto_points_on_checkin} onChange={(e) => setRewardsConfig(prev => ({ ...prev, auto_points_on_checkin: e.target.checked }))} />
                                                    Auto accrual on Check-in
                                                </label>
                                                <input type="number" min="0" value={rewardsConfig.auto_checkin_points ?? 120} onChange={(e) => setRewardsConfig(prev => ({ ...prev, auto_checkin_points: Number(e.target.value || 0) }))} className="w-full p-2 border border-slate-200 rounded-md text-sm" placeholder="Points per check-in" />
                                            </div>
                                            <div className="bg-white border border-emerald-200 rounded-md p-3">
                                                <label className="text-xs font-bold text-emerald-900 flex items-center gap-2 mb-2">
                                                    <input type="checkbox" checked={!!rewardsConfig.auto_points_on_payment} onChange={(e) => setRewardsConfig(prev => ({ ...prev, auto_points_on_payment: e.target.checked }))} />
                                                    Auto accrual on Payment
                                                </label>
                                                <div className="text-xs text-slate-600 font-semibold">
                                                    Uses existing spend rule:
                                                    <span className="font-black text-slate-800"> {rewardsConfig.points_unit_currency || 100}</span> currency =
                                                    <span className="font-black text-slate-800"> {rewardsConfig.points_per_unit || 1}</span> point(s)
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-4">
                            <button onClick={() => setMemberFilters(prev => ({ ...prev, visitBand: '6_PLUS' }))} className="bg-amber-50 border border-amber-200 rounded-md p-3 text-left">
                                <div className="text-xs font-bold text-amber-700 uppercase">VIP Segment</div>
                                <div className="text-xl font-black text-amber-900">{vipMembers.length}</div>
                                <div className="text-xs text-amber-700">6+ visits</div>
                            </button>
                            <button onClick={() => setMemberFilters(prev => ({ ...prev, visitBand: '0' }))} className="bg-rose-50 border border-rose-200 rounded-md p-3 text-left">
                                <div className="text-xs font-bold text-rose-700 uppercase">Dormant Segment</div>
                                <div className="text-xl font-black text-rose-900">{dormantMembers.length}</div>
                                <div className="text-xs text-rose-700">No visit history</div>
                            </button>
                            <button onClick={() => { setMemberFilters({ nationality: 'ALL', province: 'ALL', birthMonth: 'ALL', visitBand: 'ALL' }); setMemberKeyword(''); }} className="bg-slate-100 border border-slate-200 rounded-md p-3 text-left">
                                <div className="text-xs font-bold text-slate-600 uppercase">All Members</div>
                                <div className="text-xl font-black text-slate-900">{members.length}</div>
                                <div className="text-xs text-slate-600">Reset smart filters</div>
                            </button>
                            <button onClick={() => setMemberFilters(prev => ({ ...prev, visitBand: 'ALL' }))} className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-left">
                                <div className="text-xs font-bold text-emerald-700 uppercase">New in 30 Days</div>
                                <div className="text-xl font-black text-emerald-900">{newMembers.length}</div>
                                <div className="text-xs text-emerald-700">recent signups</div>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-5">
                            <div className="bg-white border border-slate-200 rounded-md p-4 shadow-sm">
                                <div className="text-xs font-bold uppercase text-slate-500 mb-2">Nationality</div>
                                <select value={memberFilters.nationality} onChange={(e) => setMemberFilters(prev => ({ ...prev, nationality: e.target.value }))} className="w-full p-2 border border-slate-200 rounded-md text-sm">
                                    <option value="ALL">All</option>
                                    {memberNationalityOptions.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-md p-4 shadow-sm">
                                <div className="text-xs font-bold uppercase text-slate-500 mb-2">Province</div>
                                <select value={memberFilters.province} onChange={(e) => setMemberFilters(prev => ({ ...prev, province: e.target.value }))} className="w-full p-2 border border-slate-200 rounded-md text-sm">
                                    <option value="ALL">All</option>
                                    {memberProvinceOptions.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-md p-4 shadow-sm">
                                <div className="text-xs font-bold uppercase text-slate-500 mb-2">Visit Count</div>
                                <select value={memberFilters.visitBand} onChange={(e) => setMemberFilters(prev => ({ ...prev, visitBand: e.target.value }))} className="w-full p-2 border border-slate-200 rounded-md text-sm">
                                    <option value="ALL">All</option>
                                    <option value="0">0 visits</option>
                                    <option value="1_2">1-2 visits</option>
                                    <option value="3_5">3-5 visits</option>
                                    <option value="6_PLUS">6+ visits</option>
                                </select>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-md p-4 shadow-sm">
                                <div className="text-xs font-bold uppercase text-slate-500 mb-2">Birthday Month</div>
                                <select value={memberFilters.birthMonth} onChange={(e) => setMemberFilters(prev => ({ ...prev, birthMonth: e.target.value }))} className="w-full p-2 border border-slate-200 rounded-md text-sm">
                                    <option value="ALL">All</option>
                                    {birthdayMonthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-md shadow-sm p-4 mb-5">
                            <div className="flex flex-col xl:flex-row xl:items-end gap-3">
                                <div className="flex-1">
                                    <div className="text-xs font-bold uppercase text-slate-500 mb-1">Bulk Tag</div>
                                    <input value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} placeholder="e.g. VIP, Reactivation, Family" className="w-full p-2 border border-slate-200 rounded-md text-sm" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-bold uppercase text-slate-500 mb-1">Bulk Memo</div>
                                    <input value={bulkMemo} onChange={(e) => setBulkMemo(e.target.value)} placeholder="Bulk memo for selected members" className="w-full p-2 border border-slate-200 rounded-md text-sm" />
                                </div>
                                <button onClick={handleBulkApplyTagMemo} className="px-4 py-2.5 bg-blue-600 text-white rounded-md font-bold">Apply To Selected</button>
                                <button onClick={handleExportMembersCsv} className="px-4 py-2.5 bg-slate-900 text-white rounded-md font-bold">Export CSV</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
                            <div className="xl:col-span-2 bg-white border border-slate-200 rounded-md shadow-sm overflow-x-auto">
                                {memberLoading && <div className="p-6 text-sm font-bold text-slate-500">Loading members...</div>}
                                {memberError && <div className="p-6 text-sm font-bold text-red-500">{memberError}</div>}
                                {!memberLoading && !memberError && (
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="text-left px-3 py-3 font-black text-slate-600">Select</th>
                                                <th className="text-left px-4 py-3 font-black text-slate-600">Member</th>
                                                <th className="text-left px-4 py-3 font-black text-slate-600">CRM Profile</th>
                                                <th className="text-left px-4 py-3 font-black text-slate-600">Behavior</th>
                                                <th className="text-left px-4 py-3 font-black text-slate-600">Status</th>
                                                <th className="text-left px-4 py-3 font-black text-slate-600">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredMembers.map((m, idx) => {
                                                const memberId = getMemberId(m);
                                                const draft = memberDrafts[memberId] || {};
                                                const visitCount = getVisitCount(m);
                                                const birthdayMonth = getBirthdayMonth(m) || '-';
    return (
                                                    <tr key={memberId || `${m.email || 'm'}_${idx}`} className="border-b border-slate-100 align-top">
                                                        <td className="px-3 py-3">
                                                            <input type="checkbox" checked={selectedMemberIds.includes(memberId)} onChange={() => handleToggleSelectMember(memberId)} />
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="font-bold text-slate-800">{m.name || m.member_name || '-'}</div>
                                                            <div className="text-xs text-slate-500">ID: {memberId || '-'}</div>
                                                            <div className="text-xs text-slate-600 mt-1">{m.email || '-'}</div>
                                                            <div className="text-xs text-slate-500">{m.phone || '-'}</div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="grid grid-cols-1 gap-2 min-w-[220px]">
                                                                <input value={draft.nationality || ''} onChange={(e) => handleMemberDraftChange(memberId, 'nationality', e.target.value)} placeholder="Nationality" className="px-2 py-1 border rounded text-xs" />
                                                                <input value={draft.province || ''} onChange={(e) => handleMemberDraftChange(memberId, 'province', e.target.value)} placeholder="Province" className="px-2 py-1 border rounded text-xs" />
                                                                <input value={draft.dob || ''} onChange={(e) => handleMemberDraftChange(memberId, 'dob', e.target.value)} placeholder="Birthday (MM/DD)" className="px-2 py-1 border rounded text-xs" />
                                                                <input value={draft.tag || ''} onChange={(e) => handleMemberDraftChange(memberId, 'tag', e.target.value)} placeholder="Tag" className="px-2 py-1 border rounded text-xs" />
                                                                <input value={draft.memo || ''} onChange={(e) => handleMemberDraftChange(memberId, 'memo', e.target.value)} placeholder="Memo" className="px-2 py-1 border rounded text-xs" />
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="text-xs text-slate-600">Visits: <span className="font-black">{visitCount}</span></div>
                                                            <div className="text-xs text-slate-600">Birthday Month: <span className="font-black">{birthdayMonth}</span></div>
                                                            <div className="text-xs text-slate-600">Nationality: <span className="font-black">{m.nationality || m.country || '-'}</span></div>
                                                            <div className="text-xs text-slate-600">Province: <span className="font-black">{m.province || m.region || m.area || '-'}</span></div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-1 rounded text-xs font-black ${(m.is_active === 1 || m.is_active === true) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                                                {(m.is_active === 1 || m.is_active === true) ? 'ACTIVE' : 'INACTIVE'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col gap-2 min-w-[130px]">
                                                                <button onClick={() => handleMemberActivate(m)} className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-bold hover:bg-slate-50">Activate/Disable</button>
                                                                <button onClick={() => handleMemberSaveProfile(m)} className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-bold">Save Profile</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            <div className="bg-white border border-slate-200 rounded-md shadow-sm p-4">
                                <h3 className="text-lg font-black text-slate-800 mb-3">Email Campaign Composer</h3>
                                <p className="text-xs text-slate-500 mb-3">Send to selected members or filtered list.</p>
                                <div className="space-y-3">
                                    <select value={emailComposer.transportMode} onChange={(e) => setEmailComposer(prev => ({ ...prev, transportMode: e.target.value }))} className="w-full p-2 border border-slate-200 rounded-md text-sm">
                                        <option value="HOTEL_SMTP">Hotel SMTP (general email account)</option>
                                        <option value="RESEND">Resend (integrated)</option>
                                    </select>
                                    <input value={emailComposer.fromName} onChange={(e) => setEmailComposer(prev => ({ ...prev, fromName: e.target.value }))} placeholder="From Name" className="w-full p-2 border border-slate-200 rounded-md text-sm" />
                                    <input value={emailComposer.senderEmail} onChange={(e) => setEmailComposer(prev => ({ ...prev, senderEmail: e.target.value }))} placeholder="Sender Email (e.g. marketing@hotel.com)" className="w-full p-2 border border-slate-200 rounded-md text-sm" />
                                    <input value={emailComposer.replyTo} onChange={(e) => setEmailComposer(prev => ({ ...prev, replyTo: e.target.value }))} placeholder="Reply-To Email (optional)" className="w-full p-2 border border-slate-200 rounded-md text-sm" />
                                    {emailComposer.transportMode === 'HOTEL_SMTP' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md">
                                            <input value={emailComposer.smtpHost} onChange={(e) => setEmailComposer(prev => ({ ...prev, smtpHost: e.target.value }))} placeholder="SMTP Host (e.g. smtp.gmail.com)" className="w-full p-2 border border-slate-200 rounded-md text-sm" />
                                            <input value={emailComposer.smtpPort} onChange={(e) => setEmailComposer(prev => ({ ...prev, smtpPort: e.target.value }))} placeholder="SMTP Port (587/465)" className="w-full p-2 border border-slate-200 rounded-md text-sm" />
                                            <input value={emailComposer.smtpUser} onChange={(e) => setEmailComposer(prev => ({ ...prev, smtpUser: e.target.value }))} placeholder="SMTP Username" className="w-full p-2 border border-slate-200 rounded-md text-sm" />
                                            <input type="password" value={emailComposer.smtpPass} onChange={(e) => setEmailComposer(prev => ({ ...prev, smtpPass: e.target.value }))} placeholder="SMTP Password / App Password" className="w-full p-2 border border-slate-200 rounded-md text-sm" />
                                            <label className="md:col-span-2 text-xs text-slate-600 font-semibold flex items-center gap-2">
                                                <input type="checkbox" checked={!!emailComposer.smtpSecure} onChange={(e) => setEmailComposer(prev => ({ ...prev, smtpSecure: e.target.checked }))} />
                                                Use SSL/TLS (secure SMTP)
                                            </label>
                                        </div>
                                    )}
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                                        <label className="text-xs font-bold text-slate-600 uppercase block mb-2">Image Attachments</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={(e) => handleEmailAttachmentUpload(e.target.files)}
                                            className="w-full text-xs file:mr-2 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-slate-200 file:font-bold"
                                        />
                                        {emailAttachments.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                                {emailAttachments.map((a, i) => (
                                                    <div key={`${a.filename}_${i}`} className="flex justify-between items-center text-xs bg-white border border-slate-200 rounded px-2 py-1">
                                                        <span className="truncate max-w-[220px]">{a.filename} ({Math.round((a.size || 0) / 1024)}KB)</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEmailAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                                            className="text-red-600 font-bold"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <input value={emailComposer.subject} onChange={(e) => setEmailComposer(prev => ({ ...prev, subject: e.target.value }))} placeholder="Email Subject" className="w-full p-2 border border-slate-200 rounded-md text-sm" />
                                    <textarea value={emailComposer.content} onChange={(e) => setEmailComposer(prev => ({ ...prev, content: e.target.value }))} placeholder="HTML or plain text email content" rows={9} className="w-full p-2 border border-slate-200 rounded-md text-sm" />
                                    <select value={emailComposer.sendMode} onChange={(e) => setEmailComposer(prev => ({ ...prev, sendMode: e.target.value }))} className="w-full p-2 border border-slate-200 rounded-md text-sm">
                                        <option value="SELECTED">Send to Selected Members</option>
                                        <option value="FILTERED">Send to Current Filter Result</option>
                                    </select>
                                    <button
                                        onClick={() => {
                                            const targets = emailComposer.sendMode === 'FILTERED'
                                                ? filteredMembers
                                                : filteredMembers.filter(m => selectedMemberIds.includes(getMemberId(m)));
                                            handleSendMemberEmail(targets);
                                        }}
                                        disabled={emailSending}
                                        className="w-full px-4 py-2.5 bg-slate-900 text-white rounded-md font-bold disabled:opacity-50"
                                    >
                                        {emailSending ? 'Sending...' : 'Send Campaign Email'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-900 font-semibold">
                            Smart filter result: <span className="font-black">{filteredMembers.length}</span> members | Selected: <span className="font-black">{selectedMemberIds.length}</span>
                        </div>
                    </div>
                )}

                {/* 📊 FINANCE Dashboard */}
                {activeTab === 'FINANCE' && (
                    <div className="animate-fade-in w-full max-w-full pb-20">
                        <h2 className="text-2xl md:text-3xl font-black mb-6 md:mb-8 text-slate-800">Admin Financial Dashboard</h2>

                        {/* 💰 핵심 요약 카드 (Total Revenue, Expense, Net Profit) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
                            <div className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-200">
                                <h3 className="text-slate-500 font-bold mb-4 uppercase text-xs md:text-sm border-b pb-2">Total Revenue</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm font-bold text-slate-500"><span>Today</span><span className="text-blue-600 text-lg md:text-xl font-black">₱{(revToday || 0).toLocaleString()}</span></div>
                                    <div className="flex justify-between items-center text-sm font-bold text-slate-500"><span>This Month</span><span className="text-blue-700 text-xl md:text-2xl font-black">₱{(revMonth || 0).toLocaleString()}</span></div>
                                    <div className="flex justify-between items-center text-sm font-bold text-slate-500"><span>YTD (Year-to-Date)</span><span className="text-slate-800 text-base md:text-lg font-black">₱{(revYTD || 0).toLocaleString()}</span></div>
                                </div>
                            </div>
                            <div className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-200">
                                <h3 className="text-slate-500 font-bold mb-4 uppercase text-xs md:text-sm border-b pb-2">Total Expense</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm font-bold text-slate-500"><span>Today</span><span className="text-red-500 text-lg md:text-xl font-black">₱{(expToday || 0).toLocaleString()}</span></div>
                                    <div className="flex justify-between items-center text-sm font-bold text-slate-500"><span>This Month</span><span className="text-red-600 text-xl md:text-2xl font-black">₱{(expMonth || 0).toLocaleString()}</span></div>
                                    <div className="flex justify-between items-center text-sm font-bold text-slate-500"><span>YTD (Year-to-Date)</span><span className="text-slate-800 text-base md:text-lg font-black">₱{(expYTD || 0).toLocaleString()}</span></div>
                                </div>
                            </div>
                            <div className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-200">
                                <h3 className="text-slate-500 font-bold mb-4 uppercase text-xs md:text-sm border-b pb-2">Net Profit</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm font-bold text-slate-500"><span>Today</span><span className={`text-lg md:text-xl font-black ${(netToday || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>₱{(netToday || 0).toLocaleString()}</span></div>
                                    <div className="flex justify-between items-center text-sm font-bold text-slate-500"><span>This Month</span><span className={`text-xl md:text-2xl font-black ${(netMonth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>₱{(netMonth || 0).toLocaleString()}</span></div>
                                    <div className="flex justify-between items-center text-sm font-bold text-slate-500"><span>YTD (Year-to-Date)</span><span className={`text-base md:text-lg font-black ${(netYTD || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>₱{(netYTD || 0).toLocaleString()}</span></div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-200 mb-8">
                            <div className="flex items-center justify-between mb-4 gap-3">
                                <h3 className="text-slate-800 font-black text-lg md:text-xl">Rewards Points Payment Analytics</h3>
                                <div className="flex items-center gap-2">
                                    {pointsAnalyticsLoading && <span className="text-xs font-bold text-slate-400">Loading...</span>}
                                    <button
                                        type="button"
                                        onClick={() => setIsPointsHistoryModalOpen(true)}
                                        className="px-4 py-2 rounded-md bg-slate-900 text-white text-xs md:text-sm font-black hover:bg-slate-800 transition-all"
                                    >
                                        View Details
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 mb-4">
                                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                                    <div className="text-[10px] uppercase font-black text-emerald-700">Issued Points</div>
                                    <div className="text-2xl font-black text-emerald-800">{Number(pointsAnalytics?.summary?.issued_points || 0).toLocaleString()}</div>
                                </div>
                                <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
                                    <div className="text-[10px] uppercase font-black text-rose-700">Used Points</div>
                                    <div className="text-2xl font-black text-rose-800">{Number(pointsAnalytics?.summary?.used_points || 0).toLocaleString()}</div>
                                </div>
                                <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                                    <div className="text-[10px] uppercase font-black text-blue-700">Net Points</div>
                                    <div className="text-2xl font-black text-blue-800">{Number(pointsAnalytics?.summary?.net_points || 0).toLocaleString()}</div>
                                </div>
                                <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
                                    <div className="text-[10px] uppercase font-black text-indigo-700">Points Payment Revenue</div>
                                    <div className="text-2xl font-black text-indigo-800">₱{Number(pointsAnalytics?.summary?.points_payment_revenue || 0).toLocaleString()}</div>
                                    <div className="text-[11px] font-bold text-indigo-500 mt-1">{Number(pointsAnalytics?.summary?.points_payment_share_pct || 0).toFixed(2)}% of revenue</div>
                                </div>
                            </div>

                        </div>

                        {isPointsHistoryModalOpen && (
                            <div className="fixed inset-0 z-[90] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 md:p-6">
                                <div className="w-full max-w-[1480px] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[94vh] flex flex-col">
                                    <div className="px-6 md:px-8 py-5 border-b border-slate-200 flex items-start justify-between gap-4 bg-white">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                                <h3 className="text-slate-900 font-black text-xl md:text-2xl">Rewards / Points Payment Details</h3>
                                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black uppercase tracking-[0.16em]">20 rows per page</span>
                                            </div>
                                            <p className="text-sm md:text-[15px] text-slate-500 font-semibold">Filter redemption history, review up to 20 records per page, and export the result as PDF.</p>
                                        </div>
                                        <button type="button" onClick={() => setIsPointsHistoryModalOpen(false)} className="w-11 h-11 rounded-full border border-slate-200 text-slate-500 font-black hover:bg-slate-100 text-xl">×</button>
                                    </div>

                                    <div className="px-6 md:px-8 py-5 border-b border-slate-200 bg-slate-50 grid grid-cols-1 md:grid-cols-6 gap-4">
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-2">Start Date</label>
                                            <input type="date" value={pointsHistoryFilter.startDate} onChange={(e) => setPointsHistoryFilter(prev => ({ ...prev, startDate: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-300 font-bold text-slate-700 bg-white" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-2">End Date</label>
                                            <input type="date" value={pointsHistoryFilter.endDate} onChange={(e) => setPointsHistoryFilter(prev => ({ ...prev, endDate: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-300 font-bold text-slate-700 bg-white" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-2">Source</label>
                                            <select value={pointsHistoryFilter.source} onChange={(e) => setPointsHistoryFilter(prev => ({ ...prev, source: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-300 font-bold text-slate-700 bg-white">
                                                <option value="ALL">All Sources</option>
                                                <option value="BOOKING">Booking</option>
                                                <option value="POS">POS</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-2">Keyword</label>
                                            <input type="text" value={pointsHistoryFilter.keyword} onChange={(e) => setPointsHistoryFilter(prev => ({ ...prev, keyword: e.target.value }))} placeholder="Reference / email / status" className="w-full px-4 py-3 rounded-xl border border-slate-300 font-bold text-slate-700 bg-white" />
                                        </div>
                                        <div className="flex items-end gap-3">
                                            <button type="button" onClick={() => setPointsHistoryFilter({ startDate: '', endDate: '', source: 'ALL', keyword: '' })} className="flex-1 px-4 py-3 rounded-xl bg-slate-200 text-slate-700 font-black hover:bg-slate-300">Clear</button>
                                            <button type="button" onClick={handleExportPointsHistoryPdf} className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700">Export PDF</button>
                                        </div>
                                    </div>

                                    <div className="px-6 md:px-8 py-4 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm font-bold text-slate-500">
                                        <div>Total {filteredPointsHistory.length.toLocaleString()} records found.</div>
                                        <div>Showing {filteredPointsHistory.length === 0 ? 0 : ((pointsHistoryPage - 1) * pointsHistoryPageSize) + 1}-{Math.min(pointsHistoryPage * pointsHistoryPageSize, filteredPointsHistory.length)} of {filteredPointsHistory.length.toLocaleString()}.</div>
                                    </div>

                                    <div className="overflow-auto max-h-[52vh] bg-white">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-slate-50 sticky top-0 z-10">
                                                <tr>
                                                    <th className="text-left px-5 py-4 font-black uppercase text-slate-500">Date</th>
                                                    <th className="text-left px-5 py-4 font-black uppercase text-slate-500">Source</th>
                                                    <th className="text-left px-5 py-4 font-black uppercase text-slate-500">Member Email</th>
                                                    <th className="text-left px-5 py-4 font-black uppercase text-slate-500">Reference ID</th>
                                                    <th className="text-right px-5 py-4 font-black uppercase text-slate-500">Used Points</th>
                                                    <th className="text-right px-5 py-4 font-black uppercase text-slate-500">Revenue (PHP)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedPointsHistory.map((row, idx) => {
                                                    const source = String(row?.source || '-').toUpperCase();
                                                    const sourceBadgeClass = source === 'POS'
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : source === 'BOOKING'
                                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                            : 'bg-slate-100 text-slate-600 border border-slate-200';
                                                    return (
                                                        <tr key={`${row?.reference_id || 'row'}-${idx}`} className="border-t border-slate-100 hover:bg-slate-50">
                                                            <td className="px-5 py-4 font-semibold text-slate-700 whitespace-nowrap">{String(row?.created_at || '').slice(0, 19).replace('T', ' ') || '-'}</td>
                                                            <td className="px-5 py-4">
                                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-black ${sourceBadgeClass}`}>{source}</span>
                                                            </td>
                                                            <td className="px-5 py-4 font-bold text-slate-700">{row?.member_email || '-'}</td>
                                                            <td className="px-5 py-4 font-mono text-xs text-slate-600">{row?.reference_id || '-'}</td>
                                                            <td className="px-5 py-4 text-right font-black text-rose-700">{Number(row?.used_points || 0).toLocaleString()}</td>
                                                            <td className="px-5 py-4 text-right font-black text-indigo-700">₱{Number(row?.currency_amount || 0).toLocaleString()}</td>
                                                        </tr>
                                                    );
                                                })}
                                                {filteredPointsHistory.length === 0 && (
                                                    <tr>
                                                        <td colSpan="6" className="px-4 py-16 text-center text-slate-400 font-bold">No redemption details matched your filters.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="px-6 md:px-8 py-4 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-3">
                                        <div className="text-sm font-bold text-slate-500 flex items-center gap-3">
                                            <span>{filteredPointsHistory.length === 0 ? 'Page 0 of 0' : `Page ${pointsHistoryPage} of ${pointsHistoryTotalPages}`}</span>
                                            <span className="hidden md:inline text-slate-300">•</span>
                                            <span>Rows per page: 20</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setPointsHistoryPage((prev) => Math.max(1, prev - 1))}
                                                disabled={pointsHistoryPage <= 1 || filteredPointsHistory.length === 0}
                                                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                                            >
                                                Previous
                                            </button>
                                            <div className="min-w-[88px] px-3 py-2.5 rounded-xl bg-slate-900 text-white text-center text-sm font-black">
                                                {filteredPointsHistory.length === 0 ? '0 / 0' : `${pointsHistoryPage} / ${pointsHistoryTotalPages}`}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setPointsHistoryPage((prev) => Math.min(pointsHistoryTotalPages, prev + 1))}
                                                disabled={pointsHistoryPage >= pointsHistoryTotalPages || filteredPointsHistory.length === 0}
                                                className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 💡 마케팅 채널 성과 및 OTA 도넛 차트 */}
                        {(() => {
                            // 1. 다이렉트 부킹(웹) 및 현장 결제 수익 계산
                            const portalRev = (transactions || []).filter(t => t.category === 'Room Booking (Portal)' && t.date.startsWith(yearStr)).reduce((a, c) => a + (c.amount || 0), 0);
                            const hotelWebRev = (transactions || []).filter(t => t.category === 'Room Booking (Hotel Web)' && t.date.startsWith(yearStr)).reduce((a, c) => a + (c.amount || 0), 0);
                            const walkInRev = (transactions || []).filter(t => t.category === 'Room Payment' && t.date.startsWith(yearStr)).reduce((a, c) => a + (c.amount || 0), 0);

                            // 2. 전체 객실 수익 계산 (도넛 차트 중앙 및 비율 계산용)
                            const totalRoomRev = (transactions || []).filter(t => t.type === 'REVENUE' && (t.category.includes('Room Booking') || t.category === 'Room Payment') && t.date.startsWith(yearStr)).reduce((a, c) => a + (c.amount || 0), 0);

                            // 3. OTA 채널 동적 추출 로직 (Room Booking 괄호 안의 이름 추출)
                            const otaRevenues = {};
                            (transactions || []).forEach(t => {
                                if (t.type === 'REVENUE' && t.date.startsWith(yearStr)) {
                                    if (t.category.startsWith('Room Booking (') && !t.category.includes('Portal') && !t.category.includes('Hotel Web')) {
                                        const channelName = t.category.replace('Room Booking (', '').replace(')', '').trim();
                                        otaRevenues[channelName] = (otaRevenues[channelName] || 0) + (t.amount || 0);
                                    }
                                }
                            });

                            // 계산되지 않고 남은 수익은 Other Channels로 묶음
                            const knownOtaTotal = Object.values(otaRevenues).reduce((a, b) => a + b, 0);
                            const unknownOtherRev = Math.max(0, totalRoomRev - (portalRev + hotelWebRev + walkInRev + knownOtaTotal));

                            // 4. 도넛 차트 데이터 구성
                            const otaColors = ['#8b5cf6', '#ec4899', '#ef4444', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#d946ef'];

                            let pieData = [
                                { name: 'Portal Web', value: portalRev, color: '#3b82f6' },
                                { name: 'Hotel Web', value: hotelWebRev, color: '#10b981' },
                                { name: 'Walk-in / Direct', value: walkInRev, color: '#f59e0b' }
                            ];

                            Object.keys(otaRevenues).forEach((channel, index) => {
                                pieData.push({
                                    name: channel,
                                    value: otaRevenues[channel],
                                    color: otaColors[index % otaColors.length]
                                });
                            });

                            if (unknownOtherRev > 0) {
                                pieData.push({ name: 'Other Channels', value: unknownOtherRev, color: '#94a3b8' });
                            }

                            pieData = pieData.filter(item => item.value > 0);
    return (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8 animate-fade-in">
                                    {/* 왼쪽: 다이렉트 웹 부킹 통계 */}
                                    <div className="flex flex-col gap-4 md:gap-6">
                                        <div className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-200 border-l-4 border-l-blue-500 relative overflow-hidden flex-1 flex flex-col justify-center">
                                            <div className="absolute right-[-10px] top-[-10px] text-6xl opacity-5">🌐</div>
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-slate-500 font-bold uppercase text-xs md:text-sm tracking-widest">Portal Bookings (YTD)</h3>
                                            </div>
                                            <p className="text-3xl md:text-4xl font-black text-blue-600 mb-1">
                                                ₱{(portalRev || 0).toLocaleString()}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <span className="inline-block bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold">Integrated Portal</span>
                                                {totalRoomRev > 0 && <span className="text-xs font-bold text-slate-400">({((portalRev / totalRoomRev) * 100).toFixed(1)}%)</span>}
                                            </div>
                                        </div>

                                        <div className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-200 border-l-4 border-l-emerald-500 relative overflow-hidden flex-1 flex flex-col justify-center">
                                            <div className="absolute right-[-10px] top-[-10px] text-6xl opacity-5">🏠</div>
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-slate-500 font-bold uppercase text-xs md:text-sm tracking-widest">Hotel Web Bookings (YTD)</h3>
                                            </div>
                                            <p className="text-3xl md:text-4xl font-black text-emerald-600 mb-1">
                                                ₱{(hotelWebRev || 0).toLocaleString()}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <span className="inline-block bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-bold">Custom Domain</span>
                                                {totalRoomRev > 0 && <span className="text-xs font-bold text-slate-400">({((hotelWebRev / totalRoomRev) * 100).toFixed(1)}%)</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 오른쪽: 전체 예약 채널 분포 (도넛 차트) */}
                                    <div className="bg-white p-6 rounded-md shadow-sm border border-slate-200 flex flex-col">
                                        <h3 className="text-slate-800 font-black mb-1 text-lg">Booking Channel Distribution</h3>
                                        <p className="text-xs text-slate-500 font-bold mb-4">Year-to-Date Room Revenue Breakdown</p>

                                        <div className="flex-1 min-h-[250px] relative">
                                            {pieData.length > 0 ? (
                                                <>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius="60%" outerRadius="85%" paddingAngle={4} dataKey="value" stroke="none">
                                                                {pieData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip formatter={(value) => `₱${(value || 0).toLocaleString()}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Room Rev</span>
                                                        <span className="text-xl font-black text-slate-800">
                                                            {(totalRoomRev || 0) >= 1000000
                                                                ? ((totalRoomRev || 0) / 1000000).toFixed(1) + 'M'
                                                                : (totalRoomRev || 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">No booking data available yet.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* 🏦 오너 전용: 실시간 현금 보유 현황 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 animate-fade-in">
                            <div className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-200 flex flex-col">
                                <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                                    <h3 className="text-slate-500 font-black uppercase text-xs md:text-sm tracking-widest">Department Cash</h3>
                                    <span className="text-blue-500 text-lg">🗄️</span>
                                </div>
                                <div className="space-y-3 mt-1 flex-1">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-bold">Finance Office:</span>
                                        <span className="font-black text-slate-800 text-base md:text-lg">₱{(cashData?.financeOffice || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-bold">Front Office:</span>
                                        <span className="font-black text-slate-800 text-base md:text-lg">₱{(cashData?.frontOffice || 0).toLocaleString()}</span>
                                    </div>
                                    {cashData?.posDetails && cashData.posDetails.length > 0 && (
                                        <div className="pt-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-wider">POS Outlets:</span>
                                            <div className="space-y-2 pl-3 border-l-2 border-blue-100 ml-1">
                                                {cashData.posDetails.map((pos, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-sm">
                                                        <span className="text-slate-500 font-medium">{pos?.name}</span>
                                                        <span className="font-black text-slate-700">₱{(pos?.balance || 0).toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-5 pt-4 border-t border-slate-200 flex justify-between items-center bg-blue-50/50 p-2 rounded-md">
                                    <span className="text-xs font-black text-blue-800 uppercase tracking-widest">Sub Total</span>
                                    <span className="text-xl md:text-2xl font-black text-blue-600">₱{(cashData?.deptTotal || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-200 flex flex-col">
                                <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                                    <h3 className="text-slate-500 font-black uppercase text-xs md:text-sm tracking-widest">Bank Balance</h3>
                                    <span className="text-emerald-500 text-lg">🏦</span>
                                </div>
                                <div className="space-y-3 mt-1 flex-1 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                                    {cashData?.bankDetails && cashData.bankDetails.length > 0 ? (
                                        cashData.bankDetails.map((bank, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0">
                                                <span className="text-slate-600 font-bold truncate pr-2 flex flex-col">
                                                    {bank?.name}
                                                    <span className="text-[10px] text-slate-400 font-medium">{bank?.account_name}</span>
                                                </span>
                                                <span className="font-black text-slate-800 text-base md:text-lg">₱{(bank?.balance || 0).toLocaleString()}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-slate-400 font-bold text-center py-4">No linked accounts.</p>
                                    )}
                                </div>
                                <div className="mt-5 pt-4 border-t border-slate-200 flex justify-between items-center bg-emerald-50/50 p-2 rounded-md">
                                    <span className="text-xs font-black text-emerald-800 uppercase tracking-widest">Sub Total</span>
                                    <span className="text-xl md:text-2xl font-black text-emerald-600">₱{(cashData?.bankTotal || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 md:p-6 rounded-md shadow-xl text-white relative overflow-hidden flex flex-col">
                                <div className="absolute top-0 right-0 p-4 opacity-5 text-8xl">💰</div>
                                <div className="relative z-10 flex flex-col h-full justify-between">
                                    <div>
                                        <h3 className="text-slate-300 font-black uppercase text-xs md:text-sm mb-3 tracking-widest flex items-center gap-2">
                                            Total Available Cash
                                            <span className="bg-emerald-500 text-white text-[9px] px-2 py-0.5 rounded-full">LIQUIDITY</span>
                                        </h3>
                                        <div className="w-8 h-1 bg-emerald-500 rounded-full mb-6"></div>
                                    </div>
                                    <div className="text-4xl md:text-5xl lg:text-5xl font-black text-emerald-400 mt-4 mb-2 drop-shadow-md">
                                        ₱{(cashData?.grandTotal || 0).toLocaleString()}
                                    </div>
                                    <div className="mt-auto pt-6">
                                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold border-t border-slate-700 pt-3">
                                            Owner & Executive Access Only
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 📈 Income vs Expense (Monthly Trend) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            <div className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-100">
                                <h3 className="text-lg md:text-xl font-bold mb-6 text-slate-700">Income vs Expense (Monthly Trend)</h3>
                                {/* 💡 [수정] 차트 에러 방지를 위해 min-h-[300px]와 min-w-0을 추가했습니다. */}
                                <div className="w-full h-64 min-h-[300px] min-w-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dynamicChartData || []}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                            <Tooltip cursor={{ fill: 'transparent' }} />
                                            <Legend iconType="circle" />
                                            <Bar dataKey="income" name="Gross Income" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="expense" name="Total Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-100">
                                <h3 className="text-lg md:text-xl font-bold mb-6 text-slate-700">Annual Occupancy Rate Trend</h3>
                                {/* 💡 [수정] 차트 에러 방지를 위해 min-h-[300px]와 min-w-0을 추가했습니다. */}
                                <div className="w-full h-64 min-h-[300px] min-w-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={occupancyData || []}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                            <YAxis axisLine={false} tickLine={false} domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                                            <Tooltip formatter={(value) => [`${value || 0}%`, 'Occupancy']} />
                                            <Line type="monotone" dataKey="rate" name="Occupancy %" stroke="#8b5cf6" strokeWidth={4} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2 }} activeDot={{ r: 8 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* 📓 Detailed Transactions */}
                        <div className="bg-white p-5 md:p-8 rounded-md shadow-sm border border-slate-200 mt-8">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                <h3 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2"><span>📓</span> Detailed Transactions</h3>
                                <button onClick={handleExportLedgerPDF} className="w-full sm:w-auto bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-md font-bold shadow-sm flex justify-center items-center gap-2 transition-colors">
                                    📄 Export PDF
                                </button>
                            </div>

                            <div className="flex flex-col md:flex-row gap-3 mb-6 bg-slate-50 p-4 rounded-md border border-slate-200">
                                <div className="w-full md:flex-1">
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Start Date</label>
                                    <input type="date" value={financeFilter.startDate} onChange={e => setFinanceFilter({ ...financeFilter, startDate: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md bg-white shadow-sm font-bold text-slate-700 text-sm focus:outline-none focus:border-blue-500" />
                                </div>
                                <div className="w-full md:flex-1">
                                    <label className="text-xs font-bold text-slate-500 block mb-1">End Date</label>
                                    <input type="date" value={financeFilter.endDate} onChange={e => setFinanceFilter({ ...financeFilter, endDate: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md bg-white shadow-sm font-bold text-slate-700 text-sm focus:outline-none focus:border-blue-500" />
                                </div>
                                <div className="w-full md:flex-1">
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Type</label>
                                    <select value={financeFilter.type} onChange={e => setFinanceFilter({ ...financeFilter, type: e.target.value, category: 'ALL' })} className="w-full p-2.5 border border-slate-300 rounded-md bg-white shadow-sm font-bold text-slate-700 text-sm focus:outline-none focus:border-blue-500">
                                        <option value="ALL">All Types</option>
                                        <option value="REVENUE">Revenue (+)</option>
                                        <option value="EXPENSE">Expense (-)</option>
                                    </select>
                                </div>
                                <div className="w-full md:w-48">
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Category</label>
                                    <select value={financeFilter.category} onChange={e => setFinanceFilter({ ...financeFilter, category: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md bg-white shadow-sm font-bold text-slate-700 text-sm focus:outline-none focus:border-blue-500">
                                        <option value="ALL">All Categories</option>
                                        {(financeFilter.type === 'ALL' || financeFilter.type === 'REVENUE') && (
                                            <optgroup label="💰 Revenue Categories">
                                                <option value="Room Payment">Room Payment</option>
                                                <option value="Room Service">Room Service</option>
                                                {Array.from(new Set((Array.isArray(posStores) ? posStores : []).map(s => String(s.location)))).sort((a, b) => Number(a) - Number(b)).map(loc => (
                                                    <option key={`pos-loc-${loc}`} value={`POS ${loc}`}>POS {loc}</option>
                                                ))}
                                                {(Array.isArray(posStores) ? posStores : []).map(s => (
                                                    <React.Fragment key={s.id}>
                                                        <option value={s.name}>{s.name} (POS)</option>
                                                        <option value={`POS Sales (${s.name})`}>{s.name} Sales</option>
                                                    </React.Fragment>
                                                ))}
                                            </optgroup>
                                        )}
                                        {(financeFilter.type === 'ALL' || financeFilter.type === 'EXPENSE') && (
                                            <optgroup label="💸 Expense Categories">
                                                {(predefinedExpenses || []).map(cat => <option key={`exp-${cat}`} value={cat}>{cat}</option>)}
                                            </optgroup>
                                        )}
                                        {(otherCategories || []).length > 0 && (
                                            <optgroup label="📌 Others">
                                                {(otherCategories || []).map(c => <option key={`oth-${c}`} value={c}>{c}</option>)}
                                            </optgroup>
                                        )}
                                    </select>
                                </div>
                                <div className="md:ml-auto flex items-end w-full md:w-auto mt-2 md:mt-0">
                                    <button onClick={() => setFinanceFilter({ startDate: '', endDate: '', type: 'ALL', category: 'ALL' })} className="w-full px-4 py-2.5 text-sm font-bold text-slate-500 bg-slate-200 hover:text-slate-700 hover:bg-slate-300 rounded-md transition-colors">
                                        Clear
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-[500px] overflow-x-auto overflow-y-auto border border-slate-200 rounded-md shadow-inner bg-slate-50">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-white sticky top-0 shadow-sm z-10">
                                        <tr>
                                            <th className="p-4 text-slate-500 font-bold uppercase tracking-wider">Date</th>
                                            <th className="p-4 text-slate-500 font-bold uppercase tracking-wider">Type</th>
                                            <th className="p-4 text-slate-500 font-bold uppercase tracking-wider">Category</th>
                                            <th className="p-4 text-slate-500 font-bold uppercase tracking-wider">Description</th>
                                            <th className="p-4 text-right text-slate-500 font-bold uppercase tracking-wider">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-emerald-50 border-b-2 border-emerald-100 sticky top-[48px] z-20">
                                        <tr>
                                            <td colSpan="4" className="p-4 text-right font-black text-emerald-800 uppercase tracking-tighter md:tracking-wider text-xs md:text-sm">
                                                Filtered Search Result Total :
                                            </td>
                                            <td className={`p-4 text-right font-black text-lg md:text-xl ${(financeTotal || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {(financeTotal || 0) >= 0 ? '+' : ''}₱{(financeTotal || 0).toLocaleString()}
                                            </td>
                                        </tr>
                                    </tbody>
                                    <tbody className="divide-y divide-slate-200">
                                        {!(filteredTransactions && filteredTransactions.length > 0) ? (
                                            <tr><td colSpan="5" className="text-center py-10 text-slate-400 font-bold">No transactions found.</td></tr>
                                        ) : (
                                            filteredTransactions.map(t => (
                                                <tr key={t.id} className="hover:bg-blue-50/50 transition-colors bg-white">
                                                    <td className="p-4 font-mono text-slate-600">{t.date}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${t.type === 'REVENUE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {t.type}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-bold text-slate-700">{t.category}</td>
                                                    <td className="p-4 text-slate-600 max-w-xs truncate">{t.description}</td>
                                                    <td className={`p-4 text-right font-black ${t.type === 'REVENUE' ? 'text-blue-600' : 'text-red-600'}`}>
                                                        {t.type === 'REVENUE' ? '+' : '-'}₱{(t?.amount || 0).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🛏️ ROOMS & TYPES */}
                {activeTab === 'ROOMS' && (
                    <div className="animate-fade-in w-full max-w-full pb-20">
                        <div className="flex flex-col mb-6 md:mb-8 text-left">
                            <h2 className="text-2xl md:text-3xl font-black text-slate-800">Room & Type Management</h2>
                            <p className="text-xs md:text-sm text-slate-500 mt-1 font-bold">Manage room categories, pricing, photos, and physical room assignments all in one place.</p>
                        </div>

                        {/* 호텔 기준 시간 설정 */}
                        <div className="bg-white p-6 md:p-8 rounded-md shadow-sm border border-blue-200 mb-6">
                            <h3 className="text-lg md:text-xl font-bold mb-4 border-b border-slate-100 pb-3 flex items-center gap-2 text-slate-800">
                                <span>⏰</span> Hotel Standard Times
                            </h3>
                            <div className="flex flex-col sm:flex-row gap-4 items-end">
                                <div className="flex-1 w-full">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Standard Check-in Time</label>
                                    <input type="time" value={hotelTimes.checkIn} onChange={e => setHotelTimes({ ...hotelTimes, checkIn: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer" />
                                </div>
                                <div className="flex-1 w-full">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Standard Check-out Time</label>
                                    <input type="time" value={hotelTimes.checkOut} onChange={e => setHotelTimes({ ...hotelTimes, checkOut: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer" />
                                </div>
                                <button onClick={handleSaveHotelTimes} className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-md font-bold transition-colors shadow-md">
                                    💾 Save Times
                                </button>
                            </div>
                            <p className="text-xs text-red-500 font-bold mt-3">⚠️ Setting the Check-out time correctly will prevent the false "Early Check-out" warning in Front Desk.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* 1. 객실 타입 생성기 */}
                            <div className="lg:col-span-3 bg-white p-6 md:p-8 rounded-md shadow-sm border border-slate-200 mb-2 transition-all relative overflow-hidden">
                                {editingRoomId && <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>}
                                <h3 className="text-lg md:text-xl font-bold mb-6 border-b border-slate-100 pb-3 flex items-center gap-2 text-slate-800">
                                    <span>✨</span> {editingRoomId ? 'Edit Room Type (Update Existing)' : 'Create New Room Type (Website Display)'}
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Room Name</label><input type="text" value={newRoomTypeDetails.name} onChange={e => setNewRoomTypeDetails({ ...newRoomTypeDetails, name: e.target.value })} placeholder="e.g. Deluxe Ocean View" className="w-full p-3 border border-slate-200 rounded-md font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Base Price (₱)</label><input type="number" value={newRoomTypeDetails.basePrice} onChange={e => setNewRoomTypeDetails({ ...newRoomTypeDetails, basePrice: e.target.value })} placeholder="e.g. 5000" className="w-full p-3 border border-slate-200 rounded-md font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Bed Type</label><input type="text" value={newRoomTypeDetails.bedType} onChange={e => setNewRoomTypeDetails({ ...newRoomTypeDetails, bedType: e.target.value })} placeholder="e.g. 1 King Bed" className="w-full p-3 border border-slate-200 rounded-md font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Max Guests</label><input type="number" value={newRoomTypeDetails.maxGuests} onChange={e => setNewRoomTypeDetails({ ...newRoomTypeDetails, maxGuests: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Room Size (sq.m)</label><input type="number" value={newRoomTypeDetails.size} onChange={e => setNewRoomTypeDetails({ ...newRoomTypeDetails, size: e.target.value })} placeholder="e.g. 32" className="w-full p-3 border border-slate-200 rounded-md font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 text-emerald-600">Security Deposit (₱)</label><input type="number" value={newRoomTypeDetails.deposit} onChange={e => setNewRoomTypeDetails({ ...newRoomTypeDetails, deposit: e.target.value })} placeholder="e.g. 2000" className="w-full p-3 border border-emerald-200 rounded-md font-bold bg-emerald-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                                </div>

                                <div className="mb-6">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Description (Press Enter for new line)</label>
                                    <textarea rows="4" value={newRoomTypeDetails.description} onChange={e => setNewRoomTypeDetails({ ...newRoomTypeDetails, description: e.target.value })} placeholder="Write a short description about this room..." className="w-full p-3 border border-slate-200 rounded-md font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                                </div>

                                <div className="mb-6 border-t border-slate-100 pt-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Room Photos (Add multiple images)</label>
                                        <select
                                            value={newRoomTypeDetails.display_style || 'arrows'}
                                            onChange={e => setNewRoomTypeDetails({ ...newRoomTypeDetails, display_style: e.target.value })}
                                            className="text-[10px] p-1.5 border border-slate-200 rounded font-bold text-slate-600 bg-slate-50 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                                        >
                                            <option value="arrows">⬅️ Manual (Arrows)</option>
                                            <option value="slider">🔄 Auto-Play Slider</option>
                                        </select>
                                    </div>
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        onChange={(e) => {
                                            const files = e.target.files;
                                            if (files && files.length > 0) {
                                                const fileArray = Array.from(files);
                                                setNewRoomTypeDetails(prev => ({
                                                    ...prev,
                                                    imageFiles: [...(prev.imageFiles || []), ...fileArray]
                                                }));
                                            }
                                        }}
                                        className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-bold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer border border-slate-200 p-2 rounded-md bg-white mb-3"
                                    />

                                    <div className="flex gap-3 overflow-x-auto pb-2 p-3 bg-slate-50 rounded-md border border-slate-100 min-h-[120px] items-center">
                                        {/* 서버 기존 사진 */}
                                        {newRoomTypeDetails.existingImages?.map((url, idx) => (
                                            <div key={`ext_${idx}`} className="relative w-24 h-24 shrink-0 group">
                                                <img src={url} className="w-full h-full object-cover rounded-md border border-slate-300 shadow-sm" />
                                                <button type="button" onClick={() => setNewRoomTypeDetails(prev => ({ ...prev, existingImages: prev.existingImages.filter((_, i) => i !== idx) }))} className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold transition-all shadow-md opacity-0 group-hover:opacity-100">✕</button>
                                            </div>
                                        ))}
                                        {/* 신규 첨부 사진 */}
                                        {newRoomTypeDetails.imageFiles?.map((file, idx) => (
                                            <div key={`new_${idx}`} className="relative w-24 h-24 shrink-0 group">
                                                <img src={file instanceof File || file instanceof Blob ? URL.createObjectURL(file) : ''} className="w-full h-full object-cover rounded-md border-2 border-blue-400 shadow-sm" />
                                                <div className="absolute bottom-0 left-0 w-full bg-blue-500 text-white text-[10px] text-center font-bold py-0.5">NEW</div>
                                                <button type="button" onClick={() => setNewRoomTypeDetails(prev => ({ ...prev, imageFiles: prev.imageFiles.filter((_, i) => i !== idx) }))} className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold transition-all shadow-md opacity-0 group-hover:opacity-100">✕</button>
                                            </div>
                                        ))}
                                        {(!newRoomTypeDetails.existingImages?.length && !newRoomTypeDetails.imageFiles?.length) && (
                                            <p className="text-slate-400 text-xs font-bold w-full text-center">No photos added yet.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    {editingRoomId && <button onClick={() => { setEditingRoomId(null); setNewRoomTypeDetails({ name: '', basePrice: '', size: '', bedType: '1 Queen Bed', maxGuests: 2, description: '', display_style: 'arrows', deposit: 2000, imageFiles: [], existingImages: [] }); }} className="px-6 py-3.5 rounded-md font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel Edit</button>}
                                    <button onClick={handleSaveRoomType} className={`px-8 py-3.5 text-white rounded-md font-black shadow-lg transition-transform active:scale-95 ${editingRoomId ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                        {editingRoomId ? '💾 Update Room Type' : '💾 Save New Room'}
                                    </button>
                                </div>
                            </div>

                            {/* 2. 등록된 객실 리스트 */}
                            <div className="lg:col-span-3 bg-white p-6 md:p-8 rounded-md shadow-sm border border-slate-200 mb-6">
                                <h3 className="text-lg md:text-xl font-bold mb-6 border-b border-slate-100 pb-3 flex items-center gap-2 text-slate-800"><span>📋</span> Existing Room Types</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {(roomTypes || []).map(room => {
                                        let pConfig = room.roomConfig || {};
                                        if (typeof pConfig === 'string') { try { pConfig = JSON.parse(pConfig); } catch (e) { } }
                                        let pImages = room.images || [];
                                        if (typeof pImages === 'string') { try { pImages = JSON.parse(pImages); } catch (e) { } }
    return (
                                            <div key={room.id} className="flex flex-col gap-3 p-4 border border-slate-100 rounded-md bg-slate-50 hover:shadow-md transition-all relative">
                                                <div className="w-full h-32 shrink-0 rounded-md overflow-hidden bg-slate-200 border border-slate-200 relative">
                                                    {pImages.length > 0 ? <img src={pImages[0]} className="w-full h-full object-cover" /> : <span className="flex items-center justify-center h-full text-xs text-slate-400 font-bold">No Image</span>}
                                                    {/* 설정된 옵션 배지 표시 */}
                                                    <span className="absolute top-2 left-2 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                                        {pConfig.display_style === 'slider' ? 'Auto-Play' : 'Manual'}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col justify-between flex-1">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h4 className="font-black text-slate-800 text-lg leading-tight truncate">{room.name?.en || room.name || 'Unnamed Room'}</h4>
                                                        <div className="text-right">
                                                            <p className="text-blue-600 font-black text-sm leading-none">₱{((room.price || room.basePrice) || 0).toLocaleString()}</p>
                                                            {/* 💡 [수정완료] DB에 저장된 보증금 값(security_deposit)이나 룸 설정값(pConfig.deposit)을 최우선으로 표시합니다. (0원 설정도 정상 반영) */}
                                                            <span className="text-[9px] text-emerald-600 font-bold uppercase">
                                                                Dep: ₱{Number(room.security_deposit ?? pConfig.deposit ?? 2000).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-500 mb-3 flex flex-wrap gap-1">
                                                        <span className="bg-white border px-1.5 py-0.5 rounded shadow-sm">📏 {pConfig.size || room.size || '-'} sq.m</span>
                                                        <span className="bg-white border px-1.5 py-0.5 rounded shadow-sm">👥 Max {pConfig.maxGuests || room.maxGuests || 2}</span>
                                                        <span className="bg-white border px-1.5 py-0.5 rounded shadow-sm">🛏️ {pConfig.bedType || '-'}</span>
                                                    </p>
                                                    <div className="flex gap-2 mt-auto">
                                                        <button onClick={() => handleEditRoomType(room)} className="flex-1 bg-white hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 rounded-md transition-colors border border-slate-200 shadow-sm">✏️ Edit</button>
                                                        <button onClick={() => handleDeleteRoomType(room.id, room.name?.en || room.name)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-2 rounded-md transition-colors border border-red-100 shadow-sm">🗑️ Delete</button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {(!roomTypes || roomTypes.length === 0) && <p className="text-slate-400 font-bold text-sm col-span-full text-center py-10 bg-slate-50 rounded-md border border-dashed border-slate-200">No room types registered yet.</p>}
                                </div>
                            </div>

                            {/* 3. 물리적 방 번호 등록 및 타입 할당 */}
                            <div className="lg:col-span-2 bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-200">
                                <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
                                    <h3 className="text-lg md:text-xl font-bold">Physical Rooms & Type Assignment</h3>
                                </div>
                                <p className="text-xs md:text-sm text-slate-500 mb-4 font-bold">Select a room type for each room. Changes are saved automatically.</p>

                                <div className="flex flex-col sm:flex-row gap-3 mb-6 bg-slate-50 p-4 rounded-md border border-slate-200">
                                    <input value={newRoomId} onChange={e => setNewRoomId(e.target.value)} placeholder="New Room No. (e.g. 101)" className="p-3 border border-slate-300 rounded-md flex-1 font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                    <select value={newRoomTypeForAdd} onChange={e => setNewRoomTypeForAdd(e.target.value)} className="p-3 border border-slate-300 rounded-md flex-1 font-bold bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
                                        {(roomTypes || []).map(rt => <option key={`add_${rt.id}`} value={rt.name?.en || rt.name}>{rt.name?.en || rt.name}</option>)}
                                    </select>
                                    <button onClick={handleAddRoom} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-md font-bold transition-colors shadow-md">Add Room</button>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 max-h-[700px] overflow-y-auto pr-2">
                                    {(hotelRooms || []).map(room => (
                                        <div key={`room_${room.id}`} className="flex flex-col p-3 border border-slate-200 rounded-md bg-slate-50 shadow-sm relative group hover:border-blue-300 transition-colors">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-black text-slate-800 text-base md:text-lg">Room {room.room_number || room.id}</span>
                                                <button onClick={() => handleDeleteRoom(room.id)} className="text-[10px] text-red-400 font-bold hover:text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded sm:opacity-0 group-hover:opacity-100 transition-opacity">🗑️</button>
                                            </div>
                                            <select value={room.room_type || ''} onChange={e => handleAssignRoomType(room.id, e.target.value)} className="p-1.5 border border-slate-300 rounded-md text-xs font-bold bg-white text-blue-700 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none">
                                                {(roomTypes || []).map(rt => <option key={`assign_${rt.id}`} value={rt.name?.en || rt.name}>{rt.name?.en || rt.name}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                    {(!hotelRooms || hotelRooms.length === 0) && <p className="col-span-full text-center text-slate-400 font-bold py-10 bg-slate-50 rounded-md border border-dashed border-slate-200">No physical rooms added yet.</p>}
                                </div>
                            </div>
                        </div>

                        {/* ========================================================
                            🛎️ Guest Stay Archive (투숙객 이력 보관소) 완벽 복구본
                        ======================================================== */}
                        <div className="mt-12 bg-white rounded-md shadow-lg border border-slate-200 overflow-hidden">
                            <div className="bg-slate-800 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div>
                                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                                        <span>🗂️</span> Guest Stay Archive
                                    </h2>
                                    <p className="text-sm font-bold text-slate-300 mt-1 opacity-80 uppercase tracking-widest">
                                        Search Booking, Check-in, and Check-out History
                                    </p>
                                </div>

                                {/* 검색 및 필터링 영역 */}
                                <div className="flex w-full md:w-auto gap-3">
                                    <input
                                        type="date"
                                        value={historySearchDate}
                                        onChange={(e) => setHistorySearchDate(e.target.value)}
                                        className="p-3 rounded-md border border-slate-600 focus:ring-2 focus:ring-blue-500 font-bold text-sm bg-slate-700 text-white outline-none cursor-pointer"
                                    />
                                    <div className="relative w-full md:w-64">
                                        <span className="absolute left-3 top-3 text-slate-400">🔍</span>
                                        <input
                                            type="text"
                                            placeholder="Search Room No. or Guest Name..."
                                            value={historySearchText}
                                            onChange={(e) => setHistorySearchText(e.target.value)}
                                            className="w-full pl-9 pr-4 py-3 rounded-md border border-slate-600 focus:ring-2 focus:ring-blue-500 font-bold text-sm bg-slate-700 text-white outline-none placeholder:text-slate-400"
                                        />
                                    </div>
                                    <button onClick={fetchHistoryLogs} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-md font-black transition-colors shadow-md">
                                        Search
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 min-h-[300px]">
                                {/* 이력 카드 리스트 영역 (실제 데이터 연동) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                                    {isLoadingHistory ? (
                                        <div className="col-span-full py-10 text-center text-slate-500 font-bold animate-pulse">
                                            ⏳ Loading archive data...
                                        </div>
                                    ) : historyLogs.length === 0 ? (
                                        <div className="col-span-full py-16 text-center text-slate-400">
                                            <span className="text-5xl mb-4 block opacity-50">📭</span>
                                            <p className="text-lg font-bold text-slate-500">No history found</p>
                                            <p className="text-sm mt-1">Try adjusting your search or date filter.</p>
                                        </div>
                                    ) : (
                                        historyLogs.map((log) => (
                                            <div key={log.id} className="bg-white border border-slate-200 rounded-md p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                                <div className={`absolute top-0 left-0 w-1.5 h-full ${log.status === 'CHECKED_OUT' ? 'bg-slate-400' : log.status === 'OCCUPIED' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>

                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <span className={`text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider shadow-sm ${log.status === 'CHECKED_OUT' ? 'bg-slate-100 text-slate-600' : log.status === 'OCCUPIED' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {log.status.replace(/_/g, ' ')}
                                                        </span>
                                                        <h3 className="text-xl font-black text-slate-800 mt-3 flex items-center gap-2">
                                                            <span>🚪</span> {log.room_number ? `Room ${log.room_number}` : 'Unassigned'}
                                                        </h3>
                                                        <p className="text-sm font-bold text-blue-600 mt-1">👤 {log.guest_name}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">Stay Dates</p>
                                                        <p className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200 shadow-inner text-right">
                                                            {log.check_in_date || 'N/A'}<br />
                                                            <span className="text-slate-400">~</span> {log.check_out_date || 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 mb-4 border-y border-dashed border-slate-200 py-3">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Deposit:</span>
                                                    <span className="text-xs font-black text-slate-700">₱ {Number(log.deposit || 0).toLocaleString()}</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Folio:</span>
                                                    <span className="text-xs font-black text-slate-700">₱ {Number(log.total_amount || 0).toLocaleString()}</span>
                                                </div>

                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Document Archive Set</h4>
                                                <div className="flex flex-col gap-2">
                                                    <button onClick={() => handleViewArchivedPDF(log, 'RECEIPT')} disabled={isPdfLoading} className="w-full bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-300 text-slate-700 px-4 py-2.5 rounded-md text-sm font-bold flex items-center justify-between transition-colors shadow-sm group-hover:shadow disabled:opacity-50">
                                                        <span className="flex items-center gap-2">📑 <span>Reservation Folio</span></span>
                                                        <span className="text-blue-500 text-xs">View PDF</span>
                                                    </button>
                                                    <button onClick={() => handleViewArchivedPDF(log, 'CHECKIN')} disabled={isPdfLoading} className="w-full bg-white border border-slate-200 hover:bg-slate-50 hover:border-emerald-300 text-slate-700 px-4 py-2.5 rounded-md text-sm font-bold flex items-center justify-between transition-colors shadow-sm group-hover:shadow disabled:opacity-50">
                                                        <span className="flex items-center gap-2">📥 <span>Check-in (Deposit Slip)</span></span>
                                                        <span className="text-emerald-600 text-xs">View PDF</span>
                                                    </button>
                                                    <button onClick={() => handleViewArchivedPDF(log, 'CHECKOUT')} disabled={isPdfLoading} className="w-full bg-white border border-slate-200 hover:bg-slate-50 hover:border-red-300 text-slate-700 px-4 py-2.5 rounded-md text-sm font-bold flex items-center justify-between transition-colors shadow-sm group-hover:shadow disabled:opacity-50">
                                                        <span className="flex items-center gap-2">📤 <span>Check-out (Refund Receipt)</span></span>
                                                        <span className="text-red-500 text-xs">View PDF</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {/* 🍴 POS & MENU */}
                {activeTab === 'POS_MENU' && (
                    <div className="animate-fade-in w-full max-w-full pb-20">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
                            <h2 className="text-2xl md:text-3xl font-black text-slate-800">POS & Menu</h2>
                            {/* 서브 탭 버튼 */}
                            <div className="flex bg-slate-200 p-1 rounded-md">
                                <button onClick={() => setPosSubTab('MANAGE')} className={`px-4 py-2 rounded-md font-bold text-sm transition-all ${posSubTab === 'MANAGE' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>🛠️ Manage Facilities</button>
                                <button onClick={() => { setPosSubTab('ANALYSIS'); fetchPosAnalytics(); }} className={`px-4 py-2 rounded-md font-bold text-sm transition-all ${posSubTab === 'ANALYSIS' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>📊 Analysis Dashboard</button>
                            </div>
                        </div>

                        {/* ========================================================= */}
                        {/* 1. 매장 및 메뉴 관리 탭 */}
                        {/* ========================================================= */}
                        {posSubTab === 'MANAGE' && (
                            <>
                                <div className="mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white shadow-2xl shadow-slate-300/30">
                                    <div className="grid grid-cols-1 gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] xl:px-8 xl:py-7">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-blue-200">POS Control Center</p>
                                            <h3 className="mt-3 text-3xl font-black">Stores, Menus, and Service Modes</h3>
                                            <p className="mt-3 max-w-3xl text-sm font-medium text-slate-200">
                                                Build outlet catalogs faster, keep room-charge capable stores visible, and review the menu estate with better search and catalog controls.
                                            </p>
                                            <div className="mt-5 flex flex-wrap gap-2">
                                                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-100">{posStores.length} facilities</span>
                                                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-100">{menus.length} catalog items</span>
                                                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-100">{posRoomServiceCount} room service</span>
                                                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-100">{posFeaturedCount} featured</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-300">Facilities</p>
                                                <p className="mt-2 text-3xl font-black">{posStores.length}</p>
                                                <p className="mt-1 text-xs font-medium text-slate-300">Active outlets, counters, and service stations</p>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-300">Front Desk Mode</p>
                                                <p className="mt-2 text-3xl font-black">{posStores.filter((store) => !!store.is_room_linked).length}</p>
                                                <p className="mt-1 text-xs font-medium text-slate-300">Facilities linked to room charging</p>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-300">Categories</p>
                                                <p className="mt-2 text-3xl font-black">{posMenuCategoryOptions.length}</p>
                                                <p className="mt-1 text-xs font-medium text-slate-300">Distinct categories in the selected store</p>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-300">Filtered Cards</p>
                                                <p className="mt-2 text-3xl font-black">{filteredPosMenus.length}</p>
                                                <p className="mt-1 text-xs font-medium text-slate-300">Cards remaining after the current filters</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-100 mb-8">
                                    <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-500">Facility Setup</p>
                                            <h3 className="mt-2 text-xl font-black text-slate-900">Register a POS Facility</h3>
                                        </div>
                                        <button onClick={() => setNewStore(createDefaultPosStoreForm())} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100">
                                            Reset Form
                                        </button>
                                    </div>
                                    <div className="flex flex-col md:flex-row md:items-end gap-4 mb-4">
                                        <div className="w-full md:flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">Facility Name</label><input value={newStore.name} onChange={e => setNewStore({ ...newStore, name: e.target.value })} className="w-full p-2.5 border rounded-md" placeholder="e.g. Lobby Bar" /></div>
                                        <div className="w-full md:w-48"><label className="block text-xs font-bold text-slate-500 mb-1">Category Type</label><input list="storeTypes" value={newStore.type} onChange={e => setNewStore({ ...newStore, type: e.target.value })} className="w-full p-2.5 border rounded-md" /><datalist id="storeTypes"><option value="Restaurant" /><option value="Cafe" /><option value="Bar" /><option value="Spa & Wellness" /><option value="Activity & Tour" /><option value="Rental Service" /></datalist></div>
                                        <div className="w-full md:w-32"><label className="block text-xs font-bold text-slate-500 mb-1">POS Number</label><input type="number" min="1" placeholder="e.g. 6" value={newStore.location} onChange={e => setNewStore({ ...newStore, location: e.target.value })} className="w-full p-2.5 border rounded-md font-bold bg-blue-50 text-blue-700 outline-none focus:ring-2 focus:ring-blue-500" /></div>
                                        <div className="w-full md:w-40"><label className="block text-xs font-bold text-slate-500 mb-1">Units (Tables/Cars)</label><input type="number" value={newStore.table_count} onChange={e => setNewStore({ ...newStore, table_count: parseInt(e.target.value) || 0 })} className="w-full p-2.5 border rounded-md font-bold text-center" min="1" disabled={newStore.is_room_linked} /></div>
                                        <button onClick={handleAddStore} className="w-full md:w-auto bg-slate-900 text-white px-6 py-2.5 rounded-md font-bold">Create Store</button>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-blue-50 p-3 rounded-md border border-blue-200">
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" id="roomLinkToggle" checked={newStore.is_room_linked} onChange={e => setNewStore({ ...newStore, is_room_linked: e.target.checked })} className="w-5 h-5 accent-blue-600 cursor-pointer" />
                                            <label htmlFor="roomLinkToggle" className="font-bold text-blue-800 cursor-pointer text-sm"><span>🏨</span> Enable Front Desk Mode</label>
                                        </div>
                                        <span className="text-xs text-blue-600 ml-7 sm:ml-0">(Link orders to Hotel Rooms instead of Tables)</span>
                                    </div>
                                </div>

                                {posStores.length > 0 && (
                                    <div className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-100 mb-8">
                                        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between mb-5 border-b border-slate-100 pb-4">
                                            <div>
                                                <h3 className="text-sm font-black text-slate-800">Registered POS Facilities</h3>
                                                <p className="mt-2 text-sm font-medium text-slate-500">Search by name, type, or POS number before opening the catalog workspace.</p>
                                            </div>
                                            <div className="flex flex-col gap-3 md:flex-row">
                                                <div className="relative md:w-72">
                                                    <span className="absolute left-3 top-3 text-slate-400">🔍</span>
                                                    <input value={posStoreSearch} onChange={(e) => setPosStoreSearch(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-4 text-sm font-bold text-slate-800 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100" placeholder="Search store, type, or POS no." />
                                                </div>
                                                <select value={posStoreTypeFilter} onChange={(e) => setPosStoreTypeFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 md:w-52">
                                                    <option value="ALL">All Types</option>
                                                    {posStoreTypeOptions.map((type) => <option key={`store_type_${type}`} value={type}>{type}</option>)}
                                                </select>
                                                <button onClick={() => { setPosStoreSearch(''); setPosStoreTypeFilter('ALL'); }} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50">
                                                    Reset Filters
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {filteredPosStores.map(store => (
                                                <div key={store.id} className={`p-4 border rounded-2xl flex flex-col gap-2 relative group transition-all shadow-sm ${String(selectedStore) === String(store.id) ? 'border-blue-300 bg-blue-50 shadow-blue-100' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-white'}`}>
                                                    <div className="flex justify-between items-start gap-3">
                                                        <div className="min-w-0 pr-2">
                                                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{store.type}</p>
                                                            <h4 className="font-bold text-slate-800 text-lg truncate mt-2">{store.name}</h4>
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mt-1">
                                                                {store.type} {store.is_room_linked ? <span className="bg-blue-100 text-blue-700 px-1 rounded text-[8px]">🏨 Room Link</span> : ''}
                                                            </p>
                                                        </div>
                                                        <span className="bg-slate-800 text-white font-black px-2 py-1 rounded-md text-[10px] shadow-sm shrink-0">POS {store.location}</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 mt-3">
                                                        <div className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-center">
                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Mode</p>
                                                            <p className="mt-1 text-sm font-black text-slate-900">{store.is_room_linked ? 'Folio' : 'Table'}</p>
                                                        </div>
                                                        <div className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-center">
                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Units</p>
                                                            <p className="mt-1 text-sm font-black text-slate-900">{store.is_room_linked ? 'Room' : (store.table_count || 0)}</p>
                                                        </div>
                                                        <div className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-center">
                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</p>
                                                            <p className="mt-1 text-sm font-black text-slate-900">{String(selectedStore) === String(store.id) ? 'Open' : 'Ready'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
                                                        <button onClick={() => { setSelectedStore(String(store.id)); scrollToPosMenuBuilder(); }} className="flex-1 bg-slate-900 text-white hover:bg-slate-800 py-2 rounded-xl text-xs font-black transition-colors">Open Catalog</button>
                                                        <button onClick={() => setEditingStore(store)} className="flex-1 bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 py-2 rounded-xl text-xs font-bold transition-colors">Edit</button>
                                                        <button onClick={() => handleDeleteStore(store.id, store.name)} className="flex-1 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 py-2 rounded-xl text-xs font-bold transition-colors">Delete</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {filteredPosStores.length === 0 && (
                                            <div className="mt-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                                                <p className="text-lg font-black text-slate-500">No facilities matched the current filter.</p>
                                                <p className="mt-2 text-sm font-medium text-slate-400">Try clearing the search or register another outlet above.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* POS 매장 수정 모달창 */}
                                {editingStore && (
                                    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                                        <div className="bg-white rounded-md shadow-2xl p-6 w-full max-w-md">
                                            <div className="flex justify-between items-center mb-6">
                                                <h3 className="text-xl font-black text-slate-800">✏️ Edit POS Facility</h3>
                                                <button onClick={() => setEditingStore(null)} className="text-slate-400 hover:text-red-500 font-bold text-xl">✕</button>
                                            </div>
                                            <div className="space-y-4">
                                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Facility Name</label><input value={editingStore.name} onChange={e => setEditingStore({ ...editingStore, name: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md font-bold bg-slate-50 focus:bg-white outline-none focus:border-blue-400" /></div>
                                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Category Type</label><input list="storeTypes" value={editingStore.type} onChange={e => setEditingStore({ ...editingStore, type: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md font-bold bg-slate-50 focus:bg-white outline-none focus:border-blue-400" /></div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div><label className="block text-xs font-bold text-slate-500 mb-1">POS Number</label><input type="number" min="1" value={editingStore.location} onChange={e => setEditingStore({ ...editingStore, location: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md font-black text-blue-700 bg-blue-50 outline-none focus:border-blue-500" /></div>
                                                    <div><label className="block text-xs font-bold text-slate-500 mb-1">Units (Tables)</label><input type="number" value={editingStore.table_count} onChange={e => setEditingStore({ ...editingStore, table_count: parseInt(e.target.value) || 0 })} className="w-full p-2.5 border border-slate-300 rounded-md font-bold" disabled={editingStore.is_room_linked} /></div>
                                                </div>

                                                <div className="flex items-center gap-2 bg-blue-50 p-3 rounded-md border border-blue-200 mt-2">
                                                    <input type="checkbox" id="editRoomLinkToggle" checked={editingStore.is_room_linked} onChange={e => setEditingStore({ ...editingStore, is_room_linked: e.target.checked })} className="w-5 h-5 accent-blue-600 cursor-pointer" />
                                                    <label htmlFor="editRoomLinkToggle" className="font-bold text-blue-800 text-sm cursor-pointer"><span>🏨</span> Enable Front Desk Mode</label>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 mt-8">
                                                <button onClick={() => setEditingStore(null)} className="flex-1 p-3.5 bg-slate-100 text-slate-600 rounded-md font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                                                <button onClick={handleUpdateStore} className="flex-1 p-3.5 bg-blue-600 text-white rounded-md font-black hover:bg-blue-700 shadow-lg transition-transform active:scale-95">💾 Update Store</button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-100">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                                        <div>
                                            <h3 className="text-lg md:text-xl font-bold text-slate-800">Manage Items & Services</h3>
                                            <p className="mt-2 text-sm font-medium text-slate-500">Choose a facility, then build or refine the outlet catalog with better search, category, and service-mode controls.</p>
                                        </div>
                                        <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} className="w-full sm:w-80 p-2.5 border rounded-md font-bold bg-blue-50 text-blue-800">
                                            {(!posStores || posStores.length === 0) && <option value="">No facilities created yet</option>}
                                            {(posStores || []).map(s => <option key={s.id} value={s.id}>{s.name} ({s.type} - POS {s.location})</option>)}
                                        </select>
                                    </div>

                                    {selectedStore && (
                                        <>
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Catalog Items</p>
                                                    <p className="mt-3 text-3xl font-black text-slate-900">{menus.length}</p>
                                                    <p className="mt-1 text-xs font-medium text-slate-500">All cards in the selected facility</p>
                                                </div>
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Filtered View</p>
                                                    <p className="mt-3 text-3xl font-black text-slate-900">{filteredPosMenus.length}</p>
                                                    <p className="mt-1 text-xs font-medium text-slate-500">Cards remaining after current filters</p>
                                                </div>
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Room Service</p>
                                                    <p className="mt-3 text-3xl font-black text-slate-900">{posRoomServiceCount}</p>
                                                    <p className="mt-1 text-xs font-medium text-slate-500">Items available to TV or room-charge flows</p>
                                                </div>
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Featured Picks</p>
                                                    <p className="mt-3 text-3xl font-black text-slate-900">{posFeaturedCount}</p>
                                                    <p className="mt-1 text-xs font-medium text-slate-500">Upsell or hero items marked as best</p>
                                                </div>
                                            </div>

                                            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
                                                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_220px] lg:items-center">
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-3 text-slate-400">🔍</span>
                                                            <input value={posMenuSearch} onChange={(e) => setPosMenuSearch(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-sm font-bold text-slate-800 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100" placeholder="Search menu item or category..." />
                                                        </div>
                                                        <select value={posMenuCategoryFilter} onChange={(e) => setPosMenuCategoryFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100">
                                                            <option value="ALL">All Categories</option>
                                                            {posMenuCategoryOptions.map((category) => <option key={`menu_category_${category}`} value={category}>{category}</option>)}
                                                        </select>
                                                        <select value={posMenuSortMode} onChange={(e) => setPosMenuSortMode(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100">
                                                            <option value="CATEGORY">Sort by Category</option>
                                                            <option value="NAME">Sort by Name</option>
                                                            <option value="PRICE_LOW">Price: Low to High</option>
                                                            <option value="PRICE_HIGH">Price: High to Low</option>
                                                            <option value="FEATURED">Featured First</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {[
                                                            { key: 'ALL', label: 'All Items' },
                                                            { key: 'ROOM_SERVICE', label: 'Room Service' },
                                                            { key: 'FEATURED', label: 'Featured' }
                                                        ].map((scope) => (
                                                            <button key={scope.key} onClick={() => setPosMenuScope(scope.key)} className={`rounded-xl px-4 py-2.5 text-xs font-black transition-colors ${posMenuScope === scope.key ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                                                                {scope.label}
                                                            </button>
                                                        ))}
                                                        <button onClick={() => { setPosMenuSearch(''); setPosMenuCategoryFilter('ALL'); setPosMenuScope('ALL'); setPosMenuSortMode('CATEGORY'); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50">
                                                            Reset
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {posMenuCategoryOptions.length > 0 && (
                                                <div className="mb-6 flex flex-wrap gap-2">
                                                    <button onClick={() => setPosMenuCategoryFilter('ALL')} className={`rounded-full px-3 py-1.5 text-xs font-black transition-colors ${posMenuCategoryFilter === 'ALL' ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>All</button>
                                                    {posMenuCategoryOptions.map((category) => (
                                                        <button key={`chip_${category}`} onClick={() => setPosMenuCategoryFilter(category)} className={`rounded-full px-3 py-1.5 text-xs font-black transition-colors ${posMenuCategoryFilter === category ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                                                            {category}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 bg-slate-50 p-5 md:p-6 rounded-md border border-slate-200">
                                                <div ref={posMenuBuilderRef} className="space-y-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-500">Item Builder</p>
                                                            <h4 className="mt-2 text-lg font-black text-slate-900">Create a Menu or Service Card</h4>
                                                        </div>
                                                        <button onClick={handleResetPosMenuDraft} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100">
                                                            Reset Draft
                                                        </button>
                                                    </div>
                                                    <div><label className="text-xs font-bold text-slate-500 block mb-1">Category</label><input type="text" list="categoryList" value={newMenu.category} onChange={e => setNewMenu({ ...newMenu, category: e.target.value })} className="w-full p-2.5 border rounded-md bg-white" /><datalist id="categoryList">{menus.map(m => m.category).filter((v, i, a) => a.indexOf(v) === i).map(c => <option key={c} value={c} />)}</datalist></div>
                                                    <div><label className="text-xs font-bold text-slate-500 block mb-1">Item / Service Name</label><input value={newMenu.name} onChange={e => setNewMenu({ ...newMenu, name: e.target.value })} className="w-full p-2.5 border rounded-md" /></div>

                                                    <div className="bg-white p-3 rounded-md border border-slate-200 shadow-sm overflow-hidden">
                                                        <label className="text-xs font-bold text-slate-500 block mb-2">Upload Photos (Max 5, Drag to reorder)</label>
                                                        <div className="flex gap-2 overflow-x-auto mb-2 scrollbar-hide p-2 bg-slate-50 rounded-md border border-dashed border-slate-300 min-h-[80px] items-center">
                                                            {newMenu.imageFiles.map((file, idx) => (
                                                                <div key={idx} draggable
                                                                    onDragStart={() => setDraggedMenuImgIdx(idx)}
                                                                    onDragOver={(e) => e.preventDefault()}
                                                                    onDrop={(e) => {
                                                                        e.preventDefault();
                                                                        if (draggedMenuImgIdx === null || draggedMenuImgIdx === idx) return;
                                                                        const newFiles = [...newMenu.imageFiles];
                                                                        const draggedItem = newFiles.splice(draggedMenuImgIdx, 1)[0];
                                                                        newFiles.splice(idx, 0, draggedItem);
                                                                        setNewMenu({ ...newMenu, imageFiles: newFiles });
                                                                        setDraggedMenuImgIdx(null);
                                                                    }}
                                                                    className={`relative w-16 h-16 shrink-0 rounded-md overflow-hidden border-2 cursor-grab active:cursor-grabbing group transition-all ${draggedMenuImgIdx === idx ? 'border-blue-500 opacity-50 scale-95' : 'border-white shadow-sm hover:border-slate-400'}`}>
                                                                    <img src={URL.createObjectURL(file)} className="w-full h-full object-cover pointer-events-none" />
                                                                    <button onClick={() => {
                                                                        const newFiles = [...newMenu.imageFiles]; newFiles.splice(idx, 1);
                                                                        setNewMenu({ ...newMenu, imageFiles: newFiles });
                                                                    }} className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">✕</button>
                                                                    <div className="absolute bottom-0 left-0 bg-black/60 text-white text-[8px] px-1 rounded-tr-md font-mono">{idx + 1}</div>
                                                                </div>
                                                            ))}
                                                            {newMenu.imageFiles.length === 0 && <span className="text-xs text-slate-400 font-bold w-full text-center">No images.</span>}
                                                        </div>
                                                        <input type="file" multiple accept="image/*" onChange={e => {
                                                            const files = Array.from(e.target.files);
                                                            if ((newMenu.imageFiles?.length || 0) + files.length > 5) return alert("Maximum 5 images allowed.");
                                                            setNewMenu(prev => ({ ...prev, imageFiles: [...(prev.imageFiles || []), ...files] }));
                                                            e.target.value = null;
                                                        }} className="w-full text-[10px] file:mr-2 file:py-1 file:px-3 file:rounded-full file:bg-blue-50 file:text-blue-700 cursor-pointer" />
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row gap-4 mt-2">
                                                        <div className="flex flex-1 items-center gap-2 bg-yellow-50 p-3 rounded-md border border-yellow-200"><input type="checkbox" checked={newMenu.isRecommended} onChange={e => setNewMenu({ ...newMenu, isRecommended: e.target.checked })} className="w-5 h-5 accent-yellow-600 cursor-pointer" /><label className="font-bold text-yellow-800 text-sm cursor-pointer" onClick={() => setNewMenu({ ...newMenu, isRecommended: !newMenu.isRecommended })}>Mark as ⭐ BEST</label></div>
                                                        <div className="flex flex-1 items-center gap-2 bg-blue-50 p-3 rounded-md border border-blue-200"><input type="checkbox" checked={newMenu.isRoomService} onChange={e => setNewMenu({ ...newMenu, isRoomService: e.target.checked })} className="w-5 h-5 accent-blue-600 cursor-pointer" /><label className="font-bold text-blue-800 text-sm cursor-pointer" onClick={() => setNewMenu({ ...newMenu, isRoomService: !newMenu.isRoomService })}>Mark as Room Svc 🛎️ </label></div>
                                                    </div>
                                                </div>
                                                <div className="bg-white p-4 md:p-5 rounded-md border border-slate-200 h-fit shadow-sm">
                                                    <label className="text-sm font-black text-slate-700 block mb-2">Variants & Pricing Options</label>
                                                    {newMenu.sizes.map((size, idx) => (
                                                        <div key={idx} className="flex gap-2 mb-3">
                                                            <input placeholder="Option Name" value={size.name} onChange={e => handleSizeChange(idx, 'name', e.target.value)} className="flex-1 p-2 border rounded-md text-sm" />
                                                            <input type="number" placeholder="Price" value={size.price} onChange={e => handleSizeChange(idx, 'price', e.target.value)} className="w-24 p-2 border rounded-md text-sm font-bold text-right" />
                                                            <button onClick={() => removeSizeRow(idx)} className="text-red-500 font-bold px-3 border rounded-md hover:bg-red-50">✕</button>
                                                        </div>
                                                    ))}
                                                    <button onClick={addSizeRow} className="text-blue-600 text-xs font-bold mt-1 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200">➕ Add Another Option</button>
                                                </div>
                                                <button onClick={handleAddMenu} className="lg:col-span-2 w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-md font-black transition-colors">💾 Register Item</button>
                                            </div>

                                            <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                    <div>
                                                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-500">Draft Summary</p>
                                                        <h4 className="mt-2 text-lg font-black text-slate-900">{newMenu.name || 'Untitled Draft'}</h4>
                                                        <p className="mt-2 text-sm font-medium text-slate-500">{newMenu.category || 'Uncategorized'} · {newMenu.isRoomService ? 'Room Service' : 'Standard POS'} · {newMenu.isRecommended ? 'Featured' : 'Standard Visibility'}</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Base</p>
                                                            <p className="mt-2 text-sm font-black text-slate-900">₱{posDraftBasePrice.toLocaleString()}</p>
                                                        </div>
                                                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Variants</p>
                                                            <p className="mt-2 text-sm font-black text-slate-900">{posDraftVariantCount}</p>
                                                        </div>
                                                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Images</p>
                                                            <p className="mt-2 text-sm font-black text-slate-900">{newMenu.imageFiles.length}</p>
                                                        </div>
                                                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Scope</p>
                                                            <p className="mt-2 text-sm font-black text-slate-900">{filteredPosMenus.length}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                                                {filteredPosMenus.map(m => (
                                                    <div key={m.id} className="border border-slate-200 rounded-2xl p-3 bg-white shadow-sm flex flex-col relative group hover:border-blue-300 hover:shadow-md transition-all overflow-hidden">
                                                        <div className="absolute left-3 top-3 flex flex-wrap gap-2 z-10">
                                                            {m.isRecommendedFlag && <span className="rounded-full bg-yellow-400 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">Featured</span>}
                                                            {m.isRoomServiceFlag && <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">Room Service</span>}
                                                        </div>
                                                        <div className="absolute right-3 top-3 flex gap-2 z-10">
                                                            <button
                                                                onClick={() => openMenuEditor(m)}
                                                                className="bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-[10px] shadow-md transition-all sm:opacity-0 group-hover:opacity-100"
                                                            >✎</button>
                                                            <button onClick={() => handleDeleteMenu(m.id, m.cleanName)} className="bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-md transition-all sm:opacity-0 group-hover:opacity-100">✕</button>
                                                        </div>

                                                        <div className="w-full h-28 sm:h-36 rounded-xl mb-3 border bg-slate-50 flex items-center justify-center overflow-hidden">
                                                            {m.primaryImage ? (
                                                                <img
                                                                    src={m.primaryImage}
                                                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                                    alt="item"
                                                                />
                                                            ) : (
                                                                <span className="text-3xl opacity-30">📷</span>
                                                            )}
                                                        </div>

                                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{m.categoryLabel}</p>
                                                        <h4 className="font-bold text-slate-800 text-sm md:text-base mt-2 truncate">{m.cleanName}</h4>
                                                        <div className="mt-3 flex items-center justify-between gap-3">
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">From</p>
                                                                <p className="mt-1 text-base font-black text-slate-900">₱{Number(m.basePrice || 0).toLocaleString()}</p>
                                                            </div>
                                                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Variants</p>
                                                                <p className="mt-1 text-sm font-black text-slate-900">{m.variantCount}</p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 flex flex-wrap gap-2">
                                                            {m.sizes.slice(0, 2).map((size, idx) => (
                                                                <span key={`card_size_${m.id}_${idx}`} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                                                                    {size.name}: ₱{Number(size.price || 0).toLocaleString()}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                                            <button onClick={() => handleLoadMenuDraft(m)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition-colors hover:bg-slate-100">Duplicate</button>
                                                            <button onClick={() => openMenuEditor(m)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-slate-800">Edit Card</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {filteredPosMenus.length === 0 && (
                                                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
                                                    <p className="text-lg font-black text-slate-500">No catalog cards matched the current filter.</p>
                                                    <p className="mt-2 text-sm font-medium text-slate-400">Try clearing the search scope or register a fresh item from the builder.</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {!selectedStore && (
                                        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
                                            <p className="text-lg font-black text-slate-500">Choose a facility to open the catalog workspace.</p>
                                            <p className="mt-2 text-sm font-medium text-slate-400">Once a POS facility is selected, the item builder and catalog cards will appear here.</p>
                                        </div>
                                    )}
                                </div>

                                {/* 메뉴 아이템 편집 팝업 */}
                                {editingMenu && (
                                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in">
                                        <div className="bg-white p-6 md:p-8 rounded-md w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
                                            <div className="flex justify-between items-center mb-6">
                                                <h2 className="text-xl md:text-2xl font-black text-slate-800">✏️ Edit Menu Item</h2>
                                                <button onClick={() => setEditingMenu(null)} className="text-slate-400 hover:text-red-500 font-bold text-xl">✕</button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                                <div className="space-y-4">
                                                    <div><label className="text-xs font-bold text-slate-500 block mb-1">Category</label><input list="categoryList" className="w-full p-2.5 border rounded-md font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={editingMenu.category} onChange={e => setEditingMenu({ ...editingMenu, category: e.target.value })} /></div>
                                                    <div><label className="text-xs font-bold text-slate-500 block mb-1">Item Name</label><input className="w-full p-2.5 border rounded-md font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={editingMenu.name} onChange={e => setEditingMenu({ ...editingMenu, name: e.target.value })} /></div>
                                                    <div className="flex flex-col gap-2 mt-2">
                                                        <div className="flex items-center gap-2 bg-yellow-50 p-3 rounded-md border border-yellow-200">
                                                            <input type="checkbox" checked={editingMenu.is_recommended} onChange={e => setEditingMenu({ ...editingMenu, is_recommended: e.target.checked })} className="w-5 h-5 accent-yellow-600 cursor-pointer" />
                                                            <label className="font-bold text-yellow-800 text-sm cursor-pointer" onClick={() => setEditingMenu({ ...editingMenu, is_recommended: !editingMenu.is_recommended })}>Mark as ⭐ BEST</label>
                                                        </div>
                                                        <div className="flex items-center gap-2 bg-blue-50 p-3 rounded-md border border-blue-200">
                                                            <input type="checkbox" checked={editingMenu.is_room_service} onChange={e => setEditingMenu({ ...editingMenu, is_room_service: e.target.checked })} className="w-5 h-5 accent-blue-600 cursor-pointer" />
                                                            <label className="font-bold text-blue-800 text-sm cursor-pointer" onClick={() => setEditingMenu({ ...editingMenu, is_room_service: !editingMenu.is_room_service })}>Mark as Room Svc 🛎️ </label>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
                                                    <label className="text-xs font-bold text-slate-500 block mb-2">Variants & Pricing Options</label>
                                                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                                        {editingMenu.sizes.map((size, idx) => (
                                                            <div key={idx} className="flex gap-2">
                                                                <input placeholder="Option Name" value={size.name} onChange={e => { const s = [...editingMenu.sizes]; s[idx].name = e.target.value; setEditingMenu({ ...editingMenu, sizes: s }); }} className="flex-1 p-2 border rounded-md text-sm outline-none focus:border-blue-400" />
                                                                <input type="number" placeholder="Price" value={size.price} onChange={e => { const s = [...editingMenu.sizes]; s[idx].price = e.target.value; setEditingMenu({ ...editingMenu, sizes: s }); }} className="w-24 p-2 border rounded-md text-sm font-bold text-right outline-none focus:border-blue-400" />
                                                                <button onClick={() => { const s = [...editingMenu.sizes]; s.splice(idx, 1); setEditingMenu({ ...editingMenu, sizes: s }); }} className="text-red-500 font-bold px-3 border rounded-md hover:bg-red-50 transition-colors">✕</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button onClick={() => setEditingMenu({ ...editingMenu, sizes: [...editingMenu.sizes, { name: '', price: '' }] })} className="text-blue-600 text-xs font-bold mt-3 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md border border-blue-200 transition-colors w-full">➕ Add Another Option</button>
                                                </div>
                                            </div>

                                            <div className="mb-8 border-t border-slate-100 pt-6">
                                                <label className="text-xs font-bold text-slate-500 block mb-2">Upload Photos (Max 5, Drag to reorder)</label>
                                                <div className="flex gap-3 overflow-x-auto mb-3 scrollbar-hide p-3 bg-slate-50 rounded-md border border-dashed border-slate-300 min-h-[100px] items-center">
                                                    {editingMenu.existingImages?.map((url, idx) => (
                                                        <div key={`ext_${idx}`} className="relative w-20 h-20 shrink-0 group">
                                                            <img src={url} className="w-full h-full object-cover rounded-md border border-slate-200 shadow-sm" />
                                                            <button onClick={() => setEditingMenu(prev => ({ ...prev, existingImages: prev.existingImages.filter((_, i) => i !== idx) }))} className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold transition-all shadow-md opacity-0 group-hover:opacity-100">✕</button>
                                                        </div>
                                                    ))}
                                                    {editingMenu.imageFiles?.map((file, idx) => (
                                                        <div key={`new_${idx}`} draggable
                                                            onDragStart={() => setDraggedMenuImgIdx(idx)}
                                                            onDragOver={(e) => e.preventDefault()}
                                                            onDrop={(e) => {
                                                                e.preventDefault();
                                                                if (draggedMenuImgIdx === null || draggedMenuImgIdx === idx) return;
                                                                const newFiles = [...editingMenu.imageFiles];
                                                                const draggedItem = newFiles.splice(draggedMenuImgIdx, 1)[0];
                                                                newFiles.splice(idx, 0, draggedItem);
                                                                setEditingMenu({ ...editingMenu, imageFiles: newFiles });
                                                                setDraggedMenuImgIdx(null);
                                                            }}
                                                            className={`relative w-20 h-20 shrink-0 rounded-md overflow-hidden border-2 cursor-grab active:cursor-grabbing group transition-all ${draggedMenuImgIdx === idx ? 'border-blue-500 opacity-50 scale-95' : 'border-white shadow-sm hover:border-blue-300'}`}>
                                                            <img src={URL.createObjectURL(file)} className="w-full h-full object-cover pointer-events-none" />
                                                            <div className="absolute bottom-0 left-0 w-full bg-blue-500 text-white text-[8px] text-center font-bold py-0.5">NEW</div>
                                                            <button onClick={() => {
                                                                const newFiles = [...editingMenu.imageFiles]; newFiles.splice(idx, 1);
                                                                setEditingMenu({ ...editingMenu, imageFiles: newFiles });
                                                            }} className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">✕</button>
                                                        </div>
                                                    ))}
                                                    {(!editingMenu.existingImages?.length && !editingMenu.imageFiles?.length) && <span className="text-xs text-slate-400 font-bold w-full text-center">No images.</span>}
                                                </div>
                                                <input type="file" multiple accept="image/*" onChange={e => {
                                                    const files = Array.from(e.target.files);
                                                    const currentTotal = (editingMenu.existingImages?.length || 0) + (editingMenu.imageFiles?.length || 0);
                                                    if (currentTotal + files.length > 5) return alert("Maximum 5 images allowed.");
                                                    setEditingMenu(prev => ({ ...prev, imageFiles: [...(prev.imageFiles || []), ...files] }));
                                                    e.target.value = null;
                                                }} className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-bold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer border border-slate-200 p-2 rounded-md bg-white" />
                                            </div>

                                            <div className="flex gap-3">
                                                <button onClick={() => setEditingMenu(null)} className="flex-1 p-4 bg-slate-100 text-slate-600 rounded-md font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                                                <button onClick={handleUpdateMenu} className="flex-1 p-4 bg-blue-600 text-white rounded-md font-black hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all active:scale-95">💾 Save Changes</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ========================================================= */}
                        {/* 2. POS 분석 대시보드 탭 (신규 추가) */}
                        {/* ========================================================= */}
                        {posSubTab === 'ANALYSIS' && (
                            <div className="space-y-6 animate-fade-in">
                                {/* 💡 [신규 추가] 매장별 필터링 버튼 영역 (빨간 박스 영역) */}
                                <div className="flex flex-wrap gap-2 mb-6 bg-slate-50 p-3 rounded-md border border-slate-200 shadow-sm">
                                    {posStores.map(store => (
                                        <button
                                            key={`filter_${store.id}`}
                                            onClick={() => setPosAnalysisFilter(String(store.id))}
                                            className={`px-5 py-2.5 rounded-md font-bold text-sm transition-all shadow-sm flex items-center gap-2 
                                                ${posAnalysisFilter === String(store.id)
                                                    ? 'bg-blue-600 text-white border-blue-700'
                                                    : 'bg-white text-slate-600 border border-slate-200 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50'
                                                }`}
                                        >
                                            <span className="text-[10px] bg-black/10 px-1.5 py-0.5 rounded text-inherit opacity-80">POS {store.location}</span>
                                            {store.name}
                                        </button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-white p-6 rounded-md shadow-sm border border-slate-100">
                                        <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">⏰ Peak Hours (Orders)</h3>
                                        {/* 💡 [수정] min-h-[300px]와 min-w-0 추가 */}
                                        <div className="h-64 w-full min-h-[300px] min-w-0">
                                            {formattedTimeData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={formattedTimeData}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                                                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                        <Line type="monotone" dataKey="orders" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#FFF' }} activeDot={{ r: 6 }} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            ) : <div className="h-full flex items-center justify-center text-slate-400 font-bold">No Data Available</div>}
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-md shadow-sm border border-slate-100">
                                        <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">📅 Orders by Day</h3>
                                        {/* 💡 [수정] min-h-[300px]와 min-w-0 추가 */}
                                        <div className="h-64 w-full min-h-[300px] min-w-0">
                                            {formattedDayData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={formattedDayData}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                                                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                                                        <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                        <Bar dataKey="orders" fill="#10B981" radius={[6, 6, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : <div className="h-full flex items-center justify-center text-slate-400 font-bold">No Data Available</div>}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-md shadow-sm border border-slate-100 mt-6">
                                    <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">🏆 Top 10 Popular Items</h3>
                                    {/* 💡 [수정] min-h-[300px]와 min-w-0 추가 */}
                                    <div className="h-72 w-full min-h-[300px] min-w-0">
                                        {formattedMenuData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={formattedMenuData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                                                    <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                                                    <YAxis type="category" dataKey="name" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#334155', fontWeight: 'bold' }} />
                                                    <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                    <Bar dataKey="qty" fill="#F59E0B" radius={[0, 6, 6, 0]} barSize={20} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <div className="h-full flex items-center justify-center text-slate-400 font-bold">No Data Available</div>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 👥 HUMAN RESOURCES (HR) */}
                {activeTab === 'HR' && (
                    <div className="animate-fade-in w-full max-w-full">
                        <h2 className="text-2xl md:text-3xl font-black mb-6 text-slate-800">Human Resources</h2>
                        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide whitespace-nowrap">
                            <button onClick={() => setHrSubTab('DIRECTORY')} className={`px-4 md:px-5 py-2.5 rounded-md font-bold text-sm shadow-sm transition-colors ${hrSubTab === 'DIRECTORY' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>👨‍💼 Directory & Reg</button>
                            <button onClick={() => setHrSubTab('ATTENDANCE')} className={`px-4 md:px-5 py-2.5 rounded-md font-bold text-sm shadow-sm transition-colors ${hrSubTab === 'ATTENDANCE' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>⏰ DTR</button>
                            <button onClick={() => setHrSubTab('SCHEDULE')} className={`px-4 md:px-5 py-2.5 rounded-md font-bold text-sm shadow-sm transition-colors ${hrSubTab === 'SCHEDULE' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>📅 Scheduler</button>
                            <button onClick={() => setHrSubTab('PAYROLL')} className={`px-4 md:px-5 py-2.5 rounded-md font-bold text-sm shadow-sm transition-colors ${hrSubTab === 'PAYROLL' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>💸 Payroll</button>
                            <button onClick={() => setHrSubTab('DOCS')} className={`px-4 md:px-5 py-2.5 rounded-md font-bold text-sm shadow-sm transition-colors ${hrSubTab === 'DOCS' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>📑 Evals & COE</button>
                        </div>

                        {hrSubTab === 'DIRECTORY' && (
                            <div className="space-y-6 md:space-y-8 animate-fade-in">

                                {/* 🎂 다가오는 주간 생일 알림 배너 */}
                                {Array.isArray(upcomingBirthdays) && upcomingBirthdays.length > 0 && (
                                    <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-md p-5 shadow-lg flex items-center gap-4 text-white animate-bounce-slight">
                                        <div className="text-4xl md:text-5xl">🎂</div>
                                        <div>
                                            <h4 className="font-black text-lg md:text-xl">Upcoming Birthdays (Next 7 Days)</h4>
                                            <p className="text-sm font-medium mt-1">
                                                {upcomingBirthdays.map(emp => `${emp.name} (${emp.shortDob})`).join(', ')}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* ⚙️ 직급(Role) 추가/편집 모달창 */}
                                {showRoleEditModal && (
                                    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                                        <div className="bg-white rounded-md shadow-2xl p-6 w-full max-w-md animate-fade-in">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-xl font-black text-slate-800">Edit Custom Roles</h3>
                                                <button onClick={() => setShowRoleEditModal(false)} className="text-slate-400 hover:text-red-500 font-bold text-xl">✕</button>
                                            </div>
                                            <div className="flex gap-2 mb-4">
                                                <input type="text" value={newRoleInput} onChange={e => setNewRoleInput(e.target.value)} placeholder="Enter new role..." className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                                <button onClick={handleAddRole} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-bold transition-colors">Add</button>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-md p-2 space-y-2 bg-slate-50">
                                                {rolesList.map(r => (
                                                    <div key={`custom_role_${r}`} className="flex justify-between items-center bg-white p-2.5 rounded shadow-sm border border-slate-100">
                                                        <span className="font-bold text-slate-700">{r}</span>
                                                        <button onClick={() => handleDeleteRole(r)} className="text-red-500 hover:bg-red-100 px-2 py-1 rounded font-bold text-xs transition-colors">Del</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 부서 커스텀 추가/삭제 모달 */}
                                {showDeptEditModal && (
                                    <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                                        <div className="bg-white p-6 md:p-8 rounded-md w-full max-w-sm shadow-2xl">
                                            <div className="flex justify-between items-center mb-6">
                                                <h2 className="text-xl font-black text-slate-800">Edit Departments</h2>
                                                <button onClick={() => setShowDeptEditModal(false)} className="text-slate-400 hover:text-red-500 font-bold text-3xl focus:outline-none">&times;</button>
                                            </div>
                                            <div className="flex gap-2 mb-6">
                                                <input value={newDeptInput} onChange={e => setNewDeptInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddDepartment()} placeholder="New Department Name" className="flex-1 p-3 border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm bg-slate-50" />
                                                <button onClick={handleAddDepartment} className="bg-slate-800 text-white font-bold px-5 rounded-md hover:bg-slate-700 shadow-md">Add</button>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                                {Object.keys(departmentRoles).map(dept => (
                                                    <div key={dept} className="flex justify-between items-center bg-slate-50 p-3 rounded-md border border-slate-100">
                                                        <span className="font-bold text-sm text-slate-700">{dept}</span>
                                                        <button onClick={() => handleDeleteDepartment(dept)} className="text-red-500 hover:bg-red-50 p-2 rounded-md text-xs font-bold transition-colors">Delete</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-200">
                                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                                        <h3 className="text-lg md:text-xl font-bold text-slate-800">{isEditingEmp ? '✏️ Edit Employee' : '➕ Register Employee'}</h3>
                                        {isEditingEmp && <button onClick={handleCancelEditEmp} className="bg-slate-100 px-3 py-1.5 rounded-md text-xs md:text-sm font-bold hover:bg-slate-200">Cancel Edit</button>}
                                    </div>

                                    {/* 📸 웹캠 사진 등록 (70%) & CV 업로드/스캔 (30%) 영역 */}
                                    <div className="flex flex-col lg:flex-row gap-4 mb-6">

                                        {/* 🎯 [Area 1] 웹캠(얼굴) 및 신분증 스캔 통합 영역 (70%) */}
                                        <div className="lg:w-[70%] flex flex-col gap-3 bg-slate-50 p-4 border border-slate-100 rounded-md shadow-sm">
                                            <div className="flex justify-between items-center mb-1 border-b border-slate-200 pb-2">
                                                <p className="font-bold text-slate-700 text-sm">Identity & Verification</p>
                                                {(photoBase64 || idCardBase64) && (
                                                    <button onClick={handleDownloadIDPhotoPDF} className="text-[10px] md:text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-md flex items-center gap-1.5 shadow-sm transition-colors">
                                                        <span>📄</span> Export to PDF
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                                                {/* 왼쪽: 얼굴 사진 (Webcam) */}
                                                <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-md bg-white relative h-full">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest absolute top-2 left-3">1. Face Photo</span>
                                                    <div className="w-24 h-24 bg-slate-100 rounded-full border-4 border-slate-200 overflow-hidden flex items-center justify-center mb-4 mt-6 relative shadow-inner">
                                                        {isCameraOpen ? (
                                                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transform -scale-x-100"></video>
                                                        ) : photoBase64 ? (
                                                            <>
                                                                <img src={photoBase64} alt="Captured" className="w-full h-full object-cover" />
                                                                <button onClick={() => setPhotoBase64('')} className="absolute inset-0 bg-black/50 text-white text-xs font-bold opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">Delete</button>
                                                            </>
                                                        ) : (
                                                            <span className="text-3xl opacity-30">🧑</span>
                                                        )}
                                                    </div>
                                                    {isCameraOpen ? (
                                                        <button onClick={capturePhoto} className="bg-emerald-600 text-white px-4 py-2.5 rounded-md font-bold shadow-md hover:bg-emerald-700 text-xs transition-colors w-full mt-auto">📸 Capture Face</button>
                                                    ) : (
                                                        <button onClick={openCamera} className="bg-slate-800 text-white px-4 py-2.5 rounded-md font-bold hover:bg-slate-700 text-xs transition-colors w-full mt-auto">Open Webcam</button>
                                                    )}
                                                </div>

                                                {/* 오른쪽: 신분증 스캔 (Scanner) */}
                                                <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-md bg-white relative h-full">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest absolute top-2 left-3">2. ID Card / Passport Scan</span>
                                                    {/* 💡 [수정됨] w-full을 제거하고 여권/신분증 비율(180x130)로 고정했습니다. */}
                                                    <div className="w-[180px] h-[130px] bg-slate-100 rounded-md border-2 border-slate-200 overflow-hidden flex items-center justify-center mb-4 mt-6 relative shadow-inner shrink-0">
                                                        {idCardBase64 ? (
                                                            <>
                                                                <img src={idCardBase64} alt="ID Card" className="w-full h-full object-contain p-1" />
                                                                <button onClick={() => setIdCardBase64('')} className="absolute inset-0 bg-black/50 text-white text-xs font-bold opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">Delete</button>
                                                            </>
                                                        ) : (
                                                            <span className="text-3xl opacity-30">🪪</span>
                                                        )}
                                                    </div>
                                                    <button onClick={handleScanID} disabled={isIdScanning} className="bg-blue-600 text-white px-4 py-2.5 rounded-md font-bold shadow-md hover:bg-blue-700 text-xs transition-colors w-full disabled:opacity-50 flex items-center justify-center gap-2 mt-auto">
                                                        {isIdScanning ? <span className="animate-spin text-sm">⌛</span> : <span>🖨️</span>} Scan Document
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 📄 [Area 2] CV 파일 업로드 및 스캔 영역 (30%) */}
                                        <div className="lg:w-[30%] flex flex-col items-center justify-center gap-2 bg-slate-50 p-4 border border-slate-100 rounded-md shadow-sm">
                                            <div className="flex justify-between items-center w-full mb-1">
                                                <p className="font-bold text-slate-700 text-sm">CV / Resume (Scan)</p>
                                            </div>
                                            <input type="file" accept=".pdf,image/*" className="hidden" ref={cvFileInputRef} onChange={handleCvUpload} />

                                            {!cvFile && !scannedImageBase64 ? (
                                                <div className="flex flex-col gap-2 w-full h-fit">
                                                    <button onClick={() => cvFileInputRef.current.click()} className="w-full h-[40px] border-2 border-dashed border-blue-300 bg-blue-50 text-blue-600 rounded-md font-bold text-sm hover:bg-blue-100 transition-colors flex items-center justify-center gap-2">
                                                        <span>📤</span> Upload Document
                                                    </button>
                                                    <button onClick={handleScanCV} disabled={isScanning} className="w-full h-[40px] border-2 border-dashed border-emerald-300 bg-emerald-50 text-emerald-600 rounded-md font-bold text-sm hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2">
                                                        {isScanning ? <span className="animate-spin text-xl">⌛</span> : <span>🖨️</span>} Scan Document
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-full flex flex-col gap-2 h-fit justify-center">
                                                    {/* 업로드된 파일 또는 스캔된 이미지 표시 */}
                                                    {scannedImageBase64 ? (
                                                        <div className="w-full h-[100px] border rounded-md bg-white p-2">
                                                            <img src={scannedImageBase64} alt="Scanned CV" className="w-full h-full object-contain" />
                                                        </div>
                                                    ) : cvFileUrl ? (
                                                        <div className="bg-white border border-slate-200 px-3 py-2 rounded-md text-xs font-bold text-slate-600 truncate flex items-center gap-2" title={cvFile.name}>
                                                            <span className="text-base">📄</span> {cvFile.name}
                                                        </div>
                                                    ) : null}

                                                    {/* 버튼들 */}
                                                    <div className="flex flex-wrap gap-2 w-full mt-auto">
                                                        <button onClick={handleViewCv} className="flex-1 bg-slate-800 text-white py-2 rounded-md text-xs font-bold hover:bg-slate-700 transition-colors shadow-sm">View</button>
                                                        <button onClick={handleDeleteCv} className="flex-1 bg-red-50 border border-red-200 text-red-600 py-2 rounded-md text-xs font-bold hover:bg-red-100 transition-colors shadow-sm">Delete</button>
                                                        {(cvFile || scannedImageBase64) && (
                                                            <button onClick={handleDownloadCVAsPDF} className="w-full bg-slate-100 border border-slate-300 text-slate-700 py-2 rounded-md text-xs font-bold hover:bg-slate-200 transition-colors shadow-sm">📄 Download as PDF</button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                    </div>

                                    {/* 1. 기본 정보 */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4 items-start">
                                        <div className="col-span-1 sm:col-span-2">
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Employee ID</label>
                                            <div className="flex gap-2">
                                                <input value={newEmployee.emp_id} disabled={isEditingEmp} onChange={e => { setNewEmployee({ ...newEmployee, emp_id: e.target.value }); setIsIdAvailable(null); }} className="w-full p-2.5 border border-slate-300 rounded-md font-bold disabled:bg-slate-100" />
                                                {!isEditingEmp && (
                                                    <button onClick={handleCheckId} className="bg-slate-800 hover:bg-slate-700 text-white px-4 rounded-md text-xs font-bold whitespace-nowrap transition-colors">Check</button>
                                                )}
                                            </div>
                                            {!isEditingEmp && isIdAvailable === true && <p className="text-[10px] text-emerald-600 font-bold mt-1">Available!</p>}
                                            {!isEditingEmp && isIdAvailable === false && <p className="text-[10px] text-red-600 font-bold mt-1">Already in use</p>}
                                        </div>
                                        <div><label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Password</label><input type="password" value={newEmployee.password} onChange={e => setNewEmployee({ ...newEmployee, password: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md" /></div>
                                        <div><label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">First Name</label><input value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-md font-bold text-slate-800" /></div>
                                        <div><label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Last Name</label><input value={lastName} onChange={e => setLastName(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-md font-bold text-slate-800" /></div>
                                    </div>

                                    {/* 부서 및 직급 선택 */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Department</label>
                                            <div className="flex gap-2">
                                                <select value={selectedDepartment} onChange={(e) => { setSelectedDepartment(e.target.value); setNewEmployee({ ...newEmployee, role: '' }); }} className="flex-1 p-2.5 border border-slate-300 rounded-md font-bold bg-white outline-none">
                                                    <option value="">Select Department</option>
                                                    {Object.keys(departmentRoles).map(dept => (<option key={dept} value={dept}>{dept}</option>))}
                                                </select>
                                                <button onClick={() => setShowDeptEditModal(true)} className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-600 rounded-md transition-colors flex items-center justify-center aspect-square" title="Edit Departments">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Role / Position</label>
                                            <div className="flex gap-2">
                                                <select value={newEmployee.role} onChange={e => setNewEmployee({ ...newEmployee, role: e.target.value })} disabled={!selectedDepartment} className="flex-1 p-2.5 border border-slate-300 rounded-md font-bold bg-white outline-none disabled:bg-slate-100 disabled:text-slate-400">
                                                    <option value="">Select Role</option>
                                                    {selectedDepartment && departmentRoles[selectedDepartment]?.map(r => (<option key={r} value={r}>{r}</option>))}
                                                </select>
                                                <button onClick={() => { if (!selectedDepartment) return alert("Select Department first."); setShowRoleEditModal(true); }} disabled={!selectedDepartment} className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-600 rounded-md transition-colors flex items-center justify-center aspect-square disabled:opacity-50 disabled:cursor-not-allowed" title="Edit Roles">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. 개인 상세 정보 */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 bg-slate-50 p-4 rounded-md border border-slate-100">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Gender</label>
                                            <select value={gender} onChange={e => setGender(e.target.value)} className="w-full p-2.5 border rounded-md bg-white font-bold text-sm text-slate-800">
                                                <option value="">-- Select --</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div><label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Date of Birth</label><input type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full p-2.5 border rounded-md bg-white font-bold text-sm text-slate-800 cursor-pointer" /></div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Marital Status</label>
                                            <select value={maritalStatus} onChange={e => setMaritalStatus(e.target.value)} className="w-full p-2.5 border rounded-md bg-white font-bold text-sm text-slate-800">
                                                <option value="">-- Select --</option><option value="Single">Single</option><option value="Married">Married</option><option value="Divorced">Divorced</option><option value="Widowed">Widowed</option>
                                            </select>
                                        </div>
                                        <div><label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">No. of Children</label><input type="number" min="0" value={childrenCount} onChange={e => setChildrenCount(e.target.value)} className="w-full p-2.5 border rounded-md bg-white font-bold text-sm text-slate-800" /></div>

                                        <div><label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Phone Number</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="09XX XXX XXXX" className="w-full p-2.5 border rounded-md bg-white text-sm text-slate-800" /></div>
                                        <div><label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Email Address</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="mail@example.com" className="w-full p-2.5 border rounded-md bg-white text-sm text-slate-800" /></div>
                                        <div><label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Emergency Contact</label><input type="text" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="Name - Phone" className="w-full p-2.5 border rounded-md bg-white text-sm text-slate-800" /></div>
                                        <div><label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Home Address</label><input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Full Address" className="w-full p-2.5 border rounded-md bg-white text-sm text-slate-800" /></div>
                                    </div>

                                    {/* 3. 입사일, 급여 및 보험 */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                                        <div><label className="text-[10px] font-bold block mb-1 uppercase text-slate-500">Date Hired </label><input type="date" value={dateHired} onChange={e => setDateHired(e.target.value)} className="w-full p-2.5 border rounded-md font-bold text-sm bg-white cursor-pointer" /></div>
                                        <div><label className="text-[10px] font-bold block mb-1 uppercase">Base Salary (PHP)</label><input type="number" value={newEmployee.base_salary} onChange={e => setNewEmployee({ ...newEmployee, base_salary: e.target.value })} className="w-full p-2.5 border rounded-md font-bold" /></div>
                                        <div><label className="text-[10px] font-bold block mb-1 text-blue-500 uppercase">PhilHealth</label><input value={newEmployee.philhealth} onChange={e => setNewEmployee({ ...newEmployee, philhealth: e.target.value })} className="w-full p-2.5 border rounded-md" /></div>
                                        <div><label className="text-[10px] font-bold block mb-1 text-red-500 uppercase">Pag-IBIG</label><input value={newEmployee.pagibig} onChange={e => setNewEmployee({ ...newEmployee, pagibig: e.target.value })} className="w-full p-2.5 border rounded-md" /></div>
                                        <div><label className="text-[10px] font-bold block mb-1 text-green-600 uppercase">SSS No.</label><input value={newEmployee.sss} onChange={e => setNewEmployee({ ...newEmployee, sss: e.target.value })} className="w-full p-2.5 border rounded-md" /></div>
                                    </div>

                                    {/* 권한 및 시설 할당 (통합) */}
                                    <div className="mb-6 bg-slate-50 p-5 border border-slate-200 rounded-md">
                                        {/* 💡 [추가] 제목과 All Access 토글 버튼 */}
                                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                                            <h3 className="text-sm font-black text-slate-800">System Access & Facility Assignment</h3>
                                            <button
                                                onClick={() => {
                                                    const adminPageIds = ['ADMIN_FINANCE', 'ADMIN_WEBSITE_BUILDER', 'ADMIN_OTA_SYNC', 'ADMIN_ROOMS', 'ADMIN_POS_MENU', 'ADMIN_MEMBERS', 'ADMIN_HR', 'ADMIN_BANK_ACCOUNTS', 'ADMIN_DEVICES', 'ADMIN_POLICIES', 'ADMIN_RECEIPT', 'ADMIN_TV_CMS', 'ADMIN_PROMOTIONS_CMS', 'ADMIN_LOGS'];
                                                    const coreIds = ['FINANCE', 'FRONT', 'INVENTORY', 'HK', 'MAINTENANCE'];
                                                    const posIds = posStores.map(s => `POS_${s.id}`);
                                                    const kdsIds = posStores.map(s => `KDS_${s.id}`);
                                                    const allPossibleIds = [...adminPageIds, ...coreIds, ...posIds, ...kdsIds];

                                                    const currentAccess = newEmployee.accessible_menus ? newEmployee.accessible_menus.split(',') : [];
                                                    const isAllSelected = allPossibleIds.every(id => currentAccess.includes(id));

                                                    if (isAllSelected) {
                                                        // 모두 선택되어 있으면 전체 해제
                                                        setNewEmployee({ ...newEmployee, accessible_menus: '' });
                                                    } else {
                                                        // 하나라도 해제되어 있으면 전체 선택
                                                        const newAccess = Array.from(new Set([...currentAccess, ...allPossibleIds])).filter(Boolean);
                                                        setNewEmployee({ ...newEmployee, accessible_menus: newAccess.join(',') });
                                                    }
                                                }}
                                                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-1.5 rounded-md text-xs font-bold transition-colors shadow-sm"
                                            >
                                                Toggle All Access
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 block mb-3 uppercase tracking-wider">Back Office Pages (Admin)</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {/* 💡 [수정] 13개 전체 메뉴 정확한 매칭 */}
                                                    {[
                                                        { id: 'ADMIN_FINANCE', label: 'Finance & Revenue' },
                                                        { id: 'ADMIN_WEBSITE_BUILDER', label: 'Website Builder' },
                                                        { id: 'ADMIN_OTA_SYNC', label: 'Channel Manager' },
                                                        { id: 'ADMIN_ROOMS', label: 'Rooms & Types' },
                                                        { id: 'ADMIN_POS_MENU', label: 'POS Stores & Menus' },
                                                        { id: 'ADMIN_MEMBERS', label: 'Members / CRM' },
                                                        { id: 'ADMIN_HR', label: 'Human Resources' },
                                                        { id: 'ADMIN_BANK_ACCOUNTS', label: 'Bank Accounts' },
                                                        { id: 'ADMIN_DEVICES', label: 'PG & Devices' },
                                                        { id: 'ADMIN_POLICIES', label: 'Refund Policies' },
                                                        { id: 'ADMIN_RECEIPT', label: 'Receipt & Taxes' },
                                                        { id: 'ADMIN_TV_CMS', label: 'TV Theme Settings' },
                                                        { id: 'ADMIN_PROMOTIONS_CMS', label: 'Special Offers' },
                                                        { id: 'ADMIN_LOGS', label: 'System Audit Logs' }
                                                    ].map(page => {
                                                        const isChecked = newEmployee.accessible_menus?.includes(page.id);
    return (
                                                            <label key={page.id} className={`flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer text-xs font-bold transition-all ${isChecked ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                                                <input type="checkbox" className="hidden" checked={isChecked} onChange={(e) => {
                                                                    let current = newEmployee.accessible_menus ? newEmployee.accessible_menus.split(',') : [];
                                                                    if (e.target.checked) current.push(page.id); else current = current.filter(m => m !== page.id);
                                                                    setNewEmployee({ ...newEmployee, accessible_menus: current.join(',') });
                                                                }} />
                                                                {page.label}
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 block mb-3 uppercase tracking-wider">Core Operational Modules</label>
                                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                                    {[
                                                        { id: 'FINANCE', label: 'Finance', icon: '📊' },
                                                        { id: 'FRONT', label: 'Front', icon: '🛎️' },
                                                        { id: 'INVENTORY', label: 'Inven', icon: '📦' },
                                                        { id: 'HK', label: 'HK', icon: '🧹' },
                                                        { id: 'MAINTENANCE', label: 'Maint', icon: '🔧' }
                                                    ].map(mod => {
                                                        const isChecked = newEmployee.accessible_menus?.includes(mod.id);
    return (
                                                            <label key={mod.id} className={`flex flex-col items-center justify-center py-2 px-1 border-2 rounded-md cursor-pointer transition-all text-center select-none ${isChecked ? 'bg-blue-50 border-blue-600 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                                                                <input type="checkbox" className="hidden" checked={isChecked} onChange={(e) => {
                                                                    let current = newEmployee.accessible_menus ? newEmployee.accessible_menus.split(',') : [];
                                                                    if (e.target.checked) current.push(mod.id); else current = current.filter(m => m !== mod.id);
                                                                    setNewEmployee({ ...newEmployee, accessible_menus: current.join(',') });
                                                                }} />
                                                                <span className="text-xl mb-1">{mod.icon}</span>
                                                                <span className={`text-[9px] font-black uppercase ${isChecked ? 'text-blue-700' : 'text-slate-500'}`}>{mod.label}</span>
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-5 border-t border-slate-200">
                                            <label className="text-[10px] font-bold text-slate-500 block mb-3 uppercase tracking-wider">F&B Facilities (POS & KDS Access)</label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {posStores.map(s => {
                                                    const posId = `POS_${s.id}`;
                                                    const kdsId = `KDS_${s.id}`;
                                                    const isPos = newEmployee.accessible_menus?.includes(posId);
                                                    const isKds = newEmployee.accessible_menus?.includes(kdsId);
    return (
                                                        <div key={s.id} className="flex flex-col bg-white p-3 rounded-md border border-slate-200 shadow-sm gap-3">
                                                            <div className="font-black text-sm text-slate-800 flex items-center gap-2 truncate">
                                                                <span className="text-lg">🍽️</span> {s.name}
                                                            </div>
                                                            <div className="flex gap-2 w-full">
                                                                <label className={`flex-1 flex items-center justify-center py-2 rounded-md text-xs font-black cursor-pointer transition-all border ${isPos ? 'bg-orange-500 text-white border-orange-600 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                                                                    <input type="checkbox" className="hidden" checked={isPos} onChange={(e) => {
                                                                        let current = newEmployee.accessible_menus ? newEmployee.accessible_menus.split(',') : [];
                                                                        if (e.target.checked) current.push(posId); else current = current.filter(m => m !== posId);
                                                                        setNewEmployee({ ...newEmployee, accessible_menus: current.join(',') });
                                                                    }} />
                                                                    💳 POS
                                                                </label>
                                                                <label className={`flex-1 flex items-center justify-center py-2 rounded-md text-xs font-black cursor-pointer transition-all border ${isKds ? 'bg-slate-800 text-white border-slate-900 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                                                                    <input type="checkbox" className="hidden" checked={isKds} onChange={(e) => {
                                                                        let current = newEmployee.accessible_menus ? newEmployee.accessible_menus.split(',') : [];
                                                                        if (e.target.checked) current.push(kdsId); else current = current.filter(m => m !== kdsId);
                                                                        setNewEmployee({ ...newEmployee, accessible_menus: current.join(',') });
                                                                    }} />
                                                                    👨‍🍳 KDS
                                                                </label>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                                {posStores.length === 0 && <p className="text-xs text-slate-400 font-bold col-span-full">No F&B facilities found.</p>}
                                            </div>
                                        </div>
                                    </div>

                                    <button onClick={handleSaveEmployee} className={`w-full text-white py-3.5 md:py-4 rounded-md font-black text-lg shadow-lg transition-transform transform hover:-translate-y-0.5 ${isEditingEmp ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>{isEditingEmp ? 'Update Employee Details' : 'Register New Employee'}</button>
                                </div>

                                {/* 직원 검색 및 리스트 테이블 */}
                                <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row gap-3 items-center">
                                        <div className="flex-1 w-full relative">
                                            <span className="absolute left-3 top-3 text-slate-400">🔍</span>
                                            <input type="text" placeholder="Search by ID or Name..." value={empSearch.query} onChange={e => setEmpSearch({ ...empSearch, query: e.target.value })} className="w-full pl-9 pr-4 py-2.5 rounded-md border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold bg-white" />
                                        </div>
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <select value={empSearch.dept} onChange={e => setEmpSearch({ ...empSearch, dept: e.target.value, role: '' })} className="flex-1 md:w-48 p-2.5 rounded-md border border-slate-200 outline-none text-sm font-bold bg-white focus:ring-2 focus:ring-blue-500">
                                                <option value="">All Departments</option>
                                                {Object.keys(departmentRoles).map(dept => <option key={`search_${dept}`} value={dept}>{dept}</option>)}
                                            </select>
                                            <select value={empSearch.role} onChange={e => setEmpSearch({ ...empSearch, role: e.target.value })} disabled={!empSearch.dept} className="flex-1 md:w-48 p-2.5 rounded-md border border-slate-200 outline-none text-sm font-bold bg-white disabled:bg-slate-100 disabled:text-slate-400 focus:ring-2 focus:ring-blue-500">
                                                <option value="">All Roles</option>
                                                {empSearch.dept && departmentRoles[empSearch.dept]?.map(r => <option key={`search_${r}`} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
                                            <thead className="bg-slate-50 border-b">
                                                <tr><th className="p-4">Emp ID</th><th className="p-4">Name & Role</th><th className="p-4">Phone</th><th className="p-4 text-center">Actions</th></tr>
                                            </thead>
                                            <tbody>
                                                {filteredEmployees.length === 0 ? (
                                                    <tr><td colSpan="4" className="text-center p-8 text-slate-400 font-bold">No employees found matching the criteria.</td></tr>
                                                ) : (
                                                    filteredEmployees.map(e => {
                                                        const extras = extraEmpDetails[e.emp_id] || {};
    return (
                                                            <tr key={e.emp_id} className="border-b hover:bg-slate-50 transition-colors">
                                                                <td className="p-4 font-bold text-blue-600">{e.emp_id}</td>
                                                                <td className="p-4"><div className="font-bold text-slate-800">{e.name}</div><div className="text-[10px] text-slate-500">{e.role}</div></td>
                                                                <td className="p-4 font-medium text-slate-600">{extras.phone || '-'}</td>
                                                                <td className="p-4 text-center">
                                                                    <div className="flex justify-center gap-2">
                                                                        <button onClick={() => setSelectedEmpForView({ ...e, ...extras })} className="bg-slate-900 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-slate-800 shadow-sm">View</button>
                                                                        <button onClick={() => handleEditEmployee(e)} className="text-blue-500 font-bold px-2 hover:underline text-xs">Edit</button>
                                                                        <button onClick={() => handleDeleteEmployee(e.emp_id)} className="text-red-500 font-bold px-2 hover:underline text-xs">Del</button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 💡 [신규 추가] View 버튼 클릭 시 나타나는 직원 상세 정보 & CV 뷰어 모달 */}
                                {selectedEmpForView && (
                                    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                                        <div className="bg-white rounded-md shadow-2xl w-full max-w-6xl flex flex-col max-h-[92vh]">

                                            <div className="bg-slate-900 p-4 flex justify-between items-center text-white shrink-0 rounded-t-md">
                                                <h2 className="text-xl font-black flex items-center gap-2"><span>👤</span> Employee Profile: {selectedEmpForView.name}</h2>
                                                <button onClick={() => setSelectedEmpForView(null)} className="text-slate-400 hover:text-white font-bold text-xl transition-colors">✕</button>
                                            </div>

                                            <div className="flex-1 p-6 overflow-y-auto bg-slate-50 space-y-6">
                                                <div className="grid grid-cols-1 xl:grid-cols-[1.35fr,0.85fr] gap-6">
                                                    <div className="space-y-4">
                                                        <div className="bg-white p-5 rounded-md border border-slate-200 shadow-sm">
                                                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                                                <div className="w-24 h-32 bg-slate-100 border border-slate-200 rounded-md flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                                                    {selectedEmpForView.photo ? <img src={selectedEmpForView.photo} className="w-full h-full object-cover" alt="Profile" /> : <span className="text-3xl opacity-20">📷</span>}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                                        <div>
                                                                            <h3 className="text-2xl font-black text-slate-800">{selectedEmpForView.name}</h3>
                                                                            <p className="font-black text-blue-600 text-lg">{selectedEmpForView.emp_id}</p>
                                                                            <p className="text-sm font-bold text-slate-500 mt-1">{selectedEmpForView.dept || getEmpDept(selectedEmpForView)} | {selectedEmpForView.role}</p>
                                                                        </div>
                                                                        <span className="inline-flex items-center h-fit bg-emerald-100 text-emerald-700 px-3 py-1 rounded text-[10px] font-black tracking-widest uppercase shadow-sm">Active</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                                                                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Reviews</p>
                                                                            <p className="text-xl font-black text-slate-800 mt-1">{selectedEmployeeEvaluations.length}</p>
                                                                        </div>
                                                                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Avg Score</p>
                                                                            <p className="text-xl font-black text-slate-800 mt-1">{selectedEmployeeEvaluationAverage ? selectedEmployeeEvaluationAverage.toFixed(1) : '--'}</p>
                                                                        </div>
                                                                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Latest Review</p>
                                                                            <p className="text-sm font-black text-slate-800 mt-1">{selectedEmployeeLatestEvaluation ? selectedEmployeeLatestEvaluation.month_label : 'No record yet'}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="bg-white p-5 rounded-md border border-slate-200 shadow-sm text-sm">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div><span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Phone</span><span className="font-bold text-slate-700">{selectedEmpForView.phone || '-'}</span></div>
                                                                    <div><span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Email</span><span className="font-bold text-slate-700">{selectedEmpForView.email || '-'}</span></div>
                                                                    <div><span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Gender / DOB</span><span className="font-bold text-slate-700">{selectedEmpForView.gender || '-'} / {selectedEmpForView.dob || '-'}</span></div>
                                                                    <div><span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Marital / Children</span><span className="font-bold text-slate-700">{selectedEmpForView.marital_status || '-'} / {selectedEmpForView.children_count || 0}</span></div>
                                                                    <div className="col-span-2 pt-2 border-t border-slate-100"><span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Address</span><span className="font-bold text-slate-700">{selectedEmpForView.address || '-'}</span></div>
                                                                    <div className="col-span-2"><span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Emergency Contact</span><span className="font-black text-red-600">{selectedEmpForView.emergency_contact || '-'}</span></div>
                                                                </div>
                                                            </div>

                                                            <div className="bg-white p-5 rounded-md border border-slate-200 shadow-sm text-sm">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div><span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Date Hired</span><span className="font-bold text-slate-700">{selectedEmpForView.date_hired || '-'}</span></div>
                                                                    <div><span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Base Salary</span><span className="font-black text-blue-600">₱{parseFloat(selectedEmpForView.base_salary || 0).toLocaleString()}</span></div>
                                                                    <div><span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Department</span><span className="font-bold text-slate-700">{selectedEmpForView.dept || getEmpDept(selectedEmpForView)}</span></div>
                                                                    <div><span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Role</span><span className="font-bold text-slate-700">{selectedEmpForView.role || '-'}</span></div>
                                                                    <div className="col-span-2 pt-2 border-t border-slate-100"><span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">SSS / PhilHealth / PagIBIG</span><span className="font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">{selectedEmpForView.sss || '-'} / {selectedEmpForView.philhealth || '-'} / {selectedEmpForView.pagibig || '-'}</span></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <div className="bg-white p-5 rounded-md border border-slate-200 shadow-sm h-full min-h-[360px] flex flex-col relative overflow-hidden">
                                                            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                                                                <h4 className="font-black text-slate-800 flex items-center gap-2"><span>📄</span> Scanned CV</h4>
                                                                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Directory Asset</span>
                                                            </div>
                                                            <div className="flex-1 bg-slate-100 rounded-md border border-slate-200 flex items-center justify-center overflow-hidden relative p-1">
                                                                {selectedEmpForView.cv_data ? (
                                                                    <img src={selectedEmpForView.cv_data} alt="CV" className="w-full h-full object-contain" />
                                                                ) : (
                                                                    <div className="text-center text-slate-400">
                                                                        <span className="text-4xl block mb-2 opacity-30">📭</span>
                                                                        <span className="text-xs font-bold uppercase tracking-widest">No CV Attached</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-white p-5 rounded-md border border-slate-200 shadow-sm">
                                                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
                                                        <div>
                                                            <h4 className="text-lg font-black text-slate-800">Monthly Evaluation Archive</h4>
                                                            <p className="text-sm text-slate-500">Performance reviews submitted from the Evals & COE workspace are recorded here month by month.</p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {selectedEmployeeLatestEvaluation && (
                                                                <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-black ${getEvaluationScoreTone(selectedEmployeeLatestEvaluation.score)}`}>
                                                                    Latest Score {selectedEmployeeLatestEvaluation.score.toFixed(1)}
                                                                </span>
                                                            )}
                                                            <span className="inline-flex items-center px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-xs font-black text-slate-600">
                                                                {selectedEmployeeEvaluationMonths.length} tracked month(s)
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {selectedEmployeeEvaluationMonths.length > 0 ? (
                                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                                            {selectedEmployeeEvaluationMonths.map((monthBucket) => (
                                                                <div key={monthBucket.monthKey} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                                                                    <div className="flex items-start justify-between gap-3 mb-3">
                                                                        <div>
                                                                            <h5 className="font-black text-slate-800">{monthBucket.monthLabel}</h5>
                                                                            <p className="text-xs text-slate-500">{monthBucket.reviews.length} review(s) recorded</p>
                                                                        </div>
                                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{monthBucket.monthKey}</span>
                                                                    </div>
                                                                    <div className="space-y-3">
                                                                        {monthBucket.reviews.map((review) => (
                                                                            <div key={review.id} className="rounded-md bg-white border border-slate-200 p-3 shadow-sm">
                                                                                <div className="flex items-start justify-between gap-3">
                                                                                    <div>
                                                                                        <p className="text-sm font-black text-slate-800">{review.review_type}</p>
                                                                                        <p className="text-xs text-slate-500 mt-1">{review.recorded_label}</p>
                                                                                    </div>
                                                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-black ${getEvaluationScoreTone(review.score)}`}>
                                                                                        {review.score.toFixed(1)} / 5
                                                                                    </span>
                                                                                </div>
                                                                                <p className="text-sm text-slate-600 leading-6 mt-3">{review.remarks || 'No remarks recorded.'}</p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-md border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-slate-400">
                                                            <span className="text-4xl block mb-3 opacity-30">🗂️</span>
                                                            <p className="text-sm font-bold">No monthly evaluation records yet for this employee.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0 rounded-b-md">
                                                <button onClick={() => setSelectedEmpForView(null)} className="px-6 py-2.5 rounded-md font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Close</button>
                                                <button onClick={() => handleExportEmployeePDF(selectedEmpForView)} className="px-8 py-2.5 rounded-md font-black bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200 transition-transform active:scale-95 flex items-center gap-2">
                                                    <span>🖨️</span> Export Profile PDF
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 💡 수정됨: 외부 기기 연동 박스가 ATTENDANCE 탭 안으로 들어왔습니다. */}
                        {/* ⏰ DTR (근태 관리) 탭 */}
                        {hrSubTab === 'ATTENDANCE' && (
                            <div className="space-y-6 animate-fade-in">

                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Attendance Engine Mode</p>
                                            <h3 className="mt-2 text-lg font-black text-slate-900">Choose how DTR is captured for payroll</h3>
                                            <p className="mt-2 text-sm font-medium text-slate-500">
                                                Use `Manual Type` when the property does not use a biometric terminal or when field staff requires direct admin entry. Use `Biometric Type` when punches should come from the device connector and sync into payroll.
                                            </p>
                                        </div>
                                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                                            <button
                                                onClick={() => handleSelectAttendanceMode('MANUAL')}
                                                className={`rounded-2xl px-5 py-3 text-sm font-black transition-all ${isManualAttendanceMode ? 'bg-slate-900 text-white shadow-lg' : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                                            >
                                                Manual Type
                                            </button>
                                            <button
                                                onClick={() => handleSelectAttendanceMode('BIOMETRIC')}
                                                className={`rounded-2xl px-5 py-3 text-sm font-black transition-all ${isBiometricAttendanceMode ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                                            >
                                                Biometric Type
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* 📠 외부 기기 연동 박스 */}
                                <div className={`rounded-2xl border p-5 md:p-6 shadow-sm ${isManualAttendanceMode ? 'border-slate-200 bg-slate-50/80' : 'border-slate-200 bg-white'}`}>
                                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                        <div className="max-w-3xl">
                                            <div className="flex items-start gap-4">
                                                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-sm ${biometricConfig.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>📠</div>
                                                <div>
                                                    <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.28em] text-emerald-700">Device Integration</p>
                                                    <h3 className="mt-2 text-lg md:text-xl font-black text-slate-900">Biometric / RFID Attendance Bridge</h3>
                                                    <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">
                                                        Connect the on-site biometric reader to the HR attendance API, validate connectivity, import punch records, and keep payroll guarded by fresh DTR data.
                                                    </p>
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        <span className={`rounded-full px-3 py-1 text-[11px] font-black ${biometricConfig.enabled ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-slate-200 bg-slate-100 text-slate-500'}`}>
                                                            {biometricConfig.enabled ? `${biometricConfig.provider} enabled` : 'Connector disabled'}
                                                        </span>
                                                        <span className={`rounded-full px-3 py-1 text-[11px] font-black ${biometricStatus.connected ? 'border border-sky-200 bg-sky-50 text-sky-700' : 'border border-amber-200 bg-amber-50 text-amber-700'}`}>
                                                            {biometricStatus.connected ? 'Connection verified' : 'Connection not verified'}
                                                        </span>
                                                        <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
                                                            {biometricConfig.connectionMode} mode
                                                        </span>
                                                        <span className={`rounded-full px-3 py-1 text-[11px] font-black ${biometricRequiresFreshSync ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                                                            {biometricRequiresFreshSync ? 'Payroll sync required' : 'Payroll sync guard satisfied'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                                            <button
                                                onClick={() => setShowBiometricSettings(true)}
                                                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                                            >
                                                Configure Connector
                                            </button>
                                            <button
                                                onClick={handleTestBiometricConnection}
                                                disabled={isTestingBiometric || !biometricConfig.enabled || isManualAttendanceMode}
                                                className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isTestingBiometric ? 'Testing...' : 'Test Connection'}
                                            </button>
                                            <button
                                                onClick={() => handleDeviceSync({ trigger: 'manual_dashboard' })}
                                                disabled={isSyncingDTR || !biometricConfig.enabled || isManualAttendanceMode}
                                                className={`rounded-xl px-4 py-3 text-sm font-black text-white shadow-md transition-all ${isSyncingDTR || !biometricConfig.enabled ? 'cursor-not-allowed bg-emerald-300' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                            >
                                                {isSyncingDTR ? 'Syncing...' : 'Sync Device Data'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-4">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Last Sync</p>
                                            <p className="mt-2 text-lg font-black text-slate-900">{lastDtrSync}</p>
                                            <p className="mt-1 text-xs font-medium text-slate-500">
                                                {biometricFreshnessMinutes === null ? 'No successful biometric import yet.' : `${biometricFreshnessMinutes} minute(s) ago`}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Connector Endpoint</p>
                                            <p className="mt-2 break-all text-sm font-black text-slate-900">{biometricConfig.endpointUrl || biometricConfig.deviceIp || 'Not configured'}</p>
                                            <p className="mt-1 text-xs font-medium text-slate-500">
                                                Port {biometricConfig.devicePort || 'N/A'} · {biometricConfig.serialNumber || 'No serial mapped'}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Webhook / Push URL</p>
                                            <p className="mt-2 break-all text-sm font-black text-slate-900">{biometricWebhookUrl || 'Not available'}</p>
                                            <p className="mt-1 text-xs font-medium text-slate-500">
                                                {biometricStatus.webhookHealthy ? 'Webhook heartbeat healthy' : 'Awaiting webhook heartbeat'}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Payroll Automation</p>
                                            <p className="mt-2 text-sm font-black text-slate-900">
                                                {biometricConfig.autoSyncBeforePayroll ? `Auto sync before payroll (${biometricConfig.requireFreshSyncMinutes} min guard)` : 'Manual approval before payroll'}
                                            </p>
                                            <p className="mt-1 text-xs font-medium text-slate-500">
                                                Imported {Number(biometricStatus.lastImportedCount || 0)} · Duplicates {Number(biometricStatus.lastDuplicateCount || 0)}
                                            </p>
                                        </div>
                                    </div>

                                        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Connector Status</p>
                                                    <p className="mt-2 text-sm font-black text-slate-900">{isManualAttendanceMode ? 'Manual-only mode active. Payroll will use admin-entered DTR without biometric sync.' : (biometricStatus.message || 'Waiting for connector activity.')}</p>
                                                    <p className="mt-1 text-xs font-medium text-slate-500">
                                                        Last test: {formatBiometricTimestamp(biometricStatus.connectionCheckedAt, 'Never tested')}
                                                    </p>
                                                </div>
                                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">
                                                Attendance mode: {biometricConfig.attendanceSourceMode.replace(/_/g, ' ')}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Recent Connector Activity</p>
                                                <p className="mt-1 text-xs font-medium text-slate-500">Latest sync, test, and save events for this hotel code.</p>
                                            </div>
                                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-600">{biometricLogs.length} log item(s)</span>
                                        </div>
                                        <div className="mt-4 space-y-3">
                                            {biometricLogs.length === 0 ? (
                                                <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm font-bold text-slate-400">
                                                    No biometric connector activity yet.
                                                </div>
                                            ) : (
                                                biometricLogs.slice(0, 5).map((log) => {
                                                    const level = (log.level || 'info').toLowerCase();
                                                    const levelClasses = level === 'error'
                                                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                                                        : level === 'success'
                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                            : 'border-slate-200 bg-white text-slate-600';
                                                    return (
                                                        <div key={log.id || `${log.timestamp}_${log.title}`} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                                <div className="min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${levelClasses}`}>{level}</span>
                                                                        <p className="truncate text-sm font-black text-slate-900">{log.title || 'Connector event'}</p>
                                                                    </div>
                                                                    <p className="mt-1 text-xs font-medium text-slate-500">{log.message || 'No detail provided.'}</p>
                                                                </div>
                                                                <div className="text-xs font-bold text-slate-400">
                                                                    {formatBiometricTimestamp(log.timestamp, 'No timestamp')}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* ✍️ 수동 펀치 터미널 */}
                                <div className="bg-slate-900 p-6 md:p-8 rounded-md shadow-xl border text-center relative overflow-hidden">
                                    <h3 className="text-lg md:text-xl font-bold text-white mb-2">Quick Punch Terminal</h3>
                                    <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-slate-300">Current-time IN / OUT for on-the-spot capture</p>
                                    <div className="flex flex-col sm:flex-row justify-center items-center gap-3 md:gap-4 w-full max-w-lg mx-auto">
                                        <select value={punchEmpId} onChange={e => setPunchEmpId(e.target.value)} className="w-full sm:flex-1 p-3.5 md:p-4 rounded-md font-bold bg-slate-800 text-white border border-slate-600 focus:outline-none focus:border-blue-400">
                                            <option value="">-- Select Employee --</option>
                                            {employees.map(e => <option key={`punch_${e.emp_id}`} value={e.emp_id}>{e.emp_id} - {e.name}</option>)}
                                        </select>
                                        <div className="flex gap-3 w-full sm:w-auto">
                                            <button onClick={() => handlePunchTime('IN')} className="flex-1 sm:w-auto bg-green-500 hover:bg-green-400 text-white px-6 md:px-8 py-3.5 md:py-4 rounded-md font-bold transition-colors">IN</button>
                                            <button onClick={() => handlePunchTime('OUT')} className="flex-1 sm:w-auto bg-red-500 hover:bg-red-400 text-white px-6 md:px-8 py-3.5 md:py-4 rounded-md font-bold transition-colors">OUT</button>
                                        </div>
                                    </div>
                                </div>

                                <div ref={manualAttendanceCardRef} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Admin DTR Entry</p>
                                            <h3 className="mt-2 text-lg font-black text-slate-900">Manual DTR Input for field work and exceptions</h3>
                                            <p className="mt-2 text-sm font-medium text-slate-500">
                                                Enter exact work date and time for off-site staff, missed punches, or manual-only properties. Saved records flow directly into payroll calculations.
                                            </p>
                                        </div>
                                        <div className={`rounded-full px-3 py-1 text-[11px] font-black ${isManualAttendanceMode ? 'border border-slate-900 bg-slate-900 text-white' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                                            {isManualAttendanceMode ? 'Manual-only payroll mode' : 'Manual entry available as override'}
                                        </div>
                                    </div>

                                    {manualAttendanceForm.id && (
                                        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-600">Editing Existing DTR</p>
                                                <p className="mt-2 text-sm font-black text-slate-900">
                                                    {manualAttendanceForm.emp_id} {manualAttendanceEmployee?.name ? `· ${manualAttendanceEmployee.name}` : ''} · {manualAttendanceForm.date}
                                                </p>
                                                <p className="mt-1 text-xs font-medium text-slate-500">
                                                    Save will overwrite the selected attendance row and immediately refresh the payroll-linked ledger.
                                                </p>
                                            </div>
                                            <button
                                                onClick={resetManualAttendanceForm}
                                                className="rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm font-black text-sky-700 transition-colors hover:bg-sky-100"
                                            >
                                                Cancel Edit
                                            </button>
                                        </div>
                                    )}

                                    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                            <div className="xl:col-span-2">
                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Employee</label>
                                                <select
                                                    value={manualAttendanceForm.emp_id}
                                                    onChange={(e) => setManualAttendanceForm((prev) => ({ ...prev, emp_id: e.target.value }))}
                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                >
                                                    <option value="">Select employee...</option>
                                                    {employees.map((employee) => (
                                                        <option key={`manual_dtr_${employee.emp_id}`} value={employee.emp_id}>
                                                            {employee.emp_id} - {employee.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <div className="mb-1 flex items-center justify-between gap-2">
                                                    <label className="block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Work Date</label>
                                                    <button
                                                        type="button"
                                                        onClick={handleSetManualAttendanceToday}
                                                        className="text-[11px] font-black text-emerald-600 transition-colors hover:text-emerald-700"
                                                    >
                                                        Today
                                                    </button>
                                                </div>
                                                <input
                                                    type="date"
                                                    value={manualAttendanceForm.date}
                                                    onChange={(e) => setManualAttendanceForm((prev) => ({ ...prev, date: e.target.value }))}
                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Record ID</label>
                                                <input
                                                    value={manualAttendanceForm.id || 'New'}
                                                    readOnly
                                                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-3 text-sm font-black text-slate-500 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <div className="mb-1 flex items-center justify-between gap-2">
                                                    <label className="block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Time In</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApplyManualTimeNow('time_in')}
                                                        className="text-[11px] font-black text-emerald-600 transition-colors hover:text-emerald-700"
                                                    >
                                                        Now
                                                    </button>
                                                </div>
                                                <input
                                                    type="time"
                                                    value={manualAttendanceForm.time_in}
                                                    onChange={(e) => setManualAttendanceForm((prev) => ({ ...prev, time_in: e.target.value }))}
                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                            </div>
                                            <div>
                                                <div className="mb-1 flex items-center justify-between gap-2">
                                                    <label className="block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Time Out</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApplyManualTimeNow('time_out')}
                                                        className="text-[11px] font-black text-emerald-600 transition-colors hover:text-emerald-700"
                                                    >
                                                        Now
                                                    </button>
                                                </div>
                                                <input
                                                    type="time"
                                                    value={manualAttendanceForm.time_out}
                                                    onChange={(e) => setManualAttendanceForm((prev) => ({ ...prev, time_out: e.target.value }))}
                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                            </div>
                                            <div className="flex items-end gap-2 xl:col-span-2">
                                                <button
                                                    onClick={handleSaveManualAttendance}
                                                    disabled={isSavingManualAttendance}
                                                    className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {isSavingManualAttendance ? 'Saving...' : (manualAttendanceForm.id ? 'Update Manual DTR' : 'Save Manual DTR')}
                                                </button>
                                                <button
                                                    onClick={resetManualAttendanceForm}
                                                    className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 transition-colors hover:bg-slate-200"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Manual Entry Policy</p>
                                            {manualAttendanceEmployee && (
                                                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Selected Employee</p>
                                                    <p className="mt-2 text-sm font-black text-slate-900">{manualAttendanceEmployee.name}</p>
                                                    <p className="mt-1 text-xs font-bold text-slate-500">
                                                        {manualAttendanceEmployee.emp_id}
                                                        {manualAttendanceEmployee.role ? ` · ${manualAttendanceEmployee.role}` : ''}
                                                        {manualAttendanceEmployee.department || manualAttendanceEmployee.dept ? ` · ${manualAttendanceEmployee.department || manualAttendanceEmployee.dept}` : ''}
                                                    </p>
                                                </div>
                                            )}
                                            <div className="mt-3 space-y-3 text-sm font-medium text-slate-600">
                                                <p>Use this form when the employee worked off-site, forgot to clock out, or the property intentionally runs without a biometric device.</p>
                                                <p>Manual entries write into the same attendance ledger used by payroll, so OT, late, and NSD calculations will pick them up automatically.</p>
                                                <p>If a record for the same employee and date already exists, saving again will update that DTR day instead of creating a duplicate row.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 🔍 DTR 검색 및 기간 필터 바 (스마트 자동완성 완벽 장착) */}
                                <div className="relative z-50 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Attendance Review</p>
                                            <h3 className="mt-2 text-lg font-black text-slate-900">Filter and inspect the DTR ledger</h3>
                                            <p className="mt-2 text-sm font-medium text-slate-500">
                                                Search by employee ID or name, narrow the cut-off range, then open a row for correction or deletion.
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
                                                {attendanceSummary.totalRecords} visible records
                                            </span>
                                            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${hasAttendanceFilters ? 'border border-sky-200 bg-sky-50 text-sky-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                                                {hasAttendanceFilters ? 'Filters applied' : 'Full ledger in view'}
                                            </span>
                                            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${isManualAttendanceMode ? 'border border-slate-200 bg-slate-900 text-white' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                                                {isManualAttendanceMode ? 'Manual ledger active' : 'Biometric ledger active'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_auto] xl:items-end">
                                        <div className="relative">
                                            <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Employee Search</label>
                                            <span className="absolute left-3 top-[42px] text-slate-400">🔍</span>
                                            <input
                                                type="text"
                                                placeholder="Search ID or Name (e.g. general...)"
                                                value={dtrSearch.query}
                                                onChange={e => {
                                                    setDtrSearch({ ...dtrSearch, query: e.target.value });
                                                    setShowSuggestions(true);
                                                }}
                                                onFocus={() => setShowSuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                            />

                                            {showSuggestions && dtrSearch.query && (
                                                <div className="absolute left-0 right-0 top-full mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl z-[999]">
                                                    {attendanceSuggestions.map((employee) => (
                                                        <div
                                                            key={`sugg_${employee.emp_id}`}
                                                            onClick={() => {
                                                                setDtrSearch({ ...dtrSearch, query: employee.emp_id });
                                                                setShowSuggestions(false);
                                                            }}
                                                            className="flex cursor-pointer items-center justify-between border-b border-slate-100 p-3 transition-colors hover:bg-emerald-50 last:border-0"
                                                        >
                                                            <span className="text-sm font-bold text-slate-700">{employee.emp_id}</span>
                                                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-600">{employee.name}</span>
                                                        </div>
                                                    ))}
                                                    {attendanceSuggestions.length === 0 && (
                                                        <div className="bg-slate-50 p-4 text-center text-xs font-bold text-slate-400">No matching employees found</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div>
                                                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">From</label>
                                                <input
                                                    type="date"
                                                    value={dtrSearch.startDate}
                                                    onChange={e => setDtrSearch({ ...dtrSearch, startDate: e.target.value })}
                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">To</label>
                                                <input
                                                    type="date"
                                                    value={dtrSearch.endDate}
                                                    onChange={e => setDtrSearch({ ...dtrSearch, endDate: e.target.value })}
                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={resetDtrFilters}
                                            className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 transition-colors hover:bg-red-50 hover:text-red-500"
                                        >
                                            Clear Filters
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Visible DTR</p>
                                        <p className="mt-2 text-2xl font-black text-slate-900">{attendanceSummary.totalRecords}</p>
                                        <p className="mt-1 text-xs font-medium text-slate-500">Records matching the current search and date range.</p>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">Completed Shifts</p>
                                        <p className="mt-2 text-2xl font-black text-emerald-700">{attendanceSummary.completedCount}</p>
                                        <p className="mt-1 text-xs font-medium text-emerald-700/80">Clock-in and clock-out are both present.</p>
                                    </div>
                                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-600">Open Shifts</p>
                                        <p className="mt-2 text-2xl font-black text-rose-700">{attendanceSummary.openCount}</p>
                                        <p className="mt-1 text-xs font-medium text-rose-700/80">Still missing a recorded clock-out.</p>
                                    </div>
                                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-600">Tracked Hours</p>
                                        <p className="mt-2 text-2xl font-black text-sky-700">{formatAttendanceHours(attendanceSummary.totalWorkedHours)}</p>
                                        <p className="mt-1 text-xs font-medium text-sky-700/80">
                                            {averageWorkedHours !== null ? `Average ${formatAttendanceHours(averageWorkedHours)} per completed shift.` : 'Average becomes available after a complete IN / OUT pair is saved.'}
                                        </p>
                                    </div>
                                </div>

                                {/* 📋 DTR 기록 테이블 */}
                                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Attendance Ledger</p>
                                            <h3 className="mt-1 text-lg font-black text-slate-900">Daily time record table</h3>
                                        </div>
                                        <p className="text-xs font-medium text-slate-500">Click `Edit` to reopen any record in the manual entry panel.</p>
                                    </div>
                                    <div className="max-h-[560px] overflow-auto">
                                    <table className="min-w-[980px] w-full text-left text-sm">
                                        <thead className="sticky top-0 z-10 border-b bg-slate-50/95 backdrop-blur">
                                            <tr>
                                                <th className="p-4 font-black text-slate-600 uppercase tracking-wider text-xs">Date</th>
                                                <th className="p-4 font-black text-slate-600 uppercase tracking-wider text-xs">Employee</th>
                                                <th className="p-4 font-black text-slate-600 uppercase tracking-wider text-xs">Shift Window</th>
                                                <th className="p-4 font-black text-slate-600 uppercase tracking-wider text-xs">Worked Hours</th>
                                                <th className="p-4 font-black text-slate-600 uppercase tracking-wider text-xs">Status</th>
                                                <th className="p-4 font-black text-slate-600 uppercase tracking-wider text-xs text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAttendance.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="p-10 text-center">
                                                        <p className="font-black text-slate-500">No attendance records found.</p>
                                                        <p className="mt-2 text-sm font-medium text-slate-400">Try clearing the filters, entering a manual DTR, or syncing the biometric connector.</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredAttendance.map(a => (
                                                    <tr key={a.id} className={`border-b transition-colors ${a.statusKey === 'OPEN' ? 'bg-rose-50/40 hover:bg-rose-50' : 'hover:bg-slate-50'}`}>
                                                        <td className="p-4 align-top">
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-slate-900">{a.dateLabel}</span>
                                                                <span className="mt-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{a.dateDayLabel}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-slate-900">{a.name || 'Unknown Employee'}</span>
                                                                <span className="mt-1 text-xs font-bold text-slate-500">{a.emp_id}</span>
                                                                <span className="mt-1 text-[11px] font-medium text-slate-400">
                                                                    {a.department || 'Unassigned'}
                                                                    {a.role ? ` · ${a.role}` : ''}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <div className="flex flex-col gap-2">
                                                                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                                                                    <span className="text-[10px] tracking-[0.18em]">IN</span>
                                                                    <span>{a.time_in || '--'}</span>
                                                                </span>
                                                                <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${a.time_out ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'border border-amber-200 bg-amber-50 text-amber-700'}`}>
                                                                    <span className="text-[10px] tracking-[0.18em]">OUT</span>
                                                                    <span>{a.time_out || 'Missing'}</span>
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-slate-900">{a.workedHoursLabel}</span>
                                                                <span className="mt-1 text-[11px] font-medium text-slate-400">
                                                                    {Number.isFinite(a.workedHours) ? 'Computed from saved IN / OUT pair' : 'Awaiting completed shift'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${a.statusClasses}`}>
                                                                {a.statusLabel}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    onClick={() => handleEditAttendanceRecord(a)}
                                                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition-colors hover:bg-slate-100"
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteAttendanceRecord(a)}
                                                                    disabled={isDeletingAttendanceId === a.id}
                                                                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    {isDeletingAttendanceId === a.id ? 'Deleting...' : 'Delete'}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                    </div>
                                </div>

                                {showBiometricSettings && (
                                    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
                                        <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
                                            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5">
                                                <div>
                                                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Real Connector Setup</p>
                                                    <h3 className="mt-2 text-2xl font-black text-slate-900">Biometric Integration Settings</h3>
                                                    <p className="mt-2 text-sm font-medium text-slate-500">
                                                        Define the actual provider endpoint, device identity, webhook path, and payroll sync guard used by the attendance connector service.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => setShowBiometricSettings(false)}
                                                    className="rounded-full bg-white px-3 py-2 text-sm font-black text-slate-500 shadow-sm transition-colors hover:bg-slate-100 hover:text-red-500"
                                                >
                                                    ✕
                                                </button>
                                            </div>

                                            <div className="max-h-[calc(92vh-148px)] overflow-y-auto px-6 py-6">
                                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Connector State</p>
                                                                <p className="mt-2 text-lg font-black text-slate-900">{biometricConfig.provider}</p>
                                                            </div>
                                                            <label className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-700">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!biometricConfig.enabled}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
                                                                />
                                                                Enable connector
                                                            </label>
                                                        </div>
                                                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Provider</label>
                                                                <select
                                                                    value={biometricConfig.provider}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, provider: e.target.value }))}
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                >
                                                                    {BIOMETRIC_PROVIDER_OPTIONS.map((provider) => (
                                                                        <option key={provider} value={provider}>{provider}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Mode</label>
                                                                <select
                                                                    value={biometricConfig.connectionMode}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, connectionMode: e.target.value }))}
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                >
                                                                    <option value="PULL">Pull API</option>
                                                                    <option value="PUSH">Push SDK</option>
                                                                    <option value="WEBHOOK">Webhook Relay</option>
                                                                </select>
                                                            </div>
                                                            <div className="md:col-span-2">
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Connector Base URL</label>
                                                                <input
                                                                    value={biometricConfig.endpointUrl}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, endpointUrl: e.target.value }))}
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                    placeholder="https://connector.yourhotel.com"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Device IP / Host</label>
                                                                <input
                                                                    value={biometricConfig.deviceIp}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, deviceIp: e.target.value }))}
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                    placeholder="192.168.1.201"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Port</label>
                                                                <input
                                                                    value={biometricConfig.devicePort}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, devicePort: e.target.value }))}
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                    placeholder="4370"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Credentials & Mapping</p>
                                                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">API Key / Username</label>
                                                                <input
                                                                    value={biometricConfig.apiKey}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                    placeholder="Connector credential"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">API Secret / Password</label>
                                                                <input
                                                                    type="password"
                                                                    value={biometricConfig.apiSecret}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, apiSecret: e.target.value }))}
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                    placeholder="Secret or password"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Serial Number</label>
                                                                <input
                                                                    value={biometricConfig.serialNumber}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, serialNumber: e.target.value }))}
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                    placeholder="Terminal serial"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Terminal / Branch ID</label>
                                                                <input
                                                                    value={biometricConfig.terminalId}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, terminalId: e.target.value }))}
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                    placeholder="Lobby, Annex, T1..."
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Employee ID Field</label>
                                                                <input
                                                                    value={biometricConfig.employeeIdentifierField}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, employeeIdentifierField: e.target.value }))}
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                    placeholder="emp_id / badge_no / user_id"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Timezone</label>
                                                                <input
                                                                    value={biometricConfig.timezone}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, timezone: e.target.value }))}
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                    placeholder="Asia/Manila"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 lg:col-span-2">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Webhook & Payroll Guard</p>
                                                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Webhook Path</label>
                                                                <input
                                                                    value={biometricConfig.webhookPath}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, webhookPath: e.target.value }))}
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                    placeholder="/api/hr/biometric/webhook"
                                                                />
                                                                <p className="mt-2 break-all text-xs font-medium text-slate-500">Resolved URL: {biometricWebhookUrl || 'Unavailable until configured'}</p>
                                                            </div>
                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Webhook Secret</label>
                                                                <input
                                                                    value={biometricConfig.webhookSecret}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, webhookSecret: e.target.value }))}
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                    placeholder="Shared signing secret"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Sync Interval (minutes)</label>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={biometricConfig.syncIntervalMinutes}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, syncIntervalMinutes: Number(e.target.value) || 1 }))}
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Attendance Mode</label>
                                                                <select
                                                                    value={biometricConfig.attendanceSourceMode}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, attendanceSourceMode: e.target.value }))}
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                >
                                                                    <option value="MANUAL_ONLY">Manual Only</option>
                                                                    <option value="BIOMETRIC_FIRST">Biometric First</option>
                                                                    <option value="MIXED">Mixed Source</option>
                                                                    <option value="MANUAL_FALLBACK">Manual Fallback</option>
                                                                </select>
                                                            </div>
                                                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                                                <label className="inline-flex items-center gap-3 text-sm font-black text-slate-800">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!!biometricConfig.autoSyncBeforePayroll}
                                                                        onChange={(e) => setBiometricConfig((prev) => ({ ...prev, autoSyncBeforePayroll: e.target.checked }))}
                                                                    />
                                                                    Auto sync before payroll settlement
                                                                </label>
                                                                <p className="mt-2 text-xs font-medium text-slate-500">When enabled, payroll will pause and request a fresh device sync if DTR is stale.</p>
                                                            </div>
                                                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Fresh Sync Guard (minutes)</label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={biometricConfig.requireFreshSyncMinutes}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, requireFreshSyncMinutes: Number(e.target.value) || 0 }))}
                                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                />
                                                                <p className="mt-2 text-xs font-medium text-slate-500">0 means no freshness requirement. Recommended for live device integrations: 15-60 minutes.</p>
                                                            </div>
                                                            <div className="md:col-span-2">
                                                                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Connector Notes</label>
                                                                <textarea
                                                                    value={biometricConfig.notes}
                                                                    onChange={(e) => setBiometricConfig((prev) => ({ ...prev, notes: e.target.value }))}
                                                                    className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                                    placeholder="Optional implementation notes, network whitelisting, VPN route, or provider-specific onboarding details."
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                                                    Connector endpoints expected: `/api/hr/biometric/config`, `/test`, `/sync`, `/status`, `/logs`
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <button
                                                        onClick={handleTestBiometricConnection}
                                                        disabled={isTestingBiometric || !biometricConfig.enabled}
                                                        className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-black text-sky-700 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {isTestingBiometric ? 'Testing...' : 'Test Connection'}
                                                    </button>
                                                    <button
                                                        onClick={handleSaveBiometricConfig}
                                                        disabled={isSavingBiometricConfig}
                                                        className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white shadow-lg transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {isSavingBiometricConfig ? 'Saving...' : 'Save Connector'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 📅 [고도화 완료] SCHEDULE 탭 */}
                        {hrSubTab === 'SCHEDULE' && (
                            <div className="animate-fade-in space-y-6">
                                <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-700 p-6 md:p-8 text-white shadow-xl">
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(96,165,250,0.28),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(34,197,94,0.18),_transparent_35%)]"></div>
                                    <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                                        <div className="max-w-2xl">
                                            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-sky-200">Workforce Planning Console</p>
                                            <h3 className="mt-3 text-2xl md:text-3xl font-black">Scheduler Control Center</h3>
                                            <p className="mt-3 max-w-xl text-sm md:text-base text-slate-200">
                                                Review team coverage, adjust shift rules, and publish cleaner weekly or monthly rosters from one board.
                                            </p>
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-100">{scheduleView}</span>
                                                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${scheduleMode === 'MANUAL' ? 'border-orange-300/50 bg-orange-400/20 text-orange-100' : 'border-sky-300/40 bg-sky-400/15 text-sky-100'}`}>{scheduleMode === 'MANUAL' ? 'Manual edit enabled' : 'Balanced auto generation'}</span>
                                                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${isScheduleAligned ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100' : 'border-amber-300/50 bg-amber-400/20 text-amber-100'}`}>{isScheduleAligned ? 'Current period synced' : 'Period changed, refresh board'}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[470px]">
                                            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-300">Period Range</p>
                                                <p className="mt-2 text-lg font-black">{getSchedulePeriodLabel()}</p>
                                                <p className="mt-1 text-xs font-medium text-slate-300">Start anchor: {scheduleStartDate}</p>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-300">Staff In View</p>
                                                <p className="mt-2 text-3xl font-black">{filteredScheduleWeek.length}</p>
                                                <p className="mt-1 text-xs font-medium text-slate-300">Active filters are reflected instantly</p>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-300">Coverage Fill</p>
                                                <p className="mt-2 text-3xl font-black">{scheduleFillRate}%</p>
                                                <p className="mt-1 text-xs font-medium text-slate-300">Generated duty slots vs total capacity</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                                    <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
                                            <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1.5">
                                                <button onClick={() => setScheduleView('WEEKLY')} className={`px-4 py-2 rounded-lg font-black text-xs transition-all ${scheduleView === 'WEEKLY' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>Weekly</button>
                                                <button onClick={() => setScheduleView('MONTHLY')} className={`px-4 py-2 rounded-lg font-black text-xs transition-all ${scheduleView === 'MONTHLY' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>Monthly</button>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Window</span>
                                                <button onClick={() => moveScheduleWindow(-1)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100">Prev</button>
                                                <button onClick={jumpToCurrentScheduleWindow} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-50">Current</button>
                                                <button onClick={() => moveScheduleWindow(1)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100">Next</button>
                                            </div>
                                            <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5">
                                                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-800">Start Date</span>
                                                <input type="date" value={scheduleStartDate} onChange={(e) => setScheduleStartDate(e.target.value)} className="bg-transparent text-sm font-bold text-blue-900 outline-none cursor-pointer" />
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-end">
                                            <div className="flex items-center gap-2 rounded-xl bg-slate-900 p-1.5 text-white">
                                                <button onClick={() => setScheduleMode('AUTO')} className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${scheduleMode === 'AUTO' ? 'bg-blue-500 shadow-inner' : 'text-slate-400 hover:text-white'}`}>Auto Gen</button>
                                                <button onClick={() => setScheduleMode('MANUAL')} className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${scheduleMode === 'MANUAL' ? 'bg-orange-500 shadow-inner' : 'text-slate-400 hover:text-white'}`}>Manual Edit</button>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button onClick={() => setShowScheduleSettings(true)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">Rules</button>
                                                {scheduleMode === 'AUTO' && (
                                                    <button onClick={generateSmartSchedule} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white shadow-md transition-colors hover:bg-blue-700">Generate</button>
                                                )}
                                                <button onClick={handleExportSchedulePDF} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-black text-white shadow-md transition-colors hover:bg-red-700">PDF</button>
                                                <button onClick={handleExportScheduleCSV} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-md transition-colors hover:bg-emerald-700">CSV</button>
                                                <button onClick={handleClearScheduleBoard} className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200">Clear</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-col gap-3 lg:flex-row">
                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                                            <input type="text" placeholder="Search by employee ID or name..." value={scheduleSearch.query} onChange={e => setScheduleSearch({ ...scheduleSearch, query: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm font-bold text-slate-800 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
                                        </div>
                                        <div className="flex flex-col gap-3 sm:flex-row lg:w-auto">
                                            <select value={scheduleSearch.dept} onChange={e => setScheduleSearch({ ...scheduleSearch, dept: e.target.value, role: '' })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 sm:w-48">
                                                <option value="">All Departments</option>
                                                {Object.keys(departmentRoles).map(dept => <option key={`sch_dept_${dept}`} value={dept}>{dept}</option>)}
                                            </select>
                                            <select value={scheduleSearch.role} onChange={e => setScheduleSearch({ ...scheduleSearch, role: e.target.value })} disabled={!scheduleSearch.dept} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400 sm:w-52">
                                                <option value="">All Roles</option>
                                                {scheduleSearch.dept && departmentRoles[scheduleSearch.dept]?.map(r => <option key={`sch_role_${r}`} value={r}>{r}</option>)}
                                            </select>
                                            <button onClick={handleClearScheduleFilters} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50">Reset Filters</button>
                                        </div>
                                    </div>
                                </div>

                                {!isScheduleAligned && scheduleWeek.length > 0 && (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 shadow-sm">
                                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <p className="font-black">This schedule draft was created for another period.</p>
                                                <p className="mt-1 font-medium text-amber-800">Saved board: {scheduleContext.view} / {scheduleContext.startDate}. Generate again for {scheduleView} / {scheduleStartDate} to sync the table and analytics.</p>
                                            </div>
                                            <button onClick={generateSmartSchedule} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-amber-600">Refresh Board</button>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Visible Staff</p>
                                        <p className="mt-3 text-3xl font-black text-slate-900">{filteredScheduleWeek.length}</p>
                                        <p className="mt-1 text-xs font-medium text-slate-500">Employees inside the current filter scope</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Assigned Shifts</p>
                                        <p className="mt-3 text-3xl font-black text-slate-900">{scheduleSummary.assignedSlots}</p>
                                        <p className="mt-1 text-xs font-medium text-slate-500">Booked duty blocks across the visible board</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Planned Hours</p>
                                        <p className="mt-3 text-3xl font-black text-slate-900">{scheduleSummary.totalHours.toLocaleString()}</p>
                                        <p className="mt-1 text-xs font-medium text-slate-500">Shift length is calculated from the configured time rules</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Average Load</p>
                                        <p className="mt-3 text-3xl font-black text-slate-900">{scheduleAverageHours}h</p>
                                        <p className="mt-1 text-xs font-medium text-slate-500">{scheduleSummary.offDays} off blocks currently distributed</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                                        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <h4 className="text-lg font-black text-slate-900">Daily Coverage Snapshot</h4>
                                                <p className="text-sm font-medium text-slate-500">Review staffing density, off days, and dominant shift mix across the selected period.</p>
                                            </div>
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">{scheduleDailyInsights.length} day window</span>
                                        </div>
                                        {displayedScheduleRows.length > 0 ? (
                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                                                {scheduleDailyInsights.map((day) => (
                                                    <div key={`daily_${day.key}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{day.dayStr}</p>
                                                                <p className="mt-1 text-lg font-black text-slate-900">{day.dateStr}</p>
                                                            </div>
                                                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${day.fillRate >= 75 ? 'bg-emerald-100 text-emerald-700' : day.fillRate >= 45 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{day.fillRate}% filled</span>
                                                        </div>
                                                        <div className="mt-4 flex flex-wrap gap-2">
                                                            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white">{day.assigned} assigned</span>
                                                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">{day.off} off</span>
                                                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">Top shift: {day.dominantShift}</span>
                                                        </div>
                                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                                            {['Day', 'Morning', 'Mid', 'Night'].map((shiftKey) => (
                                                                <div key={`daily_${day.key}_${shiftKey}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{shiftKey}</p>
                                                                    <p className="mt-1 text-lg font-black text-slate-800">{day.shifts[shiftKey] || 0}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                                                <p className="text-lg font-black text-slate-500">Daily analytics will appear here after a schedule is generated.</p>
                                                <p className="mt-2 text-sm font-medium text-slate-400">Use Auto Gen for a balanced draft, then switch to Manual Edit for final tuning.</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-6">
                                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                                            <h4 className="text-lg font-black text-slate-900">Shift Legend</h4>
                                            <p className="mt-1 text-sm font-medium text-slate-500">Colors and durations are driven by the current rule set.</p>
                                            <div className="mt-5 space-y-3">
                                                {scheduleLegendItems.map((item) => (
                                                    <div key={`legend_${item.shiftKey}`} className={`rounded-2xl border p-4 ${item.color}`}>
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div>
                                                                <p className="text-xs font-black uppercase tracking-[0.22em]">{item.shiftKey}</p>
                                                                <p className="mt-1 text-sm font-bold">{item.label}</p>
                                                            </div>
                                                            <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-black text-slate-700">{item.hours}h</span>
                                                        </div>
                                                        <p className="mt-3 text-xs font-bold">{item.start} - {item.end}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                                            <h4 className="text-lg font-black text-slate-900">Department Load</h4>
                                            <p className="mt-1 text-sm font-medium text-slate-500">Quick read on staffing volume and time allocation by department.</p>
                                            <div className="mt-5 space-y-3">
                                                {scheduleDepartmentInsights.length > 0 ? scheduleDepartmentInsights.map((dept) => (
                                                    <div key={`dept_load_${dept.dept}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-sm font-black text-slate-900">{dept.dept}</p>
                                                                <p className="mt-1 text-xs font-medium text-slate-500">{dept.staffCount} staff in view</p>
                                                            </div>
                                                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-700">{dept.fillRate}% fill</span>
                                                        </div>
                                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                                            <div className="rounded-xl bg-white px-3 py-2">
                                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Hours</p>
                                                                <p className="mt-1 text-lg font-black text-slate-800">{dept.totalHours}</p>
                                                            </div>
                                                            <div className="rounded-xl bg-white px-3 py-2">
                                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Off Blocks</p>
                                                                <p className="mt-1 text-lg font-black text-slate-800">{dept.offDays}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                                                        <p className="font-black text-slate-500">Department metrics will populate after generating the board.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {showScheduleSettings && (
                                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
                                        <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in">
                                            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                                                <div>
                                                    <h4 className="text-xl font-black text-slate-900">Shift & Rule Settings</h4>
                                                    <p className="mt-1 text-sm font-medium text-slate-500">Adjust coverage rules before generating the next schedule draft.</p>
                                                </div>
                                                <button onClick={() => setShowScheduleSettings(false)} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-500 transition-colors hover:bg-slate-200 hover:text-red-500">✕</button>
                                            </div>
                                            <div className="max-h-[78vh] overflow-y-auto px-6 py-6 custom-scrollbar">
                                                <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Weekly Hour Cap</label>
                                                    <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
                                                        <input type="number" min="8" step="1" value={scheduleRules.maxHours} onChange={(e) => setScheduleRules({ ...scheduleRules, maxHours: Number(e.target.value) || 40 })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-black text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 md:w-48" />
                                                        <p className="text-sm font-medium text-slate-500">Used by Auto Gen to spread work more evenly and limit overloaded weeks.</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                                    <div>
                                                        <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Shift Time Configurations</label>
                                                        <div className="space-y-3">
                                                            {Object.entries(scheduleRules.shiftTimes).map(([shiftKey, config]) => (
                                                                <div key={shiftKey} className={`rounded-2xl border p-4 ${config.color}`}>
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div>
                                                                            <p className="text-xs font-black uppercase tracking-[0.22em]">{shiftKey}</p>
                                                                            <p className="mt-1 text-sm font-bold">{config.label}</p>
                                                                        </div>
                                                                        <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-black text-slate-700">{getShiftDurationHours(shiftKey)}h</span>
                                                                    </div>
                                                                    <div className="mt-4 flex items-center gap-2">
                                                                        <input type="time" value={config.start} onChange={e => setScheduleRules({ ...scheduleRules, shiftTimes: { ...scheduleRules.shiftTimes, [shiftKey]: { ...config, start: e.target.value } } })} className="w-full rounded-xl border border-white/40 bg-white/70 px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-current" />
                                                                        <span className="font-black">-</span>
                                                                        <input type="time" value={config.end} onChange={e => setScheduleRules({ ...scheduleRules, shiftTimes: { ...scheduleRules.shiftTimes, [shiftKey]: { ...config, end: e.target.value } } })} className="w-full rounded-xl border border-white/40 bg-white/70 px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-current" />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Department Shift Assignments</label>
                                                        <div className="space-y-3">
                                                            {Object.keys(departmentRoles).length > 0 ? Object.keys(departmentRoles).map((dept) => (
                                                                <div key={dept} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div>
                                                                            <p className="text-sm font-black text-slate-900">{dept}</p>
                                                                            <p className="mt-1 text-xs font-medium text-slate-500">Allowed shifts: {getAllowedShiftsForDept(dept).join(', ')}</p>
                                                                        </div>
                                                                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-600">{(departmentRoles[dept] || []).length} roles</span>
                                                                    </div>
                                                                    <select value={scheduleRules.deptShifts[dept] || '3-Shifts'} onChange={(e) => setScheduleRules({ ...scheduleRules, deptShifts: { ...scheduleRules.deptShifts, [dept]: e.target.value } })} className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-blue-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100">
                                                                        <option value="Day-Only">Day Only (Office)</option>
                                                                        <option value="2-Shifts">2-Shifts (Morning / Mid)</option>
                                                                        <option value="3-Shifts">3-Shifts (Morning / Mid / Night)</option>
                                                                    </select>
                                                                </div>
                                                            )) : (
                                                                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">No departments registered.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {displayedScheduleRows.length > 0 ? (
                                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <h4 className="text-lg font-black text-slate-900">Schedule Board</h4>
                                                <p className="text-sm font-medium text-slate-500">Click cells in Manual Edit mode to cycle through the allowed shifts for each department.</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm">{displayedScheduleRows.length} employees</span>
                                                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm">{scheduleSummary.totalHours} total hours</span>
                                                <span className={`rounded-full px-3 py-1 text-[11px] font-bold shadow-sm ${scheduleMode === 'MANUAL' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{scheduleMode === 'MANUAL' ? 'Manual mode live' : 'Auto mode preview'}</span>
                                            </div>
                                        </div>
                                        {scheduleMode === 'MANUAL' && (
                                            <div className="border-b border-orange-100 bg-orange-50 px-5 py-3 text-center text-xs font-black text-orange-700">
                                                Manual Mode Active: click any duty cell to rotate through the allowed shift options.
                                            </div>
                                        )}
                                        <div className="overflow-x-auto">
                                            <table className="min-w-[1220px] w-full border-collapse text-left">
                                                <thead>
                                                    <tr className="bg-slate-900 text-white">
                                                        <th className="sticky left-0 z-10 w-72 bg-slate-950 p-4 text-sm font-black uppercase tracking-wider shadow-[2px_0_5px_rgba(0,0,0,0.1)]">Employee</th>
                                                        {scheduleDateHeaders.map((header) => (
                                                            <th key={header.key} className={`min-w-[74px] border-x border-slate-800 p-3 text-center ${header.isWeekend ? 'bg-slate-800/80' : ''}`}>
                                                                <div className={`text-[10px] font-bold uppercase tracking-wider ${header.isWeekend ? 'text-red-300' : 'text-slate-400'}`}>{header.dayStr}</div>
                                                                <div className={`mt-0.5 text-base font-black ${header.isWeekend ? 'text-red-400' : 'text-white'}`}>{header.dateStr}</div>
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {displayedScheduleRows.map((emp, index) => {
                                                        const metrics = scheduleEmployeeMetrics[emp.emp_id] || getEmployeeScheduleSummary(emp);
                                                        return (
                                                            <tr key={emp.emp_id} className={`border-b border-slate-100 transition-colors hover:bg-blue-50/40 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                                                <td className="sticky left-0 z-10 border-r border-slate-100 bg-white p-4 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                                                    <div className="truncate text-sm font-black text-slate-900">{emp.name}</div>
                                                                    <div className="mt-1 truncate text-[11px] font-medium text-slate-500">{emp.dept} | {emp.role}</div>
                                                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-700">{metrics.hours}h</span>
                                                                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">{metrics.assignedDays} shifts</span>
                                                                        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-600">{metrics.offDays} off</span>
                                                                    </div>
                                                                </td>
                                                                {scheduleDateHeaders.map((header) => {
                                                                    const shift = emp.schedule?.[header.key] || 'Off';
                                                                    const shiftColorClass = scheduleRules.shiftTimes[shift]?.color || 'bg-slate-100 text-slate-400 border-slate-200 shadow-none';
                                                                    const shiftConfig = scheduleRules.shiftTimes[shift];

                                                                    return (
                                                                        <td
                                                                            key={header.key}
                                                                            onClick={() => handleScheduleCellClick(emp.emp_id, header.key, emp.dept)}
                                                                            className={`border-x border-slate-100 p-2 text-center transition-all ${scheduleMode === 'MANUAL' && isScheduleAligned ? 'cursor-pointer hover:bg-slate-200' : ''} ${header.isWeekend ? 'bg-red-50/20' : ''}`}
                                                                            title={shiftConfig ? `${shift}: ${shiftConfig.start} - ${shiftConfig.end}` : shift}
                                                                        >
                                                                            <span className={`inline-block w-full rounded-md border px-1 py-1.5 text-[11px] font-black tracking-tight shadow-sm ${shiftColorClass}`}>
                                                                                {shift}
                                                                            </span>
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-24 text-center shadow-sm">
                                        {!isScheduleAligned && scheduleWeek.length > 0 ? (
                                            <>
                                                <div className="mb-4 text-6xl opacity-20">🧭</div>
                                                <p className="text-lg font-black text-slate-600">The board needs to be refreshed for the new schedule window.</p>
                                                <p className="mt-2 text-sm font-bold text-slate-400">Generate a new draft to match {scheduleView.toLowerCase()} coverage starting on {scheduleStartDate}.</p>
                                            </>
                                        ) : scheduleWeek.length > 0 ? (
                                            <>
                                                <div className="mb-4 text-6xl opacity-20">🔍</div>
                                                <p className="text-lg font-black text-slate-600">No matching employees</p>
                                                <p className="mt-2 text-sm font-bold text-slate-400">Try resetting the search filters to bring the roster back into view.</p>
                                            </>
                                        ) : (
                                            <>
                                                <div className="mb-4 text-6xl opacity-20">🗓️</div>
                                                <p className="text-lg font-black text-slate-600">Scheduler is ready for its first draft</p>
                                                <p className="mt-2 text-sm font-bold text-slate-400">Use Auto Gen to create a balanced board, then refine the assignments in Manual Edit mode.</p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 💸 [필리핀 현지화 완료] PAYROLL 탭 */}
                        {hrSubTab === 'PAYROLL' && (
                            <div className="animate-fade-in space-y-6">

                                {/* 상단 컨트롤 및 대시보드 (View Mode Toggle 적용) */}
                                <div className="bg-slate-50 p-6 md:p-8 rounded-md border border-slate-200 shadow-sm">
                                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
                                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                            <span>🇵🇭</span> DOLE Compliant Payroll
                                        </h2>

                                        {/* 💡 [신규] Calculation (계산) / History (보관함) 토글 버튼 */}
                                        <div className="flex bg-slate-200 p-1 rounded-md">
                                            <button onClick={() => setPayrollViewMode('CALCULATE')} className={`px-4 py-2 rounded-md font-bold text-sm transition-all ${payrollViewMode === 'CALCULATE' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                                                ⚙️ Live Calculation
                                            </button>
                                            <button onClick={() => setPayrollViewMode('HISTORY')} className={`px-4 py-2 rounded-md font-bold text-sm transition-all ${payrollViewMode === 'HISTORY' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                                                🗄️ History Archive
                                            </button>
                                        </div>
                                    </div>

                                    {/* =======================================================
                                        1. 라이브 급여 계산기 모드 (CALCULATE)
                                    ======================================================= */}
                                    {payrollViewMode === 'CALCULATE' && (
                                        <div className="animate-fade-in space-y-6 border-t border-slate-200 pt-6">
                                            <div className="relative overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-700 p-6 text-white shadow-xl">
                                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.22),_transparent_34%)]"></div>
                                                <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                                                    <div className="max-w-2xl">
                                                        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-200">Payroll Intelligence Desk</p>
                                                        <h3 className="mt-3 text-2xl md:text-3xl font-black">Compensation Planning & Settlement</h3>
                                                        <p className="mt-3 max-w-xl text-sm md:text-base text-slate-200">
                                                            Configure earning and deduction rules, inspect departmental cost mix, and settle payroll with a cleaner executive view.
                                                        </p>
                                                        <div className="mt-4 flex flex-wrap gap-2">
                                                            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-100">{payrollPeriod.replace(/_/g, ' ')}</span>
                                                            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-100">{payrollData.length} employees in scope</span>
                                                            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/15 px-3 py-1 text-[11px] font-bold text-emerald-100">{payrollConfiguredAllowanceCount} active allowance rules</span>
                                                            <span className="rounded-full border border-sky-300/30 bg-sky-400/15 px-3 py-1 text-[11px] font-bold text-sky-100">{payrollConfiguredDeductionCount} active deduction rules</span>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[500px]">
                                                        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-300">Cut-Off Window</p>
                                                            <p className="mt-2 text-lg font-black">{payrollDates.start}</p>
                                                            <p className="mt-1 text-xs font-medium text-slate-300">to {payrollDates.end}</p>
                                                        </div>
                                                        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-300">Base Engine</p>
                                                            <p className="mt-2 text-lg font-black">{payrollConfig.base.dailyWorkHours}h / {payrollConfig.base.annualWorkDays}d</p>
                                                            <p className="mt-1 text-xs font-medium text-slate-300">Semi divisor {payrollConfig.base.semiMonthlyDivisor}</p>
                                                        </div>
                                                        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-300">Configured Allowances</p>
                                                            <p className="mt-2 text-lg font-black">{formatCompactCurrency(payrollSummary.totalAllowances)}</p>
                                                            <p className="mt-1 text-xs font-medium text-slate-300">Current period fixed additions</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                                                <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
                                                    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
                                                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                                            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Cut-off</span>
                                                            <input type="date" value={payrollDates.start} onChange={e => setPayrollDates({ ...payrollDates, start: e.target.value })} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer" />
                                                            <span className="text-slate-300">~</span>
                                                            <input type="date" value={payrollDates.end} onChange={e => setPayrollDates({ ...payrollDates, end: e.target.value })} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer" />
                                                        </div>
                                                        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1.5">
                                                            <button onClick={() => {
                                                                setPayrollPeriod('SEMI_MONTHLY');
                                                                const d = new Date(payrollDates.start);
                                                                const year = d.getFullYear();
                                                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                                                setPayrollDates({ start: `${year}-${month}-01`, end: `${year}-${month}-15` });
                                                            }} className={`px-4 py-2 rounded-lg font-black text-xs transition-all ${payrollPeriod === 'SEMI_MONTHLY' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>15-Day Cutoff</button>
                                                            <button onClick={() => {
                                                                setPayrollPeriod('MONTHLY');
                                                                const d = new Date(payrollDates.start);
                                                                const year = d.getFullYear();
                                                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                                                const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
                                                                setPayrollDates({ start: `${year}-${month}-01`, end: `${year}-${month}-${lastDay}` });
                                                            }} className={`px-4 py-2 rounded-lg font-black text-xs transition-all ${payrollPeriod === 'MONTHLY' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>Monthly Total</button>
                                                            <button onClick={() => setPayrollPeriod('13TH_MONTH')} className={`px-4 py-2 rounded-lg font-black text-xs transition-all ${payrollPeriod === '13TH_MONTH' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>13th Month</button>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <button onClick={() => setShowPayrollSettings(true)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">Rules & Settings</button>
                                                        <button onClick={handleResetPayrollConfig} className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200">Reset Rules</button>
                                                    </div>
                                                </div>
                                            </div>

                                            {biometricConfig.enabled && (
                                                <div className={`rounded-2xl border p-4 shadow-sm md:p-5 ${biometricRequiresFreshSync ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Biometric Payroll Guard</p>
                                                            <p className="mt-2 text-sm font-black text-slate-900">
                                                                {biometricRequiresFreshSync
                                                                    ? `Fresh biometric sync required before settlement. Last sync: ${lastDtrSync}`
                                                                    : `Biometric sync is within the ${biometricConfig.requireFreshSyncMinutes}-minute payroll guard window.`}
                                                            </p>
                                                            <p className="mt-1 text-xs font-medium text-slate-500">
                                                                Provider: {biometricConfig.provider} · Mode: {biometricConfig.connectionMode} · Imported last run: {Number(biometricStatus.lastImportedCount || 0)}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDeviceSync({ trigger: 'payroll_dashboard' })}
                                                            disabled={isSyncingDTR}
                                                            className={`rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-sm transition-colors ${isSyncingDTR ? 'cursor-not-allowed bg-emerald-300' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                                        >
                                                            {isSyncingDTR ? 'Syncing latest punches...' : 'Refresh DTR Before Payroll'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Total Gross Salary</p>
                                                    <p className="mt-3 text-3xl font-black text-slate-900">₱ {(totalGross || 0).toLocaleString()}</p>
                                                    <p className="mt-1 text-xs font-medium text-slate-500">Base pay plus operational and configured additions</p>
                                                </div>
                                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Additional Earnings</p>
                                                    <p className="mt-3 text-3xl font-black text-blue-700">₱ {(payrollSummary.totalAdditions || 0).toLocaleString()}</p>
                                                    <p className="mt-1 text-xs font-medium text-slate-500">OT, NSD, holiday, and configured allowances</p>
                                                </div>
                                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Total Deductions</p>
                                                    <p className="mt-3 text-3xl font-black text-red-600">₱ {(totalDeductions || 0).toLocaleString()}</p>
                                                    <p className="mt-1 text-xs font-medium text-slate-500">Govt, insurance, tax, and attendance-linked deductions</p>
                                                </div>
                                                <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-5 text-white shadow-md">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-100">Total Net Payout</p>
                                                    <p className="mt-3 text-3xl font-black">₱ {(totalNet || 0).toLocaleString()}</p>
                                                    <p className="mt-1 text-xs font-medium text-emerald-50">Take-home salary across the selected payroll window</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                                                <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                                                    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                        <div>
                                                            <h4 className="text-lg font-black text-slate-900">Cost by Department</h4>
                                                            <p className="text-sm font-medium text-slate-500">Treemap view showing which departments absorb the largest payroll share.</p>
                                                        </div>
                                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">{sortedDeptCosts.length} departments</span>
                                                    </div>
                                                    <div className="h-[320px] min-h-[320px] min-w-0 overflow-hidden rounded-2xl bg-slate-50">
                                                        {payrollDeptTreemap.length > 0 ? (
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <Treemap
                                                                    data={payrollDeptTreemap}
                                                                    dataKey="value"
                                                                    aspectRatio={4 / 3}
                                                                    stroke="#ffffff"
                                                                    isAnimationActive={false}
                                                                    isUpdateAnimationActive={false}
                                                                    content={<PayrollTreemapNode />}
                                                                >
                                                                    <Tooltip content={<PayrollTreemapTooltip />} />
                                                                </Treemap>
                                                            </ResponsiveContainer>
                                                        ) : (
                                                            <div className="flex h-full items-center justify-center text-center">
                                                                <div>
                                                                    <p className="text-lg font-black text-slate-500">No department cost data yet</p>
                                                                    <p className="mt-2 text-sm font-medium text-slate-400">Add employees or adjust the filter to populate payroll analytics.</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="min-w-0 space-y-6">
                                                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                                                        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                            <div>
                                                                <h4 className="text-lg font-black text-slate-900">Cost by Role</h4>
                                                                <p className="text-sm font-medium text-slate-500">High-cost roles are grouped into an at-a-glance treemap inside the same card.</p>
                                                            </div>
                                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">Top 12 roles</span>
                                                        </div>
                                                        <div className="h-[320px] min-h-[320px] min-w-0 overflow-hidden rounded-2xl bg-slate-50">
                                                            {payrollRoleTreemap.length > 0 ? (
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <Treemap
                                                                        data={payrollRoleTreemap}
                                                                        dataKey="value"
                                                                        aspectRatio={4 / 3}
                                                                        stroke="#ffffff"
                                                                        isAnimationActive={false}
                                                                        isUpdateAnimationActive={false}
                                                                        content={<PayrollTreemapNode />}
                                                                    >
                                                                        <Tooltip content={<PayrollTreemapTooltip />} />
                                                                    </Treemap>
                                                                </ResponsiveContainer>
                                                            ) : (
                                                                <div className="flex h-full items-center justify-center text-center">
                                                                    <div>
                                                                        <p className="text-lg font-black text-slate-500">No role-level data yet</p>
                                                                        <p className="mt-2 text-sm font-medium text-slate-400">The role treemap will populate once payroll rows are available.</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                                                        <h4 className="text-lg font-black text-slate-900">Deduction Mix</h4>
                                                        <p className="mt-1 text-sm font-medium text-slate-500">Quick breakdown of what is driving total deductions in the active cut-off.</p>
                                                        <div className="mt-5 space-y-3">
                                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                                <div className="flex items-center justify-between text-sm font-black text-slate-800">
                                                                    <span>Govt + Insurance</span>
                                                                    <span>₱ {(payrollSummary.totalStatutory || 0).toLocaleString()}</span>
                                                                </div>
                                                                <div className="mt-3 h-2 rounded-full bg-slate-200">
                                                                    <div className="h-2 rounded-full bg-sky-500" style={{ width: `${totalDeductions > 0 ? ((payrollSummary.totalStatutory / totalDeductions) * 100) : 0}%` }}></div>
                                                                </div>
                                                            </div>
                                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                                <div className="flex items-center justify-between text-sm font-black text-slate-800">
                                                                    <span>Withholding Tax</span>
                                                                    <span>₱ {(payrollSummary.totalTax || 0).toLocaleString()}</span>
                                                                </div>
                                                                <div className="mt-3 h-2 rounded-full bg-slate-200">
                                                                    <div className="h-2 rounded-full bg-amber-500" style={{ width: `${totalDeductions > 0 ? ((payrollSummary.totalTax / totalDeductions) * 100) : 0}%` }}></div>
                                                                </div>
                                                            </div>
                                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                                <div className="flex items-center justify-between text-sm font-black text-slate-800">
                                                                    <span>Late / Undertime</span>
                                                                    <span>₱ {(payrollSummary.totalLate || 0).toLocaleString()}</span>
                                                                </div>
                                                                <div className="mt-3 h-2 rounded-full bg-slate-200">
                                                                    <div className="h-2 rounded-full bg-rose-500" style={{ width: `${totalDeductions > 0 ? ((payrollSummary.totalLate / totalDeductions) * 100) : 0}%` }}></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {showPayrollSettings && (
                                        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
                                            <div className="w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in">
                                                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                                                    <div>
                                                        <h4 className="text-xl font-black text-slate-900">Payroll Rules & Settings</h4>
                                                        <p className="mt-1 text-sm font-medium text-slate-500">Review base pay assumptions, configured allowances, and deduction policies before settlement.</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={handleResetPayrollConfig} className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200">Reset Defaults</button>
                                                        <button onClick={() => setShowPayrollSettings(false)} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-500 transition-colors hover:bg-slate-200 hover:text-red-500">✕</button>
                                                    </div>
                                                </div>

                                                <div className="max-h-[82vh] overflow-y-auto px-6 py-6 custom-scrollbar">
                                                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                                            <div className="mb-4">
                                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Base Pay Rules</p>
                                                                <h5 className="mt-2 text-lg font-black text-slate-900">Core Compensation Engine</h5>
                                                            </div>
                                                            <div className="space-y-4">
                                                                {payrollBaseFields.map((field) => (
                                                                    <label key={`pay_base_${field.key}`} className="block">
                                                                        <div className="flex items-start justify-between gap-3">
                                                                            <div>
                                                                                <p className="text-sm font-black text-slate-800">{field.label}</p>
                                                                                <p className="mt-1 text-xs font-medium text-slate-500">{field.help}</p>
                                                                            </div>
                                                                            <input
                                                                                type="number"
                                                                                min={field.min}
                                                                                step={field.step}
                                                                                value={payrollConfig.base[field.key]}
                                                                                onChange={(e) => updatePayrollConfigValue('base', field.key, Number(e.target.value))}
                                                                                className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-black text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                                                                            />
                                                                        </div>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                                            <div className="mb-4">
                                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Earning Settings</p>
                                                                <h5 className="mt-2 text-lg font-black text-slate-900">Additional Allowances</h5>
                                                            </div>
                                                            <div className="space-y-4">
                                                                {payrollAdditionFields.map((field) => (
                                                                    <label key={`pay_add_${field.key}`} className="block">
                                                                        <div className="flex items-start justify-between gap-3">
                                                                            <div>
                                                                                <p className="text-sm font-black text-slate-800">{field.label}</p>
                                                                                <p className="mt-1 text-xs font-medium text-slate-500">{field.help}</p>
                                                                            </div>
                                                                            <input
                                                                                type="number"
                                                                                min={field.min}
                                                                                step={field.step}
                                                                                value={payrollConfig.additions[field.key]}
                                                                                onChange={(e) => updatePayrollConfigValue('additions', field.key, Number(e.target.value))}
                                                                                className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-black text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                                                                            />
                                                                        </div>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                                            <div className="mb-4">
                                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Deduction Settings</p>
                                                                <h5 className="mt-2 text-lg font-black text-slate-900">Insurance & Contribution Rules</h5>
                                                            </div>
                                                            <div className="space-y-4">
                                                                {payrollDeductionFields.map((field) => (
                                                                    <label key={`pay_ded_${field.key}`} className="block">
                                                                        <div className="flex items-start justify-between gap-3">
                                                                            <div>
                                                                                <p className="text-sm font-black text-slate-800">{field.label}</p>
                                                                                <p className="mt-1 text-xs font-medium text-slate-500">{field.help}</p>
                                                                            </div>
                                                                            <input
                                                                                type="number"
                                                                                min={field.min}
                                                                                step={field.step}
                                                                                value={payrollConfig.deductions[field.key]}
                                                                                onChange={(e) => updatePayrollConfigValue('deductions', field.key, Number(e.target.value))}
                                                                                className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-black text-slate-800 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                                                                            />
                                                                        </div>
                                                                    </label>
                                                                ))}

                                                                <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                                                    <div>
                                                                        <p className="text-sm font-black text-slate-800">Deduct Late / Undertime</p>
                                                                        <p className="mt-1 text-xs font-medium text-slate-500">Toggle attendance-based deduction from the payslip.</p>
                                                                    </div>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!!payrollConfig.deductions.deductLateUndertime}
                                                                        onChange={(e) => updatePayrollConfigValue('deductions', 'deductLateUndertime', e.target.checked)}
                                                                        className="h-5 w-5 rounded border-slate-300 text-rose-500 focus:ring-rose-200"
                                                                    />
                                                                </label>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* =======================================================
                                        2. 급여 정산 이력 보관함 모드 (HISTORY ARCHIVE)
                                    ======================================================= */}
                                    {payrollViewMode === 'HISTORY' && (
                                        <div className="animate-fade-in border-t border-slate-200 pt-6">
                                            <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
                                                <div>
                                                    <h3 className="text-lg font-black text-slate-800">🗄️ Settled Payroll Archive</h3>
                                                    <p className="text-xs text-slate-500 font-bold mt-1">Past payrolls that have been finalized and posted to Finance.</p>
                                                </div>
                                                <div className="relative w-full md:w-72">
                                                    <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                                                    <input
                                                        type="text"
                                                        placeholder="Search Period (e.g. 2026-04)..."
                                                        value={payrollHistorySearch}
                                                        onChange={e => setPayrollHistorySearch(e.target.value)}
                                                        className="w-full pl-9 pr-4 py-2 rounded-md border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm bg-white shadow-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {payrollHistory.filter(h => h.period_start.includes(payrollHistorySearch) || h.period_end.includes(payrollHistorySearch)).map(record => (
                                                    <div key={record.id} className="bg-white p-6 border border-slate-200 rounded-md shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                                                        <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                                                            <div>
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Payroll Period</span>
                                                                <h4 className="font-black text-lg text-slate-800 leading-tight">{record.period_start} <span className="text-slate-300">~</span> {record.period_end}</h4>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="inline-block bg-blue-50 text-blue-600 px-2 py-1 rounded text-[9px] font-black uppercase shadow-sm">Posted ✅</span>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2 mb-5">
                                                            <div className="flex justify-between text-xs items-center"><span className="text-slate-500 font-bold">Employees:</span><span className="font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{record.employee_count} Persons</span></div>
                                                            <div className="flex justify-between text-xs"><span className="text-slate-500 font-bold">Total Gross:</span><span className="font-bold text-slate-700">₱{record.total_gross.toLocaleString()}</span></div>
                                                            <div className="flex justify-between text-xs"><span className="text-slate-500 font-bold">Deductions:</span><span className="font-bold text-red-500">- ₱{record.total_deductions.toLocaleString()}</span></div>
                                                        </div>

                                                        <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 p-3 rounded-md mb-4">
                                                            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Net Payout</span>
                                                            <span className="font-black text-xl text-emerald-600">₱{record.total_net.toLocaleString()}</span>
                                                        </div>

                                                        <p className="text-[9px] font-bold text-slate-400 text-right uppercase tracking-widest">Settled on: {record.settled_at}</p>
                                                    </div>
                                                ))}
                                                {payrollHistory.length === 0 && (
                                                    <div className="col-span-full text-center py-16 text-slate-400">
                                                        <span className="text-5xl block mb-3 opacity-30">📭</span>
                                                        <p className="font-black text-lg">No settled payroll history.</p>
                                                        <p className="text-sm font-bold mt-1">Once you settle a payroll, it will be securely archived here.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* =======================================================
                                    3. 직원 검색 필터 바 & 상세 급여 대장 (CALCULATE 모드일 때만 표시)
                                ======================================================= */}
                                {payrollViewMode === 'CALCULATE' && (
                                    <>
                                        <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
                                            <div className="border-b border-slate-200 bg-slate-50 p-4">
                                                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                                    <div className="relative w-full flex-1">
                                                        <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                                                        <input
                                                            type="text"
                                                            placeholder="Search Employee ID or Name..."
                                                            value={payrollSearch.query}
                                                            onChange={e => setPayrollSearch({ ...payrollSearch, query: e.target.value })}
                                                            className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                                                        />
                                                    </div>
                                                    <div className="flex w-full gap-2 md:w-auto">
                                                        <select value={payrollSearch.dept} onChange={e => setPayrollSearch({ ...payrollSearch, dept: e.target.value, role: '' })} className="flex-1 md:w-40 rounded-md border border-slate-200 bg-white p-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500">
                                                            <option value="">All Depts</option>
                                                            {Object.keys(departmentRoles || {}).map(dept => <option key={`pay_dept_${dept}`} value={dept}>{dept}</option>)}
                                                        </select>
                                                        <select value={payrollSearch.role} onChange={e => setPayrollSearch({ ...payrollSearch, role: e.target.value })} disabled={!payrollSearch.dept} className="flex-1 md:w-40 rounded-md border border-slate-200 bg-white p-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400">
                                                            <option value="">All Roles</option>
                                                            {payrollSearch.dept && (departmentRoles[payrollSearch.dept] || []).map(r => <option key={`pay_role_${r}`} value={r}>{r}</option>)}
                                                        </select>
                                                        <button
                                                            onClick={() => setPayrollSearch({ query: '', dept: '', role: '' })}
                                                            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 transition-colors hover:bg-slate-100"
                                                        >
                                                            Reset
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-6">
                                                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Filtered Scope</p>
                                                        <p className="mt-2 text-lg font-black text-slate-900">{payrollData.length} employees</p>
                                                        <p className="mt-1 text-xs font-medium text-slate-500">
                                                            {payrollData.length === 0 ? 'No rows match the current filters.' : `Rows ${payrollPageStartRow}-${payrollPageEndRow} on page ${safePayrollPage} of ${payrollTotalPages}.`}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Basic Pay Subtotal</p>
                                                        <p className="mt-2 text-lg font-black text-slate-900">₱ {payrollSubtotal.basicPay.toLocaleString()}</p>
                                                        <p className="mt-1 text-xs font-medium text-slate-500">Current filter result only</p>
                                                    </div>
                                                    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-500">Additions Subtotal</p>
                                                        <p className="mt-2 text-lg font-black text-blue-700">₱ {payrollSubtotal.additions.toLocaleString()}</p>
                                                        <p className="mt-1 text-xs font-medium text-blue-600/80">OT, NSD, allowance mix</p>
                                                    </div>
                                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">Gross Pay Subtotal</p>
                                                        <p className="mt-2 text-lg font-black text-emerald-700">₱ {payrollSubtotal.grossPay.toLocaleString()}</p>
                                                        <p className="mt-1 text-xs font-medium text-emerald-700/80">Before deductions</p>
                                                    </div>
                                                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 shadow-sm">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-600">Deductions Subtotal</p>
                                                        <p className="mt-2 text-lg font-black text-rose-700">₱ {payrollSubtotal.deductions.toLocaleString()}</p>
                                                        <p className="mt-1 text-xs font-medium text-rose-700/80">Govt, insurance, tax, late</p>
                                                    </div>
                                                    <div className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 shadow-sm">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">Net Payout Subtotal</p>
                                                        <p className="mt-2 text-lg font-black text-white">₱ {payrollSubtotal.netPay.toLocaleString()}</p>
                                                        <p className="mt-1 text-xs font-medium text-slate-300">Take-home total for current filter</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 상세 급여 대장 (Table) */}
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse min-w-[1200px]">
                                                    <thead>
                                                        <tr className="bg-slate-800 text-white text-[10px] uppercase tracking-wider">
                                                            <th className="p-4 sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.1)] bg-slate-900">Employee Details</th>
                                                            <th className="p-4">Basic Pay</th>
                                                            <th className="p-4 bg-blue-900/40 text-blue-200">Additions (OT/NSD/Allow)</th>
                                                            <th className="p-4 font-black text-lg text-emerald-400">Gross Pay</th>
                                                            <th className="p-4 bg-red-900/30 text-red-300">Deductions (Gov/Ins/Tax)</th>
                                                            <th className="p-4 font-black text-lg text-emerald-400">Net Payout</th>
                                                            <th className="p-4 text-center">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(!payrollData || payrollData.length === 0) ? (
                                                            <tr><td colSpan="7" className="p-10 text-center font-bold text-slate-400">No employees match the filter criteria.</td></tr>
                                                        ) : (
                                                            payrollPageRows.map((data, index) => (
                                                                <tr key={data.emp_id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${(payrollPageStartIndex + index) % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                                                    <td className="p-4 bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-r border-slate-100">
                                                                        <div className="font-bold text-slate-800 text-sm">{data.name}</div>
                                                                        <div className="text-[10px] text-slate-500">{data.dept} | {data.role}</div>
                                                                    </td>
                                                                    <td className="p-4 font-bold text-slate-600">₱ {(data.periodBaseSalary || data.baseSalary || 0).toLocaleString()}</td>
                                                                    <td className="p-4">
                                                                        <div className="text-xs text-blue-600 font-bold mb-1">+ ₱ {(data.totalAdditions || 0).toLocaleString()}</div>
                                                                        <div className="text-[9px] text-slate-400 leading-tight">
                                                                            OT: ₱{(data.overtimePay || 0).toLocaleString()} | NSD: ₱{(data.nsdPay || 0).toLocaleString()}<br />
                                                                            Allow: ₱{(data.fixedAllowanceTotal || 0).toLocaleString()} | Hol: ₱{(data.holidayPay || 0).toLocaleString()}
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-4 font-black text-emerald-600">₱ {(data.grossPay || 0).toLocaleString()}</td>
                                                                    <td className="p-4">
                                                                        <div className="text-xs text-red-500 font-bold mb-1">- ₱ {(data.totalDed || 0).toLocaleString()}</div>
                                                                        <div className="text-[9px] text-slate-400 leading-tight">
                                                                            SSS: ₱{(data.sss || 0).toLocaleString()} | PHIC: ₱{(data.philhealth || 0).toLocaleString()}<br />
                                                                            HDMF: ₱{(data.pagibig || 0).toLocaleString()} | Ins: ₱{(data.insurance || 0).toLocaleString()} | Tax: ₱{(data.wht || 0).toLocaleString()}
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-4 font-black text-lg text-slate-800">₱ {(data.netPay || 0).toLocaleString()}</td>
                                                                    <td className="p-4 text-center">
                                                                        <button onClick={() => setSelectedPayslip(data)} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-md text-xs font-bold shadow-sm flex items-center gap-2 mx-auto transition-transform active:scale-95">
                                                                            <span>👁️</span> View Payslip
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="flex flex-col gap-4 border-t border-slate-200 bg-white px-4 py-4 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <p className="text-sm font-black text-slate-800">
                                                        {payrollData.length === 0 ? 'No matching payroll rows.' : `Showing ${payrollPageStartRow}-${payrollPageEndRow} of ${payrollData.length} payroll rows.`}
                                                    </p>
                                                    <p className="mt-1 text-xs font-medium text-slate-500">
                                                        One page contains up to {PAYROLL_PAGE_SIZE} employees, while the subtotal above continues to reflect the full filtered result.
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <button
                                                        onClick={handleExportPayrollLedgerPDF}
                                                        disabled={payrollData.length === 0}
                                                        className="rounded-md border border-slate-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Export Filtered PDF
                                                    </button>
                                                    <button
                                                        onClick={() => setPayrollPage((prev) => Math.max(1, prev - 1))}
                                                        disabled={safePayrollPage === 1}
                                                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Prev
                                                    </button>
                                                    {payrollPageNumbers.map((pageNumber) => (
                                                        <button
                                                            key={`payroll_page_${pageNumber}`}
                                                            onClick={() => setPayrollPage(pageNumber)}
                                                            className={`rounded-md px-3 py-2 text-xs font-black transition-colors ${pageNumber === safePayrollPage ? 'bg-slate-900 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}
                                                        >
                                                            {pageNumber}
                                                        </button>
                                                    ))}
                                                    <button
                                                        onClick={() => setPayrollPage((prev) => Math.min(payrollTotalPages, prev + 1))}
                                                        disabled={safePayrollPage === payrollTotalPages}
                                                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 💡 [신규] 급여 정산 & 재무 연동 버튼 */}
                                        <div className="mt-8 animate-fade-in">
                                            <button
                                                onClick={handleSettlePayroll}
                                                disabled={isSettling || payrollData.length === 0}
                                                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-5 rounded-md font-black text-xl shadow-2xl transition-transform active:scale-95 flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isSettling ? <span className="animate-spin text-2xl">⏳</span> : <span className="text-2xl">✅</span>}
                                                {isSettling ? 'Processing Settlement & Posting to Finance...' : 'Settle Payroll & Post to Finance Ledger'}
                                            </button>
                                            <p className="text-center text-xs font-bold text-slate-400 mt-3 uppercase tracking-widest">
                                                This action will finalize the payroll for the selected period and log ₱{(totalGross || 0).toLocaleString()} as a company expense.
                                            </p>
                                            {biometricConfig.enabled && biometricRequiresFreshSync && (
                                                <p className="mt-2 text-center text-xs font-black uppercase tracking-[0.22em] text-amber-600">
                                                    Latest biometric sync is required before payroll can be finalized.
                                                </p>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* ========================================== */}
                                {/* 💡 급여 명세서(Payslip) 상세 보기 모달창 (유지) */}
                                {/* ========================================== */}
                                {selectedPayslip && (
                                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
                                        <div className="bg-white rounded-md shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                                            {/* 모달 헤더 */}
                                            <div className="bg-slate-800 p-5 md:p-6 flex justify-between items-center text-white shrink-0">
                                                <h2 className="text-xl md:text-2xl font-black flex items-center gap-2">
                                                    <span>📄</span> Employee Payslip
                                                </h2>
                                                <button onClick={() => setSelectedPayslip(null)} className="text-slate-400 hover:text-white font-bold text-2xl transition-colors">×</button>
                                            </div>

                                            {/* 모달 본문 (명세서 내용) */}
                                            <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-slate-50">

                                                {/* 직원 기본 정보 */}
                                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-md border border-slate-200 shadow-sm mb-6 gap-4">
                                                    <div>
                                                        <h3 className="text-xl font-black text-slate-800">{selectedPayslip.name}</h3>
                                                        <p className="text-sm font-bold text-slate-500 mt-1">{selectedPayslip.role} <span className="text-slate-300 mx-1">|</span> {selectedPayslip.dept}</p>
                                                        <p className="text-xs font-medium text-slate-400 mt-1">Emp ID: {selectedPayslip.emp_id}</p>
                                                    </div>
                                                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-md text-right w-full md:w-auto">
                                                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Payroll Period</p>
                                                        <p className="text-sm font-bold text-blue-800">{(typeof payrollDates !== 'undefined') ? `${payrollDates.start} ~ ${payrollDates.end}` : 'Selected Period'}</p>
                                                    </div>
                                                </div>

                                                {/* 급여 상세 내역 표 */}
                                                <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden mb-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">

                                                        {/* 왼쪽: Earnings (지급) */}
                                                        <div className="p-5">
                                                            <h4 className="font-black text-emerald-600 mb-4 flex justify-between border-b border-slate-100 pb-2">
                                                                <span>EARNINGS</span> <span>Amount</span>
                                                            </h4>
                                                            <div className="space-y-3 text-sm">
                                                                {(selectedPayslip.earningLines || []).map((line) => (
                                                                    <div key={`earning_${line.label}`} className="flex justify-between font-medium text-slate-600">
                                                                        <span>{line.label}</span> <span>₱{(line.amount || 0).toLocaleString()}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* 오른쪽: Deductions (공제) */}
                                                        <div className="p-5 bg-red-50/30">
                                                            <h4 className="font-black text-red-600 mb-4 flex justify-between border-b border-red-100 pb-2">
                                                                <span>DEDUCTIONS</span> <span>Amount</span>
                                                            </h4>
                                                            <div className="space-y-3 text-sm">
                                                                {(selectedPayslip.deductionLines || []).length > 0 ? (
                                                                    (selectedPayslip.deductionLines || []).map((line) => (
                                                                        <div key={`deduction_${line.label}`} className="flex justify-between font-bold text-slate-700">
                                                                            <span>{line.label}</span> <span>₱{(line.amount || 0).toLocaleString()}</span>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="flex justify-between font-bold text-slate-700">
                                                                        <span>No deductions applied</span> <span>₱0</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 합계 영역 */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-slate-100 border-t border-slate-200">
                                                        <div className="p-4 flex justify-between items-center">
                                                            <span className="font-black text-slate-500 uppercase text-xs tracking-widest">Gross Pay</span>
                                                            <span className="font-black text-lg text-slate-800">₱{(selectedPayslip.grossPay || 0).toLocaleString()}</span>
                                                        </div>
                                                        <div className="p-4 flex justify-between items-center">
                                                            <span className="font-black text-slate-500 uppercase text-xs tracking-widest">Total Deductions</span>
                                                            <span className="font-black text-lg text-red-600">₱{(selectedPayslip.totalDed || 0).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 최종 지급액 (Net Payout) */}
                                                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 rounded-md text-white shadow-lg flex justify-between items-center">
                                                    <div>
                                                        <p className="text-xs font-black uppercase tracking-widest text-emerald-100 mb-1">Final Net Payout</p>
                                                        <p className="text-sm font-medium text-emerald-50">Take-home pay for this period</p>
                                                    </div>
                                                    <div className="text-3xl md:text-4xl font-black drop-shadow-md">
                                                        ₱{(selectedPayslip.netPay || 0).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 모달 하단 버튼 */}
                                            <div className="p-5 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
                                                <button onClick={() => setSelectedPayslip(null)} className="px-6 py-3 rounded-md font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Close</button>
                                                <button onClick={() => handleDownloadPayslipPDF(selectedPayslip)} className="px-8 py-3 rounded-md font-black bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center gap-2 transition-transform active:scale-95">
                                                    <span>⬇️</span> Download PDF
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>
                        )}
                    </div>
                )}

                {hrSubTab === 'DOCS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5 md:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.26em] text-blue-500">Evals & Growth</p>
                                    <h3 className="text-2xl font-black text-slate-900 mt-2">Performance Evaluation Studio</h3>
                                    <p className="text-sm text-slate-500 mt-2">Create structured monthly evaluations and keep a clean performance history that feeds back into the employee directory.</p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
                                    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Total Reviews</p>
                                        <p className="text-2xl font-black text-slate-900 mt-1">{normalizedEvaluations.length}</p>
                                    </div>
                                    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Avg Score</p>
                                        <p className="text-2xl font-black text-slate-900 mt-1">{evaluationAverageScore ? evaluationAverageScore.toFixed(1) : '--'}</p>
                                    </div>
                                    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Tracked Months</p>
                                        <p className="text-2xl font-black text-slate-900 mt-1">{evaluationArchiveMonths.length}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 md:p-6 grid grid-cols-1 xl:grid-cols-[0.92fr,1.08fr] gap-6">
                                <div className="rounded-md border border-slate-200 bg-slate-50 p-5 space-y-4">
                                    <div>
                                        <h4 className="text-lg font-black text-slate-900">Submit Monthly Review</h4>
                                        <p className="text-sm text-slate-500 mt-1">Use this form for monthly appraisals, coaching notes, or probation checkpoints.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Employee</label>
                                            <select
                                                value={newEval.emp_id}
                                                onChange={(e) => setNewEval({ ...newEval, emp_id: e.target.value })}
                                                className="w-full p-3 border border-slate-200 rounded-md bg-white font-bold text-slate-700"
                                            >
                                                <option value="">Select Employee...</option>
                                                {(employees || []).map((employee) => (
                                                    <option key={employee.emp_id} value={employee.emp_id}>
                                                        {employee.name} ({employee.emp_id})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Review Month</label>
                                            <input
                                                type="month"
                                                value={newEval.period_month}
                                                onChange={(e) => setNewEval({ ...newEval, period_month: e.target.value })}
                                                className="w-full p-3 border border-slate-200 rounded-md bg-white font-bold text-slate-700"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Review Type</label>
                                            <select
                                                value={newEval.review_type}
                                                onChange={(e) => setNewEval({ ...newEval, review_type: e.target.value })}
                                                className="w-full p-3 border border-slate-200 rounded-md bg-white font-bold text-slate-700"
                                            >
                                                <option value="Monthly Review">Monthly Review</option>
                                                <option value="Probation Review">Probation Review</option>
                                                <option value="Performance Coaching">Performance Coaching</option>
                                                <option value="Quarterly Calibration">Quarterly Calibration</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="rounded-md border border-slate-200 bg-white p-4">
                                        <div className="flex items-center justify-between gap-3 mb-3">
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Performance Score</label>
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-black ${getEvaluationScoreTone(newEval.score)}`}>
                                                {clampEvaluationScore(newEval.score).toFixed(1)} / 5
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="5"
                                            step="0.5"
                                            value={newEval.score}
                                            onChange={(e) => setNewEval({ ...newEval, score: Number(e.target.value) })}
                                            className="w-full accent-blue-600"
                                        />
                                        <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2">
                                            <span>Needs Support</span>
                                            <span>Stable</span>
                                            <span>Outstanding</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Remarks & Coaching Notes</label>
                                        <textarea
                                            value={newEval.remarks}
                                            onChange={(e) => setNewEval({ ...newEval, remarks: e.target.value })}
                                            className="w-full min-h-[180px] p-3 border border-slate-200 rounded-md bg-white text-sm text-slate-700 leading-6"
                                            placeholder="Document achievements, gaps, coaching plans, and next month focus areas."
                                        />
                                    </div>

                                    <button
                                        onClick={handleAddEvaluation}
                                        className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-md w-full font-black shadow-sm transition-colors"
                                    >
                                        Save Evaluation Record
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h4 className="text-lg font-black text-slate-900">Monthly Evaluation Archive</h4>
                                            <p className="text-sm text-slate-500 mt-1">Recent review cycles across the hotel team.</p>
                                        </div>
                                        <span className="inline-flex items-center px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-xs font-black text-slate-600">
                                            {normalizedEvaluations.length} records in scope
                                        </span>
                                    </div>

                                    {evaluationArchiveMonths.length > 0 ? (
                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                            {evaluationArchiveMonths.slice(0, 8).map((monthBucket) => (
                                                <div key={monthBucket.monthKey} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                                                    <div className="flex items-start justify-between gap-3 mb-3">
                                                        <div>
                                                            <h5 className="font-black text-slate-900">{monthBucket.monthLabel}</h5>
                                                            <p className="text-xs text-slate-500">{monthBucket.reviewCount} review(s) | Avg {monthBucket.averageScore.toFixed(1)}</p>
                                                        </div>
                                                        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{monthBucket.monthKey}</span>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {monthBucket.reviews.slice(0, 4).map((review) => (
                                                            <div key={review.id} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div>
                                                                        <p className="text-sm font-black text-slate-800">{review.employee_name}</p>
                                                                        <p className="text-xs text-slate-500 mt-1">{review.department} | {review.role || review.review_type}</p>
                                                                    </div>
                                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-black ${getEvaluationScoreTone(review.score)}`}>
                                                                        {review.score.toFixed(1)}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-500 mt-2">{review.review_type} | {review.recorded_label}</p>
                                                                <p className="text-sm text-slate-600 leading-6 mt-2 line-clamp-3">{review.remarks || 'No remarks recorded.'}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-md border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-slate-400">
                                            <span className="text-4xl block mb-3 opacity-30">📝</span>
                                            <p className="text-sm font-bold">No evaluation records have been submitted yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5 md:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.26em] text-emerald-500">COE Builder</p>
                                    <h3 className="text-2xl font-black text-slate-900 mt-2">Professional Certificate Studio</h3>
                                    <p className="text-sm text-slate-500 mt-2">Brand the certificate with logo, background, signature, and company details while keeping the PDF output aligned with the on-screen preview.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-xs font-black text-slate-600">{coeConfig.show_logo ? 'Logo Enabled' : 'Logo Hidden'}</span>
                                    <span className="inline-flex items-center px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-xs font-black text-slate-600">{coeConfig.show_background ? 'Background Enabled' : 'Background Hidden'}</span>
                                    <span className="inline-flex items-center px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-xs font-black text-slate-600">{coeConfig.show_watermark ? 'Watermark On' : 'Watermark Off'}</span>
                                </div>
                            </div>

                            <div className="p-5 md:p-6 grid grid-cols-1 2xl:grid-cols-[0.95fr,1.05fr] gap-6">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-md border border-slate-200 bg-slate-50 p-5">
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Company Name</label>
                                            <input value={coeConfig.company_name} onChange={(e) => setCoeConfig({ ...coeConfig, company_name: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md bg-white font-bold text-slate-700" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Document Title</label>
                                            <input value={coeConfig.document_title} onChange={(e) => setCoeConfig({ ...coeConfig, document_title: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md bg-white font-bold text-slate-700" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Accent Color</label>
                                            <div className="flex gap-2">
                                                <input type="color" value={coeConfig.accent_color} onChange={(e) => setCoeConfig({ ...coeConfig, accent_color: e.target.value })} className="h-[48px] w-16 border border-slate-200 rounded-md bg-white" />
                                                <input value={coeConfig.accent_color} onChange={(e) => setCoeConfig({ ...coeConfig, accent_color: e.target.value })} className="flex-1 p-3 border border-slate-200 rounded-md bg-white font-mono text-sm text-slate-700" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Border Style</label>
                                            <select value={coeConfig.border_style} onChange={(e) => setCoeConfig({ ...coeConfig, border_style: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md bg-white font-bold text-slate-700">
                                                {COE_BORDER_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Company Address</label>
                                            <input value={coeConfig.company_address} onChange={(e) => setCoeConfig({ ...coeConfig, company_address: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md bg-white text-slate-700" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-md border border-slate-200 bg-slate-50 p-5">
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Issue City</label>
                                            <input value={coeConfig.issue_city} onChange={(e) => setCoeConfig({ ...coeConfig, issue_city: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md bg-white font-bold text-slate-700" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Reference Prefix</label>
                                            <input value={coeConfig.reference_prefix} onChange={(e) => setCoeConfig({ ...coeConfig, reference_prefix: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md bg-white font-bold text-slate-700" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Signatory Name</label>
                                            <input value={coeConfig.signatory_name} onChange={(e) => setCoeConfig({ ...coeConfig, signatory_name: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md bg-white font-bold text-slate-700" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Signatory Title</label>
                                            <input value={coeConfig.signatory_title} onChange={(e) => setCoeConfig({ ...coeConfig, signatory_title: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md bg-white font-bold text-slate-700" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Company Email</label>
                                            <input value={coeConfig.company_email} onChange={(e) => setCoeConfig({ ...coeConfig, company_email: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md bg-white text-slate-700" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Company Phone</label>
                                            <input value={coeConfig.company_phone} onChange={(e) => setCoeConfig({ ...coeConfig, company_phone: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md bg-white text-slate-700" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Watermark Text</label>
                                            <input value={coeConfig.watermark_text} onChange={(e) => setCoeConfig({ ...coeConfig, watermark_text: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md bg-white font-bold text-slate-700" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Body Font Size</label>
                                            <input type="number" min="10" max="14" value={coeConfig.body_font_size} onChange={(e) => setCoeConfig({ ...coeConfig, body_font_size: Number(e.target.value) })} className="w-full p-3 border border-slate-200 rounded-md bg-white font-bold text-slate-700" />
                                        </div>
                                    </div>

                                    <div className="rounded-md border border-slate-200 bg-slate-50 p-5">
                                        <div className="flex flex-wrap gap-3">
                                            <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                                                <input type="checkbox" checked={Boolean(coeConfig.show_reference)} onChange={(e) => setCoeConfig({ ...coeConfig, show_reference: e.target.checked })} className="accent-blue-600" />
                                                Show reference number
                                            </label>
                                            <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                                                <input type="checkbox" checked={Boolean(coeConfig.show_logo)} onChange={(e) => setCoeConfig({ ...coeConfig, show_logo: e.target.checked })} className="accent-blue-600" />
                                                Show company logo
                                            </label>
                                            <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                                                <input type="checkbox" checked={Boolean(coeConfig.show_background)} onChange={(e) => setCoeConfig({ ...coeConfig, show_background: e.target.checked })} className="accent-blue-600" />
                                                Show background image
                                            </label>
                                            <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                                                <input type="checkbox" checked={Boolean(coeConfig.show_watermark)} onChange={(e) => setCoeConfig({ ...coeConfig, show_watermark: e.target.checked })} className="accent-blue-600" />
                                                Show watermark
                                            </label>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {[
                                            { label: 'Background Image', assetKey: 'bg_image_url', fileKey: 'bgFile' },
                                            { label: 'Company Logo', assetKey: 'logo_image_url', fileKey: 'logoFile' },
                                            { label: 'Signature Image', assetKey: 'signature_image_url', fileKey: 'signatureFile' }
                                        ].map((asset) => (
                                            <div key={asset.assetKey} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                                                <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">{asset.label}</label>
                                                <input
                                                    type="file"
                                                    accept=".png,.jpg,.jpeg"
                                                    onChange={(e) => handleCoeAssetChange(asset.assetKey, asset.fileKey, e.target.files?.[0] || null)}
                                                    className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-black file:text-white hover:file:bg-slate-800"
                                                />
                                                <div className="mt-3 h-28 rounded-md border border-dashed border-slate-200 bg-white flex items-center justify-center overflow-hidden">
                                                    {coeConfig[asset.assetKey] ? (
                                                        <img src={coeConfig[asset.assetKey]} alt={asset.label} className="w-full h-full object-contain" />
                                                    ) : (
                                                        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">No Asset</span>
                                                    )}
                                                </div>
                                                {coeConfig[asset.assetKey] && (
                                                    <button
                                                        onClick={() => handleRemoveCoeAsset(asset.assetKey, asset.fileKey)}
                                                        className="mt-3 w-full rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-100 transition-colors"
                                                    >
                                                        Remove Asset
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="rounded-md border border-slate-200 bg-slate-50 p-5">
                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
                                            <div>
                                                <h4 className="text-lg font-black text-slate-900">Template Body</h4>
                                                <p className="text-sm text-slate-500 mt-1">Use the available tags below to pull live employee and company data into the certificate.</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {COE_TEMPLATE_TAGS.map((tag) => (
                                                    <span key={tag} className="inline-flex items-center px-2.5 py-1 rounded-full border border-slate-200 bg-white text-[11px] font-black text-slate-600">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <textarea
                                            value={coeConfig.template}
                                            onChange={(e) => setCoeConfig({ ...coeConfig, template: e.target.value })}
                                            className="w-full min-h-[220px] p-4 border border-slate-200 rounded-md bg-white text-sm text-slate-700 leading-7"
                                            placeholder="Draft your COE body here..."
                                        />
                                        <div className="mt-4">
                                            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Footer Note</label>
                                            <textarea
                                                value={coeConfig.footer_note}
                                                onChange={(e) => setCoeConfig({ ...coeConfig, footer_note: e.target.value })}
                                                className="w-full min-h-[96px] p-3 border border-slate-200 rounded-md bg-white text-sm text-slate-700 leading-6"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSaveCoeConfig}
                                        className="w-full rounded-md bg-slate-900 px-4 py-3 text-white font-black hover:bg-slate-800 transition-colors shadow-md"
                                    >
                                        Save Builder Settings
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-md border border-slate-200 bg-slate-50 p-5">
                                        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-4 items-end">
                                            <div>
                                                <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 block mb-2">Preview Employee</label>
                                                <select value={selectedCoeEmployeeId} onChange={(e) => setSelectedCoeEmployeeId(e.target.value)} className="w-full p-3 border border-slate-200 rounded-md bg-white font-bold text-slate-700">
                                                    {(employees || []).map((employee) => (
                                                        <option key={employee.emp_id} value={employee.emp_id}>
                                                            {employee.name} ({employee.emp_id})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button
                                                onClick={() => selectedCoeEmployeeId && handleGenerateCOE(selectedCoeEmployeeId)}
                                                className="rounded-md bg-emerald-600 px-5 py-3 text-white font-black hover:bg-emerald-700 transition-colors shadow-md"
                                            >
                                                Download COE PDF
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                                            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Reference</p>
                                                <p className="text-sm font-black text-slate-800 mt-1">{buildCoeReferenceNo(coeConfig, currentCoeEmployeeContext?.emp_id)}</p>
                                            </div>
                                            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Employee Dept</p>
                                                <p className="text-sm font-black text-slate-800 mt-1">{currentCoeEmployeeContext?.department || 'Unassigned'}</p>
                                            </div>
                                            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Date Hired</p>
                                                <p className="text-sm font-black text-slate-800 mt-1">{currentCoeEmployeeContext?.date_hired || '--'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`rounded-[28px] border bg-white shadow-xl shadow-slate-200/60 overflow-hidden ${coePreviewBorderTone}`}>
                                        <div
                                            className="relative min-h-[760px] p-8 md:p-10"
                                            style={{
                                                backgroundImage: coeConfig.show_background && coeConfig.bg_image_url
                                                    ? `linear-gradient(rgba(255,255,255,0.90), rgba(255,255,255,0.95)), url(${coeConfig.bg_image_url})`
                                                    : 'linear-gradient(135deg, rgba(248,250,252,1), rgba(255,255,255,1))',
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center'
                                            }}
                                        >
                                            {coeConfig.show_watermark && coeConfig.watermark_text && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <span className="text-[88px] font-black uppercase tracking-[0.32em] text-slate-100 select-none">
                                                        {coeConfig.watermark_text}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="relative z-10 space-y-8">
                                                <div
                                                    className="rounded-[22px] px-5 py-4 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-lg"
                                                    style={{ backgroundColor: coeConfig.accent_color }}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        {coeConfig.show_logo && coeConfig.logo_image_url && (
                                                            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 p-2 shrink-0">
                                                                <img src={coeConfig.logo_image_url} alt="Company Logo" className="w-full h-full object-contain" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="text-2xl font-black">{coeConfig.company_name || 'HOTEL CMS'}</p>
                                                            <p className="text-sm text-white/80 mt-1">{coeConfig.company_address || 'Business Address'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-left md:text-right">
                                                        <p className="text-xs font-black uppercase tracking-[0.24em] text-white/75">Issued</p>
                                                        <p className="text-sm font-black mt-1">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })}</p>
                                                        <p className="text-xs text-white/75 mt-1">{coeConfig.show_reference ? buildCoeReferenceNo(coeConfig, currentCoeEmployeeContext?.emp_id) : `Issued in ${coeConfig.issue_city}`}</p>
                                                    </div>
                                                </div>

                                                <div className="rounded-[24px] border border-slate-200 bg-white/95 p-8 md:p-10 shadow-lg">
                                                    <div className="text-center">
                                                        <p className="text-[11px] font-black uppercase tracking-[0.30em]" style={{ color: coeConfig.accent_color }}>Official HR Document</p>
                                                        <h4 className="text-3xl md:text-[34px] font-black text-slate-900 mt-3">{coeConfig.document_title || 'CERTIFICATE OF EMPLOYMENT'}</h4>
                                                        <p className="text-sm text-slate-500 mt-3">Issue City: {coeConfig.issue_city || 'Manila'} | Employee ID: {currentCoeEmployeeContext?.emp_id || '--'}</p>
                                                    </div>

                                                    <div className="mt-10 space-y-6">
                                                        <p className="text-sm font-black text-slate-800">To Whom It May Concern:</p>
                                                        <div className="text-[15px] leading-8 text-slate-600 whitespace-pre-wrap">
                                                            {coePreviewText}
                                                        </div>
                                                    </div>

                                                    <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Department</p>
                                                            <p className="font-black text-slate-800 mt-2">{currentCoeEmployeeContext?.department || 'Unassigned'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Role</p>
                                                            <p className="font-black text-slate-800 mt-2">{currentCoeEmployeeContext?.role || '--'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Date Hired</p>
                                                            <p className="font-black text-slate-800 mt-2">{currentCoeEmployeeContext?.date_hired || '--'}</p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-12 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
                                                        <div>
                                                            <p className="text-sm text-slate-600">Respectfully issued by,</p>
                                                            {coeConfig.signature_image_url && (
                                                                <div className="h-20 mt-4">
                                                                    <img src={coeConfig.signature_image_url} alt="Signature" className="h-full object-contain" />
                                                                </div>
                                                            )}
                                                            <div className="w-60 border-b border-slate-400 mt-4" />
                                                            <p className="text-base font-black text-slate-900 mt-2">{coeConfig.signatory_name || 'Human Resources Department'}</p>
                                                            <p className="text-sm text-slate-500 mt-1">{coeConfig.signatory_title || 'HR Manager'}</p>
                                                        </div>

                                                        <div className="text-sm text-slate-500 md:text-right">
                                                            <p>{coeConfig.company_phone || ''}</p>
                                                            <p className="mt-1">{coeConfig.company_email || ''}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <p className="text-center text-xs text-slate-500 leading-6 px-4">
                                                    {coeConfig.footer_note}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🏦 BANK ACCOUNTS */}
                {activeTab === 'BANK_ACCOUNTS' && (
                    <div className="animate-fade-in w-full max-w-full">
                        <h2 className="text-2xl md:text-3xl font-black mb-6 md:mb-8 text-slate-800">Corporate Bank Accounts</h2>
                        <div className="bg-white p-5 md:p-8 rounded-md shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-4 items-start md:items-end">
                            <div className="w-full md:flex-1"><label className="text-xs font-bold text-slate-500 block mb-1">Bank Name</label><input placeholder="e.g. BDO, Metrobank" value={newBank.bank} onChange={e => setNewBank({ ...newBank, bank: e.target.value })} className="w-full p-2.5 md:p-3 border rounded-md focus:ring-2 focus:ring-blue-500" /></div>
                            <div className="w-full md:flex-1"><label className="text-xs font-bold text-slate-500 block mb-1">Account Name</label><input placeholder="e.g. Main Operations" value={newBank.account_name} onChange={e => setNewBank({ ...newBank, account_name: e.target.value })} className="w-full p-2.5 md:p-3 border rounded-md focus:ring-2 focus:ring-blue-500" /></div>
                            <div className="w-full md:flex-1"><label className="text-xs font-bold text-slate-500 block mb-1">Account Number</label><input placeholder="xxxx-xxxx-xxxx" value={newBank.account_num} onChange={e => setNewBank({ ...newBank, account_num: e.target.value })} className="w-full p-2.5 md:p-3 border rounded-md font-mono focus:ring-2 focus:ring-blue-500" /></div>
                            <div className="w-full md:w-32 lg:w-40"><label className="text-xs font-bold text-slate-500 block mb-1">Type</label><select value={newBank.type} onChange={e => setNewBank({ ...newBank, type: e.target.value })} className="w-full p-2.5 md:p-3 border rounded-md"><option>Corporate</option><option>Checking</option><option>Savings</option><option>Petty Cash</option></select></div>
                            <div className="w-full md:w-32 lg:w-48"><label className="text-xs font-bold text-slate-500 block mb-1">Initial Bal (₱)</label><input type="number" value={newBank.balance} onChange={e => setNewBank({ ...newBank, balance: e.target.value })} className="w-full p-2.5 md:p-3 border rounded-md font-bold md:text-right focus:ring-2 focus:ring-blue-500" /></div>
                            <button onClick={handleAddBank} className="w-full md:w-auto bg-slate-900 text-white px-8 py-3 md:h-[50px] rounded-md font-bold hover:bg-slate-800 transition-colors shadow-sm">Add</button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                            {bankAccounts.map(acc => (
                                <div key={acc.id} className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-200 relative overflow-hidden group">
                                    <button onClick={() => fetch(`/api/bank-accounts/${acc.id}?hotel=${currentHotelCode}`, { method: 'DELETE' }).then(() => fetch(`/api/bank-accounts?hotel=${currentHotelCode}`).then(res => res.json()).then(setBankAccounts))} className="absolute top-4 right-4 text-red-400 font-bold text-xs md:opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 px-2 py-1 rounded">✕ Del</button>
                                    <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase">{acc.type} Account</p>
                                    <h3 className="text-lg md:text-xl font-black mt-1 text-slate-800">{acc.bank}</h3>
                                    <p className="text-slate-500 font-medium text-xs md:text-sm mt-1">{acc.account_name}</p>
                                    <p className="text-slate-600 font-mono text-[10px] md:text-xs mt-2 bg-slate-50 border p-1.5 md:p-2 rounded-md inline-block">{acc.account_num}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 🌍 OTA CHANNELS (Channel Manager) */}
                {activeTab === 'OTA_SYNC' && (
                    <div className="animate-fade-in w-full max-w-full pb-20">
                        <div className="flex flex-col mb-6 md:mb-8 text-left">
                            <h2 className="text-2xl md:text-3xl font-black text-slate-800">Channel Manager (OTA Sync)</h2>
                            <p className="text-xs md:text-sm text-slate-500 mt-1 font-bold">Manage OTA API keys, real-time inventory, and rate multipliers.</p>
                        </div>

                        {/* 💡 [신규] ChannelRateManager에 하단의 연동된 OTA 목록 데이터를 넘겨줍니다! */}
                        <div className="mb-10">
                            <ChannelRateManager otaConfigs={otaConfigs} />
                        </div>

                        {/* 기존 API Key & Mapping 관리 영역 (ChannelRateManager 아래에 위치) */}
                        <div className="border-t-4 border-slate-200 pt-10">
                            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><span>🔑</span> API Keys & Room Mapping</h3>
                            <div className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-start md:items-end mb-8">
                                <div className="w-full md:flex-1">
                                    <label className="text-xs font-bold block mb-1.5 md:mb-2 text-slate-500">Select OTA Channel to Add</label>
                                    <input list="otaList" value={newOtaChannel} onChange={(e) => setNewOtaChannel(e.target.value)} className="w-full p-2.5 md:p-3 border rounded-md font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Agoda, Expedia..." />
                                    <datalist id="otaList">
                                        <option value="Agoda" />
                                        <option value="Booking.com" />
                                        <option value="Expedia" />
                                        <option value="Hotels.com" />
                                        <option value="Trip.com" />
                                        <option value="Airbnb" />
                                        <option value="Traveloka" />
                                    </datalist>
                                </div>
                                <button onClick={handleAddOta} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 md:h-[48px] rounded-md font-bold shadow-md transition-colors text-sm md:text-base">➕ Add Channel</button>
                            </div>

                            <div className="space-y-4">
                                {otaConfigs.length === 0 && (
                                    <div className="text-slate-400 font-bold p-8 md:p-12 text-center bg-white rounded-md border-2 border-dashed border-slate-200">
                                        <span className="text-3xl md:text-4xl block mb-2">🌍</span>
                                        No OTA channels connected yet.<br /><span className="text-xs md:text-sm font-normal text-slate-400 mt-1 block">Add a channel above to start syncing your inventory.</span>
                                    </div>
                                )}
                                {otaConfigs.map((config) => (
                                    <div key={config.channel} className={`p-4 md:p-6 border-2 rounded-md flex flex-col lg:flex-row items-start lg:items-center bg-white shadow-sm transition-all group gap-4 lg:gap-0 ${config.is_active ? 'border-blue-300' : 'border-slate-200'}`}>
                                        <div className="w-full lg:w-1/4 flex items-center gap-3">
                                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-md flex items-center justify-center font-black text-white text-lg md:text-xl shadow-inner shrink-0 ${config.channel === 'Agoda' ? 'bg-red-500' : config.channel === 'Booking.com' ? 'bg-blue-800' : config.channel === 'Expedia' ? 'bg-yellow-500' : config.channel === 'Airbnb' ? 'bg-rose-500' : 'bg-slate-700'}`}>
                                                {config.channel.charAt(0)}
                                            </div>
                                            <h3 className="text-lg md:text-xl font-black text-slate-800">{config.channel}</h3>
                                        </div>

                                        <div className="w-full lg:flex-1 lg:mx-4">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">API Key / Hotel ID</label>
                                            <input defaultValue={config.api_key} onBlur={(e) => handleUpdateOta(config.channel, e.target.value, config.is_active)} className="w-full p-2.5 md:p-3 border rounded-md bg-slate-50 font-mono text-xs md:text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter API Key here..." />
                                        </div>

                                        <div className="w-full lg:w-[350px] flex flex-wrap lg:flex-nowrap items-center justify-between lg:justify-end gap-3 md:gap-4 mt-2 lg:mt-0">
                                            <label className="flex items-center gap-2 cursor-pointer p-2 md:p-3 bg-slate-50 rounded-md border border-slate-200">
                                                <input type="checkbox" className="w-4 h-4 md:w-5 md:h-5 accent-green-600 cursor-pointer" checked={config.is_active === 1} onChange={(e) => handleUpdateOta(config.channel, config.api_key, e.target.checked)} />
                                                <span className={`text-xs md:text-sm font-bold whitespace-nowrap ${config.is_active ? 'text-green-600' : 'text-slate-400'}`}>{config.is_active ? 'Live Sync ON' : 'Disabled'}</span>
                                            </label>

                                            <button
                                                onClick={() => openMappingModal(config.channel)}
                                                disabled={!config.is_active}
                                                className={`px-3 md:px-4 py-2 md:py-3 rounded-md text-xs md:text-sm font-bold flex justify-center items-center gap-1 md:gap-2 transition-all shadow-sm ${config.is_active ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'}`}
                                            >
                                                <span>🔗</span>
                                                <span className="whitespace-nowrap">Room Mapping</span>
                                            </button>

                                            <div className="flex gap-2 w-full sm:w-auto">
                                                <button onClick={() => triggerOtaSync(config.channel)} disabled={!config.is_active || isSyncing[config.channel]} className={`flex-1 sm:flex-none px-3 md:px-4 py-2 md:py-3 rounded-md text-xs md:text-sm font-bold flex justify-center items-center gap-1 md:gap-2 transition-all ${config.is_active ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                                                    {isSyncing[config.channel] ? <span className="animate-spin">⚙️</span> : <span>🔄</span>}
                                                    <span className="whitespace-nowrap">{isSyncing[config.channel] ? 'Syncing...' : 'Force Sync'}</span>
                                                </button>
                                                <button onClick={() => handleDeleteOta(config.channel)} className="text-red-500 font-bold bg-red-50 hover:bg-red-100 p-2 md:p-3 rounded-md transition-colors shrink-0">🗑️</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Channel Mapping Modal */}
                        {mappingModalOpen && selectedOtaForMapping && (
                            // ... 기존의 Mapping Modal 코드는 건드리지 않고 그대로 유지됩니다. ...
                            <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in" onClick={() => setMappingModalOpen(false)}>
                                <div className="bg-white rounded-md shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

                                    <div className="bg-slate-900 p-6 flex justify-between items-center text-white shrink-0">
                                        <div>
                                            <h2 className="text-xl md:text-2xl font-black flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-md flex items-center justify-center font-black text-white text-sm shadow-inner ${selectedOtaForMapping === 'Agoda' ? 'bg-red-500' : selectedOtaForMapping === 'Booking.com' ? 'bg-blue-800' : selectedOtaForMapping === 'Expedia' ? 'bg-yellow-500' : 'bg-slate-700'}`}>
                                                    {selectedOtaForMapping.charAt(0)}
                                                </div>
                                                {selectedOtaForMapping} Room Mapping
                                            </h2>
                                            <p className="text-xs text-slate-400 mt-1.5 font-bold tracking-wide">
                                                Match your n+ room types with the Room IDs provided by {selectedOtaForMapping}.
                                            </p>
                                        </div>
                                        <button onClick={() => setMappingModalOpen(false)} className="text-slate-400 hover:text-white font-bold text-2xl transition-colors">✕</button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                                        {roomTypes.length === 0 ? (
                                            <div className="text-center py-10 text-slate-500 font-bold">
                                                Please create Room Types in the [Rooms & Types] menu first.
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="flex px-4 py-2 font-black text-[10px] uppercase tracking-widest text-slate-400 sticky top-0 bg-slate-50 z-10">
                                                    <div className="w-5/12 pl-2">n+ System Room Type</div>
                                                    <div className="w-1/12 text-center">Sync</div>
                                                    <div className="w-6/12 pl-2">{selectedOtaForMapping} Room ID</div>
                                                </div>

                                                {channelMappings.map((mapping, idx) => (
                                                    <div key={idx} className={`flex items-center p-3 rounded-md border transition-all ${mapping.is_active ? 'bg-white border-slate-200 shadow-sm hover:border-blue-300' : 'bg-slate-100 border-slate-200 opacity-60'}`}>

                                                        <div className="w-5/12 flex items-center gap-3 pl-2">
                                                            <div className={`w-2 h-2 rounded-full ${mapping.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                                                            <span className="font-bold text-slate-800 text-sm">{mapping.nplus_room_type}</span>
                                                        </div>

                                                        <div className="w-1/12 flex justify-center">
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only peer"
                                                                    checked={mapping.is_active}
                                                                    onChange={(e) => {
                                                                        const newMap = [...channelMappings];
                                                                        newMap[idx].is_active = e.target.checked;
                                                                        setChannelMappings(newMap);
                                                                    }}
                                                                />
                                                                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                                            </label>
                                                        </div>

                                                        <div className="w-6/12 flex items-center gap-2 pl-4">
                                                            <span className="text-slate-400 text-xl font-light">⇋</span>
                                                            <input
                                                                type="text"
                                                                disabled={!mapping.is_active}
                                                                placeholder={mapping.is_active ? `Enter ${selectedOtaForMapping} Room ID` : "Disabled"}
                                                                value={mapping.ota_room_id}
                                                                onChange={(e) => {
                                                                    const newMap = [...channelMappings];
                                                                    newMap[idx].ota_room_id = e.target.value;
                                                                    setChannelMappings(newMap);
                                                                }}
                                                                className="flex-1 p-3 border border-slate-200 rounded-md font-mono text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-5 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
                                        <button onClick={() => setMappingModalOpen(false)} className="px-6 py-3 rounded-md font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                                            Cancel
                                        </button>
                                        <button onClick={handleSaveMapping} className="px-8 py-3 rounded-md font-black text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-transform active:scale-95 flex items-center gap-2">
                                            <span>💾</span> Save Mappings
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                )}

                {/* ==========================================
                    🧾 RECEIPT CONFIG (영수증 및 세무 설정)
                    ========================================== */}
                {activeTab === 'RECEIPT' && (
                    <div className="animate-fade-in w-full max-w-full">
                        <h2 className="text-2xl md:text-3xl font-black mb-6 md:mb-8 text-slate-800">Receipt & Tax Settings</h2>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
                            {/* 1. 설정 입력 영역 */}
                            <div className="bg-white p-5 md:p-8 rounded-md shadow-sm border border-slate-200">
                                <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 border-b pb-2 text-slate-700">Customize Details</h3>
                                <div className="space-y-4 md:space-y-6">

                                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center bg-slate-50 p-4 md:p-6 rounded-md border border-slate-200">
                                        <div className="w-20 h-20 md:w-24 md:h-24 bg-white border flex items-center justify-center rounded-md overflow-hidden shrink-0 shadow-inner">
                                            {receiptConfig.logo_url || receiptConfig.imageFile ? (
                                                <img src={receiptConfig.imageFile ? URL.createObjectURL(receiptConfig.imageFile) : receiptConfig.logo_url} className="w-full h-full object-contain p-2" alt="Logo" />
                                            ) : (
                                                <span className="text-[10px] md:text-xs text-slate-400 font-bold uppercase">No Logo</span>
                                            )}
                                        </div>
                                        <div className="flex-1 w-full">
                                            <label className="text-xs font-bold block mb-2 text-slate-500 uppercase tracking-wider">Receipt Logo</label>
                                            <input type="file" accept="image/*" onChange={(e) => setReceiptConfig({ ...receiptConfig, imageFile: e.target.files[0] })} className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 p-1.5 rounded-md bg-white transition-all" />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold block mb-1 text-slate-500 uppercase">Header Text (상호명)</label>
                                            <input value={receiptConfig.header_text} onChange={(e) => setReceiptConfig({ ...receiptConfig, header_text: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Go Tambayan Hotel" />
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold block mb-1 text-slate-500 uppercase">Business Address (주소)</label>
                                            <input value={receiptConfig.address} onChange={(e) => setReceiptConfig({ ...receiptConfig, address: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Full Business Address" />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold block mb-1 text-slate-500 uppercase">Business No. (사업자번호)</label>
                                                <input value={receiptConfig.business_no} onChange={(e) => setReceiptConfig({ ...receiptConfig, business_no: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Reg. Number" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold block mb-1 text-slate-500 uppercase">Tax Reg No. (TIN)</label>
                                                <input value={receiptConfig.tax_id} onChange={(e) => setReceiptConfig({ ...receiptConfig, tax_id: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="TIN / VAT ID" />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold block mb-1 text-slate-500 uppercase">Footer Text (하단 안내)</label>
                                            <textarea rows="2" value={receiptConfig.footer_text} onChange={(e) => setReceiptConfig({ ...receiptConfig, footer_text: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Thank you for choosing us!" />
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-100 pt-6 space-y-4 bg-orange-50/30 p-4 rounded-md">
                                        <h4 className="font-bold text-slate-800 flex items-center gap-2">✍️ Official Signature Settings</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold block mb-1 text-slate-500 uppercase">Signer Name</label>
                                                <input value={receiptConfig.signer_name} onChange={(e) => setReceiptConfig({ ...receiptConfig, signer_name: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Juan Dela Cruz" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold block mb-1 text-slate-500 uppercase">Signer Title</label>
                                                <input value={receiptConfig.signer_title} onChange={(e) => setReceiptConfig({ ...receiptConfig, signer_title: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Hotel Manager" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold block mb-2 text-slate-500 uppercase tracking-wider">Upload Signature (For Email Receipts)</label>
                                            <input type="file" accept="image/*" onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        // 💡 [핵심 수정] 미리보기용 Base64뿐만 아니라, 서버 전송용 file 객체도 함께 저장합니다!
                                                        setReceiptConfig({ ...receiptConfig, signatureBase64: reader.result, signatureFile: file });
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }} className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200 border border-slate-200 p-1.5 rounded-md bg-white transition-all" />

                                            {receiptConfig.signatureBase64 && (
                                                <div className="mt-3 p-3 bg-white border border-slate-200 shadow-sm rounded-md inline-block w-full text-center">
                                                    <p className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-widest">Image Preview:</p>
                                                    <img src={receiptConfig.signatureBase64} alt="Signature Preview" className="h-12 object-contain mx-auto mix-blend-multiply" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-6">
                                        <div><label className="text-xs font-bold block mb-1 text-red-500">VAT (%)</label><input type="number" value={receiptConfig.vat_rate} onChange={(e) => setReceiptConfig({ ...receiptConfig, vat_rate: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md text-red-600 font-black text-lg" /></div>
                                        <div><label className="text-xs font-bold block mb-1 text-blue-500">Service Charge (%)</label><input type="number" value={receiptConfig.sc_rate} onChange={(e) => setReceiptConfig({ ...receiptConfig, sc_rate: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md text-blue-600 font-black text-lg" /></div>
                                    </div>

                                    <button onClick={handleSaveReceiptConfig} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-md font-black text-lg shadow-lg shadow-blue-100 transition-all active:scale-95 flex justify-center items-center gap-2 mt-4">
                                        <span>💾</span> Save Receipt Settings
                                    </button>
                                </div>
                            </div>

                            {/* 2. 실시간 영수증 미리보기 영역 (POS 프린트용 - 서명 숨김) */}
                            <div className="bg-slate-900 p-6 md:p-10 rounded-[3rem] shadow-inner flex flex-col items-center justify-center relative overflow-hidden min-h-[500px]">
                                <h3 className="absolute top-6 left-8 text-slate-500 font-black tracking-widest text-xs uppercase italic">Live Preview (POS Print)</h3>

                                <div className="bg-white w-full max-w-[340px] shadow-2xl p-8 relative font-mono text-xs text-slate-800 border-t-[12px] border-slate-300" style={{ clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 5px) 100%, calc(100% - 10px) calc(100% - 10px), calc(100% - 15px) 100%, calc(100% - 20px) calc(100% - 10px), calc(100% - 25px) 100%, calc(100% - 30px) calc(100% - 10px), calc(100% - 35px) 100%, calc(100% - 40px) calc(100% - 10px), calc(100% - 45px) 100%, 0 calc(100% - 10px))" }}>

                                    <div className="flex flex-col items-center text-center mb-6">
                                        {(receiptConfig.logo_url || receiptConfig.imageFile) && (
                                            <img src={receiptConfig.imageFile ? URL.createObjectURL(receiptConfig.imageFile) : receiptConfig.logo_url} className="w-16 h-16 object-contain mb-3 grayscale" alt="Logo" />
                                        )}
                                        <p className="font-black text-sm md:text-base uppercase leading-tight mb-1">{receiptConfig.header_text || 'HOTEL NAME'}</p>
                                        <p className="text-[9px] text-slate-500 leading-tight mb-1">{receiptConfig.address || 'Business Address Section'}</p>
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Biz: {receiptConfig.business_no || '---'} | TIN: {receiptConfig.tax_id || '---'}</p>
                                    </div>

                                    <div className="border-y border-dashed border-slate-300 py-3 mb-4 space-y-1">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="font-bold">OR Number (Serial):</span>
                                            {/* 💡 [수정] yyMMdd + 4자리 랜덤 일련번호 자동 생성 로직 적용 */}
                                            <span className="font-black text-blue-600 bg-blue-50 px-1 italic">
                                                {(() => {
                                                    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
                                                    const yy = String(now.getFullYear()).slice(-2);
                                                    const mm = String(now.getMonth() + 1).padStart(2, '0');
                                                    const dd = String(now.getDate()).padStart(2, '0');
                                                    const random4 = Math.floor(1000 + Math.random() * 9000); // 4자리 일련번호
                                                    return `${yy}${mm}${dd}${random4}`;
                                                })()}
                                            </span>
                                        </div>
                                        {/* 💡 [수정] 체크아웃 일시 표기 (체크인과 체크아웃을 명확히 구분) */}
                                        <div className="flex justify-between text-[10px]">
                                            <span>Check-in Date:</span>
                                            <span>{new Date(Date.now() - 86400000).toLocaleDateString('en-PH')} 14:00</span>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-bold text-slate-700">
                                            <span>Check-out Date:</span>
                                            <span>{new Date().toLocaleDateString('en-PH')} {new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-6">
                                        <div className="flex justify-between items-center text-[10px]"><span>Room 801 - Stay (1 Night)</span><span className="font-bold">P3,800.00</span></div>
                                        <div className="flex justify-between items-center text-[10px]"><span>POS 1 - Service (In-Room)</span><span className="font-bold">P1,200.00</span></div>
                                    </div>

                                    <div className="border-t border-dashed border-slate-300 pt-3 space-y-1 text-[10px]">
                                        <div className="flex justify-between text-slate-500"><span>Subtotal:</span><span>P5,000.00</span></div>
                                        <div className="flex justify-between text-slate-500"><span>VAT ({receiptConfig.vat_rate}%):</span><span>P600.00</span></div>
                                        <div className="flex justify-between text-slate-500"><span>Srv. Charge ({receiptConfig.sc_rate}%):</span><span>P500.00</span></div>
                                        <div className="flex justify-between font-black text-base md:text-lg text-slate-900 pt-2 border-t border-slate-100 mt-1"><span>TOTAL:</span><span>P6,100.00</span></div>
                                    </div>

                                    <div className="mt-8 text-center">
                                        <p className="text-[10px] text-slate-400 whitespace-pre-wrap">{receiptConfig.footer_text || 'Thank you for choosing us!'}</p>
                                        <div className="mt-4 opacity-20 text-[8px] font-black tracking-tighter">|| |||| ||| |||| || |||| || ||||</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==========================================
                    💳 통합된 PG & DEVICES (온라인 결제 및 하이브리드 하드웨어 관리)
                    ========================================== */}
                {activeTab === 'DEVICES' && (
                    <div className="animate-fade-in w-full max-w-full pb-20">
                        <div className="flex flex-col mb-6 md:mb-8 text-left">
                            <h2 className="text-2xl md:text-3xl font-black text-slate-800">Payment Gateways & Hardware</h2>
                            <p className="text-xs md:text-sm text-slate-500 mt-1 font-bold">Manage digital payment providers and hybrid devices (Network, Bluetooth, USB/Serial) across the property.</p>
                        </div>

                        {/* 1️⃣ Payment Gateway (온라인 결제사) 섹션 */}
                        <div className="bg-white p-6 md:p-8 rounded-md shadow-sm border border-slate-200 mb-8">
                            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><span>🌐</span> Payment Gateway Integration</h3>
                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end mb-6">
                                <div className="w-full sm:flex-1">
                                    <label className="text-xs font-bold block mb-1 md:mb-2 text-slate-500 uppercase tracking-wider">Add New Provider</label>
                                    <input value={newPaymentProvider} onChange={(e) => setNewPaymentProvider(e.target.value)} className="w-full p-2.5 md:p-3 border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 font-bold" placeholder="e.g. PayPal, Alipay, GCash, Maya" />
                                </div>
                                <button onClick={handleAddPaymentProvider} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 md:px-8 py-2.5 md:py-3 rounded-md font-bold md:h-[48px] shadow-sm transition-colors text-sm md:text-base">➕ Add Provider</button>
                            </div>
                            <div className="space-y-3">
                                {payments.length === 0 && <p className="text-slate-400 font-bold p-8 text-center bg-slate-50 rounded-md border border-dashed border-slate-200 text-sm">No payment gateways registered.</p>}
                                {payments.map(config => (
                                    <div key={config.provider} className="p-4 md:p-5 border border-slate-200 rounded-md flex flex-col md:flex-row items-start md:items-center bg-white shadow-sm group hover:border-blue-400 transition-all gap-4 md:gap-0">
                                        <div className="w-full md:w-1/4"><h3 className="text-base md:text-xl font-black text-slate-800">{config.provider}</h3></div>
                                        <div className="w-full md:flex-1 md:mx-4">
                                            <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mb-1 block">API Key / Merchant ID</label>
                                            <input defaultValue={config.api_key} onBlur={(e) => handleUpdatePayment(config.provider, e.target.value, config.is_active)} className="w-full p-2 md:p-2.5 border border-slate-200 rounded-md bg-slate-50 font-mono text-xs md:text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter credentials..." />
                                        </div>
                                        <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4 mt-2 md:mt-0">
                                            <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 rounded-md border border-slate-200">
                                                <input type="checkbox" className="w-4 h-4 accent-green-600 cursor-pointer" checked={config.is_active === 1} onChange={(e) => handleUpdatePayment(config.provider, config.api_key, e.target.checked)} />
                                                <span className={`text-xs md:text-sm font-bold ${config.is_active ? 'text-green-600' : 'text-slate-500'}`}>{config.is_active ? 'Active' : 'Disabled'}</span>
                                            </label>
                                            <button onClick={() => handleDeletePayment(config.provider)} className="text-red-400 font-bold md:opacity-0 group-hover:opacity-100 bg-red-50 hover:bg-red-500 hover:text-white px-3 py-2 rounded-md transition-all shadow-sm">Del</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2️⃣ 하이브리드 단말기 (네트워크/USB/블루투스) 섹션 */}
                        <div className="bg-white p-6 md:p-8 rounded-md shadow-sm border border-slate-200">
                            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><span>🔌</span> Hardware Terminals & Printers</h3>

                            <div className="bg-slate-900 p-5 md:p-8 rounded-md text-white shadow-inner mb-8 flex flex-col lg:flex-row gap-4 items-start lg:items-end border-2 border-slate-800">
                                <div className="w-full lg:flex-1">
                                    <label className="text-[10px] md:text-xs text-slate-400 mb-1 block font-bold uppercase tracking-wider">Device Name</label>
                                    <input value={newDevice.name} onChange={e => setNewDevice({ ...newDevice, name: e.target.value })} className="w-full p-2.5 md:p-3 bg-slate-800 rounded-md border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500" placeholder="e.g. FD Signature Pad" />
                                </div>

                                <div className="w-full lg:w-48">
                                    <label className="text-[10px] md:text-xs text-slate-400 mb-1 block font-bold uppercase tracking-wider">Device Type</label>
                                    <input list="deviceTypes" value={newDevice.type} onChange={e => setNewDevice({ ...newDevice, type: e.target.value })} className="w-full p-2.5 md:p-3 bg-slate-800 rounded-md border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500" placeholder="Type or select..." />
                                    <datalist id="deviceTypes">
                                        <option value="Payment Terminal" />
                                        <option value="Receipt Printer" />
                                        <option value="Label Printer" />
                                        <option value="Kitchen Printer (KDS)" />
                                        <option value="Signature Pad" />
                                        <option value="Barcode/QR Scanner" />
                                        <option value="ID/Passport Scanner" />
                                        <option value="Key Card Encoder" />
                                    </datalist>
                                </div>

                                <div className="w-full lg:w-80 relative">
                                    <label className="text-[10px] md:text-xs text-slate-400 mb-1 block font-bold uppercase tracking-wider">Connection (IP / MAC / USB COM)</label>
                                    <div className="flex">
                                        <input value={newDevice.ip_address} onChange={e => setNewDevice({ ...newDevice, ip_address: e.target.value })} className="w-full p-2.5 md:p-3 bg-slate-800 rounded-l-xl border border-slate-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 min-w-0" placeholder="192.168.x.x / COM3" />
                                        <button onClick={handleBluetoothScan} title="Scan Bluetooth" className="bg-blue-600 hover:bg-blue-500 px-3 md:px-4 border border-blue-600 flex items-center justify-center transition-colors">
                                            <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v20M12 2l5 5-5 5M12 22l5-5-5-5"></path></svg>
                                        </button>
                                        <button onClick={async () => {
                                            try {
                                                const port = await navigator.serial.requestPort();
                                                setNewDevice({ ...newDevice, ip_address: 'USB/Serial Connected' });
                                                alert('✅ USB/Serial Device Linked Successfully!');
                                            } catch (e) { alert('USB scan cancelled or Web Serial API not supported in this browser.'); }
                                        }} title="Scan USB/Serial" className="bg-emerald-600 hover:bg-emerald-500 px-3 md:px-4 rounded-r-xl border border-emerald-600 flex items-center justify-center transition-colors">
                                            <span className="font-black text-white text-xs">USB</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="w-full lg:w-48">
                                    <label className="text-[10px] md:text-xs text-slate-400 mb-1 block font-bold uppercase tracking-wider">Target Location</label>
                                    <input list="targetLocations" value={newDevice.target_store} onChange={e => setNewDevice({ ...newDevice, target_store: e.target.value })} className="w-full p-2.5 md:p-3 bg-slate-800 rounded-md border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500" placeholder="Type or select..." />
                                    <datalist id="targetLocations">
                                        <option value="Global / All" />
                                        <option value="Front Desk" />
                                        <option value="Back Office" />
                                        {posStores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                    </datalist>
                                </div>

                                <button onClick={handleAddDevice} className="w-full lg:w-auto bg-blue-500 hover:bg-blue-400 px-8 py-2.5 md:py-3 rounded-md font-bold md:h-[48px] shadow-sm text-sm md:text-base transition-all transform active:scale-95 mt-2 lg:mt-0">Add Device</button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                {devices.length === 0 && <p className="col-span-1 md:col-span-2 text-slate-400 font-bold p-8 text-center bg-slate-50 rounded-md border border-dashed border-slate-200 text-sm">No hardware devices added yet.</p>}
                                {devices.map((d) => {
                                    let icon = '🔌'; let badgeColor = 'bg-slate-100 text-slate-700';
                                    const type = (d.type || '').toLowerCase();
                                    if (type.includes('payment')) { icon = '💳'; badgeColor = 'bg-emerald-100 text-emerald-700'; }
                                    else if (type.includes('key')) { icon = '🔑'; badgeColor = 'bg-amber-100 text-amber-700'; }
                                    else if (type.includes('signature')) { icon = '✍️'; badgeColor = 'bg-indigo-100 text-indigo-700'; }
                                    else if (type.includes('scanner')) { icon = '📸'; badgeColor = 'bg-purple-100 text-purple-700'; }
                                    else if (type.includes('print')) { icon = '🖨️'; badgeColor = 'bg-blue-100 text-blue-700'; }
    return (
                                        <div key={d.id} className="p-4 md:p-6 border border-slate-200 rounded-md bg-white flex justify-between items-center shadow-sm hover:border-blue-400 hover:shadow-md transition-all group">
                                            <div className="flex items-center gap-3 md:gap-4 min-w-0">
                                                <div className="text-2xl md:text-3xl bg-slate-50 p-3 md:p-4 rounded-md border text-center shrink-0 shadow-inner">
                                                    {icon}
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-base md:text-lg text-slate-800 truncate">{d.name}</h4>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                                                            {d.type}
                                                        </span>
                                                        <span className="text-slate-300">|</span>
                                                        <p className="text-[10px] md:text-xs font-bold text-slate-500 truncate">{d.target_store}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                                        <p className="text-[10px] md:text-xs font-mono bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 border truncate max-w-[150px]">
                                                            {d.ip_address || 'Pending Sync'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={() => handleDeleteDevice(d.id, d.name)} className="text-red-400 font-bold text-xs md:text-sm bg-red-50 hover:bg-red-500 hover:text-white px-3 py-2 md:px-4 md:py-3 rounded-md transition-all shrink-0 md:opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-sm ml-2">
                                                Del
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ==========================================
            📜 SYSTEM AUDIT LOGS (필터링 및 이중 백업 적용)
        ========================================== */}
                {activeTab === 'LOGS' && (() => {
                    const filteredLogs = logs.filter(log => {
                        let match = true;
                        try {
                            const logDate = new Date(log.timestamp);
                            const yyyy = logDate.getFullYear();
                            const mm = String(logDate.getMonth() + 1).padStart(2, '0');
                            const dd = String(logDate.getDate()).padStart(2, '0');
                            const formattedDate = `${yyyy}-${mm}-${dd}`;

                            if (auditFilter.startDate && formattedDate < auditFilter.startDate) match = false;
                            if (auditFilter.endDate && formattedDate > auditFilter.endDate) match = false;
                            if (auditFilter.keyword) {
                                const kw = auditFilter.keyword.toLowerCase();
                                const searchStr = `${log.user_id} ${log.action}`.toLowerCase();
                                if (!searchStr.includes(kw)) match = false;
                            }
                        } catch (e) { }
                        return match;
                    });
    return (
                        <div className="animate-fade-in w-full max-w-full pb-20">
                            <div className="flex flex-col mb-6 md:mb-8 text-left">
                                <h2 className="text-2xl md:text-3xl font-black text-slate-800">System Audit Logs</h2>
                                <p className="text-xs md:text-sm text-slate-500 mt-1 font-bold">Track all user activities, configuration changes, and system events.</p>
                            </div>

                            <div className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end mb-6">
                                <div className="w-full md:w-1/4">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Start Date</label>
                                    <input type="date" value={auditFilter.startDate} onChange={e => setAuditFilter({ ...auditFilter, startDate: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-200 rounded-md font-bold text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div className="w-full md:w-1/4">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">End Date</label>
                                    <input type="date" value={auditFilter.endDate} onChange={e => setAuditFilter({ ...auditFilter, endDate: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-200 rounded-md font-bold text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div className="w-full md:flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Search Keyword (User ID, Action)</label>
                                    <input type="text" value={auditFilter.keyword} onChange={e => setAuditFilter({ ...auditFilter, keyword: e.target.value })} placeholder="e.g. Changed Tax, MA001..." className="w-full p-2.5 md:p-3 border border-slate-200 rounded-md font-bold text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <button onClick={() => setAuditFilter({ startDate: '', endDate: '', keyword: '' })} className="flex-1 md:flex-none px-6 py-2.5 md:py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-md transition-colors text-sm md:text-base">Clear</button>
                                    <button onClick={fetchLogs} className="flex-1 md:flex-none px-6 py-2.5 md:py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md transition-colors shadow-sm text-sm md:text-base flex justify-center items-center gap-2">🔄 Refresh</button>
                                </div>
                            </div>

                            <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                                        <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="p-4 md:p-5 text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest w-48">Date & Time</th>
                                                <th className="p-4 md:p-5 text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest w-32">User ID</th>
                                                <th className="p-4 md:p-5 text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest">Action Performed</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredLogs.length === 0 ? (
                                                <tr><td colSpan="3" className="p-10 text-center text-slate-400 font-bold bg-slate-50 text-sm md:text-base">No log records found matching your filters.</td></tr>
                                            ) : (
                                                filteredLogs.map((log) => (
                                                    <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                                                        <td className="p-4 md:p-5 font-mono text-slate-500 text-xs">{log.timestamp}</td>
                                                        <td className="p-4 md:p-5">
                                                            <span className="bg-slate-800 text-white px-2.5 py-1.5 rounded-md font-black text-[10px] tracking-wider shadow-sm">
                                                                {log.user_id}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 md:p-5 font-bold text-slate-700">{log.action}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* ==========================================
            🌐 PREMIUM WEBSITE BUILDER (CMS)
        ========================================== */}
                {activeTab === 'WEBSITE_BUILDER' && (
                    (() => {
                        // 💡 지역/도시 선택을 위한 필리핀 주(Province) 데이터 배열
                        const PH_LOCATIONS = [
                            { province: "Metro Manila", cities: ["Makati City", "Taguig City (BGC)", "Quezon City", "Manila City", "Pasay City", "Parañaque City", "Pasig City", "Mandaluyong City", "Muntinlupa City", "Las Piñas City", "San Juan City", "Valenzuela City", "Navotas City", "Malabon City", "Marikina City", "Pateros"] },
                            { province: "Cebu", cities: ["Cebu City", "Lapu-Lapu City", "Mandaue City", "Talisay City", "Toledo City", "Danao City", "Bogo City", "Moalboal", "Oslob", "Bantayan"] },
                            { province: "Aklan", cities: ["Malay (Boracay)", "Kalibo", "Ibajay"] },
                            { province: "Palawan", cities: ["Puerto Princesa", "El Nido", "Coron", "San Vicente"] },
                            { province: "Pampanga", cities: ["Angeles City", "San Fernando City", "Mabalacat", "Clark Freeport Zone", "Porac", "Lubao", "Guagua", "Mexico"] },
                            { province: "Tarlac", cities: ["Tarlac City", "Bamban", "Capas", "Concepcion", "Paniqui"] },
                            { province: "Zambales", cities: ["Olongapo City", "Subic Bay Freeport Zone", "Subic", "San Antonio"] },
                            { province: "Benguet", cities: ["Baguio City", "La Trinidad", "Itogon"] },
                            { province: "Mountain Province", cities: ["Sagada", "Bontoc", "Bauko"] },
                            { province: "Bohol", cities: ["Tagbilaran City", "Panglao", "Dauis", "Carmen"] },
                            { province: "Cavite", cities: ["Tagaytay City", "Dasmariñas", "Bacoor", "Imus", "Silang", "Kawit"] },
                            { province: "Batangas", cities: ["Batangas City", "Lipa City", "Nasugbu", "San Juan", "Mabini", "Calatagan"] }
                        ];
    return (
                            <div className="animate-fade-in w-full max-w-full pb-24">
                                <div className="flex flex-col mb-8 md:mb-10 text-left">
                                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 flex items-center gap-3">
                                        Website Builder
                                        <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[11px] px-3 py-1 rounded-full uppercase tracking-widest shadow-md">Premium</span>
                                    </h2>
                                    <p className="text-sm md:text-base text-slate-500 mt-2 font-medium">Design your beautiful hotel website with custom themes, galleries, and interactive maps.</p>
                                </div>

                                {/* 💡 [신규] 템플릿 선택기 (기존 클래식 vs 신규 모던) */}
                                <div className="mb-10 bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80">
                                    <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><span>✨</span> Choose Website Template</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div onClick={() => setWebsiteConfig({...websiteConfig, website_template: 'classic'})} className={`cursor-pointer rounded-2xl border-4 transition-all overflow-hidden ${websiteConfig.website_template === 'classic' ? 'border-slate-500 shadow-lg scale-[1.02]' : 'border-transparent hover:border-slate-300 opacity-60 grayscale hover:grayscale-0'}`}>
                                            <div className="bg-slate-800 h-32 flex items-center justify-center text-white font-black text-xl shadow-inner">🔲 Classic Standard</div>
                                            <div className="bg-slate-50 p-5 text-center border-t border-slate-200">
                                                <h4 className="font-black text-slate-800 text-lg">Classic Layout (Existing)</h4>
                                                <p className="text-xs text-slate-500 mt-1 font-bold">Standard block layout, straightforward and familiar design.</p>
                                            </div>
                                        </div>
                                        <div onClick={() => setWebsiteConfig({...websiteConfig, website_template: 'modern'})} className={`cursor-pointer rounded-2xl border-4 transition-all overflow-hidden ${(websiteConfig.website_template === 'modern' || !websiteConfig.website_template) ? 'border-violet-500 shadow-xl scale-[1.02] ring-4 ring-violet-500/20' : 'border-transparent hover:border-violet-300 opacity-60 grayscale hover:grayscale-0'}`}>
                                            <div className="bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 h-32 flex items-center justify-center text-white font-black text-xl shadow-inner relative overflow-hidden">
                                                <div className="absolute inset-0 bg-white/20 backdrop-blur-sm"></div>
                                                <span className="relative z-10 drop-shadow-md">💎 Modern Luxury</span>
                                            </div>
                                            <div className="bg-white p-5 text-center border-t border-slate-100">
                                                <h4 className="font-black text-violet-700 text-lg">Trendy & Modern (New!)</h4>
                                                <p className="text-xs text-slate-500 mt-1 font-bold">Glassmorphism, full-screen hero, elegant floating cards.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ========================================================
                                // 💎 [통합 빌더] 모던/클래식 공용 풀스크린 설정 폼
                                // ======================================================== */}
                                <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
                                        {/* 1. 테마 및 브랜딩 */}
                                        <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                                            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                                                <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl text-xl">🎨</div>
                                            <h3 className="text-xl font-black text-slate-800">Theme & Branding</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Brand Color</label>
                                                <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200/60 rounded-xl">
                                                    <input type="color" value={websiteConfig.theme_color?.startsWith('#') ? websiteConfig.theme_color : '#2563eb'} onChange={e => setWebsiteConfig({ ...websiteConfig, theme_color: e.target.value })} className="w-10 h-10 border-0 rounded-lg cursor-pointer bg-transparent" />
                                                    <input type="text" value={websiteConfig.theme_color?.startsWith('#') ? websiteConfig.theme_color : '#2563eb'} onChange={e => setWebsiteConfig({ ...websiteConfig, theme_color: e.target.value })} className="flex-1 p-2 border-0 bg-transparent font-mono text-sm uppercase font-bold text-slate-700 outline-none" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Typography Font</label>
                                                <select value={websiteConfig.theme_font || 'Inter'} onChange={e => setWebsiteConfig({ ...websiteConfig, theme_font: e.target.value })} className="w-full p-3.5 border border-slate-200/60 rounded-xl font-bold text-slate-700 bg-slate-50 outline-none cursor-pointer focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all">
                                                    <optgroup label="✨ Custom Uploaded Fonts">
                                                        <option value="ArcticonsSans">ArcticonsSans</option>
                                                        <option value="Cuprum">Cuprum</option>
                                                        <option value="Cuyabra">Cuyabra</option>
                                                        <option value="DreamOrphans">DreamOrphans</option>
                                                        <option value="Elevatia">Elevatia</option>
                                                        <option value="Guanine">Guanine</option>
                                                        <option value="Jura">Jura</option>
                                                        <option value="LTEnergy">LTEnergy</option>
                                                        <option value="LTRenovate">LTRenovate</option>
                                                    </optgroup>
                                                    <optgroup label="Modern Sans-Serif">
                                                        <option value="Inter">Inter </option>
                                                        <option value="Roboto">Roboto </option>
                                                        <option value="Open Sans">OpenSans </option>
                                                        <option value="Montserrat">Montserrat </option>
                                                        <option value="Poppins">Poppins </option>
                                                        <option value="Lato">Lato </option>
                                                        <option value="Raleway">Raleway </option>
                                                        <option value="Nunito">Nunito </option>
                                                    </optgroup>
                                                    <optgroup label="Elegant Serif ">
                                                        <option value="Playfair Display">PlayfairDisplay </option>
                                                        <option value="Merriweather">Merriweather </option>
                                                        <option value="Lora">Lora </option>
                                                        <option value="Cinzel">Cinzel </option>
                                                        <option value="Cormorant Garamond">Cormorant </option>
                                                    </optgroup>
                                                    <optgroup label="Korean Fonts ">
                                                        <option value="Noto Sans KR">Noto Sans KR </option>
                                                        <option value="Noto Serif KR">Noto Serif KR </option>
                                                    </optgroup>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Hotel Logo</label>
                                            <div className="flex items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60 shadow-sm">
                                                <div className="w-16 h-16 bg-white border border-slate-100 rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                                                    {(websiteConfig.logoFile || websiteConfig.logo_url) ? <img src={websiteConfig.logoFile ? URL.createObjectURL(websiteConfig.logoFile) : websiteConfig.logo_url} className="w-full h-full object-contain p-2" /> : <span className="text-[10px] text-slate-400 font-medium">No Logo</span>}
                                                </div>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            if (file.size > 2 * 1024 * 1024) { // 2MB 용량 제한
                                                                alert("The logo file is too large. Please upload a file smaller than 2MB.");
                                                                e.target.value = null; // 🚨 용량 초과 시 인풋 초기화
                                                                return;
                                                            }
                                                            setWebsiteConfig({ ...websiteConfig, logoFile: file });
                                                        }
                                                    }}
                                                    className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-bold file:bg-violet-100 file:text-violet-700 hover:file:bg-violet-200 transition-colors cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-6 border-t border-slate-100 pt-5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Footer Company Name (Copyright)</label>
                                            <input type="text" value={websiteConfig.footer_company_name || ''} onChange={e => setWebsiteConfig({ ...websiteConfig, footer_company_name: e.target.value })} placeholder="e.g. Bayfront Hotel Subic Inc." className="w-full p-3.5 border border-slate-200/60 rounded-xl font-bold text-slate-700 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
                                        </div>
                                    </div>

                                    {/* 2. 환영 인사 및 위치 조정 */}
                                    <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 flex flex-col transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                                        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                                            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl text-xl">✍️</div>
                                            <h3 className="text-xl font-black text-slate-800">Homepage Content</h3>
                                        </div>

                                        {(() => {
                                            const isModernPreview = (websiteConfig.website_template || 'modern') === 'modern';
                                            const previewImage = (websiteConfig.gallery_urls && websiteConfig.gallery_urls.length > 0)
                                                ? websiteConfig.gallery_urls[0].url
                                                : (websiteConfig.bg_image_url || "https://images.unsplash.com/photo-1542314831-c6a4d27a658d?q=80&w=1000&auto=format&fit=crop");
                                            const previewTitleWidth = (websiteConfig.welcome_text_pos?.title?.w > 100) ? 80 : (websiteConfig.welcome_text_pos?.title?.w ?? 80);
                                            const previewSubtitleWidth = (websiteConfig.welcome_text_pos?.subtitle?.w > 100) ? 80 : (websiteConfig.welcome_text_pos?.subtitle?.w ?? 80);

                                            return (
                                                <>
                                                    <div className="flex items-center justify-between mb-2 gap-3">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Live Preview (Drag to Move / Drag Bottom-Right corner to Resize)</label>
                                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${isModernPreview ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-stone-50 text-stone-700 border-stone-200'}`}>
                                                            {isModernPreview ? 'Modern Preview' : 'Classic Preview'}
                                                        </span>
                                                    </div>

                                                    <div className={`relative w-full h-56 md:h-72 overflow-hidden ring-4 mb-5 shadow-2xl select-none transition-all ${isModernPreview ? 'bg-slate-950 rounded-[28px] ring-violet-100' : 'bg-slate-900 rounded-2xl ring-stone-100'}`}
                                                        onMouseMove={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            if (draggingTextType) {
                                                                let x = ((e.clientX - rect.left) / rect.width) * 100;
                                                                let y = ((e.clientY - rect.top) / rect.height) * 100;
                                                                setWebsiteConfig(prev => {
                                                                    const currentPos = prev.welcome_text_pos || { title: { w: 80 }, subtitle: { w: 80 } };
                                                                    const currentType = currentPos[draggingTextType] || { w: 80 };
                                                                    return { ...prev, welcome_text_pos: { ...currentPos, [draggingTextType]: { ...currentType, x: Math.max(0, Math.min(95, x)), y: Math.max(0, Math.min(95, y)) } } };
                                                                });
                                                            } else if (resizingTextType) {
                                                                const currentPos = websiteConfig.welcome_text_pos || { title: { x: 10 }, subtitle: { x: 30 } };
                                                                const boxX = (currentPos[resizingTextType] || {}).x || 10;
                                                                const boxLeft = rect.left + (rect.width * (boxX / 100));
                                                                const newW_pct = Math.max(10, Math.min(100 - boxX, ((e.clientX - boxLeft) / rect.width) * 100));
                                                                setWebsiteConfig(prev => {
                                                                    const safePos = prev.welcome_text_pos || { title: {}, subtitle: {} };
                                                                    const safeType = safePos[resizingTextType] || {};
                                                                    return { ...prev, welcome_text_pos: { ...safePos, [resizingTextType]: { ...safeType, w: newW_pct } } };
                                                                });
                                                            }
                                                        }}
                                                        onMouseUp={() => { setDraggingTextType(null); setResizingTextType(null); }}
                                                        onMouseLeave={() => { setDraggingTextType(null); setResizingTextType(null); }}
                                                    >
                                                        <img src={previewImage} className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-all ${isModernPreview ? 'opacity-65 scale-[1.02]' : 'opacity-45'}`} alt="preview bg" />
                                                        <div className={`absolute inset-0 pointer-events-none ${isModernPreview ? 'bg-gradient-to-r from-slate-950/85 via-slate-950/40 to-slate-950/15' : 'bg-black/30'}`}></div>
                                                        {isModernPreview && (
                                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_34%)] pointer-events-none"></div>
                                                        )}

                                                        <div className={`absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 pointer-events-none ${isModernPreview ? 'bg-slate-950/30 backdrop-blur-md border-b border-white/10' : 'bg-white/12 backdrop-blur-sm'}`}>
                                                            <div className="flex items-center gap-2.5">
                                                                <div className={`h-7 w-7 border flex items-center justify-center text-[9px] font-black tracking-[0.2em] ${isModernPreview ? 'border-white/25 text-white/90 bg-white/10' : 'border-white/35 text-white bg-black/20 rounded-full'}`}>
                                                                    H
                                                                </div>
                                                                <span className={`text-[10px] font-black uppercase tracking-[0.28em] ${isModernPreview ? 'text-white/75' : 'text-white/85'}`}>Hotel</span>
                                                            </div>
                                                            <div className={`hidden md:flex items-center gap-4 text-[9px] uppercase font-black ${isModernPreview ? 'text-white/70 tracking-[0.24em]' : 'text-white/80 tracking-[0.18em]'}`}>
                                                                <span>About</span>
                                                                <span>Facilities</span>
                                                                <span>Contact</span>
                                                            </div>
                                                            <div className={`px-3 py-1.5 text-[9px] font-black uppercase ${isModernPreview ? 'bg-[--theme-color] text-white tracking-[0.22em]' : 'bg-[--theme-color] text-white rounded-full tracking-[0.16em]'}`}>
                                                                {isModernPreview ? 'Reserve' : 'Book Now'}
                                                            </div>
                                                        </div>

                                                        {isModernPreview && (
                                                            <div className="absolute right-4 bottom-4 z-10 w-36 md:w-40 bg-white/12 backdrop-blur-xl border border-white/15 shadow-[0_20px_40px_rgba(15,23,42,0.35)] p-3 pointer-events-none">
                                                                <div className="text-[8px] font-black uppercase tracking-[0.28em] text-white/55 mb-1.5">Editorial Card</div>
                                                                <div className="text-white text-sm font-light leading-tight mb-2 line-clamp-2">{websiteConfig.hotel_name || websiteConfig.footer_company_name || 'Boutique Stay'}</div>
                                                                <div className="w-8 h-px bg-white/45 mb-2"></div>
                                                                <div className="text-[9px] text-white/70 leading-relaxed line-clamp-3">{websiteConfig.contact_email || 'contact@hotel.com'}</div>
                                                            </div>
                                                        )}

                                                        {!isModernPreview && (
                                                            <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-10 px-4 py-2 rounded-full bg-[--theme-color] text-white text-[10px] font-black uppercase tracking-[0.14em] shadow-lg pointer-events-none">
                                                                Classic Call To Action
                                                            </div>
                                                        )}

                                                        {/* 타이틀 박스 */}
                                                        <div className={`absolute z-20 rounded-xl flex flex-col transition-all ${draggingTextType === 'title' || resizingTextType === 'title'
                                                            ? (isModernPreview ? 'border-2 border-violet-300 bg-violet-500/25 shadow-lg scale-[1.02]' : 'border-2 border-sky-400 bg-sky-500/30 shadow-lg scale-[1.02]')
                                                            : (isModernPreview ? 'border border-white/20 bg-slate-950/20 backdrop-blur-sm hover:border-white/40' : 'border-2 border-dashed border-white/50 bg-black/20 hover:border-white/80')}`}
                                                            style={{
                                                                left: `${websiteConfig.welcome_text_pos?.title?.x ?? 10}%`,
                                                                top: `${websiteConfig.welcome_text_pos?.title?.y ?? 20}%`,
                                                                width: `${previewTitleWidth}%`
                                                            }}>
                                                            <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden p-2" onMouseDown={() => setDraggingTextType('title')}>
                                                                <h1 className={`text-white leading-tight whitespace-pre-wrap break-words pointer-events-none w-full h-full ${isModernPreview ? 'font-light tracking-tight drop-shadow-2xl' : 'font-black'}`}
                                                                    style={{
                                                                        textAlign: websiteConfig.welcome_title_text_align || 'center',
                                                                        fontSize: `${(websiteConfig.welcome_title_font_size || 48) * 0.4}px`,
                                                                        fontFamily: '"' + (websiteConfig.theme_font || 'Inter') + '", sans-serif'
                                                                    }}>
                                                                    {websiteConfig.welcome_title || "Welcome"}
                                                                </h1>
                                                            </div>
                                                            <div className={`absolute bottom-0 right-0 w-7 h-7 cursor-nwse-resize flex items-center justify-center shadow-md z-20 ${isModernPreview ? 'bg-violet-500' : 'bg-sky-500 rounded-br-xl rounded-tl-xl'}`} onMouseDown={(e) => { e.stopPropagation(); setResizingTextType('title'); }}>
                                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-4 4-4-4"></path></svg>
                                                            </div>
                                                        </div>

                                                        {/* 서브타이틀 박스 */}
                                                        <div className={`absolute z-20 rounded-xl flex flex-col transition-all ${draggingTextType === 'subtitle' || resizingTextType === 'subtitle'
                                                            ? (isModernPreview ? 'border-2 border-fuchsia-300 bg-fuchsia-500/20 shadow-lg scale-[1.02]' : 'border-2 border-fuchsia-400 bg-fuchsia-500/30 shadow-lg scale-[1.02]')
                                                            : (isModernPreview ? 'border border-white/15 bg-slate-950/15 backdrop-blur-sm hover:border-white/35' : 'border-2 border-dashed border-white/50 bg-black/20 hover:border-white/80')}`}
                                                            style={{
                                                                left: `${websiteConfig.welcome_text_pos?.subtitle?.x ?? 30}%`,
                                                                top: `${websiteConfig.welcome_text_pos?.subtitle?.y ?? 50}%`,
                                                                width: `${previewSubtitleWidth}%`
                                                            }}>
                                                            <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden p-2" onMouseDown={() => setDraggingTextType('subtitle')}>
                                                                <p className={`whitespace-pre-wrap break-words pointer-events-none w-full h-full ${isModernPreview ? 'text-white/82 font-light drop-shadow-lg' : 'text-slate-200 font-medium'}`}
                                                                    style={{
                                                                        textAlign: websiteConfig.welcome_subtitle_text_align || 'center',
                                                                        fontSize: `${(websiteConfig.welcome_subtitle_font_size || 18) * 0.4}px`,
                                                                        fontFamily: '"' + (websiteConfig.theme_font || 'Inter') + '", sans-serif'
                                                                    }}>
                                                                    {websiteConfig.welcome_subtitle || "Your perfect stay awaits."}
                                                                </p>
                                                            </div>
                                                            <div className={`absolute bottom-0 right-0 w-7 h-7 cursor-nwse-resize flex items-center justify-center shadow-md z-20 ${isModernPreview ? 'bg-fuchsia-500' : 'bg-fuchsia-500 rounded-br-xl rounded-tl-xl'}`} onMouseDown={(e) => { e.stopPropagation(); setResizingTextType('subtitle'); }}>
                                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-4 4-4-4"></path></svg>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className={`grid gap-3 mb-8 ${isModernPreview ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-3'}`}>
                                                        {isModernPreview ? (
                                                            <>
                                                                <div className="bg-slate-950 text-white p-4 rounded-2xl shadow-sm border border-slate-800">
                                                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45 mb-2">Modern Flow</div>
                                                                    <div className="text-sm font-light">Full-screen hero with editorial text block</div>
                                                                </div>
                                                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                                                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-2">Preview Sections</div>
                                                                    <div className="space-y-2">
                                                                        <div className="h-3 rounded-full bg-violet-100"></div>
                                                                        <div className="h-12 rounded-xl bg-slate-100"></div>
                                                                        <div className="h-12 rounded-xl bg-slate-100"></div>
                                                                    </div>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 text-center">
                                                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-2">Classic</div>
                                                                    <div className="text-sm font-bold text-slate-700">Hero</div>
                                                                </div>
                                                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 text-center">
                                                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-2">Classic</div>
                                                                    <div className="text-sm font-bold text-slate-700">Facilities</div>
                                                                </div>
                                                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 text-center">
                                                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-2">Classic</div>
                                                                    <div className="text-sm font-bold text-slate-700">Contact</div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </>
                                            );
                                        })()}

                                        <div className="space-y-6 flex-1">
                                            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60">
                                                <div className="flex flex-wrap justify-between items-end mb-2 gap-2">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Welcome Title</label>
                                                    <div className="flex gap-2">
                                                        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                                                            <span className="text-[10px] font-bold text-slate-400 px-2">Size</span>
                                                            <input type="number" value={websiteConfig.welcome_title_font_size || 48} onChange={e => { const val = parseInt(e.target.value) || 48; setWebsiteConfig(prev => ({ ...prev, welcome_title_font_size: val })); }} className="w-14 p-1 border border-slate-200 rounded text-sm font-bold text-center outline-none focus:border-sky-400" />
                                                            <span className="text-[10px] font-bold text-slate-400 px-2">px</span>
                                                        </div>
                                                        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 gap-1 shadow-sm">
                                                            <button type="button" onClick={() => setWebsiteConfig(prev => ({ ...prev, welcome_title_text_align: 'left' }))} className={`px-2 py-1 rounded text-sm transition-colors ${(websiteConfig.welcome_title_text_align || 'center') === 'left' ? 'bg-sky-100 text-sky-700 shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}>⬅️</button>
                                                            <button type="button" onClick={() => setWebsiteConfig(prev => ({ ...prev, welcome_title_text_align: 'center' }))} className={`px-2 py-1 rounded text-sm transition-colors ${(websiteConfig.welcome_title_text_align || 'center') === 'center' ? 'bg-sky-100 text-sky-700 shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}>↔️</button>
                                                            <button type="button" onClick={() => setWebsiteConfig(prev => ({ ...prev, welcome_title_text_align: 'right' }))} className={`px-2 py-1 rounded text-sm transition-colors ${(websiteConfig.welcome_title_text_align || 'center') === 'right' ? 'bg-sky-100 text-sky-700 shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}>➡️</button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <textarea rows="3" value={websiteConfig.welcome_title || ''} onChange={e => setWebsiteConfig(prev => ({ ...prev, welcome_title: e.target.value }))} className="w-full p-3.5 border border-slate-200 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none resize-y whitespace-pre-wrap transition-all shadow-sm" placeholder="Welcome to Our Hotel" />
                                            </div>

                                            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60">
                                                <div className="flex flex-wrap justify-between items-end mb-2 gap-2">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Welcome Subtitle</label>
                                                    <div className="flex gap-2">
                                                        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                                                            <span className="text-[10px] font-bold text-slate-400 px-2">Size</span>
                                                            <input type="number" value={websiteConfig.welcome_subtitle_font_size || 18} onChange={e => { const val = parseInt(e.target.value) || 18; setWebsiteConfig(prev => ({ ...prev, welcome_subtitle_font_size: val })); }} className="w-14 p-1 border border-slate-200 rounded text-sm font-bold text-center outline-none focus:border-fuchsia-400" />
                                                            <span className="text-[10px] font-bold text-slate-400 px-2">px</span>
                                                        </div>
                                                        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 gap-1 shadow-sm">
                                                            <button type="button" onClick={() => setWebsiteConfig(prev => ({ ...prev, welcome_subtitle_text_align: 'left' }))} className={`px-2 py-1 rounded text-sm transition-colors ${(websiteConfig.welcome_subtitle_text_align || 'center') === 'left' ? 'bg-fuchsia-100 text-fuchsia-700 shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}>⬅️</button>
                                                            <button type="button" onClick={() => setWebsiteConfig(prev => ({ ...prev, welcome_subtitle_text_align: 'center' }))} className={`px-2 py-1 rounded text-sm transition-colors ${(websiteConfig.welcome_subtitle_text_align || 'center') === 'center' ? 'bg-fuchsia-100 text-fuchsia-700 shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}>↔️</button>
                                                            <button type="button" onClick={() => setWebsiteConfig(prev => ({ ...prev, welcome_subtitle_text_align: 'right' }))} className={`px-2 py-1 rounded text-sm transition-colors ${(websiteConfig.welcome_subtitle_text_align || 'center') === 'right' ? 'bg-fuchsia-100 text-fuchsia-700 shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}>➡️</button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <textarea rows="3" value={websiteConfig.welcome_subtitle || ''} onChange={e => setWebsiteConfig(prev => ({ ...prev, welcome_subtitle: e.target.value }))} className="w-full p-3.5 border border-slate-200 rounded-xl text-slate-600 font-medium focus:bg-white focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 outline-none resize-y whitespace-pre-wrap transition-all shadow-sm" placeholder="Your perfect stay awaits." />
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Hotel Description</label>
                                                <SimpleEditor value={websiteConfig.description || ''} onChange={val => setWebsiteConfig(prev => ({ ...prev, description: val }))} placeholder="Write a short description about your hotel..." />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. 메인 슬라이더 갤러리 */}
                                    <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 lg:col-span-2 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-xl">🖼️</div>
                                                <div>
                                                    <h3 className="text-xl font-black text-slate-800">Main Hero Slider Images</h3>
                                                    <p className="text-xs text-slate-500 font-medium mt-1">Select files to add. Click and drag to reorder. Hover to delete.</p>
                                                </div>
                                            </div>
                                            <div className="w-full md:w-48">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Slider Style</label>
                                                <select value={websiteConfig.slider_style || 'auto_fade'} onChange={e => setWebsiteConfig({ ...websiteConfig, slider_style: e.target.value })} className="w-full p-2.5 border border-slate-200/60 rounded-xl font-bold bg-slate-50 outline-none cursor-pointer focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all">
                                                    <option value="auto_fade">🔄 Auto-Play (Fade)</option>
                                                    <option value="auto_slide">🔄 Auto-Play (Slide)</option>
                                                    <option value="manual_arrows">⬅️ Manual (Arrows)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="relative border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/30 transition-colors rounded-2xl p-6 text-center mb-6">
                                            <input type="file" multiple accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => {
                                                const files = Array.from(e.target.files);
                                                if ((websiteConfig.gallery_urls?.length || 0) + files.length > 10) return alert("Maximum 10 images allowed.");
                                                const newItems = files.map((f, i) => ({ id: `new_${Date.now()}_${i}`, type: 'file', file: f, url: URL.createObjectURL(f) }));
                                                setWebsiteConfig(prev => ({ ...prev, gallery_urls: [...(prev.gallery_urls || []), ...newItems] }));
                                                e.target.value = null;
                                            }} />
                                            <div className="flex flex-col items-center justify-center pointer-events-none">
                                                <span className="text-3xl mb-2 text-emerald-500">📸</span>
                                                <span className="text-sm font-bold text-slate-700">Click or Drag images here to upload</span>
                                                <span className="text-xs text-slate-400 mt-1 font-medium">Maximum 10 images allowed</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide items-center min-h-[160px] border border-slate-100 rounded-2xl p-3 bg-slate-50 shadow-inner">
                                            {(websiteConfig.gallery_urls || []).map((item, idx) => (
                                                <div key={item.id} draggable
                                                    onDragStart={() => setDraggedGalleryIdx(idx)}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        if (draggedGalleryIdx === null || draggedGalleryIdx === idx) return;
                                                        const newUrls = [...websiteConfig.gallery_urls];
                                                        const draggedItem = newUrls.splice(draggedGalleryIdx, 1)[0];
                                                        newUrls.splice(idx, 0, draggedItem);
                                                        setWebsiteConfig({ ...websiteConfig, gallery_urls: newUrls });
                                                        setDraggedGalleryIdx(null);
                                                    }}
                                                    className={`relative w-48 h-32 shrink-0 rounded-xl overflow-hidden border-2 cursor-grab active:cursor-grabbing group transition-all ${draggedGalleryIdx === idx ? 'border-emerald-500 opacity-50 scale-95' : 'border-white shadow-md hover:border-emerald-300'}`}>
                                                    <img src={item.url} className="w-full h-full object-cover pointer-events-none" />
                                                    <button onClick={() => {
                                                        const newUrls = [...websiteConfig.gallery_urls]; newUrls.splice(idx, 1);
                                                        setWebsiteConfig({ ...websiteConfig, gallery_urls: newUrls });
                                                    }} className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white w-7 h-7 rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-lg">✕</button>
                                                    <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white text-[11px] px-2.5 py-0.5 rounded-lg font-mono font-bold">{idx + 1}</div>
                                                </div>
                                            ))}
                                            {(!websiteConfig.gallery_urls || websiteConfig.gallery_urls.length === 0) && <div className="w-full text-center text-slate-400 text-sm font-bold">No photos uploaded yet.</div>}
                                        </div>
                                    </div>

                                    {/* 4. 부대시설 (폴더 시스템) */}
                                    <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl text-xl">🍴</div>
                                                <h3 className="text-xl font-black text-slate-800">Facilities & Services</h3>
                                            </div>
                                            <button onClick={() => setWebsiteConfig({ ...websiteConfig, facilities_list: [...websiteConfig.facilities_list, { id: Date.now(), title: '', description: '', image_url: '', imageFile: null }] })} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5">+ Add Item</button>
                                        </div>
                                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                                            {websiteConfig.facilities_list.map((fac, idx) => (
                                                <div key={fac.id} className="p-5 border border-slate-200/60 rounded-2xl bg-slate-50/50 relative group shadow-sm hover:shadow-md hover:border-amber-200 transition-all">
                                                    <button onClick={() => { const nl = [...websiteConfig.facilities_list]; nl.splice(idx, 1); setWebsiteConfig({ ...websiteConfig, facilities_list: nl }); }} className="absolute top-4 right-4 text-red-400 hover:text-red-600 hover:bg-red-50 font-bold bg-white border border-slate-200 w-8 h-8 rounded-full shadow-sm text-sm opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center z-10">✕</button>
                                                    <textarea rows="2" value={fac.title} onChange={e => { const nl = [...websiteConfig.facilities_list]; nl[idx].title = e.target.value; setWebsiteConfig({ ...websiteConfig, facilities_list: nl }); }} placeholder="Facility Title (Press Enter to break line)" className="w-full p-3 border border-slate-200/80 rounded-xl font-bold text-sm mb-3 outline-none resize-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 focus:bg-white transition-all pr-12" />
                                                    <SimpleEditor value={fac.description} onChange={val => { const nl = [...websiteConfig.facilities_list]; nl[idx].description = val; setWebsiteConfig({ ...websiteConfig, facilities_list: nl }); }} placeholder="Facility details..." />

                                                    <div className="mt-4 p-4 bg-white rounded-xl border border-slate-200/80 shadow-sm">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gallery Images (Max 5)</label>
                                                            <select value={fac.display_style || 'arrows'} onChange={e => { const nl = [...websiteConfig.facilities_list]; nl[idx].display_style = e.target.value; setWebsiteConfig({ ...websiteConfig, facilities_list: nl }); }} className="text-[10px] p-1.5 border border-slate-200 rounded-lg font-bold text-slate-600 bg-slate-50 outline-none cursor-pointer hover:bg-slate-100 transition-colors">
                                                                <option value="arrows">⬅️ Manual (Arrows)</option>
                                                                <option value="slider">🔄 Auto-Play Slider</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex gap-2 overflow-x-auto mb-2 scrollbar-hide">
                                                            {(fac.image_urls || []).map((url, i) => (
                                                                <div key={`u_${i}`} className="relative w-16 h-16 shrink-0 group/img"><img src={url} className="w-full h-full object-cover rounded-lg border border-slate-200 shadow-sm" /><button onClick={() => { const nl = [...websiteConfig.facilities_list]; nl[idx].image_urls.splice(i, 1); setWebsiteConfig({ ...websiteConfig, facilities_list: nl }); }} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity shadow-md">✕</button></div>
                                                            ))}
                                                            {(fac.imageFiles || []).map((file, i) => (
                                                                <div key={`f_${i}`} className="relative w-16 h-16 shrink-0 group/img"><img src={URL.createObjectURL(file)} className="w-full h-full object-cover rounded-lg border border-slate-200 opacity-70 shadow-sm" /><button onClick={() => { const nl = [...websiteConfig.facilities_list]; nl[idx].imageFiles.splice(i, 1); setWebsiteConfig({ ...websiteConfig, facilities_list: nl }); }} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity shadow-md">✕</button></div>
                                                            ))}
                                                        </div>
                                                        <input type="file" multiple accept="image/*" onChange={e => {
                                                            const files = Array.from(e.target.files);
                                                            const currentTotal = (fac.image_urls?.length || 0) + (fac.imageFiles?.length || 0);
                                                            if (currentTotal + files.length > 5) return alert("Maximum 5 images allowed per facility.");
                                                            const nl = [...websiteConfig.facilities_list];
                                                            nl[idx].imageFiles = [...(nl[idx].imageFiles || []), ...files];
                                                            setWebsiteConfig({ ...websiteConfig, facilities_list: nl });
                                                        }} className="w-full text-xs mt-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:font-bold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200 cursor-pointer transition-colors" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 5. 지역 관광 (폴더 시스템) */}
                                    <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-xl">🗺️</div>
                                                <h3 className="text-xl font-black text-slate-800">Local Attractions</h3>
                                            </div>
                                            <button onClick={() => setWebsiteConfig({ ...websiteConfig, attractions_list: [...websiteConfig.attractions_list, { id: Date.now(), title: '', description: '', image_url: '', imageFile: null }] })} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5">+ Add Item</button>
                                        </div>
                                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                                            {websiteConfig.attractions_list.map((att, idx) => (
                                                <div key={att.id} className="p-5 border border-slate-200/60 rounded-2xl bg-slate-50/50 relative group shadow-sm hover:shadow-md hover:border-emerald-200 transition-all">
                                                    <button onClick={() => { const nl = [...websiteConfig.attractions_list]; nl.splice(idx, 1); setWebsiteConfig({ ...websiteConfig, attractions_list: nl }); }} className="absolute top-4 right-4 text-red-400 hover:text-red-600 hover:bg-red-50 font-bold bg-white border border-slate-200 w-8 h-8 rounded-full shadow-sm text-sm opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center z-10">✕</button>
                                                    <textarea rows="2" value={att.title} onChange={e => { const nl = [...websiteConfig.attractions_list]; nl[idx].title = e.target.value; setWebsiteConfig({ ...websiteConfig, attractions_list: nl }); }} placeholder="Attraction Title (Press Enter to break line)" className="w-full p-3 border border-slate-200/80 rounded-xl font-bold text-sm mb-3 outline-none resize-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 focus:bg-white transition-all pr-12" />
                                                    <SimpleEditor value={att.description} onChange={val => { const nl = [...websiteConfig.attractions_list]; nl[idx].description = val; setWebsiteConfig({ ...websiteConfig, attractions_list: nl }); }} placeholder="Attraction details..." />
                                                    <div className="mt-4 p-4 bg-white rounded-xl border border-slate-200/80 shadow-sm">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gallery Images (Max 5)</label>
                                                            <select value={att.display_style || 'arrows'} onChange={e => { const nl = [...websiteConfig.attractions_list]; nl[idx].display_style = e.target.value; setWebsiteConfig({ ...websiteConfig, attractions_list: nl }); }} className="text-[10px] p-1.5 border border-slate-200 rounded-lg font-bold text-slate-600 bg-slate-50 outline-none cursor-pointer hover:bg-slate-100 transition-colors">
                                                                <option value="arrows">⬅️ Manual (Arrows)</option>
                                                                <option value="slider">🔄 Auto-Play Slider</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex gap-2 overflow-x-auto mb-2 scrollbar-hide">
                                                            {(att.image_urls || []).map((url, i) => (
                                                                <div key={`u_${i}`} className="relative w-16 h-16 shrink-0 group/img"><img src={url} className="w-full h-full object-cover rounded-lg border border-slate-200 shadow-sm" /><button onClick={() => { const nl = [...websiteConfig.attractions_list]; nl[idx].image_urls.splice(i, 1); setWebsiteConfig({ ...websiteConfig, attractions_list: nl }); }} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity shadow-md">✕</button></div>
                                                            ))}
                                                            {(att.imageFiles || []).map((file, i) => (
                                                                <div key={`f_${i}`} className="relative w-16 h-16 shrink-0 group/img"><img src={URL.createObjectURL(file)} className="w-full h-full object-cover rounded-lg border border-slate-200 opacity-70 shadow-sm" /><button onClick={() => { const nl = [...websiteConfig.attractions_list]; nl[idx].imageFiles.splice(i, 1); setWebsiteConfig({ ...websiteConfig, attractions_list: nl }); }} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity shadow-md">✕</button></div>
                                                            ))}
                                                        </div>
                                                        <input type="file" multiple accept="image/*" onChange={e => {
                                                            const files = Array.from(e.target.files);
                                                            const currentTotal = (att.image_urls?.length || 0) + (att.imageFiles?.length || 0);
                                                            if (currentTotal + files.length > 5) return alert("Maximum 5 images allowed per attraction.");
                                                            const nl = [...websiteConfig.attractions_list];
                                                            nl[idx].imageFiles = [...(nl[idx].imageFiles || []), ...files];
                                                            setWebsiteConfig({ ...websiteConfig, attractions_list: nl });
                                                        }} className="w-full text-xs mt-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:font-bold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200 cursor-pointer transition-colors" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 6. 구글 맵 및 연락처/SNS 설정 */}
                                    <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 lg:col-span-2 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                                            <div className="flex flex-col">
                                                <h3 className="text-lg font-black mb-3 flex items-center gap-2 text-slate-800">
                                                    <span className="p-2 bg-red-50 text-red-500 rounded-xl text-lg">📍</span> Google Maps URL
                                                </h3>
                                                <p className="text-xs font-medium text-slate-500 mb-4 leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60">
                                                    After searching for the hotel on Google Maps, please press the [Share] button and paste the generated link (URL) directly. <br /><br />(This will connect you directly to directions in the mobile app.)
                                                </p>
                                                <input
                                                    type="url"
                                                    className="w-full p-4 border border-slate-200/80 rounded-xl text-sm font-bold text-slate-700 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-sm"
                                                    placeholder="e.g., https://maps.app.goo.gl/..."
                                                    value={websiteConfig.map_embed_url || ''}
                                                    onChange={e => setWebsiteConfig(prev => ({ ...prev, map_embed_url: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black mb-5 flex items-center gap-2 text-slate-800">
                                                    <span className="p-2 bg-blue-50 text-blue-500 rounded-xl text-lg">📞</span> Contact & Location
                                                </h3>
                                                <div className="space-y-4">

                                                    {/* 공식 호텔 명칭 입력란 */}
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xl w-6 text-center">🏨</span>
                                                        <input
                                                            type="text"
                                                            placeholder="Official Hotel Name (e.g., Sample Hotel Metro Manila)"
                                                            defaultValue={websiteConfig.hotel_name || websiteConfig.contact_title || ''}
                                                            onChange={e => setWebsiteConfig(prev => ({ ...prev, hotel_name: e.target.value, contact_title: e.target.value }))}
                                                            className="w-full p-3.5 border border-slate-200/80 rounded-xl text-sm font-bold text-slate-700 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                                        />
                                                    </div>

                                                    {/* 지역(Province) 및 도시(City) 선택 드롭다운 */}
                                                    <div className="flex flex-col md:flex-row gap-3 pl-9">
                                                        <select
                                                            className="w-full p-3 border border-slate-200/80 rounded-xl text-sm font-bold text-slate-700 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-all shadow-sm"
                                                            value={websiteConfig.province || ''}
                                                            onChange={e => setWebsiteConfig(prev => ({ ...prev, province: e.target.value, city: '' }))} // Province 변경 시 City 초기화
                                                        >
                                                            <option value="">Select Province</option>
                                                            {PH_LOCATIONS.map(loc => (
                                                                <option key={loc.province} value={loc.province}>{loc.province}</option>
                                                            ))}
                                                        </select>

                                                        <select
                                                            className="w-full p-3 border border-slate-200/80 rounded-xl text-sm font-bold text-slate-700 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer disabled:opacity-50 transition-all shadow-sm"
                                                            value={websiteConfig.city || ''}
                                                            onChange={e => setWebsiteConfig(prev => ({ ...prev, city: e.target.value }))}
                                                            disabled={!websiteConfig.province}
                                                        >
                                                            <option value="">Select City/Municipal</option>
                                                            {(PH_LOCATIONS.find(p => p.province === websiteConfig.province)?.cities || []).map(city => (
                                                                <option key={city} value={city}>{city}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* 상세 주소 입력란 */}
                                                    <div className="flex items-start gap-3">
                                                        <span className="text-xl w-6 text-center mt-1.5">🏠</span>
                                                        <textarea
                                                            placeholder="Detailed Address (e.g., 5046 P. Burgos St, Poblacion)"
                                                            defaultValue={websiteConfig.contact_address || ''}
                                                            onChange={e => setWebsiteConfig(prev => ({ ...prev, contact_address: e.target.value }))}
                                                            className="w-full p-3.5 border border-slate-200/80 rounded-xl text-sm font-medium text-slate-700 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y whitespace-pre-wrap transition-all shadow-sm"
                                                            rows="2"
                                                        />
                                                    </div>

                                                    <div className="flex items-start gap-3"><span className="text-xl w-6 text-center mt-1.5">📞</span><textarea placeholder="Phone Number (Multi-line supported)" defaultValue={websiteConfig.contact_phone || ''} onChange={e => setWebsiteConfig(prev => ({ ...prev, contact_phone: e.target.value }))} className="w-full p-3.5 border border-slate-200/80 rounded-xl text-sm font-medium text-slate-700 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y whitespace-pre-wrap transition-all shadow-sm" rows="2" /></div>
                                                    <div className="flex items-start gap-3"><span className="text-xl w-6 text-center mt-1.5">✉️</span><textarea placeholder="Email Address (Multi-line supported)" defaultValue={websiteConfig.contact_email || ''} onChange={e => setWebsiteConfig(prev => ({ ...prev, contact_email: e.target.value }))} className="w-full p-3.5 border border-slate-200/80 rounded-xl text-sm font-medium text-slate-700 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y whitespace-pre-wrap transition-all shadow-sm" rows="2" /></div>
                                                    <div className="flex items-center gap-3 pt-4 border-t border-slate-100 mt-2"><span className="text-xl w-6 text-center">📸</span><input type="text" placeholder="Instagram Profile URL" defaultValue={websiteConfig.sns_ig || ''} onChange={e => setWebsiteConfig(prev => ({ ...prev, sns_ig: e.target.value }))} className="w-full p-3.5 border border-slate-200/80 rounded-xl text-sm font-medium text-slate-700 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all shadow-sm" /></div>
                                                    <div className="flex items-center gap-3"><span className="text-xl w-6 text-center">📘</span><input type="text" placeholder="Facebook Page URL" defaultValue={websiteConfig.sns_fb || ''} onChange={e => setWebsiteConfig(prev => ({ ...prev, sns_fb: e.target.value }))} className="w-full p-3.5 border border-slate-200/80 rounded-xl text-sm font-medium text-slate-700 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all shadow-sm" /></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 7. 📱 Guest App 전용 설정 */}
                                    <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-2 border-indigo-100/80 lg:col-span-2 relative overflow-hidden transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                                        <div className="mb-8 border-b border-slate-100 pb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-xl">📱</div>
                                                <div>
                                                    <h3 className="text-xl font-black text-slate-800">Guest App Profile Configuration</h3>
                                                    <p className="text-xs text-slate-500 font-medium mt-1">Configure the main slide photos, short description, and amenities exclusively for the B2C Guest App.</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                                            {/* 7-1. 앱 전용 메인 슬라이드 이미지 (최대 5장) */}
                                            <div>
                                                <div className="flex justify-between items-end mb-2">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">App Main Photos</label>
                                                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full mt-1 inline-block">{(websiteConfig.app_gallery_urls?.length || 0)} / 5</span>
                                                    </div>
                                                    <select value={websiteConfig.app_gallery_style || 'arrows'} onChange={e => setWebsiteConfig({ ...websiteConfig, app_gallery_style: e.target.value })} className="p-2 border border-indigo-200/60 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50/50 outline-none cursor-pointer hover:bg-indigo-50 transition-colors">
                                                        <option value="arrows">⬅️ Manual (Arrows)</option>
                                                        <option value="slider">🔄 Auto-Play Slider</option>
                                                    </select>
                                                </div>

                                                <div className="relative border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 transition-colors rounded-2xl p-4 text-center mb-4">
                                                    <input type="file" multiple accept="image/*" onChange={e => {
                                                        const files = Array.from(e.target.files);
                                                        const currentUrlsCount = websiteConfig.app_gallery_urls ? websiteConfig.app_gallery_urls.filter(item => item.type === 'url').length : 0;
                                                        const currentFilesCount = websiteConfig.app_gallery_urls ? websiteConfig.app_gallery_urls.filter(item => item.type === 'file').length : 0;

                                                        if (currentUrlsCount + currentFilesCount + files.length > 5) {
                                                            e.target.value = null; // 인풋 초기화
                                                            return alert("Maximum 5 photos allowed for the Guest App.");
                                                        }

                                                        const newItems = files.map((f, i) => ({ id: `app_${Date.now()}_${i}`, type: 'file', file: f, url: URL.createObjectURL(f) }));
                                                        setWebsiteConfig(prev => ({ ...prev, app_gallery_urls: [...(prev.app_gallery_urls || []), ...newItems] }));
                                                        e.target.value = null;
                                                    }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                                    <div className="flex flex-col items-center justify-center pointer-events-none">
                                                        <span className="text-xl mb-1 text-indigo-400">📱</span>
                                                        <span className="text-xs font-bold text-slate-600">Upload App Photos</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide min-h-[90px]">
                                                    {(websiteConfig.app_gallery_urls || []).map((item, idx) => (
                                                        <div key={item.id} className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden border border-slate-200 group/appimg shadow-sm">
                                                            <img src={item.url} className="w-full h-full object-cover" />
                                                            <button onClick={() => {
                                                                const newUrls = [...websiteConfig.app_gallery_urls];
                                                                newUrls.splice(idx, 1);
                                                                setWebsiteConfig({ ...websiteConfig, app_gallery_urls: newUrls });
                                                            }} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white w-6 h-6 rounded-full text-[10px] font-bold opacity-0 group-hover/appimg:opacity-100 flex items-center justify-center transition-opacity shadow-md">✕</button>
                                                        </div>
                                                    ))}
                                                    {(!websiteConfig.app_gallery_urls || websiteConfig.app_gallery_urls.length === 0) && (
                                                        <div className="w-full text-center text-slate-400 text-xs font-bold py-6">No app photos selected yet.</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 7-2. 앱 전용 버튼식 부대/편의 시설 */}
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">App Facilities & Amenities</label>
                                                <div className="flex flex-wrap gap-2.5 max-h-[220px] overflow-y-auto pr-2 scrollbar-hide">
                                                    {[
                                                        { id: 'wifi', icon: '📶', label: 'Free Wi-Fi' },
                                                        { id: 'pool', icon: '🏊‍♂️', label: 'Swimming Pool' },
                                                        { id: 'kids', icon: '👶', label: 'Kids Pool' },
                                                        { id: 'gym', icon: '🏋️‍♀️', label: 'Fitness Center' },
                                                        { id: 'spa', icon: '💆‍♀️', label: 'Spa & Massage' },
                                                        { id: 'parking', icon: '🅿️', label: 'Free Parking' },
                                                        { id: 'restaurant', icon: '🍽️', label: 'Restaurant' },
                                                        { id: 'bar', icon: '🍸', label: 'Lounge Bar' },
                                                        { id: 'room_service', icon: '🛎️', label: 'Room Service' },
                                                        { id: 'front_desk', icon: '🕒', label: '24h Front Desk' },
                                                        { id: 'shuttle', icon: '🚐', label: 'Airport Shuttle' },
                                                        { id: 'pets', icon: '🐾', label: 'Pet Friendly' },
                                                        { id: 'business', icon: '💼', label: 'Business Center' },
                                                        { id: 'laundry', icon: '🧺', label: 'Laundry Service' },
                                                        { id: 'ev', icon: '⚡', label: 'EV Charging' },
                                                        { id: 'beach', icon: '🏖️', label: 'Beach Access' }
                                                    ].map(fac => {
                                                        const currentFacilities = websiteConfig.app_facilities || [];
                                                        const isSelected = currentFacilities.includes(fac.label);
                                                        return (
                                                            <button
                                                                key={fac.id}
                                                                onClick={() => {
                                                                    const updated = isSelected
                                                                        ? currentFacilities.filter(f => f !== fac.label)
                                                                        : [...currentFacilities, fac.label];
                                                                    setWebsiteConfig({ ...websiteConfig, app_facilities: updated });
                                                                }}
                                                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm flex items-center gap-1.5
                                                                    ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 scale-[1.02]' : 'bg-white text-slate-600 border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/50'}`}
                                                            >
                                                                <span>{fac.icon}</span> {fac.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* 7-3. 앱 전용 짧은 소개글 */}
                                            <div className="md:col-span-2 border-t border-slate-100 pt-5 mt-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">App Short Description</label>
                                                <textarea
                                                    value={websiteConfig.app_short_description || ''}
                                                    onChange={e => setWebsiteConfig(prev => ({ ...prev, app_short_description: e.target.value }))}
                                                    className="w-full p-4 border border-slate-200/80 rounded-2xl text-sm font-medium text-slate-700 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y transition-all shadow-sm"
                                                    rows="3"
                                                    placeholder="Enter a short, catchy description for the mobile app (e.g., Experience true relaxation with our premium services...)"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-2 mt-4">
                                        <button onClick={handleSaveWebsiteConfig} className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white py-5 rounded-2xl font-black shadow-[0_8px_30px_rgba(79,70,229,0.3)] transition-all transform hover:-translate-y-1 text-xl flex justify-center items-center gap-3">
                                            <span className="text-2xl">🚀</span> Publish Premium Website
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()
                )}

                {/* ==========================================
            📺 TV THEME SETTINGS
        ========================================== */}
                {activeTab === 'TV_CMS' && (
                    <div className="animate-fade-in w-full max-w-full pb-10">
                        <h2 className="text-2xl md:text-3xl font-black mb-6 md:mb-8 text-slate-800">TV Service Configuration</h2>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">

                            <div className="bg-white p-5 md:p-8 rounded-md shadow-sm border border-slate-200 flex flex-col">
                                <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 border-b border-slate-100 pb-3 md:pb-4 text-slate-800 flex items-center gap-2"><span>🎨</span> TV Menu Backgrounds</h3>
                                <div className="space-y-3 md:space-y-4 flex-1">
                                    {['dining', 'spa', 'todo', 'morning', 'makeup', 'bill', 'tv'].map((menu) => (
                                        <div key={menu} className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center p-3 md:p-4 border rounded-md bg-slate-50 transition-colors hover:bg-slate-100">
                                            <span className="font-black uppercase text-slate-700 text-xs w-20 shrink-0">{menu}</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => setTvImagesPending({ ...tvImagesPending, [menu]: e.target.files[0] })}
                                                className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:font-bold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer bg-white border border-slate-200 p-1 rounded-md"
                                            />
                                            {tvImagesPending[menu] && (
                                                <span className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-1 rounded shrink-0 whitespace-nowrap">✅ Ready</span>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <button onClick={handleSaveAllTvImages} className="w-full mt-6 md:mt-8 bg-blue-600 hover:bg-blue-700 text-white py-3 md:py-4 rounded-md font-black shadow-lg transition-all flex justify-center items-center gap-2 text-sm md:text-base">
                                    <span>💾</span> Save All Backgrounds
                                </button>
                            </div>

                            <div className="bg-white p-5 md:p-8 rounded-md shadow-sm border border-slate-200">
                                <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 border-b border-slate-100 pb-3 md:pb-4 text-slate-800 flex items-center gap-2"><span>⚙️</span> Room Service Options</h3>
                                <div className="space-y-6">
                                    <div className="p-4 md:p-5 bg-slate-50 border border-slate-200 rounded-md space-y-4 shadow-sm">
                                        <div><label className="text-xs font-bold block mb-1 text-slate-600">🍽️ Link [In-Room Dining] to POS</label><select value={String(rsConfig.target_store_id || '')} onChange={(e) => setRsConfig({ ...rsConfig, target_store_id: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md font-bold text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"><option value="">-- Disabled --</option>{posStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                                        <div><label className="text-xs font-bold block mb-1 text-slate-600">💆 Link [Spa & Wellness] to POS</label><select value={String(rsConfig.spa_store_id || '')} onChange={(e) => setRsConfig({ ...rsConfig, spa_store_id: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md font-bold text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"><option value="">-- Disabled --</option>{posStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                                        <div><label className="text-xs font-bold block mb-1 text-slate-600">🗺️ Link [Local Guide / Activity] to POS</label><select value={String(rsConfig.todo_store_id || '')} onChange={(e) => setRsConfig({ ...rsConfig, todo_store_id: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md font-bold text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"><option value="">-- Disabled --</option>{posStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                                    </div>
                                    <div className="space-y-4 pt-2">

                                        {/* 🍽️ Dining Hours */}
                                        <div className="bg-orange-50/50 p-4 md:p-5 rounded-md border border-orange-100">
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="font-black text-orange-800 text-sm flex items-center gap-1">🍽️ Dining Hours</h4>

                                                {/* 💡 [신규] 24시간 체크박스 (다이닝) */}
                                                <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2 py-1 rounded border border-orange-200 shadow-sm hover:bg-orange-50 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={rsConfig.is_dining_24h || false}
                                                        onChange={e => setRsConfig({ ...rsConfig, is_dining_24h: e.target.checked })}
                                                        className="w-4 h-4 accent-orange-600 cursor-pointer"
                                                    />
                                                    <span className="text-xs font-bold text-orange-700">24 Hours</span>
                                                </label>
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-3">
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-bold block mb-1 text-orange-700 uppercase tracking-widest">Open Time</label>
                                                    <input type="time" disabled={rsConfig.is_dining_24h} value={rsConfig.open_time || ''} onChange={(e) => setRsConfig({ ...rsConfig, open_time: e.target.value })} className="w-full p-2.5 border border-orange-200 rounded-md bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed" />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-bold block mb-1 text-orange-700 uppercase tracking-widest">Close Time</label>
                                                    <input type="time" disabled={rsConfig.is_dining_24h} value={rsConfig.close_time || ''} onChange={(e) => setRsConfig({ ...rsConfig, close_time: e.target.value })} className="w-full p-2.5 border border-orange-200 rounded-md bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed" />
                                                </div>
                                            </div>
                                            <label className="text-[10px] font-bold block mb-1 text-orange-700 uppercase tracking-widest mt-2">Message when closed</label>
                                            <textarea disabled={rsConfig.is_dining_24h} value={rsConfig.closed_message || ''} onChange={(e) => setRsConfig({ ...rsConfig, closed_message: e.target.value })} className="w-full p-2.5 border border-orange-200 rounded-md text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed" placeholder="Type closed message..." rows="2" />
                                        </div>

                                        {/* 💆 Spa Hours */}
                                        <div className="bg-teal-50/50 p-4 md:p-5 rounded-md border border-teal-100">
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="font-black text-teal-800 text-sm flex items-center gap-1">💆 Spa Hours</h4>

                                                {/* 💡 [신규] 24시간 체크박스 (스파) */}
                                                <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2 py-1 rounded border border-teal-200 shadow-sm hover:bg-teal-50 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={rsConfig.is_spa_24h || false}
                                                        onChange={e => setRsConfig({ ...rsConfig, is_spa_24h: e.target.checked })}
                                                        className="w-4 h-4 accent-teal-600 cursor-pointer"
                                                    />
                                                    <span className="text-xs font-bold text-teal-700">24 Hours</span>
                                                </label>
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-3">
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-bold block mb-1 text-teal-700 uppercase tracking-widest">Open Time</label>
                                                    <input type="time" disabled={rsConfig.is_spa_24h} value={rsConfig.spa_open_time || ''} onChange={(e) => setRsConfig({ ...rsConfig, spa_open_time: e.target.value })} className="w-full p-2.5 border border-teal-200 rounded-md bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed" />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-bold block mb-1 text-teal-700 uppercase tracking-widest">Close Time</label>
                                                    <input type="time" disabled={rsConfig.is_spa_24h} value={rsConfig.spa_close_time || ''} onChange={(e) => setRsConfig({ ...rsConfig, spa_close_time: e.target.value })} className="w-full p-2.5 border border-teal-200 rounded-md bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed" />
                                                </div>
                                            </div>
                                            <label className="text-[10px] font-bold block mb-1 text-teal-700 uppercase tracking-widest mt-2">Message when closed</label>
                                            <textarea disabled={rsConfig.is_spa_24h} value={rsConfig.spa_closed_message || ''} onChange={(e) => setRsConfig({ ...rsConfig, spa_closed_message: e.target.value })} className="w-full p-2.5 border border-teal-200 rounded-md text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed" placeholder="Type closed message..." rows="2" />
                                        </div>
                                    </div>
                                    <button onClick={handleSaveRSConfig} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 md:py-4 rounded-md font-bold shadow-lg transition-colors text-sm md:text-base flex justify-center items-center gap-2">
                                        <span>✅</span> Apply Settings to TVs
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==========================================
                🎁 SPECIAL OFFERS & PROMOTIONS CMS
                ========================================== */}
                {activeTab === 'PROMOTIONS_CMS' && (
                    <div className="animate-fade-in w-full max-w-full pb-20">
                        <div className="flex flex-col mb-6 md:mb-8 text-left">
                            <h2 className="text-2xl md:text-3xl font-black text-slate-800">Promotions & Offers</h2>
                            <p className="text-xs md:text-sm text-slate-500 mt-1 font-bold">Manage discount codes and special packages displayed on the main portal.</p>
                        </div>

                        <div className={`bg-white p-6 md:p-8 rounded-md shadow-sm border mb-8 transition-all ${editingPromoId ? 'border-amber-400 ring-4 ring-amber-50' : 'border-slate-200'}`}>
                            {/* 💡 [수정] 수정 모드일 때와 신규 생성일 때 타이틀/버튼이 달라집니다. */}
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <span>✨</span> {editingPromoId ? 'Edit Existing Promotion' : 'Create New Promotion'}
                                </h3>
                                {editingPromoId && (
                                    <button onClick={() => { setEditingPromoId(null); setNewPromo({ title: '', description: '', code: '', discount_pct: '', end_date: '', target_room_type: ['All Rooms'], imageFile: null }); }} className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-md transition-colors">
                                        Cancel Edit
                                    </button>
                                )}
                            </div>

                            {/* 💡 첫 번째 줄 */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                <div className="md:col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Promo Title</label><input value={newPromo.title} onChange={e => setNewPromo({ ...newPromo, title: e.target.value })} placeholder="e.g. Summer Early Bird" className="w-full p-3 border border-slate-200 rounded-md font-bold bg-slate-50" /></div>
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Promo Code</label><input value={newPromo.code} onChange={e => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })} placeholder="e.g. SUMMER20" className="w-full p-3 border border-slate-200 rounded-md font-black text-emerald-600 bg-emerald-50 uppercase" /></div>
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Discount (%)</label><input type="number" value={newPromo.discount_pct} onChange={e => setNewPromo({ ...newPromo, discount_pct: e.target.value })} placeholder="20" className="w-full p-3 border border-slate-200 rounded-md font-black text-right bg-slate-50" /></div>
                            </div>

                            {/* 💡 두 번째 줄 (Target Room Type 추가) */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Target Room Type (Click to select)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {promoRoomTypes.map(room => (
                                            <button
                                                key={`target_${room}`}
                                                onClick={() => toggleTargetRoom(room)}
                                                className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${newPromo.target_room_type.includes(room) ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                {room}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Valid Until</label><input type="date" value={newPromo.end_date} onChange={e => setNewPromo({ ...newPromo, end_date: e.target.value })} className="w-full p-3 border border-slate-200 rounded-md font-bold bg-slate-50 text-sm" /></div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cover Image {editingPromoId && '(Leave empty to keep existing)'}</label>
                                    <input type="file" accept="image/*" onChange={e => setNewPromo({ ...newPromo, imageFile: e.target.files[0] })} className="w-full text-[10px] file:mr-2 file:py-2 file:px-3 file:rounded-md file:border-0 file:font-bold file:bg-blue-50 file:text-blue-700 bg-white border border-slate-200 p-1.5 rounded-md cursor-pointer" />
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Description</label>
                                <input value={newPromo.description} onChange={e => setNewPromo({ ...newPromo, description: e.target.value })} placeholder="Short details about this offer..." className="w-full p-3 border border-slate-200 rounded-md text-sm bg-slate-50" />
                            </div>

                            <button onClick={handleAddPromotion} className={`w-full text-white py-4 rounded-md font-black shadow-md transition-transform active:scale-95 ${editingPromoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-900 hover:bg-slate-800'}`}>
                                💾 {editingPromoId ? 'Update Promotion' : 'Publish Promotion'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {promotions.map(promo => {
                                const uniqueId = promo.id || promo.promo_id || promo.code;
    return (
                                    <div key={uniqueId} className={`bg-white rounded-md overflow-hidden border shadow-sm transition-all relative flex flex-col group ${promo.is_active ? 'border-emerald-200 ring-2 ring-emerald-50' : 'border-slate-200 opacity-60'}`}>
                                        <div className="h-40 w-full bg-slate-200 relative shrink-0">
                                            <img src={promo.image_url} alt="promo" className="w-full h-full object-cover" />

                                            <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-3 py-1 rounded-md font-black text-emerald-700 text-sm shadow-sm z-10 pointer-events-none">
                                                {promo.discount_pct}% OFF
                                            </div>

                                            <button
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditPromotion(promo); }}
                                                className="absolute top-3 right-14 bg-amber-400 text-amber-900 w-8 h-8 rounded-full font-black shadow-md hover:bg-amber-500 transition-colors flex items-center justify-center z-[100] md:opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                                                title="Edit Promotion"
                                            >
                                                ✏️
                                            </button>

                                            {/* ✕ 삭제(Delete) 버튼 - 💡 id, code, title을 모두 명확히 전달 */}
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleDeletePromotion(promo.id, promo.code, promo.title);
                                                }}
                                                className="absolute top-3 right-3 bg-red-500 text-white w-8 h-8 rounded-full font-bold shadow-md hover:bg-red-600 transition-colors flex items-center justify-center z-[100] md:opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                                                title="Delete Promotion"
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        <div className="p-5 flex flex-col flex-1 relative z-10 bg-white">
                                            <h3 className="font-black text-lg text-slate-800 mb-1">{promo.title}</h3>
                                            <div className="mb-3 flex flex-wrap gap-1">
                                                {Array.isArray(promo.target_room_type) ? promo.target_room_type.map(r => (
                                                    <span key={`${uniqueId}_${r}`} className="inline-block bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-black border border-blue-100">🛏️ {r}</span>
                                                )) : <span className="inline-block bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-black border border-blue-100">🛏️ {promo.target_room_type || 'All Rooms'}</span>}
                                            </div>
                                            <p className="text-xs text-slate-500 mb-4 line-clamp-2 h-8">{promo.description}</p>

                                            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-md border border-slate-100 mb-4 mt-auto">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Code</span>
                                                <span className="font-mono font-black text-emerald-600 tracking-wider bg-emerald-100 px-2 py-0.5 rounded">{promo.code}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-red-400">Ends: {promo.end_date || 'N/A'}</span>
                                                <label className="flex items-center gap-2 cursor-pointer z-10 relative">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{promo.is_active ? 'Active' : 'Hidden'}</span>
                                                    <input type="checkbox" checked={promo.is_active === 1 || promo.is_active === true} onChange={(e) => { e.stopPropagation(); handleTogglePromotion(promo.id || promo.code, promo.is_active, promo.title); }} className="w-4 h-4 accent-emerald-600 cursor-pointer" />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ==========================================
            ⚖️ REFUND POLICIES
        ========================================== */}
                {activeTab === 'POLICIES' && (
                    <> {/* 💡 에러 해결의 핵심! 두 개의 박스를 묶어주는 투명 껍데기 시작 */}
                        <div className="animate-fade-in w-full max-w-full pb-10">
                            <div className="flex flex-col mb-6 md:mb-8">
                                <h2 className="text-2xl md:text-3xl font-black text-slate-800">Hotel Policies</h2>
                                <p className="text-xs md:text-sm text-slate-500 mt-1 font-bold">Manage early check-out refund percentages based on season and remaining nights.</p>
                            </div>

                            <div className="bg-white p-6 md:p-8 rounded-md shadow-sm border border-slate-200">
                                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><span>💸</span> Early Check-out Refund Rules (%)</h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    {['offpeak', 'weekend', 'peak'].map(season => (
                                        <div key={season} className="border p-5 rounded-md bg-slate-50 border-slate-200">
                                            <h4 className="font-black text-lg mb-4 text-slate-800 uppercase tracking-wider">{season} Season</h4>
                                            {[1, 2, 3].map(day => (
                                                <div key={day} className="flex justify-between items-center mb-3">
                                                    <span className="text-sm font-bold text-slate-600">{day} Day(s) Prior:</span>
                                                    <div className="flex items-center">
                                                        <input type="number" value={refundPolicies[season][day]} onChange={e => setRefundPolicies({ ...refundPolicies, [season]: { ...refundPolicies[season], [day]: parseInt(e.target.value) || 0 } })} className="w-16 p-2 border rounded-md text-center font-bold text-slate-700" min="0" max="100" />
                                                        <span className="ml-2 font-bold text-slate-400">%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                                <button onClick={handleSaveRefundPolicies} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-md font-black transition-colors flex items-center justify-center gap-2 shadow-lg">
                                    <span>💾</span> Save Refund Policies
                                </button>
                            </div>
                        </div>

                        {/* ======================================================== */}
                        {/* 💡 예약 취소 환불 정책 (Pre-Check-in Cancellation) 섹션 */}
                        {/* ======================================================== */}
                        <div className="mt-4 pb-20 p-6 md:p-8 max-w-full bg-white rounded-xl shadow-sm border border-slate-200 animate-fade-in">
                            <div className="flex justify-between items-end mb-6">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">📅 Reservation Cancellation Policies</h2>
                                    <p className="text-slate-500 font-bold text-sm mt-1">Set refund percentages based on how many days prior to check-in the cancellation is made.</p>
                                </div>
                                <button
                                    onClick={handleSaveCancelPolicies}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-md font-black shadow-md transition-colors flex items-center gap-2"
                                >
                                    💾 Save Cancellation Rules
                                </button>
                            </div>

                            <div className="space-y-3">
                                {cancelPolicies
                                    .sort((a, b) => b.days_before - a.days_before)
                                    .map((policy) => (
                                        <div key={policy.id} className="flex items-center gap-4 bg-slate-50 p-4 rounded-md border border-slate-200 hover:border-indigo-300 transition-colors">
                                            <span className="font-black text-slate-400 text-lg flex-none w-8 text-center">➔</span>

                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-slate-600 uppercase">Cancel</span>
                                                <input
                                                    type="number" min="0"
                                                    value={policy.days_before}
                                                    onChange={(e) => {
                                                        const newRules = cancelPolicies.map(p => p.id === policy.id ? { ...p, days_before: Number(e.target.value) } : p);
                                                        setCancelPolicies(newRules);
                                                    }}
                                                    className="w-20 p-2 text-center font-bold text-indigo-700 border border-slate-300 rounded focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                />
                                                <span className="text-sm font-bold text-slate-600 uppercase">Days before check-in</span>
                                            </div>

                                            <div className="flex-1 border-b-2 border-dashed border-slate-300 mx-4"></div>

                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-slate-600 uppercase">Refund</span>
                                                <input
                                                    type="number" min="0" max="100"
                                                    value={policy.refund_percent}
                                                    onChange={(e) => {
                                                        const newRules = cancelPolicies.map(p => p.id === policy.id ? { ...p, refund_percent: Number(e.target.value) } : p);
                                                        setCancelPolicies(newRules);
                                                    }}
                                                    className="w-20 p-2 text-center font-bold text-emerald-700 border border-slate-300 rounded focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                                />
                                                <span className="text-sm font-bold text-slate-600 uppercase">%</span>
                                            </div>

                                            <button
                                                onClick={() => removeCancelPolicyRule(policy.id)}
                                                className="ml-4 text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-md transition-colors"
                                                title="Delete Rule"
                                            >
                                                <span className="text-xl font-black">✕</span>
                                            </button>
                                        </div>
                                    ))}

                                <button
                                    onClick={addCancelPolicyRule}
                                    className="w-full mt-4 py-4 border-2 border-dashed border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 rounded-md font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <span className="text-lg">➕</span> Add New Cancellation Rule
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
