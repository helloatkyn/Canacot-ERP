// ==========================================
// MOBILE CHARTS — Bills & Products
// ==========================================
const CHART_COLORS = {
    navy:      '#112d60',
    blue:      '#1b4fb8',
    lightBlue: '#3b7dd8',
    accent:    '#60a5fa',
    grid:      'rgba(17,45,96,0.07)',
    tooltipBg: '#112d60',
};

let _billsChartInst    = null;
let _productsChartInst = null;

function renderBillsChart() {
    const canvas   = document.getElementById('bills-chart');
    const emptyMsg = document.getElementById('bills-chart-empty');
    const badge    = document.getElementById('bills-total-badge');
    if (!canvas || typeof Chart === 'undefined') return;

    const records = BillingModule.state.savedRecords;
    badge.textContent = `${records.length} bill${records.length !== 1 ? 's' : ''}`;

    if (records.length === 0) {
        canvas.style.display   = 'none';
        emptyMsg.style.display = 'block';
        return;
    }
    canvas.style.display   = '';
    emptyMsg.style.display = 'none';

    const labels = [], amounts = [];
    for (let i = 6; i >= 0; i--) {
        const d      = new Date();
        d.setDate(d.getDate() - i);
        const label  = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const dayStr = d.toDateString();
        const total  = records
            .filter(r => new Date(r.date).toDateString() === dayStr)
            .reduce((sum, r) => sum + r.grand, 0);
        labels.push(label);
        amounts.push(total);
    }

    if (_billsChartInst) { _billsChartInst.destroy(); _billsChartInst = null; }

    _billsChartInst = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Revenue (₹)',
                data: amounts,
                borderColor:          CHART_COLORS.accent,
                backgroundColor:      'rgba(96,165,250,0.12)',
                borderWidth:          2.5,
                pointBackgroundColor: CHART_COLORS.blue,
                pointBorderColor:     '#fff',
                pointBorderWidth:     2,
                pointRadius:          5,
                pointHoverRadius:     7,
                fill:                 true,
                tension:              0.4,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: CHART_COLORS.tooltipBg,
                    titleColor: 'rgba(255,255,255,0.7)',
                    bodyColor: '#fff',
                    bodyFont: { weight: '700', size: 13 },
                    padding: 10, cornerRadius: 8,
                    callbacks: { label: ctx => ` ₹${ctx.parsed.y.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
                }
            },
            scales: {
                x: { grid: { color: CHART_COLORS.grid }, ticks: { color: '#5a6a7e', font: { size: 11, weight: '600' } } },
                y: { grid: { color: CHART_COLORS.grid }, ticks: { color: '#5a6a7e', font: { size: 11 }, callback: v => '₹' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v) }, beginAtZero: true }
            }
        }
    });
}

function renderProductsChart() {
    const canvas   = document.getElementById('products-chart');
    const emptyMsg = document.getElementById('products-chart-empty');
    const badge    = document.getElementById('products-count-badge');
    if (!canvas || typeof Chart === 'undefined') return;

    const products = ProductsModule.state.products.slice(0, 10);
    badge.textContent = `${ProductsModule.state.products.length} product${ProductsModule.state.products.length !== 1 ? 's' : ''}`;

    if (products.length === 0) {
        canvas.style.display   = 'none';
        emptyMsg.style.display = 'block';
        return;
    }
    canvas.style.display   = '';
    emptyMsg.style.display = 'none';

    const labels   = products.map(p => p.name.length > 14 ? p.name.slice(0, 12) + '…' : p.name);
    const prices   = products.map(p => p.price);
    const bgColors = products.map((_, i) => `rgba(27,79,184,${Math.max(0.85 - (i * 0.06), 0.3)})`);

    if (_productsChartInst) { _productsChartInst.destroy(); _productsChartInst = null; }

    _productsChartInst = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Price (₹)',
                data: prices,
                backgroundColor: bgColors,
                borderColor: CHART_COLORS.navy,
                borderWidth: 0,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: CHART_COLORS.tooltipBg,
                    titleColor: 'rgba(255,255,255,0.7)',
                    bodyColor: '#fff',
                    bodyFont: { weight: '700', size: 13 },
                    padding: 10, cornerRadius: 8,
                    callbacks: { label: ctx => ` ₹${ctx.parsed.y.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#5a6a7e', font: { size: 11, weight: '600' } } },
                y: { grid: { color: CHART_COLORS.grid }, ticks: { color: '#5a6a7e', font: { size: 11 }, callback: v => '₹' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v) }, beginAtZero: true }
            }
        }
    });
}

// ==========================================
// BILLING MODULE — Business Logic, Analytics, UI
// ==========================================
const BillingModule = {
    state: {
        currentTab: 'new-bill',
        currentBill: { customer: { name: '', mobile: '', address: '' }, items: [], notes: '', isEditing: false, editingId: null },
        savedRecords: [],
        invoiceCounter: 1,
        searchQuery: '',
        autocomplete: { activeIndex: -1, targetInput: null, matches: [] },
        analyticsRange: 30,
        charts: {}
    },

    DOM: {},

    // --- UTILS ---
    escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    },
    formatCurrency(amount) {
        const num = parseFloat(amount);
        if (isNaN(num) || !isFinite(num)) return '0.00';
        return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    formatNumber(num) {
        const n = parseFloat(num);
        if (isNaN(n) || !isFinite(n)) return '0';
        return n % 1 === 0 ? n.toString() : n.toFixed(2);
    },
    generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    },

    // --- ANALYTICS FUNCTIONS (Pure) ---
    getSalesSummary(bills, rangeDays) {
        const filtered = this.filterBillsByRange(bills, rangeDays);
        let totalSales = 0, itemsSold = 0;
        const productSales = {};
        
        filtered.forEach(b => {
            totalSales += (b.grand || 0);
            b.items.forEach(i => {
                itemsSold += (i.qty || 0);
                productSales[i.item] = (productSales[i.item] || 0) + (i.total || 0);
            });
        });

        let topProduct = null, topSales = 0;
        for (const [name, sales] of Object.entries(productSales)) {
            if (sales > topSales) { topSales = sales; topProduct = name; }
        }

        return {
            totalSales,
            totalBills: filtered.length,
            averageBill: filtered.length > 0 ? totalSales / filtered.length : 0,
            itemsSold,
            topProduct
        };
    },

    getSalesTrend(bills, rangeDays) {
        const filtered = this.filterBillsByRange(bills, rangeDays);
        const days = rangeDays === 0 ? this.getAllDays(filtered) : this.getLastNDays(rangeDays);
        const trend = days.map(d => ({ date: d, sales: 0, bills: 0 }));
        const dateMap = new Map(trend.map(t => [t.date, t]));

        filtered.forEach(b => {
            const d = new Date(b.savedAt || b.date).toISOString().split('T')[0];
            if (dateMap.has(d)) {
                const entry = dateMap.get(d);
                entry.sales += (b.grand || 0);
                entry.bills += 1;
            }
        });
        return trend;
    },

    getProductSalesBreakdown(bills, rangeDays) {
        const filtered = this.filterBillsByRange(bills, rangeDays);
        const map = {};
        let total = 0;
        filtered.forEach(b => {
            b.items.forEach(i => {
                const sales = (i.qty || 0) * (i.price || 0);
                map[i.item] = map[i.item] || { item: i.item, sales: 0, quantity: 0 };
                map[i.item].sales += sales;
                map[i.item].quantity += (i.qty || 0);
                total += sales;
            });
        });
        return Object.values(map)
            .sort((a, b) => b.sales - a.sales)
            .map(p => ({ ...p, percentage: total > 0 ? (p.sales / total) * 100 : 0 }));
    },

    filterBillsByRange(bills, rangeDays) {
        if (rangeDays === 0) return bills;
        const cutoff = Date.now() - (rangeDays * 24 * 60 * 60 * 1000);
        return bills.filter(b => (b.savedAt || new Date(b.date).getTime()) >= cutoff);
    },

    getLastNDays(n) {
        const days = [];
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
        }
        return days;
    },

    getAllDays(bills) {
        if (bills.length === 0) return this.getLastNDays(30);
        let min = Date.now();
        bills.forEach(b => { const t = b.savedAt || new Date(b.date).getTime(); if (t < min) min = t; });
        const days = [];
        const current = new Date(min);
        const end = new Date();
        while (current <= end) {
            days.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
        return days;
    },

    // --- CHART RENDERING ---
    initCharts() {
        if (typeof Chart === 'undefined') return;
        
        const colors = ['#112d60', '#1b4fb8', '#2563eb', '#3b7dd8', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];
        Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        Chart.defaults.color = '#5a6a7e';

        // Trend Chart
        const ctxTrend = document.getElementById('chart-trend');
        if (ctxTrend) {
            this.state.charts.trend = new Chart(ctxTrend, {
                type: 'line',
                data: { labels: [], datasets: [{ label: 'Sales', data: [], borderColor: '#1b4fb8', backgroundColor: 'rgba(27,79,184,0.1)', fill: true, tension: 0.3, pointRadius: 3 }] },
                options: { responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#f0f0f0' } }, x: { grid: { display: false } } } }
            });
        }

        // Doughnut Chart
        const ctxDoughnut = document.getElementById('chart-doughnut');
        if (ctxDoughnut) {
            this.state.charts.doughnut = new Chart(ctxDoughnut, {
                type: 'doughnut',
                data: { labels: [], datasets: [{ data: [], backgroundColor: colors, borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } } }, cutout: '65%' }
            });
        }

        // Bar Chart
        const ctxBar = document.getElementById('chart-bar');
        if (ctxBar) {
            this.state.charts.bar = new Chart(ctxBar, {
                type: 'bar',
                data: { labels: [], datasets: [{ label: 'Sales', data: [], backgroundColor: '#1b4fb8', borderRadius: 4 }] },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#f0f0f0' } }, y: { grid: { display: false } } } }
            });
        }
    },

    updateCharts() {
        if (typeof Chart === 'undefined') return;
        const bills = this.state.savedRecords;
        const range = this.state.analyticsRange;

        // Update Trend
        if (this.state.charts.trend) {
            const trend = this.getSalesTrend(bills, range);
            this.state.charts.trend.data.labels = trend.map(t => { const d = new Date(t.date); return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); });
            this.state.charts.trend.data.datasets[0].data = trend.map(t => t.sales);
            this.state.charts.trend.update('active');
        }

        // Update Doughnut
        if (this.state.charts.doughnut) {
            let breakdown = this.getProductSalesBreakdown(bills, range);
            if (breakdown.length > 8) {
                const top = breakdown.slice(0, 7);
                const others = breakdown.slice(7).reduce((sum, p) => sum + p.sales, 0);
                breakdown = [...top, { item: 'Others', sales: others, percentage: 0 }];
            }
            this.state.charts.doughnut.data.labels = breakdown.map(p => p.item);
            this.state.charts.doughnut.data.datasets[0].data = breakdown.map(p => p.sales);
            this.state.charts.doughnut.update('active');
        }

        // Update Bar
        if (this.state.charts.bar) {
            const top = this.getProductSalesBreakdown(bills, range).slice(0, 8);
            this.state.charts.bar.data.labels = top.map(p => p.item);
            this.state.charts.bar.data.datasets[0].data = top.map(p => p.sales);
            this.state.charts.bar.update('active');
        }
    },

    renderKPIs() {
        const summary = this.getSalesSummary(this.state.savedRecords, this.state.analyticsRange);
        const html = `
            <div class="kpi-card"><div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div><div class="kpi-content"><div class="kpi-label">Total Revenue</div><div class="kpi-value">${this.formatCurrency(summary.totalSales)}</div></div></div>
            <div class="kpi-card"><div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg></div><div class="kpi-content"><div class="kpi-label">Total Bills</div><div class="kpi-value">${summary.totalBills}</div></div></div>
            <div class="kpi-card"><div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="kpi-content"><div class="kpi-label">Avg Bill Value</div><div class="kpi-value">${this.formatCurrency(summary.averageBill)}</div></div></div>
            <div class="kpi-card"><div class="kpi-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg></div><div class="kpi-content"><div class="kpi-label">Top Product</div><div class="kpi-value">${summary.topProduct || '—'}</div></div></div>
        `;
        document.getElementById('kpi-row').innerHTML = html;
    },

    // --- BILL LOGIC ---
    calculateRowTotal(qty, price) {
        const q = Math.max(0, parseFloat(qty) || 0);
        const p = Math.max(0, parseFloat(price) || 0);
        const total = q * p;
        return isFinite(total) ? total : 0;
    },

    calculateBillTotals() {
        let subtotal = 0;
        this.state.currentBill.items.forEach(item => {
            item.total = this.calculateRowTotal(item.qty, item.price);
            subtotal += item.total;
        });
        return isFinite(subtotal) ? subtotal : 0;
    },

    renderBillUI() {
        this.DOM.custName.value = this.state.currentBill.customer.name;
        this.DOM.custMobile.value = this.state.currentBill.customer.mobile;
        this.DOM.custAddress.value = this.state.currentBill.customer.address;
        this.DOM.billNotes.value = this.state.currentBill.notes;
        
        if (this.state.currentBill.isEditing) {
            const record = this.state.savedRecords.find(r => r.id === this.state.currentBill.editingId);
            this.DOM.invoiceNumber.textContent = record ? record.billNumber : 'INV-EDIT';
        } else {
            this.DOM.invoiceNumber.textContent = `INV-${String(this.state.invoiceCounter).padStart(4, '0')}`;
        }
        this.renderItems();
        this.updateTotals();
    },

    renderItems() {
        if (this.state.currentBill.items.length === 0) {
            this.DOM.itemsList.innerHTML = `<div class="empty-state" style="padding: 20px 0;">No items added</div>`;
            this.DOM.itemCount.textContent = '0 items';
            return;
        }
        const html = this.state.currentBill.items.map((item, i) => `
            <div class="item-row" data-index="${i}">
                <input type="text" class="input item-name" value="${this.escapeHTML(item.item)}" placeholder="Item name" autocomplete="off">
                <input type="number" class="input item-qty" value="${this.formatNumber(item.qty)}" placeholder="Qty" min="0" step="any">
                <input type="number" class="input item-price" value="${this.formatNumber(item.price)}" placeholder="Price" min="0" step="any">
                <button class="btn-icon btn-remove-item" aria-label="Remove item">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="item-row" style="border-bottom: 1px solid var(--border-color); padding-top: 0; padding-bottom: 10px; grid-template-columns: 1fr 36px;">
                <div class="item-total">Total: ${this.formatCurrency(item.total)}</div>
                <div></div>
            </div>
        `).join('');
        this.DOM.itemsList.innerHTML = html;
        this.DOM.itemCount.textContent = `${this.state.currentBill.items.length} item${this.state.currentBill.items.length !== 1 ? 's' : ''}`;
    },

    updateItemFromRow(row) {
        const index = parseInt(row.dataset.index);
        if (isNaN(index)) return;
        const name = row.querySelector('.item-name').value;
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        this.state.currentBill.items[index].item = name;
        this.state.currentBill.items[index].qty = Math.max(0, qty);
        this.state.currentBill.items[index].price = Math.max(0, price);
        this.state.currentBill.items[index].total = this.calculateRowTotal(qty, price);
        const totalRow = row.nextElementSibling;
        if (totalRow && totalRow.classList.contains('item-row')) {
            totalRow.querySelector('.item-total').textContent = `Total: ${this.formatCurrency(this.state.currentBill.items[index].total)}`;
        }
        this.updateTotals();
    },

    updateTotals() {
        const subtotal = this.calculateBillTotals();
        this.DOM.subtotal.textContent = this.formatCurrency(subtotal);
        this.DOM.grandTotal.textContent = this.formatCurrency(subtotal);
    },

    addItem() {
        this.state.currentBill.items.push({ item: '', qty: 0, price: 0, total: 0 });
        this.renderItems();
        const inputs = this.DOM.itemsList.querySelectorAll('.item-name');
        if (inputs.length > 0) {
            const lastInput = inputs[inputs.length - 1];
            lastInput.focus();
            lastInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    removeItem(index) {
        this.state.currentBill.items.splice(index, 1);
        this.renderItems();
        this.updateTotals();
    },

    hasUnsavedData() {
        const b = this.state.currentBill;
        return b.items.length > 0 || b.customer.name.trim() !== '' || b.customer.mobile.trim() !== '' || b.customer.address.trim() !== '' || b.notes.trim() !== '';
    },

    resetCurrentBill() {
        this.state.currentBill = { customer: { name: '', mobile: '', address: '' }, items: [], notes: '', isEditing: false, editingId: null };
        this.renderBillUI();
    },

    saveBill() {
        if (this.state.currentBill.items.length === 0) { this.showToast('Add at least one item', 'error'); return; }
        const hasValidItem = this.state.currentBill.items.some(i => i.item.trim() !== '' && i.total > 0);
        if (!hasValidItem) { this.showToast('Items must have name and total', 'error'); return; }

        const billNumber = this.state.currentBill.isEditing
            ? this.state.savedRecords.find(r => r.id === this.state.currentBill.editingId).billNumber
            : `INV-${String(this.state.invoiceCounter).padStart(4, '0')}`;

        const record = {
            id: this.state.currentBill.editingId || this.generateId(),
            billNumber: billNumber,
            date: this.state.currentBill.isEditing ? this.state.savedRecords.find(r => r.id === this.state.currentBill.editingId).date : new Date().toISOString(),
            savedAt: Date.now(),
            customer: { ...this.state.currentBill.customer },
            items: this.state.currentBill.items.map(i => ({ ...i })),
            grand: this.calculateBillTotals(),
            notes: this.state.currentBill.notes
        };

        if (this.state.currentBill.isEditing) {
            const idx = this.state.savedRecords.findIndex(r => r.id === this.state.currentBill.editingId);
            if (idx !== -1) this.state.savedRecords[idx] = record;
        } else {
            this.state.savedRecords.unshift(record);
            this.state.invoiceCounter++;
            StorageAdapter.setCounter(this.state.invoiceCounter);
        }
        StorageAdapter.saveBills(this.state.savedRecords);
        this.resetCurrentBill();
        this.showToast('Bill saved successfully', 'success');
        this.switchTab('saved-bills');
    },

    // --- SAVED RECORDS ---
    filterRecords() {
        const q = this.state.searchQuery.toLowerCase().trim();
        if (!q) {
            this.DOM.clearSearch.classList.add('hidden');
            this.DOM.searchCount.textContent = `${this.state.savedRecords.length} bills`;
            return this.state.savedRecords;
        }
        this.DOM.clearSearch.classList.remove('hidden');
        const filtered = this.state.savedRecords.filter(r => {
            const inv = (r.billNumber || '').toLowerCase();
            const name = (r.customer?.name || '').toLowerCase();
            const mobile = (r.customer?.mobile || '').toLowerCase();
            const itemsStr = r.items.map(i => (i.item || '').toLowerCase()).join(' ');
            return inv.includes(q) || name.includes(q) || mobile.includes(q) || itemsStr.includes(q);
        });
        this.DOM.searchCount.textContent = `${filtered.length} bill${filtered.length !== 1 ? 's' : ''}`;
        return filtered;
    },

    renderSavedRecords() {
        const records = this.filterRecords();
        if (records.length === 0) {
            this.DOM.recordsList.innerHTML = `<div class="empty-state">${this.state.searchQuery ? 'No matching records' : 'No saved records'}</div>`;
            return;
        }
        const html = records.map(r => `
            <div class="record-row" data-id="${r.id}">
                <div class="record-main" data-action="view">
                    <div class="record-header">
                        <span class="record-inv">${this.escapeHTML(r.billNumber)}</span>
                        <span class="record-date">${new Date(r.date).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div class="record-customer">${this.escapeHTML(r.customer.name || 'Guest')}</div>
                    <div class="record-items-preview">${r.items.map(i => this.escapeHTML(i.item)).filter(Boolean).join(', ')}</div>
                </div>
                <div class="record-total">${this.formatCurrency(r.grand)}</div>
            </div>
        `).join('');
        this.DOM.recordsList.innerHTML = html;
    },

    viewRecord(id) {
        const record = this.state.savedRecords.find(r => r.id === id);
        if (!record) return;
        const itemsHTML = record.items.map(i => `
            <tr><td>${this.escapeHTML(i.item)}</td><td class="num">${this.formatNumber(i.qty)}</td><td class="num">${this.formatCurrency(i.price)}</td><td class="num">${this.formatCurrency(i.total)}</td></tr>
        `).join('');
        const html = `
            <div class="modal-header"><h2>${this.escapeHTML(record.billNumber)}</h2><button class="btn-close-modal" aria-label="Close">&times;</button></div>
            <div class="modal-body">
                <div class="record-details">
                    <div><strong>${this.escapeHTML(record.customer.name || 'Guest')}</strong></div>
                    ${record.customer.mobile ? `<div>${this.escapeHTML(record.customer.mobile)}</div>` : ''}
                    ${record.customer.address ? `<div>${this.escapeHTML(record.customer.address)}</div>` : ''}
                    <div class="text-secondary">${new Date(record.date).toLocaleString('en-IN')}</div>
                </div>
                <table class="items-table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${itemsHTML}</tbody><tfoot><tr><td colspan="3" class="text-right">Grand Total</td><td class="num"><strong>${this.formatCurrency(record.grand)}</strong></td></tr></tfoot></table>
                ${record.notes ? `<div class="record-notes"><strong>Notes:</strong> ${this.escapeHTML(record.notes)}</div>` : ''}
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" data-action="edit-record" data-id="${record.id}">Edit</button>
                <button class="btn btn-outline" data-action="print-record" data-id="${record.id}">Print</button>
                <button class="btn btn-danger" data-action="delete-record" data-id="${record.id}">Delete</button>
            </div>
        `;
        this.openModal(html);
    },

    editRecord(id) {
        const record = this.state.savedRecords.find(r => r.id === id);
        if (!record) return;
        this.state.currentBill = { customer: { ...record.customer }, items: record.items.map(i => ({ ...i })), notes: record.notes || '', isEditing: true, editingId: record.id };
        this.closeModal();
        this.switchTab('new-bill');
        this.renderBillUI();
        this.showToast('Editing ' + record.billNumber);
    },

    deleteRecord(id) {
        this.openConfirm('Delete Record?', 'This cannot be undone.', () => {
            this.state.savedRecords = this.state.savedRecords.filter(r => r.id !== id);
            StorageAdapter.saveBills(this.state.savedRecords);
            this.closeModal();
            this.renderSavedRecords();
            if (this.state.currentTab === 'saved-bills' || this.state.currentTab === 'analytics') {
                this.renderKPIs();
                this.updateCharts();
            }
            this.showToast('Record deleted', 'success');
        });
    },

    // --- PRINTING ---
    generateReceiptHTML(bill, invoiceNum) {
        const date = new Date(bill.savedAt || bill.date).toLocaleString('en-IN');
        let itemsHTML = bill.items.map(i => `
            <div class="receipt-item" style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <div style="flex:1; word-break:break-word;">${this.escapeHTML(i.item)}</div>
                <div style="text-align:right; white-space:nowrap; margin-left:8px;">${this.formatNumber(i.qty)}×${this.formatCurrency(i.price)}<br><strong>${this.formatCurrency(i.total)}</strong></div>
            </div>
        `).join('');
        return `
            <div class="receipt" style="font-family: monospace; font-size: 12px; line-height: 1.4;">
                <div style="text-align:center; margin-bottom:10px;"><strong style="font-size:1.4em;">K.N FURNITURE</strong><br>Rough Estimate<br>${invoiceNum}<br>${date}</div>
                <div style="margin-bottom:10px; border-bottom:1px dashed #000; padding-bottom:10px;">
                    <strong>${this.escapeHTML(bill.customer.name || 'Guest')}</strong><br>
                    ${bill.customer.mobile ? `${this.escapeHTML(bill.customer.mobile)}<br>` : ''}
                    ${bill.customer.address ? `${this.escapeHTML(bill.customer.address)}<br>` : ''}
                </div>
                <div style="margin: 10px 0; border-bottom:1px dashed #000; padding-bottom:10px;">${itemsHTML}</div>
                <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:1.2em; margin-top:8px;">
                    <span>Grand Total</span><span>${this.formatCurrency(bill.grand)}</span>
                </div>
                ${bill.notes ? `<div style="margin-top:12px; border-top:1px dashed #000; padding-top:8px;">Notes: ${this.escapeHTML(bill.notes)}</div>` : ''}
            </div>
        `;
    },

    printContent(html, isThermal = false, thermalSize = '80mm') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0';
        iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><title>Print</title><style>@page { margin: 0; ${isThermal ? `size: ${thermalSize} auto;` : ''} } body { font-family: monospace; margin: 0; padding: ${isThermal ? '4mm' : '20mm'}; color: #000; background: #fff; ${isThermal ? `width: ${thermalSize}; box-sizing: border-box;` : ''} }</style></head><body>${html}</body></html>`);
        doc.close();
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 2000);
    },

    printNormal(id = null) {
        let bill, num;
        if (id) { const r = this.state.savedRecords.find(r => r.id === id); if (!r) return; bill = r; num = r.billNumber; }
        else { if (this.state.currentBill.items.length === 0) { this.showToast('Nothing to print', 'error'); return; } bill = this.state.currentBill; num = this.DOM.invoiceNumber.textContent; }
        this.printContent(this.generateReceiptHTML(bill, num), false);
    },

    printThermal(id = null, size = '80mm') {
        let bill, num;
        if (id) { const r = this.state.savedRecords.find(r => r.id === id); if (!r) return; bill = r; num = r.billNumber; }
        else { if (this.state.currentBill.items.length === 0) { this.showToast('Nothing to print', 'error'); return; } bill = this.state.currentBill; num = this.DOM.invoiceNumber.textContent; }
        this.printContent(this.generateReceiptHTML(bill, num), true, size);
    },

    // --- MODALS & TOASTS ---
    openModal(html) {
        this.DOM.modalContent.innerHTML = html;
        this.DOM.modalOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },
    closeModal() {
        this.DOM.modalOverlay.classList.add('hidden');
        this.DOM.modalContent.innerHTML = '';
        document.body.style.overflow = '';
    },
    openConfirm(title, message, onConfirm) {
        const html = `<div class="modal-header"><h2>${this.escapeHTML(title)}</h2><button class="btn-close-modal">&times;</button></div><div class="modal-body"><p>${this.escapeHTML(message)}</p></div><div class="modal-footer"><button class="btn btn-outline" data-action="close-modal">Cancel</button><button class="btn btn-danger" data-action="confirm-action">Confirm</button></div>`;
        this.openModal(html);
        this.DOM.modalContent.querySelector('[data-action="confirm-action"]').addEventListener('click', () => { this.closeModal(); onConfirm(); }, { once: true });
    },
    showToast(message, type = 'info') {
        this.DOM.toastContainer.innerHTML = '';
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        this.DOM.toastContainer.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2500);
    },

    // --- NAVIGATION ---
    switchTab(tabName) {
        if (tabName === this.state.currentTab && !this.state.currentBill.isEditing) return;
        if (this.state.currentTab === 'new-bill' && tabName !== 'new-bill') {
            if (this.hasUnsavedData() && !this.state.currentBill.isEditing) {
                this.openConfirm('Discard Bill?', 'You have unsaved data.', () => { this.resetCurrentBill(); this.performSwitch(tabName); });
                return;
            }
        }
        this.performSwitch(tabName);
    },

    performSwitch(tabName) {
        this.state.currentTab = tabName;
        StorageAdapter.setTab(tabName);
        
        // Update Mobile Nav
        document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
        // Update Desktop Nav
        document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
        
        // Handle Analytics tab mapping to saved-bills page on desktop
        const displayTab = (tabName === 'analytics' && window.innerWidth >= 1024) ? 'saved-bills' : tabName;
        document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === `page-${displayTab}`));
        
        // Update Desktop Title
        const titles = { 'new-bill': 'New Bill', 'saved-bills': 'Saved Bills', 'products': 'Products', 'analytics': 'Analytics' };
        document.getElementById('desktop-page-title').textContent = titles[tabName] || 'Billing';

        // Desktop header action buttons — sirf new-bill pe show
        if (this.DOM.desktopBillActions) {
            this.DOM.desktopBillActions.classList.toggle('hidden', tabName !== 'new-bill');
        }

        if (tabName === 'saved-bills' || tabName === 'analytics') {
            this.renderSavedRecords();
            if (window.innerWidth >= 1024) {
                this.renderKPIs();
                this.updateCharts();
            } else {
                renderBillsChart();
            }
        }
        if (tabName === 'products') {
            this.renderProducts();
            if (window.innerWidth < 1024) renderProductsChart();
        }
        if (tabName === 'new-bill') this.renderBillUI();
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
        window.scrollTo(0, 0);
    },

    renderProducts() {
        if (ProductsModule.state.products.length === 0) {
            this.DOM.productsList.innerHTML = `<div class="empty-state">No products yet</div>`;
            return;
        }
        const html = ProductsModule.state.products.map(p => `
            <div class="product-row" data-id="${p.id}">
                <div class="product-info">
                    <div class="product-name">${this.escapeHTML(p.name)}</div>
                    <div class="product-meta"><span class="product-code">${this.escapeHTML(p.code)}</span>${this.formatCurrency(p.price)}</div>
                </div>
                <div class="product-actions">
                    <button class="btn-icon btn-edit-product" aria-label="Edit product"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                    <button class="btn-icon btn-delete-product" aria-label="Delete product"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                </div>
            </div>
        `).join('');
        this.DOM.productsList.innerHTML = html;
    },

    openProductModal(product = null) {
        const isEdit = !!product;
        const html = `
            <div class="modal-header"><h2>${isEdit ? 'Edit Product' : 'Add Product'}</h2><button class="btn-close-modal">&times;</button></div>
            <div class="modal-body">
                <div class="form-group"><label>Product Code *</label><input type="text" id="prod-code" class="input" value="${isEdit ? this.escapeHTML(product.code) : ''}" placeholder="e.g. SKU001"></div>
                <div class="form-group"><label>Product Name *</label><input type="text" id="prod-name" class="input" value="${isEdit ? this.escapeHTML(product.name) : ''}" placeholder="e.g. Wooden Sofa"></div>
                <div class="form-group"><label>Default Price</label><input type="number" id="prod-price" class="input" value="${isEdit ? product.price : '0'}" placeholder="0.00" step="0.01" min="0"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" data-action="close-modal">Cancel</button>
                <button class="btn btn-primary" data-action="save-product" data-id="${isEdit ? product.id : ''}">Save</button>
            </div>
        `;
        this.openModal(html);
        setTimeout(() => document.getElementById('prod-code').focus(), 100);
    },

    saveProduct(id) {
        const code = document.getElementById('prod-code').value.trim();
        const name = document.getElementById('prod-name').value.trim();
        const price = Math.max(0, parseFloat(document.getElementById('prod-price').value) || 0);
        const result = ProductsModule.addOrUpdate(id, code, name, price);
        if (!result.success) { this.showToast(result.error, 'error'); return; }
        this.renderProducts();
        if (window.innerWidth < 1024) renderProductsChart();
        this.closeModal();
        this.showToast('Product saved', 'success');
    },

    deleteProduct(id) {
        this.openConfirm('Delete Product?', 'This cannot be undone.', () => {
            ProductsModule.delete(id);
            this.renderProducts();
            if (window.innerWidth < 1024) renderProductsChart();
            this.showToast('Product deleted', 'success');
        });
    },

    // --- AUTOCOMPLETE ---
    showAutocomplete(input, query) {
        if (!query || query.length < 1) { this.hideAutocomplete(); return; }
        const matches = ProductsModule.search(query);
        if (matches.length === 0) { this.hideAutocomplete(); return; }
        
        this.state.autocomplete.targetInput = input;
        this.state.autocomplete.activeIndex = -1;
        this.state.autocomplete.matches = matches;
        
        const html = matches.map((p, i) => `<div class="ac-item" data-index="${i}"><div class="ac-name">${this.escapeHTML(p.name)}</div><div class="ac-meta">${this.escapeHTML(p.code)} • ${this.formatCurrency(p.price)}</div></div>`).join('');
        this.DOM.autocomplete.innerHTML = html;
        this.DOM.autocomplete.classList.remove('hidden');
        
        const rect = input.getBoundingClientRect();
        requestAnimationFrame(() => {
            this.DOM.autocomplete.style.top = `${rect.bottom + window.scrollY + 4}px`;
            this.DOM.autocomplete.style.left = `${rect.left + window.scrollX}px`;
            this.DOM.autocomplete.style.width = `${rect.width}px`;
        });
    },

    hideAutocomplete() {
        this.DOM.autocomplete.classList.add('hidden');
        this.DOM.autocomplete.innerHTML = '';
        this.state.autocomplete.targetInput = null;
        this.state.autocomplete.activeIndex = -1;
    },

    selectAutocompleteItem(index) {
        const product = this.state.autocomplete.matches[index];
        const input = this.state.autocomplete.targetInput;
        if (!product || !input) return;
        const row = input.closest('.item-row');
        row.querySelector('.item-name').value = product.name;
        row.querySelector('.item-price').value = product.price;
        const qtyInput = row.querySelector('.item-qty');
        if (!qtyInput.value || parseFloat(qtyInput.value) === 0) qtyInput.value = 1;
        this.updateItemFromRow(row);
        this.hideAutocomplete();
        qtyInput.focus();
        qtyInput.select();
    },

    // --- EVENTS & INIT ---
    cacheDOMRefs() {
        this.DOM.custName = document.getElementById('cust-name');
        this.DOM.custMobile = document.getElementById('cust-mobile');
        this.DOM.custAddress = document.getElementById('cust-address');
        this.DOM.itemsList = document.getElementById('items-list');
        this.DOM.itemCount = document.getElementById('item-count');
        this.DOM.btnAddItem = document.getElementById('btn-add-item');
        this.DOM.subtotal = document.getElementById('subtotal');
        this.DOM.grandTotal = document.getElementById('grand-total');
        this.DOM.billNotes = document.getElementById('bill-notes');
        this.DOM.btnSave = document.getElementById('btn-save-bill');
        this.DOM.btnPrint = document.getElementById('btn-print-bill');
        this.DOM.btnThermal58 = document.getElementById('btn-thermal-58');
        this.DOM.btnThermal80 = document.getElementById('btn-thermal-80');
        this.DOM.searchInput = document.getElementById('search-records');
        this.DOM.clearSearch = document.getElementById('clear-search');
        this.DOM.searchCount = document.getElementById('search-count');
        this.DOM.recordsList = document.getElementById('saved-records-list');
        this.DOM.productsList = document.getElementById('products-list');
        this.DOM.btnAddProduct = document.getElementById('btn-add-product');
        this.DOM.autocomplete = document.getElementById('autocomplete-dropdown');
        this.DOM.modalOverlay = document.getElementById('modal-overlay');
        this.DOM.modalContent = document.getElementById('modal-content');
        this.DOM.toastContainer = document.getElementById('toast-container');
        this.DOM.invoiceNumber = document.getElementById('invoice-number');
        this.DOM.desktopBillActions = document.getElementById('desktop-bill-actions');
        this.DOM.desktopBtnSave = document.getElementById('desktop-btn-save');
        this.DOM.desktopBtnPrint = document.getElementById('desktop-btn-print');
        this.DOM.desktopBtnThermal58 = document.getElementById('desktop-btn-thermal-58');
        this.DOM.desktopBtnThermal80 = document.getElementById('desktop-btn-thermal-80');
    },

    initEvents() {
        // Tab Navigation
        document.getElementById('tab-nav').addEventListener('click', (e) => { const btn = e.target.closest('.segment-btn'); if (btn) this.switchTab(btn.dataset.tab); });
        document.getElementById('desktop-sidebar').addEventListener('click', (e) => { const btn = e.target.closest('.sidebar-btn'); if (btn) this.switchTab(btn.dataset.tab); });
        
        // New Bill Inputs
        this.DOM.custName.addEventListener('input', () => this.state.currentBill.customer.name = this.DOM.custName.value);
        this.DOM.custMobile.addEventListener('input', () => this.state.currentBill.customer.mobile = this.DOM.custMobile.value);
        this.DOM.custAddress.addEventListener('input', () => this.state.currentBill.customer.address = this.DOM.custAddress.value);
        this.DOM.billNotes.addEventListener('input', () => this.state.currentBill.notes = this.DOM.billNotes.value);
        this.DOM.btnAddItem.addEventListener('click', () => this.addItem());
        this.DOM.btnSave.addEventListener('click', () => this.saveBill());
        this.DOM.btnPrint.addEventListener('click', () => this.printNormal());
        this.DOM.btnThermal58.addEventListener('click', () => this.printThermal(null, '58mm'));
        this.DOM.btnThermal80.addEventListener('click', () => this.printThermal(null, '80mm'));

        // Items List Delegation
        this.DOM.itemsList.addEventListener('input', (e) => {
            const row = e.target.closest('.item-row');
            if (!row) return;
            if (e.target.classList.contains('item-name')) this.showAutocomplete(e.target, e.target.value);
            if (e.target.classList.contains('item-name') || e.target.classList.contains('item-qty') || e.target.classList.contains('item-price')) this.updateItemFromRow(row);
        });
        this.DOM.itemsList.addEventListener('click', (e) => {
            if (e.target.closest('.btn-remove-item')) { const row = e.target.closest('.item-row'); if (row) this.removeItem(parseInt(row.dataset.index)); }
        });

        // Autocomplete
        this.DOM.autocomplete.addEventListener('click', (e) => { const item = e.target.closest('.ac-item'); if (item) this.selectAutocompleteItem(parseInt(item.dataset.index)); });
        document.addEventListener('click', (e) => { if (!e.target.closest('.autocomplete-dropdown') && !e.target.closest('.item-name')) this.hideAutocomplete(); });

        // Saved Records
        this.DOM.searchInput.addEventListener('input', (e) => { this.state.searchQuery = e.target.value; this.renderSavedRecords(); });
        this.DOM.clearSearch.addEventListener('click', () => { this.DOM.searchInput.value = ''; this.state.searchQuery = ''; this.renderSavedRecords(); });
        this.DOM.recordsList.addEventListener('click', (e) => {
            const row = e.target.closest('.record-row'); if (!row) return;
            const id = row.dataset.id;
            if (e.target.closest('[data-action="view"]') || e.target.closest('.record-main')) this.viewRecord(id);
        });

        // Products
        this.DOM.productsList.addEventListener('click', (e) => {
            const row = e.target.closest('.product-row'); if (!row) return;
            const id = row.dataset.id;
            if (e.target.closest('.btn-edit-product')) { const p = ProductsModule.state.products.find(p => p.id === id); if (p) this.openProductModal(p); }
            if (e.target.closest('.btn-delete-product')) this.deleteProduct(id);
        });
        this.DOM.btnAddProduct.addEventListener('click', () => this.openProductModal());

        // Modal Delegation
        this.DOM.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.DOM.modalOverlay || e.target.closest('.btn-close-modal') || e.target.closest('[data-action="close-modal"]')) this.closeModal();
            const actionBtn = e.target.closest('[data-action]'); if (!actionBtn) return;
            const action = actionBtn.dataset.action; const id = actionBtn.dataset.id;
            if (action === 'save-product') this.saveProduct(id || null);
            if (action === 'edit-record') this.editRecord(id);
            if (action === 'delete-record') this.deleteRecord(id);
            if (action === 'print-record') this.printNormal(id);
        });

        // Desktop Bill Action Buttons
        this.DOM.desktopBtnSave.addEventListener('click', () => this.saveBill());
        this.DOM.desktopBtnPrint.addEventListener('click', () => this.printNormal());
        this.DOM.desktopBtnThermal58.addEventListener('click', () => this.printThermal(null, '58mm'));
        this.DOM.desktopBtnThermal80.addEventListener('click', () => this.printThermal(null, '80mm'));

        // Analytics Range
        document.getElementById('trend-range')?.addEventListener('click', (e) => {
            const btn = e.target.closest('button'); if (!btn) return;
            document.querySelectorAll('#trend-range button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.state.analyticsRange = parseInt(btn.dataset.range);
            this.renderKPIs();
            this.updateCharts();
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!this.DOM.modalOverlay.classList.contains('hidden')) this.closeModal();
                this.hideAutocomplete();
            }
        });
    },

    init() {
        this.cacheDOMRefs();
        ProductsModule.load();
        this.state.savedRecords = StorageAdapter.getBills().map(r => ({ ...r, items: (r.items || []).map(i => ({ item: String(i.item||''), qty: parseFloat(i.qty)||0, price: parseFloat(i.price)||0, total: parseFloat(i.total)||0 })) }));
        this.state.invoiceCounter = Math.max(1, parseInt(StorageAdapter.getCounter()) || 1);
        this.state.currentTab = StorageAdapter.getTab();
        
        document.getElementById('header-date').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        this.initEvents();
        this.initCharts();
        this.performSwitch(this.state.currentTab);
    }
};

document.addEventListener('DOMContentLoaded', () => BillingModule.init());
