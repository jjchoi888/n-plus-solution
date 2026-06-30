const DEFAULT_FOOTER_TEXT = 'Thank you for choosing us!';
const DEFAULT_RECEIPT_CONFIG = {
    header_text: 'Sample Hotel Inc.',
    footer_text: DEFAULT_FOOTER_TEXT,
    vat_rate: 12,
    sc_rate: 10,
    logo_url: '',
    address: '558 Gen. Malvar St. Manila City, Metro Manila',
    business_no: 'SC 25469985221',
    tax_id: '369852147',
    signer_name: '',
    signer_title: '',
    signatureBase64: ''
};
const THERMAL_RECEIPT_WIDTH_MM = 80;
const THERMAL_RECEIPT_MARGIN_MM = 2;

let exportToolsPromise = null;
const loadExportTools = async () => {
    if (!exportToolsPromise) {
        exportToolsPromise = Promise.all([
            import('jspdf'),
            import('html2canvas')
        ]).then(([jspdfModule, html2canvasModule]) => ({
            jsPDF: jspdfModule.jsPDF,
            html2canvas: html2canvasModule.default
        }));
    }

    return exportToolsPromise;
};

export const parseReceiptItems = (receipt) => {
    try {
        const items = typeof receipt?.cart_data === 'string'
            ? JSON.parse(receipt.cart_data)
            : (receipt?.cart_data || []);
        return Array.isArray(items) ? items : [];
    } catch {
        return [];
    }
};

export const createDefaultReceiptConfig = () => ({ ...DEFAULT_RECEIPT_CONFIG });

const readReceiptConfigExtra = (hotelCode = '') => {
    if (typeof window === 'undefined' || !hotelCode) return {};

    try {
        const raw = window.localStorage.getItem(`receipt_extra_${hotelCode}`);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

export const mergeReceiptConfig = (serverData = {}, hotelCode = '', baseConfig = createDefaultReceiptConfig()) => {
    const extra = readReceiptConfigExtra(hotelCode);
    const merged = {
        ...baseConfig,
        ...extra,
        ...serverData
    };

    return {
        ...merged,
        header_text: String(serverData.header_text || extra.header_text || baseConfig.header_text || '').trim(),
        footer_text: String(serverData.footer_text || extra.footer_text || baseConfig.footer_text || '').trim(),
        logo_url: String(serverData.logo_url || extra.logo_url || baseConfig.logo_url || '').trim(),
        address: String(serverData.address || extra.address || baseConfig.address || '').trim(),
        business_no: String(serverData.business_no || extra.business_no || baseConfig.business_no || '').trim(),
        tax_id: String(serverData.tax_id || extra.tax_id || baseConfig.tax_id || '').trim(),
        signer_name: String(serverData.signer_name || extra.signer_name || baseConfig.signer_name || '').trim(),
        signer_title: String(serverData.signer_title || extra.signer_title || baseConfig.signer_title || '').trim(),
        signatureBase64: String(serverData.signature_url || serverData.signatureBase64 || extra.signatureBase64 || baseConfig.signatureBase64 || '').trim(),
        vat_rate: Number(serverData.vat_rate ?? extra.vat_rate ?? baseConfig.vat_rate) || baseConfig.vat_rate,
        sc_rate: Number(serverData.sc_rate ?? extra.sc_rate ?? baseConfig.sc_rate) || baseConfig.sc_rate
    };
};

export const getReceiptBreakdown = (receipt, receiptConfig = {}) => {
    const items = parseReceiptItems(receipt);
    const vatRate = Number(receiptConfig?.vat_rate || 12);
    const scRate = Number(receiptConfig?.sc_rate || 10);
    const rawSubtotal = items.length > 0
        ? items.reduce((sum, item) => sum + (Number(item?.price || 0) * Number(item?.quantity || 1)), 0)
        : (Number(receipt?.amount || 0) / (1 + (scRate / 100)));
    const vatableSales = rawSubtotal / (1 + (vatRate / 100));
    const vatValue = rawSubtotal - vatableSales;
    const serviceChargeValue = rawSubtotal * (scRate / 100);
    const finalAmount = Number(receipt?.amount || 0);

    return {
        items,
        rawSubtotal,
        vatRate,
        scRate,
        vatableSales,
        vatValue,
        serviceChargeValue,
        finalAmount
    };
};

export const getReceiptViewModel = ({
    receipt,
    receiptConfig,
    hotelLabel,
    fallbackHeaderText,
    fallbackFooterText,
    fallbackDepartment
}) => {
    const normalizedConfig = {
        ...createDefaultReceiptConfig(),
        ...(receiptConfig || {})
    };
    const breakdown = getReceiptBreakdown(receipt, normalizedConfig);
    const brandName = String(normalizedConfig?.header_text || hotelLabel || fallbackHeaderText || DEFAULT_RECEIPT_CONFIG.header_text).trim() || DEFAULT_RECEIPT_CONFIG.header_text;
    const addressLine = String(normalizedConfig?.address || '').trim();
    const businessNo = String(normalizedConfig?.business_no || '').trim();
    const taxId = String(normalizedConfig?.tax_id || '').trim();
    const businessInfoLine = [businessNo ? `BIZ: ${businessNo}` : '', taxId ? `TIN: ${taxId}` : '']
        .filter(Boolean)
        .join(' | ');

    return {
        ...breakdown,
        logoUrl: String(normalizedConfig?.logo_url || '').trim(),
        brandName,
        hotelLabel: String(hotelLabel || brandName).trim() || brandName,
        addressLine,
        businessInfoLine,
        headerText: brandName,
        footerText: String(normalizedConfig?.footer_text || fallbackFooterText || DEFAULT_FOOTER_TEXT).trim() || DEFAULT_FOOTER_TEXT,
        receiptNo: String(receipt?.receipt_no || '-').trim() || '-',
        dateLabel: String(receipt?.date || receipt?.created_at || '-').trim() || '-',
        departmentLabel: String(receipt?.department || fallbackDepartment || '-').trim() || '-',
        guestReference: String(receipt?.guest_name || receipt?.description || '-').trim() || '-'
    };
};

export const exportReceiptPdf = async ({
    element,
    receipt,
    fileNamePrefix = 'receipt'
}) => {
    if (!element) {
        throw new Error('Receipt preview element is not available.');
    }

    if (document?.fonts?.ready) {
        await document.fonts.ready.catch(() => undefined);
    }

    const images = Array.from(element.querySelectorAll('img'));
    await Promise.all(images.map((image) => (
        image.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
            })
    )));

    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

    const { jsPDF, html2canvas } = await loadExportTools();
    const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        imageTimeout: 0,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
    });
    const imageData = canvas.toDataURL('image/png');
    const printableWidth = THERMAL_RECEIPT_WIDTH_MM - (THERMAL_RECEIPT_MARGIN_MM * 2);
    const imageHeight = (canvas.height * printableWidth) / canvas.width;
    const pageHeight = imageHeight + (THERMAL_RECEIPT_MARGIN_MM * 2);
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [THERMAL_RECEIPT_WIDTH_MM, pageHeight],
        compress: true
    });

    doc.addImage(
        imageData,
        'PNG',
        THERMAL_RECEIPT_MARGIN_MM,
        THERMAL_RECEIPT_MARGIN_MM,
        printableWidth,
        imageHeight,
        undefined,
        'FAST'
    );

    const receiptSuffix = String(receipt?.receipt_no || receipt?.date || 'receipt')
        .replace(/[^a-z0-9_-]/gi, '_')
        .replace(/_+/g, '_');
    doc.save(`${fileNamePrefix}_${receiptSuffix}.pdf`);
};
