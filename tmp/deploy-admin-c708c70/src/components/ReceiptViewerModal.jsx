import React, { useRef, useState } from 'react';
import { exportReceiptPdf, getReceiptViewModel } from '../utils/receiptView';

export default function ReceiptViewerModal({
    receipt,
    receiptConfig,
    hotelLabel,
    fallbackHeaderText,
    fallbackFooterText,
    fallbackDepartment,
    fileNamePrefix = 'receipt',
    onClose
}) {
    const [isExporting, setIsExporting] = useState(false);
    const receiptSurfaceRef = useRef(null);
    const thermalPaperClipPath = "polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 5px) 100%, calc(100% - 10px) calc(100% - 10px), calc(100% - 15px) 100%, calc(100% - 20px) calc(100% - 10px), calc(100% - 25px) 100%, calc(100% - 30px) calc(100% - 10px), calc(100% - 35px) 100%, calc(100% - 40px) calc(100% - 10px), calc(100% - 45px) 100%, 0 calc(100% - 10px))";

    if (!receipt) return null;

    const viewModel = getReceiptViewModel({
        receipt,
        receiptConfig,
        hotelLabel,
        fallbackHeaderText,
        fallbackFooterText,
        fallbackDepartment
    });

    const handleExport = async () => {
        try {
            setIsExporting(true);
            await exportReceiptPdf({
                element: receiptSurfaceRef.current,
                receipt,
                fileNamePrefix
            });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-[440px]">
                <div className="mb-3 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleExport}
                        disabled={isExporting}
                        className="rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-black text-sky-700 transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isExporting ? 'Exporting...' : 'Export PDF'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-2xl font-black text-white transition-colors hover:bg-white/20 hover:text-rose-300"
                    >
                        ×
                    </button>
                </div>

                <div className="max-h-[92vh] overflow-y-auto rounded-2xl bg-transparent px-2 py-2">
                    <div className="mx-auto w-fit rounded-md shadow-2xl">
                        <div
                            ref={receiptSurfaceRef}
                            className="mx-auto w-[320px] border-t-[10px] border-slate-300 bg-white px-7 py-7 font-mono text-[10px] text-slate-800 sm:w-[340px]"
                            style={{ clipPath: thermalPaperClipPath }}
                        >
                            <div className="mb-6 flex flex-col items-center text-center">
                                {viewModel.logoUrl ? (
                                    <img src={viewModel.logoUrl} alt="Logo" className="mb-3 h-16 w-16 object-contain grayscale" />
                                ) : (
                                    <div className="mb-3 text-5xl font-black tracking-tighter text-slate-500">n<span className="text-3xl">+</span></div>
                                )}
                                <p className="mb-1 text-sm font-black uppercase leading-tight">{viewModel.brandName}</p>
                                <p className="text-[9px] leading-tight text-slate-500">{viewModel.addressLine || ' '}</p>
                                <p className="text-[9px] font-bold uppercase tracking-tight text-slate-500">{viewModel.businessInfoLine || ' '}</p>
                            </div>

                            <div className="mb-4 space-y-1 border-y border-dashed border-slate-300 py-3 text-[10px]">
                                <div className="flex justify-between gap-4">
                                    <span className="font-bold">OR Number (Serial):</span>
                                    <span className="bg-blue-50 px-1 font-black italic text-blue-600">{viewModel.receiptNo}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span>Date:</span>
                                    <span>{viewModel.dateLabel}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span>Issued By:</span>
                                    <span className="text-right">{viewModel.departmentLabel}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span>Guest/Ref:</span>
                                    <span className="max-w-[155px] break-words text-right">{viewModel.guestReference}</span>
                                </div>
                            </div>

                            <div className="mb-6 space-y-2">
                                {viewModel.items.length === 0 ? (
                                    <div className="flex items-start justify-between gap-4 text-[10px]">
                                        <span className="flex-1 break-words pr-2">{receipt?.description || 'Payment'}</span>
                                        <span className="whitespace-nowrap font-bold">
                                            ₱{Number(viewModel.finalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                ) : (
                                    viewModel.items.map((item, idx) => (
                                        <div key={`${viewModel.receiptNo || 'receipt'}_${idx}`} className="flex items-start justify-between gap-4 text-[10px]">
                                            <span className="flex-1 break-words pr-2">
                                                {item?.name} {item?.selectedSize && item.selectedSize !== 'Regular' ? `(${item.selectedSize})` : ''}
                                            </span>
                                            <span className="min-w-[96px] whitespace-nowrap text-right font-bold">
                                                x{item?.quantity || 1} ₱{(((item?.price || 0) * (item?.quantity || 1)) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="space-y-1 border-t border-dashed border-slate-300 pt-3 text-[10px]">
                                <div className="flex justify-between text-slate-500"><span>Subtotal:</span><span>₱{Number(viewModel.rawSubtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between text-slate-500"><span>VAT ({viewModel.vatRate}%):</span><span>₱{Number(viewModel.vatValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between text-slate-500"><span>Srv. Charge ({viewModel.scRate}%):</span><span>₱{Number(viewModel.serviceChargeValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-[16px] font-black text-slate-900">
                                    <span>TOTAL :</span>
                                    <span>₱{Number(viewModel.finalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            <div className="pb-3 pt-7 text-center">
                                <p className="whitespace-pre-wrap text-[10px] text-slate-400">{viewModel.footerText}</p>
                                <div className="mt-4 text-[8px] font-black tracking-tight text-slate-300">|| |||| ||| |||| || |||| || ||||</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
