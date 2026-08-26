// ==========================================
// BILLING MODULE — bills, calculations, analytics aggregation,
// print preparation, charts, UI orchestration.
// No localStorage access (StorageAdapter only).
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
        saving: false,
        charts: {},
        chartsReady: false
    },
    DOM: {},

    CHART_COLORS: ['#0077B5', '#4FA3D1', '#7FBCE0', '#A9D2EC', '#CFE6F5', '#0A5B8C', '#7A8CA0'],
    OTHERS_COLOR: '#B7C2CC',

    // ---------- UTILS ----------
    escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    },
    formatCurrency(amount) {
        const num = parseFloat(amount);
        if (isNaN(num) || !isFinite(num)) return '₹0.00';
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
    debounce(fn, ms) {
        let t;
        return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    },
    icons() { if (window.lucide) { try { lucide.createIcons(); } catch (e) { /* non-fatal */ } } },

    // ---------- PURE ANALYTICS (no DOM) ----------
    filterBillsByRange(bills, rangeDays) {
        if (rangeDays === 0) return bills;
        const cutoff = Date.now() - (rangeDays * 24 * 60 * 60 * 1000);
        return bills.filter(b => (b.savedAt || new Date(b.date).getTime() || 0) >= cutoff);
    },
    getLastNDays(n) {
        const days = [];
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
        }
        return days;
    },
    getAllDays(bills) {
        if (!bills.length) return this.getLastNDays(30);
        let min = Date.now();
        bills.forEach(b => { const t = b.savedAt || new Date(b.date).getTime() || Date.now(); if (t < min) min = t; });
        const days = []; const cur = new Date(min); const end = new Date();
        let guard = 0;
        while (cur <= end && guard < 3000) { days.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1); guard++; }
        return days;
    },
    getSalesSummary(bills, rangeDays) {
        const filtered = this.filterBillsByRange(bills, rangeDays);
        let totalSales = 0, itemsSold = 0;
        const perProduct = {};
        filtered.forEach(b => {
            totalSales += (b.grand || 0);
            (b.items || []).forEach(i => {
                itemsSold += (i.qty || 0);
                perProduct[i.item] = (perProduct[i.item] || 0) + (i.total || 0);
            });
        });
        let topProduct = null, top = 0;
        Object.entries(perProduct).forEach(([n, s]) => { if (s > top) { top = s; topProduct = n; } });
        return {
            totalSales, totalBills: filtered.length,
            averageBill: filtered.length ? totalSales / filtered.length : 0,
            itemsSold, topProduct
        };
    },
    getSalesTrend(bills, rangeDays) {
        const filtered = this.filterBillsByRange(bills, rangeDays);
        const days = rangeDays === 0 ? this.getAllDays(filtered) : this.getLastNDays(rangeDays);
        const trend = days.map(d => ({ date: d, sales: 0, bills: 0 }));
        const map = new Map(trend.map(t => [t.date, t]));
        filtered.forEach(b => {
            const d = new Date(b.savedAt || new Date(b.date).getTime()).toISOString().split('T')[0];
            const e = map.get(d);
            if (e) { e.sales += (b.grand || 0); e.bills += 1; }
        });
        return trend;
    },
    getProductSalesBreakdown(bills, rangeDays) {
        const filtered = this.filterBillsByRange(bills, rangeDays);
        const map = {}; let total = 0;
        filtered.forEach(b => (b.items || []).forEach(i => {
            const sales = (i.qty || 0) * (i.price || 0);
            if (!map[i.item]) map[i.item] = { item: i.item, sales: 0, quantity: 0 };
            map[i.item].sales += sales; map[i.item].quantity += (i.qty || 0);
            total += sales;
        }));
        return Object.values(map)
            .sort((a, b) => b.sales - a.sales)
            .map(p => ({ ...p, percentage: total > 0 ? (p.sales / total) * 100 : 0 }));
    },
    getTopProducts(bills, rangeDays, limit) { return this.getProductSalesBreakdown(bills, rangeDays).slice(0, limit); },

    // ---------- CHARTS ----------
    ensureCharts() {
        if (!window.Chart || this.state.chartsReady) return !!window.Chart;
        Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        Chart.defaults.color = '#5a6a7e';
        Chart.defaults.animation = { duration: 300 };

        this.state.charts.trend = new Chart(document.getElementById('chart-trend'), {
            type: 'line',
            data: { labels: [], datasets: [{ data: [], borderColor: '#0077B5', backgroundColor: 'rgba(0,119,181,0.08)', fill: true, tension: 0.3, pointRadius: 2, pointBackgroundColor: '#0077B5', borderWidth: 2 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ' ' + this.formatCurrency(c.parsed.y) } } },
                scales: { y: { beginAtZero: true, grid: { color: '#eef2f6' }, ticks: { callback: v => '₹' + Number(v).toLocaleString('en-IN') } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } } }
            }
        });
        this.state.charts.doughnut = new Chart(document.getElementById('chart-doughnut'), {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: [...this.CHART_COLORS, this.OTHERS_COLOR], borderWidth: 0 }] },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '62%',
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (c) => ` ${this.formatCurrency(c.parsed)} · ${this._doughnutPct[c.dataIndex] ?? ''}` } }
                }
            }
        });
        this.state.charts.bar = new Chart(document.getElementById('chart-bar'), {
            type: 'bar',
            data: { labels: [], datasets: [{ data: [], backgroundColor: '#0077B5', borderRadius: 4, maxBarThickness: 22 }] },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${this.formatCurrency(c.parsed.x)} · Qty ${this._barQty[c.dataIndex] ?? 0}` } } },
                scales: { x: { beginAtZero: true, grid: { color: '#eef2f6' }, ticks: { callback: v => '₹' + Number(v).toLocaleString('en-IN') } }, y: { grid: { display: false } } }
            }
        });
        this.state.chartsReady = true;
        return true;
    },

    updateCharts() {
        if (!this.state.chartsReady) return;
        const bills = this.state.savedRecords;
        const range = this.state.analyticsRange;

        const trend = this.getSalesTrend(bills, range);
        const t = this.state.charts.trend;
        t.data.labels = trend.map(x => new Date(x.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }));
        t.data.datasets[0].data = trend.map(x => x.sales);
        t.update('active');

        let breakdown = this.getProductSalesBreakdown(bills, range);
        const dEmpty = document.getElementById('doughnut-empty');
        const bEmpty = document.getElementById('bar-empty');
        if (breakdown.length === 0) {
            dEmpty.classList.remove('hidden'); bEmpty.classList.add('hidden') === false && bEmpty.classList.add('hidden');
            bEmpty.classList.remove('hidden');
            document.getElementById('doughnut-legend').innerHTML = '';
        } else {
            dEmpty.classList.add('hidden'); bEmpty.classList.add('hidden');
        }

        let legendData = breakdown;
        if (breakdown.length > 8) {
            const top = breakdown.slice(0, 7);
            const others = breakdown.slice(7).reduce((s, p) => s + p.sales, 0);
            const othersPct = breakdown.slice(7).reduce((s, p) => s + p.percentage, 0);
            legendData = [...top, { item: 'Others', sales: others, percentage: othersPct }];
        }
        this._doughnutPct = legendData.map(p => p.percentage.toFixed(1) + '%');
        const d = this.state.charts.doughnut;
        d.data.labels = legendData.map(p => p.item);
        d.data.datasets[0].data = legendData.map(p => p.sales);
        d.update('active');
        document.getElementById('doughnut-legend').innerHTML = legendData.map((p, i) =>
            `<div class="dl-row"><span class="dl-dot" style="background:${i < this.CHART_COLORS.length ? this.CHART_COLORS[i] : this.OTHERS_COLOR}"></span><span class="dl-name">${this.escapeHTML(p.item)}</span><span class="dl-pct">${p.percentage.toFixed(0)}%</span></div>`
        ).join('');

        const top8 = this.getTopProducts(bills, range, 8);
        this._barQty = top8.map(p => p.quantity);
        const b = this.state.charts.bar;
        b.data.labels = top8.map(p => p.item);
        b.data.datasets[0].data = top8.map(p => p.sales);
        b.update('active');
    },

    renderAnalytics() {
        const bills = this.state.savedRecords;
        const empty = document.getElementById('analytics-empty');
        const grid = document.getElementById('analytics-grid');
        const kpiRow = document.getElementById('kpi-row');
        const summaryEl = document.getElementById('analytics-summary');

        if (bills.length === 0) {
            empty.classList.remove('hidden');
            grid.classList.add('hidden'); kpiRow.classList.add('hidden'); summaryEl.classList.add('hidden');
            return;
        }
        empty.classList.add('hidden');
        grid.classList.remove('hidden'); kpiRow.classList.remove('hidden'); summaryEl.classList.remove('hidden');

        const s = this.getSalesSummary(bills, this.state.analyticsRange);
        kpiRow.innerHTML = `
            <div class="kpi-card"><div class="kpi-icon"><i data-lucide="indian-rupee"></i></div><div><div class="kpi-label">Total Sales</div><div class="kpi-value">${this.formatCurrency(s.totalSales)}</div></div></div>
            <div class="kpi-card"><div class="kpi-icon"><i data-lucide="receipt"></i></div><div><div class="kpi-label">Total Bills</div><div class="kpi-value">${s.totalBills}</div></div></div>
            <div class="kpi-card"><div class="kpi-icon"><i data-lucide="calculator"></i></div><div><div class="kpi-label">Average Bill</div><div class="kpi-value">${this.formatCurrency(s.averageBill)}</div></div></div>
            <div class="kpi-card"><div class="kpi-icon"><i data-lucide="award"></i></div><div><div class="kpi-label">Top Product</div><div class="kpi-value">${this.escapeHTML(s.topProduct || '—')}</div></div></div>`;
        summaryEl.textContent = `Total sales ${this.formatCurrency(s.totalSales)} across ${s.totalBills} bill${s.totalBills !== 1 ? 's' : ''}${s.topProduct ? `. Top product: ${s.topProduct}` : ''}.`;
        this.icons();

        if (!this.ensureCharts()) {
            ['trend-empty', 'doughnut-empty', 'bar-empty'].forEach(id => {
                const el = document.getElementById(id);
                el.textContent = 'Analytics unavailable';
                el.classList.remove('hidden');
            });
            return;
        }
        this.updateCharts();
    },

    refreshAnalyticsIfVisible() {
        if (this.state.currentTab === 'analytics') this.renderAnalytics();
    },

    // ---------- BILL LOGIC ----------
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
    meaningfulItemCount() {
        return this.state.currentBill.items.filter(i => (parseFloat(i.qty) || 0) > 0 || (parseFloat(i.price) || 0) > 0).length;
    },

    renderBillUI() {
        this.DOM.custName.value = this.state.currentBill.customer.name;
        this.DOM.custMobile.value = this.state.currentBill.customer.mobile;
        this.DOM.custAddress.value = this.state.currentBill.customer.address;
        this.DOM.billNotes.value = this.state.currentBill.notes;
        if (this.state.currentBill.isEditing) {
            const rec = this.state.savedRecords.find(r => r.id === this.state.currentBill.editingId);
            this.DOM.invoiceNumber.textContent = rec ? rec.billNumber : 'INV-EDIT';
        } else {
            this.DOM.invoiceNumber.textContent = `INV-${String(this.state.invoiceCounter).padStart(4, '0')}`;
        }
        this.renderItems();
        this.updateTotals();
    },

    renderItems() {
        if (this.state.currentBill.items.length === 0) {
            this.DOM.itemsList.innerHTML = `<div class="empty-state" style="padding: 20px 0;">No items added</div>`;
        } else {
            this.DOM.itemsList.innerHTML = this.state.currentBill.items.map((item, i) => `
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
                </div>`).join('');
        }
        this.DOM.itemCount.textContent = `${this.meaningfulItemCount()} item${this.meaningfulItemCount() !== 1 ? 's' : ''}`;
    },

    updateItemFromRow(row) {
        const index = parseInt(row.dataset.index);
        if (isNaN(index) || !this.state.currentBill.items[index]) return;
        const name = row.querySelector('.item-name').value;
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const it = this.state.currentBill.items[index];
        it.item = name; it.qty = Math.max(0, qty); it.price = Math.max(0, price);
        it.total = this.calculateRowTotal(qty, price);
        const totalRow = row.nextElementSibling;
        if (totalRow && totalRow.classList.contains('item-row')) {
            totalRow.querySelector('.item-total').textContent = `Total: ${this.formatCurrency(it.total)}`;
        }
        this.updateTotals();
    },

    updateTotals() {
        const subtotal = this.calculateBillTotals();
        this.DOM.subtotal.textContent = this.formatCurrency(subtotal);
        this.DOM.grandTotal.textContent = this.formatCurrency(subtotal);
        this.DOM.itemCount.textContent = `${this.meaningfulItemCount()} item${this.meaningfulItemCount() !== 1 ? 's' : ''}`;
    },

    addItem() {
        this.state.currentBill.items.push({ item: '', qty: 0, price: 0, total: 0 });
        this.renderItems();
        const inputs = this.DOM.itemsList.querySelectorAll('.item-name');
        if (inputs.length) {
            const last = inputs[inputs.length - 1];
            last.focus();
            last.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    removeItem(index) {
        this.state.currentBill.items.splice(index, 1);
        this.renderItems();
        this.updateTotals();
    },

    hasUnsavedData() {
        const b = this.state.currentBill;
        return b.items.length > 0 || b.customer.name.trim() || b.customer.mobile.trim() || b.customer.address.trim() || b.notes.trim();
    },

    resetCurrentBill() {
        this.state.currentBill = { customer: { name: '', mobile: '', address: '' }, items: [], notes: '', isEditing: false, editingId: null };
        this.renderBillUI();
    },

    saveBill() {
        if (this.state.saving) return; // double-click guard
        if (this.state.currentBill.items.length === 0) { this.showToast('Add at least one item', 'error'); return; }
        if (!this.state.currentBill.items.some(i => i.item.trim() !== '' && i.total > 0)) { this.showToast('Items must have name and total', 'error'); return; }

        this.state.saving = true;
        setTimeout(() => { this.state.saving = false; }, 600);

        const editing = this.state.currentBill.isEditing;
        const existing = editing ? this.state.savedRecords.find(r => r.id === this.state.currentBill.editingId) : null;
        const billNumber = editing && existing ? existing.billNumber : `INV-${String(this.state.invoiceCounter).padStart(4, '0')}`;

        const record = {
            id: (editing && existing) ? existing.id : this.generateId(),
            billNumber,
            date: editing && existing ? existing.date : new Date().toISOString(),
            savedAt: Date.now(),
            customer: { ...this.state.currentBill.customer },
            items: this.state.currentBill.items.map(i => ({ ...i })),
            grand: this.calculateBillTotals(),
            notes: this.state.currentBill.notes
        };

        if (editing) {
            const idx = this.state.savedRecords.findIndex(r => r.id === record.id);
            if (idx !== -1) this.state.savedRecords[idx] = record;
        } else {
            this.state.savedRecords.unshift(record);
            this.state.invoiceCounter++;
            StorageAdapter.setBillCounter(this.state.invoiceCounter);
        }
        StorageAdapter.saveBills(this.state.savedRecords);
        this.resetCurrentBill();
        this.showToast('Bill saved successfully', 'success');
        this.switchTab('saved-bills');
        this.refreshAnalyticsIfVisible();
    },

    // ---------- SAVED RECORDS ----------
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
            const itemsStr = (r.items || []).map(i => (i.item || '').toLowerCase()).join(' ');
            return inv.includes(q) || name.includes(q) || mobile.includes(q) || itemsStr.includes(q);
        });
        this.DOM.searchCount.textContent = `${filtered.length} bill${filtered.length !== 1 ? 's' : ''}`;
        return filtered;
    },

    renderSavedRecords() {
        const records = this.filterRecords();

        // Mobile list (frozen markup)
        if (records.length === 0) {
            this.DOM.recordsList.innerHTML = `<div class="empty-state">${this.state.searchQuery ? 'No matching records' : 'No saved records'}</div>`;
        } else {
            this.DOM.recordsList.innerHTML = records.map(r => `
                <div class="record-row" data-id="${r.id}">
                    <div class="record-main" data-action="view">
                        <div class="record-header">
                            <span class="record-inv">${this.escapeHTML(r.billNumber)}</span>
                            <span class="record-date">${new Date(r.date).toLocaleDateString('en-IN')}</span>
                        </div>
                        <div class="record-customer">${this.escapeHTML(r.customer.name || 'Guest')}</div>
                        <div class="record-items-preview">${(r.items || []).map(i => this.escapeHTML(i.item)).filter(Boolean).join(', ')}</div>
                    </div>
                    <div class="record-total">${this.formatCurrency(r.grand)}</div>
                </div>`).join('');
        }

        // Desktop table
        if (records.length === 0) {
            this.DOM.savedTbody.innerHTML = `<tr class="table-empty-row"><td colspan="6">${this.state.searchQuery ? 'No matching records' : 'No saved records'}</td></tr>`;
        } else {
            this.DOM.savedTbody.innerHTML = records.map(r => `
                <tr data-id="${r.id}">
                    <td class="td-inv">${this.escapeHTML(r.billNumber)}</td>
                    <td>${this.escapeHTML(r.customer.name || 'Guest')}</td>
                    <td class="td-muted">${this.escapeHTML(r.customer.mobile || '—')}</td>
                    <td class="td-muted">${new Date(r.date).toLocaleDateString('en-IN')}</td>
                    <td class="td-amount td-right">${this.formatCurrency(r.grand)}</td>
                    <td class="td-actions">
                        <button class="icon-btn" data-action="view" aria-label="Open bill"><i data-lucide="eye"></i></button>
                        <button class="icon-btn" data-action="print" aria-label="Print bill"><i data-lucide="printer"></i></button>
                        <button class="icon-btn danger" data-action="delete" aria-label="Delete bill"><i data-lucide="trash-2"></i></button>
                    </td>
                </tr>`).join('');
        }
        this.icons();
    },

    viewRecord(id) {
        const record = this.state.savedRecords.find(r => r.id === id);
        if (!record) return;
        const itemsHTML = (record.items || []).map(i => `
            <tr><td>${this.escapeHTML(i.item)}</td><td class="num">${this.formatNumber(i.qty)}</td><td class="num">${this.formatCurrency(i.price)}</td><td class="num">${this.formatCurrency(i.total)}</td></tr>`).join('');
        this.openModal(`
            <div class="modal-header"><h2>${this.escapeHTML(record.billNumber)}</h2><button class="btn-close-modal" aria-label="Close">&times;</button></div>
            <div class="modal-body">
                <div class="record-details">
                    <div><strong>${this.escapeHTML(record.customer.name || 'Guest')}</strong></div>
                    ${record.customer.mobile ? `<div>${this.escapeHTML(record.customer.mobile)}</div>` : ''}
                    ${record.customer.address ? `<div>${this.escapeHTML(record.customer.address)}</div>` : ''}
                    <div class="text-secondary">${new Date(record.date).toLocaleString('en-IN')}</div>
                </div>
                <table class="items-table">
                    <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                    <tbody>${itemsHTML}</tbody>
                    <tfoot><tr><td colspan="3" class="text-right">Grand Total</td><td class="num"><strong>${this.formatCurrency(record.grand)}</strong></td></tr></tfoot>
                </table>
                ${record.notes ? `<div class="record-notes"><strong>Notes:</strong> ${this.escapeHTML(record.notes)}</div>` : ''}
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" data-action="edit-record" data-id="${record.id}">Edit</button>
                <button class="btn btn-outline" data-action="print-record" data-id="${record.id}">Print</button>
                <button class="btn btn-outline" data-action="thermal-record" data-id="${record.id}">Thermal</button>
                <button class="btn btn-danger" data-action="delete-record" data-id="${record.id}">Delete</button>
            </div>`);
    },

    editRecord(id) {
        const record = this.state.savedRecords.find(r => r.id === id);
        if (!record) return;
        this.state.currentBill = {
            customer: { ...record.customer },
            items: (record.items || []).map(i => ({ ...i })),
            notes: record.notes || '',
            isEditing: true, editingId: record.id
        };
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
            this.refreshAnalyticsIfVisible();
            this.showToast('Record deleted', 'success');
        });
    },

    // ---------- PRODUCTS UI ----------
    renderProducts() {
        const products = ProductsModule.state.products;

        // Mobile list (frozen markup)
        if (products.length === 0) {
            this.DOM.productsList.innerHTML = `<div class="empty-state">No products yet</div>`;
        } else {
            this.DOM.productsList.innerHTML = products.map(p => `
                <div class="product-row" data-id="${p.id}">
                    <div class="product-info">
                        <div class="product-name">${this.escapeHTML(p.name)}</div>
                        <div class="product-meta"><span class="product-code">${this.escapeHTML(p.code)}</span>${this.formatCurrency(p.price)}</div>
                    </div>
                    <div class="product-actions">
                        <button class="btn-icon btn-edit-product" aria-label="Edit product"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                        <button class="btn-icon btn-delete-product" aria-label="Delete product"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                    </div>
                </div>`).join('');
        }

        // Desktop summary tiles (real data)
        const bills = this.state.savedRecords;
        const soldNames = new Set();
        const perProduct = {};
        bills.forEach(b => (b.items || []).forEach(i => {
            soldNames.add((i.item || '').toLowerCase());
            perProduct[i.item] = (perProduct[i.item] || 0) + (i.total || 0);
        }));
        let topName = '—', topVal = 0;
        Object.entries(perProduct).forEach(([n, v]) => { if (v > topVal) { topVal = v; topName = n; } });
        const withSales = products.filter(p => soldNames.has(p.name.toLowerCase())).length;
        const highest = products.length ? products.reduce((a, b) => (b.price > a.price ? b : a)) : null;
        this.DOM.productSummary.innerHTML = `
            <div class="stat-tile"><div class="stat-label">Total Products</div><div class="stat-value">${products.length}</div></div>
            <div class="stat-tile"><div class="stat-label">Products With Sales</div><div class="stat-value">${withSales}</div></div>
            <div class="stat-tile"><div class="stat-label">Top Product</div><div class="stat-value">${this.escapeHTML(topName)}</div></div>
            <div class="stat-tile"><div class="stat-label">Highest Priced</div><div class="stat-value">${highest ? this.escapeHTML(highest.name) : '—'}</div></div>`;

        // Desktop table
        if (products.length === 0) {
            this.DOM.productsTbody.innerHTML = `<tr class="table-empty-row"><td colspan="4">No products yet</td></tr>`;
        } else {
            this.DOM.productsTbody.innerHTML = products.map(p => `
                <tr data-id="${p.id}">
                    <td class="td-inv">${this.escapeHTML(p.code)}</td>
                    <td>${this.escapeHTML(p.name)}</td>
                    <td class="td-amount td-right">${this.formatCurrency(p.price)}</td>
                    <td class="td-actions">
                        <button class="icon-btn" data-action="edit-product" aria-label="Edit product"><i data-lucide="pencil"></i></button>
                        <button class="icon-btn danger" data-action="delete-product" aria-label="Delete product"><i data-lucide="trash-2"></i></button>
                    </td>
                </tr>`).join('');
        }
        this.icons();
    },

    openProductModal(product = null) {
        const isEdit = !!product;
        this.openModal(`
            <div class="modal-header"><h2>${isEdit ? 'Edit Product' : 'Add Product'}</h2><button class="btn-close-modal" aria-label="Close">&times;</button></div>
            <div class="modal-body">
                <div class="form-group"><label>Product Code *</label><input type="text" id="prod-code" class="input" value="${isEdit ? this.escapeHTML(product.code) : ''}" placeholder="e.g. SKU001"></div>
                <div class="form-group"><label>Product Name *</label><input type="text" id="prod-name" class="input" value="${isEdit ? this.escapeHTML(product.name) : ''}" placeholder="e.g. Wooden Sofa"></div>
                <div class="form-group"><label>Default Price</label><input type="number" id="prod-price" class="input" value="${isEdit ? product.price : '0'}" placeholder="0.00" step="0.01" min="0"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" data-action="close-modal">Cancel</button>
                <button class="btn btn-primary" data-action="save-product" data-id="${isEdit ? product.id : ''}">Save</button>
            </div>`);
        setTimeout(() => { const el = document.getElementById('prod-code'); if (el) el.focus(); }, 100);
    },

    saveProduct(id) {
        const code = document.getElementById('prod-code').value.trim();
        const name = document.getElementById('prod-name').value.trim();
        const price = Math.max(0, parseFloat(document.getElementById('prod-price').value) || 0);
        const res = ProductsModule.addOrUpdate(id, code, name, price);
        if (!res.success) { this.showToast(res.error, 'error'); return; }
        this.renderProducts();
        this.closeModal();
        this.showToast('Product saved', 'success');
    },

    deleteProduct(id) {
        this.openConfirm('Delete Product?', 'This cannot be undone.', () => {
            ProductsModule.delete(id);
            this.renderProducts();
            this.showToast('Product deleted', 'success');
        });
    },

    // ---------- AUTOCOMPLETE ----------
    showAutocomplete(input, query) {
        if (!query || query.length < 1) { this.hideAutocomplete(); return; }
        const matches = ProductsModule.search(query);
        if (matches.length === 0) { this.hideAutocomplete(); return; }
        this.state.autocomplete.targetInput = input;
        this.state.autocomplete.activeIndex = -1;
        this.state.autocomplete.matches = matches;
        this.DOM.autocomplete.innerHTML = matches.map((p, i) => `
            <div class="ac-item" data-index="${i}">
                <div class="ac-name">${this.escapeHTML(p.name)}</div>
                <div class="ac-meta">${this.escapeHTML(p.code)} • ${this.formatCurrency(p.price)}</div>
            </div>`).join('');
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
        qtyInput.focus(); qtyInput.select();
    },

    // ---------- PRINTING (brand-free receipt) ----------
    generateReceiptHTML(bill, invoiceNum) {
        const date = new Date(bill.savedAt || bill.date).toLocaleString('en-IN');
        const itemsHTML = (bill.items || []).map(i => `
            <div class="receipt-item" style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <div style="flex:1; word-break:break-word;">${this.escapeHTML(i.item)}</div>
                <div style="text-align:right; white-space:nowrap; margin-left:8px;">${this.formatNumber(i.qty)}×${this.formatCurrency(i.price)}<br><strong>${this.formatCurrency(i.total)}</strong></div>
            </div>`).join('');
        return `
            <div class="receipt" style="font-family: monospace; font-size: 12px; line-height: 1.4;">
                <div style="text-align:center; margin-bottom:10px;">
                    <strong style="font-size:1.3em;">INVOICE</strong><br>${this.escapeHTML(invoiceNum)}<br>${date}
                </div>
                <div style="margin-bottom:10px; border-bottom:1px dashed #000; padding-bottom:10px;">
                    <strong>${this.escapeHTML(bill.customer.name || 'Guest')}</strong><br>
                    ${bill.customer.mobile ? this.escapeHTML(bill.customer.mobile) + '<br>' : ''}
                    ${bill.customer.address ? this.escapeHTML(bill.customer.address) + '<br>' : ''}
                </div>
                <div style="margin:10px 0; border-bottom:1px dashed #000; padding-bottom:10px;">${itemsHTML}</div>
                <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:1.2em; margin-top:8px;">
                    <span>Grand Total</span><span>${this.formatCurrency(bill.grand)}</span>
                </div>
                ${bill.notes ? `<div style="margin-top:12px; border-top:1px dashed #000; padding-top:8px;">Notes: ${this.escapeHTML(bill.notes)}</div>` : ''}
            </div>`;
    },

    printContent(html, isThermal = false, thermalSize = '80mm') {
        try {
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
            document.body.appendChild(iframe);
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(`<!DOCTYPE html><html><head><title>Print</title><style>
                @page { margin: 0; ${isThermal ? `size: ${thermalSize} auto;` : ''} }
                body { font-family: monospace; margin: 0; padding: ${isThermal ? '4mm' : '20mm'}; color: #000; background: #fff; ${isThermal ? `width: ${thermalSize}; box-sizing: border-box;` : ''} }
            </style></head><body>${html}</body></html>`);
            doc.close();
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 2000);
        } catch (e) {
            this.showToast('Print failed', 'error');
        }
    },

    printNormal(id = null) {
        let bill, num;
        if (id) { const r = this.state.savedRecords.find(x => x.id === id); if (!r) return; bill = r; num = r.billNumber; }
        else {
            if (this.state.currentBill.items.length === 0 && !this.hasUnsavedData()) { this.showToast('Nothing to print', 'error'); return; }
            bill = this.state.currentBill; num = this.DOM.invoiceNumber.textContent;
        }
        this.printContent(this.generateReceiptHTML(bill, num), false);
    },

    printThermal(id = null, size = '80mm') {
        let bill, num;
        if (id) { const r = this.state.savedRecords.find(x => x.id === id); if (!r) return; bill = r; num = r.billNumber; }
        else {
            if (this.state.currentBill.items.length === 0 && !this.hasUnsavedData()) { this.showToast('Nothing to print', 'error'); return; }
            bill = this.state.currentBill; num = this.DOM.invoiceNumber.textContent;
        }
        this.printContent(this.generateReceiptHTML(bill, num), true, size);
    },

    // ---------- MODALS / TOASTS ----------
    openModal(html) {
        this.DOM.modalContent.innerHTML = html;
        this.DOM.modalOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    },
    closeModal() {
        this.DOM.modalOverlay.classList.add('hidden');
        this.DOM.modalContent.innerHTML = '';
        document.body.style.overflow = '';
    },
    openConfirm(title, message, onConfirm) {
        this.openModal(`
            <div class="modal-header"><h2>${this.escapeHTML(title)}</h2><button class="btn-close-modal" aria-label="Close">&times;</button></div>
            <div class="modal-body"><p>${this.escapeHTML(message)}</p></div>
            <div class="modal-footer">
                <button class="btn btn-outline" data-action="close-modal">Cancel</button>
                <button class="btn btn-danger" data-action="confirm-action">Confirm</button>
            </div>`);
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

    // ---------- NAVIGATION ----------
    switchTab(tabName) {
        if (tabName === this.state.currentTab && !this.state.currentBill.isEditing) return;
        if (this.state.currentTab === 'new-bill' && tabName !== 'new-bill') {
            if (this.hasUnsavedData() && !this.state.currentBill.isEditing) {
                this.openConfirm('Discard Bill?', 'You have unsaved data. Discard it?', () => { this.resetCurrentBill(); this.performSwitch(tabName); });
                return;
            }
        }
        this.performSwitch(tabName);
    },

    performSwitch(tabName) {
        this.state.currentTab = tabName;
        StorageAdapter.setTab(tabName);
        document.querySelectorAll('.segment-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
        document.querySelectorAll('.sidebar-link').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
        document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${tabName}`));
        const titles = { 'new-bill': 'New Bill', 'saved-bills': 'Saved Bills', 'products': 'Products', 'analytics': 'Analytics' };
        document.getElementById('desktop-page-title').textContent = titles[tabName] || 'Billing';
        if (tabName === 'saved-bills') this.renderSavedRecords();
        if (tabName === 'products') this.renderProducts();
        if (tabName === 'new-bill') this.renderBillUI();
        if (tabName === 'analytics') this.renderAnalytics();
        window.scrollTo(0, 0);
    },

    // ---------- EVENTS ----------
    initEvents() {
        document.getElementById('tab-nav').addEventListener('click', e => { const b = e.target.closest('.segment-btn'); if (b) this.switchTab(b.dataset.tab); });
        document.getElementById('sidebar-nav').addEventListener('click', e => { const b = e.target.closest('.sidebar-link'); if (b) this.switchTab(b.dataset.tab); });

        this.DOM.custName.addEventListener('input', () => this.state.currentBill.customer.name = this.DOM.custName.value);
        this.DOM.custMobile.addEventListener('input', () => this.state.currentBill.customer.mobile = this.DOM.custMobile.value);
        this.DOM.custAddress.addEventListener('input', () => this.state.currentBill.customer.address = this.DOM.custAddress.value);
        this.DOM.billNotes.addEventListener('input', () => this.state.currentBill.notes = this.DOM.billNotes.value);
        this.DOM.btnAddItem.addEventListener('click', () => this.addItem());

        // Save / Print — mobile bar + desktop panel
        this.DOM.btnSave.addEventListener('click', () => this.saveBill());
        document.getElementById('btn-save-bill-desktop').addEventListener('click', () => this.saveBill());
        this.DOM.btnPrint.addEventListener('click', () => this.printNormal());
        document.getElementById('btn-print-bill-desktop').addEventListener('click', () => this.printNormal());
        this.DOM.btnThermal58.addEventListener('click', () => this.printThermal(null, '58mm'));
        document.getElementById('btn-thermal-58-desktop').addEventListener('click', () => this.printThermal(null, '58mm'));
        this.DOM.btnThermal80.addEventListener('click', () => this.printThermal(null, '80mm'));
        document.getElementById('btn-thermal-80-desktop').addEventListener('click', () => this.printThermal(null, '80mm'));

        this.DOM.itemsList.addEventListener('input', e => {
            const row = e.target.closest('.item-row'); if (!row) return;
            if (e.target.classList.contains('item-name')) this.showAutocomplete(e.target, e.target.value);
            if (['item-name', 'item-qty', 'item-price'].some(c => e.target.classList.contains(c))) this.updateItemFromRow(row);
        });
        this.DOM.itemsList.addEventListener('click', e => {
            if (e.target.closest('.btn-remove-item')) {
                const row = e.target.closest('.item-row');
                if (row) this.removeItem(parseInt(row.dataset.index));
            }
        });

        this.DOM.autocomplete.addEventListener('click', e => { const it = e.target.closest('.ac-item'); if (it) this.selectAutocompleteItem(parseInt(it.dataset.index)); });
        document.addEventListener('click', e => { if (!e.target.closest('.autocomplete-dropdown') && !e.target.closest('.item-name')) this.hideAutocomplete(); });
        document.addEventListener('keydown', e => {
            if (!this.DOM.autocomplete.classList.contains('hidden')) {
                const items = this.DOM.autocomplete.querySelectorAll('.ac-item');
                if (e.key === 'ArrowDown') { e.preventDefault(); this.state.autocomplete.activeIndex = Math.min(this.state.autocomplete.activeIndex + 1, items.length - 1); this._updateAcActive(items); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); this.state.autocomplete.activeIndex = Math.max(this.state.autocomplete.activeIndex - 1, -1); this._updateAcActive(items); }
                else if (e.key === 'Enter' && this.state.autocomplete.activeIndex >= 0) { e.preventDefault(); this.selectAutocompleteItem(this.state.autocomplete.activeIndex); }
                else if (e.key === 'Escape') this.hideAutocomplete();
            }
            if (e.key === 'Escape' && !this.DOM.modalOverlay.classList.contains('hidden')) this.closeModal();
        });

        // Debounced saved-bills search
        const debouncedSearch = this.debounce(() => { this.state.searchQuery = this.DOM.searchInput.value; this.renderSavedRecords(); }, 120);
        this.DOM.searchInput.addEventListener('input', debouncedSearch);
        this.DOM.clearSearch.addEventListener('click', () => { this.DOM.searchInput.value = ''; this.state.searchQuery = ''; this.renderSavedRecords(); this.DOM.searchInput.focus(); });

        this.DOM.recordsList.addEventListener('click', e => {
            const row = e.target.closest('.record-row'); if (!row) return;
            if (e.target.closest('.record-main')) this.viewRecord(row.dataset.id);
        });
        this.DOM.savedTbody.addEventListener('click', e => {
            const btn = e.target.closest('[data-action]'); if (!btn) return;
            const id = btn.closest('tr').dataset.id;
            const a = btn.dataset.action;
            if (a === 'view') this.viewRecord(id);
            if (a === 'print') this.printNormal(id);
            if (a === 'delete') this.deleteRecord(id);
        });

        this.DOM.productsList.addEventListener('click', e => {
            const row = e.target.closest('.product-row'); if (!row) return;
            if (e.target.closest('.btn-edit-product')) { const p = ProductsModule.state.products.find(x => x.id === row.dataset.id); if (p) this.openProductModal(p); }
            if (e.target.closest('.btn-delete-product')) this.deleteProduct(row.dataset.id);
        });
        this.DOM.productsTbody.addEventListener('click', e => {
            const btn = e.target.closest('[data-action]'); if (!btn) return;
            const id = btn.closest('tr').dataset.id;
            if (btn.dataset.action === 'edit-product') { const p = ProductsModule.state.products.find(x => x.id === id); if (p) this.openProductModal(p); }
            if (btn.dataset.action === 'delete-product') this.deleteProduct(id);
        });
        this.DOM.btnAddProduct.addEventListener('click', () => this.openProductModal());

        this.DOM.modalOverlay.addEventListener('click', e => {
            if (e.target === this.DOM.modalOverlay || e.target.closest('.btn-close-modal') || e.target.closest('[data-action="close-modal"]')) this.closeModal();
            const actionBtn = e.target.closest('[data-action]'); if (!actionBtn) return;
            const a = actionBtn.dataset.action, id = actionBtn.dataset.id;
            if (a === 'save-product') this.saveProduct(id || null);
            if (a === 'edit-record') this.editRecord(id);
            if (a === 'delete-record') this.deleteRecord(id);
            if (a === 'print-record') this.printNormal(id);
            if (a === 'thermal-record') this.printThermal(id, '80mm');
        });

        document.getElementById('trend-range').addEventListener('click', e => {
            const btn = e.target.closest('button'); if (!btn) return;
            document.querySelectorAll('#trend-range button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.state.analyticsRange = parseInt(btn.dataset.range);
            this.renderAnalytics();
        });

        // Breakpoint guard: analytics is desktop-only
        const mq = window.matchMedia('(min-width: 1024px)');
        const onBp = () => { if (!mq.matches && this.state.currentTab === 'analytics') this.performSwitch('saved-bills'); };
        if (mq.addEventListener) mq.addEventListener('change', onBp); else mq.addListener(onBp);
    },

    _updateAcActive(items) {
        items.forEach((it, i) => it.classList.toggle('active', i === this.state.autocomplete.activeIndex));
        if (this.state.autocomplete.activeIndex >= 0 && items[this.state.autocomplete.activeIndex]) {
            items[this.state.autocomplete.activeIndex].scrollIntoView({ block: 'nearest' });
        }
    },

    // ---------- INIT ----------
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
        this.DOM.savedTbody = document.getElementById('saved-records-tbody');
        this.DOM.productsList = document.getElementById('products-list');
        this.DOM.productsTbody = document.getElementById('products-tbody');
        this.DOM.productSummary = document.getElementById('product-summary');
        this.DOM.btnAddProduct = document.getElementById('btn-add-product');
        this.DOM.autocomplete = document.getElementById('autocomplete-dropdown');
        this.DOM.modalOverlay = document.getElementById('modal-overlay');
        this.DOM.modalContent = document.getElementById('modal-content');
        this.DOM.toastContainer = document.getElementById('toast-container');
        this.DOM.invoiceNumber = document.getElementById('invoice-number');
    },

    init() {
        this.cacheDOMRefs();
        ProductsModule.load();
        this.state.savedRecords = (StorageAdapter.getBills() || [])
            .map(r => r && typeof r === 'object' ? {
                id: r.id || this.generateId(),
                billNumber: String(r.billNumber || 'INV-0000'),
                date: r.date || new Date().toISOString(),
                savedAt: r.savedAt || Date.now(),
                customer: { name: String(r.customer?.name || ''), mobile: String(r.customer?.mobile || ''), address: String(r.customer?.address || '') },
                items: Array.isArray(r.items) ? r.items.map(i => ({ item: String(i?.item || ''), qty: Math.max(0, parseFloat(i?.qty) || 0), price: Math.max(0, parseFloat(i?.price) || 0), total: Math.max(0, parseFloat(i?.total) || 0) })) : [],
                grand: Math.max(0, parseFloat(r.grand) || 0),
                notes: String(r.notes || '')
            } : null)
            .filter(Boolean)
            .sort((a, b) => b.savedAt - a.savedAt);
        this.state.invoiceCounter = Math.max(1, parseInt(StorageAdapter.getBillCounter()) || 1);

        let tab = StorageAdapter.getTab();
        if (tab === 'analytics' && window.innerWidth < 1024) tab = 'saved-bills';
        this.state.currentTab = tab;

        document.getElementById('header-date').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

        this.initEvents();
        this.performSwitch(this.state.currentTab);
        this.icons();
    }
};

document.addEventListener('DOMContentLoaded', () => BillingModule.init());
