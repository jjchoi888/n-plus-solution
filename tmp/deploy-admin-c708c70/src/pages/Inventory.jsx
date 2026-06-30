import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { io } from 'socket.io-client';

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

export default function Inventory() {
    const [activeTab, setActiveTab] = useState('DASHBOARD');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const [items, setItems] = useState([]);
    const [logs, setLogs] = useState([]);

    // 💡 [핵심 추가] tracking_type (ASSET / CONSUMABLE), location, supplier 필드 신설
    const [newItem, setNewItem] = useState({
        tracking_type: 'CONSUMABLE', // 기본값: 소모품
        asset_class: 'OSE', name: '', category: '', min_stock: 10,
        unit: 'ea', unit_price: '', purchase_date: getHotelDate(0),
        useful_life: 0, quantity: '', location: '', supplier: ''
    });

    const [moveCategory, setMoveCategory] = useState('');
    const [stockMove, setStockMove] = useState({
        item_id: '', item_name: '', type: 'IN', amount: '', department: '', notes: ''
    });

    const [logFilter, setLogFilter] = useState({
        startDate: '', endDate: '', type: 'ALL', category: 'ALL', item_id: 'ALL'
    });

    const [assetFilter, setAssetFilter] = useState('ALL');
    const [assetDateFilter, setAssetDateFilter] = useState({ startDate: '', endDate: '' });
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    // 💡 [신규] 아이템별 상세 히스토리 모달, 필터, 페이지네이션 상태
    const [showItemHistoryModal, setShowItemHistoryModal] = useState(false);
    const [itemHistoryFilter, setItemHistoryFilter] = useState({ startDate: '', endDate: '', type: 'ALL' });
    const [itemHistoryPage, setItemHistoryPage] = useState(1);
    const ITEM_HISTORY_PAGE_SIZE = 20; // 페이지당 표시할 항목 수

    const currentUserId = sessionStorage.getItem('userId') || '';
    const currentHotelCode = sessionStorage.getItem('hotelCode') || '';

    const MACRO_CATEGORIES = {
        'FFE': ['Guest Room Furniture', 'Guest Room Appliances & Electronics', 'Bathroom Equipment', 'Food & Beverage Equipment', 'Front Office Equipment', 'Public Area Furniture', 'Safety & Security Equipment', 'Maintenance Equipment'],
        'OSE': ['Housekeeping Equipment', 'Minibar & In-Room Beverage Items', 'Bedding & Linen', 'Bathroom Linen', 'Amenities', 'Cleaning', 'Linens', 'F&B / Mini Bar', 'Others'],
        'IT': ['Office', 'IT & Office Equipment']
    };

    const getItemAssetClass = (item) => {
        if (item.asset_class) return item.asset_class;
        if (MACRO_CATEGORIES.FFE.includes(item.category)) return 'FFE';
        if (MACRO_CATEGORIES.IT.includes(item.category)) return 'IT';
        return 'OSE';
    };

    useEffect(() => {
        fetchData();

        const currentHotelCode = sessionStorage.getItem('hotelCode') || localStorage.getItem('hotelCode') || '';
        if (!currentHotelCode) return;

        const socketUrl = import.meta.env.VITE_API_URL || 'https://api.hotelnplus.com';
        const socket = io(socketUrl, { transports: ['websocket'] });

        socket.on('db_updated', (data) => {
            if (data.hotel_code === currentHotelCode || data.hotel_code === 'ALL') {
                console.log("🔄 [Inventory] Real-time data sync completed!");
                fetchData();
            }
        });

        return () => socket.disconnect();
    }, []);

    useEffect(() => {
        setAssetFilter('ALL');
        setAssetDateFilter({ startDate: '', endDate: '' });
    }, [activeTab]);

    const fetchData = async () => {
        try {
            const resItems = await fetch(`/api/inventory/items?hotel=${currentHotelCode}`);
            const dataItems = await resItems.json();
            if (dataItems.success) setItems(dataItems.items);

            const resLogs = await fetch(`/api/inventory/logs?hotel=${currentHotelCode}`);
            const dataLogs = await resLogs.json();
            if (dataLogs.success) setLogs(dataLogs.logs);
        } catch (e) { console.error("Failed to load data:", e); }
    };

    const handleAddItem = async () => {
        if (!newItem.name || !newItem.category) return alert("Category and Name are required.");

        // 💡 폼 성격에 맞게 안 쓰는 데이터 깔끔하게 초기화 후 전송
        const payload = {
            ...newItem,
            hotel_code: currentHotelCode,
            unit_price: Number(newItem.unit_price || 0),
            quantity: Number(newItem.quantity || 0),
            useful_life: newItem.tracking_type === 'ASSET' ? Number(newItem.useful_life || 0) : 0,
            min_stock: newItem.tracking_type === 'CONSUMABLE' ? Number(newItem.min_stock || 0) : 0,
            location: newItem.tracking_type === 'ASSET' ? newItem.location : '',
            supplier: newItem.tracking_type === 'CONSUMABLE' ? newItem.supplier : ''
        };

        await fetch('/api/inventory/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        alert("✅ Item registered successfully!");
        setNewItem({ tracking_type: newItem.tracking_type, asset_class: newItem.asset_class, name: '', category: '', min_stock: 10, unit: 'ea', unit_price: '', purchase_date: getHotelDate(0), useful_life: 0, quantity: '', location: '', supplier: '' });
        fetchData();
    };

    const handleUpdateItem = async () => {
        if (!editingItem.name || !editingItem.category) return alert("Category and Name are required.");

        const payload = {
            ...editingItem,
            hotel_code: currentHotelCode,
            unit_price: Number(editingItem.unit_price || 0),
            useful_life: editingItem.tracking_type === 'ASSET' ? Number(editingItem.useful_life || 0) : 0,
            min_stock: editingItem.tracking_type === 'CONSUMABLE' ? Number(editingItem.min_stock || 0) : 0,
            location: editingItem.tracking_type === 'ASSET' ? editingItem.location : '',
            supplier: editingItem.tracking_type === 'CONSUMABLE' ? editingItem.supplier : ''
        };

        await fetch(`/api/inventory/items/${editingItem.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        alert("✅ Item updated successfully!");
        setEditModalOpen(false);
        fetchData();
    };

    const handleDeleteItem = async (id) => {
        if (window.confirm('Delete this item completely?')) {
            await fetch(`/api/inventory/items/${id}?hotel=${currentHotelCode}`, { method: 'DELETE' });
            fetchData();
        }
    };

    const handleStockMove = async () => {
        if (!stockMove.item_id || !stockMove.amount || stockMove.amount <= 0) return alert("Please select a valid item and quantity.");
        const combinedNotes = stockMove.department ? `[${stockMove.department}] ${stockMove.notes}` : stockMove.notes;
        const payload = {
            ...stockMove,
            hotel_code: currentHotelCode,
            notes: combinedNotes,
            user_id: currentUserId
        };

        const res = await fetch('/api/inventory/movement', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            alert(`✅ Stock ${stockMove.type} processed!`);
            setStockMove({ item_id: '', item_name: '', type: 'IN', amount: '', department: '', notes: '' });
            setMoveCategory('');
            fetchData();
        } else alert("❌ Error: " + data.message);
    };

    const handleMenuClick = (tabName, trackType = null, assetClass = null) => {
        setActiveTab(tabName);
        setIsMobileMenuOpen(false);
        if (trackType) {
            setNewItem(prev => ({ ...prev, tracking_type: trackType, asset_class: assetClass || prev.asset_class }));
        }
    };

    const calculateBookValue = (item) => {
        const purchaseValue = item.quantity * item.unit_price;
        if (!item.useful_life || item.useful_life <= 0) return purchaseValue;
        const purchaseDate = new Date(item.purchase_date || new Date());
        const ageYears = (new Date() - purchaseDate) / (1000 * 60 * 60 * 24 * 365.25);
        const depreciationRate = Math.min(1, Math.max(0, ageYears / item.useful_life));
        return purchaseValue * (1 - depreciationRate);
    };

    const exportPDF = (macroType, title) => {
        const doc = new jsPDF();
        const filteredItems = items.filter(i => {
            if (getItemAssetClass(i) !== macroType) return false;
            if (assetFilter !== 'ALL' && i.category !== assetFilter) return false;
            if (assetDateFilter.startDate && i.purchase_date < assetDateFilter.startDate) return false;
            if (assetDateFilter.endDate && i.purchase_date > assetDateFilter.endDate) return false;
            return true;
        });
        const totalOriginalValue = filteredItems.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
        const totalBookValue = filteredItems.reduce((sum, i) => sum + calculateBookValue(i), 0);

        doc.setFontSize(18); doc.setTextColor(0, 51, 102); doc.text(`Hotel Asset Register - ${currentHotelCode}`, 14, 20);
        doc.setFontSize(11); doc.setTextColor(100);
        doc.text(`Asset Class: ${title}`, 14, 30);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 36);
        if (assetDateFilter.startDate || assetDateFilter.endDate) {
            doc.text(`Filtered Period: ${assetDateFilter.startDate || 'Any'} ~ ${assetDateFilter.endDate || 'Any'}`, 14, 42);
            doc.text(`Total Original Cost: PHP ${totalOriginalValue.toLocaleString()}`, 14, 50);
            doc.text(`Total Book Value: PHP ${totalBookValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 14, 56);
        } else {
            doc.text(`Total Original Cost: PHP ${totalOriginalValue.toLocaleString()}`, 14, 44);
            doc.text(`Total Book Value: PHP ${totalBookValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 14, 50);
        }

        const tableColumn = ["Category", "Item Name", "Qty", "Pur. Date", "Pur. Value", "Life", "Book Value"];
        const tableRows = filteredItems.map(item => [
            item.category, item.name, `${item.quantity} ${item.unit}`,
            item.purchase_date ? item.purchase_date.substring(0, 7) : '-',
            (item.quantity * item.unit_price).toLocaleString(),
            item.useful_life || '-', calculateBookValue(item).toLocaleString(undefined, { maximumFractionDigits: 0 })
        ]);

        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 55, theme: 'striped', headStyles: { fillColor: [16, 185, 129] } });
        doc.save(`Asset_Report_${currentHotelCode}_${macroType}_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    const defaultUnits = ['ea', 'unit', 'bottle', 'pair', 'liter', 'roll', 'pack', 'can', 'box', 'kg', 'set'];
    const uniqueCategories = [...new Set(items.map(i => i.category))];
    const formCategories = [...new Set([...(MACRO_CATEGORIES[newItem.asset_class] || []), ...items.filter(i => getItemAssetClass(i) === newItem.asset_class).map(i => i.category)])];
    const formItemNames = newItem.category ? [...new Set(items.filter(i => i.category === newItem.category).map(i => i.name))] : [];
    const ledgerFilteredItems = (logFilter.category === 'ALL') ? items : items.filter(i => i.category === logFilter.category);
    const movementFilteredItems = (moveCategory === '') ? items : items.filter(i => i.category === moveCategory);

    const filteredLogs = logs.filter(log => {
        const logDate = log.timestamp.split(' ')[0];
        if (logFilter.type !== 'ALL' && log.type !== logFilter.type) return false;
        const itemCategory = (items.find(i => i.id === log.item_id) || {}).category || '';
        if (logFilter.category !== 'ALL' && itemCategory !== logFilter.category) return false;
        if (logFilter.item_id !== 'ALL' && String(log.item_id) !== String(logFilter.item_id)) return false;
        if (logFilter.startDate && logDate < logFilter.startDate) return false;
        if (logFilter.endDate && logDate > logFilter.endDate) return false;
        return true;
    });

    // 💡 [신규] 선택된 아이템의 히스토리 필터링 및 페이지네이션 연산
    const selectedItemLogs = logs.filter(log => String(log.item_id) === String(stockMove.item_id));
    // Logs might not contain unit_price directly, so calculate from total_value and amount
    const filteredItemLogs = selectedItemLogs.filter(log => {
        const logDate = log.timestamp.split(' ')[0];
        if (itemHistoryFilter.type !== 'ALL' && log.type !== itemHistoryFilter.type) return false;
        if (itemHistoryFilter.startDate && logDate < itemHistoryFilter.startDate) return false;
        if (itemHistoryFilter.endDate && logDate > itemHistoryFilter.endDate) return false;
        return true;
    });

    const totalItemHistoryPages = Math.max(1, Math.ceil(filteredItemLogs.length / ITEM_HISTORY_PAGE_SIZE));
    const paginatedItemLogs = filteredItemLogs.slice(
        (itemHistoryPage - 1) * ITEM_HISTORY_PAGE_SIZE,
        itemHistoryPage * ITEM_HISTORY_PAGE_SIZE
    );

    const totalInQty = filteredItemLogs.filter(l => l.type === 'IN').reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const totalInVal = filteredItemLogs.filter(l => l.type === 'IN').reduce((sum, l) => sum + Number(l.total_value || 0), 0);
    const avgInUnitPrice = totalInQty > 0 ? totalInVal / totalInQty : 0;
    const totalOutQty = filteredItemLogs.filter(l => l.type === 'OUT' || l.type === 'WASTE').reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const totalOutVal = filteredItemLogs.filter(l => l.type === 'OUT' || l.type === 'WASTE').reduce((sum, l) => sum + Number(l.total_value || 0), 0);

    useEffect(() => {
        setItemHistoryPage(1); // 필터가 바뀔 때마다 첫 페이지로 이동
    }, [itemHistoryFilter.startDate, itemHistoryFilter.endDate, itemHistoryFilter.type, stockMove.item_id]);

    const handleExportItemHistoryPDF = () => {
        if (filteredItemLogs.length === 0) return alert('No data to export.');
        const doc = new jsPDF();
        doc.setFontSize(18); doc.setTextColor(0, 51, 102); doc.text(`Item History: ${stockMove.item_name}`, 14, 20);
        doc.setFontSize(11); doc.setTextColor(100);
        doc.text(`Date Range: ${itemHistoryFilter.startDate || 'All'} to ${itemHistoryFilter.endDate || 'All'}`, 14, 30);
        doc.text(`Total IN: +${totalInQty} (PHP ${totalInVal.toLocaleString()}) | Avg Unit Price: PHP ${avgInUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, 38);
        doc.text(`Total OUT/WASTE: -${totalOutQty} (PHP ${totalOutVal.toLocaleString()})`, 14, 44);

        const tableColumn = ["Date & Time", "Type", "Qty", "Unit Price (PHP)", "Total Value (PHP)", "Notes"];
        const tableRows = filteredItemLogs.map(log => [
            log.timestamp, log.type, log.amount,
            Number(log.amount) > 0 ? (Number(log.total_value || 0) / Number(log.amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00',
            (log.type === 'IN' ? '+' : '-') + Number(log.total_value || 0).toLocaleString(),
            log.notes || '-'
        ]);

        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 51, theme: 'striped', headStyles: { fillColor: [16, 185, 129] } });
        doc.save(`Item_History_${stockMove.item_name}_${getHotelDate(0)}.pdf`);
    };

    // 💡 [수정] DB에 'tracking_type' 꼬리표가 없는 과거 데이터까지 카테고리(IT, FFE 등)로 완벽히 추론하여 분리!
    const consumableValue = items.filter(i => {
        if (i.tracking_type) return i.tracking_type === 'CONSUMABLE';
        return !['FFE', 'IT'].includes(getItemAssetClass(i));
    }).reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);

    const assetValue = items.filter(i => {
        if (i.tracking_type) return i.tracking_type === 'ASSET';
        return ['FFE', 'IT'].includes(getItemAssetClass(i));
    }).reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);

    const lowStockItems = items.filter(i => {
        const isConsumable = i.tracking_type ? i.tracking_type === 'CONSUMABLE' : !['FFE', 'IT'].includes(getItemAssetClass(i));
        return isConsumable && Number(i.quantity) <= Number(i.min_stock);
    });

    const renderAssetRegister = (macroType, title, icon) => {
        const availableCategories = [...new Set(items.filter(i => getItemAssetClass(i) === macroType).map(i => i.category))];

        // 💡 [수정] 화면 리스트 렌더링 시 기간(Purchase Date) 필터 적용
        const displayedItems = items.filter(i => {
            if (getItemAssetClass(i) !== macroType) return false;
            if (assetFilter !== 'ALL' && i.category !== assetFilter) return false;
            if (assetDateFilter.startDate && i.purchase_date < assetDateFilter.startDate) return false;
            if (assetDateFilter.endDate && i.purchase_date > assetDateFilter.endDate) return false;
            return true;
        });

        const subTotalOriginal = displayedItems.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
        const subTotalBook = displayedItems.reduce((sum, i) => sum + calculateBookValue(i), 0);

        return (
            <div className="animate-fade-in max-w-7xl mx-auto pb-20">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6 bg-white p-6 rounded-md border border-slate-200 shadow-sm">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-3"><span>{icon}</span> {title}</h2>
                        <div className="flex flex-wrap gap-4 md:gap-6 mt-3">
                            <p className="text-slate-500 font-bold text-xs md:text-sm">Purchase Value: <br /><span className="text-slate-800 font-black text-lg md:text-xl">₱ {subTotalOriginal.toLocaleString()}</span></p>
                            <p className="text-emerald-600 font-bold text-xs md:text-sm border-l pl-4 md:pl-6 border-slate-200">Book Value: <br /><span className="text-emerald-700 font-black text-xl md:text-2xl">₱ {subTotalBook.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full xl:w-auto items-center xl:justify-end">
                        {/* 💡 [신규] Date Range 필터 UI 추가 */}
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-md border border-slate-200 w-full sm:w-auto h-full">
                            <input
                                type="date"
                                value={assetDateFilter.startDate}
                                onChange={e => setAssetDateFilter({ ...assetDateFilter, startDate: e.target.value })}
                                className="p-2 text-xs font-bold text-slate-600 bg-transparent outline-none cursor-pointer w-full sm:w-auto"
                                title="Start Date"
                            />
                            <span className="text-slate-300 font-bold">~</span>
                            <input
                                type="date"
                                value={assetDateFilter.endDate}
                                onChange={e => setAssetDateFilter({ ...assetDateFilter, endDate: e.target.value })}
                                className="p-2 text-xs font-bold text-slate-600 bg-transparent outline-none cursor-pointer w-full sm:w-auto"
                                title="End Date"
                            />
                            {(assetDateFilter.startDate || assetDateFilter.endDate) && (
                                <button
                                    onClick={() => setAssetDateFilter({ startDate: '', endDate: '' })}
                                    className="text-red-400 hover:text-red-600 px-3 font-bold text-lg border-l border-slate-200 ml-1"
                                    title="Clear Dates"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        <select value={assetFilter} onChange={e => setAssetFilter(e.target.value)} className="w-full sm:w-auto p-3 border border-slate-300 rounded-md font-bold bg-slate-50 text-slate-700 focus:border-emerald-500 outline-none cursor-pointer text-sm">
                            <option value="ALL">All Categories</option>
                            {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={() => exportPDF(macroType, title)} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-md font-black shadow-md flex items-center justify-center gap-2 transition-colors text-sm">📄 PDF Report</button>
                    </div>
                </div>
                <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
                        <thead className="bg-slate-100 border-b text-slate-600">
                            <tr><th className="p-4">Category</th><th className="p-4">Item Name</th><th className="p-4 text-center">Life(Yrs)</th><th className="p-4 text-center">Qty</th><th className="p-4 text-center">Pur. Date</th><th className="p-4 text-right">Pur. Value</th><th className="p-4 text-right text-emerald-700 font-bold">Book Value</th><th className="p-4 text-center">Action</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {displayedItems.map(item => {
                                const purchaseVal = item.quantity * item.unit_price;
                                const bookVal = calculateBookValue(item);
                                return (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-bold text-slate-500">{item.category}</td>
                                        <td className="p-4 font-black text-slate-800">{item.name}</td>
                                        <td className="p-4 text-center font-bold text-slate-400">{item.useful_life > 0 ? `${item.useful_life} Yrs` : 'Expensed'}</td>
                                        <td className="p-4"><div className="grid grid-cols-2 gap-2 items-baseline w-24 mx-auto"><span className="text-lg font-black text-right text-slate-800">{item.quantity}</span><span className="text-xs font-bold text-slate-400 text-left">{item.unit}</span></div></td>
                                        <td className="p-4 text-center font-mono text-slate-500">{item.purchase_date ? item.purchase_date.substring(0, 10) : '-'}</td>
                                        <td className="p-4 text-right text-slate-500 line-through decoration-slate-300">₱ {purchaseVal.toLocaleString()}</td>
                                        <td className="p-4 text-right font-black text-emerald-600 text-lg">₱ {bookVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td className="p-4 text-center"><button onClick={() => { setEditingItem({ ...item, tracking_type: item.tracking_type || 'ASSET' }); setEditModalOpen(true); }} className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md transition-colors hover:bg-blue-100">Edit</button></td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {displayedItems.length === 0 && <p className="p-8 text-center text-slate-400 font-bold">No assets found for the selected period or category.</p>}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col md:flex-row h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden relative">

            {/* 모바일 헤더 */}
            <div className="md:hidden flex justify-between items-center bg-emerald-900 text-white p-4 shrink-0 shadow-md z-40">
                <h1 className="text-xl font-black text-emerald-400 tracking-wider">INVENTORY</h1>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-emerald-800 rounded-md">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}></path></svg>
                </button>
            </div>

            {isMobileMenuOpen && (
                <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
            )}

            {/* 💡 [개편] 투트랙 사이드바 메뉴 */}
            <div className={`fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-40 w-64 bg-emerald-900 text-white flex flex-col shadow-2xl shrink-0`}>
                <div className="p-6 border-b border-emerald-800 hidden md:block">
                    <h1 className="text-2xl font-black tracking-wider text-emerald-400">INVENTORY</h1>
                    <p className="text-emerald-200 text-xs mt-1">Asset & Cost Control</p>
                    <div className="mt-4 bg-emerald-950 p-2.5 rounded-md border border-emerald-700 text-center">
                        <p className="text-[10px] text-emerald-400 uppercase font-bold mb-0.5">Current Property</p>
                        <p className="font-black text-white tracking-widest">{currentHotelCode}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 mt-2 px-4">Operations</div>
                    <button onClick={() => handleMenuClick('DASHBOARD')} className={`w-full text-left px-4 py-2.5 rounded-md font-bold transition-all flex items-center gap-3 ${activeTab === 'DASHBOARD' ? 'bg-emerald-600 shadow-md' : 'hover:bg-emerald-800 text-emerald-100'}`}><span className="text-lg">📊</span> Dashboard</button>
                    <button onClick={() => handleMenuClick('MOVEMENT')} className={`w-full text-left px-4 py-2.5 rounded-md font-bold transition-all flex items-center gap-3 ${activeTab === 'MOVEMENT' ? 'bg-emerald-600 shadow-md' : 'hover:bg-emerald-800 text-emerald-100'}`}><span className="text-lg">🔄</span> Stock IN/OUT</button>

                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 mt-6 px-4">Consumables Control</div>
                    <button onClick={() => handleMenuClick('MASTER', 'CONSUMABLE', 'OSE')} className={`w-full text-left px-4 py-2.5 rounded-md font-bold transition-all flex items-center gap-3 ${activeTab === 'MASTER' && newItem.tracking_type === 'CONSUMABLE' ? 'bg-blue-600 shadow-md' : 'hover:bg-emerald-800 text-emerald-100'}`}><span className="text-lg">📦</span> Consumable Master</button>
                    <button onClick={() => handleMenuClick('OSE')} className={`w-full text-left px-4 py-2.5 rounded-md font-bold transition-all flex items-center gap-3 ${activeTab === 'OSE' ? 'bg-slate-700 shadow-md text-white' : 'hover:bg-emerald-800 text-emerald-200'}`}><span className="text-lg">🧴</span> OS&E Supplies</button>

                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 mt-6 px-4">Asset Management</div>
                    <button onClick={() => handleMenuClick('MASTER', 'ASSET', 'FFE')} className={`w-full text-left px-4 py-2.5 rounded-md font-bold transition-all flex items-center gap-3 ${activeTab === 'MASTER' && newItem.tracking_type === 'ASSET' ? 'bg-emerald-600 shadow-md' : 'hover:bg-emerald-800 text-emerald-100'}`}><span className="text-lg">🏷️</span> Asset Master</button>
                    <button onClick={() => handleMenuClick('FFE')} className={`w-full text-left px-4 py-2.5 rounded-md font-bold transition-all flex items-center gap-3 ${activeTab === 'FFE' ? 'bg-slate-700 shadow-md text-white' : 'hover:bg-emerald-800 text-emerald-200'}`}><span className="text-lg">🛋️</span> FF&E Assets</button>
                    <button onClick={() => handleMenuClick('IT')} className={`w-full text-left px-4 py-2.5 rounded-md font-bold transition-all flex items-center gap-3 ${activeTab === 'IT' ? 'bg-slate-700 shadow-md text-white' : 'hover:bg-emerald-800 text-emerald-200'}`}><span className="text-lg">💻</span> IT & Office</button>
                </div>

                <div className="p-6 border-t border-emerald-800">
                    <Link to="/" className="block w-full text-center bg-emerald-800 hover:bg-emerald-700 py-3 rounded-md font-bold text-white transition-colors">🏠 Exit</Link>
                </div>
            </div>

            <div className="flex-1 p-4 md:p-6 lg:p-10 overflow-y-auto w-full relative">

                {/* 💡 [신규] 아이템 개별 히스토리 모달 (페이지네이션 및 PDF 포함) */}
                {showItemHistoryModal && (
                    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 w-full max-w-4xl max-h-[95vh] flex flex-col border border-slate-200">
                            <div className="flex justify-between items-center mb-6 shrink-0 border-b pb-4">
                                <div>
                                    <h3 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2"><span>📜</span> Item History: <span className="text-emerald-700">{stockMove.item_name}</span></h3>
                                    <p className="text-xs font-bold text-slate-500 mt-1">Review purchasing and usage logs for this specific item.</p>
                                </div>
                                <button onClick={() => setShowItemHistoryModal(false)} className="text-slate-400 hover:text-red-500 font-bold text-2xl transition-colors">✕</button>
                            </div>

                            {/* 필터 및 PDF 내보내기 */}
                            <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-6 bg-slate-50 p-4 rounded-md border border-slate-200 shrink-0">
                                <div className="flex-1"><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Start Date</label><input type="date" value={itemHistoryFilter.startDate} onChange={e => setItemHistoryFilter({ ...itemHistoryFilter, startDate: e.target.value })} className="w-full p-2.5 border rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                                <div className="flex-1"><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">End Date</label><input type="date" value={itemHistoryFilter.endDate} onChange={e => setItemHistoryFilter({ ...itemHistoryFilter, endDate: e.target.value })} className="w-full p-2.5 border rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                                <div className="flex-1"><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Type</label><select value={itemHistoryFilter.type} onChange={e => setItemHistoryFilter({ ...itemHistoryFilter, type: e.target.value })} className="w-full p-2.5 border rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"><option value="ALL">All</option><option value="IN">Purchased (IN)</option><option value="OUT">Consumed (OUT)</option><option value="WASTE">Disposed (WASTE)</option></select></div>
                                <div className="flex gap-2 items-end mt-2 md:mt-0">
                                    <button onClick={() => setItemHistoryFilter({ startDate: '', endDate: '', type: 'ALL' })} className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md font-bold text-sm transition-colors">Clear</button>
                                    <button onClick={handleExportItemHistoryPDF} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-md font-black shadow-md flex items-center gap-2 transition-colors text-sm">📄 PDF</button>
                                </div>
                            </div>

                            {/* 합계 요약 (필터링된 기간 기준) */}
                            <div className="grid grid-cols-2 gap-4 mb-6 shrink-0">
                                <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
                                    <div className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1">Total IN (Purchased)</div>
                                    <div className="flex items-end gap-2">
                                        <span className="text-2xl font-black text-blue-800">+{totalInQty}</span>
                                        <span className="text-sm font-bold text-blue-600 mb-0.5">(₱ {totalInVal.toLocaleString()})</span>
                                    </div>
                                    <div className="text-[10px] font-bold text-blue-500 mt-1">Avg Unit Price: ₱ {avgInUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                                <div className="bg-orange-50 border border-orange-200 p-4 rounded-md">
                                    <div className="text-[10px] font-black text-orange-700 uppercase tracking-widest mb-1">Total OUT / WASTE</div>
                                    <div className="flex items-end gap-2">
                                        <span className="text-2xl font-black text-orange-800">-{totalOutQty}</span>
                                        <span className="text-sm font-bold text-orange-600 mb-0.5">(₱ {totalOutVal.toLocaleString()})</span>
                                    </div>
                                </div>
                            </div>

                            {/* 내역 테이블 (페이지네이션 적용) */}
                            <div className="flex-1 overflow-auto border border-slate-200 rounded-md bg-white shadow-inner min-h-[250px]">
                                <table className="w-full text-left text-sm whitespace-nowrap min-w-[500px]">
                                    <thead className="bg-slate-50 sticky top-0 shadow-sm z-10 border-b border-slate-200">
                                        <tr>
                                            <th className="p-3 text-slate-500 font-bold uppercase tracking-wider text-xs">Date & Time</th>
                                            <th className="p-3 text-slate-500 font-bold uppercase tracking-wider text-xs">Type</th>
                                            <th className="p-3 text-slate-500 font-bold uppercase tracking-wider text-xs text-right">Qty</th>
                                            <th className="p-3 text-slate-500 font-bold uppercase tracking-wider text-xs text-right">Unit Price (₱)</th>
                                            <th className="p-3 text-slate-500 font-bold uppercase tracking-wider text-xs text-right">Total Value (₱)</th>
                                            <th className="p-3 text-slate-500 font-bold uppercase tracking-wider text-xs">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paginatedItemLogs.length === 0 ? (
                                            <tr><td colSpan="6" className="text-center py-10 text-slate-400 font-bold">No history found for this item.</td></tr>
                                        ) : (
                                            paginatedItemLogs.map(log => (
                                                <tr key={log.id} className="hover:bg-slate-50">
                                                    <td className="p-3 font-mono text-[11px] text-slate-500">{log.timestamp}</td>
                                                    <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${log.type === 'IN' ? 'bg-blue-100 text-blue-700' : log.type === 'OUT' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{log.type}</span></td>
                                                    <td className="p-3 text-right font-black text-slate-700">{log.type === 'IN' ? '+' : '-'}{log.amount}</td>
                                                    <td className="p-3 text-right font-black text-slate-600">{Number(log.amount) > 0 ? (Number(log.total_value || 0) / Number(log.amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
                                                    <td className={`p-3 text-right font-black ${log.type === 'IN' ? 'text-blue-600' : 'text-red-600'}`}>{log.type === 'IN' ? '+' : '-'} {Number(log.total_value || 0).toLocaleString()}</td>
                                                    <td className="p-3 text-xs text-slate-500 truncate max-w-[200px]">{log.notes || '-'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* 페이지네이션 컨트롤 */}
                            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200 shrink-0">
                                <button onClick={() => setItemHistoryPage(p => Math.max(1, p - 1))} disabled={itemHistoryPage === 1} className="px-4 py-2 bg-slate-100 text-slate-600 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors">Prev</button>
                                <span className="text-sm font-bold text-slate-500">Page {filteredItemLogs.length === 0 ? 0 : itemHistoryPage} of {totalItemHistoryPages}</span>
                                <button onClick={() => setItemHistoryPage(p => Math.min(totalItemHistoryPages, p + 1))} disabled={itemHistoryPage === totalItemHistoryPages || filteredItemLogs.length === 0} className="px-4 py-2 bg-slate-100 text-slate-600 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors">Next</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 대쉬보드 */}
                {activeTab === 'DASHBOARD' && (
                    <div className="animate-fade-in w-full max-w-7xl mx-auto pb-20">
                        <h2 className="text-2xl md:text-3xl font-black mb-6 md:mb-8 text-slate-800">Inventory Dashboard</h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
                            {/* 📦 소모품 총액 카드 */}
                            <div className="bg-white p-5 md:p-6 rounded-md border border-slate-200 shadow-sm border-l-4 border-l-blue-500 relative overflow-hidden">
                                <p className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><span>📦</span> Consumable Stock Value</p>
                                <p className="text-2xl md:text-3xl font-black text-blue-600 mt-2">₱ {consumableValue.toLocaleString()}</p>
                            </div>

                            {/* 🏷️ 고정자산 총액 카드 */}
                            <div className="bg-white p-5 md:p-6 rounded-md border border-slate-200 shadow-sm border-l-4 border-l-emerald-500 relative overflow-hidden">
                                <p className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><span>🏷️</span> Fixed Asset Value</p>
                                <p className="text-2xl md:text-3xl font-black text-emerald-600 mt-2">₱ {assetValue.toLocaleString()}</p>
                            </div>

                            {/* 🚨 재고 부족 알림 카드 */}
                            <div className={`p-5 md:p-6 rounded-md border shadow-sm border-l-4 ${lowStockItems.length > 0 ? 'bg-red-50 border-red-200 border-l-red-500' : 'bg-green-50 border-green-200 border-l-green-500'}`}>
                                <p className={`text-xs md:text-sm font-bold uppercase tracking-wider ${lowStockItems.length > 0 ? 'text-red-500' : 'text-green-600'}`}>Low Stock Alerts</p>
                                <p className={`text-2xl md:text-3xl font-black mt-2 flex items-center gap-2 ${lowStockItems.length > 0 ? 'text-red-600' : 'text-green-700'}`}>
                                    {lowStockItems.length} Items {lowStockItems.length > 0 && <span className="text-xl animate-pulse">🚨</span>}
                                </p>
                            </div>
                        </div>

                        {lowStockItems.length > 0 && (
                            <div className="bg-white p-5 md:p-6 rounded-md border border-red-200 shadow-sm mb-6 md:mb-8">
                                <h3 className="text-lg md:text-xl font-black text-red-600 mb-4 flex items-center gap-2"><span>⚠️</span> Consumables Need Restocking</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                    {lowStockItems.map(item => (
                                        <div key={item.id} className="p-4 border border-red-100 bg-red-50/50 rounded-md flex justify-between items-center">
                                            <div className="min-w-0 pr-2">
                                                <p className="text-[10px] font-bold text-red-400 uppercase truncate">{item.category}</p>
                                                <p className="font-bold text-slate-800 text-sm truncate">{item.name}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-xl font-black text-red-600">{item.quantity} <span className="text-[10px] md:text-xs">{item.unit}</span></p>
                                                <p className="text-[10px] text-red-400 font-bold">Min: {item.min_stock}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-white p-5 md:p-8 rounded-md border border-slate-200 shadow-sm mb-8">
                            <h3 className="text-lg md:text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><span>📓</span> Stock Transaction Ledger</h3>
                            <div className="flex flex-wrap gap-3 mb-6 bg-slate-50 p-4 rounded-md border border-slate-200">
                                <div className="flex-1 min-w-[120px]"><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Start</label><input type="date" value={logFilter.startDate} onChange={e => setLogFilter({ ...logFilter, startDate: e.target.value })} className="w-full p-2 md:p-2.5 border rounded-md text-xs md:text-sm" /></div>
                                <div className="flex-1 min-w-[120px]"><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">End</label><input type="date" value={logFilter.endDate} onChange={e => setLogFilter({ ...logFilter, endDate: e.target.value })} className="w-full p-2 md:p-2.5 border rounded-md text-xs md:text-sm" /></div>
                                <div className="flex-1 min-w-[100px]"><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Type</label><select value={logFilter.type} onChange={e => setLogFilter({ ...logFilter, type: e.target.value })} className="w-full p-2 md:p-2.5 border rounded-md font-bold text-xs md:text-sm bg-white"><option value="ALL">All</option><option value="IN">IN</option><option value="OUT">OUT</option><option value="WASTE">WASTE</option></select></div>
                                <div className="flex-1 min-w-[130px]"><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Category</label><select value={logFilter.category} onChange={e => setLogFilter({ ...logFilter, category: e.target.value, item_id: 'ALL' })} className="w-full p-2 md:p-2.5 border rounded-md font-bold text-xs md:text-sm bg-white"><option value="ALL">All</option>{uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                <div className="w-full md:flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-blue-600 uppercase block mb-1">Item</label><select value={logFilter.item_id} onChange={e => setLogFilter({ ...logFilter, item_id: e.target.value })} className="w-full p-2 md:p-2.5 border border-blue-400 rounded-md font-bold text-xs md:text-sm bg-white"><option value="ALL">All Items</option>{ledgerFilteredItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
                            </div>
                            <div className="overflow-x-auto border border-slate-200 rounded-md">
                                <table className="w-full text-left text-xs md:text-sm whitespace-nowrap min-w-[600px]">
                                    <thead className="bg-slate-100 border-b text-slate-600"><tr><th className="p-3 md:p-4">Date</th><th className="p-3 md:p-4">Item</th><th className="p-3 md:p-4">Type</th><th className="p-3 md:p-4 text-right">Qty</th><th className="p-3 md:p-4 text-right">Value (₱)</th><th className="p-3 md:p-4">Notes</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredLogs.map(log => (<tr key={log.id} className="hover:bg-slate-50"><td className="p-3 md:p-4 font-mono text-[10px] md:text-xs text-slate-500">{log.timestamp}</td><td className="p-3 md:p-4 font-bold text-slate-800">{log.item_name}</td><td className="p-3 md:p-4"><span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${log.type === 'IN' ? 'bg-blue-100 text-blue-700' : log.type === 'OUT' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{log.type}</span></td><td className="p-3 md:p-4 text-right font-black text-slate-700">{log.type === 'IN' ? '+' : '-'}{log.amount}</td><td className={`p-3 md:p-4 text-right font-black ${log.type === 'IN' ? 'text-blue-600' : 'text-red-600'}`}>{log.type === 'IN' ? '+' : '-'} {log.total_value.toLocaleString()}</td><td className="p-3 md:p-4 text-[10px] md:text-xs text-slate-500">{log.notes || '-'}</td></tr>))}
                                        {filteredLogs.length === 0 && <tr><td colSpan="6" className="p-8 text-center font-bold text-slate-400">No logs found.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* 💡 [개편] 통합 아이템 마스터 등록 폼 */}
                {activeTab === 'MASTER' && (
                    <div className="animate-fade-in w-full max-w-7xl mx-auto pb-20">
                        <h2 className="text-2xl md:text-3xl font-black mb-6 text-slate-800">System Database Master</h2>

                        {/* 상단 투트랙 토글 버튼 */}
                        <div className="flex bg-slate-200 p-1.5 rounded-md mb-6 w-full max-w-md border border-slate-300 shadow-inner mx-auto md:mx-0">
                            <button onClick={() => setNewItem({ ...newItem, tracking_type: 'CONSUMABLE', asset_class: 'OSE', useful_life: 0, location: '' })}
                                className={`flex-1 py-2.5 text-sm md:text-base font-black rounded-md transition-all ${newItem.tracking_type === 'CONSUMABLE' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                                📦 Consumables
                            </button>
                            <button onClick={() => setNewItem({ ...newItem, tracking_type: 'ASSET', asset_class: 'FFE', min_stock: 0, supplier: '' })}
                                className={`flex-1 py-2.5 text-sm md:text-base font-black rounded-md transition-all ${newItem.tracking_type === 'ASSET' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                                🏷️ Fixed Assets
                            </button>
                        </div>

                        {/* 폼 영역 */}
                        <div className={`${newItem.tracking_type === 'CONSUMABLE' ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'} p-5 md:p-8 rounded-md border shadow-sm mb-8 transition-colors duration-300`}>
                            <h4 className={`font-black mb-4 text-sm md:text-base flex items-center gap-2 ${newItem.tracking_type === 'CONSUMABLE' ? 'text-blue-800' : 'text-emerald-800'}`}>
                                {newItem.tracking_type === 'CONSUMABLE' ? '📦 Register New Consumable' : '🏷️ Register New Fixed Asset'}
                            </h4>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
                                <div className="col-span-2 md:col-span-1">
                                    <label className={`text-[10px] font-bold block mb-1 uppercase ${newItem.tracking_type === 'CONSUMABLE' ? 'text-blue-800' : 'text-emerald-800'}`}>Asset Class</label>
                                    {/* 💡 [수정] 고정 Select에서 직접 입력이 가능한 Input + Datalist 조합으로 변경 */}
                                    <input
                                        list="assetClassList"
                                        value={newItem.asset_class}
                                        onChange={e => setNewItem({ ...newItem, asset_class: e.target.value.toUpperCase() })}
                                        onFocus={e => e.target.select()}
                                        className={`w-full p-2.5 md:p-3 border rounded-md font-bold bg-white text-sm uppercase ${newItem.tracking_type === 'CONSUMABLE' ? 'border-blue-200' : 'border-emerald-200'}`}
                                        placeholder="Select or Type..."
                                    />
                                    <datalist id="assetClassList">
                                        {newItem.tracking_type === 'CONSUMABLE' ? (
                                            <><option value="OSE">OS&E</option><option value="FB">F&B</option></>
                                        ) : (
                                            <><option value="FFE">FF&E</option><option value="IT">IT</option></>
                                        )}
                                    </datalist>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className={`text-[10px] font-bold block mb-1 uppercase ${newItem.tracking_type === 'CONSUMABLE' ? 'text-blue-800' : 'text-emerald-800'}`}>Category</label>
                                    <input
                                        list="formCatList"
                                        value={newItem.category}
                                        onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                        onFocus={e => e.target.select()}
                                        className={`w-full p-2.5 md:p-3 border rounded-md font-bold bg-white text-sm ${newItem.tracking_type === 'CONSUMABLE' ? 'border-blue-200' : 'border-emerald-200'}`}
                                        placeholder="Select or Type..."
                                    />
                                    <datalist id="formCatList">{formCategories.map(c => <option key={c} value={c} />)}</datalist>
                                </div>
                                <div className="col-span-2">
                                    <label className={`text-[10px] font-bold block mb-1 uppercase ${newItem.tracking_type === 'CONSUMABLE' ? 'text-blue-800' : 'text-emerald-800'}`}>Item Name</label>
                                    <input list="formNameList" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} onFocus={e => e.target.select()} className={`w-full p-2.5 md:p-3 border rounded-md font-bold bg-white text-sm ${newItem.tracking_type === 'CONSUMABLE' ? 'border-blue-200' : 'border-emerald-200'}`} placeholder="Select/Type" />
                                    <datalist id="formNameList">{formItemNames.map(n => <option key={n} value={n} />)}</datalist>
                                </div>

                                <div className="col-span-1">
                                    <label className={`text-[10px] font-bold block mb-1 uppercase ${newItem.tracking_type === 'CONSUMABLE' ? 'text-blue-800' : 'text-emerald-800'}`}>Unit</label>
                                    <input list="formUnitList" value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })} onFocus={e => e.target.select()} className={`w-full p-2.5 md:p-3 border rounded-md font-bold bg-white text-sm ${newItem.tracking_type === 'CONSUMABLE' ? 'border-blue-200' : 'border-emerald-200'}`} />
                                    <datalist id="formUnitList">{defaultUnits.map(u => <option key={u} value={u} />)}</datalist>
                                </div>
                                <div className="col-span-1">
                                    <label className={`text-[10px] font-bold block mb-1 uppercase ${newItem.tracking_type === 'CONSUMABLE' ? 'text-blue-800' : 'text-emerald-800'}`}>Init. Q'ty</label>
                                    <input type="number" value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: e.target.value })} className={`w-full p-2.5 md:p-3 border rounded-md font-bold text-center bg-white text-sm ${newItem.tracking_type === 'CONSUMABLE' ? 'border-blue-200' : 'border-emerald-200'}`} placeholder="0" />
                                </div>
                                <div className="col-span-2">
                                    <label className={`text-[10px] font-bold block mb-1 uppercase ${newItem.tracking_type === 'CONSUMABLE' ? 'text-blue-800' : 'text-emerald-800'}`}>Unit Price (₱)</label>
                                    <input type="number" value={newItem.unit_price} onChange={e => setNewItem({ ...newItem, unit_price: e.target.value })} className={`w-full p-2.5 md:p-3 border rounded-md font-black text-right bg-white text-sm ${newItem.tracking_type === 'CONSUMABLE' ? 'border-blue-200 text-blue-700' : 'border-emerald-200 text-emerald-700'}`} placeholder="0" />
                                </div>
                            </div>

                            {/* 동적 렌더링 영역 (고정자산 vs 소모품) */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 items-end border-t border-black/5 pt-4 mt-2">
                                {newItem.tracking_type === 'ASSET' ? (
                                    <>
                                        <div className="col-span-2 md:col-span-1"><label className="text-[10px] font-bold text-emerald-800 block mb-1 uppercase">Purchase Date</label><input type="date" value={newItem.purchase_date} onChange={e => setNewItem({ ...newItem, purchase_date: e.target.value })} className="w-full p-2.5 md:p-3 border border-emerald-200 rounded-md font-bold bg-white text-xs md:text-sm" /></div>
                                        <div className="col-span-1"><label className="text-[10px] font-bold text-emerald-800 block mb-1 uppercase">Life(Yrs)</label><input type="number" value={newItem.useful_life} onChange={e => setNewItem({ ...newItem, useful_life: e.target.value })} className="w-full p-2.5 md:p-3 border border-emerald-200 rounded-md font-bold text-center bg-white text-sm" placeholder="e.g. 5" /></div>
                                        <div className="col-span-1"><label className="text-[10px] font-bold text-emerald-800 block mb-1 uppercase">Location</label><input type="text" value={newItem.location} onChange={e => setNewItem({ ...newItem, location: e.target.value })} className="w-full p-2.5 md:p-3 border border-emerald-200 rounded-md font-bold bg-white text-sm" placeholder="e.g. Room 501" /></div>
                                    </>
                                ) : (
                                    <>
                                        <div className="col-span-2 md:col-span-1"><label className="text-[10px] font-bold text-blue-800 block mb-1 uppercase">Supplier (Vendor)</label><input type="text" value={newItem.supplier} onChange={e => setNewItem({ ...newItem, supplier: e.target.value })} className="w-full p-2.5 md:p-3 border border-blue-200 rounded-md font-bold bg-white text-sm" placeholder="Vendor Name" /></div>
                                        <div className="col-span-1"><label className="text-[10px] font-bold text-red-500 block mb-1 uppercase">Min. Par Level</label><input type="number" value={newItem.min_stock} onChange={e => setNewItem({ ...newItem, min_stock: e.target.value })} className="w-full p-2.5 md:p-3 border border-red-300 rounded-md font-bold text-center bg-red-50 text-red-700 text-sm" placeholder="Safe Stock" /></div>
                                    </>
                                )}

                                <button onClick={handleAddItem} className={`col-span-2 md:col-span-1 lg:col-span-1 w-full text-white px-4 py-2.5 md:py-3 rounded-md font-black shadow-md transition-colors text-sm md:text-base ${newItem.tracking_type === 'CONSUMABLE' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                                    ➕ Save Record
                                </button>
                            </div>
                        </div>

                        {/* 하단 리스트 영역 */}
                        <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                            <table className="w-full text-left text-xs md:text-sm whitespace-nowrap min-w-[800px]">
                                <thead className="bg-slate-100 border-b text-slate-600">
                                    <tr>
                                        <th className="p-3 md:p-4">Type</th>
                                        <th className="p-3 md:p-4">Category</th>
                                        <th className="p-3 md:p-4">Item Name</th>
                                        <th className="p-3 md:p-4 text-center">Stock</th>
                                        <th className="p-3 md:p-4 text-center">Detail (Location / Par)</th>
                                        <th className="p-3 md:p-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                            <td className="p-3 md:p-4"><span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${item.tracking_type === 'ASSET' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{item.tracking_type || 'CONSUMABLE'}</span></td>
                                            <td className="p-3 md:p-4 font-bold text-slate-500">{item.category}</td>
                                            <td className="p-3 md:p-4 font-black text-slate-800">{item.name}</td>
                                            <td className="p-3 md:p-4"><div className="grid grid-cols-2 gap-2 items-baseline w-20 md:w-24 mx-auto"><span className="text-base md:text-lg font-black text-right text-slate-800">{item.quantity}</span><span className="text-[10px] md:text-xs font-bold text-slate-400 text-left">{item.unit}</span></div></td>
                                            <td className="p-3 md:p-4 text-center font-bold text-slate-500 text-xs">
                                                {item.tracking_type === 'ASSET' ? (item.location ? `📍 ${item.location}` : 'Unassigned') : `Min: ${item.min_stock}`}
                                            </td>
                                            <td className="p-3 md:p-4 text-center">
                                                <button onClick={() => { setEditingItem({ ...item, tracking_type: item.tracking_type || 'CONSUMABLE' }); setEditModalOpen(true); }} className="text-[10px] md:text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 md:px-3 py-1.5 rounded-md mr-2 transition-colors">Edit</button>
                                                <button onClick={() => handleDeleteItem(item.id)} className="text-red-500 hover:bg-red-50 font-bold px-2 md:px-3 py-1.5 rounded-md text-[10px] md:text-xs transition-colors">Del</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'MOVEMENT' && (
                    <div className="animate-fade-in flex justify-center items-center h-full pb-20 w-full px-2 md:px-0">
                        <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-2xl w-full max-w-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-3 bg-emerald-500"></div>
                            <h3 className="text-xl md:text-3xl font-black text-slate-800 mb-6 md:mb-8 text-center">Stock Action Terminal</h3>
                            <div className="space-y-4 md:space-y-6">
                                <div className="flex flex-col gap-4 bg-slate-50 p-4 md:p-5 rounded-md border border-slate-200">
                                    <div className="w-full"><label className="text-[10px] font-bold text-slate-500 block mb-1 md:mb-2 uppercase">1. Category</label><select value={moveCategory} onChange={e => { setMoveCategory(e.target.value); setStockMove({ ...stockMove, item_id: '', item_name: '' }) }} className="w-full p-3 md:p-4 border border-slate-300 rounded-md font-bold bg-white text-sm md:text-base"><option value="">All Categories</option>{uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                    <div className="w-full"><label className="text-[10px] font-bold text-emerald-600 block mb-1 md:mb-2 uppercase">2. Select Item Name</label><select value={stockMove.item_id} onChange={(e) => { const id = e.target.value; const item = items.find(i => String(i.id) === id); setStockMove({ ...stockMove, item_id: id, item_name: item ? item.name : '' }); }} className="w-full p-3 md:p-4 border-2 border-emerald-400 rounded-md font-black text-emerald-900 text-base md:text-lg bg-white shadow-sm"><option value="">-- Choose Item --</option>{movementFilteredItems.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.quantity})</option>)}</select></div>
                                </div>
                                {/* 💡 [수정] 3열 그리드를 4열로 변경하고 HISTORY 버튼 추가 */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                                    <button onClick={() => setStockMove({ ...stockMove, type: 'IN' })} className={`p-3 md:p-4 rounded-md font-black border-2 flex flex-col items-center gap-1 md:gap-2 transition-colors ${stockMove.type === 'IN' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}><span className="text-2xl md:text-3xl">📥</span> <span className="text-xs md:text-sm">IN</span></button>
                                    <button onClick={() => setStockMove({ ...stockMove, type: 'OUT' })} className={`p-3 md:p-4 rounded-md font-black border-2 flex flex-col items-center gap-1 md:gap-2 transition-colors ${stockMove.type === 'OUT' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}><span className="text-2xl md:text-3xl">📤</span> <span className="text-xs md:text-sm">OUT</span></button>
                                    <button onClick={() => setStockMove({ ...stockMove, type: 'WASTE' })} className={`p-3 md:p-4 rounded-md font-black border-2 flex flex-col items-center gap-1 md:gap-2 transition-colors ${stockMove.type === 'WASTE' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}><span className="text-2xl md:text-3xl">🗑️</span> <span className="text-xs md:text-sm">WASTE</span></button>
                                    <button onClick={() => { if (!stockMove.item_id) return alert('Please select an item first to view its history.'); setShowItemHistoryModal(true); }} className={`p-3 md:p-4 rounded-md font-black border-2 flex flex-col items-center gap-1 md:gap-2 transition-colors bg-slate-800 border-slate-700 text-white hover:bg-slate-700 shadow-md`}><span className="text-2xl md:text-3xl">📜</span> <span className="text-xs md:text-sm">HISTORY</span></button>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                                    <div className="w-full sm:w-1/3"><label className="text-[10px] font-bold text-slate-500 block mb-1 md:mb-2 uppercase">Qty</label><input type="number" value={stockMove.amount} onChange={e => setStockMove({ ...stockMove, amount: e.target.value })} className="w-full p-3 md:p-4 border-2 border-slate-200 rounded-md font-black text-xl md:text-2xl text-center focus:border-emerald-500 outline-none" placeholder="0" min="1" /></div>
                                    <div className="w-full sm:w-2/3"><label className="text-[10px] font-bold text-slate-500 block mb-1 md:mb-2 uppercase">Dept / Notes</label><input list="deptList" placeholder="e.g. Housekeeping" value={stockMove.department} onChange={e => setStockMove({ ...stockMove, department: e.target.value })} className="w-full p-3 md:p-4 border-2 border-slate-200 rounded-md text-sm md:text-base font-bold bg-slate-50 focus:border-emerald-500 outline-none" /><datalist id="deptList"><option value="Housekeeping" /><option value="Front Desk" /><option value="F&B" /><option value="Maintenance" /></datalist></div>
                                </div>
                                <button onClick={handleStockMove} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 md:py-5 rounded-md font-black text-lg md:text-xl shadow-lg mt-4 transition-transform active:scale-95">Confirm Transaction</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'FFE' && renderAssetRegister('FFE', 'Furniture, Fixtures & Equipment', '🛋️')}
                {activeTab === 'OSE' && renderAssetRegister('OSE', 'Operating Supplies & Equipment', '🧴')}
                {activeTab === 'IT' && renderAssetRegister('IT', 'IT & Office Equipment', '💻')}

            </div>

            {/* 💡 [개편] 아이템 편집 모달 (투트랙 대응) */}
            {editModalOpen && editingItem && (
                <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
                    <div className="bg-white rounded-md p-6 md:p-8 max-w-xl w-full shadow-2xl border border-slate-200 my-auto">
                        <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-6 flex justify-between items-center">
                            {editingItem.tracking_type === 'ASSET' ? '🏷️ Edit Fixed Asset' : '📦 Edit Consumable'}
                            <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-red-500 text-3xl focus:outline-none transition-colors">&times;</button>
                        </h2>

                        <div className="space-y-4 bg-slate-50 p-4 rounded-md border border-slate-100">
                            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                                <div className="w-full sm:w-1/3">
                                    <label className="text-[10px] md:text-xs font-bold text-slate-500 block mb-1 uppercase">Class</label>
                                    {/* 💡 [수정] 편집 모달에서도 직접 입력 가능하도록 변경 */}
                                    <input
                                        list="editAssetClassList"
                                        value={editingItem.asset_class || ''}
                                        onChange={e => setEditingItem({ ...editingItem, asset_class: e.target.value.toUpperCase() })}
                                        onFocus={e => e.target.select()}
                                        className="w-full p-2.5 md:p-3 border rounded-md font-bold bg-white text-sm uppercase"
                                        placeholder="Select or Type..."
                                    />
                                    <datalist id="editAssetClassList">
                                        <option value="FFE">FF&E</option><option value="OSE">OS&E</option><option value="IT">IT</option><option value="FB">F&B</option>
                                    </datalist>
                                </div>
                                <div className="w-full sm:w-2/3">
                                    <label className="text-[10px] md:text-xs font-bold text-slate-500 block mb-1 uppercase">Category</label>
                                    <input
                                        list="editCatList"
                                        value={editingItem.category || ''}
                                        onChange={e => setEditingItem({ ...editingItem, category: e.target.value })}
                                        className="w-full p-2.5 md:p-3 border rounded-md font-bold bg-white text-sm"
                                        placeholder="Select or Type..."
                                    />
                                    <datalist id="editCatList">{uniqueCategories.map(c => <option key={c} value={c} />)}</datalist>
                                </div>
                            </div>

                            <div><label className="text-[10px] md:text-xs font-bold text-slate-500 block mb-1 uppercase">Name</label><input value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} className="w-full p-2.5 md:p-3 border rounded-md font-bold bg-white text-sm" /></div>

                            <div className="grid grid-cols-2 gap-3 md:gap-4">
                                <div className="col-span-1"><label className="text-[10px] md:text-xs font-bold text-slate-500 block mb-1 uppercase">Unit</label><input list="formUnitList" value={editingItem.unit} onChange={e => setEditingItem({ ...editingItem, unit: e.target.value })} className="w-full p-2.5 md:p-3 border rounded-md font-bold bg-white text-sm" /></div>
                                <div className="col-span-1"><label className="text-[10px] md:text-xs font-bold text-slate-500 block mb-1 uppercase">Unit Price</label><input type="number" value={editingItem.unit_price} onChange={e => setEditingItem({ ...editingItem, unit_price: e.target.value })} className="w-full p-2.5 md:p-3 border rounded-md font-bold text-right bg-white text-sm" /></div>
                            </div>

                            {/* 동적 렌더링 영역 */}
                            {editingItem.tracking_type === 'ASSET' ? (
                                <div className="flex gap-3 md:gap-4 pt-2 border-t border-slate-200 mt-2">
                                    <div className="w-1/3"><label className="text-[10px] md:text-xs font-bold text-emerald-600 block mb-1 uppercase">Purchase Date</label><input type="date" value={editingItem.purchase_date ? editingItem.purchase_date.substring(0, 10) : ''} onChange={e => setEditingItem({ ...editingItem, purchase_date: e.target.value })} className="w-full p-2.5 md:p-3 border rounded-md font-bold bg-white text-xs md:text-sm" /></div>
                                    <div className="w-1/3"><label className="text-[10px] md:text-xs font-bold text-emerald-600 block mb-1 uppercase">Life(Yrs)</label><input type="number" value={editingItem.useful_life} onChange={e => setEditingItem({ ...editingItem, useful_life: e.target.value })} className="w-full p-2.5 md:p-3 border rounded-md font-bold text-center bg-white text-sm" /></div>
                                    <div className="w-1/3"><label className="text-[10px] md:text-xs font-bold text-emerald-600 block mb-1 uppercase">Location</label><input type="text" value={editingItem.location || ''} onChange={e => setEditingItem({ ...editingItem, location: e.target.value })} className="w-full p-2.5 md:p-3 border rounded-md font-bold bg-white text-sm" /></div>
                                </div>
                            ) : (
                                <div className="flex gap-3 md:gap-4 pt-2 border-t border-slate-200 mt-2">
                                    <div className="w-2/3"><label className="text-[10px] md:text-xs font-bold text-blue-600 block mb-1 uppercase">Supplier (Vendor)</label><input type="text" value={editingItem.supplier || ''} onChange={e => setEditingItem({ ...editingItem, supplier: e.target.value })} className="w-full p-2.5 md:p-3 border rounded-md font-bold bg-white text-sm" /></div>
                                    <div className="w-1/3"><label className="text-[10px] md:text-xs font-bold text-red-500 block mb-1 uppercase">Min Stock</label><input type="number" value={editingItem.min_stock} onChange={e => setEditingItem({ ...editingItem, min_stock: e.target.value })} className="w-full p-2.5 md:p-3 border border-red-200 rounded-md font-bold text-center bg-red-50 text-red-700 text-sm" /></div>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex gap-3 md:gap-4">
                            <button onClick={() => setEditModalOpen(false)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-md py-3.5 transition-colors text-sm md:text-base">Cancel</button>
                            <button onClick={handleUpdateItem} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-md font-black shadow-md transition-colors text-sm md:text-base">💾 Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}