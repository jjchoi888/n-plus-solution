import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { io } from 'socket.io-client';

export default function Finance() {
    const [activeTab, setActiveTab] = useState('DASHBOARD');
    const currentUserId = sessionStorage.getItem('userId') || 'ADMIN';
    const currentHotelCode = sessionStorage.getItem('hotelCode') || '';

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // --- 카테고리 상태 ---
    const [expenseCategories, setExpenseCategories] = useState([
        "Cost of Sales (F&B)", "Cost of Service (Room)", "Salaries & Wages",
        "SSS/PhilHealth/HDMF Cont.", "Rent Expense", "Utilities (Power & Water)",
        "Communication & Internet", "Repairs & Maintenance", "Taxes & Licenses",
        "Professional Fees", "Supplies (Office/Hotel)", "Marketing & Advertising",
        "Representation & Ent.", "Transportation & Travel", "Miscellaneous"
    ]);
    const [revenueCategories, setRevenueCategories] = useState([
        "Manual Cash Entry", "Down payment / Deposit", "Event Venue Fee", "Consulting / Other"
    ]);

    const [newCategoryInput, setNewCategoryInput] = useState('');
    const [isAddingCategory, setIsAddingCategory] = useState(false);

    const [newRevenueCategoryInput, setNewRevenueCategoryInput] = useState('');
    const [isAddingRevenueCategory, setIsAddingRevenueCategory] = useState(false);

    // --- 서버 데이터 상태 ---
    const [bankAccounts, setBankAccounts] = useState([]);
    const [bankHistory, setBankHistory] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [posStores, setPosStores] = useState([]);
    const [pointsAnalytics, setPointsAnalytics] = useState({
        summary: {
            issued_points: 0,
            used_points: 0,
            net_points: 0,
            points_payment_revenue: 0,
            points_payment_share_pct: 0
        },
        daily: []
    });

    const [receiptsData, setReceiptsData] = useState([]);

    // 영수증 양식 데이터
    const [receiptConfig, setReceiptConfig] = useState({ header_text: '', footer_text: '', vat_rate: 12, sc_rate: 10, logo_url: '' });

    // --- 입력 폼 상태 ---
    const [bankTx, setBankTx] = useState({ accountId: '', type: 'DEPOSIT', amount: '', description: '' });
    const [expenseTx, setExpenseTx] = useState({ category: expenseCategories[0], method: 'CASH', amount: '', vendor: '', description: '' });
    const [revenueTx, setRevenueTx] = useState({ category: revenueCategories[0], method: 'CASH', amount: '', source: '', description: '' });

    // --- 필터 상태 ---
    const [dashboardFilter, setDashboardFilter] = useState({ startDate: '', endDate: '', type: 'ALL', category: 'ALL', method: 'ALL' });
    const [revenueFilter, setRevenueFilter] = useState({ startDate: '', endDate: '', category: 'ALL', method: 'ALL' });
    const [expenseFilter, setExpenseFilter] = useState({ startDate: '', endDate: '', category: 'ALL', method: 'ALL' });
    const [bankFilter, setBankFilter] = useState({ accountId: 'ALL', type: 'ALL', startDate: '', endDate: '' });
    const [receiptFilter, setReceiptFilter] = useState({ startDate: '', endDate: '', department: 'ALL', searchNo: '' });

    const [vaultFilter, setVaultFilter] = useState({ startDate: '', endDate: '', department: 'ALL' });
    const [vaultTx, setVaultTx] = useState({ department: '', amount: '', description: '' });

    const [cashData, setCashData] = useState({ financeOffice: 0, frontOffice: 0, posDetails: [], bankDetails: [], bankTotal: 0, deptTotal: 0, grandTotal: 0 });
    const [baseFloats, setBaseFloats] = useState({});
    const [isEditingFloats, setIsEditingFloats] = useState(false);

    const [vaultDepartments, setVaultDepartments] = useState([]);
    const [vaultRemittances, setVaultRemittances] = useState([]);
    const [newVaultDept, setNewVaultDept] = useState('');

    const [selectedReceipt, setSelectedReceipt] = useState(null);

    const coreDepts = ["Finance Office", "Front Office", ...posStores.map(s => s.name)];
    const customDepts = vaultDepartments.map(d => d.name).filter(name => !coreDepts.includes(name));
    const allCombinedDepts = [...coreDepts, ...customDepts];

    // ==========================================
    // 💡 스마트 데이터 갱신 함수
    // ==========================================
    const fetchAllFinanceData = () => {
        fetch(`/api/bank-accounts?hotel=${currentHotelCode}`).then(res => res.json()).then(data => {
            if (data.length > 0) {
                setBankAccounts(data);
                setBankTx(prev => ({ ...prev, accountId: prev.accountId || data[0].id }));
            }
        }).catch(console.error);

        fetch(`/api/bank-transactions?hotel=${currentHotelCode}`).then(res => res.json()).then(setBankHistory).catch(() => { });

        fetch(`/api/finance/transactions?hotel=${currentHotelCode}`)
            .then(res => res.json())
            .then(data => {
                if (!Array.isArray(data)) return;
                data.sort((a, b) => b.id - a.id);

                const revSet = new Set(["Manual Cash Entry", "Down payment / Deposit", "Event Venue Fee", "Consulting / Other"]);
                const expSet = new Set(["Cost of Sales (F&B)", "Cost of Service (Room)", "Salaries & Wages", "SSS/PhilHealth/HDMF Cont.", "Rent Expense", "Utilities (Power & Water)", "Communication & Internet", "Repairs & Maintenance", "Taxes & Licenses", "Professional Fees", "Supplies (Office/Hotel)", "Marketing & Advertising", "Representation & Ent.", "Transportation & Travel", "Miscellaneous"]);

                const filteredData = data.filter(t => {
                    const descLower = (t.description || '').toLowerCase();
                    const catLower = (t.category || '').toLowerCase();
                    if (t.type === 'REVENUE' && descLower.includes('[ledger]') && (catLower.includes('deposit') || catLower.includes('downpayment') || catLower.includes('cash sales'))) return false;
                    return true;
                });

                filteredData.forEach(t => {
                    if (t.type === 'REVENUE' && t.category) {
                        const catLower = t.category.toLowerCase();
                        if (catLower.includes('deposit') || catLower.includes('downpayment') || catLower.includes('down payment')) t.category = 'Down payment / Deposit';
                        revSet.add(t.category);
                    }
                    if (t.type === 'EXPENSE' && t.category) expSet.add(t.category);
                });

                setTransactions(filteredData);
                setRevenueCategories(Array.from(revSet));
                setExpenseCategories(Array.from(expSet));
            }).catch(console.error);

        fetch(`/api/pos-stores?hotel=${currentHotelCode}`).then(res => res.json()).then(data => { if (Array.isArray(data)) setPosStores(data); }).catch(console.error);

        fetch(`/api/finance/cash-status?hotel=${currentHotelCode}`)
            .then(res => res.json())
            .then(setCashData)
            .catch(console.error);

        fetch(`/api/admin/rewards-analytics?hotel=${currentHotelCode}`)
            .then((res) => res.json())
            .then((data) => {
                if (data?.success) {
                    setPointsAnalytics({
                        summary: data.summary || {},
                        daily: Array.isArray(data.daily) ? data.daily : []
                    });
                }
            })
            .catch(() => {
                setPointsAnalytics({
                    summary: {
                        issued_points: 0,
                        used_points: 0,
                        net_points: 0,
                        points_payment_revenue: 0,
                        points_payment_share_pct: 0
                    },
                    daily: []
                });
            });

        fetch(`/api/vault/departments?hotel=${currentHotelCode}`).then(res => res.json()).then(setVaultDepartments).catch(console.error);
        fetch(`/api/vault/remittances?hotel=${currentHotelCode}`).then(res => res.json()).then(setVaultRemittances).catch(console.error);

        fetch(`/api/receipts?hotel=${currentHotelCode}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setReceiptsData(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
            })
            .catch(console.error);

        fetch(`/api/receipt-settings?hotel=${currentHotelCode}`)
            .then(res => res.json())
            .then(data => { if (data && data.id) setReceiptConfig(data); })
            .catch(console.error);
    };

    useEffect(() => {
        fetchAllFinanceData();

        if (!currentHotelCode) return;

        const socketUrl = import.meta.env.VITE_API_URL || 'https://api.hotelnplus.com';
        const socket = io(socketUrl, { transports: ['websocket'] });

        socket.on('db_updated', (data) => {
            if (data.hotel_code === currentHotelCode || data.hotel_code === 'ALL') {
                console.log("🔄 [Finance] Real-time financial data sync completed!");
                fetchAllFinanceData();
            }
        });

        return () => socket.disconnect();
    }, [currentHotelCode]);

    // --- 날짜 계산 ---
    const todayDate = new Date();
    const todayStr = todayDate.toISOString().split('T')[0];
    const monthStr = todayStr.substring(0, 7);

    // --- 통계 계산 ---
    const totalBalance = useMemo(() => bankAccounts.reduce((acc, curr) => acc + curr.balance, 0), [bankAccounts]);
    const revToday = transactions.filter((t) => t.type === 'REVENUE' && t.date === todayStr).reduce((a, c) => a + c.amount, 0);
    const revMonth = transactions.filter((t) => t.type === 'REVENUE' && t.date.startsWith(monthStr)).reduce((a, c) => a + c.amount, 0);
    const expToday = transactions.filter((t) => t.type === 'EXPENSE' && t.date === todayStr).reduce((a, c) => a + c.amount, 0);
    const expMonth = transactions.filter((t) => t.type === 'EXPENSE' && t.date.startsWith(monthStr)).reduce((a, c) => a + c.amount, 0);
    const netToday = revToday - expToday;
    const netMonth = revMonth - expMonth;

    const cashBalances = { "Front Desk": 0 };
    if (Array.isArray(posStores)) {
        posStores.forEach(s => {
            cashBalances[s.name] = 0;
            cashBalances[`POS ${s.location}`] = 0;
        });
    }

    let totalOnlineSales = 0;
    let totalCardSales = 0;

    if (Array.isArray(transactions)) {
        transactions.forEach(t => {
            const isRevenue = t.type === 'REVENUE';
            const desc = (t.description || '').toLowerCase();
            const cat = t.category || '';
            const amt = isRevenue ? (Number(t.amount) || 0) : -(Number(t.amount) || 0);

            // 💡 [수정] PaynPlus, Webhook, Guest App 결제는 돈통(현금)이 아니므로 카드/온라인 매출로 정확히 분리합니다!
            const catLower = (t.category || '').toLowerCase();
            const isCard = desc.includes('card') || desc.includes('cc open') || desc.includes('paynplus') || desc.includes('webhook');
            const isOnline = catLower.includes('web booking') || catLower.includes('webhook') || catLower.includes('guest app') || desc.includes('web booking') || desc.includes('agoda') || desc.includes('webhook');

            if (isRevenue && isOnline) {
                totalOnlineSales += (Number(t.amount) || 0);
            } else if (isRevenue && isCard) {
                totalCardSales += (Number(t.amount) || 0);
            } else if (!isCard && !isOnline) {
                if (cat && cat.startsWith('POS')) {
                    cashBalances[cat] = (cashBalances[cat] || 0) + amt;
                    const locNum = cat.replace('POS ', '');
                    const store = posStores?.find(s => String(s.location) === locNum);
                    if (store) cashBalances[store.name] = (cashBalances[store.name] || 0) + amt;
                } else if (posStores?.some(s => s.name === cat)) {
                    cashBalances[cat] = (cashBalances[cat] || 0) + amt;
                } else if (desc.includes('front desk') || cat === 'Manual Cash Entry' || cat.includes('Deposit')) {
                    cashBalances["Front Desk"] += amt;
                }
            }
        });
    }

    const totalCashBalance = Object.values(cashBalances).reduce((sum, val) => sum + val, 0);

    const posTypes = Array.from(new Set(posStores.map((s) => s.type)));

    const predefinedRevenues = [
        "Room Payment", "Room Service", "Other Revenue",
        "POS 1", "POS 2", "POS 3", "POS 4", "POS 5",
        ...posStores.map(s => s.name),
        ...posStores.map(s => `POS Sales (${s.name})`),
        ...revenueCategories
    ];

    const dynamicRevCats = Array.from(new Set([...predefinedRevenues, ...transactions.filter(t => t.type === 'REVENUE').map(t => t.category)]));
    const dynamicExpCats = Array.from(new Set([...expenseCategories, ...transactions.filter(t => t.type === 'EXPENSE').map(t => t.category)]));
    const uniqueCategories = [...new Set(transactions.map((t) => t.category))];
    const paymentMethodOptions = ['CASH', 'CARD', 'QR', 'POINTS'];
    const expenseMethodOptions = ['CASH', 'CARD', 'CHECK', 'BANK'];
    const financeMethodMeta = {
        CASH: { label: 'Cash', pill: 'bg-emerald-50 text-emerald-700 border border-emerald-200', amount: 'text-emerald-700' },
        CARD: { label: 'Card', pill: 'bg-violet-50 text-violet-700 border border-violet-200', amount: 'text-violet-700' },
        QR: { label: 'QR', pill: 'bg-sky-50 text-sky-700 border border-sky-200', amount: 'text-sky-700' },
        POINTS: { label: 'Points', pill: 'bg-amber-50 text-amber-700 border border-amber-200', amount: 'text-amber-700' },
        CHECK: { label: 'Check', pill: 'bg-rose-50 text-rose-700 border border-rose-200', amount: 'text-rose-700' },
        BANK: { label: 'Bank', pill: 'bg-indigo-50 text-indigo-700 border border-indigo-200', amount: 'text-indigo-700' },
    };
    const normalizeFinanceMethod = (t) => {
        const raw = String(t?.method || '').toUpperCase();
        const cat = String(t?.category || '').toLowerCase();
        const desc = String(t?.description || '').toLowerCase();

        const looksPoints = cat.includes('points') || desc.includes('reward points') || desc.includes('points_qr') || (desc.includes('used ') && desc.includes('pts'));
        const looksQr = cat.includes('qr') || desc.includes('qr pay') || desc.includes('(qr)') || desc.includes('gcash') || desc.includes('maya');
        const looksCard = cat.includes('card') || desc.includes('paynplus') || desc.includes('web booking') || cat.includes('room payment') || desc.includes('(card)') || desc.includes('visa') || desc.includes('mastercard');

        if (looksPoints) return 'POINTS';
        if (looksQr) return 'QR';
        if (looksCard) return 'CARD';
        if (paymentMethodOptions.includes(raw)) return raw;
        return 'CASH';
    };
    const paymentMethodStats = paymentMethodOptions.map((method) => ({
        method,
        total: transactions
            .filter((t) => t.type === 'REVENUE' && normalizeFinanceMethod(t) === method)
            .reduce((sum, t) => sum + Number(t.amount || 0), 0),
    }));
    const currentYearStr = todayStr.substring(0, 4);
    const isThisMonthDate = (dateValue) => String(dateValue || '').startsWith(monthStr);
    const isYearToDate = (dateValue) => String(dateValue || '').startsWith(currentYearStr);
    const sumTransactionAmount = (type, matcher) => transactions
        .filter((t) => t.type === type && matcher(t.date))
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const revenueMonthTotal = sumTransactionAmount('REVENUE', isThisMonthDate);
    const revenueYtdTotal = sumTransactionAmount('REVENUE', isYearToDate);
    const expenseMonthTotal = sumTransactionAmount('EXPENSE', isThisMonthDate);
    const expenseYtdTotal = sumTransactionAmount('EXPENSE', isYearToDate);
    const netMonthTotal = revenueMonthTotal - expenseMonthTotal;
    const netYtdTotal = revenueYtdTotal - expenseYtdTotal;

    const sumPointsDailyMetric = (metric, matcher) => {
        const rows = Array.isArray(pointsAnalytics?.daily) ? pointsAnalytics.daily : [];
        if (rows.length === 0) return 0;
        return rows
            .filter((row) => matcher(row.date))
            .reduce((sum, row) => sum + Number(row?.[metric] || 0), 0);
    };

    const pointsMonthSummary = {
        issued_points: sumPointsDailyMetric('issued_points', isThisMonthDate),
        used_points: sumPointsDailyMetric('used_points', isThisMonthDate),
        net_points: sumPointsDailyMetric('net_points', isThisMonthDate),
        points_payment_revenue: sumPointsDailyMetric('points_payment_revenue', isThisMonthDate),
    };

    const pointsYtdSummary = (() => {
        const ytd = {
            issued_points: sumPointsDailyMetric('issued_points', isYearToDate),
            used_points: sumPointsDailyMetric('used_points', isYearToDate),
            net_points: sumPointsDailyMetric('net_points', isYearToDate),
            points_payment_revenue: sumPointsDailyMetric('points_payment_revenue', isYearToDate),
        };
        const hasDaily = Array.isArray(pointsAnalytics?.daily) && pointsAnalytics.daily.length > 0;
        if (hasDaily) return ytd;
        return {
            issued_points: Number(pointsAnalytics?.summary?.issued_points || 0),
            used_points: Number(pointsAnalytics?.summary?.used_points || 0),
            net_points: Number(pointsAnalytics?.summary?.net_points || 0),
            points_payment_revenue: Number(pointsAnalytics?.summary?.points_payment_revenue || 0),
        };
    })();

    const paymentMethodBreakdownStats = paymentMethodOptions.map((method) => ({
        method,
        monthTotal: transactions
            .filter((t) => t.type === 'REVENUE' && normalizeFinanceMethod(t) === method && isThisMonthDate(t.date))
            .reduce((sum, t) => sum + Number(t.amount || 0), 0),
        ytdTotal: transactions
            .filter((t) => t.type === 'REVENUE' && normalizeFinanceMethod(t) === method && isYearToDate(t.date))
            .reduce((sum, t) => sum + Number(t.amount || 0), 0),
    }));
    const otherCategories = uniqueCategories.filter((c) => !dynamicRevCats.includes(c) && !dynamicExpCats.includes(c));

    const filteredDashboardTx = transactions.filter((t) => {
        if (dashboardFilter.type !== 'ALL' && t.type !== dashboardFilter.type) return false;
        if (dashboardFilter.category !== 'ALL' && t.category !== dashboardFilter.category) return false;
        if (dashboardFilter.method !== 'ALL' && normalizeFinanceMethod(t) !== dashboardFilter.method) return false;
        if (dashboardFilter.startDate && t.date < dashboardFilter.startDate) return false;
        if (dashboardFilter.endDate && t.date > dashboardFilter.endDate) return false;
        return true;
    });
    const dashboardTotal = filteredDashboardTx.reduce((sum, t) => sum + (t.type === 'REVENUE' ? t.amount : -t.amount), 0);

    const filteredRevenueTx = transactions.filter((t) => {
        if (t.type !== 'REVENUE') return false;
        if (revenueFilter.category !== 'ALL' && t.category !== revenueFilter.category) return false;
        if (revenueFilter.method !== 'ALL' && normalizeFinanceMethod(t) !== revenueFilter.method) return false;
        if (revenueFilter.startDate && t.date < revenueFilter.startDate) return false;
        if (revenueFilter.endDate && t.date > revenueFilter.endDate) return false;
        return true;
    });
    const revenueTotal = filteredRevenueTx.reduce((sum, t) => sum + t.amount, 0);

    const filteredExpenseTx = transactions.filter((t) => {
        if (t.type !== 'EXPENSE') return false;
        if (expenseFilter.category !== 'ALL' && t.category !== expenseFilter.category) return false;
        if (expenseFilter.method !== 'ALL' && String(t.method || 'CASH').toUpperCase() !== expenseFilter.method) return false;
        if (expenseFilter.startDate && t.date < expenseFilter.startDate) return false;
        if (expenseFilter.endDate && t.date > expenseFilter.endDate) return false;
        return true;
    });
    const expenseTotal = filteredExpenseTx.reduce((sum, t) => sum + t.amount, 0);

    const filteredBankHistory = bankHistory.filter((h) => {
        if (bankFilter.accountId !== 'ALL' && String(h.account_id) !== String(bankFilter.accountId)) return false;
        if (bankFilter.type !== 'ALL' && h.type !== bankFilter.type) return false;
        if (bankFilter.startDate && h.date < bankFilter.startDate) return false;
        if (bankFilter.endDate && h.date > bankFilter.endDate) return false;
        return true;
    });

    const filteredVaultHistory = vaultRemittances.filter((t) => {
        if (vaultFilter.department !== 'ALL' && t.department !== vaultFilter.department) return false;
        if (vaultFilter.startDate && t.date < vaultFilter.startDate) return false;
        if (vaultFilter.endDate && t.date > vaultFilter.endDate) return false;
        return true;
    });
    const vaultFilteredTotal = filteredVaultHistory.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const filteredReceipts = receiptsData.filter((r) => {
        if (receiptFilter.department !== 'ALL' && r.department !== receiptFilter.department) return false;
        if (receiptFilter.startDate && r.date < receiptFilter.startDate) return false;
        if (receiptFilter.endDate && r.date > receiptFilter.endDate) return false;
        if (receiptFilter.searchNo && !String(r.receipt_no || '').toLowerCase().includes(receiptFilter.searchNo.toLowerCase())) return false;
        return true;
    });

    const handleBankTransaction = async () => {
        if (!bankTx.amount || !bankTx.description) return alert("Please fill amount and description.");
        const targetAcc = bankAccounts.find((a) => String(a.id) === String(bankTx.accountId));

        const payload = {
            account_id: bankTx.accountId,
            bank_name: targetAcc ? `${targetAcc.bank} (${targetAcc.account_name})` : 'Unknown',
            type: bankTx.type,
            amount: parseFloat(bankTx.amount),
            description: bankTx.description,
            date: todayStr,
            hotel_code: currentHotelCode
        };

        try {
            await fetch('/api/bank-transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            alert(`Bank ${bankTx.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} Recorded!`);
            setBankTx({ accountId: bankTx.accountId, type: 'DEPOSIT', amount: '', description: '' });
            fetchAllFinanceData();
        } catch (e) { alert("Failed to record bank transaction. Please check server."); }
    };

    const handleAddExpense = async () => {
        if (!expenseTx.amount || !expenseTx.description) return alert("Please enter amount and description.");
        const payload = { date: todayStr, type: 'EXPENSE', category: expenseTx.category, method: expenseTx.method, amount: parseFloat(expenseTx.amount), description: `${expenseTx.vendor ? `[${expenseTx.vendor}] ` : ''}${expenseTx.description}`, user_id: currentUserId, hotel_code: currentHotelCode };
        await fetch('/api/finance/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        alert("Expense Recorded.");
        setExpenseTx({ category: expenseCategories[0], method: 'CASH', amount: '', vendor: '', description: '' });
        fetchAllFinanceData();
    };

    const handleAddCategory = () => {
        if (!newCategoryInput.trim()) return;
        if (dynamicExpCats.includes(newCategoryInput)) return alert("Category already exists.");
        setExpenseCategories([...expenseCategories, newCategoryInput]);
        setExpenseTx({ ...expenseTx, category: newCategoryInput });
        setNewCategoryInput('');
        setIsAddingCategory(false);
    };

    const handleAddRevenueCategory = () => {
        if (!newRevenueCategoryInput.trim()) return;
        if (dynamicRevCats.includes(newRevenueCategoryInput)) return alert("Category already exists.");
        setRevenueCategories([...revenueCategories, newRevenueCategoryInput]);
        setRevenueTx({ ...revenueTx, category: newRevenueCategoryInput });
        setNewRevenueCategoryInput('');
        setIsAddingRevenueCategory(false);
    };

    const handleAddRevenue = async () => {
        if (!revenueTx.amount || !revenueTx.description) return alert("Please enter amount and description.");
        const payload = { date: todayStr, type: 'REVENUE', category: revenueTx.category, method: revenueTx.method, amount: parseFloat(revenueTx.amount), description: `${revenueTx.source ? `[${revenueTx.source}] ` : ''}${revenueTx.description}`, user_id: currentUserId, hotel_code: currentHotelCode };
        await fetch('/api/finance/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        alert("Manual Revenue Recorded.");
        setRevenueTx({ category: revenueCategories[0], method: 'CASH', amount: '', source: '', description: '' });
        fetchAllFinanceData();
    };

    const handleAddVaultDept = async () => {
        if (!newVaultDept.trim()) return alert("Please enter a department name.");
        await fetch('/api/vault/departments', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newVaultDept, hotel_code: currentHotelCode })
        });
        alert("✅ Department added successfully!");
        setNewVaultDept('');
        fetch(`/api/vault/departments?hotel=${currentHotelCode}`).then(res => res.json()).then(setVaultDepartments);
    };

    const handleDeleteVaultDept = async (id) => {
        if (window.confirm("Are you sure you want to delete this department?")) {
            await fetch(`/api/vault/departments/${id}?hotel=${currentHotelCode}`, { method: 'DELETE' });
            alert("✅ Department deleted!");
            fetch(`/api/vault/departments?hotel=${currentHotelCode}`).then(res => res.json()).then(setVaultDepartments);
            if (vaultTx.department === id) setVaultTx({ ...vaultTx, department: '' });
        }
    };

    const handleSaveBaseFloats = () => {
        localStorage.setItem(`baseFloats_${currentHotelCode}`, JSON.stringify(baseFloats));
        alert("✅ Base floats saved successfully!");
        setIsEditingFloats(false);
    };

    const handleInputRemittance = async () => {
        if (!vaultTx.department || !vaultTx.amount) return alert("Please select a department and enter an amount.");
        await fetch('/api/vault/remittances', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ department: vaultTx.department, amount: vaultTx.amount, remarks: vaultTx.description, date: todayStr, hotel_code: currentHotelCode })
        });
        alert("✅ Remittance recorded successfully!");
        setVaultTx({ department: '', amount: '', description: '' });
        fetch(`/api/vault/remittances?hotel=${currentHotelCode}`).then(res => res.json()).then(setVaultRemittances);
    };

    const handleExportDashboardPDF = () => {
        if (filteredDashboardTx.length === 0) return alert('No data to export.');
        const doc = new jsPDF();
        doc.setFontSize(18); doc.text("Financial Ledger Report", 14, 22);
        doc.setFontSize(11); doc.setTextColor(100); doc.text(`Date Range: ${dashboardFilter.startDate || 'All'} to ${dashboardFilter.endDate || 'All'}`, 14, 30);
        autoTable(doc, { startY: 35, head: [["Date", "Type", "Method", "Category", "Description", "Amount"]], body: filteredDashboardTx.map((t) => [t.date, t.type, normalizeFinanceMethod(t), t.category, t.description, (t.type === 'REVENUE' ? '+' : '-') + t.amount.toLocaleString()]), styles: { fontSize: 9 } });
        doc.save(`Ledger_Report_${todayStr}.pdf`);
    };

    const handleMenuClick = (tabName) => {
        setActiveTab(tabName);
        setIsMobileMenuOpen(false);
    };

    return (
        <div className="flex flex-col md:flex-row h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden relative">

            {/* ========================================================= */}
            {/* 💡 [핵심] 영수증 뷰어 모달창 (백오피스 Receipt 양식 완벽 통일) */}
            {/* ========================================================= */}
            {selectedReceipt && (
                <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in font-mono">
                    <div className="w-full max-w-[400px] flex flex-col max-h-[95vh]">

                        {/* 외부 닫기 버튼 */}
                        <div className="flex justify-end mb-3">
                            <button onClick={() => setSelectedReceipt(null)} className="text-white hover:text-red-400 font-bold text-2xl transition-colors bg-white/10 hover:bg-white/20 w-10 h-10 rounded-md flex items-center justify-center">✕</button>
                        </div>

                        {/* 영수증 본체 (하얀 종이 영역, 지그재그 없이 깔끔한 모서리) */}
                        <div className="bg-white flex-1 overflow-y-auto p-8 text-slate-800 shadow-2xl rounded-md">

                            {/* 헤더 정보 */}
                            <div className="text-center mb-6">
                                {receiptConfig.logo_url ? (
                                    <img src={receiptConfig.logo_url} alt="Logo" className="h-12 mx-auto mb-3" />
                                ) : (
                                    <div className="text-5xl font-black mb-3 text-slate-800 tracking-tighter">n<span className="text-3xl">+</span></div>
                                )}
                                <h2 className="text-sm font-bold tracking-widest uppercase mb-1">{currentHotelCode || 'SAMPLE HOTEL INC.'}</h2>
                                <p className="text-[10px] text-slate-500 whitespace-pre-wrap leading-relaxed">
                                    {receiptConfig.header_text || '558 Gen. Malvar St. Manila City, Metro Manila\nBIZ: SC 25469985221 | TIN: 369852147'}
                                </p>
                            </div>

                            <div className="border-t border-dashed border-slate-300 my-4"></div>

                            {/* 영수증 기본 메타데이터 */}
                            <div className="space-y-2 text-[11px] mb-4 text-slate-700">
                                <div className="flex justify-between font-bold"><span className="text-slate-500">OR Number (Serial):</span><span className="text-blue-600">{selectedReceipt.receipt_no}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Date:</span><span>{selectedReceipt.date}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Issued By:</span><span>{selectedReceipt.department}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Guest/Ref:</span><span className="truncate max-w-[150px]">{selectedReceipt.guest_name || selectedReceipt.description}</span></div>
                            </div>

                            <div className="border-t border-dashed border-slate-300 my-4"></div>

                            {/* 구매 항목 리스트 */}
                            <div className="min-h-[80px] mb-4">
                                {(() => {
                                    let items = [];
                                    try { items = typeof selectedReceipt?.cart_data === 'string' ? JSON.parse(selectedReceipt.cart_data) : (selectedReceipt?.cart_data || []); } catch (e) { }

                                    if (!Array.isArray(items) || items.length === 0) {
                                        return (
                                            <div className="flex justify-between text-[11px] mb-2 text-slate-700">
                                                <span className="truncate pr-2 flex-1">{selectedReceipt?.description || 'Payment'}</span>
                                                {/* 💡 방어 코드 추가 */}
                                                <span className="whitespace-nowrap font-bold text-right">₱{Number(selectedReceipt?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        );
                                    }

                                    return items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-[11px] mb-2 text-slate-700">
                                            <span className="truncate pr-2 flex-1">{item?.name} {item?.selectedSize && item?.selectedSize !== 'Regular' ? `(${item.selectedSize})` : ''}</span>
                                            {/* 💡 방어 코드 추가 */}
                                            <span className="whitespace-nowrap font-bold text-right w-24">x{item?.quantity || 1} ₱{((item?.price || 0) * (item?.quantity || 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    ));
                                })()}
                            </div>

                            <div className="border-t border-dashed border-slate-300 my-4"></div>

                            {/* 합계 및 세금 정보 역산 로직 */}
                            {(() => {
                                let items = [];
                                try { items = typeof selectedReceipt?.cart_data === 'string' ? JSON.parse(selectedReceipt.cart_data) : (selectedReceipt?.cart_data || []); } catch (e) { }

                                let rawSubtotal = 0;
                                if (Array.isArray(items) && items.length > 0) {
                                    rawSubtotal = items.reduce((sum, item) => sum + ((item?.price || 0) * (item?.quantity || 1)), 0);
                                } else {
                                    // 💡 방어 코드 추가
                                    rawSubtotal = (selectedReceipt?.amount || 0) / (1 + ((receiptConfig?.sc_rate || 0) / 100)); // 항목이 없을 경우 부가세/봉사료 역산
                                }

                                const vatRate = (receiptConfig?.vat_rate || 0) / 100;
                                const serviceCharge = rawSubtotal * ((receiptConfig?.sc_rate || 0) / 100);
                                const vatableSales = rawSubtotal / (1 + vatRate);
                                const vatAmount = rawSubtotal - vatableSales;
                                const finalAmount = selectedReceipt?.amount || 0;

                                return (
                                    <>
                                        <div className="space-y-2 text-[11px] text-slate-500 mb-4">
                                            <div className="flex justify-between"><span>Subtotal:</span><span>₱{(rawSubtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                            <div className="flex justify-between"><span>VAT ({receiptConfig?.vat_rate || 12}%):</span><span>₱{(vatAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                            <div className="flex justify-between"><span>Srv. Charge ({receiptConfig?.sc_rate || 10}%):</span><span>₱{(serviceCharge || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                        </div>
                                        <div className="flex justify-between items-center text-slate-900 mb-6">
                                            <span className="font-bold tracking-widest text-sm">TOTAL :</span>
                                            <span className="font-bold text-lg">₱{Number(finalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </>
                                );
                            })()}

                            {/* 푸터 */}
                            <div className="text-center text-[10px] text-slate-400 pt-4 pb-2">
                                <p className="whitespace-pre-wrap">{receiptConfig?.footer_text || 'Thank you for choosing us!'}</p>
                                <p className="mt-4 tracking-[0.3em] font-bold opacity-30">|| ||| || ||| || ||</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* 💡 모바일 헤더 */}
            <div className="md:hidden flex justify-between items-center bg-yellow-600 text-white p-4 shrink-0 shadow-md z-40">
                <h1 className="text-xl font-black tracking-wider">FINANCE PRO</h1>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-yellow-700 rounded-md focus:outline-none">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}></path></svg>
                </button>
            </div>

            {isMobileMenuOpen && (
                <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
            )}

            {/* 🔹 Sidebar Navigation */}
            <div className={`fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-40 w-64 bg-yellow-600 text-white flex flex-col shadow-2xl shrink-0`}>
                <div className="p-6 border-b border-yellow-500 hidden md:block">
                    <h1 className="text-2xl font-black tracking-wider text-white">FINANCE PRO</h1>
                    <p className="text-yellow-100 text-xs mt-1">CFO Control Panel</p>
                </div>
                <div className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <button onClick={() => handleMenuClick('DASHBOARD')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'DASHBOARD' ? 'bg-yellow-800 text-white shadow-lg' : 'hover:bg-yellow-500 text-yellow-50'}`}>📊 Dashboard</button>
                    <button onClick={() => handleMenuClick('BANKING')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'BANKING' ? 'bg-yellow-800 text-white shadow-lg' : 'hover:bg-yellow-500 text-yellow-50'}`}>🏦 Bank Accounts</button>
                    <button onClick={() => handleMenuClick('VAULT')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'VAULT' ? 'bg-yellow-800 text-white shadow-lg' : 'hover:bg-yellow-500 text-yellow-50'}`}>🗄️ Master Cash Ledger</button>
                    <button onClick={() => handleMenuClick('REVENUE')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'REVENUE' ? 'bg-yellow-800 text-white shadow-lg' : 'hover:bg-yellow-500 text-yellow-50'}`}>📈 Revenue Ledger</button>
                    <button onClick={() => handleMenuClick('RECEIPTS')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'RECEIPTS' ? 'bg-yellow-800 text-white shadow-lg' : 'hover:bg-yellow-500 text-yellow-50'}`}>🧾 Receipt Box</button>
                    <button onClick={() => handleMenuClick('EXPENSE')} className={`w-full text-left px-4 py-3 rounded-md font-bold transition-all ${activeTab === 'EXPENSE' ? 'bg-yellow-800 text-white shadow-lg' : 'hover:bg-yellow-500 text-yellow-50'}`}>💸 Expense Manager</button>
                </div>

                <div className="p-6 bg-yellow-700/30 m-4 rounded-md space-y-4">
                    <div>
                        <div className="text-[10px] text-yellow-200 uppercase tracking-widest">Total Online / Web</div>
                        <div className="text-xl md:text-2xl font-black text-blue-200 truncate">₱{(totalOnlineSales || 0).toLocaleString()}</div>
                    </div>
                    <div className="border-t border-yellow-600/50 pt-3">
                        <div className="text-[10px] text-yellow-200 uppercase tracking-widest">Total Card Sales</div>
                        <div className="text-xl md:text-2xl font-black text-white truncate">₱{(totalCardSales || 0).toLocaleString()}</div>
                    </div>
                    <div className="border-t border-yellow-600/50 pt-3">
                        <div className="text-[10px] text-yellow-200 uppercase tracking-widest">Total Cash in Drawers</div>
                        <div className="text-xl md:text-2xl font-black text-green-300 truncate">₱{(totalCashBalance || 0).toLocaleString()}</div>
                        <div className="text-[9px] text-yellow-100 mt-1 opacity-80">(Front Desk + POS)</div>
                    </div>
                </div>

                <div className="p-4 border-t border-yellow-500 mt-auto"><Link to="/" className="block w-full text-center bg-yellow-800 hover:bg-yellow-700 py-3 rounded-md font-bold transition-all text-sm shadow-md">🏠 Return to Main</Link></div>
            </div>

            {/* 🔹 Main Content Area */}
            <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full">

                {/* ==========================================
            💡 1. DASHBOARD TAB 
        ========================================== */}
                {activeTab === 'DASHBOARD' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
                                <div className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Total Revenue</div>
                                <div className="mt-6 border-t border-slate-200 pt-5 space-y-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <span className="text-sm font-semibold text-slate-500 uppercase tracking-[0.12em]">This Month</span>
                                        <span className="text-3xl md:text-[42px] font-black tracking-tight text-blue-600 text-right">₱{revenueMonthTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-start justify-between gap-4">
                                        <span className="text-sm font-semibold text-slate-500 uppercase tracking-[0.12em]">Year to Date</span>
                                        <span className="text-2xl md:text-[34px] font-black tracking-tight text-blue-500 text-right">₱{revenueYtdTotal.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
                                <div className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Total Expense</div>
                                <div className="mt-6 border-t border-slate-200 pt-5 space-y-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <span className="text-sm font-semibold text-slate-500 uppercase tracking-[0.12em]">This Month</span>
                                        <span className="text-3xl md:text-[42px] font-black tracking-tight text-red-600 text-right">₱{expenseMonthTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-start justify-between gap-4">
                                        <span className="text-sm font-semibold text-slate-500 uppercase tracking-[0.12em]">Year to Date</span>
                                        <span className="text-2xl md:text-[34px] font-black tracking-tight text-red-500 text-right">₱{expenseYtdTotal.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
                                <div className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Net Profit</div>
                                <div className="mt-6 border-t border-slate-200 pt-5 space-y-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <span className="text-sm font-semibold text-slate-500 uppercase tracking-[0.12em]">This Month</span>
                                        <span className="text-3xl md:text-[42px] font-black tracking-tight text-emerald-600 text-right">₱{netMonthTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-start justify-between gap-4">
                                        <span className="text-sm font-semibold text-slate-500 uppercase tracking-[0.12em]">Year to Date</span>
                                        <span className="text-2xl md:text-[34px] font-black tracking-tight text-emerald-500 text-right">₱{netYtdTotal.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl shadow border border-slate-200">
                            <h3 className="text-3xl font-black text-slate-800 mb-4">Payment Method Breakdown</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                {paymentMethodBreakdownStats.map((row) => {
                                    const meta = financeMethodMeta[row.method];
                                    return (
                                        <div key={row.method} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                            <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${meta.pill}`}>{meta.label}</div>
                                            <div className="mt-4 space-y-3">
                                                <div className="flex items-start justify-between gap-4">
                                                    <span className="text-sm font-semibold text-slate-500 uppercase tracking-[0.12em]">This Month</span>
                                                    <span className={`text-2xl md:text-4xl font-black text-right ${meta.amount}`}>₱{Number(row.monthTotal || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-start justify-between gap-4">
                                                    <span className="text-sm font-semibold text-slate-500 uppercase tracking-[0.12em]">Year to Date</span>
                                                    <span className={`text-xl md:text-3xl font-black text-right ${meta.amount}`}>₱{Number(row.ytdTotal || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl shadow border border-slate-200">
                            <h3 className="text-3xl font-black text-slate-800 mb-4">Rewards / Points Settlement Overview</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Issued Points</div>
                                    <div className="mt-4 space-y-3">
                                        <div className="flex items-start justify-between gap-4">
                                            <span className="text-sm font-semibold text-emerald-600 uppercase tracking-[0.12em]">This Month</span>
                                            <span className="text-2xl md:text-4xl font-black text-emerald-700 text-right">{Number(pointsMonthSummary.issued_points || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-start justify-between gap-4">
                                            <span className="text-sm font-semibold text-emerald-600 uppercase tracking-[0.12em]">Year to Date</span>
                                            <span className="text-xl md:text-3xl font-black text-emerald-700 text-right">{Number(pointsYtdSummary.issued_points || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Used Points</div>
                                    <div className="mt-4 space-y-3">
                                        <div className="flex items-start justify-between gap-4">
                                            <span className="text-sm font-semibold text-red-600 uppercase tracking-[0.12em]">This Month</span>
                                            <span className="text-2xl md:text-4xl font-black text-red-700 text-right">{Number(pointsMonthSummary.used_points || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-start justify-between gap-4">
                                            <span className="text-sm font-semibold text-red-600 uppercase tracking-[0.12em]">Year to Date</span>
                                            <span className="text-xl md:text-3xl font-black text-red-700 text-right">{Number(pointsYtdSummary.used_points || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Net Points</div>
                                    <div className="mt-4 space-y-3">
                                        <div className="flex items-start justify-between gap-4">
                                            <span className="text-sm font-semibold text-blue-600 uppercase tracking-[0.12em]">This Month</span>
                                            <span className="text-2xl md:text-4xl font-black text-blue-700 text-right">{Number(pointsMonthSummary.net_points || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-start justify-between gap-4">
                                            <span className="text-sm font-semibold text-blue-600 uppercase tracking-[0.12em]">Year to Date</span>
                                            <span className="text-xl md:text-3xl font-black text-blue-700 text-right">{Number(pointsYtdSummary.net_points || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Points Payment Revenue</div>
                                    <div className="mt-4 space-y-3">
                                        <div className="flex items-start justify-between gap-4">
                                            <span className="text-sm font-semibold text-violet-600 uppercase tracking-[0.12em]">This Month</span>
                                            <span className="text-2xl md:text-4xl font-black text-violet-700 text-right">₱{Number(pointsMonthSummary.points_payment_revenue || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-start justify-between gap-4">
                                            <span className="text-sm font-semibold text-violet-600 uppercase tracking-[0.12em]">Year to Date</span>
                                            <span className="text-xl md:text-3xl font-black text-violet-700 text-right">₱{Number(pointsYtdSummary.points_payment_revenue || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                            <div className="p-6 flex items-center justify-between gap-4">
                                <h3 className="text-4xl font-black text-slate-800 flex items-center gap-3">📔 Detailed Ledger</h3>
                                <button onClick={handleExportDashboardPDF} className="rounded-lg bg-slate-800 px-5 py-3 text-sm font-bold text-white hover:bg-slate-900">📄 Export PDF</button>
                            </div>
                            <div className="px-6 pb-6">
                                <div className="rounded-xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-6 gap-4 bg-slate-50">
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Start Date</label>
                                        <input type="date" value={dashboardFilter.startDate} onChange={(e) => setDashboardFilter({ ...dashboardFilter, startDate: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">End Date</label>
                                        <input type="date" value={dashboardFilter.endDate} onChange={(e) => setDashboardFilter({ ...dashboardFilter, endDate: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Type</label>
                                        <select value={dashboardFilter.type} onChange={(e) => setDashboardFilter({ ...dashboardFilter, type: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3">
                                            <option value="ALL">All Types</option>
                                            <option value="REVENUE">Revenue</option>
                                            <option value="EXPENSE">Expense</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Category</label>
                                        <select value={dashboardFilter.category} onChange={(e) => setDashboardFilter({ ...dashboardFilter, category: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3">
                                            <option value="ALL">All Categories</option>
                                            {uniqueCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Method</label>
                                        <select value={dashboardFilter.method} onChange={(e) => setDashboardFilter({ ...dashboardFilter, method: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3">
                                            <option value="ALL">All Methods</option>
                                            {paymentMethodOptions.map((method) => <option key={method} value={method}>{financeMethodMeta[method].label}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-end">
                                        <button onClick={() => setDashboardFilter({ startDate: '', endDate: '', type: 'ALL', category: 'ALL', method: 'ALL' })} className="w-full rounded-lg bg-slate-200 px-4 py-3 font-bold text-slate-700 hover:bg-slate-300">Clear</button>
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-auto border-t border-slate-200">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-100 text-slate-500 uppercase text-xs tracking-[0.18em]">
                                        <tr>
                                            <th className="px-6 py-4 text-left">Date</th>
                                            <th className="px-6 py-4 text-left">Type</th>
                                            <th className="px-6 py-4 text-left">Method</th>
                                            <th className="px-6 py-4 text-left">Category</th>
                                            <th className="px-6 py-4 text-left">Description</th>
                                            <th className="px-6 py-4 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="bg-emerald-50 border-b border-emerald-100">
                                            <td colSpan="5" className="px-6 py-4 text-right text-base font-black tracking-[0.12em] text-emerald-700 uppercase">Filtered Search Result Total :</td>
                                            <td className="px-6 py-4 text-right text-4xl font-black text-emerald-600">{dashboardTotal >= 0 ? '+' : '-'}₱{Math.abs(dashboardTotal).toLocaleString()}</td>
                                        </tr>
                                        {filteredDashboardTx.map((t) => {
                                            const method = normalizeFinanceMethod(t);
                                            const methodMeta = financeMethodMeta[method];
                                            return (
                                                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                                                    <td className="px-6 py-4">{t.date}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${t.type === 'REVENUE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{t.type}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${methodMeta.pill}`}>{methodMeta.label}</span>
                                                    </td>
                                                    <td className="px-6 py-4">{t.category}</td>
                                                    <td className="px-6 py-4">{t.description}</td>
                                                    <td className={`px-6 py-4 text-right text-2xl font-black ${t.type === 'REVENUE' ? 'text-blue-600' : 'text-red-600'}`}>{t.type === 'REVENUE' ? '+' : '-'}₱{Number(t.amount || 0).toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==========================================
                    💡 MASTER VAULT (현금 원장) TAB
                ========================================== */}
                {activeTab === 'VAULT' && (
                    <div className="animate-fade-in w-full max-w-7xl mx-auto pb-20">
                        <div className="mb-8">
                            <h2 className="text-2xl md:text-3xl font-black text-slate-800">Master Cash Ledger</h2>
                            <p className="text-sm font-bold text-slate-500 mt-1">Manage custom departments, base floats, and daily cash remittances.</p>
                        </div>

                        <div className="bg-white p-6 md:p-8 rounded-md shadow-sm border border-slate-200 mb-8">

                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><span>🏬</span> Department Float Management</h3>

                                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                                    <div className="flex bg-slate-50 border border-slate-200 rounded-md overflow-hidden">
                                        <input type="text" value={newVaultDept} onChange={e => setNewVaultDept(e.target.value)} placeholder="New Dept Name..." className="p-2 text-sm outline-none bg-transparent font-bold w-36" />
                                        <button onClick={handleAddVaultDept} className="bg-slate-800 text-white px-3 text-xs font-bold hover:bg-slate-700 transition-colors">Add</button>
                                    </div>

                                    {isEditingFloats ? (
                                        <button onClick={handleSaveBaseFloats} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md text-sm font-bold transition-colors shadow-md">
                                            💾 Save Floats
                                        </button>
                                    ) : (
                                        <button onClick={() => setIsEditingFloats(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-5 py-2 rounded-md text-sm font-bold transition-colors border border-slate-200 shadow-sm">
                                            ⚙️ Edit Base Floats
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-x-auto mb-8 min-h-[150px]">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Department Name</th>
                                            <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Base Float</th>
                                            <th className="p-4 font-bold text-blue-500 uppercase tracking-wider text-xs text-right">Cash Sales (Live)</th>
                                            <th className="p-4 font-black text-slate-800 uppercase tracking-wider text-xs text-right">Expected Drawer</th>
                                            {isEditingFloats && <th className="p-4 text-center">Delete</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(allCombinedDepts || []).map((deptName, idx) => {
                                            let currentSales = 0;
                                            if (deptName === 'Front Office') currentSales = cashData?.frontOffice || 0;
                                            else if (deptName === 'Finance Office') currentSales = cashData?.financeOffice || 0;
                                            else {
                                                const posMatch = (cashData?.posDetails || []).find(p => p.name === deptName);
                                                if (posMatch) currentSales = posMatch.balance || 0;
                                            }

                                            const isCustom = (customDepts || []).includes(deptName);
                                            const customDeptObj = (vaultDepartments || []).find(d => d.name === deptName);

                                            return (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 font-black text-slate-800 flex items-center gap-2">
                                                        {deptName}
                                                        {isCustom && <span className="text-[9px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-wider">Custom</span>}
                                                    </td>
                                                    <td className="p-4 text-right font-bold text-slate-500">
                                                        {isEditingFloats ? (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <span>₱</span>
                                                                <input type="number" value={baseFloats[deptName] ?? 0} onChange={(e) => setBaseFloats({ ...baseFloats, [deptName]: Number(e.target.value) })} className="w-24 p-1.5 border border-slate-300 rounded-md text-right focus:ring-2 focus:ring-blue-500 outline-none" />
                                                            </div>
                                                        ) : (
                                                            `₱ ${(baseFloats[deptName] ?? 0).toLocaleString()}`
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-right font-black text-blue-600">+ ₱ {(currentSales || 0).toLocaleString()}</td>
                                                    <td className="p-4 text-right font-black text-slate-800">₱ {((currentSales || 0) + (baseFloats[deptName] ?? 0)).toLocaleString()}</td>
                                                    {isEditingFloats && (
                                                        <td className="p-4 text-center">
                                                            {isCustom ? (
                                                                <button onClick={() => handleDeleteVaultDept(customDeptObj?.id)} className="text-red-500 font-bold bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition-colors">Del</button>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-1 rounded">Auto Linked</span>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-md border border-slate-200">
                                <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Record Daily Remittance (Cash Drop)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div className="w-full">
                                        <label className="text-xs font-bold text-slate-500 block mb-2 uppercase">Select Department</label>
                                        <select value={vaultTx.department} onChange={(e) => setVaultTx({ ...vaultTx, department: e.target.value })} className="w-full p-3 border border-slate-300 rounded-md font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none">
                                            <option value="">Select Dept...</option>
                                            {(allCombinedDepts || []).map((dept, idx) => <option key={idx} value={dept}>{dept}</option>)}
                                        </select>
                                    </div>
                                    <div className="w-full">
                                        <label className="text-xs font-bold text-slate-500 block mb-2 uppercase">Amount (PHP)</label>
                                        <input type="number" value={vaultTx.amount} onChange={(e) => setVaultTx({ ...vaultTx, amount: e.target.value })} placeholder="0.00" className="w-full p-3 border border-slate-300 rounded-md font-black text-emerald-600 text-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                                    </div>
                                    <div className="w-full">
                                        <label className="text-xs font-bold text-slate-500 block mb-2 uppercase">Remarks / Staff Name</label>
                                        <input type="text" value={vaultTx.description} onChange={(e) => setVaultTx({ ...vaultTx, description: e.target.value })} placeholder="e.g. Evening Drop" className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none" />
                                    </div>
                                    <div className="w-full">
                                        <button onClick={handleInputRemittance} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-black shadow-md transition-transform active:scale-95 h-[52px] text-base">
                                            📥 Input Remittance
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 md:p-8 rounded-md shadow-sm border border-slate-200">
                            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4"><span>🔎</span> Remittance Log (History)</h3>

                            <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-6 bg-slate-50 p-4 rounded-md border border-slate-200">
                                <div className="w-full md:flex-1"><label className="text-xs font-bold text-slate-500 block mb-1">Start Date</label><input type="date" value={vaultFilter.startDate} onChange={(e) => setVaultFilter({ ...vaultFilter, startDate: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                                <div className="w-full md:flex-1"><label className="text-xs font-bold text-slate-500 block mb-1">End Date</label><input type="date" value={vaultFilter.endDate} onChange={(e) => setVaultFilter({ ...vaultFilter, endDate: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                                <div className="w-full md:flex-1">
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Department</label>
                                    <select value={vaultFilter.department} onChange={(e) => setVaultFilter({ ...vaultFilter, department: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                        <option value="ALL">All Departments</option>
                                        {(allCombinedDepts || []).map((dept, idx) => <option key={idx} value={dept}>{dept}</option>)}
                                    </select>
                                </div>
                                <div className="w-full md:w-auto flex items-end mt-2 md:mt-0">
                                    <button onClick={() => setVaultFilter({ startDate: '', endDate: '', department: 'ALL' })} className="w-full px-5 py-2.5 text-sm font-bold text-slate-500 bg-slate-200 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">Clear</button>
                                </div>
                            </div>

                            <div className="overflow-x-auto max-h-[400px] border border-slate-200 rounded-t-2xl shadow-inner bg-slate-50">
                                <table className="w-full text-left text-sm whitespace-nowrap min-w-[500px]">
                                    <thead className="bg-white sticky top-0 shadow-sm z-10">
                                        <tr>
                                            <th className="p-3 md:p-4 text-slate-500 font-bold uppercase tracking-wider rounded-tl-2xl">Date & Time</th>
                                            <th className="p-3 md:p-4 text-slate-500 font-bold uppercase tracking-wider">Department</th>
                                            <th className="p-3 md:p-4 text-slate-500 font-bold uppercase tracking-wider">Remarks</th>
                                            <th className="p-3 md:p-4 text-right text-slate-500 font-bold uppercase tracking-wider rounded-tr-2xl">Remitted Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {(!filteredVaultHistory || filteredVaultHistory.length === 0) ? (
                                            <tr><td colSpan="4" className="text-center py-10 md:py-16 text-slate-400 font-bold bg-white">No remittance logs found for this period.</td></tr>
                                        ) : (
                                            filteredVaultHistory.map((t) => (
                                                <tr key={t.id} className="hover:bg-slate-100 transition-colors bg-white">
                                                    <td className="p-3 md:p-4 font-mono text-slate-500 text-xs md:text-sm">{t.timestamp}</td>
                                                    <td className="p-3 md:p-4 font-bold text-slate-700 text-xs md:text-sm">{t.department}</td>
                                                    <td className="p-3 md:p-4 text-slate-600 text-xs md:text-sm truncate max-w-[200px]">{t.remarks}</td>
                                                    <td className="p-3 md:p-4 text-right font-black text-emerald-600 text-sm md:text-base">₱{Number(t?.amount || 0).toLocaleString()}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-emerald-50 border-t border-emerald-200 p-4 md:p-5 flex justify-between items-center rounded-b-3xl">
                                <span className="text-emerald-800 font-bold uppercase tracking-wider text-xs md:text-sm">Filtered Period Total</span>
                                <span className="text-xl md:text-2xl font-black text-emerald-600 truncate">₱{(vaultFilteredTotal || 0).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==========================================
            💡 2. BANKING TAB
        ========================================== */}
                {activeTab === 'BANKING' && (
                    <div className="animate-fade-in space-y-6 md:space-y-8 pb-20 w-full max-w-7xl mx-auto">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl md:text-3xl font-black text-slate-800">Bank & Cash Management</h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                            {(bankAccounts || []).map((acc) => (
                                <div key={acc.id} className="bg-white p-5 md:p-6 rounded-md shadow-sm border border-slate-200 relative overflow-hidden">
                                    <div className={`absolute top-0 right-0 p-4 opacity-10 text-5xl md:text-6xl font-black ${acc.bank === 'BDO' ? 'text-blue-900' : 'text-slate-900'}`}>{acc.bank}</div>
                                    <div className="relative z-10">
                                        <p className="text-xs md:text-sm text-slate-500 font-bold uppercase tracking-wider">{acc.type} Account</p>
                                        <h3 className="text-xl md:text-2xl font-black text-slate-800 mt-1">{acc.bank}</h3>
                                        <p className="text-slate-400 font-mono text-xs md:text-sm mt-1">{acc.account_name}</p>
                                        <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-slate-100">
                                            <p className="text-[10px] md:text-xs text-slate-400 uppercase">Current Balance</p>
                                            <p className="text-2xl md:text-3xl font-black text-blue-600 truncate">₱{(acc.balance || 0).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white p-5 md:p-8 rounded-md shadow-sm border border-slate-200">
                            <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 flex items-center gap-2">📝 Record Bank Transaction</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-end">
                                <div className="w-full">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Select Account</label>
                                    <select value={bankTx.accountId} onChange={(e) => setBankTx({ ...bankTx, accountId: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-300 rounded-md font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400">
                                        {(bankAccounts || []).map((acc) => <option key={acc.id} value={acc.id}>{acc.bank} - {acc.account_name}</option>)}
                                    </select>
                                </div>
                                <div className="w-full">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Transaction Type</label>
                                    <div className="flex bg-slate-100 p-1 rounded-md">
                                        <button onClick={() => setBankTx({ ...bankTx, type: 'DEPOSIT' })} className={`flex-1 py-2 rounded-md font-bold text-xs md:text-sm transition-all ${bankTx.type === 'DEPOSIT' ? 'bg-green-500 text-white shadow' : 'text-slate-500 hover:bg-slate-200'}`}>Deposit (+)</button>
                                        <button onClick={() => setBankTx({ ...bankTx, type: 'WITHDRAW' })} className={`flex-1 py-2 rounded-md font-bold text-xs md:text-sm transition-all ${bankTx.type === 'WITHDRAW' ? 'bg-red-500 text-white shadow' : 'text-slate-500 hover:bg-slate-200'}`}>Withdraw (-)</button>
                                    </div>
                                </div>
                                <div className="w-full">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Amount (PHP)</label>
                                    <input type="number" value={bankTx.amount} onChange={(e) => setBankTx({ ...bankTx, amount: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-300 rounded-md font-bold text-base md:text-lg text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="0.00" />
                                </div>
                                <div className="w-full">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Description / Remarks</label>
                                    <input type="text" value={bankTx.description} onChange={(e) => setBankTx({ ...bankTx, description: e.target.value })} className="w-full p-2.5 md:p-3 border border-slate-300 rounded-md text-slate-800 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="e.g. Daily Sales Deposit" />
                                </div>
                            </div>
                            <div className="mt-6 flex md:justify-end w-full">
                                <button onClick={handleBankTransaction} className="w-full md:w-auto bg-slate-900 text-white px-8 py-3.5 md:py-3 rounded-md font-bold shadow-lg hover:bg-slate-800 transition-all text-sm md:text-base">Submit Transaction</button>
                            </div>
                        </div>

                        <div className="bg-white p-5 md:p-8 rounded-md shadow-sm border border-slate-200">
                            <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-slate-800 flex items-center gap-2"><span>🏦</span> Bank Transaction History</h3>
                            <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-6 bg-slate-50 p-4 rounded-md border border-slate-200">
                                <div className="w-full md:flex-1"><label className="text-xs font-bold text-slate-500 block mb-1">Start Date</label><input type="date" value={bankFilter.startDate} onChange={(e) => setBankFilter({ ...bankFilter, startDate: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md bg-white text-sm font-bold focus:outline-none" /></div>
                                <div className="w-full md:flex-1"><label className="text-xs font-bold text-slate-500 block mb-1">End Date</label><input type="date" value={bankFilter.endDate} onChange={(e) => setBankFilter({ ...bankFilter, endDate: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md bg-white text-sm font-bold focus:outline-none" /></div>
                                <div className="w-full md:w-40"><label className="text-xs font-bold text-slate-500 block mb-1">Bank Account</label><select value={bankFilter.accountId} onChange={(e) => setBankFilter({ ...bankFilter, accountId: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md bg-white text-sm font-bold focus:outline-none"><option value="ALL">All Accounts</option>{(bankAccounts || []).map((acc) => <option key={acc.id} value={acc.id}>{acc.bank}</option>)}</select></div>
                                <div className="w-full md:w-32"><label className="text-xs font-bold text-slate-500 block mb-1">Purpose</label><select value={bankFilter.type} onChange={(e) => setBankFilter({ ...bankFilter, type: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md bg-white text-sm font-bold focus:outline-none"><option value="ALL">All Types</option><option value="DEPOSIT">Deposit (+)</option><option value="WITHDRAW">Withdraw (-)</option></select></div>
                                <div className="w-full md:w-auto flex items-end mt-2 md:mt-0"><button onClick={() => setBankFilter({ accountId: 'ALL', type: 'ALL', startDate: '', endDate: '' })} className="w-full px-4 py-2.5 text-sm font-bold text-slate-500 bg-slate-200 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">Clear</button></div>
                            </div>

                            <div className="overflow-x-auto max-h-[400px] border border-slate-200 rounded-md shadow-inner bg-slate-50">
                                <table className="w-full text-left text-sm whitespace-nowrap min-w-[500px]">
                                    <thead className="bg-white sticky top-0 shadow-sm z-10">
                                        <tr><th className="p-3 md:p-4 text-slate-500 font-bold uppercase tracking-wider rounded-tl-2xl">Date</th><th className="p-3 md:p-4 text-slate-500 font-bold uppercase tracking-wider">Type</th><th className="p-3 md:p-4 text-slate-500 font-bold uppercase tracking-wider">Category</th><th className="p-3 md:p-4 text-slate-500 font-bold uppercase tracking-wider">Description</th><th className="p-3 md:p-4 text-right text-slate-500 font-bold uppercase tracking-wider rounded-tr-2xl">Amount</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {(!filteredBankHistory || filteredBankHistory.length === 0) ? (
                                            <tr><td colSpan="5" className="text-center py-10 md:py-16 text-slate-400 font-bold bg-white">No history found.</td></tr>
                                        ) : (
                                            filteredBankHistory.map((h) => (
                                                <tr key={h.id} className="hover:bg-slate-100 transition-colors bg-white">
                                                    <td className="p-3 md:p-4 font-mono text-slate-500 text-[10px] md:text-xs">{h.timestamp}</td>
                                                    <td className="p-3 md:p-4 font-bold text-slate-700 text-xs md:text-sm">{h.bank_name}</td>
                                                    <td className="p-3 md:p-4"><span className={`px-2 py-1 rounded-md text-[9px] md:text-[10px] font-bold ${h.type === 'DEPOSIT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{h.type}</span></td>
                                                    <td className="p-3 md:p-4 text-slate-600 text-xs md:text-sm max-w-[150px] truncate">{h.description}</td>
                                                    <td className={`p-3 md:p-4 text-right font-black text-sm md:text-base ${h.type === 'DEPOSIT' ? 'text-green-600' : 'text-red-600'}`}>{h.type === 'DEPOSIT' ? '+' : '-'}₱{(h?.amount || 0).toLocaleString()}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==========================================
            💡 3. REVENUE LEDGER TAB 
        ========================================== */}
                {activeTab === 'REVENUE' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white rounded-xl shadow border border-slate-200 p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="h-14 w-14 rounded-2xl bg-amber-100 flex items-center justify-center text-2xl">💰</div>
                                <div>
                                    <h3 className="text-4xl font-black text-slate-800">Manual Revenue Entry</h3>
                                    <p className="text-slate-500 text-sm mt-1">Record additional revenue and tag it by payment method for dashboard analytics.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Revenue Category</label>
                                    <select value={revenueTx.category} onChange={(e) => setRevenueTx({ ...revenueTx, category: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3">
                                        {revenueCategories.map((c) => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Method</label>
                                    <select value={revenueTx.method} onChange={(e) => setRevenueTx({ ...revenueTx, method: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3">
                                        {paymentMethodOptions.map((method) => <option key={method} value={method}>{financeMethodMeta[method].label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Source / Guest</label>
                                    <input value={revenueTx.source} onChange={(e) => setRevenueTx({ ...revenueTx, source: e.target.value })} placeholder="e.g. John Doe, Event Name" className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</label>
                                    <input value={revenueTx.description} onChange={(e) => setRevenueTx({ ...revenueTx, description: e.target.value })} placeholder="Details..." className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Amount (PHP)</label>
                                    <input type="number" step="0.01" value={revenueTx.amount} onChange={(e) => setRevenueTx({ ...revenueTx, amount: e.target.value })} placeholder="0.00" className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3" />
                                </div>
                                <div>
                                    <button onClick={handleAddRevenue} className="w-full rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700">Record Revenue</button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-200 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                                <div>
                                    <h3 className="text-4xl font-black text-slate-800">Ledger History</h3>
                                    <p className="text-slate-500 mt-1 text-sm">Full-width revenue history with category and payment method filters.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 w-full xl:w-auto xl:min-w-[900px]">
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Start Date</label>
                                        <input type="date" value={revenueFilter.startDate} onChange={(e) => setRevenueFilter({ ...revenueFilter, startDate: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">End Date</label>
                                        <input type="date" value={revenueFilter.endDate} onChange={(e) => setRevenueFilter({ ...revenueFilter, endDate: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Category</label>
                                        <select value={revenueFilter.category} onChange={(e) => setRevenueFilter({ ...revenueFilter, category: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3">
                                            <option value="ALL">All Revenues</option>
                                            {[...dynamicRevCats, ...otherCategories].map((c) => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Method</label>
                                        <select value={revenueFilter.method} onChange={(e) => setRevenueFilter({ ...revenueFilter, method: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3">
                                            <option value="ALL">All Methods</option>
                                            {paymentMethodOptions.map((method) => <option key={method} value={method}>{financeMethodMeta[method].label}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-end">
                                        <button onClick={() => setRevenueFilter({ startDate: '', endDate: '', category: 'ALL', method: 'ALL' })} className="w-full rounded-lg bg-slate-200 px-4 py-3 font-bold text-slate-700 hover:bg-slate-300">Clear</button>
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-100 text-slate-500 uppercase text-xs tracking-[0.18em]">
                                        <tr>
                                            <th className="px-6 py-4 text-left">Date</th>
                                            <th className="px-6 py-4 text-left">Method</th>
                                            <th className="px-6 py-4 text-left">Category</th>
                                            <th className="px-6 py-4 text-left">Description</th>
                                            <th className="px-6 py-4 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRevenueTx.map((t) => {
                                            const method = normalizeFinanceMethod(t);
                                            const meta = financeMethodMeta[method];
                                            return (
                                                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                                                    <td className="px-6 py-4">{t.date}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${meta.pill}`}>{meta.label}</span>
                                                    </td>
                                                    <td className="px-6 py-4">{t.category}</td>
                                                    <td className="px-6 py-4">{t.description}</td>
                                                    <td className={`px-6 py-4 text-right text-2xl font-black ${meta.amount}`}>₱{Number(t.amount || 0).toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="border-t border-slate-200 bg-blue-50 px-6 py-5 flex items-center justify-between">
                                <div className="text-2xl font-black uppercase tracking-[0.18em] text-blue-700">Filtered Revenue Total</div>
                                <div className="text-4xl font-black text-blue-600">₱{revenueTotal.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==========================================
            💡 [신규] RECEIPTS (영수증 보관함) TAB 
        ========================================== */}
                {activeTab === 'RECEIPTS' && (
                    <div className="animate-fade-in w-full max-w-7xl mx-auto space-y-6 pb-20">
                        <div className="mb-6">
                            <h2 className="text-2xl md:text-3xl font-black text-slate-800">Receipt Box</h2>
                            <p className="text-sm font-bold text-slate-500 mt-1">Archive of all digital receipts issued by Front Desk and POS systems.</p>
                        </div>

                        <div className="flex flex-col md:flex-row gap-3 md:gap-4 bg-white p-4 md:p-6 rounded-md shadow-sm border border-slate-200 mb-6">
                            <div className="w-full md:flex-1">
                                <label className="text-xs font-bold text-slate-500 block mb-1">Start Date</label>
                                <input type="date" value={receiptFilter.startDate} onChange={(e) => setReceiptFilter({ ...receiptFilter, startDate: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md bg-slate-50 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="w-full md:flex-1">
                                <label className="text-xs font-bold text-slate-500 block mb-1">End Date</label>
                                <input type="date" value={receiptFilter.endDate} onChange={(e) => setReceiptFilter({ ...receiptFilter, endDate: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md bg-slate-50 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="w-full md:flex-1">
                                <label className="text-xs font-bold text-slate-500 block mb-1">Department</label>
                                <select value={receiptFilter.department} onChange={(e) => setReceiptFilter({ ...receiptFilter, department: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md bg-slate-50 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="ALL">All Departments</option>
                                    <option value="Front Desk">Front Desk</option>
                                    {(posStores || []).map(s => <option key={s.id} value={`POS ${s.name}`}>POS - {s.name}</option>)}
                                </select>
                            </div>
                            <div className="w-full md:flex-1">
                                <label className="text-xs font-bold text-slate-500 block mb-1">Search Receipt No.</label>
                                <input type="text" placeholder="e.g. REC-12345" value={receiptFilter.searchNo} onChange={(e) => setReceiptFilter({ ...receiptFilter, searchNo: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-md bg-slate-50 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="w-full md:w-auto flex items-end mt-2 md:mt-0">
                                <button onClick={() => setReceiptFilter({ startDate: '', endDate: '', department: 'ALL', searchNo: '' })} className="w-full px-5 py-2.5 text-sm font-bold text-slate-500 bg-slate-100 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">Clear Filter</button>
                            </div>
                        </div>

                        <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto min-h-[400px] max-h-[600px]">
                                <table className="w-full text-left text-sm whitespace-nowrap min-w-[700px]">
                                    <thead className="bg-slate-50 border-b sticky top-0 z-10">
                                        <tr>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Receipt No.</th>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Issued By</th>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Details / Guest</th>
                                            <th className="p-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Total Amount</th>
                                            <th className="p-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(!filteredReceipts || filteredReceipts.length === 0) ? (
                                            <tr><td colSpan="6" className="text-center py-16 text-slate-400 font-bold text-base">No receipts found for the selected criteria.</td></tr>
                                        ) : (
                                            filteredReceipts.map((r, idx) => (
                                                <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                                                    <td className="p-4 font-mono text-slate-500 text-xs md:text-sm">{r.date}</td>
                                                    <td className="p-4 font-black text-slate-700">{r.receipt_no}</td>
                                                    <td className="p-4"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200">{r.department || 'General'}</span></td>
                                                    <td className="p-4 text-slate-600 text-sm truncate max-w-[200px]">{r.description || r.guest_name || 'N/A'}</td>
                                                    <td className="p-4 text-right font-black text-slate-800 text-base">₱{Number(r?.amount || 0).toLocaleString()}</td>
                                                    <td className="p-4 text-center">
                                                        <button onClick={() => setSelectedReceipt(r)} className="text-blue-500 font-bold hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors text-xs">
                                                            View Receipt
                                                        </button>
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

                {/* ==========================================
            💡 5. EXPENSE MANAGER TAB
        ========================================== */}
                {activeTab === 'EXPENSE' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white rounded-xl shadow border border-slate-200 p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="h-14 w-14 rounded-2xl bg-red-100 flex items-center justify-center text-2xl">💸</div>
                                <div>
                                    <h3 className="text-4xl font-black text-slate-800">Manual Expense Entry</h3>
                                    <p className="text-slate-500 text-sm mt-1">Record manual expenses and tag each entry by payment method for finance analytics.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Expense Category</label>
                                    <div className="flex gap-2">
                                        <select value={expenseTx.category} onChange={(e) => setExpenseTx({ ...expenseTx, category: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3">
                                            {(dynamicExpCats || []).map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                                        </select>
                                        <button onClick={() => setIsAddingCategory(!isAddingCategory)} className="mt-2 rounded-lg bg-slate-200 px-4 py-3 font-bold text-slate-600 hover:bg-slate-300">+</button>
                                    </div>
                                    {isAddingCategory && (
                                        <div className="flex gap-2 animate-fade-in mt-2">
                                            <input type="text" placeholder="New Category Name" value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} className="flex-1 p-2 border border-red-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-red-500" />
                                            <button onClick={handleAddCategory} className="bg-red-600 hover:bg-red-500 text-white px-3 rounded-md text-xs md:text-sm font-bold transition-colors">Add</button>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Method</label>
                                    <select value={expenseTx.method} onChange={(e) => setExpenseTx({ ...expenseTx, method: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3">
                                        {expenseMethodOptions.map((methodKey) => (
                                            <option key={methodKey} value={methodKey}>{financeMethodMeta[methodKey]?.label || methodKey}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Vendor / Payee</label>
                                    <input value={expenseTx.vendor} onChange={(e) => setExpenseTx({ ...expenseTx, vendor: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3" placeholder="e.g. Meralco, Supplier Inc." />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</label>
                                    <input value={expenseTx.description} onChange={(e) => setExpenseTx({ ...expenseTx, description: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3" placeholder="Details..." />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Amount (PHP)</label>
                                    <input type="number" step="0.01" value={expenseTx.amount} onChange={(e) => setExpenseTx({ ...expenseTx, amount: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3" placeholder="0.00" />
                                </div>

                                <div className="flex items-end">
                                    <button onClick={handleAddExpense} className="w-full rounded-lg bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700">Record Expense</button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-200 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                                <div>
                                    <h3 className="text-4xl font-black text-slate-800">Ledger History</h3>
                                    <p className="text-slate-500 mt-1 text-sm">Full-width expense history with category and payment method filters.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 w-full xl:w-auto xl:min-w-[900px]">
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Start Date</label>
                                        <input type="date" value={expenseFilter.startDate} onChange={(e) => setExpenseFilter({ ...expenseFilter, startDate: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">End Date</label>
                                        <input type="date" value={expenseFilter.endDate} onChange={(e) => setExpenseFilter({ ...expenseFilter, endDate: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Category</label>
                                        <select value={expenseFilter.category} onChange={(e) => setExpenseFilter({ ...expenseFilter, category: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3">
                                            <option value="ALL">All Categories</option>
                                            {(dynamicExpCats || []).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Method</label>
                                        <select value={expenseFilter.method} onChange={(e) => setExpenseFilter({ ...expenseFilter, method: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3">
                                            <option value="ALL">All Methods</option>
                                            {expenseMethodOptions.map((methodKey) => (
                                                <option key={methodKey} value={methodKey}>{financeMethodMeta[methodKey]?.label || methodKey}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-end">
                                        <button onClick={() => setExpenseFilter({ startDate: '', endDate: '', category: 'ALL', method: 'ALL' })} className="w-full rounded-lg bg-slate-200 px-4 py-3 font-bold text-slate-700 hover:bg-slate-300">Clear</button>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-100 text-slate-500 uppercase text-xs tracking-[0.18em]">
                                        <tr>
                                            <th className="px-6 py-4 text-left">Date</th>
                                            <th className="px-6 py-4 text-left">Method</th>
                                            <th className="px-6 py-4 text-left">Category</th>
                                            <th className="px-6 py-4 text-left">Description</th>
                                            <th className="px-6 py-4 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(!filteredExpenseTx || filteredExpenseTx.length === 0) ? (
                                            <tr><td colSpan="5" className="text-center py-16 text-slate-400 font-bold text-base">No expense records found.</td></tr>
                                        ) : (
                                            filteredExpenseTx.map((t) => {
                                                const methodKey = String(t.method || 'CASH').toUpperCase();
                                                const methodMeta = financeMethodMeta[methodKey] || financeMethodMeta.CASH;
                                                return (
                                                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                                                        <td className="px-6 py-4">{t.date}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${methodMeta.pill}`}>
                                                                {methodMeta.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">{t.category}</td>
                                                        <td className="px-6 py-4">{t.description}</td>
                                                        <td className="px-6 py-4 text-right text-2xl font-black text-red-600">-₱{Number(t?.amount || 0).toLocaleString()}</td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="border-t border-slate-200 bg-red-50 px-6 py-5 flex items-center justify-between">
                                <div className="text-2xl font-black uppercase tracking-[0.18em] text-red-700">Filtered Expense Total</div>
                                <div className="text-4xl font-black text-red-600">₱{Number(expenseTotal || 0).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}







